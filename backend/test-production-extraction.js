/**
 * Production Testing Script: Centralized Player Name Extraction System
 * 
 * This script tests the new centralized extraction system on the production database
 * to ensure it works correctly with real data before replacing the old system.
 */

const SimplePlayerExtractor = require('./simple-player-extraction.js');
const { Pool } = require('pg');

// Initialize the new extraction system
const playerExtractor = new SimplePlayerExtractor();

// Database connection (use your Railway database URL)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

/**
 * Test the new extraction system on a sample of production data
 */
async function testProductionExtraction() {
    console.log('🧪 Testing Centralized Player Extraction on Production Database\n');
    
    try {
        // Get a sample of cards from the database
        const sampleQuery = `
            SELECT id, title, player_name 
            FROM cards 
            WHERE title IS NOT NULL 
            ORDER BY RANDOM() 
            LIMIT 20
        `;
        
        const result = await pool.query(sampleQuery);
        const cards = result.rows;
        
        console.log(`📊 Testing ${cards.length} cards from production database\n`);
        
        let successCount = 0;
        let improvementCount = 0;
        let issues = [];
        
        for (const card of cards) {
            console.log(`\n🔍 Testing: "${card.title}"`);
            console.log(`   Current player_name: "${card.player_name}"`);
            
            // Extract player name using new system
            const extractedPlayerName = playerExtractor.extractPlayerName(card.title);
            console.log(`   New extraction: "${extractedPlayerName}"`);
            
            // Analyze results
            if (extractedPlayerName && extractedPlayerName.trim() !== '') {
                successCount++;
                
                // Check if it's an improvement
                if (extractedPlayerName !== card.player_name) {
                    improvementCount++;
                    console.log(`   ✅ IMPROVEMENT: "${card.player_name}" → "${extractedPlayerName}"`);
                } else {
                    console.log(`   ✅ MATCH: "${extractedPlayerName}"`);
                }
            } else {
                issues.push({
                    id: card.id,
                    title: card.title,
                    currentPlayerName: card.player_name,
                    extractedPlayerName: extractedPlayerName,
                    issue: 'Empty extraction result'
                });
                console.log(`   ❌ ISSUE: Empty extraction result`);
            }
        }
        
        // Summary
        console.log('\n' + '='.repeat(60));
        console.log('📊 PRODUCTION TEST RESULTS');
        console.log('='.repeat(60));
        console.log(`Total cards tested: ${cards.length}`);
        console.log(`Successful extractions: ${successCount}`);
        console.log(`Improvements found: ${improvementCount}`);
        console.log(`Issues found: ${issues.length}`);
        
        if (issues.length > 0) {
            console.log('\n❌ ISSUES FOUND:');
            issues.forEach(issue => {
                console.log(`   Card ID ${issue.id}: "${issue.title}"`);
                console.log(`   Current: "${issue.currentPlayerName}"`);
                console.log(`   Extracted: "${issue.extractedPlayerName}"`);
                console.log(`   Issue: ${issue.issue}\n`);
            });
        }
        
        // Success rate
        const successRate = (successCount / cards.length) * 100;
        console.log(`\n🎯 Success Rate: ${successRate.toFixed(1)}%`);
        
        if (successRate >= 95) {
            console.log('✅ EXCELLENT: System ready for production use!');
        } else if (successRate >= 90) {
            console.log('⚠️  GOOD: Minor issues to address before production');
        } else {
            console.log('❌ NEEDS WORK: Significant issues to fix before production');
        }
        
    } catch (error) {
        console.error('❌ Database error:', error.message);
    } finally {
        await pool.end();
    }
}

/**
 * Test specific problematic cases from production
 */
async function testProblematicCases() {
    console.log('\n🔍 Testing Specific Problematic Cases\n');
    
    try {
        // Get cards that might have issues
        const problematicQuery = `
            SELECT id, title, player_name 
            FROM cards 
            WHERE title LIKE '%Malik%' 
               OR title LIKE '%Xavier%' 
               OR title LIKE '%Elly%' 
               OR title LIKE '%Ja%Marr%'
               OR title LIKE '%J.J.%'
            LIMIT 10
        `;
        
        const result = await pool.query(problematicQuery);
        const cards = result.rows;
        
        console.log(`📋 Testing ${cards.length} potentially problematic cards\n`);
        
        for (const card of cards) {
            console.log(`\n🔍 Testing: "${card.title}"`);
            console.log(`   Current: "${card.player_name}"`);
            
            const extractedPlayerName = playerExtractor.extractPlayerName(card.title);
            console.log(`   New: "${extractedPlayerName}"`);
            
            if (extractedPlayerName === card.player_name) {
                console.log(`   ✅ PERFECT MATCH`);
            } else if (extractedPlayerName && extractedPlayerName.trim() !== '') {
                console.log(`   ⚠️  DIFFERENT: "${card.player_name}" → "${extractedPlayerName}"`);
            } else {
                console.log(`   ❌ EMPTY RESULT`);
            }
        }
        
    } catch (error) {
        console.error('❌ Database error:', error.message);
    }
}

/**
 * Compare old vs new extraction on the same data
 */
async function compareExtractionMethods() {
    console.log('\n🔄 Comparing Old vs New Extraction Methods\n');
    
    try {
        // Get a sample of cards
        const sampleQuery = `
            SELECT id, title, player_name 
            FROM cards 
            WHERE title IS NOT NULL 
            ORDER BY RANDOM() 
            LIMIT 10
        `;
        
        const result = await pool.query(sampleQuery);
        const cards = result.rows;
        
        console.log(`📊 Comparing ${cards.length} cards\n`);
        
        let oldBetter = 0;
        let newBetter = 0;
        let same = 0;
        
        for (const card of cards) {
            console.log(`\n🔍 Card: "${card.title}"`);
            console.log(`   Old extraction: "${card.player_name}"`);
            
            const newExtraction = playerExtractor.extractPlayerName(card.title);
            console.log(`   New extraction: "${newExtraction}"`);
            
            // Simple comparison (you might want to add more sophisticated logic)
            if (newExtraction === card.player_name) {
                same++;
                console.log(`   ✅ SAME RESULT`);
            } else if (newExtraction && newExtraction.trim() !== '' && (!card.player_name || card.player_name.trim() === '')) {
                newBetter++;
                console.log(`   🎉 NEW SYSTEM BETTER: Empty → "${newExtraction}"`);
            } else if (card.player_name && card.player_name.trim() !== '' && (!newExtraction || newExtraction.trim() === '')) {
                oldBetter++;
                console.log(`   ⚠️  OLD SYSTEM BETTER: "${card.player_name}" → Empty`);
            } else {
                console.log(`   🔄 DIFFERENT RESULTS`);
            }
        }
        
        console.log('\n' + '='.repeat(50));
        console.log('📊 COMPARISON SUMMARY');
        console.log('='.repeat(50));
        console.log(`Same results: ${same}`);
        console.log(`New system better: ${newBetter}`);
        console.log(`Old system better: ${oldBetter}`);
        
    } catch (error) {
        console.error('❌ Database error:', error.message);
    }
}

// Main execution
async function main() {
    console.log('🚀 Starting Production Database Testing\n');
    
    await testProductionExtraction();
    await testProblematicCases();
    await compareExtractionMethods();
    
    console.log('\n✅ Production testing completed!');
}

// Run if called directly
if (require.main === module) {
    main().catch(console.error);
}

module.exports = {
    testProductionExtraction,
    testProblematicCases,
    compareExtractionMethods
};
