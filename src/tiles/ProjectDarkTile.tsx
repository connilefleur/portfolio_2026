import type { TileId } from "../canvas/tileRegistry";
import type { ProjectItem } from "../types/content";
import { TileFrame } from "./TileFrame";

type ProjectDarkTileProps = {
  project: ProjectItem | undefined;
  projects: ProjectItem[];
  goToTile: (id: TileId) => void;
};

function fallbackProject(): ProjectItem {
  return {
    id: "fallback-0",
    slug: "",
    title: "Project",
    category: "Graphic Design",
    description: "Project details will be added soon.",
    year: 2025,
    client: "Client",
    tags: [],
    media: [],
    path: ""
  };
}

export function ProjectDarkTile({ project, projects, goToTile }: ProjectDarkTileProps) {
  const displayProject = project ?? (projects.length > 0 ? projects[0] : fallbackProject());
  const description = displayProject.description || "Project details will be added soon.";
  const projectIndex = projects.findIndex((p) => p.slug === displayProject.slug);
  const previousProject = projectIndex > 0 ? projects[projectIndex - 1] : null;
  const nextProject = projectIndex >= 0 && projectIndex < projects.length - 1 ? projects[projectIndex + 1] : null;

  return (
    <TileFrame>
      <header className="tile-header tiny">
        <button
          className="text-link tiny"
          data-nav-anchor="true"
          onClick={() => (previousProject ? goToTile(`project-${previousProject.slug}` as TileId) : goToTile("landing"))}
        >
          {previousProject ? "PREVIOUS" : "HOME"}
        </button>
        <button
          className="text-link tiny"
          data-nav-anchor="true"
          onClick={() => (nextProject ? goToTile(`project-${nextProject.slug}` as TileId) : goToTile("landing"))}
        >
          {nextProject ? "NEXT" : "HOME"}
        </button>
      </header>
      <div className="project-detail">
        <div className="detail-top">
          <div>
            <h2>{displayProject.title}</h2>
            <p>{displayProject.client || "Client"}</p>
          </div>
          <p className="detail-description">{description}</p>
        </div>
        <div className="detail-meta">
          <div>
            <span>Year</span>
            <strong>{displayProject.year ?? "----"}</strong>
          </div>
          <div>
            <span>Category</span>
            <strong>{displayProject.category}</strong>
          </div>
          <div>
            <span>Tags</span>
            <strong>{displayProject.tags.slice(0, 2).join(", ") || "Portfolio"}</strong>
          </div>
        </div>
        <div className="detail-grid">
          <div className="mock-media" />
          <div className="mock-media" />
          <div>
            <h4>Approach</h4>
            <p>{description}</p>
          </div>
          <div>
            <h4>Outcomes</h4>
            <p>{description}</p>
          </div>
        </div>
      </div>
    </TileFrame>
  );
}
