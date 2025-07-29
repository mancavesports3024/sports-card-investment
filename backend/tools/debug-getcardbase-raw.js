const axios = require('axios');

async function debugGetCardBaseRaw() {
  console.log('🔍 DEBUGGING GETCARDBASE RAW API DATA\n');
  
  const baseURL = 'https://api.getcardbase.com/collectibles/api/mobile/v1';
  const headers = {
    'Access-Token': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTI5NTc0LCJlbWFpbCI6Im1hbmNhdmVzcG9ydHMzMDI0QGdtYWlsLmNvbSIsImlhdCI6MTczMjY5NzE5NywiZXhwIjoxNzMzMzAyMzk3fQ.Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8',
    'AppPlatform': 'web',
    'AppVersion': '1.0.0',
    'Client': 'web',
    'Expiry': '1733302397',
    'Origin': 'https://getcardbase.com',
    'Referer': 'https://getcardbase.com/',
    'Token-Type': 'Bearer',
    'Uid': '129574',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
  };

  try {
    console.log('📡 Testing Property 1 (BRAND_MANUFACTURER)...');
    const response1 = await axios.get(`${baseURL}/categories/1/search_schemas/3/search?for_attributes=true&per=10&page=1&target_name=external[45]&target_type=Collectibles::Property&target_id=1&search_schema_id=3&category_id=1`, { headers });
    
    console.log('✅ Property 1 Response Status:', response1.status);
    console.log('📊 Property 1 Data Structure:');
    console.log(JSON.stringify(response1.data, null, 2));
    
    console.log('\n📡 Testing Property 2 (SET_SERIES)...');
    const response2 = await axios.get(`${baseURL}/categories/1/search_schemas/3/search?for_attributes=true&per=10&page=1&target_name=external[45]&target_type=Collectibles::Property&target_id=2&search_schema_id=3&category_id=1`, { headers });
    
    console.log('✅ Property 2 Response Status:', response2.status);
    console.log('📊 Property 2 Data Structure:');
    console.log(JSON.stringify(response2.data, null, 2));
    
    console.log('\n📡 Testing Property 3 (YEAR)...');
    const response3 = await axios.get(`${baseURL}/categories/1/search_schemas/3/search?for_attributes=true&per=10&page=1&target_name=external[45]&target_type=Collectibles::Property&target_id=3&search_schema_id=3&category_id=1`, { headers });
    
    console.log('✅ Property 3 Response Status:', response3.status);
    console.log('📊 Property 3 Data Structure:');
    console.log(JSON.stringify(response3.data, null, 2));
    
    console.log('\n📡 Testing Property 4 (SPORT)...');
    const response4 = await axios.get(`${baseURL}/categories/1/search_schemas/3/search?for_attributes=true&per=10&page=1&target_name=external[45]&target_type=Collectibles::Property&target_id=4&search_schema_id=3&category_id=1`, { headers });
    
    console.log('✅ Property 4 Response Status:', response4.status);
    console.log('📊 Property 4 Data Structure:');
    console.log(JSON.stringify(response4.data, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

debugGetCardBaseRaw()
  .then(() => {
    console.log('\n✅ Raw API debugging completed!');
    process.exit(0);
  })
  .catch(err => {
    console.error('💥 Raw API debugging failed:', err.message);
    process.exit(1);
  }); 