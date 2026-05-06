import { useSearchParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { PROJECTS } from '../data/projects';

const CATEGORIES = [
  { key: 'video', label: 'Video'              },
  { key: 'cgi',   label: 'CGI'               },
  { key: 'code',  label: 'Code' },
] as const;

type CatKey = typeof CATEGORIES[number]['key'];

export function List() {
  const [, setSearchParams] = useSearchParams();

  const sorted = [...PROJECTS].sort((a, b) => a.order - b.order);

  const meta = (
    <>
      <span className="dot" />
      <span>{PROJECTS.length} projects</span>
      <span>·</span>
      <span>HAM · 53.55 N</span>
    </>
  );

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
            <tr key={p.id} onClick={() => setSearchParams({ project: p.id })} style={{ cursor: 'pointer' }}>
              <td>{p.idx}</td>
              {CATEGORIES.map(c => {
                const filled = p.axis === (c.key as CatKey);
                return filled ? (
                  <td key={c.key} className="cell--filled">
                    <span className="cell-nm">{p.nm}</span>
                    <span className="cell-yr">{p.yearShort}</span>
                  </td>
                ) : <td key={c.key} />;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </Layout>
  );
}
