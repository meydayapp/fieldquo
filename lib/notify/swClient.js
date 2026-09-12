// lib/notify/swClient.js
//
// The browser side of Web Push: register public/sw.js, subscribe this
// browser with the deployment's public VAPID key, tell the server, undo it.
//
// Called ONLY from the settings block (app/components/notifications/
// BrowserNotifications.js) in response to the switch — never on page load.
// A worker registered for everybody would be a permission prompt nobody
// asked for on Safari (which prompts at subscribe time) and a background
// process on every phone for a feature most people have not turned on.
//
// Everything is feature-detected: no serviceWorker, no PushManager, no key
// from the server → pushSupported()/subscribePush() say so and do nothing.
// No React here.

export const SW_PATH = "/sw.js";

export function pushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** base64url (what web-push prints) → Uint8Array (what PushManager wants). */
export function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Register (or find) our worker. Resolves to the registration. */
export async function ensureRegistered() {
  if (!pushSupported()) return null;
  const existing = await navigator.serviceWorker.getRegistration(SW_PATH);
  if (existing) return existing;
  return navigator.serviceWorker.register(SW_PATH, { scope: "/" });
}

/** This browser's current subscription, or null. Never registers. */
export async function currentSubscription() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration(SW_PATH);
  if (!reg) return null;
  return reg.pushManager.getSubscription();
}

/**
 * Subscribe this browser and post the subscription to `endpoint` (one of
 * the three mounts of lib/notify/pushSubscriptionRoute.js). Resolves to
 * the PushSubscription. Throws with a readable message on refusal.
 */
export async function subscribePush({ publicKey, endpoint }) {
  if (!pushSupported()) throw new Error("This browser cannot receive push notifications.");
  if (!publicKey) throw new Error("Push notifications are not set up on this deployment.");
  const reg = await ensureRegistered();
  const ready = await navigator.serviceWorker.ready;
  const manager = (ready || reg).pushManager;
  let sub = await manager.getSubscription();
  if (!sub) {
    sub = await manager.subscribe({
      // Chrome requires it; it means "every push shows a notification or
      // reaches a visible tab", which is exactly what public/sw.js does.
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sub.toJSON()),
  });
  if (!res.ok) {
    let message = `Could not save the subscription (${res.status}).`;
    try {
      message = (await res.json())?.error || message;
    } catch {
      /* keep the status sentence */
    }
    throw new Error(message);
  }
  return sub;
}

/** Tell the server to stop, then drop the browser-side subscription. */
export async function unsubscribePush({ endpoint }) {
  let sub = null;
  try {
    sub = await currentSubscription();
  } catch {
    sub = null;
  }
  await fetch(endpoint, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: sub?.endpoint || null }),
  }).catch(() => {});
  if (sub) {
    try {
      await sub.unsubscribe();
    } catch {
      /* the server row is already disabled; the browser's copy expires */
    }
  }
}

/**
 * Hand a push that arrived while a tab was visible to the page.
 * public/sw.js posts { type: "fq:push", payload } instead of showing a
 * system notification; the toast layer listens through this. Returns the
 * unsubscribe function.
 */
export function onPushMessage(handler) {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return () => {};
  const listener = (e) => {
    if (e.data && e.data.type === "fq:push" && e.data.payload) handler(e.data.payload);
  };
  navigator.serviceWorker.addEventListener("message", listener);
  return () => navigator.serviceWorker.removeEventListener("message", listener);
}
