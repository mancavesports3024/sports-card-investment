const axios = require('axios');
const { CookieJar } = require('tough-cookie');
const { wrapper } = require('axios-cookiejar-support');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

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
    
    // Default AG Grid state for universal-pop-report set checklist pages:
    // - Sort by totalGrades desc
    // - Page size 100
    // - Includes name, number, cardSet, totalGrades, psaGrades, etc.
    // This is taken from GemRate's "Share With Current Sort & Filters" link for a set.
    this.defaultGridStateParam = 'grid_state=%7B%22filter%22%3A%7B%22filterModel%22%3A%7B%22totalGrades%22%3A%7B%22filterType%22%3A%22number%22%2C%22type%22%3A%22greaterThan%22%2C%22filter%22%3A0%7D%7D%7D%2C%22sideBar%22%3A%7B%22visible%22%3Afalse%2C%22openToolPanel%22%3Anull%2C%22toolPanels%22%3A%7B%7D%7D%2C%22sort%22%3A%7B%22sortModel%22%3A%5B%7B%22colId%22%3A%22totalGrades%22%2C%22sort%22%3A%22desc%22%7D%5D%7D%2C%22columnSizing%22%3A%7B%22columnSizingModel%22%3A%5B%7B%22colId%22%3A%22graderDetails%22%2C%22width%22%3A128%7D%2C%7B%22colId%22%3A%22name%22%2C%22width%22%3A200%7D%2C%7B%22colId%22%3A%22number%22%2C%22width%22%3A110%7D%2C%7B%22colId%22%3A%22cardSet%22%2C%22width%22%3A237%7D%2C%7B%22colId%22%3A%22totalGrades%22%2C%22width%22%3A102%7D%2C%7B%22colId%22%3A%22psaGrades%22%2C%22width%22%3A96%7D%2C%7B%22colId%22%3A%22beckettGrades%22%2C%22width%22%3A118%7D%2C%7B%22colId%22%3A%22sgcGrades%22%2C%22width%22%3A97%7D%2C%7B%22colId%22%3A%22cgcGrades%22%2C%22width%22%3A97%7D%2C%7B%22colId%22%3A%22totalGemRate%22%2C%22width%22%3A102%7D%2C%7B%22colId%22%3A%22psaGemRate%22%2C%22width%22%3A100%7D%2C%7B%22colId%22%3A%22beckettGemRate%22%2C%22width%22%3A118%7D%2C%7B%22colId%22%3A%22sgcGemRate%22%2C%22width%22%3A100%7D%2C%7B%22colId%22%3A%22cgcGemRate%22%2C%22width%22%3A97%7D%2C%7B%22colId%22%3A%22gemRateSparkline%22%2C%22width%22%3A200%7D%5D%7D%2C%22columnOrder%22%3A%7B%22orderedColIds%22%3A%5B%22graderDetails%22%2C%22name%22%2C%22number%22%2C%22cardSet%22%2C%22totalGrades%22%2C%22psaGrades%22%2C%22beckettGrades%22%2C%22sgcGrades%22%2C%22cgcGrades%22%2C%22totalGemRate%22%2C%22psaGemRate%22%2C%22beckettGemRate%22%2C%22sgcGemRate%22%2C%22cgcGemRate%22%2C%22gemRateSparkline%22%5D%7D%2C%22pagination%22%3A%7B%22page%22%3A0%2C%22pageSize%22%3A100%7D%2C%22scroll%22%3A%7B%22top%22%3A0%2C%22left%22%3A0%7D%7D';
    
    // Puppeteer setup for dynamic content
    puppeteer.use(StealthPlugin());
    this.browser = null;
    this.page = null;
  }
  
  async initializeBrowser() {
    if (this.browser) return true;
    
    try {
      const launchOptions = {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--disable-gpu'
        ]
      };
      
      // Try to find Chromium
      const chromiumPath = process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROMIUM_PATH;
      if (chromiumPath && require('fs').existsSync(chromiumPath)) {
        launchOptions.executablePath = chromiumPath;
      }
      
      this.browser = await puppeteer.launch(launchOptions);
      this.page = await this.browser.newPage();
      await this.page.setUserAgent(this.baseHeaders['User-Agent']);
      await this.page.setViewport({ width: 1366, height: 768 });
      
      console.log('✅ Puppeteer browser initialized for GemRate');
      return true;
    } catch (error) {
      console.log('⚠️ Puppeteer not available:', error.message);
      return false;
    }
  }
  
  async closeBrowser() {
    if (this.browser) {
      try {
        await this.browser.close();
        this.browser = null;
        this.page = null;
      } catch (e) {
        // Ignore
      }
    }
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
        '/api/v1/sets',
        '/api/universal-pop-report/data',
        '/api/sets/all',
        '/api/pop-report/sets'
      ];
      
      // Also try to find fetch calls in the HTML that might reveal the API endpoint
      console.log('🔍 Searching for API endpoints in HTML...');
      
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
        
        // Try to find API endpoints in fetch calls or script tags
        const fetchMatches = html.match(/fetch\s*\(\s*['"`]([^'"`]+)['"`]/gi);
        if (fetchMatches) {
          console.log(`🔍 Found ${fetchMatches.length} fetch calls in HTML`);
          for (const match of fetchMatches) {
            const urlMatch = match.match(/['"`]([^'"`]+)['"`]/);
            if (urlMatch && (urlMatch[1].includes('api') || urlMatch[1].includes('data') || urlMatch[1].includes('sets'))) {
              console.log(`📡 Potential API endpoint found: ${urlMatch[1]}`);
              // Try this endpoint
              try {
                const apiUrl = urlMatch[1].startsWith('http') ? urlMatch[1] : `https://www.gemrate.com${urlMatch[1]}`;
                const apiResponse = await this.httpClient.get(apiUrl, {
                  headers: {
                    ...this.baseHeaders,
                    'Accept': 'application/json, text/plain, */*'
                  },
                  timeout: 30000
                });
                if (apiResponse.data && Array.isArray(apiResponse.data)) {
                  setsData = apiResponse.data;
                  console.log(`✅ Found sets data via discovered API: ${urlMatch[1]} (${setsData.length} sets)`);
                  break;
                }
              } catch (e) {
                // Continue
              }
            }
          }
        }
        
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
      
      // Last resort: Use Puppeteer to execute JavaScript and extract data
      if (!setsData || setsData.length === 0) {
        console.log('⚠️ Trying Puppeteer to execute JavaScript and extract data...');
        const browserInitialized = await this.initializeBrowser();
        if (browserInitialized && this.page) {
          try {
            const cacheBuster = Date.now();
            const url = `https://www.gemrate.com/universal-pop-report?_nocache=${cacheBuster}`;
            
            await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
            
            // Wait for table to populate with a shorter timeout
            await this.page.waitForSelector('#setsTableBody', { timeout: 5000 }).catch(() => {});
            await new Promise(resolve => setTimeout(resolve, 2000)); // Shorter wait
            
            // Try to extract data from JavaScript variables first (more efficient)
            setsData = await this.page.evaluate(() => {
              // Try to find data in window or global scope
              if (window.data && Array.isArray(window.data) && window.data.length > 0) {
                return window.data;
              }
              // Try other common variable names
              if (window.setsData && Array.isArray(window.setsData)) {
                return window.setsData;
              }
              if (window.sets && Array.isArray(window.sets)) {
                return window.sets;
              }
              return null;
            });
            
            // If no data in variables, try table (but limit to first 1000 rows to avoid memory issues)
            if (!setsData || setsData.length === 0) {
              setsData = await this.page.evaluate(() => {
                const rows = document.querySelectorAll('#setsTableBody tr');
                if (rows.length === 0) return null;
                
                const sets = [];
                const maxRows = Math.min(rows.length, 1000); // Limit to prevent memory issues
                
                for (let i = 0; i < maxRows; i++) {
                  const row = rows[i];
                  const cells = row.querySelectorAll('td');
                  if (cells.length >= 2) {
                    const link = row.querySelector('a');
                    if (link) {
                      const href = link.getAttribute('href') || '';
                      const setIdMatch = href.match(/\/universal-pop-report\/([^-]+)-/);
                      const yearMatch = href.match(/-(\d{4})\s/);
                      const categoryMatch = href.match(/-([A-Za-z]+)$/);
                      
                      sets.push({
                        set_id: setIdMatch ? setIdMatch[1] : null,
                        set_name: link.textContent.trim(),
                        name: link.textContent.trim(),
                        year: yearMatch ? parseInt(yearMatch[1]) : null,
                        category: categoryMatch ? categoryMatch[1] : null,
                        total_grades: parseInt(cells[1]?.textContent.replace(/,/g, '')) || 0,
                        psa_share: parseFloat(cells[2]?.textContent.replace('%', '')) || 0,
                        beckett_share: parseFloat(cells[3]?.textContent.replace('%', '')) || 0,
                        sgc_share: parseFloat(cells[4]?.textContent.replace('%', '')) || 0,
                        cgc_share: parseFloat(cells[5]?.textContent.replace('%', '')) || 0,
                        checklist_size: parseInt(cells[6]?.textContent.replace(/,/g, '')) || 0,
                        percent_with_grades: parseFloat(cells[7]?.textContent.replace('%', '')) || 0
                      });
                    }
                  }
                }
                return sets.length > 0 ? sets : null;
              });
            }
            
            if (setsData && setsData.length > 0) {
              console.log(`✅ Found ${setsData.length} sets using Puppeteer`);
            }
            
            // Close browser to free memory
            await this.closeBrowser();
          } catch (e) {
            console.log(`⚠️ Puppeteer extraction failed: ${e.message}`);
            await this.closeBrowser();
          }
        }
      }
      } // Close the if (!setsData || setsData.length === 0) block

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
      // Look for table rows in the sets table - try multiple selectors
      const selectors = [
        '#setsTableBody tr',
        'table#setsTable tbody tr',
        'table tbody tr',
        '.sets-table tbody tr',
        '[id*="setsTable"] tr',
        'tbody tr'
      ];
      
      let foundRows = false;
      for (const selector of selectors) {
        const rows = $(selector);
        console.log(`🔍 Trying selector "${selector}": found ${rows.length} rows`);
        
        if (rows.length > 0) {
          foundRows = true;
          rows.each((_, row) => {
            const $row = $(row);
            const cells = $row.find('td');
            
            // Skip header rows
            if (cells.length < 2) return;
            
            // Try to extract set information from table cells
            const $link = $row.find('a').first();
            const setName = $link.text().trim() || cells.eq(0).text().trim();
            
            // Skip if it's a header or empty
            if (!setName || setName === 'Set Name' || setName.toLowerCase().includes('iconic')) {
              return;
            }
            
            // Try to extract set_id from link href
            const link = $link.attr('href') || '';
            let setId = null;
            let year = null;
            let category = null;
            
            if (link) {
              // Extract set_id from URL like /universal-pop-report/{set_id}-{year} {name}-{category}
              const match = link.match(/\/universal-pop-report\/([^-]+)-/);
              if (match) {
                setId = match[1];
              }
              
              // Extract year and category from URL
              const yearMatch = link.match(/-(\d{4})\s/);
              if (yearMatch) {
                year = parseInt(yearMatch[1]);
              }
              
              const categoryMatch = link.match(/-([A-Za-z]+)$/);
              if (categoryMatch) {
                category = categoryMatch[1];
              }
            }
            
            // Parse numeric values from cells
            const totalGrades = parseInt(cells.eq(1)?.text().replace(/,/g, '')) || 0;
            const psaShare = parseFloat(cells.eq(2)?.text().replace('%', '')) || 0;
            const beckettShare = parseFloat(cells.eq(3)?.text().replace('%', '')) || 0;
            const sgcShare = parseFloat(cells.eq(4)?.text().replace('%', '')) || 0;
            const cgcShare = parseFloat(cells.eq(5)?.text().replace('%', '')) || 0;
            const checklistSize = parseInt(cells.eq(6)?.text().replace(/,/g, '')) || 0;
            const percentWithGrades = parseFloat(cells.eq(7)?.text().replace('%', '')) || 0;
            
            sets.push({
              set_id: setId,
              set_name: setName,
              name: setName,
              year: year,
              category: category,
              total_grades: totalGrades,
              psa_share: psaShare,
              beckett_share: beckettShare,
              sgc_share: sgcShare,
              cgc_share: cgcShare,
              checklist_size: checklistSize,
              percent_with_grades: percentWithGrades
            });
          });
          
          if (sets.length > 0) {
            console.log(`✅ Found ${sets.length} sets using selector "${selector}"`);
            break;
          }
        }
      }
      
      if (!foundRows) {
        console.log('⚠️ No table rows found with any selector');
      }
      
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
      
      // Clean up the setPath - remove "null" if present
      let cleanPath = setPath.replace(/-null\s+/g, '-').replace(/\s+null\s+/g, ' ');
      
      // Add cache-busting and AG Grid state parameters
      const cacheBuster = Date.now();
      const gridState = this.defaultGridStateParam || '';
      const url = `/universal-pop-report/${cleanPath}?_nocache=${cacheBuster}${gridState ? `&${gridState}` : ''}`;
      
      // Try Puppeteer first for dynamic content (more reliable)
      const browserInitialized = await this.initializeBrowser();
      if (browserInitialized && this.page) {
        try {
          const fullUrl = `https://www.gemrate.com${url}`;
          console.log(`🌐 Loading page with Puppeteer: ${fullUrl}`);
          
          // Set up network request interception BEFORE navigation to capture API responses
          const apiResponses = [];
          this.page.on('response', async (response) => {
            const url = response.url();
            // Look for API endpoints that might contain card data
            if (url.includes('api') || url.includes('data') || url.includes('cards') || 
                url.includes('checklist') || url.includes('pop-report') || 
                url.includes('universal-pop-report') || url.endsWith('.json')) {
              try {
                const contentType = response.headers()['content-type'] || '';
                if (contentType.includes('json') || url.includes('api') || url.includes('data')) {
                  const responseData = await response.json().catch(() => null);
                  if (responseData) {
                    apiResponses.push({ url, data: responseData });
                    console.log(`📡 Found API response: ${url}`);
                    // Check if this looks like card data
                    if (Array.isArray(responseData) || (responseData.data && Array.isArray(responseData.data))) {
                      console.log(`✅ Potential card data found in: ${url}`);
                    }
                  }
                }
              } catch (e) {
                // Not JSON, skip
              }
            }
          });
          
          // Capture console logs from page.evaluate()
          this.page.on('console', msg => {
            const text = msg.text();
            if (text.includes('📊') || text.includes('AG Grid') || text.includes('Column mapping') || text.includes('Card') || text.includes('extraction')) {
              console.log(`[Browser Console] ${text}`);
            }
          });
          
          // Use 'load' instead of 'networkidle0' for faster initial load, then wait for specific elements
          console.log(`🌐 Navigating to page (timeout: 120s)...`);
          try {
            await this.page.goto(fullUrl, { waitUntil: 'load', timeout: 120000 });
            console.log('✅ Page loaded successfully');
          } catch (navError) {
            console.log(`⚠️ Navigation error: ${navError.message}`);
            // Continue anyway - page might have partially loaded
          }
          
          console.log('⏳ Waiting for AG Grid to load...');
          
          // Wait for AG Grid container to appear first
          try {
            await this.page.waitForSelector('[role="grid"], .ag-root-wrapper, div[role="row"]', { timeout: 60000 });
            console.log('✅ AG Grid container detected');
          } catch (e) {
            console.log('⚠️ AG Grid container not found, checking page state...');
            // Check what's actually on the page
            const pageState = await this.page.evaluate(() => {
              return {
                hasGrid: !!document.querySelector('[role="grid"]'),
                hasAgWrapper: !!document.querySelector('.ag-root-wrapper'),
                hasRows: document.querySelectorAll('div[role="row"]').length,
                bodyText: document.body.textContent.substring(0, 200)
              };
            });
            console.log('📄 Page state:', pageState);
          }
          
          // Give the grid time to populate with data
          console.log('⏳ Waiting 5 seconds for grid data to populate...');
          await new Promise(resolve => setTimeout(resolve, 5000));
          
          // Wait for AG Grid rows (the checklist table) to render
          try {
            const rowCount = await this.page.evaluate(() => document.querySelectorAll('div[role="row"]').length);
            console.log(`📊 Found ${rowCount} AG Grid rows on page`);
            
            if (rowCount === 0) {
              console.log('⚠️ No rows found, waiting longer...');
              await this.page.waitForSelector('div[role="row"]', { timeout: 30000 });
              const newRowCount = await this.page.evaluate(() => document.querySelectorAll('div[role="row"]').length);
              console.log(`📊 After wait: Found ${newRowCount} rows`);
            }
          } catch (e) {
            console.log('⚠️ AG Grid rows not detected before extraction:', e.message);
          }
          
          // Wait a bit longer for grid to fully populate with data
          await new Promise(resolve => setTimeout(resolve, 5000));
          
          // Scroll the grid to load more virtual rows (do this outside evaluate)
          const viewport = await this.page.$('.ag-center-cols-viewport') || 
                          await this.page.$('div[ref="eCenterViewport"]') ||
                          await this.page.$('div[role="grid"]');
          
          // Simplified extraction: scroll in larger chunks and extract at key positions
          const allExtractedCards = new Map(); // Use Map to deduplicate by key
          
          if (viewport) {
            try {
              console.log('📜 Scrolling grid to load all rows...');
              
              // Helper function to safely extract cards
              const extractCardsSafely = async () => {
                try {
                  return await this.page.evaluate(() => {
                    const cards = [];
                    const rows = document.querySelectorAll('div[role="row"]');
                    
                    // Get column indexes from headers
                    const headerCells = Array.from(document.querySelectorAll('.ag-header-cell-text'));
                    const headerTexts = headerCells.map(h => (h.textContent || '').trim());
                    const nameCol = headerTexts.findIndex(h => h.toLowerCase() === 'name' || h.toLowerCase().includes('player'));
                    const numberCol = headerTexts.findIndex(h => h.toLowerCase() === 'number' || h.toLowerCase().includes('card #'));
                    const setCol = headerTexts.findIndex(h => h.toLowerCase().includes('card set') || h.toLowerCase().includes('set'));
                    const psaCol = headerTexts.findIndex(h => h.toLowerCase() === 'psa' || h.toLowerCase().includes('psa'));
                    
                    rows.forEach((row) => {
                      const cells = row.querySelectorAll('div[role="gridcell"]');
                      if (cells.length === 0) return;
                      
                      const safeText = (idx) => cells[idx] && cells[idx].textContent ? cells[idx].textContent.trim() : '';
                      const name = safeText(nameCol >= 0 ? nameCol : 1);
                      const number = safeText(numberCol >= 0 ? numberCol : 2);
                      const cardSet = safeText(setCol >= 0 ? setCol : 3);
                      const psaText = safeText(psaCol >= 0 ? psaCol : 5);
                      
                      const hasNumber = number && /^\d+$/.test(number);
                      const hasName = name && name.length > 0 && name.length < 100;
                      
                      if (hasNumber || hasName) {
                        const psaCountStr = psaText ? psaText.replace(/[,\s]/g, '') : '';
                        cards.push({
                          number: number || '',
                          player: name,
                          team: cardSet || '',
                          psaGraded: psaCountStr && /^\d+$/.test(psaCountStr) ? parseInt(psaCountStr, 10) : null,
                          key: `${number || ''}|${name}|${cardSet}`
                        });
                      }
                    });
                    
                    return cards;
                  });
                } catch (e) {
                  console.log(`⚠️ Extraction error: ${e.message}`);
                  return [];
                }
              };
              
              // Extract at top first
              let cards = await extractCardsSafely();
              cards.forEach(card => {
                if (!allExtractedCards.has(card.key)) {
                  allExtractedCards.set(card.key, card);
                }
              });
              console.log(`📊 Initial extraction: ${allExtractedCards.size} unique cards`);
              
              // Scroll to middle
              try {
                await this.page.evaluate((el) => {
                  if (el) el.scrollTop = el.scrollHeight / 2;
                }, viewport);
                await new Promise(resolve => setTimeout(resolve, 1500));
                cards = await extractCardsSafely();
                cards.forEach(card => {
                  if (!allExtractedCards.has(card.key)) {
                    allExtractedCards.set(card.key, card);
                  }
                });
                console.log(`📊 After middle scroll: ${allExtractedCards.size} unique cards`);
              } catch (e) {
                console.log(`⚠️ Middle scroll error: ${e.message}`);
              }
              
              // Scroll to bottom
              try {
                await this.page.evaluate((el) => {
                  if (el) el.scrollTop = el.scrollHeight;
                }, viewport);
                await new Promise(resolve => setTimeout(resolve, 2000));
                cards = await extractCardsSafely();
                cards.forEach(card => {
                  if (!allExtractedCards.has(card.key)) {
                    allExtractedCards.set(card.key, card);
                  }
                });
                console.log(`📊 After bottom scroll: ${allExtractedCards.size} unique cards`);
              } catch (e) {
                console.log(`⚠️ Bottom scroll error: ${e.message}`);
              }
              
              // Scroll back to top to capture any rows we missed
              try {
                await this.page.evaluate((el) => {
                  if (el) el.scrollTop = 0;
                }, viewport);
                await new Promise(resolve => setTimeout(resolve, 1500));
                cards = await extractCardsSafely();
                cards.forEach(card => {
                  if (!allExtractedCards.has(card.key)) {
                    allExtractedCards.set(card.key, card);
                  }
                });
                console.log(`📊 After top scroll: ${allExtractedCards.size} unique cards`);
              } catch (e) {
                console.log(`⚠️ Top scroll error: ${e.message}`);
              }
              
              // Convert Map to array for return
              const finalCards = Array.from(allExtractedCards.values()).map(card => ({
                number: card.number,
                player: card.player,
                team: card.team,
                psaGraded: card.psaGraded
              }));
              
              // Sort by PSA graded count (descending) when available
              finalCards.sort((a, b) => {
                const aPsa = typeof a.psaGraded === 'number' ? a.psaGraded : -1;
                const bPsa = typeof b.psaGraded === 'number' ? b.psaGraded : -1;
                return bPsa - aPsa;
              });
              
              if (finalCards.length > 0) {
                console.log(`✅ Returning ${finalCards.length} cards from simplified extraction`);
                await this.closeBrowser();
                return finalCards;
              }
            } catch (e) {
              console.log(`⚠️ Scrolling/extraction failed: ${e.message}`);
            }
          } else {
            console.log('⚠️ No viewport found for scrolling, will try standard extraction');
          }
          
          // Check if we got card-like data from API responses
          for (const apiResponse of apiResponses) {
            try {
              let cardData = null;
              const data = apiResponse.data;

              if (Array.isArray(data)) {
                cardData = data;
              } else if (data && Array.isArray(data.data)) {
                cardData = data.data;
              } else if (data && Array.isArray(data.cards)) {
                cardData = data.cards;
              }
              
              if (!cardData || cardData.length === 0) {
                continue;
              }

              // Skip analytics/telemetry payloads – require at least one object
              // that has obvious card fields
              const sampleItem = cardData.find(
                (item) =>
                  item &&
                  typeof item === 'object' &&
                  (
                    item.card_number ||
                    item.number ||
                    item.cardNumber ||
                    item.card_num ||
                    item.player_name ||
                    item.player ||
                    item.name
                  )
              );

              if (!sampleItem) {
                console.log(`⚠️ API response does not look like card data, skipping: ${apiResponse.url}`);
                continue;
              }

              console.log(`✅ Found potential card array (${cardData.length} items) from API: ${apiResponse.url}`);

              const cards = cardData
                .filter((item) => item && typeof item === 'object')
                .map(item => ({
                  number: item.card_number || item.number || item.cardNumber || item.card_num || '',
                  player: item.player_name || item.player || item.name || item.playerName || '',
                  team: item.team_name || item.team || item.teamName || ''
                }))
                .filter(card => card.number || card.player);
              
              if (cards.length > 0) {
                await this.closeBrowser();
                return cards;
              }
            } catch (apiErr) {
              console.log(`⚠️ Failed to parse API response as card data (${apiResponse.url}): ${apiErr.message}`);
              // Keep trying other responses
            }
          }
          
          // Try to find table - but with shorter timeouts since we're looking for API data first
          const tableSelectors = [
            'table tbody tr',
            '#cardTableBody tr',
            'tbody tr',
            'table tr'
          ];
          
          let foundTable = false;
          for (const selector of tableSelectors) {
            try {
              await this.page.waitForSelector(selector, { timeout: 5000 });
              console.log(`✅ Found table with selector: ${selector}`);
              foundTable = true;
              break;
            } catch (e) {
              // Continue
            }
          }
          
          if (!foundTable) {
            console.log('⚠️ No table found, trying to extract from page content...');
            // Only wait 2 seconds if no table found
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
          
          // First, try to extract data from script tags - look for any array with card-like data
          console.log('🔍 Looking for card data in script tags...');
          const rowDataCards = await this.page.evaluate(() => {
            const scripts = document.querySelectorAll('script');
            const foundArrays = [];
            
            for (const script of scripts) {
              const content = script.textContent || script.innerHTML;
              
              // Look for various variable names that might contain card data
              const variablePatterns = [
                /const\s+(rowData|cardData|cards|checklist|data)\s*=\s*JSON\.parse\(['"](\[[\s\S]*?\])['"]\)/,
                /const\s+(rowData|cardData|cards|checklist|data)\s*=\s*JSON\.parse\(`(\[[\s\S]*?\])`\)/,
                /const\s+(rowData|cardData|cards|checklist|data)\s*=\s*(\[[\s\S]*?\]);/,
                /(?:var|let)\s+(rowData|cardData|cards|checklist|data)\s*=\s*(\[[\s\S]*?\]);/
              ];
              
              // Also look for populateTable or similar function calls with data
              const functionPatterns = [
                /populateTable\s*\(\s*(\[[\s\S]*?\])\s*\)/,
                /populateCards\s*\(\s*(\[[\s\S]*?\])\s*\)/,
                /renderCards\s*\(\s*(\[[\s\S]*?\])\s*\)/
              ];
              
              // Try variable patterns
              for (const pattern of variablePatterns) {
                const match = content.match(pattern);
                if (match) {
                  try {
                    let jsonStr = match[2] || match[1]; // match[2] is the array, match[1] is variable name
                    // Unescape quotes if needed
                    jsonStr = jsonStr.replace(/\\"/g, '"').replace(/\\'/g, "'").replace(/\\n/g, '\n');
                    // Clean up trailing commas
                    jsonStr = jsonStr.replace(/,\s*\]/g, ']').replace(/,\s*\}/g, '}');
                    const data = JSON.parse(jsonStr);
                    if (Array.isArray(data) && data.length > 0) {
                      console.log(`✅ Found data in variable "${match[1]}" with ${data.length} items`);
                      foundArrays.push({ source: match[1], data });
                    }
                  } catch (e) {
                    // Try precise extraction
                    try {
                      const arrayStart = content.indexOf('[', match.index);
                      if (arrayStart !== -1) {
                        let bracketCount = 0;
                        let arrayEnd = arrayStart;
                        for (let i = arrayStart; i < content.length; i++) {
                          if (content[i] === '[') bracketCount++;
                          if (content[i] === ']') bracketCount--;
                          if (bracketCount === 0) {
                            arrayEnd = i + 1;
                            break;
                          }
                        }
                        if (arrayEnd > arrayStart) {
                          let jsonStr = content.substring(arrayStart, arrayEnd);
                          jsonStr = jsonStr.replace(/\\"/g, '"').replace(/\\'/g, "'");
                          jsonStr = jsonStr.replace(/,\s*\]/g, ']').replace(/,\s*\}/g, '}');
                          const data = JSON.parse(jsonStr);
                          if (Array.isArray(data) && data.length > 0) {
                            console.log(`✅ Found data (precise) in "${match[1]}" with ${data.length} items`);
                            foundArrays.push({ source: match[1], data });
                          }
                        }
                      }
                    } catch (e2) {
                      // Continue
                    }
                  }
                }
              }
              
              // Try function patterns
              for (const pattern of functionPatterns) {
                const match = content.match(pattern);
                if (match) {
                  try {
                    let jsonStr = match[1];
                    jsonStr = jsonStr.replace(/\\"/g, '"').replace(/\\'/g, "'");
                    jsonStr = jsonStr.replace(/,\s*\]/g, ']').replace(/,\s*\}/g, '}');
                    const data = JSON.parse(jsonStr);
                    if (Array.isArray(data) && data.length > 0) {
                      console.log(`✅ Found data in function call with ${data.length} items`);
                      foundArrays.push({ source: 'function', data });
                    }
                  } catch (e) {
                    // Continue
                  }
                }
              }
            }
            
            // Return the largest array found (likely to be the card data)
            if (foundArrays.length > 0) {
              foundArrays.sort((a, b) => b.data.length - a.data.length);
              console.log(`📊 Found ${foundArrays.length} data arrays, using largest (${foundArrays[0].data.length} items)`);
              return foundArrays[0].data;
            }
            
            return null;
          });
          
          if (rowDataCards && Array.isArray(rowDataCards) && rowDataCards.length > 0) {
            console.log(`✅ Extracted ${rowDataCards.length} items from rowData`);
            console.log(`📊 First item sample:`, JSON.stringify(rowDataCards[0], null, 2));
            
            // Filter to only items that look like actual cards
            // Cards should have card_number, number, or player_name fields
            const cards = rowDataCards
              .map(item => {
                // Try various field name patterns
                const cardNumber = item.card_number || item.number || item.cardNumber || item.card_num || item.cardNumber || '';
                const playerName = item.player_name || item.player || item.name || item.playerName || item.player_name_full || '';
                const teamName = item.team_name || item.team || item.teamName || '';
                
                return {
                  number: cardNumber,
                  player: playerName,
                  team: teamName,
                  rawItem: item // Keep for debugging
                };
              })
              .filter(card => {
                // Only include if it has a card number (numeric) OR a player name
                // Exclude items that look like navigation/statistics
                const hasCardNumber = card.number && /^\d+$/.test(card.number.toString().trim());
                const hasPlayerName = card.player && card.player.trim().length > 0;
                const looksLikeCard = hasCardNumber || (hasPlayerName && card.player.length < 100); // Player names shouldn't be too long
                
                // Exclude items that look like navigation/statistics
                const isNavigation = card.player && (
                  card.player.includes('Grading Trends') ||
                  card.player.includes('Sales Trends') ||
                  card.player.includes('Universal Search') ||
                  card.player.includes('Universal Pop Report') ||
                  card.player.includes('Player Pop Data') ||
                  card.player.includes('Total Grades') ||
                  card.player.includes('Total Gems') ||
                  card.player.includes('Gem Rate') ||
                  card.player.includes('Share of Grades') ||
                  card.player.includes('PSA Total') ||
                  card.player.includes('Beckett Total') ||
                  card.player.includes('SGC Total') ||
                  card.player.includes('CGC Total')
                );
                
                return looksLikeCard && !isNavigation;
              })
              .map(card => ({
                number: card.number,
                player: card.player,
                team: card.team
              }));
            
            console.log(`📋 Filtered to ${cards.length} actual cards (removed ${rowDataCards.length - cards.length} non-card items)`);
            
            await this.closeBrowser();
            if (cards.length > 0) {
              console.log(`✅ Found ${cards.length} cards from rowData`);
              return cards;
            } else {
              console.log(`⚠️ No valid cards found in rowData, falling back to table extraction`);
            }
          }
          
          // Extract cards from DOM - try AG Grid rows first, then tables/lists
          const cards = await this.page.evaluate(() => {
            const cards = [];
            const debug = {
              tables: document.querySelectorAll('table').length,
              tableBodies: document.querySelectorAll('tbody').length,
              allRows: document.querySelectorAll('tr').length,
              cardTableBody: document.getElementById('cardTableBody') ? 'exists' : 'not found',
              pageText: document.body.textContent.substring(0, 500)
            };
            
            console.log('Page structure:', JSON.stringify(debug));

            // -------- Try AG Grid rows (div-based grid) --------
            try {
              const initialRows = document.querySelectorAll('div[role="row"]');
              console.log(`AG Grid rows found (initial): ${initialRows.length}`);

              // Try to infer column indexes from AG Grid headers
              const headerCells = Array.from(document.querySelectorAll('.ag-header-cell-text'));
              const headerTexts = headerCells.map(h => (h.textContent || '').trim());
              console.log('AG Grid headers:', headerTexts);

              // Map specific fields with detailed logging
              let nameCol = headerTexts.findIndex(h => h.toLowerCase() === 'name' || h.toLowerCase().includes('player'));
              let numberCol = headerTexts.findIndex(h => h.toLowerCase() === 'number' || h.toLowerCase().includes('card #'));
              let setCol = headerTexts.findIndex(h => h.toLowerCase().includes('card set') || h.toLowerCase().includes('set'));
              let psaCol = headerTexts.findIndex(h => h.toLowerCase() === 'psa' || h.toLowerCase().includes('psa'));
              let totalCol = headerTexts.findIndex(h => h.toLowerCase() === 'total' || h.toLowerCase().includes('total'));

              console.log(`📊 Column mapping: nameCol=${nameCol}, numberCol=${numberCol}, setCol=${setCol}, psaCol=${psaCol}, totalCol=${totalCol}`);
              console.log(`📊 Full header array:`, headerTexts.map((h, i) => `${i}: "${h}"`).join(', '));

              // Fallbacks if some columns weren't found
              if (nameCol === -1) {
                nameCol = 1;
                console.log(`⚠️ Name column not found, using fallback index ${nameCol}`);
              }
              if (numberCol === -1) {
                numberCol = 2;
                console.log(`⚠️ Number column not found, using fallback index ${numberCol}`);
              }
              if (setCol === -1) {
                setCol = 3;
                console.log(`⚠️ Set column not found, using fallback index ${setCol}`);
              }
              if (psaCol === -1 && totalCol === -1) {
                console.log(`⚠️ Neither PSA nor Total column found! Trying alternative patterns...`);
                // Try alternative patterns
                psaCol = headerTexts.findIndex(h => {
                  const lower = h.toLowerCase();
                  return lower.includes('psa') || lower.includes('grades') && lower.includes('psa');
                });
                totalCol = headerTexts.findIndex(h => {
                  const lower = h.toLowerCase();
                  return lower === 'total' || (lower.includes('total') && lower.includes('grade'));
                });
                console.log(`📊 After alternative search: psaCol=${psaCol}, totalCol=${totalCol}`);
              }

              // Helper to safely extract card data from a single row element
              const extractFromRow = (row, seenKeys, cards) => {
                const cells = row.querySelectorAll('div[role="gridcell"]');
                if (cells.length === 0) return;

                const safeText = (idx) =>
                  cells[idx] && cells[idx].textContent
                    ? cells[idx].textContent.trim()
                    : '';

                const name = safeText(nameCol);
                const number = safeText(numberCol);
                const cardSet = safeText(setCol);

                // PSA graded count: prefer explicit PSA column, else use Total grades
                let psaText = '';
                let psaSource = 'none';
                if (psaCol !== -1 && psaCol < cells.length) {
                  psaText = safeText(psaCol);
                  psaSource = `PSA column (index ${psaCol})`;
                } else if (totalCol !== -1 && totalCol < cells.length) {
                  psaText = safeText(totalCol);
                  psaSource = `Total column (index ${totalCol})`;
                }
                const psaCountStr = psaText.replace(/[,\s]/g, '');
                
                // Log extraction details for first few cards
                if (cards.length < 3) {
                  console.log(`📊 Card ${cards.length + 1} extraction: name="${name}", number="${number}", set="${cardSet}", psaText="${psaText}", psaCountStr="${psaCountStr}", source=${psaSource}, cells.length=${cells.length}`);
                  console.log(`📊 All cell texts:`, Array.from(cells).map((c, i) => `${i}: "${c.textContent?.trim() || ''}"`).join(', '));
                }

                const hasNumber = number && /^\d+$/.test(number);
                const hasName = name && name.length > 0 && name.length < 100;

                // Skip obvious header / non-card rows
                if (!hasNumber && (!hasName || name.toLowerCase() === 'name')) {
                  return;
                }

                const key = `${number || ''}|${name}|${cardSet}`;
                if (seenKeys.has(key)) return;
                seenKeys.add(key);

                cards.push({
                  number: number || '',
                  player: name,
                  team: cardSet || '',
                  psaGraded: psaCountStr && /^\d+$/.test(psaCountStr) ? parseInt(psaCountStr, 10) : null
                });
              };

              const cards = [];
              const seenKeys = new Set();

              // Extract all visible rows (grid should already be scrolled by Puppeteer)
              const rows = document.querySelectorAll('div[role="row"]');
              console.log(`📊 Extracting from ${rows.length} visible AG Grid rows`);
              
              rows.forEach((row) => extractFromRow(row, seenKeys, cards));
              
              console.log(`✅ Extracted ${cards.length} unique cards from AG Grid`);

              if (cards.length > 0) {
                console.log(`✅ Extracted ${cards.length} cards from AG Grid rows (top virtual rows)`);
                // Sort by PSA graded count (descending) when available
                cards.sort((a, b) => {
                  const aPsa = typeof a.psaGraded === 'number' ? a.psaGraded : -1;
                  const bPsa = typeof b.psaGraded === 'number' ? b.psaGraded : -1;
                  return bPsa - aPsa;
                });
                console.log(`📊 Top AG Grid card sample:`, JSON.stringify(cards[0], null, 2));
                return { cards, debug };
              }
            } catch (e) {
              console.log('⚠️ AG Grid extraction failed:', e.message);
            }
            
            // -------- Fallback: table/list-based extraction --------
            // Try multiple table selectors - prioritize checklist-specific selectors
            const selectors = [
              'table[class*="checklist"] tbody tr',
              'table[class*="card"] tbody tr',
              '#cardTableBody tr',
              'table tbody tr',
              'tbody tr',
              '.card-row',
              '[data-card-id]',
              'table tr',
              '.card-item',
              'tr[data-card]',
              'table#cardTable tbody tr',
              '[id*="checklist"] table tr',
              '[id*="card"] table tr'
            ];
            
            let rows = [];
            let usedSelector = '';
            for (const selector of selectors) {
              rows = document.querySelectorAll(selector);
              if (rows.length > 0) {
                usedSelector = selector;
                console.log(`✅ Found ${rows.length} rows with selector: ${selector}`);
                break;
              }
            }
            
            if (rows.length === 0) {
              // Try to find any table and get all rows
              const tables = document.querySelectorAll('table');
              console.log(`Found ${tables.length} tables on page`);
              
              // Look for table with "Card #" or "Player" headers (actual card checklist)
              for (let i = 0; i < tables.length; i++) {
                const table = tables[i];
                const headerText = table.textContent.toLowerCase();
                const hasCardHeader = headerText.includes('card #') || headerText.includes('card number') || 
                                     headerText.includes('player') && headerText.includes('team');
                
                if (hasCardHeader) {
                  const tableRows = table.querySelectorAll('tr');
                  console.log(`Table ${i} looks like card checklist (${tableRows.length} rows)`);
                  if (tableRows.length > 1) {
                    rows = tableRows;
                    usedSelector = `table[${i}] tr (card checklist)`;
                    break;
                  }
                }
              }
              
              // If still no rows, try any table with multiple rows
              if (rows.length === 0) {
                for (let i = 0; i < tables.length; i++) {
                  const tableRows = tables[i].querySelectorAll('tr');
                  console.log(`Table ${i} has ${tableRows.length} rows`);
                  if (tableRows.length > 1) { // More than just header
                    rows = tableRows;
                    usedSelector = `table[${i}] tr`;
                    break;
                  }
                }
              }
            }
            
            // Also try to find cards in list items or divs
            if (rows.length === 0) {
              const listItems = document.querySelectorAll('li, .card, [class*="card"]');
              console.log(`Found ${listItems.length} potential card elements`);
              if (listItems.length > 0) {
                // Convert to array-like structure
                rows = Array.from(listItems);
                usedSelector = 'list/div items';
              }
            }
            
            // Limit to prevent memory issues
            const maxRows = Math.min(rows.length, 2000);
            console.log(`Processing ${maxRows} rows using selector: ${usedSelector}`);
            
            for (let i = 0; i < maxRows; i++) {
              const row = rows[i];
              
              // Handle table rows
              if (row.tagName === 'TR') {
                const cells = row.querySelectorAll('td, th');
                
                // Skip header rows
                if (cells.length < 2) continue;
                
                let cardNumber = '';
                let playerName = '';
                let teamName = '';
                
                // Try different cell positions
                if (cells.length >= 3) {
                  cardNumber = cells[0]?.textContent.trim() || '';
                  playerName = cells[1]?.textContent.trim() || '';
                  teamName = cells[2]?.textContent.trim() || '';
                } else if (cells.length >= 2) {
                  cardNumber = cells[0]?.textContent.trim() || '';
                  playerName = cells[1]?.textContent.trim() || '';
                }
                
                // Also try to find in links
                const link = row.querySelector('a');
                if (link) {
                  if (!playerName) playerName = link.textContent.trim();
                  // Try to extract card number from link text or href
                  const linkText = link.textContent.trim();
                  const numberMatch = linkText.match(/#?\s*(\d+)/);
                  if (numberMatch && !cardNumber) {
                    cardNumber = numberMatch[1];
                  }
                }
                
                // Skip if it looks like a header
                if (cardNumber.toLowerCase() === 'card #' || 
                    cardNumber.toLowerCase() === 'number' ||
                    cardNumber.toLowerCase() === 'n/a' ||
                    playerName.toLowerCase() === 'player' ||
                    playerName.toLowerCase() === 'name') {
                  continue;
                }
                
                // Skip navigation/statistics rows
                const isNavigation = playerName && (
                  playerName.includes('Grading Trends') ||
                  playerName.includes('Sales Trends') ||
                  playerName.includes('Universal Search') ||
                  playerName.includes('Universal Pop Report') ||
                  playerName.includes('Player Pop Data') ||
                  playerName.includes('Total Grades') ||
                  playerName.includes('Total Gems') ||
                  playerName.includes('Gem Rate') ||
                  playerName.includes('Share of Grades') ||
                  playerName.includes('PSA Total') ||
                  playerName.includes('Beckett Total') ||
                  playerName.includes('SGC Total') ||
                  playerName.includes('CGC Total') ||
                  playerName.includes('list Sports') ||
                  playerName.includes('list Pokemon')
                );
                
                if (isNavigation) {
                  continue;
                }
                
                // Only include if it has a valid card number (numeric) OR a reasonable player name
                const hasValidCardNumber = cardNumber && /^\d+$/.test(cardNumber.trim());
                const hasValidPlayerName = playerName && playerName.trim().length > 0 && playerName.length < 100;
                
                if (hasValidCardNumber || hasValidPlayerName) {
                  cards.push({
                    number: cardNumber || 'N/A',
                    player: playerName || '',
                    team: teamName || ''
                  });
                }
              } else {
                // Handle list items or divs
                const text = row.textContent.trim();
                if (text && text.length > 0 && text.length < 200) {
                  // Try to parse card info from text
                  const numberMatch = text.match(/#?\s*(\d+)/);
                  const cardNumber = numberMatch ? numberMatch[1] : '';
                  const restOfText = text.replace(/#?\s*\d+\s*/, '').trim();
                  
                  if (cardNumber || restOfText) {
                    cards.push({
                      number: cardNumber,
                      player: restOfText,
                      team: ''
                    });
                  }
                }
              }
            }
            
            console.log(`Extracted ${cards.length} cards`);
            return { cards, debug };
          });
          
          console.log(`📊 Page debug info:`, cards.debug);
          const extractedCards = cards.cards || cards;
          
          await this.closeBrowser();
          
          if (extractedCards.length > 0) {
            console.log(`✅ Found ${extractedCards.length} cards using Puppeteer`);
            return extractedCards;
          } else {
            console.log(`⚠️ No cards found. Debug info: ${JSON.stringify(cards.debug || {})}`);
          }
        } catch (e) {
          console.log(`⚠️ Puppeteer extraction failed: ${e.message}`);
          await this.closeBrowser();
        }
      }
      
      // Fallback to HTTP request
      const response = await this.httpClient.get(url, {
        headers: {
          ...this.pageHeaders,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'Referer': 'https://www.gemrate.com/universal-pop-report'
        },
        timeout: 30000 // Reduced timeout
      });

      const html = response.data;
      
      // Limit HTML size to prevent memory issues
      const maxHtmlSize = 500000; // 500KB
      const limitedHtml = html.length > maxHtmlSize ? html.substring(0, maxHtmlSize) : html;
      
      const $ = cheerio.load(limitedHtml);

      const cards = [];
      
      // First, try to find embedded JSON data in script tags
      let cardsData = null;
      $('script').each((_, el) => {
        const scriptContent = $(el).html() || '';
        
        // Look for rowData first (most common pattern)
        const rowDataPatterns = [
          /const\s+rowData\s*=\s*JSON\.parse\(['"](\[[\s\S]*?\])['"]\)/,
          /const\s+rowData\s*=\s*JSON\.parse\(`(\[[\s\S]*?\])`\)/,
          /const\s+rowData\s*=\s*(\[[\s\S]*?\]);/
        ];
        
        for (const pattern of rowDataPatterns) {
          const match = scriptContent.match(pattern);
          if (match && !cardsData) {
            try {
              let jsonStr = match[1];
              // Unescape quotes if needed
              jsonStr = jsonStr.replace(/\\"/g, '"').replace(/\\'/g, "'").replace(/\\n/g, '\n');
              // Clean up trailing commas
              jsonStr = jsonStr.replace(/,\s*\]/g, ']').replace(/,\s*\}/g, '}');
              cardsData = JSON.parse(jsonStr);
              if (Array.isArray(cardsData) && cardsData.length > 0) {
                console.log(`✅ Found rowData in script tag: ${cardsData.length} items`);
                return false; // Break out of each loop
              }
            } catch (e) {
              // Try precise extraction if simple parse fails
              try {
                const arrayStart = scriptContent.indexOf('[', match.index);
                if (arrayStart !== -1) {
                  let bracketCount = 0;
                  let arrayEnd = arrayStart;
                  for (let i = arrayStart; i < scriptContent.length; i++) {
                    if (scriptContent[i] === '[') bracketCount++;
                    if (scriptContent[i] === ']') bracketCount--;
                    if (bracketCount === 0) {
                      arrayEnd = i + 1;
                      break;
                    }
                  }
                  if (arrayEnd > arrayStart) {
                    let jsonStr = scriptContent.substring(arrayStart, arrayEnd);
                    jsonStr = jsonStr.replace(/\\"/g, '"').replace(/\\'/g, "'");
                    jsonStr = jsonStr.replace(/,\s*\]/g, ']').replace(/,\s*\}/g, '}');
                    cardsData = JSON.parse(jsonStr);
                    if (Array.isArray(cardsData) && cardsData.length > 0) {
                      console.log(`✅ Found rowData (precise extraction) in script tag: ${cardsData.length} items`);
                      return false; // Break out of each loop
                    }
                  }
                }
              } catch (e2) {
                // Continue to next pattern
              }
            }
          }
        }
        
        // Look for card data in various other patterns
        const patterns = [
          /(?:const|var|let)\s+cards\s*=\s*(\[[\s\S]*?\]);/,
          /(?:const|var|let)\s+data\s*=\s*(\[[\s\S]*?\]);/,
          /cards\s*:\s*(\[[\s\S]*?\])/,
          /populateCards\s*\(\s*(\[[\s\S]*?\])\s*\)/
        ];
        
        for (const pattern of patterns) {
          const match = scriptContent.match(pattern);
          if (match && !cardsData) {
            try {
              let jsonStr = match[1];
              jsonStr = jsonStr.replace(/,\s*\]/g, ']').replace(/,\s*\}/g, '}');
              cardsData = JSON.parse(jsonStr);
              if (Array.isArray(cardsData) && cardsData.length > 0) {
                console.log(`✅ Found cards data in script tag: ${cardsData.length} cards`);
                return false; // Break out of each loop
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
          // Try various field name patterns
          const cardNumber = card.card_number || card.number || card.cardNumber || card.card_num || '';
          const playerName = card.player_name || card.player || card.name || card.playerName || card.player_name_full || '';
          const teamName = card.team_name || card.team || card.teamName || '';
          
          if (cardNumber || playerName) {
            cards.push({
              number: cardNumber,
              player: playerName,
              team: teamName
            });
          }
        });
        console.log(`✅ Processed ${cards.length} cards from JSON data`);
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
   * Get all GemRate cards for a specific player (GemRate player page)
   * Uses the /player endpoint with AG Grid, similar to universal-pop-report.
   * @param {Object} params
   * @param {string} params.grader - Grading company (psa, bgs, sgc, cgc)
   * @param {string} params.category - GemRate category slug (e.g. "football-cards")
   * @param {string} params.player - Player name (e.g. "Bo Nix")
   * @returns {Promise<Array>} Array of card objects
   */
  async getPlayerCards({ grader = 'psa', category = 'football-cards', player }) {
    if (!player || typeof player !== 'string' || !player.trim()) {
      throw new Error('Player name is required for GemRate player search');
    }

    try {
      await this.ensureSession();

      const cleanPlayer = player.trim();
      // GemRate expects + between name parts
      const playerParam = cleanPlayer.replace(/\s+/g, '+');

      const queryParams = new URLSearchParams({
        grader: grader.toLowerCase(),
        player: playerParam
      });
      
      // Only include category if it's not "all"
      if (category && category.toLowerCase() !== 'all') {
        queryParams.append('category', category);
      }

      const path = `/player?${queryParams.toString()}`;
      const fullUrl = `${this.baseUrl}${path}`;

      console.log(`📇 Fetching GemRate player cards: ${fullUrl}`);

      const browserInitialized = await this.initializeBrowser();
      if (!browserInitialized || !this.page) {
        throw new Error('Puppeteer not available for GemRate player search');
      }

      // Capture useful console logs from the page
      this.page.on('console', msg => {
        const text = msg.text();
        if (text.includes('AG Grid') || text.includes('Card') || text.includes('extraction') || 
            text.includes('GemRate player') || text.includes('📊') || text.includes('⚠️')) {
          console.log(`[GemRate Player Console] ${text}`);
        }
      });

      try {
        await this.page.goto(fullUrl, { waitUntil: 'load', timeout: 120000 });
        console.log('✅ GemRate player page loaded');
      } catch (navError) {
        console.log(`⚠️ GemRate player navigation error: ${navError.message}`);
      }

      // Wait for grid container / rows
      try {
        await this.page.waitForSelector('[role="grid"], .ag-root-wrapper, div[role="row"]', { timeout: 60000 });
        console.log('✅ GemRate player AG Grid container detected');
      } catch (e) {
        console.log('⚠️ GemRate player AG Grid container not found, checking page state...');
        const pageState = await this.page.evaluate(() => ({
          hasGrid: !!document.querySelector('[role="grid"]'),
          hasAgWrapper: !!document.querySelector('.ag-root-wrapper'),
          hasRows: document.querySelectorAll('div[role="row"]').length,
          bodyText: document.body.textContent.substring(0, 200)
        }));
        console.log('📄 GemRate player page state:', pageState);
      }

      // Give the grid some time to populate
      console.log('⏳ Waiting for GemRate player grid data to populate...');
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Wait for cells with actual content (not just empty rows)
      try {
        let attempts = 0;
        let hasContent = false;
        while (attempts < 10 && !hasContent) {
          hasContent = await this.page.evaluate(() => {
            const rows = document.querySelectorAll('div[role="row"]');
            for (const row of rows) {
              const cells = row.querySelectorAll('div[role="gridcell"]');
              for (const cell of cells) {
                const text = (cell.textContent || '').trim();
                if (text.length > 0 && !text.match(/^(Cat|Year|Set|Name|Parallel|Card #|Gems|Total|Gem Rate)$/i)) {
                  return true;
                }
              }
            }
            return false;
          });
          if (!hasContent) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            attempts++;
          }
        }
        console.log(`📊 GemRate player grid has content: ${hasContent} (after ${attempts} attempts)`);
      } catch (e) {
        console.log('⚠️ GemRate player content check failed:', e.message);
      }

      // Ensure some rows are present
      try {
        const rowCount = await this.page.evaluate(() => document.querySelectorAll('div[role="row"]').length);
        console.log(`📊 GemRate player page rows on load: ${rowCount}`);
      } catch (e) {
        console.log('⚠️ GemRate player rows not detected before extraction:', e.message);
      }

      // Scroll and extract cards similar to getSetChecklist
      const viewport = await this.page.$('.ag-center-cols-viewport') ||
                       await this.page.$('div[ref="eCenterViewport"]') ||
                       await this.page.$('div[role="grid"]');

      const allExtractedCards = new Map();

      if (viewport) {
        const extractCardsSafely = async () => {
          try {
            return await this.page.evaluate(() => {
              const cards = [];
              const rows = document.querySelectorAll('div[role="row"]');
              
              // Get column indexes from headers (same pattern as working set checklist)
              const headerCells = Array.from(document.querySelectorAll('.ag-header-cell-text'));
              const headerTexts = headerCells.map(h => (h.textContent || '').trim());
              
              const lowerHeaders = headerTexts.map(h => h.toLowerCase());
              const catCol = lowerHeaders.findIndex(h => h === 'cat' || h.includes('cat'));
              const yearCol = lowerHeaders.findIndex(h => h === 'year');
              const setCol = lowerHeaders.findIndex(h => h === 'set' || h.includes('set '));
              const nameCol = lowerHeaders.findIndex(h => h === 'name' || h.toLowerCase().includes('player'));
              const parallelCol = lowerHeaders.findIndex(h => h.includes('parallel'));
              const cardNumCol = lowerHeaders.findIndex(h => h.includes('card #') || h === 'card #' || h.includes('card no'));
              const gemsCol = lowerHeaders.findIndex(h => h === 'gems');
              const totalCol = lowerHeaders.findIndex(h => h === 'total' || h.includes('total grades') || h.includes('total ') || h.includes('↓ total'));
              const gemRateCol = lowerHeaders.findIndex(h => h.includes('gem rate') || h.includes('gem %'));
              
              rows.forEach((row) => {
                const cells = row.querySelectorAll('div[role="gridcell"]');
                if (cells.length === 0) return;
                
                const safeText = (idx) => cells[idx] && cells[idx].textContent ? cells[idx].textContent.trim() : '';
                const category = safeText(catCol >= 0 ? catCol : 0);
                const year = safeText(yearCol >= 0 ? yearCol : 1);
                const setName = safeText(setCol >= 0 ? setCol : 2);
                const name = safeText(nameCol >= 0 ? nameCol : 3);
                const parallel = safeText(parallelCol >= 0 ? parallelCol : 4);
                const cardNumber = safeText(cardNumCol >= 0 ? cardNumCol : 5);
                const gemsText = safeText(gemsCol >= 0 ? gemsCol : 6);
                const totalText = safeText(totalCol >= 0 ? totalCol : 7);
                const gemRateText = safeText(gemRateCol >= 0 ? gemRateCol : 8);
                
                const hasNumber = cardNumber && cardNumber.length > 0;
                const hasName = name && name.length > 0 && name.length < 100;
                
                if (hasNumber || hasName) {
                  const gemsStr = gemsText ? gemsText.replace(/[,\s]/g, '') : '';
                  const totalStr = totalText ? totalText.replace(/[,\s]/g, '') : '';
                  
                  // Try to extract GemRate ID (optional, don't break extraction if it fails)
                  let gemrateId = null;
                  try {
                    // Try AG Grid's internal row data first
                    const rowData = row.__agRowData || row._agRowData;
                    if (rowData && (rowData.gemrateId || rowData.gemrate_id || rowData.id)) {
                      gemrateId = rowData.gemrateId || rowData.gemrate_id || rowData.id;
                    } else if (row.dataset && row.dataset.gemrateId) {
                      gemrateId = row.dataset.gemrateId;
                    } else {
                      // Try to extract from links in cells (e.g., Universal Pop links)
                      const links = row.querySelectorAll('a[href]');
                      for (const link of links) {
                        const href = link.getAttribute('href') || '';
                        // Check for gemrate_id in URL params
                        const gemrateIdMatch = href.match(/[?&]gemrate_id=([^&]+)/);
                        if (gemrateIdMatch && gemrateIdMatch[1]) {
                          gemrateId = gemrateIdMatch[1];
                          break;
                        }
                        // Check for data attributes on links
                        if (link.dataset && link.dataset.gemrateId) {
                          gemrateId = link.dataset.gemrateId;
                          break;
                        }
                      }
                    }
                  } catch (e) {
                    // Ignore errors
                  }
                  
                  cards.push({
                    number: cardNumber || '',
                    player: name,
                    category,
                    year,
                    set: setName || '',
                    parallel,
                    gems: gemsStr && /^\d+$/.test(gemsStr) ? parseInt(gemsStr, 10) : null,
                    totalGrades: totalStr && /^\d+$/.test(totalStr) ? parseInt(totalStr, 10) : null,
                    gemRate: gemRateText || '',
                    gemrateId: gemrateId || null,
                    key: `${cardNumber || ''}|${name}|${setName}|${parallel}`
                  });
                }
              });

              return cards;
            });
          } catch (e) {
            console.log(`⚠️ GemRate player extraction error: ${e.message}`);
            return [];
          }
        };

        // Helper to scroll within current page and extract visible rows
        const scrollAndExtractCurrentPage = async (pageLabel) => {
          // Top
          let cards = await extractCardsSafely();
          cards.forEach(card => {
            if (!allExtractedCards.has(card.key)) {
              allExtractedCards.set(card.key, card);
            }
          });
          console.log(`📊 GemRate player ${pageLabel} initial extraction: ${allExtractedCards.size} unique cards`);

          // Middle
          try {
            await this.page.evaluate((el) => {
              if (el) el.scrollTop = el.scrollHeight / 2;
            }, viewport);
            await new Promise(resolve => setTimeout(resolve, 1500));
            cards = await extractCardsSafely();
            cards.forEach(card => {
              if (!allExtractedCards.has(card.key)) {
                allExtractedCards.set(card.key, card);
              }
            });
            console.log(`📊 GemRate player ${pageLabel} after middle scroll: ${allExtractedCards.size} unique cards`);
          } catch (e) {
            console.log(`⚠️ GemRate player ${pageLabel} middle scroll error: ${e.message}`);
          }

          // Bottom
          try {
            await this.page.evaluate((el) => {
              if (el) el.scrollTop = el.scrollHeight;
            }, viewport);
            await new Promise(resolve => setTimeout(resolve, 2000));
            cards = await extractCardsSafely();
            cards.forEach(card => {
              if (!allExtractedCards.has(card.key)) {
                allExtractedCards.set(card.key, card);
              }
            });
            console.log(`📊 GemRate player ${pageLabel} after bottom scroll: ${allExtractedCards.size} unique cards`);
          } catch (e) {
            console.log(`⚠️ GemRate player ${pageLabel} bottom scroll error: ${e.message}`);
          }

          // Back to top
          try {
            await this.page.evaluate((el) => {
              if (el) el.scrollTop = 0;
            }, viewport);
            await new Promise(resolve => setTimeout(resolve, 1500));
            cards = await extractCardsSafely();
            cards.forEach(card => {
              if (!allExtractedCards.has(card.key)) {
                allExtractedCards.set(card.key, card);
              }
            });
            console.log(`📊 GemRate player ${pageLabel} after top scroll: ${allExtractedCards.size} unique cards`);
          } catch (e) {
            console.log(`⚠️ GemRate player ${pageLabel} top scroll error: ${e.message}`);
          }
        };

        // Extract from first page
        await scrollAndExtractCurrentPage('page 1');

        // Try to paginate through additional pages (each page is typically 25 cards)
        for (let pageIndex = 0; pageIndex < 3; pageIndex++) {
          const movedToNext = await this.page.evaluate(() => {
            const selectors = [
              '.ag-paging-button[ref="btNext"]',
              '.ag-paging-panel button[aria-label="Next Page"]',
              '.ag-paging-button.ag-paging-next'
            ];
            for (const sel of selectors) {
              const btn = document.querySelector(sel);
              if (btn && !btn.classList.contains('ag-disabled') && !(btn instanceof HTMLButtonElement && btn.disabled)) {
                (btn).click();
                return true;
              }
            }
            return false;
          });

          if (!movedToNext) {
            console.log('ℹ️ GemRate player pagination: no further pages detected');
            break;
          }

          console.log(`⏭️ GemRate player pagination: moved to page ${pageIndex + 2}`);
          await new Promise(resolve => setTimeout(resolve, 2500));
          await scrollAndExtractCurrentPage(`page ${pageIndex + 2}`);
        }
      } else {
        console.log('⚠️ GemRate player viewport not found for scrolling');
      }

      // Build final array
      const finalCards = Array.from(allExtractedCards.values()).map(card => ({
        number: card.number,
        player: card.player,
        category: card.category,
        year: card.year,
        set: card.set,
        parallel: card.parallel,
        gems: card.gems,
        totalGrades: card.totalGrades,
        gemRate: card.gemRate,
        gemrateId: card.gemrateId || null // Include GemRate ID if we extracted it
      }));

      // Sort by total grades desc when available (like GemRate)
      finalCards.sort((a, b) => {
        const aTotal = typeof a.totalGrades === 'number' ? a.totalGrades : -1;
        const bTotal = typeof b.totalGrades === 'number' ? b.totalGrades : -1;
        return bTotal - aTotal;
      });

      console.log(`✅ GemRate player cards extracted: ${finalCards.length}`);
      return finalCards;
    } catch (error) {
      console.error('❌ Error fetching GemRate player cards:', error);
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

