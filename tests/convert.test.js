import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getNodeAnalyzer } from './helpers/analyzer-node.js';
import { createDict } from '../src/engine/dict.js';
import { createConverter } from '../src/engine/convert.js';

const DICT_JSON = JSON.parse(readFileSync(new URL('../data/dict.json', import.meta.url), 'utf8'));

/** @type {ReturnType<typeof createConverter>} */
let conv;
before(async () => {
  conv = createConverter({ analyzer: await getNodeAnalyzer(), dict: createDict(DICT_JSON) });
});

/** @param {string} input @param {string} expected @param {object} [opts] */
function expectOut(input, expected, opts) {
  test(`${input} → ${expected}${opts ? ' ' + JSON.stringify(opts) : ''}`, () => {
    assert.equal(conv.convert(input, opts).output, expected);
  });
}

describe('dict', () => {
  const dict = createDict(DICT_JSON);
  test('bySurface は modern で引く', () => {
    assert.equal(dict.bySurface('きょう')?.historical, 'けふ');
    assert.equal(dict.bySurface('ほげ'), null);
  });
  test('byLemma は kanji と modern の両方で引く', () => {
    assert.equal(dict.byLemma('考える')?.historical, 'かんがへる');
    assert.equal(dict.byLemma('かんがえる')?.historical, 'かんがへる');
    assert.equal(dict.byLemma('存在しない'), null);
  });
  test('scanAt は scan:true の語の最長一致', () => {
    assert.equal(dict.scanAt('きょうはゆうがたから', 4)?.modern, 'ゆうがた');
    assert.equal(dict.scanAt('ありがとうございます', 0)?.modern, 'ありがとうございます');
    // きょう は scan:true ではない
    assert.equal(dict.scanAt('きょうは', 0), null);
  });
});

describe('必須10件', () => {
  expectOut('今日は雨が降っているので家にいようと思う', '今日は雨が降つてゐるので家にゐようと思ふ');
  expectOut('ありがとう', 'ありがたう');
  expectOut('おはよう', 'おはやう');
  expectOut('そうでしょう', 'さうでせう');
  expectOut('きょうはゆうがたから', 'けふはゆふがたから');
  expectOut('ちょうちょう', 'てふてふ');
  expectOut('言わない', '言はない');
  expectOut('買った', '買つた');
  expectOut('どう', 'どう');
  expectOut('もう', 'もう');
});

describe('ワ行五段', () => {
  expectOut('言わない', '言はない');
  expectOut('言います', '言ひます');
  expectOut('言う', '言ふ');
  expectOut('言えば', '言へば');
});

describe('意志・推量の「う」', () => {
  expectOut('書こう', '書かう');
  expectOut('言おう', '言はう');
  expectOut('行きましょう', '行きませう');
  expectOut('雨だろう', '雨だらう');
  expectOut('よかろう', 'よからう');
});

describe('一段・サ変は変えない', () => {
  expectOut('考えよう', '考へよう');
  expectOut('見よう', '見よう');
  expectOut('しよう', 'しよう');
});

describe('助詞', () => {
  expectOut('花を見る', '花を見る');
  expectOut('西へ進む', '西へ進む');
});

describe('小書き→大書き', () => {
  expectOut('買った', '買った', { smallToLarge: false });
  expectOut('言わない', '言はない', { smallToLarge: false });
  expectOut('買った', '買つた', { smallToLarge: true });
});

describe('混在・空', () => {
  test('絵文字・URL・カタカナはそのまま、カタカナ語は kept', () => {
    const input = '今日は🙂 https://x.com/a コーヒー';
    const r = conv.convert(input);
    assert.equal(r.output, input);
    const seg = r.segments.find((s) => s.text.includes('コーヒー'));
    assert.ok(seg, 'コーヒー を含む segment がある');
    assert.equal(seg.status, 'kept');
  });
  test('空文字', () => {
    assert.deepEqual(conv.convert(''), { output: '', segments: [] });
  });
  test('空白だけ', () => {
    assert.equal(conv.convert('  \n').output, '  \n');
  });
});

describe('未確認', () => {
  test('辞書にない ひらがな語は unverified で原文のまま', () => {
    const r = conv.convert('ほげおう');
    assert.equal(r.output, 'ほげおう');
    const seg = r.segments.find((s) => s.text.includes('おう'));
    assert.ok(seg);
    assert.equal(seg.status, 'unverified');
  });
  test('変換した所は converted', () => {
    const r = conv.convert('言わない');
    assert.deepEqual(r.segments, [
      { text: '言は', status: 'converted' },
      { text: 'ない', status: 'kept' },
    ]);
  });
});

describe('segments', () => {
  const inputs = [
    '今日は雨が降っているので家にいようと思う',
    'きょうはゆうがたからあめがふっている',
    'ほげおう、ありがとう🎉 https://example.com/a?x=1',
    'チョウチョウ\n\nそうでしょう',
    'ゆうがたゆうがたゆうがた',
    'ょ',
  ];
  for (const input of inputs) {
    test(`連結が output と一致し、隣り合う同じ status はまとまる: ${JSON.stringify(input)}`, () => {
      for (const smallToLarge of [true, false]) {
        const r = conv.convert(input, { smallToLarge });
        assert.equal(r.segments.map((s) => s.text).join(''), r.output);
        for (let i = 1; i < r.segments.length; i++) {
          assert.notEqual(r.segments[i].status, r.segments[i - 1].status);
        }
        for (const s of r.segments) assert.ok(s.text.length > 0);
      }
    });
  }
  test('長い入力でも例外を出さない', () => {
    const input = 'きょうはゆうがたからあめがふっている。'.repeat(30);
    const r = conv.convert(input);
    assert.equal(r.segments.map((s) => s.text).join(''), r.output);
  });
});
