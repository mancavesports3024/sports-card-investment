const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class CardSetExtractor {
    constructor() {
        // Direct connection to new-scorecard database
        this.pricingDbPath = process.env.RAILWAY_VOLUME_MOUNT_PATH 
            ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'new-scorecard.db')
            : path.join(__dirname, 'data', 'new-scorecard.db');
        this.pricingDb = null;
    }

    async extractData() {
        try {
            console.log('🚀 Extracting card sets from new-scorecard database...');
            
            // Connect to database
            await this.connectToPricingDb();
            
            // Get database stats
            const stats = await this.getDatabaseStats();
            console.log(`📊 Database Stats: ${stats.totalCards} total cards, ${stats.setsWithData} sets with data`);
            
            // Extract unique card sets
            const cardSets = await this.extractCardSets();
            console.log(`📋 Found ${cardSets.length} unique card sets`);
            
            // Display sample data
            this.displaySampleData(cardSets);
            
            // Show breakdown by sport
            this.showSportBreakdown(cardSets);
            
            // Show breakdown by brand
            this.showBrandBreakdown(cardSets);
            
            // Show breakdown by year
            this.showYearBreakdown(cardSets);
            
            console.log('✅ Extraction completed successfully!');
            
        } catch (error) {
            console.error('❌ Extraction failed:', error);
            throw error;
        } finally {
            if (this.pricingDb) {
                this.pricingDb.close();
                console.log('✅ Database connection closed');
            }
        }
    }

    async connectToPricingDb() {
        return new Promise((resolve, reject) => {
            this.pricingDb = new sqlite3.Database(this.pricingDbPath, sqlite3.OPEN_READONLY, (err) => {
                if (err) {
                    console.error('❌ Error connecting to new-scorecard database:', err);
                    reject(err);
                } else {
                    console.log('✅ Connected to new-scorecard database');
                    resolve();
                }
            });
        });
    }

    async getDatabaseStats() {
        return new Promise((resolve, reject) => {
            this.pricingDb.get("SELECT COUNT(*) as count FROM cards", [], (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                this.pricingDb.get(
                    "SELECT COUNT(DISTINCT set_name) as count FROM cards WHERE set_name IS NOT NULL AND set_name != '' AND year IS NOT NULL AND year != ''", 
                    [], 
                    (err, setsRow) => {
                        if (err) {
                            reject(err);
                            return;
                        }
                        
                        resolve({
                            totalCards: row.count,
                            setsWithData: setsRow.count
                        });
                    }
                );
            });
        });
    }

    async extractCardSets() {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT DISTINCT 
                    set_name as setName,
                    year,
                    brand,
                    sport
                FROM cards 
                WHERE set_name IS NOT NULL 
                AND set_name != ''
                AND year IS NOT NULL
                AND year != ''
                ORDER BY set_name, year
            `;
            
            this.pricingDb.all(query, [], (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                // Process and enhance the data
                const processedSets = rows.map(row => {
                    const setName = row.setName || '';
                    const year = row.year || '';
                    const brand = row.brand || '';
                    const sport = row.sport || this.detectSport(setName, brand);
                    
                    return {
                        name: this.generateSetName(setName, year, brand),
                        sport: sport,
                        year: year,
                        brand: brand,
                        setName: setName,
                        originalData: row
                    };
                });
                
                // Remove duplicates based on name
                const uniqueSets = this.removeDuplicates(processedSets);
                resolve(uniqueSets);
            });
        });
    }

    detectSport(setName, brand) {
        const name = (setName + ' ' + brand).toLowerCase();
        
        if (name.includes('football') || name.includes('nfl')) return 'Football';
        if (name.includes('basketball') || name.includes('nba')) return 'Basketball';
        if (name.includes('baseball') || name.includes('mlb')) return 'Baseball';
        if (name.includes('hockey') || name.includes('nhl')) return 'Hockey';
        if (name.includes('soccer') || name.includes('fifa')) return 'Soccer';
        if (name.includes('pokemon')) return 'Pokemon';
        if (name.includes('magic') || name.includes('mtg')) return 'Magic: The Gathering';
        if (name.includes('yugioh') || name.includes('yu-gi-oh')) return 'Yu-Gi-Oh!';
        
        return null;
    }

    generateSetName(setName, year, brand) {
        if (!setName) return '';
        
        let name = setName.trim();
        if (year && !name.includes(year)) {
            name = `${year} ${name}`;
        }
        if (brand && !name.toLowerCase().includes(brand.toLowerCase())) {
            name = `${brand} ${name}`;
        }
        
        return name;
    }

    removeDuplicates(sets) {
        const seen = new Set();
        return sets.filter(set => {
            const key = set.name.toLowerCase();
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    }

    displaySampleData(cardSets) {
        console.log('\n📝 Sample Card Sets (first 20):');
        console.log('================================');
        
        cardSets.slice(0, 20).forEach((set, index) => {
            console.log(`${index + 1}. ${set.name}`);
            console.log(`   Sport: ${set.sport || 'Unknown'}`);
            console.log(`   Year: ${set.year}`);
            console.log(`   Brand: ${set.brand || 'Unknown'}`);
            console.log(`   Original Set: ${set.setName}`);
            console.log('');
        });
        
        if (cardSets.length > 20) {
            console.log(`... and ${cardSets.length - 20} more sets`);
        }
    }

    showSportBreakdown(cardSets) {
        console.log('\n🏈 Sport Breakdown:');
        console.log('==================');
        
        const sportCounts = {};
        cardSets.forEach(set => {
            const sport = set.sport || 'Unknown';
            sportCounts[sport] = (sportCounts[sport] || 0) + 1;
        });
        
        Object.entries(sportCounts)
            .sort(([,a], [,b]) => b - a)
            .forEach(([sport, count]) => {
                console.log(`${sport}: ${count} sets`);
            });
    }

    showBrandBreakdown(cardSets) {
        console.log('\n🏷️  Brand Breakdown:');
        console.log('==================');
        
        const brandCounts = {};
        cardSets.forEach(set => {
            const brand = set.brand || 'Unknown';
            brandCounts[brand] = (brandCounts[brand] || 0) + 1;
        });
        
        Object.entries(brandCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 15) // Show top 15 brands
            .forEach(([brand, count]) => {
                console.log(`${brand}: ${count} sets`);
            });
    }

    showYearBreakdown(cardSets) {
        console.log('\n📅 Year Breakdown:');
        console.log('=================');
        
        const yearCounts = {};
        cardSets.forEach(set => {
            const year = set.year || 'Unknown';
            yearCounts[year] = (yearCounts[year] || 0) + 1;
        });
        
        Object.entries(yearCounts)
            .sort(([a], [b]) => b - a) // Sort by year descending
            .slice(0, 15) // Show top 15 years
            .forEach(([year, count]) => {
                console.log(`${year}: ${count} sets`);
            });
    }
}

// Main execution
async function main() {
    const extractor = new CardSetExtractor();
    
    try {
        await extractor.extractData();
    } catch (error) {
        console.error('❌ Extraction failed:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { CardSetExtractor };
