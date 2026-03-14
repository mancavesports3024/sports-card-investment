// CardSight AI – trading card identification & catalog
// Docs: https://cardsight.ai/documentation/api-reference
// Base: https://api.cardsight.ai
// Auth: X-API-Key header (32-char alphanumeric). Set CARDSIGHT_API_KEY in .env.

const crypto = require('crypto');
const axios = require('axios');
const FormData = require('form-data');

const BASE_URL = 'https://api.cardsight.ai';
const TIMEOUT_MS = 30000;

// In-memory cache: same image = same result (saves API calls). Max 500 entries, 7-day TTL.
const identifyCache = new Map();
const CACHE_MAX = 500;
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function getImageHash(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function getCachedIdentify(hash) {
  const entry = identifyCache.get(hash);
  if (!entry) return null;
  if (Date.now() - entry.at > CACHE_TTL_MS) {
    identifyCache.delete(hash);
    return null;
  }
  return entry.data;
}

function setCachedIdentify(hash, data) {
  if (identifyCache.size >= CACHE_MAX) {
    const first = identifyCache.keys().next().value;
    if (first) identifyCache.delete(first);
  }
  identifyCache.set(hash, { data, at: Date.now() });
}

function getApiKey() {
  const key = process.env.CARDSIGHT_API_KEY;
  if (!key || typeof key !== 'string') {
    throw new Error('CARDSIGHT_API_KEY is not set. Get a key at https://cardsight.ai');
  }
  return key.trim();
}

function getHeaders(extra = {}) {
  return {
    'X-API-Key': getApiKey(),
    ...extra,
  };
}

/**
 * Identify a card from an image (multipart). Results are cached by image hash to save API calls.
 * @param {Buffer} imageBuffer - Raw image bytes
 * @param {string} [filename] - Optional filename (e.g. 'card.jpg')
 * @returns {Promise<{ success: boolean, data?: any, error?: string, status?: number, cached?: boolean }>}
 */
async function identifyCard(imageBuffer, filename = 'image.jpg') {
  const hash = getImageHash(imageBuffer);
  const cached = getCachedIdentify(hash);
  if (cached) {
    return { ...cached, cached: true };
  }
  try {
    const form = new FormData();
    form.append('image', imageBuffer, { filename });
    const response = await axios.post(`${BASE_URL}/v1/identify/card`, form, {
      headers: {
        ...getHeaders(),
        ...form.getHeaders(),
      },
      timeout: TIMEOUT_MS,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });
    const result = { success: true, status: response.status, data: response.data };
    console.log('CardSight identify response:', {
      status: response.status,
      dataSuccess: response.data?.success,
      requestId: response.data?.requestId,
      processingTime: response.data?.processingTime,
      dataKeys: response.data && typeof response.data === 'object' ? Object.keys(response.data) : [],
      data: response.data,
    });
    setCachedIdentify(hash, result);
    return result;
  } catch (err) {
    const status = err.response?.status;
    const body = err.response?.data;
    console.error('CardSight identify error:', { status, body: body || err.message, fullData: body });
    return {
      success: false,
      status,
      error: err.response ? `CardSight API error (${status})` : err.message || 'Request failed',
      details: body?.message || body?.detail || (typeof body === 'object' ? JSON.stringify(body) : body),
    };
  }
}

/**
 * Detect if a trading card is present in an image (no identification).
 */
async function detectCard(imageBuffer, filename = 'image.jpg') {
  try {
    const form = new FormData();
    form.append('image', imageBuffer, { filename });
    const response = await axios.post(`${BASE_URL}/v1/detect/card`, form, {
      headers: {
        ...getHeaders(),
        ...form.getHeaders(),
      },
      timeout: TIMEOUT_MS,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });
    return { success: true, status: response.status, data: response.data };
  } catch (err) {
    const status = err.response?.status;
    const body = err.response?.data;
    return {
      success: false,
      status,
      error: err.response ? `CardSight API error (${status})` : err.message || 'Request failed',
      details: body?.message || body?.detail || (typeof body === 'object' ? JSON.stringify(body) : body),
    };
  }
}

/**
 * GET request to CardSight (catalog, health, etc.).
 */
async function _get(path, params = {}) {
  try {
    const response = await axios.get(`${BASE_URL}${path.startsWith('/') ? path : '/' + path}`, {
      headers: getHeaders(),
      params: Object.keys(params).length ? params : undefined,
      timeout: TIMEOUT_MS,
    });
    return { success: true, status: response.status, data: response.data };
  } catch (err) {
    const status = err.response?.status;
    const body = err.response?.data;
    return {
      success: false,
      status,
      error: err.response ? `CardSight API error (${status})` : err.message || 'Request failed',
      details: body?.message || body?.detail || (typeof body === 'object' ? JSON.stringify(body) : body),
    };
  }
}

/** Catalog search – cards, sets, releases, parallels */
async function searchCatalog(query = {}, params = {}) {
  const path = '/v1/catalog/search';
  return _get(path, { ...query, ...params });
}

/** Catalog statistics */
async function getCatalogStatistics() {
  return _get('/v1/catalog/statistics');
}

/** List segments (e.g. baseball, football, basketball) */
async function getSegments() {
  return _get('/v1/catalog/segments');
}

/** Subscription/usage (free tier: 750 req/month) */
async function getSubscription() {
  return _get('/v1/subscription/');
}

/** Health check (validates API key) */
async function getHealthAuth() {
  return _get('/health/auth');
}

module.exports = {
  identifyCard,
  detectCard,
  searchCatalog,
  getCatalogStatistics,
  getSegments,
  getSubscription,
  getHealthAuth,
};
