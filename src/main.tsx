import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './tokens.css';
import './app.css';
import { captureInstallPrompt } from './lib/install';

captureInstallPrompt();

// keep acquisition source from ads (utm_*) for the signup
try {
  const p = new URLSearchParams(window.location.search);
  const utm: Record<string, string> = {};
  p.forEach((v, k) => { if (k.startsWith('utm_')) utm[k] = v; });
  if (Object.keys(utm).length) localStorage.setItem('tidyo.utm', JSON.stringify(utm));
} catch { /* storage unavailable */ }

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => undefined); });
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);

// Installed app: let the logo animation play (about 1.3 s), then fade the splash out
const splash = document.getElementById('splash');
if (splash) {
  const shown = getComputedStyle(splash).display !== 'none';
  const started = (window as Window & { __splashAt?: number }).__splashAt || Date.now();
  const wait = shown ? Math.max(0, 1350 - (Date.now() - started)) : 0;
  window.setTimeout(() => { splash.classList.add('out'); window.setTimeout(() => splash.remove(), 400); }, wait);
}
