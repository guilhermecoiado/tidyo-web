// Translates a chat message into the languages of the other participants.
// Free MyMemory by default; Google Cloud Translation if GOOGLE_SERVER_KEY is set.
// Called by a database trigger with { id } and the internal key; only fills translations that are still empty.
import { createClient } from 'npm:@supabase/supabase-js@2.46.1';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
// ── Translation: Google Cloud Translation when GOOGLE_SERVER_KEY exists; otherwise MyMemory (free, no key).
// MyMemory: 5,000 chars/day anonymous, 50,000/day with a contact e-mail (MYMEMORY_EMAIL); 500 bytes per request.
const GKEY = Deno.env.get('GOOGLE_SERVER_KEY');
const MM_EMAIL = Deno.env.get('MYMEMORY_EMAIL') || 'contact.tidyo@gmail.com';
const short: Record<string, string> = { 'pt-BR': 'pt', en: 'en', es: 'es' };
const mmCode: Record<string, string> = { 'pt-BR': 'pt-BR', en: 'en-US', es: 'es-ES' };

function chunks(text: string, max = 450): string[] {
  const enc = new TextEncoder();
  const out: string[] = []; let cur = '';
  for (const part of text.split(/(?<=[.!?\n])\s+/)) {
    const next = cur ? `${cur} ${part}` : part;
    if (enc.encode(next).length <= max) { cur = next; continue; }
    if (cur) out.push(cur);
    if (enc.encode(part).length <= max) { cur = part; continue; }
    // a single very long sentence: cut on words
    cur = '';
    for (const w of part.split(' ')) { const n = cur ? `${cur} ${w}` : w; if (enc.encode(n).length > max && cur) { out.push(cur); cur = w; } else cur = n; }
  }
  if (cur) out.push(cur);
  return out;
}

const decode = (s: string) => s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

/** Translate `text` from `from` to `to` (app languages: pt-BR, en, es). Returns null when the provider fails. */
async function translateText(text: string, from: string, to: string): Promise<string | null> {
  if (!text.trim() || from === to) return text;
  if (GKEY) {
    const r = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${GKEY}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: text, source: short[from] || 'en', target: short[to] || 'en', format: 'text' }),
    });
    if (!r.ok) return null;
    const j = await r.json();
    return j.data?.translations?.[0]?.translatedText ?? null;
  }
  const parts: string[] = [];
  for (const c of chunks(text)) {
    const u = new URL('https://api.mymemory.translated.net/get');
    u.searchParams.set('q', c);
    u.searchParams.set('langpair', `${mmCode[from] || 'en-US'}|${mmCode[to] || 'en-US'}`);
    if (MM_EMAIL) u.searchParams.set('de', MM_EMAIL);
    const r = await fetch(u);
    if (!r.ok) return null;
    const j = await r.json();
    if (Number(j.responseStatus) !== 200 || !j.responseData?.translatedText) return null;
    parts.push(decode(String(j.responseData.translatedText)));
  }
  return parts.join(' ');
}

Deno.serve(async (req) => {
  try {
    // only the database trigger knows this key
    const { data: realKey } = await db.rpc('internal_hook_key');
    if (!realKey || req.headers.get('x-tidyo-key') !== realKey) return new Response('forbidden', { status: 403 });
    const { id } = await req.json();
    const { data: m } = await db.from('messages').select('id, conversation_id, sender_id, body, translations').eq('id', id).maybeSingle();
    if (!m || Object.keys(m.translations || {}).length) return new Response('skip');
    const { data: conv } = await db.from('conversations').select('client_id, clients(no_translate)').eq('id', m.conversation_id).maybeSingle();
    if ((conv as { clients?: { no_translate?: boolean } } | null)?.clients?.no_translate) return new Response('no_translate');
    const { data: parts } = await db.from('conversation_participants').select('user_id').eq('conversation_id', m.conversation_id);
    const ids = (parts || []).map((p) => p.user_id);
    const { data: profs } = await db.from('profiles').select('id, language').in('id', ids);
    // the sender writes in their app language
    const source = ((profs || []).find((p) => p.id === m.sender_id)?.language as string) || 'en';
    const targets = [...new Set((profs || []).filter((p) => p.id !== m.sender_id).map((p) => p.language as string))].filter((l) => l && l !== source);
    const out: Record<string, string> = {};
    for (const lang of targets) {
      const tr = await translateText(m.body, source, lang);
      if (tr && tr.trim().toLowerCase() !== m.body.trim().toLowerCase()) out[lang] = tr;
    }
    await db.from('messages').update({ translations: out, body_language: source }).eq('id', m.id);
    return new Response('ok');
  } catch (e) {
    return new Response(String(e), { status: 500 });
  }
});
