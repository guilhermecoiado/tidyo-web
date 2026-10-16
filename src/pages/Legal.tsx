// Termos de uso e Política de privacidade (/termos, /privacidade), no idioma escolhido
import { useEffect, type CSSProperties } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useApp } from '../lib/session';
import { LangPicker } from './Auth';
import { LEGAL } from './legalText';

const ink = '#0F1F1C', muted = '#566965', line = '#DFE7E5', accent = '#0B7C6E', brand = '#0A3D35';

export default function Legal({ doc }: { doc: 'terms' | 'privacy' }) {
  const { lang, t } = useApp();
  const { hash } = useLocation();
  const d = LEGAL[doc][lang] || LEGAL[doc].en;
  const other = doc === 'terms' ? 'privacy' : 'terms';
  useEffect(() => { document.title = `${d.title} · Tidyo`; }, [d.title]);
  useEffect(() => { if (hash) document.getElementById(hash.slice(1))?.scrollIntoView(); else window.scrollTo(0, 0); }, [hash, doc]);
  return (
    <div style={{ minHeight: '100dvh', background: '#F4F7F6', color: ink, fontFamily: "Manrope, 'Segoe UI', sans-serif", fontSize: 15 }}>
      <header style={{ background: '#D4F1E9', borderRadius: '0 0 28px 28px', paddingTop: 'env(safe-area-inset-top)' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '24px 20px 26px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Link to="/" aria-label="Tidyo" style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, textDecoration: 'none' }}>
              <svg width="36" height="36" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="17" fill="#FFFFFF" /><g transform="translate(11 8.5) scale(0.7)"><rect x="12" y="9.5" width="36" height="4" rx="2" fill="#12A38F" /><rect x="10" y="12.5" width="40" height="10" rx="5" fill={brand} /><path d="M30 20 V 44 C 30 51.5, 34 55, 41.5 54" fill="none" stroke={brand} strokeWidth="7" strokeLinecap="round" /></g></svg>
              <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 24, fontWeight: 800, letterSpacing: '-0.035em', color: brand }}>tidyo</span>
            </Link>
            <LangPicker />
          </div>
          <h1 style={{ margin: 0, fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 30, fontWeight: 800, lineHeight: 1.15, color: brand, textWrap: 'balance' } as CSSProperties}>{d.title}</h1>
          <span style={{ fontSize: 13.5, color: '#2F5B54', fontWeight: 600 }}>{d.updated}</span>
        </div>
      </header>
      <main style={{ maxWidth: 760, margin: '0 auto', padding: '22px 20px calc(40px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <section style={{ background: brand, color: '#EAF5F2', borderRadius: 20, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h2 style={{ margin: 0, fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 18, fontWeight: 700, color: '#FFFFFF' }}>{d.summaryTitle}</h2>
          <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6, lineHeight: 1.5, fontSize: 14 }}>{d.summary.map((s) => <li key={s}>{s}</li>)}</ul>
        </section>
        <nav aria-label={t('lg.index')} style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {d.sections.map((s, i) => <a key={s.h} href={`#s${i + 1}`} style={{ minHeight: 36, display: 'inline-flex', alignItems: 'center', padding: '0 12px', borderRadius: 999, border: `1px solid ${line}`, background: '#FFFFFF', color: ink, fontWeight: 700, fontSize: 12.5, textDecoration: 'none' }}>{s.h}</a>)}
        </nav>
        {d.sections.map((s, i) => (
          <section key={s.h} id={`s${i + 1}`} style={{ background: '#FFFFFF', border: `1px solid ${line}`, borderRadius: 18, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10, scrollMarginTop: 16 }}>
            <h2 style={{ margin: 0, display: 'flex', alignItems: 'baseline', gap: 10, fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 19, fontWeight: 700 }}>
              <span className="num" style={{ fontSize: 13, color: accent, fontWeight: 800 }}>{String(i + 1).padStart(2, '0')}</span>{s.h}
            </h2>
            {s.p?.slice(0, s.table ? 0 : undefined).map((p) => <p key={p} style={{ margin: 0, lineHeight: 1.6, color: '#2E3E3B' }}>{p}</p>)}
            {s.table && (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {s.table.map(([k, v], j) => (
                  <div key={k} style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', padding: '10px 0', borderTop: j ? '1px solid #EEF2F1' : 0 }}>
                    <span style={{ flex: '1 1 180px', fontWeight: 800, fontSize: 14 }}>{k}</span>
                    <span style={{ flex: '2 1 260px', fontSize: 14, color: '#2E3E3B', lineHeight: 1.5 }}>{v}</span>
                  </div>
                ))}
              </div>
            )}
            {s.table && s.p?.map((p) => <p key={p} style={{ margin: 0, lineHeight: 1.6, color: muted, fontSize: 14 }}>{p}</p>)}
            {s.list && <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6, lineHeight: 1.55, color: '#2E3E3B' }}>{s.list.map((l) => <li key={l}>{l}</li>)}</ul>}
          </section>
        ))}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between', alignItems: 'center', fontSize: 13.5 }}>
          <Link to={other === 'terms' ? '/termos' : '/privacidade'} style={{ color: accent, fontWeight: 800 }}>{LEGAL[other][lang]?.title || LEGAL[other].en.title}</Link>
          <Link to="/" style={{ color: muted, fontWeight: 700 }}>{t('lg.back')}</Link>
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: muted }}>{t('lg.byYehi')}</span>
      </main>
    </div>
  );
}
