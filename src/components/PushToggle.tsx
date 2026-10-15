import { useEffect, useState } from 'react';
import { useApp } from '../lib/session';
import { disablePush, enablePush, pushStatus } from '../lib/push';
import { Icon } from './ui';

// "Avisos no celular": subscribe this device to web push.
export function PushToggle() {
  const { t, session, toast } = useApp();
  const [status, setStatus] = useState<'unsupported' | 'install' | 'denied' | 'on' | 'off' | null>(null);
  useEffect(() => { pushStatus().then(setStatus).catch(() => setStatus('unsupported')); }, []);
  if (!status || status === 'unsupported') return null;
  const toggle = async () => {
    if (status === 'on') { await disablePush(); setStatus('off'); toast(t('push.off')); return; }
    if (!session) return;
    const ok = await enablePush(session.user.id).catch(() => false);
    setStatus(ok ? 'on' : await pushStatus());
    toast(ok ? t('push.on') : t('push.denied'));
  };
  return (
    <section className="card stack" style={{ gap: 8 }}>
      <div className="row"><Icon name="bell" /><span className="bold grow">{t('push.title')}</span>
        {status === 'on' && <span className="badge b-ok">{t('sec.enabled')}</span>}</div>
      <span className="small muted">{status === 'install' ? t('push.install') : status === 'denied' ? t('push.blocked') : t('push.hint')}</span>
      {(status === 'on' || status === 'off') && <button className="btn btn-secondary" onClick={toggle}>{status === 'on' ? t('push.turnOff') : t('push.turnOn')}</button>}
    </section>
  );
}
