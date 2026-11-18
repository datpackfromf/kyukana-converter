// 辞書層: data/dict.json の索引化と検索（純粋関数）

/**
 * @typedef {object} Entry
 * @property {string} modern 現代仮名（ひらがな・基本形）
 * @property {string} historical 歴史的仮名（ひらがな・基本形）
 * @property {string} [kanji] 漢字表記
 * @property {'noun'|'verb'|'adjective'|'adverb'|'interjection'|'particle'|'auxiliary'|'other'} pos
 * @property {'ichidan'|'godan'} [type] 動詞の活用の種類
 * @property {boolean} [scan] 最長一致の再分割に使ってよい語
 * @property {string[]} src 出典
 */

/**
 * @typedef {object} Dict
 * @property {(kana: string, pred?: (e: Entry) => boolean) => Entry|null} bySurface 現代仮名で引く
 * @property {(base: string, pred?: (e: Entry) => boolean) => Entry|null} byLemma 漢字表記または現代仮名で引く
 * @property {(text: string, i: number) => Entry|null} scanAt text の i 文字目から scan:true の語の最長一致
 */

/** 再分割に使う語の最短の長さ（設計書: 3文字以上） */
const SCAN_MIN_LENGTH = 3;

/**
 * @template K
 * @param {Map<K, Entry[]>} map @param {K} key @param {Entry} e
 */
function push(map, key, e) {
  const list = map.get(key);
  if (list) list.push(e);
  else map.set(key, [e]);
}

/**
 * @param {Entry[] | undefined} list
 * @param {((e: Entry) => boolean) | undefined} pred
 * @returns {Entry|null}
 */
function first(list, pred) {
  if (!list) return null;
  return list.find((e) => !pred || pred(e)) ?? null;
}

/**
 * @param {{ entries: Entry[] }} json data/dict.json の中身
 * @returns {Dict}
 */
export function createDict(json) {
  /** @type {Map<string, Entry[]>} */
  const surface = new Map();
  /** @type {Map<string, Entry[]>} */
  const lemma = new Map();
  /** @type {Map<string, Entry[]>} 先頭の文字 → 長い順 */
  const scan = new Map();

  for (const e of json.entries ?? []) {
    push(surface, e.modern, e);
    push(lemma, e.modern, e);
    if (e.kanji && e.kanji !== e.modern) push(lemma, e.kanji, e);
    if (e.scan && e.modern.length >= SCAN_MIN_LENGTH) push(scan, e.modern[0], e);
  }
  for (const list of scan.values()) list.sort((a, b) => b.modern.length - a.modern.length);

  return {
    bySurface: (kana, pred) => first(surface.get(kana), pred),
    byLemma: (base, pred) => first(lemma.get(base), pred),
    scanAt(text, i) {
      const list = scan.get(text[i]);
      if (!list) return null;
      return list.find((e) => text.startsWith(e.modern, i)) ?? null;
    },
  };
}
