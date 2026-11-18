import { readFileSync } from 'node:fs';
import { createAnalyzer } from '../../src/analyzer.js';

const WASM_URL = new URL(
  '../../node_modules/lindera-wasm-web-ipadic/lindera_wasm_bg.wasm',
  import.meta.url,
);

/** @type {Promise<import('../../src/analyzer.js').Analyzer> | null} */
let cached = null;

/**
 * テスト用に Node で解析器を1回だけ初期化して返す。
 * @returns {Promise<import('../../src/analyzer.js').Analyzer>}
 */
export function getNodeAnalyzer() {
  if (!cached) cached = createAnalyzer(readFileSync(WASM_URL));
  return cached;
}
