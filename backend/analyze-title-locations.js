const EbayScraperService = require('./services/ebayScraperService.js');

async function analyzeTitleLocations() {
    const ebayService = new EbayScraperService();
    
    try {
        console.log('🔍 Finding where eBay actually stores card titles...');
        
        const testUrl = ebayService.buildSearchUrl('2024 Topps Chrome', 'Baseball', 'PSA 10');
        const response = await fetch(testUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const html = await response.text();
        
        // Find sections of HTML that contain card titles
        const cardSections = html.match(/.{0,300}2024[^<]*Topps[^<]*Chrome[^<]{0,300}/gi);
        
        if (cardSections && cardSections.length > 0) {
            console.log(`\n📍 Found ${cardSections.length} sections with card titles:`);
            
            cardSections.slice(0, 5).forEach((section, i) => {
                console.log(`\n--- Section ${i + 1} ---`);
                console.log(section);
                
                // Look for common HTML patterns around this text
                const contextMatch = html.match(new RegExp(`.{0,200}${section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').substring(0, 50)}.{0,200}`, 'i'));
                if (contextMatch) {
                    console.log('\n🔧 Full context:');
                    console.log(contextMatch[0]);
                }
            });
        }
        
        // Look for modern eBay patterns
        console.log('\n🔍 Testing modern eBay HTML patterns:');
        
        const modernPatterns = [
            { name: 'aria-label attributes', pattern: /aria-label\s*=\s*["']([^"']*2024[^"']*Topps[^"']*)["']/gi },
            { name: 'data-testid attributes', pattern: /data-testid[^>]*>([^<]*2024[^<]*Topps[^<]*)</gi },
            { name: 'span with content', pattern: /<span[^>]*>([^<]*2024[^<]*Topps[^<]*)</gi },
            { name: 'div with content', pattern: /<div[^>]*>([^<]*2024[^<]*Topps[^<]*)</gi },
            { name: 'text in quotes', pattern: /"([^"]*2024[^"]*Topps[^"]*Chrome[^"]*)"/gi },
            { name: 'JSON-like structures', pattern: /"title"\s*:\s*"([^"]*2024[^"]*Topps[^"]*)"/gi },
            { name: 'alt attributes', pattern: /alt\s*=\s*["']([^"']*2024[^"']*Topps[^"']*)["']/gi }
        ];
        
        modernPatterns.forEach(pattern => {
            const matches = [...html.matchAll(pattern.pattern)];
            console.log(`   ${pattern.name}: ${matches.length} matches`);
            if (matches.length > 0 && matches.length <= 5) {
                matches.forEach((match, i) => {
                    console.log(`      ${i + 1}: "${match[1].substring(0, 80)}..."`);
                });
            }
        });
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

analyzeTitleLocations().catch(console.error);
