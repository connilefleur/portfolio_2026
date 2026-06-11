import { Layout } from '../components/Layout';

const TOOLS = [
  {
    id: 'postprocess',
    name: 'Copernicus\nPost Processing',
    desc: 'Temporal denoising, subtractive saturation, film grain, tone mapping and vignette — one COP node. Houdini 20.5+.',
    url: 'https://connilefleur.gumroad.com/l/CopernicusFastPostProcessing',
  },
  {
    id: 'exporter',
    name: 'Copernicus\nFast Exporter',
    desc: 'Single-node render export for COP networks. Replaces the multi-step output chain with format, path and sequence controls in one place.',
    url: 'https://connilefleur.gumroad.com/l/CopernicusFastExporter',
  },
];

export function Tools() {
  return (
    <Layout page="tools" contentClass="content--tools">
      <div className="tools-header">
        <p className="tools-kicker">Pipeline Tools</p>
        <h1 className="tools-title">Free HDAs</h1>
      </div>
      <div className="tools-grid">
        {TOOLS.map(t => (
          <a
            key={t.id}
            className="tool-card"
            href={t.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${t.name.replace('\n', ' ')} — free on Gumroad`}
          >
            <div className="tool-card-inner">
              <div className="tool-card-face tool-card-front">
                <p className="tool-name">{t.name.split('\n').map((line, i) => (
                  <span key={i}>{line}{i === 0 && <br />}</span>
                ))}</p>
                <p className="tool-desc">{t.desc}</p>
                <p className="tool-badge">Free on Gumroad →</p>
              </div>
              <div className="tool-card-face tool-card-back">
                <img src="/projects/hda/images/houdini-badge-w960.webp" alt="Houdini" className="card-logo" />
                <span className="card-cta">Get it free →</span>
              </div>
            </div>
          </a>
        ))}
      </div>
    </Layout>
  );
}
