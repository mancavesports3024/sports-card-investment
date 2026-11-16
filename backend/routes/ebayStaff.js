// Staff-only eBay inventory + purchases/shipments endpoints for the website admin tools.
// Auth: the site's Google sign-in JWT (Authorization: Bearer <token>), verified with JWT_SECRET, AND an email on the
// staff allowlist (EBAY_STAFF_EMAILS when set, otherwise the site admin list). Being signed in is not enough.
// Calls the eBay services directly, so CRON_SECRET and eBay tokens never reach the browser.
const express = require('express');
const jwt = require('jsonwebtoken');
const { createEbaySellerClient } = require('../services/ebaySellerClient');
const { createTradingClient } = require('../services/ebayTradingClient');
const { createStockStore } = require('../services/ebayStockStore');
const { createDeliveryResolver } = require('../services/ebayDeliveryState');
const { isAdminEmail } = require('../config/adminEmails');
const { sendProviderError } = require('./ebayInternal');
const { mountStockRoutes } = require('./ebayStockRoutes');
const { mountBoardRoutes } = require('./ebayBoardRoutes');

function staffAllowlist(env) {
  const configured = String(env.EBAY_STAFF_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  return (email) => {
    if (typeof email !== 'string' || !email) return false;
    return configured.length ? configured.includes(email.toLowerCase()) : isAdminEmail(email);
  };
}

function requireStaff(env) {
  const allowed = staffAllowlist(env);
  return (req, res, next) => {
    // The site falls back to a known development secret when JWT_SECRET is unset; never accept that here.
    if (!env.JWT_SECRET) return res.status(503).json({ error: 'NOT_CONFIGURED', message: 'Staff sign-in is not configured.' });
    const m = /^Bearer (.+)$/.exec(req.get('authorization') || '');
    if (!m) return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Sign in required.' });
    let user;
    try {
      user = jwt.verify(m[1], env.JWT_SECRET, { algorithms: ['HS256'] });
    } catch {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Sign-in expired or invalid; sign in again.' });
    }
    if (!allowed(user && user.email)) return res.status(403).json({ error: 'FORBIDDEN', message: 'This account is not on the staff list.' });
    req.staffEmail = String(user.email).toLowerCase();
    return next();
  };
}

function createEbayStaffRouter({
  env = process.env,
  client = createEbaySellerClient({ env }),
  trading = createTradingClient({ sellerClient: client }),
  stockStore = createStockStore({ env }),
  delivery = null,
  now = () => Date.now(),
  log = console.warn
} = {}) {
  const deliveryResolver = delivery || createDeliveryResolver({ env, now });
  const router = express.Router();
  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    res.set('X-Robots-Tag', 'noindex, nofollow');
    next();
  });
  router.use(requireStaff(env));
  router.get('/me', (req, res) => res.json({ email: req.staffEmail, staff: true }));
  mountStockRoutes(router, { trading, store: stockStore, actor: (req) => req.staffEmail, sendProviderError, now, log });
  mountBoardRoutes(router, { client, delivery: deliveryResolver, sendProviderError, now, log });
  router.use((req, res) => res.status(404).json({ error: 'NOT_FOUND' }));
  return router;
}

module.exports = { createEbayStaffRouter, requireStaff, staffAllowlist };
