// Release calendar data fix, researched manually on 2026-11-07.
// Every content change and every added release carries its sources. Rows whose
// facts could not be verified are archived (is_active = false), not guessed.
const CHECKED = '2026-11-07';

const TOPPS_CALENDAR = 'https://www.topps.com/release-calendar';
const ci = (slug) => `https://www.checklistinsider.com/${slug}`;
const topps = (slug) => `https://www.topps.com/pages/${slug}`;

const src = (name, url, evidence) => ({ name, url, checked: CHECKED, ...(evidence ? { evidence } : {}) });
const CI = (slug) => src('Checklist Insider', ci(slug));
const TOPPS_CAL = src('Topps release calendar', TOPPS_CALENDAR);

const BRAND_MAP = {
    'Topps': 'Topps',
    'Bowman': 'Topps',
    'Panini': 'Panini',
    'Upper Deck': 'Upper Deck',
    'Leaf': 'Leaf',
    'Pokemon': 'Pokémon',
    'Pokémon': 'Pokémon',
    'Yugioh': 'Yu-Gi-Oh!',
    'Yu-Gi-Oh': 'Yu-Gi-Oh!',
    'Yu-Gi-Oh!': 'Yu-Gi-Oh!',
    'Onyx': 'Onyx',
    'Tristar': 'Tristar',
    'Rittenhouse': 'Rittenhouse',
    'Other': 'Other'
};
const ALLOWED_BRANDS = ['Topps', 'Panini', 'Upper Deck', 'Leaf', 'Pokémon', 'Yu-Gi-Oh!', 'Onyx', 'Tristar', 'Rittenhouse', 'Other'];

