// Article discovery for the file-based news system (browser bundle).
//
// Uses the Webpack `require.context` feature supported by Create React App so
// that dropping a new JSON file into src/content/news is all that is required
// to publish an article. There is no import list to maintain.
//
// SECURITY: this context must only ever reference the *published* directory.
//
// `require.context` is resolved at build time and bundles every file it
// matches, so whatever directory is named here has its full contents -- titles,
// excerpts, bodies, meta descriptions -- compiled into a public JavaScript
// chunk. Filtering by `status` at runtime happens far too late to help: the
// bytes have already been served. Unapproved articles therefore live outside
// src entirely, in frontend/content/news-drafts, where Webpack cannot reach
// them. See that directory's README.md for the authoring workflow.
//
// Nothing under src may import, require or enumerate the draft directory.
// newsArticleContext.test.js enforces both halves of that rule.
//
// Jest does not implement `require.context`, so package.json maps every request
// for this module to newsArticleContext.node.js when running tests. Both files
// read the same published directory and expose the same loadRawArticles()
// contract.

const context = require.context('../content/news', false, /\.json$/);

export function loadRawArticles() {
  return context.keys().map((key) => ({
    source: key.replace(/^\.\//, ''),
    data: context(key),
  }));
}

export default loadRawArticles;
