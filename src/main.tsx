import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './tokens.css';
import './app.css';
import './kit.css';
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

// Installed app: the splash is released by the app once the session is ready (see lib/splash.ts).
// Safety net: never keep it longer than 6 s.
import('./lib/splash').then(({ releaseSplash }) => window.setTimeout(releaseSplash, 6000));
