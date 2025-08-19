const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class PlayerNameIssueAnalyzerSimple {
    constructor() {
        this.dbPath = path.join(__dirname, 'data', 'pricing_database.db');
        this.db = new sqlite3.Database(this.dbPath);
    }

    async analyzePlayerNameIssues() {
        try {
            // Get all cards with their extraction data
            const cards = await this.getAllCards();
            console.log(`📊 Analyzing ${cards.length} cards...`);

            const issues = {
                cardTermsInPlayerName: [],
                suspiciousPlayerNames: [],
                shortPlayerNames: [],
                allCapsPlayerNames: [],
                numbersInPlayerNames: []
            };

            // Common card-related terms that shouldn't be in player names
            const cardTerms = [
                'autograph', 'autographs', 'auto', 'rookie', 'rookies', 'rc', 'yg', 'young guns',
                'parallel', 'insert', 'base', 'sp', 'ssp', 'short print', 'super short print',
                'refractor', 'x-fractor', 'cracked ice', 'stained glass', 'die-cut', 'die cut',
                'holo', 'holographic', 'prizm', 'chrome', 'wave', 'velocity', 'scope', 'hyper',
                'optic', 'mosaic', 'select', 'finest', 'bowman', 'topps', 'panini', 'donruss',
                'gold', 'silver', 'black', 'red', 'blue', 'green', 'yellow', 'orange', 'purple',
                'pink', 'bronze', 'white', 'teal', 'neon', 'camo', 'tie-dye', 'disco',
                'sublime', 'shimmer', 'scripts', 'ref', 'reptilian', 'storm', 'zone', 'sunday',
                'pop', 'chasers', 'busters', 'reactive', 'reprint', 'king', 'dallas', 'snake',
                'rainbow', 'go hard go', 'go hard go home', 'home', 'royal blue', 'gold rainbow',
                'holiday', 'yellow', 'aqua', 'silver crackle', 'yellow rainbow', 'jack o lantern',
                'ghost', 'blue holo', 'purple holo', 'green crackle', 'orange crackle', 'red crackle',
                'vintage stock', 'independence day', 'black', 'fathers day', 'mothers day', 'mummy',
                'yellow crackle', 'memorial day', 'black cat', 'clear', 'witches hat', 'bats',
                'first card', 'platinum', 'printing plates', 'royal', 'blue', 'vintage', 'stock',
                'independence', 'day', 'fathers', 'mothers', 'memorial', 'cat', 'witches', 'hat',
                'lantern', 'crackle', 'holo', 'foilboard', 'radiating', 'now', 'foil'
            ];

            for (const card of cards) {
                if (!card.player_name) continue;

                const playerName = card.player_name.toLowerCase();

                // Check for card terms in player names
                for (const term of cardTerms) {
                    if (playerName.includes(term.toLowerCase())) {
                        issues.cardTermsInPlayerName.push({
                            term: term,
                            playerName: card.player_name,
                            originalTitle: card.original_title
                        });
                        break; // Only report once per card
                    }
                }

                // Check for suspicious patterns
                if (this.isSuspiciousPlayerName(card.player_name)) {
                    issues.suspiciousPlayerNames.push({
                        playerName: card.player_name,
                        originalTitle: card.original_title,
                        reason: this.getSuspiciousReason(card.player_name)
                    });
                }

                // Check for very short player names (likely incomplete)
                if (card.player_name.length <= 3 && card.player_name.length > 0) {
                    issues.shortPlayerNames.push({
                        playerName: card.player_name,
                        originalTitle: card.original_title
                    });
                }

                // Check for all caps player names
                if (card.player_name === card.player_name.toUpperCase() && card.player_name.length > 0) {
                    issues.allCapsPlayerNames.push({
                        playerName: card.player_name,
                        originalTitle: card.original_title
                    });
                }

                // Check for numbers in player names
                if (/\d/.test(card.player_name)) {
                    issues.numbersInPlayerNames.push({
                        playerName: card.player_name,
                        originalTitle: card.original_title
                    });
                }
            }

            // Generate summary
            const summary = {
                totalCards: cards.length,
                cardTermsInPlayerName: {
                    count: issues.cardTermsInPlayerName.length,
                    termCounts: this.getTermCounts(issues.cardTermsInPlayerName, 'term'),
                    sample: issues.cardTermsInPlayerName.slice(0, 10)
                },
                suspiciousPlayerNames: {
                    count: issues.suspiciousPlayerNames.length,
                    sample: issues.suspiciousPlayerNames.slice(0, 10)
                },
                shortPlayerNames: {
                    count: issues.shortPlayerNames.length,
                    sample: issues.shortPlayerNames.slice(0, 10)
                },
                allCapsPlayerNames: {
                    count: issues.allCapsPlayerNames.length,
                    sample: issues.allCapsPlayerNames.slice(0, 10)
                },
                numbersInPlayerNames: {
                    count: issues.numbersInPlayerNames.length,
                    sample: issues.numbersInPlayerNames.slice(0, 10)
                }
            };

            return summary;

        } catch (error) {
            console.error('❌ Error analyzing player name issues:', error);
            throw error;
        } finally {
            this.db.close();
        }
    }

    async getAllCards() {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT 
                    original_title,
                    player_name,
                    card_set,
                    card_type,
                    summary_title
                FROM cards 
                WHERE player_name IS NOT NULL 
                ORDER BY original_title
            `;
            
            this.db.all(query, [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    isSuspiciousPlayerName(playerName) {
        if (!playerName) return false;
        
        // Check for patterns that suggest extraction issues
        const suspiciousPatterns = [
            /^[A-Z\s]+$/, // All caps with spaces
            /\b[A-Z]{2,}\b/, // Standalone ALL CAPS words
            /\d+/, // Contains numbers
            /^[A-Z]\.?\s*[A-Z]\.?\s*$/, // Just initials
            /\b[A-Z]{1,2}\b/, // Single or double letter words
            /[^\w\s]/, // Contains special characters
            /\b(autograph|rookie|parallel|insert|base|sp|ssp|refractor|prizm|chrome)\b/i
        ];

        return suspiciousPatterns.some(pattern => pattern.test(playerName));
    }

    getSuspiciousReason(playerName) {
        if (/^[A-Z\s]+$/.test(playerName)) return "All caps with spaces";
        if (/\b[A-Z]{2,}\b/.test(playerName)) return "Contains ALL CAPS words";
        if (/\d+/.test(playerName)) return "Contains numbers";
        if (/^[A-Z]\.?\s*[A-Z]\.?\s*$/.test(playerName)) return "Just initials";
        if (/\b[A-Z]{1,2}\b/.test(playerName)) return "Contains single/double letter words";
        if (/[^\w\s]/.test(playerName)) return "Contains special characters";
        if (/\b(autograph|rookie|parallel|insert|base|sp|ssp|refractor|prizm|chrome)\b/i.test(playerName)) return "Contains card terms";
        return "Unknown suspicious pattern";
    }

    getTermCounts(issues, field) {
        const counts = {};
        issues.forEach(issue => {
            const value = issue[field];
            counts[value] = (counts[value] || 0) + 1;
        });
        return Object.entries(counts)
            .sort(([,a], [,b]) => b - a)
            .reduce((obj, [key, value]) => {
                obj[key] = value;
                return obj;
            }, {});
    }
}

// Export the class for use in other files
module.exports = { PlayerNameIssueAnalyzerSimple };

// Run the analysis if this file is executed directly
if (require.main === module) {
    const analyzer = new PlayerNameIssueAnalyzerSimple();
    analyzer.analyzePlayerNameIssues()
        .then(summary => {
            console.log(JSON.stringify(summary, null, 2));
        })
        .catch(console.error);
}
