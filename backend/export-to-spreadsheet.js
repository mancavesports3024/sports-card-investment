require('dotenv').config();
const fs = require('fs');
const path = require('path');

// Configuration
const DATABASE_DIR = path.join(__dirname, 'data');
const GOOD_BUYS_FILE = path.join(DATABASE_DIR, 'improved_api_good_buy_opportunities.json');
const SPREADSHEET_FILE = path.join(DATABASE_DIR, 'improved_good_buy_opportunities.csv');

function exportToCSV() {
  try {
    console.log('📂 Loading good buy opportunities...');
    
    // Check if the file exists
    if (!fs.existsSync(GOOD_BUYS_FILE)) {
      console.log('❌ No good buy opportunities file found. Run the API good buy finder first.');
      return;
    }
    
    // Load the opportunities
    const data = JSON.parse(fs.readFileSync(GOOD_BUYS_FILE, 'utf8'));
    // Handle both array format and object with opportunities property
    const opportunities = Array.isArray(data) ? data : (data.opportunities || []);
    
    if (opportunities.length === 0) {
      console.log('❌ No opportunities found in the file.');
      return;
    }
    
    console.log(`📊 Found ${opportunities.length} opportunities to export`);
    
    // Create CSV header
    const headers = [
      'PSA 10 Title',
      'PSA 10 Price',
      'Raw Price',
      'PSA 9 Price',
      'Multiplier',
      'Potential Profit',
      'ROI %',
      'Search Strategy',
      'Raw Cards Found',
      'PSA 9 Cards Found',
      'PSA 10 Sold Date',
      'Timestamp'
    ];
    
    // Create CSV content
    let csvContent = headers.join(',') + '\n';
    
    // Sort opportunities by multiplier (highest first)
    const sortedOpportunities = opportunities.sort((a, b) => b.multiplier - a.multiplier);
    
    sortedOpportunities.forEach(opp => {
      const row = [
        `"${opp.title.replace(/"/g, '""')}"`, // Escape quotes in title
        opp.psa10Price,
        opp.rawPrice,
        opp.psa9Price || 'N/A',
        opp.multiplier,
        opp.potentialProfit,
        opp.roi,
        opp.searchStrategy,
        opp.validatedMatches || opp.rawCardsFound || 0,
        opp.psa9CardsFound || 0,
        opp.soldDate || 'N/A',
        opp.timestamp || new Date().toISOString()
      ];
      
      csvContent += row.join(',') + '\n';
    });
    
    // Write to CSV file
    fs.writeFileSync(SPREADSHEET_FILE, csvContent);
    
    console.log(`✅ Exported ${opportunities.length} opportunities to ${SPREADSHEET_FILE}`);
    
    // Show summary statistics
    const totalPotentialProfit = opportunities.reduce((sum, opp) => sum + opp.potentialProfit, 0);
    const avgMultiplier = opportunities.reduce((sum, opp) => sum + opp.multiplier, 0) / opportunities.length;
    const avgROI = opportunities.reduce((sum, opp) => sum + opp.roi, 0) / opportunities.length;
    
    console.log('\n📈 SUMMARY STATISTICS:');
    console.log(`💰 Total Potential Profit: $${totalPotentialProfit.toFixed(2)}`);
    console.log(`📊 Average Multiplier: ${avgMultiplier.toFixed(2)}x`);
    console.log(`📈 Average ROI: ${avgROI.toFixed(2)}%`);
    console.log(`🎯 Highest Multiplier: ${Math.max(...opportunities.map(o => o.multiplier)).toFixed(2)}x`);
    console.log(`🎯 Lowest Multiplier: ${Math.min(...opportunities.map(o => o.multiplier)).toFixed(2)}x`);
    
    // Show top 10 opportunities
    console.log('\n🏆 TOP 10 OPPORTUNITIES BY MULTIPLIER:');
    sortedOpportunities.slice(0, 10).forEach((opp, index) => {
      console.log(`${index + 1}. ${opp.title.substring(0, 60)}...`);
      console.log(`   Multiplier: ${opp.multiplier}x | Profit: $${opp.potentialProfit} | ROI: ${opp.roi}%`);
    });
    
    // Show strategy breakdown
    const strategyBreakdown = {};
    opportunities.forEach(opp => {
      const strategy = opp.searchStrategy;
      strategyBreakdown[strategy] = (strategyBreakdown[strategy] || 0) + 1;
    });
    
    console.log('\n🔍 SEARCH STRATEGY BREAKDOWN:');
    Object.entries(strategyBreakdown).forEach(([strategy, count]) => {
      console.log(`   ${strategy}: ${count} opportunities`);
    });
    
  } catch (error) {
    console.error('❌ Error exporting to CSV:', error.message);
  }
}

