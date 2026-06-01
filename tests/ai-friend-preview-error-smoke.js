const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const consoleErrors = [];
  page.on('console', msg => {
    const text = msg.text();
    if (msg.type() === 'error' && !/favicon|Failed to load resource/.test(text)) consoleErrors.push(text);
  });
  page.on('pageerror', error => consoleErrors.push(error.message));

  await page.route('http://127.0.0.1:11435/proxy/chat', async route => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ error: { message: 'User not found' } }),
    });
  });

  await page.addInitScript(() => {
    localStorage.setItem('rwm_demo_seeded', '1');
    localStorage.setItem('rwm_live_settings', JSON.stringify({
      enabled: false,
      proxyUrl: 'http://127.0.0.1:11435',
      profileId: 'configured',
      promptVersion: 'v2',
    }));
    localStorage.setItem('rwm_model_profiles', JSON.stringify([
      {
        id: 'configured',
        name: '我的可用接口',
        baseUrl: 'http://configured.example/v1',
        model: 'configured-model',
        temperature: 0.7,
        maxOutputTokens: 700,
      },
    ]));
    localStorage.setItem('rwm_model_api_keys', JSON.stringify({ configured: 'bad-key' }));
  });

  await page.goto('http://127.0.0.1:3000/app.html#friends', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForSelector('.friend-card', { timeout: 15000 });
  await page.locator('.friend-card').first().click();
  await page.waitForSelector('[data-ai-friend-preview]', { timeout: 10000 });
  await page.getByRole('button', { name: '生成预览' }).click();
  await page.waitForFunction(() => {
    const output = document.querySelector('.preview-output')?.textContent || '';
    return output.includes('User not found');
  }, null, { timeout: 10000 });
  const previewOutput = await page.locator('.preview-output').innerText();
  if (!previewOutput.includes('我的可用接口') || !previewOutput.includes('configured-model')) {
    throw new Error(`preview error should include profile and model context, got "${previewOutput}"`);
  }
  if (consoleErrors.length) throw new Error(`console errors: ${consoleErrors.join(' | ')}`);
  await browser.close();
  console.log(JSON.stringify({ previewOutput, consoleErrors: consoleErrors.length }));
})().catch(error => {
  console.error(error);
  process.exit(1);
});
