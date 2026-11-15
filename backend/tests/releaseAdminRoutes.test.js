const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const express = require('express');
const jwt = require('jsonwebtoken');

const calls = [];
const stub = (name, impl) => {
  const file = require.resolve(path.join('..', 'services', name));
  require.cache[file] = { id: file, filename: file, loaded: true, exports: impl };
};
stub('releaseDatabaseService', {
  addRelease: async (data) => { calls.push(['addRelease', data]); return { id: 1, ...data }; },
  updateRelease: async (id, data) => { calls.push(['updateRelease', id, data]); return id === 404 ? null : { id, ...data }; },
  deleteRelease: async (id) => { calls.push(['deleteRelease', id]); return id !== 404; }
});
stub('releaseInfoService', { clearCache: async () => {} });
stub('bleacherSeatsScraperService', {});
stub('releaseScheduledJobs', {});

const router = require('../routes/releases');

const ADMIN = 'mancavesportscardsllc@gmail.com';
const token = (email, secret = process.env.JWT_SECRET || 'dev_secret') => jwt.sign({ id: '1', email }, secret);

async function send(method, url, { bearer, sessionUser, body } = {}) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { req.user = sessionUser; next(); });
  app.use('/api/releases', router);
  const server = app.listen(0);
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (bearer) headers.Authorization = `Bearer ${bearer}`;
    const res = await fetch(`http://127.0.0.1:${server.address().port}${url}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
    return { status: res.status, body: await res.json() };
  } finally {
    server.close();
  }
}

const holiday = {
  title: '2026 Topps Holiday Baseball',
  brand: 'Topps',
  sport: 'Baseball',
  releaseDate: '2026-10-21',
  year: '2026',
  description: 'Holiday-themed flagship design.',
  retailPrice: 'Mega $29.99, Tin $44.99, Advent Calendar $59.99',
  hobbyPrice: '',
  source: 'Topps',
  status: 'Announced',
  createdBy: 'someone-else'
};

for (const [method, url] of [['POST', '/api/releases'], ['PUT', '/api/releases/5'], ['DELETE', '/api/releases/5']]) {
  test(`${method} ${url} rejects anonymous, non-admin, and forged tokens`, async () => {
    calls.length = 0;
    assert.equal((await send(method, url, { body: holiday })).status, 401);
    assert.equal((await send(method, url, { bearer: token('someone@example.com'), body: holiday })).status, 401);
    assert.equal((await send(method, url, { bearer: token(ADMIN, 'wrong-secret'), body: holiday })).status, 401);
    assert.equal((await send(method, url, { sessionUser: { email: 'someone@example.com' }, body: holiday })).status, 401);
    assert.deepEqual(calls, []);
  });
}

test('POST saves prices verbatim, ignores client status/createdBy, records the admin email', async () => {
  calls.length = 0;
  const res = await send('POST', '/api/releases', { bearer: token(ADMIN), body: holiday });
  assert.equal(res.status, 201);
  const [, data] = calls[0];
  assert.equal(data.retailPrice, 'Mega $29.99, Tin $44.99, Advent Calendar $59.99');
  assert.equal(data.hobbyPrice, null);
  assert.equal(data.releaseDate, '2026-10-21');
  assert.equal(data.source, 'Topps');
  assert.equal(data.createdBy, ADMIN);
  assert.equal('status' in data, false);
});

test('POST accepts a passport session admin', async () => {
  calls.length = 0;
  const res = await send('POST', '/api/releases', { sessionUser: { email: ADMIN }, body: holiday });
  assert.equal(res.status, 201);
  assert.equal(calls[0][1].createdBy, ADMIN);
});

test('POST rejects missing title and non date-only releaseDate', async () => {
  calls.length = 0;
  for (const releaseDate of [undefined, '2026-10-21T00:00:00Z', '10/21/2026', '2026-02-30']) {
    const res = await send('POST', '/api/releases', { bearer: token(ADMIN), body: { ...holiday, releaseDate } });
    assert.equal(res.status, 400, String(releaseDate));
  }
  assert.equal((await send('POST', '/api/releases', { bearer: token(ADMIN), body: { ...holiday, title: ' ' } })).status, 400);
  assert.deepEqual(calls, []);
});

test('PUT passes only schema fields and keeps the date string as sent', async () => {
  calls.length = 0;
  const res = await send('PUT', '/api/releases/7', { bearer: token(ADMIN), body: { releaseDate: '2026-11-05', status: 'Released', createdBy: 'x' } });
  assert.equal(res.status, 200);
  assert.deepEqual(calls[0], ['updateRelease', 7, { releaseDate: '2026-11-05' }]);
});

test('PUT and DELETE return 404 for unknown ids', async () => {
  assert.equal((await send('PUT', '/api/releases/404', { bearer: token(ADMIN), body: { title: 'x' } })).status, 404);
  assert.equal((await send('DELETE', '/api/releases/404', { bearer: token(ADMIN) })).status, 404);
  assert.equal((await send('DELETE', '/api/releases/abc', { bearer: token(ADMIN) })).status, 404);
});

test('DELETE soft-deletes for an admin', async () => {
  calls.length = 0;
  const res = await send('DELETE', '/api/releases/9', { bearer: token(ADMIN) });
  assert.equal(res.status, 200);
  assert.deepEqual(calls, [['deleteRelease', 9]]);
});
