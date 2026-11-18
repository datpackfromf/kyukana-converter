// 変換本体: 0層（解析と再分割）→ 1層（規則）→ 2層（辞書）をまとめる。
// 解析器と辞書は引数で受け取る純粋な処理で、入力文はどこにも送らない。

import { toHiragana, isHiraganaOnly, hasKanji, smallToLarge, hasAmbiguousKana } from './kana.js';
import {
  posKind, isConjugating, verbTypeMatches, stemLength,
  isWaGodan, waGodanEnding, isVolitionalU, takesVolitionalA, volitionalA,
  isAdjectiveUonbin, adjectiveUonbin, auxiliaryStem, isClosedClassKept,
} from './rules.js';

/** @typedef {import('../analyzer.js').Token} Token */
/** @typedef {import('../analyzer.js').Analyzer} Analyzer */
/** @typedef {import('./dict.js').Dict} Dict */
/** @typedef {import('./dict.js').Entry} Entry */
/** @typedef {'kept'|'converted'|'unverified'} Status */
/** @typedef {{ text: string, status: Status }} Segment */
/** @typedef {Token & { scanEntry?: Entry }} WorkToken */

const HIRAGANA = /[ぁ-ゟ]/;
const KANA_CHAR = /[ぁ-ゟァ-ヺー]/;

/** @param {{ surface: string }[]} ts */
const lengthOf = (ts) => ts.reduce((n, t) => n + t.surface.length, 0);

/** @param {string} s ひらがなだけを抜き出す */
const hiraganaOf = (s) => s.replace(/[^ぁ-ゟ]/g, '');

// ---------------------------------------------------------------- 0層

/**
 * lindera は長いひらがな列で「き|ょうはゆうがた…（未知語）」のように、ひらがなを含む長い未知語を返すことがある。
 * @param {Token} t
 */
const isBrokenUnknown = (t) => (t.pos === 'UNK' || t.pos === '') && t.surface.length > 1 && HIRAGANA.test(t.surface);

/** 解析し直す1回分の長さの上限。全体の手間を入力の長さにほぼ比例させるため。 */
const REPAIR_WINDOW = 32;
/** 語の始まりにならない小書きのかな */
const SMALL_KANA_START = /^[ぁぃぅぇぉっゃゅょゎゕゖ]/;

/** @param {string} surface @returns {Token} */
const unknownToken = (surface) => ({ surface, pos: 'UNK', pos1: '', pos2: '', cType: '', cForm: '', base: '', reading: '' });

/**
 * 壊れた未知語（とその手前の語）の範囲を、REPAIR_WINDOW 字以内の区切りごとに、未知語の出ない長さまで
 * 半分ずつ縮めて解析する。最後のトークンは区切りで切れている可能性があるので次の区切りに回す。
 * 小書きのかなで始まる所は、その1字を未知語として進める。
 * @param {Analyzer} analyzer @param {string} span
 * @returns {Token[]}
 */
function repairSpan(analyzer, span) {
  /** @type {Token[]} */
  const out = [];
  let pos = 0;
  while (pos < span.length) {
    const chunk = span.slice(pos, pos + REPAIR_WINDOW);
    const isLast = pos + chunk.length === span.length;
    /** @type {Token[]} */
    let take;
    if (SMALL_KANA_START.test(chunk)) {
      take = [unknownToken(chunk[0])];
    } else {
      for (let len = chunk.length; ; len = Math.ceil(len / 2)) {
        const part = analyzer.tokenize(chunk.slice(0, len));
        if (part.some(isBrokenUnknown)) continue; // 1文字なら必ず抜ける
        take = (len === chunk.length && isLast) || part.length === 1 ? part : part.slice(0, -1);
        break;
      }
    }
    out.push(...take);
    pos += lengthOf(take);
  }
  return out;
}

/**
 * 解析は全体を1回だけ行い、壊れた未知語の所だけを repairSpan で直す。
 * @param {Analyzer} analyzer @param {string} text
 * @returns {Token[]} 表層形を連結すると text になる
 */
function tokenizeRobust(analyzer, text) {
  /** @type {Token[]} */
  const out = [];
  for (const t of analyzer.tokenize(text)) {
    if (!isBrokenUnknown(t)) {
      out.push(t);
      continue;
    }
    // 手前のひらがなの語（「き|ょう…」の「き」）も誤りの一部なので一緒に解析し直す
    const prev = out.length && HIRAGANA.test(out[out.length - 1].surface) ? out.pop() : null;
    out.push(...repairSpan(analyzer, (prev ? prev.surface : '') + t.surface));
  }
  return out;
}

/**
 * 辞書の最長一致による再分割: ひらがなで始まるトークンの位置から scan:true の語が
 * トークンより長く一致したら、その語を1語として採り、一致の終わりから元のトークンの終わりまでを解析し直す。
 * @param {Analyzer} analyzer @param {Dict} dict @param {string} text @param {Token[]} tokens
 * @returns {WorkToken[]}
 */
