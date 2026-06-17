import { QUAD_VS, mkProg, mkTex, mkFBO, bindTex } from '../glUtils';
import type { Engine } from '../types';

// Turing-Meinhardt (Gierer-Meinhardt substrate depletion) — ported from PhysarumCanvas.tsx
// ∂a/∂t = Da∇²a + ρ·a²/h − μ·a + 0.001
// ∂h/∂t = Dh∇²h + ρ·a²   − ν·h

const ACTIVE_MS = 60_000;
const CYCLE_MS  = 90_000;

const AMPS = [0.50, 0.28, 0.14, 0.08];
function driftBimodal(freqs: number[], now: number): number {
  const norm = AMPS.reduce((s, a) => s + a, 0);
  let v = 0;
  for (let i = 0; i < freqs.length; i++) v += AMPS[i] * Math.sin(2 * Math.PI * freqs[i] * now);
  return Math.tanh((v / norm) * 2.8) / Math.tanh(2.8);
}

const DA_LO = 0.002,  DA_HI = 0.008;  const DA_FREQS  = [0.000582,0.000958,0.000228,0.000147];
const DH_LO = 0.10,   DH_HI = 0.36;   const DH_FREQS  = [0.000517,0.000821,0.001303,0.000334];
const RHO_LO = 0.013, RHO_HI = 0.038; const RHO_FREQS = [0.000243,0.000157,0.000391,0.0000923];
const MU_LO = 0.042,  MU_HI = 0.100;  const MU_FREQS  = [0.000178,0.000108,0.000274,0.0000668];
const NU_LO = 0.025,  NU_HI = 0.072;  const NU_FREQS  = [0.000412,0.000253,0.000167,0.000098];
const C_LO  = 0.10,   C_HI  = 0.65;   const C_FREQS   = [0.000178,0.000108,0.000274,0.0000668];

// ── Reaction shader ───────────────────────────────────────────────────────────
const REACT_FS = `#version 300 es
precision highp float;
uniform sampler2D uState;
uniform sampler2D uWall;
uniform float uDa, uDh, uRho, uMu, uNu, uDt, uChaos, uNoiseScale, uTime;
in vec2 vUv;
out vec4 fragColor;

float hash2(vec2 p){p=fract(p*vec2(127.34,311.71));p+=dot(p,p+34.23);return fract(p.x*p.y);}
float vnoise(vec2 p){
  vec2 i=floor(p),f=fract(p),u=f*f*(3.0-2.0*f);
  return mix(mix(hash2(i),hash2(i+vec2(1,0)),u.x),mix(hash2(i+vec2(0,1)),hash2(i+vec2(1,1)),u.x),u.y);
}
float fbm(vec2 p){float v=0.0,a=0.5;for(int i=0;i<4;i++){v+=a*vnoise(p);p=p*2.13+vec2(1.7,9.2);a*=0.5;}return v;}
float fbm3(vec2 p){float v=0.0,a=0.5;for(int i=0;i<3;i++){v+=a*vnoise(p);p=p*2.13+vec2(1.7,9.2);a*=0.5;}return v;}

void main() {
  if (texture(uWall, vUv).r > 0.5) { fragColor = vec4(0.38, 0.18, 0.0, 1.0); return; }

  vec2 sz = vec2(textureSize(uState, 0));
  vec2 px = 1.0 / sz;

  float mA = fbm3(vUv * 1.9 + vec2(uTime*0.000008, uTime*0.000006));
  float maskA = smoothstep(0.52, 0.70, mA);
  vec2  td = vec2(uTime*0.000018, uTime*0.000023) * maskA;
  vec2  nUV = vUv * uNoiseScale + td;
  float nx = fbm(nUV), ny = fbm(nUV + vec2(5.37, 11.83));
  float daX = uDa * mix(1.0, 0.15 + 1.70*nx, uChaos);
  float daY = uDa * mix(1.0, 0.15 + 1.70*ny, uChaos);

  vec2 p1 = vec2(px.x, 0.0), p2 = vec2(0.0, px.y);
  float a = texture(uState, vUv).r, h = texture(uState, vUv).g;
  float aR = mix(texture(uState,vUv+p1).r, a, step(0.5,texture(uWall,vUv+p1).r));
  float aL = mix(texture(uState,vUv-p1).r, a, step(0.5,texture(uWall,vUv-p1).r));
  float aU = mix(texture(uState,vUv+p2).r, a, step(0.5,texture(uWall,vUv+p2).r));
  float aD = mix(texture(uState,vUv-p2).r, a, step(0.5,texture(uWall,vUv-p2).r));
  float hR = mix(texture(uState,vUv+p1).g, h, step(0.5,texture(uWall,vUv+p1).r));
  float hL = mix(texture(uState,vUv-p1).g, h, step(0.5,texture(uWall,vUv-p1).r));
  float hU = mix(texture(uState,vUv+p2).g, h, step(0.5,texture(uWall,vUv+p2).r));
  float hD = mix(texture(uState,vUv-p2).g, h, step(0.5,texture(uWall,vUv-p2).r));

  float lap_a = daX*(aR+aL-2.0*a) + daY*(aU+aD-2.0*a);
  float lap_h = uDh*(hR+hL+hU+hD-4.0*h);
  float aa = a*a;
  float da = lap_a + uRho*aa/max(h,0.01) - uMu*a + 0.001;
  float dh = lap_h + uRho*aa - uNu*h;
  fragColor = vec4(clamp(a+uDt*da,0.0,4.0), clamp(h+uDt*dh,0.0,8.0), 0.0, 1.0);
}`;

