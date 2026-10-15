import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './tokens.css';
import './app.css';

// keep acquisition source from ads (utm_*) for the signup
try {
  const p = new URLSearchParams(window.location.search);
  const utm: Record<string, string> = {};
  p.forEach((v, k) => { if (k.startsWith('utm_')) utm[k] = v; });
  if (Object.keys(utm).length) localStorage.setItem('tidyo.utm', JSON.stringify(utm));
} catch { /* storage unavailable */ }

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
