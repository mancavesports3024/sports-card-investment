const logger = require('./logger');

// Error types
class AppError extends Error {
    constructor(message, statusCode = 500, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        this.timestamp = new Date().toISOString();
        
        Error.captureStackTrace(this, this.constructor);
    }
}

class ValidationError extends AppError {
    constructor(message, field = null) {
        super(message, 400);
        this.field = field;
        this.type = 'VALIDATION_ERROR';
    }
}

class NotFoundError extends AppError {
    constructor(resource = 'Resource') {
        super(`${resource} not found`, 404);
        this.type = 'NOT_FOUND_ERROR';
    }
}

class AuthenticationError extends AppError {
    constructor(message = 'Authentication required') {
        super(message, 401);
        this.type = 'AUTHENTICATION_ERROR';
    }
}

class AuthorizationError extends AppError {
    constructor(message = 'Insufficient permissions') {
        super(message, 403);
        this.type = 'AUTHORIZATION_ERROR';
    }
}

class RateLimitError extends AppError {
    constructor(message = 'Rate limit exceeded') {
        super(message, 429);
        this.type = 'RATE_LIMIT_ERROR';
    }
}

class ExternalServiceError extends AppError {
    constructor(service, message = 'External service error') {
        super(`${service}: ${message}`, 502);
        this.service = service;
        this.type = 'EXTERNAL_SERVICE_ERROR';
    }
}

// Error handler middleware
function errorHandler(err, req, res, next) {
    let error = err;
    
    // If it's not an AppError, convert it
    if (!(error instanceof AppError)) {
        error = new AppError(error.message || 'Internal server error', 500);
    }
    
    // Log the error
    logger.errorWithStack('Request error', error, {
        url: req.url,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        body: req.body,
        query: req.query,
        params: req.params
    });
    
    // Determine if we should send detailed error info
    const isDevelopment = process.env.NODE_ENV === 'development';
    const isTest = process.env.NODE_ENV === 'test';
    
    // Prepare error response
    const errorResponse = {
        error: {
            message: error.message,
            type: error.type || 'INTERNAL_ERROR',
            statusCode: error.statusCode,
            timestamp: error.timestamp
        }
    };
    
    // Add stack trace in development
    if (isDevelopment && error.stack) {
        errorResponse.error.stack = error.stack;
    }
    
    // Add additional details for specific error types
    if (error.field) {
        errorResponse.error.field = error.field;
    }
    
    if (error.service) {
        errorResponse.error.service = error.service;
    }
    
    // Send response
    res.status(error.statusCode).json(errorResponse);
}

// Async error wrapper
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

// Validation helper
function validateRequired(fields, data) {
    const missing = [];
    
    fields.forEach(field => {
        if (!data[field] || (typeof data[field] === 'string' && data[field].trim() === '')) {
            missing.push(field);
        }
    });
    
    if (missing.length > 0) {
        throw new ValidationError(`Missing required fields: ${missing.join(', ')}`);
    }
}

// Type validation helper
function validateType(value, type, fieldName) {
    switch (type) {
        case 'string':
            if (typeof value !== 'string') {
                throw new ValidationError(`${fieldName} must be a string`, fieldName);
            }
            break;
        case 'number':
            if (typeof value !== 'number' || isNaN(value)) {
                throw new ValidationError(`${fieldName} must be a number`, fieldName);
            }
            break;
        case 'boolean':
            if (typeof value !== 'boolean') {
                throw new ValidationError(`${fieldName} must be a boolean`, fieldName);
            }
            break;
        case 'array':
            if (!Array.isArray(value)) {
                throw new ValidationError(`${fieldName} must be an array`, fieldName);
            }
            break;
        case 'object':
            if (typeof value !== 'object' || value === null || Array.isArray(value)) {
                throw new ValidationError(`${fieldName} must be an object`, fieldName);
            }
            break;
        default:
            throw new ValidationError(`Unknown validation type: ${type}`, fieldName);
    }
}

// Range validation helper
function validateRange(value, min, max, fieldName) {
    if (value < min || value > max) {
        throw new ValidationError(`${fieldName} must be between ${min} and ${max}`, fieldName);
    }
}

// Length validation helper
function validateLength(value, min, max, fieldName) {
    if (value.length < min || value.length > max) {
        throw new ValidationError(`${fieldName} length must be between ${min} and ${max}`, fieldName);
    }
}

// Email validation helper
function validateEmail(email, fieldName = 'email') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        throw new ValidationError(`Invalid email format`, fieldName);
    }
}

// URL validation helper
function validateURL(url, fieldName = 'url') {
    try {
        new URL(url);
    } catch {
        throw new ValidationError(`Invalid URL format`, fieldName);
    }
}

// Database error handler
function handleDatabaseError(error) {
    if (error.code === 'ER_DUP_ENTRY') {
        return new ValidationError('Duplicate entry found');
    }
    
    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
        return new ValidationError('Referenced record not found');
    }
    
    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
        return new ValidationError('Cannot delete referenced record');
    }
    
    logger.error('Database error', error);
    return new AppError('Database operation failed', 500);
}

// External service error handler
function handleExternalServiceError(service, error) {
    logger.error(`External service error: ${service}`, error);
    
    if (error.code === 'ECONNREFUSED') {
        return new ExternalServiceError(service, 'Service unavailable');
    }
    
    if (error.code === 'ETIMEDOUT') {
        return new ExternalServiceError(service, 'Request timeout');
    }
    
    if (error.response) {
        const statusCode = error.response.status;
        const message = error.response.data?.message || 'Service error';
        
        if (statusCode === 401) {
            return new AuthenticationError(`Authentication failed for ${service}`);
        }
        
        if (statusCode === 403) {
            return new AuthorizationError(`Access denied for ${service}`);
        }
        
        if (statusCode === 429) {
            return new RateLimitError(`Rate limit exceeded for ${service}`);
        }
        
        return new ExternalServiceError(service, message);
    }
    
    return new ExternalServiceError(service, error.message);
}

// Export all error handling utilities
module.exports = {
    // Error classes
    AppError,
    ValidationError,
    NotFoundError,
    AuthenticationError,
    AuthorizationError,
    RateLimitError,
    ExternalServiceError,
    
    // Middleware
    errorHandler,
    asyncHandler,
    
    // Validation helpers
    validateRequired,
    validateType,
    validateRange,
    validateLength,
    validateEmail,
    validateURL,
    
    // Error handlers
    handleDatabaseError,
    handleExternalServiceError
}; 