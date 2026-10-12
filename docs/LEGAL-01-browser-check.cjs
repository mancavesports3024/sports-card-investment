// Intercepted Google-script tests. The synthetic runtime implements Google's
// documented ga-disable check; this is not validation of a live Google account.
const fs = require('fs');
const path = require('path');
const { chromium } = require(process.env.LEGAL01_PLAYWRIGHT_PATH || 'playwright');
const build = path.join(__dirname, '..', 'frontend', 'build');
const googleStub = `
 window.__legalStubSend = () => {
   if (!window['ga-disable-G-X6BGH9S5F8']) fetch('https://www.google-analytics.com/g/collect?LEGAL01_SYNTHETIC=1');
 };
 window.__legalStubLateEvent = window.gtag;
 window.__legalStubQueue = () => setTimeout(() => {
   window.__legalStubSend(); window.__legalStubLateEvent('event', 'synthetic_delayed_event');
 }, 250);
`;
const check = (ok, label) => { if (!ok) throw Error(label); console.log('PASS ' + label); };
(async () => {
 const browser = await chromium.launch({ headless: true, channel: 'msedge' });
 try {
  // Block workers here so every external request is intercepted. Worker upgrade
  // is tested separately using actual browser workers and a local fixture server.
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const page = await context.newPage();
  const requests = [];
  let delayTag = false;
  let releaseTag;
  await page.route('**/*', async route => {
   const url = new URL(route.request().url());
   if (/google-analytics|googletagmanager|googlesyndication|doubleclick/.test(url.hostname)) {
    requests.push(url.href);
    if (url.hostname.includes('googletagmanager')) {
     const delayed = delayTag;
     if (delayed) await new Promise(resolve => { releaseTag = resolve; });
     try { return await route.fulfill({ contentType: 'application/javascript', body: googleStub + (delayed ? 'window.__legalStubSend();' : '') }); }
     catch (_) { return; } // A withdrawal reload can cancel the pending response.
    }
    return route.fulfill({ status: 204, body: '' });
   }
   if (url.hostname !== 'legal01.test') return route.fulfill({ contentType: 'application/json', body: '{}' });
   const file = path.join(build, url.pathname === '/' || !path.extname(url.pathname) ? 'index.html' : url.pathname);
   if (!fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
   return route.fulfill({ body: fs.readFileSync(file), contentType: file.endsWith('.js') ? 'application/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.html') ? 'text/html' : 'application/octet-stream' });
  });
  const tags = () => requests.filter(url => url.includes('googletagmanager')).length;
  const sends = () => requests.filter(url => url.includes('/g/collect')).length;
  const loaded = () => page.waitForFunction(() => typeof window.__legalStubSend === 'function');
  const choose = async value => {
   await page.getByRole('button', { name: 'Privacy preferences' }).click();
   await page.getByRole('button', { name: value ? 'Accept analytics' : 'Reject analytics' }).click();
  };
  await page.goto('https://legal01.test/');
  await page.getByRole('button', { name: 'Reject analytics' }).waitFor();
  check(requests.length === 0, 'before choice: no Google requests');
  await page.getByRole('button', { name: 'Reject analytics' }).click();
  await page.reload();
  check(requests.length === 0, 'reject persists across reload: no Google requests');
  await choose(true);
  await loaded();
  check(tags() === 1, 'accept: Analytics script requested');
  const positiveSend = page.waitForResponse(response => response.url().includes('/g/collect'));
  await page.evaluate(() => window.__legalStubSend());
  await positiveSend;
  check(sends() === 1, 'positive control: synthetic collection works with accepted consent');
  await page.evaluate(() => document.cookie = '_ga=test; path=/');
  await choose(false);
  await page.waitForFunction(() => !document.querySelector('script[data-scorecard-ga]'));
  check(tags() === 1 && sends() === 1, 'withdraw: no new Google requests');
  check(await page.evaluate(() => !document.cookie.includes('_ga=')), 'withdraw: Analytics cookie removed');
  await choose(true);
  await loaded();
  check(tags() === 2, 'reaccept: new document can start Analytics');

  await page.evaluate(() => {
   const set = Storage.prototype.setItem, remove = Storage.prototype.removeItem;
   window.__legalStorage = { set, remove };
   Storage.prototype.setItem = function (...args) { if (this === localStorage) throw Error('read-only test storage'); return set.apply(this, args); };
   Storage.prototype.removeItem = function (...args) { if (this === localStorage) throw Error('read-only test storage'); return remove.apply(this, args); };
   window.__legalStubQueue();
  });
  await choose(false);
  await page.getByRole('alert').waitFor();
  check(await page.evaluate(() => window['ga-disable-G-X6BGH9S5F8'] && JSON.parse(localStorage.getItem('scorecardPrivacyChoice')).analytics), 'failed persistence disables despite a readable old grant');
  await page.evaluate(() => {
   history.pushState(null, '', '/news');
   window.dispatchEvent(new PopStateEvent('popstate'));
   window.__legalStubSend();
  });
  await page.waitForTimeout(350);
  check(tags() === 2 && sends() === 1, 'failed withdrawal blocks synthetic pending timers and navigation');
  check(await page.evaluate(() => !window.dataLayer.length), 'retired event wrapper does not enqueue stale events');
  await page.evaluate(() => {
   Storage.prototype.setItem = window.__legalStorage.set;
   Storage.prototype.removeItem = window.__legalStorage.remove;
  });
  await page.getByRole('button', { name: 'Accept analytics' }).click();
  await loaded();
  check(tags() === 3, 'fresh persisted acceptance clears denial and reloads a retired runtime');

  await page.evaluate(() => {
   window.__legalStubQueue();
   Object.defineProperty(navigator, 'globalPrivacyControl', { configurable: true, value: true });
  });
  check(await page.evaluate(() => window['ga-disable-G-X6BGH9S5F8']), 'open-page GPC immediately changes the Google opt-out value');
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.waitForTimeout(350);
  check(sends() === 1 && await page.evaluate(() => !document.querySelector('script[data-scorecard-ga]')), 'GPC blocks synthetic pending sends and cleans up the loader');
  await page.evaluate(() => Object.defineProperty(navigator, 'globalPrivacyControl', { configurable: true, value: false }));
  await choose(true);
  await loaded();
  const beforeExpiry = tags();
  await page.evaluate(() => {
   window.__legalStubQueue();
   const now = Date.now;
   Date.now = () => now() + 180 * 86400000;
  });
  check(await page.evaluate(() => window['ga-disable-G-X6BGH9S5F8']), 'open-page expiry immediately changes the Google opt-out value');
  await page.evaluate(() => history.replaceState(null, '', '/search'));
  await page.waitForTimeout(350);
  check(sends() === 1 && tags() === beforeExpiry && await page.evaluate(() => !document.querySelector('script[data-scorecard-ga]')), 'expired consent blocks synthetic pending sends and SPA loader restart');
  check(await page.evaluate(() => localStorage.getItem('scorecardPrivacyChoice') !== null), 'expired record remains stored as disclosed, without valid consent');

  await page.reload(); // Restores the actual clock in a fresh document.
  await loaded();
  await choose(false);
  await page.waitForFunction(() => !document.querySelector('script[data-scorecard-ga]'));
  delayTag = true;
  await choose(true);
  await page.waitForFunction(() => document.querySelector('script[data-scorecard-ga]'));
  while (!releaseTag) await page.waitForTimeout(10);
  await choose(false);
  releaseTag();
  await page.waitForTimeout(350);
  check(sends() === 1 && await page.evaluate(() => !document.querySelector('script[data-scorecard-ga]')), 'withdrawal cancels a delayed intercepted tag response without further collection');
  check(!requests.some(url => /googlesyndication|doubleclick/.test(url)), 'no advertising loader or request in any scenario');
 } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
