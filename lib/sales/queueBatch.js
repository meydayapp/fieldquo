// lib/sales/queueBatch.js
//
// A rep's day, claimed in one press — and given back at the end of it.
//
// ══ Why a batch, when the queue was built to hand out one at a time ═══════
//
// The owner, on the live screen: "they should not need to get 1 claimed at a
// time — that would mean instead of 100–150 calls per day it might come down
// to 30 because they need to claim each lead individually. They should be able
// to claim batches of 100 at a time. And any leads not contacted do have the
// release at the end."
//
// The one-at-a-time rule was never about the NUMBER. It was about the pool:
// a rep who can read the pool cherry-picks it, so the server picks and the
// rep takes what it picked. That rule is intact here. Nothing in this file
// returns an unclaimed row to a rep — the selection reads the pool, decides,
// writes the lease, and hands back only the rows the write WON. A hundred
// picks by the server is still the server picking.
//
// ══ The order the batch is dialled in ═════════════════════════════════════
//
// Callable soonest first. The owner, again on the live screen: a rep fetching
// a hundred leads at eight in the morning Eastern should be handed Eastern
// and Atlantic rows, "and not have a lead from California accidentally" —
// and a second batch claimed at half past eleven should be what has opened
// by then. So the first key is the calling window, read from
// lib/sales/callingRules.js for every candidate: rows callable NOW, the one
// that shuts soonest first (Atlantic before Pacific in the afternoon), then
// rows that open later, earliest opening first.
//
// INSIDE each of those: a DUE RETRY — a row somebody already dialled, whose
// lib/sales/retryRules.js instant has arrived — before a fresh row, because
// the rotation aimed it at THIS part of the day and a fresh row can be rung
// in any; then the BEST-WINDOW SCORE (lib/sales/callWindowScore.js: 3–4 pm
// in the prospect's zone, then 10–11 am, then the rest; Wednesday over
// Friday — the owner's 2026-09-13 numbers from Belkins' benchmark) so a
// top-up at 3 pm Eastern hands out Eastern rows before Central ones at 2 pm;
// then the closing time; then rows this rep gave back untouched in the last seven
// days sort after the rest, so tomorrow's hundred is not today's hundred
// wearing a new date; then researched rows — a row with `lastCrawledAt` and
// at least one capability or opportunity is one the rep can open with a fact
// rather than a guess — before unresearched; then the pool's own order
// (oldest first, so it drains; never by a score nothing writes). Research
// used to be the FIRST key. It was demoted below callability on the owner's
// word: a researched row nobody may ring for three hours is worth less to a
// rep with a headset on than an unresearched one they can ring now.
//
// `position` on the claim row records that order, because a hundred rows
// written with one `assignedAt` have no order of their own, and the
// autodialler that walks the batch next needs one that survives a reload.
// The screen regroups the held rows by window as the clock moves
// (lib/sales/queueWindows.js); inside a group it keeps this position.
//
// ══ The window rule: open before the SHIFT ends ═══════════════════════════
//
// A batch of a hundred New York prospects claimed at eight in the evening in
// Toronto is a batch nobody can call. So a candidate is only taken if
// salesCallReadiness says it is callable NOW, or says it is refused ONLY
// because the window is shut and names an opening instant before the rep's
// shift ends. Anything else — an unread jurisdiction, a prohibition, an
// unknown zone — is left in the pool, because a lease on a row nobody may
// ring is a lease that only blocks the rep who could have taken it once the
// jurisdiction is read.
//
// "The rep's shift" is SHIFT_HOURS from the moment they first went Available
// today, read from the SalesRepActivity ledger in the zone the rep's browser
// reported with the request — the owner's framing: "sorted so it properly
// gets queued, based on the time the sales rep logged in". A rep who claims
// before pressing Available has no such row yet, and the claim instant
// stands in for it. Until 2026-09-11 the bound was the rep's local MIDNIGHT,
// which let an 8 am Eastern batch carry Pacific rows that open at eleven and
// Hawaiian rows that open at two: all "today", none of them this morning.
//
// Nothing on SalesRep records a zone (there is no column), and the prospect's
// zone is the wrong one: it is the REP who goes home. The zone travels with
// the claim so the day-end release below judges the same day the claim was
// judged against.
//
// ══ Two ceilings, both server-side ════════════════════════════════════════
//
// QUEUE_BATCH_MAX is the owner's number for one press. QUEUE_DAILY_CLAIM_CAP
// is the day's ceiling, counted from the claim LOG — every claim taken today,
// released or not — so claim-release-claim cannot walk past it. The browser
// sends neither; it asks, and the server decides.
//
// ══ Release ═══════════════════════════════════════════════════════════════
//
// A claimed row with no call attempt since it was claimed is "untouched". The
// rep can give every untouched row back in one press (Release the rest), and
// app/api/cron/sales-queue-release does the same for every rep whose local day
// has ended, once an hour. A row with an attempt is kept — the rep started on
// it — and a worked row is never in scope at all. Released rows go back to
// unclaimed; the claim row records when and why. Nothing is deleted.
//
// ══ Why the db is a parameter ═════════════════════════════════════════════
//
// scripts/check-sales-batch-claim.mjs runs the claim and the release against
// a scripted db under bare node: it hands in two reps racing for the same
// rows and reads which one the counting says won. That is only possible if
// the client is injected. The route passes the real one.

import {
  CALL_ALLOWED,
  CALL_REFUSED,
  CALL_UNKNOWN,
  FIELDQUO_COURTESY_WINDOW,
  jurisdictionFor,
  salesCallReadiness,
  zoneAgreement,
  zonesFor,
} from "./callingRules";
import { localTimeIn } from "./callingWindow";
import { callingWindowFor, windowScore } from "./callWindowScore";
import { resolveLeadTimeZone } from "./leadTimeZone";
import { windowPolicyFor } from "./windowPolicy";
import { STATE_AVAILABLE } from "./calls/agentState";
import { claimCandidateWhere, claimExpiryFrom } from "./prospectView";
import { languageExcludedWhereFor } from "./leadLanguage";

