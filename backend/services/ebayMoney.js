// Builds a per-order money view from the Sell Finances API (read-only).
const { SCOPES, EbaySellerError } = require('./ebaySellerClient');
const { parseUnits, formatUnits, CurrencyTotals } = require('../utils/decimalMoney');

const FINANCES_BASE = 'https://apiz.ebay.com/sell/finances/v1';
const MARKETPLACE_HEADERS = { 'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US' };
const TX_PAGE_LIMIT = 1000;
const PAYOUT_PAGE_LIMIT = 200;
const MAX_PAGES = 50;
const DEFAULT_DAYS = 30;
const MAX_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

function boundedDays(value) {
  if (value === undefined) return DEFAULT_DAYS;
  if (!/^\d+$/.test(String(value))) return null;
  const n = Number(value);
  return n >= 1 && n <= MAX_DAYS ? n : null;
}

async function fetchAll(client, path, key, limit, filter) {
  const items = [];
  let total = null;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const url = `${FINANCES_BASE}/${path}?filter=${encodeURIComponent(filter)}&limit=${limit}&offset=${page * limit}`;
    const data = await client.get(url, SCOPES.finances, { headers: MARKETPLACE_HEADERS });
    const batch = Array.isArray(data && data[key]) ? data[key] : [];
    if (typeof data.total === 'number') total = data.total;
    items.push(...batch);
    if (batch.length < limit || (total !== null && items.length >= total)) {
      if (total !== null && items.length < total) throw new EbaySellerError('INCOMPLETE_DATA');
      return items;
    }
  }
  throw new EbaySellerError('INCOMPLETE_DATA');
}

function signedUnits(tx) {
  const units = parseUnits(tx.amount && tx.amount.value);
  if (units === null || !tx.amount.currency) return null;
  if (tx.bookingEntry === 'DEBIT') return -(units < 0n ? -units : units);
  if (tx.bookingEntry === 'CREDIT') return units < 0n ? -units : units;
  return null;
}

function attributedOrderId(tx) {
  if (tx.orderId) return tx.orderId;
  const ref = (tx.references || []).find((r) => r && r.referenceType === 'ORDER_ID' && r.referenceId);
  return ref ? ref.referenceId : null;
}

function newBucket() {
  return {
    sales: new CurrencyTotals(),
    fees: new Map(), // feeType -> CurrencyTotals
    feeCredits: new Map(),
    shippingLabels: new CurrencyTotals(),
    refundsAndAdjustments: new CurrencyTotals(),
    net: new CurrencyTotals(),
    types: new Set(),
    count: 0,
    unparsedAmounts: 0
  };
}

function addFee(map, feeType, currency, units) {
  if (!map.has(feeType)) map.set(feeType, new CurrencyTotals());
  map.get(feeType).add(currency, units);
}

function lineItemFees(tx, map) {
  for (const li of tx.orderLineItems || []) {
    for (const fee of li.marketplaceFees || []) {
      const units = parseUnits(fee.amount && fee.amount.value);
      if (units === null || !fee.amount.currency) continue;
      addFee(map, fee.feeType || 'UNSPECIFIED', fee.amount.currency, units < 0n ? -units : units);
    }
  }
}

function applyTransaction(bucket, tx) {
  bucket.count += 1;
  bucket.types.add(tx.transactionType || 'UNKNOWN');
  const signed = signedUnits(tx);
  if (signed === null) { bucket.unparsedAmounts += 1; return; }
  const currency = tx.amount.currency;
  bucket.net.add(currency, signed);

  switch (tx.transactionType) {
    case 'SALE': {
      const gross = parseUnits(tx.totalFeeBasisAmount && tx.totalFeeBasisAmount.value);
      if (gross !== null && tx.totalFeeBasisAmount.currency) bucket.sales.add(tx.totalFeeBasisAmount.currency, gross);
      lineItemFees(tx, bucket.fees);
      break;
    }
    case 'SHIPPING_LABEL':
      bucket.shippingLabels.add(currency, signed);
      break;
    case 'NON_SALE_CHARGE':
      addFee(bucket.fees, tx.feeType || 'NON_SALE_CHARGE', currency, -signed);
      break;
    case 'REFUND':
      bucket.refundsAndAdjustments.add(currency, signed);
      lineItemFees(tx, bucket.feeCredits);
      break;
    default:
      bucket.refundsAndAdjustments.add(currency, signed);
  }
}

