// Agenda — canvas Agenda: week strip with counts, helper filter with colours, timeline by helper, detail sheet
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../lib/session';
import { C, Empty, Fab, I, OwnerBar, Segment, Svg, colorOf, hm, shortName } from '../components/kit';
import { Sheet } from '../components/ui';
import { getJobs, getMembers, jobMinutes, memberIndex, type Job, type Member } from '../lib/data';
import { addDays, isoDate, startOfDay } from '../lib/format';
import { JobSheet } from './JobSheet';
import { JobCard } from './Home';

type View = 'day' | 'week' | 'month';
const isoWeek = (d: Date) => {
  const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = x.getUTCDay() || 7; x.setUTCDate(x.getUTCDate() + 4 - day);
  const y = new Date(Date.UTC(x.getUTCFullYear(), 0, 1));
  return Math.ceil(((x.getTime() - y.getTime()) / 864e5 + 1) / 7);
};
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default function Agenda() {
  const { t, lang, company } = useApp();
  const sunday = lang === 'en';
  const [day, setDay] = useState(startOfDay(new Date()));
  const [view, setView] = useState<View>('day');
  const [who, setWho] = useState('all');
  const [members, setMembers] = useState<Member[]>([]);
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [month, setMonth] = useState<Job[] | null>(null);
  const [sel, setSel] = useState<Job | null>(null);
  const [cal, setCal] = useState(false);
  const [calMonth, setCalMonth] = useState(day);
  const [calJobs, setCalJobs] = useState<Job[] | null>(null);
  const weekStart = useMemo(() => { const d = startOfDay(day); const off = sunday ? d.getDay() : (d.getDay() + 6) % 7; return addDays(d, -off); }, [day, sunday]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  useEffect(() => { if (company) getMembers(company.id).then(setMembers); }, [company]);
  const load = useCallback(async () => {
    if (!company) return;
    setJobs(await getJobs(company.id, weekStart, addDays(weekStart, 7)));
  }, [company, weekStart]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!company || !cal) return;
    const a = new Date(calMonth.getFullYear(), calMonth.getMonth(), 1), b = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1);
    setCalJobs(null); getJobs(company.id, a, b).then(setCalJobs);
  }, [company, cal, calMonth]);
  useEffect(() => {
    if (!company || view !== 'month') return;
    const a = new Date(day.getFullYear(), day.getMonth(), 1), b = new Date(day.getFullYear(), day.getMonth() + 1, 1);
    setMonth(null); getJobs(company.id, a, b).then(setMonth);
  }, [company, view, day]);

  const active = members.filter((m) => m.status === 'active');
  const visible = (list: Job[]) => list.filter((j) => j.status !== 'canceled' && (who === 'all' || (who === 'none' ? j.job_assignments.length === 0 : j.job_assignments.some((a) => a.membership_id === who))));
  const ofDay = (d: Date, list: Job[]) => list.filter((j) => startOfDay(new Date(j.scheduled_start)).getTime() === d.getTime());
  const dayJobs = jobs ? visible(ofDay(day, jobs)) : null;
  const today = startOfDay(new Date()).getTime();
  const totalMin = (dayJobs || []).reduce((s, j) => s + jobMinutes(j), 0);
  const hours = (Math.round(totalMin / 6) / 10).toLocaleString(lang);

  // swipe the week strip to change week
  const touch = useRef<number | null>(null);
  const onTouchEnd = (x: number) => { if (touch.current == null) return; const dx = x - touch.current; touch.current = null; if (Math.abs(dx) > 50) setDay(addDays(day, dx < 0 ? 7 : -7)); };

  const filters = [{ id: 'all', label: t('inv.all'), dot: '#9DB5B0' }, ...active.filter((m) => m.role !== 'owner' || (jobs || []).some((j) => j.job_assignments.some((x) => x.membership_id === m.id))).map((m) => ({ id: m.id, label: shortName(m.display_name).split(' ')[0], dot: colorOf(memberIndex(members, m.id))[0] })),
    ...((jobs || []).some((j) => j.job_assignments.length === 0 && j.status !== 'canceled') ? [{ id: 'none', label: t('c.unassigned'), dot: '#B9C7C4' }] : [])];

  return (
    <div className="k-screen">
      <main className="k-page" style={{ gap: 14 }}>
        <div className="k-head">
          <div className="k-head-t">
            <span className="k-title">{t('nav.schedule')}</span>
            <button className="k-sub" onClick={() => { setCalMonth(day); setCal(true); }} aria-label={t('ag.pickDate')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'none', border: 0, padding: 0, minHeight: 24, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', whiteSpace: 'nowrap' }}>
              <Svg d={I.cal} size={14} color={C.accent} w={2} />
              {cap(day.toLocaleDateString(lang, day.getFullYear() === new Date().getFullYear() ? { month: 'long' } : { month: 'long', year: 'numeric' }))} · {t('ag.week', { n: isoWeek(day) })}
            </button>
          </div>
          <Segment small value={view} onChange={setView} label={t('ag.view')} options={[{ value: 'day', label: t('ag.day') }, { value: 'week', label: t('ag.weekV') }, { value: 'month', label: t('ag.month') }]} />
        </div>

        {view !== 'month' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 4 }} onTouchStart={(e) => { touch.current = e.touches[0].clientX; }} onTouchEnd={(e) => onTouchEnd(e.changedTouches[0].clientX)}>
            {weekDays.map((d) => {
              const on = d.getTime() === day.getTime();
              const n = jobs ? visible(ofDay(d, jobs)).length : 0;
              const wd = cap(d.toLocaleDateString(lang, { weekday: 'short' }).replace('.', '')).slice(0, 3);
              return (
                <button key={d.toISOString()} onClick={() => setDay(d)} aria-pressed={on} aria-label={`${d.toLocaleDateString(lang, { weekday: 'long', day: 'numeric' })}, ${t('ag.nJobs', { n })}`}
                  style={{ minHeight: 64, borderRadius: 14, border: `1px solid ${on ? C.ink : d.getTime() === today ? C.accent : C.line}`, background: on ? C.ink : '#FFFFFF', color: on ? '#FFFFFF' : C.ink, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, opacity: 0.8 }}>{wd}</span>
                  <span className="num" style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 18, fontWeight: 700 }}>{d.getDate()}</span>
                  <span style={{ fontSize: 10, fontWeight: 800, minHeight: 12 }}>{n ? t('ag.nJobs', { n }) : ''}</span>
                </button>
              );
            })}
          </div>
        )}

        <div className="k-chips" role="group" aria-label={t('job.helper')}>
          {filters.map((f) => (
            <button key={f.id} className="k-chip" style={{ paddingLeft: 8 }} aria-pressed={who === f.id} onClick={() => setWho(f.id)}>
              <span className="k-dot" style={{ background: f.dot }} />{f.label}
            </button>
          ))}
        </div>

        {view === 'day' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontWeight: 800, fontSize: 15 }}>{day.getTime() === today ? `${t('c.today')} · ` : ''}{cap(day.toLocaleDateString(lang, { weekday: 'long', day: 'numeric', month: 'long' }).replace('-feira', ''))}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 'none' }}>
                <span className="num nw" style={{ fontSize: 12.5, color: C.muted, fontWeight: 700 }}>{t('ag.nJobs', { n: dayJobs?.length || 0 })} · {hours} h</span>
                {!!dayJobs?.some((j) => j.job_assignments.length) && <Link to={`/app/rotas?d=${isoDate(day)}`} className="nw" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, minHeight: 32, fontSize: 12.5, fontWeight: 800, color: C.accent, textDecoration: 'none' }}><Svg d={I.route} size={15} color={C.accent} />{t('rt.title')}</Link>}
              </span>
            </div>
            {!dayJobs ? <div className="skeleton" style={{ height: 420, borderRadius: 18 }} /> : dayJobs.length === 0 ? (
              <Empty title={t('home.freeDay')} text={t('ag.freeText')} action={<Link to={`/app/agenda/novo?date=${day.toISOString().slice(0, 10)}`} className="k-btn k-btn-fill" style={{ marginTop: 6, minHeight: 44, borderRadius: 13, fontSize: 13.5 }}>{t('home.newJob')}</Link>} />
            ) : <Timeline day={day} jobs={dayJobs} members={members} who={who} onPick={setSel} />}
          </>
        )}

        {view === 'week' && (
          !jobs ? <div className="skeleton" style={{ height: 300, borderRadius: 18 }} /> : weekDays.map((d) => {
            const list = visible(ofDay(d, jobs));
            return (
              <section key={d.toISOString()} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="k-sec"><span style={{ color: d.getTime() === today ? C.accent : undefined }}>{cap(d.toLocaleDateString(lang, { weekday: 'long', day: 'numeric' }).replace('-feira', ''))}</span><span className="k-s12 k-muted" style={{ fontWeight: 700 }}>{list.length ? t('ag.nJobs', { n: list.length }) : t('ag.free')}</span></div>
                {list.map((j) => <JobCard key={j.id} job={j} members={members} onOpen={() => setSel(j)} />)}
              </section>
            );
          })
        )}

        {view === 'month' && <MonthGrid day={day} jobs={month ? visible(month) : null} sunday={sunday} onPick={(d) => { setDay(d); setView('day'); }} onMonth={(n) => setDay(new Date(day.getFullYear(), day.getMonth() + n, 1))} />}
      </main>
      <Fab to={`/app/agenda/novo?date=${day.toISOString().slice(0, 10)}`} label={t('home.newJob')} />
      <OwnerBar />
      {cal && (
        <Sheet title={t('ag.pickDate')} onClose={() => setCal(false)}>
          <MonthGrid day={calMonth} jobs={calJobs ? visible(calJobs) : null} sunday={sunday} onPick={(d) => { setDay(d); setView('day'); setCal(false); }} onMonth={(n) => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + n, 1))} />
          <button className="k-btn k-btn-line" onClick={() => { setDay(startOfDay(new Date())); setView('day'); setCal(false); }}>{t('dp.today')}</button>
        </Sheet>
      )}
      {sel && <JobSheet job={sel} members={members} onClose={() => setSel(null)} onChanged={() => { setSel(null); load(); }} />}
    </div>
  );
}

