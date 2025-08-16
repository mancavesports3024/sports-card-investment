const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { DatabaseDrivenStandardizedTitleGenerator } = require('./generate-standardized-summary-titles-database-driven.js');

class SummaryComponentsImprover {
    constructor() {
        this.dbPath = process.env.RAILWAY_VOLUME_MOUNT_PATH 
            ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'new-scorecard.db')
            : path.join(__dirname, 'data', 'new-scorecard.db');
        
        this.db = null;
        this.titleGenerator = new DatabaseDrivenStandardizedTitleGenerator();
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

    async runUpdate(query, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(query, params, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ changes: this.changes, lastID: this.lastID });
                }
            });
        });
    }

    // Enhanced card type extraction
    extractEnhancedCardType(title, existingCardType) {
        if (existingCardType && existingCardType !== 'NULL' && existingCardType !== '') {
            return existingCardType;
        }

        const titleLower = title.toLowerCase();
        let cardType = '';

        // Enhanced color/parallel patterns
        const colorPatterns = [
            // Basic colors
            { pattern: /\b(red|blue|green|yellow|orange|purple|pink|gold|silver|bronze|black|white)\b/gi, name: 'Color' },
            // Refractors
            { pattern: /\b(refractor|refractors)\b/gi, name: 'Refractor' },
            // Prizm variants
            { pattern: /\b(prizm|prizmatic)\b/gi, name: 'Prizm' },
            // Holo variants
            { pattern: /\b(holo|holographic)\b/gi, name: 'Holo' },
            // Wave variants
            { pattern: /\b(wave)\b/gi, name: 'Wave' },
            // Scope variants
            { pattern: /\b(scope)\b/gi, name: 'Scope' },
            // Shock variants
            { pattern: /\b(shock)\b/gi, name: 'Shock' },
            // Mojo variants
            { pattern: /\b(mojo)\b/gi, name: 'Mojo' },
            // Sapphire variants
            { pattern: /\b(sapphire)\b/gi, name: 'Sapphire' },
            // Chrome variants
            { pattern: /\b(chrome)\b/gi, name: 'Chrome' },
            // X-Fractor
            { pattern: /\b(x-fractor|x-fractors)\b/gi, name: 'X-Fractor' },
            // Cracked Ice
            { pattern: /\b(cracked ice)\b/gi, name: 'Cracked Ice' },
            // Stained Glass
            { pattern: /\b(stained glass)\b/gi, name: 'Stained Glass' },
            // Lava variants
            { pattern: /\b(lava)\b/gi, name: 'Lava' },
            // Tectonic
            { pattern: /\b(tectonic)\b/gi, name: 'Tectonic' },
            // Reactive
            { pattern: /\b(reactive)\b/gi, name: 'Reactive' },
            // Fluorescent
            { pattern: /\b(fluorescent)\b/gi, name: 'Fluorescent' },
            // Swirl
            { pattern: /\b(swirl)\b/gi, name: 'Swirl' },
            // Fusion
            { pattern: /\b(fusion)\b/gi, name: 'Fusion' },
            // Nebula
            { pattern: /\b(nebula)\b/gi, name: 'Nebula' },
            // Choice
            { pattern: /\b(choice)\b/gi, name: 'Choice' },
            // Fast Break
            { pattern: /\b(fast break)\b/gi, name: 'Fast Break' },
            // Genesis
            { pattern: /\b(genesis)\b/gi, name: 'Genesis' },
            // Premier
            { pattern: /\b(premier)\b/gi, name: 'Premier' },
            // Level
            { pattern: /\b(level)\b/gi, name: 'Level' },
            // Club
            { pattern: /\b(club)\b/gi, name: 'Club' },
            // Flashback
            { pattern: /\b(flashback)\b/gi, name: 'Flashback' },
            // Emergent
            { pattern: /\b(emergent)\b/gi, name: 'Emergent' },
            // Real One
            { pattern: /\b(real one)\b/gi, name: 'Real One' },
            // RPA
            { pattern: /\b(rpa)\b/gi, name: 'RPA' },
            // Ink variants
            { pattern: /\b(red ink|blue ink|green ink|purple ink)\b/gi, name: 'Ink' },
            // Mania
            { pattern: /\b(mania)\b/gi, name: 'Mania' },
            // WWE variants
            { pattern: /\b(wwe)\b/gi, name: 'WWE' },
            // Geometric
            { pattern: /\b(geometric)\b/gi, name: 'Geometric' },
            // Honeycomb
            { pattern: /\b(honeycomb)\b/gi, name: 'Honeycomb' },
            // Pride
            { pattern: /\b(pride)\b/gi, name: 'Pride' },
            // Kaleidoscopic
            { pattern: /\b(kaleidoscopic)\b/gi, name: 'Kaleidoscopic' },
            // Alligator variants
            { pattern: /\b(alligator)\b/gi, name: 'Alligator' },
            // Butterfly variants
            { pattern: /\b(butterfly)\b/gi, name: 'Butterfly' },
            // Chameleon variants
            { pattern: /\b(chameleon)\b/gi, name: 'Chameleon' },
            // Clown Fish variants
            { pattern: /\b(clown fish)\b/gi, name: 'Clown Fish' },
            // Deer variants
            { pattern: /\b(deer)\b/gi, name: 'Deer' },
            // Dragon variants
            { pattern: /\b(dragon)\b/gi, name: 'Dragon' },
            // Elephant variants
            { pattern: /\b(elephant)\b/gi, name: 'Elephant' },
            // Giraffe variants
            { pattern: /\b(giraffe)\b/gi, name: 'Giraffe' },
            // Leopard variants
            { pattern: /\b(leopard)\b/gi, name: 'Leopard' },
            // Parrot variants
            { pattern: /\b(parrot)\b/gi, name: 'Parrot' },
            // Peacock variants
            { pattern: /\b(peacock)\b/gi, name: 'Peacock' },
            // Snake variants
            { pattern: /\b(snake)\b/gi, name: 'Snake' },
            // Tiger variants
            { pattern: /\b(tiger)\b/gi, name: 'Tiger' },
            // Zebra variants
            { pattern: /\b(zebra)\b/gi, name: 'Zebra' },
            // Eyes variants
            { pattern: /\b(tiger eyes|snake eyes)\b/gi, name: 'Eyes' },
            // Anniversary
            { pattern: /\b(anniversary)\b/gi, name: 'Anniversary' },
            // Border variants
            { pattern: /\b(border)\b/gi, name: 'Border' },
            // Flip Stock
            { pattern: /\b(flip stock)\b/gi, name: 'Flip Stock' },
            // Magenta
            { pattern: /\b(magenta)\b/gi, name: 'Magenta' },
            // Mini Parallels
            { pattern: /\b(mini parallels)\b/gi, name: 'Mini Parallels' },
            // Superfractor
            { pattern: /\b(superfractor)\b/gi, name: 'Superfractor' },
            // Scale variants
            { pattern: /\b(dragon scale)\b/gi, name: 'Dragon Scale' },
            // Vintage
            { pattern: /\b(vintage)\b/gi, name: 'Vintage' },
            // Stars
            { pattern: /\b(stars)\b/gi, name: 'Stars' },
            // Independence Day
            { pattern: /\b(independence day)\b/gi, name: 'Independence Day' },
            // Father's Day
            { pattern: /\b(father's day)\b/gi, name: 'Father\'s Day' },
            // Mother's Day
            { pattern: /\b(mother's day)\b/gi, name: 'Mother\'s Day' },
            // Memorial Day
            { pattern: /\b(memorial day)\b/gi, name: 'Memorial Day' },
            // Camo
            { pattern: /\b(camo)\b/gi, name: 'Camo' },
            // Vinyl
            { pattern: /\b(vinyl)\b/gi, name: 'Vinyl' },
            // Premium Set
            { pattern: /\b(premium set)\b/gi, name: 'Premium Set' },
            // Checkerboard
            { pattern: /\b(checkerboard)\b/gi, name: 'Checkerboard' },
            // Die-cut
            { pattern: /\b(die-cut|die cut)\b/gi, name: 'Die-Cut' },
            // National Landmarks
            { pattern: /\b(national landmarks)\b/gi, name: 'National Landmarks' },
            // Lava Lamp
            { pattern: /\b(lava lamp)\b/gi, name: 'Lava Lamp' },
            // Dazzle
            { pattern: /\b(dazzle)\b/gi, name: 'Dazzle' },
            // Velocity
            { pattern: /\b(velocity)\b/gi, name: 'Velocity' },
            // Hyper
            { pattern: /\b(hyper)\b/gi, name: 'Hyper' },
            // Dragon
            { pattern: /\b(dragon)\b/gi, name: 'Dragon' },
            // Laser
            { pattern: /\b(laser)\b/gi, name: 'Laser' },
            // Liberty
            { pattern: /\b(liberty)\b/gi, name: 'Liberty' },
            // Marvels
            { pattern: /\b(marvels)\b/gi, name: 'Marvels' },
            // Fire
            { pattern: /\b(fire)\b/gi, name: 'Fire' },
            // Voltage
            { pattern: /\b(voltage)\b/gi, name: 'Voltage' },
            // Career Stat Line
            { pattern: /\b(career stat line)\b/gi, name: 'Career Stat Line' },
            // Alligator Crystal
            { pattern: /\b(alligator crystal)\b/gi, name: 'Alligator Crystal' },
            // Alligator Kaleidoscope
            { pattern: /\b(alligator kaleidoscope)\b/gi, name: 'Alligator Kaleidoscope' },
            // Alligator Mojo
            { pattern: /\b(alligator mojo)\b/gi, name: 'Alligator Mojo' },
            // Alligator Prismatic
            { pattern: /\b(alligator prismatic)\b/gi, name: 'Alligator Prismatic' },
            // Butterfly Crystal
            { pattern: /\b(butterfly crystal)\b/gi, name: 'Butterfly Crystal' },
            // Butterfly Kaleidoscope
            { pattern: /\b(butterfly kaleidoscope)\b/gi, name: 'Butterfly Kaleidoscope' },
            // Butterfly Mojo
            { pattern: /\b(butterfly mojo)\b/gi, name: 'Butterfly Mojo' },
            // Butterfly Prismatic
            { pattern: /\b(butterfly prismatic)\b/gi, name: 'Butterfly Prismatic' },
            // Chameleon Crystal
            { pattern: /\b(chameleon crystal)\b/gi, name: 'Chameleon Crystal' },
            // Chameleon Kaleidoscope
            { pattern: /\b(chameleon kaleidoscope)\b/gi, name: 'Chameleon Kaleidoscope' },
            // Chameleon Mojo
            { pattern: /\b(chameleon mojo)\b/gi, name: 'Chameleon Mojo' },
            // Chameleon Prismatic
            { pattern: /\b(chameleon prismatic)\b/gi, name: 'Chameleon Prismatic' },
            // Clown Fish Crystal
            { pattern: /\b(clown fish crystal)\b/gi, name: 'Clown Fish Crystal' },
            // Clown Fish Kaleidoscope
            { pattern: /\b(clown fish kaleidoscope)\b/gi, name: 'Clown Fish Kaleidoscope' },
            // Clown Fish Mojo
            { pattern: /\b(clown fish mojo)\b/gi, name: 'Clown Fish Mojo' },
            // Clown Fish Prismatic
            { pattern: /\b(clown fish prismatic)\b/gi, name: 'Clown Fish Prismatic' },
            // Deer Crystal
            { pattern: /\b(deer crystal)\b/gi, name: 'Deer Crystal' },
            // Deer Kaleidoscope
            { pattern: /\b(deer kaleidoscope)\b/gi, name: 'Deer Kaleidoscope' },
            // Deer Mojo
            { pattern: /\b(deer mojo)\b/gi, name: 'Deer Mojo' },
            // Deer Prismatic
            { pattern: /\b(deer prismatic)\b/gi, name: 'Deer Prismatic' },
            // Dragon Crystal
            { pattern: /\b(dragon crystal)\b/gi, name: 'Dragon Crystal' },
            // Dragon Kaleidoscope
            { pattern: /\b(dragon kaleidoscope)\b/gi, name: 'Dragon Kaleidoscope' },
            // Dragon Mojo
            { pattern: /\b(dragon mojo)\b/gi, name: 'Dragon Mojo' },
            // Dragon Prismatic
            { pattern: /\b(dragon prismatic)\b/gi, name: 'Dragon Prismatic' },
            // Elephant Crystal
            { pattern: /\b(elephant crystal)\b/gi, name: 'Elephant Crystal' },
            // Elephant Kaleidoscope
            { pattern: /\b(elephant kaleidoscope)\b/gi, name: 'Elephant Kaleidoscope' },
            // Elephant Mojo
            { pattern: /\b(elephant mojo)\b/gi, name: 'Elephant Mojo' },
            // Elephant Prismatic
            { pattern: /\b(elephant prismatic)\b/gi, name: 'Elephant Prismatic' },
            // Giraffe Crystal
            { pattern: /\b(giraffe crystal)\b/gi, name: 'Giraffe Crystal' },
            // Giraffe Kaleidoscope
            { pattern: /\b(giraffe kaleidoscope)\b/gi, name: 'Giraffe Kaleidoscope' },
            // Giraffe Mojo
            { pattern: /\b(giraffe mojo)\b/gi, name: 'Giraffe Mojo' },
            // Giraffe Prismatic
            { pattern: /\b(giraffe prismatic)\b/gi, name: 'Giraffe Prismatic' },
            // Leopard Crystal
            { pattern: /\b(leopard crystal)\b/gi, name: 'Leopard Crystal' },
            // Leopard Kaleidoscope
            { pattern: /\b(leopard kaleidoscope)\b/gi, name: 'Leopard Kaleidoscope' },
            // Leopard Mojo
            { pattern: /\b(leopard mojo)\b/gi, name: 'Leopard Mojo' },
            // Leopard Prismatic
            { pattern: /\b(leopard prismatic)\b/gi, name: 'Leopard Prismatic' },
            // Parrot Crystal
            { pattern: /\b(parrot crystal)\b/gi, name: 'Parrot Crystal' },
            // Parrot Kaleidoscope
            { pattern: /\b(parrot kaleidoscope)\b/gi, name: 'Parrot Kaleidoscope' },
            // Parrot Mojo
            { pattern: /\b(parrot mojo)\b/gi, name: 'Parrot Mojo' },
            // Parrot Prismatic
            { pattern: /\b(parrot prismatic)\b/gi, name: 'Parrot Prismatic' },
            // Peacock Crystal
            { pattern: /\b(peacock crystal)\b/gi, name: 'Peacock Crystal' },
            // Peacock Kaleidoscope
            { pattern: /\b(peacock kaleidoscope)\b/gi, name: 'Peacock Kaleidoscope' },
            // Peacock Mojo
            { pattern: /\b(peacock mojo)\b/gi, name: 'Peacock Mojo' },
            // Peacock Prismatic
            { pattern: /\b(peacock prismatic)\b/gi, name: 'Peacock Prismatic' },
            // Snake Crystal
            { pattern: /\b(snake crystal)\b/gi, name: 'Snake Crystal' },
            // Snake Kaleidoscope
            { pattern: /\b(snake kaleidoscope)\b/gi, name: 'Snake Kaleidoscope' },
            // Snake Mojo
            { pattern: /\b(snake mojo)\b/gi, name: 'Snake Mojo' },
            // Snake Prismatic
            { pattern: /\b(snake prismatic)\b/gi, name: 'Snake Prismatic' },
            // Tiger Crystal
            { pattern: /\b(tiger crystal)\b/gi, name: 'Tiger Crystal' },
            // Tiger Kaleidoscope
            { pattern: /\b(tiger kaleidoscope)\b/gi, name: 'Tiger Kaleidoscope' },
            // Tiger Mojo
            { pattern: /\b(tiger mojo)\b/gi, name: 'Tiger Mojo' },
            // Tiger Prismatic
            { pattern: /\b(tiger prismatic)\b/gi, name: 'Tiger Prismatic' },
            // Zebra Crystal
            { pattern: /\b(zebra crystal)\b/gi, name: 'Zebra Crystal' },
            // Zebra Kaleidoscope
            { pattern: /\b(zebra kaleidoscope)\b/gi, name: 'Zebra Kaleidoscope' },
            // Zebra Mojo
            { pattern: /\b(zebra mojo)\b/gi, name: 'Zebra Mojo' },
            // Zebra Prismatic
            { pattern: /\b(zebra prismatic)\b/gi, name: 'Zebra Prismatic' }
        ];

        // Find all matches and build card type
        const foundTypes = [];
        for (const { pattern, name } of colorPatterns) {
            const matches = title.match(pattern);
            if (matches) {
                foundTypes.push(...matches);
            }
        }

        // Remove duplicates and format
        const uniqueTypes = [...new Set(foundTypes)];
        cardType = uniqueTypes.join(' ').trim();

        // Special case handling
        if (titleLower.includes('red white blue')) {
            cardType = 'Red White Blue';
        }
        if (titleLower.includes('red & yellow')) {
            cardType = 'Red Yellow';
        }
        if (titleLower.includes('light blue')) {
            cardType = 'Light Blue';
        }
        if (titleLower.includes('blue scope')) {
            cardType = 'Blue Scope';
        }
        if (titleLower.includes('pink preview')) {
            cardType = 'Pink Preview';
        }
        if (titleLower.includes('purple shock')) {
            cardType = 'Purple Shock';
        }
        if (titleLower.includes('red wave optic')) {
            cardType = 'Red Wave Optic';
        }
        if (titleLower.includes('wave optic red')) {
            cardType = 'Wave Optic Red';
        }
        if (titleLower.includes('blue wave optic')) {
            cardType = 'Blue Wave Optic';
        }
        if (titleLower.includes('green wave prizm')) {
            cardType = 'Green Wave Prizm';
        }
        if (titleLower.includes('emergent green wave prizm')) {
            cardType = 'Emergent Green Wave Prizm';
        }
        if (titleLower.includes('choice red scope')) {
            cardType = 'Choice Red Scope';
        }
        if (titleLower.includes('fast break silver mosaic')) {
            cardType = 'Fast Break Silver Mosaic';
        }
        if (titleLower.includes('genesis mosaic')) {
            cardType = 'Genesis Mosaic';
        }
        if (titleLower.includes('green mosaic')) {
            cardType = 'Green Mosaic';
        }
        if (titleLower.includes('reactive blue mosaic')) {
            cardType = 'Reactive Blue Mosaic';
        }
        if (titleLower.includes('reactive orange mosaic')) {
            cardType = 'Reactive Orange Mosaic';
        }
        if (titleLower.includes('red mosaic')) {
            cardType = 'Red Mosaic';
        }
        if (titleLower.includes('blue mosaic')) {
            cardType = 'Blue Mosaic';
        }
        if (titleLower.includes('choice red fusion mosaic')) {
            cardType = 'Choice Red Fusion Mosaic';
        }
        if (titleLower.includes('fast break blue mosaic')) {
            cardType = 'Fast Break Blue Mosaic';
        }
        if (titleLower.includes('fast break purple mosaic')) {
            cardType = 'Fast Break Purple Mosaic';
        }
        if (titleLower.includes('purple mosaic')) {
            cardType = 'Purple Mosaic';
        }
        if (titleLower.includes('orange fluorescent mosaic')) {
            cardType = 'Orange Fluorescent Mosaic';
        }
        if (titleLower.includes('white mosaic')) {
            cardType = 'White Mosaic';
        }
        if (titleLower.includes('fast break pink mosaic')) {
            cardType = 'Fast Break Pink Mosaic';
        }
        if (titleLower.includes('blue fluorescent mosaic')) {
            cardType = 'Blue Fluorescent Mosaic';
        }
        if (titleLower.includes('pink swirl mosaic')) {
            cardType = 'Pink Swirl Mosaic';
        }
        if (titleLower.includes('fast break gold mosaic')) {
            cardType = 'Fast Break Gold Mosaic';
        }
        if (titleLower.includes('gold mosaic')) {
            cardType = 'Gold Mosaic';
        }
        if (titleLower.includes('green swirl mosaic')) {
            cardType = 'Green Swirl Mosaic';
        }
        if (titleLower.includes('pink fluorescent mosaic')) {
            cardType = 'Pink Fluorescent Mosaic';
        }
        if (titleLower.includes('choice black gold mosaic')) {
            cardType = 'Choice Black Gold Mosaic';
        }
        if (titleLower.includes('black mosaic')) {
            cardType = 'Black Mosaic';
        }
        if (titleLower.includes('choice nebula mosaic')) {
            cardType = 'Choice Nebula Mosaic';
        }
        if (titleLower.includes('fast break black mosaic')) {
            cardType = 'Fast Break Black Mosaic';
        }

        return cardType || null;
    }

    // Enhanced card number extraction
    extractEnhancedCardNumber(title, existingCardNumber) {
        if (existingCardNumber && existingCardNumber !== 'NULL' && existingCardNumber !== '') {
            return existingCardNumber;
        }

        // Look for card number patterns in the title
        const cardNumberPatterns = [
            // Standard card numbers like #123
            /#(\d+)/g,
            // Card numbers with letters like #BDC-168, #CDA-LK
            /#([A-Za-z]+[-\dA-Za-z]+)/g,
            // Card numbers with letters like #17hh
            /#(\d+[A-Za-z]+)/g,
            // Bowman Draft card numbers (BDP, BDC, CDA, etc.)
            /\b(BD[A-Z]?\d+)\b/g,
            // Card numbers without # symbol
            /\b(\d{1,3})\b/g
        ];

        for (const pattern of cardNumberPatterns) {
            const matches = title.match(pattern);
            if (matches) {
                // Filter out PSA grades and print runs
                for (const match of matches) {
                    const matchLower = match.toLowerCase();
                    if (!matchLower.includes('psa') && 
                        !matchLower.includes('pop') && 
                        !matchLower.includes('gem') && 
                        !matchLower.includes('mint') &&
                        !title.includes('/' + match)) {
                        return match.startsWith('#') ? match : '#' + match;
                    }
                }
            }
        }

        return null;
    }

    // Fix missing card sets
    fixMissingCardSets(title, existingCardSet) {
        if (existingCardSet && existingCardSet !== 'NULL' && existingCardSet !== '') {
            return existingCardSet;
        }

        const titleLower = title.toLowerCase();

        // Fix specific missing card sets
        if (titleLower.includes('obsidian') && !titleLower.includes('panini obsidian')) {
            return 'Panini Obsidian';
        }
        if (titleLower.includes('synergy') && !titleLower.includes('upper deck synergy')) {
            return 'Upper Deck Synergy';
        }
        if (titleLower.includes('slania stamps') || titleLower.includes('slania')) {
            return 'Slania Stamps';
        }
        if (titleLower.includes('prizm') && !titleLower.includes('panini prizm')) {
            return 'Panini Prizm';
        }
        if (titleLower.includes('select') && !titleLower.includes('panini select')) {
            return 'Panini Select';
        }
        if (titleLower.includes('mosaic') && !titleLower.includes('panini mosaic')) {
            return 'Panini Mosaic';
        }
        if (titleLower.includes('donruss') && !titleLower.includes('panini donruss')) {
            return 'Panini Donruss';
        }
        if (titleLower.includes('optic') && !titleLower.includes('panini donruss optic')) {
            return 'Panini Donruss Optic';
        }
        if (titleLower.includes('bowman') && !titleLower.includes('topps bowman')) {
            return 'Bowman';
        }
        if (titleLower.includes('chrome') && !titleLower.includes('topps chrome')) {
            return 'Topps Chrome';
        }
        if (titleLower.includes('finest') && !titleLower.includes('topps finest')) {
            return 'Topps Finest';
        }
        if (titleLower.includes('heritage') && !titleLower.includes('topps heritage')) {
            return 'Topps Heritage';
        }

        return existingCardSet;
    }

    // Improve all summary components
    async improveSummaryComponents() {
        console.log('🔧 Improving summary components...');
        
        try {
            // Initialize the title generator
            await this.titleGenerator.connect();
            await this.titleGenerator.learnFromDatabase();
            
            // Get all cards
            const cards = await this.runQuery('SELECT id, title, card_set, card_type, card_number, print_run FROM cards');
            console.log(`📊 Found ${cards.length} cards to improve`);

            let updated = 0;
            let errors = 0;

            for (const card of cards) {
                try {
                    // Improve each component
                    const improvedCardSet = this.fixMissingCardSets(card.title, card.card_set);
                    const improvedCardType = this.extractEnhancedCardType(card.title, card.card_type);
                    const improvedCardNumber = this.extractEnhancedCardNumber(card.title, card.card_number);

                    // Check if any improvements were made
                    const cardSetChanged = improvedCardSet !== card.card_set;
                    const cardTypeChanged = improvedCardType !== card.card_type;
                    const cardNumberChanged = improvedCardNumber !== card.card_number;

                    if (cardSetChanged || cardTypeChanged || cardNumberChanged) {
                        // Update the card
                        await this.runUpdate(
                            `UPDATE cards SET 
                             card_set = ?, 
                             card_type = ?, 
                             card_number = ? 
                             WHERE id = ?`,
                            [improvedCardSet, improvedCardType, improvedCardNumber, card.id]
                        );

                        console.log(`✅ Improved card ${card.id}:`);
                        if (cardSetChanged) {
                            console.log(`   Card Set: "${card.card_set || 'NULL'}" → "${improvedCardSet}"`);
                        }
                        if (cardTypeChanged) {
                            console.log(`   Card Type: "${card.card_type || 'NULL'}" → "${improvedCardType}"`);
                        }
                        if (cardNumberChanged) {
                            console.log(`   Card Number: "${card.card_number || 'NULL'}" → "${improvedCardNumber}"`);
                        }
                        
                        updated++;
                    }
                } catch (error) {
                    console.error(`❌ Error processing card ${card.id}:`, error);
                    errors++;
                }
            }

            console.log('\n🎉 Summary Components Improvement Complete!');
            console.log('=============================================');
            console.log(`📊 Total cards processed: ${cards.length}`);
            console.log(`🔄 Updated: ${updated}`);
            console.log(`❌ Errors: ${errors}`);

            return {
                success: true,
                totalProcessed: cards.length,
                updated: updated,
                errors: errors
            };

        } catch (error) {
            console.error('❌ Error during improvement:', error);
            throw error;
        }
    }

    // Close database connection
    async close() {
        if (this.db) {
            this.db.close();
            console.log('✅ Database connection closed');
        }
        if (this.titleGenerator) {
            await this.titleGenerator.close();
        }
    }
}

// Main execution function
async function main() {
    const improver = new SummaryComponentsImprover();
    
    try {
        await improver.connect();
        await improver.improveSummaryComponents();
        console.log('\n✅ Summary components improved successfully!');
        
    } catch (error) {
        console.error('❌ Error in main execution:', error);
    } finally {
        await improver.close();
    }
}

// Export for use in other modules
module.exports = { SummaryComponentsImprover };

// Run if called directly
if (require.main === module) {
    main()
        .then(() => {
            console.log('\n✅ Script completed successfully');
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ Script failed:', error);
            process.exit(1);
        });
}
