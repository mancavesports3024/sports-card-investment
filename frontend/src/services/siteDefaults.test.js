// Keeps public/index.html and SITE_DEFAULTS in agreement.
//
// The static tags in index.html are what a crawler sees before JavaScript runs;
// DefaultSeo re-declares the same values so react-helmet can take ownership of
// those tags without changing what they say. If the two ever drift, the visible
// metadata would flicker on hydration and the raw HTML would disagree with the
// rendered DOM. This test is the cheap guard against that.

const fs = require('fs');
const path = require('path');

const { SITE_DEFAULTS, SITE_NAME } = require('./siteMetadata');

const INDEX_HTML = fs.readFileSync(
  path.join(__dirname, '..', '..', 'public', 'index.html'),
  'utf8'
);

const metaContent = (attribute, key) => {
  const pattern = new RegExp(
    `<meta[^>]*${attribute}="${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*content="([^"]*)"`,
    'i'
  );
  const match = INDEX_HTML.match(pattern);
  return match ? match[1] : null;
};

const decodeEntities = (value) =>
  value === null
    ? null
    : value
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');

describe('public/index.html matches SITE_DEFAULTS', () => {
  it('uses the same title', () => {
    expect(INDEX_HTML).toContain(`<title>${SITE_DEFAULTS.title}</title>`);
  });

  it('uses the same description, keywords and author', () => {
    expect(decodeEntities(metaContent('name', 'description'))).toBe(
      SITE_DEFAULTS.description
    );
    expect(decodeEntities(metaContent('name', 'keywords'))).toBe(SITE_DEFAULTS.keywords);
    expect(decodeEntities(metaContent('name', 'author'))).toBe(SITE_DEFAULTS.author);
    expect(decodeEntities(metaContent('name', 'robots'))).toBe(SITE_DEFAULTS.robots);
  });

  it('uses the same Open Graph values', () => {
    expect(decodeEntities(metaContent('property', 'og:title'))).toBe(SITE_DEFAULTS.title);
    expect(decodeEntities(metaContent('property', 'og:description'))).toBe(
      SITE_DEFAULTS.ogDescription
    );
    expect(decodeEntities(metaContent('property', 'og:type'))).toBe(SITE_DEFAULTS.ogType);
    expect(decodeEntities(metaContent('property', 'og:site_name'))).toBe(SITE_NAME);
    expect(decodeEntities(metaContent('property', 'og:image'))).toBe(SITE_DEFAULTS.image);
  });

  it('uses the same Twitter card values', () => {
    expect(decodeEntities(metaContent('name', 'twitter:card'))).toBe(
      'summary_large_image'
    );
    expect(decodeEntities(metaContent('name', 'twitter:title'))).toBe(
      SITE_DEFAULTS.title
    );
    expect(decodeEntities(metaContent('name', 'twitter:description'))).toBe(
      SITE_DEFAULTS.twitterDescription
    );
    expect(decodeEntities(metaContent('name', 'twitter:image'))).toBe(
      SITE_DEFAULTS.image
    );
  });

  it('uses absolute URLs for social images so crawlers can resolve them', () => {
    expect(SITE_DEFAULTS.image).toMatch(/^https:\/\/www\.mancavesportscardsllc\.com\//);
    expect(metaContent('property', 'og:image')).not.toContain('%PUBLIC_URL%');
    expect(metaContent('name', 'twitter:image')).not.toContain('%PUBLIC_URL%');
  });

  it('never advertises the Railway origin as a public URL', () => {
    expect(INDEX_HTML).not.toMatch(/railway\.app/);
  });
});
