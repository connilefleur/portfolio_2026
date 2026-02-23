import { useEffect, useRef } from "react";

const SNAP_RADIUS = 220;
const HIDE_LINE_DISTANCE = 320;
const FOLLOW_EASING = 0.22;

type Point = { x: number; y: number };
type AnchorGeometry = {
  center: Point;
  rx: number;
  ry: number;
};

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function getAnchorCenter(element: HTMLElement): Point {
  const rect = element.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2
  };
}

function getAnchorGeometry(element: HTMLElement): AnchorGeometry {
  const rect = element.getBoundingClientRect();
  return {
    center: {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    },
    // Slightly larger than text/button box to keep the rope off the label itself.
    rx: rect.width / 2 + 12,
    ry: rect.height / 2 + 8
  };
}

function projectPointToEllipseEdge(geometry: AnchorGeometry, target: Point): Point {
  const dx = target.x - geometry.center.x;
  const dy = target.y - geometry.center.y;
  const denom = (dx * dx) / (geometry.rx * geometry.rx) + (dy * dy) / (geometry.ry * geometry.ry);
  if (denom <= 0.000001) {
    return geometry.center;
  }
  const t = 1 / Math.sqrt(denom);
  return {
    x: geometry.center.x + dx * t,
    y: geometry.center.y + dy * t
  };
}

function isPointInsideEllipse(geometry: AnchorGeometry, point: Point): boolean {
  const dx = point.x - geometry.center.x;
  const dy = point.y - geometry.center.y;
  const normalized = (dx * dx) / (geometry.rx * geometry.rx) + (dy * dy) / (geometry.ry * geometry.ry);
  return normalized <= 1;
}

function getActiveAnchors(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('section.tile:not([inert]) [data-nav-anchor="true"]'));
}

export function NavRopeOverlay() {
  const rootRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);
  const activeAnchorRef = useRef<HTMLElement | null>(null);
  const targetCursorRef = useRef<Point>({ x: 0, y: 0 });
  const renderCursorRef = useRef<Point>({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);
  const canHoverRef = useRef(true);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
    const syncMode = () => {
      canHoverRef.current = mediaQuery.matches;
      if (!mediaQuery.matches && rootRef.current) {
        rootRef.current.dataset.visible = "false";
      }
    };
    syncMode();
    mediaQuery.addEventListener("change", syncMode);
    return () => mediaQuery.removeEventListener("change", syncMode);
  }, []);

  useEffect(() => {
    const tick = () => {
      const line = lineRef.current;
      const root = rootRef.current;
      const anchor = activeAnchorRef.current;
      if (!line || !root || !anchor || !canHoverRef.current) {
        rafRef.current = window.requestAnimationFrame(tick);
        return;
      }

      const current = renderCursorRef.current;
      const target = targetCursorRef.current;
      current.x += (target.x - current.x) * FOLLOW_EASING;
      current.y += (target.y - current.y) * FOLLOW_EASING;
      renderCursorRef.current = current;

      const anchorGeometry = getAnchorGeometry(anchor);
      if (isPointInsideEllipse(anchorGeometry, current)) {
        root.dataset.visible = "false";
        rafRef.current = window.requestAnimationFrame(tick);
        return;
      }
      const startPoint = projectPointToEllipseEdge(anchorGeometry, current);
      const length = distance(startPoint, current);
      if (length > HIDE_LINE_DISTANCE) {
        root.dataset.visible = "false";
        activeAnchorRef.current = null;
        rafRef.current = window.requestAnimationFrame(tick);
        return;
      }

      const angle = Math.atan2(current.y - startPoint.y, current.x - startPoint.x);
      root.dataset.visible = "true";
      line.style.left = `${startPoint.x}px`;
      line.style.top = `${startPoint.y}px`;
      line.style.width = `${length}px`;
      line.style.transform = `translateY(-50%) rotate(${angle}rad)`;
      rafRef.current = window.requestAnimationFrame(tick);
    };

    rafRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      if (!canHoverRef.current || event.pointerType === "touch") return;

      const pointer = { x: event.clientX, y: event.clientY };
      targetCursorRef.current = pointer;
      if (!activeAnchorRef.current) {
        renderCursorRef.current = pointer;
      }

      const anchors = getActiveAnchors();
      if (anchors.length === 0) {
        if (rootRef.current) rootRef.current.dataset.visible = "false";
        activeAnchorRef.current = null;
        return;
      }

      let nearest: HTMLElement | null = null;
      let nearestDistance = Number.POSITIVE_INFINITY;
      for (const anchor of anchors) {
        const d = distance(getAnchorCenter(anchor), pointer);
        if (d < nearestDistance) {
          nearestDistance = d;
          nearest = anchor;
        }
      }

      if (!nearest || nearestDistance > SNAP_RADIUS) {
        if (rootRef.current) rootRef.current.dataset.visible = "false";
        activeAnchorRef.current = null;
        return;
      }

      activeAnchorRef.current = nearest;
    };

    const onPointerLeave = () => {
      if (rootRef.current) rootRef.current.dataset.visible = "false";
      activeAnchorRef.current = null;
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerleave", onPointerLeave);
    window.addEventListener("blur", onPointerLeave);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("blur", onPointerLeave);
    };
  }, []);

  return (
    <div className="nav-rope-overlay" ref={rootRef} data-visible="false" aria-hidden="true">
      <div className="nav-rope-line" ref={lineRef} />
    </div>
  );
}
