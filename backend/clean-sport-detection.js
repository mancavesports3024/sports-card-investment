const { SPORT_CONFIG, TEAM_NAMES_FOR_CLEANING, CARD_SETS_FOR_CLEANING } = require('./sport-detection-config');

class CleanSportDetector {
    constructor() {
        this.sportConfig = SPORT_CONFIG;
    }

    /**
     * Detect sport from title using comprehensive approach
     */
    async detectSportFromComprehensive(title, espnDetector, comprehensiveDb) {
        // First try ESPN v2 API for player-based sport detection
        try {
            const summaryTitle = this.cleanSummaryTitle(title);
            const playerName = await this.extractPlayerName(summaryTitle, comprehensiveDb);
            if (playerName) {
                const espnSport = await espnDetector.detectSportFromPlayer(playerName);
                if (espnSport && espnSport !== 'Unknown') {
                    console.log(`✅ ESPN v2 API detected sport for ${playerName}: ${espnSport}`);
                    return espnSport;
                }
            }
        } catch (error) {
            console.log(`⚠️ ESPN v2 API failed for ${title}: ${error.message}`);
        }
        
        // Second try to find a match in the comprehensive database
        if (comprehensiveDb) {
            try {
                const cleanTitle = this.cleanSummaryTitle(title).toLowerCase();
                const query = `
                    SELECT sport, COUNT(*) as matches 
                    FROM sets 
                    WHERE LOWER(searchText) LIKE ? 
                    OR LOWER(displayName) LIKE ?
                    OR LOWER(name) LIKE ?
                    GROUP BY sport 
                    ORDER BY matches DESC 
                    LIMIT 1
                `;
                
                const result = await this.runComprehensiveQuery(comprehensiveDb, query, [`%${cleanTitle}%`, `%${cleanTitle}%`, `%${cleanTitle}%`]);
                
                if (result && result.sport) {
                    return result.sport;
                }
            } catch (error) {
                // Silent error handling
            }
        }
        
        // Fall back to keyword detection
        return this.detectSportFromKeywords(title);
    }

    /**
     * Detect sport using keyword matching
     */
    detectSportFromKeywords(title) {
        const titleLower = title.toLowerCase();
        
        // Check each sport configuration
        for (const [sportKey, config] of Object.entries(this.sportConfig)) {
            if (this.hasSportIndicators(titleLower, config)) {
                return config.sport;
            }
        }
        
        return 'Unknown';
    }

    /**
     * Check if title has indicators for a specific sport
     */
    hasSportIndicators(titleLower, sportConfig) {
        // Check teams
        if (sportConfig.teams && sportConfig.teams.some(team => titleLower.includes(team))) {
            return true;
        }
        
        // Check positions
        if (sportConfig.positions && sportConfig.positions.some(pos => titleLower.includes(pos))) {
            return true;
        }
        
        // Check players
        if (sportConfig.players && sportConfig.players.some(player => titleLower.includes(player))) {
            return true;
        }
        
        // Check tournaments (for golf)
        if (sportConfig.tournaments && sportConfig.tournaments.some(tournament => titleLower.includes(tournament))) {
            return true;
        }
        
        // Check general terms
        if (sportConfig.terms && sportConfig.terms.some(term => titleLower.includes(term))) {
            return true;
        }
        
        return false;
    }

