const fs = require('fs');
const path = require('path');

// Configuration
const BASE_URL = 'https://www.mancavesportscardsllc.com';
const SITEMAP_PATH = './frontend/public/sitemap.xml';

// Define your site pages with their metadata
const pages = [
  {
    url: '/',
    lastmod: new Date().toISOString().split('T')[0], // Current date in YYYY-MM-DD format
    changefreq: 'daily',
    priority: '1.0'
  },
  {
    url: '/search',
    lastmod: new Date().toISOString().split('T')[0],
    changefreq: 'daily',
    priority: '0.9'
  },
  {
    url: '/history',
    lastmod: new Date().toISOString().split('T')[0],
    changefreq: 'weekly',
    priority: '0.7'
  },
  {
    url: '/auth-success',
    lastmod: new Date().toISOString().split('T')[0],
    changefreq: 'monthly',
    priority: '0.3'
  }
];

// Generate the sitemap XML
function generateSitemap() {
  const xmlHeader = '<?xml version="1.0" encoding="UTF-8"?>\n';
  const urlsetOpen = '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  const urlsetClose = '</urlset>';
  
  let urls = '';
  
  pages.forEach(page => {
    urls += `  <url>\n`;
    urls += `    <loc>${BASE_URL}${page.url}</loc>\n`;
    urls += `    <lastmod>${page.lastmod}</lastmod>\n`;
    urls += `    <changefreq>${page.changefreq}</changefreq>\n`;
    urls += `    <priority>${page.priority}</priority>\n`;
    urls += `  </url>\n`;
  });
  
  const sitemap = xmlHeader + urlsetOpen + urls + urlsetClose;
  
  return sitemap;
}

// Write the sitemap to file
function writeSitemap() {
  try {
    const sitemap = generateSitemap();
    fs.writeFileSync(SITEMAP_PATH, sitemap, 'utf8');
    console.log('✅ Sitemap generated successfully!');
    console.log(`📁 Location: ${SITEMAP_PATH}`);
    console.log(`🌐 Base URL: ${BASE_URL}`);
    console.log(`📅 Generated: ${new Date().toISOString()}`);
    console.log(`📊 Pages included: ${pages.length}`);
    
    // Show the generated sitemap
    console.log('\n📄 Generated Sitemap:');
    console.log(sitemap);
    
  } catch (error) {
    console.error('❌ Error generating sitemap:', error.message);
  }
}

// Run the generator
writeSitemap(); 