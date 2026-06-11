import { useEffect, useRef, useState, useReducer } from 'react';
import type { Project } from '../data/types';

// GL coords: x=0 left, y=0 bottom
const NODE_POS: Record<string, { x: number; y: number }> = {
  e30:     { x: 0.50, y: 0.76 },
  glasses: { x: 0.20, y: 0.58 },
  reel:    { x: 0.80, y: 0.58 },
  vfx:     { x: 0.28, y: 0.26 },
  dataviz:      { x: 0.72, y: 0.26 },
  'sun-matters': { x: 0.50, y: 0.42 },
  hda:           { x: 0.72, y: 0.76 },
};

interface Props {
  projects: Project[];
  onNodeClick: (id: string) => void;
  paused?: boolean;
}

const SIM_SCALE   = 1.0;
const SUBSTEPS    = 8;
const PACE_PERIOD = 1100;
const PACE_WIN    = 300;

// Saturation cycle: run full speed for ACTIVE_MS, then cool down for (CYCLE_MS - ACTIVE_MS)
const ACTIVE_MS = 55_000;
const CYCLE_MS  = 80_000;

const P_INIT = {
  eps: 0.060, a: 0.72, b: 0.022,
  Du: 0.19, dt: 0.18,
  chaos: 0.70, noise: 3.5,
};

// Incommensurate sine drift — narrowed ranges for calmer wander
const A_LO = 0.68, A_HI = 1.02;
const DRIFT_FREQS = [0.000582, 0.000358, 0.000228, 0.000147];
const DRIFT_AMPS  = [0.50, 0.28, 0.14, 0.08];

const C_LO = 0.52, C_HI = 0.72;
const CHAOS_FREQS = [0.000178, 0.000108, 0.000274, 0.0000668];
const CHAOS_AMPS  = [0.50, 0.28, 0.14, 0.08];

const DU_LO = 0.14, DU_HI = 0.24;
const DU_FREQS = [0.000243, 0.000157, 0.000391, 0.0000923];
const DU_AMPS  = [0.50, 0.28, 0.14, 0.08];

const B_LO = 0.015, B_HI = 0.035;
const B_FREQS = [0.000517, 0.000821, 0.001303, 0.000334];
const B_AMPS  = [0.50, 0.28, 0.14, 0.08];

function driftVal(freqs: number[], amps: number[], now: number): number {
  const norm = amps.reduce((s, a) => s + a, 0);
  let v = 0;
  for (let i = 0; i < freqs.length; i++)
    v += amps[i] * Math.sin(2 * Math.PI * freqs[i] * now);
  return v / norm; // -1..+1
}

const QUAD_VS = `#version 300 es
layout(location=0) in vec2 aPos;
out vec2 vUv;
void main() { vUv = aPos*0.5+0.5; gl_Position = vec4(aPos,0,1); }`;

