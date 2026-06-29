import { useEffect, useRef, useState } from 'react';
import { SPLAT_SCENES, VIDEO_FPS } from '../data/splatScenes';
import { TIMELINE } from '../data/sunMattersTimeline';
import { HERO_VIDEO_FULL, basename, videoSrc } from '../data/sunMattersAssets';
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
const WARM_TIMEOUT = 8000;  // ms to reach WARM_MIN before we give up and fall back to full video

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
  const fallbackRef = useRef<HTMLVideoElement>(null);
  const continueRef = useRef<(() => void) | null>(null);
  // the video whose play() was blocked by autoplay policy (iOS Low Power Mode blocks even
  // muted autoplay) — a tap on the play button resumes THIS element within a user gesture.
  const pendingPlayRef = useRef<HTMLVideoElement | null>(null);

  // hover:none → touch device: only changes the look-around hint wording (not the run gate)
  const [isTouch] = useState(() => typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches);
  const [from] = useState(() => Math.max(0, +(new URLSearchParams(location.search).get('from') ?? 0) || 0));
  const [debug] = useState(() => new URLSearchParams(location.search).has('debug'));
  const [phase, setPhase] = useState<Phase>('playing');
  const [dbg, setDbg] = useState('');
  const [err, setErr] = useState('');
  // Runtime fallback: the splat passed the capability probe but never actually painted
  // (warm frames stalled) or threw → drop the segment orchestration and play the full,
  // uncut hero video instead. Guarantees mobile is never stuck on a blank splat.
  const [degraded, setDegraded] = useState(false);
  // autoplay was blocked → show a play button (else stays hidden; desktop autoplays as before)
  const [needsGesture, setNeedsGesture] = useState(false);

  // resolve an original URL to its preloaded blob (or the original if not preloaded)
  const R = (u: string): string => assets[u] ?? u;
  // resolve a base .webm clip to this browser's codec, then to its preloaded blob
  const V = (u: string): string => R(videoSrc(u));

  useEffect(() => {
    if (!splatOk || degraded) return; // fallback path renders a plain video, no orchestration
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
      const back = v === cur ? nxt : cur;
      back.style.zIndex = '1'; back.style.opacity = '0'; // hide the back layer — no stale flash
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

    // play a clip with start ramp-up (resumed clips) + decel to its end, then PIN the hero
    // (last) frame as a PAUSED frame. We deliberately stop ~1 frame short and seek-pin instead
    // of letting the video reach 'ended': iOS Safari does NOT reliably hold an ended video's
    // last frame (it flickers / jumps back a few frames before the splat reveal), but it holds
    // a paused+seeked frame rock-solid. fires onApproach once when entering the decel window.
    const playWithDecel = (v: HTMLVideoElement, rampUp: boolean, onApproach: () => void): Promise<void> =>
      new Promise((resolve) => {
        let approached = false, finished = false, dbgN = 0;
        const t0 = performance.now();
        const stop = (): void => {
          if (finished) return; finished = true;
          cancelAnimationFrame(raf);
          v.removeEventListener('ended', stop);
          v.pause();
          // pin onto the last frame (~half a frame inside duration) so iOS displays it stably
          try { v.currentTime = Math.max(0, (v.duration || 0) - 0.5 / VIDEO_FPS); } catch { /* ignore */ }
          resolve();
        };
        v.addEventListener('ended', stop, { once: true });
        const loop = (): void => {
          if (disposed) { v.removeEventListener('ended', stop); return resolve(); }
          raf = requestAnimationFrame(loop);
          const dur = v.duration || Infinity;
          const remaining = dur - v.currentTime;
          if (!approached && remaining <= warmAt) { approached = true; onApproach(); }
          if (remaining <= 1 / VIDEO_FPS) { stop(); return; } // pin the last frame, skip 'ended'
          let rate = 1;
          if (rampUp) rate = minRate + (1 - minRate) * Math.min(1, (performance.now() - t0) / RESUME_RAMP_MS);
          if (!hardStop && remaining <= decelWindow) rate = Math.min(rate, minRate + (1 - minRate) * (remaining / decelWindow));
          v.playbackRate = Math.min(16, Math.max(RATE_MIN, rate));
          if (debug && ++dbgN % 8 === 0) setDbg(`${cur === v ? 'cur' : 'nxt'} play · t=${v.currentTime.toFixed(2)}/${(v.duration || 0).toFixed(2)} · rate=${rate.toFixed(2)} · warm=${splat?.warmFrames() ?? 0}`);
        };
        v.playbackRate = rampUp ? minRate : 1;
        // autoplay may be blocked (iOS Low Power Mode) → surface a play button bound to this
        // element. The RAF loop keeps running; once the tap resumes playback it advances to end.
        v.play().catch(() => { pendingPlayRef.current = v; setNeedsGesture(true); });
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
    // Crossfade the splat via a COMPOSITOR-driven CSS opacity transition, not a main-thread
    // RAF tween. At the video→splat moment the main thread is busiest (video ending + splat
    // settling), so an RAF tween stalls and the opacity jumps ("splat appears all of a
    // sudden"). A CSS transition runs on the compositor — smooth regardless of main-thread jank.
    const tween = (to: number): Promise<void> =>
      new Promise((res) => {
        const cv = splat?.canvas;
        if (!cv || disposed) return res();
        cv.style.transition = `opacity ${FADE_MS}ms cubic-bezier(.33,0,.2,1)`;
        void cv.offsetWidth;                       // commit current opacity before changing it
        cv.style.opacity = String(to);
        let done = false;
        const finish = (): void => {
          if (done) return; done = true;
          cv.removeEventListener('transitionend', finish);
          cv.style.transition = '';                // clear so later setOpacity(0) is instant
          res();
        };
        cv.addEventListener('transitionend', finish);
        window.setTimeout(finish, FADE_MS + 120);  // safety: transitionend can be dropped
      });
    // resolves true once the splat has painted WARM_MIN frames; false if it never does within
    // WARM_TIMEOUT (the device can't actually render the splat → caller degrades to video).
    const waitWarm = async (): Promise<boolean> => {
      const t0 = performance.now();
      while (!disposed && (splat?.warmFrames() ?? 0) < WARM_MIN) {
        if (performance.now() - t0 > WARM_TIMEOUT) return false;
        await nextFrame();
      }
      return true;
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

      await loadClip(cur, V(clip.src));
      if (disposed) return;
      setFront(cur);
      go('playing');

      // Mount AND warm this stop's splat NOW (hidden at opacity 0), as the clip starts — not
      // at the decel window. The blob is already in memory, but the GPU cold start (upload +
      // first sorts of ~400k splats) can exceed the 1.2s decel lead on mobile, landing the
      // reveal late. Warming over the full clip means it's render-ready (and idle, on-demand)
      // well before the hero frame, so the crossfade is instant. Clips without a stop drop it.
      if (clip.stopSceneId) { ensureSplat(clip.stopSceneId); splat?.setRenderEnabled(true); }
      else { splat?.dispose(); splat = null; splatScene = ''; }

      await playWithDecel(cur, resumed, () => {});
      if (disposed) return;

      if (!clip.stopSceneId) { go('done'); return; } // final clip — just hold the end

      // HOLD: cur is paused on its last frame (= hero frame). Reveal the splat.
      go('holding');
      const warmed = await waitWarm();
      if (disposed) return;
      if (!warmed) { setDegraded(true); return; } // splat won't paint → full-video fallback
      await tween(1);               // splat fades in (sharp) over the held frame
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
      if (next < TIMELINE.length) await loadClip(nxt, V(TIMELINE[next].src));
      if (disposed) return;
      setFront(nxt);                // nxt shows frame-N == held frame → invisible swap
      await tween(0);               // splat fades out → reveals nxt's first frame
      if (disposed) return;
      splat?.setRenderEnabled(false);

      [cur, nxt] = [nxt, cur];      // swap buffers
      start(next, true);            // play the next clip (with start ramp-up)
    };

    const start = (i: number, resumed: boolean): void => {
      runClip(i, resumed).catch((e: unknown) => {
        if (disposed) return;
        if (debug) setErr(String(e instanceof Error ? e.message : e));
        setDegraded(true); // any orchestration/splat failure → full-video fallback
      });
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
  }, [from, splatOk, degraded]);

  // Resume the autoplay-blocked clip within a user gesture, and unlock the other orchestrated
  // element so the rest of the experience plays through without another tap.
  const onPlayTap = (): void => {
    setNeedsGesture(false);
    const v = pendingPlayRef.current;
    v?.play().catch(() => {});
    [vidARef.current, vidBRef.current].forEach((el) => {
      if (el && el !== v) el.play().then(() => el.pause()).catch(() => {});
    });
  };
  const playButton = needsGesture ? (
    <button onClick={onPlayTap} aria-label="Play" style={{
      position: 'absolute', inset: 0, margin: 'auto', zIndex: 7,
      width: 76, height: 76, borderRadius: 999, cursor: 'pointer',
      border: '1px solid rgba(255,255,255,.6)', background: 'rgba(0,0,0,.5)',
      color: '#fff', font: '26px/1 system-ui, sans-serif', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', paddingLeft: 5,
    }}>▶</button>
  ) : null;

  if (!splatOk || degraded) {
    return (
      <div style={{ position: 'absolute', inset: 0, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <video
          ref={fallbackRef}
          src={V(HERO_VIDEO_FULL)}
          muted autoPlay playsInline preload="auto"
          onLoadedData={() => { fallbackRef.current?.play().catch(() => { pendingPlayRef.current = fallbackRef.current; setNeedsGesture(true); }); }}
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
        {playButton}
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
      <div ref={splatBoxRef} style={{ position: 'absolute', inset: 0, touchAction: 'none' }} />

      {(err || (debug && dbg)) && (
        <div style={{ position: 'absolute', top: 8, left: 8, zIndex: 6, padding: '5px 9px', background: 'rgba(0,0,0,.66)', color: err ? '#f99' : '#9fe', font: '11px/1.4 monospace', borderRadius: 4, pointerEvents: 'none', whiteSpace: 'nowrap' }}>{err ? `⚠ ${err}` : dbg}</div>
      )}

      {playButton}

      {showHint && (
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: '7%', zIndex: 5,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
          pointerEvents: 'none', font: '500 15px/1.4 system-ui, sans-serif',
          color: '#fff', textShadow: '0 1px 8px rgba(0,0,0,.6)',
        }}>
          <div style={{ opacity: phase === 'interact' ? 0.85 : 1, transition: 'opacity .3s' }}>
            {phase === 'holding' ? 'Take a look around' : isTouch ? 'Drag to look around the product' : 'Move your cursor to look around the product'}
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
