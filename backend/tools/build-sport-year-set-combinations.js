const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

async function buildSportYearSetCombinations() {
  console.log('🏗️ BUILDING SPORT/YEAR/SET COMBINATIONS\n');
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

  // Load our sport/years database
  let sportYearsData;
  try {
    const sportYearsPath = path.join(__dirname, '../data/sportYearsDatabase.json');
    const sportYearsContent = await fs.readFile(sportYearsPath, 'utf8');
    sportYearsData = JSON.parse(sportYearsContent);
    console.log(`✅ Loaded sport/years database with ${Object.keys(sportYearsData.sports).length} sports`);
  } catch (error) {
    console.error('❌ Could not load sport/years database:', error.message);
    return;
  }

  const combinationsDatabase = {
    combinations: {},
    metadata: {
      lastUpdated: new Date().toISOString(),
      source: 'getcardbase_api',
      method: 'sport_year_set_combinations',
      totalCombinations: 0,
      totalSets: 0
    }
  };

  let totalCombinations = 0;
  let totalSets = 0;

  // Focus on major sports and recent years for efficiency
  const majorSports = ['Baseball', 'Basketball', 'Football', 'Hockey'];
  const recentYears = ['2025', '2024', '2023', '2022', '2021', '2020'];

  for (const sportName of majorSports) {
    const sportData = sportYearsData.sports[sportName];
    if (!sportData) {
      console.log(`⚠️ Skipping ${sportName} - no data found`);
      continue;
    }

    console.log(`\n🏈 Processing ${sportName} (ID: ${sportData.id})...`);
    combinationsDatabase.combinations[sportName] = {};

    // Filter to recent years for efficiency
    const targetYears = sportData.years.filter(year => 
      recentYears.includes(year.name)
    );

    console.log(`  📅 Testing ${targetYears.length} recent years...`);

    for (const yearData of targetYears) {
      console.log(`    📅 Testing ${yearData.name}...`);
      
      try {
        // Try to get sets for this sport/year combination
        // Using the working URL pattern: external[42]=sport, external[43]=year, target_name=external[44], target_id=2
        const url = `${baseURL}/categories/1/search_schemas/3/search?for_attributes=true&per=50&page=1&target_name=external[44]&target_type=Collectibles::Property&target_id=2&search_schema_id=3&category_id=1&external[42]=${sportData.id}&external[43]=${yearData.id}`;
        
        const response = await axios.get(url, { headers });
        
        if (response.data?.results?.length > 0) {
          console.log(`      ✅ Found ${response.data.results.length} sets for ${sportName} ${yearData.name}`);
          
          const sets = response.data.results.map(set => ({
            id: set.id,
            name: set.text,
            sport: sportName,
            year: yearData.name,
            sportId: sportData.id,
            yearId: yearData.id
          }));

          combinationsDatabase.combinations[sportName][yearData.name] = {
            year: yearData.name,
            yearId: yearData.id,
            sets: sets,
            setCount: sets.length
          };

          totalCombinations++;
          totalSets += sets.length;

          // Show sample sets
          const sampleSets = sets.slice(0, 3).map(s => s.name).join(', ');
          console.log(`      📋 Sample sets: ${sampleSets}`);
          
        } else {
          console.log(`      ⚠️ No sets found for ${sportName} ${yearData.name}`);
          combinationsDatabase.combinations[sportName][yearData.name] = {
            year: yearData.name,
            yearId: yearData.id,
            sets: [],
            setCount: 0
          };
        }

        // Add a small delay between requests
        await new Promise(resolve => setTimeout(resolve, 300));

      } catch (error) {
        console.log(`      ❌ Failed to get sets for ${sportName} ${yearData.name}: ${error.response?.status || error.message}`);
        combinationsDatabase.combinations[sportName][yearData.name] = {
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
  combinationsDatabase.metadata.totalCombinations = totalCombinations;
  combinationsDatabase.metadata.totalSets = totalSets;

  // Save the database
  const databasePath = path.join(__dirname, '../data/sportYearSetCombinations.json');
  console.log('\n💾 Saving sport/year/set combinations database...');
  await fs.writeFile(databasePath, JSON.stringify(combinationsDatabase, null, 2));

  // Create a summary
  const summaryPath = path.join(__dirname, '../data/sportYearSetCombinationsSummary.json');
  const summary = {
    lastUpdated: combinationsDatabase.metadata.lastUpdated,
    totalCombinations: combinationsDatabase.metadata.totalCombinations,
    totalSets: combinationsDatabase.metadata.totalSets,
    sports: Object.entries(combinationsDatabase.combinations).map(([sportName, years]) => ({
      sport: sportName,
      years: Object.entries(years).map(([year, data]) => ({
        year,
        setCount: data.setCount,
        hasError: !!data.error
      }))
    }))
  };
  
  await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2));

  // Create a flat list for easy searching
  const flatList = [];
  Object.entries(combinationsDatabase.combinations).forEach(([sportName, years]) => {
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

  const flatListPath = path.join(__dirname, '../data/sportYearSetCombinationsFlatList.json');
  await fs.writeFile(flatListPath, JSON.stringify(flatList, null, 2));

  console.log('\n📋 SPORT/YEAR/SET COMBINATIONS SUMMARY:');
  console.log('='.repeat(50));
  console.log(`Total Combinations: ${totalCombinations}`);
  console.log(`Total Sets: ${totalSets}`);
  console.log(`Database saved to: ${databasePath}`);
  console.log(`Summary saved to: ${summaryPath}`);
  console.log(`Flat list saved to: ${flatListPath}`);
  
  console.log('\n📋 Results by Sport:');
  Object.entries(combinationsDatabase.combinations).forEach(([sportName, years]) => {
    const sportTotalSets = Object.values(years).reduce((sum, year) => sum + year.setCount, 0);
    const sportTotalYears = Object.keys(years).length;
    console.log(`  ${sportName}: ${sportTotalSets} sets across ${sportTotalYears} years`);
    
    Object.entries(years).forEach(([year, data]) => {
      if (data.setCount > 0) {
        console.log(`    ${year}: ${data.setCount} sets`);
      }
    });
  });

  return {
    success: true,
    databasePath,
    summaryPath,
    flatListPath,
    totalCombinations,
    totalSets
  };
}

// Run the database builder
buildSportYearSetCombinations()
  .then((result) => {
    if (result.success) {
      console.log('\n✅ Sport/year/set combinations database build completed successfully!');
      console.log(`📁 Database: ${result.databasePath}`);
      console.log(`📊 Summary: ${result.summaryPath}`);
      console.log(`📋 Flat List: ${result.flatListPath}`);
      console.log(`🏈 Total Combinations: ${result.totalCombinations}`);
      console.log(`📦 Total Sets: ${result.totalSets}`);
    } else {
      console.error('\n❌ Database build failed:', result.error);
      process.exit(1);
    }
  })
  .catch(err => {
    console.error('💥 Database build failed:', err.message);
    process.exit(1);
  }); 