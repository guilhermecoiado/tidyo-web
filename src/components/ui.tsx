import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, useLocation } from 'react-router-dom';
import { useApp } from '../lib/session';

export function Logo({ size = 36, animated = false }: { size?: number; animated?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="17" fill="#D4F1E9" />
      <g className={animated ? 'tidy-sweep' : undefined}>
        <g transform="translate(11 8.5) scale(0.7)">
          <rect x="12" y="9.5" width="36" height="4" rx="2" fill="#12A38F" />
          <rect x="10" y="12.5" width="40" height="10" rx="5" fill="#0A3D35" />
          <path d="M30 20 V 44 C 30 51.5, 34 55, 41.5 54" fill="none" stroke="#0A3D35" strokeWidth="7" strokeLinecap="round" />
        </g>
      </g>
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="row wordmark" style={{ gap: 8 }}>
      <Logo size={34} />
      <span className="wordmark-text" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, letterSpacing: '-0.035em', color: 'var(--brand-dark)' }}>tidyo</span>
    </span>
  );
}

const P: Record<string, string> = {
  home: 'M3 10.5L12 4l9 6.5V20H3zM9 20v-6h6v6',
  cal: 'M3 5h18v16H3zM3 10h18M8 3v4M16 3v4',
  users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a6 6 0 0 1 12 0v1M16 3.5a4 4 0 0 1 0 7.5M22 21v-1a6 6 0 0 0-4-5.6',
  dollar: 'M3 6h18v12H3zM3 10h18M7 15h3',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  plus: 'M12 5v14M5 12h14',
  x: 'M6 6l12 12M18 6L6 18',
  check: 'M5 12l5 5L20 7',
  chevL: 'M15 6l-6 6 6 6',
  chevR: 'M9 6l6 6-6 6',
  chevU: 'M6 15l6-6 6 6',
  chevD: 'M6 9l6 6 6-6',
  chat: 'M4 5h16v11H9l-5 4z',
  route: 'M8.5 19H16a3.5 3.5 0 0 0 0-7H8a3.5 3.5 0 0 1 0-7h7.5',
  pin: 'M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12zM12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  key: 'M14 10a4 4 0 1 0-3.5 4L7 17.5V20h2.5v-2H12v-2l1.6-1.6A4 4 0 0 0 14 10z',
  alert: 'M12 3l10 18H2zM12 10v4M12 17.5h.01',
  receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18',
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0',
  help: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17h.01',
  logout: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11',
  share: 'M4 12v8h16v-8M12 3v12M7 8l5-5 5 5',
  building: 'M4 21V5l8-2v18M12 7l8 2v12M8 9h.01M8 13h.01M8 17h.01M16 13h.01M16 17h.01',
  mail: 'M3 5h18v14H3zM3 6l9 7 9-7',
  phone: 'M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z',
  download: 'M12 3v12M7 10l5 5 5-5M4 21h16',
};

export function Icon({ name, size = 22, color = 'currentColor', stroke = 2 }: { name: keyof typeof P | string; size?: number; color?: string; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={P[name] || ''} />
    </svg>
  );
}

export function Sparkle({ size = 16, color = '#5FD4C1' }: { size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden="true"><path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9z" /></svg>;
}

// Open overlays form a stack: Escape closes only the top one, and the page stays locked until all are closed.
const stack: { current: () => void }[] = [];
let escBound = false;
function bindEsc() {
  if (escBound) return;
  escBound = true;
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && stack.length) { e.preventDefault(); stack[stack.length - 1].current(); } });
}
function useEscape(onClose: () => void) {
  const ref = useRef(onClose);
  ref.current = onClose;
  useEffect(() => {
    bindEsc();
    const entry = { current: () => ref.current() };
    stack.push(entry);
    document.body.style.overflow = 'hidden';
    return () => {
      const i = stack.indexOf(entry);
      if (i >= 0) stack.splice(i, 1);
      if (!stack.length) document.body.style.overflow = '';
    };
  }, []);
}

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
// Play the closing animation, then unmount
function useClosing(onClose: () => void, ms = 190) {
  const [closing, setClosing] = useState(false);
  const close = useCallback(() => {
    if (reduced()) { onClose(); return; }
    setClosing(true);
    window.setTimeout(onClose, ms);
  }, [onClose, ms]);
  return { closing, close };
}

