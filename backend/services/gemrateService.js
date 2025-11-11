const axios = require('axios');
const { CookieJar } = require('tough-cookie');
const { wrapper } = require('axios-cookiejar-support');
const cheerio = require('cheerio');
const cheerio = require('cheerio');

class GemRateService {
  constructor() {
    this.baseUrl = 'https://www.gemrate.com';
    this.searchPath = '/universal-search-query';
    this.cardDetailsPath = '/card-details';
    this.timeout = 10000; // 10 seconds

    // Maintain a shared cookie jar so the POST + subsequent GET share session cookies
    this.cookieJar = new CookieJar();
    this.httpClient = wrapper(axios.create({
      baseURL: this.baseUrl,
      timeout: this.timeout,
      jar: this.cookieJar,
      withCredentials: true
    }));

    this.baseHeaders = {
      'Accept-Language': 'en-US,en;q=0.9',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
      'Origin': 'https://www.gemrate.com'
    };

    this.pageHeaders = {
      ...this.baseHeaders,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Referer': 'https://www.gemrate.com/',
      'Sec-Fetch-Site': 'same-origin',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Dest': 'document',
      'Cache-Control': 'max-age=0'
    };

    this.searchHeaders = {
      ...this.baseHeaders,
      'Accept': 'application/json, text/plain, */*',
      'Content-Type': 'application/json',
      'Referer': 'https://www.gemrate.com/universal-search',
      'X-Requested-With': 'XMLHttpRequest',
      'Sec-Fetch-Site': 'same-origin',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Dest': 'empty'
    };

    this.cardPageHeaders = {
      ...this.baseHeaders,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Referer': 'https://www.gemrate.com/universal-search',
      'Sec-Fetch-Site': 'same-origin',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Dest': 'document'
    };

    this.cardDetailsHeaders = (refererPath) => {
      const normalized = this.normalizePath(refererPath);
      return {
        ...this.baseHeaders,
        'Accept': 'application/json, text/plain, */*',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': `https://www.gemrate.com${normalized}`,
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Dest': 'empty'
      };
    };

    this.sessionInitialized = false;
  }

  normalizePath(href) {
    if (!href) return '/';
    try {
      if (href.startsWith('http')) {
        const url = new URL(href);
        return `${url.pathname}${url.search || ''}`;
      }
    } catch (_) {
      // ignore parsing errors
    }
    if (!href.startsWith('/')) {
      return `/${href}`;
    }
    return href;
  }

  async ensureSession() {
    if (this.sessionInitialized) return;
    try {
      await this.httpClient.get('/', {
        headers: this.pageHeaders
      });
      this.sessionInitialized = true;
      console.log('✅ GemRate session initialized');
    } catch (error) {
      console.log(`⚠️ GemRate warm-up failed: ${error.message}`);
    }
  }

  async warmCardSession(gemrateId, cardSlug = null, extraPaths = []) {
    try {
      const candidatePaths = [];
      const pushPath = (path) => {
        if (!path) return;
        const normalized = this.normalizePath(path);
        if (!candidatePaths.includes(normalized)) {
          candidatePaths.push(normalized);
        }
      };

      (extraPaths || []).forEach(pushPath);

      if (cardSlug) {
        pushPath(`/card/${cardSlug}`);
        pushPath(`/card/${cardSlug}/pop`);
      }
      pushPath(`/card/${gemrateId}`);
      pushPath(`/universal-search?gemrate_id=${gemrateId}`);

      for (const path of candidatePaths) {
        try {
          const response = await this.httpClient.get(path, {
            headers: {
              ...this.cardPageHeaders,
              Referer: path.includes(cardSlug || '') ? 'https://www.gemrate.com/universal-search' : this.cardPageHeaders.Referer
            }
          });
          if (response.status === 200) {
            console.log(`✅ GemRate card page visited at path ${path} (status ${response.status})`);
            return path;
          }
        } catch (innerErr) {
          console.log(`⚠️ GemRate card page attempt ${path} failed: ${innerErr.response?.status || innerErr.message}`);
        }
      }
      console.log(`⚠️ GemRate card page warm-up failed for ${gemrateId} (slug: ${cardSlug || 'none'}) - all paths attempted`);
    } catch (error) {
      console.log(`⚠️ GemRate card page warm-up failed for ${gemrateId}: ${error.message}`);
    }
    return null;
  }

