import React, { useState, useEffect } from 'react';
import config from '../config';

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
          } catch (historyError) {
            console.error('Failed to save search history:', historyError);
            // Don't show error to user for history saving
          }
        }
      }
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
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const renderCardSection = (title, cards, icon) => {
    if (!cards || cards.length === 0) return null;

    // Build eBay live listings search URL
    const ebaySearchUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(title.replace(/\s+\(.+\)/, ''))}`;

    return (
      <div className="card-section">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <h3 style={{ margin: 0 }}>{icon} {title} ({cards.length})</h3>
          <a href={ebaySearchUrl} target="_blank" rel="noopener noreferrer" className="live-listings-btn" style={{ fontSize: '0.95em', padding: '0.3em 0.8em', background: '#ffd700', color: '#000', border: '1px solid #aaa', borderRadius: 5, textDecoration: 'none', marginLeft: 8 }}>View Live Listings</a>
        </div>
        <div className="cards-grid" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.7rem' }}>
          {cards.map((card, index) => (
            <div key={`${card.id || index}-${card.title}`} className="card-item" style={{ background: '#fff', border: '1px solid #eee', borderRadius: 7, boxShadow: '0 1px 4px rgba(0,0,0,0.03)', padding: '0.6rem 0.7rem', minWidth: 170, maxWidth: 210, fontSize: '0.97em', marginBottom: 0 }}>
              <div className="card-details" style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <div className="card-title" style={{ fontWeight: 600, fontSize: '1em', marginBottom: 2 }}>{card.title}</div>
                <div className="card-price" style={{ fontSize: '0.98em', color: '#222' }}>{formatPrice(card.price)}</div>
                <div className="card-date" style={{ fontSize: '0.93em', color: '#888' }}>Sold: {formatDate(card.soldDate)}</div>
                {card.condition && (
                  <div className="card-condition" style={{ fontSize: '0.93em', color: '#666' }}>Condition: {card.condition}</div>
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
          ))}
        </div>
      </div>
    );
  };

  const renderPriceAnalysis = (analysis) => {
    if (!analysis) return null;
    const tiles = [
      { key: 'raw', label: 'Raw Cards' },
      { key: 'psa9', label: 'PSA 9' },
      { key: 'psa10', label: 'PSA 10' }
    ];
    return (
      <div className="price-analysis">
        <h3>📊 Price Analysis</h3>
        <div className="analysis-grid" style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginTop: '0.5rem' }}>
          {tiles.map(({ key, label }) => {
            const item = analysis[key];
            if (!item) return null;
            return (
              <div key={key} className="analysis-item" style={{ background: '#fffbe6', border: '1.5px solid #ffd700', borderRadius: '8px', padding: '0.75rem 1.1rem', minWidth: 120, fontSize: '0.95rem', boxShadow: '0 1px 4px rgba(0,0,0,0.03)' }}>
                <h4 style={{ color: '#000', marginBottom: 4, fontSize: '1.05rem' }}>{label}</h4>
                <p style={{ margin: 0 }}>Avg: <strong>{formatPrice({ value: item.avgPrice })}</strong></p>
                <p style={{ margin: 0, fontSize: '0.93em' }}>Range: {formatPrice({ value: item.minPrice })} - {formatPrice({ value: item.maxPrice })}</p>
                <p style={{ margin: '0.3rem 0 0 0', color: '#888', fontSize: '0.93em' }}>Trend: <span style={{ color: item.trend === 'up' ? 'green' : item.trend === 'down' ? 'red' : '#888' }}>{item.trend.charAt(0).toUpperCase() + item.trend.slice(1)}</span></p>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="App">
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
        <form onSubmit={handleSearch} className="search-form">
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
          <div className="form-group">
            <button type="submit" disabled={isLoading} className="search-button">
              {isLoading ? '🔍 Searching...' : '🔍 Search Cards'}
            </button>
          </div>
        </form>

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
              <h2>📊 Search Results for "{results.searchParams.searchQuery}"</h2>              <div className="results-summary">
                <p>Found {results.sources?.total || 0} total sold items</p>
                {!isLoggedIn && (
                  <p className="save-note">💡 <a href="#" onClick={handleLogin}>Sign in</a> to save this search</p>
                )}
              </div>
            </div>

            {/* Price Analysis */}
            {renderPriceAnalysis(results.priceAnalysis)}

            {/* Chart Placeholder for Last Sales */}
            {results && results.results && (
              <div className="sales-chart" style={{ margin: '2rem auto', maxWidth: 700, background: '#fff', borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.04)', padding: '1.5rem', border: '1.5px solid #ffd700', textAlign: 'center' }}>
                <h3 style={{ color: '#000', marginBottom: 16 }}>Last Sales Chart</h3>
                {/* TODO: Insert chart here using a charting library like Chart.js or Recharts */}
                <div style={{ color: '#888', fontStyle: 'italic' }}>[Sales chart coming soon]</div>
              </div>
            )}

            {/* Card Sections */}
            {renderCardSection('Raw Cards', results.results.raw, '📄')}
            {renderCardSection('PSA 7', results.results.psa7, '🏆')}
            {renderCardSection('PSA 8', results.results.psa8, '🏆')}
            {renderCardSection('PSA 9', results.results.psa9, '🏆')}
            {renderCardSection('PSA 10', results.results.psa10, '🏆')}
            {renderCardSection('CGC 9', results.results.cgc9, '🏆')}
            {renderCardSection('CGC 10', results.results.cgc10, '🏆')}
            {renderCardSection('TAG 8', results.results.tag8, '🏆')}
            {renderCardSection('TAG 9', results.results.tag9, '🏆')}
            {renderCardSection('TAG 10', results.results.tag10, '🏆')}
            {renderCardSection('SGC 10', results.results.sgc10, '🏆')}
            {renderCardSection('AiGrade 9', results.results.aigrade9, '🤖')}
            {renderCardSection('AiGrade 10', results.results.aigrade10, '🤖')}
            {renderCardSection('Other Graded', results.results.otherGraded, '🏆')}
          </div>
        )}
      </main>
    </div>
  );
};

export default SearchPage; 