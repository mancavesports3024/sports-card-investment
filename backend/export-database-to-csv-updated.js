const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

class DatabaseExporter {
    constructor() {
        this.dbPath = path.join(__dirname, 'data', 'new-scorecard.db');
        this.outputDir = path.join(__dirname, 'exports');
    }

    async exportDatabase() {
        console.log('📊 Exporting updated database to CSV files...');
        
        // Create exports directory if it doesn't exist
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }

        const db = new sqlite3.Database(this.dbPath);
        
        try {
            // Get all cards with their data
            const cards = await this.getAllCards(db);
            
            // Export to CSV with timestamp
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const csvContent = this.generateCSV(cards);
            const csvPath = path.join(this.outputDir, `cards_export_updated_${timestamp}.csv`);
            fs.writeFileSync(csvPath, csvContent);
            
            // Generate summary report
            const summary = this.generateSummary(cards);
            const summaryPath = path.join(this.outputDir, `summary_report_updated_${timestamp}.txt`);
            fs.writeFileSync(summaryPath, summary);
            
            console.log(`✅ Exported ${cards.length} cards to: ${csvPath}`);
            console.log(`✅ Summary report saved to: ${summaryPath}`);
            
            // Display summary in console
            console.log('\n📋 UPDATED SUMMARY REPORT:');
            console.log(summary);
            
        } catch (error) {
            console.error('❌ Error exporting database:', error);
        } finally {
            db.close();
        }
    }

    getAllCards(db) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT 
                    id,
                    title,
                    summary_title,
                    sport,
                    year,
                    brand,
                    set_name,
                    card_type,
                    condition,
                    grade,
                    raw_average_price,
                    psa9_average_price,
                    psa10_price,
                    psa10_average_price,
                    ebay_item_id,
                    image_url,
                    search_term,
                    source,
                    created_at,
                    last_updated,
                    notes
                FROM cards 
                ORDER BY created_at DESC
            `;
            
            db.all(query, [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows || []);
                }
            });
        });
    }

    generateCSV(cards) {
        const headers = [
            'ID',
            'Title',
            'Summary Title',
            'Sport',
            'Year',
            'Brand',
            'Set Name',
            'Card Type',
            'Condition',
            'Grade',
            'Raw Avg Price',
            'PSA 9 Avg Price',
            'PSA 10 Price',
            'PSA 10 Avg Price',
            'eBay Item ID',
            'Image URL',
            'Search Term',
            'Source',
            'Created At',
            'Last Updated',
            'Notes'
        ];
        
        const csvRows = [headers.join(',')];
        
        cards.forEach(card => {
            const row = [
                card.id,
                `"${card.title.replace(/"/g, '""')}"`, // Escape quotes in title
                `"${(card.summary_title || '').replace(/"/g, '""')}"`,
                card.sport || 'Unknown',
                card.year || 'N/A',
                card.brand || 'N/A',
                card.set_name || 'N/A',
                card.card_type || 'N/A',
                card.condition || 'N/A',
                card.grade || 'N/A',
                card.raw_average_price || 'N/A',
                card.psa9_average_price || 'N/A',
                card.psa10_price || 'N/A',
                card.psa10_average_price || 'N/A',
                card.ebay_item_id || 'N/A',
                card.image_url || 'N/A',
                card.search_term || 'N/A',
                card.source || 'N/A',
                card.created_at,
                card.last_updated,
                card.notes || 'N/A'
            ];
            csvRows.push(row.join(','));
        });
        
        return csvRows.join('\n');
    }

    generateSummary(cards) {
        const totalCards = cards.length;
        const sports = {};
        const priceStats = {
            hasPSA10: 0,
            hasRaw: 0,
            hasPSA9: 0,
            hasPSA10Avg: 0,
            noPrices: 0
        };
        
        cards.forEach(card => {
            // Count sports
            const sport = card.sport || 'Unknown';
            sports[sport] = (sports[sport] || 0) + 1;
            
            // Count price availability
            if (card.psa10_price && card.psa10_price !== 'N/A') {
                priceStats.hasPSA10++;
            }
            if (card.raw_average_price && card.raw_average_price !== 'N/A') {
                priceStats.hasRaw++;
            }
            if (card.psa9_average_price && card.psa9_average_price !== 'N/A') {
                priceStats.hasPSA9++;
            }
            if (card.psa10_average_price && card.psa10_average_price !== 'N/A') {
                priceStats.hasPSA10Avg++;
            }
            if ((!card.raw_average_price || card.raw_average_price === 'N/A') && 
                (!card.psa9_average_price || card.psa9_average_price === 'N/A') &&
                (!card.psa10_average_price || card.psa10_average_price === 'N/A')) {
                priceStats.noPrices++;
            }
        });
        
        let summary = `UPDATED DATABASE EXPORT SUMMARY\n`;
        summary += `Generated: ${new Date().toLocaleString()}\n`;
        summary += `=====================================\n\n`;
        
        summary += `📊 TOTAL CARDS: ${totalCards}\n\n`;
        
        summary += `🏈 SPORTS BREAKDOWN:\n`;
        Object.entries(sports)
            .sort(([,a], [,b]) => b - a)
            .forEach(([sport, count]) => {
                const percentage = ((count / totalCards) * 100).toFixed(1);
                summary += `  ${sport}: ${count} (${percentage}%)\n`;
            });
        
        summary += `\n💰 PRICE AVAILABILITY:\n`;
        summary += `  PSA 10 prices: ${priceStats.hasPSA10} (${((priceStats.hasPSA10 / totalCards) * 100).toFixed(1)}%)\n`;
        summary += `  Raw prices: ${priceStats.hasRaw} (${((priceStats.hasRaw / totalCards) * 100).toFixed(1)}%)\n`;
        summary += `  PSA 9 prices: ${priceStats.hasPSA9} (${((priceStats.hasPSA9 / totalCards) * 100).toFixed(1)}%)\n`;
        summary += `  PSA 10 average prices: ${priceStats.hasPSA10Avg} (${((priceStats.hasPSA10Avg / totalCards) * 100).toFixed(1)}%)\n`;
        summary += `  No raw/PSA 9/PSA 10 average prices: ${priceStats.noPrices} (${((priceStats.noPrices / totalCards) * 100).toFixed(1)}%)\n`;
        
        summary += `\n📅 RECENT CARDS WITH PRICES (Last 15):\n`;
        cards.slice(0, 15).forEach((card, index) => {
            const sport = card.sport || 'Unknown';
            const rawPrice = card.raw_average_price || 'N/A';
            const psa9Price = card.psa9_average_price || 'N/A';
            const psa10Price = card.psa10_price || 'N/A';
            const psa10AvgPrice = card.psa10_average_price || 'N/A';
            const hasPrices = (rawPrice !== 'N/A' || psa9Price !== 'N/A') ? '✅' : '❌';
            summary += `  ${index + 1}. ${hasPrices} ${card.title.substring(0, 50)}... (${sport}) - PSA 10: $${psa10Price}, Raw: $${rawPrice}, PSA 9: $${psa9Price}, PSA 10 Avg: $${psa10AvgPrice}\n`;
        });
        
        return summary;
    }
}

// Run the export
const exporter = new DatabaseExporter();
exporter.exportDatabase().catch(console.error);
