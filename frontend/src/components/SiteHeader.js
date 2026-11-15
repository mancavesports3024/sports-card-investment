import React, { useState } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';

const links = [['/', 'Home'], ['/search', 'Recent Auction Sales'], ['/card-set-analysis', 'Card Set Analysis'], ['/release-calendar', 'Calendar'], ['/news', 'Guides']];
export default function SiteHeader({ isLoggedIn, isAdmin, user, onLogin, onLogout }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  React.useEffect(() => setOpen(false), [location.pathname]);
  return <header className="sc-header">
    <a className="sc-skip" href="#site-content">Skip to content</a>
    <div className="sc-masthead">
      <Link to="/" className="sc-logo-link" aria-label="Man Cave Sports Cards home"><img className="sc-original-logo" src="/ManCave.jpg" alt="Man Cave Sports Cards" width="104" height="104" /></Link>
      <Link to="/" className="sc-brand" aria-label="Scorecard home"><span><strong>Scorecard</strong><small>MAN CAVE SPORTS CARDS LLC</small></span></Link>
      <div className="sc-account">
        {isLoggedIn && <span className="sc-user">{user?.displayName || user?.name || user?.given_name || 'My account'}</span>}
        <button className="sc-account-button" onClick={isLoggedIn ? onLogout : onLogin}>{isLoggedIn ? 'Log out' : 'Log in'}</button>
        <a className="sc-shop" href="https://www.ebay.com/str/mancavesportsllc" target="_blank" rel="noopener noreferrer">Shop on eBay ↗</a>
      </div>
      <button className="sc-menu-button" aria-expanded={open} aria-controls="sc-navigation" onClick={() => setOpen(!open)}>{open ? 'Close menu' : 'Menu ☰'}</button>
    </div>
    <nav id="sc-navigation" aria-label="Main navigation" className={`sc-nav ${open ? 'is-open' : ''}`}>
      <div className="sc-public-links">{links.map(([to, label]) => <NavLink end={to === '/'} key={to} to={to}>{label}</NavLink>)}</div>
      {isAdmin && <details className="sc-staff" key={location.pathname}><summary>Staff tools</summary><div className="sc-staff-menu">
        <Link to="/admin/ebay-inventory">eBay Inventory <small>Find players, check stock & prices</small></Link>
        <Link to="/admin/cards">Card Database</Link><Link to="/admin/collections">Collections</Link><Link to="/admin/releases">Manage Releases</Link>
      </div></details>}
    </nav>
  </header>;
}
