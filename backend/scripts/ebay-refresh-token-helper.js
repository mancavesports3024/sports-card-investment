#!/usr/bin/env node
// Local helper for the eBay production authorization-code flow.
// Usage (from backend/): railway run node scripts/ebay-refresh-token-helper.js
// Uses EBAY_CLIENT_ID / EBAY_CLIENT_SECRET from the environment (never loads backend/.env).
// Serves a page on 127.0.0.1 only. The authorization code and tokens are never written to the
// terminal, disk, or logs; the refresh token is shown once in the local browser page.
// With --save-to-railway the token is never shown: if every scope and a read-only getConversations
// call pass, the current EBAY_REFRESH_TOKEN is copied to EBAY_REFRESH_TOKEN_PREVIOUS and the new token
// is written through the Railway API (skipDeploys; no process arguments), then verified by fingerprint.
const http = require('http');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
const { SELLER_CONSENT_SCOPES: SCOPES, SCOPES: ALL_SCOPES } = require('../services/ebaySellerClient');

const PORT = Number(process.env.HELPER_PORT || 53682);
const AUTHORIZE_URL = 'https://auth.ebay.com/oauth2/authorize';
const TOKEN_URL = 'https://api.ebay.com/identity/v1/oauth2/token';
const CONVERSATIONS_URL = 'https://api.ebay.com/commerce/message/v1/conversation?conversation_type=FROM_MEMBERS&limit=1';
const RAILWAY_GQL = 'https://backboard.railway.com/graphql/v2';
const TOKEN_VAR = 'EBAY_REFRESH_TOKEN';
const ROLLBACK_VAR = 'EBAY_REFRESH_TOKEN_PREVIOUS';
const SAVE_TO_RAILWAY = process.argv.includes('--save-to-railway');
const STATE_TTL_MS = 10 * 60 * 1000;
const IDLE_SHUTDOWN_MS = 30 * 60 * 1000;
const SCOPE_NAMES = SCOPES.map((s) => s.split('/').pop()).join(', ');

const { EBAY_CLIENT_ID: clientId, EBAY_CLIENT_SECRET: clientSecret } = process.env;

function consentUrl({ ruName, state }) {
  const consent = new URL(AUTHORIZE_URL);
  consent.search = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: ruName,
    scope: SCOPES.join(' '),
    state,
    prompt: 'login'
  }).toString();
  return consent.toString();
}

const sessionPath = `/${crypto.randomBytes(16).toString('hex')}`;
let pending = null; // { state, ruName, createdAt }
let done = false;

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safe = (s) => esc(String(s || '').replace(/[A-Za-z0-9+/=_\-.#^|%]{32,}/g, '[REDACTED]').slice(0, 200));

function page(res, body, status = 200) {
  res.writeHead(status, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'DENY',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; form-action 'self' https://auth.ebay.com"
  });
  res.end(`<!doctype html><meta name="viewport" content="width=device-width"><title>eBay refresh token helper</title>
<body style="font-family:system-ui;max-width:760px;margin:2rem auto;line-height:1.5">${body}</body>`);
}

function readForm(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 20000) { reject(new Error('too large')); req.destroy(); } });
    req.on('end', () => resolve(new URLSearchParams(data)));
    req.on('error', reject);
  });
}

function extractCodeAndState(input) {
  const text = String(input || '').trim();
  try {
    const u = new URL(text);
    return { code: u.searchParams.get('code'), state: u.searchParams.get('state') };
  } catch {
    const q = new URLSearchParams(text.includes('?') ? text.slice(text.indexOf('?') + 1) : text);
    return { code: q.get('code'), state: q.get('state') };
  }
}

async function tokenRequest(params) {
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  try {
    const res = await axios.post(TOKEN_URL, new URLSearchParams(params).toString(), {
      headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 20000,
      validateStatus: () => true
    });
    return { status: res.status, data: res.data || {} };
  } catch (err) {
    return { status: 0, data: { error: err.code || 'NETWORK_ERROR' } };
  }
}

async function verifyScopes(refreshToken) {
  const results = [];
  for (const scope of SCOPES) {
    const r = await tokenRequest({ grant_type: 'refresh_token', refresh_token: refreshToken, scope });
    results.push({ scope: scope.split('/').pop(), granted: Boolean(r.data.access_token), status: r.status, error: r.data.error });
  }
  return results;
}

async function checkConversations(refreshToken) {
  const t = await tokenRequest({ grant_type: 'refresh_token', refresh_token: refreshToken, scope: ALL_SCOPES.message });
  if (!t.data.access_token) return { ok: false, status: t.status };
  try {
    const r = await axios.get(CONVERSATIONS_URL, { headers: { Authorization: `Bearer ${t.data.access_token}`, Accept: 'application/json' }, timeout: 20000, validateStatus: () => true });
    return { ok: r.status === 200, status: r.status };
  } catch (err) {
    return { ok: false, status: 0 };
  }
}

