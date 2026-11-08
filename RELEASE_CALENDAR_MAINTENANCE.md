# Release Calendar Maintenance

The calendar (`/api/news/releases`, `/api/releases`) is served from the `releases`
table only. Nothing scrapes or imports automatically: page views and the weekly
cron no longer sync Bleacher Seats. Rows change only through the reviewed process below.

## Weekly (manual, ~30 min)

1. **Rolling window:** cover today through today + 90 days (America/Chicago).
2. **Discover** new or moved products on Cardboard Connection (discovery only, never the source of record).
3. **Verify** each date:
   - Topps / Bowman: https://www.topps.com/release-calendar (required).
   - Other makers: Checklist Insider product pages (date, configuration, list price).
   - Use the **release** date, not the preorder date. If sources disagree, do not guess: leave the row unchanged and note the conflict.
4. **Recheck** every release dated within the next 14 days, even if it was verified before.
5. **Prices:** only published manufacturer or Checklist Insider list prices; otherwise null (never "TBD").
6. **Every added or changed row** gets a `release_sources` row with `source_url` and `source_checked_at`.
7. Status is derived from the date (on or before today = Released, after = Upcoming); do not hand-edit it.

## Applying changes

Edit `backend/scripts/release-calendar-fix/plan.js` (or a copy for the new week), then from `backend/`:

```bash
# 1. Snapshot production read-only
curl -s https://<api-host>/api/releases > data/release-calendar-fix/snapshot-api-releases-<date>.json
# 2. Dry run (no writes); review the .md report and note its fingerprint
node scripts/release-calendar-fix/run.js --snapshot data/release-calendar-fix/snapshot-api-releases-<date>.json --today <date>
# 3. After approval of that exact report: apply (aborts if the DB-computed fingerprint differs)
node scripts/release-calendar-fix/run.js --apply --confirm <fingerprint>
# 4. If needed: roll back using the file written by --apply
node scripts/release-calendar-fix/run.js --rollback data/release-calendar-fix/rollback-<date>-<fingerprint>.json --confirm <fingerprint>
```

`--from-db` produces the same dry run directly from the database inside a read-only transaction.
`--include-pending` also applies `PENDING_ADDITIONS` (rows with unresolved source conflicts) and changes the fingerprint.
Rows flagged `date-secondary-only` are held (archived) unless `--accept-secondary-dates` is passed; that also changes the fingerprint.
Apply must use the same flags as the approved dry run.

## After each release

Re-fetch `/api/releases`, reconcile against the approved dry run (counts, per-id
changes), and check the calendar on desktop and mobile: a past date, an upcoming
release, null-price display, archive, and an empty month.

## Known limitations

- `releases.source` is a short name; URLs live in `release_sources`.
- `POST /api/releases/sync` and `/api/releases/jobs/sync` are disabled: they require an admin email (`config/adminEmails.js`) and then return 410 without importing.
- The Topps calendar shows no date for products already released, so older Topps dates rely on secondary sources (flagged in the dry run).
