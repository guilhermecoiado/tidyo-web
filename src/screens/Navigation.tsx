// Navegação (canvas "Navegacao"): the helper's next stop, with directions, check-in and hand-off to Google Maps / Waze / Apple Maps.
// Owners open the same screen as a preview of what a helper receives (/app/rotas/navegacao?m=…&d=…).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useApp } from '../lib/session';
import { Sheet } from '../components/ui';
import { C, I, Svg, hm } from '../components/kit';
import { addDays, startOfDay } from '../lib/format';
import { MAPS_ON, driveMin, km, loadMaps, miles, pt, type Pt } from '../lib/route';
import { perform } from '../lib/offline';

type NJob = { job_id: string; status: string; scheduled_start: string; route_position: number | null; client_name: string; address_line1: string; city: string; state: string; zip: string;
  lat: number | null; lng: number | null; access_instructions: string | null; pets: string | null };
type Step = { dist: string; text: string; min: number | null; mi: number | null; turn?: boolean };

const APPS = [
  { id: 'gmaps', name: 'Google Maps', short: 'G', color: '#1A73E8' },
  { id: 'waze', name: 'Waze', short: 'W', color: '#1F8FB5' },
  { id: 'apple', name: 'Apple Maps', short: 'A', color: '#3E4F4C' },
] as const;
type AppId = typeof APPS[number]['id'];
const store = { get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* blocked */ } } };
const strip = (html: string) => { const d = document.createElement('div'); d.innerHTML = html; return (d.textContent || '').replace(/\s+/g, ' ').trim(); };
const speechLang: Record<string, string> = { 'pt-BR': 'pt-BR', en: 'en-US', es: 'es-US' };

