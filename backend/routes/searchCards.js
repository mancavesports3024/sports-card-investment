const express = require('express');
const router = express.Router();
const ebayService = require('../services/ebayService');
const onepointService = require('../services/130pointService');
const ebayScraperService = require('../services/ebayScraperService');
const searchHistoryService = require('../services/searchHistoryService');
const cacheService = require('../services/cacheService');
const { getEbayApiUsage } = require('../services/ebayService');
const point130Service = require('../services/130pointService');
const getCardBaseService = require('../services/getCardBaseService');
const fs = require('fs').promises;
const path = require('path');

// Helper to add EPN tracking parameters to eBay URLs
function addEbayTracking(url) {
  if (!url) return url;
  
  // Your EPN tracking parameters - replace with your actual values
  const epnParams = {
    mkevt: process.env.EBAY_MKEVT || '1', // Your affiliate ID
    mkcid: process.env.EBAY_MKCID || '1', // Campaign ID
    mkrid: process.env.EBAY_MKRID || '711-53200-19255-0', // Rotation ID (marketplace)
    siteid: process.env.EBAY_SITEID || '0', // Site ID (0 for US)
    campid: process.env.EBAY_CAMPID || '5338333097', // Your EPN campaign ID
    toolid: process.env.EBAY_TOOLID || '10001', // Tool ID
    customid: process.env.EBAY_CUSTOMID || 'trading-card-tracker' // Sub-ID for tracking
  };
  
  try {
    const urlObj = new URL(url);
    
    // Add EPN parameters
    Object.entries(epnParams).forEach(([key, value]) => {
      if (value) {
        urlObj.searchParams.set(key, value);
      }
    });
    
    return urlObj.toString();
  } catch (error) {
    console.error('Error adding EPN tracking to URL:', error);
    return url; // Return original URL if there's an error
  }
}

// Mock data for testing when eBay API is not available
const getMockData = (searchQuery, numSales) => {
  const mockItem = {
    id: "123456789",
    title: `${searchQuery}`,
    price: {
      value: "150.00",
      currency: "USD"
    },
    soldDate: new Date().toISOString(),
    condition: "Used",
    imageUrl: "https://example.com/card.jpg",
    itemWebUrl: "https://ebay.com/itm/123456789",
    seller: "cardcollector123"
  };
  
  return Array(Math.min(numSales, 5)).fill(mockItem).map((item, index) => ({
    ...item,
    id: (parseInt(item.id) + index).toString(),
    price: {
      value: (parseFloat(item.price.value) + (index * 10)).toFixed(2),
      currency: "USD"
    }
  }));
};

// Helper function to categorize cards and calculate price differences
const categorizeCards = (cards) => {
  const gradingCompanies = ['psa', 'bgs', 'beckett', 'sgc', 'cgc', 'ace', 'cga', 'gma', 'hga', 'pgs', 'bvg', 'csg', 'rcg', 'ksa', 'fgs', 'tag', 'pgm', 'dga', 'isa'];
  const rawKeywords = ['raw', 'ungraded', 'not graded', 'no grade'];
  const gradedConditionIds = ['2750', '4000', '5000'];
  const legacyBuckets = {
    raw: [], psa7: [], psa8: [], psa9: [], psa10: [], cgc9: [], cgc10: [], tag8: [], tag9: [], tag10: [], sgc10: [], aigrade9: [], aigrade10: [], otherGraded: []
  };
  const dynamicBuckets = {};
  // New: gradingStats object for all company/grade combos
  const gradingStats = {};
  try {
    cards.forEach((card, index) => {
      const title = card.title?.toLowerCase() || '';
      const condition = card.condition?.toLowerCase() || '';
      // Robust regex: company (word boundary), optional space/dash/colon, grade (1-2 digits, optional .5)
      const gradingRegex = /\b(psa|bgs|beckett|sgc|cgc|ace|cga|gma|hga|pgs|bvg|csg|rcg|ksa|fgs|tag|pgm|dga|isa)[\s:-]*([0-9]{1,2}(?:\.5)?)\b/i;
      const match = title.match(gradingRegex);
      let isGraded = false;
      if (match) {
        let company = match[1].toLowerCase();
        if (company === 'beckett') company = 'bgs';
        const grade = match[2].replace('.', '_');
        const key = `${company}${grade}`;
        console.log(`Card ${index}: "${card.title}"`);
        console.log(`  Matched company: ${company}, grade: ${grade} → bucket: gradingStats[${company}][${grade}]`);
        if (!dynamicBuckets[key]) dynamicBuckets[key] = [];
        dynamicBuckets[key].push(card);
        if (!gradingStats[company]) gradingStats[company] = {};
        if (!gradingStats[company][grade]) gradingStats[company][grade] = { cards: [] };
        gradingStats[company][grade].cards.push(card);
        isGraded = true;
        // Legacy buckets for PSA, CGC, TAG, SGC, AiGrade
        if (company === 'psa') {
          if (grade === '10') legacyBuckets.psa10.push(card);
          else if (grade === '9') legacyBuckets.psa9.push(card);
          else if (grade === '8') legacyBuckets.psa8.push(card);
          else if (grade === '7') legacyBuckets.psa7.push(card);
        } else if (company === 'cgc') {
          if (grade === '10') legacyBuckets.cgc10.push(card);
          else if (grade === '9') legacyBuckets.cgc9.push(card);
        } else if (company === 'tag') {
          if (grade === '10') legacyBuckets.tag10.push(card);
          else if (grade === '9') legacyBuckets.tag9.push(card);
          else if (grade === '8') legacyBuckets.tag8.push(card);
        } else if (company === 'sgc') {
          if (grade === '10') legacyBuckets.sgc10.push(card);
        } else if (company === 'aigrade') {
          if (grade === '10') legacyBuckets.aigrade10.push(card);
          else if (grade === '9') legacyBuckets.aigrade9.push(card);
        }
      }
      if (!isGraded) {
        // Log if the card looks graded but didn't match the regex
        if (title.includes('bgs') || title.includes('beckett') || title.includes('psa') || title.includes('sgc') || title.includes('cgc')) {
          console.log(`Card ${index}: "${card.title}"`);
          console.log('  ⚠️ Grading company mentioned but regex did not match. Classified as otherGraded.');
        }
        if (rawKeywords.some(keyword => title.includes(keyword)) || condition === 'ungraded' || condition === 'not graded' || condition === 'no grade') {
          legacyBuckets.raw.push(card);
          // Optionally log raw
        } else if (gradedConditionIds.includes(String(card.conditionId)) || condition === 'graded') {
          legacyBuckets.otherGraded.push(card);
        } else {
          legacyBuckets.raw.push(card);
        }
      }
    });
    // Calculate stats for each grading company/grade
    Object.entries(gradingStats).forEach(([company, grades]) => {
      Object.entries(grades).forEach(([grade, obj]) => {
        const prices = obj.cards.map(card => parseFloat(card.price?.value || 0)).filter(price => price > 0);
        gradingStats[company][grade] = {
          count: obj.cards.length,
          avgPrice: prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0,
          minPrice: prices.length > 0 ? Math.min(...prices) : 0,
          maxPrice: prices.length > 0 ? Math.max(...prices) : 0,
          cards: obj.cards
        };
      });
    });
    // Calculate price analysis using legacy buckets
    const priceAnalysis = calculatePriceAnalysis(
      legacyBuckets.raw, legacyBuckets.psa7, legacyBuckets.psa8, legacyBuckets.psa9, legacyBuckets.psa10,
      legacyBuckets.cgc9, legacyBuckets.cgc10, legacyBuckets.tag8, legacyBuckets.tag9, legacyBuckets.tag10,
      legacyBuckets.sgc10, legacyBuckets.aigrade9, legacyBuckets.aigrade10, legacyBuckets.otherGraded
    );
    // Merge dynamic buckets into result, but don't include psa10 yet (we'll add it after filtering)
    const { psa10, ...legacyBucketsWithoutPsa10 } = legacyBuckets;
    const categorizedResult = { ...legacyBucketsWithoutPsa10, priceAnalysis, gradingStats };
    
    // Debug: Log initial legacyBuckets.psa10
    console.log('=== INITIAL LEGACY BUCKETS PSA10 ===');
    console.log('Initial legacyBuckets.psa10 count:', legacyBuckets.psa10?.length || 0);
    if (legacyBuckets.psa10 && Array.isArray(legacyBuckets.psa10)) {
      legacyBuckets.psa10.forEach(card => {
        console.log(`[INITIAL LEGACY] Title: ${card.title}, Price: ${card.price?.value}, ItemId: ${card.id || card.itemId}`);
      });
    }
    console.log('=== END INITIAL LEGACY BUCKETS PSA10 ===');
    // Always use filteredRaw for the returned raw bucket
    if (priceAnalysis && priceAnalysis.raw && Array.isArray(legacyBuckets.raw)) {
      // Find the filteredRaw set by matching the price and title to the filtered set used in priceAnalysis
      const filteredRawSet = legacyBuckets.raw.filter(card => {
        const price = parseFloat(card.price?.value || 0);
        // Use the same filtering as in price analysis
        // Use the rawAvg from calculatePriceAnalysis
        const rawAvg = priceAnalysis.raw.avgPrice * priceAnalysis.raw.count / (priceAnalysis.raw.count || 1); // reconstruct avg
        return price > 0 && price <= 1.5 * rawAvg;
      });
      categorizedResult.raw = filteredRawSet;
    }
    // Always use filteredPsa10 for the returned psa10 bucket
    if (Array.isArray(legacyBuckets.psa10)) {
      // Use the same PSA 10 filtering logic as in calculatePriceAnalysis
      const psa10Prices = legacyBuckets.psa10.map(card => parseFloat(card.price?.value || 0)).filter(price => price > 0);
      const psa10Avg = psa10Prices.length > 0 ? psa10Prices.reduce((a, b) => a + b, 0) / psa10Prices.length : 0;
      const psa10Threshold = psa10Avg / 1.5;
      console.log('--- CATEGORIZE PSA10 FILTERING ---');
      console.log('PSA10 prices (all):', psa10Prices);
      console.log('PSA10 average (pre-filter):', psa10Avg);
      console.log('PSA10 threshold (avg/1.5):', psa10Threshold);
      const filteredPsa10 = legacyBuckets.psa10.filter(card => {
        const price = parseFloat(card.price?.value || 0);
        const include = price > 0 && price >= psa10Threshold;
        console.log(`[CATEGORIZE PSA10] Title: ${card.title}, Price: ${card.price?.value}, Include: ${include}`);
        return include;
      });
      console.log('PSA10 prices (filtered):', filteredPsa10.map(card => parseFloat(card.price?.value || 0)));
      console.log('--- END CATEGORIZE PSA10 FILTERING ---');
      
      // Force update the categorizedResult.psa10 array
      categorizedResult.psa10 = [...filteredPsa10];
      
      console.log('=== CATEGORIZED RESULT PSA10 ===');
      console.log('categorizedResult.psa10 count:', categorizedResult.psa10?.length || 0);
      if (categorizedResult.psa10 && Array.isArray(categorizedResult.psa10)) {
        categorizedResult.psa10.forEach(card => {
          console.log(`[CATEGORIZED RESULT] Title: ${card.title}, Price: ${card.price?.value}, ItemId: ${card.id || card.itemId}`);
        });
      }
      console.log('=== END CATEGORIZED RESULT PSA10 ===');
    }
    // Also filter gradingStats['psa']['10'].cards if it exists
    if (gradingStats.psa && gradingStats.psa['10'] && Array.isArray(gradingStats.psa['10'].cards)) {
      const gsPsa10Prices = gradingStats.psa['10'].cards.map(card => parseFloat(card.price?.value || 0)).filter(price => price > 0);
      const gsPsa10Avg = gsPsa10Prices.length > 0 ? gsPsa10Prices.reduce((a, b) => a + b, 0) / gsPsa10Prices.length : 0;
      const gsPsa10Threshold = gsPsa10Avg / 1.5;
      console.log('--- GRADINGSTATS PSA10 FILTERING ---');
      console.log('GS PSA10 prices (all):', gsPsa10Prices);
      console.log('GS PSA10 average (pre-filter):', gsPsa10Avg);
      console.log('GS PSA10 threshold (avg/1.5):', gsPsa10Threshold);
      const originalGsPsa10Count = gradingStats.psa['10'].cards.length;
      gradingStats.psa['10'].cards = gradingStats.psa['10'].cards.filter(card => {
        const price = parseFloat(card.price?.value || 0);
        const include = price > 0 && price >= gsPsa10Threshold;
        console.log(`[GS PSA10] Title: ${card.title}, Price: ${card.price?.value}, Include: ${include}`);
        return include;
      });
      console.log(`GS PSA10 filtered: ${originalGsPsa10Count} -> ${gradingStats.psa['10'].cards.length}`);
      console.log('--- END GRADINGSTATS PSA10 FILTERING ---');
    }
    Object.entries(dynamicBuckets).forEach(([bucket, arr]) => {
      if (bucket !== 'raw' && bucket !== 'psa10') categorizedResult[bucket] = arr;
    });
    
    // Debug: Log final categorized result before returning
    console.log('=== FINAL CATEGORIZED RESULT ===');
    console.log('Final categorizedResult.psa10 count:', categorizedResult.psa10?.length || 0);
    if (categorizedResult.psa10 && Array.isArray(categorizedResult.psa10)) {
      categorizedResult.psa10.forEach(card => {
        console.log(`[FINAL CATEGORIZED] Title: ${card.title}, Price: ${card.price?.value}, ItemId: ${card.id || card.itemId}`);
      });
    }
    console.log('=== END FINAL CATEGORIZED RESULT ===');
    
    return categorizedResult;
  } catch (err) {
    console.error('Error in categorizeCards:', err);
    throw err;
  }
};

// Helper function to calculate price trend
const calculatePriceTrend = (cards) => {
  if (!cards || cards.length < 3) return 'neutral';
  
  // Sort cards by sold date (most recent first)
  const sortedCards = [...cards].sort((a, b) => {
    const dateA = new Date(a.soldDate || 0);
    const dateB = new Date(b.soldDate || 0);
    return dateB - dateA;
  });
  
  // Split into two halves: recent and older
  const midPoint = Math.floor(sortedCards.length / 2);
  const recentCards = sortedCards.slice(0, midPoint);
  const olderCards = sortedCards.slice(midPoint);
  
  // Calculate average prices for each half
  const recentAvg = recentCards.reduce((sum, card) => sum + parseFloat(card.price?.value || 0), 0) / recentCards.length;
  const olderAvg = olderCards.reduce((sum, card) => sum + parseFloat(card.price?.value || 0), 0) / olderCards.length;
  
  // Calculate percentage change
  const percentChange = ((recentAvg - olderAvg) / olderAvg) * 100;
  
  // Determine trend based on percentage change
  if (percentChange > 5) return 'up';
  if (percentChange < -5) return 'down';
  return 'neutral';
};

