const NewPricingDatabase = require('./create-new-pricing-database.js');

class MissingTermsExtractor {
    constructor() {
        this.db = new NewPricingDatabase();
    }

    async connect() {
        await this.db.connect();
    }

    async extractMissingTerms() {
        console.log('🔍 Extracting missing terms from analysis report...\n');
        
        try {
            // Get all cards with issues
            const cards = await this.db.allQuery(`
                SELECT id, title, summary_title, player_name, card_type
                FROM cards 
                ORDER BY id
            `);

            const missingTerms = {
                cardTypes: new Set(),
                cardSets: new Set(),
                colors: new Set(),
                gradingTerms: new Set(),
                teamNames: new Set(),
                otherTerms: new Set()
            };

            for (const card of cards) {
                // Analyze the player name for problematic terms
                if (card.player_name) {
                    const playerWords = card.player_name.toLowerCase().split(' ');
                    
                    for (const word of playerWords) {
                        if (word.length < 2) continue;
                        
                        // Check if this word is already in our extraction lists
                        const isInCardTerms = this.isInCardTerms(word);
                        const isInTeamNames = this.isInTeamNames(word);
                        
                        if (!isInCardTerms && !isInTeamNames) {
                            // Categorize the term
                            if (this.isCardType(word)) {
                                missingTerms.cardTypes.add(word);
                            } else if (this.isCardSet(word)) {
                                missingTerms.cardSets.add(word);
                            } else if (this.isColor(word)) {
                                missingTerms.colors.add(word);
                            } else if (this.isGradingTerm(word)) {
                                missingTerms.gradingTerms.add(word);
                            } else if (this.isTeamName(word)) {
                                missingTerms.teamNames.add(word);
                            } else {
                                missingTerms.otherTerms.add(word);
                            }
                        }
                    }
                }
            }

            // Convert Sets to Arrays and sort
            const result = {
                cardTypes: Array.from(missingTerms.cardTypes).sort(),
                cardSets: Array.from(missingTerms.cardSets).sort(),
                colors: Array.from(missingTerms.colors).sort(),
                gradingTerms: Array.from(missingTerms.gradingTerms).sort(),
                teamNames: Array.from(missingTerms.teamNames).sort(),
                otherTerms: Array.from(missingTerms.otherTerms).sort()
            };

            console.log('📊 Missing Terms Analysis:');
            console.log('========================');
            
            console.log('\n🎴 Card Types:');
            result.cardTypes.forEach(term => console.log(`  '${term}',`));
            
            console.log('\n📦 Card Sets:');
            result.cardSets.forEach(term => console.log(`  '${term}',`));
            
            console.log('\n🎨 Colors:');
            result.colors.forEach(term => console.log(`  '${term}',`));
            
            console.log('\n📋 Grading Terms:');
            result.gradingTerms.forEach(term => console.log(`  '${term}',`));
            
            console.log('\n🏈 Team Names:');
            result.teamNames.forEach(term => console.log(`  '${term}',`));
            
            console.log('\n❓ Other Terms:');
            result.otherTerms.forEach(term => console.log(`  '${term}',`));

            console.log('\n📝 Summary:');
            console.log(`  Card Types: ${result.cardTypes.length}`);
            console.log(`  Card Sets: ${result.cardSets.length}`);
            console.log(`  Colors: ${result.colors.length}`);
            console.log(`  Grading Terms: ${result.gradingTerms.length}`);
            console.log(`  Team Names: ${result.teamNames.length}`);
            console.log(`  Other Terms: ${result.otherTerms.length}`);
            console.log(`  Total Missing Terms: ${result.cardTypes.length + result.cardSets.length + result.colors.length + result.gradingTerms.length + result.teamNames.length + result.otherTerms.length}`);

            return result;

        } catch (error) {
            console.error('❌ Error extracting missing terms:', error);
            throw error;
        }
    }

