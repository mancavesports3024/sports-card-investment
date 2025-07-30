const axios = require('axios');
const cheerio = require('cheerio');

async function debugBleacherSeatsHTML() {
  try {
    console.log('🔍 Debugging Bleacher Seats HTML structure...\n');
    
    const response = await axios.get('https://bleacherseatscollectibles.com/release-calendar/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      },
      timeout: 15000
    });

    if (response.status !== 200) {
      throw new Error(`HTTP ${response.status}: Failed to fetch release calendar`);
    }

    const $ = cheerio.load(response.data);
    
    console.log('📄 Page title:', $('title').text().trim());
    console.log('📄 Page heading:', $('h1').text().trim());
    
    // Look for all headings
    console.log('\n📋 All headings found:');
    $('h1, h2, h3, h4, h5, h6').each((index, element) => {
      const text = $(element).text().trim();
      if (text) {
        console.log(`  ${element.tagName}: "${text}"`);
      }
    });
    
    // Look for paragraphs that might contain release dates
    console.log('\n📅 Looking for release date patterns...');
    $('p, div, span').each((index, element) => {
      const text = $(element).text().trim();
      if (text && /\d{2}\/\d{2}\/\d{2}/.test(text)) {
        console.log(`  Found date pattern: "${text}"`);
      }
    });
    
    // Look for any text containing "July", "August", etc.
    console.log('\n📅 Looking for month names...');
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                   'July', 'August', 'September', 'October', 'November', 'December'];
    
    months.forEach(month => {
      const elements = $(`*:contains("${month}")`);
      if (elements.length > 0) {
        console.log(`  Found "${month}" in ${elements.length} elements`);
        elements.slice(0, 3).each((index, element) => {
          const text = $(element).text().trim();
          if (text.includes(month)) {
            console.log(`    "${text.substring(0, 100)}..."`);
          }
        });
      }
    });
    
    // Save the full HTML for inspection
    const fs = require('fs');
    fs.writeFileSync('bleacher-seats-debug.html', response.data);
    console.log('\n💾 Full HTML saved to bleacher-seats-debug.html');
    
  } catch (error) {
    console.error('❌ Error debugging HTML:', error.message);
  }
}

debugBleacherSeatsHTML(); 