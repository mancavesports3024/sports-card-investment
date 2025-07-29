# Card Set API Testing Tools

This directory contains tools to test and visualize the card set suggestions API.

## 🚀 Quick Start

### 1. Start the Test Server
```bash
cd backend
node tools/test-card-set-api.js
```

This will start a test server on `http://localhost:3001`

### 2. Test the API

#### Option A: Command Line Testing
```bash
node tools/test-api-results.js
```

#### Option B: Visual Testing (Recommended)
Open `tools/test-api.html` in your web browser

## 📋 Available Tools

### `test-card-set-api.js`
- **Purpose**: Test server that mimics the card set suggestions API
- **Port**: 3001
- **Features**: 
  - Loads the database from `data/cardSetsDatabase.json`
  - Implements the same search logic as the real API
  - Provides detailed metadata about searches

### `test-api-results.js`
- **Purpose**: Command-line tool to test various search scenarios
- **Features**:
  - Tests multiple search queries automatically
  - Displays results in a readable format
  - Shows metadata and statistics

### `test-api.html`
- **Purpose**: Visual web interface for testing the API
- **Features**:
  - Quick test buttons for common searches
  - Custom search interface
  - Real-time results display
  - Beautiful, responsive UI

## 🔍 Test Endpoints

Once the test server is running, you can test these endpoints:

### Basic Test
```
GET http://localhost:3001/test
```

### Card Set Suggestions
```
GET http://localhost:3001/api/search-cards/card-set-suggestions?query=topps&limit=5
```

### Popular Sets (No Query)
```
GET http://localhost:3001/api/search-cards/card-set-suggestions?limit=10
```

## 📊 Example Searches to Test

1. **Brand Searches**:
   - `topps` - Find all Topps sets
   - `panini` - Find all Panini sets
   - `bowman` - Find all Bowman sets

2. **Set Type Searches**:
   - `chrome` - Find all Chrome sets
   - `prizm` - Find all Prizm sets
   - `heritage` - Find all Heritage sets

3. **Year Searches**:
   - `2025` - Find all 2025 sets
   - `2024` - Find all 2024 sets
   - `2023` - Find all 2023 sets

4. **Sport Searches**:
   - `baseball` - Find all baseball sets
   - `basketball` - Find all basketball sets
   - `hockey` - Find all hockey sets

5. **Combined Searches**:
   - `topps chrome 2025` - Find Topps Chrome 2025
   - `panini prizm basketball` - Find Panini Prizm basketball sets

## 📈 Expected Results

The API should return:
- **231 total card sets** in the database
- **4 brands**: Topps, Panini, Bowman, Upper Deck
- **3 sports**: Baseball, Basketball, Hockey
- **26 years**: 2000-2025
- **11 set types**: Base Set, Chrome Set, Prizm Set, etc.

## 🛠️ Troubleshooting

### Server Won't Start
- Make sure you're in the `backend` directory
- Check that `data/cardSetsDatabase.json` exists
- Ensure port 3001 is not in use

### No Results Returned
- Verify the database file exists and has data
- Check the search query format
- Look at the server console for error messages

### Browser Can't Connect
- Make sure the test server is running
- Check that you're using `http://localhost:3001`
- Try refreshing the page

## 📝 API Response Format

```json
{
  "suggestions": [
    {
      "id": "topps_series_one_2025",
      "name": "Topps Series One 2025",
      "brand": "Topps",
      "set": "Series One",
      "year": "2025",
      "sport": "Baseball",
      "league": "MLB",
      "setType": "Base Set",
      "cardCount": 400,
      "description": "Annual flagship baseball set featuring current MLB players",
      "releaseMonth": "February",
      "retailPrice": 4.99,
      "hobbyPrice": 89.99,
      "popularity": "High",
      "rookieCards": true,
      "inserts": ["Parallels", "Inserts", "Autographs", "Relics"],
      "variations": ["Photo Variations", "SP", "SSP"],
      "source": "manual",
      "lastUpdated": "2025-01-27"
    }
  ],
  "metadata": {
    "query": "topps",
    "limit": 5,
    "totalFound": 150,
    "returned": 5,
    "databaseSize": 231
  }
}
```

## 🎯 Next Steps

1. Test the API with various search queries
2. Verify the search logic works correctly
3. Check that all card sets are being found
4. Test the integration with the main application

Happy testing! 🧪 