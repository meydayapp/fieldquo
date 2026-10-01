// lib/marketing/videoArchiveServer.js
//
// The I/O half of the video archive: Cloudinary → R2 copy, verification,
// removal, restore, and the console's status line. Every decision it acts on
// is in lib/marketing/videoArchive.js. Every outside party — the database,
// Cloudinary, R2, the download — is an injected dependency (`deps`), so
// scripts/check-video-archive.mjs runs this exact code against fakes that
// fail, truncate, lie about sizes and race each other.
//
// ══ The order of one archive, and why ═════════════════════════════════════
//
//   1. CLAIM the row (compare-and-set on archiveClaimedAt). Vercel Cron does
//      not promise at-most-once delivery; two runs must never both copy and
//      both delete.
//   2. RE-READ the post and its publish rows and decide again — a candidate
//      list is minutes old by the time a large clip reaches the front of it.
//   3. Ask Cloudinary's Admin API what it stores (size, format, MD5).
//   4. STREAM the file to R2, hashing it (MD5 + SHA-256) and counting bytes
//      on the way through. Streaming, not buffering: a clip is up to a few
//      hundred MB and a function's memory is not.
//   5. HEAD the R2 object: its size and ETag must equal what we measured.
//   6. RECORD the verified copy on the post (key, size, SHA-256).
//   7. RE-CHECK eligibility — someone may have pressed Post during the copy,
//      and Meta or TikTok would be fetching the file we are about to delete.
//   8. Only now DESTROY in Cloudinary (the asset and every derived version
//      of it — renditions, cover frames), then mark the post archived.
//
// Any failure before 8 removes nothing: the error is written to
// archiveError, the claim is released, and the next run tries again.

import { createHash } from "node:crypto";
import { TransformStream } from "node:stream/web";
import { db } from "@/lib/db";
import { cloudinary } from "@/lib/cloudinary";
import { headObject, presignGetUrl, putObjectStream, r2Config } from "@/lib/media/r2";
import {
  ARCHIVE_AFTER_DAYS,
  ARCHIVE_CLAIM_STALE_MS,
  archiveEligibility,
  archiveKeyFor,
  canRemoveOriginal,
  verifyCopy,
} from "@/lib/marketing/videoArchive";

/** At most this many clips are moved per run — each is a multi-hundred-MB stream. */
export const ARCHIVE_MAX_PER_RUN = 4;
/** No new clip is started after this much of the run has passed (maxDuration 300 s). */
export const ARCHIVE_TIME_BUDGET_MS = 150_000;
/** Candidates looked at per run; every one is stamped so the next run looks at others. */
export const ARCHIVE_CANDIDATES_PER_RUN = 25;
/** Postgres INTEGER — archiveBytes is an Int, like VideoPost.bytes. */
const INT_MAX = 2_147_483_647;

const PUBLISH_FIELDS = { status: true, createdAt: true, publishedAt: true, updatedAt: true };

// ── The database, as the archive needs it ═══════════════════════════════════

export function prismaArchiveStore(prisma = db) {
  const withPublishes = {
    socialPublishes: { select: { ...PUBLISH_FIELDS, platform: true } },
    tiktokPublishes: { select: PUBLISH_FIELDS },
  };
  const split = (row) => {
    if (!row) return null;
    const { socialPublishes = [], tiktokPublishes = [], ...post } = row;
    return { post, socialPublishes, tiktokPublishes };
  };
  return {
    /** Posts that might be due, least-recently-looked-at first. */
    async candidates({ now, take }) {
      const staleClaim = new Date(now.getTime() - ARCHIVE_CLAIM_STALE_MS);
      const rows = await prisma.videoPost.findMany({
        where: {
          archivedAt: null,
          uploadState: "ready",
          OR: [{ archiveClaimedAt: null }, { archiveClaimedAt: { lt: staleClaim } }],
          // A prefilter only — archiveEligibility() is the rule.
          AND: [
            {
              OR: [
                { socialPublishes: { some: { status: "published" } } },
                { tiktokPublishes: { some: { status: { in: ["published", "inbox_delivered"] } } } },
              ],
            },
          ],
        },
        orderBy: [{ archiveCheckedAt: { sort: "asc", nulls: "first" } }, { createdAt: "asc" }],
        take,
        include: withPublishes,
      });
      if (rows.length) {
        await prisma.videoPost.updateMany({ where: { id: { in: rows.map((r) => r.id) } }, data: { archiveCheckedAt: now } });
      }
      return rows.map(split);
    },
    async load(id) {
      return split(await prisma.videoPost.findUnique({ where: { id }, include: withPublishes }));
    },
    /** Compare-and-set: true only for the one run that took it. */
    async claim(id, now) {
      const staleClaim = new Date(now.getTime() - ARCHIVE_CLAIM_STALE_MS);
      const won = await prisma.videoPost.updateMany({
        where: { id, archivedAt: null, OR: [{ archiveClaimedAt: null }, { archiveClaimedAt: { lt: staleClaim } }] },
        data: { archiveClaimedAt: now },
      });
      return won.count === 1;
    },
    async recordCopy(id, claimedAt, { key, bytes, sha256 }) {
      const done = await prisma.videoPost.updateMany({
        where: { id, archiveClaimedAt: claimedAt },
        data: { archiveKey: key, archiveBytes: bytes, archiveSha256: sha256 },
      });
      return done.count === 1;
    },
    async markArchived(id, claimedAt, now) {
      await prisma.videoPost.updateMany({
        where: { id, archiveClaimedAt: claimedAt },
        data: { archivedAt: now, archiveError: null, archiveClaimedAt: null },
      });
    },
    async fail(id, claimedAt, message) {
      await prisma.videoPost.updateMany({
        where: { id, archiveClaimedAt: claimedAt },
        data: { archiveError: String(message).slice(0, 500), archiveClaimedAt: null },
      });
    },
    async release(id, claimedAt) {
      await prisma.videoPost.updateMany({ where: { id, archiveClaimedAt: claimedAt }, data: { archiveClaimedAt: null } });
    },
  };
}

