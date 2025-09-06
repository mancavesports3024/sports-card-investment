// Quick fix for fast-batch-pull-ebay.js extraction methods
const fs = require('fs');

const fixedMethods = `
    // Helper methods for extracting card components - FIXED VERSION
    extractPlayerName(title) {
        try {
            return this.extractor.extractPlayerName(title) || 'Unknown';
        } catch (error) {
            console.log(\`⚠️ Error extracting player name from "\${title}": \${error.message}\`);
            return 'Unknown';
        }
    }

    extractYear(title) {
        const yearMatch = title.match(/(19|20)\\d{2}/);
        return yearMatch ? parseInt(yearMatch[0]) : null;
    }

    extractBrand(title) {
        if (title.toLowerCase().includes('panini')) return 'Panini';
        if (title.toLowerCase().includes('topps')) return 'Topps';
        if (title.toLowerCase().includes('upper deck')) return 'Upper Deck';
        if (title.toLowerCase().includes('bowman')) return 'Bowman';
        if (title.toLowerCase().includes('donruss')) return 'Donruss';
        return 'Unknown';
    }

    extractSet(title) {
        try {
            const NewPricingDatabase = require('./create-new-pricing-database.js');
            const db = new NewPricingDatabase();
            return db.extractCardSet(title) || 'Unknown';
        } catch (error) {
            console.log(\`⚠️ Error extracting set from "\${title}": \${error.message}\`);
            return 'Unknown';
        }
    }

    extractCardNumber(title) {
        try {
            const NewPricingDatabase = require('./create-new-pricing-database.js');
            const db = new NewPricingDatabase();
            return db.extractCardNumber(title) || null;
        } catch (error) {
            const numberMatch = title.match(/#(\\d+)/);
            return numberMatch ? \`#\${numberMatch[1]}\` : null;
        }
    }

    extractPrintRun(title) {
        const printMatch = title.match(/\\/(\\d+)/);
        return printMatch ? \`/\${printMatch[1]}\` : null;
    }

    isRookie(title) {
        return (title.toLowerCase().includes('rookie') || 
               title.toLowerCase().includes('rc') ||
               title.toLowerCase().includes('1st')) ? 1 : 0;
    }

    isAutograph(title) {
        return (title.toLowerCase().includes('auto') || 
               title.toLowerCase().includes('autograph') ||
               title.toLowerCase().includes('signed')) ? 1 : 0;
    }

    extractCardType(title) {
        try {
            const NewPricingDatabase = require('./create-new-pricing-database.js');
            const db = new NewPricingDatabase();
            return db.extractCardType(title) || 'Base';
        } catch (error) {
            console.log(\`⚠️ Error extracting card type from "\${title}": \${error.message}\`);
            return 'Base';
        }
    }
`;

console.log('🔧 Copy this fixed code and replace the extraction methods in fast-batch-pull-ebay.js');
console.log('🎯 This removes all the extractFromTitle calls that don\'t exist');
console.log('');
console.log(fixedMethods);