// Helper function to calculate price differences
const calculatePriceAnalysis = (raw, psa7, psa8, psa9, psa10, cgc9, cgc10, tag8, tag9, tag10, sgc10, aigrade9, aigrade10, otherGraded) => {
  // Outlier filtering for raw: remove cards >1.5x average price (average is from original set)
  let filteredRaw = raw;
  let rawAvg = 0;
  if (raw.length > 0) {
    const rawPrices = raw.map(card => parseFloat(card.price?.value || 0)).filter(price => price > 0);
    rawAvg = rawPrices.length > 0 ? rawPrices.reduce((a, b) => a + b, 0) / rawPrices.length : 0;
    filteredRaw = raw.filter(card => {
      const price = parseFloat(card.price?.value || 0);
      return price > 0 && price <= 1.5 * rawAvg;
    });
    // Debug logging
    console.log('--- RAW OUTLIER FILTERING ---');
    console.log('Raw prices (all):', rawPrices);
    console.log('Raw average (pre-filter):', rawAvg);
    const filteredPrices = filteredRaw.map(card => parseFloat(card.price?.value || 0));
    console.log('Raw prices (filtered):', filteredPrices);
    const excluded = raw.filter(card => {
      const price = parseFloat(card.price?.value || 0);
      return price > 1.5 * rawAvg;
    });
    if (excluded.length > 0) {
      console.log('Raw outliers excluded:', excluded.map(card => ({ title: card.title, price: card.price?.value })));
    } else {
      console.log('No raw outliers excluded.');
    }
    console.log('--- END RAW OUTLIER FILTERING ---');
  }
  const analysis = {
    raw: { count: filteredRaw.length, avgPrice: 0, minPrice: 0, maxPrice: 0, trend: 'neutral' },
    psa7: { count: psa7.length, avgPrice: 0, minPrice: 0, maxPrice: 0, trend: 'neutral' },
    psa8: { count: psa8.length, avgPrice: 0, minPrice: 0, maxPrice: 0, trend: 'neutral' },
    psa9: { count: psa9.length, avgPrice: 0, minPrice: 0, maxPrice: 0, trend: 'neutral' },
    psa10: { count: 0, avgPrice: 0, minPrice: 0, maxPrice: 0, trend: 'neutral' },
    cgc9: { count: cgc9.length, avgPrice: 0, minPrice: 0, maxPrice: 0, trend: 'neutral' },
    cgc10: { count: cgc10.length, avgPrice: 0, minPrice: 0, maxPrice: 0, trend: 'neutral' },
    tag8: { count: tag8.length, avgPrice: 0, minPrice: 0, maxPrice: 0, trend: 'neutral' },
    tag9: { count: tag9.length, avgPrice: 0, minPrice: 0, maxPrice: 0, trend: 'neutral' },
    tag10: { count: tag10.length, avgPrice: 0, minPrice: 0, maxPrice: 0, trend: 'neutral' },
    sgc10: { count: sgc10.length, avgPrice: 0, minPrice: 0, maxPrice: 0, trend: 'neutral' },
    aigrade9: { count: aigrade9.length, avgPrice: 0, minPrice: 0, maxPrice: 0, trend: 'neutral' },
    aigrade10: { count: aigrade10.length, avgPrice: 0, minPrice: 0, maxPrice: 0, trend: 'neutral' },
    otherGraded: { count: otherGraded.length, avgPrice: 0, minPrice: 0, maxPrice: 0, trend: 'neutral' },
    comparisons: {}
  };
  let filteredPsa10 = psa10;
  if (psa10.length > 0) {
    // Calculate initial average from all PSA 10s
    const psa10Prices = psa10.map(card => parseFloat(card.price?.value || 0)).filter(price => price > 0);
    const psa10Avg = psa10Prices.length > 0 ? psa10Prices.reduce((a, b) => a + b, 0) / psa10Prices.length : 0;
    const psa10Threshold = psa10Avg / 1.5;
    // Filter out low outliers
    filteredPsa10 = psa10.filter(card => {
      const price = parseFloat(card.price?.value || 0);
      return price > 0 && price >= psa10Threshold;
    });
    // Now recalculate stats from the filtered set
    const filteredPrices = filteredPsa10.map(card => parseFloat(card.price?.value || 0)).filter(price => price > 0);
    analysis.psa10.count = filteredPsa10.length;
    analysis.psa10.avgPrice = filteredPrices.length > 0 ? filteredPrices.reduce((a, b) => a + b, 0) / filteredPrices.length : 0;
    analysis.psa10.minPrice = filteredPrices.length > 0 ? Math.min(...filteredPrices) : 0;
    analysis.psa10.maxPrice = filteredPrices.length > 0 ? Math.max(...filteredPrices) : 0;
  }

  // Calculate averages for each category
  if (filteredRaw.length > 0) {
    const rawPrices = filteredRaw.map(card => parseFloat(card.price?.value || 0)).filter(price => price > 0);
    analysis.raw.avgPrice = rawPrices.length > 0 ? rawPrices.reduce((a, b) => a + b, 0) / rawPrices.length : 0;
    analysis.raw.minPrice = rawPrices.length > 0 ? Math.min(...rawPrices) : 0;
    analysis.raw.maxPrice = rawPrices.length > 0 ? Math.max(...rawPrices) : 0;
  }

  if (psa7.length > 0) {
    const psa7Prices = psa7.map(card => parseFloat(card.price?.value || 0)).filter(price => price > 0);
    analysis.psa7.avgPrice = psa7Prices.length > 0 ? psa7Prices.reduce((a, b) => a + b, 0) / psa7Prices.length : 0;
    analysis.psa7.minPrice = psa7Prices.length > 0 ? Math.min(...psa7Prices) : 0;
    analysis.psa7.maxPrice = psa7Prices.length > 0 ? Math.max(...psa7Prices) : 0;
  }

  if (psa8.length > 0) {
    const psa8Prices = psa8.map(card => parseFloat(card.price?.value || 0)).filter(price => price > 0);
    analysis.psa8.avgPrice = psa8Prices.length > 0 ? psa8Prices.reduce((a, b) => a + b, 0) / psa8Prices.length : 0;
    analysis.psa8.minPrice = psa8Prices.length > 0 ? Math.min(...psa8Prices) : 0;
    analysis.psa8.maxPrice = psa8Prices.length > 0 ? Math.max(...psa8Prices) : 0;
  }

  if (psa9.length > 0) {
    const psa9Prices = psa9.map(card => parseFloat(card.price?.value || 0)).filter(price => price > 0);
    analysis.psa9.avgPrice = psa9Prices.length > 0 ? psa9Prices.reduce((a, b) => a + b, 0) / psa9Prices.length : 0;
    analysis.psa9.minPrice = psa9Prices.length > 0 ? Math.min(...psa9Prices) : 0;
    analysis.psa9.maxPrice = psa9Prices.length > 0 ? Math.max(...psa9Prices) : 0;
  }

  if (filteredPsa10.length > 0) {
    const psa10Prices = filteredPsa10.map(card => parseFloat(card.price?.value || 0)).filter(price => price > 0);
    analysis.psa10.avgPrice = psa10Prices.length > 0 ? psa10Prices.reduce((a, b) => a + b, 0) / psa10Prices.length : 0;
    analysis.psa10.minPrice = psa10Prices.length > 0 ? Math.min(...psa10Prices) : 0;
    analysis.psa10.maxPrice = psa10Prices.length > 0 ? Math.max(...psa10Prices) : 0;
  }

  if (cgc9.length > 0) {
    const cgc9Prices = cgc9.map(card => parseFloat(card.price?.value || 0)).filter(price => price > 0);
    analysis.cgc9.avgPrice = cgc9Prices.length > 0 ? cgc9Prices.reduce((a, b) => a + b, 0) / cgc9Prices.length : 0;
    analysis.cgc9.minPrice = cgc9Prices.length > 0 ? Math.min(...cgc9Prices) : 0;
    analysis.cgc9.maxPrice = cgc9Prices.length > 0 ? Math.max(...cgc9Prices) : 0;
  }

  if (cgc10.length > 0) {
    const cgc10Prices = cgc10.map(card => parseFloat(card.price?.value || 0)).filter(price => price > 0);
    analysis.cgc10.avgPrice = cgc10Prices.length > 0 ? cgc10Prices.reduce((a, b) => a + b, 0) / cgc10Prices.length : 0;
    analysis.cgc10.minPrice = cgc10Prices.length > 0 ? Math.min(...cgc10Prices) : 0;
    analysis.cgc10.maxPrice = cgc10Prices.length > 0 ? Math.max(...cgc10Prices) : 0;
  }

  if (tag8.length > 0) {
    const tag8Prices = tag8.map(card => parseFloat(card.price?.value || 0)).filter(price => price > 0);
    analysis.tag8.avgPrice = tag8Prices.length > 0 ? tag8Prices.reduce((a, b) => a + b, 0) / tag8Prices.length : 0;
    analysis.tag8.minPrice = tag8Prices.length > 0 ? Math.min(...tag8Prices) : 0;
    analysis.tag8.maxPrice = tag8Prices.length > 0 ? Math.max(...tag8Prices) : 0;
  }

  if (tag9.length > 0) {
    const tag9Prices = tag9.map(card => parseFloat(card.price?.value || 0)).filter(price => price > 0);
    analysis.tag9.avgPrice = tag9Prices.length > 0 ? tag9Prices.reduce((a, b) => a + b, 0) / tag9Prices.length : 0;
    analysis.tag9.minPrice = tag9Prices.length > 0 ? Math.min(...tag9Prices) : 0;
    analysis.tag9.maxPrice = tag9Prices.length > 0 ? Math.max(...tag9Prices) : 0;
  }

  if (tag10.length > 0) {
    const tag10Prices = tag10.map(card => parseFloat(card.price?.value || 0)).filter(price => price > 0);
    analysis.tag10.avgPrice = tag10Prices.length > 0 ? tag10Prices.reduce((a, b) => a + b, 0) / tag10Prices.length : 0;
    analysis.tag10.minPrice = tag10Prices.length > 0 ? Math.min(...tag10Prices) : 0;
    analysis.tag10.maxPrice = tag10Prices.length > 0 ? Math.max(...tag10Prices) : 0;
  }

  if (sgc10.length > 0) {
    const sgc10Prices = sgc10.map(card => parseFloat(card.price?.value || 0)).filter(price => price > 0);
    analysis.sgc10.avgPrice = sgc10Prices.length > 0 ? sgc10Prices.reduce((a, b) => a + b, 0) / sgc10Prices.length : 0;
    analysis.sgc10.minPrice = sgc10Prices.length > 0 ? Math.min(...sgc10Prices) : 0;
    analysis.sgc10.maxPrice = sgc10Prices.length > 0 ? Math.max(...sgc10Prices) : 0;
  }

  if (aigrade9.length > 0) {
    const aigrade9Prices = aigrade9.map(card => parseFloat(card.price?.value || 0)).filter(price => price > 0);
    analysis.aigrade9.avgPrice = aigrade9Prices.length > 0 ? aigrade9Prices.reduce((a, b) => a + b, 0) / aigrade9Prices.length : 0;
    analysis.aigrade9.minPrice = aigrade9Prices.length > 0 ? Math.min(...aigrade9Prices) : 0;
    analysis.aigrade9.maxPrice = aigrade9Prices.length > 0 ? Math.max(...aigrade9Prices) : 0;
  }

  if (aigrade10.length > 0) {
    const aigrade10Prices = aigrade10.map(card => parseFloat(card.price?.value || 0)).filter(price => price > 0);
    analysis.aigrade10.avgPrice = aigrade10Prices.length > 0 ? aigrade10Prices.reduce((a, b) => a + b, 0) / aigrade10Prices.length : 0;
    analysis.aigrade10.minPrice = aigrade10Prices.length > 0 ? Math.min(...aigrade10Prices) : 0;
    analysis.aigrade10.maxPrice = aigrade10Prices.length > 0 ? Math.max(...aigrade10Prices) : 0;
  }

  if (otherGraded.length > 0) {
    const otherGradedPrices = otherGraded.map(card => parseFloat(card.price?.value || 0)).filter(price => price > 0);
    analysis.otherGraded.avgPrice = otherGradedPrices.length > 0 ? otherGradedPrices.reduce((a, b) => a + b, 0) / otherGradedPrices.length : 0;
    analysis.otherGraded.minPrice = otherGradedPrices.length > 0 ? Math.min(...otherGradedPrices) : 0;
    analysis.otherGraded.maxPrice = otherGradedPrices.length > 0 ? Math.max(...otherGradedPrices) : 0;
  }

  // Calculate price trends for each category
  analysis.raw.trend = calculatePriceTrend(raw);
  analysis.psa7.trend = calculatePriceTrend(psa7);
  analysis.psa8.trend = calculatePriceTrend(psa8);
  analysis.psa9.trend = calculatePriceTrend(psa9);
  analysis.psa10.trend = calculatePriceTrend(filteredPsa10);
  analysis.cgc9.trend = calculatePriceTrend(cgc9);
  analysis.cgc10.trend = calculatePriceTrend(cgc10);
  analysis.tag8.trend = calculatePriceTrend(tag8);
  analysis.tag9.trend = calculatePriceTrend(tag9);
  analysis.tag10.trend = calculatePriceTrend(tag10);
  analysis.sgc10.trend = calculatePriceTrend(sgc10);
  analysis.aigrade9.trend = calculatePriceTrend(aigrade9);
  analysis.aigrade10.trend = calculatePriceTrend(aigrade10);
  analysis.otherGraded.trend = calculatePriceTrend(otherGraded);

  // Calculate price differences
  if (analysis.raw.avgPrice > 0 && analysis.psa9.avgPrice > 0) {
    const psa9Diff = analysis.psa9.avgPrice - analysis.raw.avgPrice;
    const psa9Percent = (psa9Diff / analysis.raw.avgPrice) * 100;
    analysis.comparisons.rawToPsa9 = {
      dollarDiff: psa9Diff,
      percentDiff: psa9Percent,
      description: `PSA 9 is $${psa9Diff.toFixed(2)} (${psa9Percent > 0 ? '+' : ''}${psa9Percent.toFixed(1)}%) more than Raw`
    };
  }

  if (analysis.raw.avgPrice > 0 && analysis.psa10.avgPrice > 0) {
    const psa10Diff = analysis.psa10.avgPrice - analysis.raw.avgPrice;
    const psa10Percent = (psa10Diff / analysis.raw.avgPrice) * 100;
    analysis.comparisons.rawToPsa10 = {
      dollarDiff: psa10Diff,
      percentDiff: psa10Percent,
      description: `PSA 10 is $${psa10Diff.toFixed(2)} (${psa10Percent > 0 ? '+' : ''}${psa10Percent.toFixed(1)}%) more than Raw`
    };
  }

  if (analysis.psa9.avgPrice > 0 && analysis.psa10.avgPrice > 0) {
    const psa10Diff = analysis.psa10.avgPrice - analysis.psa9.avgPrice;
    const psa10Percent = (psa10Diff / analysis.psa9.avgPrice) * 100;
    analysis.comparisons.psa9ToPsa10 = {
      dollarDiff: psa10Diff,
      percentDiff: psa10Percent,
      description: `PSA 10 is $${psa10Diff.toFixed(2)} (${psa10Percent > 0 ? '+' : ''}${psa10Percent.toFixed(1)}%) more than PSA 9`
    };
  }

  // CGC comparisons
  if (analysis.raw.avgPrice > 0 && analysis.cgc9.avgPrice > 0) {
    const cgc9Diff = analysis.cgc9.avgPrice - analysis.raw.avgPrice;
    const cgc9Percent = (cgc9Diff / analysis.raw.avgPrice) * 100;
    analysis.comparisons.rawToCgc9 = {
      dollarDiff: cgc9Diff,
      percentDiff: cgc9Percent,
      description: `CGC 9 is $${cgc9Diff.toFixed(2)} (${cgc9Percent > 0 ? '+' : ''}${cgc9Percent.toFixed(1)}%) more than Raw`
    };
  }

  if (analysis.raw.avgPrice > 0 && analysis.cgc10.avgPrice > 0) {
    const cgc10Diff = analysis.cgc10.avgPrice - analysis.raw.avgPrice;
    const cgc10Percent = (cgc10Diff / analysis.raw.avgPrice) * 100;
    analysis.comparisons.rawToCgc10 = {
      dollarDiff: cgc10Diff,
      percentDiff: cgc10Percent,
      description: `CGC 10 is $${cgc10Diff.toFixed(2)} (${cgc10Percent > 0 ? '+' : ''}${cgc10Percent.toFixed(1)}%) more than Raw`
    };
  }

  if (analysis.cgc9.avgPrice > 0 && analysis.cgc10.avgPrice > 0) {
    const cgc10Diff = analysis.cgc10.avgPrice - analysis.cgc9.avgPrice;
    const cgc10Percent = (cgc10Diff / analysis.cgc9.avgPrice) * 100;
    analysis.comparisons.cgc9ToCgc10 = {
      dollarDiff: cgc10Diff,
      percentDiff: cgc10Percent,
      description: `CGC 10 is $${cgc10Diff.toFixed(2)} (${cgc10Percent > 0 ? '+' : ''}${cgc10Percent.toFixed(1)}%) more than CGC 9`
    };
  }

  // PSA 7 and 8 comparisons
  if (analysis.raw.avgPrice > 0 && analysis.psa7.avgPrice > 0) {
    const psa7Diff = analysis.psa7.avgPrice - analysis.raw.avgPrice;
    const psa7Percent = (psa7Diff / analysis.raw.avgPrice) * 100;
    analysis.comparisons.rawToPsa7 = {
      dollarDiff: psa7Diff,
      percentDiff: psa7Percent,
      description: `PSA 7 is $${psa7Diff.toFixed(2)} (${psa7Percent > 0 ? '+' : ''}${psa7Percent.toFixed(1)}%) more than Raw`
    };
  }

  if (analysis.raw.avgPrice > 0 && analysis.psa8.avgPrice > 0) {
    const psa8Diff = analysis.psa8.avgPrice - analysis.raw.avgPrice;
    const psa8Percent = (psa8Diff / analysis.raw.avgPrice) * 100;
    analysis.comparisons.rawToPsa8 = {
      dollarDiff: psa8Diff,
      percentDiff: psa8Percent,
      description: `PSA 8 is $${psa8Diff.toFixed(2)} (${psa8Percent > 0 ? '+' : ''}${psa8Percent.toFixed(1)}%) more than Raw`
    };
  }

  // AiGrade comparisons
  if (analysis.raw.avgPrice > 0 && analysis.aigrade9.avgPrice > 0) {
    const aigrade9Diff = analysis.aigrade9.avgPrice - analysis.raw.avgPrice;
    const aigrade9Percent = (aigrade9Diff / analysis.raw.avgPrice) * 100;
    analysis.comparisons.rawToAigrade9 = {
      dollarDiff: aigrade9Diff,
      percentDiff: aigrade9Percent,
      description: `AiGrade 9 is $${aigrade9Diff.toFixed(2)} (${aigrade9Percent > 0 ? '+' : ''}${aigrade9Percent.toFixed(1)}%) more than Raw`
    };
  }

  if (analysis.raw.avgPrice > 0 && analysis.aigrade10.avgPrice > 0) {
    const aigrade10Diff = analysis.aigrade10.avgPrice - analysis.raw.avgPrice;
    const aigrade10Percent = (aigrade10Diff / analysis.raw.avgPrice) * 100;
    analysis.comparisons.rawToAigrade10 = {
      dollarDiff: aigrade10Diff,
      percentDiff: aigrade10Percent,
      description: `AiGrade 10 is $${aigrade10Diff.toFixed(2)} (${aigrade10Percent > 0 ? '+' : ''}${aigrade10Percent.toFixed(1)}%) more than Raw`
    };
  }

  // Other Graded comparisons
  if (analysis.raw.avgPrice > 0 && analysis.otherGraded.avgPrice > 0) {
    const otherGradedDiff = analysis.otherGraded.avgPrice - analysis.raw.avgPrice;
    const otherGradedPercent = (otherGradedDiff / analysis.raw.avgPrice) * 100;
    analysis.comparisons.rawToOtherGraded = {
      dollarDiff: otherGradedDiff,
      percentDiff: otherGradedPercent,
      description: `Other Graded is $${otherGradedDiff.toFixed(2)} (${otherGradedPercent > 0 ? '+' : ''}${otherGradedPercent.toFixed(1)}%) more than Raw`
    };
  }

  // Log price analysis
  console.log('\n=== PRICE ANALYSIS ===');
  console.log(`Raw Cards: ${analysis.raw.count} items, Avg: $${analysis.raw.avgPrice.toFixed(2)}, Trend: ${analysis.raw.trend.toUpperCase()}`);
  console.log(`PSA 7 Cards: ${analysis.psa7.count} items, Avg: $${analysis.psa7.avgPrice.toFixed(2)}, Trend: ${analysis.psa7.trend.toUpperCase()}`);
  console.log(`PSA 8 Cards: ${analysis.psa8.count} items, Avg: $${analysis.psa8.avgPrice.toFixed(2)}, Trend: ${analysis.psa8.trend.toUpperCase()}`);
  console.log(`PSA 9 Cards: ${analysis.psa9.count} items, Avg: $${analysis.psa9.avgPrice.toFixed(2)}, Trend: ${analysis.psa9.trend.toUpperCase()}`);
  console.log(`PSA 10 Cards: ${analysis.psa10.count} items, Avg: $${analysis.psa10.avgPrice.toFixed(2)}, Trend: ${analysis.psa10.trend.toUpperCase()}`);
  console.log(`CGC 9 Cards: ${analysis.cgc9.count} items, Avg: $${analysis.cgc9.avgPrice.toFixed(2)}, Trend: ${analysis.cgc9.trend.toUpperCase()}`);
  console.log(`CGC 10 Cards: ${analysis.cgc10.count} items, Avg: $${analysis.cgc10.avgPrice.toFixed(2)}, Trend: ${analysis.cgc10.trend.toUpperCase()}`);
  console.log(`TAG 8 Cards: ${analysis.tag8.count} items, Avg: $${analysis.tag8.avgPrice.toFixed(2)}, Trend: ${analysis.tag8.trend.toUpperCase()}`);
  console.log(`TAG 9 Cards: ${analysis.tag9.count} items, Avg: $${analysis.tag9.avgPrice.toFixed(2)}, Trend: ${analysis.tag9.trend.toUpperCase()}`);
  console.log(`TAG 10 Cards: ${analysis.tag10.count} items, Avg: $${analysis.tag10.avgPrice.toFixed(2)}, Trend: ${analysis.tag10.trend.toUpperCase()}`);
  console.log(`SGC 10 Cards: ${analysis.sgc10.count} items, Avg: $${analysis.sgc10.avgPrice.toFixed(2)}, Trend: ${analysis.sgc10.trend.toUpperCase()}`);
  console.log(`AiGrade 9 Cards: ${analysis.aigrade9.count} items, Avg: $${analysis.aigrade9.avgPrice.toFixed(2)}, Trend: ${analysis.aigrade9.trend.toUpperCase()}`);
  console.log(`AiGrade 10 Cards: ${analysis.aigrade10.count} items, Avg: $${analysis.aigrade10.avgPrice.toFixed(2)}, Trend: ${analysis.aigrade10.trend.toUpperCase()}`);
  console.log(`Other Graded Cards: ${analysis.otherGraded.count} items, Avg: $${analysis.otherGraded.avgPrice.toFixed(2)}, Trend: ${analysis.otherGraded.trend.toUpperCase()}`);
  
  if (analysis.comparisons.rawToPsa9) {
    console.log(`Raw → PSA 9: ${analysis.comparisons.rawToPsa9.description}`);
  }
  if (analysis.comparisons.rawToPsa10) {
    console.log(`Raw → PSA 10: ${analysis.comparisons.rawToPsa10.description}`);
  }
  if (analysis.comparisons.psa9ToPsa10) {
    console.log(`PSA 9 → PSA 10: ${analysis.comparisons.psa9ToPsa10.description}`);
  }
  if (analysis.comparisons.rawToCgc9) {
    console.log(`Raw → CGC 9: ${analysis.comparisons.rawToCgc9.description}`);
  }
  if (analysis.comparisons.rawToCgc10) {
    console.log(`Raw → CGC 10: ${analysis.comparisons.rawToCgc10.description}`);
  }
  if (analysis.comparisons.cgc9ToCgc10) {
    console.log(`CGC 9 → CGC 10: ${analysis.comparisons.cgc9ToCgc10.description}`);
  }
  if (analysis.comparisons.rawToPsa7) {
    console.log(`Raw → PSA 7: ${analysis.comparisons.rawToPsa7.description}`);
  }
  if (analysis.comparisons.rawToPsa8) {
    console.log(`Raw → PSA 8: ${analysis.comparisons.rawToPsa8.description}`);
  }
  if (analysis.comparisons.rawToAigrade9) {
    console.log(`Raw → AiGrade 9: ${analysis.comparisons.rawToAigrade9.description}`);
  }
  if (analysis.comparisons.rawToAigrade10) {
    console.log(`Raw → AiGrade 10: ${analysis.comparisons.rawToAigrade10.description}`);
  }
  if (analysis.comparisons.rawToOtherGraded) {
    console.log(`Raw → Other Graded: ${analysis.comparisons.rawToOtherGraded.description}`);
  }
  console.log('=== END PRICE ANALYSIS ===\n');

  return analysis;
};

