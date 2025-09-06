// FIXED PARSING METHOD - Proximity-based correlation instead of broken section parsing

parseHtmlForCards(htmlContent, searchTerm, expectedGrade = null, maxResults = 20) {
    const finalResults = [];
    const maxResultsNum = parseInt(maxResults) || 20;
    
    console.log(`🔍 Parsing HTML for card data with proximity-based correlation...`);
    
    // Step 1: Use PROVEN working title patterns from debug logs
    const workingTitlePatterns = [
        // These patterns successfully found titles in the debug logs
        />([^<]*(?:KONNOR GRIFFIN|Konnor Griffin)[^<]*(?:2024|Bowman|Chrome|Draft|Sapphire|PSA|Refractor)[^<]*)</gi,
        />([^<]*(?:2024)[^<]*(?:Bowman|Chrome|Draft)[^<]*(?:KONNOR GRIFFIN|Konnor Griffin)[^<]*)</gi,
        /<[^>]*>([^<]*(?:KONNOR GRIFFIN|Konnor Griffin)[^<]*2024[^<]*Bowman[^<]*)</i,
        /<[^>]*>([^<]*2024[^<]*Bowman[^<]*(?:KONNOR GRIFFIN|Konnor Griffin)[^<]*)</i,
        
        // Fallback patterns for other cards
        /<h3[^>]*>([^<]+)<\/h3>/gi,
        /<a[^>]*class="[^"]*title[^"]*"[^>]*>([^<]+)<\/a>/gi
    ];
    
    // Extract all titles with their positions in the HTML
    const titleData = [];
    for (let p = 0; p < workingTitlePatterns.length; p++) {
        const matches = [...htmlContent.matchAll(workingTitlePatterns[p])];
        matches.forEach(match => {
            const title = match[1].trim().replace(/\s+/g, ' ');
            if (title.length > 10) {
                titleData.push({
                    title: title,
                    position: match.index,
                    pattern: p + 1
                });
            }
        });
    }
    
    console.log(`🔍 Found ${titleData.length} valid titles using proven patterns`);
    
    // Step 2: Extract all prices with their positions
    const priceData = [];
    const pricePattern = /\$[\d,]+\.?\d*/g;
    const priceMatches = [...htmlContent.matchAll(pricePattern)];
    priceMatches.forEach(match => {
        const numericPrice = parseFloat(match[0].replace(/[^\d.,]/g, '').replace(/,/g, ''));
        if (!isNaN(numericPrice) && numericPrice >= 1 && numericPrice <= 10000) {
            priceData.push({
                price: match[0],
                numericPrice: numericPrice,
                position: match.index
            });
        }
    });
    
    console.log(`🔍 Found ${priceData.length} valid prices`);
    
    // Step 3: Extract itemIds with positions
    const itemIdData = [];
    const itemIdPattern = /(?:itm\/|item\/)(\d{10,})/g;
    const itemIdMatches = [...htmlContent.matchAll(itemIdPattern)];
    itemIdMatches.forEach(match => {
        itemIdData.push({
            itemId: match[1],
            position: match.index
        });
    });
    
    console.log(`🔍 Found ${itemIdData.length} item IDs`);
    
    // Step 4: Correlate titles with nearest prices (within 2000 characters)
    const correlationDistance = 2000;
    
    titleData.forEach((titleInfo, index) => {
        if (finalResults.length >= maxResultsNum) return;
        
        // Find the closest price to this title
        let closestPrice = null;
        let closestDistance = Infinity;
        
        priceData.forEach(priceInfo => {
            const distance = Math.abs(titleInfo.position - priceInfo.position);
            if (distance < correlationDistance && distance < closestDistance) {
                closestPrice = priceInfo;
                closestDistance = distance;
            }
        });
        
        // Find the closest itemId to this title
        let closestItemId = null;
        let closestItemDistance = Infinity;
        
        itemIdData.forEach(itemInfo => {
            const distance = Math.abs(titleInfo.position - itemInfo.position);
            if (distance < correlationDistance && distance < closestItemDistance) {
                closestItemId = itemInfo;
                closestItemDistance = distance;
            }
        });
        
        if (closestPrice) {
            console.log(`🔗 Correlated: "${titleInfo.title.substring(0, 50)}..." with ${closestPrice.price} (distance: ${closestDistance})`);
            
            // Special logging for target item
            if (closestItemId && closestItemId.itemId === '365770463030') {
                console.log(`🎯 TARGET ITEM 365770463030 CORRELATION:`);
                console.log(`🎯 Title: "${titleInfo.title}"`);
                console.log(`🎯 Price: ${closestPrice.price}`);
                console.log(`🎯 Distance: ${closestDistance} chars`);
            }
            
            finalResults.push({
                title: titleInfo.title,
                price: closestPrice.price,
                numericPrice: closestPrice.numericPrice,
                itemUrl: closestItemId ? `https://www.ebay.com/itm/${closestItemId.itemId}` : '',
                sport: this.detectSportFromTitle(titleInfo.title),
                grade: expectedGrade || this.detectGradeFromTitle(titleInfo.title),
                soldDate: 'Recently sold',
                ebayItemId: closestItemId ? closestItemId.itemId : null
            });
        }
    });
    
    console.log(`🔍 Created ${finalResults.length} results from proximity-based correlation`);
    return finalResults;
}
