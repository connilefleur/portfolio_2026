import type { TileId } from "../canvas/tileRegistry";
import { TileFrame } from "./TileFrame";

type RecognitionItem = {
  id: string;
  title: string;
  year: number;
  publication: string;
  description: string;
};

type MoreWorkTileProps = {
  goToTile: (id: TileId) => void;
};

const dummyRecognitions: RecognitionItem[] = [
  { id: "1", title: "Best Digital Design Award", year: 2025, publication: "Design Week", description: "Outstanding achievement in digital interface design." },
  { id: "2", title: "Featured Artist", year: 2024, publication: "Creative Review", description: "Spotlight on innovative portfolio presentation." },
  { id: "3", title: "Excellence in Web Design", year: 2024, publication: "Awwwards", description: "Recognition for exceptional user experience." },
  { id: "4", title: "Top Portfolio Site", year: 2023, publication: "CSS Design Awards", description: "Awarded for creative and technical excellence." },
  { id: "5", title: "Innovation in Interaction", year: 2023, publication: "FWA", description: "Pioneering approach to portfolio navigation." },
  { id: "6", title: "Editor's Choice", year: 2022, publication: "Behance", description: "Featured project in digital design category." },
  { id: "7", title: "Best Portfolio Design", year: 2022, publication: "SiteInspire", description: "Recognition for minimalist aesthetic." },
  { id: "8", title: "Creative Excellence Award", year: 2021, publication: "Dribbble", description: "Outstanding contribution to design community." },
  { id: "9", title: "Featured Publication", year: 2021, publication: "It's Nice That", description: "Interview and portfolio showcase." },
  { id: "10", title: "Design of the Day", year: 2020, publication: "Designspiration", description: "Daily feature for exceptional design work." }
];

export function MoreWorkTile({ goToTile }: MoreWorkTileProps) {
  return (
    <TileFrame>
      <header className="tile-header tiny">
        <button className="text-link tiny" data-nav-anchor="true" onClick={() => goToTile("landing")}>
          BACK
        </button>
      </header>
      <h2 className="tile-title">Recognition</h2>
      <div className="work-table">
        <div className="work-head">
          <span>Award</span>
          <span>Year</span>
          <span>Publication</span>
          <span>Description</span>
          <span className="align-right">Link</span>
        </div>
        <div className="work-body">
          {dummyRecognitions.map((recognition) => (
            <div key={recognition.id} className="work-row">
              <span>{recognition.title}</span>
              <span>{recognition.year}</span>
              <span>{recognition.publication}</span>
              <span>{recognition.description}</span>
              <button className="text-link align-right" onClick={() => goToTile("about-me")}>
                VIEW
              </button>
            </div>
          ))}
        </div>
      </div>
    </TileFrame>
  );
}
