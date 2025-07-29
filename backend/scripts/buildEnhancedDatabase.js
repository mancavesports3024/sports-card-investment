const fs = require('fs').promises;
const path = require('path');

class EnhancedDatabaseBuilder {
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

  // Get the hardcoded card sets from the searchCards.js file
  getHardcodedCardSets() {
    return [
      {
        id: "topps_series_one",
        name: "Topps Series One",
        brand: "Topps",
        category: "Baseball",
        sport: "Baseball",
        league: "MLB",
        years: ["2025", "2024", "2023", "2022", "2021", "2020", "2019", "2018", "2017", "2016", "2015", "2014", "2013", "2012", "2011", "2010", "2009", "2008", "2007", "2006", "2005", "2004", "2003", "2002", "2001", "2000"],
        setType: "Base Set",
        cardCount: 400,
        description: "Annual flagship baseball set featuring current MLB players",
        releaseMonth: "February",
        retailPrice: 4.99,
        hobbyPrice: 89.99,
        popularity: "High",
        rookieCards: true,
        inserts: ["Parallels", "Inserts", "Autographs", "Relics"],
        variations: ["Photo Variations", "SP", "SSP"],
        imageUrl: null,
        source: "manual",
        lastUpdated: "2025-01-27"
      },
      {
        id: "topps_series_two",
        name: "Topps Series Two",
        brand: "Topps",
        category: "Baseball",
        sport: "Baseball",
        league: "MLB",
        years: ["2025", "2024", "2023", "2022", "2021", "2020", "2019", "2018", "2017", "2016", "2015", "2014", "2013", "2012", "2011", "2010", "2009", "2008", "2007", "2006", "2005", "2004", "2003", "2002", "2001", "2000"],
        setType: "Base Set",
        cardCount: 400,
        description: "Second series of the annual flagship set",
        releaseMonth: "June",
        retailPrice: 4.99,
        hobbyPrice: 89.99,
        popularity: "High",
        rookieCards: true,
        inserts: ["Parallels", "Inserts", "Autographs", "Relics"],
        variations: ["Photo Variations", "SP", "SSP"],
        imageUrl: null,
        source: "manual",
        lastUpdated: "2025-01-27"
      },
      {
        id: "topps_update",
        name: "Topps Update",
        brand: "Topps",
        category: "Baseball",
        sport: "Baseball",
        league: "MLB",
        years: ["2024", "2023", "2022", "2021", "2020", "2019", "2018", "2017", "2016", "2015", "2014", "2013", "2012", "2011", "2010", "2009", "2008", "2007", "2006", "2005", "2004", "2003", "2002", "2001", "2000"],
        setType: "Update Set",
        cardCount: 300,
        description: "Update set featuring mid-season trades and rookies",
        releaseMonth: "October",
        retailPrice: 4.99,
        hobbyPrice: 79.99,
        popularity: "High",
        rookieCards: true,
        inserts: ["Parallels", "Inserts", "Autographs", "Relics"],
        variations: ["Photo Variations", "SP", "SSP"],
        imageUrl: null,
        source: "manual",
        lastUpdated: "2025-01-27"
      },
      {
        id: "topps_chrome",
        name: "Topps Chrome",
        brand: "Topps",
        category: "Baseball",
        sport: "Baseball",
        league: "MLB",
        years: ["2024", "2023", "2022", "2021", "2020", "2019", "2018", "2017", "2016", "2015", "2014", "2013", "2012", "2011", "2010", "2009", "2008", "2007", "2006", "2005", "2004", "2003", "2002", "2001", "2000"],
        setType: "Chrome Set",
        cardCount: 220,
        description: "Premium chrome version of flagship set with enhanced parallels",
        releaseMonth: "August",
        retailPrice: 6.99,
        hobbyPrice: 129.99,
        popularity: "High",
        rookieCards: true,
        inserts: ["Refractors", "Autographs", "Relics", "Numbered"],
        variations: ["Refractor Parallels", "SP", "SSP", "Superfractors"],
        imageUrl: null,
        source: "manual",
        lastUpdated: "2025-01-27"
      },
      {
        id: "topps_heritage",
        name: "Topps Heritage",
        brand: "Topps",
        category: "Baseball",
        sport: "Baseball",
        league: "MLB",
        years: ["2024", "2023", "2022", "2021", "2020", "2019", "2018", "2017", "2016", "2015", "2014", "2013", "2012", "2011", "2010", "2009", "2008", "2007", "2006", "2005", "2004", "2003", "2002", "2001"],
        setType: "Heritage Set",
        cardCount: 500,
        description: "Retro-style set based on classic Topps designs",
        releaseMonth: "March",
        retailPrice: 4.99,
        hobbyPrice: 99.99,
        popularity: "High",
        rookieCards: true,
        inserts: ["Parallels", "Autographs", "Relics", "Vintage"],
        variations: ["Color Variations", "SP", "SSP", "Chrome"],
        imageUrl: null,
        source: "manual",
        lastUpdated: "2025-01-27"
      },
      {
        id: "bowman",
        name: "Bowman",
        brand: "Bowman",
        category: "Baseball",
        sport: "Baseball",
        league: "MLB",
        years: ["2024", "2023", "2022", "2021", "2020", "2019", "2018", "2017", "2016", "2015", "2014", "2013", "2012", "2011", "2010", "2009", "2008", "2007", "2006", "2005", "2004", "2003", "2002", "2001", "2000"],
        setType: "Prospect Set",
        cardCount: 500,
        description: "Prospect-focused set featuring minor league and rookie players",
        releaseMonth: "May",
        retailPrice: 4.99,
        hobbyPrice: 89.99,
        popularity: "High",
        rookieCards: true,
        inserts: ["Parallels", "Autographs", "Relics", "Prospects"],
        variations: ["Photo Variations", "SP", "SSP", "Chrome"],
        imageUrl: null,
        source: "manual",
        lastUpdated: "2025-01-27"
      },
      {
        id: "bowman_chrome",
        name: "Bowman Chrome",
        brand: "Bowman",
        category: "Baseball",
        sport: "Baseball",
        league: "MLB",
        years: ["2024", "2023", "2022", "2021", "2020", "2019", "2018", "2017", "2016", "2015", "2014", "2013", "2012", "2011", "2010", "2009", "2008", "2007", "2006", "2005", "2004", "2003", "2002", "2001", "2000"],
        setType: "Chrome Prospect Set",
        cardCount: 220,
        description: "Premium chrome version of Bowman with enhanced prospect parallels",
        releaseMonth: "September",
        retailPrice: 6.99,
        hobbyPrice: 129.99,
        popularity: "High",
        rookieCards: true,
        inserts: ["Refractors", "Autographs", "Relics", "Prospects"],
        variations: ["Refractor Parallels", "SP", "SSP", "Superfractors"],
        imageUrl: null,
        source: "manual",
        lastUpdated: "2025-01-27"
      },
      {
        id: "panini_prizm",
        name: "Panini Prizm",
        brand: "Panini",
        category: "Basketball",
        sport: "Basketball",
        league: "NBA",
        years: ["2024", "2023", "2022", "2021", "2020", "2019", "2018", "2017", "2016", "2015", "2014", "2013", "2012"],
        setType: "Prizm Set",
        cardCount: 300,
        description: "Premium basketball set with extensive parallel system",
        releaseMonth: "December",
        retailPrice: 6.99,
        hobbyPrice: 129.99,
        popularity: "High",
        rookieCards: true,
        inserts: ["Prizms", "Autographs", "Relics", "Numbered"],
        variations: ["Prizm Parallels", "SP", "SSP", "Super Prizms"],
        imageUrl: null,
        source: "manual",
        lastUpdated: "2025-01-27"
      },
      {
        id: "panini_donruss",
        name: "Panini Donruss",
        brand: "Panini",
        category: "Basketball",
        sport: "Basketball",
        league: "NBA",
        years: ["2024", "2023", "2022", "2021", "2020", "2019", "2018", "2017", "2016", "2015", "2014", "2013", "2012"],
        setType: "Base Set",
        cardCount: 400,
        description: "Base basketball set with classic Donruss design",
        releaseMonth: "February",
        retailPrice: 4.99,
        hobbyPrice: 89.99,
        popularity: "Medium",
        rookieCards: true,
        inserts: ["Parallels", "Autographs", "Relics"],
        variations: ["Photo Variations", "SP", "SSP"],
        imageUrl: null,
        source: "manual",
        lastUpdated: "2025-01-27"
      },
      {
        id: "upper_deck",
        name: "Upper Deck",
        brand: "Upper Deck",
        category: "Hockey",
        sport: "Hockey",
        league: "NHL",
        years: ["2024", "2023", "2022", "2021", "2020", "2019", "2018", "2017", "2016", "2015", "2014", "2013", "2012", "2011", "2010", "2009", "2008", "2007", "2006", "2005", "2004", "2003", "2002", "2001", "2000"],
        setType: "Base Set",
        cardCount: 500,
        description: "Base hockey set featuring NHL players",
        releaseMonth: "November",
        retailPrice: 4.99,
        hobbyPrice: 89.99,
        popularity: "Medium",
        rookieCards: true,
        inserts: ["Parallels", "Autographs", "Relics", "Young Guns"],
        variations: ["Photo Variations", "SP", "SSP"],
        imageUrl: null,
        source: "manual",
        lastUpdated: "2025-01-27"
      }
    ];
  }

