const fs = require('fs');
const path = require('path');

class OptimizedSearchEngine {
    constructor() {
        this.database = null;
        this.indexedData = new Map(); // Pre-indexed data for fast lookups
        this.priceCache = new Map(); // Cache for price calculations
        this.compiledRegex = new RegExp(/\b(psa|bgs|beckett|sgc|cgc|ace|cga|gma|hga|pgs|bvg|csg|rcg|ksa|fgs|tag|pgm|dga|isa)[\s:-]*([0-9]{1,2}(?:\.5)?)\b/i);
        this.rawKeywords = new Set(['raw', 'ungraded', 'not graded', 'no grade']);
        this.gradingCompanies = new Set(['psa', 'bgs', 'beckett', 'sgc', 'cgc', 'ace', 'cga', 'gma', 'hga', 'pgs', 'bvg', 'csg', 'rcg', 'ksa', 'fgs', 'tag', 'pgm', 'dga', 'isa']);
    }

    async loadDatabase() {
        console.log('Loading PSA10 database...');
        const dataPath = path.join(__dirname, 'data', 'psa10_recent_90_days_database.json');
        const rawData = await fs.promises.readFile(dataPath, 'utf8');
        this.database = JSON.parse(rawData);
        const items = this.database.items || this.database;
        console.log(`Loaded ${items.length} items`);
        
        // Pre-process and index the data
        this.buildIndexes(items);
        return items.length;
    }

    buildIndexes(items) {
        console.log('Building search indexes...');
        const startTime = Date.now();
        
        // Create inverted index for fast text search
        const textIndex = new Map();
        const priceIndex = new Map();
        const dateIndex = new Map();
        
        items.forEach((item, index) => {
            const title = item.title?.toLowerCase() || '';
            const words = title.split(/\s+/);
            
            // Index by words
            words.forEach(word => {
                if (word.length > 2) { // Only index words longer than 2 chars
                    if (!textIndex.has(word)) {
                        textIndex.set(word, new Set());
                    }
                    textIndex.get(word).add(index);
                }
            });
            
            // Index by price range
            const price = parseFloat(item.price?.value || 0);
            if (price > 0) {
                const priceRange = Math.floor(price / 100) * 100; // Group by $100 ranges
                if (!priceIndex.has(priceRange)) {
                    priceIndex.set(priceRange, new Set());
                }
                priceIndex.get(priceRange).add(index);
            }
            
            // Index by date
            if (item.soldDate) {
                const date = new Date(item.soldDate);
                const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
                if (!dateIndex.has(monthKey)) {
                    dateIndex.set(monthKey, new Set());
                }
                dateIndex.get(monthKey).add(index);
            }
        });
        
        this.indexedData.set('text', textIndex);
        this.indexedData.set('price', priceIndex);
        this.indexedData.set('date', dateIndex);
        this.indexedData.set('items', items);
        
        const endTime = Date.now();
        console.log(`Indexes built in ${endTime - startTime}ms`);
    }

    fastSearch(searchQuery, options = {}) {
        const startTime = Date.now();
        const query = searchQuery.toLowerCase();
        const queryWords = query.split(/\s+/).filter(word => word.length > 2);
        
        // Use indexed search for better performance
        const textIndex = this.indexedData.get('text');
        const items = this.indexedData.get('items');
        
        // Find matching items using index intersection
        let matchingIndices = new Set();
        if (queryWords.length > 0) {
            const firstWord = queryWords[0];
            if (textIndex.has(firstWord)) {
                matchingIndices = new Set(textIndex.get(firstWord));
            }
            
            // Intersect with other words
            for (let i = 1; i < queryWords.length; i++) {
                const word = queryWords[i];
                if (textIndex.has(word)) {
                    const wordIndices = textIndex.get(word);
                    matchingIndices = new Set([...matchingIndices].filter(x => wordIndices.has(x)));
                }
            }
        }
        
        // Convert indices to items
        const matchingItems = Array.from(matchingIndices).map(index => items[index]);
        
        // Fast categorization
        const categorized = this.fastCategorize(matchingItems);
        
        // Calculate price analysis
        const priceAnalysis = this.fastPriceAnalysis(categorized);
        
        const endTime = Date.now();
        console.log(`Fast search completed in ${endTime - startTime}ms`);
        
        return {
            searchParams: { searchQuery, numSales: matchingItems.length },
            results: categorized,
            priceAnalysis: priceAnalysis,
            performance: {
                searchTime: endTime - startTime,
                totalItems: items.length,
                matchingItems: matchingItems.length
            }
        };
    }

