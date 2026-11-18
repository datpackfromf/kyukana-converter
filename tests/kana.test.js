import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  toHiragana, isHiraganaOnly, isKatakanaOnly, hasKanji,
  trailingKana, oToA, smallToLarge, hasAmbiguousKana,
} from '../src/engine/kana.js';

test('toHiragana', () => {
  assert.equal(toHiragana('カンガエ'), 'かんがえ');
  assert.equal(toHiragana('コーヒー漢A'), 'こーひー漢A');
});
test('smallToLarge', () => {
  assert.equal(smallToLarge('買った、きゃっ、ヴァ'), '買つた、きやつ、ヴア');
});
test('oToA', () => {
  assert.equal(oToA('こ'), 'か');
  assert.equal(oToA('ろ'), 'ら');
  assert.equal(oToA('を'), 'わ');
  assert.equal(oToA('お'), 'お');
  assert.equal(oToA('あ'), 'あ');
});
test('trailingKana', () => {
  assert.equal(trailingKana('考え'), 'え');
  assert.equal(trailingKana('終わっ'), 'わっ');
  assert.equal(trailingKana('漢字'), '');
});
test('hasAmbiguousKana', () => {
  assert.equal(hasAmbiguousKana('あめ'), false);
  assert.equal(hasAmbiguousKana('いえ'), true);
  assert.equal(hasAmbiguousKana('ジ'), true);
});
test('script predicates', () => {
  assert.equal(isKatakanaOnly('コーヒー'), true);
  assert.equal(isKatakanaOnly('コーヒh'), false);
  assert.equal(isHiraganaOnly('ひらがなー'), true);
  assert.equal(isHiraganaOnly(''), false);
  assert.equal(hasKanji('考え'), true);
  assert.equal(hasKanji('かんがえ'), false);
});
