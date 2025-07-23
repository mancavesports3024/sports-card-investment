import React, { useState, useEffect, useRef } from 'react';
import config from '../config';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';
import SavedSearches from './SavedSearches';
import { Helmet } from 'react-helmet';
import { InContentAd, SearchResultsAd } from './AdSense';

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
  // Add refs for live listings sections
  const rawLiveRef = useRef(null);
  const psa9LiveRef = useRef(null);
  const psa10LiveRef = useRef(null);

  // Fetch saved searches on mount (for duplicate prevention)
  useEffect(() => {
    const fetchSaved = async () => {
      const token = localStorage.getItem('authToken');
      if (!token) return;
      try {
        const res = await fetch(config.getSearchHistoryUrl(), {
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

  const fetchLiveListings = async (sectionKey, query, grade, forceRefresh = false) => {
    const liveKey = getLiveKey(sectionKey, query);
    setLiveListings(prev => ({
      ...prev,
      [liveKey]: { ...prev[liveKey], loading: true, error: null, open: true }
    }));
    try {
      const url = `${config.API_BASE_URL}/api/live-listings?query=${encodeURIComponent(query)}&grade=${encodeURIComponent(grade)}${forceRefresh ? '&forceRefresh=true' : ''}`;
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
      // Always fetch fresh data when opening live listings
      fetchLiveListings(sectionKey, query, grade, true);
    }
  };

  // Helper to filter raw cards
  const filterRawCards = (cards) => {
    if (!Array.isArray(cards)) return [];
    // Only filter to valid, non-graded cards (no outlier filtering, now handled in backend)
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

  // Helper to check if a listing is new (listed in last 24 hours)
  function isNewListing(listingDate) {
    if (!listingDate) return false;
    return (Date.now() - new Date(listingDate).getTime()) < 24 * 60 * 60 * 1000;
  }
  // Helper to format the listing date as 'Jul-22 17:57'
  function formatListingDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  }

  // Reload all open live listings sections when liveListingsReloadKey changes
  useEffect(() => {
    Object.keys(liveListings).forEach(liveKey => {
      const entry = liveListings[liveKey];
      if (entry?.open) {
        // Parse sectionKey and query from liveKey
        const [sectionKey, ...queryParts] = liveKey.split('_');
        const query = queryParts.join('_');
        fetchLiveListings(sectionKey, query, entry.grade || 'Raw', true);
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
    let sectionRef = null;
    if (title.includes('PSA 9')) { grade = 'PSA 9'; sectionRef = psa9LiveRef; }
    else if (title.includes('PSA 10')) { grade = 'PSA 10'; sectionRef = psa10LiveRef; }
    else if (title.toLowerCase().includes('raw')) { sectionRef = rawLiveRef; }
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
      <div className="card-section" ref={sectionRef}>
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
          <div style={{ marginTop: 12, background: '#fff', borderRadius: 8, padding: '1.2rem 1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            {liveListings[liveKey].loading ? (
              <div>Loading live listings...</div>
            ) : liveListings[liveKey].error ? (
              <div style={{ color: 'red' }}>{liveListings[liveKey].error}</div>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {liveListings[liveKey].items
                  .slice()
                  .sort((a, b) => {
                    const dateA = a.listingDate ? new Date(a.listingDate).getTime() : 0;
                    const dateB = b.listingDate ? new Date(b.listingDate).getTime() : 0;
                    return dateB - dateA;
                  })
                  .map(item => (
                    <li key={item.itemId} style={{ borderBottom: '1px solid #eee', padding: '1.2rem 0', display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 24 }}>
                      {/* Column 1: Image */}
                      <div style={{ flexShrink: 0, width: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', height: 110 }}>
                        {(() => {
                          const imageUrl = typeof item.image === 'string'
                            ? item.image
                            : item.image?.imageUrl || null;
                          return imageUrl ? (
                            <img src={imageUrl} alt={item.title} style={{ width: 90, height: 90, objectFit: 'cover', borderRadius: 8, border: '1px solid #ccc', background: '#fafafa' }} />
                          ) : (
                            <div style={{ width: 90, height: 90, borderRadius: 8, border: '1px solid #ccc', background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa', fontSize: 12 }}>
                              No Image
                            </div>
                          );
                        })()}
                      </div>
                      {/* Column 2: All details */}
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0 }}>
                        {/* NEW LISTING badge */}
                        {isNewListing(item.listingDate) && <div style={{ color: '#555', background: '#f2f2f2', fontWeight: 600, fontSize: '0.85rem', padding: '2px 10px', borderRadius: 5, letterSpacing: 1, marginBottom: 6 }}>NEW LISTING</div>}
                        {/* Title */}
                        <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#222', marginBottom: 4 }}>{item.title}</div>
                        {/* Condition */}
                        <div style={{ color: '#666', fontSize: '0.95rem', marginBottom: 4 }}>{item.condition}</div>
                        {/* Star rating and product ratings link */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          {item.starRating && (
                            <span style={{ color: '#f5a623', fontWeight: 600, fontSize: '0.98rem' }}>★</span>
                          )}
                          {item.starRating && item.numRatings && (
                            <a href="#" style={{ color: '#0066c0', fontWeight: 500, fontSize: '0.92rem', textDecoration: 'underline', marginRight: 4 }} target="_blank" rel="noopener noreferrer">
                              {item.numRatings} product ratings
                            </a>
                          )}
                        </div>
                        {/* Price row: price left, date/seller/item ID right */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', width: '100%', margin: '4px 0 2px 0' }}>
                          <div style={{ fontSize: '1.25rem', color: '#111', fontWeight: 800, letterSpacing: '-0.5px', minWidth: 90 }}>
                            {item.price && item.price.value && `$${Number(item.price.value).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginLeft: 18, fontSize: '0.92rem', color: '#555', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 600 }}>{item.listingDate && formatListingDate(item.listingDate)}</span>
                            <span>{item.seller?.username} {item.seller?.feedbackPercentage && `${item.seller.feedbackPercentage}% positive`} {item.seller?.feedbackScore && `(${item.seller.feedbackScore})`}</span>
                            <span style={{ color: '#aaa', fontSize: '0.92rem' }}>Item: {item.itemId}</span>
                          </div>
                        </div>
                        {item.bids && <div style={{ color: '#222', fontWeight: 500, fontSize: '0.98rem', marginBottom: 2 }}>{item.bids} bids</div>}
                        {item.bestOffer && <div style={{ color: '#222', fontWeight: 600, fontSize: '1.02rem', marginBottom: 2 }}>or Best Offer</div>}
                        {/* Shipping and Location */}
                        <div style={{ color: '#444', fontSize: '0.98rem', marginBottom: 2 }}>{item.shipping}</div>
                        <div style={{ color: '#444', fontSize: '0.98rem', marginBottom: 2 }}>{item.location && `Located in ${item.location}`}</div>
                        {/* View on eBay button */}
                        <a href={item.itemWebUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'block', background: '#ffd700', color: '#000', fontWeight: 700, padding: '0.6rem 1.3rem', borderRadius: 7, textDecoration: 'none', border: '2px solid #000', fontSize: '1.02rem', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', maxWidth: 180, marginTop: 10 }}>View on eBay</a>
                      </div>
                    </li>
                  ))}
              </ul>
            )}
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
      { key: 'raw', label: 'Raw Cards', stats: rawStats, trend: analysis.raw?.trend, ref: rawLiveRef },
      { key: 'psa9', label: 'PSA 9', stats: psa9Stats, trend: analysis.psa9?.trend, ref: psa9LiveRef },
      { key: 'psa10', label: 'PSA 10', stats: psa10Stats, trend: analysis.psa10?.trend, ref: psa10LiveRef }
    ];
    // Build the 3x2 grid: [raw, psa9, psa10, rawToPsa9, rawToPsa10, psa9ToPsa10]
    const comparisons = analysis.comparisons || {};
    const comparisonTiles = [
      { key: 'rawToPsa9', label: 'Raw → PSA 9', data: comparisons.rawToPsa9 },
      { key: 'rawToPsa10', label: 'Raw → PSA 10', data: comparisons.rawToPsa10 },
      { key: 'psa9ToPsa10', label: 'PSA 9 → PSA 10', data: comparisons.psa9ToPsa10 }
    ];
    const gridTiles = [
      ...tiles.map(({ key, label, stats, trend, ref }, idx) => {
        if (!stats || stats.min == null) return null;
        let trendText = '';
        if (trend === 'up') trendText = `${label} prices are trending up!`;
        else if (trend === 'down') trendText = `${label} prices are trending down.`;
        // Add button to first three tiles
        return (
          <div key={key} className="analysis-item" style={{ background: '#fffbe6', border: '1.5px solid #ffd700', borderRadius: '8px', padding: '0.75rem 1.1rem', minWidth: 120, fontSize: '0.95rem', boxShadow: '0 1px 4px rgba(0,0,0,0.03)', position: 'relative' }}>
            <h4 style={{ color: '#000', marginBottom: 4, fontSize: '1.05rem' }}>{label}</h4>
            <p style={{ margin: 0 }}>Avg: <strong>{formatPrice({ value: stats.avg })}</strong></p>
            <p style={{ margin: 0, fontSize: '0.93em' }}>Range: {formatPrice({ value: stats.min })} - {formatPrice({ value: stats.max })}</p>
            {trendText && <div style={{ marginTop: 6, color: trend === 'up' ? '#388e3c' : '#b00', fontWeight: 600 }}>{trendText}</div>}
            <button
              style={{ marginTop: 10, background: '#ffd700', color: '#000', border: '1.5px solid #000', borderRadius: 5, padding: '0.4rem 1.1rem', fontWeight: 'bold', fontSize: '0.97rem', cursor: 'pointer' }}
              onClick={() => {
                if (ref && ref.current) {
                  ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
                // Open the corresponding live listings section
                setExpandedSections(prev => ({ ...prev, [key]: true }));
              }}
            >
              View Live Listings
            </button>
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
  const renderInvestmentInsight = (gradingStats) => {
    if (!gradingStats) return null;
    const gradingCompanyList = [
      'bgs', 'sgc', 'cgc', 'ace', 'cga', 'gma', 'hga', 'pgs', 'bvg', 'csg', 'rcg', 'ksa', 'fgs', 'tag', 'pgm', 'dga', 'isa'
    ];
    // Get PSA 10 avg price
    const psa10Avg = results?.priceAnalysis?.psa10?.avgPrice || 0;
    // Build comparison tiles
    const comparisonTiles = [];
    gradingCompanyList.forEach(companyKey => {
      const grades = gradingStats[companyKey] || {};
      Object.keys(grades).forEach(grade => {
        const stats = grades[grade];
        if (!stats || !psa10Avg || !stats.avgPrice) return;
        if (companyKey === 'psa') return;
        const diff = psa10Avg - stats.avgPrice;
        const percent = stats.avgPrice > 0 ? (diff / stats.avgPrice) * 100 : 0;
        const isMore = diff > 0;
        comparisonTiles.push({
          key: `${companyKey}-${grade}`,
          label: `${companyKey.toUpperCase()} ${grade.replace('_', '.')} → PSA 10`,
          count: stats.count,
          avg: stats.avgPrice,
          min: stats.minPrice,
          max: stats.maxPrice,
          diff: Math.abs(diff),
          percent: Math.abs(percent),
          isMore,
          baseLabel: `${companyKey.toUpperCase()} ${grade.replace('_', '.')}`
        });
      });
    });
    return (
      <div className="investment-insight-section" style={{ margin: '2.5rem 0 2rem 0' }}>
        <div className="other-graded-breakdown" style={{ background: '#f7f7f7', border: '1.5px solid #ccc', borderRadius: 8, padding: '1.2rem 1.5rem' }}>
          <h4 style={{ color: '#000', marginBottom: 8, fontSize: '1.1rem' }}>Other Graded Cards</h4>
          {/* Comparison Grid */}
          {comparisonTiles.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.8rem', marginBottom: '1.5rem' }}>
              {comparisonTiles.map(tile => (
                <div key={tile.key} style={{ background: '#e6f7ff', border: '1.5px solid #1890ff', borderRadius: 8, padding: '0.75rem 1.1rem', minWidth: 120, fontSize: '0.97rem', boxShadow: '0 1px 4px rgba(0,0,0,0.03)' }}>
                  <h4 style={{ color: '#0050b3', marginBottom: 4, fontSize: '1.05rem' }}>{tile.label}</h4>
                  <div style={{ marginBottom: 4, fontSize: '0.98em', color: '#333' }}>{tile.count} sold, avg {formatPrice({ value: tile.avg })} (range: {formatPrice({ value: tile.min })} - {formatPrice({ value: tile.max })})</div>
                  <div style={{ fontSize: '0.97em', color: tile.isMore ? '#388e3c' : '#b00', fontWeight: 600 }}>
                    PSA 10 is {tile.diff > 0 ? '' : ''}{formatPrice({ value: tile.diff })} ({tile.percent > 0 ? '' : ''}{tile.percent.toFixed(1)}%) {tile.isMore ? 'more' : 'less'} than {tile.baseLabel}
                  </div>
                </div>
              ))}
            </div>
          )}
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

            {/* Ad after price analysis */}
            <InContentAd />

            {/* Investment Insight */}
            <div style={{ marginTop: '2.5rem' }}>
              <h3 style={{ color: '#fff', fontWeight: 800, marginBottom: '1rem', fontSize: '1.4rem' }}>Investment Insight</h3>
              {renderInvestmentInsight(results.results?.gradingStats)}
            </div>

            {/* Card Sections */}
            {renderCardSection('Raw Cards', results.results.raw, '📄')}
            
            {/* Ad after first card section */}
            <SearchResultsAd />
            
            {renderCardSection('PSA 9', results.results.psa9, '🏆')}
            {renderCardSection('PSA 10', results.results.psa10, '🏆')}
          </div>
        )}
      </main>
    </div>
  );
};

export default SearchPage; 