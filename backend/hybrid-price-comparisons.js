require('dotenv').config();
const fs = require('fs');
const path = require('path');
const OptimizedSearchEngine = require('./optimized-search-engine');
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

// Extract card identifier for searching
function extractCardIdentifier(item) {
    let title = item.summaryTitle || item.title || '';
    
    // Remove PSA 10 references
    title = title.replace(/PSA\s*10/gi, '');
    title = title.replace(/GEM\s*MT/gi, '');
    title = title.replace(/GEM\s*MINT/gi, '');
    title = title.replace(/GRADED/gi, '');
    
    // Extract year if present
    const yearMatch = title.match(/(\d{4})/);
    const year = yearMatch ? yearMatch[1] : null;
    
    // Clean up extra spaces
    title = title.replace(/\s+/g, ' ').trim();
    
    return { identifier: title, year };
}

// Fast price comparison using optimized search engine
async function fastPriceComparison(searchEngine, card) {
    const { identifier, year } = extractCardIdentifier(card);
    
    try {
        // Use optimized search engine (0.78ms average)
        const result = searchEngine.fastSearch(identifier, { limit: 100 });
        
        if (result.priceAnalysis) {
            const analysis = result.priceAnalysis;
            const psa10Price = parseFloat(card.price?.value || 0);
            
            // Calculate price differences
            const rawToPsa9Diff = analysis.psa9.avgPrice > 0 && analysis.raw.avgPrice > 0 ? 
                analysis.psa9.avgPrice - analysis.raw.avgPrice : 0;
            const rawToPsa9Percent = analysis.raw.avgPrice > 0 ? (rawToPsa9Diff / analysis.raw.avgPrice) * 100 : 0;
            
            const rawToPsa10Diff = psa10Price > 0 && analysis.raw.avgPrice > 0 ? 
                psa10Price - analysis.raw.avgPrice : 0;
            const rawToPsa10Percent = analysis.raw.avgPrice > 0 ? (rawToPsa10Diff / analysis.raw.avgPrice) * 100 : 0;
            
            const psa9ToPsa10Diff = psa10Price > 0 && analysis.psa9.avgPrice > 0 ? 
                psa10Price - analysis.psa9.avgPrice : 0;
            const psa9ToPsa10Percent = analysis.psa9.avgPrice > 0 ? (psa9ToPsa10Diff / analysis.psa9.avgPrice) * 100 : 0;
            
            return {
                cardTitle: identifier,
                raw: {
                    count: analysis.raw.count,
                    avgPrice: analysis.raw.avgPrice,
                    minPrice: analysis.raw.minPrice,
                    maxPrice: analysis.raw.maxPrice
                },
                psa9: {
                    count: analysis.psa9.count,
                    avgPrice: analysis.psa9.avgPrice,
                    minPrice: analysis.psa9.minPrice,
                    maxPrice: analysis.psa9.maxPrice
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
                },
                searchPerformance: result.performance,
                source: 'fast_search'
            };
        }
        
        return null;
        
    } catch (error) {
        console.error(`   ❌ Error in fast search for ${identifier}:`, error.message);
        return null;
    }
}

// API-based price comparison (fallback)
async function apiPriceComparison(card, limit = 20) {
    const cardTitle = extractCardIdentifier(card).identifier;
    
    try {
        console.log(`   🔍 API search for: "${cardTitle}"`);
        
        const rawQuery = `${cardTitle}`;
        const rawResults = await search130point(rawQuery, limit);
        
        const psa9Query = `${cardTitle} PSA 9`;
        const psa9Results = await search130point(psa9Query, limit);
        
        // Filter for raw cards (no PSA mentioned)
        const rawCards = rawResults.filter(card => {
            const title = card.title?.toLowerCase() || '';
            return !title.includes('psa') && !title.includes('graded') && 
                   !title.includes('gem mt') && !title.includes('gem mint');
        });
        
        // Filter for PSA 9 cards
        const psa9Cards = psa9Results.filter(card => {
            const title = card.title?.toLowerCase() || '';
            return title.includes('psa 9') || title.includes('psa9');
        });
        
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
                minPrice: rawCards.length > 0 ? Math.min(...rawCards.map(c => parseFloat(c.price?.value || 0))) : 0,
                maxPrice: rawCards.length > 0 ? Math.max(...rawCards.map(c => parseFloat(c.price?.value || 0))) : 0
            },
            psa9: {
                count: psa9Cards.length,
                avgPrice: psa9Avg,
                minPrice: psa9Cards.length > 0 ? Math.min(...psa9Cards.map(c => parseFloat(c.price?.value || 0))) : 0,
                maxPrice: psa9Cards.length > 0 ? Math.max(...psa9Cards.map(c => parseFloat(c.price?.value || 0))) : 0
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
            },
            source: 'api_search'
        };
        
    } catch (error) {
        console.error(`   ❌ Error in API search for ${cardTitle}:`, error.message);
        return null;
    }
}

