import { QUAD_VS, mkProg, mkTex, mkFBO, bindTex } from '../glUtils';
import type { Engine } from '../types';

// 3D curl-noise particle cloud.
// Particles live in normalized 3D space (x,y ∈ [-1,1], z ∈ [0,Z_DEPTH]).
// Velocity = 2D curl noise with z as a phase offset → each depth "slice" rotates
// differently, creating volumetric cloud structure without full 3D curl cost.
// Deposit VS does perspective projection to clip space → same R32F trail contract.

const NUM_PARTICLES = 22 * 1024;  // sparse — visible individual swirls
const PTW = 1024;
const PTH = NUM_PARTICLES / PTW;  // 22

const Z_DEPTH = 3.5;
const FOCAL   = 1.8;              // camera at z = -FOCAL

const P = {
  speed:    0.010,
  deposit:  0.10,    // higher per-particle so sparse count still shows
  decay:    0.955,   // faster fade → trails dissolve between swirl passes
  diffuse:  0.05,
  trailCap: 2.2,
  lifeRate: 0.0018,
};

// ── Particle step shader ──────────────────────────────────────────────────────
// State per particle: vec4(x, y, z, life)
// x,y ∈ [-1,1]   z ∈ [0, Z_DEPTH]   life ∈ [0,1]
// Up to 8 node vortices injected as uniforms — radius derived from label size.
const MAX_NODES = 8;
const PART_FS = `#version 300 es
precision highp float;
uniform sampler2D uParts;
uniform float uTime, uSpeed, uLifeRate;
uniform int   uNumNodes;
uniform vec2  uNodePos[${MAX_NODES}];    // NDC x,y ∈ [-1,1]
uniform float uNodeRad[${MAX_NODES}];    // vortex sigma in NDC
uniform vec2  uNodeHwHh[${MAX_NODES}];  // half-width, half-height of exclusion rect in NDC
in vec2 vUv; out vec4 fragColor;

const float Z_DEPTH = ${Z_DEPTH.toFixed(1)};
const float FOCAL   = ${FOCAL.toFixed(1)};

float hash(vec2 p){ p=fract(p*vec2(127.34,311.71)); p+=dot(p,p+34.23); return fract(p.x*p.y); }

float vnoise(vec2 p){
  vec2 i=floor(p), f=fract(p);
  f=f*f*(3.-2.*f);
  float a=hash(i), b=hash(i+vec2(1,0)), c=hash(i+vec2(0,1)), d=hash(i+vec2(1,1));
  return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);
}

float fbm(vec2 p){
  return 0.5*vnoise(p)+0.25*vnoise(p*2.0+vec2(1.7,9.2))+0.125*vnoise(p*4.1+vec2(8.3,2.8));
}

// Rankine vortex — CW or CCW depending on dir (+1/-1)
vec2 vortex(vec2 pos2d, vec2 center, float rad, float dir) {
  vec2 d = pos2d - center;
  float r = length(d);
  float profile = (r / rad) * exp(-0.5 * r * r / (rad * rad));
  vec2 tangent = vec2(-d.y, d.x) / max(r, 0.001);
  return tangent * dir * profile;
}

// True if projected screen position is inside any node's exclusion rectangle
bool inLabelRect(vec2 screen) {
  for (int i = 0; i < ${MAX_NODES}; i++) {
    if (i >= uNumNodes) break;
    vec2 d = abs(screen - uNodePos[i]);
    if (d.x < uNodeHwHh[i].x && d.y < uNodeHwHh[i].y) return true;
  }
  return false;
}

vec3 flow(vec3 pos){
  vec2 p = pos.xy * 1.4;
  float zPhase = pos.z * 1.8;
  // Asymmetric x/y drift — field shape genuinely morphs, not just translates diagonally
  vec2 drift = vec2(uTime * 0.00022, uTime * 0.00014);

  const float e = 0.07;
  vec2 base = vec2(zPhase) + drift;
  float f0  = fbm(p + base);
  float fxp = fbm(p + vec2(e, 0.0) + base);
  float fyp = fbm(p + vec2(0.0, e) + base);
  vec2 curl = vec2((fyp-f0)/e, -(fxp-f0)/e);

  vec2 vortexSum = vec2(0.0);
  for (int i = 0; i < ${MAX_NODES}; i++) {
    if (i >= uNumNodes) break;
    float dir = (i % 2 == 0) ? 1.0 : -1.0;
    vortexSum += vortex(pos.xy, uNodePos[i], uNodeRad[i], dir);
  }

  float fz = fbm(p.yx * 0.75 + vec2(zPhase*1.3 + 5.7) + drift*0.6);
  float vz = (fz - 0.5) * 1.0;

  return vec3((curl * 0.45 + vortexSum * 1.10), vz * 0.22);
}

void main(){
  vec4 pt  = texture(uParts, vUv);
  vec3 pos = pt.xyz;
  float life = pt.w;

  vec3 vel   = flow(pos) * uSpeed;

  // Prevent stalling at curl-noise saddle points (zero-velocity zones)
  float vlen = length(vel.xy);
  if (vlen < uSpeed * 0.12) {
    float ja = hash(pos.xz + uTime * 3.3e-5) * 6.28318;
    vel.xy += vec2(cos(ja), sin(ja)) * uSpeed * 0.35;
  }

  vec2 newXY = mod(pos.xy + vel.xy + 2.0, 2.0) - 1.0;
  float newZ = mod(pos.z  + vel.z  + Z_DEPTH, Z_DEPTH);

  // Exclusion: block particles from entering label rects (test projected screen position)
  float newDepth = newZ + FOCAL;
  vec2 newScreen = newXY * FOCAL / newDepth;
  if (inLabelRect(newScreen)) {
    float r1 = hash(pos.xy + uTime * 1.3e-4 + 0.17);
    float r2 = hash(pos.yx + uTime * 9.7e-5 + 5.1);
    vec2 rndXY = mod(pos.xy + normalize(vec2(r1 - 0.5, r2 - 0.5)) * uSpeed + 2.0, 2.0) - 1.0;
    vec2 rndScreen = rndXY * FOCAL / newDepth;
    if (!inLabelRect(rndScreen)) {
      newXY = rndXY;
    } else {
      // Both positions inside rect — kill particle so it respawns outside next frame
      life = 0.0;
      newXY = pos.xy;
    }
  }
  pos.xy = newXY;
  pos.z  = newZ;

  life -= uLifeRate;
  if(life <= 0.0){
    float r1 = hash(pos.xz + uTime*1.3e-4);
    float r2 = hash(pos.yz + uTime*9.7e-5 + 3.7);
    float r3 = hash(pos.xy + uTime*7.1e-5 + 1.3);
    pos  = vec3(r1*2.-1., r2*2.-1., r3*Z_DEPTH);
    life = 0.2 + hash(pos.xz + r3) * 0.8;
  }
  fragColor = vec4(pos, life);
}`;

