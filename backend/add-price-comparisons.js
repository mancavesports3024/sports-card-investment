require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { search130point } = require('./services/130pointService');

// Database files
const DATABASE_FILE = path.join(__dirname, 'data', 'psa10_recent_90_days_database.json');
const BACKUP_DIR = path.join(__dirname, 'data', 'backups');

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// Create backup of current database
function createBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(BACKUP_DIR, `psa10_database_backup_${timestamp}.json`);
    
    try {
        fs.copyFileSync(DATABASE_FILE, backupFile);
        console.log(`💾 Backup created: ${backupFile}`);
        return backupFile;
    } catch (error) {
        console.error('❌ Error creating backup:', error.message);
        return null;
    }
}

// Load existing database
function loadDatabase() {
    try {
        const data = fs.readFileSync(DATABASE_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('❌ Error loading database:', error.message);
        return null;
    }
}

// Save database
function saveDatabase(data) {
    try {
        data.metadata.lastUpdated = new Date().toISOString();
        data.metadata.totalItems = data.items.length;
        fs.writeFileSync(DATABASE_FILE, JSON.stringify(data, null, 2));
        console.log(`✅ Database saved: ${data.items.length} items`);
    } catch (error) {
        console.error('❌ Error saving database:', error.message);
    }
}

// Extract card title for searching
function extractCardTitle(item) {
    let title = item.summaryTitle || item.title || '';
    
    // Remove PSA 10 references for searching raw and PSA 9
    title = title.replace(/PSA\s*10/gi, '');
    title = title.replace(/GEM\s*MT/gi, '');
    title = title.replace(/GEM\s*MINT/gi, '');
    title = title.replace(/GRADED/gi, '');
    
    // Clean up extra spaces
    title = title.replace(/\s+/g, ' ').trim();
    
    return title;
}

// Search for raw and PSA 9 prices
async function searchPriceComparisons(card, limit = 20) {
    const cardTitle = extractCardTitle(card);
    
    try {
        console.log(`\n🔍 Searching for: "${cardTitle}"`);
        
        // Search for raw cards
        const rawQuery = `${cardTitle}`;
        const rawResults = await search130point(rawQuery, limit);
        
        // Search for PSA 9 cards
        const psa9Query = `${cardTitle} PSA 9`;
        const psa9Results = await search130point(psa9Query, limit);
        
        // Filter and categorize results
        const rawCards = [];
        const psa9Cards = [];
        
        // Process raw results
        if (rawResults && rawResults.length > 0) {
            rawResults.forEach(result => {
                const title = result.title?.toLowerCase() || '';
                const condition = result.condition?.toLowerCase() || '';
                
                // Filter out graded cards from raw search
                if (!title.includes('psa') && !title.includes('bgs') && !title.includes('cgc') && 
                    !title.includes('graded') && !title.includes('gem') && !condition.includes('graded')) {
                    rawCards.push({
                        title: result.title,
                        price: result.price,
                        soldDate: result.soldDate,
                        condition: result.condition,
                        source: '130point'
                    });
                }
            });
        }
        
        // Process PSA 9 results
        if (psa9Results && psa9Results.length > 0) {
            psa9Results.forEach(result => {
                const title = result.title?.toLowerCase() || '';
                const condition = result.condition?.toLowerCase() || '';
                
                // Filter for PSA 9 cards
                if (title.includes('psa 9') || condition.includes('psa 9')) {
                    psa9Cards.push({
                        title: result.title,
                        price: result.price,
                        soldDate: result.soldDate,
                        condition: result.condition,
                        source: '130point'
                    });
                }
            });
        }
        
        // Calculate averages
        const rawAvg = rawCards.length > 0 ? 
            rawCards.reduce((sum, card) => sum + parseFloat(card.price?.value || 0), 0) / rawCards.length : 0;
        
        const psa9Avg = psa9Cards.length > 0 ? 
            psa9Cards.reduce((sum, card) => sum + parseFloat(card.price?.value || 0), 0) / psa9Cards.length : 0;
        
        const psa10Price = parseFloat(card.price?.value || 0);
        
        // Calculate price differences
        const rawToPsa9Diff = psa9Avg > 0 && rawAvg > 0 ? psa9Avg - rawAvg : 0;
        const rawToPsa9Percent = rawAvg > 0 ? (rawToPsa9Diff / rawAvg) * 100 : 0;
        
        const rawToPsa10Diff = psa10Price > 0 && rawAvg > 0 ? psa10Price - rawAvg : 0;
        const rawToPsa10Percent = rawAvg > 0 ? (rawToPsa10Diff / rawAvg) * 100 : 0;
        
        const psa9ToPsa10Diff = psa10Price > 0 && psa9Avg > 0 ? psa10Price - psa9Avg : 0;
        const psa9ToPsa10Percent = psa9Avg > 0 ? (psa9ToPsa10Diff / psa9Avg) * 100 : 0;
        
        return {
            cardTitle: cardTitle,
            raw: {
                count: rawCards.length,
                avgPrice: rawAvg,
                cards: rawCards
            },
            psa9: {
                count: psa9Cards.length,
                avgPrice: psa9Avg,
                cards: psa9Cards
            },
            psa10: {
                price: psa10Price
            },
            comparisons: {
                rawToPsa9: {
                    dollarDiff: rawToPsa9Diff,
                    percentDiff: rawToPsa9Percent
                },
                rawToPsa10: {
                    dollarDiff: rawToPsa10Diff,
                    percentDiff: rawToPsa10Percent
                },
                psa9ToPsa10: {
                    dollarDiff: psa9ToPsa10Diff,
                    percentDiff: psa9ToPsa10Percent
                }
            }
        };
        
    } catch (error) {
        console.error(`   ❌ Error searching for ${cardTitle}:`, error.message);
        return null;
    }
}

// Add price comparisons to database
async function addPriceComparisons(limit = 100) {
    console.log('🔄 Adding Price Comparisons (Raw & PSA 9) to Database');
    console.log('=====================================================\n');
    
    // Create backup
    createBackup();
    
    // Load database
    const database = loadDatabase();
    if (!database || !database.items) {
        console.error('❌ Invalid database structure');
        return;
    }
    
    console.log(`📊 Current database: ${database.items.length} items`);
    
    // Get cards that don't have price comparisons yet
    const cardsToProcess = database.items
        .filter(item => !item.priceComparisons)
        .slice(0, limit);
    
    console.log(`🎯 Processing ${cardsToProcess.length} cards for price comparisons...\n`);
    
    let processedCount = 0;
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < cardsToProcess.length; i++) {
        const card = cardsToProcess[i];
        
        try {
            console.log(`📈 Card ${i + 1}/${cardsToProcess.length}: ${card.summaryTitle || card.title}`);
            
            const priceData = await searchPriceComparisons(card);
            
            if (priceData) {
                // Add price comparison data to card
                card.priceComparisons = {
                    raw: priceData.raw,
                    psa9: priceData.psa9,
                    comparisons: priceData.comparisons,
                    lastUpdated: new Date().toISOString()
                };
                
                // Log results
                if (priceData.raw.avgPrice > 0) {
                    console.log(`   💰 Raw Avg: $${priceData.raw.avgPrice.toFixed(2)} (${priceData.raw.count} cards)`);
                }
                if (priceData.psa9.avgPrice > 0) {
                    console.log(`   💰 PSA 9 Avg: $${priceData.psa9.avgPrice.toFixed(2)} (${priceData.psa9.count} cards)`);
                }
                if (priceData.psa10.price > 0) {
                    console.log(`   💰 PSA 10 Price: $${priceData.psa10.price.toFixed(2)}`);
                }
                
                // Show comparisons
                if (priceData.comparisons.rawToPsa9.dollarDiff !== 0) {
                    console.log(`   📈 Raw → PSA 9: $${priceData.comparisons.rawToPsa9.dollarDiff.toFixed(2)} (${priceData.comparisons.rawToPsa9.percentDiff > 0 ? '+' : ''}${priceData.comparisons.rawToPsa9.percentDiff.toFixed(1)}%)`);
                }
                if (priceData.comparisons.rawToPsa10.dollarDiff !== 0) {
                    console.log(`   📈 Raw → PSA 10: $${priceData.comparisons.rawToPsa10.dollarDiff.toFixed(2)} (${priceData.comparisons.rawToPsa10.percentDiff > 0 ? '+' : ''}${priceData.comparisons.rawToPsa10.percentDiff.toFixed(1)}%)`);
                }
                
                successCount++;
            } else {
                console.log(`   ❌ No price data found`);
                errorCount++;
            }
            
            processedCount++;
            
            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, 2000));
            
        } catch (error) {
            console.error(`   ❌ Error processing card: ${error.message}`);
            errorCount++;
        }
    }
    
    // Save updated database
    saveDatabase(database);
    
    console.log(`\n✅ Price Comparison Update Completed!`);
    console.log(`=============================`);
    console.log(`📊 Cards processed: ${processedCount}`);
    console.log(`✅ Successful: ${successCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`💾 Database saved: ${database.items.length} items`);
    
    return { processed: processedCount, success: successCount, errors: errorCount };
}

// Run the tool
const limit = process.argv[2] ? parseInt(process.argv[2]) : 50;
addPriceComparisons(limit).catch(console.error); 