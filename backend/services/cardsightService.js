// CardSight AI – trading card identification & catalog
// API docs: https://api.cardsight.ai/documentation (OpenAPI/Swagger)
// Web docs: https://cardsight.ai/documentation/api-reference
// Base URL: https://api.cardsight.ai
// Auth: X-API-Key header (32-char alphanumeric). Set CARDSIGHT_API_KEY in .env.

const crypto = require('crypto');
const axios = require('axios');
const FormData = require('form-data');

const BASE_URL = 'https://api.cardsight.ai';
// 60s for identify (mobile upload + CardSight AI can be slow); 408 timeouts common on phone
const TIMEOUT_MS = 60000;

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

// Infer MIME type from buffer magic bytes (CardSight may require correct Content-Type)
function getImageMimeType(buffer) {
  if (!buffer || buffer.length < 4) return 'image/jpeg';
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return 'image/jpeg';
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return 'image/png';
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) return 'image/gif';
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) return 'image/webp';
  return 'image/jpeg';
}

function normalizeImageFilename(filename) {
  const name = (filename || 'image').trim() || 'image';
  if (/\.(jpe?g|png|gif|webp)$/i.test(name)) return name;
  return name.replace(/\.[^.]*$/, '') + '.jpg';
}

/**
 * Identify a card from an image (multipart). Results are cached by image hash to save API calls.
 * @param {Buffer} imageBuffer - Raw image bytes
 * @param {string} [filename] - Optional filename (e.g. 'card.jpg')
 * @returns {Promise<{ success: boolean, data?: any, error?: string, status?: number, cached?: boolean }>}
 */
async function identifyCard(imageBuffer, filename = 'image.jpg') {
  if (!imageBuffer || !Buffer.isBuffer(imageBuffer) || imageBuffer.length === 0) {
    console.error('CardSight identify: invalid or empty image buffer');
    return { success: false, status: 400, error: 'Invalid image', details: 'No image data provided.' };
  }
  const hash = getImageHash(imageBuffer);
  const cached = getCachedIdentify(hash);
  if (cached) {
    return { ...cached, cached: true };
  }
  const contentType = getImageMimeType(imageBuffer);
  const normalizedFilename = normalizeImageFilename(filename);
  try {
    const form = new FormData();
    form.append('image', imageBuffer, {
      filename: normalizedFilename,
      contentType,
    });
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
    const data = response.data;
    console.log('CardSight identify response:', {
      status: response.status,
      dataSuccess: data?.success,
      requestId: data?.requestId,
      processingTime: data?.processingTime,
      dataKeys: data && typeof data === 'object' ? Object.keys(data) : [],
    });
    // Full response for debugging extraction (what did CardSight actually return?)
    try {
      console.log('CardSight identify full response (for debugging):', JSON.stringify(data, null, 2));
    } catch (e) {
      console.log('CardSight identify full response (stringify failed):', data);
    }
    setCachedIdentify(hash, result);
    return result;
  } catch (err) {
    const status = err.response?.status;
    const body = err.response?.data;
    const isTimeout = status === 408 || err.code === 'ECONNABORTED' || body?.code === 'TIMEOUT_ERROR';
    console.error('CardSight identify error:', { status, body: body || err.message, fullData: body, isTimeout });
    let error = err.response ? `CardSight API error (${status})` : err.message || 'Request failed';
    let details = body?.message ?? body?.detail ?? (body?.error ? `${body.error}${body.code ? ` (${body.code})` : ''}` : null) ?? (typeof body === 'object' ? JSON.stringify(body) : body) ?? err.message;
    if (isTimeout) {
      error = 'Request timed out';
      details = 'CardSight took too long to respond. On mobile, try Wi‑Fi, a smaller photo, or try again in a moment.';
    }
    return {
      success: false,
      status: status || 408,
      error,
      details,
    };
  }
}

/**
 * Detect if a trading card is present in an image (no identification).
 */
async function detectCard(imageBuffer, filename = 'image.jpg') {
  if (!imageBuffer || !Buffer.isBuffer(imageBuffer) || imageBuffer.length === 0) {
    return { success: false, status: 400, error: 'Invalid image', details: 'No image data provided.' };
  }
  const contentType = getImageMimeType(imageBuffer);
  const normalizedFilename = normalizeImageFilename(filename);
  try {
    const form = new FormData();
    form.append('image', imageBuffer, {
      filename: normalizedFilename,
      contentType,
    });
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

/**
 * POST request with JSON body to CardSight (collectors, collections, etc.).
 */
async function _postJson(path, body = {}) {
  try {
    const response = await axios.post(`${BASE_URL}${path.startsWith('/') ? path : '/' + path}`, body, {
      headers: {
        ...getHeaders(),
        'Content-Type': 'application/json',
      },
      timeout: TIMEOUT_MS,
    });
    return { success: true, status: response.status, data: response.data };
  } catch (err) {
    const status = err.response?.status;
    const respBody = err.response?.data;
    return {
      success: false,
      status,
      error: err.response ? `CardSight API error (${status})` : err.message || 'Request failed',
      details: respBody?.message || respBody?.detail || (typeof respBody === 'object' ? JSON.stringify(respBody) : respBody),
    };
  }
}

/** Catalog search – cards, sets, releases, parallels */
async function searchCatalog(query = {}, params = {}) {
  const path = '/v1/catalog/search';
  return _get(path, { ...query, ...params });
}

/** Search cards catalog (name, card number, etc.) */
async function searchCards(params = {}) {
  return _get('/v1/catalog/cards', params);
}

/** Get detailed card info by CardSight card ID */
async function getCardById(cardId) {
  if (!cardId) {
    return {
      success: false,
      status: 400,
      error: 'Missing cardId',
      details: 'CardSight card ID is required',
    };
  }
  return _get(`/v1/catalog/cards/${cardId}`);
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

// --- Collections & collectors helpers ---

/** Create a collector */
async function createCollector(body) {
  return _postJson('/v1/collectors/', body);
}

/** List collectors */
async function getCollectors(params = {}) {
  return _get('/v1/collectors/', params);
}

/** Create a collection */
async function createCollection(body) {
  return _postJson('/v1/collection/', body);
}

/** List collections */
async function getCollections(params = {}) {
  return _get('/v1/collection/', params);
}

/** Add one or more cards to a collection */
async function addCollectionCards(collectionId, body) {
  return _postJson(`/v1/collection/${collectionId}/cards`, body);
}

/** List cards in a collection */
async function getCollectionCards(collectionId, params = {}) {
  return _get(`/v1/collection/${collectionId}/cards`, params);
}

/** Remove a card from a collection */
async function removeCollectionCard(collectionId, cardId) {
  if (!collectionId || !cardId) {
    return {
      success: false,
      status: 400,
      error: 'Missing collectionId or cardId',
    };
  }
  try {
    const response = await axios.delete(
      `${BASE_URL}/v1/collection/${collectionId}/cards/${cardId}`,
      { headers: getHeaders(), timeout: TIMEOUT_MS }
    );
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

module.exports = {
  identifyCard,
  detectCard,
  searchCatalog,
  searchCards,
  getCatalogStatistics,
  getSegments,
  getSubscription,
  getHealthAuth,
  createCollector,
  getCollectors,
  createCollection,
  getCollections,
  addCollectionCards,
  getCollectionCards,
  removeCollectionCard,
  getCardById,
};
