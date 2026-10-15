import { Children, isValidElement, useEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { useApp } from '../lib/session';
import { Icon, Sheet } from './ui';
import type { Lang } from '../lib/i18n';

// Date and time pickers in the app's own style (the native ones open a browser box that looks out of place).

const pad = (n: number) => String(n).padStart(2, '0');
const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromIso = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1, 12); };
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const fmtDate = (iso: string, lang: Lang) =>
  iso ? cap(fromIso(iso).toLocaleDateString(lang, { weekday: 'short', day: 'numeric', month: 'short', year: fromIso(iso).getFullYear() === new Date().getFullYear() ? undefined : 'numeric' }).replace(/\./g, '')) : '';
export const fmtTime = (hm: string, lang: Lang) => {
  if (!hm) return '';
  const [h, m] = hm.split(':').map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString(lang, { hour: 'numeric', minute: '2-digit' });
};

export function DateField({ value, onChange, label, min, placeholder }: { value: string; onChange: (v: string) => void; label?: string; min?: string; placeholder?: string }) {
  const { t, lang } = useApp();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="input picker-btn" onClick={() => setOpen(true)} aria-label={label || t('dp.pick')} aria-haspopup="dialog">
        <span className={value ? '' : 'muted'}>{value ? fmtDate(value, lang) : placeholder || t('dp.pick')}</span>
        <Icon name="cal" size={18} color="var(--ink-muted)" />
      </button>
      {open && <Calendar value={value} min={min} title={label || t('dp.pick')} onClose={() => setOpen(false)} onPick={(v) => { onChange(v); setOpen(false); }} />}
    </>
  );
}

function Calendar({ value, min, title, onClose, onPick }: { value: string; min?: string; title: string; onClose: () => void; onPick: (v: string) => void }) {
  const { t, lang } = useApp();
  const sel = value ? fromIso(value) : new Date();
  const [month, setMonth] = useState(new Date(sel.getFullYear(), sel.getMonth(), 1, 12));
  const today = toIso(new Date());
  const weekStart = 0; // US-first product: weeks start on Sunday in every language
  const days = useMemo(() => {
    const first = new Date(month);
    const lead = (first.getDay() - weekStart + 7) % 7;
    const start = new Date(first); start.setDate(1 - lead);
    return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  }, [month, weekStart]);
  const names = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(2023, 0, 1 + ((i + weekStart) % 7));
    return d.toLocaleDateString(lang, { weekday: 'narrow' });
  }), [lang, weekStart]);
  const shift = (n: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1, 12));
  // drop the 6th row when the month fits in 5
  const rows = days.slice(35).every((d) => d.getMonth() !== month.getMonth()) ? days.slice(0, 35) : days;
  return (
    <Sheet title={title} onClose={onClose} className="picker-sheet">
      <div className="cal-head">
        <button type="button" className="icon-btn" onClick={() => shift(-1)} aria-label={t('dp.prev')}><Icon name="chevL" size={18} /></button>
        <span className="cal-title" aria-live="polite">{cap(month.toLocaleDateString(lang, { month: 'long', year: 'numeric' }))}</span>
        <button type="button" className="icon-btn" onClick={() => shift(1)} aria-label={t('dp.next')}><Icon name="chevR" size={18} /></button>
      </div>
      <div className="cal-grid" role="grid" key={month.getMonth()}>
        {names.map((n, i) => <span key={`h${i}`} className="cal-dow" aria-hidden="true">{n}</span>)}
        {rows.map((d) => {
          const iso = toIso(d);
          const out = d.getMonth() !== month.getMonth();
          const disabled = !!min && iso < min;
          return (
            <button type="button" key={iso} className={`cal-day${out ? ' out' : ''}${iso === today ? ' today' : ''}`} aria-pressed={iso === value} disabled={disabled}
              aria-label={d.toLocaleDateString(lang, { weekday: 'long', day: 'numeric', month: 'long' })} onClick={() => onPick(iso)}>{d.getDate()}</button>
          );
        })}
      </div>
      <button type="button" className="btn btn-secondary" onClick={() => onPick(today)} disabled={!!min && today < min}>{t('dp.today')}</button>
    </Sheet>
  );
}

