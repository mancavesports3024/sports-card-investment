const axios = require('axios');

// Production endpoints
const EBAY_MARKETPLACE_INSIGHTS_ENDPOINT = 'https://api.ebay.com/buy/marketplace_insights/v1_beta/item_sales/search';
const EBAY_ANALYTICS_ENDPOINT = 'https://api.ebay.com/sell/analytics/v1/rate_limit';

// Rate limit cache to avoid checking too frequently
let rateLimitCache = {
  marketplaceInsights: null,
  lastCheck: 0
};

const CACHE_DURATION = 60000; // 1 minute cache

// Helper function to extract condition from title
function extractConditionFromTitle(title) {
  if (!title) return 'Unknown';
  
  const titleLower = title.toLowerCase();
  
  // Check for grading companies first
  if (titleLower.includes('psa') || titleLower.includes('bgs') || titleLower.includes('sgc') || titleLower.includes('cgc') ||
      titleLower.includes('beckett') || titleLower.includes('ace') || titleLower.includes('tag')) {
    return 'Graded';
  }
  
  // Check for specific conditions
  if (titleLower.includes('mint') || titleLower.includes('nm') || titleLower.includes('near mint') ||
      titleLower.includes('mint-nm') || titleLower.includes('nm-mt')) {
    return 'Near Mint';
  }
  
  if (titleLower.includes('used') || titleLower.includes('good') || titleLower.includes('lp') || 
      titleLower.includes('light play') || titleLower.includes('played')) {
    return 'Used';
  }
  
  // Check for new/other conditions
  if (titleLower.includes('new') || titleLower.includes('sealed') || titleLower.includes('pack fresh') ||
      titleLower.includes('factory sealed') || titleLower.includes('unopened')) {
    return 'New (Other)';
  }
  
  // Check for holo/foil cards which are typically in good condition
  if (titleLower.includes('holo') || titleLower.includes('foil') || titleLower.includes('holographic') ||
      titleLower.includes('prism') || titleLower.includes('rainbow') || titleLower.includes('alt art')) {
    return 'Near Mint'; // Most holo/foil cards are in good condition
  }
  
  // Check for damaged/poor condition
  if (titleLower.includes('damaged') || titleLower.includes('poor') || titleLower.includes('mp') ||
      titleLower.includes('moderate play') || titleLower.includes('heavily played')) {
    return 'Used';
  }
  
  return 'Unknown';
}

async function checkRateLimits() {
  const now = Date.now();
  
  // Return cached data if recent
  if (rateLimitCache.lastCheck && (now - rateLimitCache.lastCheck) < CACHE_DURATION) {
    return rateLimitCache;
  }

  console.log('\n=== CHECKING EBAY PRODUCTION API STATUS & LIMITS ===');
  
  try {
    // Check Marketplace Insights API connectivity and limits
    if (process.env.EBAY_AUTH_TOKEN) {
      try {
        // Test Marketplace Insights API connectivity
        const testParams = {
          q: 'baseball card',
          limit: 1
        };
        
        const testResponse = await axios.get(EBAY_MARKETPLACE_INSIGHTS_ENDPOINT, {
          params: testParams,
          headers: {
            'Authorization': `Bearer ${process.env.EBAY_AUTH_TOKEN}`,
            'X-EBAY-C-MARKETPLACE-ID': 'EBAY-US',
            'Content-Type': 'application/json'
          }
        });
        
        // Extract rate limit info from headers
        const rateLimitHeaders = {
          'X-Rate-Limit-Limit': testResponse.headers['x-rate-limit-limit'],
          'X-Rate-Limit-Remaining': testResponse.headers['x-rate-limit-remaining'],
          'X-Rate-Limit-Reset': testResponse.headers['x-rate-limit-reset']
        };
        
        rateLimitCache.marketplaceInsights = {
          success: true,
          data: { 
            status: 'working',
            message: 'Marketplace Insights API (Production) is accessible',
            rateLimits: Object.values(rateLimitHeaders).some(v => v) ? rateLimitHeaders : null
          }
        };
        console.log('✅ Marketplace Insights API (Production) is working');
        
        if (rateLimitHeaders['X-Rate-Limit-Limit']) {
          console.log(`   📊 Rate Limits: ${rateLimitHeaders['X-Rate-Limit-Remaining'] || 'N/A'}/${rateLimitHeaders['X-Rate-Limit-Limit']} calls`);
          if (rateLimitHeaders['X-Rate-Limit-Reset']) {
            console.log(`   🔄 Reset Time: ${new Date(parseInt(rateLimitHeaders['X-Rate-Limit-Reset']) * 1000).toISOString()}`);
          }
        } else {
          console.log('   📊 Production API limits: ~5,000 calls/day');
        }
      } catch (error) {
        rateLimitCache.marketplaceInsights = {
          success: false,
          error: error.message,
          status: error.response?.status
        };
        console.log('❌ Marketplace Insights API (Production) test failed:', error.message);
        if (error.response?.status) {
          console.log(`   Status: ${error.response.status}`);
        }
      }
    }



    rateLimitCache.lastCheck = now;
    
    // Log current API status
    logRateLimitStatus();
    
    console.log('=== END PRODUCTION API STATUS CHECK ===\n');
    
    return rateLimitCache;
  } catch (error) {
    console.error('Production API status check failed:', error.message);
    return rateLimitCache;
  }
}

