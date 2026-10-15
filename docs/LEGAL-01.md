# LEGAL-01 — Privacy and tracking audit

Scope: source review and isolated frontend validation. Intended audience: United States (owner confirmed October 11, 2026). No backend startup, jobs, database writes, emails, deployment or merge. RSS is excluded from every PR commit. The initial pass refreshed its timestamp and lost that earlier backup; that earlier timestamp is not restored or claimed to be restored. This follow-up backs up the current uncommitted RSS inside the ignored workspace cache and restores it byte-for-byte after the build, verified by SHA-256 DC3301FCAD415D4AFE5F429CCC5F276728231FDAD499D2640F54C79388185871. Existing application/environment settings were not changed; added only a deployment block for this newly created branch.

## Findings and changes

- public/index.html loaded AdSense unconditionally; loadDeferredGa started GA4 automatically. Replaced with basic Analytics consent gate and equal accept/reject actions, persistent preferences on every route, 180-day choice validity (not a promise to delete the browser record), GPC suppression, cross-tab withdrawal, immediate GA opt-out and reload after a saved choice to destroy a retired runtime. Advertising components and static loader disabled pending verified certified CMP configuration.
- Do not interpret a custom analytics banner as a certified Google publisher CMP. International access is possible despite intended US audience, so worldwide opt-in is used without geolocation assumptions.
- Removed raw search terms and arbitrary error text from GA events. Sanitize page URLs/referrers and exclude /auth-success. Google account enhanced measurement must be checked before release: disable automatic site search, form interactions and history pageviews that can collect unsanitized information. App settings alone do not prove account settings.
- Privacy policy no longer says advertising tracking never occurs, JWTs are encrypted, all history is deleted in 30 days, Clear All deletes everything, or security follows an unverified standard. Added Analytics, disabled advertising status, login session cookie, browser storage/cache, uploaded image processors, conditional retention and deletion limits.

## Source evidence

- backend/routes/auth.js:29-50: Google profile/email; signed 7-day access and 30-day refresh tokens; callback URL query carries tokens.
- backend/index.js:183-256: Redis/memory session and 24-hour cookie, HttpOnly, production Secure, SameSite=None.
- frontend/src/services/tokenService.js:8-29 and App.js logout: localStorage tokens removed; no server revocation implied.
- backend/services/searchHistoryService.js:52-95,242-261: individual Redis records expire in 30 days, index keeps 50 entries; trimmed records remain until expiry; Clear All only targets indexed IDs.
- backend/routes/searchHistory.js:153-172 and service logging: queries and user identifiers logged; no verified operational-log retention.
- frontend/src/components/TCDBBrowser.js:624; backend/routes/cardsight.js:43-54; services/cardsightService.js:15-38,100-129: upload image and filename to CardSight, cache result/hash with seven-day age checked on access and 500-entry limit; response logging.
- backend/routes/imageAnalysis.js:5-46 and services/imageAnalysisService.js:20-34: Google Cloud Vision OCR endpoints and filename/text logging. Active public use not established.
- backend/services/ebayApiService.js:47-58 and routes/liveListings.js:23-39: operator eBay credentials, no visitor eBay OAuth connection found. Browser eBay images/external affiliate links disclose network data independently of optional Google tracking.
- backend/services/ebayBiddingService.js:9-33,111-123,153-163: configured items/bids saved in JSON until removal, no expiry; simulated bidding.
- frontend/public/sw.js: previously cached authenticated API GET responses and token-bearing OAuth navigation without expiry or logout purge. Fixed by bypassing all API requests and /auth-success, with a cache version bump that deletes old caches on worker activation. Public navigation, assets and images still use browser caches without a configured TTL. Search query reuse key is temporary localStorage, not analytics.

## Separate security findings

Tokens in callback URLs; fallback signing/session secrets; search-history administrative access uses email containing `admin` (routes/searchHistory.js:84,114). These require a separate authentication/security review. This PR does not claim to resolve them.

## Facts and release decisions still needed

Owner confirmed intended US audience and does not know the remaining operational facts. Verify direct privacy contact and legal entity details; active account/log/backup deletion practices and retention; hosting and image processor arrangements; intended availability of image/bidding features; US law applicability thresholds; GA account retention and enhanced measurement; Google publisher certified CMP/account/ad vendor configuration. Do not invent deletion SLAs, legal exemptions or a compliance certification. Existing eBay store is retained as an interim contact channel, not a verified dedicated privacy process.

## Official requirements consulted

- https://developers.google.com/tag-platform/security/concepts/consent-mode — basic mode sends no Google data before consent/refusal; advanced mode sends cookieless pings.
- https://support.google.com/adsense/answer/13554116?hl=en — Google-certified TCF CMP requirement for publishers serving EEA/UK/Switzerland.
- https://www.google.com/about/company/user-consent-policy/ — disclosure, consent records and withdrawal.
- https://support.google.com/adsense/answer/9560818?hl=en and https://support.google.com/adsense/answer/14182916?hl=en-GB — US state/RDP/GPC publisher guidance.
- https://oag.ca.gov/privacy/ccpa — California applicability/rights depend on business facts.
- https://europa.eu/youreurope/business/growing/digitalising/online-privacy/index_en.htm — EU nonessential storage consent.
- https://ico.org.uk/media2/about-the-ico/documents/4032419/cookie-letters-project-phase-2-template-letter.pdf — equal acceptance/rejection.
- https://www.edoeb.admin.ch/en/cookies-practical-tips — Swiss guidance differs from EU rules.
- https://support.google.com/analytics/answer/6366371?hl=en — avoid PII in URLs/search terms.
- https://developers.google.com/tag-platform/security/guides/privacy — GA disable flag.
- https://developers.google.com/analytics/devguides/collection/ga4/views — automatic and enhanced measurement settings require verification.

