import { QUAD_VS, mkProg, mkTex, mkFBO, bindTex } from '../glUtils';
import type { Engine } from '../types';

// Jones (2010) agent-based Physarum polycephalum simulation.
// Agents sense trail at 3 forward sensors, steer toward highest, deposit trail.
// Seeded radially outward from label-box perimeters so growth emanates from sources.
//
// Trail texture is RG32F: R = density, G = density × nodeId (for potential future use).
// Hover effect: a second R32F glow texture captures only hovered-node agent deposits.
// Fast decay (~0.72/step) reveals live movement paths as glowing streaks — organic,
// motion-based, no territory approximation.

const NUM_AGENTS = 600 * 1024;   // ~614 k agents
const ATW = 1024;
const ATH = NUM_AGENTS / ATW;    // 600

// ── Agent step shader ─────────────────────────────────────────────────────────
// Agent state: xy = position (trail-pixel space), z = angle, w = normalised node ID
const AGENT_FS = `#version 300 es
precision highp float;
uniform sampler2D uAgents, uTrail, uWall;
uniform float uSA, uSD, uTS, uMS, uTime, uSeedPhase;
uniform float uDriftFX, uDriftFY, uDriftAmp;
uniform vec2  uTSz;
in vec2 vUv; out vec4 fragColor;

float hash(vec2 p){ p=fract(p*vec2(127.34,311.71)); p+=dot(p,p+34.23); return fract(p.x*p.y); }

float tr(vec2 p){
  vec2 uv = clamp(p / uTSz, 0.0, 1.0);
  float w  = texture(uWall, uv).r;
  return texture(uTrail, uv).r * (1.0 - step(0.5, w));
}

void main(){
  vec4  ag  = texture(uAgents, vUv);
  vec2  pos = ag.xy;
  float a   = ag.z;
  float rnd  = hash(pos.yx + uTime * 1.3e-4);
  float rnd2 = hash(pos.xy + uTime * 7.3e-5);

  float fC = tr(pos + vec2(cos(a),      sin(a))      * uSD);
  float lC = tr(pos + vec2(cos(a+uSA),  sin(a+uSA))  * uSD);
  float rC = tr(pos + vec2(cos(a-uSA),  sin(a-uSA))  * uSD);
  float total = fC + lC + rC;

  float dens = clamp(total / 0.24, 0.0, 1.0);

  float drift = sin(pos.x * uDriftFX + uTime * 0.00016 + uSeedPhase)
              * cos(pos.y * uDriftFY + uTime * 0.00011 + uSeedPhase * 0.73)
              * uDriftAmp * (1.0 - dens * 0.7);

  float jScale = mix(1.0, 0.12, dens * dens);

  if (total < 0.003) {
    a += (rnd - 0.5) * 0.07 * jScale + drift;
  } else if (rnd2 > mix(0.65, 0.96, dens)) {
    if (fC >= lC && fC >= rC) { a += (rnd - 0.5) * 0.50 * jScale; }
    else if (lC > rC)          { a += uTS * jScale; }
    else                       { a -= uTS * jScale; }
  } else {
    a += (rnd - 0.5) * 0.09 * jScale + drift;
  }

  float kickTh = mix(0.950, 0.997, dens * dens);
  float kick   = step(clamp(kickTh, 0.0, 1.0), hash(pos.yx + uTime * 3.7e-4 + uSeedPhase));
  a += kick * (rnd - 0.5) * 0.75 * (1.0 - dens * 0.6);

  vec2 nxt = pos + vec2(cos(a), sin(a)) * uMS;
  if (texture(uWall, clamp(nxt / uTSz, 0.0, 1.0)).r > 0.5) {
    a   += 3.14159 + (rnd - 0.5) * 1.4;
    nxt  = pos + vec2(cos(a), sin(a)) * uMS;
  }
  // Reflect off edges
  if (nxt.x < 0.0)        { nxt.x =  0.0;          a = 3.14159 - a; }
  if (nxt.x >= uTSz.x)    { nxt.x = uTSz.x - 1.0;  a = 3.14159 - a; }
  if (nxt.y < 0.0)        { nxt.y =  0.0;           a = -a; }
  if (nxt.y >= uTSz.y)    { nxt.y = uTSz.y - 1.0;  a = -a; }
  fragColor = vec4(nxt, a, ag.w);  // ag.w = normalised node ID, preserved every step
}`;

