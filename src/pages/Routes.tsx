import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useApp } from '../lib/session';
import { Confirm, Icon, LoadingList, OwnerNav, Segmented } from '../components/ui';
import { getMembers, type Member } from '../lib/data';
import { addDays, dayLabel, isoDate, startOfDay, time } from '../lib/format';

type Stop = { id: string; client: string; address: string; lat: number | null; lng: number | null; property_id: string; start: string; route_position: number | null };
type Pt = { lat: number; lng: number };

const km = (a: Pt, b: Pt) => {
  const R = 6371, dLat = ((b.lat - a.lat) * Math.PI) / 180, dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h)) * 1.3; // road factor over straight line
};
const total = (origin: Pt | null, list: Stop[]) => {
  const pts = [...(origin ? [origin] : []), ...list.filter((s) => s.lat != null).map((s) => ({ lat: s.lat!, lng: s.lng! }))];
  let d = 0; for (let i = 1; i < pts.length; i++) d += km(pts[i - 1], pts[i]); return d;
};
const minutes = (dKm: number) => Math.round((dKm / 40) * 60); // ~40 km/h average in town

// Nearest neighbour, then 2-opt improvement. Good enough for a cleaner's day (≤ 15 stops).
function optimize(origin: Pt | null, stops: Stop[]) {
  const located = stops.filter((s) => s.lat != null);
  const rest = stops.filter((s) => s.lat == null);
  if (located.length < 2) return stops;
  const order: Stop[] = [];
  const left = [...located];
  let cur: Pt = origin || { lat: left[0].lat!, lng: left[0].lng! };
  while (left.length) {
    let bi = 0, bd = Infinity;
    left.forEach((s, i) => { const d = km(cur, { lat: s.lat!, lng: s.lng! }); if (d < bd) { bd = d; bi = i; } });
    const [n] = left.splice(bi, 1); order.push(n); cur = { lat: n.lat!, lng: n.lng! };
  }
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 0; i < order.length - 1; i++) for (let k = i + 1; k < order.length; k++) {
      const next = [...order.slice(0, i), ...order.slice(i, k + 1).reverse(), ...order.slice(k + 1)];
      if (total(origin, next) + 0.01 < total(origin, order)) { order.splice(0, order.length, ...next); improved = true; }
    }
  }
  return [...order, ...rest];
}

