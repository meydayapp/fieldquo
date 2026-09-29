// lib/tiktok/specs.js
//
// Every DECISION the TikTok integration makes, as pure functions — which
// privacy levels may be offered, what the composer starts on, whether a post
// request is allowed, what request body TikTok is sent, what a status or an
// error code means. No fetch, no Prisma, no env: the publish route, the status
// route, the webhook and the composer all import these, and
// scripts/check-tiktok.mjs executes them against hostile input. Same split as
// lib/social/metaSpecs.js (decisions) vs lib/social/publishDesign.js (glue).
//
// Client-safe: imported by the composer (app/components/designer/
// TikTokPublishModal.js), so nothing here may import a Node module.
//
// ══ TikTok's mandated composer (the "UX guidelines") ══════════════════════
//
// developers.tiktok.com/doc/content-sharing-guidelines, read 2026-09-29. What
// this file encodes from it, and where the UI half lives:
//
//   - Show the creator's nickname from creator_info, fetched fresh each time
//     the composer opens; stop if creator_info says the creator cannot post
//     right now.                              → creatorPostingBlock()
//   - Privacy level from creator_info's privacy_level_options, chosen by the
//     person from a dropdown with NO default. → offeredPrivacyOptions(),
//                                              COMPOSER_DEFAULTS.privacyLevel
//   - Interaction toggles unchecked by default, and greyed out when
//     creator_info says the creator has them off. A PHOTO post shows "Allow
//     comment" only — Duet and Stitch do not apply to photos.
//                                            → COMPOSER_DEFAULTS.allowComment
//   - Commercial content disclosure: a toggle, off by default; when on, "Your
//     brand" and/or "Branded content", at least one required, each with its
//     label ("Promotional content" / "Paid partnership"); branded content can
//     never be private (SELF_ONLY).         → commercialLabel(),
//                                              privacyOptionBlockedBy(),
//                                              validateTikTokPost()
//   - The consent line: "By posting, you agree to TikTok's Music Usage
//     Confirmation", plus the Branded Content Policy when branded content is
//     on.                                    → consentLine()
//   - A preview, no watermark, the person's express consent (the Post button),
//     and a note that the post may take a few minutes to appear.
//                                            → the composer itself
/** Every privacy level TikTok defines (content-posting-api-reference-photo-post). */
export const PRIVACY_LEVELS = Object.freeze([
  "PUBLIC_TO_EVERYONE",
  "MUTUAL_FOLLOW_FRIENDS",
  "FOLLOWER_OF_CREATOR",
  "SELF_ONLY",
]);

export const PRIVATE_LEVEL = "SELF_ONLY";

/** Photo description limit: 4000 UTF-16 code units — which is String.length. */
export const TIKTOK_DESCRIPTION_MAX = 4000;
/** Video title limit: "The maximum length is 2200 in UTF-16 runes"
 * (content-posting-api-reference-direct-post). */
export const TIKTOK_VIDEO_TITLE_MAX = 2200;
/** "Maximum of 20MB for each image"; "Maximum 1080p" (media-transfer-guide). */
export const TIKTOK_PHOTO_MAX_BYTES = 20 * 1024 * 1024;
export const TIKTOK_PHOTO_MAX_SHORT_SIDE = 1080;
export const TIKTOK_PHOTO_MAX_LONG_SIDE = 1920;

/** The one shape FieldQuo posts to TikTok — lib/marketing/ratios.js's 9:16. */
export const TIKTOK_RATIO_KEY = "tiktok";

// TikTok's own documents, linked from the consent line exactly as the
// guidelines name them.
export const TIKTOK_MUSIC_USAGE_URL = "https://www.tiktok.com/legal/page/global/music-usage-confirmation/en";
export const TIKTOK_BRANDED_CONTENT_URL = "https://www.tiktok.com/legal/page/global/bc-policy/en";

/**
 * What the composer starts on. Every one of these is "the person has not
 * chosen yet", on purpose: TikTok forbids a default privacy level and requires
 * the interaction and commercial toggles to start off.
 */
