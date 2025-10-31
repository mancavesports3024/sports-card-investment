import React from 'react';
import './BaseballFieldCard.css';

const BaseballFieldCard = ({ card }) => {
  // Extract pricing data
  const rawPrice = card.rawAveragePrice || card.raw?.averagePrice || 0;
  const psa9Price = card.psa9AveragePrice || card.psa9?.averagePrice || 0;
  const psa10Price = card.psa10Price || card.psa10?.averagePrice || 0;

  // Extract gemrate data
  const gemrateData = card.gemrateData || card.population || null;
  const psa10Pop = gemrateData?.perfect || gemrateData?.grade10 || gemrateData?.psa10Population || 0;
  const psa9Pop = gemrateData?.grade9 || gemrateData?.psa9Population || 0;
  const gemRate = gemrateData?.gemRate || 0;
  const totalGraded = gemrateData?.total || 0;

  // Format price
  const formatPrice = (price) => {
    if (!price || price === 0) return 'N/A';
    return `$${Number(price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Calculate profit/loss percentages (assuming grading cost of $18.99)
  const gradingCost = 18.99;
  const psa10Profit = rawPrice > 0 ? (((psa10Price - rawPrice - gradingCost) / rawPrice) * 100).toFixed(1) : null;
  const psa9Profit = rawPrice > 0 ? (((psa9Price - rawPrice - gradingCost) / rawPrice) * 100).toFixed(1) : null;

  return (
    <div className="baseball-field-card">
      <div className="baseball-field">
        {/* Outfield - Top */}
        <div className="field-section outfield-top">
          <div className="price-label">PSA 10</div>
          <div className="price-value">{formatPrice(psa10Price)}</div>
          {psa10Pop > 0 && (
            <div className="population-info">Pop: {psa10Pop.toLocaleString()}</div>
          )}
          {psa10Profit !== null && (
            <div className={`profit-badge ${psa10Profit >= 0 ? 'profit' : 'loss'}`}>
              {psa10Profit >= 0 ? '+' : ''}{psa10Profit}%
            </div>
          )}
        </div>

        {/* Left Field */}
        <div className="field-section left-field">
          <div className="gemrate-info">
            <div className="gemrate-label">Gem Rate</div>
            <div className="gemrate-value">{gemRate > 0 ? `${gemRate}%` : 'N/A'}</div>
          </div>
        </div>

        {/* Center Field - Card Image */}
        <div className="field-section center-field">
          <div className="card-image-container">
            {card.imageUrl || card.image ? (
              <img 
                src={card.imageUrl || card.image} 
                alt={card.title || card.summaryTitle || 'Card'}
                className="card-image"
              />
            ) : (
              <div className="card-placeholder">
                <div className="card-placeholder-icon">⚾</div>
                <div className="card-placeholder-text">Card Image</div>
              </div>
            )}
            <div className="card-title-overlay">
              {card.summaryTitle || card.title || 'Card Title'}
            </div>
          </div>
        </div>

        {/* Right Field */}
        <div className="field-section right-field">
          <div className="total-graded-info">
            <div className="total-label">Total Graded</div>
            <div className="total-value">{totalGraded > 0 ? totalGraded.toLocaleString() : 'N/A'}</div>
          </div>
        </div>

        {/* Infield - Bottom */}
        <div className="field-section infield-bottom">
          <div className="price-row">
            <div className="price-item">
              <div className="price-label">RAW</div>
              <div className="price-value">{formatPrice(rawPrice)}</div>
            </div>
            <div className="price-item">
              <div className="price-label">PSA 9</div>
              <div className="price-value">{formatPrice(psa9Price)}</div>
              {psa9Pop > 0 && (
                <div className="population-info">Pop: {psa9Pop.toLocaleString()}</div>
              )}
              {psa9Profit !== null && (
                <div className={`profit-badge ${psa9Profit >= 0 ? 'profit' : 'loss'}`}>
                  {psa9Profit >= 0 ? '+' : ''}{psa9Profit}%
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Baseball Diamond Lines */}
        <svg className="diamond-overlay" viewBox="0 0 400 400" preserveAspectRatio="none">
          {/* Base paths */}
          <line x1="200" y1="200" x2="150" y2="150" className="diamond-line" />
          <line x1="200" y1="200" x2="250" y2="150" className="diamond-line" />
          <line x1="200" y1="200" x2="150" y2="250" className="diamond-line" />
          <line x1="200" y1="200" x2="250" y2="250" className="diamond-line" />
          {/* Home plate */}
          <polygon points="200,200 190,210 210,210" className="home-plate" />
        </svg>
      </div>
    </div>
  );
};

export default BaseballFieldCard;