function feesJSON(map) {
  const byType = {};
  const total = new CurrencyTotals();
  for (const [type, totals] of [...map.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    byType[type] = totals.toJSON();
    for (const c of totals.currencies()) total.add(c, totals.get(c));
  }
  return { byType, total: total.toJSON() };
}

function bucketJSON(b) {
  return {
    transactionCount: b.count,
    transactionTypes: [...b.types].sort(),
    saleAmount: b.sales.toJSON(),
    fees: feesJSON(b.fees),
    feeCredits: feesJSON(b.feeCredits),
    shippingLabels: b.shippingLabels.toJSON(),
    refundsAndAdjustments: b.refundsAndAdjustments.toJSON(),
    netCredited: b.net.toJSON(),
    ...(b.unparsedAmounts ? { unparsedAmounts: b.unparsedAmounts } : {})
  };
}

async function buildMoneyView(client, { days = DEFAULT_DAYS, now = Date.now() } = {}) {
  const end = new Date(now).toISOString();
  const start = new Date(now - days * DAY_MS).toISOString();
  const [transactions, payouts] = await Promise.all([
    fetchAll(client, 'transaction', 'transactions', TX_PAGE_LIMIT, `transactionDate:[${start}..${end}]`),
    fetchAll(client, 'payout', 'payouts', PAYOUT_PAGE_LIMIT, `payoutDate:[${start}..${end}]`)
  ]);

  const byOrder = new Map();
  const unattributed = [];
  const unattributedNet = new CurrencyTotals();
  const attributedNet = new CurrencyTotals();

  for (const tx of transactions) {
    const orderId = attributedOrderId(tx);
    if (!orderId) {
      const signed = signedUnits(tx);
      if (signed !== null) unattributedNet.add(tx.amount.currency, signed);
      unattributed.push({
        transactionType: tx.transactionType || null,
        feeType: tx.feeType || null,
        bookingEntry: tx.bookingEntry || null,
        transactionDate: tx.transactionDate || null,
        amount: signed === null ? null : { value: formatUnits(signed, tx.amount.currency), currency: tx.amount.currency }
      });
      continue;
    }
    if (!byOrder.has(orderId)) byOrder.set(orderId, { latest: null, bucket: newBucket() });
    const entry = byOrder.get(orderId);
    applyTransaction(entry.bucket, tx);
    if (tx.transactionDate && (!entry.latest || tx.transactionDate > entry.latest)) entry.latest = tx.transactionDate;
    const signed = signedUnits(tx);
    if (signed !== null) attributedNet.add(tx.amount.currency, signed);
  }

  const orders = [...byOrder.entries()]
    .sort(([, a], [, b]) => String(b.latest || '').localeCompare(String(a.latest || '')))
    .map(([orderId, { latest, bucket }]) => ({ orderId, latestTransactionDate: latest, ...bucketJSON(bucket) }));

  const payoutTotals = new CurrencyTotals();
  const payoutItems = payouts.map((p) => {
    const units = parseUnits(p.amount && p.amount.value);
    const currency = p.amount && p.amount.currency;
    if (units !== null && currency) payoutTotals.add(currency, units);
    return {
      payoutDate: p.payoutDate || null,
      payoutStatus: p.payoutStatus || null,
      transactionCount: Number.isInteger(p.transactionCount) ? p.transactionCount : null,
      amount: units === null || !currency ? null : { value: formatUnits(units, currency), currency }
    };
  });

  return {
    generatedAt: end,
    source: 'eBay Sell Finances getTransactions / getPayouts',
    window: { days, start, end, transactionDateField: 'transactionDate', payoutDateField: 'payoutDate' },
    totals: { attributedNetCredited: attributedNet.toJSON(), unattributedNet: unattributedNet.toJSON() },
    orders,
    unattributed,
    payouts: { count: payoutItems.length, totalsByCurrency: payoutTotals.toJSON(), items: payoutItems },
    notes: [
      'Only transactions dated inside the window are included; an order\'s sale, label, and later refunds can fall in different windows, so these are not lifetime order profit.',
      'netCredited is the signed sum of this order\'s transactions in the window (credits positive, debits negative).',
      'Payouts are bank transfers of already-counted transactions; do not add them to order earnings.',
      'Unattributed transactions have no order reference and are not assigned to any order.'
    ]
  };
}

module.exports = { buildMoneyView, boundedDays, MAX_DAYS };
