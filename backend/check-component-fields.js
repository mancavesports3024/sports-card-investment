const NewPricingDatabase = require('./create-new-pricing-database.js');

class ComponentFieldsChecker {
    constructor() {
        this.db = new NewPricingDatabase();
    }

    async connect() {
        await this.db.connect();
    }

    async checkComponentFields() {
        console.log('🔍 Checking component fields population...\n');
        
        try {
            // Get overall statistics
            const totalCards = await this.db.getQuery('SELECT COUNT(*) as count FROM cards');
            console.log(`📊 Total cards in database: ${totalCards.count}\n`);

            // Check each component field
            const fieldChecks = [
                { field: 'year', query: 'SELECT COUNT(*) as count FROM cards WHERE year IS NOT NULL' },
                { field: 'card_set', query: 'SELECT COUNT(*) as count FROM cards WHERE card_set IS NOT NULL' },
                { field: 'player_name', query: 'SELECT COUNT(*) as count FROM cards WHERE player_name IS NOT NULL' },
                { field: 'card_type', query: 'SELECT COUNT(*) as count FROM cards WHERE card_type IS NOT NULL' },
                { field: 'card_number', query: 'SELECT COUNT(*) as count FROM cards WHERE card_number IS NOT NULL' },
                { field: 'print_run', query: 'SELECT COUNT(*) as count FROM cards WHERE print_run IS NOT NULL' }
            ];

            console.log('📋 Component Field Statistics:');
            console.log('=============================');

            for (const check of fieldChecks) {
                const result = await this.db.getQuery(check.query);
                const percentage = ((result.count / totalCards.count) * 100).toFixed(1);
                console.log(`${check.field.padEnd(12)}: ${result.count.toString().padStart(4)} / ${totalCards.count} (${percentage}%)`);
            }

            console.log('\n🔍 Sample Cards with Missing Fields:');
            console.log('=====================================');

            // Show cards missing each field
            for (const check of fieldChecks) {
                const missingCards = await this.db.allQuery(`
                    SELECT id, title, summary_title, ${check.field}
                    FROM cards 
                    WHERE ${check.field} IS NULL 
                    ORDER BY created_at DESC 
                    LIMIT 5
                `);

                if (missingCards.length > 0) {
                    console.log(`\n❌ Cards missing ${check.field}:`);
                    for (const card of missingCards) {
                        console.log(`   ID ${card.id}: "${card.title}"`);
                    }
                }
            }

            console.log('\n✅ Sample Cards with All Fields:');
            console.log('=================================');

            // Show cards with all fields populated
            const completeCards = await this.db.allQuery(`
                SELECT id, title, summary_title, year, card_set, player_name, card_type, card_number, print_run
                FROM cards 
                WHERE year IS NOT NULL 
                  AND card_set IS NOT NULL 
                  AND player_name IS NOT NULL 
                  AND card_type IS NOT NULL 
                  AND card_number IS NOT NULL 
                  AND print_run IS NOT NULL
                ORDER BY created_at DESC 
                LIMIT 10
            `);

            for (const card of completeCards) {
                console.log(`\n🎴 Card ID ${card.id}:`);
                console.log(`   Title: "${card.title}"`);
                console.log(`   Summary: "${card.summary_title}"`);
                console.log(`   Year: ${card.year}`);
                console.log(`   Set: ${card.card_set}`);
                console.log(`   Player: ${card.player_name}`);
                console.log(`   Type: ${card.card_type}`);
                console.log(`   Number: ${card.card_number}`);
                console.log(`   Print Run: ${card.print_run}`);
            }

            // Check for potential issues
            console.log('\n⚠️  Potential Issues:');
            console.log('===================');

            // Check for ALL CAPS player names
            const allCapsPlayers = await this.db.allQuery(`
                SELECT id, title, player_name
                FROM cards 
                WHERE player_name IS NOT NULL 
                  AND player_name = UPPER(player_name)
                  AND player_name != LOWER(player_name)
                ORDER BY created_at DESC 
                LIMIT 5
            `);

            if (allCapsPlayers.length > 0) {
                console.log('\n🔤 ALL CAPS Player Names:');
                for (const card of allCapsPlayers) {
                    console.log(`   ID ${card.id}: "${card.player_name}" from "${card.title}"`);
                }
            }

            // Check for team names in player names
            const teamNames = ['A\'S', 'VIKINGS', 'CARDINALS', 'EAGLES', 'FALCONS', 'RAVENS', 'BILLS', 'PANTHERS', 'BEARS', 'BENGALS', 'BROWNS', 'COWBOYS', 'BRONCOS', 'LIONS', 'PACKERS', 'TEXANS', 'COLTS', 'JAGUARS', 'CHIEFS', 'RAIDERS', 'CHARGERS', 'RAMS', 'DOLPHINS', 'PATRIOTS', 'SAINTS', 'GIANTS', 'JETS', 'STEELERS', '49ERS', 'SEAHAWKS', 'BUCCANEERS', 'TITANS', 'COMMANDERS', 'YANKEES', 'RED SOX', 'BLUE JAYS', 'ORIOLES', 'RAYS', 'WHITE SOX', 'GUARDIANS', 'TIGERS', 'TWINS', 'ROYALS', 'ASTROS', 'RANGERS', 'ATHLETICS', 'MARINERS', 'ANGELS', 'DODGERS', 'GIANTS', 'PADRES', 'ROCKIES', 'DIAMONDBACKS', 'BRAVES', 'MARLINS', 'METS', 'PHILLIES', 'NATIONALS', 'PIRATES', 'REDS', 'BREWERS', 'CUBS', 'LAKERS', 'WARRIORS', 'CELTICS', 'HEAT', 'KNICKS', 'NETS', 'RAPTORS', '76ERS', 'HAWKS', 'HORNETS', 'WIZARDS', 'MAGIC', 'PACERS', 'BUCKS', 'CAVALIERS', 'PISTONS', 'ROCKETS', 'MAVERICKS', 'SPURS', 'GRIZZLIES', 'PELICANS', 'THUNDER', 'JAZZ', 'NUGGETS', 'TIMBERWOLVES', 'TRAIL BLAZERS', 'KINGS', 'SUNS', 'CLIPPERS', 'BULLS'];

            for (const teamName of teamNames) {
                const teamInPlayer = await this.db.allQuery(`
                    SELECT id, title, player_name
                    FROM cards 
                    WHERE player_name LIKE ?
                    ORDER BY created_at DESC 
                    LIMIT 3
                `, [`%${teamName}%`]);

                if (teamInPlayer.length > 0) {
                    console.log(`\n🏈 Team name "${teamName}" found in player names:`);
                    for (const card of teamInPlayer) {
                        console.log(`   ID ${card.id}: "${card.player_name}" from "${card.title}"`);
                    }
                }
            }

        } catch (error) {
            console.error('❌ Error checking component fields:', error);
            throw error;
        }
    }

    async close() {
        await this.db.close();
    }
}

// Add to Express routes
function addCheckComponentFieldsRoute(app) {
    app.get('/api/admin/check-component-fields', async (req, res) => {
        try {
            console.log('🔍 Check component fields endpoint called');
            
            const checker = new ComponentFieldsChecker();
            await checker.connect();
            await checker.checkComponentFields();
            await checker.close();

            res.json({
                success: true,
                message: 'Component fields check completed successfully',
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('❌ Error in check component fields endpoint:', error);
            res.status(500).json({
                success: false,
                message: 'Error checking component fields',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    });
}

module.exports = { ComponentFieldsChecker, addCheckComponentFieldsRoute };
