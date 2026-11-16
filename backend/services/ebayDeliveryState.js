// Shared delivery-state resolver for purchases and shipments.
// Carrier scan states come only from a carrier API (or stay Unknown). eBay "shipped"
// never becomes In transit / Delivered. Tracking numbers are rechecked at most every 6 hours,
// including when a staff user clicks Refresh.
const axios = require('axios');

const STATES = Object.freeze({
  AWAITING: 'Awaiting shipment',
  AT_USPS: 'At USPS (accepted)',
  IN_TRANSIT: 'In transit',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
  UNKNOWN: 'Unknown'
});

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const USPS_TOKEN_URL = 'https://apis.usps.com/oauth2/v3/token';
const USPS_TRACK_URL = 'https://apis.usps.com/tracking/v3/tracking';

function normalizeCarrier(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (!s) return null;
  if (/\busps\b|postal|united states postal|ebay standard delivery|ebay international shipping/.test(s)) return 'USPS';
  if (/\bups\b|united parcel/.test(s)) return 'UPS';
  if (/fedex/.test(s)) return 'FedEx';
  if (/dhl/.test(s)) return 'DHL';
  return String(raw).trim();
}

function trackingUrl(carrier, trackingNumber) {
  if (!trackingNumber) return null;
  const id = encodeURIComponent(String(trackingNumber).trim());
  const c = normalizeCarrier(carrier);
  if (c === 'USPS') return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${id}`;
  if (c === 'UPS') return `https://www.ups.com/track?tracknum=${id}`;
  if (c === 'FedEx') return `https://www.fedex.com/fedextrack/?trknbr=${id}`;
  if (c === 'DHL') return `https://www.dhl.com/us-en/home/tracking.html?tracking-id=${id}`;
  return `https://www.google.com/search?q=${encodeURIComponent(`${carrier || ''} ${trackingNumber} tracking`.trim())}`;
}

function mapUspsStatus(summary) {
  const text = String(summary || '').toLowerCase();
  if (!text) return STATES.UNKNOWN;
  if (/delivered|available for pickup|picked up by|left with|in.?mailbox/.test(text)) return STATES.DELIVERED;
  if (/out for delivery/.test(text)) return STATES.OUT_FOR_DELIVERY;
  if (/accepted|shipping label created|shipment received|arrived at usps|received by usps|pre-shipment|pre.?shipment/.test(text)
    && !/in transit|departed|arrived at|forwarded/.test(text)) {
    // "Accepted" / early acceptance without transit language.
    if (/accepted|received by usps|shipment received|arrived at usps facility/.test(text)) return STATES.AT_USPS;
  }
  if (/accepted|received by the.*postal|usps awaiting item/.test(text) && !/in transit|out for delivery|delivered/.test(text)) {
    return STATES.AT_USPS;
  }
  if (/in transit|departed|arrived at|forwarded|processed through|enroute|en route|sorting/.test(text)) return STATES.IN_TRANSIT;
  if (/out for delivery/.test(text)) return STATES.OUT_FOR_DELIVERY;
  if (/delivered/.test(text)) return STATES.DELIVERED;
  return STATES.UNKNOWN;
}