// Per-id corrections to existing rows. Only listed fields change; brand, price
// 'TBD' and status normalisation apply to every row on top of this.
const UPDATES = [
    {
        id: 158,
        set: {
            title: '2026-27 Upper Deck Series 1 Hockey', brand: 'Upper Deck', sport: 'Hockey', year: '2026',
            description: 'Flagship NHL release led by Young Guns rookies; light on autographs and relics. Formats include Hobby, Blaster, Starter, Tin and Hanger.',
            source: 'Checklist Insider'
        },
        sources: [CI('2026-27-upper-deck-series-1-hockey')],
        note: 'Title typo "Uppper", brand Other -> Upper Deck. Date Oct 7 confirmed.'
    },
    {
        id: 132,
        set: {
            sport: 'Baseball', year: '2026', source: 'Leaf',
            description: 'High-end baseball release with cut signatures, game-used memorabilia and signature booklet cards.'
        },
        sources: [
            src('Leaf Trading Cards', 'https://www.leaftradingcards.com/products/2026-leaf-seasons-in-the-sun-baseball',
                'Manufacturer page shows "RELEASED" with no date.'),
            src('Waxstat', 'https://www.waxstat.com/boxes/2026-leaf-seasons-in-the-sun-baseball-hobby-box',
                'Secondary: "Released Aug 7, 2026" / "Release Date August 07, 2026".'),
            src('Breakninja', 'https://www.breakninja.com/baseballcards/2026-Leaf-Seasons-In-The-Sun-Baseball-Card-Checklist.php?page_no=1',
                'Secondary: "Release Date: August 7th, 2026".')
        ],
        note: 'Kept over id 105 (Aug 26, unsupported). Aug 7 appears only on secondary sources; no Checklist Insider page exists.',
        flag: 'date-secondary-only'
    },
    {
        id: 131,
        set: {
            title: '2025-26 Topps Chrome Update Series Basketball', sport: 'Basketball', year: '2025', source: 'Checklist Insider',
            description: 'First NBA Chrome Update release. Hobby boxes include one autograph; also Jumbo, Mega and Value Blaster formats.',
            hobbyPrice: '$549.99', retailPrice: 'Value Blaster $44.99'
        },
        sources: [CI('2025-26-topps-chrome-update-series-basketball')],
        note: 'Date Aug 6 from Checklist Insider only; Topps calendar shows no date for released products.',
        flag: 'topps-calendar-no-date-for-released'
    },
    {
        id: 135,
        set: {
            sport: 'Track and Field', year: '2026', source: 'Onyx',
            description: 'First Onyx track and field set. Hobby box: 24 packs of 5 cards with eight autographs.',
            hobbyPrice: '$149.99'
        },
        sources: [
            src('Onyx Authenticated', 'https://onyxauthenticated.com/product/2026-onyx-track-and-field-hobby-box/',
                'Manufacturer page: configuration and $149.99 price; no date.'),
            src('Waxstat', 'https://www.waxstat.com/boxes/2026-onyx-track-and-field-trading-cards-box',
                'Secondary: "Released Aug 7, 2026" / "Release Date August 07, 2026".')
        ],
        note: 'Aug 7 appears only on Waxstat; no Checklist Insider page exists.',
        flag: 'date-secondary-only'
    },
    {
        id: 104,
        set: {
            title: 'Yu-Gi-Oh! Legendary ARC-V Decks', sport: 'Gaming', year: '2026', source: 'Konami',
            description: "Collector's set with three ready-to-play 55-card Decks and a bonus pack for each (168 cards).",
            retailPrice: '$31.99 per box'
        },
        sources: [src('Konami Yu-Gi-Oh! TCG', 'https://www.yugioh-card.com/en/products/lavd/')]
    },
    {
        id: 133,
        set: {
            title: '2026 Panini Revolution K League Soccer', sport: 'Soccer', year: '2026', source: 'Checklist Insider',
            description: 'Hobby boxes average 12 parallels and 12 inserts, including at least two numbered cards.',
            hobbyPrice: '$72'
        },
        sources: [CI('2026-panini-revolution-k-league-soccer')]
    },
    {
        id: 136,
        set: {
            title: 'Pokémon TCG: First Partner Illustration Collection—Series 3', sport: 'Gaming', year: '2026', source: 'Pokémon',
            description: 'One pack with 3 of 9 illustration rare-style promo cards, two booster packs and a sticker sheet.'
        },
        sources: [src('Pokémon', 'https://www.pokemon.com/us/pokemon-tcg/product-gallery/first-partner-illustration-collection-series-3')]
    },
    {
        id: 137,
        set: {
            title: '2026 Upper Deck Platinum DC', sport: 'Entertainment', year: '2026', releaseDate: '2026-09-10', source: 'Checklist Insider',
            description: 'Chromium DC Comics set in Hobby and Blaster formats; Hobby boxes include three inserts.'
        },
        sources: [CI('upper-deck-platinum-dc')],
        note: 'Date Aug 7 -> Sep 10.'
    },
    {
        id: 139,
        set: {
            sport: 'Wrestling', year: '2026', source: 'Checklist Insider',
            description: 'Sixth AEW flagship set. Hobby boxes hold 96 cards; Blasters hold 36.'
        },
        sources: [CI('2026-upper-deck-aew-wrestling')]
    },
    {
        id: 138,
        set: {
            title: '2026 Panini Turn Four NASCAR Racing', sport: 'Racing', year: '2026', source: 'Checklist Insider',
            description: 'Hobby box: three encased hits (autograph or relic) plus one base, parallel or insert.',
            hobbyPrice: '$164.95'
        },
        sources: [CI('2026-panini-turn-four-nascar-racing')]
    },
    {
        id: 140,
        set: {
            title: '2026 Topps Stadium Club UFC', sport: 'MMA', year: '2026', source: 'Checklist Insider',
            description: 'Hobby boxes include two autographs; also Mega and Value Blaster formats.',
            hobbyPrice: '$119.99', retailPrice: 'Value Blaster $24.99'
        },
        sources: [CI('2026-topps-stadium-club-ufc')],
        note: 'Date Aug 14 from Checklist Insider only; Topps calendar shows no date for released products.',
        flag: 'topps-calendar-no-date-for-released'
    },
    {
        id: 141,
        set: {
            sport: 'Basketball', year: '2026', releaseDate: '2026-09-04', source: 'Checklist Insider',
            description: 'Hobby boxes include three hits.',
            hobbyPrice: '$324.95'
        },
        sources: [CI('2026-donruss-wnba-basketball')],
        note: 'Date Aug 19 -> Sep 4.'
    },
    {
        id: 142,
        set: {
            sport: 'Basketball', year: '2025', releaseDate: '2026-08-28', source: 'Checklist Insider',
            description: 'Hobby boxes average two autographs and one relic.',
            hobbyPrice: '$150'
        },
        sources: [CI('2025-26-panini-origins-basketball')],
        note: 'Date Aug 19 -> Aug 28.'
    },
    {
        id: 143,
        set: {
            sport: 'Golf', year: '2026', releaseDate: '2026-09-04', source: 'Checklist Insider',
            description: 'Hobby boxes average two autographs; Mega boxes include one hit.',
            hobbyPrice: '$120'
        },
        sources: [CI('2026-panini-contenders-liv-golf')],
        note: 'Date Aug 26 -> Sep 4.'
    },
    {
        id: 144,
        set: {
            sport: 'Hockey', year: '2026', releaseDate: '2026-08-05', source: 'Checklist Insider',
            description: 'Season-opening NHL set. Hobby boxes include one rare short print, 14 inserts and five parallels.'
        },
        sources: [CI('2026-27-upper-deck-mvp-hockey')],
        note: 'Date Aug 26 -> Aug 5.'
    },
    {
        id: 145,
        set: {
            sport: 'Football', year: '2026', releaseDate: '2026-10-28', source: 'Checklist Insider',
            description: 'Unlicensed pro and collegiate cards. Hobby boxes include one autograph and one relic.',
            hobbyPrice: '$199.95'
        },
        sources: [CI('2026-donruss-football')],
        note: 'Date Aug 28 -> Oct 28.'
    },
    {
        id: 148,
        set: {
            title: '2026 Panini Three and Two Baseball', sport: 'Baseball', year: '2026', releaseDate: '2026-12-11', source: 'Checklist Insider',
            description: 'Five-card boxes with one encased autograph and one encased relic.'
        },
        sources: [CI('2026-panini-three-and-two-baseball')],
        note: 'Date Sep 2 -> Dec 11 (now upcoming).'
    },
    {
        id: 147,
        set: {
            sport: 'Basketball', year: '2026', releaseDate: '2026-11-04', source: 'Checklist Insider',
            description: 'Hobby boxes include five autographs.',
            hobbyPrice: '$724.95'
        },
        sources: [CI('2026-panini-impeccable-wnba')],
        note: 'Date Sep 2 -> Nov 4.'
    },
    {
        id: 149,
        set: {
            title: 'Yu-Gi-Oh! Magnificent Monsters', sport: 'Gaming', year: '2026', source: 'Konami',
            description: '126-card set including 18 reimagined anime cards.',
            retailPrice: '$34.99'
        },
        sources: [src('Konami Yu-Gi-Oh! TCG', 'https://www.yugioh-card.com/en/products/mamo/')]
    },
    {
        id: 159,
        set: {
            title: 'Yu-Gi-Oh! Beyond the Brave', sport: 'Gaming', year: '2026', source: 'Konami',
            description: '100-card core booster set.',
            retailPrice: '$4.49 per pack'
        },
        sources: [src('Konami Yu-Gi-Oh! TCG', 'https://www.yugioh-card.com/en/products/betb/')]
    },
    {
        id: 150,
        set: {
            title: 'Pokémon TCG: 30th Celebration', sport: 'Gaming', year: '2026', releaseDate: '2026-09-16', source: 'Pokémon',
            description: 'Expansion launched Sep 16 in the Elite Trainer Box (9 packs), Poster Collection (3), Pokémon ex Box (4), Knock Out Collection (2) and 2-Pack Blister (2, dated "September 2026"). Booster Bundle (6) and Mini Tin (2) followed Oct 2; Binder Collection (5) is due Dec 4.'
        },
        sources: [
            src('Pokémon press', 'https://press.pokemon.com/en/MEDIA-ALERT-The-Pokemon-Company-International-Reveals-Product-Lineup-f'),
            src('Pokémon', 'https://www.pokemon.com/us/news/check-out-every-pokemon-tcg-product-release-in-september-2026'),
            src('Pokémon', 'https://www.pokemon.com/us/pokemon-tcg/product-gallery/30th-celebration-booster-bundle'),
            src('Pokémon', 'https://www.pokemon.com/us/pokemon-tcg/product-gallery/30th-celebration-mini-tin'),
            src('Pokémon', 'https://www.pokemon.com/us/pokemon-tcg/product-gallery/30th-celebration-binder-collection'),
            src('Pokémon', 'https://www.pokemon.com/uk/news/pokemon-tcg-30th-celebration-product-showcase')
        ],
        note: 'Collapses ids 150-157 into one release. DB had Booster Bundle and Binder on Sep 16; official dates are Oct 2 and Dec 4.'
    }
];

