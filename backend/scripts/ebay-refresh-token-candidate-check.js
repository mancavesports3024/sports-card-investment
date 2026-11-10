#!/usr/bin/env node
// Validates a candidate seller refresh token WITHOUT saving it anywhere.
// Usage (from backend/): railway run node scripts/ebay-refresh-token-candidate-check.js
// The token is read from a hidden prompt (or piped stdin), held in memory only, and never printed.
// Checks each required scope via the refresh grant, then makes ONE read-only getConversations call (limit 1).
// Prints HTTP statuses and OAuth error codes only; no tokens, secrets, or conversation content.
const crypto = require('crypto');
const axios = require('axios');
const { SELLER_CONSENT_SCOPES, SCOPES } = require('../services/ebaySellerClient');

const TOKEN_URL = 'https://api.ebay.com/identity/v1/oauth2/token';
const CONVERSATIONS_URL = 'https://api.ebay.com/commerce/message/v1/conversation?conversation_type=FROM_MEMBERS&limit=1';
const TIMEOUT_MS = 20000;

function promptHidden(question) {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY) {
      let data = '';
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', (c) => { data += c; }).on('end', () => resolve(data)).on('error', reject);
      return;
    }
    process.stdout.write(question);
    let value = '';
    const cleanup = () => { process.stdin.setRawMode(false); process.stdin.pause(); process.stdin.removeListener('data', onData); };
    function onData(chunk) {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n') { cleanup(); process.stdout.write('\n'); resolve(value); return; }
        if (ch === '\u0003') { cleanup(); reject(new Error('cancelled')); return; }
        if (ch === '\u0008' || ch === '\u007f') value = value.slice(0, -1);
        else value += ch;
      }
    }
    process.stdin.setRawMode(true);
    process.stdin.setEncoding('utf8');
    process.stdin.resume();
    process.stdin.on('data', onData);
  });
}

async function refresh(refreshToken, scope) {
  const basic = Buffer.from(`${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`).toString('base64');
  try {
    const res = await axios.post(TOKEN_URL, new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken, scope }).toString(), {
      headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: TIMEOUT_MS,
      validateStatus: () => true
    });
    const error = res.data && typeof res.data.error === 'string' && /^[a-z_]{1,40}$/.test(res.data.error) ? res.data.error : null;
    return { status: res.status, token: res.data && res.data.access_token, error };
  } catch (err) {
    return { status: 0, token: null, error: err.code || 'NETWORK_ERROR' };
  }
}

async function main() {
  const missing = ['EBAY_CLIENT_ID', 'EBAY_CLIENT_SECRET'].filter((k) => !process.env[k]);
  if (missing.length) { console.log(`BLOCKED: missing ${missing.join(', ')} (run via \`railway run\`).`); process.exitCode = 2; return; }

  const candidate = (await promptHidden('Paste candidate refresh token (hidden), then Enter: ')).trim();
  if (!candidate) { console.log('No token entered.'); process.exitCode = 2; return; }
  const sameAsCurrent = process.env.EBAY_REFRESH_TOKEN
    && crypto.timingSafeEqual(crypto.createHash('sha256').update(candidate).digest(), crypto.createHash('sha256').update(process.env.EBAY_REFRESH_TOKEN).digest());
  console.log(`Candidate: length=${candidate.length} v^1.1-prefix=${candidate.startsWith('v^1.1#')} sameAsCurrentEnvToken=${Boolean(sameAsCurrent)}`);

  let messageToken = null;
  let allGranted = true;
  for (const scope of SELLER_CONSENT_SCOPES) {
    const r = await refresh(candidate, scope);
    console.log(`  ${scope.split('/').pop().padEnd(26)} HTTP ${r.status} ${r.token ? 'GRANTED' : `NOT GRANTED (${r.error || 'no error code'})`}`);
    if (!r.token) allGranted = false;
    if (scope === SCOPES.message && r.token) messageToken = r.token;
    if (r.error === 'invalid_grant' || r.error === 'invalid_client') { console.log('STOPPED: token/keyset mismatch or revoked token; scope checks are not meaningful.'); process.exitCode = 3; return; }
  }

  let conversationsOk = false;
  if (messageToken) {
    try {
      const res = await axios.get(CONVERSATIONS_URL, { headers: { Authorization: `Bearer ${messageToken}`, Accept: 'application/json' }, timeout: TIMEOUT_MS, validateStatus: () => true });
      const ids = Array.isArray(res.data && res.data.errors) ? res.data.errors.map((e) => e.errorId).filter(Number.isInteger) : [];
      conversationsOk = res.status === 200;
      console.log(`  getConversations limit=1: HTTP ${res.status}${ids.length ? ` errorIds=${ids.join(',')}` : ''}`);
    } catch (err) {
      console.log(`  getConversations limit=1: ${err.code || 'NETWORK_ERROR'}`);
    }
  } else {
    console.log('  getConversations skipped: commerce.message not granted.');
  }

  console.log(allGranted && conversationsOk
    ? 'READY: candidate carries all required scopes. Nothing was saved; replace EBAY_REFRESH_TOKEN only after approval.'
    : 'NOT READY: see results above. Nothing was saved.');
  if (!(allGranted && conversationsOk)) process.exitCode = 1;
}

main().catch((err) => {
  console.log(`Unexpected failure: ${err && err.message === 'cancelled' ? 'cancelled' : (err && err.name) || 'Error'}`);
  process.exitCode = 1;
});
