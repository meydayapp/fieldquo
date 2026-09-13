// lib/sales/retryRules.js
//
// When a prospect that did not answer gets rung again — and when it stops.
//
// ══ The model, and where it came from ══════════════════════════════════════
//
// OMniLeads (LGPL-3.0, read for design only — never copied) attaches to each
// dialler campaign one rule per telephony outcome: busy, no answer, answering
// machine, rejected, timeout. Each rule is two numbers — how many attempts
// before the contact is finished, and how long to wait before the next one —
// plus a mode that either keeps the wait fixed or multiplies it on each try.
// A contact whose rule runs out is out of the campaign until somebody reloads
// the list.
//
// That is the shape here, narrowed to what FieldQuo's dispositions actually
// say (lib/sales/calls/dispositions.js is the vocabulary; this table has one
// row per code, and scripts/check-sales-retry-pool.mjs refuses a code without
// one). Two things are added and one is left out:
//
//   ADDED — time-block rotation. A contractor who did not pick up at ten in
//   the morning is on a roof at ten in the morning; ringing them at ten
//   tomorrow is the same call again. So a "no answer" retry is aimed at a
//   DIFFERENT part of their day — morning, midday, afternoon, evening, in the
//   PROSPECT's zone — and the rotation walks round so successive attempts
//   cover different parts of the day. OMniLeads has no notion of this because a call
//   centre dialler is fed by a list, not by a person's working pattern.
//
//   ADDED — the calling window. A retry is never scheduled inside a shut
//   window (lib/sales/callingWindow.js's rule, or the jurisdiction's own when
//   the caller hands one in). The instant rolls forward to the first open
//   minute of the target block. Scheduling "15 minutes after a busy tone at
//   21:25" to 21:40 would put a due retry at the top of a rep's list that the
//   dial gate then refuses — the dead control in a queue.
//
//   LEFT OUT — the multiplying mode. Backoff exists in a dialler to stop a
//   machine hammering one number; here the rotation already spaces the
//   attempts across a day and the ceilings are small, so a multiplier would be
//   a second knob that does the same job less legibly.
//
// ══ The defaults, and why each number ══════════════════════════════════════
//
// The owner's numbers, 2026-09-13, from Belkins' published cold-call
// benchmark (175,000 dials): 9.9 % of dials connect, which compounds to
// 24.5 % of PROSPECTS reached across roughly three attempts — and the
// fourth attempt adds almost nothing. So three attempts is where a business
// nobody has reached goes back to the pool, and the retry is the SAME DAY,
// two hours on, because the benchmark's connect rate is a property of the
// hour and the day (see lib/sales/callWindowScore.js), not of the calendar:
// the second try should land in a different hour of the day the rep is
// already dialling, not tomorrow.
//
//   no_answer   2 h later, SAME DAY, next block, 3 attempts.  Two hours from
//               ten is midday; from three is evening. The instant stays
//               inside today's window when the delay lands there — the
//               rotation yields to the day — and rolls to tomorrow's first
//               open minute of the next block only when today is shut.
//               Three attempts, then the pool: Belkins' fourth attempt is
//               a dial that reaches nobody.
//   busy        15 min later, same block, 6 attempts.  An engaged tone means
//               they are at the phone; the right time to ring back is soon.
//               No rotation, because being on another call at ten says
//               nothing about ten being a bad hour. Six because each try is
//               cheap and a busy signal is the warmest of the three misses.
//   voicemail   2 days later, next block, 3 attempts.  A message left in the
//               rep's own voice is a message; ringing again the same
//               afternoon reads as pestering and a third message on one
//               machine is the point where a business starts screening the
//               number. Two days gives them a chance to ring back — and the
//               inbound path files that call on the same row.
//   gatekeeper  1 day later, next block, 4 attempts.  Somebody answered but
//               not the owner. The owner keeps hours the receptionist does
//               not, which is exactly what rotation is for.
//   callback    the agreed time, no ceiling.  A promise with a time in it is
//               not a retry; the attempt is counted but nothing here can
//               exhaust it.
//   everything else is FINAL: the pitch happened, or the number is dead, or
//   they asked to be left alone. The dial is counted and the pool clock stops.
//
// The ceiling is compared against the TOTAL dispositioned dials on the row,
// not against a per-outcome count. Two no-answers and then a voicemail is
// three attempts at one business, and the voicemail rule (ceiling 3) closes
// it — the rule that fires is the one for the outcome just recorded, which
// is the freshest fact about how this business answers its phone.
//
// ══ The table is a DEFAULT; the platform may override it ══════════════════
//
// Until 2026-09-13 the numbers were constants and the platform screen said
// why they could not be edited: a number without its sentence. The owner
// wanted the numbers his — and they will move again as the funnel is
// measured — so each retry-kind rule may be overridden by a SalesRetryRule
// row (one per outcome; prisma/schema.prisma), edited on
// /platform/sales/retry-pool by a superadmin, audited on every save. The
// row carries the same four numbers this table does plus who set them and
// an optional note; the table's `why` stays beside the number on the screen
// so the reason is never lost, and "Reset to defaults" WRITES these numbers
// into the rows rather than deleting anything.
//
// The merge is effectiveRetryRules(), pure: a row for an outcome whose
// default kind is not `retry` is ignored (a callback has no delay to edit,
// a final outcome no ceiling), and a value outside the sane range falls
// back to the default for that one field. Every function below takes the
// merged table as a parameter and defaults to this one, so the rule is
// still executable against a bare instant with no database in the room.
// lib/sales/retryPool.js loads the rows once per request and hands the
// table down.
//
// ══ Pure ══════════════════════════════════════════════════════════════════
//
// No db, no clock of its own, no imports beyond the window rule. Everything
// in here is executed against fixture instants by
// scripts/check-sales-retry-pool.mjs — the block rotation, the window roll,
// the ceiling, an unknown zone, a callback, a final outcome.

