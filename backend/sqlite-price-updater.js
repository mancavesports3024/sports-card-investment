const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');
const qs = require('qs'); // Add qs for proper form data formatting

// Import the sophisticated filtering system we built
const { 
    ultimateMultiSportFilter, 
    detectSport, 
    getSportExclusions, 
    isBaseParallel, 
    getPSAGrade 
} = require('./ultimate-multi-sport-filtering-system');

class SQLitePriceUpdater {
    constructor() {
        this.dbPath = path.join(__dirname, 'data', 'scorecard.db');
        this.db = null;
        this.lastRequestTime = 0;
        this.MIN_REQUEST_INTERVAL = 2000; // 2 seconds between requests
    }

    async connect() {
        try {
            // Ensure data directory exists
            const dataDir = path.dirname(this.dbPath);
            if (!fs.existsSync(dataDir)) {
                console.log('📁 Creating data directory...');
                fs.mkdirSync(dataDir, { recursive: true });
            }
            
            console.log(`🗄️ Connecting to database at: ${this.dbPath}`);
            
            return new Promise((resolve, reject) => {
                this.db = new sqlite3.Database(this.dbPath, (err) => {
                    if (err) {
                        console.error('❌ Error connecting to database:', err);
                        reject(err);
                    } else {
                        console.log('✅ Connected to SQLite database');
                        resolve();
                    }
                });
            });
        } catch (err) {
            console.error('❌ Error connecting to database:', err);
            throw err;
        }
    }

    async getCardsMissingPrices(limit = 100) {
        try {
            const query = `
                SELECT id, title, summaryTitle, sport, filterInfo
                FROM cards 
                WHERE rawAveragePrice IS NULL OR psa9AveragePrice IS NULL
                LIMIT ?
            `;
            
            return new Promise((resolve, reject) => {
                this.db.all(query, [limit], (err, rows) => {
                    if (err) {
                        console.error('❌ Error fetching cards:', err);
                        reject(err);
                    } else {
                        resolve(rows);
                    }
                });
            });
        } catch (err) {
            console.error('❌ Error fetching cards:', err);
            throw err;
        }
    }

    async updateCardPrices(cardId, priceData) {
        try {
            const query = `
                UPDATE cards 
                SET rawAveragePrice = ?, 
                    psa9AveragePrice = ?, 
                    priceComparisons = ?,
                    lastUpdated = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `;
            
            const priceComparisons = JSON.stringify(priceData);
            const now = new Date().toISOString();
            
            return new Promise((resolve, reject) => {
                this.db.run(query, [
                    priceData.raw?.avgPrice || null,
                    priceData.psa9?.avgPrice || null,
                    priceComparisons,
                    now,
                    cardId
                ], function(err) {
                    if (err) {
                        console.error('❌ Error updating card:', err);
                        reject(err);
                    } else {
                        resolve(this.changes);
                    }
                });
            });
        } catch (err) {
            console.error('❌ Error updating card:', err);
            throw err;
        }
    }

    // Extract card identifier function using summaryTitle and excluding expensive parallels
    extractCardIdentifier(card) {
        // Use the summaryTitle from our database (this is already cleaned)
        let summaryTitle = card.summaryTitle || card.title || '';
        
        // Extract year and player name from summary title
        const yearMatch = summaryTitle.match(/\b(19|20)\d{2}\b/);
        const year = yearMatch ? yearMatch[0] : '';
        
        // Extract player name (usually first capitalized words)
        const playerMatch = summaryTitle.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/);
        const playerName = playerMatch ? playerMatch[1].trim() : '';
        
