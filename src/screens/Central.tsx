// Central (canvas "Central"): notifications and messages in one place, plus a push notice to the team
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useApp } from '../lib/session';
import { Sheet } from '../components/ui';
import { C, Empty, HelperBar, Head, Svg, I, colorOf, hm, initials, shortName, usd } from '../components/kit';
import { guessGender } from '../lib/gender';
import type { Lang } from '../lib/i18n';

type Note = { id: string; kind: string; data: Record<string, unknown>; link: string | null; read_at: string | null; created_at: string };
type Conv = { id: string; company_id: string; other_user: string; other_name: string; last_message: string | null; last_message_at: string | null; unread: number };
type Contact = { user_id: string; name: string; kind: string; language: Lang };
type Cat = 'tidy' | 'equipe' | 'cliente' | 'tidyo';

const CAT: Record<string, Cat> = {
  tidy_daily: 'tidy', job_issue: 'equipe', expense_pending: 'equipe', job_completed: 'equipe', job_assigned: 'equipe', route_ready: 'equipe', join_request: 'equipe',
  job_rated: 'cliente', message: 'cliente', broadcast: 'tidyo', support_reply: 'tidyo', join_approved: 'tidyo',
};
const ICON: Record<Cat, [string, string, string]> = { tidy: ['T', C.ink, '#5FD4C1'], equipe: ['EQ', '#DDF1EC', '#0B6B5F'], cliente: ['CL', '#E8E4F8', '#4B3BA8'], tidyo: ['t', C.accent, '#FFFFFF'] };
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0);
const pickLang = (d: Record<string, unknown>, lang: Lang, f: string) => {
  const o = d as Record<string, Record<string, string> | undefined>;
  return o[lang]?.[f] || o.en?.[f] || o['pt-BR']?.[f] || '';
};

