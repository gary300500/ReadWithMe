const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  let chatCalls = 0;
  let chatPayload = null;
  await page.route('http://127.0.0.1:11435/proxy/chat', async route => {
    chatCalls += 1;
    chatPayload = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ choices: [{ message: { content: '默认 Ollama 无 Key 也能预览。' } }] }),
    });
  });

  await page.addInitScript(() => {
    localStorage.setItem('rwm_demo_seeded', '1');
    localStorage.setItem('rwm_live_settings', JSON.stringify({
      enabled: false,
      proxyUrl: 'http://127.0.0.1:11435',
      profileId: 'default',
      promptVersion: 'v2',
    }));
    localStorage.setItem('rwm_model_profiles', JSON.stringify([
      {
        id: 'default',
        name: '默认 Ollama',
        baseUrl: 'http://ollama.example/v1',
        model: 'ollama-model',
        temperature: 0.7,
        maxOutputTokens: 700,
      },
      {
        id: 'configured',
        name: '别的接口',
        baseUrl: 'http://configured.example/v1',
        model: 'configured-model',
        temperature: 0.7,
        maxOutputTokens: 700,
      },
    ]));
    localStorage.setItem('rwm_model_api_keys', JSON.stringify({ configured: 'configured-key' }));
  });

  await page.goto('http://127.0.0.1:3000/app.html#friends', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForSelector('.friend-card', { timeout: 15000 });
  await page.locator('.friend-card').first().click();
  await page.waitForSelector('[data-ai-friend-preview]', { timeout: 10000 });
  await page.getByRole('button', { name: '生成预览' }).click();
  await page.waitForFunction(() => {
    const output = document.querySelector('.preview-output')?.textContent || '';
    return output.includes('默认 Ollama 无 Key 也能预览');
  }, null, { timeout: 10000 });
  const previewOutput = await page.locator('.preview-output').innerText();
  if (chatCalls !== 1) throw new Error(`preview should call selected default profile exactly once, chatCalls=${chatCalls}`);
  if (chatPayload?.baseUrl !== 'http://ollama.example' || chatPayload?.apiKey !== '' || chatPayload?.body?.model !== 'ollama-model') {
    throw new Error(`preview should use selected default Ollama without API key, got ${JSON.stringify({
      baseUrl: chatPayload?.baseUrl,
      apiKey: chatPayload?.apiKey,
      model: chatPayload?.body?.model,
    })}`);
  }
  await browser.close();
  console.log(JSON.stringify({ chatCalls, previewOutput, baseUrl: chatPayload.baseUrl, apiKey: chatPayload.apiKey, model: chatPayload.body.model }));
})().catch(error => {
  console.error(error);
  process.exit(1);
});
