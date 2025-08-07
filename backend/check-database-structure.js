const fs = require('fs');
const path = require('path');

function checkDatabaseStructure() {
    console.log('Checking PSA10 database structure...');
    
    try {
        const dataPath = path.join(__dirname, 'data', 'psa10_recent_90_days_database.json');
        const rawData = fs.readFileSync(dataPath, 'utf8');
        const database = JSON.parse(rawData);
        
        console.log('Database type:', typeof database);
        console.log('Is Array:', Array.isArray(database));
        console.log('Is Object:', typeof database === 'object' && database !== null);
        
        if (Array.isArray(database)) {
            console.log('Array length:', database.length);
            if (database.length > 0) {
                console.log('First item structure:', Object.keys(database[0]));
                console.log('First item sample:', JSON.stringify(database[0], null, 2));
            }
        } else if (typeof database === 'object' && database !== null) {
            console.log('Object keys:', Object.keys(database));
            console.log('Object structure sample:', JSON.stringify(database, null, 2).substring(0, 500) + '...');
        }
        
    } catch (error) {
        console.error('Error checking database structure:', error);
    }
}

checkDatabaseStructure(); 