import React, { useState, useEffect } from 'react';
import config from '../config';

const SearchPage = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);

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
    if (!searchQuery.trim()) return;

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
          searchQuery: searchQuery.trim(),
          numSales: 25
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setResults(data);

      // If user is logged in, save search to history
      if (isLoggedIn) {
        try {
          await fetch(config.getSearchHistoryUrl(), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${localStorage.getItem('authToken')}`
            },
            body: JSON.stringify({
              searchQuery: searchQuery.trim(),
              results: data.results,
              priceAnalysis: data.priceAnalysis
            })
          });
        } catch (historyError) {
          console.error('Failed to save search history:', historyError);
          // Don't show error to user for history saving
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
    if (!price || !price.value) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',   currency: price.currency || 'USD'
    }).format(price.value);
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

    return (
      <div className="card-section">
        <h3>{icon} {title} ({cards.length})</h3>
        <div className="cards-grid">
          {cards.map((card, index) => (
            <div key={`${card.id || index}-${card.title}`} className="card-item">
              <div className="card-details">
                <div className="card-title">{card.title}</div>
                <div className="card-price">{formatPrice(card.price)}</div>
                <div className="card-date">Sold: {formatDate(card.soldDate)}</div>
                {card.condition && (
                  <div className="card-condition">Condition: {card.condition}</div>
                )}
                {card.itemWebUrl && (
                  <a 
                    href={card.itemWebUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="live-listings-btn"
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

    return (
      <div className="price-analysis">
        <h3>📊 Price Analysis</h3>
        <div className="analysis-grid">
          {analysis.raw && (
            <div className="analysis-item">
              <h4>Raw Cards</h4>
              <p>Average: {formatPrice({ value: analysis.raw.average })}</p>
              <p>Range: {formatPrice({ value: analysis.raw.min })} - {formatPrice({ value: analysis.raw.max })}</p>
            </div>
          )}
          {analysis.psa9 && (
            <div className="analysis-item">
              <h4>PSA 9</h4>
              <p>Average: {formatPrice({ value: analysis.psa9 })}</p>
              <p>Range: {formatPrice({ value: analysis.psa9.min })} - {formatPrice({ value: analysis.psa9.max })}</p>
            </div>
          )}
          {analysis.psa10 && (
            <div className="analysis-item">
              <h4>PSA 10</h4>
              <p>Average: {formatPrice({ value: analysis.psa10 })}</p>
              <p>Range: {formatPrice({ value: analysis.psa10.min })} - {formatPrice({ value: analysis.psa10.max })}</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="App">
      {/* Header */}
      <header className="App-header">
        <div className="header-content">
          <div className="header-top">
            <div className="social-icons">
              <a href="https://twitter.com/scorecard" className="social-icon x" target="_blank" rel="noopener noreferrer">                𝕏
              </a>
              <a href="https://instagram.com/scorecard" className="social-icon" target="_blank" rel="noopener noreferrer">                📷
              </a>
            </div>
          </div>
          <div className="header-center">
            <h1>Scorecard</h1>          <p>Track Sports Card Values Like a Pro</p>
          </div>
          <div className="header-ebay-link">
            <a href="https://ebay.com" className="header-ebay-ad" target="_blank" rel="noopener noreferrer">             <span>🛒</span>
              <span>eBay Store</span>
            </a>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="App-main">
        {/* Search Form */}
        <form onSubmit={handleSearch} className="search-form">
          <div className="form-group">
            <label htmlFor="searchQuery">Search for a card:</label>
            <input
              type="text"
              id="searchQuery"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="e.g., Mike Trout 211opps Update Rookie"
              required
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