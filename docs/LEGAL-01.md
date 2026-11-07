# LEGAL-01 — Privacy and tracking audit

Scope: source review and isolated frontend validation. Intended audience: United States (owner confirmed October 11, 2026). No backend startup, jobs, database writes, emails, deployment or merge. RSS is excluded from every PR commit. The initial pass refreshed its timestamp and lost that earlier backup; that earlier timestamp is not restored or claimed to be restored. This follow-up backs up the current uncommitted RSS inside the ignored workspace cache and restores it byte-for-byte after the build, verified by SHA-256 DC3301FCAD415D4AFE5F429CCC5F276728231FDAD499D2640F54C79388185871. Existing application/environment settings were not changed; added only a deployment block for this newly created branch.

## Findings and changes

- public/index.html loaded AdSense unconditionally; loadDeferredGa started GA4 automatically. Replaced with basic Analytics consent gate and equal accept/reject actions, persistent preferences on every route, 180-day choice validity (not a promise to delete the browser record), GPC suppression, cross-tab withdrawal, immediate GA opt-out and reload after a saved choice to destroy a retired runtime. Advertising components and static loader disabled pending verified certified CMP configuration.
- Do not interpret a custom analytics banner as a certified Google publisher CMP. International access is possible despite intended US audience, so worldwide opt-in is used without geolocation assumptions.
- Removed raw search terms and arbitrary error text from GA events. Sanitize page URLs/referrers and exclude /auth-success. Google account enhanced measurement must be checked before release: disable automatic site search, form interactions and history pageviews that can collect unsanitized information. App settings alone do not prove account settings.
- Privacy policy no longer says advertising tracking never occurs, JWTs are encrypted, all history is deleted in 30 days, Clear All deletes everything, or security follows an unverified standard. Added Analytics, disabled advertising status, login session cookie, browser storage/cache, hosting and recent-sales providers, retention and deletion limits. The October 25 update replaced the earlier image-processor, bidding and saved-search expiry disclosures with the owner-settled facts below.

## Source evidence

- backend/routes/auth.js:29-50: Google profile/email; signed 7-day access and 30-day refresh tokens; callback URL query carries tokens.
- backend/index.js:183-256: Redis/memory session and 24-hour cookie, HttpOnly, production Secure, SameSite=None.
- frontend/src/services/tokenService.js:8-29 and App.js logout: localStorage tokens removed; no server revocation implied.
- backend/services/searchHistoryService.js:12-38,75-100,141-144,242-261: with REDIS_URL, each search record is written with a 30-day TTL, the per-user index TTL is refreshed to 30 days on each save and trimmed to the newest 50 entries; trimmed records remain hidden until their own TTL; delete/Clear All only target indexed IDs. Without REDIS_URL or on connection failure, nothing is stored (the save is only logged, with query and user ID) and history reads return empty; there is no in-memory store despite the "in-memory fallback" log text.
- backend/routes/searchHistory.js:153-172 and service logging: queries and user identifiers logged; no verified operational-log retention.
- frontend/src/components/TCDBBrowser.js:624; backend/routes/cardsight.js:43-54; services/cardsightService.js:15-38,100-129: image-identification code that uploads image and filename to CardSight. Owner confirmed October 25 that image upload/card identification is not live; it is not disclosed as active.
- backend/routes/imageAnalysis.js:5-46 and services/imageAnalysisService.js:20-34: Google Cloud Vision OCR code. Not live per owner; not disclosed as active.
- backend/routes/searchCards.js and services/recentAuctionSalesService.js (from main 25ff709): Recent Auction Sales sends search terms server-side to CardSight auction-sales search. Disclosed as active.
- backend/services/ebayApiService.js:47-58 and routes/liveListings.js:23-39: operator eBay credentials, no visitor eBay OAuth connection found. Browser eBay images/external affiliate links disclose network data independently of optional Google tracking.
- backend/services/ebayBiddingService.js: bidding was abandoned (owner, October 25); the notice no longer describes it. The /ebay-bidding route and its sitemap/route tests remain in the application; removing them is outside this PR.
- frontend/public/sw.js: previously cached authenticated API GET responses and token-bearing OAuth navigation without expiry or logout purge. Fixed by bypassing all API requests and /auth-success, with a cache version bump that deletes old caches on worker activation. Public navigation, assets and images still use browser caches without a configured TTL. Search query reuse key is temporary localStorage, not analytics.

## Separate security findings

Tokens in callback URLs; fallback signing/session secrets; search-history administrative access uses email containing `admin` (routes/searchHistory.js:84,114). These require a separate authentication/security review. This PR does not claim to resolve them.

