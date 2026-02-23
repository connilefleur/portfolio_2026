import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
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

async function safeReadJson(filePath) {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function discoverMedia(projectFolderPath) {
  const entries = await readdir(projectFolderPath, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && mediaExtensions.has(path.extname(entry.name).toLowerCase()))
    .map((entry, index) => {
      const ext = path.extname(entry.name).toLowerCase();
      return {
        id: `${path.parse(entry.name).name}-${index}`,
        type: extensionToType(ext),
        src: entry.name,
        description: ""
      };
    });
}

async function buildIndex() {
  const entries = await readdir(projectsRoot, { withFileTypes: true });
  const folders = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);

  const projects = [];
  for (const slug of folders) {
    const folderPath = path.join(projectsRoot, slug);
    const metaPath = path.join(folderPath, "meta.json");
    const meta = await safeReadJson(metaPath);
    const media = await discoverMedia(folderPath);

    projects.push({
      id: meta?.id ?? slug,
      slug,
      title: meta?.title ?? titleFromSlug(slug),
      category: meta?.category ?? "experimental",
      description: meta?.description ?? "Project details will be updated soon.",
      year: typeof meta?.year === "number" ? meta.year : null,
      client: meta?.client ?? "Independent",
      tags: Array.isArray(meta?.tags) ? meta.tags : [],
      media: Array.isArray(meta?.media) && meta.media.length > 0 ? meta.media : media,
      path: `/projects/${slug}`
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