import { SALES_CALL_WINDOW, localTimeIn } from "./callingWindow";

/** The parts of a prospect's day, in rotation order. */
export const RETRY_BLOCKS = Object.freeze(["morning", "midday", "afternoon", "evening"]);

/**
 * Where each block sits on a local clock, in minutes from midnight.
 *
 * "Morning" runs from midnight and "evening" to midnight on purpose: the
 * calling window clips them (nobody is rung at 03:00 — the window rule says
 * so, not this table), and a window that opens at 10:00 on a weekend still
 * has a morning. Midday is the two hours a contractor is most likely in the
 * van with the phone in reach; afternoon is the site; evening is the office.
 */
export const RETRY_BLOCK_BOUNDS = Object.freeze({
  morning: Object.freeze({ startMinute: 0, endMinute: 12 * 60 }),
  midday: Object.freeze({ startMinute: 12 * 60, endMinute: 14 * 60 }),
  afternoon: Object.freeze({ startMinute: 14 * 60, endMinute: 17 * 60 }),
  evening: Object.freeze({ startMinute: 17 * 60, endMinute: 24 * 60 }),
});

export const RETRY_KIND_RETRY = "retry";
export const RETRY_KIND_CALLBACK = "callback";
export const RETRY_KIND_FINAL = "final";

/**
 * One row per disposition code — the DEFAULT table. The English beside each
 * is what the platform's rule table prints; the numbers are the rule until a
 * SalesRetryRule row says otherwise (effectiveRetryRules).
 *
 * `sameDay` — for a retry: when the delayed instant is still inside today's
 * window in the prospect's zone, that instant is taken even if the block
 * rotation would prefer tomorrow. False means the rotation decides alone.
 */
