const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const consoleErrors = [];
  const chatCalls = [];
  const chatPrompts = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', error => consoleErrors.push(error.message));
  await page.route('http://127.0.0.1:11435/proxy/chat', async route => {
    const payload = route.request().postDataJSON();
    const userPrompt = String(payload?.body?.messages?.[1]?.content || '');
    chatCalls.push(userPrompt.slice(0, 120));
    chatPrompts.push(userPrompt);
    const content = userPrompt.includes('summoned by the reader')
      ? 'AI summoned paragraph reply from model'
      : userPrompt.includes('reply to a reader comment') || userPrompt.includes('Reply target')
      ? 'AI nested reply from model'
      : userPrompt.includes('Paragraphs:')
      ? JSON.stringify({
        comments: [
          { paragraphIndex: 0, personaId: 'tucao', text: '開頭這段很適合拿來立氣氛。', discussionMode: 'open' },
          { paragraphIndex: 1, personaId: 'fenxi', text: '第二段也已經進入漸進段評緩存。', discussionMode: 'open' },
        ],
      })
      : JSON.stringify({
        summary: {
          chapterIndex: 0,
          plotSummary: '第一章建立了开局气氛和主要悬念。',
          majorCharacters: [{ name: '主角', state: '刚进入故事', salience: 'high' }],
          relationships: [],
          openQuestions: ['接下来会发生什么？'],
          worldFacts: [],
        },
        chapterComments: [{ personaId: 'tucao', text: '第一章這個收尾讓人覺得關係變複雜。', discussionMode: 'open' }],
      });
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        choices: [{
          message: {
            content,
          },
        }],
      }),
    });
  });

  await page.addInitScript(() => {
    const novelId = 'smoke-book-1';
    const novelMeta = [{
      id: novelId,
      title: 'Smoke Test Novel',
      fileName: 'smoke.txt',
      totalChapters: 8,
      lastReadChapter: 0,
      maxReadChapter: 0,
      lastScrollPos: 0,
      allowedPersonaIds: ['fenxi', 'kaozheng'],
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
            '第三段用于验证阅读控制面板的本章段落进度。',
          ].join('\n\n'),
        },
        { title: '第 2 章 继续', content: '这一章只用于保证章节结构完整。' },
        { title: '第 3 章 推进', content: '这一章只用于保证章节结构完整。' },
        { title: '第 4 章 转折', content: '这一章只用于保证章节结构完整。' },
        { title: '第 5 章 铺垫', content: '这一章只用于保证章节结构完整。' },
        { title: '第 6 章 高潮', content: '这一章用于验证手动 pregen 之外的章节存在。' },
        { title: '第 7 章 收束', content: '这一章用于验证手动 pregen 之外的章节存在。' },
        { title: '第 8 章 结尾', content: '这一章用于验证手动 pregen 之外的章节存在。' },
      ],
    };
    localStorage.setItem('rwm_novels', JSON.stringify(novelMeta));
    localStorage.setItem(`rwm_novel_${novelId}`, JSON.stringify(novelData));
    localStorage.setItem('rwm_live_settings', JSON.stringify({
      enabled: true,
      proxyUrl: 'http://127.0.0.1:11435',
      profileId: 'default',
      promptVersion: 'v2',
    }));
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

  await page.goto('http://127.0.0.1:3000/app.html#chapters', { waitUntil: 'networkidle', timeout: 30000 });
  await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForSelector('.chapter-row', { timeout: 10000 });
  if (await page.locator('[data-book-personas-card]').count() !== 0) {
    throw new Error('book personas should not render as an inline chapter-page card');
  }
  if (await page.locator('[data-ai-pregen-card]').count() !== 0) {
    throw new Error('AI pre-generation should not render as an inline chapter-page card');
  }
  await page.waitForFunction(() => {
    const raw = localStorage.getItem('rwm_ai_prebuild_state');
    if (!raw) return false;
    const state = JSON.parse(raw);
    return ['running', 'success'].includes(state.startupStatus)
      || (Array.isArray(state.queuedChapters) && state.queuedChapters[0] === 0);
  }, null, { timeout: 10000 });
  await page.waitForFunction(() => {
    const state = JSON.parse(localStorage.getItem('rwm_ai_prebuild_state') || '{}');
    return state.startupStatus === 'success';
  }, null, { timeout: 10000 });
  await page.waitForFunction(() => {
    const state = JSON.parse(localStorage.getItem('rwm_ai_prebuild_state') || '{}');
    return state.running === false && (!Array.isArray(state.queuedChapters) || state.queuedChapters.length === 0);
  }, null, { timeout: 15000 });
  const coldStartState = await page.evaluate(() => JSON.parse(localStorage.getItem('rwm_ai_prebuild_state') || '{}'));
  const personaScopedPrompts = chatPrompts.filter(prompt => prompt.includes('Available personas:'));
  if (!personaScopedPrompts.length) throw new Error('AI prompts should include persona scope');
  const leakedPrompt = personaScopedPrompts.find(prompt => prompt.includes('id=tucao'));
  if (leakedPrompt) {
    throw new Error(`book persona whitelist leaked into prompt: ${leakedPrompt.slice(0, 500)}`);
  }
  const personaScopedJoined = personaScopedPrompts.join(' | ');
  if (!personaScopedJoined.includes('id=fenxi') || !personaScopedJoined.includes('id=kaozheng')) {
    throw new Error(`book personas missing from prompts: ${personaScopedJoined.slice(0, 500)}`);
  }
  await page.locator('[data-book-actions-open]').click();
  await page.waitForSelector('[data-book-action="personas"]', { timeout: 10000 });
  await page.waitForSelector('[data-book-action="ai-pregen"]', { timeout: 10000 });
  await page.locator('[data-book-action="personas"]').click();
  await page.waitForSelector('[data-book-personas-dialog]', { timeout: 10000 });
  if (await page.locator('[data-book-persona-row="fenxi"][data-selected="true"]').count() !== 1) {
    throw new Error('book persona selector should show fenxi selected');
  }
  if (await page.locator('[data-book-persona-row="kaozheng"][data-selected="true"]').count() !== 1) {
    throw new Error('book persona selector should show kaozheng selected');
  }
  if (await page.locator('[data-book-persona-row="tucao"][data-selected="true"]').count() !== 0) {
    throw new Error('book persona selector should show tucao unselected');
  }
  const personaDialogOverflow = await page.locator('[data-book-personas-dialog]').evaluate(dialog => {
    const list = dialog.querySelector('.book-personas-list');
    const rows = Array.from(dialog.querySelectorAll('[data-book-persona-row]'));
    return {
      listOverflow: list ? list.scrollWidth - list.clientWidth : 0,
      rowOverflow: rows.map(row => row.scrollWidth - row.clientWidth).filter(value => value > 1),
    };
  });
  if (personaDialogOverflow.listOverflow > 1 || personaDialogOverflow.rowOverflow.length) {
    throw new Error(`book persona dialog should not scroll horizontally: ${JSON.stringify(personaDialogOverflow)}`);
  }
  await page.locator('[data-book-personas-action="done"]').click();
  await page.waitForSelector('[data-book-personas-dialog]', { state: 'detached', timeout: 10000 });
  await page.locator('[data-book-actions-open]').click();
  await page.waitForSelector('[data-book-action="ai-pregen"]', { timeout: 10000 });
  await page.locator('[data-book-action="ai-pregen"]').click();
  await page.waitForSelector('[data-ai-pregen-dialog]', { timeout: 10000 });
  await page.waitForSelector('[data-ai-pregen-card]', { timeout: 10000 });
  const aiPregenTitle = await page.locator('[data-ai-pregen-title]').innerText();
  if (!/AI\s*评论预生成/.test(aiPregenTitle)) {
    throw new Error(`AI pre-generation dialog should be named AI 评论预生成, got "${aiPregenTitle}"`);
  }
  const aiPregenAlpha = await page.locator('[data-ai-pregen-card]').evaluate(el => {
    const color = getComputedStyle(el).backgroundColor;
    const alpha = color.match(/rgba\([^,]+,[^,]+,[^,]+,\s*([0-9.]+)\)/);
    return alpha ? Number(alpha[1]) : 1;
  });
  if (aiPregenAlpha < 1) throw new Error(`AI pre-generation dialog should be opaque, got alpha=${aiPregenAlpha}`);
  await page.waitForSelector('[data-ai-frontier-meta]', { timeout: 10000 });
  const frontierBefore = await page.locator('[data-ai-frontier-meta]').innerText();
  if (!/5/.test(frontierBefore)) throw new Error(`AI pregen frontier should start at chapter 5 after auto-prebuild, got "${frontierBefore}"`);
  await page.locator('[data-ai-pregen-action="next-5"]').click();
  await page.waitForFunction(() => {
    const novels = JSON.parse(localStorage.getItem('rwm_novels') || '[]');
    const book = novels[0] || {};
    return book.aiGeneratedThrough === 7 && !book.aiGenerationJob?.running;
  }, null, { timeout: 30000 });
  const frontierAfter = await page.locator('[data-ai-frontier-meta]').innerText();
  if (!/8/.test(frontierAfter)) throw new Error(`AI pregen frontier should advance to chapter 8, got "${frontierAfter}"`);
  await page.locator('[data-ai-pregen-dialog]').click({ position: { x: 8, y: 8 } });
  await page.waitForSelector('[data-ai-pregen-dialog]', { state: 'detached', timeout: 10000 });
  const chatCallsAfterPregen = chatCalls.length;
  await page.locator('.chapter-row').nth(1).click();
  await page.waitForSelector('[data-reader-paragraph]', { timeout: 10000 });
  await page.waitForTimeout(1200);
  if (chatCalls.length !== chatCallsAfterPregen) {
    throw new Error(`opening a pre-generated chapter should not call model again: ${chatCallsAfterPregen} -> ${chatCalls.length}`);
  }

  await page.goto('http://127.0.0.1:3000/app.html#reader', { waitUntil: 'networkidle', timeout: 30000 });
  await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForSelector('.app-screen', { timeout: 10000 });
  await page.waitForSelector('[data-reader-paragraph]', { timeout: 10000 });
  if (await page.locator('.reader-progress').count() !== 0) {
    throw new Error('persistent reader progress bar should not render before tapping the reader');
  }
  await page.addStyleTag({ content: '.reader-article::after{content:"";display:block;height:1400px;}' });
  const savedChapterScroll = await page.evaluate(() => {
    const scroller = document.querySelector('.reader-scroll');
    if (!scroller) return 0;
    scroller.scrollTop = Math.min(360, Math.max(0, scroller.scrollHeight - scroller.clientHeight));
    return scroller.scrollTop;
  });
  if (savedChapterScroll < 120) {
    throw new Error(`reader test content should be scrollable, got scrollTop=${savedChapterScroll}`);
  }
  const tapReaderScroll = async (vertical = 'bottom') => {
    const point = await page.locator('.reader-scroll').evaluate((el, mode) => {
      const rect = el.getBoundingClientRect();
      return { x: rect.left + 24, y: mode === 'top' ? rect.top + 24 : rect.bottom - 24 };
    }, vertical);
    await page.mouse.click(point.x, point.y);
  };
  await tapReaderScroll('bottom');
  await page.waitForSelector('.chapter-jump-panel', { timeout: 10000 });
  await page.locator('.jump-controls button').nth(2).click();
  await page.waitForSelector('.chapter-jump-panel', { state: 'detached', timeout: 10000 });
  await page.waitForSelector('[data-reader-paragraph]', { timeout: 10000 });
  await tapReaderScroll('top');
  await page.waitForSelector('.chapter-jump-panel', { timeout: 10000 });
  await page.locator('.jump-controls button').first().click();
  await page.waitForSelector('.chapter-jump-panel', { state: 'detached', timeout: 10000 });
  await page.waitForFunction((expected) => {
    const scroller = document.querySelector('.reader-scroll');
    return scroller && Math.abs(scroller.scrollTop - expected) < 24;
  }, savedChapterScroll, { timeout: 10000 });
  await page.locator('[data-reader-paragraph="0"]').click();
  await page.waitForSelector('.chapter-jump-panel', { timeout: 10000 });
  const jumpMax = await page.locator('.jump-range').getAttribute('max');
  if (jumpMax !== '2') throw new Error(`reader jump range should track paragraph count, got max=${jumpMax}`);
  const jumpCenterText = await page.locator('.jump-controls span').innerText();
  if (!/1\/8/.test(jumpCenterText) || /段/.test(jumpCenterText)) {
    throw new Error(`reader jump controls should show chapter count, got "${jumpCenterText}"`);
  }
  await page.locator('.plain-backdrop').click();
  await page.waitForSelector('.chapter-jump-panel', { state: 'detached', timeout: 10000 });
  await page.locator('.reader-scroll').click({ position: { x: 8, y: 8 } });
  const expectedBottomVisibleParagraph = await page.evaluate(() => {
    const scroller = document.querySelector('.reader-scroll');
    const items = Array.from(document.querySelectorAll('[data-reader-paragraph]'));
    if (!scroller || !items.length) return 0;
    const scrollRect = scroller.getBoundingClientRect();
    const bottomLine = scrollRect.bottom - 24;
    let selected = 0;
    items.forEach(item => {
      const rect = item.getBoundingClientRect();
      if (rect.top < bottomLine && rect.bottom > scrollRect.top) {
        selected = Number(item.dataset.readerParagraph || 0);
      }
    });
    return selected;
  });
  await page.waitForSelector('.chapter-jump-panel', { timeout: 10000 });
  const inferredJumpValue = await page.locator('.jump-range').inputValue();
  if (inferredJumpValue !== String(expectedBottomVisibleParagraph)) {
    throw new Error(`reader area tap should infer bottom visible paragraph, got value=${inferredJumpValue}, expected=${expectedBottomVisibleParagraph}`);
  }
  await page.locator('.plain-backdrop').click();
  await page.waitForSelector('.chapter-jump-panel', { state: 'detached', timeout: 10000 });
  const secondParagraphBeforeActions = await page.locator('[data-reader-paragraph="1"]').boundingBox();
  await page.locator('[data-reader-paragraph="0"]').click({ button: 'right' });
  await page.waitForSelector('[data-paragraph-actions]', { timeout: 10000 });
  const secondParagraphAfterActions = await page.locator('[data-reader-paragraph="1"]').boundingBox();
  if (!secondParagraphBeforeActions || !secondParagraphAfterActions || Math.abs(secondParagraphAfterActions.y - secondParagraphBeforeActions.y) > 1) {
    throw new Error(`paragraph actions should overlay without shifting text, before=${secondParagraphBeforeActions?.y}, after=${secondParagraphAfterActions?.y}`);
  }
  const actionBg = await page.locator('[data-paragraph-actions]').evaluate(el => getComputedStyle(el).backgroundColor);
  if (!/rgba?\(0,\s*0,\s*0/i.test(actionBg)) {
    throw new Error(`paragraph actions should use a black background, got "${actionBg}"`);
  }
  const actionClass = await page.locator('[data-paragraph-actions]').getAttribute('class');
  if (/sheet-panel|paragraph-action-panel/.test(actionClass || '')) {
    throw new Error(`paragraph actions should render inline, got class="${actionClass}"`);
  }
  await page.locator('[data-reader-paragraph="1"]').click();
  await page.waitForSelector('[data-paragraph-actions]', { state: 'detached', timeout: 10000 });
  await page.locator('[data-reader-paragraph="0"]').click({ button: 'right' });
  await page.waitForSelector('[data-paragraph-actions]', { timeout: 10000 });
  await page.locator('[data-paragraph-action="summon"]').click();
  await page.waitForSelector('[data-paragraph-summon-panel]', { timeout: 10000 });
  await page.locator('[data-paragraph-summon-generate]').click();
  await page.waitForSelector('[data-paragraph-summon-panel]', { state: 'detached', timeout: 10000 });
  if (await page.locator('[data-comment-panel="true"]').count() !== 0) {
    throw new Error('paragraph summon should not lock the reader in a comment panel');
  }
  await page.locator('[data-reader-paragraph="0"]').click({ button: 'right' });
  await page.waitForSelector('[data-paragraph-actions]', { timeout: 10000 });
  await page.locator('[data-paragraph-action="comment"]').click();
  await page.waitForSelector('[data-comment-panel="true"]', { timeout: 10000 });
  await page.locator('.sheet-close').first().click();
  await page.waitForSelector('[data-comment-panel="true"]', { state: 'detached', timeout: 10000 });
  await page.waitForSelector('[data-chapter-discussion]', { timeout: 10000 });
  await page.waitForSelector('[data-chapter-discussion-meta]', { timeout: 10000 });
  await page.waitForSelector('[data-prebuild-meta]', { timeout: 10000 });
  const chapterDiscussionAfterText = await page.evaluate(() => {
    const firstParagraph = document.querySelector('[data-reader-paragraph]');
    const chapterDiscussion = document.querySelector('[data-chapter-discussion]');
    return Boolean(firstParagraph && chapterDiscussion && firstParagraph.compareDocumentPosition(chapterDiscussion) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
  if (!chapterDiscussionAfterText) throw new Error('chapter discussion entry is not rendered after chapter text');
  const chapterDiscussionMeta = await page.locator('[data-chapter-discussion-meta]').innerText();
  const prebuildMeta = await page.locator('[data-prebuild-meta]').innerText();
  if (!chapterDiscussionMeta.trim()) throw new Error('chapter discussion meta is empty');
  if (!prebuildMeta.trim()) throw new Error('prebuild meta is empty');
  const visibleCommentText = await page.locator('.chapter-end-preview-text').allInnerTexts();
  const joinedVisibleCommentText = visibleCommentText.join('\n');
  if (/這|關係|變|複雜|覺得/.test(joinedVisibleCommentText)) {
    throw new Error(`AI comments should render in Simplified Chinese, got "${joinedVisibleCommentText}"`);
  }
  if (!joinedVisibleCommentText.includes('关系变复杂')) {
    throw new Error(`AI comments should include simplified converted text, got "${joinedVisibleCommentText}"`);
  }
  const chapterPreviewAlign = await page.locator('.chapter-end-preview').first().evaluate(el => getComputedStyle(el).textAlign);
  if (!['left', 'start'].includes(chapterPreviewAlign)) {
    throw new Error(`chapter discussion preview should be left-aligned, got ${chapterPreviewAlign}`);
  }
  await page.locator('.chapter-end-discussion-header').click();
  await page.waitForSelector('[data-comment-panel="true"]', { timeout: 10000 });
  await page.waitForSelector('.comments-list', { timeout: 10000 });
  if (await page.locator('.sheet-tabs').count() !== 0) {
    throw new Error('comment sorting tabs should be removed');
  }
  await page.waitForSelector('[data-comment-action="like"]', { timeout: 10000 });
  const firstLike = page.locator('[data-comment-action="like"]').first();
  const beforeLikes = Number(await firstLike.locator('[data-like-count]').innerText());
  await firstLike.click();
  const afterLikes = Number(await firstLike.locator('[data-like-count]').innerText());
  if (afterLikes !== beforeLikes + 1 || await firstLike.getAttribute('aria-pressed') !== 'true') {
    throw new Error(`comment like should increment and become active: ${beforeLikes} -> ${afterLikes}`);
  }
  await firstLike.click();
  const restoredLikes = Number(await firstLike.locator('[data-like-count]').innerText());
  if (restoredLikes !== beforeLikes || await firstLike.getAttribute('aria-pressed') !== 'false') {
    throw new Error(`comment unlike should restore the original count: ${restoredLikes} vs ${beforeLikes}`);
  }
  await page.waitForSelector('[data-thread-composer]', { timeout: 10000 });
  await page.locator('[data-thread-composer] input').fill('用户主评论：这里为什么突然退让？');
  await page.locator('[data-thread-composer] button').click();
  await page.waitForTimeout(1200);
  await page.waitForSelector('text=用户主评论：这里为什么突然退让？', { timeout: 10000 });
  await page.waitForSelector('[data-comment-level="root"][data-comment-source="reader"]', { timeout: 10000 });
  await page.waitForSelector('[data-comment-reply]', { timeout: 10000 });
  if (await page.locator('text=继续讨论').count() > 0) {
    throw new Error('comment panel should not render a separate continue discussion section');
  }

  const replyLikeLayout = await page.locator('[data-comment-reply]').first().evaluate(el => {
    const main = el.querySelector('.comment-main');
    const like = el.querySelector('[data-comment-action="like"]');
    const itemRect = el.getBoundingClientRect();
    const mainRect = main?.getBoundingClientRect();
    const likeRect = like?.getBoundingClientRect();
    return {
      hasLike: Boolean(like),
      itemTop: itemRect.top,
      itemRight: itemRect.right,
      mainRight: mainRect?.right || 0,
      likeLeft: likeRect?.left || 0,
      likeTop: likeRect?.top || 0,
      likeRight: likeRect?.right || 0,
    };
  });
  if (!replyLikeLayout.hasLike || replyLikeLayout.likeLeft <= replyLikeLayout.mainRight || replyLikeLayout.likeRight > replyLikeLayout.itemRight + 1 || Math.abs(replyLikeLayout.likeTop - replyLikeLayout.itemTop) > 16) {
    throw new Error(`reply like button should stay in the right-side column: ${JSON.stringify(replyLikeLayout)}`);
  }

  const aiReplyButtons = page.locator('[data-comment-source="llm"] [data-comment-action="reply"]');
  if (await aiReplyButtons.count() < 1) throw new Error('AI comments should expose a reply action');
  await aiReplyButtons.first().click();
  await page.locator('[data-thread-composer] input').fill('回复AI评论：这个角度有意思');
  await page.locator('[data-thread-composer] button').click();
  await page.waitForSelector('text=回复AI评论：这个角度有意思', { timeout: 10000 });
  await page.waitForSelector('[data-comment-reply-to]', { timeout: 10000 });

  const summonReplyButtons = page.locator('[data-comment-source="llm"] [data-comment-action="summon-reply"]');
  if (await summonReplyButtons.count() < 1) throw new Error('AI comments should expose a summon reply action');
  await summonReplyButtons.first().click();
  await page.waitForSelector('[data-comment-summon-panel]', { timeout: 10000 });
  if (await page.locator('[data-comment-summon-persona="fenxi"]').count() !== 1) {
    throw new Error('comment summon panel should allow selecting fenxi');
  }
  if (await page.locator('[data-comment-summon-persona="kaozheng"]').count() !== 1) {
    throw new Error('comment summon panel should allow selecting kaozheng');
  }
  await page.locator('[data-comment-summon-persona="kaozheng"]').click();
  await page.locator('[data-comment-summon-generate]').click();
  await page.waitForSelector('[data-comment-summon-panel]', { state: 'detached', timeout: 10000 });
  await page.waitForSelector('text=AI nested reply from model', { timeout: 10000 });

  await browser.close();
  const relevantErrors = consoleErrors.filter(text => !/favicon|Failed to load resource/i.test(text));
  if (relevantErrors.length) throw new Error(`console errors: ${relevantErrors.join(' | ')}`);
  console.log(JSON.stringify({ initialProfiles, afterAddProfiles, optionCount, coldStartQueued: coldStartState.queuedChapters, chapterDiscussionMeta, prebuildMeta, consoleErrors: relevantErrors.length }));
})().catch(error => {
  console.error(error);
  process.exit(1);
});
