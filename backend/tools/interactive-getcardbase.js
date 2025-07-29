const getCardBaseService = require('../services/getCardBaseService');
const readline = require('readline');

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function displayResults(suggestions, query, duration) {
  console.log(`\n✅ GetCardBase returned ${suggestions.length} suggestions for "${query}" in ${duration}ms`);
  
  if (suggestions.length > 0) {
    console.log('\n📋 Results:');
    console.log('='.repeat(80));
    
    suggestions.forEach((suggestion, index) => {
      console.log(`${index + 1}. ${suggestion.name}`);
      console.log(`   Brand: ${suggestion.brand}`);
      console.log(`   Set: ${suggestion.set || 'N/A'}`);
      console.log(`   Year: ${suggestion.year || 'N/A'}`);
      console.log(`   Sport: ${suggestion.sport}`);
      console.log(`   League: ${suggestion.league}`);
      console.log(`   Source: ${suggestion.source}`);
      console.log('');
    });
  } else {
    console.log('❌ No suggestions found');
  }
  
  console.log('='.repeat(80));
}

function displayError(error, query) {
  console.log(`\n❌ Error searching for "${query}": ${error.message}`);
  
  if (error.response) {
    console.log(`   Status: ${error.response.status}`);
    console.log(`   Data: ${JSON.stringify(error.response.data, null, 2)}`);
  }
  
  console.log('='.repeat(80));
}

async function searchGetCardBase(query) {
  try {
    console.log(`\n🔍 Searching GetCardBase for "${query}"...`);
    const startTime = Date.now();
    
    const suggestions = await getCardBaseService.searchCardSets(query, 10);
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    displayResults(suggestions, query, duration);
    
  } catch (error) {
    displayError(error, query);
  }
}

function showHelp() {
  console.log('\n📖 HELP - GetCardBase Interactive Search Tool');
  console.log('='.repeat(50));
  console.log('Commands:');
  console.log('  <query>     - Search GetCardBase for the query');
  console.log('  help        - Show this help message');
  console.log('  test        - Run some test searches');
  console.log('  build       - Build the GetCardBase database');
  console.log('  cache       - Show cached database info');
  console.log('  quit/exit   - Exit the tool');
  console.log('');
  console.log('Example queries:');
  console.log('  topps       - Search for Topps sets');
  console.log('  chrome      - Search for Chrome sets');
  console.log('  2025        - Search for 2025 sets');
  console.log('  bowman      - Search for Bowman sets');
  console.log('  prizm       - Search for Prizm sets');
  console.log('  baseball    - Search for baseball sets');
  console.log('  panini      - Search for Panini sets');
  console.log('  heritage    - Search for Heritage sets');
  console.log('='.repeat(50));
}

async function runTestSearches() {
  console.log('\n🧪 Running test searches...');
  
  const testQueries = [
    'topps',
    'chrome',
    '2025',
    'bowman',
    'prizm',
    'baseball'
  ];
  
  for (const query of testQueries) {
    await searchGetCardBase(query);
    
    // Wait a bit between searches
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

async function buildDatabase() {
  console.log('\n🏗️ Building GetCardBase database...');
  
  try {
    const startTime = Date.now();
    const buildResult = await getCardBaseService.buildCardSetDatabase();
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`✅ Database build completed in ${duration}ms`);
    
    if (buildResult.success) {
      console.log(`📊 Build Summary:`);
      console.log(`   Total Sets: ${buildResult.totalSets}`);
      console.log(`   Manual Sets: ${buildResult.manualSets}`);
      console.log(`   GetCardBase Sets: ${buildResult.getCardBaseSets}`);
      console.log(`   Duplicates Removed: ${buildResult.duplicatesRemoved}`);
    } else {
      console.log(`❌ Build failed: ${buildResult.error}`);
    }
    
  } catch (error) {
    console.log(`❌ Database build error: ${error.message}`);
  }
}

async function showCacheInfo() {
  console.log('\n💾 Getting cached database info...');
  
  try {
    const startTime = Date.now();
    const database = await getCardBaseService.getCardSetDatabase();
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`✅ Retrieved cached database in ${duration}ms`);
    console.log(`📊 Database contains ${database.length} card sets`);
    
    if (database.length > 0) {
      console.log('\n📋 Sample entries:');
      database.slice(0, 5).forEach((set, index) => {
        console.log(`   ${index + 1}. ${set.name} (${set.source})`);
      });
    }
    
  } catch (error) {
    console.log(`❌ Cache error: ${error.message}`);
  }
}

function promptUser() {
  rl.question('\n🔍 Enter search query (or type "help" for commands): ', async (input) => {
    const query = input.trim().toLowerCase();
    
    if (query === 'quit' || query === 'exit') {
      console.log('\n👋 Goodbye!');
      rl.close();
      return;
    }
    
    if (query === 'help') {
      showHelp();
      promptUser();
      return;
    }
    
    if (query === 'test') {
      await runTestSearches();
      promptUser();
      return;
    }
    
    if (query === 'build') {
      await buildDatabase();
      promptUser();
      return;
    }
    
    if (query === 'cache') {
      await showCacheInfo();
      promptUser();
      return;
    }
    
    if (query === '') {
      console.log('Please enter a search query or type "help" for commands.');
      promptUser();
      return;
    }
    
    // Perform the search
    await searchGetCardBase(query);
    promptUser();
  });
}

// Main execution
async function main() {
  console.log('🚀 GetCardBase Interactive Search Tool');
  console.log('='.repeat(50));
  console.log('Type "help" for available commands');
  console.log('Type "quit" or "exit" to close');
  console.log('='.repeat(50));
  
  promptUser();
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Goodbye!');
  rl.close();
  process.exit(0);
});

// Start the interactive tool
main()
  .catch(err => {
    console.error('💥 Tool failed:', err.message);
    rl.close();
    process.exit(1);
  }); 