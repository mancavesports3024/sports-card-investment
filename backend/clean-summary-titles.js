require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class SummaryTitleCleaner {
    constructor() {
        // Use the Railway database path
        this.dbPath = path.join(__dirname, 'data', 'new-scorecard.db');
        this.db = null;
    }

    async connect() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    console.error('❌ Database connection failed:', err.message);
                    reject(err);
                } else {
                    console.log('✅ Connected to SQLite database');
                    resolve();
                }
            });
        });
    }

    cleanSummaryTitle(title) {
        // First, check if the original title has autograph indicators
        const originalTitleLower = title.toLowerCase();
        const hasAutographIndicator = originalTitleLower.includes('autograph') || 
                                     originalTitleLower.includes('autographs') || 
                                     originalTitleLower.includes('auto') ||
                                     originalTitleLower.includes('signed');
        
        // Do the normal cleaning
        let cleanedTitle = title
            // Remove grading terms
            .replace(/PSA\s*\d+/gi, '') // Remove PSA grades
            .replace(/GEM\s*MT/gi, '') // Remove GEM MT
            .replace(/GEM/gi, '') // Remove GEM
            .replace(/MINT\s*\d+/gi, '') // Remove MINT grades
            .replace(/MINT/gi, '') // Remove MINT
            .replace(/CERT\s*#\d+/gi, '') // Remove certification numbers
            
            // Remove descriptive words that don't fit the formula
            .replace(/BEAUTIFUL/gi, '')
            .replace(/GORGEOUS/gi, '')
            .replace(/STUNNING/gi, '')
            .replace(/MINT\s*CONDITION/gi, '')
            .replace(/CASE\s*HIT/gi, '') // Remove case hit
            .replace(/HOT\s*NUMBERS/gi, '') // Remove hot numbers
            .replace(/ELECTRIC\s*ETCH/gi, '') // Remove electric etch
            .replace(/VITREOUS/gi, '') // Remove vitreous
            .replace(/ICE\s*PRIZM/gi, '') // Remove ice prizm
            .replace(/BOMB\s*SQUAD/gi, '') // Remove bomb squad
            .replace(/ON\s*DECK/gi, '') // Remove on deck
            .replace(/POP\.\s*\d+/gi, '') // Remove POP numbers with periods
            .replace(/POP\s*\d+/gi, '') // Remove POP numbers
            
            // Remove common card terms that don't help search
            .replace(/\bRC\b/gi, '') // Remove RC (Rookie Card)
            .replace(/\bROOKIE\b/gi, '') // Remove ROOKIE
            .replace(/\bAUTOGRAPHS\b/gi, 'auto') // Change AUTOGRAPHS to auto
            .replace(/\bAUTOGRAPH\b/gi, 'auto') // Change AUTOGRAPH to auto
            .replace(/\bREFRACTOR\b/gi, '') // Remove REFRACTOR
            .replace(/\bPARALLEL\b/gi, '') // Remove PARALLEL
            .replace(/\bNUMBERED\b/gi, '') // Remove NUMBERED
            .replace(/\bSSP\b/gi, '') // Remove SSP (Super Short Print)
            .replace(/\bSP\b/gi, '') // Remove SP (Short Print)
            .replace(/\bHOF\b/gi, '') // Remove HOF (Hall of Fame)
            
            // Remove additional terms that don't help search
            .replace(/\bLA\b/gi, '') // Remove LA
            .replace(/\bDUKE\b/gi, '') // Remove DUKE
            .replace(/\bCARD\b/gi, '') // Remove CARD
            .replace(/\bPATS\b/gi, '') // Remove PATS
            .replace(/\bRATED\b/gi, '') // Remove RATED
            .replace(/\bINSTER\b/gi, '') // Remove INSTER
            .replace(/\bMVP\b/gi, '') // Remove MVP
            .replace(/\bBOX\s*SET\b/gi, '') // Remove BOX SET
            .replace(/\bMAV\b/gi, '') // Remove MAV
            .replace(/\bNEW\s*ENGLAND\b/gi, '') // Remove NEW ENGLAND
            .replace(/\bCOLOR\s*MATCH\b/gi, '') // Remove COLOR MATCH
            .replace(/\b76ERS\b/gi, '') // Remove 76ERS
            .replace(/\bERS\b/gi, '') // Remove ERS
            .replace(/\bGRADED\b/gi, '') // Remove GRADED
            .replace(/\bPITCHING\b/gi, '') // Remove PITCHING
            .replace(/\bBATTING\b/gi, '') // Remove BATTING
            .replace(/\bRPA\b/gi, '') // Remove RPA
            .replace(/\bPATCH\b/gi, '') // Remove PATCH
            .replace(/\bDUAL\b/gi, '') // Remove DUAL
            .replace(/\bSWATCH\b/gi, '') // Remove SWATCH
            .replace(/\bEDITION\b/gi, '') // Remove EDITION (but keep 1st Edition)
            .replace(/\bDEBUT\b/gi, '') // Remove DEBUT
            
            // Preserve important terms that should not be removed
            .replace(/1ST\s+EDITION/gi, '1ST_EDITION') // Temporarily protect 1st Edition
            
            // Remove sport names (not part of the formula)
            .replace(/\bNBA\b/gi, '') // Remove NBA
            .replace(/\bBASKETBALL\b/gi, '') // Remove BASKETBALL
            .replace(/\bFOOTBALL\b/gi, '') // Remove FOOTBALL
            .replace(/\bBASEBALL\b/gi, '') // Remove BASEBALL
            .replace(/\bHOCKEY\b/gi, '') // Remove HOCKEY
            .replace(/\bSOCCER\b/gi, '') // Remove SOCCER
            .replace(/\bNFL\b/gi, '') // Remove NFL
            .replace(/\bMLB\b/gi, '') // Remove MLB
            .replace(/\bNHL\b/gi, '') // Remove NHL
            .replace(/\bFIFA\b/gi, '') // Remove FIFA
            
            // Remove team names and cities (not part of the formula)
            .replace(/\b(LAKERS|WARRIORS|CELTICS|HEAT|KNICKS|NETS|RAPTORS|76ERS|HAWKS|HORNETS|WIZARDS|MAGIC|PACERS|BUCKS|CAVALIERS|PISTONS|ROCKETS|MAVERICKS|SPURS|GRIZZLIES|PELICANS|THUNDER|JAZZ|NUGGETS|TIMBERWOLVES|TRAIL\s*BLAZERS|KINGS|SUNS|CLIPPERS|BULLS)\b/gi, '') // Remove NBA team names
            .replace(/\b(COWBOYS|EAGLES|GIANTS|REDSKINS|COMMANDERS|BEARS|PACKERS|VIKINGS|LIONS|FALCONS|PANTHERS|SAINTS|BUCCANEERS|RAMS|49ERS|SEAHAWKS|CARDINALS|JETS|PATRIOTS|BILLS|DOLPHINS|BENGALS|BROWNS|STEELERS|RAVENS|TEXANS|COLTS|JAGUARS|TITANS|BRONCOS|CHARGERS|RAIDERS|CHIEFS)\b/gi, '') // Remove NFL team names
            .replace(/\b(YANKEES|RED\s*SOX|BLUE\s*JAYS|ORIOLES|RAYS|WHITE\s*SOX|INDIANS|GUARDIANS|TIGERS|TWINS|ROYALS|ASTROS|RANGERS|ATHLETICS|MARINERS|ANGELS|DODGERS|GIANTS|PADRES|ROCKIES|DIAMONDBACKS|BRAVES|MARLINS|METS|PHILLIES|NATIONALS|PIRATES|REDS|BREWERS|CUBS|CARDINALS)\b/gi, '') // Remove MLB team names
            .replace(/\b(CHICAGO|BOSTON|NEW\s*YORK|LOS\s*ANGELES|MIAMI|DALLAS|HOUSTON|PHOENIX|DENVER|PORTLAND|SACRAMENTO|MINNEAPOLIS|OKLAHOMA\s*CITY|SALT\s*LAKE\s*CITY|MEMPHIS|NEW\s*ORLEANS|SAN\s*ANTONIO|ORLANDO|ATLANTA|CHARLOTTE|WASHINGTON|DETROIT|CLEVELAND|INDIANAPOLIS|MILWAUKEE|PHILADELPHIA|BROOKLYN|TORONTO)\b/gi, '') // Remove city names
            
            // Remove periods (but keep hyphens, #, and /)
            .replace(/\./g, '')
            
            // Remove special characters and emojis (but keep hyphens, #, and /)
            .replace(/[^\w\s\-#\/]/g, '')
            
            // Remove standalone hyphens but preserve year ranges (like 1994-95) and card numbers (like #TRC-BYG)
            .replace(/(?<!\d)(?<!#\w*)\s*-\s*(?!\d)/g, ' ') // Replace " - " with space, but not between numbers or after #
            .replace(/^\s*-\s*/, '') // Remove leading hyphen
            .replace(/\s*-\s*$/, '') // Remove trailing hyphen
            
            // Normalize spaces
            .replace(/\s+/g, ' ')
            
            // Restore protected terms
            .replace(/1ST_EDITION/gi, '1st Edition')
            
            .trim();
        
        // Check if the cleaned title has "auto" - if not but original had autograph indicators, add it
        if (hasAutographIndicator && !cleanedTitle.toLowerCase().includes('auto')) {
            // Find a good place to insert "auto" - typically after the set name or before the card number
            const words = cleanedTitle.split(' ');
            let insertIndex = words.length; // Default to end
            
            // Look for card number patterns to insert before them
            for (let i = 0; i < words.length; i++) {
                if (words[i].startsWith('#') || /^\d+$/.test(words[i])) {
                    insertIndex = i;
                    break;
                }
            }
            
            // Insert "auto" at the determined position
            words.splice(insertIndex, 0, 'auto');
            cleanedTitle = words.join(' ');
        }
        
        return cleanedTitle;
    }

    async getAllCards() {
        return new Promise((resolve, reject) => {
            const query = 'SELECT id, title, summary_title FROM cards';
            
            this.db.all(query, [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async updateSummaryTitle(cardId, newSummaryTitle) {
        return new Promise((resolve, reject) => {
            const query = 'UPDATE cards SET summary_title = ? WHERE id = ?';
            
            this.db.run(query, [newSummaryTitle, cardId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
        });
    }

    async cleanAllSummaryTitles() {
        console.log('🧹 Starting summary title cleanup...');
        
        try {
            const cards = await this.getAllCards();
            console.log(`📊 Found ${cards.length} cards to process`);
            
            let updated = 0;
            let unchanged = 0;
            
            for (const card of cards) {
                const originalTitle = card.summary_title || card.title;
                const cleanedTitle = this.cleanSummaryTitle(originalTitle);
                
                if (cleanedTitle !== originalTitle) {
                    await this.updateSummaryTitle(card.id, cleanedTitle);
                    updated++;
                    console.log(`✅ Updated card ${card.id}: "${originalTitle}" → "${cleanedTitle}"`);
                } else {
                    unchanged++;
                }
            }
            
            console.log(`\n🎉 Summary title cleanup complete!`);
            console.log(`📈 Updated: ${updated} cards`);
            console.log(`📊 Unchanged: ${unchanged} cards`);
            
            return { updated, unchanged, total: cards.length };
            
        } catch (error) {
            console.error('❌ Error during summary title cleanup:', error);
            throw error;
        }
    }

    async close() {
        if (this.db) {
            this.db.close();
            console.log('✅ Database connection closed');
        }
    }
}

async function main() {
    const cleaner = new SummaryTitleCleaner();
    
    try {
        await cleaner.connect();
        const results = await cleaner.cleanAllSummaryTitles();
        console.log('\n📊 Final Results:', results);
    } catch (error) {
        console.error('❌ Error in main:', error);
    } finally {
        await cleaner.close();
    }
}

if (require.main === module) {
    main().then(() => {
        console.log('\n✅ Summary title cleanup script complete');
        process.exit(0);
    }).catch(error => {
        console.error('❌ Summary title cleanup script failed:', error);
        process.exit(1);
    });
}

module.exports = { SummaryTitleCleaner };
