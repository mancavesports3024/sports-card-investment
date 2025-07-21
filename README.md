# Sports Card Sales Tracker

A React application that fetches and analyzes recent eBay sales of sports cards, categorizing them by grade (raw, PSA 9, PSA 10) and providing price analysis.

## Features

- 🔍 Search for sports cards on eBay
- 📊 Categorize results by grade (raw, PSA 9, PSA 10)
- 💰 Price analysis with averages and comparisons
- 📈 Investment insights and grade premiums
- 🔄 Automatic eBay token refresh
- 📱 Responsive design

## Setup

### 1. Backend Setup

1. Navigate to the backend directory:
```bash
cd ScoreCard/backend
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file based on `env.example`:
```bash
cp env.example .env
```

4. Configure your eBay API credentials in `.env`:

#### Option A: Manual Token (Simple)
```env
EBAY_AUTH_TOKEN=your_ebay_auth_token_here
```

#### Option B: Automatic Token Refresh (Recommended)
```env
EBAY_CLIENT_ID=your_ebay_client_id_here
EBAY_CLIENT_SECRET=your_ebay_client_secret_here
```

### 2. Getting eBay API Credentials

1. Go to [eBay Developer Portal](https://developer.ebay.com/my/keys)
2. Create a new application or use an existing one
3. Get your **Client ID** and **Client Secret**

### 3. Getting Your Initial Refresh Token

If you want automatic token refresh (recommended), you'll need to get an initial refresh token:

1. Set your Client ID and Secret in `.env`:
```env
EBAY_CLIENT_ID=your_client_id
EBAY_CLIENT_SECRET=your_client_secret
```

2. Get an authorization code by visiting:
```
https://auth.ebay.com/oauth2/authorize?client_id=YOUR_CLIENT_ID&response_type=code&redirect_uri=http://localhost:3001/auth/callback&scope=https://api.ebay.com/oauth/api_scope https://api.ebay.com/oauth/api_scope/sell.inventory
```

3. Copy the `code` parameter from the redirect URL

4. Run the helper script:
```bash
node get-refresh-token.js YOUR_AUTHORIZATION_CODE
```

5. Add the returned tokens to your `.env` file:
```env
EBAY_REFRESH_TOKEN=your_refresh_token
EBAY_AUTH_TOKEN=your_access_token
```

### 4. Frontend Setup

1. Navigate to the frontend directory:
```bash
cd ScoreCard/frontend
```

2. Install dependencies:
```bash
npm install
```

## Running the Application

### Start the Backend
```bash
cd ScoreCard/backend
npm start
```

The backend will:
- Start on port 3001
- Automatically refresh your eBay token every 23 hours (if using refresh tokens)
- Provide API endpoints for card searching and rate limit checking

### Start the Frontend
```bash
cd ScoreCard/frontend
npm start
```

The frontend will start on port 3000 and connect to the backend API.

## API Endpoints

- `POST /api/search-cards` - Search for cards
- `GET /api/rate-limits` - Check eBay API limits
- `POST /api/refresh-token` - Manually refresh token
- `GET /api/token-status` - Check token status

## Token Management

### Automatic Refresh (Recommended)
If you set up `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET`, and `EBAY_REFRESH_TOKEN`:
- Tokens automatically refresh every 23 hours
- No manual intervention required
- Server logs will show refresh status

### Manual Token Updates
If you only set `EBAY_AUTH_TOKEN`:
- You'll need to manually update the token when it expires
- Tokens typically expire after 24 hours
- Use the `/api/refresh-token` endpoint or update the `.env` file

## Features

### Card Categorization
- **Raw Cards**: Ungraded cards (excludes PSA, BGS, SGC, etc.)
- **PSA 9**: Cards graded PSA 9
- **PSA 10**: Cards graded PSA 10

### Price Analysis
- Average prices for each category
- Price ranges (min/max)
- Grade premiums (raw → PSA 9, raw → PSA 10, PSA 9 → PSA 10)
- Investment insights

### Filtering
- Excludes "Pick" and "Complete" listings
- Filters out graded cards from raw category
- Handles Italian "valutata" (graded) terms

## Troubleshooting

### Token Issues
- Check that your credentials are correct in `.env`
- Verify your eBay application has the right scopes
- Use the `/api/token-status` endpoint to check token health

### Rate Limits
- eBay has daily limits (~5,000 calls/day)
- Use `/api/rate-limits` to check current usage
- The app includes fallback logic for rate-limited APIs

### No Results
- Try broader search terms
- Check that your token has the right permissions
- Verify the card exists and has recent sales

## Development

### Project Structure
```
ScoreCard/
├── backend/
│   ├── index.js              # Main server file
│   ├── routes/
│   │   └── searchCards.js    # Card search endpoint
│   ├── services/
│   │   └── ebayService.js    # eBay API integration
│   └── get-refresh-token.js  # Token setup helper
├── frontend/
│   ├── src/
│   │   ├── App.js           # Main React component
│   │   └── App.css          # Styles
│   └── package.json
└── README.md
```

## License

MIT License 