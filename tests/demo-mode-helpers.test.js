const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function extractFunctionBlock(source, functionName) {
  const marker = `function ${functionName}(`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `Missing ${functionName} in app.html`);
  const nextStart = source.indexOf('\nfunction ', start + marker.length);
  if (nextStart === -1) return source.slice(start).trim();
  return source.slice(start, nextStart).trim();
}

function loadDemoContract() {
  const appPath = path.join(__dirname, '..', 'app.html');
  const appSource = fs.readFileSync(appPath, 'utf8');
  const script = [
    extractFunctionBlock(appSource, 'normalizeText'),
    extractFunctionBlock(appSource, 'hashText'),
    extractFunctionBlock(appSource, 'createDemoSummaryPayload'),
    extractFunctionBlock(appSource, 'createDemoParagraphComments'),
    extractFunctionBlock(appSource, 'createDemoFirstChapterBundle'),
    extractFunctionBlock(appSource, 'createDemoReplyText'),
    'module.exports = {',
    '  createDemoSummaryPayload,',
    '  createDemoParagraphComments,',
    '  createDemoFirstChapterBundle,',
    '  createDemoReplyText,',
    '};',
  ].join('\n');
  const context = { module: { exports: {} }, exports: {} };
  vm.runInNewContext(script, context, { filename: appPath });
  return context.module.exports;
}

function normalize(value) {
  return JSON.parse(JSON.stringify(value));
}

const demo = loadDemoContract();
const personas = [
  { id: 'tucao', name: '吐槽姬', tag: '吐槽达人', enabled: true },
  { id: 'fenxi', name: '分析菌', tag: '逻辑分析', enabled: true },
];
const chunk = [
  { paragraphIndex: 0, text: '话说大宋仁宗天子在位，嘉佑三年三月三日五更三点。' },
  { paragraphIndex: 1, text: '洪信领了圣敕，前往龙虎山宣请天师。' },
];

const summary = demo.createDemoSummaryPayload({
  chapterIndex: 0,
  chapterTitle: '楔子 张天师祈禳瘟疫 洪太尉误走妖魔',
  chapterText: chunk.map(item => item.text).join('\n'),
});
assert.equal(summary.chapterIndex, 0);
assert.equal(typeof summary.plotSummary, 'string');
assert.equal(summary.plotSummary.includes('演示'), true);
assert.deepEqual(normalize(summary.majorCharacters), []);
assert.deepEqual(normalize(summary.relationships), []);
assert.deepEqual(normalize(summary.openQuestions), []);
assert.deepEqual(normalize(summary.worldFacts), []);

const paragraphComments = demo.createDemoParagraphComments({
  chapterTitle: '楔子 张天师祈禳瘟疫 洪太尉误走妖魔',
  chunk,
  personas,
});
assert.equal(paragraphComments.length, 2);
assert.deepEqual(paragraphComments.map(item => item.paragraphIndex), [0, 1]);
assert.deepEqual(paragraphComments.map(item => item.personaId), ['tucao', 'fenxi']);
assert.equal(paragraphComments.every(item => item.text.includes('演示')), true);

const bundle = demo.createDemoFirstChapterBundle({
  chapterTitle: '楔子 张天师祈禳瘟疫 洪太尉误走妖魔',
  chapterText: chunk.map(item => item.text).join('\n'),
  paragraphs: chunk.map(item => item.text),
  personas,
});
assert.equal(bundle.summary.chapterIndex, 0);
assert.equal(bundle.chapterComments.length, 2);
assert.deepEqual(bundle.chapterComments.map(item => item.personaId), ['tucao', 'fenxi']);
assert.equal(bundle.chapterComments.every(item => item.text.includes('演示')), true);

const reply = demo.createDemoReplyText({
  persona: personas[1],
  paragraphText: chunk[1].text,
  userMessage: '这里为什么要先去龙虎山？',
  targetComment: { text: '这一段把任务立住了。' },
});
assert.equal(typeof reply, 'string');
assert.equal(reply.includes('演示'), true);
assert.equal(reply.includes('分析菌'), true);

console.log('demo-mode helper tests passed');
