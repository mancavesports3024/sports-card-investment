const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class ChromeGapChecker {
    constructor() {
        this.dbPath = process.env.RAILWAY_VOLUME_MOUNT_PATH 
            ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'new-scorecard.db')
            : path.join(__dirname, 'data', 'new-scorecard.db');
        this.db = null;
    }

    async connect() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, sqlite3.OPEN_READWRITE, (err) => {
                if (err) return reject(err);
                resolve();
            });
        });
    }

    async close() {
        if (!this.db) return;
        return new Promise((resolve) => this.db.close(() => resolve()));
    }

    async runQuery(query, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(query, params, (err, rows) => {
                if (err) return reject(err);
                resolve(rows);
            });
        });
    }

    async findChromeMissingInSummary() {
        // Find rows where title contains 'chrome' but summary_title does not contain 'chrome'
        const rows = await this.runQuery(
            `SELECT id, title, summary_title, player_name, card_set, card_type
             FROM cards
             WHERE LOWER(title) LIKE '%chrome%'
               AND (summary_title IS NULL OR LOWER(summary_title) NOT LIKE '%chrome%')
             ORDER BY id DESC`
        );
        return rows;
    }
}

function addCheckMissingChromeRoute(app) {
    app.post('/api/admin/check-missing-chrome', async (req, res) => {
        const checker = new ChromeGapChecker();
        try {
            await checker.connect();
            const rows = await checker.findChromeMissingInSummary();
            res.json({
                success: true,
                message: 'Chrome gap check completed',
                count: rows.length,
                results: rows,
                timestamp: new Date().toISOString(),
            });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        } finally {
            await checker.close();
        }
    });
}

module.exports = { ChromeGapChecker, addCheckMissingChromeRoute };


