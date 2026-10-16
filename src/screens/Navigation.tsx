// Rota do dia: the helper's stops in the order Tidy optimised, with check-in, opening each stop (or the whole route)
// in Google Maps, Waze or Apple Maps. Owners open the same screen as a preview (/app/rotas/navegacao?m=…&d=…).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useApp } from '../lib/session';
import { Sheet } from '../components/ui';
import { C, Head, I, Svg, hm } from '../components/kit';
import { addDays, startOfDay } from '../lib/format';
import { driveMin, km, miles, pt, total } from '../lib/route';
import { perform } from '../lib/offline';

type NJob = { job_id: string; status: string; scheduled_start: string; route_position: number | null; client_name: string; address_line1: string; city: string; state: string; zip: string;
  lat: number | null; lng: number | null; access_instructions: string | null; pets: string | null };

const APPS = [
  { id: 'gmaps', name: 'Google Maps', short: 'G', color: '#1A73E8' },
  { id: 'waze', name: 'Waze', short: 'W', color: '#1F8FB5' },
  { id: 'apple', name: 'Apple Maps', short: 'A', color: '#3E4F4C' },
] as const;
type AppId = typeof APPS[number]['id'];
const store = { get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* blocked */ } } };
const addr = (j: NJob) => `${j.address_line1}, ${j.city}, ${j.state} ${j.zip}`;
function stopUrl(app: AppId, j: NJob) {
  const q = encodeURIComponent(addr(j));
  if (app === 'waze') return j.lat != null && j.lng != null ? `https://waze.com/ul?ll=${j.lat},${j.lng}&navigate=yes` : `https://waze.com/ul?q=${q}&navigate=yes`;
  if (app === 'apple') return `https://maps.apple.com/?daddr=${q}&dirflg=d`;
  return `https://www.google.com/maps/dir/?api=1&destination=${q}&travelmode=driving`;
}
/** Every remaining stop, in order, as one Google Maps route (starts from where the phone is) */
function fullRouteUrl(stops: NJob[]) {
  const list = stops.slice(0, 10);
  const dest = encodeURIComponent(addr(list[list.length - 1]));
  const way = list.slice(0, -1).map(addr).join('|');
  return `https://www.google.com/maps/dir/?api=1&destination=${dest}${way ? `&waypoints=${encodeURIComponent(way)}` : ''}&travelmode=driving`;
}

