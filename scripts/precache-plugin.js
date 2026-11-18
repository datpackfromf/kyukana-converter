import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const MANIFEST = 'precache-manifest.json';
const PLACEHOLDER = '__PRECACHE_VERSION__';

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

/**
 * ビルド後の dist に対して2つのことをする。
 * 1. 全ファイル（wasm を含む）の一覧と版を dist/precache-manifest.json に書く（sw.js がインストール時に一覧を読む）。
 * 2. dist/sw.js の `__PRECACHE_VERSION__` を同じ版に置き換える（sw.js のバイト列を版ごとに変え、ブラウザに更新を検知させる）。
 * 版は sw.js（置換前）を含む全ファイルの名前と中身のハッシュ。内容が同じなら同じ版になる。
 * @param {string} outDir
 */
export function writePrecache(outDir) {
  const files = walk(outDir)
    .map((p) => relative(outDir, p).split(sep).join('/'))
    .filter((f) => f !== MANIFEST)
    .sort();
  const hash = createHash('sha1');
  for (const f of files) hash.update(f).update(readFileSync(join(outDir, f)));
  const version = hash.digest('hex').slice(0, 12);
  const swPath = join(outDir, 'sw.js');
  const sw = readFileSync(swPath, 'utf8');
  if (!sw.includes(PLACEHOLDER)) throw new Error('sw.js に ' + PLACEHOLDER + ' がありません');
  writeFileSync(swPath, sw.split(PLACEHOLDER).join(version));
  // '' は起点のページ（/kyukana-converter/）
  writeFileSync(join(outDir, MANIFEST), JSON.stringify({ version, files: ['', ...files] }));
  return version;
}

export function precacheManifest() {
  let outDir = 'dist';
  return {
    name: 'precache-manifest',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    closeBundle() {
      writePrecache(outDir);
    },
  };
}
