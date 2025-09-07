class SimplePlayerExtractor {
    constructor() {
        // Card set terms (brands, series) - Updated with comprehensive list
        this.cardSetTerms = [
            // Major Brands
            'topps', 'panini', 'donruss', 'bowman', 'upper deck', 'fleer', 'score', 'leaf', 'playoff', 'press pass', 'sage', 'pacific', 'skybox', 'focus', 'certified',
            
            // Card Set Types and Brands
            'chrome', 'prizm', 'prizmatic', 'optic', 'mosaic', 'select', 'heritage', 'stadium club', 'allen & ginter', 'gypsy queen', 'finest', 'fire', 'opening day', 'big league', 'immaculate', 'national treasures', 'flawless', 'obsidian', 'chronicles', 'contenders', 'international', 'gallery', 'archives', 'update', 'series', 'university', 'u', 'bcp', 'lunar glow', 'rated', 'holo', 'gem mint', 'gem', 'mint', 'mt', 'fsa', 'dm', 'el', 'he13', 'endick', 'flames', 'cpacr', 'ew5', 'wt', 'tr', 'ink', 'pop1', 'pfr', 'rpa', 'p.p.', 'authentic', 'mania', 'ref', 'all', 'certified', 'blazers', 'micro', 'scripts', 'rs', 'rr', 'cardinals', 'premier', 'tectonic', 'braves', 'legend', 'instant', 'rps', 'look', 'nil', 'ama', 'texas', 'longhorns', 'rockies', 'portrait', 'mclaren', 'heat', 'monopoly', 'pb', 'pink', 'ice', 'cpa', 'nk', 'cda', 'rv', 'velocity', 'sterling', 'sp', 'spx', 'exquisite', 'elite', 'absolute', 'spectra', 'phoenix', 'playbook', 'momentum', 'totally', 'crown', 'royale', 'threads', 'prestige', 'rookies', 'stars', 'game', 'gallery',
            // Additional Card Types and Patterns
            'flash', 'fifa', 'cosmic', 'planetary', 'pursuit', 'eris', 'autos', 'aqua', 'woo', 'red/white/blue', 'tf1', 'all-etch', 'night', 'cosmic stars', 'all etch', 'splash', 'rising', 'best', 'genesis', 'fast break', 'zoom', 'flashback', 'emergent', 'mania', 'geometric', 'honeycomb', 'pride', 'kaleidoscopic', 'vintage', 'downtown', 'real one', 'clear cut', 'variation', 'logo', 'pulsar', 'snakeskin', 'dragon scale', 'tie-dye', 'disco', 'neon', 'camo', 'bronze', 'teal', 'pink', 'purple', 'orange', 'yellow', 'green', 'blue', 'red', 'black', 'silver', 'gold', 'white', 'refractor', 'x-fractor', 'cracked ice', 'stained glass', 'die-cut', 'die cut', 'holo', 'holographic', 'prizm', 'chrome', 'base', 'sp', 'ssp', 'short print', 'super short print', 'parallel', 'insert', 'numbered', 'limited', 'ice', 'lazer', 'lightboard', 'magenta', 'mt', 'shock', 'invicta bi15', 'bi15', 'ra jca', 'ra', 'jca', 'caedm', 'in', 'night', 'cosmic stars', 'cosmic', 'all-etch', 'all etch', 'shimmer', 'scripts', 'ref', 'reptilian', 'storm', 'storm-chasers', 'zone', 'sunday', 'pop', 'chasers', 'busters', 'reactive', 'reprint', 'king', 'dallas', 'rainbow', 'go hard go', 'go hard go home', 'home', 'royal blue', 'gold rainbow', 'holiday', 'yellow', 'aqua', 'silver crackle', 'yellow rainbow', 'jack o lantern', 'ghost', 'gold', 'blue holo', 'purple holo', 'green crackle', 'orange crackle', 'red crackle', 'vintage stock', 'independence day', 'black', 'fathers day', 'mothers day', 'mummy', 'yellow crackle', 'memorial day', 'black cat', 'clear', 'witches hat', 'bats', 'first card', 'platinum', 'printing plates', 'royal', 'blue', 'vintage', 'stock', 'independence', 'day', 'fathers', 'mothers', 'memorial', 'cat', 'witches', 'hat', 'lantern', 'crackle', 'holo', 'foilboard', 'rookies', 'now', 'foil', 'case hit', 'case-hit', 'case hits', 'case-hits',
            
            // Additional Card Types
            'xfractor', 'flair', 'apparitions', 'luminance', 'fractal', 'checker', 'rush', 'monopoly', 'light', 'certified', 'penmanship', 'low', 'electric', 'dual', 'starcade', 'collector', 'phenomenon', 'preview', 'mls', 'blazers', 'level', 'premier', 'sparkle', 'ucc', 'snider', 'road to uefa', 'jack murphy stadium', 'ink', 'tie', 'pandora', 'signature', 'color', 'wwe', 'design', 'pitching', 'starcade', 'premium', 'speckle', 'flair', 'ucl', 'cosmic stars', 'the', 'of', 'olympics', 'wnba', 'league', 'championship', 'tournament', 'series', 'profiles', 'mini', 'border', 'intimidators', 'kellogg', 'mist', 'usa', 'xr', 'logofractor', 'cyan', 'authentic', 'rpa', 'formula 1', 'p.p.', 'match', 'mav', 'concourse', 'essentials', 'supernatural', 'heritage', 'focus', 'winning ticket', 'prizmatic', 'mint2', 'indiana', 'batting', 'florida', 'pitch', 'baseball', 'football', 'basketball', 'hockey', 'soccer', 'golf', 'racing',
            
            // Additional Terms from 3-word Player Name Analysis
            'huddle', 'and', 'snake', 'minnesota', 'wings', 'legend', 'marco', 'van', 'liv', 'luck', 'lottery', 'hoops', 'origins', 'overdrive', 'pokemon', 'aquapolis', 'japanese', 'stormfront', 'sword', 'shield', 'radiant', 'retro', 'sublime', 'main', 'event', 'blast', 'cb', 'national', 'pride', 'nil', 'opc', 'pa', 'tographs', 'uefa', 'women', 'champions', 'uptown', 'uptowns', 'rps', 'lk',
            
            // Additional Missing Terms from Duplicate Files
            'sunday', 'bn391', 'reptilian', 'edition', 'au', 'fifa', 'insert', 'mh', 'storm chasers', 'x factor', 'lk', 'foil', 'sun', 'lunar', 'fireworks', 'kings', 'millionaire', 'sparks', 'nuggets', 'lava', 'razzle', 'fever', 'allies', 'ascensions', 'authentix', 'checkerboard', 'sky', 'events', 'club', 'collection', 'future', 'ne', 'mars', 'atl', 'tmc', 'blast', 'cb', 'vision', 'buffaloes', 'explosive', 'look', 'iv', 'image', 'tographs', 'champions', 'catching', 'el', 'he13',
            
            // Additional Terms from 3-word Player Name Analysis  
            'starquest', 'sox', 'texas', 'longhorns', 'minnesota', 'wings', 'atl', 'buffaloes', 'mars', 'ne', 'sun', 'lunar', 'fireworks', 'kaboom', 'hoops', 'field', 'euro', 'main', 'pokemon', 'japanese', 'stormfront', 'sword', 'shield', 'radiant', 'sublime', 'luck', 'lottery', 'national', 'pride', 'opc', 'stadium', 'catching', 'el', 'he13',
            
            // Soccer/Football leagues and competitions
            'premier league', 'p/l', 'epl', 'bundesliga', 'la liga', 'serie a', 'ligue 1', 'uefa', 'champions league', 'europa league', 'world cup', 'euros', 'euro 2024',
            
            // Country names and abbreviations that appear in card titles  
            'argentina', 'brazil', 'england', 'france', 'germany', 'spain', 'italy', 'portugal', 'netherlands', 'croatia', 'usa', 'iii', 'jr', 'sr',
            
            // Single letters that appear as card terms (be careful with these)
            'l', 'p', 'r', 's', 'x', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'm', 'n', 'o', 'q', 't', 'u', 'v', 'w', 'y', 'z',
            
                         // Additional Card Set/Type Terms from 3-word Analysis
             'apex', 'composite', 'courtside', 'dp', 'etch', 'iconic', 'lane', 'notoriety', 'radiating', 'royalty', 'sepia', 'ud', 'zenith', 'dazzle', 'electricity', 'gear', 'tf', 'geo', 'mavs', 'crystallized', 'cracked', 'mojo', 'choice', 'persona', 'hype', 'illumination', 'elevate', 'choice', 'ba', 'xrc', 'tri', 'no', 'hb', 'bdc', 'rg', 'sb', 'hr', 'tj', 'wj', 'q0902', 'shadow', 'impact', 'la', 'av', 'dc', 'mns', 'ny', 'tf', 'cc', 'mj', 'se', 'true', 'aces', 'overhead', 'pinstripe', 'power', 'medal', 'metal', 'rainmakers', 'phenom', 'pandora', 'uptowns', 'uptown', 'scope', 'wave', 'disco', 'pink', 'blue', 'red', 'green', 'silver', 'gold', 'orange', 'purple', 'yellow', 'aqua', 'teal', 'bronze', 'white', 'black', 'camo', 'neon', 'tie-dye', 'snakeskin', 'dragon scale', 'pulsar', 'logo', 'variation', 'numbered', 'limited', 'platinum', 'diamond', 'emerald', 'ruby', 'amethyst', 'onyx', 'lime', 'peach', 'salmon', 'tan', 'brown', 'gray', 'grey', 'navy', 'maroon', 'burgundy', 'crimson', 'scarlet', 'coral', 'apricot', 'tangerine', 'amber', 'golden', 'metallic', 'copper', 'cream', 'ivory', 'beige', 'khaki', 'olive', 'turquoise', 'magenta', 'fuchsia', 'tf', 'tf',
            
            // Additional Card Set Terms from 4+ Word Analysis
            'o pee chee', 'o-pee-chee', 'brilliant full art', 'etopps classic', 'slania stamps', 'helmet heroes', 'world champion boxers', 'east west', 'duos', 'artist proof', 'anniversary', 'bomb squad rapture', 'big man on campus', 'young dolph', 'it up', 'ultra violet', 'bo knows', 'x meta', 'p p', 'hh', 'mega', 'pro', 'hh',
            
            // Additional Card Set Terms from Remaining 4+ Word Analysis
            'throwback thursday', 'greetings winter', 'synergy', 'tint', '30th', 'dye', 'prodigies', 'year one', 'vmax', 'star', 'ultra violet', 'vmax', 'e x2001', 'e-x2001', 'x meta', 'p p', 'x vision', 'p.p.', 'x vision', 'x meta', 'selections'
        ];

        // Card type terms - Updated with comprehensive list
        this.cardTypeTerms = [
            // Basic Card Types
            'rookie', 'rc', 'yg', 'auto', 'autograph', 'autographs', 'au', 'patch', 'relic', 'parallel', 'insert', 'base', 'sp', 'ssp', 'short print', 'super short print',
            'holo', 'holographic', 'refractor', 'fractor', 'x-fractor', 'prism', 'die-cut', 'die cut', 'wave', 'velocity', 'scope', 'hyper', 'cracked ice', 'stained glass',
            'clear cut', 'real one', 'downtown', 'genesis', 'fast break', 'zoom', 'flashback', 'emergent', 'mania', 'geometric', 'honeycomb', 'pride', 'kaleidoscopic', 'vintage', 'splash', 'rising', 'best',
            // Special card types
            'manga', 'snapshots', 'zebra', 'g2u', 'negative', 'gm', 'selections', 'landmarks', 'astrologically', 'aligned', 'classic', 'icon', 'deep', 'space', 'en', 'fuego', 'new', 'recruits', 'peacock', 'amp', 'qb', 'quarterback', 'groovy', 'futures', 'throwback', 'suite', 'wheel', 'tiger', 'stripes', 'grizz', 'deca',
            
            // Player designations that should be removed
            'roy', 'mvp', 'hof', 'rookie of the year', 'most valuable player', 'hall of fame',
            
            // Colors and Parallels
            'blue ice', 'gold', 'silver', 'black', 'red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink', 'bronze', 'white', 'teal', 'neon', 'camo', 'tie-dye', 'disco', 'dragon scale', 'snakeskin', 'pulsar', 'logo', 'variation', 'sapphire',
            'numbered', 'limited', 'platinum', 'diamond', 'emerald', 'ruby', 'amethyst', 'onyx', 'aqua', 'lime', 'peach', 'salmon', 'tan', 'brown', 'gray', 'grey', 'navy', 'maroon', 'burgundy', 'crimson', 'scarlet', 'coral', 'apricot', 'tangerine', 'amber', 'golden', 'metallic', 'copper', 'cream', 'ivory', 'beige', 'khaki', 'olive', 'turquoise', 'magenta', 'fuchsia',
            
                         // Special Features
             'jersey', 'memorabilia', 'on card', 'sticker', 'prospect', 'prospects', 'draft', '1st', 'first', 'young guns', 'debut', 'hof', 'cert', 'certificate', 'population', 'hit', 'case', 'independence day', 'father\'s day', 'mother\'s day', 'memorial day', 'mvp', 'card', 'cards', 'ro', 'picks', 'prospects', 'no huddle', 'color blast', 'stratospheric', 'box set', '3-d', 'portals', 'firestorm', 'sga', 'brilliant full art', 'ultraviolet', 'full art'
        ];

        // Team, league, city, and sport terms - Updated with comprehensive list
        this.teamLeagueCityTerms = [
            // NFL Teams (Comprehensive)
            'buffalo bills', 'miami dolphins', 'new england patriots', 'new york jets', 'baltimore ravens', 'cincinnati bengals', 'cleveland browns', 'pittsburgh steelers', 'houston texans', 'indianapolis colts', 'jacksonville jaguars', 'tennessee titans', 'denver broncos', 'kansas city chiefs', 'las vegas raiders', 'los angeles chargers', 'dallas cowboys', 'new york giants', 'philadelphia eagles', 'washington commanders', 'chicago bears', 'detroit lions', 'green bay packers', 'minnesota vikings', 'atlanta falcons', 'carolina panthers', 'new orleans saints', 'tampa bay buccaneers', 'arizona cardinals', 'los angeles rams', 'san francisco 49ers', 'seattle seahawks', 'pats', 'redskins', 'commanders',
            'a\'s', 'athletics', 'vikings', 'cardinals', 'eagles', 'falcons', 'ravens', 'bills', 'panthers', 'bears', 'bengals', 'browns', 'cowboys', 'broncos', 'lions', 'packers', 'texans', 'colts', 'jaguars', 'chiefs', 'raiders', 'chargers', 'rams', 'dolphins', 'patriots', 'saints', 'giants', 'jets', 'steelers', '49ers', 'seahawks', 'buccaneers', 'titans', 'commanders', 'ny giants', 'redskins',
            
                         // MLB Teams (Comprehensive)
             'new york yankees', 'boston red sox', 'toronto blue jays', 'baltimore orioles', 'tampa bay rays', 'chicago white sox', 'cleveland guardians', 'detroit tigers', 'kansas city royals', 'minnesota twins', 'houston astros', 'los angeles angels', 'oakland athletics', 'seattle mariners', 'texas rangers', 'atlanta braves', 'miami marlins', 'new york mets', 'philadelphia phillies', 'washington nationals', 'chicago cubs', 'cincinnati reds', 'milwaukee brewers', 'pittsburgh pirates', 'st. louis cardinals', 'arizona diamondbacks', 'colorado rockies', 'los angeles dodgers', 'san diego padres', 'san francisco giants', 'indians', 'guardians', 'o\'s', 'o s', 'a\'s', 'athletics',
                         'yankees', 'red sox', 'blue jays', 'orioles', 'o\'s', 'rays', 'white sox', 'indians', 'guardians', 'tigers', 'twins', 'royals', 'astros', 'rangers', 'mariners', 'angels', 'dodgers', 'padres', 'rockies', 'diamondbacks', 'braves', 'marlins', 'mets', 'phillies', 'nationals', 'pirates', 'reds', 'brewers', 'cubs',
            
            // NBA Teams (Comprehensive)
            'atlanta hawks', 'boston celtics', 'brooklyn nets', 'charlotte hornets', 'chicago bulls', 'cleveland cavaliers', 'dallas mavericks', 'denver nuggets', 'detroit pistons', 'golden state warriors', 'houston rockets', 'indiana pacers', 'los angeles clippers', 'los angeles lakers', 'memphis grizzlies', 'miami heat', 'milwaukee bucks', 'minnesota timberwolves', 'new orleans pelicans', 'new york knicks', 'oklahoma city thunder', 'orlando magic', 'philadelphia 76ers', 'phoenix suns', 'portland trail blazers', 'sacramento kings', 'san antonio spurs', 'toronto raptors', 'utah jazz', 'washington wizards', '76ers', 'trail blazers',
            'lakers', 'warriors', 'celtics', 'heat', 'knicks', 'nets', 'raptors', '76ers', 'hawks', 'hornets', 'wizards', 'magic', 'pacers', 'bucks', 'cavaliers', 'pistons', 'rockets', 'mavericks', 'spurs', 'grizzlies', 'pelicans', 'thunder', 'jazz', 'nuggets', 'timberwolves', 'trail blazers', 'kings', 'suns', 'clippers', 'bulls',
            
            // NHL Teams (Comprehensive)
            'anaheim ducks', 'arizona coyotes', 'boston bruins', 'buffalo sabres', 'calgary flames', 'carolina hurricanes', 'chicago blackhawks', 'colorado avalanche', 'columbus blue jackets', 'dallas stars', 'detroit red wings', 'edmonton oilers', 'florida panthers', 'los angeles kings', 'minnesota wild', 'montreal canadiens', 'nashville predators', 'new jersey devils', 'new york islanders', 'new york rangers', 'ottawa senators', 'philadelphia flyers', 'pittsburgh penguins', 'san jose sharks', 'seattle kraken', 'st. louis blues', 'tampa bay lightning', 'toronto maple leafs', 'vancouver canucks', 'vegas golden knights', 'washington capitals', 'winnipeg jets', 'blackhawks', 'blue jackets', 'red wings', 'maple leafs', 'golden knights',
            'red wings', 'blackhawks', 'bruins', 'rangers', 'maple leafs', 'canadiens', 'senators', 'sabres', 'lightning', 'capitals', 'flyers', 'devils', 'islanders', 'penguins', 'blue jackets', 'hurricanes', 'predators', 'blues', 'wild', 'avalanche', 'stars', 'oilers', 'flames', 'canucks', 'sharks', 'ducks', 'golden knights', 'coyotes', 'jets', 'kraken',
            
            // College Teams (Comprehensive)
            'duke', 'blue devils', 'tar heels', 'wolfpack', 'demon deacons', 'seminoles', 'hurricanes', 'gators', 'bulldogs', 'tigers', 'wildcats', 'cardinals', 'eagles', 'hawks', 'panthers', 'cavaliers', 'hokies', 'orange', 'syracuse', 'connecticut', 'uconn', 'villanova', 'georgetown', 'providence', 'seton hall', 'creighton', 'butler', 'depaul', 'marquette', 'st johns', 'kansas', 'kentucky', 'north carolina', 'arizona', 'ucla', 'usc', 'stanford', 'california', 'oregon', 'oregon state', 'washington', 'washington state', 'colorado', 'utah', 'arizona state', 'longhorns', 'rockies',
            'duke', 'blue devils', 'tar heels', 'wolfpack', 'demon deacons', 'seminoles', 'hurricanes', 'gators', 'bulldogs', 'wildcats', 'hokies', 'orange', 'syracuse', 'connecticut', 'uconn', 'villanova', 'georgetown', 'providence', 'seton hall', 'creighton', 'butler', 'depaul', 'marquette', 'st johns', 'kansas', 'kentucky', 'north carolina', 'arizona', 'ucla', 'usc', 'stanford', 'california', 'oregon', 'oregon state', 'washington', 'washington state', 'colorado', 'utah', 'arizona state', 'minnesota', 'longhorns', 'texas longhorns', 'trojans',
            
            // Soccer Teams and Tournaments (Comprehensive)
            'liverpool', 'manchester united', 'manchester city', 'arsenal', 'chelsea', 'tottenham', 'barcelona', 'real madrid', 'bayern munich', 'psg', 'juventus', 'ac milan', 'inter milan', 'ajax', 'porto', 'benfica', 'celtic', 'rangers', 'fc', 'united', 'city', 'athletic', 'sporting', 'dynamo', 'spartak', 'zenit',
            'liverpool', 'manchester united', 'manchester city', 'arsenal', 'chelsea', 'tottenham', 'barcelona', 'real madrid', 'bayern munich', 'psg', 'juventus', 'ac milan', 'inter milan', 'ajax', 'porto', 'benfica', 'celtic', 'rangers', 'fc', 'united', 'city', 'athletic', 'sporting', 'dynamo', 'spartak', 'zenit',
            // Soccer tournaments and competitions
            'copa america', 'world cup', 'uefa', 'champions league', 'premier league', 'la liga', 'serie a', 'bundesliga', 'ligue 1', 'mls', 'conmebol',
            
            // City Names (Comprehensive)
            'new york', 'los angeles', 'chicago', 'houston', 'phoenix', 'philadelphia', 'san antonio', 'san diego', 'dallas', 'san jose', 'austin', 'jacksonville', 'fort worth', 'columbus', 'charlotte', 'san francisco', 'indianapolis', 'seattle', 'denver', 'washington', 'boston', 'el paso', 'nashville', 'detroit', 'oklahoma city', 'portland', 'las vegas', 'memphis', 'louisville', 'baltimore', 'milwaukee', 'albuquerque', 'tucson', 'fresno', 'sacramento', 'atlanta', 'long beach', 'colorado springs', 'miami', 'virginia beach', 'omaha', 'oakland', 'minneapolis', 'tulsa', 'arlington', 'tampa', 'new orleans', 'wichita', 'cleveland', 'bakersfield', 'aurora', 'anaheim', 'honolulu', 'santa ana', 'corpus christi', 'riverside', 'lexington', 'stockton', 'henderson', 'saint paul', 'st. louis', 'st louis', 'fort wayne', 'jersey city', 'chula vista', 'orlando', 'chandler', 'laredo', 'norfolk', 'lubbock', 'madison', 'durham', 'garland', 'glendale', 'hialeah', 'reno', 'baton rouge', 'irvine', 'chesapeake', 'irving', 'scottsdale', 'north las vegas', 'fremont', 'gilbert', 'san bernardino', 'boise', 'birmingham', 'rochester', 'spokane', 'montgomery', 'des moines', 'modesto', 'fayetteville', 'tacoma', 'shreveport', 'fontana', 'oxnard', 'aurora', 'moreno valley', 'yuma', 'glendale', 'huntington beach', 'mckinney', 'montgomery', 'augusta', 'columbus', 'amarillo', 'little rock', 'akron', 'durham', 'worcester', 'mesa', 'colorado springs', 'springfield', 'grand rapids', 'overland park', 'billings', 'salem', 'baton rouge', 'dayton', 'provo', 'sioux falls', 'waco', 'lakewood', 'chandler', 'paso', 'mckinney', 'laredo', 'durham', 'lewisville', 'chandler', 'glendale', 'gilbert', 'rochester', 'scottsdale', 'norfolk', 'chesapeake', 'garland', 'irving', 'north las vegas', 'fremont', 'irvine', 'san bernardino', 'birmingham', 'spokane', 'rochester', 'montgomery', 'des moines', 'modesto', 'fayetteville', 'tacoma', 'shreveport', 'fontana', 'oxnard', 'moreno valley', 'yuma', 'huntington beach', 'augusta', 'amarillo', 'little rock', 'akron', 'worcester', 'springfield', 'grand rapids', 'overland park', 'billings', 'salem', 'dayton', 'provo', 'sioux falls', 'waco', 'lakewood', 'lewisville',
            'chicago', 'denver', 'houston', 'miami', 'philadelphia', 'detroit', 'los angeles', 'texas', 'montana', 'boston', 'new york', 'atlanta', 'dallas', 'seattle', 'portland', 'minneapolis', 'milwaukee', 'cleveland', 'cincinnati', 'pittsburgh', 'buffalo', 'baltimore', 'washington', 'orlando', 'tampa', 'jacksonville', 'nashville', 'memphis', 'new orleans', 'oklahoma', 'kansas city', 'las vegas', 'phoenix', 'san diego', 'san francisco', 'oakland', 'sacramento', 'salt lake', 'st louis',
            
            // League abbreviations
            'nfl', 'mlb', 'nba', 'nhl', 'ufc', 'mma', 'mixed martial arts', 'octagon', 'fighter', 'fighting', 'wwe', 'nascar', 'indycar', 'indy', 'f1', 'formula 1', 'formula1', 'wrestling', 'pokemon', 'wnba', 'usa basketball', 'usa football', 'usa baseball', 'golf', 'racing', 'olympics', 'championship', 'tournament', 'league',
            
            // Additional terms
            'signatures', 'wings', 'case hit', 'cb-mns', 'mvp', 'hof', 'debut',
            
                         // Additional Team Terms from 4+ Word Analysis
             'new england', 'jays', 'deebo samuel', 'muhammad ali', 'cassius clay', 'brilliant'
        ];

        // Grading terms - Updated with comprehensive list
        this.gradingTerms = [
            'psa', 'bgs', 'beckett', 'gem', 'mint', 'near mint', 'excellent', 'very good', 'good', 'fair', 'poor', 'gem mint', 'mt',
            '10', '9', '8', '7', '6', '5', '4', '3', '2', '1', 'gem mint', 'psa 10', 'psa9', 'psa8', 'psa7', 'psa6', 'psa5', 'psa4', 'psa3', 'psa2', 'psa1', 'sgc', 'csg', 'hga', 'gma', 'graded', 'ungraded', 'pop', 'pop report', 'cert', 'certificate', 'population',
            // eBay listing terms
            'read', 'case hit', 'ssp', 'hit'
        ];
    }

    // Remove years (19xx or 20xx)
    removeYear(title) {
        return title.replace(/\b(19|20)\d{2}\b/g, ' ');
    }

    // Remove card set terms
    removeCardSetTerms(title) {
        let cleaned = title;
        this.cardSetTerms.forEach(term => {
            const regex = new RegExp(`\\b${term}\\b`, 'gi');
            cleaned = cleaned.replace(regex, ' ');
        });
        return cleaned;
    }

    // Remove card type terms
    removeCardTypeTerms(title) {
        let cleaned = title;
        this.cardTypeTerms.forEach(term => {
            const regex = new RegExp(`\\b${term}\\b`, 'gi');
            cleaned = cleaned.replace(regex, ' ');
        });
        return cleaned;
    }

    // Remove team, league, city, and sport terms
    removeTeamLeagueCityTerms(title) {
        let cleaned = title;
        this.teamLeagueCityTerms.forEach(term => {
            const regex = new RegExp(`\\b${term}\\b`, 'gi');
            cleaned = cleaned.replace(regex, ' ');
        });
        return cleaned;
    }

    // Remove grading terms
    removeGradingTerms(title) {
        let cleaned = title;
        this.gradingTerms.forEach(term => {
            const regex = new RegExp(`\\b${term}\\b`, 'gi');
            cleaned = cleaned.replace(regex, ' ');
        });
        return cleaned;
    }

         // Remove special characters that shouldn't be in player names
     removeSpecialCharacters(title) {
         return title
             .replace(/\bQ\d+\b/g, ' ') // Remove PSA cert numbers like Q4078
             .replace(/\b\d{1,2}[A-Z]\b/g, ' ') // Remove cert codes like 10A
             .replace(/[()\[\]{}]/g, ' ') // Remove parentheses and brackets
             .replace(/[-–—]/g, ' ') // Remove hyphens and dashes
             .replace(/[''′]/g, ' ') // Remove apostrophes and similar characters
             .replace(/[čć]/g, 'c') // Replace special c characters with regular c
             .replace(/[^\w\s]/g, ' ') // Remove any other non-word, non-space characters
             .replace(/[\u{1F600}-\u{1F64F}]/gu, ' ') // Remove emojis (Unicode ranges for emojis)
             .replace(/[\u{1F300}-\u{1F5FF}]/gu, ' ') // Remove miscellaneous symbols and pictographs
             .replace(/[\u{1F680}-\u{1F6FF}]/gu, ' ') // Remove transport and map symbols
             .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, ' ') // Remove regional indicator symbols
             .replace(/[\u{2600}-\u{26FF}]/gu, ' ') // Remove miscellaneous symbols
             .replace(/[\u{2700}-\u{27BF}]/gu, ' ') // Remove dingbats
             .replace(/\b\s*s\s*\b/g, ' ') // Remove standalone 's' characters (from apostrophe-s)
             .replace(/\b\s*o\s*\b/g, ' ') // Remove standalone 'o' characters (from O's)
             .replace(/\bs\b/g, ' ') // Remove standalone 's' characters (from apostrophe-s)
                         .replace(/\bo\b/g, ' ') // Remove standalone 'o' characters (from O's)
             .replace(/\bS\b/g, ' ') // Remove standalone 'S' characters (from apostrophe-S)
             .replace(/\s+/g, ' ') // Normalize spaces
             .trim();
     }

     // Handle dual player cards and complex patterns
     removeDualPlayerPatterns(title) {
         return title
             // Remove dual player patterns (keep first player)
             .replace(/\b(Brock Purdy)\s+(Deebo Samuel)\b/gi, '$1')
             .replace(/\b(Kobe Bryant)\s+(Michael Jordan)\s+(East West)\b/gi, '$1')
             .replace(/\b(Cassius Clay)\s+(World Champion Boxers)\s+(Muhammad Ali)\b/gi, '$3')
             .replace(/\b(Randy Moss)\s+(Helmet Heroes)\s+(hh)\b/gi, '$1')
             .replace(/\b(Patrick Mahomes II)\s+(Big Man on Campus)\b/gi, '$1')
             // Remove "One One" pattern
             .replace(/\bOne\s+One\b/gi, ' ')
             // Remove "E X2001" pattern
             .replace(/\bE\s+X2001\b/gi, ' ')
                           // Remove "East West" pattern
              .replace(/\bEast\s+West\b/gi, ' ')
              // Remove "Slania Stamps" pattern
              .replace(/\b(Slania Stamps)\s+(Cassius Clay)\s+(World Champion Boxers)\s+(Muhammad Ali)\b/gi, 'Muhammad Ali')
              // Remove "Kobe Bryant Michael Jordan East West" pattern
              .replace(/\b(Kobe Bryant)\s*[-]?\s*(Michael Jordan)\s*[-]?\s*(East West)\b/gi, '$1')
              // Remove "P P" pattern
              .replace(/\bP\s+P\b/gi, ' ')
             .replace(/\s+/g, ' ') // Normalize spaces
             .trim();
     }

         // Remove card numbers and patterns
     removeCardNumbers(title) {
         return title
             .replace(/#\d+/g, ' ') // #123, #456, etc.
             .replace(/#[A-Za-z]+[-\dA-Za-z]*/g, ' ') // #BDC-168, #CDA-LK, etc.
             .replace(/#\d+[A-Za-z]+[-\dA-Za-z]*/g, ' ') // #74TF-1, etc.
             .replace(/#\d+[A-Za-z]+\d+[-\dA-Za-z]*/g, ' ') // #74TF-1, etc.
             .replace(/#\d+[A-Za-z]+[-\d]*/g, ' ') // #74TF-1, etc. (simpler pattern)
             .replace(/#74TF-\d+/g, ' ') // Specific pattern for #74TF-1
             .replace(/\bTF\b/g, ' ') // Remove standalone TF
             .replace(/#[A-Za-z]+\d+[-\dA-Za-z]*/g, ' ') // #CPA-WJ, etc.
             .replace(/\b(BD[A-Z]?\d+)\b/g, ' ') // BDP123, BDC456, etc.
             .replace(/\b(CB-[A-Z]+)\b/g, ' ') // CB-MNS, etc.
             .replace(/\b(CDA-[A-Z]+)\b/g, ' ') // CDA-LK, etc.
             .replace(/\b(CRA-[A-Z]+)\b/g, ' ') // CRA-AJ, CRA-BP, etc.
                           .replace(/\b(CPA-[A-Z]+)\b/g, ' ') // CPA-CJ, CPA-WJ, etc.
             .replace(/\b([A-Z]{2,}\d+)\b/g, ' ') // DT36, DT1, etc.
             .replace(/\b(BS\d+)\b/g, ' ') // BS3, BS5, etc.
             .replace(/\b(TC\d+)\b/g, ' ') // TC264, etc.
             .replace(/\b(MMR-\d+)\b/g, ' ') // MMR-54, etc.
             .replace(/\b(DT\d+)\b/g, ' ') // DT36, etc.
             .replace(/\b(SJMC)\b/g, ' ') // SJMC
             .replace(/\d+\/\d+/g, ' ') // /499, /99, /150, etc.
             .replace(/\b\d+\b/g, ' ') // Standalone numbers
             .replace(/#/g, ' ') // Remove any remaining # symbols
             .replace(/\//g, ' '); // Remove any remaining / symbols
     }

     // Restore apostrophes and hyphens in player names
     restorePunctuation(title) {
         return title
             // Restore apostrophes in common patterns
             .replace(/\bDe\s+Von\b/gi, 'De\'Von')
             .replace(/\bJa\s+Marr\b/gi, 'Ja\'Marr')
             .replace(/\bLogan\s+O\s+Hoppe\b/gi, 'Logan O\'Hoppe')
             .replace(/\bRyan\s+O\s+Hearn\b/gi, 'Ryan O\'Hearn')
             .replace(/\bO\s+Hearn\b/gi, 'O\'Hearn')
             .replace(/\bO\s+Hoppe\b/gi, 'O\'Hoppe')
             
             // Restore periods in initials
             .replace(/\bJ\s+J\b/gi, 'J.J.')
             .replace(/\bT\s+J\b/gi, 'T.J.')
             
             // Restore "De La" in names
             .replace(/\bElly\s+De\s+Cruz\b/gi, 'Elly De La Cruz')
             
             // Restore hyphens in compound names
             .replace(/\bPete\s+Crow\s+Armstrong\b/gi, 'Pete Crow-Armstrong')
             .replace(/\bShai\s+Gilgeous\s+Alexander\b/gi, 'Shai Gilgeous-Alexander')
             .replace(/\bJaxon\s+Smith\s+Njigba\b/gi, 'Jaxon Smith-Njigba')
             .replace(/\bJosh\s+Kuroda\s+Grauer\b/gi, 'Josh Kuroda-Grauer')
             
             // Remove standalone "O" from "O's" issue
             .replace(/\bO\s*$/gi, '')
             
             // Normalize spaces
             .replace(/\s+/g, ' ')
             .trim();
     }

     // Normalize capitalization in player names
     normalizeCapitalization(title) {
         return title
             // Convert all caps to proper case
             .replace(/\b([A-Z])([A-Z]+)\b/g, (match, first, rest) => {
                 // Keep common abbreviations in caps
                 if (['JR', 'SR', 'II', 'III', 'IV'].includes(match)) {
                     return match;
                 }
                 // Convert to proper case
                 return first + rest.toLowerCase();
             })
             // Handle special cases for proper names
             .replace(/\bMc([a-z])/g, (match, letter) => 'Mc' + letter.toUpperCase())
             .replace(/\bMac([a-z])/g, (match, letter) => 'Mac' + letter.toUpperCase())
             .replace(/\bO\'([a-z])/g, (match, letter) => 'O\'' + letter.toUpperCase())
             .replace(/\bDe\'([a-z])/g, (match, letter) => 'De\'' + letter.toUpperCase())
             .replace(/\bVan\s+([a-z])/g, (match, letter) => 'Van ' + letter.toUpperCase())
             .replace(/\bVon\s+([a-z])/g, (match, letter) => 'Von ' + letter.toUpperCase());
     }

    // Main extraction function - ONLY the 6 steps you requested
    extractPlayerName(title) {
        console.log(`\n🔍 Extracting player name from: "${title}"`);
        
        // Step 1: Remove year
        let cleaned = this.removeYear(title);
        console.log(`   After removing year: "${cleaned}"`);
        
        // Step 2: Remove card set terms
        cleaned = this.removeCardSetTerms(cleaned);
        console.log(`   After removing card set terms: "${cleaned}"`);
        
        // Step 3: Remove card type terms
        cleaned = this.removeCardTypeTerms(cleaned);
        console.log(`   After removing card type terms: "${cleaned}"`);
        
        // Step 4: Remove team, league, city, and sport terms
        cleaned = this.removeTeamLeagueCityTerms(cleaned);
        console.log(`   After removing team/league/city terms: "${cleaned}"`);
        
        // Step 4.5: Handle dual player patterns and complex cases (BEFORE removing team terms)
        cleaned = this.removeDualPlayerPatterns(cleaned);
        console.log(`   After removing dual player patterns: "${cleaned}"`);
        
        // Step 5: Remove grading terms
        cleaned = this.removeGradingTerms(cleaned);
        console.log(`   After removing grading terms: "${cleaned}"`);
        
        // Step 6: Remove card numbers
        cleaned = this.removeCardNumbers(cleaned);
        console.log(`   After removing card numbers: "${cleaned}"`);
        
        // Step 7: Remove special characters and emojis
        cleaned = this.removeSpecialCharacters(cleaned);
        console.log(`   After removing special characters: "${cleaned}"`);
        
        // Step 8: Restore apostrophes and hyphens in player names
        cleaned = this.restorePunctuation(cleaned);
        console.log(`   After restoring punctuation: "${cleaned}"`);
        
        // Step 9: Normalize capitalization
        cleaned = this.normalizeCapitalization(cleaned);
        console.log(`   After normalizing capitalization: "${cleaned}"`);
         
         // Clean up extra spaces and return whatever is left
         const result = cleaned.replace(/\s+/g, ' ').trim();
         console.log(`   Final result: "${result}"`);
         
         return result;
    }
}

module.exports = SimplePlayerExtractor;