const REACT_FS = `#version 300 es
precision highp float;
uniform sampler2D uState;
uniform sampler2D uWall;
uniform float uEps, uA, uB, uDu, uDt;
uniform float uChaos;
uniform float uNoiseScale;
uniform float uTime;
uniform vec2  uNodes[8];
uniform int   uNC;
uniform int   uHoverIdx;
uniform vec2  uMouseUV;
uniform int   uMouseActive;
in vec2 vUv;
out vec4 fragColor;

float hash2(vec2 p) {
  p = fract(p * vec2(127.34, 311.71));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f*f*(3.0 - 2.0*f);
  return mix(
    mix(hash2(i),           hash2(i+vec2(1,0)), u.x),
    mix(hash2(i+vec2(0,1)), hash2(i+vec2(1,1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * vnoise(p); p = p * 2.13 + vec2(1.7, 9.2); a *= 0.5; }
  return v;
}

void main() {
  if (texture(uWall, vUv).r > 0.5) { fragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }

  vec2 sz     = vec2(textureSize(uState, 0));
  vec2 fragPx = vUv * sz;

  // Single center pacemaker — disk at screen center
  if (uNC > 0) {
    float pperiod = float(${PACE_PERIOD});
    float pwin    = float(${PACE_WIN});
    float phase   = mod(uTime, pperiod);
    if (phase < pwin) {
      float dist = length(fragPx - vec2(0.5) * sz);
      if (dist < 14.0) {
        fragColor = vec4(1.0, 0.0, 0.0, 1.0); return;
      }
    }
  }

  vec2  px = 1.0 / sz;
  float u  = texture(uState, vUv).r;
  float v  = texture(uState, vUv).g;

  // Anisotropic diffusion via independent FBMs
  vec2 nUV = vUv * uNoiseScale;
  float nx = fbm(nUV);
  float ny = fbm(nUV + vec2(5.37, 11.83));
  float duX = uDu * mix(1.0, 0.15 + 1.70 * nx, uChaos);
  float duY = uDu * mix(1.0, 0.15 + 1.70 * ny, uChaos);

  // Zero-flux Laplacian — wall neighbours reflected
  vec2 p1 = vec2(px.x, 0.0), p2 = vec2(0.0, px.y);
  float uR = mix(texture(uState, vUv+p1).r, u, step(0.5, texture(uWall, vUv+p1).r));
  float uL = mix(texture(uState, vUv-p1).r, u, step(0.5, texture(uWall, vUv-p1).r));
  float uU = mix(texture(uState, vUv+p2).r, u, step(0.5, texture(uWall, vUv+p2).r));
  float uD = mix(texture(uState, vUv-p2).r, u, step(0.5, texture(uWall, vUv-p2).r));
  float lap_u = duX*(uR + uL - 2.0*u) + duY*(uU + uD - 2.0*u);

  float vR = mix(texture(uState, vUv+p1).g, v, step(0.5, texture(uWall, vUv+p1).r));
  float vL = mix(texture(uState, vUv-p1).g, v, step(0.5, texture(uWall, vUv-p1).r));
  float vU = mix(texture(uState, vUv+p2).g, v, step(0.5, texture(uWall, vUv+p2).r));
  float vD = mix(texture(uState, vUv-p2).g, v, step(0.5, texture(uWall, vUv-p2).r));
  float lap_v = uDu * 0.08 * (vR + vL + vU + vD - 4.0*v);

  // Spatial ε and a variation via FBM
  float nEps    = fbm(vUv * uNoiseScale * 0.85 + vec2(3.1, 7.4));
  float epsLocal = uEps * mix(1.0, 0.50 + 1.00 * nEps, uChaos);

  float nA     = fbm(vUv * uNoiseScale * 1.1 + vec2(21.0, 4.5));
  float aLocal = uA * mix(1.0, 0.75 + 0.50 * nA, uChaos);

  // Barkley reaction
  float thresh = (v + uB) / aLocal;
  float du = (1.0/epsLocal) * u*(1.0-u)*(u - thresh) + lap_u;
  float dv = u - v + lap_v;

  // Local dt boost near hovered node
  float localDt = uDt;
  if (uHoverIdx >= 0) {
    float hd = length(fragPx - uNodes[uHoverIdx] * sz);
    localDt = uDt * mix(3.9, 1.0, smoothstep(54.0, 288.0, hd));
  }

  float outU = clamp(u + localDt*du, 0.0, 1.0);
  float outV = clamp(v + localDt*dv, 0.0, 1.0);

  // Mouse attractor: deplete inhibitor (v) near cursor so existing waves
  // preferentially extend into that region — grows toward the mouse, not from it
  if (uMouseActive > 0) {
    float md      = length(fragPx - uMouseUV * sz);
    float attract = smoothstep(90.0, 0.0, md);
    outV = max(0.0, outV - attract * 0.28);
  }

  fragColor = vec4(outU, outV, 0.0, 1.0);
}`;

