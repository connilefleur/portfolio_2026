import { useEffect, useRef, useState } from 'react';
import { SPLAT_SCENES } from '../data/splatScenes';
import { mountSplatViewer, type SplatViewerController } from '../lib/splatViewer';

// Dev alignment harness: mounts the shared splat viewer and exposes live DOF
// sliders + a reference-frame overlay to verify splat≡frame registration.
export function SplatTest() {
  const boxRef = useRef<HTMLDivElement>(null);
  const ctrlRef = useRef<SplatViewerController | null>(null);
  const [sceneId] = useState(() => new URLSearchParams(location.search).get('scene') || 'serum');
  const [status, setStatus] = useState('loading…');
  const [fps, setFps] = useState(0);
  const [patched, setPatched] = useState<boolean | null>(null);
  const [refOpacity, setRefOpacity] = useState(0);

  const scene = SPLAT_SCENES[sceneId];
  const [dofOn, setDofOn] = useState(true);
  const [focus, setFocus] = useState(scene?.hero.orbitRadius ?? 3);
  const [aperture, setAperture] = useState(180);
  const [maxCoC, setMaxCoC] = useState(12);
  const [samples, setSamples] = useState(20);

  useEffect(() => {
    const box = boxRef.current;
    if (!box || !scene) return;
    const ctrl = mountSplatViewer(box, scene, {
      onFps: setFps,
      onStatus: (s, p) => { setStatus(s); setPatched(p); },
    });
    ctrlRef.current = ctrl;
    return () => { ctrl.dispose(); ctrlRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene]);

  useEffect(() => {
    ctrlRef.current?.setDof({ dofOn, focus, aperture, maxCoC, samples });
  }, [dofOn, focus, aperture, maxCoC, samples]);

  if (!scene) return <div style={{ padding: 24, color: '#fff', font: '13px monospace' }}>unknown scene — use ?scene=serum or ?scene=stick</div>;

  const row: React.CSSProperties = { display: 'block', marginTop: 6 };
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div ref={boxRef} style={{ position: 'relative', width: 'min(100vw, calc(100vh * 16 / 9))', aspectRatio: '16 / 9', background: '#101014' }}>
        <img src={scene.refFrameUrl} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'fill', opacity: refOpacity, pointerEvents: 'none', zIndex: 2 }} />
      </div>
      <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 10, padding: '10px 12px', background: 'rgba(0,0,0,.72)', color: '#e4e8f2', font: '12px/1.5 monospace', borderRadius: 6, width: 250 }}>
        <div>scene: <b>{scene.id}</b> · {status} · <b>{fps} fps</b></div>
        <div style={{ opacity: 0.7 }}>gather DOF · shader: {patched === null ? '…' : patched ? '✓' : 'FAILED ✗'}</div>
        <label style={row}><input type="checkbox" checked={dofOn} onChange={(e) => setDofOn(e.target.checked)} /> DOF on</label>
        <label style={row}>focus: {focus.toFixed(2)}
          <input type="range" min={0.2} max={8} step={0.01} value={focus} onChange={(e) => setFocus(+e.target.value)} style={{ width: '100%' }} /></label>
        <label style={row}>aperture (blur): {aperture.toFixed(0)}
          <input type="range" min={0} max={400} step={1} value={aperture} onChange={(e) => setAperture(+e.target.value)} style={{ width: '100%' }} /></label>
        <label style={row}>max CoC (px): {maxCoC.toFixed(0)}
          <input type="range" min={0} max={120} step={1} value={maxCoC} onChange={(e) => setMaxCoC(+e.target.value)} style={{ width: '100%' }} /></label>
        <label style={row}>samples: {samples.toFixed(0)}
          <input type="range" min={8} max={64} step={1} value={samples} onChange={(e) => setSamples(+e.target.value)} style={{ width: '100%' }} /></label>
        <label style={row}>ref overlay: {refOpacity.toFixed(2)}
          <input type="range" min={0} max={1} step={0.01} value={refOpacity} onChange={(e) => setRefOpacity(+e.target.value)} style={{ width: '100%' }} /></label>
      </div>
    </div>
  );
}