// Helper function to fetch data until we have enough for each category
const fetchDataForEachCategory = async (searchQuery, targetPerCategory = 25) => {
  let allCards = [];
  let attempts = 0;
  const maxAttempts = 5; // Prevent infinite loops
  
  while (attempts < maxAttempts) {
    attempts++;
    console.log(`🔄 Fetch attempt ${attempts}: Current totals - Raw: ${allCards.filter(card => {
      const title = card.title?.toLowerCase() || '';
      return !title.includes('psa 7') && !title.includes('psa7') && !title.includes('psa 8') && !title.includes('psa8') && 
             !title.includes('psa 9') && !title.includes('psa9') && !title.includes('psa 10') && !title.includes('psa10');
    }).length}, PSA 7: ${allCards.filter(card => {
      const title = card.title?.toLowerCase() || '';
      return title.includes('psa 7') || title.includes('psa7');
    }).length}, PSA 8: ${allCards.filter(card => {
      const title = card.title?.toLowerCase() || '';
      return title.includes('psa 8') || title.includes('psa8');
    }).length}, PSA 9: ${allCards.filter(card => {
      const title = card.title?.toLowerCase() || '';
      return title.includes('psa 9') || title.includes('psa9');
    }).length}, PSA 10: ${allCards.filter(card => {
      const title = card.title?.toLowerCase() || '';
      return title.includes('psa 10') || title.includes('psa10');
    }).length}`);
    
    // Calculate how many more we need to fetch
    const currentBatchSize = Math.max(50, targetPerCategory * 2); // Fetch more to ensure we get enough
    
    // Fetch data from both sources
    const [ebayApiCards, ebayScrapedCards] = await Promise.allSettled([
      ebayService.searchSoldItems({ 
        keywords: searchQuery, 
        numSales: currentBatchSize 
      }),
      // ebayScraperService.scrapeEbaySales(searchQuery, currentBatchSize)
    ]);
    
    // Add new cards to our collection
    if (ebayApiCards.status === 'fulfilled') {
      allCards = allCards.concat(ebayApiCards.value);
      console.log(`✅ eBay API: ${ebayApiCards.value.length} sold items found`);
    }
    
    if (ebayScrapedCards.status === 'fulfilled') {
      // Use scraped cards as-is (no enrichment)
      allCards = allCards.concat(ebayScrapedCards.value);
      console.log(`✅ eBay Scraped: ${ebayScrapedCards.value.length} sold items found`);
    } else {
      console.log('❌ eBay scraping failed:', ebayScrapedCards.reason);
    }
    
    // Remove duplicates based on title and price
    const uniqueCards = [];
    const seen = new Set();
    
    allCards.forEach(card => {
      const key = `${card.title}-${card.price?.value}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueCards.push(card);
      }
    });
    
    allCards = uniqueCards;
    
    // Categorize and check if we have enough
    const categorized = categorizeCards(allCards);
    
    const hasEnoughRaw = categorized.raw.length >= targetPerCategory;
    const hasEnoughPsa7 = categorized.psa7.length >= targetPerCategory;
    const hasEnoughPsa8 = categorized.psa8.length >= targetPerCategory;
    const hasEnoughPsa9 = categorized.psa9.length >= targetPerCategory;
    const hasEnoughPsa10 = categorized.psa10.length >= targetPerCategory;
    
    console.log(`📊 After attempt ${attempts}: Raw: ${categorized.raw.length}, PSA 7: ${categorized.psa7.length}, PSA 8: ${categorized.psa8.length}, PSA 9: ${categorized.psa9.length}, PSA 10: ${categorized.psa10.length}`);
    
    // If we have enough for all categories, break
    if (hasEnoughRaw && hasEnoughPsa7 && hasEnoughPsa8 && hasEnoughPsa9 && hasEnoughPsa10) {
      console.log(`✅ Successfully collected enough data for all categories after ${attempts} attempts`);
      break;
    }
    
    // If we've tried enough times, break
    if (attempts >= maxAttempts) {
      console.log(`⚠️ Reached maximum attempts (${maxAttempts}). Using available data.`);
      break;
    }
    
    // Wait a bit before next attempt to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return allCards;
};

// Helper function to sort by value (price)
const sortByValue = (categorized) => {
  const sortByValue = (a, b) => {
    const priceA = parseFloat(a.price?.value || 0);
    const priceB = parseFloat(b.price?.value || 0);
    return priceB - priceA; // Highest value first
  };

  // Helper function to safely sort arrays
  const safeSort = (array) => {
    if (Array.isArray(array) && array.length > 0) {
      return array.sort(sortByValue);
    }
    return array || [];
  };

  // Debug: Log PSA 10 count before sorting
  console.log('=== BEFORE SORT ===');
  console.log('PSA10 count before sort:', categorized.psa10?.length || 0);
  if (categorized.psa10 && Array.isArray(categorized.psa10)) {
    categorized.psa10.forEach(card => {
      console.log(`[BEFORE SORT] Title: ${card.title}, Price: ${card.price?.value}, ItemId: ${card.id || card.itemId}`);
    });
  }
  console.log('=== END BEFORE SORT ===');

  // Safely sort each category
  categorized.raw = safeSort(categorized.raw);
  categorized.psa7 = safeSort(categorized.psa7);
  categorized.psa8 = safeSort(categorized.psa8);
  categorized.psa9 = safeSort(categorized.psa9);
  categorized.psa10 = safeSort(categorized.psa10);
  
  // Debug: Log PSA 10 count after sorting
  console.log('=== AFTER SORT ===');
  console.log('PSA10 count after sort:', categorized.psa10?.length || 0);
  if (categorized.psa10 && Array.isArray(categorized.psa10)) {
    categorized.psa10.forEach(card => {
      console.log(`[AFTER SORT] Title: ${card.title}, Price: ${card.price?.value}, ItemId: ${card.id || card.itemId}`);
    });
  }
  console.log('=== END AFTER SORT ===');
  
  categorized.cgc9 = safeSort(categorized.cgc9);
  categorized.cgc10 = safeSort(categorized.cgc10);
  categorized.tag8 = safeSort(categorized.tag8);
  categorized.tag9 = safeSort(categorized.tag9);
  categorized.tag10 = safeSort(categorized.tag10);
  categorized.sgc10 = safeSort(categorized.sgc10);
  categorized.aigrade9 = safeSort(categorized.aigrade9);
  categorized.aigrade10 = safeSort(categorized.aigrade10);
  categorized.otherGraded = safeSort(categorized.otherGraded);

  return categorized;
};

const sortByDate = (categorized) => {
  const sortByDate = (a, b) => {
    const dateA = new Date(a.soldDate || 0);
    const dateB = new Date(b.soldDate || 0);
    return dateB - dateA; // Most recent first
  };

  // Helper function to safely sort arrays
  const safeSort = (array) => {
    if (Array.isArray(array) && array.length > 0) {
      return array.sort(sortByDate);
    }
    return array || [];
  };

  // Safely sort each category by date
  categorized.raw = safeSort(categorized.raw);
  categorized.psa7 = safeSort(categorized.psa7);
  categorized.psa8 = safeSort(categorized.psa8);
  categorized.psa9 = safeSort(categorized.psa9);
  categorized.psa10 = safeSort(categorized.psa10);
  categorized.cgc9 = safeSort(categorized.cgc9);
  categorized.cgc10 = safeSort(categorized.cgc10);
  categorized.tag8 = safeSort(categorized.tag8);
  categorized.tag9 = safeSort(categorized.tag9);
  categorized.tag10 = safeSort(categorized.tag10);
  categorized.sgc10 = safeSort(categorized.sgc10);
  categorized.aigrade9 = safeSort(categorized.aigrade9);
  categorized.aigrade10 = safeSort(categorized.aigrade10);
  categorized.otherGraded = safeSort(categorized.otherGraded);

  return categorized;
};

// Test endpoint for 130point service
router.get('/test-130point', async (req, res) => {
  try {
    console.log('🧪 Testing 130point service...');
    
    const testResult = await onepointService.search130point('baseball card', 2);
    
    res.json({
      success: true,
      message: '130point test completed',
      results: testResult,
      count: testResult.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('130point test error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Test endpoint for eBay scraping service
router.get('/test-ebay-scraping', async (req, res) => {
  try {
    console.log('🧪 Testing eBay scraping service...');
    
    const testResult = await ebayScraperService.scrapeEbaySales('baseball card', 3);
    
    res.json({
      success: true,
      message: 'eBay scraping test completed',
      results: testResult,
      count: testResult.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('eBay scraping test error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});



// GET /api/rate-limits - Check eBay API rate limits
router.get('/rate-limits', async (req, res) => {
  try {
    const [rateLimits, onepointStatus] = await Promise.allSettled([
      ebayService.checkRateLimits(),
      onepointService.check130pointStatus()
    ]);
    
    // Format the response for better readability
    const response = {
      timestamp: new Date().toISOString(),
      environment: {
        type: 'PRODUCTION',
        hasMarketplaceInsightsAPI: !!process.env.EBAY_AUTH_TOKEN
      },
      apis: {
        marketplaceInsights: {
          working: rateLimits.status === 'fulfilled' && rateLimits.value.marketplaceInsights?.success || false,
          status: (rateLimits.status === 'fulfilled' && rateLimits.value.marketplaceInsights?.success) ? '✅ Working (Production)' : '❌ Not Working',
          rateLimits: rateLimits.status === 'fulfilled' ? rateLimits.value.marketplaceInsights?.data?.rateLimits || null : null,
          error: rateLimits.status === 'fulfilled' ? rateLimits.value.marketplaceInsights?.error || null : rateLimits.reason,
          httpStatus: rateLimits.status === 'fulfilled' ? rateLimits.value.marketplaceInsights?.status || null : null
        },
        onepoint: {
          working: onepointStatus.status === 'fulfilled' && onepointStatus.value.success || false,
          status: (onepointStatus.status === 'fulfilled' && onepointStatus.value.success) ? '✅ Working (130point.com)' : '❌ Not Working',
          rateLimits: null, // 130point doesn't provide rate limits
          error: onepointStatus.status === 'fulfilled' ? onepointStatus.value.error || null : onepointStatus.reason,
          httpStatus: onepointStatus.status === 'fulfilled' ? onepointStatus.value.status || null : null
        }
      },
      summary: {
        workingAPIs: [
          rateLimits.status === 'fulfilled' && rateLimits.value.marketplaceInsights?.success,
          onepointStatus.status === 'fulfilled' && onepointStatus.value.success
        ].filter(Boolean).length,
        totalAPIs: 2
      },
      tips: {
        marketplaceInsightsAPI: "~5,000 calls/day for sold item searches",
        onepointAPI: "Web scraping with rate limiting (2s between requests)",
        environment: "Currently using eBay Production + 130point.com",
        note: "Real data from live eBay marketplace + 130point.com sales"
      }
    };
    
    res.json(response);
  } catch (error) {
    console.error('Rate limit check error:', error);
    res.status(500).json({ 
      error: 'Failed to check rate limits', 
      details: error.message 
    });
  }
});

// GET /api/ebay-usage - Returns eBay API usage and rate limit info
router.get('/ebay-usage', async (req, res) => {
  try {
    const usage = await getEbayApiUsage();
    if (!usage) {
      return res.status(500).json({ error: 'Failed to fetch eBay API usage' });
    }
    res.json(usage);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/search-cards (for testing with query parameters)
router.get('/', async (req, res) => {
  const { searchQuery, numSales = 10 } = req.query;
  
  // Validate required parameters
  if (!searchQuery) {
    return res.status(400).json({ 
      error: 'Missing required parameter: searchQuery',
      example: '/api/search-cards?searchQuery=Mike Trout 2011 Topps Update&numSales=10'
    });
  }

  try {
    // Check if eBay token is available
    if (!process.env.EBAY_AUTH_TOKEN) {
      console.log('No eBay token found, returning mock data for testing');
      const mockData = getMockData(searchQuery, parseInt(numSales));
      const categorized = categorizeCards(mockData);
      const sorted = sortByValue(categorized);
      return res.json({ 
        searchParams: { searchQuery, numSales },
        results: sorted,
        priceAnalysis: sorted.priceAnalysis,
        note: "Mock data - set EBAY_AUTH_TOKEN in .env for real data"
      });
    }

    // Fetch the last 100 sales from eBay... (temporarily disabled)
    // const [ebayApiCards, ebayScrapedCards] = await Promise.allSettled([
    //   ebayService.searchSoldItems({ keywords: searchQuery, numSales: 100 }),
    //   ebayScraperService.scrapeEbaySales(searchQuery, 100)
    // ]);
    // TEMP: Log when using 130point as the primary data source
    console.log(`[130POINT] Using 130point service for sold items search: "${searchQuery}" at ${new Date().toISOString()}`);
    const point130Cards = await point130Service.search130point(searchQuery, 100);
    let allCards = point130Cards;
    // let allCards = [];
    // if (ebayApiCards.status === 'fulfilled') {
    //   allCards = allCards.concat(ebayApiCards.value);
    //   console.log(`✅ eBay API: ${ebayApiCards.value.length} sold items found`);
    // } else {
    //   console.log('❌ eBay API search failed:', ebayApiCards.reason);
    // }
    // if (ebayScrapedCards.status === 'fulfilled') {
    //   allCards = allCards.concat(ebayScrapedCards.value);
    //   console.log(`✅ eBay Scraped: ${ebayScrapedCards.value.length} sold items found`);
    // } else {
    //   console.log('❌ eBay scraping failed:', ebayScrapedCards.reason);
    // }

    // Remove duplicates based on title and price
    const uniqueCards = [];
    const seen = new Set();
    
    allCards.forEach(card => {
      const key = `${card.title}-${card.price?.value}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueCards.push(card);
      }
    });
    
    allCards = uniqueCards;
    console.log(`📊 Total unique sold items: ${allCards.length}`);

    // Categorize and sort the results
    const categorized = categorizeCards(allCards);
    const sorted = sortByDate(categorized); // Sort by date for regular search

    // Add EPN tracking to all eBay URLs in the results
    const addTrackingToCards = (cards) => {
      if (!Array.isArray(cards)) return [];
      return cards.map(card => ({
        ...card,
        itemWebUrl: addEbayTracking(card.itemWebUrl)
      }));
    };

    // Apply tracking to all card categories
    sorted.raw = addTrackingToCards(sorted.raw);
    sorted.psa7 = addTrackingToCards(sorted.psa7);
    sorted.psa8 = addTrackingToCards(sorted.psa8);
    sorted.psa9 = addTrackingToCards(sorted.psa9);
    sorted.psa10 = addTrackingToCards(sorted.psa10);
    sorted.cgc9 = addTrackingToCards(sorted.cgc9);
    sorted.cgc10 = addTrackingToCards(sorted.cgc10);
    sorted.tag8 = addTrackingToCards(sorted.tag8);
    sorted.tag9 = addTrackingToCards(sorted.tag9);
    sorted.tag10 = addTrackingToCards(sorted.tag10);
    sorted.sgc10 = addTrackingToCards(sorted.sgc10);
    sorted.aigrade9 = addTrackingToCards(sorted.aigrade9);
    sorted.aigrade10 = addTrackingToCards(sorted.aigrade10);
    sorted.otherGraded = addTrackingToCards(sorted.otherGraded);

    // Add eBay API usage info (temporarily disabled)
    // let ebayApiUsage = null;
    // try {
    //   ebayApiUsage = await getEbayApiUsage();
    // } catch (usageError) {
    //   console.error('Failed to fetch eBay API usage:', usageError.message);
    // }

    // Debug: Log final PSA 10 cards being sent to frontend
    if (sorted.psa10 && Array.isArray(sorted.psa10)) {
      console.log('=== FINAL PSA10 CARDS SENT TO FRONTEND ===');
      console.log('PSA10 count in sorted:', sorted.psa10.length);
      sorted.psa10.forEach(card => {
        console.log(`[FINAL PSA10] Title: ${card.title}, Price: ${card.price?.value}, Source: ${card.source}, ItemId: ${card.id || card.itemId}`);
      });
      console.log('=== END FINAL PSA10 CARDS ===');
    }
    
    // Also check if gradingStats has PSA 10 cards
    if (sorted.gradingStats && sorted.gradingStats.psa && sorted.gradingStats.psa['10']) {
      console.log('=== GRADINGSTATS PSA10 IN FINAL RESPONSE ===');
      console.log('GS PSA10 count:', sorted.gradingStats.psa['10'].cards?.length || 0);
      if (sorted.gradingStats.psa['10'].cards && Array.isArray(sorted.gradingStats.psa['10'].cards)) {
        sorted.gradingStats.psa['10'].cards.forEach(card => {
          console.log(`[GS FINAL] Title: ${card.title}, Price: ${card.price?.value}, Source: ${card.source}, ItemId: ${card.id || card.itemId}`);
        });
      }
      console.log('=== END GRADINGSTATS PSA10 IN FINAL RESPONSE ===');
    }

    res.json({ 
      searchParams: { searchQuery, numSales: 25 },
      results: sorted,
      priceAnalysis: sorted.priceAnalysis,
      sources: {
        total: allCards.length,
        raw: sorted.raw.length,
        psa7: sorted.psa7.length,
        psa8: sorted.psa8.length,
        psa9: sorted.psa9.length,
        psa10: sorted.psa10.length,
        cgc9: sorted.cgc9.length,
        cgc10: sorted.cgc10.length,
        tag8: sorted.tag8.length,
        tag9: sorted.tag9.length,
        tag10: sorted.tag10.length,
        sgc10: sorted.sgc10.length,
        aigrade9: sorted.aigrade9.length,
        aigrade10: sorted.aigrade10.length,
        otherGraded: sorted.otherGraded.length
      },
      // ebayApiUsage // Include API usage in response
    });
  } catch (error) {
    // Improved error logging and safe access
    console.error('Search error:', error, error?.response?.status);
    res.status(500).json({ error: 'Failed to fetch card data', details: error?.message || error });
  } finally {
    clearTimeout(timeout);
  }
});

