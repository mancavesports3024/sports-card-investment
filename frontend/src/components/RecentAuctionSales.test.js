import React from 'react';
import { render, screen } from '@testing-library/react';
import RecentAuctionSales from './RecentAuctionSales';

const sale = (overrides = {}) => ({
  title: '2023 Topps Chrome Corbin Carroll RC',
  price: 12.5,
  soldDate: '2026-10-20T18:00:00Z',
  source: 'ebay',
  url: 'https://www.ebay.com/itm/1',
  imageUrl: 'https://i.ebayimg.com/1.jpg',
  grade: null,
  ...overrides
});

describe('RecentAuctionSales', () => {
  it('shows each sale with price, date, link, image, and unknown grade when none is reported', () => {
    render(<RecentAuctionSales results={{ searchParams: { searchQuery: 'Corbin Carroll' }, sales: [sale(), sale({ title: 'Carroll PSA 10', price: 80, grade: { company: 'PSA', value: '10' }, url: 'https://www.ebay.com/itm/2' })] }} />);

    expect(screen.getByText(/Found 2 completed auction sales/)).toBeInTheDocument();
    expect(screen.getByText('$12.50')).toBeInTheDocument();
    expect(screen.getByText(/Grade not listed/)).toBeInTheDocument();
    expect(screen.getByText(/PSA 10 · Auction on eBay/)).toBeInTheDocument();
    expect(screen.queryByText(/\bRaw\b/)).not.toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /View sale on eBay/ })[0]).toHaveAttribute('href', expect.stringMatching(/ebay\.com\/itm/));
    expect(screen.getAllByRole('img')).toHaveLength(2);
    expect(screen.getByText(/Buy It Now sales are excluded/)).toBeInTheDocument();
  });

  it('shows a normal no-match state for a successful search with zero sales', () => {
    render(<RecentAuctionSales results={{ searchParams: { searchQuery: 'zzqx' }, sales: [] }} />);

    expect(screen.getByText(/No completed auction sales matched this search/)).toBeInTheDocument();
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
  });
});
