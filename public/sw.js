// 旧かな変換のサービスワーカー。インストール時に、ビルドで出る precache-manifest.json の
// 全ファイルを保存し、同一オリジンの GET は保存済みを先に返す（オフラインで動く）。
// VERSION はビルド時に Vite プラグインが書き込む（sw.js のバイト列が版ごとに変わり、更新が届く）。
// ファイル一覧は manifest から読むが、版が VERSION と違えば失敗させる（古い一覧を混ぜない）。
const VERSION = '__PRECACHE_VERSION__';
const PREFIX = 'kyukana-';
const CACHE = PREFIX + VERSION;
const BASE = new URL('./', self.location).pathname;
const MANIFEST = BASE + 'precache-manifest.json';

// assets/ の中はファイル名にハッシュが付く。それ以外（index・アイコン等）は名前が変わらないので、
// ブラウザの HTTP キャッシュの古い版を拾わないよう reload で取る。
const isHashed = (f) => f.startsWith('assets/');

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const res = await fetch(MANIFEST, { cache: 'no-store' });
      if (!res.ok) throw new Error('precache-manifest.json: ' + res.status);
      const { version, files } = await res.json();
      if (version !== VERSION) throw new Error('precache-manifest.json の版が sw.js と違います');
      const cache = await caches.open(CACHE);
      await cache.addAll(
        files.map((f) => (isHashed(f) ? new Request(BASE + f) : new Request(BASE + f, { cache: 'reload' }))),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key.startsWith(PREFIX) && key !== CACHE) await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  event.respondWith(
    (async () => {
      // ignoreVary: 配信側が Vary: Origin 等を付けると、Origin を持つ module/CSS の要求が
      // 保存時（Origin なし）の応答と一致せず、オフラインで外れるため。
      const cache = await caches.open(CACHE);
      const hit = await cache.match(req, { ignoreVary: true, ignoreSearch: req.mode === 'navigate' });
      if (hit) return hit;
      try {
        return await fetch(req);
      } catch (e) {
        if (req.mode === 'navigate') {
          const shell = await cache.match(BASE, { ignoreVary: true });
          if (shell) return shell;
        }
        throw e;
      }
    })(),
  );
});
