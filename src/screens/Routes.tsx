// Rotas (canvas "Rotas"): the best order of each helper's day, with time windows, origin choice and manual adjustment
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useApp } from '../lib/session';
import { Sheet } from '../components/ui';
import { C, Empty, Head, I, Segment, Svg, SPARK, colorOf, dur, hm, initials } from '../components/kit';
import { memberIndex, type Member } from '../lib/data';
import { addDays, isoDate, startOfDay } from '../lib/format';
import { driveMin, km, loadMaps, miles, optimize, pt, type Pt } from '../lib/route';
import { MonthGrid } from './Agenda';

type Stop = { id: string; client: string; kind: string; addr: string; lat: number | null; lng: number | null; property_id: string; dur: number; after: number | null; start: number };
type M = Member & { origin_lat: number | null; origin_lng: number | null };
type Origin = { key: 'casa' | 'empresa'; label: string; addr: string; p: Pt | null };
type Metrics = { travel: number; idle: number; legs: { leg: number | null; arr: number; wait: number }[]; back: number; end: number; dist: number; score: number };

const minOfDay = (iso: string) => { const d = new Date(iso); return d.getHours() * 60 + d.getMinutes(); };
const legMin = (a: Pt | null, b: Pt | null) => (a && b ? Math.max(4, driveMin(km(a, b))) : null);

/** Travel, waiting for the client's window, arrival at each stop and the return home */
function metrics(origin: Pt | null, list: Stop[], leave: number): Metrics {
  let t = leave, travel = 0, idle = 0, dist = 0;
  let prev: Pt | null = origin;
  const legs: Metrics['legs'] = [];
  list.forEach((s, i) => {
    const p = pt(s);
    const m = i === 0 && !origin ? 0 : legMin(prev, p);
    if (m != null) { t += m; travel += m; if (prev && p) dist += km(prev, p); }
    let wait = 0;
    if (s.after != null && t < s.after) { wait = s.after - t; idle += wait; t = s.after; }
    legs.push({ leg: i === 0 && !origin ? null : m, arr: t, wait });
    t += s.dur; prev = p || prev;
  });
  const back = legMin(prev, origin) ?? 0;
  if (prev && origin) dist += km(prev, origin);
  travel += back;
  return { travel, idle, legs, back, end: t + back, dist, score: travel + idle * 0.6 };
}

function perms<T>(a: T[]): T[][] {
  if (a.length <= 1) return [a.slice()];
  const out: T[][] = [];
  a.forEach((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).forEach((p) => out.push([x, ...p])));
  return out;
}

/** Best order: every permutation up to 7 stops (windows included), nearest neighbour + 2-opt above that */
function best(origin: Pt | null, stops: Stop[], leave: number) {
  const located = stops.filter((s) => pt(s)), rest = stops.filter((s) => !pt(s));
  if (located.length <= 7) {
    let b: Stop[] = located, bm = metrics(origin, located, leave);
    for (const p of perms(located)) { const m = metrics(origin, p, leave); if (m.score < bm.score) { b = p; bm = m; } }
    return [...b, ...rest];
  }
  return optimize(origin, stops, true);
}

