// Chat (canvas "Chat"): one conversation, translated automatically, with job events and photos
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useApp } from '../lib/session';
import { C, I, Svg, colorOf, hm, initials, shortName } from '../components/kit';
import { compressImage } from '../lib/photos';
import { isoDate } from '../lib/format';
import { guessGender } from '../lib/gender';
import type { Lang } from '../lib/i18n';

type Msg = { id: string; sender_id: string; body: string; body_language: Lang | null; translations: Record<string, string>; attachment_path: string | null; created_at: string };
type Conv = { id: string; company_id: string; other_user: string; other_name: string };
type Other = { kind: string; language: Lang; membershipId: string | null; field: string | null };
type Row = { at: string; kind: 'msg'; m: Msg } | { at: string; kind: 'sys'; text: string; sub: string };

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0);

export default function ChatScreen() {
  const { id = '' } = useParams();
  const { t, tg, tErr, lang, session, isStaff, membership, toast } = useApp();
  const nav = useNavigate();
  const me = session?.user.id;
  const [conv, setConv] = useState<Conv | null>(null);
  const [other, setOther] = useState<Other | null>(null);
  const [msgs, setMsgs] = useState<Msg[] | null>(null);
  const [events, setEvents] = useState<Row[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [original, setOriginal] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from('messages').select('id, sender_id, body, body_language, translations, attachment_path, created_at').eq('conversation_id', id).order('created_at').limit(300);
    setMsgs((data || []) as Msg[]);
    supabase.rpc('mark_conversation_read', { p_conversation: id }).then(() => undefined);
  }, [id]);

  useEffect(() => {
    load();
    supabase.rpc('my_conversations').then(async ({ data }) => {
      const c = ((data || []) as Conv[]).find((x) => x.id === id);
      if (!c) return;
      setConv(c);
      const { data: cs } = await supabase.rpc('chat_contacts', { p_company: c.company_id });
      const ct = ((cs || []) as { user_id: string; kind: string; language: Lang }[]).find((x) => x.user_id === c.other_user);
      let membershipId: string | null = null, field: string | null = null;
      if (isStaff && ct && ct.kind !== 'client') {
        const { data: m } = await supabase.from('memberships').select('id').eq('company_id', c.company_id).eq('user_id', c.other_user).maybeSingle();
        membershipId = m?.id || null;
        if (membershipId) {
          const since = new Date(Date.now() - 14 * 864e5).toISOString();
          const { data: js } = await supabase.from('jobs').select('id, status, started_at, completed_at, clients(name), job_assignments!inner(membership_id)')
            .eq('job_assignments.membership_id', membershipId).gte('scheduled_start', since).not('started_at', 'is', null);
          const rows: Row[] = [];
          for (const j of (js || []) as unknown as { status: string; started_at: string; completed_at: string | null; clients: { name: string } | null }[]) {
            if (!j.started_at) continue;
            const cn = j.clients?.name || '';
            rows.push({ at: j.started_at, kind: 'sys', text: t('cht.checkIn', { client: cn }), sub: hm(j.started_at, lang) });
            if (j.completed_at) rows.push({ at: j.completed_at, kind: 'sys', text: t('cht.done', { client: cn }), sub: hm(j.completed_at, lang) });
            if (j.status === 'in_progress') field = cn;
          }
          setEvents(rows);
        }
      }
      setOther(ct ? { kind: ct.kind, language: ct.language, membershipId, field } : { kind: '', language: lang, membershipId: null, field: null });
    });
    const ch = supabase.channel(`conv-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` }, () => load())
      .subscribe();
    const poll = window.setInterval(load, 15000);
    return () => { supabase.removeChannel(ch); window.clearInterval(poll); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, load]);

  // signed links for photos
  useEffect(() => {
    const paths = (msgs || []).map((m) => m.attachment_path).filter((p): p is string => !!p && !urls[p]);
    if (!paths.length) return;
    supabase.storage.from('chat-files').createSignedUrls(paths, 3600).then(({ data }) => {
      if (data) setUrls((u) => ({ ...u, ...Object.fromEntries(data.filter((d) => d.signedUrl && d.path).map((d) => [d.path!, d.signedUrl])) }));
    });
  }, [msgs, urls]);

  const rows = useMemo<Row[]>(() => [...(msgs || []).map((m) => ({ at: m.created_at, kind: 'msg' as const, m })), ...events].sort((a, b) => a.at.localeCompare(b.at)), [msgs, events]);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [rows.length]);

  const langName = (l: string | null | undefined) => t(`lang.n.${l || 'en'}`);
  const otherLang = other?.language;
  const translating = !!otherLang && otherLang !== lang;
  const first = conv ? conv.other_name.split(' ')[0] : '';
  const isClient = other?.kind === 'client';
  const dayLabel = (iso: string) => {
    const d = new Date(iso), today = new Date();
    if (isoDate(d) === isoDate(today)) return t('cht.today');
    if (isoDate(d) === isoDate(new Date(today.getTime() - 864e5))) return t('ce.yesterday');
    return d.toLocaleDateString(lang, { weekday: 'long', day: 'numeric', month: 'long' });
  };

  const send = async (text: string, attachment: string | null = null) => {
    const body = text.trim();
    if (!body || !session || !conv) return;
    if (!attachment) setDraft('');
    const { error } = await supabase.from('messages').insert({ conversation_id: id, company_id: conv.company_id, sender_id: session.user.id, body, body_language: lang, attachment_path: attachment });
    if (error) { toast(tErr(error.message)); if (!attachment) setDraft(body); } else load();
  };
  const sendPhoto = async (file: File) => {
    if (!conv) return;
    setBusy(true);
    try {
      const blob = await compressImage(file);
      const path = `${conv.company_id}/${id}/${crypto.randomUUID()}.jpg`;
      const { error } = await supabase.storage.from('chat-files').upload(path, blob, { contentType: 'image/jpeg' });
      if (error) throw error;
      await send(t('cht.photo'), path);
    } catch (e) { toast(tErr((e as Error).message)); }
    setBusy(false);
  };
  const quick = isStaff ? (isClient ? [t('cht.c1'), t('cht.c2')] : [t('cht.q1'), t('cht.q2'), t('cht.q3')]) : membership ? [t('cht.h1'), t('cht.h2'), t('cht.h3')] : [];

  const status = other?.field ? t('cht.inField', { client: other.field })
    : other?.kind === 'client' ? t('job.client') : other?.kind ? tg(`team.${other.kind}`, guessGender(conv?.other_name || '')) : '';
  let lastDay = '';

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: '#F4F7F6', color: C.ink }}>
      <div style={{ background: '#FFFFFF', borderBottom: `1px solid ${C.line}`, paddingTop: 'env(safe-area-inset-top)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', maxWidth: 560, margin: '0 auto', boxSizing: 'border-box' }}>
          <button className="k-iconbtn" aria-label={t('c.back')} onClick={() => (window.history.length > 1 ? nav(-1) : nav('/mensagens'))}><Svg d={I.back} size={20} color={C.ink} /></button>
          <span style={{ width: 40, height: 40, borderRadius: 40, background: isClient ? '#4B3BA8' : colorOf(Math.abs(hash(conv?.other_user || '')))[0], color: '#FFFFFF', fontWeight: 800, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>{conv ? initials(conv.other_name) : ''}</span>
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
            <span style={{ fontWeight: 800, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{conv ? (isClient ? conv.other_name : shortName(conv.other_name)) : ''}</span>
            <span style={{ fontSize: 12, color: other?.field ? '#0B6B5F' : C.muted, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{status}</span>
          </div>
          {other?.membershipId && (
            <Link className="k-iconbtn" to={`/app/rotas?d=${isoDate(new Date())}&m=${other.membershipId}`} aria-label={t('cht.where', { name: first })}><Svg d={I.pin} size={20} color={C.ink} /></Link>
          )}
        </div>
        {translating && (
          <div style={{ background: '#DDF1EC' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', maxWidth: 560, margin: '0 auto', boxSizing: 'border-box' }}>
              <Svg d="M4 5h8M8 3v2M5 9c1.5 3 4 5 7 6M11 5c-1 4-3 7-7 9M13 21l4-9 4 9M14.5 18h5" size={16} color="#0B6B5F" />
              <span style={{ fontSize: 12.5, color: '#0B6B5F', fontWeight: 700, flex: 1, minWidth: 0 }}>{t('cht.speaks', { name: first, lang: langName(otherLang) })}</span>
              <button onClick={() => setOriginal(!original)} style={{ minHeight: 32, padding: '0 10px', borderRadius: 10, border: '1px solid #A9D9CF', background: '#FFFFFF', color: '#0B6B5F', fontWeight: 800, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap', flex: 'none', fontFamily: 'inherit' }}>{original ? t('ch.showTranslation') : t('cht.seeOriginal')}</button>
            </div>
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }} aria-live="polite">
        <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 560, margin: '0 auto', boxSizing: 'border-box' }}>
          {!msgs ? [0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 56, width: '70%', borderRadius: 16, alignSelf: i % 2 ? 'flex-end' : 'flex-start' }} />)
            : rows.length === 0 ? <span style={{ alignSelf: 'center', textAlign: 'center', fontSize: 13, color: C.muted, padding: '40px 20px', lineHeight: 1.5 }}>{t('ch.start')}</span>
              : rows.map((r, i) => {
                const day = dayLabel(r.at);
                const sep = day !== lastDay ? (lastDay = day, <span key={`d${i}`} style={{ alignSelf: 'center', fontSize: 11.5, fontWeight: 700, color: C.muted, background: '#E4ECEA', borderRadius: 999, padding: '3px 10px' }}>{day.charAt(0).toUpperCase() + day.slice(1)}</span>) : null;
                if (r.kind === 'sys') return [sep, (
                  <div key={`s${i}`} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <div style={{ background: '#FFFFFF', border: `1px solid ${C.line}`, borderRadius: 14, padding: '10px 12px', display: 'flex', gap: 10, alignItems: 'center' }}>
                      <span style={{ width: 32, height: 32, borderRadius: 10, background: '#DDF1EC', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><Svg d={I.check} size={16} color={C.accent} w={2.4} /></span>
                      <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}><span style={{ fontWeight: 800, fontSize: 13 }}>{r.text}</span><span style={{ fontSize: 12, color: C.muted }}>{r.sub}</span></span>
                    </div>
                  </div>
                )];
                const m = r.m, mine = m.sender_id === me;
                const tr = !mine && m.translations?.[lang] && m.body_language !== lang ? m.translations[lang] : null;
                const text = tr && !original ? tr : m.body;
                const note = mine
                  ? (translating && otherLang ? (m.translations?.[otherLang] ? t('cht.delivered', { lang: langName(otherLang) }) : t('cht.willDeliver', { lang: langName(otherLang) })) : '')
                  : tr ? (original ? t('cht.originalIn', { lang: langName(m.body_language) }) : t('cht.translatedFrom', { lang: langName(m.body_language) })) : '';
                const url = m.attachment_path ? urls[m.attachment_path] : null;
                return [sep, (
                  <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start', gap: 3 }}>
                    {m.attachment_path ? (
                      <a href={url || undefined} target="_blank" rel="noreferrer" style={{ display: 'block', width: 236, maxWidth: '78%', background: '#FFFFFF', border: `1px solid ${C.line}`, borderRadius: mine ? '16px 16px 4px 16px' : '16px 16px 16px 4px', padding: 4 }} aria-label={t('cht.photo')}>
                        <span style={{ display: 'block', height: 160, borderRadius: 12, background: url ? `#CFE0DB url(${url}) center/cover` : '#CFE0DB' }} />
                      </a>
                    ) : (
                      <div style={{ maxWidth: '78%', background: mine ? C.accent : '#FFFFFF', color: mine ? '#FFFFFF' : C.ink, border: mine ? 0 : `1px solid ${C.line}`, borderRadius: mine ? '16px 16px 4px 16px' : '16px 16px 16px 4px', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={{ fontSize: 14, lineHeight: 1.45, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{text}</span>
                        {note && <span style={{ fontSize: 11, fontWeight: 700, color: mine ? '#BDE8E0' : C.muted }}>{note}</span>}
                      </div>
                    )}
                    <span className="num" style={{ fontSize: 11, color: C.muted }}>{hm(m.created_at, lang)}</span>
                  </div>
                )];
              })}
          <div ref={end} />
        </div>
      </div>

      <div style={{ background: '#FFFFFF', borderTop: `1px solid ${C.line}`, paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          {quick.length > 0 && (
            <div className="k-chips scroll" style={{ padding: '8px 16px 0' }}>
              {quick.map((q) => <button key={q} className="k-chip" style={{ minHeight: 34, background: '#F4F7F6', fontWeight: 700 }} onClick={() => send(q)}>{q}</button>)}
            </div>
          )}
          <form onSubmit={(e: FormEvent) => { e.preventDefault(); send(draft); }} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 12px 18px' }}>
            <label className="k-iconbtn" style={{ cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.5 : 1 }} aria-label={t('cht.sendPhoto')}>
              <Svg d={I.cam} size={20} color={C.ink} w={1.8} />
              <input type="file" accept="image/*" className="sr-only" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) sendPhoto(f); }} />
            </label>
            <label style={{ flex: 1, display: 'block', minWidth: 0 }}>
              <span className="sr-only">{t('hp.message')}</span>
              <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={4000} placeholder={t('cht.writeIn', { lang: langName(lang) })}
                style={{ width: '100%', boxSizing: 'border-box', minHeight: 44, borderRadius: 14, border: `1px solid ${C.line}`, background: '#F4F7F6', padding: '0 14px', fontFamily: 'inherit', fontSize: 15, color: C.ink }} />
            </label>
            <button type="submit" aria-label={t('cht.send')} disabled={!draft.trim()} style={{ width: 44, height: 44, flex: 'none', borderRadius: 14, border: 0, background: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', opacity: draft.trim() ? 1 : 0.6, padding: 0 }}>
              <Svg d={I.send} size={20} color="#FFFFFF" w={2.2} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