const ARCHIVES = [
    { id: 105, reason: 'Duplicate of id 132 (Leaf Seasons In The Sun). Aug 26 date unsupported by any source (secondary sources say Aug 7).' },
    { id: 106, reason: 'Unresolved: no manufacturer or Checklist Insider page; retailer/Waxstat say Sep 30 vs DB Aug 28.' },
    { id: 151, reason: 'Pokémon 30th Celebration packaging, merged into id 150.' },
    { id: 152, reason: 'Pokémon 30th Celebration packaging, merged into id 150.' },
    { id: 153, reason: 'Pokémon 30th Celebration packaging, merged into id 150.' },
    { id: 154, reason: 'Pokémon 30th Celebration packaging, merged into id 150.' },
    { id: 155, reason: 'Pokémon 30th Celebration packaging, merged into id 150.' },
    { id: 156, reason: 'Pokémon 30th Celebration packaging, merged into id 150.' },
    { id: 157, reason: 'Pokémon 30th Celebration packaging, merged into id 150.' }
];

const add = (releaseDate, title, brand, sport, year, description, sources, extra = {}) =>
    ({ releaseDate, title, brand, sport, year, description, sources, hobbyPrice: null, retailPrice: null, ...extra });

// Topps/Bowman dates confirmed on the Topps calendar ("Dropping soon" / spotlight,
// not PRE-ORDER entries); configuration and prices from Checklist Insider.
// Exact calendar wording as checked on CHECKED.
const TOPPS_CAL_EVIDENCE = {
    '2026 Topps Museum Collection Baseball': 'Dropping soon: "Wednesday, Nov 11 at 12:00 PM CST"',
    '2026 Topps Allen & Ginter X Baseball': 'Dropping soon: "Wednesday, Nov 11 at 11:00 AM CST"',
    '2026-27 Topps Flagship Bundesliga Soccer': 'Dropping soon: "Thursday, Nov 12 at 10:00 AM CST" (listed as Topps Flagship Bundesliga 2026/27)',
    '2026 Topps Royalty Tennis': 'Dropping soon: "Friday, Nov 13 at 10:00 AM CST"',
    '2026 Topps Midnight Football': 'Dropping soon: "Friday, Nov 13 at 11:00 AM CST"',
    '2026 Topps Royalty UFC': 'Dropping soon: "Friday, Nov 13 at 12:00 PM CST"',
    '2025-26 Topps x Bob Ross: The Joy of Basketball': 'Dropping soon: "Monday, Nov 16"',
    '2026 Topps Chrome Football': 'Dropping soon: "Wednesday, Nov 18"',
    '2026 Topps Pro Debut Baseball': 'Dropping soon: "Wednesday, Nov 18"',
    '2025-26 Topps Five Star Basketball': 'Dropping soon: "Thursday, Nov 19"',
    '2026 Topps Finest Formula 1': 'Dropping soon: "Thursday, Nov 19"',
    '2026 Topps Gilded Collection Baseball': 'Release spotlight: "Wednesday, Nov 25"',
    '2026 Bowman U Signature Football': 'Release spotlight: "Friday, Dec 4"',
    '2026 Topps Chrome Update Series Baseball': 'Release spotlight: "Wednesday, Dec 9"'
};
const toppsAdd = (date, title, sport, year, description, toppsSlug, ciSlug, extra) =>
    add(date, title, 'Topps', sport, year, description,
        [{ ...TOPPS_CAL, evidence: TOPPS_CAL_EVIDENCE[title] }, src('Topps', topps(toppsSlug)), CI(ciSlug)],
        { source: 'Topps', ...extra });

