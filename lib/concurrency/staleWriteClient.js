// lib/concurrency/staleWriteClient.js
//
// The browser half of the stale-write guard. See lib/concurrency/staleWrite.js
// for the server half and for why this exists at all.
//
// Deliberately NOT part of lib/clientErrors.js. reportResponseError's whole
// job is to turn a failed Response into one sentence in a toast, and a stale
// write is the one refusal where a sentence is not enough: the user has
// unsaved work on screen, and what they need is a decision — look at what
// changed, or re-apply their version on top of it. A toast that disappears
// after four seconds is the wrong shape for that, so a stale write is detected
// FIRST and never reaches the toast.

import { STALE_WRITE_CODE } from "@/lib/concurrency/staleWrite";

export { STALE_WRITE_CODE };

/**
 * Read a stale-write refusal out of a failed Response.
 *
 * @returns the `conflict` object, or null if this isn't one.
 *
 * Checks the CODE, not the status. This API already answers 409 for "that
 * quote has an invoice", "only draft invoices can be deleted", "the migration
 * was cancelled" — offering "save mine anyway" for any of those would be a
 * button that cannot possibly work.
 *
 * Uses res.clone() because several call sites in this codebase read the body
 * before checking res.ok, and a second read of a consumed body throws — the
 * same trap lib/clientErrors.js documents.
 */
export async function readStaleConflict(res) {
  if (!res || res.ok) return null;
  let data = null;
  try {
    data = await res.clone().json();
  } catch {
    return null; // not JSON, so not one of ours
  }
  if (data?.code !== STALE_WRITE_CODE) return null;
  const conflict = data.conflict;
  if (!conflict || typeof conflict !== "object") return null;
  // The server's English sentence travels with it as a last-resort fallback;
  // the screen composes its own from the fields, in the user's language.
  return { ...conflict, error: data.error || null };
}

/**
 * "2 minutes ago", in `language`.
 *
 * Intl.RelativeTimeFormat rather than six catalogue entries per unit: the
 * browser already has the plural rules and the word order for every language
 * this product offers, and a hand-built "{n} minutes ago" string gets French
 * ("il y a 2 minutes" — the parts are in the other order) wrong the moment
 * anyone interpolates it. Returns null when the timestamp is unusable, so the
 * caller can drop the clause rather than print "Invalid Date".
 */
export function relativeTime(iso, language, now = Date.now()) {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;

  // Negative = in the past, which is what RelativeTimeFormat wants.
  const seconds = Math.round((then - now) / 1000);
  const abs = Math.abs(seconds);

  let value;
  let unit;
  if (abs < 45) {
    value = seconds;
    unit = "second";
  } else if (abs < 3600) {
    value = Math.round(seconds / 60);
    unit = "minute";
  } else if (abs < 86400) {
    value = Math.round(seconds / 3600);
    unit = "hour";
  } else {
    value = Math.round(seconds / 86400);
    unit = "day";
  }

  try {
    return new Intl.RelativeTimeFormat(language || "en", {
      numeric: "auto",
    }).format(value, unit);
  } catch {
    // An unsupported locale tag must not take the banner down with it — the
    // banner is what stops the data loss.
    return null;
  }
}
