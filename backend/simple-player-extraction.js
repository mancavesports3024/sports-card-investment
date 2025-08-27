// Simplified Player Name Extraction Function
function extractPlayerName(title) {
    let cleanTitle = title;
    
    // Step 1: Remove card components that we've already extracted
    const cardSet = extractCardSet(title);
    if (cardSet) {
        const tolerant = cardSet.replace(/\s+/g, '[\\s-]+');
        cleanTitle = cleanTitle.replace(new RegExp(tolerant, 'gi'), ' ');
    }
    
    const cardType = extractCardType(title);
    if (cardType && cardType.toLowerCase() !== 'base') {
        cleanTitle = cleanTitle.replace(new RegExp(cardType, 'gi'), ' ');
    }
    
    const cardNumber = extractCardNumber(title);
    if (cardNumber) {
        const base = cardNumber.replace('#', '');
        const tolerantBase = base.replace(/[-\s]+/g, '[-\\s]*').replace(/([A-Za-z]+)(\d+)/, '$1[-\\s]*$2');
        cleanTitle = cleanTitle.replace(new RegExp(tolerantBase, 'gi'), ' ');
        cleanTitle = cleanTitle.replace(/#/g, ' ');
    }
    
    // Step 2: Remove grading terms
    const gradingTerms = ['psa', '10', 'gem', 'mint', 'gem mint', 'psa 10', 'psa10', 'bgs', 'beckett', 'sgc', 'csg', 'hga', 'gma', 'graded', 'ungraded'];
    gradingTerms.forEach(term => {
        cleanTitle = cleanTitle.replace(new RegExp(`\\b${term}\\b`, 'gi'), ' ');
    });
    
    // Step 3: Remove years and print runs
    cleanTitle = cleanTitle.replace(/\b(19|20)\d{2}\b/g, ' ');
    cleanTitle = cleanTitle.replace(/\d+\/\d+/g, ' ');
    
    // Step 4: Remove card terms using comprehensive filtering
    const cardTerms = [
        // Card types
        'rookie', 'rc', 'yg', 'auto', 'autograph', 'patch', 'relic', 'parallel', 'insert', 'base', 'sp', 'ssp',
        'holo', 'holographic', 'chrome', 'prizm', 'prizms', 'refractor', 'fractor', 'prism', 'die-cut', 'wave', 'velocity', 'scope', 'hyper',
        'optic', 'mosaic', 'select', 'finest', 'bowman', 'topps', 'panini', 'donruss', 'chronicles', 'obsidian',
        'contenders', 'instant', 'update', 'courtside', 'jersey', 'international', 'impact', 'university', 'draft',
        'stars', 'cosmic', 'invicta', 'all-etch', 'edition', 'signature', 'color', 'design', 'pitching', 'starcade',
        'premium', 'speckle', 'flair', 'ucl', 'olympics', 'wnba', 'league', 'championship', 'tournament', 'series',
        'profiles', 'mini', 'border', 'intimidators', 'kellogg', 'mist', 'usa', 'xr', 'logofractor', 'cyan',
        'authentic', 'rpa', 'formula 1', 'p.p.', 'match', 'mav', 'concourse', 'concourses', 'essentials', 'supernatural',
        'heritage', 'focus', 'winning ticket', 'prizmatic', 'mint2', 'indiana', 'batting', 'florida', 'pitch',
        'baseball', 'football', 'basketball', 'hockey', 'soccer', 'golf', 'racing',
        
        // Colors
        'gold', 'silver', 'black', 'red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink', 'bronze', 'white',
        'teal', 'neon', 'camo', 'tie-dye', 'disco', 'dragon scale', 'snakeskin', 'pulsar', 'logo', 'variation',
        'clear cut', 'real one', 'downtown', 'genesis', 'fast break', 'zoom', 'flashback', 'emergent', 'mania',
        'geometric', 'honeycomb', 'pride', 'kaleidoscopic', 'vintage', 'splash', 'rising', 'best',
        'independence day', 'father\'s day', 'mother\'s day', 'memorial day',
        
        // Team names (comprehensive list)
        'a\'s', 'athletics', 'vikings', 'cardinals', 'eagles', 'falcons', 'ravens', 'bills', 'panthers', 'bears',
        'bengals', 'browns', 'cowboys', 'broncos', 'lions', 'packers', 'texans', 'colts', 'jaguars', 'chiefs',
        'raiders', 'chargers', 'rams', 'dolphins', 'patriots', 'saints', 'giants', 'jets', 'steelers', '49ers',
        'seahawks', 'buccaneers', 'titans', 'commanders', 'bulls', 'lakers', 'celtics', 'warriors', 'heat',
        'knicks', 'nets', 'raptors', '76ers', 'hawks', 'hornets', 'wizards', 'magic', 'pacers', 'bucks',
        'cavaliers', 'pistons', 'rockets', 'mavericks', 'spurs', 'grizzlies', 'pelicans', 'thunder', 'jazz',
        'nuggets', 'timberwolves', 'trail blazers', 'kings', 'suns', 'clippers', 'brewers', 'pirates', 'dodgers',
        'yankees', 'red sox', 'cubs', 'white sox', 'braves', 'mets', 'phillies', 'nationals', 'marlins', 'rays',
        'blue jays', 'orioles', 'indians', 'guardians', 'tigers', 'royals', 'twins', 'astros', 'rangers',
        'mariners', 'angels', 'giants', 'padres', 'rockies', 'diamondbacks', 'reds', 'new england', 'la',
        'sounders', 'timbers', 'whitecaps', 'impact', 'toronto fc', 'vancouver whitecaps', 'seattle sounders',
        'portland timbers', 'montreal impact', 'atlanta united', 'orlando city', 'nyc fc', 'la galaxy',
        'chicago fire', 'columbus crew', 'dc united', 'houston dynamo', 'fc dallas', 'sporting kc',
        'minnesota united', 'real salt lake', 'colorado rapids', 'san jose earthquakes', 'philadelphia union',
        'new england revolution', 'montreal cf', 'toronto fc', 'vancouver whitecaps', 'seattle sounders fc',
        'portland timbers fc', 'atlanta united fc', 'orlando city sc', 'new york city fc', 'la galaxy fc',
        'chicago fire fc', 'columbus crew sc', 'dc united fc', 'houston dynamo fc', 'fc dallas sc',
        'sporting kansas city', 'minnesota united fc', 'real salt lake fc', 'colorado rapids fc',
        'san jose earthquakes fc', 'philadelphia union fc', 'new england revolution fc',
        
        // Card number prefixes
        'bdc', 'bdp', 'bcp', 'cda', 'mmr', 'tc', 'dt', 'bs', 'sjmc',
        
        // Other terms
        'mvp', 'hof', 'nfl', 'mlb', 'nba', 'nhl', 'debut', 'card', 'rated', 'chrome', 'university', 'ufc', 'mma',
        'mixed martial arts', 'octagon', 'fighter', 'fighting', 'wwe', 'nascar', 'indycar', 'indy', 'drag racing',
        'rally', 'rallycross', 'motocross', 'supercross', 'endurance', 'sprint', 'dirt track', 'oval', 'road course',
        'street circuit', 'paddock', 'pit', 'pit lane', 'grid', 'qualifying', 'practice', 'warm up', 'formation lap',
        'safety car', 'virtual safety car', 'red flag', 'yellow flag', 'blue flag', 'checkered flag', 'pole position',
        'podium', 'championship', 'points', 'season', 'race', 'grand prix', 'gp', 'monaco', 'silverstone', 'monza',
        'spa', 'suzuka', 'interlagos', 'red bull', 'ferrari', 'mercedes', 'mclaren', 'aston martin', 'alpine',
        'williams', 'haas', 'alfa romeo', 'alpha tauri', 'racing point', 'force india', 'sauber', 'toro rosso',
        'minardi', 'benetton', 'tyrrell', 'lotus', 'brabham', 'cooper', 'vanwall', 'maserati', 'alfa', 'bugatti',
        'delage', 'peugeot', 'renault', 'bmw', 'toyota', 'honda', 'ford', 'chevrolet', 'dodge', 'pontiac',
        'oldsmobile', 'buick', 'cadillac', 'lincoln', 'mercury', 'plymouth', 'amc', 'studebaker', 'packard', 'nash',
        'hudson', 'kaiser', 'frazer', 'willys', 'jeep', 'international', 'diamond t', 'mack', 'peterbilt', 'kenworth',
        'freightliner', 'western star', 'volvo', 'scania', 'man', 'iveco', 'daf', 'renault trucks', 'volvo trucks',
        'scania trucks', 'man trucks', 'iveco trucks', 'daf trucks'
    ];
    
    cardTerms.forEach(term => {
        cleanTitle = cleanTitle.replace(new RegExp(`\\b${term}\\b`, 'gi'), ' ');
    });
    
    // Step 5: Remove standalone numbers and special characters (but preserve apostrophes)
    cleanTitle = cleanTitle.replace(/\b\d+\b/g, ' ');
    cleanTitle = cleanTitle.replace(/[^\w\s\/']/g, ' ').replace(/\s+/g, ' ').trim();
    
    // Step 6: Handle special cases
    // Dual player cards
    const dualPlayerPattern = /\b([A-Z][a-z]+\s*\/\s*[A-Z][a-z]+)\b/g;
    const dualPlayerMatch = cleanTitle.match(dualPlayerPattern);
    if (dualPlayerMatch && dualPlayerMatch.length > 0) {
        return dualPlayerMatch[0].replace(/\s+/g, '').trim();
    }
    
    // Initials like J.J. McCarthy - check in original title first
    const originalInitialPattern = /\b(J\.?\s*J\.?\s+[A-Z][a-z]+)\b/gi;
    const originalInitialMatch = title.match(originalInitialPattern);
    if (originalInitialMatch && originalInitialMatch.length > 0) {
        return originalInitialMatch[0].replace(/\s+/g, ' ').trim();
    }
    
    // Also check in cleaned title
    const initialPattern = /\b([A-Z]\.?\s*[A-Z]\.?\s+[A-Z][a-z]+)\b/g;
    const initialMatch = cleanTitle.match(initialPattern);
    if (initialMatch && initialMatch.length > 0) {
        return initialMatch[0].replace(/\s+/g, ' ').trim();
    }
    
    // Step 7: Extract player name from remaining words
    const words = cleanTitle.split(' ').filter(word => word.length > 1);
    
    if (words.length === 0) {
        // Fallback: try to extract from original title if cleaned title is empty
        const originalWords = title.split(' ').filter(word => word.length > 1);
        if (originalWords.length >= 2) {
            // Take first 2-3 words as potential player name
            const fallbackWords = originalWords.slice(0, Math.min(3, originalWords.length));
            const fallbackName = fallbackWords.join(' ');
            
            // Check if it's a known player
            const lowerFallbackName = fallbackName.toLowerCase();
            if (knownPlayers[lowerFallbackName]) {
                return knownPlayers[lowerFallbackName];
            }
            
            // Default capitalization
            return fallbackName.split(' ').map(word => 
                word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
            ).join(' ');
        }
        return null;
    }
    
    // Take the first 1-4 words as the player name (allow for multi-word last names)
    const playerNameWords = words.slice(0, Math.min(4, words.length));
    const playerName = playerNameWords.join(' ');
    
    // Capitalize properly but preserve original case for known players
    const knownPlayers = {
        'lebron': 'LeBron',
        'lebron james': 'LeBron James',
        'j.j. mccarthy': 'J.J. McCarthy',
        'ryan ohearn': 'Ryan O\'Hearn',
        'pedro de la vega': 'Pedro De La Vega',
        'pedro de vega': 'Pedro De La Vega', // Handle case where "La" was filtered
        'xavier worthy': 'Xavier Worthy',
        'caleb williams': 'Caleb Williams',
        'anthony edwards': 'Anthony Edwards',
        'brock purdy': 'Brock Purdy',
        'aaron judge': 'Aaron Judge',
        'shohei ohtani': 'Shohei Ohtani',
        'michael jordan': 'Michael Jordan',
        'kobe bryant': 'Kobe Bryant',
        'tom brady': 'Tom Brady'
    };
    
    const lowerPlayerName = playerName.toLowerCase();
    if (knownPlayers[lowerPlayerName]) {
        return knownPlayers[lowerPlayerName];
    }
    
    // Default capitalization
    return playerName.split(' ').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
}

// Helper functions (these would be methods in the actual class)
function extractCardSet(title) {
    // Simplified card set extraction
    const cardSets = [
        'Panini Prizm', 'Topps Chrome', 'Bowman Chrome', 'Donruss Optic', 'Mosaic', 'Select',
        'Finest', 'Flawless', 'National Treasures', 'Immaculate', 'Contenders', 'Chronicles',
        'Obsidian', 'Instant', 'Update', 'Heritage', 'Gypsy Queen', 'Stadium Club', 'Allen & Ginter'
    ];
    
    for (const set of cardSets) {
        if (title.toLowerCase().includes(set.toLowerCase())) {
            return set;
        }
    }
    return null;
}

function extractCardType(title) {
    // Simplified card type extraction
    const cardTypes = [
        'Gold Prizm', 'Silver Prizm', 'Black Prizm', 'Green Prizm', 'Blue Prizm', 'Red Prizm',
        'Gold Refractor', 'Silver Refractor', 'Black Refractor', 'Green Refractor', 'Blue Refractor', 'Red Refractor',
        'Genesis', 'Fast Break', 'Downtown', 'Real One', 'RPA', 'Clear Cut', 'Zoom'
    ];
    
    for (const type of cardTypes) {
        if (title.toLowerCase().includes(type.toLowerCase())) {
            return type;
        }
    }
    return null;
}

function extractCardNumber(title) {
    // Simplified card number extraction
    const patterns = [
        /#(\d+)/g,
        /#([A-Za-z]+[-\dA-Za-z]+)/g,
        /\b(BD[A-Z]?\d+)\b/g,
        /\b([A-Z]{2,}\d+)\b/g
    ];
    
    for (const pattern of patterns) {
        const match = title.match(pattern);
        if (match) {
            return match[0];
        }
    }
    return null;
}

module.exports = { extractPlayerName };

