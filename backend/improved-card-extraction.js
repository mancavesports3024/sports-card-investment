const NewPricingDatabase = require('./create-new-pricing-database.js');

class ImprovedCardExtraction {
    constructor() {
        this.db = new NewPricingDatabase();
    }

    async connect() {
        await this.db.connect();
        console.log('✅ Connected to database');
    }

    async close() {
        await this.db.close();
        console.log('✅ Database connection closed');
    }

    // Improved player name extraction with better apostrophe handling
    extractPlayerName(title) {
        if (!title) return null;
        
        console.log(`🔍 Extracting player name from: "${title}"`);
        
        // First, normalize apostrophes and common name patterns
        let cleanedTitle = this.normalizePlayerNames(title);
        
        // Debug: Show what the normalization did
        console.log(`🔍 After normalization: "${cleanedTitle}"`);
        
        // Remove years, card numbers, print runs, etc.
        cleanedTitle = cleanedTitle
            .replace(/\d{4}/g, '') // Remove years
            .replace(/psa|bgs|beckett|gem|mint|near mint|excellent|very good|good|fair|poor/gi, '') // Remove grading terms
            .replace(/card|cards/gi, '') // Remove "card" and "cards"
            .replace(/#[A-Z0-9\-]+/g, '') // Remove card numbers like #123, #TF1, #BC-72, #CPA-BA
            .replace(/\d+\/\d+/g, '') // Remove print runs like 123/456
            .replace(/\b\d{1,2}(?:st|nd|rd|th)\b/gi, '') // Remove ordinal numbers like 1st, 2nd, 3rd
            .replace(/\b\d+\b/g, '') // Remove standalone numbers
            .replace(/\([^)]*\)/g, '') // Remove parentheses and their contents like (AU)
            .replace(/\s+/g, ' ') // Normalize whitespace
            .trim();
        
        // Split into words and filter out card-related terms
        const words = cleanedTitle.split(' ').filter(word => word.length > 0);
        
        // Clean up words by removing trailing dashes and other artifacts
        const cleanWords = words.map(word => word.replace(/^-+$/, '').replace(/^-/, '').replace(/-$/, '')).filter(word => word.length > 0);
        
        // Remove emojis and other non-alphabetic characters from words
        const finalWords = cleanWords.map(word => word.replace(/[^\w\s'-]/g, '')).filter(word => word.length > 0);
        const filteredWords = [];
        
        console.log(`🔍 Words to process: [${finalWords.join(', ')}]`);
        
        for (const word of finalWords) {
            if (word.length < 2) continue;
            
            // Enhanced card terms list including the new ones identified
            const cardTerms = [
                // Card brands and companies
                'topps', 'panini', 'donruss', 'bowman', 'upper', 'deck', 'fleer', 'score', 'leaf', 'ud',
                
                // Card set types (including new ones)
                'chrome', 'prizm', 'optic', 'mosaic', 'select', 'heritage', 'stadium', 'club', 'allen', 'ginter', 
                'gypsy', 'queen', 'finest', 'fire', 'opening', 'day', 'big', 'league', 'immaculate', 'national', 
                'treasures', 'flawless', 'obsidian', 'chronicles', 'contenders', 'international', 'ufc',
                
                // New card sets identified
                'ascensions', 'fireworks', 'kaboom', 'truth', 'persona', 'hoops', 'origins', 'checkerboard',
                'fever', 'luck', 'lottery', 'phenom', 'lava', 'sparks', 'authentix', 'portrait', 'razzle',
                'tectonic', 'euro', 'wings', 'sun', 'future', 'intimidators', 'refractor',
                
                // UEFA and soccer terms
                'uefa', 'champions', 'league', 'womens', "women's",
                
                // College/University terms
                'north', 'carolina', 'basketball', 'university', 'college',
                
                // Parallel and insert types
                'refractor', 'parallel', 'numbered', 'limited', 'gold', 'silver', 'bronze', 'platinum', 
                'diamond', 'emerald', 'sapphire', 'ruby', 'amethyst', 'onyx', 'black', 'white', 'red', 
                'blue', 'green', 'yellow', 'orange', 'purple', 'pink', 'teal', 'aqua', 'cyan', 'lime', 
                'mint', 'peach', 'salmon', 'tan', 'brown', 'gray', 'grey', 'navy', 'maroon', 'burgundy', 
                'crimson', 'scarlet',
                
                // Card features
                'rookie', 'rc', 'auto', 'autograph', 'autographs', 'au', 'jersey', 'patch', 'base', 
                'holo', 'ssp', 'sp', 'hof',
                
                // Other card terms
                'victory', 'crown', 'portrait', 'police', 'instant', 'impact', 'update', 'field', 
                'level', 'courtside', 'elephant', 'disco', 'ice', 'lazer', 'shock', 'wave', 'cosmic', 
                'planetary', 'pursuit', 'eris', 'autos', 'aqua', 'sapphire', 'woo', 'draft', 
                'red/white/blue', 'tf1', 'and', 'ohtani', 'judge', 'sox', 'pop', 'road', 'to', 'premier'
            ];
            
            if (cardTerms.includes(word.toLowerCase())) {
                console.log(`🔍 Filtered out card term: "${word}"`);
                continue;
            }
            
            // Enhanced team names list
            const teamNames = [
                'cardinals', 'eagles', 'falcons', 'ravens', 'bills', 'panthers', 'bears', 'bengals', 
                'browns', 'cowboys', 'broncos', 'lions', 'packers', 'texans', 'colts', 'jaguars', 
                'chiefs', 'raiders', 'chargers', 'rams', 'dolphins', 'vikings', 'patriots', 'saints', 
                'giants', 'jets', 'steelers', '49ers', 'seahawks', 'buccaneers', 'titans', 'commanders', 
                'yankees', 'red sox', 'blue jays', 'orioles', 'rays', 'white sox', 'indians', 'guardians', 
                'tigers', 'twins', 'royals', 'astros', 'rangers', 'athletics', 'mariners', 'angels', 
                'dodgers', 'giants', 'padres', 'rockies', 'diamondbacks', 'braves', 'marlins', 'mets', 
                'phillies', 'nationals', 'pirates', 'reds', 'brewers', 'cubs', 'lakers', 'warriors', 
                'celtics', 'heat', 'knicks', 'nets', 'raptors', '76ers', 'hawks', 'hornets', 'wizards', 
                'magic', 'pacers', 'bucks', 'cavaliers', 'pistons', 'rockets', 'mavericks', 'spurs', 
                'grizzlies', 'pelicans', 'thunder', 'jazz', 'nuggets', 'timberwolves', 'trail blazers', 
                'kings', 'suns', 'clippers', 'bulls', 'red wings'
            ];
            
            if (teamNames.includes(word.toLowerCase())) {
                console.log(`🔍 Filtered out team name: "${word}"`);
                continue;
            }
            
            filteredWords.push(word);
        }
        
        // Look for patterns like "First Last" or "First Middle Last"
        if (filteredWords.length >= 2 && filteredWords.length <= 3) {
            const potentialName = filteredWords.slice(0, Math.min(3, filteredWords.length)).join(' ');
            if (potentialName.length >= 3 && potentialName.length <= 30) {
                console.log(`✅ Extracted player name: "${potentialName}"`);
                return potentialName;
            }
        }
        
        console.log(`❌ No valid player name found. Filtered words: [${filteredWords.join(', ')}]`);
        return null;
    }

    // Normalize player names with proper apostrophes
    normalizePlayerNames(text) {
        let normalized = text;
        
        // Specific name normalizations
        const nameReplacements = [
            { r: /\bja\s*marr\b/gi, v: "Ja'Marr" },
            { r: /\bja\s*marr\s+chase\b/gi, v: "Ja'Marr Chase" },
            { r: /\bja'marr\b/gi, v: "Ja'Marr" },
            { r: /\bja'marr\s+chase\b/gi, v: "Ja'Marr Chase" },
            { r: /\bde\s*von\b\s+achane/gi, v: "De'Von Achane" },
            { r: /\bo\s*'?\s*hearn\b/gi, v: "O'Hearn" },
            { r: /\bryan\s+o\s*'?\s*hearn\b/gi, v: "Ryan O'Hearn" },
            { r: /\bo\s*'?\s*hoppe\b/gi, v: "O'Hoppe" },
            { r: /\bsmith\s*njigba\b/gi, v: 'Smith-Njigba' },
            { r: /\bkuroda\s*grauer\b/gi, v: 'Kuroda-Grauer' },
            { r: /\bcee\s*dee\s+lamb\b/gi, v: 'CeeDee Lamb' },
            { r: /\bdon[cč]i[cć]\b/gi, v: 'Doncic' },
            { r: /\bt\s*j\b/gi, v: 'TJ' },
            { r: /\bcassius\s+clay\b/gi, v: 'Muhammad Ali' },
            { r: /\bstephon\s+castle\b/gi, v: 'Stephon Castle' },
            { r: /\bchase\s+burns\b/gi, v: 'Chase Burns' },
            { r: /\bcameron\s+brink\b/gi, v: 'Cameron Brink' },
            { r: /\blebron\s+james\b/gi, v: 'LeBron James' },
            { r: /\blando\s+norris\b/gi, v: 'Lando Norris' },
            { r: /\bderrick\s+henry\b/gi, v: 'Derrick Henry' },
            { r: /\bcaitlin\s+clark\b/gi, v: 'Caitlin Clark' },
            { r: /\bdrake\s+maye\b/gi, v: 'Drake Maye' },
            { r: /\broman\s+anthony\b/gi, v: 'Roman Anthony' },
            { r: /\balex\s+rodriguez\b/gi, v: 'Alex Rodriguez' },
            { r: /\bjack\s+grealish\b/gi, v: 'Jack Grealish' },
            { r: /\bjosh\s+allen\b/gi, v: 'Josh Allen' },
            { r: /\bfrank\s+thomas\b/gi, v: 'Frank Thomas' },
            { r: /\bsaquon\s+barkley\b/gi, v: 'Saquon Barkley' },
            { r: /\bmichael\s+penix\b/gi, v: 'Michael Penix' },
            { r: /\blarry\s+wilson\b/gi, v: 'Larry Wilson' },
            { r: /\bjayden\s+daniels\b/gi, v: 'Jayden Daniels' },
            { r: /\bdevonte\s+booker\b/gi, v: 'Devin Booker' },
            { r: /\barda\s+guler\b/gi, v: 'Arda Guler' },
            { r: /\bkris\s+draper\b/gi, v: 'Kris Draper' },
            { r: /\btony\s+ferguson\b/gi, v: 'Tony Ferguson' },
            { r: /\bhubert\s+davis\b/gi, v: 'Hubert Davis' },
            { r: /\btobin\s+heath\b/gi, v: 'Tobin Heath' }
        ];
        
        for (const { r, v } of nameReplacements) {
            normalized = normalized.replace(r, v);
        }
        
        return normalized;
    }

    // Extract card set information
    extractCardSet(title) {
        if (!title) return null;
        
        console.log(`🔍 Extracting card set from: "${title}"`);
        
        // Brand mappings
        const brandMappings = {
            'ud': 'Upper Deck',
            'upper deck': 'Upper Deck',
            'topps': 'Topps',
            'panini': 'Panini',
            'donruss': 'Donruss',
            'bowman': 'Bowman',
            'fleer': 'Fleer',
            'score': 'Score',
            'leaf': 'Leaf'
        };
        
        // Card set patterns
        const cardSetPatterns = [
            // Specific card sets (most specific first)
            { pattern: /chrome\s+uefa\s+womens?\s+champions\s+league/gi, set: "Chrome UEFA Women's Champions League" },
            { pattern: /uefa\s+womens?\s+champions\s+league/gi, set: "UEFA Women's Champions League" },
            { pattern: /finest\s+ufc/gi, set: 'Finest UFC' },
            { pattern: /north\s+carolina\s+basketball/gi, set: 'North Carolina Basketball' },
            { pattern: /ascensions/gi, set: 'Ascensions' },
            { pattern: /fireworks/gi, set: 'Fireworks' },
            { pattern: /kaboom/gi, set: 'Kaboom' },
            { pattern: /truth/gi, set: 'Truth' },
            { pattern: /persona/gi, set: 'Persona' },
            { pattern: /origins/gi, set: 'Origins' },
            { pattern: /checkerboard/gi, set: 'Checkerboard' },
            { pattern: /fever/gi, set: 'Fever' },
            { pattern: /luck/gi, set: 'Luck' },
            { pattern: /lottery/gi, set: 'Lottery' },
            { pattern: /phenom/gi, set: 'Phenom' },
            { pattern: /lava/gi, set: 'Lava' },
            { pattern: /sparks/gi, set: 'Sparks' },
            { pattern: /authentix/gi, set: 'Authentix' },
            { pattern: /portrait/gi, set: 'Portrait' },
            { pattern: /national/gi, set: 'National' },
            { pattern: /razzle/gi, set: 'Razzle' },
            { pattern: /tectonic/gi, set: 'Tectonic' },
            { pattern: /euro/gi, set: 'Euro' },
            { pattern: /wings/gi, set: 'Wings' },
            { pattern: /sun/gi, set: 'Sun' },
            { pattern: /future/gi, set: 'Future' },
            { pattern: /intimidators/gi, set: 'Intimidators' },
            
            // Generic patterns (only if no specific pattern matched)
            { pattern: /prizm/gi, set: 'Prizm' },
            // Note: Chrome pattern removed to avoid conflicts with specific patterns
            { pattern: /optic/gi, set: 'Optic' },
            { pattern: /mosaic/gi, set: 'Mosaic' },
            { pattern: /select/gi, set: 'Select' },
            { pattern: /heritage/gi, set: 'Heritage' },
            { pattern: /stadium\s+club/gi, set: 'Stadium Club' },
            { pattern: /allen\s+ginter/gi, set: 'Allen & Ginter' },
            { pattern: /gypsy\s+queen/gi, set: 'Gypsy Queen' },
            { pattern: /finest/gi, set: 'Finest' }
        ];
        
        // Find matching card set (check most specific patterns first)
        for (const { pattern, set } of cardSetPatterns) {
            if (pattern.test(title)) {
                console.log(`✅ Extracted card set: "${set}"`);
                return set;
            }
        }
        
        // Special handling for UEFA Women's Champions League
        if (title.toLowerCase().includes('uefa') && title.toLowerCase().includes('women') && title.toLowerCase().includes('champions league')) {
            console.log(`✅ Extracted card set: "UEFA Women's Champions League"`);
            return "UEFA Women's Champions League";
        }
        
        console.log(`❌ No card set found`);
        return null;
    }

    // Extract brand information
    extractBrand(title) {
        if (!title) return null;
        
        console.log(`🔍 Extracting brand from: "${title}"`);
        
        const brandPatterns = [
            { pattern: /\bud\b/gi, brand: 'Upper Deck' },
            { pattern: /\bupper\s+deck\b/gi, brand: 'Upper Deck' },
            { pattern: /\btopps\b/gi, brand: 'Topps' },
            { pattern: /\bpanini\b/gi, brand: 'Panini' },
            { pattern: /\bdonruss\b/gi, brand: 'Donruss' },
            { pattern: /\bbowman\b/gi, brand: 'Bowman' },
            { pattern: /\bfleer\b/gi, brand: 'Fleer' },
            { pattern: /\bscore\b/gi, brand: 'Score' },
            { pattern: /\bleaf\b/gi, brand: 'Leaf' }
        ];
        
        for (const { pattern, brand } of brandPatterns) {
            if (pattern.test(title)) {
                console.log(`✅ Extracted brand: "${brand}"`);
                return brand;
            }
        }
        
        console.log(`❌ No brand found`);
        return null;
    }

    // Extract card type information
    extractCardType(title) {
        if (!title) return null;
        
        console.log(`🔍 Extracting card type from: "${title}"`);
        
        const cardTypePatterns = [
            { pattern: /intimidators\s+auto\s+refractor/gi, type: 'Intimidators Auto Refractor' },
            { pattern: /autographs?\s*\(au\)/gi, type: 'Autographs (AU)' },
            { pattern: /rookie\s+pink\s+prizm/gi, type: 'Rookie Pink Prizm' },
            { pattern: /auto\s+refractor/gi, type: 'Auto Refractor' },
            { pattern: /pink\s+prizm/gi, type: 'Pink Prizm' },
            { pattern: /refractor/gi, type: 'Refractor' },
            { pattern: /autograph/gi, type: 'Autograph' },
            { pattern: /auto/gi, type: 'Auto' },
            { pattern: /rookie/gi, type: 'Rookie' },
            { pattern: /rc/gi, type: 'RC' }
        ];
        
        for (const { pattern, type } of cardTypePatterns) {
            if (pattern.test(title)) {
                console.log(`✅ Extracted card type: "${type}"`);
                return type;
            }
        }
        
        console.log(`❌ No card type found`);
        return null;
    }

    // Extract year information
    extractYear(title) {
        if (!title) return null;
        
        const yearMatch = title.match(/\b(19|20)\d{2}\b/);
        if (yearMatch) {
            console.log(`✅ Extracted year: "${yearMatch[0]}"`);
            return yearMatch[0];
        }
        
        console.log(`❌ No year found`);
        return null;
    }

    // Extract card number
    extractCardNumber(title) {
        if (!title) return null;
        
        const cardNumberMatch = title.match(/#([A-Z0-9\-]+)/);
        if (cardNumberMatch) {
            console.log(`✅ Extracted card number: "#${cardNumberMatch[1]}"`);
            return cardNumberMatch[1];
        }
        
        console.log(`❌ No card number found`);
        return null;
    }

    // Extract print run
    extractPrintRun(title) {
        if (!title) return null;
        
        const printRunMatch = title.match(/(\d+)\/(\d+)/);
        if (printRunMatch) {
            const printRun = `${printRunMatch[1]}/${printRunMatch[2]}`;
            console.log(`✅ Extracted print run: "${printRun}"`);
            return printRun;
        }
        
        // Also check for patterns like "/25" or "/99" without leading number
        const simplePrintRunMatch = title.match(/\/(\d+)/);
        if (simplePrintRunMatch) {
            const printRun = `/${simplePrintRunMatch[1]}`;
            console.log(`✅ Extracted print run: "${printRun}"`);
            return printRun;
        }
        
        console.log(`❌ No print run found`);
        return null;
    }

    // Comprehensive card information extraction
    extractCardInfo(title) {
        console.log(`\n🔍 Comprehensive card extraction for: "${title}"`);
        
        const cardInfo = {
            playerName: this.extractPlayerName(title),
            cardSet: this.extractCardSet(title),
            brand: this.extractBrand(title),
            cardType: this.extractCardType(title),
            year: this.extractYear(title),
            cardNumber: this.extractCardNumber(title),
            printRun: this.extractPrintRun(title)
        };
        
        console.log(`\n📋 Extracted card info:`, cardInfo);
        return cardInfo;
    }

    // Test the extraction with the problematic cards
    async testExtraction() {
        console.log('🧪 Testing card extraction with problematic cards...\n');
        
        const testCards = [
            "2021 Panini Prizm- Ja'marr Chase- Rookie Pink Prizm- PSA 10 💎",
            "2021 Topps Chrome UEFA Women's Champions League Tobin Heath /25 PSA 10",
            "2010-11 UD North Carolina Basketball - Hubert Davis #58 Autographs (AU) PSA 10",
            "2024 Topps Finest UFC #TFN Tony Ferguson Intimidators Auto Refractor /99 PSA 10"
        ];
        
        for (const card of testCards) {
            console.log(`\n${'='.repeat(80)}`);
            console.log(`Testing: ${card}`);
            console.log(`${'='.repeat(80)}`);
            
            const info = this.extractCardInfo(card);
            
            console.log(`\n🎯 Results:`);
            console.log(`Player Name: ${info.playerName || 'NOT FOUND'}`);
            console.log(`Card Set: ${info.cardSet || 'NOT FOUND'}`);
            console.log(`Brand: ${info.brand || 'NOT FOUND'}`);
            console.log(`Card Type: ${info.cardType || 'NOT FOUND'}`);
            console.log(`Year: ${info.year || 'NOT FOUND'}`);
            console.log(`Card Number: ${info.cardNumber || 'NOT FOUND'}`);
            console.log(`Print Run: ${info.printRun || 'NOT FOUND'}`);
        }
    }
}

// Main execution
async function main() {
    const extractor = new ImprovedCardExtraction();
    
    try {
        await extractor.connect();
        await extractor.testExtraction();
    } catch (error) {
        console.error('❌ Error in main:', error);
    } finally {
        await extractor.close();
    }
}

if (require.main === module) {
    main();
}

module.exports = { ImprovedCardExtraction };
