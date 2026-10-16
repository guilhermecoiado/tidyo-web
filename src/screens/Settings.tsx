// Configurações ("Mais") — canvas Configuracoes, with each row opening its own page
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useApp } from '../lib/session';
import { Confirm, Sheet } from '../components/ui';
import { Select } from '../components/pickers';
import { Avatar, C, Head, OwnerBar, PILL, Segment, SheetActions, Svg, I, colorOf, initials, shortName, usd } from '../components/kit';
import { getMembers, getServices, memberIndex, type Member, type Service } from '../lib/data';
import { guessGender, type Gender } from '../lib/gender';
import { LANG_LABEL, type Lang } from '../lib/i18n';
import { PRICING, pricingOf } from './NewClient';
import { SecuritySection } from '../pages/Security';
import { PushToggle } from '../components/PushToggle';

const IC = {
  company: 'M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6', lang: 'M4 5h8M8 3v2M5 9c1.5 3 4 5 7 6M11 5c-1 4-3 7-7 9M13 21l4-9 4 9M14.5 18h5',
  price: 'M3 6h18v12H3zM3 10h18M7 15h3', check: 'M9 4h6v3H9zM7 5H5v16h14V5h-2M8 12h8M8 16h5', clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  box: 'M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10', team: I.users, pay: 'M3 6h18v12H3zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  card: 'M3 6h18v12H3zM3 10h18', link: 'M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4', bell: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0',
  contract: 'M4 21V5l8-2v18M12 7l8 2v12', money: 'M12 3v18M17 7.5c0-1.9-2.2-3-5-3s-5 1.1-5 3 2.2 2.6 5 3.2 5 1.4 5 3.3-2.2 3.5-5 3.5-5-1.4-5-3.3',
  out: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11', admin: 'M3 3h18v14H3zM8 21h8M12 17v4',
};

function Row({ icon, label, sub, to, onClick, danger }: { icon: string; label: string; sub?: string; to?: string; onClick?: () => void; danger?: boolean }) {
  const inner = (
    <>
      <span style={{ width: 34, height: 34, flex: 'none', borderRadius: 10, background: danger ? '#FDE8E6' : '#EEF5F3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Svg d={icon} size={18} color={danger ? '#9F1F14' : C.accent} w={1.9} /></span>
      <span style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}><span style={{ fontWeight: 700, fontSize: 14, color: danger ? '#8F2F08' : C.ink }}>{label}</span>{sub && <span className="k-ell" style={{ fontSize: 12, color: C.muted }}>{sub}</span>}</span>
      <Svg d={I.chev} size={16} color="#9AA9A6" />
    </>
  );
  return to ? <Link to={to} className="k-row tall" style={{ gap: 12 }}>{inner}</Link> : <button className="k-row tall" style={{ gap: 12 }} onClick={onClick}>{inner}</button>;
}
function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><span className="k-sec"><span>{title}</span></span><div className="k-list">{children}</div></div>;
}

export default function Settings() {
  const { section } = useParams();
  if (section) return <SettingsPage section={section} />;
  return <SettingsHome />;
}

