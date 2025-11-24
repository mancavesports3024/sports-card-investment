import React, { useState, useEffect } from 'react';
import './ScoreCardSummary.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://web-production-9efa.up.railway.app';

const ScoreCardSummary = ({ card, setInfo, onBack }) => {
  const [cardData, setCardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (card) {
      fetchCardData();
    }
  }, [card]);

  const fetchCardData = async () => {
    setLoading(true);
    setError('');
    try {
      // Build search query from card info
      const searchQuery = buildSearchQuery();
      console.log('🔍 Fetching card data for:', searchQuery);

      // Validate search query
      if (!searchQuery || searchQuery.trim().length === 0) {
        setError('Unable to build search query. Missing required information.');
        setLoading(false);
        return;
      }

      // Fetch comprehensive card data
      const response = await fetch(`${API_BASE_URL}/api/add-comprehensive-card`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: searchQuery.trim(),
          sport: setInfo?.sport || 'Baseball',
          maxResults: 20
        }),
      });

      const data = await response.json();
      if (data.success) {
        setCardData(data);
      } else {
        setError(data.error || 'Failed to fetch card data');
      }
    } catch (err) {
      console.error('Error fetching card data:', err);
      setError('Error fetching card data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const buildSearchQuery = () => {
    // Build a search query in format: "2025 Topps Series 1 Player Name Rainbow Foil"
    const parts = [];
    
    // Year first
    if (setInfo?.year) parts.push(setInfo.year);
    
    // Set name (e.g., "Topps Series 1")
    if (setInfo?.setName) parts.push(setInfo.setName);
    
    // Player name
    if (card?.player) parts.push(card.player);
    
    // Parallel type last (e.g., "Rainbow Foil")
    if (setInfo?.parallel && setInfo.parallel !== 'Base Checklist') {
      parts.push(setInfo.parallel);
    }
    
    const query = parts.join(' ');
    console.log('🔍 Built search query:', query);
    return query;
  };

  const formatPrice = (price) => {
    if (!price || price === 0) return 'N/A';
    return `$${Number(price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const calculatePercentageChange = (psaPrice, rawPrice) => {
    if (!psaPrice || !rawPrice || rawPrice === 0) return null;
    const change = ((psaPrice - rawPrice) / rawPrice) * 100;
    return change > 0 ? `+${change.toFixed(1)}%` : `${change.toFixed(1)}%`;
  };

  const calculateGemRate = () => {
    if (!cardData?.psa10Population || !cardData?.totalPopulation) return null;
    const rate = (cardData.psa10Population / cardData.totalPopulation) * 100;
    return rate.toFixed(1);
  };

  if (loading) {
    return (
      <div className="score-card-summary">
        <div className="loading">Loading card data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="score-card-summary">
        <div className="error-message">{error}</div>
        <button onClick={onBack} className="back-btn">← Back to Checklist</button>
      </div>
    );
  }

  if (!cardData) {
    return (
      <div className="score-card-summary">
        <div className="error-message">No card data available</div>
        <button onClick={onBack} className="back-btn">← Back to Checklist</button>
      </div>
    );
  }

  const psa10Price = cardData.psa10AveragePrice || cardData.psa10Cards?.[0]?.numericPrice || 0;
  const psa9Price = cardData.psa9AveragePrice || cardData.psa9Cards?.[0]?.numericPrice || 0;
  const rawPrice = cardData.rawAveragePrice || cardData.rawCards?.[0]?.numericPrice || 0;
  const psa10Pop = cardData.psa10Population || 0;
  const psa9Pop = cardData.psa9Population || 0;
  const totalPop = cardData.totalPopulation || (psa10Pop + psa9Pop);
  const gemRate = calculateGemRate();

  return (
    <div className="score-card-summary">
      <div className="score-card-header">
        <button onClick={onBack} className="back-btn">← Back to Checklist</button>
        <h1>{setInfo?.setName || 'Card Summary'}</h1>
        <h2>{card?.player || 'Unknown Player'}</h2>
        {card?.number && <h3>#{card.number}</h3>}
      </div>

      <div className="score-card-content">
        {/* Card Image Section */}
        <div className="card-image-section">
          {cardData.cardImage ? (
            <img src={cardData.cardImage} alt={card?.player} className="card-image" />
          ) : (
            <div className="card-image-placeholder">
              <p>Card Image</p>
              <p>Not Available</p>
            </div>
          )}
        </div>

        {/* Price Information Boxes */}
        <div className="price-boxes">
          {/* PSA 10 Box */}
          <div className="price-box psa10-box">
            <div className="price-label">PSA 10</div>
            <div className="price-value">{formatPrice(psa10Price)}</div>
            <div className="price-population">Pop: {psa10Pop.toLocaleString()}</div>
            {rawPrice > 0 && (
              <div className="price-comparison positive">
                {calculatePercentageChange(psa10Price, rawPrice)} vs Raw
              </div>
            )}
          </div>

          {/* PSA 9 Box */}
          <div className="price-box psa9-box">
            <div className="price-label">PSA 9</div>
            <div className="price-value">{formatPrice(psa9Price)}</div>
            <div className="price-population">Pop: {psa9Pop.toLocaleString()}</div>
            {rawPrice > 0 && (
              <div className="price-comparison positive">
                {calculatePercentageChange(psa9Price, rawPrice)} vs Raw
              </div>
            )}
          </div>

          {/* Raw Box */}
          <div className="price-box raw-box">
            <div className="price-label">RAW</div>
            <div className="price-value">{formatPrice(rawPrice)}</div>
            <div className="price-description">Average recent ungraded sale price</div>
          </div>

          {/* Gem Rate Box */}
          <div className="price-box gem-rate-box">
            <div className="price-label">GEM RATE</div>
            <div className="gem-rate-value">{gemRate ? `${gemRate}%` : 'N/A'}</div>
            <div className="price-population">Total Pop: {totalPop.toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="score-card-footer">
        <div className="footer-date">
          Created: {new Date().toLocaleString('en-US', { 
            month: 'short', 
            day: 'numeric', 
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
          })}
        </div>
        <div className="footer-website">MANCAVESPORTSCARDSLLC.COM</div>
      </div>
    </div>
  );
};

export default ScoreCardSummary;