const sha = (v) => crypto.createHash('sha256').update(String(v)).digest('hex');

function railwayApiToken(env = process.env) {
  if (env.RAILWAY_API_TOKEN) return env.RAILWAY_API_TOKEN;
  try {
    return require(path.join(os.homedir(), '.railway', 'config.json')).user.token || null;
  } catch {
    return null;
  }
}

function createRailwayVariables({ token, projectId, environmentId, serviceId, httpClient = axios }) {
  async function gql(query, variables) {
    const res = await httpClient.post(RAILWAY_GQL, { query, variables }, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      timeout: 20000,
      validateStatus: () => true
    });
    if (res.status !== 200 || !res.data || (res.data.errors && res.data.errors.length)) throw new Error(`Railway API failed (HTTP ${res.status})`);
    return res.data.data;
  }
  return {
    upsert: (name, value) => gql('mutation($input: VariableUpsertInput!) { variableUpsert(input: $input) }', {
      input: { projectId, environmentId, serviceId, name, value, skipDeploys: true }
    }),
    async fingerprints(names) {
      const d = await gql('query($p: String!, $e: String!, $s: String) { variables(projectId: $p, environmentId: $e, serviceId: $s) }', { p: projectId, e: environmentId, s: serviceId });
      const vars = (d && d.variables) || {};
      return Object.fromEntries(names.map((n) => [n, vars[n] ? sha(vars[n]) : null]));
    }
  };
}

// Rollback copy is written (and must succeed) before the live variable is replaced.
async function saveWithRollback(vars, { current, next }) {
  if (current) await vars.upsert(ROLLBACK_VAR, current);
  await vars.upsert(TOKEN_VAR, next);
  const fps = await vars.fingerprints([TOKEN_VAR, ROLLBACK_VAR]);
  return { tokenVerified: fps[TOKEN_VAR] === sha(next), rollbackVerified: Boolean(current) && fps[ROLLBACK_VAR] === sha(current) };
}

const startForm = () => `<h2>Step 1 — Start consent</h2>
<form method="post" action="${sessionPath}/start" autocomplete="off">
<p><label>Production RuName (eBay Redirect URL name):<br><input name="ruName" required pattern="[A-Za-z0-9_\\-]+" style="width:100%"></label></p>
<p>Requested scopes: ${esc(SCOPE_NAMES)}</p>
<button>Continue to eBay sign-in</button></form>`;

