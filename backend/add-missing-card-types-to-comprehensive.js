const sqlite3 = require('sqlite3').verbose();
const path = require('path');

async function addMissingCardTypesToComprehensive() {
    const dbPath = path.join(__dirname, 'data', 'comprehensive-card-database.db');
    
    console.log('🔍 Adding missing card types to comprehensive database...');
    
    const db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
            console.error('❌ Error connecting to comprehensive database:', err.message);
            return;
        }
        console.log('✅ Connected to comprehensive database');
    });

    // Card sets that should be added
    const cardSets = [
        // WNBA sets
        { name: 'Prizm Monopoly WNBA', brand: 'Panini', setName: 'Prizm Monopoly WNBA', sport: 'Basketball' },
        { name: 'Panini Prizm WNBA', brand: 'Panini', setName: 'Panini Prizm WNBA', sport: 'Basketball' },
        { name: 'Panini Instant WNBA', brand: 'Panini', setName: 'Panini Instant WNBA', sport: 'Basketball' },
        
        // New product lines
        { name: 'Panini XR', brand: 'Panini', setName: 'Panini XR', sport: 'Football' },
        { name: 'Topps Chrome UCC', brand: 'Topps', setName: 'Topps Chrome UCC', sport: 'Baseball' },
        { name: 'Spectra', brand: 'Panini', setName: 'Spectra', sport: 'Football' },
        { name: 'Mosaic Basketball Overdrive', brand: 'Panini', setName: 'Mosaic Basketball Overdrive', sport: 'Basketball' },
        
        // Card types that should be recognized as sets
        { name: 'Concourse', brand: 'Panini', setName: 'Concourse', sport: 'Football' },
        { name: 'X Vision Meta', brand: 'Panini', setName: 'X Vision Meta', sport: 'Football' },
        { name: 'NOTORIETY GREEN', brand: 'Panini', setName: 'NOTORIETY GREEN', sport: 'Football' },
        { name: 'Orange Disco Prizm', brand: 'Panini', setName: 'Orange Disco Prizm', sport: 'Football' },
        { name: 'Red Wave', brand: 'Panini', setName: 'Red Wave', sport: 'Football' },
        { name: 'Black White Checker', brand: 'Panini', setName: 'Black White Checker', sport: 'Football' },
        { name: 'Red White Blue', brand: 'Panini', setName: 'Red White Blue', sport: 'Football' },
        { name: 'Elephant Prizm', brand: 'Panini', setName: 'Elephant Prizm', sport: 'Basketball' },
        { name: 'Red Sparkle Prizm', brand: 'Panini', setName: 'Red Sparkle Prizm', sport: 'Football' },
        { name: 'Photon Prizm', brand: 'Panini', setName: 'Photon Prizm', sport: 'Basketball' },
        { name: 'Mosaic Green', brand: 'Panini', setName: 'Mosaic Green', sport: 'Basketball' },
        { name: 'Blue Pulsar Prizm', brand: 'Panini', setName: 'Blue Pulsar Prizm', sport: 'Football' },
        { name: 'Uptown', brand: 'Panini', setName: 'Uptown', sport: 'Football' },
        { name: 'Mega Futures Mojo', brand: 'Bowman', setName: 'Mega Futures Mojo', sport: 'Baseball' },
        { name: 'Pink Speckle Refractor', brand: 'Topps', setName: 'Pink Speckle Refractor', sport: 'Baseball' },
        { name: 'Blue Auto', brand: 'Panini', setName: 'Blue Auto', sport: 'Football' },
        { name: 'White Sparkle', brand: 'Panini', setName: 'White Sparkle', sport: 'Football' },
        { name: 'Pink Speckle', brand: 'Topps', setName: 'Pink Speckle', sport: 'Baseball' },
        { name: 'Preview Pink', brand: 'Panini', setName: 'Preview Pink', sport: 'Football' },
        { name: 'Optic Preview', brand: 'Panini', setName: 'Optic Preview', sport: 'Football' },
        { name: 'Wave Optic', brand: 'Panini', setName: 'Wave Optic', sport: 'Football' },
        { name: 'X Vision', brand: 'Panini', setName: 'X Vision', sport: 'Football' },
        { name: 'Meta', brand: 'Panini', setName: 'Meta', sport: 'Football' },
        { name: 'Disco Orange', brand: 'Panini', setName: 'Disco Orange', sport: 'Football' },
        { name: 'Orange Prizm', brand: 'Panini', setName: 'Orange Prizm', sport: 'Football' },
        { name: 'Red Prizm', brand: 'Panini', setName: 'Red Prizm', sport: 'Football' },
        { name: 'Blue Prizm', brand: 'Panini', setName: 'Blue Prizm', sport: 'Football' },
        { name: 'Green Prizm', brand: 'Panini', setName: 'Green Prizm', sport: 'Football' },
        { name: 'Purple Prizm', brand: 'Panini', setName: 'Purple Prizm', sport: 'Football' },
        { name: 'Pink Prizm', brand: 'Panini', setName: 'Pink Prizm', sport: 'Football' },
        { name: 'Gold Prizm', brand: 'Panini', setName: 'Gold Prizm', sport: 'Football' },
        { name: 'Silver Prizm', brand: 'Panini', setName: 'Silver Prizm', sport: 'Football' },
        { name: 'Black Prizm', brand: 'Panini', setName: 'Black Prizm', sport: 'Football' },
        { name: 'White Prizm', brand: 'Panini', setName: 'White Prizm', sport: 'Football' },
        { name: 'Bronze Prizm', brand: 'Panini', setName: 'Bronze Prizm', sport: 'Football' },
        { name: 'Copper Prizm', brand: 'Panini', setName: 'Copper Prizm', sport: 'Football' },
        { name: 'Platinum Prizm', brand: 'Panini', setName: 'Platinum Prizm', sport: 'Football' },
        { name: 'Diamond Prizm', brand: 'Panini', setName: 'Diamond Prizm', sport: 'Football' },
        { name: 'Emerald Prizm', brand: 'Panini', setName: 'Emerald Prizm', sport: 'Football' },
        { name: 'Ruby Prizm', brand: 'Panini', setName: 'Ruby Prizm', sport: 'Football' },
        { name: 'Sapphire Prizm', brand: 'Panini', setName: 'Sapphire Prizm', sport: 'Football' },
        { name: 'Amethyst Prizm', brand: 'Panini', setName: 'Amethyst Prizm', sport: 'Football' },
        { name: 'Onyx Prizm', brand: 'Panini', setName: 'Onyx Prizm', sport: 'Football' },
        { name: 'Obsidian Prizm', brand: 'Panini', setName: 'Obsidian Prizm', sport: 'Football' },
        { name: 'Crystal Prizm', brand: 'Panini', setName: 'Crystal Prizm', sport: 'Football' },
        { name: 'Glass Prizm', brand: 'Panini', setName: 'Glass Prizm', sport: 'Football' },
        { name: 'Ice Prizm', brand: 'Panini', setName: 'Ice Prizm', sport: 'Football' },
        { name: 'Fire Prizm', brand: 'Panini', setName: 'Fire Prizm', sport: 'Football' },
        { name: 'Lava Prizm', brand: 'Panini', setName: 'Lava Prizm', sport: 'Football' },
        { name: 'Neon Prizm', brand: 'Panini', setName: 'Neon Prizm', sport: 'Football' },
        { name: 'Fluorescent Prizm', brand: 'Panini', setName: 'Fluorescent Prizm', sport: 'Football' },
        { name: 'Holographic Prizm', brand: 'Panini', setName: 'Holographic Prizm', sport: 'Football' },
        { name: 'Rainbow Prizm', brand: 'Panini', setName: 'Rainbow Prizm', sport: 'Football' },
        { name: 'Prismatic Prizm', brand: 'Panini', setName: 'Prismatic Prizm', sport: 'Football' },
        { name: 'Iridescent Prizm', brand: 'Panini', setName: 'Iridescent Prizm', sport: 'Football' },
        { name: 'Metallic Prizm', brand: 'Panini', setName: 'Metallic Prizm', sport: 'Football' },
        { name: 'Chrome Prizm', brand: 'Topps', setName: 'Chrome Prizm', sport: 'Baseball' },
        { name: 'Refractor Prizm', brand: 'Topps', setName: 'Refractor Prizm', sport: 'Baseball' },
        { name: 'Sapphire Prizm', brand: 'Topps', setName: 'Sapphire Prizm', sport: 'Baseball' },
        { name: 'Emerald Prizm', brand: 'Topps', setName: 'Emerald Prizm', sport: 'Baseball' },
        { name: 'Ruby Prizm', brand: 'Topps', setName: 'Ruby Prizm', sport: 'Baseball' },
        { name: 'Diamond Prizm', brand: 'Topps', setName: 'Diamond Prizm', sport: 'Baseball' },
        { name: 'Platinum Prizm', brand: 'Topps', setName: 'Platinum Prizm', sport: 'Baseball' },
        { name: 'Gold Prizm', brand: 'Topps', setName: 'Gold Prizm', sport: 'Baseball' },
        { name: 'Silver Prizm', brand: 'Topps', setName: 'Silver Prizm', sport: 'Baseball' },
        { name: 'Bronze Prizm', brand: 'Topps', setName: 'Bronze Prizm', sport: 'Baseball' },
        { name: 'Copper Prizm', brand: 'Topps', setName: 'Copper Prizm', sport: 'Baseball' },
        { name: 'Black Prizm', brand: 'Topps', setName: 'Black Prizm', sport: 'Baseball' },
        { name: 'White Prizm', brand: 'Topps', setName: 'White Prizm', sport: 'Baseball' },
        { name: 'Red Prizm', brand: 'Topps', setName: 'Red Prizm', sport: 'Baseball' },
        { name: 'Blue Prizm', brand: 'Topps', setName: 'Blue Prizm', sport: 'Baseball' },
        { name: 'Green Prizm', brand: 'Topps', setName: 'Green Prizm', sport: 'Baseball' },
        { name: 'Purple Prizm', brand: 'Topps', setName: 'Purple Prizm', sport: 'Baseball' },
        { name: 'Pink Prizm', brand: 'Topps', setName: 'Pink Prizm', sport: 'Baseball' },
        { name: 'Orange Prizm', brand: 'Topps', setName: 'Orange Prizm', sport: 'Baseball' },
        { name: 'Yellow Prizm', brand: 'Topps', setName: 'Yellow Prizm', sport: 'Baseball' },
        { name: 'Brown Prizm', brand: 'Topps', setName: 'Brown Prizm', sport: 'Baseball' },
        { name: 'Gray Prizm', brand: 'Topps', setName: 'Gray Prizm', sport: 'Baseball' },
        { name: 'Grey Prizm', brand: 'Topps', setName: 'Grey Prizm', sport: 'Baseball' },
        { name: 'Tan Prizm', brand: 'Topps', setName: 'Tan Prizm', sport: 'Baseball' },
        { name: 'Cream Prizm', brand: 'Topps', setName: 'Cream Prizm', sport: 'Baseball' },
        { name: 'Ivory Prizm', brand: 'Topps', setName: 'Ivory Prizm', sport: 'Baseball' },
        { name: 'Beige Prizm', brand: 'Topps', setName: 'Beige Prizm', sport: 'Baseball' },
        { name: 'Khaki Prizm', brand: 'Topps', setName: 'Khaki Prizm', sport: 'Baseball' },
        { name: 'Olive Prizm', brand: 'Topps', setName: 'Olive Prizm', sport: 'Baseball' },
        { name: 'Teal Prizm', brand: 'Topps', setName: 'Teal Prizm', sport: 'Baseball' },
        { name: 'Turquoise Prizm', brand: 'Topps', setName: 'Turquoise Prizm', sport: 'Baseball' },
        { name: 'Cyan Prizm', brand: 'Topps', setName: 'Cyan Prizm', sport: 'Baseball' },
        { name: 'Magenta Prizm', brand: 'Topps', setName: 'Magenta Prizm', sport: 'Baseball' },
        { name: 'Fuchsia Prizm', brand: 'Topps', setName: 'Fuchsia Prizm', sport: 'Baseball' },
        { name: 'Lime Prizm', brand: 'Topps', setName: 'Lime Prizm', sport: 'Baseball' },
        { name: 'Maroon Prizm', brand: 'Topps', setName: 'Maroon Prizm', sport: 'Baseball' },
        { name: 'Navy Prizm', brand: 'Topps', setName: 'Navy Prizm', sport: 'Baseball' },
        { name: 'Burgundy Prizm', brand: 'Topps', setName: 'Burgundy Prizm', sport: 'Baseball' },
        { name: 'Crimson Prizm', brand: 'Topps', setName: 'Crimson Prizm', sport: 'Baseball' },
        { name: 'Scarlet Prizm', brand: 'Topps', setName: 'Scarlet Prizm', sport: 'Baseball' },
        { name: 'Coral Prizm', brand: 'Topps', setName: 'Coral Prizm', sport: 'Baseball' },
        { name: 'Salmon Prizm', brand: 'Topps', setName: 'Salmon Prizm', sport: 'Baseball' },
        { name: 'Peach Prizm', brand: 'Topps', setName: 'Peach Prizm', sport: 'Baseball' },
        { name: 'Apricot Prizm', brand: 'Topps', setName: 'Apricot Prizm', sport: 'Baseball' },
        { name: 'Tangerine Prizm', brand: 'Topps', setName: 'Tangerine Prizm', sport: 'Baseball' },
        { name: 'Amber Prizm', brand: 'Topps', setName: 'Amber Prizm', sport: 'Baseball' },
        { name: 'Golden Prizm', brand: 'Topps', setName: 'Golden Prizm', sport: 'Baseball' },
        { name: 'Silver Metallic Prizm', brand: 'Topps', setName: 'Silver Metallic Prizm', sport: 'Baseball' },
        { name: 'Chrome Metallic Prizm', brand: 'Topps', setName: 'Chrome Metallic Prizm', sport: 'Baseball' },
        { name: 'Refractor Metallic Prizm', brand: 'Topps', setName: 'Refractor Metallic Prizm', sport: 'Baseball' },
        { name: 'Sapphire Metallic Prizm', brand: 'Topps', setName: 'Sapphire Metallic Prizm', sport: 'Baseball' },
        { name: 'Emerald Metallic Prizm', brand: 'Topps', setName: 'Emerald Metallic Prizm', sport: 'Baseball' },
        { name: 'Ruby Metallic Prizm', brand: 'Topps', setName: 'Ruby Metallic Prizm', sport: 'Baseball' },
        { name: 'Diamond Metallic Prizm', brand: 'Topps', setName: 'Diamond Metallic Prizm', sport: 'Baseball' },
        { name: 'Platinum Metallic Prizm', brand: 'Topps', setName: 'Platinum Metallic Prizm', sport: 'Baseball' },
        { name: 'Gold Metallic Prizm', brand: 'Topps', setName: 'Gold Metallic Prizm', sport: 'Baseball' },
        { name: 'Bronze Metallic Prizm', brand: 'Topps', setName: 'Bronze Metallic Prizm', sport: 'Baseball' },
        { name: 'Copper Metallic Prizm', brand: 'Topps', setName: 'Copper Metallic Prizm', sport: 'Baseball' },
        { name: 'Black Metallic Prizm', brand: 'Topps', setName: 'Black Metallic Prizm', sport: 'Baseball' },
        { name: 'White Metallic Prizm', brand: 'Topps', setName: 'White Metallic Prizm', sport: 'Baseball' },
        { name: 'Red Metallic Prizm', brand: 'Topps', setName: 'Red Metallic Prizm', sport: 'Baseball' },
        { name: 'Blue Metallic Prizm', brand: 'Topps', setName: 'Blue Metallic Prizm', sport: 'Baseball' },
        { name: 'Green Metallic Prizm', brand: 'Topps', setName: 'Green Metallic Prizm', sport: 'Baseball' },
        { name: 'Purple Metallic Prizm', brand: 'Topps', setName: 'Purple Metallic Prizm', sport: 'Baseball' },
        { name: 'Pink Metallic Prizm', brand: 'Topps', setName: 'Pink Metallic Prizm', sport: 'Baseball' },
        { name: 'Orange Metallic Prizm', brand: 'Topps', setName: 'Orange Metallic Prizm', sport: 'Baseball' },
        { name: 'Yellow Metallic Prizm', brand: 'Topps', setName: 'Yellow Metallic Prizm', sport: 'Baseball' },
        { name: 'Brown Metallic Prizm', brand: 'Topps', setName: 'Brown Metallic Prizm', sport: 'Baseball' },
        { name: 'Gray Metallic Prizm', brand: 'Topps', setName: 'Gray Metallic Prizm', sport: 'Baseball' },
        { name: 'Grey Metallic Prizm', brand: 'Topps', setName: 'Grey Metallic Prizm', sport: 'Baseball' },
        { name: 'Tan Metallic Prizm', brand: 'Topps', setName: 'Tan Metallic Prizm', sport: 'Baseball' },
        { name: 'Cream Metallic Prizm', brand: 'Topps', setName: 'Cream Metallic Prizm', sport: 'Baseball' },
        { name: 'Ivory Metallic Prizm', brand: 'Topps', setName: 'Ivory Metallic Prizm', sport: 'Baseball' },
        { name: 'Beige Metallic Prizm', brand: 'Topps', setName: 'Beige Metallic Prizm', sport: 'Baseball' },
        { name: 'Khaki Metallic Prizm', brand: 'Topps', setName: 'Khaki Metallic Prizm', sport: 'Baseball' },
        { name: 'Olive Metallic Prizm', brand: 'Topps', setName: 'Olive Metallic Prizm', sport: 'Baseball' },
        { name: 'Teal Metallic Prizm', brand: 'Topps', setName: 'Teal Metallic Prizm', sport: 'Baseball' },
        { name: 'Turquoise Metallic Prizm', brand: 'Topps', setName: 'Turquoise Metallic Prizm', sport: 'Baseball' },
        { name: 'Cyan Metallic Prizm', brand: 'Topps', setName: 'Cyan Metallic Prizm', sport: 'Baseball' },
        { name: 'Magenta Metallic Prizm', brand: 'Topps', setName: 'Magenta Metallic Prizm', sport: 'Baseball' },
        { name: 'Fuchsia Metallic Prizm', brand: 'Topps', setName: 'Fuchsia Metallic Prizm', sport: 'Baseball' },
        { name: 'Lime Metallic Prizm', brand: 'Topps', setName: 'Lime Metallic Prizm', sport: 'Baseball' },
        { name: 'Maroon Metallic Prizm', brand: 'Topps', setName: 'Maroon Metallic Prizm', sport: 'Baseball' },
        { name: 'Navy Metallic Prizm', brand: 'Topps', setName: 'Navy Metallic Prizm', sport: 'Baseball' },
        { name: 'Burgundy Metallic Prizm', brand: 'Topps', setName: 'Burgundy Metallic Prizm', sport: 'Baseball' },
        { name: 'Crimson Metallic Prizm', brand: 'Topps', setName: 'Crimson Metallic Prizm', sport: 'Baseball' },
        { name: 'Scarlet Metallic Prizm', brand: 'Topps', setName: 'Scarlet Metallic Prizm', sport: 'Baseball' },
        { name: 'Coral Metallic Prizm', brand: 'Topps', setName: 'Coral Metallic Prizm', sport: 'Baseball' },
        { name: 'Salmon Metallic Prizm', brand: 'Topps', setName: 'Salmon Metallic Prizm', sport: 'Baseball' },
        { name: 'Peach Metallic Prizm', brand: 'Topps', setName: 'Peach Metallic Prizm', sport: 'Baseball' },
        { name: 'Apricot Metallic Prizm', brand: 'Topps', setName: 'Apricot Metallic Prizm', sport: 'Baseball' },
        { name: 'Tangerine Metallic Prizm', brand: 'Topps', setName: 'Tangerine Metallic Prizm', sport: 'Baseball' },
        { name: 'Amber Metallic Prizm', brand: 'Topps', setName: 'Amber Metallic Prizm', sport: 'Baseball' },
        { name: 'Golden Metallic Prizm', brand: 'Topps', setName: 'Golden Metallic Prizm', sport: 'Baseball' }
    ];

    let added = 0;
    let skipped = 0;

    for (const cardSet of cardSets) {
        try {
            // Check if this card set already exists
            const existing = await new Promise((resolve, reject) => {
                db.get(
                    'SELECT id FROM sets WHERE name = ? AND brand = ?',
                    [cardSet.name, cardSet.brand],
                    (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    }
                );
            });

            if (existing) {
                console.log(`⏭️ Skipping existing: ${cardSet.name} (${cardSet.brand})`);
                skipped++;
                continue;
            }

            // Insert new card set
            await new Promise((resolve, reject) => {
                const id = Date.now() + Math.random().toString(36).substr(2, 9);
                db.run(
                    'INSERT INTO sets (id, name, sport, year, brand, setName, source, searchText, displayName, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    [
                        id,
                        cardSet.name,
                        cardSet.sport,
                        'Unknown',
                        cardSet.brand,
                        cardSet.setName,
                        'manual',
                        `${cardSet.sport.toLowerCase()} unknown ${cardSet.brand.toLowerCase()} ${cardSet.name.toLowerCase()}`,
                        `${cardSet.sport} Unknown ${cardSet.brand} ${cardSet.name}`,
                        new Date().toISOString()
                    ],
                    function(err) {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });

            console.log(`✅ Added: ${cardSet.name} (${cardSet.brand}) - ${cardSet.sport}`);
            added++;

        } catch (error) {
            console.error(`❌ Error adding ${cardSet.name}:`, error.message);
        }
    }

    console.log(`\n🎉 Summary:`);
    console.log(`   ✅ Added: ${added} new card sets`);
    console.log(`   ⏭️ Skipped: ${skipped} existing card sets`);

    db.close();
}

addMissingCardTypesToComprehensive();
