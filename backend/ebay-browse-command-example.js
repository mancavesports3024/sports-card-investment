// eBay Browse API Commands for the provided URL
// URL: https://www.ebay.com/sch/i.html?_nkw=PSA%2010&LH_Complete=1&LH_Sold=1&Sport=Baseball&Year%2520Manufactured=2024%7C2023%7C2022&_dcat=261328&rt=nc&_udlo=50

console.log('🔍 eBay Browse API Commands for PSA 10 Baseball Cards');
console.log('=====================================================\n');

// Parsed parameters from the URL:
const searchQuery = 'PSA 10 baseball';
const isSold = true;
const isCompleted = true;
const sport = 'Baseball';
const years = ['2024', '2023', '2022'];
const categoryId = '261328'; // Sports Trading Cards
const minPrice = '50';

console.log('📊 PARSED PARAMETERS:');
console.log(`Search Query: ${searchQuery}`);
console.log(`Sold Items: ${isSold}`);
console.log(`Completed Listings: ${isCompleted}`);
console.log(`Sport: ${sport}`);
console.log(`Years: ${years.join(', ')}`);
console.log(`Category ID: ${categoryId}`);
console.log(`Minimum Price: $${minPrice}\n`);

// Build filter string
const filters = [];
if (categoryId) {
  filters.push(`categoryIds:{${categoryId}}`);
}
if (minPrice) {
  filters.push(`price:[${minPrice}..]`);
}
if (years.length > 0) {
  const yearFilters = years.map(year => `yearManufactured:${year}`).join(',');
  filters.push(`yearManufactured:{${yearFilters}}`);
}

const filterString = filters.join(',');

console.log('🎯 RECOMMENDATIONS:');
console.log('- Since this is a search for SOLD items, use the Marketplace Insights API');
console.log('- For active listings, use the Browse API\n');

console.log('🔗 BROWSE API COMMAND (for active listings):');
console.log('Endpoint: https://api.ebay.com/buy/browse/v1/item_summary/search');
console.log('Method: GET');
console.log('Headers:');
console.log('  Authorization: Bearer YOUR_TOKEN_HERE');
console.log('  X-EBAY-C-MARKETPLACE-ID: EBAY-US');
console.log('  Content-Type: application/json');
console.log('Parameters:');
console.log(`  q: ${searchQuery}`);
console.log('  limit: 50');
console.log(`  filter: ${filterString}`);
console.log('  sort: newlyListed\n');

console.log('📈 MARKETPLACE INSIGHTS API COMMAND (for sold items):');
console.log('Endpoint: https://api.ebay.com/buy/marketplace_insights/v1_beta/item_sales/search');
console.log('Method: GET');
console.log('Headers:');
console.log('  Authorization: Bearer YOUR_TOKEN_HERE');
console.log('  X-EBAY-C-MARKETPLACE-ID: EBAY-US');
console.log('  Content-Type: application/json');
console.log('Parameters:');
console.log(`  q: ${searchQuery}`);
console.log('  limit: 50');
console.log('  fieldgroups: ASPECT_REFINEMENTS,MATCHING_ITEMS\n');

console.log('💻 CURL COMMANDS FOR TESTING:\n');

console.log('--- Browse API (Active Listings) ---');
console.log(`curl -X GET "https://api.ebay.com/buy/browse/v1/item_summary/search?q=${encodeURIComponent(searchQuery)}&limit=50&filter=${encodeURIComponent(filterString)}&sort=newlyListed" \\`);
console.log('  -H "Authorization: Bearer YOUR_TOKEN_HERE" \\');
console.log('  -H "X-EBAY-C-MARKETPLACE-ID: EBAY-US" \\');
console.log('  -H "Content-Type: application/json"\n');

console.log('--- Marketplace Insights (Sold Items) ---');
console.log(`curl -X GET "https://api.ebay.com/buy/marketplace_insights/v1_beta/item_sales/search?q=${encodeURIComponent(searchQuery)}&limit=50&fieldgroups=ASPECT_REFINEMENTS,MATCHING_ITEMS" \\`);
console.log('  -H "Authorization: Bearer YOUR_TOKEN_HERE" \\');
console.log('  -H "X-EBAY-C-MARKETPLACE-ID: EBAY-US" \\');
console.log('  -H "Content-Type: application/json"\n');

console.log('✅ Command generation completed!');
console.log('\n📝 NOTES:');
console.log('- Replace YOUR_TOKEN_HERE with your actual eBay API token');
console.log('- The Marketplace Insights API is recommended for sold items');
console.log('- The Browse API is for active listings only');
console.log('- Category ID 261328 is for Sports Trading Cards');
console.log('- Price filter is set to $50 minimum');
console.log('- Years filter includes 2024, 2023, and 2022'); 