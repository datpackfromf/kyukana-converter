import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getNodeAnalyzer } from './helpers/analyzer-node.js';
import { createDict } from '../src/engine/dict.js';
import { createConverter } from '../src/engine/convert.js';

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const CASES = read('./cases.json');
const DICT_JSON = read('../data/dict.json');

/** 依頼文の表にある必須10件 */
const REQUIRED = [
  ['今日は雨が降っているので家にいようと思う', '今日は雨が降つてゐるので家にゐようと思ふ'],
  ['ありがとう', 'ありがたう'],
  ['おはよう', 'おはやう'],
  ['そうでしょう', 'さうでせう'],
  ['きょうはゆうがたから', 'けふはゆふがたから'],
  ['ちょうちょう', 'てふてふ'],
  ['言わない', '言はない'],
  ['買った', '買つた'],
  ['どう', 'どう'],
  ['もう', 'もう'],
];

test('必須10件が cases.json に入っている', () => {
  for (const [input, expected] of REQUIRED) {
    const c = CASES.find((x) => x.input === input && !x.options);
    assert.ok(c, `cases.json に ${input} がない`);
    assert.equal(c.expected, expected, input);
  }
});

test('必須10件が合格する', async () => {
  const conv = createConverter({ analyzer: await getNodeAnalyzer(), dict: createDict(DICT_JSON) });
  for (const [input] of REQUIRED) {
    const c = CASES.find((x) => x.input === input && !x.options);
    assert.equal(conv.convert(c.input, c.options).output, c.expected, input);
  }
});
