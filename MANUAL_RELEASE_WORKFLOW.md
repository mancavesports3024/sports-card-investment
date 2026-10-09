# Manual Release Calendar Workflow

**Purpose**: Document the practical workflow for maintaining release dates without automated scraping.

---

## Setup Requirements

### 1. Database Migration

Run the schema migration to add verification fields:

```bash
psql $DATABASE_URL -f backend/migrations/001_add_release_verification_fields.sql
```

### 2. Admin Configuration

Set the `ADMIN_EMAILS` environment variable with authorized admin emails (comma-separated):

```bash
# Railway / Vercel
ADMIN_EMAILS="owner@mancavesportscardsllc.com,admin@example.com"
```

**Security**: Without this configured, ALL write endpoints (`/manual-add`, `/verify`, `/unverified`) will be blocked (fail-safe).

---

## Adding Releases

### Option 1: Interactive CLI Script (Recommended)

```bash
# From project root
export DATABASE_URL="postgresql://..."
node backend/scripts/add-release.js
```

Follow the prompts to enter:
- Title, release date, brand, sport, year, description, prices
- **Source URL** (where you verified the date)
- **Date Status** (confirmed/estimated/tbd)
- **Verification notes** (optional context)

### Option 2: API Call (for programmatic access)

**Endpoint**: `POST /api/releases/manual-add`

**Authentication**: Requires Google OAuth login + admin email in `ADMIN_EMAILS`

**Request**:
```bash
curl -X POST https://your-site.com/api/releases/manual-add \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{
    "title": "2027 Topps Series 1",
    "releaseDate": "2027-02-15",
    "brand": "Topps",
    "sport": "Baseball",
    "year": "2027",
    "sourceUrl": "https://cardboardconnection.com/topps-series-1-2027",
    "dateStatus": "estimated",
    "verificationNotes": "Date from Cardboard Connection release calendar"
  }'
```

---

## Verifying Releases

### Check Unverified Releases

**Endpoint**: `GET /api/releases/unverified`

Returns releases with `date_status = 'estimated'` and not verified in last 30 days.

**Request**:
```bash
curl https://your-site.com/api/releases/unverified \
  -H "Cookie: your-session-cookie"
```

### Update Verification

**Endpoint**: `PATCH /api/releases/:id/verify`

**Request**:
```bash
curl -X PATCH https://your-site.com/api/releases/123/verify \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{
    "sourceUrl": "https://www.topps.com/announcement",
    "dateStatus": "confirmed",
    "verificationNotes": "Verified from official Topps announcement"
  }'
```

---

## Weekly Review Process

**Schedule**: Every Sunday (replaces automated scraper)

1. **Check Aggregators** (manual browser inspection):
   - Bleacher Seats Collectibles: https://bleacherseatscollectibles.com/release-calendar/
   - Cardboard Connection: https://www.cardboardconnection.com/sports-card-release-dates
   - Beckett: https://www.beckett.com/news/

2. **Cross-Reference Manufacturers** (when announcements available):
   - Topps social media / blog
   - Panini social media / blog
   - Upper Deck blog RSS: https://upperdeckblog.com/feed/

3. **Add New Releases**:
   ```bash
   node backend/scripts/add-release.js
   ```

4. **Update Existing** (if dates confirmed):
   ```bash
   curl -X PATCH .../api/releases/{id}/verify -d '{...}'
   ```

---

## Date Status Guidelines

| Status | When to Use | Source Example |
|--------|-------------|----------------|
| **`confirmed`** | Manufacturer announced specific date | Official Topps press release with date |
| **`estimated`** | Reliable aggregator or industry source | Cardboard Connection, Beckett calendar |
| **`tbd`** | Product announced but no date set | "Coming Spring 2027" announcements |

**Default**: Use `estimated` for aggregator sources; only use `confirmed` when manufacturer explicitly states the date.

---

## Security Notes

- **Authentication**: All write endpoints require Google OAuth login
- **Authorization**: Only emails in `ADMIN_EMAILS` can access write endpoints
- **Fail-Safe**: If `ADMIN_EMAILS` is empty, ALL admin endpoints return 403
- **Read Access**: Public read access remains open (`GET /api/releases`)

---

## Frontend Display

Releases display with visual indicators:

- 🟡 **Orange "estimated"** - From reliable aggregator, not yet manufacturer-confirmed
- ⚪ **Gray "tbd"** - Product announced, no specific date
- ✅ **No indicator** - Confirmed date (manufacturer verified)

---

## Troubleshooting

### "Admin access not configured"

**Cause**: `ADMIN_EMAILS` environment variable not set  
**Fix**: Add `ADMIN_EMAILS` to Railway/Vercel environment variables

### "Authentication required"

**Cause**: Not logged in with Google OAuth  
**Fix**: Visit `/` and sign in with Google

### "Admin access required"

**Cause**: Your email is not in `ADMIN_EMAILS`  
**Fix**: Add your email to the `ADMIN_EMAILS` environment variable

### Migration errors

**Cause**: Migration not run or database connection issue  
**Fix**: Run `psql $DATABASE_URL -f backend/migrations/001_add_release_verification_fields.sql`

---

## Future Improvements

1. **Admin UI**: Build a web-based admin panel for adding/verifying releases
2. **Manufacturer APIs**: Monitor for official API releases from Topps/Panini/Fanatics
3. **Import Tool**: CSV import for bulk release additions
4. **Notification System**: Email reminders for weekly review
5. **Verification Tracking**: Dashboard showing verification status and age
