// Translates short platform texts (ads, push) for the Tidyo team (Google Cloud Translation). Superadmin only.
import { createClient } from 'npm:@supabase/supabase-js@2.46.1';

const KEY = Deno.env.get('GOOGLE_SERVER_KEY');
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const toGoogle: Record<string, string> = { 'pt-BR': 'pt', en: 'en', es: 'es' };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
  try {
    if (!KEY) return json({ error: 'translate_not_configured' }, 503);
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') || '' } }, auth: { persistSession: false } });
    const { data: ok } = await db.rpc('is_platform_admin');
    if (!ok) return json({ error: 'not_allowed' }, 403);
    const { texts, targets } = await req.json() as { texts: string[]; targets: string[] };
    const out: Record<string, string[]> = {};
    for (const lang of (targets || []).slice(0, 3)) {
      const r = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${KEY}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: (texts || []).slice(0, 10).map((s) => String(s).slice(0, 2000)), target: toGoogle[lang] || 'en', format: 'text' }),
      });
      if (!r.ok) return json({ error: `translate ${r.status}` }, 502);
      const j = await r.json();
      out[lang] = j.data.translations.map((x: { translatedText: string }) => x.translatedText);
    }
    return json({ translations: out });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
