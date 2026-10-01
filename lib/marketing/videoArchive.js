// lib/marketing/videoArchive.js
//
// Every DECISION the video archive makes, as pure functions: when a video
// post may leave Cloudinary, where its copy goes, whether that copy is proven
// good enough to delete the original, and what a failed restore leaves
// behind. No fetch, no Prisma — scripts/check-video-archive.mjs executes each
// one against hostile cases. The I/O is lib/marketing/videoArchiveServer.js.
//
// ══ Why archive at all (owner-approved 2026-09-29) ═════════════════════════
//
// Cloudinary bills storage monthly for as long as a file is kept: roughly
// 1 credit per GB-month, ≈ US$0.37. A company on one video pack posting 90
// clips of 2:30 a month stores ~5 GB more every month, and none of it ever
// stops costing — by the end of a year that one company is ~60 GB, ≈ US$22 a
// month, for clips that were posted long ago and now live on Instagram,
// Facebook and TikTok's own servers. Cloudflare R2 holds the same bytes for
// ~US$0.015/GB-month with no egress fee (≈ US$0.90/month for those 60 GB),
// and a restore pays no download charge either.
//
// ══ The one rule that matters: never delete without a verified copy ═══════
//
// Deleting from Cloudinary is the only irreversible step in this whole
// feature. So it happens LAST, and only when canRemoveOriginal() says a copy
// exists whose size matches what Cloudinary said it stores, what we streamed,
// and what R2 now reports, AND whose MD5 (R2's ETag for a single PUT) matches
// the MD5 we computed on the way through. A failed copy, a short read, a
// mismatched size or a missing ETag each leave the original exactly where it
// is; the next run tries again.

/** A clip leaves Cloudinary this long after its publishing finished. */
export const ARCHIVE_AFTER_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/** A claim older than this belongs to a run that died (the cron's maxDuration is 300 s). */
export const ARCHIVE_CLAIM_STALE_MS = 15 * 60 * 1000;

/** How long a restore may take to arrive back in Cloudinary before it is called failed. */
export const RESTORE_GIVE_UP_MS = 3 * 60 * 60 * 1000;

// SocialPublish rows that are still on their way: nothing may be archived
// while Meta could still be fetching the file (lib/marketing/videoPost.js
// isOpenVideoPublish, plus "scheduled").
const OPEN_SOCIAL = new Set(["pending", "scheduled", "container_created", "publishing"]);
const DONE_SOCIAL = new Set(["published"]);
// TikTok pulls the file through /api/tiktok/media while a row is pending or
// processing. "inbox_delivered" means TikTok already HAS the file (it sits in
// the creator's drafts, on TikTok's servers), so the pull is finished.
const OPEN_TIKTOK = new Set(["pending", "processing"]);
const DONE_TIKTOK = new Set(["published", "inbox_delivered"]);

function time(value) {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(value);
  const t = d.getTime();
  return Number.isFinite(t) ? t : null;
}

/**
 * May this video post leave Cloudinary now?
 *
 * "The destinations the company selected" are read from the publish rows
 * themselves: FieldQuo records a destination only when someone ticks it and
 * presses Post (one SocialPublish per Instagram/Facebook attempt, one
 * TikTokPublish per TikTok attempt). There is no separate "selected" column
 * to consult, and inventing one would be a second source of truth. So:
 *
 *   - the post must be ready (not uploading, not mid-restore) and not archived;
 *   - it must have gone somewhere — a clip never posted is not "done";
 *   - nothing may be open (scheduled, pending, processing) anywhere;
 *   - for EVERY destination it was sent to, the LATEST attempt must have
 *     finished — a failed or rate-limited last attempt is awaiting a retry,
 *     and the retry needs the file. Only Instagram is fine; all three are not
 *     required;
 *   - and 30 days must have passed since the last of those finished (or
 *     since a restore, whichever is later — a restored clip gets its 30 days
 *     again, or it would be re-archived on the next run before it could be
 *     posted).
 *
 * A canceled SocialPublish is a destination somebody withdrew before it went
 * out; it neither counts as sent nor blocks.
 *
 * @returns {{ eligible: boolean, reason: string, finishedAt: Date|null, eligibleAt: Date|null, destinations: string[] }}
 */
