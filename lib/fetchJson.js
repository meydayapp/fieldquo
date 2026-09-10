// lib/fetchJson.js
//
// The pattern this replaces, which is everywhere in this codebase:
//
//     const res = await fetch(url);
//     const data = await res.json();          // <-- explodes on a 500
//     if (!res.ok) throw new Error(data.error);
//
// When a route throws, Next returns an HTML error page. `res.json()` then
// fails while parsing it, and the message the user sees is whatever their
// browser's JSON parser says. In Safari that's "The string did not match the
// expected pattern" — which sent us looking at regexes and form validation
// when the real problem was an unset environment variable.
//
// Reading the body as text first means we always have something to report:
// the API's own error message when there is one, the HTTP status when there
// isn't, and never the parser's complaint.

/**
 * Bodies that `fetch` already knows how to send. Anything else that is a plain
 * object or an array is ours to serialise.
 *
 * Checked by shape rather than by constructor name so this keeps working under
 * a polyfill, and guarded for the server where several of these globals do not
 * exist at all.
 */
function isNativeBody(body) {
  if (typeof body === "string") return true;
  if (typeof FormData !== "undefined" && body instanceof FormData) return true;
  if (typeof Blob !== "undefined" && body instanceof Blob) return true;
  if (typeof URLSearchParams !== "undefined" && body instanceof URLSearchParams)
    return true;
  if (typeof ArrayBuffer !== "undefined" && body instanceof ArrayBuffer)
    return true;
  if (typeof ArrayBuffer !== "undefined" && ArrayBuffer.isView(body))
    return true;
  if (typeof ReadableStream !== "undefined" && body instanceof ReadableStream)
    return true;
  return false;
}

/**
 * Serialise a plain-object `body`, and say so in the headers.
 *
 * ── Why this is here and not at the call sites ─────────────────────────────
 *
 * `fetch` does not serialise. Given an object it calls String() on it, so the
 * request goes out as the nine literal characters `[object Object]` with
 * `Content-Type: text/plain`. Every route in this repo then does
 * `await request.json().catch(() => ({}))` and validates an empty object — so
 * the failure never looks like a transport bug. It looks like the server
 * disagreeing with you: "A playbook needs a key" while the key is on screen,
 * "Nothing to change" on a switch you just flipped, "a prospectId is required"
 * with a prospect plainly selected.
 *
 * Six controls on /platform/sales/playbooks were dead this way, and the reason
 * nobody caught it is that 230-odd other call sites hand-write
 * `JSON.stringify` plus the header, so the two spellings look equally correct
 * side by side. Making the helper do it is what stops the tenth call site
 * getting it wrong; the ones that already stringify pass a string and are
 * untouched.
 *
 * An explicit Content-Type always wins — a caller sending JSON under some other
 * media type knows something this function doesn't.
 */
function withJsonBody(options) {
  if (!options || !("body" in options)) return options;
  const { body } = options;
  if (body === null || body === undefined || isNativeBody(body)) return options;
  if (typeof body !== "object") return options;

  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  return { ...options, headers, body: JSON.stringify(body) };
}

/**
 * fetch + parse, with errors a human can act on.
 *
 * A plain-object `body` is serialised for you; see withJsonBody.
 *
 * @returns the parsed JSON body
 * @throws  Error with a readable .message and a numeric .status
 */
export async function fetchJson(url, options) {
  let res;
  try {
    res = await fetch(url, withJsonBody(options));
  } catch (networkError) {
    const err = new Error(
      "Couldn't reach the server. Check your connection and try again.",
    );
    err.cause = networkError;
    // See FETCH_ERROR_KEYS below: the sentence stays and a key rides beside
    // it, so a screen can say the same thing in the reader's own language.
    err.i18nKey = FETCH_ERROR_KEYS.network;
    throw err;
  }

  const text = await res.text();

  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      // Body isn't JSON. On an error status that's an HTML error page; on a
      // success status it's a bug worth naming rather than swallowing.
      if (!res.ok) {
        const err = new Error(serverErrorMessage(res.status));
        err.status = res.status;
        err.i18nKey = statusKey(res.status);
        err.body = text;
        throw err;
      }
      const err = new Error(
        `The server sent something unexpected back from ${url}.`,
      );
      err.status = res.status;
      err.i18nKey = FETCH_ERROR_KEYS.unexpectedBody;
      err.body = text;
      throw err;
    }
  }

  if (!res.ok) {
    const err = new Error(
      data?.error || data?.message || serverErrorMessage(res.status),
    );
    err.status = res.status;
    err.data = data;
    // The ROUTE's own code, when it stamped one. A route that says WHY it
    // refused knows more than an HTTP status does, and a screen that can map
    // the code to a sentence in the reader's language should prefer it — see
    // lib/sales/authRefusals.js, which is the first table to do so.
    err.code = data?.code || null;
    // Only when the message came from this file rather than from the route. A
    // route's own sentence has no catalogue entry here and must not be given
    // one, or a 403 with a specific explanation would be overwritten by the
    // generic "you don't have permission".
    err.i18nKey = data?.error || data?.message ? null : statusKey(res.status);
    throw err;
  }

  return data;
}

