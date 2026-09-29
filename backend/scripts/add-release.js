#!/usr/bin/env node
/**
 * Manual Release Entry Script
 * 
 * Usage:
 *   node backend/scripts/add-release.js
 * 
 * Interactive CLI for adding releases with verification metadata.
 * Requires DATABASE_URL environment variable.
 */

const readline = require('readline');
const { Pool } = require('pg');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function addRelease() {
  console.log('=== Manual Release Entry ===\n');

  const title = await question('Title (required): ');
  if (!title) {
    console.error('❌ Title is required');
    process.exit(1);
  }

  const releaseDate = await question('Release Date (YYYY-MM-DD, required): ');
  if (!releaseDate) {
    console.error('❌ Release date is required');
    process.exit(1);
  }

  const brand = await question('Brand (e.g., Topps, Panini): ');
  const sport = await question('Sport (e.g., Baseball, Basketball): ');
  const year = await question('Year (e.g., 2027): ');
  const description = await question('Description: ');
  const retailPrice = await question('Retail Price (default: TBD): ') || 'TBD';
  const hobbyPrice = await question('Hobby Price (default: TBD): ') || 'TBD';
  
  console.log('\n--- Verification Metadata ---');
  const sourceUrl = await question('Source URL (where you verified this date): ');
  const dateStatus = await question('Date Status (confirmed/estimated/tbd, default: estimated): ') || 'estimated';
  const verificationNotes = await question('Verification Notes (optional): ');
  const verifiedBy = await question('Your email/name: ');

  console.log('\n--- Summary ---');
  console.log(`Title: ${title}`);
  console.log(`Release Date: ${releaseDate}`);
  console.log(`Brand: ${brand || 'N/A'}`);
  console.log(`Sport: ${sport || 'N/A'}`);
  console.log(`Date Status: ${dateStatus}`);
  console.log(`Source: ${sourceUrl || 'N/A'}`);

  const confirm = await question('\nAdd this release? (yes/no): ');
  if (confirm.toLowerCase() !== 'yes' && confirm.toLowerCase() !== 'y') {
    console.log('❌ Cancelled');
    process.exit(0);
  }

  try {
    const result = await pool.query(`
      INSERT INTO releases (
        title, brand, sport, release_date, year, description,
        retail_price, hobby_price, source, source_url, date_status,
        last_verified_at, last_verified_by, verification_notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), $12, $13)
      RETURNING id, title, release_date, date_status
    `, [
      title, brand, sport, releaseDate, year, description,
      retailPrice, hobbyPrice, 'Manual Entry', sourceUrl, dateStatus,
      verifiedBy, verificationNotes
    ]);

    console.log('\n✅ Release added successfully!');
    console.log(`ID: ${result.rows[0].id}`);
    console.log(`Title: ${result.rows[0].title}`);
    console.log(`Date: ${result.rows[0].release_date}`);
    console.log(`Status: ${result.rows[0].date_status}`);
  } catch (error) {
    console.error('\n❌ Error adding release:', error.message);
    if (error.constraint === 'releases_title_release_date_key') {
      console.error('   This release already exists (duplicate title + date)');
    }
    process.exit(1);
  } finally {
    rl.close();
    await pool.end();
  }
}

// Check for DATABASE_URL
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable not set');
  console.error('   Example: export DATABASE_URL="postgresql://..."');
  process.exit(1);
}

addRelease().catch((error) => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