    isInCardTerms(word) {
        const cardTerms = [
            'rookie', 'rc', 'yg', 'young guns', '1st', 'first', 'prospect', 'debut',
            'auto', 'autograph', 'on card', 'sticker', 'patch', 'relic', 'memorabilia',
            'parallel', 'insert', 'base', 'sp', 'ssp', 'short print', 'super short print',
            'parallel', 'insert', 'base', 'holo', 'holographic', 'chrome', 'prizm',
            'refractor', 'x-fractor', 'cracked ice', 'stained glass', 'die-cut', 'die cut',
            'wave', 'velocity', 'scope', 'hyper', 'optic', 'mosaic', 'select', 'finest',
            'bowman', 'topps', 'panini', 'donruss', 'optic', 'mosaic', 'select', 'finest',
            'baseball', 'football', 'basketball', 'hockey', 'soccer', 'golf', 'racing',
            'rookie card', 'university', 'draft', 'stars', 'cosmic', 'invicta', 'all-etch',
            'gold', 'silver', 'black', 'red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink',
            'bronze', 'white', 'teal', 'neon', 'camo', 'tie-dye', 'disco', 'dragon scale',
            'snakeskin', 'pulsar', 'logo', 'variation', 'clear cut', 'real one', 'downtown',
            'genesis', 'fast break', 'zoom', 'flashback', 'emergent', 'mania', 'geometric',
            'honeycomb', 'pride', 'kaleidoscopic', 'vintage', 'splash', 'rising', 'best',
            'independence day', 'father\'s day', 'mother\'s day', 'memorial day',
            'mvp', 'hof', 'nfl', 'mlb', 'nba', 'nhl', 'debut', 'card', 'rated', 'chrome', 'university',
            'vikings', 'hof', 'brewers', 'bears', 'pirates', 'cardinals', 'dodgers', 'yankees',
            'red sox', 'cubs', 'white sox', 'braves', 'mets', 'phillies', 'nationals', 'marlins',
            'rays', 'blue jays', 'orioles', 'indians', 'guardians', 'tigers', 'royals', 'twins',
            'astros', 'rangers', 'athletics', 'mariners', 'angels', 'giants', 'padres', 'rockies',
            'diamondbacks', 'reds', 'pirates', 'cardinals', 'brewers', 'cubs', 'white sox',
            'packers', 'bears', 'lions', 'vikings', 'cowboys', 'eagles', 'giants', 'redskins',
            'commanders', 'patriots', 'steelers', 'bills', 'dolphins', 'jets', 'bengals',
            'browns', 'ravens', 'texans', 'colts', 'jaguars', 'titans', 'broncos', 'chargers',
            'raiders', 'chiefs', '49ers', 'seahawks', 'cardinals', 'rams', 'saints', 'buccaneers',
            'falcons', 'panthers',
            // College/school names
            'duke', 'mavericks', 'blue devils', 'tar heels', 'wolfpack', 'demon deacons',
            'seminoles', 'hurricanes', 'gators', 'bulldogs', 'tigers', 'wildcats', 'cardinals',
            'eagles', 'hawks', 'panthers', 'cavaliers', 'hokies', 'orange', 'syracuse',
            'connecticut', 'uconn', 'villanova', 'georgetown', 'providence', 'seton hall',
            'creighton', 'xavier', 'butler', 'depaul', 'marquette', 'st johns', 'kansas',
            'kentucky', 'north carolina', 'arizona', 'ucla', 'usc', 'stanford', 'california',
            'oregon', 'oregon state', 'washington', 'washington state', 'colorado', 'utah',
            'arizona state', 'ucla', 'usc', 'stanford', 'california', 'oregon', 'oregon state',
            'washington', 'washington state', 'colorado', 'utah', 'arizona state',
            // Soccer team names
            'liverpool', 'manchester united', 'manchester city', 'arsenal', 'chelsea',
            'tottenham', 'barcelona', 'real madrid', 'bayern munich', 'psg', 'juventus',
            'ac milan', 'inter milan', 'ajax', 'porto', 'benfica', 'celtic', 'rangers',
            'fc', 'united', 'city', 'athletic', 'sporting', 'dynamo', 'spartak', 'zenit',
            // Card types that should be removed from player names
            'flash', 'fifa', 'velocity', 'scope', 'hyper', 'optic', 'mosaic', 'select', 'finest',
            'wave', 'cosmic', 'planetary', 'pursuit', 'eris', 'autos', 'aqua', 'sapphire',
            'woo', 'draft', 'red/white/blue', 'tf1', 'invicta', 'all-etch', 'night',
            'cosmic stars', 'cosmic', 'all etch', 'stars', 'splash', 'rising', 'best',
            'genesis', 'fast break', 'zoom', 'flashback', 'emergent', 'mania', 'geometric',
            'honeycomb', 'pride', 'kaleidoscopic', 'vintage', 'downtown', 'real one',
            'clear cut', 'variation', 'logo', 'pulsar', 'snakeskin', 'dragon scale',
            'tie-dye', 'disco', 'neon', 'camo', 'bronze', 'teal', 'pink', 'purple', 'orange',
            'yellow', 'green', 'blue', 'red', 'black', 'silver', 'gold', 'white',
            'refractor', 'x-fractor', 'cracked ice', 'stained glass', 'die-cut', 'die cut',
            'holo', 'holographic', 'prizm', 'chrome', 'base', 'sp', 'ssp', 'short print',
            'super short print', 'parallel', 'insert', 'numbered', 'limited',
            // Specific problematic terms from the cards
            'invicta bi15', 'invicta', 'bi15', 'ra jca', 'ra', 'jca', 'caedm', 'in', 'jesus made',
            'night', 'cosmic stars', 'cosmic', 'all-etch', 'all etch'
        ];
        
        return cardTerms.includes(word.toLowerCase());
    }

