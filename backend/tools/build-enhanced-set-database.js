const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

async function buildEnhancedSetDatabase() {
  console.log('🏗️ BUILDING ENHANCED SET DATABASE\n');
  console.log('='.repeat(60));
  
  const baseURL = 'https://api.getcardbase.com/collectibles/api/mobile/v1';
  const headers = {
    'Access-Token': 'mznaudGBg2ne0pZCEq3kMg',
    'AppPlatform': 'web',
    'AppVersion': '4.2.8',
    'Client': 'hVAqzdkcIWuA9T6K9reEeQ',
    'Expiry': '1754949936',
    'Origin': 'https://collectibles.com',
    'Referer': 'https://collectibles.com/',
    'Token-Type': 'Bearer',
    'Uid': 'cgcardsfan2011@gmail.com',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
  };

  const setDatabase = {
    sets: [],
    variations: [],
    metadata: {
      lastUpdated: new Date().toISOString(),
      source: 'getcardbase_api',
      totalSets: 0,
      totalVariations: 0,
      method: 'enhanced_categorization'
    }
  };

  try {
    // Get multiple pages of sets
    console.log('📡 Getting comprehensive sets data...');
    const allSets = [];
    let page = 1;
    const maxPages = 10; // Get up to 1000 sets

    while (page <= maxPages) {
      try {
        console.log(`  📄 Fetching page ${page}...`);
        const setsResponse = await axios.get(`${baseURL}/categories/1/search_schemas/3/search?for_attributes=true&per=100&page=${page}&target_name=external[43]&target_type=Collectibles::Property&target_id=2&search_schema_id=3&category_id=1`, { headers });
        
        if (setsResponse.data?.results?.length > 0) {
          allSets.push(...setsResponse.data.results);
          console.log(`    ✅ Got ${setsResponse.data.results.length} sets (total: ${allSets.length})`);
          
          if (setsResponse.data.results.length < 100) {
            console.log('    📄 Reached end of data');
            break;
          }
          
          page++;
          await new Promise(resolve => setTimeout(resolve, 200)); // Small delay
        } else {
          console.log('    📄 No more data');
          break;
        }
      } catch (error) {
        console.log(`    ❌ Page ${page} failed: ${error.response?.status || error.message}`);
        break;
      }
    }

    console.log(`\n📋 Total sets collected: ${allSets.length}`);

    // Get multiple pages of variations
    console.log('\n📡 Getting comprehensive variations data...');
    const allVariations = [];
    page = 1;

    while (page <= maxPages) {
      try {
        console.log(`  📄 Fetching page ${page}...`);
        const variationsResponse = await axios.get(`${baseURL}/categories/1/search_schemas/3/search?for_attributes=true&per=100&page=${page}&target_name=external[44]&target_type=Collectibles::Property&target_id=3&search_schema_id=3&category_id=1`, { headers });
        
        if (variationsResponse.data?.results?.length > 0) {
          allVariations.push(...variationsResponse.data.results);
          console.log(`    ✅ Got ${variationsResponse.data.results.length} variations (total: ${allVariations.length})`);
          
          if (variationsResponse.data.results.length < 100) {
            console.log('    📄 Reached end of data');
            break;
          }
          
          page++;
          await new Promise(resolve => setTimeout(resolve, 200)); // Small delay
        } else {
          console.log('    📄 No more data');
          break;
        }
      } catch (error) {
        console.log(`    ❌ Page ${page} failed: ${error.response?.status || error.message}`);
        break;
      }
    }

    console.log(`\n📋 Total variations collected: ${allVariations.length}`);

    // Enhanced categorization of sets
    console.log('\n🔍 Enhanced categorization of sets...');
    const categorizedSets = enhancedCategorizeSets(allSets);
    setDatabase.sets = categorizedSets;
    setDatabase.metadata.totalSets = categorizedSets.length;

    // Process variations
    console.log('\n🔍 Processing variations...');
    const processedVariations = allVariations.map(variation => ({
      id: variation.id,
      name: variation.text,
      type: 'variation',
      category: categorizeVariation(variation.text)
    }));
    setDatabase.variations = processedVariations;
    setDatabase.metadata.totalVariations = processedVariations.length;

    // Save the database
    const databasePath = path.join(__dirname, '../data/enhancedSetDatabase.json');
    console.log('\n💾 Saving enhanced set database...');
    await fs.writeFile(databasePath, JSON.stringify(setDatabase, null, 2));

    // Create a comprehensive summary
    const summaryPath = path.join(__dirname, '../data/enhancedSetSummary.json');
    const summary = createSummary(setDatabase);
    await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2));

    // Create a searchable flat list
    const flatListPath = path.join(__dirname, '../data/enhancedSetFlatList.json');
    const flatList = createFlatList(setDatabase);
    await fs.writeFile(flatListPath, JSON.stringify(flatList, null, 2));

    console.log('\n📋 ENHANCED SET DATABASE SUMMARY:');
    console.log('='.repeat(50));
    console.log(`Total Sets: ${setDatabase.metadata.totalSets}`);
    console.log(`Total Variations: ${setDatabase.metadata.totalVariations}`);
    console.log(`Database saved to: ${databasePath}`);
    console.log(`Summary saved to: ${summaryPath}`);
    console.log(`Flat list saved to: ${flatListPath}`);
    
    console.log('\n📋 Sports found:', summary.sports.join(', '));
    console.log('📋 Years found:', summary.years.slice(0, 10).join(', ') + (summary.years.length > 10 ? '...' : ''));
    console.log('📋 Brands found:', summary.brands.join(', '));
    console.log('📋 Variation categories:', summary.variationCategories.join(', '));

    return {
      success: true,
      databasePath,
      summaryPath,
      flatListPath,
      totalSets: setDatabase.metadata.totalSets,
      totalVariations: setDatabase.metadata.totalVariations
    };

  } catch (error) {
    console.error('❌ Error building enhanced set database:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

// Enhanced categorization function
function enhancedCategorizeSets(sets) {
  const categorized = [];
  
  sets.forEach(set => {
    if (!set.text) {
      console.log('⚠️ Skipping set with no text:', set);
      return;
    }
    
    const text = set.text.toLowerCase();
    
    // Enhanced sport detection
    let sport = 'Unknown';
    if (text.includes('baseball') || text.includes('mlb') || text.includes('topps') && !text.includes('basketball') && !text.includes('football')) sport = 'Baseball';
    else if (text.includes('basketball') || text.includes('nba') || text.includes('panini') && text.includes('basketball')) sport = 'Basketball';
    else if (text.includes('football') || text.includes('nfl') || text.includes('panini') && text.includes('football')) sport = 'Football';
    else if (text.includes('hockey') || text.includes('nhl') || text.includes('upper deck') && text.includes('hockey')) sport = 'Hockey';
    else if (text.includes('soccer') || text.includes('fifa')) sport = 'Soccer';
    else if (text.includes('boxing')) sport = 'Boxing';
    else if (text.includes('golf')) sport = 'Golf';
    else if (text.includes('mma') || text.includes('ufc')) sport = 'MMA';
    else if (text.includes('racing') || text.includes('nascar')) sport = 'Racing';
    else if (text.includes('tennis')) sport = 'Tennis';
    else if (text.includes('wrestling') || text.includes('wwe')) sport = 'Wrestling';
    else if (text.includes('multi') || text.includes('panini') && !text.includes('basketball') && !text.includes('football')) sport = 'Multi-Sport';
    
    // Enhanced year detection
    let year = 'Unknown';
    const yearMatch = text.match(/(19|20)\d{2}/);
    if (yearMatch) year = yearMatch[0];
    
    // Enhanced brand detection
    let brand = 'Unknown';
    if (text.includes('topps')) brand = 'Topps';
    else if (text.includes('panini')) brand = 'Panini';
    else if (text.includes('upper deck')) brand = 'Upper Deck';
    else if (text.includes('bowman')) brand = 'Bowman';
    else if (text.includes('donruss')) brand = 'Donruss';
    else if (text.includes('fleer')) brand = 'Fleer';
    else if (text.includes('score')) brand = 'Score';
    else if (text.includes('leaf')) brand = 'Leaf';
    else if (text.includes('skybox')) brand = 'Skybox';
    
    // Enhanced set name extraction
    let setName = set.text;
    if (brand !== 'Unknown') {
      setName = setName.replace(new RegExp(brand, 'gi'), '').trim();
    }
    
    // Remove common suffixes
    setName = setName.replace(/\s+(baseball|basketball|football|hockey|soccer|boxing|golf|mma|racing|tennis|wrestling)/gi, '');
    
    categorized.push({
      id: set.id,
      name: set.text,
      sport,
      year,
      brand,
      setName,
      searchText: `${sport} ${year} ${brand} ${setName}`.toLowerCase(),
      originalText: set.text
    });
  });
  
  return categorized;
}

// Categorize variations
function categorizeVariation(variationText) {
  const text = variationText.toLowerCase();
  
  if (text.includes('autograph') || text.includes('auto')) return 'Autograph';
  if (text.includes('relic') || text.includes('patch') || text.includes('jersey')) return 'Relic';
  if (text.includes('refractor') || text.includes('chrome')) return 'Refractor';
  if (text.includes('parallel') || text.includes('variation')) return 'Parallel';
  if (text.includes('insert') || text.includes('insert')) return 'Insert';
  if (text.includes('rookie') || text.includes('rc')) return 'Rookie';
  if (text.includes('numbered') || text.includes('#')) return 'Numbered';
  if (text.includes('printing plate') || text.includes('plate')) return 'Printing Plate';
  if (text.includes('memorabilia') || text.includes('mem')) return 'Memorabilia';
  
  return 'Other';
}

// Create summary
function createSummary(database) {
  const sports = [...new Set(database.sets.map(s => s.sport))].filter(s => s !== 'Unknown');
  const years = [...new Set(database.sets.map(s => s.year))].filter(y => y !== 'Unknown').sort();
  const brands = [...new Set(database.sets.map(s => s.brand))].filter(b => b !== 'Unknown');
  const variationCategories = [...new Set(database.variations.map(v => v.category))];

  return {
    lastUpdated: database.metadata.lastUpdated,
    totalSets: database.metadata.totalSets,
    totalVariations: database.metadata.totalVariations,
    sports,
    years,
    brands,
    variationCategories,
    sportBreakdown: sports.map(sport => ({
      sport,
      count: database.sets.filter(s => s.sport === sport).length
    })),
    brandBreakdown: brands.map(brand => ({
      brand,
      count: database.sets.filter(s => s.brand === brand).length
    }))
  };
}

// Create flat list for searching
function createFlatList(database) {
  const flatList = [];
  
  // Add sets
  database.sets.forEach(set => {
    flatList.push({
      id: set.id,
      name: set.name,
      type: 'set',
      sport: set.sport,
      year: set.year,
      brand: set.brand,
      setName: set.setName,
      searchText: `${set.sport} ${set.year} ${set.brand} ${set.setName}`.toLowerCase()
    });
  });
  
  // Add variations
  database.variations.forEach(variation => {
    flatList.push({
      id: variation.id,
      name: variation.name,
      type: 'variation',
      category: variation.category,
      searchText: variation.name.toLowerCase()
    });
  });
  
  return flatList;
}

// Run the database builder
buildEnhancedSetDatabase()
  .then((result) => {
    if (result.success) {
      console.log('\n✅ Enhanced set database build completed successfully!');
      console.log(`📁 Database: ${result.databasePath}`);
      console.log(`📊 Summary: ${result.summaryPath}`);
      console.log(`📋 Flat List: ${result.flatListPath}`);
      console.log(`🏈 Total Sets: ${result.totalSets}`);
      console.log(`🎨 Total Variations: ${result.totalVariations}`);
    } else {
      console.error('\n❌ Database build failed:', result.error);
      process.exit(1);
    }
  })
  .catch(err => {
    console.error('💥 Database build failed:', err.message);
    process.exit(1);
  }); 