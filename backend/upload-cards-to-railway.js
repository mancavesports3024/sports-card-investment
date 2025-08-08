const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Configuration
const RAILWAY_URL = 'https://web-production-9efa.up.railway.app';
const JSON_FILE_PATH = path.join(__dirname, 'data', 'psa10_recent_90_days_database.json');
const CHUNK_SIZE = 50; // Upload 50 cards at a time to avoid timeouts

async function uploadCardsToRailway() {
    console.log('🚀 Starting card upload to Railway...');
    console.log('=====================================');
    
    try {
        // Check if JSON file exists
        if (!fs.existsSync(JSON_FILE_PATH)) {
            console.error(`❌ JSON file not found: ${JSON_FILE_PATH}`);
            console.log('📁 Available files in data directory:');
            const dataDir = path.join(__dirname, 'data');
            const files = fs.readdirSync(dataDir).filter(file => file.endsWith('.json'));
            files.forEach(file => console.log(`   - ${file}`));
            return;
        }
        
        // Load JSON data
        console.log(`📊 Loading data from: ${JSON_FILE_PATH}`);
        const jsonData = JSON.parse(fs.readFileSync(JSON_FILE_PATH, 'utf8'));
        const items = jsonData.items || jsonData;
        
        console.log(`📈 Found ${items.length} cards to upload`);
        
        // Clear existing database first
        console.log('🗑️ Clearing existing database...');
        try {
            await axios.delete(`${RAILWAY_URL}/api/clear-database`);
            console.log('✅ Database cleared successfully');
        } catch (error) {
            console.log('⚠️ Could not clear database (might be empty):', error.response?.data?.message || error.message);
        }
        
        // Upload cards in chunks
        const totalChunks = Math.ceil(items.length / CHUNK_SIZE);
        let totalUploaded = 0;
        let totalErrors = 0;
        
        console.log(`📦 Uploading ${items.length} cards in ${totalChunks} chunks of ${CHUNK_SIZE}...`);
        
        for (let i = 0; i < items.length; i += CHUNK_SIZE) {
            const chunk = items.slice(i, i + CHUNK_SIZE);
            const chunkNumber = Math.floor(i / CHUNK_SIZE) + 1;
            
            console.log(`\n📦 Uploading chunk ${chunkNumber}/${totalChunks} (cards ${i + 1}-${Math.min(i + CHUNK_SIZE, items.length)})`);
            
            try {
                const response = await axios.post(`${RAILWAY_URL}/api/add-cards`, {
                    cards: chunk
                }, {
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    timeout: 60000 // 60 second timeout
                });
                
                if (response.data.success) {
                    const stats = response.data.stats;
                    totalUploaded += stats.inserted;
                    totalErrors += stats.errors;
                    
                    console.log(`✅ Chunk ${chunkNumber} uploaded successfully`);
                    console.log(`   📊 Inserted: ${stats.inserted}, Errors: ${stats.errors}`);
                    console.log(`   📈 Progress: ${Math.round((i + CHUNK_SIZE) / items.length * 100)}% complete`);
                } else {
                    console.error(`❌ Chunk ${chunkNumber} failed:`, response.data.message);
                    totalErrors += chunk.length;
                }
                
            } catch (error) {
                console.error(`❌ Error uploading chunk ${chunkNumber}:`, error.response?.data?.message || error.message);
                totalErrors += chunk.length;
            }
            
            // Add a small delay between chunks to be respectful
            if (i + CHUNK_SIZE < items.length) {
                console.log('⏳ Waiting 2 seconds before next chunk...');
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        
        // Final summary
        console.log('\n🎉 UPLOAD COMPLETE!');
        console.log('===================');
        console.log(`📊 Total cards processed: ${items.length}`);
        console.log(`✅ Successfully uploaded: ${totalUploaded}`);
        console.log(`❌ Errors: ${totalErrors}`);
        console.log(`📈 Success rate: ${Math.round(totalUploaded / items.length * 100)}%`);
        
        // Check final database status
        console.log('\n📊 Checking final database status...');
        try {
            const statusResponse = await axios.get(`${RAILWAY_URL}/api/database-status`);
            if (statusResponse.data.success) {
                const stats = statusResponse.data.stats;
                console.log(`🗄️ Database now contains:`);
                console.log(`   📈 Total cards: ${stats.total}`);
                console.log(`   💰 Cards with prices: ${stats.withPrices}`);
                console.log(`   🔄 Cards missing prices: ${stats.missingPrices}`);
                console.log(`   📊 Coverage: ${Math.round(stats.withPrices / stats.total * 100)}%`);
            }
        } catch (error) {
            console.error('❌ Could not check database status:', error.response?.data?.message || error.message);
        }
        
        console.log('\n🚀 Ready for price updates!');
        console.log(`💡 Use this command to update prices:`);
        console.log(`   POST ${RAILWAY_URL}/api/update-prices`);
        console.log(`   Body: {"batchSize": 25}`);
        
    } catch (error) {
        console.error('❌ Fatal error during upload:', error.message);
        process.exit(1);
    }
}

// Run the upload
if (require.main === module) {
    uploadCardsToRailway().then(() => {
        console.log('\n✅ Script completed successfully!');
    }).catch((error) => {
        console.error('\n❌ Script failed:', error.message);
        process.exit(1);
    });
}

module.exports = { uploadCardsToRailway };
