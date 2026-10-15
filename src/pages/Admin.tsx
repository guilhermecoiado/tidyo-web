import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useApp } from '../lib/session';
import { Confirm, Field, Icon, LoadingList, Segmented, Sheet } from '../components/ui';
import { TicketThread } from './Inbox';
import { LANG_LABEL, type Lang } from '../lib/i18n';

type Co = { id: string; name: string; mode: string; created_at: string; plan: string | null; has_commercial: boolean | null; status: string | null; trial_ends_at: string | null; owner_name: string | null; owner_email: string | null; members: number; clients: number; jobs_30d: number; utm: Record<string, string> | null };
type Tk = { id: string; subject: string; status: string; language: string; updated_at: string; company_name: string | null; opener_email: string; last_message: string | null };
type Ad = { id: string; name: string; format: string; status: string; content: Record<string, { title?: string; body?: string; cta?: string }>; cta_url: string | null; utm: Record<string, string>; created_at: string };

const LANGS: Lang[] = ['pt-BR', 'en', 'es'];
const PRICE: Record<string, number> = { essencial: 29, pro: 69, comercial: 49 };

export default function Admin() {
  const { t } = useApp();
  const [tab, setTab] = useState<'subs' | 'support' | 'comms' | 'ads'>('subs');
  return (
    <div className="shell" style={{ maxWidth: 980 }}>
      <main className="page no-nav">
        <div className="topbar">
          <Link className="icon-btn" to="/" aria-label={t('c.close')}><Icon name="chevL" size={18} /></Link>
          <h1 className="grow">{t('ad.title')}</h1>
        </div>
        <Segmented value={tab} onChange={setTab} label={t('ad.title')} options={[{ value: 'subs', label: t('ad.subs') }, { value: 'support', label: t('ad.support') }, { value: 'comms', label: t('ad.comms') }, { value: 'ads', label: t('ad.ads') }]} />
        {tab === 'subs' && <Subscribers />}
        {tab === 'support' && <Support />}
        {tab === 'comms' && <Comms />}
        {tab === 'ads' && <Ads />}
      </main>
    </div>
  );
}

