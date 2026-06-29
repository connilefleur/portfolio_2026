// Shared Gaussian-splat viewer: self-managed built-in Viewer rendered to an
// offscreen target, with mouse-follow parallax (±5°), spring-zoom, and a
// gather/mip depth-of-field pass. Consumed by both the dev alignment harness
// (SplatTest) and the Sun Matters video↔splat experience.
//
// The built-in Viewer is run self-managed (own renderer + camera, selfDrivenMode
// off) so we can capture the splat raster to a render target and post-process it.
import * as THREE from 'three';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import * as GaussianSplats3D from '@mkkellogg/gaussian-splats-3d';
import type { SplatScene } from '../data/splatScenes';

const MAX_AZ = 5, MAX_EL = 5, DAMP = 0.07;

// splat shader anchors (mkkellogg 0.4.7)
const VS_UNIFORM_ANCHOR = 'uniform float splatScale;';
const VS_COV_ANCHOR = 'vec3 cov2Dv = vec3(cov2Dm[0][0], cov2Dm[0][1], cov2Dm[1][1]);';
const FS_DECL_ANCHOR = 'uniform vec3 debugColor;';
const FS_OUTPUT_ANCHOR = 'gl_FragColor = vec4(color.rgb, opacity);';

// Color grade — a small display-space (sRGB) grade shared by the bokeh and the
// grade-only passes so the splat picks up a touch of colour/contrast to better
// sit against the graded footage. Identity by default; dialed live via setGrade.
const GRADE_GLSL = /* glsl */`
  uniform float gradeOn, gExposure, gBrightness, gContrast, gSaturation, gTemperature, gTint;
  vec3 applyGrade(vec3 c){
    if (gradeOn < 0.5) return c;
    c *= gExposure;                       // exposure (multiply)
    c += gBrightness;                     // lift (add)
    c.r += gTemperature; c.b -= gTemperature; // warm / cool
    c.g += gTint;                         // green / magenta
    c = (c - 0.5) * gContrast + 0.5;      // contrast about mid grey
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    c = mix(vec3(l), c, gSaturation);     // saturation
    return clamp(c, 0.0, 1.0);
  }
`;

// gather bokeh — soft, in-place, depth-driven, MIP-based (pyramid) for speed.
const BOKEH_FRAG = /* glsl */`
  precision highp float;
  uniform sampler2D tColor;
  uniform sampler2D tDepth;
  uniform vec2 texel;
  uniform float focus, aperture, maxCoC, samples, dofOn;
  in vec2 vUv;
  out vec4 fragColor;
${GRADE_GLSL}
  float depthAt(vec2 uv){ vec4 d = texture(tDepth, uv); return d.r / max(d.a, 1e-3); }
  float cocAt(float depth){
    if (depth <= 0.0) return 0.0;
    return min(aperture * abs(1.0/focus - 1.0/depth), maxCoC); // pixels
  }
  void main(){
    vec4 center = texture(tColor, vUv);
    float cCoC = cocAt(depthAt(vUv));
    if (dofOn < 0.5 || cCoC < 1.0){ fragColor = vec4(applyGrade(center.rgb), center.a); return; }
    float lod = max(log2(cCoC / sqrt(samples)), 0.0);
    vec3 col = center.rgb; float total = 1.0;
    const float GOLDEN = 2.39996323;
    for (float i = 0.0; i < 64.0; i += 1.0){
      if (i >= samples) break;
      float t = (i + 0.5) / samples;
      float r = sqrt(t) * cCoC;
      float ang = i * GOLDEN;
      vec2 suv = vUv + vec2(cos(ang), sin(ang)) * r * texel;
      float sCoC = cocAt(depthAt(suv));
      float w = clamp(sCoC - r + 1.0, 0.0, 1.0);
      col += textureLod(tColor, suv, lod).rgb * w; total += w;
    }
    fragColor = vec4(applyGrade(col / total), 1.0);
  }
`;
const BOKEH_VERT = 'out vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

// grade-only pass (sharp / DOF-off path): just blit colorRT through the grade.
const GRADE_FRAG = /* glsl */`
  precision highp float;
  uniform sampler2D tColor;
  in vec2 vUv;
  out vec4 fragColor;
${GRADE_GLSL}
  void main(){ vec4 c = texture(tColor, vUv); fragColor = vec4(applyGrade(c.rgb), c.a); }
`;

