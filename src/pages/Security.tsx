import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { useApp } from '../lib/session';
import { Field, Sheet, Wordmark } from '../components/ui';
import { C, I, PILL, Svg } from '../components/kit';

type Factor = { id: string; status: string; factor_type: string };

// Two-step verification with an authenticator app (TOTP), plus data export and closing the business.
export function SecuritySection({ admin = false }: { admin?: boolean }) {
  const { t, tErr, toast, company, membership } = useApp();
  const [factors, setFactors] = useState<Factor[]>([]);
  const [enroll, setEnroll] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState('');
  const [closing, setClosing] = useState(false);
  const [confirm, setConfirm] = useState('');
  const load = async () => {
    const { data } = await supabase.auth.mfa.listFactors();
    setFactors(((data?.totp || []) as Factor[]).filter((f) => f.status === 'verified'));
  };
  useEffect(() => { load(); }, []);

  const start = async () => {
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `Tidyo ${Date.now()}` });
    if (error || !data) { toast(tErr(error?.message)); return; }
    setEnroll({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  };
  const verify = async (e: FormEvent) => {
    e.preventDefault();
    if (!enroll) return;
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: enroll.id, code: code.trim() });
    if (error) { toast(t('sec.badCode')); return; }
    toast(t('sec.on')); setEnroll(null); setCode(''); load();
  };
  const disable = async () => {
    for (const f of factors) await supabase.auth.mfa.unenroll({ factorId: f.id });
    toast(t('sec.off')); load();
  };
  const exportData = async () => {
    if (!company) return;
    const tables = ['clients', 'properties', 'jobs', 'invoices', 'invoice_lines', 'payments', 'expenses', 'time_entries', 'contracts', 'inspections'];
    const out: Record<string, unknown> = { company, exported_at: new Date().toISOString() };
    for (const tb of tables) { const { data } = await supabase.from(tb).select('*').eq('company_id', company.id); out[tb] = data || []; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' }));
    a.download = `tidyo-${company.name.replace(/\W+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };
  const close = async () => {
    if (!company) return;
    const { error } = await supabase.rpc('close_company', { p_company: company.id, p_confirm: confirm });
    if (error) { toast(error.message.includes('confirm_text') ? t('sec.typeIt') : tErr(error.message)); return; }
    await supabase.auth.signOut(); window.location.replace('/');
  };

  return (
    <>
      <ChangePasswordCard />
      <section className="k-card" style={{ gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Svg d={I.lock} size={18} color={C.accent} />
          <b style={{ flex: 1, fontSize: 14.5 }}>{t('sec.title')}</b>
          <span className="k-pill" style={{ background: factors.length ? PILL.ok[0] : PILL.neutral[0], color: factors.length ? PILL.ok[1] : PILL.neutral[1] }}>{factors.length ? t('sec.enabled') : t('sec.disabled')}</span>
        </div>
        <span className="k-s125 k-muted" style={{ lineHeight: 1.45 }}>{t('sec.hint')}</span>
        {factors.length ? <button className="k-btn k-btn-line" onClick={disable}>{t('sec.turnOff')}</button>
          : <button className="k-btn k-btn-line" style={{ color: C.accent }} onClick={start}>{t('sec.turnOn')}</button>}
      </section>
      {!admin && membership?.role === 'owner' && (
        <section className="k-card" style={{ gap: 10 }}>
          <b style={{ fontSize: 14.5 }}>{t('sec.data')}</b>
          <button className="k-btn k-btn-line" style={{ gap: 8 }} onClick={exportData}><Svg d={I.receipt} size={16} />{t('sec.export')}</button>
          <button className="k-link" style={{ alignSelf: 'center', color: '#9F1F14' }} onClick={() => setClosing(true)}>{t('sec.close')}</button>
        </section>
      )}
      {enroll && (
        <Sheet title={t('sec.turnOn')} onClose={() => setEnroll(null)}>
          <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, lineHeight: 1.5, color: C.muted }}><li>{t('sec.step1')}</li><li>{t('sec.step2')}</li></ol>
          <img src={enroll.qr} alt="QR" style={{ width: 200, height: 200, alignSelf: 'center', background: '#fff', borderRadius: 12 }} />
          <span style={{ fontSize: 11.5, color: C.muted, wordBreak: 'break-all', textAlign: 'center' }}>{enroll.secret}</span>
          <form style={{ display: 'flex', flexDirection: 'column', gap: 12 }} onSubmit={verify}>
            <label className="k-field"><span>{t('sec.code')}</span><input className="k-input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} /></label>
            <button className="k-btn k-btn-fill" disabled={code.trim().length !== 6}>{t('c.confirm')}</button>
          </form>
        </Sheet>
      )}
      {closing && (
        <Sheet title={t('sec.close')} onClose={() => setClosing(false)}>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>{t('sec.closeText')}</p>
          <label className="k-field"><span>{t('sec.typeLabel')}</span><input className="k-input" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoCapitalize="characters" /></label>
          <button className="k-btn k-btn-danger" disabled={!confirm.trim()} onClick={close}>{t('sec.closeBtn')}</button>
        </Sheet>
      )}
    </>
  );
}

export function MfaPrompt({ onDone }: { onDone: () => void }) {
  const { t } = useApp();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const { data } = await supabase.auth.mfa.listFactors();
    const f = data?.totp?.find((x) => x.status === 'verified');
    if (!f) { onDone(); return; }
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: f.id, code: code.trim() });
    if (error) setError(t('sec.badCode')); else onDone();
  };
  return (
    <main className="auth-wrap">
      <Wordmark />
      <h1>{t('sec.prompt')}</h1>
      <p className="muted" style={{ margin: 0 }}>{t('sec.promptText')}</p>
      <form className="stack" onSubmit={submit}>
        <Field label={t('sec.code')}><input className="input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} autoFocus /></Field>
        {error && <p className="error-text" role="alert">{error}</p>}
        <button className="btn btn-primary btn-block" disabled={code.trim().length !== 6}>{t('auth.login')}</button>
        <button type="button" className="link-btn" onClick={async () => { await supabase.auth.signOut(); window.location.replace('/'); }}>{t('auth.signout')}</button>
      </form>
    </main>
  );
}

/** Change my password: confirms the current one first, then saves the new one */
export function ChangePasswordSheet({ onClose }: { onClose: () => void }) {
  const { t, tErr, toast } = useApp();
  const [cur, setCur] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const save = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (pw.length < 8) { setError(t('auth.weak')); return; }
    if (pw !== pw2) { setError(t('pw.mismatch')); return; }
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    const email = u.user?.email;
    if (email) {
      const { error: e1 } = await supabase.auth.signInWithPassword({ email, password: cur });
      if (e1) { setBusy(false); setError(t('pw.wrongCurrent')); return; }
    }
    const { error: e2 } = await supabase.auth.updateUser({ password: pw, data: { must_change_password: false } });
    setBusy(false);
    if (e2) setError(tErr(e2.message)); else { toast(t('pw.changed')); onClose(); }
  };
  return (
    <Sheet title={t('pw.title')} onClose={onClose}>
      <form style={{ display: 'flex', flexDirection: 'column', gap: 12 }} onSubmit={save}>
        <label className="k-field"><span>{t('pw.current')}</span><input className="k-input" type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} autoFocus /></label>
        <label className="k-field"><span>{t('auth.newPassword')}</span><input className="k-input" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /><span className="k-help">{t('auth.passwordHint')}</span></label>
        <label className="k-field"><span>{t('pw.repeat')}</span><input className="k-input" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></label>
        {error && <span role="alert" style={{ fontSize: 13, fontWeight: 700, color: '#B8400C' }}>{error}</span>}
        <button className="k-btn k-btn-fill" disabled={busy || !cur || !pw}>{t('auth.savePassword')}</button>
      </form>
    </Sheet>
  );
}

function ChangePasswordCard() {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  return (
    <section className="k-card" style={{ gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Svg d={I.lock} size={18} color={C.accent} /><b style={{ flex: 1, fontSize: 14.5 }}>{t('pw.title')}</b></div>
      <span className="k-s125 k-muted">{t('pw.hint')}</span>
      <button className="k-btn k-btn-line" style={{ color: C.accent }} onClick={() => setOpen(true)}>{t('pw.change')}</button>
      {open && <ChangePasswordSheet onClose={() => setOpen(false)} />}
    </section>
  );
}
