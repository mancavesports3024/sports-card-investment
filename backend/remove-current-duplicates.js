#!/usr/bin/env node

/**
 * Remove Current Duplicates Script
 * 
 * This script identifies and removes duplicate cards from the database
 * based on smart card identity matching (player name + card number + year)
 */

const NewPricingDatabase = require('./create-new-pricing-database.js');

class DuplicateRemover {
    constructor() {
        this.db = new NewPricingDatabase();
    }

    async connect() {
        await this.db.connect();
    }

    async close() {
        if (this.db) {
            await this.db.close();
        }
    }

    // Extract card identity for comparison
    extractCardIdentity(card) {
        return {
            playerName: card.player_name?.toLowerCase().trim() || '',
            cardNumber: card.card_number?.toLowerCase().trim() || '',
            year: card.year || '',
            cardSet: card.card_set?.toLowerCase().trim() || '',
            cardType: card.card_type?.toLowerCase().trim() || ''
        };
    }

    // Find duplicate groups
    async findDuplicates() {
        console.log('🔍 Finding duplicate cards...');
        
        const allCards = await this.db.allQuery(`
            SELECT id, title, player_name, card_number, year, card_set, card_type, 
                   psa10_price, psa9_average_price, raw_average_price, created_at
            FROM cards 
            WHERE player_name IS NOT NULL AND card_number IS NOT NULL AND year IS NOT NULL
            ORDER BY player_name, card_number, year, created_at
        `);

        const duplicateGroups = new Map();
        
        for (const card of allCards) {
            const identity = this.extractCardIdentity(card);
            const key = `${identity.playerName}|${identity.cardNumber}|${identity.year}`;
            
            if (!duplicateGroups.has(key)) {
                duplicateGroups.set(key, []);
            }
            duplicateGroups.get(key).push(card);
        }

        // Filter to only groups with duplicates
        const actualDuplicates = new Map();
        for (const [key, cards] of duplicateGroups) {
            if (cards.length > 1) {
                actualDuplicates.set(key, cards);
            }
        }

        console.log(`📊 Found ${actualDuplicates.size} duplicate groups affecting ${Array.from(actualDuplicates.values()).reduce((sum, group) => sum + group.length, 0)} cards`);
        
        return actualDuplicates;
    }

    // Merge duplicate cards (keep best data, remove others)
    async mergeDuplicates(duplicateGroups) {
        let removedCount = 0;
        let keptCount = 0;

        for (const [key, cards] of duplicateGroups) {
            console.log(`\n🔄 Processing duplicate group: ${key}`);
            console.log(`   ${cards.length} duplicates found:`);
            
            cards.forEach((card, index) => {
                console.log(`   ${index + 1}. ID:${card.id} - "${card.title}" ($${card.psa10_price || 'N/A'})`);
            });

            // Sort by best data quality (prioritize cards with more complete data)
            const sortedCards = cards.sort((a, b) => {
                // Prioritize cards with pricing data
                const aScore = (a.psa10_price || 0) + (a.psa9_average_price || 0) + (a.raw_average_price || 0);
                const bScore = (b.psa10_price || 0) + (b.psa9_average_price || 0) + (b.raw_average_price || 0);
                
                if (aScore !== bScore) return bScore - aScore;
                
                // If same pricing, prioritize older entries (first found)
                return new Date(a.created_at) - new Date(b.created_at);
            });

            // Keep the best card, remove the rest
            const keepCard = sortedCards[0];
            const removeCards = sortedCards.slice(1);

            console.log(`   ✅ Keeping: ID:${keepCard.id} - "${keepCard.title}"`);
            keptCount++;

            for (const removeCard of removeCards) {
                console.log(`   ❌ Removing: ID:${removeCard.id} - "${removeCard.title}"`);
                
                try {
                    await this.db.runQuery('DELETE FROM cards WHERE id = ?', [removeCard.id]);
                    removedCount++;
                } catch (error) {
                    console.error(`   💥 Error removing card ID:${removeCard.id}:`, error.message);
                }
            }
        }

        console.log(`\n📊 Duplicate removal summary:`);
        console.log(`   ✅ Cards kept: ${keptCount}`);
        console.log(`   ❌ Cards removed: ${removedCount}`);
        
        return { keptCount, removedCount };
    }

    // Main execution function
    async removeDuplicates() {
        console.log('🚀 Starting duplicate removal process...\n');
        
        try {
            await this.connect();
            
            const duplicateGroups = await this.findDuplicates();
            
            if (duplicateGroups.size === 0) {
                console.log('✨ No duplicates found! Database is clean.');
                return { success: true, keptCount: 0, removedCount: 0 };
            }

            const result = await this.mergeDuplicates(duplicateGroups);
            
            await this.close();
            
            console.log('\n🎉 Duplicate removal completed successfully!');
            return { success: true, ...result };
            
        } catch (error) {
            console.error('❌ Error during duplicate removal:', error);
            await this.close();
            return { success: false, error: error.message };
        }
    }
}

// Run if called directly
if (require.main === module) {
    async function main() {
        const remover = new DuplicateRemover();
        const result = await remover.removeDuplicates();
        
        if (result.success) {
            console.log(`\n✅ Successfully removed ${result.removedCount} duplicate cards, kept ${result.keptCount} unique cards`);
            process.exit(0);
        } else {
            console.error(`\n❌ Failed to remove duplicates: ${result.error}`);
            process.exit(1);
        }
    }
    
    main().catch(error => {
        console.error('💥 Unexpected error:', error);
        process.exit(1);
    });
}

module.exports = DuplicateRemover;
