// lib/clientErrors.js
//
// One place for "the request failed and the user needs to know".
//
// The problem this solves: 37 handlers across the app were written as
//
//     if (res.ok) { ...update the UI... }
//
// with no else. When the request failed, the button did nothing — no message,
// no spinner change, nothing. That is the worst failure mode a UI has, because
// the user can't tell a broken feature from their own mistake, and there's
// nothing to report to support.
//
// The obvious fix — add `error` state and a banner to all 20 files — means
// touching JSX in every one of them, which is a lot of surface for a
// mechanical change. Instead the message goes to a single toast mounted once
// in the app layout. Each call site then needs one line and no markup.
//
// Pages that already have their own inline error UI keep it. This is for the
// ones that had nothing.

const EVENT = "fieldquo:error";

/** Shows a message. Safe to call from anywhere client-side. */
export function showError(message) {
  if (typeof window === "undefined" || !message) return;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { message } }));
}

export const ERROR_EVENT = EVENT;

/**
 * Reports a failed Response.
 *
 * Reads the API's own `error` field when there is one, since those messages
 * are written for the person reading them ("Only owners can connect Stripe"
 * beats "Request failed (403)").
 *
 * Guards the body read: several call sites already did `await res.json()`
 * before checking `res.ok`, and a second read on a consumed body throws. In
 * that case we still have the status, which is enough to say something true.
 */
export async function reportResponseError(res, fallbackOrSetter, maybeFallback) {
  // ── Why this accepts two shapes ──────────────────────────────────────────
  //
  // Eleven call sites were written as
  //
  //     reportResponseError(res, setError, t("app.leads.loadError"))
  //
  // against a two-parameter signature. The setter landed in the `fallback`
  // slot and the real message was dropped on the floor. Two things followed,
  // both of them invisible in review:
  //
  //   1. The page's own inline `{error && <banner/>}` was never populated, so
  //      the markup was dead — that is the "failed completely silently" case
  //      QA saw.
  //   2. When the API sent no `error` field, `showError` was handed a React
  //      state setter as the message.
  //
  // Rejecting the three-argument form would have been defensible, but the
  // shape those call sites reached for is genuinely the useful one: put the
  // sentence in the page's own error state AND toast it. So it is supported
  // and documented rather than "fixed" into eleven near-identical two-line
  // dances that would drift apart again.
  //
  // A function is never a valid fallback message, so the discrimination is
  // unambiguous and the two-argument callers are untouched.
  const setter =
    typeof fallbackOrSetter === "function" ? fallbackOrSetter : null;
  const fallback = setter ? maybeFallback : fallbackOrSetter;

  let message = null;

  try {
    const data = await res.clone().json();
    message = data?.error || data?.message || null;
  } catch {
    /* body already consumed, empty, or not JSON */
  }

  // The API's own `error` is written for the person reading it in most cases
  // ("Only owners can connect Stripe"), but the auth middleware emits bare
  // protocol words — "Unauthorized", "Forbidden" — which are not copy for a
  // contractor in a driveway. Those get the mapped sentence instead, and the
  // raw value still goes to the console for whoever can fix it.
  if (message && PROTOCOL_WORDS.has(message.trim().toLowerCase())) {
    // eslint-disable-next-line no-console
    console.error(`[api] ${res.url || ""} ${res.status}: ${message}`);
    message = null;
  }

  const shown = message || fallback || statusMessage(res.status);
  showError(shown);
  if (setter) setter(shown);
  return shown;
}

// Bare HTTP reason phrases that some routes return as their `error` field.
// Anything in here is replaced by statusMessage() before it reaches a user.
const PROTOCOL_WORDS = new Set([
  "unauthorized",
  "unauthorised",
  "forbidden",
  "not found",
  "bad request",
  "internal server error",
  "conflict",
  "too many requests",
  "unprocessable entity",
]);

export function statusMessage(status) {
  if (status === 401) return "Your session has expired. Sign in again.";
  if (status === 403) return "You don't have permission to do that.";
  if (status === 404) return "That doesn't exist, or you can't see it.";
  if (status === 409) return "That conflicts with something already saved.";
  if (status === 429) return "Too many attempts. Wait a moment and retry.";
  if (status >= 500) {
    return `Something went wrong on our end (error ${status}). If it keeps happening, tell support what you were doing.`;
  }
  return `Request failed (${status}).`;
}
