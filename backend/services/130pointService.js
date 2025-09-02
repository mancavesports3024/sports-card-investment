const axios = require('axios');
const qs = require('querystring');

// Use the backend API endpoint that was working
const ONEPOINT_URL = 'https://back.130point.com/sales/';

class OnePointService {
    constructor() {
        this.sessionId = null;
        this.lastRequestTime = 0;
        this.minRequestInterval = 1000; // 1 second between requests
    }

    async search130point(keywords) {
        try {
            // Ensure minimum time between requests
            const now = Date.now();
            const timeSinceLastRequest = now - this.lastRequestTime;
            if (timeSinceLastRequest < this.minRequestInterval) {
                const waitTime = this.minRequestInterval - timeSinceLastRequest;
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }

            console.log(`🔍 130pointService DEBUG: Original keywords: "${keywords}"`);
            
            console.log(`🔍 130pointService DEBUG: Original keywords: "${keywords}"`);
            console.log(`🔍 130pointService DEBUG: Query contains negative keywords: ${keywords.includes('-(psa, bgs, sgc, cgc, graded, slab)')}`);
            console.log(`🔍 130pointService DEBUG: Query contains parentheses: ${keywords.includes('(')}`);
            console.log(`🔍 130pointService DEBUG: Query contains commas: ${keywords.includes(',')}`);
            console.log(`🔍 130pointService DEBUG: Query contains minus signs: ${keywords.includes('-')}`);

            // Make POST request to the backend API with form data
            const formData = qs.stringify({ 
                query: keywords
            });

            const response = await axios.post(ONEPOINT_URL, formData, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
                    'Accept': '*/*',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept-Encoding': 'gzip, deflate, br, zstd',
                    'Origin': 'https://130point.com',
                    'Referer': 'https://130point.com/',
                    'Connection': 'keep-alive',
                    'Sec-Fetch-Dest': 'empty',
                    'Sec-Fetch-Mode': 'cors',
                    'Sec-Fetch-Site': 'same-site'
                },
                timeout: 30000
            });

            this.lastRequestTime = Date.now();

            if (response.status === 200) {
                console.log(`🔍 130pointService DEBUG: Response status: ${response.status}`);
                console.log(`🔍 130pointService DEBUG: Response data length: ${response.data ? response.data.length : 'undefined'}`);
                console.log(`🔍 130pointService DEBUG: Response data preview: ${response.data ? response.data.substring(0, 500) : 'undefined'}`);
                return this.parseSearchResults(response.data);
            } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        } catch (error) {
            console.error('Error searching 130point:', error.message);
            throw error;
        }
    }

    parseSearchResults(html) {
        try {
            console.log(`🔍 130pointService DEBUG: parseSearchResults called with HTML length: ${html ? html.length : 'undefined'}`);
            console.log(`🔍 130pointService DEBUG: HTML preview: ${html ? html.substring(0, 1000) : 'undefined'}`);
            
            const results = [];
            
            // Look for the sales data table - the actual class is 'sold_data-simple'
            const tableMatch = html.match(/<table[^>]*class="[^"]*sold_data-simple[^"]*"[^>]*>([\s\S]*?)<\/table>/i);
            if (!tableMatch) {
                console.log('🔍 130pointService DEBUG: No sales table found in HTML');
                console.log(`🔍 130pointService DEBUG: HTML contains 'table': ${html ? html.includes('table') : 'undefined'}`);
                console.log(`🔍 130pointService DEBUG: HTML contains 'sold_data-simple': ${html ? html.includes('sold_data-simple') : 'undefined'}`);
                return results;
            }

            const tableHtml = tableMatch[1];
            
            // Extract rows from the table body - look for rows with ID 'rowsold_dataTable'
            const rowMatches = tableHtml.match(/<tr[^>]*id=['"]rowsold_dataTable['"][^>]*>([\s\S]*?)<\/tr>/gi);
            if (!rowMatches) {
                console.log('🔍 130pointService DEBUG: No data rows found in sales table');
                console.log(`🔍 130pointService DEBUG: HTML contains 'rowsold_dataTable': ${tableHtml ? tableHtml.includes('rowsold_dataTable') : 'undefined'}`);
                return results;
            }

            console.log(`🔍 130pointService DEBUG: Found ${rowMatches.length} data rows`);

            // Process each data row
            for (let i = 0; i < rowMatches.length; i++) {
                const row = rowMatches[i];
                
                // Extract title from the second td (Item Details)
                const titleMatch = row.match(/<b>Item Title: <\/b><a[^>]*>([^<]+)<\/a>/i);
                const priceMatch = row.match(/<b>Sale Price: <\/b>[^<]*<span[^>]*>([^<]+)<\/span>/i) || 
                                   row.match(/<b>Sale Price: <\/b><a[^>]*><span[^>]*>([^<]+)<\/span>/i);
                const dateMatch = row.match(/<b>Sale Date: <\/b>([^<]+)/i);
                
                if (titleMatch) {
                    const title = this.cleanHtml(titleMatch[1]);
                    let price = 0;
                    
                    if (priceMatch) {
                        const priceText = this.cleanHtml(priceMatch[1]);
                        price = parseFloat(priceText.replace(/[^\d.]/g, ''));
                    }
                    
                    const date = dateMatch ? this.cleanHtml(dateMatch[1]) : '';
                    
                    if (title && !isNaN(price) && price > 0) {
                        results.push({
                            title: title,
                            price: price,
                            date: date
                        });
                    }
                }
            }

            console.log(`Parsed ${results.length} results from 130point HTML`);
            return results;
        } catch (error) {
            console.error('Error parsing 130point results:', error);
            return [];
        }
    }

    cleanHtml(html) {
        return html
            .replace(/<[^>]*>/g, '') // Remove HTML tags
            .replace(/&nbsp;/g, ' ') // Replace &nbsp; with space
            .replace(/&amp;/g, '&') // Replace &amp; with &
            .replace(/&lt;/g, '<') // Replace &lt; with <
            .replace(/&gt;/g, '>') // Replace &gt; with >
            .replace(/&quot;/g, '"') // Replace &quot; with "
            .trim();
    }

    async check130pointStatus() {
        try {
            // Test the service with a simple query
            const testResults = await this.search130point('baseball card');
            return {
                success: true,
                status: 200,
                message: '130point service is working',
                testResultsCount: testResults.length
            };
        } catch (error) {
            return {
                success: false,
                status: 500,
                error: error.message
            };
        }
    }
}

module.exports = OnePointService; 