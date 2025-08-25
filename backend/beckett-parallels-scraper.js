const RailwayParallelsDatabase = require('./railway-parallels-db');
const puppeteer = require('puppeteer');

class BeckettParallelsScraper {
    constructor() {
        this.parallelsDb = new RailwayParallelsDatabase();
        this.browser = null;
        this.page = null;
    }

    async initialize() {
        try {
            console.log('🚀 Initializing Beckett parallels scraper...');
            
            // Connect to parallels database
            await this.parallelsDb.connectDatabase();
            
            // Launch browser
            this.browser = await puppeteer.launch({
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-gpu'
                ]
            });
            
            this.page = await this.browser.newPage();
            
            // Set user agent
            await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
            
            console.log('✅ Beckett scraper initialized');
            
        } catch (error) {
            console.error('❌ Error initializing Beckett scraper:', error);
            throw error;
        }
    }

    async scrapeParallelsForCardSet(cardSet) {
        try {
            console.log(`🔍 Scraping parallels for: ${cardSet.set_name}`);
            
            // Construct search query for Beckett
            const searchQuery = this.constructBeckettSearchQuery(cardSet);
            console.log(`🔍 Search query: ${searchQuery}`);
            
            // Navigate to Beckett search page
            const searchUrl = `https://www.beckett.com/search/?term=${encodeURIComponent(searchQuery)}`;
            await this.page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });
            
            // Wait for search results
            await this.page.waitForSelector('.search-results, .no-results', { timeout: 10000 });
            
            // Check if we have results
            const noResults = await this.page.$('.no-results');
            if (noResults) {
                console.log(`⚠️  No results found for: ${cardSet.set_name}`);
                return [];
            }
            
            // Extract parallels from search results
            const parallels = await this.extractParallelsFromPage();
            
            console.log(`✅ Found ${parallels.length} parallels for ${cardSet.set_name}`);
            return parallels;
            
        } catch (error) {
            console.error(`❌ Error scraping parallels for ${cardSet.set_name}:`, error.message);
            return [];
        }
    }

    constructBeckettSearchQuery(cardSet) {
        // Construct a search query that Beckett will understand
        let query = '';
        
        if (cardSet.year && cardSet.year !== 'Unknown') {
            query += `${cardSet.year} `;
        }
        
        if (cardSet.brand && cardSet.brand !== 'Unknown') {
            query += `${cardSet.brand} `;
        }
        
        // Clean up the set name
        let setName = cardSet.set_name;
        if (setName.includes('Unknown')) {
            setName = setName.replace('Unknown', '').trim();
        }
        
        query += setName;
        
        return query.trim();
    }

    async extractParallelsFromPage() {
        try {
            // Look for parallel information in the search results
            const parallels = await this.page.evaluate(() => {
                const parallelElements = document.querySelectorAll('.parallel-name, .variation-name, .card-variant');
                const extractedParallels = [];
                
                parallelElements.forEach(element => {
                    const parallelName = element.textContent.trim();
                    if (parallelName && parallelName.length > 0) {
                        extractedParallels.push({
                            name: parallelName,
                            type: 'Parallel',
                            rarity: 'Standard'
                        });
                    }
                });
                
                return extractedParallels;
            });
            
            return parallels;
            
        } catch (error) {
            console.error('❌ Error extracting parallels from page:', error);
            return [];
        }
    }

    async addParallelsToDatabase(cardSetId, parallels) {
        try {
            for (const parallel of parallels) {
                await this.parallelsDb.addParallel(
                    cardSetId,
                    parallel.name,
                    parallel.type,
                    parallel.rarity,
                    parallel.printRun
                );
            }
            
            console.log(`✅ Added ${parallels.length} parallels to database for card set ID: ${cardSetId}`);
            
        } catch (error) {
            console.error(`❌ Error adding parallels to database:`, error);
        }
    }

    async scrapeAllCardSets() {
        try {
            console.log('🚀 Starting to scrape parallels for all card sets...');
            
            // Get all card sets that don't have parallels yet
            const cardSets = await this.parallelsDb.getAllCardSets();
            const cardSetsWithoutParallels = cardSets.filter(set => 
                parseInt(set.parallel_count || 0) === 0
            );
            
            console.log(`📊 Found ${cardSetsWithoutParallels.length} card sets without parallels`);
            
            let processedCount = 0;
            let successCount = 0;
            
            for (const cardSet of cardSetsWithoutParallels) {
                try {
                    console.log(`\n📋 Processing ${processedCount + 1}/${cardSetsWithoutParallels.length}: ${cardSet.set_name}`);
                    
                    // Scrape parallels for this card set
                    const parallels = await this.scrapeParallelsForCardSet(cardSet);
                    
                    if (parallels.length > 0) {
                        // Add parallels to database
                        await this.addParallelsToDatabase(cardSet.id, parallels);
                        successCount++;
                    }
                    
                    processedCount++;
                    
                    // Add delay to be respectful to Beckett
                    await this.delay(2000);
                    
                } catch (error) {
                    console.error(`❌ Error processing card set ${cardSet.set_name}:`, error);
                    processedCount++;
                }
            }
            
            console.log(`\n✅ Scraping completed!`);
            console.log(`📊 Processed: ${processedCount} card sets`);
            console.log(`✅ Success: ${successCount} card sets with parallels found`);
            
        } catch (error) {
            console.error('❌ Error scraping all card sets:', error);
            throw error;
        }
    }

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async close() {
        try {
            if (this.browser) {
                await this.browser.close();
                console.log('✅ Browser closed');
            }
            
            if (this.parallelsDb) {
                await this.parallelsDb.closeDatabase();
                console.log('✅ Database connection closed');
            }
            
        } catch (error) {
            console.error('❌ Error closing scraper:', error);
        }
    }
}

// Main execution
async function main() {
    const scraper = new BeckettParallelsScraper();
    
    try {
        await scraper.initialize();
        await scraper.scrapeAllCardSets();
        
    } catch (error) {
        console.error('❌ Scraping failed:', error);
        process.exit(1);
    } finally {
        await scraper.close();
    }
}

if (require.main === module) {
    main();
}

module.exports = { BeckettParallelsScraper };
