# Local Development Setup

## Copy Railway Environment Variables to Local .env

Since your Google OAuth credentials are in Railway, you need to copy them to your local `.env` file for development.

### Step 1: Get Your Railway Environment Variables

1. Go to your Railway dashboard: https://railway.app/
2. Select your Scorecard project
3. Go to the "Variables" tab
4. Copy these variables:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `JWT_SECRET` (or create a new one)
   - `SESSION_SECRET` (or create a new one)

### Step 2: Update Your Local .env File

Add these lines to your `.env` file in the backend directory:

```env
# Google OAuth Configuration (from Railway)
GOOGLE_CLIENT_ID=your_railway_google_client_id_here
GOOGLE_CLIENT_SECRET=your_railway_google_client_secret_here
GOOGLE_CALLBACK_URL=http://localhost:3001/api/auth/google/callback

# JWT Configuration
JWT_SECRET=1d569de31f5d30d8a634498f8ab217edfcce74b
SESSION_SECRET=another_random_secret_here

# Frontend URL
FRONTEND_URL=http://localhost:3000
```

### Step 3: Generate Session Secret (if needed)

If you don't have a SESSION_SECRET, generate one:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Step 4: Restart Your Backend

After updating your `.env` file:

```bash
# Stop the current server (Ctrl+C)
npm start
```

You should see:
```
🔐 Google OAuth strategy configured
```

### Step 5: Test Authentication

1. Start your frontend: `cd frontend && npm start`
2. Go to your app in the browser
3. Click "Login with Google"
4. Complete the OAuth flow
5. Try searching for a card
6. Check if the search appears in your search history

## Important Notes

- **Never commit your .env file** - it contains sensitive credentials
- **Use different secrets for local and production** - don't use the same JWT_SECRET
- **Update redirect URIs** - make sure your Google OAuth app has `http://localhost:3001/api/auth/google/callback` as an authorized redirect URI

## Troubleshooting

If you still see "Google OAuth credentials not found":
1. Check that the variable names match exactly (case-sensitive)
2. Make sure there are no extra spaces in your .env file
3. Restart the backend after making changes
4. Verify the credentials are correct by copying them from Railway

## Railway vs Local Development

- **Railway**: Uses production environment variables
- **Local**: Uses .env file for development
- **Both**: Need the same Google OAuth credentials but different secrets 