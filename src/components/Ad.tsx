// In-app sponsored content, in the four formats of the canvas: top banner, card with button, popup, fullscreen (skip after 5 s)
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useApp } from '../lib/session';
import { Svg, I } from './kit';

export type AdRow = {
  id: string; name: string; format: 'top_banner' | 'cta_card' | 'popup' | 'fullscreen'; media_type: string; media_path: string | null;
  content: Record<string, { title?: string; body?: string; cta?: string; brand?: string; bg?: string; accent?: string }>;
  cta_url: string | null; utm: Record<string, string>; close_after_seconds: number | null; targeting: { plans?: string[]; languages?: string[]; frequency?: 'daily' | 'once' | 'always' } | null;
};

const SEEN = 'tidyo.adsClosed';
const PER_DAY = 'tidyo.adsShown';
export const mediaUrl = (path: string | null) => (path ? supabase.storage.from('ad-media').getPublicUrl(path).data.publicUrl : '');

function readJson<T>(k: string, d: T): T { try { return JSON.parse(localStorage.getItem(k) || '') as T; } catch { return d; } }

/** Picks one running campaign for this person (plan, language, closed list, once a day for popups and fullscreen) */
export function useAd() {
  const { lang, session, company, sub } = useApp();
  const [ad, setAd] = useState<AdRow | null>(null);
  useEffect(() => {
    // sponsored content is only for accounts still on the free trial; paying customers and their team never see it
    if (!session || sub?.status !== 'trialing') { setAd(null); return; }
    const now = new Date().toISOString();
    supabase.from('ad_campaigns').select('id, name, format, media_type, media_path, content, cta_url, utm, close_after_seconds, targeting, starts_at, ends_at')
      .eq('status', 'running').limit(20).then(({ data }) => {
        const closed = readJson<string[]>(SEEN, []);
        const shown = readJson<Record<string, string>>(PER_DAY, {});
        const today = now.slice(0, 10);
        const plan = sub?.plan || '';
        const pick = ((data || []) as (AdRow & { starts_at: string | null; ends_at: string | null })[]).find((a) =>
          !closed.includes(a.id) && (!a.starts_at || a.starts_at <= now) && (!a.ends_at || a.ends_at > now) &&
          (!a.targeting?.plans?.length || a.targeting.plans.includes(plan) || (sub?.has_commercial && a.targeting.plans.includes('comercial'))) &&
          (!a.targeting?.languages?.length || a.targeting.languages.includes(lang)) &&
          !(a.targeting?.frequency === 'once' ? !!shown[a.id] : a.targeting?.frequency === 'always' ? false : (a.format === 'popup' || a.format === 'fullscreen') && shown[a.id] === today));
        if (!pick) return;
        setAd(pick);
        if (pick.format === 'popup' || pick.format === 'fullscreen' || pick.targeting?.frequency === 'once') { shown[pick.id] = today; try { localStorage.setItem(PER_DAY, JSON.stringify(shown)); } catch { /* ignore */ } }
        supabase.from('ad_events').insert({ campaign_id: pick.id, user_id: session.user.id, company_id: company?.id || null, event: 'impression' }).then(() => undefined);
      });
  }, [session, company, sub, lang]);
  const log = (event: 'click' | 'close') => { if (ad && session) supabase.from('ad_events').insert({ campaign_id: ad.id, user_id: session.user.id, company_id: company?.id || null, event }).then(() => undefined); };
  const close = () => {
    if (!ad) return;
    const c = readJson<string[]>(SEEN, []);
    try { localStorage.setItem(SEEN, JSON.stringify([...c, ad.id])); } catch { /* ignore */ }
    log('close'); setAd(null);
  };
  return { ad, close, click: () => log('click') };
}

function useCopy(ad: AdRow) {
  const { lang } = useApp();
  const c = ad.content?.[lang] || ad.content?.en || Object.values(ad.content || {})[0] || {};
  const href = ad.cta_url ? `${ad.cta_url}${ad.cta_url.includes('?') ? '&' : '?'}${new URLSearchParams(ad.utm || {}).toString()}` : undefined;
  return { ...c, bg: c.bg || '#15306E', accent: c.accent || '#F7B733', brand: c.brand || ad.name, href, media: mediaUrl(ad.media_path), video: ad.media_type === 'video' };
}

