// かな操作ユーティリティ（純粋関数）

/** カタカナ(ァ-ヶ)をひらがなにする。ー・ヷ-ヺ・その他はそのまま。 */
export function toHiragana(s) {
  return s.replace(/[\u30A1-\u30F6]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

/** 全体がひらがな（ー含む）。空文字は false。 */
export function isHiraganaOnly(s) {
  return /^[\u3041-\u309F\u30FC]+$/.test(s);
}

/** 全体がカタカナ（ー含む）。空文字は false。 */
export function isKatakanaOnly(s) {
  return /^[\u30A1-\u30FA\u30FC-\u30FF]+$/.test(s);
}

/** 漢字（々・〆含む）を含むか。 */
export function hasKanji(s) {
  return /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\u3005\u3006]/.test(s);
}

/** 末尾に続くひらがな部分（ひらがなのみ）。 */
export function trailingKana(s) {
  const m = s.match(/[\u3041-\u309F]*$/);
  return m ? m[0] : '';
}

const O_TO_A = {
  こ: 'か', ご: 'が', そ: 'さ', ぞ: 'ざ', と: 'た', ど: 'だ', の: 'な',
  ほ: 'は', ぼ: 'ば', ぽ: 'ぱ', も: 'ま', よ: 'や', ろ: 'ら', を: 'わ',
};

/** お段→あ段（お→は はワ行用で呼び出し側が扱う。対象外はそのまま）。 */
export function oToA(ch) {
  return Object.hasOwn(O_TO_A, ch) ? O_TO_A[ch] : ch;
}

const SMALL = 'ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮ';
const LARGE = 'あいうえおつやゆよわアイウエオツヤユヨワ';

/** 小書きかなを大書きにする。 */
export function smallToLarge(s) {
  let out = '';
  for (const c of s) {
    const i = SMALL.indexOf(c);
    out += i >= 0 ? LARGE[i] : c;
  }
  return out;
}

/** ひらがなにして い・う・え・お・わ・じ・ず のいずれかを含むか。 */
export function hasAmbiguousKana(s) {
  return /[いうえおわじず]/.test(toHiragana(s));
}
