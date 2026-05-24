import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { PROJECTS } from '../data/projects';
import type { Project } from '../data/types';

// Swap full-res image URL for the w960 responsive variant (~150KB vs ~5MB)
function thumbUrl(url: string): string {
  const i    = url.lastIndexOf('/');
  const dir  = url.slice(0, i + 1);
  const file = url.slice(i + 1);
  const dot  = file.lastIndexOf('.');
  return `${dir}_responsive/${file.slice(0, dot)}-w960${file.slice(dot)}`;
}

const CATEGORIES = [
  { key: 'video', label: 'Edit'               },
  { key: 'cgi',   label: 'CGI'               },
  { key: 'code',  label: 'Code' },
] as const;

type CatKey = typeof CATEGORIES[number]['key'];
type Hovered = { project: Project; x: number; y: number } | null;

export function List() {
  const [, setSearchParams] = useSearchParams();
  const [hovered, setHovered]   = useState<Hovered>(null);

  const sorted = [...PROJECTS].sort((a, b) => a.order - b.order);

  const meta = (
    <>
      <span className="dot" />
      <span>{PROJECTS.length} projects</span>
      <span>·</span>
      <span>HAM · 53.55 N</span>
    </>
  );

  const preview = hovered?.project.media[0] ?? null;
  const overlayX = hovered ? Math.min(hovered.x + 22, window.innerWidth  - 328) : 0;
  const overlayY = hovered ? Math.min(hovered.y + 16, window.innerHeight - 208) : 0;

  return (
    <Layout page="list" meta={meta} contentClass="content--list">
      <table className="matrix">
        <thead>
          <tr>
            <th>#</th>
            {CATEGORIES.map(c => <th key={c.key}>{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {sorted.map(p => (
            <tr
              key={p.id}
              style={{ cursor: 'pointer' }}
              onClick={() => setSearchParams({ project: p.id })}
              onMouseEnter={(e) => setHovered({ project: p, x: e.clientX, y: e.clientY })}
              onMouseMove={(e)  => setHovered(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null)}
              onMouseLeave={()  => setHovered(null)}
            >
              <td>{p.idx}</td>
              {CATEGORIES.map(c => {
                const filled = p.axis === (c.key as CatKey);
                return filled ? (
                  <td key={c.key} className="cell--filled">
                    <span className="cell-nm">{p.nm}</span>
                    <span className="cell-yr">{p.yearShort}</span>
                    {p.media[0] && <div className="cell-preview" />}
                  </td>
                ) : <td key={c.key} />;
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {hovered && preview && (
        <div className="list-preview-overlay" style={{ left: overlayX, top: overlayY }}>
          {preview.type === 'image'
            ? <img src={thumbUrl(preview.url)} className="list-preview-asset" alt="" />
            : <video src={preview.url} className="list-preview-asset" muted playsInline preload="metadata" />
          }
        </div>
      )}
    </Layout>
  );
}
