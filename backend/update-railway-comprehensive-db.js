const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class RailwayComprehensiveDatabaseUpdater {
    constructor() {
        // Use the Railway database path
        this.dbPath = path.join(__dirname, 'data', 'comprehensive-card-database.db');
        this.db = null;
    }

    async connect() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, sqlite3.OPEN_READWRITE, (err) => {
                if (err) {
                    console.error('❌ Error connecting to Railway comprehensive database:', err.message);
                    reject(err);
                } else {
                    console.log('✅ Connected to Railway comprehensive database');
                    resolve();
                }
            });
        });
    }

    async updateCardTypes() {
        try {
            console.log('🔄 Adding card types to Railway comprehensive database...');
            
            // Card types mentioned by the user
            const cardTypes = [
                // Panini sets
                { name: 'Draft', searchText: 'draft', displayName: 'Draft', sport: 'Football', setName: 'Draft', source: 'Panini' },
                { name: 'Concourse', searchText: 'concourse', displayName: 'Concourse', sport: 'Football', setName: 'Concourse', source: 'Panini' },
                { name: 'Purple Shock', searchText: 'purple shock', displayName: 'Purple Shock', sport: 'Football', setName: 'Purple Shock', source: 'Panini' },
                { name: 'Sunday', searchText: 'sunday', displayName: 'Sunday', sport: 'Football', setName: 'Sunday', source: 'Panini' },
                { name: 'Preview', searchText: 'preview', displayName: 'Preview', sport: 'Football', setName: 'Preview', source: 'Panini' },
                { name: 'Bowman U', searchText: 'bowman u', displayName: 'Bowman U', sport: 'Baseball', setName: 'Bowman U', source: 'Bowman' },
                { name: 'Chrome Update', searchText: 'chrome update', displayName: 'Chrome Update', sport: 'Baseball', setName: 'Chrome Update', source: 'Topps' },
                { name: 'Lazer', searchText: 'lazer', displayName: 'Lazer', sport: 'Football', setName: 'Lazer', source: 'Panini' },
                { name: 'Portals', searchText: 'portals', displayName: 'Portals', sport: 'Football', setName: 'Portals', source: 'Panini' },
                { name: 'Disco', searchText: 'disco', displayName: 'Disco', sport: 'Football', setName: 'Disco', source: 'Panini' },
                { name: 'Composite', searchText: 'composite', displayName: 'Composite', sport: 'Football', setName: 'Composite', source: 'Panini' },
                
                // Additional popular card types
                { name: 'Prizm', searchText: 'prizm', displayName: 'Prizm', sport: 'Football', setName: 'Prizm', source: 'Panini' },
                { name: 'Select', searchText: 'select', displayName: 'Select', sport: 'Football', setName: 'Select', source: 'Panini' },
                { name: 'Optic', searchText: 'optic', displayName: 'Optic', sport: 'Football', setName: 'Optic', source: 'Donruss' },
                { name: 'Finest', searchText: 'finest', displayName: 'Finest', sport: 'Baseball', setName: 'Finest', source: 'Topps' },
                { name: 'Contenders', searchText: 'contenders', displayName: 'Contenders', sport: 'Football', setName: 'Contenders', source: 'Panini' },
                { name: 'National Treasures', searchText: 'national treasures', displayName: 'National Treasures', sport: 'Football', setName: 'National Treasures', source: 'Panini' },
                { name: 'Flawless', searchText: 'flawless', displayName: 'Flawless', sport: 'Football', setName: 'Flawless', source: 'Panini' },
                { name: 'Immaculate', searchText: 'immaculate', displayName: 'Immaculate', sport: 'Football', setName: 'Immaculate', source: 'Panini' },
                { name: 'Panini One', searchText: 'panini one', displayName: 'Panini One', sport: 'Football', setName: 'Panini One', source: 'Panini' },
                
                // Topps sets
                { name: 'Topps Chrome', searchText: 'topps chrome', displayName: 'Topps Chrome', sport: 'Baseball', setName: 'Chrome', source: 'Topps' },
                { name: 'Topps Finest', searchText: 'topps finest', displayName: 'Topps Finest', sport: 'Baseball', setName: 'Finest', source: 'Topps' },
                { name: 'Topps Heritage', searchText: 'topps heritage', displayName: 'Topps Heritage', sport: 'Baseball', setName: 'Heritage', source: 'Topps' },
                { name: 'Topps Stadium Club', searchText: 'topps stadium club', displayName: 'Topps Stadium Club', sport: 'Baseball', setName: 'Stadium Club', source: 'Topps' },
                { name: 'Topps Allen & Ginter', searchText: 'topps allen & ginter', displayName: 'Topps Allen & GInter', sport: 'Baseball', setName: 'Allen & GInter', source: 'Topps' },
                
                // Donruss sets
                { name: 'Donruss Optic', searchText: 'donruss optic', displayName: 'Donruss Optic', sport: 'Football', setName: 'Optic', source: 'Donruss' },
                { name: 'Donruss Elite', searchText: 'donruss elite', displayName: 'Donruss Elite', sport: 'Football', setName: 'Elite', source: 'Donruss' },
                { name: 'Donruss Rated Rookie', searchText: 'donruss rated rookie', displayName: 'Donruss Rated Rookie', sport: 'Football', setName: 'Rated Rookie', source: 'Donruss' },
                
                // Panini sets
                { name: 'Panini Mosaic', searchText: 'panini mosaic', displayName: 'Panini Mosaic', sport: 'Football', setName: 'Mosaic', source: 'Panini' },
                { name: 'Panini Absolute', searchText: 'panini absolute', displayName: 'Panini Absolute', sport: 'Football', setName: 'Absolute', source: 'Panini' },
                { name: 'Panini Contenders', searchText: 'panini contenders', displayName: 'Panini Contenders', sport: 'Football', setName: 'Contenders', source: 'Panini' },
                { name: 'Panini Prizm', searchText: 'panini prizm', displayName: 'Panini Prizm', sport: 'Football', setName: 'Prizm', source: 'Panini' },
                { name: 'Panini Select', searchText: 'panini select', displayName: 'Panini Select', sport: 'Football', setName: 'Select', source: 'Panini' },
                { name: 'Panini Optic', searchText: 'panini optic', displayName: 'Panini Optic', sport: 'Football', setName: 'Optic', source: 'Panini' },
                { name: 'Panini Donruss', searchText: 'panini donruss', displayName: 'Panini Donruss', sport: 'Football', setName: 'Donruss', source: 'Panini' },
                
                // Basketball sets
                { name: 'Hoops', searchText: 'hoops', displayName: 'Hoops', sport: 'Basketball', setName: 'Hoops', source: 'Hoops' },
                { name: 'SP', searchText: 'sp', displayName: 'SP', sport: 'Basketball', setName: 'SP', source: 'Upper Deck' },
                { name: 'SPX', searchText: 'spx', displayName: 'SPX', sport: 'Basketball', setName: 'SPX', source: 'Upper Deck' },
                { name: 'Exquisite', searchText: 'exquisite', displayName: 'Exquisite', sport: 'Basketball', setName: 'Exquisite', source: 'Upper Deck' },
                { name: 'Ultimate', searchText: 'ultimate', displayName: 'Ultimate', sport: 'Basketball', setName: 'Ultimate', source: 'Upper Deck' },
                { name: 'Reflections', searchText: 'reflections', displayName: 'Reflections', sport: 'Basketball', setName: 'Reflections', source: 'Upper Deck' },
                { name: 'Echelon', searchText: 'echelon', displayName: 'Echelon', sport: 'Basketball', setName: 'Echelon', source: 'Upper Deck' },
                
                // Football sets
                { name: 'Gridiron Gear', searchText: 'gridiron gear', displayName: 'Gridiron Gear', sport: 'Football', setName: 'Gridiron Gear', source: 'Donruss' },
                { name: 'Threads', searchText: 'threads', displayName: 'Threads', sport: 'Football', setName: 'Threads', source: 'Donruss' },
                { name: 'Certified', searchText: 'certified', displayName: 'Certified', sport: 'Football', setName: 'Certified', source: 'Donruss' },
                { name: 'Limited', searchText: 'limited', displayName: 'Limited', sport: 'Football', setName: 'Limited', source: 'Donruss' },
                { name: 'Elite', searchText: 'elite', displayName: 'Elite', sport: 'Football', setName: 'Elite', source: 'Donruss' },
                { name: 'Prestige', searchText: 'prestige', displayName: 'Prestige', sport: 'Football', setName: 'Prestige', source: 'Donruss' },
                { name: 'Score', searchText: 'score', displayName: 'Score', sport: 'Football', setName: 'Score', source: 'Score' },
                
                // Chrome variants
                { name: 'Topps Chrome Sapphire', searchText: 'topps chrome sapphire', displayName: 'Topps Chrome Sapphire', sport: 'Baseball', setName: 'Chrome Sapphire', source: 'Topps' },
                { name: 'Topps Chrome Black', searchText: 'topps chrome black', displayName: 'Topps Chrome Black', sport: 'Baseball', setName: 'Chrome Black', source: 'Topps' },
                { name: 'Topps Chrome Platinum', searchText: 'topps chrome platinum', displayName: 'Topps Chrome Platinum', sport: 'Baseball', setName: 'Chrome Platinum', source: 'Topps' },
                { name: 'Topps Chrome Gold', searchText: 'topps chrome gold', displayName: 'Topps Chrome Gold', sport: 'Baseball', setName: 'Chrome Gold', source: 'Topps' },
                
                // Prizm variants
                { name: 'Panini Prizm Silver', searchText: 'panini prizm silver', displayName: 'Panini Prizm Silver', sport: 'Football', setName: 'Prizm Silver', source: 'Panini' },
                { name: 'Panini Prizm Gold', searchText: 'panini prizm gold', displayName: 'Panini Prizm Gold', sport: 'Football', setName: 'Prizm Gold', source: 'Panini' },
                { name: 'Panini Prizm Black', searchText: 'panini prizm black', displayName: 'Panini Prizm Black', sport: 'Football', setName: 'Prizm Black', source: 'Panini' },
                { name: 'Panini Prizm White', searchText: 'panini prizm white', displayName: 'Panini Prizm White', sport: 'Football', setName: 'Prizm White', source: 'Panini' },
                
                // Optic variants
                { name: 'Donruss Optic Silver', searchText: 'donruss optic silver', displayName: 'Donruss Optic Silver', sport: 'Football', setName: 'Optic Silver', source: 'Donruss' },
                { name: 'Donruss Optic Gold', searchText: 'donruss optic gold', displayName: 'Donruss Optic Gold', sport: 'Football', setName: 'Optic Gold', source: 'Donruss' },
                { name: 'Donruss Optic Black', searchText: 'donruss optic black', displayName: 'Donruss Optic Black', sport: 'Football', setName: 'Optic Black', source: 'Donruss' },
                { name: 'Donruss Optic White', searchText: 'donruss optic white', displayName: 'Donruss Optic White', sport: 'Football', setName: 'Optic White', source: 'Donruss' }
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
            
            console.log(`\n🎉 Railway comprehensive database update complete!`);
            console.log(`✅ Added: ${addedCount} new card types`);
            console.log(`⏭️  Skipped: ${skippedCount} existing card types`);
            
        } catch (error) {
            console.error('❌ Error updating Railway comprehensive database:', error);
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
                INSERT INTO sets (id, name, sport, year, brand, setName, source, searchText, displayName)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            
            const id = `${cardType.source}_${cardType.setName}_${Date.now()}`;
            const params = [
                id,
                cardType.name,
                cardType.sport,
                '2024', // year
                cardType.source,
                cardType.setName,
                cardType.source,
                cardType.searchText,
                cardType.displayName
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

    async close() {
        if (this.db) {
            this.db.close();
        }
    }
}

// Run the Railway comprehensive database update
async function main() {
    const updater = new RailwayComprehensiveDatabaseUpdater();
    
    try {
        await updater.connect();
        await updater.updateCardTypes();
    } catch (error) {
        console.error('❌ Railway comprehensive database update failed:', error);
    } finally {
        await updater.close();
    }
}

if (require.main === module) {
    main().then(() => {
        console.log('\n✅ Railway comprehensive database update script complete');
        process.exit(0);
    }).catch(error => {
        console.error('❌ Railway comprehensive database update script failed:', error);
        process.exit(1);
    });
}

module.exports = { RailwayComprehensiveDatabaseUpdater };
