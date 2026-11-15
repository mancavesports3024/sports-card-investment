// Fixtures for the stock / price-change tests: Trading API XML responses served by a fake HTTP layer,
// and an in-memory store with the same semantics as ebayStockStore. No live requests are made.
const { createTradingClient } = require('../services/ebayTradingClient');
const { RefreshInProgressError } = require('../services/ebayStockStore');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function variationXml({ card, qty = 1, sold = 0, price = '0.99', sku, extra = [] }) {
  const specifics = [...extra, ['Card', card]]
    .map(([n, v]) => `<NameValueList><Name>${esc(n)}</Name><Value>${esc(v)}</Value></NameValueList>`).join('');
  return `<Variation>${sku ? `<SKU>${esc(sku)}</SKU>` : ''}<StartPrice currencyID="USD">${price}</StartPrice><Quantity>${qty}</Quantity><VariationSpecifics>${specifics}</VariationSpecifics><SellingStatus><QuantitySold>${sold}</QuantitySold></SellingStatus></Variation>`;
}

function itemXml({ itemId, title = '2026 Topps Chrome Baseball #1-150 You Pick', status = 'Active', variations = null, qty = 1, sold = 0, price = '4.99' }) {
  const body = variations
    ? `<Variations>${variations.map(variationXml).join('')}</Variations>`
    : `<Quantity>${qty}</Quantity><StartPrice currencyID="USD">${price}</StartPrice>`;
  return `<?xml version="1.0" encoding="UTF-8"?><GetItemResponse xmlns="urn:ebay:apis:eBLBaseComponents"><Ack>Success</Ack><Item><ItemID>${itemId}</ItemID><ListingDetails><ViewItemURL>https://www.ebay.com/itm/${itemId}</ViewItemURL></ListingDetails><ListingType>FixedPriceItem</ListingType><SellingStatus><ListingStatus>${status}</ListingStatus><QuantitySold>${sold}</QuantitySold></SellingStatus><Title>${esc(title)}</Title>${body}</Item></GetItemResponse>`;
}

function sellerListXml({ ids, page = 1, totalPages = 1, total = ids.length, more = false, types = {} }) {
  const items = ids.map((id) => `<Item><ItemID>${id}</ItemID><ListingType>${types[id] || 'FixedPriceItem'}</ListingType><SellingStatus><ListingStatus>Active</ListingStatus></SellingStatus></Item>`).join('');
  return `<?xml version="1.0"?><GetSellerListResponse xmlns="urn:ebay:apis:eBLBaseComponents"><Ack>Success</Ack><PaginationResult><TotalNumberOfPages>${totalPages}</TotalNumberOfPages><TotalNumberOfEntries>${total}</TotalNumberOfEntries></PaginationResult><HasMoreItems>${more}</HasMoreItems><ItemArray>${items}</ItemArray><PageNumber>${page}</PageNumber></GetSellerListResponse>`;
}

function failureXml(call, code, severity = 'Error') {
  return `<?xml version="1.0"?><${call}Response xmlns="urn:ebay:apis:eBLBaseComponents"><Ack>Failure</Ack><Errors><ShortMessage>x</ShortMessage><ErrorCode>${code}</ErrorCode><SeverityCode>${severity}</SeverityCode></Errors></${call}Response>`;
}

const successXml = (call) => `<?xml version="1.0"?><${call}Response xmlns="urn:ebay:apis:eBLBaseComponents"><Ack>Success</Ack></${call}Response>`;

// handler({ call, body, headers }) -> XML string | { status, data } | throws (network error).
function fakeTrading(handler) {
  const calls = [];
  const tokens = [];
  const sellerClient = {
    async getAccessToken(scope) { tokens.push(scope); return 'test-user-token'; },
    invalidate() {}
  };
  const http = {
    async request(config) {
      const call = config.headers['X-EBAY-API-CALL-NAME'];
      calls.push({ call, body: config.data, headers: config.headers });
      const out = await handler({ call, body: config.data, headers: config.headers });
      return typeof out === 'string' ? { status: 200, data: out } : out;
    }
  };
  const trading = createTradingClient({ sellerClient, http });
  return { trading, calls, tokens, writes: () => calls.filter((c) => c.call.startsWith('Revise')) };
}

