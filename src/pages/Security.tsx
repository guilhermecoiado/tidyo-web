import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { useApp } from '../lib/session';
import { Field, Icon, Sheet, Wordmark } from '../components/ui';

type Factor = { id: string; status: string; factor_type: string };

// Two-step verification with an authenticator app (TOTP), plus data export and closing the business.
export function SecuritySection() {
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
      <section className="card stack">
        <div className="row"><Icon name="key" /><span className="bold grow">{t('sec.title')}</span>
          <span className={`badge ${factors.length ? 'b-ok' : 'b-neutral'}`}>{factors.length ? t('sec.enabled') : t('sec.disabled')}</span></div>
        <span className="small muted">{t('sec.hint')}</span>
        {factors.length ? <button className="btn btn-secondary" onClick={disable}>{t('sec.turnOff')}</button>
          : <button className="btn btn-secondary" onClick={start}>{t('sec.turnOn')}</button>}
      </section>
      {membership?.role === 'owner' && (
        <section className="card stack">
          <span className="bold">{t('sec.data')}</span>
          <button className="btn btn-secondary" onClick={exportData}><Icon name="receipt" size={18} />{t('sec.export')}</button>
          <button className="btn btn-ghost" style={{ color: 'var(--danger-fg)' }} onClick={() => setClosing(true)}>{t('sec.close')}</button>
        </section>
      )}
      {enroll && (
        <Sheet title={t('sec.turnOn')} onClose={() => setEnroll(null)}>
          <ol className="small" style={{ margin: 0, paddingLeft: 18 }}><li>{t('sec.step1')}</li><li>{t('sec.step2')}</li></ol>
          <img src={enroll.qr} alt="QR" style={{ width: 200, height: 200, alignSelf: 'center', background: '#fff', borderRadius: 12 }} />
          <span className="tiny muted" style={{ wordBreak: 'break-all', textAlign: 'center' }}>{enroll.secret}</span>
          <form className="stack" onSubmit={verify}>
            <Field label={t('sec.code')}><input className="input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} /></Field>
            <button className="btn btn-primary" disabled={code.trim().length !== 6}>{t('c.confirm')}</button>
          </form>
        </Sheet>
      )}
      {closing && (
        <Sheet title={t('sec.close')} onClose={() => setClosing(false)}>
          <p style={{ margin: 0 }}>{t('sec.closeText')}</p>
          <Field label={t('sec.typeLabel')}><input className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoCapitalize="characters" /></Field>
          <button className="btn btn-danger" disabled={!confirm.trim()} onClick={close}>{t('sec.closeBtn')}</button>
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
