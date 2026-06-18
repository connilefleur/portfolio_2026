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

const APP_FEATURES = [
  { label: 'Local video calls',      desc: 'Peer-to-peer over WiFi — no internet, no accounts, no data leaving set.' },
  { label: 'Remote phone control',   desc: 'Drive the prop from a second device or a Bluetooth keyboard. Tap, swipe, scroll — all invisible to camera.' },
  { label: 'Production-safe UI',     desc: 'iOS-style and Android-style presets that read as real on camera. No platform logos, no trademark geometry — cleared for broadcast and theatrical use.' },
  { label: 'iOS & Android',          desc: 'Single React Native codebase. Runs natively on both platforms from one build pipeline.' },
];

export function Tools() {
  return (
    <Layout page="tools" contentClass="content--tools">

      {/* ── HDAs ── */}
      <div className="tools-header">
        <p className="tools-kicker">Pipeline Tools</p>
        <h1 className="tools-title">HDAs</h1>
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

      {/* ── Apps ── */}
      <div className="tools-header tools-header--section">
        <p className="tools-kicker">Mobile</p>
        <h2 className="tools-title">Apps</h2>
      </div>
      <div className="app-card">
        <div className="app-card-head">
          <div>
            <p className="app-card-name">ReqPhone</p>
            <p className="app-card-platforms">iOS · Android · React Native</p>
          </div>
          <span className="app-card-status">In Development</span>
        </div>
        <p className="app-card-desc">
          A film prop phone app built for production. Looks like a real smartphone on camera — controlled silently from off-set. Local-network video calls, remote input handling and platform-safe UI presets for use in film, broadcast and commercial production.
        </p>
        <div className="app-features">
          {APP_FEATURES.map(f => (
            <div key={f.label} className="app-feature">
              <span className="app-feature-label">{f.label}</span>
              <span className="app-feature-desc">{f.desc}</span>
            </div>
          ))}
        </div>
        <a className="app-card-contact" href="/contact">Request beta access →</a>
      </div>

    </Layout>
  );
}
