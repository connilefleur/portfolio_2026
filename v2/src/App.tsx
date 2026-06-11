import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Work }    from './pages/Work';
import { Contact } from './pages/Contact';
import { Imprint } from './pages/Imprint';
import { Tools }   from './pages/Tools';
import './styles/globals.css';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"        element={<Work />}    />
        <Route path="/tools"   element={<Tools />}   />
        <Route path="/contact" element={<Contact />} />
        <Route path="/imprint" element={<Imprint />} />
      </Routes>
    </BrowserRouter>
  );
}
