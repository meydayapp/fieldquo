/* public/sw.js
 *
 * FieldQuo's service worker. Two jobs, deliberately narrow:
 *
 *   1. Web Push — receive and show (below, unchanged since it was the only
 *      job).
 *   2. An app-shell cache for the FIELD screens — the invoice editor, a job
 *      page, the time clock, the timesheets, the daily sheets — and the
 *      reads those screens make, so a phone in a basement can still open
 *      them and queue what it writes (lib/offline/queue.js). Nothing else is
 *      cached: the worker never becomes a second copy of routing.
 *
 * Registered by app/components/offline/OfflineShell.js on every /app load
 * while the company has offline caching on (Company.offlineCachingEnabled,
 * default on), and by lib/notify/swClient.js when a person turns push on.
 * Same file, same scope, one registration.
 *
 * ── Rules the fetch handler keeps ─────────────────────────────────────────
 *
 *   - Same-origin GET only. Never a POST, never another origin.
 *   - Network first, always. The cache is what answers when the network
 *     does not; a fresh answer replaces the stored one. So the worker can
 *     never serve yesterday's clients to somebody who has signal.
 *   - Only the paths listed in SHELL_PATHS / API_PATHS. Everything else is
 *     not intercepted at all (no respondWith), so the browser does exactly
 *     what it did before this handler existed.
 *   - Never store a response that is not 200, or that is opaque.
 *   - A cached API answer carries `X-FQ-Cache: offline` so a page can tell
 *     "this is from the phone" and say so.
 *   - Off means off: the page posts { type: "fq:offline-config", enabled }
 *     on every load; `enabled: false` empties the cache and stops the
 *     handler. The flag itself is kept in the cache (not in memory) so a
 *     worker restarted by the OS still knows.
 *
 * ── Background Sync ───────────────────────────────────────────────────────
 *
 * The replay lives in the page (lib/offline/queue.js), not here — this
 * worker cannot import the app's modules and a second copy of the replay
 * would be the copy that rots. On the `sync` event the worker only wakes
 * any open tab with { type: "fq:sync" }. No tab → the queue syncs on the
 * next open, and the bar says so.
 *
 * The same file runs unchanged inside the Capacitor shell on branch
 * `mobile` (../fieldquo-mobile), which wraps this web app.
 *
 * Served from public/ so middleware.js never sees it (its matcher excludes
 * paths with a file extension). Scope "/" so one registration covers /app,
 * /sales and /platform on the same origin; the payload's `url` says where a
 * click goes.
 *
 * ── push ──────────────────────────────────────────────────────────────────
 * The payload is lib/notify/push.js's { title, body, tag, url }. If a tab
 * of ours is VISIBLE, the event is handed to it as a message and no system
 * notification is shown: the page draws a toast (app/components/
 * ToastLayer.js listens), which is what the person looking at the screen
 * should see. Chrome waives its "every push must show a notification" rule
 * when the origin has a visible tab, so this is allowed. Otherwise the
 * notification is shown, with `tag` so a page's own in-tab notify() for
 * the same event collapses into it rather than doubling.
 *
 * ── notificationclick ─────────────────────────────────────────────────────
 * Focus an existing tab of ours and navigate it to the URL; open one when
 * there is none. Closes the notification either way.
 */

const CACHE = "fq-shell-v1";
const CONFIG_URL = "/__fq/offline-config";

// Screens the crew opens in the field. Prefix match on the pathname.
const SHELL_PATHS = [
  "/app/invoices/new",
  "/app/jobs/",
  "/app/clock",
  "/app/settings/team/timesheets",
  "/app/daily-sheets",
];
// The reads those screens make on open. Prefix match; GET only.
const API_PATHS = [
  "/api/clients",
  "/api/settings/business-info",
  "/api/time-clock",
  "/api/invoices/labour-line",
  "/api/jobs/",
  "/api/daily-sheets",
  "/api/offline/status",
  "/api/settings/custom-fields",
];

let enabledMemo = null;

async function readEnabled() {
  if (enabledMemo !== null) return enabledMemo;
  try {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(CONFIG_URL);
    if (!hit) {
      enabledMemo = false;
      return false;
    }
    const data = await hit.json();
    enabledMemo = data && data.enabled === true;
  } catch {
    enabledMemo = false;
  }
  return enabledMemo;
}

