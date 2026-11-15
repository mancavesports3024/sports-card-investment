import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EbayInventory from './EbayInventory';

const b64 = (o) => btoa(JSON.stringify(o)).replace(/=+$/, '');
const TOKEN = `${b64({ alg: 'HS256' })}.${b64({ email: 'mancavesportscardsllc@gmail.com', exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`;

const json = (status, body) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });

const STATUS = { built: true, refreshedAt: '2026-11-14T12:00:00.000Z', itemCount: 138, pickCount: 10318, lastRunStatus: 'SUCCEEDED' };
const RESULTS = {
  name: 'Pete Crow-Armstrong',
  listingCount: 2,
  matchCount: 2,
  availableCount: 1,
  soldOutCount: 1,
  truncated: false,
  index: { refreshedAt: STATUS.refreshedAt },
  listings: [
    { itemId: '397766758373', title: '2026 Topps Series 1 #176-#350', picks: [{ cardNumber: '196', cardName: 'Pete Crow-Armstrong, Chicago Cubs', card: '196 Pete Crow-Armstrong, Chicago Cubs', quantityAvailable: 48, soldOut: false, price: { value: '0.99', currency: 'USD' }, pickStatus: 'PARSED' }] },
    { itemId: '397628970564', title: '2025 Topps Holiday', picks: [{ cardNumber: 'H41', cardName: 'Pete Crow-Armstrong  Chicago Cubs', card: 'H41 Pete Crow-Armstrong  Chicago Cubs', quantityAvailable: 0, soldOut: true, price: { value: '0.99', currency: 'USD' }, pickStatus: 'PARSED' }] }
  ]
};
const CONFIRM_WITH = { itemId: '397766758373', cardNumber: '196', card: '196 Pete Crow-Armstrong, Chicago Cubs', newPrice: '2.49', expectedOldPrice: '0.99', confirm: true };

function route(handlers) {
  global.fetch = jest.fn((url, opts = {}) => {
    const path = url.replace(/^.*\/api\/staff\/ebay/, '');
    const key = `${opts.method || 'GET'} ${path.split('?')[0]}`;
    const h = handlers[key];
    if (!h) throw new Error(`unexpected ${key}`);
    return h(opts.body ? JSON.parse(opts.body) : undefined, path);
  });
}

beforeEach(() => localStorage.setItem('authToken', TOKEN));
afterEach(() => { localStorage.clear(); delete global.fetch; });

test('signed-in non-staff accounts see a refusal and no inventory', async () => {
  route({ 'GET /me': () => json(403, { error: 'FORBIDDEN', message: 'This account is not on the staff list.' }) });
  render(<EbayInventory />);
  expect(await screen.findByText('This account is not on the staff list.')).toBeInTheDocument();
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

test('signed-out visitors are asked to sign in', async () => {
  localStorage.clear();
  global.fetch = jest.fn();
  render(<EbayInventory />);
  expect(await screen.findByText('Sign in with Google')).toBeInTheDocument();
  expect(global.fetch).not.toHaveBeenCalled();
});

test('player search, sold-out rows, and a confirmed price change', async () => {
  const setPrice = jest.fn((body) => (body.confirm
    ? json(200, { status: 'applied', newPrice: { value: '2.49', currency: 'USD' }, warnings: [] })
    : json(200, { status: 'preview', change: { title: RESULTS.listings[0].title, oldPrice: { value: '0.99' }, newPrice: { value: '2.49' } }, confirmWith: CONFIRM_WITH })));
  route({
    'GET /me': () => json(200, { email: 'mancavesportscardsllc@gmail.com', staff: true }),
    'GET /ebay-stock-refresh': () => json(200, STATUS),
    'GET /ebay-find-player': (_b, path) => { expect(path).toContain('name=Pete%20Crow-Armstrong'); return json(200, RESULTS); },
    'POST /ebay-set-price': setPrice
  });
  render(<EbayInventory />);
  expect(await screen.findByText(/138 listings · 10318 cards/)).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('Player name'), { target: { value: 'Pete Crow-Armstrong' } });
  fireEvent.click(screen.getByText('Search'));
  expect(await screen.findByText('2026 Topps Series 1 #176-#350')).toBeInTheDocument();
  expect(screen.getByText('SOLD OUT')).toBeInTheDocument();
  expect(screen.queryByLabelText(/New price for #H41/)).toBeNull();

  fireEvent.change(screen.getByLabelText(/New price for #196/), { target: { value: '2.49' } });
  fireEvent.click(screen.getByText('Update'));
  const dialog = await screen.findByRole('alertdialog');
  expect(dialog).toHaveTextContent('Change #196 Pete Crow-Armstrong, Chicago Cubs in “2026 Topps Series 1 #176-#350” from $0.99 to $2.49?');
  expect(setPrice).toHaveBeenCalledTimes(1);
  expect(setPrice.mock.calls[0][0]).toEqual({ itemId: '397766758373', cardNumber: '196', card: '196 Pete Crow-Armstrong, Chicago Cubs', newPrice: '2.49' });

  fireEvent.click(screen.getByText('Confirm change on eBay'));
  expect(await screen.findByText('Updated. eBay now shows $2.49.')).toBeInTheDocument();
  expect(setPrice).toHaveBeenCalledTimes(2);
  expect(setPrice.mock.calls[1][0]).toEqual(CONFIRM_WITH);
});

test('cancel sends nothing to eBay', async () => {
  const setPrice = jest.fn(() => json(200, { status: 'preview', change: { title: 't', oldPrice: { value: '0.99' }, newPrice: { value: '3.00' } }, confirmWith: { ...CONFIRM_WITH, newPrice: '3.00' } }));
  route({
    'GET /me': () => json(200, { staff: true }),
    'GET /ebay-stock-refresh': () => json(200, STATUS),
    'GET /ebay-find-player': () => json(200, RESULTS),
    'POST /ebay-set-price': setPrice
  });
  render(<EbayInventory />);
  await screen.findByText(/138 listings/);
  fireEvent.change(screen.getByLabelText('Player name'), { target: { value: 'Pete' } });
  fireEvent.click(screen.getByText('Search'));
  fireEvent.change(await screen.findByLabelText(/New price for #196/), { target: { value: '3' } });
  fireEvent.click(screen.getByText('Update'));
  await screen.findByRole('alertdialog');
  fireEvent.click(screen.getByText('Cancel'));
  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  expect(setPrice).toHaveBeenCalledTimes(1);
});
