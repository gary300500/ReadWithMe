# AI Reading Interaction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add threaded paragraph and chapter AI interaction, rolling chapter memory, controlled AI-to-AI replies, and a cold-start plus rolling pre-generation pipeline to the current single-file reader app.

**Architecture:** Keep the current `app.html`-centric architecture. Add small pure helper sections inside `app.html` for memory artifacts, thread state, structured-output validation flow, and pre-generation scheduling, then expose them through the existing app state and reader UI. Add Node-based helper tests for pure orchestration logic and extend the browser smoke test to cover the new reader and chapter discussion surfaces.

**Tech Stack:** Static HTML, React 18 UMD, Babel in-browser transform, localStorage, fetch to the existing Python proxy, Node test scripts, browser smoke test.

---

## File Structure

**Modify:**
- `app.html` - all runtime helpers, schemas, prompt builders, app state, reader UI, chapter discussion UI, generation orchestration, and cache persistence.
- `tests/browser-smoke.js` - extend the smoke flow to validate the new chapter discussion surface and threaded interaction shell.

**Create:**
- `tests/ai-reading-helpers.test.js` - pure helper tests for summary artifact validation, candidate/committed transitions, thread compression bookkeeping, and pre-generation scheduling.

## Task 1: Define New Storage Keys, Shapes, and Pure Helper Boundaries

**Files:**
- Modify: `app.html`
- Test: `tests/ai-reading-helpers.test.js`

- [ ] **Step 1: Write the failing helper test for the new data shape helpers**

```js
const assert = require('node:assert/strict');

assert.equal(typeof buildChapterMemoryKey, 'function');
assert.equal(buildChapterMemoryKey('book-1', 3), 'rwm_ai_memory_book-1_3');

assert.equal(typeof buildChapterThreadKey, 'function');
assert.equal(buildChapterThreadKey('book-1', 3), 'chapter:book-1:3');

assert.equal(typeof buildParagraphThreadKey, 'function');
assert.equal(buildParagraphThreadKey('book-1', 3, 7), 'paragraph:book-1:3:7');
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```powershell
node tests\ai-reading-helpers.test.js
```

Expected: FAIL because the helper file has not been created yet.

- [ ] **Step 3: Create the helper test harness with the new storage and key helpers**

```js
function buildChapterMemoryKey(novelId, chapterIndex) {
  return `rwm_ai_memory_${novelId}_${chapterIndex}`;
}

function buildChapterCommentKey(novelId, chapterIndex) {
  return `rwm_ai_comments_${novelId}_${chapterIndex}`;
}

function buildChapterThreadKey(novelId, chapterIndex) {
  return `chapter:${novelId}:${chapterIndex}`;
}

function buildParagraphThreadKey(novelId, chapterIndex, paragraphIndex) {
  return `paragraph:${novelId}:${chapterIndex}:${paragraphIndex}`;
}
```

- [ ] **Step 4: Mirror those helpers into `app.html` and add the new storage keys**

```js
const STORAGE_KEYS = {
  novels: 'rwm_novels',
  settings: 'rwm_settings',
  liveSettings: 'rwm_live_settings',
  modelProfiles: 'rwm_model_profiles',
  personas: 'rwm_personas',
  personasVersion: 'rwm_personas_version',
  apiKeys: 'rwm_model_api_keys',
  aiThreads: 'rwm_ai_threads',
  aiPrebuildState: 'rwm_ai_prebuild_state',
};
```

- [ ] **Step 5: Run the helper test to verify it passes**

Run:

```powershell
node tests\ai-reading-helpers.test.js
```

Expected: PASS with a console line confirming the helper assertions passed.

- [ ] **Step 6: Commit**

```bash
git add app.html tests/ai-reading-helpers.test.js
git commit -m "test: define ai reading storage and thread key helpers"
```

## Task 2: Add Summary Artifact Validation and Candidate/Committed Promotion

**Files:**
- Modify: `app.html`
- Modify: `tests/ai-reading-helpers.test.js`

- [ ] **Step 1: Write the failing test for summary artifact validation**

```js
const candidate = {
  chapterIndex: 2,
  plotSummary: 'The pressure in the city escalates.',
  majorCharacters: [{ name: 'Lin', state: 'More cautious', salience: 'high' }],
  relationships: [{ a: 'Lin', b: 'Yan', state: 'Trust remains fragile' }],
  openQuestions: ['Who leaked the plan?'],
  worldFacts: ['The city guard is now searching the east district'],
};