        // Extract card number
        const numberMatch = summaryTitle.match(/#(\d+)/);
        const cardNumber = numberMatch ? numberMatch[1] : null;
        
        // Create sophisticated search strategies that exclude expensive parallels
        const strategies = [];
        
        // Strategy 1: Use the summary title directly (most specific)
        strategies.push(summaryTitle);
        
        // Strategy 2: Create base search with expensive parallel exclusions
        if (year && playerName) {
            // Define expensive parallels to exclude
            const expensiveParallels = [
                'Choice', 'rr', 'auto', 'Dragon', 'Checkerboard', 'Purple', 'Green', 'pink', 
                'Holo', 'blue', 'shock', 'gold', 'red', 'orange', 'black', '249', 'fast',
                'white sparkle', 'ssp', 'superfractor', '1/1', 'one of one', 'one-of-one',
                'silver', 'bronze', 'platinum', 'diamond', 'emerald', 'ruby', 'sapphire',
                'rainbow', 'atomic', 'galaxy', 'cosmic', 'aurora', 'nebula', 'fast break',
                'velocity', 'prizms', 'concourse', 'premier', 'fotl', 'colossal', 'immortal',
                'legendary', 'color blast', 'stained glass', 'hyper', 'refractor', 'xfractor',
                'neon', 'fluorescent', 'holographic', 'winter', 'lava', 'shimmer'
            ];
            
            // Create exclusion string
            const exclusions = expensiveParallels.map(parallel => `-${parallel}`).join(' ');
            
            // Create base search query
            let baseQuery = `${playerName} ${year}`;
            if (cardNumber) {
                baseQuery += ` #${cardNumber}`;
            }
            
            // Add exclusions
            const searchWithExclusions = `${baseQuery} ${exclusions}`;
            strategies.push(searchWithExclusions);
            
            // Also try without card number
            if (cardNumber) {
                const searchWithoutNumber = `${playerName} ${year} ${exclusions}`;
                strategies.push(searchWithoutNumber);
            }
        }
        
        // Strategy 3: Extract set name and create set-specific searches
        if (year && playerName) {
            // Common set names to try
            const setNames = [
                'Donruss', 'Optic', 'Prizm', 'Topps', 'Panini', 'Fleer', 'Upper Deck', 
                'Score', 'Prestige', 'Contenders', 'Select', 'Chrome', 'Hoops', 'Heritage',
                'Bowman', 'Allen & Ginter', 'Gypsy Queen', 'Stadium Club', 'Archives'
            ];
            
            // Try to detect set from summary title
            let detectedSet = null;
            for (const set of setNames) {
                if (summaryTitle.toLowerCase().includes(set.toLowerCase())) {
                    detectedSet = set;
                    break;
                }
            }
            
            if (detectedSet) {
                // Create set-specific search with exclusions
                const expensiveParallels = [
                    'Choice', 'rr', 'auto', 'Dragon', 'Checkerboard', 'Purple', 'Green', 
                    'pink', 'Holo', 'blue', 'shock', 'gold', 'red', 'orange', 'black', 
                    '249', 'fast', 'white sparkle', 'ssp', 'superfractor', '1/1'
                ];
                const exclusions = expensiveParallels.map(parallel => `-${parallel}`).join(' ');
                
                let setQuery = `${playerName} ${detectedSet} ${year}`;
                if (cardNumber) {
                    setQuery += ` #${cardNumber}`;
                }
                setQuery += ` ${exclusions}`;
                strategies.push(setQuery);
            }
        }
        
        // Strategy 4: Just player and year (broadest search)
        if (playerName && year) {
            strategies.push(`${playerName} ${year}`);
        }
        
        // Strategy 5: Just player name (broadest possible)
        if (playerName && playerName.length > 5) {
            strategies.push(playerName);
        }
        
        // Remove duplicates and limit to 6 strategies
        const uniqueStrategies = [...new Set(strategies)].slice(0, 6);
        
        return { 
            identifier: summaryTitle,
            strategies: uniqueStrategies
        };
    }
    