// ── Vis shader: ring function + CA + collision + lighting → R32F [0,1] ────────
const VIS_FS = `#version 300 es
precision highp float;
uniform sampler2D uState;
in vec2 vUv;
out vec4 fragColor;

float toDisp(float a) { return clamp((a - 0.25) * 0.7, 0.0, 1.0); }
float ringFn(float x)  { return smoothstep(0.04,0.30,x)*(1.0-smoothstep(0.40,0.78,x)); }

vec2 bilinear(vec2 uv) {
  vec2 sz=vec2(textureSize(uState,0));
  vec2 px=uv*sz-0.5; vec2 f=fract(px); vec2 b=(floor(px)+0.5)/sz; vec2 s=1.0/sz;
  vec2 tl=texture(uState,b).rg, tr=texture(uState,b+vec2(s.x,0)).rg;
  vec2 bl=texture(uState,b+vec2(0,s.y)).rg, br=texture(uState,b+s).rg;
  return mix(mix(tl,tr,f.x),mix(bl,br,f.x),f.y);
}

void main() {
  vec2 sz  = vec2(textureSize(uState, 0));
  vec2 px10 = 10.0/sz, px24 = 24.0/sz;

  float dR  = bilinear(vUv+vec2(px10.x,0)).r, dL  = bilinear(vUv-vec2(px10.x,0)).r;
  float dU  = bilinear(vUv+vec2(0,px10.y)).r, dD  = bilinear(vUv-vec2(0,px10.y)).r;
  float dR2 = bilinear(vUv+vec2(px24.x,0)).r, dL2 = bilinear(vUv-vec2(px24.x,0)).r;
  float dU2 = bilinear(vUv+vec2(0,px24.y)).r, dD2 = bilinear(vUv-vec2(0,px24.y)).r;
  vec2 grad = mix(vec2(dR-dL,dU-dD), vec2(dR2-dL2,dU2-dD2), 0.4);

  float as  = toDisp(texture(uState, vUv).r);
  float ring = ringFn(as);
  float fill = smoothstep(0.30, 0.70, as) * 0.12;

  // Neighbour collision boost
  vec2 off = 10.0/sz;
  float rN=ringFn(toDisp(texture(uState,vUv+vec2(0,    off.y)).r));
  float rS=ringFn(toDisp(texture(uState,vUv-vec2(0,    off.y)).r));
  float rE=ringFn(toDisp(texture(uState,vUv+vec2(off.x,0    )).r));
  float rW=ringFn(toDisp(texture(uState,vUv-vec2(off.x,0    )).r));
  float collision = ring * max(max(rN,rS),max(rE,rW));

  // Chromatic aberration — ghost rings offset along gradient
  float ring_ca = ring;
  float gLen = length(grad);
  if (gLen > 0.002) {
    vec2 gDir  = grad/gLen;
    vec2 caOff = gDir*3.0/sz;
    float as_fwd = toDisp(bilinear(vUv+caOff).r);
    float as_bwd = toDisp(bilinear(vUv-caOff).r);
    ring_ca = ring*0.55 + ringFn(as_fwd)*0.30 + ringFn(as_bwd)*0.15;
  }

  // Normal map lighting
  vec2 nOff = 3.0/sz;
  float hmL=texture(uState,vUv-vec2(nOff.x,0)).r, hmR=texture(uState,vUv+vec2(nOff.x,0)).r;
  float hmD=texture(uState,vUv-vec2(0,nOff.y)).r, hmU=texture(uState,vUv+vec2(0,nOff.y)).r;
  vec3 N = normalize(vec3((hmL-hmR)*12.0,(hmD-hmU)*12.0,1.0));
  vec3 L = normalize(vec3(0.6,0.8,1.6));
  vec3 H = normalize(L+vec3(0,0,1));
  float diff = clamp(dot(N,L),0.0,1.0);
  float spec = pow(max(0.0,dot(N,H)),32.0);
  float lit  = 0.50 + diff*0.50;

  float eu = clamp(ring_ca*2.2*lit + ring_ca*spec*0.55 + fill + collision*0.6, 0.0, 1.0);
  fragColor = vec4(eu, 0.0, 0.0, 1.0);
}`;