function SettingsHome() {
  const { t, tg, lang, company, sub, isAdmin, refresh, toast } = useApp();
  const nav = useNavigate();
  const [counts, setCounts] = useState({ services: 0, extras: 0, team: 0, supplies: 0, low: 0, templates: 0 });
  const [askOut, setAskOut] = useState(false);
  useEffect(() => {
    if (!company) return;
    Promise.all([
      supabase.from('services').select('id', { count: 'exact', head: true }).eq('company_id', company.id).eq('active', true),
      supabase.from('service_extras').select('id', { count: 'exact', head: true }).eq('company_id', company.id).eq('active', true),
      supabase.from('memberships').select('id', { count: 'exact', head: true }).eq('company_id', company.id).in('status', ['active', 'invited']),
      supabase.from('supply_items').select('on_hand, reorder_at').eq('company_id', company.id),
      supabase.from('checklist_templates').select('id', { count: 'exact', head: true }).eq('company_id', company.id),
    ]).then(([s, e, m, sp, ct]) => {
      const items = (sp.data || []) as { on_hand: number; reorder_at: number | null }[];
      setCounts({ services: s.count || 0, extras: e.count || 0, team: m.count || 0, supplies: items.length, low: items.filter((i) => i.reorder_at != null && Number(i.on_hand) <= Number(i.reorder_at)).length, templates: ct.count || 0 });
    });
  }, [company]);
  const auto = company?.auto_messages || { r24: true, otw: true, rev: true, late: true };
  const setAuto = async (k: string) => {
    if (!company) return;
    const { error } = await supabase.from('companies').update({ auto_messages: { ...auto, [k]: !auto[k] } }).eq('id', company.id);
    if (!error) { await refresh(); toast(t('c.saved')); }
  };
  const planName = sub?.plan === 'essencial' ? 'Essencial' : sub?.plan === 'comercial' ? 'Comercial' : 'Pro';
  const mode = company?.mode === 'both' ? `${t('cl.res')} + ${t('cl.com')}` : company?.mode === 'commercial' ? t('cl.com') : t('cl.res');
  const pi = company?.payment_info || {};
  const payWays = [pi.zelle && 'Zelle', pi.venmo && 'Venmo', pi.cashapp && 'Cash App', pi.check_to && t('pdf.check')].filter(Boolean).join(', ');

  return (
    <div className="k-screen">
      <main className="k-page" style={{ gap: 16 }}>
        <div className="k-head">
          <span className="k-title" style={{ flex: 1, fontSize: 22 }}>{t('set.title')}</span>
          <Link to="/ajuda" className="k-btn k-btn-line" style={{ minHeight: 40, borderRadius: 12, fontSize: 12.5, padding: '0 12px' }}>{t('set.help')}</Link>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#FFFFFF', border: `1px solid ${C.line}`, borderRadius: 18, padding: 14 }}>
          <span style={{ width: 48, height: 48, borderRadius: 14, background: '#1C3D8F', color: '#FFFFFF', fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>{initials(company?.name || '')}</span>
          <span style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}><span className="k-ell" style={{ fontWeight: 800, fontSize: 15 }}>{company?.name}</span><span className="k-ell" style={{ fontSize: 12.5, color: C.muted }}>{planName}{sub?.status === 'trialing' ? ` (${t('sub.trialing').toLowerCase()})` : ''} · {mode} · {LANG_LABEL[lang]}</span></span>
          <Link to="/app/conta" className="k-btn k-btn-line" style={{ minHeight: 40, borderRadius: 12, fontSize: 12.5, padding: '0 12px' }}>{t('set.plan')}</Link>
        </div>

        <Group title={t('set.gCompany')}>
          <Row icon={IC.company} label={t('set.company')} sub={t('set.companySub')} to="/app/mais/empresa" />
          <Row icon={IC.lang} label={t('set.lang')} sub={`${LANG_LABEL[lang]} · US$`} to="/app/mais/idioma" />
        </Group>
        <Group title={t('set.gOps')}>
          <Row icon={IC.price} label={t('set.prices')} sub={t('set.pricesSub', { s: counts.services, e: counts.extras })} to="/app/mais/precos" />
          <Row icon={IC.check} label={t('set.checklists')} sub={counts.templates ? t('set.checklistsN', { n: counts.templates }) : t('set.checklistsSub')} to="/app/mais/checklists" />
          <Row icon={IC.clock} label={t('set.cancel')} sub={company?.cancellation_fee_cents ? t('set.cancelSub', { v: usd(company.cancellation_fee_cents), h: company.cancellation_window_hours || 24 }) : t('set.cancelNone')} to="/app/mais/cancelamento" />
          <Row icon={IC.box} label={t('set.stock')} sub={counts.supplies ? t('set.stockSub', { n: counts.supplies, k: counts.low }) : t('set.stockNone')} to="/app/mais/estoque" />
          {company?.mode !== 'residential' && <Row icon={IC.contract} label={t('ct.title')} sub={t('ins.title')} to="/app/contratos" />}
        </Group>
        <Group title={t('set.gTeam')}>
          <Row icon={IC.team} label={t('set.team')} sub={t('set.teamSub', { n: counts.team })} to="/app/mais/equipe" />
          <Row icon={IC.pay} label={t('set.teamPay')} sub={t('set.teamPaySub')} to="/app/financas/equipe" />
        </Group>
        <Group title={t('set.gMoney')}>
          <Row icon={IC.money} label={t('set.payInfo')} sub={payWays || t('set.payInfoNone')} to="/app/mais/recebimento" />
          <Row icon={IC.card} label={t('set.stripe')} sub={t('set.stripeSub')} to="/app/mais/stripe" />
          <Row icon={IC.link} label={t('set.integrations')} sub={t('set.integrationsSub')} to="/app/mais/integracoes" />
          <Row icon={IC.shield} label={t('set.security')} sub={t('set.securitySub')} to="/app/mais/seguranca" />
        </Group>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className="k-sec"><span>{t('set.auto')}</span></span>
          <div className="k-list">
            {([['r24', t('set.r24'), t('set.r24Sub')], ['otw', t('set.otw'), tg('set.otwSub')], ['rev', t('set.rev'), t('set.revSub')], ['late', t('set.late'), t('set.lateSub')]] as const).map(([k, label, s]) => (
              <label key={k} className="check" style={{ alignItems: 'center', gap: 12, minHeight: 56, cursor: 'pointer' }}>
                <span style={{ display: 'flex', flexDirection: 'column', flex: 1 }}><span style={{ fontWeight: 700, fontSize: 14 }}>{label}</span><span style={{ fontSize: 12, color: C.muted }}>{s}</span></span>
                <input type="checkbox" checked={!!auto[k]} onChange={() => setAuto(k)} />
              </label>
            ))}
          </div>
          <span className="k-help" style={{ fontSize: 12 }}>{t('set.autoNote')}</span>
        </div>

        <Group title={t('set.gApp')}>
          <Row icon={IC.bell} label={t('set.notif')} sub={t('set.notifSub')} to="/app/mais/avisos" />
          {isAdmin && <Row icon={IC.admin} label={t('ad.open')} to="/admin" />}
          <Row icon={IC.out} label={t('auth.signout')} onClick={() => setAskOut(true)} danger />
        </Group>
        <p className="k-s12 k-muted" style={{ textAlign: 'center', margin: 0 }}>Tidyo 0.2 · <Link to="/dia">{t('nav.myDay')}</Link></p>
      </main>
      <OwnerBar />
      {askOut && <Confirm text={`${t('auth.signout')}?`} confirmLabel={t('auth.signout')} onCancel={() => setAskOut(false)} onConfirm={async () => { await supabase.auth.signOut(); nav('/', { replace: true }); window.location.reload(); }} />}
    </div>
  );
}

function SettingsPage({ section }: { section: string }) {
  const { t } = useApp();
  const titles: Record<string, string> = { empresa: t('set.company'), idioma: t('set.lang'), precos: t('set.prices'), checklists: t('set.checklists'), cancelamento: t('set.cancel'), estoque: t('set.stock'), equipe: t('set.team'), recebimento: t('set.payInfo'), stripe: t('set.stripe'), integracoes: t('set.integrations'), seguranca: t('set.security'), avisos: t('set.notif') };
  return (
    <div className="k-screen">
      <main className="k-page" style={{ gap: 16 }}>
        <Head title={titles[section] || t('set.title')} back="/app/mais" />
        {section === 'empresa' && <CompanyPage />}
        {section === 'idioma' && <LangPage />}
        {section === 'precos' && <PricesPage />}
        {section === 'checklists' && <ChecklistsPage />}
        {section === 'cancelamento' && <CancelPage />}
        {section === 'estoque' && <StockPage />}
        {section === 'equipe' && <TeamPage />}
        {section === 'recebimento' && <PayInfoPage />}
        {section === 'stripe' && <Info text={t('set.stripeInfo')} />}
        {section === 'integracoes' && <Info text={t('set.integrationsInfo')} action={<Link to="/app/financas" className="k-btn k-btn-line">{t('fin.reports')}</Link>} />}
        {section === 'seguranca' && <SecuritySection />}
        {section === 'avisos' && <NotifPage />}
      </main>
      <OwnerBar />
    </div>
  );
}

function Info({ text, action }: { text: string; action?: React.ReactNode }) {
  return <div className="k-card" style={{ gap: 12 }}><span style={{ fontSize: 14, lineHeight: 1.55, whiteSpace: 'pre-line' }}>{text}</span>{action}</div>;
}

function useSaveCompany() {
  const { t, tErr, company, refresh, toast } = useApp();
  return async (patch: Record<string, unknown>) => {
    if (!company) return false;
    const { error } = await supabase.from('companies').update(patch).eq('id', company.id);
    if (error) { toast(tErr(error.message)); return false; }
    await refresh(); toast(t('c.saved')); return true;
  };
}

function CompanyPage() {
  const { t, company } = useApp();
  const save = useSaveCompany();
  const [f, setF] = useState({ name: company?.name || '', address: company?.address || '', state: company?.state || '', timezone: company?.timezone || 'America/New_York', mode: company?.mode || 'residential' });
  const zones = ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Phoenix', 'America/Los_Angeles', 'America/Anchorage', 'Pacific/Honolulu'];
  return (
    <div className="k-card" style={{ gap: 14 }}>
      <label className="k-field"><span>{t('nc.companyName')}</span><input className="k-input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
      <label className="k-field"><span>{t('nc.address')}</span><input className="k-input" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} placeholder="12 Elm St, Waterbury, CT 06702" /></label>
      <div style={{ display: 'grid', gridTemplateColumns: '96px 1fr', gap: 10 }}>
        <label className="k-field"><span>{t('set.state')}</span><input className="k-input" value={f.state} maxLength={2} onChange={(e) => setF({ ...f, state: e.target.value.toUpperCase() })} placeholder="CT" /></label>
        <label className="k-field"><span>{t('set.tz')}</span><Select value={f.timezone} onChange={(v) => setF({ ...f, timezone: v })} label={t('set.tz')}>{zones.map((z) => <option key={z} value={z}>{z.replace('America/', '').replace('Pacific/', '').replace('_', ' ')}</option>)}</Select></label>
      </div>
      <span className="k-lbl">{t('set.mode')}</span>
      <Segment value={f.mode} onChange={(v) => setF({ ...f, mode: v })} label={t('set.mode')} options={[{ value: 'residential', label: t('cl.res') }, { value: 'commercial', label: t('cl.com') }, { value: 'both', label: t('set.both') }]} />
      <button className="k-btn k-btn-fill k-btn-big" disabled={!f.name.trim()} onClick={() => { save({ name: f.name.trim(), address: f.address || null, state: f.state || null, timezone: f.timezone, mode: f.mode }).then((ok) => { if (ok && company && f.address.trim() && f.address !== company.address) supabase.functions.invoke('geocode', { body: { table: 'companies', ids: [company.id], address: f.address.trim() } }).then(() => undefined).catch(() => undefined); }); try { const s = JSON.parse(localStorage.getItem('tidyo.steps') || '{}'); localStorage.setItem('tidyo.steps', JSON.stringify({ ...s, emp: true })); } catch { /* ignore */ } }}>{t('c.save')}</button>
    </div>
  );
}

