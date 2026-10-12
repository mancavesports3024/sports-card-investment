# LEGAL-01: correct privacy disclosures and gate optional tracking

The published privacy notice omitted automatic Google Analytics/AdSense and overstated encryption and deletion. This draft makes Analytics an explicit worldwide opt-in, adds equal accept/reject choices and persistent preferences, honors GPC, and disables advertising pending verified certified CMP configuration.

It removes raw search/error text from Analytics, sanitizes page URLs and excludes the token-bearing auth callback. Withdrawal disables GA, clears accessible GA cookies and reloads to destroy the executed runtime. The service worker no longer caches API responses or query-bearing/OAuth navigation; v3 removes prior Scorecard caches while preserving unrelated browser caches.

The revised notice discloses account/session storage, Analytics, eBay/image processors, performance caches and actual retention/deletion limits. Full evidence, official sources, separate security findings and unconfirmed business facts are in docs/LEGAL-01.md.

Validation: 22 frontend suites / 332 tests pass; production build and static generators pass; six final built-app Edge checks pass with Google requests intercepted (before choice, rejection/reload, acceptance, withdrawal, cookie deletion, reacceptance). This verifies application network intent, not live Google account settings or hosted tag runtime. GA enhanced measurement/retention, AdSense CMP, dedicated contact and operational/provider/log/backup practices still require confirmation before release.

No backend startup, jobs, database writes, emails, merge or deployment. A branch-specific Vercel deployment block prevents previews for this draft branch while preserving other existing configuration. The existing locally modified RSS file is excluded; the build refreshed its timestamp and its ephemeral backup was unavailable for exact restoration. Feed content was not changed by this PR.