  // Expand hardcoded sets into individual year entries
  expandCardSetsByYear(cardSets) {
    const expandedSets = [];
    
    cardSets.forEach(set => {
      if (set.years && Array.isArray(set.years)) {
        set.years.forEach(year => {
          const expandedSet = {
            ...set,
            id: `${set.id}_${year}`,
            name: `${set.name} ${year}`,
            year: year,
            years: undefined // Remove the years array since we're expanding
          };
          expandedSets.push(expandedSet);
        });
      } else {
        // If no years array, just add the set as is
        expandedSets.push(set);
      }
    });
    
    return expandedSets;
  }

  // Add some additional popular sets
  getAdditionalSets() {
    return [
      {
        id: "topps_finest",
        name: "Topps Finest",
        brand: "Topps",
        category: "Baseball",
        sport: "Baseball",
        league: "MLB",
        year: "2024",
        setType: "Finest Set",
        cardCount: 200,
        description: "Premium baseball set with high-end parallels",
        releaseMonth: "July",
        retailPrice: 5.99,
        hobbyPrice: 109.99,
        popularity: "High",
        rookieCards: true,
        inserts: ["Refractors", "Autographs", "Relics", "Numbered"],
        variations: ["Refractor Parallels", "SP", "SSP"],
        imageUrl: null,
        source: "manual",
        lastUpdated: "2025-01-27"
      },
      {
        id: "topps_stadium_club",
        name: "Topps Stadium Club",
        brand: "Topps",
        category: "Baseball",
        sport: "Baseball",
        league: "MLB",
        year: "2024",
        setType: "Stadium Club Set",
        cardCount: 300,
        description: "Premium photography-focused set with artistic card designs",
        releaseMonth: "December",
        retailPrice: 5.99,
        hobbyPrice: 119.99,
        popularity: "Medium",
        rookieCards: true,
        inserts: ["Parallels", "Autographs", "Relics", "Beam Team"],
        variations: ["Photo Variations", "SP", "SSP", "Chrome"],
        imageUrl: null,
        source: "manual",
        lastUpdated: "2025-01-27"
      },
      {
        id: "panini_select",
        name: "Panini Select",
        brand: "Panini",
        category: "Basketball",
        sport: "Basketball",
        league: "NBA",
        year: "2024",
        setType: "Select Set",
        cardCount: 250,
        description: "Premium basketball set with tiered parallel system",
        releaseMonth: "March",
        retailPrice: 5.99,
        hobbyPrice: 109.99,
        popularity: "High",
        rookieCards: true,
        inserts: ["Concourses", "Premier Level", "Club Level", "Field Level"],
        variations: ["Concourse Parallels", "SP", "SSP"],
        imageUrl: null,
        source: "manual",
        lastUpdated: "2025-01-27"
      },
      {
        id: "panini_mosaic",
        name: "Panini Mosaic",
        brand: "Panini",
        category: "Basketball",
        sport: "Basketball",
        league: "NBA",
        year: "2024",
        setType: "Mosaic Set",
        cardCount: 280,
        description: "Premium basketball set with mosaic-style parallels",
        releaseMonth: "April",
        retailPrice: 5.99,
        hobbyPrice: 109.99,
        popularity: "High",
        rookieCards: true,
        inserts: ["Mosaics", "Autographs", "Relics", "Numbered"],
        variations: ["Mosaic Parallels", "SP", "SSP"],
        imageUrl: null,
        source: "manual",
        lastUpdated: "2025-01-27"
      }
    ];
  }

