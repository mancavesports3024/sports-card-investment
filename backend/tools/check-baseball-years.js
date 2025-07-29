const fs = require('fs');

try {
  // Load the enhanced database
  const data = JSON.parse(fs.readFileSync('data/enhancedSetFlatList.json', 'utf8'));
  
  // Filter for baseball sets
  const baseballSets = data.filter(item => item.type === 'set' && item.sport === 'Baseball');
  
  // Get unique years
  const years = [...new Set(baseballSets.map(s => s.year))].filter(y => y !== 'Unknown').sort();
  
  console.log('🏈 BASEBALL SETS ANALYSIS');
  console.log('='.repeat(40));
  console.log(`Total Baseball sets: ${baseballSets.length}`);
  console.log(`Sets with known years: ${baseballSets.filter(s => s.year !== 'Unknown').length}`);
  console.log(`Sets with unknown years: ${baseballSets.filter(s => s.year === 'Unknown').length}`);
  
  if (years.length > 0) {
    console.log(`\n📅 Years found: ${years.join(', ')}`);
    
    // Show sets by year
    years.forEach(year => {
      const yearSets = baseballSets.filter(s => s.year === year);
      console.log(`\n${year} (${yearSets.length} sets):`);
      yearSets.slice(0, 5).forEach(set => {
        console.log(`  - ${set.brand} ${set.setName}`);
      });
      if (yearSets.length > 5) {
        console.log(`  ... and ${yearSets.length - 5} more`);
      }
    });
  } else {
    console.log('\n❌ No years found - all sets have "Unknown" year');
  }
  
  // Show some sample sets with unknown years
  const unknownYearSets = baseballSets.filter(s => s.year === 'Unknown').slice(0, 10);
  if (unknownYearSets.length > 0) {
    console.log('\n❓ Sample sets with unknown years:');
    unknownYearSets.forEach(set => {
      console.log(`  - ${set.brand} ${set.setName}`);
    });
  }
  
} catch (error) {
  console.error('Error:', error.message);
} 