// ── Deposit VS — GL_POINTS, one point per agent ───────────────────────────────
// vNodeId carries the agent's origin node ID (0..1 normalised) into the fragment shader.
function makeDepositVS(atw: number): string {
  return `#version 300 es
layout(location=0) in float aIdx;
uniform sampler2D uAgents;
uniform vec2 uTSz;
out float vNodeId;
out vec2  vWallUv;
void main(){
  int i = int(aIdx);
  vec4 ag = texelFetch(uAgents, ivec2(i % ${atw}, i / ${atw}), 0);
  vec2 uv = ag.xy / uTSz;
  gl_Position  = vec4(uv * 2.0 - 1.0, 0.0, 1.0);
  gl_PointSize = 1.0;
  vNodeId  = ag.w;
  vWallUv  = uv;
}`;
}

// Trail is RG32F: R = density, G = density × nodeId.
// Additive blending accumulates both channels; G/R at read time = ownership ratio.
const DEPOSIT_FS = `#version 300 es
precision mediump float;
uniform float uAmt;
uniform sampler2D uWall;
in float vNodeId;
in vec2  vWallUv;
out vec4 fragColor;
void main(){
  if (texture(uWall, vWallUv).r > 0.5) discard;
  fragColor = vec4(uAmt, uAmt * vNodeId, 0.0, 1.0);
}`;

// ── Food VS — GL_POINTS at node positions ─────────────────────────────────────
const FOOD_VS = `#version 300 es
layout(location=0) in vec2 aPos; uniform float uR;
void main(){ gl_Position = vec4(aPos, 0.0, 1.0); gl_PointSize = uR; }`;

const FOOD_FS = `#version 300 es
precision mediump float;
uniform float uStr; out vec4 fragColor;
void main(){
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = clamp(1.0 - d, 0.0, 1.0);
  fragColor = vec4(uStr * a * a * a, 0.0, 0.0, 1.0);
}`;

// ── Diffuse + decay — both RG channels treated identically ────────────────────
const DIFFUSE_FS = `#version 300 es
precision highp float;
uniform sampler2D uTrail, uWall; uniform float uDecay, uDiffuse, uCap;
in vec2 vUv; out vec4 fragColor;
void main(){
  vec2  t = 1.0 / vec2(textureSize(uTrail, 0));
  vec2  s = vec2(0.0);
  float nearWall = 0.0;
  for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) {
    vec2 uvS = vUv + vec2(x, y) * t;
    s        += texture(uTrail, uvS).rg;
    nearWall  = max(nearWall, texture(uWall, uvS).r);
  }
  vec2  cur = texture(uTrail, vUv).rg;
  vec2  v   = mix(cur, s / 9.0, uDiffuse) * uDecay;
  float fill = clamp(v.r / uCap, 0.0, 1.0);
  v *= (1.0 - fill * fill * 0.012);
  float wallMask = (1.0 - step(0.5, texture(uWall, vUv).r))
                 * (1.0 - step(0.5, nearWall) * 0.20);
  v *= wallMask;
  fragColor = vec4(min(v.r, uCap), min(v.g, uCap), 0.0, 1.0);
}`;

// ── Vis — trail intensity + live agent glow overlay ───────────────────────────
// uGlow is an R32F fast-decay texture written by the glow deposit pass.
// Only agents belonging to the hovered node deposit into it, so the glow traces
// their actual live movement paths rather than approximating territory.
const VIS_FS = `#version 300 es
precision highp float;
uniform sampler2D uTrail, uWall, uGlow;
uniform float uTime, uCap, uBright, uHoverAct;
in vec2 vUv; out vec4 fragColor;
void main(){
  float wall = step(0.5, texture(uWall, vUv).r);
  float raw  = texture(uTrail, vUv).r * (1.0 - wall);
  float fill = clamp(raw / uCap, 0.0, 1.0);
  float t    = sqrt(fill);
  float wAmp = mix(0.12, 0.01, fill);
  float wave = (1.0 - wAmp) + wAmp * sin(uTime * 0.00052 + vUv.x * 4.1 + vUv.y * 2.3);
  float vis  = clamp(t * wave * uBright, 0.0, 1.0);
  float glow = texture(uGlow, vUv).r;
  vis = clamp(vis + glow * 5.0 * uHoverAct, 0.0, 1.0);
  fragColor = vec4(vis, 0.0, 0.0, 1.0);
}`;

