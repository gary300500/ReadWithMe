const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', error => consoleErrors.push(error.message));

  await page.goto('http://127.0.0.1:3000/app.html#settings', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForSelector('.profile-row', { timeout: 15000 });
  const initialProfiles = await page.locator('.profile-row').count();
  await page.locator('.profile-tools button').first().click();
  const afterAddProfiles = await page.locator('.profile-row').count();
  if (afterAddProfiles !== initialProfiles + 1) {
    throw new Error(`profile count did not increase: ${initialProfiles} -> ${afterAddProfiles}`);
  }
  if (await page.locator('.profile-pill').count() < 1) {
    throw new Error('default profile marker missing');
  }
  const defaultButton = page.locator('.profile-tools button').nth(1);
  if (await defaultButton.isEnabled()) await defaultButton.click();

  await page.goto('http://127.0.0.1:3000/app.html#friends', { waitUntil: 'networkidle', timeout: 30000 });
  await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForSelector('.friend-card', { timeout: 10000 });
  await page.locator('.friend-card').first().click();
  await page.waitForSelector('select.input', { timeout: 10000 });
  const optionCount = await page.locator('select.input option').count();
  if (optionCount < 2) throw new Error(`interface selector has too few options: ${optionCount}`);

  await page.goto('http://127.0.0.1:3000/app.html#reader', { waitUntil: 'networkidle', timeout: 30000 });
  await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForSelector('.app-screen', { timeout: 10000 });

  await browser.close();
  const relevantErrors = consoleErrors.filter(text => !/favicon|Failed to load resource/i.test(text));
  if (relevantErrors.length) throw new Error(`console errors: ${relevantErrors.join(' | ')}`);
  console.log(JSON.stringify({ initialProfiles, afterAddProfiles, optionCount, consoleErrors: relevantErrors.length }));
})().catch(error => {
  console.error(error);
  process.exit(1);
});
