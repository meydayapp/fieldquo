// lib/tracking/touches.js
//
// The browser's list of the visits it opened in THIS TAB, so a page of the
// same company opened next can inherit the landing that brought the visitor
// (lib/tracking/visits.js, "First touch across a company's pages").
//
// What is stored, and where: sessionStorage key "fq.touch" on the page's own
// origin, a JSON array of at most TOUCH_MAX visit tokens (32 random
// characters each, issued by /api/funnel-visit). No cookie, no identifier of
// the person, nothing that outlives the tab or crosses to another site —
// sessionStorage is per tab and per origin by construction, which is also
// why the website (<sub>.fieldquo.com) and the booking page it links to on
// the same host share it, and two different hosts never do. A token alone
// reads nothing: the server only uses it to find a visit row of the same
// company.
//
// No imports: the public pages pull this into their client bundles.

const KEY = "fq.touch";
const MAX = 8;
const TOKEN = /^[A-Za-z0-9_-]{32}$/;

/** This tab's visit tokens, oldest first; [] when storage is unavailable. */
export function readTouches() {
  try {
    if (typeof window === "undefined") return [];
    const raw = window.sessionStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((t) => typeof t === "string" && TOKEN.test(t)).slice(-MAX) : [];
  } catch {
    return [];
  }
}

/** Remember a visit token this tab was issued. Oldest kept first; bounded. */
export function rememberTouch(token) {
  try {
    if (typeof window === "undefined" || typeof token !== "string" || !TOKEN.test(token)) return;
    const list = readTouches().filter((t) => t !== token);
    list.push(token);
    // The oldest are the ones that matter (first touch), so trimming keeps
    // the first and drops from the middle.
    const kept = list.length > MAX ? [list[0], ...list.slice(list.length - (MAX - 1))] : list;
    window.sessionStorage.setItem(KEY, JSON.stringify(kept));
  } catch {
    /* private window, blocked storage — the page works without it */
  }
}
