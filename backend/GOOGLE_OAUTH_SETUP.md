# Google OAuth Setup Guide for Scorecard

## Why You Need This
Your search history isn't being saved because Google OAuth authentication isn't configured. This guide will help you set it up.

## Step 1: Create Google OAuth Credentials

### 1. Go to Google Cloud Console
- Visit: https://console.cloud.google.com/
- Sign in with your Google account

### 2. Create a New Project (or select existing)
- Click on the project dropdown at the top
- Click "New Project" or select an existing one
- Name it something like "Scorecard App"

### 3. Enable Google+ API
- Go to "APIs & Services" > "Library"
- Search for "Google+ API" or "Google Identity"
- Click on it and click "Enable"

### 4. Create OAuth 2.0 Credentials
- Go to "APIs & Services" > "Credentials"
- Click "Create Credentials" > "OAuth 2.0 Client IDs"
- Choose "Web application"
- Name: "Scorecard Web Client"

### 5. Configure OAuth Consent Screen
- If prompted, configure the OAuth consent screen:
  - User Type: External
  - App name: "Scorecard"
  - User support email: Your email
  - Developer contact information: Your email

### 6. Add Authorized Redirect URIs
Add these redirect URIs:
- `http://localhost:3001/api/auth/google/callback` (for development)
- `https://your-production-domain.com/api/auth/google/callback` (for production)

### 7. Get Your Credentials
- After creating, you'll get:
  - **Client ID** (looks like: `123456789-abcdefghijklmnop.apps.googleusercontent.com`)
  - **Client Secret** (looks like: `GOCSPX-abcdefghijklmnopqrstuvwxyz`)

## Step 2: Update Your .env File

Add these lines to your `.env` file in the backend directory:

```env
# Google OAuth Configuration
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
GOOGLE_CALLBACK_URL=http://localhost:3001/api/auth/google/callback

# JWT Configuration
JWT_SECRET=your_jwt_secret_here_make_it_long_and_random

# Session Configuration
SESSION_SECRET=your_session_secret_here_make_it_long_and_random

# Frontend URL
FRONTEND_URL=http://localhost:3000
```

## Step 3: Generate Secure Secrets

For JWT_SECRET and SESSION_SECRET, you can generate secure random strings:

### Option 1: Use Node.js
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Option 2: Use Online Generator
- Visit: https://generate-secret.vercel.app/64
- Copy the generated string

## Step 4: Restart Your Backend

After updating your `.env` file:

```bash
# Stop the current server (Ctrl+C)
cd ScoreCard/backend
npm start
```

You should see:
```
🔐 Google OAuth strategy configured
```

## Step 5: Test Authentication

1. Start your frontend:
```bash
cd ScoreCard/frontend && npm start
```
2. Go to your app in the browser
3. Click "Login with Google"
4. Complete the OAuth flow
5. Try searching for a card
6. Check if the search appears in your search history

## Troubleshooting

### "Google OAuth credentials not found"
- Make sure your `.env` file has GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET
- Check for typos in the variable names
- Restart the backend after making changes

### "Redirect URI mismatch"
- Make sure the redirect URI in Google Console matches exactly
- Include the full URL with protocol (http:// or https://)

### "Invalid client"
- Double-check your Client ID and Client Secret
- Make sure you copied them correctly from Google Console

## Production Deployment

For production, update these in your `.env` file:
- `GOOGLE_CALLBACK_URL=https://your-domain.com/api/auth/google/callback`
- `FRONTEND_URL=https://your-domain.com`

## Security Notes

- Never commit your `.env` file to version control
- Keep your Client Secret secure
- Use strong, random secrets for JWT_SECRET and SESSION_SECRET
- In production, use HTTPS for all OAuth callbacks

## Need Help?

If you're still having issues:
1. Check the backend console for error messages 