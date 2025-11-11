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

  // Extract card information - prioritize gemrate data, fallback to title parsing
  const extractCardInfo = (title, cardData, gemrateData) => {
    // First, try to get card details from gemrate data (most reliable)
    if (gemrateData) {
      const gemrateName = gemrateData.cardName || gemrateData.player || '';
      const gemrateSet = gemrateData.set || '';
      const gemrateYear = gemrateData.year ? String(gemrateData.year) : '';
      
      // If we have gemrate data, use it (even if some fields are empty)
      if (gemrateName || gemrateSet || gemrateYear) {
        return {
          name: gemrateName || 'Unknown',
          set: gemrateSet || 'Unknown',
          year: gemrateYear || 'N/A'
        };
      }
    }
    
    // Fallback to title parsing if no gemrate data
    if (!title) return { name: '', set: '', year: '' };
    
    // Try multiple sources for year
    let year = '';
    
    // 1. Try from title (4-digit year)
    const yearMatch = title.match(/\b(19|20)\d{2}\b/);
    if (yearMatch) {
      year = yearMatch[0];
    }
    
    // 2. Try from card data properties
    if (!year) {
      if (cardData?.year) {
        year = String(cardData.year);
      } else if (cardData?.cardYear) {
        year = String(cardData.cardYear);
      }
    }
    
    // 3. Try to extract from search query if available
    if (!year && cardData?.searchQuery) {
      const searchYearMatch = cardData.searchQuery.match(/\b(19|20)\d{2}\b/);
      if (searchYearMatch) {
        year = searchYearMatch[0];
      }
    }
    
    // For Pokemon cards, try to extract name and set
    // Pattern: "Name" followed by "Set" or vice versa
    let name = '';
    let set = '';
    
    // Try to find card name (usually before set name, or standalone)
    // Remove year, PSA/grade info, and common words
    const cleaned = title
      .replace(/\b(19|20)\d{2}\b/g, '')
      .replace(/\bPSA\s*\d+\b/gi, '')
      .replace(/\bBGS\s*\d+\b/gi, '')
      .replace(/\b(GEM|MINT|NM|NEAR MINT)\b/gi, '')
      .replace(/\bGRADED\b/gi, '')
      .trim();
    
    // Common Pokemon patterns
    const pokemonPattern = /(?:^|\s)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\s+(EX|GX|V|VMAX|VSTAR|RARE))?)/i;
    const pokemonMatch = cleaned.match(pokemonPattern);
    if (pokemonMatch) {
      name = pokemonMatch[1].trim();
    } else {
      // Fallback: take first significant words as name
      const words = cleaned.split(/\s+/).filter(w => w.length > 2);
      name = words.slice(0, 3).join(' ') || cleaned;
    }
    
    // Extract set name (usually contains terms like "Set", "Series", collection names)
    const setPatterns = [
      /(?:Pokemon|Pokémon)?\s*(Japanese|English)?\s*([A-Z0-9][A-Za-z0-9\s\-]+(?:\s+(Set|Series|Collection|Premier|Crown|Zenith|Inferno|etc)))/i,
      /([A-Z][A-Z0-9\-\s]+(?:Set|Series|Collection|Pack))/i,
      /([A-Z0-9][A-Za-z0-9\s\-]{5,})/i
    ];
    
    for (const pattern of setPatterns) {
      const match = cleaned.match(pattern);
      if (match && match[0].length > 5 && !match[0].includes(name)) {
        set = match[0].trim();
        break;
      }
    }
    
    // If no set found, try to extract from remaining text
    if (!set && cleaned.length > name.length) {
      const remaining = cleaned.replace(name, '').trim();
      if (remaining.length > 3) {
        set = remaining.split(/\s+/).slice(0, 5).join(' ');
      }
    }
    
    return { name: name || 'Unknown', set: set || 'Unknown', year: year || 'N/A' };
  };

  const cardInfo = extractCardInfo(card.title || card.summaryTitle || '', card, gemrateData);

  const truncateText = (value, maxLength = 28) => {
    if (!value) return '';
    const trimmed = String(value).trim();
    return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength - 3)}...` : trimmed;
  };

  // Format price
  const formatPrice = (price) => {
    if (!price || price === 0) return 'N/A';
    return `$${Number(price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Format timestamp
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    try {
      const date = new Date(timestamp);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch (e) {
      return '';
    }
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

        {/* Card Information - Top, above PSA 10 */}
        <div className="card-info-top">
          <span className="card-info-top-text">Name: {truncateText(cardInfo.name, 26)}</span>
          <span className="card-info-top-text">Set: {truncateText(cardInfo.set, 32)}</span>
          <span className="card-info-top-text">Year: {truncateText(cardInfo.year, 8)}</span>
        </div>

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
            <div className="tile-value">{gemrateData?.gemRate > 0 ? `${gemrateData.gemRate.toFixed(2)}%` : 'N/A'}</div>
            {gemrateData?.total > 0 && (
              <div className="tile-info">TOTAL: {gemrateData.total.toLocaleString()}</div>
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

        {/* Timestamp - Bottom of card */}
        {card.createdAt && (
          <div className="card-timestamp">
            Created: {formatTimestamp(card.createdAt)}
          </div>
        )}

      </div>
    </div>
  );
};

export default BaseballFieldCard;
