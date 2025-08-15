const sqlite3 = require('sqlite3').verbose();
const path = require('path');

async function addMoreMissingCardTypes() {
    const dbPath = path.join(__dirname, 'data', 'comprehensive-card-database.db');
    
    console.log('🔍 Adding more missing card types to comprehensive database...');
    
    const db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
            console.error('❌ Error connecting to comprehensive database:', err.message);
            return;
        }
        console.log('✅ Connected to comprehensive database');
    });

    // Additional card sets/types that need to be added based on user issues
    const additionalCardSets = [
        // Card sets identified in user issues
        { name: 'Ultra Violet', brand: 'Topps', setName: 'Ultra Violet', sport: 'Baseball' },
        { name: 'National Pride', brand: 'Panini', setName: 'National Pride', sport: 'Football' },
        { name: 'Flashback', brand: 'Panini', setName: 'Flashback', sport: 'Football' },
        { name: 'Best', brand: 'Bowman', setName: 'Best', sport: 'Baseball' },
        { name: 'Bowman\'s Best', brand: 'Bowman', setName: 'Bowman\'s Best', sport: 'Baseball' },
        { name: 'Prizmatic Green', brand: 'Panini', setName: 'Prizmatic Green', sport: 'Football' },
        { name: 'PRISM REFRACTOR', brand: 'Topps', setName: 'PRISM REFRACTOR', sport: 'Baseball' },
        { name: 'GREEN', brand: 'Panini', setName: 'GREEN', sport: 'Football' },
        { name: 'REFRACTOR', brand: 'Topps', setName: 'REFRACTOR', sport: 'Baseball' },
        { name: 'The Rookies', brand: 'Panini', setName: 'The Rookies', sport: 'Football' },
        { name: 'Penmanship', brand: 'Panini', setName: 'Penmanship', sport: 'Basketball' },
        { name: 'Color Blast', brand: 'Panini', setName: 'Color Blast', sport: 'Golf' },
        { name: 'Liv Golf', brand: 'Panini', setName: 'Liv Golf', sport: 'Golf' },
        { name: 'Club Level', brand: 'Panini', setName: 'Club Level', sport: 'Football' },
        { name: 'Die-Cut', brand: 'Panini', setName: 'Die-Cut', sport: 'Football' },
        { name: 'Blue Hyper', brand: 'Panini', setName: 'Blue Hyper', sport: 'Football' },
        { name: 'Pink Refractor', brand: 'Topps', setName: 'Pink Refractor', sport: 'Football' },
        { name: 'Uptown', brand: 'Panini', setName: 'Uptown', sport: 'Football' },
        { name: 'Silver', brand: 'Panini', setName: 'Silver', sport: 'Basketball' },
        { name: 'Auto', brand: 'Panini', setName: 'Auto', sport: 'Basketball' },
        { name: 'Cyan', brand: 'Panini', setName: 'Cyan', sport: 'Football' },
        { name: 'Red Refractor', brand: 'Bowman', setName: 'Red Refractor', sport: 'Baseball' },
        { name: 'Copper', brand: 'Panini', setName: 'Copper', sport: 'Football' },
        { name: 'No Huddle', brand: 'Panini', setName: 'No Huddle', sport: 'Football' },
        { name: 'Rated Rookie', brand: 'Panini', setName: 'Rated Rookie', sport: 'Football' },
        { name: 'Optic', brand: 'Panini', setName: 'Optic', sport: 'Football' },
        { name: 'Chrome', brand: 'Topps', setName: 'Chrome', sport: 'Baseball' },
        { name: 'Chrome Update', brand: 'Topps', setName: 'Chrome Update', sport: 'Baseball' },
        { name: 'Update', brand: 'Topps', setName: 'Update', sport: 'Baseball' },
        { name: 'Finest', brand: 'Topps', setName: 'Finest', sport: 'Baseball' },
        { name: 'Mosaic', brand: 'Panini', setName: 'Mosaic', sport: 'Basketball' },
        { name: 'Donruss', brand: 'Panini', setName: 'Donruss', sport: 'Football' },
        { name: 'Donruss Optic', brand: 'Panini', setName: 'Donruss Optic', sport: 'Football' },
        { name: 'Prizm', brand: 'Panini', setName: 'Prizm', sport: 'Football' },
        { name: 'Select', brand: 'Panini', setName: 'Select', sport: 'Football' },
        { name: 'Topps Chrome', brand: 'Topps', setName: 'Topps Chrome', sport: 'Baseball' },
        { name: 'Topps Heritage', brand: 'Topps', setName: 'Topps Heritage', sport: 'Baseball' },
        { name: 'Topps Stadium Club', brand: 'Topps', setName: 'Topps Stadium Club', sport: 'Baseball' },
        { name: 'Topps Allen & Ginter', brand: 'Topps', setName: 'Topps Allen & Ginter', sport: 'Baseball' },
        { name: 'Upper Deck', brand: 'Upper Deck', setName: 'Upper Deck', sport: 'Hockey' },
        { name: 'Skybox', brand: 'Skybox', setName: 'Skybox', sport: 'Basketball' },
        { name: 'Leaf', brand: 'Leaf', setName: 'Leaf', sport: 'Baseball' },
        { name: 'Fleer', brand: 'Fleer', setName: 'Fleer', sport: 'Basketball' },
        { name: 'Score', brand: 'Score', setName: 'Score', sport: 'Football' },
        { name: 'Playoff', brand: 'Playoff', setName: 'Playoff', sport: 'Football' },
        { name: 'Press Pass', brand: 'Press Pass', setName: 'Press Pass', sport: 'Football' },
        { name: 'Sage', brand: 'Sage', setName: 'Sage', sport: 'Football' },
        { name: 'Pacific', brand: 'Pacific', setName: 'Pacific', sport: 'Baseball' },
        { name: 'Metal', brand: 'Metal', setName: 'Metal', sport: 'Basketball' },
        { name: 'Gallery', brand: 'Topps', setName: 'Gallery', sport: 'Baseball' },
        { name: 'Gypsy Queen', brand: 'Topps', setName: 'Gypsy Queen', sport: 'Baseball' },
        { name: 'Archives', brand: 'Topps', setName: 'Archives', sport: 'Baseball' },
        { name: 'Big League', brand: 'Topps', setName: 'Big League', sport: 'Baseball' },
        { name: 'Fire', brand: 'Topps', setName: 'Fire', sport: 'Baseball' },
        { name: 'Opening Day', brand: 'Topps', setName: 'Opening Day', sport: 'Baseball' },
        { name: 'Series 1', brand: 'Topps', setName: 'Series 1', sport: 'Baseball' },
        { name: 'Series 2', brand: 'Topps', setName: 'Series 2', sport: 'Baseball' },
        { name: 'Chrome Update', brand: 'Topps', setName: 'Chrome Update', sport: 'Baseball' },
        { name: 'Chrome Refractor', brand: 'Topps', setName: 'Chrome Refractor', sport: 'Baseball' },
        { name: 'Chrome Sapphire', brand: 'Topps', setName: 'Chrome Sapphire', sport: 'Baseball' },
        { name: 'Chrome Black', brand: 'Topps', setName: 'Chrome Black', sport: 'Baseball' },
        { name: 'Chronicles', brand: 'Panini', setName: 'Chronicles', sport: 'Basketball' },
        { name: 'Chronicles WWE', brand: 'Panini', setName: 'Chronicles WWE', sport: 'Wrestling' },
        { name: 'Rated Rookies', brand: 'Panini', setName: 'Rated Rookies', sport: 'Football' },
        { name: 'Kings', brand: 'Panini', setName: 'Kings', sport: 'Basketball' },
        { name: 'Rookie Kings', brand: 'Panini', setName: 'Rookie Kings', sport: 'Basketball' },
        { name: 'NSCC UEFA', brand: 'Panini', setName: 'NSCC UEFA', sport: 'Soccer' },
        { name: 'NSCC', brand: 'Panini', setName: 'NSCC', sport: 'Soccer' },
        { name: 'UEFA', brand: 'Panini', setName: 'UEFA', sport: 'Soccer' },
        { name: 'Storm Chasers', brand: 'Panini', setName: 'Storm Chasers', sport: 'Basketball' },
        { name: 'Light It Up', brand: 'Panini', setName: 'Light It Up', sport: 'Basketball' },
        { name: 'Downtown', brand: 'Panini', setName: 'Downtown', sport: 'Basketball' },
        { name: 'Skybox', brand: 'Skybox', setName: 'Skybox', sport: 'Basketball' },
        { name: 'Starcade', brand: 'Panini', setName: 'Starcade', sport: 'Basketball' },
        { name: 'REJECTORS', brand: 'Panini', setName: 'REJECTORS', sport: 'Basketball' },
        { name: 'Treasured', brand: 'Panini', setName: 'Treasured', sport: 'Basketball' },
        { name: 'Emergent', brand: 'Panini', setName: 'Emergent', sport: 'Basketball' },
        { name: 'Wave', brand: 'Panini', setName: 'Wave', sport: 'Football' },
        { name: 'Aqua', brand: 'Panini', setName: 'Aqua', sport: 'Football' },
        { name: 'Reactive', brand: 'Panini', setName: 'Reactive', sport: 'Basketball' },
        { name: 'Speckle', brand: 'Panini', setName: 'Speckle', sport: 'Baseball' },
        { name: 'Portals', brand: 'Panini', setName: 'Portals', sport: 'Football' },
        { name: 'Preview', brand: 'Panini', setName: 'Preview', sport: 'Football' },
        { name: 'Card', brand: 'Various', setName: 'Card', sport: 'Various' },
        { name: 'Winning Ticket', brand: 'Panini', setName: 'Winning Ticket', sport: 'Football' },
        { name: 'Logofractor', brand: 'Panini', setName: 'Logofractor', sport: 'Football' },
        { name: 'White Sparkle', brand: 'Panini', setName: 'White Sparkle', sport: 'Football' },
        { name: 'Pulsar', brand: 'Panini', setName: 'Pulsar', sport: 'Baseball' },
        { name: 'Real One', brand: 'Panini', setName: 'Real One', sport: 'Football' },
        { name: 'P.P. Authentic', brand: 'Panini', setName: 'P.P. Authentic', sport: 'Football' },
        { name: 'Autographs', brand: 'Panini', setName: 'Autographs', sport: 'Baseball' },
        { name: 'Cosmic', brand: 'Panini', setName: 'Cosmic', sport: 'Baseball' },
        { name: 'Edition', brand: 'Topps', setName: 'Edition', sport: 'Baseball' },
        { name: 'Debut', brand: 'Topps', setName: 'Debut', sport: 'Baseball' },
        { name: 'Spectra', brand: 'Panini', setName: 'Spectra', sport: 'Football' },
        { name: 'X Vision', brand: 'Panini', setName: 'X Vision', sport: 'Football' },
        { name: 'Meta', brand: 'Panini', setName: 'Meta', sport: 'Football' },
        { name: 'Disco Orange', brand: 'Panini', setName: 'Disco Orange', sport: 'Football' },
        { name: 'Orange Disco Prizm', brand: 'Panini', setName: 'Orange Disco Prizm', sport: 'Football' },
        { name: 'Red Wave', brand: 'Panini', setName: 'Red Wave', sport: 'Football' },
        { name: 'Black White Checker', brand: 'Panini', setName: 'Black White Checker', sport: 'Football' },
        { name: 'Red White Blue', brand: 'Panini', setName: 'Red White Blue', sport: 'Football' },
        { name: 'Elephant Prizm', brand: 'Panini', setName: 'Elephant Prizm', sport: 'Basketball' },
        { name: 'Red Sparkle Prizm', brand: 'Panini', setName: 'Red Sparkle Prizm', sport: 'Football' },
        { name: 'Photon Prizm', brand: 'Panini', setName: 'Photon Prizm', sport: 'Basketball' },
        { name: 'Mosaic Green', brand: 'Panini', setName: 'Mosaic Green', sport: 'Basketball' },
        { name: 'Blue Pulsar Prizm', brand: 'Panini', setName: 'Blue Pulsar Prizm', sport: 'Football' },
        { name: 'Mega Futures Mojo', brand: 'Bowman', setName: 'Mega Futures Mojo', sport: 'Baseball' },
        { name: 'Pink Speckle Refractor', brand: 'Topps', setName: 'Pink Speckle Refractor', sport: 'Baseball' },
        { name: 'Blue Auto', brand: 'Panini', setName: 'Blue Auto', sport: 'Football' },
        { name: 'Pink Speckle', brand: 'Topps', setName: 'Pink Speckle', sport: 'Baseball' },
        { name: 'Preview Pink', brand: 'Panini', setName: 'Preview Pink', sport: 'Football' },
        { name: 'Optic Preview', brand: 'Panini', setName: 'Optic Preview', sport: 'Football' },
        { name: 'Wave Optic', brand: 'Panini', setName: 'Wave Optic', sport: 'Football' }
    ];

    try {
        // Check if sets table exists
        const tableExists = await new Promise((resolve, reject) => {
            db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='sets'", (err, row) => {
                if (err) reject(err);
                else resolve(!!row);
            });
        });

        if (!tableExists) {
            console.log('❌ Sets table does not exist in comprehensive database');
            db.close();
            return;
        }

        // Insert new card sets
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO sets
            (name, sport, year, brand, setName, source, searchText, displayName)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        let added = 0;
        let skipped = 0;

        for (const cardSet of additionalCardSets) {
            try {
                // Check if this set already exists
                const exists = await new Promise((resolve, reject) => {
                    db.get("SELECT id FROM sets WHERE name = ?", [cardSet.name], (err, row) => {
                        if (err) reject(err);
                        else resolve(!!row);
                    });
                });

                if (exists) {
                    console.log(`⏭️  Skipping existing set: ${cardSet.name}`);
                    skipped++;
                    continue;
                }

                // Insert the new set
                await new Promise((resolve, reject) => {
                    stmt.run([
                        cardSet.name,
                        cardSet.sport,
                        '2024', // Default year
                        cardSet.brand,
                        cardSet.setName,
                        'manual_addition',
                        cardSet.name.toLowerCase(),
                        cardSet.name
                    ], function(err) {
                        if (err) reject(err);
                        else resolve();
                    });
                });

                console.log(`✅ Added: ${cardSet.name} (${cardSet.sport})`);
                added++;

            } catch (error) {
                console.error(`❌ Error adding ${cardSet.name}:`, error.message);
            }
        }

        stmt.finalize();

        console.log('\n📊 Summary:');
        console.log(`✅ Added: ${added} new card sets`);
        console.log(`⏭️  Skipped: ${skipped} existing sets`);

        db.close();
        console.log('🎉 Finished adding missing card types!');

    } catch (error) {
        console.error('❌ Error:', error);
        db.close();
    }
}

// Run the function
addMoreMissingCardTypes()
    .then(() => {
        console.log('✅ Script completed successfully');
        process.exit(0);
    })
    .catch(error => {
        console.error('❌ Script failed:', error);
        process.exit(1);
    });