## Facts and release decisions still needed

Owner confirmed intended US audience (October 11) and settled these facts on October 25, now reflected in the notice:

- Legal entity: Mancave Sports Cards LLC. Privacy contact: mancavesportscardsllc@gmail.com (replaces the interim eBay store channel).
- No scheduled account-deletion policy: account information remains until the user requests deletion. Logs and backups follow Vercel/Railway defaults; no durations are stated.
- Saved-search history is not covered by that statement; it has the technical limits in the source evidence above (30-day expiry and 50-entry list with Redis; not stored without Redis). The notice does not promise saved searches remain until deleted. Backend retention behavior is unchanged.
- Active services: Vercel hosting, Railway backend, Google sign-in, Google Analytics only with consent, CardSight recent-sales search.
- Image upload/card identification is not live; Google Vision and other image processors are not listed as active. Bidding was abandoned; no active or planned bidding is described.
- Unsupported claims about encrypted JWTs, 30-day automatic deletion and absence of advertising tracking stay removed.
Production saved-search storage, verified read-only on November 7 via Railway CLI (variable names only, no values displayed; Redis PING/CONFIG GET/INFO/SCAN counts; no writes, no backend start, no setting changes):

- Railway service `web` (project ManCaveSportsCardsLLC Website, production) has REDIS_URL set. It points to the public proxy of the separate Redis service (project ManCaveSportsCardsLLCdatabase), and the same credentials answered PING from outside Railway.
- Redis 7.2.5: maxmemory 0 (no limit configured) with maxmemory-policy noeviction; evicted_keys 0, expired_keys 3140. Keys therefore leave only by TTL expiry or deletion. Saved-search records found (counts only) all carried TTLs, consistent with the 30-day expiry in the notice.
- Persistence: RDB snapshots (`save 3600 1 300 100 60 10000`, last bgsave ok), AOF disabled. A Redis crash can lose writes since the last snapshot; the notice's "or sooner depending on that service" covers this.
- Not verified: the web service's own runtime Redis connection logs (inferred from present TTL-bearing records, not observed).
- Railway volume backups, checked read-only November 7 (Railway CLI `volume list` and public GraphQL `volumeInstanceBackupScheduleList` / `volumeInstanceBackupList`): the Redis service has one volume ("beneficial-volume", mounted at /bitnami, 49MB/500MB) with no backup schedule and 0 Railway backups. Unknown: Railway's internal infrastructure-level copies or disaster-recovery retention, which are not exposed to the account; the in-volume RDB snapshot file is overwritten on each save.

Google Analytics property, viewed read-only on November 7 in the authenticated GA admin UI (account 361253435, property 496474363; no setting saved or changed):

