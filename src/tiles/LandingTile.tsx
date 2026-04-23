import type { ProjectItem, SiteInfo } from "../types/content";
import type { TileId } from "../canvas/tileRegistry";
import { TileFrame } from "./TileFrame";

type LandingTileProps = {
  projects: ProjectItem[];
  siteInfo: SiteInfo;
  goToTile: (id: TileId) => void;
  introPhase: "active" | "exiting" | "done";
};

function getLinks(projects: ProjectItem[]): Array<{ label: string; index?: string; target: TileId }> {
  const projectLinks = projects.slice(0, 3).map((project, i) => {
    const label = `Project ${i + 1}`;
    return {
      label,
      index: project.title,
      target: `project-${project.slug}` as TileId
    };
  });
  return [
    ...projectLinks,
    { label: "List", target: "recognition" },
    { label: "Contact", target: "work-together" },
    { label: "Imprint", target: "imprint" }
  ];
}

export function LandingTile({ projects, siteInfo, goToTile, introPhase }: LandingTileProps) {
  const links = getLinks(projects);
  const isIntroVisible = introPhase !== "done";

  return (
    <TileFrame className={isIntroVisible ? "landing-intro-frame" : undefined} introPhase={introPhase}>
      <div className="landing-content">
        <header className="tile-header tiny">
          <span className="landing-brand">{siteInfo.brand.name.toUpperCase()}</span>
          <span>{`${siteInfo.meta.title} 2026`.toUpperCase()}</span>
        </header>
        <nav className="landing-grid" aria-label="Primary portfolio navigation">
          {links.map((link) => (
            <div key={`${link.target}-${link.label}`} className="landing-row">
              <button className="landing-link" onClick={() => goToTile(link.target)}>
                {link.label}
              </button>
              {link.index ? (
                <button className="landing-index-link" onClick={() => goToTile(link.target)}>
                  {link.index}
                </button>
              ) : null}
            </div>
          ))}
        </nav>
      </div>
    </TileFrame>
  );
}