// Also create a detailed analysis file
function createDetailedAnalysis() {
  try {
    const data = JSON.parse(fs.readFileSync(GOOD_BUYS_FILE, 'utf8'));
    // Handle both array format and object with opportunities property
    const opportunities = Array.isArray(data) ? data : (data.opportunities || []);
    
    if (opportunities.length === 0) return;
    
    const analysisFile = path.join(DATABASE_DIR, 'good_buy_analysis.txt');
    
    let analysis = 'GOOD BUY OPPORTUNITIES ANALYSIS\n';
    analysis += '==================================\n\n';
    
    // Overall statistics
    const totalPotentialProfit = opportunities.reduce((sum, opp) => sum + opp.potentialProfit, 0);
    const avgMultiplier = opportunities.reduce((sum, opp) => sum + opp.multiplier, 0) / opportunities.length;
    const avgROI = opportunities.reduce((sum, opp) => sum + opp.roi, 0) / opportunities.length;
    
    analysis += `OVERALL STATISTICS:\n`;
    analysis += `Total Opportunities: ${opportunities.length}\n`;
    analysis += `Total Potential Profit: $${totalPotentialProfit.toFixed(2)}\n`;
    analysis += `Average Multiplier: ${avgMultiplier.toFixed(2)}x\n`;
    analysis += `Average ROI: ${avgROI.toFixed(2)}%\n\n`;
    
    // Sort by multiplier
    const sortedByMultiplier = opportunities.sort((a, b) => b.multiplier - a.multiplier);
    
    analysis += `TOP 20 OPPORTUNITIES BY MULTIPLIER:\n`;
    analysis += `==================================\n\n`;
    
    sortedByMultiplier.slice(0, 20).forEach((opp, index) => {
      analysis += `${index + 1}. ${opp.title}\n`;
      analysis += `   PSA 10 Price: $${opp.psa10Price}\n`;
      analysis += `   Raw Price: $${opp.rawPrice}\n`;
      analysis += `   PSA 9 Price: ${opp.psa9Price ? '$' + opp.psa9Price : 'N/A'}\n`;
      analysis += `   Multiplier: ${opp.multiplier}x\n`;
      analysis += `   Potential Profit: $${opp.potentialProfit}\n`;
      analysis += `   ROI: ${opp.roi}%\n`;
      analysis += `   Search Strategy: ${opp.searchStrategy}\n`;
      analysis += `   Raw Cards Found: ${opp.validatedMatches || opp.rawCardsFound || 0}\n`;
      analysis += `   PSA 9 Cards Found: ${opp.psa9CardsFound || 0}\n`;
      analysis += `   Sold Date: ${opp.soldDate || 'N/A'}\n\n`;
    });
    
    // Strategy analysis
    const strategyBreakdown = {};
    opportunities.forEach(opp => {
      const strategy = opp.searchStrategy;
      if (!strategyBreakdown[strategy]) {
        strategyBreakdown[strategy] = {
          count: 0,
          totalProfit: 0,
          avgMultiplier: 0
        };
      }
      strategyBreakdown[strategy].count++;
      strategyBreakdown[strategy].totalProfit += opp.potentialProfit;
    });
    
    // Calculate averages
    Object.keys(strategyBreakdown).forEach(strategy => {
      const data = strategyBreakdown[strategy];
      const strategyOpps = opportunities.filter(opp => opp.searchStrategy === strategy);
      data.avgMultiplier = strategyOpps.reduce((sum, opp) => sum + opp.multiplier, 0) / data.count;
    });
    
    analysis += `SEARCH STRATEGY ANALYSIS:\n`;
    analysis += `========================\n\n`;
    
    Object.entries(strategyBreakdown).forEach(([strategy, data]) => {
      analysis += `${strategy}:\n`;
      analysis += `  Count: ${data.count}\n`;
      analysis += `  Total Profit: $${data.totalProfit.toFixed(2)}\n`;
      analysis += `  Average Multiplier: ${data.avgMultiplier.toFixed(2)}x\n\n`;
    });
    
    // Price range analysis
    const priceRanges = {
      'Under $50': { count: 0, totalProfit: 0 },
      '$50-$100': { count: 0, totalProfit: 0 },
      '$100-$250': { count: 0, totalProfit: 0 },
      '$250-$500': { count: 0, totalProfit: 0 },
      '$500-$1000': { count: 0, totalProfit: 0 },
      'Over $1000': { count: 0, totalProfit: 0 }
    };
    
    opportunities.forEach(opp => {
      const rawPrice = opp.rawPrice;
      if (rawPrice < 50) {
        priceRanges['Under $50'].count++;
        priceRanges['Under $50'].totalProfit += opp.potentialProfit;
      } else if (rawPrice < 100) {
        priceRanges['$50-$100'].count++;
        priceRanges['$50-$100'].totalProfit += opp.potentialProfit;
      } else if (rawPrice < 250) {
        priceRanges['$100-$250'].count++;
        priceRanges['$100-$250'].totalProfit += opp.potentialProfit;
      } else if (rawPrice < 500) {
        priceRanges['$250-$500'].count++;
        priceRanges['$250-$500'].totalProfit += opp.potentialProfit;
      } else if (rawPrice < 1000) {
        priceRanges['$500-$1000'].count++;
        priceRanges['$500-$1000'].totalProfit += opp.potentialProfit;
      } else {
        priceRanges['Over $1000'].count++;
        priceRanges['Over $1000'].totalProfit += opp.potentialProfit;
      }
    });
    
    analysis += `PRICE RANGE ANALYSIS:\n`;
    analysis += `====================\n\n`;
    
    Object.entries(priceRanges).forEach(([range, data]) => {
      if (data.count > 0) {
        analysis += `${range}:\n`;
        analysis += `  Count: ${data.count}\n`;
        analysis += `  Total Profit: $${data.totalProfit.toFixed(2)}\n\n`;
      }
    });
    
    fs.writeFileSync(analysisFile, analysis);
    console.log(`📊 Created detailed analysis: ${analysisFile}`);
    
  } catch (error) {
    console.error('❌ Error creating detailed analysis:', error.message);
  }
}

// Main execution
function main() {
  console.log('🚀 Exporting Good Buy Opportunities to Spreadsheet...\n');
  
  exportToCSV();
  createDetailedAnalysis();
  
  console.log('\n✅ Export complete!');
  console.log(`📁 CSV File: ${SPREADSHEET_FILE}`);
  console.log(`📊 Analysis File: ${path.join(DATABASE_DIR, 'good_buy_analysis.txt')}`);
  console.log('\n💡 You can now open the CSV file in Excel, Google Sheets, or any spreadsheet application.');
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { exportToCSV, createDetailedAnalysis }; 