async function writeEnabled(enabled) {
  enabledMemo = enabled === true;
  const cache = await caches.open(CACHE);
  if (!enabledMemo) {
    // Off means off: drop everything stored, keep only the flag.
    const keys = await cache.keys();
    await Promise.all(keys.map((k) => cache.delete(k)));
  }
  await cache.put(
    CONFIG_URL,
    new Response(JSON.stringify({ enabled: enabledMemo }), { headers: { "Content-Type": "application/json" } }),
  );
}

function startsWithAny(pathname, list) {
  return list.some((p) => pathname === p || pathname.startsWith(p));
}

function cacheable(res) {
  return res && res.status === 200 && res.type !== "opaque";
}

function markOffline(res) {
  const headers = new Headers(res.headers);
  headers.set("X-FQ-Cache", "offline");
  return res.blob().then((body) => new Response(body, { status: res.status, statusText: res.statusText, headers }));
}

const OFFLINE_PAGE =
  "<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width'>" +
  "<title>Offline</title><body style='font-family:system-ui;padding:24px;background:#f6f8fb;color:#0b1a2e'>" +
  "<h1 style='font-size:18px'>No signal</h1><p>This screen was not opened while you had signal, so it is not on this phone yet. " +
  "The invoice editor, the time clock and job pages you have visited are.</p>" +
  "<p><a href='/app/clock'>Time clock</a> · <a href='/app/invoices/new'>New invoice</a></p></body>";

async function networkFirst(request, { navigation }) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(request);
    if (cacheable(res)) cache.put(request, res.clone()).catch(() => {});
    return res;
  } catch (err) {
    const hit = await cache.match(request, { ignoreVary: true });
    if (hit) return navigation ? hit : markOffline(hit);
    if (navigation) {
      // The page itself was never cached: a plain sentence beats a browser
      // error page with a dinosaur, and it links to the screens that are.
      const shell = await cache.match("/app/clock");
      if (shell) return shell;
      return new Response(OFFLINE_PAGE, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } });
    }
    throw err;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (cacheable(res)) cache.put(request, res.clone()).catch(() => {});
  return res;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;

  const path = url.pathname;
  const isStatic = path.startsWith("/_next/static/");
  const isNav = request.mode === "navigate" || request.headers.get("RSC") === "1";
  const isShell = isNav && startsWithAny(path, SHELL_PATHS);
  const isApi = !isNav && startsWithAny(path, API_PATHS);
  if (!isStatic && !isShell && !isApi) return;

  event.respondWith(
    (async () => {
      if (!(await readEnabled())) return fetch(request);
      if (isStatic) return cacheFirst(request);
      return networkFirst(request, { navigation: isShell });
    })(),
  );
});

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "fq:offline-config") {
    event.waitUntil(writeEnabled(data.enabled === true));
  }
});

// Chrome's Background Sync: fires when connectivity returns, tab or no tab.
// Wake the tabs; they own the queue. See the header.
self.addEventListener("sync", (event) => {
  if (event.tag !== "fq-offline-queue") return;
  event.waitUntil(
    (async () => {
      const tabs = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const tab of tabs) tab.postMessage({ type: "fq:sync" });
    })(),
  );
});

self.addEventListener("install", () => {
  // Take over from an older copy at once; the cache warms on use.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Older cache versions, if the name ever changes.
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n.startsWith("fq-shell-") && n !== CACHE).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

function parsePayload(event) {
  try {
    const data = event.data ? event.data.json() : null;
    if (data && typeof data.title === "string" && data.title) return data;
  } catch {
    /* not JSON — fall through */
  }
  const text = event.data ? event.data.text() : "";
  return { title: text || "FieldQuo", body: "", tag: undefined, url: "/" };
}

self.addEventListener("push", (event) => {
  const payload = parsePayload(event);
  event.waitUntil(
    (async () => {
      const tabs = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const visible = tabs.find((c) => c.visibilityState === "visible");
      if (visible) {
        visible.postMessage({ type: "fq:push", payload });
        return;
      }
      await self.registration.showNotification(payload.title, {
        body: payload.body || "",
        tag: payload.tag || undefined,
        icon: "/icon.png",
        badge: "/icon.png",
        data: { url: payload.url || "/" },
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  const target = new URL(url, self.location.origin).href;
  event.waitUntil(
    (async () => {
      const tabs = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      // Prefer a tab already on our origin: focus it and send it to the URL.
      const ours = tabs.find((c) => c.url.startsWith(self.location.origin));
      if (ours) {
        try {
          await ours.focus();
        } catch {
          /* focus can be refused; navigate anyway */
        }
        if ("navigate" in ours) {
          try {
            await ours.navigate(target);
            return;
          } catch {
            /* cross-origin or refused — open a new one below */
          }
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});