- Observed: one web stream, "ManCaveSportsCard webpage" (stream ID 11480732993, https://www.mancavesportscardsllc.com), measurement ID G-X6BGH9S5F8, data flowing in the past 48 hours.
- Observed: enhanced measurement is on with all seven events enabled: page views (page loads, and "Page changes based on browser history events" checked), scrolls, outbound clicks, site search, form interactions, video engagement, file downloads.
- Observed: connected site tags: 0. Data redaction: email active; URL query parameter keys inactive.
- Observed: data retention: event data 2 months, user data 14 months, "Reset on new user activity" on.
- Observed: Data collection page shows a "Turn on" prompt for Google signals (inferred off) and "Granular location and device data collection" on.
- Inference: with browser-history page views and site search on, consented SPA navigations can send page_view events and query-parameter search terms that bypass the app's sanitized page_location and `search_performed`-only search event. This conflicted with the earlier notice claim ("We do not intentionally send ... free-text searches to Analytics"), now removed. Form interactions can send form identifiers/destinations.
- Inference: the data currently flowing comes from the deployed main build, whose GA loader is not consent-gated; this PR's gate is not live.

Notice changes from these observations: GA retention is stated per https://support.google.com/analytics/answer/7667196: event-level data deleted after 2 months; user-level data (key-event data follows this setting) after 14 months; "Reset on new activity" restarts the user-level period per user identifier; expired data is removed monthly; the settings do not affect standard aggregated reports. The earlier "applies to Analytics reporting data" wording was unsupported and was replaced. The notice does not claim these periods cover other Google records, logs or backups. The claim that free-text searches are not sent to Analytics was removed and stays unresolved until GA settings and observed outgoing requests support it. Source context: the app's page URLs carry no search terms (searches go only to API fetch URLs); browser page URLs with query parameters are /auth-success?token=…&refreshToken=… (excluded from tracking by the app) and /news?tab=…. Visitor- or link-supplied query parameters are not controlled by the app.

GA changes approved by the owner and applied in the GA admin UI on November 7 (no other settings touched). Observed after saving: enhanced measurement shows page views (page loads only; browser-history option unchecked), scrolls, outbound clicks, video engagement, file downloads; site search and form interactions off; data redaction shows email active and 2 URL query parameter keys (`token`, `refreshtoken`; GA treats keys case-insensitively and applies them only to page_location, page_referrer, page_path, link_url, video_url and form_destination). The four changes as originally proposed:

1. Enhanced measurement > Page views > advanced settings: uncheck "Page changes based on browser history events". Effect: GA stops auto-sending page_view on SPA history changes; the app's own sanitized page tracking remains the only source. SPA route views are only counted if the app sends them.
2. Enhanced measurement: turn off Site search. Effect: GA stops creating view_search_results from URL query parameters (q, s, search, query, keyword, plus any configured keys), so search terms in URLs are not collected. The app's `search_performed` event is unaffected.
3. Enhanced measurement: turn off Form interactions. Effect: GA stops form_start/form_submit events with form IDs, names and destinations.
4. Data redaction > URL query parameter keys: activate with keys `token` and `refreshToken`. Effect: values of those keys are replaced before GA processing if they ever reach a page URL or referrer, as defense-in-depth for the OAuth callback. Optional: add `q`, `query`, `search`; low value once site search is off and app URLs carry no search terms. Redaction applies to new data only.

Local request capture, November 7 (docs/LEGAL-01-ga-request-capture.cjs; local evidence only, not production verification). The real gtag.js for G-X6BGH9S5F8 (carrying the live stream's enhanced measurement configuration) was downloaded once by Node without cookies or referrer and replayed in Edge against the local consent-gated build at a fake origin. Every Google request was captured and answered locally; none was forwarded. All tokens and terms were fake markers. Raw evidence: frontend/node_modules/.cache/legal-01-rss-preserve/ga-capture-20261107.json (outside Git).

- Before consent and after withdrawal: 0 Google requests across home, SPA navigation to /search, search-form submission, a pushState URL with `?search=`, a full load of `/news?q=…&tab=…` and `/auth-success?token=…&refreshToken=…`. One gtag.js request was recorded on the page load immediately before clicking Reject, while consent was still valid; no collection request followed.
- After consent: 8 collection events. Every `dl` was origin+path only (no query strings); `dr` empty. The search-form term, the pushState `?search=` term and both fake tokens were absent. The app's `search` event carried only `search_performed`.
- After consent: a full page load of `/news?q=FAKE_QUERY_LEGAL01` produced enhanced-measurement `view_search_results` with `search_term=FAKE_QUERY_LEGAL01`. Site search therefore sends link-supplied query terms despite the sanitized `dl`. This directly contradicts a "no free-text searches" claim while site search is on.
- No form_start/form_submit events appeared in this exercise (form filled and submitted programmatically). This does not prove form interactions never fire with real user input.
- Browser-history page views: all page_view events observed carried sanitized `dl`; no separate history-triggered page_view with an unsanitized URL was observed. Not proof for every navigation pattern.
- Limits: fake origin, headless Edge, fixture API responses; Google's server-side processing, the live site and current production (main, not consent-gated) are not covered.

Post-change rerun (same script and limits; evidence ga-capture-20261107-after.json outside Git): all 5 checks passed; no `view_search_results`; none of the five fake markers (form search term, link-supplied `?q=`, pushState `?search=`, token, refresh token) appeared in any Google request; events were page_view and scroll with origin+path `dl`. Local evidence only: it shows the live stream configuration served in gtag.js plus the PR's consent gate, not production traffic (production still runs main without the consent gate). The free-text claim remains out of the notice pending an owner decision to restore it after this PR is deployed and verified.

Still unresolved: free-text-search claim (GA settings now changed and local capture clean; production verification pending deployment); Railway infrastructure-level copies of the Redis volume (no account backups or schedules exist; internal provider retention unknown); US state applicability thresholds; AdSense stays disabled and certified-CMP work remains parked. Do not invent deletion SLAs, legal exemptions or a compliance certification.

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

October 25 revalidation after merging main b527d5d (merge 2cb54eb, no conflicts; main did not change public/index.html, public/sw.js, consent or Analytics code, and its new SearchPage search event still sends only `search_performed`):

- Full frontend suite: 23 suites / 342 tests; 336 passed, 6 failed in newsArticleService, NewsPage and NewsIndex. Those files and news content are identical to main, so the failures are inherited from main (content-dependent newest-article expectations), not caused by this branch.
- Production `npm run build`: compiled successfully. RSS restored byte-for-byte (SHA-256 DC3301FCAD415D4AFE5F429CCC5F276728231FDAD499D2640F54C79388185871); generated sitemap.xml change discarded.
- docs/LEGAL-01-browser-check.cjs: 18 Edge assertions passed. docs/LEGAL-01-service-worker-upgrade.cjs: 10 Edge assertions passed. Both are local-only, with the same limits described above.
- November 7 retention-wording update (main still b527d5d): a temporary render test of the notice passed and was removed; production build compiled; RSS restored to the same SHA-256. The six news failures were not rerun: their test files (last changed 9c212cc, October 11), components, article service, content, config, setupTests and package.json are identical to main, and they assert fixed article counts/newest slug that main's later article commits changed (for example, expected newest "price-low-end-sports-cards-ebay", received "list-sports-cards-ebay-set-builders").

To rerun browser validation, make Playwright available as a Node module (or set LEGAL01_PLAYWRIGHT_PATH to its module directory), install/use Microsoft Edge, and run `node docs/LEGAL-01-browser-check.cjs` after a frontend build and `node docs/LEGAL-01-service-worker-upgrade.cjs`. The latter binds only a local ephemeral fixture port and closes it afterward.

## Consent lifecycle implementation

The follow-up to dea9b788129ba8a5242db8a902d99838ff0a20a7 stops tracking before attempting persistence. Failed writes keep a document-level denial, attempt a sessionStorage denial guard and attempt removal of the old localStorage choice. It never reloads on that failure. A subsequent successfully saved choice clears the guard. If all browser storage is unavailable, rejection still protects the current document, but cannot promise saved preferences after a later full load; the notice states that limit.

Google's documented ga-disable boolean is exposed through a dynamic getter as well as a shutdown latch. A pending runtime property read therefore sees denial immediately when GPC or choice validity changes, before the periodic lifecycle poll. Expiry timers run at the validity deadline (with browser-safe chunks); focus, visibility, pageshow, popstate and history wrappers synchronize cleanup. The history wrapper checks the next path before Google's history listeners could observe it. A generation counter and canceled timer prevent retired loader callbacks or wrappers from starting again. Once a tag has been injected and stopped, it cannot restart in the same document; an explicitly saved choice reloads to create a clean runtime.

The stored choice record is considered valid for 180 days but is not automatically erased on expiry. The notice and interface distinguish validity from storage lifetime. Google Analytics account enhanced measurement remains a release blocker: Google documents that browser-history pageviews can still fire with send_page_view:false unless disabled in the account.

## Unresolved publication facts

Operator identity, privacy contact, active services, feature availability and account-retention approach are settled (see above). Production saved-search storage was verified read-only on November 7 (REDIS_URL set and reachable; noeviction; RDB snapshots, AOF off); the Redis volume has no Railway backup schedule and 0 backups; Railway's internal infrastructure retention remains unknown. GA settings were viewed read-only on November 7 (see above). Before enabling Analytics in a release, the approved GA changes were applied November 7 and the local capture is clean; production request verification after deployment is still needed before any no-free-text claim returns; connected tags (0), Google signals (inferred off) and retention (event 2 months, user 14 months, now in the notice) are recorded. US state law applicability thresholds remain unassessed. Code tests do not confirm business practices or legal compliance.

AdSense remains disabled. Certified CMP, ad vendor and publisher configuration remain parked and may stay later follow-up only while AdSense stays disabled. Separate authentication/security findings above still require their own triage and are not resolved by this tracking PR.

## Draft publication safety

Added frontend/vercel.json git.deploymentEnabled block only for codex/legal-01-privacy-tracking. Other branches retain their defaults and existing rewrites/settings. Official source: https://vercel.com/docs/project-configuration/git-configuration . This prevents automatic Vercel deployment for the draft branch. No deployment/promotion commands were issued.

## Checks / preview investigation

No .github/workflows exist in current main or this branch; GitHub returned empty check and commit-status lists for the initial head. Existing frontend/vercel.json disables Git deployments specifically for codex/legal-01-privacy-tracking, which explains the absent Vercel preview/check. The scoped Vercel CLI returned no deployments for the initial exact SHA. This follow-up does not change any deployment settings, add CI, dispatch jobs or create a preview. New-head check/deployment status is verified after push and reported with the exact commit.
