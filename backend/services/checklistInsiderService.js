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
            
            // Strategy 1: Filter by category ID and all subcategories
            try {
                // Try each category ID (parent + subcategories)
                for (const catId of categoryIds) {
                    try {
                        response = await axios.get(`${this.baseUrl}/wp/v2/posts`, {
                            params: {
                                categories: catId,
                                per_page: 100,
                                orderby: 'date',
                                order: 'desc'
                            },
                            timeout: 15000
                        });
                        if (response.data.length > 0) {
                            posts = posts.concat(response.data);
                            console.log(`   📄 Category ${catId}: Found ${response.data.length} posts`);
                        }
                    } catch (e) {
                        // Continue to next category
                    }
                }
                
                // Remove duplicates by post ID
                const uniquePosts = Array.from(new Map(posts.map(p => [p.id, p])).values());
                posts = uniquePosts;
                console.log(`   📄 Strategy 1 (category filter): Total ${posts.length} unique posts`);
            } catch (e) {
                console.log(`   ⚠️ Strategy 1 failed: ${e.message}`);
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
     * @param {string} sportId - Sport category ID
     * @param {number} year - Year
     * @returns {Array} Array of set objects {id, name, slug, link}
     */
    async getSets(sportId, year) {
        try {
            const cacheKey = `sets_${sportId}_${year}`;
            if (this.cache.has(cacheKey)) {
                return this.cache.get(cacheKey);
            }

            const response = await axios.get(`${this.baseUrl}/wp/v2/posts`, {
                params: {
                    categories: sportId,
                    search: year.toString(),
                    per_page: 100,
                    orderby: 'date',
                    order: 'desc'
                },
                timeout: 15000
            });

            const sets = response.data.map(post => ({
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
     * Get checklist for a specific set (post)
     * @param {string} postId - Post ID
     * @returns {Array} Array of card objects {number, player, team}
     */
    async getChecklist(postId) {
        try {
            const cacheKey = `checklist_${postId}`;
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

            // Parse checklist from HTML - look for tables or lists
            // Common patterns: tables with card numbers, player names, teams
            
            // Strategy 1: Look for tables
            $('table tr').each((index, element) => {
                const $row = $(element);
                const $cells = $row.find('td, th');
                
                if ($cells.length >= 2) {
                    // Try to extract card number and player
                    const rowText = $row.text().trim();
                    
                    // Skip header rows
                    if (rowText.toLowerCase().includes('card') && 
                        rowText.toLowerCase().includes('player') && 
                        rowText.toLowerCase().includes('#')) {
                        return; // Skip header
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
                            // Check if it looks like a player name (not a number, not too long)
                            if (!cellText.match(/^\d+$/) && cellText.length < 50) {
                                player = cellText;
                            }
                        } else if (cellText && !team && player) {
                            // Team might be in next cell
                            if (cellText.length < 50 && !cellText.match(/^\d+$/)) {
                                team = cellText;
                            }
                        }
                    }
                    
                    // If we found a card number, add it
                    if (number || player) {
                        cards.push({
                            number: number || '',
                            player: player || '',
                            team: team || '',
                            tcdbId: null, // Not applicable for Checklist Insider
                            url: post.link
                        });
                    }
                }
            });

            // Strategy 2: If no cards from tables, try lists
            if (cards.length === 0) {
                $('ul li, ol li').each((index, element) => {
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

