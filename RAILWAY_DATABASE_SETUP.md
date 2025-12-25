# Railway PostgreSQL Database Setup

## Current Issue
You have a PostgreSQL service on Railway but need to ensure it's properly connected to your web service.

## Steps to Set Up Database

### 1. Check PostgreSQL Service
- In Railway dashboard, you should see a "Postgres" service
- It should show "Online" status

### 2. Connect Web Service to Postgres
1. Go to your **Web** service in Railway
2. Click on the **"Variables"** tab
3. Look for `DATABASE_URL` - it should be automatically added when you connect the services
4. If `DATABASE_URL` is missing:
   - Go to your **Postgres** service
   - Click on the **"Variables"** tab  
   - Copy the `DATABASE_URL` value
   - Go back to **Web** service → **Variables**
   - Add `DATABASE_URL` and paste the value

### 3. Alternative: Use Railway's Service Connection
1. In your **Web** service dashboard
2. Click **"Settings"** → **"Generate Domain"** (if not already done)
3. Go to **"Variables"** tab
4. Railway should automatically provide `DATABASE_URL` if services are connected
5. If not, manually add it from the Postgres service

### 4. Verify Connection
Once `DATABASE_URL` is set, the database should work. Railway PostgreSQL automatically:
- Creates a default database
- Sets up the connection string
- Provides SSL certificates

### 5. Initialize Tables
After `DATABASE_URL` is configured, call:
```
POST https://web-production-9efa.up.railway.app/api/releases/init
```

This will create the `releases` and `release_sources` tables.

## Quick Check
Run this to see if DATABASE_URL is set:
```
GET https://web-production-9efa.up.railway.app/api/releases/test-db
```

If it returns `hasDatabaseUrl: false`, then `DATABASE_URL` needs to be added to your Web service variables.

