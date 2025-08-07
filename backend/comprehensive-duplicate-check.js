const fs = require('fs');
const path = require('path');

function comprehensiveDuplicateCheck() {
    console.log('Running comprehensive duplicate check...');
    
    try {
        const dataPath = path.join(__dirname, 'data', 'psa10_recent_90_days_database.json');
        const rawData = fs.readFileSync(dataPath, 'utf8');
        const database = JSON.parse(rawData);
        
        const items = database.items || database;
        console.log(`Analyzing ${items.length} records...`);
        
        // Different duplicate detection methods
        const duplicateTypes = {
            exactTitle: new Map(),
            normalizedTitle: new Map(),
            urlBased: new Map(),
            ebayIdBased: new Map(),
            similarTitle: new Map(),
            priceAndSeller: new Map()
        };
        
        const duplicateGroups = {
            exactTitle: [],
            normalizedTitle: [],
            urlBased: [],
            ebayIdBased: [],
            similarTitle: [],
            priceAndSeller: []
        };
        
        // Process each item
        items.forEach((item, index) => {
            // 1. Exact title duplicates
            if (item.title) {
                const exactTitle = item.title;
                if (!duplicateTypes.exactTitle.has(exactTitle)) {
                    duplicateTypes.exactTitle.set(exactTitle, []);
                }
                duplicateTypes.exactTitle.get(exactTitle).push({ index, item });
            }
            
            // 2. Normalized title duplicates (case-insensitive, trimmed)
            if (item.title) {
                const normalizedTitle = item.title.toLowerCase().trim().replace(/\s+/g, ' ');
                if (!duplicateTypes.normalizedTitle.has(normalizedTitle)) {
                    duplicateTypes.normalizedTitle.set(normalizedTitle, []);
                }
                duplicateTypes.normalizedTitle.get(normalizedTitle).push({ index, item });
            }
            
            // 3. URL-based duplicates
            if (item.itemWebUrl) {
                if (!duplicateTypes.urlBased.has(item.itemWebUrl)) {
                    duplicateTypes.urlBased.set(item.itemWebUrl, []);
                }
                duplicateTypes.urlBased.get(item.itemWebUrl).push({ index, item });
            }
            
            // 4. eBay ID based duplicates
            if (item.ebayId) {
                if (!duplicateTypes.ebayIdBased.has(item.ebayId)) {
                    duplicateTypes.ebayIdBased.set(item.ebayId, []);
                }
                duplicateTypes.ebayIdBased.get(item.ebayId).push({ index, item });
            }
            
            // 5. Price and seller combination
            if (item.price && item.seller) {
                const priceSellerKey = `${item.price.value}-${item.seller}`;
                if (!duplicateTypes.priceAndSeller.has(priceSellerKey)) {
                    duplicateTypes.priceAndSeller.set(priceSellerKey, []);
                }
                duplicateTypes.priceAndSeller.get(priceSellerKey).push({ index, item });
            }
        });
        
        // Analyze results
        console.log('\n=== COMPREHENSIVE DUPLICATE ANALYSIS ===');
        
        Object.keys(duplicateTypes).forEach(type => {
            const duplicates = Array.from(duplicateTypes[type].entries())
                .filter(([key, entries]) => entries.length > 1);
            
            duplicateGroups[type] = duplicates;
            
            console.log(`\n${type} duplicates: ${duplicates.length}`);
            
            // Show examples
            duplicates.slice(0, 3).forEach(([key, entries]) => {
                console.log(`  "${key.substring(0, 50)}..." (${entries.length} occurrences)`);
                entries.forEach(({ index, item }) => {
                    console.log(`    Index ${index}: ${item.title?.substring(0, 40)}...`);
                });
            });
        });
        
        // Generate comprehensive report
        const report = {
            totalRecords: items.length,
            duplicateAnalysis: {},
            recommendations: []
        };
        
        Object.keys(duplicateGroups).forEach(type => {
            const duplicates = duplicateGroups[type];
            const totalDuplicates = duplicates.reduce((sum, [key, entries]) => sum + entries.length, 0);
            const uniqueDuplicateRecords = new Set();
            
            duplicates.forEach(([key, entries]) => {
                entries.forEach(({ index }) => uniqueDuplicateRecords.add(index));
            });
            
            report.duplicateAnalysis[type] = {
                duplicateGroups: duplicates.length,
                totalDuplicateEntries: totalDuplicates,
                uniqueDuplicateRecords: uniqueDuplicateRecords.size,
                percentage: ((uniqueDuplicateRecords.size / items.length) * 100).toFixed(2)
            };
        });
        
        // Generate recommendations
        if (report.duplicateAnalysis.exactTitle.duplicateGroups > 0) {
            report.recommendations.push('Remove exact title duplicates first');
        }
        if (report.duplicateAnalysis.normalizedTitle.duplicateGroups > 0) {
            report.recommendations.push('Consider removing case-insensitive title duplicates');
        }
        if (report.duplicateAnalysis.urlBased.duplicateGroups > 0) {
            report.recommendations.push('URL duplicates indicate same listing - remove all but one');
        }
        
        // Save comprehensive report
        const reportPath = path.join(__dirname, 'data', 'comprehensive_duplicate_report.json');
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        
        console.log('\n=== SUMMARY ===');
        console.log(`Total records analyzed: ${items.length}`);
        Object.keys(report.duplicateAnalysis).forEach(type => {
            const analysis = report.duplicateAnalysis[type];
            console.log(`${type}: ${analysis.duplicateGroups} groups, ${analysis.uniqueDuplicateRecords} unique records affected (${analysis.percentage}%)`);
        });
        
        console.log(`\nComprehensive report saved to: ${reportPath}`);
        
        return report;
        
    } catch (error) {
        console.error('Error in comprehensive duplicate check:', error);
        return null;
    }
}

// Run the comprehensive check
if (require.main === module) {
    comprehensiveDuplicateCheck();
}

module.exports = { comprehensiveDuplicateCheck }; 