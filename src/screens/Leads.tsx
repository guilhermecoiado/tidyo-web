// Quote requests that came from the public page (/orcamento/<slug>)
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useApp } from '../lib/session';
import { Sheet } from '../components/ui';
import { C, PILL, Segment, usd } from '../components/kit';

export type Lead = { id: string; kind: string; name: string; phone: string | null; email: string | null; language: string; address: string | null; bedrooms: number | null; bathrooms: number | null; square_feet: number | null; frequency: string | null; message: string | null; estimate_cents: number | null; status: string; client_id: string | null; created_at: string };

export function useNewLeads() {
  const { company, isStaff } = useApp();
  const [n, setN] = useState(0);
  const load = useCallback(() => {
    if (!company || !isStaff) return;
    supabase.from('leads').select('id', { count: 'exact', head: true }).eq('company_id', company.id).eq('status', 'new').then(({ count }) => setN(count || 0));
  }, [company, isStaff]);
  useEffect(() => { load(); }, [load]);
  return [n, load] as const;
}

const ago = (iso: string, lang: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });
  return m < 60 ? rtf.format(-Math.max(1, m), 'minute') : m < 1440 ? rtf.format(-Math.round(m / 60), 'hour') : rtf.format(-Math.round(m / 1440), 'day');
};

export function LeadsSheet({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const { t, tErr, lang, company, toast } = useApp();
  const nav = useNavigate();
  const [list, setList] = useState<Lead[] | null>(null);
  const [tab, setTab] = useState<'open' | 'done'>('open');
  const load = useCallback(async () => {
    if (!company) return;
    const { data } = await supabase.from('leads').select('id, kind, name, phone, email, language, address, bedrooms, bathrooms, square_feet, frequency, message, estimate_cents, status, client_id, created_at').eq('company_id', company.id).order('created_at', { ascending: false }).limit(100);
    setList((data || []) as Lead[]);
  }, [company]);
  useEffect(() => { load(); }, [load]);
  const setStatus = async (l: Lead, status: string) => {
    const { error } = await supabase.from('leads').update({ status }).eq('id', l.id);
    if (error) toast(tErr(error.message)); else { load(); onChanged(); }
  };
  const shown = (list || []).filter((l) => (tab === 'open' ? l.status === 'new' || l.status === 'contacted' : l.status === 'won' || l.status === 'lost'));
  const openN = (list || []).filter((l) => l.status === 'new' || l.status === 'contacted').length;
  const tone = (s: string) => (s === 'new' ? PILL.warn : s === 'won' ? PILL.ok : PILL.neutral);
  const hello = (l: Lead) => {
    const first = l.name.split(' ')[0];
    return l.language === 'es' ? `¡Hola, ${first}! Soy de ${company?.name}. Recibimos tu pedido de presupuesto.` : l.language === 'pt-BR' ? `Oi, ${first}! Aqui é da ${company?.name}. Recebemos seu pedido de orçamento.` : `Hi ${first}! This is ${company?.name}. We got your quote request.`;
  };
  return (
    <Sheet title={t('ld.title')} onClose={onClose}>
      <Segment value={tab} onChange={setTab} label={t('ld.title')} options={[{ value: 'open', label: <>{t('ld.open')}{openN > 0 && <span className="k-segbadge">{openN}</span>}</> }, { value: 'done', label: t('ld.done') }]} />
      {!list ? <div className="skeleton" style={{ height: 120, borderRadius: 16 }} /> : shown.length === 0 ? (
        <div className="k-card" style={{ alignItems: 'center', textAlign: 'center', gap: 4, padding: '20px 16px' }}><b style={{ fontSize: 14 }}>{t('ld.none')}</b><span className="k-help">{t('ld.noneText')}</span></div>
      ) : shown.map((l) => {
        const [bg, fg] = tone(l.status);
        const phone = (l.phone || '').replace(/\D/g, '');
        const details = [
          l.kind === 'commercial' ? t('cl.com') : l.bedrooms != null ? t('ld.rooms', { b: l.bedrooms, ba: Number(l.bathrooms || 0) }) : '',
          l.square_feet ? `${l.square_feet.toLocaleString('en-US')} sq ft` : '',
          l.frequency ? t(`qp.f.${l.frequency}`) : '',
          l.estimate_cents ? t('ld.est', { v: usd(l.estimate_cents) }) : '',
        ].filter(Boolean).join(' · ');
        return (
          <div key={l.id} className="k-card" style={{ gap: 10, padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <span style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, gap: 2 }}>
                <b className="k-ell" style={{ fontSize: 15 }}>{l.name}</b>
                <span style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.4 }}>{details}</span>
                {l.address && <span className="k-ell" style={{ fontSize: 12.5, color: C.muted }}>{l.address}</span>}
              </span>
              <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                <span className="k-pill" style={{ fontSize: 11, padding: '2px 8px', background: bg, color: fg }}>{t(`ld.st.${l.status}`)}</span>
                <span className="nw" style={{ fontSize: 11.5, color: C.muted }}>{ago(l.created_at, lang)}</span>
              </span>
            </div>
            {l.message && <span style={{ fontSize: 13, background: C.bg, borderRadius: 12, padding: '8px 10px', lineHeight: 1.45 }}>“{l.message}”</span>}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {phone && <a className="k-btn k-btn-sm k-btn-line" href={`https://wa.me/${phone}?text=${encodeURIComponent(hello(l))}`} target="_blank" rel="noreferrer" onClick={() => l.status === 'new' && setStatus(l, 'contacted')}>WhatsApp</a>}
              {phone && <a className="k-btn k-btn-sm k-btn-line" href={`tel:${l.phone}`} onClick={() => l.status === 'new' && setStatus(l, 'contacted')}>{t('ld.call')}</a>}
              {l.email && <a className="k-btn k-btn-sm k-btn-line" href={`mailto:${l.email}?subject=${encodeURIComponent(company?.name || '')}&body=${encodeURIComponent(hello(l))}`} onClick={() => l.status === 'new' && setStatus(l, 'contacted')}>Email</a>}
            </div>
            {(l.status === 'new' || l.status === 'contacted') && (
              <div className="k-pair">
                <button className="k-btn k-btn-line" onClick={() => setStatus(l, 'lost')}>{t('ld.lost')}</button>
                <button className="k-btn k-btn-fill" onClick={() => { onClose(); nav(`/app/clientes/novo?lead=${l.id}`); }}>{t('ld.convert')}</button>
              </div>
            )}
            {l.status === 'lost' && <button className="k-link" style={{ alignSelf: 'flex-start', minHeight: 36 }} onClick={() => setStatus(l, 'contacted')}>{t('ld.reopen')}</button>}
          </div>
        );
      })}
    </Sheet>
  );
}
