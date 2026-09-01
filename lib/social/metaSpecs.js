// lib/social/metaSpecs.js
//
// Pure rules for publishing one rendered MarketingDesign asset to Meta
// (Facebook Page feed, Instagram professional account) — no fetch, no
// fabric, no Prisma. Everything here is a plain function over plain data, on
// purpose: this is the part of the feature that is wrong the moment it's
// wrong (an over-long caption rejected AFTER a container was already
// created, a 9:16 Story crop silently rejected by Instagram's feed
// endpoint) rather than merely ugly, so scripts/check-ad-ratios.mjs and
// scripts/check-designer-reach.mjs execute it against hostile input the
// same way they already execute lib/marketing/ratios.js's reflow().
//
// ══ Numbers, and where they came from ═══════════════════════════════════
//
// Every limit below was read from Meta's own live developer docs on
// 31 Aug 2026, not carried over from memory or a blog post — a wrong
// hard-coded limit here fails silently (an image Instagram would have
// accepted gets rejected client-side, or worse, one it would have rejected
// gets sent and the contractor sees a cryptic Graph API error instead of a
// plain-language one). Sources, fetched the same day:
//
//   - Image requirements (aspect ratio, width, file size, format, colour
//     space) — developers.facebook.com/docs/instagram-platform/
//     instagram-graph-api/reference/ig-user/media/
//   - Caption limits (2200 chars / 30 hashtags / 20 @ tags) — same page.
//   - Container status codes (EXPIRED/ERROR/FINISHED/IN_PROGRESS/PUBLISHED)
//     and the 24-hour container lifetime — developers.facebook.com/docs/
//     instagram-platform/instagram-graph-api/reference/ig-container
//   - content_publishing_limit shape (quota_usage, config.quota_total,
//     config.quota_duration) and today's documented default of 50 per
//     86400s — developers.facebook.com/docs/instagram-platform/
//     instagram-graph-api/reference/ig-user/content_publishing_limit
//   - Facebook Page feed scheduling (`scheduled_publish_time`, 10 minutes
//     to 75 days out, requires published:false) — developers.facebook.com/
//     docs/graph-api/reference/page/feed/
//
// Meta's own quota doc says "currently 50" — the word "currently" is doing
// real work. QUOTA_TOTAL_FALLBACK below is a fallback for when the live
// content_publishing_limit call can't be made (not yet connected, or the
// call itself fails), never a value trusted over a real response. See
// interpretRateLimit()'s own comment for why the fallback is used to WARN,
// never to silently allow a publish the real quota would have refused.

/** Instagram Content Publishing API — organic image posts. */
export const INSTAGRAM_IMAGE_SPEC = Object.freeze({
  minAspectRatio: 4 / 5, // portrait limit — taller is rejected
  maxAspectRatio: 1.91, // landscape limit — wider is rejected
  minWidth: 320,
  maxWidth: 1440,
  maxFileSizeBytes: 8 * 1024 * 1024,
  format: "jpeg",
});

/** Instagram caption — same field for the container's `caption` param. */
export const INSTAGRAM_CAPTION_SPEC = Object.freeze({
  maxLength: 2200,
  maxHashtags: 30,
  maxMentions: 20,
});

/**
 * Facebook Page feed photo posts. Meta's own docs do not publish a hard
 * aspect-ratio gate for Page photo posts the way Instagram's media endpoint
 * does — a Page will accept a much wider range of shapes and letterbox or
 * crop it in the feed UI rather than reject the call. What IS a hard 400
 * from the Graph API is an oversized file, so that's the one limit encoded
 * here as a rejection rather than left to Meta's response. If Meta's own
 * behaviour turns out stricter than this in production, tighten this object
 * — do not silently start allowing what already failed once.
 */
export const FACEBOOK_IMAGE_SPEC = Object.freeze({
  maxFileSizeBytes: 10 * 1024 * 1024,
});

/** Meta's own quota fields — see this file's header for the source. */
export const QUOTA_TOTAL_FALLBACK = 50;
export const QUOTA_DURATION_SECONDS_FALLBACK = 86400;

/** Facebook Page feed scheduling window — see this file's header. */
export const FACEBOOK_SCHEDULE_MIN_MINUTES = 10;
export const FACEBOOK_SCHEDULE_MAX_DAYS = 75;