    async search130Point(cardTitle, isPSA9 = false, strategies = []) {
        try {
            // Rate limiting with random delay
            const now = Date.now();
            const timeSinceLastRequest = now - this.lastRequestTime;
            if (timeSinceLastRequest < this.MIN_REQUEST_INTERVAL) {
                const extraDelay = Math.random() * 3000 + 2000; // 2-5 seconds random delay
                const totalDelay = (this.MIN_REQUEST_INTERVAL - timeSinceLastRequest) + extraDelay;
                console.log(`⏳ Rate limiting: waiting ${Math.round(totalDelay)}ms (base + random)`);
                await new Promise(resolve => setTimeout(resolve, totalDelay));
            }
            this.lastRequestTime = Date.now();

            // Use the sophisticated search strategies we developed
            const searchQueries = strategies.length > 0 ? strategies : [cardTitle];
            
            for (let i = 0; i < searchQueries.length; i++) {
                const baseQuery = searchQueries[i];
                let query;
                
                if (isPSA9) {
                    // For PSA 9 searches, be specific
                    query = `${baseQuery} PSA 9`;
                } else {
                    // For raw searches, use the base query without grading terms
                    // The filtering system will handle the separation
                    query = baseQuery;
                }
                console.log(`🔍 Searching 130point.com for: "${query}" (strategy ${i + 1}/${searchQueries.length})`);
                
                // Format query: replace spaces with + (same as working 130pointService)
                const formattedQuery = query.replace(/\s+/g, '+');
                const formData = qs.stringify({
                    query: formattedQuery,
                    sort: 'EndTimeSoonest',
                    tab_id: 1,
                    tz: 'America/Chicago',
                    width: 721,
                    height: 695,
                    mp: 'all',
                    tk: 'dc848953a13185261a89'
                });
                
                console.log("130point POST URL:", 'https://back.130point.com/cards/');
                console.log("130point POST payload:", formData);
                
                const response = await axios.post('https://back.130point.com/cards/', 
                    formData,
                    {
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                            'Accept-Language': 'en-US,en;q=0.5',
                            'Accept-Encoding': 'gzip, deflate',
                            'Connection': 'keep-alive',
                            'Origin': 'https://130point.com',
                            'Referer': 'https://130point.com/',
                        },
                        timeout: 10000
                    }
                );

                if (!response || response.status !== 200) {
                    console.error(`❌ HTTP ${response?.status}: Failed to fetch 130point data`);
                    return [];
                }

                // Log the first 500 characters of the HTML response for debugging
                console.log('130point HTML response (first 500 chars):', response.data?.slice(0, 500));

                const $ = cheerio.load(response.data);
                const sales = [];

                // Parse currency conversion rates from the HTML
                let currencyRates = {};
                try {
                    const currencyDataText = $('#1-currData').text();
                    if (currencyDataText) {
                        currencyRates = JSON.parse(currencyDataText);
                    }
                } catch (error) {
                    console.log('⚠️ Could not parse currency rates:', error.message);
                }

                // Enhanced sealed product patterns to catch more variations
                const sealedProductPatterns = [
                    /\bhobby\s+box\b/i,
                    /\bhobby\s+case\b/i,
                    /\bjumbo\s+hobby\s+case\b/i,
                    /\bjumbo\s+box\b/i,
                    /\bjumbo\s+pack\b/i,
                    /\bjumbo\b/i,
                    /\bfactory\s+sealed\b/i,
                    /\bsealed\s+box\b/i,
                    /\bsealed\s+pack\b/i,
                    /\bsealed\s+case\b/i,
                    /\bbooster\s+box\b/i,
                    /\bbooster\s+pack\b/i,
                    /\bblaster\s+box\b/i,
                    /\bblaster\s+pack\b/i,
                    /\bfat\s+pack\b/i,
                    /\bretail\s+box\b/i,
                    /\bretail\s+pack\b/i,
                    /\bhanger\s+box\b/i,
                    /\bhanger\s+pack\b/i,
                    /\bvalue\s+pack\b/i,
                    /\bvalue\s+box\b/i,
                    /\bcomplete\s+set\b/i,
                    /\bfactory\s+set\b/i,
                    /\bsealed\s+product\b/i
                ];

                $('#salesDataTable-1 tr#dRow').each((index, el) => {
                    const $el = $(el);
                    try {
                        const price = $el.attr('data-price');
                        const currency = $el.attr('data-currency');
                        const title = $el.find('td#dCol #titleText a').text().trim();
                        const salePrice = $el.find('td#dCol .priceSpan').text().trim();
                        const dateText = $el.find('td#dCol #dateText').text().replace('Date:', '').trim();

                        // Parse the date properly
                        let date = null;
                        if (dateText) {
                            try {
                                const dateMatch = dateText.match(/(\w{3})\s+(\d{1,2})\s+(\w{3})\s+(\d{4})\s+(\d{2}):(\d{2}):(\d{2})\s+(\w{3})/);
                                if (dateMatch) {
                                    const [, dayName, day, month, year, hour, minute, second, timezone] = dateMatch;
                                    const dateString = `${month} ${day}, ${year} ${hour}:${minute}:${second}`;
                                    date = new Date(dateString).toISOString();
                                } else {
                                    date = new Date(dateText).toISOString();
                                }
                            } catch (error) {
                                console.log(`⚠️ Error parsing date "${dateText}":`, error.message);
                                date = new Date().toISOString();
                            }
                        }

                        // Convert price to USD if needed
                        let priceInUSD = parseFloat(price || salePrice.replace(/[^\d.,]/g, '').replace(',', ''));
                        if (currency && currency !== 'USD' && currencyRates[`USD${currency}`]) {
                            const rate = currencyRates[`USD${currency}`].start_rate;
                            priceInUSD = priceInUSD / rate;
                        }

                        // Only process if we have a title and price
                        if (title && salePrice) {
                            const titleLower = title.toLowerCase();
                            
                            // Check if title matches any sealed product pattern
                            const isSealedProduct = sealedProductPatterns.some(pattern => pattern.test(titleLower));
                            
                            // Check for quantity indicators that suggest sealed products
                            const hasQuantityIndicators = /\d+\s*(hobby\s+box|booster\s+box|blaster\s+box|retail\s+box|sealed\s+box|sealed\s+pack|sealed\s+case|lot\s+of|lots\s+of|bundle|complete\s+set|factory\s+set|hobby\s+case|jumbo\s+hobby\s+case)/i.test(titleLower);
                            
                            // Check for high-value items that are clearly sealed products
                            const isHighValueSealed = priceInUSD > 200 && (
                                titleLower.includes('hobby box') || 
                                titleLower.includes('hobby case') ||
                                titleLower.includes('jumbo hobby case') ||
                                titleLower.includes('booster box') || 
                                titleLower.includes('blaster box') || 
                                titleLower.includes('complete set') ||
                                titleLower.includes('factory set') ||
                                titleLower.includes('superbox') ||
                                titleLower.includes('mega box') ||
                                /\d+\s*(box|pack|case)/i.test(titleLower)
                            );
                            
                            // Additional specific checks for the problematic items
                            const hasSpecificSealedTerms = (
                                titleLower.includes('jumbo hobby case') ||
                                titleLower.includes('superbox') ||
                                titleLower.includes('mega box') ||
                                titleLower.includes('celebration mega box') ||
                                titleLower.includes('sealed') && (titleLower.includes('box') || titleLower.includes('case') || titleLower.includes('pack'))
                            );

                            // Use our sophisticated filtering system
                            const cardData = {
                                title: title,
                                price: { value: priceInUSD.toString() },
                                // Add other properties that the filter expects
                                sport: detectSport(title),
                                filterInfo: {
                                    detectedSport: detectSport(title),
                                    isBaseParallel: isBaseParallel(title),
                                    exclusionCount: getSportExclusions(title).length
                                }
                            };
                            
                            // Apply the ultimate multi-sport filter
                            const cardType = isPSA9 ? 'psa9' : 'raw';
                            const shouldInclude = ultimateMultiSportFilter(cardData, cardType);
                            
                            if (shouldInclude) {
                                sales.push({
                                    title,
                                    price: priceInUSD,
                                    date
                                });
                            } else {
                                console.log(`   🚫 Filtered out: ${title} (${cardType})`);
                            }
                        }
                    } catch (error) {
                        console.log(`⚠️ Error parsing sale item:`, error.message);
                    }
                });

                console.log(`✅ Found ${sales.length} sales from 130point.com (strategy ${i + 1})`);
                
                // If we found sales, return them (don't try other strategies)
                if (sales.length > 0) {
                    return sales;
                }
                
                // Small delay between strategies
                if (i < searchQueries.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
            
            console.log(`❌ No sales found after trying ${searchQueries.length} strategies`);
            return [];

        } catch (error) {
            console.error(`❌ 130point search error:`, error.message);
            return [];
        }
    }

    async processCard(card) {
        try {
            const { identifier, strategies } = this.extractCardIdentifier(card);
            
            // Search for raw prices using multiple strategies
            const rawSales = await this.search130Point(identifier, false, strategies);
            
            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));
            
            // Search for PSA 9 prices using multiple strategies
            const psa9Sales = await this.search130Point(identifier, true, strategies);
            
            // Calculate averages
            const rawAvg = rawSales.length > 0 ? 
                rawSales.reduce((sum, sale) => sum + sale.price, 0) / rawSales.length : 0;
            
            const psa9Avg = psa9Sales.length > 0 ? 
                psa9Sales.reduce((sum, sale) => sum + sale.price, 0) / psa9Sales.length : 0;
            
            const priceData = {
                raw: { avgPrice: rawAvg, count: rawSales.length, sales: rawSales },
                psa9: { avgPrice: psa9Avg, count: psa9Sales.length, sales: psa9Sales },
                source: '130point_api'
            };
            
            // Update database
            await this.updateCardPrices(card.id, priceData);
            
            console.log(`   📈 ${card.summaryTitle || card.title}`);
            if (rawAvg > 0) {
                console.log(`      💰 Raw: $${rawAvg.toFixed(2)} (${rawSales.length} cards)`);
            }
            if (psa9Avg > 0) {
                console.log(`      💰 PSA 9: $${psa9Avg.toFixed(2)} (${psa9Sales.length} cards)`);
            }
            
            return priceData;
            
        } catch (error) {
            console.error(`   ❌ Error processing card ${card.id}:`, error.message);
            return null;
        }
    }

    async processBatch(batchSize = 10) {
        console.log(`🚀 Processing ${batchSize} cards with SQLite database...`);
        console.log('==================================================\n');
        
        try {
            await this.connect();
            
            const cards = await this.getCardsMissingPrices(batchSize);
            console.log(`📊 Found ${cards.length} cards missing price data`);
            
            if (cards.length === 0) {
                console.log('🎉 All cards already have price data!');
                return;
            }
            
            let processed = 0;
            let success = 0;
            let errors = 0;
            
            for (const card of cards) {
                try {
                    const result = await this.processCard(card);
                    if (result) {
                        success++;
                    } else {
                        errors++;
                    }
                    processed++;
                    
                    console.log(`📈 Progress: ${processed}/${cards.length} (${Math.round(processed/cards.length*100)}%)`);
                    
                    // Rate limiting between cards
                    if (processed < cards.length) {
                        const delay = 3000 + Math.random() * 2000;
                        console.log(`⏳ Rate limiting: waiting ${Math.round(delay)}ms`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }
                    
                } catch (error) {
                    console.error(`❌ Error processing card ${card.id}:`, error.message);
                    errors++;
                    processed++;
                }
            }
            
            console.log('\n✅ BATCH PROCESSING COMPLETE!');
            console.log('=============================');
            console.log(`📊 Cards processed: ${processed}`);
            console.log(`✅ Successful: ${success}`);
            console.log(`❌ Errors: ${errors}`);
            
            // Show final stats
            const stats = await this.getDatabaseStats();
            console.log(`\n📈 DATABASE STATS:`);
            console.log(`Total cards: ${stats.total}`);
            console.log(`Cards with price data: ${stats.withPrices}`);
            console.log(`Cards missing price data: ${stats.missingPrices}`);
            console.log(`Coverage: ${Math.round(stats.withPrices/stats.total*100)}%`);
            
        } catch (error) {
            console.error('❌ Error during batch processing:', error);
        } finally {
            if (this.db) {
                this.db.close();
            }
        }
    }

    async getDatabaseStats() {
        try {
            const queries = [
                'SELECT COUNT(*) as count FROM cards',
                'SELECT COUNT(*) as count FROM cards WHERE rawAveragePrice IS NOT NULL AND psa9AveragePrice IS NOT NULL',
                'SELECT COUNT(*) as count FROM cards WHERE rawAveragePrice IS NULL OR psa9AveragePrice IS NULL'
            ];
            
            return new Promise((resolve, reject) => {
                Promise.all(queries.map(query => {
                    return new Promise((resolve, reject) => {
                        this.db.get(query, (err, row) => {
                            if (err) reject(err);
                            else resolve(row.count);
                        });
                    });
                })).then(([total, withPrices, missingPrices]) => {
                    resolve({ total, withPrices, missingPrices });
                }).catch(reject);
            });
        } catch (err) {
            console.error('❌ Error getting database stats:', err);
            throw err;
        }
    }
}

// Export for use in other scripts
module.exports = { SQLitePriceUpdater };

// Run if called directly
if (require.main === module) {
    const updater = new SQLitePriceUpdater();
    const batchSize = process.argv[2] ? parseInt(process.argv[2]) : 10;
    updater.processBatch(batchSize);
} 