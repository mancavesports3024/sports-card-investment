import React, { useEffect, useState } from 'react';
import { readChoice, saveChoice } from '../loadDeferredGa';
import './PrivacyChoices.css';

export default function PrivacyChoices() {
  const [open, setOpen] = useState(() => !readChoice());
  const [settings, setSettings] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    const changed = () => setOpen(!readChoice());
    window.addEventListener('scorecard-privacy-change', changed);
    return () => window.removeEventListener('scorecard-privacy-change', changed);
  }, []);
  const choose = value => {
    if (saveChoice(value)) { setError(false); setOpen(false); setSettings(false); }
    else { setError(true); setOpen(true); }
  };
  return <aside className="sc-cookie-shell" aria-label="Privacy choices">
    <button className="sc-cookie-reopen" onClick={() => { setOpen(true); setSettings(true); }}>Cookie settings</button>
    {open && <section className="sc-cookie-banner" aria-label="Choose analytics preference">
      <div className="sc-cookie-summary">
        <div className="sc-cookie-copy"><h2>Cookies, your choice.</h2>
          <p>We use essential cookies for sign-in and saved searches. With your permission, Google Analytics uses optional cookies to help us understand page visits and card interactions. <a href="/privacy-policy">Privacy policy</a></p>
        </div>
        <div className="sc-cookie-actions">
          <button onClick={() => choose(false)}>Reject optional</button>
          <button onClick={() => choose(true)}>Accept optional</button>
          <button className="sc-cookie-settings" aria-expanded={settings} aria-controls="sc-cookie-details" onClick={() => setSettings(!settings)}>Settings</button>
        </div>
      </div>
      {settings && <div id="sc-cookie-details" className="sc-cookie-details">
        <div><h3>Essential cookies <span>Always on</span></h3><p>Support sign-in and saved searches. These features work without analytics.</p></div>
        <div><h3>Optional analytics <span>{readChoice()?.analytics && navigator.globalPrivacyControl !== true ? 'Accepted' : 'Off'}</span></h3><p>Google Analytics receives page visits and card interactions only with your permission. Advertising is currently disabled. Global Privacy Control keeps analytics off.</p></div>
        <p className="sc-cookie-note">Your choice is valid for 180 days; its record remains until replaced or cleared. You can change it anytime using Cookie settings below.</p>
      </div>}
      {error && <p className="sc-cookie-error" role="alert">Your browser could not save the choice. Analytics is off on this page. Enable browser storage and save again to remember your preference on future visits.</p>}
    </section>}
  </aside>;
}
