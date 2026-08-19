// lib/loadState.js
//
// One rule, in one place: when a list fails to load, the user is told it
// failed — and is NOT also shown an empty state or a count.
//
// ── The bug this exists to prevent ─────────────────────────────────────────
//
// /app/clients with GET /api/clients returning 401 rendered, all at once:
//
//     "0 clients total."
//     "Couldn't load clients."           (red banner)
//     "No clients yet / Add your first client"   (large empty panel)
//
// Two of those three are false. The app did not know how many clients exist —
// it was refused. A contractor with 400 clients hitting a transient 401 was
// told their list was empty and invited to start re-entering it. The empty
// state is the loudest element on the screen and the one people believe; the
// red banner reads as a dismissible nag.
//
// The root cause is a state shape, not a rendering mistake. Every one of these
// pages started its list at `useState([])`. An empty array is a CLAIM — "there
// are zero of these" — and the pages made that claim before the server had
// said anything. `null` is the honest initial value: not known yet.
//
//   useState(null)  ->  null = unknown, [] = the server said zero
//
// Once the state can express "unknown", the three render branches become
// mutually exclusive by construction rather than by careful ordering, and
// `items.length` simply cannot produce a fabricated 0.
//
// ── Why the message is mapped here and not at the call site ────────────────
//
// The same 401 was being surfaced three different ways on one page load: one
// component had decent fallback copy, one printed the API's raw
// {"error":"Unauthorized"} straight into the banner, and one failed silently.
// "Unauthorized" is a protocol word, not a sentence for a painter in a
// driveway. Mapping happens once, at the boundary, so there is one answer.
//
// The real detail — url, status, body — goes to the console, which is where
// the person who can actually fix it looks. That split (human sentence on
// screen, machine detail in the console) is the pattern lib/clientErrors.js
// already established.

/**
 * i18n keys for each failure class. Keys rather than sentences because this
 * module is React-free and has no `t` — the caller translates. English copy
 * for each lives in app/i18n/appMessages.js under the same key.
 */
export const LOAD_ERROR_KEYS = {
  unauthorized: "app.load.unauthorized",
  forbidden: "app.load.forbidden",
  notFound: "app.load.notFound",
  rateLimited: "app.load.rateLimited",
  server: "app.load.server",
  network: "app.load.network",
  generic: "app.load.generic",
};

/**
 * HTTP status -> the key for a sentence a contractor can act on.
 *
 * 404 is deliberately NOT "that doesn't exist" here. On a LIST endpoint a 404
 * means the route is wrong or the tenant lookup failed, never "you have no
 * clients" — telling the user their data is gone would be the same lie this
 * module exists to stop.
 */
export function loadErrorKey(status) {
  const code = Number(status);
  if (code === 401) return LOAD_ERROR_KEYS.unauthorized;
  if (code === 403) return LOAD_ERROR_KEYS.forbidden;
  if (code === 404) return LOAD_ERROR_KEYS.notFound;
  if (code === 429) return LOAD_ERROR_KEYS.rateLimited;
  if (code >= 500) return LOAD_ERROR_KEYS.server;
  if (code >= 400) return LOAD_ERROR_KEYS.generic;
  return LOAD_ERROR_KEYS.generic;
}

/**
 * Logs what actually went wrong, for whoever can fix it.
 *
 * Kept separate from the on-screen message on purpose: the console gets the
 * url, the status and the raw body; the user gets a sentence. Neither one
 * should be asked to do the other's job.
 */
export function logLoadFailure(url, detail) {
  // eslint-disable-next-line no-console
  console.error(`[load] ${url}`, detail);
}

/**
 * GET a list endpoint. Never throws, never returns both data and an error.
 *
 * @returns {{ok: true, data: any}} on success
 * @returns {{ok: false, errorKey: string, status: number|null}} on failure
 *
 * The asymmetry is the point. On failure there is no `data` field at all, so
 * a caller cannot accidentally write `[]` into state and manufacture a count.
 * The success shape always carries `data`, even when it is an empty array —
 * that empty array is a real answer from the server and the empty state is
 * correct to show.
 */
export async function fetchList(url, options) {
  let res;
  try {
    res = await fetch(url, options);
  } catch (networkError) {
    // An aborted request is a component unmounting or a filter changing, not
    // a failure the user should be told about. Callers drop `aborted`.
    if (networkError?.name === "AbortError") {
      return { ok: false, aborted: true, errorKey: "", status: null };
    }
    logLoadFailure(url, networkError);
    return { ok: false, errorKey: LOAD_ERROR_KEYS.network, status: null };
  }

  const text = await res.text().catch(() => "");

  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      // Not JSON. On an error status this is Next's HTML error page; on a
      // success status it is a bug worth naming rather than swallowing into
      // an empty list.
      logLoadFailure(url, { status: res.status, body: text.slice(0, 500) });
      return {
        ok: false,
        errorKey: res.ok ? LOAD_ERROR_KEYS.server : loadErrorKey(res.status),
        status: res.status,
      };
    }
  }

  if (!res.ok) {
    logLoadFailure(url, { status: res.status, body: data });
    return { ok: false, errorKey: loadErrorKey(res.status), status: res.status };
  }

  return { ok: true, data };
}

/**
 * Convenience for the common case: a list endpoint that returns an array.
 *
 * Coerces a success body to an array so a malformed-but-200 response becomes
 * an empty list rather than a crash — but only on `ok`, so this can never
 * turn a failure into a fabricated zero.
 */
export async function fetchArray(url, options) {
  const result = await fetchList(url, options);
  if (!result.ok) return result;
  return { ok: true, data: Array.isArray(result.data) ? result.data : [] };
}
