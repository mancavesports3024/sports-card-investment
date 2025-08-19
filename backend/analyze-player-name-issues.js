const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class PlayerNameIssueAnalyzer {
    constructor() {
        this.dbPath = path.join(__dirname, 'data', 'pricing_database.db');
        this.db = new sqlite3.Database(this.dbPath);
    }

    async analyzePlayerNameIssues() {
        console.log('🔍 Starting automated player name issue analysis...\n');

        try {
            // Get all cards with their extraction data
            const cards = await this.getAllCards();
            console.log(`📊 Analyzing ${cards.length} cards...\n`);

            const issues = {
                cardTermsInPlayerName: [],
                suspiciousPlayerNames: [],
                shortPlayerNames: [],
                allCapsPlayerNames: [],
                numbersInPlayerNames: [],
                potentialCardTypesInPlayerNames: []
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
                'vintage stock', 'independence day', 'fathers day', 'mothers day', 'mummy',
                'yellow crackle', 'memorial day', 'black cat', 'clear', 'witches hat', 'bats',
                'first card', 'platinum', 'printing plates', 'royal', 'blue', 'vintage', 'stock',
                'independence', 'day', 'fathers', 'mothers', 'memorial', 'cat', 'witches', 'hat',
                'lantern', 'crackle', 'holo', 'foilboard', 'radiating', 'now', 'foil'
            ];

            // Potential card type terms that might be in player names
            const potentialCardTypes = [
                'ice', 'lazer', 'lightboard', 'magenta', 'mt', 'shock', 'cosmic', 'planetary',
                'pursuit', 'eris', 'autos', 'sapphire', 'woo', 'draft', 'tf1', 'invicta',
                'all-etch', 'night', 'stars', 'splash', 'rising', 'best', 'genesis', 'fast break',
                'zoom', 'flashback', 'emergent', 'mania', 'geometric', 'honeycomb', 'pride',
                'kaleidoscopic', 'downtown', 'real one', 'clear cut', 'variation', 'logo',
                'pulsar', 'snakeskin', 'dragon scale'
            ];

            for (const card of cards) {
                if (!card.player_name) continue;

                const playerName = card.player_name.toLowerCase();
                const originalTitle = card.original_title.toLowerCase();

                // Check for card terms in player names
                for (const term of cardTerms) {
                    if (playerName.includes(term.toLowerCase()) && !this.isValidPlayerNamePart(term, playerName)) {
                        issues.cardTermsInPlayerName.push({
                            card: card,
                            term: term,
                            playerName: card.player_name,
                            originalTitle: card.original_title
                        });
                        break; // Only report once per card
                    }
                }

                // Check for potential card types in player names
                for (const term of potentialCardTypes) {
                    if (playerName.includes(term.toLowerCase()) && !this.isValidPlayerNamePart(term, playerName)) {
                        issues.potentialCardTypesInPlayerNames.push({
                            card: card,
                            term: term,
                            playerName: card.player_name,
                            originalTitle: card.original_title
                        });
                        break;
                    }
                }

                // Check for suspicious patterns
                if (this.isSuspiciousPlayerName(card.player_name)) {
                    issues.suspiciousPlayerNames.push({
                        card: card,
                        playerName: card.player_name,
                        originalTitle: card.original_title,
                        reason: this.getSuspiciousReason(card.player_name)
                    });
                }

                // Check for very short player names (likely incomplete)
                if (card.player_name.length <= 3 && card.player_name.length > 0) {
                    issues.shortPlayerNames.push({
                        card: card,
                        playerName: card.player_name,
                        originalTitle: card.original_title
                    });
                }

                // Check for all caps player names
                if (card.player_name === card.player_name.toUpperCase() && card.player_name.length > 0) {
                    issues.allCapsPlayerNames.push({
                        card: card,
                        playerName: card.player_name,
                        originalTitle: card.original_title
                    });
                }

                // Check for numbers in player names
                if (/\d/.test(card.player_name)) {
                    issues.numbersInPlayerNames.push({
                        card: card,
                        playerName: card.player_name,
                        originalTitle: card.original_title
                    });
                }
            }

            // Generate report
            this.generateReport(issues);

        } catch (error) {
            console.error('❌ Error analyzing player name issues:', error);
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
                    summary_title,
                    year,
                    card_number,
                    print_run,
                    is_rookie,
                    is_autograph
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

    isValidPlayerNamePart(term, playerName) {
        // Some terms might be valid parts of player names
        const validTerms = ['king', 'dallas', 'storm', 'zone', 'sunday', 'pop', 'rainbow'];
        return validTerms.includes(term.toLowerCase());
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

    generateReport(issues) {
        console.log('📋 PLAYER NAME EXTRACTION ISSUES REPORT\n');
        console.log('=' .repeat(80));

        // Card terms in player names
        if (issues.cardTermsInPlayerName.length > 0) {
            console.log(`\n🚨 CARD TERMS IN PLAYER NAMES (${issues.cardTermsInPlayerName.length} issues):`);
            console.log('-'.repeat(50));
            const termCounts = {};
            issues.cardTermsInPlayerName.forEach(issue => {
                termCounts[issue.term] = (termCounts[issue.term] || 0) + 1;
            });
            
            Object.entries(termCounts)
                .sort(([,a], [,b]) => b - a)
                .forEach(([term, count]) => {
                    console.log(`${term}: ${count} occurrences`);
                });

            console.log('\n📝 Sample issues:');
            issues.cardTermsInPlayerName.slice(0, 10).forEach(issue => {
                console.log(`  • "${issue.term}" in "${issue.playerName}" from "${issue.originalTitle}"`);
            });
        }

        // Potential card types in player names
        if (issues.potentialCardTypesInPlayerNames.length > 0) {
            console.log(`\n⚠️  POTENTIAL CARD TYPES IN PLAYER NAMES (${issues.potentialCardTypesInPlayerNames.length} issues):`);
            console.log('-'.repeat(50));
            const termCounts = {};
            issues.potentialCardTypesInPlayerNames.forEach(issue => {
                termCounts[issue.term] = (termCounts[issue.term] || 0) + 1;
            });
            
            Object.entries(termCounts)
                .sort(([,a], [,b]) => b - a)
                .forEach(([term, count]) => {
                    console.log(`${term}: ${count} occurrences`);
                });
        }

        // Suspicious player names
        if (issues.suspiciousPlayerNames.length > 0) {
            console.log(`\n🤔 SUSPICIOUS PLAYER NAMES (${issues.suspiciousPlayerNames.length} issues):`);
            console.log('-'.repeat(50));
            issues.suspiciousPlayerNames.slice(0, 15).forEach(issue => {
                console.log(`  • "${issue.playerName}" (${issue.reason}) from "${issue.originalTitle}"`);
            });
        }

        // Short player names
        if (issues.shortPlayerNames.length > 0) {
            console.log(`\n📏 SHORT PLAYER NAMES (${issues.shortPlayerNames.length} issues):`);
            console.log('-'.repeat(50));
            issues.shortPlayerNames.slice(0, 10).forEach(issue => {
                console.log(`  • "${issue.playerName}" from "${issue.originalTitle}"`);
            });
        }

        // All caps player names
        if (issues.allCapsPlayerNames.length > 0) {
            console.log(`\n🔠 ALL CAPS PLAYER NAMES (${issues.allCapsPlayerNames.length} issues):`);
            console.log('-'.repeat(50));
            issues.allCapsPlayerNames.slice(0, 10).forEach(issue => {
                console.log(`  • "${issue.playerName}" from "${issue.originalTitle}"`);
            });
        }

        // Numbers in player names
        if (issues.numbersInPlayerNames.length > 0) {
            console.log(`\n🔢 NUMBERS IN PLAYER NAMES (${issues.numbersInPlayerNames.length} issues):`);
            console.log('-'.repeat(50));
            issues.numbersInPlayerNames.slice(0, 10).forEach(issue => {
                console.log(`  • "${issue.playerName}" from "${issue.originalTitle}"`);
            });
        }

        // Summary
        const totalIssues = Object.values(issues).reduce((sum, arr) => sum + arr.length, 0);
        console.log('\n' + '='.repeat(80));
        console.log(`📊 SUMMARY: ${totalIssues} total potential issues found`);
        console.log('='.repeat(80));

        // Recommendations
        console.log('\n💡 RECOMMENDATIONS:');
        console.log('1. Add frequently occurring card terms to the filtering lists');
        console.log('2. Review suspicious player names for extraction logic improvements');
        console.log('3. Check short player names for incomplete extraction');
        console.log('4. Investigate all caps player names for case sensitivity issues');
        console.log('5. Remove numbers from player names if they are card-related');
    }
}

// Export the class for use in other files
module.exports = { PlayerNameIssueAnalyzer };

// Run the analysis if this file is executed directly
if (require.main === module) {
    const analyzer = new PlayerNameIssueAnalyzer();
    analyzer.analyzePlayerNameIssues().catch(console.error);
}
