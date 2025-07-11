import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './App.css';
import config from './config';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';

function App() {
  const [formData, setFormData] = useState({
    searchQuery: ''
  });
  
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchHistory, setSearchHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [liveListings, setLiveListings] = useState([]);
  const [liveListingsLoading, setLiveListingsLoading] = useState(false);
  const [liveListingsError, setLiveListingsError] = useState(null);
  const [liveListingsCategory, setLiveListingsCategory] = useState(null);
  const [showLiveListingsOnly, setShowLiveListingsOnly] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [user, setUser] = useState(null);

  // Check for JWT in localStorage on mount
  useEffect(() => {
    const token = localStorage.getItem('jwt');
    if (token) {
      // Optionally decode token for user info
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUser(payload);
      } catch (e) {
        setUser(null);
      }
    }
  }, []);

  // Handle /auth-success route
  useEffect(() => {
    if (window.location.pathname === '/auth-success') {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token');
      if (token) {
        localStorage.setItem('jwt', token);
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          setUser(payload);
        } catch (e) {
          setUser(null);
        }
        // Redirect to home after storing token
        window.location.replace('/');
      }
    }
  }, []);

  // Logout handler
  const handleLogout = () => {
    localStorage.removeItem('jwt');
    setUser(null);
    window.location.reload();
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Load search history function
  const loadSearchHistory = async () => {
    setHistoryLoading(true);
    try {
      const token = localStorage.getItem('jwt');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await axios.get(config.getSearchHistoryUrl(), {
        headers,
      });
      setSearchHistory(response.data.searches || []);
    } catch (err) {
      console.error('Failed to load search history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Load search history on component mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    if (user) {
      loadSearchHistory();
    }
  }, [user]);

  const deleteSearch = async (searchId) => {
    try {
      const token = localStorage.getItem('jwt');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await axios.delete(config.getDeleteSearchUrl(searchId), { headers });
      // Refresh search history after deletion
      await loadSearchHistory();
    } catch (err) {
      console.error('Failed to delete search:', err);
    }
  };

  const clearAllHistory = async () => {
    try {
      const token = localStorage.getItem('jwt');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await axios.delete(config.getClearHistoryUrl(), { headers });
      setSearchHistory([]);
    } catch (err) {
      console.error('Failed to clear history:', err);
    }
  };

  // Update saveSearch to prevent duplicate search queries
  const saveSearch = async (searchQuery, results, priceAnalysis) => {
    try {
      // Prevent duplicate search queries (case-insensitive, trimmed)
      const normalizedQuery = searchQuery.trim().toLowerCase();
      const alreadyExists = searchHistory.some(
        s => (s.searchQuery || '').trim().toLowerCase() === normalizedQuery
      );
      if (alreadyExists) {
        console.log('🔁 Duplicate search, not saving:', searchQuery);
        return;
      }
      const token = localStorage.getItem('jwt');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await axios.post(config.getSearchHistoryUrl(), {
        searchQuery: searchQuery,
        results: {
          raw: results.raw || [],
          psa9: results.psa9 || [],
          psa10: results.psa10 || []
        },
        priceAnalysis: priceAnalysis
      }, { headers });
      console.log('💾 Search saved successfully:', searchQuery);
    } catch (err) {
      console.error('Failed to save search:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const token = localStorage.getItem('jwt');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await axios.post(config.getSearchCardsUrl(), {
        ...formData,
        numSales: 25
      }, { headers });
      setResults(response.data);
      // Save search for user
      await saveSearch(formData.searchQuery, response.data.results, response.data.priceAnalysis);
      // Refresh search history after successful search
      await loadSearchHistory();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to fetch card data');
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price) => {
    if (!price || !price.value) return 'N/A';
    return `$${parseFloat(price.value).toFixed(2)} ${price.currency || 'USD'}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    
    // Check if it's a recent date (within last 30 days)
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays <= 7) {
      return `${diffDays} days ago`;
    } else if (diffDays <= 30) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const formatBidInfo = (card) => {
    if (!card.saleType) return 'Unknown';
    const type = card.saleType.toLowerCase();
    
    if (type === 'auction') {
      // Check for bid count in auction object or legacy bidCount field
      const bidCount = card.auction?.bidCount || card.bidCount || 0;
      return bidCount > 0 ? `${bidCount} bids` : 'Auction (no bids)';
    }
    
    if (type === 'fixed_price') return 'Buy It Now';
    return 'Unknown';
  };

  // Handler to fetch live listings
  const handleViewLiveListings = async (category, saleType = null) => {
    console.log('🔍 handleViewLiveListings called:', { category, saleType });
    setLiveListingsLoading(true);
    setLiveListingsError(null);
    setLiveListings([]);
    setLiveListingsCategory(category);
    setShowLiveListingsOnly(true);
    
    console.log('🔍 State after setting:', { 
      showLiveListingsOnly: true, 
      liveListingsCategory: category,
      searchQuery: formData.searchQuery 
    });
    
    try {
      const token = localStorage.getItem('jwt');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const params = {
        query: formData.searchQuery,
        grade: category === 'raw' ? 'Raw' : category === 'psa9' ? 'PSA 9' : 'PSA 10',
        saleType: saleType, // 'auction' or 'fixed' or null for all
      };
      
      console.log('🔍 Making API request with params:', params);
      
      const response = await axios.get(
        `${config.API_BASE_URL}/api/live-listings`,
        {
          params,
          headers,
        }
      );
      
      console.log('🔍 API response:', response.data);
      
      // Validate and clean the items data
      const items = response.data.items || [];
      const cleanedItems = items.map(item => ({
        itemId: item.itemId || `item-${Date.now()}-${Math.random()}`,
        title: item.title || 'Untitled Item',
        price: item.price || null,
        itemWebUrl: item.itemWebUrl || '#',
        image: item.image || null,
        buyingOptions: Array.isArray(item.buyingOptions) ? item.buyingOptions : [],
        itemCreationDate: item.itemCreationDate || new Date().toISOString(),
        seller: typeof item.seller === 'string' ? item.seller : null,
        condition: typeof item.condition === 'string' ? item.condition : null
      }));
      
      setLiveListings(cleanedItems);
      console.log('🔍 Live listings set:', cleanedItems.length, 'items');
    } catch (err) {
      console.error('❌ Error fetching live listings:', err);
      setLiveListingsError(err.response?.data?.error || err.message || 'Failed to fetch live listings');
    } finally {
      setLiveListingsLoading(false);
      console.log('🔍 Loading finished');
    }
  };

  const handleBackToSoldResults = () => {
    setShowLiveListingsOnly(false);
    setLiveListingsCategory(null);
    setLiveListings([]);
    setLiveListingsError(null);
    setActiveFilter('all');
  };

  // Add refs for jump navigation
  const rawRef = useRef(null);
  const psa9Ref = useRef(null);
  const psa10Ref = useRef(null);

  // Add expand/collapse state for sold cards
  const [expandedCards, setExpandedCards] = useState({});
  const toggleExpand = (type, idx) => {
    setExpandedCards(prev => ({
      ...prev,
      [`${type}-${idx}`]: !prev[`${type}-${idx}`]
    }));
  };

  const CardResults = ({ title, cards, type, sectionRef }) => (
    <div className="card-section" ref={sectionRef}>
      <h3>{title}</h3>
      <button
        className="live-listings-btn"
        onClick={() => handleViewLiveListings(type)}
        disabled={liveListingsLoading && liveListingsCategory === type}
      >
        {liveListingsLoading && liveListingsCategory === type ? 'Loading...' : 'View Live Listings'}
      </button>
      {cards && cards.length > 0 ? (
        <div className="cards-grid compact">
          {cards.map((card, index) => {
            const isExpanded = expandedCards[`${type}-${index}`];
            return (
              <div key={`${type}-${index}`} className="card-item compact">
                <div className="card-summary-row">
                  <div>
                    <h4 className="card-title">{card.title}</h4>
                    <span className="card-price">{formatPrice(card.price)}</span>
                    <span className="card-date">{formatDate(card.soldDate)}</span>
                  </div>
                  <button className="expand-btn" onClick={() => toggleExpand(type, index)}>
                    {isExpanded ? '▲' : '▼'}
                  </button>
                </div>
                {isExpanded && (
                  <div className="card-details">
                    <div className="card-info-grid">
                      <p className="card-bids">{formatBidInfo(card)}</p>
                      <p className="card-seller">Seller: {card.seller || 'N/A'}</p>
                      <p className="card-condition">Condition: {card.condition || 'Unknown'}</p>
                      {card.auction && card.auction.startingPrice && (
                        <p className="card-starting-price">Started: ${card.auction.startingPrice}</p>
                      )}
                      {card.price && card.price.priceType && (
                        <p className="card-price-type">Type: {card.price.priceType === 'final_bid' ? 'Auction' : 'Buy It Now'}</p>
                      )}
                    </div>
                    {card.itemWebUrl && (
                      <div className="ebay-link-container">
                        <a href={card.itemWebUrl} target="_blank" rel="noopener noreferrer" className="ebay-link">
                          View on eBay
                        </a>
                        <small className="url-note">
                          Note: eBay URLs may redirect to similar items
                        </small>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="no-results">No {type} trading cards found</p>
      )}
    </div>
  );

  // Home Page Component
  const HomePage = () => (
    <div className="home-page">
      <header className="home-header">
        <div className="home-nav">
          <h1 className="home-logo">🏈 Trading Card Tracker</h1>
          <a
            href={`${config.API_BASE_URL}/api/auth/google`}
            className="home-login-btn"
          >
            Log in with Google
          </a>
        </div>
      </header>

      <main className="home-main">
        {/* Hero Section */}
        <section className="hero-section">
          <div className="hero-content">
            <h1 className="hero-title">
              Track Trading Card Sales on <span className="highlight">eBay</span>
            </h1>
            <p className="hero-subtitle">
              Get real-time price data, market analysis, and investment insights for sports cards, 
              Magic: The Gathering, Pokemon, and more.
            </p>
            <div className="hero-cta">
              <a
                href={`${config.API_BASE_URL}/api/auth/google`}
                className="cta-button"
              >
                Start Tracking Cards
              </a>
              <p className="cta-note">Free to use • No registration required</p>
            </div>
          </div>
          <div className="hero-image">
            <div className="mockup-card">
              <div className="mockup-header">📊 Price Analysis</div>
              <div className="mockup-content">
                <div className="mockup-price">$1,250</div>
                <div className="mockup-trend">↗️ Trending Up</div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="features-section">
          <h2 className="section-title">Why Choose Trading Card Tracker?</h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">📈</div>
              <h3>Real-Time Price Data</h3>
              <p>Track recent eBay sales with detailed price analysis and market trends.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🔍</div>
              <h3>Advanced Search</h3>
              <p>Find cards by player, year, brand, grade, and more with powerful search filters.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">💡</div>
              <h3>Investment Insights</h3>
              <p>Get smart analysis on grading premiums and investment opportunities.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📱</div>
              <h3>Mobile Friendly</h3>
              <p>Use on any device - desktop, tablet, or mobile phone.</p>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="how-it-works">
          <h2 className="section-title">How It Works</h2>
          <div className="steps-grid">
            <div className="step-card">
              <div className="step-number">1</div>
              <h3>Search Cards</h3>
              <p>Enter the name of any trading card you want to track.</p>
            </div>
            <div className="step-card">
              <div className="step-number">2</div>
              <h3>Get Results</h3>
              <p>View recent sales, price analysis, and market trends.</p>
            </div>
            <div className="step-card">
              <div className="step-number">3</div>
              <h3>Make Decisions</h3>
              <p>Use the data to make informed buying and selling decisions.</p>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="cta-section">
          <h2>Ready to Start Tracking?</h2>
          <p>Join thousands of collectors making smarter decisions with real market data.</p>
          <a
            href={`${config.API_BASE_URL}/api/auth/google`}
            className="cta-button large"
          >
            Get Started Now
          </a>
        </section>
      </main>

      <footer className="home-footer">
        <p>&copy; 2024 Trading Card Tracker. All rights reserved.</p>
      </footer>
    </div>
  );

  // If user is not logged in, show home page
  if (!user) {
    return <HomePage />;
  }

  // If user is logged in, show the main app
  return (
    <div className="App">
      <header className="App-header">
        <h1>🏈 Trading Card Sales Tracker</h1>
        <p>Search for recent eBay sales of trading cards</p>
        {/* Google Login/Logout UI */}
        <div className="auth-section">
          {user ? (
            <>
              <span>Signed in as {user.displayName || user.email}</span>
              <button onClick={handleLogout} className="logout-btn">Log out</button>
            </>
          ) : (
            <a
              href={`${config.API_BASE_URL}/api/auth/google`}
              className="google-login-btn"
            >
              Log in with Google
            </a>
          )}
        </div>
      </header>

      <main className="App-main">
        {/* Search Tips Section */}
        <div className="search-tips-section">
          <h3>💡 Search Tips</h3>
          <div className="search-tips-grid">
            <div className="search-tip-card">
              <h4>Multiple Variations</h4>
              <p>Enclose variations in brackets and separate by commas:</p>
              <code>(2019-20, 19-20) or (PSA, BGS)</code>
            </div>
            
            <div className="search-tip-card">
              <h4>Exclude Terms</h4>
              <p>Use a minus "-" sign to exclude terms:</p>
              <code>(2020-21, 20-21) Lamelo Ball -box -case -break or -(box, case, break)</code>
            </div>
            
            <div className="search-tip-card">
              <h4>Exact Pattern</h4>
              <p>Use & to match only that pattern:</p>
              <code>Charizard PSA&10</code>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="search-form">
          <div className="form-group">
            <label htmlFor="searchQuery">Search Trading Cards *</label>
            <input
              type="text"
              id="searchQuery"
              name="searchQuery"
              value={formData.searchQuery}
              onChange={handleInputChange}
              placeholder="e.g., Charizard 1999 Base Set, Magic: The Gathering Black Lotus"
              required
            />
          </div>

          <button type="submit" disabled={loading} className="search-button">
            {loading ? 'Searching...' : 'Search Trading Cards'}
          </button>
        </form>

        {/* Search History Section */}
        <div className="search-history-section">
          <div className="history-header">
            <h3>📚 Search History</h3>
            <div className="history-controls">
              <button 
                onClick={() => setShowHistory(!showHistory)} 
                className="toggle-history-btn"
              >
                {showHistory ? 'Hide' : 'Show'} History
              </button>
              {showHistory && searchHistory.length > 0 && (
                <button 
                  onClick={clearAllHistory} 
                  className="clear-history-btn"
                >
                  Clear All
                </button>
              )}
            </div>
          </div>
          
          {showHistory && (
            <div className="search-history">
              {historyLoading ? (
                <p>Loading search history...</p>
              ) : searchHistory.length === 0 ? (
                <p>No saved searches yet. Your searches will be automatically saved here.</p>
              ) : (
                <div className="history-list">
                  {searchHistory.map((search) => (
                    <div key={search.id} className="history-item">
                      <div className="history-content">
                        <h4>{search.query}</h4>
                        <div className="history-details">
                          <span className="history-date">
                            {new Date(search.timestamp).toLocaleDateString()} at {new Date(search.timestamp).toLocaleTimeString()}
                          </span>
                          <span className="history-results">
                            {search.results.totalCards} cards found
                            {search.results.raw > 0 && ` (${search.results.raw} Raw, ${search.results.psa9} PSA 9, ${search.results.psa10} PSA 10)`}
                          </span>
                        </div>
                        {search.priceAnalysis && (
                          <div className="history-prices">
                            <span>Raw: ${search.priceAnalysis.raw?.avgPrice?.toFixed(2) || 'N/A'}</span>
                            <span>PSA 9: ${search.priceAnalysis.psa9?.avgPrice?.toFixed(2) || 'N/A'}</span>
                            <span>PSA 10: ${search.priceAnalysis.psa10?.avgPrice?.toFixed(2) || 'N/A'}</span>
                          </div>
                        )}
                      </div>
                      <div className="history-actions">
                        <button 
                          onClick={() => {
                            setFormData({ searchQuery: search.query });
                            setShowHistory(false);
                          }}
                          className="reuse-search-btn"
                        >
                          Reuse
                        </button>
                        <button 
                          onClick={() => deleteSearch(search.id)}
                          className="delete-search-btn"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="error-message">
            <h3>Error</h3>
            <p>{error}</p>
          </div>
        )}

        {results && (
          <div className="results-section">
            <h2>Search Results</h2>
            <div className="search-summary">
              <p>
                Found results for: <strong>{results.searchParams.searchQuery}</strong>
              </p>
              
              {/* Price Analysis Section */}
              {results.priceAnalysis && (
                <div className="price-analysis-section">
                  <h3>📊 Price Analysis</h3>
                  <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                    <button className="jump-btn" onClick={() => rawRef.current?.scrollIntoView({ behavior: 'smooth' })}>Jump to Raw Sales</button>
                    <button className="jump-btn" onClick={() => psa9Ref.current?.scrollIntoView({ behavior: 'smooth' })}>Jump to PSA 9 Sales</button>
                    <button className="jump-btn" onClick={() => psa10Ref.current?.scrollIntoView({ behavior: 'smooth' })}>Jump to PSA 10 Sales</button>
                  </div>
                  
                  {/* Price Trend Chart */}
                  <div style={{ width: '100%', height: 300, marginBottom: 32 }}>
                    <ResponsiveContainer>
                      <LineChart
                        data={(() => {
                          const raw = results.results.raw || [];
                          const psa9 = results.results.psa9 || [];
                          const psa10 = results.results.psa10 || [];
                          const allDates = Array.from(new Set([
                            ...raw.map(card => card.soldDate),
                            ...psa9.map(card => card.soldDate),
                            ...psa10.map(card => card.soldDate),
                          ].filter(Boolean))).sort();
                          return allDates.map(date => ({
                            date: date,
                            Raw: (() => {
                              const cards = raw.filter(card => card.soldDate === date);
                              if (!cards.length) return null;
                              return cards.reduce((sum, c) => sum + (parseFloat(c.price?.value) || 0), 0) / cards.length;
                            })(),
                            PSA9: (() => {
                              const cards = psa9.filter(card => card.soldDate === date);
                              if (!cards.length) return null;
                              return cards.reduce((sum, c) => sum + (parseFloat(c.price?.value) || 0), 0) / cards.length;
                            })(),
                            PSA10: (() => {
                              const cards = psa10.filter(card => card.soldDate === date);
                              if (!cards.length) return null;
                              return cards.reduce((sum, c) => sum + (parseFloat(c.price?.value) || 0), 0) / cards.length;
                            })(),
                          }));
                        })()}
                        margin={{ top: 20, right: 30, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="date" 
                          tick={{ fontSize: 12 }} 
                          tickFormatter={date => {
                            if (!date) return '';
                            const d = new Date(date);
                            const mm = String(d.getMonth() + 1).padStart(2, '0');
                            const dd = String(d.getDate()).padStart(2, '0');
                            const yyyy = d.getFullYear();
                            return `${mm}/${dd}/${yyyy}`;
                          }}
                        />
                        <YAxis tick={{ fontSize: 12 }} domain={[0, 'auto']} />
                        <Tooltip formatter={v => v ? `$${v.toFixed(2)}` : 'N/A'} 
                          labelFormatter={date => {
                            if (!date) return '';
                            const d = new Date(date);
                            const mm = String(d.getMonth() + 1).padStart(2, '0');
                            const dd = String(d.getDate()).padStart(2, '0');
                            const yyyy = d.getFullYear();
                            return `${mm}/${dd}/${yyyy}`;
                          }}
                        />
                        <Legend />
                        <Line type="monotone" dataKey="Raw" stroke="#222" strokeWidth={2} dot={false} name="Raw" />
                        <Line type="monotone" dataKey="PSA9" stroke="#FFD600" strokeWidth={2} dot={false} name="PSA 9" />
                        <Line type="monotone" dataKey="PSA10" stroke="#00C49F" strokeWidth={2} dot={false} name="PSA 10" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  
                  {/* Summary Cards */}
                  <div className="price-summary">
                    <div className="price-card">
                      <h4>Raw Cards</h4>
                      <p className="average-price">
                        ${results.priceAnalysis.raw.avgPrice.toFixed(2)}
                      </p>
                      <span className="card-count">{results.priceAnalysis.raw.count} cards</span>
                      <div className="price-range">
                        <small>Range: ${results.priceAnalysis.raw.minPrice.toFixed(2)} - ${results.priceAnalysis.raw.maxPrice.toFixed(2)}</small>
                      </div>
                      <div className={`price-trend ${results.priceAnalysis.raw.trend}`}>
                        <span className="trend-icon">
                          {results.priceAnalysis.raw.trend === 'up' ? '↗️' : 
                           results.priceAnalysis.raw.trend === 'down' ? '↘️' : '→'}
                        </span>
                        <span className="trend-text">
                          {results.priceAnalysis.raw.trend === 'up' ? 'Trending Up' : 
                           results.priceAnalysis.raw.trend === 'down' ? 'Trending Down' : 'Stable'}
                        </span>
                      </div>
                      <button
                        className="live-listings-btn"
                        onClick={() => handleViewLiveListings('raw')}
                        disabled={liveListingsLoading && liveListingsCategory === 'raw'}
                      >
                        {liveListingsLoading && liveListingsCategory === 'raw' ? 'Loading...' : 'View Live Listings'}
                      </button>
                    </div>
                    
                    <div className="price-card">
                      <h4>PSA 9</h4>
                      <p className="average-price">
                        ${results.priceAnalysis.psa9.avgPrice.toFixed(2)}
                      </p>
                      <span className="card-count">{results.priceAnalysis.psa9.count} cards</span>
                      <div className="price-range">
                        <small>Range: ${results.priceAnalysis.psa9.minPrice.toFixed(2)} - ${results.priceAnalysis.psa9.maxPrice.toFixed(2)}</small>
                      </div>
                      <div className={`price-trend ${results.priceAnalysis.psa9.trend}`}>
                        <span className="trend-icon">
                          {results.priceAnalysis.psa9.trend === 'up' ? '↗️' : 
                           results.priceAnalysis.psa9.trend === 'down' ? '↘️' : '→'}
                        </span>
                        <span className="trend-text">
                          {results.priceAnalysis.psa9.trend === 'up' ? 'Trending Up' : 
                           results.priceAnalysis.psa9.trend === 'down' ? 'Trending Down' : 'Stable'}
                        </span>
                      </div>
                      <button
                        className="live-listings-btn"
                        onClick={() => handleViewLiveListings('psa9')}
                        disabled={liveListingsLoading && liveListingsCategory === 'psa9'}
                      >
                        {liveListingsLoading && liveListingsCategory === 'psa9' ? 'Loading...' : 'View Live Listings'}
                      </button>
                    </div>
                    
                    <div className="price-card">
                      <h4>PSA 10</h4>
                      <p className="average-price">
                        ${results.priceAnalysis.psa10.avgPrice.toFixed(2)}
                      </p>
                      <span className="card-count">{results.priceAnalysis.psa10.count} cards</span>
                      <div className="price-range">
                        <small>Range: ${results.priceAnalysis.psa10.minPrice.toFixed(2)} - ${results.priceAnalysis.psa10.maxPrice.toFixed(2)}</small>
                      </div>
                      <div className={`price-trend ${results.priceAnalysis.psa10.trend}`}>
                        <span className="trend-icon">
                          {results.priceAnalysis.psa10.trend === 'up' ? '↗️' : 
                           results.priceAnalysis.psa10.trend === 'down' ? '↘️' : '→'}
                        </span>
                        <span className="trend-text">
                          {results.priceAnalysis.psa10.trend === 'up' ? 'Trending Up' : 
                           results.priceAnalysis.psa10.trend === 'down' ? 'Trending Down' : 'Stable'}
                        </span>
                      </div>
                      <button
                        className="live-listings-btn"
                        onClick={() => handleViewLiveListings('psa10')}
                        disabled={liveListingsLoading && liveListingsCategory === 'psa10'}
                      >
                        {liveListingsLoading && liveListingsCategory === 'psa10' ? 'Loading...' : 'View Live Listings'}
                      </button>
                    </div>
                  </div>

                  {/* Price Comparisons */}
                  <div className="price-comparisons">
                    <h4>💰 Price Comparisons</h4>
                    <div className="comparison-grid">
                      {results.priceAnalysis.comparisons.rawToPsa9 && (
                        <div className="comparison-card">
                          <div className="comparison-header">
                            <span className="comparison-label">Raw → PSA 9</span>
                            <span className="comparison-arrow">→</span>
                          </div>
                          <div className="comparison-details">
                            <div className="dollar-diff">
                              ${results.priceAnalysis.comparisons.rawToPsa9.dollarDiff.toFixed(2)}
                            </div>
                            <div className="percent-diff">
                              {results.priceAnalysis.comparisons.rawToPsa9.percentDiff > 0 ? '+' : ''}{results.priceAnalysis.comparisons.rawToPsa9.percentDiff.toFixed(1)}%
                            </div>
                          </div>
                          <div className="comparison-description">
                            PSA 9 premium over raw
                          </div>
                        </div>
                      )}

                      {results.priceAnalysis.comparisons.rawToPsa10 && (
                        <div className="comparison-card">
                          <div className="comparison-header">
                            <span className="comparison-label">Raw → PSA 10</span>
                            <span className="comparison-arrow">→</span>
                          </div>
                          <div className="comparison-details">
                            <div className="dollar-diff">
                              ${results.priceAnalysis.comparisons.rawToPsa10.dollarDiff.toFixed(2)}
                            </div>
                            <div className="percent-diff">
                              {results.priceAnalysis.comparisons.rawToPsa10.percentDiff > 0 ? '+' : ''}{results.priceAnalysis.comparisons.rawToPsa10.percentDiff.toFixed(1)}%
                            </div>
                          </div>
                          <div className="comparison-description">
                            PSA 10 premium over raw
                          </div>
                        </div>
                      )}

                      {results.priceAnalysis.comparisons.psa9ToPsa10 && (
                        <div className="comparison-card">
                          <div className="comparison-header">
                            <span className="comparison-label">PSA 9 → PSA 10</span>
                            <span className="comparison-arrow">→</span>
                          </div>
                          <div className="comparison-details">
                            <div className="dollar-diff">
                              ${results.priceAnalysis.comparisons.psa9ToPsa10.dollarDiff.toFixed(2)}
                            </div>
                            <div className="percent-diff">
                              {results.priceAnalysis.comparisons.psa9ToPsa10.percentDiff > 0 ? '+' : ''}{results.priceAnalysis.comparisons.psa9ToPsa10.percentDiff.toFixed(1)}%
                            </div>
                          </div>
                          <div className="comparison-description">
                            PSA 10 premium over PSA 9
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Investment Insights */}
                  <div className="investment-insights">
                    <h4>💡 Investment Insights</h4>
                    <div className="insights-grid">
                      {results.priceAnalysis.raw.avgPrice > 0 && results.priceAnalysis.psa9.avgPrice > 0 && (
                        <div className="insight-card">
                          <div className="insight-icon">📈</div>
                          <div className="insight-content">
                            <strong>PSA 9 Value:</strong> {results.priceAnalysis.comparisons.rawToPsa9 ? 
                              `${results.priceAnalysis.comparisons.rawToPsa9.percentDiff.toFixed(0)}x more than raw` : 
                              'Data unavailable'
                            }
                          </div>
                        </div>
                      )}
                      
                      {results.priceAnalysis.raw.avgPrice > 0 && results.priceAnalysis.psa10.avgPrice > 0 && (
                        <div className="insight-card">
                          <div className="insight-icon">🚀</div>
                          <div className="insight-content">
                            <strong>PSA 10 Value:</strong> {results.priceAnalysis.comparisons.rawToPsa10 ? 
                              `${results.priceAnalysis.comparisons.rawToPsa10.percentDiff.toFixed(0)}x more than raw` : 
                              'Data unavailable'
                            }
                          </div>
                        </div>
                      )}
                      
                      {results.priceAnalysis.psa9.avgPrice > 0 && results.priceAnalysis.psa10.avgPrice > 0 && (
                        <div className="insight-card">
                          <div className="insight-icon">💎</div>
                          <div className="insight-content">
                            <strong>Grade Jump:</strong> {results.priceAnalysis.comparisons.psa9ToPsa10 ? 
                              `PSA 9 to 10 adds ${results.priceAnalysis.comparisons.psa9ToPsa10.percentDiff.toFixed(0)}% value` : 
                              'Data unavailable'
                            }
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Show sold results only if not viewing live listings */}
            {!showLiveListingsOnly && (
              <>
                <CardResults title="Raw Trading Cards" cards={results.results.raw} type="raw" sectionRef={rawRef} />
                <CardResults title="PSA 9 Trading Cards" cards={results.results.psa9} type="psa9" sectionRef={psa9Ref} />
                <CardResults title="PSA 10 Trading Cards" cards={results.results.psa10} type="psa10" sectionRef={psa10Ref} />
              </>
            )}
            {/* Live Listings Section */}
            {console.log('🔍 Rendering check:', { showLiveListingsOnly, liveListingsCategory, liveListingsLoading, liveListingsError, liveListingsLength: liveListings.length })}
            {showLiveListingsOnly && liveListingsCategory && (
              <div className="live-listings-section">
                <button className="back-to-sold-btn" onClick={handleBackToSoldResults}>
                  ← Back to Sold Results
                </button>
                <h3>Live eBay Listings for {liveListingsCategory === 'raw' ? 'Raw' : liveListingsCategory === 'psa9' ? 'PSA 9' : 'PSA 10'} Trading Cards</h3>
                
                {/* Filter Buttons */}
                <div className="live-listings-filters">
                  <button 
                    className={`filter-btn ${activeFilter === 'all' ? 'active' : ''}`}
                    onClick={() => {
                      setActiveFilter('all');
                      handleViewLiveListings(liveListingsCategory, null);
                    }}
                    disabled={liveListingsLoading}
                  >
                    All Listings
                  </button>
                  <button 
                    className={`filter-btn ${activeFilter === 'auction' ? 'active' : ''}`}
                    onClick={() => {
                      setActiveFilter('auction');
                      handleViewLiveListings(liveListingsCategory, 'auction');
                    }}
                    disabled={liveListingsLoading}
                  >
                    Auctions Only
                  </button>
                  <button 
                    className={`filter-btn ${activeFilter === 'fixed' ? 'active' : ''}`}
                    onClick={() => {
                      setActiveFilter('fixed');
                      handleViewLiveListings(liveListingsCategory, 'fixed');
                    }}
                    disabled={liveListingsLoading}
                  >
                    Buy It Now Only
                  </button>
                </div>

                {liveListingsLoading ? (
                  <p>Loading live listings...</p>
                ) : liveListingsError ? (
                  <p className="error-message">{liveListingsError}</p>
                ) : liveListings.length === 0 ? (
                  <div>
                    <p>No live listings found.</p>
                    <p>Debug info: Category: {liveListingsCategory}, Filter: {activeFilter}</p>
                    <p>Search query: {formData.searchQuery}</p>
                  </div>
                ) : (
                  <div className="live-listings-grid">
                    {liveListings
                      .sort((a, b) => new Date(b.itemCreationDate) - new Date(a.itemCreationDate))
                      .map((item, idx) => (
                      <div key={item.itemId || idx} className="live-listing-card">
                        <a href={item.itemWebUrl || '#'} target="_blank" rel="noopener noreferrer">
                          <img 
                            src={item.image?.imageUrl || item.image || '/placeholder-image.jpg'} 
                            alt={item.title || 'Trading Card'} 
                            className="live-listing-img"
                            onError={(e) => {
                              e.target.src = '/placeholder-image.jpg';
                            }}
                          />
                        </a>
                        <div className="live-listing-content">
                          <a href={item.itemWebUrl || '#'} target="_blank" rel="noopener noreferrer" className="live-listing-title">
                            {item.title || 'Untitled Item'}
                          </a>
                          <div className="live-listing-price">
                            {item.price && typeof item.price === 'object' && item.price.value 
                              ? `$${item.price.value} ${item.price.currency || 'USD'}` 
                              : item.price && typeof item.price === 'string'
                              ? item.price
                              : 'N/A'}
                          </div>
                          <div className={`live-listing-sale-type ${Array.isArray(item.buyingOptions) && item.buyingOptions.includes('AUCTION') ? 'auction' : 'fixed'}`}>
                            {Array.isArray(item.buyingOptions) && item.buyingOptions.includes('AUCTION') ? 'Auction' : 
                             Array.isArray(item.buyingOptions) && item.buyingOptions.includes('FIXED_PRICE') ? 'Buy It Now' : 'N/A'}
                          </div>
                          <div className="live-listing-date">
                            Listed: {item.itemCreationDate ? formatDate(item.itemCreationDate) : 'N/A'}
                          </div>
                          {item.seller && typeof item.seller === 'string' && (
                            <div className="live-listing-seller">
                              Seller: {item.seller}
                            </div>
                          )}
                          {item.condition && typeof item.condition === 'string' && (
                            <div className="live-listing-condition">
                              Condition: {item.condition}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