export const RETRY_RULES = Object.freeze({
  no_answer: Object.freeze({
    kind: RETRY_KIND_RETRY,
    delayMinutes: 2 * 60,
    sameDay: true,
    maxAttempts: 3,
    rotateBlock: true,
    why: "Belkins, 175k dials: 24.5% of prospects are reached inside three attempts and a fourth adds almost nothing. Two hours on, the same day, in a different part of their day.",
  }),
  busy: Object.freeze({
    kind: RETRY_KIND_RETRY,
    delayMinutes: 15,
    sameDay: true,
    maxAttempts: 6,
    rotateBlock: false,
    why: "They are at the phone. Ring back soon, in the same part of the day.",
  }),
  voicemail: Object.freeze({
    kind: RETRY_KIND_RETRY,
    delayMinutes: 2 * 24 * 60,
    sameDay: false,
    maxAttempts: 3,
    rotateBlock: true,
    why: "A message was left. Two days to ring back before a second one; three messages is the limit.",
  }),
  gatekeeper: Object.freeze({
    kind: RETRY_KIND_RETRY,
    delayMinutes: 24 * 60,
    sameDay: false,
    maxAttempts: 4,
    rotateBlock: true,
    why: "The owner keeps different hours from whoever answered. Try a different part of the day.",
  }),
  callback: Object.freeze({
    kind: RETRY_KIND_CALLBACK,
    delayMinutes: null,
    sameDay: false,
    maxAttempts: null,
    rotateBlock: false,
    why: "The time they agreed to. Not a retry, and nothing here can exhaust it.",
  }),
  reached_interested: Object.freeze({ kind: RETRY_KIND_FINAL, delayMinutes: null, sameDay: false, maxAttempts: null, rotateBlock: false, why: "The pitch happened. The rep owns it from here." }),
  agreed_link_sent: Object.freeze({ kind: RETRY_KIND_FINAL, delayMinutes: null, sameDay: false, maxAttempts: null, rotateBlock: false, why: "They agreed on the call and have the signup link. Nothing left to ring about." }),
  reached_not_interested: Object.freeze({ kind: RETRY_KIND_FINAL, delayMinutes: null, sameDay: false, maxAttempts: null, rotateBlock: false, why: "They heard it and said no." }),
  do_not_call: Object.freeze({ kind: RETRY_KIND_FINAL, delayMinutes: null, sameDay: false, maxAttempts: null, rotateBlock: false, why: "They asked. Permanent." }),
  bad_number: Object.freeze({ kind: RETRY_KIND_FINAL, delayMinutes: null, sameDay: false, maxAttempts: null, rotateBlock: false, why: "Nothing to ring. The row goes to review." }),
  not_a_fit: Object.freeze({ kind: RETRY_KIND_FINAL, delayMinutes: null, sameDay: false, maxAttempts: null, rotateBlock: false, why: "Not a business we sell to. The row goes to review." }),
});

/** The same table under the name the platform screen and the reset use. */
export const RETRY_RULE_DEFAULTS = RETRY_RULES;

/**
 * The bounds a platform edit is held to. Wider than any sane value, narrow
 * enough that a typo (2 000 attempts, a 0-minute wait) falls back to the
 * default for that field rather than reaching a rep's queue.
 */
export const RETRY_DELAY_MIN_MINUTES = 5;
export const RETRY_DELAY_MAX_MINUTES = 30 * 24 * 60;
export const RETRY_ATTEMPTS_MIN = 1;
export const RETRY_ATTEMPTS_MAX = 20;

/** Is this whole-number `n` inside [lo, hi]? */
function within(n, lo, hi) {
  return Number.isInteger(n) && n >= lo && n <= hi;
}

/**
 * The table a request runs on: the defaults, with each retry-kind rule's
 * numbers replaced by its SalesRetryRule row where the row has a usable
 * value. Pure — the rows are whatever the caller read.
 *
 * @param rows  `[{ outcome, delayMinutes, sameDay, maxAttempts, rotateBlock,
 *              note?, updatedById?, updatedAt? }]`; anything else is ignored.
 * @returns the same shape as RETRY_RULES, frozen, with `source` on each rule
 *          ("default" | "override") and, on an override, `note`, `updatedById`,
 *          `updatedAt` for the platform screen to print beside the number.
 */
