const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class AutoParallelLookup {
    constructor() {
        this.dbPath = path.join(__dirname, 'data', 'new-scorecard.db');
        this.db = null;
    }

    async connectDatabase() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    console.error('❌ Error connecting to database:', err.message);
                    reject(err);
                } else {
                    console.log('✅ Connected to new-scorecard database');
                    resolve();
                }
            });
        });
    }

    async closeDatabase() {
        return new Promise((resolve) => {
            if (this.db) {
                this.db.close((err) => {
                    if (err) {
                        console.error('❌ Error closing database:', err.message);
                    } else {
                        console.log('✅ Database connection closed');
                    }
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }

    async getCardsWithMissingParallels() {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT DISTINCT 
                    c.set_name as cardSet,
                    COUNT(*) as cardCount,
                    COUNT(CASE WHEN c.card_type IS NULL OR c.card_type = '' THEN 1 END) as missingCardTypeCount
                FROM cards c
                WHERE c.set_name IS NOT NULL 
                AND c.set_name != ''
                GROUP BY c.set_name
                HAVING missingCardTypeCount > 0
                ORDER BY cardCount DESC
                LIMIT 10
            `;

            this.db.all(query, [], (err, rows) => {
                if (err) {
                    console.error('❌ Error querying cards with missing parallels:', err.message);
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async getCardSetParallels(cardSet) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT DISTINCT card_type
                FROM cards
                WHERE set_name = ? 
                AND card_type IS NOT NULL 
                AND card_type != ''
                ORDER BY card_type
            `;

            this.db.all(query, [cardSet], (err, rows) => {
                if (err) {
                    console.error('❌ Error querying existing parallels:', err.message);
                    reject(err);
                } else {
                    const parallels = rows.map(row => row.card_type);
                    resolve(parallels);
                }
            });
        });
    }

    async getCardsInSet(cardSet) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT id, title, card_type, summary_title
                FROM cards
                WHERE set_name = ? 
                ORDER BY title
            `;

            this.db.all(query, [cardSet], (err, rows) => {
                if (err) {
                    console.error('❌ Error querying cards in set:', err.message);
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    // Based on the Beckett article, here are the known parallels for 2023 Topps Heritage Baseball
    getKnownParallelsForSet(cardSet) {
        const knownParallels = {
            '2023 Topps Heritage Baseball': [
                'Black Bordered',
                'Flip Stock',
                'Chrome',
                'Chrome Refractor',
                'Chrome Black Refractor',
                'Chrome Purple Refractor',
                'Chrome Green Refractor',
                'Chrome Blue Refractor',
                'Chrome Red Refractor',
                'Chrome Gold Refractor',
                'Chrome Superfractor',
                'Mini',
                'Mini Black',
                'Mini Red',
                'Mini Blue',
                'Mini Green',
                'Mini Purple',
                'Mini Gold',
                'Mini Superfractor',
                'Clubhouse Collection',
                'Clubhouse Collection Relic',
                'Clubhouse Collection Autograph',
                'Real One Autograph',
                'Real One Triple Autograph',
                'Black and White Image Variation',
                'Name-Position Swap Variation'
            ]
        };

        return knownParallels[cardSet] || [];
    }

    async analyzeCardSet(cardSet) {
        try {
            console.log(`\n🔍 Analyzing card set: ${cardSet}`);
            
            // Get existing parallels from database
            const existingParallels = await this.getCardSetParallels(cardSet);
            console.log(`📋 Existing parallels in database: ${existingParallels.length}`);
            
            if (existingParallels.length > 0) {
                console.log('Sample existing parallels:', existingParallels.slice(0, 5).join(', '));
            }
            
            // Get known parallels for this set
            const knownParallels = this.getKnownParallelsForSet(cardSet);
            console.log(`📚 Known parallels for ${cardSet}: ${knownParallels.length}`);
            
            if (knownParallels.length > 0) {
                console.log('Known parallels:', knownParallels.join(', '));
            }
            
            // Find missing parallels
            const missingParallels = knownParallels.filter(parallel => 
                !existingParallels.some(existing => 
                    existing.toLowerCase() === parallel.toLowerCase()
                )
            );
            
            console.log(`🆕 Missing parallels: ${missingParallels.length}`);
            if (missingParallels.length > 0) {
                console.log('Missing parallels:', missingParallels.join(', '));
            }
            
            // Get sample cards from this set
            const cards = await this.getCardsInSet(cardSet);
            console.log(`📄 Total cards in set: ${cards.length}`);
            
            if (cards.length > 0) {
                console.log('Sample cards:');
                cards.slice(0, 5).forEach(card => {
                    console.log(`  - ${card.title} (card_type: ${card.card_type || 'NULL'})`);
                });
            }
            
            return {
                cardSet,
                existingParallels,
                knownParallels,
                missingParallels,
                cardCount: cards.length
            };
            
        } catch (error) {
            console.error(`❌ Error analyzing card set ${cardSet}:`, error.message);
            return { cardSet, error: error.message };
        }
    }

    async autoLookupMissingParallels() {
        try {
            await this.connectDatabase();
            
            console.log('🚀 Starting automatic parallel analysis...\n');
            
            // Get card sets with missing parallels
            const cardSetsWithMissingParallels = await this.getCardsWithMissingParallels();
            
            if (cardSetsWithMissingParallels.length === 0) {
                console.log('✅ No card sets found with missing parallels!');
                return [];
            }
            
            console.log(`📋 Found ${cardSetsWithMissingParallels.length} card sets with missing parallels:`);
            cardSetsWithMissingParallels.forEach(set => {
                console.log(`  - ${set.cardSet}: ${set.missingCardTypeCount} cards missing card types out of ${set.cardCount} total`);
            });
            
            const results = [];
            
            // Analyze each card set
            for (const cardSetInfo of cardSetsWithMissingParallels) {
                const result = await this.analyzeCardSet(cardSetInfo.cardSet);
                results.push(result);
            }
            
            // Summary
            console.log('\n📊 Analysis Summary:');
            console.log('===================');
            
            results.forEach(result => {
                if (result.error) {
                    console.log(`❌ ${result.cardSet}: Error - ${result.error}`);
                } else {
                    console.log(`📊 ${result.cardSet}:`);
                    console.log(`   - Cards: ${result.cardCount}`);
                    console.log(`   - Existing parallels: ${result.existingParallels.length}`);
                    console.log(`   - Known parallels: ${result.knownParallels.length}`);
                    console.log(`   - Missing parallels: ${result.missingParallels.length}`);
                    
                    if (result.missingParallels.length > 0) {
                        console.log(`   - Missing: ${result.missingParallels.slice(0, 3).join(', ')}${result.missingParallels.length > 3 ? '...' : ''}`);
                    }
                }
            });
            
            return results;
            
        } catch (error) {
            console.error('❌ Error in auto lookup:', error.message);
            return [];
        } finally {
            await this.closeDatabase();
        }
    }
}

// Example usage
async function main() {
    const autoLookup = new AutoParallelLookup();
    
    // Run automatic parallel analysis
    await autoLookup.autoLookupMissingParallels();
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = AutoParallelLookup;
