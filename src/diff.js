const LIMIT = 200;

/**
 * 変換後の text の各字（コードポイント）が、元の source と共通でない（＝変わった）かを返す。
 * 最長共通部分列で対応づける。どちらかが LIMIT 字を超えるときは全部 true。
 * @param {string} source 元の文字列
 * @param {string} text 変換後の文字列
 * @returns {boolean[]} text のコードポイントごとの「変わった」
 */
export function changedMask(source, text) {
  const a = Array.from(source);
  const b = Array.from(text);
  if (a.length > LIMIT || b.length > LIMIT) return b.map(() => true);
  const n = a.length;
  const m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const mask = b.map(() => true);
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      mask[j] = false;
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  return mask;
}