// ── Deposit: GL_POINTS with perspective projection ────────────────────────────
// Near particles: larger point, higher deposit. Far: smaller, dimmer.
function makeDepositVS(ptw: number): string {
  return `#version 300 es
layout(location=0) in float aIdx;
uniform sampler2D uParts;
uniform int   uNumNodes;
uniform vec2  uNodePos[${MAX_NODES}];
uniform vec2  uNodeHwHh[${MAX_NODES}];
uniform vec2  uCamTilt;   // (pitch, yaw) in radians — small camera angle from mouse
out float vLife;
out float vFade;
const float FOCAL   = ${FOCAL.toFixed(1)};
const float Z_DEPTH = ${Z_DEPTH.toFixed(1)};
void main(){
  int i = int(aIdx);
  vec4 pt  = texelFetch(uParts, ivec2(i%${ptw}, i/${ptw}), 0);
  vec3 pos = pt.xyz;
  vLife = pt.w;

  // Camera tilt: yaw rotates around Y (mouse-x), pitch rotates around X (mouse-y)
  float cy = cos(uCamTilt.y), sy = sin(uCamTilt.y);
  pos.xz = vec2(pos.x * cy + pos.z * sy, -pos.x * sy + pos.z * cy);
  float cp = cos(uCamTilt.x), sp = sin(uCamTilt.x);
  pos.yz = vec2(pos.y * cp - pos.z * sp,  pos.y * sp + pos.z * cp);

  float depth = pos.z + FOCAL;
  vec2 screen = pos.xy * FOCAL / depth;

  // Suppress deposit inside any label rect — the background shows through cleanly
  for (int j = 0; j < ${MAX_NODES}; j++) {
    if (j >= uNumNodes) break;
    vec2 d = abs(screen - uNodePos[j]);
    if (d.x < uNodeHwHh[j].x && d.y < uNodeHwHh[j].y) {
      vLife = 0.0;
      gl_Position  = vec4(-2.0, 0.0, 0.0, 1.0);
      gl_PointSize = 0.0;
      return;
    }
  }

  vFade = clamp(FOCAL / depth * 0.85, 0.08, 1.0);
  gl_Position  = vec4(screen, 0.0, 1.0);
  gl_PointSize = clamp(FOCAL / depth * 3.2, 1.0, 5.0);
}`;
}

