import { useEffect, useRef } from 'react';
import type { Project } from '../data/types';

// GL coords: x=0 left, y=0 bottom
const NODE_POS: Record<string, { x: number; y: number }> = {
  e30:     { x: 0.50, y: 0.76 },
  glasses: { x: 0.20, y: 0.58 },
  reel:    { x: 0.80, y: 0.58 },
  hda:     { x: 0.50, y: 0.42 },
  vfx:     { x: 0.28, y: 0.26 },
  web:     { x: 0.72, y: 0.26 },
};

interface Props {
  projects: Project[];
  onNodeClick: (id: string) => void;
  paused?: boolean;
}

const SIM_SCALE   = 1.5;
const SUBSTEPS    = 3;
const PACE_PERIOD = 2800;
const PACE_WIN    = 180;
const PACE_R      = 10;

const P_INIT = {
  eps: 0.060, a: 0.72, b: 0.022,
  Du: 0.19, dt: 0.10,
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
uniform vec2  uNodeRect[8];
uniform int   uNC;
uniform float uPaceR;
uniform int   uHoverIdx;
uniform vec2  uNoiseOff[8];
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

  // Staggered pacemakers — each node fires at its own phase offset
  float pperiod = float(${PACE_PERIOD});
  float pwin    = float(${PACE_WIN});
  for (int i = 0; i < 8; i++) {
    if (i >= uNC) break;
    float phaseOffset = float(i) * pperiod / float(uNC);
    float phase = mod(uTime + phaseOffset, pperiod);
    if (phase < pwin) {
      vec2  center = uNodes[i] * sz;
      vec2  ext    = uNodeRect[i];
      vec2  dp     = abs(fragPx - center);
      float T      = 3.0;
      if ((abs(dp.x - ext.x) < T && dp.y <= ext.y + T) ||
          (abs(dp.y - ext.y) < T && dp.x <= ext.x + T)) {
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
    localDt = uDt * mix(6.0, 1.0, smoothstep(60.0, 320.0, hd));
  }

  fragColor = vec4(
    clamp(u + localDt*du, 0.0, 1.0),
    clamp(v + localDt*dv, 0.0, 1.0),
    0.0, 1.0
  );
}`;

const DISPLAY_FS = `#version 300 es
precision highp float;
uniform sampler2D uState;
uniform sampler2D uWall;
uniform float uBlurPx;
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

  vec3 bg  = vec3(0.031, 0.035, 0.047);
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

  float eu = clamp(ring * 0.58 + fill + collision * 0.32, 0.0, 1.0);

  vec2 uv2 = vUv - 0.5;
  vec3 col = mix(bg, rim, eu) * clamp(1.0 - dot(uv2, uv2) * 1.0, 0.0, 1.0);

  if (texture(uWall, vUv).r > 0.5) col = vec3(0.031, 0.035, 0.047);
  fragColor = vec4(col, 1.0);
}`;

export default function PhysarumCanvas({ projects, onNodeClick, paused }: Props) {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const labelRefs   = useRef<(HTMLDivElement | null)[]>([]);
  const projectsRef = useRef(projects);
  const onClickRef  = useRef(onNodeClick);
  const hoverIdx    = useRef(-1);
  const pausedRef   = useRef(!!paused);

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

    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.STENCIL_TEST);

    let TW = 1, TH = 1;
    function setSize() {
      canvas.width  = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
      TW = Math.max(1, Math.floor(canvas.width  * SIM_SCALE));
      TH = Math.max(1, Math.floor(canvas.height * SIM_SCALE));
    }

    // ── GL helpers ──────────────────────────────────────────────────────────
    function mkShader(type: number, src: string): WebGLShader {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
        throw new Error(gl.getShaderInfoLog(s) ?? 'shader compile error');
      return s;
    }
    function mkProg(vs: string, fs: string): WebGLProgram {
      const p = gl.createProgram()!;
      gl.attachShader(p, mkShader(gl.VERTEX_SHADER, vs));
      gl.attachShader(p, mkShader(gl.FRAGMENT_SHADER, fs));
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS))
        throw new Error(gl.getProgramInfoLog(p) ?? 'program link error');
      return p;
    }
    function mkTex(
      w: number, h: number,
      ifmt: number, fmt: number, type: number,
      data: ArrayBufferView | null,
    ): WebGLTexture {
      const t = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, ifmt, w, h, 0, fmt, type, data);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    }
    function mkFBO(tex: WebGLTexture): WebGLFramebuffer {
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
    const nodeUVs     = new Float32Array(8 * 2);
    const nodeRects   = new Float32Array(8 * 2);
    const noiseOffs   = new Float32Array(8 * 2);
    projs.forEach((p, i) => {
      const pos = NODE_POS[p.id] ?? { x: 0.5, y: 0.5 };
      nodeUVs[i * 2]     = pos.x;
      nodeUVs[i * 2 + 1] = pos.y;
    });
    for (let i = 0; i < noiseOffs.length; i++) noiseOffs[i] = Math.random() * 100;

    // ── Simulation state ────────────────────────────────────────────────────
    let rdTex: [WebGLTexture | null, WebGLTexture | null] = [null, null];
    let rdFBO: [WebGLFramebuffer | null, WebGLFramebuffer | null] = [null, null];
    let wallTex: WebGLTexture | null = null;
    let rd = 0;

    function measureLabels() {
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

    function buildWallTex() {
      const oc = document.createElement('canvas');
      oc.width = TW; oc.height = TH;
      const ctx = oc.getContext('2d')!;
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, TW, TH);
      ctx.fillStyle = '#fff';
      // connilefleur obstacle text
      ctx.font = `900 78px "JetBrains Mono","Arial Black",monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('connilefleur', 0.50 * TW, 0.500 * TH);
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

    function seedInitial(): Float32Array {
      const d = new Float32Array(TW * TH * 2);
      for (let i = 0; i < TW * TH; i++) d[i * 2] = Math.random() * 0.008;
      const T = 3;
      projs.forEach((p, i) => {
        const pos = NODE_POS[p.id] ?? { x: 0.5, y: 0.5 };
        const cx = Math.round(pos.x * TW);
        const cy = Math.round(pos.y * TH);
        const hw = Math.round(nodeRects[i * 2]);
        const hh = Math.round(nodeRects[i * 2 + 1]);
        if (hw === 0 || hh === 0) return;
        for (let py = cy - hh - T; py <= cy + hh + T; py++) {
          for (let px = cx - hw - T; px <= cx + hw + T; px++) {
            if (px < 0 || px >= TW || py < 0 || py >= TH) continue;
            const dx = Math.abs(px - cx), dy = Math.abs(py - cy);
            const onEdge =
              (Math.abs(dx - hw) < T && dy <= hh + T) ||
              (Math.abs(dy - hh) < T && dx <= hw + T);
            if (onEdge) { d[(py * TW + px) * 2] = 1.0; d[(py * TW + px) * 2 + 1] = 0.0; }
          }
        }
      });
      return d;
    }

    function initTextures() {
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

    // ── Drift state ─────────────────────────────────────────────────────────
    const P = { ...P_INIT };

    // ── Frame loop ──────────────────────────────────────────────────────────
    let rafId = 0;

    function frame(now: number) {
      rafId = requestAnimationFrame(frame);
      if (pausedRef.current) return;

      // Drift parameters
      const vA = driftVal(DRIFT_FREQS, DRIFT_AMPS, now);
      P.a = A_LO + Math.pow(vA * 0.5 + 0.5, 0.32) * (A_HI - A_LO);

      const vC = driftVal(CHAOS_FREQS, CHAOS_AMPS, now);
      P.chaos = C_LO + Math.pow(vC * 0.5 + 0.5, 0.6) * (C_HI - C_LO);

      const vDu = driftVal(DU_FREQS, DU_AMPS, now);
      P.Du = DU_LO + (vDu * 0.5 + 0.5) * (DU_HI - DU_LO);

      const vB = driftVal(B_FREQS, B_AMPS, now);
      P.b = B_LO + (vB * 0.5 + 0.5) * (B_HI - B_LO);

      if (!wallTex || !rdTex[0] || !rdTex[1] || !rdFBO[0] || !rdFBO[1]) return;

      gl.bindVertexArray(quadVAO);

      // RD substeps
      gl.useProgram(pReact);
      u1f(pReact, 'uEps',        P.eps);
      u1f(pReact, 'uA',          P.a);
      u1f(pReact, 'uB',          P.b);
      u1f(pReact, 'uDu',         P.Du);
      u1f(pReact, 'uChaos',      P.chaos);
      u1f(pReact, 'uNoiseScale', P.noise);
      u1f(pReact, 'uTime',       now);
      u1f(pReact, 'uDt',         P.dt);
      u1f(pReact, 'uPaceR',      PACE_R);
      u1i(pReact, 'uNC',         projs.length);
      u1i(pReact, 'uHoverIdx',   hoverIdx.current);
      u1i(pReact, 'uState',      0);
      u1i(pReact, 'uWall',       1);
      gl.uniform2fv(gl.getUniformLocation(pReact, 'uNodes'),    nodeUVs);
      gl.uniform2fv(gl.getUniformLocation(pReact, 'uNodeRect'), nodeRects);
      gl.uniform2fv(gl.getUniformLocation(pReact, 'uNoiseOff'), noiseOffs);
      bindTex(1, wallTex);

      for (let s = 0; s < SUBSTEPS; s++) {
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
      u1f(pDisplay, 'uBlurPx', 8.0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    // ── Resize ──────────────────────────────────────────────────────────────
    function resize() {
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

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}
      />
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
              <span className="meta">{p.idx} · '{p.yearShort}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
