import siteInfoJson from "../../content/site-info.json";
import slideContentJson from "../../content/slide-content.json";
import type { ProjectItem, SiteInfo, SlideContent } from "../types/content";

export const siteInfo: SiteInfo = siteInfoJson;
export const slideContent: SlideContent = slideContentJson as SlideContent;

function isGeneratedPosterFileName(fileName: string) {
  return /\.poster\.(jpg|jpeg|png|webp)$/i.test(fileName);
}

function getMediaFileName(src: string) {
  return src.split("/").pop() ?? src;
}

function preferWebVideoTwin(fileName: string, availableNames: Set<string>) {
  if (!/\.mov$/i.test(fileName)) return fileName;
  const mp4Twin = fileName.replace(/\.mov$/i, ".mp4");
  return availableNames.has(mp4Twin) ? mp4Twin : fileName;
}

function normalizeProject(project: ProjectItem): ProjectItem {
  const media = project.media.filter((item) => !isGeneratedPosterFileName(getMediaFileName(item.src)));
  const availableNames = new Set(media.map((item) => getMediaFileName(item.src)));
  const viewerMedia = (project.detail.media.viewerMedia ?? [])
    .filter((name) => !isGeneratedPosterFileName(name))
    .map((name) => preferWebVideoTwin(name, availableNames))
    .filter((name, index, all) => all.indexOf(name) === index)
    .filter((name) => availableNames.has(name));
  const fallbackViewerMedia = viewerMedia.length > 0 ? viewerMedia : media.map((item) => getMediaFileName(item.src));
  const preferredHeroPrimary = project.detail.media.heroPrimary
    ? preferWebVideoTwin(project.detail.media.heroPrimary, availableNames)
    : "";
  const preferredHeroSecondary = project.detail.media.heroSecondary
    ? preferWebVideoTwin(project.detail.media.heroSecondary, availableNames)
    : "";
  const heroPrimary =
    preferredHeroPrimary &&
    !isGeneratedPosterFileName(preferredHeroPrimary) &&
    availableNames.has(preferredHeroPrimary)
      ? preferredHeroPrimary
      : fallbackViewerMedia[0] ?? "";
  const heroSecondary =
    preferredHeroSecondary &&
    !isGeneratedPosterFileName(preferredHeroSecondary) &&
    preferredHeroSecondary !== heroPrimary &&
    availableNames.has(preferredHeroSecondary)
      ? preferredHeroSecondary
      : fallbackViewerMedia.find((name) => name !== heroPrimary) ?? fallbackViewerMedia[1] ?? "";

  return {
    ...project,
    media,
    detail: {
      ...project.detail,
      media: {
        ...project.detail.media,
        heroPrimary,
        heroSecondary,
        viewerMedia: fallbackViewerMedia,
      },
    },
  };
}

function sortProjects(projects: ProjectItem[]) {
  return [...projects].sort((a, b) => {
    if (a.slug === "experiments" && b.slug !== "experiments") return 1;
    if (b.slug === "experiments" && a.slug !== "experiments") return -1;
    return 0;
  });
}

export async function loadProjectsIndex(): Promise<ProjectItem[]> {
  const response = await fetch("/projects-index.json", { cache: "no-store" });
  if (!response.ok) return [];
  const payload = (await response.json()) as { projects?: ProjectItem[] };
  const projects = payload.projects ?? [];
  return sortProjects(projects.filter((p) => p.slug !== "example-project").map(normalizeProject));
}
