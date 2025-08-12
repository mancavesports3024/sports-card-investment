// Centralized sport detection configuration
const SPORT_CONFIG = {
    football: {
        sport: 'Football',
        teams: [
            'bears', 'packers', 'cowboys', 'eagles', 'giants', 'redskins', 'commanders', 'patriots', 'steelers', '49ers',
            'seahawks', 'cardinals', 'rams', 'saints', 'buccaneers', 'falcons', 'panthers', 'vikings', 'lions', 'bills',
            'dolphins', 'jets', 'bengals', 'browns', 'ravens', 'texans', 'colts', 'jaguars', 'titans', 'broncos',
            'chargers', 'raiders', 'chiefs'
        ],
        positions: [
            'qb', 'quarterback', 'running back', 'wide receiver', 'tight end', 'defensive', 'linebacker',
            'cornerback', 'safety', 'defensive end', 'defensive tackle', 'offensive line', 'kicker', 'punter'
        ],
        players: [
            'patrick mahomes', 'josh allen', 'joe burrow', 'justin herbert', 'lamar jackson', 'jalen hurts',
            'dak prescott', 'aaron rodgers', 'tom brady', 'christian mccaffrey', 'saquon barkley', 'derrick henry',
            'tyreek hill', 'justin jefferson', 'jamarr chase', 'stefon diggs', 'davante adams', 'cooper kupp',
            'caleb williams', 'drake maye', 'bo nix', 'jayden daniels', 'michael penix', 'jj mccarthy',
            'bryce young', 'rome odunze', 'marvin harrison', 'blake corum', 'bijan robinson', 'rashee rice',
            'brock bowers', 'trevor lawrence', 'myles garrett'
        ],
        terms: ['football', 'nfl', 'college football', 'ncaa football']
    },
    
    basketball: {
        sport: 'Basketball',
        teams: [
            'lakers', 'celtics', 'bulls', 'warriors', 'heat', 'knicks', 'nets', 'raptors', '76ers', 'hawks',
            'hornets', 'wizards', 'magic', 'pacers', 'bucks', 'cavaliers', 'pistons', 'rockets', 'mavericks',
            'spurs', 'grizzlies', 'pelicans', 'thunder', 'jazz', 'nuggets', 'timberwolves', 'trail blazers',
            'kings', 'suns', 'clippers'
        ],
        positions: [
            'point guard', 'shooting guard', 'small forward', 'power forward', 'center', 'forward', 'guard'
        ],
        players: [
            'lebron james', 'stephen curry', 'kevin durant', 'giannis', 'nikola jokic', 'joel embiid',
            'luka doncic', 'ja morant', 'zion williamson', 'anthony edwards', 'lamelo ball', 'cade cunningham',
            'paolo banchero', 'chet holmgren', 'victor wembanyama', 'scoot henderson', 'domantas sabonis',
            'caitlin clark', 'brock purdy', 'rj barrett', 'sabrina ionescu', 'stephon castle'
        ],
        terms: ['basketball', 'nba', 'college basketball', 'ncaa basketball', 'wnba']
    },
    
    baseball: {
        sport: 'Baseball',
        teams: [
            'yankees', 'red sox', 'blue jays', 'orioles', 'rays', 'white sox', 'indians', 'guardians',
            'tigers', 'twins', 'royals', 'astros', 'rangers', 'athletics', 'mariners', 'angels', 'dodgers',
            'giants', 'padres', 'rockies', 'diamondbacks', 'braves', 'marlins', 'mets', 'phillies',
            'nationals', 'pirates', 'reds', 'brewers', 'cubs', 'cardinals'
        ],
        positions: [
            'pitcher', 'hitter', 'outfielder', 'infielder', 'catcher', 'shortstop', 'first base',
            'second base', 'third base', 'designated hitter', 'dh'
        ],
        players: [
            'mike trout', 'aaron judge', 'shohei ohtani', 'ronald acuna', 'mookie betts', 'freddie freeman',
            'juan soto', 'yordan alvarez', 'kyle tucker', 'jose altuve', 'alex bregman', 'carlos correa',
            'fernando tatis', 'machado', 'xander bogaerts', 'rafael devers', 'vladimir guerrero', 'bo bichette',
            'julio rodriguez', 'adley rutschman', 'gunnar henderson', 'elly de la cruz', 'jackson holliday',
            'wyatt flores', 'paul skenes', 'jackson chourio', 'jordan lawlar', 'junior caminero'
        ],
        terms: ['baseball', 'mlb', 'college baseball', 'ncaa baseball']
    },
    
    hockey: {
        sport: 'Hockey',
        teams: [
            'red wings', 'blackhawks', 'bruins', 'rangers', 'maple leafs', 'canadiens', 'senators', 'sabres',
            'panthers', 'lightning', 'capitals', 'flyers', 'devils', 'islanders', 'penguins', 'blue jackets',
            'hurricanes', 'predators', 'blues', 'wild', 'avalanche', 'stars', 'oilers', 'flames', 'canucks',
            'sharks', 'ducks', 'golden knights', 'kings', 'coyotes', 'jets', 'kraken'
        ],
        positions: [
            'goalie', 'goaltender', 'defenseman', 'forward', 'center', 'left wing', 'right wing'
        ],
        players: [
            'auston matthews', 'connor mcdavid', 'leon draisaitl', 'nathan mackinnon', 'sydney crosby',
            'alex ovechkin', 'david pastrnak', 'artemi panarin', 'mikko rantanen', 'nikita kucherov',
            'steven stamkos', 'brayden point', 'victor hedman', 'roman josi', 'cale makar', 'quinn hughes',
            'adam fox', 'morgan rielly', 'jake guentzel', 'mitch marner', 'william nylander'
        ],
        terms: ['hockey', 'nhl', 'college hockey', 'ncaa hockey']
    },
    
    soccer: {
        sport: 'Soccer',
        teams: [
            'manchester united', 'manchester city', 'barcelona', 'real madrid', 'bayern munich', 'psg',
            'liverpool', 'chelsea', 'arsenal', 'tottenham', 'juventus', 'ac milan', 'inter milan'
        ],
        players: [
            'lionel messi', 'cristiano ronaldo', 'kylian mbappe', 'erling haaland', 'kevin de bruyne',
            'luka modric', 'toni kroos', 'virgil van dijk', 'mohamed salah', 'sadio mane', 'robert lewandowski'
        ],
        terms: ['soccer', 'fifa', 'premier league', 'la liga', 'bundesliga', 'serie a', 'champions league']
    },
    
    golf: {
        sport: 'Golf',
        players: [
            'tiger woods', 'rory mcilroy', 'brooks koepka', 'jon rahm', 'scottie scheffler', 'jordan spieth',
            'justin thomas', 'collin morikawa', 'viktor hovland', 'patrick cantlay', 'xander schauffele',
            'sam burns', 'cameron young', 'sahith theegala', 'ludvig aberg', 'nick dunlap'
        ],
        tournaments: [
            'masters', 'us open', 'pga championship', 'open championship', 'ryder cup', 'presidents cup'
        ],
        terms: ['golf', 'liv golf', 'pga', 'pga tour', 'liv tour']
    },
    
    racing: {
        sport: 'Racing',
        players: [
            'max verstappen', 'lewis hamilton', 'charles leclerc', 'lando norris', 'carlos sainz',
            'george russell', 'fernando alonso', 'sergio perez', 'valtteri bottas', 'daniel ricciardo'
        ],
        terms: ['f1', 'formula 1', 'racing', 'grand prix', 'mclaren', 'ferrari', 'mercedes', 'red bull']
    },
    
    wrestling: {
        sport: 'Wrestling',
        terms: ['wwe', 'wrestling', 'wrestler', 'aew', 'impact wrestling']
    },
    
    pokemon: {
        sport: 'Pokemon',
        terms: ['pokemon', 'pikachu', 'charizard', 'moltres', 'zapdos', 'articuno', 'gx', 'sm210']
    },
    
    yugioh: {
        sport: 'Yu-Gi-Oh',
        terms: ['yugioh', 'yu-gi-oh']
    },
    
    magic: {
        sport: 'Magic',
        terms: ['magic the gathering', 'mtg']
    }
};

