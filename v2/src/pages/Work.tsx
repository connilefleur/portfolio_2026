import { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Layout, Clock } from '../components/Layout';
import CanvasView from '../components/CanvasView';
import { Viewer } from '../components/Viewer';
import { PROJECTS } from '../data/projects';
import type { Project } from '../data/types';
import type { EngineType } from '../components/canvas/types';

/* ── Thumb helpers ────────────────────────────────────────────────────────── */
const VIDEO_THUMBS: Record<string, string> = {
  vfx:  '/projects/vfx/images/vfx-list-thumb.webp',
  reel: '/projects/reel/images/reel-list-thumb.webp',
};

interface Thumb { src: string; srcSet?: string; }

function listThumb(p: Project): Thumb | null {
  if (VIDEO_THUMBS[p.id]) return { src: VIDEO_THUMBS[p.id] };
  const img = p.media.find(m => m.type === 'image');
  if (!img) return null;
  const w480 = img.srcSet?.match(/(\S+)\s+480w/)?.[1];
  return { src: w480 ?? img.url, srcSet: img.srcSet ?? undefined };
}

const CATEGORIES = [
  { key: 'video', label: 'Edit' },
  { key: 'cgi',   label: 'CGI'  },
  { key: 'code',  label: 'Code' },
] as const;

type CatKey = typeof CATEGORIES[number]['key'];

/* ── Transition constants ─────────────────────────────────────────────────── */
type Phase = 'idle' | 'open';
const TRANSITION_MS = 480;

/* ── Component ───────────────────────────────────────────────────────────── */
export function Work() {
  const isTouch = useRef(
    typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches
  );

  const [searchParams, setSearchParams] = useSearchParams();

  const hasInitialProject = !!searchParams.get('project');
  const [phaseState, setPhaseState] = useState<Phase>(hasInitialProject ? 'open' : 'idle');
  const setPhase = useCallback((p: Phase) => setPhaseState(p), []);

  const [engine, setEngine]           = useState<EngineType>('physarum');
  const [fxOn,   setFxOn]             = useState(true);
  const [showControls, setShowControls] = useState(false);

  const [hoveredId,       setHoveredId]       = useState<string | null>(null);
  const [touchExpandedId, setTouchExpandedId] = useState<string | null>(null);
  const activeId = hoveredId ?? touchExpandedId;

  const [viewerOpen, setViewerOpen] = useState(hasInitialProject);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const mbodyRef = useRef<HTMLDivElement>(null);

  /* 'c' key toggles engine controls on desktop canvas view */
  useEffect(() => {
    if (isTouch.current) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'c' || e.key === 'C') {
        if ((e.target as HTMLElement).closest('input,textarea,select')) return;
        setShowControls(v => !v);
      }
      if (e.key === 'Escape') setShowControls(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /* Measure column width for list view square expansion */
  useEffect(() => {
    if (!isTouch.current) return;
    const compute = () => {
      const mbody = mbodyRef.current;
      if (!mbody) return;
      const cell = mbody.querySelector<HTMLElement>('.mcell');
      if (!cell) return;
      const N    = PROJECTS.length;
      const colW = cell.offsetWidth;
      const H    = mbody.offsetHeight;
      const f = colW * (N - 1) / Math.max(1, H - colW);
      mbody.style.setProperty('--active-flex', Math.max(1, f).toFixed(3));
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, []);

  /* Snap to idle if URL clears externally (browser back button) */
  useEffect(() => {
    if (!searchParams.get('project')) {
      clearTimeout(closeTimerRef.current);
      setViewerOpen(false);
      setPhase('idle');
    }
  }, [searchParams, setPhase]);

  /* ── Open / close handlers ───────────────────────────────────────────── */
  const openMyceliumViewer = useCallback((id: string) => {
    clearTimeout(closeTimerRef.current);
    setSearchParams({ project: id });
    setViewerOpen(true);
    closeTimerRef.current = setTimeout(() => setPhase('open'), TRANSITION_MS);
  }, [setPhase, setSearchParams]);

  const closeMyceliumViewer = useCallback(() => {
    clearTimeout(closeTimerRef.current);
    setPhase('idle');
    setViewerOpen(false);
    closeTimerRef.current = setTimeout(() => {
      setSearchParams(prev => { const n = new URLSearchParams(prev); n.delete('project'); return n; });
    }, TRANSITION_MS);
  }, [setPhase, setSearchParams]);

  function handleRowClick(id: string) {
    if (touchExpandedId === id) {
      setSearchParams({ project: id });
    } else {
      setTouchExpandedId(id);
    }
  }

  const sorted = [...PROJECTS].sort((a, b) => a.order - b.order);

  const meta = <Clock />;

  /* ── Engine controls — shown only when 'c' is pressed ───────────────────── */
  const controls = !isTouch.current && showControls && phaseState === 'idle' && (
    <div className="view-toggle">
      <button className={engine === 'physarum' ? 'is-active' : ''} onClick={() => setEngine('physarum')}>PHY</button>
      <button className={engine === 'flow'     ? 'is-active' : ''} onClick={() => setEngine('flow')}>FLOW</button>
      <button className={engine === 'tm'       ? 'is-active' : ''} onClick={() => setEngine('tm')}>TM</button>
      <span className="view-toggle-sep" />
      <button className={fxOn ? 'is-active' : ''} onClick={() => setFxOn(v => !v)}>FX</button>
    </div>
  );

  /* ── Touch: always list view ──────────────────────────────────────────── */
  if (isTouch.current) {
    return (
      <Layout page="work" meta={meta} contentClass="content--list" shellClass="shell--locked">
        <div className="list-inner">
          <div className="mrow mhead">
            <div className="mth">#</div>
            {CATEGORIES.map(c => <div key={c.key} className="mth">{c.label}</div>)}
          </div>
          <div className="mbody" ref={mbodyRef}>
            {sorted.map(p => {
              const thumb    = listThumb(p);
              const isActive = activeId === p.id;
              const rowCls   = `mrow mrow--body${isActive ? ' is-active' : ''}`;
              return (
                <div
                  key={p.id}
                  className={rowCls}
                  onMouseEnter={() => setHoveredId(p.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() => handleRowClick(p.id)}
                >
                  <div className="midx">{p.idx}</div>
                  {CATEGORIES.map(c => {
                    const filled = p.axis === (c.key as CatKey);
                    if (!filled) return <div key={c.key} className="mcell mcell--empty" />;
                    return (
                      <div key={c.key} className="mcell mcell--filled">
                        <div className={`cell-text${isActive ? ' cell-text--active' : ''}`}>
                          <span className="cell-nm">{p.nm}</span>
                          <span className="cell-yr">{p.yearShort}</span>
                        </div>
                        {thumb && (
                          <img
                            className={`cell-img${isActive ? ' is-visible' : ''}`}
                            src={thumb.src}
                            srcSet={thumb.srcSet}
                            sizes="34vw"
                            alt=""
                            loading="eager"
                            decoding="async"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
        <Viewer className="vw--list-mode" />
      </Layout>
    );
  }

  /* ── Desktop: always canvas view, fullscreen ─────────────────────────── */
  return (
    <Layout page="work" meta={meta} shellClass="shell--locked shell--canvas-full">
      <section className="map">
        <CanvasView
          projects={PROJECTS.filter(p => p.axis !== 'code')}
          onNodeClick={openMyceliumViewer}
          engine={engine}
          fxOn={fxOn}
          paused={phaseState === 'open'}
          fullscreen
        />
      </section>
      {controls}
      <Viewer
        isOpen={viewerOpen}
        onClose={closeMyceliumViewer}
      />
    </Layout>
  );
}
