import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ThemeProvider } from './contexts/ThemeContext';
import './styles/fonts.css';
import './styles/global.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider randomizeOnLoad={false}>
      {/* Set randomizeOnLoad={true} to randomize theme on each page load */}
      <App />
    </ThemeProvider>
  </React.StrictMode>
);