function LangPage() {
  const { t, lang, setLang, company } = useApp();
  const save = useSaveCompany();
  return (
    <>
      <div className="k-card" style={{ gap: 10 }}>
        <span className="k-lbl">{t('set.myLang')}</span>
        <Segment<Lang> value={lang} onChange={setLang} label={t('set.myLang')} options={(['pt-BR', 'en', 'es'] as Lang[]).map((l) => ({ value: l, label: LANG_LABEL[l] }))} />
        <span className="k-help">{t('set.myLangHint')}</span>
      </div>
      <div className="k-card" style={{ gap: 10 }}>
        <span className="k-lbl">{t('set.coLang')}</span>
        <Segment<Lang> value={(company?.default_language as Lang) || 'en'} onChange={(v) => save({ default_language: v })} label={t('set.coLang')} options={(['pt-BR', 'en', 'es'] as Lang[]).map((l) => ({ value: l, label: LANG_LABEL[l] }))} />
        <span className="k-help">{t('set.coLangHint')}</span>
      </div>
      <div className="k-card" style={{ gap: 6 }}><span className="k-lbl">{t('set.currency')}</span><span className="k-help">{t('set.currencyHint')}</span></div>
    </>
  );
}

type Extra = { id: string; name: string; price_cents: number; minutes: number; active: boolean };
function PricesPage() {
  const { t, tErr, company, toast } = useApp();
  const save = useSaveCompany();
  const [services, setServices] = useState<Service[] | null>(null);
  const [extras, setExtras] = useState<Extra[]>([]);
  const [edit, setEdit] = useState<{ kind: 'svc' | 'extra'; id?: string; name: string; price: string; min: string; type?: 'residential' | 'commercial' } | null>(null);
  const [p, setP] = useState(pricingOf(company?.pricing));
  const load = useCallback(async () => {
    if (!company) return;
    const [s, e] = await Promise.all([getServices(company.id), supabase.from('service_extras').select('id, name, price_cents, minutes, active').eq('company_id', company.id).eq('active', true).order('position')]);
    setServices(s); setExtras((e.data || []) as Extra[]);
  }, [company]);
  useEffect(() => { load(); }, [load]);
  const commit = async () => {
    if (!company || !edit) return;
    const cents = Math.round(parseFloat(edit.price.replace(',', '.')) * 100) || 0;
    const min = parseInt(edit.min, 10) || 0;
    const r = edit.kind === 'svc'
      ? edit.id ? await supabase.from('services').update({ name: edit.name, default_price_cents: cents, default_duration_min: Math.max(15, min), kind: edit.type }).eq('id', edit.id)
        : await supabase.from('services').insert({ company_id: company.id, name: edit.name, default_price_cents: cents, default_duration_min: Math.max(15, min), kind: edit.type || 'residential' })
      : edit.id ? await supabase.from('service_extras').update({ name: edit.name, price_cents: cents, minutes: min }).eq('id', edit.id)
        : await supabase.from('service_extras').insert({ company_id: company.id, name: edit.name, price_cents: cents, minutes: min });
    if (r.error) toast(tErr(r.error.message)); else { setEdit(null); load(); toast(t('c.saved')); }
  };
  const remove = async () => {
    if (!edit?.id) return;
    const r = await supabase.from(edit.kind === 'svc' ? 'services' : 'service_extras').update({ active: false }).eq('id', edit.id);
    if (r.error) toast(tErr(r.error.message)); else { setEdit(null); load(); }
  };
  const num = (k: keyof typeof PRICING, cents = false, pct = false) => (
    <input className="k-input" inputMode="decimal" style={{ minHeight: 44 }} value={pct ? Math.round(p[k] * 100) : cents ? (p[k] / 100).toString() : String(p[k])}
      onChange={(e) => { const v = parseFloat(e.target.value.replace(',', '.')) || 0; setP({ ...p, [k]: pct ? v / 100 : cents ? Math.round(v * 100) : v }); }} />
  );
  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span className="k-sec"><span>{t('set.types')}</span><button className="k-link" onClick={() => setEdit({ kind: 'svc', name: '', price: '', min: '120', type: company?.mode === 'commercial' ? 'commercial' : 'residential' })}>+ {t('set.addType')}</button></span>
        <div className="k-list">
          {!services ? <div className="skeleton" style={{ height: 40, margin: '8px 0' }} /> : services.map((s) => (
            <button key={s.id} className="k-row" onClick={() => setEdit({ kind: 'svc', id: s.id, name: s.name, price: (s.default_price_cents / 100).toString(), min: String(s.default_duration_min), type: s.kind })}>
              <span style={{ display: 'flex', flexDirection: 'column', flex: 1 }}><span style={{ fontWeight: 700 }}>{s.name}</span><span className="k-s12 k-muted">{Math.floor(s.default_duration_min / 60)}h{s.default_duration_min % 60 ? String(s.default_duration_min % 60).padStart(2, '0') : ''} · {s.kind === 'commercial' ? t('cl.com') : t('cl.res')}</span></span>
              <b className="num">{usd(s.default_price_cents)}</b><Svg d={I.chev} size={16} color="#9AA9A6" />
            </button>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span className="k-sec"><span>{t('job.extras')}</span><button className="k-link" onClick={() => setEdit({ kind: 'extra', name: '', price: '', min: '30' })}>+ {t('set.addExtra')}</button></span>
        <div className="k-list">
          {extras.length === 0 ? <span className="k-s125 k-muted" style={{ padding: '14px 0' }}>{t('set.noExtras')}</span> : extras.map((e) => (
            <button key={e.id} className="k-row" onClick={() => setEdit({ kind: 'extra', id: e.id, name: e.name, price: (e.price_cents / 100).toString(), min: String(e.minutes) })}>
              <span style={{ flex: 1, fontWeight: 700 }}>{e.name}</span><span className="k-s12 k-muted">+{e.minutes} min</span><b className="num">+{usd(e.price_cents)}</b><Svg d={I.chev} size={16} color="#9AA9A6" />
            </button>
          ))}
        </div>
      </div>
      <div className="k-card" style={{ gap: 12 }}>
        <span style={{ fontWeight: 800 }}>{t('set.estParams')}</span>
        <span className="k-help">{t('set.estParamsHint')}</span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, alignItems: 'end' }}>
          <label className="k-field"><span className="k-s12">{t('set.pBase')}</span>{num('res_base', true)}</label>
          <label className="k-field"><span className="k-s12">{t('set.pBed')}</span>{num('res_bed', true)}</label>
          <label className="k-field"><span className="k-s12">{t('set.pBath')}</span>{num('res_bath', true)}</label>
          <label className="k-field"><span className="k-s12">{t('set.pSqft')}</span>{num('com_sqft_hour')}</label>
          <label className="k-field"><span className="k-s12">{t('set.pCost')}</span>{num('com_cost_hour', true)}</label>
          <label className="k-field"><span className="k-s12">{t('set.pMargin')}</span>{num('com_margin', false, true)}</label>
        </div>
        <button className="k-btn k-btn-fill" onClick={() => save({ pricing: p })}>{t('c.save')}</button>
      </div>
      {edit && (
        <Sheet title={edit.id ? edit.name : edit.kind === 'svc' ? t('set.addType') : t('set.addExtra')} onClose={() => setEdit(null)}>
          <label className="k-field"><span>{t('set.name')}</span><input className="k-input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} autoFocus /></label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <label className="k-field"><span>{t('fin.valueUsd')}</span><input className="k-input" inputMode="decimal" value={edit.price} onChange={(e) => setEdit({ ...edit, price: e.target.value })} /></label>
            <label className="k-field"><span>{t('set.minutes')}</span><input className="k-input" inputMode="numeric" value={edit.min} onChange={(e) => setEdit({ ...edit, min: e.target.value })} /></label>
          </div>
          {edit.kind === 'svc' && company?.mode === 'both' && <Segment value={edit.type || 'residential'} onChange={(v) => setEdit({ ...edit, type: v })} label={t('cl.kind')} options={[{ value: 'residential', label: t('cl.res') }, { value: 'commercial', label: t('cl.com') }]} />}
          <SheetActions cancel={t('c.back')} onCancel={() => setEdit(null)} confirm={t('c.save')} onConfirm={commit} disabled={!edit.name.trim()} />
          {edit.id && <button className="k-link" style={{ alignSelf: 'center', color: '#9F1F14' }} onClick={remove}>{t('c.delete')}</button>}
        </Sheet>
      )}
    </>
  );
}

