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
    'const FIRST_CHAPTER_BUNDLE_MAX_PARAGRAPHS = 160;',
    'const CHAPTER_COMMENT_CHUNK_SIZE = 8;',
    extractFunctionBlock(appSource, 'normalizeText'),
    extractFunctionBlock(appSource, 'toSimplifiedChinese'),
    extractFunctionBlock(appSource, 'normalizeCommentText'),
    extractFunctionBlock(appSource, 'clamp'),
    extractFunctionBlock(appSource, 'hashText'),
    extractFunctionBlock(appSource, 'buildChapterMemoryKey'),
    extractFunctionBlock(appSource, 'buildChapterCommentKey'),
    extractFunctionBlock(appSource, 'buildChapterThreadKey'),
    extractFunctionBlock(appSource, 'buildParagraphThreadKey'),
    extractFunctionBlock(appSource, 'hasBookPersonaOverride'),
    extractFunctionBlock(appSource, 'normalizeBookPersonaIds'),
    extractFunctionBlock(appSource, 'getBookPersonas'),
    extractFunctionBlock(appSource, 'normalizeReadingPersona'),
    extractFunctionBlock(appSource, 'validateSummaryCandidate'),
    extractFunctionBlock(appSource, 'createSummaryArtifact'),
    extractFunctionBlock(appSource, 'promoteSummaryArtifact'),
    extractFunctionBlock(appSource, 'getChapterScrollPositions'),
    extractFunctionBlock(appSource, 'getChapterScrollPos'),
    extractFunctionBlock(appSource, 'updateChapterScrollProgress'),
    extractFunctionBlock(appSource, 'getAiGeneratedThrough'),
    extractFunctionBlock(appSource, 'getAiPregenTarget'),
    extractFunctionBlock(appSource, 'stripJsonFence'),
    extractFunctionBlock(appSource, 'repairLooseJson'),
    extractFunctionBlock(appSource, 'parseStructuredPayload'),
    extractFunctionBlock(appSource, 'disableModelThinking'),
    extractFunctionBlock(appSource, 'chunkParagraphs'),
    extractFunctionBlock(appSource, 'getChapterCommentCacheSignature'),
    extractFunctionBlock(appSource, 'normalizeCompletedChunkIndexes'),
    extractFunctionBlock(appSource, 'createChapterCommentCachePayload'),
    extractFunctionBlock(appSource, 'isCompleteChapterCommentCache'),
    extractFunctionBlock(appSource, 'getStartupParagraphs'),
    extractFunctionBlock(appSource, 'chunkStartupParagraphs'),
    extractFunctionBlock(appSource, 'buildFirstChapterBundlePrompt'),
    extractFunctionBlock(appSource, 'validateFirstChapterBundle'),
    extractFunctionBlock(appSource, 'buildAiComment'),
    extractFunctionBlock(appSource, 'createReaderComment'),
    extractFunctionBlock(appSource, 'createPrebuildState'),
    extractFunctionBlock(appSource, 'planPrebuildWindow'),
    extractFunctionBlock(appSource, 'createEmptyThread'),
    extractFunctionBlock(appSource, 'summarizeThreadTurns'),
    extractFunctionBlock(appSource, 'appendThreadTurn'),
    'module.exports = {',
    '  STORAGE_KEYS,',
    '  toSimplifiedChinese,',
    '  normalizeCommentText,',
    '  buildChapterMemoryKey,',
    '  buildChapterCommentKey,',
    '  buildChapterThreadKey,',
    '  buildParagraphThreadKey,',
    '  hasBookPersonaOverride,',
    '  normalizeBookPersonaIds,',
    '  getBookPersonas,',
    '  normalizeReadingPersona,',
    '  validateSummaryCandidate,',
    '  createSummaryArtifact,',
    '  promoteSummaryArtifact,',
    '  getChapterScrollPositions,',
    '  getChapterScrollPos,',
    '  updateChapterScrollProgress,',
    '  getAiGeneratedThrough,',
    '  getAiPregenTarget,',
    '  stripJsonFence,',
    '  repairLooseJson,',
  '  parseStructuredPayload,',
  '  disableModelThinking,',
  '  chunkParagraphs,',
  '  getChapterCommentCacheSignature,',
  '  normalizeCompletedChunkIndexes,',
  '  createChapterCommentCachePayload,',
  '  isCompleteChapterCommentCache,',
  '  getStartupParagraphs,',
    '  chunkStartupParagraphs,',
    '  buildFirstChapterBundlePrompt,',
    '  validateFirstChapterBundle,',
    '  buildAiComment,',
    '  createReaderComment,',
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

