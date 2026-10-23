// Lets the app open without a signal. The page itself is fetched from the network first and the copy
// kept here is used only when that fails; the build's files (/_next/static, named by their content)
// are kept as they are first loaded. Nothing else is touched: API calls, login and Supabase go straight
// to the network, and the records themselves are kept by the app (src/lib/store/offline.ts).
const PAGES = "kakeibo-pages-v1";
const FILES = "kakeibo-files-v1";
// a deploy changes the file names, so old ones pile up; past this many the list starts over
const MAX_FILES = 300;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate" && url.pathname === "/") {
    event.respondWith(page(request));
  } else if (url.pathname.startsWith("/_next/static/") || /^\/(icon|icon-maskable)\.svg$|^\/manifest\.webmanifest$/.test(url.pathname)) {
    event.respondWith(file(request));
  }
});

async function page(request) {
  const cache = await caches.open(PAGES);
  try {
    const response = await fetch(request);
    // a signed-out visit is sent to /login; only keep the app itself
    if (response.ok && !response.redirected) await cache.put("/", response.clone());
    return response;
  } catch (e) {
    const kept = await cache.match("/");
    if (kept) return kept;
    throw e;
  }
}

async function file(request) {
  const cache = await caches.open(FILES);
  const kept = await cache.match(request);
  if (kept) return kept;
  const response = await fetch(request);
  if (response.ok) {
    if ((await cache.keys()).length >= MAX_FILES) await caches.delete(FILES);
    await (await caches.open(FILES)).put(request, response.clone());
  }
  return response;
}
