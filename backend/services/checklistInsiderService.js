const axios = require('axios');
const cheerio = require('cheerio');

class ChecklistInsiderService {
    constructor() {
        this.baseUrl = 'https://www.checklistinsider.com/ci-api';
        this.cache = new Map(); // Simple in-memory cache
    }

    /**
     * Get list of sports (categories)
     * @returns {Array} Array of sport objects {id, name, slug}
     */
    async getSports() {
        try {
            const cacheKey = 'sports';
            if (this.cache.has(cacheKey)) {
                return this.cache.get(cacheKey);
            }

            const response = await axios.get(`${this.baseUrl}/wp/v2/categories`, {
                params: {
                    per_page: 100,
                    parent: 0, // Top-level categories only
                    orderby: 'name',
                    order: 'asc'
                },
                timeout: 10000
            });

            // Filter for common sports (baseball, football, basketball, etc.)
            // Also include categories that might have "Cards" in the name
            const sports = response.data
                .filter(cat => {
                    const name = cat.name.toLowerCase();
                    const slug = cat.slug.toLowerCase();
                    return name.includes('baseball') || name.includes('football') || 
                           name.includes('basketball') || name.includes('hockey') ||
                           name.includes('soccer') || name.includes('racing') ||
                           name.includes('golf') || name.includes('wrestling') ||
                           slug.includes('baseball') || slug.includes('football') ||
                           slug.includes('basketball') || slug.includes('hockey');
                })
                .map(cat => ({
                    id: cat.id,
                    name: cat.name,
                    slug: cat.slug,
                    count: cat.count
                }));
            
            // Log what we found for debugging
            console.log(`📋 Checklist Insider categories found:`, sports.map(s => `${s.name} (ID: ${s.id}, slug: ${s.slug})`));

            // Cache for 1 hour
            this.cache.set(cacheKey, sports);

            console.log(`✅ Found ${sports.length} sports from Checklist Insider`);
            return sports;

        } catch (error) {
            console.error('❌ Error getting sports:', error.message);
            throw error;
        }
    }

    /**
     * Get subcategories for a parent category
     * @param {number} parentId - Parent category ID
     * @returns {Array} Array of subcategory objects
     */
    async getSubcategories(parentId) {
        try {
            const response = await axios.get(`${this.baseUrl}/wp/v2/categories`, {
                params: {
                    parent: parentId,
                    per_page: 100
                },
                timeout: 10000
            });
            return response.data.map(cat => ({
                id: cat.id,
                name: cat.name,
                slug: cat.slug,
                count: cat.count
            }));
        } catch (error) {
            console.error(`❌ Error getting subcategories for ${parentId}:`, error.message);
            return [];
        }
    }

