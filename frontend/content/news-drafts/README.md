# News article drafts

Unapproved articles live here. **Nothing in this directory reaches the website.**

## Why this directory is outside `frontend/src`

The browser bundle discovers articles with Webpack's `require.context`:

```js
// frontend/src/services/newsArticleContext.js
const context = require.context('../content/news', false, /\.json$/);
```

`require.context` bundles **every** matching file at build time, and only then does
runtime code filter by `status`. So while drafts lived alongside published articles in
`frontend/src/content/news/`, their full text — title, excerpt, body, meta description —
was compiled into a public JavaScript chunk and served to anyone who looked. Filtering at
runtime cannot undo that, because the bytes have already shipped.

Webpack only bundles what is reachable from `frontend/src`. This directory sits outside it,
so drafts are physically unreachable from the browser build. That is the guarantee — not a
runtime check that can be bypassed or forgotten.

Node build and authoring scripts may read both directories, because they run on your
machine and never ship their input to a browser.

## Workflow

1. **Create.** Daily automation writes the new article here, in
   `frontend/content/news-drafts/<slug>.json`, with `"status": "draft"`.
2. **Approve.** When the article is approved, move the file into
   `frontend/src/content/news/` and change its status to `"published"`.
3. **Publish.** Only then can it enter the website bundle, the sitemap, the News index and
   the generated static article pages. The next production build picks it up automatically;
   there is no import list to maintain.

Reverting is the same move backwards: move the file back here and set the status to
`"draft"`.

## The directory/status contract

Validation enforces which statuses each directory may hold:

| Directory | Required status | On mismatch |
| --- | --- | --- |
| `frontend/src/content/news/` | `"published"` | Validation fails; the production build fails |
| `frontend/content/news-drafts/` | `"draft"` | Validation fails |

This is what stops the two halves of a move from drifting apart. Moving a file without
updating its status — or updating a status without moving the file — is a hard error rather
than a silent leak or a silently missing article.

Rules for filenames and content are otherwise identical in both directories
(`frontend/src/services/newsArticleSchema.js` is the single contract): the filename must be
`<slug>.json`, slugs are lowercase-and-hyphens, dates are real `YYYY-MM-DD` calendar dates,
and `updatedAt` may not precede `publishedAt`. A draft that violates these rules is reported
as a warning during the build instead of failing it, so authoring work in progress never
blocks a release.

## Inspecting drafts

Draft inspection is Node-side authoring tooling; there is deliberately no browser-facing
API for it. From the repository root:

```
node backend/list-news-drafts.js
```
