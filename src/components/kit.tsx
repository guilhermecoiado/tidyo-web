// Building blocks taken 1:1 from the canvas "Tidyo App Screens" (sizes, colours, radii).
import type { CSSProperties, ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../lib/session';

export const C = {
  bg: '#F4F7F6', ink: '#0F1F1C', muted: '#566965', line: '#DFE7E5', soft: '#EEF2F1', track: '#E4ECEA',
  accent: '#0B7C6E', dark: '#0F1F1C', mint: '#5FD4C1', brand: '#0A3D35', faint: '#9DB5B0',
};
export const display: CSSProperties = { fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700 };

// Helper colours: each person keeps one colour across agenda, routes and avatars
const PALETTE: [string, string][] = [['#0B7C6E', '#E3F3EF'], ['#B8540E', '#FCEFE3'], ['#5B4BB7', '#EEEBFA'], ['#1F6FB2', '#E6F0FA'], ['#C2412D', '#FDE8E6'], ['#7A5C00', '#FBF1D6'], ['#2E7D32', '#E6F4E7']];
export const colorOf = (i: number) => PALETTE[((i % PALETTE.length) + PALETTE.length) % PALETTE.length];
export const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '·';
export const shortName = (name: string) => { const p = name.trim().split(/\s+/); return p.length > 1 ? `${p[0]} ${p[p.length - 1][0]}.` : p[0] || ''; };

// Status pills (cor + palavra)
export const PILL: Record<string, [string, string]> = {
  ok: ['#E3F1EE', '#0B6B5F'], warn: ['#FDF0DC', '#8A4B05'], neutral: ['#EEF1F0', '#3E4F4C'], danger: ['#FDE8E6', '#9F1F14'], info: ['#E6F0FA', '#1F4E8C'],
};
export function Pill({ tone = 'neutral', children, style }: { tone?: keyof typeof PILL; children: ReactNode; style?: CSSProperties }) {
  const [bg, fg] = PILL[tone];
  return <span className="k-pill" style={{ background: bg, color: fg, ...style }}>{children}</span>;
}
export const jobTone = (s: string): keyof typeof PILL => (s === 'completed' ? 'ok' : s === 'in_progress' ? 'warn' : s === 'canceled' || s === 'no_show' ? 'danger' : 'neutral');

export function Avatar({ name, color, size = 22, font }: { name: string; color: string; size?: number; font?: number }) {
  return <span className="k-avatar" style={{ width: size, height: size, borderRadius: size, background: color, fontSize: font || Math.round(size * 0.46) }}>{initials(name)}</span>;
}

export function LogoMark({ size = 38 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Tidyo" style={{ flex: 'none' }}>
      <rect width="64" height="64" rx="17" fill="#D4F1E9" />
      <g transform="translate(11 8.5) scale(0.7)"><rect x="12" y="9.5" width="36" height="4" rx="2" fill="#12A38F" /><rect x="10" y="12.5" width="40" height="10" rx="5" fill="#0A3D35" /><path d="M30 20 V 44 C 30 51.5, 34 55, 41.5 54" fill="none" stroke="#0A3D35" strokeWidth="7" strokeLinecap="round" /></g>
    </svg>
  );
}

export const SPARK = 'M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z';
export const BELL = 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0';
export function Svg({ d, size = 20, color = 'currentColor', w = 2, fill = 'none' }: { d: string; size?: number; color?: string; w?: number; fill?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={fill === 'none' ? color : 'none'} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
}
export const I = {
  back: 'M15 18l-6-6 6-6', chev: 'M9 6l6 6-6 6', x: 'M6 6l12 12M18 6L6 18', plus: 'M12 5v14M5 12h14', check: 'M5 12l5 5L20 7',
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z', cal: 'M3 5h18v16H3zM3 10h18M8 3v4M16 3v4',
  users: 'M16 20v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 20v-1a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2', more: 'M5 12h.01M12 12h.01M19 12h.01', chat: 'M4 5h16v11H9l-5 4z',
  pay: 'M3 6h18v12H3zM3 10h18M7 15h3', person: 'M20 21v-1a5 5 0 0 0-5-5H9a5 5 0 0 0-5 5v1M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  route: 'M8.5 19H16a3.5 3.5 0 0 0 0-7H8a3.5 3.5 0 0 1 0-7h7.5M6 21.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5zM18 7.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z',
  alert: 'M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  pin: 'M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12zM12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  cam: 'M4 8h3l2-3h6l2 3h3v11H4zM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z', search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  clip: 'M21 12.5l-8.5 8.5a6 6 0 0 1-8.5-8.5l9-9a4 4 0 0 1 5.7 5.7l-9 9a2 2 0 0 1-2.8-2.8l8.5-8.5', send: 'M5 12h14M13 6l6 6-6 6',
  lock: 'M6 11h12v10H6zM8 11V8a4 4 0 0 1 8 0v3', receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6', play: 'M8 5.5v13l11-6.5z',
};

// ── Bottom bar (78 px + safe area, 5 items for the office, 4 for the field team) ──
export function OwnerBar() {
  const { t } = useApp();
  const { pathname } = useLocation();
  const items: [string, string, string, boolean?][] = [
    ['/app', I.home, t('nav.today')],
    ['/app/agenda', I.cal, t('nav.schedule'), pathname.startsWith('/app/rotas')],
    ['/app/clientes', I.users, t('nav.clients')],
    ['/app/financas', I.chart, t('nav.finance'), pathname.startsWith('/app/cobrancas')],
    ['/app/mais', I.more, t('nav.more'), pathname.startsWith('/app/contratos') || pathname.startsWith('/app/conta')],
  ];
  return <Bar items={items} cols={5} />;
}
export function HelperBar() {
  const { t } = useApp();
  const items: [string, string, string, boolean?][] = [
    ['/dia', I.home, t('nav.today')], ['/mensagens', I.chat, t('nav.messages')], ['/dia/pagamentos', I.pay, t('nav.pay')], ['/dia/perfil', I.person, t('nav.profile')],
  ];
  return <Bar items={items} cols={4} />;
}
function Bar({ items, cols }: { items: [string, string, string, boolean?][]; cols: number }) {
  return (
    <nav className="k-bar" aria-label="Menu">
      <div className="k-bar-in" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {items.map(([to, icon, label, extra]) => (
          <NavLink key={to} to={to} end className={({ isActive }) => (isActive || extra ? 'on' : '')}>
            {({ isActive }) => <><Svg d={icon} size={22} w={isActive || extra ? 2 : 1.8} />{label}</>}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

export function Fab({ to, onClick, label }: { to?: string; onClick?: () => void; label: string }) {
  const inner = <Svg d={I.plus} size={24} color="#FFFFFF" w={2.2} />;
  return to ? <Link className="k-fab" to={to} aria-label={label}>{inner}</Link> : <button className="k-fab" onClick={onClick} aria-label={label}>{inner}</button>;
}

/** Screen header: optional back button, title 21 px and a muted line under it */
export function Head({ title, sub, back, right, closeIcon }: { title: ReactNode; sub?: ReactNode; back?: string | (() => void); right?: ReactNode; closeIcon?: boolean }) {
  const nav = useNavigate();
  const { t } = useApp();
  return (
    <div className="k-head">
      {back && (
        <button className="k-iconbtn" aria-label={closeIcon ? t('c.close') : t('c.back')} onClick={() => (typeof back === 'string' ? nav(back) : back())}>
          <Svg d={closeIcon ? I.x : I.back} size={20} color={C.ink} />
        </button>
      )}
      <div className="k-head-t">
        <span className="k-title">{title}</span>
        {sub && <span className="k-sub">{sub}</span>}
      </div>
      {right}
    </div>
  );
}

export function SectionLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return <div className="k-sec"><span>{children}</span>{right}</div>;
}

export function Empty({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="k-empty">
      <span className="k-empty-t">{title}</span>
      {text && <span className="k-empty-s">{text}</span>}
      {action}
    </div>
  );
}

/** Two buttons at the bottom of a sheet: cancel on the left, confirm on the right */
export function SheetActions({ cancel, onCancel, confirm, onConfirm, danger, disabled }: { cancel: string; onCancel: () => void; confirm: string; onConfirm: () => void; danger?: boolean; disabled?: boolean }) {
  return (
    <div className="k-pair">
      <button className="k-btn k-btn-line" onClick={onCancel}>{cancel}</button>
      <button className={`k-btn ${danger ? 'k-btn-danger' : 'k-btn-fill'}`} onClick={onConfirm} disabled={disabled}>{confirm}</button>
    </div>
  );
}

export function Segment<T extends string>({ value, options, onChange, label, small }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string; small?: boolean }) {
  return (
    <div className={`k-seg${small ? ' sm' : ''}`} role="group" aria-label={label} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => <button type="button" key={o.value} aria-pressed={o.value === value} onClick={() => onChange(o.value)}>{o.label}</button>)}
    </div>
  );
}

export function Chips<T extends string>({ value, options, onChange, label, dark = true }: { value: T; options: { value: T; label: ReactNode; dot?: string }[]; onChange: (v: T) => void; label: string; dark?: boolean }) {
  return (
    <div className="k-chips" role="group" aria-label={label}>
      {options.map((o) => (
        <button type="button" key={o.value} className={`k-chip${dark ? '' : ' light'}`} aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.dot && <span className="k-dot" style={{ background: o.dot }} />}{o.label}
        </button>
      ))}
    </div>
  );
}

export function Stepper({ value, onChange, min = 0, max = 99999, step = 1, label }: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; label: string }) {
  return (
    <div className="k-stepper" role="group" aria-label={label}>
      <button type="button" aria-label="−" onClick={() => onChange(Math.max(min, value - step))}>−</button>
      <span className="num">{value.toLocaleString('en-US')}</span>
      <button type="button" aria-label="+" onClick={() => onChange(Math.min(max, value + step))}>+</button>
    </div>
  );
}

/** Compact money for KPI cards: $4.8k, $12k, $940 */
export function compactMoney(cents: number) {
  const v = cents / 100;
  if (Math.abs(v) >= 10000) return `$${Math.round(v / 1000)}k`;
  if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return `$${Math.round(v)}`;
}
export const usd = (cents: number | null | undefined, decimals = false) =>
  `$${((cents || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: decimals ? 2 : 0, maximumFractionDigits: decimals ? 2 : 0 })}`;
/** 2h, 2h30, 45min */
export const dur = (min: number) => { const h = Math.floor(min / 60), m = Math.round(min % 60); return h ? `${h}h${m ? String(m).padStart(2, '0') : ''}` : `${m}min`; };
/** 8:00 / 13:30 for pt and es; 8:00 AM for en */
export const hm = (iso: string | Date, lang: string) => {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return lang === 'en' ? d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
};