function resegment(analyzer, dict, text, tokens) {
  /** @type {WorkToken[]} */
  const list = tokens.slice();
  let pos = 0;
  for (let i = 0; i < list.length; i++) {
    const t = list[i];
    const entry = HIRAGANA.test(text[pos]) ? dict.scanAt(text, pos) : null;
    if (entry && entry.modern.length > t.surface.length) {
      const end = pos + entry.modern.length;
      let k = i;
      let kEnd = pos + t.surface.length;
      while (kEnd < end) kEnd += list[++k].surface.length;
      /** @type {WorkToken} */
      const word = {
        surface: text.slice(pos, end), pos: '', pos1: '', pos2: '', cType: '', cForm: '',
        base: entry.modern, reading: '', scanEntry: entry,
      };
      const tail = kEnd > end ? tokenizeRobust(analyzer, text.slice(end, kEnd)) : [];
      list.splice(i, k - i + 1, word, ...tail);
    }
    pos += list[i].surface.length;
  }
  return list;
}

// ---------------------------------------------------------------- 表記の対応づけ

/**
 * 表層形の仮名の部分を読みに対応づけ、変換後の読みの同じ位置の仮名で置き換える（考え→考へ、買い物→買ひ物）。
 * 漢字などの部分はそのまま。対応がつかなければ null。
 * @param {string} surface 表層形 @param {string} reading 読み（ひらがな） @param {string} converted 変換後の読み（同じ長さ）
 * @returns {string|null}
 */
function mapReading(surface, reading, converted) {
  if (!reading || reading.length !== converted.length) return null;
  /** @type {{ text: string, kana: boolean }[]} */
  const runs = [];
  for (const ch of surface) {
    const kana = KANA_CHAR.test(ch);
    const last = runs[runs.length - 1];
    if (last && last.kana === kana) last.text += ch;
    else runs.push({ text: ch, kana });
  }
  const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`^${runs.map((r) => (r.kana ? `(${escape(toHiragana(r.text))})` : '(.+?)')).join('')}$`, 'd');
  const m = re.exec(reading);
  if (!m?.indices) return null;
  return runs
    .map((r, i) => {
      if (!r.kana) return r.text;
      const [s, e] = /** @type {[number, number]} */ (m.indices[i + 1]);
      // 元が片仮名の字は片仮名で返す
      return [...converted.slice(s, e)]
        .map((c, j) => (r.text[j] !== toHiragana(r.text[j]) ? String.fromCharCode(c.charCodeAt(0) + 0x60) : c))
        .join('');
    })
    .join('');
}

/**
 * 辞書の項目を語全体に当てはめる（読み＝項目の modern のとき）。
 * @param {string} surface @param {string} reading ひらがな @param {Entry} entry
 * @returns {string|null}
 */
function applyWhole(surface, reading, entry) {
  if (reading !== entry.modern) return null;
  if (surface === entry.modern) return entry.historical;
  return mapReading(surface, entry.modern, entry.historical);
}

// ---------------------------------------------------------------- トークンごとの変換

/**
 * @param {string} original @param {string} text @param {boolean} decided
 * @returns {Segment}
 */
function result(original, text, decided) {
  if (!decided) return { text: original, status: 'unverified' };
  return { text, status: text === original ? 'kept' : 'converted' };
}

/**
 * 動詞・形容詞。辞書で語幹を直し、その上でワ行語尾（規則1）・ウ音便（規則3）・意志の「う」の前（規則2）を当てる。
 * 判定は送り仮名のうち活用語尾を除いた部分（語幹側）で行う。
 * @param {Dict} dict @param {Token} t @param {Token|undefined} next
 * @returns {Segment}
 */
function convertConjugating(dict, t, next) {
  const kind = posKind(t);
  const entry = t.base
    ? dict.byLemma(t.base, (e) => e.pos === kind && (kind !== 'verb' || verbTypeMatches(t.cType, e.type)))
    : null;

  if (isAdjectiveUonbin(t)) {
    // 形容詞のウ音便: 基本形（辞書があれば歴史的仮名にしたもの）の語幹＋「う」
    const base = entry ? applyWhole(t.base, entry.modern, entry) : null;
    const decided = base !== null || !hasAmbiguousKana(hiraganaOf(t.base.slice(0, -1)));
    return result(t.surface, adjectiveUonbin(base ?? t.base), decided);
  }

  const n = stemLength(t.surface, t.base);
  let surface = t.surface;
  let decided = !hasAmbiguousKana(hiraganaOf(surface.slice(0, n)));
  if (entry) {
    const modernStem = entry.modern.slice(0, -1);
    const reading = toHiragana(t.reading);
    if (reading.startsWith(modernStem) && entry.historical.length === entry.modern.length) {
      const mapped = mapReading(surface, reading, entry.historical.slice(0, -1) + reading.slice(modernStem.length));
      // ひらがなだけの語で辞書が同じ形（こえる→こえる）のときは、解析の取り違え（声→越え）を見分けられないので
      // 確認済みの根拠にしない。形が変わる項目はそのまま当てる。
      const identity = entry.historical === entry.modern && isHiraganaOnly(t.surface);
      if (mapped !== null && !identity) {
        surface = mapped;
        decided = true;
      }
    }
  }
  const ending = isWaGodan(t.cType) ? waGodanEnding(surface.slice(n)) : surface.slice(n);
  let text = surface.slice(0, n) + ending;
  if (isVolitionalU(next) && takesVolitionalA(t)) text = volitionalA(text);
  return result(t.surface, text, decided);
}