/**
 * One press — and one top-up. The owner's number, revised 2026-09-11: "a
 * batch of 25, and if there are fewer than 5 leads left it auto-fetches a
 * new set from the current time". A hundred at a time was the day; twenty-
 * five at a time is the next hour, taken from what is OPEN at that instant,
 * so a rep at 9:20 pm Eastern is handed Pacific rows rather than a batch
 * of shut Eastern ones. The daily cap below is unchanged.
 */
export const QUEUE_BATCH_MAX = 25;
/** The held-and-callable count under which the console tops the batch up. */
export const QUEUE_TOP_UP_BELOW = 5;
/** The console asks for a top-up at most this often. */
export const QUEUE_TOP_UP_MIN_INTERVAL_MS = 60 * 1000;
/**
 * One rep, one local day, every claim counted whether or not it was kept.
 *
 * The owner's arithmetic: "an average person can take 200 calls with the
 * autodialer per day on a 7-hour shift with lunch and break", in batches of
 * a hundred. 200 dials need more than 200 rows — no-answers and redials eat
 * some, and a rep at 199 with an hour left should not be told the day is
 * over — so the ceiling is 250: two full batches and a top-up. It was 150,
 * the top of an earlier stated range, which contradicted the 200.
 */
export const QUEUE_DAILY_CLAIM_CAP = 250;
/**
 * How long a rep's shift is, from the moment they first went Available today.
 *
 * Seven hours, lunch and breaks inside it, ~200 dials — the owner's numbers,
 * quoted above QUEUE_DAILY_CLAIM_CAP. A row whose window opens after this
 * many hours from the shift's start is tomorrow's row, not today's, and is
 * left in the pool for whoever is on shift when it opens.
 */
export const SHIFT_HOURS = 7;
/** A row this rep released untouched sorts last for them for this long. */
export const RELEASE_DEPRIORITISE_DAYS = 7;
/**
 * How far into the pool one press reads before deciding. Per bucket, so a
 * pool whose first 400 researched rows are all in a closed jurisdiction still
 * yields a batch from the rest. Bounded because every candidate is judged by
 * salesCallReadiness in JS, and an unbounded read of a 50,000-row trade is a
 * request that times out.
 */
export const CANDIDATE_SCAN = 400;

/** The release reasons that de-prioritise a row for the rep who released it. */
export const DEPRIORITISING_RELEASES = Object.freeze(["rep", "rest", "day_end"]);

/**
 * Every value `releaseReason` may hold.
 *
 * "admin" and "reassigned" are the platform console's two: a superadmin gave
 * the rows back for a rep who disconnected (app/api/platform/sales/reps/[id]/
 * queue), or moved them to another rep (lib/sales/reassign.js). Neither
 * de-prioritises the row for the rep who held it — nobody chose to give it
 * back, which is the same reasoning "lapsed" gets below — and both are written
 * through the SAME release/claim writes the rep's own buttons use, so the log
 * reads as one history rather than two.
 */
export const RELEASE_REASONS = Object.freeze(["rep", "rest", "day_end", "lapsed", "admin", "reassigned", "closed"]);

/**
 * Why a batch came back smaller than asked, as a catalogue key the screen can
 * say. The English is beside each so a check can read it; the screen never
 * prints the English on a translated portal.
 */
export const BATCH_REASON_KEYS = Object.freeze({
  daily_cap: "app.salesQueue.batchReason.dailyCap",
  pool_empty: "app.salesQueue.batchReason.poolEmpty",
  none_callable_today: "app.salesQueue.batchReason.noneCallableToday",
  contended: "app.salesQueue.batchReason.contended",
  // The pool has rows for this trade and every one of them is shut at this
  // instant. Carries nextOpensAt — the earliest opening among them.
  none_open_now: "app.salesQueue.batchReason.noneOpenNow",
  // Fewer than a full batch were open now; the rest open later.
  partial_open: "app.salesQueue.batchReason.partialOpen",
});

const DAY_MS = 24 * 60 * 60 * 1000;

const isDate = (v) => v instanceof Date && !Number.isNaN(v.getTime());

/**
 * A stated zone Intl can actually read, or null.
 *
 * The browser sends `Intl.DateTimeFormat().resolvedOptions().timeZone`. A
 * typo or a hostile value would otherwise become the zone a compliance
 * decision is made in; localTimeIn is the same gate salesCallReadiness uses.
 */
export function usableTimeZone(timeZone, now = new Date()) {
  if (typeof timeZone !== "string") return null;
  const zone = timeZone.trim();
  if (!zone || zone.length > 64) return null;
  return localTimeIn(zone, now) ? zone : null;
}

/** "YYYY-MM-DD" in the zone, from one formatted read. Null for a bad zone. */
export function localDateIn(timeZone, now = new Date()) {
  if (typeof timeZone !== "string" || !timeZone.trim()) return null;
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
    const get = (type) => parts.find((p) => p.type === type)?.value;
    const y = get("year");
    const m = get("month");
    const d = get("day");
    if (!y || !m || !d) return null;
    return `${y}-${m}-${d}`;
  } catch {
    return null;
  }
}

/**
 * The next local midnight in the zone — the end of the rep's day.
 *
 * Stepped rather than solved, the way nextOpening() is: the first guess is
 * "now plus what is left of the day by the local clock", then it is nudged in
 * minute steps until the local date has actually changed and had not one
 * minute earlier. A DST transition tonight makes the first guess an hour off;
 * the nudge absorbs it without this file learning what DST is.
 */
