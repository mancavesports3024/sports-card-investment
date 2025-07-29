const getCardBaseService = require('../services/getCardBaseService');

async function quickTest() {
  console.log('🧪 QUICK GETCARDBASE TEST\n');
  
  try {
    // Test 1: Check if service loads
    console.log('✅ Service loaded successfully');
    
    // Test 2: Check ID mappings
    console.log('\n📋 ID Mappings:');
    console.log(`Sports: ${Object.keys(getCardBaseService.idMappings.sports).length} entries`);
    console.log(`Years: ${Object.keys(getCardBaseService.idMappings.years).length} entries`);
    console.log(`Sets: ${Object.keys(getCardBaseService.idMappings.sets).length} entries`);
    console.log(`Variations: ${Object.keys(getCardBaseService.idMappings.variations).length} entries`);
    
    // Test 3: Try a simple search
    console.log('\n🔍 Testing search...');
    const searchResults = getCardBaseService.searchInMappings('topps', 3);
    console.log(`Search results for "topps": ${searchResults.length}`);
    searchResults.forEach((result, index) => {
      console.log(`  ${index + 1}. ${result.name} (${result.type})`);
    });
    
    console.log('\n✅ Quick test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

quickTest(); 