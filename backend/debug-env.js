console.log('🔍 Environment Variables Debug:');
console.log('================================');

// Check if DATABASE_URL exists
console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);
console.log('DATABASE_URL value:', process.env.DATABASE_URL || 'UNDEFINED');

// List all environment variables that contain 'DATABASE'
const databaseVars = Object.keys(process.env).filter(key => 
    key.toLowerCase().includes('database')
);
console.log('Database-related env vars:', databaseVars);

// List all environment variables
console.log('All env vars:', Object.keys(process.env));

// Check specific Railway variables
console.log('RAILWAY_ENVIRONMENT:', process.env.RAILWAY_ENVIRONMENT);
console.log('RAILWAY_PROJECT_ID:', process.env.RAILWAY_PROJECT_ID);
console.log('NODE_ENV:', process.env.NODE_ENV);

console.log('================================');
