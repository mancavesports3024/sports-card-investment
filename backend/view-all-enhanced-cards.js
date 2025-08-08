const fs = require('fs');
const path = require('path');

// Load the enhanced database
const databasePath = path.join(__dirname, 'data', 'psa10_recent_90_days_database.json');

try {
    console.log('🔍 Loading enhanced database...');
    const database = JSON.parse(fs.readFileSync(databasePath, 'utf8'));
    const items = database.items || database;
    
    console.log(`\n📊 DATABASE OVERVIEW:`);
    console.log(`Total cards: ${items.length}`);
    
    // Find all cards with any price comparison data
    const enhancedCards = items.filter(card => 
        (card.rawAveragePrice && card.psa9AveragePrice) ||
        (card.rawAveragePrice && card.psa10Price) ||
        (card.psa9AveragePrice && card.psa10Price)
    );
    
    console.log(`Cards with price comparisons: ${enhancedCards.length}`);
    
    // Show all enhanced cards with their data
    console.log(`\n💰 ALL ENHANCED CARDS WITH PRICE DATA:`);
    console.log(`=====================================`);
    
    enhancedCards.forEach((card, index) => {
        console.log(`${index + 1}. ${card.title || 'Unknown Card'}`);
        
        // Show all available price data
        if (card.rawAveragePrice) console.log(`   💰 Raw Average: $${card.rawAveragePrice.toFixed(2)}`);
        if (card.psa9AveragePrice) console.log(`   🏆 PSA 9 Average: $${card.psa9AveragePrice.toFixed(2)}`);
        if (card.psa10Price) console.log(`   💎 PSA 10 Price: $${card.psa10Price.toFixed(2)}`);
        
        // Show percentage differences
        if (card.rawAveragePrice && card.psa9AveragePrice) {
            const rawToPSA9 = ((card.psa9AveragePrice - card.rawAveragePrice) / card.rawAveragePrice * 100);
            console.log(`   📈 Raw → PSA 9: +${rawToPSA9.toFixed(1)}%`);
        }
        
        if (card.rawAveragePrice && card.psa10Price) {
            const rawToPSA10 = ((card.psa10Price - card.rawAveragePrice) / card.rawAveragePrice * 100);
            console.log(`   📈 Raw → PSA 10: +${rawToPSA10.toFixed(1)}%`);
        }
        
        // Show sport if available
        if (card.sport) {
            console.log(`   🏈⚾🏀🏒⚽ Sport: ${card.sport.toUpperCase()}`);
        }
        
        // Show any additional price comparison data
        if (card.psa10vsPsa9Difference) {
            console.log(`   🔄 PSA 10 vs PSA 9: $${card.psa10vsPsa9Difference.toFixed(2)} (${card.psa10vsPsa9Percentage}%)`);
        }
        
        if (card.psa10vsRawDifference) {
            console.log(`   🔄 PSA 10 vs Raw: $${card.psa10vsRawDifference.toFixed(2)} (${card.psa10vsRawPercentage}%)`);
        }
        
        console.log('');
    });
    
    // Show summary statistics
    console.log(`\n📊 SUMMARY STATISTICS:`);
    console.log(`======================`);
    
    const cardsWithRawAndPSA10 = enhancedCards.filter(card => card.rawAveragePrice && card.psa10Price);
    const cardsWithRawAndPSA9 = enhancedCards.filter(card => card.rawAveragePrice && card.psa9AveragePrice);
    
    console.log(`Cards with Raw → PSA 10 data: ${cardsWithRawAndPSA10.length}`);
    console.log(`Cards with Raw → PSA 9 data: ${cardsWithRawAndPSA9.length}`);
    
    if (cardsWithRawAndPSA10.length > 0) {
        const avgRawToPSA10 = cardsWithRawAndPSA10.reduce((sum, card) => {
            const percentage = ((card.psa10Price - card.rawAveragePrice) / card.rawAveragePrice * 100);
            return sum + percentage;
        }, 0) / cardsWithRawAndPSA10.length;
        
        console.log(`Average Raw → PSA 10 increase: +${avgRawToPSA10.toFixed(1)}%`);
    }
    
    if (cardsWithRawAndPSA9.length > 0) {
        const avgRawToPSA9 = cardsWithRawAndPSA9.reduce((sum, card) => {
            const percentage = ((card.psa9AveragePrice - card.rawAveragePrice) / card.rawAveragePrice * 100);
            return sum + percentage;
        }, 0) / cardsWithRawAndPSA9.length;
        
        console.log(`Average Raw → PSA 9 increase: +${avgRawToPSA9.toFixed(1)}%`);
    }
    
    // Show top opportunities
    console.log(`\n🏆 TOP INVESTMENT OPPORTUNITIES:`);
    console.log(`===============================`);
    
    const opportunities = cardsWithRawAndPSA10
        .map(card => {
            const percentage = ((card.psa10Price - card.rawAveragePrice) / card.rawAveragePrice * 100);
            return { card, percentage };
        })
        .sort((a, b) => b.percentage - a.percentage)
        .slice(0, 10);
    
    opportunities.forEach((opp, index) => {
        console.log(`${index + 1}. ${opp.card.title}`);
        console.log(`   Raw: $${opp.card.rawAveragePrice.toFixed(2)} → PSA 10: $${opp.card.psa10Price.toFixed(2)} (+${opp.percentage.toFixed(1)}%)`);
    });
    
    console.log(`\n✅ Enhanced cards analysis complete!`);
    console.log(`📁 Database file: ${databasePath}`);
    
} catch (error) {
    console.error('❌ Error loading database:', error.message);
} 