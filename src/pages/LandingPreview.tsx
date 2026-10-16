// Landing: "Ver a tela da dona / da helper" opens a phone on the page itself with the real app design (static demo data).
import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';

type Who = 'owner' | 'helper';
const INK = '#0F1F1C', MUTED = '#566965', LINE = '#DFE7E5', ACCENT = '#0B7C6E', MINT = '#5FD4C1', BG = '#F4F7F6';
const BRICO = "'Bricolage Grotesque', sans-serif";

const Ico = ({ d, size = 16, color = 'currentColor', w = 2 }: { d: string; size?: number; color?: string; w?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);
const P = {
  home: 'M3 11l9-8 9 8v10H3z', cal: 'M3 5h18v16H3zM3 10h18M8 3v4M16 3v4', users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a6 6 0 0 1 12 0v1M16 3.5a4 4 0 0 1 0 7.5M22 21v-1a6 6 0 0 0-4-5.6',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2', more: 'M5 12h.01M12 12h.01M19 12h.01', spark: 'M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9z',
  bell: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0', chat: 'M4 5h16v11H9l-5 4z', pay: 'M3 6h18v12H3zM3 10h18M7 15h3', person: 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  lock: 'M6 11h12v10H6zM8 11V8a4 4 0 0 1 8 0v3', nav: 'M3 11l18-8-8 18-2-8z', check: 'M5 12l5 5 9-11', clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
};

function Bar({ items }: { items: [string, string][] }) {
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, background: '#FFFFFF', borderTop: `1px solid ${LINE}`, display: 'grid', gridTemplateColumns: `repeat(${items.length}, 1fr)`, padding: '8px 4px 14px' }}>
      {items.map(([d, l], i) => (
        <span key={l} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, fontSize: 9.5, fontWeight: i === 0 ? 800 : 700, color: i === 0 ? ACCENT : MUTED }}><Ico d={d} size={18} w={i === 0 ? 2 : 1.8} />{l}</span>
      ))}
    </div>
  );
}
const card: CSSProperties = { background: '#FFFFFF', border: `1px solid ${LINE}`, borderRadius: 14 };