    fastCategorize(cards) {
        const buckets = {
            raw: [], psa7: [], psa8: [], psa9: [], psa10: [], 
            cgc9: [], cgc10: [], tag8: [], tag9: [], tag10: [], 
            sgc10: [], aigrade9: [], aigrade10: [], otherGraded: []
        };
        
        // Pre-compile regex for better performance
        const gradingRegex = this.compiledRegex;
        
        cards.forEach(card => {
            const title = card.title?.toLowerCase() || '';
            const condition = card.condition?.toLowerCase() || '';
            
            // Fast regex match
            const match = gradingRegex.exec(title);
            
            if (match) {
                let company = match[1].toLowerCase();
                if (company === 'beckett') company = 'bgs';
                const grade = match[2];
                
                // Fast bucket assignment using switch
                switch (company) {
                    case 'psa':
                        switch (grade) {
                            case '10': buckets.psa10.push(card); break;
                            case '9': buckets.psa9.push(card); break;
                            case '8': buckets.psa8.push(card); break;
                            case '7': buckets.psa7.push(card); break;
                            default: buckets.otherGraded.push(card);
                        }
                        break;
                    case 'cgc':
                        switch (grade) {
                            case '10': buckets.cgc10.push(card); break;
                            case '9': buckets.cgc9.push(card); break;
                            default: buckets.otherGraded.push(card);
                        }
                        break;
                    case 'tag':
                        switch (grade) {
                            case '10': buckets.tag10.push(card); break;
                            case '9': buckets.tag9.push(card); break;
                            case '8': buckets.tag8.push(card); break;
                            default: buckets.otherGraded.push(card);
                        }
                        break;
                    case 'sgc':
                        if (grade === '10') buckets.sgc10.push(card);
                        else buckets.otherGraded.push(card);
                        break;
                    case 'aigrade':
                        switch (grade) {
                            case '10': buckets.aigrade10.push(card); break;
                            case '9': buckets.aigrade9.push(card); break;
                            default: buckets.otherGraded.push(card);
                        }
                        break;
                    default:
                        buckets.otherGraded.push(card);
                }
            } else {
                // Fast raw detection
                const isRaw = this.rawKeywords.has(condition) || 
                             this.rawKeywords.has(title) ||
                             condition === 'ungraded' || 
                             condition === 'not graded' || 
                             condition === 'no grade';
                
                if (isRaw) {
                    buckets.raw.push(card);
                } else {
                    buckets.otherGraded.push(card);
                }
            }
        });
        
        return buckets;
    }

