import { useEffect, useState } from 'react';

// "Install the app": Android/Chrome gives us a real prompt (beforeinstallprompt);
// iPhone/iPad has no prompt, so we show the Share → Add to Home Screen steps.

type BIP = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };
let deferred: BIP | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((f) => f());

export function captureInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e as BIP; emit(); });
  window.addEventListener('appinstalled', () => { deferred = null; try { localStorage.setItem('tidyo.installed', '1'); } catch { /* ignore */ } emit(); });
}

export const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

export type Platform = 'ios' | 'ios-inapp' | 'android' | 'desktop';
export function platform(): Platform {
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (ios) return /FBAN|FBAV|Instagram|Line\/|WhatsApp|GSA\//.test(ua) ? 'ios-inapp' : 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}

export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferred) return 'unavailable';
  const e = deferred;
  deferred = null;
  await e.prompt();
  const { outcome } = await e.userChoice;
  emit();
  return outcome;
}

const DISMISS_KEY = 'tidyo.install.dismissed';
export function dismissInstall() { try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* ignore */ } }
function dismissedRecently() {
  try { const v = Number(localStorage.getItem(DISMISS_KEY) || 0); return Date.now() - v < 7 * 864e5; } catch { return false; }
}

/** What the install card should offer on this device, or null to hide it. */
export function useInstall() {
  const [, force] = useState(0);
  useEffect(() => { const f = () => force((n) => n + 1); listeners.add(f); return () => { listeners.delete(f); }; }, []);
  if (isStandalone() || dismissedRecently()) return null;
  try { if (localStorage.getItem('tidyo.installed') === '1') return null; } catch { /* ignore */ }
  const p = platform();
  if (p === 'ios' || p === 'ios-inapp') return { platform: p, canPrompt: false } as const;
  if (deferred) return { platform: p, canPrompt: true } as const;
  if (p === 'android') return { platform: p, canPrompt: false } as const; // e.g. Samsung Internet, Firefox: manual steps
  return null; // desktop without a prompt: nothing to offer
}