export function archiveEligibility({ post, socialPublishes = [], tiktokPublishes = [], now = new Date(), afterDays = ARCHIVE_AFTER_DAYS } = {}) {
  const out = (eligible, reason, extra = {}) => ({ eligible, reason, finishedAt: null, eligibleAt: null, destinations: [], ...extra });
  if (!post || typeof post !== "object") return out(false, "no_post");
  if (post.archivedAt) return out(false, "already_archived");
  if (post.uploadState && post.uploadState !== "ready") return out(false, "not_ready");
  if (!post.videoPublicId) return out(false, "no_clip");

  const rows = [];
  for (const r of Array.isArray(socialPublishes) ? socialPublishes : []) {
    if (!r || r.status === "canceled") continue;
    rows.push({ destination: String(r.platform || "unknown"), status: r.status, open: OPEN_SOCIAL.has(r.status), done: DONE_SOCIAL.has(r.status), createdAt: time(r.createdAt), doneAt: time(r.publishedAt) ?? time(r.updatedAt) });
  }
  for (const r of Array.isArray(tiktokPublishes) ? tiktokPublishes : []) {
    if (!r) continue;
    rows.push({ destination: "tiktok", status: r.status, open: OPEN_TIKTOK.has(r.status), done: DONE_TIKTOK.has(r.status), createdAt: time(r.createdAt), doneAt: time(r.publishedAt) ?? time(r.updatedAt) });
  }
  if (rows.length === 0) return out(false, "never_posted");
  // An unknown status is neither open nor done — treated as open: we do not
  // know that nothing is still fetching the file.
  if (rows.some((r) => r.open || (!r.done && !isKnownClosed(r.status)))) return out(false, "open_publish");

  const latest = new Map();
  for (const r of rows) {
    const prev = latest.get(r.destination);
    if (!prev || (r.createdAt ?? -Infinity) >= (prev.createdAt ?? -Infinity)) latest.set(r.destination, r);
  }
  const destinations = [...latest.keys()].sort();
  let finished = null;
  for (const r of latest.values()) {
    if (!r.done) return out(false, "awaiting_retry", { destinations });
    // A finished row with no time at all cannot start a clock — never assume.
    if (r.doneAt === null) return out(false, "no_finish_time", { destinations });
    finished = finished === null ? r.doneAt : Math.max(finished, r.doneAt);
  }
  const restored = time(post.archiveRestoredAt);
  const clockStart = restored !== null ? Math.max(finished, restored) : finished;
  const eligibleAt = clockStart + afterDays * DAY_MS;
  const nowMs = time(now);
  const extra = { finishedAt: new Date(finished), eligibleAt: new Date(eligibleAt), destinations };
  if (nowMs === null || nowMs < eligibleAt) return out(false, "too_recent", extra);
  return out(true, "eligible", extra);
}

function isKnownClosed(status) {
  // Terminal but not a success — the "latest attempt" rule decides these.
  return status === "failed" || status === "rate_limited";
}

/** Is a claim on this row still held by a live run? */
export function claimHeld(post, now = new Date()) {
  const at = time(post?.archiveClaimedAt);
  return at !== null && time(now) - at < ARCHIVE_CLAIM_STALE_MS;
}

// ── Where the copy goes ═════════════════════════════════════════════════════

const SAFE_SEGMENT = /^[A-Za-z0-9_-]{1,128}$/;
const SAFE_FORMAT = /^[a-z0-9]{2,5}$/;

/**
 * The R2 key for a post's copy: video-posts/<companyId>/<postId>.<format>.
 * Deterministic, so a re-run after a crash overwrites the same object rather
 * than leaving an orphan, and a post archived again after a restore reuses
 * it. Null for anything that is not a plain id — it becomes an object path.
 */
