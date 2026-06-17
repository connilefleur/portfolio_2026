import { QUAD_VS, mkProg, mkTex, mkFBO, bindTex } from '../glUtils';
import type { Engine } from '../types';

// Lenia continuous cellular automaton.
// Classic Orbium-family parameters: R=13, mu≈0.156, sigma=0.0118, dt=0.1

const LENIA_R = 13;

const LENIA_FS = `#version 300 es
precision highp float;
uniform sampler2D uState;
uniform float uMu;
uniform float uSigma;
uniform float uDt;
in vec2 vUv;
out vec4 fragColor;

const int R = ${LENIA_R};

float bell(float x, float mu, float s) {
  float d = (x - mu) / s;
  return exp(-0.5 * d * d);
}

void main() {
  vec2 sz = vec2(textureSize(uState, 0));
  vec2 px = 1.0 / sz;
  float U = texture(uState, vUv).r;

  // Ring kernel K(r) = bell(r, 0.5, 0.15)
  float A = 0.0;
  float W = 0.0;
  for (int dy = -R; dy <= R; dy++) {
    for (int dx = -R; dx <= R; dx++) {
      float r = length(vec2(float(dx), float(dy))) / float(R);
      if (r > 1.001) continue;
      float k = bell(r, 0.5, 0.15);
      vec2 sUV = clamp(vUv + vec2(float(dx), float(dy)) * px, px, vec2(1.0) - px);
      A += texture(uState, sUV).r * k;
      W += k;
    }
  }
  A /= max(W, 0.001);

  // Growth: G(A) = 2·bell(A, mu, sigma) − 1
  float G = 2.0 * bell(A, uMu, uSigma) - 1.0;

  float U_new = clamp(U + uDt * G, 0.0, 1.0);
  fragColor = vec4(U_new, 0.0, 0.0, 1.0);
}`;

const VIS_FS = `#version 300 es
precision highp float;
uniform sampler2D uState;
in vec2 vUv;
out vec4 fragColor;
void main() {
  float U  = texture(uState, vUv).r;
  // Show organism body: bright in mid-range, dark at 0 and 1
  float eu = smoothstep(0.02, 0.30, U) * smoothstep(1.00, 0.45, U);
  // Gradient-based specular
  vec2 sz  = vec2(textureSize(uState, 0));
  vec2 off = 2.0 / sz;
  float dR = texture(uState, vUv+vec2(off.x,0)).r;
  float dL = texture(uState, vUv-vec2(off.x,0)).r;
  float dU = texture(uState, vUv+vec2(0,off.y)).r;
  float dD = texture(uState, vUv-vec2(0,off.y)).r;
  vec3  N  = normalize(vec3((dL-dR)*10.0, (dD-dU)*10.0, 1.0));
  vec3  L  = normalize(vec3(0.5, 0.7, 1.4));
  float sp = pow(max(0.0, dot(reflect(-L,N), vec3(0,0,1))), 24.0);
  fragColor = vec4(clamp(eu*1.8 + sp*eu*0.6, 0.0, 1.0), 0.0, 0.0, 1.0);
}`;

// Very small drift around the Orbium attractor — too wide a range kills the organisms
const MU_LO = 0.148, MU_HI = 0.162;
const MU_FX = [0.000193, 0.000137, 0.000281, 0.0000844];
const AMPS   = [0.50, 0.28, 0.14, 0.08];

function driftSine(freqs: number[], now: number): number {
  const norm = AMPS.reduce((a,b)=>a+b,0);
  return AMPS.reduce((v,a,i)=>v+a*Math.sin(2*Math.PI*freqs[i]*now),0)/norm;
}

