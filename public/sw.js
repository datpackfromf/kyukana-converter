// 旧かな変換のサービスワーカー。ビルド時に出る precache-manifest.json の全ファイルを
// インストール時に保存し、同一オリジンの GET は保存済みを先に返す（オフラインで動く）。
const PREFIX = 'kyukana-';
const BASE = new URL('./', self.location).pathname;
const MANIFEST = BASE + 'precache-manifest.json';

async function loadManifest() {
  const res = await fetch(MANIFEST, { cache: 'no-store' });
  if (!res.ok) throw new Error('precache-manifest.json: ' + res.status);
  return res.json();
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const { version, files } = await loadManifest();
      const cache = await caches.open(PREFIX + version);
      await cache.addAll(files.map((f) => new Request(BASE + f, { cache: 'reload' })));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const { version } = await loadManifest();
        const keep = PREFIX + version;
        for (const key of await caches.keys()) {
          if (key.startsWith(PREFIX) && key !== keep) await caches.delete(key);
        }
      } catch {
        // 一覧を取れなければ（オフライン）古い保存は消さない
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
      const hit = await caches.match(req, { ignoreSearch: req.mode === 'navigate' });
      if (hit) return hit;
      try {
        return await fetch(req);
      } catch (e) {
        if (req.mode === 'navigate') {
          const shell = await caches.match(BASE);
          if (shell) return shell;
        }
        throw e;
      }
    })(),
  );
});
