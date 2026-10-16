// Ajuda (canvas "Ajuda"): search the articles, write to support with a screenshot, follow your tickets
import { useCallback, useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useApp } from '../lib/session';
import { Sheet } from '../components/ui';
import { C, Head, I, Svg } from '../components/kit';
import { compressImage } from '../lib/photos';

type Ticket = { id: string; number: number | null; subject: string; status: 'open' | 'waiting_customer' | 'resolved'; updated_at: string };
type Msg = { id: string; body: string; from_staff: boolean; attachment_path: string | null; created_at: string };
type Topic = 'billing' | 'technical' | 'idea' | 'other';

/** Articles: [key, link, staff only] */
const ARTICLES: [string, string | null, boolean][] = [
  ['invite', '/app/mais/equipe', true], ['charge', '/app/cobrancas', true], ['plan', '/app/conta', true], ['route', '/app/rotas', true],
  ['photos', null, false], ['portal', '/app/clientes', true], ['offline', null, false], ['translate', null, false], ['prices', '/app/mais/precos', true],
];
const ST: Record<Ticket['status'], [string, string]> = { open: ['#FDF0DC', '#8A4B05'], waiting_customer: ['#DDF1EC', '#0B6B5F'], resolved: ['#EEF1F0', '#3E4F4C'] };
export const ticketNo = (n: number | null) => (n ? `TDY-${n}` : '');

