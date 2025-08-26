const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Connect to the Railway database (using the same path as fix-player-names-railway.js)
const dbPath = path.join(__dirname, '..', 'new-scorecard.db');
const db = new sqlite3.Database(dbPath);

console.log('🔍 Checking player_name field for Chase cards...\n');

// Query to find all cards with "Chase" in the title or player_name
const query = `
    SELECT 
        id,
        title,
        player_name,
        summary_title,
        sport
    FROM cards 
    WHERE title LIKE '%Chase%' 
       OR player_name LIKE '%Chase%'
       OR summary_title LIKE '%Chase%'
    ORDER BY title
`;

db.all(query, [], (err, rows) => {
    if (err) {
        console.error('❌ Error querying database:', err);
        db.close();
        return;
    }

    console.log(`📊 Found ${rows.length} cards with "Chase" in title, player_name, or summary_title:\n`);

    rows.forEach((row, index) => {
        console.log(`${index + 1}. ID: ${row.id}`);
        console.log(`   Title: ${row.title}`);
        console.log(`   Player Name: ${row.player_name || 'NULL'}`);
        console.log(`   Summary Title: ${row.summary_title || 'NULL'}`);
        console.log(`   Sport: ${row.sport || 'NULL'}`);
        console.log('');
    });

    // Check specifically for "Ja Marr Chase" variations
    console.log('🔍 Checking for "Ja Marr Chase" variations in player_name field...\n');
    
    const chaseQuery = `
        SELECT 
            id,
            title,
            player_name,
            summary_title
        FROM cards 
        WHERE player_name LIKE '%Ja%Marr%Chase%'
           OR player_name LIKE '%Ja Marr Chase%'
           OR player_name LIKE '%JaMarr Chase%'
           OR player_name LIKE '%Ja''Marr Chase%'
        ORDER BY title
    `;

    db.all(chaseQuery, [], (err, chaseRows) => {
        if (err) {
            console.error('❌ Error querying for Chase variations:', err);
            db.close();
            return;
        }

        console.log(`📊 Found ${chaseRows.length} cards with "Ja Marr Chase" variations in player_name:\n`);

        chaseRows.forEach((row, index) => {
            console.log(`${index + 1}. ID: ${row.id}`);
            console.log(`   Title: ${row.title}`);
            console.log(`   Player Name: "${row.player_name}"`);
            console.log(`   Summary Title: ${row.summary_title || 'NULL'}`);
            console.log('');
        });

        db.close();
    });
});