export function endOfLocalDay(timeZone, now = new Date()) {
  const today = localDateIn(timeZone, now);
  const local = localTimeIn(timeZone, now);
  if (!today || !local) return null;
  const MINUTE = 60 * 1000;
  let t = Math.floor(now.getTime() / MINUTE) * MINUTE + (24 * 60 - local.minute) * MINUTE;
  // Two hours either side is more than any transition moves a clock.
  const lo = t - 2 * 60 * MINUTE;
  const hi = t + 2 * 60 * MINUTE;
  // Walk back while the previous minute is already tomorrow…
  while (t > lo && localDateIn(timeZone, new Date(t - MINUTE)) !== today) t -= MINUTE;
  // …then forward while this minute is still today.
  while (t < hi && localDateIn(timeZone, new Date(t)) === today) t += MINUTE;
  const end = new Date(t);
  if (localDateIn(timeZone, end) === today) return null;
  return end;
}

/**
 * The local midnight that STARTED the rep's day — the counterpart of
 * endOfLocalDay(), stepped the same way for the same DST reason.
 */
export function startOfLocalDay(timeZone, now = new Date()) {
  const today = localDateIn(timeZone, now);
  const local = localTimeIn(timeZone, now);
  if (!today || !local) return null;
  const MINUTE = 60 * 1000;
  let t = Math.floor(now.getTime() / MINUTE) * MINUTE - local.minute * MINUTE;
  const lo = t - 2 * 60 * MINUTE;
  const hi = t + 2 * 60 * MINUTE;
  // Walk forward while this minute is still yesterday…
  while (t < hi && localDateIn(timeZone, new Date(t)) !== today) t += MINUTE;
  // …then back while the previous minute is already today.
  while (t > lo && localDateIn(timeZone, new Date(t - MINUTE)) === today) t -= MINUTE;
  const start = new Date(t);
  if (localDateIn(timeZone, start) !== today) return null;
  return start;
}

/**
 * When the rep's shift started today: the first moment they went Available
 * in their local day, from the SalesRepActivity ledger. Null when there is no
 * such row — a rep claiming before they have pressed Available — and null
 * when the client has no ledger at all (a scripted db), which callers treat
 * the same way: the claim instant is the best-known start.
 *
 * The FIRST Available row of the day, not the latest: a rep who went to lunch
 * and came back did not start a new shift. Rows are read from the start of
 * the rep's local day in the zone the browser sent; with no usable zone the
 * last 24 hours stand in, which is the same bound claimBatch uses for the
 * day's end in that case.
 */
export async function shiftStartFor({ db, salesRepId, timeZone = null, now = new Date() } = {}) {
  if (!salesRepId || typeof db?.salesRepActivity?.findFirst !== "function") return null;
  const zone = usableTimeZone(timeZone, now);
  const from = (zone && startOfLocalDay(zone, now)) || new Date(now.getTime() - DAY_MS);
  const row = await db.salesRepActivity.findFirst({
    where: { salesRepId, state: STATE_AVAILABLE, startedAt: { gte: from, lte: now } },
    orderBy: { startedAt: "asc" },
    select: { startedAt: true },
  });
  return isDate(row?.startedAt) ? row.startedAt : null;
}

/** The shift's end: SHIFT_HOURS after it started, or after `now` if it has not. */
export function shiftEndFrom({ shiftStart = null, now = new Date() } = {}) {
  const start = isDate(shiftStart) && shiftStart.getTime() <= now.getTime() ? shiftStart : now;
  return new Date(start.getTime() + SHIFT_HOURS * 60 * 60 * 1000);
}

/**
 * Whether the calling window is open at some instant between now and dayEnd —
 * which is the rep's SHIFT end (shiftEndFrom), not their midnight; the
 * parameter keeps its name because it is "the end of what this rep works
 * today" either way, and three checks call it by it.
 *
 * Reads only what salesCallReadiness already decided. Allowed now is yes. A
 * refusal or an unknown whose ONLY blockers are the shut window or a split
 * zone, and whose `opensAt` lands before the shift ends, is yes — the rep can
 * come back to it this afternoon. Everything else is no: a prohibition, an
 * unread jurisdiction, an unknown zone, or a window that opens after they
 * have gone home.
 */
export function callableBeforeDayEnd({ readiness, dayEnd } = {}) {
  if (!readiness) return false;
  if (readiness.decision === CALL_ALLOWED) return true;
  if (readiness.decision !== CALL_REFUSED && readiness.decision !== CALL_UNKNOWN) return false;
  const codes = (readiness.blockers || []).map((b) => b?.code);
  if (codes.length === 0) return false;
  if (!codes.every((c) => c === "outside_window" || c === "time_zone_ambiguous")) return false;
  if (!isDate(readiness.opensAt) || !isDate(dayEnd)) return false;
  return readiness.opensAt.getTime() < dayEnd.getTime();
}

/**
 * When an open window shuts — the counterpart of callingRules' nextOpening().
 *
 * Null when the window is not open now, when the zones are unknown, or when
 * nothing shuts it within a day (which no window in the table does).
 */
export function nextClosing({ prospect = {}, timeZone = null, now = new Date() } = {}) {
  const jurisdiction = jurisdictionFor(prospect);
  if (!jurisdiction || jurisdiction.prohibition) return null;
  const window = jurisdiction.window || FIELDQUO_COURTESY_WINDOW;
  const stated = usableTimeZone(timeZone, now);
  const zones = stated ? [stated] : zonesFor(prospect);
  if (zones.length === 0 || zoneAgreement(window, zones, now) !== true) return null;
  const STEP = 5 * 60 * 1000;
  let t = Math.ceil(now.getTime() / STEP) * STEP;
  const limit = now.getTime() + DAY_MS;
  while (t <= limit) {
    const at = new Date(t);
    if (zoneAgreement(window, zones, at) !== true) return at;
    t += STEP;
  }
  return null;
}

