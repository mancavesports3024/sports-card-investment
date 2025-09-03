const axios = require('axios');

class CollectiblesCardDetailService {
    constructor() {
        this.baseUrl = 'https://collectibles.com';
        this.apiBaseUrl = 'https://api.getcardbase.com/collectibles/api/mobile/v1';
        this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36';
        this.sessionCookies = '';
        this.isAuthenticated = false;
    }

    /**
     * Authenticate with collectibles.com using provided credentials
     * @param {string} email - User email
     * @param {string} password - User password
     * @returns {Object} Authentication result
     */
    async authenticate(email, password) {
        try {
            console.log('🔐 CollectiblesCardDetailService: Authenticating...');
            
            // First, get the login page to extract CSRF token
            const loginPageResponse = await axios.get(`${this.baseUrl}/users/sign_in`, {
                headers: {
                    'User-Agent': this.userAgent,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                },
                timeout: 30000
            });

            // Extract CSRF token from the login page
            const csrfToken = this.extractCSRFToken(loginPageResponse.data);
            if (!csrfToken) {
                throw new Error('Could not extract CSRF token from login page');
            }

            console.log('🔐 Got CSRF token, attempting login...');

            // Now attempt to log in
            const loginResponse = await axios.post(`${this.baseUrl}/users/sign_in`, 
                `user[email]=${encodeURIComponent(email)}&user[password]=${encodeURIComponent(password)}&user[remember_me]=1&authenticity_token=${encodeURIComponent(csrfToken)}`,
                {
                    headers: {
                        'User-Agent': this.userAgent,
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.9',
                        'Accept-Encoding': 'gzip, deflate, br',
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Cache-Control': 'no-cache',
                        'Pragma': 'no-cache',
                        'Origin': this.baseUrl,
                        'Referer': `${this.baseUrl}/users/sign_in`
                    },
                    maxRedirects: 5,
                    timeout: 30000
                }
            );

            // Check if login was successful
            if (loginResponse.headers['set-cookie']) {
                this.sessionCookies = loginResponse.headers['set-cookie']
                    .map(cookie => cookie.split(';')[0])
                    .join('; ');
                console.log('🔐 Login successful, got session cookies');
                this.isAuthenticated = true;
                
                return {
                    success: true,
                    message: 'Authentication successful',
                    hasCookies: !!this.sessionCookies
                };
            } else {
                // Check if we got redirected to a dashboard or if there's an error
                const responseText = loginResponse.data;
                if (responseText.includes('Login') || responseText.includes('Invalid')) {
                    throw new Error('Login failed - invalid credentials');
                } else if (responseText.includes('Dashboard') || responseText.includes('Welcome')) {
                    console.log('🔐 Login appears successful (redirected to dashboard)');
                    this.isAuthenticated = true;
                    return {
                        success: true,
                        message: 'Authentication successful (redirected)',
                        hasCookies: !!this.sessionCookies
                    };
                } else {
                    console.log('🔐 Login response unclear, checking status...');
                    return {
                        success: true,
                        message: 'Login attempt completed, status unclear',
                        hasCookies: !!this.sessionCookies,
                        statusCode: loginResponse.status
                    };
                }
            }

        } catch (error) {
            console.error('❌ CollectiblesCardDetailService: Authentication error:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Extract CSRF token from HTML
     */
    extractCSRFToken(html) {
        const csrfMatch = html.match(/name="authenticity_token" value="([^"]+)"/);
        return csrfMatch ? csrfMatch[1] : null;
    }

    /**
     * Get detailed information about a specific card using its catalog item variation ID
     * @param {string} catalogItemVariationId - The variation ID from the URL
     * @param {string} cardSlug - The card slug (e.g., 'ci-2024-topps-update-us50-jackson-holliday')
     * @returns {Object} Card details including pricing, condition, variations, etc.
     */
    async getCardDetails(catalogItemVariationId, cardSlug = null) {
        try {
            if (!this.isAuthenticated) {
                return {
                    success: false,
                    error: 'Not authenticated. Please call authenticate() first with valid credentials.'
                };
            }

            console.log(`🔍 CollectiblesCardDetailService: Fetching details for variation ID: ${catalogItemVariationId}`);
            
            // Try multiple approaches to get card data
            const results = {
                variationId: catalogItemVariationId,
                cardSlug: cardSlug,
                approaches: {}
            };

            // Approach 1: Try to get data from the main page (now authenticated)
            try {
                const pageData = await this.getCardPageData(catalogItemVariationId, cardSlug);
                results.approaches.pageScraping = pageData;
            } catch (error) {
                console.log(`❌ Page scraping approach failed: ${error.message}`);
                results.approaches.pageScraping = { error: error.message };
            }

            // Approach 2: Try to get data from the CardBase API
            try {
                const apiData = await this.getCardBaseData(catalogItemVariationId);
                results.approaches.cardBaseApi = apiData;
            } catch (error) {
                console.log(`❌ CardBase API approach failed: ${error.message}`);
                results.approaches.cardBaseApi = { error: error.message };
            }

            // Approach 3: Try to get data from the mobile API
            try {
                const mobileData = await this.getMobileApiData(catalogItemVariationId);
                results.approaches.mobileApi = mobileData;
            } catch (error) {
                console.log(`❌ Mobile API approach failed: ${error.message}`);
                results.approaches.mobileApi = { error: error.message };
            }

            return {
                success: true,
                data: results
            };

        } catch (error) {
            console.error('❌ CollectiblesCardDetailService: Error getting card details:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Try to get data by scraping the card's page (now with authentication)
     */
    async getCardPageData(catalogItemVariationId, cardSlug) {
        try {
            let url;
            if (cardSlug) {
                url = `${this.baseUrl}/baseball-cards/baseball-cards/${cardSlug}?catalog_item_variation_id=${catalogItemVariationId}`;
            } else {
                // Try to construct a URL with just the variation ID
                url = `${this.baseUrl}/baseball-cards/baseball-cards/?catalog_item_variation_id=${catalogItemVariationId}`;
            }

            console.log(`🔍 Trying to fetch authenticated page: ${url}`);
            
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': this.userAgent,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache',
                    'Cookie': this.sessionCookies,
                    'Sec-Fetch-Dest': 'document',
                    'Sec-Fetch-Mode': 'navigate',
                    'Sec-Fetch-Site': 'same-origin',
                    'Upgrade-Insecure-Requests': '1'
                },
                timeout: 30000
            });

            const html = response.data;
            
            // Check if we're still getting a login page
            if (html.includes('Login') || html.includes('Sign in')) {
                throw new Error('Still getting login page - authentication may have failed');
            }
            
            // Extract useful information from the HTML
            const extractedData = {
                url: url,
                statusCode: response.status,
                contentLength: html.length,
                title: this.extractTitle(html),
                price: this.extractPrice(html),
                condition: this.extractCondition(html),
                cardDetails: this.extractCardDetails(html),
                variations: this.extractVariations(html),
                images: this.extractImages(html),
                isAuthenticated: !html.includes('Login')
            };

            return extractedData;

        } catch (error) {
            throw new Error(`Page scraping failed: ${error.message}`);
        }
    }

    /**
     * Try to get data from the CardBase API
     */
    async getCardBaseData(catalogItemVariationId) {
        try {
            // Try different CardBase API endpoints
            const endpoints = [
                `/catalog_items/${catalogItemVariationId}`,
                `/catalog_item_variations/${catalogItemVariationId}`,
                `/items/${catalogItemVariationId}`,
                `/variations/${catalogItemVariationId}`
            ];

            for (const endpoint of endpoints) {
                try {
                    const url = `${this.apiBaseUrl}${endpoint}`;
                    console.log(`🔍 Trying CardBase endpoint: ${url}`);
                    
                    const response = await axios.get(url, {
                        headers: {
                            'User-Agent': this.userAgent,
                            'Accept': 'application/json',
                            'Accept-Language': 'en-US,en;q=0.9'
                        },
                        timeout: 15000
                    });

                    if (response.data && Object.keys(response.data).length > 0) {
                        return {
                            endpoint: endpoint,
                            url: url,
                            statusCode: response.status,
                            data: response.data
                        };
                    }
                } catch (endpointError) {
                    console.log(`❌ Endpoint ${endpoint} failed: ${endpointError.message}`);
                    continue;
                }
            }

            throw new Error('All CardBase API endpoints failed');

        } catch (error) {
            throw new Error(`CardBase API failed: ${error.message}`);
        }
    }

    /**
     * Try to get data from the mobile API
     */
    async getMobileApiData(catalogItemVariationId) {
        try {
            const url = `${this.apiBaseUrl}/catalog_items/${catalogItemVariationId}/mobile`;
            console.log(`🔍 Trying mobile API: ${url}`);
            
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': this.userAgent,
                    'Accept': 'application/json',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                timeout: 15000
            });

            return {
                url: url,
                statusCode: response.status,
                data: response.data
            };

        } catch (error) {
            throw new Error(`Mobile API failed: ${error.message}`);
        }
    }

