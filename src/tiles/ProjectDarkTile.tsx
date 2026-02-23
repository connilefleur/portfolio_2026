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
    approach: "Project details will be added soon.",
    outcomes: "Project details will be added soon.",
    media: [],
    path: ""
  };
}

export function ProjectDarkTile({ project, projects, goToTile }: ProjectDarkTileProps) {
  const displayProject = project ?? (projects.length > 0 ? projects[0] : fallbackProject());
  const description = displayProject.description || "Project details will be added soon.";
  void goToTile;

  return (
    <TileFrame>
      <header className="tile-header tiny">
        <span>CONRAD LOEFFLER</span>
        <span>PORTFOLIO 2026</span>
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
            <p>{displayProject.approach || description}</p>
          </div>
          <div>
            <h4>Outcomes</h4>
            <p>{displayProject.outcomes || description}</p>
          </div>
        </div>
      </div>
    </TileFrame>
  );
}
