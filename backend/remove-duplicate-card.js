require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class DuplicateCardRemover {
    constructor() {
        // Use the Railway database path
        this.dbPath = path.join(__dirname, 'data', 'new-scorecard.db');
        this.db = null;
    }

    async connect() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    console.error('❌ Database connection failed:', err.message);
                    reject(err);
                } else {
                    console.log('✅ Connected to SQLite database');
                    resolve();
                }
            });
        });
    }

    async findDuplicateCards() {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT id, title, summary_title, sport, created_at
                FROM cards 
                WHERE title LIKE '%2020-21 Panini Prizm Lamelo Ball #278 Silver Prizm%'
                ORDER BY created_at ASC
            `;
            
            this.db.all(query, [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async removeDuplicateCard(cardId) {
        return new Promise((resolve, reject) => {
            const query = 'DELETE FROM cards WHERE id = ?';
            
            this.db.run(query, [cardId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
        });
    }

    async close() {
        if (this.db) {
            this.db.close();
            console.log('✅ Database connection closed');
        }
    }
}

async function main() {
    const remover = new DuplicateCardRemover();
    
    try {
        await remover.connect();
        
        console.log('🔍 Finding duplicate Lamelo Ball cards...');
        const duplicates = await remover.findDuplicateCards();
        
        if (duplicates.length === 0) {
            console.log('✅ No duplicate Lamelo Ball cards found');
            return;
        }
        
        console.log(`📊 Found ${duplicates.length} Lamelo Ball cards:`);
        duplicates.forEach((card, index) => {
            console.log(`${index + 1}. ID: ${card.id}, Title: ${card.title}, Created: ${card.created_at}`);
        });
        
        if (duplicates.length > 1) {
            // Keep the oldest one (first in the list) and remove the rest
            const cardsToRemove = duplicates.slice(1);
            
            console.log(`🗑️ Removing ${cardsToRemove.length} duplicate(s)...`);
            
            for (const card of cardsToRemove) {
                const changes = await remover.removeDuplicateCard(card.id);
                console.log(`✅ Removed card ID ${card.id} (${changes} row affected)`);
            }
            
            console.log('🎉 Duplicate removal complete!');
        } else {
            console.log('✅ Only one card found - no duplicates to remove');
        }
        
    } catch (error) {
        console.error('❌ Error removing duplicates:', error);
    } finally {
        await remover.close();
    }
}

if (require.main === module) {
    main().then(() => {
        console.log('\n✅ Duplicate removal script complete');
        process.exit(0);
    }).catch(error => {
        console.error('❌ Duplicate removal script failed:', error);
        process.exit(1);
    });
}

module.exports = { DuplicateCardRemover };
