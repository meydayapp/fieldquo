/* public/sw.js
 *
 * FieldQuo's service worker. It does ONE thing: receive Web Push and show
 * it. No fetch handler, no caching, no offline — a worker that intercepts
 * requests is a second copy of routing that rots, and nothing here needs
 * it. Registered by lib/notify/swClient.js only after a person turns
 * notifications on; never on page load.
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

self.addEventListener("install", () => {
  // Take over from an older copy at once; there is no cache to warm.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
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
