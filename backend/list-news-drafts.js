// Lists the articles waiting for approval in frontend/content/news-drafts.
//
// This is the Node-side replacement for the old browser-facing
// getDraftArticles(). Draft inspection has to live here: the browser could only
// offer it by having the draft text in its bundle, which is exactly the leak the
// split directories exist to prevent.
//
// Usage, from the repository root:
//   node backend/list-news-drafts.js

'use strict';

const path = require('path');

const { NEWS_DRAFT_DIR, loadNewsContent } = require('./news-content');

function main() {
  const { drafts, draftErrors } = loadNewsContent();

  const relativeDir = path.relative(path.join(__dirname, '..'), NEWS_DRAFT_DIR);
  console.log(`\nDrafts in ${relativeDir.replace(/\\/g, '/')}\n`);

  if (drafts.length === 0) {
    console.log('  (none)');
  } else {
    drafts.forEach((article) => {
      console.log(`  ${article.slug}`);
      console.log(`    title      ${article.title}`);
      console.log(`    published  ${article.publishedAt}`);
      console.log(`    updated    ${article.updatedAt}`);
      console.log(`    category   ${article.category}`);
      console.log('');
    });
  }

  if (draftErrors.length > 0) {
    console.log(`${draftErrors.length} draft(s) are invalid and would be skipped:\n`);
    draftErrors.forEach(({ source, errors }) => {
      console.log(`  ${source}`);
      errors.forEach((error) => console.log(`    - ${error}`));
    });
    console.log('');
  }

  console.log(
    `${drafts.length} draft(s) ready for review. To approve one, move its file into ` +
      'frontend/src/content/news and change "status" to "published".\n'
  );
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`\nCould not read drafts.\n${error.message}\n`);
    process.exit(1);
  }
}

module.exports = { main };
