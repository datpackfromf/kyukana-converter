import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countX, X_LIMIT } from '../src/engine/count.js';

test('countX', () => {
  assert.equal(X_LIMIT, 280);
  assert.equal(countX(''), 0);
  assert.equal(countX('abc'), 3);
  assert.equal(countX('あいう'), 6);
  assert.equal(countX('🙂'), 2);
  assert.equal(countX('👨‍👩‍👧'), 2);
  assert.equal(countX('見て https://example.com/very/long/path'), 4 + 1 + 23);
  assert.equal(countX('あ'.repeat(141)), 282);
  assert.ok(countX('あ'.repeat(141)) > X_LIMIT);
});
