import React, { useEffect, useRef } from 'react';
import type { Project } from '../data/types';
import type { Engine, EngineType } from './canvas/types';
import { makeQuad, mkTex, mkFBO } from './canvas/glUtils';
import { createEffectStack } from './canvas/effects';
import { createTmEngine }       from './canvas/engines/tm';
import { createPhysarumEngine } from './canvas/engines/physarum';
import { createFlowEngine }     from './canvas/engines/flow';

// GL coords: x=0 left, y=0 bottom
// Positions are randomised once per page load: 3×3 zone grid, one project per zone,
// ±7% jitter inside each zone, kept within safe canvas margins.
function generateNodePos(ids: string[]): Record<string, { x: number; y: number }> {
  const cols = [0.20, 0.50, 0.80];
  const rows = [0.76, 0.50, 0.26]; // GL y (0=bottom, 1=top)
  const zones: { x: number; y: number }[] = [];
  for (const y of rows) for (const x of cols) zones.push({ x, y });

  // Fisher-Yates shuffle so a different set of zones is picked each load
  for (let i = zones.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [zones[i], zones[j]] = [zones[j], zones[i]];
  }

  const J = 0.07; // jitter half-range
  const result: Record<string, { x: number; y: number }> = {};
  ids.forEach((id, i) => {
    const z = zones[i % zones.length];
    result[id] = {
      x: Math.max(0.10, Math.min(0.90, z.x + (Math.random() - 0.5) * J * 2)),
      y: Math.max(0.15, Math.min(0.88, z.y + (Math.random() - 0.5) * J * 2)),
    };
  });
  return result;
}

const SIM_SCALE: Record<EngineType, number> = {
  tm:       0.36,
  physarum: 1.00,
  flow:     0.35,
};

interface Props {
  projects: Project[];
  onNodeClick: (id: string) => void;
  engine: EngineType;
  paused?: boolean;
  /** Filled by CanvasView on mount — call .pause() / .resume() to control the RAF loop */
  controlRef?: React.MutableRefObject<CanvasControl | null>;
  fxOn?: boolean;
  dispOn?: boolean;
  fullscreen?: boolean;
  onFrame?: (canvas: HTMLCanvasElement) => void;
}

export interface CanvasControl {
  pause(): void;
  resume(): void;
}