assert.equal(validateSummaryCandidate(candidate, 2).ok, true);
assert.equal(validateSummaryCandidate({ chapterIndex: 1 }, 2).ok, false);
```

- [ ] **Step 2: Run the helper test to verify it fails**

Run:

```powershell
node tests\ai-reading-helpers.test.js
```

Expected: FAIL because `validateSummaryCandidate` does not exist yet.

- [ ] **Step 3: Implement minimal validation helpers in the test harness**

```js
function validateSummaryCandidate(summary, expectedChapterIndex) {
  if (!summary || typeof summary !== 'object') return { ok: false, reason: 'not-object' };
  if (summary.chapterIndex !== expectedChapterIndex) return { ok: false, reason: 'chapter-mismatch' };
  if (!String(summary.plotSummary || '').trim()) return { ok: false, reason: 'missing-plot' };
  if (!Array.isArray(summary.majorCharacters)) return { ok: false, reason: 'missing-characters' };
  if (!Array.isArray(summary.relationships)) return { ok: false, reason: 'missing-relationships' };
  if (!Array.isArray(summary.openQuestions)) return { ok: false, reason: 'missing-open-questions' };
  if (!Array.isArray(summary.worldFacts)) return { ok: false, reason: 'missing-world-facts' };
  return { ok: true };
}
```

- [ ] **Step 4: Add the runtime summary helpers to `app.html`**

```js
function createSummaryArtifact(novelId, chapterIndex, payload, fingerprint, state = 'candidate') {
  return {
    novelId,
    chapterIndex,
    generatedAt: Date.now(),
    schemaVersion: 'memory-v1',
    fingerprint,
    state,
    payload,
  };
}

function promoteSummaryArtifact(artifact) {
  return { ...artifact, state: 'committed' };
}
```

- [ ] **Step 5: Run the helper test to verify it passes**

Run:

```powershell
node tests\ai-reading-helpers.test.js
```

Expected: PASS with the new summary validation checks.

- [ ] **Step 6: Commit**

```bash
git add app.html tests/ai-reading-helpers.test.js
git commit -m "feat: add chapter memory artifact validation helpers"
```

## Task 3: Add Structured Output Hardening Utilities for Summary and Comment Parsing

**Files:**
- Modify: `app.html`
- Modify: `tests/ai-reading-helpers.test.js`

- [ ] **Step 1: Write the failing test for parse-repair-validate flow**

```js
const raw = '{"chapterIndex":2,"plotSummary":"ok","majorCharacters":[],"relationships":[],"openQuestions":[],"worldFacts":[],}';
const repaired = repairLooseJson(raw);
assert.equal(typeof repaired, 'string');
assert.equal(validateSummaryCandidate(JSON.parse(repaired), 2).ok, true);
```

- [ ] **Step 2: Run the helper test to verify it fails**

Run:

```powershell
node tests\ai-reading-helpers.test.js
```

Expected: FAIL because `repairLooseJson` is missing.

- [ ] **Step 3: Implement a minimal loose JSON repair abstraction in the test harness**

```js
function repairLooseJson(rawText) {
  return String(rawText || '')
    .replace(/```json|```/gi, '')
    .replace(/,\s*}/g, '}')
    .replace(/,\s*]/g, ']')
    .trim();
}
```

- [ ] **Step 4: Add runtime parsing utilities in `app.html` with clear stages**

```js
function stripJsonFence(rawText = '') {
  return String(rawText || '').replace(/```json|```/gi, '').trim();
}

