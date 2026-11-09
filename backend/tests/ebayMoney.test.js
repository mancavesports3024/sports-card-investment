// Run from backend/: node --test --test-force-exit tests/ebayMoney.test.js
const test = require('node:test');
const assert = require('node:assert');

const { buildMoneyView } = require('../services/ebayMoney');
const { parseUnits, formatUnits, CurrencyTotals } = require('../utils/decimalMoney');
const { SECRET, PII, amt, fakeClient, startApp, auth } = require('./ebayInternalTestUtils');

const NOW = Date.parse('2026-11-09T20:00:00.000Z');

const tx = (o) => ({
  transactionId: `T-${Math.random()}`,
  transactionDate: '2026-11-05T12:00:00.000Z',
  transactionStatus: 'PAYOUT',
  buyer: { username: 'buyer1' },
  paymentsEntity: PII.paymentRef,
  salesRecordReference: '0',
  payoutId: PII.paymentRef,
  ...o
});

const SALE = tx({
  orderId: 'O-1',
  transactionType: 'SALE',
  bookingEntry: 'CREDIT',
  amount: amt('25.65'),
  totalFeeBasisAmount: amt('29.56'),
  totalFeeAmount: amt('3.91'),
  orderLineItems: [
    { lineItemId: 'L1', marketplaceFees: [{ feeType: 'FINAL_VALUE_FEE', amount: amt('3.51') }, { feeType: 'FINAL_VALUE_FEE_FIXED_PER_ORDER', amount: amt('0.40') }] }
  ]
});

function financeClient({ transactions, payouts = [] }) {
  return fakeClient((url) => {
    const offset = Number(url.searchParams.get('offset'));
    const limit = Number(url.searchParams.get('limit'));
    if (url.pathname.endsWith('/transaction')) return { total: transactions.length, transactions: transactions.slice(offset, offset + limit) };
    return { total: payouts.length, payouts: payouts.slice(offset, offset + limit) };
  });
}

test('decimal helpers are exact', () => {
  const t = new CurrencyTotals();
  for (let i = 0; i < 10; i += 1) t.add('USD', parseUnits('0.10'));
  t.add('USD', -parseUnits('0.3'));
  assert.deepStrictEqual(t.toJSON(), { USD: '0.70' });
  assert.strictEqual(formatUnits(parseUnits('1234567.891'), 'USD'), '1234567.891');
  assert.strictEqual(formatUnits(parseUnits('500'), 'JPY'), '500');
  assert.strictEqual(parseUnits('abc'), null);
  assert.strictEqual(parseUnits(undefined), null);
});

