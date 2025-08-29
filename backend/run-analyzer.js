const { PlayerNameAnalyzer } = require('./analyze-player-names-simple.js');

async function runAnalyzer() {
    const analyzer = new PlayerNameAnalyzer();
    
    try {
        console.log('🔍 Starting player name analysis...');
        await analyzer.connect();
        
        // Run the analysis
        await analyzer.analyzePlayerNames();
        
        // Display results
        console.log('\n📊 ANALYSIS RESULTS:');
        console.log('===================');
        
        if (analyzer.problematicNames.length === 0) {
            console.log('✅ No problematic player names found!');
        } else {
            console.log(`❌ Found ${analyzer.problematicNames.length} problematic player names:`);
            analyzer.problematicNames.forEach((name, index) => {
                console.log(`${index + 1}. "${name}"`);
            });
        }
        
        await analyzer.close();
        console.log('\n✅ Analysis completed successfully');
        
    } catch (error) {
        console.error('❌ Error running analyzer:', error);
        await analyzer.close();
    }
}

runAnalyzer();