function createDeliveryResolver({
  env = process.env,
  http = axios,
  now = () => Date.now(),
  cache = new Map(),
  timeoutMs = 15000
} = {}) {
  let uspsToken = null;
  let uspsTokenExpiresAt = 0;
  let uspsSignupNeeded = null;

  function uspsConfigured() {
    return Boolean(env.USPS_CLIENT_ID && env.USPS_CLIENT_SECRET);
  }

  async function uspsAccessToken() {
    if (uspsToken && now() < uspsTokenExpiresAt - 60_000) return uspsToken;
    const res = await http.request({
      method: 'post',
      url: USPS_TOKEN_URL,
      data: {
        client_id: env.USPS_CLIENT_ID,
        client_secret: env.USPS_CLIENT_SECRET,
        grant_type: 'client_credentials'
      },
      headers: { 'Content-Type': 'application/json' },
      timeout: timeoutMs,
      validateStatus: () => true
    });
    if (res.status < 200 || res.status >= 300 || !res.data || typeof res.data.access_token !== 'string') {
      const err = new Error('USPS_AUTH_FAILED');
      err.kind = 'USPS_AUTH_FAILED';
      err.status = res.status;
      throw err;
    }
    uspsToken = res.data.access_token;
    uspsTokenExpiresAt = now() + Math.max(0, Number(res.data.expires_in || 3600) * 1000);
    return uspsToken;
  }

  async function fetchUsps(trackingNumber) {
    const token = await uspsAccessToken();
    const res = await http.request({
      method: 'get',
      url: `${USPS_TRACK_URL}/${encodeURIComponent(trackingNumber)}`,
      params: { expand: 'summary' },
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      timeout: timeoutMs,
      validateStatus: () => true
    });
    if (res.status === 401 || res.status === 403) {
      const err = new Error('USPS_PERMISSION_DENIED');
      err.kind = 'USPS_PERMISSION_DENIED';
      err.status = res.status;
      throw err;
    }
    if (res.status < 200 || res.status >= 300) {
      const err = new Error('USPS_UPSTREAM_ERROR');
      err.kind = 'USPS_UPSTREAM_ERROR';
      err.status = res.status;
      throw err;
    }
    const summary = (res.data && (res.data.statusSummary || res.data.status || res.data.trackSummary)) || null;
    const event = Array.isArray(res.data && res.data.trackingEvents) ? res.data.trackingEvents[0] : null;
    const eventText = event && (event.eventType || event.eventCode || event.description);
    return { state: mapUspsStatus(summary || eventText), summary: summary || eventText || null };
  }

  function ebayOnlyState({ shipped, trackingNumber }) {
    if (!shipped && !trackingNumber) return STATES.AWAITING;
    return STATES.UNKNOWN;
  }

  /**
   * @param {{ trackingNumber?: string|null, carrier?: string|null, shipped?: boolean }} input
   * @param {{ force?: boolean }} [opts] force still respects the 6-hour cache per tracking number
   */
  async function resolve(input = {}, { force = false } = {}) {
    const trackingNumber = input.trackingNumber ? String(input.trackingNumber).trim() : null;
    const carrier = normalizeCarrier(input.carrier);
    const shipped = Boolean(input.shipped);
    const url = trackingUrl(carrier || input.carrier, trackingNumber);
    const base = {
      deliveryState: ebayOnlyState({ shipped, trackingNumber }),
      deliveryStateSource: trackingNumber || shipped ? 'ebay' : 'none',
      carrier: carrier || (input.carrier ? String(input.carrier).trim() : null),
      trackingNumber,
      trackingUrl: url,
      carrierSignupNeeded: false,
      lastRefreshedAt: null,
      cacheHit: false
    };

    if (!trackingNumber) {
      return { ...base, lastRefreshedAt: new Date(now()).toISOString() };
    }

    const cached = cache.get(trackingNumber);
    if (cached && now() - cached.checkedAt < CACHE_TTL_MS) {
      return { ...cached.result, cacheHit: true, lastRefreshedAt: new Date(cached.checkedAt).toISOString() };
    }
    // Manual refresh does not bypass the TTL (brief: recheck at most every 6 hours, including refresh).
    if (force && cached && now() - cached.checkedAt < CACHE_TTL_MS) {
      return { ...cached.result, cacheHit: true, lastRefreshedAt: new Date(cached.checkedAt).toISOString() };
    }

    const checkedAt = now();
    let result = {
      ...base,
      deliveryState: STATES.UNKNOWN,
      deliveryStateSource: 'ebay',
      lastRefreshedAt: new Date(checkedAt).toISOString(),
      cacheHit: false
    };

    const looksUsps = !carrier || carrier === 'USPS';
    if (looksUsps && !uspsConfigured()) {
      uspsSignupNeeded = true;
      result = {
        ...result,
        carrierSignupNeeded: true,
        deliveryState: STATES.UNKNOWN,
        deliveryStateSource: 'ebay'
      };
    } else if (looksUsps && uspsConfigured()) {
      try {
        const tracked = await fetchUsps(trackingNumber);
        result = {
          ...result,
          deliveryState: tracked.state,
          deliveryStateSource: 'carrier',
          carrier: 'USPS',
          carrierSignupNeeded: false
        };
        uspsSignupNeeded = false;
      } catch {
        result = {
          ...result,
          deliveryState: STATES.UNKNOWN,
          deliveryStateSource: 'ebay',
          carrierSignupNeeded: false
        };
      }
    }

    cache.set(trackingNumber, { checkedAt, result: { ...result, cacheHit: false } });
    return result;
  }

  function signupFlag() {
    if (uspsSignupNeeded === null) return !uspsConfigured();
    return Boolean(uspsSignupNeeded);
  }

  return { resolve, trackingUrl, normalizeCarrier, signupFlag, STATES, CACHE_TTL_MS, cache };
}

module.exports = {
  createDeliveryResolver,
  normalizeCarrier,
  trackingUrl,
  mapUspsStatus,
  STATES,
  CACHE_TTL_MS
};
