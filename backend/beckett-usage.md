# Beckett Parallel Scraper Usage Guide

This tool allows you to automatically scrape card parallels from Beckett and integrate them into your extraction patterns.

## Files Created:

1. **`beckett-parallel-scraper.js`** - Core scraping functionality
2. **`beckett-integration.js`** - Integration with your extraction patterns
3. **`beckett-usage.md`** - This usage guide

## How to Use:

### 1. Generate a Report (Recommended First Step)
```bash
node beckett-integration.js report
```
This will scrape parallels for multiple card sets and save them to `beckett-parallels-report.txt` for review.

### 2. Integrate Parallels for a Single Set
```bash
node beckett-integration.js integrate "2023 Panini Prizm Football"
```
This will scrape parallels for the specified set and automatically add them to your extraction patterns.

### 3. Batch Integrate Multiple Sets
```bash
node beckett-integration.js batch
```
This will process multiple card sets and integrate all their parallels.

## Example Card Sets to Try:

- `2023 Panini Prizm Football`
- `2023 Topps Chrome Baseball`
- `2023 Bowman Chrome Baseball`
- `2023 Panini Select Football`
- `2023 Topps Chrome Update Baseball`
- `2023 Topps Heritage Baseball`
- `2023 Panini Mosaic Football`
- `2023 Topps Finest Baseball`

## What It Does:

1. **Searches Beckett** for the specified card set
2. **Scrapes parallel information** from the set pages
3. **Generates regex patterns** for each parallel
4. **Integrates patterns** into your `create-new-pricing-database.js` file
5. **Maintains proper formatting** and priority ordering

## Safety Features:

- **Rate limiting** - 2-3 second delays between requests
- **Error handling** - Graceful failure if Beckett is unavailable
- **Duplicate prevention** - Won't add patterns that already exist
- **Backup** - Always review before committing changes

## Output:

The tool will:
- Show progress in the console
- Generate a report file (`beckett-parallels-report.txt`)
- Update your extraction patterns automatically
- Provide a summary of what was added

## Tips:

1. **Start with a report** to see what parallels are available
2. **Test with one set first** before doing batch operations
3. **Review the generated patterns** before committing
4. **Run the rebuild script** after integration to apply changes

## Example Output:

```
🚀 Starting Beckett parallel scraper...

📦 Processing: 2023 Panini Prizm Football
🔍 Searching Beckett for: 2023 Panini Prizm Football
📋 Found 3 potential set matches
🔍 Scraping parallels from: https://www.beckett.com/cards/...
📊 Found 45 unique parallels
✅ Scraped 45 parallels for 2023 Panini Prizm Football

📋 Results Summary:
==================
2023 Panini Prizm Football:
Found 45 parallels
Sample parallels: Gold Prizm, Silver Prizm, Black Prizm, Green Prizm, Blue Prizm
```

## Troubleshooting:

- **No parallels found**: Beckett might have changed their site structure
- **Network errors**: Check your internet connection
- **Rate limiting**: Beckett might be blocking requests - wait and try again
- **Pattern errors**: Review the generated patterns for special characters

## Next Steps:

After running the scraper:
1. Review the generated patterns
2. Commit the changes to git
3. Push to trigger deployment
4. Run the rebuild script to apply to your database