type Tpl = { id: string; name: string; checklist_template_items: { id: string; room: string; task: string; position: number }[] };
function ChecklistsPage() {
  const { t, tErr, company, toast } = useApp();
  const [list, setList] = useState<Tpl[] | null>(null);
  const [services, setServices] = useState<(Service & { checklist_template_id?: string | null })[]>([]);
  const [edit, setEdit] = useState<{ id?: string; name: string; text: string } | null>(null);
  const load = useCallback(async () => {
    if (!company) return;
    const [{ data }, s] = await Promise.all([
      supabase.from('checklist_templates').select('id, name, checklist_template_items(id, room, task, position)').eq('company_id', company.id).order('created_at'),
      supabase.from('services').select('id, name, kind, default_price_cents, default_duration_min, active, checklist_template_id').eq('company_id', company.id).eq('active', true),
    ]);
    setList((data || []) as Tpl[]); setServices((s.data || []) as never);
  }, [company]);
  useEffect(() => { load(); }, [load]);
  // one line per task, "Room: task"
  const toText = (tp: Tpl) => [...tp.checklist_template_items].sort((a, b) => a.position - b.position).map((i) => `${i.room.startsWith('std.') ? t(i.room) : i.room}: ${i.task.startsWith('std.') ? t(i.task) : i.task}`).join('\n');
  const commit = async () => {
    if (!company || !edit) return;
    let id = edit.id;
    if (id) await supabase.from('checklist_templates').update({ name: edit.name }).eq('id', id);
    else { const { data, error } = await supabase.from('checklist_templates').insert({ company_id: company.id, name: edit.name }).select('id').single(); if (error) { toast(tErr(error.message)); return; } id = data.id; }
    await supabase.from('checklist_template_items').delete().eq('template_id', id);
    const rows = edit.text.split('\n').map((l) => l.trim()).filter(Boolean).map((l, i) => { const [room, ...rest] = l.split(':'); return rest.length ? { room: room.trim(), task: rest.join(':').trim() } : { room: t('ck.general'), task: l, i }; })
      .map((r, i) => ({ template_id: id, company_id: company.id, room: r.room, task: r.task, position: i + 1 }));
    if (rows.length) { const { error } = await supabase.from('checklist_template_items').insert(rows); if (error) { toast(tErr(error.message)); return; } }
    setEdit(null); load(); toast(t('c.saved'));
  };
  const link = async (svc: string, tpl: string) => { await supabase.from('services').update({ checklist_template_id: tpl || null }).eq('id', svc); load(); toast(t('c.saved')); };
  return (
    <>
      <span className="k-help">{t('set.ckHint')}</span>
      <div className="k-list">
        {!list ? <div className="skeleton" style={{ height: 40, margin: '8px 0' }} /> : list.length === 0 ? <span className="k-s125 k-muted" style={{ padding: '14px 0' }}>{t('set.ckNone')}</span> : list.map((tp) => (
          <button key={tp.id} className="k-row" onClick={() => setEdit({ id: tp.id, name: tp.name, text: toText(tp) })}>
            <span style={{ flex: 1, fontWeight: 700 }}>{tp.name}</span><span className="k-s12 k-muted">{t('set.tasksN', { n: tp.checklist_template_items.length })}</span><Svg d={I.chev} size={16} color="#9AA9A6" />
          </button>
        ))}
      </div>
      <button className="k-btn k-btn-line" onClick={() => setEdit({ name: '', text: '' })}>+ {t('set.newChecklist')}</button>
      {services.length > 0 && list && list.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className="k-sec"><span>{t('set.ckByType')}</span></span>
          <div className="k-list">
            {services.map((s) => (
              <div key={s.id} className="k-row" style={{ cursor: 'default' }}>
                <span style={{ flex: 1, fontWeight: 700 }}>{s.name}</span>
                <div style={{ width: 170 }}><Select value={s.checklist_template_id || ''} onChange={(v) => link(s.id, v)} label={s.name}><option value="">{t('set.ckDefault')}</option>{list.map((tp) => <option key={tp.id} value={tp.id}>{tp.name}</option>)}</Select></div>
              </div>
            ))}
          </div>
        </div>
      )}
      {edit && (
        <Sheet title={edit.id ? edit.name : t('set.newChecklist')} onClose={() => setEdit(null)}>
          <label className="k-field"><span>{t('set.name')}</span><input className="k-input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="Deep clean" /></label>
          <label className="k-field"><span>{t('set.tasks')}</span><textarea className="k-input" style={{ minHeight: 220 }} value={edit.text} onChange={(e) => setEdit({ ...edit, text: e.target.value })} placeholder={t('set.tasksPh')} /></label>
          <span className="k-help">{t('set.tasksHint')}</span>
          <SheetActions cancel={t('c.back')} onCancel={() => setEdit(null)} confirm={t('c.save')} onConfirm={commit} disabled={!edit.name.trim()} />
          {edit.id && <button className="k-link" style={{ alignSelf: 'center', color: '#9F1F14' }} onClick={async () => { await supabase.from('checklist_templates').delete().eq('id', edit.id!); setEdit(null); load(); }}>{t('c.delete')}</button>}
        </Sheet>
      )}
    </>
  );
}

