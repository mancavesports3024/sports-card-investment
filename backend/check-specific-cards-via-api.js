const https = require('https');

class SpecificCardCheckerViaAPI {
    constructor() {
        this.baseUrl = 'web-production-9efa.up.railway.app';
    }

    async makeRequest(endpoint, method = 'GET', data = null) {
        return new Promise((resolve, reject) => {
            const options = {
                hostname: this.baseUrl,
                port: 443,
                path: endpoint,
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                }
            };

            const req = https.request(options, (res) => {
                let responseData = '';
                res.on('data', (chunk) => {
                    responseData += chunk;
                });
                res.on('end', () => {
                    try {
                        const result = JSON.parse(responseData);
                        resolve({
                            status: 'success',
                            data: result,
                            statusCode: res.statusCode
                        });
                    } catch (error) {
                        resolve({
                            status: 'error',
                            code: res.statusCode,
                            message: 'Invalid JSON response',
                            data: responseData
                        });
                    }
                });
            });

            req.on('error', (error) => {
                resolve({
                    status: 'error',
                    code: 500,
                    message: error.message
                });
            });

            req.setTimeout(30000, () => {
                req.destroy();
                resolve({
                    status: 'error',
                    code: 408,
                    message: 'Request timeout'
                });
            });

            if (data) {
                req.write(JSON.stringify(data));
            }

            req.end();
        });
    }

    async checkSpecificCards() {
        console.log('🔍 Checking specific cards via Railway API...\n');
        
        try {
            // Get all cards from the API
            const response = await this.makeRequest('/api/admin/cards?limit=1000');
            
            if (response.status !== 'success') {
                console.error('❌ Failed to fetch cards:', response);
                return;
            }
            
            const cards = response.data.cards || [];
            console.log(`📊 Found ${cards.length} cards to check\n`);
            
            // Search for cards that might match the examples
            const searchTerms = [
                'Demaryius Thomas',
                'Caitlin Clark',
                'Stephon Castle',
                'Josh Allen',
                'Cassius Clay',
                'Kyle Harrison',
                'Dj Lagway'
            ];
            
            for (const searchTerm of searchTerms) {
                console.log(`\n🔍 Searching for: "${searchTerm}"`);
                
                const matchingCards = cards.filter(card => 
                    (card.title && card.title.includes(searchTerm)) ||
                    (card.summaryTitle && card.summaryTitle.includes(searchTerm)) ||
                    (card.playerName && card.playerName.includes(searchTerm))
                );
                
                if (matchingCards.length > 0) {
                    console.log(`📊 Found ${matchingCards.length} cards:`);
                    matchingCards.forEach((card, index) => {
                        console.log(`\n   Card ${index + 1} (ID: ${card.id}):`);
                        console.log(`   Title: "${card.title}"`);
                        console.log(`   Summary: "${card.summaryTitle}"`);
                        console.log(`   Player: "${card.playerName}"`);
                        console.log(`   Sport: "${card.sport}"`);
                        console.log(`   Brand: "${card.brand}"`);
                        console.log(`   Year: "${card.year}"`);
                    });
                } else {
                    console.log(`   No cards found for "${searchTerm}"`);
                }
            }
            
            // Also check for cards with obvious issues
            console.log('\n🔍 Checking for cards with obvious summary title issues...');
            
            const problematicCards = cards.filter(card => {
                const summaryTitle = card.summaryTitle || '';
                return summaryTitle.includes('PSA 10') ||
                       summaryTitle.includes('GEM MINT') ||
                       summaryTitle.includes('RC RC') ||
                       summaryTitle.includes('ROOKIE ROOKIE') ||
                       summaryTitle.includes('AUTO AUTO');
            });
            
            if (problematicCards.length > 0) {
                console.log(`📊 Found ${problematicCards.length} cards with obvious issues:`);
                problematicCards.slice(0, 10).forEach((card, index) => {
                    console.log(`\n   Problematic Card ${index + 1} (ID: ${card.id}):`);
                    console.log(`   Title: "${card.title}"`);
                    console.log(`   Summary: "${card.summaryTitle}"`);
                    console.log(`   Player: "${card.playerName}"`);
                });
            } else {
                console.log('   No cards with obvious summary title issues found');
            }
            
        } catch (error) {
            console.error('❌ Error checking specific cards:', error);
            throw error;
        }
    }
}

// Export for use
module.exports = { SpecificCardCheckerViaAPI };

// For running directly
if (require.main === module) {
    const checker = new SpecificCardCheckerViaAPI();
    checker.checkSpecificCards()
        .then(() => {
            console.log('\n✅ Specific card check completed successfully!');
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ Specific card check failed:', error);
            process.exit(1);
        });
}