const pasteForm = () => `<h2>Step 2 — Paste the returned URL</h2>
<p>After you click <b>I agree</b> on eBay, copy the full address-bar URL of the page eBay lands on and paste it here within 5 minutes.</p>
<form method="post" action="${sessionPath}/exchange" autocomplete="off">
<p><textarea name="returned" rows="5" required style="width:100%" spellcheck="false"></textarea></p>
<button>Exchange code</button></form>`;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  if (!url.pathname.startsWith(sessionPath) || done) return page(res, '<p>Not found.</p>', 404);
  const route = url.pathname.slice(sessionPath.length) || '/';

  try {
    if (req.method === 'GET' && route === '/') return page(res, startForm() + (pending ? pasteForm() : ''));

    if (req.method === 'POST' && route === '/start') {
      const ruName = (await readForm(req)).get('ruName') || '';
      if (!/^[A-Za-z0-9_-]+$/.test(ruName)) return page(res, '<p>Invalid RuName format.</p>' + startForm(), 400);
      pending = { state: crypto.randomBytes(24).toString('base64url'), ruName, createdAt: Date.now() };
      const consent = consentUrl({ ruName, state: pending.state });
      console.log('Consent started. Complete eBay sign-in in the new tab, then paste the returned URL on the helper page.');
      return page(res, `<p><a href="${esc(consent)}" target="_blank" rel="noreferrer noopener">Open eBay consent (new tab)</a></p>
<p>Sign in as the <b>seller</b> account, then click <b>I agree</b>.</p>${pasteForm()}`);
    }

    if (req.method === 'POST' && route === '/exchange') {
      const { code, state } = extractCodeAndState((await readForm(req)).get('returned'));
      if (!pending) return page(res, '<p>No consent in progress. Start again.</p>' + startForm(), 400);
      if (Date.now() - pending.createdAt > STATE_TTL_MS) { pending = null; return page(res, '<p>Consent expired. Start again.</p>' + startForm(), 400); }
      const expected = Buffer.from(pending.state);
      const got = Buffer.from(String(state || ''));
      if (got.length !== expected.length || !crypto.timingSafeEqual(got, expected)) {
        console.log('Exchange rejected: state missing or mismatched.');
        return page(res, '<p>State missing or mismatched. Paste the full URL from this consent attempt.</p>' + pasteForm(), 400);
      }
      if (!code) return page(res, '<p>No authorization code found in the pasted URL (consent may have been declined).</p>' + pasteForm(), 400);
      const { ruName } = pending;
      pending = null; // state is single-use

      const r = await tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: ruName });
      if (r.status !== 200 || !r.data.refresh_token) {
        console.log(`Code exchange failed: HTTP ${r.status} error=${safe(r.data.error)}`);
        return page(res, `<p>Code exchange failed: HTTP ${r.status} — ${safe(r.data.error)}: ${safe(r.data.error_description)}</p><p>Codes are single-use and short-lived; start again.</p>` + startForm(), 400);
      }

      const refreshToken = r.data.refresh_token;
      const days = Math.round(Number(r.data.refresh_token_expires_in || 0) / 86400);
      const scopes = await verifyScopes(refreshToken);
      const summary = scopes.map((s) => `${s.scope}=${s.granted ? 'GRANTED' : `NOT GRANTED (HTTP ${s.status} ${s.error || ''})`}`).join(', ');
      console.log(`Refresh token obtained from response field refresh_token (expires in ~${days} days). ${summary}`);
      done = true;

      if (SAVE_TO_RAILWAY) {
        const convo = await checkConversations(refreshToken);
        console.log(`getConversations limit=1: HTTP ${convo.status}`);
        let outcome;
        if (!scopes.every((s) => s.granted) || !convo.ok) {
          outcome = 'NOT SAVED: validation failed; Railway variables unchanged and the new token was discarded.';
        } else {
          try {
            const vars = createRailwayVariables({ token: railwayApiToken(), projectId: process.env.RAILWAY_PROJECT_ID, environmentId: process.env.RAILWAY_ENVIRONMENT_ID, serviceId: process.env.RAILWAY_SERVICE_ID });
            const saved = await saveWithRollback(vars, { current: process.env[TOKEN_VAR], next: refreshToken });
            outcome = `SAVED with skipDeploys: ${TOKEN_VAR} verified=${saved.tokenVerified}; ${ROLLBACK_VAR} (previous token) verified=${saved.rollbackVerified}. The running service keeps the old value until it restarts.`;
          } catch (err) {
            outcome = `SAVE FAILED: ${safe(err.message)}. Check ${TOKEN_VAR} and ${ROLLBACK_VAR} in Railway before retrying.`;
          }
        }
        console.log(outcome);
        console.log('Helper shutting down after this page is served.');
        page(res, `<h2>Refresh token processed</h2><p>Expires in about ${days} days.</p>
<p>Scope check: ${esc(summary)}</p><p>getConversations (read-only, limit 1): HTTP ${convo.status}</p>
<p><b>${esc(outcome)}</b></p><p>The token is not displayed. You can close this tab.</p>`);
        setTimeout(() => server.close(() => process.exit(0)), 1000);
        return undefined;
      }

      console.log('Helper shutting down after this page is served.');
      page(res, `<h2>Refresh token obtained</h2>
<p>Source: response field <code>refresh_token</code>. Expires in about ${days} days.</p>
<p>Scope check: ${esc(summary)}</p>
<p>Copy it into Railway &rarr; web &rarr; Variables &rarr; <code>EBAY_REFRESH_TOKEN</code>. This page will not show it again.</p>
<p><textarea id="t" readonly rows="4" style="width:100%" spellcheck="false">${esc(refreshToken)}</textarea></p>
<button onclick="navigator.clipboard.writeText(document.getElementById('t').value);this.textContent='Copied'">Copy</button>`);
      setTimeout(() => server.close(() => process.exit(0)), 1000);
      return undefined;
    }

    return page(res, '<p>Not found.</p>', 404);
  } catch (err) {
    console.log(`Helper error: ${err && err.name ? err.name : 'Error'}`);
    return page(res, '<p>Unexpected helper error. Start again.</p>', 500);
  }
});

if (require.main === module) {
  if (!clientId || !clientSecret) {
    console.log('BLOCKED: EBAY_CLIENT_ID and EBAY_CLIENT_SECRET must be injected (run via `railway run`).');
    process.exit(2);
  }
  if (SAVE_TO_RAILWAY && !(railwayApiToken() && process.env.RAILWAY_PROJECT_ID && process.env.RAILWAY_ENVIRONMENT_ID && process.env.RAILWAY_SERVICE_ID)) {
    console.log('BLOCKED: --save-to-railway needs `railway run` (project/environment/service ids) and a Railway login or RAILWAY_API_TOKEN.');
    process.exit(2);
  }
  server.listen(PORT, '127.0.0.1', () => {
    console.log(`Open in your browser: http://127.0.0.1:${PORT}${sessionPath}`);
    console.log(`Requested scopes: ${SCOPE_NAMES}.${SAVE_TO_RAILWAY ? ' Mode: save to Railway after validation (token not displayed).' : ''} Auth codes and tokens are never printed here. Ctrl+C to cancel.`);
  });
  setTimeout(() => { console.log('Idle timeout; helper stopped.'); process.exit(0); }, IDLE_SHUTDOWN_MS).unref();
}

module.exports = { SCOPES, consentUrl, createRailwayVariables, saveWithRollback };
