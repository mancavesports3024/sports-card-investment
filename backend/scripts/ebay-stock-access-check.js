#!/usr/bin/env node
// Read-only check that the seller token can read per-card stock through the Trading API.
// Usage (from backend/):
//   railway run -e production -s web node scripts/ebay-stock-access-check.js [itemId] [cardNumber ...]
//   railway run -e production -s web node scripts/ebay-stock-access-check.js --find "Pete Crow-Armstrong"
// --find builds the full index snapshot IN MEMORY (GetSellerList + one GetItem per listing) and searches it;
// nothing is written to Postgres. Prints only scope results, eBay error codes, counts, and picks.
// Never prints tokens. Makes no eBay writes.
const path = require('path');
if (!process.env.RAILWAY_ENVIRONMENT_NAME) require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { createEbaySellerClient, SCOPES } = require('../services/ebaySellerClient');
const { createTradingClient } = require('../services/ebayTradingClient');
const { buildStock, buildIndexSnapshot, nameMatches } = require('../services/ebayStock');

const args = process.argv.slice(2);
const findIdx = args.indexOf('--find');
const FIND = findIdx >= 0 ? args[findIdx + 1] : null;
const positional = findIdx >= 0 ? [] : args;
const ITEM_ID = positional[0] || '398443804414';
const CARDS = positional.length > 1 ? positional.slice(1) : ['3', '45'];
const NAMES = ['Yordan Alvarez', 'Pete Crow-Armstrong'];

const describe = (err) => `${err.kind || err.code || 'ERROR'}${err.status ? ` http=${err.status}` : ''}${err.oauthError ? ` oauth=${err.oauthError}` : ''}${err.errorCodes && err.errorCodes.length ? ` tradingErrorCodes=${err.errorCodes.join(',')}` : ''}`;
const fmt = (p) => `"${p.card}" available=${p.quantityAvailable} sold=${p.quantitySold} soldOut=${p.soldOut} price=${p.price ? `${p.price.value} ${p.price.currency}` : 'n/a'}`;

async function scopeCheck() {
  try {
    await createEbaySellerClient().getAccessToken('https://api.ebay.com/oauth/api_scope');
    console.log('base api_scope: token minted');
  } catch (err) {
    console.log(`base api_scope: NOT in refresh-token consent (${describe(err)})`);
  }
}

async function stockCheck(trading) {
  const started = Date.now();
  const stock = await buildStock(trading, { itemId: ITEM_ID });
  console.log(`GetItem ${ITEM_ID} OK in ${Date.now() - started} ms: "${stock.title}" status=${stock.listingStatus} variations=${stock.variationListing} picks=${stock.pickCount} available=${stock.availableCount} soldOut=${stock.soldOutCount} unparsed=${stock.unparsedCount}`);
  const numbers = stock.picks.map((p) => p.cardNumber).filter(Boolean);
  console.log(`  card numbers offered: ${numbers.join(', ')}`);
  for (const n of CARDS) {
    const hits = stock.picks.filter((p) => String(p.cardNumber || '').toUpperCase() === n.toUpperCase());
    console.log(hits.length ? hits.map((p) => `  #${n}: ${fmt(p)}`).join('\n') : `  #${n}: not offered in this listing`);
  }
  for (const name of NAMES) {
    const hits = stock.picks.filter((p) => nameMatches(p.cardName || p.card, name));
    console.log(hits.length ? hits.map((p) => `  ${name}: ${fmt(p)}`).join('\n') : `  ${name}: no pick with this name in this listing`);
  }
  console.log(`  sample picks: ${stock.picks.slice(0, 3).map((p) => fmt(p)).join(' | ')}`);
  console.log(`  SKUs present on ${stock.picks.filter((p) => p.sku).length}/${stock.pickCount} picks`);
}

async function findCheck(trading, name) {
  const started = Date.now();
  const { listings, stats } = await buildIndexSnapshot(trading, {});
  console.log(`Snapshot built in ${Date.now() - started} ms: ${JSON.stringify(stats)}`);
  let total = 0;
  for (const l of listings) {
    const hits = l.picks.filter((p) => nameMatches(l.variationListing ? (p.cardName || p.card) : l.title, name));
    if (!hits.length) continue;
    total += hits.length;
    console.log(`- ${l.itemId} "${l.title}"`);
    for (const p of hits) console.log(`    ${p.cardNumber ? `#${p.cardNumber} ` : ''}${fmt(p)}`);
  }
  console.log(`"${name}": ${total} picks in ${listings.filter((l) => l.picks.some((p) => nameMatches(l.variationListing ? (p.cardName || p.card) : l.title, name))).length} listings`);
}

(async () => {
  await scopeCheck();
  const trading = createTradingClient({ sellerClient: createEbaySellerClient() });
  try {
    if (FIND) await findCheck(trading, FIND);
    else await stockCheck(trading);
  } catch (err) {
    console.log(`Trading call failed (${describe(err)})`);
    process.exitCode = 1;
  }
})();
