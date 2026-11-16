import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EbayPurchasesShipments from './EbayPurchasesShipments';

const b64 = (o) => btoa(JSON.stringify(o)).replace(/=+$/, '');
const TOKEN = `${b64({ alg: 'HS256' })}.${b64({ email: 'mancavesportscardsllc@gmail.com', exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`;
const json = (status, body) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });

function route(handlers) {
  global.fetch = jest.fn((url, opts = {}) => {
    const path = url.replace(/^.*\/api\/staff\/ebay/, '');
    const key = `${opts.method || 'GET'} ${path.split('?')[0]}`;
    const h = handlers[key];
    if (!h) throw new Error(`unexpected ${key}`);
    return h(path);
  });
}

beforeEach(() => localStorage.setItem('authToken', TOKEN));
afterEach(() => { localStorage.clear(); delete global.fetch; });

test('staff board loads Bought rows and switches to Sold', async () => {
  route({
    'GET /me': () => json(200, { email: 'mancavesportscardsllc@gmail.com', staff: true }),
    'GET /ebay-purchases': () => json(200, {
      generatedAt: '2026-11-16T18:00:00.000Z',
      purchaseCount: 1,
      carrierSignupNeeded: true,
      carrierSignupNote: 'USPS signup needed',
      purchases: [{
        orderId: '1',
        item: 'Bought lot',
        seller: 'seller_a',
        orderDate: '2026-11-10T12:00:00.000Z',
        deliveryState: 'Awaiting shipment',
        trackingNumber: null,
        trackingUrl: null
      }]
    }),
    'GET /ebay-shipments': () => json(200, {
      generatedAt: '2026-11-16T18:00:00.000Z',
      shipmentCount: 1,
      carrierSignupNeeded: true,
      shipments: [{
        orderId: '2',
        item: 'Sold pick',
        buyer: 'buyer_b',
        shipDate: '2026-11-12T09:00:00.000Z',
        deliveryState: 'Unknown',
        carrier: 'USPS',
        trackingNumber: '9400108106244666787591',
        trackingUrl: 'https://tools.usps.com/go/TrackConfirmAction?tLabels=9400108106244666787591',
        lastRefreshedAt: '2026-11-16T18:00:00.000Z'
      }]
    })
  });

  render(<EbayPurchasesShipments />);
  expect(await screen.findByText('Bought lot')).toBeInTheDocument();
  expect(screen.getByText('Awaiting shipment')).toBeInTheDocument();
  expect(screen.getByText(/USPS signup needed/)).toBeInTheDocument();

  fireEvent.click(screen.getByRole('tab', { name: 'Sold' }));
  expect(await screen.findByText('Sold pick')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /9400108106244666787591/ })).toHaveAttribute('href', expect.stringContaining('usps.com'));
});

test('signed-out visitors are asked to sign in', async () => {
  localStorage.clear();
  global.fetch = jest.fn();
  render(<EbayPurchasesShipments />);
  expect(await screen.findByText('Sign in with Google')).toBeInTheDocument();
  expect(global.fetch).not.toHaveBeenCalled();
});
