const cacheService = require('../services/cacheService');

// Helper to check if user is admin
function isAdmin(req) {
  return req.user && req.user.email === 'mancavesportscardsllc@gmail.com';
}

// Cache middleware for API responses
const cacheMiddleware = (ttl = 1800) => {
  return async (req, res, next) => {
    // Skip caching for non-GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Skip caching if user is authenticated (personalized content)
    if (req.user) {
      return next();
    }

    // Generate cache key based on request
    const cacheKey = generateCacheKey(req);
    
    try {
      // Check if response is cached
      const cachedResponse = await cacheService.get(cacheKey);
      
      if (cachedResponse) {
        console.log(`⚡ Cache hit: ${cacheKey}`);
        // Set cache headers only for admin
        if (isAdmin(req)) {
          res.set('X-Cache', 'HIT');
          res.set('X-Cache-Key', cacheKey);
        }
        return res.json(cachedResponse);
      }
      
      // Cache miss - intercept the response
      console.log(`❌ Cache miss: ${cacheKey}`);
      
      const originalSend = res.json;
      res.json = function(data) {
        // Cache the response first
        cacheService.set(cacheKey, data, ttl);
        // Only set headers if response hasn't been sent yet and user is admin
        if (!res.headersSent && isAdmin(req)) {
          res.set('X-Cache', 'MISS');
          res.set('X-Cache-Key', cacheKey);
          res.set('X-Cache-TTL', ttl);
        }
        // Call original send method
        return originalSend.call(this, data);
      };
      next();
    } catch (error) {
      console.error('❌ Cache middleware error:', error);
      next(); // Continue without caching on error
    }
  };
};

// Generate cache key from request
function generateCacheKey(req) {
  const url = req.originalUrl || req.url;
  const query = JSON.stringify(req.query);
  const params = JSON.stringify(req.params);
  
  // Create a hash of the request
  const requestHash = Buffer.from(`${url}:${query}:${params}`).toString('base64');
  
  return `api:${requestHash}`;
}

// Rate limiting middleware
const rateLimitMiddleware = (windowMs = 15 * 60 * 1000, maxRequests = 100) => {
  const requests = new Map();
  
  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    
    // Clean old entries
    for (const [key, timestamp] of requests.entries()) {
      if (now - timestamp > windowMs) {
        requests.delete(key);
      }
    }
    
    // Check rate limit
    const userRequests = Array.from(requests.entries())
      .filter(([key]) => key.startsWith(ip))
      .length;
    
    if (userRequests >= maxRequests) {
      return res.status(429).json({
        error: 'Too many requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
    
    // Add current request
    requests.set(`${ip}:${now}`, now);
    
    // Set rate limit headers
    res.set('X-RateLimit-Limit', maxRequests);
    res.set('X-RateLimit-Remaining', maxRequests - userRequests - 1);
    res.set('X-RateLimit-Reset', new Date(now + windowMs).toISOString());
    
    next();
  };
};

// Response time middleware
const responseTimeMiddleware = () => {
  return (req, res, next) => {
    const start = Date.now();
    
    // Override the end method to capture response time before sending
    const originalEnd = res.end;
    res.end = function(chunk, encoding) {
      const duration = Date.now() - start;
      
      // Only set header if response hasn't been sent yet and user is admin
      if (!res.headersSent && isAdmin(req)) {
        res.set('X-Response-Time', `${duration}ms`);
      }
      
      // Log response times
      if (duration > 1000) {
        console.log(`🐌 Slow response: ${req.method} ${req.originalUrl} - ${duration}ms`);
      } else if (duration > 500) {
        console.log(`⚠️  Moderate response: ${req.method} ${req.originalUrl} - ${duration}ms`);
      } else {
        console.log(`⚡ Fast response: ${req.method} ${req.originalUrl} - ${duration}ms`);
      }
      
      // Call original end method
      return originalEnd.call(this, chunk, encoding);
    };
    
    next();
  };
};

// Compression middleware (if not already using express compression)
const compressionMiddleware = () => {
  return (req, res, next) => {
    // Set compression headers
    res.set('Accept-Encoding', 'gzip, deflate, br');
    
    // Enable compression for JSON responses
    if (req.headers.accept && req.headers.accept.includes('application/json')) {
      res.set('Content-Encoding', 'gzip');
    }
    
    next();
  };
};

// Cache control middleware
const cacheControlMiddleware = (maxAge = 1800) => {
  return (req, res, next) => {
    // Set cache control headers
    res.set('Cache-Control', `public, max-age=${maxAge}, s-maxage=${maxAge}`);
    res.set('Expires', new Date(Date.now() + maxAge * 1000).toUTCString());
    
    next();
  };
};

// API optimization middleware
const apiOptimizationMiddleware = () => {
  return (req, res, next) => {
    // Set performance headers
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('X-Frame-Options', 'DENY');
    res.set('X-XSS-Protection', '1; mode=block');
    
    // Note: CORS headers are handled by the main CORS middleware
    // Do not set CORS headers here to avoid conflicts
    
    next();
  };
};

module.exports = {
  cacheMiddleware,
  rateLimitMiddleware,
  responseTimeMiddleware,
  compressionMiddleware,
  cacheControlMiddleware,
  apiOptimizationMiddleware
}; 