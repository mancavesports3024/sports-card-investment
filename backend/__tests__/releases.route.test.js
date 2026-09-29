const request = require('supertest');
const express = require('express');

jest.mock('../services/releaseDatabaseService', () => ({
    getReleaseById: jest.fn(),
    getAllReleases: jest.fn().mockResolvedValue([])
}));

jest.mock('../services/releaseScheduledJobs', () => ({
    startScheduledJobs: jest.fn(),
    status: jest.fn().mockReturnValue({ initialized: true })
}));

const releasesRouter = require('../routes/releases');

const app = express();
app.use(express.json());
app.use('/api/releases', releasesRouter);

describe('Releases API Routes - Parameter Validation', () => {
    describe('GET /api/releases/:id - Invalid ID handling', () => {
        it('should return 400 for non-numeric ID like "invalid-id"', async () => {
            const response = await request(app)
                .get('/api/releases/invalid-id')
                .expect(400);

            expect(response.body).toEqual({
                success: false,
                error: 'Invalid release ID',
                message: 'Release ID must be a valid integer'
            });
        });

        it('should return 400 for mixed alphanumeric ID like "abc123"', async () => {
            const response = await request(app)
                .get('/api/releases/abc123')
                .expect(400);

            expect(response.body).toEqual({
                success: false,
                error: 'Invalid release ID',
                message: 'Release ID must be a valid integer'
            });
        });

        it('should return 400 for text that could be mistaken for a route like "test"', async () => {
            const response = await request(app)
                .get('/api/releases/test')
                .expect(400);

            expect(response.body).toEqual({
                success: false,
                error: 'Invalid release ID',
                message: 'Release ID must be a valid integer'
            });
        });

        it('should not match "unverified" as :id (regression test for production 500)', async () => {
            const response = await request(app)
                .get('/api/releases/unverified');

            expect(response.status).not.toBe(500);
            expect(response.status).toBe(401);
            expect(response.body.error).not.toContain('NaN');
        });
    });

    describe('Route ordering and production regression tests', () => {
        it('GET /api/releases/ should return all releases', async () => {
            const response = await request(app)
                .get('/api/releases/')
                .expect(200);

            expect(response.body).toHaveProperty('success');
            expect(response.body).toHaveProperty('releases');
            expect(Array.isArray(response.body.releases)).toBe(true);
        });

        it('GET /api/releases/unverified should match before :id and require auth', async () => {
            const response = await request(app)
                .get('/api/releases/unverified');

            expect(response.status).toBe(401);
            expect(response.body).toMatchObject({
                success: false,
                error: expect.any(String)
            });
            expect(response.body.error).not.toContain('Invalid release ID');
        });

        it('should never return PostgreSQL NaN error for invalid IDs', async () => {
            const invalidIds = ['unverified', 'test', 'abc', 'invalid-id', 'NaN'];
            
            for (const id of invalidIds) {
                const response = await request(app).get(`/api/releases/${id}`);
                
                expect(response.body.message || '').not.toContain('invalid input syntax for type integer');
                expect(response.body.message || '').not.toContain('NaN');
            }
        });
    });
});
