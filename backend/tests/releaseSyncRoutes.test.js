const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const express = require('express');

const calls = [];
const stub = (name, methods) => {
  const file = require.resolve(path.join('..', 'services', name));
  const exports = {};
  for (const m of methods) exports[m] = async () => { calls.push(`${name}.${m}`); return { success: true, added: 1 }; };
  require.cache[file] = { id: file, filename: file, loaded: true, exports };
};
stub('releaseDatabaseService', ['syncScrapedReleases', 'updateStatuses', 'addRelease']);
stub('releaseInfoService', ['clearCache']);
stub('bleacherSeatsScraperService', ['getLatestReleases']);
stub('releaseScheduledJobs', ['syncScrapedReleases', 'runAllJobs']);

const router = require('../routes/releases');

async function post(url, user) {
  const app = express();
  app.use((req, res, next) => { req.user = user; next(); });
  app.use('/api/releases', router);
  const server = app.listen(0);
  try {
    const res = await fetch(`http://127.0.0.1:${server.address().port}${url}`, { method: 'POST' });
    return { status: res.status, body: await res.json() };
  } finally {
    server.close();
  }
}

for (const url of ['/api/releases/sync', '/api/releases/jobs/sync']) {
  test(`${url} rejects anonymous and non-admin users`, async () => {
    calls.length = 0;
    assert.equal((await post(url, undefined)).status, 401);
    assert.equal((await post(url, { email: 'someone@example.com' })).status, 401);
    assert.equal((await post(url, { email: 'admin@example.com' })).status, 401);
    assert.deepEqual(calls, []);
  });

  test(`${url} is disabled even for a real admin`, async () => {
    calls.length = 0;
    const res = await post(url, { email: 'mancavesportscardsllc@gmail.com' });
    assert.equal(res.status, 410);
    assert.equal(res.body.success, false);
    assert.deepEqual(calls, []);
  });
}
