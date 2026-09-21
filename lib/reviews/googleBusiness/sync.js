// lib/reviews/googleBusiness/sync.js
//
// Refreshing a company's Google reviews into the GoogleReview cache, and
// turning Google's refusals into sentences.
//
// ── This is a cache, and the policies decide its shape ───────────────────────
//
// The Business Profile API policies allow Content to be stored for at most
// thirty days, unaltered, attributed, and only to improve the project's own
// performance. docs/ROADMAP.md's research entry has the quotes. Every rule
// below follows from one of them:
//
//   • a refresh REPLACES what it finds and DELETES what Google no longer
//     returns — the only way an edited or removed review gets honoured, since
//     there is no webhook;
//   • any row older than thirty days is deleted whether or not the refresh
//     ran — a company whose token expired must not keep the words for ever;
//   • nothing writes to `comment` except this file, and the screen has no
//     edit control for a Google row;
//   • rows are never copied into Testimonial. `Testimonial.source` exists so
//     the two can never be confused.
//
// ── Quota 0 is the expected first answer ─────────────────────────────────────
//
// A project Google has not yet approved gets a 429 RESOURCE_EXHAUSTED on the
// very first call, worded as if the company were over a limit. It is not; the
// limit is zero. quotaMessage() says so in words the owner can act on and
// keeps Google's own sentence beside it, because the two things a person
// needs at that moment are "this is expected" and "here is what Google
// actually said".
//
// Takes `db` and `google` as arguments so scripts/check-reviews-google.mjs can
// execute the whole refresh against the memory fixture and a scripted fake.

import { db as realDb } from "@/lib/db";
import { defaultBusinessGoogle, fullLocationName } from "./client";
import { recordBusinessSyncOutcome } from "./connection";

export const CACHE_DAYS = 30;
const DAY = 24 * 60 * 60 * 1000;

const STARS = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };

/**
 * One review as Google sends it → one cache row. Pure. Returns null for a
 * shape that cannot be a review (no name, no rating), never a padded row —
 * absence of a rating is not a three-star review.
 */
export function mapGoogleReview(raw, { fetchedAt = new Date() } = {}) {
  if (!raw || typeof raw !== "object") return null;
  const reviewName = typeof raw.name === "string" ? raw.name.trim() : "";
  const stars = STARS[String(raw.starRating || "").toUpperCase()] || null;
  if (!reviewName || !stars) return null;
  const created = new Date(raw.createTime);
  if (Number.isNaN(created.getTime())) return null;
  const updated = raw.updateTime ? new Date(raw.updateTime) : null;
  const reviewer = raw.reviewer && typeof raw.reviewer === "object" ? raw.reviewer : {};
  const reviewerName =
    reviewer.isAnonymous || typeof reviewer.displayName !== "string" || !reviewer.displayName.trim()
      ? "A Google user"
      : reviewer.displayName.trim().slice(0, 120);
  return {
    reviewName,
    reviewerName,
    starRating: stars,
    // Exactly Google's words, trimmed of nothing but outer whitespace — the
    // policies say unaltered, and a review with no words is a rating alone.
    comment: typeof raw.comment === "string" && raw.comment.trim() ? raw.comment.trim().slice(0, 4096) : null,
    replyComment:
      raw.reviewReply && typeof raw.reviewReply.comment === "string" && raw.reviewReply.comment.trim()
        ? raw.reviewReply.comment.trim().slice(0, 4096)
        : null,
    reviewCreateTime: created,
    reviewUpdateTime: updated && !Number.isNaN(updated.getTime()) ? updated : null,
    fetchedAt,
  };
}

/**
 * Google's refusal → the sentence the settings page prints. Pure.
 *
 * @returns {{ kind: "quota"|"scope"|"auth"|"other", message: string }}
 */
