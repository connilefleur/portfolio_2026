import { forwardRef, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PROJECTS_BY_ID } from '../data/projects';

function mediaLabel(type: 'image' | 'video' | 'compare', typeIdx: number, label?: string): string {
  if (label) return label;
  if (type === 'video')   return `Video ${String(typeIdx + 1).padStart(3, '0')}`;
  if (type === 'compare') return `Compare ${String(typeIdx + 1).padStart(3, '0')}`;
  return `Image ${String(typeIdx + 1).padStart(3, '0')}`;
}

function typeTag(type: 'image' | 'video' | 'compare') {
  if (type === 'video')   return 'vid';
  if (type === 'compare') return 'cmp';
  return 'img';
}

function CompareSlider({ url, compareUrl }: { url: string; compareUrl: string }) {
  const [split, setSplit] = useState(50);
  const stageRef = useRef<HTMLDivElement>(null);
  const imgRef   = useRef<HTMLImageElement>(null);

  // Compute rendered image bounds inside objectFit:contain, constrain wiper to those bounds
  function updateSplit(clientX: number) {
    const stage = stageRef.current?.getBoundingClientRect();
    const img   = imgRef.current;
    if (!stage) return;

    let minX = 0, maxX = stage.width;
    if (img && img.naturalWidth && img.naturalHeight) {
      const imgAspect   = img.naturalWidth / img.naturalHeight;
      const stageAspect = stage.width / stage.height;
      if (stageAspect > imgAspect) {
        // landscape stage + portrait image → letterbox left & right
        const renderedW = stage.height * imgAspect;
        minX = (stage.width - renderedW) / 2;
        maxX = minX + renderedW;
      } else {
        // portrait stage + landscape image → letterbox top & bottom, full width
        const renderedH = stage.width / imgAspect;
        const minY = (stage.height - renderedH) / 2;
        const maxY = minY + renderedH;
        // clamp vertical: if cursor is outside image vertically, still allow horizontal move
        minX = 0; maxX = stage.width;
        void minY; void maxY;
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

  const vidRef = useRef<HTMLVideoElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);

  useEffect(() => { setActiveIdx(0); }, [projectId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && project) close();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [project]);

  const activeItem = project?.media[activeIdx];
  const activeLink = activeItem?.link ?? project?.link;

  useEffect(() => {
    if (!project) return;
    const vid = vidRef.current;
    const img = imgRef.current;
    if (!vid || !img) return;
    const item = project.media[activeIdx];
    if (!item || item.type === 'compare' || !item.url) {
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
      img.src = item.url;
      img.srcset = item.srcSet ?? '';
      img.sizes = item.srcSet ? '(max-width: 768px) 100vw, calc(100vw - 360px)' : '';
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
    if (vid.paused) {
      vid.play().catch(() => {});
    } else {
      vid.pause();
    }
  }

  const close = () => {
    if (onClose) {
      onClose();
    } else {
      setSearchParams(prev => { prev.delete('project'); return prev; });
    }
  };

  return (
    <div
      ref={ref}
      id="vw-overlay"
      className={[(isOpen ?? !!project) ? 'is-open' : '', className ?? ''].join(' ').trim()}
      aria-hidden={!project}
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
      <div className="vw-stage">
        {project && project.media.length === 0 && (
          <span className="vw-no-media">Media coming soon</span>
        )}
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
      </div>
    </div>
  );
});