    /**
     * Get years for a specific sport (by searching posts)
     * @param {string} sportId - Sport category ID
     * @param {string} sportName - Sport name (for filtering)
     * @returns {Array} Array of year objects
     */
    async getYears(sportId, sportName) {
        try {
            const cacheKey = `years_${sportId}`;
            if (this.cache.has(cacheKey)) {
                return this.cache.get(cacheKey);
            }

            // First, check if there are subcategories (posts might be in subcategories)
            console.log(`   🔍 Checking for subcategories of category ${sportId}...`);
            const subcategories = await this.getSubcategories(sportId);
            console.log(`   📋 Found ${subcategories.length} subcategories`);
            
            // Collect all category IDs to search (parent + subcategories)
            const categoryIds = [parseInt(sportId)];
            if (subcategories.length > 0) {
                subcategories.forEach(sub => {
                    categoryIds.push(sub.id);
                    console.log(`      - ${sub.name} (ID: ${sub.id}, ${sub.count} posts)`);
                });
            }

            // Get recent posts to extract years
            // Try multiple strategies: by category ID, by search term, and without filter
            console.log(`   🔍 Fetching posts for category ID ${sportId} (${sportName})...`);
            
            let response = null;
            let posts = [];
            
            // Strategy 1: Try fetching posts sequentially (one at a time) to avoid overwhelming the API
            try {
                console.log(`   🔍 Searching ${categoryIds.length} categories sequentially: ${categoryIds.join(', ')}`);
                const categoryResults = [];
                
                // Fetch categories sequentially to avoid rate limiting/timeouts
                for (const catId of categoryIds) {
                    const maxRetries = 1; // Only 1 retry since we're doing sequential
                    let lastError = null;
                    let success = false;
                    
                    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
                        try {
                            const timeout = 60000; // 60s timeout
                            console.log(`   🔍 Fetching posts for category ${catId} (attempt ${attempt}, timeout: ${timeout}ms)...`);
                            
                            const catResponse = await axios.get(`${this.baseUrl}/wp/v2/posts`, {
                                params: {
                                    categories: catId,
                                    per_page: 100,
                                    orderby: 'date',
                                    order: 'desc'
                                },
                                timeout: timeout
                            });
                            
                            const postCount = catResponse.data ? catResponse.data.length : 0;
                            categoryResults.push({ id: catId, count: postCount });
                            
                            if (postCount > 0) {
                                posts = posts.concat(catResponse.data);
                                console.log(`   ✅ Category ${catId}: Found ${postCount} posts`);
                                success = true;
                                break; // Success, move to next category
                            } else {
                                console.log(`   ⚠️ Category ${catId}: Found 0 posts (API returned empty array)`);
                                success = true; // Not an error, just empty
                                break;
                            }
                        } catch (e) {
                            lastError = e;
                            if (e.code === 'ECONNABORTED' || e.message.includes('timeout')) {
                                console.log(`   ⏱️ Category ${catId} timeout on attempt ${attempt}`);
                                if (attempt <= maxRetries) {
                                    console.log(`   ⏳ Waiting 3 seconds before retry...`);
                                    await new Promise(resolve => setTimeout(resolve, 3000));
                                    continue;
                                }
                            } else {
                                console.log(`   ❌ Category ${catId} failed: ${e.message}`);
                                break; // Don't retry for non-timeout errors
                            }
                        }
                    }
                    
                    if (!success) {
                        console.log(`   ❌ Category ${catId} failed after all attempts: ${lastError?.message || 'Unknown error'}`);
                        categoryResults.push({ id: catId, count: 0, error: lastError?.message });
                    }
                    
                    // Small delay between categories to be gentle on the API
                    if (catId !== categoryIds[categoryIds.length - 1]) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                }
                
                // Remove duplicates by post ID
                const uniquePosts = Array.from(new Map(posts.map(p => [p.id, p])).values());
                posts = uniquePosts;
                
                const totalFromCategories = categoryResults.reduce((sum, r) => sum + r.count, 0);
                console.log(`   📊 Summary: ${totalFromCategories} total posts from ${categoryResults.length} categories, ${posts.length} unique after deduplication`);
            } catch (e) {
                console.log(`   ⚠️ Strategy 1 failed: ${e.message}`);
            }
            
            // Strategy 1.5: If some categories failed, try fetching all posts and filtering client-side
            if (posts.length < 50) { // If we got very few posts, try alternative approach
                try {
                    console.log(`   🔍 Strategy 1.5: Fetching all recent posts and filtering by sport name...`);
                    const searchTerm = sportName.replace(/\s+Cards?$/i, '').toLowerCase(); // "Baseball Cards" -> "baseball"
                    
                    // Fetch posts without category filter (should be faster)
                    const allPostsResponse = await axios.get(`${this.baseUrl}/wp/v2/posts`, {
                        params: {
                            search: searchTerm,
                            per_page: 100,
                            orderby: 'date',
                            order: 'desc'
                        },
                        timeout: 60000
                    });
                    
                    const allPosts = allPostsResponse.data || [];
                    console.log(`   📄 Found ${allPosts.length} posts from search, filtering for ${sportName}...`);
                    
                    // Filter posts that match our sport (check title and categories)
                    const filteredPosts = allPosts.filter(post => {
                        const title = (post.title?.rendered || '').toLowerCase();
                        const content = (post.content?.rendered || '').toLowerCase();
                        const categories = post.categories || [];
                        
                        // Check if title/content contains sport name, or if it's in one of our target categories
                        const titleMatch = title.includes(searchTerm);
                        const contentMatch = content.includes(searchTerm);
                        const categoryMatch = categoryIds.some(catId => categories.includes(catId));
                        
                        return titleMatch || contentMatch || categoryMatch;
                    });
                    
                    if (filteredPosts.length > posts.length) {
                        console.log(`   ✅ Strategy 1.5: Found ${filteredPosts.length} additional posts via search`);
                        // Merge with existing posts
                        const allMerged = posts.concat(filteredPosts);
                        posts = Array.from(new Map(allMerged.map(p => [p.id, p])).values());
                    }
                } catch (e) {
                    console.log(`   ⚠️ Strategy 1.5 failed: ${e.message}`);
                }
            }
            
            // Strategy 2: If no posts, try searching by sport name
            if (posts.length === 0) {
                try {
                    const searchTerm = sportName.replace(/\s+Cards?$/i, '').toLowerCase(); // "Baseball Cards" -> "baseball"
                    console.log(`   🔍 Strategy 2: Searching for posts with "${searchTerm}"...`);
                    response = await axios.get(`${this.baseUrl}/wp/v2/posts`, {
                        params: {
                            search: searchTerm,
                            per_page: 100,
                            orderby: 'date',
                            order: 'desc'
                        },
                        timeout: 15000
                    });
                    posts = response.data;
                    console.log(`   📄 Strategy 2 (search): Received ${posts.length} posts`);
                } catch (e) {
                    console.log(`   ⚠️ Strategy 2 failed: ${e.message}`);
                }
            }
            
            // Strategy 3: If still no posts, try getting all recent posts (no filter)
            if (posts.length === 0) {
                try {
                    console.log(`   🔍 Strategy 3: Getting all recent posts...`);
                    response = await axios.get(`${this.baseUrl}/wp/v2/posts`, {
                        params: {
                            per_page: 100,
                            orderby: 'date',
                            order: 'desc'
                        },
                        timeout: 15000
                    });
                    // Filter posts that might be related to this sport
                    const searchTerm = sportName.replace(/\s+Cards?$/i, '').toLowerCase();
                    posts = response.data.filter(post => {
                        const title = (post.title.rendered || '').toLowerCase();
                        const content = (post.content.rendered || '').toLowerCase();
                        return title.includes(searchTerm) || content.includes(searchTerm);
                    });
                    console.log(`   📄 Strategy 3 (all posts, filtered): Received ${posts.length} posts`);
                } catch (e) {
                    console.log(`   ⚠️ Strategy 3 failed: ${e.message}`);
                }
            }
            
            console.log(`   📄 Total posts found: ${posts.length}`);
            
            // Extract years from post titles (e.g., "2025 Topps", "2024 Panini")
            const years = new Set();
            const currentYear = new Date().getFullYear();
            
            // Log first few post titles for debugging
            if (posts.length > 0) {
                console.log(`   📋 Sample post titles:`);
                posts.slice(0, 5).forEach((post, i) => {
                    const title = post.title.rendered || '';
                    const cleanTitle = title.replace(/<[^>]*>/g, '');
                    console.log(`      ${i + 1}. ${cleanTitle}`);
                });
            } else {
                console.log(`   ⚠️ No posts found for ${sportName}. This might mean:`);
                console.log(`      - Checklist Insider doesn't have posts in this category`);
                console.log(`      - The category ID (${sportId}) might be incorrect`);
                console.log(`      - Posts might be in a different category structure`);
            }
            
            posts.forEach(post => {
                const title = post.title.rendered || '';
                const cleanTitle = title.replace(/<[^>]*>/g, ''); // Remove HTML tags
                // Look for 4-digit years (1900-2100)
                const yearMatches = cleanTitle.match(/\b(19|20)\d{2}\b/g);
                if (yearMatches) {
                    yearMatches.forEach(yearStr => {
                        const year = parseInt(yearStr);
                        if (year >= 1900 && year <= currentYear + 1) {
                            years.add(year);
                        }
                    });
                }
            });
            
            console.log(`   📅 Extracted years:`, Array.from(years).sort((a, b) => b - a));

            const yearArray = Array.from(years)
                .sort((a, b) => b - a) // Most recent first
                .map(year => ({
                    year: year,
                    display: year.toString()
                }));

            // Cache for 1 hour
            this.cache.set(cacheKey, yearArray);

            console.log(`✅ Found ${yearArray.length} years for ${sportName}`);
            return yearArray;

        } catch (error) {
            console.error(`❌ Error getting years for ${sportName}:`, error.message);
            throw error;
        }
    }

    /**
     * Get sets for a specific sport and year
     * @param {string} sportId - Sport category ID (parent category)
     * @param {number} year - Year
     * @returns {Array} Array of set objects {id, name, slug, link}
     */
    async getSets(sportId, year) {
        try {
            const cacheKey = `sets_${sportId}_${year}`;
            if (this.cache.has(cacheKey)) {
                return this.cache.get(cacheKey);
            }

            // First, find the subcategory that matches this year (e.g., "2025 Baseball Cards")
            console.log(`   🔍 Finding subcategory for ${year}...`);
            const subcategories = await this.getSubcategories(sportId);
            const yearSubcategory = subcategories.find(sub => {
                const subName = sub.name.toLowerCase();
                return subName.includes(year.toString());
            });

            let categoryIdsToSearch = [sportId]; // Start with parent category
            if (yearSubcategory) {
                console.log(`   ✅ Found year subcategory: ${yearSubcategory.name} (ID: ${yearSubcategory.id})`);
                categoryIdsToSearch = [yearSubcategory.id]; // Use the year-specific subcategory
            } else {
                console.log(`   ⚠️ No year-specific subcategory found, searching all subcategories...`);
                // Add all subcategories to search
                subcategories.forEach(sub => categoryIdsToSearch.push(sub.id));
            }

            // Try fetching from each category
            let allPosts = [];
            for (const catId of categoryIdsToSearch) {
                try {
                    console.log(`   🔍 Fetching sets from category ${catId} for year ${year}...`);
                    const response = await axios.get(`${this.baseUrl}/wp/v2/posts`, {
                        params: {
                            categories: catId,
                            per_page: 100,
                            orderby: 'title',
                            order: 'asc'
                        },
                        timeout: 60000
                    });

                    // Filter posts that contain the year in the title
                    const yearPosts = (response.data || []).filter(post => {
                        const title = (post.title?.rendered || '').toLowerCase();
                        return title.includes(year.toString());
                    });

                    if (yearPosts.length > 0) {
                        console.log(`   ✅ Category ${catId}: Found ${yearPosts.length} posts for ${year}`);
                        allPosts = allPosts.concat(yearPosts);
                    } else {
                        console.log(`   ⚠️ Category ${catId}: Found ${response.data?.length || 0} posts, but none match year ${year}`);
                    }
                } catch (error) {
                    console.log(`   ❌ Category ${catId} failed: ${error.message}`);
                    // Continue to next category
                }
            }

            // Remove duplicates by post ID
            const uniquePosts = Array.from(new Map(allPosts.map(p => [p.id, p])).values());

            const sets = uniquePosts.map(post => ({
                id: post.id,
                name: post.title.rendered.replace(/<[^>]*>/g, '').trim(), // Strip HTML
                slug: post.slug,
                link: post.link,
                date: post.date
            }));

            // Cache for 1 hour
            this.cache.set(cacheKey, sets);

            console.log(`✅ Found ${sets.length} sets for ${year}`);
            return sets;

        } catch (error) {
            console.error(`❌ Error getting sets for ${year}:`, error.message);
            throw error;
        }
    }

    /**
     * Get available checklist sections for a specific set (post)
     * @param {string} postId - Post ID
     * @returns {Array} Array of section objects {id, name, description}
     */
    async getChecklistSections(postId) {
        try {
            const cacheKey = `checklist_sections_${postId}`;
            if (this.cache.has(cacheKey)) {
                return this.cache.get(cacheKey);
            }

            const response = await axios.get(`${this.baseUrl}/wp/v2/posts/${postId}`, {
                timeout: 15000
            });

            const post = response.data;
            const html = post.content.rendered;
            const $ = cheerio.load(html);
            const sections = [];

            // Find all h3 headers which typically mark different checklist sections
            $('h3').each((index, element) => {
                const $header = $(element);
                const sectionName = $header.text().trim();
                
                // Skip empty headers
                if (!sectionName) return;
                
                // Create a section ID from the name (sanitized)
                const sectionId = sectionName.toLowerCase()
                    .replace(/[^a-z0-9]+/g, '-')
                    .replace(/^-+|-+$/g, '');
                
                sections.push({
                    id: sectionId,
                    name: sectionName,
                    description: '' // Could extract description from next paragraph if needed
                });
            });

            // If no h3 headers found, create a default "Base Checklist" section
            if (sections.length === 0) {
                sections.push({
                    id: 'base-checklist',
                    name: 'Base Checklist',
                    description: ''
                });
            }

            // Cache for 1 hour
            this.cache.set(cacheKey, sections);

            console.log(`✅ Found ${sections.length} checklist sections for post ${postId}`);
            return sections;

        } catch (error) {
            console.error(`❌ Error getting checklist sections for post ${postId}:`, error.message);
            throw error;
        }
    }

    /**
     * Get checklist for a specific set (post) and optionally a specific section
     * @param {string} postId - Post ID
     * @param {string} sectionId - Optional section ID (e.g., 'base-checklist', 'parallels')
     * @returns {Array} Array of card objects {number, player, team}
     */
    async getChecklist(postId, sectionId = null) {
        try {
            const cacheKey = `checklist_${postId}_${sectionId || 'all'}`;
            if (this.cache.has(cacheKey)) {
                return this.cache.get(cacheKey);
            }

            const response = await axios.get(`${this.baseUrl}/wp/v2/posts/${postId}`, {
                timeout: 15000
            });

            const post = response.data;
            const html = post.content.rendered;
            const $ = cheerio.load(html);
            const cards = [];

            // If sectionId is provided, only parse content after that section's h3 header
            let contentToParse = $;
            if (sectionId) {
                // Find the h3 header that matches this section
                let $sectionStart = null;
                $('h3').each((index, element) => {
                    const $header = $(element);
                    const headerText = $header.text().trim();
                    const headerId = headerText.toLowerCase()
                        .replace(/[^a-z0-9]+/g, '-')
                        .replace(/^-+|-+$/g, '');
                    
                    if (headerId === sectionId) {
                        $sectionStart = $header;
                        return false; // Break the loop
                    }
                });

                if ($sectionStart && $sectionStart.length > 0) {
                    // Get all content between this h3 and the next h3 (or end of document)
                    const $sectionContent = $('<div>');
                    let $current = $sectionStart.next();
                    
                    while ($current.length > 0) {
                        // Stop if we hit another h3 (next section)
                        if ($current.is('h3')) {
                            break;
                        }
                        // Clone and append this element
                        $sectionContent.append($current.clone());
                        $current = $current.next();
                    }
                    
                    contentToParse = cheerio.load($sectionContent.html() || '');
                    console.log(`   📋 Parsing section "${sectionId}"`);
                } else {
                    console.log(`   ⚠️ Section "${sectionId}" not found, parsing entire checklist`);
                }
            }

            // Parse checklist from HTML - look for tables, lists, or text blocks
            // Common patterns: 
            // 1. Tables with card numbers, player names, teams
            // 2. Text blocks like "1 Player Name - Team Name<br/>"
            // 3. Lists with card information
            // 4. Individual div elements containing cards (e.g., <div>6 Tyler Gentry - Kansas City Royals RC</div>)
            
            // Strategy 0: Look for card patterns in individual div elements first
            // This handles cases where cards are in separate divs, not on the same line as summary text
            contentToParse('div').each((index, element) => {
                const $div = contentToParse(element);
                const divText = $div.text().trim();
                
                if (!divText) return;
                
                // Skip divs that are clearly summary/info (not cards)
                const divLower = divText.toLowerCase();
                const summaryPatterns = [
                    /^\d+\s*cards?\.?$/i,  // "62 cards." or "62 cards"
                    /^lists?\s+all/i,      // "Lists all..."
                    /^parallels?:/i,       // "Parallels:"
                    /odds/i,               // Contains "odds"
                    /buy on ebay/i,         // "Buy on eBay"
                    /cards per pack/i,     // "cards per pack"
                    /packs per box/i       // "packs per box"
                ];
                
                const isSummaryDiv = summaryPatterns.some(pattern => pattern.test(divText));
                if (isSummaryDiv) return; // Skip summary divs
                
                // Try to match card pattern in this div
                const cardMatch = divText.match(/^([A-Z0-9]+(?:-[A-Z0-9]+)?)\s+(.+?)\s+-\s+(.+?)(?:\s+(RC|Rookie|Rookie Card))?$/i);
                if (cardMatch) {
                    const number = cardMatch[1].trim();
                    const player = cardMatch[2].trim();
                    const team = cardMatch[3].trim();
                    
                    // Validate it's a real card
                    const playerLower = player.toLowerCase();
                    const teamLower = team.toLowerCase();
                    
                    // Skip if it contains summary keywords
                    const summaryKeywords = [
                        'cards per pack', 'packs per box', 'total cards', 'silver pack',
                        'odds', '1:', 'hobby', 'jumbo', 'display', 'hanger', 'blaster', 'mega',
                        'buy on ebay', 'cards.', 'packs.', 'parallels:', 'exclusive to', 'print run',
                        'lists all', 'all rookie cards', 'from base set'
                    ];
                    const isSummary = summaryKeywords.some(kw => 
                        playerLower.includes(kw) || teamLower.includes(kw)
                    );
                    
                    const hasSemicolons = player.includes(';') || team.includes(';');
                    const hasOddsPattern = /\d+:\d+/.test(player) || /\d+:\d+/.test(team);
                    const isTooLong = player.length > 50 || team.length > 50;
                    const startsWithSummary = playerLower.startsWith('cards') || 
                                            playerLower.startsWith('lists') ||
                                            teamLower.startsWith('cards');
                    
                    if (!isSummary && !hasSemicolons && !hasOddsPattern && !isTooLong && !startsWithSummary &&
                        player.length >= 2 && player.length <= 50 &&
                        team.length >= 2 && team.length <= 50 &&
                        /^[A-Z]/.test(player) && /^[A-Z]/.test(team)) {
                        cards.push({
                            number: number,
                            player: player,
                            team: team,
                            tcdbId: null,
                            url: post.link
                        });
                    }
                }
            });
            
            // Strategy 0.5: Look for text blocks with pattern "CARDNUMBER Player Name - Team Name"
            // This is common in Checklist Insider posts
            // Card numbers can be: "1", "FPA-AB", "BSA-AA", "20", etc.
            const textContent = contentToParse.text();
            const lines = textContent.split(/\n|\r|<br\s*\/?>/i);
            
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;
                
                // Pattern: "CARDNUMBER Player Name - Team Name" or "CARDNUMBER Player Name - Team Name RC"
                // Card number can be: digits only, or alphanumeric with dashes (e.g., "FPA-AB", "BSA-AA", "1", "20")
                // Examples: 
                // - "1 Shohei Ohtani - Los Angeles Dodgers"
                // - "FPA-AB Adrían Beltré - Texas Rangers"
                // - "BSA-AA Adael Amador - Colorado Rockies"
                // - "6 Tyler Gentry - Kansas City Royals RC"
                // - "62 cards.Lists all rookie cards from base set above. 6 Tyler Gentry - Kansas City Royals" (card embedded in summary)
                
                // First, try to match card pattern at the start of the line
                let cardMatch = trimmed.match(/^([A-Z0-9]+(?:-[A-Z0-9]+)?)\s+(.+?)\s+-\s+(.+?)(?:\s+(RC|Rookie|Rookie Card))?$/i);
                
                // If no match at start, try to find card pattern anywhere in the line
                // This handles cases like "62 cards. ... 6 Tyler Gentry - Kansas City Royals"
                if (!cardMatch) {
                    // Strategy: Find all potential card patterns, then validate each one
                    // Look for pattern: NUMBER/CODE + Player Name (capitalized, 2-40 chars) + " - " + Team Name (capitalized, 2-50 chars)
                    // Use a more restrictive pattern that requires player/team to look like actual names
                    const flexiblePattern = /([A-Z0-9]+(?:-[A-Z0-9]+)?)\s+([A-Z][A-Za-z\s\.'-]{2,40}?)\s+-\s+([A-Z][A-Za-z\s\.'-]{2,50}?)(?:\s+(RC|Rookie|Rookie Card))?/gi;
                    let matches = [];
                    let match;
                    while ((match = flexiblePattern.exec(trimmed)) !== null) {
                        matches.push(match);
                    }
                    
                    // Validate each match to find the actual card (not summary text)
                    if (matches.length > 0) {
                        // Try matches from end to start (last match is usually the actual card)
                        for (let i = matches.length - 1; i >= 0; i--) {
                            const testMatch = matches[i];
                            const testNumber = testMatch[1].trim();
                            const testPlayer = testMatch[2].trim();
                            const testTeam = testMatch[3].trim();
                            const testPlayerLower = testPlayer.toLowerCase();
                            const testTeamLower = testTeam.toLowerCase();
                            
                            // Skip if player/team contains summary keywords (be more specific)
                            const summaryKeywords = [
                                'cards.', 'cards per', 'lists all', 'all rookie', 'from base set', 'above',
                                'odds', '1:', 'hobby', 'jumbo', 'display', 'hanger', 'blaster', 'mega',
                                'buy on ebay', 'packs.', 'parallels:', 'exclusive to', 'print run',
                                'foil pattern', 'crackle', 'diamante', 'holo foil'
                            ];
                            const hasSummary = summaryKeywords.some(kw => 
                                testPlayerLower.includes(kw) || testTeamLower.includes(kw)
                            );
                            
                            // Skip if player/team starts with summary words
                            const startsWithSummary = testPlayerLower.startsWith('cards') || 
                                                    testPlayerLower.startsWith('lists') ||
                                                    testPlayerLower.startsWith('parallels') ||
                                                    testTeamLower.startsWith('cards') ||
                                                    testTeamLower.startsWith('odds');
                            
                            // Skip if it has semicolons or odds patterns
                            const hasSemicolons = testPlayer.includes(';') || testTeam.includes(';');
                            const hasOddsPattern = /\d+:\d+/.test(testPlayer) || /\d+:\d+/.test(testTeam);
                            
                            // Skip if player/team are too long (likely contains extra text)
                            const isTooLong = testPlayer.length > 50 || testTeam.length > 50;
                            
                            // Additional validation: player and team should look like actual names
                            // They should start with capital letter, contain mostly letters, and not be too short
                            const looksLikeName = /^[A-Z][A-Za-z\s\.'-]{1,}$/.test(testPlayer) && 
                                                 /^[A-Z][A-Za-z\s\.'-]{1,}$/.test(testTeam) &&
                                                 testPlayer.length >= 2 && testPlayer.length <= 50 &&
                                                 testTeam.length >= 2 && testTeam.length <= 50 &&
                                                 // Player should have at least 2 consecutive letters (not just "cards.Lists")
                                                 /[A-Za-z]{2,}/.test(testPlayer) && /[A-Za-z]{2,}/.test(testTeam);
                            
                            // If this looks like a valid card, use it
                            if (!hasSummary && !startsWithSummary && !hasSemicolons && !hasOddsPattern && 
                                !isTooLong && looksLikeName) {
                                cardMatch = testMatch;
                                break; // Use the first valid match (from the end)
                            }
                        }
                    }
                }
                
                if (cardMatch) {
                    const number = cardMatch[1].trim();
                    const player = cardMatch[2].trim();
                    const team = cardMatch[3].trim();
                    
                    // Check if this looks like a valid card (not odds/summary info)
                    // IMPORTANT: Only check the extracted player/team, not the whole line
                    const playerLower = player.toLowerCase();
                    const teamLower = team.toLowerCase();
                    
                    // Skip if player or team contains odds information (but be specific)
                    const summaryKeywords = [
                        'cards per pack', 'packs per box', 'total cards', 'silver pack',
                        'odds', '1:', 'hobby', 'jumbo', 'display', 'hanger', 'blaster', 'mega',
                        'buy on ebay', 'packs.', 'parallels:', 'exclusive to', 'print run',
                        'foil pattern', 'crackle', 'diamante', 'holo foil'
                    ];
                    const isSummary = summaryKeywords.some(kw => 
                        playerLower.includes(kw) || teamLower.includes(kw)
                    );
                    
                    // Skip if player or team has semicolons (odds often use semicolons)
                    const hasSemicolons = player.includes(';') || team.includes(';');
                    
                    // Skip if player name is too long (likely contains odds info) or contains numbers with colons (odds)
                    const hasOddsPattern = /\d+:\d+/.test(player) || /\d+:\d+/.test(team);
                    const isTooLong = player.length > 50 || team.length > 50;
                    
                    // Additional check: if player or team starts with common summary words, skip
                    // But be careful - "Cards" as a team name might be valid, so check more carefully
                    const startsWithSummary = (playerLower.startsWith('cards') && playerLower !== 'cards') || 
                                            playerLower.startsWith('lists') ||
                                            playerLower.startsWith('parallels') ||
                                            teamLower.startsWith('cards') && teamLower !== 'cards' ||
                                            teamLower.startsWith('odds');
                    
                    // Validate that player and team look like actual names
                    const looksLikeName = /^[A-Z][A-Za-z\s\.'-]{1,}$/.test(player) && 
                                        /^[A-Z][A-Za-z\s\.'-]{1,}$/.test(team) &&
                                        player.length >= 2 && player.length <= 50 &&
                                        team.length >= 2 && team.length <= 50 &&
                                        /[A-Za-z]{2,}/.test(player) && /[A-Za-z]{2,}/.test(team);
                    
                    // Only skip if it's clearly not a card - be more lenient to avoid missing valid cards
                    if (!isSummary && !hasSemicolons && !hasOddsPattern && !isTooLong && !startsWithSummary && looksLikeName) {
                        cards.push({
                            number: number,
                            player: player,
                            team: team,
                            tcdbId: null,
                            url: post.link
                        });
                    } else {
                        // Log skipped lines for debugging (only first few to avoid spam)
                        if (cards.length < 3) {
                            console.log(`   ⏭️ Skipped line: "${trimmed.substring(0, 100)}..." (isSummary: ${isSummary}, hasSemicolons: ${hasSemicolons}, hasOddsPattern: ${hasOddsPattern}, isTooLong: ${isTooLong}, startsWithSummary: ${startsWithSummary}, looksLikeName: ${looksLikeName})`);
                        }
                    }
                } else {
                    // If it doesn't match card pattern, check if it's clearly odds to skip it
                    const lineLower = trimmed.toLowerCase();
                    const oddsKeywords = [
                        'odds', '1:', 'hobby', 'jumbo', 'display', 'hanger', 'blaster', 'mega',
                        'buy on ebay', 'cards.', 'packs.', 'parallels:', 'exclusive to'
                    ];
                    // Only skip if it's clearly odds AND doesn't look like it could be a card
                    if (oddsKeywords.some(kw => lineLower.includes(kw)) && 
                        !lineLower.match(/[a-z0-9]+(?:-[a-z0-9]+)?\s+[a-z]/i)) {
                        // This is likely odds info, skip it
                        continue;
                    }
                }
            }
            
            // If we found cards from text parsing, use those (they're usually more accurate)
            if (cards.length > 0) {
                console.log(`   ✅ Found ${cards.length} cards from text format parsing`);
            }
            
            // Strategy 1: Look for tables
            $('table tr').each((index, element) => {
                const $row = $(element);
                const $cells = $row.find('td, th');
                
                if ($cells.length >= 2) {
                    // Try to extract card number and player
                    const rowText = $row.text().trim().toLowerCase();
                    
                    // Skip header rows
                    if (rowText.includes('card') && 
                        (rowText.includes('player') || rowText.includes('#')) &&
                        (rowText.includes('select') || rowText.includes('team'))) {
                        return; // Skip header
                    }
                    
                    // Skip summary/info rows (not actual cards)
                    const summaryKeywords = [
                        'cards per pack',
                        'packs per box',
                        'boxes per case',
                        'autograph or relic',
                        'autograph and',
                        'total cards',
                        'silver pack',
                        'silver packs',
                        'cards per',
                        'per pack',
                        'per box',
                        'per case'
                    ];
                    
                    if (summaryKeywords.some(keyword => rowText.includes(keyword))) {
                        return; // Skip summary rows
                    }
                    
                    // Look for card number (usually first cell or in text)
                    let number = '';
                    let player = '';
                    let team = '';
                    
                    // Try first cell for card number
                    const firstCell = $cells.eq(0).text().trim();
                    if (firstCell.match(/^[\d\w]+$/)) {
                        number = firstCell;
                    }
                    
                    // Try subsequent cells for player/team
                    for (let i = 1; i < $cells.length; i++) {
                        const cellText = $cells.eq(i).text().trim();
                        if (cellText && !player) {
                            // Check if it looks like a player name
                            // Skip if it's summary text (contains keywords, too long, or has semicolons)
                            const cellLower = cellText.toLowerCase();
                            const isSummary = summaryKeywords.some(kw => cellLower.includes(kw)) ||
                                             cellText.includes(';') ||
                                             cellText.length > 60 ||
                                             cellLower.includes('total') ||
                                             cellLower.includes('autograph') ||
                                             cellLower.includes('relic');
                            
                            if (!isSummary && !cellText.match(/^\d+$/) && cellText.length < 60) {
                                player = cellText;
                            }
                        } else if (cellText && !team && player) {
                            // Team might be in next cell
                            // Skip "N/A" or summary text
                            const cellLower = cellText.toLowerCase();
                            const isSummary = cellText === 'N/A' ||
                                             cellText === 'n/a' ||
                                             summaryKeywords.some(kw => cellLower.includes(kw)) ||
                                             cellText.length > 60;
                            
                            if (!isSummary && cellText.length < 60 && !cellText.match(/^\d+$/)) {
                                team = cellText;
                            }
                        }
                    }
                    
                    // Only add if we have a valid player name (not summary text)
                    // Player name should be reasonable length and not contain summary keywords
                    if (player && player.length > 0 && player.length < 60) {
                        const playerLower = player.toLowerCase();
                        const isValidPlayer = !summaryKeywords.some(kw => playerLower.includes(kw)) &&
                                           !playerLower.includes(';') &&
                                           !playerLower.includes('total') &&
                                           !playerLower.includes('cards per') &&
                                           !playerLower.includes('packs per') &&
                                           !playerLower.includes('boxes per');
                        
                        if (isValidPlayer) {
                            cards.push({
                                number: number || '',
                                player: player,
                                team: team || '',
                                tcdbId: null, // Not applicable for Checklist Insider
                                url: post.link
                            });
                        }
                    }
                }
            });

            // Strategy 2: If no cards from text parsing, try tables (using contentToParse)
            if (cards.length === 0) {
                contentToParse('table tr').each((index, element) => {
                    const $row = contentToParse(element);
                    const $cells = $row.find('td, th');
                    
                    if ($cells.length >= 2) {
                        const rowText = $row.text().trim().toLowerCase();
                        
                        // Skip header rows
                        if (rowText.includes('card') && 
                            (rowText.includes('player') || rowText.includes('#')) &&
                            (rowText.includes('select') || rowText.includes('team'))) {
                            return;
                        }
                        
                        // Skip summary rows
                        const summaryKeywords = [
                            'cards per pack', 'packs per box', 'boxes per case',
                            'autograph or relic', 'autograph and', 'total cards',
                            'silver pack', 'silver packs', 'cards per', 'per pack', 'per box', 'per case'
                        ];
                        
                        if (summaryKeywords.some(keyword => rowText.includes(keyword))) {
                            return;
                        }
                        
                        let number = '';
                        let player = '';
                        let team = '';
                        
                        const firstCell = $cells.eq(0).text().trim();
                        if (firstCell.match(/^[\d\w]+$/)) {
                            number = firstCell;
                        }
                        
                        for (let i = 1; i < $cells.length; i++) {
                            const cellText = $cells.eq(i).text().trim();
                            if (cellText && !player) {
                                const cellLower = cellText.toLowerCase();
                                const isSummary = summaryKeywords.some(kw => cellLower.includes(kw)) ||
                                                 cellText.includes(';') ||
                                                 cellText.length > 60 ||
                                                 cellLower.includes('total') ||
                                                 cellLower.includes('autograph') ||
                                                 cellLower.includes('relic');
                                
                                if (!isSummary && !cellText.match(/^\d+$/) && cellText.length < 60) {
                                    player = cellText;
                                }
                            } else if (cellText && !team && player) {
                                const cellLower = cellText.toLowerCase();
                                const isSummary = cellText === 'N/A' ||
                                                 cellText === 'n/a' ||
                                                 summaryKeywords.some(kw => cellLower.includes(kw)) ||
                                                 cellText.length > 60;
                                
                                if (!isSummary && cellText.length < 60 && !cellText.match(/^\d+$/)) {
                                    team = cellText;
                                }
                            }
                        }
                        
                        if (player && player.length > 0 && player.length < 60) {
                            const playerLower = player.toLowerCase();
                            const isValidPlayer = !summaryKeywords.some(kw => playerLower.includes(kw)) &&
                                               !playerLower.includes(';') &&
                                               !playerLower.includes('total') &&
                                               !playerLower.includes('cards per') &&
                                               !playerLower.includes('packs per') &&
                                               !playerLower.includes('boxes per');
                            
                            if (isValidPlayer) {
                                cards.push({
                                    number: number || '',
                                    player: player,
                                    team: team || '',
                                    tcdbId: null,
                                    url: post.link
                                });
                            }
                        }
                    }
                });
            }

            // Strategy 3: If still no cards, try lists
            if (cards.length === 0) {
                contentToParse('ul li, ol li').each((index, element) => {
                    const text = $(element).text().trim();
                    // Look for patterns like "#1 Player Name" or "1. Player Name"
                    const match = text.match(/^#?(\d+[\w]*)\s+(.+?)(?:\s+-\s+(.+))?$/);
                    if (match) {
                        cards.push({
                            number: match[1],
                            player: match[2].trim(),
                            team: match[3] ? match[3].trim() : '',
                            tcdbId: null,
                            url: post.link
                        });
                    }
                });
            }

            // Cache for 1 hour
            this.cache.set(cacheKey, cards);

            console.log(`✅ Found ${cards.length} cards in checklist ${postId}`);
            return cards;

        } catch (error) {
            console.error(`❌ Error getting checklist for post ${postId}:`, error.message);
            throw error;
        }
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
    }
}

module.exports = ChecklistInsiderService;

