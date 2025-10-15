const EbayScraperService = require('./services/ebayScraperService.js');

async function debugHtmlContent() {
    const ebayService = new EbayScraperService();
    
    try {
        console.log('🔍 Debugging HTML content that has 0 titles...');
        
        // Use the exact search that was failing
        const searchTerm = "2024 Topps Chrome Negative Refractor Juan Soto #150";
        
        console.log(`\n🧪 Testing search: "${searchTerm}"`);
        
        // Get the search URL
        const searchUrl = ebayService.buildSearchUrl(searchTerm, null, 'PSA 10');
        console.log(`🌐 Search URL: ${searchUrl}`);
        
        // Make the request manually to examine content
        const axios = require('axios');
        const { HttpsProxyAgent } = require('https-proxy-agent');
        
        const username = process.env.PROXYMESH_USERNAME;
        const password = process.env.PROXYMESH_PASSWORD;
        const proxyUrl = `http://${username}:${password}@us-ca.proxymesh.com:31280`;
        const httpsAgent = new HttpsProxyAgent(proxyUrl);
        
        const response = await axios.get(searchUrl, {
            httpsAgent: httpsAgent,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate, br',
                'DNT': '1',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1'
            },
            timeout: 30000
        });
        
        const html = response.data;
        console.log(`\n📄 HTML Analysis:`);
        console.log(`   Length: ${html.length} characters`);
        console.log(`   First 500 characters:`);
        console.log(html.substring(0, 500));
        
        // Check for common eBay content
        console.log(`\n🔍 Content Analysis:`);
        console.log(`   Contains "eBay": ${html.includes('eBay')}`);
        console.log(`   Contains "Search results": ${html.includes('Search results')}`);
        console.log(`   Contains "Pardon Our Interruption": ${html.includes('Pardon Our Interruption')}`);
        console.log(`   Contains "2024": ${html.includes('2024')}`);
        console.log(`   Contains "Juan Soto": ${html.includes('Juan Soto')}`);
        console.log(`   Contains "PSA": ${html.includes('PSA')}`);
        console.log(`   Contains "sold": ${html.includes('sold')}`);
        console.log(`   Contains "$": ${html.includes('$')}`);
        
        // Look for potential title structures
        console.log(`\n🔧 HTML Structure Analysis:`);
        const h3Count = (html.match(/<h3/gi) || []).length;
        const spanCount = (html.match(/<span/gi) || []).length;
        const divCount = (html.match(/<div/gi) || []).length;
        const aCount = (html.match(/<a/gi) || []).length;
        
        console.log(`   <h3> tags: ${h3Count}`);
        console.log(`   <span> tags: ${spanCount}`);
        console.log(`   <div> tags: ${divCount}`);
        console.log(`   <a> tags: ${aCount}`);
        
        // Look for specific patterns that might contain titles
        console.log(`\n🔍 Pattern Search:`);
        const patterns = [
            { name: 'span with 2024', pattern: /<span[^>]*>[^<]*2024[^<]*<\/span>/gi },
            { name: 'div with 2024', pattern: /<div[^>]*>[^<]*2024[^<]*<\/div>/gi },
            { name: 'a with 2024', pattern: /<a[^>]*>[^<]*2024[^<]*<\/a>/gi },
            { name: 'any tag with Juan Soto', pattern: /<[^>]+>[^<]*Juan Soto[^<]*<\/[^>]+>/gi },
            { name: 'title attributes', pattern: /title\s*=\s*["'][^"']*2024[^"']*["']/gi }
        ];
        
        patterns.forEach(pattern => {
            const matches = [...html.matchAll(pattern.pattern)];
            console.log(`   ${pattern.name}: ${matches.length} matches`);
            if (matches.length > 0 && matches.length <= 3) {
                matches.forEach((match, i) => {
                    console.log(`      ${i + 1}: ${match[0].substring(0, 80)}...`);
                });
            }
        });
        
        // Check if this is a CAPTCHA or blocked page
        if (html.includes('Pardon Our Interruption')) {
            console.log(`\n🚨 CAPTCHA/BLOCK DETECTED!`);
            console.log(`   Even with working proxy, eBay is serving security page`);
        } else if (html.length < 20000) {
            console.log(`\n⚠️ SMALL HTML SIZE - Possible minimal/error page`);
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

debugHtmlContent().catch(console.error);

