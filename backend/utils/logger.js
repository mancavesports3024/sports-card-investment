const fs = require('fs');
const path = require('path');
const config = require('../config/app');

// Log levels
const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3
};

// Current log level
const currentLevel = LOG_LEVELS[config.logging.level.toUpperCase()] || LOG_LEVELS.INFO;

// Create logs directory if it doesn't exist
const logsDir = path.dirname(config.logging.file);
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Format timestamp
function formatTimestamp() {
    return new Date().toISOString();
}

// Format log message
function formatMessage(level, message, data = null) {
    const timestamp = formatTimestamp();
    const baseMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    
    if (data) {
        if (typeof data === 'object') {
            return `${baseMessage} ${JSON.stringify(data, null, 2)}`;
        }
        return `${baseMessage} ${data}`;
    }
    
    return baseMessage;
}

// Write to file
function writeToFile(message) {
    if (!config.logging.enabled) return;
    
    try {
        fs.appendFileSync(config.logging.file, message + '\n');
    } catch (error) {
        console.error('Failed to write to log file:', error);
    }
}

// Rotate log file if needed
function rotateLogFile() {
    if (!fs.existsSync(config.logging.file)) return;
    
    try {
        const stats = fs.statSync(config.logging.file);
        if (stats.size > config.logging.maxSize) {
            const backupFile = `${config.logging.file}.${Date.now()}`;
            fs.renameSync(config.logging.file, backupFile);
            
            // Keep only the last N files
            const logDir = path.dirname(config.logging.file);
            const logFiles = fs.readdirSync(logDir)
                .filter(file => file.startsWith(path.basename(config.logging.file)))
                .sort()
                .reverse();
            
            if (logFiles.length > config.logging.maxFiles) {
                logFiles.slice(config.logging.maxFiles).forEach(file => {
                    fs.unlinkSync(path.join(logDir, file));
                });
            }
        }
    } catch (error) {
        console.error('Failed to rotate log file:', error);
    }
}

// Logger class
class Logger {
    constructor(context = 'App') {
        this.context = context;
    }
    
    error(message, data = null) {
        if (currentLevel >= LOG_LEVELS.ERROR) {
            const formattedMessage = formatMessage('ERROR', `[${this.context}] ${message}`, data);
            console.error(formattedMessage);
            writeToFile(formattedMessage);
        }
    }
    
    warn(message, data = null) {
        if (currentLevel >= LOG_LEVELS.WARN) {
            const formattedMessage = formatMessage('WARN', `[${this.context}] ${message}`, data);
            console.warn(formattedMessage);
            writeToFile(formattedMessage);
        }
    }
    
    info(message, data = null) {
        if (currentLevel >= LOG_LEVELS.INFO) {
            const formattedMessage = formatMessage('INFO', `[${this.context}] ${message}`, data);
            console.info(formattedMessage);
            writeToFile(formattedMessage);
        }
    }
    
    debug(message, data = null) {
        if (currentLevel >= LOG_LEVELS.DEBUG) {
            const formattedMessage = formatMessage('DEBUG', `[${this.context}] ${message}`, data);
            console.debug(formattedMessage);
            writeToFile(formattedMessage);
        }
    }
    
    // Performance logging
    performance(operation, duration, data = null) {
        const message = `Performance: ${operation} took ${duration}ms`;
        this.info(message, data);
    }
    
    // API request logging
    apiRequest(method, url, statusCode, duration, data = null) {
        const message = `API ${method} ${url} - ${statusCode} (${duration}ms)`;
        this.info(message, data);
    }
    
    // Search logging
    search(query, results, duration, data = null) {
        const message = `Search: "${query}" returned ${results} results (${duration}ms)`;
        this.info(message, data);
    }
    
    // Database logging
    database(operation, table, duration, data = null) {
        const message = `Database ${operation} on ${table} (${duration}ms)`;
        this.info(message, data);
    }
    
    // Error logging with stack trace
    errorWithStack(message, error, data = null) {
        const errorData = {
            message: error.message,
            stack: error.stack,
            ...data
        };
        this.error(message, errorData);
    }
}

// Create default logger
const defaultLogger = new Logger();

// Export logger factory and default logger
module.exports = {
    Logger,
    logger: defaultLogger,
    createLogger: (context) => new Logger(context),
    
    // Convenience methods
    error: (message, data) => defaultLogger.error(message, data),
    warn: (message, data) => defaultLogger.warn(message, data),
    info: (message, data) => defaultLogger.info(message, data),
    debug: (message, data) => defaultLogger.debug(message, data),
    performance: (operation, duration, data) => defaultLogger.performance(operation, duration, data),
    apiRequest: (method, url, statusCode, duration, data) => defaultLogger.apiRequest(method, url, statusCode, duration, data),
    search: (query, results, duration, data) => defaultLogger.search(query, results, duration, data),
    database: (operation, table, duration, data) => defaultLogger.database(operation, table, duration, data),
    errorWithStack: (message, error, data) => defaultLogger.errorWithStack(message, error, data)
}; 