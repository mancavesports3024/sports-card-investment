# Centralized Filtering Documentation

This document explains where the centralized filtering logic lives and how it's applied across the ScoreCard application.

## Overview

The filtering system is designed to remove card-related terms, team names, cities, and other non-player content from card titles when extracting player names. The filtering logic is centralized in two main locations to ensure consistency.

## Primary Filtering Locations

### 1. `backend/create-new-pricing-database.js`

This is the main file containing the `NewPricingDatabase` class with the `extractPlayerName` method.

#### Key Components:

**A. `extractPlayerName` Method (Lines ~2400-2600)**
- **Purpose**: Main player name extraction function
- **Filtering**: Uses `stopWords` set to filter out unwanted terms
- **Location**: Within the `NewPricingDatabase` class

**B. `stopWords` Set (Lines ~2450-2500)**
- **Purpose**: Comprehensive list of terms to filter out during extraction
- **Contents**: Card brands, set types, parallels, team names, cities, grading terms
- **Usage**: Applied during the word-by-word filtering step in `extractPlayerName`

**C. `filterTeamNamesFromPlayer` Method (Lines ~2600-2700)**
- **Purpose**: Secondary filtering function specifically for team names and cities
- **Contents**: Comprehensive list of team names, cities, and card-related terms
- **Usage**: Called as a cleanup step after initial extraction

#### Example Usage in `extractPlayerName`:
```javascript
// Step 3: Filter out stop words
const words = title.split(/\s+/).filter(word => 
    !this.stopWords.has(word.toLowerCase())
);

// Later in the function:
playerName = this.filterTeamNamesFromPlayer(playerName);
```

### 2. `backend/card-filtering-terms.md`

This is the **source of truth** document containing all filtering terms.

#### Purpose:
- **Reference**: Contains comprehensive lists of all terms that should be filtered
- **Maintenance**: Single location to update when new terms need to be added
- **Documentation**: Explains what each category of terms represents

#### Categories:
- Card Brands and Companies
- Card Set Types and Brands  
- Parallel and Insert Types
- Card Features and Grading
- Team Names (NFL, MLB, NBA, NHL, College, Soccer)
- City Names
- Sport Terms
- Grading Terms

## How Filtering is Applied

### 1. During Player Name Extraction

The filtering happens in multiple stages within `extractPlayerName`:

1. **Initial Cleaning**: Remove numbers, special characters, basic formatting
2. **Word Splitting**: Split title into individual words
3. **Stop Words Filtering**: Remove words that match `stopWords` set
4. **Team Name Filtering**: Apply `filterTeamNamesFromPlayer` as final cleanup
5. **Known Players Mapping**: Apply corrections for specific player names

### 2. Filtering Logic Flow

```javascript
// 1. Split title into words
const words = title.split(/\s+/);

// 2. Filter out stop words
const filteredWords = words.filter(word => 
    !this.stopWords.has(word.toLowerCase())
);

// 3. Join remaining words
let playerName = filteredWords.join(' ');

// 4. Apply team name filtering
playerName = this.filterTeamNamesFromPlayer(playerName);

// 5. Apply known players corrections
if (this.knownPlayers[playerName.toLowerCase()]) {
    playerName = this.knownPlayers[playerName.toLowerCase()];
}
```

## Maintenance and Updates

### Adding New Filtering Terms

1. **Update Source Document**: Add new terms to `card-filtering-terms.md`
2. **Update Implementation**: Add terms to both:
   - `stopWords` set in `extractPlayerName`
   - `teamNames` array in `filterTeamNamesFromPlayer`
3. **Test**: Run extraction tests to verify filtering works
4. **Deploy**: Push changes to production

### Example: Adding a New Card Brand

```javascript
// In card-filtering-terms.md
- newcardbrand

// In create-new-pricing-database.js
// Add to stopWords set:
this.stopWords.add('newcardbrand');

// Add to filterTeamNamesFromPlayer:
const teamNames = [
    // ... existing terms ...
    'newcardbrand'
];
```

## Testing and Validation

### Testing Endpoints

1. **Re-extraction**: `/api/admin/reextract-player-names` (POST)
   - Applies filtering to all cards in database
   - Returns count of updated vs unchanged records

2. **Analysis**: `/api/admin/analyze-player-names` (POST)
   - Analyzes extracted names for problematic patterns
   - Identifies names that still contain filtered terms

3. **Sample Cards**: `/api/admin/cards` (GET)
   - Returns sample cards for manual inspection

### Validation Process

1. Run re-extraction on production
2. Run analyzer to check for remaining issues
3. Review problematic names manually
4. Update filtering terms if needed
5. Repeat process

## Common Issues and Solutions

### Issue: Terms Still Appearing in Player Names

**Cause**: Terms not added to both `stopWords` and `filterTeamNamesFromPlayer`
**Solution**: Ensure terms are added to both locations

### Issue: Legitimate Player Names Being Filtered

**Cause**: Overly broad filtering terms
**Solution**: Add exceptions to `knownPlayers` mapping or refine filtering terms

### Issue: Inconsistent Filtering

**Cause**: Terms only added to one filtering location
**Solution**: Always update both `stopWords` and `filterTeamNamesFromPlayer`

## Best Practices

1. **Always update both locations**: `stopWords` and `filterTeamNamesFromPlayer`
2. **Use the source document**: Reference `card-filtering-terms.md` for comprehensive lists
3. **Test thoroughly**: Run extraction and analysis after any changes
4. **Document exceptions**: Use `knownPlayers` for legitimate names that might be filtered
5. **Review regularly**: Periodically check for new terms that need filtering

## File Locations Summary

- **Main Implementation**: `backend/create-new-pricing-database.js`
  - `extractPlayerName` method (lines ~2400-2600)
  - `stopWords` set (lines ~2450-2500)
  - `filterTeamNamesFromPlayer` method (lines ~2600-2700)

- **Source of Truth**: `backend/card-filtering-terms.md`
  - Comprehensive lists of all filtering terms
  - Categorized by type and sport

- **Testing Endpoints**: `backend/index.js`
  - `/api/admin/reextract-player-names`
  - `/api/admin/analyze-player-names`
  - `/api/admin/cards`
