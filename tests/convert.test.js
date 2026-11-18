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
      { text: '言は', status: 'converted', source: '言わ' },
      { text: 'ない', status: 'kept', source: 'ない' },
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

describe('レビュー指摘への対応', () => {
  /** 決まった並びの「ランダムな」ひらがな（線形合同法） */
  function randomHiragana(n, seed = 12345) {
    let x = seed;
    let s = '';
    for (let i = 0; i < n; i++) {
      x = (x * 1103515245 + 12345) % 2147483648;
      s += String.fromCharCode(0x3041 + (x % 83));
    }
    return s;
  }
  for (const [name, input] of [
    ["'ょ'×8000", 'ょ'.repeat(8000)],
    ['ランダムなひらがな5000字', randomHiragana(5000)],
  ]) {
    test(`長い入力が1秒以内に終わる: ${name}`, () => {
      const t0 = performance.now();
      const r = conv.convert(input);
      const ms = performance.now() - t0;
      assert.equal(r.segments.map((s) => s.text).join(''), r.output);
      assert.ok(ms < 1000, `${ms.toFixed(0)}ms`);
    });
  }

  test('ひらがなの活用語で辞書が同じ形（こえる→こえる）でも、語幹に紛らわしい仮名があれば unverified', () => {
    const r = conv.convert('こえをだす');
    assert.equal(r.output, 'こえをだす');
    const seg = r.segments.find((s) => s.text.includes('こえ'));
    assert.ok(seg);
    assert.equal(seg.status, 'unverified');
  });

  test('小書き→大書きだけで変わった語も converted', () => {
    assert.deepEqual(conv.convert('買った').segments, [
      { text: '買つ', status: 'converted', source: '買っ' },
      { text: 'た', status: 'kept', source: 'た' },
    ]);
    assert.deepEqual(conv.convert('買った', { smallToLarge: false }).segments, [
      { text: '買った', status: 'kept', source: '買った' },
    ]);
  });
});

describe('ブランチ全体レビューの指摘', () => {
  /** @param {string} input @param {string} part その文字を含む segment が unverified */
  function expectUnverified(input, part, expected = input) {
    test(`${input} → ${expected}（${part} は unverified）`, () => {
      const r = conv.convert(input);
      assert.equal(r.output, expected);
      const seg = r.segments.find((s) => s.text.includes(part));
      assert.ok(seg, `${part} を含む segment がない: ${JSON.stringify(r.segments)}`);
      assert.equal(seg.status, 'unverified');
    });
  }

  describe('片仮名・未知語に続く ひらがなの内容語は判定しない', () => {
    for (const w of ['ヤバい', 'エモい', 'ウザい', 'スゴい', 'ﾔﾊﾞい', 'マジでヤバい']) expectUnverified(w, 'い');
    expectOut('コーヒーを飲んでいる', 'コーヒーを飲んでゐる');
    expectOut('今日はテストだった', '今日はテストだつた');
  });

  describe('語幹が1字以下の ひらがなの動詞は辞書がなければ変えない', () => {
    for (const w of ['ゆうめい', 'ゆうき', 'ゆうれい', 'ゆうじん', 'ゆうた', 'すうがく', 'ぬうぼう']) {
      expectUnverified(w, w[0]);
    }
    // 小書き→大書き（初期ON）は unverified の部分にも当たる
    expectUnverified('ゆうしゃ', 'ゆう', 'ゆうしや');
    expectUnverified('ゆうりょう', 'ゆう', 'ゆうりよう');
    // 形容詞は対象外
    expectOut('よかろう', 'よからう');
    expectOut('いう', 'いふ');
    expectOut('かう', 'かふ');
    expectOut('おもう', 'おもふ');
    expectOut('みる', 'みる');
    expectOut('した', 'した');
  });

  describe('活用しない語の品詞の取り違え', () => {
    expectUnverified('いえ、ちがいます', 'いえ', 'いえ、ちがひます');
    expectOut('そうして家に帰った', 'さうして家に帰つた');
  });

  describe('結合用の濁点・半濁点', () => {
    expectUnverified('か' + 'う\u3099', 'う\u3099');
    expectUnverified('は\u309Aい', 'は');
  });

  test('ランダムな入力でも、仮名以外は変わらず、segments の連結は output', () => {
    const alphabet = [
      ...'あいうえおかがきぎくぐけげこごさしすせそたちつてとなにぬねのはばぱひふへほまみむめもやゆよらりるれろわをんぁぃぅぇぉっゃゅょゎゔ',
      ...'アイウエオカガキクケコサシスセソタチツテトナニヌネノハバパヒフヘホマミムメモヤユヨラリルレロワヲンァィゥェォッャュョー',
      ...'ｱｲｳｴｵﾔﾊﾞﾟ', ...'今日雨降家思言買考見行来大小中', ...'abcXYZ019 .,!?/:', '\n', '、', '。', '！', '🙂', '🎉', '\u3099', '\u309A',
    ];
    const notKana = (s) => s.replace(/[\u3040-\u30FF\uFF66-\uFF9F]/g, '');
    let x = 2026;
    const rand = (n) => {
      x = (x * 1103515245 + 12345) % 2147483648;
      return x % n;
    };
    for (let k = 0; k < 300; k++) {
      let input = '';
      const len = 1 + rand(40);
      for (let i = 0; i < len; i++) input += alphabet[rand(alphabet.length)];
      for (const smallToLarge of [true, false]) {
        const r = conv.convert(input, { smallToLarge });
        assert.equal(r.segments.map((s) => s.text).join(''), r.output, JSON.stringify(input));
        assert.equal(notKana(r.output), notKana(input), JSON.stringify(input));
      }
    }
  });
});

describe('segments.source', () => {
  for (const input of ['そうでしょう', '今日は雨が降っているので、ヤバい。', 'ほげ ふが']) {
    test(`source を連結すると入力に戻る: ${input}`, () => {
      const { segments } = conv.convert(input);
      assert.equal(segments.map((s) => s.source).join(''), input);
    });
  }
  test('converted の source は元の字を持つ', () => {
    const { segments } = conv.convert('そうでしょう');
    const converted = segments.filter((s) => s.status === 'converted');
    assert.ok(converted.length > 0);
    assert.ok(converted.every((s) => 'そうでしょう'.includes(s.source) && s.source !== s.text));
  });
});
