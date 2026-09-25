// lib/receipts/suggest.js
//
// Which job does this receipt belong to — or is it overhead? A SUGGESTION,
// scored in plain code, with every point it gives written down as a reason a
// person can read.
//
// ══ Deterministic first, and the model only labels lines ═══════════════════
//
// The owner asked for "logical algorithmic assumptions". So nothing here asks a
// model anything. The model's only contribution is the `kind` label on each
// line (lib/receipts/extract.js); the rest is the company's own records:
//
//   (a) WHO — the person who captured the receipt is taken to be the person at
//       the till. The product holds no card-to-member mapping, so "whose card"
//       cannot be read; the card's last four are shown, not scored.
//   (b) WHEN — that person's TimeEntry on a job at (or near) the printed time;
//       failing that, a JobVisit booked for them around it. A receipt with no
//       printed time only earns the weaker "worked there that day".
//   (c) WHERE — the store's postal area or town against the job site's. No
//       distance in kilometres: that needs the store's address geocoded, which
//       is a paid Google call per receipt, and adding one is the owner's
//       decision, not this file's (see docs/ROADMAP.md).
//   (d) WHAT — the receipt's lines against the job's quote lines and material
//       list, and the trade they belong to (paint → a painting job).
//   (e) RECENCY — a job in progress that day, or starting, or just finished.
//
// Each signal adds points and a reason. The weights are constants below, in
// one place, so "why did it say Elm St?" has an answer that is a line number.
//
// ══ What it never does ═════════════════════════════════════════════════════
//
// It never links anything. The confirm route does that, and only when a
// person taps Confirm. A confident suggestion with the wrong job is worse
// than none, so confidence is marked down whenever two answers are close.
//
// Pure: no database, no clock except the `now` passed in.
// scripts/check-receipt-books.mjs runs it against hostile fixtures.
import { OVERHEAD_KINDS, JOB_KINDS, categoryForKind, vendorHint, tokens, tradesIn } from "./classify";
import { dayWindow, localClock, clockLabel, localDate } from "./time";

/** Every weight, in one place. */
export const WEIGHTS = Object.freeze({
  capturedHere: 30, // the receipt was snapped from this job's own page
  clockedIn: 45, // the uploader was clocked in on this job at the printed time
  clockedNearMax: 30, // ...or clocked in/out within NEAR_MINUTES of it (scaled)
  clockedNearMin: 10,
  workedThatDay: 25, // no printed time; the uploader worked this job that day
  visitNear: 25, // a visit booked for the uploader within VISIT_HOURS
  visitSameDay: 12,
  othersClockedIn: 15, // somebody else was on this job then (office uploads)
  samePostalArea: 15,
  sameCity: 8,
  perMatchedLine: 6,
  matchedLinesCap: 20,
  tradeMatch: 8,
  inProgress: 8,
  startsNear: 5,
  justFinished: 3,
  // overhead
  overheadItems: 45,
  overheadStore: 35,
  afterHours: 20,
  noActiveJob: 20,
  jobItemsPenalty: 20,
});

/** How close a clock-in or clock-out must be to count as "near", minutes. */
export const NEAR_MINUTES = 90;
/** How close a booked visit must be to count as "near", hours. */
export const VISIT_HOURS = 4;
/** An open time entry (never clocked out) is believed for this long, hours. */
export const OPEN_ENTRY_HOURS = 16;
/** Before this hour, or from this hour on, is outside normal working hours. */
export const WORK_START_HOUR = 6;
export const WORK_END_HOUR = 20;

const MIN = 60 * 1000;
const HOUR = 60 * MIN;

const toDate = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isFinite(d.getTime()) ? d : null;
};

/**
 * The postal "area" — enough to say two addresses are in the same part of
 * town. Canada: the forward sortation area ("K2M 1A1" → "K2M"). US: the ZIP's
 * first three digits (the sectional centre). Anything else → null, never a
 * guess.
 */
