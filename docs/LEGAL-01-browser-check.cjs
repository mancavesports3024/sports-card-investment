const fs = require('fs');
const path = require('path');
const { chromium } = require(process.env.LEGAL01_PLAYWRIGHT_PATH || 'playwright');
(async () => {
 const browser = await chromium.launch({headless:true, channel:"msedge"});
 const page = await browser.newPage();
 const requests = [];
 await page.route('**/*', async route => {
  const url = new URL(route.request().url());
  if (/google-analytics|googletagmanager|googlesyndication|doubleclick/.test(url.hostname)) {
   requests.push(url.href);
   return route.fulfill({contentType:'application/javascript',body:'// inert Google stub; no external requests'});
  }
  if (url.hostname !== 'legal01.test') return route.fulfill({contentType:'application/json',body:'{}'});
  let file = path.join(__dirname,'..','frontend','build', url.pathname === '/' || !path.extname(url.pathname) ? 'index.html' : url.pathname);
  if (!fs.existsSync(file)) return route.fulfill({status:404,body:''});
  return route.fulfill({body:fs.readFileSync(file),contentType:file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'application/octet-stream'});
 });
 const check = (ok, label) => { if (!ok) throw Error(label); console.log('PASS '+label); };
 await page.goto('https://legal01.test/');
 await page.getByRole('button',{name:'Reject analytics'}).waitFor();
 check(requests.length===0,'before choice: no Google requests');
 await page.getByRole('button',{name:'Reject analytics'}).click();
 await page.reload();
 check(requests.length===0,'reject persists across reload: no Google requests');
 await page.getByRole('button',{name:'Privacy preferences'}).click();
 await page.getByRole('button',{name:'Accept analytics'}).click();
 await page.waitForFunction(()=>document.querySelector('script[data-scorecard-ga]'));
 check(requests.length===1 && requests[0].includes('googletagmanager'),'accept: only Analytics script requested, no advertising');
 await page.evaluate(()=>document.cookie='_ga=test; path=/');
 await page.getByRole('button',{name:'Privacy preferences'}).click();
 await page.getByRole('button',{name:'Reject analytics'}).click();
 await page.waitForLoadState();
 await page.waitForFunction(()=>!document.querySelector('script[data-scorecard-ga]'));
 check(requests.length===1,'withdraw: no additional Google requests');
 check(await page.evaluate(()=>!document.cookie.includes('_ga=')),'withdraw: Analytics cookie removed');
 await page.getByRole('button',{name:'Privacy preferences'}).click();
 await page.getByRole('button',{name:'Accept analytics'}).click();
 await page.waitForFunction(()=>document.querySelector('script[data-scorecard-ga]'));
 check(requests.length===2,'reaccept: Analytics restarts');
 await page.screenshot({path:path.join(__dirname,'privacy-choices.png'),fullPage:true});
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
