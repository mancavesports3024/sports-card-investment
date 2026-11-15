// eBay Trading API (XML) client for the stock index and the gated price writer.
// Uses the seller refresh token through ebaySellerClient's token cache; the OAuth user token goes in
// X-EBAY-API-IAF-TOKEN (scope: SCOPES.trading).
// read() retries once on an expired token; write() is single-attempt.
const axios = require('axios');
const xml2js = require('xml2js');
const { SCOPES, EbaySellerError } = require('./ebaySellerClient');

const TRADING_URL = 'https://api.ebay.com/ws/api.dll';
const COMPATIBILITY_LEVEL = '1193';
const SITE_ID_US = '0';
const DEFAULT_TIMEOUT_MS = 30000;

// Trading API error codes (returned with HTTP 200 and Ack=Failure).
const AUTH_CODES = new Set(['931', '932', '16110', '16112', '17470', '21916013', '21916984', '21917053']);
const PERMISSION_CODES = new Set(['21916053', '21919144', '21919188', '120', '841']);
const RATE_CODES = new Set(['518', '218050', '21919165']);
const ITEM_NOT_FOUND_CODES = new Set(['17', '21916995', '291']);

const toArray = (v) => (v === undefined || v === null ? [] : Array.isArray(v) ? v : [v]);
const text = (v) => {
  if (v === undefined || v === null) return null;
  if (typeof v === 'object') return v._ === undefined ? null : String(v._);
  return String(v);
};

function escapeXml(value) {
  return String(value).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
}

class TradingCallError extends EbaySellerError {
  constructor(kind, { status = null, errorCodes = [], itemNotFound = false } = {}) {
    super(kind, { status, ebayErrorIds: errorCodes.map(Number).filter(Number.isInteger) });
    this.name = 'TradingCallError';
    this.errorCodes = errorCodes;
    this.itemNotFound = itemNotFound;
  }
}

function classifyErrors(errors) {
  const codes = errors.filter((e) => text(e.SeverityCode) !== 'Warning').map((e) => text(e.ErrorCode)).filter(Boolean);
  if (codes.some((c) => AUTH_CODES.has(c))) return { kind: 'AUTH_FAILED', codes };
  if (codes.some((c) => PERMISSION_CODES.has(c))) return { kind: 'PERMISSION_DENIED', codes };
  if (codes.some((c) => RATE_CODES.has(c))) return { kind: 'RATE_LIMITED', codes };
  if (codes.some((c) => ITEM_NOT_FOUND_CODES.has(c))) return { kind: 'UPSTREAM_ERROR', codes, itemNotFound: true };
  return { kind: 'UPSTREAM_ERROR', codes };
}

function createTradingClient({ sellerClient, http = axios, timeoutMs = DEFAULT_TIMEOUT_MS, scope = SCOPES.trading } = {}) {
  const parser = new xml2js.Parser({ explicitArray: false, explicitRoot: false, attrkey: '$', charkey: '_', trim: true });

  async function send(callName, innerXml, token) {
    const body = `<?xml version="1.0" encoding="utf-8"?><${callName}Request xmlns="urn:ebay:apis:eBLBaseComponents"><ErrorLanguage>en_US</ErrorLanguage><WarningLevel>High</WarningLevel>${innerXml}</${callName}Request>`;
    let res;
    try {
      res = await http.request({
        method: 'post',
        url: TRADING_URL,
        data: body,
        timeout: timeoutMs,
        validateStatus: () => true,
        responseType: 'text',
        transformResponse: (d) => d,
        headers: {
          'Content-Type': 'text/xml',
          'X-EBAY-API-CALL-NAME': callName,
          'X-EBAY-API-COMPATIBILITY-LEVEL': COMPATIBILITY_LEVEL,
          'X-EBAY-API-SITEID': SITE_ID_US,
          'X-EBAY-API-IAF-TOKEN': token
        }
      });
    } catch (err) {
      const kind = err && (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') ? 'TIMEOUT' : 'NETWORK_ERROR';
      throw new TradingCallError(kind);
    }
    if (res.status === 401) throw new TradingCallError('AUTH_FAILED', { status: 401 });
    if (res.status === 403) throw new TradingCallError('PERMISSION_DENIED', { status: 403 });
    if (res.status === 429) throw new TradingCallError('RATE_LIMITED', { status: 429 });
    if (res.status < 200 || res.status >= 300) throw new TradingCallError('UPSTREAM_ERROR', { status: res.status });
    let doc;
    try {
      doc = await parser.parseStringPromise(String(res.data || ''));
    } catch {
      throw new TradingCallError('UPSTREAM_ERROR', { status: res.status });
    }
    const ack = text(doc && doc.Ack);
    if (ack !== 'Success' && ack !== 'Warning') {
      const { kind, codes, itemNotFound } = classifyErrors(toArray(doc && doc.Errors));
      throw new TradingCallError(kind, { status: res.status, errorCodes: codes, itemNotFound });
    }
    return doc;
  }

  async function read(callName, innerXml) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const token = await sellerClient.getAccessToken(scope);
      try {
        return await send(callName, innerXml, token);
      } catch (err) {
        if (attempt === 0 && err.kind === 'AUTH_FAILED' && typeof sellerClient.invalidate === 'function') {
          sellerClient.invalidate(scope);
          continue;
        }
        throw err;
      }
    }
    throw new TradingCallError('AUTH_FAILED');
  }

  // Single attempt, never retried: callers use it for writes.
  async function write(callName, innerXml) {
    const token = await sellerClient.getAccessToken(scope);
    return send(callName, innerXml, token);
  }

  return { read, write, getAccessToken: () => sellerClient.getAccessToken(scope) };
}

module.exports = { createTradingClient, TradingCallError, escapeXml, toArray, text, TRADING_URL };
