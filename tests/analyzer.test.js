import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getNodeAnalyzer } from './helpers/analyzer-node.js';

test('surfaces concatenate to input', async () => {
  const a = await getNodeAnalyzer();
  const input = '今日は 雨🙂\nhttps://x.com/a ok。';
  const tokens = a.tokenize(input);
  assert.equal(tokens.map((t) => t.surface).join(''), input);
});

test('normalizes swapped conjugation fields', async () => {
  const a = await getNodeAnalyzer();
  const tokens = a.tokenize('言う');
  assert.equal(tokens.length, 1);
  assert.equal(tokens[0].cType, '五段・ワ行促音便');
  assert.equal(tokens[0].cForm, '基本形');
  assert.equal(tokens[0].base, '言う');
  assert.equal(tokens[0].reading, 'イウ');
});

test('unknown tokens have empty strings', async () => {
  const a = await getNodeAnalyzer();
  const tokens = a.tokenize('🙂');
  assert.ok(tokens.length >= 1);
  for (const t of tokens) {
    for (const k of ['surface', 'pos', 'pos1', 'pos2', 'cType', 'cForm', 'base', 'reading']) {
      assert.equal(typeof t[k], 'string', k);
    }
  }
});