export const COMPOSER_DEFAULTS = Object.freeze({
  privacyLevel: null,
  allowComment: false,
  // Video only (the guidelines' "Duet" and "Stitch"); a photo post never
  // shows or sends them.
  allowDuet: false,
  allowStitch: false,
  commercialOn: false,
  yourBrand: false,
  brandedContent: false,
});

/**
 * The privacy levels the dropdown may list: TikTok's own list for THIS
 * creator, never ours, filtered to values we know how to label (an unknown
 * value from a future API version is dropped rather than shown as a raw code).
 *
 * Unaudited: SELF_ONLY only. TikTok refuses anything else from an unaudited
 * client (`unaudited_client_can_only_post_to_private_accounts`), so offering
 * "Everyone" would be a choice that cannot work. An empty result means this
 * creator cannot post privately — the composer says so instead of posting.
 */
export function offeredPrivacyOptions({ creatorOptions, audited }) {
  const fromTikTok = Array.isArray(creatorOptions)
    ? creatorOptions.filter((o) => typeof o === "string" && PRIVACY_LEVELS.includes(o))
    : [];
  const unique = [...new Set(fromTikTok)];
  return audited ? unique : unique.filter((o) => o === PRIVATE_LEVEL);
}

/**
 * Why a privacy option is greyed out, or null. Branded content "can't be
 * private" — so "Only me" is blocked while branded content is ticked.
 */
export function privacyOptionBlockedBy(option, { commercialOn, brandedContent }) {
  if (option === PRIVATE_LEVEL && commercialOn && brandedContent) return "branded_content_private";
  return null;
}

/**
 * Why "Branded content" is greyed out, or null — the other half of the same
 * rule, applied from the privacy side: with "Only me" chosen, branded content
 * cannot be ticked. Unaudited, "Only me" is the only level there is, so
 * branded content is unavailable until TikTok audits FieldQuo.
 */
export function brandedContentBlockedBy({ privacyLevel }) {
  return privacyLevel === PRIVATE_LEVEL ? "branded_content_private" : null;
}

/**
 * The label TikTok will put on the post, or null when nothing is disclosed.
 * Both boxes ticked reads "Paid partnership", per the guidelines.
 */
export function commercialLabel({ commercialOn, yourBrand, brandedContent }) {
  if (!commercialOn) return null;
  if (brandedContent) return "paid_partnership";
  if (yourBrand) return "promotional";
  return null;
}

/** Which consent sentence sits above the Post button. */
export function consentLine({ commercialOn, brandedContent }) {
  return commercialOn && brandedContent ? "branded_and_music" : "music";
}

/**
 * creator_info can answer HTTP 200 and still say this creator cannot post now
 * (spam_risk_too_many_posts, spam_risk_user_banned_from_posting,
 * reached_active_user_cap — content-posting-api-reference-query-creator-info).
 * The guidelines say to stop and ask them to try later. Returns that code, or
 * null when posting may go ahead.
 */
const CREATOR_BLOCK_CODES = new Set([
  "spam_risk_too_many_posts",
  "spam_risk_user_banned_from_posting",
  "reached_active_user_cap",
]);
export function creatorPostingBlock(errorCode) {
  return CREATOR_BLOCK_CODES.has(errorCode) ? errorCode : null;
}

