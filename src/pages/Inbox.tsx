import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useApp } from '../lib/session';
import { Field, Icon, LoadingList, Sheet } from '../components/ui';
import { money } from '../lib/format';
import type { Lang } from '../lib/i18n';

type Note = { id: string; kind: string; data: Record<string, any>; link: string | null; read_at: string | null; created_at: string };

export function useUnread() {
  const { session } = useApp();
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!session) return;
    let alive = true;
    const run = () => supabase.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null).then(({ count }) => { if (alive) setN(count || 0); });
    run();
    const i = window.setInterval(run, 60000);
    return () => { alive = false; window.clearInterval(i); };
  }, [session]);
  return n;
}

export function Bell() {
  const { t } = useApp();
  const n = useUnread();
  return (
    <Link to="/avisos" className="icon-btn" aria-label={`${t('nt.title')}${n ? ` · ${n}` : ''}`}>
      <Icon name="bell" size={20} />
      {n > 0 && <span className="count">{n > 9 ? '9+' : n}</span>}
    </Link>
  );
}

function pick(content: any, lang: Lang, field: string) {
  return content?.[lang]?.[field] || content?.en?.[field] || content?.['pt-BR']?.[field] || '';
}

export default function Inbox() {
  const { t, lang, isStaff } = useApp();
  const nav = useNavigate();
  const [list, setList] = useState<Note[] | null>(null);
  useEffect(() => {
    supabase.from('notifications').select('id, kind, data, link, read_at, created_at').order('created_at', { ascending: false }).limit(60)
      .then(({ data }) => { setList((data || []) as Note[]); supabase.rpc('mark_notifications_read').then(() => undefined); });
  }, []);
  const text = (n: Note) => {
    const d = n.data || {};
    switch (n.kind) {
      case 'job_issue': return t('nt.job_issue', { who: d.who || '', client: d.client || '' }) + (d.text ? ` — ${d.text}` : '');
      case 'expense_pending': return t('nt.expense_pending', { who: d.who || '', amount: money(d.amount_cents, lang) });
      case 'job_completed': return t('nt.job_completed', { client: d.client || '' });
      case 'job_rated': return t('nt.job_rated', { client: d.client || '', n: d.rating || '' }) + (d.comment ? ` — “${d.comment}”` : '');
      case 'job_assigned': return t('nt.job_assigned', { client: d.client || '', when: d.start ? new Date(d.start).toLocaleString(lang, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '' });
      case 'support_reply': return t('nt.support_reply');
      case 'tidy_daily': return t('nt.tidy_daily', { total: d.total || 0 });
      case 'broadcast': return `${pick(d, lang, 'title')}${pick(d, lang, 'body') ? ` — ${pick(d, lang, 'body')}` : ''}`;
      default: return n.kind;
    }
  };
  return (
    <div className="shell">
      <main className="page no-nav">
        <div className="topbar">
          <Link className="icon-btn" to={isStaff ? '/app' : '/'} aria-label={t('c.close')}><Icon name="chevL" size={18} /></Link>
          <h1 className="grow">{t('nt.title')}</h1>
        </div>
        {!list ? <LoadingList /> : list.length === 0 ? <div className="empty">{t('nt.none')}</div> : (
          <div className="list">
            {list.map((n) => (
              <button key={n.id} className="item" onClick={() => n.link && nav(n.link)} style={!n.read_at ? { borderColor: 'var(--action)' } : undefined}>
                {!n.read_at && <span style={{ width: 8, height: 8, borderRadius: 8, background: 'var(--action)', flex: 'none' }} aria-label={t('nt.new')} />}
                <span className="body">
                  <span style={{ fontWeight: 700 }}>{text(n)}</span>
                  <span className="small muted">{new Date(n.created_at).toLocaleString(lang, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

// ─────────────── Ajuda e suporte ───────────────
type Ticket = { id: string; subject: string; status: string; updated_at: string };
type Msg = { id: string; body: string; from_staff: boolean; created_at: string };

const FAQ = ['faq.invite', 'faq.photos', 'faq.portal', 'faq.offline', 'faq.export', 'faq.cancel'];

export function Help() {
  const { t, lang, isStaff, membership, session } = useApp();
  const [open, setOpen] = useState<number>(-1);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [create, setCreate] = useState(false);
  const [view, setView] = useState<Ticket | null>(null);
  const load = useCallback(async () => {
    if (!session) return;
    const { data } = await supabase.from('support_tickets').select('id, subject, status, updated_at').eq('opened_by', session.user.id).order('updated_at', { ascending: false });
    setTickets((data || []) as Ticket[]);
  }, [session]);
  useEffect(() => { load(); }, [load]);
  return (
    <div className="shell">
      <main className="page no-nav">
        <div className="topbar">
          <Link className="icon-btn" to={isStaff ? '/app/mais' : membership ? '/dia' : '/'} aria-label={t('c.close')}><Icon name="chevL" size={18} /></Link>
          <h1 className="grow">{t('more.help')}</h1>
        </div>
        <section className="card stack" style={{ background: 'var(--brand-dark)', color: '#EAF5F2', borderColor: 'var(--brand-dark)' }}>
          <h2 style={{ color: '#fff' }}>{t('hp.talk')}</h2>
          <span className="small" style={{ color: '#B9D6D0' }}>{t('more.helpText')}</span>
          <button className="btn" style={{ background: '#5FD4C1', color: '#0A3D35' }} onClick={() => setCreate(true)}>{t('hp.newTicket')}</button>
        </section>
        {tickets.length > 0 && (
          <section className="stack">
            <h2>{t('hp.myTickets')}</h2>
            {tickets.map((tk) => (
              <button key={tk.id} className="item" onClick={() => setView(tk)}>
                <span className="body"><span className="title">{tk.subject}</span><span className="small muted">{new Date(tk.updated_at).toLocaleDateString(lang, { day: 'numeric', month: 'short' })}</span></span>
                <span className={`badge ${tk.status === 'waiting_customer' ? 'b-warn' : tk.status === 'resolved' ? 'b-ok' : 'b-neutral'}`}>{t(`hp.st.${tk.status}`)}</span>
              </button>
            ))}
          </section>
        )}
        <section className="stack">
          <h2>{t('hp.faq')}</h2>
          {FAQ.map((k, i) => (
            <div key={k} className="card" style={{ padding: 0 }}>
              <button className="row" aria-expanded={open === i} onClick={() => setOpen(open === i ? -1 : i)} style={{ width: '100%', minHeight: 56, padding: '0 14px', border: 0, background: 'none', textAlign: 'left', cursor: 'pointer', fontWeight: 800 }}>
                <span className="grow">{t(`${k}.q`)}</span><Icon name={open === i ? 'chevL' : 'chevR'} size={16} />
              </button>
              {open === i && <p style={{ margin: 0, padding: '0 14px 14px' }} className="small">{t(`${k}.a`)}</p>}
            </div>
          ))}
        </section>
      </main>
      {create && <NewTicket onClose={() => setCreate(false)} onSaved={() => { setCreate(false); load(); }} />}
      {view && <TicketThread ticket={view} onClose={() => { setView(null); load(); }} />}
    </div>
  );
}

function NewTicket({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { t, tErr, lang, session, membership, toast } = useApp();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!session) return;
    setBusy(true);
    const { data, error } = await supabase.from('support_tickets').insert({ company_id: membership?.company_id || null, opened_by: session.user.id, subject, language: lang }).select('id').single();
    if (!error) await supabase.from('support_messages').insert({ ticket_id: data.id, sender_id: session.user.id, body, from_staff: false });
    setBusy(false);
    if (error) toast(tErr(error.message)); else { toast(t('hp.sent')); onSaved(); }
  };
  return (
    <Sheet title={t('hp.newTicket')} onClose={onClose}>
      <form className="stack" style={{ gap: 14 }} onSubmit={save}>
        <Field label={t('hp.subject')}><input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} required /></Field>
        <Field label={t('hp.message')}><textarea className="textarea" value={body} onChange={(e) => setBody(e.target.value)} required /></Field>
        <button className="btn btn-primary btn-block" disabled={busy || !subject.trim() || !body.trim()}>{t('c.confirm')}</button>
      </form>
    </Sheet>
  );
}

export function TicketThread({ ticket, onClose, asAdmin = false }: { ticket: { id: string; subject: string; status: string }; onClose: () => void; asAdmin?: boolean }) {
  const { t, tErr, lang, session, toast } = useApp();
  const [msgs, setMsgs] = useState<Msg[] | null>(null);
  const [body, setBody] = useState('');
  const load = useCallback(async () => {
    const { data } = await supabase.from('support_messages').select('id, body, from_staff, created_at').eq('ticket_id', ticket.id).order('created_at');
    setMsgs((data || []) as Msg[]);
  }, [ticket.id]);
  useEffect(() => { load(); }, [load]);
  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!session || !body.trim()) return;
    const { error } = await supabase.from('support_messages').insert({ ticket_id: ticket.id, sender_id: session.user.id, body, from_staff: asAdmin });
    if (error) toast(tErr(error.message)); else { setBody(''); load(); }
  };
  const resolve = async () => {
    const { error } = await supabase.from('support_tickets').update({ status: 'resolved' }).eq('id', ticket.id);
    if (error) toast(tErr(error.message)); else { toast(t('c.saved')); onClose(); }
  };
  return (
    <Sheet title={ticket.subject} onClose={onClose}>
      <div className="stack" style={{ gap: 8 }}>
        {!msgs ? <LoadingList n={2} /> : msgs.map((m) => {
          const mine = m.from_staff === asAdmin;
          return (
            <div key={m.id} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '85%', background: mine ? 'var(--action)' : 'var(--neutral-bg)', color: mine ? '#fff' : 'var(--ink)', borderRadius: 16, padding: '10px 12px' }}>
              <div className="tiny" style={{ opacity: 0.8, fontWeight: 800 }}>{m.from_staff ? t('hp.team') : t('hp.you')} · {new Date(m.created_at).toLocaleString(lang, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{m.body}</div>
            </div>
          );
        })}
      </div>
      <form className="row" onSubmit={send}>
        <input className="input" value={body} onChange={(e) => setBody(e.target.value)} placeholder={t('hp.message')} aria-label={t('hp.message')} />
        <button className="btn btn-primary" style={{ minHeight: 48 }} disabled={!body.trim()}>{t('hp.send')}</button>
      </form>
      {asAdmin && ticket.status !== 'resolved' && <button className="btn btn-secondary" onClick={resolve}>{t('hp.resolve')}</button>}
    </Sheet>
  );
}
