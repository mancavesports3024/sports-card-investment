import React, { useState, useEffect } from 'react';
import './ScoreCardSummary.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://web-production-9efa.up.railway.app';

const ScoreCardSummary = ({ card, setInfo, onBack }) => {
  const [cardData, setCardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [gemrateData, setGemrateData] = useState(null);

  useEffect(() => {
    if (card) {
      fetchCardData();
    }
  }, [card]);

  // Use PSA graded count from card prop if available, otherwise fetch from GemRate
  useEffect(() => {
    // If we already have psaGraded from the checklist, use it directly
    if (card?.psaGraded !== undefined && card?.psaGraded !== null) {
      console.log(`[ScoreCardSummary] Using PSA graded count from card prop: ${card.psaGraded}`);
      setGemrateData({
        perfect: card.psaGraded,
        gemMint: card.psaGraded,
        total: card.psaGraded
      });
    } else if (cardData?.searchQuery) {
      // Fallback: fetch from GemRate if not in card prop
      fetchGemrateData();
    }
  }, [card, cardData]);

  const fetchGemrateData = async () => {
    try {
      const searchQuery = cardData.searchQuery;
      // Clean the search query - remove exclusions for GemRate
      let cleanQuery = searchQuery;
      const exclusionIndex = cleanQuery.indexOf(' -(');
      if (exclusionIndex !== -1) {
        cleanQuery = cleanQuery.substring(0, exclusionIndex).trim();
      }
      
      console.log(`[ScoreCardSummary] Fetching GemRate data for: "${cleanQuery}"`);
      const response = await fetch(`${API_BASE_URL}/api/gemrate/search/${encodeURIComponent(cleanQuery)}`);
      const data = await response.json();
      console.log(`[ScoreCardSummary] GemRate response:`, data);
      
      // Check for population data in multiple possible locations
      const populationData = data.data?.population || data.data?.data?.population || data.data;
      
      if (data.success && data.data && data.data.success && populationData) {
        console.log(`[ScoreCardSummary] Setting GemRate data:`, populationData);
        setGemrateData(populationData);
      } else {
        console.log(`[ScoreCardSummary] GemRate data not available`);
        setGemrateData(null);
      }
    } catch (err) {
      console.error('[ScoreCardSummary] Failed to fetch gemrate data:', err);
      setGemrateData(null);
    }
  };

  // Filter raw cards (same logic as SearchPage)
  const filterRawCards = (cards) => {
    if (!Array.isArray(cards)) return [];
    // Only filter to valid, non-graded cards
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

  // Get card image (same logic as SearchPage)
  const getCardImage = (card) => {
    if (!card) return null;
    
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
    
    // Validate URL and prefer higher quality images
    if (imageUrl && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'))) {
      // Prefer full-size eBay images (s-l1600) over thumbnails
      if (imageUrl.includes('ebay') && imageUrl.includes('s-l') && !imageUrl.includes('s-l1600')) {
        imageUrl = imageUrl.replace(/s-l\d+/, 's-l1600');
      }
      return imageUrl;
    }
    
    return null;
  };

  const fetchCardData = async () => {
    setLoading(true);
    setError('');
    try {
      // Build search query from card info
      const searchQuery = buildSearchQuery();
      console.log('🔍 [ScoreCardSummary] Fetching card data for:', searchQuery);

      // Validate search query
      if (!searchQuery || searchQuery.trim().length === 0) {
        setError('Unable to build search query. Missing required information.');
        setLoading(false);
        return;
      }

      // Fetch search results (same as SearchPage)
      // Prepare headers with authentication if available
      const headers = {
        'Content-Type': 'application/json',
      };
      
      // Add authentication token if user is logged in (same as SearchPage)
      const token = localStorage.getItem('authToken');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(`${API_BASE_URL}/api/search-cards`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          searchQuery: searchQuery.trim(),
          numSales: 200
        }),
      });

      const data = await response.json();
      if (data.results) {
        // Filter out parallels if this is a base card
        const isBaseCard = !card?.team || card.team.toLowerCase() === 'base';
        const excludeParallels = isBaseCard;
        
        // Helper to check if a card title contains parallel keywords
        const isParallel = (title) => {
          if (!title) return false;
          const lowerTitle = title.toLowerCase();
          const parallelKeywords = [
            'silver', 'gold', 'rainbow', 'refractor', 'prizm', 'chrome', 'foil',
            'holo', 'autograph', 'auto', 'patch', 'relic', 'numbered', '/', '#' 
          ];
          // If it's a base card search, exclude anything with parallel keywords
          // But allow "prizm" if it's part of the set name (e.g., "2024 Prizm")
          return parallelKeywords.some(keyword => {
            if (keyword === 'prizm' && lowerTitle.includes('prizm')) {
              // Only exclude if it's clearly a parallel (e.g., "Silver Prizm", "Gold Prizm")
              return lowerTitle.includes('silver prizm') || 
                     lowerTitle.includes('gold prizm') ||
                     lowerTitle.includes('rainbow prizm') ||
                     (lowerTitle.includes('prizm') && !lowerTitle.match(/\d{4}\s+prizm/i));
            }
            return lowerTitle.includes(keyword);
          });
        };
        
        // Process results the same way SearchPage does
        let rawCards = filterRawCards(data.results.raw || []);
        let psa9Cards = (data.results.psa9 || []).filter(card => !isNaN(Number(card.price?.value)) && Number(card.price?.value) > 0);
        let psa10Cards = (data.results.psa10 || []).filter(card => !isNaN(Number(card.price?.value)) && Number(card.price?.value) > 0);
        
        // Filter out parallels if this is a base card
        if (excludeParallels) {
          const beforeRaw = rawCards.length;
          const beforePsa9 = psa9Cards.length;
          const beforePsa10 = psa10Cards.length;
          
          rawCards = rawCards.filter(card => !isParallel(card.title));
          psa9Cards = psa9Cards.filter(card => !isParallel(card.title));
          psa10Cards = psa10Cards.filter(card => !isParallel(card.title));
          
          console.log(`[ScoreCardSummary] Filtered parallels: Raw ${beforeRaw}→${rawCards.length}, PSA9 ${beforePsa9}→${psa9Cards.length}, PSA10 ${beforePsa10}→${psa10Cards.length}`);
        }

        // Calculate average prices
        const rawPrices = rawCards.map(card => Number(card.price?.value)).filter(v => !isNaN(v) && v > 0);
        const psa9Prices = psa9Cards.map(card => Number(card.price?.value)).filter(v => !isNaN(v) && v > 0);
        const psa10Prices = psa10Cards.map(card => Number(card.price?.value)).filter(v => !isNaN(v) && v > 0);

        const rawAvg = rawPrices.length > 0 ? rawPrices.reduce((a, b) => a + b, 0) / rawPrices.length : 0;
        const psa9Avg = psa9Prices.length > 0 ? psa9Prices.reduce((a, b) => a + b, 0) / psa9Prices.length : 0;
        const psa10Avg = psa10Prices.length > 0 ? psa10Prices.reduce((a, b) => a + b, 0) / psa10Prices.length : 0;

        // Get card image - prioritize PSA 10 cards first (eBay or 130point)
        let cardImage = null;
        const prioritizedCards = [
          ...psa10Cards,
          ...psa9Cards,
          ...rawCards
        ];
        
        // Sort by: has image first, then by source (eBay then 130point)
        prioritizedCards.sort((a, b) => {
          const aHasImage = getCardImage(a) !== null;
          const bHasImage = getCardImage(b) !== null;
          if (aHasImage && !bHasImage) return -1;
          if (!aHasImage && bHasImage) return 1;
          
          // If both have or don't have images, prefer eBay
          const aIsEbay = a.source === 'ebay' || (a.itemWebUrl && (a.itemWebUrl.includes('ebay') || a.itemWebUrl.includes('ebay.com')));
          const bIsEbay = b.source === 'ebay' || (b.itemWebUrl && (b.itemWebUrl.includes('ebay') || b.itemWebUrl.includes('ebay.com')));
          if (aIsEbay && !bIsEbay) return -1;
          if (!aIsEbay && bIsEbay) return 1;
          return 0;
        });
        
        for (const cardItem of prioritizedCards) {
          const img = getCardImage(cardItem);
          if (img) {
            cardImage = img;
            break;
          }
        }

        // Get card title
        const cardTitle = searchQuery || 
                         psa10Cards[0]?.summaryTitle || 
                         psa10Cards[0]?.title || 
                         psa9Cards[0]?.summaryTitle || 
                         psa9Cards[0]?.title || 
                         rawCards[0]?.summaryTitle || 
                         rawCards[0]?.title || 
                         'Card';

        // Build card data object (same structure as SearchPage)
        setCardData({
          title: cardTitle,
          summaryTitle: cardTitle,
          imageUrl: cardImage,
          image: cardImage,
          cardImage: cardImage, // Also add cardImage for the render
          rawAveragePrice: rawAvg,
          psa9AveragePrice: psa9Avg,
          psa10Price: psa10Avg,
          rawCards: rawCards,
          psa9Cards: psa9Cards,
          psa10Cards: psa10Cards,
          searchQuery: searchQuery,
          createdAt: new Date().toISOString()
        });
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
    // Build a search query in format: "2025 Topps Series 1 #1 Shohei Ohtani Rainbow Foil"
    // Note: Sport (Baseball) is NOT included in the search query
    const parts = [];
    
    // Year first (only once) - always include if available
    if (setInfo?.year) {
      const year = typeof setInfo.year === 'number' ? setInfo.year.toString() : setInfo.year;
      parts.push(year);
    }
    
    // Clean up set name - remove "Checklist Guide", "Baseball Checklist Guide", etc.
    let cleanSetName = setInfo?.setName || '';
    if (cleanSetName) {
      // Remove emojis first
      cleanSetName = cleanSetName.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim();
      
      // Remove common suffixes
      cleanSetName = cleanSetName
        .replace(/\s*Checklist\s*Guide\s*/gi, ' ')
        .replace(/\s*Checklist\s*/gi, ' ')
        .trim();
      
      // Remove year if it's at the start (to avoid duplication, but we already added it above)
      cleanSetName = cleanSetName.replace(/^\d{4}\s+/, '');
      
      // Remove sport names from set name (Baseball, Football, Basketball, etc.)
      cleanSetName = cleanSetName
        .replace(/\s*Baseball\s*/gi, ' ')
        .replace(/\s*Football\s*/gi, ' ')
        .replace(/\s*Basketball\s*/gi, ' ')
        .replace(/\s*Hockey\s*/gi, ' ')
        .replace(/\s*Soccer\s*/gi, ' ')
        .trim();
      
      if (cleanSetName) {
        parts.push(cleanSetName);
      }
    }
    
    // Card number with # prefix
    if (card?.number) parts.push(`#${card.number}`);
    
    // Player name
    if (card?.player) parts.push(card.player);
    
    // Parallel type last (e.g., "Rainbow Foil" or "Silver Prizm")
    // Use card.team if available (from GemRate checklist), otherwise use setInfo.parallel
    let parallel = card?.team || setInfo?.parallel;
    if (parallel && parallel.toLowerCase() !== 'base' && parallel !== 'Base Checklist') {
      // Remove trailing "s" from plural parallel types (e.g., "Silver Prizms" -> "Silver Prizm")
      let cleanParallel = parallel;
      // Remove trailing "s" if the word ends with common plural patterns
      cleanParallel = cleanParallel.replace(/\b(\w+)s\b$/i, '$1');
      // Also handle cases where the last word is plural (e.g., "Silver Prizms" -> "Silver Prizm")
      cleanParallel = cleanParallel.replace(/\s+(\w+)s\b$/i, ' $1');
      parts.push(cleanParallel);
    }
    
    const query = parts.join(' ').replace(/\s+/g, ' ').trim(); // Clean up multiple spaces
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

  const psa10Price = cardData.psa10Price || 0;
  const psa9Price = cardData.psa9AveragePrice || 0;
  const rawPrice = cardData.rawAveragePrice || 0;
  
  // Get population data from gemrate (check multiple possible field names)
  // GemRate returns: perfect/gemMint (PSA 10), grade9 (PSA 9), total (total population)
  // If we have psaGraded from the card prop, use it as total PSA population
  const totalPsaGraded = card?.psaGraded || gemrateData?.total || gemrateData?.totalPopulation || gemrateData?.total_population || 0;
  const psa10Pop = gemrateData?.perfect || gemrateData?.gemMint || gemrateData?.psa10Population || gemrateData?.psa10_population || 0;
  const psa9Pop = gemrateData?.grade9 || gemrateData?.psa9Population || gemrateData?.psa9_population || 0;
  const totalPop = totalPsaGraded || (psa10Pop + psa9Pop);
  // GemRate also provides gemRate as a percentage, use it if available, otherwise calculate
  const gemRate = gemrateData?.gemRate ? gemrateData.gemRate.toFixed(1) : (totalPop > 0 && psa10Pop > 0 ? ((psa10Pop / totalPop) * 100).toFixed(1) : null);

  return (
    <div className="score-card-summary">
      <div className="score-card-header">
        <button onClick={onBack} className="back-btn">← Back to Checklist</button>
        <h1>
          {setInfo?.setName || 'Card Summary'}
          {card?.team && card.team.toLowerCase() !== 'base' && ` ${card.team}`}
        </h1>
        <h2>{card?.player || 'Unknown Player'}</h2>
        {card?.number && <h3>#{card.number}</h3>}
      </div>

      <div className="score-card-content">
        {/* Left column: PSA 10 + RAW */}
        <div className="price-column left-column">
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

          {/* Raw Box */}
          <div className="price-box raw-box">
            <div className="price-label">RAW</div>
            <div className="price-value">{formatPrice(rawPrice)}</div>
            <div className="price-description">Average recent ungraded sale price</div>
          </div>
        </div>

        {/* Middle column: Card Image */}
        <div className="card-image-section">
          {cardData.cardImage || cardData.imageUrl || cardData.image ? (
            <img 
              src={cardData.cardImage || cardData.imageUrl || cardData.image} 
              alt={card?.player || 'Card'} 
              className="card-image"
              onError={(e) => {
                // If image fails to load, show placeholder
                e.target.style.display = 'none';
                e.target.nextElementSibling?.style.display || (e.target.parentElement.innerHTML = '<div class="card-image-placeholder"><p>Card Image</p><p>Not Available</p></div>');
              }}
            />
          ) : (
            <div className="card-image-placeholder">
              <p>Card Image</p>
              <p>Not Available</p>
            </div>
          )}
        </div>

        {/* Right column: PSA 9 + Gem Rate */}
        <div className="price-column right-column">
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