    isInTeamNames(word) {
        const teamNames = [
            'a\'s', 'athletics', 'vikings', 'cardinals', 'eagles', 'falcons', 'ravens', 'bills', 'panthers', 'bears', 'bengals', 'browns', 'cowboys', 'broncos', 'lions', 'packers', 'texans', 'colts', 'jaguars', 'chiefs', 'raiders', 'chargers', 'rams', 'dolphins', 'patriots', 'saints', 'giants', 'jets', 'steelers', '49ers', 'seahawks', 'buccaneers', 'titans', 'commanders', 'ny giants', 'redskins',
            'yankees', 'red sox', 'blue jays', 'orioles', 'rays', 'white sox', 'indians', 'guardians', 'tigers', 'twins', 'royals', 'astros', 'rangers', 'mariners', 'angels', 'dodgers', 'padres', 'rockies', 'diamondbacks', 'braves', 'marlins', 'mets', 'phillies', 'nationals', 'pirates', 'reds', 'brewers', 'cubs', 'cardinals',
            'lakers', 'warriors', 'celtics', 'heat', 'knicks', 'nets', 'raptors', '76ers', 'hawks', 'hornets', 'wizards', 'magic', 'pacers', 'bucks', 'cavaliers', 'pistons', 'rockets', 'mavericks', 'spurs', 'grizzlies', 'pelicans', 'thunder', 'jazz', 'nuggets', 'timberwolves', 'trail blazers', 'kings', 'suns', 'clippers', 'bulls',
            'red wings', 'blackhawks', 'bruins', 'rangers', 'maple leafs', 'canadiens', 'senators', 'sabres', 'lightning', 'capitals', 'flyers', 'devils', 'islanders', 'penguins', 'blue jackets', 'hurricanes', 'predators', 'blues', 'wild', 'avalanche', 'stars', 'oilers', 'flames', 'canucks', 'sharks', 'ducks', 'golden knights', 'coyotes', 'jets', 'kraken',
            'mvp', 'hof', 'nfl', 'mlb', 'nba', 'nhl', 'debut', 'rookie', 'rc', 'yg', 'psa', 'gem', 'mint', 'ssp', 'holo', 'velocity', 'notoriety', 'card', 'rated', '1st', 'first', 'chrome', 'university', 'minnesota', 'oilers', 'kings', 'clear cut', 'premier', 'opc', 's d', 'nfl football', '3-d', 'cardinals', 'rams', 'vikings', 'browns', 'chiefs', 'giants', 'eagles', 'cowboys', 'falcons', 'panthers', 'steelers', 'patriots', 'saints', 'jets', 'bills', 'dolphins', 'texans', 'colts', 'jaguars', 'titans', 'broncos', 'raiders', 'chargers', 'seahawks', '49ers', 'cardinals', 'buccaneers', 'commanders', 'redskins', 'packers', 'bears', 'lions', 'bengals', 'ravens', 'browns', 'steelers', 'titans', 'jaguars', 'colts', 'texans', 'chiefs', 'raiders', 'broncos', 'chargers', 'cowboys', 'giants', 'eagles', 'redskins', 'commanders', 'bears', 'lions', 'packers', 'vikings', 'falcons', 'panthers', 'saints', 'buccaneers', 'rams', 'seahawks', '49ers', 'cardinals', 'yankees', 'red sox', 'blue jays', 'orioles', 'rays', 'white sox', 'indians', 'guardians', 'tigers', 'twins', 'royals', 'astros', 'rangers', 'mariners', 'angels', 'dodgers', 'padres', 'rockies', 'diamondbacks', 'braves', 'marlins', 'mets', 'phillies', 'nationals', 'pirates', 'reds', 'brewers', 'cubs', 'cardinals', 'lakers', 'warriors', 'celtics', 'heat', 'knicks', 'nets', 'raptors', '76ers', 'hawks', 'hornets', 'wizards', 'magic', 'pacers', 'bucks', 'cavaliers', 'pistons', 'rockets', 'mavericks', 'spurs', 'grizzlies', 'pelicans', 'thunder', 'jazz', 'nuggets', 'timberwolves', 'trail blazers', 'kings', 'suns', 'clippers', 'bulls',
            'duke', 'mavericks', 'blue devils', 'tar heels', 'wolfpack', 'demon deacons',
            'seminoles', 'hurricanes', 'gators', 'bulldogs', 'tigers', 'wildcats', 'cardinals',
            'eagles', 'hawks', 'panthers', 'cavaliers', 'hokies', 'orange', 'syracuse',
            'connecticut', 'uconn', 'villanova', 'georgetown', 'providence', 'seton hall',
            'creighton', 'xavier', 'butler', 'depaul', 'marquette', 'st johns', 'kansas',
            'kentucky', 'north carolina', 'arizona', 'ucla', 'usc', 'stanford', 'california',
            'oregon', 'oregon state', 'washington', 'washington state', 'colorado', 'utah',
            'arizona state', 'ucla', 'usc', 'stanford', 'california', 'oregon', 'oregon state',
            'washington', 'washington state', 'colorado', 'utah', 'arizona state',
            'liverpool', 'manchester united', 'manchester city', 'arsenal', 'chelsea',
            'tottenham', 'barcelona', 'real madrid', 'bayern munich', 'psg', 'juventus',
            'ac milan', 'inter milan', 'ajax', 'porto', 'benfica', 'celtic', 'rangers',
            'fc', 'united', 'city', 'athletic', 'sporting', 'dynamo', 'spartak', 'zenit',
            'flash', 'fifa', 'velocity', 'scope', 'hyper', 'optic', 'mosaic', 'select', 'finest',
            'wave', 'cosmic', 'planetary', 'pursuit', 'eris', 'autos', 'aqua', 'sapphire',
            'woo', 'draft', 'red/white/blue', 'tf1', 'invicta', 'all-etch', 'night',
            'cosmic stars', 'cosmic', 'all etch', 'stars', 'splash', 'rising', 'best',
            'genesis', 'fast break', 'zoom', 'flashback', 'emergent', 'mania', 'geometric',
            'honeycomb', 'pride', 'kaleidoscopic', 'vintage', 'downtown', 'real one',
            'clear cut', 'variation', 'logo', 'pulsar', 'snakeskin', 'dragon scale',
            'tie-dye', 'disco', 'neon', 'camo', 'bronze', 'teal', 'pink', 'purple', 'orange',
            'yellow', 'green', 'blue', 'red', 'black', 'silver', 'gold', 'white',
            'refractor', 'x-fractor', 'cracked ice', 'stained glass', 'die-cut', 'die cut',
            'holo', 'holographic', 'prizm', 'chrome', 'base', 'sp', 'ssp', 'short print',
            'super short print', 'parallel', 'insert', 'numbered', 'limited', 'au', 'auto', 'autograph'
        ];
        
        return teamNames.includes(word.toLowerCase());
    }

