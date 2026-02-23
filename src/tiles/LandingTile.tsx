import type { ProjectItem, SiteInfo } from "../types/content";
import type { TileId } from "../canvas/tileRegistry";
import { TileFrame } from "./TileFrame";

type LandingTileProps = {
  projects: ProjectItem[];
  siteInfo: SiteInfo;
  goToTile: (id: TileId) => void;
  introPhase: "active" | "exiting" | "done";
};

function deriveIndex(label: string) {
  const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let acc = label.length;
  for (let i = 0; i < label.length; i++) {
    acc = (acc * 37 + label.charCodeAt(i)) >>> 0;
  }
  let result = "";
  while (result.length < 4) {
    result += alphabet[acc % alphabet.length];
    acc = Math.floor(acc / alphabet.length) + 3;
  }
  return result;
}

function getLinks(projects: ProjectItem[]): Array<{ label: string; index: string; target: TileId }> {
  const projectLinks = projects.slice(0, 3).map((p, i) => {
    const label = `Project ${i + 1}`;
    return {
      label,
      index: deriveIndex(label),
      target: `project-${p.slug}` as TileId
    };
  });
  return [
    ...projectLinks,
    { label: "Contact", index: deriveIndex("Contact"), target: "work-together" },
    { label: "Recognition", index: deriveIndex("Recognition"), target: "recognition" },
    { label: "Imprint", index: deriveIndex("Imprint"), target: "imprint" }
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
              <button className="landing-index-link" onClick={() => goToTile(link.target)}>
                {link.index}
              </button>
            </div>
          ))}
        </nav>
      </div>
    </TileFrame>
  );
}