    /**
     * Extract title from HTML
     */
    extractTitle(html) {
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        return titleMatch ? titleMatch[1].trim() : null;
    }

    /**
     * Extract price information from HTML
     */
    extractPrice(html) {
        const pricePatterns = [
            /price[^>]*>[\s]*\$?([\d,]+\.?\d*)/i,
            /\$([\d,]+\.?\d*)/g,
            /price[^>]*>[\s]*([\d,]+\.?\d*)/i
        ];

        for (const pattern of pricePatterns) {
            const match = html.match(pattern);
            if (match) {
                return match[1];
            }
        }
        return null;
    }

    /**
     * Extract condition information from HTML
     */
    extractCondition(html) {
        const conditionPatterns = [
            /condition[^>]*>([^<]+)</i,
            /grade[^>]*>([^<]+)</i,
            /psa[^>]*>([^<]+)</i,
            /bgs[^>]*>([^<]+)</i
        ];

        for (const pattern of conditionPatterns) {
            const match = html.match(pattern);
            if (match) {
                return match[1].trim();
            }
        }
        return null;
    }

    /**
     * Extract card details from HTML
     */
    extractCardDetails(html) {
        const details = {};
        
        // Look for common card information patterns
        const patterns = {
            year: /(\d{4})\s+(?:topps|panini|bowman|upper\s+deck)/i,
            brand: /(topps|panini|bowman|upper\s+deck)/i,
            set: /(update|chrome|prizm|select|optic|contenders)/i,
            cardNumber: /#(\d+)/,
            player: /([A-Z][a-z]+\s+[A-Z][a-z]+)/,
            parallel: /(gold|silver|black|rainbow|blue|red|green|purple|orange)/i
        };

        for (const [key, pattern] of Object.entries(patterns)) {
            const match = html.match(pattern);
            if (match) {
                details[key] = match[1];
            }
        }

        return details;
    }