function CancelPage() {
  const { t, company } = useApp();
  const save = useSaveCompany();
  const [fee, setFee] = useState(company?.cancellation_fee_cents ? String(company.cancellation_fee_cents / 100) : '');
  const [hours, setHours] = useState(String(company?.cancellation_window_hours ?? 24));
  return (
    <div className="k-card" style={{ gap: 14 }}>
      <span className="k-help">{t('set.cancelHint')}</span>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <label className="k-field"><span>{t('set.fee')}</span><input className="k-input" inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} placeholder="40" /></label>
        <label className="k-field"><span>{t('set.window')}</span><input className="k-input" inputMode="numeric" value={hours} onChange={(e) => setHours(e.target.value)} /></label>
      </div>
      <span className="k-help">{fee ? t('set.cancelSub', { v: usd(Math.round(parseFloat(fee.replace(',', '.')) * 100) || 0), h: hours || 24 }) : t('set.cancelNone')}</span>
      <button className="k-btn k-btn-fill k-btn-big" onClick={() => save({ cancellation_fee_cents: Math.round(parseFloat(fee.replace(',', '.')) * 100) || 0, cancellation_window_hours: Math.min(168, Math.max(0, parseInt(hours, 10) || 24)) })}>{t('c.save')}</button>
    </div>
  );
}

