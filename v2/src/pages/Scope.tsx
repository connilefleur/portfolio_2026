import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Layout, Clock } from '../components/Layout';

import { PROJECTS } from '../data/projects';
import type { AxisKey } from '../data/types';

// ─── SCOPE CONSTANTS ───────────────────────────────────────────────────────
const VBW = 700, VBH = 700;
const CX  = 350, CY  = 370;
const R_MIN = 120, R_MAX = 250;
const LABEL_OFFSET = 52;

const AXES: { key: AxisKey; angle: number; label: string }[] = [
  { key: 'video', angle: 90,  label: 'Video'            },
  { key: 'cgi',   angle: 210, label: 'CGI'              },
  { key: 'code',  angle: 330, label: 'Code' },
];




function convexHull(pts: { x: number; y: number }[]) {
  if (pts.length < 3) return pts;
  let start = 0;
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].x < pts[start].x || (pts[i].x === pts[start].x && pts[i].y < pts[start].y)) start = i;
  }
  const hull: { x: number; y: number }[] = [];
  let curr = start;
  do {
    hull.push(pts[curr]);
    let next = (curr + 1) % pts.length;
    for (let i = 0; i < pts.length; i++) {
      const cross =
        (pts[next].x - pts[curr].x) * (pts[i].y - pts[curr].y) -
        (pts[next].y - pts[curr].y) * (pts[i].x - pts[curr].x);
      if (cross < 0) next = i;
    }
    curr = next;
  } while (curr !== start && hull.length <= pts.length);
  return hull;
}

const SPRING_DURATION = 550;

function evalCubicBezier(P1x: number, P1y: number, P2x: number, P2y: number) {
  function B(t: number, p1: number, p2: number) {
    return 3*t*(1-t)*(1-t)*p1 + 3*t*t*(1-t)*p2 + t*t*t;
  }
  return function(cssT: number): number {
    let u = cssT, lo = 0, hi = 1;
    for (let i = 0; i < 14; i++) {
      const x = B(u, P1x, P2x);
      if (Math.abs(x - cssT) < 1e-5) break;
      if (x < cssT) lo = u; else hi = u;
      u = (lo + hi) / 2;
    }
    return B(u, P1y, P2y);
  };
}
const springEase = evalCubicBezier(0.34, 1.56, 0.64, 1);

// ─── HELPERS ───────────────────────────────────────────────────────────────
function toXY(angleDeg: number, r: number) {
  const rad = angleDeg * Math.PI / 180;
  return { x: CX + Math.cos(rad) * r, y: CY - Math.sin(rad) * r };
}

function toAngleR(x: number, y: number) {
  const dx = x - CX, dy = CY - y;
  return { angle: Math.atan2(dy, dx) * 180 / Math.PI, r: Math.sqrt(dx * dx + dy * dy) };
}