export default function RoutesScreen() {
  const { t, lang, company, toast, tErr } = useApp();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const day = useMemo(() => { const d = params.get('d'); return d ? startOfDay(new Date(d + 'T12:00')) : addDays(startOfDay(new Date()), 1); }, [params]);
  const [members, setMembers] = useState<M[]>([]);
  const [stops, setStops] = useState<Record<string, Stop[]> | null>(null);
  const [plans, setPlans] = useState<Record<string, string[]>>({});
  const [hid, setHid] = useState<string | null>(params.get('m'));
  const [originPick, setOriginPick] = useState<Record<string, 'casa' | 'empresa'>>({});
  const [manual, setManual] = useState(false);
  const [order, setOrder] = useState<Record<string, string[] | null>>({});
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cal, setCal] = useState(false);
  const [calMonth, setCalMonth] = useState(day);
  const [locating, setLocating] = useState(false);

  const load = useCallback(async () => {
    if (!company) return;
    const [ms, js, rp] = await Promise.all([
      supabase.from('memberships').select('id, display_name, role, status, language, user_id, gender, origin_address, origin_lat, origin_lng, created_at').eq('company_id', company.id).in('status', ['active', 'invited']),
      supabase.from('jobs').select('id, status, scheduled_start, scheduled_end, property_id, clients(name, kind), properties(address_line1, city, lat, lng, arrive_after), job_assignments(membership_id)')
        .eq('company_id', company.id).eq('status', 'scheduled').gte('scheduled_start', day.toISOString()).lt('scheduled_start', addDays(day, 1).toISOString()).order('scheduled_start'),
      supabase.from('route_plans').select('membership_id, job_order').eq('company_id', company.id).eq('plan_date', isoDate(day)),
    ]);
    setMembers((ms.data || []) as M[]);
    const by: Record<string, Stop[]> = {};
    for (const j of (js.data || []) as unknown as { id: string; scheduled_start: string; scheduled_end: string; property_id: string; clients: { name: string; kind: string } | null; properties: { address_line1: string; city: string; lat: number | null; lng: number | null; arrive_after: string | null } | null; job_assignments: { membership_id: string }[] }[]) {
      const after = j.properties?.arrive_after ? Number(j.properties.arrive_after.slice(0, 2)) * 60 + Number(j.properties.arrive_after.slice(3, 5)) : null;
      const s: Stop = { id: j.id, client: j.clients?.name || '', kind: j.clients?.kind || 'residential', addr: [j.properties?.address_line1, j.properties?.city].filter(Boolean).join(', '),
        lat: j.properties?.lat ?? null, lng: j.properties?.lng ?? null, property_id: j.property_id, dur: Math.max(15, Math.round((+new Date(j.scheduled_end) - +new Date(j.scheduled_start)) / 60000)), after, start: minOfDay(j.scheduled_start) };
      for (const a of j.job_assignments) (by[a.membership_id] = by[a.membership_id] || []).push(s);
    }
    setStops(by);
    setPlans(Object.fromEntries(((rp.data || []) as { membership_id: string; job_order: string[] }[]).map((p) => [p.membership_id, p.job_order])));
  }, [company, day]);
  useEffect(() => { setStops(null); load(); }, [load]);

  const helpers = useMemo(() => members.filter((m) => stops?.[m.id]?.length).sort((a, b) => memberIndex(members, a.id) - memberIndex(members, b.id)), [members, stops]);
  const h = helpers.find((m) => m.id === hid) || helpers[0];
  const color = h ? colorOf(memberIndex(members, h.id))[0] : C.accent;
  const first = h ? h.display_name.split(' ')[0] : '';

  const origins: Origin[] = h ? [
    { key: 'casa', label: t('ro.home'), addr: h.origin_address || t('ro.noHome'), p: h.origin_lat != null && h.origin_lng != null ? { lat: h.origin_lat, lng: h.origin_lng } : null },
    { key: 'empresa', label: t('ro.office'), addr: company?.address || t('ro.noOffice'), p: company?.lat != null && company?.lng != null ? { lat: company.lat, lng: company.lng } : null },
  ] : [];
  const mainKey: 'casa' | 'empresa' = origins[0]?.p || !origins[1]?.p ? 'casa' : 'empresa';
  const oKey = (h && originPick[h.id]) || mainKey;
  const origin = origins.find((o) => o.key === oKey) || null;
  const op = origin?.p || null;

  const calc = useMemo(() => {
    if (!h || !stops) return null;
    const list = stops[h.id] || [];
    const booked = [...list].sort((a, b) => a.start - b.start);
    // leaves so that the first booked visit starts on time
    const firstLeg = legMin(op, pt(booked[0])) ?? 0;
    const leave = Math.max(5 * 60, Math.floor((booked[0].start - firstLeg) / 5) * 5);
    const sug = best(op, booked, leave);
    const sugIds = sug.map((s) => s.id);
    const byId = Object.fromEntries(list.map((s) => [s.id, s]));
    const curIds = manual ? (order[h.id] || plans[h.id]?.filter((id) => byId[id]) || sugIds) : sugIds;
    const cur = [...curIds.map((id) => byId[id]).filter(Boolean), ...list.filter((s) => !curIds.includes(s.id))];
    return { leave, sug, sugIds, cur, m: metrics(op, cur, leave), bm: metrics(op, sug, leave), booked: metrics(op, booked, leave), differs: cur.map((s) => s.id).join() !== sugIds.join(), missing: list.filter((s) => !pt(s)) };
  }, [h, stops, op, manual, order, plans]);

  const clock = (m: number) => hm(new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(m / 60), m % 60), lang);
  const applied = !!(h && calc && plans[h.id] && plans[h.id].join() === calc.cur.map((s) => s.id).join());
  const setCur = (ids: string[] | null) => h && setOrder({ ...order, [h.id]: ids });
  const swap = (i: number, j: number) => { if (!calc) return; const ids = calc.cur.map((s) => s.id); [ids[i], ids[j]] = [ids[j], ids[i]]; setCur(ids); };

  const title = (() => {
    const today = startOfDay(new Date()).getTime();
    if (day.getTime() === today) return t('ro.today');
    if (day.getTime() === addDays(startOfDay(new Date()), 1).getTime()) return t('ro.tomorrow');
    return t('ro.title');
  })();
  const dateText = day.toLocaleDateString(lang, { weekday: 'short', day: 'numeric', month: 'long' }).replace('.', '');
  const pickDay = (d: Date) => { setCal(false); setOrder({}); setManual(false); const p = new URLSearchParams(params); p.set('d', isoDate(d)); setParams(p, { replace: true }); };

  const locate = async () => {
    if (!calc) return;
    setLocating(true);
    const { data, error } = await supabase.functions.invoke('geocode', { body: { table: 'properties', ids: [...new Set(calc.missing.map((s) => s.property_id))] } });
    setLocating(false);
    if (error || data?.error) toast(data?.error === 'maps_not_configured' ? t('rt.noKey') : t('c.error')); else load();
  };

  const apply = async () => {
    if (!h || !calc) return;
    setBusy(true);
    const at = (m: number) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(m / 60), m % 60).toISOString();
    const { error } = await supabase.rpc('apply_route_times', { p_membership: h.id, p_date: isoDate(day), p_order: calc.cur.map((s) => s.id), p_starts: calc.m.legs.map((l) => at(l.arr)),
      p_minutes_before: calc.m.legs[0]?.leg || 0, p_minutes_after: calc.m.back });
    setBusy(false); setAsk(false);
    if (error) { toast(tErr(error.message)); return; }
    setManual(false); setOrder({ ...order, [h.id]: null });
    load();
  };

  let banner = '', warm = false;
  if (calc) {
    if (calc.cur.length < 2) banner = t('ro.single');
    else if (manual && calc.differs) {
      const d = calc.m.travel - calc.bm.travel, w = calc.m.idle - calc.bm.idle;
      banner = d > 0 ? t('ro.worse', { n: d, wait: w > 0 ? t('ro.andWait', { d: dur(w) }) : '' }) : w > 0 ? t('ro.equalWait', { d: dur(w) }) : t('ro.equal');
      warm = true;
    } else {
      const saved = calc.booked.travel - calc.bm.travel;
      banner = saved > 0 ? t('ro.saved', { n: saved }) : t('ro.best');
    }
  }
  const houses = calc?.cur.every((s) => s.kind !== 'commercial');

  return (
    <div className="k-screen">
      <main className="k-page nobar" style={{ gap: 14 }}>
        <Head back={() => (window.history.length > 1 ? nav(-1) : nav('/app/agenda'))} title={title}
          sub={<button onClick={() => { setCalMonth(day); setCal(true); }} aria-label={t('ag.pickDate')} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'none', border: 0, padding: 0, minHeight: 24, cursor: 'pointer', font: 'inherit', color: 'inherit', whiteSpace: 'nowrap' }}>
            <Svg d={I.cal} size={13} color={C.accent} />{dateText}{calc ? ` · ${t('ro.leaves', { t: clock(calc.leave) })}` : ''}
          </button>} />

        {stops === null ? <RoutesSkeleton /> : !helpers.length ? (
          <Empty title={t('ro.empty')} text={t('ro.emptyText')} action={<Link className="k-btn k-btn-line" to="/app/agenda">{t('nav.schedule')}</Link>} />
        ) : h && calc && (
          <>
            <div role="group" aria-label={t('ro.helper')} style={{ display: 'flex', gap: 8, overflowX: helpers.length > 3 ? 'auto' : undefined, paddingBottom: helpers.length > 3 ? 6 : 0 }}>
              {helpers.map((m) => {
                const on = m.id === h.id;
                return (
                  <button key={m.id} aria-pressed={on} onClick={() => { setHid(m.id); setAsk(false); }}
                    style={{ flex: helpers.length > 3 ? '0 0 auto' : 1, minWidth: 0, minHeight: 46, padding: '0 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 14, border: `1px solid ${on ? C.ink : C.line}`, background: on ? C.ink : '#FFFFFF', color: on ? '#FFFFFF' : C.ink, fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                    <span style={{ width: 22, height: 22, borderRadius: 22, flex: 'none', background: colorOf(memberIndex(members, m.id))[0], color: '#FFFFFF', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{initials(m.display_name)}</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.display_name.split(' ')[0]}</span>
                  </button>
                );
              })}
            </div>

            <div style={{ background: '#FFFFFF', border: `1px solid ${C.line}`, borderRadius: 18, overflow: 'hidden' }}>
              <RouteMap origin={op} stops={calc.cur} color={color} dashed={manual && calc.differs} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', borderTop: `1px solid ${C.line}` }}>
                {[[t('ro.travel'), dur(calc.m.travel)], [t('ro.distance'), `${Math.round(miles(calc.m.dist))} mi`], [t('ro.ends'), clock(calc.m.end)]].map(([k, v], i) => (
                  <div key={k} style={{ padding: '12px 10px 12px 12px', display: 'flex', flexDirection: 'column', gap: 2, borderRight: i < 2 ? `1px solid ${C.line}` : 0, minWidth: 0 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.03em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k}</span>
                    <span className="num nw" style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 20, fontWeight: 700 }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>

            {calc.missing.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#FDF0DC', color: '#6B3A04', borderRadius: 14, padding: '10px 12px 10px 14px' }}>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600, lineHeight: 1.45 }}>{t('rt.missing', { n: calc.missing.length })}</span>
                <button className="k-btn k-btn-line" style={{ flex: 'none', minHeight: 40 }} disabled={locating} onClick={locate}>{t('rt.locate')}</button>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: warm ? '#FDF0DC' : C.ink, color: warm ? '#6B3A04' : '#EAF3F1', borderRadius: 14, padding: '12px 14px' }}>
              <span style={{ flex: 'none', marginTop: 1 }}><Svg d={SPARK} size={18} /></span>
              <span style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.45 }}>{banner}</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('ro.startOf', { name: first })}</span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                {origins.map((o) => {
                  const on = o.key === oKey;
                  return (
                    <button key={o.key} aria-pressed={on} onClick={() => { setOriginPick({ ...originPick, [h.id]: o.key }); setCur(null); }}
                      style={{ minHeight: 56, minWidth: 0, textAlign: 'left', borderRadius: 14, border: `1px solid ${on ? C.accent : C.line}`, background: on ? '#F0F9F7' : '#FFFFFF', padding: '9px 12px', display: 'flex', flexDirection: 'column', gap: 2, cursor: 'pointer', color: C.ink, fontFamily: 'inherit' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800, fontSize: 13 }}>{o.label}{o.key === mainKey && <span style={{ fontSize: 10, fontWeight: 800, color: '#0B6B5F', background: '#DDF1EC', borderRadius: 6, padding: '1px 6px' }}>{t('ro.main')}</span>}</span>
                      <span style={{ fontSize: 11.5, color: o.p ? C.muted : '#8A4B05', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{o.addr}</span>
                    </button>
                  );
                })}
              </div>
              {!op && <span style={{ fontSize: 12, color: C.muted, lineHeight: 1.45 }}>{t('ro.noOrigin')} <Link to={oKey === 'casa' ? '/app/mais/equipe' : '/app/mais/empresa'}>{t('ro.setIt')}</Link></span>}
            </div>

            <Segment value={manual ? 'manual' : 'tidy'} onChange={(v) => setManual(v === 'manual')} label={t('ro.mode')} options={[{ value: 'tidy', label: t('ro.suggested') }, { value: 'manual', label: t('ro.adjust') }]} />

            <div style={{ display: 'flex', flexDirection: 'column', background: '#FFFFFF', border: `1px solid ${C.line}`, borderRadius: 18, padding: '4px 12px' }}>
              {origin && (
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 0' }}>
                  <span style={{ width: 26, height: 26, borderRadius: 8, background: C.ink, flex: 'none' }} />
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                    <span style={{ fontWeight: 700, fontSize: 13.5 }}>{t('ro.leave', { o: origin.label })}</span>
                    <span style={{ fontSize: 12, color: C.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{origin.addr}</span>
                  </div>
                  <span className="num nw" style={{ fontWeight: 800, fontSize: 13 }}>{clock(calc.leave)}</span>
                </div>
              )}
              {calc.cur.map((s, i) => {
                const L = calc.m.legs[i];
                return (
                  <div key={s.id} style={{ display: 'flex', flexDirection: 'column', borderTop: i || origin ? `1px dashed ${C.line}` : 0 }}>
                    {L.leg != null && <span style={{ fontSize: 11.5, color: C.muted, fontWeight: 700, padding: '6px 0 0 38px' }}>{t('ro.leg', { n: L.leg })}{L.wait ? t('ro.wait', { d: dur(L.wait) }) : ''}</span>}
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: L.leg != null ? '6px 0 10px' : '10px 0' }}>
                      <span style={{ width: 26, height: 26, borderRadius: 26, background: pt(s) ? color : '#B9C7C4', color: '#FFFFFF', fontWeight: 800, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>{i + 1}</span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
                        <span style={{ fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.client}</span>
                        <span style={{ fontSize: 12, color: C.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.addr} · {dur(s.dur)}</span>
                        {s.after != null && <span style={{ alignSelf: 'flex-start', marginTop: 2, fontSize: 11, fontWeight: 800, borderRadius: 6, padding: '2px 7px', background: L.wait ? '#FDF0DC' : '#DDF1EC', color: L.wait ? '#8A4B05' : '#0B6B5F' }}>{t('ro.after', { t: clock(s.after) })}</span>}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                        <span className="num nw" style={{ fontWeight: 800, fontSize: 13 }}>{clock(L.arr)}</span>
                        {manual && (
                          <div style={{ display: 'flex', gap: 4 }}>
                            {([[-1, 'M18 15l-6-6-6 6', t('ro.up', { name: s.client }), i === 0], [1, 'M6 9l6 6 6-6', t('ro.down', { name: s.client }), i === calc.cur.length - 1]] as const).map(([dir, d, label, off]) => (
                              <button key={dir} aria-label={label} disabled={off} onClick={() => swap(i, i + dir)}
                                style={{ width: 34, height: 34, borderRadius: 10, border: `1px solid ${C.line}`, background: '#F4F7F6', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: off ? 'default' : 'pointer', opacity: off ? 0.35 : 1, padding: 0 }}>
                                <Svg d={d} size={16} color={C.ink} w={2.2} />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {origin && (
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 0', borderTop: `1px dashed ${C.line}` }}>
                  <span style={{ width: 26, height: 26, borderRadius: 8, background: C.ink, flex: 'none' }} />
                  <span style={{ fontWeight: 700, fontSize: 13.5, flex: 1 }}>{t('ro.back', { o: origin.label })} {op && <span style={{ fontWeight: 600, color: C.muted }}>(+{calc.m.back} min)</span>}</span>
                  <span className="num nw" style={{ fontWeight: 800, fontSize: 13 }}>{clock(calc.m.end)}</span>
                </div>
              )}
            </div>

            {manual && calc.differs && <button className="k-btn k-btn-line" onClick={() => setCur(calc.sugIds)}>{t('ro.restore')}</button>}
            {applied && <div style={{ background: '#DDF1EC', color: '#0B6B5F', borderRadius: 14, padding: '12px 14px', fontWeight: 700, fontSize: 13.5, lineHeight: 1.45 }}>{t('ro.sent', { name: first })}</div>}
            <button className="k-btn k-btn-fill k-btn-big" onClick={() => setAsk(true)}>{t('ro.apply', { name: first })}</button>
            <Link className="k-btn k-btn-line" to={`/app/rotas/navegacao?m=${h.id}&d=${isoDate(day)}`}>{t('ro.seeNav', { name: first })}</Link>
          </>
        )}
      </main>

      {ask && h && calc && (
        <Sheet title={t('ro.ask', { name: first })} onClose={() => setAsk(false)}>
          <span style={{ fontSize: 14, color: C.muted, lineHeight: 1.5 }}>{t(manual && calc.differs ? 'ro.askManual' : 'ro.askTidy', { name: first })}</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: '#F4F7F6', borderRadius: 14, padding: 12 }}>
            {[[t('ro.stops'), t(houses ? 'ro.nHouses' : 'ro.nPlaces', { n: calc.cur.length })], [t('ro.travel'), `${dur(calc.m.travel)} · ${Math.round(miles(calc.m.dist))} mi`], [t('ro.leaveRow'), `${origin?.label || '—'} · ${clock(calc.leave)}`]].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13 }}><span style={{ color: C.muted }}>{k}</span><span className="nw" style={{ fontWeight: 700 }}>{v}</span></div>
            ))}
          </div>
          <span style={{ fontSize: 12, color: C.muted, lineHeight: 1.45 }}>{t('ro.timesNote')}</span>
          <div className="k-pair">
            <button className="k-btn k-btn-line" onClick={() => setAsk(false)}>{t('c.back')}</button>
            <button className="k-btn k-btn-fill" disabled={busy} onClick={apply}>{t('ro.send')}</button>
          </div>
        </Sheet>
      )}
      {cal && (
        <Sheet title={t('ag.pickDate')} onClose={() => setCal(false)}>
          <MonthGrid day={calMonth} jobs={null} sunday={lang === 'en'} onPick={pickDay} onMonth={(n) => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + n, 1))} />
          <div className="k-pair">
            <button className="k-btn k-btn-line" onClick={() => pickDay(startOfDay(new Date()))}>{t('ro.todayBtn')}</button>
            <button className="k-btn k-btn-line" onClick={() => pickDay(addDays(startOfDay(new Date()), 1))}>{t('ro.tomorrowBtn')}</button>
          </div>
        </Sheet>
      )}
    </div>
  );
}

function RoutesSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }} aria-busy="true">
      <div style={{ display: 'flex', gap: 8 }}>{[0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ flex: 1, height: 46, borderRadius: 14 }} />)}</div>
      <div className="skeleton" style={{ height: 300, borderRadius: 18 }} />
      <div className="skeleton" style={{ height: 64, borderRadius: 14 }} />
      <div className="skeleton" style={{ height: 260, borderRadius: 18 }} />
    </div>
  );
}

