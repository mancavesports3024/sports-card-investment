# eBay Bidding Tool - Production Setup Guide

## Overview
This guide covers the specific requirements and configuration needed to deploy the eBay Last-Second Bidding Tool in a production environment.

## Production Requirements

### 1. Environment Variables
Add these to your production environment:

```bash
# Production environment
NODE_ENV=production

# Browser configuration (optional)
CHROME_BIN=/usr/bin/google-chrome-stable

# Server configuration
PORT=3001
```

### 2. Browser Dependencies
The tool requires Chrome/Chromium to be installed in the production environment.

#### For Railway Deployment:
Railway automatically provides Chrome in the container, but you may need to ensure it's properly configured.

#### For Other Platforms:
Install Chrome/Chromium:
```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y google-chrome-stable

# CentOS/RHEL
sudo yum install -y google-chrome-stable

# Alpine Linux
apk add --no-cache chromium
```

### 3. File System Permissions
Ensure the data directory is writable:
```bash
# Create data directory if it doesn't exist
mkdir -p /app/data

# Set proper permissions
chmod 755 /app/data
```

## Production Optimizations

### 1. Browser Configuration
The tool automatically detects production environment and:
- Uses headless mode (`headless: 'new'`)
- Enables additional security flags
- Uses system Chrome if available via `CHROME_BIN` environment variable

### 2. Error Handling
Enhanced error handling includes:
- Specific HTTP status codes for different error types
- Detailed logging for debugging
- Graceful fallbacks for network issues
- Timeout handling (30 seconds)

### 3. Health Checks
The tool provides a comprehensive health check endpoint:
```
GET /api/ebay-bidding/health
```

Response includes:
- Service status (healthy/degraded/unhealthy)
- Browser connection status
- Environment information
- Timestamp

## Deployment Checklist

### Pre-Deployment
- [ ] Set `NODE_ENV=production`
- [ ] Ensure Chrome/Chromium is installed
- [ ] Verify data directory permissions
- [ ] Test health check endpoint

### Post-Deployment
- [ ] Verify `/api/ebay-bidding/health` returns healthy status
- [ ] Test auction info retrieval with a sample item ID
- [ ] Check browser initialization in logs
- [ ] Monitor for any timeout or network errors

## Troubleshooting

### Common Issues

#### 1. Browser Initialization Fails
**Symptoms:** Health check returns unhealthy status
**Solutions:**
- Verify Chrome is installed: `which google-chrome-stable`
- Check `CHROME_BIN` environment variable
- Review browser launch logs

#### 2. Timeout Errors
**Symptoms:** 408 status codes on auction info requests
**Solutions:**
- Increase timeout in `getAuctionInfo` method
- Check network connectivity to eBay
- Verify eBay isn't blocking requests

#### 3. File System Errors
**Symptoms:** Configuration save/load failures
**Solutions:**
- Verify data directory exists and is writable
- Check file permissions
- Ensure sufficient disk space

#### 4. Memory Issues
**Symptoms:** Browser crashes or high memory usage
**Solutions:**
- Monitor memory usage
- Implement browser cleanup in long-running processes
- Consider restarting browser periodically

### Log Analysis
Look for these log patterns:
- `🔍 Fetching auction info for item:` - Normal operation
- `📊 Auction info extracted for` - Successful data extraction
- `❌ Error getting auction info` - Error occurred
- `🔍 API request for auction info` - API endpoint called

## Security Considerations

### 1. Rate Limiting
Consider implementing rate limiting to prevent abuse:
```javascript
const rateLimit = require('express-rate-limit');

const ebayBiddingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api/ebay-bidding', ebayBiddingLimiter);
```

### 2. Input Validation
The tool validates:
- Item ID format and presence
- Bid amounts (numeric, positive)
- Time buffers (reasonable ranges)

### 3. Error Information
Error responses are sanitized to prevent information leakage while still providing useful debugging information.

## Monitoring

### Key Metrics to Monitor
1. **Response Times:** Auction info retrieval should complete within 30 seconds
2. **Success Rate:** Percentage of successful auction info retrievals
3. **Browser Health:** Browser connection status
4. **Error Rates:** Frequency of different error types

### Recommended Alerts
- Health check endpoint returns unhealthy status
- High error rate (>10% for 5 minutes)
- Response time >30 seconds consistently
- Browser initialization failures

## Performance Optimization

### 1. Browser Reuse
The tool reuses browser instances to reduce overhead. Monitor for memory leaks.

### 2. Page Cleanup
Pages are properly closed after each request to prevent memory accumulation.

### 3. Caching Considerations
Consider implementing caching for frequently requested auction information (with appropriate TTL).

## Support

For issues specific to the eBay bidding tool:
1. Check the health endpoint first
2. Review application logs for error patterns
3. Test with a known valid eBay item ID
4. Verify browser dependencies are properly installed

## Updates and Maintenance

### Regular Maintenance
- Monitor Chrome/Chromium updates
- Review and update user agent strings if needed
- Check for eBay layout changes that might affect selectors
- Update timeout values based on performance monitoring

### Version Compatibility
- Node.js >= 18.0.0
- Puppeteer >= 24.11.2
- Express >= 4.18.2 