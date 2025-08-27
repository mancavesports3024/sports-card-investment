const https = require('https');
const NewPricingDatabase = require('./create-new-pricing-database.js');

const RAILWAY_URL = 'https://web-production-9efa.up.railway.app';

async function makeRequest(path, method = 'GET', data = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'web-production-9efa.up.railway.app',
            port: 443,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json',
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => {
                body += chunk;
            });
            res.on('end', () => {
                try {
                    const response = JSON.parse(body);
                    resolve(response);
                } catch (error) {
                    resolve(body);
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        if (data) {
            req.write(JSON.stringify(data));
        }
        req.end();
    });
}

class RailwayPlayerNameExtractor {
    constructor() {
        this.API_BASE_URL = RAILWAY_URL;
        this.extractor = new NewPricingDatabase();
        this.batchSize = 50;
        this.fixedCount = 0;
        this.errorCount = 0;
    }

    async extractPlayerNames() {
        console.log('🔍 Starting player name extraction for NULL player_name fields...\n');

        let offset = 0;
        let hasMore = true;

        while (hasMore) {
            try {
                // Get batch of cards with NULL player_name
                const response = await fetch(`${this.API_BASE_URL}/api/admin/cards?limit=${this.batchSize}&offset=${offset}`);
                const data = await response.json();

                if (!data.success || !data.cards || data.cards.length === 0) {
                    hasMore = false;
                    break;
                }

                // Filter for cards with NULL player_name
                const nullPlayerNameCards = data.cards.filter(card => !card.player_name || card.player_name === 'NULL');

                if (nullPlayerNameCards.length === 0) {
                    console.log(`No more cards with NULL player_name found at offset ${offset}`);
                    hasMore = false;
                    break;
                }

                console.log(`📦 Processing batch ${Math.floor(offset / this.batchSize) + 1}: ${nullPlayerNameCards.length} cards with NULL player_name`);

                // Process each card
                for (const card of nullPlayerNameCards) {
                    await this.processCard(card);
                }

                offset += this.batchSize;

            } catch (error) {
                console.error(`❌ Error processing batch at offset ${offset}:`, error);
                this.errorCount++;
                offset += this.batchSize;
            }
        }

        console.log(`\n✅ Player name extraction completed!`);
        console.log(`📊 Fixed: ${this.fixedCount} cards`);
        console.log(`❌ Errors: ${this.errorCount} cards`);
    }

    async processCard(card) {
        try {
            const title = card.title;
            if (!title) {
                console.log(`⚠️  Card ${card.id} has no title, skipping`);
                return;
            }

            // Extract player name using NewPricingDatabase
            const extractedPlayerName = this.extractor.extractPlayerName(title);
            
            if (!extractedPlayerName || extractedPlayerName.trim() === '') {
                console.log(`⚠️  Could not extract player name from: ${title}`);
                return;
            }

            // Clean the extracted player name
            const cleanedPlayerName = this.cleanPlayerName(extractedPlayerName);

            if (!cleanedPlayerName || cleanedPlayerName.trim() === '') {
                console.log(`⚠️  Player name cleaned to empty for: ${title}`);
                return;
            }

            // Update the card via API
            const updateData = {
                player_name: cleanedPlayerName
            };

            const updateResponse = await fetch(`${this.API_BASE_URL}/api/admin/card/${card.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(updateData)
            });

            if (updateResponse.ok) {
                this.fixedCount++;
                console.log(`✅ Fixed card ${card.id}: "${cleanedPlayerName}" from "${title}"`);
            } else {
                console.error(`❌ Failed to update card ${card.id}: ${updateResponse.statusText}`);
                this.errorCount++;
            }

        } catch (error) {
            console.error(`❌ Error processing card ${card.id}:`, error);
            this.errorCount++;
        }
    }

    cleanPlayerName(playerName) {
        if (!playerName || typeof playerName !== 'string') {
            return playerName;
        }

        let cleaned = playerName.trim();

        // Fix "Ja Marr Chase" to "Ja'Marr Chase" (add missing apostrophe)
        cleaned = cleaned.replace(/\bJa Marr Chase\b/g, "Ja'Marr Chase");
        cleaned = cleaned.replace(/\bJaMarr Chase\b/g, "Ja'Marr Chase");
        cleaned = cleaned.replace(/\bJa'marr Chase\b/g, "Ja'Marr Chase");
        cleaned = cleaned.replace(/\bJAMARR CHASE\b/g, "Ja'Marr Chase");

        // Remove card numbers (e.g., #279, #26, #36)
        cleaned = cleaned.replace(/#\d+/g, '');
        
        // Remove emojis
        cleaned = cleaned.replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '');
        
        // Remove parenthetical content
        cleaned = cleaned.replace(/\([^)]*\)/g, '');
        
        // Remove extra whitespace
        cleaned = cleaned.replace(/\s+/g, ' ').trim();

        return cleaned;
    }
}

async function main() {
    const extractor = new RailwayPlayerNameExtractor();
    await extractor.extractPlayerNames();
}

main().catch(console.error);