const itemIdOf = (body) => (/<ItemID>(\d+)<\/ItemID>/.exec(body) || [])[1];

function memoryStockStore({ index = null } = {}) {
  const state = { runs: [], listings: index ? index.listings : [], lastSuccess: index ? index.lastSuccess : null, changes: [], priceUpdates: [] };
  let nextChange = 1;
  return {
    state,
    async startRefresh() {
      if (state.runs.some((r) => r.status === 'RUNNING')) throw new RefreshInProgressError();
      const run = { id: state.runs.length + 1, status: 'RUNNING' };
      state.runs.push(run);
      return run.id;
    },
    async failRefresh(id, { errorKind }) { Object.assign(state.runs.find((r) => r.id === id), { status: 'FAILED', error_kind: errorKind }); },
    async replaceIndex(id, listings, { durationMs }) {
      state.listings = listings;
      const pickCount = listings.reduce((n, l) => n + l.picks.length, 0);
      Object.assign(state.runs.find((r) => r.id === id), { status: 'SUCCEEDED' });
      state.lastSuccess = { id, finished_at: new Date('2026-11-14T12:00:00Z'), duration_ms: durationMs, item_count: listings.length, pick_count: pickCount };
      return { itemCount: listings.length, pickCount };
    },
    async refreshStatus() {
      const last = state.runs[state.runs.length - 1];
      return { lastSuccess: state.lastSuccess, lastRun: last ? { id: last.id, status: last.status, error_kind: last.error_kind || null } : null };
    },
    async findPicks(q) {
      const rows = [];
      for (const l of state.listings) {
        for (const p of l.picks) {
          if (!` ${p.searchText}`.includes(` ${q}`)) continue;
          rows.push({ item_id: l.itemId, title: l.title, url: l.url, card_number: p.cardNumber, card_name: p.cardName, card_raw: p.card, pick_status: p.pickStatus, quantity_available: p.quantityAvailable, quantity_sold: p.quantitySold, sold_out: p.soldOut, price_value: p.price ? p.price.value : null, currency: p.price ? p.price.currency : null, variation_key: p.variationKey || '' });
        }
      }
      return { rows, truncated: false };
    },
    async updateIndexedPrice(itemId, variationKey, price) { state.priceUpdates.push({ itemId, variationKey, price }); },
    async openChange(itemId, variationKey) {
      return state.changes.find((c) => c.item_id === itemId && c.variation_key === variationKey && ['PENDING', 'UNKNOWN'].includes(c.status)) || null;
    },
    async claimChange(c) {
      if (state.changes.some((x) => x.item_id === c.itemId && x.variation_key === c.variationKey && ['PENDING', 'UNKNOWN'].includes(x.status))) return null;
      const row = { id: nextChange++, item_id: c.itemId, variation_key: c.variationKey, card_number: c.cardNumber, card_raw: c.card, listing_title: c.title, old_price: c.oldPrice, new_price: c.newPrice, currency: c.currency, method: c.method, status: 'PENDING', requested_by: c.requestedBy, requested_at: new Date(), quantity_before: c.quantityBefore, read_back_price: null, quantity_after: null, error_kind: null, note: null, finished_at: null };
      state.changes.push(row);
      return row.id;
    },
    async finishChange(id, f) {
      const row = state.changes.find((c) => c.id === Number(id));
      if (!row || !['PENDING', 'UNKNOWN'].includes(row.status)) return;
      Object.assign(row, { status: f.status, read_back_price: f.readBackPrice ?? null, quantity_after: f.quantityAfter ?? null, error_kind: f.errorKind ?? null, ebay_error_codes: f.errorCodes ?? null, note: f.note ?? null, finished_at: new Date() });
    },
    async listChanges({ limit }) { return [...state.changes].reverse().slice(0, limit); }
  };
}

module.exports = { itemXml, sellerListXml, failureXml, successXml, fakeTrading, itemIdOf, memoryStockStore };
