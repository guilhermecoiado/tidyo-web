// Translates a chat message into the languages of the other participants (Google Cloud Translation).
// Called by a database trigger with { id }; only fills translations that are still empty.
import { createClient } from 'npm:@supabase/supabase-js@2.46.1';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const KEY = Deno.env.get('GOOGLE_SERVER_KEY');
const toGoogle: Record<string, string> = { 'pt-BR': 'pt', en: 'en', es: 'es' };
const fromGoogle = (c: string) => (c.startsWith('pt') ? 'pt-BR' : c.startsWith('es') ? 'es' : c.startsWith('en') ? 'en' : null);

async function translate(text: string, target: string) {
  const r = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: text, target, format: 'text' }),
  });
  if (!r.ok) throw new Error(`translate ${r.status}`);
  const j = await r.json();
  return j.data.translations[0] as { translatedText: string; detectedSourceLanguage?: string };
}

Deno.serve(async (req) => {
  try {
    if (!KEY) return new Response('no key');
    const { id } = await req.json();
    const { data: m } = await db.from('messages').select('id, conversation_id, sender_id, body, translations').eq('id', id).maybeSingle();
    if (!m || Object.keys(m.translations || {}).length) return new Response('skip');
    const { data: conv } = await db.from('conversations').select('client_id, clients(no_translate)').eq('id', m.conversation_id).maybeSingle();
    if ((conv as { clients?: { no_translate?: boolean } } | null)?.clients?.no_translate) return new Response('no_translate');
    const { data: parts } = await db.from('conversation_participants').select('user_id').eq('conversation_id', m.conversation_id);
    const ids = (parts || []).map((p) => p.user_id).filter((u) => u !== m.sender_id);
    const { data: profs } = await db.from('profiles').select('id, language').in('id', ids);
    const targets = [...new Set((profs || []).map((p) => p.language as string))];
    const out: Record<string, string> = {};
    let source: string | null = null;
    for (const lang of targets) {
      const r = await translate(m.body, toGoogle[lang] || 'en');
      source = source || fromGoogle(r.detectedSourceLanguage || '');
      if (source !== lang) out[lang] = r.translatedText;
    }
    await db.from('messages').update({ translations: out, body_language: source }).eq('id', m.id);
    return new Response('ok');
  } catch (e) {
    return new Response(String(e), { status: 500 });
  }
});