export function effectiveRetryRules(rows = []) {
  const byOutcome = new Map();
  for (const r of Array.isArray(rows) ? rows : []) {
    if (r && typeof r.outcome === "string") byOutcome.set(r.outcome, r);
  }
  const out = {};
  for (const code of Object.keys(RETRY_RULES)) {
    const d = RETRY_RULES[code];
    const row = byOutcome.get(code);
    if (!row || d.kind !== RETRY_KIND_RETRY) {
      out[code] = Object.freeze({ ...d, source: "default" });
      continue;
    }
    const delay = Number(row.delayMinutes);
    const max = Number(row.maxAttempts);
    out[code] = Object.freeze({
      kind: d.kind,
      delayMinutes: within(delay, RETRY_DELAY_MIN_MINUTES, RETRY_DELAY_MAX_MINUTES) ? delay : d.delayMinutes,
      sameDay: typeof row.sameDay === "boolean" ? row.sameDay : d.sameDay,
      maxAttempts: within(max, RETRY_ATTEMPTS_MIN, RETRY_ATTEMPTS_MAX) ? max : d.maxAttempts,
      rotateBlock: typeof row.rotateBlock === "boolean" ? row.rotateBlock : d.rotateBlock,
      why: d.why,
      source: "override",
      note: typeof row.note === "string" && row.note.trim() ? row.note.trim() : null,
      updatedById: typeof row.updatedById === "string" ? row.updatedById : null,
      updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : typeof row.updatedAt === "string" ? row.updatedAt : null,
    });
  }
  return Object.freeze(out);
}

/**
 * Is this a table effectiveRetryRules() (or RETRY_RULES itself) produced?
 * Anything else — undefined, a rows array handed in by mistake — reads as
 * the defaults, so a caller that forgot the parameter gets yesterday's
 * behaviour rather than a crash inside a transaction.
 */
function tableOf(rules) {
  return rules && typeof rules === "object" && !Array.isArray(rules) && Object.hasOwn(rules, "no_answer") ? rules : RETRY_RULES;
}

/** The highest retry ceiling in a table — the M in "Retry N of M" before a first dial. */
export function maxAttemptsOf(rules = RETRY_RULES) {
  return Math.max(...Object.values(tableOf(rules)).map((r) => (Number.isFinite(r.maxAttempts) ? r.maxAttempts : 0)));
}

/** Every code the table knows, in the order the platform prints them. */
export const RETRY_RULE_ORDER = Object.freeze(Object.keys(RETRY_RULES));

/** The highest ceiling any DEFAULT retry rule sets — the growth model's constant. */
export const RETRY_MAX_ATTEMPTS = maxAttemptsOf(RETRY_RULES);

/** How far the window roll will look before giving up. Longer than any gap a window has. */
const ROLL_LIMIT_MS = 8 * 24 * 60 * 60 * 1000;
const STEP_MS = 5 * 60 * 1000;

const isDate = (v) => v instanceof Date && !Number.isNaN(v.getTime());

