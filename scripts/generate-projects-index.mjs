import { copyFile, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";

const root = process.cwd();
const contentRoot = path.join(root, "content");
const projectsCsvPath = path.join(contentRoot, "projects.csv");
const contentProjectsRoot = path.join(contentRoot, "projects");
const dropInRoot = path.join(root, "drop_in");
const dropInCsvPath = path.join(dropInRoot, "projects.csv");
const projectsRoot = path.join(root, "public", "projects");
const outputPath = path.join(root, "public", "projects-index.json");
const normalizationReportPath = path.join(root, "public", "asset-normalization-report.json");
const responsiveImageWidths = [960, 1600];
const responsiveImageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const videoExtensions = new Set([".mp4", ".webm", ".mov"]);
const videoMaxEdge = 1920;
const posterMaxEdge = 1600;
const videoCrf = 23;
const videoPreset = "slow";
const videoAudioBitrate = "128k";

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

function extensionToType(ext) {
  if (videoExtensions.has(ext)) return "video";
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

function buildPosterRelativePath(targetRelPath, usedPaths) {
  const parsed = path.posix.parse(targetRelPath);
  const base = parsed.dir ? `${parsed.dir}/${parsed.name}.poster.jpg` : `${parsed.name}.poster.jpg`;
  if (!usedPaths.has(base)) {
    usedPaths.add(base);
    return base;
  }

  const digest = createHash("sha1").update(targetRelPath).digest("hex").slice(0, 8);
  let counter = 1;
  let candidate = parsed.dir ? `${parsed.dir}/${parsed.name}-${digest}.poster.jpg` : `${parsed.name}-${digest}.poster.jpg`;
  while (usedPaths.has(candidate)) {
    counter += 1;
    candidate = parsed.dir ? `${parsed.dir}/${parsed.name}-${digest}-${counter}.poster.jpg` : `${parsed.name}-${digest}-${counter}.poster.jpg`;
  }
  usedPaths.add(candidate);
  return candidate;
}

function buildResponsiveRelativeDir(targetRelPath) {
  const parsed = path.posix.parse(targetRelPath);
  return parsed.dir ? `${parsed.dir}/_responsive` : "_responsive";
}

function computeSavedPercent(sourceSizeBytes, targetSizeBytes) {
  if (!sourceSizeBytes || sourceSizeBytes <= 0 || targetSizeBytes == null) return null;
  return Number((((sourceSizeBytes - targetSizeBytes) / sourceSizeBytes) * 100).toFixed(2));
}

async function discoverMedia(projectFolderPath) {
  const files = await walkFiles(projectFolderPath);
  return files
    .filter((filePath) => mediaExtensions.has(path.extname(filePath).toLowerCase()))
    .filter((filePath) => !filePath.includes(`${path.sep}_responsive${path.sep}`))
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
    if (item.action === "copy" && item.status === "success") summary.copied += 1;
    if (item.action === "optimize-video" && item.status === "success") {
      summary.optimizedVideos += 1;
      summary.videoBytesBefore += item.sourceSizeBytes ?? 0;
      summary.videoBytesAfter += item.targetSizeBytes ?? 0;
    }
    if (item.action === "skip-duplicate-mov") summary.skipped += 1;
    if (item.action === "responsive-images" && item.status === "success") summary.responsiveJobs += 1;
    if (item.action === "generate-video-poster" && item.status === "success") summary.posters += 1;
    return summary;
  }, {
    projectId,
    total: 0,
    copied: 0,
    optimizedVideos: 0,
    skipped: 0,
    responsiveJobs: 0,
    posters: 0,
    warnings: 0,
    failures: 0,
    videoBytesBefore: 0,
    videoBytesAfter: 0,
  });
}

function generateResponsiveImageVariants(sourceFile, targetDir, targetRelPath) {
  const sourceExt = path.extname(sourceFile).toLowerCase();
  if (!responsiveImageExtensions.has(sourceExt)) return [];

  const parsedTarget = path.posix.parse(targetRelPath);
  const relativeDir = buildResponsiveRelativeDir(targetRelPath);
  const outputDir = path.join(targetDir, parsedTarget.dir, "_responsive");
  const outputPrefix = parsedTarget.name;
  const out = execFileSync("python3", [
    path.join(root, "scripts", "render-responsive-image.py"),
    "--input", sourceFile,
    "--output-dir", outputDir,
    "--output-prefix", outputPrefix,
    "--relative-dir", relativeDir,
    "--widths", responsiveImageWidths.join(","),
  ], { encoding: "utf8" }).trim();

  if (!out) return [];
  return JSON.parse(out);
}

