// lib/sales/checkin/plan.js
//
// Which check-in an attributed company is owed TODAY, whether a row for it
// already exists, and what number it would go to. Pure.
//
// ══ The gap this closes, measured in production ═══════════════════════════
//
// On 2026-09-12 the one company a rep had signed up through their link —
// Easy Roofers Inc., attributed 2026-09-10, activation earned — had no
// SalesCheckIn row and no lead pointing at it. The day-1 text the owner
// designed ("1 day after they sign up to see if they have any questions and
// make sure they completed the onboarding process") existed nowhere a rep
// could see it, because a draft was only ever produced by suggestionForThread
// INSIDE a texts thread whose lead had converted into the company. A company
// that signed up straight from the link has no lead and no thread, so the
// engine had a decision and no surface to put it on. The owner: "shouldn't it
// be somewhere so that I can see it in the demo".
//
// ══ What this file adds, and what it deliberately does not ════════════════
//
// It adds no rule. Whether a company is due, and why, is signals.js's
// decision and is taken here by calling checkInSignals() — the same function,
// the same evidence, the same suppressions. A second opinion about "due"
// would be the copy that rots (AGENTS.md failure class #4), and it would rot
// in the direction nobody notices: a backlog that quietly stops agreeing with
// the thread.
//
// What it decides on top of that decision is bookkeeping:
//
//   - which TOUCHPOINT the decision belongs to (day 1, day 7, the milestone
//     approach), so a row can be keyed on it and materialised once;
//   - whether a row for that touchpoint already exists, and in what state;
//   - the next touchpoint after today, so a screen can say "day-7 check-in
//     upcoming Sep 17" without inventing a schedule;
//   - the number the text would go to, resolved from the company's own
//     record and never guessed.
//
// ══ One row per touchpoint, not one per day ═══════════════════════════════
//
// suggestionForThread keys its drafts `engine:<company>:<yyyy-mm-dd>` — one
// per company per DAY — because it is re-evaluated on every screen open and
// "not today" has to mean today. A materialised backlog is different: it is
// written by a job the rep does not press, and a job that wrote a fresh day-1
// draft every morning until somebody dealt with it is a nag aimed at the rep.
// So a scheduled touchpoint is keyed `scheduled:<company>:<touchpoint>`, it
// is created at most once, and a rep who put it away has put THAT touchpoint
// away — day 7 arrives on its own key.
//
// ══ The number, resolved honestly ═════════════════════════════════════════
//
// A signup carries the business's phone (Company.phone). When it is blank
// or not a number anybody can text, the owner's or an admin's Member.phone is
// next, then the phone on the rep's own lead for this company — which is the
// one field a rep can fill in themselves. When none of those holds a number
// the row is still written, with no number on it, so the screen can say "no
// number on file — add one" instead of the company silently never appearing.
// Absence of a number is a fact worth showing; skipping the row would hide it.
import {
  checkInSignals,
  RETENTION_NEAR_DAYS,
  SCHEDULED_CHECKIN_DAYS,
} from "./signals";
import { nextWindowOpening } from "./schedule";
import { normalisePhone } from "../suppressionRules";

const DAY_MS = 24 * 60 * 60 * 1000;

/** The touchpoint that is not a day number: the approach to the milestone. */
export const TOUCHPOINT_RETENTION = "retention";

/**
 * The states a company's check-in can be in, for a screen. Closed set.
 *
 *   due          the engine says due and no row exists for the touchpoint
 *   refresh      an untouched rule-worded draft for an EARLIER touchpoint is
 *                still open; it should be re-aimed rather than joined by a
 *                second draft (two open drafts is two texts)
 *   open         a draft is open for this company — nothing to add
 *   settled      the touchpoint's row was sent or put away
 *   not_due      the engine says not due (not suppressed) — `upcoming` says
 *                when the next touchpoint arrives
 *   suppressed   one of signals.js's SUPPRESSIONS applies; `code` names it
 *   no_signal    the engine found nothing (past the window, nothing wrong)
 */
export const PLAN_STATES = Object.freeze([
  "due",
  "refresh",
  "open",
  "settled",
  "not_due",
  "suppressed",
  "no_signal",
]);

/**
 * One engine draft per company per day — the on-open path's key.
 *
 * UTC rather than anybody's local day, deliberately: this key is never shown
 * and never compared with a displayed date, so a stable definition beats a
 * friendly one. Lives here rather than in store.js because store.js imports
 * the send path and this module must stay importable by anything.
 */
export function engineDedupeKey({ companyId, now = new Date() } = {}) {
  if (!companyId) return null;
  const at = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(at.getTime())) return null;
  return `engine:${companyId}:${at.toISOString().slice(0, 10)}`;
}