/**
 * FieldQuo's OWN scheduling window — for Instagram, which has no native
 * scheduling parameter at all (re-confirmed against Meta's live Content
 * Publishing API docs 31 Aug 2026: no scheduling field is documented, and
 * Meta's own guidance tells an app that lets users "schedule posts to be
 * published in the future" to re-check the publishing rate limit itself —
 * exactly what publishToInstagram() does at fire time, not at schedule
 * time). Not Meta's numbers, because there is no Meta rule to mirror here —
 * these bound FieldQuo's OWN queue-and-cron design instead:
 *
 *   - A minimum, so "schedule" and "publish now" aren't the same button
 *     wearing two labels, and so the cron (which runs on an interval, not
 *     instantly) has time to actually pick the row up before its target
 *     time passes.
 *   - A maximum, so a fat-fingered year doesn't leave a row `scheduled`
 *     forever with nothing ever refusing it. Six months is a deliberately
 *     generous but real ceiling — long enough for a contractor planning a
 *     seasonal campaign, short enough that a row this old is almost
 *     certainly a mistake rather than a plan.
 */
export const FIELDQUO_SCHEDULE_MIN_MINUTES = 5;
export const FIELDQUO_SCHEDULE_MAX_DAYS = 180;

// ── Caption ══════════════════════════════════════════════════════════════

/**
 * Checks a caption against Instagram's own limits — the tighter of the two
 * platforms, so this is also what a "post to both" caption is checked
 * against. Facebook Page posts have no comparable published cap.
 *
 * Returns `{ ok, errors, counts }` rather than throwing: the caller is a
 * form, and a form wants to show every problem at once, not stop at the
 * first one.
 */