/**
 * The composer's own checks — run in the browser to enable the Post button,
 * and again on the server against a creator_info fetched on THAT request, so
 * a stale browser cannot post with a privacy level the creator no longer has.
 *
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateTikTokPost({
  privacyLevel,
  allowComment,
  allowDuet,
  allowStitch,
  commercialOn,
  yourBrand,
  brandedContent,
  description,
  creatorInfo,
  audited,
  mediaKind = "photo",
}) {
  const errors = [];
  const offered = offeredPrivacyOptions({ creatorOptions: creatorInfo?.privacyLevelOptions, audited });

  if (!creatorInfo) errors.push("creator_info_missing");
  if (creatorInfo && offered.length === 0) errors.push("no_privacy_option");
  if (!privacyLevel) errors.push("privacy_required");
  else if (!offered.includes(privacyLevel)) errors.push("privacy_not_offered");

  if (allowComment === true && creatorInfo?.commentDisabled) errors.push("comment_disabled_by_creator");
  // Duet and Stitch exist for a VIDEO only; a photo post never sends them, so
  // a stray tick on a photo is ignored rather than refused.
  if (mediaKind === "video") {
    if (allowDuet === true && creatorInfo?.duetDisabled) errors.push("duet_disabled_by_creator");
    if (allowStitch === true && creatorInfo?.stitchDisabled) errors.push("stitch_disabled_by_creator");
  }

  if (commercialOn === true) {
    if (!yourBrand && !brandedContent) errors.push("commercial_choice_required");
    if (brandedContent && privacyLevel === PRIVATE_LEVEL) errors.push("branded_content_private");
  }

  const text = typeof description === "string" ? description : "";
  if (text.length > (mediaKind === "video" ? TIKTOK_VIDEO_TITLE_MAX : TIKTOK_DESCRIPTION_MAX)) errors.push("description_too_long");

  return { ok: errors.length === 0, errors };
}

/**
 * The exact body for POST /v2/post/publish/content/init/ — a Direct Post of one
 * photo pulled from FieldQuo's verified media prefix
 * (developers.tiktok.com/doc/content-posting-api-reference-photo-post).
 *
 * Every boolean is written as a boolean from the person's own choice, never
 * left to TikTok's default: disable_comment is true unless they ticked "Allow
 * comment", and both brand toggles are false unless the disclosure is on AND
 * that box is ticked. `title` and `auto_add_music` are not sent — FieldQuo's
 * caption is the description, and adding music nobody chose is not ours to
 * decide.
 */
export function buildPhotoPostBody({ privacyLevel, allowComment, commercialOn, yourBrand, brandedContent, description, photoUrl }) {
  return {
    media_type: "PHOTO",
    post_mode: "DIRECT_POST",
    post_info: {
      description: typeof description === "string" ? description : "",
      privacy_level: privacyLevel,
      disable_comment: allowComment !== true,
      brand_content_toggle: commercialOn === true && brandedContent === true,
      brand_organic_toggle: commercialOn === true && yourBrand === true,
    },
    source_info: {
      source: "PULL_FROM_URL",
      photo_images: [photoUrl],
      photo_cover_index: 0,
    },
  };
}

/**
 * "Send to TikTok as a draft": post_mode MEDIA_UPLOAD. TikTok "Upload[s]
 * content to TikTok for users to complete the post using TikTok's editing
 * flow. Users will receive an inbox notification"
 * (content-posting-api-reference-photo-post; scope video.upload). Only the
 * description is sent — privacy, comments and disclosure are DIRECT_POST-only
 * fields, and here the creator sets them in TikTok's own editor.
 */
export function buildPhotoDraftBody({ description, photoUrl }) {
  return {
    media_type: "PHOTO",
    post_mode: "MEDIA_UPLOAD",
    post_info: {
      description: typeof description === "string" ? description : "",
    },
    source_info: {
      source: "PULL_FROM_URL",
      photo_images: [photoUrl],
      photo_cover_index: 0,
    },
  };
}

/** The two things the composer can do with a design. */
export const POST_MODES = Object.freeze({ post: "DIRECT_POST", draft: "MEDIA_UPLOAD" });

/**
 * The draft's own checks: a draft needs no privacy level or disclosure (the
 * creator chooses those in TikTok), but it still needs the creator's info (so
 * the composer can say which account's inbox it goes to) and a caption
 * TikTok will take.
 */
export function validateTikTokDraft({ description, creatorInfo, mediaKind = "photo" }) {
  const errors = [];
  if (!creatorInfo) errors.push("creator_info_missing");
  // A video draft carries no caption at all (the inbox endpoint takes the
  // video only), so there is no length for it to exceed.
  if (mediaKind !== "video" && (typeof description === "string" ? description : "").length > TIKTOK_DESCRIPTION_MAX) errors.push("description_too_long");
  return { ok: errors.length === 0, errors };
}