function when(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/** The rule for a code in this table (the defaults when none is given), or null for a code the table does not know. */
export function retryRuleFor(code, rules = RETRY_RULES) {
  const table = tableOf(rules);
  return typeof code === "string" && Object.hasOwn(table, code) ? table[code] : null;
}

/**
 * The local calendar date of an instant in a zone, "YYYY-MM-DD" — or, for
 * several candidate zones, only when every one of them agrees (they do not
 * for the hour around midnight). Null for an unusable zone. What `sameDay`
 * compares.
 */
export function localDateOf(at, timeZone) {
  const zones = zonesOf(timeZone);
  if (zones.length === 0) return null;
  let seen = null;
  for (const zone of zones) {
    let key;
    try {
      key = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
    } catch {
      return null;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
    if (seen === null) seen = key;
    else if (seen !== key) return null;
  }
  return seen;
}

/** Is this a block name the rotation knows? */
export function isRetryBlock(value) {
  return typeof value === "string" && RETRY_BLOCKS.includes(value);
}

/**
 * Which block a local minute-of-day falls in. Total over 0–1439.
 */
export function blockOfMinute(minute) {
  const m = Number(minute);
  if (!Number.isFinite(m)) return null;
  for (const name of RETRY_BLOCKS) {
    const b = RETRY_BLOCK_BOUNDS[name];
    if (m >= b.startMinute && m < b.endMinute) return name;
  }
  return null;
}

/**
 * The candidate zones a `timeZone` argument names: one, or several for a
 * split subdivision (Ontario is Eastern AND Central — Kenora; Florida,
 * Texas, BC likewise). lib/sales/leadTimeZone.js hands back the candidates
 * when it cannot pick, and this module takes them rather than guessing the
 * populous half — the same refusal lib/sales/callingRules.js zoneAgreement
 * makes, for the same reason: absence of a stated zone is not a statement.
 */
function zonesOf(timeZone) {
  const list = Array.isArray(timeZone) ? timeZone : [timeZone];
  return list.filter((z) => typeof z === "string" && z.trim());
}

/**
 * Which block an instant falls in. With several candidate zones, the block
 * only when EVERY candidate agrees (they are an hour apart, so they disagree
 * for the hour around each boundary) — null otherwise, which the roll reads
 * as "not this minute" and steps past. Null for an unusable zone.
 */
export function blockOf(at, timeZone) {
  const zones = zonesOf(timeZone);
  if (zones.length === 0) return null;
  let seen = null;
  for (const zone of zones) {
    const local = localTimeIn(zone, at);
    if (!local) return null;
    const b = blockOfMinute(local.minute);
    if (seen === null) seen = b;
    else if (seen !== b) return null;
  }
  return seen;
}

/** The block after this one, round the clock. Null in → morning (the day's first). */
export function nextBlockAfter(block) {
  if (!isRetryBlock(block)) return RETRY_BLOCKS[0];
  return RETRY_BLOCKS[(RETRY_BLOCKS.indexOf(block) + 1) % RETRY_BLOCKS.length];
}

/**
 * Is the window open at this instant in this zone?
 *
 * The same reading lib/sales/callingWindow.js makes, over any window of the
 * same shape — `{ weekday, weekend, closedWeekdays? }`, the shape every
 * jurisdiction row in lib/sales/callingRules.js also has, so a caller can
 * hand in the state's own window instead of the Canadian default. Null for
 * an unusable zone: "cannot tell" is not "open".
 */
export function windowOpenAt(at, timeZone, window = SALES_CALL_WINDOW) {
  const zones = zonesOf(timeZone);
  if (zones.length === 0 || !window) return null;
  // Several candidates: open only when every one of them is — the
  // three-valued agreement callingRules' zoneAgreement() gives, so a split
  // province is rung in the hour both halves allow and never the hour only
  // one does.
  let seen = null;
  for (const zone of zones) {
    const local = localTimeIn(zone, at);
    if (!local) return null;
    const closed = Array.isArray(window.closedWeekdays) ? window.closedWeekdays : [];
    const isWeekend = local.weekday === 0 || local.weekday === 6;
    const bounds = isWeekend ? window.weekend : window.weekday;
    if (!bounds) return null;
    const inside = !closed.includes(local.weekday) && local.minute >= bounds.startMinute && local.minute < bounds.endMinute;
    if (seen === null) seen = inside;
    else if (seen !== inside) return false;
  }
  return seen;
}

/**
 * The first instant at or after `from` that is inside the window and — when
 * a block is named — inside that block. Five-minute steps from a five-minute
 * boundary, the way callingRules' nextOpening() walks, for the same reason:
 * every bound in every window falls on :00 or :30. Null when eight days find
 * nothing, which means the zone or the window is broken, not that the wait
 * is long.
 */
export function rollToOpen({ from, timeZone, window = SALES_CALL_WINDOW, block = null } = {}) {
  const start = when(from);
  if (!start) return null;
  let t = Math.ceil(start.getTime() / STEP_MS) * STEP_MS;
  const limit = start.getTime() + ROLL_LIMIT_MS;
  while (t <= limit) {
    const at = new Date(t);
    const open = windowOpenAt(at, timeZone, window);
    if (open === null) return null;
    if (open && (!block || blockOf(at, timeZone) === block)) return at;
    t += STEP_MS;
  }
  return null;
}

/**
 * The decision: given what just happened, when is the next dial, and is
 * there one.
 *
 * @param outcome      a DISPOSITIONS code.
 * @param attemptCount dispositioned dials BEFORE this one (Prospect.attemptCount).
 * @param now          when the disposition was recorded.
 * @param timeZone     the PROSPECT's zone (lib/sales/leadTimeZone.js's
 *                     answer) — or its candidate zones, as an array, for a
 *                     split subdivision nobody has resolved — or null when
 *                     nobody knows it.
 * @param lastBlock    the block the dial just made was aimed at, when the
 *                     zone cannot say which block it actually landed in.
 * @param window       the calling window to honour; the Canadian default,
 *                     or the jurisdiction's own.
 * @param callbackAt   for the callback outcome only: the agreed time.
 * @param rules        the table to run on — effectiveRetryRules()'s answer
 *                     for this request, or the defaults.
 *
 * @returns {{ kind, attemptCount, nextAttemptAt: Date|null, block: string|null,
 *            exhausted: boolean, maxAttempts: number|null, zoneKnown: boolean }}
 *          `attemptCount` is the count AFTER this dial. `exhausted` true means
 *          the row leaves the pool; `nextAttemptAt` is then null.
 */
export function nextAttempt({
  outcome,
  attemptCount = 0,
  now = new Date(),
  timeZone = null,
  lastBlock = null,
  window = SALES_CALL_WINDOW,
  callbackAt = null,
  rules = RETRY_RULES,
} = {}) {
  const at = when(now) || new Date();
  const before = Number.isFinite(Number(attemptCount)) && Number(attemptCount) > 0 ? Math.floor(Number(attemptCount)) : 0;
  const count = before + 1;
  const rule = retryRuleFor(outcome, rules);
  // Known when every candidate zone is one Intl can read — one zone, or a
  // split subdivision's several; see zonesOf().
  const candidates = zonesOf(timeZone);
  const zoneKnown = candidates.length > 0 && candidates.every((z) => Boolean(localTimeIn(z, at)));
  const base = { attemptCount: count, exhausted: false, zoneKnown, maxAttempts: rule?.maxAttempts ?? null };

  // An outcome the table does not know is treated as final and SAID to be:
  // the check holds the table total, so this branch is a guard, not a path.
  if (!rule || rule.kind === RETRY_KIND_FINAL) {
    return { ...base, kind: RETRY_KIND_FINAL, nextAttemptAt: null, block: null };
  }

  if (rule.kind === RETRY_KIND_CALLBACK) {
    const cb = when(callbackAt);
    return {
      ...base,
      kind: RETRY_KIND_CALLBACK,
      // No agreed time is a promise nobody made; planDisposition already
      // refuses it, so null here is "nothing to schedule", not "now".
      nextAttemptAt: cb,
      block: cb && zoneKnown ? blockOf(cb, timeZone) : null,
    };
  }

  // ── A retry ──────────────────────────────────────────────────────────
  if (count >= rule.maxAttempts) {
    return { ...base, kind: RETRY_KIND_RETRY, nextAttemptAt: null, block: null, exhausted: true };
  }

  const earliest = new Date(at.getTime() + rule.delayMinutes * 60 * 1000);

  if (!zoneKnown) {
    // Without a zone there is no block and no window to roll to. The delay
    // still stands, so the row is not offered again immediately; the dial
    // gate refuses an unknown zone anyway, and the row's own screen asks for
    // one. Scheduling nothing would hold the row out of the pool forever,
    // which is a quieter exhaustion than the real one.
    return { ...base, kind: RETRY_KIND_RETRY, nextAttemptAt: earliest, block: null };
  }

  let target = null;
  if (rule.rotateBlock) {
    // Move away from the block this dial actually landed in — the fact — and
    // only fall back to the block it was AIMED at when the clock cannot say.
    const landed = blockOf(at, timeZone) || (isRetryBlock(lastBlock) ? lastBlock : null);
    target = nextBlockAfter(landed);
  }
  let scheduled = rollToOpen({ from: earliest, timeZone, window, block: target });
  if (rule.sameDay) {
    // The owner's "two hours later, same day". The rotation's block wins
    // when it is still reachable TODAY in the prospect's zone (a no-answer
    // at 09:00 is rung at 12:00, midday — not at 11:00, which is the same
    // morning again). When the rotation would fall to tomorrow but today's
    // window is still open at the delayed instant, today wins: an evening
    // no-answer at 19:00 is rung at 21:00, not at 09:00 tomorrow. Only a
    // day that has shut by then is left to the rotation below.
    const today = localDateOf(at, timeZone);
    if (today && !(scheduled && localDateOf(scheduled, timeZone) === today)) {
      const soonest = rollToOpen({ from: earliest, timeZone, window, block: null });
      if (soonest && localDateOf(soonest, timeZone) === today) {
        return { ...base, kind: RETRY_KIND_RETRY, nextAttemptAt: soonest, block: blockOf(soonest, timeZone) };
      }
    }
  }
  if (!scheduled && target) {
    // A window that never intersects the target block (none in the table
    // does, but a superadmin override could). The next open minute is the
    // honest fallback — a retry, not a silent drop.
    scheduled = rollToOpen({ from: earliest, timeZone, window, block: null });
  }
  if (!scheduled) {
    // Nothing opens in eight days: the window is broken. Say so with the bare
    // delay rather than inventing an instant inside a window that has none.
    return { ...base, kind: RETRY_KIND_RETRY, nextAttemptAt: earliest, block: null };
  }
  return {
    ...base,
    kind: RETRY_KIND_RETRY,
    nextAttemptAt: scheduled,
    block: blockOf(scheduled, timeZone),
  };
}

/**
 * What a screen says about a row's place in the pool, from the row alone.
 *
 * @returns {{ attemptCount, maxAttempts, nextAttemptAt: Date|null, due: boolean,
 *            scheduled: boolean, exhausted: boolean, exhaustedAt: Date|null,
 *            block: string|null, lastOutcome: string|null, recycledAt: Date|null }}
 *          `due` — a retry whose instant has passed: it outranks a fresh row.
 *          `scheduled` — a retry whose instant is still ahead: held back.
 *          `maxAttempts` is the ceiling of the LAST outcome's rule when it has
 *          one, else the highest ceiling in the table — "Retry 1 of 4" on a
 *          row nobody has rung reads as the plan, not as a fact.
 */
export function retryStateOf(prospect = {}, now = new Date(), rules = RETRY_RULES) {
  const at = when(now) || new Date();
  const count = Number.isFinite(Number(prospect?.attemptCount)) ? Math.max(0, Math.floor(Number(prospect.attemptCount))) : 0;
  const next = when(prospect?.nextAttemptAt);
  const exhaustedAt = when(prospect?.exhaustedAt);
  const rule = retryRuleFor(prospect?.lastOutcome, rules);
  const maxAttempts = Number.isFinite(rule?.maxAttempts) ? rule.maxAttempts : maxAttemptsOf(rules);
  const exhausted = Boolean(exhaustedAt);
  return {
    attemptCount: count,
    maxAttempts,
    nextAttemptAt: next,
    due: !exhausted && Boolean(next) && next.getTime() <= at.getTime(),
    scheduled: !exhausted && Boolean(next) && next.getTime() > at.getTime(),
    exhausted,
    exhaustedAt,
    block: isRetryBlock(prospect?.retryBlock) ? prospect.retryBlock : null,
    lastOutcome: typeof prospect?.lastOutcome === "string" ? prospect.lastOutcome : null,
    recycledAt: when(prospect?.recycledAt),
  };
}

/**
 * The Prisma `data` a recycle writes. The count starts again and the row is
 * back in the pool; the last outcome stays, because the history is the point.
 * Nothing here deletes anything.
 */
export function recycleData({ adminId, now = new Date() } = {}) {
  const at = when(now) || new Date();
  return {
    attemptCount: 0,
    nextAttemptAt: null,
    retryBlock: null,
    exhaustedAt: null,
    recycledAt: at,
    recycledById: typeof adminId === "string" && adminId ? adminId : null,
  };
}

/**
 * The claim-WHERE fragment: rows the pool may offer, by this rule alone.
 * Spread into a Prospect `where` as `AND: [retryAvailableWhere(now)]` — an
 * `AND` and not an `OR`, because the lease clause owns the top-level OR.
 *
 * `lt` rather than `lte`, and that is a deliberate millisecond: every
 * scripted matcher in this repo implements `lt` and throws on `lte` so a
 * proof cannot pass vacuously, and a retry due at exactly `now` is offered
 * on the next read.
 */
export function retryAvailableWhere(now = new Date()) {
  const at = when(now) || new Date();
  return {
    exhaustedAt: null,
    OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lt: at } }],
  };
}

