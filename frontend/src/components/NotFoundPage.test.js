// The catch-all page's content and navigation.
//
// Its SEO behaviour (noindex, nofollow, exactly one robots tag) is covered by
// privateRouteSeo.test.js; this covers what a person actually sees, since the
// point of the page is that an unmatched URL no longer renders a blank shell.

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import NotFoundPage from './NotFoundPage';

const renderAt = (route = '/no-such-page') =>
  render(
    <MemoryRouter initialEntries={[route]}>
      <NotFoundPage />
    </MemoryRouter>
  );

describe('the Page Not Found page', () => {
  it('explains what happened instead of rendering nothing', () => {
    renderAt();

    expect(
      screen.getByRole('heading', { level: 1, name: 'Page Not Found' })
    ).toBeInTheDocument();
    expect(screen.getByText(/may have been moved/i)).toBeInTheDocument();
  });

  it('names the path that was not found', () => {
    renderAt('/totally-made-up-path');

    expect(screen.getByText('/totally-made-up-path')).toBeInTheDocument();
  });

  it('offers a way back to Home and News', () => {
    renderAt();

    expect(screen.getByRole('link', { name: 'Go to Home' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Browse News' })).toHaveAttribute(
      'href',
      '/news'
    );
  });

  it('documents that it does not produce a real HTTP 404', () => {
    // The status really is 200; the comment is the only place that can say so,
    // and it must not quietly disappear.
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(path.join(__dirname, 'NotFoundPage.js'), 'utf8');

    expect(source).toMatch(/KNOWN LIMITATION/);
    expect(source).toMatch(/HTTP 200/);
  });
});
