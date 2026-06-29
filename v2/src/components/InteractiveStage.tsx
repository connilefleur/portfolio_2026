import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { canRunSplat, preloadUrls, EXPERIENCE_POSTER } from '../data/sunMattersAssets';

// Preloader + host for the Sun Matters interactive experience inside the Viewer stage.
// On mount it downloads every required asset (~15 MB: segment videos + splats, or just the
// fallback hero video on touch / no-WebGL) as blobs, showing a poster + progress bar, then
// lazy-mounts the experience (keeping the PlayCanvas chunk out of the main bundle) and hands
// it the original-URL → blob-URL map. Owns a precise 16:9 box so the splat's aspect matches
// the video exactly, and revokes all object URLs on unmount.

const SunMattersExperience = lazy(() =>
  import('./SunMattersExperience').then((m) => ({ default: m.SunMattersExperience })),
);

// stream a URL into a Blob, reporting 0..1 progress (best-effort: needs Content-Length).
async function fetchBlob(url: string, onFrac: (f: number) => void, signal: AbortSignal): Promise<Blob> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`${res.status} on ${url}`);
  const total = +(res.headers.get('content-length') ?? 0);
  if (!res.body) { const b = await res.blob(); onFrac(1); return b; }
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    if (total) onFrac(Math.min(1, received / total));
  }
  onFrac(1);
  return new Blob(chunks as BlobPart[]);
}

export function InteractiveStage({ poster }: { poster?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const urlsRef = useRef<string[]>([]);          // created object URLs, for revoke on unmount
  const [splatOk] = useState(canRunSplat);
  const [assets, setAssets] = useState<Record<string, string> | null>(null);
  const [progress, setProgress] = useState(0);
  const [err, setErr] = useState('');
  const [box, setBox] = useState({ w: 0, h: 0 });

  // measure a 16:9 contain box within the stage
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const cw = el.clientWidth, ch = el.clientHeight;
      if (!cw || !ch) return;
      const ar = 16 / 9;
      let w = cw, h = cw / ar;
      if (h > ch) { h = ch; w = ch * ar; }
      setBox({ w: Math.round(w), h: Math.round(h) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // download everything, build the blob map
  useEffect(() => {
    const ac = new AbortController();
    const urls = preloadUrls(splatOk);
    const fracs = new Array(urls.length).fill(0);
    const tick = () => setProgress(fracs.reduce((a, b) => a + b, 0) / urls.length);
    (async () => {
      try {
        const blobs = await Promise.all(
          urls.map((u, i) => fetchBlob(u, (f) => { fracs[i] = f; tick(); }, ac.signal)),
        );
        if (ac.signal.aborted) return;
        const map: Record<string, string> = {};
        urls.forEach((u, i) => {
          const obj = URL.createObjectURL(blobs[i]);
          urlsRef.current.push(obj);
          map[u] = obj;
        });
        setAssets(map);
      } catch (e) {
        if (!ac.signal.aborted) setErr(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      ac.abort();
      urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
      urlsRef.current = [];
    };
  }, [splatOk]);

  const pct = Math.round(progress * 100);
  const ready = assets && box.w > 0;

  return (
    <div ref={wrapRef} style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
      <div style={{ position: 'relative', width: box.w || '100%', height: box.h || '100%', background: '#000', overflow: 'hidden' }}>
        {/* poster sits behind everything until the experience paints */}
        <img
          src={poster ?? EXPERIENCE_POSTER}
          alt=""
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: ready ? 0 : 0.5, transition: 'opacity .4s' }}
        />

        {ready && (
          <Suspense fallback={null}>
            <SunMattersExperience assets={assets} splatOk={splatOk} />
          </Suspense>
        )}

        {!ready && !err && (
          <div style={{
            position: 'absolute', left: 0, right: 0, bottom: '12%', zIndex: 4,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
            pointerEvents: 'none', color: '#fff', font: '500 13px/1.4 system-ui, sans-serif',
            textShadow: '0 1px 8px rgba(0,0,0,.7)',
          }}>
            <div>Loading experience · {pct}%</div>
            <div style={{ width: 'min(56%, 320px)', height: 3, borderRadius: 2, background: 'rgba(255,255,255,.18)', overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: '#fff', transition: 'width .15s linear' }} />
            </div>
          </div>
        )}

        {err && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f99', font: '12px/1.5 monospace', padding: 16, textAlign: 'center' }}>
            ⚠ Could not load the experience<br />{err}
          </div>
        )}
      </div>
    </div>
  );
}
