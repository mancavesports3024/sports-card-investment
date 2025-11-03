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

  // Debug image
  console.log('🖼️ BaseballFieldCard - Image data:', {
    imageUrl: card.imageUrl,
    image: card.image,
    hasImageUrl: !!card.imageUrl,
    hasImage: !!card.image
  });

  return (
    <div className="baseball-field-card">
      <div className="baseball-field">
        {/* Baseball field elements */}
        <div className="foul-line first"></div>
        <div className="foul-line third"></div>
        <div className="base-marker first"></div>
        <div className="base-marker second"></div>
        <div className="base-marker third"></div>
        <div className="base-marker home"></div>
        <div className="pitchers-mound"></div>

        {/* Top Tile - PSA 10 (Outfield) */}
        <div className="tile tile-psa10">
          <div className="tile-label">PSA 10</div>
          <div className="tile-value">{formatPrice(psa10Price)}</div>
          {psa10Pop > 0 && (
            <div className="tile-info">Pop: {psa10Pop.toLocaleString()}</div>
          )}
          {psa10Profit !== null && (
            <div className={`profit-badge ${psa10Profit >= 0 ? 'profit' : 'loss'}`}>
              {psa10Profit >= 0 ? '+' : ''}{psa10Profit}%
            </div>
          )}
        </div>

        {/* Middle Row */}
        <div className="middle-row">
          {/* Left Tile - Gem Rate (Third Base) */}
          <div className="tile tile-gemrate">
            <div className="tile-label">GEM RATE</div>
            <div className="tile-value">{gemRate > 0 ? `${gemRate}%` : 'N/A'}</div>
            {totalGraded > 0 && (
              <div className="tile-info">TOTAL: {totalGraded.toLocaleString()}</div>
            )}
          </div>

          {/* Center Tile - Card Image (Pitcher's Mound) */}
          <div className="tile tile-card">
            <div className="card-image-container">
              {(() => {
                const imageSrc = card.imageUrl || card.image;
                const isValidImage = imageSrc && 
                                   typeof imageSrc === 'string' && 
                                   (imageSrc.startsWith('http://') || imageSrc.startsWith('https://'));
                
                console.log('🖼️ Card Image Check:', { 
                  imageSrc, 
                  isValidImage,
                  imageUrlExists: !!card.imageUrl,
                  imageExists: !!card.image,
                  cardKeys: Object.keys(card)
                });
                
                if (isValidImage) {
                  return (
                    <img 
                      src={imageSrc}
                      alt={card.title || card.summaryTitle || 'Card'}
                      className="card-image"
                      onError={(e) => {
                        console.error('❌ Image failed to load:', imageSrc);
                        e.target.style.display = 'none';
                      }}
                      onLoad={() => {
                        console.log('✅ Image loaded successfully:', imageSrc);
                      }}
                    />
                  );
                }
                
                return (
                  <div className="card-placeholder">
                    <div className="card-placeholder-icon">⚾</div>
                    <div className="card-placeholder-text">Card Image</div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Right Tile - PSA 9 (First Base) */}
          <div className="tile tile-psa9">
            <div className="tile-label">PSA 9</div>
            <div className="tile-value">{formatPrice(psa9Price)}</div>
            {psa9Pop > 0 && (
              <div className="tile-info">Pop: {psa9Pop.toLocaleString()}</div>
            )}
            {psa9Profit !== null && (
              <div className={`profit-badge ${psa9Profit >= 0 ? 'profit' : 'loss'}`}>
                {psa9Profit >= 0 ? '+' : ''}{psa9Profit}%
              </div>
            )}
          </div>
        </div>

        {/* Bottom Tile - RAW (Home Plate) */}
        <div className="tile tile-raw">
          <div className="tile-label">RAW</div>
          <div className="tile-value">{formatPrice(rawPrice)}</div>
        </div>
      </div>
    </div>
  );
};

export default BaseballFieldCard;
