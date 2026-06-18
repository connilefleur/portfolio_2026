import { QUAD_VS, mkProg, mkTex, mkFBO, bindTex } from '../glUtils';
import type { Engine } from '../types';

// Jones (2010) agent-based Physarum polycephalum simulation.
// Agents sense trail at 3 forward sensors, steer toward highest, deposit trail.
// Seeded radially outward from label-box perimeters so growth emanates from sources.

const NUM_AGENTS = 600 * 1024;   // ~614 k agents
const ATW = 1024;
const ATH = NUM_AGENTS / ATW;    // 600

// P is randomised inside createPhysarumEngine — see factory below.

// ── Agent step shader ─────────────────────────────────────────────────────────
const AGENT_FS = `#version 300 es
precision highp float;
uniform sampler2D uAgents, uTrail, uWall;
uniform float uSA, uSD, uTS, uMS, uTime, uSeedPhase;
uniform float uDriftFX, uDriftFY, uDriftAmp;
uniform vec2  uTSz;
uniform vec2  uHoverPos;
uniform float uHoverAct;
in vec2 vUv; out vec4 fragColor;

float hash(vec2 p){ p=fract(p*vec2(127.34,311.71)); p+=dot(p,p+34.23); return fract(p.x*p.y); }

float tr(vec2 p){
  vec2 uv = fract(p / uTSz);
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

  // Density in [0,1]: 0 = empty space, 1 = saturated network
  // max total ≈ 3 × trailCap = 0.60; half-density at 0.24 (3×0.08)
  float dens = clamp(total / 0.24, 0.0, 1.0);

  // Slow drift field — veins grow in gentle curves, strongest in sparse areas
  float drift = sin(pos.x * uDriftFX + uTime * 0.00016 + uSeedPhase)
              * cos(pos.y * uDriftFY + uTime * 0.00011 + uSeedPhase * 0.73)
              * uDriftAmp * (1.0 - dens * 0.7);

  // Jitter scale: full in empty space, muted in dense areas (agents freeze on paths)
  float jScale = mix(1.0, 0.12, dens * dens);

  if (total < 0.003) {
    a += (rnd - 0.5) * 0.07 * jScale + drift;
  } else if (rnd2 > mix(0.65, 0.96, dens)) {
    // physarum fraction shrinks as density rises — less trail-following in busy zones
    if (fC >= lC && fC >= rC) { a += (rnd - 0.5) * 0.50 * jScale; }
    else if (lC > rC)          { a += uTS * jScale; }
    else                       { a -= uTS * jScale; }
  } else {
    a += (rnd - 0.5) * 0.09 * jScale + drift;
  }

  // Kick rate: 5% in empty space → <0.5% in saturated zones
  // Small amplitude (0.75 rad ≈ 43°) creates branch angles, not random redirections
  float hd     = length(pos - uHoverPos) / (uTSz.x * 0.18);
  float hBoost = exp(-hd * hd * 2.5) * uHoverAct * 0.40;
  float kickTh = mix(0.950, 0.997, dens * dens) - hBoost;
  float kick   = step(clamp(kickTh, 0.0, 1.0), hash(pos.yx + uTime * 3.7e-4 + uSeedPhase));
  a += kick * (rnd - 0.5) * 0.75 * (1.0 - dens * 0.6);

  vec2 nxt = pos + vec2(cos(a), sin(a)) * uMS;
  if (texture(uWall, fract(nxt / uTSz)).r > 0.5) {
    a   += 3.14159 + (rnd - 0.5) * 1.4;
    nxt  = pos + vec2(cos(a), sin(a)) * uMS;
  }
  nxt = mod(nxt, uTSz);
  fragColor = vec4(nxt, a, ag.w);
}`;

// ── Deposit VS — GL_POINTS, one point per agent ───────────────────────────────
function makeDepositVS(atw: number): string {
  return `#version 300 es
layout(location=0) in float aIdx;
uniform sampler2D uAgents;
uniform vec2 uTSz, uHoverPos;
uniform float uHoverAct;
out float vBoost;
void main(){
  int i = int(aIdx);
  vec4 ag = texelFetch(uAgents, ivec2(i % ${atw}, i / ${atw}), 0);
  gl_Position = vec4((ag.xy / uTSz) * 2.0 - 1.0, 0.0, 1.0);
  gl_PointSize = 1.0;
  float hd = length(ag.xy - uHoverPos) / (uTSz.x * 0.18);
  vBoost = exp(-hd * hd * 2.5) * uHoverAct * 8.0;
}`;
}

