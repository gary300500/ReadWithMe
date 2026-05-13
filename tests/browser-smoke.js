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

  await page.addInitScript(() => {
    const novelId = 'smoke-book-1';
    const novelMeta = [{
      id: novelId,
      title: 'Smoke Test Novel',
      fileName: 'smoke.txt',
      totalChapters: 2,
      lastReadChapter: 0,
      maxReadChapter: 0,
      lastScrollPos: 0,
      addedAt: Date.now(),
      coverTheme: 1,
    }];
    const novelData = {
      chapters: [
        {
          title: '第 1 章 开始',
          content: [
            '第一段用于验证阅读页段落渲染。',
            '第二段用于验证段评入口和缓存评论回退逻辑。',
          ].join('\n\n'),
        },
        {
          title: '第 2 章 继续',
          content: '这一章只用于保证章节结构完整。',
        },
      ],
    };
    localStorage.setItem('rwm_novels', JSON.stringify(novelMeta));
    localStorage.setItem(`rwm_novel_${novelId}`, JSON.stringify(novelData));
  });

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
  await page.waitForSelector('[data-reader-paragraph]', { timeout: 10000 });
  await page.waitForSelector('[data-chapter-discussion]', { timeout: 10000 });
  await page.waitForSelector('[data-chapter-discussion-meta]', { timeout: 10000 });
  await page.waitForSelector('[data-prebuild-meta]', { timeout: 10000 });
  const chapterDiscussionMeta = await page.locator('[data-chapter-discussion-meta]').innerText();
  const prebuildMeta = await page.locator('[data-prebuild-meta]').innerText();
  if (!chapterDiscussionMeta.trim()) throw new Error('chapter discussion meta is empty');
  if (!prebuildMeta.trim()) throw new Error('prebuild meta is empty');
  await page.locator('[data-chapter-discussion] button').click();
  await page.waitForSelector('[data-comment-panel="true"]', { timeout: 10000 });
  await page.waitForSelector('.comment-text', { timeout: 10000 });
  await page.waitForSelector('[data-thread-composer]', { timeout: 10000 });
  await page.locator('[data-thread-composer] input').fill('这里他为什么突然退让？');
  await page.locator('[data-thread-composer] button').click();
  await page.waitForTimeout(1200);
  await page.waitForSelector('text=这里他为什么突然退让？', { timeout: 10000 });

  await browser.close();
  const relevantErrors = consoleErrors.filter(text => !/favicon|Failed to load resource/i.test(text));
  if (relevantErrors.length) throw new Error(`console errors: ${relevantErrors.join(' | ')}`);
  console.log(JSON.stringify({ initialProfiles, afterAddProfiles, optionCount, chapterDiscussionMeta, prebuildMeta, consoleErrors: relevantErrors.length }));
})().catch(error => {
  console.error(error);
  process.exit(1);
});
