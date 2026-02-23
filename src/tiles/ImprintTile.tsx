import type { SiteInfo } from "../types/content";
import type { TileId } from "../canvas/tileRegistry";
import { TileFrame } from "./TileFrame";

type ImprintTileProps = {
  siteInfo: SiteInfo;
  goToTile: (id: TileId) => void;
};

export function ImprintTile({ siteInfo, goToTile }: ImprintTileProps) {
  void goToTile;
  const imprint = siteInfo.imprint;
  return (
    <TileFrame>
      <header className="tile-header tiny">
        <span>CONRAD LOEFFLER</span>
        <span>PORTFOLIO 2026</span>
      </header>
      <div className="project-detail">
        <div className="detail-top">
          <div>
            <h2>Imprint</h2>
            <p>{imprint.name}</p>
          </div>
          <p className="detail-description">{imprint.liability}</p>
        </div>
        <div className="detail-meta">
          <div>
            <span>Address</span>
            <strong>{imprint.address}</strong>
          </div>
          <div>
            <span>Email</span>
            <strong>{imprint.email}</strong>
          </div>
          <div>
            <span>Last Updated</span>
            <strong>{imprint.lastUpdated}</strong>
          </div>
        </div>
        <div className="detail-grid">
          <div className="mock-media" />
          <div className="mock-media" />
          <div>
            <h4>Liability</h4>
            <p>{imprint.liability}</p>
          </div>
          <div>
            <h4>Copyright</h4>
            <p>{imprint.copyright}</p>
          </div>
        </div>
      </div>
    </TileFrame>
  );
}
