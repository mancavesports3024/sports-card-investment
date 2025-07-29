const fs = require('fs').promises;
const path = require('path');

async function buildComprehensiveCardDatabaseComplete() {
  console.log('🏗️ BUILDING COMPREHENSIVE CARD DATABASE (COMPLETE VERSION)\n');
  console.log('='.repeat(70));

  const comprehensiveDatabase = {
    sets: [],
    metadata: {
      lastUpdated: new Date().toISOString(),
      source: 'comprehensive_complete',
      totalSets: 0,
      sources: {
        enhanced: 0,
        existing: 0,
        sportYears: 0,
        inline: 0
      }
    }
  };

  try {
    // Load enhanced database (GetCardBase sets)
    let enhancedSets = [];
    try {
      const enhancedPath = path.join(__dirname, '../data/enhancedSetFlatList.json');
      const enhancedData = await fs.readFile(enhancedPath, 'utf8');
      const enhancedDatabase = JSON.parse(enhancedData);
      enhancedSets = enhancedDatabase.filter(item => item.type === 'set');
      console.log(`✅ Loaded ${enhancedSets.length} enhanced sets`);
    } catch (error) {
      console.log('⚠️ Could not load enhanced database');
    }

    // Load existing database
    let existingSets = [];
    try {
      const existingPath = path.join(__dirname, '../data/cardSetsDatabase.json');
      const existingData = await fs.readFile(existingPath, 'utf8');
      const existingDatabase = JSON.parse(existingData);
      existingSets = Array.isArray(existingDatabase) ? existingDatabase : (existingDatabase.sets || []);
      console.log(`✅ Loaded ${existingSets.length} existing sets`);
    } catch (error) {
      console.log('⚠️ Could not load existing database');
    }

    // Load sport/years database
    let sportYearsData = {};
    try {
      const sportYearsPath = path.join(__dirname, '../data/sportYearsDatabase.json');
      const sportYearsContent = await fs.readFile(sportYearsPath, 'utf8');
      sportYearsData = JSON.parse(sportYearsContent);
      console.log(`✅ Loaded sport/years data for ${Object.keys(sportYearsData.sports).length} sports`);
    } catch (error) {
      console.log('⚠️ Could not load sport/years database');
    }

    // Process enhanced sets (GetCardBase data)
    console.log('\n🔍 Processing enhanced sets...');
    const processedEnhancedSets = enhancedSets.map(set => ({
      id: set.id,
      name: set.name,
      sport: set.sport,
      year: set.year,
      brand: set.brand,
      setName: set.setName,
      source: 'getcardbase',
      searchText: set.searchText,
      displayName: `${set.sport} ${set.year} ${set.brand} ${set.setName}`.trim()
    }));

    comprehensiveDatabase.sets.push(...processedEnhancedSets);
    comprehensiveDatabase.metadata.sources.enhanced = processedEnhancedSets.length;

    // Process existing sets
    console.log('🔍 Processing existing sets...');
    const processedExistingSets = existingSets.map(set => ({
      id: `existing_${set.sport}_${set.year}_${set.brand}_${set.setName}`,
      name: set.setName,
      sport: set.sport,
      year: set.year,
      brand: set.brand,
      setName: set.setName,
      source: 'existing',
      searchText: `${set.sport} ${set.year} ${set.brand} ${set.setName}`.toLowerCase(),
      displayName: `${set.sport} ${set.year} ${set.brand} ${set.setName}`.trim()
    }));

    comprehensiveDatabase.sets.push(...processedExistingSets);
    comprehensiveDatabase.metadata.sources.existing = processedExistingSets.length;

    // Generate sport/year combinations from our sport/years data - USE ALL YEARS
    console.log('🔍 Generating sport/year combinations (ALL YEARS)...');
    const sportYearCombinations = [];
    
    Object.entries(sportYearsData.sports || {}).forEach(([sportName, sportData]) => {
      // Use ALL years, not just recent ones
      const allYears = sportData.years;
      console.log(`  Processing ${sportName}: ${allYears.length} years (${allYears[0]?.name} - ${allYears[allYears.length-1]?.name})`);
      
      allYears.forEach(yearData => {
        // Generate common set names for this sport/year
        const commonSets = generateCommonSets(sportName, yearData.name);
        
        commonSets.forEach(setName => {
          sportYearCombinations.push({
            id: `generated_${sportName}_${yearData.name}_${setName}`,
            name: setName,
            sport: sportName,
            year: yearData.name,
            brand: getBrandFromSetName(setName),
            setName: setName,
            source: 'generated',
            searchText: `${sportName} ${yearData.name} ${setName}`.toLowerCase(),
            displayName: `${sportName} ${yearData.name} ${getBrandFromSetName(setName)} ${setName}`.trim()
          });
        });
      });
    });

    comprehensiveDatabase.sets.push(...sportYearCombinations);
    comprehensiveDatabase.metadata.sources.sportYears = sportYearCombinations.length;

    // Add inline suggestions
    console.log('🔍 Adding inline suggestions...');
    const inlineSuggestions = [
      { id: 'inline_1', name: 'Series One', sport: 'Baseball', year: '2025', brand: 'Topps', setName: 'Series One', source: 'inline', displayName: 'Baseball 2025 Topps Series One' },
      { id: 'inline_2', name: 'Chrome', sport: 'Baseball', year: '2024', brand: 'Topps', setName: 'Chrome', source: 'inline', displayName: 'Baseball 2024 Topps Chrome' },
      { id: 'inline_3', name: 'Prizm', sport: 'Basketball', year: '2024', brand: 'Panini', setName: 'Prizm', source: 'inline', displayName: 'Basketball 2024 Panini Prizm' },
      { id: 'inline_4', name: 'Optic', sport: 'Football', year: '2024', brand: 'Donruss', setName: 'Optic', source: 'inline', displayName: 'Football 2024 Donruss Optic' },
      { id: 'inline_5', name: 'Series One', sport: 'Hockey', year: '2024', brand: 'Upper Deck', setName: 'Series One', source: 'inline', displayName: 'Hockey 2024 Upper Deck Series One' },
      { id: 'inline_6', name: 'Update', sport: 'Baseball', year: '2024', brand: 'Topps', setName: 'Update', source: 'inline', displayName: 'Baseball 2024 Topps Update' },
      { id: 'inline_7', name: 'Chrome Update', sport: 'Baseball', year: '2024', brand: 'Topps', setName: 'Chrome Update', source: 'inline', displayName: 'Baseball 2024 Topps Chrome Update' },
      { id: 'inline_8', name: 'Mosaic', sport: 'Basketball', year: '2024', brand: 'Panini', setName: 'Mosaic', source: 'inline', displayName: 'Basketball 2024 Panini Mosaic' },
      { id: 'inline_9', name: 'Select', sport: 'Football', year: '2024', brand: 'Panini', setName: 'Select', source: 'inline', displayName: 'Football 2024 Panini Select' },
      { id: 'inline_10', name: 'Young Guns', sport: 'Hockey', year: '2024', brand: 'Upper Deck', setName: 'Young Guns', source: 'inline', displayName: 'Hockey 2024 Upper Deck Young Guns' }
    ];

    inlineSuggestions.forEach(suggestion => {
      suggestion.searchText = suggestion.displayName.toLowerCase();
    });

    comprehensiveDatabase.sets.push(...inlineSuggestions);
    comprehensiveDatabase.metadata.sources.inline = inlineSuggestions.length;

    // Remove duplicates and update metadata
    const uniqueSets = [];
    const seen = new Set();
    
    comprehensiveDatabase.sets.forEach(set => {
      const key = `${set.sport}_${set.year}_${set.brand}_${set.setName}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueSets.push(set);
      }
    });

    comprehensiveDatabase.sets = uniqueSets;
    comprehensiveDatabase.metadata.totalSets = uniqueSets.length;

    // Save the database
    const databasePath = path.join(__dirname, '../data/comprehensiveCardDatabase.json');
    console.log('\n💾 Saving comprehensive card database...');
    await fs.writeFile(databasePath, JSON.stringify(comprehensiveDatabase, null, 2));

    // Create a summary
    const summaryPath = path.join(__dirname, '../data/comprehensiveCardSummary.json');
    const summary = {
      lastUpdated: comprehensiveDatabase.metadata.lastUpdated,
      totalSets: comprehensiveDatabase.metadata.totalSets,
      sources: comprehensiveDatabase.metadata.sources,
      sports: [...new Set(comprehensiveDatabase.sets.map(s => s.sport))],
      years: [...new Set(comprehensiveDatabase.sets.map(s => s.year))].sort(),
      brands: [...new Set(comprehensiveDatabase.sets.map(s => s.brand))],
      sportBreakdown: Object.entries(
        comprehensiveDatabase.sets.reduce((acc, set) => {
          acc[set.sport] = (acc[set.sport] || 0) + 1;
          return acc;
        }, {})
      ).map(([sport, count]) => ({ sport, count }))
    };
    
    await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2));

    console.log('\n📋 COMPREHENSIVE CARD DATABASE SUMMARY:');
    console.log('='.repeat(50));
    console.log(`Total Sets: ${comprehensiveDatabase.metadata.totalSets}`);
    console.log(`Sources:`);
    console.log(`  - Enhanced (GetCardBase): ${comprehensiveDatabase.metadata.sources.enhanced}`);
    console.log(`  - Existing: ${comprehensiveDatabase.metadata.sources.existing}`);
    console.log(`  - Generated from Sport/Years: ${comprehensiveDatabase.metadata.sources.sportYears}`);
    console.log(`  - Inline: ${comprehensiveDatabase.metadata.sources.inline}`);
    console.log(`Sports: ${summary.sports.join(', ')}`);
    console.log(`Years: ${summary.years.length} unique years (${summary.years[0]} - ${summary.years[summary.years.length-1]})`);
    console.log(`Brands: ${summary.brands.length} unique brands`);
    
    console.log('\n📊 Sport Breakdown:');
    summary.sportBreakdown.forEach(({ sport, count }) => {
      console.log(`  ${sport}: ${count} sets`);
    });

    console.log('\n✅ Comprehensive card database built successfully!');
    console.log(`📁 Saved to: ${databasePath}`);
    console.log(`📁 Summary saved to: ${summaryPath}`);

  } catch (error) {
    console.error('❌ Error building comprehensive card database:', error);
    throw error;
  }
}

function generateCommonSets(sport, year) {
  const sets = [];
  
  // Baseball sets
  if (sport === 'Baseball') {
    sets.push('Series One', 'Series Two', 'Update', 'Chrome', 'Chrome Update', 'Heritage', 'Stadium Club', 'Allen & Ginter', 'Gypsy Queen', 'Opening Day', 'Big League', 'Fire', 'Finest', 'Tribute', 'Tier One', 'Clearly Authentic', 'On Demand 3D', 'Transcendent Hall of Fame');
  }
  
  // Basketball sets
  else if (sport === 'Basketball') {
    sets.push('Prizm', 'Mosaic', 'Select', 'Optic', 'Donruss', 'Hoops', 'Chronicles', 'Spectra', 'Illusions', 'Contenders Draft Picks', 'Obsidian', 'Flux', 'Crown Royale', 'Phoenix', 'Recon', 'Status', 'Immaculate', 'National Treasures');
  }
  
  // Football sets
  else if (sport === 'Football') {
    sets.push('Prizm', 'Mosaic', 'Select', 'Optic', 'Donruss', 'Hoops', 'Chronicles', 'Spectra', 'Illusions', 'Contenders Draft Picks', 'Obsidian', 'Flux', 'Crown Royale', 'Phoenix', 'Recon', 'Status', 'Immaculate', 'National Treasures', 'Playoff', 'Score', 'Prestige', 'Elite', 'Limited', 'Threads');
  }
  
  // Hockey sets
  else if (sport === 'Hockey') {
    sets.push('Series One', 'Series Two', 'Young Guns', 'Chrome', 'Artifacts', 'SP Game Used', 'SP Authentic', 'The Cup', 'Premier', 'Ice', 'Black Diamond', 'O-Pee-Chee', 'MVP', 'Parkhurst', 'Victory', 'Contenders', 'Synergy', 'Allure', 'Enforcers', 'Fleer Showcase');
  }
  
  // Soccer sets
  else if (sport === 'Soccer') {
    sets.push('Prizm', 'Mosaic', 'Select', 'Donruss', 'Chronicles', 'Obsidian', 'Flux', 'Crown Royale', 'Phoenix', 'Recon', 'Status', 'Immaculate', 'National Treasures');
  }
  
  // Generic sets for other sports
  else {
    sets.push('Series One', 'Chrome', 'Prizm', 'Select', 'Optic', 'Donruss', 'Hoops', 'Chronicles', 'Spectra', 'Illusions', 'Contenders', 'Obsidian', 'Flux', 'Crown Royale', 'Phoenix', 'Recon', 'Status', 'Immaculate', 'National Treasures');
  }
  
  return sets;
}

function getBrandFromSetName(setName) {
  const brandMap = {
    'Series One': 'Topps',
    'Series Two': 'Topps',
    'Update': 'Topps',
    'Chrome': 'Topps',
    'Chrome Update': 'Topps',
    'Heritage': 'Topps',
    'Stadium Club': 'Topps',
    'Allen & Ginter': 'Topps',
    'Gypsy Queen': 'Topps',
    'Opening Day': 'Topps',
    'Big League': 'Topps',
    'Fire': 'Topps',
    'Finest': 'Topps',
    'Tribute': 'Topps',
    'Tier One': 'Topps',
    'Clearly Authentic': 'Topps',
    'On Demand 3D': 'Topps',
    'Transcendent Hall of Fame': 'Topps',
    'Prizm': 'Panini',
    'Mosaic': 'Panini',
    'Select': 'Panini',
    'Optic': 'Donruss',
    'Donruss': 'Donruss',
    'Hoops': 'Panini',
    'Chronicles': 'Panini',
    'Spectra': 'Panini',
    'Illusions': 'Panini',
    'Contenders Draft Picks': 'Panini',
    'Obsidian': 'Panini',
    'Flux': 'Panini',
    'Crown Royale': 'Panini',
    'Phoenix': 'Panini',
    'Recon': 'Panini',
    'Status': 'Panini',
    'Immaculate': 'Panini',
    'National Treasures': 'Panini',
    'Playoff': 'Panini',
    'Score': 'Panini',
    'Prestige': 'Panini',
    'Elite': 'Panini',
    'Limited': 'Panini',
    'Threads': 'Panini',
    'Young Guns': 'Upper Deck',
    'Artifacts': 'Upper Deck',
    'SP Game Used': 'Upper Deck',
    'SP Authentic': 'Upper Deck',
    'The Cup': 'Upper Deck',
    'Premier': 'Upper Deck',
    'Ice': 'Upper Deck',
    'Black Diamond': 'Upper Deck',
    'O-Pee-Chee': 'Upper Deck',
    'MVP': 'Upper Deck',
    'Parkhurst': 'Upper Deck',
    'Victory': 'Upper Deck',
    'Contenders': 'Upper Deck',
    'Synergy': 'Upper Deck',
    'Allure': 'Upper Deck',
    'Enforcers': 'Upper Deck',
    'Fleer Showcase': 'Upper Deck'
  };
  
  return brandMap[setName] || 'Unknown';
}

if (require.main === module) {
  buildComprehensiveCardDatabaseComplete().catch(console.error);
}

module.exports = { buildComprehensiveCardDatabaseComplete };