## Validation after the review fixes

- Full frontend suite: 22 suites / 340 tests passed; Jest runtime 17.249 seconds. Includes accepted-to-rejected storage failures (old grant still readable), session denial fallback, open-page exact expiry, GPC change, pushState/replaceState/popstate/focus, delayed injection and stale callback tests.
- Production `npm run build`, including sitemap/article/RSS generators: compiled successfully. RSS backup and restored current file both match SHA-256 DC3301FCAD415D4AFE5F429CCC5F276728231FDAD499D2640F54C79388185871. Backup and build/test logs remain under frontend/node_modules/.cache/legal-01-rss-preserve, outside Git.
- docs/LEGAL-01-browser-check.cjs: 18 Edge assertions passed against the final build. Every Google script and collection request was intercepted. An executing synthetic runtime reads the documented ga-disable property, has a positive accepted-send control and then tests failed withdrawal, pending timers, SPA navigation, GPC, expiry, delayed script response and no advertising requests. It is not Google's hosted runtime and does not verify a live Google account, enhanced measurement, connected tags, retention or actual provider collection. Service workers are blocked in these consent cases so request interception is complete.
- docs/LEGAL-01-service-worker-upgrade.cjs: 10 Edge assertions passed with actual browser ServiceWorker and CacheStorage APIs. The baseline v2 worker really cached a fake authenticated API response and token callback. The v3 worker then activated and removed known v1/v2 caches; unrelated cache contents survived; new private API/callback/query navigations stayed uncached; public navigation still cached; offline private access failed instead of recovering old cached data. This uses only an isolated loopback static fixture server and fake data, not the application backend or a deployed migration.
- `git diff --check` passes. Existing React Router future-flag and stale Browserslist warnings remain. No deployment, backend startup, background job, database write or email operation was performed.

To rerun browser validation, make Playwright available as a Node module (or set LEGAL01_PLAYWRIGHT_PATH to its module directory), install/use Microsoft Edge, and run `node docs/LEGAL-01-browser-check.cjs` after a frontend build and `node docs/LEGAL-01-service-worker-upgrade.cjs`. The latter binds only a local ephemeral fixture port and closes it afterward.

## Consent lifecycle implementation

The follow-up to dea9b788129ba8a5242db8a902d99838ff0a20a7 stops tracking before attempting persistence. Failed writes keep a document-level denial, attempt a sessionStorage denial guard and attempt removal of the old localStorage choice. It never reloads on that failure. A subsequent successfully saved choice clears the guard. If all browser storage is unavailable, rejection still protects the current document, but cannot promise saved preferences after a later full load; the notice states that limit.

Google's documented ga-disable boolean is exposed through a dynamic getter as well as a shutdown latch. A pending runtime property read therefore sees denial immediately when GPC or choice validity changes, before the periodic lifecycle poll. Expiry timers run at the validity deadline (with browser-safe chunks); focus, visibility, pageshow, popstate and history wrappers synchronize cleanup. The history wrapper checks the next path before Google's history listeners could observe it. A generation counter and canceled timer prevent retired loader callbacks or wrappers from starting again. Once a tag has been injected and stopped, it cannot restart in the same document; an explicitly saved choice reloads to create a clean runtime.

The stored choice record is considered valid for 180 days but is not automatically erased on expiry. The notice and interface distinguish validity from storage lifetime. Google Analytics account enhanced measurement remains a release blocker: Google documents that browser-history pageviews can still fire with send_page_view:false unless disabled in the account.

## Unresolved publication facts

Before publishing the final notice / enabling Analytics in a release, verify legal operator identity and a usable privacy-request contact/process; actual active hosting, image processors and public features; account/log/backup/provider retention and deletion practices; applicable US state thresholds/obligations; and GA enhanced measurement, connected tags, advertising-signal and retention settings. Unknown facts remain explicitly unconfirmed. Code tests do not confirm business practices or legal compliance.

AdSense certified CMP, ad vendor and publisher configuration can remain later follow-up only while AdSense stays disabled. Separate authentication/security findings above still require their own triage and are not resolved by this tracking PR.

## Draft publication safety

Added frontend/vercel.json git.deploymentEnabled block only for codex/legal-01-privacy-tracking. Other branches retain their defaults and existing rewrites/settings. Official source: https://vercel.com/docs/project-configuration/git-configuration . This prevents automatic Vercel deployment for the draft branch. No deployment/promotion commands were issued.

## Checks / preview investigation

No .github/workflows exist in current main or this branch; GitHub returned empty check and commit-status lists for the initial head. Existing frontend/vercel.json disables Git deployments specifically for codex/legal-01-privacy-tracking, which explains the absent Vercel preview/check. The scoped Vercel CLI returned no deployments for the initial exact SHA. This follow-up does not change any deployment settings, add CI, dispatch jobs or create a preview. New-head check/deployment status is verified after push and reported with the exact commit.
