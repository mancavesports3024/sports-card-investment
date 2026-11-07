// Captures what the real gtag.js runtime (with the live stream's enhanced
// measurement configuration) would send, against the local build only.
// gtag.js is downloaded once by Node without cookies or referrer; every
// collection request is captured and answered locally, never forwarded.
// All tokens and search terms are fake markers.
const fs = require('fs');
const path = require('path');
const { chromium } = require(process.env.LEGAL01_PLAYWRIGHT_PATH || 'playwright');
const build = path.join(__dirname, '..', 'frontend', 'build');
const GA_ID = 'G-X6BGH9S5F8';
const MARKERS = ['FAKE_SEARCH_LEGAL01', 'FAKE_QUERY_LEGAL01', 'FAKE_PUSH_LEGAL01', 'FAKE_TOKEN_LEGAL01', 'FAKE_REFRESH_LEGAL01'];
const evidencePath = process.env.LEGAL01_CAPTURE_OUT;
const check = (ok, label) => { if (!ok) throw Error(label); console.log('PASS ' + label); };

function parseHits(entry) {
  const shared = Object.fromEntries(new URL(entry.url).searchParams);
  const lines = (entry.body || '').split('\n').filter(Boolean);
  return (lines.length ? lines : ['']).map(line => ({ ...shared, ...Object.fromEntries(new URLSearchParams(line)) }));
}

(async () => {
  const gtagSource = await (await fetch(`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`, { credentials: 'omit', referrerPolicy: 'no-referrer' })).text();
  check(gtagSource.length > 10000, 'real gtag.js downloaded for local replay');

  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const phases = { current: 'before-consent' };
  const google = [];
  try {
    const context = await browser.newContext({ serviceWorkers: 'block' });
    const page = await context.newPage();
    await page.route('**/*', async route => {
      const request = route.request();
      const url = new URL(request.url());
      if (/(^|\.)(google-analytics|googletagmanager|doubleclick|googlesyndication|googleadservices)\.com$|(^|\.)google\.com$/.test(url.hostname)) {
        google.push({ phase: phases.current, url: url.href, body: request.postData() || '' });
        if (url.hostname === 'www.googletagmanager.com' && url.pathname === '/gtag/js') {
          return route.fulfill({ contentType: 'application/javascript', body: gtagSource });
        }
        return route.fulfill({ status: 204, body: '' });
      }
      if (url.hostname !== 'legal01.test') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, sales: [], results: [] }) });
      }
      const file = path.join(build, url.pathname === '/' || !path.extname(url.pathname) ? 'index.html' : url.pathname);
      if (!fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
      return route.fulfill({ body: fs.readFileSync(file), contentType: file.endsWith('.js') ? 'application/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.html') ? 'text/html' : 'application/octet-stream' });
    });
    const settle = () => page.waitForTimeout(6000);
    const flush = async () => { await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await settle(); };
    const inPhase = name => google.filter(entry => entry.phase === name);
    const exercise = async () => {
      await page.goto('https://legal01.test/');
      await page.waitForTimeout(1500);
      await page.locator('a[href="/search"]').first().click();
      await page.locator('#search-form input[type="text"], #search-form input:not([type])').first().fill('FAKE_SEARCH_LEGAL01');
      await page.locator('#search-form').evaluate(form => form.requestSubmit());
      await page.waitForTimeout(1500);
      await page.evaluate(() => {
        history.pushState(null, '', '/news?search=FAKE_PUSH_LEGAL01');
        window.dispatchEvent(new PopStateEvent('popstate'));
      });
      await page.waitForTimeout(1500);
      await page.goto('https://legal01.test/news?q=FAKE_QUERY_LEGAL01&tab=guides');
      await page.waitForTimeout(1500);
      await page.goto('https://legal01.test/auth-success?token=FAKE_TOKEN_LEGAL01&refreshToken=FAKE_REFRESH_LEGAL01');
      await flush();
    };

    await page.goto('https://legal01.test/');
    await page.getByRole('button', { name: 'Accept analytics' }).waitFor();
    await exercise();
    check(inPhase('before-consent').length === 0, 'before consent: no Google requests across navigation, search, query URLs and callback');

    phases.current = 'after-consent';
    await page.goto('https://legal01.test/');
    await page.getByRole('button', { name: 'Accept analytics' }).click();
    await page.waitForLoadState('load');
    await settle();
    await exercise();
    const consented = inPhase('after-consent');
    check(consented.some(entry => entry.url.includes('/gtag/js')), 'after consent: gtag.js requested');
    check(consented.some(entry => entry.url.includes('/collect')), 'after consent: collection requests captured (positive control)');

    phases.current = 'after-withdrawal';
    await page.goto('https://legal01.test/');
    await page.getByRole('button', { name: 'Privacy preferences' }).click();
    await page.getByRole('button', { name: 'Reject analytics' }).click();
    await page.waitForLoadState('load');
    await page.waitForTimeout(1500);
    phases.current = 'after-withdrawal-actions';
    await exercise();
    check(inPhase('after-withdrawal-actions').length === 0, 'after withdrawal: no Google requests across navigation, search, query URLs and callback');

    const hits = consented.filter(entry => entry.url.includes('/collect')).flatMap(parseHits);
    const summary = hits.map(hit => ({
      en: hit.en, dl: hit.dl, dr: hit.dr,
      search_term: hit['ep.search_term'],
      form_id: hit['ep.form_id'], form_name: hit['ep.form_name'], form_destination: hit['ep.form_destination'],
      other_ep: Object.keys(hit).filter(key => key.startsWith('ep.') && !['ep.search_term', 'ep.form_id', 'ep.form_name', 'ep.form_destination'].includes(key)),
    }));
    const raw = JSON.stringify(consented);
    const markerHits = Object.fromEntries(MARKERS.map(marker => [marker, raw.includes(marker)]));
    console.log('events after consent:', JSON.stringify(summary, null, 1));
    console.log('fake markers present in Google requests after consent:', JSON.stringify(markerHits));
    console.log('withdrawal-phase requests before actions (reload cleanup):', inPhase('after-withdrawal').length);
    if (evidencePath) fs.writeFileSync(evidencePath, JSON.stringify({ summary, markerHits, requests: google }, null, 1));
  } finally {
    await browser.close();
  }
})().catch(error => { console.error('FAIL ' + error.message); process.exitCode = 1; });
