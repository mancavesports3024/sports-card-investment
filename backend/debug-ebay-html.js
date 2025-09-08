const EbayScraperService = require('./services/ebayScraperService.js');

async function debugEbayHtml() {
    const ebayService = new EbayScraperService();
    
    try {
        console.log('🔍 Testing eBay HTML structure analysis...');
        
        // Use a simple search to get HTML
        const testUrl = ebayService.buildSearchUrl('2024 Topps Chrome', 'Baseball', 'PSA 10');
        console.log(`🌐 Test URL: ${testUrl}`);
        
        // Make direct request to get HTML
        const response = await fetch(testUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const html = await response.text();
        console.log(`📄 HTML received: ${html.length} characters`);
        
        // Look for common title structures in current eBay HTML
        console.log('\n🔍 Analyzing HTML for title patterns...');
        
        // Look for any element containing "2024" and "Topps"
        const sample2024 = html.match(/.{0,200}2024.{0,200}Topps.{0,200}/gi);
        if (sample2024 && sample2024.length > 0) {
            console.log(`\n📝 Found ${sample2024.length} instances with "2024 Topps":`);
            sample2024.slice(0, 3).forEach((match, i) => {
                console.log(`   ${i + 1}: ${match.substring(0, 150)}...`);
            });
        }
        
        // Look for common HTML structures
        const structures = [
            { name: 'h3 tags', pattern: /<h3[^>]*>([^<]{10,200})<\/h3>/gi },
            { name: 'span with title', pattern: /<span[^>]*title[^>]*>([^<]{10,200})<\/span>/gi },
            { name: 'a with title', pattern: /<a[^>]*title[^>]*>([^<]{10,200})<\/a>/gi },
            { name: 'div with item', pattern: /<div[^>]*item[^>]*>([^<]{10,200})<\/div>/gi },
            { name: 'any title attribute', pattern: /title\s*=\s*["']([^"']{20,200})["']/gi },
            { name: 'data-item attributes', pattern: /data-item[^>]*=\s*["']([^"']{20,200})["']/gi }
        ];
        
        console.log('\n🔧 Testing different HTML structure patterns:');
        structures.forEach(structure => {
            const matches = [...html.matchAll(structure.pattern)];
            console.log(`   ${structure.name}: ${matches.length} matches`);
            if (matches.length > 0 && matches.length < 10) {
                matches.slice(0, 2).forEach((match, i) => {
                    console.log(`      Example ${i + 1}: "${match[1].substring(0, 80)}..."`);
                });
            }
        });
        
        // Look for price patterns
        console.log('\n💰 Testing price patterns:');
        const priceMatches = [...html.matchAll(/\$[\d,]+\.?\d*/g)];
        console.log(`   Found ${priceMatches.length} price-like strings`);
        if (priceMatches.length > 0) {
            const samplePrices = priceMatches.slice(0, 5).map(m => m[0]);
            console.log(`   Sample prices: ${samplePrices.join(', ')}`);
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

debugEbayHtml().catch(console.error);
