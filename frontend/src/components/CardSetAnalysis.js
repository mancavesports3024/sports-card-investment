import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import config from '../config';
import FeaturedEbayRotator from './FeaturedEbayRotator';
import PageLayout from './PageLayout';

const CardSetAnalysis = () => {
  const [cardSet, setCardSet] = useState('');
  const [year, setYear] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('value'); // 'value' or 'volume'
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState(-1);

  // Fetch card set suggestions
  const fetchSuggestions = async (query) => {
    if (!query.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    try {
      const params = new URLSearchParams({
        query: query.trim(),
        limit: 10
      });

      const response = await fetch(`${config.API_BASE_URL}/api/search-cards/card-set-suggestions?${params}`);
      const data = await response.json();

      if (response.ok) {
        setSuggestions(data.suggestions || []);
        setShowSuggestions(true);
        setSelectedSuggestion(-1);
      }
    } catch (err) {
      console.error('Failed to fetch suggestions:', err);
    }
  };

  // Handle card set input change
  const handleCardSetChange = (e) => {
    const value = e.target.value;
    setCardSet(value);
    fetchSuggestions(value);
  };

  // Handle suggestion selection
  const handleSuggestionClick = (suggestion) => {
    setCardSet(suggestion.name);
    setShowSuggestions(false);
    setSuggestions([]);
  };

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (!showSuggestions) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedSuggestion(prev => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedSuggestion(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedSuggestion >= 0 && suggestions[selectedSuggestion]) {
          handleSuggestionClick(suggestions[selectedSuggestion]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSuggestions([]);
        break;
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!cardSet.trim()) return;

    setIsLoading(true);
    setError(null);
    setResults(null);
    setShowSuggestions(false);

    try {
      const params = new URLSearchParams({
        cardSet: cardSet.trim(),
        limit: 2000
      });
      
      if (year.trim()) {
        params.append('year', year.trim());
      }

      const response = await fetch(`${config.API_BASE_URL}/api/search-cards/card-set-analysis?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze card set');
      }

      setResults(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const formatPrice = (price) => {
    if (price == null || price.value == null || isNaN(price.value)) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: price.currency || 'USD'
    }).format(Number(price.value));
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const renderCardItem = (card, index) => (
    <div key={card.id || index} style={{
      background: '#fff',
      border: '1px solid #e0e0e0',
      borderRadius: 8,
      padding: '1rem',
      marginBottom: '0.75rem',
      display: 'flex',
      alignItems: 'center',
      gap: '1rem',
      boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
      transition: 'transform 0.2s ease',
      cursor: 'pointer'
    }} onMouseEnter={(e) => e.target.style.transform = 'translateY(-2px)'}
       onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}>
      {card.image && (
        <img 
          src={card.image} 
          alt={card.title} 
          style={{ 
            width: 80, 
            height: 80, 
            objectFit: 'cover', 
            borderRadius: 6,
            border: '1px solid #e0e0e0'
          }} 
        />
      )}
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '0.25rem', color: '#333' }}>
          {card.title}
        </div>
        <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '0.5rem' }}>
          {card.condition && <span style={{ marginRight: '1rem' }}>Condition: {card.condition}</span>}
          {card.soldDate && <span>Sold: {formatDate(card.soldDate)}</span>}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#000' }}>
            {formatPrice(card.price)}
          </div>
          <a 
            href={card.itemWebUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            style={{
              background: '#ffd700',
              color: '#000',
              fontWeight: 600,
              padding: '0.5rem 1rem',
              borderRadius: 6,
              textDecoration: 'none',
              border: '2px solid #000',
              fontSize: '0.9rem'
            }}
          >
            View on eBay
          </a>
        </div>
      </div>
    </div>
  );

  const renderSalesVolumeCard = (card, index) => (
    <div key={`${card.playerName}-${card.cardNumber}-${index}`} style={{
      background: '#fff',
      border: '1px solid #e0e0e0',
      borderRadius: 8,
      padding: '1rem',
      marginBottom: '0.75rem',
      boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#333', marginBottom: '0.25rem' }}>
            {card.playerName} #{card.cardNumber}
          </div>
          <div style={{ fontSize: '0.9rem', color: '#666' }}>
            {card.title}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 700, fontSize: '1.2rem', color: '#000' }}>
            {card.salesCount} sales
          </div>
          <div style={{ fontSize: '0.9rem', color: '#666' }}>
            Avg: {formatPrice({ value: card.averagePrice })}
          </div>
        </div>
      </div>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <div style={{ fontSize: '0.9rem', color: '#666' }}>
          <div>High: {formatPrice({ value: card.highestPrice })}</div>
          <div>Low: {formatPrice({ value: card.lowestPrice })}</div>
        </div>
        <div style={{ fontSize: '0.9rem', color: '#666' }}>
          <div>Total: {formatPrice({ value: card.totalValue })}</div>
        </div>
      </div>

      {card.recentSales.length > 0 && (
        <div style={{ marginTop: '0.75rem' }}>
          <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.5rem', color: '#333' }}>
            Recent Sales:
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {card.recentSales.slice(0, 3).map((sale, saleIndex) => (
              <div key={saleIndex} style={{
                background: '#f8f9fa',
                padding: '0.5rem',
                borderRadius: 4,
                fontSize: '0.8rem',
                border: '1px solid #e9ecef'
              }}>
                <div style={{ fontWeight: 600 }}>{formatPrice({ value: sale.price })}</div>
                <div style={{ color: '#666' }}>{formatDate(sale.soldDate)}</div>
                {sale.condition && <div style={{ color: '#666' }}>{sale.condition}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderSummary = () => {
    if (!results?.summary) return null;

    const { summary } = results;
    return (
      <div style={{
        background: 'linear-gradient(135deg, #000 0%, #333 100%)',
        color: '#ffd700',
        padding: '1.5rem',
        borderRadius: 12,
        marginBottom: '2rem',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
      }}>
        <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.5rem', fontWeight: 700 }}>
          📊 {cardSet} {year && year} Analysis Summary
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.25rem', color: '#ffd700' }}>
              {summary.totalCards.toLocaleString()}
            </div>
            <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>Last Sales Analyzed</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.25rem' }}>
              {formatPrice({ value: summary.totalSales })}
            </div>
            <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>Total Sales Volume</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.25rem' }}>
              {formatPrice({ value: summary.averagePrice })}
            </div>
            <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>Average Price</div>
          </div>
          {summary.dateRange.earliest && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                {formatDate(summary.dateRange.earliest)}
              </div>
              <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>Earliest Sale</div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '2rem' }}>
      <Helmet>
        <title>Card Set Analysis - Trading Card Tracker</title>
        <meta name="description" content="Analyze specific card sets to find the most valuable and best-selling cards. Get insights on Topps, Bowman, and other popular card sets." />
      </Helmet>

      <PageLayout
        title="Card Set Analysis"
        subtitle="Discover the most valuable and best-selling cards from specific card sets like Topps 2025 Series One"
        icon="🃏"
      >
        {/* Welcome Message */}
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

      {/* Search Tips */}
      <div style={{
        background: 'linear-gradient(135deg, #ffd700, #ffed4e)',
        padding: '1.5rem',
        borderRadius: 12,
        marginBottom: '1.5rem',
        border: '2px solid #000'
      }}>
        <h3 style={{ margin: '0 0 1rem 0', color: '#000', fontSize: '1.2rem', fontWeight: 700 }}>
          💡 Search Tips
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', fontSize: '0.9rem', color: '#333' }}>
          <div>
            <strong>Popular Sets:</strong> Topps Series One, Bowman Chrome, Panini Prizm, Pokemon 151
          </div>
          <div>
            <strong>Search by Sport:</strong> Baseball, Basketball, Football, Hockey, Gaming
          </div>
          <div>
            <strong>Search by Brand:</strong> Topps, Bowman, Panini, Upper Deck, Pokemon
          </div>
          <div>
            <strong>Search by Type:</strong> Base Set, Premium Set, Prospect Set, Retro Set
          </div>
        </div>
      </div>

      <form onSubmit={handleSearch} style={{
        background: '#fff',
        padding: '2rem',
        borderRadius: 12,
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        marginBottom: '2rem'
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ position: 'relative' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: '#333' }}>
              Card Set
            </label>
            <input
              type="text"
              value={cardSet}
              onChange={handleCardSetChange}
              onKeyDown={handleKeyDown}
              onFocus={() => cardSet.trim() && setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              placeholder="e.g., Topps Series One, Bowman Chrome, Panini Prizm"
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '2px solid #e0e0e0',
                borderRadius: 8,
                fontSize: '1rem',
                outline: 'none'
              }}
              required
            />
            
            {/* Autocomplete Suggestions */}
            {showSuggestions && suggestions.length > 0 && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                background: '#fff',
                border: '2px solid #e0e0e0',
                borderTop: 'none',
                borderRadius: '0 0 8px 8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                zIndex: 1000,
                maxHeight: '300px',
                overflowY: 'auto'
              }}>
                {suggestions.map((suggestion, index) => (
                  <div
                    key={`${suggestion.name}-${suggestion.brand}`}
                    onClick={() => handleSuggestionClick(suggestion)}
                    style={{
                      padding: '0.75rem',
                      cursor: 'pointer',
                      borderBottom: index < suggestions.length - 1 ? '1px solid #f0f0f0' : 'none',
                      background: selectedSuggestion === index ? '#f8f9fa' : '#fff',
                      transition: 'background-color 0.2s ease'
                    }}
                    onMouseEnter={() => setSelectedSuggestion(index)}
                  >
                    <div style={{ fontWeight: 600, color: '#333', marginBottom: '0.25rem' }}>
                      {suggestion.name}
                    </div>
                    <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '0.25rem' }}>
                      {suggestion.brand} • {suggestion.sport || suggestion.category} • {suggestion.setType}
                    </div>
                    {suggestion.description && (
                      <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '0.25rem', fontStyle: 'italic' }}>
                        {suggestion.description.length > 80 ? suggestion.description.substring(0, 80) + '...' : suggestion.description}
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: '#999' }}>
                      <span>Years: {suggestion.years.join(', ')}</span>
                      {suggestion.popularity && (
                        <span style={{ 
                          background: suggestion.popularity >= 9 ? '#28a745' : suggestion.popularity >= 7 ? '#ffc107' : '#dc3545',
                          color: '#fff',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.7rem',
                          fontWeight: 'bold'
                        }}>
                          {suggestion.popularity}/10
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: '#333' }}>
              Year (Optional)
            </label>
            <input
              type="text"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder="e.g., 2025, 2024"
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '2px solid #e0e0e0',
                borderRadius: 8,
                fontSize: '1rem',
                outline: 'none'
              }}
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={isLoading || !cardSet.trim()}
          style={{
            background: isLoading ? '#ccc' : '#ffd700',
            color: '#000',
            border: '2px solid #000',
            borderRadius: 8,
            padding: '0.75rem 2rem',
            fontSize: '1rem',
            fontWeight: 700,
            cursor: isLoading ? 'not-allowed' : 'pointer',
            width: '100%'
          }}
        >
          {isLoading ? '🔍 Analyzing...' : '🔍 Analyze Card Set'}
        </button>
      </form>

      {error && (
        <div style={{
          background: '#fee',
          border: '1px solid #fcc',
          color: '#c33',
          padding: '1rem',
          borderRadius: 8,
          marginBottom: '2rem'
        }}>
          ❌ {error}
        </div>
      )}

      {results && (
        <>
          {/* Data Coverage Info */}
          <div style={{
            background: 'linear-gradient(135deg, #28a745, #20c997)',
            color: '#fff',
            padding: '1rem 1.5rem',
            borderRadius: 12,
            marginBottom: '2rem',
            textAlign: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
          }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              📊 Data Coverage
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem' }}>
              This search includes the last {results.summary?.totalCards?.toLocaleString() || '0'} sales
            </div>
            <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>
              Comprehensive analysis based on recent marketplace activity
            </div>
          </div>
        </>
      )}

      {results && (
        <>
          {renderSummary()}

          <div style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
              <button
                onClick={() => setActiveTab('value')}
                style={{
                  background: activeTab === 'value' ? '#ffd700' : '#f0f0f0',
                  color: activeTab === 'value' ? '#000' : '#666',
                  border: '2px solid #000',
                  borderRadius: 8,
                  padding: '0.75rem 1.5rem',
                  fontSize: '1rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                💎 Highest Value Cards
              </button>
              <button
                onClick={() => setActiveTab('volume')}
                style={{
                  background: activeTab === 'volume' ? '#ffd700' : '#f0f0f0',
                  color: activeTab === 'volume' ? '#000' : '#666',
                  border: '2px solid #000',
                  borderRadius: 8,
                  padding: '0.75rem 1.5rem',
                  fontSize: '1rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                📈 Most Sold Cards
              </button>
            </div>

            {activeTab === 'value' && (
              <div>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem', color: '#ffd700', textShadow: '1px 1px 2px rgba(0,0,0,0.5)' }}>
                  💎 Top 20 Highest Value Cards
                </h3>
                {results.topCardsByValue?.length > 0 ? (
                  results.topCardsByValue.map((card, index) => renderCardItem(card, index))
                ) : (
                  <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
                    No high-value cards found for this set.
                  </div>
                )}
              </div>
            )}

            {activeTab === 'volume' && (
              <div>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem', color: '#ffd700', textShadow: '1px 1px 2px rgba(0,0,0,0.5)' }}>
                  📈 Top 20 Most Sold Cards
                </h3>
                {results.topCardsBySalesVolume?.length > 0 ? (
                  results.topCardsBySalesVolume.map((card, index) => renderSalesVolumeCard(card, index))
                ) : (
                  <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
                    No sales volume data found for this set.
                  </div>
                )}
              </div>
            )}
          </div>

          {results.categorizedResults && (
            <div>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem', color: '#ffd700', textShadow: '1px 1px 2px rgba(0,0,0,0.5)' }}>
                📊 Cards by Grade
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
                {Object.entries(results.categorizedResults).map(([grade, cards]) => {
                  if (!cards || cards.length === 0) return null;
                  return (
                    <div key={grade} style={{
                      background: '#fff',
                      border: '1px solid #e0e0e0',
                      borderRadius: 8,
                      padding: '1rem'
                    }}>
                      <h4 style={{ 
                        fontSize: '1.1rem', 
                        fontWeight: 700, 
                        marginBottom: '0.75rem', 
                        color: '#333',
                        textTransform: 'uppercase'
                      }}>
                        {grade} ({cards.length})
                      </h4>
                      <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                        {cards.slice(0, 5).map((card, index) => (
                          <div key={index} style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '0.5rem 0',
                            borderBottom: index < cards.slice(0, 5).length - 1 ? '1px solid #f0f0f0' : 'none'
                          }}>
                            <div style={{ flex: 1, fontSize: '0.9rem' }}>
                              <div style={{ fontWeight: 600 }}>{card.title}</div>
                              <div style={{ color: '#666', fontSize: '0.8rem' }}>
                                {formatDate(card.soldDate)}
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontWeight: 700 }}>{formatPrice(card.price)}</div>
                              <a 
                                href={card.itemWebUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                style={{
                                  background: '#ffd700',
                                  color: '#000',
                                  padding: '0.25rem 0.5rem',
                                  borderRadius: 4,
                                  textDecoration: 'none',
                                  fontSize: '0.8rem',
                                  fontWeight: 600
                                }}
                              >
                                View
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
        </PageLayout>
    </div>
  );
};

export default CardSetAnalysis; 