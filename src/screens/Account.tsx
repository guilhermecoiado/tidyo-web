// Conta e assinatura — canvas Assinatura
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useApp } from '../lib/session';
import { Sheet } from '../components/ui';
import { C, Head, OwnerBar, Segment, SheetActions, Svg, I } from '../components/kit';
import { COMBO, perMonth } from '../lib/pricing';

type PlanKey = 'essencial' | 'pro' | 'comercial' | 'combo';
export const PLAN_PRICE: Record<PlanKey, number> = { essencial: 29, pro: 69, comercial: 49, combo: COMBO };
const price = (v: number, yearly: boolean) => `$${perMonth(v, yearly)}`;

async function exportCsvZip(companyId: string, name: string) {
  const tables = ['clients', 'properties', 'jobs', 'invoices', 'invoice_lines', 'payments', 'expenses', 'time_entries', 'contracts', 'inspections'];
  const out: Record<string, unknown> = { exported_at: new Date().toISOString() };
  for (const tb of tables) { const { data } = await supabase.from(tb).select('*').eq('company_id', companyId); out[tb] = data || []; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' }));
  a.download = `tidyo-${name.replace(/\W+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
}

export default function Account() {
  const { t, tErr, lang, company, sub, refresh, toast } = useApp();
  const nav = useNavigate();
  const current: PlanKey = sub?.plan === 'essencial' ? 'essencial' : sub?.plan === 'comercial' ? 'comercial' : sub?.has_commercial ? 'combo' : 'pro';
  const [usage, setUsage] = useState<{ houses: number; max_houses: number | null; users: number; max_users: number; contracts: number; max_contracts: number | null } | null>(null);
  const [sheet, setSheet] = useState<'' | 'plans' | 'cancel' | 'delete' | 'card' | 'receipts'>('');
  const [pick, setPick] = useState<PlanKey>(current);
  const [yearly, setYearly] = useState(sub?.interval === 'year');
  const [reason, setReason] = useState('');
  const [del, setDel] = useState('');
  useEffect(() => { if (company) supabase.rpc('plan_usage', { p_company: company.id }).then(({ data }) => setUsage(((data || []) as NonNullable<typeof usage>[])[0] || null)); }, [company]);
  const names: Record<PlanKey, [string, string]> = { essencial: ['Essencial', t('acc.pEss')], pro: ['Pro', t('acc.pPro')], comercial: ['Comercial', t('acc.pCom')], combo: ['Pro + Comercial', t('acc.pCombo')] };
  const end = sub?.status === 'trialing' ? sub.trial_ends_at : sub?.current_period_end;
  const endTxt = end ? new Date(end).toLocaleDateString(lang, { day: 'numeric', month: 'long' }) : '';
  const word = (dl: string) => (dl === 'EXCLUIR' || dl === 'DELETE' || dl === 'ELIMINAR');
  const bar = (n: number, max: number | null) => (max == null ? 100 : Math.min(100, Math.round((n / Math.max(1, max)) * 100)));
  const color = (n: number, max: number | null) => (max != null && n / Math.max(1, max) >= 0.8 ? '#E0A341' : C.accent);

  const applyPlan = async () => {
    if (!company) return;
    const plan = pick === 'combo' ? 'pro' : pick;
    const { error } = await supabase.rpc('set_plan', { p_company: company.id, p_plan: plan, p_commercial: pick === 'combo' || pick === 'comercial', p_interval: yearly ? 'year' : 'month' });
    if (error) toast(tErr(error.message)); else { await refresh(); setSheet(''); toast(t('acc.planChanged', { p: names[pick][0] })); }
  };
  const cancel = async () => {
    if (!company) return;
    const { error } = await supabase.rpc('cancel_subscription', { p_company: company.id, p_reason: reason });
    if (error) toast(tErr(error.message)); else { await refresh(); setSheet(''); }
  };
  const close = async () => {
    if (!company) return;
    const { error } = await supabase.rpc('close_company', { p_company: company.id, p_confirm: 'EXCLUIR' });
    if (error) toast(tErr(error.message)); else { await supabase.auth.signOut(); nav('/', { replace: true }); window.location.reload(); }
  };
  const links: [string, string, string, () => void][] = [
    [t('acc.receipts'), t('acc.receiptsSub'), C.ink, () => setSheet('receipts')],
    [t('acc.download'), t('acc.downloadSub'), C.ink, () => company && exportCsvZip(company.id, company.name)],
    [t('acc.cancel'), t('acc.cancelSub'), '#8F2F08', () => setSheet('cancel')],
    [t('acc.delete'), t('acc.deleteSub'), '#8F2F08', () => setSheet('delete')],
  ];

  return (
    <div className="k-screen">
      <main className="k-page" style={{ gap: 16 }}>
        <Head title={t('acc.title')} back="/app/mais" />
        <div className="k-brand" style={{ gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span style={{ display: 'flex', flexDirection: 'column', flex: 1 }}><span style={{ fontSize: 12, fontWeight: 800, color: C.faint, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('acc.yourPlan')}</span><span className="nw" style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 22, fontWeight: 700, color: '#FFFFFF' }}>{names[current][0]}</span></span>
            <span className="num nw" style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 24, fontWeight: 700, color: C.mint }}>{price(PLAN_PRICE[current], false)}{t('acc.perMonth')}</span>
          </div>
          <span style={{ fontSize: 13, color: '#B9D6D0' }}>{sub?.cancel_at_period_end ? t('acc.endsOn', { d: endTxt }) : sub?.status === 'trialing' ? t('acc.trialUntil', { d: endTxt }) : t('acc.nextCharge', { d: endTxt })}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="k-btn k-btn-mint" style={{ flex: 1, minHeight: 46, borderRadius: 13, fontSize: 13.5 }} onClick={() => { setPick(current); setSheet('plans'); }}>{t('acc.changePlan')}</button>
            <button className="k-btn" style={{ flex: 1, minHeight: 46, borderRadius: 13, fontSize: 13.5, border: '1px solid #3B6A61', background: 'transparent', color: '#FFFFFF' }} onClick={() => setSheet('card')}>{t('acc.changeCard')}</button>
          </div>
        </div>

        <div className="k-card" style={{ padding: 14, gap: 12 }}>
          <span style={{ fontWeight: 800, fontSize: 14.5 }}>{t('acc.usage')}</span>
          {!usage ? <div className="skeleton" style={{ height: 60 }} /> : ([
            [t('acc.houses'), usage.houses, usage.max_houses, company?.mode !== 'commercial'],
            [t('acc.users'), usage.users, usage.max_users, true],
            [t('acc.contracts'), usage.contracts, usage.max_contracts, company?.mode !== 'residential'],
          ] as [string, number, number | null, boolean][]).filter((r) => r[3]).map(([l, n, max]) => (
            <div key={l} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span style={{ fontWeight: 700 }}>{l}</span><span className="num" style={{ fontWeight: 800, color: color(n, max) }}>{max == null ? t('acc.ofUnlimited', { n }) : t('acc.ofN', { n, m: max })}</span></div>
              <div style={{ height: 7, borderRadius: 7, background: C.track, overflow: 'hidden' }}><div style={{ height: 7, width: `${bar(n, max)}%`, background: color(n, max) }} /></div>
            </div>
          ))}
        </div>

        <div className="k-list">
          {links.map(([l, s, c, act]) => (
            <button key={l} className="k-row tall" onClick={act}>
              <span style={{ display: 'flex', flexDirection: 'column', flex: 1 }}><span style={{ fontWeight: 700, fontSize: 14, color: c }}>{l}</span><span style={{ fontSize: 12, color: C.muted }}>{s}</span></span>
              <Svg d={I.chev} size={16} color="#9AA9A6" />
            </button>
          ))}
        </div>
        {sub?.cancel_at_period_end && <div role="status" style={{ background: '#FFF8E6', border: '1px solid #F3DFA8', borderRadius: 14, padding: 12, fontSize: 13, fontWeight: 700, color: '#6B4A04', lineHeight: 1.45 }}>{t('acc.canceled', { d: endTxt })}</div>}
      </main>
      <OwnerBar />

      {sheet === 'plans' && (
        <Sheet title={t('acc.pickPlan')} onClose={() => setSheet('')}>
          <Segment value={yearly ? 'y' : 'm'} onChange={(v) => setYearly(v === 'y')} label={t('acc.period')} options={[{ value: 'm', label: t('acc.monthly') }, { value: 'y', label: t('acc.yearly') }]} />
          {(Object.keys(names) as PlanKey[]).map((k) => {
            const on = pick === k;
            return (
              <button key={k} aria-pressed={on} onClick={() => setPick(k)} style={{ minHeight: 62, textAlign: 'left', borderRadius: 14, border: `2px solid ${on ? C.accent : C.line}`, background: on ? '#F0F9F7' : '#FFFFFF', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', color: C.ink, fontFamily: 'inherit' }}>
                <span style={{ display: 'flex', flexDirection: 'column', flex: 1 }}><span style={{ fontWeight: 800, fontSize: 14.5 }}>{names[k][0]}</span><span style={{ fontSize: 12, color: C.muted }}>{names[k][1]}</span></span>
                <span className="num" style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, fontSize: 17 }}>{price(PLAN_PRICE[k], yearly)}</span>
              </button>
            );
          })}
          <SheetActions cancel={t('c.back')} onCancel={() => setSheet('')} confirm={t('c.confirm')} onConfirm={applyPlan} />
          <span style={{ fontSize: 12, color: C.muted, textAlign: 'center' }}>{sub?.status === 'trialing' ? t('acc.trialNote') : t('acc.prorate')}</span>
        </Sheet>
      )}
      {sheet === 'cancel' && (
        <Sheet title={t('acc.cancelQ')} onClose={() => setSheet('')}>
          <span style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.5 }}>{t('acc.cancelText', { d: endTxt })}</span>
          <div className="k-chips">{(['price', 'closing', 'other', 'hard'] as const).map((r) => <button key={r} className="k-chip" style={{ minHeight: 38 }} aria-pressed={reason === r} onClick={() => setReason(r)}>{t(`acc.r.${r}`)}</button>)}</div>
          {(reason === 'price' || reason === 'closing') && <span style={{ fontSize: 13, color: '#0B6B5F', background: '#DDF1EC', borderRadius: 12, padding: '10px 12px', fontWeight: 700 }}>{t('acc.pauseTip')}</span>}
          <SheetActions cancel={t('acc.keep')} onCancel={() => setSheet('')} confirm={t('acc.cancel')} onConfirm={cancel} danger />
        </Sheet>
      )}
      {sheet === 'delete' && (
        <Sheet title={t('acc.deleteQ')} onClose={() => setSheet('')}>
          <span style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.5 }}>{t('acc.deleteText')}</span>
          <label className="k-field"><span>{t('acc.typeWord')}</span><input className="k-input" value={del} onChange={(e) => setDel(e.target.value)} autoComplete="off" style={{ background: C.bg, letterSpacing: '0.06em' }} /></label>
          <SheetActions cancel={t('c.back')} onCancel={() => setSheet('')} confirm={t('acc.delete')} onConfirm={close} danger disabled={!word(del.trim().toUpperCase())} />
        </Sheet>
      )}
      {sheet === 'card' && <Sheet title={t('acc.changeCard')} onClose={() => setSheet('')}><span style={{ fontSize: 14, lineHeight: 1.5 }}>{t('acc.cardSoon')}</span><button className="k-btn k-btn-fill" onClick={() => setSheet('')}>{t('c.close')}</button></Sheet>}
      {sheet === 'receipts' && <Sheet title={t('acc.receipts')} onClose={() => setSheet('')}><span style={{ fontSize: 14, lineHeight: 1.5 }}>{t('acc.noReceipts')}</span><button className="k-btn k-btn-fill" onClick={() => setSheet('')}>{t('c.close')}</button></Sheet>}
    </div>
  );
}