export default function Navigation() {
  const { t, lang, membership, toast, tErr } = useApp();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const previewOf = params.get('m');
  const day = useMemo(() => { const d = params.get('d'); return d ? startOfDay(new Date(d + 'T12:00')) : startOfDay(new Date()); }, [params]);
  const [jobs, setJobs] = useState<NJob[] | null>(null);
  const [name, setName] = useState('');
  const [pos, setPos] = useState<Pt | null>(null);
  const [step, setStep] = useState<Step | null>(null);
  const [muted, setMuted] = useState(store.get('tidyo.navMuted') === '1');
  const [sheet, setSheet] = useState(false);
  const [app, setApp] = useState<AppId>((store.get('tidyo.navApp') as AppId) || 'gmaps');
  const [remember, setRemember] = useState(true);
  const [arrived, setArrived] = useState<{ at: string; ok: boolean; job: NJob } | null>(null);
  const [busy, setBusy] = useState(false);
  const recenter = useRef<() => void>(() => undefined);

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

  // live position (the helper's phone); the preview starts from the previous stop
  useEffect(() => {
    if (previewOf || !navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition((p) => setPos({ lat: p.coords.latitude, lng: p.coords.longitude }), () => undefined, { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 });
    return () => navigator.geolocation.clearWatch(id);
  }, [previewOf]);

  const ordered = useMemo(() => (jobs || []).slice().sort((a, b) => (a.route_position ?? 99) - (b.route_position ?? 99) || a.scheduled_start.localeCompare(b.scheduled_start)), [jobs]);
  const idx = ordered.findIndex((j) => j.status === 'scheduled');
  const next = idx >= 0 ? ordered[idx] : null;
  const prev = idx > 0 ? ordered[idx - 1] : null;
  const from = useMemo(() => pos || (prev && pt(prev)) || null, [pos, prev]);
  const to = useMemo(() => (next && pt(next)) || null, [next]);
  const setRecenter = useCallback((f: () => void) => { recenter.current = f; }, []);
  const fullAddr = next ? `${next.address_line1}, ${next.city}, ${next.state}` : '';
  const tidyRoute = ordered.some((j) => j.route_position != null);

  // first instruction: Google Directions when the map key is set; otherwise distance and heading to the address
  useEffect(() => {
    if (!next) { setStep(null); return; }
    const d = from && to ? km(from, to) : null;
    const fallback: Step = { dist: d != null ? `${miles(d).toFixed(1)} mi` : hm(next.scheduled_start, lang), text: t('nv.headTo', { addr: next.address_line1 }), min: d != null ? Math.max(1, driveMin(d)) : null, mi: d != null ? miles(d) : null };
    setStep(fallback);
    if (!from || !to) return;
    let off = false;
    loadMaps().then((ok) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const gm = ok ? (window as any).google?.maps : null;
      if (!gm?.DirectionsService) return;
      new gm.DirectionsService().route({ origin: from, destination: to, travelMode: gm.TravelMode.DRIVING }, (r: { routes: { legs: { distance: { value: number }; duration: { value: number }; steps: { distance: { text: string }; instructions: string }[] }[] }[] } | null, status: string) => {
        if (off || status !== 'OK' || !r) return;
        const leg = r.routes[0].legs[0], s = leg.steps[0];
        setStep({ turn: true, dist: s.distance.text, text: strip(s.instructions), min: Math.round(leg.duration.value / 60), mi: leg.distance.value / 1609.34 });
      });
    });
    return () => { off = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [next?.job_id, from?.lat, from?.lng, lang]);

  // voice: read the instruction when it changes
  const said = useRef('');
  useEffect(() => {
    if (!MAPS_ON || muted || previewOf || !step || said.current === step.text || !('speechSynthesis' in window)) return;
    said.current = step.text;
    const u = new SpeechSynthesisUtterance(`${step.dist}. ${step.text}`); u.lang = speechLang[lang] || 'en-US';
    window.speechSynthesis.cancel(); window.speechSynthesis.speak(u);
  }, [step, muted, previewOf, lang]);

  const toggleMute = () => { const m = !muted; setMuted(m); store.set('tidyo.navMuted', m ? '1' : '0'); if (m && 'speechSynthesis' in window) window.speechSynthesis.cancel(); };

  const openApp = () => {
    if (!next) return;
    if (remember) store.set('tidyo.navApp', app);
    const q = encodeURIComponent(`${next.address_line1}, ${next.city}, ${next.state} ${next.zip}`);
    const url = app === 'waze' ? (to ? `https://waze.com/ul?ll=${to.lat},${to.lng}&navigate=yes` : `https://waze.com/ul?q=${q}&navigate=yes`)
      : app === 'apple' ? `https://maps.apple.com/?daddr=${q}&dirflg=d`
        : `https://www.google.com/maps/dir/?api=1&destination=${q}&travelmode=driving`;
    setSheet(false);
    window.open(url, '_blank', 'noopener');
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
  const ctl = { width: 44, height: 44, borderRadius: 14, border: 0, background: '#FFFFFF', boxShadow: '0 2px 8px rgba(0,0,0,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 } as const;

  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', color: C.ink, fontFamily: "Manrope, 'Segoe UI', sans-serif", fontSize: 14, backgroundColor: '#E9F0EE' }}>
      <NavMap from={from} to={to} n={idx + 1} label={next?.client_name || ''} onRecenter={setRecenter} />

      <div style={{ position: 'absolute', left: 12, right: 12, top: 'calc(12px + env(safe-area-inset-top))', background: C.ink, color: '#FFFFFF', borderRadius: 18, padding: 14, display: 'flex', gap: 12, alignItems: 'center', boxShadow: '0 8px 24px rgba(0,0,0,0.25)', maxWidth: 560, margin: '0 auto' }}>
        <div style={{ width: 48, height: 48, flex: 'none', borderRadius: 14, background: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Svg d={!next ? I.check : step?.turn ? 'M6 20V11a3 3 0 0 1 3-3h9M14 4l4 4-4 4' : 'M12 20V5M6 11l6-6 6 6'} size={26} color="#FFFFFF" w={2.4} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <span className="num nw" style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 22, fontWeight: 700 }}>{jobs === null ? '…' : next ? step?.dist || '' : t('nv.doneT')}</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#C7D8D4', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{jobs === null ? t('c.loading') : next ? (MAPS_ON ? step?.text : t('nv.soonText')) : t('nv.doneS')}</span>
          {!MAPS_ON && next && <span style={{ alignSelf: 'flex-start', marginTop: 4, fontSize: 10.5, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#0A3D35', background: '#5FD4C1', borderRadius: 6, padding: '3px 7px' }}>{t('c.soon')}</span>}
        </div>
      </div>

      <div style={{ position: 'absolute', right: 12, top: 'calc(116px + env(safe-area-inset-top))', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button style={ctl} aria-label={t('c.close')} onClick={close}><Svg d={I.x} size={20} color={C.ink} /></button>
        <button style={ctl} aria-label={t('nv.center')} onClick={() => recenter.current()}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.ink} strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></svg>
        </button>
        {MAPS_ON && <button style={ctl} aria-label={muted ? t('nv.voiceOn') : t('nv.voiceOff')} aria-pressed={!muted} onClick={toggleMute}>
          <Svg d={muted ? 'M11 5 6 9H3v6h3l5 4zM22 9l-6 6M16 9l6 6' : 'M11 5 6 9H3v6h3l5 4zM15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14'} size={20} color={C.ink} />
        </button>}
      </div>
      {previewOf && name && <span style={{ position: 'absolute', left: 12, top: 'calc(108px + env(safe-area-inset-top))', background: '#FFFFFF', borderRadius: 10, padding: '6px 10px', fontSize: 11.5, fontWeight: 800, color: '#3E4F4C', boxShadow: '0 2px 6px rgba(0,0,0,0.1)' }}>{t('nv.preview', { name })}</span>}

      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, background: '#FFFFFF', borderRadius: '24px 24px 0 0', padding: '10px 16px calc(22px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 12, boxShadow: '0 -8px 24px rgba(0,0,0,0.12)' }}>
        <div style={{ width: 40, height: 4, borderRadius: 4, background: C.line, alignSelf: 'center' }} />
        <div style={{ width: '100%', maxWidth: 528, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {arrived ? (
            <>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <div style={{ width: 40, height: 40, borderRadius: 40, background: '#DDF1EC', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><Svg d={I.check} size={20} color={C.accent} w={2.6} /></div>
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 18, fontWeight: 700 }}>{t('nv.checkedIn', { t: hm(arrived.at, lang) })}</span>
                  <span style={{ fontSize: 12.5, color: C.muted }}>{arrived.ok ? t('nv.locOk', { name: arrived.job.client_name }) : t('nv.locNo')}</span>
                </div>
              </div>
              <div className="k-pair">
                <button className="k-btn k-btn-line" style={{ minHeight: 50 }} onClick={() => setArrived(null)}>{t('nv.backToRoute')}</button>
                <button className="k-btn k-btn-fill" style={{ minHeight: 50 }} onClick={() => nav(`/dia/servico/${arrived.job.job_id}`)}>{t('nv.checklist')}</button>
              </div>
            </>
          ) : jobs === null ? (
            <div className="skeleton" style={{ height: 150, borderRadius: 16 }} />
          ) : !next ? (
            <>
              <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 20, fontWeight: 700 }}>{ordered.length ? t('nv.allDone') : t('nv.noStops')}</span>
              <button className="k-btn k-btn-fill" style={{ minHeight: 50 }} onClick={close}>{t('c.back')}</button>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('nv.stopOf', { n: idx + 1, total: ordered.length })}</span>
                {tidyRoute && <span style={{ fontSize: 12, fontWeight: 700, color: '#0B6B5F', background: '#DDF1EC', borderRadius: 999, padding: '3px 9px', whiteSpace: 'nowrap' }}>{t('nv.tidyRoute')}</span>}
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
                  <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 20, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{next.client_name}</span>
                  <span style={{ fontSize: 13, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fullAddr}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flex: 'none' }}>
                  <span className="num nw" style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 20, fontWeight: 700, color: C.accent }}>{hm(next.scheduled_start, lang)}</span>
                  {step?.min != null && step.mi != null && <span className="num nw" style={{ fontSize: 12, color: C.muted }}>{step.min} min · {step.mi.toFixed(1)} mi</span>}
                </div>
              </div>
              {(next.access_instructions || next.pets) && (
                <div style={{ display: 'flex', gap: 8, background: '#F4F7F6', borderRadius: 12, padding: '10px 12px', alignItems: 'flex-start' }}>
                  <span style={{ flex: 'none', marginTop: 2 }}><Svg d={I.lock} size={16} color={C.muted} /></span>
                  <span style={{ fontSize: 12.5, color: '#3E4F4C', lineHeight: 1.45 }}>{[next.access_instructions, next.pets].filter(Boolean).join(' · ')}</span>
                </div>
              )}
              <div className="k-pair">
                <button className="k-btn k-btn-line" style={{ minHeight: 50, gap: 6, padding: '0 10px', whiteSpace: 'nowrap' }} onClick={() => setSheet(true)}>
                  <Svg d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" size={16} w={2.2} />{t('nv.otherApp')}
                </button>
                <button className="k-btn k-btn-fill" style={{ minHeight: 50 }} disabled={busy} onClick={checkIn}>{t('nv.arrived')}</button>
              </div>
            </>
          )}
        </div>
      </div>

      {sheet && next && (
        <Sheet title={t('nv.whichApp')} onClose={() => setSheet(false)}>
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
            <button className="k-btn k-btn-line" onClick={() => setSheet(false)}>{t('nv.stay')}</button>
            <button className="k-btn k-btn-fill" onClick={openApp}>{t('nv.open', { app: APPS.find((a) => a.id === app)!.name })}</button>
          </div>
        </Sheet>
      )}
    </div>
  );
}

/** Google map following the phone when the key is set; otherwise the canvas' illustrative map */
function NavMap({ from, to, n, label, onRecenter }: { from: Pt | null; to: Pt | null; n: number; label: string; onRecenter: (f: () => void) => void }) {
  const { t } = useApp();
  const el = useRef<HTMLDivElement>(null);
  const [g, setG] = useState<boolean | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ref = useRef<{ map: any; me: any; dest: any; line: any } | null>(null);
  useEffect(() => { loadMaps().then(setG); }, []);

  useEffect(() => {
    if (!g || !el.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gm = (window as any).google.maps;
    if (!ref.current) {
      const map = new gm.Map(el.current, { center: to || from || { lat: 41.5582, lng: -73.0515 }, zoom: 14, disableDefaultUI: true, clickableIcons: false, gestureHandling: 'greedy' });
      ref.current = { map, me: new gm.Marker({ map, icon: { path: gm.SymbolPath.CIRCLE, scale: 8, fillColor: C.accent, fillOpacity: 1, strokeColor: '#FFFFFF', strokeWeight: 3 } }),
        dest: new gm.Marker({ map, icon: { path: gm.SymbolPath.CIRCLE, scale: 14, fillColor: C.accent, fillOpacity: 1, strokeColor: '#FFFFFF', strokeWeight: 3 }, label: { text: String(n), color: '#FFFFFF', fontWeight: '800' } }),
        line: new gm.Polyline({ map, strokeColor: C.accent, strokeWeight: 6, strokeOpacity: 0.9 }) };
    }
    const r = ref.current;
    r.me.setPosition(from); r.dest.setPosition(to); r.dest.setLabel({ text: String(n), color: '#FFFFFF', fontWeight: '800' }); r.line.setPath(from && to ? [from, to] : []);
    const fit = () => { if (from && to) { const b = new gm.LatLngBounds(); b.extend(from); b.extend(to); r.map.fitBounds(b, { top: 140, bottom: 300, left: 40, right: 70 }); } else if (from || to) r.map.panTo(from || to); };
    fit(); onRecenter(fit);
  }, [g, from, to, n, onRecenter]);

  if (g) return <div ref={el} style={{ position: 'absolute', inset: 0 }} role="img" aria-label={t('nv.mapAria')} />;
  return (
    <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(#DCE6E3 1px, transparent 1px), linear-gradient(90deg, #DCE6E3 1px, transparent 1px)', backgroundSize: '32px 32px' }}>
      <svg width="100%" height="100%" viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice" role="img" aria-label={t('nv.mapAria')} style={{ position: 'absolute', inset: 0 }}>
        <path d="M-10 610 C 80 590, 150 640, 400 600" fill="none" stroke="#FFFFFF" strokeWidth="14" />
        <path d="M120 860 C 140 700, 160 520, 210 300 S 260 80, 300 -20" fill="none" stroke="#FFFFFF" strokeWidth="16" />
        <path d="M-10 330 C 120 340, 260 300, 400 340" fill="none" stroke="#FFFFFF" strokeWidth="11" />
        <path d="M330 860 C 320 700, 350 500, 400 420" fill="none" stroke="#FFFFFF" strokeWidth="9" />
        <path d="M40 -10 C 60 120, 30 220, 60 330" fill="none" stroke="#FFFFFF" strokeWidth="8" />
        <rect x="236" y="160" width="70" height="46" rx="6" fill="#D5E6DC" />
        <rect x="60" y="420" width="54" height="70" rx="6" fill="#D5E6DC" />
        {to && <>
          <path d="M150 700 C 160 600, 172 520, 200 400 C 212 345, 230 330, 268 326" fill="none" stroke={C.accent} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="150" cy="700" r="16" fill={C.accent} opacity="0.18" />
          <circle cx="150" cy="700" r="8" fill={C.accent} stroke="#FFFFFF" strokeWidth="3" />
          <circle cx="269" cy="324" r="14" fill={C.accent} stroke="#FFFFFF" strokeWidth="3" />
          <text x="269" y="329" textAnchor="middle" fontSize="13" fontWeight="800" fill="#FFFFFF" fontFamily="Manrope, sans-serif">{n}</text>
          {label && <g><rect x={269 - Math.min(150, label.length * 6.4 + 16) / 2} y="266" width={Math.min(150, label.length * 6.4 + 16)} height="22" rx="8" fill="#FFFFFF" /><text x="269" y="281" textAnchor="middle" fontSize="11.5" fontWeight="800" fill={C.ink} fontFamily="Manrope, sans-serif">{label.length > 22 ? label.slice(0, 21) + '…' : label}</text></g>}
        </>}
      </svg>
      <span style={{ position: 'absolute', left: 12, top: 'calc(156px + env(safe-area-inset-top))', background: '#FFFFFF', borderRadius: 10, padding: '6px 10px', fontSize: 11.5, fontWeight: 700, color: '#3E4F4C', boxShadow: '0 2px 6px rgba(0,0,0,0.08)' }}>{t('ro.illustrative')}</span>
    </div>
  );
}