function parseStructuredPayload(rawText, repair = value => value) {
  const direct = stripJsonFence(rawText);
  try {
    return { ok: true, value: JSON.parse(direct), repaired: false };
  } catch (error) {
    try {
      return { ok: true, value: JSON.parse(repair(direct)), repaired: true };
    } catch (repairError) {
      return { ok: false, error: repairError };
    }
  }
}
```

- [ ] **Step 5: Run the helper test to verify it passes**

Run:

```powershell
node tests\ai-reading-helpers.test.js
```

Expected: PASS with repaired JSON accepted by the local validator.

- [ ] **Step 6: Commit**

```bash
git add app.html tests/ai-reading-helpers.test.js
git commit -m "feat: add structured output parsing hardening helpers"
```

## Task 4: Build Chapter Memory Generation and Rolling Prebuild Scheduling

**Files:**
- Modify: `app.html`
- Modify: `tests/ai-reading-helpers.test.js`

- [ ] **Step 1: Write the failing test for cold-start and rolling scheduling**

```js
const chapters = Array.from({ length: 8 }, (_, index) => ({ title: `Chapter ${index + 1}` }));

assert.deepEqual(planPrebuildWindow({ currentChapterIndex: 0, chapterCount: chapters.length, warmCount: 5 }), [0, 1, 2, 3, 4]);
assert.deepEqual(planPrebuildWindow({ currentChapterIndex: 4, chapterCount: chapters.length, warmCount: 5 }), [4, 5, 6, 7]);
```

- [ ] **Step 2: Run the helper test to verify it fails**

Run:

```powershell
node tests\ai-reading-helpers.test.js
```

Expected: FAIL because `planPrebuildWindow` does not exist yet.

- [ ] **Step 3: Implement the scheduling helper in the test harness**

```js
function planPrebuildWindow({ currentChapterIndex, chapterCount, warmCount }) {
  const start = Math.max(0, Number(currentChapterIndex || 0));
  const end = Math.min(chapterCount, start + warmCount);
  return Array.from({ length: Math.max(0, end - start) }, (_, offset) => start + offset);
}
```

- [ ] **Step 4: Add runtime prebuild state and scheduling helpers to `app.html`**

```js
function createPrebuildState() {
  return {
    queuedChapters: [],
    running: false,
    lastCompletedChapter: -1,
    lastError: '',
  };
}