/**
 * Whether a prospect row counts as researched.
 *
 * The row must have been crawled AND something must have come of it: a crawl
 * that found nothing leaves a rep with the same blank they had before it.
 * Accepts either loaded relations or Prisma's `_count`, so the same rule
 * reads a list row and a candidate row.
 */
export function isResearched(prospect = {}) {
  if (!prospect?.lastCrawledAt) return false;
  const count = prospect._count || {};
  const caps = Array.isArray(prospect.capabilities)
    ? prospect.capabilities.length
    : Number(count.capabilities) || 0;
  const opps = Array.isArray(prospect.opportunities)
    ? prospect.opportunities.length
    : Number(count.opportunities) || 0;
  return caps > 0 || opps > 0;
}

/** The Prisma `where` fragment for isResearched(), for the candidate read. */
export function researchedWhere() {
  return {
    lastCrawledAt: { not: null },
    OR: [{ capabilities: { some: {} } }, { opportunities: { some: {} } }],
  };
}

/** The complement — crawled with nothing to show, or never crawled. */
export function unresearchedWhere() {
  return {
    OR: [
      { lastCrawledAt: null },
      { AND: [{ capabilities: { none: {} } }, { opportunities: { none: {} } }] },
    ],
  };
}

/**
 * The claim-log condition for "this rep gave this row back recently".
 * Spread into a Prospect `where` as `queueClaims: { some: … }` / `none`.
 */
export function recentlyReleasedByWhere(salesRepId, now = new Date()) {
  return {
    salesRepId,
    releaseReason: { in: [...DEPRIORITISING_RELEASES] },
    releasedAt: { gte: new Date(now.getTime() - RELEASE_DEPRIORITISE_DAYS * DAY_MS) },
  };
}

/**
 * The window key a candidate sorts by: callable now before opening later,
 * and inside each the instant that matters — when it shuts, or when it opens.
 * A row with no such instant sorts to the end of its tier rather than being
 * given one: absence of a closing time is not a late closing time.
 */
export function windowSortKey({ readiness = null, closesAt = null } = {}) {
  if (readiness?.decision === CALL_ALLOWED) {
    return { tier: 0, at: isDate(closesAt) ? closesAt.getTime() : Number.POSITIVE_INFINITY };
  }
  return { tier: 1, at: isDate(readiness?.opensAt) ? readiness.opensAt.getTime() : Number.POSITIVE_INFINITY };
}

/**
 * The order and the cut, pure.
 *
 * @param candidates rows shaped `{ id, createdAt, researched, recentlyReleased,
 *                   readiness, closesAt, retryDue, windowScore }` — `readiness` is salesCallReadiness's
 *                   answer for that row at `now`; `closesAt` is nextClosing()'s
 *                   when the window is open now, else null; `windowScore` is
 *                   lib/sales/callWindowScore.js's for the row's zone, else null.
 * @param shiftEnd   the end of the rep's shift (shiftEndFrom). `dayEnd` is
 *                   accepted as the older name for the same instant.
 * @param want       how many may be taken — min(batch max, what is left of the
 *                   daily cap), decided by the caller from the log.
 * @returns `{ ids, researched, unresearched, skippedForWindow }` — `ids` in
 *          dial order.
 */
export function selectBatch({ candidates = [], shiftEnd = null, dayEnd = null, want = QUEUE_BATCH_MAX } = {}) {
  const until = shiftEnd || dayEnd;
  const max = Math.max(0, Math.min(Number(want) || 0, QUEUE_BATCH_MAX));
  let skippedForWindow = 0;
  const eligible = [];
  // The earliest opening among the rows NOT taken, so a short batch can say
  // "more open at 8:00 AM". Null when nothing skipped names one.
  let nextOpensAt = null;
  for (const c of candidates) {
    if (!c?.id) continue;
    // ── Open NOW, and inside the shift ────────────────────────────────
    // The owner, 2026-09-11: the batch is taken "from the current time".
    // The same readiness the candidate read computed decides it: the
    // window is open at THIS instant or the row is skipped and counted. A
    // row that opens later — even later today — is left for the top-up
    // that runs when the rep's open rows run low, which is when it will be
    // open. The shift-end bound stays, as the outer check on the same row.
    const openNow = c.readiness?.decision === CALL_ALLOWED;
    if (!openNow || !callableBeforeDayEnd({ readiness: c.readiness, dayEnd: until })) {
      skippedForWindow++;
      const opens = c.readiness?.opensAt;
      if (isDate(opens) && opens.getTime() > 0 && (!nextOpensAt || opens.getTime() < nextOpensAt.getTime())) nextOpensAt = opens;
      continue;
    }
    eligible.push(c);
  }
  const stamp = (v) => (isDate(v) ? v.getTime() : Number.isFinite(Date.parse(v)) ? Date.parse(v) : 0);
  eligible.sort((a, b) => {
    // Callable soonest first — the header says whose priority this is.
    const wa = windowSortKey(a);
    const wb = windowSortKey(b);
    if (wa.tier !== wb.tier) return wa.tier - wb.tier;
    // A due retry before a fresh row, ahead of the shuts-soonest sort: the
    // rotation aimed it at this block, and a fresh row has no block to miss.
    // lib/sales/retryPool.js's header makes the same argument for the held list.
    const da = a.retryDue ? 0 : 1;
    const dbb = b.retryDue ? 0 : 1;
    if (da !== dbb) return da - dbb;
    // The better minute to ring, in the prospect's zone, before the
    // shuts-soonest key: both rows are open now, and Belkins' hour effect is
    // worth more than an hour of extra window. Unscored rows (null) go last.
    const sa_ = Number.isFinite(a.windowScore) ? a.windowScore : -1;
    const sb_ = Number.isFinite(b.windowScore) ? b.windowScore : -1;
    if (sa_ !== sb_) return sb_ - sa_;
    if (wa.at !== wb.at) return wa.at - wb.at;
    // Rows this rep gave back recently go last inside their window.
    const ra = a.recentlyReleased ? 1 : 0;
    const rb = b.recentlyReleased ? 1 : 0;
    if (ra !== rb) return ra - rb;
    // Then researched before unresearched.
    const sa = a.researched ? 0 : 1;
    const sb = b.researched ? 0 : 1;
    if (sa !== sb) return sa - sb;
    // Then the pool's own order: oldest first, so it drains.
    return stamp(a.createdAt) - stamp(b.createdAt);
  });
  const taken = eligible.slice(0, max);
  return {
    ids: taken.map((c) => c.id),
    researched: taken.filter((c) => c.researched).length,
    unresearched: taken.filter((c) => !c.researched).length,
    skippedForWindow,
    eligible: eligible.length,
    nextOpensAt: nextOpensAt ? nextOpensAt.toISOString() : null,
  };
}

