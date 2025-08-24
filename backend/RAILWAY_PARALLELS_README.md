# Railway Parallels Database System

This system creates and manages a parallels database on Railway PostgreSQL that maps card sets to their known parallels.

## 🚀 Quick Start

### 1. Initialize the Database
```bash
# Deploy to Railway and call the initialize endpoint
POST /api/parallels/initialize
```

### 2. Load Parallels Data
```bash
# Run the loader script (will work on Railway)
node add-parallels-to-railway.js
```

## 📊 Database Schema

### Card Sets Table
- `id` - Primary key
- `set_name` - Card set name (unique)
- `sport` - Sport (Baseball, Football, etc.)
- `year` - Year of the set
- `brand` - Card brand (Topps, Panini, etc.)
- `source` - Data source
- `created_at` - Creation timestamp
- `updated_at` - Last update timestamp

### Parallels Table
- `id` - Primary key
- `set_id` - Foreign key to card_sets
- `parallel_name` - Name of the parallel
- `parallel_type` - Type (Parallel, Insert, Variation)
- `rarity` - Rarity level (Standard, Limited)
- `print_run` - Print run information
- `source` - Data source
- `created_at` - Creation timestamp

## 🔧 API Endpoints

### Initialize Database
```http
POST /api/parallels/initialize
```
Creates the database tables on Railway.

### Get All Card Sets
```http
GET /api/parallels/card-sets
```
Returns all card sets with parallel counts.

### Get Parallels for a Set
```http
GET /api/parallels/parallels/:setName
```
Returns all parallels for a specific card set.

### Add New Card Set
```http
POST /api/parallels/card-sets
Content-Type: application/json

{
  "setName": "2023 Panini Prizm Football",
  "sport": "Football",
  "year": "2023",
  "brand": "Panini"
}
```

### Add New Parallel
```http
POST /api/parallels/parallels
Content-Type: application/json

{
  "setName": "2023 Panini Prizm Football",
  "parallelName": "Blue Prizms",
  "parallelType": "Parallel",
  "rarity": "Standard",
  "printRun": null
}
```

### Search Parallels
```http
GET /api/parallels/search/:searchTerm
```
Search for parallels by name or card set name.

## 📚 Included Card Sets

### 2023 Panini Prizm Football
- 19 parallels including Blue Prizms, Silver Prizms, Gold Prizms, etc.
- Includes numbered parallels like Gold Prizms (/10), Black Finite Prizms (1/1)

### 2023 Topps Heritage Baseball
- 26 parallels including Chrome variants, Mini variants, Clubhouse Collection
- Includes inserts like Real One Autograph, variations like Black and White Image Variation

### 2023 Topps Chrome Baseball
- 13 parallels including Refractor variants, Aqua Geometric, Radiation Rookies

### 2023 Panini Select Football
- 18 parallels including Concourses, Sublime, Zone Busters Refractor

## 🔄 Integration with Extraction System

The parallels database can be integrated with your card extraction system to automatically identify card types from titles.

### Example Usage
```javascript
const RailwayParallelsDatabase = require('./railway-parallels-db.js');

const parallelsDb = new RailwayParallelsDatabase();
await parallelsDb.connectDatabase();

// Get parallels for a specific set
const parallels = await parallelsDb.getParallelsForSet('2023 Panini Prizm Football');

// Use parallels to improve card type extraction
parallels.forEach(parallel => {
  // Add to extraction patterns
  console.log(`Found parallel: ${parallel.parallel_name}`);
});
```

## 🛠️ Development

### Local Testing
```bash
# Set DATABASE_URL environment variable to your Railway PostgreSQL connection
export DATABASE_URL="postgresql://username:password@host:port/database"

# Test the database connection
node test-railway-parallels.js

# Load parallels data
node add-parallels-to-railway.js
```

### Adding New Card Sets
1. Add the card set data to `add-parallels-to-railway.js`
2. Run the loader script
3. The data will be available via API endpoints

## 🚀 Deployment

1. Deploy to Railway
2. Call `/api/parallels/initialize` to create tables
3. Run `node add-parallels-to-railway.js` to load data
4. Use API endpoints to manage parallels

## 📈 Benefits

- **Centralized Data**: All parallels in one PostgreSQL database
- **API Access**: RESTful endpoints for easy integration
- **Scalable**: Can handle thousands of card sets and parallels
- **Production Ready**: Runs on Railway with proper error handling
- **Extensible**: Easy to add new card sets and parallels
