const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function extractConstBlock(source, constName) {
  const marker = `const ${constName} =`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `Missing ${constName} in app.html`);
  const braceStart = source.indexOf('{', start);
  assert.notEqual(braceStart, -1, `Missing opening brace for ${constName}`);
  let depth = 0;
  for (let index = braceStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        const semicolonIndex = source.indexOf(';', index);
        assert.notEqual(semicolonIndex, -1, `Missing semicolon for ${constName}`);
        return source.slice(start, semicolonIndex + 1);
      }
    }
  }
  throw new Error(`Unterminated const block for ${constName}`);
}

function extractFunctionBlock(source, functionName) {
  const marker = `function ${functionName}(`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `Missing ${functionName} in app.html`);
  const nextStart = source.indexOf('\nfunction ', start + marker.length);
  if (nextStart === -1) return source.slice(start).trim();
  return source.slice(start, nextStart).trim();
}

function loadAppContract() {
  const appPath = path.join(__dirname, '..', 'app.html');
  const appSource = fs.readFileSync(appPath, 'utf8');
  const script = [
    extractConstBlock(appSource, 'STORAGE_KEYS'),
    extractFunctionBlock(appSource, 'buildChapterMemoryKey'),
    extractFunctionBlock(appSource, 'buildChapterCommentKey'),
    extractFunctionBlock(appSource, 'buildChapterThreadKey'),
    extractFunctionBlock(appSource, 'buildParagraphThreadKey'),
    extractFunctionBlock(appSource, 'normalizeReadingPersona'),
    extractFunctionBlock(appSource, 'validateSummaryCandidate'),
    extractFunctionBlock(appSource, 'createSummaryArtifact'),
    extractFunctionBlock(appSource, 'promoteSummaryArtifact'),
    extractFunctionBlock(appSource, 'stripJsonFence'),
    extractFunctionBlock(appSource, 'repairLooseJson'),
    extractFunctionBlock(appSource, 'parseStructuredPayload'),
    extractFunctionBlock(appSource, 'createPrebuildState'),
    extractFunctionBlock(appSource, 'planPrebuildWindow'),
    extractFunctionBlock(appSource, 'createEmptyThread'),
    extractFunctionBlock(appSource, 'summarizeThreadTurns'),
    extractFunctionBlock(appSource, 'appendThreadTurn'),
    'module.exports = {',
    '  STORAGE_KEYS,',
    '  buildChapterMemoryKey,',
    '  buildChapterCommentKey,',
    '  buildChapterThreadKey,',
    '  buildParagraphThreadKey,',
    '  normalizeReadingPersona,',
    '  validateSummaryCandidate,',
    '  createSummaryArtifact,',
    '  promoteSummaryArtifact,',
    '  stripJsonFence,',
    '  repairLooseJson,',
    '  parseStructuredPayload,',
    '  createPrebuildState,',
    '  planPrebuildWindow,',
    '  createEmptyThread,',
    '  summarizeThreadTurns,',
    '  appendThreadTurn,',
    '};',
  ].join('\n');
  const context = { module: { exports: {} }, exports: {} };
  vm.runInNewContext(script, context, { filename: appPath });
  return context.module.exports;
}

function normalize(value) {
  return JSON.parse(JSON.stringify(value));
}

const appContract = loadAppContract();

assert.equal(typeof appContract.buildChapterMemoryKey, 'function');
assert.equal(typeof appContract.buildChapterCommentKey, 'function');
assert.equal(typeof appContract.buildChapterThreadKey, 'function');
assert.equal(typeof appContract.buildParagraphThreadKey, 'function');
assert.equal(typeof appContract.normalizeReadingPersona, 'function');
assert.equal(typeof appContract.validateSummaryCandidate, 'function');
assert.equal(typeof appContract.createSummaryArtifact, 'function');
assert.equal(typeof appContract.promoteSummaryArtifact, 'function');
assert.equal(typeof appContract.stripJsonFence, 'function');
assert.equal(typeof appContract.repairLooseJson, 'function');
assert.equal(typeof appContract.parseStructuredPayload, 'function');
assert.equal(typeof appContract.createPrebuildState, 'function');
assert.equal(typeof appContract.planPrebuildWindow, 'function');
assert.equal(typeof appContract.createEmptyThread, 'function');
assert.equal(typeof appContract.summarizeThreadTurns, 'function');
assert.equal(typeof appContract.appendThreadTurn, 'function');
assert.equal(typeof appContract.STORAGE_KEYS, 'object');

assert.equal(appContract.buildChapterMemoryKey('book-1', 3), 'rwm_ai_memory_book-1_3');
assert.equal(appContract.buildChapterCommentKey('book-1', 3), 'rwm_ai_comments_book-1_3');
assert.equal(appContract.buildChapterThreadKey('book-1', 3), 'chapter:book-1:3');
assert.equal(appContract.buildParagraphThreadKey('book-1', 3, 7), 'paragraph:book-1:3:7');
assert.equal(appContract.STORAGE_KEYS.aiThreads, 'rwm_ai_threads');
assert.equal(appContract.STORAGE_KEYS.aiPrebuildState, 'rwm_ai_prebuild_state');

