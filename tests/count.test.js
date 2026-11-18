import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countX, X_LIMIT } from '../src/engine/count.js';

test('limit constant', () => assert.equal(X_LIMIT, 280));
test('empty', () => assert.equal(countX(''), 0));
test('ascii', () => assert.equal(countX('abc'), 3));
test('kana weight 2', () => assert.equal(countX('あいう'), 6));
test('emoji', () => assert.equal(countX('🙂'), 2));
test('zwj emoji', () => assert.equal(countX('👨‍👩‍👧'), 2));
test('url counts 23', () =>
  assert.equal(countX('見て https://example.com/very/long/path'), 4 + 1 + 23));
test('over limit', () => {
  assert.equal(countX('あ'.repeat(141)), 282);
  assert.ok(countX('あ'.repeat(141)) > X_LIMIT);
});
test('url stops before Japanese text', () =>
  assert.equal(countX('https://x.com/aあいう'), 23 + 6));
test('url stops before 。', () => assert.equal(countX('https://x.com/a。'), 23 + 2));
test('flag', () => assert.equal(countX('🇯🇵'), 2));
test('keycap', () => assert.equal(countX('1️⃣'), 2));
test('text-style heart with VS16', () => assert.equal(countX('❤️'), 2));
test('NFC normalization', () => assert.equal(countX('か\u3099'), 2));
test('whitespace', () => assert.equal(countX('  \n'), 3));