function planPrebuildWindow({ currentChapterIndex, chapterCount, warmCount = 5 }) {
  const start = Math.max(0, currentChapterIndex);
  const end = Math.min(chapterCount, start + warmCount);
  return Array.from({ length: Math.max(0, end - start) }, (_, offset) => start + offset);
}
```

- [ ] **Step 5: Wire a new summary-generation pass into `generateChapterComments` dependencies**

```js
// High-level sequence inside App:
// 1. ensure summary_(n-1) exists or is the empty memory seed
// 2. request summary_n as candidate
// 3. validate and commit summary_n
// 4. generate chapter n first-pass comments
// 5. enqueue n+1 while the current chapter stays responsive
```

- [ ] **Step 6: Run the helper test to verify it passes**

Run:

```powershell
node tests\ai-reading-helpers.test.js
```

Expected: PASS with the cold-start and rolling-window assertions.

- [ ] **Step 7: Commit**

```bash
git add app.html tests/ai-reading-helpers.test.js
git commit -m "feat: add ai prebuild scheduling and chapter memory flow"
```

## Task 5: Replace Demo Comment Fallbacks with First-Pass Cached AI Comments

**Files:**
- Modify: `app.html`
- Test: `tests/browser-smoke.js`

- [ ] **Step 1: Extend the browser smoke test with a placeholder assertion for chapter-level AI surfaces**

```js
await page.goto('http://127.0.0.1:3000/app.html#reader', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForSelector('.app-screen', { timeout: 10000 });
await page.waitForSelector('[data-reader-paragraph]', { timeout: 10000 });
```

- [ ] **Step 2: Run the browser smoke test to verify it fails or lacks the new selectors**

Run:

```powershell
$server = Start-Process python -ArgumentList '-m','http.server','3000' -WorkingDirectory '.' -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 2
node tests\browser-smoke.js
Stop-Process -Id $server.Id -Force
```

Expected: FAIL until the new reader selectors and chapter surface are added.

- [ ] **Step 3: Add explicit data hooks and cached first-pass comment selection in `ReaderScreen`**

```jsx
const cachedParagraphComments = settings.liveSettings.enabled
  ? aiCommentsByKey[key] || []
  : [];

const paragraphComments = cachedParagraphComments.length
  ? cachedParagraphComments
  : generateDemoComments(paragraph, index, chapterIndex, settings.personas);
```

- [ ] **Step 4: Add a chapter-end discussion entry area to `ReaderScreen`**

```jsx
<section className="chapter-discussion" data-chapter-discussion>
  <div className="section-label">章评区</div>
  <button className="btn btn-secondary" onClick={() => setExpandedChapterDiscussion(true)}>
    打开本章讨论
  </button>
</section>
```

- [ ] **Step 5: Run the browser smoke test to verify the new reader surface appears**

Run:

```powershell
$server = Start-Process python -ArgumentList '-m','http.server','3000' -WorkingDirectory '.' -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 2
node tests\browser-smoke.js
Stop-Process -Id $server.Id -Force
```

Expected: PASS for the selector-level checks with no relevant console errors.

- [ ] **Step 6: Commit**

```bash
git add app.html tests/browser-smoke.js
git commit -m "feat: add chapter discussion entry and cached ai comment surface"
```

## Task 6: Add Threaded Paragraph and Chapter Discussion State

**Files:**
- Modify: `app.html`
- Modify: `tests/ai-reading-helpers.test.js`

- [ ] **Step 1: Write the failing helper test for thread compression bookkeeping**

```js
const thread = createEmptyThread('paragraph:book-1:3:7');
const updated = appendThreadTurn(thread, { role: 'user', text: 'Why did he hesitate?' });

assert.equal(updated.messages.length, 1);
assert.equal(updated.summary, '');
```

- [ ] **Step 2: Run the helper test to verify it fails**

Run:

```powershell
node tests\ai-reading-helpers.test.js
```

Expected: FAIL because the thread helpers do not exist yet.

- [ ] **Step 3: Implement minimal thread state helpers in the test harness**

```js
function createEmptyThread(threadId) {
  return { id: threadId, messages: [], summary: '', updatedAt: 0 };
}

function appendThreadTurn(thread, message) {
  return {
    ...thread,
    messages: [...thread.messages, message],
    updatedAt: Date.now(),
  };
}
```

- [ ] **Step 4: Add live thread state and persistence to `app.html`**

```js
const [aiThreads, setAiThreads] = useState(() => lsGet(STORAGE_KEYS.aiThreads, {}));
useEffect(() => { lsSet(STORAGE_KEYS.aiThreads, aiThreads); }, [aiThreads]);
```

- [ ] **Step 5: Update `CommentPanel` to render and submit threaded AI conversation**

```jsx
function CommentPanel({ comments, userComments, thread, onSendThreadMessage, onClose }) {
  // render first-pass comments plus thread messages
}
```

- [ ] **Step 6: Run the helper test to verify it passes**

Run:

```powershell
node tests\ai-reading-helpers.test.js
```

Expected: PASS with thread creation and append behavior validated.

- [ ] **Step 7: Commit**

```bash
git add app.html tests/ai-reading-helpers.test.js
git commit -m "feat: add ai thread state for paragraph and chapter discussion"
```

## Task 7: Add User Follow-Up Generation and Controlled AI-to-AI Reply Pass

**Files:**
- Modify: `app.html`
- Modify: `tests/browser-smoke.js`

- [ ] **Step 1: Add a failing browser smoke assertion for threaded interaction UI**

```js
await page.locator('.comment-badge').first().click();
await page.waitForSelector('[data-comment-panel="true"]', { timeout: 10000 });
await page.waitForSelector('[data-thread-composer]', { timeout: 10000 });
```

- [ ] **Step 2: Run the browser smoke test to verify it fails**

Run:

```powershell
$server = Start-Process python -ArgumentList '-m','http.server','3000' -WorkingDirectory '.' -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 2
node tests\browser-smoke.js
Stop-Process -Id $server.Id -Force
```

Expected: FAIL until the thread composer is added.

- [ ] **Step 3: Add a dedicated follow-up prompt path in `aiClient`**

```js
async generateThreadReply(proxyUrl, profile, apiKey, payload) {
  const res = await fetch(`${proxyUrl.replace(/\/$/, '')}/proxy/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  return extractAssistantText(data);
}
```

- [ ] **Step 4: Add one controlled AI-to-AI supplemental pass after first-pass comments**

```js
if (comment.discussionMode === 'inviting' && allowSupplementalReply) {
  // pick one second persona and request exactly one short supplemental line
}
```

- [ ] **Step 5: Update the browser smoke test to submit one thread message**

```js
await page.locator('[data-thread-composer] input').fill('这里他为什么突然退让？');
await page.locator('[data-thread-composer] button').click();
await page.waitForTimeout(1000);
```

- [ ] **Step 6: Re-run the browser smoke test**

Run:

```powershell
$server = Start-Process python -ArgumentList '-m','http.server','3000' -WorkingDirectory '.' -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 2
node tests\browser-smoke.js
Stop-Process -Id $server.Id -Force
```

Expected: PASS on UI flow and no unhandled console errors. If live generation is unavailable in the smoke environment, the test should still validate the composer and non-crashing submit path.

- [ ] **Step 7: Commit**

```bash
git add app.html tests/browser-smoke.js
git commit -m "feat: add threaded ai follow-up flow and controlled supplemental replies"
```

## Task 8: Add Prompt Layering and Persona Fields Needed by the New Runtime

**Files:**
- Modify: `app.html`
- Modify: `tests/ai-reading-helpers.test.js`

- [ ] **Step 1: Write the failing helper test for persona normalization defaults**

```js
const persona = normalizeReadingPersona({
  id: 'custom',
  name: '讨论党',
});

assert.equal(persona.interactionTendency, 'responsive');
assert.equal(persona.disagreementStyle, 'gentle');
```

- [ ] **Step 2: Run the helper test to verify it fails**

Run:

```powershell
node tests\ai-reading-helpers.test.js
```

Expected: FAIL because `normalizeReadingPersona` does not exist yet.

- [ ] **Step 3: Implement the normalization helper in the test harness**

```js
function normalizeReadingPersona(persona = {}) {
  return {
    interactionTendency: 'responsive',
    disagreementStyle: 'gentle',
    relationshipFeel: 'book-friend',
    ...persona,
  };
}
```

- [ ] **Step 4: Mirror those fields into `normalizePersona` in `app.html` and build scene-specific prompt helpers**

```js
function buildParagraphFirstCommentPrompt(context) { /* returns scene prompt */ }
function buildParagraphFollowUpPrompt(context) { /* returns scene prompt */ }
function buildChapterDiscussionPrompt(context) { /* returns scene prompt */ }
```

- [ ] **Step 5: Run the helper test to verify it passes**

Run:

```powershell
node tests\ai-reading-helpers.test.js
```

Expected: PASS with persona defaults confirmed.

- [ ] **Step 6: Commit**

```bash
git add app.html tests/ai-reading-helpers.test.js
git commit -m "feat: add layered reading prompts and persona defaults"
```

## Task 9: Final Verification and Regression Sweep

**Files:**
- Modify: `tests/browser-smoke.js` (only if final selector cleanup is needed)
- Verify: `app.html`
- Verify: `tests/ai-reading-helpers.test.js`

- [ ] **Step 1: Run the helper suite**

Run:

```powershell
node tests\ai-reading-helpers.test.js
```

Expected: PASS.

- [ ] **Step 2: Run the existing profile helper suite**

Run:

```powershell
node tests\ai-profile-helpers.test.js
```

Expected: PASS.

- [ ] **Step 3: Run the browser smoke test with the local server**

Run:

```powershell
$server = Start-Process python -ArgumentList '-m','http.server','3000' -WorkingDirectory '.' -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 2
try {
  node tests\browser-smoke.js
} finally {
  if ($server -and !$server.HasExited) { Stop-Process -Id $server.Id -Force }
}
```

Expected: PASS with no relevant console errors.

- [ ] **Step 4: Perform a focused manual verification pass**

Manual checks:

- Import a `.txt` novel and confirm chapter 1 gets AI warm-up state first.
- Open a paragraph comment and verify thread follow-up UI appears.
- Open chapter discussion and verify it is separate from paragraph comments.
- Change AI friend settings and confirm stale generated content is replaced on the next generation path.
- Peek ahead to a later chapter, return, and confirm earlier chapter interaction scope does not act as if the later chapter was read.

- [ ] **Step 5: Commit**

```bash
git add app.html tests/ai-reading-helpers.test.js tests/browser-smoke.js
git commit -m "feat: ship ai reading interaction system"
```

