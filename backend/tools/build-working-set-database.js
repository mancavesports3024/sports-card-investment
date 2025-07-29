const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

async function buildWorkingSetDatabase() {
  console.log('🏗️ BUILDING WORKING SET DATABASE\n');
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
    metadata: {
      lastUpdated: new Date().toISOString(),
      source: 'getcardbase_api',
      totalSets: 0,
      method: 'working_endpoints'
    }
  };

  try {
    // Method 1: Get all sets (this worked in our previous tests)
    console.log('📡 Method 1: Getting all sets...');
    try {
      const setsResponse = await axios.get(`${baseURL}/categories/1/search_schemas/3/search?for_attributes=true&per=200&page=1&target_name=external[43]&target_type=Collectibles::Property&target_id=2&search_schema_id=3&category_id=1`, { headers });
      
      if (setsResponse.data?.results?.length > 0) {
        console.log(`✅ Found ${setsResponse.data.results.length} sets`);
        
        // Process and categorize the sets
        const allSets = setsResponse.data.results.map(set => ({
          id: set.id,
          name: set.text,
          originalText: set.text
        }));

        // Categorize sets by sport and year
        const categorizedSets = categorizeSets(allSets);
        
        setDatabase.sets = categorizedSets;
        setDatabase.metadata.totalSets = categorizedSets.length;
        
        console.log(`📋 Categorized into ${categorizedSets.length} sets`);
        
        // Show sample categorized sets
        console.log('\n📋 Sample Categorized Sets:');
        categorizedSets.slice(0, 10).forEach((set, index) => {
          console.log(`  ${index + 1}. ${set.sport} ${set.year} - ${set.brand} ${set.setName}`);
        });

      } else {
        console.log('❌ No sets found');
      }
    } catch (error) {
      console.log(`❌ Method 1 failed: ${error.response?.status || error.message}`);
    }

    // Method 2: Get all variations (this also worked)
    console.log('\n📡 Method 2: Getting all variations...');
    try {
      const variationsResponse = await axios.get(`${baseURL}/categories/1/search_schemas/3/search?for_attributes=true&per=200&page=1&target_name=external[44]&target_type=Collectibles::Property&target_id=3&search_schema_id=3&category_id=1`, { headers });
      
      if (variationsResponse.data?.results?.length > 0) {
        console.log(`✅ Found ${variationsResponse.data.results.length} variations`);
        
        // Add variations to our database
        const variations = variationsResponse.data.results.map(variation => ({
          id: variation.id,
          name: variation.text,
          type: 'variation'
        }));

        setDatabase.variations = variations;
        setDatabase.metadata.totalVariations = variations.length;
        
        console.log(`📋 Added ${variations.length} variations`);
        
        // Show sample variations
        console.log('\n📋 Sample Variations:');
        variations.slice(0, 10).forEach((variation, index) => {
          console.log(`  ${index + 1}. ${variation.name}`);
        });
      }
    } catch (error) {
      console.log(`❌ Method 2 failed: ${error.response?.status || error.message}`);
    }

    // Save the database
    const databasePath = path.join(__dirname, '../data/workingSetDatabase.json');
    console.log('\n💾 Saving working set database...');
    await fs.writeFile(databasePath, JSON.stringify(setDatabase, null, 2));

    // Create a summary
    const summaryPath = path.join(__dirname, '../data/workingSetSummary.json');
    const summary = {
      lastUpdated: setDatabase.metadata.lastUpdated,
      totalSets: setDatabase.metadata.totalSets,
      totalVariations: setDatabase.metadata.totalVariations || 0,
      sports: [...new Set(setDatabase.sets.map(s => s.sport))],
      years: [...new Set(setDatabase.sets.map(s => s.year))],
      brands: [...new Set(setDatabase.sets.map(s => s.brand))]
    };
    
    await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2));

    console.log('\n📋 WORKING SET DATABASE SUMMARY:');
    console.log('='.repeat(50));
    console.log(`Total Sets: ${setDatabase.metadata.totalSets}`);
    console.log(`Total Variations: ${setDatabase.metadata.totalVariations || 0}`);
    console.log(`Database saved to: ${databasePath}`);
    console.log(`Summary saved to: ${summaryPath}`);
    
    if (setDatabase.sets.length > 0) {
      console.log('\n📋 Sports found:', summary.sports.join(', '));
      console.log('📋 Years found:', summary.years.join(', '));
      console.log('📋 Brands found:', summary.brands.join(', '));
    }

    return {
      success: true,
      databasePath,
      summaryPath,
      totalSets: setDatabase.metadata.totalSets,
      totalVariations: setDatabase.metadata.totalVariations || 0
    };

  } catch (error) {
    console.error('❌ Error building working set database:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

// Helper function to categorize sets
function categorizeSets(sets) {
  const categorized = [];
  
  sets.forEach(set => {
    const text = set.name.toLowerCase();
    
    // Extract sport
    let sport = 'Unknown';
    if (text.includes('baseball') || text.includes('mlb')) sport = 'Baseball';
    else if (text.includes('basketball') || text.includes('nba')) sport = 'Basketball';
    else if (text.includes('football') || text.includes('nfl')) sport = 'Football';
    else if (text.includes('hockey') || text.includes('nhl')) sport = 'Hockey';
    else if (text.includes('soccer') || text.includes('fifa')) sport = 'Soccer';
    else if (text.includes('boxing')) sport = 'Boxing';
    else if (text.includes('golf')) sport = 'Golf';
    else if (text.includes('mma') || text.includes('ufc')) sport = 'MMA';
    else if (text.includes('racing') || text.includes('nascar')) sport = 'Racing';
    else if (text.includes('tennis')) sport = 'Tennis';
    else if (text.includes('wrestling') || text.includes('wwe')) sport = 'Wrestling';
    else if (text.includes('multi') || text.includes('panini')) sport = 'Multi-Sport';
    
    // Extract year
    let year = 'Unknown';
    const yearMatch = text.match(/(19|20)\d{2}/);
    if (yearMatch) year = yearMatch[0];
    
    // Extract brand
    let brand = 'Unknown';
    if (text.includes('topps')) brand = 'Topps';
    else if (text.includes('panini')) brand = 'Panini';
    else if (text.includes('upper deck')) brand = 'Upper Deck';
    else if (text.includes('bowman')) brand = 'Bowman';
    else if (text.includes('donruss')) brand = 'Donruss';
    else if (text.includes('fleer')) brand = 'Fleer';
    else if (text.includes('score')) brand = 'Score';
    
    // Extract set name
    let setName = set.name;
    if (brand !== 'Unknown') {
      setName = setName.replace(new RegExp(brand, 'gi'), '').trim();
    }
    
    categorized.push({
      id: set.id,
      name: set.name,
      sport,
      year,
      brand,
      setName,
      searchText: `${sport} ${year} ${brand} ${setName}`.toLowerCase()
    });
  });
  
  return categorized;
}

// Run the database builder
buildWorkingSetDatabase()
  .then((result) => {
    if (result.success) {
      console.log('\n✅ Working set database build completed successfully!');
      console.log(`📁 Database: ${result.databasePath}`);
      console.log(`📊 Summary: ${result.summaryPath}`);
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