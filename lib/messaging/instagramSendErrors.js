// lib/messaging/instagramSendErrors.js
//
// Instagram's "(#3) Application does not have the capability to make this API
// call", named — and, where FieldQuo can know it, WHICH permission is missing.
//
// ══ The incident ═══════════════════════════════════════════════════════════
//
// 2026-09-28: every Instagram reply from Messages failed with
// "meta_unknown_error: (#3) Application does not have the capability to make
// this API call." while Facebook replies on the same connection went through.
//
// Two causes are on the table, and this file serves both:
//
//   1. OUR send path. Replies were POSTed to graph.facebook.com/<instagram
//      account id>/messages — the Instagram-Login API's path — with the PAGE
//      token that belongs to the Messenger Platform's Instagram API, whose
//      documented path is /PAGE-ID/messages or /me/messages. Fixed in
//      metaSend.js's sendPath, with the citations there.
//
//   2. The connection's permissions. Production connects through Facebook
//      Login for Business with a CONFIGURATION (META_PAGES_CONFIG_ID, see
//      lib/meta/client.js), so what the token carries is whatever that
//      dashboard configuration lists, not FieldQuo's scope string — and Meta's
//      Lead Ads diagnostics on the same app showed Page permissions missing.
//      Meta's Instagram get-started page for this API
//      (developers.facebook.com/docs/messenger-platform/instagram/get-started,
//      read 2026-09-28) lists the permissions to request — instagram_basic,
//      instagram_manage_messages, pages_manage_metadata — and requires at least
//      "Moderate" task access on the connected Page. MetaPageConnection.scopes
//      stores what Meta actually granted at connect time, so the missing ones
//      are named rather than guessed.
//
// The same page is the only source for the Instagram-side setting the screen
// names: "Instagram Settings > Messages and story replies > Message controls >
// Connected Tools > Allow Access to Messages". Nothing about Instagram's menus
// is said anywhere that page does not say it.
//
// ══ Why Instagram only ═════════════════════════════════════════════════════
//
// Code 3 on a FACEBOOK send has not been seen, and telling a Page owner to go
// into Instagram's settings would send them to the wrong app. It stays with
// the generic classifier until there is a Facebook case to name.
//
// Pure, for the same reason threadControl.js is: the "use client" page needs
// these, and metaSend.js reaches "@/lib/db".

export const INSTAGRAM_CAPABILITY_REASON = "meta_instagram_messaging_not_enabled";

/** Meta's "Application does not have the capability to make this API call". */
export const CAPABILITY_ERROR_CODE = 3;

/**
 * The permissions Meta's Instagram get-started page (Messenger Platform,
 * Facebook Login) says to request. In Meta's order.
 */
export const INSTAGRAM_MESSAGING_PERMISSIONS = Object.freeze([
  "instagram_basic",
  "instagram_manage_messages",
  "pages_manage_metadata",
]);

/** Is this Graph error body the Instagram capability refusal? */
export function isInstagramCapabilityError(platform, body) {
  if (platform !== "instagram") return false;
  const err = body && typeof body === "object" ? body.error : null;
  if (!err || typeof err !== "object") return false;
  return Number(err.code) === CAPABILITY_ERROR_CODE;
}

/** Does this stored Message.failedReason carry it? Both stored shapes. */
export function isInstagramCapabilityFailure(failedReason) {
  if (typeof failedReason !== "string") return false;
  return (
    failedReason === INSTAGRAM_CAPABILITY_REASON || failedReason.startsWith(`${INSTAGRAM_CAPABILITY_REASON}:`)
  );
}

/**
 * Which of Meta's listed permissions the stored grant does NOT include.
 *
 * @param {string|null} scopes  MetaPageConnection.scopes — Meta's own granted
 *        list, space- or comma-separated
 * @returns {string[]|null}  the missing ones (possibly empty), or null when
 *        there is no stored grant to read. Null is NOT "nothing missing":
 *        absence of a record is not a record of absence.
 */
export function missingInstagramPermissions(scopes) {
  if (typeof scopes !== "string" || !scopes.trim()) return null;
  const have = new Set(
    scopes
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean),
  );
  return INSTAGRAM_MESSAGING_PERMISSIONS.filter((p) => !have.has(p));
}

// ── The one place the stored sentence carries the verdict ────────────────
//
// The reply route appends the verdict to the message it stores; the page
// reads it back from failedReason after a reload. One writer, one reader, one
// format — so the panel on a reloaded thread says what the panel said the
// moment the send failed, with no second route to ask.
const TAG_MISSING = "[missing permissions:";
const TAG_ALL_GRANTED = "[all Instagram messaging permissions granted]";

/** Append the permission verdict to the stored message. `missing` null = unknown. */
export function withPermissionVerdict(message, missing) {
  if (!Array.isArray(missing)) return message;
  return missing.length ? `${message} ${TAG_MISSING} ${missing.join(", ")}]` : `${message} ${TAG_ALL_GRANTED}`;
}

/**
 * Read the verdict back out of a stored failedReason.
 * @returns {string[]|null}  missing permissions ([] = all granted), or null = unknown
 */
export function permissionVerdictFromFailure(failedReason) {
  if (typeof failedReason !== "string") return null;
  if (failedReason.includes(TAG_ALL_GRANTED)) return [];
  const at = failedReason.lastIndexOf(TAG_MISSING);
  if (at === -1) return null;
  const end = failedReason.indexOf("]", at);
  if (end === -1) return null;
  const listed = failedReason
    .slice(at + TAG_MISSING.length, end)
    .split(",")
    .map((s) => s.trim())
    // Only names from Meta's own list survive the round trip: this string is
    // shown on screen, and a stored sentence is not a place to take a
    // permission name on trust.
    .filter((s) => INSTAGRAM_MESSAGING_PERMISSIONS.includes(s));
  return listed.length ? listed : null;
}
