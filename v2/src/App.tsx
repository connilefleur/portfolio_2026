import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Work }    from './pages/Work';
import { Contact } from './pages/Contact';
import { Imprint } from './pages/Imprint';
import { Tools }   from './pages/Tools';
import './styles/globals.css';

// Dev-only: Sun Matters splat experience, lazy-loaded so its playcanvas/splat deps
// stay out of the main bundle. Route is only registered in dev.
const SunMatters = lazy(() =>
  import('./pages/SunMatters').then((m) => ({ default: m.SunMatters })),
);
// Dev-only splat-only debug harness with a live render-param panel (no video).
const SplatDebug = lazy(() =>
  import('./pages/SplatDebug').then((m) => ({ default: m.SplatDebug })),
);

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"        element={<Work />}    />
        <Route path="/tools"   element={<Tools />}   />
        <Route path="/contact" element={<Contact />} />
        <Route path="/imprint" element={<Imprint />} />
        {import.meta.env.DEV && (
          <Route
            path="/sun-matters"
            element={<Suspense fallback={null}><SunMatters /></Suspense>}
          />
        )}
        {import.meta.env.DEV && (
          <Route
            path="/splat"
            element={<Suspense fallback={null}><SplatDebug /></Suspense>}
          />
        )}
      </Routes>
    </BrowserRouter>
  );
}