// Team names for summary title cleaning (all sports combined)
const TEAM_NAMES_FOR_CLEANING = [
    // NBA teams
    'lakers', 'warriors', 'celtics', 'heat', 'knicks', 'nets', 'raptors', '76ers', 'hawks', 'hornets', 
    'wizards', 'magic', 'pacers', 'bucks', 'cavaliers', 'pistons', 'rockets', 'mavericks', 'spurs', 
    'grizzlies', 'pelicans', 'thunder', 'jazz', 'nuggets', 'timberwolves', 'trail blazers', 'kings', 
    'suns', 'clippers', 'bulls',
    
    // NFL teams
    'cowboys', 'eagles', 'giants', 'redskins', 'commanders', 'bears', 'packers', 'vikings', 'lions', 
    'falcons', 'panthers', 'saints', 'buccaneers', 'rams', '49ers', 'seahawks', 'cardinals', 'jets', 
    'patriots', 'bills', 'dolphins', 'bengals', 'browns', 'steelers', 'ravens', 'texans', 'colts', 
    'jaguars', 'titans', 'broncos', 'chargers', 'raiders', 'chiefs',
    
    // MLB teams
    'yankees', 'red sox', 'blue jays', 'orioles', 'rays', 'white sox', 'indians', 'guardians', 'tigers', 
    'twins', 'royals', 'astros', 'rangers', 'athletics', 'mariners', 'angels', 'dodgers', 'giants', 
    'padres', 'rockies', 'diamondbacks', 'braves', 'marlins', 'mets', 'phillies', 'nationals', 'pirates', 
    'reds', 'brewers', 'cubs', 'cardinals',
    
    // NHL teams
    'red wings', 'blackhawks', 'bruins', 'rangers', 'maple leafs', 'canadiens', 'senators', 'sabres', 
    'panthers', 'lightning', 'capitals', 'flyers', 'devils', 'islanders', 'penguins', 'blue jackets', 
    'hurricanes', 'predators', 'blues', 'wild', 'avalanche', 'stars', 'oilers', 'flames', 'canucks', 
    'sharks', 'ducks', 'golden knights', 'kings', 'coyotes', 'jets', 'kraken'
];

// Card sets/terms for player name extraction
const CARD_SETS_FOR_CLEANING = [
    'topps', 'panini', 'donruss', 'bowman', 'chrome', 'prizm', 'optic', 'mosaic', 'select', 'heritage',
    'stadium club', 'allen & ginter', 'gypsy queen', 'finest', 'fire', 'opening day', 'big league',
    'immaculate', 'national treasures', 'flawless', 'obsidian', 'chronicles', 'contenders', 'international'
];

module.exports = {
    SPORT_CONFIG,
    TEAM_NAMES_FOR_CLEANING,
    CARD_SETS_FOR_CLEANING
};
