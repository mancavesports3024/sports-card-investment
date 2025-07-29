const getCardBaseService = require('../services/getCardBaseService');

async function analyzeGetCardBaseStructure() {
  console.log('🔍 ANALYZING GETCARDBASE API STRUCTURE\n');
  console.log('='.repeat(60));
  
  try {
    console.log('📡 Getting raw property data from GetCardBase...\n');
    
    // Get raw data from each property
    const [brandValues, setValues, yearValues, sportValues] = await Promise.all([
      getCardBaseService.getAllPropertyValues(1), // BRAND_MANUFACTURER
      getCardBaseService.getAllPropertyValues(2), // SET_SERIES
      getCardBaseService.getAllPropertyValues(3), // YEAR
      getCardBaseService.getAllPropertyValues(4)  // SPORT
    ]);
    
    console.log('📊 PROPERTY 1 (BRAND_MANUFACTURER) ANALYSIS:');
    console.log('='.repeat(50));
    console.log(`Total values: ${brandValues.length}`);
    console.log('Sample values:');
    brandValues.slice(0, 20).forEach((item, index) => {
      console.log(`  ${index + 1}. "${item.text}" (ID: ${item.id}, Approved: ${item.isApproved})`);
    });
    
    // Analyze what Property 1 actually contains
    const brandAnalysis = analyzePropertyContent(brandValues, 'Property 1 (BRAND_MANUFACTURER)');
    console.log('\n🔍 Property 1 Content Analysis:');
    console.log(brandAnalysis);
    
    console.log('\n📊 PROPERTY 2 (SET_SERIES) ANALYSIS:');
    console.log('='.repeat(50));
    console.log(`Total values: ${setValues.length}`);
    console.log('Sample values:');
    setValues.slice(0, 20).forEach((item, index) => {
      console.log(`  ${index + 1}. "${item.text}" (ID: ${item.id}, Approved: ${item.isApproved})`);
    });
    
    const setAnalysis = analyzePropertyContent(setValues, 'Property 2 (SET_SERIES)');
    console.log('\n🔍 Property 2 Content Analysis:');
    console.log(setAnalysis);
    
    console.log('\n📊 PROPERTY 3 (YEAR) ANALYSIS:');
    console.log('='.repeat(50));
    console.log(`Total values: ${yearValues.length}`);
    console.log('Sample values:');
    yearValues.slice(0, 20).forEach((item, index) => {
      console.log(`  ${index + 1}. "${item.text}" (ID: ${item.id}, Approved: ${item.isApproved})`);
    });
    
    const yearAnalysis = analyzePropertyContent(yearValues, 'Property 3 (YEAR)');
    console.log('\n🔍 Property 3 Content Analysis:');
    console.log(yearAnalysis);
    
    console.log('\n📊 PROPERTY 4 (SPORT) ANALYSIS:');
    console.log('='.repeat(50));
    console.log(`Total values: ${sportValues.length}`);
    console.log('Sample values:');
    sportValues.slice(0, 20).forEach((item, index) => {
      console.log(`  ${index + 1}. "${item.text}" (ID: ${item.id}, Approved: ${item.isApproved})`);
    });
    
    const sportAnalysis = analyzePropertyContent(sportValues, 'Property 4 (SPORT)');
    console.log('\n🔍 Property 4 Content Analysis:');
    console.log(sportAnalysis);
    
    // Cross-reference analysis
    console.log('\n🔍 CROSS-REFERENCE ANALYSIS:');
    console.log('='.repeat(50));
    console.log('Looking for patterns across properties...');
    
    // Check if "Topps" appears in any property
    const toppsInBrand = brandValues.some(item => item.text.toLowerCase().includes('topps'));
    const toppsInSet = setValues.some(item => item.text.toLowerCase().includes('topps'));
    const toppsInYear = yearValues.some(item => item.text.toLowerCase().includes('topps'));
    const toppsInSport = sportValues.some(item => item.text.toLowerCase().includes('topps'));
    
    console.log(`"Topps" found in:`);
    console.log(`  Property 1 (Brand): ${toppsInBrand}`);
    console.log(`  Property 2 (Set): ${toppsInSet}`);
    console.log(`  Property 3 (Year): ${toppsInYear}`);
    console.log(`  Property 4 (Sport): ${toppsInSport}`);
    
    // Check for year patterns
    const yearPattern = /\b(19|20)\d{2}\b/;
    const yearsInBrand = brandValues.filter(item => yearPattern.test(item.text)).length;
    const yearsInSet = setValues.filter(item => yearPattern.test(item.text)).length;
    const yearsInYear = yearValues.filter(item => yearPattern.test(item.text)).length;
    const yearsInSport = sportValues.filter(item => yearPattern.test(item.text)).length;
    
    console.log(`\nYear patterns (19xx/20xx) found in:`);
    console.log(`  Property 1 (Brand): ${yearsInBrand} items`);
    console.log(`  Property 2 (Set): ${yearsInSet} items`);
    console.log(`  Property 3 (Year): ${yearsInYear} items`);
    console.log(`  Property 4 (Sport): ${yearsInSport} items`);
    
    // Recommendations
    console.log('\n💡 RECOMMENDATIONS:');
    console.log('='.repeat(50));
    
    if (toppsInSet && !toppsInBrand) {
      console.log('✅ "Topps" found in Property 2 (Set) - this might be the actual brand data');
    }
    
    if (yearsInBrand > yearsInYear) {
      console.log('⚠️  More year patterns found in Property 1 (Brand) than Property 3 (Year)');
      console.log('   Property 1 might actually contain years, not brands');
    }
    
    if (yearsInYear === 0) {
      console.log('⚠️  No year patterns found in Property 3 (Year)');
      console.log('   Property 3 might not contain actual years');
    }
    
  } catch (error) {
    console.error('❌ Analysis error:', error.message);
  }
}

function analyzePropertyContent(values, propertyName) {
  const analysis = {
    totalValues: values.length,
    approvedValues: values.filter(v => v.isApproved).length,
    uniqueValues: new Set(values.map(v => v.text)).size,
    averageLength: values.reduce((sum, v) => sum + v.text.length, 0) / values.length,
    containsYears: values.filter(v => /\b(19|20)\d{2}\b/.test(v.text)).length,
    containsBrands: values.filter(v => {
      const lower = v.text.toLowerCase();
      return lower.includes('topps') || lower.includes('panini') || lower.includes('bowman');
    }).length,
    sampleTexts: values.slice(0, 10).map(v => v.text)
  };
  
  return `
    Total Values: ${analysis.totalValues}
    Approved Values: ${analysis.approvedValues}
    Unique Values: ${analysis.uniqueValues}
    Average Text Length: ${analysis.averageLength.toFixed(1)} characters
    Contains Year Patterns: ${analysis.containsYears}
    Contains Known Brands: ${analysis.containsBrands}
    Sample Texts: ${analysis.sampleTexts.join(', ')}
  `;
}

// Run the analysis
analyzeGetCardBaseStructure()
  .then(() => {
    console.log('\n✅ GetCardBase structure analysis completed!');
    process.exit(0);
  })
  .catch(err => {
    console.error('💥 Analysis failed:', err.message);
    process.exit(1);
  }); 