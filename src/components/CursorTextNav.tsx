import { useEffect, useMemo, useRef, useState } from "react";
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
  const [isLeftSide, setIsLeftSide] = useState(true);
  const labelRef = useRef<HTMLSpanElement>(null);
  const rafRef = useRef<number | null>(null);
  const pointerVisibleRef = useRef(false);
  const pointerTargetRef = useRef({ x: window.innerWidth * 0.5, y: window.innerHeight * 0.5 });
  const isLeftSideRef = useRef(true);

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
      pointerVisibleRef.current = false;
      setPointerVisible(false);
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    const applyCursorPosition = () => {
      const node = labelRef.current;
      if (!node) {
        rafRef.current = null;
        return;
      }
      const point = pointerTargetRef.current;
      node.style.left = `${point.x}px`;
      node.style.top = `${point.y}px`;
      rafRef.current = null;
    };

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      pointerTargetRef.current = { x: event.clientX, y: event.clientY };

      const nextIsLeft = event.clientX < window.innerWidth * 0.5;
      if (nextIsLeft !== isLeftSideRef.current) {
        isLeftSideRef.current = nextIsLeft;
        setIsLeftSide(nextIsLeft);
      }

      if (!pointerVisibleRef.current) {
        pointerVisibleRef.current = true;
        setPointerVisible(true);
      }

      if (!rafRef.current) {
        rafRef.current = window.requestAnimationFrame(applyCursorPosition);
      }
    };

    const onPointerLeave = () => {
      pointerVisibleRef.current = false;
      setPointerVisible(false);
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerleave", onPointerLeave);
    window.addEventListener("blur", onPointerLeave);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("blur", onPointerLeave);
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
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
      <span ref={labelRef} className="cursor-text-nav-label tiny" style={{ transform: "translate3d(-50%, -50%, 0)" }}>
        {label}
      </span>
    </div>
  );
}
