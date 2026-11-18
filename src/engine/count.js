// X(旧Twitter)の文字数カウント（twitter-text v3 の重み）

export const X_LIMIT = 280;
const URL_WEIGHT = 23;

// weight 1 の範囲。それ以外は 2。
const LIGHT = [
  [0x0000, 0x10ff], [0x2000, 0x200d], [0x2010, 0x201f], [0x2032, 0x2037],
];
const segmenter = new Intl.Segmenter('ja', { granularity: 'grapheme' });

function cpWeight(cp) {
  return LIGHT.some(([a, b]) => cp >= a && cp <= b) ? 1 : 2;
}

/** @param {string} text @returns {number} */
export function countX(text) {
  let total = 0;
  const rest = text.replace(/https?:\/\/\S+/g, () => {
    total += URL_WEIGHT;
    return '';
  });
  for (const { segment } of segmenter.segment(rest)) {
    if (/\p{Extended_Pictographic}/u.test(segment)) {
      total += 2;
    } else {
      for (const ch of segment) total += cpWeight(ch.codePointAt(0));
    }
  }
  return total;
}
