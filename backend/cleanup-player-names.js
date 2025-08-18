const NewPricingDatabase = require('./create-new-pricing-database.js');

class PlayerNameCleanup {
	constructor() {
		this.db = new NewPricingDatabase();
		this.updatedCount = 0;
		this.unchangedCount = 0;
		this.errorCount = 0;
	}

	async connect() {
		await this.db.connect();
		console.log('✅ Connected to database');
	}

	// Reusable cleaner (aligned with ESPN cleaners)
	cleanPlayerName(playerName) {
		if (!playerName) return null;
		let cleaned = playerName;

		// Remove team names/common noise using existing helper
		cleaned = this.db.filterTeamNamesFromPlayer(cleaned) || cleaned;

		// Remove common non-name tokens (sets, parallels, marketing, org tags)
		const noiseWords = [
			'autograph', 'autographs', 'auto', 'signature', 'signatures', 'rookie', 'rc',
			'debut', 'ssp', 'variation', 'psa', 'gem', 'mint', 'holo', 'prizm', 'prism',
			'mosaic', 'optic', 'select', 'finest', 'chrome', 'sapphire', 'update', 'refractor',
			'rated', 'retro', 'choice', 'wave', 'scope', 'pulsar', 'genesis', 'firestorm',
			'emergent', 'essentials', 'uptown', 'uptowns', 'logo', 'lightboard', 'planetary',
			'pursuit', 'mars', 'premium', 'box', 'set', 'pitch', 'prodigies', 'image', 'clear',
			'cut', 'premier', 'young', 'guns', 'star', 'starquest', 'tint', 'pandora', 'allies',
			'apex', 'on', 'iconic', 'knows', 'classic', 'events', 'edition', 'ucl', 'uefa', 'mls',
			'cc', 'mint2', 'kellogg', 'atl', 'colorado', 'picks', 'sky'
		];
		const noiseRegex = new RegExp(`\\b(${noiseWords.join('|')})\\b`, 'gi');
		cleaned = cleaned.replace(noiseRegex, ' ');

		// Remove set/code fragments and alphanumeric codes like UV15/DT36/CE14/SG5/MJ9/BDC13/ROH/CPANR/CPANK
		cleaned = cleaned.replace(/#?[A-Z]{2,4}-[A-Z]{1,4}\\b/g, ' ');
		cleaned = cleaned.replace(/#?[A-Z]{2,4}\\s+[A-Z]{2,4}\\b/g, ' ');
		cleaned = cleaned.replace(/\\b[A-Z]{2,5}\\d{1,4}\\b/g, ' ');
		cleaned = cleaned.replace(/\\b(CPANR|CPANK|CPANP|BDC|BDP|ROH)\\b/gi, ' ');

		// Remove standalone short ALL-CAPS tokens (2-4 letters) except valid suffixes
		cleaned = cleaned.replace(/\\b(?!JR|SR|II|III|IV)[A-Z]{2,4}\\b/g, ' ');

		// Normalize diacritics
		try { cleaned = cleaned.normalize('NFD').replace(/[\u0300-\u036f]+/g, ''); } catch (_) {}

		// Normalize known multi-word names and apostrophes/hyphens
		const replacements = [
			{ r: /\\bja\\s*marr\\b/gi, v: "Ja'Marr" },
			{ r: /\\bde\\s*von\\b\\s+achane/gi, v: "De'Von Achane" },
			{ r: /\\bo\\s*'?\\s*hearn\\b/gi, v: "O'Hearn" },
			{ r: /\\bo\\s*'?\\s*hoppe\\b/gi, v: "O'Hoppe" },
			{ r: /\\bsmith\\s*njigba\\b/gi, v: 'Smith-Njigba' },
			{ r: /\\bkuroda\\s*grauer\\b/gi, v: 'Kuroda-Grauer' },
			{ r: /\\bcee\\s*dee\\s+lamb\\b/gi, v: 'CeeDee Lamb' },
			{ r: /\\bdon[cč]i[cć]\\b/gi, v: 'Doncic' },
			{ r: /\\bt\\s*j\\b/gi, v: 'TJ' }
		];
		for (const { r, v } of replacements) cleaned = cleaned.replace(r, v);

		// Duals or long: keep up to first 3 tokens (First Middle Last)
		let tokens = cleaned.split(/\\s+/).filter(Boolean);
		if (tokens.length > 3) tokens = tokens.slice(0, 3);
		cleaned = tokens.join(' ');

		// Remove stray punctuation
		cleaned = cleaned.replace(/[.,;:()\\[\\]{}&]/g, ' ');

		// Token-level cleanup: drop very short tokens except allowed particles
		const allowedParticles = new Set(['jr','sr','ii','iii','iv','de','la','le','da','di','van','von','st']);
		cleaned = cleaned
			.split(/\\s+/)
			.filter(tok => {
				const t = tok.toLowerCase();
				if (t.length <= 2 && !allowedParticles.has(t)) return false;
				return true;
			})
			.join(' ');

		// Collapse spaces and capitalize
		cleaned = cleaned.replace(/\\s+/g, ' ').trim();
		cleaned = this.db.capitalizePlayerName(cleaned) || cleaned;

		return cleaned || null;
	}

	async run() {
		console.log('🔧 Starting player_name cleanup...');
		const cards = await this.db.allQuery(`
			SELECT id, player_name FROM cards ORDER BY created_at DESC
		`);
		console.log(`📊 Found ${cards.length} cards`);

		for (const card of cards) {
			try {
				const current = card.player_name || '';
				const cleaned = this.cleanPlayerName(current);
				if (cleaned && cleaned !== current) {
					await this.db.runQuery(`
						UPDATE cards SET player_name = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?
					`, [cleaned, card.id]);
					this.updatedCount++;
				} else {
					this.unchangedCount++;
				}
			} catch (e) {
				this.errorCount++;
				console.error(`❌ Error cleaning player_name for card ${card.id}:`, e.message);
			}
		}

		console.log('✅ Cleanup complete');
		this.printSummary();
	}

	printSummary() {
		console.log('\n📊 Player Name Cleanup Summary');
		console.log('==============================');
		console.log(`✅ Updated: ${this.updatedCount}`);
		console.log(`⏭️ Unchanged: ${this.unchangedCount}`);
		console.log(`❌ Errors: ${this.errorCount}`);
		console.log(`📈 Total processed: ${this.updatedCount + this.unchangedCount + this.errorCount}`);
	}
}

function addCleanupPlayerNamesRoute(app) {
	app.post('/api/admin/cleanup-player-names', async (req, res) => {
		try {
			console.log('🔄 Cleanup player_name endpoint called');
			const cleaner = new PlayerNameCleanup();
			await cleaner.connect();
			await cleaner.run();
			await cleaner.db.close();
			res.json({
				success: true,
				message: 'Player name cleanup completed successfully',
				results: {
					updated: cleaner.updatedCount,
					unchanged: cleaner.unchangedCount,
					errors: cleaner.errorCount,
					totalProcessed: cleaner.updatedCount + cleaner.unchangedCount + cleaner.errorCount
				},
				timestamp: new Date().toISOString()
			});
		} catch (error) {
			console.error('❌ Error in cleanup player_name endpoint:', error);
			res.status(500).json({ success: false, error: error.message });
		}
	});
}

module.exports = { PlayerNameCleanup, addCleanupPlayerNamesRoute };