export function createTmEngine(
  gl: WebGL2RenderingContext,
  vao: WebGLVertexArrayObject,
  TW: number, TH: number,
): Engine {
  const pReact = mkProg(gl, QUAD_VS, REACT_FS);
  const pVis   = mkProg(gl, QUAD_VS, VIS_FS);

  let rdTex:  [WebGLTexture, WebGLTexture] = [null!, null!];
  let rdFBO:  [WebGLFramebuffer, WebGLFramebuffer] = [null!, null!];
  let visTex: WebGLTexture = null!;
  let visFBO: WebGLFramebuffer = null!;
  let wallTex: WebGLTexture | null = null;
  let rd = 0;
  let tw = TW, th = TH;
  let wasInCooldown = false;

  const p = { Da:0.004, Dh:0.16, rho:0.026, mu:0.065, nu:0.040, chaos:0.30 };

  const seed = (): Float32Array => {
    const d = new Float32Array(tw * th * 2);
    const aSS = 0.38, hSS = 0.18;
    for (let i = 0; i < tw*th; i++) {
      d[i*2]   = aSS + (Math.random()-0.5)*0.06;
      d[i*2+1] = hSS + (Math.random()-0.5)*0.03;
    }
    const count = Math.floor(tw*th / 900);
    for (let n = 0; n < count; n++) {
      const cx = Math.floor(Math.random()*tw), cy = Math.floor(Math.random()*th);
      const R  = 1 + Math.floor(Math.random()*5);
      const ab = 0.3 + Math.random()*0.6;
      for (let py=cy-R; py<=cy+R; py++) for (let px=cx-R; px<=cx+R; px++) {
        if (px<0||px>=tw||py<0||py>=th) continue;
        if ((px-cx)**2+(py-cy)**2<=R*R) {
          d[(py*tw+px)*2]   = aSS + ab;
          d[(py*tw+px)*2+1] = hSS;
        }
      }
    }
    return d;
  };

  const buildFallbackWall = () => {
    const d = new Uint8Array(tw * th);
    if (wallTex) gl.deleteTexture(wallTex);
    wallTex = mkTex(gl, tw, th, gl.R8, gl.RED, gl.UNSIGNED_BYTE, d);
  };

  const buildTextures = () => {
    for (let i=0; i<2; i++) {
      if (rdTex[i]) { gl.deleteTexture(rdTex[i]); gl.deleteFramebuffer(rdFBO[i]); }
    }
    if (visTex) { gl.deleteTexture(visTex); gl.deleteFramebuffer(visFBO); }
    const s = seed();
    rdTex[0] = mkTex(gl, tw, th, gl.RG32F, gl.RG, gl.FLOAT, s);
    rdFBO[0] = mkFBO(gl, rdTex[0]);
    rdTex[1] = mkTex(gl, tw, th, gl.RG32F, gl.RG, gl.FLOAT, null);
    rdFBO[1] = mkFBO(gl, rdTex[1]);
    visTex   = mkTex(gl, tw, th, gl.R32F, gl.RED, gl.FLOAT, null, gl.LINEAR);
    visFBO   = mkFBO(gl, visTex);
    rd = 0;
    wasInCooldown = false;
    if (!wallTex) buildFallbackWall();
  };

  buildTextures();

  return {
    step(now) {
      // Cycle: reseed after cooldown phase
      const inCooldown = (now % CYCLE_MS) >= ACTIVE_MS;
      if (wasInCooldown && !inCooldown) buildTextures();
      wasInCooldown = inCooldown;

      p.Da    = DA_LO  + (driftBimodal(DA_FREQS,  now)*0.5+0.5)*(DA_HI  - DA_LO);
      p.Dh    = DH_LO  + (driftBimodal(DH_FREQS,  now)*0.5+0.5)*(DH_HI  - DH_LO);
      p.rho   = RHO_LO + (driftBimodal(RHO_FREQS, now)*0.5+0.5)*(RHO_HI - RHO_LO);
      p.mu    = MU_LO  + (driftBimodal(MU_FREQS,  now)*0.5+0.5)*(MU_HI  - MU_LO);
      p.nu    = NU_LO  + (driftBimodal(NU_FREQS,  now)*0.5+0.5)*(NU_HI  - NU_LO);
      p.chaos = C_LO   + (driftBimodal(C_FREQS,   now)*0.5+0.5)*(C_HI   - C_LO);

      gl.bindVertexArray(vao);

      gl.useProgram(pReact);
      gl.bindFramebuffer(gl.FRAMEBUFFER, rdFBO[1-rd]);
      gl.viewport(0, 0, tw, th);
      bindTex(gl, 0, rdTex[rd]);  gl.uniform1i(gl.getUniformLocation(pReact,'uState'), 0);
      bindTex(gl, 1, wallTex!);   gl.uniform1i(gl.getUniformLocation(pReact,'uWall'),  1);
      gl.uniform1f(gl.getUniformLocation(pReact,'uDa'),         p.Da);
      gl.uniform1f(gl.getUniformLocation(pReact,'uDh'),         p.Dh);
      gl.uniform1f(gl.getUniformLocation(pReact,'uRho'),        p.rho);
      gl.uniform1f(gl.getUniformLocation(pReact,'uMu'),         p.mu);
      gl.uniform1f(gl.getUniformLocation(pReact,'uNu'),         p.nu);
      gl.uniform1f(gl.getUniformLocation(pReact,'uChaos'),      p.chaos);
      gl.uniform1f(gl.getUniformLocation(pReact,'uNoiseScale'), 3.5);
      gl.uniform1f(gl.getUniformLocation(pReact,'uTime'),       now);
      gl.uniform1f(gl.getUniformLocation(pReact,'uDt'),         0.8);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      rd = 1 - rd;

      gl.useProgram(pVis);
      gl.bindFramebuffer(gl.FRAMEBUFFER, visFBO);
      gl.viewport(0, 0, tw, th);
      bindTex(gl, 0, rdTex[rd]); gl.uniform1i(gl.getUniformLocation(pVis,'uState'), 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      return visTex;
    },

    resize(w, h) { tw=w; th=h; buildTextures(); },

    setWallTex(tex) { wallTex = tex; },

    destroy() {
      for (let i=0; i<2; i++) {
        if (rdTex[i]) gl.deleteTexture(rdTex[i]);
        if (rdFBO[i]) gl.deleteFramebuffer(rdFBO[i]);
      }
      if (visTex) gl.deleteTexture(visTex);
      if (visFBO) gl.deleteFramebuffer(visFBO);
      gl.deleteProgram(pReact);
      gl.deleteProgram(pVis);
    },
  };
}
