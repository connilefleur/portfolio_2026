import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PROJECTS_BY_ID } from '../data/projects';
function mediaLabel(type: 'image' | 'video', typeIdx: number): string {
  const kind = type === 'video' ? 'Video' : 'Image';
  return `${kind} ${String(typeIdx + 1).padStart(3, '0')}`;
}

export function Viewer() {
  const [searchParams, setSearchParams] = useSearchParams();
  const projectId = searchParams.get('project');
  const project = projectId ? PROJECTS_BY_ID[projectId] : null;

  const vidRef = useRef<HTMLVideoElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => { setActiveIdx(0); }, [projectId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && project) close();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [project]);

  useEffect(() => {
    if (!project) return;
    const vid = vidRef.current;
    const img = imgRef.current;
    if (!vid || !img) return;
    const item = project.media[activeIdx];
    if (!item) {
      vid.pause(); vid.removeAttribute('src'); vid.style.display = 'none';
      img.style.display = 'none';
      return;
    }
    if (item.type === 'video') {
      img.style.display = 'none';
      vid.style.display = 'block';
      if (vid.src !== new URL(item.url, location.href).href) vid.src = item.url;
      vid.play().catch(() => {});
    } else {
      vid.pause(); vid.style.display = 'none';
      img.style.display = 'block';
      img.src = item.url;
    }
  }, [activeIdx, project]);

  useEffect(() => {
    if (!project) {
      const vid = vidRef.current;
      if (vid) { vid.pause(); vid.removeAttribute('src'); }
    }
  }, [project]);

  function close() {
    setSearchParams(prev => { prev.delete('project'); return prev; });
  }

  return (
    <div id="vw-overlay" className={project ? 'is-open' : ''} aria-hidden={!project}>
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
          </div>
        )}

        {project && project.media.length > 0 && (
          <div className="vw-media-list">
            {(() => {
              const typeCount: Record<string, number> = {};
              return project.media.map((item, i) => {
                const typeIdx = typeCount[item.type] ?? 0;
                typeCount[item.type] = typeIdx + 1;
                return (
                  <button
                    key={i}
                    className={`vw-media-row${activeIdx === i ? ' vw-media-row--active' : ''}`}
                    onClick={() => setActiveIdx(i)}
                  >
                    <span className="vw-mr-idx">{String(i + 1).padStart(2, '0')}</span>
                    <span className="vw-mr-type">{item.type === 'video' ? 'vid' : 'img'}</span>
                    <span className="vw-mr-label">{mediaLabel(item.type, typeIdx)}</span>
                  </button>
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
        <img ref={imgRef} className="vw-img" alt="" style={{ display: 'none' }} />
        <video ref={vidRef} className="vw-vid" autoPlay muted loop playsInline style={{ display: 'none' }} />
      </div>
    </div>
  );
}