export default function Navigation() {
  const { t, lang, membership, toast, tErr } = useApp();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const previewOf = params.get('m');
  const day = useMemo(() => { const d = params.get('d'); return d ? startOfDay(new Date(d + 'T12:00')) : startOfDay(new Date()); }, [params]);
  const [jobs, setJobs] = useState<NJob[] | null>(null);
  const [name, setName] = useState('');
  const [sheet, setSheet] = useState<NJob | null>(null);
  const [app, setApp] = useState<AppId>((store.get('tidyo.navApp') as AppId) || 'gmaps');
  const [remember, setRemember] = useState(true);
  const [arrived, setArrived] = useState<{ at: string; ok: boolean; job: NJob } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const end = addDays(day, 1);
    if (previewOf) {
      const [{ data }, { data: m }] = await Promise.all([
        supabase.from('jobs').select('id, status, scheduled_start, route_position, clients(name), properties(address_line1, city, state, zip, lat, lng, access_instructions, pets), job_assignments!inner(membership_id)')
          .eq('job_assignments.membership_id', previewOf).gte('scheduled_start', day.toISOString()).lt('scheduled_start', end.toISOString()).neq('status', 'canceled'),
        supabase.from('memberships').select('display_name').eq('id', previewOf).maybeSingle(),
      ]);
      setName((m?.display_name || '').split(' ')[0]);
      setJobs(((data || []) as unknown as { id: string; status: string; scheduled_start: string; route_position: number | null; clients: { name: string } | null; properties: Omit<NJob, 'job_id' | 'status' | 'scheduled_start' | 'route_position' | 'client_name'> | null }[])
        .map((j) => ({ job_id: j.id, status: j.status, scheduled_start: j.scheduled_start, route_position: j.route_position, client_name: j.clients?.name || '', ...(j.properties || { address_line1: '', city: '', state: '', zip: '', lat: null, lng: null, access_instructions: null, pets: null }) })));
    } else {
      const { data, error } = await supabase.rpc('helper_jobs');
      if (error) { toast(tErr(error.message)); setJobs([]); return; }
      setJobs(((data || []) as (NJob & { membership_id: string })[]).filter((j) => j.membership_id === membership?.id && new Date(j.scheduled_start) >= day && new Date(j.scheduled_start) < end && j.status !== 'canceled'));
    }
  }, [day, previewOf, membership, toast, tErr]);
  useEffect(() => { load(); }, [load]);

  const ordered = useMemo(() => (jobs || []).slice().sort((a, b) => (a.route_position ?? 99) - (b.route_position ?? 99) || a.scheduled_start.localeCompare(b.scheduled_start)), [jobs]);
  const idx = ordered.findIndex((j) => j.status === 'scheduled');
  const next = idx >= 0 ? ordered[idx] : null;
  const remaining = ordered.filter((j) => j.status === 'scheduled');
  const tidyRoute = ordered.some((j) => j.route_position != null);
  const located = ordered.map((j) => ({ lat: j.lat, lng: j.lng })).filter((x) => pt(x));
  const dist = located.length > 1 ? total(null, located) : null;
  const to = next && pt({ lat: next.lat, lng: next.lng });

  const go = (j: NJob, a: AppId = app) => { window.open(stopUrl(a, j), '_blank', 'noopener'); };
  const openStop = (j: NJob) => { if (store.get('tidyo.navApp')) go(j); else setSheet(j); };
  const confirmApp = () => {
    if (!sheet) return;
    if (remember) store.set('tidyo.navApp', app);
    const j = sheet; setSheet(null); go(j, app);
  };

  const checkIn = async () => {
    if (!next) return;
    if (previewOf) { toast(t('nv.previewOnly', { name })); return; }
    setBusy(true);
    const p = await new Promise<GeolocationPosition | null>((res) => {
      if (!navigator.geolocation) return res(null);
      navigator.geolocation.getCurrentPosition(res, () => res(null), { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 });
    });
    if (p) await perform({ kind: 'rpc', fn: 'job_start_location', args: { p_job: next.job_id, p_lat: p.coords.latitude, p_lng: p.coords.longitude } });
    const r = await perform({ kind: 'rpc', fn: 'job_progress', args: { p_job: next.job_id, p_status: 'in_progress', p_note: null } });
    setBusy(false);
    if (r.error) { toast(tErr(r.error)); return; }
    const near = !!(p && to && km({ lat: p.coords.latitude, lng: p.coords.longitude }, to) / 1.3 < 0.3);
    setArrived({ at: new Date().toISOString(), ok: near, job: next });
    setJobs((list) => list && list.map((j) => (j.job_id === next.job_id ? { ...j, status: 'in_progress' } : j)));
  };

  const close = () => (window.history.length > 1 ? nav(-1) : nav(previewOf ? '/app/rotas' : '/dia'));
  const appName = APPS.find((a) => a.id === app)!.name;

  return (
    <div className="k-screen">
      <main className="k-page" style={{ gap: 14 }}>
        <Head title={previewOf ? t('nv.routeOf', { name }) : t('nv.title')} sub={day.toLocaleDateString(lang, { weekday: 'long', day: 'numeric', month: 'long' })} back={close} />
        {previewOf && name && <span className="k-pill" style={{ alignSelf: 'flex-start', background: '#EEF1F0', color: '#3E4F4C' }}>{t('nv.preview', { name })}</span>}

        {jobs === null ? <div className="skeleton" style={{ height: 180, borderRadius: 16 }} /> : arrived ? (
          <div className="k-card" style={{ padding: 16, gap: 14 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={{ width: 40, height: 40, borderRadius: 40, background: '#DDF1EC', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><Svg d={I.check} size={20} color={C.accent} w={2.6} /></div>
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 18, fontWeight: 700 }}>{t('nv.checkedIn', { t: hm(arrived.at, lang) })}</span>
                <span style={{ fontSize: 12.5, color: C.muted }}>{arrived.ok ? t('nv.locOk', { name: arrived.job.client_name }) : t('nv.locNo')}</span>
              </div>
            </div>
            <div className="k-pair">
              <button className="k-btn k-btn-line" onClick={() => setArrived(null)}>{t('nv.backToRoute')}</button>
              <button className="k-btn k-btn-fill" onClick={() => nav(`/dia/servico/${arrived.job.job_id}`)}>{t('nv.checklist')}</button>
            </div>
          </div>
        ) : !next ? (
          <div className="k-card" style={{ padding: 20, alignItems: 'center', textAlign: 'center', gap: 10 }}>
            <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 19, fontWeight: 700 }}>{ordered.length ? t('nv.allDone') : t('nv.noStops')}</span>
            <button className="k-btn k-btn-fill" onClick={close}>{t('c.back')}</button>
          </div>
        ) : (
          <div className="k-card" style={{ padding: 16, gap: 12, borderColor: '#BFE3DB' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('nv.stopOf', { n: idx + 1, total: ordered.length })}</span>
              {tidyRoute && <span className="nw" style={{ fontSize: 12, fontWeight: 700, color: '#0B6B5F', background: '#DDF1EC', borderRadius: 999, padding: '3px 9px' }}>{t('nv.tidyRoute')}</span>}
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
                <span className="k-ell" style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 20, fontWeight: 700 }}>{next.client_name}</span>
                <span className="k-ell" style={{ fontSize: 13, color: C.muted }}>{addr(next)}</span>
              </div>
              <span className="num nw" style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 20, fontWeight: 700, color: C.accent }}>{hm(next.scheduled_start, lang)}</span>
            </div>
            {(next.access_instructions || next.pets) && (
              <div style={{ display: 'flex', gap: 8, background: '#F4F7F6', borderRadius: 12, padding: '10px 12px', alignItems: 'flex-start' }}>
                <span style={{ flex: 'none', marginTop: 2 }}><Svg d={I.lock} size={16} color={C.muted} /></span>
                <span style={{ fontSize: 12.5, color: '#3E4F4C', lineHeight: 1.45 }}>{[next.access_instructions, next.pets].filter(Boolean).join(' · ')}</span>
              </div>
            )}
            <div className="k-pair">
              <button className="k-btn k-btn-line" style={{ gap: 6 }} onClick={() => openStop(next)}>
                <Svg d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" size={16} w={2.2} />{store.get('tidyo.navApp') ? appName : t('nv.go')}
              </button>
              <button className="k-btn k-btn-fill" disabled={busy} onClick={checkIn}>{t('nv.arrived')}</button>
            </div>
            {store.get('tidyo.navApp') && <button className="k-link" style={{ alignSelf: 'center' }} onClick={() => setSheet(next)}>{t('nv.changeApp')}</button>}
          </div>
        )}

        {ordered.length > 0 && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="k-sec"><span>{t('nv.stops')}</span>{dist != null && <span className="k-s125 k-muted nw">≈ {miles(dist).toFixed(0)} mi · {driveMin(dist)} min</span>}</div>
            <div className="k-card" style={{ padding: '2px 12px', gap: 0 }}>
              {ordered.map((j, i) => {
                const done = j.status === 'completed', now = j.status === 'in_progress', isNext = next?.job_id === j.job_id;
                return (
                  <div key={j.job_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: i ? `1px solid ${C.soft}` : 0, opacity: done ? 0.6 : 1 }}>
                    <span className="num" style={{ width: 28, height: 28, borderRadius: 28, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12.5, fontWeight: 800, background: done ? '#DDF1EC' : isNext || now ? C.accent : '#EEF1F0', color: done ? C.accent : isNext || now ? '#FFFFFF' : '#3E4F4C' }}>
                      {done ? <Svg d={I.check} size={14} color={C.accent} w={3} /> : i + 1}
                    </span>
                    <span style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                      <b className="k-ell" style={{ fontSize: 14 }}>{j.client_name}</b>
                      <span className="k-ell" style={{ fontSize: 12, color: C.muted }}>{hm(j.scheduled_start, lang)} · {j.address_line1}, {j.city}</span>
                    </span>
                    {!done && <button className="k-iconbtn" style={{ borderRadius: 12 }} aria-label={t('nv.openStop', { name: j.client_name })} onClick={() => openStop(j)}><Svg d="M3 11l18-8-8 18-2-8z" size={18} color={C.accent} w={2} /></button>}
                  </div>
                );
              })}
            </div>
            {remaining.length > 1 && <a className="k-btn k-btn-line" href={fullRouteUrl(remaining)} target="_blank" rel="noreferrer" style={{ gap: 6 }}><Svg d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z M9 3v15 M15 6v15" size={16} w={2} />{t('nv.fullRoute')}</a>}
          </section>
        )}
      </main>

      {sheet && (
        <Sheet title={t('nv.whichApp')} onClose={() => setSheet(null)}>
          <span style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.5 }}>{t('nv.whichText')}</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {APPS.map((a) => {
              const on = a.id === app;
              return (
                <button key={a.id} aria-pressed={on} onClick={() => setApp(a.id)}
                  style={{ minHeight: 58, borderRadius: 14, border: `1px solid ${on ? C.accent : C.line}`, background: on ? '#F0F9F7' : '#FFFFFF', display: 'flex', alignItems: 'center', gap: 12, padding: '0 14px', cursor: 'pointer', color: C.ink, textAlign: 'left', fontFamily: 'inherit' }}>
                  <span style={{ width: 36, height: 36, borderRadius: 10, background: a.color, color: '#FFFFFF', fontWeight: 800, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>{a.short}</span>
                  <span style={{ display: 'flex', flexDirection: 'column', flex: 1 }}><span style={{ fontWeight: 800, fontSize: 14.5 }}>{a.name}</span><span style={{ fontSize: 12, color: C.muted }}>{t(`nv.${a.id}Note`)}</span></span>
                  {on && <Svg d={I.check} size={20} color={C.accent} w={2.6} />}
                </button>
              );
            })}
          </div>
          <label className="check" style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, fontWeight: 600, minHeight: 44, cursor: 'pointer' }}>
            <input type="checkbox" checked={remember} onChange={() => setRemember(!remember)} />{t('nv.remember')}
          </label>
          <div className="k-pair">
            <button className="k-btn k-btn-line" onClick={() => setSheet(null)}>{t('c.cancel')}</button>
            <button className="k-btn k-btn-fill" onClick={confirmApp}>{t('nv.open', { app: appName })}</button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
