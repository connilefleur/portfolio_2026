import type { TileId } from "../canvas/tileRegistry";
import { HomeNavButton } from "../components/HomeNavButton";
import { SlideShell } from "../components/SlideShell";
import type { SlideContent } from "../types/content";

type MoreWorkTileProps = {
  content: SlideContent["recognition"];
  goToTile: (id: TileId) => void;
};

export function MoreWorkTile({ content, goToTile }: MoreWorkTileProps) {
  return (
    <SlideShell headerStart={<HomeNavButton goToTile={goToTile} />}>
      <h2 className="tile-title">{content.title}</h2>
      <div className="work-table">
        <div className="work-head">
          <span>{content.columns[0]}</span>
          <span>{content.columns[1]}</span>
          <span>{content.columns[2]}</span>
          <span>{content.columns[3]}</span>
          <span className="align-right">{content.columns[4]}</span>
        </div>
        <div className="work-body">
          {content.items.map((recognition) => (
            <div key={recognition.id} className="work-row">
              <span>{recognition.title}</span>
              <span>{recognition.year}</span>
              <span>{recognition.publication}</span>
              <span>{recognition.description}</span>
              <button className="text-link align-right" onClick={() => goToTile(recognition.targetSlide as TileId)}>
                {recognition.actionLabel}
              </button>
            </div>
          ))}
        </div>
      </div>
    </SlideShell>
  );
}