/** Google map when the key is set; otherwise the canvas' illustrative map with the real points projected */
function RouteMap({ origin, stops, color, dashed }: { origin: Pt | null; stops: Stop[]; color: string; dashed: boolean }) {
  const { t } = useApp();
  const el = useRef<HTMLDivElement>(null);
  const [g, setG] = useState<boolean | null>(null);
  useEffect(() => { loadMaps().then(setG); }, []);
  const located = useMemo(() => stops.filter((s) => pt(s)), [stops]);

  useEffect(() => {
    if (!g || !el.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gm = (window as any).google.maps;
    const pts = located.map((s) => pt(s)!);
    if (!pts.length) return;
    const map = new gm.Map(el.current, { center: pts[0], zoom: 12, disableDefaultUI: true, zoomControl: true, clickableIcons: false });
    const bounds = new gm.LatLngBounds();
    if (origin) { new gm.Marker({ position: origin, map, icon: { path: gm.SymbolPath.CIRCLE, scale: 9, fillColor: C.ink, fillOpacity: 1, strokeColor: '#FFFFFF', strokeWeight: 2 } }); bounds.extend(origin); }
    pts.forEach((p, i) => { new gm.Marker({ position: p, map, label: { text: String(i + 1), color: '#FFFFFF', fontWeight: '800', fontSize: '12px' }, icon: { path: gm.SymbolPath.CIRCLE, scale: 13, fillColor: color, fillOpacity: 1, strokeColor: '#FFFFFF', strokeWeight: 2 } }); bounds.extend(p); });
    const path = [...(origin ? [origin] : []), ...pts, ...(origin ? [origin] : [])];
    new gm.Polyline({ path, map, strokeColor: color, strokeWeight: 4, strokeOpacity: dashed ? 0 : 0.9, icons: dashed ? [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 3 }, offset: '0', repeat: '14px' }] : undefined });
    map.fitBounds(bounds, 40);
  }, [g, origin, located, color, dashed]);

  if (g) return <div ref={el} style={{ height: 230, background: '#E9F0EE' }} role="img" aria-label={t('ro.mapAria')} />;

  // illustrative: project lat/lng into the box, keeping the proportions
  const all = [...(origin ? [origin] : []), ...located.map((s) => pt(s)!)];
  const W = 358, H = 230, pad = 30;
  const lats = all.map((p) => p.lat), lngs = all.map((p) => p.lng);
  const minLa = Math.min(...lats), maxLa = Math.max(...lats), minLn = Math.min(...lngs), maxLn = Math.max(...lngs);
  const sx = (W - 2 * pad) / Math.max(1e-6, maxLn - minLn), sy = (H - 2 * pad) / Math.max(1e-6, maxLa - minLa), s = Math.min(sx, sy);
  const ox = (W - (maxLn - minLn) * s) / 2, oy = (H - (maxLa - minLa) * s) / 2;
  const xy = (p: Pt) => all.length > 1 ? [ox + (p.lng - minLn) * s, H - (oy + (p.lat - minLa) * s)] : [W / 2, H / 2];
  const line = [...(origin ? [origin] : []), ...located.map((x) => pt(x)!), ...(origin ? [origin] : [])].map((p) => xy(p).join(',')).join(' ');
  const pc = (v: number, of: number) => `${(v / of) * 100}%`;
  return (
    <div style={{ position: 'relative', height: H, backgroundColor: '#E9F0EE', backgroundImage: 'linear-gradient(#DCE6E3 1px, transparent 1px), linear-gradient(90deg, #DCE6E3 1px, transparent 1px)', backgroundSize: '28px 28px', overflow: 'hidden' }}>
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={t('ro.mapAria')} style={{ position: 'absolute', inset: 0 }}>
        <path d="M0 70 C 90 60, 160 100, 358 84" fill="none" stroke="#FFFFFF" strokeWidth="7" vectorEffect="non-scaling-stroke" />
        <path d="M60 230 C 90 150, 200 140, 240 0" fill="none" stroke="#FFFFFF" strokeWidth="7" vectorEffect="non-scaling-stroke" />
        <path d="M0 170 C 120 180, 240 150, 358 190" fill="none" stroke="#FFFFFF" strokeWidth="5" vectorEffect="non-scaling-stroke" />
        <path d="M300 230 C 300 160, 330 90, 358 60" fill="none" stroke="#FFFFFF" strokeWidth="4" vectorEffect="non-scaling-stroke" />
        {all.length > 1 && <polyline points={line} fill="none" stroke={color} strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round" strokeDasharray={dashed ? '7 6' : undefined} vectorEffect="non-scaling-stroke" />}
      </svg>
      {origin && (() => { const [x, y] = xy(origin); return (
        <div style={{ position: 'absolute', left: `calc(${pc(x, W)} - 15px)`, top: y - 15, width: 30, height: 30, borderRadius: 9, background: C.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 3px 8px rgba(0,0,0,0.25)' }}>
          <Svg d={I.home} size={16} color="#FFFFFF" w={2.2} />
        </div>
      ); })()}
      {located.map((st) => { const [x, y] = xy(pt(st)!); const n = stops.indexOf(st) + 1; return (
        <div key={st.id} style={{ position: 'absolute', left: `calc(${pc(x, W)} - 13px)`, top: y - 13, width: 26, height: 26, borderRadius: 26, background: color, color: '#FFFFFF', border: '2px solid #FFFFFF', boxSizing: 'border-box', fontWeight: 800, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 3px 8px rgba(0,0,0,0.22)' }}>{n}</div>
      ); })}
      {!all.length && <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: C.muted, padding: 20, textAlign: 'center' }}>{t('ro.noPoints')}</span>}
      <div style={{ position: 'absolute', left: 10, bottom: 10, background: '#FFFFFF', borderRadius: 10, padding: '6px 10px', fontSize: 11.5, fontWeight: 700, color: '#3E4F4C', boxShadow: '0 2px 6px rgba(0,0,0,0.08)' }}>{t('ro.illustrative')}</div>
    </div>
  );
}
