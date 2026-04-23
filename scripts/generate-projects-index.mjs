import { copyFile, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";

const root = process.cwd();
const contentRoot = path.join(root, "content");
const projectsCsvPath = path.join(contentRoot, "projects.csv");
const contentProjectsRoot = path.join(contentRoot, "projects");
const projectsRoot = path.join(root, "public", "projects");
const outputPath = path.join(root, "public", "projects-index.json");
const normalizationReportPath = path.join(root, "public", "asset-normalization-report.json");

const mediaExtensions = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".svg",
  ".mp4",
  ".webm",
  ".mov",
  ".glb",
  ".gltf"
]);

const mp4VideoCopyCodecs = new Set(["h264", "hevc"]);
const mp4AudioCopyCodecs = new Set(["aac", "mp3", "ac3", "eac3", "alac", "none"]);

function extensionToType(ext) {
  if ([".mp4", ".webm", ".mov"].includes(ext)) return "video";
  if ([".glb", ".gltf"].includes(ext)) return "3d-model";
  return "image";
}

function isGeneratedPosterFileName(fileName) {
  return /\.poster\.(jpg|jpeg|png|webp)$/i.test(fileName);
}

function titleFromSlug(slug) {
  return slug
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

async function safeReadText(filePath) {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

function parseCsvLine(line, delimiter) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      const next = line[i + 1];
      if (inQuotes && next === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values.map((value) => value.trim());
}

function parseCsv(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
  if (lines.length < 2) return [];

  const delimiter = lines[0].includes(";") ? ";" : ",";
  const headers = parseCsvLine(lines[0], delimiter);
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line, delimiter);
    const row = {};
    for (let i = 0; i < headers.length; i++) {
      row[headers[i]] = cells[i] ?? "";
    }
    return row;
  });
}

async function walkFiles(dirPath) {
  const entries = await readdir(dirPath, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(entryPath)));
      continue;
    }
    if (entry.isFile()) {
      files.push(entryPath);
    }
  }
  return files;
}

function probeMediaDimensions(filePath) {
  try {
    const out = execFileSync("ffprobe", [
      "-v", "error",
      "-select_streams", "v:0",
      "-show_entries", "stream=width,height",
      "-of", "csv=p=0:s=x",
      filePath,
    ], { encoding: "utf8" }).trim();
    const [width, height] = out.split("x").map((value) => Number.parseInt(value, 10));
    if (!width || !height) return {};
    return { width, height };
  } catch {
    return {};
  }
}

function probeMediaInfo(filePath) {
  try {
    const out = execFileSync("ffprobe", [
      "-v", "error",
      "-print_format", "json",
      "-show_streams",
      "-show_format",
      filePath,
    ], { encoding: "utf8" });
    return JSON.parse(out);
  } catch {
    return null;
  }
}

function normalizeAssetSegment(value) {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "asset";
}

function buildUniqueNormalizedRelativePath(sourceRelPath, usedPaths, extOverride) {
  const posixRelPath = sourceRelPath.split(path.sep).join(path.posix.sep);
  const parsed = path.posix.parse(posixRelPath);
  const dirSegments = parsed.dir
    ? parsed.dir.split("/").filter(Boolean).map((segment) => normalizeAssetSegment(segment))
    : [];
  const ext = (extOverride ?? parsed.ext).toLowerCase();
  const baseName = normalizeAssetSegment(parsed.name);
  const joinCandidate = (name) => (dirSegments.length > 0 ? path.posix.join(...dirSegments, `${name}${ext}`) : `${name}${ext}`);

  let candidate = joinCandidate(baseName);
  if (!usedPaths.has(candidate)) {
    usedPaths.add(candidate);
    return candidate;
  }

  const digest = createHash("sha1").update(posixRelPath).digest("hex").slice(0, 8);
  candidate = joinCandidate(`${baseName}-${digest}`);
  if (!usedPaths.has(candidate)) {
    usedPaths.add(candidate);
    return candidate;
  }

  let counter = 2;
  while (usedPaths.has(candidate)) {
    candidate = joinCandidate(`${baseName}-${digest}-${counter}`);
    counter += 1;
  }
  usedPaths.add(candidate);
  return candidate;
}