// POST /api/search-cards (for production use)
router.post('/', async (req, res) => {
  const { searchQuery, numSales = 10 } = req.body;
  console.log(`>>> POST /api/search-cards endpoint hit at ${new Date().toISOString()} with searchQuery: "${searchQuery}"`);
  
  // Validate required parameters
  if (!searchQuery) {
    return res.status(400).json({ 
      error: 'Missing required field: searchQuery',
      example: {
        searchQuery: "Mike Trout 2011 Topps Update Rookie",
        numSales: 10
      }
    });
  }

  // Set timeout for this request
  const timeout = setTimeout(() => {
    if (!res.headersSent) {
      res.status(408).json({
        error: 'Request timeout',
        message: 'The request took too long to process. Please try again.',
        timestamp: new Date().toISOString()
      });
    }
  }, 120000); // 2 minute timeout

  try {
    // Always fetch fresh data

    // Check if eBay token is available
    // (!process.env.EBAY_AUTH_TOKEN) {
    //console.log('No eBay token found, returning mock data for testing');
   // const mockData = getMockData(searchQuery, parseInt(numSales));
  //  const categorized = categorizeCards(mockData);
  //  const sorted = sortBySoldDate(categorized);
  //  clearTimeout(timeout);
  //  return res.json({ 
  //    searchParams: { searchQuery, numSales },
 //     results: sorted,
  //    priceAnalysis: sorted.priceAnalysis,
  //    note: "Mock data - set EBAY_AUTH_TOKEN in .env for real data"
  //  });
 // }

    // Fetch the last 100 sales from eBay... (temporarily disabled)
    // console.log(`🎯 Fetching last 100 sales from eBay...`);
    // const [ebayApiCards, ebayScrapedCards] = await Promise.allSettled([
    //   ebayService.searchSoldItems({ keywords: searchQuery, numSales: 100 }),
    //   ebayScraperService.scrapeEbaySales(searchQuery, 100)
    // ]);

    console.log(`[130POINT] Using 130point service for sold items search: "${searchQuery}" at ${new Date().toISOString()}`);
    let allCards = await point130Service.search130point(searchQuery, 500);

    // Filter out sealed products and hobby boxes (more precise filtering)
    const filteredCards = allCards.filter(card => {
      const title = (card.title || '').toLowerCase();
      
      // Only filter out clearly sealed products, not individual cards
      const sealedProductPatterns = [
        /\bhobby\s+box\b/i,
        /\bfactory\s+sealed\b/i,
        /\bsealed\s+box\b/i,
        /\bsealed\s+pack\b/i,
        /\bsealed\s+case\b/i,
        /\bbooster\s+box\b/i,
        /\bbooster\s+pack\b/i,
        /\bblaster\s+box\b/i,
        /\bblaster\s+pack\b/i,
        /\bfat\s+pack\b/i,
        /\bjumbo\s+pack\b/i,
        /\bretail\s+box\b/i,
        /\bretail\s+pack\b/i,
        /\bhanger\s+box\b/i,
        /\bhanger\s+pack\b/i,
        /\bvalue\s+pack\b/i,
        /\bvalue\s+box\b/i,
        /\bcomplete\s+set\b/i,
        /\bfactory\s+set\b/i,
        /\bsealed\s+product\b/i,
        /\bunopened\b/i,
        /\bsealed\s+item\b/i,
        /\bsealed\s+lot\b/i
      ];
      
      // Check if title matches any sealed product pattern
      const isSealedProduct = sealedProductPatterns.some(pattern => pattern.test(title));
      
      // Check for quantity indicators that suggest sealed products
      const hasQuantityIndicators = /\d+\s*(hobby\s+box|booster\s+box|blaster\s+box|retail\s+box|sealed\s+box|sealed\s+pack|sealed\s+case|lot\s+of|lots\s+of|bundle|complete\s+set|factory\s+set)/i.test(title);
      
      // Check for high-value items that are clearly sealed products
      const price = parseFloat(card.price?.value || 0);
      const isHighValueSealed = price > 200 && (
        title.includes('hobby box') || 
        title.includes('booster box') || 
        title.includes('blaster box') || 
        title.includes('complete set') ||
        title.includes('factory set') ||
        /\d+\s*(box|pack|case)/i.test(title)
      );
      
      // Only filter out if it's clearly a sealed product
      return !isSealedProduct && !hasQuantityIndicators && !isHighValueSealed;
    });

    console.log(`📊 Filtered out ${allCards.length - filteredCards.length} sealed products, keeping ${filteredCards.length} individual cards`);
    allCards = filteredCards;


    // Combine results from both eBay sources
    // let allCards = [];
    
    // if (ebayApiCards.status === 'fulfilled') {
    //   allCards = allCards.concat(ebayApiCards.value);
    //   console.log(`✅ eBay API: ${ebayApiCards.value.length} sold items found`);
    // } else {
    //   console.log('❌ eBay API search failed:', ebayApiCards.reason);
    // }
    
    // if (ebayScrapedCards.status === 'fulfilled') {
    //   allCards = allCards.concat(ebayScrapedCards.value);
    //   console.log(`✅ eBay Scraped: ${ebayScrapedCards.value.length} sold items found`);
    // } else {
    //   console.log('❌ eBay scraping failed:', ebayScrapedCards.reason);
    // }

    // Remove duplicates based on title and price
    const uniqueCards = [];
    const seen = new Set();
    
    allCards.forEach(card => {
      const key = `${card.title}-${card.price?.value}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueCards.push(card);
      }
    });
    
    allCards = uniqueCards;
    console.log(`📊 Total unique sold items: ${allCards.length}`);

    // Categorize and sort the results
    const categorized = categorizeCards(allCards);
    const sorted = sortByValue(categorized);

    // Add EPN tracking to all eBay URLs in the results
    const addTrackingToCards = (cards) => {
      if (!Array.isArray(cards)) return [];
      return cards.map(card => ({
        ...card,
        itemWebUrl: addEbayTracking(card.itemWebUrl)
      }));
    };

    // Apply tracking to all card categories
    sorted.raw = addTrackingToCards(sorted.raw);
    sorted.psa7 = addTrackingToCards(sorted.psa7);
    sorted.psa8 = addTrackingToCards(sorted.psa8);
    sorted.psa9 = addTrackingToCards(sorted.psa9);
    sorted.psa10 = addTrackingToCards(sorted.psa10);
    sorted.cgc9 = addTrackingToCards(sorted.cgc9);
    sorted.cgc10 = addTrackingToCards(sorted.cgc10);
    sorted.tag8 = addTrackingToCards(sorted.tag8);
    sorted.tag9 = addTrackingToCards(sorted.tag9);
    sorted.tag10 = addTrackingToCards(sorted.tag10);
    sorted.sgc10 = addTrackingToCards(sorted.sgc10);
    sorted.aigrade9 = addTrackingToCards(sorted.aigrade9);
    sorted.aigrade10 = addTrackingToCards(sorted.aigrade10);
    sorted.otherGraded = addTrackingToCards(sorted.otherGraded);

    // Save the search to history only if there are results
    if (allCards.length > 0) {
      try {
        // Use the new Redis-based function with a default user
        // In a real app, you'd get the user from req.user or session
        const defaultUser = { id: 'default', email: 'default@example.com' };
        await searchHistoryService.addSearchForUser(defaultUser, {
          searchQuery,
          results: sorted,
          priceAnalysis: sorted.priceAnalysis
        });
        console.log(`💾 Saved search: "${searchQuery}" (${allCards.length} cards found)`);
      } catch (error) {
        console.log('⚠️ Failed to save search to history:', error.message);
        // Don't fail the request if saving history fails
      }
    } else {
      console.log(`⚠️ Not saving search with 0 results: "${searchQuery}"`);
    }

    const responseData = { 
      searchParams: { searchQuery, numSales },
      results: sorted,
      priceAnalysis: sorted.priceAnalysis,
      sources: {
        // ebayApi: ebayApiCards.status === 'fulfilled' ? ebayApiCards.value.length : 0,
        // ebayScraped: ebayScrapedCards.status === 'fulfilled' ? ebayScrapedCards.value.length : 0,
        total: allCards.length,
        raw: sorted.raw.length,
        psa7: sorted.psa7.length,
        psa8: sorted.psa8.length,
        psa9: sorted.psa9.length,
        psa10: sorted.psa10.length,
        cgc9: sorted.cgc9.length,
        cgc10: sorted.cgc10.length,
        tag8: sorted.tag8.length,
        tag9: sorted.tag9.length,
        tag10: sorted.tag10.length,
        sgc10: sorted.sgc10.length,
        aigrade9: sorted.aigrade9.length,
        aigrade10: sorted.aigrade10.length,
        otherGraded: sorted.otherGraded.length
      },
      debug: 'psa10 filter active'
    };

    // Add eBay API usage info (temporarily disabled)
    // let ebayApiUsage = null;
    // try {
    //   ebayApiUsage = await getEbayApiUsage();
    // } catch (usageError) {
    //   console.error('Failed to fetch eBay API usage:', usageError.message);
    // }
    // responseData.ebayApiUsage = ebayApiUsage;

    // Debug: Log all PSA 10 cards in the final response
    if (sorted.psa10 && Array.isArray(sorted.psa10)) {
      console.log('=== FINAL PSA10 CARDS SENT TO FRONTEND ===');
      sorted.psa10.forEach(card => {
        console.log(`[FINAL PSA10] Title: ${card.title}, Price: ${card.price?.value}, Source: ${card.source}, ItemId: ${card.id || card.itemId}`);
      });
      console.log('=== END FINAL PSA10 CARDS ===');
    }

    clearTimeout(timeout);
    res.json(responseData);
    // Only cache if there are results in raw, PSA 9, or PSA 10
    if (
      responseData.results &&
      (
        (responseData.results.raw && responseData.results.raw.length > 0) ||
        (responseData.results.psa9 && responseData.results.psa9.length > 0) ||
        (responseData.results.psa10 && responseData.results.psa10.length > 0)
      )
    ) {
      const cacheKey = cacheService.generateSearchKey(searchQuery, { numSales });
      await cacheService.set(cacheKey, responseData, cacheService.searchTTL || 1800);
      console.log(`💾 Cached search results for: ${searchQuery}`);
    }
  } catch (error) {
    // Improved error logging and safe access
    console.error('Search error:', error, error?.response?.status);
    clearTimeout(timeout);
    res.status(500).json({ error: 'Failed to fetch card data', details: error?.message || error });
  }
});

// GET /api/card-set-suggestions - Route for card set autocomplete
router.get('/card-set-suggestions', async (req, res) => {
  const { query = '', limit = 10 } = req.query;
  
  // Define fallback sets to avoid scope issues
  const fallbackSets = [
    { id: "topps_series_one", name: "Topps Series One", brand: "Topps", category: "Baseball", sport: "Baseball", league: "MLB", years: ["2025", "2024", "2023"], setType: "Base Set", description: "Annual flagship baseball set", popularity: 9.5, source: "Manual" },
    { id: "topps_chrome", name: "Topps Chrome", brand: "Topps", category: "Baseball", sport: "Baseball", league: "MLB", years: ["2024", "2023", "2022"], setType: "Premium Set", description: "Premium chrome version", popularity: 9.2, source: "Manual" },
    { id: "panini_prizm", name: "Panini Prizm", brand: "Panini", category: "Basketball", sport: "Basketball", league: "NBA", years: ["2024", "2023", "2022"], setType: "Premium Set", description: "Premium basketball set", popularity: 9.4, source: "Manual" },
    { id: "upper_deck", name: "Upper Deck", brand: "Upper Deck", category: "Hockey", sport: "Hockey", league: "NHL", years: ["2024", "2023", "2022"], setType: "Base Set", description: "Base hockey set", popularity: 8.2, source: "Manual" }
  ];
  
  try {
    console.log(`[CARD SET SUGGESTIONS] Request received: query="${query}", limit=${limit}`);
    
    // Try to load comprehensive database file first
    let databaseSuggestions = [];
    try {
      console.log('[CARD SET SUGGESTIONS] Loading comprehensive card database...');
      const databasePath = path.join(__dirname, '../data/comprehensiveCardDatabase.json');
      const databaseData = await fs.readFile(databasePath, 'utf8');
      const database = JSON.parse(databaseData);
      
      if (database && database.sets && database.sets.length > 0) {
        console.log(`[CARD SET SUGGESTIONS] Loaded comprehensive database with ${database.sets.length} card sets`);
        
        // Search the database
        if (query.trim()) {
          const searchTerm = query.toLowerCase();
          const searchWords = searchTerm.split(' ').filter(word => word.length > 1);
          
          // First, filter matching sets
          const matchingSets = database.sets.filter(set => {
            const setName = (set.name || '').toLowerCase();
            const setBrand = (set.brand || '').toLowerCase();
            const setSet = (set.setName || '').toLowerCase();
            const setYear = (set.year || '').toLowerCase();
            const setSport = (set.sport || '').toLowerCase();
            const setDisplayName = (set.displayName || '').toLowerCase();
            
            // Debug: Log all items being processed
            console.log(`[DEBUG] Processing item: "${setDisplayName || setName}"`);
            
            // Filter out sealed products
            const sealedProductPatterns = [
              /\bhobby\s+case\b/i,
              /\bhobby\s+box\b/i,
              /\bbooster\s+box\b/i,
              /\bbooster\s+pack\b/i,
              /\bblaster\s+box\b/i,
              /\bblaster\s+pack\b/i,
              /\bfat\s+pack\b/i,
              /\bjumbo\s+pack\b/i,
              /\bjumbo\b/i,  // Add standalone JUMBO
              /\bretail\s+box\b/i,
              /\bretail\s+pack\b/i,
              /\bhanger\s+box\b/i,
              /\bhanger\s+pack\b/i,
              /\bvalue\s+pack\b/i,
              /\bvalue\s+box\b/i,
              /\bcomplete\s+set\b/i,
              /\bfactory\s+set\b/i,
              /\bsealed\s+product\b/i,
              /\bsealed\s+box\b/i,
              /\bsealed\s+pack\b/i,
              /\bsealed\s+case\b/i,
              /\bunopened\b/i,
              /\bsealed\s+item\b/i,
              /\bsealed\s+lot\b/i,
              /\bfactory\s+sealed\b/i,
              /\bcase\s+break\b/i,
              /\bbreak\s+case\b/i,
              /\bwax\s+box\b/i,
              /\bcellos?\b/i,
              /\bwrappers?\b/i
            ];
            
            // Check if any field contains sealed product terms
            const isSealedProduct = sealedProductPatterns.some(pattern => 
              pattern.test(setName) || 
              pattern.test(setBrand) || 
              pattern.test(setSet) || 
              pattern.test(setDisplayName) ||
              pattern.test(set.searchText || '')  // Also check searchText field
            );
            
            // Additional specific checks for common sealed product patterns
            const additionalSealedChecks = [
              /\bjumbo\s+hobby\s+case\b/i,
              /\bhobby\s+case\b/i,
              /\bjumbo\s+box\b/i,
              /\bjumbo\s+pack\b/i,
              /\bcase\s+of\b/i,
              /\bsealed\s+case\b/i
            ];
            
            const hasAdditionalSealedTerms = additionalSealedChecks.some(pattern => 
              pattern.test(setName) || 
              pattern.test(setBrand) || 
              pattern.test(setSet) || 
              pattern.test(setDisplayName) ||
              pattern.test(set.searchText || '')
            );
            
            if (isSealedProduct || hasAdditionalSealedTerms) {
              console.log(`[FILTERED OUT] Sealed product detected: ${set.displayName || set.name} - Pattern matched`);
              return false; // Exclude sealed products
            }
            
            // Check if any search word matches any part of the set
            const hasMatch = searchWords.some(word => 
              setName.includes(word) || 
              setBrand.includes(word) || 
              setSet.includes(word) ||
              setYear.includes(word) ||
              setSport.includes(word) ||
              setDisplayName.includes(word)
            );
            
            // Also check for exact phrase match
            const exactMatch = setName.includes(searchTerm) || 
                              setBrand.includes(searchTerm) || 
                              setSet.includes(searchTerm) ||
                              setYear.includes(searchTerm) ||
                              setSport.includes(searchTerm) ||
                              setDisplayName.includes(searchTerm);
            
            const shouldInclude = hasMatch || exactMatch;
            console.log(`[DEBUG] Item "${setDisplayName || setName}" - Include: ${shouldInclude} (hasMatch: ${hasMatch}, exactMatch: ${exactMatch})`);
            
            return shouldInclude;
          });
          
          // Then, score and sort by relevance
          databaseSuggestions = matchingSets.map(set => {
            const setName = (set.name || '').toLowerCase();
            const setBrand = (set.brand || '').toLowerCase();
            const setSet = (set.setName || '').toLowerCase();
            const setYear = (set.year || '').toLowerCase();
            const setSport = (set.sport || '').toLowerCase();
            const setDisplayName = (set.displayName || '').toLowerCase();
            const year = parseInt(set.year);
            
            let score = 0;
            
            // Exact year match gets highest priority
            if (searchWords.includes(setYear)) {
              score += 1000;
            }
            
            // Recent years get higher priority
            if (year >= 2023) score += 100;
            else if (year >= 2020) score += 50;
            else if (year >= 2010) score += 25;
            
            // Exact phrase matches
            if (setDisplayName.includes(searchTerm)) score += 500;
            if (setName.includes(searchTerm)) score += 400;
            if (setBrand.includes(searchTerm)) score += 300;
            if (setSet.includes(searchTerm)) score += 200;
            
            // Word matches
            searchWords.forEach(word => {
              if (setDisplayName.includes(word)) score += 100;
              if (setName.includes(word)) score += 80;
              if (setBrand.includes(word)) score += 60;
              if (setSet.includes(word)) score += 40;
              if (setYear.includes(word)) score += 200; // Year matches are important
            });
            
            // Brand popularity bonus
            if (['Topps', 'Panini', 'Upper Deck', 'Donruss'].includes(set.brand)) {
              score += 10;
            }
            
            return { ...set, relevanceScore: score };
          }).sort((a, b) => b.relevanceScore - a.relevanceScore);
        } else {
          // Return popular sets if no query (filter by recent years and major brands)
          databaseSuggestions = database.sets
            .filter(set => {
              const year = parseInt(set.year);
              const isRecent = year >= 2020;
              const isMajorBrand = ['Topps', 'Panini', 'Upper Deck', 'Donruss'].includes(set.brand);
              return isRecent && isMajorBrand;
            })
            .slice(0, parseInt(limit));
        }
        
        console.log(`[CARD SET SUGGESTIONS] Database search returned ${databaseSuggestions.length} suggestions`);
      }
    } catch (error) {
      console.log('[CARD SET SUGGESTIONS] Database error:', error.message);
      console.log('[CARD SET SUGGESTIONS] Building comprehensive database on the fly...');
      
      // Build a comprehensive database on the fly when file is not available
      const onTheFlyDatabase = buildOnTheFlyDatabase();
      console.log(`[CARD SET SUGGESTIONS] Built on-the-fly database with ${onTheFlyDatabase.length} sets`);
      
      // Search the on-the-fly database
      if (query.trim()) {
        const searchTerm = query.toLowerCase();
        const searchWords = searchTerm.split(' ').filter(word => word.length > 1);
        
        // First, filter matching sets
        const matchingSets = onTheFlyDatabase.filter(set => {
          const setName = (set.name || '').toLowerCase();
          const setBrand = (set.brand || '').toLowerCase();
          const setSet = (set.setName || '').toLowerCase();
          const setYear = (set.year || '').toLowerCase();
          const setSport = (set.sport || '').toLowerCase();
          const setDisplayName = (set.displayName || '').toLowerCase();
          
          // Debug: Log all items being processed
          console.log(`[DEBUG] Processing item: "${setDisplayName || setName}"`);
          
          // Filter out sealed products
          const sealedProductPatterns = [
            /\bhobby\s+case\b/i,
            /\bhobby\s+box\b/i,
            /\bbooster\s+box\b/i,
            /\bbooster\s+pack\b/i,
            /\bblaster\s+box\b/i,
            /\bblaster\s+pack\b/i,
            /\bfat\s+pack\b/i,
            /\bjumbo\s+pack\b/i,
            /\bjumbo\b/i,  // Add standalone JUMBO
            /\bretail\s+box\b/i,
            /\bretail\s+pack\b/i,
            /\bhanger\s+box\b/i,
            /\bhanger\s+pack\b/i,
            /\bvalue\s+pack\b/i,
            /\bvalue\s+box\b/i,
            /\bcomplete\s+set\b/i,
            /\bfactory\s+set\b/i,
            /\bsealed\s+product\b/i,
            /\bsealed\s+box\b/i,
            /\bsealed\s+pack\b/i,
            /\bsealed\s+case\b/i,
            /\bunopened\b/i,
            /\bsealed\s+item\b/i,
            /\bsealed\s+lot\b/i,
            /\bfactory\s+sealed\b/i,
            /\bcase\s+break\b/i,
            /\bbreak\s+case\b/i,
            /\bwax\s+box\b/i,
            /\bcellos?\b/i,
            /\bwrappers?\b/i
          ];
          
          // Check if any field contains sealed product terms
          const isSealedProduct = sealedProductPatterns.some(pattern => 
            pattern.test(setName) || 
            pattern.test(setBrand) || 
            pattern.test(setSet) || 
            pattern.test(setDisplayName) ||
            pattern.test(set.searchText || '')  // Also check searchText field
          );
          
          // Additional specific checks for common sealed product patterns
          const additionalSealedChecks = [
            /\bjumbo\s+hobby\s+case\b/i,
            /\bhobby\s+case\b/i,
            /\bjumbo\s+box\b/i,
            /\bjumbo\s+pack\b/i,
            /\bcase\s+of\b/i,
            /\bsealed\s+case\b/i
          ];
          
          const hasAdditionalSealedTerms = additionalSealedChecks.some(pattern => 
            pattern.test(setName) || 
            pattern.test(setBrand) || 
            pattern.test(setSet) || 
            pattern.test(setDisplayName) ||
            pattern.test(set.searchText || '')
          );
          
          if (isSealedProduct || hasAdditionalSealedTerms) {
            console.log(`[FILTERED OUT] Sealed product detected: ${set.displayName || set.name} - Pattern matched`);
            return false; // Exclude sealed products
          }
          
          // Check if any search word matches any part of the set
          const hasMatch = searchWords.some(word => 
            setName.includes(word) || 
            setBrand.includes(word) || 
            setSet.includes(word) ||
            setYear.includes(word) ||
            setSport.includes(word) ||
            setDisplayName.includes(word)
          );
          
          // Also check for exact phrase match
          const exactMatch = setName.includes(searchTerm) || 
                            setBrand.includes(searchTerm) || 
                            setSet.includes(searchTerm) ||
                            setYear.includes(searchTerm) ||
                            setSport.includes(searchTerm) ||
                            setDisplayName.includes(searchTerm);
          
          const shouldInclude = hasMatch || exactMatch;
          console.log(`[DEBUG] Item "${setDisplayName || setName}" - Include: ${shouldInclude} (hasMatch: ${hasMatch}, exactMatch: ${exactMatch})`);
          
          return shouldInclude;
        });
        
        // Then, score and sort by relevance
        databaseSuggestions = matchingSets.map(set => {
          const setName = (set.name || '').toLowerCase();
          const setBrand = (set.brand || '').toLowerCase();
          const setSet = (set.setName || '').toLowerCase();
          const setYear = (set.year || '').toLowerCase();
          const setSport = (set.sport || '').toLowerCase();
          const setDisplayName = (set.displayName || '').toLowerCase();
          const year = parseInt(set.year);
          
          let score = 0;
          
          // Exact year match gets highest priority
          if (searchWords.includes(setYear)) {
            score += 1000;
          }
          
          // Recent years get higher priority
          if (year >= 2023) score += 100;
          else if (year >= 2020) score += 50;
          else if (year >= 2010) score += 25;
          
          // Exact phrase matches
          if (setDisplayName.includes(searchTerm)) score += 500;
          if (setName.includes(searchTerm)) score += 400;
          if (setBrand.includes(searchTerm)) score += 300;
          if (setSet.includes(searchTerm)) score += 200;
          
          // Word matches
          searchWords.forEach(word => {
            if (setDisplayName.includes(word)) score += 100;
            if (setName.includes(word)) score += 80;
            if (setBrand.includes(word)) score += 60;
            if (setSet.includes(word)) score += 40;
            if (setYear.includes(word)) score += 200; // Year matches are important
          });
          
          // Brand popularity bonus
          if (['Topps', 'Panini', 'Upper Deck', 'Donruss'].includes(set.brand)) {
            score += 10;
          }
          
          return { ...set, relevanceScore: score };
        }).sort((a, b) => b.relevanceScore - a.relevanceScore);
      } else {
        // Return popular sets if no query
        databaseSuggestions = onTheFlyDatabase
          .filter(set => {
            const year = parseInt(set.year);
            const isRecent = year >= 2020;
            const isMajorBrand = ['Topps', 'Panini', 'Upper Deck', 'Donruss'].includes(set.brand);
            return isRecent && isMajorBrand;
          })
          .slice(0, parseInt(limit));
      }
      
      console.log(`[CARD SET SUGGESTIONS] On-the-fly database search returned ${databaseSuggestions.length} suggestions`);
    }
    
    // Transform database suggestions to match expected format
    const transformedDatabaseSuggestions = databaseSuggestions.map(set => {
      // Calculate normalized relevance score (1-10)
      const maxScore = 1500; // Approximate max score
      const normalizedScore = Math.min(10, Math.max(1, Math.round((set.relevanceScore || 0) / maxScore * 10)));
      
      return {
        id: set.id,
        name: set.displayName || set.name,
        brand: set.brand,
        category: set.sport,
        sport: set.sport,
        league: set.sport === 'Baseball' ? 'MLB' : set.sport === 'Football' ? 'NFL' : set.sport === 'Basketball' ? 'NBA' : set.sport === 'Hockey' ? 'NHL' : set.sport,
        years: [set.year],
        setType: set.setName || 'Base Set',
        cardCount: 0,
        description: `${set.sport} ${set.year} ${set.brand} ${set.setName || 'Base Set'}`,
        popularity: normalizedScore,
        source: set.source || 'Database',
        lastUpdated: new Date().toISOString().split('T')[0],
        relevanceScore: set.relevanceScore || 0
      };
    });
    
    console.log(`[CARD SET SUGGESTIONS] Transformed ${transformedDatabaseSuggestions.length} database suggestions`);
    
    // Define card sets data inline since file deployment is unreliable
    const cardSetsData = {
      cardSets: [
        {
          id: "topps_series_one",
          name: "Topps Series One",
          brand: "Topps",
          category: "Baseball",
          sport: "Baseball",
          league: "MLB",
          years: ["2025", "2024", "2023", "2022", "2021", "2020", "2019", "2018", "2017", "2016", "2015", "2014", "2013", "2012", "2011", "2010", "2009", "2008", "2007", "2006", "2005", "2004", "2003", "2002", "2001", "2000"],
          setType: "Base Set",
          cardCount: 400,
          description: "Annual flagship baseball set featuring current MLB players",
          releaseMonth: "February",
          retailPrice: 4.99,
          hobbyPrice: 89.99,
          popularity: 9.5,
          rookieCards: true,
          inserts: ["Parallels", "Inserts", "Autographs", "Relics"],
          variations: ["Photo Variations", "SP", "SSP"],
          imageUrl: null,
          source: "Manual",
          lastUpdated: "2025-01-27"
        },
        {
          id: "topps_series_two",
          name: "Topps Series Two",
          brand: "Topps",
          category: "Baseball",
          sport: "Baseball",
          league: "MLB",
          years: ["2025", "2024", "2023", "2022", "2021", "2020", "2019", "2018", "2017", "2016", "2015", "2014", "2013", "2012", "2011", "2010", "2009", "2008", "2007", "2006", "2005", "2004", "2003", "2002", "2001", "2000"],
          setType: "Base Set",
          cardCount: 400,
          description: "Second series of the annual flagship set",
          releaseMonth: "June",
          retailPrice: 4.99,
          hobbyPrice: 89.99,
          popularity: 8.5,
          rookieCards: true,
          inserts: ["Parallels", "Inserts", "Autographs", "Relics"],
          variations: ["Photo Variations", "SP", "SSP"],
          imageUrl: null,
          source: "Manual",
          lastUpdated: "2025-01-27"
        },
        {
          id: "topps_update",
          name: "Topps Update",
          brand: "Topps",
          category: "Baseball",
          sport: "Baseball",
          league: "MLB",
          years: ["2024", "2023", "2022", "2021", "2020", "2019", "2018", "2017", "2016", "2015", "2014", "2013", "2012", "2011", "2010", "2009", "2008", "2007", "2006", "2005", "2004", "2003", "2002", "2001", "2000"],
          setType: "Update Set",
          cardCount: 300,
          description: "Update set featuring mid-season trades and rookies",
          releaseMonth: "October",
          retailPrice: 4.99,
          hobbyPrice: 79.99,
          popularity: 9.0,
          rookieCards: true,
          inserts: ["Parallels", "Inserts", "Autographs", "Relics"],
          variations: ["Photo Variations", "SP", "SSP"],
          imageUrl: null,
          source: "Manual",
          lastUpdated: "2025-01-27"
        },
        {
          id: "topps_chrome",
          name: "Topps Chrome",
          brand: "Topps",
          category: "Baseball",
          sport: "Baseball",
          league: "MLB",
          years: ["2024", "2023", "2022", "2021", "2020", "2019", "2018", "2017", "2016", "2015", "2014", "2013", "2012", "2011", "2010", "2009", "2008", "2007", "2006", "2005", "2004", "2003", "2002", "2001", "2000"],
          setType: "Premium Set",
          cardCount: 220,
          description: "Premium chrome version of flagship set with enhanced parallels",
          releaseMonth: "August",
          retailPrice: 6.99,
          hobbyPrice: 129.99,
          popularity: 9.2,
          rookieCards: true,
          inserts: ["Refractors", "Autographs", "Relics", "Numbered"],
          variations: ["Refractor Parallels", "SP", "SSP", "Superfractors"],
          imageUrl: null,
          source: "Manual",
          lastUpdated: "2025-01-27"
        },
        {
          id: "topps_heritage",
          name: "Topps Heritage",
          brand: "Topps",
          category: "Baseball",
          sport: "Baseball",
          league: "MLB",
          years: ["2024", "2023", "2022", "2021", "2020", "2019", "2018", "2017", "2016", "2015", "2014", "2013", "2012", "2011", "2010", "2009", "2008", "2007", "2006", "2005", "2004", "2003", "2002", "2001"],
          setType: "Retro Set",
          cardCount: 500,
          description: "Retro-style set based on classic Topps designs",
          releaseMonth: "March",
          retailPrice: 4.99,
          hobbyPrice: 99.99,
          popularity: 8.8,
          rookieCards: true,
          inserts: ["Parallels", "Autographs", "Relics", "Vintage"],
          variations: ["Color Variations", "SP", "SSP", "Chrome"],
          imageUrl: null,
          source: "Manual",
          lastUpdated: "2025-01-27"
        },
        {
          id: "topps_stadium_club",
          name: "Topps Stadium Club",
          brand: "Topps",
          category: "Baseball",
          sport: "Baseball",
          league: "MLB",
          years: ["2024", "2023", "2022", "2021", "2020", "2019", "2018", "2017", "2016", "2015", "2014", "2013", "2012", "2011", "2010", "2009", "2008", "2007", "2006", "2005", "2004", "2003", "2002", "2001", "2000"],
          setType: "Photography Set",
          cardCount: 300,
          description: "Premium photography-focused set with artistic card designs",
          releaseMonth: "December",
          retailPrice: 5.99,
          hobbyPrice: 119.99,
          popularity: 8.7,
          rookieCards: true,
          inserts: ["Parallels", "Autographs", "Relics", "Beam Team"],
          variations: ["Photo Variations", "SP", "SSP", "Chrome"],
          imageUrl: null,
          source: "Manual",
          lastUpdated: "2025-01-27"
        },
        {
          id: "topps_gallery",
          name: "Topps Gallery",
          brand: "Topps",
          category: "Baseball",
          sport: "Baseball",
          league: "MLB",
          years: ["2024", "2023", "2022", "2021", "2020", "2019", "2018", "2017", "2016", "2015", "2014", "2013", "2012", "2011", "2010", "2009", "2008", "2007", "2006", "2005", "2004", "2003", "2002", "2001", "2000"],
          setType: "Art Set",
          cardCount: 250,
          description: "Artistic set featuring hand-painted card designs",
          releaseMonth: "November",
          retailPrice: 5.99,
          hobbyPrice: 109.99,
          popularity: 8.3,
          rookieCards: true,
          inserts: ["Parallels", "Autographs", "Relics", "Masterpieces"],
          variations: ["Art Variations", "SP", "SSP", "Canvas"],
          imageUrl: null,
          source: "Manual",
          lastUpdated: "2025-01-27"
        },
        {
          id: "bowman",
          name: "Bowman",
          brand: "Bowman",
          category: "Baseball",
          sport: "Baseball",
          league: "MLB",
          years: ["2024", "2023", "2022", "2021", "2020", "2019", "2018", "2017", "2016", "2015", "2014", "2013", "2012", "2011", "2010", "2009", "2008", "2007", "2006", "2005", "2004", "2003", "2002", "2001", "2000"],
          setType: "Prospect Set",
          cardCount: 500,
          description: "Prospect-focused set featuring minor league and rookie players",
          releaseMonth: "May",
          retailPrice: 4.99,
          hobbyPrice: 89.99,
          popularity: 9.1,
          rookieCards: true,
          inserts: ["Parallels", "Autographs", "Relics", "Prospects"],
          variations: ["Photo Variations", "SP", "SSP", "Chrome"],
          imageUrl: null,
          source: "Manual",
          lastUpdated: "2025-01-27"
        },
        {
          id: "bowman_chrome",
          name: "Bowman Chrome",
          brand: "Bowman",
          category: "Baseball",
          sport: "Baseball",
          league: "MLB",
          years: ["2024", "2023", "2022", "2021", "2020", "2019", "2018", "2017", "2016", "2015", "2014", "2013", "2012", "2011", "2010", "2009", "2008", "2007", "2006", "2005", "2004", "2003", "2002", "2001", "2000"],
          setType: "Premium Prospect Set",
          cardCount: 220,
          description: "Premium chrome version of Bowman with enhanced prospect parallels",
          releaseMonth: "September",
          retailPrice: 6.99,
          hobbyPrice: 129.99,
          popularity: 9.3,
          rookieCards: true,
          inserts: ["Refractors", "Autographs", "Relics", "Prospects"],
          variations: ["Refractor Parallels", "SP", "SSP", "Superfractors"],
          imageUrl: null,
          source: "Manual",
          lastUpdated: "2025-01-27"
        },
        {
          id: "bowman_draft",
          name: "Bowman Draft",
          brand: "Bowman",
          category: "Baseball",
          sport: "Baseball",
          league: "MLB",
          years: ["2024", "2023", "2022", "2021", "2020", "2019", "2018", "2017", "2016", "2015", "2014", "2013", "2012", "2011", "2010", "2009", "2008", "2007", "2006", "2005", "2004", "2003", "2002", "2001", "2000"],
          setType: "Draft Set",
          cardCount: 300,
          description: "Draft-focused set featuring newly drafted players",
          releaseMonth: "December",
          retailPrice: 5.99,
          hobbyPrice: 119.99,
          popularity: 8.9,
          rookieCards: true,
          inserts: ["Parallels", "Autographs", "Relics", "Draft Picks"],
          variations: ["Photo Variations", "SP", "SSP", "Chrome"],
          imageUrl: null,
          source: "Manual",
          lastUpdated: "2025-01-27"
        },
        {
          id: "panini_prizm",
          name: "Panini Prizm",
          brand: "Panini",
          category: "Basketball",
          sport: "Basketball",
          league: "NBA",
          years: ["2024", "2023", "2022", "2021", "2020", "2019", "2018", "2017", "2016", "2015", "2014", "2013", "2012"],
          setType: "Premium Set",
          cardCount: 300,
          description: "Premium basketball set with extensive parallel system",
          releaseMonth: "December",
          retailPrice: 6.99,
          hobbyPrice: 149.99,
          popularity: 9.4,
          rookieCards: true,
          inserts: ["Prizms", "Autographs", "Relics", "Numbered"],
          variations: ["Prizm Parallels", "SP", "SSP", "Super Prizms"],
          imageUrl: null,
          source: "Manual",
          lastUpdated: "2025-01-27"
        },
        {
          id: "panini_donruss",
          name: "Panini Donruss",
          brand: "Panini",
          category: "Basketball",
          sport: "Basketball",
          league: "NBA",
          years: ["2024", "2023", "2022", "2021", "2020", "2019", "2018", "2017", "2016", "2015", "2014", "2013", "2012"],
          setType: "Base Set",
          cardCount: 400,
          description: "Base basketball set with classic Donruss design",
          releaseMonth: "February",
          retailPrice: 4.99,
          hobbyPrice: 89.99,
          popularity: 8.6,
          rookieCards: true,
          inserts: ["Parallels", "Autographs", "Relics", "Rated Rookies"],
          variations: ["Photo Variations", "SP", "SSP", "Optic"],
          imageUrl: null,
          source: "Manual",
          lastUpdated: "2025-01-27"
        },
        {
          id: "panini_optic",
          name: "Panini Optic",
          brand: "Panini",
          category: "Basketball",
          sport: "Basketball",
          league: "NBA",
          years: ["2024", "2023", "2022", "2021", "2020", "2019", "2018", "2017", "2016", "2015", "2014", "2013", "2012"],
          setType: "Premium Set",
          cardCount: 300,
          description: "Premium chrome version of Donruss with enhanced parallels",
          releaseMonth: "August",
          retailPrice: 6.99,
          hobbyPrice: 129.99,
          popularity: 9.0,
          rookieCards: true,
          inserts: ["Holo", "Autographs", "Relics", "Rated Rookies"],
          variations: ["Holo Parallels", "SP", "SSP", "Super Holo"],
          imageUrl: null,
          source: "Manual",
          lastUpdated: "2025-01-27"
        },
        {
          id: "panini_select",
          name: "Panini Select",
          brand: "Panini",
          category: "Basketball",
          sport: "Basketball",
          league: "NBA",
          years: ["2024", "2023", "2022", "2021", "2020", "2019", "2018", "2017", "2016", "2015", "2014", "2013", "2012"],
          setType: "Premium Set",
          cardCount: 250,
          description: "Premium basketball set with tiered parallel system",
          releaseMonth: "June",
          retailPrice: 7.99,
          hobbyPrice: 159.99,
          popularity: 8.8,
          rookieCards: true,
          inserts: ["Concourses", "Premiers", "Courtsides", "Autographs"],
          variations: ["Tiered Parallels", "SP", "SSP", "Super Select"],
          imageUrl: null,
          source: "Manual",
          lastUpdated: "2025-01-27"
        },
        {
          id: "panini_mosaic",
          name: "Panini Mosaic",
          brand: "Panini",
          category: "Basketball",
          sport: "Basketball",
          league: "NBA",
          years: ["2024", "2023", "2022", "2021", "2020", "2019", "2018", "2017", "2016", "2015", "2014", "2013", "2012"],
          setType: "Premium Set",
          cardCount: 300,
          description: "Premium basketball set with mosaic-style design",
          releaseMonth: "May",
          retailPrice: 6.99,
          hobbyPrice: 139.99,
          popularity: 8.9,
          rookieCards: true,
          inserts: ["Mosaics", "Autographs", "Relics", "Genesis"],
          variations: ["Mosaic Parallels", "SP", "SSP", "Genesis"],
          imageUrl: null,
          source: "Manual",
          lastUpdated: "2025-01-27"
        },
        {
          id: "panini_contenders",
          name: "Panini Contenders",
          brand: "Panini",
          category: "Football",
          sport: "Football",
          league: "NFL",
          years: ["2024", "2023", "2022", "2021", "2020", "2019", "2018", "2017", "2016", "2015", "2014", "2013", "2012"],
          setType: "Rookie Set",
          cardCount: 200,
          description: "Rookie-focused football set with playoff ticket design",
          releaseMonth: "November",
          retailPrice: 5.99,
          hobbyPrice: 119.99,
          popularity: 8.7,
          rookieCards: true,
          inserts: ["Playoff Tickets", "Autographs", "Relics", "Rookies"],
          variations: ["Ticket Parallels", "SP", "SSP", "Super Tickets"],
          imageUrl: null,
          source: "Manual",
          lastUpdated: "2025-01-27"
        },
        {
          id: "panini_playoff",
          name: "Panini Playoff",
          brand: "Panini",
          category: "Football",
          sport: "Football",
          league: "NFL",
          years: ["2024", "2023", "2022", "2021", "2020", "2019", "2018", "2017", "2016", "2015", "2014", "2013", "2012"],
          setType: "Base Set",
          cardCount: 350,
          description: "Base football set with playoff theme",
          releaseMonth: "September",
          retailPrice: 4.99,
          hobbyPrice: 89.99,
          popularity: 8.4,
          rookieCards: true,
          inserts: ["Parallels", "Autographs", "Relics", "Rookies"],
          variations: ["Photo Variations", "SP", "SSP", "Chrome"],
          imageUrl: null,
          source: "Manual",
          lastUpdated: "2025-01-27"
        },
        {
          id: "panini_absolute",
          name: "Panini Absolute",
          brand: "Panini",
          category: "Football",
          sport: "Football",
          league: "NFL",
          years: ["2024", "2023", "2022", "2021", "2020", "2019", "2018", "2017", "2016", "2015", "2014", "2013", "2012"],
          setType: "Premium Set",
          cardCount: 250,
          description: "Premium football set with absolute design elements",
          releaseMonth: "October",
          retailPrice: 6.99,
          hobbyPrice: 129.99,
          popularity: 8.5,
          rookieCards: true,
          inserts: ["Parallels", "Autographs", "Relics", "Rookies"],
          variations: ["Design Variations", "SP", "SSP", "Super Absolute"],
          imageUrl: null,
          source: "Manual",
          lastUpdated: "2025-01-27"
        },
        {
          id: "upper_deck",
          name: "Upper Deck",
          brand: "Upper Deck",
          category: "Hockey",
          sport: "Hockey",
          league: "NHL",
          years: ["2024", "2023", "2022", "2021", "2020", "2019", "2018", "2017", "2016", "2015", "2014", "2013", "2012", "2011", "2010", "2009", "2008", "2007", "2006", "2005", "2004", "2003", "2002", "2001", "2000"],
          setType: "Base Set",
          cardCount: 500,
          description: "Base hockey set featuring NHL players",
          releaseMonth: "November",
          retailPrice: 4.99,
          hobbyPrice: 89.99,
          popularity: 8.2,
          rookieCards: true,
          inserts: ["Parallels", "Autographs", "Relics", "Young Guns"],
          variations: ["Photo Variations", "SP", "SSP", "Chrome"],
          imageUrl: null,
          source: "Manual",
          lastUpdated: "2025-01-27"
        },
        {
          id: "upper_deck_young_guns",
          name: "Upper Deck Young Guns",
          brand: "Upper Deck",
          category: "Hockey",
          sport: "Hockey",
          league: "NHL",
          years: ["2024", "2023", "2022", "2021", "2020", "2019", "2018", "2017", "2016", "2015", "2014", "2013", "2012", "2011", "2010", "2009", "2008", "2007", "2006", "2005", "2004", "2003", "2002", "2001", "2000"],
          setType: "Rookie Set",
          cardCount: 100,
          description: "Rookie-focused hockey set with Young Guns subset",
          releaseMonth: "December",
          retailPrice: 5.99,
          hobbyPrice: 119.99,
          popularity: 9.1,
          rookieCards: true,
          inserts: ["Young Guns", "Autographs", "Relics", "Canvas"],
          variations: ["Young Guns", "SP", "SSP", "Canvas"],
          imageUrl: null,
          source: "Manual",
          lastUpdated: "2025-01-27"
        },
        {
          id: "pokemon_base_set",
          name: "Pokemon Base Set",
          brand: "Pokemon",
          category: "Gaming",
          sport: "Gaming",
          league: "Pokemon",
          years: ["1999"],
          setType: "Base Set",
          cardCount: 102,
          description: "Original Pokemon trading card game base set",
          releaseMonth: "January",
          retailPrice: 3.99,
          hobbyPrice: null,
          popularity: 9.8,
          rookieCards: false,
          inserts: ["Holographic", "Rare", "Uncommon", "Common"],
          variations: ["1st Edition", "Shadowless", "Unlimited"],
          imageUrl: null,
          source: "Manual",
          lastUpdated: "2025-01-27"
        },
        {
          id: "pokemon_151",
          name: "Pokemon 151",
          brand: "Pokemon",
          category: "Gaming",
          sport: "Gaming",
          league: "Pokemon",
          years: ["2023"],
          setType: "Special Set",
          cardCount: 165,
          description: "Special set featuring the original 151 Pokemon",
          releaseMonth: "September",
          retailPrice: 4.99,
          hobbyPrice: 119.99,
          popularity: 9.5,
          rookieCards: false,
          inserts: ["Holographic", "Full Art", "Special Illustration", "Secret Rare"],
          variations: ["Holographic", "Full Art", "Special Illustration", "Secret Rare"],
          imageUrl: null,
          source: "Manual",
          lastUpdated: "2025-01-27"
        },
        {
          id: "pokemon_evolving_skies",
          name: "Pokemon Evolving Skies",
          brand: "Pokemon",
          category: "Gaming",
          sport: "Gaming",
          league: "Pokemon",
          years: ["2021"],
          setType: "Expansion Set",
          cardCount: 203,
          description: "Expansion set featuring Eevee evolutions and Dragon types",
          releaseMonth: "August",
          retailPrice: 4.99,
          hobbyPrice: 119.99,
          popularity: 9.6,
          rookieCards: false,
          inserts: ["Holographic", "Full Art", "VMAX", "Secret Rare"],
          variations: ["Holographic", "Full Art", "VMAX", "Secret Rare"],
          imageUrl: null,
          source: "Manual",
          lastUpdated: "2025-01-27"
        },
        {
          id: "pokemon_crown_zenith",
          name: "Pokemon Crown Zenith",
          brand: "Pokemon",
          category: "Gaming",
          sport: "Gaming",
          league: "Pokemon",
          years: ["2023"],
          setType: "Special Set",
          cardCount: 159,
          description: "Special set with high pull rates for rare cards",
          releaseMonth: "January",
          retailPrice: 4.99,
          hobbyPrice: 119.99,
          popularity: 9.3,
          rookieCards: false,
          inserts: ["Holographic", "Full Art", "VSTAR", "Secret Rare"],
          variations: ["Holographic", "Full Art", "VSTAR", "Secret Rare"],
          imageUrl: null,
          source: "Manual",
          lastUpdated: "2025-01-27"
        },
        {
          id: "pokemon_scarlet_violet",
          name: "Pokemon Scarlet & Violet",
          brand: "Pokemon",
          category: "Gaming",
          sport: "Gaming",
          league: "Pokemon",
          years: ["2023"],
          setType: "Base Set",
          cardCount: 198,
          description: "Base set for Pokemon Scarlet & Violet era",
          releaseMonth: "March",
          retailPrice: 4.99,
          hobbyPrice: 119.99,
          popularity: 8.8,
          rookieCards: false,
          inserts: ["Holographic", "Full Art", "EX", "Secret Rare"],
          variations: ["Holographic", "Full Art", "EX", "Secret Rare"],
          imageUrl: null,
          source: "Manual",
          lastUpdated: "2025-01-27"
        },
        {
          id: "pokemon_paldea_evolved",
          name: "Pokemon Paldea Evolved",
          brand: "Pokemon",
          category: "Gaming",
          sport: "Gaming",
          league: "Pokemon",
          years: ["2023"],
          setType: "Expansion Set",
          cardCount: 193,
          description: "Expansion set for Pokemon Scarlet & Violet era",
          releaseMonth: "June",
          retailPrice: 4.99,
          hobbyPrice: 119.99,
          popularity: 8.6,
          rookieCards: false,
          inserts: ["Holographic", "Full Art", "EX", "Secret Rare"],
          variations: ["Holographic", "Full Art", "EX", "Secret Rare"],
          imageUrl: null,
          source: "Manual",
          lastUpdated: "2025-01-27"
        },
        {
          id: "pokemon_obsidian_flames",
          name: "Pokemon Obsidian Flames",
          brand: "Pokemon",
          category: "Gaming",
          sport: "Gaming",
          league: "Pokemon",
          years: ["2023"],
          setType: "Expansion Set",
          cardCount: 197,
          description: "Expansion set featuring Fire and Dragon type Pokemon",
          releaseMonth: "August",
          retailPrice: 4.99,
          hobbyPrice: 119.99,
          popularity: 8.4,
          rookieCards: false,
          inserts: ["Holographic", "Full Art", "EX", "Secret Rare"],
          variations: ["Holographic", "Full Art", "EX", "Secret Rare"],
          imageUrl: null,
          source: "Manual",
          lastUpdated: "2025-01-27"
        },
        {
          id: "pokemon_paradox_rift",
          name: "Pokemon Paradox Rift",
          brand: "Pokemon",
          category: "Gaming",
          sport: "Gaming",
          league: "Pokemon",
          years: ["2023"],
          setType: "Expansion Set",
          cardCount: 182,
          description: "Expansion set featuring Paradox Pokemon",
          releaseMonth: "November",
          retailPrice: 4.99,
          hobbyPrice: 119.99,
          popularity: 8.7,
          rookieCards: false,
          inserts: ["Holographic", "Full Art", "EX", "Secret Rare"],
          variations: ["Holographic", "Full Art", "EX", "Secret Rare"],
          imageUrl: null,
          source: "Manual",
          lastUpdated: "2025-01-27"
        },
        {
          id: "pokemon_paldean_fates",
          name: "Pokemon Paldean Fates",
          brand: "Pokemon",
          category: "Gaming",
          sport: "Gaming",
          league: "Pokemon",
          years: ["2024"],
          setType: "Special Set",
          cardCount: 245,
          description: "Special set with Shiny Pokemon focus",
          releaseMonth: "January",
          retailPrice: 4.99,
          hobbyPrice: 119.99,
          popularity: 9.2,
          rookieCards: false,
          inserts: ["Shiny", "Full Art", "EX", "Secret Rare"],
          variations: ["Shiny", "Full Art", "EX", "Secret Rare"],
          imageUrl: null,
          source: "Manual",
          lastUpdated: "2025-01-27"
        },
        {
          id: "pokemon_temporal_forces",
          name: "Pokemon Temporal Forces",
          brand: "Pokemon",
          category: "Gaming",
          sport: "Gaming",
          league: "Pokemon",
          years: ["2024"],
          setType: "Expansion Set",
          cardCount: 162,
          description: "Expansion set featuring time-themed Pokemon",
          releaseMonth: "March",
          retailPrice: 4.99,
          hobbyPrice: 119.99,
          popularity: 8.5,
          rookieCards: false,
          inserts: ["Holographic", "Full Art", "EX", "Secret Rare"],
          variations: ["Holographic", "Full Art", "EX", "Secret Rare"],
          imageUrl: null,
          source: "Manual",
          lastUpdated: "2025-01-27"
        },
        {
          id: "pokemon_twilight_masquerade",
          name: "Pokemon Twilight Masquerade",
          brand: "Pokemon",
          category: "Gaming",
          sport: "Gaming",
          league: "Pokemon",
          years: ["2024"],
          setType: "Expansion Set",
          cardCount: 167,
          description: "Expansion set with masquerade theme",
          releaseMonth: "May",
          retailPrice: 4.99,
          hobbyPrice: 119.99,
          popularity: 8.3,
          rookieCards: false,
          inserts: ["Holographic", "Full Art", "EX", "Secret Rare"],
          variations: ["Holographic", "Full Art", "EX", "Secret Rare"],
          imageUrl: null,
          source: "Manual",
          lastUpdated: "2025-01-27"
        }
      ],
      metadata: {
        totalSets: 35,
        lastUpdated: "2025-01-27T10:30:00Z",
        version: "2.0",
        sources: ["Manual", "Industry Knowledge"],
        categories: {
          Baseball: 10,
          Basketball: 5,
          Football: 3,
          Hockey: 2,
          Gaming: 15
        }
      }
    };
    
    console.log(`[CARD SET SUGGESTIONS] Using inline data, ${cardSetsData.cardSets.length} card sets available`);
    
    if (!cardSetsData.cardSets || !Array.isArray(cardSetsData.cardSets)) {
      console.error('[CARD SET SUGGESTIONS] Invalid data structure: cardSets array not found');
      return res.status(500).json({ 
        error: 'Invalid card sets data structure',
        details: 'The card sets data is not in the expected format'
      });
    }
    
    if (!query.trim()) {
      // Combine database suggestions with fallback sets for no query
      const combinedSuggestions = [...transformedDatabaseSuggestions, ...fallbackSets];
      const uniqueSuggestions = combinedSuggestions.filter((set, index, self) => 
        index === self.findIndex(s => s.id === set.id)
      );
      return res.json({ suggestions: uniqueSuggestions.slice(0, parseInt(limit)) });
    }
    
    const searchTerm = query.toLowerCase();
                  const searchWords = searchTerm.split(' ').filter(word => word.length > 1);
                  
    const filteredSets = fallbackSets.filter(set => {
                      const setName = set.name.toLowerCase();
                      const setBrand = set.brand.toLowerCase();
                      const setCategory = set.category.toLowerCase();
                      
                      // Check if any search word matches any part of the set
                      const hasMatch = searchWords.some(word => 
                        setName.includes(word) || 
                        setBrand.includes(word) || 
        setCategory.includes(word)
                      );
                      
                      // Also check for exact phrase match
                      const exactMatch = setName.includes(searchTerm) || 
                                        setBrand.includes(searchTerm) || 
                        setCategory.includes(searchTerm);
                      
                      return hasMatch || exactMatch;
    });
    
    // Combine database suggestions with filtered fallback sets
    const combinedSuggestions = [...transformedDatabaseSuggestions, ...filteredSets];
    const uniqueSuggestions = combinedSuggestions.filter((set, index, self) => 
      index === self.findIndex(s => s.id === set.id)
    );
    
    console.log(`[CARD SET SUGGESTIONS] Combined: ${transformedDatabaseSuggestions.length} database + ${filteredSets.length} fallback = ${uniqueSuggestions.length} unique suggestions`);
    
    res.json({ suggestions: uniqueSuggestions.slice(0, parseInt(limit)) });

  } catch (error) {
    console.error('[CARD SET SUGGESTIONS] Error details:', error);
    console.error('[CARD SET SUGGESTIONS] Error stack:', error.stack);
    
    // Fallback to hardcoded popular sets if file reading fails
    console.log('[CARD SET SUGGESTIONS] Using fallback hardcoded suggestions');
    const fallbackSets = [
      // Baseball - Topps
      { id: "topps_series_one", name: "Topps Series One", brand: "Topps", category: "Baseball", sport: "Baseball", league: "MLB", years: ["2025", "2024", "2023"], setType: "Base Set", description: "Annual flagship baseball set", popularity: 9.5, source: "Manual" },
      { id: "topps_chrome", name: "Topps Chrome", brand: "Topps", category: "Baseball", sport: "Baseball", league: "MLB", years: ["2024", "2023", "2022"], setType: "Premium Set", description: "Premium chrome version", popularity: 9.2, source: "Manual" },
      { id: "panini_prizm", name: "Panini Prizm", brand: "Panini", category: "Basketball", sport: "Basketball", league: "NBA", years: ["2024", "2023", "2022"], setType: "Premium Set", description: "Premium basketball set", popularity: 9.4, source: "Manual" },
      { id: "upper_deck", name: "Upper Deck", brand: "Upper Deck", category: "Hockey", sport: "Hockey", league: "NHL", years: ["2024", "2023", "2022"], setType: "Base Set", description: "Base hockey set", popularity: 8.2, source: "Manual" }
    ];
    
    if (!query.trim()) {
      return res.json({ suggestions: fallbackSets.slice(0, parseInt(limit)) });
    }
    
    const searchTerm = query.toLowerCase();
    const searchWords = searchTerm.split(' ').filter(word => word.length > 1);
    
    // Score and sort fallback sets by relevance
    const scoredFallbackSets = fallbackSets.map(set => {
      const setName = set.name.toLowerCase();
      const setBrand = set.brand.toLowerCase();
      const setCategory = set.category.toLowerCase();
      const setYears = set.years || [];

      console.log(`[DEBUG FALLBACK] Processing fallback set: "${set.name}"`);

      let score = 0;

      // Exact year match gets highest priority
      const matchingYear = setYears.find(year => searchWords.includes(year.toLowerCase()));
      if (matchingYear) {
        score += 1000;
      }

      // Recent years get higher priority
      const recentYear = setYears.find(year => parseInt(year) >= 2023);
      if (recentYear) score += 100;
      else if (setYears.find(year => parseInt(year) >= 2020)) score += 50;

      // Exact phrase matches
      if (setName.includes(searchTerm)) score += 400;
      if (setBrand.includes(searchTerm)) score += 300;
      if (setCategory.includes(searchTerm)) score += 200;

      // Word matches
      searchWords.forEach(word => {
        if (setName.includes(word)) score += 80;
        if (setBrand.includes(word)) score += 60;
        if (setCategory.includes(word)) score += 40;
        if (setYears.some(year => year.toLowerCase().includes(word))) score += 200;
      });

      console.log(`[DEBUG FALLBACK] Fallback set "${set.name}" - Score: ${score}`);

      return { ...set, relevanceScore: score };
    }).sort((a, b) => b.relevanceScore - a.relevanceScore);

    const filteredSets = scoredFallbackSets.filter(set => set.relevanceScore > 0);
    console.log(`[DEBUG FALLBACK] Filtered fallback sets: ${filteredSets.length} with score > 0`);
    filteredSets.forEach(set => {
      console.log(`[DEBUG FALLBACK] Included fallback: "${set.name}" (score: ${set.relevanceScore})`);
    });
    
    res.json({ suggestions: filteredSets.slice(0, parseInt(limit)) });
  }
});

// GET /api/card-set-analysis - New route for analyzing specific card sets
router.get('/card-set-analysis', async (req, res) => {
  const { cardSet, year, limit = 2000 } = req.query;
  
  // Validate required parameters
  if (!cardSet) {
    return res.status(400).json({ 
      error: 'Missing required parameter: cardSet',
      example: '/api/card-set-analysis?cardSet=Topps Series One&year=2025&limit=2000'
    });
  }

  // Set timeout for this request
  const timeout = setTimeout(() => {
    if (!res.headersSent) {
      res.status(408).json({
        error: 'Request timeout',
        message: 'The card set analysis took too long to process. Please try again.',
        timestamp: new Date().toISOString()
      });
    }
  }, 180000); // 3 minute timeout for large data sets

  try {
    // Build search query
    const searchQuery = year ? `${cardSet} ${year}` : cardSet;
    console.log(`[CARD SET ANALYSIS] Analyzing card set: "${searchQuery}" at ${new Date().toISOString()}`);
    
    // Fetch more data for comprehensive analysis
    const point130Cards = await point130Service.search130point(searchQuery, parseInt(limit) * 2);
    let allCards = point130Cards;

    // Filter out sealed products and hobby boxes (more precise filtering)
    const filteredCards = allCards.filter(card => {
      const title = (card.title || '').toLowerCase();
      
      // Only filter out clearly sealed products, not individual cards
      const sealedProductPatterns = [
        /\bhobby\s+box\b/i,
        /\bfactory\s+sealed\b/i,
        /\bsealed\s+box\b/i,
        /\bsealed\s+pack\b/i,
        /\bsealed\s+case\b/i,
        /\bbooster\s+box\b/i,
        /\bbooster\s+pack\b/i,
        /\bblaster\s+box\b/i,
        /\bblaster\s+pack\b/i,
        /\bfat\s+pack\b/i,
        /\bjumbo\s+pack\b/i,
        /\bretail\s+box\b/i,
        /\bretail\s+pack\b/i,
        /\bhanger\s+box\b/i,
        /\bhanger\s+pack\b/i,
        /\bvalue\s+pack\b/i,
        /\bvalue\s+box\b/i,
        /\bcomplete\s+set\b/i,
        /\bfactory\s+set\b/i,
        /\bsealed\s+product\b/i,
        /\bunopened\b/i,
        /\bsealed\s+item\b/i,
        /\bsealed\s+lot\b/i
      ];
      
      // Check if title matches any sealed product pattern
      const isSealedProduct = sealedProductPatterns.some(pattern => pattern.test(title));
      
      // Check for quantity indicators that suggest sealed products
      const hasQuantityIndicators = /\d+\s*(hobby\s+box|booster\s+box|blaster\s+box|retail\s+box|sealed\s+box|sealed\s+pack|sealed\s+case|lot\s+of|lots\s+of|bundle|complete\s+set|factory\s+set)/i.test(title);
      
      // Check for high-value items that are clearly sealed products
      const price = parseFloat(card.price?.value || 0);
      const isHighValueSealed = price > 200 && (
        title.includes('hobby box') || 
        title.includes('booster box') || 
        title.includes('blaster box') || 
        title.includes('complete set') ||
        title.includes('factory set') ||
        /\d+\s*(box|pack|case)/i.test(title)
      );
      
      // Only filter out if it's clearly a sealed product
      return !isSealedProduct && !hasQuantityIndicators && !isHighValueSealed;
    });

    console.log(`📊 Filtered out ${allCards.length - filteredCards.length} sealed products, keeping ${filteredCards.length} individual cards`);
    allCards = filteredCards;

    // Remove duplicates
    const uniqueCards = [];
    const seen = new Set();
    
    allCards.forEach(card => {
      const key = `${card.title}-${card.price?.value}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueCards.push(card);
      }
    });
    
    allCards = uniqueCards;
    console.log(`📊 Total unique cards found for ${cardSet}: ${allCards.length}`);

    // Categorize cards
    const categorized = categorizeCards(allCards);
    
    // Sort categorized results by value
    const sortedCategorized = sortByValue(categorized);
    
    // Analyze card performance by player/card
    const cardAnalysis = analyzeCardSetPerformance(allCards);
    
    // Sort by different criteria
    const sortedByValue = [...allCards].sort((a, b) => {
      const priceA = parseFloat(a.price?.value || 0);
      const priceB = parseFloat(b.price?.value || 0);
      return priceB - priceA; // Highest first
    });

    const sortedBySalesVolume = cardAnalysis.sort((a, b) => b.salesCount - a.salesCount);

    // Add EPN tracking
    const addTrackingToCards = (cards) => {
      if (!Array.isArray(cards)) return [];
      return cards.map(card => ({
        ...card,
        itemWebUrl: addEbayTracking(card.itemWebUrl)
      }));
    };

    const responseData = {
      searchParams: { cardSet, year, limit },
      summary: {
        totalCards: allCards.length,
        totalSales: allCards.reduce((sum, card) => sum + parseFloat(card.price?.value || 0), 0),
        averagePrice: allCards.length > 0 ? allCards.reduce((sum, card) => sum + parseFloat(card.price?.value || 0), 0) / allCards.length : 0,
        dateRange: {
          earliest: allCards.length > 0 ? Math.min(...allCards.map(card => new Date(card.soldDate || 0))) : null,
          latest: allCards.length > 0 ? Math.max(...allCards.map(card => new Date(card.soldDate || 0))) : null
        }
      },
      topCardsByValue: addTrackingToCards(sortedByValue.slice(0, 20)),
      topCardsBySalesVolume: sortedBySalesVolume.slice(0, 20),
      categorizedResults: {
        raw: addTrackingToCards(sortedCategorized.raw),
        psa10: addTrackingToCards(sortedCategorized.psa10),
        psa9: addTrackingToCards(sortedCategorized.psa9),
        psa8: addTrackingToCards(sortedCategorized.psa8),
        psa7: addTrackingToCards(sortedCategorized.psa7),
        cgc10: addTrackingToCards(sortedCategorized.cgc10),
        cgc9: addTrackingToCards(sortedCategorized.cgc9),
        tag10: addTrackingToCards(sortedCategorized.tag10),
        tag9: addTrackingToCards(sortedCategorized.tag9),
        tag8: addTrackingToCards(sortedCategorized.tag8),
        sgc10: addTrackingToCards(sortedCategorized.sgc10),
        aigrade10: addTrackingToCards(sortedCategorized.aigrade10),
        aigrade9: addTrackingToCards(sortedCategorized.aigrade9),
        otherGraded: addTrackingToCards(sortedCategorized.otherGraded)
      },
      gradingStats: categorized.gradingStats || {}
    };

    clearTimeout(timeout);
    res.json(responseData);
  } catch (error) {
    console.error('Card set analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze card set', details: error?.message || error });
  } finally {
    clearTimeout(timeout);
  }
});

