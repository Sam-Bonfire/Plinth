import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.js';
import '@plinth/ui-kit/tokens.css';
import { loadPlinthFonts } from '@plinth/ui-kit/fonts/loader.js';

loadPlinthFonts();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
