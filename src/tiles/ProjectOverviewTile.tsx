import type { ProjectItem, SlideContent } from "../types/content";
import type { TileId } from "../canvas/tileRegistry";
import { HomeNavButton } from "../components/HomeNavButton";
import { SlideShell } from "../components/SlideShell";

type ProjectOverviewTileProps = {
  content: SlideContent["overview"];
  projects: ProjectItem[];
  goToTile: (id: TileId) => void;
};

export function ProjectOverviewTile({ content, projects, goToTile }: ProjectOverviewTileProps) {
  const cards = content.cards.length > 0 ? content.cards : Array.from({ length: 4 }, (_, i) => ({ id: `${i}`, title: undefined, projectSlug: undefined, services: [] }));

  return (
    <SlideShell headerStart={<HomeNavButton goToTile={goToTile} />}>
      <div className="overview-grid">
        {cards.map((card, index) => {
          const resolvedProject = card.projectSlug
            ? projects.find((project) => project.slug === card.projectSlug)
            : projects[index];
          const targetTile = resolvedProject ? (`project-${resolvedProject.slug}` as import("../canvas/tileRegistry").TileId) : "landing";
          return (
            <article key={card.id} className="overview-item">
              <h3>{card.title ?? resolvedProject?.title ?? `Project ${index + 1}`}</h3>
              <ul>
                {card.services.map((service) => (
                  <li key={service}>{service}</li>
                ))}
              </ul>
              <button className="overview-image" onClick={() => goToTile(targetTile)} />
            </article>
          );
        })}
      </div>
    </SlideShell>
  );
}
