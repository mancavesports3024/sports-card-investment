// Node/Jest counterpart to newsArticleContext.js.
//
// `require.context` is a Webpack feature and is not available under Jest, so
// package.json maps './newsArticleContext' to this file during tests. It reads
// the same directory from disk to keep test coverage honest: the tests load the
// real article files rather than fixtures.
//
// This deliberately mirrors the browser's blind spot. It reads *only* the
// published directory, exactly like the `require.context` call it stands in for,
// so a test can never see a draft that the browser could not have seen. Reading
// drafts is the job of backend/news-content.js, which runs at build time only.

const fs = require('fs');
const path = require('path');

const CONTENT_DIR = path.join(__dirname, '..', 'content', 'news');

function loadRawArticles() {
  if (!fs.existsSync(CONTENT_DIR)) {
    return [];
  }

  return fs
    .readdirSync(CONTENT_DIR)
    .filter((file) => file.endsWith('.json'))
    .map((file) => ({
      source: file,
      data: JSON.parse(fs.readFileSync(path.join(CONTENT_DIR, file), 'utf8')),
    }));
}

module.exports = { loadRawArticles, default: loadRawArticles, CONTENT_DIR };