function canLosslesslyRemuxMovToMp4(mediaInfo) {
  if (!mediaInfo) {
    return { ok: false, reason: "ffprobe failed" };
  }

  const streams = mediaInfo.streams ?? [];
  const videoStreams = streams.filter((stream) => stream.codec_type === "video");
  if (videoStreams.length === 0) {
    return { ok: false, reason: "missing video stream" };
  }

  const primaryVideo = videoStreams[0];
  if (!mp4VideoCopyCodecs.has(primaryVideo.codec_name)) {
    return { ok: false, reason: `video codec ${primaryVideo.codec_name || "unknown"} not safe for stream-copy mp4 remux` };
  }

  const audioStreams = streams.filter((stream) => stream.codec_type === "audio");
  for (const audio of audioStreams) {
    const codec = audio.codec_name || "unknown";
    if (!mp4AudioCopyCodecs.has(codec)) {
      return { ok: false, reason: `audio codec ${codec} not safe for stream-copy mp4 remux` };
    }
  }

  return { ok: true };
}

async function discoverMedia(projectFolderPath) {
  const files = await walkFiles(projectFolderPath);
  return files
    .filter((filePath) => mediaExtensions.has(path.extname(filePath).toLowerCase()))
    .filter((filePath) => !isGeneratedPosterFileName(path.basename(filePath)))
    .sort((a, b) => a.localeCompare(b))
    .map((filePath, index) => {
      const relPath = path.relative(projectFolderPath, filePath).split(path.sep).join("/");
      const ext = path.extname(filePath).toLowerCase();
      return {
        id: `${path.parse(relPath).name}-${index}`,
        type: extensionToType(ext),
        src: relPath,
        description: "",
        ...probeMediaDimensions(filePath)
      };
    });
}

function summarizeProjectReport(projectId, items) {
  return items.reduce((summary, item) => {
    summary.total += 1;
    if (item.status === "failure") summary.failures += 1;
    if (item.status === "warning") summary.warnings += 1;
    if (item.action === "copy") summary.copied += 1;
    if (item.action === "remux-mov-to-mp4") summary.remuxed += 1;
    if (item.action === "skip-duplicate-mov") summary.skipped += 1;
    return summary;
  }, { projectId, total: 0, copied: 0, remuxed: 0, skipped: 0, warnings: 0, failures: 0 });
}