// ── Cloudinary, as the archive needs it ═══════════════════════════════════

export const cloudinarySource = {
  /** What Cloudinary stores for this clip, or { missing: true }. */
  async describe(publicId) {
    try {
      const asset = await cloudinary.api.resource(publicId, { resource_type: "video", type: "upload" });
      return {
        missing: false,
        bytes: Number(asset?.bytes),
        url: typeof asset?.secure_url === "string" ? asset.secure_url : null,
        format: typeof asset?.format === "string" ? asset.format : null,
        etag: typeof asset?.etag === "string" ? asset.etag : null,
      };
    } catch (err) {
      const status = Number(err?.error?.http_code ?? err?.http_code);
      if (status === 404) return { missing: true };
      throw err;
    }
  },
  /**
   * Removes the asset AND its derived versions: Cloudinary's destroy deletes
   * every derived asset of the original with it (the Fit/Crop renditions,
   * the cover-frame JPEGs), and `invalidate` purges the CDN copies so a
   * cached rendition stops being served — and stops being billed.
   * @returns {Promise<string>} Cloudinary's `result` ("ok", "not found", …)
   */
  async destroy(publicId) {
    const res = await cloudinary.uploader.destroy(publicId, { resource_type: "video", type: "upload", invalidate: true });
    return String(res?.result || "unknown");
  },
  /** Starts a server-side upload of `url` into this exact public id (a restore). */
  async restoreFromUrl(url, publicId, { notificationUrl } = {}) {
    return cloudinary.uploader.upload(url, {
      resource_type: "video",
      type: "upload",
      public_id: publicId,
      overwrite: true,
      invalidate: true,
      // Cloudinary fetches the file itself, in the background; the arrival
      // is reported exactly as a new upload's is (cloudinary-notify, or the
      // video screen's own lookup).
      async: true,
      ...(typeof notificationUrl === "string" && /^https:\/\//.test(notificationUrl) ? { notification_url: notificationUrl } : {}),
    });
  },
};

export function r2Store(config) {
  return {
    put: (key, body, opts) => putObjectStream(config, key, body, opts),
    head: (key) => headObject(config, key),
    presign: (key) => presignGetUrl(config, key),
  };
}

/** The production dependencies, or null when R2 is not configured. */
export function archiveDeps(env = process.env) {
  const config = r2Config(env);
  if (!config.ok) return { configured: false, missing: config.missing };
  return { configured: true, store: prismaArchiveStore(db), source: cloudinarySource, r2: r2Store(config), fetchImpl: fetch };
}

// ── One clip ═══════════════════════════════════════════════════════════════

/**
 * Downloads `url` and streams it into R2 at `key`, measuring on the way.
 * @returns {Promise<{ putOk: boolean, error: string|null, streamedBytes: number, md5: string|null, sha256: string|null }>}
 */
export async function streamCopy({ url, key, bytes, contentType, r2, fetchImpl }) {
  let res;
  try {
    res = await fetchImpl(url, { signal: AbortSignal.timeout(240_000) });
  } catch (err) {
    return { putOk: false, error: `download_failed: ${err?.message || err}`, streamedBytes: 0, md5: null, sha256: null };
  }
  if (!res?.ok || !res.body) {
    return { putOk: false, error: `download_failed: HTTP ${res?.status ?? "?"}`, streamedBytes: 0, md5: null, sha256: null };
  }
  // The CDN's own length, when it sends one, must already agree with the
  // Admin API — otherwise this is not the stored file.
  const declared = Number(res.headers?.get?.("content-length"));
  if (Number.isFinite(declared) && declared > 0 && declared !== bytes) {
    await res.body.cancel?.().catch?.(() => {});
    return { putOk: false, error: `source_size_mismatch: CDN ${declared} vs stored ${bytes}`, streamedBytes: 0, md5: null, sha256: null };
  }
  const md5 = createHash("md5");
  const sha = createHash("sha256");
  let streamed = 0;
  const tap = new TransformStream({
    transform(chunk, controller) {
      md5.update(chunk);
      sha.update(chunk);
      streamed += chunk.byteLength;
      controller.enqueue(chunk);
    },
  });
  let put;
  try {
    put = await r2.put(key, res.body.pipeThrough(tap), { bytes, contentType });
  } catch (err) {
    // Includes the runtime refusing a body shorter or longer than `bytes`.
    return { putOk: false, error: `upload_failed: ${err?.cause?.code || err?.message || err}`, streamedBytes: streamed, md5: null, sha256: null };
  }
  return {
    putOk: Boolean(put?.ok),
    error: put?.ok ? null : `upload_failed: ${put?.error || put?.status || "unknown"}`,
    streamedBytes: streamed,
    md5: md5.digest("hex"),
    sha256: sha.digest("hex"),
  };
}

/**
 * Archive one video post, end to end, or leave it exactly as it was.
 * @returns {Promise<{ id: string, outcome: "archived"|"skipped"|"claimed_elsewhere"|"failed"|"kept", reason?: string }>}
 */
export async function archiveOne(id, deps, { now = new Date() } = {}) {
  const { store, source, r2, fetchImpl } = deps;
  if (!(await store.claim(id, now))) return { id, outcome: "claimed_elsewhere" };
  const claimedAt = now;
  const fail = async (reason) => {
    await store.fail(id, claimedAt, reason).catch(() => {});
    return { id, outcome: "failed", reason };
  };

  try {
    const fresh = await store.load(id);
    const verdict = archiveEligibility({ ...(fresh || {}), now });
    if (!verdict.eligible) {
      await store.release(id, claimedAt);
      return { id, outcome: "skipped", reason: verdict.reason };
    }
    const post = fresh.post;

    const asset = await source.describe(post.videoPublicId);
    // Cloudinary no longer has it and we hold no copy: there is nothing to
    // archive and nothing we may claim is archived. Said, not guessed.
    if (asset.missing) return fail("source_missing");
    if (!Number.isSafeInteger(asset.bytes) || asset.bytes <= 0) return fail("no_source_size");
    if (asset.bytes > INT_MAX) return fail("too_large_to_record");
    if (!asset.url) return fail("no_source_url");
    const key = archiveKeyFor({ companyId: post.companyId, id: post.id, format: asset.format });
    if (!key) return fail("bad_key");

    const copy = await streamCopy({ url: asset.url, key, bytes: asset.bytes, contentType: `video/${asset.format === "mov" ? "quicktime" : asset.format}`, r2, fetchImpl });
    if (!copy.putOk) return fail(`copy_failed: ${copy.error}`);

    let head;
    try {
      head = await r2.head(key);
    } catch (err) {
      return fail(`verify_failed: ${err?.message || err}`);
    }
    const verification = verifyCopy({
      sourceBytes: asset.bytes,
      streamedBytes: copy.streamedBytes,
      headExists: head?.exists,
      headBytes: head?.bytes,
      md5: copy.md5,
      sha256: copy.sha256,
      headEtag: head?.etag,
      sourceEtag: asset.etag,
    });
    if (!verification.ok) return fail(`verify_failed: ${verification.code}`);

    const copyRecorded = await store.recordCopy(id, claimedAt, { key, bytes: copy.streamedBytes, sha256: copy.sha256 });

    const again = await store.load(id);
    const stillEligible = archiveEligibility({ ...(again || {}), now: new Date(Math.max(Date.now(), now.getTime())) }).eligible;
    if (!canRemoveOriginal({ verification, copyRecorded, stillEligible })) {
      // The copy is good and stays; the original stays too. Next run decides again.
      await store.release(id, claimedAt);
      return { id, outcome: "kept", reason: !verification.ok ? "unverified" : !copyRecorded ? "claim_lost" : "became_ineligible" };
    }

    const result = await source.destroy(post.videoPublicId);
    // "not found" after we just read it: gone already, and the copy is
    // verified — the post is archived either way.
    if (result !== "ok" && result !== "not found") return fail(`remove_failed: ${result}`);
    await store.markArchived(id, claimedAt, new Date(Math.max(Date.now(), now.getTime())));
    return { id, outcome: "archived", bytes: copy.streamedBytes };
  } catch (err) {
    return fail(`unexpected: ${err?.message || err}`);
  }
}

/**
 * One cron run. Not configured → touches nothing, not even a read.
 */
export async function runArchiveBatch(deps, { now = new Date(), max = ARCHIVE_MAX_PER_RUN, budgetMs = ARCHIVE_TIME_BUDGET_MS, clock = () => Date.now() } = {}) {
  if (!deps?.configured) return { configured: false, missing: deps?.missing || [], looked: 0, results: [] };
  const started = clock();
  const candidates = await deps.store.candidates({ now, take: ARCHIVE_CANDIDATES_PER_RUN });
  const due = candidates.filter((c) => archiveEligibility({ ...c, now }).eligible);
  const results = [];
  for (const c of due) {
    if (results.length >= max) break;
    if (clock() - started > budgetMs) break;
    // Sequential on purpose: one multi-hundred-MB stream at a time.
    results.push(await archiveOne(c.post.id, deps, { now }));
  }
  return { configured: true, looked: candidates.length, due: due.length, results };
}

// ── Restore ═══════════════════════════════════════════════════════════════

/**
 * "Restore to post again": the verified R2 copy is handed to Cloudinary,
 * which fetches it into the SAME public id — so every URL the post builds
 * (sendUrl, frameUrl) is right again the moment it arrives, and the arrival
 * is settled by the same code a new upload's is (settleArrival), which also
 * counts it as one of this month's videos: it is converted and stored in
 * Cloudinary again, which is the cost the allowance exists to cover.
 *
 * @returns {Promise<{ ok: true } | { ok: false, status: number, code: string }>}
 */
export async function restoreFromArchive(post, deps, { now = new Date(), notificationUrl = null, prisma = db } = {}) {
  if (!post?.archivedAt) return { ok: false, status: 409, code: "not_archived" };
  if (post.uploadState !== "ready") return { ok: false, status: 409, code: "already_restoring" };
  if (!deps?.configured) return { ok: false, status: 503, code: "archive_unavailable" };
  if (!post.archiveKey || !Number.isSafeInteger(post.archiveBytes)) return { ok: false, status: 409, code: "archive_copy_missing" };

  let head;
  try {
    head = await deps.r2.head(post.archiveKey);
  } catch {
    return { ok: false, status: 503, code: "archive_unavailable" };
  }
  if (!head.exists || head.bytes !== post.archiveBytes) {
    await prisma.videoPost.updateMany({ where: { id: post.id }, data: { archiveError: `restore_failed: copy_missing_or_changed` } }).catch(() => {});
    return { ok: false, status: 409, code: "archive_copy_missing" };
  }

  const won = await prisma.videoPost.updateMany({
    where: { id: post.id, archivedAt: { not: null }, uploadState: "ready" },
    data: { uploadState: "processing", uploadError: null, uploadCheckedAt: null, archiveError: null, archiveRestoredAt: now },
  });
  if (won.count !== 1) return { ok: false, status: 409, code: "already_restoring" };

  try {
    const url = await deps.r2.presign(post.archiveKey);
    await deps.source.restoreFromUrl(url, post.videoPublicId, { notificationUrl });
  } catch (err) {
    console.error("[video-archive] restore request failed:", err?.message);
    // Back to archived — the copy is untouched, the button works again.
    await prisma.videoPost.updateMany({
      where: { id: post.id, uploadState: "processing" },
      data: { uploadState: "ready", archiveError: "restore_failed: cloudinary_refused" },
    });
    return { ok: false, status: 503, code: "cloudinary_unavailable" };
  }
  return { ok: true };
}

// ── The console's line ═══════════════════════════════════════════════════════

/** For /platform/costs: configured or not (with the names), and what has moved. */
export async function videoArchiveStatus({ prisma = db, env = process.env } = {}) {
  const config = r2Config(env);
  const [archived, sum, failing, lastFailure] = await Promise.all([
    prisma.videoPost.count({ where: { archivedAt: { not: null } } }),
    prisma.videoPost.aggregate({ where: { archivedAt: { not: null } }, _sum: { archiveBytes: true } }),
    prisma.videoPost.count({ where: { archivedAt: null, archiveError: { not: null } } }),
    prisma.videoPost.findFirst({
      where: { archivedAt: null, archiveError: { not: null } },
      orderBy: { updatedAt: "desc" },
      select: { archiveError: true, updatedAt: true },
    }),
  ]);
  return {
    configured: config.ok,
    missing: config.ok ? [] : config.missing,
    afterDays: ARCHIVE_AFTER_DAYS,
    archived,
    archivedBytes: sum?._sum?.archiveBytes || 0,
    failing,
    lastError: lastFailure?.archiveError || null,
  };
}