type Supply = { id: string; name: string; unit: string; on_hand: number; reorder_at: number | null; unit_cost_cents: number | null };
function StockPage() {
  const { t, tErr, company, toast } = useApp();
  const [list, setList] = useState<Supply[] | null>(null);
  const [edit, setEdit] = useState<{ id?: string; name: string; unit: string; on_hand: string; reorder_at: string; cost: string } | null>(null);
  const load = useCallback(async () => {
    if (!company) return;
    const { data } = await supabase.from('supply_items').select('id, name, unit, on_hand, reorder_at, unit_cost_cents').eq('company_id', company.id).is('property_id', null).order('name');
    setList((data || []) as Supply[]);
  }, [company]);
  useEffect(() => { load(); }, [load]);
  const step = async (s: Supply, d: number) => {
    setList((l) => (l || []).map((x) => (x.id === s.id ? { ...x, on_hand: Math.max(0, Number(x.on_hand) + d) } : x)));
    await supabase.from('supply_items').update({ on_hand: Math.max(0, Number(s.on_hand) + d), updated_at: new Date().toISOString() }).eq('id', s.id);
  };
  const commit = async () => {
    if (!company || !edit) return;
    const row = { name: edit.name, unit: edit.unit || 'un', on_hand: parseFloat(edit.on_hand) || 0, reorder_at: edit.reorder_at ? parseFloat(edit.reorder_at) : null, unit_cost_cents: edit.cost ? Math.round(parseFloat(edit.cost.replace(',', '.')) * 100) : null };
    const r = edit.id ? await supabase.from('supply_items').update(row).eq('id', edit.id) : await supabase.from('supply_items').insert({ ...row, company_id: company.id });
    if (r.error) toast(tErr(r.error.message)); else { setEdit(null); load(); }
  };
  const low = (s: Supply) => s.reorder_at != null && Number(s.on_hand) <= Number(s.reorder_at);
  const value = (list || []).reduce((s, x) => s + Number(x.on_hand) * (x.unit_cost_cents || 0), 0);
  return (
    <>
      <div className="k-kpis two">
        <div className="k-kpi"><span className="k-kpi-l">{t('set.items')}</span><span className="k-kpi-v">{list?.length ?? '–'}</span><span className="k-kpi-n">{t('set.lowN', { n: (list || []).filter(low).length })}</span></div>
        <div className="k-kpi"><span className="k-kpi-l">{t('set.stockValue')}</span><span className="k-kpi-v">{usd(value)}</span><span className="k-kpi-n">{t('set.atCost')}</span></div>
      </div>
      <div className="k-list">
        {!list ? <div className="skeleton" style={{ height: 40, margin: '8px 0' }} /> : list.length === 0 ? <span className="k-s125 k-muted" style={{ padding: '14px 0' }}>{t('set.stockEmpty')}</span> : [...list].sort((a, b) => Number(low(b)) - Number(low(a))).map((s) => (
          <div key={s.id} className="k-row" style={{ cursor: 'default', minHeight: 60 }}>
            <button onClick={() => setEdit({ id: s.id, name: s.name, unit: s.unit, on_hand: String(s.on_hand), reorder_at: s.reorder_at != null ? String(s.reorder_at) : '', cost: s.unit_cost_cents ? String(s.unit_cost_cents / 100) : '' })} style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, background: 'none', border: 0, padding: 0, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', color: C.ink }}>
              <span className="k-ell" style={{ fontWeight: 700 }}>{s.name}</span>
              <span className="k-s12" style={{ color: low(s) ? '#9F1F14' : C.muted, fontWeight: low(s) ? 800 : 500 }}>{low(s) ? t('set.belowMin', { n: s.reorder_at! }) : s.reorder_at != null ? t('set.minIs', { n: s.reorder_at }) : s.unit}</span>
            </button>
            <button className="k-step" aria-label={`− ${s.name}`} onClick={() => step(s, -1)}>−</button>
            <span className="num" style={{ minWidth: 44, textAlign: 'center', fontWeight: 800 }}>{Number(s.on_hand)} <span className="k-s115 k-muted">{s.unit}</span></span>
            <button className="k-step" aria-label={`+ ${s.name}`} onClick={() => step(s, 1)}>+</button>
          </div>
        ))}
      </div>
      <button className="k-btn k-btn-line" onClick={() => setEdit({ name: '', unit: 'un', on_hand: '', reorder_at: '', cost: '' })}>+ {t('set.addItem')}</button>
      {edit && (
        <Sheet title={edit.id ? edit.name : t('set.addItem')} onClose={() => setEdit(null)}>
          <label className="k-field"><span>{t('set.name')}</span><input className="k-input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder={t('set.itemPh')} /></label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <label className="k-field"><span>{t('set.onHand')}</span><input className="k-input" inputMode="decimal" value={edit.on_hand} onChange={(e) => setEdit({ ...edit, on_hand: e.target.value })} /></label>
            <label className="k-field"><span>{t('set.unit')}</span><input className="k-input" value={edit.unit} onChange={(e) => setEdit({ ...edit, unit: e.target.value })} placeholder="un, gal, rolo" /></label>
            <label className="k-field"><span>{t('set.reorderAt')}</span><input className="k-input" inputMode="decimal" value={edit.reorder_at} onChange={(e) => setEdit({ ...edit, reorder_at: e.target.value })} /></label>
            <label className="k-field"><span>{t('set.unitCost')}</span><input className="k-input" inputMode="decimal" value={edit.cost} onChange={(e) => setEdit({ ...edit, cost: e.target.value })} /></label>
          </div>
          <SheetActions cancel={t('c.back')} onCancel={() => setEdit(null)} confirm={t('c.save')} onConfirm={commit} disabled={!edit.name.trim()} />
          {edit.id && <button className="k-link" style={{ alignSelf: 'center', color: '#9F1F14' }} onClick={async () => { await supabase.from('supply_items').delete().eq('id', edit.id!); setEdit(null); load(); }}>{t('c.delete')}</button>}
        </Sheet>
      )}
    </>
  );
}

function PayInfoPage() {
  const { t, company } = useApp();
  const save = useSaveCompany();
  const [f, setF] = useState<Record<string, string>>({ zelle: '', venmo: '', cashapp: '', check_to: '', check_address: '', note: '', ...(company?.payment_info || {}) });
  const field = (k: string, label: string, ph: string) => <label className="k-field"><span>{label}</span><input className="k-input" value={f[k] || ''} onChange={(e) => setF({ ...f, [k]: e.target.value })} placeholder={ph} /></label>;
  return (
    <div className="k-card" style={{ gap: 14 }}>
      <span className="k-help">{t('set.payInfoHint')}</span>
      {field('zelle', 'Zelle', t('set.zellePh'))}
      {field('venmo', 'Venmo', '@sparkle-cleaning')}
      {field('cashapp', 'Cash App', '$sparkleclean')}
      {field('check_to', t('set.checkTo'), company?.name || '')}
      {field('check_address', t('set.checkAddr'), '12 Elm St, Waterbury, CT 06702')}
      <label className="k-field"><span>{t('set.payNote')}</span><textarea className="k-input" style={{ minHeight: 72 }} value={f.note || ''} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder={t('set.payNotePh')} /></label>
      <button className="k-btn k-btn-fill k-btn-big" onClick={() => save({ payment_info: Object.fromEntries(Object.entries(f).filter(([, v]) => v.trim())) })}>{t('c.save')}</button>
    </div>
  );
}

