import { forwardRef, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PROJECTS_BY_ID } from '../data/projects';
import type { MediaItem, Project } from '../data/types';
import { InteractiveStage } from './InteractiveStage';

function mediaLabel(type: MediaItem['type'], typeIdx: number, label?: string): string {
  if (label) return label;
  if (type === 'video')       return `Video ${String(typeIdx + 1).padStart(3, '0')}`;
  if (type === 'compare')     return `Compare ${String(typeIdx + 1).padStart(3, '0')}`;
  if (type === 'interactive') return 'Interactive Experience';
  return `Image ${String(typeIdx + 1).padStart(3, '0')}`;
}

function typeTag(type: MediaItem['type']) {
  if (type === 'video')       return 'vid';
  if (type === 'compare')     return 'cmp';
  if (type === 'interactive') return 'exp';
  return 'img';
}

function CompareSlider({ url, compareUrl }: { url: string; compareUrl: string }) {
  const [split, setSplit] = useState(50);
  const stageRef = useRef<HTMLDivElement>(null);
  const imgRef   = useRef<HTMLImageElement>(null);

  function updateSplit(clientX: number) {
    const stage = stageRef.current?.getBoundingClientRect();
    const img   = imgRef.current;
    if (!stage) return;

    let minX = 0, maxX = stage.width;
    if (img && img.naturalWidth && img.naturalHeight) {
      const imgAspect   = img.naturalWidth / img.naturalHeight;
      const stageAspect = stage.width / stage.height;
      if (stageAspect > imgAspect) {
        const renderedW = stage.height * imgAspect;
        minX = (stage.width - renderedW) / 2;
        maxX = minX + renderedW;
      } else {
        minX = 0; maxX = stage.width;
      }
    }

    const clampedX = Math.max(minX + 1, Math.min(maxX - 1, clientX - stage.left));
    setSplit((clampedX / stage.width) * 100);
  }

  const imgStyle: React.CSSProperties = {
    position: 'absolute', inset: 0,
    width: '100%', height: '100%',
    objectFit: 'contain', display: 'block',
  };

  return (
    <div
      ref={stageRef}
      style={{ position: 'absolute', inset: 0, cursor: 'ew-resize', userSelect: 'none' }}
      onMouseMove={e => updateSplit(e.clientX)}
      onTouchMove={e => { e.preventDefault(); updateSplit(e.touches[0].clientX); }}
    >
      <img ref={imgRef} src={url}       style={imgStyle} alt="processed" draggable={false} />
      <img              src={compareUrl} style={{ ...imgStyle, clipPath: `inset(0 ${100 - split}% 0 0)` }} alt="original" draggable={false} />

      <div style={{
        position: 'absolute', top: 0, bottom: 0, left: `${split}%`,
        width: 1, background: 'rgba(228,232,242,0.50)', transform: 'translateX(-50%)',
        pointerEvents: 'none',
      }}>
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 26, height: 26, borderRadius: '50%',
          border: '1px solid rgba(228,232,242,0.50)',
          background: 'rgba(8,9,12,0.80)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ color: 'rgba(228,232,242,0.55)', fontSize: 7, lineHeight: 1 }}>◀▶</span>
        </div>
      </div>

      <span style={{ position: 'absolute', bottom: 10, left: 12, font: '8px/1 var(--mono)', letterSpacing: '0.14em', color: 'rgba(228,232,242,0.35)', textTransform: 'uppercase', pointerEvents: 'none' }}>Original</span>
      <span style={{ position: 'absolute', bottom: 10, right: 12, font: '8px/1 var(--mono)', letterSpacing: '0.14em', color: 'rgba(228,232,242,0.35)', textTransform: 'uppercase', pointerEvents: 'none' }}>Processed</span>
    </div>
  );
}

interface ViewerProps {
  onClose?: () => void;
  className?: string;
  isOpen?: boolean;
}

