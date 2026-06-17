import { QUAD_VS, mkProg, mkTex, mkFBO, bindTex } from './glUtils';

// ── Shared shaders ────────────────────────────────────────────────────────────

const ACCUM_FS = `#version 300 es
precision highp float;
uniform sampler2D uField;
uniform sampler2D uAccum;
uniform float uDecay;
in vec2 vUv;
out vec4 fragColor;
void main() {
  float cur  = texture(uField, vUv).r;
  float prev = texture(uAccum, vUv).r;
  fragColor  = vec4(max(prev * uDecay, cur), 0.0, 0.0, 1.0);
}`;

const DISPLAY_FS = `#version 300 es
precision highp float;
uniform sampler2D uField;   // R32F [0,1] visual intensity from engine
uniform sampler2D uAccum;   // R32F trail accumulation
uniform sampler2D uText;    // RGBA text mask at display resolution
uniform vec3  uBg;
uniform vec3  uInk;
uniform int   uDisplace;    // 0=off 1=on
uniform float uTrailStr;    // 0=off, >0 trail strength
in vec2 vUv;
out vec4 fragColor;

void main() {
  vec2 uv = vUv;

  if (uDisplace > 0) {
    vec2 off = 5.0 / vec2(textureSize(uField, 0));
    float dR = texture(uField, uv + vec2(off.x, 0.0)).r;
    float dL = texture(uField, uv - vec2(off.x, 0.0)).r;
    float dU = texture(uField, uv + vec2(0.0, off.y)).r;
    float dD = texture(uField, uv - vec2(0.0, off.y)).r;
    uv += vec2(dR - dL, dU - dD) * 0.013;
    uv  = clamp(uv, 0.001, 0.999);
  }

  float eu    = texture(uField, uv).r;
  float trail = uTrailStr > 0.0 ? texture(uAccum, vUv).r * uTrailStr : 0.0;

  vec2  uv2 = vUv - 0.5;
  float vig = clamp(1.0 - dot(uv2, uv2) * 1.7, 0.0, 1.0);

  vec3 col = mix(uBg, uInk, eu * vig);
  col = min(vec3(1.0), col + uInk * trail * (1.0 - eu * 0.5));

  // Text — always displaced by the live field so sim patterns warp through letterforms
  vec2 tOff = 7.0 / vec2(textureSize(uField, 0));
  float tdR = texture(uField, vUv + vec2(tOff.x, 0.0)).r;
  float tdL = texture(uField, vUv - vec2(tOff.x, 0.0)).r;
  float tdU = texture(uField, vUv + vec2(0.0, tOff.y)).r;
  float tdD = texture(uField, vUv - vec2(0.0, tOff.y)).r;
  vec2 textUv = clamp(vUv + vec2(tdR - tdL, tdU - tdD) * 0.020, 0.001, 0.999);

  float text = texture(uText, textUv).r;
  col = mix(col, vec3(0.0), text * 0.92);

  fragColor = vec4(col, 1.0);
}`;

// ── Public interface ──────────────────────────────────────────────────────────

export interface EffectStack {
  clearAccum(): void;
  render(params: {
    fieldTex: WebGLTexture;
    textTex:  WebGLTexture;
    bg:   readonly [number, number, number];
    ink:  readonly [number, number, number];
    displace:  boolean;
    trailStr:  number;
    vW: number; vH: number;
  }): void;
  resize(TW: number, TH: number): void;
  destroy(): void;
}

export function createEffectStack(
  gl: WebGL2RenderingContext,
  vao: WebGLVertexArrayObject,
  TW: number, TH: number,
): EffectStack {
  const pAccum   = mkProg(gl, QUAD_VS, ACCUM_FS);
  const pDisplay = mkProg(gl, QUAD_VS, DISPLAY_FS);

  // Cache all uniform locations — never call getUniformLocation per frame.
  const uAcc = {
    Field: gl.getUniformLocation(pAccum, 'uField'),
    Accum: gl.getUniformLocation(pAccum, 'uAccum'),
    Decay: gl.getUniformLocation(pAccum, 'uDecay'),
  };
  const uDisp = {
    Field:    gl.getUniformLocation(pDisplay, 'uField'),
    Accum:    gl.getUniformLocation(pDisplay, 'uAccum'),
    Text:     gl.getUniformLocation(pDisplay, 'uText'),
    Bg:       gl.getUniformLocation(pDisplay, 'uBg'),
    Ink:      gl.getUniformLocation(pDisplay, 'uInk'),
    Displace: gl.getUniformLocation(pDisplay, 'uDisplace'),
    TrailStr: gl.getUniformLocation(pDisplay, 'uTrailStr'),
  };
  // Set static sampler bindings once
  gl.useProgram(pAccum);
  gl.uniform1i(uAcc.Field, 0); gl.uniform1i(uAcc.Accum, 1);
  gl.uniform1f(uAcc.Decay, 0.94);
  gl.useProgram(pDisplay);
  gl.uniform1i(uDisp.Field, 0); gl.uniform1i(uDisp.Accum, 1); gl.uniform1i(uDisp.Text, 2);

  let accumTex: [WebGLTexture, WebGLTexture] = [null!, null!];
  let accumFBO: [WebGLFramebuffer, WebGLFramebuffer] = [null!, null!];
  let accumRd = 0;
  let accumW = TW, accumH = TH;

  const buildAccum = (w: number, h: number) => {
    accumW = w; accumH = h;
    for (let i = 0; i < 2; i++) {
      if (accumTex[i]) { gl.deleteTexture(accumTex[i]); gl.deleteFramebuffer(accumFBO[i]); }
      accumTex[i] = mkTex(gl, w, h, gl.R32F, gl.RED, gl.FLOAT, null, gl.LINEAR);
      accumFBO[i] = mkFBO(gl, accumTex[i]);
      gl.bindFramebuffer(gl.FRAMEBUFFER, accumFBO[i]);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    accumRd = 0;
  };

  buildAccum(TW, TH);

  return {
    render({ fieldTex, textTex, bg, ink, displace, trailStr, vW, vH }) {
      gl.bindVertexArray(vao);

      // Accumulation pass (optional — skipped if trailStr is 0)
      if (trailStr > 0) {
        gl.useProgram(pAccum);
        gl.bindFramebuffer(gl.FRAMEBUFFER, accumFBO[1 - accumRd]);
        gl.viewport(0, 0, accumW, accumH);
        bindTex(gl, 0, fieldTex);
        bindTex(gl, 1, accumTex[accumRd]);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        accumRd = 1 - accumRd;
      }

      // Display pass → screen
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, vW, vH);
      gl.useProgram(pDisplay);
      bindTex(gl, 0, fieldTex);
      bindTex(gl, 1, accumTex[accumRd]);
      bindTex(gl, 2, textTex);
      gl.uniform3f(uDisp.Bg,  bg[0],  bg[1],  bg[2]);
      gl.uniform3f(uDisp.Ink, ink[0], ink[1], ink[2]);
      gl.uniform1i(uDisp.Displace, displace ? 1 : 0);
      gl.uniform1f(uDisp.TrailStr, trailStr);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },

    clearAccum() {
      for (let i = 0; i < 2; i++) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, accumFBO[i]);
        gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    },

    resize(w, h) { buildAccum(w, h); },

    destroy() {
      for (let i = 0; i < 2; i++) {
        if (accumTex[i]) gl.deleteTexture(accumTex[i]);
        if (accumFBO[i]) gl.deleteFramebuffer(accumFBO[i]);
      }
      gl.deleteProgram(pAccum);
      gl.deleteProgram(pDisplay);
    },
  };
}
