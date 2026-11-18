import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writePrecache } from '../scripts/precache-plugin.js';

const SW = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');

/** sw.js を模擬環境で動かし、登録されたイベントハンドラと呼び出し記録を返す */
function loadSw({ version = 'v1', manifest, existingKeys = [], cachedHit = null } = {}) {
  const handlers = {};
  const log = { fetches: [], opened: [], deleted: [], matches: [], added: [] };
  const cache = {
    addAll: async (reqs) => log.added.push(...reqs),
    match: async (req, opts) => {
      log.matches.push(opts);
      return cachedHit;
    },
  };
  const ctx = {
    self: {
      location: new URL('https://example.test/kyukana-converter/sw.js'),
      addEventListener: (type, fn) => (handlers[type] = fn),
      skipWaiting: async () => {},
      clients: { claim: async () => {} },
    },
    caches: {
      open: async (name) => (log.opened.push(name), cache),
      keys: async () => existingKeys,
      delete: async (k) => log.deleted.push(k),
    },
    fetch: async (url) => {
      log.fetches.push(String(url));
      return { ok: true, json: async () => manifest };
    },
    // 実際の SW では相対パスの Request が自分の場所を基準に解決される
    Request: class extends Request {
      constructor(u, o) {
        super(new URL(u, 'https://example.test/').href, o);
      }
    },
    URL,
    Error,
  };
  vm.runInNewContext(SW.split('__PRECACHE_VERSION__').join(version), ctx);
  return { handlers, log };
}

const run = (handler, event = {}) => {
  let p;
  handler({ ...event, waitUntil: (x) => (p = x), respondWith: (x) => (p = x) });
  return p;
};

test('sw.js: 版のプレースホルダは1か所だけで、置換できる形をしている', () => {
  assert.equal(SW.split('__PRECACHE_VERSION__').length, 2);
  assert.match(SW, /const VERSION = '__PRECACHE_VERSION__';/);
});

test('sw.js install: ハッシュ付き assets/ は通常の取得、それ以外は reload で取る', async () => {
  const { handlers, log } = loadSw({
    manifest: { version: 'v1', files: ['', 'index.html', 'icon-192.png', 'assets/a-1.js', 'assets/b-2.wasm'] },
  });
  await run(handlers.install);
  assert.deepEqual(log.opened, ['kyukana-v1']);
  const modes = Object.fromEntries(log.added.map((r) => [new URL(r.url).pathname, r.cache]));
  assert.equal(modes['/kyukana-converter/'], 'reload');
  assert.equal(modes['/kyukana-converter/index.html'], 'reload');
  assert.equal(modes['/kyukana-converter/icon-192.png'], 'reload');
  assert.equal(modes['/kyukana-converter/assets/a-1.js'], 'default');
  assert.equal(modes['/kyukana-converter/assets/b-2.wasm'], 'default');
});

test('sw.js install: manifest の版が sw.js の版と違えば失敗する', async () => {
  const { handlers } = loadSw({ manifest: { version: 'other', files: [''] } });
  await assert.rejects(run(handlers.install), /版/);
});

test('sw.js activate: manifest を取りに行かず、今の版以外の kyukana- だけ消す', async () => {
  const { handlers, log } = loadSw({ existingKeys: ['kyukana-v0', 'kyukana-v1', 'other-x'] });
  await run(handlers.activate);
  assert.deepEqual(log.deleted, ['kyukana-v0']);
  assert.deepEqual(log.fetches, []);
});

test('sw.js fetch: 今の版の保存から ignoreVary で探す', async () => {
  const hit = { hit: true };
  const { handlers, log } = loadSw({ cachedHit: hit });
  const req = { method: 'GET', url: 'https://example.test/kyukana-converter/assets/a-1.js', mode: 'cors' };
  const res = await run(handlers.fetch, { request: req });
  assert.equal(res, hit);
  assert.deepEqual(log.opened, ['kyukana-v1']);
  assert.equal(log.matches[0].ignoreVary, true);
});

test('writePrecache: sw.js に版が入り、内容が同じなら版も同じ・変われば変わる', () => {
  const make = (extra) => {
    const dir = mkdtempSync(join(tmpdir(), 'kk-'));
    mkdirSync(join(dir, 'assets'));
    writeFileSync(join(dir, 'sw.js'), SW);
    writeFileSync(join(dir, 'index.html'), '<html>');
    writeFileSync(join(dir, 'assets', 'a.js'), extra);
    const version = writePrecache(dir);
    const sw = readFileSync(join(dir, 'sw.js'), 'utf8');
    const manifest = JSON.parse(readFileSync(join(dir, 'precache-manifest.json'), 'utf8'));
    rmSync(dir, { recursive: true });
    return { version, sw, manifest };
  };
  const a = make('1'), b = make('1'), c = make('2');
  assert.equal(a.version, b.version);
  assert.notEqual(a.version, c.version);
  assert.ok(a.sw.includes(`const VERSION = '${a.version}';`));
  assert.ok(!a.sw.includes('__PRECACHE_VERSION__'));
  assert.equal(a.manifest.version, a.version);
  assert.deepEqual(a.manifest.files, ['', 'assets/a.js', 'index.html', 'sw.js']);
});