    isCardType(word) {
        const cardTypes = ['prizm', 'refractor', 'x-fractor', 'chrome', 'base', 'parallel', 'insert', 'holo', 'autograph', 'auto', 'rookie', 'rc', 'yg', 'prospect', 'debut', 'patch', 'relic', 'memorabilia', 'sticker', 'on card', 'short print', 'ssp', 'sp', 'super short print', 'numbered', 'limited', 'cracked ice', 'stained glass', 'die-cut', 'die cut', 'wave', 'velocity', 'scope', 'hyper', 'optic', 'mosaic', 'select', 'finest', 'cosmic', 'planetary', 'pursuit', 'eris', 'aqua', 'sapphire', 'woo', 'draft', 'invicta', 'all-etch', 'night', 'cosmic stars', 'stars', 'splash', 'rising', 'best', 'genesis', 'fast break', 'zoom', 'flashback', 'emergent', 'mania', 'geometric', 'honeycomb', 'pride', 'kaleidoscopic', 'vintage', 'downtown', 'real one', 'clear cut', 'variation', 'logo', 'pulsar', 'snakeskin', 'dragon scale', 'tie-dye', 'disco', 'neon', 'camo', 'bronze', 'teal', 'pink', 'purple', 'orange', 'yellow', 'green', 'blue', 'red', 'black', 'silver', 'gold', 'white', 'flash', 'fifa', 'lazer', 'shock', 'ice', 'mt', 'magenta', 'lightboard'];
        return cardTypes.includes(word.toLowerCase());
    }

