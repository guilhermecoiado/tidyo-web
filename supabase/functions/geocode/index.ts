// Finds latitude/longitude for a client address, a helper's starting point or the office (Google Geocoding).
// Runs as the signed-in user, so the database rules decide who can update what.
import { createClient } from 'npm:@supabase/supabase-js@2.46.1';

const KEY = Deno.env.get('GOOGLE_SERVER_KEY');
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
  try {
    if (!KEY) return json({ error: 'maps_not_configured' }, 503);
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') || '' } }, auth: { persistSession: false } });
    const { table, ids, address } = await req.json() as { table: 'properties' | 'memberships' | 'companies'; ids?: string[]; address?: string };
    const results: { id: string; ok: boolean; lat?: number; lng?: number }[] = [];
    if (table === 'properties') {
      const { data } = await db.from('properties').select('id, address_line1, city, state, zip').in('id', (ids || []).slice(0, 50));
      for (const p of data || []) {
        const q = `${p.address_line1}, ${p.city}, ${p.state} ${p.zip}, USA`;
        const r = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(q)}&key=${KEY}`).then((x) => x.json());
        const loc = r.results?.[0]?.geometry?.location;
        if (loc) { const { error } = await db.from('properties').update({ lat: loc.lat, lng: loc.lng }).eq('id', p.id); results.push({ id: p.id, ok: !error, ...loc }); }
        else results.push({ id: p.id, ok: false });
      }
    } else if (table === 'memberships' && ids?.[0] && address) {
      const r = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${KEY}`).then((x) => x.json());
      const loc = r.results?.[0]?.geometry?.location;
      if (loc) { const { error } = await db.from('memberships').update({ origin_address: address, origin_lat: loc.lat, origin_lng: loc.lng }).eq('id', ids[0]); results.push({ id: ids[0], ok: !error, ...loc }); }
      else results.push({ id: ids[0], ok: false });
    } else if (table === 'companies' && ids?.[0] && address) {
      const r = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${KEY}`).then((x) => x.json());
      const loc = r.results?.[0]?.geometry?.location;
      if (loc) { const { error } = await db.from('companies').update({ lat: loc.lat, lng: loc.lng }).eq('id', ids[0]); results.push({ id: ids[0], ok: !error, ...loc }); }
      else results.push({ id: ids[0], ok: false });
    }
    return json({ results });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