/**
 * The rendered image, checked against TikTok's photo limits before anything
 * is uploaded. A hand-adjusted layout can drift from 1080x1920, so this reads
 * the real pixels, not AD_RATIOS' nominal size.
 */
export function validateTikTokPhoto({ width, height, bytes }) {
  const errors = [];
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    errors.push("no_dimensions");
  } else if (
    Math.min(width, height) > TIKTOK_PHOTO_MAX_SHORT_SIDE ||
    Math.max(width, height) > TIKTOK_PHOTO_MAX_LONG_SIDE
  ) {
    errors.push("resolution_too_large");
  }
  if (Number.isFinite(bytes) && bytes > TIKTOK_PHOTO_MAX_BYTES) errors.push("file_too_large");
  return { ok: errors.length === 0, errors };
}

/** JPEG starts FF D8 FF. The composer rasterises JPEG; anything else is refused. */
export function isJpeg(buffer) {
  return Boolean(buffer && buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff);
}

// ══ Status ═════════════════════════════════════════════════════════════════

/** TikTokPublish.status values. `processing` covers "sent, not finished". */
export const PUBLISH_STATUSES = Object.freeze(["pending", "processing", "inbox_delivered", "published", "failed"]);
const TERMINAL = new Set(["published", "failed"]);

export function isTerminalStatus(status) {
  return TERMINAL.has(status);
}

/**
 * /v2/post/publish/status/fetch/'s `status` → ours
 * (developers.tiktok.com/doc/content-posting-api-reference-get-video-status).
 * Unknown values return null — "we don't know", never a guessed state.
 */
export function mapTikTokStatus(status) {
  switch (status) {
    case "PROCESSING_UPLOAD":
    case "PROCESSING_DOWNLOAD":
      return "processing";
    case "SEND_TO_USER_INBOX":
      return "inbox_delivered";
    case "PUBLISH_COMPLETE":
      return "published";
    case "FAILED":
      return "failed";
    default:
      return null;
  }
}

/**
 * The row patch one status observation implies — from the poll or from a
 * webhook, the same function, so the two can never disagree about what
 * "complete" means. Idempotent and monotonic: a terminal row is never moved
 * (TikTok delivers webhooks at least once and may retry for 72 hours, so a
 * duplicate "complete" or a late "processing" must change nothing), and null
 * means "nothing to write".
 *
 * @param {{status: string, failReason?: string|null, publicPostId?: string|null}} row
 * @param {{status: string|null, failReason?: string|null, publicPostId?: string|null|undefined}} next
 */
export function statusPatch(row, next, now = new Date()) {
  if (!row || !next) return null;
  const patch = {};
  // The public post id can arrive after the terminal status (the
  // publicly_available webhook) and can be withdrawn again — recorded on a
  // terminal row too, because it is a fact about the post, not a transition.
  if (next.publicPostId !== undefined && (next.publicPostId ?? null) !== (row.publicPostId ?? null)) {
    patch.publicPostId = next.publicPostId ?? null;
  }
  if (next.status && !isTerminalStatus(row.status) && next.status !== row.status) {
    patch.status = next.status;
    if (next.status === "published") patch.publishedAt = now;
    if (next.status === "failed") patch.failReason = next.failReason ? String(next.failReason).slice(0, 80) : null;
  }
  return Object.keys(patch).length ? patch : null;
}

/**
 * A webhook event → the observation statusPatch() takes, or null for an event
 * that is not about a post. Event names and content fields as listed on
 * content-posting-api-reference-get-video-status — including TikTok's own
 * spelling "publicaly".
 */
export function observationFromWebhook(event, content) {
  const c = content && typeof content === "object" ? content : {};
  const postId = c.post_id !== undefined && c.post_id !== null ? String(c.post_id) : null;
  switch (event) {
    case "post.publish.complete":
      return { status: "published" };
    case "post.publish.failed":
      return { status: "failed", failReason: typeof c.reason === "string" ? c.reason : null };
    case "post.publish.inbox_delivered":
      return { status: "inbox_delivered" };
    case "post.publish.publicly_available":
      return { status: "published", publicPostId: postId };
    case "post.publish.no_longer_publicaly_available":
      return { status: null, publicPostId: null };
    default:
      return null;
  }
}

