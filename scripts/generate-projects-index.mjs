import { copyFile, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
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

async function discoverMedia(projectFolderPath) {
  const files = await walkFiles(projectFolderPath);
  return files
    .filter((filePath) => mediaExtensions.has(path.extname(filePath).toLowerCase()))
    .sort((a, b) => a.localeCompare(b))
    .map((filePath, index) => {
      const relPath = path.relative(projectFolderPath, filePath).split(path.sep).join("/");
      const ext = path.extname(filePath).toLowerCase();
      return {
        id: `${path.parse(relPath).name}-${index}`,
        type: extensionToType(ext),
        src: relPath,
        description: ""
      };
    });
}

async function copyProjectAssets(slug) {
  const sourceDir = path.join(contentProjectsRoot, slug);
  const targetDir = path.join(projectsRoot, slug);
  try {
    const sourceFiles = await walkFiles(sourceDir);
    const mediaFiles = sourceFiles.filter((filePath) => mediaExtensions.has(path.extname(filePath).toLowerCase()));
    for (const sourceFile of mediaFiles) {
      const relPath = path.relative(sourceDir, sourceFile);
      const targetFile = path.join(targetDir, relPath);
      await mkdir(path.dirname(targetFile), { recursive: true });
      await copyFile(sourceFile, targetFile);
    }
    return true;
  } catch {
    return false;
  }
}

function parseTags(rawTags) {
  if (!rawTags) return [];
  return rawTags
    .split("|")
    .map((tag) => tag.trim())
    .filter(Boolean);
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
    const slug = row.slug;
    if (!slug) {
      throw new Error("CSV row is missing required field: slug");
    }

    await copyProjectAssets(slug);
    const contentMediaPath = path.join(contentProjectsRoot, slug);
    const publicMediaPath = path.join(projectsRoot, slug);

    let media = await discoverMedia(contentMediaPath).catch(() => []);
    if (media.length === 0) {
      media = await discoverMedia(publicMediaPath).catch(() => []);
    }

    const parsedYear = row.year ? Number.parseInt(row.year, 10) : NaN;
    projects.push({
      id: row.id || slug,
      slug,
      title: row.title || titleFromSlug(slug),
      category: row.category || "experimental",
      description: row.description || "Project details will be updated soon.",
      year: Number.isFinite(parsedYear) ? parsedYear : null,
      client: row.client || "Independent",
      tags: parseTags(row.tags),
      approach: row.approach || row.description || "Project details will be updated soon.",
      outcomes: row.outcomes || row.description || "Project details will be updated soon.",
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
