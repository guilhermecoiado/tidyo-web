import { useState } from 'react';
import { useApp } from '../lib/session';
import { dismissInstall, promptInstall, useInstall } from '../lib/install';
import { Icon, Logo, Sheet } from './ui';

// Shown after signup on phones that are not running the installed app yet.
export function InstallCard() {
  const { t, toast } = useApp();
  const offer = useInstall();
  const [steps, setSteps] = useState(false);
  const [hidden, setHidden] = useState(false);
  if (!offer || hidden) return null;
  const ios = offer.platform === 'ios' || offer.platform === 'ios-inapp';
  const install = async () => {
    if (offer.canPrompt) {
      const r = await promptInstall();
      if (r === 'accepted') { toast(t('inst.done')); setHidden(true); }
      else if (r === 'unavailable') setSteps(true);
      return;
    }
    setSteps(true);
  };
  return (
    <>
      <section className="install-card" aria-labelledby="inst-h">
        <Logo size={44} />
        <div className="grow stack" style={{ gap: 2 }}>
          <span id="inst-h" className="bold">{t('inst.title')}</span>
          <span className="small" style={{ opacity: 0.8 }}>{t('inst.text')}</span>
          <div className="row" style={{ gap: 8, marginTop: 8 }}>
            <button className="btn btn-sm install-btn" onClick={install}>
              <Icon name={ios ? 'share' : 'download'} size={17} />{offer.canPrompt ? t('inst.btn') : t('inst.how')}
            </button>
            <button className="link-btn" style={{ color: '#9DD9CD', minHeight: 40 }} onClick={() => { dismissInstall(); setHidden(true); }}>{t('inst.later')}</button>
          </div>
        </div>
      </section>
      {steps && (
        <Sheet title={ios ? t('inst.iosTitle') : t('inst.androidTitle')} onClose={() => setSteps(false)}>
          {offer.platform === 'ios-inapp' && <div className="strip" style={{ background: 'var(--warn-bg)', borderColor: '#F3DDB8', color: 'var(--warn-fg)' }}>{t('inst.iosSafari')}</div>}
          <ol className="steps">
            {(ios ? [['share', t('inst.ios1')], ['plus', t('inst.ios2')], ['check', t('inst.ios3')]] : [['more', t('inst.android1')], ['download', t('inst.android2')]]).map(([icon, text], i) => (
              <li key={i}><span className="step-n">{i + 1}</span><span className="grow">{text}</span><Icon name={icon} size={20} color="var(--action)" /></li>
            ))}
          </ol>
          <button className="btn btn-primary" onClick={() => { setSteps(false); }}>OK</button>
        </Sheet>
      )}
    </>
  );
}
