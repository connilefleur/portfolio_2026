import { useEffect, useRef, useState } from 'react';
import { SPLAT_SCENES } from '../data/splatScenes';
import {
  mountSplatViewer, PERF_DEFAULTS,
  type PerfParams, type SplatViewerController,
} from '../lib/splatViewer';

// Dev-only splat-ONLY perf/debug harness (no video). Splat on black in a locked 16:9 box
// with a small panel to A/B the speed knobs against an fps + backbuffer + splat-count HUD.
// renderScale + on-demand apply LIVE (setPerf); scene / asset / sorter remount the viewer.
// Route: /splat  (stick) · /splat?scene=serum

type Stats = { fps: number; bbW: number; bbH: number; dpr: number; splats: number };
const ZERO: Stats = { fps: 0, bbW: 0, bbH: 0, dpr: 0, splats: 0 };
const SORTERS: PerfParams['sorter'][] = ['auto', 'cpu', 'gpu', 'compute'];

export function SplatDebug() {
  const boxRef = useRef<HTMLDivElement>(null);
  const ctrlRef = useRef<SplatViewerController | null>(null);
  const [sceneId, setSceneId] = useState(
    () => new URLSearchParams(location.search).get('scene') ?? 'stick',
  );
  // sog (compressed, what /sun-matters ships) vs ply (raw, for A/B).
  const [asset, setAsset] = useState<'sog' | 'ply'>('sog');
  const [sorter, setSorter] = useState<PerfParams['sorter']>('auto');
  // live knobs
  const [renderScale, setRenderScale] = useState(PERF_DEFAULTS.renderScale);
  const [motionScale, setMotionScale] = useState(PERF_DEFAULTS.motionScale);
  const [onDemand, setOnDemand] = useState(PERF_DEFAULTS.onDemand);
  const [status, setStatus] = useState('loading…');
  const [stats, setStats] = useState<Stats>(ZERO);

  // (re)mount when scene / asset / sorter change
  useEffect(() => {
    const box = boxRef.current;
    if (!box || !SPLAT_SCENES[sceneId]) { setStatus(`unknown scene "${sceneId}"`); return; }
    const base = SPLAT_SCENES[sceneId];
    const scene = asset === 'ply'
      ? { ...base, splatUrl: base.splatUrl.replace(/\.sog$/, '.ply') }
      : base;
    setStatus('loading…');
    const ctrl = mountSplatViewer(box, scene, {
      renderEnabled: true, onDemand, sorter,
      onStatus: (s) => setStatus(s),
    });
    ctrlRef.current = ctrl;
    ctrl.ready.then(() => ctrl.setPerf({ renderScale, motionScale })).catch(() => {});
    const poll = window.setInterval(() => setStats(ctrl.stats()), 250);
    return () => { window.clearInterval(poll); ctrl.dispose(); ctrlRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneId, asset, sorter]);

  // live perf
  useEffect(() => { ctrlRef.current?.setPerf({ renderScale }); }, [renderScale]);
  useEffect(() => { ctrlRef.current?.setPerf({ motionScale }); }, [motionScale]);
  useEffect(() => { ctrlRef.current?.setPerf({ onDemand }); }, [onDemand]);

  return (
    <div style={S.root}>
      <div style={S.stage}><div ref={boxRef} style={S.box} /></div>
      <div style={S.panel}>
        <Row2 label="scene" opts={['stick', 'serum'] as const} v={sceneId} on={setSceneId} />
        <Row2 label="asset" opts={['sog', 'ply'] as const} v={asset} on={setAsset} />
        <Row2 label="sorter (remount)" opts={SORTERS} v={sorter} on={setSorter} />

        <div style={S.stat}>
          {status}<br />
          <b>{stats.fps} fps</b> · bb {stats.bbW}×{stats.bbH} · dpr {stats.dpr}<br />
          {stats.splats.toLocaleString()} splats
        </div>

        <label style={S.row}>
          <span style={S.lbl}>renderScale</span>
          <input type="range" min={0.25} max={2} step={0.05} value={renderScale}
            onChange={(e) => setRenderScale(+e.target.value)} style={S.range} />
          <span style={S.val}>{renderScale.toFixed(2)}</span>
        </label>
        <label style={S.row}>
          <span style={S.lbl}>motionScale</span>
          <input type="range" min={0.3} max={1} step={0.05} value={motionScale}
            onChange={(e) => setMotionScale(+e.target.value)} style={S.range} />
          <span style={S.val}>{motionScale.toFixed(2)}</span>
        </label>
        <label style={S.row}>
          <span style={S.lbl}>on-demand</span>
          <input type="checkbox" checked={onDemand} onChange={(e) => setOnDemand(e.target.checked)}
            style={{ marginLeft: 'auto' }} />
        </label>
        <div style={S.hint}>
          on-demand: GPU idles when still, draws on motion.<br />
          off = continuous render (A/B the fps).<br />
          renderScale &lt; 1 = fewer pixels = big GPU win.<br />
          motionScale: res WHILE moving only; snaps to full<br />
          on settle (still frame stays sharp). 1 = off.
        </div>
      </div>
    </div>
  );
}

function Row2<T extends string>(
  { label, opts, v, on }: { label: string; opts: readonly T[]; v: T; on: (v: T) => void },
) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={S.lbl}>{label}</div>
      <div style={S.btns}>
        {opts.map((o) => (
          <button key={o} onClick={() => on(o)}
            style={{ ...S.btn, ...(o === v ? S.btnOn : {}) }}>{o}</button>
        ))}
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  root: { position: 'fixed', inset: 0, background: '#000', display: 'flex' },
  stage: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 0 },
  box: { position: 'relative', width: 'min(100%, calc(100vh * 16 / 9))', aspectRatio: '16 / 9', background: '#000', overflow: 'hidden' },
  panel: { width: 260, flex: '0 0 260px', height: '100vh', overflowY: 'auto', background: 'rgba(10,12,16,.92)', color: '#cdd6e6', font: '11px/1.5 monospace', padding: 12, boxSizing: 'border-box', borderLeft: '1px solid #20242c' },
  stat: { color: '#8aa', margin: '4px 0 12px', lineHeight: 1.5 },
  btns: { display: 'flex', gap: 4 },
  btn: { flex: 1, padding: '4px 0', background: '#161a20', color: '#9aa6ba', border: '1px solid #262c36', borderRadius: 4, cursor: 'pointer', font: 'inherit' },
  btnOn: { background: '#1d6fff', color: '#fff', borderColor: '#1d6fff' },
  row: { display: 'flex', alignItems: 'center', gap: 6, height: 24 },
  lbl: { width: 84, flex: '0 0 84px', color: '#9aa6ba', marginBottom: 3 },
  range: { flex: 1, minWidth: 0 },
  val: { width: 34, flex: '0 0 34px', textAlign: 'right', color: '#e4e8f2' },
  hint: { color: '#6f7a8c', marginTop: 10, lineHeight: 1.5 },
};
