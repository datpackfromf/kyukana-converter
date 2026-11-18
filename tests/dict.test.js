import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const dict = JSON.parse(readFileSync(new URL('../data/dict.json', import.meta.url), 'utf8'));

test('辞書の全項目に出典 src があり、すべて sources に存在する', () => {
  assert.ok(dict.entries.length > 0);
  const keys = new Set(Object.keys(dict.sources));
  for (const e of dict.entries) {
    assert.ok(Array.isArray(e.src) && e.src.length > 0, `src が空: ${e.modern}`);
    for (const k of e.src) assert.ok(keys.has(k), `${e.modern}: 未定義の出典 ${k}`);
  }
});
