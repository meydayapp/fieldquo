// lib/sales/repStats.js
//
// A rep's own signup link, and how many companies it has brought in.
//
// ══ Why the link IS the claim ═════════════════════════════════════════════
//
// The open question was whether a rep should be able to claim a company they
// closed by phone. The owner's answer removes the question rather than
// answering it: a rep hands out a link, the link carries their code, and
// attribution happens at signup — the same shape the contractor-to-contractor
// referral programme already uses.
//
// That is better than a claim flow, and not only simpler. A claim is a rep
// asserting something about a company; a link is the COMPANY acting, and the
// rep's code merely rides along. So the property that matters holds for free:
// a rep still has no write path to SalesAttribution, and cannot pay themselves
// by asserting a relationship that did not happen.
//
// ══ Why the counts are computed here and not stored ═══════════════════════
//
// "Daniel signed up ten companies today" is a question about attribution rows,
// and attribution rows already exist and are already locked. A counter column
// would be a second answer that can drift from the first, and the one nobody
// looks at is the one that rots — the same argument lib/voice/credits.js makes
// for summing a balance rather than storing it.
import { db } from "@/lib/db";

/**
 * The link a rep hands out.
 *
 * Built from the app origin rather than hard-coded, so a preview deployment
 * hands out a preview link instead of silently pointing testers at production.
 */
export function signupLinkFor(origin, code) {
  if (!origin || !code) return null;
  return `${String(origin).replace(/\/+$/, "")}/signup?sales=${encodeURIComponent(code)}`;
}

/**
 * Split a list of attribution timestamps into day / week / total.
 *
 * Pure, and takes already-loaded rows, so the boundary arithmetic can be
 * executed against hostile input — a signup at 23:59, one at 00:00, one in a
 * different month — rather than only read.
 *
 * ── On the day boundary ──────────────────────────────────────────────────
 *
 * UTC, matching lib/analytics/periodPresets.js. A rep in Kyiv and an owner in
 * Gatineau otherwise disagree about what "today" means, and a leaderboard that
 * changes depending on who is looking at it is worse than no leaderboard. The
 * cost is that a rep's "today" is not their local day; that is a known,
 * deliberate trade and the UI should say "today (UTC)" rather than pretend.
 */
export function bucketSignups(capturedAtList, now = new Date()) {
  const rows = Array.isArray(capturedAtList) ? capturedAtList : [];

  const startOfDay = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const startOfWeek = new Date(startOfDay);
  // Monday-based, matching the payout batch week.
  const dow = (startOfDay.getUTCDay() + 6) % 7;
  startOfWeek.setUTCDate(startOfWeek.getUTCDate() - dow);

  let today = 0;
  let thisWeek = 0;
  let total = 0;

  for (const raw of rows) {
    const at = raw instanceof Date ? raw : new Date(raw);
    if (Number.isNaN(at.getTime())) continue;
    total += 1;
    if (at >= startOfWeek) thisWeek += 1;
    if (at >= startOfDay) today += 1;
  }

  return { today, thisWeek, total, dayStartsAt: startOfDay, weekStartsAt: startOfWeek };
}

/**
 * The db half. Reads attribution rows, not a counter.
 *
 * Scoped to the one rep. A rep must never be able to read another rep's
 * numbers from their own portal — the leaderboard, when it exists, is a
 * separate decision with its own visibility rules.
 */
export async function repSignupStats(salesRepId, now = new Date()) {
  if (!salesRepId) return bucketSignups([], now);
  const rows = await db.salesAttribution.findMany({
    where: { salesRepId },
    select: { capturedAt: true },
  });
  return bucketSignups(rows.map((r) => r.capturedAt), now);
}
