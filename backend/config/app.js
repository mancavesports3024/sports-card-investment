const path = require('path');

// Environment configuration
const env = process.env.NODE_ENV || 'development';

// Base configuration
const baseConfig = {
    // Server settings
    port: process.env.PORT || 3001,
    host: process.env.HOST || 'localhost',
    
    // Database settings
    database: {
        path: path.join(__dirname, '../data/psa10_recent_90_days_database.json'),
        backupPath: path.join(__dirname, '../data/psa10_recent_90_days_database_original_backup.json'),
        maxSize: 100 * 1024 * 1024, // 100MB
        autoBackup: true,
        backupInterval: 24 * 60 * 60 * 1000 // 24 hours
    },
    
    // Search settings
    search: {
        defaultNumSales: 25,
        maxNumSales: 100,
        timeout: 30000, // 30 seconds
        cacheEnabled: true,
        cacheTTL: 300, // 5 minutes
        useOptimizedEngine: true // Use the new optimized search engine
    },
    
    // eBay API settings
    ebay: {
        clientId: process.env.EBAY_CLIENT_ID,
        clientSecret: process.env.EBAY_CLIENT_SECRET,
        authToken: process.env.EBAY_AUTH_TOKEN,
        refreshToken: process.env.EBAY_REFRESH_TOKEN,
        tokenExpiry: process.env.EBAY_TOKEN_EXPIRY,
        baseUrl: 'https://api.ebay.com',
        sandbox: process.env.EBAY_SANDBOX === 'true',
        rateLimit: {
            requestsPerSecond: 5,
            requestsPerMinute: 300
        },
        epn: {
            mkevt: process.env.EBAY_MKEVT || '1',
            mkcid: process.env.EBAY_MKCID || '1',
            mkrid: process.env.EBAY_MKRID || '711-53200-19255-0',
            siteid: process.env.EBAY_SITEID || '0',
            campid: process.env.EBAY_CAMPID || '5338333097',
            toolid: process.env.EBAY_TOOLID || '10001',
            customid: process.env.EBAY_CUSTOMID || 'trading-card-tracker'
        }
    },
    
    // Redis settings
    redis: {
        url: process.env.REDIS_URL,
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD,
        db: process.env.REDIS_DB || 0,
        enabled: process.env.REDIS_ENABLED === 'true'
    },
    
    // CORS settings
    cors: {
        origin: [
            'https://www.mancavesportscardsllc.com',
            'https://mancavesportscardsllc.com',
            'http://localhost:3000',
            'http://localhost:3001'
        ],
        credentials: true
    },
    
    // Logging settings
    logging: {
        level: process.env.LOG_LEVEL || 'info',
        enabled: process.env.LOGGING_ENABLED !== 'false',
        file: process.env.LOG_FILE || path.join(__dirname, '../logs/app.log'),
        maxSize: 10 * 1024 * 1024, // 10MB
        maxFiles: 5
    },
    
    // Performance settings
    performance: {
        compression: true,
        rateLimit: {
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 100 // limit each IP to 100 requests per windowMs
        },
        timeout: {
            request: 30000, // 30 seconds
            response: 30000 // 30 seconds
        }
    },
    
    // Security settings
    security: {
        sessionSecret: process.env.SESSION_SECRET || 'your-secret-key',
        sessionMaxAge: 24 * 60 * 60 * 1000, // 24 hours
        csrfProtection: true,
        helmet: true
    },
    
    // Feature flags
    features: {
        optimizedSearch: true,
        liveListings: true,
        ebayBidding: true,
        newsFeed: true,
        imageAnalysis: true,
        spreadsheetManager: true,
        searchHistory: true
    }
};

// Environment-specific configurations
const configs = {
    development: {
        ...baseConfig,
        logging: {
            ...baseConfig.logging,
            level: 'debug'
        },
        performance: {
            ...baseConfig.performance,
            compression: false
        }
    },
    
    production: {
        ...baseConfig,
        logging: {
            ...baseConfig.logging,
            level: 'warn'
        },
        security: {
            ...baseConfig.security,
            sessionSecret: process.env.SESSION_SECRET
        }
    },
    
    test: {
        ...baseConfig,
        database: {
            ...baseConfig.database,
            path: path.join(__dirname, '../data/test_database.json')
        },
        logging: {
            ...baseConfig.logging,
            level: 'error'
        },
        features: {
            ...baseConfig.features,
            liveListings: false,
            ebayBidding: false
        }
    }
};

// Get current configuration
const config = configs[env] || configs.development;

// Validation
function validateConfig() {
    const errors = [];
    
    if (!config.ebay.clientId) {
        errors.push('EBAY_CLIENT_ID is required');
    }
    
    if (!config.ebay.clientSecret) {
        errors.push('EBAY_CLIENT_SECRET is required');
    }
    
    if (config.redis.enabled && !config.redis.url && !config.redis.host) {
        errors.push('Redis configuration is incomplete');
    }
    
    if (errors.length > 0) {
        console.error('Configuration validation failed:');
        errors.forEach(error => console.error(`  - ${error}`));
        return false;
    }
    
    return true;
}

// Helper functions
function getDatabasePath() {
    return config.database.path;
}

function getBackupPath() {
    return config.database.backupPath;
}

function isFeatureEnabled(feature) {
    return config.features[feature] === true;
}

function getSearchConfig() {
    return config.search;
}

function getEbayConfig() {
    return config.ebay;
}

function getRedisConfig() {
    return config.redis;
}

function getLoggingConfig() {
    return config.logging;
}

function getPerformanceConfig() {
    return config.performance;
}

function getSecurityConfig() {
    return config.security;
}

// Export configuration
module.exports = {
    ...config,
    env,
    validateConfig,
    getDatabasePath,
    getBackupPath,
    isFeatureEnabled,
    getSearchConfig,
    getEbayConfig,
    getRedisConfig,
    getLoggingConfig,
    getPerformanceConfig,
    getSecurityConfig
}; 