const ciAdd = (date, title, brand, sport, year, description, ciSlug, extra) =>
    add(date, title, brand, sport, year, description, [CI(ciSlug)], { source: 'Checklist Insider', ...extra });

const ADDITIONS = [
    toppsAdd('2026-11-11', '2026 Topps Museum Collection Baseball', 'Baseball', '2026',
        'Autograph and relic focused, including framed cards and autographed relics.',
        'topps-museum-collection-baseball', '2026-topps-museum-collection-baseball'),
    toppsAdd('2026-11-11', '2026 Topps Allen & Ginter X Baseball', 'Baseball', '2026',
        'One hard-signed framed mini autograph per box; full-size black versions of the A&G base set.',
        'topps-allen-ginter-x', '2026-topps-allen-ginter-x-baseball'),
    toppsAdd('2026-11-12', '2026-27 Topps Flagship Bundesliga Soccer', 'Soccer', '2026',
        'Jumbo Hobby boxes include three hits (autograph or relic) and one Black Edge pack.',
        'topps-flagship-bundesliga', '2026-27-topps-flagship-bundesliga-soccer',
        { hobbyPrice: 'Jumbo $94.99', retailPrice: 'Value Blaster $24.99' }),
    toppsAdd('2026-11-13', '2026 Topps Royalty Tennis', 'Tennis', '2026',
        'One 10-card pack per box with six autographs.',
        'topps-royalty-tennis', '2026-topps-royalty-tennis', { hobbyPrice: '$579.99' }),
    toppsAdd('2026-11-13', '2026 Topps Midnight Football', 'Football', '2026',
        'Three Chrome autographs per Hobby box; First Day Issue boxes add exclusive content.',
        'topps-midnight-football', '2026-topps-midnight-football', { hobbyPrice: '$539.99' }),
    toppsAdd('2026-11-13', '2026 Topps Royalty UFC', 'MMA', '2026',
        'One 10-card pack per box with five autographs and three relics.',
        'topps-royalty-ufc', '2026-topps-royalty-ufc'),
    toppsAdd('2026-11-16', '2025-26 Topps x Bob Ross: The Joy of Basketball', 'Basketball', '2025',
        'NBA players past and present in Bob Ross-style artistic scenes.',
        'topps-x-bob-ross-the-joy-of-basketball', '2025-26-topps-x-bob-ross-the-joy-of-basketball'),
    toppsAdd('2026-11-18', '2026 Topps Chrome Football', 'Football', '2026',
        'Formats include Hobby, Jumbo, Mega, Value Blaster and Hanger.',
        'topps-chrome-football', '2026-topps-chrome-football',
        { hobbyPrice: '$439.99', retailPrice: 'Value Blaster $44.99' }),
    toppsAdd('2026-11-18', '2026 Topps Pro Debut Baseball', 'Baseball', '2026',
        'Minor League Baseball set. Hobby Jumbo boxes include four autographs.',
        'topps-pro-debut-baseball', '2026-topps-pro-debut-baseball', { hobbyPrice: 'Jumbo $139.99' }),
    toppsAdd('2026-11-19', '2025-26 Topps Five Star Basketball', 'Basketball', '2025',
        'Hobby boxes include five autographs.',
        'topps-five-star-basketball', '2025-26-topps-five-star-basketball'),
    toppsAdd('2026-11-19', '2026 Topps Finest Formula 1', 'Racing', '2026',
        'Finest designs featuring F1 drivers plus select F2 drivers.',
        'topps-finest-formula-1', '2026-topps-finest-formula-1-racing', { hobbyPrice: '$289.99' }),
    toppsAdd('2026-11-25', '2026 Topps Gilded Collection Baseball', 'Baseball', '2026',
        'High-end chromium baseball release.',
        'topps-gilded-collection-baseball', '2026-topps-gilded-collection-baseball'),
    toppsAdd('2026-12-04', '2026 Bowman U Signature Football', 'Football', '2026',
        'Autograph-focused Bowman University (NIL) football release.',
        '2026-bowman-u-signature-football', '2026-bowman-u-signature-football',
        { hobbyPrice: '$379.99' }),
    toppsAdd('2026-12-09', '2026 Topps Chrome Update Series Baseball', 'Baseball', '2026',
        'Closes the Chrome season, including MLB Debut Patch Autographs. Formats: Hobby, Jumbo, Mega and Value Blaster.',
        'topps-chrome-baseball-update-series', '2026-topps-chrome-update-series-baseball',
        { hobbyPrice: '$239.99', retailPrice: 'Value Blaster $39.99' }),

    ciAdd('2026-11-11', '2026 Upper Deck Feline Collection', 'Upper Deck', 'Entertainment', '2026',
        'Cat-themed non-sport set in Hobby and Blaster formats.', 'upper-deck-feline-collection'),
    ciAdd('2026-11-11', '2025-26 Upper Deck Tableau Hockey', 'Upper Deck', 'Hockey', '2025',
        'New high-end NHL brand; one autograph per box.', '2025-26-upper-deck-tableau-hockey'),
    ciAdd('2026-11-13', '2026 Panini Absolute Countdown Calendar Football', 'Panini', 'Football', '2026',
        'Holiday countdown calendar box with retired pros and NIL athletes (no NFL license).',
        '2026-panini-absolute-countdown-calendar-football', { retailPrice: 'Calendar box $49.95' }),
    ciAdd('2026-11-18', '2026 Panini Crown Royale WNBA Basketball', 'Panini', 'Basketball', '2026',
        'One 8-card pack per Hobby box with two autographs and one relic.', '2026-panini-crown-royale-wnba-basketball'),
    ciAdd('2026-11-18', '2026 Panini Immaculate Collection NASCAR Racing', 'Panini', 'Racing', '2026',
        'Six-card Hobby boxes averaging five autographs or relics.', '2026-panini-immaculate-collection-nascar-racing'),
    ciAdd('2026-11-18', '2026 Panini Combat Anthology', 'Panini', 'Multi-Sport', '2026',
        'Boxing, kickboxing, MMA and wrestling; Hobby boxes average two autographs.', '2026-panini-combat-anthology'),
    ciAdd('2026-11-20', '2026 Panini Prizm Black NWSL Soccer', 'Panini', 'Soccer', '2026',
        'Hobby boxes average two autographs, 10 inserts and 20 Prizm parallels.', '2026-panini-prizm-black-nwsl-soccer'),
    ciAdd('2026-11-25', '2025-26 Panini National Treasures Road to FIFA World Cup 2026 Soccer', 'Panini', 'Soccer', '2025',
        'Hobby boxes yield eight hits (autographs or relics).', '2025-26-panini-national-treasures-road-to-fifa-world-cup'),
    ciAdd('2026-11-25', '2026 Panini Mangaverse Football', 'Panini', 'Football', '2026',
        'Hobby boxes: one autograph and three numbered parallels. 15-card Retail boxes also available.', '2026-panini-mangaverse-football'),
    ciAdd('2026-11-25', '2026 Panini Select WNBA Basketball', 'Panini', 'Basketball', '2026',
        'Hobby boxes average nine inserts; Mega and Blaster retail formats.', '2026-panini-select-wnba-basketball'),
    ciAdd('2026-12-02', '2026 Panini Flawless NASCAR Racing', 'Panini', 'Racing', '2026',
        'Two encased autographs or relics, one encased gem card and seven more hits per box.', '2026-panini-flawless-nascar-racing'),
    ciAdd('2026-12-04', "2026 Donruss Elite Road to Women's World Cup 2027 Soccer", 'Panini', 'Soccer', '2026',
        'Hobby boxes average two autographs and seven numbered parallels.', '2026-donruss-elite-road-to-womens-world-cup'),
    ciAdd('2026-12-09', '2026 Panini Flawless FIFA World Cup Soccer', 'Panini', 'Soccer', '2026',
        'Super-premium World Cup set with at least two gem cards per box.', '2026-panini-flawless-fifa-world-cup-soccer'),
    ciAdd('2026-12-09', '2026 Panini Sonic the Hedgehog', 'Panini', 'Entertainment', '2026',
        'Prizm Debut Edition. Hobby boxes: six inserts and 12 parallels; Hobby Preferred and Retail editions.', '2026-panini-sonic-the-hedgehog'),
    ciAdd('2026-12-16', '2026-27 Upper Deck Allure Hockey', 'Upper Deck', 'Hockey', '2026',
        'Chromium NHL set; one autograph or Doubloons card as the main Hobby hit.', '2026-27-upper-deck-allure-hockey'),
    ciAdd('2026-12-16', '2026 Fleer Transformers The Movie 40th Anniversary', 'Upper Deck', 'Entertainment', '2026',
        'Three numbered cards per Hobby box; one G1 card per Blaster.', 'fleer-transformers-the-movie-40th'),
    ciAdd('2026-12-16', '2026 Rittenhouse A Knight of the Seven Kingdoms Season 1', 'Rittenhouse', 'Entertainment', '2026',
        'Hobby boxes average three cast autographs.', 'rittenhouse-a-knight-of-the-seven-kingdoms', { hobbyPrice: '$199.99' }),
    ciAdd('2026-12-16', '2026-27 Donruss Basketball', 'Panini', 'Basketball', '2026',
        'Pro and NIL players; Hobby boxes include three autographs.', '2026-27-donruss-basketball'),
    ciAdd('2026-12-18', '2026 Panini Immaculate Collection Football', 'Panini', 'Football', '2026',
        'Six-card boxes with five autographs or relics; no NFL license.', '2026-panini-immaculate-collection-football'),
    ciAdd('2026-12-30', '2026-27 Upper Deck Black Diamond Hockey', 'Upper Deck', 'Hockey', '2026',
        'Six-card Hobby boxes: one autograph or diamond relic, one Exquisite insert and three more inserts, tech cards or relics.',
        '2026-27-upper-deck-black-diamond-hockey'),
    ciAdd('2026-12-31', '2026 Upper Deck Wayne Gretzky Master Collection', 'Upper Deck', 'Hockey', '2026',
        'Wooden box with two Gretzky autographs, a diamond card, a relic and one more hit.',
        'upper-deck-wayne-gretzky-master-collection', { hobbyPrice: '$5,999.99' }),
    add('2026-11-13', 'Yu-Gi-Oh! Magnificent Maestros', 'Yu-Gi-Oh!', 'Gaming', '2026',
        'Holiday set and sequel to Magnificent Monsters.',
        [src('Konami Yu-Gi-Oh! TCG', 'https://www.yugioh-card.com/en/products/others/')], { source: 'Konami' })
];

