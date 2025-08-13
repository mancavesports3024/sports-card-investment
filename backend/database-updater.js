require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { search130point } = require('./services/130pointService');

// Database files
const DATABASE_FILE = path.join(__dirname, 'data', 'psa10_recent_90_days_database.json');
const BACKUP_DIR = path.join(__dirname, 'data', 'backups');

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// Create backup of current database
function createBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(BACKUP_DIR, `psa10_database_backup_${timestamp}.json`);
  
  try {
    fs.copyFileSync(DATABASE_FILE, backupFile);
    console.log(`💾 Backup created: ${backupFile}`);
    return backupFile;
  } catch (error) {
    console.error('❌ Error creating backup:', error.message);
    return null;
  }
}

// Load existing database
function loadDatabase() {
  try {
    const data = fs.readFileSync(DATABASE_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('❌ Error loading database:', error.message);
    return null;
  }
}

// Save database
function saveDatabase(data) {
  try {
    data.metadata.lastUpdated = new Date().toISOString();
    data.metadata.totalItems = data.items.length;
    fs.writeFileSync(DATABASE_FILE, JSON.stringify(data, null, 2));
    console.log(`✅ Database saved: ${data.items.length} items`);
  } catch (error) {
    console.error('❌ Error saving database:', error.message);
  }
}

// Get items older than X days
function getOldItems(data, daysOld = 7) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  return data.items.filter(item => {
    const soldDate = new Date(item.soldDate);
    return soldDate < cutoffDate;
  });
}

// Update existing items with fresh data
async function updateExistingItems(data, daysToUpdate = 7) {
  console.log(`🔄 Updating items older than ${daysToUpdate} days...`);
  
  const oldItems = getOldItems(data, daysToUpdate);
  console.log(`📊 Found ${oldItems.length} items to update`);
  
  let updatedCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < oldItems.length; i++) {
    const item = oldItems[i];
    
    try {
      console.log(`\n📈 Updating item ${i + 1}/${oldItems.length}: ${item.summaryTitle}`);
      
      // Search for the same card with recent sales
      const searchQuery = `${item.summaryTitle} PSA 10`;
      const results = await search130point(searchQuery, 10);
      
      if (results && results.length > 0) {
        // Find the most recent sale
        const recentSales = results
          .map(sale => ({
            ...sale,
            soldDate: new Date(sale.soldDate)
          }))
          .sort((a, b) => b.soldDate - a.soldDate);
        
        const mostRecent = recentSales[0];
        
        // Update if we found a more recent sale
        if (new Date(mostRecent.soldDate) > new Date(item.soldDate)) {
          console.log(`   ✅ Found newer sale: $${mostRecent.price.value} (${mostRecent.soldDate.toLocaleDateString()})`);
          
          // Update item data
          item.price = mostRecent.price;
          item.soldDate = mostRecent.soldDate;
          item.itemWebUrl = mostRecent.itemWebUrl;
          item.imageUrl = mostRecent.imageUrl;
          item.lastUpdated = new Date().toISOString();
          
          updatedCount++;
        } else {
          console.log(`   ⏭️  No newer sales found`);
        }
      }
      
      // Small delay between searches
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.log(`   ❌ Error updating item: ${error.message}`);
      errorCount++;
    }
  }
  
  console.log(`\n📊 Update Summary:`);
  console.log(`   Items checked: ${oldItems.length}`);
  console.log(`   Items updated: ${updatedCount}`);
  console.log(`   Errors: ${errorCount}`);
  
  return updatedCount;
}

