// Translates short platform texts (ads, push) for the Tidyo team. Superadmin only.
// Free MyMemory by default; Google Cloud Translation if GOOGLE_SERVER_KEY is set.
import { createClient } from 'npm:@supabase/supabase-js@2.46.1';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
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
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
  try {
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') || '' } }, auth: { persistSession: false } });
    const { data: ok } = await db.rpc('is_platform_admin');
    if (!ok) return json({ error: 'not_allowed' }, 403);
    const { texts, targets, source } = await req.json() as { texts: string[]; targets: string[]; source?: string };
    const from = source || 'pt-BR';
    const out: Record<string, string[]> = {};
    for (const lang of (targets || []).slice(0, 3)) {
      const list: string[] = [];
      for (const s of (texts || []).slice(0, 10)) {
        const tr = await translateText(String(s).slice(0, 2000), from, lang);
        if (tr == null) return json({ error: 'translate_failed' }, 502);
        list.push(tr);
      }
      out[lang] = list;
    }
    return json({ translations: out });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