    fastPriceAnalysis(categorized) {
        const analysis = {
            raw: { count: 0, avgPrice: 0, minPrice: 0, maxPrice: 0, trend: 'neutral' },
            psa7: { count: 0, avgPrice: 0, minPrice: 0, maxPrice: 0, trend: 'neutral' },
            psa8: { count: 0, avgPrice: 0, minPrice: 0, maxPrice: 0, trend: 'neutral' },
            psa9: { count: 0, avgPrice: 0, minPrice: 0, maxPrice: 0, trend: 'neutral' },
            psa10: { count: 0, avgPrice: 0, minPrice: 0, maxPrice: 0, trend: 'neutral' },
            cgc9: { count: 0, avgPrice: 0, minPrice: 0, maxPrice: 0, trend: 'neutral' },
            cgc10: { count: 0, avgPrice: 0, minPrice: 0, maxPrice: 0, trend: 'neutral' },
            tag8: { count: 0, avgPrice: 0, minPrice: 0, maxPrice: 0, trend: 'neutral' },
            tag9: { count: 0, avgPrice: 0, minPrice: 0, maxPrice: 0, trend: 'neutral' },
            tag10: { count: 0, avgPrice: 0, minPrice: 0, maxPrice: 0, trend: 'neutral' },
            sgc10: { count: 0, avgPrice: 0, minPrice: 0, maxPrice: 0, trend: 'neutral' },
            aigrade9: { count: 0, avgPrice: 0, minPrice: 0, maxPrice: 0, trend: 'neutral' },
            aigrade10: { count: 0, avgPrice: 0, minPrice: 0, maxPrice: 0, trend: 'neutral' },
            otherGraded: { count: 0, avgPrice: 0, minPrice: 0, maxPrice: 0, trend: 'neutral' },
            comparisons: {}
        };

        // Fast price calculation for each category
        Object.keys(categorized).forEach(category => {
            const cards = categorized[category];
            if (cards.length === 0) return;
            
            // Single pass price calculation
            let sum = 0;
            let count = 0;
            let min = Infinity;
            let max = -Infinity;
            
            cards.forEach(card => {
                const price = parseFloat(card.price?.value || 0);
                if (price > 0) {
                    sum += price;
                    count++;
                    if (price < min) min = price;
                    if (price > max) max = price;
                }
            });
            
            analysis[category] = {
                count: cards.length,
                avgPrice: count > 0 ? sum / count : 0,
                minPrice: min === Infinity ? 0 : min,
                maxPrice: max === -Infinity ? 0 : max,
                trend: this.fastTrendCalculation(cards)
            };
        });

        // Fast comparison calculations
        if (analysis.raw.avgPrice > 0 && analysis.psa9.avgPrice > 0) {
            const diff = analysis.psa9.avgPrice - analysis.raw.avgPrice;
            const percent = (diff / analysis.raw.avgPrice) * 100;
            analysis.comparisons.rawToPsa9 = {
                dollarDiff: diff,
                percentDiff: percent,
                description: `PSA 9 is $${diff.toFixed(2)} (${percent > 0 ? '+' : ''}${percent.toFixed(1)}%) more than Raw`
            };
        }

        if (analysis.raw.avgPrice > 0 && analysis.psa10.avgPrice > 0) {
            const diff = analysis.psa10.avgPrice - analysis.raw.avgPrice;
            const percent = (diff / analysis.raw.avgPrice) * 100;
            analysis.comparisons.rawToPsa10 = {
                dollarDiff: diff,
                percentDiff: percent,
                description: `PSA 10 is $${diff.toFixed(2)} (${percent > 0 ? '+' : ''}${percent.toFixed(1)}%) more than Raw`
            };
        }

        if (analysis.psa9.avgPrice > 0 && analysis.psa10.avgPrice > 0) {
            const diff = analysis.psa10.avgPrice - analysis.psa9.avgPrice;
            const percent = (diff / analysis.psa9.avgPrice) * 100;
            analysis.comparisons.psa9ToPsa10 = {
                dollarDiff: diff,
                percentDiff: percent,
                description: `PSA 10 is $${diff.toFixed(2)} (${percent > 0 ? '+' : ''}${percent.toFixed(1)}%) more than PSA 9`
            };
        }

        return analysis;
    }

    fastTrendCalculation(cards) {
        if (cards.length < 2) return 'neutral';
        
        // Simple trend calculation based on recent vs older prices
        const sortedByDate = cards.sort((a, b) => new Date(b.soldDate) - new Date(a.soldDate));
        const recent = sortedByDate.slice(0, Math.ceil(cards.length / 2));
        const older = sortedByDate.slice(Math.ceil(cards.length / 2));
        
        const recentAvg = recent.reduce((sum, card) => sum + parseFloat(card.price?.value || 0), 0) / recent.length;
        const olderAvg = older.reduce((sum, card) => sum + parseFloat(card.price?.value || 0), 0) / older.length;
        
        if (recentAvg > olderAvg * 1.05) return 'up';
        if (recentAvg < olderAvg * 0.95) return 'down';
        return 'neutral';
    }

    // Batch processing for multiple searches
    async batchSearch(queries) {
        console.log(`Processing ${queries.length} search queries in batch...`);
        const startTime = Date.now();
        const results = [];
        
        for (const query of queries) {
            const result = this.fastSearch(query);
            results.push({
                query,
                ...result
            });
        }
        
        const endTime = Date.now();
        console.log(`Batch search completed in ${endTime - startTime}ms`);
        
        return results;
    }

    // Get database statistics
    getDatabaseStats() {
        const items = this.indexedData.get('items');
        const priceIndex = this.indexedData.get('price');
        
        const totalItems = items.length;
        const priceRanges = Array.from(priceIndex.keys()).sort((a, b) => a - b);
        
        return {
            totalItems,
            priceRanges: priceRanges.length,
            indexedWords: this.indexedData.get('text').size,
            dateRanges: this.indexedData.get('date').size
        };
    }
}

// Export the optimized search engine
module.exports = OptimizedSearchEngine; 