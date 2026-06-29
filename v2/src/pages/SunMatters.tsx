import { InteractiveStage } from '../components/InteractiveStage';

// DEV-only full-screen route for the Sun Matters interactive experience. Kept purely for
// debugging (URL knobs ?debug / ?from / ?ss / ?aa / ?tonemap … are read inside the
// experience). The PRODUCTION entry point is the 'interactive' media item embedded in the
// Sun Matters project (see Viewer + projects.ts). TODO: remove this route once the embed
// is signed off.
export function SunMatters() {
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000' }}>
      <InteractiveStage />
    </div>
  );
}
