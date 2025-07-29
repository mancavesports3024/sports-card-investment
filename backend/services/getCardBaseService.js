const axios = require('axios');
const cacheService = require('./cacheService');

class GetCardBaseService {
  constructor() {
    this.baseURL = 'https://api.getcardbase.com/collectibles/api/mobile/v1';
    this.headers = {
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
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
    
    // Property IDs we identified as valuable for card sets
    this.propertyIds = {
      BRAND_MANUFACTURER: 1,  // Contains brands like Topps, Panini, etc.
      SET_SERIES: 2,          // Contains set names like Chrome, Prizm, etc.
      YEAR: 3,                // Contains years and vintage sets
      SPORT: 4,               // Contains sports
      LEAGUE: 5               // Contains leagues
    };
  }

  async makeRequest(endpoint, description = 'API request') {
    try {
      console.log(`📡 GetCardBase: ${description}...`);
      const response = await axios.get(`${this.baseURL}${endpoint}`, { 
        headers: this.headers, 
        timeout: 15000 
      });
      console.log(`✅ GetCardBase: ${description} - Success (${response.status})`);
      return response.data;
    } catch (error) {
      console.log(`❌ GetCardBase: ${description} - Error: ${error.response?.status || 'Unknown'} - ${error.message}`);
      return null;
    }
  }

  async getPropertyValues(propertyId, per = 100, page = 1) {
    const endpoint = `/categories/1/search_schemas/3/search?per=${per}&page=${page}&target_name=external[45]&target_type=Collectibles::Property&target_id=${propertyId}`;
    const data = await this.makeRequest(endpoint, `Getting property ${propertyId} values`);
    
    if (data && data.results) {
      return data.results.map(result => ({
        id: result.id,
        text: result.text,
        attributeId: result.attribute_id,
        isApproved: result.is_approved
      }));
    }
    return [];
  }

  async getAllPropertyValues(propertyId) {
    const allValues = [];
    let page = 1;
    let hasMore = true;
    
    while (hasMore) {
      const values = await this.getPropertyValues(propertyId, 100, page);
      if (values.length === 0) {
        hasMore = false;
      } else {
        allValues.push(...values);
        page++;
        // Limit to prevent infinite loops
        if (page > 10) {
          console.log(`⚠️ GetCardBase: Stopping at page ${page} for property ${propertyId} to prevent infinite loop`);
          hasMore = false;
        }
      }
    }
    
    return allValues;
  }

  // Extract and clean brand/manufacturer data
  extractBrands(values) {
    const brands = values
      .filter(value => value.isApproved)
      .map(value => value.text.trim())
      .filter(text => {
        const lower = text.toLowerCase();
        // Be more inclusive - include any text that might be a brand
        return lower.includes('topps') || 
               lower.includes('panini') || 
               lower.includes('bowman') || 
               lower.includes('upper deck') ||
               lower.includes('fleer') ||
               lower.includes('donruss') ||
               lower.includes('score') ||
               lower.includes('leaf') ||
               lower.includes('skybox') ||
               lower.includes('stadium club') ||
               lower.includes('finest') ||
               lower.includes('chrome') ||
               lower.includes('prizm') ||
               lower.includes('select') ||
               lower.includes('mosaic') ||
               lower.includes('optic') ||
               lower.includes('contenders') ||
               lower.includes('national treasures') ||
               lower.includes('immaculate') ||
               lower.includes('flawless') ||
               // Add more inclusive patterns
               lower.includes('2025') ||
               lower.includes('2024') ||
               lower.includes('2023') ||
               lower.includes('2022') ||
               lower.includes('2021') ||
               lower.includes('2020') ||
               lower.includes('2019') ||
               lower.includes('2018') ||
               lower.includes('2017') ||
               lower.includes('2016') ||
               lower.includes('2015') ||
               lower.includes('2014') ||
               lower.includes('2013') ||
               lower.includes('2012') ||
               lower.includes('2011') ||
               lower.includes('2010') ||
               lower.includes('2009') ||
               lower.includes('2008') ||
               lower.includes('2007') ||
               lower.includes('2006') ||
               lower.includes('2005') ||
               lower.includes('2004') ||
               lower.includes('2003') ||
               lower.includes('2002') ||
               lower.includes('2001') ||
               lower.includes('2000') ||
               lower.includes('1999') ||
               lower.includes('1998') ||
               lower.includes('1997') ||
               lower.includes('1996') ||
               lower.includes('1995') ||
               lower.includes('1994') ||
               lower.includes('1993') ||
               lower.includes('1992') ||
               lower.includes('1991') ||
               lower.includes('1990');
      })
      .map(brand => ({
        name: brand,
        type: 'brand',
        source: 'getcardbase'
      }));
    
    return brands;
  }

  // Extract and clean set/series data
  extractSets(values) {
    const sets = values
      .filter(value => value.isApproved)
      .map(value => value.text.trim())
      .filter(text => {
        const lower = text.toLowerCase();
        // Filter for actual set names, not just random text
        return (lower.includes('series') || 
                lower.includes('chrome') || 
                lower.includes('prizm') || 
                lower.includes('select') ||
                lower.includes('mosaic') ||
                lower.includes('optic') ||
                lower.includes('finest') ||
                lower.includes('tribute') ||
                lower.includes('tier one') ||
                lower.includes('transcendent') ||
                lower.includes('triple threads') ||
                lower.includes('clearly authentic') ||
                lower.includes('update') ||
                lower.includes('heritage') ||
                lower.includes('archives') ||
                lower.includes('gallery') ||
                lower.includes('stadium club') ||
                lower.includes('bowman') ||
                lower.includes('draft') ||
                lower.includes('prospects') ||
                lower.includes('rookie') ||
                lower.includes('autograph') ||
                lower.includes('signature') ||
                lower.includes('relic') ||
                lower.includes('patch') ||
                lower.includes('numbered') ||
                lower.includes('refractor') ||
                lower.includes('parallel')) &&
               !lower.includes('printing plate') &&
               !lower.includes('error') &&
               !lower.includes('variation');
      })
      .map(set => ({
        name: set,
        type: 'set',
        source: 'getcardbase'
      }));
    
    return sets;
  }

  // Extract and clean year data
  extractYears(values) {
    const years = values
      .filter(value => value.isApproved)
      .map(value => value.text.trim())
      .filter(text => {
        // Look for year patterns (4 digits) or vintage set years
        const yearMatch = text.match(/\b(19|20)\d{2}\b/);
        return yearMatch || text.toLowerCase().includes('vintage') || text.toLowerCase().includes('retro');
      })
      .map(year => ({
        name: year,
        type: 'year',
        source: 'getcardbase'
      }));
    
    return years;
  }

  // Extract and clean sport data
  extractSports(values) {
    const sports = values
      .filter(value => value.isApproved)
      .map(value => value.text.trim())
      .filter(text => {
        const lower = text.toLowerCase();
        return lower.includes('baseball') || 
               lower.includes('football') || 
               lower.includes('basketball') || 
               lower.includes('hockey') ||
               lower.includes('soccer') ||
               lower.includes('golf') ||
               lower.includes('tennis') ||
               lower.includes('racing') ||
               lower.includes('ufc') ||
               lower.includes('wrestling') ||
               lower.includes('pokemon') ||
               lower.includes('yugioh') ||
               lower.includes('magic');
      })
      .map(sport => ({
        name: sport,
        type: 'sport',
        source: 'getcardbase'
      }));
    
    return sports;
  }

  // Build comprehensive card set database
  async buildCardSetDatabase() {
    console.log('🔧 GetCardBase: Building comprehensive card set database...');
    
    try {
      // Get all property values
      const [brandValues, setValues, yearValues, sportValues] = await Promise.all([
        this.getAllPropertyValues(this.propertyIds.BRAND_MANUFACTURER),
        this.getAllPropertyValues(this.propertyIds.SET_SERIES),
        this.getAllPropertyValues(this.propertyIds.YEAR),
        this.getAllPropertyValues(this.propertyIds.SPORT)
      ]);

      console.log(`📊 GetCardBase: Retrieved data - Brands: ${brandValues.length}, Sets: ${setValues.length}, Years: ${yearValues.length}, Sports: ${sportValues.length}`);

      // Extract and clean data
      const brands = this.extractBrands(brandValues);
      const sets = this.extractSets(setValues);
      const years = this.extractYears(yearValues);
      const sports = this.extractSports(sportValues);

      console.log(`🎯 GetCardBase: Extracted - Brands: ${brands.length}, Sets: ${sets.length}, Years: ${years.length}, Sports: ${sports.length}`);

      // Build comprehensive card set combinations
      const cardSets = [];
      
      // Combine brands with sets and years
      brands.forEach(brand => {
        sets.forEach(set => {
          years.forEach(year => {
            // Create card set object
            const cardSet = {
              id: `gcb_${brand.name}_${set.name}_${year.name}`.replace(/\s+/g, '_').toLowerCase(),
              name: `${brand.name} ${set.name} ${year.name}`,
              brand: brand.name,
              set: set.name,
              year: year.name,
              sport: 'Baseball', // Default, can be enhanced later
              league: 'MLB', // Default, can be enhanced later
              setType: 'Standard',
              cardCount: 0, // Unknown from this source
              description: `${brand.name} ${set.name} ${year.name} trading card set`,
              releaseMonth: 'Unknown',
              retailPrice: 0,
              hobbyPrice: 0,
              popularity: 'Medium',
              rookieCards: 'Unknown',
              inserts: 'Unknown',
              variations: 'Unknown',
              imageUrl: '',
              source: 'getcardbase',
              lastUpdated: new Date().toISOString()
            };
            
            cardSets.push(cardSet);
          });
        });
      });

      console.log(`🏗️ GetCardBase: Built ${cardSets.length} card set combinations`);

      // Cache the results
      await cacheService.set('getcardbase_card_sets', cardSets, 3600); // Cache for 1 hour
      
      return {
        success: true,
        totalSets: cardSets.length,
        brands: brands.length,
        sets: sets.length,
        years: years.length,
        sports: sports.length,
        cardSets: cardSets
      };

    } catch (error) {
      console.error('❌ GetCardBase: Error building card set database:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get cached card set database
  async getCardSetDatabase() {
    try {
      const cached = await cacheService.get('getcardbase_card_sets');
      if (cached) {
        console.log('📋 GetCardBase: Retrieved cached card set database');
        return cached;
      }
      
      console.log('🔄 GetCardBase: Cache miss, building new database...');
      const result = await this.buildCardSetDatabase();
      return result.success ? result.cardSets : [];
      
    } catch (error) {
      console.error('❌ GetCardBase: Error getting card set database:', error.message);
      return [];
    }
  }

  // Search card sets by query
  async searchCardSets(query, limit = 20) {
    try {
      const cardSets = await this.getCardSetDatabase();
      if (!cardSets || cardSets.length === 0) {
        return [];
      }

      const searchTerm = query.toLowerCase();
      const matches = cardSets.filter(set => 
        set.name.toLowerCase().includes(searchTerm) ||
        set.brand.toLowerCase().includes(searchTerm) ||
        set.set.toLowerCase().includes(searchTerm) ||
        set.year.toLowerCase().includes(searchTerm)
      );

      return matches.slice(0, limit);
      
    } catch (error) {
      console.error('❌ GetCardBase: Error searching card sets:', error.message);
      return [];
    }
  }
}

module.exports = new GetCardBaseService(); 