console.log('🧪 SIMPLE GETCARDBASE TEST\n');

try {
  const getCardBaseService = require('../services/getCardBaseService');
  
  console.log('✅ Service loaded successfully');
  
  console.log('\n📋 Service Properties:');
  console.log('- baseURL:', getCardBaseService.baseURL);
  console.log('- headers:', Object.keys(getCardBaseService.headers).length, 'headers');
  
  console.log('\n📋 ID Mappings:');
  console.log('- Sports:', Object.keys(getCardBaseService.idMappings.sports).length);
  console.log('- Years:', Object.keys(getCardBaseService.idMappings.years).length);
  console.log('- Sets:', Object.keys(getCardBaseService.idMappings.sets).length);
  console.log('- Variations:', Object.keys(getCardBaseService.idMappings.variations).length);
  
  console.log('\n📋 Sample Sports:');
  Object.entries(getCardBaseService.idMappings.sports).slice(0, 3).forEach(([id, name]) => {
    console.log(`  ${id}: ${name}`);
  });
  
  console.log('\n📋 Sample Sets:');
  Object.entries(getCardBaseService.idMappings.sets).slice(0, 3).forEach(([id, name]) => {
    console.log(`  ${id}: ${name}`);
  });
  
  console.log('\n✅ Simple test completed successfully!');
  
} catch (error) {
  console.error('❌ Test failed:', error.message);
  console.error('Stack:', error.stack);
} 