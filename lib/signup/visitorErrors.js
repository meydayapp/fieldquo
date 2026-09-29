// lib/signup/visitorErrors.js
//
// What a stranger on /signup or a welcome screen reads when a request fails.
//
// The owner, testing a preview on 2026-09-29, pressed "Start my free trial"
// and read Safari's own "Load failed" — the raw TypeError message a failed
// fetch carries, printed straight into the page. On a screen whose whole job
// is to earn trust, an engine's English error string is the worst possible
// sentence. So nothing here ever returns an Error's own message:
//
//   · the network never answered (a TypeError from fetch — "Load failed",
//     "Failed to fetch", "NetworkError…" — or fetchJson's network error, or
//     Better Auth reporting a request with no HTTP status)   → UNREACHABLE
//   · the server answered with an error page (5xx, or a body that is not
//     JSON)                                                   → SERVER
//   · anything else the caller has no specific sentence for → the caller's
//     own translated fallback
//
// Every answer is a catalogue key plus its English, and every one of them
// comes with `retry: true` for the first two — the screen offers the press
// again rather than a dead end. Pure, so scripts/check-welcome-flow.mjs runs
// it against the strings browsers actually throw.

export const VISITOR_ERROR = Object.freeze({
  unreachable: Object.freeze({
    key: "app.signup.error.unreachable",
    text: "We couldn't reach FieldQuo — check your connection and try again.",
  }),
  server: Object.freeze({
    key: "app.signup.error.serverTrouble",
    text: "Something went wrong on our side — please try again in a moment.",
  }),
});

const NETWORK_MESSAGE = /load failed|failed to fetch|networkerror|network request failed|network error|the internet connection appears to be offline|fetch failed/i;

/** Did the request never get an HTTP answer? */
export function isNetworkFailure(err) {
  if (!err) return false;
  if (err.i18nKey === "app.fetchError.network") return true;
  if (err.name === "TypeError") return true;
  if (err.name === "AbortError") return true;
  const status = err.status ?? err.statusCode;
  const message = typeof err.message === "string" ? err.message : "";
  // Better Auth's client resolves with { error: { status: 0 | undefined, message } }
  // when the fetch itself failed.
  if ((status === 0 || status === undefined || status === null) && NETWORK_MESSAGE.test(message)) return true;
  return NETWORK_MESSAGE.test(message) && !status;
}

/**
 * The sentence to show, as { key, text, retry }.
 *
 * @param err       a thrown error, or Better Auth's `result.error`, or null
 * @param status    an HTTP status when the caller has one (res.status)
 * @param jsonOk    false when the body could not be parsed as JSON
 * @param fallback  { key, text } — the caller's own sentence for everything else
 */
export function visitorError({ err = null, status = null, jsonOk = true, fallback } = {}) {
  if (isNetworkFailure(err) || status === 0) return { ...VISITOR_ERROR.unreachable, retry: true };
  const s = Number(status ?? err?.status ?? err?.statusCode);
  if ((Number.isFinite(s) && s >= 500) || jsonOk === false) return { ...VISITOR_ERROR.server, retry: true };
  const fb = fallback && typeof fallback === "object" ? fallback : VISITOR_ERROR.server;
  return { key: fb.key, text: fb.text, retry: true };
}
