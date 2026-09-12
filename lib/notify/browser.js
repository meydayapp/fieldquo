// lib/notify/browser.js
//
// Browser notifications, the in-tab half. The owner: "is there a way to
// allow browser notifications onto the user's computer".
//
// ══ Two halves, and which this is ══════════════════════════════════════════
//
//   in-tab   (this file)  The page itself notices something — a poll saw a
//                         new unread, the Voice SDK rang — and calls notify().
//                         With the tab FOCUSED that is a toast; with the tab
//                         in the background it is a system notification
//                         through the Notification API, which the person has
//                         to have allowed. Nothing arrives once the tab is
//                         closed.
//   push     (lib/notify/push.js + public/sw.js)  The server sends the same
//                         events to a service worker, which shows them with
//                         the tab closed. Needs VAPID keys on the deployment;
//                         feature-detected end to end.
//
// ══ Opt-in is per person AND per browser ═══════════════════════════════════
//
// `Notification.permission` is the browser's answer for this origin — it is
// shared by every account that signs in on this machine, and it is never
// "on" for a person who did not ask. So the switch in Settings writes a
// second flag, NOTIFY_PREF_KEY in localStorage, and notify() requires BOTH:
// the browser allowed it, and this person turned it on here. The server
// keeps the push subscription (the switch's other write); this flag is the
// only client-side state, and losing it — private window, cleared site data
// — fails to "off", which is the safe direction.
//
// ══ Why the system notification goes through the service worker when one
//    is registered ═════════════════════════════════════════════════════════
//
// `new Notification()` throws on Android Chrome, which only allows
// notifications from a service worker. When push has been set up there IS
// one registered, so notify() hands the notification to it; its
// notificationclick handler focuses the tab and opens the URL. Without a
// worker (no VAPID keys, or the person never enabled push) the constructor
// path is used and the click handler here does the same two things.
//
// No React here. Pure functions over window/document/Notification, so any
// handler can call it and a check script can execute it against a stub.

import { showToast } from "@/lib/toast";

export const NOTIFY_PREF_KEY = "fq-browser-notifications";

/** The icon a system notification shows. The product's, not the tenant's:
 *  this is a staff surface, never a homeowner-facing one. */
export const NOTIFICATION_ICON = "/icon.png";

/** True when this browser has the Notification API at all. */
export function supported() {
  return typeof window !== "undefined" && "Notification" in window;
}

/** "unsupported" | "default" | "granted" | "denied" */
export function permissionState() {
  if (!supported()) return "unsupported";
  return window.Notification.permission;
}

/** Whether THIS person turned notifications on in THIS browser. */
export function enabledHere() {
  try {
    return window.localStorage.getItem(NOTIFY_PREF_KEY) === "1";
  } catch {
    return false;
  }
}

export function setEnabledHere(on) {
  try {
    if (on) window.localStorage.setItem(NOTIFY_PREF_KEY, "1");
    else window.localStorage.removeItem(NOTIFY_PREF_KEY);
  } catch {
    /* private mode: the switch still governs this tab through the server row */
  }
}

/**
 * Ask the browser. Resolves to the permission state afterwards. Must be
 * called from a user gesture — browsers ignore a prompt that was not.
 */
export async function requestPermission() {
  if (!supported()) return "unsupported";
  try {
    // Older Safari takes a callback and returns undefined; awaiting either
    // shape and re-reading `permission` is right for both.
    await new Promise((resolve) => {
      const maybe = window.Notification.requestPermission(resolve);
      if (maybe && typeof maybe.then === "function") maybe.then(resolve, resolve);
    });
  } catch {
    /* fall through to the re-read */
  }
  return permissionState();
}

/** Is this tab the thing the person is looking at right now? */
export function tabFocused(doc = typeof document !== "undefined" ? document : null) {
  if (!doc) return false;
  if (doc.hidden) return false;
  return typeof doc.hasFocus === "function" ? doc.hasFocus() : true;
}

/** Can a system notification be shown from here, right now? */
export function canNotifySystem() {
  return permissionState() === "granted" && enabledHere();
}

/**
 * Tell the person something.
 *
 *   notify({ title: "New text", body: "+1 555 010 2030: Yes, tomorrow works", tag: "sms:abc", url: "/sales/messages?with=…" });
 *
 * Focused tab → a toast (the shared layer), because a system notification
 * for the screen they are already looking at is noise. Background tab with
 * permission → a system notification; clicking it focuses the tab and opens
 * `url`. Background tab without permission → the toast anyway, so it is
 * there when they come back.
 *
 * `tag` collapses duplicates on both paths: the toast layer replaces a toast
 * with the same tag, and the OS replaces a notification with the same tag —
 * which is what lets the service worker's push and this poll announce the
 * same message once.
 *
 * Returns which path was taken: "toast" | "system" | "none".
 */
export function notify({ title, body = "", tag = null, url = null, tone = "info", quietWhenFocused = false } = {}) {
  if (typeof window === "undefined" || !title) return "none";

  // `quietWhenFocused`: the caller already draws its own notice on the
  // screen (the incoming-call drawer), so a toast beside it would say the
  // same thing twice. The background-tab path is unchanged.
  if (quietWhenFocused && tabFocused()) return "none";

  if (tabFocused() || !canNotifySystem()) {
    showToast({ message: body ? `${title} — ${body}` : title, tone, href: url, tag });
    return "toast";
  }

  const options = { body, tag: tag || undefined, icon: NOTIFICATION_ICON, data: { url } };
  const sw = typeof navigator !== "undefined" ? navigator.serviceWorker : null;
  if (sw && typeof sw.getRegistration === "function") {
    sw.getRegistration()
      .then((reg) => {
        if (reg && typeof reg.showNotification === "function") return reg.showNotification(title, options);
        return showDirect(title, options, url);
      })
      .catch(() => showDirect(title, options, url));
  } else {
    showDirect(title, options, url);
  }
  return "system";
}

function showDirect(title, options, url) {
  try {
    const n = new window.Notification(title, options);
    n.onclick = () => {
      try {
        window.focus();
      } catch {
        /* some browsers refuse focus() outside a gesture */
      }
      if (url) window.location.assign(url);
      n.close();
    };
    return n;
  } catch {
    // Android Chrome and the like: no constructor path. The toast is the
    // fallback; the person sees it when they return.
    showToast({ message: options.body ? `${title} — ${options.body}` : title, href: url, tag: options.tag || null });
    return null;
  }
}
