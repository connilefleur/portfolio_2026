export const QUAD_VS = `#version 300 es
layout(location=0) in vec2 aPos;
out vec2 vUv;
void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0, 1); }`;

export function mkShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
    throw new Error(gl.getShaderInfoLog(s) ?? 'shader error');
  return s;
}

export function mkProg(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram {
  const p   = gl.createProgram()!;
  const vs_ = mkShader(gl, gl.VERTEX_SHADER,   vs);
  const fs_ = mkShader(gl, gl.FRAGMENT_SHADER, fs);
  gl.attachShader(p, vs_);
  gl.attachShader(p, fs_);
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS))
    throw new Error(gl.getProgramInfoLog(p) ?? 'link error');
  // Shaders are baked into the program after linking — detach and free them.
  gl.detachShader(p, vs_); gl.deleteShader(vs_);
  gl.detachShader(p, fs_); gl.deleteShader(fs_);
  return p;
}

export function mkTex(
  gl: WebGL2RenderingContext,
  w: number, h: number,
  ifmt: number, fmt: number, type: number,
  data: ArrayBufferView | null,
  filter: number = gl.NEAREST,
): WebGLTexture {
  const t = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, ifmt, w, h, 0, fmt, type, data);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}

export function mkFBO(gl: WebGL2RenderingContext, tex: WebGLTexture): WebGLFramebuffer {
  const f = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, f);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return f;
}

export function bindTex(gl: WebGL2RenderingContext, unit: number, tex: WebGLTexture): void {
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, tex);
}

export function makeQuad(gl: WebGL2RenderingContext): { vao: WebGLVertexArrayObject; buf: WebGLBuffer } {
  const vao = gl.createVertexArray()!;
  const buf = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
  gl.bindVertexArray(vao);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);
  return { vao, buf };
}
