const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class SummaryTitleAnalyzer {
    constructor() {
        this.dbPath = process.env.RAILWAY_VOLUME_MOUNT_PATH 
            ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'new-scorecard.db')
            : path.join(__dirname, 'data', 'new-scorecard.db');
        this.db = null;
    }

    async connect() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, sqlite3.OPEN_READWRITE, (err) => {
                if (err) {
                    console.error('❌ Error connecting to database:', err);
                    reject(err);
                } else {
                    console.log('✅ Connected to database');
                    resolve();
                }
            });
        });
    }

    async runQuery(query, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(query, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    // Known card types that should not be in player names
    getKnownCardTypes() {
        return [
            // Panini Select parallels
            'flash', 'velocity', 'scope', 'hyper', 'optic', 'mosaic', 'select', 'finest',
            'wave', 'cosmic', 'planetary', 'pursuit', 'eris', 'autos', 'aqua', 'sapphire',
            'woo', 'draft', 'red/white/blue', 'tf1', 'invicta', 'all-etch', 'night',
            
            // Color parallels
            'gold', 'silver', 'black', 'red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink',
            'bronze', 'white', 'teal', 'neon', 'camo', 'tie-dye', 'disco', 'dragon scale',
            'snakeskin', 'pulsar', 'logo', 'variation', 'clear cut', 'real one', 'downtown',
            'genesis', 'fast break', 'zoom', 'flashback', 'emergent', 'mania', 'geometric',
            'honeycomb', 'pride', 'kaleidoscopic', 'vintage', 'splash', 'rising', 'best',
            
            // Card features
            'refractor', 'x-fractor', 'cracked ice', 'stained glass', 'die-cut', 'die cut',
            'holo', 'holographic', 'chrome', 'prizm', 'parallel', 'insert', 'base', 'sp', 'ssp',
            'short print', 'super short print', 'numbered', 'limited', 'rookie', 'rc', 'auto',
            'autograph', 'jersey', 'patch', 'relic', 'memorabilia', 'hof', 'mvp',
            
            // Card sets/brands
            'fifa', 'topps', 'panini', 'donruss', 'bowman', 'upper deck', 'fleer', 'score',
            'heritage', 'stadium club', 'allen ginter', 'gypsy queen', 'finest', 'fire',
            'opening day', 'big league', 'immaculate', 'national treasures', 'flawless',
            'obsidian', 'chronicles', 'contenders', 'international', 'victory', 'crown',
            'portrait', 'police', 'instant', 'impact', 'update', 'field level', 'courtside',
            'elephant', 'disco', 'ice', 'lazer', 'shock', 'wave', 'cosmic', 'planetary',
            'pursuit', 'eris', 'autos', 'aqua', 'sapphire', 'woo', 'draft', 'red/white/blue',
            'tf1', 'invicta', 'all-etch', 'night', 'cosmic stars', 'cosmic', 'all etch',
            
            // Additional terms
            'university', 'draft', 'stars', 'rookie card', '1st', 'first', 'prospect', 'debut',
            'on card', 'sticker', 'base', 'holo', 'ssp', 'short print', 'super short print',
            'parallel', 'insert', 'base', 'holo', 'holographic', 'chrome', 'prizm',
            'refractor', 'x-fractor', 'cracked ice', 'stained glass', 'die-cut', 'die cut',
            'wave', 'velocity', 'scope', 'hyper', 'optic', 'mosaic', 'select', 'finest',
            'bowman', 'topps', 'panini', 'donruss', 'optic', 'mosaic', 'select', 'finest',
            'baseball', 'football', 'basketball', 'hockey', 'soccer', 'golf', 'racing',
            'rookie card', 'university', 'draft', 'stars', 'cosmic', 'invicta', 'all-etch',
            'independence day', 'father\'s day', 'mother\'s day', 'memorial day',
            'mvp', 'hof', 'nfl', 'mlb', 'nba', 'nhl', 'debut', 'card', 'rated', 'chrome', 'university'
        ];
    }

    // Analyze a card for issues (focus checks strictly on player_name and true duplicates)
    analyzeSummaryTitle(card) {
        const { summary_title: summaryTitle, player_name: playerName, card_set: cardSet, card_type: cardType } = card;
        const issues = [];
        const cardTypes = this.getKnownCardTypes();
        
        if (!summaryTitle) return issues;
        
        // 1) Card-type terms inside player_name only (avoid false positives from other parts of the title)
        if (playerName && playerName.trim()) {
            const playerWords = playerName.toLowerCase().split(/\s+/).map(w => w.replace(/[^\w]/g, ''));
            playerWords.forEach((w, idx) => {
                if (w && cardTypes.includes(w)) {
                    issues.push({
                        type: 'card_type_in_player_name',
                        word: w,
                        position: idx,
                        context: playerName,
                        suggestion: `Remove "${w}" from player name`
                    });
                }
            });
        }
        
        // 2) True duplicate brand/type: e.g., card_set has Prizm and card_type also contains Prizm
        if (cardSet && cardType) {
            const setLower = String(cardSet).toLowerCase();
            const typeLower = String(cardType).toLowerCase();
            if (/\bprizm\b/.test(setLower) && /\bprizm\b/.test(typeLower)) {
                issues.push({
                    type: 'duplicate_card_type',
                    word: 'prizm',
                    count: 2,
                    suggestion: 'Remove duplicate "Prizm" (present in both card set and card type)'
                });
            }
            if (/\boptic\b/.test(setLower) && /\boptic\b/.test(typeLower)) {
                issues.push({
                    type: 'duplicate_card_type',
                    word: 'optic',
                    count: 2,
                    suggestion: 'Remove duplicate "Optic" (present in both card set and card type)'
                });
            }
            if (/\bchrome\b/.test(setLower) && /\bchrome\b/.test(typeLower)) {
                issues.push({
                    type: 'duplicate_card_type',
                    word: 'chrome',
                    count: 2,
                    suggestion: 'Remove duplicate "Chrome" (present in both card set and card type)'
                });
            }
        }
        
        // 3) Team/school names inside player_name only
        const teamSchoolNames = [
            'duke', 'mavericks', 'blue devils', 'tar heels', 'wolfpack', 'demon deacons',
            'seminoles', 'hurricanes', 'gators', 'bulldogs', 'tigers', 'wildcats', 'cardinals',
            'eagles', 'hawks', 'panthers', 'cavaliers', 'hokies', 'orange', 'syracuse',
            'connecticut', 'uconn', 'villanova', 'georgetown', 'providence', 'seton hall',
            'creighton', 'xavier', 'butler', 'depaul', 'marquette', 'st johns', 'kansas',
            'kentucky', 'north carolina', 'arizona', 'ucla', 'usc', 'stanford', 'california',
            'oregon', 'oregon state', 'washington', 'washington state', 'colorado', 'utah',
            'arizona state', 'liverpool', 'manchester united', 'manchester city', 'arsenal', 'chelsea',
            'tottenham', 'barcelona', 'real madrid', 'bayern munich', 'psg', 'juventus',
            'ac milan', 'inter milan', 'ajax', 'porto', 'benfica', 'celtic', 'rangers',
            'fc', 'united', 'city', 'athletic', 'sporting', 'dynamo', 'spartak', 'zenit'
        ];
        if (playerName && playerName.trim()) {
            const pn = playerName.toLowerCase();
            teamSchoolNames.forEach(name => {
                const regex = new RegExp(`(^|\\s)${name}(\\s|$)`, 'i');
                if (regex.test(pn)) {
                    issues.push({
                        type: 'team_school_name',
                        word: name,
                        suggestion: `Remove team/school name "${name}" from player name`
                    });
                }
            });
        }
        
        return issues;
    }

    async analyzeAllSummaryTitles() {
        console.log('🔍 Analyzing all summary titles for issues...\n');
        
        try {
            const cards = await this.runQuery(`
                SELECT id, title, summary_title, sport, player_name, card_set, card_type
                FROM cards 
                WHERE summary_title IS NOT NULL AND summary_title != ''
                ORDER BY id DESC
            `);
            
            console.log(`📊 Found ${cards.length} cards with summary titles to analyze\n`);
            
            const allIssues = [];
            const issueTypes = {};
            
            for (const card of cards) {
                const issues = this.analyzeSummaryTitle(card);
                
                if (issues.length > 0) {
                    allIssues.push({
                        id: card.id,
                        title: card.title,
                        summaryTitle: card.summary_title,
                        sport: card.sport,
                        issues: issues
                    });
                    
                    // Count issue types
                    issues.forEach(issue => {
                        issueTypes[issue.type] = (issueTypes[issue.type] || 0) + 1;
                    });
                }
            }
            
            // Display results
            console.log('🎯 SUMMARY TITLE ISSUES FOUND:');
            console.log('================================\n');
            
            console.log('📊 Issue Type Summary:');
            Object.entries(issueTypes).forEach(([type, count]) => {
                console.log(`   ${type}: ${count} issues`);
            });
            
            console.log(`\n📋 Total cards with issues: ${allIssues.length}`);
            console.log(`📋 Total issues found: ${allIssues.reduce((sum, card) => sum + card.issues.length, 0)}\n`);
            
            console.log('🔍 DETAILED ISSUES:');
            console.log('==================\n');
            
            allIssues.forEach(card => {
                console.log(`Card ID: ${card.id}`);
                console.log(`Original Title: "${card.title}"`);
                console.log(`Summary Title: "${card.summaryTitle}"`);
                console.log(`Sport: ${card.sport}`);
                console.log('Issues:');
                
                card.issues.forEach(issue => {
                    console.log(`   ❌ ${issue.type}: ${issue.suggestion}`);
                    if (issue.context) {
                        console.log(`      Context: "${issue.context}"`);
                    }
                });
                console.log('');
            });
            
            // Save detailed report to file
            const report = {
                summary: {
                    totalCards: cards.length,
                    cardsWithIssues: allIssues.length,
                    totalIssues: allIssues.reduce((sum, card) => sum + card.issues.length, 0),
                    issueTypes: issueTypes
                },
                details: allIssues
            };
            
            console.log('💾 Detailed report saved to summary-title-issues-report.json');
            
            return report;
            
        } catch (error) {
            console.error('❌ Error analyzing summary titles:', error);
            throw error;
        }
    }

    async close() {
        if (this.db) {
            this.db.close();
            console.log('✅ Database connection closed');
        }
    }
}

// Main execution
async function main() {
    const analyzer = new SummaryTitleAnalyzer();
    
    try {
        await analyzer.connect();
        const report = await analyzer.analyzeAllSummaryTitles();
        
        console.log('\n🎉 Analysis complete!');
        
    } catch (error) {
        console.error('❌ Analysis failed:', error);
        process.exit(1);
    } finally {
        await analyzer.close();
    }
}

// Export for use in other files
module.exports = { SummaryTitleAnalyzer };

// Run if called directly
if (require.main === module) {
    main();
}
