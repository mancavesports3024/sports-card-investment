import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SiteHeader from './SiteHeader';
const renderHeader = props => render(<MemoryRouter><SiteHeader isLoggedIn={false} isAdmin={false} onLogin={jest.fn()} onLogout={jest.fn()} {...props} /></MemoryRouter>);
test('staff tools retain inventory and management destinations', () => {
  renderHeader({ isLoggedIn: true, isAdmin: true, user: { name: 'Carl' } });
  const staff = screen.getByText('Staff tools').closest('details');
  fireEvent.click(screen.getByText('Staff tools'));
  expect(within(staff).getByRole('link', { name: /eBay Inventory/ })).toHaveAttribute('href', '/admin/ebay-inventory');
  expect(within(staff).getByRole('link', { name: 'Manage Releases' })).toHaveAttribute('href', '/admin/releases');
});
test('signed-in non-staff users do not receive staff links', () => {
  renderHeader({ isLoggedIn: true });
  expect(screen.queryByText('Staff tools')).not.toBeInTheDocument();
});
test('mobile menu toggles and closes when navigating', () => {
  renderHeader();
  const toggle = screen.getByRole('button', { name: /Menu/ });
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(toggle);
  expect(screen.getByRole('button', { name: 'Close menu' })).toHaveAttribute('aria-expanded', 'true');
  fireEvent.click(screen.getByRole('link', { name: 'Recent Auction Sales' }));
  expect(screen.getByRole('button', { name: /Menu/ })).toHaveAttribute('aria-expanded', 'false');
});
