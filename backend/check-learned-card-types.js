const { DatabaseDrivenStandardizedTitleGenerator } = require('./generate-standardized-summary-titles-database-driven.js');

async function checkLearnedCardTypes() {
    console.log('🔍 Checking Learned Card Types...\n');
    
    const generator = new DatabaseDrivenStandardizedTitleGenerator();
    
    try {
        await generator.connect();
        await generator.learnFromDatabase();
        
        console.log('📚 All learned card sets:');
        Array.from(generator.cardSets).forEach(set => {
            console.log(`   • ${set}`);
        });
        
        console.log('\n🎨 All learned card types:');
        Array.from(generator.cardTypes).forEach(type => {
            console.log(`   • ${type}`);
        });
        
        console.log('\n🏷️ All learned brands:');
        Array.from(generator.brands).forEach(brand => {
            console.log(`   • ${brand}`);
        });
        
        // Check if any contain "prospect" or "paula"
        console.log('\n🔍 Card types containing "prospect" or "paula":');
        Array.from(generator.cardTypes).forEach(type => {
            if (type.toLowerCase().includes('prospect') || type.toLowerCase().includes('paula')) {
                console.log(`   • ${type}`);
            }
        });
        
    } catch (error) {
        console.error('❌ Error during check:', error);
    } finally {
        if (generator.db) {
            generator.db.close();
        }
    }
}

checkLearnedCardTypes()
    .then(() => {
        console.log('\n✅ Check completed');
        process.exit(0);
    })
    .catch(error => {
        console.error('❌ Check failed:', error);
        process.exit(1);
    });
