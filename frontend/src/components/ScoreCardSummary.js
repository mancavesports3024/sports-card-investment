import React, { useState, useEffect, useRef, useCallback } from 'react';
import './ScoreCardSummary.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://web-production-9efa.up.railway.app';

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

const ScoreCardSummary = ({ card, setInfo, onBack = null, initialCardData = null }) => {
  const [cardData, setCardData] = useState(initialCardData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [gemrateData, setGemrateData] = useState(null);
  const lastFetchedCardKeyRef = useRef(null);

  // Define fetchGemrateData before useEffect that uses it
  const fetchGemrateData = useCallback(async () => {
    try {
      // Only use gemrateId if available
      if (!card?.gemrateId) {
        console.log(`[ScoreCardSummary] No gemrateId available on card`);
        setGemrateData(null);
        return;
      }
      
      console.log(`[ScoreCardSummary] Using gemrateId from card: ${card.gemrateId}`);
      const response = await fetch(`${API_BASE_URL}/api/gemrate/details/${encodeURIComponent(card.gemrateId)}`);
      
      if (!response.ok) {
        console.error(`[ScoreCardSummary] GemRate API error: ${response.status} ${response.statusText}`);
        setGemrateData(null);
        return;
      }
      
      const data = await response.json();
      console.log(`[ScoreCardSummary] GemRate details response success: ${data.success}`);
      
      // Check multiple possible response structures
      const populationData = data.data?.population || data.data?.data?.population || data.population || null;
      
      if (data.success && populationData) {
        console.log(`[ScoreCardSummary] Setting GemRate data from gemrateId:`, {
          total: populationData.total,
          perfect: populationData.perfect,
          grade9: populationData.grade9,
          gemRate: populationData.gemRate
        });
        setGemrateData(populationData);
      } else {
        console.log(`[ScoreCardSummary] No population data in response. Success: ${data.success}, hasData: ${!!data.data}, hasPopulation: ${!!populationData}`);
        setGemrateData(null);
      }
    } catch (err) {
      console.error('[ScoreCardSummary] Failed to fetch gemrate data:', err);
      setGemrateData(null);
    }
  }, [card?.gemrateId]);

  // Define searchGemRateData before useEffect that uses it
  const searchGemRateData = useCallback(async () => {
    try {
      // Don't search if we don't have enough card info
      if (!card) {
        console.log(`[ScoreCardSummary] No card data to search GemRate`);
        setGemrateData(null);
        return;
      }
      
      // Build search query from card data
      const playerName = card?.player || card?.name || '';
      const cardNumber = card?.number || '';
      const setName = card?.set || '';
      const parallel = card?.parallel || '';
      
      // Build a search query similar to how we build it for 130point
      let searchQuery = '';
      if (setName && cardNumber) {
        searchQuery = `${setName} #${cardNumber}`;
        if (playerName) {
          searchQuery = `${playerName} ${searchQuery}`;
        }
        if (parallel && parallel.toLowerCase() !== 'base') {
          searchQuery = `${searchQuery} ${parallel}`;
        }
      } else if (playerName && cardNumber) {
        searchQuery = `${playerName} #${cardNumber}`;
        if (setName) {
          searchQuery = `${setName} ${searchQuery}`;
        }
      } else if (playerName) {
        searchQuery = playerName;
        if (cardNumber) {
          searchQuery = `${searchQuery} #${cardNumber}`;
        }
      } else {
        console.log(`[ScoreCardSummary] Not enough card info to search GemRate`);
        setGemrateData(null);
        return;
      }
      
      console.log(`[ScoreCardSummary] Searching GemRate for: "${searchQuery}"`);
      
      const response = await fetch(`${API_BASE_URL}/api/gemrate/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: searchQuery })
      });
      
      if (!response.ok) {
        console.error(`[ScoreCardSummary] GemRate search API error: ${response.status} ${response.statusText}`);
        setGemrateData(null);
        return;
      }
      
      const data = await response.json();
      console.log(`[ScoreCardSummary] GemRate search response success: ${data.success}`);
      
      // Try multiple possible response structures
      const populationData = data.population || data.data?.population || null;
      
      if (data.success && populationData) {
        console.log(`[ScoreCardSummary] Setting GemRate data from search:`, {
          total: populationData.total,
          perfect: populationData.perfect,
          grade9: populationData.grade9,
          gemRate: populationData.gemRate
        });
        setGemrateData(populationData);
      } else {
        console.log(`[ScoreCardSummary] No population data from GemRate search. Success: ${data.success}, hasPopulation: ${!!populationData}`);
        setGemrateData(null);
      }
    } catch (err) {
      console.error('[ScoreCardSummary] Error searching GemRate data:', err);
      setGemrateData(null);
    }
  }, [card]);

  useEffect(() => {
    if (initialCardData) {
      // Use preloaded data (e.g., from SearchPage summary) and skip refetch
      setCardData(initialCardData);
      setLoading(false);
      // Don't reset gemrateData here - let the GemRate useEffect handle it
      return;
    }

    if (card) {
      // Reset state when card changes to ensure title and data update immediately
      setCardData(null);
      setGemrateData(null);
      setError('');
      setLoading(true);
      fetchCardData();
    }
  }, [card, initialCardData]);

  // Fetch GemRate data - try gemrateId first, then search fallback
  useEffect(() => {
    // Don't fetch if we don't have a card
    if (!card) {
      return;
    }
    
    // Create a stable key to prevent unnecessary re-fetches
    const cardKey = `${card?.gemrateId || ''}_${card?.player || card?.name || ''}_${card?.set || ''}_${card?.number || ''}`;
    
    // Skip if we already fetched for this exact card AND we have data
    if (cardKey === lastFetchedCardKeyRef.current && gemrateData) {
      console.log(`[ScoreCardSummary] Already fetched GemRate data for this card (key: ${cardKey}), skipping`);
      return;
    }
    
    console.log(`[ScoreCardSummary] Card changed:`, {
      player: card?.player || card?.name,
      set: card?.set,
      number: card?.number,
      hasGemrateId: !!card?.gemrateId,
      gemrateId: card?.gemrateId,
      cardKey: cardKey,
      hasInitialCardData: !!initialCardData
    });
    
    // Mark this card as being fetched
    lastFetchedCardKeyRef.current = cardKey;
    
    // Only reset gemrateData if this is a different card (not if we're just initializing)
    if (gemrateData && cardKey !== `${gemrateData.gemrateId || ''}_${card?.player || card?.name || ''}_${card?.set || ''}_${card?.number || ''}`) {
      setGemrateData(null);
    }
    
    // Try gemrateId first (from player search), then fallback to search
    if (card?.gemrateId) {
      console.log(`[ScoreCardSummary] Card has gemrateId: ${card.gemrateId}, fetching directly`);
      fetchGemrateData();
    } else {
      console.log(`[ScoreCardSummary] Card does NOT have gemrateId - will search GemRate by query`);
      searchGemRateData();
    }
  }, [card?.gemrateId, card?.player, card?.name, card?.set, card?.number, fetchGemrateData, searchGemRateData, initialCardData]);

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

      // Check if response is OK
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[ScoreCardSummary] API error (${response.status}):`, errorText);
        setError(`API error (${response.status}): ${response.statusText}`);
        setLoading(false);
        return;
      }

      const data = await response.json();
      console.log('[ScoreCardSummary] API response:', { 
        hasResults: !!data.results, 
        resultsKeys: data.results ? Object.keys(data.results) : [],
        error: data.error,
        success: data.success
      });
      
      if (data.results) {
        // Filter out parallels if this is a base card
        const isBaseCard = !card?.team || card.team.toLowerCase() === 'base';
        const excludeParallels = isBaseCard;
        
        // Helper to check if a card title contains parallel keywords
        // This is a more comprehensive filter that catches parallels the search query might have missed
        const isParallel = (title) => {
          if (!title) return false;
          const lowerTitle = title.toLowerCase();
          
          // Comprehensive list of parallel keywords (more extensive than search exclusions)
          const parallelKeywords = [
            // Colors
            'silver', 'gold', 'rainbow', 'red', 'blue', 'green', 'purple', 'pink', 'orange',
            'yellow', 'black', 'white', 'bronze', 'platinum', 'diamond', 'emerald', 'ruby',
            'amethyst', 'teal', 'neon', 'camo', 'tie-dye', 'disco',
            // Refractor and special finishes
            'refractor', 'x-fractor', 'cracked ice', 'stained glass', 'die-cut', 'die cut',
            'holo', 'holographic', 'chrome', 'foil', 'lazer',
            // Panini Select parallels
            'flash', 'velocity', 'scope', 'hyper', 'wave', 'cosmic', 'planetary', 'pursuit',
            'eris', 'aqua', 'sapphire', 'red/white/blue',
            // Special inserts
            'downtown', 'genesis', 'fast break', 'zoom', 'flashback', 'emergent', 'mania',
            'geometric', 'honeycomb', 'pride', 'kaleidoscopic', 'vintage', 'splash', 'rising',
            // Other parallel types
            'snakeskin', 'pulsar', 'dragon scale', 'pandora', 'speckle', 'sparkle', 'shock'
          ];
          
          // Check for parallel keywords, but allow "prizm" if it's part of the set name (e.g., "2024 Prizm")
          const hasParallelKeyword = parallelKeywords.some(keyword => {
            // Special handling for "prizm" - only exclude if it's clearly a parallel
            if (keyword === 'prizm' && lowerTitle.includes('prizm')) {
              return lowerTitle.includes('silver prizm') || 
                     lowerTitle.includes('gold prizm') ||
                     lowerTitle.includes('rainbow prizm') ||
                     (lowerTitle.includes('prizm') && !lowerTitle.match(/\d{4}\s+prizm/i));
            }
            return lowerTitle.includes(keyword);
          });
          
          // Check for numbered parallels (e.g., "#/25", "#/50", "/25", "/50")
          // But NOT card numbers like "#1", "#347" (single digit or 3+ digits without /)
          const hasNumberedParallel = /\#\s*\d{1,2}\s*\/\s*\d+|\/\s*\d{1,3}\s*\/\s*\d+/.test(lowerTitle);
          
          return hasParallelKeyword || hasNumberedParallel;
        };
        
        // Process results the same way SearchPage does
        let rawCards = filterRawCards(data.results.raw || []);
        let psa9Cards = (data.results.psa9 || []).filter(card => !isNaN(Number(card.price?.value)) && Number(card.price?.value) > 0);
        let psa10Cards = (data.results.psa10 || []).filter(card => !isNaN(Number(card.price?.value)) && Number(card.price?.value) > 0);
        
        console.log(`[ScoreCardSummary] Before filtering - Raw: ${rawCards.length}, PSA9: ${psa9Cards.length}, PSA10: ${psa10Cards.length}`);
        
        // Store original unfiltered cards as fallback
        const originalRawCards = [...rawCards];
        const originalPsa9Cards = [...psa9Cards];
        const originalPsa10Cards = [...psa10Cards];
        
        // Filter out parallels if this is a base card
        if (excludeParallels) {
          const beforeRaw = rawCards.length;
          const beforePsa9 = psa9Cards.length;
          const beforePsa10 = psa10Cards.length;
          
          rawCards = rawCards.filter(card => !isParallel(card.title));
          psa9Cards = psa9Cards.filter(card => !isParallel(card.title));
          psa10Cards = psa10Cards.filter(card => !isParallel(card.title));
          
          console.log(`[ScoreCardSummary] Filtered parallels: Raw ${beforeRaw}→${rawCards.length}, PSA9 ${beforePsa9}→${psa9Cards.length}, PSA10 ${beforePsa10}→${psa10Cards.length}`);
          
          // If filtering removed all sales, fall back to unfiltered (parallel) sales
          // This ensures we show something rather than nothing
          if (rawCards.length === 0 && originalRawCards.length > 0) {
            console.log(`[ScoreCardSummary] No base card sales found, using parallel sales as fallback for RAW`);
            rawCards = originalRawCards;
          }
          if (psa9Cards.length === 0 && originalPsa9Cards.length > 0) {
            console.log(`[ScoreCardSummary] No base card sales found, using parallel sales as fallback for PSA9`);
            psa9Cards = originalPsa9Cards;
          }
          if (psa10Cards.length === 0 && originalPsa10Cards.length > 0) {
            console.log(`[ScoreCardSummary] No base card sales found, using parallel sales as fallback for PSA10`);
            psa10Cards = originalPsa10Cards;
          }
        }
        
        console.log(`[ScoreCardSummary] After filtering - Raw: ${rawCards.length}, PSA9: ${psa9Cards.length}, PSA10: ${psa10Cards.length}`);

        // Calculate average prices
        const rawPrices = rawCards.map(card => Number(card.price?.value)).filter(v => !isNaN(v) && v > 0);
        const psa9Prices = psa9Cards.map(card => Number(card.price?.value)).filter(v => !isNaN(v) && v > 0);
        const psa10Prices = psa10Cards.map(card => Number(card.price?.value)).filter(v => !isNaN(v) && v > 0);

        const rawAvg = rawPrices.length > 0 ? rawPrices.reduce((a, b) => a + b, 0) / rawPrices.length : 0;
        const psa9Avg = psa9Prices.length > 0 ? psa9Prices.reduce((a, b) => a + b, 0) / psa9Prices.length : 0;
        const psa10Avg = psa10Prices.length > 0 ? psa10Prices.reduce((a, b) => a + b, 0) / psa10Prices.length : 0;

        // Get card image - prioritize PSA 10 cards first (eBay or 130point)
        // Also prioritize cards that match the requested card number
        let cardImage = null;
        
        // Extract card number from search query or card info
        const cardNumberMatch = (searchQuery || card?.number || '').toString().match(/#?(\d+)/);
        const requestedCardNumber = cardNumberMatch ? cardNumberMatch[1] : null;
        
        // Helper to check if a card matches the requested card number
        const matchesCardNumber = (cardTitle) => {
          if (!requestedCardNumber) return false;
          const cardNumRegex = new RegExp(`(?:#|no\\.?|number)\\s*${requestedCardNumber}\\b|\\b${requestedCardNumber}\\b`, 'i');
          return cardNumRegex.test((cardTitle || '').toLowerCase());
        };
        
        const prioritizedCards = [
          ...psa10Cards,
          ...psa9Cards,
          ...rawCards
        ];
        
        // Sort by: matches card number first, then has image, then by source (eBay then 130point)
        prioritizedCards.sort((a, b) => {
          const aMatchesNumber = matchesCardNumber(a.title);
          const bMatchesNumber = matchesCardNumber(b.title);
          if (aMatchesNumber && !bMatchesNumber) return -1;
          if (!aMatchesNumber && bMatchesNumber) return 1;
          
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
        // More detailed error message
        const errorMsg = data.error || 
                        (data.success === false ? 'Search returned no results' : 'Failed to fetch card data');
        console.error('[ScoreCardSummary] No results in response:', data);
        setError(errorMsg);
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
    
    // Check if this is a Pokemon card (TCG category)
    const isPokemon = setInfo?.category?.toLowerCase().includes('tcg') || 
                      setInfo?.setName?.toLowerCase().includes('pokemon') ||
                      card?.category?.toLowerCase().includes('tcg');
    
    // Year first (only once) - skip for Pokemon cards
    if (setInfo?.year && !isPokemon) {
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
      
      // Remove year if it's at the start (to avoid duplication)
      cleanSetName = cleanSetName.replace(/^\d{4}\s+/, '');
      
      // Remove "Pokemon" from set name for Pokemon cards
      if (isPokemon) {
        cleanSetName = cleanSetName.replace(/\bPokemon\b/gi, ' ').trim();
      }
      
      // Remove sport names from set name (Baseball, Football, Basketball, etc.)
      cleanSetName = cleanSetName
        .replace(/\s*Baseball\s*/gi, ' ')
        .replace(/\s*Football\s*/gi, ' ')
        .replace(/\s*Basketball\s*/gi, ' ')
        .replace(/\s*Hockey\s*/gi, ' ')
        .replace(/\s*Soccer\s*/gi, ' ')
        .trim();
      
      // Remove "Paper" from set names (e.g., "Bowman Paper Prospects" -> "Bowman Prospects")
      cleanSetName = cleanSetName.replace(/\s*Paper\s*/gi, ' ').trim();
      
      // Remove "Mega Box" from set names (e.g., "Bowman Mega Box Chrome Prospects" -> "Bowman Chrome Prospects")
      cleanSetName = cleanSetName.replace(/\s*Mega\s+Box\s*/gi, ' ').trim();
      
      // Remove "Edition" from set names (e.g., "Bowman Sapphire Edition Chrome Prospects" -> "Bowman Sapphire Chrome Prospects")
      cleanSetName = cleanSetName.replace(/\s*Edition\s*/gi, ' ').trim();
      
      // Replace "Autograph" / "Autographs" with "auto" in set names
      // e.g., "Bowman Chrome Prospect Autographs" -> "Bowman Chrome Prospect auto"
      //       "Bowman Chrome Prospect Autograph"  -> "Bowman Chrome Prospect auto"
      cleanSetName = cleanSetName.replace(/\bAutograph(s)?\b/gi, 'auto').trim();
      
      if (cleanSetName) {
        parts.push(cleanSetName);
      }
    }
    
    // Card number - use "#" prefix for most sports, but NOT for Pokemon / TCG
    if (card?.number) {
      if (isPokemon) {
        // For Pokemon cards, remove "#" to better match marketplace listings
        parts.push(`${card.number}`);
      } else {
        parts.push(`#${card.number}`);
      }
    }
    
    // Player name
    if (card?.player) parts.push(card.player);
    
    // Parallel type last (e.g., "Rainbow Foil" or "Silver Prizm")
    // Use card.team if available (from GemRate checklist), otherwise use setInfo.parallel
    let parallel = card?.team || setInfo?.parallel;
    let cleanParallel = '';
    if (parallel && parallel.toLowerCase() !== 'base' && parallel !== 'Base Checklist') {
      // Remove trailing "s" from plural parallel types (e.g., "Silver Prizms" -> "Silver Prizm")
      cleanParallel = parallel;
      // Remove trailing "s" if the word ends with common plural patterns
      cleanParallel = cleanParallel.replace(/\b(\w+)s\b$/i, '$1');
      // Also handle cases where the last word is plural (e.g., "Silver Prizms" -> "Silver Prizm")
      cleanParallel = cleanParallel.replace(/\s+(\w+)s\b$/i, ' $1');
      parts.push(cleanParallel);
    }
    
    let query = parts.join(' ').replace(/\s+/g, ' ').trim(); // Clean up multiple spaces
    
    // Remove any remaining emojis (in case they came from category name or elsewhere)
    query = query.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim();
    
    // If this is a base card, add exclusion terms for parallel types
    // Only include the most common parallel indicators to avoid overly long queries
    // IMPORTANT: If we added a parallel to the query (cleanParallel is not empty),
    // we should NOT add exclusions, as we're searching for that specific parallel
    const hasParallel = cleanParallel && cleanParallel.trim().length > 0;
    const isBaseCard = !hasParallel && (!parallel || parallel.toLowerCase() === 'base' || parallel === 'Base Checklist');
    
    console.log('🔍 Query building debug:', { 
      parallel, 
      cleanParallel, 
      hasParallel, 
      isBaseCard 
    });
    
    if (isBaseCard) {
      // Minimal list of the most common parallel keywords
      // Focus on terms that are almost always parallels, not base cards
      let parallelExclusions = [
        // Most common color parallels (without "prizm" since it's already in the set name)
        'silver', 'gold', 'rainbow',
        'red', 'blue', 'green', 'purple',
        // Refractor and special finishes
        'refractor', 'x-fractor', 'cracked ice', 'stained glass',
        // Panini Select most common parallels
        'flash', 'velocity', 'scope', 'hyper', 'wave', 'cosmic',
        // Special inserts
        'downtown', 'genesis', 'fast break',
        // Additional parallel types
        'lazer', 'pandora', 'speckle', 'sparkle', 'shock'
      ];
      
      // IMPORTANT: Remove any exclusion keywords that appear in the query
      // For example, if searching for "Downtown!" card, we shouldn't exclude "downtown"
      const queryLower = query.toLowerCase();
      parallelExclusions = parallelExclusions.filter(exclusion => {
        const exclusionLower = exclusion.toLowerCase();
        // Check if the exclusion keyword appears in the query
        // Use word boundaries to avoid partial matches (e.g., "downtown" in "downtown!" should match)
        const exclusionRegex = new RegExp(`\\b${exclusionLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        return !exclusionRegex.test(query);
      });
      
      // Only add exclusions if there are any left after filtering
      if (parallelExclusions.length > 0) {
        // Format exclusions as: -(keyword1, keyword2, keyword3, ...)
        const exclusionString = `-(${parallelExclusions.join(', ')})`;
        query = `${query} ${exclusionString}`;
      }
    }
    // If we're searching for a parallel card, we don't add exclusions at all
    // This prevents filtering out the cards we're actually looking for
    
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
        {onBack && (
          <button onClick={onBack} className="back-btn">← Back to Checklist</button>
        )}
      </div>
    );
  }

  if (!cardData) {
    return (
      <div className="score-card-summary">
        <div className="error-message">No card data available</div>
        {onBack && (
          <button onClick={onBack} className="back-btn">← Back to Checklist</button>
        )}
      </div>
    );
  }

  const psa10Price = cardData.psa10Price || 0;
  const psa9Price = cardData.psa9AveragePrice || 0;
  const rawPrice = cardData.rawAveragePrice || 0;
  
  // Get population data from gemrate (check multiple possible field names)
  // GemRate returns: perfect/gemMint (PSA 10), grade9 (PSA 9), total (total population), gemRate (percentage)
  console.log(`[ScoreCardSummary] Rendering with gemrateData:`, gemrateData);
  console.log(`[ScoreCardSummary] gemrateData keys:`, gemrateData ? Object.keys(gemrateData) : 'null');
  const psa10Pop = gemrateData?.perfect || gemrateData?.gemMint || gemrateData?.psa10Population || gemrateData?.psa10_population || 0;
  const psa9Pop = gemrateData?.grade9 || gemrateData?.psa9Population || gemrateData?.psa9_population || 0;
  const totalPop = gemrateData?.total || gemrateData?.totalPopulation || gemrateData?.total_population || 0;
  console.log(`[ScoreCardSummary] Extracted populations - psa10Pop: ${psa10Pop}, psa9Pop: ${psa9Pop}, totalPop: ${totalPop}`);
  
  // GemRate provides gemRate as a percentage, use it if available, otherwise calculate
  // gemRate from GemRate is already a percentage (e.g., 3.5 for 3.5%), not a decimal
  let gemRate = null;
  if (gemrateData?.gemRate !== undefined && gemrateData?.gemRate !== null) {
    // If it's already a percentage (0-100), use it directly
    // If it's a decimal (0-1), multiply by 100
    gemRate = gemrateData.gemRate > 1 ? gemrateData.gemRate.toFixed(1) : (gemrateData.gemRate * 100).toFixed(1);
  } else if (totalPop > 0 && psa10Pop > 0) {
    // Calculate from PSA 10 / Total
    gemRate = ((psa10Pop / totalPop) * 100).toFixed(1);
  }

  return (
    <div className="score-card-summary">
      <div className="score-card-header">
        {onBack && (
          <button onClick={onBack} className="back-btn">← Back to Checklist</button>
        )}
        <h1>
          {card?.set || setInfo?.setName || 'Card Summary'}
          {(card?.parallel || card?.team) && 
           (card?.parallel || card?.team).toLowerCase() !== 'base' && 
           ` ${card?.parallel || card?.team}`}
        </h1>
        {card?.player && <h2>{card.player}</h2>}
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
          {(() => {
            const created =
              card?.createdAt
                ? formatTimestamp(card.createdAt)
                : formatTimestamp(new Date().toISOString());
            return created ? `Created: ${created}` : 'Created:';
          })()}
        </div>
        <div className="footer-website">MANCAVESPORTSCARDSLLC.COM</div>
      </div>
    </div>
  );
};

export default ScoreCardSummary;