const DEPOSIT_FS = `#version 300 es
precision mediump float;
uniform float uAmt;
in float vLife;
in float vFade;
out vec4 fragColor;
void main(){
  if(vLife < 0.03) discard;
  // Soft disk — corners of the point sprite are discarded
  float r = length(gl_PointCoord - 0.5) * 2.0;
  if(r > 1.0) discard;
  float alpha = (1.0 - r*r) * vFade;
  fragColor = vec4(uAmt * alpha, 0.0, 0.0, 1.0);
}`;

// ── Diffuse + decay ───────────────────────────────────────────────────────────
const DIFFUSE_FS = `#version 300 es
precision highp float;
uniform sampler2D uTrail; uniform float uDecay, uDiffuse, uCap;
in vec2 vUv; out vec4 fragColor;
void main(){
  vec2 t = 1./vec2(textureSize(uTrail,0)); float s=0.;
  for(int x=-1;x<=1;x++) for(int y=-1;y<=1;y++) s+=texture(uTrail,vUv+vec2(x,y)*t).r;
  float v = mix(texture(uTrail,vUv).r, s/9., uDiffuse) * uDecay;
  fragColor = vec4(min(v, uCap), 0, 0, 1);
}`;

// ── Vis: tone-curve → R32F [0,1] ─────────────────────────────────────────────
const VIS_FS = `#version 300 es
precision highp float;
uniform sampler2D uTrail;
in vec2 vUv; out vec4 fragColor;
void main(){
  float raw = texture(uTrail, vUv).r;
  // Softer curve than PHY — the sparser cloud deposit needs more lift in darks
  float t = clamp(1.0 - exp(-raw * 0.72), 0.0, 1.0);
  fragColor = vec4(t, 0, 0, 1);
}`;

