# Brief — Add the 4 missing releases + build a release-admin page
Approved by Carl, Nov 14, 2026. Supersedes `release-calendar-add-4-missing.md` (the 4 entries' data is unchanged and carried in full below). For ChatGPT → Cursor, Mancave Sports Cards site (Railway backend `web-production-9efa.up.railway.app`, frontend mancavesportscardsllc.com).

## Problem
1. The release calendar is missing 4 verified releases (data in Part 1). Production count is 156; it should be 160.
2. There is no way to manage releases on the site. Verified Nov 14, 2026, signed in as an admin user in the owner's browser: the only admin pages are `/admin/cards` and `/admin/collections`; `/admin/releases` and all variants return Page Not Found; the calendar shows no add/edit controls even for an admin. The Nov 8 cleanup could only be applied by script. Going forward the calendar gets a small manual update most weeks, so an admin page is needed.

## Part 1 — Add the 4 missing releases
Exact values, no decisions left. All four are past releases: status "Released". Dates and prices verified Nov 14, 2026 against Topps / Checklist Insider / Topps Ripped (published list/presale prices only). Dry-run first: search existing releases by title before each insert; if a title already exists, skip it and report — never create a duplicate.

```json
[
  {
    "title": "2026 Topps Update Series Baseball",
    "brand": "Topps",
    "sport": "Baseball",
    "releaseDate": "2026-10-14",
    "year": "2026",
    "description": "Final flagship release of 2026. 350-card base set; hobby boxes include one autograph or relic.",
    "retailPrice": "Value Blaster $24.99",
    "hobbyPrice": "$119.99",
    "source": "Topps",
    "status": "Released",
    "createdBy": "release-calendar-fix"
  },
  {
    "title": "2026 Topps Holiday Baseball",
    "brand": "Topps",
    "sport": "Baseball",
    "releaseDate": "2026-10-21",
    "year": "2026",
    "description": "Holiday-themed flagship design. 200-card base set with Hidden Elf variations; Mega, Tin and Advent Calendar formats.",
    "retailPrice": "Mega $29.99, Tin $44.99, Advent Calendar $59.99",
    "hobbyPrice": null,
    "source": "Topps",
    "status": "Released",
    "createdBy": "release-calendar-fix"
  },
  {
    "title": "2026-27 Topps Flagship Basketball",
    "brand": "Topps",
    "sport": "Basketball",
    "releaseDate": "2026-11-05",
    "year": "2026",
    "description": "300-card base set. Hobby boxes include one autograph or relic; headlined by the 2026 rookie class.",
    "retailPrice": "Mega $59.99",
    "hobbyPrice": "$169.99",
    "source": "Topps",
    "status": "Released",
    "createdBy": "release-calendar-fix"
  },
  {
    "title": "2026 Topps Inception Football",
    "brand": "Topps",
    "sport": "Football",
    "releaseDate": "2026-11-06",
    "year": "2026",
    "description": "First NFL-licensed Inception since 2015. 200-card base set; one pack of 7 cards per hobby box with one autograph.",
    "retailPrice": null,
    "hobbyPrice": "$379.99",
    "source": "Topps",
    "status": "Released",
    "createdBy": "release-calendar-fix"
  }
]
```

Source notes: Update — Oct 14 per Topps product page; hobby $119.99 is Checklist Insider's release price (presale was $109.99). Holiday — Oct 21 on Topps' calendar and Checklist Insider; format prices per Topps Ripped. Flagship Basketball — Topps moved it Oct 22 → Nov 5; prices are Topps presale. Inception — Hobby Nov 6 per Topps and Checklist Insider (First Day Issue was Oct 30 — do NOT use); hobby $379.99 is the release-day price (presale $369.99).

## Part 2 — Release-admin page at /admin/releases
- Same admin gating as the existing `/admin/cards` and `/admin/collections` pages — reuse the existing admin guard/pattern exactly. Non-admins get whatever those pages give non-admins; release data must never be editable without admin auth. (Context: unauthenticated `POST /api/releases` already returns 401 "Unauthorized - Admin access required".)
- List view: all releases, newest date first, showing date, title, brand, sport, status, retail price, hobby price; text search by title.
- Add form with fields matching the existing release schema exactly: title, brand, sport, releaseDate (date input), year, description (textarea), retailPrice (optional text), hobbyPrice (optional text), imageUrl (optional), source. Prices are free-text and must save verbatim (e.g. "Mega $29.99, Tin $44.99, Advent Calendar $59.99"). Status follows the existing convention (Upcoming for a future date, Released otherwise) — do not add a status control unless the schema requires one.
- Edit: same form prefilled, all fields editable — release dates move often, so date editing is the primary use case. Delete: available, behind a confirm prompt.
- API: wire the form to the existing admin-guarded `POST /api/releases` using the signed-in session. Check whether update/delete endpoints for a release already exist; if not, add them with the same admin guard. Rows created through the UI record `createdBy` as the signed-in user's email.
- Match the existing admin pages' styling and components. No changes to the public calendar page or the other admin pages. No schema changes unless update/delete truly requires one — prefer none.

## Suggested order
Build Part 2 first and prove it with a throwaway test entry (add → edit its date → delete), then add the 4 real entries from Part 1 through the finished form (with the same title-check before each). If the form hits a blocker, fall back to adding the 4 by script with `createdBy: "release-calendar-fix"` and report the form as not done — do not leave the 4 unadded because of the form.

## Definition of done
1. `GET /api/releases` count is 160; the 4 Part 1 titles are present with the exact dates above; no duplicates.
2. Browser end-to-end test as an admin: `/admin/releases` loads; a throwaway entry added through the form appears in the admin list and on the public calendar; editing its date moves it on the public calendar; deleting it removes it from both. Logged-out visit to `/admin/releases` grants no access.
3. Admin page checked on desktop and mobile widths.
4. Tony verifies live after deploy: API count and titles, public-calendar spot check, and the admin page in the owner's browser.

## Constraints
- Dates are stored as plain `YYYY-MM-DD` exactly like existing rows — no timezone conversion (a date shifting by a day is a known failure mode on this calendar).
- No public-site behavior changes beyond the 4 new entries appearing.
- Keep it minimal: reuse existing patterns, no new dependencies if avoidable.
