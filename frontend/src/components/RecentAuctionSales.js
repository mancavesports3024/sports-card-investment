import React from 'react';

const formatPrice = (price) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(price);

const formatDate = (value) => {
  if (!value) return 'Date not listed';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? 'Date not listed' : d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

const gradeLabel = (grade) => {
  if (!grade) return 'Grade not listed';
  return [grade.company, grade.value].filter(Boolean).join(' ') || 'Grade not listed';
};

const sourceLabel = (source) => (source === 'ebay' ? 'eBay' : source || 'Marketplace');

const RecentAuctionSales = ({ results }) => {
  const sales = [...(results.sales || [])].sort(
    (a, b) => (new Date(b.soldDate).getTime() || 0) - (new Date(a.soldDate).getTime() || 0)
  );
  const query = results.searchParams?.searchQuery || '';

  return (
    <section className="search-results recent-auction-sales" aria-live="polite">
      <div className="results-header">
        <h2 style={{ color: '#fff', fontWeight: 800, textShadow: '1px 1px 6px #000' }}>
          📊 Recent Auction Sales for "{query}"
        </h2>
        <div className="results-summary" style={{ color: '#fff', fontWeight: 700, textShadow: '1px 1px 6px #000' }}>
          {sales.length > 0 ? (
            <p>Found {sales.length} completed auction {sales.length === 1 ? 'sale' : 'sales'} from the last 90 days</p>
          ) : (
            <p>No completed auction sales matched this search in the last 90 days. Try fewer or different words.</p>
          )}
          <p style={{ fontWeight: 400, fontSize: '0.9rem' }}>
            Auction results only. Buy It Now sales are excluded because the data source cannot confirm which Buy It Now prices were completed sales.
          </p>
        </div>
      </div>

      {sales.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, margin: '1rem auto', maxWidth: 900 }}>
          {sales.map((sale, i) => (
            <li
              key={`${sale.url || sale.title}-${i}`}
              style={{ display: 'flex', gap: 16, alignItems: 'flex-start', background: '#fff', borderRadius: 8, padding: '0.9rem 1rem', marginBottom: 10, border: '1px solid #ffd700' }}
            >
              {sale.imageUrl ? (
                <img src={sale.imageUrl} alt={sale.title || 'Card sale'} loading="lazy" style={{ width: 90, height: 'auto', borderRadius: 4, flexShrink: 0 }} />
              ) : (
                <div style={{ width: 90, flexShrink: 0, color: '#666', fontSize: '0.8rem' }}>No image</div>
              )}
              <div style={{ flex: 1, color: '#111', textAlign: 'left' }}>
                <div style={{ fontWeight: 700 }}>{sale.title || 'Untitled listing'}</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, margin: '0.25rem 0' }}>{formatPrice(sale.price)}</div>
                <div style={{ fontSize: '0.9rem', color: '#333' }}>
                  Sold {formatDate(sale.soldDate)} · {gradeLabel(sale.grade)} · Auction on {sourceLabel(sale.source)}
                </div>
                {sale.url ? (
                  <a href={sale.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.9rem' }}>
                    View sale on {sourceLabel(sale.source)}
                  </a>
                ) : (
                  <span style={{ fontSize: '0.9rem', color: '#666' }}>Listing link not available</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default RecentAuctionSales;
