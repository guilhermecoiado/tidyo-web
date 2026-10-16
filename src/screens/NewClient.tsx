// Novo cliente — canvas NovoCliente (residential / commercial walkthrough, Tidy estimate, portal access, fixed actions)
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useApp } from '../lib/session';
import { Confirm, Sheet } from '../components/ui';
import { TimeField } from '../components/pickers';
import { archiveClient } from '../lib/data';
import { C, Head, Segment, Svg, SPARK, usd } from '../components/kit';
import { addDays, randomToken, sha256Hex } from '../lib/format';
import { compressImage } from '../lib/photos';
import type { Lang } from '../lib/i18n';

export const PRICING = { res_base: 9500, res_bed: 2000, res_bath: 2500, res_deep: 1.75, res_pet_min: 15, com_sqft_hour: 2500, com_cost_hour: 4200, com_margin: 0.3 };
export const pricingOf = (p?: Record<string, number>) => ({ ...PRICING, ...(p || {}) });
const fmtH = (m: number) => `${Math.floor(m / 60)}h${String(Math.round(m % 60)).padStart(2, '0')}`;
const round5 = (cents: number) => Math.round(cents / 500) * 500;

/** "990 Dixwell Ave, Hamden, CT 06514" → parts */
export function parseAddress(s: string) {
  const m = s.trim().match(/^(.+?),\s*([^,]+?),\s*([A-Za-z]{2})\.?\s*(\d{5})(?:-\d{4})?\s*(?:,?\s*(USA|US|United States))?$/i);
  return m ? { line1: m[1].trim(), city: m[2].trim(), state: m[3].toUpperCase(), zip: m[4] } : null;
}

