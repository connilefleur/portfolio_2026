import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Scope }   from './pages/Scope';
import { List }    from './pages/List';
import { Contact } from './pages/Contact';
import { Imprint } from './pages/Imprint';
import './styles/globals.css';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"        element={<Scope />}   />
        <Route path="/list"    element={<List />}    />
        <Route path="/contact" element={<Contact />} />
        <Route path="/imprint" element={<Imprint />} />
      </Routes>
    </BrowserRouter>
  );
}
