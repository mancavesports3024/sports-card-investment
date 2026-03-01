// Generates sitemap.xml for the frontend (run from frontend prebuild)
// Writes to frontend/public/sitemap.xml

const fs = require('fs');
const path = require('path');

const BASE = 'https://www.mancavesportscardsllc.com';
const today = new Date().toISOString().slice(0, 10);

const routes = [
  { loc: '/', changefreq: 'daily', priority: '1.0' },
  { loc: '/search', changefreq: 'daily', priority: '0.9' },
  { loc: '/news', changefreq: 'weekly', priority: '0.8' },
  { loc: '/history', changefreq: 'weekly', priority: '0.7' },
  { loc: '/ebay-bidding', changefreq: 'weekly', priority: '0.6' },
];

const urls = routes
  .map(
    (r) => `  <url>
    <loc>${BASE}${r.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${r.changefreq}</changefreq>
    <priority>${r.priority}</priority>
  </url>`
  )
  .join('\n');

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;

const outPath = path.join(__dirname, '..', 'frontend', 'public', 'sitemap.xml');
fs.writeFileSync(outPath, xml);
console.log('Generated sitemap at', outPath);
