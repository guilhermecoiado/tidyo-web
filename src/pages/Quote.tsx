// Public quote page (/orcamento/:slug): a link the company shares on Instagram, Google or WhatsApp.
// Anyone can ask for a quote; it lands as a lead in the company's Clientes.
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { translate, type Lang } from '../lib/i18n';
import { C, ByYehi, Stepper, display, initials, usd } from '../components/kit';
import { pricingOf } from '../screens/NewClient';

type Co = { name: string; logo_path: string | null; mode: string; default_language: string; pricing: Record<string, number>; state: string | null };
type Freq = 'weekly' | 'biweekly' | 'monthly' | 'once' | 'deep' | 'move';
const LANGS: [Lang, string][] = [['en', 'EN'], ['es', 'ES'], ['pt-BR', 'PT']];
const round5 = (c: number) => Math.round(c / 500) * 500;

function startLang(): Lang {
  const q = new URLSearchParams(window.location.search).get('lang');
  if (q === 'es' || q === 'en' || q === 'pt-BR' || q === 'pt') return (q === 'pt' ? 'pt-BR' : q) as Lang;
  const n = (navigator.language || 'en').toLowerCase();
  return n.startsWith('es') ? 'es' : n.startsWith('pt') ? 'pt-BR' : 'en';
}

