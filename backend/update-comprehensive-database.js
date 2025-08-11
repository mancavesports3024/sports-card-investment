const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class ComprehensiveDatabaseUpdater {
    constructor() {
        this.dbPath = path.join(__dirname, 'data', 'comprehensive-card-database.db');
        this.db = null;
    }

    async connect() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, sqlite3.OPEN_READWRITE, (err) => {
                if (err) {
                    console.error('❌ Error connecting to comprehensive database:', err.message);
                    reject(err);
                } else {
                    console.log('✅ Connected to comprehensive database');
                    resolve();
                }
            });
        });
    }

    async updateCardTypes() {
        try {
            console.log('🔄 Adding card types to comprehensive database...');
            
            // Card types mentioned by the user
            const cardTypes = [
                // Panini sets
                { name: 'Draft', searchText: 'draft', displayName: 'Draft', sport: 'Football' },
                { name: 'Concourse', searchText: 'concourse', displayName: 'Concourse', sport: 'Football' },
                { name: 'Purple Shock', searchText: 'purple shock', displayName: 'Purple Shock', sport: 'Football' },
                { name: 'Sunday', searchText: 'sunday', displayName: 'Sunday', sport: 'Football' },
                { name: 'Preview', searchText: 'preview', displayName: 'Preview', sport: 'Football' },
                { name: 'Bowman U', searchText: 'bowman u', displayName: 'Bowman U', sport: 'Baseball' },
                { name: 'Chrome Update', searchText: 'chrome update', displayName: 'Chrome Update', sport: 'Baseball' },
                { name: 'Lazer', searchText: 'lazer', displayName: 'Lazer', sport: 'Football' },
                { name: 'Portals', searchText: 'portals', displayName: 'Portals', sport: 'Football' },
                { name: 'Disco', searchText: 'disco', displayName: 'Disco', sport: 'Football' },
                { name: 'Composite', searchText: 'composite', displayName: 'Composite', sport: 'Football' },
                
                // Additional popular card types
                { name: 'Prizm', searchText: 'prizm', displayName: 'Prizm', sport: 'Football' },
                { name: 'Select', searchText: 'select', displayName: 'Select', sport: 'Football' },
                { name: 'Optic', searchText: 'optic', displayName: 'Optic', sport: 'Football' },
                { name: 'Finest', searchText: 'finest', displayName: 'Finest', sport: 'Baseball' },
                { name: 'Contenders', searchText: 'contenders', displayName: 'Contenders', sport: 'Football' },
                { name: 'National Treasures', searchText: 'national treasures', displayName: 'National Treasures', sport: 'Football' },
                { name: 'Flawless', searchText: 'flawless', displayName: 'Flawless', sport: 'Football' },
                { name: 'Immaculate', searchText: 'immaculate', displayName: 'Immaculate', sport: 'Football' },
                { name: 'Panini One', searchText: 'panini one', displayName: 'Panini One', sport: 'Football' },
                
                // Topps sets
                { name: 'Topps Chrome', searchText: 'topps chrome', displayName: 'Topps Chrome', sport: 'Baseball' },
                { name: 'Topps Finest', searchText: 'topps finest', displayName: 'Topps Finest', sport: 'Baseball' },
                { name: 'Topps Heritage', searchText: 'topps heritage', displayName: 'Topps Heritage', sport: 'Baseball' },
                { name: 'Topps Stadium Club', searchText: 'topps stadium club', displayName: 'Topps Stadium Club', sport: 'Baseball' },
                { name: 'Topps Allen & Ginter', searchText: 'topps allen & ginter', displayName: 'Topps Allen & Ginter', sport: 'Baseball' },
                
                // Donruss sets
                { name: 'Donruss Optic', searchText: 'donruss optic', displayName: 'Donruss Optic', sport: 'Football' },
                { name: 'Donruss Elite', searchText: 'donruss elite', displayName: 'Donruss Elite', sport: 'Football' },
                { name: 'Donruss Rated Rookie', searchText: 'donruss rated rookie', displayName: 'Donruss Rated Rookie', sport: 'Football' },
                
                // Panini sets
                { name: 'Panini Mosaic', searchText: 'panini mosaic', displayName: 'Panini Mosaic', sport: 'Football' },
                { name: 'Panini Absolute', searchText: 'panini absolute', displayName: 'Panini Absolute', sport: 'Football' },
                { name: 'Panini Contenders', searchText: 'panini contenders', displayName: 'Panini Contenders', sport: 'Football' },
                { name: 'Panini Prizm', searchText: 'panini prizm', displayName: 'Panini Prizm', sport: 'Football' },
                { name: 'Panini Select', searchText: 'panini select', displayName: 'Panini Select', sport: 'Football' },
                { name: 'Panini Optic', searchText: 'panini optic', displayName: 'Panini Optic', sport: 'Football' },
                { name: 'Panini Donruss', searchText: 'panini donruss', displayName: 'Panini Donruss', sport: 'Football' },
                
                // Basketball sets
                { name: 'Hoops', searchText: 'hoops', displayName: 'Hoops', sport: 'Basketball' },
                { name: 'SP', searchText: 'sp', displayName: 'SP', sport: 'Basketball' },
                { name: 'SPX', searchText: 'spx', displayName: 'SPX', sport: 'Basketball' },
                { name: 'Exquisite', searchText: 'exquisite', displayName: 'Exquisite', sport: 'Basketball' },
                { name: 'Ultimate', searchText: 'ultimate', displayName: 'Ultimate', sport: 'Basketball' },
                { name: 'Reflections', searchText: 'reflections', displayName: 'Reflections', sport: 'Basketball' },
                { name: 'Echelon', searchText: 'echelon', displayName: 'Echelon', sport: 'Basketball' },
                
                // Football sets
                { name: 'Gridiron Gear', searchText: 'gridiron gear', displayName: 'Gridiron Gear', sport: 'Football' },
                { name: 'Threads', searchText: 'threads', displayName: 'Threads', sport: 'Football' },
                { name: 'Certified', searchText: 'certified', displayName: 'Certified', sport: 'Football' },
                { name: 'Limited', searchText: 'limited', displayName: 'Limited', sport: 'Football' },
                { name: 'Elite', searchText: 'elite', displayName: 'Elite', sport: 'Football' },
                { name: 'Prestige', searchText: 'prestige', displayName: 'Prestige', sport: 'Football' },
                { name: 'Score', searchText: 'score', displayName: 'Score', sport: 'Football' },
                
                // Chrome variants
                { name: 'Topps Chrome Sapphire', searchText: 'topps chrome sapphire', displayName: 'Topps Chrome Sapphire', sport: 'Baseball' },
                { name: 'Topps Chrome Black', searchText: 'topps chrome black', displayName: 'Topps Chrome Black', sport: 'Baseball' },
                { name: 'Topps Chrome Platinum', searchText: 'topps chrome platinum', displayName: 'Topps Chrome Platinum', sport: 'Baseball' },
                { name: 'Topps Chrome Gold', searchText: 'topps chrome gold', displayName: 'Topps Chrome Gold', sport: 'Baseball' },
                
                // Prizm variants
                { name: 'Panini Prizm Silver', searchText: 'panini prizm silver', displayName: 'Panini Prizm Silver', sport: 'Football' },
                { name: 'Panini Prizm Gold', searchText: 'panini prizm gold', displayName: 'Panini Prizm Gold', sport: 'Football' },
                { name: 'Panini Prizm Black', searchText: 'panini prizm black', displayName: 'Panini Prizm Black', sport: 'Football' },
                { name: 'Panini Prizm White', searchText: 'panini prizm white', displayName: 'Panini Prizm White', sport: 'Football' },
                
                // Optic variants
                { name: 'Donruss Optic Silver', searchText: 'donruss optic silver', displayName: 'Donruss Optic Silver', sport: 'Football' },
                { name: 'Donruss Optic Gold', searchText: 'donruss optic gold', displayName: 'Donruss Optic Gold', sport: 'Football' },
                { name: 'Donruss Optic Black', searchText: 'donruss optic black', displayName: 'Donruss Optic Black', sport: 'Football' },
                { name: 'Donruss Optic White', searchText: 'donruss optic white', displayName: 'Donruss Optic White', sport: 'Football' }
            ];
            
            let addedCount = 0;
            let skippedCount = 0;
            
            for (const cardType of cardTypes) {
                try {
                    const exists = await this.checkIfExists(cardType.searchText);
                    
                    if (!exists) {
                        await this.addCardType(cardType);
                        addedCount++;
                        console.log(`✅ Added: ${cardType.name} (${cardType.sport})`);
                    } else {
                        skippedCount++;
                        console.log(`⏭️  Skipped: ${cardType.name} (already exists)`);
                    }
                } catch (error) {
                    console.error(`❌ Error adding ${cardType.name}:`, error.message);
                }
            }
            
            console.log(`\n🎉 Comprehensive database update complete!`);
            console.log(`✅ Added: ${addedCount} new card types`);
            console.log(`⏭️  Skipped: ${skippedCount} existing card types`);
            
        } catch (error) {
            console.error('❌ Error updating comprehensive database:', error);
        }
    }

    async checkIfExists(searchText) {
        return new Promise((resolve, reject) => {
            const query = `SELECT COUNT(*) as count FROM sets WHERE LOWER(searchText) = LOWER(?)`;
            
            this.db.get(query, [searchText], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row.count > 0);
                }
            });
        });
    }

    async addCardType(cardType) {
        return new Promise((resolve, reject) => {
            const query = `
                INSERT INTO sets (name, searchText, displayName, sport, year, brand, category)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `;
            
            const params = [
                cardType.name,
                cardType.searchText,
                cardType.displayName,
                cardType.sport,
                null, // year
                this.getBrandFromName(cardType.name),
                'Card Set'
            ];
            
            this.db.run(query, params, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    getBrandFromName(name) {
        if (name.toLowerCase().includes('topps')) return 'Topps';
        if (name.toLowerCase().includes('panini')) return 'Panini';
        if (name.toLowerCase().includes('donruss')) return 'Donruss';
        if (name.toLowerCase().includes('bowman')) return 'Bowman';
        if (name.toLowerCase().includes('upper deck')) return 'Upper Deck';
        if (name.toLowerCase().includes('fleer')) return 'Fleer';
        if (name.toLowerCase().includes('score')) return 'Score';
        if (name.toLowerCase().includes('pinnacle')) return 'Pinnacle';
        if (name.toLowerCase().includes('leaf')) return 'Leaf';
        if (name.toLowerCase().includes('skybox')) return 'Skybox';
        if (name.toLowerCase().includes('hoops')) return 'Hoops';
        if (name.toLowerCase().includes('sp')) return 'SP';
        if (name.toLowerCase().includes('exquisite')) return 'Exquisite';
        if (name.toLowerCase().includes('ultimate')) return 'Ultimate';
        if (name.toLowerCase().includes('reflections')) return 'Reflections';
        if (name.toLowerCase().includes('echelon')) return 'Echelon';
        if (name.toLowerCase().includes('gridiron')) return 'Gridiron';
        if (name.toLowerCase().includes('threads')) return 'Threads';
        if (name.toLowerCase().includes('certified')) return 'Certified';
        if (name.toLowerCase().includes('limited')) return 'Limited';
        if (name.toLowerCase().includes('elite')) return 'Elite';
        if (name.toLowerCase().includes('prestige')) return 'Prestige';
        return 'Unknown';
    }

    async close() {
        if (this.db) {
            this.db.close();
        }
    }
}

// Run the comprehensive database update
async function main() {
    const updater = new ComprehensiveDatabaseUpdater();
    
    try {
        await updater.connect();
        await updater.updateCardTypes();
    } catch (error) {
        console.error('❌ Comprehensive database update failed:', error);
    } finally {
        await updater.close();
    }
}

if (require.main === module) {
    main().then(() => {
        console.log('\n✅ Comprehensive database update script complete');
        process.exit(0);
    }).catch(error => {
        console.error('❌ Comprehensive database update script failed:', error);
        process.exit(1);
    });
}

module.exports = { ComprehensiveDatabaseUpdater };
