const { Pool } = require('pg');

class ReleaseDatabaseService {
    constructor() {
        this.pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        });
    }

    async connectDatabase() {
        try {
            const client = await this.pool.connect();
            console.log('✅ Connected to Railway PostgreSQL releases database');
            client.release();
            return true;
        } catch (error) {
            console.error('❌ Error connecting to Railway database:', error.message);
            throw error;
        }
    }

    async closeDatabase() {
        try {
            await this.pool.end();
            console.log('✅ Railway database connection closed');
        } catch (error) {
            console.error('❌ Error closing Railway database:', error.message);
        }
    }

    async createTables() {
        const client = await this.pool.connect();
        
        try {
            await client.query('BEGIN');

            // Create releases table
            await client.query(`
                CREATE TABLE IF NOT EXISTS releases (
                    id SERIAL PRIMARY KEY,
                    title VARCHAR(500) NOT NULL,
                    brand VARCHAR(100),
                    sport VARCHAR(50),
                    release_date DATE NOT NULL,
                    year VARCHAR(4),
                    description TEXT,
                    retail_price VARCHAR(50) DEFAULT 'TBD',
                    hobby_price VARCHAR(50) DEFAULT 'TBD',
                    source VARCHAR(100) DEFAULT 'Manual',
                    status VARCHAR(20) DEFAULT 'Announced',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    created_by VARCHAR(100),
                    is_active BOOLEAN DEFAULT TRUE,
                    UNIQUE(title, release_date)
                )
            `);

            // Create indexes for performance
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_release_date ON releases(release_date)
            `);
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_sport ON releases(sport)
            `);
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_brand ON releases(brand)
            `);
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_year ON releases(year)
            `);
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_status ON releases(status)
            `);
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_is_active ON releases(is_active)
            `);

            // Create release_sources table
            await client.query(`
                CREATE TABLE IF NOT EXISTS release_sources (
                    id SERIAL PRIMARY KEY,
                    release_id INTEGER REFERENCES releases(id) ON DELETE CASCADE,
                    source_name VARCHAR(100) NOT NULL,
                    source_url TEXT,
                    last_scraped_at TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            await client.query('COMMIT');
            console.log('✅ Release database tables created successfully');
            return true;
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('❌ Error creating release database tables:', error.message);
            throw error;
        } finally {
            client.release();
        }
    }

    async getAllReleases(filters = {}) {
        const client = await this.pool.connect();
        
        try {
            let query = `
                SELECT id, title, brand, sport, release_date, year, description,
                       retail_price, hobby_price, source, status, created_at, updated_at, created_by
                FROM releases
                WHERE is_active = TRUE
            `;
            const params = [];
            let paramCount = 0;

            if (filters.sport) {
                paramCount++;
                query += ` AND sport = $${paramCount}`;
                params.push(filters.sport);
            }

            if (filters.year) {
                paramCount++;
                query += ` AND year = $${paramCount}`;
                params.push(filters.year);
            }

            if (filters.status) {
                paramCount++;
                query += ` AND status = $${paramCount}`;
                params.push(filters.status);
            }

            if (filters.startDate) {
                paramCount++;
                query += ` AND release_date >= $${paramCount}`;
                params.push(filters.startDate);
            }

            if (filters.endDate) {
                paramCount++;
                query += ` AND release_date <= $${paramCount}`;
                params.push(filters.endDate);
            }

            query += ` ORDER BY release_date ASC`;

            const result = await client.query(query, params);
            
            return result.rows.map(row => ({
                id: row.id,
                title: row.title,
                brand: row.brand,
                sport: row.sport,
                releaseDate: row.release_date.toISOString().split('T')[0],
                year: row.year,
                description: row.description,
                retailPrice: row.retail_price,
                hobbyPrice: row.hobby_price,
                source: row.source,
                status: row.status,
                createdAt: row.created_at,
                updatedAt: row.updated_at,
                createdBy: row.created_by
            }));
        } catch (error) {
            console.error('❌ Error getting releases:', error.message);
            throw error;
        } finally {
            client.release();
        }
    }

    async getReleaseById(id) {
        const client = await this.pool.connect();
        
        try {
            const result = await client.query(
                `SELECT id, title, brand, sport, release_date, year, description,
                        retail_price, hobby_price, source, status, created_at, updated_at, created_by
                 FROM releases
                 WHERE id = $1 AND is_active = TRUE`,
                [id]
            );

            if (result.rows.length === 0) {
                return null;
            }

            const row = result.rows[0];
            return {
                id: row.id,
                title: row.title,
                brand: row.brand,
                sport: row.sport,
                releaseDate: row.release_date.toISOString().split('T')[0],
                year: row.year,
                description: row.description,
                retailPrice: row.retail_price,
                hobbyPrice: row.hobby_price,
                source: row.source,
                status: row.status,
                createdAt: row.created_at,
                updatedAt: row.updated_at,
                createdBy: row.created_by
            };
        } catch (error) {
            console.error('❌ Error getting release by ID:', error.message);
            throw error;
        } finally {
            client.release();
        }
    }

    async addRelease(releaseData) {
        const client = await this.pool.connect();
        
        try {
            const result = await client.query(
                `INSERT INTO releases (title, brand, sport, release_date, year, description,
                                      retail_price, hobby_price, source, status, created_by)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                 RETURNING id, title, brand, sport, release_date, year, description,
                           retail_price, hobby_price, source, status, created_at, updated_at, created_by`,
                [
                    releaseData.title,
                    releaseData.brand || null,
                    releaseData.sport || null,
                    releaseData.releaseDate,
                    releaseData.year || null,
                    releaseData.description || null,
                    releaseData.retailPrice || 'TBD',
                    releaseData.hobbyPrice || 'TBD',
                    releaseData.source || 'Manual',
                    releaseData.status || 'Announced',
                    releaseData.createdBy || null
                ]
            );

            const row = result.rows[0];
            return {
                id: row.id,
                title: row.title,
                brand: row.brand,
                sport: row.sport,
                releaseDate: row.release_date.toISOString().split('T')[0],
                year: row.year,
                description: row.description,
                retailPrice: row.retail_price,
                hobbyPrice: row.hobby_price,
                source: row.source,
                status: row.status,
                createdAt: row.created_at,
                updatedAt: row.updated_at,
                createdBy: row.created_by
            };
        } catch (error) {
            if (error.code === '23505') { // Unique constraint violation
                console.log('⚠️ Duplicate release detected, skipping:', releaseData.title);
                return null;
            }
            console.error('❌ Error adding release:', error.message);
            throw error;
        } finally {
            client.release();
        }
    }

    async updateRelease(id, releaseData) {
        const client = await this.pool.connect();
        
        try {
            const updates = [];
            const params = [];
            let paramCount = 0;

            if (releaseData.title !== undefined) {
                paramCount++;
                updates.push(`title = $${paramCount}`);
                params.push(releaseData.title);
            }
            if (releaseData.brand !== undefined) {
                paramCount++;
                updates.push(`brand = $${paramCount}`);
                params.push(releaseData.brand);
            }
            if (releaseData.sport !== undefined) {
                paramCount++;
                updates.push(`sport = $${paramCount}`);
                params.push(releaseData.sport);
            }
            if (releaseData.releaseDate !== undefined) {
                paramCount++;
                updates.push(`release_date = $${paramCount}`);
                params.push(releaseData.releaseDate);
            }
            if (releaseData.year !== undefined) {
                paramCount++;
                updates.push(`year = $${paramCount}`);
                params.push(releaseData.year);
            }
            if (releaseData.description !== undefined) {
                paramCount++;
                updates.push(`description = $${paramCount}`);
                params.push(releaseData.description);
            }
            if (releaseData.retailPrice !== undefined) {
                paramCount++;
                updates.push(`retail_price = $${paramCount}`);
                params.push(releaseData.retailPrice);
            }
            if (releaseData.hobbyPrice !== undefined) {
                paramCount++;
                updates.push(`hobby_price = $${paramCount}`);
                params.push(releaseData.hobbyPrice);
            }
            if (releaseData.status !== undefined) {
                paramCount++;
                updates.push(`status = $${paramCount}`);
                params.push(releaseData.status);
            }

            if (updates.length === 0) {
                return await this.getReleaseById(id);
            }

            paramCount++;
            updates.push(`updated_at = CURRENT_TIMESTAMP`);
            paramCount++;
            params.push(id);

            const result = await client.query(
                `UPDATE releases SET ${updates.join(', ')}
                 WHERE id = $${paramCount} AND is_active = TRUE
                 RETURNING id, title, brand, sport, release_date, year, description,
                           retail_price, hobby_price, source, status, created_at, updated_at, created_by`,
                params
            );

            if (result.rows.length === 0) {
                return null;
            }

            const row = result.rows[0];
            return {
                id: row.id,
                title: row.title,
                brand: row.brand,
                sport: row.sport,
                releaseDate: row.release_date.toISOString().split('T')[0],
                year: row.year,
                description: row.description,
                retailPrice: row.retail_price,
                hobbyPrice: row.hobby_price,
                source: row.source,
                status: row.status,
                createdAt: row.created_at,
                updatedAt: row.updated_at,
                createdBy: row.created_by
            };
        } catch (error) {
            console.error('❌ Error updating release:', error.message);
            throw error;
        } finally {
            client.release();
        }
    }

    async deleteRelease(id) {
        const client = await this.pool.connect();
        
        try {
            const result = await client.query(
                `UPDATE releases SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
                 WHERE id = $1 AND is_active = TRUE
                 RETURNING id`,
                [id]
            );

            return result.rows.length > 0;
        } catch (error) {
            console.error('❌ Error deleting release:', error.message);
            throw error;
        } finally {
            client.release();
        }
    }

    async syncScrapedReleases(scrapedReleases) {
        const client = await this.pool.connect();
        
        try {
            let added = 0;
            let skipped = 0;

            for (const scrapedRelease of scrapedReleases) {
                try {
                    const result = await this.addRelease({
                        title: scrapedRelease.title,
                        brand: scrapedRelease.brand,
                        sport: scrapedRelease.sport,
                        releaseDate: scrapedRelease.releaseDate,
                        year: scrapedRelease.year,
                        description: scrapedRelease.description,
                        retailPrice: scrapedRelease.retailPrice || 'TBD',
                        hobbyPrice: scrapedRelease.hobbyPrice || 'TBD',
                        source: 'Bleacher Seats',
                        status: scrapedRelease.status || 'Announced'
                    });

                    if (result) {
                        added++;
                    } else {
                        skipped++;
                    }
                } catch (error) {
                    console.error(`❌ Error syncing release ${scrapedRelease.title}:`, error.message);
                    skipped++;
                }
            }

            console.log(`✅ Synced scraped releases: ${added} added, ${skipped} skipped`);
            return { added, skipped };
        } catch (error) {
            console.error('❌ Error syncing scraped releases:', error.message);
            throw error;
        } finally {
            client.release();
        }
    }

    async markAsReleased(releaseDate) {
        const client = await this.pool.connect();
        
        try {
            const result = await client.query(
                `UPDATE releases
                 SET status = 'Released', updated_at = CURRENT_TIMESTAMP
                 WHERE release_date <= $1 AND status != 'Released' AND is_active = TRUE`,
                [releaseDate]
            );

            console.log(`✅ Marked ${result.rowCount} releases as Released`);
            return result.rowCount;
        } catch (error) {
            console.error('❌ Error marking releases as released:', error.message);
            throw error;
        } finally {
            client.release();
        }
    }

    async updateStatuses() {
        const client = await this.pool.connect();
        
        try {
            const now = new Date();
            const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
            const today = now.toISOString().split('T')[0];
            const thirtyDaysDate = thirtyDaysFromNow.toISOString().split('T')[0];

            // Mark past releases as Released
            await client.query(
                `UPDATE releases
                 SET status = 'Released', updated_at = CURRENT_TIMESTAMP
                 WHERE release_date < $1 AND status != 'Released' AND is_active = TRUE`,
                [today]
            );

            // Mark upcoming releases (next 30 days) as Upcoming
            await client.query(
                `UPDATE releases
                 SET status = 'Upcoming', updated_at = CURRENT_TIMESTAMP
                 WHERE release_date >= $1 AND release_date <= $2 AND status != 'Upcoming' AND is_active = TRUE`,
                [today, thirtyDaysDate]
            );

            // Mark future releases (beyond 30 days) as Announced
            await client.query(
                `UPDATE releases
                 SET status = 'Announced', updated_at = CURRENT_TIMESTAMP
                 WHERE release_date > $2 AND status != 'Announced' AND is_active = TRUE`,
                [thirtyDaysDate]
            );

            console.log('✅ Updated release statuses automatically');
            return true;
        } catch (error) {
            console.error('❌ Error updating release statuses:', error.message);
            throw error;
        } finally {
            client.release();
        }
    }

    async getUpcomingReleases(days = 30) {
        const client = await this.pool.connect();
        
        try {
            const today = new Date().toISOString().split('T')[0];
            const futureDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

            return await this.getAllReleases({
                startDate: today,
                endDate: futureDate
            });
        } catch (error) {
            console.error('❌ Error getting upcoming releases:', error.message);
            throw error;
        } finally {
            client.release();
        }
    }

    async getRecentReleases(days = 30) {
        const client = await this.pool.connect();
        
        try {
            const today = new Date().toISOString().split('T')[0];
            const pastDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

            return await this.getAllReleases({
                startDate: pastDate,
                endDate: today
            });
        } catch (error) {
            console.error('❌ Error getting recent releases:', error.message);
            throw error;
        } finally {
            client.release();
        }
    }
}

module.exports = new ReleaseDatabaseService();