export function Sheet({ title, onClose, children, dark = false, className = '' }: { title: string; onClose: () => void; children: ReactNode; dark?: boolean; className?: string }) {
  const { t } = useApp();
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const { closing, close } = useClosing(onClose);
  useEscape(close);
  useEffect(() => { ref.current?.focus({ preventScroll: true }); }, []);
  return createPortal(
    <div className={`scrim${closing ? ' closing' : ''}`} onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className={`sheet${dark ? ' dark' : ''} ${className}`} role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1} ref={ref}>
        <span className="grabber" />
        <div className="row">
          <h2 id={id} style={{ flex: 1, minWidth: 0 }}>{title}</h2>
          <button className="icon-btn" style={dark ? { background: 'transparent', borderColor: '#23383A' } : undefined} onClick={close} aria-label={t('c.close')}>
            <Icon name="x" size={18} color={dark ? '#EAF5F2' : undefined} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function Confirm({ text, confirmLabel, danger, onConfirm, onCancel, busy }: { text: string; confirmLabel: string; danger?: boolean; onConfirm: () => void; onCancel: () => void; busy?: boolean }) {
  const { t } = useApp();
  const { closing, close } = useClosing(onCancel, 150);
  useEscape(close);
  return createPortal(
    <div className={`scrim center${closing ? ' closing' : ''}`} onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="dialog" role="alertdialog" aria-modal="true">
        <p style={{ margin: 0, fontWeight: 700, fontSize: 16, lineHeight: 1.45, textWrap: 'pretty' as never }}>{text}</p>
        <div className="k-pair">
          <button className="k-btn k-btn-line" style={{ flex: '0 1 auto', whiteSpace: 'nowrap' }} onClick={close}>{t('c.back')}</button>
          <button className={`k-btn ${danger ? 'k-btn-danger' : 'k-btn-fill'}`} style={{ whiteSpace: 'nowrap', padding: '0 14px' }} onClick={onConfirm} disabled={busy}>{confirmLabel}</button>
        </div>
      </div>
    </div>
,
    document.body,
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="field">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="hint">{hint}</span>}
    </label>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button type="button" key={o.value} aria-pressed={value === o.value} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

export function Skeleton({ h = 56, w = '100%' }: { h?: number; w?: number | string }) {
  return <div className="skeleton" style={{ height: h, width: w }} aria-hidden="true" />;
}

export function LoadingList({ n = 4 }: { n?: number }) {
  const { t } = useApp();
  return (
    <div className="list" aria-busy="true" aria-label={t('c.loading')}>
      {Array.from({ length: n }).map((_, i) => <Skeleton key={i} />)}
    </div>
  );
}

/** Splash (canvas "Splash"): the squeegee flips and sweeps while the session loads */
export function FullLoader() {
  const { t } = useApp();
  return (
    <div className="k-splash">
      <div className="k-splash-bg" aria-hidden="true" />
      <svg width="150" height="150" viewBox="0 0 64 64" role="img" aria-label="Tidyo" style={{ position: 'relative' }}>
        <rect className="k-streak" x="13" y="51.5" width="38" height="2.4" rx="1.2" fill="#12A38F" />
        <g className="k-flip"><g transform="translate(11 8.5) scale(0.7)"><rect x="12" y="9.5" width="36" height="4" rx="2" fill="#12A38F" /><rect x="10" y="12.5" width="40" height="10" rx="5" fill="#0A3D35" /><path d="M30 20 V 44 C 30 51.5, 34 55, 41.5 54" fill="none" stroke="#0A3D35" strokeWidth="7" strokeLinecap="round" /></g></g>
        <path className="k-spark" d="M50 14 l1.2 3.1 3.1 1.2 -3.1 1.2 -1.2 3.1 -1.2 -3.1 -3.1 -1.2 3.1 -1.2 z" fill="#12A38F" />
      </svg>
      <span className="k-splash-word">tidyo</span>
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <span role="status" style={{ fontSize: 14, fontWeight: 600, color: '#2F5B54' }}>{t('sp.loading')}</span>
        <div style={{ width: 140, height: 4, borderRadius: 4, background: '#B5E2D6', overflow: 'hidden' }}><div className="k-bar-run" /></div>
      </div>
    </div>
  );
}

export function OwnerNav() {
  const { t } = useApp();
  const { pathname } = useLocation();
  const items: [string, string, string][] = [
    ['/app', 'home', t('nav.today')],
    ['/app/agenda', 'cal', t('nav.schedule')],
    ['/app/clientes', 'users', t('nav.clients')],
    ['/app/financas', 'dollar', t('nav.finance')],
    ['/app/mais', 'more', t('nav.more')],
  ];
  return (
    <nav className="bottom-nav" aria-label="Menu">
      <div className="inner">
        {items.map(([to, icon, label]) => (
          <NavLink key={to} to={to} end={to === '/app'} className={({ isActive }) => (isActive || (to === '/app/financas' && pathname.startsWith('/app/cobrancas')) ? 'active' : '')}>
            <Icon name={icon} size={22} />
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const { t } = useApp();
  const cls = status === 'completed' ? 'b-ok' : status === 'in_progress' ? 'b-warn' : status === 'canceled' || status === 'no_show' ? 'b-danger' : 'b-neutral';
  return <span className={`badge ${cls}`}>{t(`status.${status}`)}</span>;
}

export function Switch({ checked, onChange, label, hint, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string; disabled?: boolean }) {
  const id = useId();
  return (
    <div className="switch-row">
      <span className="grow" id={id}><span className="bold">{label}</span>{hint && <span className="small muted" style={{ display: 'block' }}>{hint}</span>}</span>
      <button type="button" role="switch" aria-checked={checked} aria-labelledby={id} className="switch" disabled={disabled} onClick={() => onChange(!checked)}><span /></button>
    </div>
  );
}