// Improved card number extraction function
function extractCardNumber(title) {
  if (!title) return null;
  
  // Look for specific card number patterns
  const patterns = [
    // Pattern: #USC27, #123, #ABC123, etc. (with #)
    /#([A-Z]{1,4}\d{1,4})/i,
    
    // Pattern: USC27, 123, ABC123 (without # but as standalone)
    /\b([A-Z]{1,4}\d{1,4})\b/i,
    
    // Pattern: Card #123, Number #123
    /(?:card|number)\s*#\s*([A-Z]*\d+)/i,
    
    // Pattern: 123/456 (Pokemon style)
    /\b(\d{1,3}\/\d{1,3})\b/,
    
    // Pattern: 020/032 (Pokemon style with leading zeros)
    /\b(\d{3}\/\d{3})\b/,
    
    // Pattern: 123-456 (some card formats)
    /\b(\d{1,3}-\d{1,3})\b/,
    
    // Pattern: 123.456 (some card formats)
    /\b(\d{1,3}\.\d{1,3})\b/
  ];
  
  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match && match[1]) {
      const cardNumber = match[1].trim();
      
      // Validate the card number - exclude years and other common false positives
      if (cardNumber.length >= 2 && 
          cardNumber.length <= 15 &&
          !cardNumber.match(/^(19|20)\d{2}$/) && // Not a year
          !cardNumber.match(/^\d{4}$/) && // Not a 4-digit year-like number
          !cardNumber.match(/^(PSA|SGC|BGS|CGC|CSG|HGA|TAG)\d+$/i) && // Not a grading company
          !cardNumber.match(/^(GEM|MINT|NM|EX|VG|GOOD|PR)\d*$/i)) { // Not a grade
        return cardNumber;
      }
    }
  }
  
  return null;
}

// Function to clean up summary titles
function cleanSummaryTitle(summaryTitle) {
  if (!summaryTitle) return summaryTitle;
  
  let cleaned = summaryTitle;
  
  // Remove redundant "Update Baseball" 
  cleaned = cleaned.replace(/\bUpdate Baseball\b/g, 'Update');
  
  // Remove redundant "Topps Topps" (keep just "Topps")
  cleaned = cleaned.replace(/\bTopps Topps\b/g, 'Topps');
  
  // Remove redundant "Panini Panini" (keep just "Panini")
  cleaned = cleaned.replace(/\bPanini Panini\b/g, 'Panini');
  
  // Remove redundant "Upper Deck Upper Deck" (keep just "Upper Deck")
  cleaned = cleaned.replace(/\bUpper Deck Upper Deck\b/g, 'Upper Deck');
  
  // Remove redundant "Donruss Donruss" (keep just "Donruss")
  cleaned = cleaned.replace(/\bDonruss Donruss\b/g, 'Donruss');
  
  // Remove redundant "Prizm Prizm" (keep just "Prizm")
  cleaned = cleaned.replace(/\bPrizm Prizm\b/g, 'Prizm');
  
  // Remove redundant "Select Select" (keep just "Select")
  cleaned = cleaned.replace(/\bSelect Select\b/g, 'Select');
  
  // Remove redundant "Chrome Chrome" (keep just "Chrome")
  cleaned = cleaned.replace(/\bChrome Chrome\b/g, 'Chrome');
  
  // Remove redundant "Mosaic Mosaic" (keep just "Mosaic")
  cleaned = cleaned.replace(/\bMosaic Mosaic\b/g, 'Mosaic');
  
  // Remove redundant "Bowman Bowman" (keep just "Bowman")
  cleaned = cleaned.replace(/\bBowman Bowman\b/g, 'Bowman');
  
  // Remove redundant "Pokemon Pokemon" (keep just "Pokemon")
  cleaned = cleaned.replace(/\bPokemon Pokemon\b/g, 'Pokemon');
  
  // Remove redundant "Magic Magic" (keep just "Magic")
  cleaned = cleaned.replace(/\bMagic Magic\b/g, 'Magic');
  
  // Remove redundant "Yu-Gi-Oh Yu-Gi-Oh" (keep just "Yu-Gi-Oh")
  cleaned = cleaned.replace(/\bYu-Gi-Oh Yu-Gi-Oh\b/g, 'Yu-Gi-Oh');
  
  // Remove redundant "One Piece One Piece" (keep just "One Piece")
  cleaned = cleaned.replace(/\bOne Piece One Piece\b/g, 'One Piece');
  
  // Remove redundant "Obsidian Obsidian" (keep just "Obsidian")
  cleaned = cleaned.replace(/\bObsidian Obsidian\b/g, 'Obsidian');
  
  // Remove redundant "Chronicles Chronicles" (keep just "Chronicles")
  cleaned = cleaned.replace(/\bChronicles Chronicles\b/g, 'Chronicles');
  
  // Remove redundant "Threads Threads" (keep just "Threads")
  cleaned = cleaned.replace(/\bThreads Threads\b/g, 'Threads');
  
  // Remove redundant "Hoops Hoops" (keep just "Hoops")
  cleaned = cleaned.replace(/\bHoops Hoops\b/g, 'Hoops');
  
  // Remove redundant "Score Score" (keep just "Score")
  cleaned = cleaned.replace(/\bScore Score\b/g, 'Score');
  
  // Remove redundant "Fleer Fleer" (keep just "Fleer")
  cleaned = cleaned.replace(/\bFleer Fleer\b/g, 'Fleer');
  
  // Remove redundant "Stadium Club Stadium Club" (keep just "Stadium Club")
  cleaned = cleaned.replace(/\bStadium Club Stadium Club\b/g, 'Stadium Club');
  
  // Remove redundant "Finest Finest" (keep just "Finest")
  cleaned = cleaned.replace(/\bFinest Finest\b/g, 'Finest');
  
  // Clean up multiple spaces
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  return cleaned;
}