/**
 * The `select` the candidate read uses. Narrow: nothing here is shown to the
 * rep — it is what the window rule and the ordering need, and nothing else.
 */
function candidateSelect(salesRepId, now) {
  return {
    id: true,
    createdAt: true,
    country: true,
    province: true,
    lastCrawledAt: true,
    // The retry pool's instant, for the due-first sort. `exhaustedAt` is in
    // the WHERE (retryAvailableWhere) and not read here.
    nextAttemptAt: true,
    _count: { select: { capabilities: true, opportunities: true } },
    // The stated zone outranks the derived one — the same read the queue
    // route makes for the one prospect it shows.
    leads: {
      where: { timeZone: { not: null } },
      orderBy: { updatedAt: "desc" },
      take: 1,
      select: { timeZone: true },
    },
    queueClaims: { where: recentlyReleasedByWhere(salesRepId, now), take: 1, select: { id: true } },
  };
}

function toCandidate(row, now, policyContext = null) {
  const prospect = { country: row.country, province: row.province };
  const timeZone = row.leads?.[0]?.timeZone || null;
  // The platform console's override for this row's state, resolved by the
  // one resolver. Null context is enforce — the answer this gave before the
  // override existed — so a caller that has not loaded the rows loses
  // nothing but the relaxation.
  const readiness = salesCallReadiness({
    prospect,
    timeZone,
    now,
    windowPolicy: policyContext ? windowPolicyFor(prospect, policyContext) : null,
  });
  return {
    id: row.id,
    createdAt: row.createdAt,
    // A retry whose instant has passed. The WHERE already excluded the ones
    // still ahead, so "has an instant" is "due" — but judged again here so
    // a scripted read that hands in a future one cannot promote it.
    retryDue: isDate(row.nextAttemptAt) && row.nextAttemptAt.getTime() <= now.getTime(),
    researched: isResearched(row),
    recentlyReleased: Array.isArray(row.queueClaims) && row.queueClaims.length > 0,
    readiness,
    // Only an open window has a closing time; asking for one otherwise would
    // invent it. The sort reads Infinity for null, which is "last", not "late".
    closesAt: readiness.decision === CALL_ALLOWED ? nextClosing({ prospect, timeZone, now }) : null,
    // The best-window score, in the prospect's zone, only for a row open
    // now — the same resolution lib/sales/queueWindows.js windowFor makes.
    windowScore: readiness.decision === CALL_ALLOWED ? candidateWindowScore({ prospect, timeZone, now }) : null,
  };
}

/** lib/sales/callWindowScore.js for one candidate, in its own zone(s) and window. */
function candidateWindowScore({ prospect, timeZone, now }) {
  const resolved = resolveLeadTimeZone({ timeZone, country: prospect.country, province: prospect.province });
  const zones = resolved.timeZone || (resolved.candidates.length > 1 ? resolved.candidates : null);
  return windowScore({ now, timeZone: zones, window: callingWindowFor(prospect) });
}

/** How many claims this rep has taken today, by the log. */
export async function claimsTakenToday({ db, salesRepId, timeZone, now = new Date() } = {}) {
  const localDate = localDateIn(timeZone, now) || now.toISOString().slice(0, 10);
  return db.salesQueueClaim.count({ where: { salesRepId, localDate } });
}

/**
 * Claim up to QUEUE_BATCH_MAX prospects of one trade for one rep, in one
 * transaction, and say what was claimed.
 *
 * The trade filter is inside claimCandidateWhere(), which is inside the
 * updateMany's WHERE, which is inside the transaction — a rep who asked for
 * Electrical gets Electrical or nothing, decided by the write and not by
 * anything the browser filtered.
 *
 * The language rule sits in the same place: `rep` goes into
 * claimCandidateWhere(), so a rep without French never reads a Quebec row
 * into `candidates` and the updateMany cannot match one. What that kept
 * back is COUNTED (`skippedForLanguage`) — a rep reading "claimed 12"
 * beside a trade with 900 in the pool is told why the rest were not
 * offered, rather than left to conclude discovery is broken.
 *
 * @returns `{ claimedIds, claimed, researched, unresearched, skippedForWindow,
 *            skippedForLanguage, remainingToday, reason, batchId }`. `reason`
 *            is null when the batch is full, else a BATCH_REASON_KEYS name
 *            saying why not.
 */
