import { type ReactNode, useMemo } from "react";
import {
  type TileConfig,
  type TileId,
  getTileById,
} from "./tileRegistry";

type CanvasEngineProps = {
  activeTileId: TileId;
  tileRegistry: TileConfig[];
  renderTile: (tile: TileConfig) => ReactNode;
  introPhase?: "active" | "exiting" | "done";
};

export function CanvasEngine({
  activeTileId,
  tileRegistry,
  renderTile,
  introPhase = "done"
}: CanvasEngineProps) {
  return (
    <GridCanvas
      activeTileId={activeTileId}
      tileRegistry={tileRegistry}
      renderTile={renderTile}
      introPhase={introPhase}
    />
  );
}

function GridCanvas({
  activeTileId,
  tileRegistry,
  renderTile,
  introPhase
}: {
  activeTileId: TileId;
  tileRegistry: TileConfig[];
  renderTile: (tile: TileConfig) => ReactNode;
  introPhase: "active" | "exiting" | "done";
}) {
  const activeTile = getTileById(activeTileId, tileRegistry);

  const bounds = useMemo(() => {
    const xs = tileRegistry.map((tile) => tile.x);
    const ys = tileRegistry.map((tile) => tile.y);
    return {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minY: Math.min(...ys),
      maxY: Math.max(...ys)
    };
  }, [tileRegistry]);

  const cols = bounds.maxX - bounds.minX + 1;
  const rows = bounds.maxY - bounds.minY + 1;

  const canvasStyle = {
    width: `${cols * 100}%`,
    height: `${rows * 100}%`,
    transform: `translate3d(${(-activeTile.x / cols) * 100}%, ${(-activeTile.y / rows) * 100}%, 0)`
  };

  return (
    <div className="viewport">
      <div className="canvas" style={canvasStyle}>
        {tileRegistry.map((tile) => {
          const isActive = tile.id === activeTileId;
          const isLandingIntro = tile.id === "landing" && (introPhase === "active" || introPhase === "exiting");
          return (
            <section
              key={tile.id}
              className={`tile${isLandingIntro ? " tile-intro-stage" : ""}`}
              data-tile-id={tile.id}
              style={{
                left: `${(tile.x / cols) * 100}%`,
                top: `${(tile.y / rows) * 100}%`,
                width: `${100 / cols}%`,
                height: `${100 / rows}%`
              }}
              aria-label={tile.label}
              {...(!isActive ? ({ inert: "" } as Record<string, string>) : {})}
            >
              {renderTile(tile)}
            </section>
          );
        })}
      </div>
    </div>
  );
}