export function postalArea(text) {
  const s = String(text || "").toUpperCase();
  const ca = s.match(/\b([ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z])\s?\d[ABCEGHJ-NPRSTV-Z]\d\b/);
  if (ca) return ca[1];
  const us = s.match(/\b(\d{3})\d{2}(?:-\d{4})?\b/);
  if (us) return us[1];
  return null;
}

function sameTown(city, address) {
  const c = String(city || "").trim().toLowerCase();
  if (c.length < 3) return false;
  const a = String(address || "").toLowerCase();
  const escaped = c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z])${escaped}($|[^a-z])`).test(a);
}

/** The end of a time entry — its clock-out, or a believable cap on an open one. */
function entryEnd(entry, now) {
  const out = toDate(entry.clockOut);
  if (out) return out;
  const start = toDate(entry.clockIn);
  if (!start) return null;
  const cap = new Date(start.getTime() + OPEN_ENTRY_HOURS * HOUR);
  return now && now < cap ? now : cap;
}

/** A job's short name for a reason: its site address, else its title. */
function placeOf(job) {
  const addr = String(job.siteAddress || "").split(",")[0].trim();
  return addr || String(job.title || "").trim() || "—";
}

/**
 * @param input.receipt   { purchasedAt, purchasedDate, vendorName, vendorCity,
 *                          vendorPostalCode, vendorAddress, items: [{ description,
 *                          kind, lineTotalCents }], uploaderUserId, contextJobId }
 * @param input.jobs      candidate jobs, each with timeEntries [{userId, clockIn,
 *                        clockOut}] and visits [{assignedToId, scheduledAt}],
 *                        quoteLineNames, materialNames, status, dates, site fields
 * @param input.people    { [userId]: display name }
 * @param input.timezone  the company's IANA zone
 * @param input.now       a Date — the only clock this function reads
 */
export function suggestPlacement({ receipt = {}, jobs = [], people = {}, timezone, now = new Date() } = {}) {
  const at = toDate(receipt.purchasedAt);
  // The printed day as the company's own [midnight, midnight). When only an
  // instant is known the day is derived from it, so "same day" means the
  // company's day, not UTC's.
  const day = receipt.purchasedDate
    ? dayWindow(receipt.purchasedDate, timezone)
    : at
      ? dayWindow(localDate(at, timezone), timezone)
      : null;
  const uploader = receipt.uploaderUserId || null;
  const nameOf = (userId) => (userId && people[userId]) || null;
  const uploaderName = nameOf(uploader);

  const items = (Array.isArray(receipt.items) ? receipt.items : []).map((it, index) => ({
    index,
    description: String(it?.description || ""),
    kind: it?.kind || "other",
    cents: Number.isInteger(it?.lineTotalCents) ? it.lineTotalCents : null,
  }));
  const itemText = items.map((i) => i.description).join(" \n ");
  const itemTrades = tradesIn(itemText);

  const storeArea = postalArea(receipt.vendorPostalCode) || postalArea(receipt.vendorAddress);
  const storeName = receipt.vendorName || null;

  const uniqueJobs = [];
  const seenJob = new Set();
  for (const job of Array.isArray(jobs) ? jobs : []) {
    if (!job?.id || seenJob.has(job.id) || job.status === "cancelled") continue;
    seenJob.add(job.id);
    uniqueJobs.push(job);
  }

  // ── First pass: time signals, because (4) depends on whether the UPLOADER
  //    has any at all. An owner entering a crew member's receipt at the desk
  //    was clocked in nowhere; the crew's own clocks are then the evidence.
  const timeSignals = new Map();
  let uploaderHasTimeSignal = false;
  for (const job of uniqueJobs) {
    const found = [];
    const entries = (Array.isArray(job.timeEntries) ? job.timeEntries : []).filter((e) => toDate(e?.clockIn));
    const mine = entries.filter((e) => uploader && e.userId === uploader);

    if (at) {
      let best = null;
      for (const e of mine) {
        const start = toDate(e.clockIn);
        const end = entryEnd(e, now);
        if (start <= at && end && at <= end) {
          best = { points: WEIGHTS.clockedIn, reason: { code: "clocked_in", params: { name: uploaderName, place: placeOf(job), from: clockLabel(start, timezone) } } };
          break;
        }
        const gapStart = Math.abs(at - start) / MIN;
        const gapEnd = end ? Math.abs(at - end) / MIN : Infinity;
        const gap = Math.min(gapStart, gapEnd);
        if (gap <= NEAR_MINUTES) {
          const points = Math.max(
            WEIGHTS.clockedNearMin,
            Math.round(WEIGHTS.clockedNearMax * (1 - gap / NEAR_MINUTES)),
          );
          if (!best || points > best.points) {
            const before = at < start;
            best = {
              points,
              reason: {
                code: before ? "clocked_in_after" : "clocked_out_before",
                params: {
                  name: uploaderName,
                  place: placeOf(job),
                  minutes: Math.round(gap),
                  at: clockLabel(before ? start : end, timezone),
                },
              },
            };
          }
        }
      }
      if (best) found.push(best);
    } else if (day) {
      const worked = mine.find((e) => {
        const start = toDate(e.clockIn);
        const end = entryEnd(e, now);
        return start < day.end && end && end > day.start;
      });
      if (worked) {
        found.push({ points: WEIGHTS.workedThatDay, reason: { code: "worked_that_day", params: { name: uploaderName, place: placeOf(job) } } });
      }
    }

    // Visits — the plan, when the clock says nothing. Only the closest counts.
    const visits = (Array.isArray(job.visits) ? job.visits : []).filter(
      (v) => uploader && v?.assignedToId === uploader && toDate(v.scheduledAt),
    );
    let visit = null;
    for (const v of visits) {
      const when = toDate(v.scheduledAt);
      if (at && Math.abs(when - at) <= VISIT_HOURS * HOUR) {
        visit = { points: WEIGHTS.visitNear, reason: { code: "visit_near", params: { name: uploaderName, place: placeOf(job), at: clockLabel(when, timezone) } } };
        break;
      }
      if (day && when >= day.start && when < day.end && !visit) {
        visit = { points: WEIGHTS.visitSameDay, reason: { code: "visit_same_day", params: { name: uploaderName, place: placeOf(job), at: clockLabel(when, timezone) } } };
      }
    }
    if (visit) found.push(visit);

    if (found.length) uploaderHasTimeSignal = true;
    timeSignals.set(job.id, found);
  }

  // ── Second pass: everything else ─────────────────────────────────────────
  const scored = [];
  for (const job of uniqueJobs) {
    let score = 0;
    const reasons = [];
    const add = (points, reason) => {
      score += points;
      reasons.push({ ...reason, points });
    };

    if (receipt.contextJobId && receipt.contextJobId === job.id) {
      add(WEIGHTS.capturedHere, { code: "captured_here", params: { place: placeOf(job) } });
    }
    for (const s of timeSignals.get(job.id) || []) add(s.points, s.reason);

    if (!uploaderHasTimeSignal && at) {
      const other = (Array.isArray(job.timeEntries) ? job.timeEntries : []).find((e) => {
        if (!e?.userId || e.userId === uploader) return false;
        const start = toDate(e.clockIn);
        const end = entryEnd(e, now);
        return start && end && start <= at && at <= end;
      });
      if (other) {
        add(WEIGHTS.othersClockedIn, {
          code: "others_clocked_in",
          params: { name: nameOf(other.userId), place: placeOf(job) },
        });
      }
    }

    const siteArea = postalArea(job.sitePostalCode) || postalArea(job.siteAddress);
    if (storeArea && siteArea && storeArea === siteArea) {
      add(WEIGHTS.samePostalArea, { code: "same_postal_area", params: { store: storeName, area: storeArea, place: placeOf(job) } });
    } else if (receipt.vendorCity && (sameTown(receipt.vendorCity, job.siteCity) || sameTown(receipt.vendorCity, job.siteAddress))) {
      add(WEIGHTS.sameCity, { code: "same_city", params: { store: storeName, city: receipt.vendorCity } });
    }

    // Lines against the job's own words — the quote, the material list and
    // the title. A line matches on one shared significant word.
    const jobText = [job.title, ...(job.quoteLineNames || []), ...(job.materialNames || [])].join(" \n ");
    const jobWords = new Set(tokens(jobText));
    const matchedWords = new Set();
    let matchedLines = 0;
    for (const it of items) {
      if (OVERHEAD_KINDS.has(it.kind)) continue;
      const hit = tokens(it.description).filter((w) => jobWords.has(w));
      if (hit.length) {
        matchedLines += 1;
        hit.slice(0, 2).forEach((w) => matchedWords.add(w));
      }
    }
    if (matchedLines > 0) {
      add(Math.min(WEIGHTS.matchedLinesCap, matchedLines * WEIGHTS.perMatchedLine), {
        code: "lines_match",
        params: { count: matchedLines, words: [...matchedWords].slice(0, 3).join(", ") },
      });
    } else {
      const jobTrades = tradesIn(jobText);
      const shared = [...itemTrades].find((tr) => jobTrades.has(tr));
      if (shared) add(WEIGHTS.tradeMatch, { code: "trade_match", params: { trade: shared } });
    }

    const refDay = day;
    if (job.status === "in_progress") {
      add(WEIGHTS.inProgress, { code: "in_progress", params: {} });
    } else if (job.status === "scheduled" && refDay && toDate(job.startDate)) {
      const start = toDate(job.startDate);
      if (Math.abs(start - refDay.start) <= 36 * HOUR) add(WEIGHTS.startsNear, { code: "starts_near", params: {} });
    } else if (job.status === "completed" && refDay && toDate(job.completedAt)) {
      const done = toDate(job.completedAt);
      if (done <= refDay.end && refDay.start - done <= 2 * 24 * HOUR) add(WEIGHTS.justFinished, { code: "just_finished", params: {} });
    }

    if (score > 0) scored.push({ jobId: job.id, title: job.title || "", place: placeOf(job), score, reasons });
  }
  scored.sort((a, b) => b.score - a.score || a.jobId.localeCompare(b.jobId));

  // ── Overhead ─────────────────────────────────────────────────────────────
  const readable = items.filter((i) => i.cents !== null && i.cents > 0);
  const readableCents = readable.reduce((s, i) => s + i.cents, 0);
  const overheadCents = readable.filter((i) => OVERHEAD_KINDS.has(i.kind)).reduce((s, i) => s + i.cents, 0);
  const jobKindCents = readable.filter((i) => JOB_KINDS.has(i.kind)).reduce((s, i) => s + i.cents, 0);
  const byCategory = new Map();
  for (const i of readable.filter((x) => OVERHEAD_KINDS.has(x.kind))) {
    const c = categoryForKind(i.kind);
    byCategory.set(c, (byCategory.get(c) || 0) + i.cents);
  }
  const dominant = [...byCategory.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  const store = vendorHint(storeName);

  let overheadScore = 0;
  const overheadReasons = [];
  const addO = (points, reason) => {
    overheadScore += points;
    overheadReasons.push({ ...reason, points });
  };
  const share = readableCents > 0 ? overheadCents / readableCents : 0;
  if (share >= 0.6) {
    addO(WEIGHTS.overheadItems, { code: "overhead_items", params: { percent: Math.round(share * 100), category: dominant } });
  }
  if (store) addO(WEIGHTS.overheadStore, { code: "overhead_store", params: { store: storeName, category: store.category } });

  const anyTimeSignal = scored.some((s) => s.reasons.some((r) => TIME_CODES.has(r.code)));
  if (at && !anyTimeSignal) {
    const clock = localClock(at, timezone);
    const weekend = clock && (clock.weekday === 0 || clock.weekday === 6);
    const offHours = clock && (clock.hour < WORK_START_HOUR || clock.hour >= WORK_END_HOUR);
    if (weekend || offHours) {
      addO(WEIGHTS.afterHours, { code: "after_hours", params: { time: clockLabel(at, timezone), weekend: Boolean(weekend) } });
    }
  }
  if (!uniqueJobs.length) addO(WEIGHTS.noActiveJob, { code: "no_active_job", params: {} });
  if (readableCents > 0 && jobKindCents / readableCents >= 0.6) overheadScore -= WEIGHTS.jobItemsPenalty;

  const overheadCategory = dominant || store?.category || null;
  const overhead =
    overheadScore >= 20
      ? { category: overheadCategory || "Other", score: overheadScore, reasons: overheadReasons }
      : null;

  // ── Confidence: marked DOWN whenever two answers are close ───────────────
  // The rival of the leader is the runner-up OR overhead, whichever is closer;
  // every answer below the leader has the leader as its rival, so only the
  // leader can ever be "high".
  const top = scored.slice(0, 3).map((s, i) => {
    const rival =
      i === 0
        ? Math.max(scored[1]?.score ?? 0, overhead?.score ?? 0)
        : Math.max(scored[0].score, overhead?.score ?? 0);
    return { ...s, confidence: confidenceFor(s.score, s.score - rival) };
  });
  if (overhead) {
    const rival = top[0]?.score ?? 0;
    overhead.confidence = confidenceFor(overhead.score, overhead.score - rival);
  }

  // ── A split, when the lines point two ways ───────────────────────────────
  //
  // Materials to the best job, the fuel / lunch / phone lines to overhead.
  // Offered only when both halves are real money (a dollar or more) and the
  // job is a real candidate — otherwise it is noise on a simple receipt.
  let split = null;
  const lead = top[0];
  if (lead && lead.score >= 35 && readable.length === items.length && items.length > 1) {
    const jobLines = items.filter((i) => !OVERHEAD_KINDS.has(i.kind));
    const ohLines = items.filter((i) => OVERHEAD_KINDS.has(i.kind));
    const sum = (list) => list.reduce((s, i) => s + (i.cents || 0), 0);
    if (jobLines.length && ohLines.length && sum(jobLines) >= 100 && sum(ohLines) >= 100) {
      const groups = [{ kind: "job", jobId: lead.jobId, category: "Materials", lineIndexes: jobLines.map((i) => i.index) }];
      const perCat = new Map();
      for (const i of ohLines) {
        const c = categoryForKind(i.kind);
        if (!perCat.has(c)) perCat.set(c, []);
        perCat.get(c).push(i.index);
      }
      for (const [category, lineIndexes] of perCat) groups.push({ kind: "overhead", jobId: null, category, lineIndexes });
      split = { groups };
    }
  }

  let best = null;
  if (lead && lead.score >= 35 && lead.score >= (overhead?.score ?? 0)) best = "job";
  else if (overhead && overhead.score >= 35) best = "overhead";

  return { jobs: top, overhead, split, best };
}

const TIME_CODES = new Set([
  "clocked_in",
  "clocked_in_after",
  "clocked_out_before",
  "worked_that_day",
  "visit_near",
  "visit_same_day",
  "others_clocked_in",
]);

/**
 * high   — a strong score AND a clear lead over the next answer
 * medium — a real score, or a strong one with a close rival
 * low    — anything else; shown, never pre-selected
 */
export function confidenceFor(score, lead) {
  if (score >= 60 && lead >= 20) return "high";
  if (score >= 35) return "medium";
  return "low";
}
