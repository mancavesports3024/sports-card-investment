const BeckettParallelScraper = require('./beckett-parallel-scraper');
const fs = require('fs').promises;
const path = require('path');

class BeckettIntegration {
    constructor() {
        this.scraper = new BeckettParallelScraper();
        this.extractionFile = path.join(__dirname, 'create-new-pricing-database.js');
    }

    async readExtractionFile() {
        try {
            const content = await fs.readFile(this.extractionFile, 'utf8');
            return content;
        } catch (error) {
            console.error('❌ Error reading extraction file:', error.message);
            return null;
        }
    }

    async writeExtractionFile(content) {
        try {
            await fs.writeFile(this.extractionFile, content, 'utf8');
            console.log('✅ Successfully updated extraction file');
            return true;
        } catch (error) {
            console.error('❌ Error writing extraction file:', error.message);
            return false;
        }
    }

    findInsertionPoint(content) {
        // Find where to insert new patterns (after existing patterns, before basic color types)
        const lines = content.split('\n');
        
        // Look for the section where basic color types start
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes('// Basic color types (lower priority)')) {
                return i;
            }
        }
        
        // Fallback: look for the end of card type patterns
        for (let i = lines.length - 1; i >= 0; i--) {
            if (lines[i].includes('{ pattern: /\\b(base)\\b/gi, name: \'Base\' }')) {
                return i;
            }
        }
        
        return -1;
    }

    generatePatternCode(parallels, setName) {
        if (parallels.length === 0) {
            return `// No parallels found for ${setName}`;
        }

        let code = `\n            // ${setName} Parallels (from Beckett)\n`;
        
        parallels.forEach(parallel => {
            const cleanName = parallel.replace(/[^\w\s\-&]/g, '').trim();
            const patternName = cleanName.replace(/\s+/g, ' ').replace(/[^\w\s]/g, '');
            
            if (cleanName && patternName && cleanName.length > 2) {
                // Escape special regex characters
                const escapedPattern = cleanName.toLowerCase()
                    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
                    .replace(/\s+/g, '\\s+');
                
                code += `            { pattern: /\\b(${escapedPattern})\\b/gi, name: '${patternName}' },\n`;
            }
        });

        return code;
    }

    async integrateParallels(setName) {
        console.log(`🔄 Integrating parallels for: ${setName}`);
        
        try {
            // Scrape parallels from Beckett
            const parallels = await this.scraper.scrapeParallelsForSet(setName);
            
            if (parallels.length === 0) {
                console.log(`❌ No parallels found for ${setName}`);
                return false;
            }

            // Read current extraction file
            const content = await this.readExtractionFile();
            if (!content) {
                return false;
            }

            // Find insertion point
            const insertionPoint = this.findInsertionPoint(content);
            if (insertionPoint === -1) {
                console.log('❌ Could not find insertion point in extraction file');
                return false;
            }

            // Generate pattern code
            const patternCode = this.generatePatternCode(parallels, setName);
            
            // Insert the new patterns
            const lines = content.split('\n');
            lines.splice(insertionPoint, 0, patternCode);
            
            // Write back to file
            const success = await this.writeExtractionFile(lines.join('\n'));
            
            if (success) {
                console.log(`✅ Successfully integrated ${parallels.length} parallels for ${setName}`);
                console.log('Sample parallels:', parallels.slice(0, 5).join(', '));
            }
            
            return success;

        } catch (error) {
            console.error(`❌ Error integrating parallels for ${setName}:`, error.message);
            return false;
        }
    }

    async batchIntegrate(setNames) {
        console.log('🚀 Starting batch integration of Beckett parallels...\n');
        
        const results = [];
        
        for (const setName of setNames) {
            console.log(`\n📦 Processing: ${setName}`);
            const success = await this.integrateParallels(setName);
            results.push({ setName, success });
            
            // Add delay between requests
            await new Promise(resolve => setTimeout(resolve, 3000));
        }

        console.log('\n📋 Integration Summary:');
        console.log('=====================');
        
        results.forEach(({ setName, success }) => {
            console.log(`${success ? '✅' : '❌'} ${setName}`);
        });

        return results;
    }

    async generateReport(setNames) {
        console.log('📊 Generating Beckett parallel report...\n');
        
        const report = {};
        
        for (const setName of setNames) {
            console.log(`🔍 Scraping: ${setName}`);
            const parallels = await this.scraper.scrapeParallelsForSet(setName);
            report[setName] = parallels;
            
            // Add delay between requests
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        // Generate report file
        const reportContent = this.generateReportContent(report);
        const reportFile = path.join(__dirname, 'beckett-parallels-report.txt');
        
        try {
            await fs.writeFile(reportFile, reportContent, 'utf8');
            console.log(`✅ Report saved to: ${reportFile}`);
        } catch (error) {
            console.error('❌ Error writing report:', error.message);
        }

        return report;
    }

    generateReportContent(report) {
        let content = 'Beckett Parallels Report\n';
        content += '========================\n\n';
        
        Object.entries(report).forEach(([setName, parallels]) => {
            content += `${setName}:\n`;
            content += `Found ${parallels.length} parallels\n`;
            
            if (parallels.length > 0) {
                content += 'Parallels:\n';
                parallels.forEach(parallel => {
                    content += `  - ${parallel}\n`;
                });
            }
            
            content += '\n';
        });

        return content;
    }
}

// Example usage
async function main() {
    const integration = new BeckettIntegration();
    
    // Example card sets to process
    const cardSets = [
        '2023 Panini Prizm Football',
        '2023 Topps Chrome Baseball',
        '2023 Bowman Chrome Baseball',
        '2023 Panini Select Football',
        '2023 Topps Chrome Update Baseball'
    ];

    // Choose what to do:
    const action = process.argv[2] || 'report'; // 'report', 'integrate', or 'batch'
    
    switch (action) {
        case 'integrate':
            // Integrate parallels for a single set
            const singleSet = process.argv[3] || cardSets[0];
            await integration.integrateParallels(singleSet);
            break;
            
        case 'batch':
            // Integrate parallels for multiple sets
            await integration.batchIntegrate(cardSets);
            break;
            
        case 'report':
        default:
            // Generate a report of all parallels
            await integration.generateReport(cardSets);
            break;
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = BeckettIntegration;
