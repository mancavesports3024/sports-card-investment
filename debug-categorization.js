// Direct test of categorization logic
const categorizeCards = (cards) => {
  if (!cards || cards.length === 0) return { raw: [], psa9: [], psa10: [], priceAnalysis: null };
  
  const raw = [];
  const psa9 = [];
  const psa10 = [];
  
  console.log(`\n=== CARD CATEGORIZATION DEBUG ===`);
  console.log(`Total cards found: ${cards.length}`);
  
  cards.forEach((card, index) => {
    const title = card.title?.toLowerCase() || '';
    const condition = card.condition?.toLowerCase() || '';
    
    console.log(`\nCard ${index + 1}: "${card.title}"`);
    console.log(`Condition: "${card.condition}"`);
    
    // More precise grading detection - only look for actual grading companies and grades
    const gradingCompanies = ['psa', 'bgs', 'sgc', 'cgc', 'beckett', 'ace', 'cga', 'gma', 'hga', 'pgs', 'bvg', 'csg', 'rcg', 'ksa', 'fgs', 'tag', 'pgm', 'dga', 'isa'];
    const gradeNumbers = ['10', '9.5', '9', '8.5', '8', '7', '6', '5', '4', '3', '2', '1'];
    const rawKeywords = ['raw', 'ungraded', 'not graded', 'no grade'];
    
    // Helper to check for grading companies
    function hasGradingCompany(str) {
      if (!str) return false;
      const lower = str.toLowerCase();
      // Use word boundaries to avoid false positives like "tag" in "advantage"
      const foundCompanies = gradingCompanies.filter(company => {
        // Look for the company as a whole word (with word boundaries)
        const regex = new RegExp(`\\b${company}\\b`, 'i');
        return regex.test(lower);
      });
      if (foundCompanies.length > 0) {
        console.log(`    Grading companies found: ${foundCompanies.join(', ')}`);
      }
      return foundCompanies.length > 0;
    }
    
    // Helper to check for grade numbers (but only if they appear near grading companies)
    function hasGradeNumber(str) {
      if (!str) return false;
      const lower = str.toLowerCase();
      // Check if any grade number appears near a grading company
      const foundGrades = gradeNumbers.filter(grade => {
        if (lower.includes(grade)) {
          // Look for grading company within 20 characters of the grade
          const gradeIndex = lower.indexOf(grade);
          const surroundingText = lower.substring(Math.max(0, gradeIndex - 20), gradeIndex + 20);
          const nearbyCompanies = gradingCompanies.filter(company => surroundingText.includes(company));
          if (nearbyCompanies.length > 0) {
            console.log(`    Grade ${grade} found near companies: ${nearbyCompanies.join(', ')}`);
          }
          return nearbyCompanies.length > 0;
        }
        return false;
      });
      return foundGrades.length > 0;
    }
    
    // Skip cards with "Pick", "Complete", or "Choose Your Card" in the title
    if (title.includes('pick') || title.includes('complete') || title.includes('choose your card')) {
      console.log(`  -> SKIPPED (Pick/Complete/Choose Your Card)`);
      return;
    }
    
    // PSA 10
    if ((title.includes('psa 10') || title.includes('psa10')) && !title.includes('cgc')) {
      psa10.push(card);
      console.log(`  -> PSA 10`);
    } 
    // PSA 9
    else if ((title.includes('psa 9') || title.includes('psa9')) && !title.includes('cgc')) {
      psa9.push(card);
      console.log(`  -> PSA 9`);
    } else {
      // If the card has a grading company or grade number near a grading company, skip from raw
      if (hasGradingCompany(title) || hasGradingCompany(condition) || hasGradeNumber(title) || hasGradeNumber(condition)) {
        console.log(`  -> SKIPPED (Graded card by company/grade)`);
        return;
      }
      // Otherwise, treat as raw
      raw.push(card);
      console.log(`  -> RAW (Added)`);
    }
  });
  
  console.log(`\n=== FINAL RESULTS ===`);
  console.log(`Raw: ${raw.length} | PSA 9: ${psa9.length} | PSA 10: ${psa10.length}`);
  console.log(`=== END DEBUG ===\n`);
  
  return { raw, psa9, psa10 };
};

// Test with specific Bobby Witt Jr. cards
const testCards = [
  {
    title: "2024 Topps Series 1 - Home Field Advantage Bobby Witt Jr. #HFA-10",
    condition: "New (Other)",
    price: { value: "25.00" },
    soldDate: "2024-01-01T00:00:00.000Z"
  },
  {
    title: "2024 Topps Series 1 Bobby Witt Jr Home Field Advantage HFA SP Case Hit Royals",
    condition: "New (Other)",
    price: { value: "30.00" },
    soldDate: "2024-01-01T00:00:00.000Z"
  },
  {
    title: "2024 Topps Series 1 - Home Field Advantage Bobby Witt Jr. #HFA-10 PSA 9",
    condition: "New (Other)",
    price: { value: "50.00" },
    soldDate: "2024-01-01T00:00:00.000Z"
  }
];

console.log('🧪 Testing Bobby Witt Jr. categorization logic directly...\n');
const result = categorizeCards(testCards);

console.log('\n📊 Final Results:');
console.log(`Raw cards: ${result.raw.length}`);
console.log(`PSA 9 cards: ${result.psa9.length}`);
console.log(`PSA 10 cards: ${result.psa10.length}`);

if (result.raw.length === 0) {
  console.log('\n❌ PROBLEM: No raw cards found!');
  console.log('The first two cards should be raw but are being incorrectly categorized.');
} else {
  console.log('\n✅ SUCCESS: Raw cards found!');
} 