// ── Engine factory ────────────────────────────────────────────────────────────
export function createFlowEngine(
  gl: WebGL2RenderingContext,
  _vao: WebGLVertexArrayObject,
  TW: number, TH: number,
  // x,y ∈ [0,1] GL coords; hw,hh = label half-dims as fraction of sim width
  nodePositions: Array<{ x: number; y: number; hw?: number; hh?: number }> = [],
): Engine {
  const numNodes = Math.min(nodePositions.length, MAX_NODES);
  const nodePosFlat  = new Float32Array(MAX_NODES * 2);
  const nodeRadFlat  = new Float32Array(MAX_NODES);
  const nodeHwHhFlat = new Float32Array(MAX_NODES * 2);  // exclusion rect half-extents in NDC
  for (let i = 0; i < numNodes; i++) {
    const n = nodePositions[i];
    nodePosFlat[i*2]   = n.x * 2 - 1;   // [0,1] → NDC [-1,1]
    nodePosFlat[i*2+1] = n.y * 2 - 1;
    const hw = n.hw ?? 0.05;
    const hh = n.hh ?? 0.03;
    // Exclusion rect: label half-dims in NDC + 40% proportional breathing room
    nodeHwHhFlat[i*2]   = hw * 2 * 1.4;
    nodeHwHhFlat[i*2+1] = hh * 2 * 1.4;
    // Vortex sigma — peak orbit ring sits just outside the exclusion edge
    nodeRadFlat[i] = Math.max(hw, hh) * 2 * 2.0;
  }
  let tw = TW, th = TH;
  let tiltRx = 0, tiltRy = 0;

  const pPart    = mkProg(gl, QUAD_VS, PART_FS);
  const pDeposit = mkProg(gl, makeDepositVS(PTW), DEPOSIT_FS);
  const pDiffuse = mkProg(gl, QUAD_VS, DIFFUSE_FS);
  const pVis     = mkProg(gl, QUAD_VS, VIS_FS);

  const quadVao = gl.createVertexArray()!;
  const quadBuf = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
  gl.bindVertexArray(quadVao);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);

  const partIdxVao = gl.createVertexArray()!;
  const partIdxBuf = gl.createBuffer()!;
  {
    const idx = new Float32Array(NUM_PARTICLES);
    for (let i = 0; i < NUM_PARTICLES; i++) idx[i] = i;
    gl.bindBuffer(gl.ARRAY_BUFFER, partIdxBuf);
    gl.bufferData(gl.ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    gl.bindVertexArray(partIdxVao);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 1, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
  }

  let partTex: [WebGLTexture, WebGLTexture] = [null!, null!];
  let partFBO: [WebGLFramebuffer, WebGLFramebuffer] = [null!, null!];
  let trTex:   [WebGLTexture, WebGLTexture] = [null!, null!];
  let trFBO:   [WebGLFramebuffer, WebGLFramebuffer] = [null!, null!];
  let visTex:  WebGLTexture = null!;
  let visFBO:  WebGLFramebuffer = null!;
  let pt = 0, tr = 0;

  const seedParticles = (): Float32Array => {
    const d = new Float32Array(NUM_PARTICLES * 4);
    for (let i = 0; i < NUM_PARTICLES; i++) {
      d[i*4]   = Math.random() * 2 - 1;    // x ∈ [-1, 1]
      d[i*4+1] = Math.random() * 2 - 1;    // y ∈ [-1, 1]
      d[i*4+2] = Math.random() * Z_DEPTH;  // z ∈ [0, Z_DEPTH]
      d[i*4+3] = Math.random();             // life — staggered
    }
    return d;
  };

  const buildTextures = () => {
    for (let i = 0; i < 2; i++) {
      if (partTex[i]) { gl.deleteTexture(partTex[i]); gl.deleteFramebuffer(partFBO[i]); }
      if (trTex[i])   { gl.deleteTexture(trTex[i]);   gl.deleteFramebuffer(trFBO[i]); }
    }
    if (visTex) { gl.deleteTexture(visTex); gl.deleteFramebuffer(visFBO); }

    const pData = seedParticles();
    partTex[0] = mkTex(gl, PTW, PTH, gl.RGBA32F, gl.RGBA, gl.FLOAT, pData);
    partFBO[0] = mkFBO(gl, partTex[0]);
    partTex[1] = mkTex(gl, PTW, PTH, gl.RGBA32F, gl.RGBA, gl.FLOAT, null);
    partFBO[1] = mkFBO(gl, partTex[1]);

    for (let i = 0; i < 2; i++) {
      trTex[i] = mkTex(gl, tw, th, gl.R32F, gl.RED, gl.FLOAT, null, gl.LINEAR);
      trFBO[i] = mkFBO(gl, trTex[i]);
      gl.bindFramebuffer(gl.FRAMEBUFFER, trFBO[i]);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    visTex = mkTex(gl, tw, th, gl.R32F, gl.RED, gl.FLOAT, null, gl.LINEAR);
    visFBO = mkFBO(gl, visTex);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    pt = 0; tr = 0;
  };

  buildTextures();

  return {
    step(now: number): WebGLTexture {
      // 1. Particle step
      gl.bindVertexArray(quadVao);
      gl.useProgram(pPart);
      gl.bindFramebuffer(gl.FRAMEBUFFER, partFBO[1-pt]);
      gl.viewport(0, 0, PTW, PTH);
      bindTex(gl, 0, partTex[pt]); gl.uniform1i(gl.getUniformLocation(pPart, 'uParts'), 0);
      gl.uniform1f(gl.getUniformLocation(pPart, 'uTime'),     now);
      gl.uniform1f(gl.getUniformLocation(pPart, 'uSpeed'),    P.speed);
      gl.uniform1f(gl.getUniformLocation(pPart, 'uLifeRate'), P.lifeRate);
      gl.uniform1i(gl.getUniformLocation(pPart, 'uNumNodes'), numNodes);
      if (numNodes > 0) {
        gl.uniform2fv(gl.getUniformLocation(pPart, 'uNodePos'),   nodePosFlat);
        gl.uniform1fv(gl.getUniformLocation(pPart, 'uNodeRad'),   nodeRadFlat);
        gl.uniform2fv(gl.getUniformLocation(pPart, 'uNodeHwHh'),  nodeHwHhFlat);
      }
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      pt = 1 - pt;

      // 2. Diffuse + decay
      gl.useProgram(pDiffuse);
      gl.bindFramebuffer(gl.FRAMEBUFFER, trFBO[1-tr]);
      gl.viewport(0, 0, tw, th);
      bindTex(gl, 0, trTex[tr]);
      gl.uniform1i(gl.getUniformLocation(pDiffuse, 'uTrail'),   0);
      gl.uniform1f(gl.getUniformLocation(pDiffuse, 'uDecay'),   P.decay);
      gl.uniform1f(gl.getUniformLocation(pDiffuse, 'uDiffuse'), P.diffuse);
      gl.uniform1f(gl.getUniformLocation(pDiffuse, 'uCap'),     P.trailCap);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      tr = 1 - tr;

      // 3. Deposit (additive GL_POINTS with perspective projection)
      gl.bindFramebuffer(gl.FRAMEBUFFER, trFBO[tr]);
      gl.viewport(0, 0, tw, th);
      gl.enable(gl.BLEND);
      gl.blendEquation(gl.FUNC_ADD);
      gl.blendFunc(gl.ONE, gl.ONE);

      gl.useProgram(pDeposit);
      gl.bindVertexArray(partIdxVao);
      bindTex(gl, 0, partTex[pt]); gl.uniform1i(gl.getUniformLocation(pDeposit, 'uParts'), 0);
      gl.uniform1f(gl.getUniformLocation(pDeposit, 'uAmt'), P.deposit);
      gl.uniform1i(gl.getUniformLocation(pDeposit, 'uNumNodes'), numNodes);
      gl.uniform2f(gl.getUniformLocation(pDeposit, 'uCamTilt'), tiltRx, tiltRy);
      if (numNodes > 0) {
        gl.uniform2fv(gl.getUniformLocation(pDeposit, 'uNodePos'),  nodePosFlat);
        gl.uniform2fv(gl.getUniformLocation(pDeposit, 'uNodeHwHh'), nodeHwHhFlat);
      }
      gl.drawArrays(gl.POINTS, 0, NUM_PARTICLES);

      gl.disable(gl.BLEND);

      // 4. Vis → R32F [0,1]
      gl.bindVertexArray(quadVao);
      gl.useProgram(pVis);
      gl.bindFramebuffer(gl.FRAMEBUFFER, visFBO);
      gl.viewport(0, 0, tw, th);
      bindTex(gl, 0, trTex[tr]);
      gl.uniform1i(gl.getUniformLocation(pVis, 'uTrail'), 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return visTex;
    },

    resize(w: number, h: number): void {
      tw = w; th = h;
      buildTextures();
    },

    setTilt(rx: number, ry: number): void { tiltRx = rx; tiltRy = ry; },

    setWallTex(_tex: WebGLTexture): void {},

    destroy(): void {
      for (let i = 0; i < 2; i++) {
        if (partTex[i]) { gl.deleteTexture(partTex[i]); gl.deleteFramebuffer(partFBO[i]); }
        if (trTex[i])   { gl.deleteTexture(trTex[i]);   gl.deleteFramebuffer(trFBO[i]); }
      }
      if (visTex) gl.deleteTexture(visTex);
      if (visFBO) gl.deleteFramebuffer(visFBO);
      gl.deleteVertexArray(quadVao);
      gl.deleteBuffer(quadBuf);
      gl.deleteVertexArray(partIdxVao);
      gl.deleteBuffer(partIdxBuf);
      gl.deleteProgram(pPart);
      gl.deleteProgram(pDeposit);
      gl.deleteProgram(pDiffuse);
      gl.deleteProgram(pVis);
    },
  };
}
