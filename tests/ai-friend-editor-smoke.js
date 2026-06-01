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
  let previewPrompt = '';
  let previewPayload = null;
  await page.route('http://127.0.0.1:11435/proxy/chat', async route => {
    const payload = route.request().postDataJSON();
    previewPayload = payload;
    previewPrompt = String(payload?.body?.messages?.[1]?.content || '');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        choices: [{ message: { content: '模型真的按这个片段接话了。' } }],
      }),
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
        name: '默认接口',
        baseUrl: 'http://unused-default.example/v1',
        model: 'default-model',
        temperature: 0.7,
        maxOutputTokens: 700,
      },
      {
        id: 'configured',
        name: '已配置接口',
        baseUrl: 'http://configured.example/v1',
        model: 'configured-model',
        temperature: 0.7,
        maxOutputTokens: 700,
      },
    ]));
    localStorage.setItem('rwm_model_api_keys', JSON.stringify({ default: 'default-key', configured: 'configured-key' }));
  });

  await page.goto('http://127.0.0.1:3000/app.html#friends', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForSelector('.friend-card', { timeout: 15000 });
  const initialFriendCount = await page.locator('.friend-card').count();
  await page.locator('.friend-card').first().click();
  await page.waitForSelector('[data-ai-friend-preview]', { timeout: 10000 });
  await page.waitForSelector('[data-advanced-prompt-panel]', { timeout: 10000 });

  await page.waitForSelector('[data-persona-sections]', { timeout: 10000 });
  const sectionBoxes = await page.locator('[data-persona-sections] .section-box').count();
  if (sectionBoxes < 5) throw new Error(`expected at least 5 persona section editors, got ${sectionBoxes}`);
  const exampleEditors = await page.locator('[data-persona-examples]').count();
  if (exampleEditors !== 1) throw new Error(`expected a single examples editor, got ${exampleEditors}`);
  const exampleRowsBefore = await page.locator('[data-persona-examples] .example-row').count();
  await page.getByRole('button', { name: '+ 添加案例' }).click();
  const exampleRowsAfter = await page.locator('[data-persona-examples] .example-row').count();
  if (exampleRowsAfter !== exampleRowsBefore + 1) throw new Error(`add example should append a row, ${exampleRowsBefore} -> ${exampleRowsAfter}`);

  const firstSample = await page.locator('.preview-sample').innerText();
  await page.getByRole('button', { name: '换一个示例' }).click();
  const secondSample = await page.locator('.preview-sample').innerText();
  if (firstSample === secondSample) throw new Error('preview sample should change');

  await page.getByRole('button', { name: '生成预览' }).click();
  await page.waitForFunction(() => {
    const output = document.querySelector('.preview-output')?.textContent || '';
    return output && !output.includes('点击') && !output.includes('正在生成');
  }, null, { timeout: 10000 });
  const previewOutput = await page.locator('.preview-output').innerText();
  if (previewOutput.trim() !== '模型真的按这个片段接话了。') {
    throw new Error(`preview output should come from the model call, got "${previewOutput}"`);
  }
  if (previewPayload?.baseUrl !== 'http://unused-default.example' || previewPayload?.apiKey !== 'default-key' || previewPayload?.body?.model !== 'default-model') {
    throw new Error(`preview should use the selected default profile, got ${JSON.stringify({
      baseUrl: previewPayload?.baseUrl,
      apiKey: previewPayload?.apiKey,
      model: previewPayload?.body?.model,
    })}`);
  }
  if (!previewPrompt.includes('[Preview Task]') || previewPrompt.includes('[Example Comments]')) {
    throw new Error('preview prompt should include task and should not include removed example comments');
  }

  const inlineAdvancedEditors = await page.locator('[data-advanced-prompt-panel] .advanced-prompt-box').count();
  if (inlineAdvancedEditors !== 0) throw new Error(`advanced prompt editor should not be inline, got ${inlineAdvancedEditors}`);
  await page.getByRole('button', { name: '进入高级微调' }).click();
  await page.waitForSelector('[data-advanced-prompt-page]', { timeout: 10000 });
  await page.waitForSelector('.advanced-prompt-box', { timeout: 10000 });
  const advancedText = await page.locator('.advanced-prompt-box').inputValue();
  if (!advancedText.includes('[Shared Rules]') || advancedText.includes('[Example Comments]')) {
    throw new Error('advanced prompt should be prefilled without removed example comments');
  }
  await page.getByRole('button', { name: '完成' }).click();
  await page.waitForSelector('[data-ai-friend-preview]', { timeout: 10000 });
  const disabledSectionCount = await page.locator('[data-persona-sections] .section-box:disabled').count();
  if (disabledSectionCount < 1) throw new Error('structured persona sections should be frozen in advanced mode');

  await page.getByRole('button', { name: '更多操作' }).click();
  await page.getByRole('button', { name: '删除AI书友' }).click();
  await page.getByRole('button', { name: '删除', exact: true }).click();
  await page.waitForFunction((count) => document.querySelectorAll('.friend-card').length === count - 1, initialFriendCount, { timeout: 10000 });
  const afterDeleteCount = await page.locator('.friend-card').count();
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.friend-card', { timeout: 15000 });
  const afterReloadCount = await page.locator('.friend-card').count();
  if (afterDeleteCount !== initialFriendCount - 1 || afterReloadCount !== afterDeleteCount) {
    throw new Error(`deleted friend should stay deleted, initial=${initialFriendCount}, afterDelete=${afterDeleteCount}, afterReload=${afterReloadCount}`);
  }

  if (consoleErrors.length) throw new Error(`console errors: ${consoleErrors.join(' | ')}`);
  await browser.close();
  console.log(JSON.stringify({
    sectionBoxes,
    exampleEditors,
    exampleRowsAfter,
    previewOutput,
    advancedSections: true,
    afterDeleteCount,
    consoleErrors: consoleErrors.length,
  }));
})().catch(async error => {
  console.error(error);
  process.exit(1);
});
