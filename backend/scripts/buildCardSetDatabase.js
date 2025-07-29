const getCardBaseService = require('../services/getCardBaseService');
const fs = require('fs').promises;
const path = require('path');

class CardSetDatabaseBuilder {
  constructor() {
    this.databasePath = path.join(__dirname, '../data/cardSetsDatabase.json');
    this.statsPath = path.join(__dirname, '../data/databaseStats.json');
  }

  async ensureDataDirectory() {
    const dataDir = path.dirname(this.databasePath);
    try {
      await fs.access(dataDir);
    } catch {
      await fs.mkdir(dataDir, { recursive: true });
      console.log(`📁 Created data directory: ${dataDir}`);
    }
  }

  async loadExistingDatabase() {
    try {
      const data = await fs.readFile(this.databasePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.log('📋 No existing database found, creating new one...');
      return {
        cardSets: [],
        metadata: {
          lastUpdated: null,
          totalSets: 0,
          sources: [],
          version: '1.0'
        }
      };
    }
  }

  async saveDatabase(database) {
    await this.ensureDataDirectory();
    
    // Update metadata
    database.metadata = {
      lastUpdated: new Date().toISOString(),
      totalSets: database.cardSets.length,
      sources: ['getcardbase', 'manual'],
      version: '1.0'
    };

    // Save main database
    await fs.writeFile(this.databasePath, JSON.stringify(database, null, 2));
    console.log(`💾 Saved database with ${database.cardSets.length} card sets to ${this.databasePath}`);

    // Save stats
    const stats = {
      totalSets: database.cardSets.length,
      brands: this.getUniqueValues(database.cardSets, 'brand'),
      years: this.getUniqueValues(database.cardSets, 'year'),
      sports: this.getUniqueValues(database.cardSets, 'sport'),
      setTypes: this.getUniqueValues(database.cardSets, 'setType'),
      sources: this.getUniqueValues(database.cardSets, 'source'),
      lastUpdated: new Date().toISOString()
    };

    await fs.writeFile(this.statsPath, JSON.stringify(stats, null, 2));
    console.log(`📊 Saved database stats to ${this.statsPath}`);
  }

  getUniqueValues(cardSets, field) {
    const values = new Set();
    cardSets.forEach(set => {
      if (set[field]) {
        values.add(set[field]);
      }
    });
    return Array.from(values).sort();
  }

  // Enhanced card set creation with better data quality
  createCardSet(brand, set, year, sport = 'Baseball', league = 'MLB') {
    const id = `gcb_${brand}_${set}_${year}`.replace(/\s+/g, '_').toLowerCase();
    
    // Determine set type based on set name
    const setType = this.determineSetType(set);
    
    // Determine popularity based on brand and set
    const popularity = this.determinePopularity(brand, set);
    
    // Determine card count based on set type
    const cardCount = this.estimateCardCount(setType, set);
    
    // Determine pricing based on set type and popularity
    const { retailPrice, hobbyPrice } = this.estimatePricing(setType, popularity);
    
    // Determine release month based on set type
    const releaseMonth = this.estimateReleaseMonth(setType, set);
    
    // Determine if rookie cards are included
    const rookieCards = this.hasRookieCards(set, setType);
    
    // Determine inserts and variations
    const { inserts, variations } = this.determineInsertsAndVariations(setType, set);

    return {
      id,
      name: `${brand} ${set} ${year}`,
      brand,
      set,
      year,
      sport,
      league,
      setType,
      cardCount,
      description: `${brand} ${set} ${year} ${sport} trading card set`,
      releaseMonth,
      retailPrice,
      hobbyPrice,
      popularity,
      rookieCards,
      inserts,
      variations,
      imageUrl: '',
      source: 'getcardbase',
      lastUpdated: new Date().toISOString()
    };
  }

  determineSetType(set) {
    const lowerSet = set.toLowerCase();
    
    if (lowerSet.includes('series') || lowerSet.includes('base')) return 'Base Set';
    if (lowerSet.includes('chrome')) return 'Chrome Set';
    if (lowerSet.includes('prizm')) return 'Prizm Set';
    if (lowerSet.includes('select')) return 'Select Set';
    if (lowerSet.includes('mosaic')) return 'Mosaic Set';
    if (lowerSet.includes('optic')) return 'Optic Set';
    if (lowerSet.includes('finest')) return 'Finest Set';
    if (lowerSet.includes('tribute')) return 'Tribute Set';
    if (lowerSet.includes('tier one')) return 'Tier One Set';
    if (lowerSet.includes('transcendent')) return 'Transcendent Set';
    if (lowerSet.includes('triple threads')) return 'Triple Threads Set';
    if (lowerSet.includes('clearly authentic')) return 'Clearly Authentic Set';
    if (lowerSet.includes('update')) return 'Update Set';
    if (lowerSet.includes('heritage')) return 'Heritage Set';
    if (lowerSet.includes('archives')) return 'Archives Set';
    if (lowerSet.includes('gallery')) return 'Gallery Set';
    if (lowerSet.includes('stadium club')) return 'Stadium Club Set';
    if (lowerSet.includes('bowman')) return 'Prospect Set';
    if (lowerSet.includes('draft')) return 'Draft Set';
    if (lowerSet.includes('prospects')) return 'Prospect Set';
    if (lowerSet.includes('rookie')) return 'Rookie Set';
    if (lowerSet.includes('autograph') || lowerSet.includes('signature')) return 'Autograph Set';
    if (lowerSet.includes('relic') || lowerSet.includes('patch')) return 'Relic Set';
    if (lowerSet.includes('numbered') || lowerSet.includes('refractor')) return 'Parallel Set';
    
    return 'Standard Set';
  }

  determinePopularity(brand, set) {
    const lowerBrand = brand.toLowerCase();
    const lowerSet = set.toLowerCase();
    
    // High popularity brands
    if (lowerBrand.includes('topps') && (lowerSet.includes('series') || lowerSet.includes('chrome'))) return 'High';
    if (lowerBrand.includes('panini') && lowerSet.includes('prizm')) return 'High';
    if (lowerBrand.includes('bowman') && lowerSet.includes('chrome')) return 'High';
    
    // Medium popularity
    if (lowerBrand.includes('topps') || lowerBrand.includes('panini') || lowerBrand.includes('bowman')) return 'Medium';
    
    return 'Low';
  }

  estimateCardCount(setType, set) {
    const lowerSet = set.toLowerCase();
    
    if (lowerSet.includes('series')) return 400;
    if (lowerSet.includes('chrome')) return 220;
    if (lowerSet.includes('prizm')) return 300;
    if (lowerSet.includes('select')) return 250;
    if (lowerSet.includes('mosaic')) return 280;
    if (lowerSet.includes('optic')) return 200;
    if (lowerSet.includes('finest')) return 200;
    if (lowerSet.includes('update')) return 300;
    if (lowerSet.includes('heritage')) return 500;
    if (lowerSet.includes('bowman')) return 500;
    if (lowerSet.includes('draft')) return 150;
    if (lowerSet.includes('prospects')) return 200;
    
    return 250; // Default
  }

  estimatePricing(setType, popularity) {
    let retailPrice = 4.99;
    let hobbyPrice = 89.99;
    
    if (popularity === 'High') {
      if (setType.includes('Chrome') || setType.includes('Prizm')) {
        retailPrice = 6.99;
        hobbyPrice = 129.99;
      } else if (setType.includes('Finest') || setType.includes('Select')) {
        retailPrice = 5.99;
        hobbyPrice = 109.99;
      }
    } else if (popularity === 'Low') {
      retailPrice = 3.99;
      hobbyPrice = 69.99;
    }
    
    return { retailPrice, hobbyPrice };
  }

  estimateReleaseMonth(setType, set) {
    const lowerSet = set.toLowerCase();
    
    if (lowerSet.includes('series one')) return 'February';
    if (lowerSet.includes('series two')) return 'June';
    if (lowerSet.includes('update')) return 'October';
    if (lowerSet.includes('chrome')) return 'August';
    if (lowerSet.includes('bowman')) return 'May';
    if (lowerSet.includes('heritage')) return 'March';
    if (lowerSet.includes('stadium club')) return 'December';
    if (lowerSet.includes('gallery')) return 'November';
    
    return 'Unknown';
  }

  hasRookieCards(set, setType) {
    const lowerSet = set.toLowerCase();
    
    if (setType.includes('Prospect') || setType.includes('Rookie')) return true;
    if (lowerSet.includes('bowman') || lowerSet.includes('draft') || lowerSet.includes('prospects')) return true;
    if (lowerSet.includes('series') || lowerSet.includes('update')) return true;
    
    return 'Unknown';
  }

  determineInsertsAndVariations(setType, set) {
    const lowerSet = set.toLowerCase();
    let inserts = ['Parallels'];
    let variations = ['Photo Variations'];
    
    if (lowerSet.includes('chrome') || lowerSet.includes('prizm')) {
      inserts.push('Refractors', 'Autographs', 'Relics', 'Numbered');
      variations.push('Refractor Parallels', 'SP', 'SSP', 'Superfractors');
    } else if (lowerSet.includes('finest') || lowerSet.includes('select')) {
      inserts.push('Refractors', 'Autographs', 'Relics');
      variations.push('Refractor Parallels', 'SP', 'SSP');
    } else if (lowerSet.includes('bowman')) {
      inserts.push('Prospects', 'Autographs', 'Relics');
      variations.push('Photo Variations', 'SP', 'SSP', 'Chrome');
    } else if (lowerSet.includes('heritage')) {
      inserts.push('Autographs', 'Relics', 'Vintage');
      variations.push('Color Variations', 'SP', 'SSP', 'Chrome');
    } else {
      inserts.push('Inserts', 'Autographs', 'Relics');
      variations.push('SP', 'SSP');
    }
    
    return { inserts, variations };
  }

  async buildDatabase() {
    console.log('🏗️ BUILDING COMPREHENSIVE CARD SET DATABASE\n');
    
    try {
      // Load existing database
      const existingDatabase = await this.loadExistingDatabase();
      
      // Get GetCardBase data
      console.log('📡 Fetching data from GetCardBase API...');
      const buildResult = await getCardBaseService.buildCardSetDatabase();
      
      if (!buildResult.success) {
        throw new Error(`Failed to build GetCardBase database: ${buildResult.error}`);
      }
      
      console.log(`✅ Retrieved ${buildResult.totalSets} card set combinations from GetCardBase`);
      
      // Create enhanced card sets
      const enhancedCardSets = [];
      const processedCombinations = new Set();
      
      buildResult.cardSets.forEach(cardSet => {
        const combination = `${cardSet.brand}-${cardSet.set}-${cardSet.year}`;
        
        if (!processedCombinations.has(combination)) {
          processedCombinations.add(combination);
          
          const enhancedSet = this.createCardSet(
            cardSet.brand,
            cardSet.set,
            cardSet.year,
            cardSet.sport,
            cardSet.league
          );
          
          enhancedCardSets.push(enhancedSet);
        }
      });
      
      console.log(`🎯 Created ${enhancedCardSets.length} enhanced card sets`);
      
      // Combine with existing manual data
      const existingManualSets = existingDatabase.cardSets.filter(set => set.source === 'manual');
      const allCardSets = [...existingManualSets, ...enhancedCardSets];
      
      // Remove duplicates based on name
      const uniqueCardSets = allCardSets.filter((set, index, self) => 
        index === self.findIndex(s => s.name === set.name)
      );
      
      console.log(`📊 Final database: ${uniqueCardSets.length} unique card sets`);
      console.log(`   Manual sets: ${existingManualSets.length}`);
      console.log(`   GetCardBase sets: ${enhancedCardSets.length}`);
      console.log(`   Duplicates removed: ${allCardSets.length - uniqueCardSets.length}`);
      
      // Save the database
      const finalDatabase = {
        cardSets: uniqueCardSets,
        metadata: {
          lastUpdated: new Date().toISOString(),
          totalSets: uniqueCardSets.length,
          sources: ['getcardbase', 'manual'],
          version: '1.0'
        }
      };
      
      await this.saveDatabase(finalDatabase);
      
      // Print summary
      console.log('\n📋 DATABASE BUILD SUMMARY:');
      console.log('='.repeat(50));
      console.log(`Total Card Sets: ${uniqueCardSets.length}`);
      console.log(`Brands: ${this.getUniqueValues(uniqueCardSets, 'brand').length}`);
      console.log(`Years: ${this.getUniqueValues(uniqueCardSets, 'year').length}`);
      console.log(`Sports: ${this.getUniqueValues(uniqueCardSets, 'sport').length}`);
      console.log(`Set Types: ${this.getUniqueValues(uniqueCardSets, 'setType').length}`);
      console.log(`Sources: ${this.getUniqueValues(uniqueCardSets, 'source').join(', ')}`);
      
      return {
        success: true,
        totalSets: uniqueCardSets.length,
        manualSets: existingManualSets.length,
        getCardBaseSets: enhancedCardSets.length,
        duplicatesRemoved: allCardSets.length - uniqueCardSets.length
      };
      
    } catch (error) {
      console.error('❌ Error building database:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Run the database builder
async function main() {
  const builder = new CardSetDatabaseBuilder();
  const result = await builder.buildDatabase();
  
  if (result.success) {
    console.log('\n✅ Database build completed successfully!');
    console.log(`📁 Database saved to: ${builder.databasePath}`);
    console.log(`📊 Stats saved to: ${builder.statsPath}`);
  } else {
    console.error('\n❌ Database build failed:', result.error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main()
    .then(() => {
      console.log('\n🎯 Database builder finished!');
      process.exit(0);
    })
    .catch(err => {
      console.error('💥 Database builder failed:', err.message);
      process.exit(1);
    });
}

module.exports = CardSetDatabaseBuilder; 