assert.deepEqual(
  normalize(appContract.normalizeReadingPersona({
    id: 'custom',
    name: '讨论君',
  })),
  {
    id: 'custom',
    name: '讨论君',
    interactionTendency: 'responsive',
    disagreementStyle: 'gentle',
    relationshipFeel: 'book-friend',
  }
);

const validCandidate = {
  chapterIndex: 2,
  plotSummary: 'The pressure in the city escalates.',
  majorCharacters: [{ name: 'Lin', state: 'More cautious', salience: 'high' }],
  relationships: [{ a: 'Lin', b: 'Yan', state: 'Trust remains fragile' }],
  openQuestions: ['Who leaked the plan?'],
  worldFacts: ['The city guard is now searching the east district'],
};

assert.deepEqual(normalize(appContract.validateSummaryCandidate(validCandidate, 2)), { ok: true });
assert.deepEqual(
  normalize(appContract.validateSummaryCandidate({ chapterIndex: 1 }, 2)),
  { ok: false, reason: 'chapter-mismatch' }
);

const artifact = appContract.createSummaryArtifact('book-1', 2, validCandidate, 'fp-1');
assert.equal(artifact.novelId, 'book-1');
assert.equal(artifact.chapterIndex, 2);
assert.equal(artifact.schemaVersion, 'memory-v1');
assert.equal(artifact.fingerprint, 'fp-1');
assert.equal(artifact.state, 'candidate');
assert.equal(typeof artifact.generatedAt, 'number');
assert.deepEqual(normalize(artifact.payload), validCandidate);

const committedArtifact = appContract.promoteSummaryArtifact(artifact);
assert.equal(committedArtifact.state, 'committed');
assert.equal(committedArtifact.novelId, artifact.novelId);
assert.equal(committedArtifact.chapterIndex, artifact.chapterIndex);
assert.deepEqual(normalize(committedArtifact.payload), validCandidate);

assert.equal(
  appContract.stripJsonFence('```json\n{"chapterIndex":2}\n```'),
  '{"chapterIndex":2}'
);

const repaired = appContract.repairLooseJson(
  '{"chapterIndex":2,"plotSummary":"ok","majorCharacters":[],"relationships":[],"openQuestions":[],"worldFacts":[],}'
);
assert.equal(typeof repaired, 'string');
assert.deepEqual(
  normalize(appContract.validateSummaryCandidate(JSON.parse(repaired), 2)),
  { ok: true }
);

const parsedPayload = appContract.parseStructuredPayload(
  '```json\n{"chapterIndex":2,"plotSummary":"ok","majorCharacters":[],"relationships":[],"openQuestions":[],"worldFacts":[],}\n```',
  appContract.repairLooseJson
);
assert.equal(parsedPayload.ok, true);
assert.equal(parsedPayload.repaired, true);
assert.deepEqual(
  normalize(appContract.validateSummaryCandidate(normalize(parsedPayload.value), 2)),
  { ok: true }
);

assert.deepEqual(normalize(appContract.createPrebuildState()), {
  queuedChapters: [],
  running: false,
  lastCompletedChapter: -1,
  lastError: '',
});

const chapters = Array.from({ length: 8 }, (_, index) => ({ title: `Chapter ${index + 1}` }));
assert.deepEqual(
  normalize(appContract.planPrebuildWindow({ currentChapterIndex: 0, chapterCount: chapters.length, warmCount: 5 })),
  [0, 1, 2, 3, 4]
);
assert.deepEqual(
  normalize(appContract.planPrebuildWindow({ currentChapterIndex: 4, chapterCount: chapters.length, warmCount: 5 })),
  [4, 5, 6, 7]
);

assert.deepEqual(normalize(appContract.createEmptyThread('chapter:book-1:3')), {
  threadId: 'chapter:book-1:3',
  turns: [],
  summary: '',
  updatedAt: 0,
});

const baseThread = appContract.createEmptyThread('paragraph:book-1:3:7');
const nextThread = appContract.appendThreadTurn(baseThread, { role: 'user', text: 'What changed here?' });
assert.equal(baseThread.turns.length, 0);
assert.equal(nextThread.threadId, 'paragraph:book-1:3:7');
assert.equal(nextThread.turns.length, 1);
assert.deepEqual(normalize(nextThread.turns[0]), { role: 'user', text: 'What changed here?' });
assert.equal(typeof nextThread.updatedAt, 'number');
assert.equal(nextThread.updatedAt >= 0, true);

let longThread = appContract.createEmptyThread('paragraph:book-1:3:8');
for (let index = 0; index < 8; index += 1) {
  longThread = appContract.appendThreadTurn(longThread, {
    role: index % 2 === 0 ? 'user' : 'assistant',
    text: `turn-${index}`,
  });
}
assert.equal(longThread.turns.length, 6);
assert.equal(typeof longThread.summary, 'string');
assert.equal(longThread.summary.includes('turn-0') || longThread.summary.includes('turn-1'), true);

console.log('ai-reading helper tests passed');
