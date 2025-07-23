const express = require('express');
const router = express.Router();
const ebayService = require('../services/ebayService');
const onepointService = require('../services/130pointService');
const ebayScraperService = require('../services/ebayScraperService');
const searchHistoryService = require('../services/searchHistoryService');
const cacheService = require('../services/cacheService');
const { getEbayApiUsage } = require('../services/ebayService');
const point130Service = require('../services/130pointService');

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
    // Merge dynamic buckets into result
    const categorizedResult = { ...legacyBuckets, priceAnalysis, gradingStats };
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
    Object.entries(dynamicBuckets).forEach(([bucket, arr]) => {
      if (bucket !== 'raw') categorizedResult[bucket] = arr;
    });
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
    psa10: { count: psa10.length, avgPrice: 0, minPrice: 0, maxPrice: 0, trend: 'neutral' },
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

  if (psa10.length > 0) {
    const psa10Prices = psa10.map(card => parseFloat(card.price?.value || 0)).filter(price => price > 0);
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
  analysis.psa10.trend = calculatePriceTrend(psa10);
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

// Helper function to sort by sold date
const sortBySoldDate = (categorized) => {
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

  // Safely sort each category
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
      const sorted = sortBySoldDate(categorized);
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
    const sorted = sortBySoldDate(categorized);

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
    const sorted = sortBySoldDate(categorized);

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
      }
    };

    // Add eBay API usage info (temporarily disabled)
    // let ebayApiUsage = null;
    // try {
    //   ebayApiUsage = await getEbayApiUsage();
    // } catch (usageError) {
    //   console.error('Failed to fetch eBay API usage:', usageError.message);
    // }
    // responseData.ebayApiUsage = ebayApiUsage;

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

module.exports = {
  router,
  categorizeCards
}; 