export function useWhen() {
  const { t, lang } = useApp();
  return (iso: string) => {
    const d = new Date(iso), today = new Date(); today.setHours(0, 0, 0, 0);
    const diff = Math.floor((today.getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 864e5);
    if (diff <= 0) return hm(d, lang);
    if (diff === 1) return t('ce.yesterday');
    if (diff < 7) { const w = d.toLocaleDateString(lang, { weekday: 'short' }).replace('.', ''); return w.charAt(0).toUpperCase() + w.slice(1); }
    return d.toLocaleDateString(lang, { day: 'numeric', month: 'short' }).replace('.', '');
  };
}

export default function Central() {
  const { t, tg, lang, isStaff, membership, portal, toast, tErr } = useApp();
  const nav = useNavigate();
  const { pathname } = useLocation();
  const when = useWhen();
  const tab: 'notif' | 'msg' = pathname.startsWith('/mensagens') ? 'msg' : 'notif';
  const helperView = !isStaff && !!membership;
  const companyId = membership?.company_id || portal?.company_id || '';
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [convs, setConvs] = useState<Conv[] | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filter, setFilter] = useState<'all' | Cat>('all');
  const [group, setGroup] = useState<'all' | 'equipe' | 'cliente'>('all');
  const [q, setQ] = useState('');
  const [bc, setBc] = useState(false);
  const [pick, setPick] = useState(false);

  const loadNotes = useCallback(() => {
    supabase.from('notifications').select('id, kind, data, link, read_at, created_at').order('created_at', { ascending: false }).limit(60).then(({ data }) => setNotes((data || []) as Note[]));
  }, []);
  const loadConvs = useCallback(() => { supabase.rpc('my_conversations').then(({ data }) => setConvs((data || []) as Conv[])); }, []);
  useEffect(() => { loadNotes(); loadConvs(); const i = window.setInterval(loadConvs, 20000); return () => window.clearInterval(i); }, [loadNotes, loadConvs]);
  useEffect(() => { if (companyId) supabase.rpc('chat_contacts', { p_company: companyId }).then(({ data }) => setContacts((data || []) as Contact[])); }, [companyId]);

  const kindOf = useMemo(() => Object.fromEntries(contacts.map((c) => [c.user_id, c.kind])), [contacts]);
  const unread = (notes || []).filter((n) => !n.read_at).length;
  const unreadMsgs = (convs || []).reduce((s, c) => s + Number(c.unread || 0), 0);

  const text = (n: Note): { title: string; body: string } => {
    const d = n.data || {}, s = (k: string) => String(d[k] ?? '');
    switch (n.kind) {
      case 'job_issue': return { title: t('nt.job_issue', { who: s('who'), client: s('client') }), body: s('text') };
      case 'expense_pending': return { title: t('nt.expense_pending', { who: s('who'), amount: usd(Number(d.amount_cents || 0), true) }), body: d.category ? t(`expc.${s('category')}`) : '' };
      case 'job_completed': return { title: t('nt.job_completed', { client: s('client') }), body: '' };
      case 'job_rated': return { title: t('nt.job_rated', { client: s('client'), n: s('rating') }), body: d.comment ? `“${s('comment')}”` : '' };
      case 'job_assigned': return { title: t('nt.job_assigned', { client: s('client'), when: d.start ? new Date(s('start')).toLocaleString(lang, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '' }), body: '' };
      case 'route_ready': return { title: t('ce.routeReady'), body: t('ce.routeReadyD', { n: s('stops'), date: d.date ? new Date(s('date') + 'T12:00').toLocaleDateString(lang, { weekday: 'long', day: 'numeric', month: 'long' }) : '' }) };
      case 'join_request': return { title: t('ce.joinRequest', { who: s('who') }), body: t('ce.joinRequestD') };
      case 'join_approved': return { title: t('ce.joinApproved'), body: '' };
      case 'support_reply': return { title: t('nt.support_reply'), body: '' };
      case 'message': return { title: t('nt.message', { who: s('who') }), body: '' };
      case 'tidy_daily': return { title: t('nt.tidy_daily', { total: s('total') }), body: '' };
      case 'broadcast': return { title: pickLang(d, lang, 'title'), body: pickLang(d, lang, 'body') };
      default: return { title: n.kind, body: '' };
    }
  };

  const markAll = async () => { await supabase.rpc('mark_notifications_read'); setNotes((l) => l && l.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() }))); };
  const openNote = (n: Note) => {
    if (!n.read_at) supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', n.id).then(() => undefined);
    if (n.link) nav(n.link); else setNotes((l) => l && l.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
  };

  const shownNotes = (notes || []).filter((n) => filter === 'all' || (CAT[n.kind] || 'tidyo') === filter);
  const shownConvs = (convs || []).filter((c) => (group === 'all' || (kindOf[c.other_user] === 'client' ? 'cliente' : 'equipe') === group) && (!q.trim() || c.other_name.toLowerCase().includes(q.trim().toLowerCase())));
  const roleLabel = (uid: string, name: string) => { const k = kindOf[uid]; return k === 'client' ? t('job.client') : k ? tg(`team.${k}`, guessGender(name)) : ''; };
  const setTab = (v: 'notif' | 'msg') => nav(v === 'msg' ? '/mensagens' : '/avisos', { replace: true });
  const back = () => (window.history.length > 1 ? nav(-1) : nav(isStaff ? '/app' : membership ? '/dia' : '/portal'));

  return (
    <div className="k-screen">
      <main className={`k-page${helperView ? '' : ' nobar'}`} style={{ gap: 14 }}>
        <Head back={helperView && tab === 'msg' ? undefined : back} title={t('ce.title')}
          right={tab === 'notif'
            ? (unread > 0 ? <button className="k-btn k-btn-line" style={{ minHeight: 40, padding: '0 12px', fontSize: 12.5, flex: 'none', whiteSpace: 'nowrap' }} onClick={markAll}>{t('ce.markAll')}</button> : undefined)
            : <button className="k-btn k-btn-line" style={{ minHeight: 40, padding: '0 12px', fontSize: 12.5, flex: 'none', whiteSpace: 'nowrap', gap: 4 }} onClick={() => setPick(true)}><Svg d={I.plus} size={16} />{t('ce.new')}</button>} />

        <div role="tablist" aria-label={t('ce.sections')} className="k-seg" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
          {([['notif', t('ce.notifs'), unread, '#D9480F'], ['msg', t('ce.msgs'), unreadMsgs, C.accent]] as const).map(([id, label, n, bg]) => (
            <button key={id} role="tab" aria-selected={tab === id} aria-pressed={tab === id} onClick={() => setTab(id)} style={{ whiteSpace: 'nowrap' }}>
              {label}{n > 0 && <span className="num" style={{ fontSize: 11, background: bg, color: '#FFFFFF', borderRadius: 999, padding: '1px 7px', marginLeft: 6 }}>{n > 99 ? '99+' : n}</span>}
            </button>
          ))}
        </div>

        {tab === 'notif' ? (
          <>
            <div className="k-chips" style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
              {([['all', t('inv.all')], ['tidy', 'Tidy'], ['equipe', t('ce.team')], ['cliente', t('nav.clients')], ['tidyo', 'Tidyo']] as const).filter(([id]) => isStaff || id === 'all' || id === 'tidyo' || id === 'equipe').map(([id, label]) => (
                <button key={id} className="k-chip dark" aria-pressed={filter === id} onClick={() => setFilter(id)} style={{ flex: 'none', minHeight: 36 }}>{label}</button>
              ))}
            </div>
            {!notes ? <ListSkeleton /> : shownNotes.length === 0 ? <Empty title={t('nt.none')} /> : (
              <div style={{ background: '#FFFFFF', border: `1px solid ${C.line}`, borderRadius: 18, padding: '2px 12px' }}>
                {shownNotes.map((n, i) => {
                  const [ic, bg, fg] = ICON[CAT[n.kind] || 'tidyo'];
                  const { title, body } = text(n);
                  return (
                    <button key={n.id} onClick={() => openNote(n)} style={{ display: 'flex', gap: 12, padding: '12px 0', width: '100%', border: 0, borderTop: i ? '1px solid #EEF2F1' : 0, background: 'none', textAlign: 'left', cursor: n.link ? 'pointer' : 'default', fontFamily: 'inherit', color: C.ink }}>
                      <span style={{ width: 38, height: 38, flex: 'none', borderRadius: 12, background: bg, color: fg, fontWeight: 800, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{ic}</span>
                      <span style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                          <span style={{ fontWeight: n.read_at ? 600 : 800, fontSize: 14, lineHeight: 1.35, flex: 1, minWidth: 0 }}>{title}</span>
                          <span className="nw" style={{ fontSize: 11.5, color: C.muted, flex: 'none' }}>{when(n.created_at)}</span>
                        </span>
                        {body && <span style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.45 }}>{body}</span>}
                      </span>
                      {!n.read_at && <span aria-label={t('nt.new')} style={{ width: 8, height: 8, borderRadius: 8, background: '#D9480F', flex: 'none', marginTop: 6 }} />}
                    </button>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <>
            <label style={{ position: 'relative', display: 'block' }}>
              <span className="sr-only">{t('ce.search')}</span>
              <input className="k-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={isStaff ? t('ce.searchPh') : t('ce.search')} style={{ minHeight: 46 }} />
            </label>
            {isStaff && (
              <div className="k-chips" style={{ display: 'flex', gap: 6 }}>
                {([['all', t('inv.all')], ['equipe', t('ce.team')], ['cliente', t('nav.clients')]] as const).map(([id, label]) => (
                  <button key={id} className="k-chip dark" aria-pressed={group === id} onClick={() => setGroup(id)} style={{ minHeight: 36 }}>{label}</button>
                ))}
              </div>
            )}
            {!convs ? <ListSkeleton /> : shownConvs.length === 0 ? <Empty title={convs.length ? t('ce.noMatch') : t('ch.none')} text={convs.length ? undefined : t('ce.noneText')} /> : (
              <div style={{ background: '#FFFFFF', border: `1px solid ${C.line}`, borderRadius: 18, padding: '2px 12px' }}>
                {shownConvs.map((c, i) => {
                  const client = kindOf[c.other_user] === 'client';
                  const role = roleLabel(c.other_user, c.other_name);
                  return (
                    <button key={c.id} onClick={() => nav(`/mensagens/${c.id}`)} style={{ display: 'flex', gap: 12, padding: '12px 0', width: '100%', border: 0, borderTop: i ? '1px solid #EEF2F1' : 0, background: 'none', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', color: C.ink, alignItems: 'center' }}>
                      <span style={{ width: 42, height: 42, flex: 'none', borderRadius: 42, background: client ? '#4B3BA8' : colorOf(Math.abs(hash(c.other_user)))[0], color: '#FFFFFF', fontWeight: 800, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{initials(c.other_name)}</span>
                      <span style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                          <span style={{ fontWeight: 800, fontSize: 14, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{client ? c.other_name : shortName(c.other_name)}</span>
                          {c.last_message_at && <span className="nw" style={{ fontSize: 11.5, color: C.muted }}>{when(c.last_message_at)}</span>}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {role && <span className="nw" style={{ fontSize: 10.5, fontWeight: 800, color: C.muted, border: `1px solid ${C.line}`, borderRadius: 6, padding: '0 5px', flex: 'none' }}>{role}</span>}
                          <span style={{ fontSize: 12.5, color: C.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>{c.last_message || t('ch.start')}</span>
                          {Number(c.unread) > 0 && <span className="num" style={{ fontSize: 11, fontWeight: 800, background: C.accent, color: '#FFFFFF', borderRadius: 999, minWidth: 20, textAlign: 'center', padding: '1px 6px', boxSizing: 'border-box' }}>{c.unread}</span>}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            {isStaff && <button className="k-btn k-btn-fill k-btn-big" onClick={() => setBc(true)}>{t('ce.broadcast')}</button>}
          </>
        )}
      </main>
      {helperView && <HelperBar />}
      {bc && <BroadcastSheet contacts={contacts} companyId={companyId} onClose={() => setBc(false)} onSent={() => { setBc(false); loadConvs(); }} />}
      {pick && (
        <Sheet title={t('ch.new')} onClose={() => setPick(false)}>
          {contacts.length === 0 ? <span style={{ color: C.muted, fontSize: 14 }}>{t('ch.noContacts')}</span> : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {contacts.map((c, i) => (
                <button key={c.user_id} onClick={async () => {
                  const { data, error } = await supabase.rpc('open_conversation', { p_company: companyId, p_with: c.user_id });
                  if (error) toast(tErr(error.message)); else nav(`/mensagens/${data}`);
                }} style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 56, border: 0, borderTop: i ? '1px solid #EEF2F1' : 0, background: 'none', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', color: C.ink, padding: 0 }}>
                  <span style={{ width: 36, height: 36, flex: 'none', borderRadius: 36, background: c.kind === 'client' ? '#4B3BA8' : colorOf(Math.abs(hash(c.user_id)))[0], color: '#FFFFFF', fontWeight: 800, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{initials(c.name)}</span>
                  <span style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                    <span style={{ fontWeight: 800, fontSize: 14 }}>{c.name}</span>
                    <span style={{ fontSize: 12, color: C.muted }}>{c.kind === 'client' ? t('job.client') : tg(`team.${c.kind}`, guessGender(c.name))}</span>
                  </span>
                  <Svg d={I.chev} size={18} color={C.muted} />
                </button>
              ))}
            </div>
          )}
        </Sheet>
      )}
    </div>
  );
}

function ListSkeleton() {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} aria-busy="true">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 64, borderRadius: 16 }} />)}</div>;
}

/** Push notice: sent as a chat message to each person, so it arrives translated into their language */
function BroadcastSheet({ contacts, companyId, onClose, onSent }: { contacts: Contact[]; companyId: string; onClose: () => void; onSent: () => void }) {
  const { t, lang, session, toast, tErr } = useApp();
  const team = contacts.filter((c) => c.kind !== 'client');
  const clients = contacts.filter((c) => c.kind === 'client');
  const [aud, setAud] = useState<string>('team');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const targets = aud === 'team' ? team : aud === 'clients' ? clients : contacts.filter((c) => c.user_id === aud);
  const send = async () => {
    if (!session || !body.trim() || !targets.length) return;
    setBusy(true);
    let fail = 0;
    for (const c of targets) {
      const { data, error } = await supabase.rpc('open_conversation', { p_company: companyId, p_with: c.user_id });
      if (error) { fail++; continue; }
      const { error: e2 } = await supabase.from('messages').insert({ conversation_id: data, company_id: companyId, sender_id: session.user.id, body: body.trim(), body_language: lang });
      if (e2) fail++;
    }
    setBusy(false);
    if (fail === targets.length) { toast(tErr('')); return; }
    toast(t('ce.sent', { n: targets.length - fail }));
    onSent();
  };
  const opts: [string, string][] = [['team', t('ce.allTeam')], ...team.slice(0, 6).map((c) => [c.user_id, t('ce.only', { name: c.name.split(' ')[0] })] as [string, string]), ...(clients.length ? [['clients', t('ce.allClients')] as [string, string]] : [])];
  return (
    <Sheet title={t('ce.bcTitle')} onClose={onClose}>
      <span style={{ fontSize: 13.5, color: C.muted, marginTop: -4 }}>{t('ce.bcText')}</span>
      <div className="k-chips wrap" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-start', alignSelf: 'stretch' }}>
        {opts.map(([id, label]) => <button key={id} className="k-chip dark" aria-pressed={aud === id} onClick={() => setAud(id)} style={{ minHeight: 38 }}>{label}</button>)}
      </div>
      <label className="k-field"><span>{t('hp.message')}</span>
        <textarea className="k-input" rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder={t('ce.bcPh')} style={{ minHeight: 92, resize: 'none', background: '#F4F7F6' }} />
      </label>
      <div className="k-pair">
        <button className="k-btn k-btn-line" onClick={onClose}>{t('c.cancel')}</button>
        <button className="k-btn k-btn-fill" disabled={busy || !body.trim() || !targets.length} onClick={send}>{t('ce.sendNow')}</button>
      </div>
    </Sheet>
  );
}