function Job({ time, dur, name, tag, addr, who, color, status, tone }: { time: string; dur: string; name: string; tag: string; addr: string; who: string; color: string; status: string; tone: [string, string] }) {
  return (
    <div style={{ ...card, padding: 9, display: 'flex', gap: 9, alignItems: 'center' }}>
      <span style={{ minWidth: 44, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
        <b style={{ fontSize: 12.5, fontWeight: 800 }}>{time}</b>
        <span style={{ fontSize: 9, fontWeight: 700, color: MUTED, background: '#EEF3F2', borderRadius: 99, padding: '2px 6px' }}>{dur}</span>
      </span>
      <span style={{ width: 1, alignSelf: 'stretch', background: LINE }} />
      <span style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
        <span style={{ display: 'flex', gap: 5, alignItems: 'center' }}><b style={{ fontSize: 11.5 }}>{name}</b><span style={{ fontSize: 8.5, fontWeight: 700, color: MUTED, border: `1px solid ${LINE}`, borderRadius: 5, padding: '0 4px' }}>{tag}</span></span>
        <span style={{ fontSize: 10, color: MUTED, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{addr}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 1 }}>
          <span style={{ width: 17, height: 17, borderRadius: 17, background: color, color: '#FFFFFF', fontSize: 8, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{who.split(' ').map((x) => x[0]).join('')}</span>
          <span style={{ fontSize: 10, fontWeight: 600 }}>{who}</span>
          <span style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 800, background: tone[0], color: tone[1], borderRadius: 99, padding: '2px 7px' }}>{status}</span>
        </span>
      </span>
    </div>
  );
}

function OwnerScreen() {
  return (
    <div style={{ position: 'absolute', inset: 0, padding: '34px 12px 80px', display: 'flex', flexDirection: 'column', gap: 10, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 32, height: 32, borderRadius: 10, background: '#D4F1E9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: BRICO, fontWeight: 800, color: '#0A3D35' }}>T</span>
        <span style={{ display: 'flex', flexDirection: 'column', flex: 1 }}><span style={{ fontSize: 9.5, color: MUTED, fontWeight: 700 }}>Qui, 15 de outubro</span><b style={{ fontFamily: BRICO, fontSize: 15 }}>Bom dia, Carla</b></span>
        <span style={{ position: 'relative', width: 32, height: 32, borderRadius: 10, background: INK, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Ico d={P.spark} size={16} color={MINT} /><span style={{ position: 'absolute', top: -4, right: -4, minWidth: 15, height: 15, borderRadius: 15, background: '#D9480F', color: '#FFFFFF', fontSize: 8.5, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #F4F7F6' }}>3</span></span>
        <span style={{ width: 32, height: 32, borderRadius: 10, background: '#FFFFFF', border: `1px solid ${LINE}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Ico d={P.bell} size={15} color={INK} /></span>
      </div>
      <div className="lp-pv-pop" style={{ background: '#FFF3EC', border: '1px solid #F5D3C2', borderRadius: 12, padding: '8px 9px', display: 'flex', gap: 7, alignItems: 'center' }}>
        <Ico d={P.spark} size={13} color="#B8400C" />
        <span style={{ fontSize: 10, fontWeight: 700, color: '#8F2F08', flex: 1, lineHeight: 1.3 }}>Conflito: Bianca em 2 casas às 10:30 de sábado</span>
        <span style={{ fontSize: 9.5, fontWeight: 800, color: '#FFFFFF', background: '#B8400C', borderRadius: 8, padding: '5px 8px' }}>Resolver</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
        {[['JOBS HOJE', '6', '3 helpers em campo', INK], ['A RECEBER', '$1,240', 'nesta semana', INK], ['SAÚDE', '82', 'de 100', ACCENT]].map(([l, v, n, c]) => (
          <span key={l} style={{ ...card, padding: '8px 8px', display: 'flex', flexDirection: 'column', gap: 1 }}>
            <span style={{ fontSize: 8, fontWeight: 800, color: MUTED, letterSpacing: '.04em' }}>{l}</span>
            <b style={{ fontFamily: BRICO, fontSize: 17, color: c }}>{v}</b>
            <span style={{ fontSize: 8.5, color: MUTED }}>{n}</span>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline' }}><b style={{ fontFamily: BRICO, fontSize: 14, flex: 1 }}>Agenda de hoje</b><span style={{ fontSize: 10, fontWeight: 800, color: ACCENT }}>Ver tudo</span></div>
      <div className="lp-pv-pop d1"><Job time="8:00" dur="2h" name="Família Cohen" tag="Resid." addr="12 Elm St, Waterbury, CT" who="Bianca R" color="#C2410C" status="Concluído" tone={['#E3F1EE', '#0B6B5F']} /></div>
      <div className="lp-pv-pop d2"><Job time="9:30" dur="3h" name="Northgate Offices" tag="Comerc." addr="400 Main St, Middlebury, CT" who="Marcos A" color="#2563EB" status="Em andamento" tone={['#FDF0DC', '#8A4B05']} /></div>
      <div className="lp-pv-pop d3"><Job time="13:00" dur="2h" name="Família Rossi" tag="Resid." addr="9 Oak Ave, Naugatuck, CT" who="Joana S" color="#7C3AED" status="Agendado" tone={['#EEF1F0', '#3E4F4C']} /></div>
      <Bar items={[[P.home, 'Hoje'], [P.cal, 'Agenda'], [P.users, 'Clientes'], [P.chart, 'Finanças'], [P.more, 'Mais']]} />
    </div>
  );
}

function HelperScreen() {
  const stop = (n: number, name: string, time: string, addr: string, state: 'done' | 'next' | 'later') => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderTop: n > 1 ? `1px solid #EEF1F0` : 0, opacity: state === 'done' ? 0.6 : 1 }}>
      <span style={{ width: 22, height: 22, borderRadius: 22, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, background: state === 'done' ? '#DDF1EC' : state === 'next' ? ACCENT : '#EEF1F0', color: state === 'done' ? ACCENT : state === 'next' ? '#FFFFFF' : '#3E4F4C' }}>{state === 'done' ? <Ico d={P.check} size={11} color={ACCENT} w={3} /> : n}</span>
      <span style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}><b style={{ fontSize: 11 }}>{name}</b><span style={{ fontSize: 9.5, color: MUTED }}>{time} · {addr}</span></span>
    </div>
  );
  return (
    <div style={{ position: 'absolute', inset: 0, padding: '34px 12px 80px', display: 'flex', flexDirection: 'column', gap: 10, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 32, height: 32, borderRadius: 32, background: '#C2410C', color: '#FFFFFF', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>BR</span>
        <span style={{ display: 'flex', flexDirection: 'column', flex: 1 }}><span style={{ fontSize: 9.5, color: MUTED, fontWeight: 700 }}>jueves, 15 de octubre</span><b style={{ fontFamily: BRICO, fontSize: 15 }}>Hola, Bianca</b></span>
        <span style={{ fontSize: 9, fontWeight: 800, color: '#0B6B5F', background: '#DDF1EC', borderRadius: 99, padding: '3px 8px' }}>● En turno · 2h46</span>
      </div>
      <div className="lp-pv-pop" style={{ background: '#0A3D35', color: '#EAF5F2', borderRadius: 16, padding: 12, display: 'flex', flexDirection: 'column', gap: 7 }}>
        <span style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: '.06em', color: MINT }}>PRÓXIMA CASA · 2 DE 4</span>
        <span style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}><b style={{ fontFamily: BRICO, fontSize: 17, flex: 1 }}>Familia Rossi</b><b style={{ fontFamily: BRICO, fontSize: 16, color: MINT }}>10:30</b></span>
        <span style={{ fontSize: 10, color: '#B9D6D0' }}>9 Oak Ave, Naugatuck, CT</span>
        <span style={{ display: 'flex', gap: 6, alignItems: 'flex-start', background: 'rgba(255,255,255,.07)', borderRadius: 9, padding: '6px 8px', fontSize: 9.5, color: '#D3E8E3', lineHeight: 1.35 }}><Ico d={P.lock} size={11} color="#9DB5B0" />Código del portón 4512 · Perro: Max (amigable)</span>
        <span style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 2 }}>
          <span style={{ minHeight: 32, borderRadius: 9, border: '1px solid #2A6A60', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}><Ico d={P.nav} size={11} color={MINT} />Waze</span>
          <span style={{ minHeight: 32, borderRadius: 9, background: MINT, color: '#0A3D35', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Llegué</span>
        </span>
      </div>
      <div className="lp-pv-pop d1" style={{ ...card, padding: '2px 10px' }}>
        {stop(1, 'Familia Cohen', '8:00', '12 Elm St', 'done')}
        {stop(2, 'Familia Rossi', '10:30', '9 Oak Ave', 'next')}
        {stop(3, 'Familia Patel', '13:00', '31 Ridge Rd', 'later')}
        {stop(4, 'Familia Lee', '15:30', '88 Pine St', 'later')}
      </div>
      <div className="lp-pv-pop d2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <span style={{ ...card, padding: 8, display: 'flex', flexDirection: 'column', gap: 1 }}><span style={{ fontSize: 8, fontWeight: 800, color: MUTED }}>HORAS HOY</span><b style={{ fontFamily: BRICO, fontSize: 16 }}>2h46</b></span>
        <span style={{ ...card, padding: 8, display: 'flex', flexDirection: 'column', gap: 1 }}><span style={{ fontSize: 8, fontWeight: 800, color: MUTED }}>ESTA SEMANA</span><b style={{ fontFamily: BRICO, fontSize: 16 }}>24h10</b></span>
      </div>
      <div className="lp-pv-pop d3" style={{ ...card, padding: '8px 10px', display: 'flex', gap: 8, alignItems: 'center' }}>
        <Ico d={P.chat} size={14} color={ACCENT} />
        <span style={{ fontSize: 10, flex: 1, lineHeight: 1.35 }}><b>Carla:</b> la familia Patel pidió atención en el horno hoy.</span>
        <span style={{ fontSize: 8, fontWeight: 800, color: MUTED }}>Traducido</span>
      </div>
      <Bar items={[[P.home, 'Hoy'], [P.chat, 'Mensajes'], [P.pay, 'Pagos'], [P.person, 'Perfil']]} />
    </div>
  );
}

export default function ScreenPreview({ who, onSwitch, onClose }: { who: Who; onSwitch: (w: Who) => void; onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    box.current?.focus();
    return () => { window.removeEventListener('keydown', k); document.body.style.overflow = prev; };
  }, [onClose]);
  const tab = (w: Who, label: string): ReactNode => (
    <button key={w} type="button" aria-pressed={who === w} onClick={() => onSwitch(w)}
      style={{ minHeight: 40, padding: '0 16px', borderRadius: 10, border: 0, background: who === w ? '#FFFFFF' : 'transparent', color: who === w ? '#0A3D35' : '#D3E8E3', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>{label}</button>
  );
  return (
    <div className="lp-pv-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={box} tabIndex={-1} role="dialog" aria-modal="true" aria-label={who === 'owner' ? 'Tela da dona' : 'Tela da helper'} className="lp-pv-box">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', justifyContent: 'center' }}>
          <div style={{ display: 'flex', background: 'rgba(255,255,255,.1)', borderRadius: 13, padding: 3, gap: 3 }}>{tab('owner', 'A dona')}{tab('helper', 'A helper')}</div>
          <button type="button" onClick={onClose} aria-label="Fechar" style={{ width: 44, height: 44, borderRadius: 12, border: 0, background: 'rgba(255,255,255,.1)', color: '#FFFFFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Ico d="M18 6L6 18M6 6l12 12" size={18} color="#FFFFFF" /></button>
        </div>
        <div className="lp-pv-phone">
          <div key={who} className="lp-pv-screen" style={{ background: BG, color: INK }}>
            {who === 'owner' ? <OwnerScreen /> : <HelperScreen />}
          </div>
        </div>
        <span style={{ fontSize: 13.5, color: '#B9D6D0', textAlign: 'center', maxWidth: 320, lineHeight: 1.5 }}>
          {who === 'owner' ? 'A dona vê a operação inteira: agenda de todas as helpers, conflitos, cobranças e a saúde da empresa.' : 'A helper vê só o dia dela, na ordem da rota e no idioma dela. Aqui, em espanhol.'}
        </span>
      </div>
    </div>
  );
}
