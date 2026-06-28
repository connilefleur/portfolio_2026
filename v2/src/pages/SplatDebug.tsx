import { useEffect, useRef, useState } from 'react';
import { SPLAT_SCENES } from '../data/splatScenes';
import {
  mountSplatViewer, SPLAT_DEBUG_DEFAULTS,
  type SplatDebugParams, type SplatViewerController,
} from '../lib/splatViewer';

// Dev-only splat-ONLY debug harness (no video). Splat on black in a locked 16:9 box,
// with a live control panel over it to dial / rule out every render parameter that could
// cause the quality issues (needle streaks, aliasing, washed colour). Every control applies
// live via controller.setDebug — no remount, no 99MB ply reload.
// Route: /splat  (stick) · /splat?scene=serum

type Stats = { bbW: number; bbH: number; dpr: number; maxPR: number; fov: number; splats: number };
const ZERO_STATS: Stats = { bbW: 0, bbH: 0, dpr: 0, maxPR: 0, fov: 0, splats: 0 };

const TONEMAPS: SplatDebugParams['toneMapping'][] =
  ['none', 'linear', 'filmic', 'hejl', 'aces', 'aces2', 'neutral'];

const initParams = (sceneId: string): SplatDebugParams => {
  const s = SPLAT_SCENES[sceneId];
  const rad = s?.hero.orbitRadius ?? 2;
  return {
    ...SPLAT_DEBUG_DEFAULTS,
    fov: s?.hero.fovVDeg ?? 11,
    near: rad * 0.5,
    far: rad * 10,
    euler: [0, 0, 0],
  };
};

