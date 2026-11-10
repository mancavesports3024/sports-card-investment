// Isolated eBay API client for the internal endpoints. Reads retry once on 401; post() is single-attempt.
// grantType 'refresh_token' (default) uses the seller token; 'client_credentials' mints application tokens.
// Credentials come only from environment variables; nothing is persisted to disk.
// Separate from services/ebayApiService.js, which keeps its own config and scope.
const axios = require('axios');

const TOKEN_URL = 'https://api.ebay.com/identity/v1/oauth2/token';
const SCOPES = {
  fulfillment: 'https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly',
  finances: 'https://api.ebay.com/oauth/api_scope/sell.finances',
  message: 'https://api.ebay.com/oauth/api_scope/commerce.message',
  publicApp: 'https://api.ebay.com/oauth/api_scope',
  marketplaceInsights: 'https://api.ebay.com/oauth/api_scope/buy.marketplace.insights'
};
const REFRESH_MARGIN_MS = 120 * 1000;
const DEFAULT_TIMEOUT_MS = 20000;

class EbaySellerError extends Error {
  // kind: NOT_CONFIGURED | AUTH_FAILED | PERMISSION_DENIED | RATE_LIMITED | UPSTREAM_ERROR | TIMEOUT | NETWORK_ERROR | INCOMPLETE_DATA
  constructor(kind, { status = null, ebayErrorIds = [], oauthError = null } = {}) {
    super(`eBay seller API error: ${kind}`);
    this.name = 'EbaySellerError';
    this.kind = kind;
    this.status = status;
    this.ebayErrorIds = ebayErrorIds;
    this.oauthError = oauthError;
  }
}

function errorIds(data) {
  return Array.isArray(data && data.errors) ? data.errors.map((e) => e && e.errorId).filter((id) => Number.isInteger(id)) : [];
}

// OAuth error codes are a fixed vocabulary (RFC 6749); anything else is dropped.
function oauthErrorCode(data) {
  const code = data && data.error;
  return typeof code === 'string' && /^[a-z_]{1,40}$/.test(code) ? code : null;
}

function classifyHttp(status, data) {
  if (status === 401) return 'AUTH_FAILED';
  if (status === 403) return 'PERMISSION_DENIED';
  if (status === 429) return 'RATE_LIMITED';
  if (status === 400 && data && (data.error === 'invalid_grant' || data.error === 'invalid_client')) return 'AUTH_FAILED';
  if (status === 400 && data && data.error === 'invalid_scope') return 'PERMISSION_DENIED';
  return 'UPSTREAM_ERROR';
}

function createEbaySellerClient({ env = process.env, http = axios, now = () => Date.now(), timeoutMs = DEFAULT_TIMEOUT_MS, grantType = 'refresh_token' } = {}) {
  const cache = new Map(); // scope -> { token, expiresAt }
  const inflight = new Map(); // scope -> Promise<string>
  const appGrant = grantType === 'client_credentials';

  function configured() {
    return Boolean(env.EBAY_CLIENT_ID && env.EBAY_CLIENT_SECRET && (appGrant || env.EBAY_REFRESH_TOKEN));
  }

  async function send(config) {
    let res;
    try {
      res = await http.request({ timeout: timeoutMs, validateStatus: () => true, ...config });
    } catch (err) {
      const kind = err && (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') ? 'TIMEOUT' : 'NETWORK_ERROR';
      throw new EbaySellerError(kind);
    }
    if (res.status < 200 || res.status >= 300) {
      throw new EbaySellerError(classifyHttp(res.status, res.data), { status: res.status, ebayErrorIds: errorIds(res.data), oauthError: oauthErrorCode(res.data) });
    }
    return res.data;
  }

  async function fetchToken(scope) {
    const basic = Buffer.from(`${env.EBAY_CLIENT_ID}:${env.EBAY_CLIENT_SECRET}`).toString('base64');
    const params = appGrant
      ? { grant_type: 'client_credentials', scope }
      : { grant_type: 'refresh_token', refresh_token: env.EBAY_REFRESH_TOKEN, scope };
    const data = await send({
      method: 'post',
      url: TOKEN_URL,
      data: new URLSearchParams(params).toString(),
      headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    if (!data || typeof data.access_token !== 'string') throw new EbaySellerError('AUTH_FAILED');
    const ttlMs = Math.max(0, Number(data.expires_in || 0) * 1000);
    cache.set(scope, { token: data.access_token, expiresAt: now() + ttlMs });
    return data.access_token;
  }

  async function getAccessToken(scope) {
    if (!configured()) throw new EbaySellerError('NOT_CONFIGURED');
    const cached = cache.get(scope);
    if (cached && now() < cached.expiresAt - REFRESH_MARGIN_MS) return cached.token;
    if (!inflight.has(scope)) {
      const p = fetchToken(scope).finally(() => inflight.delete(scope));
      inflight.set(scope, p);
    }
    return inflight.get(scope);
  }

  async function get(url, scope, { headers = {} } = {}) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const token = await getAccessToken(scope);
      try {
        return await send({ method: 'get', url, headers: { Accept: 'application/json', ...headers, Authorization: `Bearer ${token}` } });
      } catch (err) {
        if (attempt === 0 && err.kind === 'AUTH_FAILED' && err.status === 401) {
          cache.delete(scope);
          continue;
        }
        throw err;
      }
    }
    throw new EbaySellerError('AUTH_FAILED');
  }

  // Single attempt, never retried: callers use it for non-idempotent writes.
  async function post(url, scope, body) {
    const token = await getAccessToken(scope);
    return send({ method: 'post', url, data: body, headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } });
  }

  return { get, post, getAccessToken, configured };
}

// Scopes the seller refresh token must carry: pull list, money view, and buyer messaging.
const SELLER_CONSENT_SCOPES = [SCOPES.fulfillment, SCOPES.finances, SCOPES.message];

module.exports = { createEbaySellerClient, EbaySellerError, SCOPES, SELLER_CONSENT_SCOPES };