export default function CanvasView({ projects, onNodeClick, engine, paused, controlRef, fxOn, dispOn, fullscreen, onFrame }: Props) {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const labelRefs    = useRef<(HTMLDivElement | null)[]>([]);
  const pausedRef    = useRef(!!paused);
  const onClickRef   = useRef(onNodeClick);
  const mouseTgtRef  = useRef<[number, number]>([0, 0]);   // raw normalised [-1,1]
  const mouseSmRef   = useRef<[number, number]>([0, 0]);   // smoothed
  const hoverNodeRef = useRef<{ x: number; y: number } | null>(null);
  const onFrameRef   = useRef(onFrame);
  const isLightRef   = useRef(typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches);
  const engineRef    = useRef<EngineType>(engine);
  // Updated synchronously on every render — no useEffect delay, no Strict-Mode race
  const desiredEngineRef = useRef<EngineType>(engine);
  desiredEngineRef.current = engine;
  const fxOnRef   = useRef(!!fxOn);
  fxOnRef.current = !!fxOn;
  const dispOnRef   = useRef(!!dispOn);
  dispOnRef.current = !!dispOn;

  // Randomised once per component mount (not per render) — stays stable for the page session
  const nodePosRef  = useRef<Record<string, { x: number; y: number }> | null>(null);
  const restartRef  = useRef<(() => void) | null>(null);
  if (!nodePosRef.current) nodePosRef.current = generateNodePos(projects.map(p => p.id));

  useEffect(() => {
    if (controlRef) return; // controlRef caller manages pause/resume directly
    pausedRef.current = !!paused;
    if (!paused) restartRef.current?.();
  }, [paused, controlRef]);
  useEffect(() => { onClickRef.current = onNodeClick; }, [onNodeClick]);
  useEffect(() => { onFrameRef.current = onFrame; },     [onFrame]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl2', {
      antialias: false, alpha: false, powerPreference: 'high-performance',
    }) as WebGL2RenderingContext | null;
    if (!gl || !gl.getExtension('EXT_color_buffer_float')) return;
    gl.getExtension('OES_texture_float_linear');

    const onMouseMove = (e: MouseEvent) => {
      const nx = (e.clientX / window.innerWidth)  * 2 - 1;  // [-1, 1]
      const ny = (e.clientY / window.innerHeight) * 2 - 1;
      mouseTgtRef.current = [nx, ny];
    };
    window.addEventListener('mousemove', onMouseMove, { passive: true });

    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const onMqChange = (e: MediaQueryListEvent) => { isLightRef.current = e.matches; };
    mq.addEventListener('change', onMqChange);

    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.STENCIL_TEST);

    const { vao, buf } = makeQuad(gl);

    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    let TW = 1, TH = 1;
    const getScale = () => SIM_SCALE[engineRef.current];
    const calcSize = () => {
      const s = getScale();
      TW = Math.max(1, Math.floor(canvas.clientWidth  * s));
      TH = Math.max(1, Math.floor(canvas.clientHeight * s));
    };
    const setCanvasSize = () => {
      canvas.width  = Math.round(canvas.clientWidth  * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
    };

    // ── Text texture at physical (DPR-scaled) display resolution ─────────────
    let textTex: WebGLTexture | null = null;
    const buildTextTex = () => {
      const w = canvas.width  || canvas.clientWidth;
      const h = canvas.height || canvas.clientHeight;
      const oc = document.createElement('canvas');
      oc.width = w; oc.height = h;
      const ctx = oc.getContext('2d')!;
      // 30% larger than before: h * 0.050 (was h * 0.038)
      const fontSize = Math.max(10, Math.round(h * 0.050));
      ctx.font = `900 ${fontSize}px "JetBrains Mono","Arial Black",monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      // text disabled
      if (textTex) gl.deleteTexture(textTex);
      textTex = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, textTex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, oc);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    };

    // ── Wall texture (label rects as TM obstacles) ─────────────────────────────
    let wallTex: WebGLTexture | null = null;
    const nodeRects = new Float32Array(projects.length * 2);

    const measureLabels = () => {
      const cw = canvas.clientWidth  || canvas.width;
      const ch = canvas.clientHeight || canvas.height;
      projects.forEach((_, i) => {
        const el = labelRefs.current[i];
        if (!el) return;
        const r = el.getBoundingClientRect();
        nodeRects[i*2]   = (r.width  / 2) * (TW / cw);
        nodeRects[i*2+1] = (r.height / 2) * (TH / ch);
      });
    };

    const buildWallTex = () => {
      const oc = document.createElement('canvas');
      oc.width = TW; oc.height = TH;
      const ctx = oc.getContext('2d')!;
      ctx.fillStyle = '#000'; ctx.fillRect(0,0,TW,TH);
      ctx.fillStyle = '#fff';
      // Proportional padding — preserves the label's aspect ratio so the clearing
      // is the same shape as the text, just slightly larger on all sides.
      projects.forEach((p,i) => {
        const hw = nodeRects[i*2], hh = nodeRects[i*2+1];
        if (!hw || !hh) return;
        const pos = nodePosRef.current![p.id];
        if (!pos) return;
        const px = hw * 0.85, py = hh * 0.85;  // 85% extra breathing room, aspect-preserving
        ctx.fillRect(pos.x*TW-hw-px, (1-pos.y)*TH-hh-py, (hw+px)*2, (hh+py)*2);
      });
      const id   = ctx.getImageData(0,0,TW,TH);
      const data = new Uint8Array(TW*TH);
      for (let y=0; y<TH; y++) for (let x=0; x<TW; x++)
        data[y*TW+x] = id.data[((TH-1-y)*TW+x)*4] > 64 ? 255 : 0;
      if (wallTex) gl.deleteTexture(wallTex);
      const t = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, TW, TH, 0, gl.RED, gl.UNSIGNED_BYTE, data);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      wallTex = t;
    };

    // ── Engine management ──────────────────────────────────────────────────────
    let currentEngine: Engine | null = null;
    let effects = createEffectStack(gl, vao, TW, TH);

    const buildEngine = (type: EngineType) => {
      if (currentEngine) { currentEngine.destroy(); currentEngine = null; }
      engineRef.current = type;
      calcSize();
      effects.resize(TW, TH);
      const cw = canvas.clientWidth  || canvas.width  / dpr;
      const ch = canvas.clientHeight || canvas.height / dpr;
      const N = projects.length;
      const nodePos = projects.map((p, i) => {
        const pos = nodePosRef.current![p.id];
        let hw = nodeRects[i*2];
        let hh = nodeRects[i*2+1];
        // Fallback when getBoundingClientRect hasn't run yet (first boot timing)
        // Estimate: 9 CSS px per uppercase char + 24px padding, 32px height
        if (!hw || hw < 3) hw = ((p.nm.length * 9 + 24) / 2) * (TW / cw);
        if (!hh || hh < 2) hh = (32 / 2) * (TH / ch);
        // Weight: first project (i=0) → 1.0, last → 0.3, linear
        const weight = N > 1 ? 1 - (i / (N - 1)) * 0.7 : 1;
        return {
          x:  pos?.x ?? 0.5,
          y:  pos?.y ?? 0.5,
          hw: hw / TW,
          hh: hh / TH,
          weight,
        };
      });
      switch (type) {
        case 'tm':       currentEngine = createTmEngine(gl, vao, TW, TH); break;
        case 'physarum': currentEngine = createPhysarumEngine(gl, vao, TW, TH, nodePos); break;
        case 'flow':     currentEngine = createFlowEngine(gl, vao, TW, TH, nodePos); break;
      }
      if (currentEngine.setWallTex && wallTex) currentEngine.setWallTex(wallTex);
    };

    // ── Frame loop ─────────────────────────────────────────────────────────────
    let rafId = 0;

    const frame = (now: number) => {
      if (pausedRef.current || !currentEngine) { rafId = 0; return; }
      rafId = requestAnimationFrame(frame);

      // Handle engine switch (desiredEngineRef updated synchronously on every render)
      if (desiredEngineRef.current !== engineRef.current) {
        buildEngine(desiredEngineRef.current);
        if (!currentEngine) return;
      }

      // Smooth mouse toward target and apply camera tilt (flow engine only)
      const MAX_TILT = 0.08;  // ~4.6 degrees
      const sm = mouseSmRef.current;
      const tgt = mouseTgtRef.current;
      sm[0] += (tgt[0] - sm[0]) * 0.04;
      sm[1] += (tgt[1] - sm[1]) * 0.04;
      currentEngine.setTilt?.(sm[1] * MAX_TILT, sm[0] * MAX_TILT);
      const hn = hoverNodeRef.current;
      currentEngine.setHover?.(hn?.x ?? 0, hn?.y ?? 0, hn !== null);
      // Light mode: veins must reach close to ink (dark) to read as black on light bg.
      // Dark mode: keep dim so veins don't wash out the black background.
      // Dark mode: inverted — bg is a faint grey (what growth *was*), ink = pure black (what bg *was*)
      currentEngine.setBrightness?.(isLightRef.current ? 0.88 : 1.00);

      const fieldTex = currentEngine.step(now);
      if (currentEngine.pollReset?.()) effects.clearAccum();
      if (!fieldTex || !textTex) return;

      const isLight = isLightRef.current;
      const bg  = (isLight ? [0.925, 0.929, 0.945] : [0.07, 0.07, 0.07]) as [number,number,number];
      const ink = (isLight ? [0.051, 0.055, 0.071] : [0.00, 0.00, 0.00]) as [number,number,number];

      const fx   = fxOnRef.current;
      const disp = dispOnRef.current;
      effects.render({
        fieldTex, textTex, wallTex, bg, ink,
        displace:  fx || disp,
        trailStr:  fx ? 0.35 : 0,
        vW: canvas.width, vH: canvas.height,
      });

      onFrameRef.current?.(canvas);
    };

    const restart = () => {
      if (rafId === 0 && !pausedRef.current) rafId = requestAnimationFrame(frame);
    };
    restartRef.current = restart;

    if (controlRef) {
      controlRef.current = {
        pause() {
          cancelAnimationFrame(rafId);
          rafId = 0;
        },
        resume() {
          effects.clearAccum();
          if (rafId === 0) rafId = requestAnimationFrame(frame);
        },
      };
    }

    // ── Resize ─────────────────────────────────────────────────────────────────
    const resize = () => {
      setCanvasSize();
      requestAnimationFrame(() => {
        measureLabels();
        calcSize();
        buildWallTex();
        buildTextTex();
        if (currentEngine) {
          currentEngine.resize(TW, TH);
          if (currentEngine.setWallTex && wallTex) currentEngine.setWallTex(wallTex);
        }
        effects.resize(TW, TH);
      });
    };

    // ── Boot ───────────────────────────────────────────────────────────────────
    // `cancelled` prevents the async sequence from racing with StrictMode double-invocation:
    // cleanup fires before fonts.ready resolves, so we must check before starting any RAF.
    let cancelled = false;
    let booted = false;
    const ro = new ResizeObserver(() => { if (!booted) { booted=true; return; } resize(); });
    ro.observe(canvas);

    (async () => {
      await document.fonts.ready;
      if (cancelled) return;
      setCanvasSize();
      requestAnimationFrame(() => {
        if (cancelled) return;
        measureLabels();
        calcSize();
        buildWallTex();
        buildTextTex();
        buildEngine(desiredEngineRef.current);
        rafId = requestAnimationFrame(frame);
      });
    })();

    return () => {
      cancelled = true;
      restartRef.current = null;
      if (controlRef) controlRef.current = null;
      window.removeEventListener('mousemove', onMouseMove);
      mq.removeEventListener('change', onMqChange);
      cancelAnimationFrame(rafId);
      ro.disconnect();
      currentEngine?.destroy();
      effects.destroy();
      if (textTex) gl.deleteTexture(textTex);
      if (wallTex) gl.deleteTexture(wallTex);
      gl.deleteVertexArray(vao);
      gl.deleteBuffer(buf);
    };
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const rootStyle: React.CSSProperties = fullscreen
    ? { position: 'fixed', inset: 0, zIndex: 0 }
    : { position: 'relative', width: '100%', height: '100%' };

  return (
    <div style={rootStyle}>
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}
      />
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5 }}>
        {projects.map((p, i) => {
          const pos = nodePosRef.current![p.id];
          if (!pos) return null;
          return (
            <div
              key={p.id}
              ref={el => { labelRefs.current[i] = el; }}
              className="nlabel"
              style={{
                left:           `${pos.x * 100}%`,
                top:            `${(1 - pos.y) * 100}%`,
                animationDelay: `${i * 0.64}s`,
                pointerEvents:  'auto',
              }}
              onClick={() => { onClickRef.current(p.id); }}
              onMouseEnter={() => { hoverNodeRef.current = pos; }}
              onMouseLeave={() => { hoverNodeRef.current = null; }}
            >
              <div className="nlabel-row">
                <span className="nm">{p.nm}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
