const NewPricingDatabase = require('./create-new-pricing-database.js');

class RemainingUnknownSportsFixer {
	constructor() {
		this.db = new NewPricingDatabase();
	}

	async connect() { await this.db.connect(); }
	async close() { await this.db.close(); }

	async run() {
		const fixes = [
			{ id: 735, sport: 'Soccer' },
			{ id: 730, sport: 'Baseball' },
			{ id: 673, sport: 'Hockey' },
			{ id: 204, sport: 'Baseball' },
			{ id: 806, sport: 'MMA' },
			{ id: 774, sport: 'Basketball' },
			{ id: 505, sport: 'Basketball' },
			{ id: 701, sport: 'Boxing' },
			{ id: 699, sport: 'Football' }
		];
		let updated = 0; let skipped = 0;
		for (const { id, sport } of fixes) {
			const card = await this.db.getQuery('SELECT id, sport FROM cards WHERE id = ?', [id]);
			if (!card) { skipped++; continue; }
			if (card.sport !== sport) {
				await this.db.runQuery('UPDATE cards SET sport = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?', [sport, id]);
				updated++;
			} else {
				skipped++;
			}
		}
		return { updated, skipped, total: fixes.length };
	}
}

function addFixRemainingUnknownSportsRoute(app) {
	app.post('/api/admin/fix-remaining-unknown-sports', async (req, res) => {
		try {
			const fixer = new RemainingUnknownSportsFixer();
			await fixer.connect();
			const result = await fixer.run();
			await fixer.close();
			res.json({ success: true, message: 'Remaining Unknown sports fixed', result, timestamp: new Date().toISOString() });
		} catch (e) {
			res.status(500).json({ success: false, error: e.message, timestamp: new Date().toISOString() });
		}
	});
}

module.exports = { RemainingUnknownSportsFixer, addFixRemainingUnknownSportsRoute };