function NotifPage() {
  const { t, company, membership, refresh, toast } = useApp();
  const toggle = async (field: 'allow_push_team' | 'allow_push_clients') => {
    if (!company) return;
    const { error } = await supabase.from('companies').update({ [field]: !company[field] }).eq('id', company.id);
    if (!error) { await refresh(); toast(t('c.saved')); }
  };
  return (
    <>
      <PushToggle />
      {membership?.role === 'owner' && (
        <div className="k-list">
          {(['allow_push_team', 'allow_push_clients'] as const).map((f) => (
            <label key={f} className="check" style={{ alignItems: 'center', gap: 12, minHeight: 60, cursor: 'pointer' }}>
              <span style={{ display: 'flex', flexDirection: 'column', flex: 1 }}><span style={{ fontWeight: 700 }}>{t(f === 'allow_push_team' ? 'more.pushTeam' : 'more.pushClients')}</span><span className="k-s12 k-muted">{t('more.pushHint')}</span></span>
              <input type="checkbox" checked={!!company?.[f]} onChange={() => toggle(f)} />
            </label>
          ))}
        </div>
      )}
    </>
  );
}

// ─────────────── Equipe e permissões ───────────────
function TeamPage() {
  const { t, tg, tErr, company, membership, toast } = useApp();
  const [members, setMembers] = useState<Member[] | null>(null);
  const [requests, setRequests] = useState<Member[]>([]);
  const [role, setRole] = useState<'helper' | 'manager' | 'client'>('helper');
  const [link, setLink] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);
  const [sel, setSel] = useState<Member | null>(null);
  const load = useCallback(async () => {
    if (!company) return;
    const m = await getMembers(company.id);
    setMembers(m.filter((x) => x.status === 'active' || (x.status === 'invited' && !x.user_id)));
    setRequests(m.filter((x) => x.status === 'invited' && x.user_id));
  }, [company]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!company || role === 'client' || link[role]) return;
    supabase.rpc('create_team_link', { p_company: company.id, p_role: role }).then(({ data, error }) => {
      if (error) toast(tErr(error.message)); else setLink((l) => ({ ...l, [role]: `${window.location.origin}/equipe?t=${data}` }));
    });
  }, [company, role]); // eslint-disable-line react-hooks/exhaustive-deps
  const decide = async (m: Member, ok: boolean) => {
    const { error } = await supabase.rpc('decide_join', { p_membership: m.id, p_approve: ok });
    if (error) toast(tErr(error.message)); else { toast(ok ? t('team.approved', { name: m.display_name }) : t('c.saved')); load(); }
  };
  const genderOf = (m: Member) => (m.gender as Gender | null) || guessGender(m.display_name);
  const RL: Record<string, [string, string]> = { owner: ['#0F1F1C', '#FFFFFF'], manager: ['#E8E4F8', '#4B3BA8'], helper: ['#DDF1EC', '#0B6B5F'] };
  const cur = link[role];
  const waText = t('team.linkWa', { company: company?.name || '', link: cur || '' });
  return (
    <>
      {requests.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className="k-sec"><span>{t('team.requests')}</span></span>
          {requests.map((m) => (
            <div key={m.id} className="k-card r16" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Avatar name={m.display_name} color="#8A4B05" size={36} font={12} />
              <span style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}><b className="k-ell">{m.display_name}</b><span className="k-s12 k-muted">{tg(`team.${m.role}`, genderOf(m))} · {LANG_LABEL[m.language as Lang]}</span></span>
              <button className="k-btn k-btn-line k-btn-sm" onClick={() => decide(m, false)}>{t('team.deny')}</button>
              <button className="k-btn k-btn-fill k-btn-sm" onClick={() => decide(m, true)}>{t('team.approve')}</button>
            </div>
          ))}
        </div>
      )}
      <div className="k-card" style={{ padding: '4px 14px', gap: 0 }}>
        <span className="k-h2s" style={{ padding: '10px 0' }}>{t('team.teamN', { n: members?.length ?? 0 })}</span>
        {(members || []).map((m) => {
          const [bg, fg] = RL[m.role];
          return (
            <button key={m.id} className="k-row" style={{ borderTop: `1px solid ${C.soft}`, gap: 10 }} onClick={() => setSel(m)}>
              <Avatar name={m.display_name} color={m.role === 'owner' ? '#1C3D8F' : colorOf(memberIndex(members || [], m.id))[0]} size={36} font={12} />
              <span style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}><span className="k-ell" style={{ fontWeight: 800 }}>{shortName(m.display_name)}</span><span className="k-s12 k-muted">{m.status === 'invited' ? t('team.invited') : LANG_LABEL[m.language as Lang]}</span></span>
              <span className="k-pill" style={{ background: bg, color: fg }}>{tg(`team.${m.role}`, genderOf(m))}</span>
            </button>
          );
        })}
      </div>
      <div style={{ background: C.bg, border: `1px solid ${C.line}`, borderRadius: 16, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span style={{ fontWeight: 800, fontSize: 14.5 }}>{t('team.inviteSomeone')}</span>
        <div className="k-chips">
          {([['helper', t('team.helper')], ...(membership?.role === 'owner' ? [['manager', t('team.manager')]] : []), ['client', t('team.clientPortal')]] as [typeof role, string][]).map(([id, label]) => (
            <button key={id} className="k-chip" style={{ minHeight: 38 }} aria-pressed={role === id} onClick={() => { setRole(id); setCopied(false); }}>{label}</button>
          ))}
        </div>
        <span className="k-s125 k-muted" style={{ lineHeight: 1.45 }}>{t(`team.hint.${role}`)}</span>
        {role === 'client' ? <Link to="/app/clientes" className="k-btn k-btn-line">{t('team.toClients')}</Link> : <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#FFFFFF', border: `1px solid ${C.line}`, borderRadius: 12, padding: '4px 4px 4px 12px' }}>
            <code className="k-ell" style={{ fontFamily: 'Manrope, sans-serif', fontSize: 13, fontWeight: 700, flex: 1, userSelect: 'all' }}>{cur ? cur.replace(/^https?:\/\//, '') : '…'}</code>
            <button className="k-btn k-btn-fill" style={{ minHeight: 40, borderRadius: 10, fontSize: 12.5, padding: '0 12px' }} disabled={!cur} onClick={async () => { try { await navigator.clipboard.writeText(cur); setCopied(true); } catch { /* ignore */ } }}>{copied ? t('c.copied') : t('c.copy')}</button>
          </div>
          {cur && <a className="k-btn k-btn-line" href={`https://wa.me/?text=${encodeURIComponent(waText)}`} target="_blank" rel="noreferrer">{t('team.whatsapp')}</a>}
          <span className="k-s12 k-muted">{t('team.linkNote')}</span>
        </>}
      </div>
      {sel && <MemberSheet m={sel} members={members || []} onClose={() => setSel(null)} onChanged={() => { setSel(null); load(); }} />}
    </>
  );
}

function MemberSheet({ m, onClose, onChanged }: { m: Member; members: Member[]; onClose: () => void; onChanged: () => void }) {
  const { t, tg, tErr, company, membership, refresh, toast } = useApp();
  const [g, setG] = useState<'f' | 'm'>(((m.gender as Gender | null) || guessGender(m.display_name)) === 'm' ? 'm' : 'f');
  const [addr, setAddr] = useState(m.origin_address || '');
  const [rate, setRate] = useState<{ hourly: string; perJob: string }>({ hourly: '', perJob: '' });
  const [ask, setAsk] = useState(false);
  useEffect(() => { supabase.from('member_pay_rates').select('hourly_cents, per_job_cents').eq('membership_id', m.id).maybeSingle().then(({ data }) => { if (data) setRate({ hourly: String(data.hourly_cents / 100), perJob: data.per_job_cents ? String(data.per_job_cents / 100) : '' }); }); }, [m.id]);
  const saveG = async (v: 'f' | 'm') => { setG(v); const { error } = await supabase.from('memberships').update({ gender: v }).eq('id', m.id); if (error) toast(tErr(error.message)); else if (m.id === membership?.id) refresh(); };
  const saveOrigin = async () => {
    const { data, error } = await supabase.functions.invoke('geocode', { body: { table: 'memberships', ids: [m.id], address: addr } });
    if (error || data?.error || !data?.results?.[0]?.ok) toast(data?.error === 'maps_not_configured' ? t('rt.noKey') : t('c.error')); else toast(t('c.saved'));
  };
  const saveRate = async () => {
    if (!company) return;
    const h = Math.round(parseFloat(rate.hourly.replace(',', '.')) * 100) || 0, p = rate.perJob ? Math.round(parseFloat(rate.perJob.replace(',', '.')) * 100) : null;
    const { error } = await supabase.from('member_pay_rates').upsert({ membership_id: m.id, company_id: company.id, hourly_cents: h, per_job_cents: p });
    if (error) toast(tErr(error.message)); else toast(t('c.saved'));
  };
  const differs = tg(`team.${m.role}`, 'f') !== tg(`team.${m.role}`, 'm');
  return (
    <Sheet title={m.display_name} onClose={onClose}>
      <div className="k-chips" style={{ marginTop: -6 }}><span className="k-pill" style={{ background: PILL.neutral[0], color: PILL.neutral[1] }}>{tg(`team.${m.role}`, g)}</span><span className="k-pill" style={{ background: m.status === 'active' ? PILL.ok[0] : PILL.warn[0], color: m.status === 'active' ? PILL.ok[1] : PILL.warn[1] }}>{m.status === 'active' ? tg('team.active', g) : t('team.invited')}</span></div>
      {differs && <><span className="k-lbl">{t('team.address')}</span><Segment value={g} onChange={saveG} label={t('team.address')} options={[{ value: 'f', label: tg(`team.${m.role}`, 'f') }, { value: 'm', label: tg(`team.${m.role}`, 'm') }]} /></>}
      {m.role !== 'owner' && (
        <>
          <span className="k-lbl">{t('team.pay')}</span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'end' }}>
            <label className="k-field"><span className="k-s12">{t('team.perHour')}</span><input className="k-input" inputMode="decimal" value={rate.hourly} onChange={(e) => setRate({ ...rate, hourly: e.target.value })} /></label>
            <label className="k-field"><span className="k-s12">{t('team.perJob')}</span><input className="k-input" inputMode="decimal" value={rate.perJob} onChange={(e) => setRate({ ...rate, perJob: e.target.value })} /></label>
            <button className="k-btn k-btn-line" onClick={saveRate}>{t('c.save')}</button>
          </div>
        </>
      )}
      {m.status === 'active' && <>
        <span className="k-lbl">{t('team.origin')}</span>
        <span className="k-help">{tg('team.originHint', g)}</span>
        <div style={{ display: 'flex', gap: 8 }}><input className="k-input" value={addr} onChange={(e) => setAddr(e.target.value)} placeholder="12 Elm St, Waterbury, CT 06702" /><button className="k-btn k-btn-line" disabled={addr.trim().length < 6} onClick={saveOrigin}>{t('c.save')}</button></div>
      </>}
      {m.role !== 'owner' && membership?.role === 'owner' && <button className="k-link" style={{ alignSelf: 'center', color: '#9F1F14' }} onClick={() => setAsk(true)}>{t('team.remove')}</button>}
      {ask && <Confirm danger text={t('team.removeAsk', { name: m.display_name })} confirmLabel={t('team.remove')} onCancel={() => setAsk(false)} onConfirm={async () => {
        setAsk(false);
        const { error } = await supabase.from('memberships').update({ status: 'removed' }).eq('id', m.id);
        if (error) toast(tErr(error.message)); else onChanged();
      }} />}
    </Sheet>
  );
}
