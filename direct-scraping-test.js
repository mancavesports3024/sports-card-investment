const axios = require('axios');
const cheerio = require('cheerio');

async function testDirectScraping() {
  try {
    console.log('🧪 Testing direct eBay scraping for condition values...\n');
    
    // Build search URL for completed sales
    const searchParams = new URLSearchParams({
      '_nkw': 'charizard ex 223/197',
      '_sacat': '0',
      'LH_Sold': '1',
      '_sop': '13',
      '_dmd': '2'
    });
    
    const searchUrl = `https://www.ebay.com/sch/i.html?${searchParams.toString()}`;
    
    console.log(`📡 Fetching: ${searchUrl}`);
    
    // Make request to eBay
    const response = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
      timeout: 15000
    });

    if (response.status !== 200) {
      throw new Error(`HTTP ${response.status}: Failed to fetch eBay data`);
    }

    // Parse HTML response
    const $ = cheerio.load(response.data);
    
    console.log('\n🔍 Analyzing first 5 items for condition information...\n');
    
    // Extract condition data from the first 5 items
    $('.s-item').slice(0, 5).each((index, element) => {
      const $el = $(element);
      
      // Extract item title
      const title = $el.find('.s-item__title').first().text().trim();
      
      // Skip if title is empty or contains "Shop on eBay"
      if (!title || title.includes('Shop on eBay')) {
        return;
      }
      
      console.log(`\n--- Item ${index + 1} ---`);
      console.log(`Title: "${title}"`);
      
      // Check .s-item__condition
      const conditionElement = $el.find('.s-item__condition').first();
      const conditionText = conditionElement.text().trim();
      const conditionHtml = conditionElement.html();
      
      console.log(`🔍 .s-item__condition text: "${conditionText}"`);
      console.log(`🔍 .s-item__condition HTML: "${conditionHtml}"`);
      
      // Check other potential condition selectors
      const selectors = [
        '.s-item__subtitle',
        '.s-item__info .s-item__subtitle',
        '.s-item__title--tagblock',
        '.s-item__info span'
      ];
      
      selectors.forEach(selector => {
        const text = $el.find(selector).first().text().trim();
        if (text) {
          console.log(`🔍 ${selector}: "${text}"`);
        }
      });
      
      // Show all text content for debugging
      const allText = $el.text();
      const lines = allText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      console.log(`🔍 All text content (first 10 lines):`);
      lines.slice(0, 10).forEach((line, i) => {
        console.log(`   ${i + 1}. "${line}"`);
      });
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testDirectScraping(); 