/**
 * The platform's table: one row per rule, in order, with its words — and,
 * beside every retry-kind row, the DEFAULT numbers, so the screen can show
 * what "Reset to defaults" would write before it is pressed.
 */
export function retryRuleTable(rules = RETRY_RULES) {
  const table = tableOf(rules);
  return RETRY_RULE_ORDER.map((code) => {
    const r = table[code] || RETRY_RULES[code];
    const d = RETRY_RULES[code];
    return {
      code,
      kind: r.kind,
      delayMinutes: r.delayMinutes,
      sameDay: r.sameDay,
      maxAttempts: r.maxAttempts,
      rotateBlock: r.rotateBlock,
      why: r.why,
      editable: d.kind === RETRY_KIND_RETRY,
      source: r.source || "default",
      note: r.note || null,
      updatedById: r.updatedById || null,
      updatedAt: r.updatedAt || null,
      defaults: { delayMinutes: d.delayMinutes, sameDay: d.sameDay, maxAttempts: d.maxAttempts, rotateBlock: d.rotateBlock },
    };
  });
}

/**
 * The Prisma `data` a "Reset to defaults" writes for one outcome — the
 * default numbers, stamped with who pressed it. An upsert per retry-kind
 * outcome, never a delete: a row that says "the defaults, set by X on Y"
 * is a fact the audit trail can read; an absent row is only silence.
 */
