import init, { TokenizerBuilder } from 'lindera-wasm-web-ipadic';

/**
 * @typedef {object} Token
 * @property {string} surface 表層形
 * @property {string} pos 品詞
 * @property {string} pos1 品詞細分類1
 * @property {string} pos2 品詞細分類2
 * @property {string} cType 活用型（例: 五段・ワ行促音便）
 * @property {string} cForm 活用形（例: 基本形）
 * @property {string} base 原形
 * @property {string} reading 読み（カタカナ）
 */

/**
 * @typedef {object} Analyzer
 * @property {(text: string) => Token[]} tokenize
 */

const CTYPE_PATTERN = /段|型|特殊・|^不変化/;

/** @param {unknown} v @returns {string} */
const str = (v) => (typeof v === 'string' && v !== '*' ? v : '');

/**
 * lindera 2.0.0 は活用型と活用形が入れ替わって返るので、正しい側へ振り直す。
 * @param {unknown} a conjugationType として届いた値
 * @param {unknown} b conjugationForm として届いた値
 * @returns {{ cType: string, cForm: string }}
 */
function normalizeConjugation(a, b) {
  const x = str(a);
  const y = str(b);
  if (CTYPE_PATTERN.test(y) && !CTYPE_PATTERN.test(x)) return { cType: y, cForm: x };
  if (CTYPE_PATTERN.test(x) && !CTYPE_PATTERN.test(y)) return { cType: x, cForm: y };
  // 判別できない（どちらも空、または「基本形」と「基本形」等）場合は入れ替わりの仮定に従う
  return { cType: y, cForm: x };
}

/** @param {string} surface @returns {Token} */
function gapToken(surface) {
  return { surface, pos: '', pos1: '', pos2: '', cType: '', cForm: '', base: '', reading: '' };
}

/**
 * 解析器を初期化する。入力テキストはどこにも送信されない（すべてローカルの wasm で処理）。
 * @param {string | URL | BufferSource} moduleOrPath wasm の URL・パス、またはバイト列
 * @returns {Promise<Analyzer>}
 */
export async function createAnalyzer(moduleOrPath) {
  await init({ module_or_path: moduleOrPath });
  const builder = new TokenizerBuilder();
  builder.setDictionary('embedded://ipadic');
  builder.setMode('normal');
  builder.setKeepWhitespace(true);
  const tokenizer = builder.build();

  return {
    tokenize(text) {
      // UTF-8 バイト位置 -> 元の文字列の UTF-16 位置。TextEncoder と同じ数え方
      // （単独サロゲートは U+FFFD として3バイト）でずれないようにする。
      const byteToIdx = [];
      let b = 0;
      for (let i = 0; i < text.length; ) {
        const cp = text.codePointAt(i);
        const units = cp > 0xffff ? 2 : 1;
        const isLone = cp >= 0xd800 && cp <= 0xdfff;
        const len = isLone ? 3 : cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
        for (let k = 0; k < len; k++) byteToIdx[b + k] = i;
        b += len;
        i += units;
      }
      byteToIdx[b] = text.length;
      const idx = (byte) => byteToIdx[Math.min(Math.max(byte, 0), b)];

      /** @type {Token[]} */
      const out = [];
      let pos = 0; // 処理済みの UTF-16 位置
      const fillTo = (end) => {
        if (end > pos) {
          out.push(gapToken(text.slice(pos, end)));
          pos = end;
        }
      };
      for (const raw of tokenizer.tokenize(text)) {
        const start = idx(Number(raw.byteStart));
        const end = idx(Number(raw.byteEnd));
        if (end <= pos) continue;
        fillTo(start);
        const { cType, cForm } = normalizeConjugation(raw.conjugationType, raw.conjugationForm);
        out.push({
          surface: text.slice(pos, end),
          pos: str(raw.partOfSpeech),
          pos1: str(raw.partOfSpeechSubcategory1),
          pos2: str(raw.partOfSpeechSubcategory2),
          cType,
          cForm,
          base: str(raw.baseForm),
          reading: str(raw.reading),
        });
        pos = end;
      }
      fillTo(text.length);
      return out;
    },
  };
}