async function copyProjectAssets(slug) {
  const sourceDir = path.join(contentProjectsRoot, slug);
  const targetDir = path.join(projectsRoot, slug);
  const fileNameMap = new Map();
  const reportItems = [];

  try {
    const sourceFiles = await walkFiles(sourceDir);
    const mediaFiles = sourceFiles
      .filter((filePath) => mediaExtensions.has(path.extname(filePath).toLowerCase()))
      .filter((filePath) => !isGeneratedPosterFileName(path.basename(filePath)))
      .sort((a, b) => a.localeCompare(b));

    const records = mediaFiles.map((sourceFile) => {
      const sourceRelPath = path.relative(sourceDir, sourceFile);
      const parsed = path.parse(sourceRelPath);
      return {
        sourceFile,
        sourceRelPath,
        sourceExt: parsed.ext.toLowerCase(),
        sourceDir: parsed.dir,
        sourceBaseName: parsed.name,
        sourceFileName: path.basename(sourceFile),
        action: "copy",
        targetRelPath: null,
        aliasTargetRecord: null,
      };
    });

    const siblingMp4Map = new Map();
    for (const record of records) {
      if (record.sourceExt === ".mp4") {
        siblingMp4Map.set(`${record.sourceDir.toLowerCase()}::${record.sourceBaseName.toLowerCase()}`, record);
      }
    }

    for (const record of records) {
      if (record.sourceExt !== ".mov") continue;
      const siblingMp4 = siblingMp4Map.get(`${record.sourceDir.toLowerCase()}::${record.sourceBaseName.toLowerCase()}`);
      if (siblingMp4) {
        record.action = "skip-duplicate-mov";
        record.aliasTargetRecord = siblingMp4;
        reportItems.push({
          projectId: slug,
          source: record.sourceRelPath.split(path.sep).join("/"),
          target: siblingMp4.sourceRelPath.split(path.sep).join("/"),
          action: "skip-duplicate-mov",
          status: "warning",
          detail: "Skipped .mov because a sibling .mp4 source already exists for the same asset.",
        });
        continue;
      }

      const mediaInfo = probeMediaInfo(record.sourceFile);
      const remux = canLosslesslyRemuxMovToMp4(mediaInfo);
      if (remux.ok) {
        record.action = "remux-mov-to-mp4";
      } else {
        record.action = "copy";
        reportItems.push({
          projectId: slug,
          source: record.sourceRelPath.split(path.sep).join("/"),
          target: record.sourceRelPath.split(path.sep).join("/"),
          action: "copy",
          status: "warning",
          detail: `Kept original .mov because lossless mp4 remux is not safe: ${remux.reason}.`,
        });
      }
    }

    const usedPaths = new Set();
    await rm(targetDir, { recursive: true, force: true });

    for (const record of records) {
      if (record.action === "skip-duplicate-mov") continue;
      const extOverride = record.action === "remux-mov-to-mp4" ? ".mp4" : undefined;
      record.targetRelPath = buildUniqueNormalizedRelativePath(record.sourceRelPath, usedPaths, extOverride);
    }

    for (const record of records) {
      const sourceKeyName = record.sourceFileName;
      if (record.action === "skip-duplicate-mov") {
        const aliasedTarget = record.aliasTargetRecord?.targetRelPath;
        if (aliasedTarget) {
          fileNameMap.set(sourceKeyName, path.posix.basename(aliasedTarget));
        }
        continue;
      }

      if (!record.targetRelPath) {
        throw new Error(`Missing normalized target path for ${record.sourceRelPath}`);
      }

      const targetFile = path.join(targetDir, record.targetRelPath);
      await mkdir(path.dirname(targetFile), { recursive: true });

      if (record.action === "remux-mov-to-mp4") {
        try {
          execFileSync("ffmpeg", [
            "-y",
            "-i", record.sourceFile,
            "-map", "0:v:0",
            "-map", "0:a?",
            "-dn",
            "-c", "copy",
            "-movflags", "+faststart",
            targetFile,
          ], { stdio: "pipe" });
          reportItems.push({
            projectId: slug,
            source: record.sourceRelPath.split(path.sep).join("/"),
            target: record.targetRelPath,
            action: "remux-mov-to-mp4",
            status: "success",
            detail: "Lossless stream-copy remuxed .mov into .mp4 without re-encoding video or audio.",
          });
        } catch (error) {
          const fallbackTargetRelPath = buildUniqueNormalizedRelativePath(record.sourceRelPath, usedPaths);
          const fallbackTargetFile = path.join(targetDir, fallbackTargetRelPath);
          await mkdir(path.dirname(fallbackTargetFile), { recursive: true });
          await copyFile(record.sourceFile, fallbackTargetFile);
          record.targetRelPath = fallbackTargetRelPath;
          reportItems.push({
            projectId: slug,
            source: record.sourceRelPath.split(path.sep).join("/"),
            target: fallbackTargetRelPath,
            action: "copy",
            status: "failure",
            detail: `Lossless .mov -> .mp4 remux failed; kept normalized original instead. ${error instanceof Error ? error.message : String(error)}`,
          });
        }
      } else {
        await copyFile(record.sourceFile, targetFile);
        if (!reportItems.some((item) => item.projectId === slug && item.source === record.sourceRelPath.split(path.sep).join("/") && item.action === "copy" && item.status !== "success")) {
          reportItems.push({
            projectId: slug,
            source: record.sourceRelPath.split(path.sep).join("/"),
            target: record.targetRelPath,
            action: "copy",
            status: "success",
            detail: "Copied without recompression or visual changes.",
          });
        }
      }

      fileNameMap.set(sourceKeyName, path.posix.basename(record.targetRelPath));
    }

    return { ok: true, fileNameMap, reportItems, summary: summarizeProjectReport(slug, reportItems) };
  } catch (error) {
    reportItems.push({
      projectId: slug,
      source: slug,
      target: slug,
      action: "copy",
      status: "failure",
      detail: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, fileNameMap, reportItems, summary: summarizeProjectReport(slug, reportItems) };
  }
}

function parsePipeList(rawValue) {
  if (!rawValue) return [];
  return rawValue
    .split("|")
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value) => !isGeneratedPosterFileName(value));
}

function parseTags(rawTags) {
  return parsePipeList(rawTags);
}