// ── Glow deposit VS — GL_POINTS, draws only a per-node slice of the agent VBO ──
// Caller restricts the drawArrays range to the hovered node's contiguous agents,
// so no per-agent ID check is needed here — every vertex that runs belongs to the
// right node. 2px point size into a half-res FBO ≈ 4px effective width at display.
function makeGlowDepositVS(atw: number): string {
  return `#version 300 es
layout(location=0) in float aIdx;
uniform sampler2D uAgents;
uniform vec2  uTSz;
out vec2 vWallUv;
void main(){
  int i = int(aIdx);
  vec4 ag = texelFetch(uAgents, ivec2(i % ${atw}, i / ${atw}), 0);
  vec2 uv = ag.xy / uTSz;
  gl_Position  = vec4(uv * 2.0 - 1.0, 0.0, 1.0);
  gl_PointSize = 2.0;
  vWallUv = uv;
}`;
}

const GLOW_DEPOSIT_FS = `#version 300 es
precision mediump float;
uniform sampler2D uWall;
in vec2 vWallUv;
out vec4 fragColor;
void main(){
  if (texture(uWall, vWallUv).r > 0.5) discard;
  fragColor = vec4(0.12, 0.0, 0.0, 1.0);
}`;

// ── Glow diffuse — fast-decay single-channel blur ─────────────────────────────
// Decay ~0.72/step → trail visible for ~6 sim frames (~100ms at 60 Hz).
const GLOW_DIFFUSE_FS = `#version 300 es
precision highp float;
uniform sampler2D uGlow, uWall;
uniform float uDecay;
in vec2 vUv; out vec4 fragColor;
void main(){
  vec2  t = 1.0 / vec2(textureSize(uGlow, 0));
  float s = 0.0;
  for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++)
    s += texture(uGlow, vUv + vec2(x,y)*t).r;
  float v = mix(texture(uGlow, vUv).r, s / 9.0, 0.12) * uDecay;
  v *= (1.0 - step(0.5, texture(uWall, vUv).r));
  fragColor = vec4(v, 0.0, 0.0, 1.0);
}`;

// 3-AP-free node ID set: base-3 integers with no digit "2".
// Property: no element equals the average of any other two.
// Consequence: a collision zone between nodes A and B always sits at distance
// ≥ 0.5 × minGap from every valid node ID — no phantom ownership regardless of
// how two territories mix.
function apFreeIds(n: number): Float32Array {
  const raw: number[] = [];
  for (let k = 0; raw.length < n; k++) {
    let x = k, ok = true;
    while (x > 0) { if (x % 3 === 2) { ok = false; break; } x = Math.floor(x / 3); }
    if (ok) raw.push(k);
  }
  const ids = new Float32Array(n);
  const maxVal = raw[n - 1] || 1;
  for (let i = 0; i < n; i++) ids[i] = raw[i] / maxVal;
  return ids;
}