export function retryRuleResetData(code, { adminId = null } = {}) {
  const d = RETRY_RULES[code];
  if (!d || d.kind !== RETRY_KIND_RETRY) return null;
  return {
    outcome: code,
    delayMinutes: d.delayMinutes,
    sameDay: d.sameDay,
    maxAttempts: d.maxAttempts,
    rotateBlock: d.rotateBlock,
    note: null,
    updatedById: typeof adminId === "string" && adminId ? adminId : null,
  };
}

/**
 * Validate one platform edit for one outcome. Pure; the route calls it per
 * row and refuses the whole save on the first refusal, so a form with one
 * bad cell writes nothing.
 *
 * @returns {{ ok: true, data }} | {{ ok: false, error }}
 */
export function retryRuleEditData(code, input = {}, { adminId = null } = {}) {
  const d = RETRY_RULES[code];
  if (!d) return { ok: false, error: `Unknown outcome "${code}".` };
  if (d.kind !== RETRY_KIND_RETRY) return { ok: false, error: `"${code}" is not a retry; it has no numbers to edit.` };
  const delay = Number(input?.delayMinutes);
  const max = Number(input?.maxAttempts);
  if (!within(delay, RETRY_DELAY_MIN_MINUTES, RETRY_DELAY_MAX_MINUTES)) {
    return { ok: false, error: `${code}: the wait must be a whole number of minutes between ${RETRY_DELAY_MIN_MINUTES} and ${RETRY_DELAY_MAX_MINUTES}.` };
  }
  if (!within(max, RETRY_ATTEMPTS_MIN, RETRY_ATTEMPTS_MAX)) {
    return { ok: false, error: `${code}: the ceiling must be a whole number of attempts between ${RETRY_ATTEMPTS_MIN} and ${RETRY_ATTEMPTS_MAX}.` };
  }
  if (typeof input?.sameDay !== "boolean" || typeof input?.rotateBlock !== "boolean") {
    return { ok: false, error: `${code}: sameDay and rotateBlock must each be true or false.` };
  }
  const note = typeof input?.note === "string" ? input.note.trim().slice(0, 500) : "";
  return {
    ok: true,
    data: {
      outcome: code,
      delayMinutes: delay,
      sameDay: input.sameDay,
      maxAttempts: max,
      rotateBlock: input.rotateBlock,
      note: note || null,
      updatedById: typeof adminId === "string" && adminId ? adminId : null,
    },
  };
}
