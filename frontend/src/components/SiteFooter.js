import React from 'react';
import { Link } from 'react-router-dom';

function BrandIcon({ brand }) {
  if (brand === 'Instagram') return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="2" /><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2" /><circle cx="17.5" cy="6.5" r="1.2" /></svg>;
  const path = brand === 'X'
    ? 'M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.64 7.584H.47l8.6-9.835L0 1.154h7.594l5.243 6.932 6.064-6.933zm-1.29 19.49h2.039L6.487 3.24H4.3l13.31 17.403z'
    : 'M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.413c0-3.026 1.792-4.697 4.533-4.697 1.312 0 2.686.235 2.686.235v2.971H15.83c-1.491 0-1.956.931-1.956 1.887v2.264h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z';
  return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d={path} /></svg>;
}
const socials = [
  ['X', 'https://x.com/Mancavesportsc1'],
  ['Instagram', 'https://www.instagram.com/mancavesportscardllc'],
  ['Facebook', 'https://www.facebook.com/profile.php?id=100062665574017'],
];
export default function SiteFooter() {
  return <footer className="sc-footer">
    <div><h2>Scorecard by Man Cave Sports Cards LLC</h2><p>Practical tools. Affordable cards. A better way to collect.</p></div>
    <nav aria-label="Footer"><div className="sc-social-links">{socials.map(([name, href]) => <a key={name} href={href} aria-label={name} title={name} target="_blank" rel="noopener noreferrer"><BrandIcon brand={name} /></a>)}</div><Link to="/privacy-policy">Privacy policy</Link></nav>
  </footer>;
}
