const ParallelsDatabase = require('./create-parallels-database.js');
const fs = require('fs').promises;
const path = require('path');

class ParallelsIntegration {
    constructor() {
        this.parallelsDb = new ParallelsDatabase();
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

    async integrateParallelsFromDatabase(setName) {
        try {
            await this.parallelsDb.connectDatabase();
            
            console.log(`🔄 Integrating parallels for: ${setName}`);
            
            // Get parallels from database
            const parallels = await this.parallelsDb.getParallelsForSet(setName);
            
            if (parallels.length === 0) {
                console.log(`❌ No parallels found in database for ${setName}`);
                return false;
            }

            console.log(`📊 Found ${parallels.length} parallels in database for ${setName}`);

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
            const patternCode = await this.parallelsDb.generateExtractionPatterns(setName);
            
            // Insert the new patterns
            const lines = content.split('\n');
            lines.splice(insertionPoint, 0, patternCode);
            
            // Write back to file
            const success = await this.writeExtractionFile(lines.join('\n'));
            
            if (success) {
                console.log(`✅ Successfully integrated ${parallels.length} parallels for ${setName}`);
                console.log('Sample parallels:', parallels.slice(0, 5).map(p => p.parallel_name).join(', '));
            }
            
            return success;

        } catch (error) {
            console.error(`❌ Error integrating parallels for ${setName}:`, error.message);
            return false;
        } finally {
            await this.parallelsDb.closeDatabase();
        }
    }

    async batchIntegrateFromDatabase() {
        try {
            await this.parallelsDb.connectDatabase();
            
            console.log('🚀 Starting batch integration from parallels database...\n');
            
            // Get all card sets with parallels
            const cardSets = await this.parallelsDb.getAllCardSets();
            const setsWithParallels = cardSets.filter(set => set.parallel_count > 0);
            
            if (setsWithParallels.length === 0) {
                console.log('✅ No card sets with parallels found in database');
                return [];
            }
            
            console.log(`📋 Found ${setsWithParallels.length} card sets with parallels:`);
            setsWithParallels.forEach(set => {
                console.log(`  - ${set.set_name}: ${set.parallel_count} parallels`);
            });
            
            const results = [];
            
            // Integrate each card set
            for (const cardSet of setsWithParallels) {
                console.log(`\n📦 Processing: ${cardSet.set_name}`);
                const success = await this.integrateParallelsFromDatabase(cardSet.set_name);
                results.push({ setName: cardSet.set_name, success, parallelCount: cardSet.parallel_count });
            }
            
            // Summary
            console.log('\n📊 Integration Summary:');
            console.log('=====================');
            
            results.forEach(({ setName, success, parallelCount }) => {
                console.log(`${success ? '✅' : '❌'} ${setName}: ${parallelCount} parallels`);
            });
            
            return results;
            
        } catch (error) {
            console.error('❌ Error in batch integration:', error.message);
            return [];
        } finally {
            await this.parallelsDb.closeDatabase();
        }
    }

    async searchAndAddParallels(searchTerm) {
        try {
            await this.parallelsDb.connectDatabase();
            
            console.log(`🔍 Searching for parallels containing: "${searchTerm}"`);
            
            const results = await this.parallelsDb.searchParallels(searchTerm);
            
            if (results.length === 0) {
                console.log('❌ No parallels found matching search term');
                return [];
            }
            
            console.log(`📊 Found ${results.length} matching parallels:`);
            results.forEach(result => {
                console.log(`  - ${result.set_name}: ${result.parallel_name} (${result.parallel_type})`);
            });
            
            return results;
            
        } catch (error) {
            console.error('❌ Error searching parallels:', error.message);
            return [];
        } finally {
            await this.parallelsDb.closeDatabase();
        }
    }

    async addNewCardSet(setName, sport, year, brand) {
        try {
            await this.parallelsDb.connectDatabase();
            
            console.log(`📝 Adding new card set: ${setName}`);
            console.log(`  Sport: ${sport}`);
            console.log(`  Year: ${year}`);
            console.log(`  Brand: ${brand}`);
            
            const setId = await this.parallelsDb.addCardSet(setName, sport, year, brand);
            
            console.log(`✅ Successfully added card set with ID: ${setId}`);
            return setId;
            
        } catch (error) {
            console.error('❌ Error adding card set:', error.message);
            return null;
        } finally {
            await this.parallelsDb.closeDatabase();
        }
    }

    async addNewParallel(setName, parallelName, parallelType, rarity, printRun) {
        try {
            await this.parallelsDb.connectDatabase();
            
            console.log(`📝 Adding new parallel: ${parallelName} to ${setName}`);
            console.log(`  Type: ${parallelType}`);
            console.log(`  Rarity: ${rarity}`);
            console.log(`  Print Run: ${printRun}`);
            
            const parallelId = await this.parallelsDb.addParallel(setName, parallelName, parallelType, rarity, printRun);
            
            console.log(`✅ Successfully added parallel with ID: ${parallelId}`);
            return parallelId;
            
        } catch (error) {
            console.error('❌ Error adding parallel:', error.message);
            return null;
        } finally {
            await this.parallelsDb.closeDatabase();
        }
    }
}

// Example usage
async function main() {
    const integration = new ParallelsIntegration();
    
    // Choose what to do based on command line arguments
    const action = process.argv[2] || 'batch';
    
    switch (action) {
        case 'batch':
            // Integrate all parallels from database
            await integration.batchIntegrateFromDatabase();
            break;
            
        case 'set':
            // Integrate parallels for a specific set
            const setName = process.argv[3];
            if (setName) {
                await integration.integrateParallelsFromDatabase(setName);
            } else {
                console.log('❌ Please provide a set name: node parallels-integration.js set "Set Name"');
            }
            break;
            
        case 'search':
            // Search for parallels
            const searchTerm = process.argv[3];
            if (searchTerm) {
                await integration.searchAndAddParallels(searchTerm);
            } else {
                console.log('❌ Please provide a search term: node parallels-integration.js search "term"');
            }
            break;
            
        case 'add-set':
            // Add a new card set
            const newSetName = process.argv[3];
            const sport = process.argv[4];
            const year = process.argv[5];
            const brand = process.argv[6];
            if (newSetName) {
                await integration.addNewCardSet(newSetName, sport, year, brand);
            } else {
                console.log('❌ Please provide set details: node parallels-integration.js add-set "Set Name" "Sport" "Year" "Brand"');
            }
            break;
            
        case 'add-parallel':
            // Add a new parallel
            const targetSetName = process.argv[3];
            const newParallelName = process.argv[4];
            const parallelType = process.argv[5];
            const rarity = process.argv[6];
            const printRun = process.argv[7];
            if (targetSetName && newParallelName) {
                await integration.addNewParallel(targetSetName, newParallelName, parallelType, rarity, printRun);
            } else {
                console.log('❌ Please provide parallel details: node parallels-integration.js add-parallel "Set Name" "Parallel Name" "Type" "Rarity" "Print Run"');
            }
            break;
            
        default:
            console.log('Available actions:');
            console.log('  batch - Integrate all parallels from database');
            console.log('  set "Set Name" - Integrate parallels for specific set');
            console.log('  search "term" - Search for parallels');
            console.log('  add-set "Set Name" "Sport" "Year" "Brand" - Add new card set');
            console.log('  add-parallel "Set Name" "Parallel Name" "Type" "Rarity" "Print Run" - Add new parallel');
            break;
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = ParallelsIntegration;