function Timeline({ day, jobs, members, who, onPick }: { day: Date; jobs: Job[]; members: Member[]; who: string; onPick: (j: Job) => void }) {
  const { t, lang } = useApp();
  const mins = (iso: string) => { const d = new Date(iso); return (d.getTime() - day.getTime()) / 60000; };
  const firstH = Math.min(7, ...jobs.map((j) => Math.floor(mins(j.scheduled_start) / 60)));
  const lastH = Math.max(17, ...jobs.map((j) => Math.ceil(mins(j.scheduled_end) / 60)));
  const start = firstH * 60;
  const height = (lastH - firstH) * 60;
  const cols = who !== 'all' ? [who] : [...new Set(jobs.map((j) => j.job_assignments[0]?.membership_id || 'none'))]
    .sort((a, b) => (a === 'none' ? 1 : b === 'none' ? -1 : memberIndex(members, a) - memberIndex(members, b)));
  const now = new Date();
  const isToday = startOfDay(now).getTime() === day.getTime();
  const nowTop = (now.getHours() * 60 + now.getMinutes()) - start;
  return (
    <div style={{ background: '#FFFFFF', border: `1px solid ${C.line}`, borderRadius: 18, padding: '8px 8px 8px 0', position: 'relative' }}>
      <div style={{ position: 'relative', height: height + 12 }}>
        {Array.from({ length: lastH - firstH + 1 }, (_, i) => (
          <div key={i} style={{ position: 'absolute', left: 0, right: 0, top: i * 60 + 6, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
            <span className="num" style={{ width: 46, textAlign: 'right', fontSize: 11, fontWeight: 700, color: C.muted, marginTop: -7 }}>{lang === 'en' ? `${((firstH + i + 11) % 12) + 1} ${firstH + i < 12 ? 'AM' : 'PM'}` : `${firstH + i}:00`}</span>
            <div style={{ flex: 1, height: 1, background: C.soft }} />
          </div>
        ))}
        {isToday && nowTop >= 0 && nowTop <= height && (
          <div style={{ position: 'absolute', left: 46, right: 0, top: nowTop + 6, height: 2, background: '#D9480F', zIndex: 3 }}><span style={{ position: 'absolute', left: -4, top: -4, width: 10, height: 10, borderRadius: 10, background: '#D9480F' }} /></div>
        )}
        {jobs.map((j) => {
          const mid = j.job_assignments[0]?.membership_id || 'none';
          const ci = Math.max(0, cols.indexOf(who !== 'all' ? who : mid));
          const [color, bg] = mid === 'none' ? ['#566965', '#EEF1F0'] : colorOf(memberIndex(members, mid));
          const top = mins(j.scheduled_start) - start + 6;
          const h = Math.max(36, jobMinutes(j) - 4);
          const n = cols.length;
          return (
            <button key={j.id} onClick={() => onPick(j)} aria-label={`${j.clients?.name}, ${hm(j.scheduled_start, lang)}`}
              style={{ position: 'absolute', left: `calc(52px + (100% - 60px) * ${ci} / ${n})`, width: `calc((100% - 60px) / ${n} - ${n > 1 ? 4 : 0}px)`, top, height: h, boxSizing: 'border-box', borderRadius: 10, border: 0, borderLeft: `4px solid ${color}`, background: bg, padding: '6px 7px', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 2, overflow: 'hidden', cursor: 'pointer', color: C.ink, fontFamily: 'inherit', opacity: j.status === 'completed' ? 0.75 : 1 }}>
              <span className="num nw" style={{ fontSize: 11, fontWeight: 800, color }}>{hm(j.scheduled_start, lang)}–{hm(j.scheduled_end, lang)}</span>
              <span style={{ fontSize: 12.5, fontWeight: 800, lineHeight: 1.2 }}>{j.clients?.name}</span>
              <span style={{ fontSize: 11, color: C.muted }}>{j.services?.name || (j.contract_id ? t('job.recContract') : '')}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function MonthGrid({ day, jobs, sunday, onPick, onMonth }: { day: Date; jobs: Job[] | null; sunday: boolean; onPick: (d: Date) => void; onMonth: (n: number) => void }) {
  const { t, lang } = useApp();
  const first = new Date(day.getFullYear(), day.getMonth(), 1);
  const lead = sunday ? first.getDay() : (first.getDay() + 6) % 7;
  const cells = Array.from({ length: 42 }, (_, i) => addDays(first, i - lead));
  const rows = cells.slice(35).every((d) => d.getMonth() !== first.getMonth()) ? cells.slice(0, 35) : cells;
  const count = (d: Date) => (jobs || []).filter((j) => startOfDay(new Date(j.scheduled_start)).getTime() === d.getTime()).length;
  const today = startOfDay(new Date()).getTime();
  const names = Array.from({ length: 7 }, (_, i) => new Date(2023, 0, 1 + ((i + (sunday ? 0 : 1)) % 7)).toLocaleDateString(lang, { weekday: 'narrow' }));
  return (
    <div className="k-card" style={{ gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button className="k-iconbtn" onClick={() => onMonth(-1)} aria-label={t('dp.prev')}>‹</button>
        <span style={{ flex: 1, textAlign: 'center', fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, fontSize: 17 }}>{cap(first.toLocaleDateString(lang, { month: 'long', year: 'numeric' }))}</span>
        <button className="k-iconbtn" onClick={() => onMonth(1)} aria-label={t('dp.next')}>›</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 4 }}>
        {names.map((n, i) => <span key={i} style={{ textAlign: 'center', fontSize: 11, fontWeight: 800, color: C.muted }}>{n}</span>)}
        {rows.map((d) => {
          const n = count(d), out = d.getMonth() !== first.getMonth();
          return (
            <button key={d.toISOString()} onClick={() => onPick(d)} aria-label={`${d.toLocaleDateString(lang, { day: 'numeric', month: 'long' })}, ${t('ag.nJobs', { n })}`}
              style={{ minHeight: 52, borderRadius: 12, border: `1px solid ${d.getTime() === today ? C.accent : C.soft}`, background: '#FFFFFF', opacity: out ? 0.4 : 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, cursor: 'pointer', fontFamily: 'inherit', color: C.ink }}>
              <span className="num" style={{ fontWeight: 800, fontSize: 14 }}>{d.getDate()}</span>
              <span style={{ fontSize: 10, fontWeight: 800, color: n ? C.accent : 'transparent' }}>{jobs ? n || '·' : ''}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
