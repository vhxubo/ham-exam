/* HAM Exam — Service Worker
   页面：网络优先（保证更新到位），离线回退缓存/首页；
   其余同源资源：stale-while-revalidate（缓存秒回，后台静默更新）。
   发版改动本文件或 CORE 内文件后请递增版本号，activate 会清掉旧缓存。 */
const CACHE = "ham-exam-v2";
const CORE = [
  "./", "index.html", "style.css", "app.js", "manifest.json",
  "icon.svg", "icon-192.png", "icon-512.png", "icon-maskable-512.png",
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const fresh = () =>
    fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy));
      return res;
    });

  if (req.mode === "navigate") {
    e.respondWith(
      fresh().catch(() => caches.match(req).then(hit => hit || caches.match("index.html")))
    );
    return;
  }
  // stale-while-revalidate：有缓存立即返回，同时后台刷新
  e.respondWith(
    caches.match(req).then(hit => {
      const net = fresh().catch(() => hit);
      return hit || net;
    })
  );
});
