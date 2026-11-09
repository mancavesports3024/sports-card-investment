// Shared fixtures for the internal eBay endpoint tests. No live requests are made.
const http = require('node:http');
const express = require('express');
const { createEbayInternalRouter } = require('../routes/ebayInternal');

const SECRET = 'test-cron-secret-0123456789abcdef';
const PII = {
  address: '742 Evergreen Terrace',
  email: 'buyer-private@example.com',
  phone: '555-867-5309',
  fullName: 'Private Buyer Fullname',
  paymentRef: 'PAYREF-SECRET-998877',
  bankRef: 'BANKREF-445566',
  instrument: 'ACCOUNT-ENDING-4321'
};

const amt = (value, currency = 'USD') => ({ value, currency });

function lineItem({ id, itemId = '111', title = '2025 Topps Series 1 #1-100 You Pick', card, aspects, qty = 1, status = 'NOT_STARTED', shipBy = '2026-11-12T07:59:59.000Z' }) {
  return {
    lineItemId: id,
    legacyItemId: itemId,
    title,
    quantity: qty,
    lineItemFulfillmentStatus: status,
    variationAspects: aspects || (card === undefined ? [] : [{ name: 'Card Type', value: 'Base' }, { name: 'Card', value: card }]),
    lineItemFulfillmentInstructions: { shipByDate: shipBy },
    lineItemCost: amt('1.00')
  };
}

function order({ id, created = '2026-11-09T10:00:00.000Z', status = 'NOT_STARTED', cancel = 'NONE_REQUESTED', payment = 'PAID', items = [], money = {}, hrefs = [] }) {
  return {
    orderId: id,
    creationDate: created,
    orderFulfillmentStatus: status,
    orderPaymentStatus: payment,
    cancelStatus: { cancelState: cancel, cancelRequests: [] },
    buyer: { username: `buyer_${id}`, buyerRegistrationAddress: { fullName: PII.fullName, email: PII.email, primaryPhone: { phoneNumber: PII.phone } } },
    fulfillmentStartInstructions: [{ shippingStep: { shipTo: { fullName: PII.fullName, email: PII.email, contactAddress: { addressLine1: PII.address }, primaryPhone: { phoneNumber: PII.phone } } } }],
    paymentSummary: { totalDueSeller: money.totalDueSeller, payments: [{ paymentReferenceId: PII.paymentRef }], refunds: [] },
    pricingSummary: { priceSubtotal: money.priceSubtotal, priceDiscount: money.priceDiscount, total: money.total },
    totalMarketplaceFee: money.totalMarketplaceFee,
    fulfillmentHrefs: hrefs,
    lineItems: items
  };
}

// Fake seller client: routes URLs to handlers, records calls.
function fakeClient(handler) {
  const calls = [];
  return {
    calls,
    async get(url, scope, opts) {
      calls.push({ url: decodeURIComponent(url), scope, headers: (opts && opts.headers) || {} });
      return handler(new URL(url), scope);
    }
  };
}

async function startApp(routerOptions) {
  const app = express();
  app.use('/api/internal', createEbayInternalRouter({ log: () => {}, ...routerOptions }));
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}/api/internal`;
  return {
    base,
    close: () => new Promise((r) => server.close(r)),
    get: (path, headers = {}) => fetch(base + path, { headers })
  };
}

const auth = { Authorization: `Bearer ${SECRET}` };

module.exports = { SECRET, PII, amt, lineItem, order, fakeClient, startApp, auth };