export function SplatDebug() {
  const boxRef = useRef<HTMLDivElement>(null);
  const ctrlRef = useRef<SplatViewerController | null>(null);
  const [sceneId, setSceneId] = useState(
    () => new URLSearchParams(location.search).get('scene') ?? 'stick',
  );
  const [params, setParams] = useState<SplatDebugParams>(() => initParams(sceneId));
  const [status, setStatus] = useState('loading…');
  const [fps, setFps] = useState(0);
  const [stats, setStats] = useState<Stats>(ZERO_STATS);

  useEffect(() => {
    const box = boxRef.current;
    if (!box || !SPLAT_SCENES[sceneId]) { setStatus(`unknown scene "${sceneId}"`); return; }
    const fresh = initParams(sceneId);
    setParams(fresh);
    const ctrl = mountSplatViewer(box, SPLAT_SCENES[sceneId], {
      renderEnabled: true,
      onFps: setFps,
      onStatus: (s) => setStatus(s),
    });
    ctrlRef.current = ctrl;
    // push the (scene-derived) starting values so panel + viewer agree
    ctrl.ready.then(() => ctrl.setDebug(fresh)).catch(() => {});
    const poll = window.setInterval(() => setStats(ctrl.stats()), 250);
    return () => { window.clearInterval(poll); ctrl.dispose(); ctrlRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneId]);

  const set = <K extends keyof SplatDebugParams>(key: K, value: SplatDebugParams[K]): void => {
    setParams((p) => ({ ...p, [key]: value }));
    ctrlRef.current?.setDebug({ [key]: value } as Partial<SplatDebugParams>);
  };
  const setEuler = (i: 0 | 1 | 2, v: number): void => {
    const e: [number, number, number] = [...params.euler];
    e[i] = v;
    set('euler', e);
  };
  const reset = (): void => {
    const fresh = initParams(sceneId);
    setParams(fresh);
    ctrlRef.current?.setDebug(fresh);
  };
  const copy = (): void => {
    navigator.clipboard?.writeText(JSON.stringify(params, null, 2)).catch(() => {});
  };

  return (
    <div style={S.root}>
      <div style={S.stage}>
        <div ref={boxRef} style={S.box} />
      </div>

      <div style={S.panel}>
        <div style={S.scenes}>
          {(['stick', 'serum'] as const).map((id) => (
            <button key={id} onClick={() => setSceneId(id)}
              style={{ ...S.sceneBtn, ...(id === sceneId ? S.sceneBtnOn : {}) }}>{id}</button>
          ))}
        </div>
        <div style={S.stat}>
          {status} · {fps}fps · bb {stats.bbW}×{stats.bbH} · dpr {stats.dpr} ·
          fov {stats.fov}° · {stats.splats.toLocaleString()} splats
        </div>

        <Section title="resolution / sampling">
          <Num label="renderScale" v={params.renderScale} min={0.25} max={3} step={0.05} on={(v) => set('renderScale', v)} />
          <Num label="samples (MSAA)" v={params.samples} min={1} max={4} step={1} on={(v) => set('samples', v)} />
          <Num label="renderTgtScale" v={params.renderTargetScale} min={0.1} max={1} step={0.05} on={(v) => set('renderTargetScale', v)} />
          <Num label="sharpness" v={params.sharpness} min={0} max={1} step={0.05} on={(v) => set('sharpness', v)} />
          <Bool label="HDR float buffer" v={params.hdr} on={(v) => set('hdr', v)} />
          <Bool label="TAA (temporal AA)" v={params.taa} on={(v) => set('taa', v)} />
          <Num label="taaJitter" v={params.taaJitter} min={0} max={1} step={0.05} on={(v) => set('taaJitter', v)} />
        </Section>

        <Section title="gsplat">
          <Bool label="antiAlias (Mip)" v={params.antiAlias} on={(v) => set('antiAlias', v)} />
          <Num label="alphaClip" v={params.alphaClip} min={0} max={0.5} step={0.002} on={(v) => set('alphaClip', v)} />
          <Num label="minContribution" v={params.minContribution} min={0} max={8} step={0.25} on={(v) => set('minContribution', v)} />
          <Num label="minPixelSize" v={params.minPixelSize} min={0} max={8} step={0.25} on={(v) => set('minPixelSize', v)} />
          <Num label="colorUpdateAngle" v={params.colorUpdateAngle} min={0} max={30} step={1} on={(v) => set('colorUpdateAngle', v)} />
          <Bool label="radialSorting" v={params.radialSorting} on={(v) => set('radialSorting', v)} />
        </Section>

        <Section title="camera">
          <Num label="fov (vert °)" v={params.fov} min={1} max={60} step={0.1} on={(v) => set('fov', v)} />
          <Num label="near" v={params.near} min={0.01} max={5} step={0.01} on={(v) => set('near', v)} />
          <Num label="far" v={params.far} min={2} max={100} step={1} on={(v) => set('far', v)} />
        </Section>

        <Section title="tonemap">
          <label style={S.row}>
            <span style={S.lbl}>toneMapping</span>
            <select value={params.toneMapping} onChange={(e) => set('toneMapping', e.target.value as SplatDebugParams['toneMapping'])} style={S.select}>
              {TONEMAPS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
        </Section>

        <Section title="splat orientation (euler °)">
          <Num label="rot X" v={params.euler[0]} min={-180} max={180} step={1} on={(v) => setEuler(0, v)} />
          <Num label="rot Y" v={params.euler[1]} min={-180} max={180} step={1} on={(v) => setEuler(1, v)} />
          <Num label="rot Z" v={params.euler[2]} min={-180} max={180} step={1} on={(v) => setEuler(2, v)} />
        </Section>

        <div style={S.actions}>
          <button onClick={reset} style={S.btn}>reset</button>
          <button onClick={copy} style={S.btn}>copy JSON</button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={S.section}>
      <div style={S.secTitle}>{title}</div>
      {children}
    </div>
  );
}
function Num({ label, v, min, max, step, on }:
  { label: string; v: number; min: number; max: number; step: number; on: (v: number) => void }) {
  return (
    <label style={S.row}>
      <span style={S.lbl}>{label}</span>
      <input type="range" min={min} max={max} step={step} value={v}
        onChange={(e) => on(+e.target.value)} style={S.range} />
      <span style={S.val}>{step >= 1 ? v : v.toFixed(step < 0.01 ? 3 : 2)}</span>
    </label>
  );
}
function Bool({ label, v, on }: { label: string; v: boolean; on: (v: boolean) => void }) {
  return (
    <label style={S.row}>
      <span style={S.lbl}>{label}</span>
      <input type="checkbox" checked={v} onChange={(e) => on(e.target.checked)} style={{ marginLeft: 'auto' }} />
    </label>
  );
}

const S: Record<string, React.CSSProperties> = {
  root: { position: 'fixed', inset: 0, background: '#000', display: 'flex' },
  stage: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 0 },
  box: { position: 'relative', width: 'min(100%, calc(100vh * 16 / 9))', aspectRatio: '16 / 9', background: '#000', overflow: 'hidden' },
  panel: { width: 320, flex: '0 0 320px', height: '100vh', overflowY: 'auto', background: 'rgba(10,12,16,.9)', color: '#cdd6e6', font: '11px/1.5 monospace', padding: 12, boxSizing: 'border-box', borderLeft: '1px solid #20242c' },
  scenes: { display: 'flex', gap: 6, marginBottom: 8 },
  sceneBtn: { flex: 1, padding: '5px 0', background: '#161a20', color: '#9aa6ba', border: '1px solid #262c36', borderRadius: 4, cursor: 'pointer', font: 'inherit' },
  sceneBtnOn: { background: '#1d6fff', color: '#fff', borderColor: '#1d6fff' },
  stat: { color: '#6f7a8c', marginBottom: 10, lineHeight: 1.4 },
  section: { marginBottom: 12 },
  secTitle: { color: '#8ea2ff', textTransform: 'uppercase', letterSpacing: '.06em', fontSize: 10, marginBottom: 4, borderBottom: '1px solid #20242c', paddingBottom: 2 },
  row: { display: 'flex', alignItems: 'center', gap: 6, height: 22 },
  lbl: { width: 96, flex: '0 0 96px', color: '#9aa6ba' },
  range: { flex: 1, minWidth: 0 },
  val: { width: 40, flex: '0 0 40px', textAlign: 'right', color: '#e4e8f2' },
  select: { marginLeft: 'auto', background: '#161a20', color: '#e4e8f2', border: '1px solid #262c36', borderRadius: 4, font: 'inherit', padding: '2px 4px' },
  actions: { display: 'flex', gap: 6, marginTop: 4 },
  btn: { flex: 1, padding: '6px 0', background: '#161a20', color: '#cdd6e6', border: '1px solid #262c36', borderRadius: 4, cursor: 'pointer', font: 'inherit' },
};