// Topps releases whose date appears only on Checklist Insider: the Topps calendar
// lists them under "Available now" without a date (Holiday not at all). Applied
// only with --include-pending after explicit approval.
const PENDING_ADDITIONS = [
    ciAdd('2026-10-14', '2026 Topps Update Series Baseball', 'Topps', 'Baseball', '2026',
        'Flagship season closer. Formats include Hobby, Jumbo, Value Blaster, Fat Pack, Hanger and Super Box.',
        '2026-topps-update-series-baseball', { hobbyPrice: '$119.99', retailPrice: 'Value Blaster $24.99',
            note: 'Topps calendar lists it under "Available now" with no date; no date found on topps.com.' }),
    ciAdd('2026-10-21', '2026 Topps Holiday Baseball', 'Topps', 'Baseball', '2026',
        'Seasonal Christmas edition of the flagship design in Mega Box, Tin and Advent Calendar formats.',
        '2026-topps-holiday-baseball', { retailPrice: 'Mega Box $29.99',
            note: 'Not on the Topps calendar; no date found on topps.com.' }),
    ciAdd('2026-10-23', '2026 Topps Holiday Football', 'Topps', 'Football', '2026',
        'First NFL edition of the Holiday release, sold in Mega boxes.',
        '2026-topps-holiday-football', { retailPrice: 'Mega Box $29.99',
            note: 'Not on the Topps calendar; no date found on topps.com.' }),
    ciAdd('2026-11-05', '2026-27 Topps Flagship Basketball', 'Topps', 'Basketball', '2026',
        'Hobby boxes include one hit (autograph or relic); Jumbo boxes include one autograph and one relic.',
        '2026-27-topps-flagship-basketball', { hobbyPrice: '$179.99', retailPrice: 'Value Blaster $29.99',
            note: 'Conflict. Checklist Insider: Nov 5. Topps calendar: "Available now", no date. Topps page: "Available now, Mega boxes available November 12" (format date, not product release). Site guide article (not a source): Oct 6 preorder, Oct 22 street date.' })
];
for (const p of PENDING_ADDITIONS) p.sources.push(TOPPS_CAL);

