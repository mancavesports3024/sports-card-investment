const { Pool } = require('pg');

async function testRailwayConnection() {
    console.log('🧪 Testing Railway Database Connection...');
    
    // Check if DATABASE_URL is available
    if (!process.env.DATABASE_URL) {
        console.log('❌ DATABASE_URL environment variable not found');
        console.log('Available environment variables:', Object.keys(process.env).filter(key => key.includes('DATABASE')));
        return;
    }
    
    console.log('✅ DATABASE_URL found');
    console.log('Database URL (masked):', process.env.DATABASE_URL.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'));
    
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    
    try {
        console.log('🔌 Attempting to connect to Railway PostgreSQL...');
        const client = await pool.connect();
        console.log('✅ Successfully connected to Railway PostgreSQL!');
        
        // Test a simple query
        console.log('🔍 Testing simple query...');
        const result = await client.query('SELECT NOW() as current_time');
        console.log('✅ Query successful:', result.rows[0]);
        
        // Check if our tables exist
        console.log('🔍 Checking for existing tables...');
        const tablesResult = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('card_sets', 'parallels')
        `);
        
        console.log('📋 Existing tables:', tablesResult.rows.map(row => row.table_name));
        
        client.release();
        await pool.end();
        console.log('✅ Database connection test completed successfully!');
        
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        console.error('Full error:', error);
    }
}

if (require.main === module) {
    testRailwayConnection().catch(console.error);
}

module.exports = { testRailwayConnection };