/**
 * 助詞・助動詞。辞書（くらい・ずつ 等）→ 規則2（でしょ・ましょ・だろ）→ 閉じた一覧 の順。
 * @param {Dict} dict @param {Token} t @param {Token|undefined} next
 * @returns {Segment}
 */
function convertFunctionWord(dict, t, next) {
  const kind = posKind(t);
  const entry = dict.bySurface(t.surface, (e) => e.pos === kind);
  if (entry) return result(t.surface, entry.historical, true);
  if (t.pos === '助動詞' && isVolitionalU(next) && takesVolitionalA(t)) {
    return result(t.surface, volitionalA(t.surface), true);
  }
  if (isClosedClassKept(t)) return result(t.surface, t.surface, true);
  return result(t.surface, t.surface, !hasAmbiguousKana(hiraganaOf(t.surface)));
}

/**
 * 活用しない語（名詞・副詞・感動詞・連体詞・接続詞 など）と未知語。
 * @param {Dict} dict @param {Token} t
 * @returns {Segment}
 */
function convertOther(dict, t) {
  const stem = auxiliaryStem(t);
  if (stem !== null) return result(t.surface, stem, true);

  const kind = posKind(t);
  /** @param {Entry} e */
  const compatible = (e) =>
    e.pos !== 'verb' &&
    (e.pos !== 'adjective' || t.pos1 === '形容動詞語幹') &&
    e.pos !== 'particle' && e.pos !== 'auxiliary';
  const exact = (e) => e.pos === kind && compatible(e);
  const key = hasKanji(t.surface) ? t.base || t.surface : t.surface;
  const lookup = hasKanji(t.surface) ? dict.byLemma : dict.bySurface;
  const entry = t.pos && t.pos !== 'UNK' ? lookup(key, exact) ?? lookup(key, compatible) : null;
  if (entry) {
    const reading = hasKanji(t.surface) ? toHiragana(t.reading) : t.surface;
    const mapped = applyWhole(t.surface, reading, entry);
    if (mapped !== null) return result(t.surface, mapped, true);
  }
  return result(t.surface, t.surface, !hasAmbiguousKana(hiraganaOf(t.surface)));
}

/**
 * @param {Dict} dict @param {WorkToken} t @param {WorkToken|undefined} next
 * @returns {Segment}
 */
function convertToken(dict, t, next) {
  // ひらがなを含まない（漢字だけ・片仮名だけ・記号・英数字・絵文字・URL）はそのまま
  if (!HIRAGANA.test(t.surface)) return { text: t.surface, status: 'kept' };
  if (t.scanEntry) return result(t.surface, t.scanEntry.historical, true);
  if (isConjugating(t)) return convertConjugating(dict, t, next);
  if (t.pos === '助詞' || t.pos === '助動詞') return convertFunctionWord(dict, t, next);
  return convertOther(dict, t);
}

// ---------------------------------------------------------------- 本体

/**
 * @param {{ analyzer: Analyzer, dict: Dict }} deps
 */
export function createConverter({ analyzer, dict }) {
  return {
    /**
     * @param {string} text
     * @param {{ smallToLarge?: boolean }} [opts]
     * @returns {{ output: string, segments: Segment[] }}
     */
    convert(text, opts = {}) {
      const large = opts.smallToLarge ?? true;
      /** @type {Segment[]} */
      const segments = [];
      if (text) {
        const tokens = resegment(analyzer, dict, text, tokenizeRobust(analyzer, text));
        for (let i = 0; i < tokens.length; i++) {
          const seg = convertToken(dict, tokens[i], tokens[i + 1]);
          // 小書き→大書きは最後に、ひらがなを含む語にだけ当てる（片仮名だけの語・記号などは対象外）。
          // それで変わった kept の語は converted にする。unverified は判定していないので unverified のまま。
          const out = large && HIRAGANA.test(seg.text) ? smallToLarge(seg.text) : seg.text;
          if (!out) continue;
          const status = seg.status === 'kept' && out !== tokens[i].surface ? 'converted' : seg.status;
          const last = segments[segments.length - 1];
          if (last && last.status === status) last.text += out;
          else segments.push({ text: out, status });
        }
      }
      return { output: segments.map((s) => s.text).join(''), segments };
    },
  };
}
