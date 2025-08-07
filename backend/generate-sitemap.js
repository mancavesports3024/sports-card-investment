const fs = require('fs');
const path = require('path');

// Simple sitemap generator
function generateSitemap() {
    console.log('🔗 Generating sitemap...');
    
    const baseUrl = 'https://www.mancavesportscardsllc.com';
    const currentDate = new Date().toISOString().split('T')[0];
    
    // Define your site's pages
    const pages = [
        { url: '/', priority: '1.0', changefreq: 'daily' },
        { url: '/search', priority: '0.9', changefreq: 'daily' },
        { url: '/news', priority: '0.8', changefreq: 'weekly' },
        { url: '/history', priority: '0.7', changefreq: 'weekly' },
        { url: '/ebay-bidding', priority: '0.6', changefreq: 'weekly' }
    ];
    
    // Generate sitemap XML
    let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;
    
    pages.forEach(page => {
        sitemap += `  <url>
    <loc>${baseUrl}${page.url}</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>
`;
    });
    
    sitemap += '</urlset>';
    
    // Write sitemap to frontend public directory
    const frontendPublicPath = path.join(__dirname, '../frontend/public/sitemap.xml');
    fs.writeFileSync(frontendPublicPath, sitemap);
    
    console.log(`✅ Sitemap generated: ${frontendPublicPath}`);
    console.log(`📄 ${pages.length} pages included`);
    
    return {
        pages: pages.length,
        path: frontendPublicPath,
        baseUrl: baseUrl
    };
}

// Run if called directly
if (require.main === module) {
    try {
        const result = generateSitemap();
        console.log('\n🎯 Sitemap generation completed successfully!');
        console.log(`📊 Pages: ${result.pages}`);
        console.log(`🔗 Base URL: ${result.baseUrl}`);
        console.log(`📁 Location: ${result.path}`);
    } catch (error) {
        console.error('❌ Error generating sitemap:', error.message);
        process.exit(1);
    }
}

module.exports = { generateSitemap }; 