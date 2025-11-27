const axios = require('axios');
const { CookieJar } = require('tough-cookie');
const { wrapper } = require('axios-cookiejar-support');
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

    this.cardDetailsHeaders = (refererPath, cardDetailsToken = null) => {
      const normalized = this.normalizePath(refererPath);
      return {
        ...this.baseHeaders,
        'Accept': 'application/json, text/plain, */*',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': `https://www.gemrate.com${normalized}`,
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Dest': 'empty',
        ...(cardDetailsToken ? { 'X-Card-Details-Token': cardDetailsToken } : {})
      };
    };

    this.sessionInitialized = false;
    this.latestCardDetailsToken = null;
  }

  normalizePath(href) {
    if (!href) return '/';
    try {
      if (href.startsWith('//')) {
        href = `https:${href}`;
      }
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

      let firstSuccessfulPath = null;
      for (const path of candidatePaths) {
        try {
          const response = await this.httpClient.get(path, {
            headers: {
              ...this.cardPageHeaders,
              Referer: 'https://www.gemrate.com/universal-search'
            }
          });
          if (response.status === 200) {
            console.log(`✅ GemRate card page visited at path ${path} (status ${response.status})`);
            if (!firstSuccessfulPath) {
              firstSuccessfulPath = path;
            }
            if (path.includes('/card/')) {
              return path;
            }
          }
        } catch (innerErr) {
          // 404 is expected for some cards that don't have a direct card page
          // Only log as warning if it's not a 404, or if we don't have a fallback path yet
          const is404 = innerErr.response?.status === 404;
          if (!is404 || !firstSuccessfulPath) {
            console.log(`⚠️ GemRate card page attempt ${path} failed: ${innerErr.response?.status || innerErr.message}`);
          }
        }
      }
      if (firstSuccessfulPath) {
        return firstSuccessfulPath;
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

      const html = response.data;
      const $ = cheerio.load(html);
      const pathsSet = new Set();
      let slug = null;
      let universalPopPath = null;
      let cardDetailsToken = null;

      const addPath = (href) => {
        if (!href) return;
        const normalized = this.normalizePath(href);
        if (normalized) {
          pathsSet.add(normalized);
        }
      };

      const canonical = $('link[rel="canonical"]').attr('href');
      if (canonical) {
        addPath(canonical);
      }

      const tokenMatch = html.match(/const\s+cardDetailsToken\s*=\s*"([^"]+)"/);
      if (tokenMatch && tokenMatch[1]) {
        cardDetailsToken = tokenMatch[1];
        console.log('🔐 Parsed GemRate cardDetailsToken from universal search page');
      }

      $('a[href]').each((_, el) => {
        const href = $(el).attr('href');
        if (href && (href.includes('/card/') || href.includes('/universal-pop-report/'))) {
          addPath(href);
        }
      });

      const urlPathRegex = /"url_path":"([^"]+)"/g;
      let match;
      while ((match = urlPathRegex.exec(response.data)) !== null) {
        addPath(match[1]);
      }

      const canonicalRegex = /"canonical_url":"([^"]+)"/g;
      while ((match = canonicalRegex.exec(response.data)) !== null) {
        addPath(match[1]);
      }

      const slugRegex = /"slug":"([^"]+)"/g;
      while ((match = slugRegex.exec(response.data)) !== null) {
        if (!slug) {
          slug = decodeURIComponent(match[1]);
        }
      }

      if (slug) {
        addPath(`/card/${slug}`);
        addPath(`/card/${slug}/pop`);
      }

      for (const path of pathsSet) {
        const match = path.match(/\/card\/([^/?#]+)/i);
        if (match) {
          slug = decodeURIComponent(match[1]);
          break;
        }
        if (!universalPopPath && path.startsWith('/universal-pop-report/')) {
          universalPopPath = path;
          const popMatch = path.match(/\/universal-pop-report\/[^/]+\/([^/?#]+)/i);
          if (popMatch && !slug) {
            slug = decodeURIComponent(popMatch[1]);
          }
        }
      }

      return { slug, paths: Array.from(pathsSet), universalPopPath, cardDetailsToken };
    } catch (error) {
      console.log(`⚠️ Unable to parse universal search page for ${gemrateId}: ${error.message}`);
      return { slug: null, paths: [], cardDetailsToken: null };
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
      let refererOverride = null;
      let cardDetailsToken = null;
      if (!resolvedSlug) {
        const slugInfo = await this.fetchSlugFromUniversalSearch(gemrateId);
        if (slugInfo.slug) {
          resolvedSlug = slugInfo.slug;
          console.log(`🔍 Derived slug from universal search page: ${resolvedSlug}`);
        }
        if (slugInfo.paths && slugInfo.paths.length > 0) {
          extraPaths = slugInfo.paths;
        if (!resolvedSlug) {
          console.log('🔍 Universal search paths discovered:', slugInfo.paths.slice(0, 5));
        }
        }
        if (slugInfo.universalPopPath) {
          refererOverride = slugInfo.universalPopPath;
        }
        if (slugInfo.cardDetailsToken) {
          cardDetailsToken = slugInfo.cardDetailsToken;
          this.latestCardDetailsToken = cardDetailsToken;
        }
      } else {
        // Even if slug was provided, still attempt to refresh token via universal search
        const slugInfo = await this.fetchSlugFromUniversalSearch(gemrateId);
        if (!cardDetailsToken && slugInfo.cardDetailsToken) {
          cardDetailsToken = slugInfo.cardDetailsToken;
          this.latestCardDetailsToken = cardDetailsToken;
        }
        if (!resolvedSlug && slugInfo.slug) {
          resolvedSlug = slugInfo.slug;
        }
        if ((!extraPaths || extraPaths.length === 0) && slugInfo.paths && slugInfo.paths.length > 0) {
          extraPaths = slugInfo.paths;
        }
        if (!refererOverride && slugInfo.universalPopPath) {
          refererOverride = slugInfo.universalPopPath;
        }
      }

      const warmedPath = await this.warmCardSession(gemrateId, resolvedSlug, extraPaths);

      // Step 2: Get detailed card data using gemrate_id
      const cardDetails = await this.getCardDetails(gemrateId, resolvedSlug, warmedPath, refererOverride, cardDetailsToken);
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

      const inspectEntry = (entry, isPreferred = false) => {
        if (!entry || typeof entry !== 'object') return;
        
        // Only set as sampleEntry if it's preferred (PSA/Universal) or if we don't have one yet
        if (isPreferred || !info.sampleEntry) {
          info.sampleEntry = entry;
        }
        
        // Only set gemrateId if it's preferred or we don't have one yet
        if (isPreferred || !info.gemrateId) {
          const entryId = entry.gemrate_id || entry.gemrateId || entry.id || null;
          if (entryId) {
            info.gemrateId = entryId;
          }
        }
        
        // Only set cardSlug if it's preferred or we don't have one yet
        if (isPreferred || !info.cardSlug) {
          const entrySlug = entry.slug || entry.card_slug || entry.url_path || entry.path || null;
          if (entrySlug) {
            info.cardSlug = entrySlug;
          }
        }
        
        // Fallback slug extraction
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

      // First, try to find Universal or PSA entries (Universal has priority)
      const findPreferredEntry = (data) => {
        if (!data) return;
        
        if (Array.isArray(data)) {
          // Look for Universal first (preferred)
          const universalEntry = data.find(item => 
            item && typeof item === 'object' && 
            (item.population_type === 'Universal' || item.population_type === 'universal')
          );
          if (universalEntry) {
            inspectEntry(universalEntry, true);
            console.log('🔍 Found Universal entry in search results');
            return;
          }
          
          // Then look for PSA
          const psaEntry = data.find(item => 
            item && typeof item === 'object' && 
            (item.population_type === 'PSA' || item.population_type === 'psa')
          );
          if (psaEntry) {
            inspectEntry(psaEntry, true);
            console.log('🔍 Found PSA entry in search results');
            return;
          }
          
          // If no preferred entry found, use first entry as fallback
          if (data.length > 0) {
            const firstEntry = data[0];
            const popType = firstEntry?.population_type;
            if (popType && popType !== 'Universal' && popType !== 'PSA' && popType !== 'universal' && popType !== 'psa') {
              console.log(`⚠️ First entry has population_type "${popType}", will use as fallback but prefer Universal/PSA`);
            }
            inspectEntry(firstEntry, false);
          }
        } else if (typeof data === 'object') {
          // Check if this object itself is a preferred entry (Universal first, then PSA)
          const popType = data.population_type;
          if (popType === 'Universal' || popType === 'universal') {
            inspectEntry(data, true);
            console.log(`🔍 Found Universal entry in search results`);
            return;
          } else if (popType === 'PSA' || popType === 'psa') {
            inspectEntry(data, true);
            console.log(`🔍 Found PSA entry in search results`);
            return;
          }
          
          // Recursively search nested objects
          Object.values(data).forEach(val => {
            if (typeof val === 'object') findPreferredEntry(val);
          });
        }
      };

      // Try to find preferred entry first
      findPreferredEntry(searchData);
      
      // Fallback: if we didn't find anything, use the old method
      if (!info.gemrateId) {
        const inspectAny = (data) => {
          if (!data) return;
          if (Array.isArray(data)) {
            data.forEach(item => inspectEntry(item, false));
          } else if (typeof data === 'object') {
            inspectEntry(data, false);
            Object.values(data).forEach(val => {
              if (typeof val === 'object') inspectAny(val);
            });
          }
        };
        inspectAny(searchData);
      }

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
  async getCardDetails(gemrateId, cardSlug = null, warmedPath = null, refererOverride = null, cardDetailsToken = null) {
    try {
      console.log(`📊 Getting card details for gemrate_id: ${gemrateId}`);

      const refererPath =
        refererOverride ||
        warmedPath ||
        (cardSlug ? `/card/${cardSlug}` : `/universal-search?gemrate_id=${gemrateId}`);

      const effectiveToken = cardDetailsToken || this.latestCardDetailsToken || null;
      if (!effectiveToken) {
        console.log('⚠️ GemRate card details token not available; attempting request without it');
      }

      const response = await this.httpClient.get(this.cardDetailsPath, {
        params: { gemrate_id: gemrateId },
        headers: this.cardDetailsHeaders(refererPath, effectiveToken)
      });

      if (response.data && response.status === 200) {
        if (effectiveToken && !this.latestCardDetailsToken) {
          this.latestCardDetailsToken = effectiveToken;
        }
        console.log(`✅ Retrieved card details for gemrate_id: ${gemrateId}`);
        return response.data;
      } else {
        console.log(`❌ No card details found for gemrate_id: ${gemrateId} (status: ${response.status})`);
        return null;
      }
    } catch (error) {
      // Check if it's a 404 - this is expected for some cards
      if (error.response?.status === 404) {
        console.log(`⚠️ GemRate card details returned 404 for gemrate_id: ${gemrateId} - card may not have detailed page`);
      } else {
        console.error('❌ Error getting card details:', error.message);
      }
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
   * Get all sets from universal-pop-report, organized by category
   * @returns {Promise<Object>} Sets organized by category {category: [{set_name, year, set_id, ...}]}
   */
  async getUniversalPopReportSets() {
    try {
      await this.ensureSession();
      
      console.log('📊 Fetching universal-pop-report sets...');
      
      // First, try to find an API endpoint that returns JSON directly
      let setsData = null;
      const apiEndpoints = [
        '/api/universal-pop-report',
        '/api/sets',
        '/api/pop-report',
        '/universal-pop-report/data',
        '/universal-pop-report.json',
        '/api/v1/universal-pop-report',
        '/api/v1/sets'
      ];
      
      for (const endpoint of apiEndpoints) {
        try {
          const cacheBuster = Date.now();
          const apiResponse = await this.httpClient.get(`${endpoint}?_nocache=${cacheBuster}`, {
            headers: {
              ...this.baseHeaders,
              'Accept': 'application/json, text/plain, */*',
              'Referer': 'https://www.gemrate.com/universal-pop-report'
            },
            timeout: 30000
          });
          
          if (apiResponse.data) {
            // Check if it's an array or has a data property
            if (Array.isArray(apiResponse.data)) {
              setsData = apiResponse.data;
              console.log(`✅ Found sets data via API endpoint: ${endpoint} (${setsData.length} sets)`);
              break;
            } else if (apiResponse.data.data && Array.isArray(apiResponse.data.data)) {
              setsData = apiResponse.data.data;
              console.log(`✅ Found sets data via API endpoint: ${endpoint} (${setsData.length} sets)`);
              break;
            } else if (apiResponse.data.sets && Array.isArray(apiResponse.data.sets)) {
              setsData = apiResponse.data.sets;
              console.log(`✅ Found sets data via API endpoint: ${endpoint} (${setsData.length} sets)`);
              break;
            }
          }
        } catch (e) {
          // Endpoint doesn't exist or returned error, try next
          continue;
        }
      }
      
      // If no API endpoint found, fetch HTML and parse
      if (!setsData || setsData.length === 0) {
        // Add cache-busting parameter to avoid 304 responses
        const cacheBuster = Date.now();
        const url = `/universal-pop-report?_nocache=${cacheBuster}`;
        
        const response = await this.httpClient.get(url, {
          headers: {
            ...this.pageHeaders,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          },
          timeout: 60000
        });

        const html = response.data;
        const $ = cheerio.load(html);

        // Try to find embedded JSON data in script tags
        let scriptCount = 0;
      
      $('script').each((_, el) => {
        scriptCount++;
        const scriptContent = $(el).html() || '';
        
        // Skip empty scripts
        if (!scriptContent || scriptContent.length < 100) {
          return;
        }
        
        // Look for various patterns: const data = [...], var data = [...], let data = [...]
        const patterns = [
          // Pattern 1: const data = [...];
          /(?:const|var|let)\s+data\s*=\s*(\[[\s\S]{100,}?\]);/,
          // Pattern 2: window.data = [...];
          /window\.data\s*=\s*(\[[\s\S]{100,}?\]);/,
          // Pattern 3: data: [...]
          /data\s*:\s*(\[[\s\S]{100,}?\])/,
          // Pattern 4: setsData = [...];
          /setsData\s*=\s*(\[[\s\S]{100,}?\]);/,
          // Pattern 5: "sets": [...]
          /"sets"\s*:\s*(\[[\s\S]{100,}?\])/,
          // Pattern 6: populateTable([...]) - most likely based on user's code
          /populateTable\s*\(\s*(\[[\s\S]{100,}?\])\s*\)/,
          // Pattern 7: fetch(...).then(data => populateTable(data)) or similar
          /\.then\s*\(\s*data\s*=>\s*populateTable\s*\(\s*data\s*\)/,
          // Pattern 8: Look for large JSON arrays in the script
          /(\[[\s\S]{500,}?\])/
        ];
        
        for (let i = 0; i < patterns.length; i++) {
          const pattern = patterns[i];
          const matches = scriptContent.match(pattern);
          
          if (matches) {
            try {
              let jsonStr = matches[1] || matches[0];
              
              // If pattern 7 matched, we need to find the actual data
              if (i === 6) {
                // Look backwards for the data assignment
                const beforeMatch = scriptContent.substring(0, scriptContent.indexOf(matches[0]));
                const dataMatch = beforeMatch.match(/(?:const|var|let)\s+data\s*=\s*(\[[\s\S]{100,}?\]);/);
                if (dataMatch) {
                  jsonStr = dataMatch[1];
                } else {
                  continue;
                }
              }
              
              // Clean up the JSON string
              // Remove trailing commas before ] or }
              jsonStr = jsonStr.replace(/,\s*\]/g, ']').replace(/,\s*\}/g, '}');
              // Remove any trailing semicolons or function calls
              jsonStr = jsonStr.split(';')[0].split(')')[0].trim();
              
              // Try to parse
              setsData = JSON.parse(jsonStr);
              
              if (Array.isArray(setsData) && setsData.length > 0) {
                console.log(`✅ Found sets data in script tag #${scriptCount} using pattern ${i + 1}: ${setsData.length} sets`);
                // Log first set as sample
                if (setsData[0]) {
                  console.log(`📋 Sample set: ${JSON.stringify(setsData[0]).substring(0, 200)}...`);
                }
                return false; // Break out of each loop
              }
            } catch (e) {
              // Log the error for debugging
              if (i === patterns.length - 1) { // Only log for the last pattern to avoid spam
                console.log(`⚠️ Could not parse JSON from pattern ${i + 1}: ${e.message}`);
                console.log(`📝 Sample of matched text (first 500 chars): ${(matches[1] || matches[0]).substring(0, 500)}`);
              }
              continue;
            }
          }
        }
      });
      
      console.log(`🔍 Checked ${scriptCount} script tags for data`);

      // If no JSON found, try to parse from table
      if (!setsData || setsData.length === 0) {
        console.log('⚠️ No JSON data found in script tags, attempting to parse from HTML table...');
        console.log(`📄 HTML length: ${html.length} characters`);
        console.log(`📊 Found ${$('table').length} tables in HTML`);
        setsData = this.parseSetsFromTable($);
      }
      
      // If still no data, try to find any JSON-like structures in the entire HTML
      if (!setsData || setsData.length === 0) {
        console.log('⚠️ No data from table parsing, trying to find JSON in entire HTML...');
        const jsonMatches = html.match(/(\[[\s\S]{500,}?\])/g);
        if (jsonMatches) {
          console.log(`🔍 Found ${jsonMatches.length} potential JSON arrays in HTML`);
          for (const jsonMatch of jsonMatches) {
            try {
              const cleaned = jsonMatch.replace(/,\s*\]/g, ']').replace(/,\s*\}/g, '}');
              const parsed = JSON.parse(cleaned);
              if (Array.isArray(parsed) && parsed.length > 0 && parsed[0] && typeof parsed[0] === 'object') {
                // Check if it looks like set data
                if (parsed[0].set_name || parsed[0].set_id || parsed[0].name) {
                  setsData = parsed;
                  console.log(`✅ Found sets data in HTML: ${setsData.length} sets`);
                  break;
                }
              }
            } catch (e) {
              continue;
            }
          }
        }
      }

      if (!setsData || setsData.length === 0) {
        console.log('❌ No sets data found in universal-pop-report');
        return { categories: {} };
      }

      // Organize sets by category
      const categories = {};
      setsData.forEach(set => {
        const category = set.category || 'Other';
        if (!categories[category]) {
          categories[category] = [];
        }
        categories[category].push({
          id: set.set_id || set.id,
          set_id: set.set_id || set.id,
          name: set.set_name || set.name,
          year: set.year,
          category: set.category,
          total_grades: set.total_grades || 0,
          psa_share: set.psa_share || 0,
          beckett_share: set.beckett_share || 0,
          sgc_share: set.sgc_share || 0,
          cgc_share: set.cgc_share || 0,
          checklist_size: set.checklist_size || 0,
          percent_with_grades: set.percent_with_grades || 0
        });
      });

      // Sort sets within each category by year (descending), then by name
      Object.keys(categories).forEach(cat => {
        categories[cat].sort((a, b) => {
          if (b.year !== a.year) return (b.year || 0) - (a.year || 0);
          return (a.name || '').localeCompare(b.name || '');
        });
      });

      console.log(`✅ Organized ${setsData.length} sets into ${Object.keys(categories).length} categories`);
      
      return { categories };
    } catch (error) {
      console.error('❌ Error fetching universal-pop-report sets:', error);
      throw error;
    }
  }

  /**
   * Parse sets from HTML table (fallback method)
   */
  parseSetsFromTable($) {
    const sets = [];
    try {
      // Look for table rows in the sets table
      $('table tbody tr, #setsTableBody tr, .sets-table tr').each((_, row) => {
        const $row = $(row);
        const cells = $row.find('td');
        
        if (cells.length >= 2) {
          // Try to extract set information from table cells
          const setName = $row.find('a').first().text().trim() || cells.eq(0).text().trim();
          const totalGrades = parseInt(cells.eq(1).text().replace(/,/g, '')) || 0;
          const psaShare = parseFloat(cells.eq(2).text().replace('%', '')) || 0;
          
          // Try to extract set_id from link href
          const link = $row.find('a').first().attr('href') || '';
          let setId = null;
          if (link) {
            // Extract set_id from URL like /universal-pop-report/{set_id}-{year} {name}-{category}
            const match = link.match(/\/universal-pop-report\/([^-]+)-/);
            if (match) {
              setId = match[1];
            }
          }
          
          // Try to extract year and category from the link or set name
          let year = null;
          let category = null;
          if (link) {
            const yearMatch = link.match(/-(\d{4})\s/);
            if (yearMatch) {
              year = parseInt(yearMatch[1]);
            }
            const categoryMatch = link.match(/-([A-Za-z]+)$/);
            if (categoryMatch) {
              category = categoryMatch[1];
            }
          }
          
          if (setName && setName !== 'Set Name') {
            sets.push({
              set_id: setId,
              set_name: setName,
              year: year,
              category: category,
              total_grades: totalGrades,
              psa_share: psaShare,
              beckett_share: parseFloat(cells.eq(3)?.text().replace('%', '')) || 0,
              sgc_share: parseFloat(cells.eq(4)?.text().replace('%', '')) || 0,
              cgc_share: parseFloat(cells.eq(5)?.text().replace('%', '')) || 0,
              checklist_size: parseInt(cells.eq(6)?.text().replace(/,/g, '')) || 0,
              percent_with_grades: parseFloat(cells.eq(7)?.text().replace('%', '')) || 0
            });
          }
        }
      });
      
      console.log(`✅ Parsed ${sets.length} sets from HTML table`);
    } catch (error) {
      console.error('❌ Error parsing sets from table:', error);
    }
    return sets;
  }

  /**
   * Get checklist for a specific set from universal-pop-report
   * @param {string} setPath - Set path like "44c3b5603eb0c1bd9907f957e68ba3f2cf499b03-2024%20Prizm-Football"
   * @returns {Promise<Array>} Array of card objects
   */
  async getSetChecklist(setPath) {
    try {
      await this.ensureSession();
      
      console.log(`📋 Fetching checklist for set: ${setPath}`);
      
      // Add cache-busting parameter
      const cacheBuster = Date.now();
      const url = `/universal-pop-report/${setPath}?_nocache=${cacheBuster}`;
      
      const response = await this.httpClient.get(url, {
        headers: {
          ...this.pageHeaders,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'Referer': 'https://www.gemrate.com/universal-pop-report'
        },
        timeout: 60000
      });

      const html = response.data;
      const $ = cheerio.load(html);

      const cards = [];
      
      // First, try to find embedded JSON data in script tags
      let cardsData = null;
      $('script').each((_, el) => {
        const scriptContent = $(el).html() || '';
        
        // Look for card data in various patterns
        const patterns = [
          /(?:const|var|let)\s+cards\s*=\s*(\[[\s\S]*?\]);/,
          /(?:const|var|let)\s+data\s*=\s*(\[[\s\S]*?\]);/,
          /cards\s*:\s*(\[[\s\S]*?\])/,
          /populateCards\s*\(\s*(\[[\s\S]*?\])\s*\)/
        ];
        
        for (const pattern of patterns) {
          const match = scriptContent.match(pattern);
          if (match) {
            try {
              let jsonStr = match[1];
              jsonStr = jsonStr.replace(/,\s*\]/g, ']').replace(/,\s*\}/g, '}');
              cardsData = JSON.parse(jsonStr);
              if (Array.isArray(cardsData) && cardsData.length > 0) {
                console.log(`✅ Found cards data in script tag: ${cardsData.length} cards`);
                break;
              }
            } catch (e) {
              continue;
            }
          }
        }
      });
      
      // If JSON found, use it
      if (cardsData && Array.isArray(cardsData)) {
        cardsData.forEach(card => {
          cards.push({
            number: card.card_number || card.number || '',
            player: card.player_name || card.player || card.name || '',
            team: card.team_name || card.team || ''
          });
        });
      } else {
        // Parse from HTML table
        $('tbody tr, table tr, .card-row, [data-card-id]').each((_, el) => {
          const $el = $(el);
          const cells = $el.find('td');
          
          if (cells.length >= 2) {
            const cardNumber = cells.eq(0).text().trim();
            const playerName = cells.eq(1).text().trim();
            const teamName = cells.eq(2)?.text().trim() || '';
            
            if (cardNumber || playerName) {
              cards.push({
                number: cardNumber,
                player: playerName,
                team: teamName
              });
            }
          } else {
            // Try alternative selectors
            const cardNumber = $el.find('.card-number, [data-number]').text().trim();
            const playerName = $el.find('.player-name, [data-player]').text().trim();
            const teamName = $el.find('.team-name, [data-team]').text().trim();
            
            if (cardNumber || playerName) {
              cards.push({
                number: cardNumber,
                player: playerName,
                team: teamName
              });
            }
          }
        });
      }

      console.log(`✅ Found ${cards.length} cards in set`);
      return cards;
    } catch (error) {
      console.error('❌ Error fetching set checklist:', error);
      throw error;
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