assert.equal(typeof appContract.toSimplifiedChinese, 'function');
assert.equal(typeof appContract.normalizeCommentText, 'function');
assert.equal(typeof appContract.buildChapterMemoryKey, 'function');
assert.equal(typeof appContract.buildChapterCommentKey, 'function');
assert.equal(typeof appContract.buildChapterThreadKey, 'function');
assert.equal(typeof appContract.buildParagraphThreadKey, 'function');
assert.equal(typeof appContract.hasBookPersonaOverride, 'function');
assert.equal(typeof appContract.normalizeBookPersonaIds, 'function');
assert.equal(typeof appContract.getBookPersonas, 'function');
assert.equal(typeof appContract.normalizeReadingPersona, 'function');
assert.equal(typeof appContract.validateSummaryCandidate, 'function');
assert.equal(typeof appContract.createSummaryArtifact, 'function');
assert.equal(typeof appContract.promoteSummaryArtifact, 'function');
assert.equal(typeof appContract.getChapterScrollPositions, 'function');
assert.equal(typeof appContract.getChapterScrollPos, 'function');
assert.equal(typeof appContract.updateChapterScrollProgress, 'function');
assert.equal(typeof appContract.getAiGeneratedThrough, 'function');
assert.equal(typeof appContract.getAiPregenTarget, 'function');
assert.equal(typeof appContract.stripJsonFence, 'function');
assert.equal(typeof appContract.repairLooseJson, 'function');
assert.equal(typeof appContract.parseStructuredPayload, 'function');
assert.equal(typeof appContract.disableModelThinking, 'function');
assert.equal(typeof appContract.chunkParagraphs, 'function');
assert.equal(typeof appContract.getChapterCommentCacheSignature, 'function');
assert.equal(typeof appContract.normalizeCompletedChunkIndexes, 'function');
assert.equal(typeof appContract.createChapterCommentCachePayload, 'function');
assert.equal(typeof appContract.isCompleteChapterCommentCache, 'function');
assert.equal(typeof appContract.getStartupParagraphs, 'function');
assert.equal(typeof appContract.chunkStartupParagraphs, 'function');
assert.equal(typeof appContract.buildFirstChapterBundlePrompt, 'function');
assert.equal(typeof appContract.validateFirstChapterBundle, 'function');
assert.equal(typeof appContract.buildAiComment, 'function');
assert.equal(typeof appContract.createReaderComment, 'function');
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

const traditionalComment = '這裡的節奏讓人覺得關係變複雜，後續應該會更有戲。';
assert.equal(appContract.toSimplifiedChinese(traditionalComment), '这里的节奏让人觉得关系变复杂，后续应该会更有戏。');
assert.equal(appContract.normalizeCommentText('  「這個轉折」讓角色關係變複雜。  '), '「这个转折」让角色关系变复杂。');
const simplifiedAiComment = appContract.buildAiComment(
  { id: 'fenxi', name: '分析菌', tag: '分析', color: '#d6e1cf', avatar: '析' },
  '0-0',
  0,
  traditionalComment,
  'profile-1',
);
assert.equal(simplifiedAiComment.text, '这里的节奏让人觉得关系变复杂，后续应该会更有戏。');
const simplifiedReaderComment = appContract.createReaderComment(traditionalComment, { id: 'reader-1' });
assert.equal(simplifiedReaderComment.text, '这里的节奏让人觉得关系变复杂，后续应该会更有戏。');