export interface DofParams {
  dofOn: boolean;
  focus: number;
  aperture: number;
  maxCoC: number;
  samples: number;
}

export interface GradeParams {
  gradeOn: boolean;
  exposure: number;    // multiply (1 = neutral)
  brightness: number;  // add (0 = neutral)
  contrast: number;    // about mid grey (1 = neutral)
  saturation: number;  // (1 = neutral)
  temperature: number; // warm(+)/cool(−), add to R, subtract from B (0 = neutral)
  tint: number;        // green(+)/magenta(−), add to G (0 = neutral)
}

export const GRADE_DEFAULTS: GradeParams = {
  gradeOn: true, exposure: 1, brightness: 0, contrast: 1, saturation: 1, temperature: 0, tint: 0,
};

export interface MountOptions {
  /** Initial DOF params; focus defaults to the scene orbit radius. */
  dof?: Partial<DofParams>;
  /** Initial colour-grade params; identity by default. */
  grade?: Partial<GradeParams>;
  /** Start the render loop once loaded (default true). Set false to preload silently. */
  renderEnabled?: boolean;
  onFps?: (fps: number) => void;
  onStatus?: (status: string, patched: boolean | null) => void;
}

export interface SplatViewerController {
  /** Resolves once the splat is loaded and the render loop is running. */
  ready: Promise<void>;
  canvas: HTMLCanvasElement;
  setDof: (p: Partial<DofParams>) => void;
  /** Live colour grade — applied in both the sharp and DOF passes. */
  setGrade: (p: Partial<GradeParams>) => void;
  /** Start/stop the render loop — off while the experience is closed (no GL work). */
  setRenderEnabled: (enabled: boolean) => void;
  /** When false, parallax targets ease back to the hero pose and pointer input is ignored. */
  setInputEnabled: (enabled: boolean) => void;
  /** True once the camera has settled within eps of the exact hero pose. */
  atHero: (eps?: number) => boolean;
  /** Frames rendered since the loop was last (re)enabled — gate crossfades on warmth. */
  warmFrames: () => number;
  /** Crossfade helper — sets the splat canvas opacity (0..1). */
  setOpacity: (o: number) => void;
  dispose: () => void;
}

