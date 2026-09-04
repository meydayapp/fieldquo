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
        err.body = text;
        throw err;
      }
      const err = new Error(
        `The server sent something unexpected back from ${url}.`,
      );
      err.status = res.status;
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
    throw err;
  }

  return data;
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