function mergeViewerMedia(preferredNames, discoveredNames) {
  const merged = [];
  const seen = new Set();
  for (const name of [...preferredNames, ...discoveredNames]) {
    if (!name || isGeneratedPosterFileName(name) || seen.has(name)) continue;
    seen.add(name);
    merged.push(name);
  }

  return merged;
}

async function buildIndex() {
  await mkdir(projectsRoot, { recursive: true });

  const csvRaw = await safeReadText(projectsCsvPath);
  if (!csvRaw) {
    throw new Error(`Missing CSV data source: ${projectsCsvPath}`);
  }
  const rows = parseCsv(csvRaw);
  if (rows.length === 0) {
    throw new Error(`CSV has no project rows: ${projectsCsvPath}`);
  }

  const projects = [];
  const normalizationProjects = [];
  const normalizationFailures = [];
  const normalizationWarnings = [];

  for (const row of rows) {
    const siteStatus = (row.site_status || "live").trim().toLowerCase();
    if (siteStatus === "archived" || siteStatus === "hidden" || siteStatus === "disabled") {
      continue;
    }
    const slug = row.slug;
    if (!slug) {
      throw new Error("CSV row is missing required field: slug");
    }

    const copyResult = await copyProjectAssets(slug);
    normalizationProjects.push({
      projectId: slug,
      summary: copyResult.summary,
      items: copyResult.reportItems,
    });
    normalizationFailures.push(...copyResult.reportItems.filter((item) => item.status === "failure"));
    normalizationWarnings.push(...copyResult.reportItems.filter((item) => item.status === "warning"));

    const publicMediaPath = path.join(projectsRoot, slug);
    let media = copyResult.ok ? await discoverMedia(publicMediaPath).catch(() => []) : [];
    if (media.length === 0) {
      media = await discoverMedia(publicMediaPath).catch(() => []);
    }

    const normalizeConfiguredName = (fileName) => {
      if (!fileName || isGeneratedPosterFileName(fileName)) return "";
      return copyResult.fileNameMap.get(fileName) ?? fileName;
    };

    const defaultDetailBody = row.description || "Project details will be updated soon.";
    const mediaFileNames = media
      .map((item) => item.src.split("/").pop())
      .filter(Boolean)
      .filter((name) => !isGeneratedPosterFileName(name));
    const preferredHeroPrimary = normalizeConfiguredName(row.hero_media_primary || "");
    const preferredHeroSecondary = normalizeConfiguredName(row.hero_media_secondary || "");
    const explicitViewerMedia = parsePipeList(row.viewer_media).map((name) => normalizeConfiguredName(name));
    const heroPrimary = preferredHeroPrimary || mediaFileNames[0] || "";
    const heroSecondary = preferredHeroSecondary;
    const viewerMedia = explicitViewerMedia.length > 0 ? explicitViewerMedia : mergeViewerMedia([], mediaFileNames);

    projects.push({
      id: row.id || slug,
      slug,
      title: row.title || titleFromSlug(slug),
      category: row.category || "experimental",
      description: row.description || "Project details will be updated soon.",
      year: row.year || "",
      client: row.client || "Independent",
      tags: parseTags(row.tags),
      detail: {
        panels: [
          {
            heading: row.info_block_1_heading || "Approach",
            body: row.info_block_1_content || defaultDetailBody
          },
          {
            heading: row.info_block_2_heading || "Outcomes",
            body: row.info_block_2_content || defaultDetailBody
          }
        ],
        media: {
          heroPrimary,
          heroSecondary,
          viewerMedia
        }
      },
      media,
      path: row.path || `/projects/${slug}`
    });
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    count: projects.length,
    projects
  };

  const normalizationReport = {
    generatedAt: new Date().toISOString(),
    projectCount: normalizationProjects.length,
    failureCount: normalizationFailures.length,
    warningCount: normalizationWarnings.length,
    failures: normalizationFailures,
    warnings: normalizationWarnings,
    projects: normalizationProjects,
  };

  await writeFile(outputPath, JSON.stringify(payload, null, 2), "utf8");
  await writeFile(normalizationReportPath, JSON.stringify(normalizationReport, null, 2), "utf8");
  console.log(`Generated ${projects.length} project entries to public/projects-index.json`);
  console.log(`Wrote asset normalization report to ${path.relative(root, normalizationReportPath)}`);
}

buildIndex().catch((error) => {
  console.error("Failed to generate projects index:", error);
  process.exit(1);
});
