const express = require('express');
const router = express.Router();
const ebayService = require('../services/ebayService');
const onepointService = require('../services/130pointService');
const ebayScraperService = require('../services/ebayScraperService');
const searchHistoryService = require('../services/searchHistoryService');
const cacheService = require('../services/cacheService');
const { getEbayApiUsage } = require('../services/ebayService');

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
  if (!cards || cards.length === 0) return { raw: [], psa9: [], psa10: [], priceAnalysis: null };
  
  const raw = [];
  const psa7 = [];
  const psa8 = [];
  const psa9 = [];
  const psa10 = [];
  const cgc9 = [];
  const cgc10 = [];
  const tag8 = [];
  const tag9 = [];
  const tag10 = [];
  const sgc10 = [];
  const aigrade9 = [];
  const aigrade10 = [];
  const otherGraded = [];
  
  console.log(`\n=== CARD CATEGORIZATION DEBUG ===`);
  console.log(`Total cards found: ${cards.length}`);
  
  cards.forEach((card, index) => {
    const title = card.title?.toLowerCase() || '';
    const condition = card.condition?.toLowerCase() || '';
    
    console.log(`\nCard ${index + 1}: "${card.title}"`);
    console.log(`Condition: "${card.condition}"`);
    
    // More precise grading detection - only look for actual grading companies and grades
    const gradingCompanies = ['psa', 'bgs', 'sgc', 'cgc', 'beckett', 'ace', 'cga', 'gma', 'hga', 'pgs', 'bvg', 'csg', 'rcg', 'ksa', 'fgs', 'tag', 'pgm', 'dga', 'isa'];
    const gradeNumbers = ['10', '9.5', '9', '8.5', '8', '7', '6', '5', '4', '3', '2', '1'];
    const rawKeywords = ['raw', 'ungraded', 'not graded', 'no grade'];
    const gradedConditionIds = ['2750', '4000', '5000']; // eBay's known graded condition IDs
    
    // Helper to check for grading companies
    function hasGradingCompany(str) {
      if (!str) return false;
      const lower = str.toLowerCase();
      // Use word boundaries to avoid false positives like "tag" in "advantage"
      const foundCompanies = gradingCompanies.filter(company => {
        // Look for the company as a whole word (with word boundaries)
        const regex = new RegExp(`\\b${company}\\b`, 'i');
        return regex.test(lower);
      });
      if (foundCompanies.length > 0) {
        console.log(`    Grading companies found: ${foundCompanies.join(', ')}`);
      }
      return foundCompanies.length > 0;
    }
    
    // Helper to check for grade numbers (but only if they appear near grading companies)
    function hasGradeNumber(str) {
      if (!str) return false;
      const lower = str.toLowerCase();
      // Check if any grade number appears near a grading company
      const foundGrades = gradeNumbers.filter(grade => {
        if (lower.includes(grade)) {
          // Look for grading company within 20 characters of the grade
          const gradeIndex = lower.indexOf(grade);
          const surroundingText = lower.substring(Math.max(0, gradeIndex - 20), gradeIndex + 20);
          // Use word boundaries for grading companies to avoid false positives
          const nearbyCompanies = gradingCompanies.filter(company => {
            const regex = new RegExp(`\\b${company}\\b`, 'i');
            return regex.test(surroundingText);
          });
          if (nearbyCompanies.length > 0) {
            console.log(`    Grade ${grade} found near companies: ${nearbyCompanies.join(', ')}`);
          }
          return nearbyCompanies.length > 0;
        }
        return false;
      });
      return foundGrades.length > 0;
    }
    
    // Helper to check for raw keywords
    function hasRawKeyword(str) {
      if (!str) return false;
      const lower = str.toLowerCase();
      return rawKeywords.some(keyword => lower.includes(keyword));
    }
    
    // Skip cards with "Pick", "Complete", or "Choose Your Card" in the title
    if (title.includes('pick') || title.includes('complete') || title.includes('choose your card')) {
      console.log(`  -> SKIPPED (Pick/Complete/Choose Your Card)`);
      return;
    }
    
    // Check for eBay graded conditionId
    if (gradedConditionIds.includes(String(card.conditionId))) {
      otherGraded.push(card);
      console.log('  -> OTHER GRADED (conditionId indicates graded)');
      return;
    }
    
    // Check if condition is "Graded" - these should never go to raw
    if (condition === 'graded') {
      console.log(`  -> Condition is "Graded" - checking for specific grading company`);
      // Try to categorize based on title patterns even if condition is "Graded"
      // This will fall through to the specific grading company checks below
    }
    
    // PSA 10
    if ((title.includes('psa 10') || title.includes('psa10')) && !title.includes('cgc')) {
      psa10.push(card);
      console.log(`  -> PSA 10`);
    } 
    // PSA 9
    else if ((title.includes('psa 9') || title.includes('psa9')) && !title.includes('cgc')) {
      psa9.push(card);
      console.log(`  -> PSA 9`);
    }
    // PSA 8
    else if ((title.includes('psa 8') || title.includes('psa8')) && !title.includes('cgc')) {
      psa8.push(card);
      console.log(`  -> PSA 8`);
    }
    // PSA 7
    else if ((title.includes('psa 7') || title.includes('psa7')) && !title.includes('cgc')) {
      psa7.push(card);
      console.log(`  -> PSA 7`);
    }
    // CGC 10 - more flexible pattern matching
    else if ((title.includes('cgc 10') || title.includes('cgc10') || 
              title.includes('cgc gem mint 10') || title.includes('cgc gem mint10') ||
              (title.includes('cgc') && title.includes('10') && !title.includes('psa'))) && 
             !title.includes('psa')) {
      cgc10.push(card);
      console.log(`  -> CGC 10`);
    }
    // CGC 9 - more flexible pattern matching
    else if ((title.includes('cgc 9') || title.includes('cgc9') || 
              title.includes('cgc gem mint 9') || title.includes('cgc gem mint9') ||
              (title.includes('cgc') && title.includes('9') && !title.includes('psa'))) && 
             !title.includes('psa')) {
      cgc9.push(card);
      console.log(`  -> CGC 9`);
    }
    // TAG 10
    else if ((title.includes('tag 10') || title.includes('tag10') || 
              (title.includes('tag') && title.includes('10') && !title.includes('psa') && !title.includes('cgc'))) && 
             !title.includes('psa') && !title.includes('cgc')) {
      tag10.push(card);
      console.log(`  -> TAG 10`);
    }
    // TAG 9
    else if ((title.includes('tag 9') || title.includes('tag9') || 
              (title.includes('tag') && title.includes('9') && !title.includes('psa') && !title.includes('cgc'))) && 
             !title.includes('psa') && !title.includes('cgc')) {
      tag9.push(card);
      console.log(`  -> TAG 9`);
    }
    // TAG 8
    else if ((title.includes('tag 8') || title.includes('tag8') || 
              (title.includes('tag') && title.includes('8') && !title.includes('psa') && !title.includes('cgc'))) && 
             !title.includes('psa') && !title.includes('cgc')) {
      tag8.push(card);
      console.log(`  -> TAG 8`);
    }
    // SGC 10
    else if ((title.includes('sgc 10') || title.includes('sgc10')) && !title.includes('psa') && !title.includes('cgc')) {
      sgc10.push(card);
      console.log(`  -> SGC 10`);
    }
    // AiGrade 10
    else if ((title.includes('aigrade 10') || title.includes('aigrade10') || title.includes('italian - grade 10') || 
              (title.includes('aigrade') && title.includes('10'))) && !title.includes('psa') && !title.includes('cgc')) {
      aigrade10.push(card);
      console.log(`  -> AiGrade 10`);
    }
    // AiGrade 9
    else if ((title.includes('aigrade 9') || title.includes('aigrade9') || title.includes('italian - grade 9') || 
              (title.includes('aigrade') && title.includes('9'))) && !title.includes('psa') && !title.includes('cgc')) {
      aigrade9.push(card);
      console.log(`  -> AiGrade 9`);
    }
    // Other graded cards (other companies/grades) - add to otherGraded if ambiguous or cross-listed
    else if (hasGradingCompany(title) || hasGradingCompany(condition) || hasGradeNumber(title) || hasGradeNumber(condition)) {
      // If the card is not already categorized as a specific company/grade, put it in otherGraded
      otherGraded.push(card);
      console.log(`  -> OTHER GRADED (Ambiguous or cross-listed grading company)`);
    } 
    // If condition is "Graded" but no specific grading company found, create a generic graded category
    else if (condition === 'graded') {
      otherGraded.push(card);
      console.log(`  -> OTHER GRADED (Condition is "Graded" but no specific company detected)`);
      return;
    }
    // Final catch: absolutely never allow 'graded' to fall through to raw
    if (condition === 'graded') {
      otherGraded.push(card);
      console.log(`  -> OTHER GRADED (Final catch: Condition is 'Graded')`);
      return;
    }
    else {
      // Otherwise, treat as raw
      raw.push(card);
      console.log(`  -> RAW (Added)`);
    }
  });
  
  console.log(`\n=== FINAL RESULTS ===`);
  console.log(`Raw: ${raw.length} | PSA 7: ${psa7.length} | PSA 8: ${psa8.length} | PSA 9: ${psa9.length} | PSA 10: ${psa10.length}`);
  console.log(`CGC 9: ${cgc9.length} | CGC 10: ${cgc10.length} | TAG 8: ${tag8.length} | TAG 9: ${tag9.length} | TAG 10: ${tag10.length} | SGC 10: ${sgc10.length}`);
  console.log(`AiGrade 9: ${aigrade9.length} | AiGrade 10: ${aigrade10.length} | Other Graded: ${otherGraded.length}`);
  console.log(`=== END DEBUG ===\n`);
  
  // Calculate price analysis
  const priceAnalysis = calculatePriceAnalysis(raw, psa7, psa8, psa9, psa10, cgc9, cgc10, tag8, tag9, tag10, sgc10, aigrade9, aigrade10, otherGraded);
  
  return { raw, psa7, psa8, psa9, psa10, cgc9, cgc10, tag8, tag9, tag10, sgc10, aigrade9, aigrade10, otherGraded, priceAnalysis };
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
  const analysis = {
    raw: { count: raw.length, avgPrice: 0, minPrice: 0, maxPrice: 0, trend: 'neutral' },
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
  if (raw.length > 0) {
    const rawPrices = raw.map(card => parseFloat(card.price?.value || 0)).filter(price => price > 0);
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
      ebayScraperService.scrapeEbaySales(searchQuery, currentBatchSize)
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

    // Fetch the last 100 sales from both sources
    console.log(`🎯 Fetching last 100 sales from eBay...`);
    const [ebayApiCards, ebayScrapedCards] = await Promise.allSettled([
      ebayService.searchSoldItems({ 
        keywords: searchQuery, 
        numSales: 100 
      }),
      ebayScraperService.scrapeEbaySales(searchQuery, 100)
    ]);

    // Combine results from both eBay sources
    let allCards = [];
    
    if (ebayApiCards.status === 'fulfilled') {
      allCards = allCards.concat(ebayApiCards.value);
      console.log(`✅ eBay API: ${ebayApiCards.value.length} sold items found`);
    } else {
      console.log('❌ eBay API search failed:', ebayApiCards.reason);
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
      }
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Failed to fetch card data', details: error.message });
  } finally {
    clearTimeout(timeout);
  }
});

