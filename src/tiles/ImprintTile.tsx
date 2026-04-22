import type { SiteInfo } from "../types/content";
import type { TileId } from "../canvas/tileRegistry";
import { HomeNavButton } from "../components/HomeNavButton";
import { DetailPanel } from "../components/DetailPanel";
import { DetailSlide } from "../components/DetailSlide";

type ImprintTileProps = {
  siteInfo: SiteInfo;
  goToTile: (id: TileId) => void;
};

export function ImprintTile({ siteInfo, goToTile }: ImprintTileProps) {
  const imprint = siteInfo.imprint;
  return (
    <DetailSlide
      headerStart={<HomeNavButton goToTile={goToTile} />}
      headerEnd={<span>PORTFOLIO 2026</span>}
      titleBlock={
        <>
          <h2>Imprint</h2>
          <p>{imprint.name}</p>
        </>
      }
      description={imprint.liability}
      metaItems={[
        { label: "Address", value: imprint.address },
        { label: "Email", value: imprint.email },
        { label: "Last Updated", value: imprint.lastUpdated },
      ]}
    >
      <DetailPanel media />
      <DetailPanel media />
      <DetailPanel heading="Liability">{imprint.liability}</DetailPanel>
      <DetailPanel heading="Copyright">{imprint.copyright}</DetailPanel>
    </DetailSlide>
  );
}