/** The materialised backlog's key: one per company per touchpoint. */
export function scheduledDedupeKey({ companyId, touchpoint } = {}) {
  if (!companyId) return null;
  const tp = touchpoint === TOUCHPOINT_RETENTION ? TOUCHPOINT_RETENTION : Number(touchpoint);
  if (tp !== TOUCHPOINT_RETENTION && !(Number.isInteger(tp) && tp > 0)) return null;
  return `scheduled:${companyId}:${tp}`;
}

/** The touchpoint a `scheduled:` key names, or null for any other key. */
export function touchpointOfKey(dedupeKey) {
  const m = /^scheduled:[^:]+:(\d+|retention)$/.exec(String(dedupeKey || ""));
  if (!m) return null;
  return m[1] === TOUCHPOINT_RETENTION ? TOUCHPOINT_RETENTION : Number(m[1]);
}

/**
 * Which touchpoint a due decision belongs to.
 *
 * A day number when signals.js raised one of the two scheduled touchpoints;
 * "retention" when the milestone is within RETENTION_NEAR_DAYS — whatever the
 * PRIMARY reason is. A company at day 50 with payouts still unconnected is
 * due for the milestone approach and the wording leads with payouts; the
 * touchpoint is the same one either way, so it is materialised once.
 *
 * Null for a reason-driven decision outside both: a failing card at day 30
 * is real and the thread's own suggestion raises it, but the backlog does
 * not write a fresh row for it every morning.
 */
export function touchpointOf(decision) {
  if (!decision?.due) return null;
  if (Number.isInteger(decision.scheduledDay)) return decision.scheduledDay;
  if ((decision.reasons || []).some((r) => r.code === "retention_milestone_near")) return TOUCHPOINT_RETENTION;
  return null;
}

/**
 * The number this company can be texted on, and where it came from.
 *
 * @param company  `{ phone, members: [{ role, phone }], leadPhone }`
 * @returns `{ e164, source }` — source one of "company" | "owner" | "admin" |
 *          "lead", or both null when nothing on the record is a number.
 */
export function resolveCompanyNumber({ phone = null, members = [], leadPhone = null } = {}) {
  const own = normalisePhone(phone);
  if (own) return { e164: own, source: "company" };
  const people = Array.isArray(members) ? members : [];
  for (const role of ["owner", "admin"]) {
    for (const m of people) {
      if (m?.role !== role) continue;
      const n = normalisePhone(m.phone);
      if (n) return { e164: n, source: role };
    }
  }
  const lead = normalisePhone(leadPhone);
  if (lead) return { e164: lead, source: "lead" };
  return { e164: null, source: null };
}

/** A Date, or null. Never "now" for something unreadable. */
function asDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * The next touchpoint after today, or null when there is none.
 *
 * Read off the same two constants the engine uses, so the screen's "upcoming"
 * and the engine's "due" cannot name different days. The instant is the
 * touchpoint's day plus the next opening of the texting window in the
 * company's zone; without a zone the bare instant is returned and `timed` is
 * false, so the screen shows a date and not a time it cannot honour.
 */
export function nextTouchpoint({ signedUpAt, dayInLife, retentionDate, timeZone = null, now = new Date() } = {}) {
  const signed = asDate(signedUpAt);
  if (!signed || !Number.isFinite(dayInLife)) return null;

  let touchpoint = null;
  let at = null;
  for (const day of [...SCHEDULED_CHECKIN_DAYS].sort((a, b) => a - b)) {
    if (day > dayInLife) {
      touchpoint = day;
      at = new Date(signed.getTime() + day * DAY_MS);
      break;
    }
  }
  if (touchpoint === null) {
    const milestone = asDate(retentionDate);
    if (!milestone) return null;
    const near = new Date(milestone.getTime() - RETENTION_NEAR_DAYS * DAY_MS);
    if (near.getTime() <= asDate(now)?.getTime()) return null;
    touchpoint = TOUCHPOINT_RETENTION;
    at = near;
  }

  const opening = timeZone ? nextWindowOpening(at, timeZone) : null;
  return { touchpoint, at: opening || at, timed: Boolean(opening) };
}

/**
 * Decide the backlog for one company.
 *
 * @param company        exactly the shape checkInSignals wants.
 * @param setup          stepsFor(snapshot) or null — see signals.setupFacts.
 * @param lastCheckInAt  when this rep last SENT to this company. Null is never.
 * @param retentionDays  the rep's plan window. No default — see signals.js.
 * @param trialEndsAt    optional, as signals.js takes it.
 * @param existing       this rep's SalesCheckIn rows for this company:
 *                       `[{ id, dedupeKey, status, scheduledFor, draftSource,
 *                       sendingStartedAt, sentAt }]`.
 * @param timeZone       the company's zone, or null.
 * @param now            injectable.
 *
 * @returns {{
 *   state: string, code: string|null, decision: object,
 *   touchpoint: number|"retention"|null, dedupeKey: string|null,
 *   scheduledFor: Date|null, timed: boolean,
 *   row: object|null, upcoming: object|null
 * }}
 *   `row` is the existing row the state refers to (open / settled / refresh).
 */
