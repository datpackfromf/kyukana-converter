import { test } from 'node:test';
import assert from 'node:assert/strict';
import { changedMask } from '../src/diff.js';

/** @param {string} source @param {string} text @param {string} expected 変わった字だけ */
function check(source, text, expected) {
  const mask = changedMask(source, text);
  const changed = Array.from(text).filter((_, i) => mask[i]).join('');
  assert.equal(changed, expected);
  assert.equal(mask.length, Array.from(text).length);
}

test('そうでしょ → さうでせ: さ・せ だけ', () => check('そうでしょ', 'さうでせ', 'させ'));
test('きょうは → けふは: け・ふ だけ', () => check('きょうは', 'けふは', 'けふ'));
test('降っている → 降つてゐる: つ・ゐ だけ', () => check('降っている', '降つてゐる', 'つゐ'));
test('同じ文字列は変わりなし・長すぎは全部', () => {
  check('あい', 'あい', '');
  const long = 'あ'.repeat(201);
  assert.ok(changedMask(long, long).every(Boolean));
});