    isCardSet(word) {
        const cardSets = ['topps', 'bowman', 'panini', 'donruss', 'fleer', 'score', 'chronicles', 'prizm', 'chrome', 'optic', 'mosaic', 'select', 'finest', 'gallery', 'draft', 'picks', 'best', 'prospects', 'u', '1st', 'first'];
        return cardSets.includes(word.toLowerCase());
    }

    isColor(word) {
        const colors = ['gold', 'silver', 'black', 'red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink', 'bronze', 'white', 'teal', 'neon', 'camo', 'magenta', 'aqua', 'sapphire'];
        return colors.includes(word.toLowerCase());
    }

    isGradingTerm(word) {
        const gradingTerms = ['psa', 'gem', 'mint', 'graded', 'ungraded', 'bgs', 'beckett', 'sgc', 'csg', 'hga', 'gma'];
        return gradingTerms.includes(word.toLowerCase());
    }

    isTeamName(word) {
        const teamNames = ['patriots', 'pats', 'bears', 'lions', 'packers', 'vikings', 'falcons', 'panthers', 'saints', 'buccaneers', 'rams', 'seahawks', '49ers', 'cardinals', 'cowboys', 'giants', 'eagles', 'redskins', 'commanders', 'steelers', 'browns', 'bengals', 'ravens', 'texans', 'colts', 'jaguars', 'titans', 'chiefs', 'raiders', 'broncos', 'chargers', 'bills', 'dolphins', 'jets', 'yankees', 'red sox', 'blue jays', 'orioles', 'rays', 'white sox', 'indians', 'guardians', 'tigers', 'twins', 'royals', 'astros', 'rangers', 'mariners', 'angels', 'dodgers', 'padres', 'rockies', 'diamondbacks', 'braves', 'marlins', 'mets', 'phillies', 'nationals', 'pirates', 'reds', 'brewers', 'cubs', 'cardinals', 'lakers', 'warriors', 'celtics', 'heat', 'knicks', 'nets', 'raptors', '76ers', 'hawks', 'hornets', 'wizards', 'magic', 'pacers', 'bucks', 'cavaliers', 'pistons', 'rockets', 'mavericks', 'spurs', 'grizzlies', 'pelicans', 'thunder', 'jazz', 'nuggets', 'timberwolves', 'trail blazers', 'kings', 'suns', 'clippers', 'bulls', 'duke', 'orange', 'syracuse', 'kansas', 'kentucky', 'north carolina', 'arizona', 'ucla', 'usc', 'stanford', 'california', 'oregon', 'washington', 'colorado', 'utah', 'arizona state'];
        return teamNames.includes(word.toLowerCase());
    }

    async close() {
        await this.db.close();
    }
}

// Add to Express routes
function addExtractMissingTermsRoute(app) {
    app.post('/api/admin/extract-missing-terms', async (req, res) => {
        try {
            console.log('🔍 Extract missing terms endpoint called');
            
            const extractor = new MissingTermsExtractor();
            await extractor.connect();
            const result = await extractor.extractMissingTerms();
            await extractor.close();

            res.json({
                success: true,
                message: 'Missing terms extracted successfully',
                data: result,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('❌ Error in extract missing terms endpoint:', error);
            res.status(500).json({
                success: false,
                message: 'Error extracting missing terms',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    });
}

module.exports = { MissingTermsExtractor, addExtractMissingTermsRoute };