export function validateCaption(caption) {
  const text = typeof caption === "string" ? caption : "";
  const errors = [];

  const length = [...text].length; // code points, not UTF-16 units
  if (length === 0) {
    errors.push("empty");
  } else if (length > INSTAGRAM_CAPTION_SPEC.maxLength) {
    errors.push("too_long");
  }

  const hashtags = (text.match(/#[^\s#@]+/g) || []).length;
  if (hashtags > INSTAGRAM_CAPTION_SPEC.maxHashtags) {
    errors.push("too_many_hashtags");
  }

  const mentions = (text.match(/@[^\s#@]+/g) || []).length;
  if (mentions > INSTAGRAM_CAPTION_SPEC.maxMentions) {
    errors.push("too_many_mentions");
  }

  return {
    ok: errors.length === 0,
    errors,
    counts: { length, hashtags, mentions },
  };
}

// ── Image ════════════════════════════════════════════════════════════════

/**
 * Instagram's aspect-ratio gate is a hard rejection, not an auto-crop — the
 * one Instagram-specific check worth running client-side before a container
 * is even created, because failing it wastes a container against the
 * 24-hour/content_publishing_limit clock for nothing. Width outside
 * [320, 1440] is NOT treated as an error: Meta's own docs say it scales the
 * image rather than rejecting it, so flagging it here would be a false
 * alarm — see the constant's own comment.
 */
export function validateImageForInstagram({ width, height, fileSizeBytes } = {}) {
  const errors = [];
  const w = Number(width);
  const h = Number(height);

  if (!(w > 0) || !(h > 0)) {
    errors.push("no_dimensions");
    return { ok: false, errors, aspectRatio: null };
  }

  const aspectRatio = w / h;
  // A tiny epsilon absorbs genuine floating-point noise (division rarely
  // lands on an exact decimal) without opening the door wide enough to wave
  // through a REAL violation — 1e-9 is many orders of magnitude below
  // anything a pixel-dimension ratio could legitimately differ by, but
  // still catches e.g. 1.9047619047619047 vs a differently-rounded 1.91
  // ceiling. Do not widen this to "fix" a failing preset — see
  // scripts/check-ad-ratios.mjs section 9 for why the boundary is meant to
  // bite exactly here.
  const EPSILON = 1e-9;
  if (
    aspectRatio < INSTAGRAM_IMAGE_SPEC.minAspectRatio - EPSILON ||
    aspectRatio > INSTAGRAM_IMAGE_SPEC.maxAspectRatio + EPSILON
  ) {
    errors.push("aspect_ratio");
  }

  if (Number.isFinite(fileSizeBytes) && fileSizeBytes > INSTAGRAM_IMAGE_SPEC.maxFileSizeBytes) {
    errors.push("file_too_large");
  }

  return { ok: errors.length === 0, errors, aspectRatio };
}

/** Facebook's own gate — see FACEBOOK_IMAGE_SPEC's comment for why it's short. */
export function validateImageForFacebook({ fileSizeBytes } = {}) {
  const errors = [];
  if (Number.isFinite(fileSizeBytes) && fileSizeBytes > FACEBOOK_IMAGE_SPEC.maxFileSizeBytes) {
    errors.push("file_too_large");
  }
  return { ok: errors.length === 0, errors };
}

/**
 * Which lib/marketing/ratios.js AD_RATIOS key produces a compliant
 * Instagram feed crop. "instagram_post" (1080x1080, ratio 1.0) is always
 * inside [0.8, 1.91]. "facebook_feed" (1200x630, ratio ≈1.905) is inside it
 * too, but only just — it is the one preset close enough to the ceiling
 * that a future edit to either number could silently push it over, which is
 * exactly why validateImageForInstagram() re-checks the REAL rendered
 * pixels rather than trusting this lookup alone.
 */
export const INSTAGRAM_COMPLIANT_RATIO_KEY = "instagram_post";

// ── Container state machine ═════════════════════════════════════════════
//
// Meta's own status_code values for a media container: IN_PROGRESS, FINISHED,
// ERROR, EXPIRED, PUBLISHED (source in this file's header). This function is
// the ENTIRE decision of what FieldQuo does next for each — deliberately
// factored out of the code that calls fetch(), so the state machine can be
// exercised with every status Meta can return, including ones a live account
// may never actually hit in testing.

const MAX_POLL_ATTEMPTS = 10;
const POLL_BACKOFF_MS = [1000, 1500, 2000, 3000, 3000, 5000, 5000, 8000, 8000, 8000];

/**
 * @param {"IN_PROGRESS"|"FINISHED"|"ERROR"|"EXPIRED"|"PUBLISHED"|string} statusCode
 * @param {number} attempt - how many polls have already happened (0 on the first check)
 * @returns {{action:"publish"|"poll"|"fail"|"recreate", waitMs?:number, reason?:string}}
 */
export function nextContainerAction(statusCode, attempt = 0) {
  switch (statusCode) {
    case "FINISHED":
      return { action: "publish" };
    case "PUBLISHED":
      // Already published — most likely a retried request against a container
      // a previous call already finished. Treat as done, not an error, so a
      // flaky network retry can't produce a duplicate post.
      //
      // This comment was already here and the code under it said `publish`,
      // which is the opposite: it would have called media_publish a second
      // time on something already live. Meta most likely refuses that, but
      // "the vendor probably stops us" is not a guard, and a post to a
      // homeowner-facing feed cannot be taken back. Same failure class as the
      // marketing-campaign double-send, and the same rule — for something
      // outward-facing, a duplicate is worse than a gap.
      return { action: "already_published" };
    case "IN_PROGRESS":
      if (attempt >= MAX_POLL_ATTEMPTS) {
        return { action: "fail", reason: "timed_out" };
      }
      return { action: "poll", waitMs: POLL_BACKOFF_MS[attempt] ?? 8000 };
    case "ERROR":
      return { action: "fail", reason: "container_error" };
    case "EXPIRED":
      // A container not published within 24h. The fix is a fresh container,
      // not a retry of the publish call against a dead id.
      return { action: "recreate", reason: "container_expired" };
    default:
      return { action: "fail", reason: "unknown_status" };
  }
}

// ── Rate limit ═══════════════════════════════════════════════════════════

/**
 * Interprets a GET /{ig-user-id}/content_publishing_limit response (or its
 * absence) into a decision the publish flow can act on directly, so hitting
 * the cap is a named outcome ("rate_limited", with a real reset time) rather
 * than whatever generic error text a raw 4xx would otherwise produce.
 *
 * @param {{quota_usage?: number, config?: {quota_total?: number, quota_duration?: number}} | null} quota
 *   Meta's own response shape, or null if the call itself failed/was never made.
 */
export function interpretRateLimit(quota) {
  if (!quota || typeof quota !== "object") {
    // No live read available. Fall back to the documented default, but mark
    // the reading as unverified — the caller must show "couldn't confirm
    // your remaining posts" rather than a confident number it doesn't have.
    // The publish itself is still allowed to proceed to Meta, which is the
    // authority that actually enforces the cap; this function only decides
    // what FieldQuo tells the contractor about it.
    return {
      ok: true,
      verified: false,
      used: null,
      total: QUOTA_TOTAL_FALLBACK,
      remaining: null,
    };
  }

  const used = Number(quota.quota_usage);
  const total = Number(quota.config?.quota_total);
  const durationSeconds = Number(quota.config?.quota_duration);

  if (!Number.isFinite(used) || !Number.isFinite(total) || total <= 0) {
    return { ok: true, verified: false, used: null, total: QUOTA_TOTAL_FALLBACK, remaining: null };
  }

  const remaining = Math.max(0, total - used);
  return {
    ok: remaining > 0,
    verified: true,
    used,
    total,
    remaining,
    durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : QUOTA_DURATION_SECONDS_FALLBACK,
  };
}

// ── Facebook scheduling window ══════════════════════════════════════════

/**
 * Is `when` a valid scheduled_publish_time for a Facebook Page feed post?
 * Meta's own Graph API rejects anything sooner than ~10 minutes out or
 * further than 75 days — checked here so the UI can refuse before the
 * request rather than surface Meta's own error text for an input FieldQuo
 * could have caught itself.
 *
 * Instagram has no equivalent parameter at all — see docs/SOCIAL-PUBLISHING.md
 * for why "schedule for Instagram" is a FieldQuo-side hold-and-post queue,
 * not a Graph API call, and is explicitly out of scope for this build.
 */
export function isValidFacebookScheduleTime(when, now = new Date()) {
  const target = when instanceof Date ? when : new Date(when);
  if (Number.isNaN(target.getTime())) return false;

  const minMs = now.getTime() + FACEBOOK_SCHEDULE_MIN_MINUTES * 60 * 1000;
  const maxMs = now.getTime() + FACEBOOK_SCHEDULE_MAX_DAYS * 24 * 60 * 60 * 1000;
  const t = target.getTime();
  return t >= minMs && t <= maxMs;
}

/**
 * FieldQuo's own schedule-window check — used for Instagram (which has no
 * Meta-side window to defer to at all) and, more generally, as the floor/
 * ceiling the date/time picker itself enforces before either platform-
 * specific check ever runs. See FIELDQUO_SCHEDULE_MIN_MINUTES/MAX_DAYS above
 * for why these numbers are FieldQuo's own rather than copied from Meta's.
 *
 * Deliberately built the same shape as isValidFacebookScheduleTime (a Date
 * or parseable value in, a bool out, `now` injectable) rather than a
 * generalised "date range" helper — two functions that happen to look alike
 * today are allowed to diverge tomorrow if Meta's own number moves, and a
 * shared abstraction over "two numbers bound a timestamp" would be the kind
 * of premature generalisation AGENTS.md's failure-class list warns against
 * for the OPPOSITE reason copy-paste is warned against: this one couples two
 * things that are only accidentally the same shape.
 *
 * `now.getTime() + ... * 1000` — millisecond arithmetic on epoch values,
 * never local-time field math (no "+1 day" on getDate()) — is what keeps a
 * DST transition inside the window from shifting the boundary by an hour:
 * epoch milliseconds have no timezone to fall out of step with.
 */
export function isValidScheduleTime(when, now = new Date()) {
  const target = when instanceof Date ? when : new Date(when);
  if (Number.isNaN(target.getTime())) return false;

  const minMs = now.getTime() + FIELDQUO_SCHEDULE_MIN_MINUTES * 60 * 1000;
  const maxMs = now.getTime() + FIELDQUO_SCHEDULE_MAX_DAYS * 24 * 60 * 60 * 1000;
  const t = target.getTime();
  return t >= minMs && t <= maxMs;
}

// ── Visibility gate ══════════════════════════════════════════════════════
//
// docs/SOCIAL-SCHEDULING.md, "What is hidden and on what signal": Instagram
// and Facebook publishing/scheduling must stay hidden for a real company
// until Meta has approved FieldQuo's app for the `pages_manage_posts` /
// `instagram_content_publish` permissions — there is no path from "not
// approved" to a real post, so a rendered control would be exactly the dead
// button AGENTS.md is built around. A demo company is the one exception: it
// never touches Meta at all (lib/social/mockMetaGraphClient.js), so nothing
// about App Review gates it.
//
// Pure and tiny on purpose — the two booleans it combines (isDemo from
// Company, appConfigured from lib/meta/client.js's metaAppConfigured(),
// which checks META_APP_ID/META_APP_SECRET) are each read from real
// configuration, never a hand-set flag someone forgets to flip. This
// function is the one place the OR between them is spelled out, so every
// caller — the publish route's GET, the calendar page's own guard, the
// Publish button in CampaignEditor.js — asks the identical question.
export function isSocialPublishingVisible({ isDemo, appConfigured }) {
  return Boolean(isDemo) || Boolean(appConfigured);
}
