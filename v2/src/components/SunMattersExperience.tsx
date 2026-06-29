import { useEffect, useRef, useState } from 'react';
import { SPLAT_SCENES } from '../data/splatScenes';
import { TIMELINE } from '../data/sunMattersTimeline';
import { HERO_VIDEO_FULL, basename } from '../data/sunMattersAssets';
import { mountSplatViewer, type SplatViewerController } from '../lib/splatViewer';

// Sun Matters interactive experience (segment-based), extracted so it can run BOTH as the
// full-screen /sun-matters route and embedded inside the Viewer overlay. Assets are handed
// in already-downloaded (original URL → blob: URL) by the preloader, so there is no fetch
// here — playback and the splat load both hit the in-memory blobs.
//
// Each clip plays, decelerates, and ENDS on a hero frame — the browser holds that last frame
// (no playback to fight). The splat crossfades in over the held frame, the user parallaxes,
// and on "Continue" the camera homes to the hero pose; the NEXT clip is pre-seeked to its
// first frame (identical to the held frame) and brought up behind the splat, the splat fades
// out, then the next clip starts. Seamless, because every seam sits on the hero frame.

const WARM_LEAD = 1.2;      // s before a clip's end where we warm the splat (GL on)
const DECEL_WINDOW = 0.2;   // s before end where we ramp the speed down (short = crisp stop)
const MIN_RATE = 0.8;       // playbackRate floor at the stop — high = barely slows, no frame-step judder
const RATE_MIN = 0.0625;    // browser hard minimum (Chrome throws below this)
const RESUME_RAMP_MS = 140; // playbackRate MIN→1 at the start of a resumed clip (short = minimal speed-up)
const FADE_MS = 420;        // splat crossfade duration
const WARM_MIN = 6;         // splat frames rendered before we dare reveal

const ease = (x: number): number => x * x * x * (x * (x * 6 - 15) + 10); // smootherstep

type Phase = 'playing' | 'holding' | 'interact' | 'returning' | 'done';

interface Props {
  /** original served URL → blob: URL (preloaded). Falls through to the original if missing. */
  assets: Record<string, string>;
  /** Whether the WebGL splat path can run (else a plain hero video is shown). */
  splatOk: boolean;
}

