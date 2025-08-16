console.log('🔍 Checking Environment and Database Paths...\n');

console.log('📁 Current working directory:', process.cwd());
console.log('📁 __dirname:', __dirname);

console.log('\n🔧 Environment variables:');
Object.keys(process.env).forEach(key => {
    if (key.toLowerCase().includes('db') || key.toLowerCase().includes('database') || key.toLowerCase().includes('path')) {
        console.log(`  ${key}: ${process.env[key]}`);
    }
});

console.log('\n📊 Database paths:');
const path = require('path');
const fs = require('fs');

const paths = [
    path.join(__dirname, 'data', 'new-scorecard.db'),
    path.join(__dirname, 'new-scorecard.db'),
    path.join(process.cwd(), 'backend', 'data', 'new-scorecard.db'),
    path.join(process.cwd(), 'backend', 'new-scorecard.db'),
    path.join(process.cwd(), 'data', 'new-scorecard.db'),
    path.join(process.cwd(), 'new-scorecard.db')
];

paths.forEach(dbPath => {
    console.log(`  ${dbPath}: ${fs.existsSync(dbPath) ? 'EXISTS' : 'NOT FOUND'}`);
    if (fs.existsSync(dbPath)) {
        const stats = fs.statSync(dbPath);
        console.log(`    Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    }
});

