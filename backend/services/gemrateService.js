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

      // Step 1: Fetch /universal-search page to extract cardDetailsToken
      let effectiveToken = cardDetailsToken || this.latestCardDetailsToken || null;
      
      if (!effectiveToken) {
        console.log('📄 Fetching /universal-search page to extract cardDetailsToken...');
        try {
          const universalSearchResponse = await this.httpClient.get('/universal-search', {
            params: { gemrate_id: gemrateId },
            headers: this.cardPageHeaders
          });

          if (universalSearchResponse.data && typeof universalSearchResponse.data === 'string') {
            const html = universalSearchResponse.data;
            // Extract cardDetailsToken from JavaScript in the HTML
            const tokenMatch = html.match(/const\s+cardDetailsToken\s*=\s*"([^"]+)"/);
            if (tokenMatch && tokenMatch[1]) {
              effectiveToken = tokenMatch[1];
              this.latestCardDetailsToken = effectiveToken;
              console.log('🔐 Extracted cardDetailsToken from /universal-search page');
            } else {
              console.log('⚠️ Could not extract cardDetailsToken from /universal-search page');
            }
          }
        } catch (tokenError) {
          console.log(`⚠️ Failed to fetch /universal-search for token: ${tokenError.message}`);
        }
      }

      // Step 2: Fetch actual card details from /card-details endpoint
      const cardDetailsHeaders = {
        ...this.baseHeaders,
        'Accept': 'application/json, text/plain, */*',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': `https://www.gemrate.com${refererPath}`,
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Dest': 'empty',
        ...(effectiveToken ? { 'X-Card-Details-Token': effectiveToken } : {})
      };

      if (!effectiveToken) {
        console.log('⚠️ No cardDetailsToken available; attempting request without it');
      }

      const response = await this.httpClient.get('/card-details', {
        params: { gemrate_id: gemrateId },
        headers: cardDetailsHeaders
      });

      if (response.data && response.status === 200) {
        console.log(`✅ Retrieved card details for gemrate_id: ${gemrateId}`);
        console.log(`[getCardDetails] Response data type: ${typeof response.data}, isArray: ${Array.isArray(response.data)}`);
        if (response.data && typeof response.data === 'object' && !Array.isArray(response.data)) {
          console.log(`[getCardDetails] Response data keys: ${Object.keys(response.data).join(', ')}`);
        }
        return response.data;
      } else {
        console.log(`❌ No card details found for gemrate_id: ${gemrateId} (status: ${response.status})`);
        return null;
      }
    } catch (error) {
      // Check if it's a 404 - this is expected for some cards
      if (error.response?.status === 404) {
        console.log(`⚠️ GemRate card details returned 404 for gemrate_id: ${gemrateId} - card may not have detailed page`);
      } else if (error.response?.status === 403) {
        console.log(`⚠️ GemRate card details returned 403 for gemrate_id: ${gemrateId} - access may be blocked`);
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
      console.log(`[parsePopulationData] Starting parse. Type: ${typeof rawData}, isArray: ${Array.isArray(rawData)}`);
      if (rawData && typeof rawData === 'object' && !Array.isArray(rawData)) {
        console.log(`[parsePopulationData] Raw data keys: ${Object.keys(rawData).join(', ')}`);
        // Log a sample of the structure (first 2000 chars)
        const sample = JSON.stringify(rawData, null, 2).substring(0, 2000);
        console.log(`[parsePopulationData] Raw data sample:\n${sample}`);
      }
      
      // Handle HTML responses from /universal-search
      if (rawData && rawData.html && typeof rawData.html === 'string') {
        console.log('📊 Parsing HTML response from /universal-search');
        const html = rawData.html;
        const $ = cheerio.load(html);
        
        // Try to extract population data from HTML
        // Look for script tags with card data
        const scriptTags = $('script').toArray();
        for (const script of scriptTags) {
          const scriptContent = $(script).html() || '';
          
          // Look for PSA data in various formats
          const psaDataPatterns = [
            /"psa_data":\s*({.+?})/s,
            /var\s+psaData\s*=\s*({.+?});/s,
            /const\s+psaData\s*=\s*({.+?});/s,
            /"population_data":\s*\[({.+?})\]/s
          ];
          
          for (const pattern of psaDataPatterns) {
            const match = scriptContent.match(pattern);
            if (match && match[1]) {
              try {
                const psaData = JSON.parse(match[1]);
                if (psaData.card_total_grades || psaData.grades) {
                  // Found PSA data, continue with normal parsing
                  rawData = { population_data: [{ grader: 'psa', ...psaData }] };
                  break;
                }
              } catch (e) {
                // Continue trying other patterns
              }
            }
          }
        }
        
        // If no JSON found in scripts, try to extract from HTML elements
        // Look for population numbers in the page
        const totalPopText = $('*:contains("Total")').filter((i, el) => {
          const text = $(el).text();
          return text.includes('Total') && /\d+/.test(text);
        }).first().text();
        
        if (totalPopText) {
          const totalMatch = totalPopText.match(/(\d+)/);
          if (totalMatch) {
            console.log(`📊 Extracted total population from HTML: ${totalMatch[1]}`);
            // Return basic structure - caller can use this
            return {
              total: parseInt(totalMatch[1], 10),
              perfect: 0,
              gemMint: 0,
              grade9: 0,
              gemRate: 0
            };
          }
        }
      }
      
      if (!rawData || typeof rawData !== 'object') {
        console.log(`[parsePopulationData] Invalid rawData type: ${typeof rawData}`);
        return null;
      }

      // Look for PSA data in the population_data array
      let psaData = null;
      
      if (rawData.population_data && Array.isArray(rawData.population_data)) {
        console.log(`[parsePopulationData] Found population_data array with ${rawData.population_data.length} entries`);
        // Log first entry to see structure
        if (rawData.population_data.length > 0) {
          console.log(`[parsePopulationData] First population_data entry keys: ${Object.keys(rawData.population_data[0] || {}).join(', ')}`);
          console.log(`[parsePopulationData] First population_data entry grader: ${rawData.population_data[0]?.grader || 'undefined'}`);
        }
        // Find the PSA entry in the population_data array
        psaData = rawData.population_data.find(item => item.grader === 'psa');
        if (psaData) {
          console.log(`[parsePopulationData] Found PSA entry in population_data array`);
        } else {
          const graders = rawData.population_data.map(item => item?.grader).filter(Boolean);
          console.log(`[parsePopulationData] No PSA entry found. Available graders: ${graders.join(', ')}`);
          // If no PSA but we have entries, log what we do have
          if (rawData.population_data.length > 0) {
            console.log(`[parsePopulationData] Sample entry structure:`, JSON.stringify(rawData.population_data[0], null, 2).substring(0, 500));
          }
        }
      }
      
      // Fallback to other possible structures
      if (!psaData) {
        console.log(`[parsePopulationData] Checking alternative locations for PSA data...`);
        if (rawData.psa) {
          console.log(`[parsePopulationData] Found rawData.psa`);
          psaData = rawData.psa;
        } else if (rawData.data && rawData.data.psa) {
          console.log(`[parsePopulationData] Found rawData.data.psa`);
          psaData = rawData.data.psa;
        } else if (rawData.population && rawData.population.psa) {
          console.log(`[parsePopulationData] Found rawData.population.psa`);
          psaData = rawData.population.psa;
        } else if (rawData.grading && rawData.grading.psa) {
          console.log(`[parsePopulationData] Found rawData.grading.psa`);
          psaData = rawData.grading.psa;
        } else if (rawData.results && rawData.results.psa) {
          console.log(`[parsePopulationData] Found rawData.results.psa`);
          psaData = rawData.results.psa;
        } else if (rawData.card && rawData.card.psa) {
          console.log(`[parsePopulationData] Found rawData.card.psa`);
          psaData = rawData.card.psa;
        } else {
          console.log(`[parsePopulationData] No PSA data found in any expected location`);
        }
      }

      if (!psaData) {
        console.log(`[parsePopulationData] Returning null - no PSA data found`);
        return null;
      }
      
      console.log(`[parsePopulationData] PSA data keys: ${Object.keys(psaData).join(', ')}`);
      const psaSample = JSON.stringify(psaData, null, 2).substring(0, 1000);
      console.log(`[parsePopulationData] PSA data sample:\n${psaSample}`);

      // Parse the PSA data structure from the actual GemRate response
      // Try multiple possible field names for each value
      const total = psaData.card_total_grades || psaData.total_grades || psaData.total || psaData.cardTotal || 0;
      const gemsPlus = psaData.card_gems || psaData.gems || psaData.gemsPlus || 0;
      const gemRateRaw = psaData.card_gem_rate || psaData.gem_rate || psaData.gemRate || psaData.gemRatePercent || 0;
      const gemRate = gemRateRaw > 1 ? gemRateRaw : Math.round(parseFloat(gemRateRaw) * 100 * 100) / 100;
      
      // Try to get grades - could be grades object or individual fields
      const grades = psaData.grades || psaData.grade || {};
      const perfect = grades.g10 || grades.grade10 || grades['10'] || psaData.g10 || psaData.grade10 || 0;
      const grade9 = grades.g9 || grades.grade9 || grades['9'] || psaData.g9 || psaData.grade9 || 0;
      const grade8 = grades.g8 || grades.grade8 || grades['8'] || psaData.g8 || psaData.grade8 || 0;
      const grade7 = grades.g7 || grades.grade7 || grades['7'] || psaData.g7 || psaData.grade7 || 0;
      const grade6 = grades.g6 || grades.grade6 || grades['6'] || psaData.g6 || psaData.grade6 || 0;
      const grade5 = grades.g5 || grades.grade5 || grades['5'] || psaData.g5 || psaData.grade5 || 0;
      const grade4 = grades.g4 || grades.grade4 || grades['4'] || psaData.g4 || psaData.grade4 || 0;
      const grade3 = grades.g3 || grades.grade3 || grades['3'] || psaData.g3 || psaData.grade3 || 0;
      const grade2 = grades.g2 || grades.grade2 || grades['2'] || psaData.g2 || psaData.grade2 || 0;
      const grade1 = grades.g1 || grades.grade1 || grades['1'] || psaData.g1 || psaData.grade1 || 0;
      
      const population = {
        // Basic stats from PSA data
        total: total,
        gemsPlus: gemsPlus,
        gemRate: gemRate || 0,
        
        // Grade breakdowns from PSA grades object
        perfect: perfect, // PSA 10 = Perfect
        pristine: 0, // Not available in this structure
        gemMint: perfect, // PSA 10 = Gem Mint
        mintPlus: 0, // Not available in this structure
        grade9: grade9,
        grade8: grade8,
        grade7: grade7,
        grade6: grade6,
        grade5: grade5,
        grade4: grade4,
        grade3: grade3,
        grade2: grade2,
        grade1: grade1,
        
        // Additional fields from PSA data
        cardName: psaData.name || psaData.description || '',
        set: psaData.set_name || psaData.set || '',
        year: psaData.year || '',
        sport: psaData.category || '',
        player: psaData.name || '',
        cardNumber: psaData.card_number || psaData.number || '',
        parallel: psaData.parallel || '',
        
        // Raw data for debugging
        rawPsaData: psaData
      };

      console.log(`[parsePopulationData] Parsed population:`, {
        total,
        perfect,
        grade9,
        gemRate
      });

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

      // Try HTTP request first (faster, like Postman)
      try {
        const response = await this.httpClient.get(path, {
          headers: {
            ...this.pageHeaders,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          },
          timeout: 30000
        });

        const htmlContent = response.data;

        // Look for RowData variable in script tags (EXACT Postman pattern)
        const rawDataPatterns = [
          /var\s+RowData\s*=\s*JSON\.parse\('(.+?)'\);/s,
          /var\s+RowData\s*=\s*JSON\.parse\("(.+?)"\);/s,
          /const\s+RowData\s*=\s*JSON\.parse\('(.+?)'\);/s,
          /let\s+RowData\s*=\s*JSON\.parse\('(.+?)'\);/s,
          /RowData\s*=\s*JSON\.parse\('(.+?)'\);/s
        ];

        for (let i = 0; i < rawDataPatterns.length; i++) {
          const pattern = rawDataPatterns[i];
          const match = htmlContent.match(pattern);
          if (match && match[1]) {
            let jsonString = match[1];

            // Unescape the JSON string (EXACT Postman pattern)
            jsonString = jsonString.replace(/\\u0026/g, '&');
            jsonString = jsonString.replace(/\\"/g, '"');
            jsonString = jsonString.replace(/\\\\/g, '\\');

            try {
              const rawData = JSON.parse(jsonString);

              if (Array.isArray(rawData) && rawData.length > 0) {
                // Log first row to see available fields
                if (rawData.length > 0) {
                  console.log(`[getPlayerCards] Sample RowData fields: ${Object.keys(rawData[0]).join(', ')}`);
                  console.log(`[getPlayerCards] Sample RowData gemrateId fields:`, {
                    gemrateId: rawData[0].gemrateId,
                    gemrate_id: rawData[0].gemrate_id,
                    universal_gemrate_id: rawData[0].universal_gemrate_id,
                    id: rawData[0].id,
                    _id: rawData[0]._id
                  });
                  // Log the full first row to see all possible ID fields
                  const firstRowKeys = Object.keys(rawData[0]);
                  const idLikeKeys = firstRowKeys.filter(k => k.toLowerCase().includes('id') || k.toLowerCase().includes('gemrate'));
                  console.log(`[getPlayerCards] ID-like fields in first row:`, idLikeKeys.map(k => `${k}: ${rawData[0][k]}`).join(', '));
                }
                
                // Map RowData to our card format (using Postman field names)
                // Debug: Log first rowData to see available fields
                if (rawData.length > 0) {
                  console.log('[getPlayerCards] First rowData keys:', Object.keys(rawData[0]));
                  console.log('[getPlayerCards] First rowData parallel fields:', {
                    parallel: rawData[0].parallel,
                    parallel_type: rawData[0].parallel_type,
                    parallelName: rawData[0].parallelName,
                    variant: rawData[0].variant,
                    allKeys: Object.keys(rawData[0]).filter(k => k.toLowerCase().includes('parallel') || k.toLowerCase().includes('variant'))
                  });
                }
                const cards = rawData.map((rowData) => {
                  const category = rowData.category || rowData.cat || '';
                  const year = rowData.year || '';
                  const setName = rowData.set_name || rowData.set || rowData.cardSet || '';
                  const name = rowData.name || rowData.player || '';
                  // Try multiple possible field names for parallel
                  const parallel = rowData.parallel || rowData.parallel_type || rowData.parallelName || rowData.variant || rowData.parallel_name || '';
                  const cardNumber = rowData.card_number || rowData.number || rowData.cardNum || rowData['card #'] || '';
                  const gems = rowData.gems || rowData.gemsCount || null;
                  const totalGrades = rowData.total || rowData.totalGrades || rowData.totalGradesCount || null;
                  const gemRate = rowData.gem_rate || rowData.gemRate || rowData.gemRatePercent || rowData['gem %'] || '';
                  
                  // Try multiple possible field names for gemrateId
                  // Check universal_gemrate_id first (this might be the correct one for universal search)
                  // Then check gemrate_id (card-specific ID)
                  const gemrateId = rowData.universal_gemrate_id || rowData.gemrate_id || rowData.gemrateId || rowData.id || rowData._id || null;

                  return {
                    number: cardNumber || '',
                    player: name,
                    category,
                    year,
                    set: setName || '',
                    parallel,
                    gems: typeof gems === 'number' ? gems : (gems ? parseInt(String(gems).replace(/[,\s]/g, ''), 10) : null),
                    totalGrades: typeof totalGrades === 'number' ? totalGrades : (totalGrades ? parseInt(String(totalGrades).replace(/[,\s]/g, ''), 10) : null),
                    gemRate: gemRate || '',
                    gemrateId: gemrateId || null
                  };
                });
                
                // Log summary of gemrateId extraction
                const cardsWithId = cards.filter(c => c.gemrateId).length;
                const cardsWithParallel = cards.filter(c => c.parallel && c.parallel.trim() !== '').length;
                console.log(`[getPlayerCards] Total cards: ${cards.length}, Cards with gemrateId: ${cardsWithId}, Cards with parallel: ${cardsWithParallel}`);
                if (cardsWithParallel > 0) {
                  const sampleParallels = cards.filter(c => c.parallel && c.parallel.trim() !== '').slice(0, 3).map(c => c.parallel);
                  console.log(`[getPlayerCards] Sample parallel values:`, sampleParallels);
                }
                
                // Log a few sample cards to help debug gemrate_id matching issues
                if (cards.length > 0) {
                  const sampleCards = cards.slice(0, 5).map(c => ({
                    player: c.player,
                    set: c.set,
                    parallel: c.parallel,
                    number: c.number,
                    gemrateId: c.gemrateId
                  }));
                  console.log(`[getPlayerCards] Sample cards (first 5):`, JSON.stringify(sampleCards, null, 2));
                }

                // Sort by total grades desc
                cards.sort((a, b) => {
                  const aTotal = typeof a.totalGrades === 'number' ? a.totalGrades : -1;
                  const bTotal = typeof b.totalGrades === 'number' ? b.totalGrades : -1;
                  return bTotal - aTotal;
                });

                return cards;
              }
            } catch (parseError) {
              console.log(`⚠️ Failed to parse RowData JSON: ${parseError.message}`);
            }
          }
        }

        console.log('⚠️ RowData not found in HTTP response, falling back to Puppeteer...');
      } catch (httpError) {
        console.log(`⚠️ HTTP request failed: ${httpError.message}, trying Puppeteer...`);
      }

      // Fallback to Puppeteer if HTTP request fails
      const browserInitialized = await this.initializeBrowser();
      if (!browserInitialized || !this.page) {
        throw new Error('Puppeteer not available for GemRate player search');
      }

      try {
        await this.page.goto(fullUrl, { waitUntil: 'load', timeout: 120000 });
        
        // Verify page is still available after navigation
        if (!this.page || this.page.isClosed()) {
          throw new Error('Page closed immediately after navigation');
        }
      } catch (navError) {
        // Try to reinitialize if page was closed
        if (!this.page || this.page.isClosed()) {
          const reinitialized = await this.initializeBrowser();
          if (reinitialized && this.page) {
            try {
              await this.page.goto(fullUrl, { waitUntil: 'load', timeout: 120000 });
            } catch (retryError) {
              throw new Error(`Failed to load page after reinitialization: ${retryError.message}`);
            }
          } else {
            throw new Error('Could not reinitialize browser after page closure');
          }
        } else {
          throw navError;
        }
      }

      // Verify page is still available before waiting for selectors
      if (!this.page || this.page.isClosed()) {
        throw new Error('Page closed before waiting for grid');
      }

      // Wait for grid container / rows
      try {
        await this.page.waitForSelector('[role="grid"], .ag-root-wrapper, div[role="row"]', { timeout: 60000 });
      } catch (e) {
        if (!this.page || this.page.isClosed()) {
          throw new Error('Page closed while waiting for grid');
        }
      }

      // Give the grid some time to populate
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Try to extract RawData from HTML (like Postman does)
      // Use a timeout to prevent hanging
      try {
        if (this.page && !this.page.isClosed()) {
          let htmlContent;
          try {
            htmlContent = await Promise.race([
              this.page.content(),
              new Promise((_, reject) => setTimeout(() => reject(new Error('HTML extraction timeout')), 10000))
            ]);
          } catch (timeoutError) {
            htmlContent = null;
          }
          
          if (htmlContent) {
          // Look for RawData variable in script tags (similar to Postman approach)
          // Also try to find rowData or other data variables
          const rawDataPatterns = [
            /var\s+RawData\s*=\s*JSON\.parse\("(.*?)"\);/s,
            /const\s+RawData\s*=\s*JSON\.parse\("(.*?)"\);/s,
            /let\s+RawData\s*=\s*JSON\.parse\("(.*?)"\);/s,
            /RawData\s*=\s*JSON\.parse\("(.*?)"\);/s,
            /var\s+rawData\s*=\s*JSON\.parse\("(.*?)"\);/s,
            /const\s+rawData\s*=\s*JSON\.parse\("(.*?)"\);/s,
            // Try rowData as well
            /var\s+rowData\s*=\s*JSON\.parse\("(.*?)"\);/s,
            /const\s+rowData\s*=\s*JSON\.parse\("(.*?)"\);/s,
            /let\s+rowData\s*=\s*JSON\.parse\("(.*?)"\);/s,
            // Try without JSON.parse
            /var\s+RawData\s*=\s*(\[.*?\]);/s,
            /const\s+RawData\s*=\s*(\[.*?\]);/s
          ];
          
          let foundMatch = false;
          for (const pattern of rawDataPatterns) {
            const match = htmlContent.match(pattern);
            if (match && match[1]) {
              foundMatch = true;
              let jsonString = match[1];
              
              // Unescape the JSON string (handle double-escaped characters)
              jsonString = jsonString.replace(/\\\\u0026/g, '&');
              jsonString = jsonString.replace(/\\\\"/g, '"');
              jsonString = jsonString.replace(/\\\\\\\\/g, '\\');
              jsonString = jsonString.replace(/\\n/g, '\n');
              jsonString = jsonString.replace(/\\t/g, '\t');
              
              try {
                const rawData = JSON.parse(jsonString);
                
                if (Array.isArray(rawData) && rawData.length > 0) {
                  console.log(`✅ Extracted ${rawData.length} cards from RawData`);
                  
                  // Map RawData to our card format
                  const cards = rawData.map((rowData) => {
                    const category = rowData.category || rowData.cat || '';
                    const year = rowData.year || '';
                    const setName = rowData.set || rowData.cardSet || '';
                    const name = rowData.name || rowData.player || '';
                    const parallel = rowData.parallel || '';
                    const cardNumber = rowData.number || rowData.cardNum || rowData['card #'] || '';
                    const gems = rowData.gems || rowData.gemsCount || null;
                    const totalGrades = rowData.totalGrades || rowData.total || rowData.totalGradesCount || null;
                    const gemRate = rowData.gemRate || rowData.gemRatePercent || rowData['gem %'] || '';
                    const gemrateId = rowData.gemrateId || rowData.gemrate_id || rowData.id || null;
                    
                    return {
                      number: cardNumber || '',
                      player: name,
                      category,
                      year,
                      set: setName || '',
                      parallel,
                      gems: typeof gems === 'number' ? gems : (gems ? parseInt(String(gems).replace(/[,\s]/g, ''), 10) : null),
                      totalGrades: typeof totalGrades === 'number' ? totalGrades : (totalGrades ? parseInt(String(totalGrades).replace(/[,\s]/g, ''), 10) : null),
                      gemRate: gemRate || '',
                      gemrateId: gemrateId || null
                    };
                  });
                  
                  // Sort by total grades desc
                  cards.sort((a, b) => {
                    const aTotal = typeof a.totalGrades === 'number' ? a.totalGrades : -1;
                    const bTotal = typeof b.totalGrades === 'number' ? b.totalGrades : -1;
                    return bTotal - aTotal;
                  });
                  
                  return cards;
                }
              } catch (parseError) {
                console.log(`⚠️ Failed to parse RawData JSON: ${parseError.message}`);
              }
            }
          }
          
          if (!foundMatch) {
            console.log('⚠️ RawData not found in HTML, falling back to DOM extraction');
          }
          }
        } else {
          console.log('⚠️ Page not available for RawData extraction');
        }
      } catch (rawDataError) {
        console.log(`⚠️ RawData extraction failed: ${rawDataError.message}`);
      }

      // Verify page is still available, recreate page if needed
      if (!this.page || this.page.isClosed()) {
        console.log('⚠️ Page closed after wait, attempting to recreate...');
        // Check if browser is still available
        if (this.browser && !this.browser.isConnected()) {
          console.log('⚠️ Browser disconnected, reinitializing...');
          this.browser = null;
          this.page = null;
        }
        
        // Create new page if browser is available, otherwise reinitialize
        if (this.browser) {
          try {
            this.page = await this.browser.newPage();
            await this.page.setUserAgent(this.baseHeaders['User-Agent']);
            await this.page.setViewport({ width: 1366, height: 768 });
            console.log('✅ Created new page from existing browser');
          } catch (e) {
            console.log('⚠️ Failed to create new page, reinitializing browser...');
            this.browser = null;
            this.page = null;
          }
        }
        
        // Reinitialize if needed
        if (!this.browser || !this.page) {
          const reinitialized = await this.initializeBrowser();
          if (!reinitialized || !this.page) {
            throw new Error('Could not reinitialize browser after page closure');
          }
        }
        
        // Reload the page
        try {
          await this.page.goto(fullUrl, { waitUntil: 'load', timeout: 120000 });
          // Wait again for grid
          await this.page.waitForSelector('[role="grid"], .ag-root-wrapper, div[role="row"]', { timeout: 60000 });
          await new Promise(resolve => setTimeout(resolve, 3000));
        } catch (retryError) {
          throw new Error(`Failed to reload page: ${retryError.message}`);
        }
      }

      // Wait for cells with actual content (not just empty rows)
      try {
        if (this.page && !this.page.isClosed()) {
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
        }
      } catch (e) {
        // Silently continue
      }

      // Verify page is still available before extracting
      if (!this.page || this.page.isClosed()) {
        throw new Error('Puppeteer page closed before extraction');
      }

      // Scroll and extract cards similar to getSetChecklist
      const viewport = await this.page.$('.ag-center-cols-viewport') ||
                       await this.page.$('div[ref="eCenterViewport"]') ||
                       await this.page.$('div[role="grid"]');

      const allExtractedCards = new Map();

      if (viewport) {
        const extractCardsSafely = async () => {
          try {
            if (!this.page || this.page.isClosed()) {
              console.log('⚠️ Page closed during extraction');
              return [];
            }
            return await this.page.evaluate(() => {
              // Try to use AG Grid's API to get all rows (not just visible ones)
              try {
                // Look for AG Grid API in various possible locations
                let agGridApi = null;
                
                // Try window properties
                if (window.agGrid && window.agGrid.api) agGridApi = window.agGrid.api;
                if (!agGridApi && window.gridApi) agGridApi = window.gridApi;
                
                // Try to find grid element and access its API
                const gridElements = [
                  document.querySelector('.ag-root-wrapper'),
                  document.querySelector('[role="grid"]'),
                  document.querySelector('.ag-body-viewport')?.closest('.ag-root-wrapper'),
                  document.querySelector('.ag-center-cols-viewport')?.closest('.ag-root-wrapper')
                ].filter(el => el !== null);
                
                for (const gridEl of gridElements) {
                  // Try various property names
                  if (gridEl.__agGridInstance?.api) {
                    agGridApi = gridEl.__agGridInstance.api;
                    break;
                  }
                  if (gridEl.gridApi) {
                    agGridApi = gridEl.gridApi;
                    break;
                  }
                  if (gridEl.api) {
                    agGridApi = gridEl.api;
                    break;
                  }
                  // Try to access via ag-Grid's internal structure
                  const gridInstance = gridEl._agGridInstance || gridEl.__agGridInstance;
                  if (gridInstance?.api) {
                    agGridApi = gridInstance.api;
                    break;
                  }
                }
                
                // Try to get rowModel directly
                if (!agGridApi) {
                  for (const gridEl of gridElements) {
                    const gridInstance = gridEl.__agGridInstance || gridEl._agGridInstance;
                    if (gridInstance?.rowModel) {
                      // Try to get all row nodes from rowModel
                      const rowModel = gridInstance.rowModel;
                      if (rowModel && typeof rowModel.forEachNode === 'function') {
                        const allRows = [];
                        rowModel.forEachNode((node) => {
                          if (node.data) {
                            allRows.push(node.data);
                          }
                        });
                        if (allRows.length > 0) {
                          console.log(`✅ Using AG Grid RowModel: found ${allRows.length} total rows`);
                          return allRows.map((rowData) => {
                            const category = rowData.category || rowData.cat || '';
                            const year = rowData.year || '';
                            const setName = rowData.set || rowData.cardSet || '';
                            const name = rowData.name || rowData.player || '';
                            const parallel = rowData.parallel || '';
                            const cardNumber = rowData.number || rowData.cardNum || rowData['card #'] || '';
                            const gems = rowData.gems || rowData.gemsCount || null;
                            const totalGrades = rowData.totalGrades || rowData.total || rowData.totalGradesCount || null;
                            const gemRate = rowData.gemRate || rowData.gemRatePercent || rowData['gem %'] || '';
                            const gemrateId = rowData.gemrateId || rowData.gemrate_id || rowData.id || null;
                            
                            return {
                              number: cardNumber || '',
                              player: name,
                              category,
                              year,
                              set: setName || '',
                              parallel,
                              gems: typeof gems === 'number' ? gems : (gems ? parseInt(String(gems).replace(/[,\s]/g, ''), 10) : null),
                              totalGrades: typeof totalGrades === 'number' ? totalGrades : (totalGrades ? parseInt(String(totalGrades).replace(/[,\s]/g, ''), 10) : null),
                              gemRate: gemRate || '',
                              gemrateId: gemrateId || null,
                              key: `${cardNumber || ''}|${name}|${setName}|${parallel}`
                            };
                          });
                        }
                      }
                    }
                  }
                }
                
                // Try API if we found it
                if (agGridApi && typeof agGridApi.forEachNode === 'function') {
                  const allRows = [];
                  agGridApi.forEachNode((node) => {
                    if (node.data) {
                      allRows.push(node.data);
                    }
                  });
                  
                  if (allRows.length > 0) {
                    console.log(`✅ Using AG Grid API: found ${allRows.length} total rows`);
                    return allRows.map((rowData) => {
                      const category = rowData.category || rowData.cat || '';
                      const year = rowData.year || '';
                      const setName = rowData.set || rowData.cardSet || '';
                      const name = rowData.name || rowData.player || '';
                      const parallel = rowData.parallel || '';
                      const cardNumber = rowData.number || rowData.cardNum || rowData['card #'] || '';
                      const gems = rowData.gems || rowData.gemsCount || null;
                      const totalGrades = rowData.totalGrades || rowData.total || rowData.totalGradesCount || null;
                      const gemRate = rowData.gemRate || rowData.gemRatePercent || rowData['gem %'] || '';
                      const gemrateId = rowData.gemrateId || rowData.gemrate_id || rowData.id || null;
                      
                      return {
                        number: cardNumber || '',
                        player: name,
                        category,
                        year,
                        set: setName || '',
                        parallel,
                        gems: typeof gems === 'number' ? gems : (gems ? parseInt(String(gems).replace(/[,\s]/g, ''), 10) : null),
                        totalGrades: typeof totalGrades === 'number' ? totalGrades : (totalGrades ? parseInt(String(totalGrades).replace(/[,\s]/g, ''), 10) : null),
                        gemRate: gemRate || '',
                        gemrateId: gemrateId || null,
                        key: `${cardNumber || ''}|${name}|${setName}|${parallel}`
                      };
                    });
                  }
                }
              } catch (apiError) {
                console.log('⚠️ AG Grid API access failed, falling back to DOM extraction:', apiError.message);
              }
              
              // Fallback to DOM extraction
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
            return [];
          }
        };

        // Try to change AG Grid pagination page size to show more rows
        try {
          if (this.page && !this.page.isClosed()) {
            await this.page.evaluate(() => {
              // Try to find AG Grid API and change page size
              const gridElements = [
                document.querySelector('.ag-root-wrapper'),
                document.querySelector('[role="grid"]')
              ].filter(el => el !== null);
              
              for (const gridEl of gridElements) {
                const gridInstance = gridEl.__agGridInstance || gridEl._agGridInstance;
                if (gridInstance?.api) {
                  try {
                    // Try to set pagination page size to 100 or 250
                    gridInstance.api.paginationSetPageSize(250);
                    console.log('✅ Changed AG Grid page size to 250');
                    return;
                  } catch (e) {
                    // Try alternative method
                    if (gridInstance.api.gridOptionsApi) {
                      gridInstance.api.gridOptionsApi.setGridOption('paginationPageSize', 250);
                      console.log('✅ Changed AG Grid page size to 250 (alternative method)');
                      return;
                    }
                  }
                }
              }
            });
            // Wait for grid to update with new page size
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        } catch (e) {
          console.log('⚠️ Could not change AG Grid page size:', e.message);
        }

        // Extract from first page
        const firstPageCards = await extractCardsSafely();
        firstPageCards.forEach(card => {
          if (!allExtractedCards.has(card.key)) {
            allExtractedCards.set(card.key, card);
          }
        });
        // If we got a large number of cards (likely from AG Grid API or increased page size), skip pagination
        if (firstPageCards.length > 100) {
          console.log(`✅ Got ${firstPageCards.length} cards, skipping pagination`);
          // Skip pagination loop
        } else {

        // Try to paginate through additional pages (each page is typically 25 cards)
        // Increased to 10 pages (250 cards total) to handle large result sets
        for (let pageIndex = 0; pageIndex < 10; pageIndex++) {
          // Verify page is still available before pagination
          if (!this.page || this.page.isClosed()) {
            console.log(`⚠️ Page closed before pagination attempt ${pageIndex + 1}`);
            break;
          }

          const movedToNext = await this.page.evaluate(() => {
            // Try multiple selectors for the next page button
            const selectors = [
              '.ag-paging-button[ref="btNext"]',
              '.ag-paging-panel button[aria-label="Next Page"]',
              '.ag-paging-panel button[aria-label*="Next"]',
              '.ag-paging-button.ag-paging-next',
              'button.ag-paging-button:not(.ag-disabled)',
              '.ag-paging-panel .ag-paging-button:last-child:not(.ag-disabled)'
            ];
            
            for (const sel of selectors) {
              const btn = document.querySelector(sel);
              if (btn) {
                // Check if button is disabled
                const isDisabled = btn.classList.contains('ag-disabled') || 
                                 (btn instanceof HTMLButtonElement && btn.disabled) ||
                                 btn.getAttribute('disabled') !== null ||
                                 btn.getAttribute('aria-disabled') === 'true';
                
                if (!isDisabled) {
                  // Try to click the button
                  try {
                    btn.click();
                    return true;
                  } catch (e) {
                    // If click fails, try dispatching a click event
                    const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
                    btn.dispatchEvent(clickEvent);
                    return true;
                  }
                }
              }
            }
            return false;
          });

          if (!movedToNext) {
            break;
          }
          
          // Wait for the grid to actually update with new data
          // Check if the first row's content has changed (indicating new page loaded)
          const cardsBefore = allExtractedCards.size;
          let firstRowContent = '';
          
          // Verify page is still available
          if (!this.page || this.page.isClosed()) {
            console.log(`⚠️ Page closed during pagination at page ${pageIndex + 2}`);
            break;
          }

          // Wait for grid to update - check for row content changes
          for (let waitAttempt = 0; waitAttempt < 10; waitAttempt++) {
            await new Promise(resolve => setTimeout(resolve, 500));
            
            if (!this.page || this.page.isClosed()) {
              console.log(`⚠️ Page closed while waiting for grid update`);
              break;
            }
            
            const newFirstRow = await this.page.evaluate(() => {
              const firstDataRow = Array.from(document.querySelectorAll('div[role="row"]'))
                .find(row => {
                  const cells = row.querySelectorAll('div[role="gridcell"]');
                  return cells.length > 0 && cells[0].textContent.trim().length > 0;
                });
              if (firstDataRow) {
                const cells = firstDataRow.querySelectorAll('div[role="gridcell"]');
                return Array.from(cells).slice(0, 5).map(c => c.textContent.trim()).join('|');
              }
              return '';
            });
            
            if (newFirstRow && newFirstRow !== firstRowContent) {
              firstRowContent = newFirstRow;
              console.log(`✅ Grid updated for page ${pageIndex + 2}, first row: ${newFirstRow.substring(0, 50)}...`);
              break;
            }
            
            if (waitAttempt === 9) {
              console.log(`⚠️ Grid may not have updated for page ${pageIndex + 2}`);
            }
          }
          
          // Extract cards from this page (simplified - just extract once, no scrolling needed)
          const cards = await extractCardsSafely();
          const cardsBeforeExtraction = allExtractedCards.size;
          cards.forEach(card => {
            if (!allExtractedCards.has(card.key)) {
              allExtractedCards.set(card.key, card);
            }
          });
          const newCardsThisPage = allExtractedCards.size - cardsBeforeExtraction;
          
          // If we didn't get any new cards, pagination might not be working
          if (newCardsThisPage === 0 && pageIndex > 0) {
            console.log(`⚠️ No new cards on page ${pageIndex + 2}, stopping pagination`);
            break;
          }
        }
        } // End of else block for pagination (only run if we didn't get all cards from API)
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

  /**
   * Get trending players from GemRate dashboard page
   * @param {string} period - Time period: 'day', 'week', 'month' (default: 'week')
   * @returns {Promise<Object>} Trending players data
   */
  async getTrendingPlayers(period = 'week') {
    try {
      console.log(`📈 Fetching trending players from GemRate dashboard (period: ${period})`);
      
      await this.ensureSession();
      
      const validPeriods = ['day', 'week', 'month'];
      if (!validPeriods.includes(period)) {
        throw new Error(`Invalid period. Must be one of: ${validPeriods.join(', ')}`);
      }

      // Scrape the /dash page
      const response = await this.httpClient.get('/dash', {
        headers: this.pageHeaders,
        timeout: this.timeout * 3 // Give more time for dashboard page
      });

      if (!response.data || response.status !== 200) {
        throw new Error(`Failed to fetch dashboard page (status: ${response.status})`);
      }

      const html = response.data;
      const $ = cheerio.load(html);

      // Look for trending players data in script tags (most likely location)
      let trendingPlayers = null;
      
      $('script').each((_, el) => {
        const scriptContent = $(el).html() || '';
        
        // Try to find trending players data in various formats
        const patterns = [
          // Pattern 1: var trendingPlayers = [...]
          /(?:var|const|let)\s+trendingPlayers\s*=\s*(\[[\s\S]*?\]);/,
          // Pattern 2: trendingPlayers: [...]
          /trendingPlayers\s*:\s*(\[[\s\S]*?\])/,
          // Pattern 3: "trending_players": [...]
          /"trending_players"\s*:\s*(\[[\s\S]*?\])/,
          // Pattern 4: "Trending Players" section with data
          /"Trending Players[^"]*"\s*:\s*(\[[\s\S]*?\])/,
          // Pattern 5: Look for any array with player data near "Trending Players" text
          /Trending Players[^}]*?(\[[\s\S]{100,}?\])/
        ];
        
        for (const pattern of patterns) {
          const match = scriptContent.match(pattern);
          if (match && match[1]) {
            try {
              let jsonStr = match[1];
              // Clean up trailing commas
              jsonStr = jsonStr.replace(/,\s*\]/g, ']').replace(/,\s*\}/g, '}');
              const parsed = JSON.parse(jsonStr);
              if (Array.isArray(parsed) && parsed.length > 0) {
                trendingPlayers = parsed;
                console.log(`✅ Found trending players in script tag (${parsed.length} items)`);
                return false; // Break out of each loop
              }
            } catch (e) {
              continue;
            }
          }
        }
      });

      // If not found in scripts, try to parse from HTML structure
      if (!trendingPlayers) {
        console.log('⚠️ Trending players not found in script tags, trying HTML parsing...');
        
        // Look for sections with "Trending Players" heading
        $('h4, h5, h6, .trending-players, [id*="trending"], [class*="trending"]').each((_, el) => {
          const text = $(el).text();
          if (text.toLowerCase().includes('trending players') || text.toLowerCase().includes('trending subjects')) {
            // Try to find a table or list nearby
            const container = $(el).closest('div, section, article');
            const rows = container.find('tr, li, .player-item, [data-player]');
            
            if (rows.length > 0) {
              trendingPlayers = [];
              rows.each((_, row) => {
                const playerName = $(row).find('td:first, .player-name, [data-name]').text().trim();
                const countText = $(row).find('td:last, .count, [data-count]').text().trim();
                const count = parseInt(countText.replace(/[,\s]/g, '')) || 0;
                
                if (playerName && playerName.length > 0) {
                  trendingPlayers.push({
                    player: playerName,
                    name: playerName,
                    submissions: count,
                    count: count,
                    total_grades: count
                  });
                }
              });
              
              if (trendingPlayers.length > 0) {
                console.log(`✅ Parsed ${trendingPlayers.length} players from HTML`);
                return false; // Break out of each loop
              }
            }
          }
        });
      }

      // If still no data, fall back to Puppeteer to execute dashboard JS
      if (!trendingPlayers || trendingPlayers.length === 0) {
        console.log('⚠️ No trending players from static HTML, trying Puppeteer...');
        try {
          const puppeteerPlayers = await this.scrapeDashboardTrendingWithPuppeteer('players');
          if (puppeteerPlayers && puppeteerPlayers.length > 0) {
            trendingPlayers = puppeteerPlayers;
            console.log(`✅ Retrieved ${puppeteerPlayers.length} trending players via Puppeteer`);
          } else {
            console.log('⚠️ Puppeteer did not return any trending players');
          }
        } catch (puppeteerError) {
          console.log(`⚠️ Puppeteer trending players scrape failed: ${puppeteerError.message}`);
        }
      }

      if (trendingPlayers && trendingPlayers.length > 0) {
        console.log(`✅ Retrieved ${trendingPlayers.length} trending players (period: ${period})`);
        return {
          success: true,
          period: period,
          data: trendingPlayers,
          timestamp: new Date().toISOString()
        };
      } else {
        console.log(`⚠️ No trending players data found on dashboard`);
        return {
          success: false,
          period: period,
          error: 'No trending players data found on dashboard page',
          timestamp: new Date().toISOString()
        };
      }
    } catch (error) {
      console.error('❌ Error fetching trending players:', error.message);
      if (error.response) {
        console.error(`   Status: ${error.response.status}`);
      }
      return {
        success: false,
        period: period,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get trending sets from GemRate dashboard page
   * @param {string} period - Time period: 'day', 'week', 'month' (default: 'week')
   * @returns {Promise<Object>} Trending sets data
   */
  async getTrendingSets(period = 'week') {
    try {
      console.log(`📈 Fetching trending sets from GemRate dashboard (period: ${period})`);
      
      await this.ensureSession();
      
      const validPeriods = ['day', 'week', 'month'];
      if (!validPeriods.includes(period)) {
        throw new Error(`Invalid period. Must be one of: ${validPeriods.join(', ')}`);
      }

      // Scrape the /dash page
      const response = await this.httpClient.get('/dash', {
        headers: this.pageHeaders,
        timeout: this.timeout * 3 // Give more time for dashboard page
      });

      if (!response.data || response.status !== 200) {
        throw new Error(`Failed to fetch dashboard page (status: ${response.status})`);
      }

      const html = response.data;
      const $ = cheerio.load(html);

      // Look for trending sets data in script tags (most likely location)
      let trendingSets = null;
      
      $('script').each((_, el) => {
        const scriptContent = $(el).html() || '';
        
        // Try to find trending sets data in various formats
        const patterns = [
          // Pattern 1: var trendingSets = [...]
          /(?:var|const|let)\s+trendingSets\s*=\s*(\[[\s\S]*?\]);/,
          // Pattern 2: trendingSets: [...]
          /trendingSets\s*:\s*(\[[\s\S]*?\])/,
          // Pattern 3: "trending_sets": [...]
          /"trending_sets"\s*:\s*(\[[\s\S]*?\])/,
          // Pattern 4: "Trending Sets" section with data
          /"Trending Sets[^"]*"\s*:\s*(\[[\s\S]*?\])/,
          // Pattern 5: Look for any array with set data near "Trending Sets" text
          /Trending Sets[^}]*?(\[[\s\S]{100,}?\])/
        ];
        
        for (const pattern of patterns) {
          const match = scriptContent.match(pattern);
          if (match && match[1]) {
            try {
              let jsonStr = match[1];
              // Clean up trailing commas
              jsonStr = jsonStr.replace(/,\s*\]/g, ']').replace(/,\s*\}/g, '}');
              const parsed = JSON.parse(jsonStr);
              if (Array.isArray(parsed) && parsed.length > 0) {
                trendingSets = parsed;
                console.log(`✅ Found trending sets in script tag (${parsed.length} items)`);
                return false; // Break out of each loop
              }
            } catch (e) {
              continue;
            }
          }
        }
      });

      // If not found in scripts, try to parse from HTML structure
      if (!trendingSets) {
        console.log('⚠️ Trending sets not found in script tags, trying HTML parsing...');
        
        // Look for sections with "Trending Sets" heading
        $('h4, h5, h6, .trending-sets, [id*="trending"], [class*="trending"]').each((_, el) => {
          const text = $(el).text();
          if (text.toLowerCase().includes('trending sets')) {
            // Try to find a table or list nearby
            const container = $(el).closest('div, section, article');
            const rows = container.find('tr, li, .set-item, [data-set]');
            
            if (rows.length > 0) {
              trendingSets = [];
              rows.each((_, row) => {
                const setName = $(row).find('td:first, .set-name, [data-name]').text().trim();
                const countText = $(row).find('td:last, .count, [data-count]').text().trim();
                const count = parseInt(countText.replace(/[,\s]/g, '')) || 0;
                
                if (setName && setName.length > 0) {
                  trendingSets.push({
                    set_name: setName,
                    name: setName,
                    set: setName,
                    submissions: count,
                    count: count,
                    total_grades: count
                  });
                }
              });
              
              if (trendingSets.length > 0) {
                console.log(`✅ Parsed ${trendingSets.length} sets from HTML`);
                return false; // Break out of each loop
              }
            }
          }
        });
      }

      // If still no data, fall back to Puppeteer to execute dashboard JS
      if (!trendingSets || trendingSets.length === 0) {
        console.log('⚠️ No trending sets from static HTML, trying Puppeteer...');
        try {
          const puppeteerSets = await this.scrapeDashboardTrendingWithPuppeteer('sets');
          if (puppeteerSets && puppeteerSets.length > 0) {
            trendingSets = puppeteerSets;
            console.log(`✅ Retrieved ${puppeteerSets.length} trending sets via Puppeteer`);
          } else {
            console.log('⚠️ Puppeteer did not return any trending sets');
          }
        } catch (puppeteerError) {
          console.log(`⚠️ Puppeteer trending sets scrape failed: ${puppeteerError.message}`);
        }
      }

      if (trendingSets && trendingSets.length > 0) {
        console.log(`✅ Retrieved ${trendingSets.length} trending sets (period: ${period})`);
        return {
          success: true,
          period: period,
          data: trendingSets,
          timestamp: new Date().toISOString()
        };
      } else {
        console.log(`⚠️ No trending sets data found on dashboard`);
        return {
          success: false,
          period: period,
          error: 'No trending sets data found on dashboard page',
          timestamp: new Date().toISOString()
        };
      }
    } catch (error) {
      console.error('❌ Error fetching trending sets:', error.message);
      if (error.response) {
        console.error(`   Status: ${error.response.status}`);
      }
      return {
        success: false,
        period: period,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Use Puppeteer to load the GemRate dashboard and extract trending players or sets
   * @param {'players' | 'sets'} kind
   * @returns {Promise<Array>} Array of normalized objects
   */
  async scrapeDashboardTrendingWithPuppeteer(kind) {
    const browserInitialized = await this.initializeBrowser();
    if (!browserInitialized || !this.browser || !this.page) {
      throw new Error('Puppeteer browser not available for GemRate dashboard scraping');
    }

    const url = `${this.baseUrl}/dash`;
    console.log(`🌐 [Puppeteer] Loading GemRate dashboard: ${url}`);

    // Intercept network requests to see if there's an API call for trending data
    const apiResponses = [];
    this.page.on('response', async (response) => {
      const url = response.url();
      // Broader matching - catch any API calls that might contain trending data
      if (url.includes('trending') || url.includes('api') || url.includes('data') || 
          url.includes('dash') || url.includes('dashboard') || url.includes('chart')) {
        try {
          const contentType = response.headers()['content-type'] || '';
          if (contentType.includes('json') || url.includes('api') || url.includes('data')) {
            const data = await response.json().catch(() => null);
            if (data) {
              apiResponses.push({ url, data });
              console.log(`📡 [Puppeteer] Found API response: ${url}`);
              // Log a sample of the data
              if (Array.isArray(data) || (typeof data === 'object' && data !== null)) {
                console.log(`📡 [Puppeteer] Response data sample:`, JSON.stringify(data).substring(0, 1000));
              }
            }
          }
        } catch (e) {
          // Ignore
        }
      }
    });

    // Also intercept fetch and XHR requests
    await this.page.evaluateOnNewDocument(() => {
      // Intercept fetch
      const originalFetch = window.fetch;
      window.fetch = function(...args) {
        const url = args[0];
        if (typeof url === 'string' && (url.includes('trending') || url.includes('api') || url.includes('data'))) {
          console.log(`[Puppeteer] Intercepted fetch: ${url}`);
        }
        return originalFetch.apply(this, args);
      };

      // Intercept XMLHttpRequest
      const originalOpen = XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open = function(method, url, ...rest) {
        if (typeof url === 'string' && (url.includes('trending') || url.includes('api') || url.includes('data'))) {
          console.log(`[Puppeteer] Intercepted XHR: ${method} ${url}`);
        }
        return originalOpen.apply(this, [method, url, ...rest]);
      };
    });

    try {
      await this.page.goto(url, { waitUntil: 'networkidle2', timeout: 120000 });
    } catch (navError) {
      console.log(`⚠️ [Puppeteer] Navigation error for dashboard: ${navError.message}`);
      // Try a softer wait condition
      try {
        await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
      } catch (fallbackError) {
        throw new Error(`Failed to load GemRate dashboard: ${fallbackError.message}`);
      }
    }

    // Check if we found any API responses with trending data
    if (apiResponses.length > 0) {
      console.log(`📡 [Puppeteer] Found ${apiResponses.length} potential API responses`);
      for (const resp of apiResponses) {
        if (Array.isArray(resp.data) || (resp.data && typeof resp.data === 'object')) {
          console.log(`📡 [Puppeteer] API response from ${resp.url}:`, JSON.stringify(resp.data).substring(0, 500));
        }
      }
    }

    // Give the dashboard JS time to run and render charts/tables
    await new Promise(resolve => setTimeout(resolve, 8000));

    // Wait for specific elements that indicate the page has loaded
    try {
      await this.page.waitForSelector('h2, h3, h4, h5, canvas, [class*="trending"]', { timeout: 15000 }).catch(() => {});
    } catch (e) {
      console.log('⚠️ [Puppeteer] Timeout waiting for page elements');
    }

    // Wait for Chart.js to initialize (charts take time to render)
    try {
      await this.page.waitForFunction(() => {
        return window.Chart && (window.Chart.instances || document.querySelectorAll('canvas').length > 0);
      }, { timeout: 20000 }).catch(() => {});
      console.log('✅ [Puppeteer] Charts detected/initialized');
    } catch (e) {
      console.log('⚠️ [Puppeteer] Charts may not be loaded yet');
    }

    // Additional wait for dynamic content to fully render
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Capture console.log from page.evaluate
    this.page.on('console', msg => {
      const text = msg.text();
      if (text.includes('[Puppeteer]') || text.includes('trending') || text.includes('Chart')) {
        console.log(`[Browser Console] ${text}`);
      }
    });

    try {
      // FIRST: Try AG Grid API access (most reliable - gets structured data)
      console.log(`[Puppeteer] Attempting AG Grid API access first...`);
      const agGridExtraction = await this.page.evaluate((which) => {
        const items = [];
        
        // Try multiple methods to find AG Grid API
        let gridApi = null;
        
        // Method 1: Check window.gridApi
        if (window.gridApi && typeof window.gridApi.forEachNode === 'function') {
          gridApi = window.gridApi;
          console.log(`[Puppeteer] Found gridApi via window.gridApi`);
        }
        
        // Method 2: Check all AG Grid containers
        if (!gridApi) {
          const agGridContainers = Array.from(document.querySelectorAll('.ag-root-wrapper, [class*="ag-root"], [class*="ag-grid"]'));
          for (const container of agGridContainers) {
            const api = container.__agGridInstance || 
                       container.gridApi || 
                       container.api ||
                       (container._agGridInstance && container._agGridInstance.api);
            if (api && typeof api.forEachNode === 'function') {
              gridApi = api;
              console.log(`[Puppeteer] Found gridApi via container`);
              break;
            }
          }
        }
        
        // Method 3: Try to find via row elements
        if (!gridApi) {
          const rows = Array.from(document.querySelectorAll('[role="row"]'));
          if (rows.length > 0) {
            let parent = rows[0].parentElement;
            for (let i = 0; i < 10 && parent; i++) {
              const api = parent.__agGridInstance || parent.gridApi || parent.api;
              if (api && typeof api.forEachNode === 'function') {
                gridApi = api;
                console.log(`[Puppeteer] Found gridApi via row parent`);
                break;
              }
              parent = parent.parentElement;
            }
          }
        }
        
        if (gridApi) {
          console.log(`[Puppeteer] ✅ AG Grid API found, extracting row data...`);
          const allRowData = [];
          
          gridApi.forEachNode((node) => {
            if (node && node.data) {
              allRowData.push(node.data);
            }
          });
          
          console.log(`[Puppeteer] Extracted ${allRowData.length} rows from AG Grid API`);
          
          if (allRowData.length > 0) {
            // Log first row to see structure
            console.log(`[Puppeteer] First row keys:`, Object.keys(allRowData[0]));
            console.log(`[Puppeteer] First row sample:`, JSON.stringify(allRowData[0]).substring(0, 500));
            
            // Process each row
            for (const rowData of allRowData) {
              // Extract name - try various field names
              const nameText = rowData.name || 
                             rowData.set_name || 
                             rowData.set || 
                             rowData.title || 
                             rowData.label || 
                             rowData.player || 
                             rowData.player_name ||
                             rowData['Name'] ||
                             rowData['Set Name'] ||
                             '';
              
              // Skip header rows - but be careful not to filter out actual names
              const lowerName = (nameText || '').toLowerCase().trim();
              const headerPhrases = ['trending players', 'trending subjects', 'trending sets', 'name', 'category', 
                                    'graded', 'all time', 'last week', 'prior week', 'weekly change', 'drag', 
                                    'here', 'set row groups', 'column labels'];
              // Only skip if it's an exact match or starts with header phrase (not if it just contains one)
              if (headerPhrases.some(phrase => lowerName === phrase || lowerName.startsWith(phrase + ' '))) {
                console.log(`[Puppeteer] Skipping header row: "${nameText}"`);
                continue;
              }
              
              if (!nameText || nameText.length < 3) continue;
              
              // Extract count - try various field names
              const count = rowData['Graded, Last Week'] || 
                          rowData['graded_last_week'] || 
                          rowData.gradedLastWeek ||
                          rowData.last_week ||
                          rowData.lastWeek ||
                          rowData['Last Week'] ||
                          rowData.submissions || 
                          rowData.count || 
                          rowData.total_grades ||
                          rowData.totalGrades ||
                          rowData['Graded Last Week'] ||
                          0;
              
              if (count === 0) continue;
              
              // Extract category
              const categoryText = rowData.category || 
                                 rowData.sport || 
                                 rowData.Category ||
                                 rowData['Category'] ||
                                 '';
              
              // Extract change
              const change = rowData['Weekly Change'] || 
                           rowData.weekly_change || 
                           rowData.weeklyChange ||
                           rowData.change ||
                           null;
              
              // Extract prior week
              const priorWeek = rowData['Graded, Prior Week'] || 
                              rowData.gradedPriorWeek ||
                              rowData.prior_week ||
                              rowData.priorWeek ||
                              0;
              
              // Extract all time
              const allTime = rowData['Graded, All Time'] || 
                            rowData.gradedAllTime ||
                            rowData.all_time ||
                            rowData.allTime ||
                            0;
              
              if (which === 'players') {
                items.push({
                  player: nameText,
                  name: nameText,
                  submissions: count,
                  count: count,
                  total_grades: count,
                  category: categoryText,
                  change: change,
                  prior_week: priorWeek,
                  all_time: allTime
                });
              } else {
                items.push({
                  set_name: nameText,
                  name: nameText,
                  set: nameText,
                  submissions: count,
                  count: count,
                  total_grades: count,
                  change: change,
                  prior_week: priorWeek,
                  all_time: allTime
                });
              }
            }
            
            console.log(`[Puppeteer] ✅ AG Grid API extraction: ${items.length} ${which} items`);
            return { found: true, items: items };
          }
        }
        
        return { found: false, items: [] };
      }, kind);
      
      if (agGridExtraction.found && agGridExtraction.items && agGridExtraction.items.length > 0) {
        console.log(`✅ [Puppeteer] AG Grid API extraction succeeded: ${agGridExtraction.items.length} ${kind}`);
        // Remove duplicates and sort
        const unique = [];
        const seen = new Set();
        for (const item of agGridExtraction.items) {
          const key = (item.name || item.player || item.set_name || '').toLowerCase();
          if (!seen.has(key)) {
            seen.add(key);
            unique.push(item);
          }
        }
        unique.sort((a, b) => (b.count || 0) - (a.count || 0));
        
        // Final filter for AG Grid results too
        const headerPhrasesToFilter = [
          'trending players', 'trending subjects', 'trending sets', 'past week drag',
          'name category graded', 'all time graded', 'last week graded', 'prior week weekly change',
          'graded all time', 'graded last week', 'graded prior week', 'weekly change',
          'name category', 'all time', 'last week', 'prior week', 'past week',
          'drag here', 'set row groups', 'column labels', 'trending cards',
          'category year set graded', 'subjects', 'page'
        ];
        
        const filtered = unique.filter(item => {
          const name = (item.name || item.player || item.set_name || '').trim().toLowerCase();
          
          // Check exact matches
          if (headerPhrasesToFilter.includes(name)) {
            return false;
          }
          
          // Check if name STARTS with any header phrase (catches "Prior Week Weekly Change Michael Jordan")
          if (headerPhrasesToFilter.some(phrase => name.startsWith(phrase))) {
            return false;
          }
          
          // Check if name contains header phrase (for longer phrases)
          if (headerPhrasesToFilter.some(phrase => phrase.length > 8 && name.includes(phrase))) {
            return false;
          }
          
          // Check for multiple header words
          const words = name.split(/\s+/);
          const headerWords = ['trending', 'players', 'subjects', 'sets', 'name', 'category', 'graded', 
            'all', 'time', 'last', 'week', 'prior', 'weekly', 'change', 'past', 'page', 'drag', 'here'];
          const headerWordCount = words.filter(w => headerWords.includes(w)).length;
          if (headerWordCount >= 2) {
            return false;
          }
          
          return true;
        });
        
        console.log(`✅ [Puppeteer] AG Grid filtered: ${filtered.length} ${kind} (removed ${unique.length - filtered.length} header items)`);
        return filtered.slice(0, 50);
      }
      
      // FALLBACK: Try a simple direct text extraction
      console.log(`[Puppeteer] AG Grid API not available, falling back to text extraction...`);
      const simpleExtraction = await this.page.evaluate((which) => {
        const normalize = (str) => (str || '').replace(/\s+/g, ' ').trim().replace(/\n/g, ' ');
        const allText = normalize(document.body.textContent || '');
        const keyword = which === 'players' ? 'trending players & subjects' : 'trending sets';
        const idx = allText.toLowerCase().indexOf(keyword.toLowerCase());
        
        if (idx === -1) return { found: false, items: [] };
        
        const section = allText.substring(idx, idx + 5000);
        console.log(`[Puppeteer] Section text (first 2000 chars):`, section.substring(0, 2000));
        
        // The data is from an AG Grid table - text is concatenated
        // Pattern: "Michael JordanShohei Ohtani... Basketball1,840,9796,6945,24428%"
        // Categories act as separators: Basketball, Baseball, Football, Soccer
        
        const categories = ['Basketball', 'Baseball', 'Football', 'Soccer', 'Hockey', 'Golf', 'Pokemon', 'TCG'];
        const items = [];
        
        // Method 1: Try to find AG Grid rows directly in DOM
        try {
          // Find the specific table for trending players/sets
          // Look for the heading first, then find the grid near it
          const heading = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).find(h => {
            const text = (h.textContent || '').toLowerCase();
            return text.includes(which === 'players' ? 'trending players' : 'trending sets');
          });
          
          let gridRows = [];
          if (heading) {
            // Find the AG Grid container near the heading
            let container = heading.parentElement;
            for (let i = 0; i < 5 && container; i++) {
              const grid = container.querySelector('[role="grid"], .ag-root-wrapper, [class*="ag-grid"]');
              if (grid) {
                gridRows = Array.from(grid.querySelectorAll('[role="row"]'));
                console.log(`[Puppeteer] Found grid near heading with ${gridRows.length} rows`);
                break;
              }
              container = container.parentElement;
            }
          }
          
          // Fallback: get all rows
          if (gridRows.length === 0) {
            gridRows = Array.from(document.querySelectorAll('[role="row"]'));
            console.log(`[Puppeteer] Found ${gridRows.length} total AG Grid rows (fallback)`);
          }
          
          // Also try to find card elements (the UI might show cards, not just table rows)
          const cardElements = Array.from(document.querySelectorAll('[class*="card"], [class*="Card"], [data-testid*="card"], [class*="trending"]'));
          console.log(`[Puppeteer] Found ${cardElements.length} potential card elements`);
          
          // First, find the header row to identify column order
          let headerRow = null;
          let columnIndices = { name: -1, category: -1, lastWeek: -1 };
          
          for (const row of gridRows) {
            const headerCells = Array.from(row.querySelectorAll('[role="columnheader"], [role="gridcell"]'));
            if (headerCells.length > 0) {
              const headerText = headerCells.map(c => (c.textContent || '').toLowerCase().trim()).join('|');
              console.log(`[Puppeteer] Header row text: ${headerText}`);
              
              // Find column indices
              for (let i = 0; i < headerCells.length; i++) {
                const cellText = (headerCells[i].textContent || '').toLowerCase().trim();
                if (cellText.includes('name') && columnIndices.name === -1) {
                  columnIndices.name = i;
                }
                if (cellText.includes('category') && columnIndices.category === -1) {
                  columnIndices.category = i;
                }
                if ((cellText.includes('last week') || cellText.includes('week')) && columnIndices.lastWeek === -1) {
                  columnIndices.lastWeek = i;
                }
              }
              
              // If we found headers, this is the header row
              if (columnIndices.name !== -1 || columnIndices.category !== -1) {
                headerRow = row;
                break;
              }
            }
          }
          
          console.log(`[Puppeteer] Column indices:`, columnIndices);
          
          // Try to access AG Grid's internal data model directly
          try {
            const agGridInstances = Array.from(document.querySelectorAll('.ag-root-wrapper, [class*="ag-grid"]'));
            for (const gridEl of agGridInstances) {
              // AG Grid stores data in window or in the element
              const gridApi = gridEl.__agGridInstance || gridEl.gridApi || window.gridApi;
              if (gridApi && gridApi.getDisplayedRowCount) {
                const rowCount = gridApi.getDisplayedRowCount();
                console.log(`[Puppeteer] Found AG Grid API with ${rowCount} rows`);
                
                // Get all row data
                const allRowData = [];
                gridApi.forEachNode((node) => {
                  if (node.data) {
                    allRowData.push(node.data);
                  }
                });
                
                if (allRowData.length > 0) {
                  console.log(`[Puppeteer] Extracted ${allRowData.length} rows from AG Grid API`);
                  console.log(`[Puppeteer] First row sample:`, JSON.stringify(allRowData[0]));
                  
                  // Process row data
                  for (const rowData of allRowData) {
                    // Log first row to see structure
                    if (allRowData.indexOf(rowData) === 0) {
                      console.log(`[Puppeteer] Sample row data keys:`, Object.keys(rowData));
                      console.log(`[Puppeteer] Sample row data:`, JSON.stringify(rowData, null, 2));
                    }
                    
                    // Extract name - try various field names
                    const nameText = rowData.name || rowData.set_name || rowData.set || rowData.title || 
                                   rowData.label || rowData.player || rowData.player_name || '';
                    
                    // Extract count - based on GemRate table: "Graded, Last Week" column
                    // Try various field name patterns
                    const count = rowData['Graded, Last Week'] || 
                                rowData['graded_last_week'] || 
                                rowData.gradedLastWeek ||
                                rowData.last_week ||
                                rowData.lastWeek ||
                                rowData['Last Week'] ||
                                rowData.submissions || 
                                rowData.count || 
                                rowData.total_grades ||
                                rowData.totalGrades ||
                                0;
                    
                    // Extract category/sport
                    const categoryText = rowData.category || rowData.sport || rowData.Category || '';
                    
                    // Extract change percentage - "Weekly Change" column
                    const change = rowData['Weekly Change'] || 
                                 rowData.weekly_change || 
                                 rowData.weeklyChange ||
                                 rowData.change ||
                                 rowData.change_percent ||
                                 rowData.changePercent ||
                                 null;
                    
                    // Extract prior week for comparison
                    const priorWeek = rowData['Graded, Prior Week'] || 
                                    rowData['graded_prior_week'] || 
                                    rowData.gradedPriorWeek ||
                                    rowData.prior_week ||
                                    rowData.priorWeek ||
                                    rowData['Prior Week'] ||
                                    0;
                    
                    // Extract all time total
                    const allTime = rowData['Graded, All Time'] || 
                                  rowData['graded_all_time'] || 
                                  rowData.gradedAllTime ||
                                  rowData.all_time ||
                                  rowData.allTime ||
                                  rowData['All Time'] ||
                                  0;
                    
                    if (nameText && nameText.length >= 3 && nameText.length <= 80 && count > 0) {
                      if (which === 'players') {
                        items.push({ 
                          player: nameText, 
                          name: nameText, 
                          submissions: count, 
                          count, 
                          total_grades: count,
                          category: categoryText,
                          change: change,
                          prior_week: priorWeek,
                          all_time: allTime
                        });
                      } else {
                        items.push({ 
                          set_name: nameText, 
                          name: nameText, 
                          set: nameText, 
                          submissions: count, 
                          count, 
                          total_grades: count,
                          change: change,
                          prior_week: priorWeek,
                          all_time: allTime
                        });
                      }
                    }
                  }
                  
                  // If we got items from API, skip DOM extraction
                  if (items.length > 0) {
                    console.log(`[Puppeteer] ✅ Extracted ${items.length} ${which} from AG Grid API`);
                    break;
                  }
                }
              }
            }
          } catch (e) {
            console.log(`[Puppeteer] AG Grid API access failed: ${e.message}`);
          }
          
          // Now extract data rows (only if API method didn't work)
          if (items.length === 0) {
          for (const row of gridRows) {
            if (row === headerRow) continue; // Skip header row
            
            const cells = Array.from(row.querySelectorAll('[role="gridcell"]'));
            if (cells.length < 2) continue;
            
            // Log all cell contents for debugging
            const allCellTexts = cells.map((c, i) => `[${i}]="${(c.textContent || '').trim()}"`).join(', ');
            console.log(`[Puppeteer] Row cells: ${allCellTexts}`);
            
            // Check if cells contain only numbers (indicating wrong column structure)
            const firstCellText = (cells[0]?.textContent || '').trim();
            const isFirstCellNumeric = /^-?\d{1,3}(?:,\d{3})*$/.test(firstCellText);
            
            // If first cell is numeric, the set name might be:
            // 1. In a data attribute
            // 2. In a child element (like a link or span)
            // 3. In a different column structure
            // 4. In card/tile elements instead of table rows
            
            let nameText = '';
            let count = 0;
            let categoryText = '';
            
            // Extract name from Name column (column 0) - names are usually links
            if (cells.length > 0) {
              const nameCell = cells[0];
              const link = nameCell.querySelector('a');
              if (link) {
                nameText = (link.textContent || '').trim();
              } else {
                nameText = (nameCell.textContent || '').trim();
              }
            }
            
            // Extract category from Category column (column 1)
            if (cells.length > 1) {
              categoryText = (cells[1].textContent || '').trim();
            }
            
            // Extract count from "Graded, Last Week" column (column 3)
            // Table structure: Name (0), Category (1), Graded All Time (2), Graded Last Week (3), Graded Prior Week (4), Weekly Change (5)
            if (columnIndices.lastWeek !== -1 && cells.length > columnIndices.lastWeek) {
              const countText = (cells[columnIndices.lastWeek]?.textContent || '').trim();
              count = parseInt(countText.replace(/,/g, ''), 10);
            } else if (cells.length >= 4) {
              // Fallback: try column 3 (Graded Last Week)
              const countText = (cells[3]?.textContent || '').trim();
              count = parseInt(countText.replace(/,/g, ''), 10);
            }
            
            console.log(`[Puppeteer] Extracted from cells: name="${nameText}", category="${categoryText}", count=${count} (from column ${columnIndices.lastWeek !== -1 ? columnIndices.lastWeek : 3})`);
            
            // If we still don't have a name and first cell is numeric, try to get it from row data
            if (!nameText && isFirstCellNumeric) {
              // Check row data attributes
              const rowDataAttr = row.getAttribute('row-data') || row.getAttribute('data-row') || row.getAttribute('data-row-data') || '';
              if (rowDataAttr) {
                try {
                  const parsed = JSON.parse(rowDataAttr);
                  nameText = parsed.name || parsed.set_name || parsed.set || parsed.title || parsed.label || '';
                  console.log(`[Puppeteer] Found name in row data: "${nameText}"`);
                } catch (e) {
                  // Not JSON, try as string
                  if (rowDataAttr.includes('"name"') || rowDataAttr.includes('"set')) {
                    const nameMatch = rowDataAttr.match(/"name":\s*"([^"]+)"/) || rowDataAttr.match(/"set":\s*"([^"]+)"/);
                    if (nameMatch) nameText = nameMatch[1];
                  }
                }
              }
              
              // If still no name, check if row has a data-id or similar that might contain the name
              if (!nameText) {
                const rowId = row.getAttribute('row-id') || row.getAttribute('data-id') || '';
                if (rowId && !/^\d+$/.test(rowId)) {
                  nameText = rowId;
                }
              }
              
              // Last resort: skip this row if we can't find a name
              if (!nameText) {
                console.log(`[Puppeteer] Skipping row - first cell is numeric (${firstCellText}), no name found in row data`);
                continue;
              }
            }
            
            // Filter out header rows and invalid data
            const nameLower = nameText.toLowerCase();
            const excludePatterns = ['name', 'category', 'graded', 'all time', 'last week', 'prior week', 
                                   'weekly change', 'drag', 'here', 'set', 'row', 'groups', 'column', 'labels'];
            const isExcluded = excludePatterns.some(pattern => nameLower.includes(pattern));
            
            // For sets, skip if it's just a category (Basketball, Baseball, etc.)
            const isCategory = which === 'sets' && ['basketball', 'baseball', 'football', 'soccer', 'hockey', 'golf', 'pokemon', 'tcg'].includes(nameLower);
            
            // Log first few rows for debugging
            if (items.length < 3) {
              console.log(`[Puppeteer] Row ${items.length + 1}: name="${nameText}", category="${categoryText}", count=${count}, isExcluded=${isExcluded}, isCategory=${isCategory}`);
              console.log(`[Puppeteer] All cells:`, cells.map((c, i) => `[${i}]="${(c.textContent || '').trim()}"`).join(', '));
            }
            
            if (nameText && nameText.length >= 3 && nameText.length <= 80 && count > 0 && !isExcluded && !isCategory) {
              console.log(`[Puppeteer] ✅ Extracted ${which}: name="${nameText}", category="${categoryText}", count=${count}`);
              if (which === 'players') {
                items.push({ 
                  player: nameText, 
                  name: nameText, 
                  submissions: count, 
                  count, 
                  total_grades: count,
                  category: categoryText
                });
              } else {
                items.push({ 
                  set_name: nameText, 
                  name: nameText, 
                  set: nameText, 
                  submissions: count, 
                  count, 
                  total_grades: count 
                });
              }
            }
          }
          } // End of "if items.length === 0" block
          
          // If we didn't get items from table rows, try card elements
          if (items.length === 0 && cardElements.length > 0) {
            console.log(`[Puppeteer] Trying card elements extraction...`);
            for (const card of cardElements) {
              const cardText = (card.textContent || '').trim();
              // Look for set name in card (usually in a heading or title element)
              const titleEl = card.querySelector('h1, h2, h3, h4, h5, h6, [class*="title"], [class*="name"], [class*="set"]');
              const nameText = titleEl ? (titleEl.textContent || '').trim() : '';
              
              // Extract submission count
              const countMatch = cardText.match(/(\d{1,3}(?:,\d{3})*)\s*submissions?/i);
              const count = countMatch ? parseInt(countMatch[1].replace(/,/g, ''), 10) : 0;
              
              if (nameText && nameText.length >= 3 && nameText.length <= 80 && count > 0) {
                if (which === 'players') {
                  items.push({ player: nameText, name: nameText, submissions: count, count, total_grades: count });
                } else {
                  items.push({ set_name: nameText, name: nameText, set: nameText, submissions: count, count, total_grades: count });
                }
              }
            }
          }
        } catch (e) {
          console.log(`[Puppeteer] AG Grid DOM extraction failed: ${e.message}`);
        }
        
        // Method 2: Parse concatenated text by splitting on categories
        if (items.length === 0) {
          console.log(`[Puppeteer] Trying text parsing method...`);
          const categoryPattern = new RegExp(`(${categories.join('|')})`, 'gi');
          const parts = section.split(categoryPattern);
          
          for (let i = 0; i < parts.length - 1; i += 2) {
            const namesText = parts[i] || '';
            const category = parts[i + 1] || '';
            const numbersText = parts[i + 2] || '';
            
            if (!category || !categories.includes(category)) continue;
            
            // Extract numbers - format: "1,840,9796,6945,24428%"
            // These are: All Time, Last Week, Prior Week, Weekly Change
            const numbers = numbersText.match(/\d{1,3}(?:,\d{3})*/g) || [];
            const lastWeekCount = numbers.length >= 2 ? parseInt(numbers[1].replace(/,/g, ''), 10) : 0;
            
            if (lastWeekCount === 0) continue;
            
            // Extract player names - capitalized words
            const nameMatches = namesText.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g) || [];
            
            for (const nameMatch of nameMatches) {
              const name = nameMatch.trim();
              if (name.length >= 3 && name.length <= 50 && 
                  !['Drag', 'here', 'set', 'row', 'groups', 'column', 'labels', 'Name', 'Category', 
                    'Graded', 'All', 'Time', 'Last', 'Week', 'Prior', 'Weekly', 'Change'].includes(name)) {
                if (which === 'players') {
                  items.push({ 
                    player: name, 
                    name, 
                    submissions: lastWeekCount, 
                    count: lastWeekCount, 
                    total_grades: lastWeekCount,
                    category: category
                  });
                } else {
                  items.push({ 
                    set_name: name, 
                    name, 
                    set: name, 
                    submissions: lastWeekCount, 
                    count: lastWeekCount, 
                    total_grades: lastWeekCount 
                  });
                }
              }
            }
          }
        }
        
        // Remove duplicates
        const unique = [];
        const seen = new Set();
        for (const item of items) {
          const key = (item.name || item.player || item.set_name || '').toLowerCase();
          if (!seen.has(key)) {
            seen.add(key);
            unique.push(item);
          }
        }
        unique.sort((a, b) => (b.count || 0) - (a.count || 0));
        
        console.log(`✅ [Puppeteer] Extracted ${unique.length} ${which} items`);
        return { found: unique.length > 0, items: unique.slice(0, 50) };
      }, kind);
      
      if (simpleExtraction.found && simpleExtraction.items && simpleExtraction.items.length > 0) {
        console.log(`✅ [Puppeteer] Simple extraction succeeded: ${simpleExtraction.items.length} ${kind}`);
        
        // Apply final filter to simple extraction results too
        const headerPhrasesToFilter = [
          'trending players', 'trending subjects', 'trending sets', 'past week drag',
          'name category graded', 'all time graded', 'last week graded', 'prior week weekly change',
          'graded all time', 'graded last week', 'graded prior week', 'weekly change',
          'name category', 'all time', 'last week', 'prior week', 'past week',
          'drag here', 'set row groups', 'column labels', 'trending cards',
          'category year set graded', 'subjects', 'page'
        ];
        
        const headerWords = ['trending', 'players', 'subjects', 'sets', 'name', 'category', 'graded', 
                           'all', 'time', 'last', 'week', 'prior', 'weekly', 'change', 'past', 'page', 'drag', 'here'];
        
        const filtered = simpleExtraction.items.filter(item => {
          const name = (item.name || item.player || item.set_name || '').trim().toLowerCase();
          
          // Skip exact matches
          if (headerPhrasesToFilter.includes(name)) {
            console.log(`[Puppeteer] Simple filter: Removed exact match "${item.name || item.player || item.set_name}"`);
            return false;
          }
          
          // Skip if contains header phrase (for longer phrases)
          if (headerPhrasesToFilter.some(phrase => phrase.length > 5 && name.includes(phrase))) {
            console.log(`[Puppeteer] Simple filter: Removed contains "${item.name || item.player || item.set_name}"`);
            return false;
          }
          
          // Skip if starts with header phrase
          if (headerPhrasesToFilter.some(phrase => name.startsWith(phrase))) {
            console.log(`[Puppeteer] Simple filter: Removed starts with "${item.name || item.player || item.set_name}"`);
            return false;
          }
          
          // Skip single header words
          const words = name.split(/\s+/);
          if (words.length === 1 && headerWords.includes(name)) {
            console.log(`[Puppeteer] Simple filter: Removed single word "${item.name || item.player || item.set_name}"`);
            return false;
          }
          
          // Skip if 2+ words are header words
          const headerWordCount = words.filter(w => headerWords.includes(w)).length;
          if (headerWordCount >= 2) {
            console.log(`[Puppeteer] Simple filter: Removed ${headerWordCount} header words "${item.name || item.player || item.set_name}"`);
            return false;
          }
          
          return true;
        });
        
        console.log(`✅ [Puppeteer] Simple extraction filtered: ${filtered.length} ${kind} (removed ${simpleExtraction.items.length - filtered.length} header items)`);
        return filtered;
      }

      // First, let's log what's actually on the page for debugging
      const pageInfo = await this.page.evaluate(() => {
        return {
          title: document.title,
          headings: Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6')).map(h => ({
            text: h.textContent.trim(),
            tag: h.tagName
          })).slice(0, 20),
          tables: document.querySelectorAll('table').length,
          hasTrendingText: document.body.textContent.toLowerCase().includes('trending')
        };
      });
      console.log(`[Puppeteer] Page info:`, JSON.stringify(pageInfo, null, 2));

      // First, try a simple approach - get ALL text and look for patterns
      console.log(`[Puppeteer] Starting simple text extraction for ${kind}...`);
      
      const simpleResults = await this.page.evaluate((which) => {
        try {
          const normalize = (str) => (str || '').replace(/\s+/g, ' ').trim().replace(/\n/g, ' ');
          
          // Get ALL text content from the page
          const allText = normalize(document.body.textContent || '');
          console.log(`[Puppeteer] Total page text length: ${allText.length}`);
          
          // Find the trending section
          const sectionKeyword = which === 'players' ? 'trending players & subjects' : 'trending sets';
          const sectionIndex = allText.toLowerCase().indexOf(sectionKeyword.toLowerCase());
          
          if (sectionIndex === -1) {
            console.log(`[Puppeteer] Section keyword "${sectionKeyword}" not found in page text`);
            return [];
          }
          
          // Get text from the section onwards (next 10000 characters to get more data)
          let sectionText = allText.substring(sectionIndex, sectionIndex + 10000);
          
          // Remove UI text that we don't need
          sectionText = sectionText.replace(/Drag here to set row groupsDrag here to set column labels/gi, '');
          sectionText = sectionText.replace(/Name\s+Category\s+Graded,\s+All Time\s+Graded,\s+Last Week\s+Graded,\s+Prior Week\s+Weekly Change/gi, '');
          
          console.log(`[Puppeteer] Section text (first 2000 chars):`, sectionText.substring(0, 2000));
          
          const items = [];
          const categories = ['Basketball', 'Baseball', 'Football', 'Soccer', 'Hockey', 'Golf', 'Pokemon', 'TCG'];
          
          // The data is concatenated like: "Michael JordanShohei Ohtani... Basketball1,840,9796,6945,24428%"
          // Strategy: Find category words, extract names before them, and numbers after them
          // Column order: Name, Category, Graded All Time, Graded Last Week, Graded Prior Week, Weekly Change
          
          const categoryPattern = new RegExp(`\\b(${categories.join('|')})\\b`, 'gi');
          const categoryMatches = [...sectionText.matchAll(categoryPattern)];
          
          console.log(`[Puppeteer] Found ${categoryMatches.length} category matches in section`);
          
          for (let i = 0; i < categoryMatches.length; i++) {
            const match = categoryMatches[i];
            const category = match[0];
            const categoryIndex = match.index;
            
            // Get text before category (contains player/set names)
            const startIndex = i > 0 ? categoryMatches[i - 1].index + categoryMatches[i - 1][0].length : sectionIndex;
            const beforeCategory = sectionText.substring(Math.max(0, categoryIndex - 500), categoryIndex);
            
            // Get text after category (contains numbers)
            const afterCategory = sectionText.substring(categoryIndex + category.length, categoryIndex + category.length + 200);
            
            // Extract numbers - format: "1,840,9796,6945,24428%"
            // Pattern: AllTime,LastWeek,PriorWeek,Change%
            const numberMatch = afterCategory.match(/(\d{1,3}(?:,\d{3})*),(\d{1,3}(?:,\d{3})*),(\d{1,3}(?:,\d{3})*),?(\d+)?%?/);
            if (!numberMatch) {
              console.log(`[Puppeteer] No number match found after category "${category}"`);
              continue;
            }
            
            const allTime = parseInt(numberMatch[1].replace(/,/g, ''), 10);
            const lastWeek = parseInt(numberMatch[2].replace(/,/g, ''), 10);
            const priorWeek = parseInt(numberMatch[3].replace(/,/g, ''), 10);
            const change = numberMatch[4] ? parseInt(numberMatch[4], 10) : null;
            
            if (lastWeek === 0) continue;
            
            // Extract names from before category
            // Names are capitalized words, separated by other capitalized words
            // Pattern: Capital letter followed by lowercase letters, possibly with spaces and more capitalized words
            const namePattern = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\s+[A-Z][a-z]+)*)/g;
            const nameMatches = beforeCategory.match(namePattern) || [];
            
            // Filter out common words that aren't names (including headers and UI text)
            const excludeWords = ['Drag', 'here', 'set', 'row', 'groups', 'column', 'labels', 'Name', 'Category', 
                                 'Graded', 'All', 'Time', 'Last', 'Week', 'Prior', 'Weekly', 'Change', 'Past',
                                 'Trending', 'Players', 'Subjects', 'Sets', 'Page', 'of', 'To', 'Past Week'];
            
            // Common header phrases that should be excluded (check these FIRST)
            const headerPhrases = [
              'trending players', 'trending subjects', 'trending sets', 'past week drag',
              'name category graded', 'all time graded', 'last week graded', 'prior week weekly change',
              'graded all time', 'graded last week', 'graded prior week', 'weekly change',
              'name category', 'all time', 'last week', 'prior week', 'past week',
              'drag here', 'set row groups', 'column labels', 'trending cards',
              'category year set graded', 'prior week weekly change'
            ];
            
            const headerWords = ['drag', 'here', 'set', 'row', 'groups', 'column', 'labels', 'name', 'category', 
                                'graded', 'all', 'time', 'last', 'week', 'prior', 'weekly', 'change', 'past',
                                'trending', 'players', 'subjects', 'sets', 'page', 'of', 'to', 'cards', 'year'];
            
            const validNames = nameMatches
              .map(n => n.trim())
              .filter(n => {
                if (n.length < 3 || n.length > 50) return false;
                
                const lowerN = n.toLowerCase().trim();
                
                // FIRST: Check if it's an exact match to any header phrase (most important check)
                if (headerPhrases.some(phrase => lowerN === phrase || lowerN.includes(phrase))) {
                  console.log(`[Puppeteer] Filtered out header phrase: "${n}"`);
                  return false;
                }
                
                // SECOND: Check if it starts with or ends with a header phrase
                if (headerPhrases.some(phrase => lowerN.startsWith(phrase) || lowerN.endsWith(phrase))) {
                  console.log(`[Puppeteer] Filtered out name starting/ending with header phrase: "${n}"`);
                  return false;
                }
                
                // THIRD: Check if it's an exact match to an exclude word
                if (excludeWords.some(word => lowerN === word.toLowerCase())) {
                  return false;
                }
                
                // FOURTH: Check if it contains header words at the start or end
                if (headerWords.some(word => {
                  return lowerN === word || 
                         lowerN.startsWith(word + ' ') || 
                         lowerN.endsWith(' ' + word) ||
                         lowerN.startsWith(word + 's ') ||
                         lowerN.endsWith(' ' + word + 's');
                })) {
                  console.log(`[Puppeteer] Filtered out name with header word: "${n}"`);
                  return false;
                }
                
                // FIFTH: Exclude if it's a combination of header words (e.g., "Name Category", "All Time")
                const words = lowerN.split(/\s+/);
                const headerWordCount = words.filter(w => headerWords.includes(w)).length;
                if (headerWordCount >= 2) {
                  console.log(`[Puppeteer] Filtered out name with ${headerWordCount} header words: "${n}"`);
                  return false;
                }
                
                // SIXTH: Exclude if it's all caps and long (likely a header)
                if (/^[A-Z\s]+$/.test(n) && n.length > 15) {
                  return false;
                }
                
                // SEVENTH: Exclude if it contains numbers
                if (/\d/.test(n)) {
                  return false;
                }
                
                // EIGHTH: Exclude single words that are header words
                if (words.length === 1 && headerWords.includes(lowerN)) {
                  return false;
                }
                
                return true;
              });
            
            // Use the last valid name (closest to the category) as the actual name
            if (validNames.length > 0) {
              const name = validNames[validNames.length - 1];
              
              console.log(`[Puppeteer] Extracted: name="${name}", category="${category}", lastWeek=${lastWeek}, change=${change}%`);
              
              if (which === 'players') {
                items.push({ 
                  player: name, 
                  name, 
                  submissions: lastWeek, 
                  count: lastWeek, 
                  total_grades: lastWeek,
                  category: category,
                  change: change,
                  prior_week: priorWeek,
                  all_time: allTime
                });
              } else {
                items.push({ 
                  set_name: name, 
                  name, 
                  set: name, 
                  submissions: lastWeek, 
                  count: lastWeek, 
                  total_grades: lastWeek,
                  change: change,
                  prior_week: priorWeek,
                  all_time: allTime
                });
              }
            } else {
              console.log(`[Puppeteer] No valid names found before category "${category}"`);
            }
          }
          
          // Remove duplicates and filter out header phrases (post-processing safety net)
          const headerPhrasesToFilter = [
            'trending players', 'trending subjects', 'trending sets', 'past week drag',
            'name category graded', 'all time graded', 'last week graded', 'prior week weekly change',
            'graded all time', 'graded last week', 'graded prior week', 'weekly change',
            'name category', 'all time', 'last week', 'prior week', 'past week',
            'drag here', 'set row groups', 'column labels', 'trending cards',
            'category year set graded', 'prior week weekly change', 'subjects', 'page'
          ];
          
          const unique = [];
          const seen = new Set();
          for (const item of items) {
            const name = (item.name || item.player || item.set_name || '').trim();
            const lowerName = name.toLowerCase();
            
            // Skip if it's a header phrase
            if (headerPhrasesToFilter.some(phrase => lowerName === phrase || lowerName.includes(phrase))) {
              console.log(`[Puppeteer] Post-filter: Removed header phrase "${name}"`);
              continue;
            }
            
            // Skip if it's a single header word
            const words = lowerName.split(/\s+/);
            const headerWords = ['trending', 'players', 'subjects', 'sets', 'name', 'category', 'graded', 
                               'all', 'time', 'last', 'week', 'prior', 'weekly', 'change', 'past', 'page'];
            if (words.length === 1 && headerWords.includes(lowerName)) {
              console.log(`[Puppeteer] Post-filter: Removed single header word "${name}"`);
              continue;
            }
            
            // Skip if 2+ words are header words
            const headerWordCount = words.filter(w => headerWords.includes(w)).length;
            if (headerWordCount >= 2) {
              console.log(`[Puppeteer] Post-filter: Removed name with ${headerWordCount} header words "${name}"`);
              continue;
            }
            
            const key = lowerName;
            if (!seen.has(key)) {
              seen.add(key);
              unique.push(item);
            }
          }
          
          unique.sort((a, b) => (b.count || 0) - (a.count || 0));
          console.log(`[Puppeteer] Simple extraction found ${unique.length} items (after filtering)`);
          return unique.slice(0, 50);
        } catch (error) {
          console.error(`[Puppeteer] Error in simple extraction: ${error.message}`);
          return [];
        }
      }, kind);
      
      if (simpleResults && simpleResults.length > 0) {
        console.log(`✅ [Puppeteer] Simple extraction succeeded: ${simpleResults.length} ${kind}`);
        return simpleResults;
      }
      
      console.log(`⚠️ [Puppeteer] Simple extraction found nothing, trying comprehensive approach...`);
      
      const results = await this.page.evaluate((which) => {
        try {
        const textMatch = which === 'players'
          ? ['trending players', 'trending players & subjects', 'trending subjects', 'players & subjects', 'past week']
          : ['trending sets', 'past week'];

        const normalize = (str) => (str || '').replace(/\s+/g, ' ').trim();

        // Log all headings for debugging
        const allHeadings = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6')).map(h => ({
          text: normalize(h.textContent || ''),
          tag: h.tagName
        }));
        console.log(`[Puppeteer] All headings on page (${allHeadings.length}):`, allHeadings.slice(0, 15).map(h => `${h.tag}: "${h.text}"`).join(', '));

        // Get ALL text content on the page for pattern matching
        const allPageText = normalize(document.body.textContent || '');
        console.log(`[Puppeteer] Total page text length: ${allPageText.length} characters`);
        
        // Find the section with trending data
        const trendingSectionStart = allPageText.toLowerCase().indexOf(which === 'players' ? 'trending players' : 'trending sets');
        if (trendingSectionStart !== -1) {
          const sectionText = allPageText.substring(trendingSectionStart, trendingSectionStart + 5000);
          console.log(`[Puppeteer] Found trending section, first 500 chars:`, sectionText.substring(0, 500));
        }

        // First, try to find data in JavaScript variables (most reliable)
        const windowVars = ['trendingPlayers', 'trendingSets', 'trendingData', 'dashboardData'];
        for (const varName of windowVars) {
          if (window[varName] && Array.isArray(window[varName]) && window[varName].length > 0) {
            console.log(`[Puppeteer] Found ${varName} in window with ${window[varName].length} items`);
            return window[varName];
          }
        }

        // Try to find Chart.js chart instances and extract their data
        // Chart.js v3+ stores charts differently
        let chartInstances = [];
        
        // Method 1: Chart.instances (older versions)
        if (window.Chart && window.Chart.instances) {
          chartInstances = Object.values(window.Chart.instances);
          console.log(`[Puppeteer] Found Chart.js instances (method 1): ${chartInstances.length}`);
        }
        
        // Method 2: Chart.getChart() from canvas elements (v3+)
        const canvases = Array.from(document.querySelectorAll('canvas'));
        for (const canvas of canvases) {
          try {
            if (window.Chart && typeof window.Chart.getChart === 'function') {
              const chart = window.Chart.getChart(canvas);
              if (chart && !chartInstances.includes(chart)) {
                chartInstances.push(chart);
              }
            }
            // Also try direct property access
            if (canvas._chart && !chartInstances.includes(canvas._chart)) {
              chartInstances.push(canvas._chart);
            }
            if (canvas.chart && !chartInstances.includes(canvas.chart)) {
              chartInstances.push(canvas.chart);
            }
          } catch (e) {
            // Continue
          }
        }
        
        console.log(`[Puppeteer] Total chart instances found: ${chartInstances.length}`);
        
        // Extract data from all charts
        for (let i = 0; i < chartInstances.length; i++) {
          const chart = chartInstances[i];
          try {
            if (!chart || !chart.data) continue;
            
            const chartTitle = chart.options?.plugins?.title?.text || 
                             chart.options?.title?.text || 
                             chart.config?.options?.plugins?.title?.text || 
                             '';
            const chartLabel = chart.data.datasets?.[0]?.label || '';
            
            console.log(`[Puppeteer] Chart ${i}: title="${chartTitle}", label="${chartLabel}"`);
            
            // Check if this chart is for trending players/sets
            const titleLower = chartTitle.toLowerCase();
            const labelLower = chartLabel.toLowerCase();
            const isRelevant = titleLower.includes(which === 'players' ? 'player' : 'set') ||
                             labelLower.includes(which === 'players' ? 'player' : 'set') ||
                             (i >= chartInstances.length - 3); // Last few charts might be trending
            
            if (isRelevant && chart.data.labels && chart.data.datasets) {
              const labels = chart.data.labels || [];
              const datasets = chart.data.datasets || [];
              
              console.log(`[Puppeteer] Chart ${i} has ${labels.length} labels and ${datasets.length} datasets`);
              
              // Try each dataset
              for (const dataset of datasets) {
                const data = dataset.data || [];
                if (labels.length > 0 && data.length > 0 && labels.length === data.length) {
                  const items = [];
                  for (let j = 0; j < labels.length; j++) {
                    const name = normalize(String(labels[j] || ''));
                    const count = typeof data[j] === 'number' ? data[j] : parseCount(String(data[j] || ''));
                    
                    if (isValidName(name) && count > 0) {
                      if (which === 'players') {
                        items.push({ player: name, name, submissions: count, count, total_grades: count });
                      } else {
                        items.push({ set_name: name, name, set: name, submissions: count, count, total_grades: count });
                      }
                    }
                  }
                  if (items.length > 0) {
                    console.log(`[Puppeteer] Extracted ${items.length} ${which} from Chart.js chart ${i}`);
                    return items;
                  }
                }
              }
            }
          } catch (e) {
            console.log(`[Puppeteer] Error processing chart ${i}: ${e.message}`);
          }
        }

        // Try to find Chart.js charts via canvas elements
        const canvasElements = Array.from(document.querySelectorAll('canvas'));
        console.log(`[Puppeteer] Found ${canvasElements.length} canvas elements (potential charts)`);
        for (const canvas of canvasElements) {
          // Try to access Chart.js instance via canvas
          const chartInstance = canvas._chart || canvas.chart;
          if (chartInstance && chartInstance.data) {
            const label = chartInstance.config?.options?.plugins?.title?.text || '';
            if (label.toLowerCase().includes(which === 'players' ? 'player' : 'set')) {
              console.log(`[Puppeteer] Found chart via canvas: ${label}`);
              if (chartInstance.data.datasets && chartInstance.data.datasets[0]?.data) {
                return chartInstance.data.datasets[0].data;
              }
            }
          }
        }

        // Look for data in script tags
        const scripts = Array.from(document.querySelectorAll('script'));
        for (const script of scripts) {
          const content = script.textContent || script.innerHTML || '';
          const patterns = [
            new RegExp(`(?:var|const|let)\\s+trending${which === 'players' ? 'Players' : 'Sets'}\\s*=\\s*(\\[[\\s\\S]*?\\]);`, 'i'),
            new RegExp(`trending${which === 'players' ? 'Players' : 'Sets'}\\s*:\\s*(\\[[\\s\\S]*?\\])`, 'i'),
            new RegExp(`"trending_${which}"\\s*:\\s*(\\[[\\s\\S]*?\\])`, 'i')
          ];
          
          for (const pattern of patterns) {
            const match = content.match(pattern);
            if (match && match[1]) {
              try {
                let jsonStr = match[1].replace(/,\s*\]/g, ']').replace(/,\s*\}/g, '}');
                const parsed = JSON.parse(jsonStr);
                if (Array.isArray(parsed) && parsed.length > 0) {
                  console.log(`[Puppeteer] Found trending data in script tag: ${parsed.length} items`);
                  return parsed;
                }
              } catch (e) {
                continue;
              }
            }
          }
        }

        // If no JS data found, parse from DOM
        console.log(`[Puppeteer] No JS data found, parsing from DOM...`);

        // Find the section heading - be more specific
        const headingSelectors = ['h2', 'h3', 'h4', 'h5', 'h6', '[class*="heading"]', '[class*="title"]'];
        let targetHeading = null;

        for (const selector of headingSelectors) {
          const headings = Array.from(document.querySelectorAll(selector));
          for (const el of headings) {
            const text = normalize(el.textContent || '').toLowerCase();
            if (!text) continue;
            if (textMatch.some(t => text.includes(t) && text.length < 100)) {
              targetHeading = el;
              break;
            }
          }
          if (targetHeading) break;
        }

        if (!targetHeading) {
          console.log(`[Puppeteer] No heading found for ${which}. Available headings:`, 
            Array.from(document.querySelectorAll('h2,h3,h4,h5,h6')).map(h => h.textContent.trim()).slice(0, 10));
          return [];
        }

        console.log(`[Puppeteer] Found heading: "${targetHeading.textContent.trim()}"`);

        // Debug: Log the HTML structure near the heading
        const headingParent = targetHeading.parentElement;
        const headingSiblings = Array.from(headingParent?.children || []).slice(0, 20);
        console.log(`[Puppeteer] Heading siblings (first 20):`, headingSiblings.map((el, i) => ({
          index: i,
          tag: el.tagName,
          text: normalize(el.textContent || '').substring(0, 150),
          classes: el.className,
          id: el.id,
          innerHTML: el.innerHTML.substring(0, 200)
        })));

        // Also check what comes AFTER the heading
        let nextElement = targetHeading.nextElementSibling;
        let nextElements = [];
        for (let i = 0; i < 10 && nextElement; i++) {
          nextElements.push({
            tag: nextElement.tagName,
            text: normalize(nextElement.textContent || '').substring(0, 200),
            classes: nextElement.className,
            innerHTML: nextElement.innerHTML.substring(0, 300)
          });
          nextElement = nextElement.nextElementSibling;
        }
        console.log(`[Puppeteer] Elements after heading:`, nextElements);

        // Find the container - look for the next table/list/chart after the heading
        let container = targetHeading.closest('section,div[class*="section"],div[class*="container"]') || 
                       targetHeading.parentElement || 
                       document.body;

        // Look for Chart.js canvas near the heading
        const nearbyCanvases = Array.from(container.querySelectorAll('canvas'));
        console.log(`[Puppeteer] Found ${nearbyCanvases.length} canvas elements near heading`);
        for (const canvas of nearbyCanvases) {
          try {
            const chart = canvas._chart || canvas.chart || (window.Chart && window.Chart.getChart(canvas));
            if (chart && chart.data && chart.data.labels && chart.data.datasets) {
              console.log(`[Puppeteer] Found Chart.js chart with ${chart.data.labels.length} labels`);
              // Extract labels (names) and data (counts) from chart
              const labels = chart.data.labels || [];
              const dataValues = chart.data.datasets[0]?.data || [];
              
              if (labels.length > 0 && dataValues.length > 0) {
                const items = [];
                for (let i = 0; i < Math.min(labels.length, dataValues.length); i++) {
                  const name = normalize(String(labels[i] || ''));
                  const count = typeof dataValues[i] === 'number' ? dataValues[i] : parseCount(String(dataValues[i] || ''));
                  
                  if (name && isValidName(name) && count > 0) {
                    if (which === 'players') {
                      items.push({ player: name, name, submissions: count, count, total_grades: count });
                    } else {
                      items.push({ set_name: name, name, set: name, submissions: count, count, total_grades: count });
                    }
                  }
                }
                if (items.length > 0) {
                  console.log(`[Puppeteer] Extracted ${items.length} ${which} from Chart.js`);
                  return items;
                }
              }
            }
          } catch (e) {
            console.log(`[Puppeteer] Error accessing chart: ${e.message}`);
          }
        }

        // Look for table rows - be more specific
        let rows = Array.from(container.querySelectorAll('table tbody tr'));
        
        console.log(`[Puppeteer] Found ${rows.length} table rows in container`);
        
        // If no table rows, try to find any data rows nearby
        if (rows.length === 0) {
          // Look for divs or other elements that might contain the data
          const dataElements = Array.from(container.querySelectorAll('div[class*="row"], div[class*="item"], tr, li'));
          console.log(`[Puppeteer] Found ${dataElements.length} potential data elements`);
          rows = dataElements;
        }

        // If still no rows, try to find text-based data near the heading
        if (rows.length === 0) {
          console.log(`[Puppeteer] No table/chart data found, trying comprehensive text-based extraction...`);
          
          // Get all text content in a large area around the heading
          let container = targetHeading.closest('div, section') || document.body;
          
          // Try to find the actual content container - look for divs with class names that might contain data
          const possibleContainers = Array.from(container.querySelectorAll('div[class*="chart"], div[class*="data"], div[class*="trending"], div[class*="list"]'));
          if (possibleContainers.length > 0) {
            console.log(`[Puppeteer] Found ${possibleContainers.length} potential data containers`);
            container = possibleContainers[0]; // Use first potential container
          }
          
          const allText = normalize(container.textContent || '');
          console.log(`[Puppeteer] Container text length: ${allText.length} chars`);
          console.log(`[Puppeteer] Container text sample (first 500 chars):`, allText.substring(0, 500));
          
          // Look for patterns: "Name" followed by numbers, or lines with names and numbers
          // Try multiple patterns - be more flexible
          const patterns = [
            // Pattern 1: "Name: 1,234" or "Name - 1,234" or "Name 1,234"
            /([A-Z][A-Za-z\s&'\-\.]{2,60}?)\s*[:\-]?\s*(\d{1,3}(?:,\d{3})*)/g,
            // Pattern 2: Lines with name then number separated by spaces/tabs/newlines
            /([A-Z][A-Za-z\s&'\-\.]{2,60}?)\s+(\d{1,3}(?:,\d{3})*)/g,
            // Pattern 3: Number then name (reversed) - "1,234 Name"
            /(\d{1,3}(?:,\d{3})*)\s+([A-Z][A-Za-z\s&'\-\.]{2,60}?)/g,
            // Pattern 4: Look for lines that start with capital letters and end with numbers
            /^([A-Z][A-Za-z\s&'\-\.]{2,60}?)\s+(\d{1,3}(?:,\d{3})*)$/gm
          ];
          
          const items = [];
          for (let pIdx = 0; pIdx < patterns.length; pIdx++) {
            const pattern = patterns[pIdx];
            const matches = [...allText.matchAll(pattern)];
            console.log(`[Puppeteer] Pattern ${pIdx + 1} matched ${matches.length} potential items`);
            
            if (matches.length > 0) {
              console.log(`[Puppeteer] Sample matches (first 5):`, matches.slice(0, 5).map(m => `${m[1]} -> ${m[2]}`));
            }
            
            for (const match of matches) {
              let name, count;
              if (pIdx === 2) {
                // Reversed pattern (number first)
                count = parseCount(match[1]);
                name = normalize(match[2]);
              } else {
                name = normalize(match[1]);
                count = parseCount(match[2]);
              }
              
              // More lenient validation - just check it's not obviously wrong
              if (name && name.length >= 2 && name.length <= 100 && 
                  count > 0 && count < 10000000 &&
                  !excludePatterns.some(pattern => pattern.test(name))) {
                // Avoid duplicates
                const exists = items.find(item => 
                  item.name === name || 
                  item.player === name ||
                  item.set_name === name ||
                  (item.name && name.includes(item.name)) ||
                  (item.name && item.name.includes(name))
                );
                if (!exists) {
                  if (which === 'players') {
                    items.push({ player: name, name, submissions: count, count, total_grades: count });
                  } else {
                    items.push({ set_name: name, name, set: name, submissions: count, count, total_grades: count });
                  }
                }
              }
            }
            
            if (items.length > 0) {
              console.log(`[Puppeteer] Found ${items.length} items with pattern ${pIdx + 1}`);
              break; // Found data with this pattern
            }
          }
          
          if (items.length > 0) {
            console.log(`[Puppeteer] Extracted ${items.length} ${which} from text patterns`);
            // Sort by count descending and limit to top results
            items.sort((a, b) => (b.count || 0) - (a.count || 0));
            return items.slice(0, 50); // Return top 50
          } else {
            console.log(`[Puppeteer] No items extracted from text patterns`);
          }
        }
        
        // Filter out header rows and invalid rows
        rows = rows.filter(row => {
          const text = normalize(row.textContent || '').toLowerCase();
          // Exclude rows that look like headers or stats
          const excludePatterns = [
            'day prior', 'prior', 'items graded', 'show/hide', 'legend', 'category data',
            'trailing', 'average', 'pace', 'annually', 'updated', 'graded yesterday',
            'trending players', 'trending sets', 'trending cards', 'overall grading',
            'psa grading', 'by day', 'by week', 'by month', 'since'
          ];
          const shouldExclude = excludePatterns.some(pattern => text.includes(pattern));
          if (shouldExclude) {
            console.log(`[Puppeteer] Excluding row: "${text.substring(0, 50)}"`);
          }
          return !shouldExclude;
        });
        
        console.log(`[Puppeteer] After filtering: ${rows.length} rows remain`);

        const items = [];
        const parseCount = (text) => {
          if (!text) return 0;
          const cleaned = text.replace(/[,\s%()]/g, '');
          const num = parseInt(cleaned, 10);
          return Number.isFinite(num) && num > 0 ? num : 0;
        };

        // Patterns to exclude (statistics labels, UI elements)
        const excludePatterns = [
          /^(day prior|prior \d+ days?|items graded|show\/hide|legend|category data|trailing|average|pace|annually|updated|graded yesterday)$/i,
          /^[+\-]?\d+%$/,
          /^\d+$/,
          /^(trending|players|sets|cards)$/i
        ];

        const isValidName = (txt) => {
          if (!txt || txt.length < 2 || txt.length > 100) return false;
          // Must contain letters (not just numbers/symbols)
          if (!/[a-zA-Z]/.test(txt)) return false;
          // Exclude known patterns
          if (excludePatterns.some(pattern => pattern.test(txt))) return false;
          // Should look like a name (contains letters and possibly spaces/numbers)
          return true;
        };

        for (const row of rows) {
          const cells = Array.from(row.querySelectorAll('td'));
          if (cells.length < 2) continue; // Need at least 2 cells

          let name = '';
          let count = 0;

          // First cell should be the name
          const firstCellText = normalize(cells[0].textContent || '');
          if (isValidName(firstCellText)) {
            name = firstCellText;
          }

          // Last cell or cells with numbers should be the count
          for (let i = cells.length - 1; i >= 0; i--) {
            const cellText = normalize(cells[i].textContent || '');
            const maybeCount = parseCount(cellText);
            if (maybeCount > 0) {
              count = maybeCount;
              break;
            }
          }

          // If we didn't get name from first cell, try all cells
          if (!name) {
            for (const cell of cells) {
              const txt = normalize(cell.textContent || '');
              if (isValidName(txt)) {
                name = txt;
                break;
              }
            }
          }

          if (!name || !count) continue;

          if (which === 'players') {
            items.push({
              player: name,
              name,
              submissions: count,
              count,
              total_grades: count
            });
          } else {
            items.push({
              set_name: name,
              name,
              set: name,
              submissions: count,
              count,
              total_grades: count
            });
          }
        }

        console.log(`[Puppeteer] Extracted ${items.length} ${which} from DOM`);
        
        // Last resort: If we still have nothing, try extracting from the entire page text
        // Look for the trending section and extract any name/number pairs
        if (items.length === 0) {
          console.log(`[Puppeteer] No items found via DOM, trying full-page text extraction as last resort...`);
          
          const pageText = normalize(document.body.textContent || '');
          const sectionKeyword = which === 'players' ? 'trending players' : 'trending sets';
          const sectionIndex = pageText.toLowerCase().indexOf(sectionKeyword);
          
          if (sectionIndex !== -1) {
            // Get text from the trending section onwards (next 3000 chars)
            const sectionText = pageText.substring(sectionIndex, sectionIndex + 3000);
            console.log(`[Puppeteer] Section text (first 800 chars):`, sectionText.substring(0, 800));
            
            // Try to find name/number pairs - be very flexible
            const flexiblePattern = /([A-Z][A-Za-z\s&'\-\.]{2,80}?)\s+(\d{1,3}(?:,\d{3}){0,2})/g;
            const matches = [...sectionText.matchAll(flexiblePattern)];
            
            console.log(`[Puppeteer] Found ${matches.length} potential matches in section text`);
            
            for (const match of matches.slice(0, 100)) { // Limit to first 100 matches
              const name = normalize(match[1]);
              const count = parseCount(match[2]);
              
              // Very basic validation
              if (name.length >= 3 && name.length <= 80 && 
                  count > 0 && count < 10000000 &&
                  !name.toLowerCase().includes('trending') &&
                  !name.toLowerCase().includes('past week') &&
                  !name.toLowerCase().includes('day') &&
                  !name.toLowerCase().includes('prior')) {
                if (which === 'players') {
                  items.push({ player: name, name, submissions: count, count, total_grades: count });
                } else {
                  items.push({ set_name: name, name, set: name, submissions: count, count, total_grades: count });
                }
              }
            }
            
            if (items.length > 0) {
              // Remove duplicates and sort
              const unique = [];
              const seen = new Set();
              for (const item of items) {
                const key = (item.name || item.player || item.set_name || '').toLowerCase();
                if (!seen.has(key)) {
                  seen.add(key);
                  unique.push(item);
                }
              }
              unique.sort((a, b) => (b.count || 0) - (a.count || 0));
              console.log(`[Puppeteer] Extracted ${unique.length} unique ${which} from full-page text`);
              return unique.slice(0, 50);
            }
          }
        }
        
        return items;
        } catch (error) {
          console.error(`[Puppeteer] Error in evaluate function: ${error.message}`);
          console.error(`[Puppeteer] Error stack: ${error.stack}`);
          return [];
        }
      }, kind);

      console.log(`[Puppeteer] Evaluation completed, results type: ${typeof results}, isArray: ${Array.isArray(results)}, length: ${Array.isArray(results) ? results.length : 'N/A'}`);
      
      if (Array.isArray(results) && results.length > 0) {
        console.log(`[Puppeteer] Sample results (first 3):`, JSON.stringify(results.slice(0, 3), null, 2));
        
        // FINAL FILTER: Remove header phrases from ALL results (ultimate safety net)
        const headerPhrasesToFilter = [
          'trending players', 'trending subjects', 'trending sets', 'past week drag',
          'name category graded', 'all time graded', 'last week graded', 'prior week weekly change',
          'graded all time', 'graded last week', 'graded prior week', 'weekly change',
          'name category', 'all time', 'last week', 'prior week', 'past week',
          'drag here', 'set row groups', 'column labels', 'trending cards',
          'category year set graded', 'subjects', 'page'
        ];
        
        const headerWords = ['trending', 'players', 'subjects', 'sets', 'name', 'category', 'graded', 
                           'all', 'time', 'last', 'week', 'prior', 'weekly', 'change', 'past', 'page', 'drag', 'here'];
        
        const filtered = results.filter(item => {
          const name = (item.name || item.player || item.set_name || '').trim().toLowerCase();
          
          // Skip exact matches
          if (headerPhrasesToFilter.includes(name)) {
            console.log(`[Puppeteer] Final filter: Removed exact match "${item.name || item.player || item.set_name}"`);
            return false;
          }
          
          // Skip if name STARTS with any header phrase (catches "Prior Week Weekly Change Michael Jordan")
          if (headerPhrasesToFilter.some(phrase => name.startsWith(phrase))) {
            console.log(`[Puppeteer] Final filter: Removed starts with "${item.name || item.player || item.set_name}"`);
            return false;
          }
          
          // Skip if contains header phrase (for longer phrases > 8 chars to avoid false positives)
          if (headerPhrasesToFilter.some(phrase => phrase.length > 8 && name.includes(phrase))) {
            console.log(`[Puppeteer] Final filter: Removed contains "${item.name || item.player || item.set_name}"`);
            return false;
          }
          
          // Skip single header words
          const words = name.split(/\s+/);
          if (words.length === 1 && headerWords.includes(name)) {
            console.log(`[Puppeteer] Final filter: Removed single word "${item.name || item.player || item.set_name}"`);
            return false;
          }
          
          // Skip if 2+ words are header words
          const headerWordCount = words.filter(w => headerWords.includes(w)).length;
          if (headerWordCount >= 2) {
            console.log(`[Puppeteer] Final filter: Removed ${headerWordCount} header words "${item.name || item.player || item.set_name}"`);
            return false;
          }
          
          return true;
        });
        
        console.log(`✅ [Puppeteer] Final filter: ${filtered.length} ${kind} (removed ${results.length - filtered.length} header items)`);
        return filtered;
      }

      return [];
    } catch (evalError) {
      console.error(`❌ [Puppeteer] Failed to evaluate dashboard DOM: ${evalError.message}`);
      console.error(`❌ [Puppeteer] Error stack:`, evalError.stack);
      throw new Error(`Failed to evaluate dashboard DOM: ${evalError.message}`);
    }
  }
}

module.exports = new GemRateService();