export default function Quote() {
  const { slug = '' } = useParams();
  const [L, setL] = useState<Lang>(startLang);
  const t = (k: string, p?: Record<string, string | number>) => translate(L, k, p);
  const [co, setCo] = useState<Co | null | undefined>(undefined);
  const [kind, setKind] = useState<'residential' | 'commercial'>('residential');
  const [beds, setBeds] = useState(3);
  const [baths, setBaths] = useState(2);
  const [sqft, setSqft] = useState('');
  const [freq, setFreq] = useState<Freq>('biweekly');
  const [f, setF] = useState({ name: '', phone: '', email: '', address: '', message: '', website: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  useEffect(() => {
    supabase.rpc('public_company', { p_slug: slug }).then(({ data }) => {
      const c = ((data || []) as Co[])[0] || null;
      setCo(c);
      if (c?.mode === 'commercial') setKind('commercial');
    });
  }, [slug]);
  useEffect(() => { document.title = co ? `${co.name} · ${t('qp.title')}` : 'Tidyo'; }, [co, L]); // eslint-disable-line react-hooks/exhaustive-deps

  const est = useMemo(() => {
    if (!co || kind !== 'residential') return 0;
    const pr = pricingOf(co.pricing);
    const base = round5(pr.res_base + beds * pr.res_bed + baths * pr.res_bath);
    return freq === 'deep' || freq === 'move' ? round5(base * pr.res_deep) : base;
  }, [co, kind, beds, baths, freq]);

  const send = async () => {
    setError('');
    if (!f.name.trim()) { setError(t('qp.needName')); return; }
    if (!f.phone.trim() && !f.email.trim()) { setError(t('qp.needContact')); return; }
    setBusy(true);
    const ref = new URLSearchParams(window.location.search);
    const { error: e } = await supabase.rpc('submit_lead', {
      p_slug: slug, p_website: f.website || null,
      p: { kind, name: f.name.trim(), phone: f.phone.trim(), email: f.email.trim(), address: f.address.trim(), message: f.message.trim(), language: L,
        bedrooms: kind === 'residential' ? beds : null, bathrooms: kind === 'residential' ? baths : null, square_feet: kind === 'commercial' && sqft ? Number(sqft.replace(/\D/g, '')) : null,
        frequency: kind === 'residential' ? freq : null, estimate_cents: est || null, source: ref.get('utm_source') || ref.get('src') || null },
    });
    setBusy(false);
    if (e) setError(/rate_limited/.test(e.message) ? t('qp.tooMany') : /lead_contact/.test(e.message) ? t('qp.needContact') : t('qp.fail'));
    else { setSent(true); window.scrollTo(0, 0); }
  };

  const up = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const freqs: Freq[] = ['weekly', 'biweekly', 'monthly', 'once', 'deep', 'move'];

  const langBar = (
    <div role="group" aria-label="Language" style={{ display: 'flex', gap: 2, background: '#E4ECEA', borderRadius: 10, padding: 3, flex: 'none' }}>
      {LANGS.map(([l, label]) => <button key={l} aria-pressed={L === l} onClick={() => setL(l)} style={{ minWidth: 36, minHeight: 34, borderRadius: 8, border: 0, background: L === l ? '#FFFFFF' : 'transparent', color: L === l ? C.ink : C.muted, fontWeight: 800, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>{label}</button>)}
    </div>
  );

  if (co === undefined) return <div className="k-screen"><main className="k-page" style={{ gap: 14, paddingTop: 24 }}><div className="skeleton" style={{ height: 56, borderRadius: 16 }} /><div className="skeleton" style={{ height: 320, borderRadius: 18 }} /></main></div>;
  if (co === null) return (
    <div className="k-screen"><main className="k-page" style={{ gap: 14, paddingTop: 48, textAlign: 'center', alignItems: 'center' }}>
      <h1 style={{ ...display, fontSize: 24, margin: 0 }}>{t('qp.notFound')}</h1>
      <p style={{ margin: 0, color: C.muted, fontSize: 14 }}>{t('qp.notFoundText')}</p>
      <ByYehi />
    </main></div>
  );

  return (
    <div className="k-screen">
      <main className="k-page" style={{ gap: 16, paddingTop: 20, paddingBottom: 32 }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ width: 48, height: 48, borderRadius: 14, background: C.brand, color: '#FFFFFF', ...display, fontSize: 16, display: 'grid', placeItems: 'center', flex: 'none' }}>{initials(co.name)}</span>
          <span style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
            <b className="k-ell" style={{ fontSize: 16 }}>{co.name}</b>
            <span className="k-ell" style={{ fontSize: 12.5, color: C.muted }}>{t('qp.title')}{co.state ? ` · ${co.state}` : ''}</span>
          </span>
          {langBar}
        </header>

        {sent ? (
          <section className="k-card" style={{ gap: 10, padding: 20, alignItems: 'center', textAlign: 'center' }}>
            <span style={{ width: 56, height: 56, borderRadius: 56, background: '#DDF1EC', display: 'grid', placeItems: 'center', color: C.accent, fontSize: 26, fontWeight: 800 }}>✓</span>
            <h1 style={{ ...display, fontSize: 22, margin: 0 }}>{t('qp.sentT')}</h1>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: C.muted }}>{t('qp.sentS', { company: co.name })}</p>
          </section>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <h1 style={{ ...display, fontSize: 26, lineHeight: 1.15, margin: 0 }}>{t('qp.h1')}</h1>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: C.muted }}>{t('qp.sub', { company: co.name })}</p>
            </div>

            <section className="k-card" style={{ gap: 14 }}>
              {co.mode === 'both' && (
                <div className="k-seg" role="group" aria-label={t('qp.kind')} style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                  <button type="button" aria-pressed={kind === 'residential'} onClick={() => setKind('residential')}>{t('qp.home')}</button>
                  <button type="button" aria-pressed={kind === 'commercial'} onClick={() => setKind('commercial')}>{t('qp.business')}</button>
                </div>
              )}
              {kind === 'residential' ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                    <label className="k-field"><span>{t('qp.beds')}</span><Stepper value={beds} onChange={setBeds} min={0} max={10} label={t('qp.beds')} /></label>
                    <label className="k-field"><span>{t('qp.baths')}</span><Stepper value={baths} onChange={setBaths} min={1} max={10} step={0.5} label={t('qp.baths')} /></label>
                  </div>
                  <span className="k-lbl">{t('qp.freq')}</span>
                  <div className="k-optgrid">
                    {freqs.map((x) => <button key={x} type="button" aria-pressed={freq === x} onClick={() => setFreq(x)}>{t(`qp.f.${x}`)}</button>)}
                  </div>
                  {est > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#E3F1EE', borderRadius: 14, padding: '12px 14px' }}>
                      <span style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                        <span style={{ fontSize: 12, fontWeight: 800, color: '#0B6B5F' }}>{t('qp.estimate')}</span>
                        <span style={{ fontSize: 12, color: '#2F4A45', lineHeight: 1.4 }}>{t('qp.estimateNote')}</span>
                      </span>
                      <b className="num nw" style={{ ...display, fontSize: 22, color: '#0B6B5F' }}>{t('qp.from', { v: usd(est) })}</b>
                    </div>
                  )}
                </>
              ) : (
                <label className="k-field"><span>{t('qp.sqft')}</span><input className="k-input" inputMode="numeric" value={sqft} onChange={(e) => setSqft(e.target.value)} placeholder="4,000" /><span className="k-help">{t('qp.comNote')}</span></label>
              )}
            </section>

            <section className="k-card" style={{ gap: 12 }}>
              <label className="k-field"><span>{t('qp.name')}</span><input className="k-input" autoComplete="name" value={f.name} onChange={up('name')} /></label>
              <label className="k-field"><span>{t('qp.phone')}</span><input className="k-input" type="tel" autoComplete="tel" inputMode="tel" value={f.phone} onChange={up('phone')} placeholder="(203) 555-0101" /></label>
              <label className="k-field"><span>{t('qp.email')}</span><input className="k-input" type="email" autoComplete="email" inputMode="email" value={f.email} onChange={up('email')} /></label>
              <label className="k-field"><span>{t('qp.address')}</span><input className="k-input" autoComplete="street-address" value={f.address} onChange={up('address')} placeholder="12 Elm St, Waterbury, CT" /></label>
              <label className="k-field"><span>{t('qp.message')}</span><textarea className="k-input" rows={3} value={f.message} onChange={up('message')} placeholder={t('qp.messagePh')} style={{ minHeight: 84, resize: 'none' }} /></label>
              {/* honeypot: people never see it, bots fill it */}
              <input tabIndex={-1} autoComplete="off" aria-hidden="true" value={f.website} onChange={up('website')} name="website" style={{ position: 'absolute', left: -9999, width: 1, height: 1, opacity: 0 }} />
              {error && <span className="k-err" role="alert">{error}</span>}
              <button className="k-btn k-btn-fill k-btn-big" disabled={busy} onClick={send}>{busy ? '…' : t('qp.send')}</button>
              <span className="k-help" style={{ textAlign: 'center' }}>{t('qp.privacy', { company: co.name })}</span>
            </section>
          </>
        )}
        <div style={{ display: 'flex', justifyContent: 'center' }}><ByYehi /></div>
      </main>
    </div>
  );
}
