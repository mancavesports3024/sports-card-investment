// node --test tests/releaseAdminRoutes.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const express = require('express');
const jwt = require('jsonwebtoken');

const added = [];
const updated = [];
const deleted = [];

const dbFile = require.resolve(path.join('..', 'services', 'releaseDatabaseService'));
require.cache[dbFile] = {
  id: dbFile,
  filename: dbFile,
  loaded: true,
  exports: {
    getAllReleases: async () => [],
    getReleaseById: async () => null,
    addRelease: async (data) => {
      added.push(data);
      return { id: 999, ...data, status: 'Released' };
    },
    updateRelease: async (id, data) => {
      updated.push({ id, data });
      return { id, ...data };
    },
    deleteRelease: async (id) => {
      deleted.push(id);
      return true;
    }
  }
};

const infoFile = require.resolve(path.join('..', 'services', 'releaseInfoService'));
require.cache[infoFile] = {
  id: infoFile,
  filename: infoFile,
  loaded: true,
  exports: { clearCache: async () => {} }
};
for (const name of ['bleacherSeatsScraperService', 'releaseScheduledJobs']) {
  const file = require.resolve(path.join('..', 'services', name));
  require.cache[file] = { id: file, filename: file, loaded: true, exports: {} };
}

const router = require('../routes/releases');
const SECRET = 'test-secret';
process.env.JWT_SECRET = SECRET;

function tokenFor(email) {
  return jwt.sign({ email, id: '1', displayName: 'Test' }, SECRET, { expiresIn: '1h' });
}

async function withServer(fn) {
  const app = express();
  app.use(express.json());
  app.use('/api/releases', router);
  const server = app.listen(0);
  const port = server.address().port;
  try {
    return await fn(port);
  } finally {
    server.close();
  }
}

test('POST /api/releases rejects anonymous and non-admin JWTs', async () => {
  await withServer(async (port) => {
    const anon = await fetch(`http://127.0.0.1:${port}/api/releases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'X', releaseDate: '2026-10-14' })
    });
    assert.equal(anon.status, 401);

    const nonAdmin = await fetch(`http://127.0.0.1:${port}/api/releases`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenFor('someone@example.com')}`
      },
      body: JSON.stringify({ title: 'X', releaseDate: '2026-10-14' })
    });
    assert.equal(nonAdmin.status, 401);
  });
});

test('POST /api/releases accepts admin JWT and preserves free-text prices', async () => {
  added.length = 0;
  await withServer(async (port) => {
    const res = await fetch(`http://127.0.0.1:${port}/api/releases`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenFor('mancavesportscardsllc@gmail.com')}`
      },
      body: JSON.stringify({
        title: '2026 Topps Holiday Baseball',
        brand: 'Topps',
        sport: 'Baseball',
        releaseDate: '2026-10-21',
        year: '2026',
        description: 'Holiday-themed',
        retailPrice: 'Mega $29.99, Tin $44.99, Advent Calendar $59.99',
        hobbyPrice: null,
        source: 'Topps'
      })
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(added.length, 1);
    assert.equal(added[0].retailPrice, 'Mega $29.99, Tin $44.99, Advent Calendar $59.99');
    assert.equal(added[0].hobbyPrice, null);
    assert.equal(added[0].source, 'Topps');
    assert.equal(added[0].createdBy, 'mancavesportscardsllc@gmail.com');
    assert.equal(added[0].releaseDate, '2026-10-21');
  });
});

test('POST /api/releases allows explicit createdBy for admin scripts', async () => {
  added.length = 0;
  await withServer(async (port) => {
    const res = await fetch(`http://127.0.0.1:${port}/api/releases`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenFor('mancavesportscardsllc@gmail.com')}`
      },
      body: JSON.stringify({
        title: 'Script Marker Release',
        releaseDate: '2026-10-14',
        createdBy: 'release-calendar-fix'
      })
    });
    assert.equal(res.status, 201);
    assert.equal(added[0].createdBy, 'release-calendar-fix');
  });
});

test('PUT and DELETE /api/releases/:id require admin JWT', async () => {
  updated.length = 0;
  deleted.length = 0;
  await withServer(async (port) => {
    const putAnon = await fetch(`http://127.0.0.1:${port}/api/releases/1`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ releaseDate: '2026-11-01' })
    });
    assert.equal(putAnon.status, 401);

    const putOk = await fetch(`http://127.0.0.1:${port}/api/releases/1`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenFor('mancavesportscardsllc@gmail.com')}`
      },
      body: JSON.stringify({ releaseDate: '2026-11-01' })
    });
    assert.equal(putOk.status, 200);
    assert.equal(updated[0].data.releaseDate, '2026-11-01');
    assert.equal(updated[0].data.status, 'Released');

    const delOk = await fetch(`http://127.0.0.1:${port}/api/releases/1`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${tokenFor('sparkmandrew@gmail.com')}`
      }
    });
    assert.equal(delOk.status, 200);
    assert.deepEqual(deleted, [1]);
  });
});