function logRateLimitStatus() {
  console.log('\n📊 CURRENT PRODUCTION API STATUS:');
  
  if (rateLimitCache.marketplaceInsights?.success) {
    const insightsData = rateLimitCache.marketplaceInsights.data;
    console.log('🔍 Marketplace Insights API (Production):');
    console.log('   - Status: ✅ Working');
    if (insightsData.rateLimits) {
      const limits = insightsData.rateLimits;
      console.log(`   - Usage: ${limits['X-Rate-Limit-Remaining']}/${limits['X-Rate-Limit-Limit']} calls`);
      if (limits['X-Rate-Limit-Reset']) {
        console.log(`   - Reset: ${new Date(parseInt(limits['X-Rate-Limit-Reset']) * 1000).toISOString()}`);
      }
    } else {
      console.log('   - Note: Ready for sold item searches (Production)');
      console.log('   - Production limits: ~5,000 calls/day');
    }
  } else {
    console.log('🔍 Marketplace Insights API (Production):');
    console.log('   - Status: ❌ Not working');
    if (rateLimitCache.marketplaceInsights?.error) {
      console.log(`   - Error: ${rateLimitCache.marketplaceInsights.error}`);
    }
    if (rateLimitCache.marketplaceInsights?.status) {
      console.log(`   - HTTP Status: ${rateLimitCache.marketplaceInsights.status}`);
    }
  }
  

  
  // Summary
  const workingAPIs = [rateLimitCache.marketplaceInsights?.success].filter(Boolean).length;
  console.log(`\n📈 Summary: ${workingAPIs} out of 1 Production API is working`);
  
  // Rate limit recommendations
  console.log('\n💡 PRODUCTION RATE LIMIT TIPS:');
  console.log('   • Marketplace Insights API: ~5,000 calls/day (for sold items)');
  console.log('   • Check your eBay Developer account dashboard for exact limits');
  console.log('   • Limits reset daily at midnight UTC');
}

async function searchSoldItems({ keywords, numSales = 10, excludeGraded = false }) {
  try {
    // Check rate limits first
    await checkRateLimits();
    
    if (process.env.EBAY_AUTH_TOKEN) {
      return await searchWithMarketplaceInsightsAPI(keywords, numSales, excludeGraded);
    } else {
      throw new Error('EBAY_AUTH_TOKEN environment variable is required');
    }
  } catch (error) {
    throw error;
  }
}