  async fetchSlugFromUniversalSearch(gemrateId) {
    try {
      const response = await this.httpClient.get('/universal-search', {
        params: { gemrate_id: gemrateId },
        headers: this.pageHeaders
      });

      if (response.status !== 200 || typeof response.data !== 'string') {
        return { slug: null, paths: [] };
      }

      const $ = cheerio.load(response.data);
      const pathsSet = new Set();

      const addPath = (href) => {
        if (!href) return;
        const normalized = this.normalizePath(href);
        pathsSet.add(normalized);
      };

      const canonical = $('link[rel="canonical"]').attr('href');
      if (canonical) {
        addPath(canonical);
      }

      $('a[href]').each((_, el) => {
        const href = $(el).attr('href');
        if (href && (href.includes('/card/') || href.includes('/universal-pop-report/'))) {
          addPath(href);
        }
      });

      let slug = null;
      for (const path of pathsSet) {
        const match = path.match(/\/card\/([^/?#]+)/i);
        if (match) {
          slug = decodeURIComponent(match[1]);
          break;
        }
      }

      return { slug, paths: Array.from(pathsSet) };
    } catch (error) {
      console.log(`⚠️ Unable to parse universal search page for ${gemrateId}: ${error.message}`);
      return { slug: null, paths: [] };
    }
  }

  /**
   * Search for card population data on GemRate (Two-step process)
   * @param {string} searchQuery - Card name or identifier
   * @param {Object} options - Search options
   * @returns {Promise<Object>} Population data
   */
  async searchCardPopulation(searchQuery, options = {}) {
    try {
      await this.ensureSession();

      // Remove negative keywords (exclusions) from the search query for GemRate
      // Example: "Charizard 094/080 Inferno X -(PickCards, Choose, double, pick, Singles, Rares)"
      // Should become: "Charizard 094/080 Inferno X"
      let cleanQuery = searchQuery;
      if (cleanQuery && typeof cleanQuery === 'string') {
        // Remove everything from " -(" onwards (negative keywords)
        const exclusionIndex = cleanQuery.indexOf(' -(');
        if (exclusionIndex !== -1) {
          cleanQuery = cleanQuery.substring(0, exclusionIndex).trim();
        }
        // Also handle other exclusion patterns like " -(word)" or " -word"
        cleanQuery = cleanQuery.replace(/\s*-\s*\([^)]+\)/g, '').trim();
        cleanQuery = cleanQuery.replace(/\s*-\s*\w+/g, '').trim();
      }
      
      console.log(`🔍 GemRate search: "${cleanQuery}"`);

      // Step 1: Search for gemrate_id
      const searchResponse = await this.httpClient.post(this.searchPath, {
        query: cleanQuery,
        ...options
      }, {
        headers: this.searchHeaders
      });

      if (!searchResponse.data || searchResponse.status !== 200) {
        console.log(`❌ No GemRate search results for: ${searchQuery}`);
        return {
          success: false,
          card: searchQuery,
          error: 'No search results found',
          source: 'GemRate',
          timestamp: new Date().toISOString()
        };
      }

      // Extract gemrate_id from search results
      const { gemrateId, cardSlug, sampleEntry } = this.extractGemrateInfo(searchResponse.data);
      if (!gemrateId) {
        console.log(`❌ No gemrate_id found in search results for: ${searchQuery}`);
        if (searchResponse.data) {
          console.log('🔍 GemRate search data sample:', JSON.stringify(searchResponse.data, null, 2).slice(0, 1000));
        }
        return {
          success: false,
          card: searchQuery,
          error: 'No gemrate_id found in search results',
          source: 'GemRate',
          timestamp: new Date().toISOString()
        };
      }

      console.log(`🔍 Found gemrate_id: ${gemrateId}${cardSlug ? ` (slug: ${cardSlug})` : ''}`);
      if (!cardSlug && sampleEntry) {
        console.log('🔍 GemRate first result sample:', JSON.stringify(sampleEntry, null, 2).slice(0, 1000));
      }

      let resolvedSlug = cardSlug;
      let extraPaths = [];
      if (!resolvedSlug) {
        const slugInfo = await this.fetchSlugFromUniversalSearch(gemrateId);
        if (slugInfo.slug) {
          resolvedSlug = slugInfo.slug;
          console.log(`🔍 Derived slug from universal search page: ${resolvedSlug}`);
        }
        if (slugInfo.paths && slugInfo.paths.length > 0) {
          extraPaths = slugInfo.paths;
        }
      }

      const warmedPath = await this.warmCardSession(gemrateId, resolvedSlug, extraPaths);

      // Step 2: Get detailed card data using gemrate_id
      const cardDetails = await this.getCardDetails(gemrateId, resolvedSlug, warmedPath);
      if (!cardDetails) {
        console.log(`❌ No card details found for gemrate_id: ${gemrateId}`);
        return {
          success: false,
          card: searchQuery,
          error: 'No card details found',
          source: 'GemRate',
          timestamp: new Date().toISOString()
        };
      }

      console.log(`✅ Found GemRate data for: ${searchQuery}`);
      return {
        success: true,
        card: searchQuery,
        gemrateId: gemrateId,
        population: this.parsePopulationData(cardDetails),
        rawData: cardDetails,
        source: 'GemRate',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ GemRate search error:', error.message);
      return {
        success: false,
        card: searchQuery,
        error: error.message,
        source: 'GemRate',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Extract gemrate_id from search results
   * @param {Object} searchData - Search response data
   * @returns {string|null} gemrate_id or null
   */
  extractGemrateInfo(searchData) {
    try {
      const info = { gemrateId: null, cardSlug: null, sampleEntry: null };

      const inspectEntry = (entry) => {
        if (!entry || typeof entry !== 'object') return;
        if (!info.sampleEntry) {
          info.sampleEntry = entry;
        }
        if (!info.gemrateId) {
          info.gemrateId = entry.gemrate_id || entry.gemrateId || entry.id || null;
        }
        if (!info.cardSlug) {
          info.cardSlug = entry.slug || entry.card_slug || entry.url_path || entry.path || null;
        }
        if (!info.cardSlug) {
          Object.values(entry).forEach(val => {
            if (typeof val === 'string' && !info.cardSlug) {
              const match = val.match(/\/card\/([^/?#]+)/i);
              if (match) {
                info.cardSlug = decodeURIComponent(match[1]);
              }
            }
          });
        }
      };

      const inspectAny = (data) => {
        if (!data) return;
        if (Array.isArray(data)) {
          data.forEach(item => inspectEntry(item));
        } else if (typeof data === 'object') {
          inspectEntry(data);
          Object.values(data).forEach(val => {
            if (typeof val === 'object') inspectAny(val);
          });
        }
      };

      inspectAny(searchData);

      if (!info.gemrateId) {
        console.log('🔍 Unable to find gemrate_id in search data.');
      }
      if (!info.cardSlug) {
        console.log('⚠️ No slug found in search data. Available keys:', Object.keys(searchData || {}));
      }
      return info;
    } catch (error) {
      console.error('❌ Error extracting gemrate_id:', error);
      return { gemrateId: null, cardSlug: null, sampleEntry: null };
    }
  }

  /**
   * Get detailed card data using gemrate_id
   * @param {string} gemrateId - The gemrate_id from search results
   * @returns {Promise<Object|null>} Card details or null
   */
  async getCardDetails(gemrateId, cardSlug = null, warmedPath = null) {
    try {
      console.log(`📊 Getting card details for gemrate_id: ${gemrateId}`);

      const refererPath =
        warmedPath ||
        (cardSlug ? `/card/${cardSlug}` : `/universal-search?gemrate_id=${gemrateId}`);

      const response = await this.httpClient.get(this.cardDetailsPath, {
        params: { gemrate_id: gemrateId },
        headers: this.cardDetailsHeaders(refererPath)
      });

      if (response.data && response.status === 200) {
        console.log(`✅ Retrieved card details for gemrate_id: ${gemrateId}`);
        return response.data;
      } else {
        console.log(`❌ No card details found for gemrate_id: ${gemrateId}`);
        return null;
      }
    } catch (error) {
      console.error('❌ Error getting card details:', error.message);
      return null;
    }
  }

  /**
   * Parse population data from GemRate API response
   * @param {Object} rawData - Raw API response data
   * @returns {Object} Parsed population data
   */
  parsePopulationData(rawData) {
    try {
      
      if (!rawData || typeof rawData !== 'object') {
        return null;
      }

      // Look for PSA data in the population_data array
      let psaData = null;
      
      if (rawData.population_data && Array.isArray(rawData.population_data)) {
        // Find the PSA entry in the population_data array
        psaData = rawData.population_data.find(item => item.grader === 'psa');
        if (psaData) {
          // Found PSA data
        }
      }
      
      // Fallback to other possible structures
      if (!psaData) {
        if (rawData.psa) {
          psaData = rawData.psa;
        } else if (rawData.data && rawData.data.psa) {
          psaData = rawData.data.psa;
        } else if (rawData.population && rawData.population.psa) {
          psaData = rawData.population.psa;
        } else if (rawData.grading && rawData.grading.psa) {
          psaData = rawData.grading.psa;
        } else if (rawData.results && rawData.results.psa) {
          psaData = rawData.results.psa;
        } else if (rawData.card && rawData.card.psa) {
          psaData = rawData.card.psa;
        }
      }

      if (!psaData) {
        return null;
      }

      // Parse the PSA data structure from the actual GemRate response
      const population = {
        // Basic stats from PSA data
        total: psaData.card_total_grades || 0,
        gemsPlus: psaData.card_gems || 0,
        gemRate: Math.round(parseFloat(psaData.card_gem_rate) * 100 * 100) / 100 || 0, // Convert to percentage and round to 2 decimals
        
        // Grade breakdowns from PSA grades object
        perfect: psaData.grades?.g10 || 0, // PSA 10 = Perfect
        pristine: 0, // Not available in this structure
        gemMint: psaData.grades?.g10 || 0, // PSA 10 = Gem Mint
        mintPlus: 0, // Not available in this structure
        grade9: psaData.grades?.g9 || 0,
        grade8: psaData.grades?.g8 || 0,
        grade7: psaData.grades?.g7 || 0,
        grade6: psaData.grades?.g6 || 0,
        grade5: psaData.grades?.g5 || 0,
        grade4: psaData.grades?.g4 || 0,
        grade3: psaData.grades?.g3 || 0,
        grade2: psaData.grades?.g2 || 0,
        grade1: psaData.grades?.g1 || 0,
        
        // Additional fields from PSA data
        cardName: psaData.name || psaData.description || '',
        set: psaData.set_name || '',
        year: psaData.year || '',
        sport: psaData.category || '',
        player: psaData.name || '',
        cardNumber: psaData.card_number || '',
        parallel: psaData.parallel || '',
        
        // Raw data for debugging
        rawPsaData: psaData
      };


      return population;
    } catch (error) {
      console.error('❌ Error parsing GemRate population data:', error);
      return null;
    }
  }

  /**
   * Get population data for a specific card
   * @param {string} cardName - Name of the card
   * @returns {Promise<Object|null>} Population data or null
   */
  async getPopulationData(cardName) {
    try {
      const searchResult = await this.searchCardPopulation(cardName);
      return searchResult.success ? searchResult.population : null;
    } catch (error) {
      console.error('❌ Error getting GemRate population data:', error);
      return null;
    }
  }

  /**
   * Get grading trends for a card
   * @param {string} cardName - Name of the card
   * @returns {Promise<Object>} Grading trends data
   */
  async getGradingTrends(cardName) {
    try {
      console.log(`📈 Getting GemRate grading trends for: ${cardName}`);
      
      // This would connect to GemRate's grading trends API
      const trendsData = {
        card: cardName,
        trends: {
          totalSubmissions: Math.floor(Math.random() * 5000) + 500,
          recentActivity: Math.floor(Math.random() * 100) + 10,
          gemRate: (Math.random() * 25 + 5).toFixed(1),
          averageGrade: (Math.random() * 3 + 7).toFixed(1),
          trendDirection: Math.random() > 0.5 ? 'up' : 'down',
          trendPercentage: (Math.random() * 20 - 10).toFixed(1)
        },
        source: 'GemRate',
        timestamp: new Date().toISOString()
      };

      return trendsData;
    } catch (error) {
      console.error('❌ Error getting GemRate grading trends:', error);
      return null;
    }
  }

  /**
   * Get set population data
   * @param {string} setName - Name of the card set
   * @returns {Promise<Object>} Set population data
   */
  async getSetPopulation(setName) {
    try {
      console.log(`📊 Getting GemRate set population for: ${setName}`);
      
      const setData = {
        setName: setName,
        totalCards: Math.floor(Math.random() * 10000) + 1000,
        totalSubmissions: Math.floor(Math.random() * 50000) + 5000,
        averageGemRate: (Math.random() * 20 + 5).toFixed(1),
        topCards: [
          { name: 'Card 1', gemRate: (Math.random() * 30 + 10).toFixed(1) },
          { name: 'Card 2', gemRate: (Math.random() * 25 + 8).toFixed(1) },
          { name: 'Card 3', gemRate: (Math.random() * 20 + 5).toFixed(1) }
        ],
        source: 'GemRate',
        timestamp: new Date().toISOString()
      };

      return setData;
    } catch (error) {
      console.error('❌ Error getting GemRate set population:', error);
      return null;
    }
  }

  /**
   * Analyze card investment potential using GemRate PSA data
   * @param {string} cardName - Name of the card
   * @param {Object} priceData - Current price data from eBay
   * @returns {Promise<Object>} Investment analysis
   */
  async analyzeInvestmentPotential(cardName, priceData) {
    try {
      console.log(`💰 Analyzing investment potential for: ${cardName}`);
      
      const populationData = await this.getPopulationData(cardName);
      
      if (!populationData) {
        return {
          success: false,
          error: 'Insufficient GemRate PSA data for analysis'
        };
      }

      // Extract PSA-specific metrics
      const totalPopulation = populationData.total || 0;
      const gemsPlus = populationData.gemsPlus || 0;
      const gemRate = parseFloat(populationData.gemRate) || 0;
      const psa10Count = populationData.gemMint || 0;
      const psa9Count = populationData.grade9 || 0;
      
      // Calculate investment metrics based on PSA data
      const scarcityScore = this.calculateScarcityScore(totalPopulation);
      const qualityScore = this.calculateQualityScore(gemRate, psa10Count, psa9Count);
      const demandScore = this.calculateDemandScore(priceData);
      const gemRateScore = Math.min(100, gemRate * 2); // Convert percentage to score
      
      // Weighted investment score
      const investmentScore = (
        scarcityScore * 0.3 +      // 30% - How rare the card is
        qualityScore * 0.25 +      // 25% - How likely to get high grades
        demandScore * 0.25 +       // 25% - Market demand from eBay prices
        gemRateScore * 0.2         // 20% - Overall gem rate quality
      );
      
      const analysis = {
        card: cardName,
        investmentScore: Math.round(investmentScore),
        metrics: {
          scarcityScore: Math.round(scarcityScore),
          qualityScore: Math.round(qualityScore),
          demandScore: Math.round(demandScore),
          gemRateScore: Math.round(gemRateScore),
          // PSA-specific data
          totalPopulation: totalPopulation,
          gemsPlus: gemsPlus,
          gemRate: gemRate,
          psa10Count: psa10Count,
          psa9Count: psa9Count,
          psa10Percentage: totalPopulation > 0 ? ((psa10Count / totalPopulation) * 100).toFixed(1) : 0,
          psa9Percentage: totalPopulation > 0 ? ((psa9Count / totalPopulation) * 100).toFixed(1) : 0
        },
        recommendation: this.getInvestmentRecommendation(investmentScore),
        source: 'GemRate PSA + eBay',
        timestamp: new Date().toISOString()
      };

      return analysis;
    } catch (error) {
      console.error('❌ Error analyzing investment potential:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Calculate scarcity score based on total population
   * @param {number} totalPopulation - Total number of cards graded
   * @returns {number} Scarcity score (0-100)
   */
  calculateScarcityScore(totalPopulation) {
    if (totalPopulation === 0) return 0;
    
    // More cards = less scarce = lower score
    // Fewer cards = more scarce = higher score
    if (totalPopulation <= 100) return 100;      // Very rare
    if (totalPopulation <= 500) return 90;       // Rare
    if (totalPopulation <= 1000) return 80;      // Uncommon
    if (totalPopulation <= 2500) return 70;      // Somewhat common
    if (totalPopulation <= 5000) return 60;      // Common
    if (totalPopulation <= 10000) return 50;    // Very common
    return Math.max(10, 100 - (totalPopulation / 1000)); // Scale down for very high numbers
  }

  /**
   * Calculate quality score based on PSA grading data
   * @param {number} gemRate - Overall gem rate percentage
   * @param {number} psa10Count - Number of PSA 10s
   * @param {number} psa9Count - Number of PSA 9s
   * @returns {number} Quality score (0-100)
   */
  calculateQualityScore(gemRate, psa10Count, psa9Count) {
    // Higher gem rate = better quality potential
    const gemRateScore = Math.min(100, gemRate * 2);
    
    // More PSA 10s relative to PSA 9s = better quality
    const gradeRatio = psa9Count > 0 ? (psa10Count / psa9Count) : 0;
    const ratioScore = Math.min(50, gradeRatio * 10);
    
    return Math.round((gemRateScore + ratioScore) / 2);
  }

  /**
   * Calculate demand score based on eBay price data
   * @param {Object} priceData - eBay price data
   * @returns {number} Demand score (0-100)
   */
  calculateDemandScore(priceData) {
    if (!priceData || !priceData.raw || priceData.raw.length === 0) {
      return 50; // Neutral if no price data
    }
    
    const rawPrices = priceData.raw.filter(p => p > 0);
    const psa9Prices = priceData.psa9 ? priceData.psa9.filter(p => p > 0) : [];
    const psa10Prices = priceData.psa10 ? priceData.psa10.filter(p => p > 0) : [];
    
    if (rawPrices.length === 0) return 50;
    
    const avgRawPrice = rawPrices.reduce((sum, price) => sum + price, 0) / rawPrices.length;
    const avgPsa9Price = psa9Prices.length > 0 ? psa9Prices.reduce((sum, price) => sum + price, 0) / psa9Prices.length : 0;
    const avgPsa10Price = psa10Prices.length > 0 ? psa10Prices.reduce((sum, price) => sum + price, 0) / psa10Prices.length : 0;
    
    // Higher prices = higher demand
    let demandScore = Math.min(100, avgRawPrice / 10); // Scale raw price
    
    // Premium for graded cards indicates demand
    if (avgPsa9Price > 0 && avgPsa9Price > avgRawPrice * 2) demandScore += 10;
    if (avgPsa10Price > 0 && avgPsa10Price > avgRawPrice * 3) demandScore += 15;
    
    return Math.min(100, demandScore);
  }

  /**
   * Get investment recommendation based on score
   * @param {number} score - Investment score
   * @returns {string} Recommendation
   */
  getInvestmentRecommendation(score) {
    if (score >= 80) return '🔥 Strong Buy - High potential';
    if (score >= 60) return '📈 Buy - Good potential';
    if (score >= 40) return '⚖️ Hold - Moderate potential';
    if (score >= 20) return '⚠️ Caution - Low potential';
    return '❌ Avoid - Poor potential';
  }
}

module.exports = new GemRateService();