function computePositions() {
  const grouped: Record<string, typeof PROJECTS> = {};
  PROJECTS.forEach(p => { grouped[p.axis] = grouped[p.axis] || []; grouped[p.axis].push(p); });

  const SPREAD  = 12;
  const R_OUTER = R_MAX - 20;
  const COUNT_MIN = 1, COUNT_MAX = 4;

  const nodes = PROJECTS.map(p => {
    const ax  = AXES.find(a => a.key === p.axis)!;
    const grp = grouped[p.axis];
    const idx = grp.indexOf(p);
    const n   = grp.length;
    const offset = (idx - (n - 1) / 2) * SPREAD;
    const c = Math.min(Math.max(p.count, COUNT_MIN), COUNT_MAX);
    const r = Math.min(
      R_MIN + (c - COUNT_MIN) / (COUNT_MAX - COUNT_MIN) * (R_MAX - R_MIN),
      R_OUTER
    );
    const pt = toXY(ax.angle + offset, r);
    return { ...p, x: pt.x, y: pt.y, r };
  });

  const NW = 134, NH = 56;
  const labelZones = AXES.map(ax => {
    const labelW = ax.label.length * 5.8 + 10;
    const pt = toXY(ax.angle, R_MAX + LABEL_OFFSET);
    return { x: pt.x, y: pt.y, hw: labelW / 2 + 30, hh: 20 };
  });

  for (let iter = 0; iter < 300; iter++) {
    let moved = false;

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        if (Math.abs(a.x - b.x) < NW && Math.abs(a.y - b.y) < NH) {
          const ar = toAngleR(a.x, a.y);
          const br = toAngleR(b.x, b.y);
          const sign = Math.sign(ar.angle - br.angle) || 1;
          const pa = toXY(ar.angle + sign, Math.min(ar.r, R_OUTER));
          const pb = toXY(br.angle - sign, Math.min(br.r, R_OUTER));
          a.x = pa.x; a.y = pa.y;
          b.x = pb.x; b.y = pb.y;
          moved = true;
        }
      }
    }

    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      for (const lz of labelZones) {
        if (Math.abs(n.x - lz.x) < NW / 2 + lz.hw && Math.abs(n.y - lz.y) < NH / 2 + lz.hh) {
          const ar = toAngleR(n.x, n.y);
          const newR = Math.max(ar.r - 18, R_MIN + 10);
          const pt   = toXY(ar.angle, newR);
          n.x = pt.x; n.y = pt.y;
          moved = true;
        }
      }
    }

    if (!moved) break;
  }

  return nodes;
}

