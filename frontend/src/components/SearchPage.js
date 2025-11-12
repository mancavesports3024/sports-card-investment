// Trigger redeploy: trivial comment
import React, { useState, useEffect, useRef } from 'react';
import config from '../config';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';
import SavedSearches from './SavedSearches';
import { Helmet } from 'react-helmet';
import { InContentAd, SearchResultsAd } from './AdSense';
import FeaturedEbayRotator from './FeaturedEbayRotator';
import PageLayout from './PageLayout';
import BaseballFieldCard from './BaseballFieldCard';

const SearchPage = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
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
  // State for gemrate data for baseball field card
  const [baseballCardGemrateData, setBaseballCardGemrateData] = useState(null);

  // Fetch gemrate data when search results change
  useEffect(() => {
    const fetchGemrateForBaseballCard = async () => {
      if (!results || !results.searchParams?.searchQuery) {
        setBaseballCardGemrateData(null);
        return;
      }
      try {
        // Clean the search query - remove exclusions for GemRate
        let cleanQuery = results.searchParams.searchQuery;
        const exclusionIndex = cleanQuery.indexOf(' -(');
        if (exclusionIndex !== -1) {
          cleanQuery = cleanQuery.substring(0, exclusionIndex).trim();
        }
        
        console.log(`[FRONTEND] Fetching GemRate data for: "${cleanQuery}"`);
        const response = await fetch(`${config.API_BASE_URL}/api/gemrate/search/${encodeURIComponent(cleanQuery)}`);
        const data = await response.json();
        console.log(`[FRONTEND] GemRate response:`, data);
        
        if (data.success && data.data && data.data.success && data.data.population) {
          console.log(`[FRONTEND] Setting GemRate data:`, data.data.population);
          setBaseballCardGemrateData(data.data.population);
        } else {
          console.log(`[FRONTEND] GemRate data not available - success: ${data.success}, data.success: ${data.data?.success}, hasPopulation: ${!!data.data?.population}`);
          setBaseballCardGemrateData(null);
        }
      } catch (err) {
        console.error('[FRONTEND] Failed to fetch gemrate data for baseball card:', err);
        setBaseballCardGemrateData(null);
      }
    };
    fetchGemrateForBaseballCard();
  }, [results]);

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
        // Decode JWT token to ensure it's valid
        JSON.parse(atob(token.split('.')[1]));
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

    console.log('🔍 Starting search with query:', combinedQuery);

    // Google Analytics 4 site search event
    if (window.gtag) {
      window.gtag('event', 'search', {
        search_term: combinedQuery
      });
    }

    setIsLoading(true);
    setError(null);
    setResults(null);
    setLastSearchQuery(combinedQuery); // Store the latest search query

    try {
      console.log('📡 Making API request to:', config.getSearchCardsUrl());
      
      // Prepare headers with authentication if available
      const headers = {
        'Content-Type': 'application/json',
      };
      
      // Add authentication token if user is logged in
      const token = localStorage.getItem('authToken');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(config.getSearchCardsUrl(), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          searchQuery: combinedQuery,
          numSales: 25
        })
      });

      console.log('📡 API Response status:', response.status);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('📊 Search results received:', data);
      console.log('📊 Results structure:', {
        hasResults: !!data.results,
        rawCount: data.results?.raw?.length || 0,
        psa9Count: data.results?.psa9?.length || 0,
        psa10Count: data.results?.psa10?.length || 0,
        totalSources: data.sources?.total || 0
      });
      
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
            await fetch(config.getSearchHistoryUrl(), {
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
    const dateStr = date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
    
    // Only show time if it's not midnight (12:00 AM)
    const timeStr = date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    
    // If time is 12:00 AM, it likely means no time was provided, so don't show it
    if (timeStr === '12:00 AM') {
      return dateStr;
    }
    
    return dateStr + ' ' + timeStr;
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
      // Exclude if title contains grading company and grade in any order
      const gradeRegex = /(?:(?:psa|bgs|sgc|cgc|tag|gm|gem|mint)[\s:(-]*(?:9\.5|10|9|8|7))|(?:(?:9\.5|10|9|8|7)[\s:)-]*(?:psa|bgs|sgc|cgc|tag|gm|gem|mint))/i;
      const isGraded = gradeRegex.test(card.title || '');
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

  // Helper to build summary card data for baseball field card
  const buildSummaryCardData = () => {
    if (!results || !results.results) return null;

    const rawCards = filterRawCards(results.results.raw || []);
    const psa9Cards = (results.results.psa9 || []).filter(card => !isNaN(Number(card.price?.value)) && Number(card.price?.value) > 0);
    const psa10Cards = (results.results.psa10 || []).filter(card => !isNaN(Number(card.price?.value)) && Number(card.price?.value) > 0);

    // Calculate average prices
    const rawPrices = rawCards.map(card => Number(card.price?.value)).filter(v => !isNaN(v) && v > 0);
    const psa9Prices = psa9Cards.map(card => Number(card.price?.value)).filter(v => !isNaN(v) && v > 0);
    const psa10Prices = psa10Cards.map(card => Number(card.price?.value)).filter(v => !isNaN(v) && v > 0);

    const rawAvg = rawPrices.length > 0 ? rawPrices.reduce((a, b) => a + b, 0) / rawPrices.length : 0;
    const psa9Avg = psa9Prices.length > 0 ? psa9Prices.reduce((a, b) => a + b, 0) / psa9Prices.length : 0;
    const psa10Avg = psa10Prices.length > 0 ? psa10Prices.reduce((a, b) => a + b, 0) / psa10Prices.length : 0;

    // Get card image from first available sold card (priority: PSA 10, PSA 9, Raw)
    const getCardImage = (card) => {
      if (!card) return null;
      
      // Try all possible image field patterns
      let imageUrl = null;
      
      // Direct imageUrl field (most common)
      if (card.imageUrl && typeof card.imageUrl === 'string' && card.imageUrl.startsWith('http')) {
        imageUrl = card.imageUrl;
      }
      // Image object with imageUrl property
      else if (card.image && typeof card.image === 'object' && card.image.imageUrl) {
        imageUrl = card.image.imageUrl;
      }
      // Image as string
      else if (typeof card.image === 'string' && card.image.startsWith('http')) {
        imageUrl = card.image;
      }
      // Image object with url property
      else if (card.image?.url && typeof card.image.url === 'string' && card.image.url.startsWith('http')) {
        imageUrl = card.image.url;
      }
      // Thumbnail fields
      else if (card.thumbnail && typeof card.thumbnail === 'string' && card.thumbnail.startsWith('http')) {
        imageUrl = card.thumbnail;
      }
      else if (card.thumbnailUrl && typeof card.thumbnailUrl === 'string' && card.thumbnailUrl.startsWith('http')) {
        imageUrl = card.thumbnailUrl;
      }
      // Check nested image objects
      else if (card.imageUrl && typeof card.imageUrl === 'object' && card.imageUrl.url) {
        imageUrl = card.imageUrl.url;
      }
      
      // Validate URL
      if (imageUrl && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'))) {
        return imageUrl;
      }
      
      return null;
    };

    // Try to get image from cards, prioritizing those with images
    let cardImage = null;
    
    // First, try all cards to find one with an image
    const allCards = [...psa10Cards, ...psa9Cards, ...rawCards];
    for (const card of allCards) {
      const img = getCardImage(card);
      if (img) {
        cardImage = img;
        console.log('✅ Found card image:', img.substring(0, 50) + '...');
        break;
      }
    }
    
    // If still no image, log for debugging
    if (!cardImage) {
      console.log('⚠️ No card image found. Sample card structure:', {
        psa10Card: psa10Cards[0] ? {
          hasImageUrl: !!psa10Cards[0].imageUrl,
          hasImage: !!psa10Cards[0].image,
          imageUrlType: typeof psa10Cards[0].imageUrl,
          imageType: typeof psa10Cards[0].image
        } : null,
        psa9Card: psa9Cards[0] ? {
          hasImageUrl: !!psa9Cards[0].imageUrl,
          hasImage: !!psa9Cards[0].image
        } : null,
        rawCard: rawCards[0] ? {
          hasImageUrl: !!rawCards[0].imageUrl,
          hasImage: !!rawCards[0].image
        } : null
      });
    }

    // Get card title
    const cardTitle = results.searchParams?.searchQuery || 
                     psa10Cards[0]?.summaryTitle || 
                     psa10Cards[0]?.title || 
                     psa9Cards[0]?.summaryTitle || 
                     psa9Cards[0]?.title || 
                     rawCards[0]?.summaryTitle || 
                     rawCards[0]?.title || 
                     'Card';

    return {
      title: cardTitle,
      summaryTitle: cardTitle,
      imageUrl: cardImage,
      image: cardImage,
      rawAveragePrice: rawAvg,
      psa9AveragePrice: psa9Avg,
      psa10Price: psa10Avg,
      gemrateData: baseballCardGemrateData,
      population: baseballCardGemrateData,
      searchQuery: results.searchParams?.searchQuery || searchQuery,
      createdAt: new Date().toISOString()
    };
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
    if (!cards || cards.length === 0) {
      console.log(`🚫 No cards for section: ${title}`);
      return null;
    }
    
    console.log(`📋 Rendering section: ${title} with ${cards.length} cards`);
    
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
      console.log(`🔍 Raw cards filtered: ${cards.length} → ${displayCards.length}`);
    }

    // Pagination logic
    const isExpanded = expandedSections[sectionKey];
    const visibleCards = isExpanded ? displayCards : displayCards.slice(0, 25);
    
    console.log(`👁️ Visible cards for ${title}: ${visibleCards.length} (expanded: ${isExpanded})`);

    return (
      <div className="card-section" ref={sectionRef}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <h3 style={{ margin: 0, textAlign: 'right', flex: 1 }}>{icon} {title} ({cards.length})</h3>
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
                    <li key={item.itemId} style={{ borderBottom: '1px solid #eee', padding: '1.2rem 0', display: 'flex', flexDirection: 'row', alignItems: 'flex-start', gap: 32 }}>
                      {/* Left: Image */}
                      {(() => {
                        const imageUrl = typeof item.image === 'string'
                          ? item.image
                          : item.image?.imageUrl || null;
                        return (
                          <div style={{ flexShrink: 0, width: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', height: 180 }}>
                            {imageUrl ? (
                              <img src={imageUrl} alt={item.title} style={{ width: 170, height: 170, objectFit: 'cover', borderRadius: 10, border: '1.5px solid #ccc', background: '#fafafa' }} />
                            ) : (
                              <div style={{ width: 170, height: 170, borderRadius: 10, border: '1.5px solid #ccc', background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa', fontSize: 14 }}>
                                No Image
                              </div>
                            )}
                          </div>
                        );
                      })()}
                      {/* Right: All text/details */}
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0 }}>
                        {/* Top section: 3 rows, left-aligned */}
                        <div style={{ marginBottom: 10, width: '100%' }}>
                          {/* Row 1: NEW LISTING and title */}
                          <div className="live-listing-badge-title-row" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2 }}>
                            {isNewListing(item.listingDate) && <span className="live-listing-badge">NEW LISTING</span>}
                            <span style={{ fontWeight: 700, fontSize: '1.15rem', color: '#222', wordWrap: 'break-word', overflowWrap: 'break-word', lineHeight: '1.2' }}>{item.title}</span>
                          </div>
                          {/* Row 2: Condition (left, fully left-aligned, no extra margin/gap) */}
                          <div style={{ color: '#666', fontSize: '0.95rem', marginBottom: 2, textAlign: 'left' }}>{item.condition}</div>
                          {/* Row 3: Product rating (left, fully left-aligned) */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                            {item.starRating && (
                              <span style={{ color: '#f5a623', fontWeight: 600, fontSize: '0.98rem' }}>★</span>
                            )}
                            {item.starRating && item.numRatings && (
                              <span style={{ color: '#0066c0', fontWeight: 500, fontSize: '0.92rem', textDecoration: 'underline', marginRight: 4 }}>
                                {item.numRatings} product ratings
                              </span>
                            )}
                          </div>
                        </div>
                        {/* Lower section: 3 rows, each a flex row with smaller gap and left-justified */}
                        <div style={{ width: '100%' }}>
                          {/* Row 1: Price (left), gap, date (right) */}
                          <div className="live-listing-details-row" style={{ display: 'flex', alignItems: 'center', marginBottom: 2 }}>
                            <span style={{ fontWeight: 800, fontSize: '1.2rem', color: '#111', minWidth: 100, textAlign: 'left' }}>
                              {item.price && item.price.value && `$${Number(item.price.value).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                            </span>
                            <span style={{ marginLeft: '10em', color: '#555', fontWeight: 600, minWidth: 60, textAlign: 'left' }}>{item.listingDate && formatListingDate(item.listingDate)}</span>
                          </div>
                          {/* Row 2: Shipping price (left), gap, seller info (left) */}
                          <div className="live-listing-details-row" style={{ display: 'flex', alignItems: 'center', marginBottom: 2 }}>
                            <span style={{ color: '#444', fontSize: '1rem', minWidth: 100, textAlign: 'left' }}>{item.shipping}</span>
                            <span style={{ marginLeft: '10em', color: '#555', minWidth: 60, textAlign: 'left' }}>{item.seller?.username} {item.seller?.feedbackPercentage && `${item.seller?.feedbackPercentage}% positive`} {item.seller?.feedbackScore && `(${item.seller?.feedbackScore})`}</span>
                          </div>
                          {/* Row 3: Location (left), gap, item number (left, cleaned) */}
                          <div className="live-listing-details-row" style={{ display: 'flex', alignItems: 'center' }}>
                            <span style={{ color: '#444', fontSize: '1rem', minWidth: 100, textAlign: 'left' }}>{item.location && `Located in ${item.location}`}</span>
                            <span style={{ marginLeft: '10em', color: '#aaa', minWidth: 60, textAlign: 'left' }}>{item.itemId && `Item: ${(item.itemId.match(/[0-9]{6,}/) || [])[0] || item.itemId}`}</span>
                          </div>
                        </div>
                        {/* View on eBay button */}
                        <a href={item.itemWebUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', background: '#ffd700', color: '#000', fontWeight: 700, padding: '0.1rem 1.2rem', borderRadius: 7, textDecoration: 'none', border: '2px solid #000', fontSize: '0.8rem', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', maxWidth: 140, whiteSpace: 'nowrap' }}>View on eBay</a>
                      </div>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        )}
        <div className="cards-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0.7rem', gridAutoFlow: 'row' }}>
          {visibleCards.map((card, index) => {
            // Skip cards with invalid price
            const priceValue = Number(card.price?.value);
            if (isNaN(priceValue) || priceValue <= 0) {
              console.log(`❌ Card filtered out due to invalid price: "${card.title}" - Price: ${card.price?.value}`);
              return null;
            }
            
            console.log(`✅ Rendering card: "${card.title}" - Price: $${priceValue}`);
            
            return (
              <div key={`${card.id || index}-${card.title}`} className="card-item" style={{ background: '#fff', border: '1px solid #eee', borderRadius: 7, boxShadow: '0 1px 4px rgba(0,0,0,0.03)', padding: '0.6rem 0.6rem', minWidth: 220, maxWidth: 260, fontSize: '0.97em', marginBottom: 0 }}>
                                  <div className="card-details" style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', width: '100%', overflow: 'visible' }}>
                  <div className="custom-card-title">{(() => {
                    const rawTitle = card.summaryTitle || card.title || '';
                    return rawTitle
                      .replace(/\s*#unknown\b.*$/i, '')
                      .replace(/\s*#Unknown\b.*$/i, '')
                      .replace(/\s*#UNKNOWN\b.*$/i, '')
                      .replace(/\s+unknown\s*$/i, '')
                      .replace(/\s+Unknown\s*$/i, '')
                      .replace(/\s+UNKNOWN\s*$/i, '')
                      .replace(/\s+/g, ' ')
                      .trim();
                  })()}</div>
                  {/* Price row - listed price on left, sold price on right */}
                  <div style={{ display: 'flex', justifyContent: card.listPrice ? 'space-between' : 'flex-start', alignItems: 'center', width: '100%' }}>
                    {card.listPrice && (
                      <div className="custom-card-list-price">
                        ${Number(card.listPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    )}
                    <div className="custom-card-price">{formatPrice(card.price)}</div>
                  </div>
                  {/* Sale type (auction/fixed/etc.) - normalize display */}
                  {(() => {
                    // Determine if this is an auction
                    const isAuction = card.listingType === 'AUCTION' || 
                                     card.saleType === 'auction' || 
                                     card.saleType === 'Auction' ||
                                     (card.numBids && card.numBids > 0) ||
                                     (card.auction && card.auction.bidCount > 0);
                    
                    // Get bid count from multiple possible sources
                    const bidCount = card.numBids || 
                                   card.auction?.bidCount || 
                                   card.bidCount || 
                                   null;
                    
                    // Show sale type badge
                    if (isAuction) {
                      return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                          <div className="custom-card-sale-type">Auction</div>
                          {bidCount !== null && bidCount !== undefined && (
                            <div className="card-bids" style={{ fontSize: '0.85em', color: '#856404', backgroundColor: '#fff3cd', padding: '1px 4px', borderRadius: 3, border: '1px solid #ffeaa7', alignSelf: 'flex-start' }}>
                              {bidCount} {bidCount === 1 ? 'bid' : 'bids'}
                            </div>
                          )}
                        </div>
                      );
                    } else if (card.saleType) {
                      // For non-auction items, show the sale type (Buy It Now, Best Offer, etc.)
                      // Normalize common variations
                      const normalizedType = card.saleType === 'fixed_price' ? 'Buy It Now' : card.saleType;
                      return (
                        <div className="custom-card-sale-type">{normalizedType}</div>
                      );
                    }
                    return null;
                  })()}
                  <div className="custom-card-date">Sold: {formatDate(card.soldDate)}</div>
                  {/* Shipping cost - always render chip; show 'See listing' if missing */}
                  {(() => {
                    // Format shipping cost - handle both number and string formats
                    let shippingDisplay = 'See listing';
                    if (card.shippingCost !== undefined && card.shippingCost !== null) {
                      if (typeof card.shippingCost === 'number') {
                        shippingDisplay = card.shippingCost === 0 ? 'Free' : `$${card.shippingCost.toFixed(2)}`;
                      } else if (typeof card.shippingCost === 'string') {
                        const lc = card.shippingCost.toLowerCase();
                        if (lc.includes('free')) {
                          shippingDisplay = 'Free';
                        } else if (card.shippingCost.includes('$')) {
                          shippingDisplay = card.shippingCost;
                        } else {
                          const numValue = parseFloat(card.shippingCost);
                          if (!isNaN(numValue)) {
                            shippingDisplay = numValue === 0 ? 'Free' : `$${numValue.toFixed(2)}`;
                          } else if (card.shippingCost.trim().length > 0) {
                            shippingDisplay = card.shippingCost;
                          }
                        }
                      } else {
                        shippingDisplay = String(card.shippingCost);
                      }
                    }
                    return (
                      <div style={{ 
                        fontSize: '0.9em', 
                        color: '#2c5530', 
                        backgroundColor: '#d4edda', 
                        padding: '2px 6px', 
                        borderRadius: 4, 
                        border: '1px solid #c3e6cb',
                        alignSelf: 'flex-start',
                        fontWeight: 500
                      }}>
                        📦 {shippingDisplay}
                      </div>
                    );
                  })()}
                  {card.seller && card.seller !== '130point' && (
                    <div className="card-seller" style={{ fontSize: '0.85em', color: '#666' }}>Via: {card.seller}</div>
                  )}
                  {/* Item number, extract from itemWebUrl if possible */}
                  {card.itemWebUrl && (() => {
                    // Try to extract eBay item number from URL
                    const match = card.itemWebUrl.match(/\/itm\/(\d{6,})|\/(\d{6,})(?:\?.*)?$/);
                    const itemNum = match ? (match[1] || match[2]) : null;
                    return itemNum ? (
                      <div className="custom-card-item-number">
                        Item: {itemNum}
                      </div>
                    ) : null;
                  })()}
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
    // Find the tile with the smallest price difference to PSA 10 (best value)
    let bestValueKey = null;
    if (comparisonTiles.length > 0) {
      bestValueKey = comparisonTiles.reduce((best, tile) =>
        tile.diff < best.diff ? tile : best, comparisonTiles[0]).key;
    }
      return (
    <div className="investment-insight-section" style={{ margin: '2.5rem 0 2rem 0', background: 'linear-gradient(90deg, #111 0%, #ffd700 100%)', borderRadius: 12, boxShadow: '0 4px 24px rgba(0,0,0,0.10)', padding: '2.2rem 1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
        <span style={{ fontSize: 32, marginRight: 12, color: '#ffd700', filter: 'drop-shadow(0 2px 4px #0008)' }}>🏆</span>
        <h3 style={{ color: '#000', fontWeight: 900, fontSize: '1.5rem', margin: 0, letterSpacing: 1 }}>Investment Insight</h3>
      </div>
      <div style={{ color: '#222', background: '#fffbe6', borderRadius: 8, padding: '0.8rem 1.2rem', marginBottom: 18, fontSize: '1.08rem', fontWeight: 500, borderLeft: '6px solid #ffd700', boxShadow: '0 1px 6px rgba(255,215,0,0.08)' }}>
        Compare how other graded cards stack up to PSA 10s. The closer the value, the better the investment potential.
      </div>
        <div className="other-graded-breakdown" style={{ background: 'rgba(255,255,255,0.95)', border: '1.5px solid #ffd700', borderRadius: 10, padding: '1.2rem 1.5rem', boxShadow: '0 2px 12px rgba(255,215,0,0.08)' }}>
          <h4 style={{ color: '#000', marginBottom: 8, fontSize: '1.1rem', fontWeight: 800, letterSpacing: 0.5 }}>Other Graded Cards</h4>
          {/* Comparison Grid */}
          {comparisonTiles.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.1rem', marginBottom: '1.5rem' }}>
              {comparisonTiles.map(tile => (
                <div key={tile.key} style={{ background: '#fff', border: tile.key === bestValueKey ? '3px solid #ffd700' : '2px solid #222', borderRadius: 10, padding: '1.1rem 1.2rem', minWidth: 120, fontSize: '1.01rem', boxShadow: tile.key === bestValueKey ? '0 4px 18px #ffd70044' : '0 1px 6px #0001', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <span style={{ fontSize: 20, color: '#ffd700', marginRight: 2 }}>💹</span>
                    <span style={{ fontWeight: 700, color: '#000', fontSize: '1.08rem' }}>{tile.label}</span>
                    {tile.key === bestValueKey && (
                      <span style={{ background: '#ffd700', color: '#000', fontWeight: 800, fontSize: '0.85rem', borderRadius: 6, padding: '2px 10px', marginLeft: 8, boxShadow: '0 2px 8px #ffd70044' }}>Best Value</span>
                    )}
                  </div>
                  <div style={{ marginBottom: 2, fontSize: '0.99em', color: '#333', fontWeight: 500 }}>{tile.count} sold, avg <span style={{ color: '#000', fontWeight: 700 }}>{formatPrice({ value: tile.avg })}</span></div>
                  <div style={{ fontSize: '0.97em', color: '#666', marginBottom: 2 }}>Range: {formatPrice({ value: tile.min })} - {formatPrice({ value: tile.max })}</div>
                  <div style={{ fontSize: '1.01em', color: tile.isMore ? '#388e3c' : '#b00', fontWeight: 700, marginTop: 2 }}>
                    PSA 10 is {formatPrice({ value: tile.diff })} ({tile.percent.toFixed(1)}%) {tile.isMore ? 'more' : 'less'} than {tile.baseLabel}
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
    <>
      <Helmet>
        <title>Scorecard - Search Cards</title>
        <meta name="description" content="Search for sports card prices, market data, and investment insights." />
        <link rel="canonical" href="https://www.mancavesportscardsllc.com/search" />
      </Helmet>
      {/* Main Content */}
      <main className="App-main">
        <PageLayout
          title="Search Cards"
          subtitle="Search for trading cards and get real-time pricing data from recent sales"
          icon="🔍"
        >
          {/* Welcome Message with eBay Items */}
          <div className="welcome-section" style={{
            background: 'linear-gradient(135deg, #000 0%, #333 100%)',
            color: '#ffd700',
            padding: '1rem',
            borderRadius: 12,
            marginBottom: '2rem',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            border: '2px solid #ffd700',
            maxWidth: '600px',
            margin: '0 auto 2rem auto'
          }}>
            <p style={{ 
              fontSize: '0.95rem', 
              lineHeight: '1.4', 
              marginBottom: '1rem',
              textAlign: 'center',
              color: '#fff'
            }}>
              Your destination for all things trading cards—specializing in sports cards and Pokémon!
            </p>
            <h3 style={{ 
              margin: '0 0 0.75rem 0', 
              fontSize: '1.2rem', 
              fontWeight: 600,
              textAlign: 'center',
              color: '#ffd700'
            }}>
              Featured Items from Our eBay Store
            </h3>
            <FeaturedEbayRotator />
          </div>

          {/* Search Form - Narrower */}
          <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <form id="search-form" onSubmit={handleSearch} className="search-form">
          <div className="form-fields-container">
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
            <div className="form-group advanced-search">
              <label htmlFor="searchQuery"><strong>Advanced Search</strong> (overrides all fields):</label>
              <small className="search-helper">
                For best results: <em>year, brand, set, player</em> - exclusion words<br />
                Example: <code>2025 Topps Chrome Jackson Holliday -pick -custom</code>
              </small>
              <input
                type="text"
                id="searchQuery"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="e.g., 2025 Bowman Chrome Jackson Chourio -PSA"
              />
            </div>
          </div>
          <div className="form-buttons-container">
            <button type="submit" disabled={isLoading} className="search-button">
              {isLoading ? '🔍 Searching...' : '🔍 Search Cards'}
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="clear-button"
            >
              Clear
            </button>
          </div>
        </form>
        </div>
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
                  <p className="save-note">
                    💡 <button type="button" onClick={handleLogin} style={{ background: 'none', border: 'none', padding: 0, color: '#ffd700', textDecoration: 'underline', cursor: 'pointer', fontWeight: 700 }}>Sign in</button> to save this search
                  </p>
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
                  // Merge by date - sort by actual date, not string
                  const allDateObjects = Array.from(new Set([...raw, ...psa9, ...psa10].map(d => new Date(d.date)))).sort((a, b) => a - b);
                  const allDates = allDateObjects.map(date => date.toLocaleDateString('en-US'));
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

            {/* Baseball Field Card - Scorecard Summary */}
            {(() => {
              const summaryCard = buildSummaryCardData();
              if (!summaryCard || (!summaryCard.rawAveragePrice && !summaryCard.psa9AveragePrice && !summaryCard.psa10Price)) {
                return null;
              }
              return (
                <div style={{ 
                  margin: '2rem 0', 
                  display: 'flex', 
                  justifyContent: 'center',
                  alignItems: 'center',
                  width: '100%'
                }}>
                  <div style={{ width: '100%', maxWidth: '100%' }}>
                    <h3 style={{ 
                      color: '#fff', 
                      fontWeight: 800, 
                      textShadow: '1px 1px 6px #000',
                      textAlign: 'center',
                      marginBottom: '1.5rem',
                      fontSize: '1.5rem'
                    }}>
                      ⚾ Scorecard Summary
                    </h3>
                    <BaseballFieldCard card={summaryCard} />
                  </div>
                </div>
              );
            })()}


            {/* Ad after price analysis */}
            <InContentAd />

            {/* Investment Insight */}
            <div style={{ marginTop: '2.5rem' }}>
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

        {/* Loading placeholder to prevent layout shifts */}
        {isLoading && (
          <div className="search-results" style={{ 
            minHeight: '400px', 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center',
            background: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '10px',
            margin: '2rem 0',
            border: '2px solid #ffd700'
          }}>
            <div style={{ 
              color: '#ffd700', 
              fontSize: '1.2rem', 
              fontWeight: 'bold',
              marginBottom: '1rem'
            }}>
              🔍 Searching for cards...
            </div>
            <div style={{ 
              color: '#fff', 
              fontSize: '1rem' 
            }}>
              Please wait while we fetch the latest sales data
            </div>
          </div>
        )}
        </PageLayout>
      </main>
    </>
  );
};

export default SearchPage; 