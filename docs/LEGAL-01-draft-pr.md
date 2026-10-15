# LEGAL-01: correct privacy disclosures and make consent shutdown fail closed

The published notice omitted automatic Analytics/AdSense and overstated encryption and deletion. This draft makes Analytics a worldwide explicit opt-in with equal accept/reject actions, GPC suppression and persistent preferences. AdSense remains disabled. It discloses real browser/server storage and deletion limits without inventing operator, processor or retention facts.

Withdrawal shuts down before any storage write. A failed save cannot leave the current runtime enabled: an in-memory denial, best-effort session guard and old-choice removal fail closed, without reloading into an old grant. The documented Google disable property rechecks consent/GPC on every read; expiry timers, focus/visibility and navigation synchronize cleanup. Generation checks cancel pending loaders and stale wrappers. A retired runtime requires a saved choice and fresh document to restart. The notice accurately says choice validity lasts 180 days while the stored record can remain.

Private API responses and OAuth/query-bearing navigation bypass service-worker caching. Worker v3 removes older Scorecard caches while preserving unrelated caches.

Validation: 22 frontend suites / 340 tests pass; production build and static generators pass; 18 intercepted/synthetic Edge consent assertions pass; 10 actual browser service-worker upgrade / CacheStorage assertions pass using only loopback static fixtures and fake data. Intercepted scripts are not verification of Google's hosted tag or live account configuration. Detailed evidence, official Google sources and remaining publication facts are in docs/LEGAL-01.md.

The current uncommitted RSS was persistently backed up before building and restored byte-for-byte with the same SHA-256; no RSS edits are committed. This does not restore the timestamp lost in the earlier pass.

The PR stays draft. No deployment settings changed, AdSense enabled, backend started, jobs dispatched, databases written, emails sent, merge or production deployment performed. There are no GitHub Actions workflows in the repository and the existing branch-specific Vercel deployment block explains the missing preview. GA account configuration, business/privacy contact, active processors and actual retention/deletion practices still block publication; CMP work can wait only while advertising stays disabled.