// Hybrid price comparison - try fast first, fallback to API
async function hybridPriceComparison(searchEngine, card, forceApi = false) {
    const { identifier } = extractCardIdentifier(card);
    
    // Try fast search first (unless forced to use API)
    if (!forceApi) {
        const fastResult = await fastPriceComparison(searchEngine, card);
        if (fastResult && fastResult.raw.count > 0 && fastResult.psa9.count > 0) {
            return fastResult;
        }
    }
    
    // Fallback to API search
    console.log(`   ⚡ Fast search insufficient, using API for: ${identifier}`);
    return await apiPriceComparison(card);
}

// Batch process cards with hybrid approach
async function hybridBatchPriceComparisons(limit = 1000, forceApi = false) {
    console.log('🚀 Hybrid Price Comparisons - Fast + API Fallback');
    console.log('==================================================\n');
    
    // Create backup
    createBackup();
    
    // Initialize optimized search engine
    const searchEngine = new OptimizedSearchEngine();
    console.log('📊 Loading optimized search engine...');
    await searchEngine.loadDatabase();
    const stats = searchEngine.getDatabaseStats();
    console.log(`✅ Engine loaded: ${stats.totalItems.toLocaleString()} items\n`);
    
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
    
    console.log(`🎯 Processing ${cardsToProcess.length} cards with hybrid approach...\n`);
    
    let processedCount = 0;
    let successCount = 0;
    let errorCount = 0;
    let fastSearchCount = 0;
    let apiSearchCount = 0;
    let totalSearchTime = 0;
    
    // Process in batches for better performance
    const BATCH_SIZE = forceApi ? 10 : 50; // Smaller batches for API calls
    
    for (let i = 0; i < cardsToProcess.length; i += BATCH_SIZE) {
        const batch = cardsToProcess.slice(i, i + BATCH_SIZE);
        
        console.log(`📦 Processing batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(cardsToProcess.length/BATCH_SIZE)} (${batch.length} cards)...`);
        
        // Process batch (concurrent for fast search, sequential for API)
        if (forceApi) {
            // Sequential processing for API calls
            for (let j = 0; j < batch.length; j++) {
                const card = batch[j];
                try {
                    const startTime = Date.now();
                    const priceData = await hybridPriceComparison(searchEngine, card, true);
                    const searchTime = Date.now() - startTime;
                    totalSearchTime += searchTime;
                    
                    if (priceData) {
                        card.priceComparisons = {
                            raw: priceData.raw,
                            psa9: priceData.psa9,
                            comparisons: priceData.comparisons,
                            lastUpdated: new Date().toISOString(),
                            source: priceData.source
                        };
                        
                        console.log(`   📈 ${card.summaryTitle || card.title}`);
                        if (priceData.raw.avgPrice > 0) {
                            console.log(`      💰 Raw: $${priceData.raw.avgPrice.toFixed(2)} (${priceData.raw.count} cards) [${priceData.source}]`);
                        }
                        if (priceData.psa9.avgPrice > 0) {
                            console.log(`      💰 PSA 9: $${priceData.psa9.avgPrice.toFixed(2)} (${priceData.psa9.count} cards) [${priceData.source}]`);
                        }
                        console.log(`      ⚡ Search time: ${searchTime}ms`);
                        
                        successCount++;
                        apiSearchCount++;
                    } else {
                        console.log(`   ❌ No price data found for: ${card.summaryTitle || card.title}`);
                        errorCount++;
                    }
                    
                    processedCount++;
                    
                    // Rate limiting for API calls
                    if (j < batch.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                    
                } catch (error) {
                    console.error(`   ❌ Error processing card: ${error.message}`);
                    errorCount++;
                }
            }
        } else {
            // Concurrent processing for fast search
            const batchPromises = batch.map(async (card, batchIndex) => {
                try {
                    const startTime = Date.now();
                    const priceData = await hybridPriceComparison(searchEngine, card, false);
                    const searchTime = Date.now() - startTime;
                    totalSearchTime += searchTime;
                    
                    if (priceData) {
                        card.priceComparisons = {
                            raw: priceData.raw,
                            psa9: priceData.psa9,
                            comparisons: priceData.comparisons,
                            lastUpdated: new Date().toISOString(),
                            source: priceData.source
                        };
                        
                        // Log results (only for first few in batch)
                        if (batchIndex < 3) {
                            console.log(`   📈 ${card.summaryTitle || card.title}`);
                            if (priceData.raw.avgPrice > 0) {
                                console.log(`      💰 Raw: $${priceData.raw.avgPrice.toFixed(2)} (${priceData.raw.count} cards) [${priceData.source}]`);
                            }
                            if (priceData.psa9.avgPrice > 0) {
                                console.log(`      💰 PSA 9: $${priceData.psa9.avgPrice.toFixed(2)} (${priceData.psa9.count} cards) [${priceData.source}]`);
                            }
                            console.log(`      ⚡ Search time: ${searchTime}ms`);
                        }
                        
                        successCount++;
                        if (priceData.source === 'fast_search') {
                            fastSearchCount++;
                        } else {
                            apiSearchCount++;
                        }
                    } else {
                        if (batchIndex < 3) {
                            console.log(`   ❌ No price data found for: ${card.summaryTitle || card.title}`);
                        }
                        errorCount++;
                    }
                    
                    processedCount++;
                    
                } catch (error) {
                    console.error(`   ❌ Error processing card: ${error.message}`);
                    errorCount++;
                }
            });
            
            // Wait for batch to complete
            await Promise.all(batchPromises);
        }
        
        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Save updated database
    saveDatabase(database);
    
    // Performance summary
    const avgSearchTime = totalSearchTime / processedCount;
    const searchesPerSecond = (1000 / avgSearchTime).toFixed(1);
    
    console.log(`\n🚀 HYBRID PRICE COMPARISON COMPLETED!`);
    console.log(`=====================================`);
    console.log(`📊 Cards processed: ${processedCount}`);
    console.log(`✅ Successful: ${successCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`⚡ Fast searches: ${fastSearchCount}`);
    console.log(`🌐 API searches: ${apiSearchCount}`);
    console.log(`⚡ Average search time: ${avgSearchTime.toFixed(2)}ms`);
    console.log(`🚀 Searches per second: ${searchesPerSecond}`);
    console.log(`💾 Database saved: ${database.items.length} items`);
    
    // Show some interesting opportunities
    const opportunities = database.items
        .filter(item => item.priceComparisons && 
                       item.priceComparisons.comparisons.rawToPsa10.percentDiff > 100)
        .slice(0, 5);
    
    if (opportunities.length > 0) {
        console.log(`\n🎯 TOP OPPORTUNITIES FOUND:`);
        opportunities.forEach((item, i) => {
            const comp = item.priceComparisons.comparisons;
            console.log(`   ${i+1}. ${item.summaryTitle || item.title}`);
            console.log(`      Raw → PSA 10: +${comp.rawToPsa10.percentDiff.toFixed(1)}% ($${comp.rawToPsa10.dollarDiff.toFixed(2)})`);
        });
    }
    
    return { 
        processed: processedCount, 
        success: successCount, 
        errors: errorCount,
        fastSearches: fastSearchCount,
        apiSearches: apiSearchCount,
        avgSearchTime,
        searchesPerSecond
    };
}

// Run the hybrid comparison tool
const limit = process.argv[2] ? parseInt(process.argv[2]) : 500;
const forceApi = process.argv.includes('--api');
const fastOnly = process.argv.includes('--fast');

if (fastOnly) {
    console.log('⚡ Running FAST-ONLY mode (no API calls)');
    hybridBatchPriceComparisons(limit, false).catch(console.error);
} else if (forceApi) {
    console.log('🌐 Running API-ONLY mode (no fast search)');
    hybridBatchPriceComparisons(limit, true).catch(console.error);
} else {
    console.log('🚀 Running HYBRID mode (fast search + API fallback)');
    hybridBatchPriceComparisons(limit, false).catch(console.error);
} 