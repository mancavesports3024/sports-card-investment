const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

async function buildSportIDsDatabase() {
  console.log('🏗️ BUILDING SPORT IDS DATABASE\n');
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

  try {
    const sportDatabase = {
      sports: {},
      metadata: {
        lastUpdated: new Date().toISOString(),
        source: 'getcardbase_api',
        totalSports: 0
      }
    };

    // Method 1: Try to get sports from the working sets endpoint
    console.log('📡 Method 1: Extracting sports from sets data...');
    try {
      const setsResponse = await axios.get(`${baseURL}/categories/1/search_schemas/3/search?for_attributes=true&per=100&page=1&target_name=external[43]&target_type=Collectibles::Property&target_id=2&search_schema_id=3&category_id=1`, { headers });
      
      if (setsResponse.data?.results?.length > 0) {
        console.log(`✅ Found ${setsResponse.data.results.length} sets`);
        
        // Extract sports from set names (common sports in trading cards)
        const commonSports = ['Baseball', 'Basketball', 'Football', 'Hockey', 'Soccer', 'Boxing', 'Golf', 'MMA', 'Racing', 'Tennis', 'Wrestling'];
        
        commonSports.forEach(sport => {
          const matchingSets = setsResponse.data.results.filter(set => 
            set.text.toLowerCase().includes(sport.toLowerCase())
          );
          
          if (matchingSets.length > 0) {
            console.log(`📋 Found ${matchingSets.length} sets for ${sport}`);
            sportDatabase.sports[sport] = {
              name: sport,
              sets: matchingSets.slice(0, 5).map(set => ({
                id: set.id,
                name: set.text
              })),
              setCount: matchingSets.length
            };
          }
        });
      }
    } catch (error) {
      console.log(`❌ Method 1 failed: ${error.message}`);
    }

    // Method 2: Use known sport IDs from previous analysis
    console.log('\n📡 Method 2: Adding known sport IDs...');
    const knownSports = {
      'Baseball': { id: 11, name: 'Baseball' },
      'Basketball': { id: 1, name: 'Basketball' },
      'Football': { id: 1573, name: 'Football' },
      'Hockey': { id: 1946, name: 'Hockey' },
      'Soccer': { id: 2087, name: 'Soccer' },
      'Boxing': { id: 2119, name: 'Boxing' },
      'Golf': { id: 2084, name: 'Golf' },
      'MMA': { id: 958, name: 'MMA' },
      'Multi-Sport': { id: 114879, name: 'Multi-Sport' },
      'Racing': { id: 2588, name: 'Racing' },
      'Tennis': { id: 117408, name: 'Tennis' },
      'Wrestling': { id: 2085, name: 'Wrestling' }
    };

    Object.entries(knownSports).forEach(([sportName, sportData]) => {
      if (!sportDatabase.sports[sportName]) {
        sportDatabase.sports[sportName] = {
          name: sportName,
          id: sportData.id,
          sets: [],
          setCount: 0
        };
      } else {
        sportDatabase.sports[sportName].id = sportData.id;
      }
    });

    // Method 3: Test each known sport ID to get sample sets
    console.log('\n📡 Method 3: Testing known sport IDs for sets...');
    for (const [sportName, sportData] of Object.entries(sportDatabase.sports)) {
      if (sportData.id) {
        console.log(`📡 Testing ${sportName} (ID: ${sportData.id})...`);
        try {
          // Try to get sets for this sport with a sample year
          const setsResponse = await axios.get(`${baseURL}/categories/1/search_schemas/3/search?for_attributes=true&per=20&page=1&target_name=external[43]&target_type=Collectibles::Property&target_id=2&search_schema_id=3&category_id=1&external[45]=${sportData.id}&external[42]=3914795`, { headers });
          
          if (setsResponse.data?.results?.length > 0) {
            console.log(`✅ Found ${setsResponse.data.results.length} sets for ${sportName}`);
            sportDatabase.sports[sportName].sets = setsResponse.data.results.slice(0, 10).map(set => ({
              id: set.id,
              name: set.text
            }));
            sportDatabase.sports[sportName].setCount = setsResponse.data.results.length;
          } else {
            console.log(`⚠️ No sets found for ${sportName}`);
          }
          
          // Add a small delay between requests
          await new Promise(resolve => setTimeout(resolve, 200));
          
        } catch (error) {
          console.log(`❌ Failed to get sets for ${sportName}: ${error.response?.status || error.message}`);
        }
      }
    }

    // Update metadata
    sportDatabase.metadata.totalSports = Object.keys(sportDatabase.sports).length;

    // Save the database
    const databasePath = path.join(__dirname, '../data/sportIDsDatabase.json');
    console.log('\n💾 Saving sport IDs database...');
    await fs.writeFile(databasePath, JSON.stringify(sportDatabase, null, 2));

    console.log('\n📋 SPORT IDS DATABASE SUMMARY:');
    console.log('='.repeat(50));
    console.log(`Total Sports: ${sportDatabase.metadata.totalSports}`);
    console.log(`Database saved to: ${databasePath}`);
    
    console.log('\n📋 Sports with IDs:');
    Object.entries(sportDatabase.sports).forEach(([sportName, sportData]) => {
      console.log(`  ${sportName}: ID ${sportData.id || 'Unknown'}, ${sportData.setCount} sets`);
      if (sportData.sets.length > 0) {
        console.log(`    Sample sets: ${sportData.sets.slice(0, 3).map(s => s.name).join(', ')}`);
      }
    });

    // Create a simple summary file
    const summaryPath = path.join(__dirname, '../data/sportIDsSummary.json');
    const summary = {
      lastUpdated: sportDatabase.metadata.lastUpdated,
      totalSports: sportDatabase.metadata.totalSports,
      sports: Object.entries(sportDatabase.sports).map(([name, data]) => ({
        name,
        id: data.id,
        setCount: data.setCount
      }))
    };
    
    await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2));
    console.log(`Summary saved to: ${summaryPath}`);

    return {
      success: true,
      databasePath,
      summaryPath,
      totalSports: sportDatabase.metadata.totalSports
    };

  } catch (error) {
    console.error('❌ Error building sport IDs database:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

// Run the database builder
buildSportIDsDatabase()
  .then((result) => {
    if (result.success) {
      console.log('\n✅ Sport IDs database build completed successfully!');
      console.log(`📁 Database: ${result.databasePath}`);
      console.log(`📊 Summary: ${result.summaryPath}`);
      console.log(`🏈 Total Sports: ${result.totalSports}`);
    } else {
      console.error('\n❌ Database build failed:', result.error);
      process.exit(1);
    }
  })
  .catch(err => {
    console.error('💥 Database build failed:', err.message);
    process.exit(1);
  }); 