export default function NewClient() {
  const { t, tErr, lang: uiLang, company, toast } = useApp();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const editId = params.get('edit');
  const pr = pricingOf(company?.pricing);
  const [kind, setKind] = useState<'residential' | 'commercial'>(company?.mode === 'commercial' ? 'commercial' : 'residential');
  const isCom = kind === 'commercial';
  const [f, setF] = useState({ name: '', contact: '', phone: '', email: '', address: '', access: '', notes: '', after: '' });
  const [lang, setLang] = useState<Lang | 'raw'>((company?.default_language as Lang) || 'en');
  const [res, setRes] = useState({ beds: 3, baths: 2, sqft: 1800 });
  const [com, setCom] = useState({ sqft: 4000, rooms: 8, baths: 2 });
  const [resChips, setResChips] = useState<Record<string, boolean>>({});
  const [floors, setFloors] = useState<Record<string, boolean>>({ vinyl: true });
  const [days, setDays] = useState<Record<number, boolean>>({ 1: true, 3: true, 5: true });
  const [photos, setPhotos] = useState<{ path: string; url: string; label: string }[]>([]);
  const [portal, setPortal] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState<{ id: string; contract: boolean; link: string; geo: boolean } | null>(null);
  const [askDel, setAskDel] = useState(false);
  const [edit, setEdit] = useState<{ propertyId: string | null; portal: boolean } | null>(null);

  useEffect(() => {
    if (!editId) return;
    supabase.from('clients').select('id, kind, name, contact_name, email, phone, language, no_translate, notes, portal_user_id, properties(id, address_line1, city, state, zip, access_instructions, pets, special_instructions, bedrooms, bathrooms, square_feet, arrive_after)').eq('id', editId).maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        const c = data as unknown as { kind: 'residential' | 'commercial'; name: string; contact_name: string | null; email: string | null; phone: string | null; language: Lang; no_translate: boolean; notes: string | null; portal_user_id: string | null; properties: { id: string; address_line1: string; city: string; state: string; zip: string; access_instructions: string | null; pets: string | null; special_instructions: string | null; bedrooms: number | null; bathrooms: number | null; square_feet: number | null; arrive_after: string | null }[] };
        const p = c.properties[0];
        setKind(c.kind); setLang(c.no_translate ? 'raw' : c.language);
        setF({ name: c.name, contact: c.contact_name || '', phone: c.phone || '', email: c.email || '', address: p ? `${p.address_line1}, ${p.city}, ${p.state} ${p.zip}` : '', access: p?.access_instructions || '', notes: c.notes || '', after: p?.arrive_after ? p.arrive_after.slice(0, 5) : '' });
        if (p) {
          if (c.kind === 'commercial') setCom({ sqft: p.square_feet || 0, rooms: p.bedrooms || 0, baths: Number(p.bathrooms || 0) });
          else setRes({ beds: p.bedrooms || 0, baths: Number(p.bathrooms || 0), sqft: p.square_feet || 0 });
        }
        setEdit({ propertyId: p?.id || null, portal: !!c.portal_user_id });
      });
  }, [editId]);

  const up = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const addr = parseAddress(f.address);
  const resChipDefs: [string, string][] = [['dog', t('nc.dog')], ['cat', t('nc.cat')], ['unscented', t('nc.unscented')], ['stairs', t('nc.stairs')]];
  const floorDefs: [string, string][] = [['vinyl', t('nc.vinyl')], ['carpet', t('nc.carpet')], ['tile', t('nc.tile')], ['wood', t('nc.wood')], ['concrete', t('nc.concrete')]];
  const dayNames = Array.from({ length: 7 }, (_, i) => new Date(2023, 0, 2 + i).toLocaleDateString(uiLang, { weekday: 'narrow' }));

  const est = useMemo(() => {
    if (isCom) {
      const nFloors = Object.values(floors).filter(Boolean).length;
      const minutes = (com.sqft / pr.com_sqft_hour) * 60 + com.baths * 12 + nFloors * 5;
      const perVisit = round5(((minutes / 60) * pr.com_cost_hour) / (1 - pr.com_margin));
      const visits = Object.values(days).filter(Boolean).length * 4.33;
      return { minutes, price: perVisit, third: Math.round(perVisit * visits), thirdLabel: t('nc.perMonth'), note: t('nc.estCom', { sqft: pr.com_sqft_hour.toLocaleString('en-US'), cost: usd(pr.com_cost_hour), m: Math.round(pr.com_margin * 100) }), hoursWeek: (minutes / 60) * Object.values(days).filter(Boolean).length };
    }
    const pets = resChips.dog || resChips.cat;
    const minutes = 45 + res.beds * 20 + res.baths * 25 + (pets ? pr.res_pet_min : 0);
    const price = round5(pr.res_base + res.beds * pr.res_bed + res.baths * pr.res_bath);
    return { minutes, price, third: round5(price * pr.res_deep), thirdLabel: 'Deep clean', note: t('nc.estRes', { n: pr.res_pet_min }), hoursWeek: 0 };
  }, [isCom, com, res, resChips, floors, days, pr, t]);

  const addPhoto = async (file: File) => {
    if (!company) return;
    try {
      const blob = await compressImage(file);
      const path = `${company.id}/walkthrough/${crypto.randomUUID()}.jpg`;
      const { error } = await supabase.storage.from('company-assets').upload(path, blob, { contentType: 'image/jpeg' });
      if (error) throw error;
      setPhotos([...photos, { path, url: URL.createObjectURL(blob), label: t('nc.photoN', { n: photos.length + 1 }) }]);
    } catch { toast(t('ck.photoFail')); }
  };

  const save = async (mode: 'primary' | 'secondary') => {
    if (!company) return;
    setError('');
    if (!f.name.trim()) { setError(t('nc.needName')); return; }
    if (!addr) { setError(t('nc.needAddress')); return; }
    setBusy(true);
    const clientRow = { kind, name: f.name.trim(), contact_name: isCom ? f.contact || null : null, email: f.email || null, phone: f.phone || null,
      language: lang === 'raw' ? company.default_language : lang, no_translate: lang === 'raw', notes: f.notes || null };
    const pets = [resChips.dog ? t('nc.dog') : '', resChips.cat ? t('nc.cat') : ''].filter(Boolean).join(', ') || null;
    const special = isCom ? null : [resChips.unscented ? t('nc.unscented') : '', resChips.stairs ? t('nc.stairs') : ''].filter(Boolean).join(' · ') || null;
    const propRow = { address_line1: addr.line1, city: addr.city, state: addr.state, zip: addr.zip, access_instructions: f.access || null, arrive_after: f.after || null,
      bedrooms: isCom ? com.rooms : res.beds, bathrooms: isCom ? com.baths : res.baths, square_feet: isCom ? com.sqft : res.sqft,
      ...(isCom ? {} : { pets, special_instructions: special }) };
    try {
      let clientId = editId || '', propertyId = edit?.propertyId || '';
      if (editId) {
        const { error: e1 } = await supabase.from('clients').update(clientRow).eq('id', editId);
        if (e1) throw e1;
        if (propertyId) { const { error: e2 } = await supabase.from('properties').update({ ...propRow, lat: null, lng: null }).eq('id', propertyId); if (e2) throw e2; }
        else { const { data, error: e2 } = await supabase.from('properties').insert({ ...propRow, company_id: company.id, client_id: editId }).select('id').single(); if (e2) throw e2; propertyId = data.id; }
      } else {
        const { data: c, error: e1 } = await supabase.from('clients').insert({ ...clientRow, company_id: company.id }).select('id').single();
        if (e1) throw e1;
        clientId = c.id;
        const { data: p, error: e2 } = await supabase.from('properties').insert({ ...propRow, company_id: company.id, client_id: clientId }).select('id').single();
        if (e2) throw e2;
        propertyId = p.id;
      }
      // address on the map, for routes and check-in
      const geo = await supabase.functions.invoke('geocode', { body: { table: 'properties', ids: [propertyId] } }).then(({ data }) => !!data?.results?.[0]?.ok).catch(() => false);
      let contract = false;
      if (isCom && !editId) {
        const weekdays = Object.entries(days).filter(([, v]) => v).map(([k]) => Number(k));
        const { error: e3 } = await supabase.from('contracts').insert({
          company_id: company.id, client_id: clientId, property_id: propertyId, status: 'proposal', monthly_value_cents: est.third,
          hours_per_week: Math.round(est.hoursWeek * 100) / 100,
          walkthrough: { sqft: com.sqft, rooms: com.rooms, baths: com.baths, floors: Object.keys(floors).filter((k) => floors[k]), weekdays, after: '18:00', photos: photos.map((p) => p.path), minutes: Math.round(est.minutes), per_visit_cents: est.price },
        });
        if (e3) throw e3;
        contract = true;
      }
      let link = '';
      if (portal && !edit?.portal && (f.email || f.phone)) {
        const token = randomToken();
        await supabase.from('clients').update({ portal_invite_hash: await sha256Hex(token), portal_invite_expires_at: addDays(new Date(), 7).toISOString() }).eq('id', clientId);
        link = `${window.location.origin}/portal/convite?t=${token}`;
      }
      setBusy(false);
      if (mode === 'secondary' && !isCom && !link) { toast(t('c.saved')); nav('/app/clientes'); return; }
      setSaved({ id: clientId, contract, link, geo });
    } catch (e) { setBusy(false); setError(tErr((e as Error).message)); }
  };

  const counters = isCom
    ? [[t('nc.area'), t('nc.inSqft'), com.sqft, (v: number) => setCom({ ...com, sqft: Math.max(0, v) }), 200], [t('nc.rooms'), t('nc.roomsHint'), com.rooms, (v: number) => setCom({ ...com, rooms: Math.max(0, v) }), 1], [t('nc.baths'), '', com.baths, (v: number) => setCom({ ...com, baths: Math.max(0, v) }), 1]] as const
    : [[t('nc.beds'), '', res.beds, (v: number) => setRes({ ...res, beds: Math.max(0, v) }), 1], [t('nc.baths'), t('nc.bathsHint'), res.baths, (v: number) => setRes({ ...res, baths: Math.max(0, v) }), 1], [t('nc.size'), t('nc.inSqft'), res.sqft, (v: number) => setRes({ ...res, sqft: Math.max(0, v) }), 100]] as const;
  const share = saved?.link ? t('pt.waText', { company: company?.name || '', link: saved.link }) : '';

  return (
    <div className="k-screen">
      <main className="k-page footer" style={{ gap: 18 }}>
        <Head title={editId ? t('cl.edit') : t('cl.new')} back={() => (window.history.length > 1 ? nav(-1) : nav('/app/clientes'))} closeIcon />
        {!editId && <Segment value={kind} onChange={setKind} label={t('cl.kind')} options={[{ value: 'residential', label: t('cl.res') }, { value: 'commercial', label: t('cl.com') }]} />}

        <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <span className="k-sec"><span>{t('nc.contact')}</span></span>
          <label className="k-field"><span>{isCom ? t('nc.companyName') : t('nc.clientName')}</span><input className="k-input" value={f.name} onChange={up('name')} autoComplete="off" /></label>
          {isCom && <label className="k-field"><span>{t('nc.onSite')}</span><input className="k-input" value={f.contact} onChange={up('contact')} /></label>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
            <label className="k-field"><span>{t('nc.phone')}</span><input className="k-input" type="tel" value={f.phone} onChange={up('phone')} placeholder="(203) 555-0148" autoComplete="off" /></label>
            <label className="k-field"><span>Email</span><input className="k-input" type="email" value={f.email} onChange={up('email')} autoComplete="off" /></label>
          </div>
          <label className="k-field"><span>{t('nc.address')}</span>
            <input className="k-input" value={f.address} onChange={up('address')} placeholder="990 Dixwell Ave, Hamden, CT 06514" autoComplete="off" />
            <span style={{ fontSize: 12, fontWeight: 600, color: addr ? '#0B6B5F' : C.muted }}>{addr ? t('nc.addrOk', { city: addr.city, state: addr.state }) : t('nc.addrHint')}</span>
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span className="k-lbl">{t('nc.lang')}</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6 }}>
              {([['pt-BR', 'Português'], ['en', 'English'], ['es', 'Español'], ['raw', t('nc.noTranslate')]] as const).map(([id, label]) => (
                <button key={id} className="k-chip" aria-pressed={lang === id} onClick={() => setLang(id)} style={{ minHeight: 44, borderRadius: 12, justifyContent: 'center', fontSize: 13 }}>{label}</button>
              ))}
            </div>
            <span className="k-help" style={{ fontSize: 12 }}>{lang === 'raw' ? t('nc.rawNote') : t('nc.langNote')}</span>
          </div>
        </section>

        <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <span className="k-sec"><span>{isCom ? t('nc.space') : t('nc.house')}</span>{isCom && <span style={{ fontSize: 12, fontWeight: 800, color: '#0B6B5F' }}>{t('nc.walkthrough')}</span>}</span>
          <div style={{ background: '#FFFFFF', border: `1px solid ${C.line}`, borderRadius: 16, padding: '0 12px' }}>
            {counters.map(([label, hint, v, set, step], i) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 60, borderTop: i ? `1px solid ${C.soft}` : 0 }}>
                <span style={{ display: 'flex', flexDirection: 'column', flex: 1 }}><span style={{ fontWeight: 700, fontSize: 14 }}>{label}</span>{hint && <span style={{ fontSize: 12, color: C.muted }}>{hint}</span>}</span>
                <button className="k-step" aria-label={`− ${label}`} onClick={() => set(v - step)}>−</button>
                <span className="num" style={{ minWidth: 48, textAlign: 'center', fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 18, fontWeight: 700 }}>{v.toLocaleString('en-US')}</span>
                <button className="k-step" aria-label={`+ ${label}`} onClick={() => set(v + step)}>+</button>
              </div>
            ))}
          </div>
          <span style={{ fontSize: 13, fontWeight: 800 }}>{isCom ? t('nc.floors') : t('nc.details')}</span>
          <div className="k-chips">
            {(isCom ? floorDefs : resChipDefs).map(([k, label]) => {
              const st = isCom ? floors : resChips, set = isCom ? setFloors : setResChips;
              return <button key={k} className="k-chip" style={{ minHeight: 40 }} aria-pressed={!!st[k]} onClick={() => set({ ...st, [k]: !st[k] })}>{label}</button>;
            })}
          </div>
          {isCom ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 800 }}>{t('nc.cleanDays')}</span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 4 }}>
                {[1, 2, 3, 4, 5, 6, 0].map((d) => <button key={d} className="k-chip" aria-pressed={!!days[d]} onClick={() => setDays({ ...days, [d]: !days[d] })} style={{ minHeight: 44, borderRadius: 12, justifyContent: 'center', padding: 0, fontSize: 12 }}>{dayNames[(d + 6) % 7]}</button>)}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6 }}>
                {photos.map((p) => <div key={p.path} style={{ height: 76, borderRadius: 12, background: `#DCE7E4 url(${p.url}) center/cover`, display: 'flex', alignItems: 'flex-end', padding: 6, boxSizing: 'border-box', fontSize: 11, fontWeight: 800, color: '#FFFFFF', textShadow: '0 1px 2px rgba(0,0,0,.5)' }}>{p.label}</div>)}
                <label style={{ height: 76, borderRadius: 12, border: '1px dashed #9DB5B0', background: '#FFFFFF', color: C.accent, fontWeight: 800, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  + {t('nc.photo')}<input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => e.target.files?.[0] && addPhoto(e.target.files[0])} />
                </label>
              </div>
            </div>
          ) : (
            <label className="k-field"><span>{t('nc.access')}</span><input className="k-input" value={f.access} onChange={up('access')} placeholder={t('nc.accessPh')} /></label>
          )}
          {isCom && <label className="k-field"><span>{t('nc.access')}</span><input className="k-input" value={f.access} onChange={up('access')} /></label>}
          <div className="k-field">
            <span>{t('nc.after')}</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ flex: 1, minWidth: 0 }}><TimeField value={f.after} onChange={(v) => setF({ ...f, after: v })} label={t('nc.after')} from={6} to={20} /></div>
              {f.after && <button type="button" className="k-btn k-btn-line" style={{ flex: 'none' }} onClick={() => setF({ ...f, after: '' })}>{t('nc.afterNone')}</button>}
            </div>
            <span className="k-help" style={{ fontSize: 12 }}>{t('nc.afterHint')}</span>
          </div>
        </section>

        <div className="k-dark" style={{ borderRadius: 18, padding: '14px 16px', gap: 8 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 14 }}><Svg d={SPARK} size={16} color={C.mint} />{t('nc.estimate')}</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
            {[[t('nc.perVisit'), fmtH(est.minutes), '#EAF3F1'], [t('nc.price'), usd(est.price), '#EAF3F1'], [est.thirdLabel, usd(est.third), C.mint]].map(([k, v, c]) => (
              <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><span style={{ fontSize: 11, fontWeight: 800, color: C.faint, textTransform: 'uppercase' }}>{k}</span><span className="num nw" style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 20, fontWeight: 700, color: c }}>{v}</span></div>
            ))}
          </div>
          <span style={{ fontSize: 12, color: C.faint, lineHeight: 1.45 }}>{est.note} <Link to="/app/mais/precos" style={{ color: C.mint }}>{t('nc.editParams')}</Link></span>
        </div>

        {!edit?.portal && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#FFFFFF', border: `1px solid ${C.line}`, borderRadius: 16, padding: '12px 14px', cursor: 'pointer' }} className="check">
            <span style={{ display: 'flex', flexDirection: 'column', flex: 1 }}><span style={{ fontWeight: 800, fontSize: 14 }}>{t('nc.portal')}</span><span style={{ fontSize: 12, color: C.muted }}>{t('nc.portalHint')}</span></span>
            <input type="checkbox" checked={portal} onChange={() => setPortal(!portal)} />
          </label>
        )}
        <label className="k-field"><span>{t('cl.notes')}</span><textarea className="k-input" style={{ minHeight: 72 }} value={f.notes} onChange={up('notes')} placeholder={t('nc.notesPh')} /></label>
        {error && <span className="k-err" role="alert">{error}</span>}
      </main>

      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, background: '#FFFFFF', borderTop: `1px solid ${C.line}`, zIndex: 20, padding: '12px 16px calc(16px + env(safe-area-inset-bottom))' }}>
        <div style={{ maxWidth: 528, margin: '0 auto', display: 'flex', gap: 10 }}>
          {!editId ? <button className="k-btn k-btn-line k-btn-big" style={{ flex: 'none', fontSize: 14 }} disabled={busy} onClick={() => save('secondary')}>{isCom ? t('nc.proposal') : t('nc.draft')}</button>
            : <button className="k-btn k-btn-line k-btn-big" style={{ flex: 'none', fontSize: 14, color: '#9F1F14' }} disabled={busy} onClick={() => setAskDel(true)}>{t('c.delete')}</button>}
          <button className="k-btn k-btn-fill k-btn-big" style={{ flex: 1 }} disabled={busy} onClick={() => save('primary')}>{editId ? t('c.save') : isCom ? t('nc.saveContract') : t('nc.saveSchedule')}</button>
        </div>
      </div>

      {askDel && editId && <Confirm danger text={t('cl.deleteAsk', { name: f.name })} confirmLabel={t('cl.delete')} onCancel={() => setAskDel(false)}
        onConfirm={async () => { setAskDel(false); try { await archiveClient(editId); toast(t('cl.deleted', { name: f.name })); nav('/app/clientes'); } catch (e) { toast(tErr((e as Error).message)); } }} />}
      {saved && (
        <Sheet title={t(isCom ? 'nc.savedCom' : 'nc.savedRes', { name: f.name })} onClose={() => nav('/app/clientes')}>
          <span style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.5 }}>
            {editId ? t('c.saved') : isCom ? t('nc.savedComText') : t('nc.savedResText')} {saved.geo ? t('nc.geoOk') : ''} {saved.link ? t('nc.portalShare') : ''}
          </span>
          {saved.link && (
            <div className="k-pair">
              {f.phone && <a className="k-btn k-btn-line" target="_blank" rel="noreferrer" href={`https://wa.me/${f.phone.replace(/\D/g, '')}?text=${encodeURIComponent(share)}`}>WhatsApp</a>}
              {f.email && <a className="k-btn k-btn-line" href={`mailto:${f.email}?subject=${encodeURIComponent(company?.name || 'Tidyo')}&body=${encodeURIComponent(share)}`}>Email</a>}
            </div>
          )}
          <div className="k-pair">
            <button className="k-btn k-btn-line" onClick={() => setSaved(null)}>{t('nc.keepEditing')}</button>
            {isCom ? <Link className="k-btn k-btn-fill" to="/app/contratos">{t('nc.seeContract')}</Link> : <Link className="k-btn k-btn-fill" to={`/app/agenda/novo?client=${saved.id}`}>{t('nc.scheduleNow')}</Link>}
          </div>
        </Sheet>
      )}
    </div>
  );
}