export function createLeniaEngine(
  gl: WebGL2RenderingContext,
  vao: WebGLVertexArrayObject,
  TW: number, TH: number,
): Engine {
  const pStep = mkProg(gl, QUAD_VS, LENIA_FS);
  const pVis  = mkProg(gl, QUAD_VS, VIS_FS);

  let rdTex:  [WebGLTexture, WebGLTexture] = [null!, null!];
  let rdFBO:  [WebGLFramebuffer, WebGLFramebuffer] = [null!, null!];
  let visTex: WebGLTexture = null!;
  let visFBO: WebGLFramebuffer = null!;
  let rd = 0;
  let tw = TW, th = TH;
  let lastSeedTime = 0;
  const RESEED_MS = 28_000;

  const seed = (): Float32Array => {
    const d = new Float32Array(tw * th);
    // Orbium canonical seed: smooth Gaussian discs, sigma≈0.35*R
    // The ring kernel (sampling at ~R/2) then sees ~mu=0.156, allowing self-sustain.
    const nOrbs = 8 + Math.floor(Math.random() * 6);
    for (let n = 0; n < nOrbs; n++) {
      const cx  = 0.08*tw + Math.random()*0.84*tw;
      const cy  = 0.08*th + Math.random()*0.84*th;
      const amp = 0.50 + Math.random()*0.12;
      const sg  = LENIA_R * (0.30 + Math.random()*0.10);
      const sg2 = 2 * sg * sg;
      const lim = Math.ceil(3 * sg);
      for (let dy = -lim; dy <= lim; dy++) {
        for (let dx = -lim; dx <= lim; dx++) {
          const px = Math.round(cx) + dx;
          const py = Math.round(cy) + dy;
          if (px<0||px>=tw||py<0||py>=th) continue;
          const v = amp * Math.exp(-(dx*dx + dy*dy) / sg2);
          d[py*tw+px] = Math.max(d[py*tw+px], v);
        }
      }
    }
    return d;
  };

  const buildTextures = () => {
    for (let i=0; i<2; i++) {
      if (rdTex[i]) { gl.deleteTexture(rdTex[i]); gl.deleteFramebuffer(rdFBO[i]); }
    }
    if (visTex) { gl.deleteTexture(visTex); gl.deleteFramebuffer(visFBO); }
    const s = seed();
    rdTex[0] = mkTex(gl, tw, th, gl.R32F, gl.RED, gl.FLOAT, s);
    rdFBO[0] = mkFBO(gl, rdTex[0]);
    rdTex[1] = mkTex(gl, tw, th, gl.R32F, gl.RED, gl.FLOAT, null);
    rdFBO[1] = mkFBO(gl, rdTex[1]);
    visTex   = mkTex(gl, tw, th, gl.R32F, gl.RED, gl.FLOAT, null, gl.LINEAR);
    visFBO   = mkFBO(gl, visTex);
    rd = 0;
  };

  buildTextures();

  return {
    step(now) {
      if (lastSeedTime === 0) lastSeedTime = now;
      if (now - lastSeedTime > RESEED_MS) {
        lastSeedTime = now;
        buildTextures();
      }

      const mu    = MU_LO + (driftSine(MU_FX, now)*0.5+0.5)*(MU_HI-MU_LO);
      const sigma = 0.0118;
      const dt    = 0.14;

      gl.bindVertexArray(vao);

      gl.useProgram(pStep);
      gl.bindFramebuffer(gl.FRAMEBUFFER, rdFBO[1-rd]);
      gl.viewport(0, 0, tw, th);
      bindTex(gl, 0, rdTex[rd]); gl.uniform1i(gl.getUniformLocation(pStep,'uState'), 0);
      gl.uniform1f(gl.getUniformLocation(pStep,'uMu'),    mu);
      gl.uniform1f(gl.getUniformLocation(pStep,'uSigma'), sigma);
      gl.uniform1f(gl.getUniformLocation(pStep,'uDt'),    dt);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      rd = 1-rd;

      gl.useProgram(pVis);
      gl.bindFramebuffer(gl.FRAMEBUFFER, visFBO);
      gl.viewport(0, 0, tw, th);
      bindTex(gl, 0, rdTex[rd]); gl.uniform1i(gl.getUniformLocation(pVis,'uState'), 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      return visTex;
    },

    resize(w, h) { tw=w; th=h; buildTextures(); },
    destroy() {
      for (let i=0; i<2; i++) {
        if (rdTex[i]) gl.deleteTexture(rdTex[i]);
        if (rdFBO[i]) gl.deleteFramebuffer(rdFBO[i]);
      }
      if (visTex) gl.deleteTexture(visTex);
      if (visFBO) gl.deleteFramebuffer(visFBO);
      gl.deleteProgram(pStep);
      gl.deleteProgram(pVis);
    },
  };
}