export function mountSplatViewer(
  box: HTMLElement,
  scene: SplatScene,
  opts: MountOptions = {},
): SplatViewerController {
  const w = box.clientWidth, h = box.clientHeight;
  const pr = Math.min(window.devicePixelRatio, 1.5);

  const dof: DofParams = {
    dofOn: true,
    focus: scene.hero.orbitRadius,
    aperture: 180,
    maxCoC: 12,
    samples: 20,
    ...opts.dof,
  };
  const grade: GradeParams = { ...GRADE_DEFAULTS, ...opts.grade };
  const gradeUniforms = (g: GradeParams): Record<string, { value: number }> => ({
    gradeOn: { value: g.gradeOn ? 1 : 0 },
    gExposure: { value: g.exposure }, gBrightness: { value: g.brightness },
    gContrast: { value: g.contrast }, gSaturation: { value: g.saturation },
    gTemperature: { value: g.temperature }, gTint: { value: g.tint },
  });

  const renderer = new THREE.WebGLRenderer({ antialias: false, precision: 'highp' });
  renderer.setPixelRatio(pr);
  renderer.setSize(w, h);
  renderer.domElement.style.cssText =
    'position:absolute;inset:0;width:100%;height:100%;z-index:1';
  box.appendChild(renderer.domElement);

  const dw = Math.floor(w * pr), dh = Math.floor(h * pr);
  const colorRT = new THREE.WebGLRenderTarget(dw, dh, {
    type: THREE.UnsignedByteType,
    minFilter: THREE.LinearMipmapLinearFilter, // mip chain for the pyramid gather
    magFilter: THREE.LinearFilter,
    generateMipmaps: true,
  });
  // depth at half-res: CoC is low-frequency, and the splat depth pass is the
  // expensive part (fill-rate). Quarter the fill, correct map (NDC-independent).
  const depthRT = new THREE.WebGLRenderTarget(Math.max(1, dw >> 1), Math.max(1, dh >> 1), { type: THREE.HalfFloatType });

  const bokeh = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: BOKEH_VERT, fragmentShader: BOKEH_FRAG,
    uniforms: {
      tColor: { value: colorRT.texture }, tDepth: { value: depthRT.texture },
      texel: { value: new THREE.Vector2(1 / dw, 1 / dh) },
      focus: { value: dof.focus }, aperture: { value: dof.aperture }, maxCoC: { value: dof.maxCoC },
      samples: { value: dof.samples }, dofOn: { value: dof.dofOn ? 1 : 0 },
      ...gradeUniforms(grade),
    },
    depthTest: false, depthWrite: false,
  });
  const quad = new FullScreenQuad(bokeh);

  // grade-only material for the sharp (DOF-off) path.
  const gradeMat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: BOKEH_VERT, fragmentShader: GRADE_FRAG,
    uniforms: { tColor: { value: colorRT.texture }, ...gradeUniforms(grade) },
    depthTest: false, depthWrite: false,
  });
  const gradeQuad = new FullScreenQuad(gradeMat);

  const threeScene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(scene.hero.fovVDeg, w / h, 0.01, 100);
  const viewer = new GaussianSplats3D.Viewer({
    renderer, threeScene, camera,
    selfDrivenMode: false, useBuiltInControls: false,
    sharedMemoryForWorkers: false, sphericalHarmonicsDegree: 0,
  });

  const matRef = { current: null as THREE.ShaderMaterial | null };

  // patch splat shader: add a depth-output mode (sharp color otherwise)
  const patchShader = (): void => {
    const mat = viewer.splatMesh?.material;
    if (!mat) { opts.onStatus?.('loaded', false); return; }
    let vs = mat.vertexShader, fs = mat.fragmentShader;
    if (![VS_UNIFORM_ANCHOR, VS_COV_ANCHOR].every((a) => vs.includes(a)) ||
        ![FS_DECL_ANCHOR, FS_OUTPUT_ANCHOR].every((a) => fs.includes(a))) {
      opts.onStatus?.('loaded', false); console.warn('[dof] anchors not found'); return;
    }
    vs = vs.replace(VS_UNIFORM_ANCHOR, `${VS_UNIFORM_ANCHOR}\nvarying float vViewDepth;`);
    vs = vs.replace(VS_COV_ANCHOR, `vViewDepth = -viewCenter.z;\n${VS_COV_ANCHOR}`);
    fs = fs.replace(FS_DECL_ANCHOR, `${FS_DECL_ANCHOR}\nuniform float dofOutputMode;\nvarying float vViewDepth;`);
    fs = fs.replace(FS_OUTPUT_ANCHOR,
      `if (dofOutputMode > 0.5) gl_FragColor = vec4(vec3(vViewDepth), opacity);
       else gl_FragColor = vec4(color.rgb, opacity);`);
    mat.vertexShader = vs; mat.fragmentShader = fs;
    mat.uniforms.dofOutputMode = { value: 0 };
    mat.needsUpdate = true;
    matRef.current = mat;
    opts.onStatus?.('loaded', true);
  };

  // parallax + spring zoom
  const center = new THREE.Vector3(...scene.hero.orbitCenter);
  const baseOffset = new THREE.Vector3(...scene.hero.worldPosition).sub(center);
  const up = new THREE.Vector3(0, 1, 0);
  const maxAz = THREE.MathUtils.degToRad(MAX_AZ), maxEl = THREE.MathUtils.degToRad(MAX_EL);
  let tgtAz = 0, tgtEl = 0, curAz = 0, curEl = 0, tgtZoom = 0, curZoom = 0;
  let inputEnabled = true;

  const onMove = (e: PointerEvent): void => {
    if (!inputEnabled) return;
    const r = box.getBoundingClientRect();
    tgtAz = -(((e.clientX - r.left) / r.width) * 2 - 1) * maxAz;
    tgtEl = -(((e.clientY - r.top) / r.height) * 2 - 1) * maxEl;
  };
  const onLeave = (): void => { tgtAz = 0; tgtEl = 0; };
  const onWheel = (e: WheelEvent): void => {
    if (!inputEnabled) return;
    e.preventDefault();
    tgtZoom = THREE.MathUtils.clamp(tgtZoom - e.deltaY * 0.0009, -0.1, 0.32);
  };
  box.addEventListener('pointermove', onMove);
  box.addEventListener('pointerleave', onLeave);
  box.addEventListener('wheel', onWheel, { passive: false });

  let disposed = false, raf = 0, frames = 0, fpsT = performance.now();
  let loaded = false, running = false, warm = 0;
  let renderEnabled = opts.renderEnabled ?? true;

  const startLoop = (): void => {
    if (running || disposed || !loaded || !renderEnabled) return;
    running = true; fpsT = performance.now(); frames = 0; warm = 0;
    raf = requestAnimationFrame(loop);
  };
  const stopLoop = (): void => { running = false; cancelAnimationFrame(raf); };

  const loop = (): void => {
    if (!running) return;
    raf = requestAnimationFrame(loop);
    curAz += (tgtAz - curAz) * DAMP; curEl += (tgtEl - curEl) * DAMP;
    tgtZoom *= 0.86; curZoom += (tgtZoom - curZoom) * 0.18;
    const offset = baseOffset.clone().applyAxisAngle(up, curAz);
    const right = new THREE.Vector3().crossVectors(up, offset).normalize();
    offset.applyAxisAngle(right, curEl).multiplyScalar(1 - curZoom);
    camera.position.copy(center).add(offset); camera.up.copy(up); camera.lookAt(center);

    viewer.update();
    const mat = matRef.current;
    if (mat?.uniforms.dofOutputMode) mat.uniforms.dofOutputMode.value = 0;
    // splat colour → colorRT every frame; the grade/bokeh pass reads from it.
    renderer.setRenderTarget(colorRT); viewer.render();
    const dofActive = !!mat?.uniforms.dofOutputMode && bokeh.uniforms.dofOn.value > 0.5;
    if (dofActive) {
      renderer.setRenderTarget(depthRT); mat!.uniforms.dofOutputMode.value = 1; viewer.render();
      mat!.uniforms.dofOutputMode.value = 0;
      renderer.setRenderTarget(null); quad.render(renderer);      // bokeh + grade
    } else {
      renderer.setRenderTarget(null); gradeQuad.render(renderer); // grade only (sharp path)
    }

    frames++; warm++;
    const now = performance.now();
    if (now - fpsT >= 500) { opts.onFps?.(Math.round((frames * 1000) / (now - fpsT))); frames = 0; fpsT = now; }
  };

  const ready = viewer.addSplatScene(scene.splatUrl, { progressiveLoad: true, showLoadingUI: false })
    .then(() => {
      if (disposed) return;
      camera.fov = scene.hero.fovVDeg; camera.updateProjectionMatrix();
      patchShader();
      loaded = true;
      startLoop();
    })
    .catch((e: unknown) => {
      if (!disposed) { opts.onStatus?.('load error', null); console.error('[splat] load failed', e); }
      throw e;
    });

  return {
    ready,
    canvas: renderer.domElement,
    setDof: (p) => {
      Object.assign(dof, p);
      bokeh.uniforms.focus.value = dof.focus;
      bokeh.uniforms.aperture.value = dof.aperture;
      bokeh.uniforms.maxCoC.value = dof.maxCoC;
      bokeh.uniforms.samples.value = dof.samples;
      bokeh.uniforms.dofOn.value = dof.dofOn ? 1 : 0;
    },
    setGrade: (p) => {
      Object.assign(grade, p);
      const u = gradeUniforms(grade);
      for (const m of [bokeh, gradeMat]) {
        for (const k in u) m.uniforms[k].value = u[k].value;
      }
    },
    setRenderEnabled: (enabled) => {
      renderEnabled = enabled;
      if (enabled) startLoop(); else stopLoop();
    },
    setInputEnabled: (enabled) => {
      inputEnabled = enabled;
      if (!enabled) { tgtAz = 0; tgtEl = 0; tgtZoom = 0; } // ease back to hero
    },
    atHero: (eps = 0.002) =>
      Math.abs(curAz) < eps && Math.abs(curEl) < eps && Math.abs(curZoom) < eps,
    warmFrames: () => warm,
    setOpacity: (o) => { renderer.domElement.style.opacity = String(o); },
    dispose: () => {
      disposed = true;
      stopLoop();
      box.removeEventListener('pointermove', onMove);
      box.removeEventListener('pointerleave', onLeave);
      box.removeEventListener('wheel', onWheel);
      quad.dispose(); gradeQuad.dispose(); colorRT.dispose(); depthRT.dispose();
      try { viewer.dispose(); } catch { /* ignore */ }
      renderer.dispose();
      if (renderer.domElement.parentNode === box) box.removeChild(renderer.domElement);
    },
  };
}