const personaPool = [
  { id: 'tucao', name: 'Tucao', enabled: true },
  { id: 'fenxi', name: 'Analysis', enabled: true },
  { id: 'disabled', name: 'Disabled', enabled: false },
];
assert.equal(appContract.hasBookPersonaOverride({}), false);
assert.equal(appContract.hasBookPersonaOverride({ allowedPersonaIds: ['tucao'] }), true);
assert.deepEqual(appContract.normalizeBookPersonaIds(['tucao', 'fenxi', 'tucao', '', null]), ['tucao', 'fenxi']);
assert.deepEqual(appContract.getBookPersonas(personaPool, {}).map(persona => persona.id), ['tucao', 'fenxi']);
assert.deepEqual(appContract.getBookPersonas(personaPool, { allowedPersonaIds: ['fenxi'] }).map(persona => persona.id), ['fenxi']);
assert.deepEqual(appContract.getBookPersonas(personaPool, { allowedPersonaIds: ['disabled'] }).map(persona => persona.id), []);
assert.deepEqual(appContract.getBookPersonas(personaPool, { allowedPersonaIds: [] }).map(persona => persona.id), []);

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

const legacyScrollNovel = { lastScrollPos: 120, chapterScrollPositions: { 1: 240 } };
assert.deepEqual(normalize(appContract.getChapterScrollPositions(legacyScrollNovel)), { 0: 120, 1: 240 });
assert.equal(appContract.getChapterScrollPos(legacyScrollNovel, 0), 120);
assert.equal(appContract.getChapterScrollPos(legacyScrollNovel, 1), 240);
assert.equal(appContract.getChapterScrollPos(legacyScrollNovel, 2), 0);
assert.deepEqual(
  normalize(appContract.getChapterScrollPositions({ lastReadChapter: 4, lastScrollPos: 420 })),
  { 4: 420 }
);

const progressNovel = {
  lastReadChapter: 0,
  maxReadChapter: 0,
  lastScrollPos: 300,
  chapterScrollPositions: { 0: 300 },
};
assert.deepEqual(
  normalize(appContract.updateChapterScrollProgress(progressNovel, 1)),
  {
    lastReadChapter: 1,
    maxReadChapter: 1,
    lastScrollPos: 0,
    chapterScrollPositions: { 0: 300 },
  }
);
assert.deepEqual(
  normalize(appContract.updateChapterScrollProgress(progressNovel, 1, 80)),
  {
    lastReadChapter: 1,
    maxReadChapter: 1,
    lastScrollPos: 80,
    chapterScrollPositions: { 0: 300, 1: 80 },
  }
);
assert.equal(appContract.getAiGeneratedThrough({}, 10), -1);
assert.equal(appContract.getAiGeneratedThrough({ aiGeneratedThrough: 4 }, 10), 4);
assert.equal(appContract.getAiGeneratedThrough({ aiGeneratedThrough: 99 }, 10), 9);
assert.equal(appContract.getAiPregenTarget(0, 10, 5), 5);
assert.equal(appContract.getAiPregenTarget(5, 10, 20), 9);
assert.equal(appContract.getAiPregenTarget(-1, 0, 5), -1);

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

const noThinkingBody = appContract.disableModelThinking({
  model: 'fast-8b',
  messages: [{ role: 'user', content: 'hello' }],
});
assert.deepEqual(normalize(noThinkingBody.reasoning), { enabled: false, effort: 'none', exclude: true });
assert.equal(noThinkingBody.think, false);
assert.equal(noThinkingBody.include_reasoning, false);
assert.equal(noThinkingBody.messages[0].content.includes('/no_think'), true);
assert.equal(noThinkingBody.messages[0].content.includes('Do not reason step by step'), true);

