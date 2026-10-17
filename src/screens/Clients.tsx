// Clientes — canvas Clientes (list with margin, filters, detail sheet with 90-day profit, notes and visits)
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useApp } from '../lib/session';
import { Confirm, Sheet } from '../components/ui';
import { LeadsSheet, useNewLeads } from './Leads';
import { C, OwnerBar, ProNote, usePro, Svg, I, colorOf, initials, hm, shortName, usd } from '../components/kit';
import { archiveClient, getClients, getMembers, type Client, type Member } from '../lib/data';
import { addDays, randomToken, sha256Hex } from '../lib/format';
import { LANG_LABEL, type Lang } from '../lib/i18n';
import { recurrenceText } from './JobSheet';
import { ImportSheet } from './ImportClients';

type Profit = { client_id: string; revenue_cents: number; labour_cents: number; expense_cents: number; profit_cents: number };
type NextJob = { client_id: string; scheduled_start: string; contract_id: string | null; recurrences: { rrule: string } | null };

export default function Clients() {
  const { t, lang, company } = useApp();
  const [clients, setClients] = useState<Client[] | null>(null);
  const [profit, setProfit] = useState<Map<string, Profit>>(new Map());
  const [next, setNext] = useState<Map<string, NextJob>>(new Map());
  const [renew, setRenew] = useState<Map<string, string | null>>(new Map());
  const [f, setF] = useState<'all' | 'residential' | 'commercial' | 'low'>('all');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<Client | null>(null);
  const [imp, setImp] = useState(false);
  const [params, setParams] = useSearchParams();
  const [newLeads, reloadLeads] = useNewLeads();
  const [leads, setLeads] = useState(params.get('pedidos') === '1');

  const load = useCallback(async () => {
    if (!company) return;
    const [c, p, n, ct] = await Promise.all([
      getClients(company.id),
      supabase.from('v_client_profit_90d').select('client_id, revenue_cents, labour_cents, expense_cents, profit_cents').eq('company_id', company.id),
      supabase.from('jobs').select('client_id, scheduled_start, contract_id, recurrences(rrule)').eq('company_id', company.id).eq('status', 'scheduled').gte('scheduled_start', new Date().toISOString()).order('scheduled_start').limit(500),
      supabase.from('contracts').select('client_id, renews_on').eq('company_id', company.id).eq('status', 'active'),
    ]);
    setClients(c);
    setProfit(new Map(((p.data || []) as Profit[]).map((r) => [r.client_id, r])));
    const m = new Map<string, NextJob>();
    for (const j of (n.data || []) as unknown as NextJob[]) if (!m.has(j.client_id)) m.set(j.client_id, j);
    setNext(m);
    setRenew(new Map(((ct.data || []) as { client_id: string; renews_on: string | null }[]).map((r) => [r.client_id, r.renews_on])));
  }, [company]);
  useEffect(() => { load(); }, [load]);
  // deep link from a notification: /app/clientes?c=<id>
  useEffect(() => {
    const id = params.get('c');
    if (!id || !clients) return;
    const c = clients.find((x) => x.id === id);
    if (c) setSel(c);
    const p = new URLSearchParams(params); p.delete('c'); setParams(p, { replace: true });
  }, [params, clients, setParams]);

  const margin = (id: string) => { const p = profit.get(id); return p && p.revenue_cents > 0 ? p.profit_cents / p.revenue_cents : null; };
  const list = useMemo(() => (clients || []).filter((c) => {
    if (f === 'low') { const m = margin(c.id); if (m == null || m >= 0.25) return false; } else if (f !== 'all' && c.kind !== f) return false;
    const s = q.trim().toLowerCase();
    return !s || `${c.name} ${c.phone || ''} ${c.email || ''} ${c.properties.map((p) => `${p.address_line1} ${p.city}`).join(' ')}`.toLowerCase().includes(s);
  }), [clients, f, q, profit]); // eslint-disable-line react-hooks/exhaustive-deps
  const count = (k: string) => (clients || []).filter((c) => c.kind === k).length;
  const lowCount = (clients || []).filter((c) => { const m = margin(c.id); return m != null && m < 0.25; }).length;
  const nextLine = (c: Client) => {
    const n = next.get(c.id);
    const days = (d: string | null | undefined) => (d ? Math.ceil((new Date(d + 'T12:00').getTime() - Date.now()) / 864e5) : null);
    if (c.kind === 'commercial' && renew.has(c.id)) {
      const r = days(renew.get(c.id));
      return `${t('job.recContract')}${n ? ` · ${t('cl.nextShort', { when: whenText(n.scheduled_start) })}` : ''}${r != null && r <= 45 ? ` · ${t('cl.renewsIn', { n: Math.max(0, r) })}` : ''}`;
    }
    if (!n) return c.properties[0] ? `${c.properties[0].address_line1}, ${c.properties[0].city}` : t('cl.noNext');
    return `${t('cl.next', { when: whenText(n.scheduled_start) })} · ${recurrenceText({ contract_id: n.contract_id, recurrences: n.recurrences } as never, t).toLowerCase()}`;
  };
  const whenText = (iso: string) => `${new Date(iso).toLocaleDateString(lang, { weekday: 'short', day: 'numeric' }).replace('.', '')} · ${hm(iso, lang)}`;
  const avatarColor = (c: Client) => colorOf((clients || []).indexOf(c) + 2)[0];

  return (
    <div className="k-screen">
      <main className="k-page" style={{ gap: 14 }}>
        <div className="k-head">
          <span className="k-title" style={{ flex: 1, fontSize: 22 }}>{t('nav.clients')}</span>
          {company?.mode !== 'residential' && <Link to="/app/contratos" className="k-btn k-btn-line nw" style={{ minHeight: 40, borderRadius: 12, fontSize: 12.5, padding: '0 12px' }}>{t('ct.title')}</Link>}
          <button className="k-btn k-btn-line nw" style={{ minHeight: 40, borderRadius: 12, fontSize: 12.5, padding: '0 12px' }} onClick={() => setImp(true)}>{t('cl.import')}</button>
          <Link to="/app/clientes/novo" className="k-iconbtn" style={{ background: C.accent, border: 0 }} aria-label={t('cl.new')}><Svg d={I.plus} size={20} color="#FFFFFF" w={2.4} /></Link>
        </div>
        {newLeads > 0 && (
          <button className="k-note ok" onClick={() => setLeads(true)} style={{ textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', width: '100%' }}>
            <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: '#0B4F46' }}>{t('ld.banner', { n: newLeads })}</span>
            <span className="k-btn k-btn-sm k-btn-fill nw" style={{ minHeight: 36, flex: 'none', color: '#FFFFFF' }}>{t('ld.see')}</span>
          </button>
        )}
        <label style={{ display: 'block' }}>
          <span className="sr-only">{t('c.search')}</span>
          <input className="k-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('cl.searchPh')} />
        </label>
        <div className="k-statseg" role="group" aria-label={t('cl.filter')}>
          {([['all', t('cl.all'), clients?.length ?? 0], ['residential', t('cl.resPl'), count('residential')], ['commercial', t('cl.comPl'), count('commercial')], ['low', t('cl.lowMargin'), lowCount]] as const).map(([id, label, n]) => (
            <button key={id} type="button" aria-pressed={f === id} onClick={() => setF(id)}><b>{n}</b><span>{label}</span></button>
          ))}
        </div>
        <div className="k-card" style={{ padding: '2px 12px', gap: 0 }}>
          {!clients ? [0, 1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 52, margin: '12px 0' }} />) : list.length === 0 ? (
            clients.length === 0
              ? <div style={{ padding: '20px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center' }}><span className="k-empty-t">{t('cl.emptyT')}</span><span className="k-empty-s">{t('cl.emptyS')}</span><Link to="/app/clientes/novo" className="k-btn k-btn-fill" style={{ minHeight: 44 }}>{t('cl.new')}</Link></div>
              : <span style={{ display: 'block', padding: '20px 0', textAlign: 'center', fontSize: 13.5, color: C.muted }}>{t('cl.none')}</span>
          ) : list.map((c, i) => {
            const m = margin(c.id);
            return (
              <button key={c.id} onClick={() => setSel(c)} style={{ width: '100%', textAlign: 'left', display: 'flex', gap: 12, alignItems: 'center', padding: '12px 0', border: 0, borderTop: i ? `1px solid ${C.soft}` : 0, background: 'transparent', cursor: 'pointer', color: C.ink, fontFamily: 'inherit' }}>
                <span className="k-avatar" style={{ width: 42, height: 42, borderRadius: 12, background: avatarColor(c), fontSize: 13 }}>{initials(c.name)}</span>
                <span style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}><span className="k-ell" style={{ fontWeight: 800, fontSize: 14.5 }}>{c.name}</span><span className="k-tag" style={{ fontWeight: 800, padding: '0 5px' }}>{c.kind === 'commercial' ? t('home.tagCom') : t('home.tagRes')}</span></span>
                  <span className="k-ell" style={{ fontSize: 12.5, color: C.muted }}>{nextLine(c)}</span>
                </span>
                <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flex: 'none' }}>
                  <span className="num" style={{ fontSize: 13, fontWeight: 800, color: m == null ? C.muted : m < 0.25 ? '#B8400C' : '#0B6B5F' }}>{m == null ? '–' : `${Math.round(m * 100)}%`}</span>
                  <span style={{ fontSize: 11, color: C.muted }}>{t('cl.margin')}</span>
                </span>
              </button>
            );
          })}
        </div>
      </main>
      <OwnerBar />
      {leads && <LeadsSheet onClose={() => { setLeads(false); if (params.get('pedidos')) { const p = new URLSearchParams(params); p.delete('pedidos'); setParams(p, { replace: true }); } }} onChanged={reloadLeads} />}
      {sel && <ClientSheet client={sel} color={avatarColor(sel)} profit={profit.get(sel.id)} onClose={() => setSel(null)} onChanged={() => { setSel(null); load(); }} />}
      {imp && <ImportSheet onClose={() => setImp(false)} onDone={() => { setImp(false); load(); }} />}
    </div>
  );
}

