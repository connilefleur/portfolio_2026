import siteInfoJson from "../../content/site-info.json";
import type { ProjectItem, SiteInfo } from "../types/content";

export const siteInfo: SiteInfo = siteInfoJson;

export async function loadProjectsIndex(): Promise<ProjectItem[]> {
  const response = await fetch("/projects-index.json", { cache: "no-store" });
  if (!response.ok) return [];
  const payload = (await response.json()) as { projects?: ProjectItem[] };
  const projects = payload.projects ?? [];
  return projects.filter((p) => p.slug !== "example-project");
}
