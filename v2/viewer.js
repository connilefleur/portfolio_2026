// V2 Portfolio Viewer
// Call openViewer('project_id') to open.
(function () {

// ─── PROJECT DATA ─────────────────────────────────────────────────────────────
const LOREM = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.';

const DATA = {
  data_viz: {
    idx: '001', year: '2025', title: 'Thematic Map\nof Germany',
    category: 'Data / Code', client: 'Personal',
    info1h: 'Approach', info1: LOREM,
    info2h: 'Outcome',  info2: LOREM,
    media: [
      '/projects/data_viz/images/data-viz-rop-image1-0001.jpg',
      '/projects/data_viz/images/data-viz-rop-image1-0002.jpg',
      '/projects/data_viz/images/data-viz-rop-image1-0003.jpg',
      '/projects/data_viz/images/data-viz-rop-image1-0004.jpg',
    ],
  },
  e30: {
    idx: '002', year: '2025', title: 'Fat E30',
    category: '3D / CGI', client: 'Personal',
    info1h: 'Approach', info1: LOREM,
    info2h: 'Outcomes', info2: LOREM,
    media: [
      '/projects/e30/images/cars-pressurized-rop-image1-0001.jpg',
      '/projects/e30/images/cars-pressurized-rop-image1-0002.jpg',
      '/projects/e30/images/cars-pressurized-rop-image1-0003.jpg',
      '/projects/e30/images/cars-pressurized-rop-image1-0004.jpg',
    ],
  },
  experiments: {
    idx: '003', year: '2024–26', title: 'Experiments',
    category: '3D / CGI', client: 'Client & Personal',
    info1h: 'Approach', info1: LOREM,
    info2h: 'Outcomes', info2: LOREM,
    media: [
      '/projects/experiments/videos/bubble-burst-dd2b2e4a.mp4',
      '/projects/experiments/videos/ct-scan-339bb785.mp4',
      '/projects/experiments/videos/fluid-image-9040954f.mp4',
      '/projects/experiments/videos/melting-landscapes-4f0ab15d.mp4',
    ],
  },
  ggl: {
    idx: '004', year: '2026', title: 'Anna',
    category: 'Video / Edit', client: 'George, Gina & Lucy',
    info1h: 'Approach', info1: LOREM,
    info2h: 'Outcomes', info2: LOREM,
    media: [
      '/projects/ggl/videos/ggl-christmas-anna-x-ducks-e5e42c08.mp4',
      '/projects/ggl/videos/ggl-christmas-anna-stare-31aa2915.mp4',
      '/projects/ggl/videos/ggl-christmas-annaorange-multibag-6917ac59.mp4',
    ],
  },
  glasses: {
    idx: '005', year: '2025', title: 'Glasses',
    category: '3D / CGI', client: 'Personal',
    info1h: 'Approach', info1: LOREM,
    info2h: 'Outcomes', info2: LOREM,
    media: [
      '/projects/glasses/images/oct-glass-silhuettes-image-0017-shot-002-denoisedbeauty.jpg',
      '/projects/glasses/images/oct-glass-silhuettes-image-0030-shot-004-animation-denoisedbeauty.jpg',
      '/projects/glasses/images/oct-glass-silhuettes-image-0089-shot-1-denoisedbeauty.jpg',
    ],
  },
  kapaunenstrasse: {
    idx: '006', year: '2025', title: 'Kapaunenstraße 55',
    category: 'Arch Vis', client: 'Architekt Steffen Behr',
    info1h: 'Approach', info1: LOREM,
    info2h: 'Outcomes', info2: LOREM,
    media: [
      '/projects/kapaunenstra%C3%9Fe/images/house-01-garden.jpg',
      '/projects/kapaunenstra%C3%9Fe/images/house-02-garden.jpg',
      '/projects/kapaunenstra%C3%9Fe/images/house-06-front.jpg',
      '/projects/kapaunenstra%C3%9Fe/images/house-09-front.jpg',
    ],
  },
  lookbook: {
    idx: '007', year: '2025', title: 'Balletshofer\nFW 2025',
    category: 'Photo', client: 'Balletshofer',
    info1h: 'Approach', info1: LOREM,
    info2h: 'Outcomes', info2: LOREM,
    media: [
      '/projects/lookbook/images/20241213-balletshofer-2024-006-ecom-look01-1037.jpg',
      '/projects/lookbook/images/20241213-balletshofer-2024-006-ecom-look01-1095.jpg',
      '/projects/lookbook/images/20241213-balletshofer-2024-006-ecom-look02-1158.jpg',
      '/projects/lookbook/images/20241213-balletshofer-2024-006-ecom-look04-1409.jpg',
    ],
  },
  shopping_tour: {
    idx: '008', year: '2026', title: 'Shopping Tour',
    category: '3D / CGI', client: 'Personal',
    info1h: 'Approach', info1: LOREM,
    info2h: 'Outcomes', info2: LOREM,
    media: [],
  },
  su7: {
    idx: '009', year: '2026', title: 'Xiaomi SU7 Max',
    category: '3D / CGI', client: 'Personal',
    info1h: 'Approach', info1: LOREM,
    info2h: 'Outcomes', info2: LOREM,
    media: [
      '/projects/su7/images/xaomi-su7-rop-image1-0001.jpg',
      '/projects/su7/images/xaomi-su7-rop-image1-0003.jpg',
      '/projects/su7/images/xaomi-su7-rop-image1-0004.jpg',
    ],
  },
  vfx: {
    idx: '010', year: '2024', title: 'Skrrt Cobain\n— So High',
    category: 'VFX', client: 'Scholz & Friends',
    info1h: 'Approach', info1: LOREM,
    info2h: 'Outcomes', info2: LOREM,
    media: [
      '/projects/vfx/videos/skrtcobain-sohigh-online-v07-h264-1d10d472.mp4',
      '/projects/vfx/videos/sohigh-vfxbd-spktrm-comp-162a9a6e.mp4',
    ],
  },
};

// ─── STYLES ───────────────────────────────────────────────────────────────────
const style = document.createElement('style');
style.textContent = `
#vw-dialog {
  border: 0; padding: 0; margin: 0;
  width: 100vw;  max-width: 100vw;
  height: 100dvh; max-height: 100dvh;
  background: #0c0c0e;
  overflow: hidden;
  font-family: "JetBrains Mono", ui-monospace, Menlo, Consolas, monospace;
  -webkit-font-smoothing: antialiased;
}
#vw-dialog[open] { display: flex; flex-direction: row; }
#vw-dialog::backdrop { background: #0c0c0e; }
#vw-dialog[open] { animation: vw-in 0.12s ease; }
@keyframes vw-in { from { opacity: 0; } to { opacity: 1; } }

/* ── filmstrip ── */
.vw-strip {
  width: 80px; flex-shrink: 0;
  background: #111113;
  border-right: 1px solid #1e1e22;
  overflow-y: auto; overflow-x: hidden;
  display: flex; flex-direction: column;
  gap: 3px; padding: 3px;
  scrollbar-width: thin; scrollbar-color: #2a2a30 transparent;
}

.vw-thumb {
  width: 74px; height: 74px; flex-shrink: 0;
  border: 1px solid transparent;
  padding: 0; cursor: pointer;
  overflow: hidden;
  display: flex; align-items: center; justify-content: center;
}
.vw-thumb img {
  width: 100%; height: 100%;
  object-fit: cover; display: block;
}
.vw-thumb--active  { border-color: #ff4400; }
.vw-thumb:hover:not(.vw-thumb--active) { border-color: #383840; }

/* info thumb — off-white, first slot */
.vw-thumb--info {
  background: #f2f1ec;
  flex-direction: column; gap: 3px;
}
.vw-thumb--info .vw-tidx {
  font-size: 12px; font-weight: 700;
  color: #ff4400; letter-spacing: 0.05em;
}
.vw-thumb--info .vw-tlabel {
  font-size: 7px; font-weight: 500;
  letter-spacing: 0.12em; text-transform: uppercase;
  color: #72716b;
}

/* media thumb — dark */
.vw-thumb--media { background: #1c1c20; }
.vw-thumb-play {
  color: #555; font-size: 18px;
  font-family: sans-serif; pointer-events: none;
}
.vw-thumb--active .vw-thumb-play { color: #ff4400; }

/* ── stage ── */
.vw-stage {
  flex: 1;
  display: flex; align-items: center; justify-content: center;
  background: #0c0c0e;
  overflow: hidden; position: relative;
}

.vw-img {
  max-width: 100%; max-height: 100%;
  object-fit: contain; display: block;
}
.vw-vid {
  max-width: 100%; max-height: 100%;
  display: block;
}

/* ── info slide (full-stage, off-white) ── */
.vw-info-slide {
  position: absolute; inset: 0;
  background: #f2f1ec;
  display: flex; flex-direction: column; justify-content: center;
  padding: 48px 64px;
  overflow-y: auto;
  scrollbar-width: thin; scrollbar-color: #cac9c2 transparent;
}

.vw-is-meta {
  display: flex; align-items: center; gap: 14px;
  margin-bottom: 18px;
}
.vw-is-idx {
  font-size: 9px; color: #ff4400;
  letter-spacing: 0.1em; text-transform: uppercase;
}
.vw-is-cat {
  font-size: 8px; color: #72716b;
  letter-spacing: 0.1em; text-transform: uppercase;
  border: 1px solid #cac9c2; padding: 2px 7px;
}
.vw-is-client {
  font-size: 8px; color: #72716b;
  letter-spacing: 0.1em; text-transform: uppercase;
}

.vw-is-title {
  font-size: clamp(32px, 3.8vw, 62px);
  font-weight: 700; letter-spacing: -0.03em;
  text-transform: uppercase; color: #0c0c0e;
  line-height: 0.93; margin-bottom: 36px;
  white-space: pre-line;
  font-family: "JetBrains Mono", ui-monospace, Menlo, Consolas, monospace;
}

.vw-is-rule {
  height: 1px; background: #cac9c2;
  margin-bottom: 36px;
}

.vw-is-blocks {
  display: grid; grid-template-columns: 1fr 1fr; gap: 48px;
}
.vw-is-block-h {
  font-size: 8px; font-weight: 700;
  letter-spacing: 0.14em; text-transform: uppercase;
  color: #0c0c0e; margin-bottom: 10px;
}
.vw-is-block-p {
  font-size: 10.5px; line-height: 1.75; color: #72716b;
  font-family: "JetBrains Mono", ui-monospace, Menlo, Consolas, monospace;
}

/* ── close button ── */
.vw-close {
  position: absolute; top: 0; right: 0; z-index: 10;
  height: 36px; padding: 0 18px;
  background: #0c0c0e; color: #f2f1ec;
  border: 0; border-left: 1px solid #1e1e22; border-bottom: 1px solid #1e1e22;
  font-family: "JetBrains Mono", ui-monospace, Menlo, Consolas, monospace;
  font-size: 10px; letter-spacing: 0.12em;
  text-transform: uppercase; cursor: pointer;
}
.vw-close:hover { background: #ff4400; color: #fff; border-color: #ff4400; }

/* ── mobile ── */
@media (max-width: 760px) {
  #vw-dialog[open] { flex-direction: column; }
  .vw-strip {
    width: 100%; height: 70px; flex-direction: row;
    border-right: 0; border-bottom: 1px solid #1e1e22;
    order: 2; padding: 4px;
  }
  .vw-thumb { width: 62px; height: 62px; flex-shrink: 0; }
  .vw-stage { order: 1; flex: 1; }
  .vw-info-slide { padding: 28px 24px; justify-content: flex-start; }
  .vw-is-title { font-size: 28px; margin-bottom: 24px; }
  .vw-is-blocks { grid-template-columns: 1fr; gap: 24px; }
  .vw-close { height: 40px; }
}
`;
document.head.appendChild(style);

// ─── DOM ──────────────────────────────────────────────────────────────────────
const dialog = document.createElement('dialog');
dialog.id = 'vw-dialog';
dialog.innerHTML = `
  <div class="vw-strip" id="vw-strip"></div>
  <div class="vw-stage" id="vw-stage">
    <div class="vw-info-slide" id="vw-info-slide" style="display:none"></div>
    <img  class="vw-img" id="vw-img" alt="" style="display:none" />
    <video class="vw-vid" id="vw-vid" autoplay muted loop playsinline style="display:none"></video>
  </div>
  <button class="vw-close" id="vw-close">[ × ]</button>
`;
document.body.appendChild(dialog);

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function isVideo(url) { return /\.(mp4|webm|mov)$/i.test(url); }

function setActiveThumb(index) {
  document.querySelectorAll('.vw-thumb').forEach((el, i) => {
    el.classList.toggle('vw-thumb--active', i === index);
  });
}

function showInfoSlide(p) {
  const infoEl = document.getElementById('vw-info-slide');
  const img    = document.getElementById('vw-img');
  const vid    = document.getElementById('vw-vid');

  vid.pause(); vid.style.display = 'none';
  img.style.display = 'none';

  infoEl.innerHTML = `
    <div class="vw-is-meta">
      <span class="vw-is-idx">${p.idx} · ${p.year}</span>
      <span class="vw-is-cat">${p.category}</span>
      <span class="vw-is-client">${p.client}</span>
    </div>
    <h2 class="vw-is-title">${p.title}</h2>
    <div class="vw-is-rule"></div>
    <div class="vw-is-blocks">
      <div>
        <div class="vw-is-block-h">${p.info1h}</div>
        <p  class="vw-is-block-p">${p.info1}</p>
      </div>
      <div>
        <div class="vw-is-block-h">${p.info2h}</div>
        <p  class="vw-is-block-p">${p.info2}</p>
      </div>
    </div>
  `;
  infoEl.style.display = 'flex';
}

function showMedia(url) {
  const infoEl = document.getElementById('vw-info-slide');
  const img    = document.getElementById('vw-img');
  const vid    = document.getElementById('vw-vid');

  infoEl.style.display = 'none';

  if (isVideo(url)) {
    img.style.display = 'none';
    vid.style.display = 'block';
    if (vid.src !== new URL(url, location.href).href) vid.src = url;
    vid.play().catch(() => {});
  } else {
    vid.pause(); vid.style.display = 'none';
    img.style.display = 'block';
    img.src = url;
  }
}

// ─── BUILD FILMSTRIP ──────────────────────────────────────────────────────────
function buildStrip(p) {
  const strip = document.getElementById('vw-strip');
  strip.innerHTML = '';

  // Slot 0 — info slide thumb
  const infoThumb = document.createElement('button');
  infoThumb.className = 'vw-thumb vw-thumb--info vw-thumb--active';
  infoThumb.innerHTML = `<span class="vw-tidx">${p.idx}</span><span class="vw-tlabel">Info</span>`;
  infoThumb.addEventListener('click', () => { setActiveThumb(0); showInfoSlide(p); });
  strip.appendChild(infoThumb);

  // Slots 1+ — media thumbs
  p.media.forEach((url, i) => {
    const btn = document.createElement('button');
    btn.className = 'vw-thumb vw-thumb--media';
    if (isVideo(url)) {
      btn.innerHTML = '<span class="vw-thumb-play">▶</span>';
    } else {
      const img = document.createElement('img');
      img.src = url; img.alt = ''; img.loading = 'lazy';
      btn.appendChild(img);
    }
    btn.addEventListener('click', () => { setActiveThumb(i + 1); showMedia(url); });
    strip.appendChild(btn);
  });
}

// ─── OPEN / CLOSE ─────────────────────────────────────────────────────────────
window.openViewer = function (id) {
  const p = DATA[id];
  if (!p) return;

  buildStrip(p);
  showInfoSlide(p);   // always open on the info slide

  dialog.showModal();
};

document.getElementById('vw-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
dialog.addEventListener('close', () => {
  const vid = document.getElementById('vw-vid');
  vid.pause(); vid.src = '';
});

})();
