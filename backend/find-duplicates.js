const fs = require('fs');
const path = require('path');

// Function to find duplicates in the PSA10 database
function findDuplicates() {
    console.log('Loading PSA10 database...');
    
    try {
        const dataPath = path.join(__dirname, 'data', 'psa10_recent_90_days_database.json');
        const rawData = fs.readFileSync(dataPath, 'utf8');
        const database = JSON.parse(rawData);
        
        // Extract items array from the database structure
        const items = database.items || database;
        
        console.log(`Total records: ${items.length}`);
        
        // Create maps to track duplicates
        const duplicatesByTitle = new Map();
        const duplicatesByUrl = new Map();
        const duplicatesByEbayId = new Map();
        const duplicatesByCombinedKey = new Map();
        
        // Track potential duplicate indicators
        const potentialDuplicates = [];
        
        items.forEach((item, index) => {
            // Check by title
            if (item.title) {
                const titleKey = item.title.toLowerCase().trim();
                if (!duplicatesByTitle.has(titleKey)) {
                    duplicatesByTitle.set(titleKey, []);
                }
                duplicatesByTitle.get(titleKey).push({ index, item });
            }
            
            // Check by URL
            if (item.url) {
                if (!duplicatesByUrl.has(item.url)) {
                    duplicatesByUrl.set(item.url, []);
                }
                duplicatesByUrl.get(item.url).push({ index, item });
            }
            
            // Check by eBay ID if available
            if (item.ebayId) {
                if (!duplicatesByEbayId.has(item.ebayId)) {
                    duplicatesByEbayId.set(item.ebayId, []);
                }
                duplicatesByEbayId.get(item.ebayId).push({ index, item });
            }
            
            // Check by combined key (title + price + seller)
            const combinedKey = `${item.title || ''}-${item.price || ''}-${item.seller || ''}`.toLowerCase().trim();
            if (!duplicatesByCombinedKey.has(combinedKey)) {
                duplicatesByCombinedKey.set(combinedKey, []);
            }
            duplicatesByCombinedKey.get(combinedKey).push({ index, item });
        });
        
        // Analyze results
        console.log('\n=== DUPLICATE ANALYSIS ===');
        
        // Title duplicates
        const titleDuplicates = Array.from(duplicatesByTitle.entries())
            .filter(([title, entries]) => entries.length > 1);
        
        console.log(`\nTitle duplicates found: ${titleDuplicates.length}`);
        titleDuplicates.slice(0, 5).forEach(([title, entries]) => {
            console.log(`\nTitle: "${title}" (${entries.length} occurrences)`);
            entries.forEach(({ index, item }) => {
                console.log(`  Index ${index}: Price: $${item.price}, Seller: ${item.seller}, URL: ${item.url?.substring(0, 50)}...`);
            });
        });
        
        // URL duplicates
        const urlDuplicates = Array.from(duplicatesByUrl.entries())
            .filter(([url, entries]) => entries.length > 1);
        
        console.log(`\nURL duplicates found: ${urlDuplicates.length}`);
        urlDuplicates.slice(0, 5).forEach(([url, entries]) => {
            console.log(`\nURL: "${url.substring(0, 50)}..." (${entries.length} occurrences)`);
            entries.forEach(({ index, item }) => {
                console.log(`  Index ${index}: Title: ${item.title}, Price: $${item.price}`);
            });
        });
        
        // eBay ID duplicates
        const ebayIdDuplicates = Array.from(duplicatesByEbayId.entries())
            .filter(([ebayId, entries]) => entries.length > 1);
        
        console.log(`\neBay ID duplicates found: ${ebayIdDuplicates.length}`);
        ebayIdDuplicates.slice(0, 5).forEach(([ebayId, entries]) => {
            console.log(`\neBay ID: "${ebayId}" (${entries.length} occurrences)`);
            entries.forEach(({ index, item }) => {
                console.log(`  Index ${index}: Title: ${item.title}, Price: $${item.price}`);
            });
        });
        
        // Combined key duplicates
        const combinedDuplicates = Array.from(duplicatesByCombinedKey.entries())
            .filter(([key, entries]) => entries.length > 1);
        
        console.log(`\nCombined key duplicates found: ${combinedDuplicates.length}`);
        combinedDuplicates.slice(0, 5).forEach(([key, entries]) => {
            console.log(`\nCombined Key: "${key.substring(0, 50)}..." (${key.length > 50 ? '...' : ''}) (${entries.length} occurrences)`);
            entries.forEach(({ index, item }) => {
                console.log(`  Index ${index}: URL: ${item.url?.substring(0, 50)}...`);
            });
        });
        
        // Generate summary report
        const summary = {
            totalRecords: items.length,
            titleDuplicates: titleDuplicates.length,
            urlDuplicates: urlDuplicates.length,
            ebayIdDuplicates: ebayIdDuplicates.length,
            combinedDuplicates: combinedDuplicates.length,
            duplicateIndices: new Set()
        };
        
        // Collect all duplicate indices
        titleDuplicates.forEach(([title, entries]) => {
            entries.forEach(({ index }) => summary.duplicateIndices.add(index));
        });
        
        urlDuplicates.forEach(([url, entries]) => {
            entries.forEach(({ index }) => summary.duplicateIndices.add(index));
        });
        
        ebayIdDuplicates.forEach(([ebayId, entries]) => {
            entries.forEach(({ index }) => summary.duplicateIndices.add(index));
        });
        
        combinedDuplicates.forEach(([key, entries]) => {
            entries.forEach(({ index }) => summary.duplicateIndices.add(index));
        });
        
        summary.uniqueDuplicateRecords = summary.duplicateIndices.size;
        summary.duplicatePercentage = ((summary.uniqueDuplicateRecords / summary.totalRecords) * 100).toFixed(2);
        
        console.log('\n=== SUMMARY ===');
        console.log(`Total records: ${summary.totalRecords}`);
        console.log(`Records with duplicates: ${summary.uniqueDuplicateRecords}`);
        console.log(`Duplicate percentage: ${summary.duplicatePercentage}%`);
        
        // Save detailed report
        const reportPath = path.join(__dirname, 'data', 'duplicate_analysis_report.json');
        fs.writeFileSync(reportPath, JSON.stringify(summary, null, 2));
        console.log(`\nDetailed report saved to: ${reportPath}`);
        
        return summary;
        
    } catch (error) {
        console.error('Error analyzing duplicates:', error);
        return null;
    }
}

// Run the analysis
if (require.main === module) {
    findDuplicates();
}

module.exports = { findDuplicates }; 