export function quotaMessage(result) {
  const status = Number(result?.status) || 0;
  const said = String(result?.message || "").trim();
  const reason = String(result?.reason || "").toUpperCase();
  const quotaWorded = /quota|RESOURCE_EXHAUSTED|rate ?limit/i.test(`${said} ${reason}`);

  if (status === 429 || (status === 403 && quotaWorded)) {
    return {
      kind: "quota",
      message:
        `Google has not yet given this project access to the Business Profile API — new projects start with a quota of 0, and that is what this refusal is. ` +
        `The application steps are in docs/GOOGLE-BUSINESS-PROFILE.md. Until it is approved, paste your reviews in below. ` +
        `Google said: "${said || "Quota exceeded"}"`,
    };
  }
  if (status === 403) {
    return {
      kind: "scope",
      message:
        `Google refused the request. The connected account must be an owner or manager of the listing, and the consent must have included Business Profile access. ` +
        `Google said: "${said || "Permission denied"}"`,
    };
  }
  if (status === 401 || /invalid_grant|token/i.test(said)) {
    return {
      kind: "auth",
      message: `The connection to Google has expired. Disconnect and connect again. Google said: "${said || "Unauthorised"}"`,
    };
  }
  return { kind: "other", message: `Google answered ${status || "with a network error"}: "${said || "no detail"}"` };
}

/**
 * Refresh one company's cache.
 *
 * @returns {{ ok:true, fetched:number, removed:number }|{ ok:false, kind:string, message:string }}
 */
export async function refreshCompanyReviews(connection, { db = realDb, google = defaultBusinessGoogle, now = new Date() } = {}) {
  if (!connection?.companyId) return { ok: false, kind: "other", message: "No connection." };
  const companyId = connection.companyId;

  // The thirty-day purge runs whether or not the fetch below succeeds. A
  // company whose token died a month ago has, at this point, no right to the
  // words any more.
  const stale = new Date(now.getTime() - CACHE_DAYS * DAY);
  const purged = await db.googleReview.deleteMany({ where: { companyId, fetchedAt: { lt: stale } } });

  const locationName = fullLocationName(connection.accountName, connection.locationName);
  if (!locationName) {
    return { ok: false, kind: "no_location", message: "Pick which listing to read reviews from first.", removed: purged.count };
  }

  let token;
  try {
    token = await google.accessTokenFor(connection);
  } catch (err) {
    const message = `Stored token could not be read: ${err?.message || "unknown"}`;
    await recordBusinessSyncOutcome(companyId, { error: message }, db);
    return { ok: false, kind: "auth", message };
  }
  if (!token?.ok) {
    const { kind, message } = quotaMessage(token);
    await recordBusinessSyncOutcome(companyId, { error: message }, db);
    return { ok: false, kind, message };
  }

  const seen = new Set();
  let fetched = 0;
  let pageToken = null;
  do {
    const page = await google.listReviews({ accessToken: token.accessToken, locationName, pageToken });
    if (!page.ok) {
      const { kind, message } = quotaMessage(page);
      await recordBusinessSyncOutcome(companyId, { error: message }, db);
      return { ok: false, kind, message };
    }
    for (const raw of Array.isArray(page.data?.reviews) ? page.data.reviews : []) {
      const row = mapGoogleReview(raw, { fetchedAt: now });
      if (!row) continue;
      seen.add(row.reviewName);
      fetched++;
      await db.googleReview.upsert({
        where: { companyId_reviewName: { companyId, reviewName: row.reviewName } },
        create: { companyId, ...row },
        // showOnSite is the company's decision and survives a refresh; every
        // other field is Google's and is replaced.
        update: { ...row },
      });
    }
    pageToken = page.data?.nextPageToken || null;
  } while (pageToken);

  // Gone from Google → gone from here.
  const gone = await db.googleReview.deleteMany({
    where: { companyId, ...(seen.size ? { reviewName: { notIn: Array.from(seen) } } : {}) },
  });

  await recordBusinessSyncOutcome(companyId, {}, db);
  return { ok: true, fetched, removed: purged.count + gone.count };
}
