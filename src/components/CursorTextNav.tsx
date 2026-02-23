import { useEffect, useMemo, useState } from "react";
import { type TileConfig, type TileId, getProjectTiles, isProjectTileId } from "../canvas/tileRegistry";

type CursorTextNavProps = {
  activeTileId: TileId;
  tileRegistry: TileConfig[];
  introPhase: "active" | "exiting" | "done";
  onNavigate: (id: TileId) => void;
};

export function CursorTextNav({ activeTileId, tileRegistry, introPhase, onNavigate }: CursorTextNavProps) {
  const [pointerFine, setPointerFine] = useState(() => window.matchMedia("(hover: hover) and (pointer: fine)").matches);
  const [pointerVisible, setPointerVisible] = useState(false);
  const [cursor, setCursor] = useState({ x: window.innerWidth * 0.5, y: window.innerHeight * 0.5 });
  const [isLeftSide, setIsLeftSide] = useState(true);

  const enabled = introPhase === "done" && activeTileId !== "landing" && pointerFine;
  const projectTiles = useMemo(() => getProjectTiles(tileRegistry), [tileRegistry]);
  const activeProjectIndex = useMemo(
    () => (isProjectTileId(activeTileId) ? projectTiles.findIndex((p) => p.id === activeTileId) : -1),
    [activeTileId, projectTiles]
  );
  const previousProjectId = activeProjectIndex > 0 ? projectTiles[activeProjectIndex - 1].id : null;
  const nextProjectId = activeProjectIndex >= 0 && activeProjectIndex < projectTiles.length - 1 ? projectTiles[activeProjectIndex + 1].id : null;
  const hasPreviousProject = activeProjectIndex > 0;
  const hasNextProject = activeProjectIndex >= 0 && activeProjectIndex < projectTiles.length - 1;
  const isProjectMode = activeProjectIndex >= 0;

  useEffect(() => {
    const mediaQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
    const syncMode = () => setPointerFine(mediaQuery.matches);
    syncMode();
    mediaQuery.addEventListener("change", syncMode);
    return () => mediaQuery.removeEventListener("change", syncMode);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("cursor-text-nav-active", enabled);
    return () => document.body.classList.remove("cursor-text-nav-active");
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setPointerVisible(false);
      return;
    }

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      setCursor({ x: event.clientX, y: event.clientY });
      setIsLeftSide(event.clientX < window.innerWidth * 0.5);
      setPointerVisible(true);
    };

    const onPointerLeave = () => setPointerVisible(false);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerleave", onPointerLeave);
    window.addEventListener("blur", onPointerLeave);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("blur", onPointerLeave);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      event.preventDefault();
      event.stopPropagation();

      if (!isProjectMode) {
        onNavigate("landing");
        return;
      }

      if (isLeftSide) {
        onNavigate(previousProjectId ?? "landing");
        return;
      }

      onNavigate(nextProjectId ?? "landing");
    };

    window.addEventListener("pointerdown", onPointerDown, { capture: true });
    return () => window.removeEventListener("pointerdown", onPointerDown, true);
  }, [enabled, isLeftSide, isProjectMode, nextProjectId, onNavigate, previousProjectId]);

  const label = isProjectMode ? (isLeftSide ? (hasPreviousProject ? "PREVIOUS" : "HOME") : hasNextProject ? "NEXT" : "HOME") : "BACK";

  return (
    <div className={`cursor-text-nav${enabled && pointerVisible ? " is-visible" : ""}`} aria-hidden="true">
      <span
        className="cursor-text-nav-label tiny"
        style={{ left: `${cursor.x}px`, top: `${cursor.y}px`, transform: "translate3d(-50%, -50%, 0)" }}
      >
        {label}
      </span>
    </div>
  );
}
