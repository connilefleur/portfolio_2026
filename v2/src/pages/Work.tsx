import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Layout, Clock } from '../components/Layout';
import PhysarumCanvas from '../components/PhysarumCanvas';
import { PROJECTS } from '../data/projects';
import type { Project } from '../data/types';

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
type View    = 'mycelium' | 'list';

/* ── Component ───────────────────────────────────────────────────────────── */
export function Work() {
  const isTouch = useRef(
    typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches
  );
  const [view, setView] = useState<View>(isTouch.current ? 'list' : 'mycelium');
  const [searchParams, setSearchParams] = useSearchParams();
  const viewerOpen = !!searchParams.get('project');

  const [hoveredId,       setHoveredId]       = useState<string | null>(null);
  const [touchExpandedId, setTouchExpandedId] = useState<string | null>(null);

  /* The one project that is currently expanded (hover or touch) */
  const activeId = hoveredId ?? touchExpandedId;

  /* Measure column width and set --active-flex so active row height = column width (square) */
  const mbodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (view !== 'list') return;
    const compute = () => {
      const mbody = mbodyRef.current;
      if (!mbody) return;
      const cell = mbody.querySelector<HTMLElement>('.mcell');
      if (!cell) return;
      const N    = PROJECTS.length;
      const colW = cell.offsetWidth;
      const H    = mbody.offsetHeight;
      // solve: f / (f + N - 1) * H = colW  →  f = colW * (N-1) / (H - colW)
      const f = colW * (N - 1) / Math.max(1, H - colW);
      mbody.style.setProperty('--active-flex', Math.max(1, f).toFixed(3));
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, [view]);

  function handleRowClick(id: string) {
    if (isTouch.current) {
      touchExpandedId === id
        ? setSearchParams({ project: id })
        : setTouchExpandedId(id);
    } else {
      setSearchParams({ project: id });
    }
  }

  const sorted = [...PROJECTS].sort((a, b) => a.order - b.order);

  const meta = (
    <>
      <span className="dot" />
      <span>{PROJECTS.length} projects</span>
      <span>·</span>
      <span>HAM · 53.55 N</span>
      {!isTouch.current && <><span>·</span><Clock /></>}
    </>
  );

  const toggle = !isTouch.current && !viewerOpen && (
    <div className="view-toggle">
      <button className={view === 'mycelium' ? 'is-active' : ''} onClick={() => setView('mycelium')}>
        Mycelium
      </button>
      <button className={view === 'list' ? 'is-active' : ''} onClick={() => setView('list')}>
        List
      </button>
    </div>
  );

  /* ── Mycelium view ─────────────────────────────────────────────────────── */
  if (view === 'mycelium') {
    return (
      <Layout page="work" meta={meta} shellClass="shell--locked">
        <section className="map">
          <PhysarumCanvas
            projects={PROJECTS.filter(p => p.axis !== 'code')}
            onNodeClick={id => setSearchParams({ project: id })}
            paused={viewerOpen}
          />
        </section>
        {toggle}
      </Layout>
    );
  }

  /* ── List view — full-height flex rows ─────────────────────────────────── */
  return (
    <Layout
      page="work"
      meta={meta}
      contentClass="content--list"
      shellClass={isTouch.current ? '' : 'shell--locked'}
    >
      <div className="list-inner">
        {/* Header */}
        <div className="mrow mhead">
          <div className="mth">#</div>
          {CATEGORIES.map(c => <div key={c.key} className="mth">{c.label}</div>)}
        </div>

        {/* Body rows */}
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
                    <div
                      key={c.key}
                      className="mcell mcell--filled"
                    >
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

      {toggle}
    </Layout>
  );
}