function Media({ src, video, style }: { src: string; video: boolean; style: React.CSSProperties }) {
  if (!src) return null;
  return video ? <video src={src} muted autoPlay loop playsInline style={{ objectFit: 'cover', ...style }} /> : <img src={src} alt="" style={{ objectFit: 'cover', ...style }} />;
}

function Sponsored({ style }: { style?: React.CSSProperties }) {
  const { t } = useApp();
  return <span style={{ position: 'absolute', fontSize: 10, fontWeight: 800, background: '#FFFFFF', color: '#3E4F4C', border: '1px solid #DFE7E5', borderRadius: 6, padding: '1px 6px', zIndex: 2, ...style }}>{t('adv.sponsored')}</span>;
}

/** Banner (92 px) or card with a button, placed inline on the home screen */
export function InlineAd({ ad, close, click }: { ad: AdRow; close: () => void; click: () => void }) {
  const { t } = useApp();
  const c = useCopy(ad);
  if (!c.title) return null;
  if (ad.format === 'top_banner') return (
    <div style={{ position: 'relative' }}>
      <a href={c.href} target="_blank" rel="noreferrer" onClick={click} aria-label={`${t('adv.sponsored')}: ${c.brand}, ${c.title}`}
        style={{ display: 'flex', alignItems: 'center', gap: 14, height: 92, borderRadius: 16, overflow: 'hidden', background: c.bg, color: '#FFFFFF', textDecoration: 'none', padding: '0 44px 0 14px', boxSizing: 'border-box' }}>
        {c.media ? <Media src={c.media} video={c.video} style={{ width: 74, height: 64, borderRadius: 10, flex: 'none' }} /> : (
          <div aria-hidden="true" style={{ position: 'relative', width: 74, height: 64, flex: 'none' }}>
            <div style={{ position: 'absolute', left: 4, top: 18, width: 60, height: 40, borderRadius: 10, background: c.accent, transform: 'rotate(-8deg)' }} />
            <div style={{ position: 'absolute', left: 12, top: 10, width: 60, height: 40, borderRadius: 10, background: '#4FC3F7', transform: 'rotate(6deg)' }} />
            <div style={{ position: 'absolute', left: 8, top: 2, width: 60, height: 40, borderRadius: 10, background: '#FFFFFF', transform: 'rotate(-2deg)' }} />
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: c.accent }} className="k-ell">{c.brand}</span>
          <span className="k-clamp2" style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 17, fontWeight: 700, lineHeight: 1.15 }}>{c.title}</span>
          {c.body && <span className="k-ell" style={{ fontSize: 11.5, color: '#C9D6F5' }}>{c.body}</span>}
        </div>
      </a>
      <Sponsored style={{ left: 10, top: -8 }} />
      <button onClick={close} aria-label={t('adv.close')} style={{ position: 'absolute', right: 0, top: 0, width: 44, height: 44, border: 0, background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
        <span style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(255,255,255,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Svg d={I.x} size={14} color="#FFFFFF" w={2.4} /></span>
      </button>
    </div>
  );
  if (ad.format !== 'cta_card') return null;
  return (
    <div style={{ background: '#FFFFFF', border: '1px solid #DFE7E5', borderRadius: 18, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div aria-hidden="true" style={{ position: 'relative', height: 128, background: c.bg, overflow: 'hidden' }}>
        {c.media ? <Media src={c.media} video={c.video} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} /> : <>
          <div style={{ position: 'absolute', right: -30, top: -40, width: 170, height: 170, borderRadius: 170, background: 'rgba(255,255,255,0.08)' }} />
          <div style={{ position: 'absolute', left: 28, top: 44, width: 96, height: 62, borderRadius: 14, background: c.accent, transform: 'rotate(-9deg)' }} />
          <div style={{ position: 'absolute', left: 46, top: 32, width: 96, height: 62, borderRadius: 14, background: '#4FC3F7', transform: 'rotate(7deg)' }} />
          <div style={{ position: 'absolute', left: 38, top: 20, width: 96, height: 62, borderRadius: 14, background: '#FFFFFF', transform: 'rotate(-2deg)' }} />
        </>}
        <Sponsored style={{ left: 10, top: 10, border: 0 }} />
      </div>
      <div style={{ padding: '14px 14px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#566965' }}>{c.brand}</span>
        <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 19, fontWeight: 700, lineHeight: 1.2, textWrap: 'balance' as never }}>{c.title}</span>
        {c.body && <span style={{ fontSize: 13.5, color: '#566965', lineHeight: 1.45 }}>{c.body}</span>}
        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          {c.href && <a href={c.href} target="_blank" rel="noreferrer" onClick={click} style={{ flex: 1, minHeight: 46, borderRadius: 13, background: c.bg, color: '#FFFFFF', fontWeight: 800, fontSize: 14, textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{c.cta || t('adv.see')}</a>}
          <button onClick={close} style={{ minHeight: 46, padding: '0 16px', borderRadius: 13, border: '1px solid #DFE7E5', background: '#FFFFFF', color: '#3E4F4C', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>{t('inst.later')}</button>
        </div>
      </div>
    </div>
  );
}

/** Popup and fullscreen formats, shown over the screen once a day */
export function OverlayAd({ ad, close, click }: { ad: AdRow; close: () => void; click: () => void }) {
  const { t } = useApp();
  const c = useCopy(ad);
  const [left, setLeft] = useState(ad.close_after_seconds ?? 5);
  useEffect(() => {
    if (ad.format !== 'fullscreen') return;
    const i = window.setInterval(() => setLeft((n) => Math.max(0, n - 1)), 1000);
    return () => window.clearInterval(i);
  }, [ad.format]);
  if (!c.title) return null;
  if (ad.format === 'popup') return (
    <div className="scrim center" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label={c.title} style={{ padding: 0, overflow: 'hidden', gap: 0 }}>
        <div style={{ height: 160, background: c.bg, position: 'relative' }}>
          <Media src={c.media} video={c.video} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
          <Sponsored style={{ left: 12, top: 12, border: 0 }} />
        </div>
        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span className="k-h2s">{c.title}</span>
          {c.body && <span className="k-muted" style={{ fontSize: 14, lineHeight: 1.5 }}>{c.body}</span>}
          {c.href && <a href={c.href} target="_blank" rel="noreferrer" onClick={() => { click(); close(); }} className="k-btn" style={{ background: c.bg, color: '#FFFFFF' }}>{c.cta || t('adv.see')}</a>}
          <button className="k-btn k-btn-line" onClick={close}>{t('inst.later')}</button>
        </div>
      </div>
    </div>
  );
  if (ad.format !== 'fullscreen') return null;
  return (
    <div role="dialog" aria-modal="true" aria-label={c.title} style={{ position: 'fixed', inset: 0, zIndex: 80, background: c.bg, color: '#FFFFFF', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '24px 20px calc(28px + env(safe-area-inset-bottom))', gap: 12 }}>
      <Media src={c.media} video={c.video} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.9 }} />
      <button onClick={left ? undefined : close} disabled={left > 0} aria-label={t('adv.close')}
        style={{ position: 'absolute', top: 'calc(16px + env(safe-area-inset-top))', right: 16, minHeight: 44, padding: '0 14px', fontSize: 13, fontWeight: 800, background: 'rgba(255,255,255,0.18)', color: '#FFFFFF', border: 0, borderRadius: 999, cursor: left ? 'default' : 'pointer', zIndex: 2, fontFamily: 'inherit' }}>
        {left ? t('adv.skipIn', { n: left }) : t('adv.skip')}
      </button>
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 520, margin: '0 auto', width: '100%' }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: c.accent, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{t('adv.sponsored')} · {c.brand}</span>
        <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 28, fontWeight: 700, lineHeight: 1.2 }}>{c.title}</span>
        {c.body && <span style={{ fontSize: 15, opacity: 0.9 }}>{c.body}</span>}
        {c.href && <a href={c.href} target="_blank" rel="noreferrer" onClick={() => { click(); close(); }} className="k-btn k-btn-big" style={{ background: c.accent, color: c.bg }}>{c.cta || t('adv.see')}</a>}
      </div>
    </div>
  );
}