async function searchWithMarketplaceInsightsAPI(keywords, numSales, excludeGraded) {
  // Validate required environment variable
  if (!process.env.EBAY_AUTH_TOKEN) {
    throw new Error('EBAY_AUTH_TOKEN environment variable is required for Marketplace Insights API');
  }

  try {
    // Prepare the API request for Marketplace Insights API
    // Note: Marketplace Insights API returns sold items by default
    const params = {
      q: keywords,
      limit: Math.min(numSales * 2, 200), // Request more items to account for filtering
      // Add additional parameters to get more diverse sale types
      fieldgroups: 'ASPECT_REFINEMENTS,MATCHING_ITEMS'
      // No filter parameter needed - API returns sold items by default
    };

    const headers = {
      'Authorization': `Bearer ${process.env.EBAY_AUTH_TOKEN}`,
      'X-EBAY-C-MARKETPLACE-ID': 'EBAY-US', // US marketplace
      'Content-Type': 'application/json'
    };

    // Make the API call
    const response = await axios.get(EBAY_MARKETPLACE_INSIGHTS_ENDPOINT, {
      params,
      headers
    });

    // Process and format the response for Marketplace Insights API
    const items = response.data.itemSales || [];
    
    console.log(`\n=== EBAY MARKETPLACE INSIGHTS API DEBUG ===`);
    console.log(`Total items returned: ${items.length}`);
    if (items.length > 0) {
      console.log(`Sample item data:`, JSON.stringify(items[0], null, 2));
      console.log(`Sale types found:`, items.map(item => item.listingType || 'unknown').slice(0, 10));
    }
    console.log(`=== END EBAY DEBUG ===\n`);
    
    // Filter out graded cards if excludeGraded is true
    let filteredItems = items;
    if (excludeGraded) {
      filteredItems = items.filter(item => {
        const title = item.title?.toLowerCase() || '';
        // Exclude cards with PSA, BGS, SGC, or other grading company mentions
        const gradedKeywords = ['psa', 'bgs', 'sgc', 'beckett', 'graded', 'grade'];
        return !gradedKeywords.some(keyword => title.includes(keyword));
      });
    }
    
    // Sort items by sold date (most recent first) since API doesn't support sorting
    filteredItems.sort((a, b) => {
      const dateA = new Date(a.soldDate || 0);
      const dateB = new Date(b.soldDate || 0);
      return dateB - dateA; // Most recent first
    });
    
    // Limit to requested number of sales
    filteredItems = filteredItems.slice(0, numSales);
    
    return filteredItems.map(item => {
      const isAuction = item.listingType === 'AUCTION';
      const soldPrice = item.soldPrice?.value;
      const originalPrice = item.price?.value; // Original listing price
      
      return {
        id: item.itemId,
        title: item.title,
        price: {
          value: soldPrice,
          currency: item.soldPrice?.currency || 'USD',
          originalPrice: originalPrice, // Original listing price (for comparison)
          priceType: isAuction ? 'final_bid' : 'buy_it_now'
        },
        soldDate: item.soldDate,
        condition: item.condition || extractConditionFromTitle(item.title),
        imageUrl: item.image?.imageUrl,
        itemWebUrl: item.itemWebUrl,
        seller: item.seller?.username,
        saleType: isAuction ? 'auction' : 'fixed_price',
        auction: isAuction ? {
          bidCount: item.bidCount || 0,
          startingPrice: item.startingPrice?.value,
          reserveMet: item.reserveMet || false,
          endTime: item.soldDate
        } : null,
        listingType: item.listingType,
        // Additional metadata
        category: item.category?.categoryName,
        location: item.itemLocation?.country,
        shippingCost: item.shippingCost?.value,
        totalPrice: soldPrice + (item.shippingCost?.value || 0)
      };
    });

  } catch (error) {
    console.error('eBay Marketplace Insights API Error:', error.response?.data || error.message);
    
    if (error.response?.status === 401) {
      throw new Error('Invalid eBay authentication token');
    } else if (error.response?.status === 429) {
      throw new Error('eBay API rate limit exceeded');
    } else if (error.response?.status >= 400) {
      throw new Error(`eBay API error: ${error.response?.data?.errors?.[0]?.message || error.message}`);
    }
    
    throw new Error(`Failed to fetch eBay data: ${error.message}`);
  }
}



module.exports = {
  searchSoldItems,
  checkRateLimits,
  logRateLimitStatus
}; 