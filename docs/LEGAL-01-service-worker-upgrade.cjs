// Real browser CacheStorage / service-worker upgrade against a local fixture
// server only. No application backend, real tokens or external providers.
const fs = require('fs');
const path = require('path');
const http = require('http');
const { execFileSync } = require('child_process');
const { chromium } = require(process.env.LEGAL01_PLAYWRIGHT_PATH || 'playwright');
const root = path.resolve(__dirname, '..');
let workerSource = execFileSync('git', ['show', '793ae3bdcc54dad45dabdb176397db56a4dd9fad:frontend/public/sw.js'], { cwd: root, encoding: 'utf8' });
let fixtureRequests = 0;
const server = http.createServer((req, res) => {
  fixtureRequests++;
  res.setHeader('Cache-Control', 'no-store');
  if (req.url === '/sw.js') {
    res.setHeader('Content-Type', 'application/javascript');
    res.end(workerSource);
  } else if (req.url.startsWith('/api/')) {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ fixture: 'private-test-response' }));
  } else {
    res.setHeader('Content-Type', 'text/html');
    res.end('<!doctype html><title>LEGAL-01 isolated worker fixture</title><p>Local test fixture</p>');
  }
});
function check(ok, message) { if (!ok) throw new Error(message); console.log('PASS ' + message); }
(async () => {
  let browser;
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://legal01.test:${server.address().port}`;
    browser = await chromium.launch({ headless: true, channel: 'msedge', args: [
      '--host-resolver-rules=MAP legal01.test 127.0.0.1', '--no-proxy-server',
      `--unsafely-treat-insecure-origin-as-secure=${origin}`,
    ] });
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(origin + '/');
    await page.evaluate(async () => {
      await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
    });
    await page.waitForFunction(() => navigator.serviceWorker.controller);
    await page.evaluate(async () => {
      const unrelated = await caches.open('unrelated-application-cache');
      await unrelated.put('/unrelated-object', new Response('preserve-unrelated'));
      const v1 = await caches.open('scorecard-v1-api');
      await v1.put('/api/legacy-v1', new Response('sensitive-v1-fixture'));
      await fetch('/api/private', { headers: { Authorization: 'Bearer FAKE_FIXTURE_TOKEN' } });
    });
    await page.waitForFunction(async () => !!(await (await caches.open('scorecard-v2-api')).match('/api/private')));
    await page.goto(origin + '/auth-success?token=FAKE_LEGACY_TOKEN');
    await page.waitForFunction(async () => !!(await (await caches.open('scorecard-v2-static')).match(location.href)));
    check(await page.evaluate(async () => (await caches.keys()).includes('scorecard-v2-api')), 'legacy worker really cached a private response');
    await page.goto(origin + '/');
    workerSource = fs.readFileSync(path.join(root, 'frontend/public/sw.js'), 'utf8');
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      const previous = navigator.serviceWorker.controller;
      await registration.update();
      await new Promise((resolve, reject) => {
        const poll = setInterval(() => {
          if (navigator.serviceWorker.controller !== previous && registration.active?.state === 'activated') {
            clearInterval(poll); clearTimeout(timeout); resolve();
          }
        }, 25);
        const timeout = setTimeout(() => { clearInterval(poll); reject(new Error('Worker upgrade timed out')); }, 15000);
      });
    });
    const names = await page.evaluate(() => caches.keys());
    check(!names.some(name => /^scorecard-v[12]-/.test(name)), 'upgrade removed known v1/v2 caches including private data and token callback: ' + JSON.stringify(names));
    check(await page.evaluate(async () => (await (await caches.open('unrelated-application-cache')).match('/unrelated-object')).text()).then(v => v === 'preserve-unrelated'), 'upgrade preserved unrelated cache contents');
    const before = fixtureRequests;
    await page.evaluate(() => fetch('/api/private-after-upgrade', { headers: { Authorization: 'Bearer FAKE_FIXTURE_TOKEN' } }).then(r => r.json()));
    check(fixtureRequests > before, 'private request reached only the local fixture server');
    const cached = url => page.evaluate(async value => {
      for (const name of await caches.keys()) if (await (await caches.open(name)).match(value)) return true;
      return false;
    }, url);
    check(!await cached(origin + '/api/private-after-upgrade'), 'new authenticated API response was not put in any cache');
    await page.goto(origin + '/auth-success?token=FAKE_NEW_TOKEN');
    check(!await cached(origin + '/auth-success?token=FAKE_NEW_TOKEN'), 'new token callback was not cached');
    await page.goto(origin + '/other-callback?code=FAKE_CODE');
    check(!await cached(origin + '/other-callback?code=FAKE_CODE'), 'other query-bearing navigation was not cached');
    await page.goto(origin + '/public-page');
    await page.waitForFunction(async () => !!(await (await caches.open('scorecard-v3-static')).match(location.href)));
    check(await cached(origin + '/public-page'), 'v3 is active and still caches ordinary public navigation');
    await context.setOffline(true);
    check(await page.evaluate(async () => {
      try { await fetch('/api/private', { headers: { Authorization: 'Bearer FAKE_FIXTURE_TOKEN' } }); return false; }
      catch (_) { return true; }
    }), 'offline private request did not recover old cached private data');
    await context.setOffline(false);
    check(await page.evaluate(async () => (await (await caches.open('unrelated-application-cache')).match('/unrelated-object')).text()).then(v => v === 'preserve-unrelated'), 'unrelated cache remains intact after all private requests');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
