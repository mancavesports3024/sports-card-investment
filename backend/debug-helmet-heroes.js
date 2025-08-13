const { DatabaseDrivenStandardizedTitleGenerator } = require('./generate-standardized-summary-titles-database-driven.js');

async function debugHelmetHeroes() {
    console.log('🔍 Debugging Helmet Heroes Issue...\n');
    
    const generator = new DatabaseDrivenStandardizedTitleGenerator();
    
    try {
        await generator.connect();
        await generator.learnFromDatabase();
        
        const title = '1998 Skybox E-X2001 Randy Moss Helmet Heroes Rookie RC #17hh Vikings PSA 10';
        
        console.log('Original title:', title);
        console.log('\nTesting patterns:');
        
        // Test the multi-word card types pattern
        const multiWordPattern = /\b(Green Pulsar|Blue Pulsar|Red Pulsar|Purple Pulsar|Orange Pulsar|Pink Pulsar|Gold Pulsar|Silver Pulsar|Black Pulsar|White Pulsar|Sky Blue|Neon Green|Purple Pattern|Pink Pattern|Blue Pattern|Green Pattern|Yellow Pattern|Black Pattern|Red Pattern|Printing Plate|Checkerboard|X-Fractor|Cracked Ice|Atomic|Disco|Fast Break|No Huddle|Flash|Shock|Mojo|Mega|Scope|Shimmer|Wave|Multi Wave|Carved in Time|Lenticular|Synthesis|Outburst|Electric Ice|Ellipse|Color Wheel|Color Blast|Die-cut|National Landmarks|Stained Glass|Lava Lamp|Dazzle|Blue Velocity|Hyper Pink|Red Dragon|Laser|Liberty|Diamond Marvels|On Fire|Voltage|Career Stat Line|Alligator Crystal|Alligator Kaleidoscope|Alligator Mojo|Alligator Prismatic|Butterfly Crystal|Butterfly Kaleidoscope|Butterfly Mojo|Butterfly Prismatic|Chameleon Crystal|Chameleon Kaleidoscope|Chameleon Mojo|Chameleon Prismatic|Clown Fish Crystal|Clown Fish Kaleidoscope|Clown Fish Mojo|Clown Fish Prismatic|Deer Crystal|Deer Kaleidoscope|Deer Mojo|Deer Prismatic|Dragon Crystal|Dragon Kaleidoscope|Dragon Mojo|Dragon Prismatic|Elephant Crystal|Elephant Kaleidoscope|Elephant Mojo|Elephant Prismatic|Giraffe Crystal|Giraffe Kaleidoscope|Giraffe Mojo|Giraffe Prismatic|Leopard Crystal|Leopard Kaleidoscope|Leopard Mojo|Leopard Prismatic|Parrot Crystal|Parrot Kaleidoscope|Parrot Mojo|Parrot Prismatic|Peacock Crystal|Peacock Kaleidoscope|Peacock Mojo|Peacock Prismatic|Snake Crystal|Snake Kaleidoscope|Snake Mojo|Snake Prismatic|Tiger Crystal|Tiger Kaleidoscope|Tiger Mojo|Tiger Prismatic|Zebra Crystal|Zebra Kaleidoscope|Zebra Mojo|Zebra Prismatic|Tiger Eyes|Snake Eyes|100th Anniversary|Black Border|Flip Stock|Magenta|Mini Parallels|Chrome Refractor|Purple Refractor|Black Bordered Refractor|Gold Bordered Refractor|Superfractor|Zebra Prizm|Dragon Scale|Red Dragon|Peacock Prizm|Tiger Prizm|Giraffe Prizm|Elephant Prizm|Blue Ice|Silver Laser|Silver Mojo|Silver Scope|Teal Wave|Premium Set Checkerboard|Blue Laser|Blue Mojo|Green Flash|Blue Flash|Purple Flash|Purple Cracked Ice|Pink Flash|Gold Cracked Ice|Gold Flash|Gold Laser|Gold Mojo|Black Flash|Black Laser|Black Mojo|Gold Vinyl Premium Set|Vintage Stock|Red Stars|Independence Day|Father's Day Powder Blue|Mother's Day Hot Pink|Memorial Day Camo|Camo Pink Mosaic|Choice Peacock Mosaic|Fast Break Silver Mosaic|Genesis Mosaic|Green Mosaic|Reactive Blue Mosaic|Reactive Orange Mosaic|Red Mosaic|Blue Mosaic|Choice Red Fusion Mosaic|Fast Break Blue Mosaic|Fast Break Purple Mosaic|Purple Mosaic|Orange Fluorescent Mosaic|White Mosaic|Fast Break Pink Mosaic|Blue Fluorescent Mosaic|Pink Swirl Mosaic|Fast Break Gold Mosaic|Gold Mosaic|Green Swirl Mosaic|Pink Fluorescent Mosaic|Choice Black Gold Mosaic|Black Mosaic|Choice Nebula Mosaic|Fast Break Black Mosaic|Black Pulsar Prizm|Blue Prizm|Blue Cracked Ice Prizm|Blue Pulsar Prizm|Blue Wave Prizm|Flash Prizm|Gold Pulsar Prizm|Green Prizm|Green Cracked Ice Prizm|Green Pulsar Prizm|Green Shimmer Prizm|Pulsar Prizm|Purple Disco Prizm|Red Prizm|Red Cracked Ice Prizm|Red Flash Prizm|Red Pulsar Prizm|Red Wave Prizm|Silver Prizm|Silver Laser Prizm|Silver Mojo Prizm|Silver Scope Prizm|Teal Prizm|Teal Wave Prizm|Premium Set Checkerboard Prizm|Blue Laser Prizm|Blue Mojo Prizm|Green Flash Prizm|Blue Flash Prizm|Purple Flash Prizm|Purple Cracked Ice Prizm|Pink Flash Prizm|Gold Cracked Ice Prizm|Gold Flash Prizm|Gold Laser Prizm|Gold Mojo Prizm|Black Flash Prizm|Black Laser Prizm|Black Mojo Prizm|Gold Vinyl Premium Set Prizm|Helmet Heroes)\b/gi;
        
        const multiWordMatches = [...title.matchAll(multiWordPattern)];
        console.log('Multi-word card types found:', multiWordMatches.map(m => m[0]));
        
        // Test card number patterns
        const cardNumberPattern1 = /#\d+[A-Za-z]+/g;
        const cardNumberPattern2 = /#(?!SSP)[A-Z0-9-]+/g;
        
        const cardNumberMatches1 = [...title.matchAll(cardNumberPattern1)];
        const cardNumberMatches2 = [...title.matchAll(cardNumberPattern2)];
        
        console.log('Card number pattern 1 (#\\d+[A-Za-z]+):', cardNumberMatches1.map(m => m[0]));
        console.log('Card number pattern 2 (#(?!SSP)[A-Z0-9-]+):', cardNumberMatches2.map(m => m[0]));
        
        // Test the actual extraction
        const colorNumbering = generator.extractColorNumbering(title);
        console.log('\nExtracted color/numbering:', colorNumbering);
        
    } catch (error) {
        console.error('❌ Error during debugging:', error);
    } finally {
        if (generator.db) {
            generator.db.close();
        }
    }
}

debugHelmetHeroes()
    .then(() => {
        console.log('\n✅ Debug completed');
        process.exit(0);
    })
    .catch(error => {
        console.error('❌ Debug failed:', error);
        process.exit(1);
    });
