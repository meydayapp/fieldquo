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
 * fetch + parse, with errors a human can act on.
 *
 * @returns the parsed JSON body
 * @throws  Error with a readable .message and a numeric .status
 */
export async function fetchJson(url, options) {
  let res;
  try {
    res = await fetch(url, options);
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
