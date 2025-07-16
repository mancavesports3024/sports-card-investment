const fs = require('fs');
const path = require('path');

// Use absolute paths based on script location
const ROOT_DIR = path.resolve(__dirname, '..');
const INDEX_PATH = path.resolve(ROOT_DIR, 'index.js');
const SITEMAP_PATH = path.resolve(ROOT_DIR, 'frontend', 'public', 'sitemap.xml');

// Configuration
const BASE_URL = 'https://www.mancavesportscardsllc.com';
// SITEMAP_PATH is now absolute

// Define your site pages with their metadata
const pages = [
  {
    url: '/',
    lastmod: new Date().toISOString().split('T')[0],
    changefreq: 'daily',
    priority: '1.0',
    description: 'Homepage - Scorecard'
  },
  {
    url: '/search',
    lastmod: new Date().toISOString().split('T')[0],
    changefreq: 'daily',
    priority: '0.9',
    description: 'Search for trading cards'
  },
  {
    url: '/history',
    lastmod: new Date().toISOString().split('T')[0],
    changefreq: 'weekly',
    priority: '0.7',
    description: 'Search history'
  },
  {
    url: '/auth-success',
    lastmod: new Date().toISOString().split('T')[0],
    changefreq: 'monthly',
    priority: '0.3',
    description: 'Authentication success page'
  }
];

// API endpoints (optional - for documentation purposes)
const apiEndpoints = [
  {
    url: '/api/search-cards',
    lastmod: new Date().toISOString().split('T')[0],
    changefreq: 'daily',
    priority: '0.6',
    description: 'Search cards API endpoint'
  },
  {
    url: '/api/live-listings',
    lastmod: new Date().toISOString().split('T')[0],
    changefreq: 'daily',
    priority: '0.6',
    description: 'Live listings API endpoint'
  },
  {
    url: '/api/search-history',
    lastmod: new Date().toISOString().split('T')[0],
    changefreq: 'weekly',
    priority: '0.5',
    description: 'Search history API endpoint'
  }
];

// Auto-detect routes from your Express app
function detectRoutes() {
  const routes = [];
  
  try {
    // Read the main index.js file to detect routes
    const indexContent = fs.readFileSync(INDEX_PATH, 'utf8');
    
    // Look for route patterns
    const routeMatches = indexContent.match(/app\.use\(['"`]\/api\/[^'"`]+['"`]/g);
    if (routeMatches) {
      routeMatches.forEach(match => {
        const route = match.match(/\/api\/[^'"`]+/)[0];
        if (!apiEndpoints.find(ep => ep.url === route)) {
          apiEndpoints.push({
            url: route,
            lastmod: new Date().toISOString().split('T')[0],
            changefreq: 'weekly',
            priority: '0.4',
            description: `API endpoint: ${route}`
          });
        }
      });
    }
  } catch (error) {
    console.log('⚠️  Could not auto-detect routes:', error.message);
    // Do not throw, just continue
  }
  return routes;
}

// Generate the sitemap XML
function generateSitemap(includeApiEndpoints = false) {
  const xmlHeader = '<?xml version="1.0" encoding="UTF-8"?>\n';
  const urlsetOpen = '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  const urlsetClose = '</urlset>';
  let urls = '';
  // Add main pages
  pages.forEach(page => {
    urls += `  <url>\n`;
    urls += `    <loc>${BASE_URL}${page.url}</loc>\n`;
    urls += `    <lastmod>${page.lastmod}</lastmod>\n`;
    urls += `    <changefreq>${page.changefreq}</changefreq>\n`;
    urls += `    <priority>${page.priority}</priority>\n`;
    urls += `  </url>\n`;
  });
  // Add API endpoints if requested
  if (includeApiEndpoints) {
    apiEndpoints.forEach(endpoint => {
      urls += `  <url>\n`;
      urls += `    <loc>${BASE_URL}${endpoint.url}</loc>\n`;
      urls += `    <lastmod>${endpoint.lastmod}</lastmod>\n`;
      urls += `    <changefreq>${endpoint.changefreq}</changefreq>\n`;
      urls += `    <priority>${endpoint.priority}</priority>\n`;
      urls += `  </url>\n`;
    });
  }
  const sitemap = xmlHeader + urlsetOpen + urls + urlsetClose;
  return sitemap;
}

// Write the sitemap to file
function writeSitemap(includeApiEndpoints = false) {
  try {
    // Auto-detect routes
    detectRoutes();
    const sitemap = generateSitemap(includeApiEndpoints);
    // Ensure output directory exists
    fs.mkdirSync(path.dirname(SITEMAP_PATH), { recursive: true });
    fs.writeFileSync(SITEMAP_PATH, sitemap, 'utf8');
    console.log('✅ Sitemap generated successfully!');
    console.log(`📁 Location: ${SITEMAP_PATH}`);
    console.log(`🌐 Base URL: ${BASE_URL}`);
    console.log(`📅 Generated: ${new Date().toISOString()}`);
    console.log(`📊 Pages included: ${pages.length}`);
    if (includeApiEndpoints) {
      console.log(`🔌 API endpoints included: ${apiEndpoints.length}`);
    }
    // Show summary
    console.log('\n📋 Pages:');
    pages.forEach(page => {
      console.log(`  • ${page.url} (${page.priority} priority, ${page.changefreq})`);
    });
    if (includeApiEndpoints) {
      console.log('\n🔌 API Endpoints:');
      apiEndpoints.forEach(endpoint => {
        console.log(`  • ${endpoint.url} (${endpoint.priority} priority, ${endpoint.changefreq})`);
      });
    }
  } catch (error) {
    console.error('❌ Error generating sitemap:', error.message);
  }
}

// Check command line arguments
const includeApi = process.argv.includes('--include-api') || process.argv.includes('-a');
// Run the generator
writeSitemap(includeApi);