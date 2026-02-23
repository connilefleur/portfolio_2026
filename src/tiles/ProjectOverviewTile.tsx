import type { ProjectItem } from "../types/content";
import type { TileId } from "../canvas/tileRegistry";
import { TileFrame } from "./TileFrame";

type ProjectOverviewTileProps = {
  projects: ProjectItem[];
  goToTile: (id: TileId) => void;
};

export function ProjectOverviewTile({ projects, goToTile }: ProjectOverviewTileProps) {
  const cards = projects.length > 0 ? projects.slice(0, 4) : Array.from({ length: 4 }, (_, i) => ({ id: `${i}` }));

  return (
    <TileFrame>
      <header className="tile-header tiny">
        <button className="text-link tiny" data-nav-anchor="true" onClick={() => goToTile("landing")}>
          BACK
        </button>
      </header>
      <div className="overview-grid">
        {cards.map((project, index) => (
          <article key={project.id} className="overview-item">
            <h3>{(project as ProjectItem).title ?? `Project ${index + 1}`}</h3>
            <ul>
              <li>Logotype</li>
              <li>Strategy</li>
              <li>Packaging</li>
              <li>Product design</li>
              <li>Web design</li>
              <li>Photography</li>
            </ul>
            <button
              className="overview-image"
              onClick={() =>
                goToTile(
                  "slug" in project && project.slug
                    ? (`project-${project.slug}` as import("../canvas/tileRegistry").TileId)
                    : "landing"
                )
              }
            />
          </article>
        ))}
      </div>
    </TileFrame>
  );
}