// ══ Errors ═════════════════════════════════════════════════════════════════

/**
 * Every code TikTok documents for the endpoints FieldQuo calls, plus the
 * publish `fail_reason`s and our own few, each with what the contractor has to
 * do about it. The composer has a translated sentence per code; an unknown
 * code is shown AS the code ("TikTok refused the post (code: x)"), never as
 * "something went wrong".
 *
 * fix: "reconnect" → Settings; "wait" → try later; "account" → change
 * something in the TikTok app; "fieldquo" → FieldQuo's own setup (the
 * contractor cannot fix it); "retry" → try again now; "edit" → change the post.
 */
export const TIKTOK_ERRORS = Object.freeze({
  access_token_invalid: { fix: "reconnect", retryable: false },
  scope_not_authorized: { fix: "reconnect", retryable: false },
  token_expired: { fix: "reconnect", retryable: false },
  not_connected: { fix: "reconnect", retryable: false },
  auth_removed: { fix: "reconnect", retryable: false },
  rate_limit_exceeded: { fix: "wait", retryable: true },
  spam_risk_too_many_posts: { fix: "wait", retryable: false },
  spam_risk_too_many_pending_share: { fix: "wait", retryable: false },
  reached_active_user_cap: { fix: "wait", retryable: false },
  spam_risk_user_banned_from_posting: { fix: "account", retryable: false },
  unaudited_client_can_only_post_to_private_accounts: { fix: "account", retryable: false },
  url_ownership_unverified: { fix: "fieldquo", retryable: false },
  privacy_level_option_mismatch: { fix: "edit", retryable: false },
  invalid_param: { fix: "edit", retryable: false },
  spam_risk_text: { fix: "edit", retryable: false },
  spam_risk: { fix: "wait", retryable: false },
  file_format_check_failed: { fix: "edit", retryable: false },
  picture_size_check_failed: { fix: "edit", retryable: false },
  photo_pull_failed: { fix: "retry", retryable: true },
  // Video fail_reasons (content-posting-api-reference-get-video-status).
  video_pull_failed: { fix: "retry", retryable: true },
  duration_check_failed: { fix: "edit", retryable: false },
  frame_rate_check_failed: { fix: "edit", retryable: false },
  publish_cancelled: { fix: "retry", retryable: true },
  internal_error: { fix: "retry", retryable: true },
  // MEDIA_UPLOAD only: "User's TikTok app version below 31.8".
  app_version_check_failed: { fix: "account", retryable: false },
  network: { fix: "retry", retryable: true },
});

// TikTok spells the same fact two ways in two tables: the status endpoint's
// fail_reason "internal" and the API error "internal_error".
const ALIASES = { internal: "internal_error" };

/**
 * @param {{ status?: number, code?: string|null }} input — HTTP status and
 *   TikTok's `error.code` (or a fail_reason, or our own code)
 * @returns {{ code: string, known: boolean, fix: string|null, retryable: boolean }}
 */
export function classifyTikTokError({ status, code } = {}) {
  const raw = typeof code === "string" && code && code !== "ok" ? code : null;
  const normalised = raw ? ALIASES[raw] || raw : null;
  if (normalised && TIKTOK_ERRORS[normalised]) {
    return { code: normalised, known: true, ...TIKTOK_ERRORS[normalised] };
  }
  // No code we recognise: fall back on the HTTP status class, and keep TikTok's
  // own code (if any) so the screen can quote it.
  if (!raw && (status === 401 || status === 403)) {
    return { code: "access_token_invalid", known: true, ...TIKTOK_ERRORS.access_token_invalid };
  }
  if (!raw && status === 429) return { code: "rate_limit_exceeded", known: true, ...TIKTOK_ERRORS.rate_limit_exceeded };
  if (!raw && Number.isFinite(status) && status >= 500) {
    return { code: "internal_error", known: true, ...TIKTOK_ERRORS.internal_error };
  }
  return { code: raw || "tiktok_error", known: false, fix: null, retryable: false };
}
