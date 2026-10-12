# LEGAL-01 — Privacy and tracking audit

Scope: source review and isolated frontend validation. Intended audience: United States (owner confirmed October 11, 2026). No backend startup, jobs, database writes, emails, deployment or merge. Existing local RSS file is excluded from the commit. The build refreshed its lastBuildDate; the sandbox temporary backup was discarded, so the exact previous local timestamp could not be restored. Feed content is unchanged relative to the original tracked content. Existing application/environment settings were not changed; added only a deployment block for this newly created branch.

## Findings and changes

- public/index.html loaded AdSense unconditionally; loadDeferredGa started GA4 automatically. Replaced with basic Analytics consent gate and equal accept/reject actions, persistent preferences on every route, 180-day versioned browser choice, GPC suppression, cross-tab withdrawal, GA opt-out flag and reload to destroy the executed runtime. Advertising components and static loader disabled pending verified certified CMP configuration.
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

## Validation

Final full frontend suite: 22 suites and 332 tests passed (25.885 seconds). Production npm run build including static sitemap/article/RSS generators passed. Six intercepted headless Edge checks passed: before choice, rejected choice after reload, acceptance, withdrawal without new requests, cookie removal, and reacceptance. git diff --check passed. Existing React Router future-flag warnings and stale Browserslist data warnings remain. Browser verification uses inert intercepted Google scripts to verify app network intent without sending visitor data to Google. It cannot certify live Google account, tag runtime, deployed cookies, CMP or provider retention. No production change authorized.

## Draft publication safety

Added frontend/vercel.json git.deploymentEnabled block only for codex/legal-01-privacy-tracking. Other branches retain their defaults and existing rewrites/settings. Official source: https://vercel.com/docs/project-configuration/git-configuration . This prevents automatic Vercel deployment for the draft branch. No deployment/promotion commands were issued.
