const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

async function buildSportYearSetDatabase() {
  console.log('🏗️ BUILDING SPORT/YEAR SET DATABASE\n');
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

  // Load our sport IDs database
  let sportIDs;
  try {
    const sportIDsPath = path.join(__dirname, '../data/sportIDsDatabase.json');
    const sportIDsData = await fs.readFile(sportIDsPath, 'utf8');
    sportIDs = JSON.parse(sportIDsData);
    console.log(`✅ Loaded sport IDs database with ${Object.keys(sportIDs.sports).length} sports`);
  } catch (error) {
    console.log('❌ Could not load sport IDs database, using default sports');
    sportIDs = {
      sports: {
        'Baseball': { id: 11, name: 'Baseball' },
        'Basketball': { id: 1, name: 'Basketball' },
        'Football': { id: 1573, name: 'Football' },
        'Hockey': { id: 1946, name: 'Hockey' }
      }
    };
  }

  // Major years to focus on (2020-2025)
  const targetYears = [
    { id: 3914795, name: '2025' },
    { id: 348057, name: '2024' },
    { id: 5, name: '2023' },
    { id: 196231, name: '2022' },
    { id: 119141, name: '2021' },
    { id: 13, name: '2020' }
  ];

  const setDatabase = {
    sets: {},
    metadata: {
      lastUpdated: new Date().toISOString(),
      source: 'getcardbase_api',
      totalSets: 0,
      totalSportYearCombinations: 0
    }
  };

  let totalSets = 0;
  let totalCombinations = 0;

  // Focus on major sports
  const majorSports = ['Baseball', 'Basketball', 'Football', 'Hockey'];
  
  for (const sportName of majorSports) {
    const sportData = sportIDs.sports[sportName];
    if (!sportData || !sportData.id) {
      console.log(`⚠️ Skipping ${sportName} - no ID found`);
      continue;
    }

    console.log(`\n🏈 Processing ${sportName} (ID: ${sportData.id})...`);
    setDatabase.sets[sportName] = {};

    for (const yearData of targetYears) {
      console.log(`  📅 Testing ${yearData.name}...`);
      
      try {
        // Get sets for this sport/year combination
        const setsResponse = await axios.get(`${baseURL}/categories/1/search_schemas/3/search?for_attributes=true&per=100&page=1&target_name=external[43]&target_type=Collectibles::Property&target_id=2&search_schema_id=3&category_id=1&external[45]=${sportData.id}&external[42]=${yearData.id}`, { headers });
        
        if (setsResponse.data?.results?.length > 0) {
          console.log(`    ✅ Found ${setsResponse.data.results.length} sets for ${sportName} ${yearData.name}`);
          
          const yearSets = setsResponse.data.results.map(set => ({
            id: set.id,
            name: set.text,
            sport: sportName,
            year: yearData.name,
            sportId: sportData.id,
            yearId: yearData.id
          }));

          setDatabase.sets[sportName][yearData.name] = {
            year: yearData.name,
            yearId: yearData.id,
            sets: yearSets,
            setCount: yearSets.length
          };

          totalSets += yearSets.length;
          totalCombinations++;

          // Show sample sets
          const sampleSets = yearSets.slice(0, 5).map(s => s.name).join(', ');
          console.log(`    📋 Sample sets: ${sampleSets}`);
          
        } else {
          console.log(`    ⚠️ No sets found for ${sportName} ${yearData.name}`);
          setDatabase.sets[sportName][yearData.name] = {
            year: yearData.name,
            yearId: yearData.id,
            sets: [],
            setCount: 0
          };
        }

        // Add a small delay between requests
        await new Promise(resolve => setTimeout(resolve, 300));

      } catch (error) {
        console.log(`    ❌ Failed to get sets for ${sportName} ${yearData.name}: ${error.response?.status || error.message}`);
        setDatabase.sets[sportName][yearData.name] = {
          year: yearData.name,
          yearId: yearData.id,
          sets: [],
          setCount: 0,
          error: error.response?.status || error.message
        };
      }
    }
  }

  // Update metadata
  setDatabase.metadata.totalSets = totalSets;
  setDatabase.metadata.totalSportYearCombinations = totalCombinations;

  // Save the database
  const databasePath = path.join(__dirname, '../data/sportYearSetDatabase.json');
  console.log('\n💾 Saving sport/year set database...');
  await fs.writeFile(databasePath, JSON.stringify(setDatabase, null, 2));

  // Create a summary
  const summaryPath = path.join(__dirname, '../data/sportYearSetSummary.json');
  const summary = {
    lastUpdated: setDatabase.metadata.lastUpdated,
    totalSets: setDatabase.metadata.totalSets,
    totalCombinations: setDatabase.metadata.totalSportYearCombinations,
    sports: Object.entries(setDatabase.sets).map(([sportName, years]) => ({
      sport: sportName,
      years: Object.entries(years).map(([year, data]) => ({
        year,
        setCount: data.setCount,
        hasError: !!data.error
      }))
    }))
  };
  
  await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2));

  console.log('\n📋 SPORT/YEAR SET DATABASE SUMMARY:');
  console.log('='.repeat(50));
  console.log(`Total Sets: ${totalSets}`);
  console.log(`Total Sport/Year Combinations: ${totalCombinations}`);
  console.log(`Database saved to: ${databasePath}`);
  console.log(`Summary saved to: ${summaryPath}`);
  
  console.log('\n📋 Results by Sport:');
  Object.entries(setDatabase.sets).forEach(([sportName, years]) => {
    const sportTotalSets = Object.values(years).reduce((sum, year) => sum + year.setCount, 0);
    const sportTotalYears = Object.keys(years).length;
    console.log(`  ${sportName}: ${sportTotalSets} sets across ${sportTotalYears} years`);
    
    Object.entries(years).forEach(([year, data]) => {
      if (data.setCount > 0) {
        console.log(`    ${year}: ${data.setCount} sets`);
      }
    });
  });

  // Create a flat list for easy searching
  const flatList = [];
  Object.entries(setDatabase.sets).forEach(([sportName, years]) => {
    Object.entries(years).forEach(([year, data]) => {
      data.sets.forEach(set => {
        flatList.push({
          id: set.id,
          name: set.name,
          sport: set.sport,
          year: set.year,
          sportId: set.sportId,
          yearId: set.yearId,
          searchText: `${set.sport} ${set.year} ${set.name}`.toLowerCase()
        });
      });
    });
  });

  const flatListPath = path.join(__dirname, '../data/sportYearSetFlatList.json');
  await fs.writeFile(flatListPath, JSON.stringify(flatList, null, 2));
  console.log(`Flat list saved to: ${flatListPath}`);

  return {
    success: true,
    databasePath,
    summaryPath,
    flatListPath,
    totalSets,
    totalCombinations
  };
}

// Run the database builder
buildSportYearSetDatabase()
  .then((result) => {
    if (result.success) {
      console.log('\n✅ Sport/Year Set database build completed successfully!');
      console.log(`📁 Database: ${result.databasePath}`);
      console.log(`📊 Summary: ${result.summaryPath}`);
      console.log(`📋 Flat List: ${result.flatListPath}`);
      console.log(`🏈 Total Sets: ${result.totalSets}`);
      console.log(`📅 Total Combinations: ${result.totalCombinations}`);
    } else {
      console.error('\n❌ Database build failed:', result.error);
      process.exit(1);
    }
  })
  .catch(err => {
    console.error('💥 Database build failed:', err.message);
    process.exit(1);
  }); 