// POST /api/search-cards (for production use)
router.post('/', async (req, res) => {
  const { searchQuery, numSales = 10 } = req.body;
  
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
    if (!process.env.EBAY_AUTH_TOKEN) {
      console.log('No eBay token found, returning mock data for testing');
      const mockData = getMockData(searchQuery, parseInt(numSales));
      const categorized = categorizeCards(mockData);
      const sorted = sortBySoldDate(categorized);
      clearTimeout(timeout);
      return res.json({ 
        searchParams: { searchQuery, numSales },
        results: sorted,
        priceAnalysis: sorted.priceAnalysis,
        note: "Mock data - set EBAY_AUTH_TOKEN in .env for real data"
      });
    }

    // Fetch the last 100 sales from both sources
    console.log(`🎯 Fetching last 100 sales from eBay...`);
    const [ebayApiCards, ebayScrapedCards] = await Promise.allSettled([
      ebayService.searchSoldItems({ 
        keywords: searchQuery, 
        numSales: 100 
      }),
      ebayScraperService.scrapeEbaySales(searchQuery, 100)
    ]);

    // Combine results from both eBay sources
    let allCards = [];
    
    if (ebayApiCards.status === 'fulfilled') {
      allCards = allCards.concat(ebayApiCards.value);
      console.log(`✅ eBay API: ${ebayApiCards.value.length} sold items found`);
    } else {
      console.log('❌ eBay API search failed:', ebayApiCards.reason);
    }
    
    if (ebayScrapedCards.status === 'fulfilled') {
      // Log item IDs before enrichment
      console.log('Scraped item IDs to enrich:', ebayScrapedCards.value.map(i => i.itemId));
      // Enrich scraped cards with eBay Browse API details
      let enrichedScraped = ebayScrapedCards.value;
      try {
        enrichedScraped = await ebayService.enrichItemsWithEbayDetails(ebayScrapedCards.value);
        console.log('Enriched item IDs:', enrichedScraped.map(i => i.itemId));
        // Log details for debug IDs after enrichment
        const debugIds = ['177250844467', '336054188829', '388680631496'];
        enrichedScraped.forEach(item => {
          if (debugIds.includes(String(item.itemId))) {
            console.log(`DEBUG (SEARCHCARDS ENRICHED): ItemId ${item.itemId} - condition: ${item.condition}, conditionId: ${item.conditionId}, title: ${item.title}`);
          }
        });
        console.log(`✅ Enriched ${enrichedScraped.length} scraped items with eBay Browse API details`);
      } catch (enrichErr) {
        console.log('⚠️ Enrichment of scraped items failed:', enrichErr.message);
      }
      allCards = allCards.concat(enrichedScraped);
      console.log(`✅ eBay Scraped: ${enrichedScraped.length} sold items found`);
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

    // Save the search to history
    try {
      await searchHistoryService.addSearch({
        searchQuery,
        results: sorted,
        priceAnalysis: sorted.priceAnalysis
      });
    } catch (error) {
      console.log('⚠️ Failed to save search to history:', error.message);
      // Don't fail the request if saving history fails
    }

    const responseData = { 
      searchParams: { searchQuery, numSales },
      results: sorted,
      priceAnalysis: sorted.priceAnalysis,
      sources: {
        ebayApi: ebayApiCards.status === 'fulfilled' ? ebayApiCards.value.length : 0,
        ebayScraped: ebayScrapedCards.status === 'fulfilled' ? ebayScrapedCards.value.length : 0,
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

    clearTimeout(timeout);
    res.json(responseData);
  } catch (error) {
    console.error('Search error:', error);
    clearTimeout(timeout);
    res.status(500).json({ error: 'Failed to fetch card data', details: error.message });
  }
});

module.exports = {
  router,
  categorizeCards
}; 