const assert = require('node:assert/strict');
const { chromium } = require('playwright');

// Start the dev or exported site server separately; never connects to production.
(async () => {
  const target = process.env.EXPLORER_TEST_URL || 'http://127.0.0.1:3100';
  const parsed = new URL(target);
  assert.ok(['127.0.0.1', 'localhost'].includes(parsed.hostname), 'Use a local test server');
  const browser = await chromium.launch({
    ...(process.env.EXPLORER_CHROMIUM_PATH ? { executablePath: process.env.EXPLORER_CHROMIUM_PATH } : {}),
    headless: true,
  });
  try {
    const page = await browser.newPage();
    const errors = [];
    const remoteRequests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => {
      const url = new URL(request.url());
      if (url.protocol.startsWith('http') && !['localhost', '127.0.0.1'].includes(url.hostname)) remoteRequests.push(url.origin);
    });
    await page.goto(target, { waitUntil: 'networkidle' });
    assert.match(await page.title(), /Owl Academy/);
    await page.getByText('145 matching tomes', { exact: true }).waitFor();
    await page.getByLabel('Search the canon').fill('CLIFFORD');
    await page.waitForFunction(() => [...document.querySelectorAll('.tome')].length > 0 && [...document.querySelectorAll('.tome h3')].every(x => x.textContent.toLowerCase().includes('clifford')));
    await page.getByLabel('Search the canon').fill('');
    await page.getByLabel('Department', { exact: true }).selectOption('X');
    await page.getByText('64 matching tomes', { exact: true }).waitFor();
    await page.getByLabel('Search the canon').fill('not-an-academy-tome-997');
    await page.getByText('No tomes match. Try another title or department.').waitFor();
    await page.getByRole('button', { name: /Celestial Observatory/ }).click();
    assert.equal(await page.getByRole('button', { name: /Celestial Observatory/ }).getAttribute('aria-pressed'), 'true');
    await page.getByRole('heading', { name: 'Celestial Observatory', exact: true }).waitFor();
    await page.getByLabel('Search the canon').fill('');
    await page.getByLabel('Department', { exact: true }).selectOption('all');
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false, 'Mobile horizontal overflow');
    assert.deepEqual(errors, [], 'Browser runtime errors');
    assert.deepEqual(remoteRequests, [], 'Scaffold must not contact external/production services');
    if (process.env.EXPLORER_SCREENSHOT) await page.screenshot({ path: process.env.EXPLORER_SCREENSHOT, fullPage: true });
    console.log('PASS browser smoke: real canon, search, department filter, empty state, module navigation, mobile layout, no runtime errors or external requests');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
