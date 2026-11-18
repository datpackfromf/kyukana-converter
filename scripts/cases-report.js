// tests/cases.json の全ケースを変換し、合格数と不合格の一覧を出す（終了コードは常に0）。
import { readFileSync } from 'node:fs';
import { getNodeAnalyzer } from '../tests/helpers/analyzer-node.js';
import { createDict } from '../src/engine/dict.js';
import { createConverter } from '../src/engine/convert.js';

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const cases = read('../tests/cases.json');
const conv = createConverter({ analyzer: await getNodeAnalyzer(), dict: createDict(read('../data/dict.json')) });

const failures = [];
for (const c of cases) {
  const got = conv.convert(c.input, c.options).output;
  if (got !== c.expected) failures.push({ ...c, got });
}
console.log(`cases: ${cases.length - failures.length}/${cases.length} passed`);
for (const f of failures) {
  const opts = f.options ? ` ${JSON.stringify(f.options)}` : '';
  console.log(`  ${f.input} → ${f.got} (${f.expected})${opts} [${f.source}]`);
}
process.exitCode = 0;
