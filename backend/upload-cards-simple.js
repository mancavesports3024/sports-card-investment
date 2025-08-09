const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Configuration
const RAILWAY_URL = 'https://web-production-9efa.up.railway.app';
const JSON_FILE_PATH = path.join(__dirname, 'data', 'psa10_recent_90_days_database.json');
const CHUNK_SIZE = 10; // Smaller chunks for testing

async function uploadCardsSimple() {
    console.log('🚀 Starting simple card upload to Railway...');
    console.log('===========================================');
    
    try {
        // Check if JSON file exists
        if (!fs.existsSync(JSON_FILE_PATH)) {
            console.error(`❌ JSON file not found: ${JSON_FILE_PATH}`);
            return;
        }
        
        // Load JSON data
        console.log(`📊 Loading data from: ${JSON_FILE_PATH}`);
        const jsonData = JSON.parse(fs.readFileSync(JSON_FILE_PATH, 'utf8'));
        const items = jsonData.items || jsonData;
        
        console.log(`📈 Found ${items.length} cards to upload`);
        
        // Take only first 100 cards for testing
        const testItems = items.slice(0, 100);
        console.log(`🧪 Testing with first ${testItems.length} cards`);
        
        // Create database first
        console.log('🗄️ Creating database...');
        try {
            await axios.post(`${RAILWAY_URL}/api/create-database`);
            console.log('✅ Database created successfully');
        } catch (error) {
            console.log('⚠️ Database creation failed:', error.response?.data?.message || error.message);
        }
        
        // Upload cards in small chunks
        const totalChunks = Math.ceil(testItems.length / CHUNK_SIZE);
        let totalUploaded = 0;
        
        console.log(`📦 Uploading ${testItems.length} cards in ${totalChunks} chunks of ${CHUNK_SIZE}...`);
        
        for (let i = 0; i < testItems.length; i += CHUNK_SIZE) {
            const chunk = testItems.slice(i, i + CHUNK_SIZE);
            const chunkNumber = Math.floor(i / CHUNK_SIZE) + 1;
            
            console.log(`\n📦 Uploading chunk ${chunkNumber}/${totalChunks} (cards ${i + 1}-${Math.min(i + CHUNK_SIZE, testItems.length)})`);
            
            try {
                // Try the new endpoint first
                const response = await axios.post(`${RAILWAY_URL}/api/add-cards`, {
                    cards: chunk
                }, {
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000
                });
                
                if (response.data.success) {
                    const stats = response.data.stats;
                    totalUploaded += stats.inserted;
                    
                    console.log(`✅ Chunk ${chunkNumber} uploaded successfully`);
                    console.log(`   📊 Inserted: ${stats.inserted}, Errors: ${stats.errors}`);
                    console.log(`   📈 Progress: ${Math.round((i + CHUNK_SIZE) / testItems.length * 100)}% complete`);
                } else {
                    console.error(`❌ Chunk ${chunkNumber} failed:`, response.data.message);
                }
                
            } catch (error) {
                console.error(`❌ Error uploading chunk ${chunkNumber}:`, error.response?.data?.message || error.message);
                
                // If the new endpoint fails, try manual insertion
                console.log('🔄 Trying manual insertion...');
                try {
                    const { SQLitePriceUpdater } = require('./sqlite-price-updater.js');
                    const updater = new SQLitePriceUpdater();
                    await updater.connect();
                    
                    for (const card of chunk) {
                        await new Promise((resolve, reject) => {
                            updater.db.run(`
                                INSERT INTO cards (
                                    title, summaryTitle, sport, filterInfo, created_at, updated_at
                                ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                            `, [
                                card.title || '',
                                card.summaryTitle || '',
                                card.sport || null,
                                card.filterInfo ? JSON.stringify(card.filterInfo) : null
                            ], function(err) {
                                if (err) {
                                    console.error('❌ Error inserting card:', err);
                                    reject(err);
                                } else {
                                    totalUploaded++;
                                    resolve();
                                }
                            });
                        });
                    }
                    
                    updater.db.close();
                    console.log(`✅ Manual insertion successful for chunk ${chunkNumber}`);
                    
                } catch (manualError) {
                    console.error(`❌ Manual insertion also failed for chunk ${chunkNumber}:`, manualError.message);
                }
            }
            
            // Add a small delay between chunks
            if (i + CHUNK_SIZE < testItems.length) {
                console.log('⏳ Waiting 1 second before next chunk...');
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        // Final summary
        console.log('\n🎉 UPLOAD COMPLETE!');
        console.log('===================');
        console.log(`📊 Total cards processed: ${testItems.length}`);
        console.log(`✅ Successfully uploaded: ${totalUploaded}`);
        console.log(`📈 Success rate: ${Math.round(totalUploaded / testItems.length * 100)}%`);
        
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
            }
        } catch (error) {
            console.error('❌ Could not check database status:', error.response?.data?.message || error.message);
        }
        
    } catch (error) {
        console.error('❌ Fatal error during upload:', error.message);
        process.exit(1);
    }
}

// Run the upload
if (require.main === module) {
    uploadCardsSimple().then(() => {
        console.log('\n✅ Script completed successfully!');
    }).catch((error) => {
        console.error('\n❌ Script failed:', error.message);
        process.exit(1);
    });
}

module.exports = { uploadCardsSimple };
