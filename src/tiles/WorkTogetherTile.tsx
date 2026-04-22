import type { ContactSlideContent, SiteInfo } from "../types/content";
import type { TileId } from "../canvas/tileRegistry";
import { HomeNavButton } from "../components/HomeNavButton";
import { SlideShell } from "../components/SlideShell";

type WorkTogetherTileProps = {
  content: ContactSlideContent;
  siteInfo: SiteInfo;
  goToTile: (id: TileId) => void;
};

export function WorkTogetherTile({ content, siteInfo, goToTile }: WorkTogetherTileProps) {
  return (
    <SlideShell headerStart={<HomeNavButton goToTile={goToTile} />}>
      <div className="contact-layout">
        <h2>Let&apos;s work together</h2>
        <div className="contact-bottom-left">
          <a href={`mailto:${siteInfo.contact.email}`}>{siteInfo.contact.email}</a>
          <a href={`https://instagram.com/${siteInfo.contact.instagram}`} target="_blank" rel="noreferrer">
            instagram.com/{siteInfo.contact.instagram}
          </a>
        </div>
        <button className="avatar-placeholder contact-avatar" onClick={() => goToTile("landing")} aria-label="Home" />
        <div className="contact-bottom-right">
          <div>
            <span>{content.labels.instagram}</span>
            <a href={`https://instagram.com/${siteInfo.contact.instagram}`} target="_blank" rel="noreferrer">
              @{siteInfo.contact.instagram}
            </a>
          </div>
          <div>
            <span>{content.labels.email}</span>
            <a href={`mailto:${siteInfo.contact.email}`}>{siteInfo.contact.email}</a>
          </div>
          <div>
            <span>{content.labels.recognition}</span>
            <button className="text-link" onClick={() => goToTile("recognition")}>
              {content.actions.recognition}
            </button>
          </div>
        </div>
      </div>
    </SlideShell>
  );
}
