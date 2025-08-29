# Centralized Player Name Extraction System

## Overview
This is the **centralized player name filtering system** for the ScoreCard application. It uses a simple, modular 6-step approach to extract player names from card titles by systematically removing non-player terms.

## Core Philosophy
- **Simple and Modular**: 6 distinct steps, each with a single responsibility
- **Easy to Debug**: Each step logs its output for transparency
- **Maintainable**: Clear separation of concerns with dedicated filtering arrays
- **Comprehensive**: Extensive filtering terms covering all major card types and sports

## File Structure
```
backend/
├── simple-player-extraction.js     # Main extraction class
├── test-simple-extraction.js       # Test harness
├── card-filtering-terms.md         # Comprehensive filtering terms reference
└── README-Player-Extraction.md     # This documentation
```

## How It Works

### The 6-Step Process
1. **Remove Year** - Strips years (19xx or 20xx)
2. **Remove Card Set Terms** - Removes brands, series, and card set names
3. **Remove Card Type Terms** - Removes card types, colors, parallels, and features
4. **Remove Team/League/City Terms** - Removes team names, cities, leagues, and sports
5. **Remove Grading Terms** - Removes grading companies and conditions
6. **Remove Card Numbers** - Removes card numbers, print runs, and identifiers

### Example Flow
```
Input: "2024 Panini Prizm Malik Nabers Los Angeles Chargers Blue Ice #19 /99 PSA 10"

Step 1: Remove Year
→ "  Panini Prizm Malik Nabers Los Angeles Chargers Blue Ice #19 /99 PSA 10"

Step 2: Remove Card Set Terms  
→ "      Malik Nabers Los Angeles Chargers     #19 /99 PSA 10"

Step 3: Remove Card Type Terms
→ "      Malik Nabers Los Angeles Chargers     #19 /99 PSA 10"

Step 4: Remove Team/League/City Terms
→ "      Malik Nabers       #19 /99 PSA 10"

Step 5: Remove Grading Terms
→ "      Malik Nabers       #19 /99    "

Step 6: Remove Card Numbers
→ "      Malik Nabers               "

Final Result: "Malik Nabers"
```

## Usage

### Basic Usage
```javascript
const SimplePlayerExtractor = require('./simple-player-extraction.js');
const extractor = new SimplePlayerExtractor();

const playerName = extractor.extractPlayerName("2024 Panini Prizm Malik Nabers Blue Ice #19 /99 PSA 10");
console.log(playerName); // "Malik Nabers"
```

### Integration with Existing Code
Replace any existing player name extraction logic with calls to this centralized system:

```javascript
// OLD: Complex extraction logic
// const playerName = complexExtractPlayerName(title);

// NEW: Centralized extraction
const SimplePlayerExtractor = require('./simple-player-extraction.js');
const extractor = new SimplePlayerExtractor();
const playerName = extractor.extractPlayerName(title);
```

## Filtering Categories

### 1. Card Set Terms (Step 2)
- **Major Brands**: topps, panini, donruss, bowman, upper deck, fleer, score, leaf
- **Card Series**: chrome, prizm, optic, mosaic, select, heritage, stadium club
- **Special Editions**: immaculate, national treasures, flawless, obsidian
- **Additional Terms**: 200+ comprehensive card set and brand terms

### 2. Card Type Terms (Step 3)
- **Basic Types**: rookie, auto, autograph, patch, relic, parallel, insert, base
- **Colors & Parallels**: blue ice, gold, silver, black, red, blue, green, yellow
- **Special Features**: holo, refractor, die-cut, cracked ice, stained glass
- **Additional Terms**: 100+ card type and feature terms

### 3. Team/League/City Terms (Step 4)
- **NFL Teams**: All 32 teams (buffalo bills, miami dolphins, etc.)
- **MLB Teams**: All 30 teams (new york yankees, boston red sox, etc.)
- **NBA Teams**: All 30 teams (atlanta hawks, boston celtics, etc.)
- **NHL Teams**: All 32 teams (anaheim ducks, arizona coyotes, etc.)
- **College Teams**: Major college programs (duke, kentucky, north carolina, etc.)
- **Soccer Teams**: Major international clubs (liverpool, barcelona, real madrid, etc.)
- **Cities**: 100+ major city names
- **Leagues**: nfl, mlb, nba, nhl, ufc, mma, wwe, nascar, etc.

