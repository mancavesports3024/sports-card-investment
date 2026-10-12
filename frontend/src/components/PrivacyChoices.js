import React, { useEffect, useState } from 'react';
import { readChoice, saveChoice } from '../loadDeferredGa';
export default function PrivacyChoices() {
  const [open, setOpen] = useState(() => !readChoice());
  const [error, setError] = useState(false);
  useEffect(() => {
    const changed = () => setOpen(!readChoice());
    window.addEventListener('scorecard-privacy-change', changed);
    return () => window.removeEventListener('scorecard-privacy-change', changed);
  }, []);
  const choose = value => {
    if (saveChoice(value)) { setError(false); setOpen(false); }
    else setError(true);
  };
  return <aside style={{ background: '#1f2937', color: '#fff', padding: '1rem' }} aria-label="Privacy choices">
    <a href="/privacy-policy" style={{ color: '#93c5fd' }}>Privacy policy</a>{' '}
    <button onClick={() => setOpen(true)}>Privacy preferences</button>
    {open && <div role="region" aria-label="Choose analytics preference">
      <h2>Optional analytics</h2>
      <p>With your permission, Google Analytics uses cookies and receives page visits and card interactions to help us understand site use. Essential sign-in and saved-search features work without analytics. Advertising is currently disabled.</p>
      <p>You can change this choice here at any time. We remember it on this browser for 180 days. Global Privacy Control keeps analytics off.</p>
      <button onClick={() => choose(false)}>Reject analytics</button>{' '}
      <button onClick={() => choose(true)}>Accept analytics</button>
      {error && <p role="alert">Your browser could not save the choice. Enable browser storage to save a preference.</p>}
    </div>}
  </aside>;
}