    /**
     * Clean summary title by removing unwanted terms
     */
    cleanSummaryTitle(title) {
        // First, check if the original title has autograph indicators
        const originalTitleLower = title.toLowerCase();
        const hasAutographIndicator = originalTitleLower.includes('autograph') || 
                                     originalTitleLower.includes('autographs') || 
                                     originalTitleLower.includes('auto') ||
                                     originalTitleLower.includes('signed');
        
        // Do the normal cleaning
        let cleanedTitle = title
            // Remove grading terms
            .replace(/PSA\s*\d+/gi, '')
            .replace(/GEM\s*MT/gi, '')
            .replace(/GEM/gi, '')
            .replace(/MINT\s*\d+/gi, '')
            .replace(/MINT/gi, '')
            .replace(/CERT\s*#\d+/gi, '')
            
            // Remove descriptive words
            .replace(/BEAUTIFUL|GORGEOUS|STUNNING|MINT\s*CONDITION|CASE\s*HIT|HOT\s*NUMBERS|ELECTRIC\s*ETCH|VITREOUS|ICE\s*PRIZM|BOMB\s*SQUAD|ON\s*DECK|POP\.\s*\d+|POP\s*\d+/gi, '')
            
            // Remove common card terms
            .replace(/\b(RC|ROOKIE|AUTOGRAPHS|AUTOGRAPH|REFRACTOR|PARALLEL|NUMBERED|SSP|SP|HOF)\b/gi, '')
            .replace(/\bAUTOGRAPHS\b/gi, 'auto')
            .replace(/\bAUTOGRAPH\b/gi, 'auto')
            
            // Remove additional terms
            .replace(/\b(LA|DUKE|CARD|PATS|RATED|INSTER|MVP|BOX\s*SET|MAV|NEW\s*ENGLAND|COLOR\s*MATCH|76ERS|ERS|GRADED|PITCHING|BATTING|RPA|PATCH|DUAL|SWATCH|EDITION|DEBUT)\b/gi, '')
            
            // Preserve important terms
            .replace(/1ST\s+EDITION/gi, '1ST_EDITION')
            
            // Remove sport names
            .replace(/\b(NBA|BASKETBALL|FOOTBALL|BASEBALL|HOCKEY|SOCCER|NFL|MLB|NHL|FIFA)\b/gi, '')
            
            // Remove team names using centralized list
            .replace(new RegExp(`\\b(${TEAM_NAMES_FOR_CLEANING.join('|')})\\b`, 'gi'), '')
            
            // Remove city names
            .replace(/\b(CHICAGO|BOSTON|NEW\s*YORK|LOS\s*ANGELES|MIAMI|DALLAS|HOUSTON|PHOENIX|DENVER|PORTLAND|SACRAMENTO|MINNEAPOLIS|OKLAHOMA\s*CITY|SALT\s*LAKE\s*CITY|MEMPHIS|NEW\s*ORLEANS|SAN\s*ANTONIO|ORLANDO|ATLANTA|CHARLOTTE|WASHINGTON|DETROIT|CLEVELAND|INDIANAPOLIS|MILWAUKEE|PHILADELPHIA|BROOKLYN|TORONTO)\b/gi, '')
            
            // Remove periods and special characters
            .replace(/\./g, '')
            .replace(/[^\w\s\-#\/]/g, '')
            
            // Remove standalone hyphens
            .replace(/(?<!\d)(?<!#\w*)\s*-\s*(?!\d)/g, ' ')
            .replace(/^\s*-\s*/, '')
            .replace(/\s*-\s*$/, '')
            
            // Normalize spaces
            .replace(/\s+/g, ' ')
            
            // Restore protected terms
            .replace(/1ST_EDITION/gi, '1st Edition')
            
            .trim();
        
        // Add back "auto" if needed
        if (hasAutographIndicator && !cleanedTitle.toLowerCase().includes('auto')) {
            const words = cleanedTitle.split(' ');
            let insertIndex = words.length;
            
            for (let i = 0; i < words.length; i++) {
                if (words[i].startsWith('#') || /^\d+$/.test(words[i])) {
                    insertIndex = i;
                    break;
                }
            }
            
            words.splice(insertIndex, 0, 'auto');
            cleanedTitle = words.join(' ');
        }
        
        return cleanedTitle;
    }

    /**
     * Extract player name using main database method
     */
    async extractPlayerName(title, comprehensiveDb) {
        return this.db.extractPlayerName(title);
    }

    /**
     * Helper method to run comprehensive database queries
     */
    async runComprehensiveQuery(db, sql, params = []) {
        return new Promise((resolve, reject) => {
            db.get(sql, params, (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }
}

module.exports = { CleanSportDetector };
