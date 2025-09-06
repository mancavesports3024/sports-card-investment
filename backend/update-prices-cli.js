#!/usr/bin/env node

/**
 * CLI script to update PSA 10, PSA 9 and Raw average prices for cards
 * 
 * Usage:
 *   node update-prices-cli.js                     # Update 50 cards with 2s delay
 *   node update-prices-cli.js --limit 10          # Update 10 cards  
 *   node update-prices-cli.js --delay 3000        # Use 3s delay
 *   node update-prices-cli.js --limit 10 --delay 1000  # Update 10 cards with 1s delay
 */

const PSA9RawPriceUpdater = require('./psa9-raw-price-updater.js');

async function main() {
    // Parse command line arguments
    const args = process.argv.slice(2);
    
    const limit = args.includes('--limit') ? 
        parseInt(args[args.indexOf('--limit') + 1]) || 50 : 50;
    const delayMs = args.includes('--delay') ? 
        parseInt(args[args.indexOf('--delay') + 1]) || 2000 : 2000;
    
    console.log('🚀 PSA 10, PSA 9 and Raw Price Updater');
    console.log('=======================================\n');
    console.log(`⚙️ Configuration:`);
    console.log(`   Limit: ${limit} cards`);
    console.log(`   Delay: ${delayMs}ms between requests\n`);
    
    const updater = new PSA9RawPriceUpdater();
    
    try {
        const result = await updater.updatePrices({ limit, delayMs });
        
        console.log(`\n✅ Process completed successfully!`);
        console.log(`📊 Results: ${result.updated} updated, ${result.errors} errors`);
        process.exit(0);
        
    } catch (error) {
        console.error(`\n❌ Process failed: ${error.message}`);
        console.error(error.stack);
        process.exit(1);
    }
}

// Show help if requested
if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(`
PSA 9 and Raw Price Updater
============================

This script finds PSA 10 cards that are missing PSA 9 and Raw prices,
searches eBay for those price points, and updates the database.

Usage:
  node update-prices-cli.js [options]

Options:
  --limit <number>    Number of cards to process (default: 50)
  --delay <number>    Delay between eBay requests in ms (default: 2000)
  --help, -h          Show this help message

Examples:
  node update-prices-cli.js
  node update-prices-cli.js --limit 10
  node update-prices-cli.js --limit 25 --delay 3000

API Endpoint:
  POST /api/admin/update-psa9-raw-prices
  Body: { "limit": 50, "delayMs": 2000 }
`);
    process.exit(0);
}

main();
