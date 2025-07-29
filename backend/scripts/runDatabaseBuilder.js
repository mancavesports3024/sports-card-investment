const CardSetDatabaseBuilder = require('./buildCardSetDatabase');

async function runDatabaseBuilder() {
  console.log('🚀 RUNNING CARD SET DATABASE BUILDER\n');
  
  const builder = new CardSetDatabaseBuilder();
  const result = await builder.buildDatabase();
  
  if (result.success) {
    console.log('\n✅ Database build completed successfully!');
    console.log(`📁 Database saved to: ${builder.databasePath}`);
    console.log(`📊 Stats saved to: ${builder.statsPath}`);
    console.log(`\n📋 Build Summary:`);
    console.log(`   Total Sets: ${result.totalSets}`);
    console.log(`   Manual Sets: ${result.manualSets}`);
    console.log(`   GetCardBase Sets: ${result.getCardBaseSets}`);
    console.log(`   Duplicates Removed: ${result.duplicatesRemoved}`);
  } else {
    console.error('\n❌ Database build failed:', result.error);
    process.exit(1);
  }
}

// Run the builder
runDatabaseBuilder()
  .then(() => {
    console.log('\n🎯 Database builder finished!');
    process.exit(0);
  })
  .catch(err => {
    console.error('💥 Database builder failed:', err.message);
    process.exit(1);
  }); 