const DISPLAY_FS = `#version 300 es
precision highp float;
uniform sampler2D uState;
uniform sampler2D uWall;
uniform float uBlurPx;
uniform vec3 uBg;
in vec2 vUv;
out vec4 fragColor;

vec2 bilinear(vec2 uv) {
  vec2 sz = vec2(textureSize(uState, 0));
  vec2 px = uv*sz - 0.5; vec2 f = fract(px);
  vec2 b  = (floor(px)+0.5)/sz; vec2 s = 1.0/sz;
  vec2 tl = texture(uState, b).rg;
  vec2 tr = texture(uState, b+vec2(s.x,0)).rg;
  vec2 bl = texture(uState, b+vec2(0,s.y)).rg;
  vec2 br = texture(uState, b+s).rg;
  return mix(mix(tl,tr,f.x), mix(bl,br,f.x), f.y);
}

vec2 gaussianBlur(vec2 uv) {
  vec2 step = uBlurPx / vec2(textureSize(uState, 0));
  vec2 acc = vec2(0.0);
  acc += bilinear(uv + vec2(-step.x, -step.y)) * 0.0625;
  acc += bilinear(uv + vec2(    0.0, -step.y)) * 0.1250;
  acc += bilinear(uv + vec2( step.x, -step.y)) * 0.0625;
  acc += bilinear(uv + vec2(-step.x,     0.0)) * 0.1250;
  acc += bilinear(uv                         ) * 0.2500;
  acc += bilinear(uv + vec2( step.x,     0.0)) * 0.1250;
  acc += bilinear(uv + vec2(-step.x,  step.y)) * 0.0625;
  acc += bilinear(uv + vec2(    0.0,  step.y)) * 0.1250;
  acc += bilinear(uv + vec2( step.x,  step.y)) * 0.0625;
  return acc;
}

float ringFn(float u) {
  return smoothstep(0.04, 0.30, u) * (1.0 - smoothstep(0.40, 0.78, u));
}

void main() {
  vec2  st = gaussianBlur(vUv);
  float u  = st.r, v = st.g;

  vec3 bg  = uBg;
  vec3 rim = vec3(0.12, 0.30, 0.72);

  // Ring: bright at wavefront border, dark inside excited region
  float ring = ringFn(u);
  ring = pow(ring, 0.55); // flatten peak → wider visible border

  // Very faint interior fill so blobs have a subtle body
  float fill = smoothstep(0.42, 0.92, u) * 0.06;

  // Collision boost: sample ring value at 4 neighbours (~10px away)
  // Two approaching fronts overlap in the blurred field → both ring & neighbour high
  vec2 sz  = vec2(textureSize(uState, 0));
  vec2 off = 10.0 / sz;
  float rN = ringFn(texture(uState, vUv + vec2(0,      off.y)).r);
  float rS = ringFn(texture(uState, vUv - vec2(0,      off.y)).r);
  float rE = ringFn(texture(uState, vUv + vec2(off.x,  0    )).r);
  float rW = ringFn(texture(uState, vUv - vec2(off.x,  0    )).r);
  float neighbor = max(max(rN, rS), max(rE, rW));
  float collision = ring * neighbor;

  float eu = clamp(ring * 0.72 + fill + collision * 0.40, 0.0, 1.0);

  vec2 uv2 = vUv - 0.5;
  float vig = clamp(1.0 - dot(uv2, uv2) * 1.0, 0.0, 1.0);
  vec3 col = mix(bg, mix(bg, rim, eu), vig);

  if (texture(uWall, vUv).r > 0.5) col = uBg;
  fragColor = vec4(col, 1.0);
}`;

