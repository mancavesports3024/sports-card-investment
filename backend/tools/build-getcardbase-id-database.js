const getCardBaseService = require('../services/getCardBaseService');
const fs = require('fs').promises;
const path = require('path');

async function buildGetCardBaseIDDatabase() {
  console.log('🏗️ BUILDING GETCARDBASE ID DATABASE\n');
  console.log('='.repeat(60));
  
  try {
    const databasePath = path.join(__dirname, '../data/getCardBaseIDDatabase.json');
    
    console.log('📡 Fetching comprehensive ID data from GetCardBase...\n');
    
    // Get all sports
    console.log('📊 Fetching sports...');
    const sports = await getCardBaseService.getSports();
    console.log(`✅ Found ${sports.length} sports`);
    
    const database = {
      sports: {},
      years: {},
      sets: {},
      variations: {},
      metadata: {
        lastUpdated: new Date().toISOString(),
        totalSports: sports.length,
        totalYears: 0,
        totalSets: 0,
        totalVariations: 0,
        source: 'getcardbase_api'
      }
    };
    
    // Process sports
    for (const sport of sports) {
      database.sports[sport.id] = {
        name: sport.name,
        isApproved: sport.isApproved
      };
      
      console.log(`📊 Fetching years for ${sport.name}...`);
      const years = await getCardBaseService.getYears(sport.id);
      console.log(`✅ Found ${years.length} years for ${sport.name}`);
      
      // Process years for this sport
      for (const year of years) {
        const yearKey = `${sport.id}_${year.id}`;
        database.years[yearKey] = {
          sportId: sport.id,
          sportName: sport.name,
          yearId: year.id,
          yearName: year.name,
          isApproved: year.isApproved
        };
        
        console.log(`📊 Fetching sets for ${sport.name} ${year.name}...`);
        const sets = await getCardBaseService.getSets(sport.id, year.id);
        console.log(`✅ Found ${sets.length} sets for ${sport.name} ${year.name}`);
        
        // Process sets for this sport/year
        for (const set of sets) {
          const setKey = `${sport.id}_${year.id}_${set.id}`;
          database.sets[setKey] = {
            sportId: sport.id,
            sportName: sport.name,
            yearId: year.id,
            yearName: year.name,
            setId: set.id,
            setName: set.name,
            isApproved: set.isApproved
          };
          
          console.log(`📊 Fetching variations for ${sport.name} ${year.name} ${set.name}...`);
          const variations = await getCardBaseService.getVariations(sport.id, year.id, set.id);
          console.log(`✅ Found ${variations.length} variations for ${sport.name} ${year.name} ${set.name}`);
          
          // Process variations for this sport/year/set
          for (const variation of variations) {
            const variationKey = `${sport.id}_${year.id}_${set.id}_${variation.id}`;
            database.variations[variationKey] = {
              sportId: sport.id,
              sportName: sport.name,
              yearId: year.id,
              yearName: year.name,
              setId: set.id,
              setName: set.name,
              variationId: variation.id,
              variationName: variation.name,
              isApproved: variation.isApproved
            };
            
            // Get card count for this complete set
            try {
              const cardData = await getCardBaseService.getCards(sport.id, year.id, set.id, variation.id, 1);
              database.variations[variationKey].cardCount = cardData.meta?.total_count || 0;
            } catch (error) {
              console.log(`⚠️ Could not get card count for ${sport.name} ${year.name} ${set.name} ${variation.name}`);
              database.variations[variationKey].cardCount = 0;
            }
          }
          
          // Update counters
          database.metadata.totalVariations += variations.length;
        }
        
        // Update counters
        database.metadata.totalSets += sets.length;
      }
      
      // Update counters
      database.metadata.totalYears += years.length;
    }
    
    // Save the database
    console.log('\n💾 Saving ID database...');
    await fs.writeFile(databasePath, JSON.stringify(database, null, 2));
    
    console.log('\n📋 DATABASE BUILD SUMMARY:');
    console.log('='.repeat(50));
    console.log(`Total Sports: ${database.metadata.totalSports}`);
    console.log(`Total Years: ${database.metadata.totalYears}`);
    console.log(`Total Sets: ${database.metadata.totalSets}`);
    console.log(`Total Variations: ${database.metadata.totalVariations}`);
    console.log(`Database saved to: ${databasePath}`);
    
    // Create a summary file
    const summaryPath = path.join(__dirname, '../data/getCardBaseIDSummary.json');
    const summary = {
      lastUpdated: database.metadata.lastUpdated,
      stats: {
        sports: database.metadata.totalSports,
        years: database.metadata.totalYears,
        sets: database.metadata.totalSets,
        variations: database.metadata.totalVariations
      },
      sampleData: {
        sports: Object.keys(database.sports).slice(0, 5).map(id => ({
          id,
          name: database.sports[id].name
        })),
        years: Object.keys(database.years).slice(0, 5).map(key => ({
          key,
          sportName: database.years[key].sportName,
          yearName: database.years[key].yearName
        })),
        sets: Object.keys(database.sets).slice(0, 5).map(key => ({
          key,
          sportName: database.sets[key].sportName,
          yearName: database.sets[key].yearName,
          setName: database.sets[key].setName
        })),
        variations: Object.keys(database.variations).slice(0, 5).map(key => ({
          key,
          sportName: database.variations[key].sportName,
          yearName: database.variations[key].yearName,
          setName: database.variations[key].setName,
          variationName: database.variations[key].variationName,
          cardCount: database.variations[key].cardCount
        }))
      }
    };
    
    await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2));
    console.log(`Summary saved to: ${summaryPath}`);
    
    return {
      success: true,
      databasePath,
      summaryPath,
      stats: database.metadata
    };
    
  } catch (error) {
    console.error('❌ Error building ID database:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

// Run the database builder
buildGetCardBaseIDDatabase()
  .then((result) => {
    if (result.success) {
      console.log('\n✅ GetCardBase ID database build completed successfully!');
      console.log(`📁 Database: ${result.databasePath}`);
      console.log(`📊 Summary: ${result.summaryPath}`);
    } else {
      console.error('\n❌ Database build failed:', result.error);
      process.exit(1);
    }
  })
  .catch(err => {
    console.error('💥 Database build failed:', err.message);
    process.exit(1);
  }); 