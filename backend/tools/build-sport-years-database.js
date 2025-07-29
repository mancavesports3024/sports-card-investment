const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

async function buildSportYearsDatabase() {
  console.log('🏗️ BUILDING SPORT/YEARS DATABASE\n');
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

  // Sport mappings based on our discoveries
  const sports = [
    { id: 1, name: 'Baseball' },
    { id: 2, name: 'Basketball' },
    { id: 3, name: 'Football' },
    { id: 4, name: 'Hockey' },
    { id: 5, name: 'Soccer' },
    { id: 6, name: 'Boxing' },
    { id: 7, name: 'Golf' },
    { id: 8, name: 'MMA' },
    { id: 9, name: 'Racing' },
    { id: 10, name: 'Tennis' },
    { id: 11, name: 'Wrestling' }
  ];

  const sportYearsDatabase = {
    sports: {},
    metadata: {
      lastUpdated: new Date().toISOString(),
      source: 'getcardbase_api',
      method: 'sport_filtered_years',
      totalSports: 0,
      totalYears: 0
    }
  };

  let totalYears = 0;

  for (const sport of sports) {
    console.log(`\n🏈 Processing ${sport.name} (ID: ${sport.id})...`);
    
    const sportYears = [];
    let page = 1;
    const maxPages = 20; // Get up to 600 years per sport

    while (page <= maxPages) {
      try {
        console.log(`  📄 Fetching page ${page}...`);
        
        const url = `${baseURL}/categories/1/search_schemas/3/search?for_attributes=true&per=30&page=${page}&target_name=external[43]&target_type=Collectibles::Property&target_id=1&search_schema_id=3&category_id=1&external[42]=${sport.id}`;
        
        const response = await axios.get(url, { headers });
        
        if (response.data?.results?.length > 0) {
          const years = response.data.results.map(year => ({
            id: year.id,
            name: year.text,
            sport: sport.name,
            sportId: sport.id
          }));
          
          sportYears.push(...years);
          console.log(`    ✅ Got ${years.length} years (total: ${sportYears.length})`);
          
          // Show sample years
          if (page === 1) {
            const sampleYears = years.slice(0, 5).map(y => y.name).join(', ');
            console.log(`    📅 Sample years: ${sampleYears}`);
          }
          
          if (years.length < 30) {
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
        if (error.response?.status === 422) {
          console.log(`    ⚠️ Sport ID ${sport.id} might not exist or have years`);
        }
        break;
      }
    }

    if (sportYears.length > 0) {
      sportYearsDatabase.sports[sport.name] = {
        id: sport.id,
        name: sport.name,
        years: sportYears,
        yearCount: sportYears.length,
        yearRange: {
          oldest: sportYears[sportYears.length - 1]?.name,
          newest: sportYears[0]?.name
        }
      };
      
      totalYears += sportYears.length;
      console.log(`  ✅ ${sport.name}: ${sportYears.length} years (${sportYears[sportYears.length - 1]?.name} - ${sportYears[0]?.name})`);
    } else {
      console.log(`  ⚠️ No years found for ${sport.name}`);
    }
  }

  // Update metadata
  sportYearsDatabase.metadata.totalSports = Object.keys(sportYearsDatabase.sports).length;
  sportYearsDatabase.metadata.totalYears = totalYears;

  // Save the database
  const databasePath = path.join(__dirname, '../data/sportYearsDatabase.json');
  console.log('\n💾 Saving sport/years database...');
  await fs.writeFile(databasePath, JSON.stringify(sportYearsDatabase, null, 2));

  // Create a summary
  const summaryPath = path.join(__dirname, '../data/sportYearsSummary.json');
  const summary = {
    lastUpdated: sportYearsDatabase.metadata.lastUpdated,
    totalSports: sportYearsDatabase.metadata.totalSports,
    totalYears: sportYearsDatabase.metadata.totalYears,
    sports: Object.entries(sportYearsDatabase.sports).map(([name, data]) => ({
      name,
      id: data.id,
      yearCount: data.yearCount,
      yearRange: data.yearRange
    }))
  };
  
  await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2));

  // Create a flat list for easy searching
  const flatList = [];
  Object.entries(sportYearsDatabase.sports).forEach(([sportName, sportData]) => {
    sportData.years.forEach(year => {
      flatList.push({
        id: year.id,
        name: year.name,
        sport: year.sport,
        sportId: year.sportId,
        searchText: `${year.sport} ${year.name}`.toLowerCase()
      });
    });
  });

  const flatListPath = path.join(__dirname, '../data/sportYearsFlatList.json');
  await fs.writeFile(flatListPath, JSON.stringify(flatList, null, 2));

  console.log('\n📋 SPORT/YEARS DATABASE SUMMARY:');
  console.log('='.repeat(50));
  console.log(`Total Sports: ${sportYearsDatabase.metadata.totalSports}`);
  console.log(`Total Years: ${sportYearsDatabase.metadata.totalYears}`);
  console.log(`Database saved to: ${databasePath}`);
  console.log(`Summary saved to: ${summaryPath}`);
  console.log(`Flat list saved to: ${flatListPath}`);
  
  console.log('\n📋 Results by Sport:');
  Object.entries(sportYearsDatabase.sports).forEach(([sportName, sportData]) => {
    console.log(`  ${sportName}: ${sportData.yearCount} years (${sportData.yearRange.oldest} - ${sportData.yearRange.newest})`);
  });

  return {
    success: true,
    databasePath,
    summaryPath,
    flatListPath,
    totalSports: sportYearsDatabase.metadata.totalSports,
    totalYears: sportYearsDatabase.metadata.totalYears
  };
}

// Run the database builder
buildSportYearsDatabase()
  .then((result) => {
    if (result.success) {
      console.log('\n✅ Sport/years database build completed successfully!');
      console.log(`📁 Database: ${result.databasePath}`);
      console.log(`📊 Summary: ${result.summaryPath}`);
      console.log(`📋 Flat List: ${result.flatListPath}`);
      console.log(`🏈 Total Sports: ${result.totalSports}`);
      console.log(`📅 Total Years: ${result.totalYears}`);
    } else {
      console.error('\n❌ Database build failed:', result.error);
      process.exit(1);
    }
  })
  .catch(err => {
    console.error('💥 Database build failed:', err.message);
    process.exit(1);
  }); 