export async function claimBatch({
  db,
  rep,
  tradeKey,
  timeZone = null,
  now = new Date(),
  max = QUEUE_BATCH_MAX,
  // When the shift started. `undefined` means "read the ledger"; an explicit
  // null means "there is no Available row, use the claim instant" — the
  // check hands both in, the route hands in neither.
  shiftStart = undefined,
  // `{ overrides, registeredKeys }` from lib/sales/windowOverrides.js, so a
  // state whose window the console switched off is claimable at any hour.
  // Null keeps every window enforced.
  policyContext = null,
} = {}) {
  if (!db || !rep?.id) throw new Error("claimBatch needs a db and a rep");
  const zone = usableTimeZone(timeZone, now);
  const localDate = localDateIn(zone, now) || now.toISOString().slice(0, 10);
  // The window rule's bound is the end of the rep's SHIFT — see the header.
  // The claim instant stands in for a shift that has no Available row yet.
  const startedAt =
    shiftStart === undefined ? await shiftStartFor({ db, salesRepId: rep.id, timeZone: zone, now }) : shiftStart;
  const dayEnd = shiftEndFrom({ shiftStart: startedAt, now });

  const takenToday = await db.salesQueueClaim.count({
    where: { salesRepId: rep.id, localDate },
  });
  const remainingToday = Math.max(0, QUEUE_DAILY_CLAIM_CAP - takenToday);
  // How many rows in THIS trade's pool the language rule keeps from THIS
  // rep. Counted against the unrestricted pool (no rep) intersected with the
  // complement of the rep's fragment; zero, and no query at all, for a rep
  // with French. Read before the cap check so a rep at the ceiling still
  // learns the pool they cannot see exists — the sentence is the same either
  // way.
  const excluded = languageExcludedWhereFor(rep);
  const skippedForLanguage = excluded
    ? await db.prospect.count({ where: { AND: [claimCandidateWhere({ tradeKey, now }), excluded] } })
    : 0;
  const empty = (reason, extra = {}) => ({
    claimedIds: [],
    claimed: 0,
    researched: 0,
    unresearched: 0,
    skippedForWindow: 0,
    skippedForLanguage,
    remainingToday,
    reason,
    reasonKey: BATCH_REASON_KEYS[reason] || null,
    batchId: null,
    shiftStart: (startedAt || now).toISOString(),
    shiftEnd: dayEnd.toISOString(),
    timeZone: zone,
    openNow: 0,
    nextOpensAt: null,
    ...extra,
  });
  if (remainingToday <= 0) return empty("daily_cap");
  const want = Math.min(Math.max(0, Number(max) || 0), QUEUE_BATCH_MAX, remainingToday);
  if (want <= 0) return empty("daily_cap");

  // Two reads, researched then not, so "researched first" holds even when the
  // pool is deeper than one scan. Each is the availability condition AND the
  // research condition — never the availability condition alone, which
  // check-prospect-ui forbids as a listing.
  const base = claimCandidateWhere({ tradeKey, now, rep });
  const order = [{ createdAt: "asc" }];
  const select = candidateSelect(rep.id, now);
  const [researchedRows, unresearchedRows] = await Promise.all([
    db.prospect.findMany({
      where: { AND: [base, researchedWhere()] },
      orderBy: order,
      take: CANDIDATE_SCAN,
      select,
    }),
    db.prospect.findMany({
      where: { AND: [base, unresearchedWhere()] },
      orderBy: order,
      take: CANDIDATE_SCAN,
      select,
    }),
  ]);
  const candidates = [...researchedRows, ...unresearchedRows].map((r) => toCandidate(r, now, policyContext));
  if (candidates.length === 0) return empty("pool_empty");

  const picked = selectBatch({ candidates, shiftEnd: dayEnd, want });
  // Nothing open now: say when the pool's earliest window opens, from the
  // readiness the selection already computed — never a guess from a zone.
  if (picked.ids.length === 0) return empty("none_open_now", { nextOpensAt: picked.nextOpensAt });

  const at = now;
  const batchId = `qb_${at.getTime().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const won = await db.$transaction(async (tx) => {
    // The whole availability condition — trade included — is in the WHERE, so
    // a row another rep took between the read and this write is not matched
    // and is not overwritten. Per row, Postgres decides.
    await tx.prospect.updateMany({
      where: { id: { in: picked.ids }, ...claimCandidateWhere({ tradeKey, now: at, rep }) },
      data: { assignedRepId: rep.id, assignedAt: at, claimExpiresAt: claimExpiryFrom(at) },
    });
    // Which ones we won: the rows that now carry OUR rep and THIS instant. A
    // row we lost carries somebody else's, and a row we already held from an
    // earlier claim carries an earlier assignedAt, so neither is counted.
    const winners = await tx.prospect.findMany({
      where: { id: { in: picked.ids }, assignedRepId: rep.id, assignedAt: at },
      select: { id: true },
    });
    const wonIds = new Set(winners.map((w) => w.id));
    const ordered = picked.ids.filter((id) => wonIds.has(id));
    if (ordered.length > 0) {
      await tx.salesQueueClaim.createMany({
        data: ordered.map((prospectId, position) => ({
          salesRepId: rep.id,
          prospectId,
          claimedAt: at,
          mode: "batch",
          batchId,
          position,
          repTimeZone: zone,
          localDate,
        })),
      });
    }
    return ordered;
  });

  const byId = new Map(candidates.map((c) => [c.id, c]));
  const researched = won.filter((id) => byId.get(id)?.researched).length;
  // Why the batch is smaller than asked, when it is. Null means it is not.
  // Lost every race: contended. Fewer eligible than asked because rows were
  // skipped for the window: none_callable_today (the rest open after the shift).
  // Fewer eligible and nothing skipped: the pool itself ran dry.
  // Fewer open than asked with rows skipped: "N open now — more open at …"
  // (partial_open, with nextOpensAt); fewer and nothing skipped: the pool
  // itself ran dry.
  const reason =
    won.length === 0
      ? "contended"
      : won.length < want && picked.eligible < want
        ? picked.skippedForWindow > 0
          ? "partial_open"
          : "pool_empty"
        : null;
  return {
    claimedIds: won,
    claimed: won.length,
    researched,
    unresearched: won.length - researched,
    skippedForWindow: picked.skippedForWindow,
    skippedForLanguage,
    openNow: won.length,
    nextOpensAt: reason === "partial_open" ? picked.nextOpensAt : null,
    remainingToday: Math.max(0, remainingToday - won.length),
    reason,
    reasonKey: reason ? BATCH_REASON_KEYS[reason] : null,
    batchId: won.length ? batchId : null,
    shiftStart: (startedAt || now).toISOString(),
    shiftEnd: dayEnd.toISOString(),
    timeZone: zone,
  };
}

/**
 * Log one single-press claim. Same table, `mode: "single"`, so the daily cap
 * and the seven-day rule read one history rather than two.
 */
export async function logSingleClaim({ db, rep, prospectId, timeZone = null, now = new Date() } = {}) {
  const zone = usableTimeZone(timeZone, now);
  return db.salesQueueClaim.create({
    data: {
      salesRepId: rep.id,
      prospectId,
      claimedAt: now,
      mode: "single",
      repTimeZone: zone,
      localDate: localDateIn(zone, now) || now.toISOString().slice(0, 10),
    },
  });
}

/**
 * Whether a held row is untouched: no call attempt by this rep since it was
 * claimed. Pure, so the check can hand it rows.
 *
 * `attempts` are this rep's attempts on the row, any order. A row with no
 * `assignedAt` is treated as claimed at the epoch — every attempt counts.
 */
export function untouchedSinceClaim({ assignedAt = null, attempts = [] } = {}) {
  const since = isDate(assignedAt) ? assignedAt.getTime() : Number.isFinite(Date.parse(assignedAt)) ? Date.parse(assignedAt) : 0;
  return !attempts.some((a) => {
    const at = a?.dialledAt instanceof Date ? a.dialledAt.getTime() : Date.parse(a?.dialledAt);
    return Number.isFinite(at) && at >= since;
  });
}

/**
 * Decide, for a set of held rows, which go back — pure.
 *
 * @param rows `{ id, assignedAt, claimExpiresAt, attempts }` — a row whose
 *             lease has already been ended by a disposition (claimExpiresAt
 *             null) is worked and is never released here.
 */
export function partitionForRelease(rows = []) {
  const release = [];
  const keep = [];
  const worked = [];
  for (const row of rows) {
    if (!row?.id) continue;
    if (row.claimExpiresAt == null) worked.push(row.id);
    else if (untouchedSinceClaim(row)) release.push(row.id);
    else keep.push(row.id);
  }
  return { release, keep, worked };
}

/**
 * Give back every untouched row this rep holds — or only those in `onlyIds`.
 *
 * Both writes ride one transaction and both are scoped to the rep in the
 * WHERE: the prospect write requires `assignedRepId: rep.id` and an unworked
 * lease, so a row the rep worked in the meantime is not released by a stale
 * decision, and a row somebody else now holds is not touched at all.
 *
 * ── `includeDialled` ─────────────────────────────────────────────────────
 *
 * The platform console's "Release all held" for a rep who is not coming back
 * tonight. It widens the cut to the rows partitionForRelease would KEEP — a
 * lease the rep dialled on — and nothing else: a worked row (claimExpiresAt
 * null) is still out of scope, because a conversation is not a lease. It is
 * an option on this function rather than a second one so there is still
 * exactly one place that puts a Prospect back in the pool and closes its
 * claim row; app/api/cron/sales-queue-release's header says why that matters.
 *
 * `tx` is an interactive transaction already open — the deactivation flow
 * rides the release, the lead hand-off and the rep update on one — and when
 * it is given the writes go through it instead of opening their own.
 */
export async function releaseUntouched({
  db,
  rep,
  reason = "rest",
  onlyIds = null,
  includeDialled = false,
  now = new Date(),
  tx = null,
} = {}) {
  if (!db || !rep?.id) throw new Error("releaseUntouched needs a db and a rep");
  if (!RELEASE_REASONS.includes(reason)) throw new Error(`Unknown release reason ${reason}`);
  const reader = tx || db;
  const held = await reader.prospect.findMany({
    where: {
      assignedRepId: rep.id,
      claimExpiresAt: { not: null },
      ...(Array.isArray(onlyIds) ? { id: { in: onlyIds } } : {}),
    },
    select: {
      id: true,
      assignedAt: true,
      claimExpiresAt: true,
      callAttempts: { where: { salesRepId: rep.id }, select: { dialledAt: true } },
    },
  });
  const rows = held.map((h) => ({
    id: h.id,
    assignedAt: h.assignedAt,
    claimExpiresAt: h.claimExpiresAt,
    attempts: h.callAttempts || [],
  }));
  const parts = partitionForRelease(rows);
  const release = includeDialled ? [...parts.release, ...parts.keep] : parts.release;
  const keep = includeDialled ? [] : parts.keep;
  if (release.length === 0) return { released: 0, kept: keep.length, releasedIds: [] };

  const write = async (client) => {
    const done = await client.prospect.updateMany({
      where: { id: { in: release }, assignedRepId: rep.id, claimExpiresAt: { not: null } },
      data: { assignedRepId: null, assignedAt: null, claimExpiresAt: null },
    });
    await client.salesQueueClaim.updateMany({
      where: { prospectId: { in: release }, salesRepId: rep.id, releasedAt: null, workedAt: null },
      data: { releasedAt: now, releaseReason: reason },
    });
    return done.count;
  };
  const result = tx ? await write(tx) : await db.$transaction(write);
  return { released: result, kept: keep.length, releasedIds: release };
}

/**
 * Close the claim row for a prospect the rep worked (kept) or put back by hand.
 * Called by the queue route beside the writes that already do those things.
 */
/**
 * Give back the rep's untouched rows whose window is shut for the rest of
 * the shift — run before every top-up, so a rep never carries dead rows
 * across the day. "closed" is the release reason: nobody chose to give the
 * row back, so it does NOT de-prioritise it (DEPRIORITISING_RELEASES).
 *
 * Never a row with an attempt since it was claimed (untouchedSinceClaim),
 * and never a row with a callback promised — a callback is an attempt with
 * callbackAt, so untouched already excludes it, and the explicit check
 * below is there so the rule reads as written rather than as a consequence.
 * Judged by the same readiness the batch selection uses: not open now and
 * not opening before shiftEnd.
 */
export async function releaseClosedUntouched({
  db,
  rep,
  shiftEnd = null,
  now = new Date(),
  tx = null,
  // Same context claimBatch takes, so the release judges a row by the same
  // policy the claim did. A row claimed under "off" must not be handed back
  // as "closed" by a release that never heard of the override.
  policyContext = null,
} = {}) {
  if (!db || !rep?.id) throw new Error("releaseClosedUntouched needs a db and a rep");
  const reader = tx || db;
  const held = await reader.prospect.findMany({
    where: { assignedRepId: rep.id, claimExpiresAt: { not: null } },
    select: {
      id: true,
      assignedAt: true,
      claimExpiresAt: true,
      country: true,
      province: true,
      leads: { where: { timeZone: { not: null } }, orderBy: { updatedAt: "desc" }, take: 1, select: { timeZone: true } },
      callAttempts: { where: { salesRepId: rep.id }, select: { dialledAt: true, callbackAt: true } },
    },
  });
  const closedIds = held
    .filter((h) => {
      const attempts = h.callAttempts || [];
      if (!untouchedSinceClaim({ assignedAt: h.assignedAt, attempts })) return false;
      if (attempts.some((a) => isDate(a?.callbackAt) && a.callbackAt.getTime() > now.getTime())) return false;
      const prospect = { country: h.country, province: h.province };
      const readiness = salesCallReadiness({
        prospect,
        timeZone: h.leads?.[0]?.timeZone || null,
        now,
        windowPolicy: policyContext ? windowPolicyFor(prospect, policyContext) : null,
      });
      if (readiness.decision === CALL_ALLOWED) return false;
      const opens = readiness.opensAt;
      // Opens later in the shift: keep it; the top-up will not need it, but
      // it is not dead either. Opens after the shift, or never: dead today.
      if (isDate(opens) && isDate(shiftEnd) && opens.getTime() < shiftEnd.getTime()) return false;
      return true;
    })
    .map((h) => h.id);
  if (closedIds.length === 0) return { released: 0, releasedIds: [] };
  const result = await releaseUntouched({ db, rep, reason: "closed", onlyIds: closedIds, now, tx });
  return { released: result.released, releasedIds: result.releasedIds };
}

export async function closeClaim({ db, rep, prospectId, outcome, now = new Date() } = {}) {
  if (outcome === "worked") {
    return db.salesQueueClaim.updateMany({
      where: { prospectId, salesRepId: rep.id, releasedAt: null, workedAt: null },
      data: { workedAt: now },
    });
  }
  return db.salesQueueClaim.updateMany({
    where: { prospectId, salesRepId: rep.id, releasedAt: null, workedAt: null },
    data: { releasedAt: now, releaseReason: "rep" },
  });
}

/**
 * The hourly sweep: every rep whose local day has ended gives back what they
 * never touched.
 *
 * Open claim rows carry the zone and the local date they were taken on. A row
 * is due when today's date in that zone is later than the claim's — one
 * string comparison, no midnight arithmetic in the cron. Rows with no zone
 * (a client too old to send one) are judged in UTC, which is the only day
 * anybody can name for them.
 *
 * Rows whose lease has already gone — the 48-hour expiry passed, or the rep
 * put it back through the single control before this ran, or a disposition
 * ended the lease — are closed in the log with the matching reason so the
 * sweep does not re-read them every hour forever.
 */
export async function releaseDayEnded({ db, now = new Date(), log = () => {} } = {}) {
  const open = await db.salesQueueClaim.findMany({
    where: { releasedAt: null, workedAt: null },
    select: {
      id: true,
      salesRepId: true,
      prospectId: true,
      repTimeZone: true,
      localDate: true,
      claimedAt: true,
      prospect: { select: { assignedRepId: true, claimExpiresAt: true } },
    },
    orderBy: { claimedAt: "asc" },
    take: 5000,
  });

  const dueByRep = new Map();
  const lapsed = [];
  const worked = [];
  for (const row of open) {
    const zone = usableTimeZone(row.repTimeZone, now) || "UTC";
    const today = localDateIn(zone, now);
    if (!today || !(today > row.localDate)) continue;
    const held = row.prospect?.assignedRepId === row.salesRepId;
    if (!held) {
      lapsed.push(row.id);
      continue;
    }
    if (row.prospect?.claimExpiresAt == null) {
      worked.push(row.id);
      continue;
    }
    if (!dueByRep.has(row.salesRepId)) dueByRep.set(row.salesRepId, []);
    dueByRep.get(row.salesRepId).push(row.prospectId);
  }

  const counts = { reps: 0, released: 0, kept: 0, lapsed: 0, worked: 0, failed: 0 };
  if (lapsed.length) {
    const r = await db.salesQueueClaim.updateMany({
      where: { id: { in: lapsed }, releasedAt: null, workedAt: null },
      data: { releasedAt: now, releaseReason: "lapsed" },
    });
    counts.lapsed = r.count;
  }
  if (worked.length) {
    const r = await db.salesQueueClaim.updateMany({
      where: { id: { in: worked }, releasedAt: null, workedAt: null },
      data: { workedAt: now },
    });
    counts.worked = r.count;
  }
  for (const [salesRepId, ids] of dueByRep) {
    counts.reps++;
    try {
      const r = await releaseUntouched({ db, rep: { id: salesRepId }, reason: "day_end", onlyIds: ids, now });
      counts.released += r.released;
      counts.kept += r.kept;
    } catch (err) {
      counts.failed++;
      log(`[sales-queue-release] rep ${salesRepId}: ${err?.message || err}`);
    }
  }
  return counts;
}
