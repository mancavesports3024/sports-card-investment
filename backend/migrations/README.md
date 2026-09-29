# Database Migrations

This directory contains SQL migration scripts for the releases database.

## Running Migrations

**Manual execution** (until automated migration system is implemented):

```bash
# Connect to Railway PostgreSQL
psql $DATABASE_URL -f migrations/001_add_release_verification_fields.sql
```

## Migration Files

- `001_add_release_verification_fields.sql` - Add source tracking and verification metadata to releases table

## Migration Strategy

Currently, migrations are applied manually. The project uses `CREATE TABLE IF NOT EXISTS` for initial schema setup in `releaseDatabaseService.js`, but schema changes should be applied via numbered migration files.

**Recommended**: Implement a migration tracking system (e.g., using a `schema_migrations` table) to track which migrations have been applied.