export const Viewer = forwardRef<HTMLDivElement, ViewerProps>(function Viewer(
  { onClose, className, isOpen },
  ref,
) {
  const [searchParams, setSearchParams] = useSearchParams();
  const projectId = searchParams.get('project');
  const project = projectId ? PROJECTS_BY_ID[projectId] : null;

  const vidRef  = useRef<HTMLVideoElement>(null);
  const imgRef  = useRef<HTMLImageElement>(null);
  const stageEl = useRef<HTMLDivElement>(null);

  const [activeIdx, setActiveIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);

  // Swipe animation state
  const [swipeOffset,    setSwipeOffset]    = useState(0);
  const [swipeAnimating, setSwipeAnimating] = useState(false);

  // Refs give touch handlers (set up once) stable access to current values
  const activeIdxRef = useRef(0);
  const projectRef   = useRef<Project | null>(null);
  useEffect(() => { activeIdxRef.current = activeIdx; }, [activeIdx]);
  useEffect(() => { projectRef.current   = project;   }, [project]);

  useEffect(() => { setActiveIdx(0); }, [projectId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && project) close();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [project]);

  // ── Touch swipe navigation ───────────────────────────────────────────────
  useEffect(() => {
    const el = stageEl.current;
    if (!el) return;

    let startX = 0, startY = 0, locked = false, dragging = false;

    function onTouchStart(e: TouchEvent) {
      startX   = e.touches[0].clientX;
      startY   = e.touches[0].clientY;
      locked   = false;
      dragging = false;
      setSwipeAnimating(false);
    }

    function onTouchMove(e: TouchEvent) {
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;

      if (!locked) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        locked   = true;
        dragging = Math.abs(dx) > Math.abs(dy);
      }
      if (!dragging) return;

      // Compare items have their own horizontal wiper — let them handle touch
      const proj = projectRef.current;
      const idx  = activeIdxRef.current;
      if (proj?.media[idx]?.type === 'compare') return;

      e.preventDefault();

      const n      = proj?.media.length ?? 1;
      const atEdge = (idx === 0 && dx > 0) || (idx === n - 1 && dx < 0);
      setSwipeOffset(dx * (atEdge ? 0.25 : 1));
    }

    function onTouchEnd(e: TouchEvent) {
      if (!dragging) { locked = false; return; }
      dragging = false;
      locked   = false;

      const dx   = e.changedTouches[0].clientX - startX;
      const w    = el!.clientWidth;
      const proj = projectRef.current;
      const idx  = activeIdxRef.current;
      const n    = proj?.media.length ?? 1;

      if (Math.abs(dx) > w * 0.22 && n > 1) {
        const delta = dx < 0 ? 1 : -1;
        const nextI = idx + delta;

        if (nextI >= 0 && nextI < n) {
          const exitX    = dx < 0 ? -w : w;
          const enterX   = dx < 0 ?  w : -w;
          const nextItem = proj?.media[nextI];

          setSwipeAnimating(true);
          setSwipeOffset(exitX);

          setTimeout(() => {
            const img = imgRef.current;

            // Set next image src on the actual element now, while the slide
            // sits off-screen at enterX, so decode runs during the gap.
            // useEffect will also set the same URL after re-render — harmless.
            if (img && nextItem?.type === 'image' && nextItem.url) {
              img.src    = nextItem.url;
              img.srcset = nextItem.srcSet ?? '';
              img.style.display = 'block';
            }

            setActiveIdx(nextI);
            setSwipeAnimating(false);
            setSwipeOffset(enterX);

            const slideIn = () => requestAnimationFrame(() => requestAnimationFrame(() => {
              setSwipeAnimating(true);
              setSwipeOffset(0);
            }));

            if (img && nextItem?.type === 'image' && img.src && !img.complete) {
              // Wait for decode; 400ms cap so slow connections don't stall
              let fired = false;
              const go = () => { if (!fired) { fired = true; slideIn(); } };
              setTimeout(go, 400);
              img.decode?.().then(go).catch(go);
            } else {
              slideIn();
            }
          }, 200);
          return;
        }
      }

      setSwipeAnimating(true);
      setSwipeOffset(0);
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true  });
    el.addEventListener('touchmove',  onTouchMove,  { passive: false });
    el.addEventListener('touchend',   onTouchEnd,   { passive: true  });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove',  onTouchMove);
      el.removeEventListener('touchend',   onTouchEnd);
    };
  }, []); // set up once; live values come from refs

  // ── Media switching ──────────────────────────────────────────────────────
  const activeItem = project?.media[activeIdx];
  const activeLink = activeItem?.link ?? project?.link;

  useEffect(() => {
    if (!project) return;
    const vid = vidRef.current;
    const img = imgRef.current;
    if (!vid || !img) return;
    const item = project.media[activeIdx];
    if (!item || item.type === 'compare' || item.type === 'interactive' || !item.url) {
      vid.pause(); vid.removeAttribute('src'); vid.style.display = 'none';
      img.style.display = 'none';
      return;
    }
    if (item.type === 'video') {
      img.style.display = 'none';
      vid.style.display = 'block';
      if (vid.src !== new URL(item.url, location.href).href) {
        vid.src = item.url;
        vid.poster = item.poster ?? '';
        vid.load();
      }
      vid.pause();
      setIsPlaying(false);
      setIsBuffering(false);
    } else {
      vid.pause(); vid.style.display = 'none';
      setIsPlaying(false);
      img.style.display = 'block';
      img.src    = item.url;
      img.srcset = item.srcSet ?? '';
      img.sizes  = item.srcSet ? '(max-width: 768px) 100vw, calc(100vw - 360px)' : '';
    }
  }, [activeIdx, project]);

  useEffect(() => {
    if (!project) {
      const vid = vidRef.current;
      if (vid) { vid.pause(); vid.removeAttribute('src'); }
      setIsPlaying(false);
    }
  }, [project]);

  function togglePlay() {
    const vid = vidRef.current;
    if (!vid) return;
    if (vid.paused) { vid.play().catch(() => {}); } else { vid.pause(); }
  }

  const close = () => {
    if (onClose) {
      onClose();
    } else {
      setSearchParams(prev => { prev.delete('project'); return prev; });
    }
  };

  const slideStyle: React.CSSProperties = {
    transform:  swipeOffset !== 0 ? `translateX(${swipeOffset}px)` : undefined,
    transition: swipeAnimating     ? 'transform 220ms cubic-bezier(0.33,1,0.68,1)' : 'none',
  };

  return (
    <div
      ref={ref}
      id="vw-overlay"
      className={[(isOpen ?? !!project) ? 'is-open' : '', className ?? ''].join(' ').trim()}
      aria-hidden={!project}
      {...(!project ? { inert: '' } : {}) as React.HTMLAttributes<HTMLDivElement>}
    >
      {/* Left panel */}
      <div className="vw-panel">
        <div className="vw-panel-head">
          {project && (
            <div className="vw-ph-meta">
              <span className="vw-is-idx">{project.idx} · {project.year}</span>
              <span className="vw-is-cat">{project.category}</span>
            </div>
          )}
          <button className="vw-close" onClick={close}>[ × ]</button>
        </div>

        {project && (
          <div className="vw-panel-body">
            <div className="vw-is-client">{project.client}</div>
            <h2 className="vw-is-title">{project.title}</h2>
            <div className="vw-is-rule" />
            <div className="vw-is-blocks">
              <div>
                <div className="vw-is-block-h">{project.info1h}</div>
                <p className="vw-is-block-p">{project.info1}</p>
              </div>
              <div>
                <div className="vw-is-block-h">{project.info2h}</div>
                <p className="vw-is-block-p">{project.info2}</p>
              </div>
            </div>
            {activeLink && (
              <a className="vw-is-link" href={activeLink.url} target="_blank" rel="noopener noreferrer">
                {activeLink.label} ↗
              </a>
            )}
          </div>
        )}

        {project && project.media.length > 0 && (
          <div className="vw-media-list">
            {(() => {
              const typeCount: Record<string, number> = {};
              let dividerInserted = false;
              return project.media.map((item, i) => {
                const typeIdx = typeCount[item.type] ?? 0;
                typeCount[item.type] = typeIdx + 1;
                const showDivider = item.secondary && !dividerInserted;
                if (showDivider) dividerInserted = true;
                return (
                  <div key={i}>
                    {showDivider && <div className="vw-media-divider" />}
                    <button
                      className={`vw-media-row${activeIdx === i ? ' vw-media-row--active' : ''}${item.secondary ? ' vw-media-row--secondary' : ''}`}
                      onClick={() => setActiveIdx(i)}
                    >
                      <span className="vw-mr-idx">{String(i + 1).padStart(2, '0')}</span>
                      <span className="vw-mr-type">{typeTag(item.type)}</span>
                      <span className="vw-mr-label">{mediaLabel(item.type, typeIdx, item.label)}</span>
                    </button>
                  </div>
                );
              });
            })()}
          </div>
        )}
      </div>

      {/* Media stage */}
      <div className="vw-stage" ref={stageEl}>
        {project && project.media.length === 0 && (
          <span className="vw-no-media">Media coming soon</span>
        )}

        {project && project.media.length > 1 && (
          <div className="vw-dots">
            {project.media.map((_, i) => (
              <div key={i} className={`vw-dot${i === activeIdx ? ' vw-dot--active' : ''}`} />
            ))}
          </div>
        )}

        <div className="vw-slide" style={slideStyle}>
          <img ref={imgRef} className="vw-img" alt="" decoding="async" style={{ display: 'none' }} />
          <video
            ref={vidRef}
            className="vw-vid"
            muted loop playsInline preload="auto"
            onClick={togglePlay}
            onPlay={() => { setIsPlaying(true); setIsBuffering(false); }}
            onPause={() => setIsPlaying(false)}
            onWaiting={() => setIsBuffering(true)}
            onPlaying={() => setIsBuffering(false)}
            onCanPlayThrough={() => setIsBuffering(false)}
            style={{ display: 'none', cursor: 'pointer' }}
          />
          {activeItem?.type === 'video' && !isPlaying && (
            <button className="vw-play-btn" onClick={togglePlay} aria-label="Play">
              {isBuffering
                ? <svg className="vw-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="9" strokeOpacity="0.25"/><path d="M12 3a9 9 0 0 1 9 9" strokeLinecap="round"/></svg>
                : <svg viewBox="0 0 24 24"><polygon points="5,2 22,12 5,22" fill="currentColor"/></svg>
              }
            </button>
          )}
          {activeItem?.type === 'compare' && activeItem.compareUrl && (
            <CompareSlider key={activeIdx} url={activeItem.url} compareUrl={activeItem.compareUrl} />
          )}
          {activeItem?.type === 'interactive' && (
            <InteractiveStage key={activeIdx} poster={activeItem.poster} />
          )}
        </div>
      </div>
    </div>
  );
});