export default function PhysarumCanvas({ projects, onNodeClick, paused }: Props) {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const labelRefs   = useRef<(HTMLDivElement | null)[]>([]);
  const projectsRef = useRef(projects);
  const onClickRef  = useRef(onNodeClick);
  const hoverIdx    = useRef(-1);
  const pausedRef   = useRef(!!paused);
  const isLightRef  = useRef(typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches);
  const mousePosRef = useRef({ x: -1, y: -1, on: false });

  // Debug panel — live param refs readable/writable by both the frame loop and the UI
  const pRef    = useRef({ ...P_INIT });
  const loRef   = useRef({ a: A_LO, chaos: C_LO, Du: DU_LO, b: B_LO });
  const hiRef   = useRef({ a: A_HI, chaos: C_HI, Du: DU_HI, b: B_HI });
  const lockRef = useRef({ a: false, chaos: false, Du: false, b: false });
  const blurRef = useRef(8.0);
  const [debugOpen, setDebugOpen] = useState(false);
  const [, forceUpdate] = useReducer((n: number) => n + 1, 0);

  useEffect(() => { projectsRef.current = projects; }, [projects]);
  useEffect(() => { onClickRef.current = onNodeClick; }, [onNodeClick]);
  useEffect(() => { pausedRef.current = !!paused; }, [paused]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl2', {
      antialias: false, alpha: false, powerPreference: 'high-performance',
    }) as WebGL2RenderingContext | null;
    if (!gl || !gl.getExtension('EXT_color_buffer_float')) return;

    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const onMqChange = (e: MediaQueryListEvent) => { isLightRef.current = e.matches; };
    mq.addEventListener('change', onMqChange);

    const onMouseMove = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      mousePosRef.current = {
        x: (e.clientX - r.left) / r.width,
        y: 1 - (e.clientY - r.top) / r.height,
        on: true,
      };
    };
    const onMouseLeave = () => { mousePosRef.current.on = false; };
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseleave', onMouseLeave);

    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.STENCIL_TEST);

    let TW = 1, TH = 1;
    const setSize = () => {
      canvas.width  = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
      TW = Math.max(1, Math.floor(canvas.width  * SIM_SCALE));
      TH = Math.max(1, Math.floor(canvas.height * SIM_SCALE));
    }

    // ── GL helpers ──────────────────────────────────────────────────────────
    const mkShader = (type: number, src: string): WebGLShader => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
        throw new Error(gl.getShaderInfoLog(s) ?? 'shader compile error');
      return s;
    }
    const mkProg = (vs: string, fs: string): WebGLProgram => {
      const p = gl.createProgram()!;
      gl.attachShader(p, mkShader(gl.VERTEX_SHADER, vs));
      gl.attachShader(p, mkShader(gl.FRAGMENT_SHADER, fs));
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS))
        throw new Error(gl.getProgramInfoLog(p) ?? 'program link error');
      return p;
    }
    const mkTex = (
      w: number, h: number,
      ifmt: number, fmt: number, type: number,
      data: ArrayBufferView | null,
    ): WebGLTexture => {
      const t = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, ifmt, w, h, 0, fmt, type, data);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    }
    const mkFBO = (tex: WebGLTexture): WebGLFramebuffer => {
      const f = gl.createFramebuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, f);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return f;
    }
    const u1f = (p: WebGLProgram, n: string, v: number) =>
      gl.uniform1f(gl.getUniformLocation(p, n), v);
    const u1i = (p: WebGLProgram, n: string, v: number) =>
      gl.uniform1i(gl.getUniformLocation(p, n), v);
    const bindTex = (unit: number, tex: WebGLTexture) => {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, tex);
    };

    // ── Programs & geometry ─────────────────────────────────────────────────
    const pReact   = mkProg(QUAD_VS, REACT_FS);
    const pDisplay = mkProg(QUAD_VS, DISPLAY_FS);

    const quadVAO = gl.createVertexArray()!;
    const quadBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    gl.bindVertexArray(quadVAO);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    // ── Node data (built once from projects prop) ────────────────────────────
    const projs       = projectsRef.current;
    const nodeUVs   = new Float32Array(8 * 2);
    const nodeRects = new Float32Array(8 * 2);
    projs.forEach((p, i) => {
      const pos = NODE_POS[p.id] ?? { x: 0.5, y: 0.5 };
      nodeUVs[i * 2]     = pos.x;
      nodeUVs[i * 2 + 1] = pos.y;
    });

    // ── Simulation state ────────────────────────────────────────────────────
    let rdTex: [WebGLTexture | null, WebGLTexture | null] = [null, null];
    let rdFBO: [WebGLFramebuffer | null, WebGLFramebuffer | null] = [null, null];
    let wallTex: WebGLTexture | null = null;
    let rd = 0;
    let wasInCooldown = false;

    const measureLabels = () => {
      const cw = canvas.clientWidth  || canvas.width;
      const ch = canvas.clientHeight || canvas.height;
      projs.forEach((_, i) => {
        const el = labelRefs.current[i];
        if (!el) return;
        const r = el.getBoundingClientRect();
        nodeRects[i * 2]     = (r.width  / 2) * (TW / cw);
        nodeRects[i * 2 + 1] = (r.height / 2) * (TH / ch);
      });
    }

    const buildWallTex = () => {
      const oc = document.createElement('canvas');
      oc.width = TW; oc.height = TH;
      const ctx = oc.getContext('2d')!;
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, TW, TH);
      ctx.fillStyle = '#fff';
      // Label rectangle obstacles — sim cannot enter button areas
      projs.forEach((p, i) => {
        const hw = nodeRects[i * 2];
        const hh = nodeRects[i * 2 + 1];
        if (hw === 0 || hh === 0) return;
        const pos = NODE_POS[p.id] ?? { x: 0.5, y: 0.5 };
        const cx = pos.x * TW;
        const cy = (1 - pos.y) * TH; // CSS y=0 top
        ctx.fillRect(cx - hw, cy - hh, hw * 2, hh * 2);
      });
      // Y-flip for GL (GL y=0 bottom)
      const id   = ctx.getImageData(0, 0, TW, TH);
      const data = new Uint8Array(TW * TH);
      for (let y = 0; y < TH; y++)
        for (let x = 0; x < TW; x++)
          data[y * TW + x] = id.data[((TH - 1 - y) * TW + x) * 4] > 64 ? 255 : 0;
      if (wallTex) gl.deleteTexture(wallTex);
      wallTex = mkTex(TW, TH, gl.R8, gl.RED, gl.UNSIGNED_BYTE, data);
    }

    const seedInitial = (): Float32Array => {
      const d = new Float32Array(TW * TH * 2);
      for (let i = 0; i < TW * TH; i++) d[i * 2] = Math.random() * 0.008;
      const cx = Math.round(0.5 * TW);
      const cy = Math.round(0.5 * TH);
      const R  = 14;
      for (let py = cy - R; py <= cy + R; py++) {
        for (let px = cx - R; px <= cx + R; px++) {
          if (px < 0 || px >= TW || py < 0 || py >= TH) continue;
          if ((px - cx) ** 2 + (py - cy) ** 2 <= R * R)
            d[(py * TW + px) * 2] = 1.0;
        }
      }
      return d;
    }

    const initTextures = () => {
      for (let i = 0; i < 2; i++) {
        if (rdTex[i]) { gl.deleteTexture(rdTex[i]); gl.deleteFramebuffer(rdFBO[i]); }
      }
      const seed = seedInitial();
      rdTex[0] = mkTex(TW, TH, gl.RG32F, gl.RG, gl.FLOAT, seed);
      rdFBO[0] = mkFBO(rdTex[0]);
      rdTex[1] = mkTex(TW, TH, gl.RG32F, gl.RG, gl.FLOAT, null);
      rdFBO[1] = mkFBO(rdTex[1]);
      gl.bindFramebuffer(gl.FRAMEBUFFER, rdFBO[1]);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      rd = 0;
    }

    // ── Drift state — P is now pRef.current, shared with debug UI ───────────

    // ── Frame loop ──────────────────────────────────────────────────────────
    let rafId = 0;

    const frame = (now: number) => {
      rafId = requestAnimationFrame(frame);
      if (pausedRef.current) return;

      // Saturation cycle: cap GPU work once sim fills the screen
      const cyclePhase   = now % CYCLE_MS;
      const inCooldown   = cyclePhase >= ACTIVE_MS;
      const curSubsteps  = inCooldown ? 1 : SUBSTEPS;
      const curNC        = inCooldown ? 0 : projs.length;
      if (wasInCooldown && !inCooldown) initTextures(); // fresh start each cycle
      wasInCooldown = inCooldown;

      // Drift parameters — skipped per-param when locked by debug panel
      const p  = pRef.current;
      const lo = loRef.current;
      const hi = hiRef.current;
      const lk = lockRef.current;

      if (!lk.a) {
        const vA = driftVal(DRIFT_FREQS, DRIFT_AMPS, now);
        p.a = lo.a + Math.pow(vA * 0.5 + 0.5, 0.32) * (hi.a - lo.a);
      }
      if (!lk.chaos) {
        const vC = driftVal(CHAOS_FREQS, CHAOS_AMPS, now);
        p.chaos = lo.chaos + Math.pow(vC * 0.5 + 0.5, 0.6) * (hi.chaos - lo.chaos);
      }
      if (!lk.Du) {
        const vDu = driftVal(DU_FREQS, DU_AMPS, now);
        p.Du = lo.Du + (vDu * 0.5 + 0.5) * (hi.Du - lo.Du);
      }
      if (!lk.b) {
        const vB = driftVal(B_FREQS, B_AMPS, now);
        p.b = lo.b + (vB * 0.5 + 0.5) * (hi.b - lo.b);
      }

      if (!wallTex || !rdTex[0] || !rdTex[1] || !rdFBO[0] || !rdFBO[1]) return;

      gl.bindVertexArray(quadVAO);

      // RD substeps
      gl.useProgram(pReact);
      u1f(pReact, 'uEps',        p.eps);
      u1f(pReact, 'uA',          p.a);
      u1f(pReact, 'uB',          p.b);
      u1f(pReact, 'uDu',         p.Du);
      u1f(pReact, 'uChaos',      p.chaos);
      u1f(pReact, 'uNoiseScale', p.noise);
      u1f(pReact, 'uTime',       now);
      u1f(pReact, 'uDt',         p.dt);
      u1i(pReact, 'uNC',         curNC);
      u1i(pReact, 'uHoverIdx',   hoverIdx.current);
      const mp = mousePosRef.current;
      gl.uniform2f(gl.getUniformLocation(pReact, 'uMouseUV'), mp.x, mp.y);
      u1i(pReact, 'uMouseActive', mp.on ? 1 : 0);
      u1i(pReact, 'uState',      0);
      u1i(pReact, 'uWall',       1);
      gl.uniform2fv(gl.getUniformLocation(pReact, 'uNodes'), nodeUVs);
      bindTex(1, wallTex);

      for (let s = 0; s < curSubsteps; s++) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, rdFBO[1 - rd]!);
        gl.viewport(0, 0, TW, TH);
        bindTex(0, rdTex[rd]!);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        rd = 1 - rd;
      }

      // Display pass
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(pDisplay);
      bindTex(0, rdTex[rd]!); u1i(pDisplay, 'uState', 0);
      bindTex(1, wallTex);    u1i(pDisplay, 'uWall',  1);
      u1f(pDisplay, 'uBlurPx', blurRef.current);
      const bg = isLightRef.current
        ? [0.925, 0.929, 0.945] as const  // #ecedf1
        : [0.000, 0.000, 0.000] as const; // #000000
      gl.uniform3f(gl.getUniformLocation(pDisplay, 'uBg'), bg[0], bg[1], bg[2]);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    // ── Resize ──────────────────────────────────────────────────────────────
    const resize = () => {
      setSize();
      requestAnimationFrame(() => {
        measureLabels();
        buildWallTex();
        initTextures();
      });
    }

    // First RO callback fires immediately on observe() — skip it, let boot handle init
    let booted = false;
    const ro = new ResizeObserver(() => {
      if (!booted) { booted = true; return; }
      resize();
    });
    ro.observe(canvas);

    // ── Boot ────────────────────────────────────────────────────────────────
    (async () => {
      await document.fonts.ready;
      setSize();
      requestAnimationFrame(() => {
        measureLabels();
        buildWallTex();
        initTextures();
        rafId = requestAnimationFrame(frame);
      });
    })();

    return () => {
      mq.removeEventListener('change', onMqChange);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseleave', onMouseLeave);
      cancelAnimationFrame(rafId);
      ro.disconnect();
      rdTex.forEach(t => { if (t) gl.deleteTexture(t); });
      rdFBO.forEach(f => { if (f) gl.deleteFramebuffer(f); });
      if (wallTex) gl.deleteTexture(wallTex);
      gl.deleteVertexArray(quadVAO);
      gl.deleteBuffer(quadBuf);
      gl.deleteProgram(pReact);
      gl.deleteProgram(pDisplay);
    };
  }, []);

  // Poll live param values into React state so debug sliders stay in sync
  useEffect(() => {
    if (!debugOpen) return;
    const id = setInterval(() => forceUpdate(), 80);
    return () => clearInterval(id);
  }, [debugOpen]);

  /* ── Debug panel helpers ────────────────────────────────────────────────── */
  type DriftKey = keyof typeof loRef.current;

  const DRIFT_PARAMS: { k: DriftKey; label: string; min: number; max: number; step: number }[] = [
    { k: 'a',     label: 'a',     min: 0.30,  max: 1.50,  step: 0.005 },
    { k: 'chaos', label: 'chaos', min: 0.00,  max: 1.00,  step: 0.005 },
    { k: 'Du',    label: 'Du',    min: 0.05,  max: 0.45,  step: 0.002 },
    { k: 'b',     label: 'b',     min: 0.005, max: 0.08,  step: 0.001 },
  ];

  const STATIC_PARAMS: { k: keyof typeof P_INIT; label: string; min: number; max: number; step: number }[] = [
    { k: 'eps',   label: 'eps',   min: 0.01, max: 0.20, step: 0.001 },
    { k: 'dt',    label: 'dt',    min: 0.05, max: 0.35, step: 0.005 },
    { k: 'noise', label: 'noise', min: 0.5,  max: 10.0, step: 0.1   },
  ];

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}
      />
      {/* connilefleur rendered in bg colour — mycelium flows under it, text reads as a cutout */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        fontFamily: 'var(--code)', fontSize: '52px', fontWeight: 800,
        color: 'var(--bg)',
        whiteSpace: 'nowrap', pointerEvents: 'none', userSelect: 'none',
        zIndex: 15,
      }}>
        connilefleur
      </div>
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5 }}>
        {projects.map((p, i) => {
          const pos = NODE_POS[p.id];
          if (!pos) return null;
          return (
            <div
              key={p.id}
              ref={el => { labelRefs.current[i] = el; }}
              className="nlabel"
              style={{
                left: `${pos.x * 100}%`,
                top:  `${(1 - pos.y) * 100}%`,
                animationDelay: `${i * 0.64}s`,
              }}
              onMouseEnter={() => { hoverIdx.current = i; }}
              onMouseLeave={() => { hoverIdx.current = -1; }}
              onClick={() => onClickRef.current(p.id)}
            >
              <div className="nlabel-row">
                <span className="nlabel-pulse" />
                <span className="nm">{p.nm}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Debug toggle button ──────────────────────────────────────────── */}
      <button
        className="dbg-toggle"
        onClick={() => setDebugOpen(o => !o)}
        title="Toggle param debug panel"
      >
        {debugOpen ? '× close' : '⚙ tune'}
      </button>

      {/* ── Debug panel ─────────────────────────────────────────────────── */}
      {debugOpen && (
        <div className="dbg-panel">
          <div className="dbg-heading">SIM PARAMS</div>

          <div className="dbg-section-label">static</div>
          {STATIC_PARAMS.map(({ k, label, min, max, step }) => (
            <div key={k} className="dbg-row">
              <span className="dbg-lbl">{label}</span>
              <input
                type="range" min={min} max={max} step={step}
                value={pRef.current[k]}
                onChange={e => { pRef.current[k] = parseFloat(e.target.value); forceUpdate(); }}
              />
              <span className="dbg-val">{pRef.current[k].toFixed(3)}</span>
            </div>
          ))}

          <div className="dbg-row">
            <span className="dbg-lbl">blur</span>
            <input
              type="range" min={0} max={24} step={0.5}
              value={blurRef.current}
              onChange={e => { blurRef.current = parseFloat(e.target.value); forceUpdate(); }}
            />
            <span className="dbg-val">{blurRef.current.toFixed(1)}</span>
          </div>

          <div className="dbg-section-label">animated (drift)</div>
          {DRIFT_PARAMS.map(({ k, label, min, max, step }) => {
            const locked = lockRef.current[k];
            return (
              <div key={k} className="dbg-drift-group">
                <div className="dbg-row">
                  <span className="dbg-lbl">{label}</span>
                  <span className={`dbg-live-val${locked ? ' is-locked' : ''}`}>
                    {locked ? '⏸' : '▶'} {pRef.current[k].toFixed(4)}
                  </span>
                  <button
                    className={`dbg-lock-btn${locked ? ' is-active' : ''}`}
                    onClick={() => {
                      lockRef.current[k] = !locked;
                      forceUpdate();
                    }}
                  >
                    {locked ? 'unlock' : 'lock'}
                  </button>
                </div>

                {locked ? (
                  <div className="dbg-row dbg-row--sub">
                    <span className="dbg-lbl dbg-lbl--mute">val</span>
                    <input
                      type="range" min={min} max={max} step={step}
                      value={pRef.current[k]}
                      onChange={e => { pRef.current[k] = parseFloat(e.target.value); forceUpdate(); }}
                    />
                    <span className="dbg-val">{pRef.current[k].toFixed(4)}</span>
                  </div>
                ) : (
                  <>
                    <div className="dbg-row dbg-row--sub">
                      <span className="dbg-lbl dbg-lbl--mute">lo</span>
                      <input
                        type="range" min={min} max={max} step={step}
                        value={loRef.current[k]}
                        onChange={e => { loRef.current[k] = parseFloat(e.target.value); forceUpdate(); }}
                      />
                      <span className="dbg-val">{loRef.current[k].toFixed(4)}</span>
                    </div>
                    <div className="dbg-row dbg-row--sub">
                      <span className="dbg-lbl dbg-lbl--mute">hi</span>
                      <input
                        type="range" min={min} max={max} step={step}
                        value={hiRef.current[k]}
                        onChange={e => { hiRef.current[k] = parseFloat(e.target.value); forceUpdate(); }}
                      />
                      <span className="dbg-val">{hiRef.current[k].toFixed(4)}</span>
                    </div>
                  </>
                )}
              </div>
            );
          })}

          {/* ── About ──────────────────────────────────────────────────── */}
          <div className="dbg-section-label" style={{ marginTop: 16 }}>about</div>
          <div className="dbg-about">
            <p>
              <strong>Barkley reaction-diffusion</strong> — a mathematical model of
              excitable media. Two coupled variables: <em>u</em> (activator) fires when
              it crosses a threshold set by <em>v</em> (inhibitor). After firing,
              <em> v</em> rises to create a refractory zone — the region can't re-fire
              until <em>v</em> decays. Wavefronts propagate outward, collide and
              annihilate. No explicit drawing — the pattern is entirely emergent.
            </p>
            <p>
              Anisotropic diffusion via layered FBM noise (<em>chaos</em>) breaks circular
              symmetry into branching filaments. All drift parameters oscillate on
              incommensurable sine sums — irrational frequency ratios guarantee the
              pattern never exactly repeats.
            </p>
            <p>
              Originally developed to model cardiac arrhythmias and
              Belousov–Zhabotinsky chemical reactions. Here it runs as a GPGPU pixel
              shader — every pixel is an independent cell in the medium, computed fully
              in parallel on the GPU each frame.
            </p>

            <div className="dbg-section-label" style={{ marginTop: 14, marginBottom: 8 }}>param guide</div>
            <dl className="dbg-guide">
              <dt>eps</dt>
              <dd>Wavefront sharpness. Lower = harder edges, more distinct rings.</dd>
              <dt>dt</dt>
              <dd>Time step — overall sim speed. Higher risks numerical instability.</dd>
              <dt>noise</dt>
              <dd>FBM scale for diffusion texture. Higher = finer grain in the medium.</dd>
              <dt>blur</dt>
              <dd>Display smoothing only — doesn't affect the simulation state.</dd>
              <dt>a</dt>
              <dd>Excitability threshold. Lower = denser, more active wave patterns.</dd>
              <dt>chaos</dt>
              <dd>Diffusion anisotropy. Near 0 = concentric rings. Higher = mycelium branches.</dd>
              <dt>Du</dt>
              <dd>Activator diffusion rate. Controls wave width and propagation speed.</dd>
              <dt>b</dt>
              <dd>Recovery rate (refractory period). Lower = faster oscillation, denser waves.</dd>
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}