type Visit = { id: string; scheduled_start: string; started_at: string | null; completed_at: string | null; status: string; rating: number | null; rating_status: string; contract_id: string | null; services: { name: string } | null; job_assignments: { membership_id: string }[] };

export function ClientSheet({ client, color, profit, onClose, onChanged }: { client: Client; color: string; profit?: Profit; onClose: () => void; onChanged: () => void }) {
  const { t, tErr, lang, company, toast } = useApp();
  const nav = useNavigate();
  const pro = usePro();
  const [visits, setVisits] = useState<Visit[] | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [portalLink, setPortalLink] = useState('');
  const [askDel, setAskDel] = useState(false);
  const [hasGeo, setHasGeo] = useState(!!(client.properties[0]?.lat && client.properties[0]?.lng));
  const [reqs, setReqs] = useState<{ id: string; kind: string; body: string; status: string; created_at: string }[]>([]);
  const p = client.properties[0];
  useEffect(() => {
    supabase.from('client_requests').select('id, kind, body, status, created_at').eq('client_id', client.id).order('created_at', { ascending: false }).limit(10).then(({ data }) => setReqs((data || []) as typeof reqs));
  }, [client.id]);
  const setReqStatus = async (id: string, status: string) => {
    const { error } = await supabase.from('client_requests').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) toast(tErr(error.message)); else setReqs((l) => l.map((r) => (r.id === id ? { ...r, status } : r)));
  };
  useEffect(() => {
    supabase.from('jobs').select('id, scheduled_start, started_at, completed_at, status, rating, rating_status, contract_id, services(name), job_assignments(membership_id)')
      .eq('client_id', client.id).in('status', ['completed']).order('scheduled_start', { ascending: false }).limit(6)
      .then(({ data }) => setVisits((data || []) as unknown as Visit[]));
    if (company) getMembers(company.id).then(setMembers);
  }, [client.id, company]);
  const name = (id: string) => shortName(members.find((m) => m.id === id)?.display_name || '').split(' ')[0];
  const pl: [string, number, string][] = [
    [t('cl.revenue'), profit?.revenue_cents || 0, C.ink], [t('cl.labour'), profit?.labour_cents || 0, '#8A4B05'],
    [t('cl.supplies'), profit?.expense_cents || 0, '#8A4B05'], [t('cl.profitShort'), profit?.profit_cents || 0, (profit?.profit_cents || 0) < 0 || (profit && profit.revenue_cents > 0 && profit.profit_cents / profit.revenue_cents < 0.25) ? '#B8400C' : '#0B6B5F'],
  ];
  const notes: [string, string][] = [
    [t('day.access'), p?.access_instructions || ''],
    ...(client.kind === 'commercial'
      ? [[t('cl.scope'), [p?.square_feet ? `${p.square_feet.toLocaleString('en-US')} sq ft` : '', p?.bedrooms ? t('cl.roomsN', { n: p.bedrooms }) : '', p?.bathrooms ? t('cl.bathsN', { n: Number(p.bathrooms) }) : ''].filter(Boolean).join(' · ')] as [string, string]]
      : [[t('cl.pets'), p?.pets || t('cl.none2')] as [string, string]]),
    [client.kind === 'commercial' ? t('cl.attention') : t('cl.requests'), p?.special_instructions || ''],
    [t('cl.notes'), client.notes || ''],
  ].filter(([, v]) => v) as [string, string][];

  const invitePortal = async () => {
    const token = randomToken();
    const { error } = await supabase.from('clients').update({ portal_invite_hash: await sha256Hex(token), portal_invite_expires_at: addDays(new Date(), 7).toISOString() }).eq('id', client.id);
    if (error) { toast(tErr(error.message)); return; }
    setPortalLink(`${window.location.origin}/portal/convite?t=${token}`);
  };
  const message = async () => {
    if (client.portal_user_id && company) {
      const { data, error } = await supabase.rpc('open_conversation', { p_company: company.id, p_with: client.portal_user_id });
      if (error) toast(tErr(error.message)); else nav(`/mensagens/${data}`);
    } else if (client.phone) window.open(`https://wa.me/${client.phone.replace(/\D/g, '')}`, '_blank');
    else toast(t('cl.noContact'));
  };
  const setGeo = () => {
    if (!p || !navigator.geolocation) { toast(t('geo.denied')); return; }
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { error } = await supabase.from('properties').update({ lat: pos.coords.latitude, lng: pos.coords.longitude }).eq('id', p.id);
      if (error) toast(tErr(error.message)); else { setHasGeo(true); toast(t('geo.saved')); }
    }, () => toast(t('geo.denied')), { enableHighAccuracy: true, timeout: 10000 });
  };
  const shareText = t('pt.waText', { company: company?.name || '', link: portalLink });

  return (
    <Sheet title={client.name} onClose={onClose}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: -8 }}>
        <span className="k-avatar" style={{ width: 48, height: 48, borderRadius: 14, background: color, fontSize: 15 }}>{initials(client.name)}</span>
        <span className="k-s125 k-muted" style={{ flex: 1, minWidth: 0 }}>{p ? `${p.address_line1}, ${p.city}` : ''} · {client.no_translate ? t('cl.noTranslateShort') : LANG_LABEL[client.language as Lang]}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
        <Link to={`/app/agenda/novo?client=${client.id}`} className="k-btn k-btn-fill" style={{ minHeight: 46, borderRadius: 13, fontSize: 13 }}>{t('cl.schedule')}</Link>
        <Link to={`/app/cobrancas?nova=${client.id}`} className="k-btn k-btn-line" style={{ minHeight: 46, borderRadius: 13, fontSize: 13 }}>{t('cl.charge')}</Link>
        <button className="k-btn k-btn-line" style={{ minHeight: 46, borderRadius: 13, fontSize: 13 }} onClick={message}>{t('job.message')}</button>
      </div>
      <div style={{ background: C.bg, borderRadius: 16, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span className="k-sec"><span>{t('cl.profit90')}</span></span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 6 }}>
          {pl.map(([k, v, c]) => (
            <span key={k} style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
              <span className="k-ell" style={{ fontSize: 11, color: C.muted, fontWeight: 700 }}>{k}</span>
              <span className="num nw" style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 17, fontWeight: 700, color: c }}>{usd(v)}</span>
            </span>
          ))}
        </div>
      </div>
      {notes.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className="k-sec"><span>{t('cl.propNotes')}</span></span>
          {notes.map(([k, v]) => <div key={k} style={{ display: 'flex', gap: 10, fontSize: 13.5, lineHeight: 1.45 }}><span style={{ width: 92, flex: 'none', color: C.muted, fontWeight: 700 }}>{k}</span><span style={{ fontWeight: 600 }}>{v}</span></div>)}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span className="k-sec"><span>{t('cl.history')}</span></span>
        <div style={{ border: `1px solid ${C.line}`, borderRadius: 14, padding: '0 12px' }}>
          {!visits ? <div className="skeleton" style={{ height: 40, margin: '8px 0' }} /> : visits.length === 0 ? <span style={{ display: 'block', padding: '14px 0', fontSize: 13, color: C.muted }}>{t('cl.noHistory')}</span> : visits.map((v, i) => {
            const mins = v.started_at && v.completed_at ? Math.round((new Date(v.completed_at).getTime() - new Date(v.started_at).getTime()) / 60000) : null;
            const who = v.job_assignments.map((a) => name(a.membership_id)).filter(Boolean).join(` ${t('c.and')} `);
            const info = [v.services?.name || (v.contract_id ? t('job.recContract') : ''), who, mins ? `${Math.floor(mins / 60)}h${String(mins % 60).padStart(2, '0')}` : ''].filter(Boolean).join(' · ');
            const rated = v.rating != null;
            return (
              <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 50, borderTop: i ? `1px solid ${C.soft}` : 0 }}>
                <span style={{ fontWeight: 800, fontSize: 13, width: 64, flex: 'none' }}>{new Date(v.scheduled_start).toLocaleDateString(lang, { day: 'numeric', month: 'short' }).replace('.', '')}</span>
                <span className="k-ell" style={{ fontSize: 13, color: C.muted, flex: 1 }}>{info}</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: !rated ? C.muted : v.rating! < 4.5 ? '#8A4B05' : '#0B6B5F' }}>{rated ? `★ ${v.rating!.toLocaleString(lang, { minimumFractionDigits: 1 })}` : v.rating_status === 'auto_approved' ? t('cl.approved') : t('cl.waiting')}</span>
              </div>
            );
          })}
        </div>
      </div>

      {reqs.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className="k-sec"><span>{t('po.requests')}</span></span>
          <div style={{ background: '#FFFFFF', border: `1px solid ${C.line}`, borderRadius: 16, padding: '0 12px' }}>
            {reqs.map((r, i) => (
              <div key={r.id} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 0', borderTop: i ? `1px solid ${C.soft}` : 0 }}>
                <span style={{ fontSize: 13.5, fontWeight: 700 }}>{t(`po.rk.${r.kind}`)}: <span style={{ fontWeight: 500 }}>{r.body}</span></span>
                <div className="k-chips">
                  {(['sent', 'scheduled', 'done', 'declined'] as const).map((st) => <button key={st} className="k-chip light" aria-pressed={r.status === st} onClick={() => setReqStatus(r.id, st)} style={{ minHeight: 32, fontSize: 12 }}>{t(`po.rs.${st}`)}</button>)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span className="k-sec"><span>{t('cl.portal')}</span></span>
        {client.portal_user_id ? <span className="k-okbar" style={{ minHeight: 44 }}>{t('pt.connected')}</span> : !pro ? <ProNote text={t('pro.portal')} /> : !portalLink ? (
          <button className="k-btn k-btn-line" onClick={invitePortal}>{t('pt.invite')}</button>
        ) : (
          <>
            <span className="k-help" style={{ wordBreak: 'break-all' }}>{portalLink}</span>
            <div className="k-pair">
              {client.phone && <a className="k-btn k-btn-fill" target="_blank" rel="noreferrer" href={`https://wa.me/${client.phone.replace(/\D/g, '')}?text=${encodeURIComponent(shareText)}`}>WhatsApp</a>}
              {client.email ? <a className="k-btn k-btn-line" href={`mailto:${client.email}?subject=${encodeURIComponent(company?.name || 'Tidyo')}&body=${encodeURIComponent(shareText)}`}>Email</a>
                : <button className="k-btn k-btn-line" onClick={async () => { try { await navigator.clipboard.writeText(portalLink); toast(t('c.copied')); } catch { /* ignore */ } }}>{t('c.copy')}</button>}
            </div>
          </>
        )}
        {p && !hasGeo && <button className="k-btn k-btn-line" onClick={setGeo}><Svg d={I.pin} size={16} />{t('geo.set')}</button>}
        <div className="k-pair">
          <Link to={`/app/clientes/novo?edit=${client.id}`} className="k-btn k-btn-line">{t('cl.editShort')}</Link>
          <button className="k-btn k-btn-line" style={{ color: '#9F1F14' }} onClick={() => setAskDel(true)}>{t('cl.delete')}</button>
        </div>
      </div>
      {askDel && <Confirm danger text={t('cl.deleteAsk', { name: client.name })} confirmLabel={t('cl.delete')} onCancel={() => setAskDel(false)}
        onConfirm={async () => { setAskDel(false); try { await archiveClient(client.id); toast(t('cl.deleted', { name: client.name })); onChanged(); } catch (e) { toast(tErr((e as Error).message)); } }} />}
    </Sheet>
  );
}