export function TimeField({ value, onChange, label, step = 15, from = 5, to = 22 }: { value: string; onChange: (v: string) => void; label?: string; step?: number; from?: number; to?: number }) {
  const { t, lang } = useApp();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="input picker-btn" onClick={() => setOpen(true)} aria-label={label || t('tp.pick')} aria-haspopup="dialog">
        <span className={value ? 'num' : 'muted'}>{value ? fmtTime(value, lang) : t('tp.pick')}</span>
        <Icon name="clock" size={18} color="var(--ink-muted)" />
      </button>
      {open && <TimeSheet value={value} step={step} from={from} to={to} title={label || t('tp.pick')} onClose={() => setOpen(false)} onPick={(v) => { onChange(v); setOpen(false); }} />}
    </>
  );
}

function TimeSheet({ value, step, from, to, title, onClose, onPick }: { value: string; step: number; from: number; to: number; title: string; onClose: () => void; onPick: (v: string) => void }) {
  const { t, lang } = useApp();
  const ref = useRef<HTMLDivElement>(null);
  const slots = useMemo(() => {
    const out: string[] = [];
    for (let m = from * 60; m <= to * 60 + 45; m += step) out.push(`${pad(Math.floor(m / 60))}:${pad(m % 60)}`);
    if (value && !out.includes(value)) out.push(value);
    return out.sort();
  }, [step, from, to, value]);
  const groups: [string, string[]][] = [
    [t('tp.early'), slots.filter((s) => s < '06:00')],
    [t('tp.morning'), slots.filter((s) => s >= '06:00' && s < '12:00')],
    [t('tp.afternoon'), slots.filter((s) => s >= '12:00' && s < '18:00')],
    [t('tp.evening'), slots.filter((s) => s >= '18:00')],
  ];
  useEffect(() => {
    const el = ref.current?.querySelector('[aria-pressed="true"]') as HTMLElement | null;
    el?.scrollIntoView({ block: 'center' });
  }, []);
  return (
    <Sheet title={title} onClose={onClose} className="picker-sheet">
      <div className="time-groups" ref={ref}>
        {groups.filter(([, list]) => list.length).map(([name, list]) => (
          <div key={name} className="stack" style={{ gap: 8 }}>
            <span className="label muted">{name}</span>
            <div className="time-grid">
              {list.map((s) => <button type="button" key={s} className="chip time-chip" aria-pressed={s === value} onClick={() => onPick(s)}>{fmtTime(s, lang)}</button>)}
            </div>
          </div>
        ))}
      </div>
    </Sheet>
  );
}

// Drop-in for <select>: same <option> children, opens a sheet list instead of the browser menu.
export function Select({ value, onChange, children, label, disabled }: { value: string; onChange: (v: string) => void; children: ReactNode; label?: string; disabled?: boolean }) {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const opts = Children.toArray(children).filter(isValidElement).map((o) => {
    const p = (o as ReactElement<{ value?: string; children?: ReactNode; disabled?: boolean }>).props;
    return { value: String(p.value ?? ''), label: p.children, disabled: !!p.disabled };
  });
  const cur = opts.find((o) => o.value === String(value));
  return (
    <>
      <button type="button" className="input picker-btn" disabled={disabled} onClick={() => setOpen(true)} aria-haspopup="listbox" aria-label={label}>
        <span className="one-line">{cur ? cur.label : '—'}</span>
        <Icon name="chevD" size={18} color="var(--ink-muted)" />
      </button>
      {open && (
        <Sheet title={label || t('c.choose')} onClose={() => setOpen(false)} className="picker-sheet">
          <div className="opt-list" role="listbox" aria-label={label}>
            {opts.map((o) => (
              <button type="button" role="option" key={o.value} aria-selected={o.value === String(value)} disabled={o.disabled} className="opt"
                onClick={() => { onChange(o.value); setOpen(false); }}>
                <span className="grow">{o.label}</span>
                {o.value === String(value) && <Icon name="check" size={18} color="var(--action)" stroke={2.6} />}
              </button>
            ))}
          </div>
        </Sheet>
      )}
    </>
  );
}