const DEPOSIT_FS = `#version 300 es
precision mediump float;
uniform float uAmt;
in float vBoost;
out vec4 fragColor;
void main(){ fragColor = vec4(uAmt * (1.0 + vBoost), 0.0, 0.0, 1.0); }`;

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

// ── Diffuse + decay ───────────────────────────────────────────────────────────
const DIFFUSE_FS = `#version 300 es
precision highp float;
uniform sampler2D uTrail, uWall; uniform float uDecay, uDiffuse, uCap;
in vec2 vUv; out vec4 fragColor;
void main(){
  vec2  t = 1.0 / vec2(textureSize(uTrail, 0));
  float s = 0.0;
  for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++)
    s += texture(uTrail, vUv + vec2(x, y) * t).r;
  float v    = mix(texture(uTrail, vUv).r, s / 9.0, uDiffuse) * uDecay;
  // Extra decay for saturated pixels — full areas dim out over time
  float fill = clamp(v / uCap, 0.0, 1.0);
  v *= (1.0 - fill * fill * 0.012);
  v *= (1.0 - step(0.5, texture(uWall, vUv).r));
  fragColor = vec4(min(v, uCap), 0.0, 0.0, 1.0);
}`;

// ── Vis — sqrt tone curve: boosts thin-vein visibility, makes fading gradual ─
// sqrt(raw/cap) maps raw=0.01 to 5% brightness (vs 1% with exp).
// Also: sqrt(0.5x) = 0.71*sqrt(x) — a vein at half raw-value drops only 29% in
// screen brightness, so decay looks slow even when trail values are falling fast.
const VIS_FS = `#version 300 es
precision highp float;
uniform sampler2D uTrail, uWall; uniform float uTime, uCap, uBright;
in vec2 vUv; out vec4 fragColor;
void main(){
  float wall   = step(0.5, texture(uWall, vUv).r);
  float raw    = texture(uTrail, vUv).r * (1.0 - wall);
  float fill   = clamp(raw / uCap, 0.0, 1.0);
  float t      = sqrt(fill);
  // Pulse fades out as trail saturates — growing frontier pulses, full areas go still
  float wAmp   = mix(0.12, 0.01, fill);
  float wave   = (1.0 - wAmp) + wAmp * sin(uTime * 0.00052 + vUv.x * 4.1 + vUv.y * 2.3);
  fragColor    = vec4(clamp(t * wave * uBright, 0.0, 1.0), 0.0, 0.0, 1.0);
}`;

