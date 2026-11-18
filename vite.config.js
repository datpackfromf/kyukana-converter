import { defineConfig } from 'vite';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const EXCLUDE = new Set(['sw.js', 'precache-manifest.json']);

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

/** ビルド後の全ファイル（wasm を含む）を dist/precache-manifest.json に書く。sw.js が読む。 */
function precacheManifest() {
  let outDir = 'dist';
  return {
    name: 'precache-manifest',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    closeBundle() {
      const hash = createHash('sha1');
      const files = walk(outDir)
        .map((p) => relative(outDir, p).split(sep).join('/'))
        .filter((f) => !EXCLUDE.has(f))
        .sort();
      for (const f of files) hash.update(f).update(readFileSync(join(outDir, f)));
      const version = hash.digest('hex').slice(0, 12);
      // '' は起点のページ（/kyukana-converter/）
      writeFileSync(join(outDir, 'precache-manifest.json'), JSON.stringify({ version, files: ['', ...files] }));
    },
  };
}

export default defineConfig({
  base: '/kyukana-converter/',
  plugins: [precacheManifest()],
});
