import { useEffect, useRef, useState } from 'react';
import { SPLAT_SCENES } from '../data/splatScenes';
import { mountSplatViewer } from '../lib/splatViewer';

// Dev-only standalone splat viewer — NO video, NO compositing. Just the splat on
// black, with parallax, for diagnosing quality (sharpness / colour / orientation)
// in isolation.
// Route: /splat-view?scene=stick|serum&splateuler=x,y,z&focaladj=2
// Quality/compositing A/B knobs (all optional, override the highest-quality defaults):
//   &sortradial=0|1  &maxstddev=2.83  &blur=0.3  &preblur=0.3  &minalpha=0.002
//   &clipxy=2  &premult=0|1  &linear=0|1  &dpr=3
export function SplatView() {
  const boxRef = useRef<HTMLDivElement>(null);
  const [fps, setFps] = useState(0);
  const [status, setStatus] = useState('loading…');

  const sp = new URLSearchParams(location.search);
  const scene = sp.get('scene') ?? 'stick';
  const splatEuler = ((): [number, number, number] | undefined => {
    const s = sp.get('splateuler'); if (!s) return undefined;
    const a = s.split(',').map(Number);
    return a.length === 3 && a.every((n) => !Number.isNaN(n)) ? [a[0], a[1], a[2]] : undefined;
  })();
  const num = (k: string): number | undefined => { const v = sp.get(k); if (v === null) return undefined; const n = +v; return Number.isNaN(n) ? undefined : n; };
  const bool = (k: string): boolean | undefined => { const v = sp.get(k); return v === null ? undefined : v !== '0' && v !== 'false'; };

  useEffect(() => {
    const box = boxRef.current;
    if (!box || !SPLAT_SCENES[scene]) { setStatus(`unknown scene "${scene}"`); return; }
    const ctrl = mountSplatViewer(box, SPLAT_SCENES[scene], {
      renderEnabled: true, splatEuler,
      dprCap: num('dpr'),
      onFps: setFps,
      onStatus: (s) => setStatus(s),
    });
    return () => ctrl.dispose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* locked 16:9 box so v+h FOV match the 1920×1080 hero camera exactly */}
      <div ref={boxRef} style={{ position: 'relative', width: 'min(100vw, calc(100vh * 16 / 9))', aspectRatio: '16 / 9', background: '#000', overflow: 'hidden' }} />
      <div style={{ position: 'absolute', top: 8, left: 8, padding: '5px 9px', background: 'rgba(0,0,0,.6)', color: '#9fe', font: '11px/1.4 monospace', borderRadius: 4, pointerEvents: 'none' }}>
        {scene} · {status} · {fps} fps · sort {bool('sortradial') ?? false ? 'radial' : 'zdepth'}{splatEuler ? ` · eul ${splatEuler.join(',')}` : ''}{sp.get('focaladj') ? ` · foc ${sp.get('focaladj')}` : ''}{sp.toString() ? ` · ${sp.toString()}` : ''}
      </div>
    </div>
  );
}
