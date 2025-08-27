// Simple Player Name Extraction Function
// This is a clean, simple implementation that removes all card-related terms

function extractPlayerName(title) {
    const verboseExtraction = process.env.VERBOSE_EXTRACTION === '1' || process.env.VERBOSE_EXTRACTION === 'true';
    
    if (verboseExtraction) {
        console.log(`🔍 Processing title: "${title}"`);
    }
    
    // Step 1: Remove numbers, card numbers, and basic formatting
    let cleanedTitle = title
        .replace(/\d{4}/g, '') // Remove years
        .replace(/#[A-Z0-9\-]+/g, '') // Remove card numbers like #123, #TF1, #BC-72, #CPA-BA
        .replace(/\d+\/\d+/g, '') // Remove print runs like 123/456
        .replace(/\b\d{1,2}(?:st|nd|rd|th)\b/gi, '') // Remove ordinal numbers like 1st, 2nd, 3rd
        .replace(/\b\d+\b/g, '') // Remove standalone numbers
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();
    
    if (verboseExtraction) {
        console.log(`🔍 After number removal: "${cleanedTitle}"`);
    }
    
    // Step 2: Split into words
    const words = cleanedTitle.split(' ').filter(word => word.length > 0);
    const filteredWords = [];
    
    if (verboseExtraction) {
        console.log(`🔍 Words to process: [${words.join(', ')}]`);
    }
    
    // COMPREHENSIVE TERMS TO REMOVE - Based on documented list
    const termsToRemove = new Set([
        // Card brands and companies
        'topps', 'panini', 'donruss', 'bowman', 'upper', 'deck', 'fleer', 'score', 'leaf', 'playoff', 'press pass', 'sage', 'pacific', 'skybox', 'focus', 'certified',
        
        // Card set types and brands
        'chrome', 'prizm', 'prizmatic', 'optic', 'mosaic', 'select', 'heritage', 'stadium', 'club', 'allen', 'ginter', 'gypsy', 'queen', 'finest', 'fire', 'opening', 'day', 'big', 'league', 'immaculate', 'national', 'treasures', 'flawless', 'obsidian', 'chronicles', 'contenders', 'international', 'gallery', 'archives', 'update', 'series', 'university', 'u', 'bcp', 'lunar glow', 'rated', 'holo', 'gem mint', 'gem', 'mint', 'mt', 'fsa', 'dm', 'el', 'he13', 'endick', 'flames', 'cpacr', 'ew5', 'wt', 'tr', 'ink', 'pop1', 'pfr', 'rpa', 'p.p.', 'authentic', 'mania', 'ref', 'all', 'certified', 'blazers', 'micro', 'scripts', 'rs', 'rr', 'cardinals', 'premier', 'tectonic', 'braves', 'legend', 'instant', 'rps', 'look', 'nil', 'ama', 'texas', 'longhorns', 'rockies', 'portrait', 'mclaren', 'heat', 'monopoly', 'pb', 'pink', 'ice', 'cpa', 'nk', 'cda', 'rv', 'velocity', 'sterling', 'sp', 'spx', 'exquisite', 'elite', 'absolute', 'spectra', 'phoenix', 'playbook', 'momentum', 'totally', 'crown', 'royale', 'threads', 'prestige', 'rookies', 'stars', 'game', 'gallery',
        
        // Parallel and insert types
        'refractor', 'parallel', 'numbered', 'limited', 'gold', 'silver', 'bronze', 'platinum', 'diamond', 'emerald', 'sapphire', 'ruby', 'amethyst', 'onyx', 'black', 'white', 'red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink', 'teal', 'aqua', 'cyan', 'lime', 'mint', 'peach', 'salmon', 'tan', 'brown', 'gray', 'grey', 'navy', 'maroon', 'burgundy', 'crimson', 'scarlet', 'coral', 'apricot', 'tangerine', 'amber', 'golden', 'metallic', 'copper', 'cream', 'ivory', 'beige', 'khaki', 'olive', 'turquoise', 'magenta', 'fuchsia',
        
        // Card features and grading
        'rookie', 'rc', 'auto', 'autograph', 'autographs', 'au', 'jersey', 'patch', 'base', 'holo', 'ssp', 'sp', 'hof', 'graded', 'ungraded', 'cert', 'certificate', 'pop', 'population', 'hit', 'case', 'prospect', 'prospects', 'draft', '1st', 'first', 'yg', 'young guns', 'debut', 'on card', 'sticker', 'relic', 'memorabilia', 'short print', 'super short print', 'holographic', 'x-fractor', 'cracked ice', 'stained glass', 'die-cut', 'die cut', 'wave', 'velocity', 'scope', 'hyper', 'invicta', 'all-etch', 'edition', 'neon', 'camo', 'tie-dye', 'disco', 'dragon scale', 'snakeskin', 'pulsar', 'logo', 'variation', 'clear cut', 'real one', 'downtown', 'genesis', 'fast break', 'zoom', 'flashback', 'emergent', 'mania', 'geometric', 'honeycomb', 'pride', 'kaleidoscopic', 'vintage', 'splash', 'rising', 'best', 'independence day', 'father\'s day', 'mother\'s day', 'memorial day', 'mvp', 'nfl', 'mlb', 'nba', 'nhl', 'card', 'chrome', 'university', 'picks', 'prospects', 'obsidian', 'instant', 'courtside', 'jersey', 'international', 'impact', 'baseball', 'football', 'basketball', 'hockey', 'soccer', 'golf', 'racing', 'rookie card', 'stars', 'cosmic', 'invicta', 'all-etch', 'edition',
        
        // Additional card types and patterns
        'flash', 'fifa', 'velocity', 'scope', 'hyper', 'optic', 'mosaic', 'select', 'finest', 'wave', 'cosmic', 'planetary', 'pursuit', 'eris', 'autos', 'aqua', 'woo', 'draft', 'red/white/blue', 'tf1', 'all-etch', 'night', 'cosmic stars', 'cosmic', 'all etch', 'stars', 'splash', 'rising', 'best', 'genesis', 'fast break', 'zoom', 'flashback', 'emergent', 'mania', 'geometric', 'honeycomb', 'pride', 'kaleidoscopic', 'vintage', 'downtown', 'real one', 'clear cut', 'variation', 'logo', 'pulsar', 'snakeskin', 'dragon scale', 'tie-dye', 'disco', 'neon', 'camo', 'bronze', 'teal', 'pink', 'purple', 'orange', 'yellow', 'green', 'blue', 'red', 'black', 'silver', 'gold', 'white', 'refractor', 'x-fractor', 'cracked ice', 'stained glass', 'die-cut', 'die cut', 'holo', 'holographic', 'prizm', 'chrome', 'base', 'sp', 'ssp', 'short print', 'super short print', 'parallel', 'insert', 'numbered', 'limited', 'ice', 'lazer', 'lightboard', 'magenta', 'mt', 'shock', 'invicta bi15', 'bi15', 'ra jca', 'ra', 'jca', 'caedm', 'in', 'night', 'cosmic stars', 'cosmic', 'all-etch', 'all etch', 'shimmer', 'scripts', 'ref', 'reptilian', 'storm', 'storm-chasers', 'zone', 'sunday', 'pop', 'chasers', 'busters', 'reactive', 'reprint', 'king', 'dallas', 'rainbow', 'go hard go', 'go hard go home', 'home', 'royal blue', 'gold rainbow', 'holiday', 'yellow', 'aqua', 'silver crackle', 'yellow rainbow', 'jack o lantern', 'ghost', 'gold', 'blue holo', 'purple holo', 'green crackle', 'orange crackle', 'red crackle', 'vintage stock', 'independence day', 'black', 'fathers day', 'mothers day', 'mummy', 'yellow crackle', 'memorial day', 'black cat', 'clear', 'witches hat', 'bats', 'first card', 'platinum', 'printing plates', 'royal', 'blue', 'vintage', 'stock', 'independence', 'day', 'fathers', 'mothers', 'memorial', 'cat', 'witches', 'hat', 'lantern', 'crackle', 'holo', 'foilboard', 'rookies', 'now', 'foil', 'case hit', 'case-hit', 'case hits', 'case-hits',
        
        // UFC/MMA terms
        'ufc', 'mma', 'mixed martial arts', 'octagon', 'fighter', 'fighting',
        
        // Additional card types
        'xfractor', 'flair', 'apparitions', 'luminance', 'fractal', 'checker', 'rush', 'monopoly', 'light', 'certified', 'penmanship', 'low', 'electric', 'dual', 'starcade', 'collector', 'phenomenon', 'preview', 'mls', 'blazers', 'level', 'premier', 'sparkle', 'ucc', 'snider', 'road to uefa', 'jack murphy stadium', 'ink', 'endrick', 'tie', 'pandora', 'pedro de', 'jr tie', 'ohtani judge', 'joe milton', 'malik', 'pandora malik', 'devin', 'worthy', 'signature', 'color', 'wwe', 'design', 'pitching', 'starcade', 'premium', 'speckle', 'flair', 'ucl', 'cosmic stars', 'the', 'of', 'olympics', 'wnba', 'league', 'championship', 'tournament', 'series', 'profiles', 'mini', 'border', 'intimidators', 'kellogg', 'mist', 'usa', 'xr', 'logofractor', 'cyan', 'authentic', 'rpa', 'formula 1', 'p.p.', 'match', 'mav', 'concourse', 'essentials', 'supernatural', 'heritage', 'focus', 'winning ticket', 'prizmatic', 'mint2', 'indiana', 'batting', 'florida', 'pitch', 'baseball', 'football', 'pitching', 'no',
        
        // Bowman numbering prefixes
        'bdc', 'bdp', 'bcp', 'cda', 'mmr', 'tc', 'dt', 'bs', 'sjmc', 'tc264', 'mmr-54',
        
        // Panini Prizm Basketball Parallels
        'black white prizms', 'china variation', 'choice blue', 'choice yellow', 'choice green prizms', 'choice tiger stripe prizms', 'fast break prizms', 'glitter prizms', 'green prizms', 'green ice prizms', 'green wave prizms', 'hyper prizms', 'ice prizms', 'orange ice prizms', 'pink ice prizms', 'pulsar prizms', 'red ice prizms', 'red sparkle prizms', 'red/white/blue prizms', 'ruby wave prizms', 'silver prizms', 'snakeskin prizms', 'wave prizms', 'white sparkle prizms', 'white tiger stripe prizms', 'red prizms', 'red seismic prizms', 'white lazer prizms', 'pink prizms', 'skewed prizms', 'basketball prizms', 'teal ice prizms', 'blue prizms', 'orange seismic prizms', 'white prizms', 'fast break blue prizms', 'premium factory set prizms', 'purple ice prizms', 'blue sparkle prizms', 'blue ice prizms', 'fast break orange prizms', 'wave blue prizms', 'fast break red prizms', 'blue pulsar prizms', 'blue seismic prizms', 'purple prizms', 'choice red prizms', 'dragon year prizms', 'multi wave prizms', 'fast break purple prizms', 'red power prizms', 'red pulsar prizms', 'wave orange prizms', 'fast break pink prizms', 'choice blue prizms', 'orange prizms', 'jade dragon scale prizms',
        
        // Additional terms from 3-word player name analysis
        'huddle', 'and', 'snake', 'minnesota', 'wings', 'legend', 'marco', 'van', 'liv', 'luck', 'lottery', 'hoops', 'origins', 'overdrive', 'pokemon', 'aquapolis', 'japanese', 'stormfront', 'sword', 'shield', 'radiant', 'retro', 'sublime', 'main', 'event', 'blast', 'cb', 'national', 'pride', 'nil', 'opc', 'pa', 'tographs', 'uefa', 'women', 'champions', 'uptown', 'uptowns', 'rps', 'lk',
        
        // Additional missing terms from duplicate files
        'sunday', 'bn391', 'reptilian', 'edition', 'au', 'fifa', 'insert', 'cra', 'mh', 'storm chasers', 'x factor', 'lk', 'foil', 'sun', 'lunar', 'fireworks', 'kings', 'millionaire', 'sparks', 'nuggets', 'lava', 'razzle', 'fever', 'allies', 'ascensions', 'authentix', 'checkerboard', 'sky', 'events', 'club', 'collection', 'future', 'ne', 'mars', 'la', 'atl', 'tmc', 'blast', 'cb', 'vision', 'buffaloes', 'explosive', 'look', 'iv', 'image', 'tographs', 'champions', 'catching', 'el', 'he13',
        
        // Additional terms from 3-word player name analysis
        'starquest', 'sox', 'texas', 'longhorns', 'minnesota', 'wings', 'atl', 'buffaloes', 'la', 'mars', 'ne', 'sun', 'lunar', 'fireworks', 'kaboom', 'hoops', 'field', 'euro', 'main', 'pokemon', 'japanese', 'stormfront', 'sword', 'shield', 'radiant', 'sublime', 'luck', 'lottery', 'national', 'pride', 'opc', 'stadium', 'catching', 'el', 'he13',
        
        // Grading terms
        'psa', 'bgs', 'beckett', 'gem', 'mint', 'near mint', 'excellent', 'very good', 'good', 'fair', 'poor', 'gem mint', 'mt',
        
        // Numbers and card identifiers
        'card', 'cards', 'rc', 'ro', 'rookie', '1st', 'first', 'yg', 'young guns', 'debut',
        
        // Team names (comprehensive list)
        'buffalo bills', 'miami dolphins', 'new england patriots', 'new york jets', 'baltimore ravens', 'cincinnati bengals', 'cleveland browns', 'pittsburgh steelers', 'houston texans', 'indianapolis colts', 'jacksonville jaguars', 'tennessee titans', 'denver broncos', 'kansas city chiefs', 'las vegas raiders', 'los angeles chargers', 'dallas cowboys', 'new york giants', 'philadelphia eagles', 'washington commanders', 'chicago bears', 'detroit lions', 'green bay packers', 'minnesota vikings', 'atlanta falcons', 'carolina panthers', 'new orleans saints', 'tampa bay buccaneers', 'arizona cardinals', 'los angeles rams', 'san francisco 49ers', 'seattle seahawks', 'pats', 'redskins', 'commanders',
        'new york yankees', 'boston red sox', 'toronto blue jays', 'baltimore orioles', 'tampa bay rays', 'chicago white sox', 'cleveland guardians', 'detroit tigers', 'kansas city royals', 'minnesota twins', 'houston astros', 'los angeles angels', 'oakland athletics', 'seattle mariners', 'texas rangers', 'atlanta braves', 'miami marlins', 'new york mets', 'philadelphia phillies', 'washington nationals', 'chicago cubs', 'cincinnati reds', 'milwaukee brewers', 'pittsburgh pirates', 'st. louis cardinals', 'arizona diamondbacks', 'colorado rockies', 'los angeles dodgers', 'san diego padres', 'san francisco giants', 'indians', 'guardians', 'o\'s', 'a\'s', 'athletics',
        'atlanta hawks', 'boston celtics', 'brooklyn nets', 'charlotte hornets', 'chicago bulls', 'cleveland cavaliers', 'dallas mavericks', 'denver nuggets', 'detroit pistons', 'golden state warriors', 'houston rockets', 'indiana pacers', 'los angeles clippers', 'los angeles lakers', 'memphis grizzlies', 'miami heat', 'milwaukee bucks', 'minnesota timberwolves', 'new orleans pelicans', 'new york knicks', 'oklahoma city thunder', 'orlando magic', 'philadelphia 76ers', 'phoenix suns', 'portland trail blazers', 'sacramento kings', 'san antonio spurs', 'toronto raptors', 'utah jazz', 'washington wizards', '76ers', 'trail blazers',
        'anaheim ducks', 'arizona coyotes', 'boston bruins', 'buffalo sabres', 'calgary flames', 'carolina hurricanes', 'chicago blackhawks', 'colorado avalanche', 'columbus blue jackets', 'dallas stars', 'detroit red wings', 'edmonton oilers', 'florida panthers', 'los angeles kings', 'minnesota wild', 'montreal canadiens', 'nashville predators', 'new jersey devils', 'new york islanders', 'new york rangers', 'ottawa senators', 'philadelphia flyers', 'pittsburgh penguins', 'san jose sharks', 'seattle kraken', 'st. louis blues', 'tampa bay lightning', 'toronto maple leafs', 'vancouver canucks', 'vegas golden knights', 'washington capitals', 'winnipeg jets', 'blackhawks', 'blue jackets', 'red wings', 'maple leafs', 'golden knights',
        'duke', 'blue devils', 'tar heels', 'wolfpack', 'demon deacons', 'seminoles', 'hurricanes', 'gators', 'bulldogs', 'tigers', 'wildcats', 'cardinals', 'eagles', 'hawks', 'panthers', 'cavaliers', 'hokies', 'orange', 'syracuse', 'connecticut', 'uconn', 'villanova', 'georgetown', 'providence', 'seton hall', 'creighton', 'xavier', 'butler', 'depaul', 'marquette', 'st johns', 'kansas', 'kentucky', 'north carolina', 'arizona', 'ucla', 'usc', 'stanford', 'california', 'oregon', 'oregon state', 'washington', 'washington state', 'colorado', 'utah', 'arizona state', 'longhorns', 'rockies',
        'liverpool', 'manchester united', 'manchester city', 'arsenal', 'chelsea', 'tottenham', 'barcelona', 'real madrid', 'bayern munich', 'psg', 'juventus', 'ac milan', 'inter milan', 'ajax', 'porto', 'benfica', 'celtic', 'rangers', 'fc', 'united', 'city', 'athletic', 'sporting', 'dynamo', 'spartak', 'zenit',
        
        // Individual team names
        'cardinals', 'eagles', 'falcons', 'ravens', 'bills', 'panthers', 'bears', 'bengals', 'browns', 'cowboys', 'broncos', 'lions', 'packers', 'texans', 'colts', 'jaguars', 'chiefs', 'raiders', 'chargers', 'rams', 'dolphins', 'vikings', 'patriots', 'saints', 'giants', 'jets', 'steelers', '49ers', 'seahawks', 'buccaneers', 'titans', 'commanders', 'yankees', 'red sox', 'blue jays', 'orioles', 'rays', 'white sox', 'indians', 'guardians', 'tigers', 'twins', 'royals', 'astros', 'rangers', 'athletics', 'mariners', 'angels', 'dodgers', 'giants', 'padres', 'rockies', 'diamondbacks', 'braves', 'marlins', 'mets', 'phillies', 'nationals', 'pirates', 'reds', 'brewers', 'cubs', 'lakers', 'warriors', 'celtics', 'heat', 'knicks', 'nets', 'raptors', '76ers', 'hawks', 'hornets', 'wizards', 'magic', 'pacers', 'bucks', 'cavaliers', 'pistons', 'rockets', 'mavericks', 'spurs', 'grizzlies', 'pelicans', 'thunder', 'jazz', 'nuggets', 'timberwolves', 'trail blazers', 'kings', 'suns', 'clippers', 'bulls', 'ducks', 'coyotes', 'bruins', 'sabres', 'flames', 'hurricanes', 'blackhawks', 'avalanche', 'blue jackets', 'stars', 'red wings', 'oilers', 'panthers', 'wild', 'canadiens', 'predators', 'devils', 'islanders', 'rangers', 'senators', 'flyers', 'penguins', 'sharks', 'kraken', 'blues', 'lightning', 'maple leafs', 'canucks', 'golden knights', 'capitals', 'jets',
        
        // City names
        'new york', 'los angeles', 'chicago', 'houston', 'phoenix', 'philadelphia', 'san antonio', 'san diego', 'dallas', 'san jose', 'austin', 'jacksonville', 'fort worth', 'columbus', 'charlotte', 'san francisco', 'indianapolis', 'seattle', 'denver', 'washington', 'boston', 'el paso', 'nashville', 'detroit', 'oklahoma city', 'portland', 'las vegas', 'memphis', 'louisville', 'baltimore', 'milwaukee', 'albuquerque', 'tucson', 'fresno', 'sacramento', 'atlanta', 'long beach', 'colorado springs', 'raleigh', 'miami', 'virginia beach', 'omaha', 'oakland', 'minneapolis', 'tulsa', 'arlington', 'tampa', 'new orleans', 'wichita', 'cleveland', 'bakersfield', 'aurora', 'anaheim', 'honolulu', 'santa ana', 'corpus christi', 'riverside', 'lexington', 'stockton', 'henderson', 'saint paul', 'st. louis', 'st louis', 'fort wayne', 'jersey city', 'chula vista', 'orlando', 'chandler', 'laredo', 'norfolk', 'lubbock', 'madison', 'durham', 'garland', 'glendale', 'hialeah', 'reno', 'baton rouge', 'irvine', 'chesapeake', 'irving', 'scottsdale', 'north las vegas', 'fremont', 'gilbert', 'san bernardino', 'boise', 'birmingham', 'rochester', 'spokane', 'montgomery', 'des moines', 'modesto', 'fayetteville', 'tacoma', 'shreveport', 'fontana', 'oxnard', 'aurora', 'moreno valley', 'yuma', 'glendale', 'huntington beach', 'mckinney', 'montgomery', 'augusta', 'columbus', 'amarillo', 'little rock', 'akron', 'durham', 'worcester', 'mesa', 'colorado springs', 'springfield', 'grand rapids', 'overland park', 'billings', 'salem', 'baton rouge', 'dayton', 'provo', 'sioux falls', 'waco', 'lakewood', 'chandler', 'paso', 'mckinney', 'laredo', 'durham', 'lewisville', 'chandler', 'glendale', 'gilbert', 'rochester', 'scottsdale', 'norfolk', 'chesapeake', 'garland', 'irving', 'north las vegas', 'fremont', 'irvine', 'san bernardino', 'birmingham', 'spokane', 'rochester', 'montgomery', 'des moines', 'modesto', 'fayetteville', 'tacoma', 'shreveport', 'fontana', 'oxnard', 'moreno valley', 'yuma', 'huntington beach', 'augusta', 'amarillo', 'little rock', 'akron', 'worcester', 'springfield', 'grand rapids', 'overland park', 'billings', 'salem', 'dayton', 'provo', 'sioux falls', 'waco', 'lakewood', 'lewisville',
        'buffalo', 'miami', 'baltimore', 'cincinnati', 'cleveland', 'pittsburgh', 'houston', 'indianapolis', 'jacksonville', 'tennessee', 'denver', 'kansas city', 'las vegas', 'dallas', 'philadelphia', 'chicago', 'detroit', 'green bay', 'minneapolis', 'atlanta', 'carolina', 'new orleans', 'tampa bay', 'arizona', 'san francisco', 'seattle', 'boston', 'toronto', 'tampa bay', 'chicago', 'cleveland', 'detroit', 'kansas city', 'minneapolis', 'houston', 'los angeles', 'oakland', 'seattle', 'texas', 'atlanta', 'miami', 'new york', 'philadelphia', 'washington', 'chicago', 'cincinnati', 'milwaukee', 'pittsburgh', 'st. louis', 'arizona', 'colorado', 'los angeles', 'san diego', 'san francisco', 'atlanta', 'boston', 'brooklyn', 'charlotte', 'chicago', 'cleveland', 'dallas', 'denver', 'detroit', 'golden state', 'houston', 'indiana', 'los angeles', 'memphis', 'miami', 'milwaukee', 'minneapolis', 'new orleans', 'new york', 'oklahoma city', 'orlando', 'philadelphia', 'phoenix', 'portland', 'sacramento', 'san antonio', 'toronto', 'utah', 'washington', 'anaheim', 'arizona', 'boston', 'buffalo', 'calgary', 'carolina', 'chicago', 'colorado', 'columbus', 'dallas', 'detroit', 'edmonton', 'florida', 'los angeles', 'minnesota', 'montreal', 'nashville', 'new jersey', 'new york', 'ottawa', 'philadelphia', 'pittsburgh', 'san jose', 'seattle', 'st. louis', 'tampa bay', 'toronto', 'vancouver', 'vegas', 'washington', 'winnipeg',
        
        // Sport terms
        'football', 'basketball', 'baseball', 'hockey', 'soccer', 'mma', 'ufc', 'wrestling', 'pokemon', 'nfl', 'nba', 'mlb', 'nhl', 'wnba', 'usa basketball', 'usa football', 'usa baseball', 'golf', 'racing', 'formula 1', 'formula1', 'wwe', 'olympics', 'championship', 'tournament', 'league'
    ]);
    
    // IMPORTANT: Terms to NOT filter (legitimate player names)
    const termsToKeep = new Set(['wayne', 'gretzky', 'aaron']);
    
    // Step 3: Filter words using the comprehensive term list
    for (const word of words) {
        // Skip if word is too short (likely not a player name)
        if (word.length < 2) continue;
        
        const wordLower = word.toLowerCase();
        
        // Keep legitimate player names
        if (termsToKeep.has(wordLower)) {
            filteredWords.push(word);
            if (verboseExtraction) {
                console.log(`✅ Keeping legitimate player name: "${word}"`);
            }
            continue;
        }
        
        // Remove card-related terms
        if (termsToRemove.has(wordLower)) {
            if (verboseExtraction) {
                console.log(`❌ Filtering out: "${word}"`);
            }
            continue;
        }
        
        // Keep the word (likely a player name)
        filteredWords.push(word);
        if (verboseExtraction) {
            console.log(`✅ Keeping: "${word}"`);
        }
    }
    
    // Step 4: Join remaining words to form player name
    const playerName = filteredWords.join(' ').trim();
    
    if (verboseExtraction) {
        console.log(`🔍 Final player name: "${playerName}"`);
    }
    
    return playerName || 'Unknown Player';
}

module.exports = { extractPlayerName };