export function archiveKeyFor({ companyId, id, format }) {
  if (!SAFE_SEGMENT.test(String(companyId || "")) || !SAFE_SEGMENT.test(String(id || ""))) return null;
  const ext = String(format || "").toLowerCase();
  if (!SAFE_FORMAT.test(ext)) return null;
  return `video-posts/${companyId}/${id}.${ext}`;
}

// ── Is the copy good enough to delete the original? ═══════════════════════

/** An S3/R2 ETag → the MD5 hex it carries, or null (multipart, weak, absent). */
export function md5FromEtag(etag) {
  const m = typeof etag === "string" ? etag.trim().match(/^(?:W\/)?"?([a-f0-9]{32})"?$/i) : null;
  return m ? m[1].toLowerCase() : null;
}

const HEX64 = /^[a-f0-9]{64}$/;
const HEX32 = /^[a-f0-9]{32}$/;

/**
 * The verdict on one copy. Every number is required and must agree:
 *
 *   sourceBytes   what Cloudinary's Admin API says it stores
 *   streamedBytes what actually passed through our hashing stream
 *   headBytes     what R2 reports for the object afterwards
 *   md5 / headEtag the MD5 we computed vs R2's ETag
 *   sourceEtag    Cloudinary's own MD5 of the stored file, when it gives one
 *
 * @returns {{ ok: true } | { ok: false, code: string }}
 */
export function verifyCopy({ sourceBytes, streamedBytes, headExists, headBytes, md5, sha256, headEtag, sourceEtag } = {}) {
  const pos = (n) => Number.isSafeInteger(n) && n > 0;
  if (!pos(sourceBytes)) return { ok: false, code: "no_source_size" };
  if (!pos(streamedBytes)) return { ok: false, code: "nothing_streamed" };
  if (streamedBytes !== sourceBytes) return { ok: false, code: "short_read" };
  if (headExists !== true) return { ok: false, code: "copy_missing" };
  if (headBytes !== streamedBytes) return { ok: false, code: "size_mismatch" };
  if (typeof md5 !== "string" || !HEX32.test(md5)) return { ok: false, code: "no_checksum" };
  if (typeof sha256 !== "string" || !HEX64.test(sha256)) return { ok: false, code: "no_checksum" };
  const r2md5 = md5FromEtag(headEtag);
  // A single PUT's ETag IS the MD5 of the object (R2, like S3). No ETag, or
  // one in another shape, is not proof — so it is not accepted as proof.
  if (!r2md5) return { ok: false, code: "no_etag" };
  if (r2md5 !== md5) return { ok: false, code: "checksum_mismatch" };
  // Cloudinary's etag is the MD5 of what it stores: when present it must
  // match too, which proves we copied the stored file and not a CDN variant.
  const cld = md5FromEtag(sourceEtag);
  if (sourceEtag != null && sourceEtag !== "" && cld && cld !== md5) return { ok: false, code: "source_checksum_mismatch" };
  return { ok: true };
}

/**
 * THE gate in front of Cloudinary's destroy. Nothing else in the codebase
 * may decide to remove an archived clip's original.
 */
export function canRemoveOriginal({ verification, copyRecorded, stillEligible }) {
  return verification?.ok === true && copyRecorded === true && stillEligible === true;
}

// ── Restores ═══════════════════════════════════════════════════════════════

/**
 * What a clip's failed arrival writes. For a normal upload the post fails.
 * For a RESTORE the post simply stays archived — the R2 copy is untouched, so
 * nothing is lost and "Restore" can be pressed again — with the reason kept.
 */
export function arrivalFailurePatch(post, code) {
  const c = typeof code === "string" && code ? code.slice(0, 80) : "unexpected";
  if (post?.archivedAt) return { uploadState: "ready", archiveError: `restore_failed: ${c}` };
  return { uploadState: "failed", uploadError: c };
}

/** When a restoring clip (or a new upload) should stop being waited for. */
export function arrivalClockStart(post) {
  return post?.archivedAt && post?.archiveRestoredAt ? post.archiveRestoredAt : post?.createdAt;
}

/** "84.2 MB" — for the screen and the console line. */
export function formatArchiveBytes(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n < 0) return "";
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(2)} GB`;
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}