function renderOptimizedVideoAsset(sourceFile, targetFile, posterFile) {
  const out = execFileSync("python3", [
    path.join(root, "scripts", "render-web-video.py"),
    "--input", sourceFile,
    "--video-output", targetFile,
    "--poster-output", posterFile,
    "--video-max-edge", String(videoMaxEdge),
    "--poster-max-edge", String(posterMaxEdge),
    "--crf", String(videoCrf),
    "--preset", videoPreset,
    "--audio-bitrate", videoAudioBitrate,
  ], { encoding: "utf8" }).trim();

  return out ? JSON.parse(out) : {};
}

async function copyProjectAssets(slug, sourceDir = path.join(contentProjectsRoot, slug)) {
  const targetDir = path.join(projectsRoot, slug);
  const fileNameMap = new Map();
  const responsiveSourcesByTarget = new Map();
  const posterSourcesByTarget = new Map();
  const reportItems = [];

  try {
    const sourceFiles = await walkFiles(sourceDir);
    const mediaFiles = sourceFiles
      .filter((filePath) => mediaExtensions.has(path.extname(filePath).toLowerCase()))
      .filter((filePath) => !isGeneratedPosterFileName(path.basename(filePath)))
      .sort((a, b) => a.localeCompare(b));

    const records = await Promise.all(mediaFiles.map(async (sourceFile) => {
      const sourceRelPath = path.relative(sourceDir, sourceFile);
      const parsed = path.parse(sourceRelPath);
      const sourceExt = parsed.ext.toLowerCase();
      const sourceStats = await stat(sourceFile);
      return {
        sourceFile,
        sourceRelPath,
        sourceExt,
        sourceDir: parsed.dir,
        sourceBaseName: parsed.name,
        sourceFileName: path.basename(sourceFile),
        mediaType: extensionToType(sourceExt),
        action: videoExtensions.has(sourceExt) ? "optimize-video" : "copy",
        targetRelPath: null,
        posterRelPath: null,
        aliasTargetRecord: null,
        sourceSizeBytes: sourceStats.size,
      };
    }));

    const siblingMp4Map = new Map();
    for (const record of records) {
      if (record.sourceExt === ".mp4") {
        siblingMp4Map.set(`${record.sourceDir.toLowerCase()}::${record.sourceBaseName.toLowerCase()}`, record);
      }
    }

    for (const record of records) {
      if (record.sourceExt !== ".mov") continue;
      const siblingMp4 = siblingMp4Map.get(`${record.sourceDir.toLowerCase()}::${record.sourceBaseName.toLowerCase()}`);
      if (!siblingMp4) continue;
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
    }

    const usedPaths = new Set();
    await rm(targetDir, { recursive: true, force: true });

    for (const record of records) {
      if (record.action === "skip-duplicate-mov") continue;
      const extOverride = record.action === "optimize-video" ? ".mp4" : undefined;
      record.targetRelPath = buildUniqueNormalizedRelativePath(record.sourceRelPath, usedPaths, extOverride);
      if (record.action === "optimize-video") {
        record.posterRelPath = buildPosterRelativePath(record.targetRelPath, usedPaths);
      }
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

      if (record.action === "optimize-video") {
        try {
          if (!record.posterRelPath) {
            throw new Error(`Missing poster path for ${record.sourceRelPath}`);
          }
          const posterFile = path.join(targetDir, record.posterRelPath);
          await mkdir(path.dirname(posterFile), { recursive: true });
          const renderResult = renderOptimizedVideoAsset(record.sourceFile, targetFile, posterFile);
          const savedBytes = record.sourceSizeBytes - (renderResult.videoSizeBytes ?? 0);
          reportItems.push({
            projectId: slug,
            source: record.sourceRelPath.split(path.sep).join("/"),
            target: record.targetRelPath,
            action: "optimize-video",
            status: "success",
            detail: `Generated optimized H.264/AAC MP4 delivery copy with +faststart and preserved aspect ratio${renderResult.width && renderResult.height ? ` at ${renderResult.width}x${renderResult.height}` : ""}.`,
            sourceSizeBytes: record.sourceSizeBytes,
            targetSizeBytes: renderResult.videoSizeBytes ?? null,
            savedBytes,
            savedPercent: computeSavedPercent(record.sourceSizeBytes, renderResult.videoSizeBytes ?? null),
          });
          reportItems.push({
            projectId: slug,
            source: record.sourceRelPath.split(path.sep).join("/"),
            target: record.posterRelPath,
            action: "generate-video-poster",
            status: "success",
            detail: "Generated poster image for faster first paint before playback.",
            targetSizeBytes: renderResult.posterSizeBytes ?? null,
          });
          posterSourcesByTarget.set(record.targetRelPath, record.posterRelPath);
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
            action: "optimize-video",
            status: "failure",
            detail: `Video optimization failed; kept normalized original as fallback. ${error instanceof Error ? error.message : String(error)}`,
            sourceSizeBytes: record.sourceSizeBytes,
            targetSizeBytes: record.sourceSizeBytes,
            savedBytes: 0,
            savedPercent: 0,
          });
        }
      } else {
        await copyFile(record.sourceFile, targetFile);
        reportItems.push({
          projectId: slug,
          source: record.sourceRelPath.split(path.sep).join("/"),
          target: record.targetRelPath,
          action: "copy",
          status: "success",
          detail: "Copied without recompression or visual changes.",
          sourceSizeBytes: record.sourceSizeBytes,
          targetSizeBytes: record.sourceSizeBytes,
        });
      }

      fileNameMap.set(sourceKeyName, path.posix.basename(record.targetRelPath));

      if (record.mediaType !== "image") {
        continue;
      }

      try {
        const responsiveSources = generateResponsiveImageVariants(record.sourceFile, targetDir, record.targetRelPath);
        if (responsiveSources.length > 0) {
          responsiveSourcesByTarget.set(record.targetRelPath, responsiveSources);
          reportItems.push({
            projectId: slug,
            source: record.sourceRelPath.split(path.sep).join("/"),
            target: buildResponsiveRelativeDir(record.targetRelPath),
            action: "responsive-images",
            status: "success",
            detail: `Generated ${responsiveSources.length} responsive image variants without changing aspect ratio.`,
          });
        }
      } catch (error) {
        reportItems.push({
          projectId: slug,
          source: record.sourceRelPath.split(path.sep).join("/"),
          target: record.targetRelPath,
          action: "responsive-images",
          status: "failure",
          detail: `Responsive image generation failed. ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    }

    return {
      ok: true,
      fileNameMap,
      responsiveSourcesByTarget,
      posterSourcesByTarget,
      reportItems,
      summary: summarizeProjectReport(slug, reportItems),
    };
  } catch (error) {
    reportItems.push({
      projectId: slug,
      source: slug,
      target: slug,
      action: "copy",
      status: "failure",
      detail: error instanceof Error ? error.message : String(error),
    });
    return {
      ok: false,
      fileNameMap,
      responsiveSourcesByTarget,
      posterSourcesByTarget,
      reportItems,
      summary: summarizeProjectReport(slug, reportItems),
    };
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
  const rows = parseCsv(csvRaw).map((row) => ({ ...row, _sourceRoot: contentProjectsRoot }));
  if (rows.length === 0) {
    throw new Error(`CSV has no project rows: ${projectsCsvPath}`);
  }

  const dropInCsvRaw = await safeReadText(dropInCsvPath);
  if (dropInCsvRaw) {
    const dropInRows = parseCsv(dropInCsvRaw).map((row) => ({
      ...row,
      _sourceRoot: dropInRoot,
      _folder: row.folder || row.slug,
    }));
    rows.push(...dropInRows);
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

    const folder = row._folder || slug;
    const sourceDir = path.join(row._sourceRoot || contentProjectsRoot, folder);
    const copyResult = await copyProjectAssets(slug, sourceDir);
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

    media = media.map((item) => {
      const responsiveSources = copyResult.responsiveSourcesByTarget.get(item.src) ?? [];
      const posterSrc = copyResult.posterSourcesByTarget.get(item.src);
      return {
        ...item,
        ...(responsiveSources.length > 0 ? { responsiveSources } : {}),
        ...(posterSrc ? { posterSrc } : {}),
      };
    });

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

  const totalVideoBytesBefore = normalizationProjects.reduce((sum, project) => sum + (project.summary.videoBytesBefore ?? 0), 0);
  const totalVideoBytesAfter = normalizationProjects.reduce((sum, project) => sum + (project.summary.videoBytesAfter ?? 0), 0);
  const totalVideoSavedBytes = totalVideoBytesBefore - totalVideoBytesAfter;

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
    videoBytesBefore: totalVideoBytesBefore,
    videoBytesAfter: totalVideoBytesAfter,
    videoSavedBytes: totalVideoSavedBytes,
    videoSavedPercent: computeSavedPercent(totalVideoBytesBefore, totalVideoBytesAfter),
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