test('groups by order with fees by type, labels, refunds, and net; keeps unattributed separate', async () => {
  const transactions = [
    SALE,
    tx({ orderId: 'O-1', transactionType: 'SHIPPING_LABEL', bookingEntry: 'DEBIT', amount: amt('5.19') }),
    tx({ orderId: 'O-1', transactionType: 'REFUND', bookingEntry: 'DEBIT', amount: amt('2.00'), orderLineItems: [{ lineItemId: 'L1', marketplaceFees: [{ feeType: 'FINAL_VALUE_FEE', amount: amt('0.27') }] }] }),
    tx({ transactionType: 'NON_SALE_CHARGE', bookingEntry: 'DEBIT', amount: amt('0.40'), feeType: 'FINAL_VALUE_FEE_FIXED_PER_ORDER', references: [{ referenceType: 'ORDER_ID', referenceId: 'O-2' }] }),
    tx({ transactionType: 'NON_SALE_CHARGE', bookingEntry: 'DEBIT', amount: amt('1.10'), feeType: 'OTHER_FEES' }),
    tx({ orderId: 'O-3', transactionType: 'SALE', bookingEntry: 'CREDIT', amount: amt('9.00', 'CAD'), totalFeeBasisAmount: amt('10.00', 'CAD'), orderLineItems: [] })
  ];
  const payouts = [
    { payoutId: PII.paymentRef, payoutStatus: 'SUCCEEDED', amount: amt('100.01'), payoutDate: '2026-11-06T00:00:00.000Z', transactionCount: 4, payoutInstrument: { accountLastFourDigits: PII.instrument }, bankReference: PII.bankRef },
    { payoutId: 'P2', payoutStatus: 'SUCCEEDED', amount: amt('0.02'), payoutDate: '2026-11-07T00:00:00.000Z', transactionCount: 1 }
  ];
  const client = financeClient({ transactions, payouts });
  const view = await buildMoneyView(client, { days: 30, now: NOW });

  assert.deepStrictEqual(view.window, { days: 30, start: '2026-10-10T20:00:00.000Z', end: '2026-11-09T20:00:00.000Z', transactionDateField: 'transactionDate', payoutDateField: 'payoutDate' });
  const txCall = client.calls.find((c) => c.url.includes('/transaction'));
  assert.match(txCall.url, /filter=transactionDate:\[2026-10-10T20:00:00\.000Z\.\.2026-11-09T20:00:00\.000Z\]/);
  assert.strictEqual(txCall.headers['X-EBAY-C-MARKETPLACE-ID'], 'EBAY_US');

  const o1 = view.orders.find((o) => o.orderId === 'O-1');
  assert.deepStrictEqual(o1.saleAmount, { USD: '29.56' });
  assert.deepStrictEqual(o1.fees, { byType: { FINAL_VALUE_FEE: { USD: '3.51' }, FINAL_VALUE_FEE_FIXED_PER_ORDER: { USD: '0.40' } }, total: { USD: '3.91' } });
  assert.deepStrictEqual(o1.feeCredits.total, { USD: '0.27' });
  assert.deepStrictEqual(o1.shippingLabels, { USD: '-5.19' });
  assert.deepStrictEqual(o1.refundsAndAdjustments, { USD: '-2.00' });
  assert.deepStrictEqual(o1.netCredited, { USD: '18.46' });

  const o2 = view.orders.find((o) => o.orderId === 'O-2');
  assert.deepStrictEqual(o2.fees.byType, { FINAL_VALUE_FEE_FIXED_PER_ORDER: { USD: '0.40' } });
  assert.deepStrictEqual(o2.saleAmount, {});

  const o3 = view.orders.find((o) => o.orderId === 'O-3');
  assert.deepStrictEqual(o3.netCredited, { CAD: '9.00' });

  assert.strictEqual(view.unattributed.length, 1);
  assert.deepStrictEqual(view.unattributed[0].amount, { value: '-1.10', currency: 'USD' });
  assert.deepStrictEqual(view.totals, { attributedNetCredited: { CAD: '9.00', USD: '18.06' }, unattributedNet: { USD: '-1.10' } });

  assert.deepStrictEqual(view.payouts.totalsByCurrency, { USD: '100.03' });
  assert.ok(view.notes.some((n) => /not lifetime order profit/.test(n)));

  const text = JSON.stringify(view);
  for (const value of Object.values(PII)) assert.ok(!text.includes(value), `leaked ${value}`);
  assert.ok(!text.includes('buyer1'));
});

test('paginates transactions and payouts to completion', async () => {
  const transactions = Array.from({ length: 2100 }, (_, i) => tx({ orderId: `O-${i % 7}`, transactionType: 'SALE', bookingEntry: 'CREDIT', amount: amt('0.01'), totalFeeBasisAmount: amt('0.01') }));
  const payouts = Array.from({ length: 250 }, () => ({ payoutStatus: 'SUCCEEDED', amount: amt('1.00'), payoutDate: '2026-11-01T00:00:00.000Z' }));
  const client = financeClient({ transactions, payouts });
  const view = await buildMoneyView(client, { days: 30, now: NOW });
  assert.strictEqual(client.calls.filter((c) => c.url.includes('/transaction')).length, 3);
  assert.strictEqual(client.calls.filter((c) => c.url.includes('/payout')).length, 2);
  assert.deepStrictEqual(view.totals.attributedNetCredited, { USD: '21.00' });
  assert.strictEqual(view.payouts.count, 250);
  assert.deepStrictEqual(view.payouts.totalsByCurrency, { USD: '250.00' });
});

test('money endpoint is protected and returns no-store', async () => {
  const client = financeClient({ transactions: [SALE] });
  const app = await startApp({ env: { CRON_SECRET: SECRET }, client, now: () => NOW });
  try {
    assert.strictEqual((await app.get('/ebay-money?days=30')).status, 401);
    const res = await app.get('/ebay-money?days=7', auth);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers.get('cache-control'), 'no-store');
    assert.strictEqual((await res.json()).window.days, 7);
  } finally { await app.close(); }
});