export function SunMattersExperience({ assets, splatOk }: Props) {
  const splatBoxRef = useRef<HTMLDivElement>(null);
  const vidARef = useRef<HTMLVideoElement>(null);
  const vidBRef = useRef<HTMLVideoElement>(null);
  const continueRef = useRef<(() => void) | null>(null);

  const [from] = useState(() => Math.max(0, +(new URLSearchParams(location.search).get('from') ?? 0) || 0));
  const [debug] = useState(() => new URLSearchParams(location.search).has('debug'));
  const [phase, setPhase] = useState<Phase>('playing');
  const [dbg, setDbg] = useState('');
  const [err, setErr] = useState('');

  // resolve an original URL to its preloaded blob (or the original if not preloaded)
  const R = (u: string): string => assets[u] ?? u;

  useEffect(() => {
    if (!splatOk) return; // fallback path renders a plain video, no orchestration
    const splatBox = splatBoxRef.current;
    const vidA = vidARef.current, vidB = vidBRef.current;
    if (!splatBox || !vidA || !vidB) return;

    // Decel is tunable live via ?decel=<sec>&minrate=<0..1> so the feel can be dialed
    // in-browser without a rebuild. Higher minrate = more abrupt stop.
    const sp = new URLSearchParams(location.search);
    const hardStop = sp.has('hardstop'); // play full speed straight to the end, no ramp-down
    const decelWindow = Math.max(0.15, +(sp.get('decel') ?? '') || DECEL_WINDOW);
    const minRate = Math.min(1, Math.max(RATE_MIN, +(sp.get('minrate') ?? '') || MIN_RATE));
    const warmAt = Math.max(WARM_LEAD, decelWindow);
    // ?splateuler=x,y,z — debug splat orientation (deg) to verify the splat frame against
    // the COLMAP hero poses in-browser, then bake the winning value.
    const splatEuler = ((): [number, number, number] | undefined => {
      const s = sp.get('splateuler'); if (!s) return undefined;
      const a = s.split(',').map(Number);
      return a.length === 3 && a.every((n) => !Number.isNaN(n)) ? [a[0], a[1], a[2]] : undefined;
    })();
    // Render-quality A/B knobs (kept from the debug route):
    //   ?ss=2  supersample · ?aa=0|1 gsplat antiAlias · ?tonemap=none|linear · ?mps=0 minPixelSize
    const ss = +(sp.get('ss') ?? '') || undefined;
    const dprCap = ss && ss > 1 ? Math.ceil((window.devicePixelRatio || 1) * ss) : undefined;
    const aaParam = sp.get('aa');
    const gsplatAntiAlias = aaParam === '0' ? false : aaParam === '1' ? true : undefined;
    const tmParam = sp.get('tonemap');
    const toneMapping = tmParam === 'none' ? 'none' : tmParam === 'linear' ? 'linear' : undefined;
    const mpsParam = sp.get('mps');
    const gsplatMinPixelSize =
      mpsParam !== null && mpsParam !== '' && !Number.isNaN(+mpsParam) ? +mpsParam : undefined;
    let disposed = false;
    let raf = 0;
    let cur = vidA, nxt = vidB;
    let splat: SplatViewerController | null = null;
    let splatScene = '';
    const go = (p: Phase): void => { if (!disposed) setPhase(p); };

    // build a scene with its splat URL resolved to the preloaded blob (+ filename hint)
    const sceneFor = (id: string) => {
      const base = SPLAT_SCENES[id];
      return { ...base, splatUrl: R(base.splatUrl), splatFilename: basename(base.splatUrl) };
    };

    // ---- video helpers ----------------------------------------------------
    const setFront = (v: HTMLVideoElement): void => {
      v.style.zIndex = '2'; v.style.opacity = '1';
      (v === cur ? nxt : cur).style.zIndex = '1';
    };
    // load src, seek to first frame, hold paused — ready to reveal
    const loadClip = (v: HTMLVideoElement, src: string): Promise<void> =>
      new Promise((res, rej) => {
        let done = false;
        const cleanup = (): void => {
          v.removeEventListener('loadeddata', onCanPlay);
          v.removeEventListener('seeked', onReady);
          v.removeEventListener('error', onErr);
        };
        const finish = (): void => { if (done) return; done = true; cleanup(); res(); };
        const onReady = (): void => finish();
        const onCanPlay = (): void => {
          if (v.currentTime === 0 && v.readyState >= 2) { finish(); return; }
          v.addEventListener('seeked', onReady, { once: true });
          v.currentTime = 0;
        };
        const onErr = (): void => { if (done) return; done = true; cleanup(); rej(new Error(`could not load ${src}`)); };
        v.pause();
        v.addEventListener('error', onErr, { once: true });
        if (v.getAttribute('src') !== src) { v.src = src; v.load(); }
        v.addEventListener('loadeddata', onCanPlay, { once: true });
        if (v.readyState >= 2) onCanPlay();
      });

    // play a clip with start ramp-up (resumed clips) + decel to its end;
    // fires onApproach once when entering the decel window; resolves on 'ended'.
    const playWithDecel = (v: HTMLVideoElement, rampUp: boolean, onApproach: () => void): Promise<void> =>
      new Promise((resolve) => {
        let approached = false, dbgN = 0;
        const t0 = performance.now();
        const onEnded = (): void => { cancelAnimationFrame(raf); resolve(); };
        v.addEventListener('ended', onEnded, { once: true });
        const loop = (): void => {
          if (disposed) { v.removeEventListener('ended', onEnded); return resolve(); }
          raf = requestAnimationFrame(loop);
          const dur = v.duration || Infinity;
          const remaining = dur - v.currentTime;
          if (!approached && remaining <= warmAt) { approached = true; onApproach(); }
          let rate = 1;
          if (rampUp) rate = minRate + (1 - minRate) * Math.min(1, (performance.now() - t0) / RESUME_RAMP_MS);
          if (!hardStop && remaining <= decelWindow) rate = Math.min(rate, minRate + (1 - minRate) * (remaining / decelWindow));
          v.playbackRate = Math.min(16, Math.max(RATE_MIN, rate));
          if (debug && ++dbgN % 8 === 0) setDbg(`${cur === v ? 'cur' : 'nxt'} play · t=${v.currentTime.toFixed(2)}/${(v.duration || 0).toFixed(2)} · rate=${rate.toFixed(2)} · warm=${splat?.warmFrames() ?? 0}`);
        };
        v.playbackRate = rampUp ? minRate : 1;
        v.play().catch(() => { /* gesture/interrupt */ });
        raf = requestAnimationFrame(loop);
      });

    // ---- splat helpers ----------------------------------------------------
    const ensureSplat = (sceneId: string): void => {
      if (splatScene === sceneId && splat) return;
      splat?.dispose();
      splat = mountSplatViewer(splatBox, sceneFor(sceneId), {
        renderEnabled: false, splatEuler,
        superSample: ss, dprCap, gsplatAntiAlias, toneMapping, gsplatMinPixelSize,
      });
      splat.canvas.style.zIndex = '3';      // above both videos
      splat.setInputEnabled(false);
      splat.setOpacity(0);
      splatScene = sceneId;
    };
    const nextFrame = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => r()));
    const tween = (fromO: number, to: number): Promise<void> =>
      new Promise((res) => {
        const t0 = performance.now();
        const step = (): void => {
          if (disposed) return res();
          const k = Math.min(1, (performance.now() - t0) / FADE_MS);
          splat?.setOpacity(fromO + (to - fromO) * ease(k));
          if (k < 1) requestAnimationFrame(step); else res();
        };
        step();
      });
    const waitWarm = async (): Promise<void> => {
      while (!disposed && (splat?.warmFrames() ?? 0) < WARM_MIN) await nextFrame();
    };
    const waitAtHero = (): Promise<void> =>
      new Promise((res) => {
        const loop = (): void => {
          if (disposed || splat?.atHero()) return res();
          requestAnimationFrame(loop);
        };
        loop();
      });
    const waitContinue = (): Promise<void> =>
      new Promise((res) => { continueRef.current = res; });

    // ---- main timeline ----------------------------------------------------
    const runClip = async (index: number, resumed: boolean): Promise<void> => {
      if (disposed || index >= TIMELINE.length) { go('done'); return; }
      const clip = TIMELINE[index];

      await loadClip(cur, R(clip.src));
      if (disposed) return;
      setFront(cur);
      go('playing');

      // Preload this stop's splat NOW (silent, no GL). Already in memory (blob) so this is
      // an instant decode rather than a network fetch. Clips without a stop drop any held splat.
      if (clip.stopSceneId) ensureSplat(clip.stopSceneId);
      else { splat?.dispose(); splat = null; splatScene = ''; }

      // warm the splat (start GL) only as we enter the decel window
      await playWithDecel(cur, resumed, () => { splat?.setRenderEnabled(true); });
      if (disposed) return;

      if (!clip.stopSceneId) { go('done'); return; } // final clip — just hold the end

      // HOLD: cur is paused on its last frame (= hero frame). Reveal the splat.
      go('holding');
      await waitWarm();
      if (disposed) return;
      await tween(0, 1);            // splat fades in (sharp) over the held frame
      if (disposed) return;
      splat?.setInputEnabled(true);
      go('interact');

      await waitContinue();         // user clicks Continue
      if (disposed) return;
      splat?.setInputEnabled(false);
      go('returning');
      await waitAtHero();           // camera eases back to the exact hero pose
      if (disposed) return;

      // HANDOFF: pre-seek the next clip to its first frame (== held frame) and bring it up
      // behind the splat, then fade the splat out.
      const next = index + 1;
      if (next < TIMELINE.length) await loadClip(nxt, R(TIMELINE[next].src));
      if (disposed) return;
      setFront(nxt);                // nxt shows frame-N == held frame → invisible swap
      await tween(1, 0);            // splat fades out → reveals nxt's first frame
      if (disposed) return;
      splat?.setRenderEnabled(false);

      [cur, nxt] = [nxt, cur];      // swap buffers
      start(next, true);            // play the next clip (with start ramp-up)
    };

    const start = (i: number, resumed: boolean): void => {
      runClip(i, resumed).catch((e: unknown) => { if (!disposed) setErr(String(e instanceof Error ? e.message : e)); });
    };
    [vidA, vidB].forEach((v) => { v.muted = true; });
    start(from, false);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      continueRef.current = null;
      splat?.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, splatOk]);

  if (!splatOk) {
    return (
      <div style={{ position: 'absolute', inset: 0, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <video
          src={R(HERO_VIDEO_FULL)}
          muted autoPlay playsInline preload="auto"
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
      </div>
    );
  }

  const showHint = phase === 'holding' || phase === 'interact';
  const videoStyle: React.CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'fill', opacity: 0 };
  return (
    <div style={{ position: 'absolute', inset: 0, background: '#000', overflow: 'hidden' }}>
      <video ref={vidARef} muted playsInline preload="auto" style={{ ...videoStyle, zIndex: 1 }} />
      <video ref={vidBRef} muted playsInline preload="auto" style={{ ...videoStyle, zIndex: 1 }} />
      {/* splat canvas mounts here (zIndex set to 3 by the effect), above both videos */}
      <div ref={splatBoxRef} style={{ position: 'absolute', inset: 0 }} />

      {(err || (debug && dbg)) && (
        <div style={{ position: 'absolute', top: 8, left: 8, zIndex: 6, padding: '5px 9px', background: 'rgba(0,0,0,.66)', color: err ? '#f99' : '#9fe', font: '11px/1.4 monospace', borderRadius: 4, pointerEvents: 'none', whiteSpace: 'nowrap' }}>{err ? `⚠ ${err}` : dbg}</div>
      )}

      {showHint && (
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: '7%', zIndex: 5,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
          pointerEvents: 'none', font: '500 15px/1.4 system-ui, sans-serif',
          color: '#fff', textShadow: '0 1px 8px rgba(0,0,0,.6)',
        }}>
          <div style={{ opacity: phase === 'interact' ? 0.85 : 1, transition: 'opacity .3s' }}>
            {phase === 'holding' ? 'Take a look around' : 'Move your cursor to look around the product'}
          </div>
          {phase === 'interact' && (
            <button
              onClick={() => { continueRef.current?.(); }}
              style={{
                pointerEvents: 'auto', cursor: 'pointer',
                padding: '8px 22px', borderRadius: 999, border: '1px solid rgba(255,255,255,.5)',
                background: 'rgba(0,0,0,.45)', color: '#fff', font: 'inherit', backdropFilter: 'blur(6px)',
              }}
            >Continue ▸</button>
          )}
        </div>
      )}
    </div>
  );
}