export default function Help() {
  const { t, lang, isStaff, membership, session, profile, toast, tErr } = useApp();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [art, setArt] = useState<string | null>(null);
  const [topic, setTopic] = useState<Topic>('technical');
  const [msg, setMsg] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<number | null | undefined>(undefined);
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [view, setView] = useState<Ticket | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    const { data } = await supabase.from('support_tickets').select('id, number, subject, status, updated_at').eq('opened_by', session.user.id).order('updated_at', { ascending: false });
    setTickets((data || []) as Ticket[]);
  }, [session]);
  useEffect(() => { load(); }, [load]);

  const name = (profile?.full_name || membership?.display_name || '').split(' ')[0];
  const list = ARTICLES.filter(([, , staff]) => isStaff || !staff);
  const found = q.trim() ? list.filter(([k]) => `${t(`ha.${k}.q`)} ${t(`ha.${k}.a`)}`.toLowerCase().includes(q.trim().toLowerCase())) : list.slice(0, 4);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!session) return;
    if (!msg.trim()) { setErr(true); return; }
    setBusy(true);
    try {
      let path: string | null = null;
      if (file) {
        path = `${session.user.id}/${crypto.randomUUID()}.jpg`;
        const { error } = await supabase.storage.from('support-files').upload(path, await compressImage(file, 1800), { contentType: 'image/jpeg' });
        if (error) throw error;
      }
      const subject = msg.trim().split('\n')[0].slice(0, 80);
      const { data, error } = await supabase.from('support_tickets').insert({ company_id: membership?.company_id || null, opened_by: session.user.id, subject, language: lang, topic }).select('id, number').single();
      if (error) throw error;
      const { error: e2 } = await supabase.from('support_messages').insert({ ticket_id: data.id, sender_id: session.user.id, body: msg.trim(), from_staff: false, attachment_path: path });
      if (e2) throw e2;
      setSent(data.number as number | null); setMsg(''); setFile(null); load();
    } catch (x) { toast(tErr((x as Error).message)); }
    setBusy(false);
  };

  const topics: [Topic, string][] = [['billing', t('hl.billing')], ['technical', t('hl.technical')], ['idea', t('hl.idea')], ['other', t('hl.other')]];
  const back = () => (window.history.length > 1 ? nav(-1) : nav(isStaff ? '/app/mais' : membership ? '/dia/perfil' : '/portal'));
  const a = art ? ARTICLES.find(([k]) => k === art) : null;

  return (
    <div className="k-screen">
      <main className="k-page nobar" style={{ gap: 16 }}>
        <Head back={back} title={t('hl.title')} />
        <label style={{ display: 'block' }}>
          <span style={{ display: 'block', fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 24, fontWeight: 700, lineHeight: 1.2, marginBottom: 12, textWrap: 'balance' } as CSSProperties}>{name ? t('hl.hello', { name }) : t('hl.helloAnon')}</span>
          <input className="k-input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('hl.searchPh')} style={{ minHeight: 48 }} />
        </label>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className="k-lbl" style={{ fontSize: 12, fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{q.trim() ? t('hl.results') : t('hl.top')}</span>
          {found.length === 0 ? <span style={{ fontSize: 13.5, color: C.muted }}>{t('hl.noResults')}</span> : (
            <div style={{ background: '#FFFFFF', border: `1px solid ${C.line}`, borderRadius: 18, padding: '0 14px' }}>
              {found.map(([k], i) => (
                <button key={k} onClick={() => setArt(k)} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 52, width: '100%', border: 0, borderTop: i ? '1px solid #EEF2F1' : 0, background: 'none', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', color: C.ink, padding: '8px 0' }}>
                  <span style={{ fontWeight: 700, fontSize: 14, flex: 1 }}>{t(`ha.${k}.q`)}</span>
                  <Svg d={I.chev} size={16} color={C.muted} />
                </button>
              ))}
            </div>
          )}
        </div>

        <form onSubmit={submit} style={{ background: C.ink, color: '#EAF3F1', borderRadius: 20, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 18, fontWeight: 700 }}>{t('hl.talk')}</span>
            <span style={{ fontSize: 12.5, color: '#9DB5B0' }}>{t('hl.hours')}</span>
          </div>
          {sent !== undefined ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ width: 38, height: 38, borderRadius: 38, background: '#5FD4C1', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><Svg d={I.check} size={18} color={C.ink} w={2.6} /></span>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: 800, fontSize: 15 }}>{t('hl.opened', { n: ticketNo(sent ?? null) })}</span>
                  <span style={{ fontSize: 12.5, color: '#9DB5B0' }}>{t('hl.openedText')}</span>
                </div>
              </div>
              <button type="button" onClick={() => setSent(undefined)} style={{ alignSelf: 'flex-start', minHeight: 40, padding: '0 14px', borderRadius: 12, border: '1px solid #3B5654', background: 'transparent', color: '#EAF3F1', fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>{t('hl.another')}</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span style={{ fontSize: 12.5, fontWeight: 800 }}>{t('hp.subject')}</span>
              <div role="group" aria-label={t('hp.subject')} style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {topics.map(([id, label]) => {
                  const on = topic === id;
                  return <button key={id} type="button" aria-pressed={on} onClick={() => setTopic(id)} style={{ minHeight: 38, padding: '0 12px', borderRadius: 999, border: `1px solid ${on ? '#5FD4C1' : '#3B5654'}`, background: on ? '#5FD4C1' : 'transparent', color: on ? C.ink : '#EAF3F1', fontWeight: 800, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>{label}</button>;
                })}
              </div>
              <label htmlFor="help-msg" style={{ fontSize: 12.5, fontWeight: 800 }}>{t('hp.message')}</label>
              <textarea id="help-msg" rows={4} value={msg} onChange={(e) => { setMsg(e.target.value); setErr(false); }} placeholder={t('hl.msgPh')}
                style={{ width: '100%', boxSizing: 'border-box', borderRadius: 14, border: '1px solid #3B5654', background: '#17302C', padding: 12, fontFamily: 'inherit', fontSize: 15, color: '#EAF3F1', resize: 'none' }} />
              {file && <span style={{ fontSize: 12.5, color: '#9DB5B0', display: 'flex', alignItems: 'center', gap: 8 }}>📎 <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{file.name}</span><button type="button" onClick={() => setFile(null)} style={{ background: 'none', border: 0, color: '#5FD4C1', fontWeight: 800, cursor: 'pointer', minHeight: 32, fontFamily: 'inherit' }}>{t('c.remove')}</button></span>}
              <div style={{ display: 'flex', gap: 8 }}>
                <label style={{ minHeight: 46, padding: '0 14px', borderRadius: 13, border: '1px solid #3B5654', background: 'transparent', color: '#EAF3F1', fontWeight: 800, fontSize: 13.5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', flex: 'none' }}>
                  <Svg d={I.clip} size={16} />{t('hl.attach')}
                  <input type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) setFile(f); }} />
                </label>
                <button type="submit" disabled={busy} style={{ flex: 1, minHeight: 46, borderRadius: 13, border: 0, background: '#5FD4C1', color: C.ink, fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', padding: '0 10px' }}>{t('hl.send')}</button>
              </div>
              {err && <span role="alert" style={{ fontSize: 12.5, fontWeight: 700, color: '#FFB59C' }}>{t('hl.needMsg')}</span>}
            </div>
          )}
        </form>

        {tickets && tickets.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('hl.mine')}</span>
            <div style={{ background: '#FFFFFF', border: `1px solid ${C.line}`, borderRadius: 18, padding: '0 14px' }}>
              {tickets.map((k, i) => (
                <button key={k.id} onClick={() => setView(k)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0', width: '100%', border: 0, borderTop: i ? '1px solid #EEF2F1' : 0, background: 'none', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', color: C.ink }}>
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
                    <span style={{ fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k.subject}</span>
                    <span style={{ fontSize: 12, color: C.muted }}>{[ticketNo(k.number), new Date(k.updated_at).toLocaleDateString(lang, { day: 'numeric', month: 'short' }).replace('.', '').replace(' de ', ' ')].filter(Boolean).join(' · ')}</span>
                  </span>
                  <span className="nw" style={{ fontSize: 11.5, fontWeight: 800, padding: '3px 9px', borderRadius: 999, background: ST[k.status][0], color: ST[k.status][1] }}>{t(`hp.st.${k.status}`)}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </main>

      {a && (
        <Sheet title={t(`ha.${a[0]}.q`)} onClose={() => setArt(null)}>
          <span style={{ fontSize: 14.5, lineHeight: 1.55, color: '#3E4F4C' }}>{t(`ha.${a[0]}.a`)}</span>
          {a[1] && isStaff && <Link className="k-btn k-btn-fill" to={a[1]}>{t('hl.goThere')}</Link>}
        </Sheet>
      )}
      {view && <TicketSheet ticket={view} onClose={() => { setView(null); load(); }} />}
    </div>
  );
}

/** One ticket: the conversation with the Tidyo team. Used by owners/helpers and by the super admin. */
export function TicketSheet({ ticket, onClose, asAdmin = false }: { ticket: { id: string; number?: number | null; subject: string; status: string }; onClose: () => void; asAdmin?: boolean }) {
  const { t, tErr, lang, session, toast } = useApp();
  const [msgs, setMsgs] = useState<Msg[] | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [body, setBody] = useState('');
  const load = useCallback(async () => {
    const { data } = await supabase.from('support_messages').select('id, body, from_staff, attachment_path, created_at').eq('ticket_id', ticket.id).order('created_at');
    const list = (data || []) as Msg[];
    setMsgs(list);
    const paths = list.map((m) => m.attachment_path).filter((p): p is string => !!p);
    if (paths.length) supabase.storage.from('support-files').createSignedUrls(paths, 3600).then(({ data: s }) => s && setUrls(Object.fromEntries(s.filter((x) => x.path && x.signedUrl).map((x) => [x.path!, x.signedUrl]))));
  }, [ticket.id]);
  useEffect(() => { load(); }, [load]);
  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!session || !body.trim()) return;
    const { error } = await supabase.from('support_messages').insert({ ticket_id: ticket.id, sender_id: session.user.id, body: body.trim(), from_staff: asAdmin });
    if (error) toast(tErr(error.message)); else { setBody(''); load(); }
  };
  const resolve = async () => {
    const { error } = await supabase.from('support_tickets').update({ status: 'resolved' }).eq('id', ticket.id);
    if (error) toast(tErr(error.message)); else { toast(t('c.saved')); onClose(); }
  };
  return (
    <Sheet title={ticket.subject} onClose={onClose}>
      {ticket.number ? <span style={{ fontSize: 12, fontWeight: 800, color: C.muted, marginTop: -6 }}>{ticketNo(ticket.number)}</span> : null}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {!msgs ? <div className="skeleton" style={{ height: 60, borderRadius: 14 }} /> : msgs.map((m) => {
          const mine = m.from_staff === asAdmin;
          return (
            <div key={m.id} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '85%', background: mine ? C.accent : '#F4F7F6', color: mine ? '#FFFFFF' : C.ink, borderRadius: mine ? '16px 16px 4px 16px' : '16px 16px 16px 4px', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 11, opacity: 0.8, fontWeight: 800 }}>{m.from_staff ? t('hp.team') : t('hp.you')} · {new Date(m.created_at).toLocaleString(lang, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span>
              <span style={{ whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.45, overflowWrap: 'anywhere' }}>{m.body}</span>
              {m.attachment_path && urls[m.attachment_path] && <a href={urls[m.attachment_path]} target="_blank" rel="noreferrer"><img src={urls[m.attachment_path]} alt={t('hl.attach')} style={{ width: '100%', maxWidth: 240, borderRadius: 10, display: 'block' }} /></a>}
            </div>
          );
        })}
      </div>
      {ticket.status !== 'resolved' || asAdmin ? (
        <form onSubmit={send} style={{ display: 'flex', gap: 8 }}>
          <input className="k-input" style={{ flex: 1, minWidth: 0 }} value={body} onChange={(e) => setBody(e.target.value)} placeholder={t('hp.message')} aria-label={t('hp.message')} />
          <button className="k-btn k-btn-fill" style={{ flex: 'none' }} disabled={!body.trim()}>{t('hp.send')}</button>
        </form>
      ) : null}
      {asAdmin && ticket.status !== 'resolved' && <button className="k-btn k-btn-line" onClick={resolve}>{t('hp.resolve')}</button>}
    </Sheet>
  );
}