// ══ The keys for this file's own fallbacks ═════════════════════════════════
//
// Everything below is a sentence fetchJson composes ITSELF, when the server
// gave it nothing usable: an unreachable network, an HTML error page, a bare
// status. They are the last thing a user reads before giving up, and they were
// English on every screen in the product regardless of the reader's language.
//
// The sentences do not move. This file is imported by server code and by check
// scripts under bare node and cannot hold a translator; and an error thrown
// with no message is worse than one in the wrong language. What is added is
// `err.i18nKey`, which a screen resolves — see errorText() below.
//
// A 4xx or 5xx that the ROUTE explained keeps the route's sentence and gets no
// key. Overwriting a specific explanation with a generic one would be a
// downgrade dressed as a translation.
export const FETCH_ERROR_KEYS = Object.freeze({
  network: "app.fetchError.network",
  unexpectedBody: "app.fetchError.unexpectedBody",
  unauthorised: "app.fetchError.unauthorised",
  forbidden: "app.fetchError.forbidden",
  notFound: "app.fetchError.notFound",
  tooMany: "app.fetchError.tooMany",
  server: "app.fetchError.server",
  failed: "app.fetchError.failed",
});

/** The key matching serverErrorMessage()'s branch for the same status. */
function statusKey(status) {
  if (status === 401) return FETCH_ERROR_KEYS.unauthorised;
  if (status === 403) return FETCH_ERROR_KEYS.forbidden;
  if (status === 404) return FETCH_ERROR_KEYS.notFound;
  if (status === 429) return FETCH_ERROR_KEYS.tooMany;
  if (status >= 500) return FETCH_ERROR_KEYS.server;
  return FETCH_ERROR_KEYS.failed;
}

/**
 * What to SHOW for an error this module threw, in the reader's language.
 *
 * ── The order, and why it is that order ───────────────────────────────────
 *
 *   1. A code the ROUTE stamped, through the table the caller passes in. The
 *      route knows more than a status does — "this invitation was already
 *      used" is not "bad request".
 *   2. This file's own key, when this file composed the sentence.
 *   3. `err.message`. Always present, always true, sometimes English.
 *
 * Takes `t` and the code table as parameters rather than importing either:
 * this module is loaded on the server and under bare node, and a React hook or
 * a catalogue import here would take both of those down. The same shape
 * lib/sales/suppression.js uses for its database client.
 *
 * @param t         a translator, `t(key, fallback, values)`.
 * @param err       what fetchJson threw.
 * @param codeKeys  optional code → key map, e.g. AUTH_REFUSAL_KEYS.
 */
export function errorText(t, err, codeKeys = null) {
  if (!err) return "";
  const message = err.message || "";
  const mapped = err.code && codeKeys ? codeKeys[err.code] : null;
  const key = mapped || err.i18nKey || null;
  if (!key) return message;
  // The values every key in FETCH_ERROR_KEYS may interpolate. Passed always,
  // ignored by the keys that name none of them — cheaper than a table saying
  // which key takes what, and it cannot fall out of step with one.
  return t(key, message, {
    status: err.status ?? "",
    minLength: err.data?.minLength ?? "",
  });
}

function serverErrorMessage(status) {
  if (status === 401) return "Your session has expired. Sign in again.";
  if (status === 403) return "You don't have permission to do that.";
  if (status === 404) return "That doesn't exist, or you can't see it.";
  if (status === 429) return "Too many attempts. Wait a moment and retry.";
  if (status >= 500) {
    return `Something went wrong on our end (error ${status}). If it keeps happening, tell support what you were doing.`;
  }
  return `Request failed (${status}).`;
}
