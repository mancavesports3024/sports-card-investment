const axios = require('axios');
const qs = require('querystring');

// Use the backend API endpoint that actually processes searches
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
            
            // Format the query exactly like the browser does
            // Replace spaces with + and let the form encoding handle the rest
            const formattedQuery = keywords.replace(/\s+/g, '+');
            
            console.log(`🔍 130pointService DEBUG: Formatted query: "${formattedQuery}"`);
            console.log(`🔍 130pointService DEBUG: Formatted query contains negative keywords: ${formattedQuery.includes('-(psa, bgs, sgc, cgc, graded, slab)')}`);
            console.log(`🔍 130pointService DEBUG: Formatted query contains parentheses: ${formattedQuery.includes('(')}`);
            console.log(`🔍 130pointService DEBUG: Formatted query contains commas: ${formattedQuery.includes(',')}`);
            console.log(`🔍 130pointService DEBUG: Formatted query contains minus signs: ${formattedQuery.includes('-')}`);

            // Make POST request to the backend API with exact same headers as browser
            const formData = qs.stringify({ 
                query: formattedQuery
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
            
            // Look for the sales data table
            const tableMatch = html.match(/<table[^>]*class="[^"]*sales-table[^"]*"[^>]*>([\s\S]*?)<\/table>/i);
            if (!tableMatch) {
                console.log('🔍 130pointService DEBUG: No sales table found in HTML');
                console.log(`🔍 130pointService DEBUG: HTML contains 'table': ${html ? html.includes('table') : 'undefined'}`);
                console.log(`🔍 130pointService DEBUG: HTML contains 'sales-table': ${html ? html.includes('sales-table') : 'undefined'}`);
                return results;
            }

            const tableHtml = tableMatch[1];
            
            // Extract rows from the table body
            const rowMatches = tableHtml.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
            if (!rowMatches) {
                console.log('No rows found in sales table');
                return results;
            }

            // Skip header row and process data rows
            for (let i = 1; i < rowMatches.length; i++) {
                const row = rowMatches[i];
                
                // Extract title, price, and date from the row
                const titleMatch = row.match(/<td[^>]*>([\s\S]*?)<\/td>/i);
                const priceMatch = row.match(/<td[^>]*>\s*\$([\d,]+\.?\d*)\s*<\/td>/i);
                const dateMatch = row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi);
                
                if (titleMatch && priceMatch) {
                    const title = this.cleanHtml(titleMatch[1]);
                    const price = parseFloat(priceMatch[1].replace(/,/g, ''));
                    const date = dateMatch && dateMatch.length > 2 ? this.cleanHtml(dateMatch[2]) : '';
                    
                    if (title && !isNaN(price)) {
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