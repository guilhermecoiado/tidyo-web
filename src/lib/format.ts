import type { Lang } from './i18n';

export const money = (cents: number | null | undefined, lang: Lang = 'en') =>
  new Intl.NumberFormat(lang === 'pt-BR' ? 'pt-BR' : lang === 'es' ? 'es-US' : 'en-US', { style: 'currency', currency: 'USD' })
    .format((cents || 0) / 100);

export const time = (iso: string, lang: Lang) =>
  new Date(iso).toLocaleTimeString(lang, { hour: 'numeric', minute: '2-digit' });

export const dayLabel = (d: Date, lang: Lang) =>
  d.toLocaleDateString(lang, { weekday: 'short', day: 'numeric', month: 'short' });

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
export const longDay = (d: Date, lang: Lang) =>
  cap(d.toLocaleDateString(lang, { weekday: 'long', day: 'numeric', month: 'long' }));

export const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
export const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const isoDate = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
export const hoursBetween = (a: string, b?: string | null) =>
  Math.max(0, ((b ? new Date(b) : new Date()).getTime() - new Date(a).getTime()) / 3_600_000);
export const fmtHours = (h: number) => `${Math.floor(h)}h${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;

export const toCents = (v: string) => Math.round(parseFloat((v || '0').replace(',', '.')) * 100) || 0;

export async function sha256Hex(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
export function randomToken(bytes = 24) {
  const a = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...a)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Compact date for tight headers: "Quinta, 15 out" · "Thu, Oct 15" · "Jueves, 15 oct"
export const shortDay = (d: Date, lang: Lang) => {
  const wd = cap(d.toLocaleDateString(lang, { weekday: lang === 'en' ? 'short' : 'long' }).replace(/-feira$/, '').replace(/\.$/, ''));
  const md = d.toLocaleDateString(lang, { day: 'numeric', month: 'short' }).replace(/\./g, '').replace(' de ', ' ');
  return `${wd}, ${md}`;
};