function Subscribers() {
  const { t, lang } = useApp();
  const [list, setList] = useState<Co[] | null>(null);
  const [q, setQ] = useState('');
  useEffect(() => { supabase.rpc('admin_companies').then(({ data }) => setList((data || []) as Co[])); }, []);
  const shown = (list || []).filter((c) => !q || `${c.name} ${c.owner_email}`.toLowerCase().includes(q.toLowerCase()));
  const stats = useMemo(() => {
    const l = list || [];
    const active = l.filter((c) => c.status === 'active');
    const mrr = active.reduce((s, c) => s + (PRICE[c.plan || 'pro'] || 0) + (c.has_commercial && c.plan !== 'comercial' ? 49 : 0), 0);
    const sources: Record<string, number> = {};
    for (const c of l) { const k = c.utm?.utm_source || t('ad.direct'); sources[k] = (sources[k] || 0) + 1; }
    return { total: l.length, trialing: l.filter((c) => c.status === 'trialing').length, active: active.length, mrr, sources };
  }, [list, t]);
  return (
    <>
      <div className="grid2" style={{ gridTemplateColumns: 'repeat(4, minmax(0,1fr))' }}>
        <div className="kpi"><div className="label">{t('ad.companies')}</div><div className="value num">{stats.total}</div></div>
        <div className="kpi"><div className="label">{t('ad.trialing')}</div><div className="value num">{stats.trialing}</div></div>
        <div className="kpi"><div className="label">{t('ad.paying')}</div><div className="value num">{stats.active}</div></div>
        <div className="kpi"><div className="label">MRR</div><div className="value num">${stats.mrr}</div></div>
      </div>
      {Object.keys(stats.sources).length > 0 && (
        <div className="card stack" style={{ gap: 6 }}>
          <span className="label">{t('ad.sources')}</span>
          {Object.entries(stats.sources).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
            <div key={k} className="row small"><span style={{ width: 110 }}>{k}</span><div style={{ flex: 1, height: 10, borderRadius: 10, background: 'var(--line)' }}><div style={{ width: `${(v / stats.total) * 100}%`, height: '100%', borderRadius: 10, background: 'var(--action)' }} /></div><b className="num">{v}</b></div>
          ))}
        </div>
      )}
      <input className="input" placeholder={t('c.search')} aria-label={t('c.search')} value={q} onChange={(e) => setQ(e.target.value)} />
      {!list ? <LoadingList /> : shown.length === 0 ? <div className="empty">{t('ad.noCompanies')}</div> : (
        <div className="list">
          {shown.map((c) => (
            <div key={c.id} className="card stack" style={{ gap: 4 }}>
              <div className="row"><span className="grow bold">{c.name}</span><span className={`badge ${c.status === 'active' ? 'b-ok' : c.status === 'trialing' ? 'b-neutral' : 'b-warn'}`}>{c.status}</span></div>
              <div className="small muted">{c.owner_name} · {c.owner_email} · {c.plan}{c.has_commercial && c.plan !== 'comercial' ? ' + comercial' : ''} · {new Date(c.created_at).toLocaleDateString(lang)}</div>
              <div className="small">{t('ad.usage', { m: c.members, c: c.clients, j: c.jobs_30d })}</div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function Support() {
  const { t, lang } = useApp();
  const [list, setList] = useState<Tk[] | null>(null);
  const [view, setView] = useState<Tk | null>(null);
  const load = useCallback(() => { supabase.rpc('admin_tickets').then(({ data }) => setList((data || []) as Tk[])); }, []);
  useEffect(() => { load(); }, [load]);
  return (
    <>
      {!list ? <LoadingList /> : list.length === 0 ? <div className="empty">{t('ad.noTickets')}</div> : (
        <div className="list">
          {list.map((k) => (
            <button key={k.id} className="item" onClick={() => setView(k)}>
              <span className="body">
                <span className="title">{k.subject}</span>
                <span className="small muted">{k.company_name || '—'} · {k.opener_email} · {LANG_LABEL[k.language as Lang]} · {new Date(k.updated_at).toLocaleString(lang, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span>
                {k.last_message && <span className="small" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k.last_message}</span>}
              </span>
              <span className={`badge ${k.status === 'open' ? 'b-danger' : k.status === 'resolved' ? 'b-ok' : 'b-warn'}`}>{t(`hp.st.${k.status}`)}</span>
            </button>
          ))}
        </div>
      )}
      {view && <TicketThread ticket={view} asAdmin onClose={() => { setView(null); load(); }} />}
    </>
  );
}

function LangFields({ value, onChange, withCta }: { value: Record<string, { title?: string; body?: string; cta?: string }>; onChange: (v: Record<string, { title?: string; body?: string; cta?: string }>) => void; withCta?: boolean }) {
  const { t } = useApp();
  const [l, setL] = useState<Lang>('en');
  const cur = value[l] || {};
  const set = (k: 'title' | 'body' | 'cta', v: string) => onChange({ ...value, [l]: { ...cur, [k]: v } });
  return (
    <div className="stack" style={{ gap: 10 }}>
      <Segmented value={l} onChange={setL} label={t('more.lang')} options={LANGS.map((x) => ({ value: x, label: LANG_LABEL[x] }))} />
      <Field label={t('ad.msgTitle')}><input className="input" value={cur.title || ''} onChange={(e) => set('title', e.target.value)} /></Field>
      <Field label={t('ad.msgBody')}><textarea className="textarea" value={cur.body || ''} onChange={(e) => set('body', e.target.value)} /></Field>
      {withCta && <Field label={t('ad.cta')}><input className="input" value={cur.cta || ''} onChange={(e) => set('cta', e.target.value)} /></Field>}
    </div>
  );
}

function Comms() {
  const { t, tErr, toast } = useApp();
  const [audience, setAudience] = useState<'owners' | 'team' | 'everyone'>('owners');
  const [content, setContent] = useState<Record<string, { title?: string; body?: string }>>({});
  const [link, setLink] = useState('');
  const [ask, setAsk] = useState(false);
  const send = async () => {
    const { data, error } = await supabase.rpc('admin_broadcast', { p_audience: audience, p_content: content, p_link: link || null });
    if (error) toast(tErr(error.message)); else { toast(t('ad.sentTo', { n: data as number })); setContent({}); setLink(''); }
  };
  const ok = LANGS.some((l) => content[l]?.title);
  return (
    <section className="card stack" style={{ gap: 14 }}>
      <h2>{t('ad.broadcast')}</h2>
      <Segmented value={audience} onChange={setAudience} label={t('ad.audience')} options={[{ value: 'owners', label: t('ad.owners') }, { value: 'team', label: t('ad.helpers') }, { value: 'everyone', label: t('ad.everyone') }]} />
      <LangFields value={content} onChange={setContent} />
      <Field label={`${t('ad.link')} (${t('c.optional')})`}><input className="input" value={link} onChange={(e) => setLink(e.target.value)} placeholder="/app/financas" /></Field>
      <span className="hint">{t('ad.langHint')}</span>
      <button className="btn btn-primary" disabled={!ok} onClick={() => setAsk(true)}>{t('ad.send')}</button>
      {ask && <Confirm text={t('ad.sendAsk')} confirmLabel={t('ad.send')} onCancel={() => setAsk(false)} onConfirm={() => { setAsk(false); send(); }} />}
    </section>
  );
}

function Ads() {
  const { t, tErr, lang, toast, session } = useApp();
  const [list, setList] = useState<Ad[] | null>(null);
  const [stats, setStats] = useState<Record<string, { impression: number; click: number }>>({});
  const [create, setCreate] = useState(false);
  const load = useCallback(async () => {
    const { data } = await supabase.from('ad_campaigns').select('id, name, format, status, content, cta_url, utm, created_at').order('created_at', { ascending: false });
    setList((data || []) as Ad[]);
    const { data: ev } = await supabase.from('ad_events').select('campaign_id, event').limit(5000);
    const s: Record<string, { impression: number; click: number }> = {};
    for (const e of (ev || []) as { campaign_id: string; event: string }[]) { s[e.campaign_id] = s[e.campaign_id] || { impression: 0, click: 0 }; if (e.event === 'impression' || e.event === 'click') s[e.campaign_id][e.event]++; }
    setStats(s);
  }, []);
  useEffect(() => { load(); }, [load]);
  const setStatus = async (a: Ad, status: string) => {
    const { error } = await supabase.from('ad_campaigns').update({ status }).eq('id', a.id);
    if (error) toast(tErr(error.message)); else load();
  };
  return (
    <>
      <button className="btn btn-primary" onClick={() => setCreate(true)}><Icon name="plus" size={18} />{t('ad.newAd')}</button>
      {!list ? <LoadingList /> : list.length === 0 ? <div className="empty">{t('ad.noAds')}</div> : (
        <div className="list">
          {list.map((a) => {
            const s = stats[a.id] || { impression: 0, click: 0 };
            return (
              <div key={a.id} className="card stack" style={{ gap: 6 }}>
                <div className="row"><span className="grow bold">{a.name}</span><span className={`badge ${a.status === 'running' ? 'b-ok' : 'b-neutral'}`}>{t(`ad.st.${a.status}`)}</span></div>
                <div className="small muted">{t(`ad.fmt.${a.format}`)} · {a.content?.[lang]?.title || a.content?.en?.title}</div>
                <div className="small">{t('ad.metrics', { i: s.impression, c: s.click, r: s.impression ? ((s.click / s.impression) * 100).toFixed(1) : '0' })}</div>
                <div className="row">
                  {a.status !== 'running' ? <button className="btn btn-primary" style={{ minHeight: 40 }} onClick={() => setStatus(a, 'running')}>{t('ad.start')}</button>
                    : <button className="btn btn-secondary" style={{ minHeight: 40 }} onClick={() => setStatus(a, 'paused')}>{t('ct.pause')}</button>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {create && <AdForm uid={session?.user.id || ''} onClose={() => setCreate(false)} onSaved={() => { setCreate(false); load(); }} />}
    </>
  );
}

function AdForm({ uid, onClose, onSaved }: { uid: string; onClose: () => void; onSaved: () => void }) {
  const { t, tErr, toast } = useApp();
  const [name, setName] = useState('');
  const [format, setFormat] = useState<'top_banner' | 'cta_card'>('top_banner');
  const [content, setContent] = useState<Record<string, { title?: string; body?: string; cta?: string }>>({});
  const [url, setUrl] = useState('');
  const [campaign, setCampaign] = useState('');
  const save = async (e: FormEvent) => {
    e.preventDefault();
    const utm = { utm_source: 'tidyo', utm_medium: format, utm_campaign: campaign || name.toLowerCase().replace(/\s+/g, '-') };
    const { error } = await supabase.from('ad_campaigns').insert({ name, format, status: 'draft', content, cta_url: url || null, utm, created_by: uid });
    if (error) toast(tErr(error.message)); else { toast(t('c.saved')); onSaved(); }
  };
  return (
    <Sheet title={t('ad.newAd')} onClose={onClose}>
      <form className="stack" style={{ gap: 14 }} onSubmit={save}>
        <Field label={t('ad.name')}><input className="input" value={name} onChange={(e) => setName(e.target.value)} required /></Field>
        <Segmented value={format} onChange={setFormat} label={t('ad.format')} options={[{ value: 'top_banner', label: t('ad.fmt.top_banner') }, { value: 'cta_card', label: t('ad.fmt.cta_card') }]} />
        <LangFields value={content} onChange={setContent} withCta />
        <Field label={t('ad.url')}><input className="input" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" /></Field>
        <Field label="utm_campaign"><input className="input" value={campaign} onChange={(e) => setCampaign(e.target.value)} /></Field>
        <button className="btn btn-primary btn-block" disabled={!name}>{t('c.save')}</button>
      </form>
    </Sheet>
  );
}

// Banner shown to owners on the home screen
export function AdSlot() {
  const { lang, session, company } = useApp();
  const [ad, setAd] = useState<Ad | null>(null);
  useEffect(() => {
    supabase.from('ad_campaigns').select('id, name, format, status, content, cta_url, utm, created_at').eq('status', 'running').limit(5).then(({ data }) => {
      let hidden: string[] = [];
      try { hidden = JSON.parse(localStorage.getItem('tidyo.adsClosed') || '[]'); } catch { /* ignore */ }
      const a = ((data || []) as Ad[]).find((x) => !hidden.includes(x.id)) || null;
      setAd(a);
      if (a && session) supabase.from('ad_events').insert({ campaign_id: a.id, user_id: session.user.id, company_id: company?.id || null, event: 'impression' }).then(() => undefined);
    });
  }, [session, company]);
  if (!ad) return null;
  const c = ad.content?.[lang] || ad.content?.en || Object.values(ad.content || {})[0] || {};
  if (!c.title && !c.body) return null;
  const log = (event: string) => session && supabase.from('ad_events').insert({ campaign_id: ad.id, user_id: session.user.id, company_id: company?.id || null, event }).then(() => undefined);
  const close = () => { try { const h = JSON.parse(localStorage.getItem('tidyo.adsClosed') || '[]'); localStorage.setItem('tidyo.adsClosed', JSON.stringify([...h, ad.id])); } catch { /* ignore */ } log('close'); setAd(null); };
  const href = ad.cta_url ? `${ad.cta_url}${ad.cta_url.includes('?') ? '&' : '?'}${new URLSearchParams(ad.utm || {}).toString()}` : undefined;
  return (
    <div className="card stack ad-card" role="complementary" aria-label={c.title}>
      <div style={{ paddingRight: 36 }}>
        {c.title && <div className="bold">{c.title}</div>}
        {c.body && <div className="small">{c.body}</div>}
      </div>
      {href && c.cta && <a className="btn btn-primary" style={{ minHeight: 40, alignSelf: 'flex-start' }} href={href} target="_blank" rel="noreferrer" onClick={() => log('click')}>{c.cta}</a>}
      <button className="icon-btn" onClick={close} aria-label="×" style={{ position: 'absolute', top: 2, right: 2, background: 'transparent', border: 0 }}><Icon name="x" size={16} /></button>
    </div>
  );
}