### 4. Grading Terms (Step 5)
- **Companies**: psa, bgs, beckett, sgc, csg, hga, gma
- **Conditions**: gem mint, mint, near mint, excellent, very good, good, fair, poor
- **Grades**: 10, 9, 8, 7, 6, 5, 4, 3, 2, 1
- **Additional**: graded, ungraded, pop, population, cert, certificate

### 5. Card Numbers (Step 6)
- **Basic Numbers**: #123, #456, etc.
- **Complex Numbers**: #BDC-168, #CDA-LK, etc.
- **Print Runs**: /99, /150, /499, etc.
- **Special Patterns**: BDP123, CDA-LK, DT36, BS3, TC264, MMR-54, etc.

## Testing

### Run Tests
```bash
cd backend
node test-simple-extraction.js
```

### Test Coverage
The test suite covers:
- Basic player name extraction
- Complex card titles with multiple terms
- Names with special characters (Ja'Marr Chase)
- Names with multiple words (Elly De La Cruz)
- Names that were previously problematic (Xavier Worthy, Malik Nabers)

### Adding New Tests
Edit `test-simple-extraction.js` to add new test cases:

```javascript
const testTitles = [
    // Existing tests...
    "2024 Your New Test Case Here #123 PSA 10"
];
```

## Maintenance

### Adding New Filtering Terms
1. **Identify the category** (card set, card type, team/league/city, grading)
2. **Add to the appropriate array** in `simple-player-extraction.js`
3. **Test thoroughly** to ensure legitimate player names aren't affected
4. **Update documentation** if needed

### Example: Adding a New Card Brand
```javascript
// In simple-player-extraction.js, add to cardSetTerms array:
this.cardSetTerms = [
    // Existing terms...
    'new brand name',  // Add here
    // More existing terms...
];
```

### Removing Problematic Terms
If a legitimate player name is being filtered out:

1. **Identify the problematic term** using the test suite
2. **Find which array contains it** using grep search
3. **Remove the term** from the appropriate array
4. **Test to confirm the fix**

Example:
```bash
# Search for problematic term
grep -i "problematic_term" backend/simple-player-extraction.js

# Remove from appropriate array and test
node test-simple-extraction.js
```

## Integration Points

### Database Operations
Use this system for:
- Processing new card listings
- Standardizing player names in existing records
- Data cleanup and normalization

### API Endpoints
Integrate with:
- Card listing creation/update endpoints
- Player search functionality
- Data import/export operations

### Frontend Integration
- Use extracted player names for consistent display
- Enable better search functionality
- Improve user experience with standardized naming

## Performance Considerations

### Efficiency
- **Regex Optimization**: Uses word boundary matching (`\b`) for precise term removal
- **Array Lookup**: O(n) complexity for term filtering
- **Memory Usage**: Minimal memory footprint with static arrays

### Scalability
- **Batch Processing**: Can handle large volumes of card titles
- **Caching**: Consider caching results for frequently processed titles
- **Parallel Processing**: Can be used in worker threads for high-volume operations

## Troubleshooting

### Common Issues

1. **Player name being filtered out**
   - Check if the name appears in any filtering arrays
   - Remove the term if it's a legitimate player name
   - Test with the test suite

2. **Incomplete extraction**
   - Verify all relevant terms are in the appropriate arrays
   - Check for new card brands or types not yet covered
   - Add missing terms to the appropriate category

3. **Performance issues**
   - Consider caching for repeated extractions
   - Optimize regex patterns if needed
   - Use batch processing for large datasets

### Debug Mode
The system includes built-in logging for each step. Enable debug output by running the test suite or adding console.log statements to see the intermediate results.

## Future Enhancements

### Potential Improvements
1. **Machine Learning**: Train models to improve accuracy
2. **Context Awareness**: Consider card context for better extraction
3. **Multi-language Support**: Extend to non-English card titles
4. **Real-time Updates**: Dynamic term updates based on new card releases

### Version Control
- **Semantic Versioning**: Follow semver for releases
- **Change Log**: Document all changes to filtering terms
- **Backward Compatibility**: Maintain compatibility with existing integrations

## Support

### Getting Help
1. **Check the test suite** for examples
2. **Review the filtering terms** in `card-filtering-terms.md`
3. **Run tests** to isolate issues
4. **Check recent changes** for potential regressions

### Contributing
1. **Test thoroughly** before making changes
2. **Document changes** in this README
3. **Update test cases** for new scenarios
4. **Follow the 6-step philosophy** for consistency

---

**Last Updated**: December 2024  
**Version**: 1.0.0  
**Maintainer**: ScoreCard Development Team
