// Route maths used by Rotas, the Tidy review and the helper's navigation
export type Pt = { lat: number; lng: number };
export type Located = { lat: number | null; lng: number | null };

/** Road distance estimate: straight line × 1.3 */
export const km = (a: Pt, b: Pt) => {
  const R = 6371, dLat = ((b.lat - a.lat) * Math.PI) / 180, dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h)) * 1.3;
};
export const pt = (s: Located): Pt | null => (s.lat != null && s.lng != null ? { lat: s.lat, lng: s.lng } : null);
/** ~40 km/h average in town */
export const driveMin = (dKm: number) => Math.round((dKm / 40) * 60);
export const miles = (dKm: number) => dKm * 0.621371;

export function legs(origin: Pt | null, list: Located[], back = false) {
  const pts = [...(origin ? [origin] : []), ...list.map(pt).filter(Boolean) as Pt[], ...(back && origin ? [origin] : [])];
  const out: number[] = [];
  for (let i = 1; i < pts.length; i++) out.push(km(pts[i - 1], pts[i]));
  return out;
}
export const total = (origin: Pt | null, list: Located[], back = false) => legs(origin, list, back).reduce((s, d) => s + d, 0);

/** Nearest neighbour, then 2-opt. Good enough for a cleaner's day (≤ 15 stops). Stops without coordinates keep their place at the end. */
export function optimize<T extends Located>(origin: Pt | null, stops: T[], back = false): T[] {
  const located = stops.filter((s) => pt(s));
  const rest = stops.filter((s) => !pt(s));
  if (located.length < 2) return stops;
  const order: T[] = [];
  const left = [...located];
  let cur: Pt = origin || pt(left[0])!;
  while (left.length) {
    let bi = 0, bd = Infinity;
    left.forEach((s, i) => { const d = km(cur, pt(s)!); if (d < bd) { bd = d; bi = i; } });
    const [n] = left.splice(bi, 1); order.push(n); cur = pt(n)!;
  }
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 0; i < order.length - 1; i++) for (let k = i + 1; k < order.length; k++) {
      const next = [...order.slice(0, i), ...order.slice(i, k + 1).reverse(), ...order.slice(k + 1)];
      if (total(origin, next, back) + 0.01 < total(origin, order, back)) { order.splice(0, order.length, ...next); improved = true; }
    }
  }
  return [...order, ...rest];
}

export function navUrl(origin: Pt | null, stops: { address: string }[]) {
  if (!stops.length) return '';
  const dest = stops[stops.length - 1].address;
  const way = stops.slice(0, -1).map((s) => s.address).join('|');
  return `https://www.google.com/maps/dir/?api=1${origin ? `&origin=${origin.lat},${origin.lng}` : ''}&destination=${encodeURIComponent(dest)}${way ? `&waypoints=${encodeURIComponent(way)}` : ''}&travelmode=driving`;
}

let mapsPromise: Promise<boolean> | null = null;
export function loadMaps() {
  const key = import.meta.env.VITE_GOOGLE_MAPS_KEY;
  if (!key) return Promise.resolve(false);
  if ((window as unknown as { google?: { maps?: unknown } }).google?.maps) return Promise.resolve(true);
  mapsPromise = mapsPromise || new Promise((res) => {
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&v=weekly`;
    s.async = true; s.onload = () => res(true); s.onerror = () => res(false);
    document.head.appendChild(s);
  });
  return mapsPromise;
}
