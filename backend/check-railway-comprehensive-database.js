const https = require('https');

class RailwayComprehensiveDatabaseChecker {
    constructor() {
        this.baseUrl = 'https://web-production-9efa.up.railway.app';
    }

    async makeRequest(endpoint, method = 'GET') {
        return new Promise((resolve, reject) => {
            const url = `${this.baseUrl}${endpoint}`;
            const options = {
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                }
            };

            const req = https.request(url, options, (res) => {
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => {
                    try {
                        const jsonData = JSON.parse(data);
                        resolve(jsonData);
                    } catch (error) {
                        resolve({ raw: data });
                    }
                });
            });

            req.on('error', (error) => {
                reject(error);
            });

            req.end();
        });
    }

    async checkDatabase() {
        try {
            console.log('🔍 Checking Railway comprehensive database...\n');

            // First, let's check if the database file exists by looking at the data directory
            console.log('📁 Checking database status...');
            const statusResponse = await this.makeRequest('/api/database-status');
            console.log('Database Status:', JSON.stringify(statusResponse, null, 2));
            console.log('');

            // Try to trigger comprehensive database recreation to see what happens
            console.log('🔄 Triggering comprehensive database recreation...');
            try {
                const recreateResponse = await this.makeRequest('/api/recreate-comprehensive-database', 'POST');
                console.log('Recreate Response:', JSON.stringify(recreateResponse, null, 2));
            } catch (error) {
                console.log('❌ Error triggering recreation:', error.message);
            }
            console.log('');

            // Try to trigger the enhance comprehensive database
            console.log('🚀 Trying to trigger enhance comprehensive database...');
            try {
                const enhanceResponse = await this.makeRequest('/api/enhance-comprehensive-database', 'POST');
                console.log('Enhance Response:', JSON.stringify(enhanceResponse, null, 2));
            } catch (error) {
                console.log('❌ Error triggering enhancement:', error.message);
            }
            console.log('');

            // Check if we can get some sample cards to see what sport detection is working
            console.log('🃏 Checking sample cards from main database...');
            try {
                const cardsResponse = await this.makeRequest('/api/admin/cards?limit=5');
                if (cardsResponse.success && cardsResponse.cards) {
                    console.log('Sample cards:');
                    cardsResponse.cards.forEach(card => {
                        console.log(`   - ${card.title}`);
                        console.log(`     Sport: ${card.sport || 'Unknown'}`);
                        console.log(`     PSA 10: $${card.psa10Price || 'N/A'}`);
                        console.log(`     Raw: $${card.rawAveragePrice || 'N/A'}`);
                        console.log('');
                    });
                }
            } catch (error) {
                console.log('❌ Error getting cards:', error.message);
            }

            // Let's also check if there are any logs or error messages
            console.log('📋 Checking for any error logs or messages...');
            try {
                const testResponse = await this.makeRequest('/api/test-comprehensive-database');
                console.log('Test Response:', JSON.stringify(testResponse, null, 2));
            } catch (error) {
                console.log('❌ No test endpoint available:', error.message);
            }

        } catch (error) {
            console.error('❌ Error checking Railway database:', error);
        }
    }
}

// Main execution
async function main() {
    const checker = new RailwayComprehensiveDatabaseChecker();
    await checker.checkDatabase();
}

if (require.main === module) {
    main();
}

module.exports = { RailwayComprehensiveDatabaseChecker };
