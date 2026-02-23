import type { SiteInfo } from "../types/content";
import type { TileId } from "../canvas/tileRegistry";
import { TileFrame } from "./TileFrame";

type WorkTogetherTileProps = {
  siteInfo: SiteInfo;
  goToTile: (id: TileId) => void;
};

export function WorkTogetherTile({ siteInfo, goToTile }: WorkTogetherTileProps) {
  return (
    <TileFrame>
      <header className="tile-header tiny">
        <span>CONRAD LOEFFLER</span>
        <span>PORTFOLIO 2026</span>
      </header>
      <button className="avatar-placeholder contact-avatar" onClick={() => goToTile("landing")} aria-label="Back home" />
      <div className="contact-layout">
        <h2>Let&apos;s work together</h2>
        <div className="contact-bottom-left">
          <a href={`mailto:${siteInfo.contact.email}`}>{siteInfo.contact.email}</a>
          <a href={`https://instagram.com/${siteInfo.contact.instagram}`} target="_blank" rel="noreferrer">
            instagram.com/{siteInfo.contact.instagram}
          </a>
        </div>
        <div className="contact-bottom-right">
          <div>
            <span>Instagram</span>
            <a href={`https://instagram.com/${siteInfo.contact.instagram}`} target="_blank" rel="noreferrer">
              @{siteInfo.contact.instagram}
            </a>
          </div>
          <div>
            <span>Email</span>
            <a href={`mailto:${siteInfo.contact.email}`}>{siteInfo.contact.email}</a>
          </div>
          <div>
            <span>Recognition</span>
            <button className="text-link" onClick={() => goToTile("recognition")}>
              VIEW DETAILS
            </button>
          </div>
        </div>
      </div>
    </TileFrame>
  );
}