// Leads checked and deliberately not added, reported in the dry run.
const NOT_ADDED = [
    { title: '2026 Topps Stadium Club Football', reason: 'Topps calendar shows a PRE-ORDER date (Nov 9) only; Checklist Insider TBA.' },
    { title: '2026-27 Topps Hoops Basketball', reason: 'Topps PRE-ORDER date (Nov 10) only; Checklist Insider TBA.' },
    { title: '2026 Topps T205 Baseball', reason: 'Topps PRE-ORDER date (Nov 13) only; Checklist Insider TBA.' },
    { title: 'Topps True Football Bundesliga 2025/26', reason: 'Topps PRE-ORDER date (Nov 17) only; Checklist Insider TBA.' },
    { title: '2026 Topps MLS Black and White Soccer', reason: 'Topps PRE-ORDER date (Nov 20) only; Checklist Insider TBA.' },
    { title: '2025-26 Topps Stadium Club Basketball', reason: 'Checklist Insider Nov 25; Topps lists PRE-ORDER without a date.' },
    { title: 'Topps Chrome Sapphire F1 / Chrome LogoFractor F1 (Nov 12), Triumphant Tennis (Nov 17), Update Japan Edition (Nov 20), Merlin UEFA (Dec 3)', reason: 'Checklist Insider dates not shown on the Topps calendar.' },
    { title: '2026-27 Upper Deck Series 2 Hockey', reason: 'Feb 24, 2027 is outside the 90-day window (ends 2027-02-05).' },
    { title: 'Yu-Gi-Oh! Glorious Victors (Dec 4)', reason: 'Only ICv2 lists the date; no Konami product page found.' },
    { title: 'Other October 2026 releases on Checklist Insider (~40)', reason: 'Not requested beyond Update, Holiday and Flagship Basketball; not added.' },
    { title: 'Other upcoming Pokémon products (e.g. 30th Celebration Tech Sticker Collection: US Sep 16 vs UK "November 2026")', reason: 'Not researched beyond the 30th Celebration packagings.' }
];

module.exports = {
    CHECKED,
    BRAND_MAP,
    ALLOWED_BRANDS,
    UPDATES,
    ARCHIVES,
    ADDITIONS,
    PENDING_ADDITIONS,
    NOT_ADDED
};
