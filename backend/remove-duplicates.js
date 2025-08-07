const fs = require('fs');
const path = require('path');

function removeDuplicates() {
    console.log('Loading PSA10 database...');
    
    try {
        const dataPath = path.join(__dirname, 'data', 'psa10_recent_90_days_database.json');
        const rawData = fs.readFileSync(dataPath, 'utf8');
        const database = JSON.parse(rawData);
        
        // Extract items array from the database structure
        const items = database.items || database;
        
        console.log(`Original records: ${items.length}`);
        
        // Create a map to track unique items by title
        const uniqueItems = new Map();
        const duplicateIndices = [];
        
        items.forEach((item, index) => {
            if (item.title) {
                const titleKey = item.title.toLowerCase().trim();
                
                if (uniqueItems.has(titleKey)) {
                    // This is a duplicate
                    duplicateIndices.push(index);
                    console.log(`Duplicate found at index ${index}: "${item.title}"`);
                } else {
                    // This is unique, add it to the map
                    uniqueItems.set(titleKey, item);
                }
            } else {
                // Item without title, keep it
                uniqueItems.set(`no-title-${index}`, item);
            }
        });
        
        // Convert map back to array
        const cleanedItems = Array.from(uniqueItems.values());
        
        console.log(`\nDuplicate analysis:`);
        console.log(`- Original records: ${items.length}`);
        console.log(`- Duplicates found: ${duplicateIndices.length}`);
        console.log(`- Cleaned records: ${cleanedItems.length}`);
        console.log(`- Records removed: ${items.length - cleanedItems.length}`);
        
        // Create cleaned database structure
        const cleanedDatabase = {
            ...database,
            items: cleanedItems
        };
        
        // Save cleaned database
        const cleanedPath = path.join(__dirname, 'data', 'psa10_recent_90_days_database_cleaned.json');
        fs.writeFileSync(cleanedPath, JSON.stringify(cleanedDatabase, null, 2));
        
        // Save duplicate details for reference
        const duplicateDetails = {
            totalOriginalRecords: items.length,
            totalCleanedRecords: cleanedItems.length,
            duplicatesRemoved: duplicateIndices.length,
            duplicateIndices: duplicateIndices,
            duplicatePercentage: ((duplicateIndices.length / items.length) * 100).toFixed(2)
        };
        
        const duplicateDetailsPath = path.join(__dirname, 'data', 'duplicate_removal_details.json');
        fs.writeFileSync(duplicateDetailsPath, JSON.stringify(duplicateDetails, null, 2));
        
        console.log(`\nCleaned database saved to: ${cleanedPath}`);
        console.log(`Duplicate details saved to: ${duplicateDetailsPath}`);
        
        // Show some examples of removed duplicates
        console.log('\nExamples of removed duplicates:');
        duplicateIndices.slice(0, 5).forEach(index => {
            const item = items[index];
            console.log(`  Index ${index}: "${item.title}" - Price: ${JSON.stringify(item.price)}`);
        });
        
        return {
            originalCount: items.length,
            cleanedCount: cleanedItems.length,
            duplicatesRemoved: duplicateIndices.length
        };
        
    } catch (error) {
        console.error('Error removing duplicates:', error);
        return null;
    }
}

// Run the duplicate removal
if (require.main === module) {
    removeDuplicates();
}

module.exports = { removeDuplicates }; 