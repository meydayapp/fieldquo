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
// (Since 2026-09-14 the hour BEFORE a window counts too — CLAIM_OPENS_WITHIN_MS
// below records the owner's decision and the 08:50 that forced it. The rest
// of this section is the bound that still applies on top of it.)
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
// ══ One ceiling, server-side ══════════════════════════════════════════════
//
// QUEUE_BATCH_MAX is the owner's number for one press. There is no ceiling on
// the day — see the note at SHIFT_HOURS. The browser sends no number; it
// asks, and the server decides.
//
// ══ Release ═══════════════════════════════════════════════════════════════
//
// A claimed row with no call attempt since it was claimed is "untouched". The
// rep can give every untouched row back in one press (Release the rest), and
// app/api/cron/sales-queue-release does the same for every rep whose local day
// has ended AND who is off the floor, once an hour. A row with an attempt is
// kept — the rep started on it — a row the rep texted or promised a callback
// on is kept (spokenFor), and a worked row is never in scope at all.
// Released rows go back to unclaimed; the claim row records when and why.
// Nothing is deleted.
//
// "Local day has ended" was, until 2026-09-17, the rep's calendar midnight
// alone. The floor's reps ring North America from Karachi, Lagos and Paris,
// where midnight is the middle of the shift: 287 of the 341 rows released in
// the three days before the fix went back as `day_end` — 9 of them thirty
// minutes after they were claimed, with the rep's dials continuing for an
// hour after. The sweep now also asks whether the rep is still working
// (repOnShift: presence not offline and heard from within
// PRESENCE_STALE_MINUTES, or a dial in the last hour) and leaves a working
// rep's rows alone until the next pass finds them gone.
//
// A row the platform console ASSIGNED (claim mode "admin", written by
// lib/sales/assignLeads.js through the same selectClaimBatch/writeClaimBatch
// the rep's press uses) is the one exception to the automatic give-backs: the
// sweeps leave it alone on the day it was assigned and the next, because the
// rep it was handed to may not have been at their desk when it was —
// autoReleaseProtected() below says why, and what still bounds it.
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
import { PRESENCE_STALE_MINUTES, STATE_AVAILABLE, STATE_OFFLINE } from "./calls/agentState";
import { claimCandidateWhere, claimExpiryFrom } from "./prospectView";
import {
  NEW_BRUNSWICK_SPELLINGS,
  QUEBEC_PROVINCE_SPELLINGS,
  languageExcludedWhereFor,
  languageWhereFor,
} from "./leadLanguage";

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
 * How far ahead of a window's opening a row may be claimed.
 *
 * The owner, 2026-09-14, on the live screen at 08:50 Eastern with a Quebec
 * trade whose window opens at 09:00: "I can't claim them." The 2026-09-11
 * rule — the batch is taken "from the current time", open-now only — left
 * a rep in the ten minutes before the day's first window with nothing to
 * prepare, and a batch of zero with a sentence about 09:00. So a row whose
 * window is shut but opens within this many milliseconds is ELIGIBLE, taken
 * after every row that is open now (open-now first, then soonest-opening —
 * windowSortKey's two tiers), and still bounded by the shift's end. The
 * queue's groups already draw such a row under "OPENS AT 09:00", and the
 * autodialler already waits at it. Rows opening later than this are still
 * skipped and counted (skippedForWindow), and the earliest of them still
 * names the "more open at" sentence. This supersedes the 09-11 rule for the
 * hour before a window only; everything past that hour is unchanged.
 */
export const CLAIM_OPENS_WITHIN_MS = 60 * 60 * 1000;
// ── There is no daily claim ceiling ─────────────────────────────────────────
//
// There was one (150, then 250 — "two full batches and a top-up" from the
// owner's 200-dials-a-day arithmetic). On 2026-09-14, the first day the reps
// were live, a rep hit it before lunch: hang-ups, wrong numbers and
// no-answers each burn a claim, the queue tops itself up in 25s, and 250
// rows was a morning, not a day. The owner: "it doesn't matter how many they
// hit, there shouldn't be a limit." What still bounds a rep's day is the
// SHIFT (SHIFT_HOURS below) and the calling windows; how many rows they get
// through is their business. `claimsTakenToday` is still counted — it is a
// fact about the day worth showing — it just refuses nothing.
/**
 * How long a rep's shift is, from the moment they first went Available today.
 *
 * Seven hours, lunch and breaks inside it, ~200 dials — the owner's numbers.
 * A row whose window opens after this
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

/**
 * The shift's end: SHIFT_HOURS after it started, or after `now` if it has not.
 *
 * Never in the past. A rep in the eighth hour of a seven-hour shift is still
 * on shift — the ledger says Available and the dials keep coming — and an
 * end that has already gone by would make every shut row "opens after the
 * shift": the list would draw them all under "Not callable today" and the
 * top-up's closed-window release would hand back a row that reopens in
 * twenty minutes. So once the seven hours are up, the horizon is the hour
 * ahead (CLAIM_OPENS_WITHIN_MS — the same hour the claim already looks
 * ahead), moving with the clock for as long as the rep keeps going.
 */
export function shiftEndFrom({ shiftStart = null, now = new Date() } = {}) {
  const start = isDate(shiftStart) && shiftStart.getTime() <= now.getTime() ? shiftStart : now;
  const end = start.getTime() + SHIFT_HOURS * 60 * 60 * 1000;
  return new Date(Math.max(end, now.getTime() + CLAIM_OPENS_WITHIN_MS));
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
 * Whether a shut window opens within `withinMs` of `now`. Reads only the
 * readiness's own opensAt; false for a row with none. No lower bound on
 * purpose: a readiness judged a moment before `now` whose opening has just
 * passed is "open", not "not soon". Pure.
 */
export function opensWithin({ readiness = null, now = new Date(), withinMs = CLAIM_OPENS_WITHIN_MS } = {}) {
  const opens = readiness?.opensAt;
  if (!isDate(opens) || !isDate(now)) return false;
  return opens.getTime() - now.getTime() <= withinMs;
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
 * @param now        the instant the readiness was judged at; a shut window
 *                   opening within CLAIM_OPENS_WITHIN_MS of it is eligible.
 * @returns `{ ids, researched, unresearched, skippedForWindow }` — `ids` in
 *          dial order.
 */
export function selectBatch({ candidates = [], shiftEnd = null, dayEnd = null, want = QUEUE_BATCH_MAX, now = new Date() } = {}) {
  const at = isDate(now) ? now : new Date();
  const until = shiftEnd || dayEnd;
  const max = Math.max(0, Math.min(Number(want) || 0, QUEUE_BATCH_MAX));
  let skippedForWindow = 0;
  const eligible = [];
  // The earliest opening among the rows NOT taken, so a short batch can say
  // "more open at 8:00 AM". Null when nothing skipped names one.
  let nextOpensAt = null;
  for (const c of candidates) {
    if (!c?.id) continue;
    // ── Open NOW or within the hour, and inside the shift ─────────────
    // The owner, 2026-09-11: the batch is taken "from the current time";
    // 2026-09-14: and the hour before a window counts (CLAIM_OPENS_WITHIN_MS
    // says why). The same readiness the candidate read computed decides
    // it: open at THIS instant, or shut with an opening within the hour,
    // else the row is skipped and counted. A row that opens later than
    // that — even later today — is left for the top-up that runs when the
    // rep's open rows run low, which is when it will be open. The shift-end
    // bound stays, as the outer check on the same row, and it is
    // callableBeforeDayEnd that keeps a prohibition or an unread
    // jurisdiction out: "opens soon" is only ever a shut WINDOW.
    const openNow = c.readiness?.decision === CALL_ALLOWED;
    const opensSoon = !openNow && opensWithin({ readiness: c.readiness, now: at, withinMs: CLAIM_OPENS_WITHIN_MS });
    if (!(openNow || opensSoon) || !callableBeforeDayEnd({ readiness: c.readiness, dayEnd: until })) {
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
 * The extra WHERE fragments an ASSIGNMENT narrows the pool by — the
 * console's "in Quebec" / "in French" — as an array to AND beside the
 * candidate WHERE. Empty for the rep's own press, which narrows by nothing.
 *
 * `province` is a subdivision code and matches the spellings a row may carry
 * for it: the code, the hyphenated ISO form, and for Quebec and New
 * Brunswick the lists lib/sales/leadLanguage.js keeps (every other province
 * and state has been measured as the bare code — normaliseSubdivision folds
 * it on the way in). `language` is one of the rep's own selling languages
 * and reuses languageWhereFor() with a one-language pseudo-rep: "the rows
 * this rep would sell in French" is exactly the rows a French-only rep may
 * be handed, so the same fragment answers both. Neither fragment relaxes the
 * rep's real rule, which is already in the base WHERE; these only narrow.
 */
export function assignFilterWhere({ province = null, language = null } = {}) {
  const out = [];
  const code = typeof province === "string" ? province.trim().toUpperCase() : "";
  if (code) {
    const spellings = new Set([code, `CA-${code}`, `US-${code}`]);
    if (code === "QC") for (const s of QUEBEC_PROVINCE_SPELLINGS) spellings.add(s);
    if (code === "NB") for (const s of NEW_BRUNSWICK_SPELLINGS) spellings.add(s);
    out.push({ province: { in: [...spellings] } });
  }
  const lang = typeof language === "string" ? language.trim().toLowerCase() : "";
  if (lang) {
    const fragment = languageWhereFor({ sellsIn: [lang] });
    if (Array.isArray(fragment.AND)) out.push(...fragment.AND);
  }
  return out;
}

/**
 * THE selection — the one function that decides which rows the next batch
 * is: read the pool, judge every candidate, order, cut.
 *
 * Shared, by import, between the rep's own "Claim the next 25" (claimBatch
 * below, via app/api/sales/queue) and the platform console's "Assign leads"
 * (lib/sales/assignLeads.js). The owner asked whether he could hand a rep
 * the next leads from /platform; the answer had to be "the same next leads
 * the rep would have been handed", so there is one selection and two
 * callers rather than a console copy that drifts. scripts/check-sales-
 * assign.mjs asserts both import this symbol.
 *
 * Two reads, researched then not, so "researched first" holds even when the
 * pool is deeper than one scan. Each is the availability condition AND the
 * research condition — never the availability condition alone, which
 * check-prospect-ui forbids as a listing. `filters` (assignFilterWhere) are
 * AND-ed beside the base: they narrow what the console asked for and never
 * widen what the rep may take.
 *
 * @returns `{ candidates, picked }` — `picked` is selectBatch()'s answer, or
 *          null when the pool had no candidate at all.
 */
export async function selectClaimBatch({
  db,
  rep,
  tradeKey,
  now = new Date(),
  shiftEnd = null,
  want = QUEUE_BATCH_MAX,
  policyContext = null,
  filters = [],
} = {}) {
  if (!db || !rep?.id) throw new Error("selectClaimBatch needs a db and a rep");
  const base = claimCandidateWhere({ tradeKey, now, rep });
  // The console's narrowing, AND-ed after the research condition so the
  // read is visibly "availability AND research AND what was asked for".
  const narrow = Array.isArray(filters) ? filters : [];
  const order = [{ createdAt: "asc" }];
  const select = candidateSelect(rep.id, now);
  const [researchedRows, unresearchedRows] = await Promise.all([
    db.prospect.findMany({
      where: { AND: [base, researchedWhere(), ...narrow] },
      orderBy: order,
      take: CANDIDATE_SCAN,
      select,
    }),
    db.prospect.findMany({
      where: { AND: [base, unresearchedWhere(), ...narrow] },
      orderBy: order,
      take: CANDIDATE_SCAN,
      select,
    }),
  ]);
  const candidates = [...researchedRows, ...unresearchedRows].map((r) => toCandidate(r, now, policyContext));
  if (candidates.length === 0) return { candidates, picked: null };
  return { candidates, picked: selectBatch({ candidates, shiftEnd, want, now }) };
}

/**
 * THE write — the lease on every picked row and the claim log beside it, in
 * one transaction, guarded by the same WHERE the read used. Shared with the
 * console's Assign for the same reason selectClaimBatch is.
 *
 * The whole availability condition — trade included — is in the WHERE, so a
 * row another rep took between the read and this write is not matched and
 * is not overwritten. Per row, Postgres decides. Which ones we won: the rows
 * that now carry OUR rep and THIS instant. A row we lost carries somebody
 * else's, and a row we already held from an earlier claim carries an
 * earlier assignedAt, so neither is counted.
 *
 * `mode` is the claim log's origin column: "batch" for the rep's press,
 * "admin" when the console did the handing — the day-end and closed sweeps
 * read it (autoReleaseProtected) to leave a console assignment alone on the
 * day it was made. `batchId` is the caller's, so an admin batch can name
 * the admin the way a reassignment names the rep it came from.
 *
 * @returns the won ids, in dial order.
 */
export async function writeClaimBatch({
  db,
  rep,
  tradeKey,
  picked,
  at = new Date(),
  zone = null,
  localDate = null,
  batchId,
  mode = "batch",
} = {}) {
  if (!db || !rep?.id) throw new Error("writeClaimBatch needs a db and a rep");
  if (!Array.isArray(picked?.ids) || picked.ids.length === 0) return [];
  const date = localDate || localDateIn(zone, at) || at.toISOString().slice(0, 10);
  return db.$transaction(async (tx) => {
    await tx.prospect.updateMany({
      where: { id: { in: picked.ids }, ...claimCandidateWhere({ tradeKey, now: at, rep }) },
      data: { assignedRepId: rep.id, assignedAt: at, claimExpiresAt: claimExpiryFrom(at) },
    });
    const winners = await tx.prospect.findMany({
      where: { id: { in: picked.ids }, assignedRepId: rep.id, assignedAt: at },
      select: { id: true },
    });
    const wonIds = new Set(winners.map((w) => w.id));
    const ordered = picked.ids.filter((id) => wonIds.has(id));
    if (ordered.length > 0) {
      // A row this rep held before on a lease that ran out — dialled, so
      // the sweeps kept it, then lapsed at 48 hours and re-claimed here —
      // still has its OLD claim row open. Close it as lapsed before the new
      // one is written, or the day-end sweep reads the old row's date and
      // gives the fresh lease back an hour after it was taken (five of
      // Muhammad Umar's rows on 2026-09-17, twice over in the log).
      await tx.salesQueueClaim.updateMany({
        where: { salesRepId: rep.id, prospectId: { in: ordered }, releasedAt: null, workedAt: null },
        data: { releasedAt: at, releaseReason: "lapsed" },
      });
      await tx.salesQueueClaim.createMany({
        data: ordered.map((prospectId, position) => ({
          salesRepId: rep.id,
          prospectId,
          claimedAt: at,
          mode,
          batchId,
          position,
          repTimeZone: zone,
          localDate: date,
        })),
      });
    }
    return ordered;
  });
}

/**
 * Why a batch is smaller than asked, when it is. Null means it is not.
 * Lost every race: contended. Fewer eligible than asked with rows skipped
 * for the window: "N open now — more open at …" (partial_open, with
 * nextOpensAt); fewer eligible and nothing skipped: the pool itself ran dry.
 * Pure; shared with the console's Assign so both say the same reason.
 */
export function batchShortfallReason({ won = 0, want = 0, picked = null } = {}) {
  if (won === 0) return "contended";
  if (won < want && picked && picked.eligible < want) {
    return picked.skippedForWindow > 0 ? "partial_open" : "pool_empty";
  }
  return null;
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
 * The selection is selectClaimBatch() and the write is writeClaimBatch(),
 * both above and both shared with the console's Assign; this function is
 * the rep's composition of them: the cap arithmetic, the shift bound, and
 * the sentence that comes back.
 *
 * @returns `{ claimedIds, claimed, researched, unresearched, skippedForWindow,
 *            skippedForLanguage, reason, batchId }`. `reason`
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

  // How many rows in THIS trade's pool the language rule keeps from THIS
  // rep. Counted against the unrestricted pool (no rep) intersected with the
  // complement of the rep's fragment; zero, and no query at all, for a rep
  // with French.
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
    reason,
    reasonKey: BATCH_REASON_KEYS[reason] || null,
    batchId: null,
    shiftStart: (startedAt || now).toISOString(),
    shiftEnd: dayEnd.toISOString(),
    timeZone: zone,
    openNow: 0,
    opensSoon: 0,
    opensSoonAt: null,
    nextOpensAt: null,
    ...extra,
  });
  const want = Math.min(Math.max(0, Number(max) || 0), QUEUE_BATCH_MAX);
  if (want <= 0) return empty("pool_empty");

  const { candidates, picked } = await selectClaimBatch({
    db,
    rep,
    tradeKey,
    now,
    shiftEnd: dayEnd,
    want,
    policyContext,
  });
  if (!picked) return empty("pool_empty");
  // Nothing open now: say when the pool's earliest window opens, from the
  // readiness the selection already computed — never a guess from a zone.
  if (picked.ids.length === 0) return empty("none_open_now", { nextOpensAt: picked.nextOpensAt });

  const at = now;
  const batchId = `qb_${at.getTime().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const won = await writeClaimBatch({ db, rep, tradeKey, picked, at, zone, localDate, batchId, mode: "batch" });

  const byId = new Map(candidates.map((c) => [c.id, c]));
  const researched = won.filter((id) => byId.get(id)?.researched).length;
  // What was open at the instant, and what was taken for the hour ahead of
  // its window — the screen says "N open now" from the first, not from the
  // size of the batch.
  const openNow = won.filter((id) => byId.get(id)?.readiness?.decision === CALL_ALLOWED).length;
  const opensSoon = won.length - openNow;
  // When the rows taken for the hour ahead open — the earliest among them —
  // so the result can say "their window opens at 09:00; you can prepare".
  const opensSoonAt = won
    .map((id) => byId.get(id)?.readiness)
    .filter((r) => r && r.decision !== CALL_ALLOWED && isDate(r.opensAt))
    .reduce((best, r) => (!best || r.opensAt.getTime() < best.getTime() ? r.opensAt : best), null);
  const reason = batchShortfallReason({ won: won.length, want, picked });
  return {
    claimedIds: won,
    claimed: won.length,
    researched,
    unresearched: won.length - researched,
    skippedForWindow: picked.skippedForWindow,
    skippedForLanguage,
    openNow,
    opensSoon,
    opensSoonAt: opensSoonAt ? opensSoonAt.toISOString() : null,
    nextOpensAt: reason === "partial_open" ? picked.nextOpensAt : null,
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
 * Whether a claim row is older than the lease its prospect now carries —
 * pure. A minute's tolerance because a batch's claimedAt and the prospect's
 * assignedAt are the same instant written twice, never two clocks.
 */
export function claimStale({ claimedAt = null, assignedAt = null } = {}) {
  const c = claimedAt instanceof Date ? claimedAt.getTime() : Date.parse(claimedAt);
  const a = assignedAt instanceof Date ? assignedAt.getTime() : Date.parse(assignedAt);
  if (!Number.isFinite(c) || !Number.isFinite(a)) return false;
  return a - c > 60_000;
}

/** The calendar date after a "YYYY-MM-DD", in the same shape. */
function nextLocalDate(localDate) {
  const m = typeof localDate === "string" && localDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + 1));
  return d.toISOString().slice(0, 10);
}

/**
 * Whether an open claim is shielded from the AUTOMATIC give-backs — the
 * hourly day-end sweep (releaseDayEnded) and the closed-window release that
 * runs before a top-up (releaseClosedUntouched). Pure.
 *
 * Only a console assignment (`mode: "admin"`) is, and only through the end
 * of the local day AFTER the one it was made on. The reasoning: a rep's own
 * claim is taken with a headset on, so an untouched row at their midnight is
 * a row they chose not to ring today and the pool may have it back. A
 * console assignment is made by somebody else, often at six in the evening
 * for a rep who has gone home — "assign the next leads to the sales rep" —
 * and the rep is meant to find the rows the next morning. Judged in UTC by
 * the sweep (the console has no browser zone for the rep), a 3 pm Eastern
 * assignment would otherwise go back at 8 pm Eastern, five hours later and
 * before anybody it was assigned to had looked. So: the assignment day and
 * the next one are the rep's, whatever zone the claim was judged in.
 *
 * Deliberately NOT indefinite. The 48-hour lease (lib/sales/prospectView.js
 * CLAIM_HOURS) still lapses on its own, "Release the rest" still gives the
 * rows back on the rep's word, and the console's own Unassign still works —
 * this shields the rows from the two sweeps that act without anybody
 * choosing, for exactly one extra day.
 */
export function autoReleaseProtected({ mode = null, localDate = null, repTimeZone = null, now = new Date() } = {}) {
  if (mode !== "admin") return false;
  const zone = usableTimeZone(repTimeZone, now) || "UTC";
  const today = localDateIn(zone, now);
  const until = nextLocalDate(localDate);
  if (!today || !until) return false;
  return today <= until;
}

/**
 * Whether a row is spoken for beyond the dial log: a callback the rep
 * promised that has not come round yet, or a text the rep sent. Pure.
 *
 * Neither is "an attempt since the claim" — a callback is set on an attempt
 * that may predate this lease, and a text is not a call at all — and both
 * were released as "untouched" until 2026-09-17, when a rep who had texted a
 * business and booked a call-back for the morning found the row gone at
 * midnight. A promise made is a reason to keep the row, whoever's clock it
 * is judged on. `callbackAt` in the past is a callback that came and went;
 * the retry pool owns that row now, and this says nothing about it.
 */
export function spokenFor({ attempts = [], texted = false, now = new Date() } = {}) {
  if (texted === true) return "texted";
  const nowMs = now instanceof Date ? now.getTime() : Date.now();
  const open = (Array.isArray(attempts) ? attempts : []).some((a) => {
    const at = a?.callbackAt instanceof Date ? a.callbackAt.getTime() : Date.parse(a?.callbackAt);
    return Number.isFinite(at) && at > nowMs;
  });
  return open ? "callback" : null;
}

/**
 * Decide, for a set of held rows, which go back — pure.
 *
 * @param rows `{ id, assignedAt, claimExpiresAt, attempts, texted }` — a row
 *             whose lease has already been ended by a disposition
 *             (claimExpiresAt null) is worked and is never released here.
 *             `attempts` carry `dialledAt` and, when set, `callbackAt`;
 *             `texted` is whether this rep sent the business a text.
 * @returns `{ release, keep, worked, kept }` — `kept` says why each kept id
 *             stayed: "dialled", "callback" or "texted".
 */
export function partitionForRelease(rows = [], { now = new Date() } = {}) {
  const release = [];
  const keep = [];
  const worked = [];
  const kept = {};
  for (const row of rows) {
    if (!row?.id) continue;
    if (row.claimExpiresAt == null) {
      worked.push(row.id);
      continue;
    }
    const promise = spokenFor({ attempts: row.attempts, texted: row.texted, now });
    if (promise) {
      keep.push(row.id);
      kept[row.id] = promise;
    } else if (untouchedSinceClaim(row)) {
      release.push(row.id);
    } else {
      keep.push(row.id);
      kept[row.id] = "dialled";
    }
  }
  return { release, keep, worked, kept };
}

/**
 * The prospect ids among `prospectIds` this rep has sent at least one text
 * to, through their own lead on the business. An empty set when the client
 * has no SalesSmsMessage delegate (a scripted db) or the read fails — a
 * failed read must not release a row the rep may have texted, so the
 * caller's `texted` flag on the row, when it has one, still counts.
 */
export async function textedByRep({ db, rep, prospectIds = [] } = {}) {
  const out = new Set();
  if (!rep?.id || prospectIds.length === 0) return out;
  if (typeof db?.salesSmsMessage?.findMany !== "function") return out;
  try {
    const rows = await db.salesSmsMessage.findMany({
      where: { salesRepId: rep.id, direction: "out", lead: { prospectId: { in: prospectIds } } },
      select: { lead: { select: { prospectId: true } } },
      distinct: ["leadId"],
    });
    for (const r of rows) if (r?.lead?.prospectId) out.add(r.lead.prospectId);
  } catch {
    // Fail towards keeping — see above.
  }
  return out;
}

/** How long after a dial a rep still counts as working, for the day-end sweep. */
export const ON_SHIFT_DIAL_GRACE_MS = 60 * 60 * 1000;

/**
 * Whether a rep is at their desk right now — pure.
 *
 * `activity` is the rep's OPEN presence row (endedAt null), `lastDialAt`
 * their most recent call attempt. On shift when the row says anything but
 * offline and the browser has been heard from within PRESENCE_STALE_MINUTES
 * (the same age lib/sales/calls/agentState.js livePresence() turns a state
 * stale at), OR when they dialled within the last hour — the ledger can be
 * stale while the headset is not. Null activity and no recent dial: off.
 */
export function repOnShift({ activity = null, lastDialAt = null, now = new Date() } = {}) {
  const nowMs = now.getTime();
  const dialMs = lastDialAt instanceof Date ? lastDialAt.getTime() : Date.parse(lastDialAt);
  if (Number.isFinite(dialMs) && nowMs - dialMs <= ON_SHIFT_DIAL_GRACE_MS && dialMs <= nowMs + 60_000) return true;
  if (!activity || activity.state === STATE_OFFLINE || activity.endedAt) return false;
  const seen = [activity.heartbeatAt, activity.startedAt]
    .map((v) => (v instanceof Date ? v.getTime() : Date.parse(v)))
    .filter(Number.isFinite);
  if (seen.length === 0) return false;
  return nowMs - Math.max(...seen) <= PRESENCE_STALE_MINUTES * 60 * 1000;
}

/**
 * repOnShift() from the database: the open presence row and the last dial.
 * A client without either table (the scripted db) answers "off shift", so a
 * check that sets up a due day-end still sees it fire unless it scripts the
 * ledger.
 */
export async function repStillWorking({ db, salesRepId, now = new Date() } = {}) {
  if (!salesRepId) return false;
  const activity =
    typeof db?.salesRepActivity?.findFirst === "function"
      ? await db.salesRepActivity.findFirst({
          where: { salesRepId, endedAt: null },
          orderBy: { startedAt: "desc" },
          select: { state: true, startedAt: true, heartbeatAt: true, endedAt: true },
        })
      : null;
  const last =
    typeof db?.salesCallAttempt?.findFirst === "function"
      ? await db.salesCallAttempt.findFirst({
          where: { salesRepId, dialledAt: { gte: new Date(now.getTime() - ON_SHIFT_DIAL_GRACE_MS) } },
          orderBy: { dialledAt: "desc" },
          select: { dialledAt: true },
        })
      : null;
  return repOnShift({ activity, lastDialAt: last?.dialledAt || null, now });
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
      callAttempts: { where: { salesRepId: rep.id }, select: { dialledAt: true, callbackAt: true } },
    },
  });
  // Which of these the rep has texted — spokenFor() keeps such a row. Read
  // through the rep's own lead on the business (a text is sent to a lead,
  // never to a prospect), and only when the client has the table: the
  // scripted db in scripts/check-sales-batch-claim.mjs hands `texted` in on
  // the row instead.
  const texted = await textedByRep({ db: reader, rep, prospectIds: held.map((h) => h.id) });
  const rows = held.map((h) => ({
    id: h.id,
    assignedAt: h.assignedAt,
    claimExpiresAt: h.claimExpiresAt,
    attempts: h.callAttempts || [],
    texted: h.texted === true || texted.has(h.id),
  }));
  const parts = partitionForRelease(rows, { now });
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
      // The open claim row, for its origin: a console assignment is left
      // alone on the day it was made and the next — autoReleaseProtected.
      queueClaims: {
        where: { salesRepId: rep.id, releasedAt: null, workedAt: null },
        take: 1,
        select: { mode: true, localDate: true, repTimeZone: true },
      },
    },
  });
  const closedIds = held
    .filter((h) => {
      const attempts = h.callAttempts || [];
      if (!untouchedSinceClaim({ assignedAt: h.assignedAt, attempts })) return false;
      const claim = Array.isArray(h.queueClaims) ? h.queueClaims[0] : null;
      if (claim && autoReleaseProtected({ ...claim, now })) return false;
      // A promised callback or a sent text keeps the row — spokenFor(), the
      // same rule releaseUntouched applies again at write time.
      if (spokenFor({ attempts, now })) return false;
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
 * The hourly sweep: every rep whose local day has ended — and who is no
 * longer at their desk — gives back what they never touched.
 *
 * Open claim rows carry the zone and the local date they were taken on. A row
 * is due when today's date in that zone is later than the claim's — one
 * string comparison, no midnight arithmetic in the cron. Rows with no zone
 * (a client too old to send one) are judged in UTC, which is the only day
 * anybody can name for them. Due is not yet released: the rep has to be off
 * the floor too (repStillWorking, below), because for a rep overseas the
 * date turns mid-shift.
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
      mode: true,
      repTimeZone: true,
      localDate: true,
      claimedAt: true,
      prospect: { select: { assignedRepId: true, assignedAt: true, claimExpiresAt: true } },
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
    // A console assignment keeps the day after too — see autoReleaseProtected.
    if (autoReleaseProtected({ mode: row.mode, localDate: row.localDate, repTimeZone: row.repTimeZone, now })) continue;
    const held = row.prospect?.assignedRepId === row.salesRepId;
    if (!held) {
      lapsed.push(row.id);
      continue;
    }
    // Held — but on a NEWER lease than this row records: the row lapsed and
    // the same rep took it again (writeClaimBatch now closes such rows at
    // claim time; this catches the ones written before it did). The old
    // row's date must not decide the new lease's fate.
    if (claimStale({ claimedAt: row.claimedAt, assignedAt: row.prospect?.assignedAt })) {
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

  const counts = { reps: 0, released: 0, kept: 0, lapsed: 0, worked: 0, failed: 0, onShift: 0 };
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
    // ── Not while they are still dialling ──────────────────────────────
    //
    // "The rep's local day has ended" was read as their calendar midnight.
    // For a rep in Karachi, Lagos or Paris ringing North America, midnight
    // falls in the MIDDLE of the shift: on 2026-09-17 the sweep took 9 of
    // Muhammad Umar's rows thirty minutes after he claimed them, with his
    // dials continuing for another hour, and 50 of Favor Saddic's two hours
    // after hers while her ledger still said Available. The date rolling
    // over is necessary, not sufficient: the rows go back on the first
    // hourly pass after the rep is off the floor (repOnShift), and a rep
    // who is still Available or still dialling keeps what they hold.
    let working = false;
    try {
      working = await repStillWorking({ db, salesRepId, now });
    } catch (err) {
      log(`[sales-queue-release] rep ${salesRepId}: presence unreadable, treating as off shift: ${err?.message || err}`);
    }
    if (working) {
      counts.onShift += ids.length;
      continue;
    }
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