  async saveDatabase(database) {
    await this.ensureDataDirectory();
    
    // Update metadata
    database.metadata = {
      lastUpdated: new Date().toISOString(),
      totalSets: database.cardSets.length,
      sources: ['manual'],
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

  async buildDatabase() {
    console.log('🏗️ BUILDING ENHANCED CARD SET DATABASE\n');
    
    try {
      // Get hardcoded card sets
      console.log('📋 Loading hardcoded card sets...');
      const hardcodedSets = this.getHardcodedCardSets();
      console.log(`✅ Loaded ${hardcodedSets.length} hardcoded card sets`);
      
      // Expand sets by year
      console.log('📈 Expanding card sets by year...');
      const expandedSets = this.expandCardSetsByYear(hardcodedSets);
      console.log(`✅ Expanded to ${expandedSets.length} card sets`);
      
      // Add additional sets
      console.log('➕ Adding additional popular sets...');
      const additionalSets = this.getAdditionalSets();
      console.log(`✅ Added ${additionalSets.length} additional sets`);
      
      // Combine all sets
      const allCardSets = [...expandedSets, ...additionalSets];
      
      // Remove duplicates based on name
      const uniqueCardSets = allCardSets.filter((set, index, self) => 
        index === self.findIndex(s => s.name === set.name)
      );
      
      console.log(`📊 Final database: ${uniqueCardSets.length} unique card sets`);
      console.log(`   Expanded sets: ${expandedSets.length}`);
      console.log(`   Additional sets: ${additionalSets.length}`);
      console.log(`   Duplicates removed: ${allCardSets.length - uniqueCardSets.length}`);
      
      // Save the database
      const finalDatabase = {
        cardSets: uniqueCardSets,
        metadata: {
          lastUpdated: new Date().toISOString(),
          totalSets: uniqueCardSets.length,
          sources: ['manual'],
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
        expandedSets: expandedSets.length,
        additionalSets: additionalSets.length,
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
  const builder = new EnhancedDatabaseBuilder();
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

module.exports = EnhancedDatabaseBuilder; 