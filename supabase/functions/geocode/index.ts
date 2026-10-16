// Finds latitude/longitude for a client address, a helper's starting point or the office.
// Free providers: US Census Geocoder (US addresses, no key), then OpenStreetMap Nominatim as a fallback.
// Google Geocoding is used first only if GOOGLE_SERVER_KEY is set.
// Runs as the signed-in user, so the database rules decide who can update what.
import { createClient } from 'npm:@supabase/supabase-js@2.46.1';

const GKEY = Deno.env.get('GOOGLE_SERVER_KEY');
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
type Loc = { lat: number; lng: number };
let lastNominatim = 0;

async function google(q: string): Promise<Loc | null> {
  if (!GKEY) return null;
  const r = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(q)}&key=${GKEY}`).then((x) => x.json()).catch(() => null);
  return r?.results?.[0]?.geometry?.location ?? null;
}
async function census(q: string): Promise<Loc | null> {
  const u = `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=${encodeURIComponent(q)}&benchmark=Public_AR_Current&format=json`;
  const r = await fetch(u).then((x) => (x.ok ? x.json() : null)).catch(() => null);
  const c = r?.result?.addressMatches?.[0]?.coordinates;
  return c && typeof c.y === 'number' ? { lat: c.y, lng: c.x } : null;
}
async function nominatim(q: string): Promise<Loc | null> {
  // usage policy: at most 1 request per second, identify the app
  const wait = 1100 - (Date.now() - lastNominatim);
  if (wait > 0) await new Promise((res) => setTimeout(res, wait));
  lastNominatim = Date.now();
  const u = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=us&q=${encodeURIComponent(q)}`;
  const r = await fetch(u, { headers: { 'User-Agent': 'Tidyo/1.0 (https://tidyo-app.netlify.app)' } }).then((x) => (x.ok ? x.json() : null)).catch(() => null);
  const f = Array.isArray(r) ? r[0] : null;
  return f ? { lat: Number(f.lat), lng: Number(f.lon) } : null;
}
async function geocode(q: string): Promise<Loc | null> {
  return (await google(q)) || (await census(q)) || (await nominatim(q));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
  try {
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') || '' } }, auth: { persistSession: false } });
    const { table, ids, address } = await req.json() as { table: 'properties' | 'memberships' | 'companies'; ids?: string[]; address?: string };
    const results: { id: string; ok: boolean; lat?: number; lng?: number }[] = [];
    if (table === 'properties') {
      const { data } = await db.from('properties').select('id, address_line1, city, state, zip').in('id', (ids || []).slice(0, 50));
      for (const p of data || []) {
        const loc = await geocode(`${p.address_line1}, ${p.city}, ${p.state} ${p.zip}`);
        if (loc) { const { error } = await db.from('properties').update({ lat: loc.lat, lng: loc.lng }).eq('id', p.id); results.push({ id: p.id, ok: !error, ...loc }); }
        else results.push({ id: p.id, ok: false });
      }
    } else if (table === 'memberships' && ids?.[0] && address) {
      const loc = await geocode(address);
      if (loc) { const { error } = await db.from('memberships').update({ origin_address: address, origin_lat: loc.lat, origin_lng: loc.lng }).eq('id', ids[0]); results.push({ id: ids[0], ok: !error, ...loc }); }
      else results.push({ id: ids[0], ok: false });
    } else if (table === 'companies' && ids?.[0] && address) {
      const loc = await geocode(address);
      if (loc) { const { error } = await db.from('companies').update({ lat: loc.lat, lng: loc.lng }).eq('id', ids[0]); results.push({ id: ids[0], ok: !error, ...loc }); }
      else results.push({ id: ids[0], ok: false });
    }
    return json({ results });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
