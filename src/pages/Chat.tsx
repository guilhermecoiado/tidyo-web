import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useApp } from '../lib/session';
import { Icon, LoadingList, Sheet } from '../components/ui';
import { LANG_LABEL, type Lang } from '../lib/i18n';
import { guessGender } from '../lib/gender';

type Conv = { id: string; company_id: string; other_user: string; other_name: string; last_message: string | null; last_message_at: string | null; unread: number };
type Msg = { id: string; sender_id: string; body: string; body_language: Lang | null; translations: Record<string, string>; created_at: string };
type Contact = { user_id: string; name: string; kind: string; language: Lang };

const companyOf = (ctx: { membership: { company_id: string } | null; portal: { company_id: string } | null }) => ctx.membership?.company_id || ctx.portal?.company_id || '';
const homeOf = (isStaff: boolean, hasMembership: boolean) => (isStaff ? '/app' : hasMembership ? '/dia' : '/portal');

export function ChatList() {
  const app = useApp();
  const { t, lang, isStaff, membership } = app;
  const nav = useNavigate();
  const [list, setList] = useState<Conv[] | null>(null);
  const [pick, setPick] = useState(false);
  const load = useCallback(() => { supabase.rpc('my_conversations').then(({ data }) => setList((data || []) as Conv[])); }, []);
  useEffect(() => { load(); const i = window.setInterval(load, 20000); return () => window.clearInterval(i); }, [load]);
  return (
    <div className="shell">
      <main className="page no-nav">
        <div className="topbar">
          <Link className="icon-btn" to={homeOf(isStaff, !!membership)} aria-label={t('c.close')}><Icon name="chevL" size={18} /></Link>
          <h1 className="grow">{t('ch.title')}</h1>
          <button className="btn btn-primary" style={{ minHeight: 44, padding: '0 14px' }} onClick={() => setPick(true)} aria-label={t('ch.new')}><Icon name="plus" size={18} />{t('ch.newShort')}</button>
        </div>
        {!list ? <LoadingList /> : list.length === 0 ? <div className="empty">{t('ch.none')}</div> : (
          <div className="list">
            {list.map((c) => (
              <button key={c.id} className="item" onClick={() => nav(`/mensagens/${c.id}`)}>
                <span style={{ width: 40, height: 40, borderRadius: 40, background: 'var(--brand-light)', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>{c.other_name.slice(0, 1).toUpperCase()}</span>
                <span className="body">
                  <span className="title">{c.other_name}</span>
                  <span className="small muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.last_message || ''}</span>
                </span>
                <span className="stack" style={{ gap: 4, alignItems: 'flex-end' }}>
                  {c.last_message_at && <span className="tiny muted">{new Date(c.last_message_at).toLocaleString(lang, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span>}
                  {Number(c.unread) > 0 && <span className="count" style={{ position: 'static' }}>{c.unread}</span>}
                </span>
              </button>
            ))}
          </div>
        )}
      </main>
      {pick && <ContactPicker companyId={companyOf(app)} onClose={() => setPick(false)} onOpen={(id) => nav(`/mensagens/${id}`)} />}
    </div>
  );
}

function ContactPicker({ companyId, onClose, onOpen }: { companyId: string; onClose: () => void; onOpen: (id: string) => void }) {
  const { t, tg, tErr, toast } = useApp();
  const [list, setList] = useState<Contact[] | null>(null);
  useEffect(() => { supabase.rpc('chat_contacts', { p_company: companyId }).then(({ data }) => setList((data || []) as Contact[])); }, [companyId]);
  const open = async (c: Contact) => {
    const { data, error } = await supabase.rpc('open_conversation', { p_company: companyId, p_with: c.user_id });
    if (error) toast(tErr(error.message)); else onOpen(data as string);
  };
  return (
    <Sheet title={t('ch.new')} onClose={onClose}>
      {!list ? <LoadingList n={3} /> : list.length === 0 ? <span className="muted">{t('ch.noContacts')}</span> : list.map((c) => (
        <button key={c.user_id} className="item" onClick={() => open(c)}>
          <span className="body"><span className="title">{c.name}</span><span className="small muted">{c.kind === 'client' ? t('job.client') : tg(`team.${c.kind}`, guessGender(c.name))} · {LANG_LABEL[c.language]}</span></span>
          <Icon name="chevR" size={18} />
        </button>
      ))}
    </Sheet>
  );
}

export function ChatThread() {
  const { id = '' } = useParams();
  const app = useApp();
  const { t, tErr, lang, session, toast } = app;
  const [msgs, setMsgs] = useState<Msg[] | null>(null);
  const [name, setName] = useState('');
  const [body, setBody] = useState('');
  const [showOriginal, setShowOriginal] = useState<Record<string, boolean>>({});
  const end = useRef<HTMLDivElement>(null);
  const companyId = useRef('');

  const load = useCallback(async () => {
    const { data } = await supabase.from('messages').select('id, sender_id, body, body_language, translations, created_at').eq('conversation_id', id).order('created_at').limit(300);
    setMsgs((data || []) as Msg[]);
    supabase.rpc('mark_conversation_read', { p_conversation: id }).then(() => undefined);
  }, [id]);

  useEffect(() => {
    load();
    supabase.rpc('my_conversations').then(({ data }) => {
      const c = ((data || []) as Conv[]).find((x) => x.id === id);
      if (c) { setName(c.other_name); companyId.current = c.company_id; }
    });
    // live updates: new messages and translations arriving
    const ch = supabase.channel(`conv-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` }, () => load())
      .subscribe();
    const poll = window.setInterval(load, 15000);
    return () => { supabase.removeChannel(ch); window.clearInterval(poll); };
  }, [id, load]);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [msgs?.length]);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const text = body.trim();
    if (!text || !session) return;
    setBody('');
    const { error } = await supabase.from('messages').insert({ conversation_id: id, company_id: companyId.current, sender_id: session.user.id, body: text, body_language: lang });
    if (error) { toast(tErr(error.message)); setBody(text); } else load();
  };

  return (
    <div className="shell">
      <main className="page no-nav" style={{ paddingBottom: 96 }}>
        <div className="topbar">
          <Link className="icon-btn" to="/mensagens" aria-label={t('ch.title')}><Icon name="chevL" size={18} /></Link>
          <h1 className="grow" style={{ fontSize: 20 }}>{name}</h1>
        </div>
        <div className="stack" style={{ gap: 8 }} aria-live="polite">
          {!msgs ? <LoadingList n={3} /> : msgs.length === 0 ? <div className="empty">{t('ch.start')}</div> : msgs.map((m) => {
            const mine = m.sender_id === session?.user.id;
            const translated = !mine && m.translations?.[lang];
            const text = translated && !showOriginal[m.id] ? m.translations[lang] : m.body;
            return (
              <div key={m.id} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '82%', background: mine ? 'var(--action)' : 'var(--surface)', color: mine ? '#fff' : 'var(--ink)', border: mine ? 0 : '1px solid var(--line)', borderRadius: 18, padding: '9px 12px' }}>
                <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{text}</div>
                <div className="tiny" style={{ opacity: 0.75, marginTop: 3, display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span>{new Date(m.created_at).toLocaleTimeString(lang, { hour: 'numeric', minute: '2-digit' })}</span>
                  {translated && <button className="link-btn" style={{ minHeight: 24, fontSize: 12, padding: 0, color: 'var(--action)' }} onClick={() => setShowOriginal({ ...showOriginal, [m.id]: !showOriginal[m.id] })}>
                    {showOriginal[m.id] ? t('ch.showTranslation') : t('ch.translatedFrom', { lang: LANG_LABEL[(m.body_language || 'en') as Lang] })}
                  </button>}
                </div>
              </div>
            );
          })}
          <div ref={end} />
        </div>
      </main>
      <form onSubmit={send} style={{ position: 'fixed', left: 0, right: 0, bottom: 0, background: 'var(--surface)', borderTop: '1px solid var(--line)', padding: `10px var(--gutter) calc(10px + env(safe-area-inset-bottom))` }}>
        <div className="row" style={{ maxWidth: 'var(--max-content)', margin: '0 auto' }}>
          <input className="input" value={body} onChange={(e) => setBody(e.target.value)} placeholder={t('ch.placeholder')} aria-label={t('ch.placeholder')} maxLength={4000} />
          <button className="btn btn-primary" style={{ minHeight: 48 }} disabled={!body.trim()}>{t('hp.send')}</button>
        </div>
      </form>
    </div>
  );
}