export function createPhysarumEngine(
  gl: WebGL2RenderingContext,
  _vao: WebGLVertexArrayObject,
  TW: number, TH: number,
  nodePositions: Array<{ x: number; y: number; hw?: number; hh?: number }>,
): Engine {
  let tw = TW, th = TH;

  // Per-session variation — re-rolled each time the engine is created (page load / engine switch).
  // Ranges chosen so the sim always looks good; changes are visible but never jarring.
  const rnd = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
  const P = {
    sensorAngle:  rnd(38, 52) * Math.PI / 180, // wider = more bundled, narrower = more branchy
    sensorDist:   rnd(4.2, 6.2),               // longer = wider-radius curves
    turnSpeed:    0.40,
    moveSpeed:    rnd(0.26, 0.36),             // coverage rate
    deposit:      0.003,
    decay:        rnd(0.9958, 0.9972),         // affects how long faded veins persist
    diffuse:      0.002,
    trailCap:     0.22,
    nodeStrength: 0.0,
    nodeRadius:   22.0,
  };
  // Drift field spatial frequencies: change the scale and shape of the curves each load
  const driftFX  = rnd(0.006, 0.013);
  const driftFY  = rnd(0.004, 0.010);
  const driftAmp = rnd(0.005, 0.011);

  const pAgent   = mkProg(gl, QUAD_VS, AGENT_FS);
  const pDeposit = mkProg(gl, makeDepositVS(ATW), DEPOSIT_FS);
  const pFood    = mkProg(gl, FOOD_VS, FOOD_FS);
  const pDiffuse = mkProg(gl, QUAD_VS, DIFFUSE_FS);
  const pVis     = mkProg(gl, QUAD_VS, VIS_FS);

  // Cache all uniform locations — getUniformLocation is a driver call, never call it per frame.
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
    HoverPos:  gl.getUniformLocation(pAgent, 'uHoverPos'),
    HoverAct:  gl.getUniformLocation(pAgent, 'uHoverAct'),
  };
  const uDiff = {
    Trail:   gl.getUniformLocation(pDiffuse, 'uTrail'),
    Wall:    gl.getUniformLocation(pDiffuse, 'uWall'),
    Decay:   gl.getUniformLocation(pDiffuse, 'uDecay'),
    Diffuse: gl.getUniformLocation(pDiffuse, 'uDiffuse'),
    Cap:     gl.getUniformLocation(pDiffuse, 'uCap'),
  };
  const uDep = {
    Agents:   gl.getUniformLocation(pDeposit, 'uAgents'),
    TSz:      gl.getUniformLocation(pDeposit, 'uTSz'),
    Amt:      gl.getUniformLocation(pDeposit, 'uAmt'),
    HoverPos: gl.getUniformLocation(pDeposit, 'uHoverPos'),
    HoverAct: gl.getUniformLocation(pDeposit, 'uHoverAct'),
  };
  const uV = {
    Trail:  gl.getUniformLocation(pVis, 'uTrail'),
    Wall:   gl.getUniformLocation(pVis, 'uWall'),
    Time:   gl.getUniformLocation(pVis, 'uTime'),
    Cap:    gl.getUniformLocation(pVis, 'uCap'),
    Bright: gl.getUniformLocation(pVis, 'uBright'),
  };

  // Set static sampler uniforms once — texture units never change between frames.
  gl.useProgram(pAgent);
  gl.uniform1i(uA.Agents, 0); gl.uniform1i(uA.Trail, 1); gl.uniform1i(uA.Wall, 2);
  // Static per-session uniforms in agent shader
  gl.uniform1f(uA.SA, P.sensorAngle); gl.uniform1f(uA.SD, P.sensorDist);
  gl.uniform1f(uA.TS, P.turnSpeed);   gl.uniform1f(uA.MS, P.moveSpeed);
  gl.uniform1f(uA.DriftFX, driftFX);  gl.uniform1f(uA.DriftFY, driftFY);
  gl.uniform1f(uA.DriftAmp, driftAmp);

  gl.useProgram(pDiffuse);
  gl.uniform1i(uDiff.Trail, 0); gl.uniform1i(uDiff.Wall, 1);
  gl.uniform1f(uDiff.Diffuse, P.diffuse); gl.uniform1f(uDiff.Cap, P.trailCap);

  gl.useProgram(pDeposit);
  gl.uniform1i(uDep.Agents, 0); gl.uniform1f(uDep.Amt, P.deposit);
  gl.uniform2f(uDep.TSz, TW, TH);

  gl.useProgram(pVis);
  gl.uniform1i(uV.Trail, 0); gl.uniform1i(uV.Wall, 1); gl.uniform1f(uV.Cap, P.trailCap);

  // uTSz (agent + deposit shaders) changes only on resize — set now and in resize()
  gl.useProgram(pAgent);
  gl.uniform2f(uA.TSz, TW, TH);

  // Pre-allocated zero buffer reused on every cycle reset — avoids 10 MB allocation each minute.
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

  // ── Agent index VAO (one float per agent) ─────────────────────────────────
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

  // ── Food VAO (clip-space node positions) ──────────────────────────────────
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
  let seedPhase = Math.random() * Math.PI * 2;  // randomised each cycle
  let wallTex: WebGLTexture | null = null;
  let hoverX = 0, hoverY = 0, hoverAct = 0;
  let bright = 0.82;

  let agTex:  [WebGLTexture, WebGLTexture] = [null!, null!];
  let agFBO:  [WebGLFramebuffer, WebGLFramebuffer] = [null!, null!];
  let trTex:  [WebGLTexture, WebGLTexture] = [null!, null!];
  let trFBO:  [WebGLFramebuffer, WebGLFramebuffer] = [null!, null!];
  let visTex: WebGLTexture = null!;
  let visFBO: WebGLFramebuffer = null!;
  const CYCLE_MS   = 60_000;
  const FADEOUT_MS = 6_000;   // last 6 s of cycle: fast decay, no deposit
  let ag = 0, tr = 0, frameN = 0, startMs = -1;
  let cycleReset = false;
  let lastSimMs = -1;
  const SIM_HZ = 60; // agent+diffuse+deposit run at 60fps max; vis+display still run every frame

  // Pre-allocated buffers — no heap allocation on cycle reset, no GC spike.
  const agentSeedBuf = new Float32Array(NUM_AGENTS * 4);

  // ── Seed agents radially outward from label-box perimeters ────────────────
  const seedAgents = (): Float32Array => {
    const data = agentSeedBuf;
    for (let i = 0; i < NUM_AGENTS; i++) {
      const node = nodePositions[i % nodePositions.length];
      const cx   = node.x * tw;
      const cy   = node.y * th;
      // Expand slightly beyond the label wall so agents start outside it
      const hw   = (node.hw ?? 0.04) * tw + 5;
      const hh   = (node.hh ?? 0.04) * th + 5;

      // Arc-length uniform sample on rectangle perimeter
      const perim = 2 * (hw + hh);
      const t     = Math.random() * perim;
      let px: number, py: number;
      if      (t < hw)            { px = cx - hw + t;              py = cy + hh; }
      else if (t < 2 * hw)        { px = cx - hw + (t - hw);       py = cy - hh; }
      else if (t < 2 * hw + hh)   { px = cx + hw;                  py = cy - hh + (t - 2 * hw); }
      else                        { px = cx - hw;                  py = cy - hh + (t - 2 * hw - hh); }

      // Wide fan (±π/1.4) so agents from each perimeter point spread broadly, fewer blobs
      const angle = Math.atan2(py - cy, px - cx) + (Math.random() - 0.5) * 2.4;

      data[i*4]   = px;
      data[i*4+1] = py;
      data[i*4+2] = angle;
      data[i*4+3] = 0;
    }
    return agentSeedBuf;
  };

  const buildTextures = () => {
    for (let i = 0; i < 2; i++) {
      if (agTex[i]) { gl.deleteTexture(agTex[i]); gl.deleteFramebuffer(agFBO[i]); }
      if (trTex[i]) { gl.deleteTexture(trTex[i]); gl.deleteFramebuffer(trFBO[i]); }
    }
    if (visTex) { gl.deleteTexture(visTex); gl.deleteFramebuffer(visFBO); }

    const agData = seedAgents();
    agTex[0] = mkTex(gl, ATW, ATH, gl.RGBA32F, gl.RGBA, gl.FLOAT, agData);
    agFBO[0] = mkFBO(gl, agTex[0]);
    agTex[1] = mkTex(gl, ATW, ATH, gl.RGBA32F, gl.RGBA, gl.FLOAT, null);
    agFBO[1] = mkFBO(gl, agTex[1]);

    for (let i = 0; i < 2; i++) {
      trTex[i] = mkTex(gl, tw, th, gl.R32F, gl.RED, gl.FLOAT, null);
      gl.bindTexture(gl.TEXTURE_2D, trTex[i]);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
      trFBO[i] = mkFBO(gl, trTex[i]);
    }

    visTex = mkTex(gl, tw, th, gl.R32F, gl.RED, gl.FLOAT, null, gl.LINEAR);
    visFBO = mkFBO(gl, visTex);

    ag = 0; tr = 0; frameN = 0;

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
        // Re-seed in-place: no texture/FBO reallocation, just upload new agent data
        const agData = seedAgents();
        gl.bindTexture(gl.TEXTURE_2D, agTex[0]);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, ATW, ATH, gl.RGBA, gl.FLOAT, agData);
        gl.bindTexture(gl.TEXTURE_2D, agTex[1]);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, ATW, ATH, gl.RGBA, gl.FLOAT, zeroAgents);
        gl.clearColor(0, 0, 0, 0);
        for (let i = 0; i < 2; i++) {
          gl.bindFramebuffer(gl.FRAMEBUFFER, trFBO[i]); gl.clear(gl.COLOR_BUFFER_BIT);
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, visFBO); gl.clear(gl.COLOR_BUFFER_BIT);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        seedPhase = Math.random() * Math.PI * 2;
        ag = 0; tr = 0; frameN = 0; startMs = now;
        cycleReset = true;
      }
      const activeWall = wallTex ?? dummyWall;
      frameN++;

      // Expensive passes (agent + diffuse + deposit) run at 30fps max.
      // Vis runs every frame so the animated wave stays smooth.
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
        gl.uniform2f(uA.HoverPos,  hoverX, hoverY);
        gl.uniform1f(uA.HoverAct,  hoverAct);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        ag = 1 - ag;

        // 2. Diffuse + decay
        gl.useProgram(pDiffuse);
        gl.bindFramebuffer(gl.FRAMEBUFFER, trFBO[1-tr]);
        gl.viewport(0, 0, tw, th);
        bindTex(gl, 0, trTex[tr]);
        bindTex(gl, 1, activeWall);
        gl.uniform1f(uDiff.Decay, inFadeout ? 0.94 : P.decay);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        tr = 1 - tr;

        // 3. Deposit (additive blend, skipped during fadeout)
        if (!inFadeout) {
          gl.bindFramebuffer(gl.FRAMEBUFFER, trFBO[tr]);
          gl.viewport(0, 0, tw, th);
          gl.enable(gl.BLEND);
          gl.blendEquation(gl.FUNC_ADD);
          gl.blendFunc(gl.ONE, gl.ONE);
          gl.useProgram(pDeposit);
          gl.bindVertexArray(agentIdxVao);
          bindTex(gl, 0, agTex[ag]);
          gl.uniform2f(uDep.HoverPos, hoverX, hoverY);
          gl.uniform1f(uDep.HoverAct, hoverAct);
          gl.drawArrays(gl.POINTS, 0, NUM_AGENTS);
          gl.disable(gl.BLEND);
        }
      }

      // 4. Vis pass — always runs so the pulse wave animates at full framerate
      gl.bindVertexArray(quadVao);
      gl.useProgram(pVis);
      gl.bindFramebuffer(gl.FRAMEBUFFER, visFBO);
      gl.viewport(0, 0, tw, th);
      bindTex(gl, 0, trTex[tr]);
      bindTex(gl, 1, activeWall);
      gl.uniform1f(uV.Time,   now);
      gl.uniform1f(uV.Bright, bright);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return visTex;
    },

    resize(w: number, h: number): void {
      tw = w; th = h;
      gl.useProgram(pAgent);   gl.uniform2f(uA.TSz,   tw, th);
      gl.useProgram(pDeposit); gl.uniform2f(uDep.TSz, tw, th);
      buildTextures(); startMs = -1; seedPhase = Math.random() * Math.PI * 2;
    },
    setWallTex(tex: WebGLTexture): void { wallTex = tex; },
    setHover(x: number, y: number, active: boolean): void {
      hoverX = x * tw; hoverY = y * th; hoverAct = active ? 1 : 0;
    },
    setBrightness(v: number): void { bright = v; },
    pollReset(): boolean { const v = cycleReset; cycleReset = false; return v; },

    destroy(): void {
      for (let i = 0; i < 2; i++) {
        if (agTex[i]) gl.deleteTexture(agTex[i]);
        if (agFBO[i]) gl.deleteFramebuffer(agFBO[i]);
        if (trTex[i]) gl.deleteTexture(trTex[i]);
        if (trFBO[i]) gl.deleteFramebuffer(trFBO[i]);
      }
      if (visTex) gl.deleteTexture(visTex);
      if (visFBO) gl.deleteFramebuffer(visFBO);
      gl.deleteTexture(dummyWall);
      gl.deleteVertexArray(quadVao);    gl.deleteBuffer(quadBuf);
      gl.deleteVertexArray(agentIdxVao); gl.deleteBuffer(agentIdxBuf);
      gl.deleteVertexArray(foodVao);    gl.deleteBuffer(foodBuf);
      gl.deleteProgram(pAgent); gl.deleteProgram(pDeposit); gl.deleteProgram(pFood);
      gl.deleteProgram(pDiffuse); gl.deleteProgram(pVis);
    },
  };
}