export function createPhysarumEngine(
  gl: WebGL2RenderingContext,
  _vao: WebGLVertexArrayObject,
  TW: number, TH: number,
  nodePositions: Array<{ x: number; y: number; hw?: number; hh?: number; weight?: number }>,
): Engine {
  let tw = TW, th = TH;

  const rnd = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
  const P = {
    sensorAngle:  rnd(38, 52) * Math.PI / 180,
    sensorDist:   rnd(4.2, 6.2),
    turnSpeed:    0.40,
    moveSpeed:    rnd(0.13, 0.18),
    deposit:      0.003,
    decay:        rnd(0.9958, 0.9972),
    diffuse:      0.002,
    trailCap:     0.22,
    nodeStrength: 0.0,
    nodeRadius:   22.0,
  };
  const driftFX  = rnd(0.006, 0.013);
  const driftFY  = rnd(0.004, 0.010);
  const driftAmp = rnd(0.005, 0.011);

  const pAgent        = mkProg(gl, QUAD_VS, AGENT_FS);
  const pDeposit      = mkProg(gl, makeDepositVS(ATW), DEPOSIT_FS);
  const pFood         = mkProg(gl, FOOD_VS, FOOD_FS);
  const pDiffuse      = mkProg(gl, QUAD_VS, DIFFUSE_FS);
  const pVis          = mkProg(gl, QUAD_VS, VIS_FS);
  const pGlowDeposit  = mkProg(gl, makeGlowDepositVS(ATW), GLOW_DEPOSIT_FS);
  const pGlowDiffuse  = mkProg(gl, QUAD_VS, GLOW_DIFFUSE_FS);

  const uA = {
    Agents:    gl.getUniformLocation(pAgent, 'uAgents'),
    Trail:     gl.getUniformLocation(pAgent, 'uTrail'),
    Wall:      gl.getUniformLocation(pAgent, 'uWall'),
    SA:        gl.getUniformLocation(pAgent, 'uSA'),
    SD:        gl.getUniformLocation(pAgent, 'uSD'),
    TS:        gl.getUniformLocation(pAgent, 'uTS'),
    MS:        gl.getUniformLocation(pAgent, 'uMS'),
    Time:      gl.getUniformLocation(pAgent, 'uTime'),
    SeedPhase: gl.getUniformLocation(pAgent, 'uSeedPhase'),
    DriftFX:   gl.getUniformLocation(pAgent, 'uDriftFX'),
    DriftFY:   gl.getUniformLocation(pAgent, 'uDriftFY'),
    DriftAmp:  gl.getUniformLocation(pAgent, 'uDriftAmp'),
    TSz:       gl.getUniformLocation(pAgent, 'uTSz'),
  };
  const uDiff = {
    Trail:   gl.getUniformLocation(pDiffuse, 'uTrail'),
    Wall:    gl.getUniformLocation(pDiffuse, 'uWall'),
    Decay:   gl.getUniformLocation(pDiffuse, 'uDecay'),
    Diffuse: gl.getUniformLocation(pDiffuse, 'uDiffuse'),
    Cap:     gl.getUniformLocation(pDiffuse, 'uCap'),
  };
  const uDep = {
    Agents: gl.getUniformLocation(pDeposit, 'uAgents'),
    TSz:    gl.getUniformLocation(pDeposit, 'uTSz'),
    Amt:    gl.getUniformLocation(pDeposit, 'uAmt'),
    Wall:   gl.getUniformLocation(pDeposit, 'uWall'),
  };
  const uV = {
    Trail:    gl.getUniformLocation(pVis, 'uTrail'),
    Wall:     gl.getUniformLocation(pVis, 'uWall'),
    Glow:     gl.getUniformLocation(pVis, 'uGlow'),
    Time:     gl.getUniformLocation(pVis, 'uTime'),
    Cap:      gl.getUniformLocation(pVis, 'uCap'),
    Bright:   gl.getUniformLocation(pVis, 'uBright'),
    HoverAct: gl.getUniformLocation(pVis, 'uHoverAct'),
  };
  const uGDep = {
    Agents: gl.getUniformLocation(pGlowDeposit, 'uAgents'),
    Wall:   gl.getUniformLocation(pGlowDeposit, 'uWall'),
    TSz:    gl.getUniformLocation(pGlowDeposit, 'uTSz'),
  };
  const uGDiff = {
    Glow:  gl.getUniformLocation(pGlowDiffuse, 'uGlow'),
    Wall:  gl.getUniformLocation(pGlowDiffuse, 'uWall'),
    Decay: gl.getUniformLocation(pGlowDiffuse, 'uDecay'),
  };

  gl.useProgram(pAgent);
  gl.uniform1i(uA.Agents, 0); gl.uniform1i(uA.Trail, 1); gl.uniform1i(uA.Wall, 2);
  gl.uniform1f(uA.SA, P.sensorAngle); gl.uniform1f(uA.SD, P.sensorDist);
  gl.uniform1f(uA.TS, P.turnSpeed);   gl.uniform1f(uA.MS, P.moveSpeed);
  gl.uniform1f(uA.DriftFX, driftFX);  gl.uniform1f(uA.DriftFY, driftFY);
  gl.uniform1f(uA.DriftAmp, driftAmp);

  gl.useProgram(pDiffuse);
  gl.uniform1i(uDiff.Trail, 0); gl.uniform1i(uDiff.Wall, 1);
  gl.uniform1f(uDiff.Diffuse, P.diffuse); gl.uniform1f(uDiff.Cap, P.trailCap);

  gl.useProgram(pDeposit);
  gl.uniform1i(uDep.Agents, 0); gl.uniform1i(uDep.Wall, 1);
  gl.uniform1f(uDep.Amt, P.deposit);
  gl.uniform2f(uDep.TSz, TW, TH);

  gl.useProgram(pVis);
  gl.uniform1i(uV.Trail, 0); gl.uniform1i(uV.Wall, 1); gl.uniform1i(uV.Glow, 2);
  gl.uniform1f(uV.Cap, P.trailCap);

  gl.useProgram(pGlowDeposit);
  gl.uniform1i(uGDep.Agents, 0); gl.uniform1i(uGDep.Wall, 1);
  gl.uniform2f(uGDep.TSz, TW, TH);

  gl.useProgram(pGlowDiffuse);
  gl.uniform1i(uGDiff.Glow, 0); gl.uniform1i(uGDiff.Wall, 1);

  gl.useProgram(pAgent);
  gl.uniform2f(uA.TSz, TW, TH);

  const zeroAgents = new Float32Array(NUM_AGENTS * 4);

  // ── Fullscreen quad VAO ───────────────────────────────────────────────────
  const quadVao = gl.createVertexArray()!;
  const quadBuf = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
  gl.bindVertexArray(quadVao);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);

  // ── Agent index VAO ───────────────────────────────────────────────────────
  const agentIdxVao = gl.createVertexArray()!;
  const agentIdxBuf = gl.createBuffer()!;
  {
    const idx = new Float32Array(NUM_AGENTS);
    for (let i = 0; i < NUM_AGENTS; i++) idx[i] = i;
    gl.bindBuffer(gl.ARRAY_BUFFER, agentIdxBuf);
    gl.bufferData(gl.ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    gl.bindVertexArray(agentIdxVao);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 1, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
  }

  // ── Food VAO ──────────────────────────────────────────────────────────────
  const foodVao = gl.createVertexArray()!;
  const foodBuf = gl.createBuffer()!;
  {
    const pts = new Float32Array(nodePositions.length * 2);
    for (let i = 0; i < nodePositions.length; i++) {
      pts[i*2]   = nodePositions[i].x * 2 - 1;
      pts[i*2+1] = nodePositions[i].y * 2 - 1;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, foodBuf);
    gl.bufferData(gl.ARRAY_BUFFER, pts, gl.STATIC_DRAW);
    gl.bindVertexArray(foodVao);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
  }

  const dummyWall = mkTex(gl, 1, 1, gl.R8, gl.RED, gl.UNSIGNED_BYTE, new Uint8Array([0]));
  let seedPhase = Math.random() * Math.PI * 2;
  let wallTex: WebGLTexture | null = null;

  const N = nodePositions.length;
  // nodeIds still used to encode agent origin in trail G-channel (deposit layer)
  const nodeIds = apFreeIds(N);

  // Hover state — track which node to highlight via glow trail
  let hoverIdx       = 0;
  let hoverActTarget = 0;
  let hoverActSmooth = 0;

  let bright = 0.82;

  let agTex:   [WebGLTexture, WebGLTexture] = [null!, null!];
  let agFBO:   [WebGLFramebuffer, WebGLFramebuffer] = [null!, null!];
  let trTex:   [WebGLTexture, WebGLTexture] = [null!, null!];
  let trFBO:   [WebGLFramebuffer, WebGLFramebuffer] = [null!, null!];
  let glowTex: [WebGLTexture, WebGLTexture] = [null!, null!];
  let glowFBO: [WebGLFramebuffer, WebGLFramebuffer] = [null!, null!];
  let visTex:  WebGLTexture = null!;
  let visFBO:  WebGLFramebuffer = null!;
  const CYCLE_MS   = 60_000;
  const FADEOUT_MS = 6_000;
  let gtw = 1, gth = 1;  // glow texture half-resolution
  let ag = 0, tr = 0, gd = 0, frameN = 0, startMs = -1;
  let cycleReset = false;
  let lastSimMs = -1;
  const SIM_HZ = 60;

  const agentSeedBuf = new Float32Array(NUM_AGENTS * 4);
  // Contiguous agent ranges per node — lets glow deposit draw only the hovered slice.
  const agentStart = new Int32Array(N);
  const agentCount = new Int32Array(N);

  // ── Seed agents — store normalised node ID in ag.w ────────────────────────
  const seedAgents = (): Float32Array => {
    const data    = agentSeedBuf;
    const weights = nodePositions.map(n => n.weight ?? 1);
    const totalW  = weights.reduce((a, b) => a + b, 0);
    let agIdx = 0;
    for (let ni = 0; ni < N; ni++) {
      const node  = nodePositions[ni];
      const count = ni === N - 1
        ? NUM_AGENTS - agIdx
        : Math.round((weights[ni] / totalW) * NUM_AGENTS);
      agentStart[ni] = agIdx;
      agentCount[ni] = count;
      const cx = node.x * tw;
      const cy = node.y * th;
      const hw = (node.hw ?? 0.04) * tw * 1.85 + 6;
      const hh = (node.hh ?? 0.04) * th * 1.85 + 6;
      const perim = 2 * (hw + hh);
      const normId = nodeIds[ni] ?? 0;
      for (let k = 0; k < count; k++, agIdx++) {
        const t = Math.random() * perim;
        let px: number, py: number;
        if      (t < hw)            { px = cx - hw + t;              py = cy + hh; }
        else if (t < 2 * hw)        { px = cx - hw + (t - hw);       py = cy - hh; }
        else if (t < 2 * hw + hh)   { px = cx + hw;                  py = cy - hh + (t - 2 * hw); }
        else                        { px = cx - hw;                  py = cy - hh + (t - 2 * hw - hh); }
        const angle = Math.atan2(py - cy, px - cx) + (Math.random() - 0.5) * 2.4;
        data[agIdx*4]   = px;
        data[agIdx*4+1] = py;
        data[agIdx*4+2] = angle;
        data[agIdx*4+3] = normId;
      }
    }
    return agentSeedBuf;
  };

  const buildTextures = () => {
    for (let i = 0; i < 2; i++) {
      if (agTex[i])   { gl.deleteTexture(agTex[i]);   gl.deleteFramebuffer(agFBO[i]); }
      if (trTex[i])   { gl.deleteTexture(trTex[i]);   gl.deleteFramebuffer(trFBO[i]); }
      if (glowTex[i]) { gl.deleteTexture(glowTex[i]); gl.deleteFramebuffer(glowFBO[i]); }
    }
    if (visTex) { gl.deleteTexture(visTex); gl.deleteFramebuffer(visFBO); }

    const agData = seedAgents();
    agTex[0] = mkTex(gl, ATW, ATH, gl.RGBA32F, gl.RGBA, gl.FLOAT, agData);
    agFBO[0] = mkFBO(gl, agTex[0]);
    agTex[1] = mkTex(gl, ATW, ATH, gl.RGBA32F, gl.RGBA, gl.FLOAT, null);
    agFBO[1] = mkFBO(gl, agTex[1]);

    // RG32F trail: R = density, G = density × nodeId
    for (let i = 0; i < 2; i++) {
      trTex[i] = mkTex(gl, tw, th, gl.RG32F, gl.RG, gl.FLOAT, null);
      gl.bindTexture(gl.TEXTURE_2D, trTex[i]);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      trFBO[i] = mkFBO(gl, trTex[i]);
    }

    // R32F glow at half-resolution — glow is blurry by design, half-res is visually identical
    // and costs 4× less per pass. LINEAR sampling in VIS/DISPLAY upscales smoothly.
    gtw = Math.max(64, tw >> 1);
    gth = Math.max(64, th >> 1);
    for (let i = 0; i < 2; i++) {
      glowTex[i] = mkTex(gl, gtw, gth, gl.R32F, gl.RED, gl.FLOAT, null, gl.LINEAR);
      glowFBO[i] = mkFBO(gl, glowTex[i]);
    }

    visTex = mkTex(gl, tw, th, gl.R32F, gl.RED, gl.FLOAT, null, gl.LINEAR);
    visFBO = mkFBO(gl, visTex);

    ag = 0; tr = 0; gd = 0; frameN = 0;

    gl.bindFramebuffer(gl.FRAMEBUFFER, trFBO[0]);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, trFBO[1]);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  };

  buildTextures();

  return {
    step(now: number): WebGLTexture {
      if (startMs < 0) startMs = now;
      const elapsed   = now - startMs;
      const inFadeout = elapsed >= CYCLE_MS - FADEOUT_MS;

      if (elapsed >= CYCLE_MS) {
        const agData = seedAgents();
        gl.bindTexture(gl.TEXTURE_2D, agTex[0]);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, ATW, ATH, gl.RGBA, gl.FLOAT, agData);
        gl.bindTexture(gl.TEXTURE_2D, agTex[1]);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, ATW, ATH, gl.RGBA, gl.FLOAT, zeroAgents);
        gl.clearColor(0, 0, 0, 0);
        for (let i = 0; i < 2; i++) {
          gl.bindFramebuffer(gl.FRAMEBUFFER, trFBO[i]);   gl.clear(gl.COLOR_BUFFER_BIT);
          gl.bindFramebuffer(gl.FRAMEBUFFER, glowFBO[i]); gl.clear(gl.COLOR_BUFFER_BIT);
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, visFBO); gl.clear(gl.COLOR_BUFFER_BIT);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        seedPhase = Math.random() * Math.PI * 2;
        ag = 0; tr = 0; gd = 0; frameN = 0; startMs = now;
        cycleReset = true;
      }
      const activeWall = wallTex ?? dummyWall;
      frameN++;

      hoverActSmooth += (hoverActTarget - hoverActSmooth) * 0.20;

      const runSim = lastSimMs < 0 || (now - lastSimMs) >= 1000 / SIM_HZ;
      if (runSim) {
        lastSimMs = now;

        // 1. Agent step
        gl.bindVertexArray(quadVao);
        gl.useProgram(pAgent);
        gl.bindFramebuffer(gl.FRAMEBUFFER, agFBO[1-ag]);
        gl.viewport(0, 0, ATW, ATH);
        bindTex(gl, 0, agTex[ag]);
        bindTex(gl, 1, trTex[tr]);
        bindTex(gl, 2, activeWall);
        gl.uniform1f(uA.Time,      now);
        gl.uniform1f(uA.SeedPhase, seedPhase);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        ag = 1 - ag;

        // 2. Diffuse + decay (RG channels together)
        gl.useProgram(pDiffuse);
        gl.bindFramebuffer(gl.FRAMEBUFFER, trFBO[1-tr]);
        gl.viewport(0, 0, tw, th);
        bindTex(gl, 0, trTex[tr]);
        bindTex(gl, 1, activeWall);
        gl.uniform1f(uDiff.Decay, inFadeout ? 0.94 : P.decay);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        tr = 1 - tr;

        // 3. Deposit — writes (density, density×nodeId) with additive blending
        if (!inFadeout) {
          gl.bindFramebuffer(gl.FRAMEBUFFER, trFBO[tr]);
          gl.viewport(0, 0, tw, th);
          gl.enable(gl.BLEND);
          gl.blendEquation(gl.FUNC_ADD);
          gl.blendFunc(gl.ONE, gl.ONE);
          gl.useProgram(pDeposit);
          gl.bindVertexArray(agentIdxVao);
          bindTex(gl, 0, agTex[ag]);
          bindTex(gl, 1, activeWall);
          gl.drawArrays(gl.POINTS, 0, NUM_AGENTS);
          gl.disable(gl.BLEND);
        }

        // 4 & 5. Glow passes — skip entirely when glow has fully decayed (not hovering)
        if (hoverActSmooth > 0.001) {
          // 4. Glow diffuse — fast decay (half-res FBO)
          gl.bindVertexArray(quadVao);
          gl.useProgram(pGlowDiffuse);
          gl.bindFramebuffer(gl.FRAMEBUFFER, glowFBO[1-gd]);
          gl.viewport(0, 0, gtw, gth);
          bindTex(gl, 0, glowTex[gd]);
          bindTex(gl, 1, activeWall);
          gl.uniform1f(uGDiff.Decay, 0.72);
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
          gd = 1 - gd;

          // 5. Glow deposit — stops immediately when hoverActTarget flips to 0
          if (!inFadeout && hoverActTarget > 0.5) {
            const hi = hoverIdx < N ? hoverIdx : 0;
            gl.bindFramebuffer(gl.FRAMEBUFFER, glowFBO[gd]);
            gl.viewport(0, 0, gtw, gth);
            gl.enable(gl.BLEND);
            gl.blendEquation(gl.FUNC_ADD);
            gl.blendFunc(gl.ONE, gl.ONE);
            gl.useProgram(pGlowDeposit);
            gl.bindVertexArray(agentIdxVao);
            bindTex(gl, 0, agTex[ag]);
            bindTex(gl, 1, activeWall);
            gl.drawArrays(gl.POINTS, agentStart[hi], agentCount[hi]);
            gl.disable(gl.BLEND);
          }
        }
      }

      // 6. Vis pass — bake trail intensity + glow overlay into visTex
      gl.bindVertexArray(quadVao);
      gl.useProgram(pVis);
      gl.bindFramebuffer(gl.FRAMEBUFFER, visFBO);
      gl.viewport(0, 0, tw, th);
      bindTex(gl, 0, trTex[tr]);
      bindTex(gl, 1, activeWall);
      bindTex(gl, 2, glowTex[gd]);
      gl.uniform1f(uV.Time,     now);
      gl.uniform1f(uV.Bright,   bright);
      gl.uniform1f(uV.HoverAct, hoverActSmooth);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return visTex;
    },

    resize(w: number, h: number): void {
      tw = w; th = h;
      gl.useProgram(pAgent);       gl.uniform2f(uA.TSz,    tw, th);
      gl.useProgram(pDeposit);     gl.uniform2f(uDep.TSz,  tw, th);
      gl.useProgram(pGlowDeposit); gl.uniform2f(uGDep.TSz, tw, th);
      buildTextures(); startMs = -1; seedPhase = Math.random() * Math.PI * 2;
    },
    setWallTex(tex: WebGLTexture): void { wallTex = tex; },
    setHover(_x: number, _y: number, nodeIdx: number, active: boolean): void {
      if (active) hoverIdx = nodeIdx;   // freeze index on un-hover so fade-out uses correct node
      hoverActTarget = active ? 1.0 : 0.0;
    },
    setBrightness(v: number): void { bright = v; },
    pollReset(): boolean { const v = cycleReset; cycleReset = false; return v; },

    destroy(): void {
      for (let i = 0; i < 2; i++) {
        if (agTex[i])   gl.deleteTexture(agTex[i]);
        if (agFBO[i])   gl.deleteFramebuffer(agFBO[i]);
        if (trTex[i])   gl.deleteTexture(trTex[i]);
        if (trFBO[i])   gl.deleteFramebuffer(trFBO[i]);
        if (glowTex[i]) gl.deleteTexture(glowTex[i]);
        if (glowFBO[i]) gl.deleteFramebuffer(glowFBO[i]);
      }
      if (visTex) gl.deleteTexture(visTex);
      if (visFBO) gl.deleteFramebuffer(visFBO);
      gl.deleteTexture(dummyWall);
      gl.deleteVertexArray(quadVao);     gl.deleteBuffer(quadBuf);
      gl.deleteVertexArray(agentIdxVao); gl.deleteBuffer(agentIdxBuf);
      gl.deleteVertexArray(foodVao);     gl.deleteBuffer(foodBuf);
      gl.deleteProgram(pAgent);       gl.deleteProgram(pDeposit);
      gl.deleteProgram(pFood);        gl.deleteProgram(pDiffuse);
      gl.deleteProgram(pVis);         gl.deleteProgram(pGlowDeposit);
      gl.deleteProgram(pGlowDiffuse);
    },
  };
}