// Helper function to analyze card set performance
function analyzeCardSetPerformance(cards) {
  const cardMap = new Map();
  
  cards.forEach(card => {
    // Extract player name and card number from title
    const title = card.title || '';
    const price = parseFloat(card.price?.value || 0);
    
    // Try to extract card number (common patterns)
    const cardNumberMatch = title.match(/#(\d+)/i);
    const cardNumber = cardNumberMatch ? cardNumberMatch[1] : 'Unknown';
    
    // Try to extract player name (before card number or common keywords)
    let playerName = 'Unknown';
    const beforeNumber = title.split(/#\d+/i)[0];
    if (beforeNumber) {
      // Remove common card set keywords
      const cleanName = beforeNumber
        .replace(/\b(topps|bowman|panini|upper deck|fleer|donruss|score|stadium club|gallery|heritage|chrome|update|series|one|two|three|first|second|third|base|parallel|insert|rookie|rc|auto|autograph|patch|relic|numbered|limited|gold|silver|bronze|platinum|diamond|emerald|sapphire|ruby|amethyst|onyx|black|white|blue|red|green|orange|purple|pink|yellow|brown|gray|grey|tan|cream|ivory|beige|mint|nm|near mint|used|good|excellent|very good|fair|poor|graded|psa|bgs|beckett|sgc|cgc|tag|ace|hga|gma|pgs|bvg|csg|rcg|ksa|fgs|pgm|dga|isa)\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
      
      if (cleanName && cleanName.length > 2) {
        playerName = cleanName;
      }
    }
    
    const key = `${playerName} #${cardNumber}`;
    
    if (!cardMap.has(key)) {
      cardMap.set(key, {
        playerName,
        cardNumber,
        title: card.title,
        salesCount: 0,
        totalValue: 0,
        averagePrice: 0,
        highestPrice: 0,
        lowestPrice: Infinity,
        recentSales: [],
        gradingBreakdown: {}
      });
    }
    
    const cardData = cardMap.get(key);
    cardData.salesCount++;
    cardData.totalValue += price;
    cardData.averagePrice = cardData.totalValue / cardData.salesCount;
    cardData.highestPrice = Math.max(cardData.highestPrice, price);
    cardData.lowestPrice = Math.min(cardData.lowestPrice, price);
    
    // Add recent sale
    cardData.recentSales.push({
      price,
      soldDate: card.soldDate,
      condition: card.condition,
      title: card.title,
      itemWebUrl: card.itemWebUrl
    });
    
    // Track grading breakdown
    const condition = card.condition || 'Unknown';
    if (!cardData.gradingBreakdown[condition]) {
      cardData.gradingBreakdown[condition] = 0;
    }
    cardData.gradingBreakdown[condition]++;
  });
  
  // Convert to array and sort by sales count
  return Array.from(cardMap.values())
    .map(card => ({
      ...card,
      lowestPrice: card.lowestPrice === Infinity ? 0 : card.lowestPrice,
      recentSales: card.recentSales.sort((a, b) => new Date(b.soldDate) - new Date(a.soldDate)).slice(0, 5)
    }))
    .sort((a, b) => b.salesCount - a.salesCount);
}

// Card set suggestions endpoint
router.get('/card-set-suggestions', async (req, res) => {
  try {
    const { query = '' } = req.query;
    
    if (!query || query.trim().length < 2) {
      return res.json({ suggestions: [] });
    }

    console.log(`🔍 Card set suggestions for: "${query}"`);

    // Load our enhanced set database
               let comprehensiveDatabase = [];
           try {
             const comprehensivePath = path.join(__dirname, '../data/comprehensiveCardDatabase.json');
             const comprehensiveData = await fs.readFile(comprehensivePath, 'utf8');
             const comprehensive = JSON.parse(comprehensiveData);
             comprehensiveDatabase = comprehensive.sets || [];
             console.log(`✅ Loaded comprehensive database with ${comprehensiveDatabase.length} sets`);
           } catch (error) {
             console.log('⚠️ Could not load comprehensive database, falling back to enhanced data');
           }

           let enhancedDatabase = [];
           if (comprehensiveDatabase.length === 0) {
             try {
               const enhancedPath = path.join(__dirname, '../data/enhancedSetFlatList.json');
               const enhancedData = await fs.readFile(enhancedPath, 'utf8');
               enhancedDatabase = JSON.parse(enhancedData);
               console.log(`✅ Loaded enhanced database with ${enhancedDatabase.length} items`);
             } catch (error) {
               console.log('⚠️ Could not load enhanced database, falling back to existing data');
             }
           }

    // Load existing card sets database as fallback
    let existingDatabase = [];
    try {
      const existingPath = path.join(__dirname, '../data/cardSetsDatabase.json');
      const existingData = await fs.readFile(existingPath, 'utf8');
      existingDatabase = JSON.parse(existingData);
      console.log(`✅ Loaded existing database with ${existingDatabase.length} items`);
    } catch (error) {
      console.log('⚠️ Could not load existing database');
    }

    // Combine and search both databases
    const allSuggestions = [];
    const searchQuery = query.toLowerCase().trim();

    // Search comprehensive database first (prioritize comprehensive data)
    if (comprehensiveDatabase.length > 0) {
      const comprehensiveMatches = comprehensiveDatabase
        .filter(set => {
          return set.searchText.includes(searchQuery) ||
                 set.name.toLowerCase().includes(searchQuery) ||
                 set.sport.toLowerCase().includes(searchQuery) ||
                 set.brand.toLowerCase().includes(searchQuery) ||
                 set.setName.toLowerCase().includes(searchQuery) ||
                 set.displayName.toLowerCase().includes(searchQuery);
        })
        .slice(0, 50) // Limit results
        .map(set => ({
          id: set.id,
          name: set.name,
          sport: set.sport,
          year: set.year,
          brand: set.brand,
          setName: set.setName,
          source: set.source,
          displayName: set.displayName
        }));

      allSuggestions.push(...comprehensiveMatches);
      console.log(`📋 Found ${comprehensiveMatches.length} matches in comprehensive database`);
    } else if (enhancedDatabase.length > 0) {
      const enhancedMatches = enhancedDatabase
        .filter(item => {
          if (item.type === 'set') {
            return item.searchText.includes(searchQuery) || 
                   item.name.toLowerCase().includes(searchQuery) ||
                   item.sport.toLowerCase().includes(searchQuery) ||
                   item.brand.toLowerCase().includes(searchQuery) ||
                   item.setName.toLowerCase().includes(searchQuery);
          }
          return false;
        })
        .slice(0, 50) // Limit results
        .map(item => ({
          id: item.id,
          name: item.name,
          sport: item.sport,
          year: item.year,
          brand: item.brand,
          setName: item.setName,
          source: 'getcardbase',
          displayName: `${item.sport} ${item.year} ${item.brand} ${item.setName}`.trim()
        }));

      allSuggestions.push(...enhancedMatches);
      console.log(`📋 Found ${enhancedMatches.length} matches in enhanced database`);
    }

    // Search existing database as fallback
    if (existingDatabase.length > 0) {
      const existingMatches = existingDatabase
        .filter(set => {
          const setText = `${set.sport} ${set.year} ${set.brand} ${set.setName}`.toLowerCase();
          return setText.includes(searchQuery);
        })
        .slice(0, 25) // Limit results
        .map(set => ({
          id: set.id || `existing_${set.sport}_${set.year}_${set.brand}`,
          name: set.setName,
          sport: set.sport,
          year: set.year,
          brand: set.brand,
          setName: set.setName,
          source: 'existing',
          displayName: `${set.sport} ${set.year} ${set.brand} ${set.setName}`.trim()
        }));

      allSuggestions.push(...existingMatches);
      console.log(`📋 Found ${existingMatches.length} matches in existing database`);
    }

    // Add inline suggestions for common searches
    const inlineSuggestions = [
      { id: 'inline_1', name: 'Topps Series One', sport: 'Baseball', year: '2025', brand: 'Topps', setName: 'Series One', source: 'inline', displayName: 'Baseball 2025 Topps Series One' },
      { id: 'inline_2', name: 'Topps Chrome', sport: 'Baseball', year: '2024', brand: 'Topps', setName: 'Chrome', source: 'inline', displayName: 'Baseball 2024 Topps Chrome' },
      { id: 'inline_3', name: 'Panini Prizm', sport: 'Basketball', year: '2024', brand: 'Panini', setName: 'Prizm', source: 'inline', displayName: 'Basketball 2024 Panini Prizm' },
      { id: 'inline_4', name: 'Donruss Optic', sport: 'Football', year: '2024', brand: 'Donruss', setName: 'Optic', source: 'inline', displayName: 'Football 2024 Donruss Optic' },
      { id: 'inline_5', name: 'Upper Deck Series One', sport: 'Hockey', year: '2024', brand: 'Upper Deck', setName: 'Series One', source: 'inline', displayName: 'Hockey 2024 Upper Deck Series One' }
    ];

    // Filter inline suggestions based on query
    const filteredInline = inlineSuggestions.filter(suggestion => 
      suggestion.displayName.toLowerCase().includes(searchQuery)
    );

    allSuggestions.push(...filteredInline);

    // Remove duplicates and limit results
    const uniqueSuggestions = [];
    const seen = new Set();
    
    allSuggestions.forEach(suggestion => {
      const key = `${suggestion.sport}_${suggestion.year}_${suggestion.brand}_${suggestion.setName}`;
      if (!seen.has(key) && uniqueSuggestions.length < 50) {
        seen.add(key);
        uniqueSuggestions.push(suggestion);
      }
    });

    console.log(`🎯 Returning ${uniqueSuggestions.length} unique suggestions`);

    res.json({
      suggestions: uniqueSuggestions,
      total: uniqueSuggestions.length,
      sources: {
        comprehensive: uniqueSuggestions.filter(s => s.source === 'comprehensive' || s.source === 'getcardbase' || s.source === 'generated').length,
        existing: uniqueSuggestions.filter(s => s.source === 'existing').length,
        inline: uniqueSuggestions.filter(s => s.source === 'inline').length
      }
    });

  } catch (error) {
    console.error('❌ Card set suggestions error:', error);
    res.status(500).json({ 
      error: 'Failed to get card set suggestions',
      suggestions: []
    });
  }
});

// Helper function to build database on the fly when file is not available
function buildOnTheFlyDatabase() {
  const database = [];
  const sports = ['Baseball', 'Basketball', 'Football', 'Hockey'];
  const brands = ['Topps', 'Panini', 'Upper Deck', 'Donruss'];
  const setTypes = ['Base Set', 'Chrome', 'Heritage', 'Update', 'Series One', 'Series Two', 'Prizm', 'Optic', 'Contenders', 'Finest', 'Select', 'Stadium Club', 'Gypsy Queen', 'Allen & Ginter', 'Bowman', 'Bowman Chrome'];
  
  let id = 1;
  
  // Generate sets for recent years (2020-2025)
  for (let year = 2020; year <= 2025; year++) {
    for (const sport of sports) {
      for (const brand of brands) {
        for (const setType of setTypes) {
          // Skip some combinations that don't make sense
          if (brand === 'Topps' && sport !== 'Baseball') continue;
          if (brand === 'Panini' && sport === 'Baseball') continue;
          if (brand === 'Upper Deck' && sport !== 'Hockey') continue;
          if (brand === 'Donruss' && sport === 'Baseball') continue;
          
          // Skip sealed product terms
          const sealedTerms = ['hobby', 'box', 'pack', 'case', 'sealed', 'booster', 'blaster', 'fat', 'jumbo', 'retail', 'hanger', 'value', 'complete', 'factory', 'unopened', 'wax', 'cello', 'wrapper'];
          const setTypeLower = setType.toLowerCase();
          if (sealedTerms.some(term => setTypeLower.includes(term))) continue;
          
          database.push({
            id: id++,
            name: `${brand} ${setType}`,
            sport: sport,
            year: year.toString(),
            brand: brand,
            setName: setType,
            source: 'OnTheFly',
            searchText: `${sport.toLowerCase()} ${year} ${brand.toLowerCase()} ${setType.toLowerCase()}`,
            displayName: `${sport} ${year} ${brand} ${setType}`
          });
        }
      }
    }
  }
  
  return database;
}

module.exports = {
  router,
  categorizeCards
}; 