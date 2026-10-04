// lib/impersonation/viewOnly.js
//
// "View as company" (a superadmin's read-only support session) in the
// BROWSER: which requests it may not make, which controls it may not press,
// and which pages it may not open. The rules only — the React half is
// app/providers/ViewOnlyProvider.js.
//
// ══ Why (owner, 2026-10-03) ════════════════════════════════════════════════
//
// The server has refused every write from a support session since the
// session existed (middleware.js, then lib/currentMember.js assertReadOnly,
// deliberately twice). The SCREEN never knew: every Save, Send, Delete and
// switch still drew, and pressing one produced a red 403. Four files asked
// useImpersonation(); the other several hundred write controls were drawn as
// if nothing were different. Editing each of them is the 200-file change the
// owner ruled out, and the 201st control — the one added next month — would
// be the one that forgot.
//
// So the browser gets the SAME rule the server has, at the three seams every
// control goes through, instead of a flag in every control:
//
//   1. the request — window.fetch, XMLHttpRequest and navigator.sendBeacon
//      are wrapped while the session lasts. A request middleware would refuse
//      (isBlockedRequest, below — the server's own list) never leaves the
//      browser; the caller gets the 403 it would have got, marked viewOnly,
//      and the person gets one "View only" note instead of a red error. Every
//      write in /app goes through one of those three (scripts/
//      check-view-only.mjs proves it by scanning every call site), so no
//      control can write, whatever it looks like.
//   2. the control — anything that is a write by its nature (a submit button,
//      a switch, a file picker, an editable region, a form field, or anything
//      marked data-write) is drawn disabled with a "View only" title from the
//      first paint (CSS under [data-view-only] + aria-disabled), and a press
//      on it is stopped before its handler runs. Any OTHER control whose
//      press turns out to be a write is marked the same way the moment the
//      guard stops it — it never sends, and from then on it reads as off.
//   3. the page — the few pages that show the SIGNED-IN PERSON's own data
//      (their hours, their pay, their time off) show a notice instead: in a
//      support session the signed-in person is the company's owner, and
//      their personal pages are not the company (ROADMAP, 28 September).
//
// Pure and import-light: a check executes every function here in node.

import { isReadOnlyMethod, isWriteShapedGet } from "@/lib/platform/readOnlyRequests";

/**
 * Paths middleware lets a support session write to: FieldQuo's own consoles,
 * which its read-only gate excludes by name (middleware.js isStaffSurface) —
 * leaving the session is a DELETE under /api/platform.
 */
export const STAFF_SURFACE_PREFIXES = Object.freeze(["/platform", "/api/platform", "/sales", "/api/sales"]);

function isStaffSurface(pathname) {
  return STAFF_SURFACE_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/") || pathname.startsWith(p + "?"));
}

/**
 * Would middleware refuse this request from a read-only support session?
 * The browser asks the same question so the answer arrives without a round
 * trip and without a red error.
 *
 *   · same origin only — a cross-origin request is not one of ours (an
 *     upload's bytes go to Cloudinary only after OUR sign request, which
 *     this stops first);
 *   · /app and /api only, staff surfaces excluded — middleware's own scope;
 *   · a non-read method, or a GET on the list of GETs that act.
 *
 * An unparseable URL is not refused here (fetch would throw on it anyway).
 */
export function isBlockedRequest({ url, method = "GET", origin }) {
  let u;
  try {
    u = new URL(String(url), origin);
  } catch {
    return false;
  }
  if (origin && u.origin !== new URL(origin).origin) return false;
  const p = u.pathname;
  if (isStaffSurface(p)) return false;
  if (!(p === "/app" || p.startsWith("/app/") || p === "/api" || p.startsWith("/api/"))) return false;
  return !isReadOnlyMethod(method) || isWriteShapedGet(p);
}

/** The body the guard answers a refused request with — middleware's shape, plus viewOnly. */
export const VIEW_ONLY_REFUSAL = Object.freeze({
  error:
    "You're viewing this account read-only. Support access can't change a customer's data — talk them through the change, or ask them to make it.",
  readOnly: true,
  viewOnly: true,
});

/**
 * Controls that are writes by their nature, inside the page (`main`) — never
 * the shell's navigation, search or session controls. Each was checked
 * against /app before it went on this list: no search form in /app submits
 * (a search is an onChange filter), and every role="switch" is a setting.
 * `data-write` is the explicit marker any component can add.
 */
export const WRITE_CONTROL_SELECTOR = [
  'button[type="submit"]',
  'input[type="submit"]',
  'input[type="file"]',
  '[role="switch"]',
  '[contenteditable="true"]',
  "[data-write]",
  "form input:not([type=\"hidden\"])",
  "form textarea",
  "form select",
].join(", ");

/** Set on a control the guard stopped mid-press (it is a write after all). */
export const BLOCKED_ATTR = "data-view-only-blocked";

