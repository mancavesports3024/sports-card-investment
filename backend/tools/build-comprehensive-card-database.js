const fs = require('fs').promises;
const path = require('path');

async function buildComprehensiveCardDatabase() {
  console.log('🏗️ BUILDING COMPREHENSIVE CARD DATABASE\n');
  console.log('='.repeat(60));

  const comprehensiveDatabase = {
    sets: [],
    metadata: {
      lastUpdated: new Date().toISOString(),
      source: 'comprehensive_hybrid',
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

    // Generate sport/year combinations from our sport/years data
    console.log('🔍 Generating sport/year combinations...');
    const sportYearCombinations = [];
    
    Object.entries(sportYearsData.sports || {}).forEach(([sportName, sportData]) => {
      // Focus on recent years for efficiency
      const recentYears = sportData.years.filter(year => 
        parseInt(year.name) >= 2020 && parseInt(year.name) <= 2025
      );
      
      recentYears.forEach(yearData => {
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
    console.log(`Database saved to: ${databasePath}`);
    console.log(`Summary saved to: ${summaryPath}`);
    
    console.log('\n📋 Sources:');
    Object.entries(comprehensiveDatabase.metadata.sources).forEach(([source, count]) => {
      console.log(`  ${source}: ${count} sets`);
    });
    
    console.log('\n📋 Sports:', summary.sports.join(', '));
    console.log('📋 Years:', summary.years.join(', '));
    console.log('📋 Brands:', summary.brands.join(', '));

    return {
      success: true,
      databasePath,
      summaryPath,
      totalSets: comprehensiveDatabase.metadata.totalSets
    };

  } catch (error) {
    console.error('❌ Error building comprehensive database:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

// Helper function to generate common sets for a sport/year
function generateCommonSets(sport, year) {
  const commonSets = [];
  
  if (sport === 'Baseball') {
    commonSets.push('Series One', 'Series Two', 'Update', 'Chrome', 'Chrome Update', 'Heritage', 'Archives', 'Gypsy Queen', 'Allen & Ginter', 'Stadium Club', 'Bowman', 'Bowman Chrome', 'Bowman Draft', 'Topps Finest', 'Topps Tribute', 'Topps Triple Threads', 'Topps Tier One', 'Topps Transcendent', 'Topps Dynasty', 'Topps Museum Collection');
  } else if (sport === 'Basketball') {
    commonSets.push('Prizm', 'Mosaic', 'Select', 'Optic', 'Donruss', 'Hoops', 'Chronicles', 'Contenders', 'Immaculate', 'National Treasures', 'Flawless', 'Panini One', 'Crown Royale', 'Threads', 'Prestige', 'Elite', 'Spectra', 'Revolutions', 'Phoenix', 'Obsidian');
  } else if (sport === 'Football') {
    commonSets.push('Prizm', 'Mosaic', 'Select', 'Optic', 'Donruss', 'Score', 'Chronicles', 'Contenders', 'Immaculate', 'National Treasures', 'Flawless', 'Panini One', 'Crown Royale', 'Threads', 'Prestige', 'Elite', 'Spectra', 'Revolutions', 'Phoenix', 'Obsidian');
  } else if (sport === 'Hockey') {
    commonSets.push('Series One', 'Series Two', 'Young Guns', 'Artifacts', 'SP Game Used', 'SP Authentic', 'The Cup', 'Premier', 'Ice', 'Black Diamond', 'OPC', 'OPC Platinum', 'MVP', 'Parkhurst', 'Victory', 'Collector\'s Choice', 'Pinnacle', 'Score', 'Fleer', 'Topps');
  }
  
  return commonSets;
}

// Helper function to get brand from set name
function getBrandFromSetName(setName) {
  const lowerSetName = setName.toLowerCase();
  
  if (lowerSetName.includes('topps') || lowerSetName.includes('bowman') || lowerSetName.includes('heritage') || lowerSetName.includes('archives') || lowerSetName.includes('gypsy') || lowerSetName.includes('allen') || lowerSetName.includes('stadium') || lowerSetName.includes('finest') || lowerSetName.includes('tribute') || lowerSetName.includes('triple') || lowerSetName.includes('tier') || lowerSetName.includes('transcendent') || lowerSetName.includes('dynasty') || lowerSetName.includes('museum')) {
    return 'Topps';
  } else if (lowerSetName.includes('panini') || lowerSetName.includes('prizm') || lowerSetName.includes('mosaic') || lowerSetName.includes('select') || lowerSetName.includes('optic') || lowerSetName.includes('donruss') || lowerSetName.includes('hoops') || lowerSetName.includes('chronicles') || lowerSetName.includes('contenders') || lowerSetName.includes('immaculate') || lowerSetName.includes('national') || lowerSetName.includes('flawless') || lowerSetName.includes('crown') || lowerSetName.includes('threads') || lowerSetName.includes('prestige') || lowerSetName.includes('elite') || lowerSetName.includes('spectra') || lowerSetName.includes('revolutions') || lowerSetName.includes('phoenix') || lowerSetName.includes('obsidian')) {
    return 'Panini';
  } else if (lowerSetName.includes('upper deck') || lowerSetName.includes('young guns') || lowerSetName.includes('artifacts') || lowerSetName.includes('sp game') || lowerSetName.includes('sp authentic') || lowerSetName.includes('cup') || lowerSetName.includes('premier') || lowerSetName.includes('ice') || lowerSetName.includes('black diamond') || lowerSetName.includes('opc') || lowerSetName.includes('mvp') || lowerSetName.includes('parkhurst') || lowerSetName.includes('victory') || lowerSetName.includes('collector') || lowerSetName.includes('pinnacle') || lowerSetName.includes('score') || lowerSetName.includes('fleer')) {
    return 'Upper Deck';
  }
  
  return 'Unknown';
}

// Run the database builder
buildComprehensiveCardDatabase()
  .then((result) => {
    if (result.success) {
      console.log('\n✅ Comprehensive card database build completed successfully!');
      console.log(`📁 Database: ${result.databasePath}`);
      console.log(`📊 Summary: ${result.summaryPath}`);
      console.log(`🏈 Total Sets: ${result.totalSets}`);
    } else {
      console.error('\n❌ Database build failed:', result.error);
      process.exit(1);
    }
  })
  .catch(err => {
    console.error('💥 Database build failed:', err.message);
    process.exit(1);
  }); 