// Installed app: one opening animation only. The HTML splash (index.html) stays until the session is ready,
// for at least the length of its logo animation, then fades straight into the app.
let released = false;
export function releaseSplash() {
  if (released) return;
  released = true;
  const splash = document.getElementById('splash');
  if (!splash) return;
  const shown = getComputedStyle(splash).display !== 'none';
  const started = (window as Window & { __splashAt?: number }).__splashAt || Date.now();
  const wait = shown ? Math.max(0, 1350 - (Date.now() - started)) : 0;
  window.setTimeout(() => { splash.classList.add('out'); window.setTimeout(() => splash.remove(), 400); }, wait);
}
/** true while the installed-app splash still covers the screen */
export function splashVisible() {
  const s = document.getElementById('splash');
  return !!s && !s.classList.contains('out') && getComputedStyle(s).display !== 'none';
}
/** shared start time so the in-app loader never restarts its animation when it remounts */
export const loaderStart = Date.now();