assert.deepEqual(
  normalize(appContract.getStartupParagraphs(['a', 'b', 'c'], 2)),
  [{ paragraphIndex: 0, text: 'a' }, { paragraphIndex: 1, text: 'b' }]
);
assert.deepEqual(
  normalize(appContract.chunkStartupParagraphs(['a', 'b', 'c', 'd', 'e'], 5, 2)),
  [
    [{ paragraphIndex: 0, text: 'a' }, { paragraphIndex: 1, text: 'b' }],
    [{ paragraphIndex: 2, text: 'c' }, { paragraphIndex: 3, text: 'd' }],
    [{ paragraphIndex: 4, text: 'e' }],
  ]
);

const longChapterParagraphs = Array.from({ length: 81 }, (_, index) => `paragraph ${index}`);
const longChapterChunks = appContract.chunkParagraphs(longChapterParagraphs, 8);
assert.equal(longChapterChunks.length, 11);
assert.equal(longChapterChunks[10][0].paragraphIndex, 80);

assert.deepEqual(
  normalize(appContract.getChapterCommentCacheSignature(longChapterParagraphs, 8)),
  { paragraphCount: 81, chunkSize: 8, expectedChunkCount: 11 }
);
assert.deepEqual(
  normalize(appContract.normalizeCompletedChunkIndexes([2, 1, 2, -1, 11, 'x'], 11)),
  [1, 2]
);
const completeChapterCommentCache = appContract.createChapterCommentCachePayload({
  commentsByKey: { '0-80': [{ text: 'last paragraph comment' }] },
  fingerprint: 'fp-1',
  paragraphs: longChapterParagraphs,
  completedChunkIndexes: Array.from({ length: 11 }, (_, index) => index),
  complete: true,
});
assert.equal(completeChapterCommentCache.complete, true);
assert.equal(appContract.isCompleteChapterCommentCache(completeChapterCommentCache, longChapterParagraphs, 'fp-1'), true);
assert.equal(
  appContract.isCompleteChapterCommentCache({ commentsByKey: completeChapterCommentCache.commentsByKey }, longChapterParagraphs, 'fp-1'),
  false
);
assert.equal(
  appContract.isCompleteChapterCommentCache({ ...completeChapterCommentCache, completedChunkIndexes: [0, 1, 2] }, longChapterParagraphs, 'fp-1'),
  false
);

const startupPrompt = appContract.buildFirstChapterBundlePrompt({
  novelTitle: 'Book',
  chapterTitle: 'Chapter 1',
  chapterText: 'full chapter text',
  paragraphs: ['first paragraph', 'second paragraph', 'third paragraph'],
  personas: [{ id: 'p1', name: 'Reader', tag: 'tag', stylePrompt: 'short' }],
  paragraphLimit: 3,
});
assert.equal(startupPrompt.includes('"summary"'), true);
assert.equal(startupPrompt.includes('"chapterComments"'), true);
assert.equal(startupPrompt.includes('"paragraphComments"'), false);
assert.equal(startupPrompt.includes('full chapter text'), true);
assert.equal(startupPrompt.includes('Chapter paragraph count: 3'), true);
assert.equal(startupPrompt.includes('later request'), true);

const validStartupBundle = {
  summary: { ...validCandidate, chapterIndex: 0 },
  chapterComments: [{ personaId: 'p1', text: '章评', discussionMode: 'open' }],
};
assert.deepEqual(normalize(appContract.validateFirstChapterBundle(validStartupBundle, 2)), { ok: true });
assert.deepEqual(
  normalize(appContract.validateFirstChapterBundle({ ...validStartupBundle, chapterComments: [] }, 2)),
  { ok: false, reason: 'empty-chapter-comments' }
);

assert.deepEqual(normalize(appContract.createPrebuildState()), {
  queuedChapters: [],
  running: false,
  lastCompletedChapter: -1,
  lastError: '',
  startupStatus: 'idle',
  startupError: '',
  startupCompleted: false,
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
