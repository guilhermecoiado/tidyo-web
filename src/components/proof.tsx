import { useRef, useState } from 'react';
import { useApp } from '../lib/session';
import type { CheckItem, Photo } from '../lib/photos';
import { Icon } from './ui';
import { hasKey } from '../lib/i18n';

// Standard tasks are stored as keys (std.*); custom ones are plain text.
export function useTaskLabel() {
  const { t } = useApp();
  return (s: string) => (s.startsWith('std.') && hasKey(s) ? t(s) : s);
}

export function ChecklistView({ items, editable, onToggle }: { items: CheckItem[]; editable: boolean; onToggle?: (item: CheckItem) => void }) {
  const { t } = useApp();
  const label = useTaskLabel();
  const rooms: { room: string; items: CheckItem[] }[] = [];
  for (const it of items) {
    const g = rooms.find((r) => r.room === it.room);
    if (g) g.items.push(it); else rooms.push({ room: it.room, items: [it] });
  }
  const done = items.filter((i) => i.done_at).length;
  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="row">
        <span className="bold grow">{t('ck.progress', { done, total: items.length })}</span>
        <span className="small muted num">{items.length ? Math.round((done / items.length) * 100) : 0}%</span>
      </div>
      <div style={{ height: 8, borderRadius: 8, background: 'var(--line)', overflow: 'hidden' }} aria-hidden="true">
        <div style={{ height: '100%', width: `${items.length ? (done / items.length) * 100 : 0}%`, background: 'var(--action)', transition: 'width .2s' }} />
      </div>
      {rooms.map((g) => (
        <div key={g.room} className="stack" style={{ gap: 6 }}>
          <span className="label">{label(g.room)} · {g.items.filter((i) => i.done_at).length}/{g.items.length}</span>
          {g.items.map((it) => (
            <button key={it.id} type="button" className="item" style={{ minHeight: 48, padding: '8px 12px', cursor: editable ? 'pointer' : 'default' }}
              onClick={() => editable && onToggle?.(it)} aria-pressed={!!it.done_at} disabled={!editable}>
              <span style={{ width: 24, height: 24, borderRadius: 7, flex: 'none', border: it.done_at ? 0 : '2px solid var(--line-strong)', background: it.done_at ? 'var(--action)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {it.done_at && <Icon name="check" size={15} color="#fff" stroke={3} />}
              </span>
              <span style={{ flex: 1, fontWeight: 600, color: it.done_at ? 'var(--ink-muted)' : 'inherit' }}>{label(it.task)}</span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

export function PhotoStrip({ title, photos, onAdd, busy }: { title: string; photos: Photo[]; onAdd?: (f: File) => void; busy?: boolean }) {
  const { t } = useApp();
  const input = useRef<HTMLInputElement>(null);
  const [big, setBig] = useState<Photo | null>(null);
  return (
    <div className="stack" style={{ gap: 8 }}>
      <span className="label">{title} · {photos.length}</span>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
        {photos.map((p) => (
          <button key={p.id} type="button" onClick={() => setBig(p)} style={{ aspectRatio: '1', borderRadius: 12, border: '1px solid var(--line)', padding: 0, overflow: 'hidden', background: 'var(--neutral-bg)', cursor: 'zoom-in' }} aria-label={title}>
            {p.url && <img src={p.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} loading="lazy" />}
          </button>
        ))}
        {onAdd && (
          <button type="button" onClick={() => input.current?.click()} disabled={busy}
            style={{ aspectRatio: '1', borderRadius: 12, border: '2px dashed var(--line-strong)', background: 'var(--surface)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, fontWeight: 800, fontSize: 12.5, color: 'var(--action)', cursor: 'pointer' }}>
            <Icon name="plus" size={22} />{busy ? t('ck.uploading') : t('ck.addPhoto')}
          </button>
        )}
      </div>
      {onAdd && <input ref={input} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onAdd(f); e.target.value = ''; }} />}
      {big && (
        <div className="scrim center" onClick={() => setBig(null)} role="dialog" aria-modal="true" aria-label={title}>
          <img src={big.url} alt="" style={{ maxWidth: '100%', maxHeight: '86dvh', borderRadius: 16 }} />
        </div>
      )}
    </div>
  );
}

export function Stars({ value, onChange, size = 32 }: { value: number; onChange?: (n: number) => void; size?: number }) {
  const { t } = useApp();
  return (
    <div className="row" role={onChange ? 'radiogroup' : 'img'} aria-label={t('pt.stars', { n: value })} style={{ gap: 4 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" disabled={!onChange} onClick={() => onChange?.(n)} role={onChange ? 'radio' : undefined} aria-checked={onChange ? value === n : undefined}
          aria-label={t('pt.stars', { n })} style={{ background: 'none', border: 0, padding: 2, cursor: onChange ? 'pointer' : 'default', minWidth: onChange ? 44 : undefined, minHeight: onChange ? 44 : undefined }}>
          <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" fill={n <= value ? '#E8A317' : 'none'} stroke={n <= value ? '#E8A317' : '#B9C7C4'} strokeWidth="1.6" strokeLinejoin="round" /></svg>
        </button>
      ))}
    </div>
  );
}