// Function to check if item should be excluded (lot or bundle)
function shouldExcludeItem(item) {
  const title = item.title || '';
  const lowerTitle = title.toLowerCase();
  
  // Check for lot or bundle keywords
  const excludeKeywords = ['lot', 'bundle', 'lots', 'bundles'];
  
  return excludeKeywords.some(keyword => lowerTitle.includes(keyword));
}

// Function to create summary title for new items
function createSummaryTitle(item) {
  const title = item.title;
  
  if (!title) return '';
  
  let cleanedTitle = title;
  
  // Remove unwanted keywords (case insensitive)
  const unwantedKeywords = [
    'RC', 'Rookie', 'ROOKIE', 'rookie',
    'SP', 'sp',
    'PSA 10', 'psa 10', 'PSA10', 'psa10',
    'GEM MINT', 'Gem Mint', 'gem mint', 'GEM', 'Gem', 'gem',
    'MINT', 'Mint', 'mint',
    'Full Art', 'full art', 'FULL ART',
    'PSA 5', 'psa 5', 'PSA5', 'psa5',
    'EX', 'Ex', 'ex',
    'GEM MINT PSA 10', 'Gem Mint PSA 10', 'gem mint psa 10',
    'PSA 10 GEM MINT', 'psa 10 gem mint',
    'GEM MINT PSA', 'Gem Mint PSA', 'gem mint psa',
    'PSA GEM MINT', 'psa gem mint',
    '25th Anniversary', '25th anniversary', '25TH ANNIVERSARY',
    'POP*', 'pop*', 'Pop*',
    'Base Set', 'base set', 'BASE SET',
    'PSA AUTH', 'psa auth', 'PSA AUTH',
    'Rare', 'rare', 'RARE',
    'Football Card', 'football card', 'FOOTBALL CARD',

    'RPA', 'rpa', 'Rpa',
    'team usa', 'Team USA', 'TEAM USA',
    'PLAYER WORN PATCH', 'Player Worn Patch', 'player worn patch',
    'Series 2', 'series 2', 'SERIES 2',
    'Series 1', 'series 1', 'SERIES 1',
    'updated', 'Updated', 'UPDATED',
    'update', 'Update', 'UPDATE',
    'update series', 'Update Series', 'UPDATE SERIES',
    'Ultra Rare', 'ultra rare', 'ULTRA RARE',
    'cards', 'Cards', 'CARDS',
    'Signed Basketball Card', 'signed basketball card', 'SIGNED BASKETBALL CARD',
    'Signed', 'signed', 'SIGNED',
    'RPA GU Patch PSA PSA/DNA', 'rpa gu patch psa psa/dna', 'RPA GU PATCH PSA PSA/DNA',
    'HOF', 'hof', 'Hof',
    'Autographs', 'autographs', 'AUTOGRAPHS',
    'PSA', 'psa', 'PSA/DNA', 'psa/dna',
    // New keywords to remove
    '2nd Year Card', '2nd year card', '2ND YEAR CARD',
    'MT', 'mt',
    'SSP', 'ssp', 'Ssp',
    'Graded', 'graded', 'GRADED',
    'numbered football', 'Numbered Football', 'NUMBERED FOOTBALL',
    'rookies', 'Rookies', 'ROOKIES',
    'numbered', 'Numbered', 'NUMBERED',
    'case hit', 'Case Hit', 'CASE HIT',
    'Game-Used Patch', 'game-used patch', 'GAME-USED PATCH',
    'Game Used Patch', 'game used patch', 'GAME USED PATCH',
    // Additional keywords to remove
    'Cleveland Basketball', 'cleveland basketball', 'CLEVELAND BASKETBALL',
    'ONE WEEK ONLY', 'one week only', 'One Week Only',
    'Free S&H', 'free s&h', 'FREE S&H', 'Free S&H', 'free S&H',
    'insert', 'Insert', 'INSERT',
    'The Insert', 'the insert', 'THE INSERT',
    // More keywords to remove
    'GAME WORN PATCH', 'game worn patch', 'Game Worn Patch',
    'NFL Football', 'nfl football', 'Nfl Football',
    'STOCK PHOTO', 'stock photo', 'Stock Photo',
    'LEGEND', 'legend', 'Legend',
    'Good as', 'good as', 'GOOD AS',
    // Additional keywords to remove
    'Slab', 'slab', 'SLAB',
    'TCG', 'tcg', 'Tcg',
    'ON-CARD', 'on-card', 'On-Card', 'ON CARD', 'on card', 'On Card'
  ];
  
  // Remove POP followed by numbers (like "POP 5", "Pop 1", "pop 10")
  cleanedTitle = cleanedTitle.replace(/\bPOP\s+\d+\b/gi, '');
  
  // Replace "Autograph" with "auto" (case insensitive)
  cleanedTitle = cleanedTitle.replace(/\bAutograph\b/gi, 'auto');
  
  // Remove each unwanted keyword
  unwantedKeywords.forEach(keyword => {
    const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    cleanedTitle = cleanedTitle.replace(regex, '');
  });
  
  // Remove 8-digit PSA certificate numbers (like 50979626)
  cleanedTitle = cleanedTitle.replace(/\b\d{8}\b/g, '');
  
  // Remove team names from all major sports leagues
  const teamNames = [
    // NBA Teams
    'Atlanta Hawks', 'Boston Celtics', 'Brooklyn Nets', 'Charlotte Hornets', 'Chicago Bulls',
    'Cleveland Cavaliers', 'Dallas Mavericks', 'Denver Nuggets', 'Detroit Pistons', 'Golden State Warriors',
    'Houston Rockets', 'Indiana Pacers', 'Los Angeles Clippers', 'Los Angeles Lakers', 'Memphis Grizzlies',
    'Miami Heat', 'Milwaukee Bucks', 'Minnesota Timberwolves', 'New Orleans Pelicans', 'New York Knicks',
    'Oklahoma City Thunder', 'Orlando Magic', 'Philadelphia 76ers', 'Phoenix Suns', 'Portland Trail Blazers',
    'Sacramento Kings', 'San Antonio Spurs', 'Toronto Raptors', 'Utah Jazz', 'Washington Wizards',
    // NFL Teams
    'Arizona Cardinals', 'Atlanta Falcons', 'Baltimore Ravens', 'Buffalo Bills', 'Carolina Panthers',
    'Chicago Bears', 'Cincinnati Bengals', 'Cleveland Browns', 'Dallas Cowboys', 'Denver Broncos',
    'Detroit Lions', 'Green Bay Packers', 'Houston Texans', 'Indianapolis Colts', 'Jacksonville Jaguars',
    'Kansas City Chiefs', 'Las Vegas Raiders', 'Los Angeles Chargers', 'Los Angeles Rams', 'Miami Dolphins',
    'Minnesota Vikings', 'New England Patriots', 'New Orleans Saints', 'New York Giants', 'New York Jets',
    'Philadelphia Eagles', 'Pittsburgh Steelers', 'San Francisco 49ers', 'Seattle Seahawks', 'Tampa Bay Buccaneers',
    'Tennessee Titans', 'Washington Commanders',
    // MLB Teams
    'Arizona Diamondbacks', 'Atlanta Braves', 'Baltimore Orioles', 'Boston Red Sox', 'Chicago Cubs',
    'Chicago White Sox', 'Cincinnati Reds', 'Cleveland Guardians', 'Colorado Rockies', 'Detroit Tigers',
    'Houston Astros', 'Kansas City Royals', 'Los Angeles Angels', 'Los Angeles Dodgers', 'Miami Marlins',
    'Milwaukee Brewers', 'Minnesota Twins', 'New York Mets', 'New York Yankees', 'Oakland Athletics',
    'Philadelphia Phillies', 'Pittsburgh Pirates', 'San Diego Padres', 'San Francisco Giants', 'Seattle Mariners',
    'St. Louis Cardinals', 'Tampa Bay Rays', 'Texas Rangers', 'Toronto Blue Jays', 'Washington Nationals',
    // NHL Teams
    'Anaheim Ducks', 'Arizona Coyotes', 'Boston Bruins', 'Buffalo Sabres', 'Calgary Flames',
    'Carolina Hurricanes', 'Chicago Blackhawks', 'Colorado Avalanche', 'Columbus Blue Jackets', 'Dallas Stars',
    'Detroit Red Wings', 'Edmonton Oilers', 'Florida Panthers', 'Los Angeles Kings', 'Minnesota Wild',
    'Montreal Canadiens', 'Nashville Predators', 'New Jersey Devils', 'New York Islanders', 'New York Rangers',
    'Ottawa Senators', 'Philadelphia Flyers', 'Pittsburgh Penguins', 'San Jose Sharks', 'Seattle Kraken',
    'St. Louis Blues', 'Tampa Bay Lightning', 'Toronto Maple Leafs', 'Vancouver Canucks', 'Vegas Golden Knights',
    'Washington Capitals', 'Winnipeg Jets',
    // Soccer Teams (Major League Soccer)
    'Atlanta United', 'Austin FC', 'Charlotte FC', 'Chicago Fire', 'Colorado Rapids',
    'Columbus Crew', 'DC United', 'FC Cincinnati', 'FC Dallas', 'Houston Dynamo',
    'Inter Miami', 'LA Galaxy', 'Los Angeles FC', 'Minnesota United', 'Montreal Impact',
    'Nashville SC', 'New England Revolution', 'New York City FC', 'New York Red Bulls', 'Orlando City',
    'Philadelphia Union', 'Portland Timbers', 'Real Salt Lake', 'San Jose Earthquakes', 'Seattle Sounders',
    'Sporting Kansas City', 'Toronto FC', 'Vancouver Whitecaps',
    // International Soccer Teams
    'Manchester United', 'Manchester City', 'Manchester',
    // Common team name variations and abbreviations
    'Hawks', 'Celtics', 'Nets', 'Hornets', 'Bulls', 'Cavaliers', 'Cavs', 'Mavericks', 'Mavs',
    'Nuggets', 'Pistons', 'Warriors', 'Rockets', 'Pacers', 'Clippers', 'Lakers', 'Grizzlies',
    'Heat', 'Bucks', 'Timberwolves', 'Wolves', 'Pelicans', 'Knicks', 'Thunder',
    '76ers', 'Suns', 'Trail Blazers', 'Blazers', 'Kings', 'Spurs', 'Raptors', 'Jazz', 'Wizards',
    'Cardinals', 'Cards', 'Falcons', 'Ravens', 'Bills', 'Panthers', 'Bears', 'Bengals',
    'Browns', 'Cowboys', 'Broncos', 'Lions', 'Packers', 'Texans', 'Colts', 'Jaguars', 'Jags',
    'Chiefs', 'Raiders', 'Chargers', 'Rams', 'Dolphins', 'Vikings', 'Patriots', 'Pats',
    'Saints', 'Giants', 'Jets', 'Eagles', 'Steelers', '49ers', 'Seahawks', 'Buccaneers', 'Bucs',
    'Titans', 'Commanders', 'Diamondbacks', 'D-backs', 'Braves', 'Orioles', 'Red Sox', 'Cubs',
    'White Sox', 'Reds', 'Guardians', 'Rockies', 'Tigers', 'Astros', 'Royals', 'Angels',
    'Dodgers', 'Marlins', 'Brewers', 'Twins', 'Mets', 'Yankees', 'Athletics', 'A\'s', 'Phillies',
    'Pirates', 'Padres', 'Giants', 'Mariners', 'Cardinals', 'Rays', 'Rangers', 'Blue Jays',
    'Nationals', 'Nats', 'Ducks', 'Coyotes', 'Bruins', 'Sabres', 'Flames', 'Hurricanes', 'Canes',
    'Blackhawks', 'Hawks', 'Avalanche', 'Avs', 'Blue Jackets', 'Jackets', 'Stars', 'Red Wings',
    'Wings', 'Oilers', 'Panthers', 'Kings', 'Wild', 'Canadiens', 'Habs', 'Predators', 'Preds',
    'Devils', 'Islanders', 'Isles', 'Rangers', 'Senators', 'Sens', 'Flyers', 'Penguins', 'Pens',
    'Sharks', 'Kraken', 'Blues', 'Lightning', 'Bolts', 'Maple Leafs', 'Leafs', 'Canucks',
    'Golden Knights', 'Knights', 'Capitals', 'Caps', 'Jets', 'United', 'Fire', 'Rapids',
    'Crew', 'Dynamo', 'Galaxy', 'Revolution', 'Revolution', 'Timbers', 'Sounders', 'Whitecaps'
  ];
  
  // Remove team names
  teamNames.forEach(teamName => {
    const regex = new RegExp(`\\b${teamName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    cleanedTitle = cleanedTitle.replace(regex, '');
  });
  
  // Special handling for PSA grades - remove "PSA" but keep the grade number
  // This handles cases like "PSA9" → "9", "PSA7" → "7", etc.
  cleanedTitle = cleanedTitle.replace(/\bPSA(\d+)\b/gi, '$1');
  cleanedTitle = cleanedTitle.replace(/\bpsa(\d+)\b/gi, '$1');
  
  // Remove odd characters (emojis, special characters, etc.)
  cleanedTitle = cleanedTitle.replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1F018}-\u{1F270}]|[\u{238C}-\u{2454}]|[\u{20D0}-\u{20FF}]|[\u{FE00}-\u{FE0F}]|[\u{1F900}-\u{1F9FF}]|[\u{1F018}-\u{1F270}]|[\u{238C}-\u{2454}]|[\u{20D0}-\u{20FF}]|[\u{FE00}-\u{FE0F}]/gu, '');
  
  // Remove other special characters that might cause issues
  cleanedTitle = cleanedTitle.replace(/[^\x00-\x7F]/g, ''); // Remove non-ASCII characters
  
  // Remove any remaining odd characters and symbols
  cleanedTitle = cleanedTitle.replace(/[^\w\s\-\.\#\&\//]/g, ''); // Keep only letters, numbers, spaces, hyphens, dots, #, &, and /
  
  // Remove extra spaces and trim
  cleanedTitle = cleanedTitle.replace(/\s+/g, ' ').trim();
  
  // Remove duplicate words (case insensitive)
  const words = cleanedTitle.split(' ');
  const uniqueWords = [];
  const seenWords = new Set();
  
  for (const word of words) {
    const lowerWord = word.toLowerCase();
    if (!seenWords.has(lowerWord) && word.trim()) {
      seenWords.add(lowerWord);
      uniqueWords.push(word);
    }
  }
  
  // Join back together
  cleanedTitle = uniqueWords.join(' ');
  
  // Final cleanup - remove any remaining extra spaces
  cleanedTitle = cleanedTitle.replace(/\s+/g, ' ').trim();
  
  // Remove leading dash if present
  cleanedTitle = cleanedTitle.replace(/^-+\s*/, '');
  
  return cleanedTitle;
}

// Add new items from recent searches
async function addNewItems(data, itemsPerSearch = 100) {
  console.log(`🆕 Adding new items from recent searches...`);
  
  const searchTerms = [
    'PSA 10',
    'PSA 10 baseball',
    'PSA 10 football', 
    'PSA 10 basketball',
    'PSA 10 hockey',
    'PSA 10 soccer',
    'PSA 10 pokemon',
    'PSA 10 magic',
    'PSA 10 rookie',
    'PSA 10 auto'
  ];
  
  const existingIds = new Set(data.items.map(item => item.id));
  let newItemsAdded = 0;
  
  for (const searchTerm of searchTerms) {
    try {
      console.log(`\n🔍 Searching for new items: "${searchTerm}"`);
      
      const results = await search130point(searchTerm, itemsPerSearch);
      
      if (results && results.length > 0) {
        let addedFromSearch = 0;
        
        for (const result of results) {
          if (!existingIds.has(result.id)) {
            // Check if item should be excluded (lot or bundle)
            if (shouldExcludeItem(result)) {
              console.log(`   ⏭️  Skipping lot/bundle item: "${result.title}"`);
              continue;
            }
            
            // Add new item to database
            const newItem = {
              ...result,
              collectedAt: new Date().toISOString(),
              source: '130point',
              searchTerm: searchTerm,
              searchCategory: searchTerm
            };
            
            // Create summary title for the new item
            newItem.summaryTitle = createSummaryTitle(newItem);
            
            data.items.push(newItem);
            existingIds.add(result.id);
            addedFromSearch++;
            newItemsAdded++;
          }
        }
        
        console.log(`   ✅ Added ${addedFromSearch} new items from "${searchTerm}"`);
      }
      
      // Small delay between searches
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      console.log(`   ❌ Error searching "${searchTerm}": ${error.message}`);
    }
  }
  
  console.log(`\n📊 New Items Summary:`);
  console.log(`   Total new items added: ${newItemsAdded}`);
  
  return newItemsAdded;
}

// Remove items older than 90 days
function removeOldItems(data, daysToKeep = 90) {
  console.log(`🗑️  Removing items older than ${daysToKeep} days...`);
  
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
  
  const originalCount = data.items.length;
  data.items = data.items.filter(item => {
    const soldDate = new Date(item.soldDate);
    return soldDate >= cutoffDate;
  });
  
  const removedCount = originalCount - data.items.length;
  console.log(`   Removed ${removedCount} old items`);
  console.log(`   Remaining items: ${data.items.length}`);
  
  return removedCount;
}

// Main database update function
async function updateDatabase(options = {}) {
  const {
    updateExisting = true,
    addNew = true,
    removeOld = true,
    daysToUpdate = 7,
    daysToKeep = 90,
    itemsPerSearch = 100
  } = options;
  
  try {
    console.log('🔄 Starting Database Update');
    console.log('==========================\n');
    
    // Create backup
    const backupFile = createBackup();
    if (!backupFile) {
      console.log('❌ Failed to create backup, aborting update');
      return;
    }
    
    // Load database
    const data = loadDatabase();
    if (!data) {
      console.log('❌ Failed to load database, aborting update');
      return;
    }
    
    console.log(`📊 Current database: ${data.items.length} items`);
    
    let totalUpdated = 0;
    let totalNew = 0;
    let totalRemoved = 0;
    
    // Update existing items
    if (updateExisting) {
      totalUpdated = await updateExistingItems(data, daysToUpdate);
    }
    
    // Add new items
    if (addNew) {
      totalNew = await addNewItems(data, itemsPerSearch);
    }
    
    // Remove old items
    if (removeOld) {
      totalRemoved = removeOldItems(data, daysToKeep);
    }
    
    // Save updated database
    saveDatabase(data);
    
    console.log('\n✅ Database Update Completed!');
    console.log('=============================');
    console.log(`📊 Final database size: ${data.items.length} items`);
    console.log(`🔄 Items updated: ${totalUpdated}`);
    console.log(`🆕 New items added: ${totalNew}`);
    console.log(`🗑️  Old items removed: ${totalRemoved}`);
    console.log(`💾 Backup saved: ${backupFile}`);
    
  } catch (error) {
    console.error('❌ Database update failed:', error.message);
  }
}

// Quick update (just add new items)
async function quickUpdate() {
  console.log('⚡ Quick Update - Adding New Items Only');
  console.log('=======================================\n');
  
  await updateDatabase({
    updateExisting: false,
    addNew: true,
    removeOld: false,
    itemsPerSearch: 50
  });
}

// Full update (everything)
async function fullUpdate() {
  console.log('🔄 Full Update - Complete Database Refresh');
  console.log('==========================================\n');
  
  await updateDatabase({
    updateExisting: true,
    addNew: true,
    removeOld: true,
    daysToUpdate: 7,
    daysToKeep: 90,
    itemsPerSearch: 100
  });
}

// Export functions
module.exports = {
  updateDatabase,
  quickUpdate,
  fullUpdate,
  createBackup,
  loadDatabase,
  saveDatabase
};

// Run if called directly
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--quick') || args.includes('-q')) {
    quickUpdate();
  } else if (args.includes('--full') || args.includes('-f')) {
    fullUpdate();
  } else {
    console.log('Usage:');
    console.log('  node database-updater.js --quick  # Quick update (new items only)');
    console.log('  node database-updater.js --full   # Full update (everything)');
    console.log('  node database-updater.js          # Default update');
    
    // Run default update
    updateDatabase();
  }
} 