    /**
     * Extract variation information from HTML
     */
    extractVariations(html) {
        const variations = [];
        
        // Look for variation patterns
        const variationPatterns = [
            /variation[^>]*>([^<]+)</gi,
            /parallel[^>]*>([^<]+)</gi,
            /edition[^>]*>([^<]+)</gi
        ];

        for (const pattern of variationPatterns) {
            let match;
            while ((match = pattern.exec(html)) !== null) {
                variations.push(match[1].trim());
            }
        }

        return variations;
    }

    /**
     * Extract image URLs from HTML
     */
    extractImages(html) {
        const images = [];
        const imgPattern = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
        
        let match;
        while ((match = imgPattern.exec(html)) !== null) {
            const src = match[1];
            if (src.includes('collectibles.com') || src.includes('getcardbase.com')) {
                images.push(src);
            }
        }

        return images;
    }

    /**
     * Test the service with a known card
     */
    async testService() {
        try {
            const testCard = {
                variationId: '21763861',
                slug: 'ci-2024-topps-update-us50-jackson-holliday'
            };

            console.log('🧪 Testing CollectiblesCardDetailService...');
            const result = await this.getCardDetails(testCard.variationId, testCard.slug);
            
            return {
                success: true,
                testCard: testCard,
                result: result
            };

        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = CollectiblesCardDetailService;
