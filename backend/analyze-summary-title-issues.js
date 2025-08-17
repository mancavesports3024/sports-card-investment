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
            this.db = new sqlite3.Database(this.dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
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

    async analyzeSummaryTitleIssues() {
        console.log('🔍 Starting comprehensive summary title analysis...\n');
        
        try {
            // Get all cards
            const cards = await this.runQuery(`
                SELECT id, title, summary_title, year, card_set, player_name, card_type, card_number, print_run
                FROM cards 
                ORDER BY created_at DESC
            `);
            
            console.log(`📊 Analyzing ${cards.length} cards...\n`);
            
            this.totalCardsAnalyzed = cards.length;

            const issues = {
                missingCardSets: [],
                missingCardTypes: [],
                missingCardNumbers: [],
                teamNamesInTitles: [],
                genericColorIssues: [],
                otherIssues: []
            };

            for (const card of cards) {
                const cardIssues = this.analyzeCard(card);
                
                // Categorize issues
                if (cardIssues.missingCardSet) {
                    issues.missingCardSets.push({
                        id: card.id,
                        title: card.title,
                        summaryTitle: card.summary_title,
                        missingSet: cardIssues.missingCardSet
                    });
                }
                
                if (cardIssues.missingCardType) {
                    issues.missingCardTypes.push({
                        id: card.id,
                        title: card.title,
                        summaryTitle: card.summary_title,
                        missingType: cardIssues.missingCardType
                    });
                }
                
                if (cardIssues.missingCardNumber) {
                    issues.missingCardNumbers.push({
                        id: card.id,
                        title: card.title,
                        summaryTitle: card.summary_title,
                        missingNumber: cardIssues.missingCardNumber
                    });
                }
                
                if (cardIssues.teamNameInTitle) {
                    issues.teamNamesInTitles.push({
                        id: card.id,
                        title: card.title,
                        summaryTitle: card.summary_title,
                        teamName: cardIssues.teamNameInTitle
                    });
                }
                
                if (cardIssues.genericColor) {
                    issues.genericColorIssues.push({
                        id: card.id,
                        title: card.title,
                        summaryTitle: card.summary_title,
                        genericColor: cardIssues.genericColor
                    });
                }
                
                if (cardIssues.otherIssues.length > 0) {
                    issues.otherIssues.push({
                        id: card.id,
                        title: card.title,
                        summaryTitle: card.summary_title,
                        issues: cardIssues.otherIssues
                    });
                }
            }

            // Generate report
            this.generateReport(issues);

        } catch (error) {
            console.error('❌ Error during analysis:', error);
            throw error;
        }
    }

    analyzeCard(card) {
        const issues = {
            missingCardSet: null,
            missingCardType: null,
            missingCardNumber: null,
            teamNameInTitle: null,
            genericColor: null,
            otherIssues: []
        };

        const titleLower = card.title.toLowerCase();
        const summaryLower = card.summary_title.toLowerCase();

        // Check for missing card sets
        const expectedSets = this.extractExpectedCardSets(titleLower);
        if (expectedSets.length > 0 && !card.card_set) {
            issues.missingCardSet = expectedSets.join(', ');
        }

        // Check for missing card types
        const expectedTypes = this.extractExpectedCardTypes(titleLower);
        if (expectedTypes.length > 0 && !card.card_type) {
            issues.missingCardType = expectedTypes.join(', ');
        }

        // Check for missing card numbers
        const expectedNumbers = this.extractExpectedCardNumbers(card.title);
        if (expectedNumbers.length > 0 && !card.card_number) {
            issues.missingCardNumber = expectedNumbers.join(', ');
        }

        // Check for team names in summary titles
        const teamNames = ['chiefs', 'vikings', 'cardinals', 'eagles', 'falcons', 'ravens', 'bills', 'panthers', 'bears', 'bengals', 'browns', 'cowboys', 'broncos', 'lions', 'packers', 'texans', 'colts', 'jaguars', 'raiders', 'chargers', 'rams', 'dolphins', 'patriots', 'saints', 'giants', 'jets', 'steelers', '49ers', 'seahawks', 'buccaneers', 'titans', 'commanders'];
        for (const team of teamNames) {
            if (summaryLower.includes(team)) {
                issues.teamNameInTitle = team;
                break;
            }
        }

        // Check for generic "Color" instead of specific colors
        if (summaryLower.includes('color prizm') || summaryLower.includes('color refractor')) {
            issues.genericColor = 'Color';
        }

        // Check for other common issues
        if (summaryLower.includes('yg') || summaryLower.includes('rc') || summaryLower.includes('rookie')) {
            issues.otherIssues.push('Unwanted terms (YG, RC, Rookie) in summary title');
        }

        if (summaryLower.includes('psa') || summaryLower.includes('gem') || summaryLower.includes('mint')) {
            issues.otherIssues.push('Grading terms in summary title');
        }

        return issues;
    }

    extractExpectedCardSets(title) {
        const sets = [];
        
        if (title.includes('topps') && !title.includes('bowman')) {
            sets.push('Topps');
        }
        if (title.includes('panini instant')) {
            sets.push('Panini Instant');
        }
        if (title.includes('panini select')) {
            sets.push('Panini Select');
        }
        if (title.includes('panini prizm')) {
            sets.push('Panini Prizm');
        }
        if (title.includes('bowman')) {
            sets.push('Bowman');
        }
        if (title.includes('flawless')) {
            sets.push('Flawless');
        }
        if (title.includes('skybox')) {
            sets.push('Skybox');
        }
        
        return sets;
    }

    extractExpectedCardTypes(title) {
        const types = [];
        
        if (title.includes('red prizm') || title.includes('gold prizm') || title.includes('silver prizm')) {
            types.push('Color Prizm');
        }
        if (title.includes('neon green pulsar')) {
            types.push('Neon Green Pulsar');
        }
        if (title.includes('bomb squad')) {
            types.push('Bomb Squad');
        }
        if (title.includes('rapture')) {
            types.push('Rapture');
        }
        if (title.includes('refractor')) {
            types.push('Refractor');
        }
        
        return types;
    }

    extractExpectedCardNumbers(title) {
        const numbers = [];
        
        // Look for various card number patterns
        const patterns = [
            /#(\d+)/g,
            /#([A-Za-z]+[-\dA-Za-z]+)/g,
            /\b(BD[A-Z]?\d+)\b/g,
            /\b(BS\d+)\b/g,
            /\b([A-Z]{2,}\d+)\b/g
        ];
        
        for (const pattern of patterns) {
            const matches = title.match(pattern);
            if (matches) {
                numbers.push(...matches);
            }
        }
        
        return numbers;
    }

    generateReport(issues) {
        console.log('📋 SUMMARY TITLE ANALYSIS REPORT');
        console.log('================================\n');

        console.log(`🔍 Missing Card Sets: ${issues.missingCardSets.length} cards`);
        if (issues.missingCardSets.length > 0) {
            console.log('   Examples:');
            issues.missingCardSets.slice(0, 5).forEach(issue => {
                console.log(`   - ID ${issue.id}: "${issue.title}" → Missing: ${issue.missingSet}`);
            });
        }

        console.log(`\n🎨 Missing Card Types: ${issues.missingCardTypes.length} cards`);
        if (issues.missingCardTypes.length > 0) {
            console.log('   Examples:');
            issues.missingCardTypes.slice(0, 5).forEach(issue => {
                console.log(`   - ID ${issue.id}: "${issue.title}" → Missing: ${issue.missingType}`);
            });
        }

        console.log(`\n🔢 Missing Card Numbers: ${issues.missingCardNumbers.length} cards`);
        if (issues.missingCardNumbers.length > 0) {
            console.log('   Examples:');
            issues.missingCardNumbers.slice(0, 5).forEach(issue => {
                console.log(`   - ID ${issue.id}: "${issue.title}" → Missing: ${issue.missingNumber}`);
            });
        }

        console.log(`\n🏈 Team Names in Titles: ${issues.teamNamesInTitles.length} cards`);
        if (issues.teamNamesInTitles.length > 0) {
            console.log('   Examples:');
            issues.teamNamesInTitles.slice(0, 5).forEach(issue => {
                console.log(`   - ID ${issue.id}: "${issue.title}" → Team: ${issue.teamName}`);
            });
        }

        console.log(`\n🎨 Generic Color Issues: ${issues.genericColorIssues.length} cards`);
        if (issues.genericColorIssues.length > 0) {
            console.log('   Examples:');
            issues.genericColorIssues.slice(0, 5).forEach(issue => {
                console.log(`   - ID ${issue.id}: "${issue.title}" → Issue: ${issue.genericColor}`);
            });
        }

        console.log(`\n⚠️  Other Issues: ${issues.otherIssues.length} cards`);
        if (issues.otherIssues.length > 0) {
            console.log('   Examples:');
            issues.otherIssues.slice(0, 5).forEach(issue => {
                console.log(`   - ID ${issue.id}: "${issue.title}" → Issues: ${issue.issues.join(', ')}`);
            });
        }

        console.log('\n📊 SUMMARY:');
        const totalCardsWithIssues = new Set([...issues.missingCardSets.map(i => i.id), ...issues.missingCardTypes.map(i => i.id), ...issues.missingCardNumbers.map(i => i.id), ...issues.teamNamesInTitles.map(i => i.id), ...issues.genericColorIssues.map(i => i.id), ...issues.otherIssues.map(i => i.id)]).size;
        console.log(`   Total cards analyzed: ${this.totalCardsAnalyzed || 'Unknown'}`);
        console.log(`   Cards with issues: ${totalCardsWithIssues}`);
        console.log(`   Cards without issues: ${(this.totalCardsAnalyzed || 0) - totalCardsWithIssues}`);
    }

    async close() {
        if (this.db) {
            this.db.close();
            console.log('✅ Database connection closed');
        }
    }
}

// Add to Express routes
function addAnalyzeSummaryTitleIssuesRoute(app) {
    app.post('/api/admin/analyze-summary-title-issues', async (req, res) => {
        try {
            console.log('🔍 Analyze summary title issues endpoint called');
            
            const analyzer = new SummaryTitleAnalyzer();
            await analyzer.connect();
            await analyzer.analyzeSummaryTitleIssues();
            await analyzer.close();

            res.json({
                success: true,
                message: 'Summary title analysis completed successfully',
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('❌ Error in analyze summary title issues endpoint:', error);
            res.status(500).json({
                success: false,
                message: 'Error analyzing summary title issues',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    });
}

module.exports = { SummaryTitleAnalyzer, addAnalyzeSummaryTitleIssuesRoute };
