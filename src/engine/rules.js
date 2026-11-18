// 規則層（純粋関数）。根拠は docs/sources.md（文化庁「現代仮名遣い」付表 ほか）。

import { oToA } from './kana.js';

/** @typedef {import('../analyzer.js').Token} Token */

/** IPADIC の品詞 → 辞書の pos */
const POS_KIND = {
  名詞: 'noun', 動詞: 'verb', 形容詞: 'adjective', 副詞: 'adverb',
  感動詞: 'interjection', 助詞: 'particle', 助動詞: 'auxiliary',
};

/** @param {Token} t @returns {string} 辞書の pos（連体詞・接続詞などは 'other'） */
export function posKind(t) {
  return Object.hasOwn(POS_KIND, t.pos) ? POS_KIND[t.pos] : 'other';
}

/** 語彙として扱わないトークン（未知語・解析器の隙間・記号） */
export function isNonLexical(t) {
  return t.pos === '' || t.pos === 'UNK' || t.pos === '記号';
}

/** @param {Token} t 活用する語（動詞・形容詞）か */
export function isConjugating(t) {
  return t.pos === '動詞' || t.pos === '形容詞';
}

/**
 * 辞書の動詞の type が活用型と合うか（一段→ichidan、五段*→godan）。
 * @param {string} cType @param {string|undefined} type
 */
export function verbTypeMatches(cType, type) {
  if (cType.startsWith('一段')) return type === 'ichidan';
  if (cType.startsWith('五段')) return type === 'godan';
  return false;
}

/**
 * 活用する語の表層形を「語幹（送り仮名のうち活用語尾を除いた部分まで）」と「活用語尾」に分ける長さ。
 * 表層形と基本形の共通の先頭部分を、基本形の最後の1字（五段の語尾・一段の「る」・形容詞の「い」）の手前までに限ったもの。
 * @param {string} surface @param {string} base
 * @returns {number} 語幹の長さ（表層形の先頭からの文字数）
 */
export function stemLength(surface, base) {
  if (!base) return surface.length;
  const max = Math.min(surface.length, base.length - 1);
  let n = 0;
  while (n < max && surface[n] === base[n]) n++;
  return n;
}

// --- 規則1: ワ行五段動詞の活用語尾 ---

const WA_ENDING = { わ: 'は', い: 'ひ', う: 'ふ', え: 'へ', お: 'は' };

/** @param {string} cType */
export function isWaGodan(cType) {
  return cType === '五段・ワ行促音便' || cType === '五段・ワ行ウ音便';
}

/**
 * ワ行五段の活用語尾の最後の1字をハ行にする（言わ→言は、言っ→言っ）。
 * @param {string} ending 活用語尾 @returns {string}
 */
export function waGodanEnding(ending) {
  if (!ending) return ending;
  const last = ending[ending.length - 1];
  return Object.hasOwn(WA_ENDING, last) ? ending.slice(0, -1) + WA_ENDING[last] : ending;
}

// --- 規則2: 意志・推量の「う」の直前 ---

/** @param {Token|undefined} t 意志・推量の助動詞「う」か */
export function isVolitionalU(t) {
  return !!t && t.pos === '助動詞' && t.surface === 'う' && t.base === 'う';
}

/**
 * 「う」の直前でオ段→ア段にする語か。五段動詞・形容詞・助動詞（ます・です・だ・た・ない・たい 等の特殊型、五段型）。
 * 一段・サ変・カ変（考えよ・しよ・来よ）と、一段型の助動詞（られよ・させよ）は対象外。
 * @param {Token} t
 */
export function takesVolitionalA(t) {
  if (t.pos === '動詞') return t.cType.startsWith('五段');
  if (t.pos === '形容詞') return true;
  if (t.pos === '助動詞') return /^(五段|特殊|形容詞)/.test(t.cType);
  return false;
}

/**
 * 末尾が「しょ」なら「せ」に（でしょ→でせ、ましょ→ませ）、オ段ならア段に（書こ→書か、だろ→だら）。
 * @param {string} text @returns {string}
 */
export function volitionalA(text) {
  if (text.endsWith('しょ')) return text.slice(0, -2) + 'せ';
  if (!text) return text;
  return text.slice(0, -1) + oToA(text[text.length - 1]);
}

// --- 規則3: 形容詞の連用ゴザイ接続（ウ音便） ---

/** @param {Token} t */
export function isAdjectiveUonbin(t) {
  return t.pos === '形容詞' && t.cForm === '連用ゴザイ接続' && t.base.endsWith('い');
}

/**
 * 基本形の語幹＋「う」（うれしい→うれしう、早い→早う）。
 * @param {string} base 歴史的仮名にした基本形 @returns {string}
 */
export function adjectiveUonbin(base) {
  return base.slice(0, -1) + 'う';
}

// --- 規則4: 助動詞語幹「よう」「そう」 ---

const AUX_STEM = { よう: 'やう', そう: 'さう' };

/**
 * 名詞（非自立・特殊・接尾）の助動詞語幹 よう→やう、そう→さう。当たらなければ null。
 * 意志の助動詞「よう」（品詞が助動詞）は対象外。
 * @param {Token} t @returns {string|null}
 */
export function auxiliaryStem(t) {
  if (t.pos !== '名詞' || t.pos2 !== '助動詞語幹') return null;
  return Object.hasOwn(AUX_STEM, t.surface) ? AUX_STEM[t.surface] : null;
}

// --- 規則5: 歴史的仮名遣いでも同じ形の助詞・助動詞（閉じた一覧） ---
// 根拠: 付表の例（我は・又は・西へ・花を・思はず の「ず」・見ませう の「ます」・見よう の「よう」・
// 言はない 等）と、文化庁「現代仮名遣い」本文が助詞「は」「へ」「を」を歴史的仮名遣いに従って書くとしていること。
// 「くらい／ぐらい」「ずつ」のように変わる語は辞書で扱う。

/** 表層形で照合する助詞 */
export const KEPT_PARTICLES = new Set([
  'は', 'へ', 'を', 'が', 'に', 'で', 'と', 'の', 'も', 'か', 'や', 'から', 'まで', 'より',
  'ので', 'のに', 'けど', 'けれど', 'けれども', 'て', 'ば', 'し', 'ね', 'よ', 'な', 'ぞ', 'ぜ',
  'さ', 'って', 'など', 'ばかり', 'だけ', 'しか', 'ほど', 'ながら', 'つつ', 'たり', 'だり',
  'かな', 'こそ', 'でも', 'ても', 'とも', 'へと', 'にて',
]);

/** 基本形で照合する助動詞（活用形はどれも同じ形のまま。でしょ・だろ 等の「う」の前は規則2が変える） */
export const KEPT_AUXILIARIES = new Set([
  'ます', 'です', 'だ', 'た', 'ない', 'ぬ', 'う', 'よう', 'まい', 'たい', 'らしい',
  'れる', 'られる', 'せる', 'させる', 'ござる',
]);

/** @param {Token} t 閉じた一覧で「確認済み・変更なし」とする助詞・助動詞か */
export function isClosedClassKept(t) {
  if (t.pos === '助詞') return KEPT_PARTICLES.has(t.surface);
  if (t.pos === '助動詞') return KEPT_AUXILIARIES.has(t.base);
  return false;
}