let mapsPromise: Promise<boolean> | null = null;
function loadMaps() {
  const key = import.meta.env.VITE_GOOGLE_MAPS_KEY;
  if (!key) return Promise.resolve(false);
  if ((window as any).google?.maps) return Promise.resolve(true);
  mapsPromise = mapsPromise || new Promise((res) => {
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&v=weekly`;
    s.async = true; s.onload = () => res(true); s.onerror = () => res(false);
    document.head.appendChild(s);
  });
  return mapsPromise;
}

function RouteMap({ origin, stops }: { origin: Pt | null; stops: Stop[] }) {
  const el = useRef<HTMLDivElement>(null);
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => { loadMaps().then(setOk); }, []);
  useEffect(() => {
    if (!ok || !el.current) return;
    const g = (window as any).google.maps;
    const pts = stops.filter((s) => s.lat != null).map((s) => ({ lat: s.lat!, lng: s.lng! }));
    if (!pts.length) return;
    const map = new g.Map(el.current, { center: pts[0], zoom: 12, disableDefaultUI: true, zoomControl: true, clickableIcons: false });
    const bounds = new g.LatLngBounds();
    const path = [...(origin ? [origin] : []), ...pts];
    if (origin) { new g.Marker({ position: origin, map, label: { text: '●', color: '#fff' }, title: 'Start' }); bounds.extend(origin); }
    pts.forEach((p, i) => { new g.Marker({ position: p, map, label: { text: String(i + 1), color: '#fff', fontWeight: '800' } }); bounds.extend(p); });
    new g.Polyline({ path, map, strokeColor: '#0B7C6E', strokeWeight: 4, strokeOpacity: 0.9 });
    map.fitBounds(bounds, 40);
  }, [ok, origin, stops]);
  if (ok === false) return null;
  return <div ref={el} style={{ height: 260, borderRadius: 18, border: '1px solid var(--line)', background: 'var(--neutral-bg)' }} role="img" aria-label="Map" />;
}

export function navUrl(origin: Pt | null, stops: { address: string }[]) {
  if (!stops.length) return '';
  const dest = stops[stops.length - 1].address;
  const way = stops.slice(0, -1).map((s) => s.address).join('|');
  return `https://www.google.com/maps/dir/?api=1${origin ? `&origin=${origin.lat},${origin.lng}` : ''}&destination=${encodeURIComponent(dest)}${way ? `&waypoints=${encodeURIComponent(way)}` : ''}&travelmode=driving`;
}

export default function RoutesPage() {
  const { t, tErr, lang, company, toast } = useApp();
  const [members, setMembers] = useState<Member[]>([]);
  const [who, setWho] = useState('');
  const [day, setDay] = useState(startOfDay(addDays(new Date(), 1)));
  const [stops, setStops] = useState<Stop[] | null>(null);
  const [plan, setPlan] = useState<Stop[] | null>(null);
  const [origin, setOrigin] = useState<Pt | null>(null);
  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState(false);

  useEffect(() => { if (company) getMembers(company.id).then((m) => { const a = m.filter((x) => x.status === 'active'); setMembers(a); setWho((w) => w || a.find((x) => x.role === 'helper')?.id || a[0]?.id || ''); }); }, [company]);

  const load = useCallback(async () => {
    if (!company || !who) return;
    setStops(null); setPlan(null);
    const { data } = await supabase.from('jobs')
      .select('id, scheduled_start, route_position, property_id, clients(name), properties(address_line1, city, state, zip, lat, lng), job_assignments!inner(membership_id)')
      .eq('company_id', company.id).eq('job_assignments.membership_id', who).neq('status', 'canceled')
      .gte('scheduled_start', day.toISOString()).lt('scheduled_start', addDays(day, 1).toISOString()).order('scheduled_start');
    const list = ((data || []) as any[]).map((j) => ({
      id: j.id, client: j.clients?.name || '', property_id: j.property_id, start: j.scheduled_start, route_position: j.route_position,
      address: `${j.properties?.address_line1}, ${j.properties?.city}, ${j.properties?.state} ${j.properties?.zip}`,
      lat: j.properties?.lat ?? null, lng: j.properties?.lng ?? null,
    })) as Stop[];
    list.sort((a, b) => (a.route_position ?? 99) - (b.route_position ?? 99) || a.start.localeCompare(b.start));
    setStops(list);
    const { data: m } = await supabase.from('memberships').select('origin_lat, origin_lng').eq('id', who).maybeSingle();
    setOrigin(m?.origin_lat ? { lat: m.origin_lat, lng: m.origin_lng } : null);
  }, [company, who, day]);
  useEffect(() => { load(); }, [load]);

  const missing = (stops || []).filter((s) => s.lat == null);
  const locate = async () => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('geocode', { body: { table: 'properties', ids: [...new Set(missing.map((s) => s.property_id))] } });
    setBusy(false);
    if (error || data?.error) toast(data?.error === 'maps_not_configured' ? t('rt.noKey') : tErr(error?.message)); else { toast(t('c.saved')); load(); }
  };
  const before = useMemo(() => total(origin, stops || []), [origin, stops]);
  const after = useMemo(() => (plan ? total(origin, plan) : null), [origin, plan]);
  const shown = plan || stops || [];
  const apply = async () => {
    if (!plan) return;
    const { error } = await supabase.rpc('apply_route', { p_membership: who, p_date: isoDate(day), p_order: plan.map((s) => s.id), p_minutes_before: minutes(before), p_minutes_after: minutes(after || before) });
    if (error) toast(tErr(error.message)); else { toast(t('rt.applied')); load(); }
  };
  const move = (i: number, dir: -1 | 1) => {
    const list = [...shown]; const j = i + dir; if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]]; setPlan(list);
  };

  return (
    <div className="shell">
      <main className="page">
        <div className="topbar"><Link className="icon-btn" to="/app/agenda" aria-label={t('nav.schedule')}><Icon name="chevL" size={18} /></Link><h1 className="grow">{t('rt.title')}</h1></div>
        <div className="chips" role="group" aria-label={t('job.helper')}>
          {members.map((m) => <button key={m.id} className="chip" aria-pressed={who === m.id} onClick={() => setWho(m.id)}>{m.display_name}</button>)}
        </div>
        <Segmented value={isoDate(day)} onChange={(v) => setDay(new Date(`${v}T00:00`))} label={t('job.date')}
          options={[0, 1, 2].map((n) => { const d = startOfDay(addDays(new Date(), n)); return { value: isoDate(d), label: n === 0 ? t('c.today') : n === 1 ? t('c.tomorrow') : dayLabel(d, lang) }; })} />
        {!stops ? <LoadingList n={3} /> : stops.length === 0 ? <div className="empty">{t('home.noJobs')}</div> : (
          <>
            {missing.length > 0 && (
              <div className="strip" style={{ background: 'var(--warn-bg)', borderColor: '#F3DDB8', color: 'var(--warn-fg)' }}>
                <span className="grow">{t('rt.missing', { n: missing.length })}</span>
                <button className="btn btn-primary" style={{ minHeight: 40 }} disabled={busy} onClick={locate}>{t('rt.locate')}</button>
              </div>
            )}
            <RouteMap origin={origin} stops={shown} />
            <div className="grid2">
              <div className="kpi"><div className="label">{t('rt.current')}</div><div className="value num">{minutes(before)} min</div><div className="tiny muted">{before.toFixed(1)} km</div></div>
              <div className="kpi" style={after != null ? { background: 'var(--brand-light)' } : undefined}><div className="label">{t('rt.optimized')}</div>
                <div className="value num">{after != null ? `${minutes(after)} min` : '—'}</div>
                {after != null && <div className="tiny bold" style={{ color: 'var(--ok-fg)' }}>{before - after > 0.05 ? t('rt.saves', { n: minutes(before) - minutes(after) }) : t('rt.alreadyBest')}</div>}</div>
            </div>
            {!origin && <span className="hint">{t('rt.noOrigin')}</span>}
            <div className="list">
              {shown.map((s, i) => (
                <div key={s.id} className="item" style={{ cursor: 'default' }}>
                  <span style={{ width: 30, height: 30, borderRadius: 30, background: 'var(--brand-dark)', color: '#5FD4C1', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>{i + 1}</span>
                  <span className="body"><span className="title">{s.client}</span><span className="small muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{time(s.start, lang)} · {s.address}</span></span>
                  <button className="icon-btn" style={{ width: 40, height: 40 }} aria-label="↑" disabled={i === 0} onClick={() => move(i, -1)}><Icon name="chevU" size={16} /></button>
                  <button className="icon-btn" style={{ width: 40, height: 40 }} aria-label="↓" disabled={i === shown.length - 1} onClick={() => move(i, 1)}><Icon name="chevD" size={16} /></button>
                </div>
              ))}
            </div>
            <div className="grid2">
              <button className="btn btn-secondary" onClick={() => setPlan(optimize(origin, stops))}>{t('rt.optimize')}</button>
              <button className="btn btn-primary" style={{ minHeight: 44 }} disabled={!plan} onClick={() => setAsk(true)}>{t('rt.apply')}</button>
            </div>
            <a className="btn btn-ghost" href={navUrl(origin, shown)} target="_blank" rel="noreferrer"><Icon name="pin" size={18} />{t('rt.openMaps')}</a>
            <span className="hint">{t('rt.timesHint')}</span>
          </>
        )}
      </main>
      <OwnerNav />
      {ask && <Confirm text={t('rt.applyAsk')} confirmLabel={t('rt.apply')} onCancel={() => setAsk(false)} onConfirm={() => { setAsk(false); apply(); }} />}
    </div>
  );
}
