// X(旧Twitter)の文字数カウント（twitter-text v3 の重み）

export const X_LIMIT = 280;
const URL_WEIGHT = 23;

// weight 1 の範囲。それ以外は 2。
const LIGHT = [
  [0x0000, 0x10ff], [0x2000, 0x200d], [0x2010, 0x201f], [0x2032, 0x2037],
];
/** @type {{ segment(s: string): Iterable<{ segment: string }> } | null} */
let segmenter = null;

/** 書記素ごとに分ける。Intl.Segmenter がない環境ではコードポイントごと。初回の呼び出しで作る。 */
function graphemes(s) {
  if (!segmenter) {
    segmenter = typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
      ? new Intl.Segmenter('ja', { granularity: 'grapheme' })
      : { segment: (x) => Array.from(x, (segment) => ({ segment })) };
  }
  return segmenter.segment(s);
}

function cpWeight(cp) {
  return LIGHT.some(([a, b]) => cp >= a && cp <= b) ? 1 : 2;
}

/** @param {string} text @returns {number} */
export function countX(text) {
  let total = 0;
  const rest = text.normalize('NFC').replace(/https?:\/\/[A-Za-z0-9\-._~:/?#\[\]@!$&'()*+,;=%]+/gi, (m) => {
    total += URL_WEIGHT;
    return m.match(/[.,!?;:)'"]*$/)[0]; // 末尾の句読点はURLに含めない
  });
  for (const { segment } of graphemes(rest)) {
    if (/\p{Extended_Pictographic}|^[\u{1F1E6}-\u{1F1FF}]|\u20E3/u.test(segment)) {
      total += 2;
    } else {
      for (const ch of segment) total += cpWeight(ch.codePointAt(0));
    }
  }
  return total;
}