// ─── COMPONENT ─────────────────────────────────────────────────────────────
export function Scope() {
  const mapRef          = useRef<HTMLDivElement>(null);
  const scaleRef        = useRef(1);
  const draggingRef     = useRef<{ id: string; startX: number; startY: number } | null>(null);
  const didDragRef      = useRef(false);
  const rafRef          = useRef<Record<string, number>>({});
  const lastDragOffRef  = useRef<Record<string, { dx: number; dy: number }>>({});
  const releaseTimerRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const [cssPos, setCssPos]               = useState<Record<string, { left: number; top: number }>>({});
  const [viewScale, setViewScale]         = useState(1);
  const [dragOffsets, setDragOffsets]     = useState<Record<string, { dx: number; dy: number }>>({});
  const [svgOffsets, setSvgOffsets]       = useState<Record<string, { dx: number; dy: number }>>({});
  const [springing, setSpringing]         = useState<Set<string>>(new Set());
  const [activeId, setActiveId]           = useState<string | null>(null);
  const [activeCat, setActiveCat]         = useState<AxisKey | null>(null);
  const [, setSearchParams]               = useSearchParams();

  const nodes = useMemo(() => computePositions(), []);
  const hull  = useMemo(() => {
    const pts = nodes.map(n => {
      const off = svgOffsets[n.id];
      return off
        ? { x: n.x + off.dx / scaleRef.current, y: n.y + off.dy / scaleRef.current }
        : { x: n.x, y: n.y };
    });
    return convexHull(pts);
  }, [nodes, svgOffsets]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    function update() {
      const rect = map!.getBoundingClientRect();
      const scale = Math.min(rect.width / VBW, rect.height / VBH);
      scaleRef.current = scale;
      setViewScale(scale);
      const offX = (rect.width  - VBW * scale) / 2;
      const offY = (rect.height - VBH * scale) / 2;
      const pos: Record<string, { left: number; top: number }> = {};
      nodes.forEach(n => { pos[n.id] = { left: offX + n.x * scale, top: offY + n.y * scale }; });
      setCssPos(pos);
    }
    update();
    const ro = new ResizeObserver(update);
    ro.observe(map);
    return () => ro.disconnect();
  }, [nodes]);

  const springReleaseSvg = useCallback((id: string, from: { dx: number; dy: number }) => {
    if (rafRef.current[id]) cancelAnimationFrame(rafRef.current[id]);
    const start = performance.now();
    function tick(now: number) {
      const t    = Math.min((now - start) / SPRING_DURATION, 1);
      const ease = springEase(t);
      const dx   = from.dx * (1 - ease);
      const dy   = from.dy * (1 - ease);
      setSvgOffsets(prev => ({ ...prev, [id]: { dx, dy } }));
      if (t < 1) {
        rafRef.current[id] = requestAnimationFrame(tick);
      } else {
        delete rafRef.current[id];
        setSvgOffsets(prev => { const n = { ...prev }; delete n[id]; return n; });
      }
    }
    rafRef.current[id] = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    function onMove(e: MouseEvent) {
      const drag = draggingRef.current;
      if (!drag) return;
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didDragRef.current = true;
      lastDragOffRef.current[drag.id] = { dx, dy };
      setDragOffsets(prev => ({ ...prev, [drag.id]: { dx, dy } }));
      setSvgOffsets(prev => ({ ...prev, [drag.id]: { dx, dy } }));
    }

    function onUp() {
      const drag = draggingRef.current;
      if (!drag) return;
      const id = drag.id;
      draggingRef.current = null;

      const from = lastDragOffRef.current[id] ?? { dx: 0, dy: 0 };
      delete lastDragOffRef.current[id];

      if (releaseTimerRef.current[id]) {
        clearTimeout(releaseTimerRef.current[id]);
        delete releaseTimerRef.current[id];
      }

      // CSS node springs back via transition; hull follows via RAF
      springReleaseSvg(id, from);
      setSpringing(prev => new Set([...prev, id]));
      setDragOffsets(prev => ({ ...prev, [id]: { dx: 0, dy: 0 } }));

      releaseTimerRef.current[id] = setTimeout(() => {
        delete releaseTimerRef.current[id];
        setSpringing(prev => { const n = new Set(prev); n.delete(id); return n; });
        setDragOffsets(prev => { const n = { ...prev }; delete n[id]; return n; });
        setSvgOffsets(prev => { const n = { ...prev }; delete n[id]; return n; });
        setActiveId(prev => prev === id ? null : prev);
      }, 700);
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [springReleaseSvg]);

  useEffect(() => {
    return () => {
      Object.values(rafRef.current).forEach(cancelAnimationFrame);
      Object.values(releaseTimerRef.current).forEach(clearTimeout);
    };
  }, []);


  function openViewer(id: string) {
    setSearchParams({ project: id });
  }

  function handleMapClick() {
    setActiveCat(null);
    setActiveId(null);
  }

  function handleCatClick(e: React.MouseEvent, key: AxisKey) {
    e.stopPropagation();
    setActiveCat(prev => prev === key ? null : key);
    setActiveId(null);
  }

  function nodeClasses(id: string, axis: string) {
    const dimmed = activeId
      ? activeId !== id
      : activeCat ? (axis !== activeCat) : false;
    const active = activeId === id;
    return ['node', active ? 'is-active' : '', dimmed ? 'is-dim' : ''].join(' ');
  }

  const meta = (
    <>
      <span className="dot" />
      <span>{PROJECTS.length} projects</span>
      <span>·</span>
      <span>HAM · 53.55 N</span>
      <span>·</span>
      <Clock />
    </>
  );

  return (
    <Layout page="scope" meta={meta} shellClass="shell--locked">
      <section className="map" ref={mapRef} onClick={handleMapClick}>
        <svg id="scope-svg" viewBox={`0 0 ${VBW} ${VBH}`} preserveAspectRatio="xMidYMid meet">

          {/* Convex hull — subtle fill + dashed border */}
          {hull.length > 2 && (
            <polygon
              points={hull.map(p => `${p.x},${p.y}`).join(' ')}
              fill="color-mix(in srgb, var(--ink) 4%, transparent)"
              stroke="color-mix(in srgb, var(--ink) 20%, transparent)"
              strokeWidth={0.7}
              strokeDasharray="3 5"
            />
          )}

          <g id="graticule">


            {/* Axis lines + labels — font size targets 10px on screen regardless of zoom */}
            {(() => {
              const svgFs  = Math.max(9, 10 / viewScale);
              const charW  = svgFs * 0.62;
              return AXES.map(ax => {
                const outer       = toXY(ax.angle, R_MAX + LABEL_OFFSET);
                const inner       = toXY(ax.angle, 12);
                const axEnd       = toXY(ax.angle, R_MAX);
                const isCatActive = activeCat === ax.key;
                const fullText    = '[ ' + ax.label.toUpperCase() + ' ]';
                const labelW      = fullText.length * charW + 12;
                const labelH      = svgFs + 8;
                return (
                  <g key={ax.key}>
                    <line
                      x1={inner.x} y1={inner.y} x2={axEnd.x} y2={axEnd.y}
                      stroke={isCatActive ? 'var(--hi)' : 'color-mix(in srgb, var(--ink) 22%, transparent)'}
                      strokeWidth={isCatActive ? 0.8 : 0.5}
                    />
                    <g
                      transform={`translate(${outer.x},${outer.y})`}
                      onClick={(e) => handleCatClick(e, ax.key)}
                      style={{ cursor: 'pointer', pointerEvents: 'auto' }}
                    >
                      <rect x={-labelW / 2} y={-labelH / 2} width={labelW} height={labelH} fill="transparent" />
                      <text
                        x={0} y={0}
                        textAnchor="middle" dominantBaseline="middle"
                        fontFamily="var(--mono)" fontSize={svgFs} fontWeight={500} letterSpacing="0.1em"
                        fill={isCatActive ? 'var(--hi)' : 'color-mix(in srgb, var(--ink) 45%, transparent)'}
                      >
                        {fullText}
                      </text>
                    </g>
                  </g>
                );
              });
            })()}

            <circle cx={CX} cy={CY} r={2} fill="color-mix(in srgb, var(--ink) 28%, transparent)" />
          </g>

          {/* Node anchor dots */}
          {nodes.map(n => {
            const isActiveCat = activeCat === n.axis;
            const isActiveId  = activeId === n.id;
            const isDimmed    = activeId ? !isActiveId : activeCat ? !isActiveCat : false;
            return (
              <circle key={n.id}
                cx={n.x} cy={n.y} r={2.5}
                fill={isActiveId || isActiveCat ? 'var(--hi)' : 'color-mix(in srgb, var(--mute) 50%, transparent)'}
                opacity={isDimmed ? 0.2 : 1}
                style={{ pointerEvents: 'none' }}
              />
            );
          })}
        </svg>

        {nodes.map(p => {
          const pos   = cssPos[p.id];
          const off   = dragOffsets[p.id];
          const isSpr = springing.has(p.id);
          const nid   = `${p.idx} · ${p.yearShort}`;
          const transform = off !== undefined
            ? `translate(calc(-50% + ${off.dx}px), calc(-50% + ${off.dy}px))`
            : undefined;
          const transition = isSpr
            ? `transform ${SPRING_DURATION}ms cubic-bezier(0.34, 1.56, 0.64, 1)`
            : 'none';
          return (
            <div
              key={p.id}
              className={nodeClasses(p.id, p.axis)}
              style={pos
                ? { left: pos.left, top: pos.top, transform, transition }
                : { opacity: 0 }}
              onMouseEnter={() => { if (!draggingRef.current) setActiveId(p.id); }}
              onMouseLeave={() => { if (draggingRef.current?.id !== p.id) setActiveId(null); }}
              onMouseDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                didDragRef.current = false;
                if (rafRef.current[p.id]) { cancelAnimationFrame(rafRef.current[p.id]); delete rafRef.current[p.id]; }
                if (releaseTimerRef.current[p.id]) {
                  clearTimeout(releaseTimerRef.current[p.id]);
                  delete releaseTimerRef.current[p.id];
                }
                delete lastDragOffRef.current[p.id];
                setSvgOffsets(prev => { const n = { ...prev }; delete n[p.id]; return n; });
                draggingRef.current = { id: p.id, startX: e.clientX, startY: e.clientY };
                setActiveId(p.id);
                setSpringing(prev => { const n = new Set(prev); n.delete(p.id); return n; });
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (!didDragRef.current) openViewer(p.id);
              }}
            >
              <div className="nid">{nid}</div>
              <div className="nm">{p.nm}</div>
            </div>
          );
        })}

        <div className="sig" aria-hidden="true">Conrad Löffler</div>
      </section>
    </Layout>
  );
}
