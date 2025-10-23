import React, { useState, useEffect } from 'react';
import config from '../config';

const GemRateAnalysis = ({ cardName, searchResults }) => {
  const [gemrateData, setGemrateData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (cardName && cardName.trim()) {
      fetchGemRateData(cardName);
    }
  }, [cardName]);

  const fetchGemRateData = async (cardName) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${config.API_BASE_URL}/api/gemrate/search/${encodeURIComponent(cardName)}`);
      const data = await response.json();
      
      if (data.success && data.data.success) {
        setGemrateData(data.data);
      } else {
        setError('No GemRate data found for this card');
      }
    } catch (err) {
      console.error('GemRate fetch error:', err);
      setError('Failed to fetch GemRate data');
    } finally {
      setLoading(false);
    }
  };

  const analyzeInvestmentPotential = async () => {
    if (!searchResults || !gemrateData) return;
    
    setLoading(true);
    try {
      // Extract price data from search results
      const priceData = {
        raw: searchResults.raw?.map(card => card.price?.value).filter(Boolean) || [],
        psa9: searchResults.psa9?.map(card => card.price?.value).filter(Boolean) || [],
        psa10: searchResults.psa10?.map(card => card.price?.value).filter(Boolean) || []
      };

      const response = await fetch(`${config.API_BASE_URL}/api/gemrate/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          cardName: cardName,
          priceData: priceData
        })
      });
      
      const data = await response.json();
      if (data.success) {
        setGemrateData(prev => ({
          ...prev,
          investmentAnalysis: data.data
        }));
      }
    } catch (err) {
      console.error('Investment analysis error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !gemrateData) {
    return (
      <div style={{ 
        background: 'linear-gradient(135deg, #667eea, #764ba2)', 
        borderRadius: 12, 
        padding: '1.5rem', 
        marginBottom: '2rem',
        border: '2px solid #ffd700',
        boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
      }}>
        <div style={{ color: '#fff', textAlign: 'center' }}>
          🔍 Loading GemRate data...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        background: 'linear-gradient(135deg, #ff6b6b, #ee5a52)', 
        borderRadius: 12, 
        padding: '1.5rem', 
        marginBottom: '2rem',
        border: '2px solid #ffd700',
        boxShadow: '0 4px 12px rgba(255, 107, 107, 0.3)'
      }}>
        <div style={{ color: '#fff', textAlign: 'center' }}>
          ❌ {error}
        </div>
      </div>
    );
  }

  if (!gemrateData) {
    return null;
  }

  const { population, investmentAnalysis } = gemrateData;

  return (
    <div style={{ 
      background: 'linear-gradient(135deg, #667eea, #764ba2)', 
      borderRadius: 12, 
      padding: '1.5rem', 
      marginBottom: '2rem',
      border: '2px solid #ffd700',
      boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
    }}>
      <h3 style={{ 
        color: '#fff', 
        fontWeight: 800, 
        textShadow: '1px 1px 4px rgba(0,0,0,0.5)',
        marginBottom: '1rem',
        fontSize: '1.3rem'
      }}>
        📊 GemRate Population Analysis
      </h3>
      
      {population && (
        <div style={{ marginBottom: '1.5rem' }}>
          {/* Main PSA Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ background: 'rgba(255, 255, 255, 0.1)', padding: '0.5rem', borderRadius: 8 }}>
              <div style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 600 }}>Total Population</div>
              <div style={{ color: '#ffd700', fontSize: '1.2rem', fontWeight: 700 }}>{population.total?.toLocaleString() || 0}</div>
            </div>
            <div style={{ background: 'rgba(255, 255, 255, 0.1)', padding: '0.5rem', borderRadius: 8 }}>
              <div style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 600 }}>Gem Rate</div>
              <div style={{ color: '#ffd700', fontSize: '1.2rem', fontWeight: 700 }}>{population.gemRate ? population.gemRate.toFixed(2) : 0}%</div>
            </div>
            <div style={{ background: 'rgba(255, 255, 255, 0.1)', padding: '0.5rem', borderRadius: 8 }}>
              <div style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 600 }}>Gems+</div>
              <div style={{ color: '#ffd700', fontSize: '1.2rem', fontWeight: 700 }}>{population.gemsPlus?.toLocaleString() || 0}</div>
            </div>
            <div style={{ background: 'rgba(255, 255, 255, 0.1)', padding: '0.5rem', borderRadius: 8 }}>
              <div style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 600 }}>PSA 10</div>
              <div style={{ color: '#ffd700', fontSize: '1.2rem', fontWeight: 700 }}>{population.gemMint?.toLocaleString() || 0}</div>
            </div>
          </div>
          
          {/* Grade Breakdown */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '0.5rem', fontSize: '0.85rem', marginBottom: '1rem' }}>
            <div style={{ color: '#fff', textAlign: 'center', background: 'rgba(255, 255, 255, 0.05)', padding: '0.5rem', borderRadius: 6 }}>
              <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>PSA 9</div>
              <div style={{ color: '#ffd700', fontWeight: 700 }}>{population.grade9?.toLocaleString() || 0}</div>
            </div>
            <div style={{ color: '#fff', textAlign: 'center', background: 'rgba(255, 255, 255, 0.05)', padding: '0.5rem', borderRadius: 6 }}>
              <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>PSA 8</div>
              <div style={{ color: '#ffd700', fontWeight: 700 }}>{population.grade8?.toLocaleString() || 0}</div>
            </div>
            <div style={{ color: '#fff', textAlign: 'center', background: 'rgba(255, 255, 255, 0.05)', padding: '0.5rem', borderRadius: 6 }}>
              <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>PSA 7</div>
              <div style={{ color: '#ffd700', fontWeight: 700 }}>{population.grade7?.toLocaleString() || 0}</div>
            </div>
            <div style={{ color: '#fff', textAlign: 'center', background: 'rgba(255, 255, 255, 0.05)', padding: '0.5rem', borderRadius: 6 }}>
              <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>PSA 6</div>
              <div style={{ color: '#ffd700', fontWeight: 700 }}>{population.grade6?.toLocaleString() || 0}</div>
            </div>
            <div style={{ color: '#fff', textAlign: 'center', background: 'rgba(255, 255, 255, 0.05)', padding: '0.5rem', borderRadius: 6 }}>
              <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>PSA 5</div>
              <div style={{ color: '#ffd700', fontWeight: 700 }}>{population.grade5?.toLocaleString() || 0}</div>
            </div>
            <div style={{ color: '#fff', textAlign: 'center', background: 'rgba(255, 255, 255, 0.05)', padding: '0.5rem', borderRadius: 6 }}>
              <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>PSA 4</div>
              <div style={{ color: '#ffd700', fontWeight: 700 }}>{population.grade4?.toLocaleString() || 0}</div>
            </div>
          </div>

          {/* Card Info */}
          {(population.cardName || population.set || population.year) && (
            <div style={{ 
              background: 'rgba(255, 255, 255, 0.1)', 
              borderRadius: 8, 
              padding: '0.75rem',
              marginTop: '1rem'
            }}>
              <div style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem' }}>Card Information</div>
              {population.cardName && (
                <div style={{ color: '#ffd700', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                  <strong>Name:</strong> {population.cardName}
                </div>
              )}
              {population.set && (
                <div style={{ color: '#ffd700', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                  <strong>Set:</strong> {population.set}
                </div>
              )}
              {population.year && (
                <div style={{ color: '#ffd700', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                  <strong>Year:</strong> {population.year}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {investmentAnalysis && (
        <div style={{ 
          background: 'rgba(255, 255, 255, 0.1)', 
          borderRadius: 8, 
          padding: '1rem',
          marginTop: '1rem'
        }}>
          <h4 style={{ color: '#fff', marginBottom: '0.5rem' }}>💰 Investment Analysis</h4>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ color: '#fff' }}>Investment Score:</span>
            <span style={{ 
              color: investmentAnalysis.investmentScore >= 70 ? '#4caf50' : 
                     investmentAnalysis.investmentScore >= 50 ? '#ff9800' : '#f44336',
              fontWeight: 700,
              fontSize: '1.1rem'
            }}>
              {investmentAnalysis.investmentScore}/100
            </span>
          </div>
          <div style={{ color: '#ffd700', fontWeight: 600, textAlign: 'center' }}>
            {investmentAnalysis.recommendation}
          </div>
        </div>
      )}

      {!investmentAnalysis && searchResults && (
        <div style={{ textAlign: 'center', marginTop: '1rem' }}>
          <button
            onClick={analyzeInvestmentPotential}
            disabled={loading}
            style={{
              background: '#ffd700',
              color: '#000',
              border: 'none',
              borderRadius: 6,
              padding: '0.5rem 1rem',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? 'Analyzing...' : '💰 Analyze Investment Potential'}
          </button>
        </div>
      )}
    </div>
  );
};

export default GemRateAnalysis;
