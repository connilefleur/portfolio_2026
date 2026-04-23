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

function normalizeAssetSegment(value) {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "asset";
}

function buildUniqueNormalizedRelativePath(sourceRelPath, usedPaths) {
  const posixRelPath = sourceRelPath.split(path.sep).join(path.posix.sep);
  const parsed = path.posix.parse(posixRelPath);
  const dirSegments = parsed.dir
    ? parsed.dir.split("/").filter(Boolean).map((segment) => normalizeAssetSegment(segment))
    : [];
  const ext = parsed.ext.toLowerCase();
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

async function copyProjectAssets(slug) {
  const sourceDir = path.join(contentProjectsRoot, slug);
  const targetDir = path.join(projectsRoot, slug);
  const fileNameMap = new Map();

  try {
    const sourceFiles = await walkFiles(sourceDir);
    const mediaFiles = sourceFiles
      .filter((filePath) => mediaExtensions.has(path.extname(filePath).toLowerCase()))
      .filter((filePath) => !isGeneratedPosterFileName(path.basename(filePath)))
      .sort((a, b) => a.localeCompare(b));

    const usedPaths = new Set();
    await rm(targetDir, { recursive: true, force: true });

    for (const sourceFile of mediaFiles) {
      const sourceRelPath = path.relative(sourceDir, sourceFile);
      const normalizedRelPath = buildUniqueNormalizedRelativePath(sourceRelPath, usedPaths);
      const targetFile = path.join(targetDir, normalizedRelPath);
      await mkdir(path.dirname(targetFile), { recursive: true });
      await copyFile(sourceFile, targetFile);

      const sourceFileName = path.basename(sourceFile);
      const normalizedFileName = path.posix.basename(normalizedRelPath);
      if (!fileNameMap.has(sourceFileName)) {
        fileNameMap.set(sourceFileName, normalizedFileName);
      }
    }

    return { ok: true, fileNameMap };
  } catch {
    return { ok: false, fileNameMap };
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

  await writeFile(outputPath, JSON.stringify(payload, null, 2), "utf8");
  console.log(`Generated ${projects.length} project entries to public/projects-index.json`);
}

buildIndex().catch((error) => {
  console.error("Failed to generate projects index:", error);
  process.exit(1);
});
