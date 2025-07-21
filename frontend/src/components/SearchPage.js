import React, { useState, useEffect, useRef } from 'react';
import config from '../config';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';
import SavedSearches from './SavedSearches';
import { Helmet } from 'react-helmet';

// FeaturedEbayListing component
const FeaturedEbayListing = () => {
  const [listings, setListings] = useState([]);
  const [current, setCurrent] = useState(0);
  const intervalRef = useRef();

  useEffect(() => {
    const fetchListings = async () => {
      try {
        const res = await fetch('/api/ebay-active-listings');
        const data = await res.json();
        setListings(data.items || []);
      } catch (err) {
        setListings([]);
      }
    };
    fetchListings();
  }, []);

  useEffect(() => {
    if (listings.length === 0) return;
    intervalRef.current = setInterval(() => {
      setCurrent((prev) => (prev + 1) % listings.length);
    }, 5000);
    return () => clearInterval(intervalRef.current);
  }, [listings]);

  if (listings.length === 0) return null;
  const item = listings[current];
  return (
    <div style={{
      background: '#000',
      color: '#ffd700',
      border: '2px solid #ffd700',
      borderRadius: 12,
      padding: '1.5rem',
      margin: '2rem auto 1.5rem auto',
      maxWidth: 500,
      display: 'flex',
      alignItems: 'center',
      gap: '1.5rem',
      boxShadow: '0 4px 24px rgba(0,0,0,0.12)'
    }}>
      {item.image && (
        <img src={item.image.imageUrl || item.image} alt={item.title} style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 8, border: '2px solid #ffd700', background: '#fff' }} />
      )}
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: 6 }}>{item.title}</div>
        <div style={{ fontSize: '1.05rem', color: '#fff', marginBottom: 8 }}>
          {item.price && item.price.value ? `$${Number(item.price.value).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : ''}
        </div>
        <a href={item.itemWebUrl} target="_blank" rel="noopener noreferrer" style={{ background: '#ffd700', color: '#000', fontWeight: 700, padding: '0.5rem 1.2rem', borderRadius: 6, textDecoration: 'none', border: '2px solid #000', fontSize: '1rem' }}>
          View on eBay
        </a>
      </div>
    </div>
  );
};

const SearchPage = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [playerName, setPlayerName] = useState('');
  const [cardSet, setCardSet] = useState('');
  const [year, setYear] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardType, setCardType] = useState('');
  const [exclude, setExclude] = useState('');
  const [lastSavedQuery, setLastSavedQuery] = useState('');
  const [liveListings, setLiveListings] = useState({}); // { sectionKey: { loading, items, error, open } }
  // Store saved searches in state for duplicate check
  const [savedSearches, setSavedSearches] = useState([]);
  // Add a refetch trigger for SavedSearches
  const [savedSearchesRefetch, setSavedSearchesRefetch] = useState(0);
  const chartRef = useRef(null);
  const [liveListingsReloadKey, setLiveListingsReloadKey] = useState(0);
  // Control open/closed state of SavedSearches (use a counter to always trigger folding)
  const [savedSearchesOpen, setSavedSearchesOpen] = useState(0);
  const [lastSearchQuery, setLastSearchQuery] = useState('');
  // Add state for expanded card sections
  const [expandedSections, setExpandedSections] = useState({});

  // Fetch saved searches on mount (for duplicate prevention)
  useEffect(() => {
    const fetchSaved = async () => {
      const token = localStorage.getItem('authToken');
      if (!token) return;
      try {
        const res = await fetch('/api/search-history', {
          headers: { 'Authorization': `Bearer ${token}` },
          cache: 'no-store'
        });
        let text, data;
        try {
          text = await res.text();
          data = JSON.parse(text);
        } catch {
          return;
        }
        if (data.success) setSavedSearches(data.searches || []);
      } catch {}
    };
    fetchSaved();
  }, [isLoggedIn]);

  // Check if user is logged in on component mount
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (token) {
      try {
        // Decode JWT token to get user info
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUser(payload);
        setIsLoggedIn(true);
      } catch (error) {
        console.error('Invalid token:', error);
        localStorage.removeItem('authToken');
      }
    }
    // Check for reuseSearchQuery
    const reuse = localStorage.getItem('reuseSearchQuery');
    if (reuse) {
      setSearchQuery(reuse);
      setTimeout(() => {
        document.getElementById('searchQuery')?.focus();
        document.getElementById('searchQuery')?.blur();
      }, 100);
      setTimeout(() => {
        document.getElementById('search-form')?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      }, 200);
      localStorage.removeItem('reuseSearchQuery');
    }
  }, []);

  const handleSearch = async (e) => {
    e.preventDefault();
    // If Advanced Search is filled, use only that
    let combinedQuery = '';
    if (searchQuery) {
      combinedQuery = searchQuery.trim();
    } else {
      if (playerName) combinedQuery += playerName + ' ';
      if (cardSet) combinedQuery += cardSet + ' ';
      if (year) combinedQuery += year + ' ';
      if (cardNumber) combinedQuery += cardNumber + ' ';
      if (cardType) combinedQuery += cardType + ' ';
      if (exclude) combinedQuery += `-(${exclude})`;
      combinedQuery = combinedQuery.trim();
    }
    if (!combinedQuery) return;

    setIsLoading(true);
    setError(null);
    setResults(null);
    setLastSearchQuery(combinedQuery); // Store the latest search query

    try {
      const response = await fetch(config.getSearchCardsUrl(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          searchQuery: combinedQuery,
          numSales: 25
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setResults(data);

      // Only save if logged in, not a duplicate, and at least one card is found
      if (isLoggedIn && combinedQuery !== lastSavedQuery) {
        // Check for duplicate
        const alreadySaved = savedSearches.some(s => (s.query || s.searchQuery) === combinedQuery);
        if (alreadySaved) {
          setLastSavedQuery(combinedQuery);
          setIsLoading(false);
          return;
        }
        // Check if at least one card is found in any category
        const resultsObj = data.results || {};
        const hasCards = [
          ...(resultsObj.raw || []),
          ...(resultsObj.psa7 || []),
          ...(resultsObj.psa8 || []),
          ...(resultsObj.psa9 || []),
          ...(resultsObj.psa10 || []),
          ...(resultsObj.cgc9 || []),
          ...(resultsObj.cgc10 || []),
          ...(resultsObj.tag8 || []),
          ...(resultsObj.tag9 || []),
          ...(resultsObj.tag10 || []),
          ...(resultsObj.sgc10 || []),
          ...(resultsObj.aigrade9 || []),
          ...(resultsObj.aigrade10 || []),
          ...(resultsObj.otherGraded || [])
        ].length > 0;
        if (hasCards) {
          try {
            const saveRes = await fetch(config.getSearchHistoryUrl(), {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${localStorage.getItem('authToken')}`
              },
              body: JSON.stringify({
                searchQuery: combinedQuery,
                results: data.results,
                priceAnalysis: data.priceAnalysis
              })
            });
            setLastSavedQuery(combinedQuery);
            setSavedSearchesRefetch(x => x + 1); // force reload
            console.log('Triggered saved searches refetch after save');
          } catch (historyError) {
            console.error('Failed to save search history:', historyError);
            // Don't show error to user for history saving
          }
        }
      }
      // Scroll to chart after search
      setTimeout(() => {
        if (chartRef.current) {
          chartRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 300);
      // Reload live listings after search
      setLiveListingsReloadKey(x => x + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = () => {
    // Redirect to Google OAuth
    window.location.href = `${config.API_BASE_URL}/api/auth/google`;
  };

  const formatPrice = (price) => {
    if (price == null || price.value == null || isNaN(price.value)) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency: price.currency || 'USD'
    }).format(Number(price.value));
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }) + ' ' + date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  // Helper to generate a unique key for live listings per section and query
  const getLiveKey = (sectionKey, query) => `${sectionKey}_${query}`;

  const fetchLiveListings = async (sectionKey, query, grade) => {
    const liveKey = getLiveKey(sectionKey, query);
    setLiveListings(prev => ({
      ...prev,
      [liveKey]: { ...prev[liveKey], loading: true, error: null, open: true }
    }));
    try {
      const url = `${config.API_BASE_URL}/api/live-listings?query=${encodeURIComponent(query)}&grade=${encodeURIComponent(grade)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch live listings');
      const data = await res.json();
      setLiveListings(prev => ({
        ...prev,
        [liveKey]: { loading: false, items: data.items || [], error: null, open: true }
      }));
    } catch (err) {
      setLiveListings(prev => ({
        ...prev,
        [liveKey]: { loading: false, items: [], error: err.message, open: true }
      }));
    }
  };

  const toggleLiveListings = (sectionKey, query, grade) => {
    const liveKey = getLiveKey(sectionKey, query);
    if (liveListings[liveKey]?.open) {
      setLiveListings(prev => ({ ...prev, [liveKey]: { ...prev[liveKey], open: false } }));
    } else {
      if (!liveListings[liveKey] || !liveListings[liveKey].items) {
        fetchLiveListings(sectionKey, query, grade);
      } else {
        setLiveListings(prev => ({ ...prev, [liveKey]: { ...prev[liveKey], open: true } }));
      }
    }
  };

  // Helper to filter raw cards
  const filterRawCards = (cards) => {
    if (!Array.isArray(cards)) return [];
    return cards.filter(card => {
      const title = (card.title || '').toLowerCase();
      // Exclude if title contains grading company and grade in any order
      const isGraded = /(psa|bgs|sgc|cgc|tag|gm|gem|mint)[\s:\-\(]*((9\.5)|10|9|8|7)|((9\.5|10|9|8|7)[\s:\-\)]*(psa|bgs|sgc|cgc|tag|gm|gem|mint))/i.test(card.title || '');
      // Exclude if price is missing or not a number
      const priceValue = Number(card.price?.value);
      const validPrice = !isNaN(priceValue) && priceValue > 0;
      return !isGraded && validPrice;
    });
  };

  // Helper to calculate price analysis for a set of cards
  const getPriceStats = (cards) => {
    const prices = cards
      .map(card => Number(card.price?.value))
      .filter(v => !isNaN(v) && v > 0);
    if (!prices.length) return { min: null, max: null, avg: null };
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
    return { min, max, avg };
  };

  // Reload all open live listings sections when liveListingsReloadKey changes
  useEffect(() => {
    Object.keys(liveListings).forEach(liveKey => {
      const entry = liveListings[liveKey];
      if (entry?.open) {
        // Parse sectionKey and query from liveKey
        const [sectionKey, ...queryParts] = liveKey.split('_');
        const query = queryParts.join('_');
        fetchLiveListings(sectionKey, query, entry.grade || 'Raw');
      }
    });
    // eslint-disable-next-line
  }, [liveListingsReloadKey]);

  // Pass liveListingsReloadKey to renderCardSection to force re-render if needed (no hook inside)
  const renderCardSection = (title, cards, icon) => {
    if (!cards || cards.length === 0) return null;
    // Section key for live listings state
    const sectionKey = title.replace(/\s+\(.+\)/, '').replace(/\s/g, '').toLowerCase();
    // Grade for live listings
    let grade = 'Raw';
    if (title.includes('PSA 9')) grade = 'PSA 9';
    else if (title.includes('PSA 10')) grade = 'PSA 10';
    // Use the last valid search query for live listings
    const query = lastSearchQuery || (results?.searchParams?.searchQuery ?? '');
    const liveKey = getLiveKey(sectionKey, query);
    // Logging for debugging
    console.log(`[LiveListings] Section: ${sectionKey}, Title: ${title}`);
    console.log(`[LiveListings] lastSearchQuery:`, lastSearchQuery);
    console.log(`[LiveListings] results?.searchParams?.searchQuery:`, results?.searchParams?.searchQuery);
    console.log(`[LiveListings] Final query used:`, query);
    console.log(`[LiveListings] Grade:`, grade);
    if (!query || query.trim() === '' || query === 'undefined') {
      console.warn(`[LiveListings] Query is invalid or empty for section: ${sectionKey}`);
    }
    // Filter raw cards if this is the Raw section
    let displayCards = cards;
    if (title.toLowerCase().includes('raw')) {
      displayCards = filterRawCards(cards);
    }

    // Pagination logic
    const isExpanded = expandedSections[sectionKey];
    const visibleCards = isExpanded ? displayCards : displayCards.slice(0, 25);

    return (
      <div className="card-section">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <h3 style={{ margin: 0 }}>{icon} {title} ({cards.length})</h3>
          <button
            className="live-listings-btn"
            style={{ fontSize: '0.95em', padding: '0.3em 0.8em', background: '#ffd700', color: '#000', border: '1px solid #aaa', borderRadius: 5, textDecoration: 'none', marginLeft: 8, cursor: 'pointer' }}
            onClick={() => {
              console.log(`[LiveListings] Button clicked for section: ${sectionKey}, query: '${query}', grade: '${grade}'`);
              if (!query || query.trim() === '' || query === 'undefined') {
                console.warn(`[LiveListings] Prevented fetch: Query is invalid or empty for section: ${sectionKey}`);
                return;
              }
              toggleLiveListings(sectionKey, query, grade);
            }}
            disabled={!query || query.trim() === '' || query === 'undefined'}
          >
            {liveListings[liveKey]?.open ? 'Hide Live Listings' : 'View Live Listings'}
          </button>
        </div>
        {liveListings[liveKey]?.open && (
          <div className="live-listings-section" style={{ margin: '1rem 0', background: '#fff', borderRadius: 10, border: '1.5px solid #ffd700', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', padding: '1rem' }}>
            {liveListings[liveKey]?.loading && <div>Loading live listings...</div>}
            {liveListings[liveKey]?.error && <div style={{ color: 'red' }}>{liveListings[liveKey].error}</div>}
            {liveListings[liveKey]?.items && liveListings[liveKey].items.length > 0 && (
              <div className="live-listings-grid" style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                {liveListings[liveKey].items.map((item, idx) => (
                  <div key={item.itemId || idx} className="live-listing-card" style={{ 
                    background: '#fff', 
                    border: '1px solid #e1e3e6', 
                    borderRadius: 8, 
                    padding: '1rem', 
                    display: 'flex', 
                    flexDirection: 'row', 
                    alignItems: 'flex-start',
                    gap: '1rem',
                    minHeight: '120px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                  }}>
                    {/* Image on the left */}
                    <div className="live-listing-image" style={{ flexShrink: 0 }}>
                      {item.image && (
                        <img 
                          src={item.image.imageUrl || item.image} 
                          alt={item.title} 
                          style={{ 
                            width: '120px', 
                            height: '120px', 
                            objectFit: 'cover', 
                            borderRadius: 6,
                            border: '1px solid #e1e3e6'
                          }} 
                        />
                      )}
                    </div>
                    
                    {/* Details on the right */}
                    <div className="live-listing-details" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <a 
                        href={item.itemWebUrl} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="live-listing-title" 
                        style={{ 
                          fontWeight: 600, 
                          color: '#0066cc', 
                          fontSize: '1.1em', 
                          textDecoration: 'none',
                          lineHeight: '1.3',
                          marginBottom: '0.3rem'
                        }}
                      >
                        {item.title}
                      </a>
                      
                      <div className="live-listing-price" style={{ 
                        fontSize: '1.3em', 
                        fontWeight: 700, 
                        color: '#000',
                        marginBottom: '0.3rem'
                      }}>
                        {formatPrice({ value: item.price?.value })}
                      </div>
                      
                      <div className="live-listing-meta" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', fontSize: '0.9em', color: '#666' }}>
                        {item.condition && (
                          <span className="live-listing-condition">Condition: {item.condition}</span>
                        )}
                        {item.seller && (
                          <span className="live-listing-seller">Seller: {item.seller.username}</span>
                        )}
                      </div>
                      
                      <div className="live-listing-actions" style={{ marginTop: 'auto' }}>
                        <a 
                          href={item.itemWebUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          style={{ 
                            fontSize: '0.9em', 
                            padding: '0.4em 1em', 
                            background: '#ffd700', 
                            color: '#000', 
                            border: '1px solid #d4af37', 
                            borderRadius: 4, 
                            textDecoration: 'none',
                            fontWeight: 600,
                            display: 'inline-block'
                          }}
                        >
                          View on eBay
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {liveListings[liveKey]?.items && liveListings[liveKey].items.length === 0 && !liveListings[liveKey]?.loading && <div>No live listings found.</div>}
          </div>
        )}
        <div className="cards-grid" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.7rem' }}>
          {visibleCards.map((card, index) => {
            // Skip cards with invalid price
            const priceValue = Number(card.price?.value);
            if (isNaN(priceValue) || priceValue <= 0) return null;
            return (
              <div key={`${card.id || index}-${card.title}`} className="card-item" style={{ background: '#fff', border: '1px solid #eee', borderRadius: 7, boxShadow: '0 1px 4px rgba(0,0,0,0.03)', padding: '0.6rem 0.7rem', minWidth: 170, maxWidth: 210, fontSize: '0.97em', marginBottom: 0 }}>
                <div className="card-details" style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  <div className="card-title" style={{ fontWeight: 600, fontSize: '1em', marginBottom: 2 }}>{card.title}</div>
                  {/* Always show listed price if present, directly below title */}
                  {card.listPrice && (
                    <div className="card-list-price" style={{ fontSize: '0.93em', color: '#b00', textDecoration: 'line-through', fontWeight: 500 }}>
                      ${Number(card.listPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  )}
                  {/* Sold price */}
                  <div className="card-price" style={{ fontSize: '0.98em', color: '#222' }}>{formatPrice(card.price)}</div>
                  {/* Sale type (auction/fixed/etc.) */}
                  {card.saleType && (
                    <div className="card-sale-type" style={{ fontSize: '0.85em', color: '#28a745', fontWeight: 600, backgroundColor: '#d4edda', padding: '1px 4px', borderRadius: 3, border: '1px solid #c3e6cb', alignSelf: 'flex-start' }}>{card.saleType}</div>
                  )}
                  {/* Bid count below sale type, above sold date/time */}
                  {card.numBids && (
                    <div className="card-bids" style={{ fontSize: '0.85em', color: '#856404', backgroundColor: '#fff3cd', padding: '1px 4px', borderRadius: 3, border: '1px solid #ffeaa7', alignSelf: 'flex-start' }}>Bids: {card.numBids}</div>
                  )}
                  <div className="card-date" style={{ fontSize: '0.93em', color: '#888' }}>Sold: {formatDate(card.soldDate)}</div>
                  {card.seller && card.seller !== '130point' && (
                    <div className="card-seller" style={{ fontSize: '0.85em', color: '#666' }}>Via: {card.seller}</div>
                  )}
                  {card.itemWebUrl && (
                    <a 
                      href={card.itemWebUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="live-listings-btn"
                      style={{ fontSize: '0.89em', padding: '0.18em 0.6em', background: '#ffd700', color: '#000', border: '1px solid #aaa', borderRadius: 5, textDecoration: 'none', marginTop: 2, alignSelf: 'flex-start' }}
                    >
                      View on eBay
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {displayCards.length > 25 && (
          <button
            style={{ marginTop: 10, background: '#ffd700', color: '#000', border: '1.5px solid #000', borderRadius: 5, padding: '0.5rem 1.2rem', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer' }}
            onClick={() => setExpandedSections(prev => ({ ...prev, [sectionKey]: !isExpanded }))}
          >
            {isExpanded ? 'Show Less' : `See More (${displayCards.length - 25} more)`}
          </button>
        )}
      </div>
    );
  };

  // Restore original renderPriceAnalysis
  const renderPriceAnalysis = (analysis) => {
    if (!analysis) return null;
    // Use filtered/displayed cards for stats
    const rawCards = filterRawCards(results?.results?.raw || []);
    const psa9Cards = (results?.results?.psa9 || []).filter(card => !isNaN(Number(card.price?.value)) && Number(card.price?.value) > 0);
    const psa10Cards = (results?.results?.psa10 || []).filter(card => !isNaN(Number(card.price?.value)) && Number(card.price?.value) > 0);
    const rawStats = getPriceStats(rawCards);
    const psa9Stats = getPriceStats(psa9Cards);
    const psa10Stats = getPriceStats(psa10Cards);
    const tiles = [
      { key: 'raw', label: 'Raw Cards', stats: rawStats },
      { key: 'psa9', label: 'PSA 9', stats: psa9Stats },
      { key: 'psa10', label: 'PSA 10', stats: psa10Stats }
    ];
    // Comparison tiles
    const comparisons = analysis.comparisons || {};
    const comparisonTiles = [
      { key: 'rawToPsa9', label: 'Raw → PSA 9', data: comparisons.rawToPsa9 },
      { key: 'rawToPsa10', label: 'Raw → PSA 10', data: comparisons.rawToPsa10 },
      { key: 'psa9ToPsa10', label: 'PSA 9 → PSA 10', data: comparisons.psa9ToPsa10 }
    ];
    // Investment insight
    let insight = '';
    if (analysis.psa10 && analysis.psa10.trend === 'up') {
      insight = 'PSA 10 prices are trending up!';
    } else if (analysis.psa9 && analysis.psa9.trend === 'up') {
      insight = 'PSA 9 prices are trending up!';
    } else if (analysis.raw && analysis.raw.trend === 'up') {
      insight = 'Raw card prices are trending up!';
    } else {
      insight = 'No strong upward trends detected.';
    }
    // Build the 3x2 grid: [raw, psa9, psa10, rawToPsa9, rawToPsa10, psa9ToPsa10]
    const gridTiles = [
      ...tiles.map(({ key, label, stats }) => {
        if (!stats || stats.min == null) return null;
        return (
          <div key={key} className="analysis-item" style={{ background: '#fffbe6', border: '1.5px solid #ffd700', borderRadius: '8px', padding: '0.75rem 1.1rem', minWidth: 120, fontSize: '0.95rem', boxShadow: '0 1px 4px rgba(0,0,0,0.03)' }}>
            <h4 style={{ color: '#000', marginBottom: 4, fontSize: '1.05rem' }}>{label}</h4>
            <p style={{ margin: 0 }}>Avg: <strong>{formatPrice({ value: stats.avg })}</strong></p>
            <p style={{ margin: 0, fontSize: '0.93em' }}>Range: {formatPrice({ value: stats.min })} - {formatPrice({ value: stats.max })}</p>
          </div>
        );
      }),
      ...comparisonTiles.map(({ key, label, data }) => data && (
        <div key={key} className="analysis-item" style={{ background: '#e6f7ff', border: '1.5px solid #1890ff', borderRadius: '8px', padding: '0.75rem 1.1rem', minWidth: 120, fontSize: '0.95rem', boxShadow: '0 1px 4px rgba(0,0,0,0.03)' }}>
          <h4 style={{ color: '#0050b3', marginBottom: 4, fontSize: '1.05rem' }}>{label}</h4>
          <p style={{ margin: 0 }}>{data.description}</p>
        </div>
      ))
    ];
    return (
      <div className="price-analysis">
        <h3 style={{ color: '#fff', fontWeight: 800, textShadow: '1px 1px 6px #000' }}>📊 Price Analysis</h3>
        <div className="analysis-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
          {gridTiles}
        </div>
      </div>
    );
  };

  // New Investment Insight section (tile + breakdown)
  const renderInvestmentInsight = (analysis) => {
    if (!analysis) return null;
    // Stats for Raw, PSA 9, PSA 10
    const rawCards = filterRawCards(results?.results?.raw || []);
    const psa9Cards = (results?.results?.psa9 || []).filter(card => !isNaN(Number(card.price?.value)) && Number(card.price?.value) > 0);
    const psa10Cards = (results?.results?.psa10 || []).filter(card => !isNaN(Number(card.price?.value)) && Number(card.price?.value) > 0);
    const rawStats = getPriceStats(rawCards);
    const psa9Stats = getPriceStats(psa9Cards);
    const psa10Stats = getPriceStats(psa10Cards);
    // Insight tile content
    let insight = '';
    if (analysis.psa10 && analysis.psa10.trend === 'up') {
      insight = 'PSA 10 prices are trending up!';
    } else if (analysis.psa9 && analysis.psa9.trend === 'up') {
      insight = 'PSA 9 prices are trending up!';
    } else if (analysis.raw && analysis.raw.trend === 'up') {
      insight = 'Raw card prices are trending up!';
    } else {
      insight = 'No strong upward trends detected.';
    }
    // Other graded breakdown (not PSA)
    const gradingCompanyList = [
      'bgs', 'sgc', 'cgc', 'beckett', 'ace', 'cga', 'gma', 'hga', 'pgs', 'bvg', 'csg', 'rcg', 'ksa', 'fgs', 'tag', 'pgm', 'dga', 'isa'
    ];
    const normalizeCompany = (name) => {
      if (!name) return '';
      name = name.toLowerCase();
      if (name === 'beckett') return 'bgs';
      return name;
    };
    const allCards = Object.entries(results?.results || {})
      .filter(([key]) => key !== 'raw')
      .flatMap(([, arr]) => arr);
    const companyGradeMap = {};
    allCards.forEach(card => {
      const title = (card.title || '').toLowerCase();
      let foundCompany = null;
      for (let company of gradingCompanyList) {
        if (title.includes(company)) {
          foundCompany = normalizeCompany(company);
          break;
        }
      }
      if (!foundCompany) return;
      const gradeMatch = title.match(/(\d{1,2}(?:\.5)?)/);
      const grade = gradeMatch ? gradeMatch[1] : 'Unknown';
      if (!companyGradeMap[foundCompany]) companyGradeMap[foundCompany] = {};
      if (!companyGradeMap[foundCompany][grade]) companyGradeMap[foundCompany][grade] = [];
      companyGradeMap[foundCompany][grade].push(card);
    });
    return (
      <div className="investment-insight-section" style={{ marginBottom: '2rem' }}>
        <h3 style={{ color: '#000', fontWeight: 800, marginBottom: '1rem', fontSize: '1.4rem' }}>Investment Insight</h3>
        <div className="insight-tile" style={{ background: '#fffbe6', border: '1.5px solid #ffd700', borderRadius: 8, padding: '1.2rem 1.5rem', marginBottom: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.03)' }}>
          <h4 style={{ color: '#000', marginBottom: 8, fontSize: '1.1rem' }}>Raw, PSA 9, PSA 10</h4>
          <div style={{ display: 'flex', gap: '2.5rem', flexWrap: 'wrap' }}>
            <div>
              <strong>Raw</strong><br />
              Avg: {formatPrice({ value: rawStats.avg })}<br />
              Range: {formatPrice({ value: rawStats.min })} - {formatPrice({ value: rawStats.max })}
            </div>
            <div>
              <strong>PSA 9</strong><br />
              Avg: {formatPrice({ value: psa9Stats.avg })}<br />
              Range: {formatPrice({ value: psa9Stats.min })} - {formatPrice({ value: psa9Stats.max })}
            </div>
            <div>
              <strong>PSA 10</strong><br />
              Avg: {formatPrice({ value: psa10Stats.avg })}<br />
              Range: {formatPrice({ value: psa10Stats.min })} - {formatPrice({ value: psa10Stats.max })}
            </div>
          </div>
          <div style={{ marginTop: 12, color: '#333', fontWeight: 600 }}>{insight}</div>
        </div>
        <div className="other-graded-breakdown" style={{ background: '#f7f7f7', border: '1.5px solid #ccc', borderRadius: 8, padding: '1.2rem 1.5rem' }}>
          <h4 style={{ color: '#000', marginBottom: 8, fontSize: '1.1rem' }}>Other Graded Cards</h4>
          {gradingCompanyList.map(companyKey => {
            const grades = companyGradeMap[normalizeCompany(companyKey)] || {};
            if (Object.keys(grades).length === 0) return null;
            // Special handling for BGS
            if (normalizeCompany(companyKey) === 'bgs') {
              const bgsGrades = ['10', '9.5', '9'];
              return (
                <div style={{ marginBottom: '0.5rem' }} key={companyKey}>
                  <strong>{companyKey.toUpperCase()}</strong>
                  {bgsGrades.map(grade => {
                    const cards = grades[grade] || [];
                    const stats = getPriceStats(cards);
                    return (
                      <div key={`${companyKey}-${grade}`} style={{ marginLeft: 10, fontSize: '0.93em' }}>
                        {grade}: {cards.length} sold, avg {formatPrice({ value: stats.avg })} (range: {formatPrice({ value: stats.min })} - {formatPrice({ value: stats.max })})
                      </div>
                    );
                  })}
                  {/* Show any other BGS grades not 10, 9.5, 9 */}
                  {Object.keys(grades).filter(g => !bgsGrades.includes(g)).map(grade => {
                    const cards = grades[grade];
                    const stats = getPriceStats(cards);
                    return (
                      <div key={`${companyKey}-${grade}`} style={{ marginLeft: 10, fontSize: '0.93em' }}>
                        {grade}: {cards.length} sold, avg {formatPrice({ value: stats.avg })} (range: {formatPrice({ value: stats.min })} - {formatPrice({ value: stats.max })})
                      </div>
                    );
                  })}
                </div>
              );
            }
            // Default for other companies
            return (
              <div style={{ marginBottom: '0.5rem' }} key={companyKey}>
                <strong>{companyKey.toUpperCase()}</strong>
                {Object.keys(grades).sort((a, b) => parseFloat(a) - parseFloat(b)).map(grade => {
                  const cards = grades[grade];
                  const stats = getPriceStats(cards);
                  return (
                    <div key={`${companyKey}-${grade}`} style={{ marginLeft: 10, fontSize: '0.93em' }}>
                      {grade}: {cards.length} sold, avg {formatPrice({ value: stats.avg })} (range: {formatPrice({ value: stats.min })} - {formatPrice({ value: stats.max })})
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Handler for reusing a saved search
  const handleReuseSavedSearch = (search) => {
    setSearchQuery(search.query || search.searchQuery);
    setTimeout(() => {
      document.getElementById('searchQuery')?.focus();
      document.getElementById('searchQuery')?.blur();
    }, 100);
    setTimeout(() => {
      document.getElementById('search-form')?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      setTimeout(() => {
        if (chartRef.current) {
          chartRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        setSavedSearchesOpen(x => x + 1); // always trigger fold up
        setLiveListingsReloadKey(x => x + 1); // reload live listings
      }, 400);
    }, 200);
  };

  // Add this function to clear all search fields
  const handleClear = () => {
    setPlayerName('');
    setCardSet('');
    setYear('');
    setCardNumber('');
    setCardType('');
    setExclude('');
    setSearchQuery('');
  };

  return (
    <div className="App">
      <Helmet>
        <link rel="canonical" href="https://www.mancavesportscardsllc.com/search" />
      </Helmet>
      <FeaturedEbayListing />
      {/* Main Content */}
      <main className="App-main">
        {/* Store Info Section */}
        <div className="store-info" style={{ margin: '2rem 0', textAlign: 'center', background: '#fffbe6', borderRadius: '8px', padding: '1.5rem', border: '1px solid #ffd700' }}>
          <h2 style={{ color: '#000' }}>Welcome to Mancave Sports Cards LLC!</h2>
          <p style={{ color: '#333', fontSize: '1.1rem', margin: '0.5rem 0 0.5rem 0' }}>
            Your destination for all things trading cards—specializing in sports cards and Pokémon! We offer a diverse range of high-quality cards for collectors of all levels.
          </p>
          <p style={{ color: '#333', fontSize: '1.1rem', margin: '0.5rem 0' }}>
            <strong>Fast shipping</strong> on every order and <strong>new items added weekly</strong>—check back often for the latest deals!
          </p>
          <a
            href="https://www.ebay.com/usr/mancavesportscardsllc24?mkcid=1&mkrid=711-53200-19255-0&siteid=0&campid=5339115973&customid=&toolid=10001&mkevt=1"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-block',
              background: '#ffd700',
              color: '#000',
              fontWeight: 'bold',
              padding: '0.75rem 2rem',
              borderRadius: '6px',
              textDecoration: 'none',
              border: '2px solid #000',
              marginTop: '0.5rem'
            }}
          >
            Visit Our eBay Store
          </a>
        </div>
        {/* Search Form */}
        <form id="search-form" onSubmit={handleSearch} className="search-form">
          <div className="form-group">
            <label htmlFor="playerName">Player Name:</label>
            <input
              type="text"
              id="playerName"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="e.g., Mike Trout"
            />
          </div>
          <div className="form-group">
            <label htmlFor="cardSet">Card Set:</label>
            <input
              type="text"
              id="cardSet"
              value={cardSet}
              onChange={(e) => setCardSet(e.target.value)}
              placeholder="e.g., Topps Chrome"
            />
          </div>
          <div className="form-group">
            <label htmlFor="year">Year:</label>
            <input
              type="text"
              id="year"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder="e.g., 2011"
            />
          </div>
          <div className="form-group">
            <label htmlFor="cardNumber">Card Number:</label>
            <input
              type="text"
              id="cardNumber"
              value={cardNumber}
              onChange={(e) => setCardNumber(e.target.value)}
              placeholder="e.g., 175"
            />
          </div>
          <div className="form-group">
            <label htmlFor="cardType">Card Type:</label>
            <input
              type="text"
              id="cardType"
              value={cardType}
              onChange={(e) => setCardType(e.target.value)}
              placeholder="e.g., Base, Insert, Auto, Relic"
            />
          </div>
          <div className="form-group">
            <label htmlFor="exclude">Exclude (keywords):</label>
            <input
              type="text"
              id="exclude"
              value={exclude}
              onChange={(e) => setExclude(e.target.value)}
              placeholder="e.g., graded, PSA"
            />
          </div>
          <div className="form-group">
            <label htmlFor="searchQuery"><strong>Advanced Search</strong> (overrides all fields):</label>
            <input
              type="text"
              id="searchQuery"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="e.g., Mike Trout 2011 Topps Update Rookie"
            />
          </div>
          <div className="form-group" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button type="submit" disabled={isLoading} className="search-button">
              {isLoading ? '🔍 Searching...' : '🔍 Search Cards'}
            </button>
            <button
              type="button"
              onClick={handleClear}
              style={{
                background: '#000',
                color: '#ffd700',
                border: '2px solid #ffd700',
                borderRadius: 5,
                padding: '0.5rem 1.2rem',
                fontWeight: 'bold',
                fontSize: '1rem',
                marginLeft: '0.5rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              Clear
            </button>
          </div>
        </form>
        {/* Saved Searches below the form */}
        <div id="saved-searches-section">
          <SavedSearches onSearchAgain={handleReuseSavedSearch} refetchTrigger={savedSearchesRefetch} forceOpen={savedSearchesOpen} />
        </div>

        {/* Login Prompt for Non-Logged-In Users */}
        {!isLoggedIn && (
          <div className="login-prompt">
            <div className="login-prompt-content">
              <h3>🔐 Want to save your searches?</h3>
              <p>Create a free account to save your search history and track your favorite cards over time.</p>
              <button onClick={handleLogin} className="login-button">              Sign in with Google
              </button>
              <p className="login-note">You can still search and view results without an account!</p>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="error-message">
            <h3>❌ Error</h3>
            <p>{error}</p>
          </div>
        )}

        {/* Results Display */}
        {results && (
          <div className="search-results">
            <div className="results-header">
              <h2 style={{ color: '#fff', fontWeight: 800, textShadow: '1px 1px 6px #000' }}>📊 Search Results for "{results.searchParams.searchQuery}"</h2>
              <div className="results-summary" style={{ color: '#fff', fontWeight: 700, fontSize: '1.15rem', textShadow: '1px 1px 6px #000' }}>
                <p>Found {results.sources?.total || 0} total sold items</p>
                {!isLoggedIn && (
                  <p className="save-note">💡 <a href="#" onClick={handleLogin}>Sign in</a> to save this search</p>
                )}
              </div>
            </div>

            {/* Chart Placeholder for Last Sales - moved to top */}
            {results && results.results && (
              <div ref={chartRef} className="sales-chart" style={{ margin: '2rem auto 1.5rem auto', maxWidth: 700, background: '#fff', borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.04)', padding: '1.5rem', border: '1.5px solid #ffd700', textAlign: 'center' }}>
                <h3 style={{ color: '#000', marginBottom: 16 }}>Last Sales Chart</h3>
                {/* Prepare sales data for chart */}
                {(() => {
                  const raw = filterRawCards(results.results.raw || []).map(card => ({
                    date: new Date(card.soldDate).toLocaleDateString('en-US'),
                    Raw: card.price?.value || 0
                  }));
                  const psa9 = (results.results.psa9 || []).filter(card => !isNaN(Number(card.price?.value)) && Number(card.price?.value) > 0).map(card => ({
                    date: new Date(card.soldDate).toLocaleDateString('en-US'),
                    PSA9: card.price?.value || 0
                  }));
                  const psa10 = (results.results.psa10 || []).filter(card => !isNaN(Number(card.price?.value)) && Number(card.price?.value) > 0).map(card => ({
                    date: new Date(card.soldDate).toLocaleDateString('en-US'),
                    PSA10: card.price?.value || 0
                  }));
                  // Merge by date
                  const allDates = Array.from(new Set([...raw, ...psa9, ...psa10].map(d => d.date))).sort();
                  const salesData = allDates.map(date => ({
                    date,
                    Raw: raw.find(d => d.date === date)?.Raw || null,
                    PSA9: psa9.find(d => d.date === date)?.PSA9 || null,
                    PSA10: psa10.find(d => d.date === date)?.PSA10 || null
                  }));
                  return (
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={salesData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tick={{ fontSize: 12 }} angle={-30} textAnchor="end" height={60} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="Raw" stroke="#1976d2" strokeWidth={3} dot={false} name="Raw" connectNulls={true} />
                        <Line type="monotone" dataKey="PSA9" stroke="#43a047" strokeWidth={3} dot={false} name="PSA 9" connectNulls={true} />
                        <Line type="monotone" dataKey="PSA10" stroke="#ffd700" strokeWidth={4} dot={false} name="PSA 10" connectNulls={true} />
                      </LineChart>
                    </ResponsiveContainer>
                  );
                })()}
              </div>
            )}

            {/* Price Analysis */}
            {renderPriceAnalysis(results.priceAnalysis)}

            {/* Investment Insight */}
            {renderInvestmentInsight(results.priceAnalysis)}

            {/* Card Sections */}
            {renderCardSection('Raw Cards', results.results.raw, '📄')}
            {renderCardSection('PSA 9', results.results.psa9, '🏆')}
            {renderCardSection('PSA 10', results.results.psa10, '🏆')}
          </div>
        )}
      </main>
    </div>
  );
};

export default SearchPage; 