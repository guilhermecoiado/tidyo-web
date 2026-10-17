// Financeiro › Despesas e Financeiro › Equipe — same pattern as the Financeiro screen (back to it, no extra tabs)
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useApp } from '../lib/session';
import { Confirm, Sheet } from '../components/ui';
import { Avatar, C, ProNote, usePro, Head, OwnerBar, PILL, Segment, SheetActions, Svg, I, colorOf, usd } from '../components/kit';
import { getMembers, memberIndex, type Member } from '../lib/data';
import { addDays, fmtHours, hoursBetween, isoDate, startOfDay, toCents } from '../lib/format';
import { ExpenseSheet } from './Finance';

type Expense = { id: string; membership_id: string | null; category: string; description: string | null; amount_cents: number; incurred_on: string; receipt_path: string | null; reimbursable: boolean; status: string };
type Entry = { id: string; membership_id: string; clock_in: string; clock_out: string | null; approval: string; auto_closed?: boolean };
type Period = 'month' | 'last' | '90';

function range(p: Period) {
  const now = new Date();
  if (p === 'month') return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: addDays(startOfDay(now), 1) };
  if (p === 'last') return { from: new Date(now.getFullYear(), now.getMonth() - 1, 1), to: new Date(now.getFullYear(), now.getMonth(), 1) };
  return { from: addDays(startOfDay(now), -90), to: addDays(startOfDay(now), 1) };
}
function download(name: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
const tone = (s: string) => (s === 'pending' ? PILL.warn : s === 'rejected' ? PILL.danger : PILL.ok);

export function Expenses() {
  const { t, tErr, lang, company, toast, membership } = useApp();
  const [list, setList] = useState<Expense[] | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [tab, setTab] = useState<'review' | 'all'>('review');
  const [create, setCreate] = useState(false);
  const [receipt, setReceipt] = useState('');
  const load = useCallback(async () => {
    if (!company) return;
    const { data } = await supabase.from('expenses').select('id, membership_id, category, description, amount_cents, incurred_on, receipt_path, reimbursable, status').eq('company_id', company.id).order('incurred_on', { ascending: false }).limit(200);
    setList((data || []) as Expense[]);
  }, [company]);
  useEffect(() => { load(); if (company) getMembers(company.id).then(setMembers); }, [load, company]);
  const review = (list || []).filter((e) => e.status === 'pending' || (e.status === 'approved' && e.reimbursable && e.membership_id));
  const shown = tab === 'review' ? review : list || [];
  const who = (id: string | null) => members.find((m) => m.id === id);
  const setStatus = async (e: Expense, status: string) => {
    const { error } = await supabase.from('expenses').update({ status, reviewed_by: membership?.id, reviewed_at: new Date().toISOString() }).eq('id', e.id);
    if (error) toast(tErr(error.message)); else { toast(t('c.saved')); load(); }
  };
  const openReceipt = async (path: string) => {
    const { data } = await supabase.storage.from('receipts').createSignedUrl(path, 600);
    if (data?.signedUrl) setReceipt(data.signedUrl);
  };
  return (
    <div className="k-screen">
      <main className="k-page" style={{ gap: 14 }}>
        <Head title={t('fin.expenses')} back="/app/financas" right={<button className="k-btn k-btn-fill nw" style={{ minHeight: 44, borderRadius: 13, fontSize: 13.5, padding: '0 14px' }} onClick={() => setCreate(true)}>+ {t('fin.newExpense')}</button>} />
        <Segment value={tab} onChange={setTab} label={t('fin.expenses')} options={[{ value: 'review', label: <>{t('fin.toReview')}{review.length > 0 && <span className="k-segbadge">{review.length}</span>}</> }, { value: 'all', label: t('inv.all') }]} />
        <div className="k-card" style={{ padding: '2px 12px', gap: 0 }}>
          {!list ? [0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 56, margin: '12px 0' }} />) : shown.length === 0 ? <span style={{ display: 'block', padding: '20px 0', textAlign: 'center', fontSize: 13.5, color: C.muted }}>{t('fin.noExpenses')}</span> : shown.map((e, i) => {
            const m = who(e.membership_id);
            const [bg, fg] = tone(e.status);
            return (
              <div key={e.id} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 0', borderTop: i ? `1px solid ${C.soft}` : 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {m ? <Avatar name={m.display_name} color={colorOf(memberIndex(members, m.id))[0]} size={34} font={12} /> : <span className="k-avatar" style={{ width: 34, height: 34, borderRadius: 34, background: '#EEF1F0', color: C.muted, fontSize: 12 }}>$</span>}
                  <span style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                    <b className="k-ell" style={{ fontSize: 14 }}>{t(`expc.${e.category}`)}{e.description ? ` · ${e.description}` : ''}</b>
                    <span className="k-ell" style={{ fontSize: 12, color: C.muted }}>{m ? m.display_name : t('fin.company')} · {new Date(e.incurred_on + 'T12:00').toLocaleDateString(lang, { day: 'numeric', month: 'short' }).replace('.', '')}</span>
                  </span>
                  <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    <b className="num nw" style={{ fontSize: 14 }}>{usd(e.amount_cents, true)}</b>
                    <span className="k-pill nw" style={{ fontSize: 11, padding: '2px 8px', background: bg, color: fg }}>{t(`fin.st.${e.status}`)}</span>
                  </span>
                </div>
                {(e.receipt_path || e.status === 'pending' || (e.status === 'approved' && e.reimbursable && e.membership_id)) && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    {e.receipt_path && <button className="k-link" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 36 }} onClick={() => openReceipt(e.receipt_path!)}><Svg d={I.receipt} size={15} />{t('day.receipt')}</button>}
                    <span style={{ flex: 1 }} />
                    {e.status === 'pending' && <>
                      <button className="k-btn k-btn-sm k-btn-line" onClick={() => setStatus(e, 'rejected')}>{t('fin.reject')}</button>
                      <button className="k-btn k-btn-sm k-btn-fill" onClick={() => setStatus(e, 'approved')}>{t('fin.approve')}</button>
                    </>}
                    {e.status === 'approved' && e.reimbursable && e.membership_id && <button className="k-btn k-btn-sm k-btn-fill" onClick={() => setStatus(e, 'reimbursed')}>{t('fin.markReimbursed')}</button>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>
      <OwnerBar />
      {create && <ExpenseSheet onClose={() => setCreate(false)} onSaved={() => { setCreate(false); toast(t('c.saved')); load(); }} />}
      {receipt && <div className="scrim center" onClick={() => setReceipt('')} role="dialog" aria-modal="true"><img src={receipt} alt="" style={{ maxWidth: '100%', maxHeight: '86dvh', borderRadius: 16 }} /></div>}
    </div>
  );
}

export function TeamPay() {
  const { t, tErr, company, toast, membership } = useApp();
  const pro = usePro();
  const [period, setPeriod] = useState<Period>('month');
  const [members, setMembers] = useState<Member[]>([]);
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [rates, setRates] = useState<Map<string, number>>(new Map());
  const [tips, setTips] = useState<Map<string, number>>(new Map());
  const [reimb, setReimb] = useState<Map<string, number>>(new Map());
  const [editRate, setEditRate] = useState<Member | null>(null);
  const [rateValue, setRateValue] = useState('');
  const [confirmAll, setConfirmAll] = useState(false);

  const load = useCallback(async () => {
    if (!company) return;
    setEntries(null);
    const { from, to } = range(period);
    const [m, te, r, tp, ex] = await Promise.all([
      getMembers(company.id),
      supabase.from('time_entries').select('id, membership_id, clock_in, clock_out, approval, auto_closed').eq('company_id', company.id).gte('clock_in', from.toISOString()).lt('clock_in', to.toISOString()).order('clock_in'),
      supabase.from('member_pay_rates').select('membership_id, hourly_cents').eq('company_id', company.id),
      supabase.from('tips').select('membership_id, amount_cents').eq('company_id', company.id).gte('received_at', from.toISOString()).lt('received_at', to.toISOString()),
      supabase.from('expenses').select('membership_id, amount_cents').eq('company_id', company.id).eq('reimbursable', true).eq('status', 'approved'),
    ]);
    setMembers(m.filter((x) => x.status === 'active'));
    setEntries((te.data || []) as Entry[]);
    setRates(new Map(((r.data || []) as { membership_id: string; hourly_cents: number }[]).map((x) => [x.membership_id, x.hourly_cents])));
    const sum = (rows: { membership_id: string | null; amount_cents: number }[]) => { const mp = new Map<string, number>(); for (const x of rows) if (x.membership_id) mp.set(x.membership_id, (mp.get(x.membership_id) || 0) + x.amount_cents); return mp; };
    setTips(sum((tp.data || []) as { membership_id: string; amount_cents: number }[]));
    setReimb(sum((ex.data || []) as { membership_id: string; amount_cents: number }[]));
  }, [company, period]);
  useEffect(() => { load(); }, [load]);

  // the owner only shows up when she clocked hours herself
  const rows = members.filter((m) => m.role !== 'owner' || (entries || []).some((e) => e.membership_id === m.id)).map((m) => {
    const es = (entries || []).filter((e) => e.membership_id === m.id);
    const hours = es.reduce((s, e) => s + hoursBetween(e.clock_in, e.clock_out), 0);
    const rate = rates.get(m.id) || 0;
    return { m, hours, rate, pay: Math.round(hours * rate), tips: tips.get(m.id) || 0, reimb: reimb.get(m.id) || 0,
      pending: es.filter((e) => e.approval === 'pending' && e.clock_out).length, open: es.some((e) => !e.clock_out), auto: es.filter((e) => e.auto_closed && e.approval === 'pending').length };
  });
  const totalPending = rows.reduce((s, r) => s + r.pending, 0);
  const total = rows.reduce((s, r) => s + r.pay + r.tips + r.reimb, 0);

  const approveAll = async () => {
    const ids = (entries || []).filter((e) => e.approval === 'pending' && e.clock_out).map((e) => e.id);
    if (!ids.length) return;
    const { error } = await supabase.from('time_entries').update({ approval: 'approved', edited_by: membership?.id }).in('id', ids);
    if (error) toast(tErr(error.message)); else { toast(t('c.saved')); load(); }
  };
  const saveRate = async () => {
    if (!company || !editRate) return;
    const { error } = await supabase.from('member_pay_rates').upsert({ membership_id: editRate.id, company_id: company.id, hourly_cents: toCents(rateValue) });
    if (error) toast(tErr(error.message)); else { toast(t('c.saved')); setEditRate(null); load(); }
  };
  const exportPay = () => {
    const { from, to } = range(period);
    const out: (string | number)[][] = [['Name', 'Hours', 'Hourly rate', 'Pay', 'Tips', 'Reimbursements', 'Total']];
    for (const r of rows) out.push([r.m.display_name, r.hours.toFixed(2), (r.rate / 100).toFixed(2), (r.pay / 100).toFixed(2), (r.tips / 100).toFixed(2), (r.reimb / 100).toFixed(2), ((r.pay + r.tips + r.reimb) / 100).toFixed(2)]);
    download(`tidyo-team-pay-${isoDate(from)}-${isoDate(addDays(to, -1))}.csv`, out);
  };

  return (
    <div className="k-screen">
      <main className="k-page" style={{ gap: 14 }}>
        <Head title={t('fin.teamPay')} sub={t('fin.teamTotal', { v: usd(total, true) })} back="/app/financas" />
        <Segment value={period} onChange={setPeriod} label={t('fin.period')} options={[{ value: 'month', label: t('fin.thisMonth') }, { value: 'last', label: t('fin.lastMonth') }, { value: '90', label: t('fin.last90') }]} />
        {totalPending > 0 && (
          <div className="k-note">
            <span>{t('fin.hoursPending', { n: totalPending })}</span>
            <button className="k-btn k-btn-sm" style={{ background: '#FFFFFF', border: '1px solid #E5C875', color: '#6B4A04', minHeight: 40 }} onClick={() => setConfirmAll(true)}>{t('fin.approveAll')}</button>
          </div>
        )}
        {!entries ? [0, 1].map((i) => <div key={i} className="skeleton" style={{ height: 130, borderRadius: 16 }} />) : rows.length === 0 ? <div className="k-card" style={{ padding: 20, alignItems: 'center', textAlign: 'center' }}><span className="k-s125 k-muted">{t('fin.noTeam')}</span></div> : rows.map((r) => (
          <div key={r.m.id} className="k-card" style={{ gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Avatar name={r.m.display_name} color={colorOf(memberIndex(members, r.m.id))[0]} size={38} font={13} />
              <span style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}><b className="k-ell" style={{ fontSize: 14.5 }}>{r.m.display_name}</b>{r.open && <span className="k-pill nw" style={{ fontSize: 11, padding: '2px 8px', background: PILL.warn[0], color: PILL.warn[1] }}>{t('fin.onShift')}</span>}</span>
                <span className="k-ell" style={{ fontSize: 12, color: C.muted }}>{fmtHours(r.hours)} · {r.rate ? `${usd(r.rate, true)}/h` : t('fin.noRate')}</span>
              </span>
              <b className="num nw" style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 18 }}>{usd(r.pay + r.tips + r.reimb, true)}</b>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6, background: C.bg, borderRadius: 12, padding: '8px 10px' }}>
              {([[t('fin.pay'), r.pay], [t('fin.tips'), r.tips], [t('fin.reimb'), r.reimb]] as [string, number][]).map(([l, v]) => (
                <span key={l} style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}><span className="nw" style={{ fontSize: 11, fontWeight: 700, color: C.muted }}>{l}</span><b className="num nw" style={{ fontSize: 13.5 }}>{usd(v, true)}</b></span>
              ))}
            </div>
            {r.auto > 0 && <span style={{ fontSize: 12, color: '#8A4B05', fontWeight: 700 }}>{t('fin.autoClosed', { n: r.auto })}</span>}
            <button className="k-link" style={{ alignSelf: 'flex-start', minHeight: 32 }} onClick={() => { setEditRate(r.m); setRateValue(r.rate ? (r.rate / 100).toFixed(2) : ''); }}>{r.rate ? t('team.editRate') : t('team.setRate')}</button>
          </div>
        ))}
        {pro ? <button className="k-btn k-btn-line" style={{ gap: 8 }} onClick={exportPay}><Svg d={I.receipt} size={16} />{t('fin.exportPay')}</button> : <ProNote text={t('pro.teamPay')} />}
        <span className="k-help">{t('fin.1099hint')}</span>
      </main>
      <OwnerBar />
      {editRate && (
        <Sheet title={`${t('team.rate')} · ${editRate.display_name}`} onClose={() => setEditRate(null)}>
          <label className="k-field"><span>{t('team.rate')}</span><input className="k-input" inputMode="decimal" value={rateValue} onChange={(e) => setRateValue(e.target.value)} placeholder="0.00" autoFocus /></label>
          <SheetActions cancel={t('c.cancel')} onCancel={() => setEditRate(null)} confirm={t('c.save')} onConfirm={saveRate} disabled={toCents(rateValue) <= 0} />
        </Sheet>
      )}
      {confirmAll && <Confirm text={t('fin.approveAllAsk', { n: totalPending })} confirmLabel={t('fin.approveAll')} onCancel={() => setConfirmAll(false)} onConfirm={() => { setConfirmAll(false); approveAll(); }} />}
    </div>
  );
}