export function planCheckIn({
  company = null,
  setup = null,
  lastCheckInAt = null,
  retentionDays = null,
  trialEndsAt = null,
  existing = [],
  timeZone = null,
  now = new Date(),
} = {}) {
  const decision = checkInSignals({ company, setup, lastCheckInAt, retentionDays, trialEndsAt, now });
  const rows = Array.isArray(existing) ? existing.filter(Boolean) : [];

  const upcoming = nextTouchpoint({
    signedUpAt: company?.signedUpAt,
    dayInLife: decision.dayInLife,
    retentionDate: decision.retentionDate,
    timeZone,
    now,
  });

  const base = {
    decision,
    touchpoint: null,
    dedupeKey: null,
    scheduledFor: null,
    timed: false,
    row: null,
    upcoming,
  };

  if (decision.suppressed) {
    return { ...base, state: "suppressed", code: decision.suppressed.code };
  }

  // An open draft of any kind — the rep's own manual note included — means
  // the next action on this company is already written down. The one thing
  // worth doing to it is re-aiming it, below.
  const open = rows.find((r) => r.status === "draft");
  const touchpoint = touchpointOf(decision);

  if (!decision.due) {
    if (open) return { ...base, state: "open", code: null, row: open };
    return { ...base, state: decision.reasons?.length ? "not_due" : "no_signal", code: null };
  }

  if (touchpoint === null) {
    // Reason-driven and real, but not the backlog's to write daily. The
    // thread's own suggestion carries it; here it reads as not due for a
    // scheduled touchpoint, and `decision` still says why it matters.
    if (open) return { ...base, state: "open", code: null, row: open };
    return { ...base, state: "not_due", code: null };
  }

  const dedupeKey = scheduledDedupeKey({ companyId: company?.id, touchpoint });
  const keyed = rows.find((r) => r.dedupeKey === dedupeKey);
  if (keyed && keyed.status !== "draft") {
    return { ...base, state: "settled", code: keyed.status, touchpoint, dedupeKey, row: keyed };
  }
  if (keyed) {
    return { ...base, state: "open", code: null, touchpoint, dedupeKey, row: keyed };
  }

  const scheduledFor = timeZone ? nextWindowOpening(now, timeZone) : null;

  if (open) {
    // A rule-worded scheduled draft for an earlier touchpoint that nobody
    // touched: re-aim it. A draft the rep edited (draftSource "rep"), a
    // manual note, or one mid-send is left exactly as it is.
    const earlier = touchpointOfKey(open.dedupeKey);
    const untouched = open.draftSource === "rule" && !open.sendingStartedAt;
    const isEarlier =
      earlier !== null &&
      (touchpoint === TOUCHPOINT_RETENTION ? earlier !== TOUCHPOINT_RETENTION : earlier !== TOUCHPOINT_RETENTION && earlier < touchpoint);
    if (untouched && isEarlier) {
      return { ...base, state: "refresh", code: null, touchpoint, dedupeKey, scheduledFor, timed: Boolean(scheduledFor), row: open };
    }
    return { ...base, state: "open", code: null, touchpoint, dedupeKey, row: open };
  }

  return { ...base, state: "due", code: null, touchpoint, dedupeKey, scheduledFor, timed: Boolean(scheduledFor) };
}

/**
 * What one company's row on the "My companies" screen says about check-ins.
 *
 * Built from the plan and the rows, not from a second reading of either, so
 * the screen and the backlog cannot disagree. `next` is the draft the rep
 * should act on (open or just created); `lastSent` the most recent text
 * that actually went; `upcoming` the touchpoint after that.
 */
export function checkInSummary({ plan, existing = [], toE164 = null } = {}) {
  const rows = Array.isArray(existing) ? existing.filter(Boolean) : [];
  const sent = rows
    .filter((r) => r.status === "sent" && r.sentAt)
    .sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt))[0] || null;
  const open = rows.find((r) => r.status === "draft") || null;
  return {
    state: plan?.state || null,
    code: plan?.code || null,
    touchpoint: open ? touchpointOfKey(open.dedupeKey) ?? plan?.touchpoint ?? null : plan?.touchpoint ?? null,
    draft: open
      ? {
          id: open.id,
          toE164: open.toE164 || null,
          scheduledFor: open.scheduledFor || null,
          reasonCode: open.reasonCode || null,
        }
      : null,
    noNumber: open ? !open.toE164 : !toE164,
    lastSentAt: sent?.sentAt || null,
    upcoming: plan?.upcoming || null,
    dayInLife: plan?.decision?.dayInLife ?? null,
  };
}
