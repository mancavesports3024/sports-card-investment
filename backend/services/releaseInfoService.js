const cacheService = require('./cacheService');

class ReleaseInfoService {
  constructor() {
    this.cacheTimeout = 3600; // 1 hour cache
  }

  async getReleaseData() {
    const cacheKey = 'release_data';
    
    // Check cache first
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      console.log('📋 Using cached release data');
      return cached;
    }

    console.log('🔄 Loading comprehensive release data...');
    
    // Use the comprehensive release data provided
    const releases = this.getComprehensiveReleases();
    
    // Cache the results
    await cacheService.set(cacheKey, releases, this.cacheTimeout);
    
    console.log(`✅ Loaded ${releases.length} releases`);
    return releases;
  }

  getComprehensiveReleases() {
    return [
      {
        title: '2025 Onyx RIPS Collection Baseball',
        brand: 'Onyx',
        sport: 'Baseball',
        releaseDate: '2025-07-29',
        year: '2025',
        source: 'Comprehensive Release Data',
        status: 'Upcoming',
        description: 'Onyx RIPS Collection featuring baseball cards',
        retailPrice: 'TBD',
        hobbyPrice: 'TBD'
      },
      {
        title: '2025 Blowout Cards Mega Mix',
        brand: 'Blowout Cards',
        sport: 'Multi-Sport',
        releaseDate: '2025-07-30',
        year: '2025',
        source: 'Comprehensive Release Data',
        status: 'Upcoming',
        description: 'Mega mix collection from Blowout Cards',
        retailPrice: 'TBD',
        hobbyPrice: 'TBD'
      },
      {
        title: '2024 Pulse Lumin Baseball',
        brand: 'Pulse',
        sport: 'Baseball',
        releaseDate: '2025-07-30',
        year: '2024',
        source: 'Comprehensive Release Data',
        status: 'Upcoming',
        description: 'Pulse Lumin baseball card collection',
        retailPrice: 'TBD',
        hobbyPrice: 'TBD'
      },
      {
        title: '2025 Tristar Hidden Treasures Autographed Baseball 8 x 10 Photo Edition',
        brand: 'Tristar',
        sport: 'Baseball',
        releaseDate: '2025-07-30',
        year: '2025',
        source: 'Comprehensive Release Data',
        status: 'Upcoming',
        description: 'Autographed baseball 8x10 photo collection',
        retailPrice: 'TBD',
        hobbyPrice: 'TBD'
      },
      {
        title: '2025 Topps Garbage Pail Kids: Worst of GPK 40th Anniversary',
        brand: 'Topps',
        sport: 'Non-Sport',
        releaseDate: '2025-07-30',
        year: '2025',
        source: 'Comprehensive Release Data',
        status: 'Upcoming',
        description: '40th Anniversary Garbage Pail Kids collection',
        retailPrice: 'TBD',
        hobbyPrice: 'TBD'
      },
      {
        title: '2025/26 Upper Deck MVP Hockey',
        brand: 'Upper Deck',
        sport: 'Hockey',
        releaseDate: '2025-07-30',
        year: '2025',
        source: 'Comprehensive Release Data',
        status: 'Upcoming',
        description: 'Upper Deck MVP hockey card series',
        retailPrice: 'TBD',
        hobbyPrice: 'TBD'
      },
      {
        title: '2025 Leaf Metal Baseball Hobby & Jumbo',
        brand: 'Leaf',
        sport: 'Baseball',
        releaseDate: '2025-08-01',
        year: '2025',
        source: 'Comprehensive Release Data',
        status: 'Upcoming',
        description: 'Leaf Metal baseball cards in hobby and jumbo formats',
        retailPrice: 'TBD',
        hobbyPrice: 'TBD'
      },
      {
        title: '2024/25 Panini Mosaic Basketball Fast Break',
        brand: 'Panini',
        sport: 'Basketball',
        releaseDate: '2025-08-01',
        year: '2024',
        source: 'Comprehensive Release Data',
        status: 'Upcoming',
        description: 'Panini Mosaic basketball Fast Break edition',
        retailPrice: 'TBD',
        hobbyPrice: 'TBD'
      },
      {
        title: '2024/25 Topps Chrome Manchester United Soccer Deluxe Edition',
        brand: 'Topps',
        sport: 'Soccer',
        releaseDate: '2025-08-01',
        year: '2024',
        source: 'Comprehensive Release Data',
        status: 'Upcoming',
        description: 'Topps Chrome Manchester United deluxe edition',
        retailPrice: 'TBD',
        hobbyPrice: 'TBD'
      },
      {
        title: 'Pokemon Scarlet & Violet Victini Illustration Collection',
        brand: 'Pokemon',
        sport: 'Gaming',
        releaseDate: '2025-08-01',
        year: '2025',
        source: 'Comprehensive Release Data',
        status: 'Upcoming',
        description: 'Pokemon Scarlet & Violet Victini illustration cards',
        retailPrice: 'TBD',
        hobbyPrice: 'TBD'
      },
      {
        title: '2025 Pro Athletes Direct Signature Edition Football',
        brand: 'Pro Athletes Direct',
        sport: 'Football',
        releaseDate: '2025-08-04',
        year: '2025',
        source: 'Comprehensive Release Data',
        status: 'Upcoming',
        description: 'Signature edition football cards from Pro Athletes Direct',
        retailPrice: 'TBD',
        hobbyPrice: 'TBD'
      },
      {
        title: '2024/25 Panini Noir Soccer',
        brand: 'Panini',
        sport: 'Soccer',
        releaseDate: '2025-08-06',
        year: '2024',
        source: 'Comprehensive Release Data',
        status: 'Upcoming',
        description: 'Panini Noir premium soccer card collection',
        retailPrice: 'TBD',
        hobbyPrice: 'TBD'
      },
      {
        title: '2024 Panini National Treasures Football',
        brand: 'Panini',
        sport: 'Football',
        releaseDate: '2025-08-06',
        year: '2024',
        source: 'Comprehensive Release Data',
        status: 'Upcoming',
        description: 'Panini National Treasures premium football cards',
        retailPrice: 'TBD',
        hobbyPrice: 'TBD'
      },
      {
        title: '2025 Topps Archives Signature Series Active Player Edition Baseball',
        brand: 'Topps',
        sport: 'Baseball',
        releaseDate: '2025-08-06',
        year: '2025',
        source: 'Comprehensive Release Data',
        status: 'Upcoming',
        description: 'Topps Archives signature series with active players',
        retailPrice: 'TBD',
        hobbyPrice: 'TBD'
      },
      {
        title: '2025 Topps Chrome Baseball Mega',
        brand: 'Topps',
        sport: 'Baseball',
        releaseDate: '2025-08-06',
        year: '2025',
        source: 'Comprehensive Release Data',
        status: 'Upcoming',
        description: 'Topps Chrome baseball mega edition',
        retailPrice: 'TBD',
        hobbyPrice: 'TBD'
      },
      {
        title: '2025 Topps Complete Baseball Factory Set',
        brand: 'Topps',
        sport: 'Baseball',
        releaseDate: '2025-08-06',
        year: '2025',
        source: 'Comprehensive Release Data',
        status: 'Upcoming',
        description: 'Complete Topps baseball factory set',
        retailPrice: 'TBD',
        hobbyPrice: 'TBD'
      },
      {
        title: '2025 Upper Deck AEW Skybox Metal Universe',
        brand: 'Upper Deck',
        sport: 'Wrestling',
        releaseDate: '2025-08-06',
        year: '2025',
        source: 'Comprehensive Release Data',
        status: 'Upcoming',
        description: 'Upper Deck AEW wrestling cards in Metal Universe style',
        retailPrice: 'TBD',
        hobbyPrice: 'TBD'
      },
      {
        title: '2024/25 Upper Deck Professional Women\'s Hockey League',
        brand: 'Upper Deck',
        sport: 'Hockey',
        releaseDate: '2025-08-06',
        year: '2024',
        source: 'Comprehensive Release Data',
        status: 'Upcoming',
        description: 'Upper Deck Professional Women\'s Hockey League cards',
        retailPrice: 'TBD',
        hobbyPrice: 'TBD'
      },
      {
        title: '2025 Leaf Glory of the Game Football',
        brand: 'Leaf',
        sport: 'Football',
        releaseDate: '2025-08-08',
        year: '2025',
        source: 'Comprehensive Release Data',
        status: 'Upcoming',
        description: 'Leaf Glory of the Game football collection',
        retailPrice: 'TBD',
        hobbyPrice: 'TBD'
      },
      {
        title: '2025 Leaf National Lacrosse League Premier Edition',
        brand: 'Leaf',
        sport: 'Lacrosse',
        releaseDate: '2025-08-08',
        year: '2025',
        source: 'Comprehensive Release Data',
        status: 'Upcoming',
        description: 'Leaf National Lacrosse League premier edition',
        retailPrice: 'TBD',
        hobbyPrice: 'TBD'
      },
      {
        title: '2025 Panini Boys of Summer Baseball',
        brand: 'Panini',
        sport: 'Baseball',
        releaseDate: '2025-08-08',
        year: '2025',
        source: 'Comprehensive Release Data',
        status: 'Upcoming',
        description: 'Panini Boys of Summer baseball collection',
        retailPrice: 'TBD',
        hobbyPrice: 'TBD'
      },
      {
        title: '2025 Topps UFC Midnight',
        brand: 'Topps',
        sport: 'MMA',
        releaseDate: '2025-08-08',
        year: '2025',
        source: 'Comprehensive Release Data',
        status: 'Upcoming',
        description: 'Topps UFC Midnight edition cards',
        retailPrice: 'TBD',
        hobbyPrice: 'TBD'
      },
      {
        title: '2025 Topps Finest Baseball',
        brand: 'Topps',
        sport: 'Baseball',
        releaseDate: '2025-08-12',
        year: '2025',
        source: 'Comprehensive Release Data',
        status: 'Upcoming',
        description: 'Topps Finest premium baseball cards',
        retailPrice: 'TBD',
        hobbyPrice: 'TBD'
      },
      {
        title: '2025 Panini Prizm Baseball',
        brand: 'Panini',
        sport: 'Baseball',
        releaseDate: '2025-08-13',
        year: '2025',
        source: 'Comprehensive Release Data',
        status: 'Upcoming',
        description: 'Panini Prizm baseball card collection',
        retailPrice: 'TBD',
        hobbyPrice: 'TBD'
      },
      {
        title: '2024/25 Upper Deck SP Authentic Hockey',
        brand: 'Upper Deck',
        sport: 'Hockey',
        releaseDate: '2025-08-13',
        year: '2024',
        source: 'Comprehensive Release Data',
        status: 'Upcoming',
        description: 'Upper Deck SP Authentic hockey cards',
        retailPrice: 'TBD',
        hobbyPrice: 'TBD'
      },
      {
        title: '2024/25 Topps Finest Basketball',
        brand: 'Topps',
        sport: 'Basketball',
        releaseDate: '2025-08-14',
        year: '2024',
        source: 'Comprehensive Release Data',
        status: 'Upcoming',
        description: 'Topps Finest basketball cards',
        retailPrice: 'TBD',
        hobbyPrice: 'TBD'
      },
      {
        title: '2024/25 Topps Finest Basketball Breaker\'s Delight',
        brand: 'Topps',
        sport: 'Basketball',
        releaseDate: '2025-08-14',
        year: '2024',
        source: 'Comprehensive Release Data',
        status: 'Upcoming',
        description: 'Topps Finest basketball Breaker\'s Delight edition',
        retailPrice: 'TBD',
        hobbyPrice: 'TBD'
      },
      {
        title: '2025 Leaf Eclectic PBA Hobby & Jumbo',
        brand: 'Leaf',
        sport: 'Bowling',
        releaseDate: '2025-08-15',
        year: '2025',
        source: 'Comprehensive Release Data',
        status: 'Upcoming',
        description: 'Leaf Eclectic PBA bowling cards in hobby and jumbo formats',
        retailPrice: 'TBD',
        hobbyPrice: 'TBD'
      },
      {
        title: '2025 Leaf Major League Table Tennis Premier Edition',
        brand: 'Leaf',
        sport: 'Table Tennis',
        releaseDate: '2025-08-15',
        year: '2025',
        source: 'Comprehensive Release Data',
        status: 'Upcoming',
        description: 'Leaf Major League Table Tennis premier edition',
        retailPrice: 'TBD',
        hobbyPrice: 'TBD'
      },
      {
        title: '2025 Panini Donruss Football',
        brand: 'Panini',
        sport: 'Football',
        releaseDate: '2025-08-15',
        year: '2025',
        source: 'Comprehensive Release Data',
        status: 'Upcoming',
        description: 'Panini Donruss football card collection',
        retailPrice: 'TBD',
        hobbyPrice: 'TBD'
      },
      {
        title: '2024/25 Panini National Treasures Basketball',
        brand: 'Panini',
        sport: 'Basketball',
        releaseDate: '2025-08-15',
        year: '2024',
        source: 'Comprehensive Release Data',
        status: 'Upcoming',
        description: 'Panini National Treasures premium basketball cards',
        retailPrice: 'TBD',
        hobbyPrice: 'TBD'
      },
      {
        title: '2024/25 Topps Chrome NBL Basketball',
        brand: 'Topps',
        sport: 'Basketball',
        releaseDate: '2025-08-15',
        year: '2024',
        source: 'Comprehensive Release Data',
        status: 'Upcoming',
        description: 'Topps Chrome NBL basketball cards',
        retailPrice: 'TBD',
        hobbyPrice: 'TBD'
      },
      {
        title: 'Foundation Seasons 1 & 2 (Rittenhouse)',
        brand: 'Rittenhouse',
        sport: 'Entertainment',
        releaseDate: '2025-08-20',
        year: '2025',
        source: 'Comprehensive Release Data',
        status: 'Upcoming',
        description: 'Foundation TV series trading cards from Rittenhouse',
        retailPrice: 'TBD',
        hobbyPrice: 'TBD'
      },
      {
        title: '2025 Panini Prizm Collegiate Draft Football',
        brand: 'Panini',
        sport: 'Football',
        releaseDate: '2025-08-20',
        year: '2025',
        source: 'Comprehensive Release Data',
        status: 'Upcoming',
        description: 'Panini Prizm collegiate draft football cards',
        retailPrice: 'TBD',
        hobbyPrice: 'TBD'
      },
      {
        title: '2025 Panini Prizm LIV Golf',
        brand: 'Panini',
        sport: 'Golf',
        releaseDate: '2025-08-20',
        year: '2025',
        source: 'Comprehensive Release Data',
        status: 'Upcoming',
        description: 'Panini Prizm LIV Golf card collection',
        retailPrice: 'TBD',
        hobbyPrice: 'TBD'
      },
      {
        title: 'The Boys Season 1 & 2',
        brand: 'Various',
        sport: 'Entertainment',
        releaseDate: '2025-08-20',
        year: '2025',
        source: 'Comprehensive Release Data',
        status: 'Upcoming',
        description: 'The Boys TV series trading cards',
        retailPrice: 'TBD',
        hobbyPrice: 'TBD'
      },
      {
        title: '2025 Tristar Hidden Treasures Football Autographed Full-Size Helmet Season Edition',
        brand: 'Tristar',
        sport: 'Football',
        releaseDate: '2025-08-20',
        year: '2025',
        source: 'Comprehensive Release Data',
        status: 'Upcoming',
        description: 'Tristar Hidden Treasures football autographed helmet collection',
        retailPrice: 'TBD',
        hobbyPrice: 'TBD'
      },
      {
        title: '2024 Panini Immaculate Football',
        brand: 'Panini',
        sport: 'Football',
        releaseDate: '2025-08-21',
        year: '2024',
        source: 'Comprehensive Release Data',
        status: 'Upcoming',
        description: 'Panini Immaculate premium football cards',
        retailPrice: 'TBD',
        hobbyPrice: 'TBD'
      },
      {
        title: '2025 Leaf Optichrome Football Hobby & Jumbo',
        brand: 'Leaf',
        sport: 'Football',
        releaseDate: '2025-08-22',
        year: '2025',
        source: 'Comprehensive Release Data',
        status: 'Upcoming',
        description: 'Leaf Optichrome football cards in hobby and jumbo formats',
        retailPrice: 'TBD',
        hobbyPrice: 'TBD'
      },
      {
        title: 'Pokemon 2025 Holiday Calendar',
        brand: 'Pokemon',
        sport: 'Gaming',
        releaseDate: '2025-08-22',
        year: '2025',
        source: 'Comprehensive Release Data',
        status: 'Upcoming',
        description: 'Pokemon 2025 holiday calendar collection',
        retailPrice: 'TBD',
        hobbyPrice: 'TBD'
      },
      {
        title: 'Pokemon Scarlet & Violet Black Bolt Booster Bundle',
        brand: 'Pokemon',
        sport: 'Gaming',
        releaseDate: '2025-08-22',
        year: '2025',
        source: 'Comprehensive Release Data',
        status: 'Upcoming',
        description: 'Pokemon Scarlet & Violet Black Bolt booster bundle',
        retailPrice: 'TBD',
        hobbyPrice: 'TBD'
      },
      {
        title: 'Pokemon Scarlet & Violet White Flare Booster Bundle',
        brand: 'Pokemon',
        sport: 'Gaming',
        releaseDate: '2025-08-22',
        year: '2025',
        source: 'Comprehensive Release Data',
        status: 'Upcoming',
        description: 'Pokemon Scarlet & Violet White Flare booster bundle',
        retailPrice: 'TBD',
        hobbyPrice: 'TBD'
      },
      {
        title: '2025 Panini Origins Football',
        brand: 'Panini',
        sport: 'Football',
        releaseDate: '2025-08-27',
        year: '2025',
        source: 'Comprehensive Release Data',
        status: 'Upcoming',
        description: 'Panini Origins football card collection',
        retailPrice: 'TBD',
        hobbyPrice: 'TBD'
      },
      {
        title: '2025 Panini Prizm FIFA Club World Cup Soccer',
        brand: 'Panini',
        sport: 'Soccer',
        releaseDate: '2025-08-27',
        year: '2025',
        source: 'Comprehensive Release Data',
        status: 'Upcoming',
        description: 'Panini Prizm FIFA Club World Cup soccer cards',
        retailPrice: 'TBD',
        hobbyPrice: 'TBD'
      },
      {
        title: '2025 Panini Select Racing',
        brand: 'Panini',
        sport: 'Racing',
        releaseDate: '2025-08-27',
        year: '2025',
        source: 'Comprehensive Release Data',
        status: 'Upcoming',
        description: 'Panini Select racing card collection',
        retailPrice: 'TBD',
        hobbyPrice: 'TBD'
      },
      {
        title: '2025 Tristar Hidden Treasures Autographed Photos Football',
        brand: 'Tristar',
        sport: 'Football',
        releaseDate: '2025-08-27',
        year: '2025',
        source: 'Comprehensive Release Data',
        status: 'Upcoming',
        description: 'Tristar Hidden Treasures football autographed photos',
        retailPrice: 'TBD',
        hobbyPrice: 'TBD'
      },
      {
        title: '2024/25 Upper Deck Clear Cut Hockey',
        brand: 'Upper Deck',
        sport: 'Hockey',
        releaseDate: '2025-08-27',
        year: '2024',
        source: 'Comprehensive Release Data',
        status: 'Upcoming',
        description: 'Upper Deck Clear Cut hockey cards',
        retailPrice: 'TBD',
        hobbyPrice: 'TBD'
      },
      {
        title: 'James Bond 007 No Time To Die (Upper Deck)',
        brand: 'Upper Deck',
        sport: 'Entertainment',
        releaseDate: '2025-08-27',
        year: '2025',
        source: 'Comprehensive Release Data',
        status: 'Upcoming',
        description: 'James Bond 007 No Time To Die trading cards from Upper Deck',
        retailPrice: 'TBD',
        hobbyPrice: 'TBD'
      },
      {
        title: '2025 Pieces of the Past 1776: The Freedom Fighters Veterans Edition',
        brand: 'Pieces of the Past',
        sport: 'Historical',
        releaseDate: '2025-08-28',
        year: '2025',
        source: 'Comprehensive Release Data',
        status: 'Upcoming',
        description: 'Pieces of the Past 1776 Freedom Fighters veterans edition',
        retailPrice: 'TBD',
        hobbyPrice: 'TBD'
      },
      {
        title: 'Skybox Metal Universe Batman (Upper Deck)',
        brand: 'Upper Deck',
        sport: 'Entertainment',
        releaseDate: '2025-08-29',
        year: '2025',
        source: 'Comprehensive Release Data',
        status: 'Upcoming',
        description: 'Skybox Metal Universe Batman trading cards from Upper Deck',
        retailPrice: 'TBD',
        hobbyPrice: 'TBD'
      },
      {
        title: '2024/25 Panini Donruss Optic Choice Basketball',
        brand: 'Panini',
        sport: 'Basketball',
        releaseDate: '2025-08-29',
        year: '2024',
        source: 'Comprehensive Release Data',
        status: 'Upcoming',
        description: 'Panini Donruss Optic Choice basketball cards',
        retailPrice: 'TBD',
        hobbyPrice: 'TBD'
      },
      {
        title: '2025 Panini Impeccable Baseball',
        brand: 'Panini',
        sport: 'Baseball',
        releaseDate: '2025-08-29',
        year: '2025',
        source: 'Comprehensive Release Data',
        status: 'Upcoming',
        description: 'Panini Impeccable premium baseball cards',
        retailPrice: 'TBD',
        hobbyPrice: 'TBD'
      },
      {
        title: '2024/25 Panini Silhouette Basketball',
        brand: 'Panini',
        sport: 'Basketball',
        releaseDate: '2025-08-29',
        year: '2024',
        source: 'Comprehensive Release Data',
        status: 'Upcoming',
        description: 'Panini Silhouette premium basketball cards',
        retailPrice: 'TBD',
        hobbyPrice: 'TBD'
      },
      {
        title: '2026 Topps Series One Baseball',
        brand: 'Topps',
        sport: 'Baseball',
        releaseDate: '2026-01-15',
        year: '2026',
        source: 'Comprehensive Release Data',
        status: 'Announced',
        description: 'The flagship 2026 baseball card set featuring current MLB players and rookies',
        retailPrice: 'TBD',
        hobbyPrice: 'TBD'
      },
      {
        title: '2026 Bowman Chrome Baseball',
        brand: 'Bowman',
        sport: 'Baseball',
        releaseDate: '2026-02-05',
        year: '2026',
        source: 'Comprehensive Release Data',
        status: 'Announced',
        description: 'Chrome prospect cards featuring future MLB stars',
        retailPrice: 'TBD',
        hobbyPrice: 'TBD'
      },
      {
        title: '2025/26 Panini Prizm Basketball',
        brand: 'Panini',
        sport: 'Basketball',
        releaseDate: '2026-01-22',
        year: '2026',
        source: 'Comprehensive Release Data',
        status: 'Announced',
        description: 'Premium basketball cards with stunning Prizm technology',
        retailPrice: 'TBD',
        hobbyPrice: 'TBD'
      },
      {
        title: '2025/26 Upper Deck Young Guns Hockey',
        brand: 'Upper Deck',
        sport: 'Hockey',
        releaseDate: '2026-02-12',
        year: '2026',
        source: 'Comprehensive Release Data',
        status: 'Announced',
        description: 'Premier rookie cards for NHL prospects',
        retailPrice: 'TBD',
        hobbyPrice: 'TBD'
      },
      {
        title: '2026 Topps Chrome Baseball',
        brand: 'Topps',
        sport: 'Baseball',
        releaseDate: '2026-03-01',
        year: '2026',
        source: 'Comprehensive Release Data',
        status: 'Announced',
        description: 'Chrome version of the flagship baseball set',
        retailPrice: 'TBD',
        hobbyPrice: 'TBD'
      },
      {
        title: '2025/26 Panini Select Basketball',
        brand: 'Panini',
        sport: 'Basketball',
        releaseDate: '2026-03-15',
        year: '2026',
        source: 'Comprehensive Release Data',
        status: 'Announced',
        description: 'Select basketball cards with unique design',
        retailPrice: 'TBD',
        hobbyPrice: 'TBD'
      },
      {
        title: '2026 Topps Heritage Baseball',
        brand: 'Topps',
        sport: 'Baseball',
        releaseDate: '2026-04-02',
        year: '2026',
        source: 'Comprehensive Release Data',
        status: 'Announced',
        description: 'Retro-style cards inspired by classic Topps designs',
        retailPrice: 'TBD',
        hobbyPrice: 'TBD'
      },
      {
        title: '2026 Bowman Baseball',
        brand: 'Bowman',
        sport: 'Baseball',
        releaseDate: '2026-05-07',
        year: '2026',
        source: 'Comprehensive Release Data',
        status: 'Announced',
        description: 'Paper prospect cards featuring future stars',
        retailPrice: 'TBD',
        hobbyPrice: 'TBD'
      },
      {
        title: '2026 Topps Series Two Baseball',
        brand: 'Topps',
        sport: 'Baseball',
        releaseDate: '2026-06-11',
        year: '2026',
        source: 'Comprehensive Release Data',
        status: 'Announced',
        description: 'Second series of the flagship baseball set',
        retailPrice: 'TBD',
        hobbyPrice: 'TBD'
      },
      {
        title: '2025/26 Panini Donruss Football',
        brand: 'Panini',
        sport: 'Football',
        releaseDate: '2026-07-08',
        year: '2026',
        source: 'Comprehensive Release Data',
        status: 'Announced',
        description: 'Classic Donruss football cards with modern design',
        retailPrice: 'TBD',
        hobbyPrice: 'TBD'
      }
    ];
  }

  determineStatus(releaseDate) {
    if (!releaseDate) return 'Unknown';
    
    try {
      const release = new Date(releaseDate);
      const now = new Date();
      
      if (release < now) {
        return 'Released';
      } else if (release.getTime() - now.getTime() < 30 * 24 * 60 * 60 * 1000) { // 30 days
        return 'Upcoming';
      } else {
        return 'Announced';
      }
    } catch (error) {
      return 'Unknown';
    }
  }

  async getAllReleases() {
    try {
      const releases = await this.getReleaseData();
      
      // Sort by release date
      releases.sort((a, b) => {
        const dateA = new Date(a.releaseDate || 0);
        const dateB = new Date(b.releaseDate || 0);
        return dateA - dateB; // Earliest first
      });

      return releases;

    } catch (error) {
      console.error('❌ Error getting all releases:', error.message);
      return this.getComprehensiveReleases();
    }
  }
}

module.exports = new ReleaseInfoService(); 