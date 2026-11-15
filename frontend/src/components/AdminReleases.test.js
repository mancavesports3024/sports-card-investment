import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import AdminReleases from './AdminReleases';

const fakeToken = (email) =>
  `x.${btoa(JSON.stringify({ email, exp: Math.floor(Date.now() / 1000) + 3600 }))}.y`;

const RELEASES = [
  { id: 1, title: '2026 Topps Chrome Football', brand: 'Topps', sport: 'Football', releaseDate: '2026-11-18', status: 'Upcoming', retailPrice: 'Value Blaster $44.99', hobbyPrice: '$439.99' },
  { id: 2, title: '2025 Onyx RIPS Collection Baseball', brand: 'Onyx', sport: 'Baseball', releaseDate: '2025-07-29', status: 'Released', retailPrice: null, hobbyPrice: null },
  { id: 3, title: '2026 Bowman U Signature Football', brand: 'Topps', sport: 'Football', releaseDate: '2026-12-04', status: 'Upcoming', retailPrice: null, hobbyPrice: '$379.99' },
];

const okJson = (body, status = 200) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });

beforeEach(() => {
  localStorage.clear();
  global.fetch = jest.fn((url, options = {}) => {
    if (!options.method || options.method === 'GET') return okJson({ success: true, releases: RELEASES });
    if (options.method === 'POST') return okJson({ success: true, release: JSON.parse(options.body) }, 201);
    return okJson({ success: true });
  });
  window.confirm = jest.fn(() => true);
});

it('shows the admin-only message and loads nothing when logged out', () => {
  render(<AdminReleases />);
  expect(screen.getByText(/Admin Access Required/)).toBeInTheDocument();
  expect(global.fetch).not.toHaveBeenCalled();
});

it('shows the admin-only message for a signed-in non-admin', () => {
  localStorage.setItem('authToken', fakeToken('someone@example.com'));
  render(<AdminReleases />);
  expect(screen.getByText(/Admin Access Required/)).toBeInTheDocument();
});

describe('as an admin', () => {
  beforeEach(() => localStorage.setItem('authToken', fakeToken('mancavesportscardsllc@gmail.com')));

  it('lists releases newest date first and filters by title', async () => {
    render(<AdminReleases />);
    await screen.findByText('2026 Topps Chrome Football');
    const titles = screen.getAllByRole('row').slice(1).map((row) => within(row).getAllByRole('cell')[1].textContent);
    expect(titles).toEqual(['2026 Bowman U Signature Football', '2026 Topps Chrome Football', '2025 Onyx RIPS Collection Baseball']);

    fireEvent.change(screen.getByLabelText('Search by title'), { target: { value: 'onyx' } });
    expect(screen.getAllByRole('row')).toHaveLength(2);
    expect(screen.getByText('2025 Onyx RIPS Collection Baseball')).toBeInTheDocument();
  });

  it('adds a release with the date and free-text prices exactly as typed', async () => {
    render(<AdminReleases />);
    await screen.findByText('2026 Topps Chrome Football');
    fireEvent.click(screen.getByText('+ Add Release'));
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: '2026 Topps Holiday Baseball' } });
    fireEvent.change(screen.getByLabelText('Release date'), { target: { value: '2026-10-21' } });
    fireEvent.change(screen.getByLabelText('Retail price (optional)'), {
      target: { value: 'Mega $29.99, Tin $44.99, Advent Calendar $59.99' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add Release' }));

    await waitFor(() => expect(global.fetch.mock.calls.some(([, o]) => o && o.method === 'POST')).toBe(true));
    const [url, options] = global.fetch.mock.calls.find(([, o]) => o && o.method === 'POST');
    expect(url).toMatch(/\/api\/releases$/);
    expect(options.headers.Authorization).toMatch(/^Bearer /);
    const body = JSON.parse(options.body);
    expect(body).toMatchObject({
      title: '2026 Topps Holiday Baseball',
      releaseDate: '2026-10-21',
      year: '2026',
      retailPrice: 'Mega $29.99, Tin $44.99, Advent Calendar $59.99',
      hobbyPrice: '',
    });
    expect(body).not.toHaveProperty('status');
    expect(window.confirm).not.toHaveBeenCalled();
  });

  it('warns before adding a title that already exists', async () => {
    window.confirm = jest.fn(() => false);
    render(<AdminReleases />);
    await screen.findByText('2026 Topps Chrome Football');
    fireEvent.click(screen.getByText('+ Add Release'));
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: '2026 topps chrome football ' } });
    fireEvent.change(screen.getByLabelText('Release date'), { target: { value: '2026-11-18' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Release' }));
    expect(window.confirm).toHaveBeenCalled();
    expect(global.fetch.mock.calls.some(([, o]) => o && o.method === 'POST')).toBe(false);
  });

  it('edits the date with PUT and deletes only after confirmation', async () => {
    render(<AdminReleases />);
    await screen.findByText('2026 Topps Chrome Football');
    const row = screen.getByText('2026 Topps Chrome Football').closest('tr');

    fireEvent.click(within(row).getByText('Edit'));
    expect(screen.getByLabelText('Release date')).toHaveValue('2026-11-18');
    fireEvent.change(screen.getByLabelText('Release date'), { target: { value: '2026-11-25' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await waitFor(() => expect(global.fetch.mock.calls.some(([, o]) => o && o.method === 'PUT')).toBe(true));
    const [putUrl, putOptions] = global.fetch.mock.calls.find(([, o]) => o && o.method === 'PUT');
    expect(putUrl).toMatch(/\/api\/releases\/1$/);
    expect(JSON.parse(putOptions.body).releaseDate).toBe('2026-11-25');

    window.confirm = jest.fn(() => false);
    fireEvent.click(within(screen.getByText('2026 Topps Chrome Football').closest('tr')).getByText('Delete'));
    expect(global.fetch.mock.calls.some(([, o]) => o && o.method === 'DELETE')).toBe(false);

    window.confirm = jest.fn(() => true);
    fireEvent.click(within(screen.getByText('2026 Topps Chrome Football').closest('tr')).getByText('Delete'));
    await waitFor(() => expect(global.fetch.mock.calls.some(([, o]) => o && o.method === 'DELETE')).toBe(true));
    expect(global.fetch.mock.calls.find(([, o]) => o && o.method === 'DELETE')[0]).toMatch(/\/api\/releases\/1$/);
  });
});
