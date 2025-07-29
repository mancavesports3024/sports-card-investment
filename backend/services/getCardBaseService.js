const axios = require('axios');
const cacheService = require('./cacheService');

class GetCardBaseService {
  constructor() {
    this.baseURL = 'https://api.getcardbase.com/collectibles/api/mobile/v1';
    this.headers = {
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

    // ID mappings based on our discoveries - CORRECTED
    this.idMappings = {
      sports: {
        // Property 4 contains sports
        54: 'Baseball',
        57: 'Basketball', 
        59: 'Football',
        62: 'Hockey',
        64: 'Soccer',
        65: 'Boxing',
        67: 'Golf',
        69: 'MMA',
        1134529: 'Multi-Sport',
        1134530: 'Racing',
        1134531: 'Tennis',
        1134532: 'Wrestling'
      },
      years: {
        // Property 1 contains years
        3914795: '2025',
        348057: '2024',
        5: '2023',
        196231: '2022',
        119141: '2021',
        13: '2020',
        131: '2019',
        263: '2018',
        384: '2017',
        436: '2016',
        459: '2015',
        475: '2014',
        490: '2013',
        521: '2012',
        536: '2011',
        547: '2010',
        552: '2009',
        559: '2008',
        567: '2007',
        572: '2006'
      },
      sets: {
        // Property 2 contains sets/brands
        61: 'Topps',
        208: 'Topps Chrome',
        255: 'Topps Update',
        313: 'Topps Archives',
        320: 'Topps Chrome Update',
        334: 'Topps Diamond Icons',
        418: 'Topps 87 Chrome Silver Promo',
        474: 'Topps Mini',
        124: 'Topps Tier One',
        128: 'Topps Transcendent Hall of Fame',
        233: 'Topps Clearly Authentic',
        249: 'Topps On Demand 3D',
        250: 'Topps Tribute',
        253: 'Topps Triple Threads',
        280: 'Bowman Mega Box Chrome',
        403: 'Bowman Platinum',
        180: 'Donruss Optic',
        463: 'Panini Elite'
      },
      variations: {
        // Property 3 contains variations
        16: 'Base',
        205: 'Gold',
        1265: 'Black',
        1977: 'Canvas',
        119930: 'Clear',
        140369: 'First Card',
        386690: 'Holo Foil',
        117907: 'Independence Day',
        122408: 'Memorial Day Camo',
        402429: 'Holiday',
        188239: 'Gold Rainbow Foil',
        253490: 'Blue Rainbow Foil',
        217867: 'Green Rainbow Foil',
        158690: 'Orange Rainbow Foil',
        264038: 'Black Rainbow Foil'
      }
    };
  }

  async makeRequest(endpoint, description = 'API request') {
    try {
      console.log(`📡 GetCardBase: ${description}...`);
      const startTime = Date.now();
      
      const response = await axios.get(`${this.baseURL}${endpoint}`, {
        headers: this.headers,
        timeout: 30000
      });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      console.log(`✅ GetCardBase: ${description} - Success (${response.status}) in ${duration}ms`);
      return response.data;
      
    } catch (error) {
      console.log(`❌ GetCardBase: ${description} - Error: ${error.message}`);
      if (error.response) {
        console.log(`   Status: ${error.response.status}`);
        console.log(`   Data: ${JSON.stringify(error.response.data, null, 2)}`);
      }
      throw error;
    }
  }

  // Get all property values (old method that was working)
  async getAllPropertyValues(propertyId) {
    const cacheKey = `getcardbase_property_${propertyId}`;
    let values = await cacheService.get(cacheKey);
    
    if (!values) {
      console.log(`📡 GetCardBase: Getting property ${propertyId} values...`);
      values = [];
      let page = 1;
      let hasMore = true;
      
      while (hasMore && page <= 11) { // Limit to prevent infinite loops
        try {
          // Based on the working request, target_id values are different from external numbers
          const targetIdMap = {
            1: 1, // Property 1 (years) -> target_id 1
            2: 2, // Property 2 (sets) -> target_id 2  
            3: 3, // Property 3 (variations) -> target_id 3
            4: 4  // Property 4 (sports) -> target_id 4
          };
          
          const targetId = targetIdMap[propertyId];
          const externalNumber = propertyId + 41; // external[42], external[43], etc.
          const endpoint = `/categories/1/search_schemas/3/search?for_attributes=true&per=100&page=${page}&target_name=external[${externalNumber}]&target_type=Collectibles::Property&target_id=${targetId}&search_schema_id=3&category_id=1`;
          const data = await this.makeRequest(endpoint, `Getting property ${propertyId} values (page ${page})`);
          
          if (data && data.data && data.data.length > 0) {
            values.push(...data.data);
            page++;
          } else {
            hasMore = false;
          }
          
          // Add a small delay to be respectful
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (error) {
          console.log(`⚠️ GetCardBase: Stopping at page ${page} for property ${propertyId} to prevent infinite loop`);
          hasMore = false;
        }
      }
      
      await cacheService.set(cacheKey, values, 3600); // Cache for 1 hour
    }
    
    return values;
  }

  // Get sports list
  async getSports() {
    const cacheKey = 'getcardbase_sports';
    let sports = await cacheService.get(cacheKey);
    
    if (!sports) {
      const data = await this.makeRequest('/categories/1/search_schemas/3/search?for_attributes=true&per=50&page=1&target_name=external[45]&target_type=Collectibles::Property&target_id=4&search_schema_id=3&category_id=1', 'Getting sports list');
      
      if (data && data.data) {
        sports = data.data.map(item => ({
          id: item.id,
          name: item.text,
          isApproved: item.isApproved
        }));
        
        await cacheService.set(cacheKey, sports, 3600); // Cache for 1 hour
      }
    }
    
    return sports || [];
  }

  // Get years for a specific sport
  async getYears(sportId) {
    const cacheKey = `getcardbase_years_${sportId}`;
    let years = await cacheService.get(cacheKey);
    
    if (!years) {
      const data = await this.makeRequest(`/categories/1/search_schemas/3/search?for_attributes=true&per=50&page=1&target_name=external[42]&target_type=Collectibles::Property&target_id=1&search_schema_id=3&category_id=1&external[45]=${sportId}`, `Getting years for sport ${sportId}`);
      
      if (data && data.data) {
        years = data.data.map(item => ({
          id: item.id,
          name: item.text,
          isApproved: item.isApproved
        }));
        
        await cacheService.set(cacheKey, years, 3600);
      }
    }
    
    return years || [];
  }

  // Get sets for a specific sport and year
  async getSets(sportId, yearId) {
    const cacheKey = `getcardbase_sets_${sportId}_${yearId}`;
    let sets = await cacheService.get(cacheKey);
    
    if (!sets) {
      const data = await this.makeRequest(`/categories/1/search_schemas/3/search?for_attributes=true&per=100&page=1&target_name=external[43]&target_type=Collectibles::Property&target_id=2&search_schema_id=3&category_id=1&external[45]=${sportId}&external[42]=${yearId}`, `Getting sets for sport ${sportId}, year ${yearId}`);
      
      if (data && data.data) {
        sets = data.data.map(item => ({
          id: item.id,
          name: item.text,
          isApproved: item.isApproved
        }));
        
        await cacheService.set(cacheKey, sets, 3600);
      }
    }
    
    return sets || [];
  }

  // Get variations for a specific sport, year, and set
  async getVariations(sportId, yearId, setId) {
    const cacheKey = `getcardbase_variations_${sportId}_${yearId}_${setId}`;
    let variations = await cacheService.get(cacheKey);
    
    if (!variations) {
      const data = await this.makeRequest(`/categories/1/search_schemas/3/search?for_attributes=true&per=100&page=1&target_name=external[44]&target_type=Collectibles::Property&target_id=3&search_schema_id=3&category_id=1&external[45]=${sportId}&external[42]=${yearId}&external[43]=${setId}`, `Getting variations for sport ${sportId}, year ${yearId}, set ${setId}`);
      
      if (data && data.results) {
        variations = data.results.map(item => ({
          id: item.id,
          name: item.text,
          isApproved: item.is_approved
        }));
        
        await cacheService.set(cacheKey, variations, 3600);
      }
    }
    
    return variations || [];
  }

  // Get cards for a complete set (sport + year + set + variation)
  async getCards(sportId, yearId, setId, variationId, limit = 50) {
    const cacheKey = `getcardbase_cards_${sportId}_${yearId}_${setId}_${variationId}_${limit}`;
    let cards = await cacheService.get(cacheKey);
    
    if (!cards) {
      const params = {
        for_attributes: false,
        sort: 'card_number',
        per: limit,
        page: 1,
        target_name: 'internal[catalog_item_id_46]',
        search_schema_id: 3,
        category_id: 1,
        search: '',
        'external[42]': sportId,
        'external[43]': yearId,
        'external[44]': setId,
        'external[45]': variationId
      };
      
      const queryString = new URLSearchParams(params).toString();
      const data = await this.makeRequest(`/categories/1/search_schemas/3/search?${queryString}`, `Getting cards for complete set`);
      
      if (data && data.results) {
        cards = {
          cards: data.results.map(card => ({
            id: card.id,
            name: card.text,
            isApproved: card.is_approved
          })),
          meta: data.meta
        };
        
        await cacheService.set(cacheKey, cards, 3600);
      }
    }
    
    return cards || { cards: [], meta: {} };
  }

  // Search for card sets based on query
  async searchCardSets(query, limit = 10) {
    const cacheKey = `getcardbase_search_${query}_${limit}`;
    let results = await cacheService.get(cacheKey);
    
    if (!results) {
      // For now, return a simple search based on our ID mappings
      // This can be enhanced later with more sophisticated search
      results = this.searchInMappings(query, limit);
      await cacheService.set(cacheKey, results, 1800); // Cache for 30 minutes
    }
    
    return results;
  }

  // Search within our ID mappings
  searchInMappings(query, limit) {
    const searchTerm = query.toLowerCase();
    const results = [];
    
    // Search through sports
    Object.entries(this.idMappings.sports).forEach(([id, name]) => {
      if (name.toLowerCase().includes(searchTerm)) {
        results.push({
          id: `sport_${id}`,
          name: name,
          type: 'sport',
          sportId: id,
          description: `${name} trading cards`
        });
      }
    });
    
    // Search through years
    Object.entries(this.idMappings.years).forEach(([id, name]) => {
      if (name.toLowerCase().includes(searchTerm)) {
        results.push({
          id: `year_${id}`,
          name: name,
          type: 'year',
          yearId: id,
          description: `${name} trading cards`
        });
      }
    });
    
    // Search through sets
    Object.entries(this.idMappings.sets).forEach(([id, name]) => {
      if (name.toLowerCase().includes(searchTerm)) {
        results.push({
          id: `set_${id}`,
          name: name,
          type: 'set',
          setId: id,
          description: `${name} trading card set`
        });
      }
    });
    
    return results.slice(0, limit);
  }

  // Build a comprehensive card set database
  async buildCardSetDatabase() {
    console.log('🏗️ GetCardBase: Building comprehensive card set database...');
    
    try {
      const database = [];
      
      // Get all sports
      const sports = await this.getSports();
      console.log(`📊 Found ${sports.length} sports`);
      
      // For each sport, get years
      for (const sport of sports.slice(0, 5)) { // Limit to first 5 sports for testing
        const years = await this.getYears(sport.id);
        console.log(`📊 Found ${years.length} years for ${sport.name}`);
        
        // For each year, get sets
        for (const year of years.slice(0, 3)) { // Limit to first 3 years for testing
          const sets = await this.getSets(sport.id, year.id);
          console.log(`📊 Found ${sets.length} sets for ${sport.name} ${year.name}`);
          
          // For each set, get variations
          for (const set of sets.slice(0, 5)) { // Limit to first 5 sets for testing
            const variations = await this.getVariations(sport.id, year.id, set.id);
            console.log(`📊 Found ${variations.length} variations for ${sport.name} ${year.name} ${set.name}`);
            
            // For each variation, get card count
            for (const variation of variations.slice(0, 3)) { // Limit to first 3 variations for testing
              const cardData = await this.getCards(sport.id, year.id, set.id, variation.id, 1);
              const cardCount = cardData.meta?.total_count || 0;
              
              database.push({
                id: `getcardbase_${sport.id}_${year.id}_${set.id}_${variation.id}`,
                name: `${year.name} ${set.name} ${variation.name}`,
                sport: sport.name,
                sportId: sport.id,
                year: year.name,
                yearId: year.id,
                set: set.name,
                setId: set.id,
                variation: variation.name,
                variationId: variation.id,
                cardCount: cardCount,
                source: 'getcardbase',
                lastUpdated: new Date().toISOString()
              });
            }
          }
        }
      }
      
      console.log(`✅ GetCardBase: Built database with ${database.length} card sets`);
      return database;
      
    } catch (error) {
      console.error('❌ GetCardBase: Error building database:', error.message);
      return [];
    }
  }

  // Get the card set database (cached)
  async getCardSetDatabase() {
    const cacheKey = 'getcardbase_card_set_database';
    let database = await cacheService.get(cacheKey);
    
    if (!database) {
      database = await this.buildCardSetDatabase();
      await cacheService.set(cacheKey, database, 3600); // Cache for 1 hour
    }
    
    return database;
  }
}

module.exports = new GetCardBaseService(); 