/** The toast's dedupe tag — one note, however many controls are pressed. */
export const VIEW_ONLY_TOAST_TAG = "view-only";

/** How long after a click/submit/keypress a refused request counts as its result. */
export const GESTURE_WINDOW_MS = 2000;

// ── Personal pages ──────────────────────────────────────────────────────────
//
// The "my" endpoints answer for the SIGNED-IN person. In a support session
// that is the company's owner (lib/currentMember.js borrows the owner's
// membership so company reads work), so these pages would show the owner's
// own hours, pay and time off to whoever is auditing. Owner decision
// (ROADMAP "View as company reads everything", 28 Sep → 2026-10-03): show a
// notice instead. Keyed by page, each with the endpoint that makes it
// personal, so the check can hold the list to the API.
export const PERSONAL_PAGES = Object.freeze([
  { prefix: "/app/me/availability", endpoint: "/api/availability", what: "availability" },
  { prefix: "/app/settings/availability", endpoint: "/api/availability", what: "availability" },
  { prefix: "/app/me/earnings", endpoint: "/api/me/earnings", what: "earnings" },
  { prefix: "/app/me/more", endpoint: "/api/me/home", what: "home" },
  { prefix: "/app/time-off", endpoint: "/api/leave", what: "leave" },
]);

/** The personal page this path is, or null. Exact prefix match on a path segment. */
export function personalPageFor(pathname) {
  const p = String(pathname || "").split(/[?#]/)[0].replace(/\/+$/, "");
  return PERSONAL_PAGES.find((pg) => p === pg.prefix || p.startsWith(pg.prefix + "/")) || null;
}

// ── The request seam ────────────────────────────────────────────────────────

function requestParts(input, init) {
  // fetch(Request) carries its own method; init.method wins when both exist,
  // which is fetch's own rule.
  const isRequest = input && typeof input === "object" && typeof input.url === "string";
  const url = isRequest ? input.url : String(input);
  const method = (init && init.method) || (isRequest ? input.method : null) || "GET";
  return { url, method: String(method).toUpperCase() };
}

/**
 * Wrap the window's three ways out. Returns the function that unwraps them.
 *
 * @param win        the window (a fake in the check)
 * @param onBlocked  called with { url, method } for every refused request
 */
export function installViewOnlyGuard(win, { onBlocked = () => {} } = {}) {
  const origin = win.location?.origin;
  const restore = [];

  if (typeof win.fetch === "function") {
    const original = win.fetch;
    const guarded = function viewOnlyFetch(input, init) {
      const req = requestParts(input, init);
      if (isBlockedRequest({ ...req, origin })) {
        onBlocked(req);
        const Res = win.Response || globalThis.Response;
        return Promise.resolve(
          new Res(JSON.stringify(VIEW_ONLY_REFUSAL), { status: 403, headers: { "Content-Type": "application/json" } }),
        );
      }
      return original.call(this, input, init);
    };
    win.fetch = guarded;
    restore.push(() => {
      if (win.fetch === guarded) win.fetch = original;
    });
  }

  const XHR = win.XMLHttpRequest;
  if (XHR && XHR.prototype) {
    const { open, send } = XHR.prototype;
    XHR.prototype.open = function viewOnlyOpen(method, url, ...rest) {
      this.__viewOnly = { method: String(method || "GET").toUpperCase(), url: String(url) };
      return open.call(this, method, url, ...rest);
    };
    XHR.prototype.send = function viewOnlySend(body) {
      const req = this.__viewOnly;
      if (req && isBlockedRequest({ ...req, origin })) {
        onBlocked(req);
        // Never sent. The caller sees a network error, the same thing it
        // would see offline — no XHR in /app writes to our own origin today
        // (uploads go to Cloudinary), so this is the belt, not the braces.
        const fire = () => {
          try {
            this.dispatchEvent?.(new (win.Event || globalThis.Event)("error"));
          } catch {
            /* a fake XHR without events */
          }
        };
        setTimeout(fire, 0);
        return undefined;
      }
      return send.call(this, body);
    };
    restore.push(() => {
      XHR.prototype.open = open;
      XHR.prototype.send = send;
    });
  }

  const nav = win.navigator;
  if (nav && typeof nav.sendBeacon === "function") {
    const original = nav.sendBeacon;
    const guarded = function viewOnlyBeacon(url, data) {
      if (isBlockedRequest({ url, method: "POST", origin })) {
        onBlocked({ url: String(url), method: "POST" });
        return false; // "not queued" — sendBeacon's own way of saying no
      }
      return original.call(nav, url, data);
    };
    try {
      nav.sendBeacon = guarded;
      restore.push(() => {
        if (nav.sendBeacon === guarded) nav.sendBeacon = original;
      });
    } catch {
      /* a read-only navigator property — fetch and XHR still cover it */
    }
  }

  return function uninstallViewOnlyGuard() {
    for (const fn of restore.reverse()) fn();
  };
}
