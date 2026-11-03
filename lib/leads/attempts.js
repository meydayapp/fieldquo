// lib/leads/attempts.js
//
// What has been TRIED on a lead, and whether another try is owed today.
//
// ── What this is for ───────────────────────────────────────────────────────
//
// The owner, on the single `contacted` status: "for contacted. we should
// probably also note if we left voicemail, texted or emailed or called". And
// on the dashboard: "we should have a reminder so it doesn't fall through the
// cracks FFM say to call 2 to 3x per day."
//
// `LeadStatus.contacted` says somebody did something once. A cadence of two to
// three calls a day cannot live in an enum, so attempts are a log
// (LeadContactAttempt) and this module is the arithmetic over it.
//
// ══ An attempt is OUTBOUND. It is not contact. ════════════════════════════
//
// This is the one thing in this file that would be a real defect to get
// wrong, so it is stated before anything else.
//
// A call nobody answered and a voicemail nobody returned are attempts. They
// are evidence that somebody TRIED, and they are evidence of nothing at all
// about whether the homeowner has been reached. Only two things stop the
// follow-up sequence: an inbound reply FieldQuo can see (MessageThread), and
// a human saying so (LeadRequest.reachedAt).
//
// If an attempt ever stopped the chase, FieldQuo would go quiet on a lead
// precisely BECAUSE nobody had got hold of them — three unanswered calls
// would read as success. So lib/followUps/stopConditions.js has no notion of
// an attempt, cannot import this file, and scripts/check-lead-attempts.mjs
// asserts both.
//
// ══ And nothing in the log is invented ════════════════════════════════════
//
// `source` is "system" only for a send FieldQuo genuinely made — the
// follow-up cron's own email and its own text, recorded as it sends them. A
// call and a voicemail are always "manual", because FieldQuo cannot see a
// phone call and must not claim one happened. There is no inference anywhere
// in here: an attempt exists because somebody made it or because FieldQuo
// made it, never because something looked likely.
//
// Pure. No database, no clock of its own.

/**
 * The kinds, and which of them FieldQuo may record for itself.
 *
 * `manualOnly` is the honest half: FieldQuo has no way to know a phone rang,
 * so a call and a voicemail can only ever come from a person pressing a
 * button. An email and a text it sent itself, it knows about.
 */
export const ATTEMPT_KINDS = Object.freeze({
  call: { manualOnly: true, labelKey: "app.leads.attempt.kind.call" },
  voicemail: { manualOnly: true, labelKey: "app.leads.attempt.kind.voicemail" },
  text: { manualOnly: false, labelKey: "app.leads.attempt.kind.text" },
  email: { manualOnly: false, labelKey: "app.leads.attempt.kind.email" },
});

/** The kinds, in the order a screen offers them. */
export const ATTEMPT_KIND_KEYS = Object.freeze(Object.keys(ATTEMPT_KINDS));

/** Where a row came from. "system" is only ever a send FieldQuo made. */
export const ATTEMPT_SOURCES = Object.freeze(["manual", "system"]);

/**
 * A kind a caller may store, or null.
 *
 * Refused rather than folded into "other", unlike the SMS purposes next door:
 * an unknown purpose still needs TRACKING, but an unknown attempt kind is a
 * client sending nonsense, and storing it would put a word nobody can
 * translate on a contractor's screen.
 */
export function cleanAttemptKind(value) {
  const k = String(value ?? "").trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(ATTEMPT_KINDS, k) ? k : null;
}

/** May FieldQuo record this kind for itself? */
export function kindMayBeSystem(kind) {
  const k = cleanAttemptKind(kind);
  return Boolean(k) && ATTEMPT_KINDS[k].manualOnly === false;
}

/**
 * The company's daily call target.
 *
 * 0 is a legal, meaningful value: it switches the nudge off, which a company
 * that finds it nagging has to be able to do. Anything unreadable falls back
 * to the column default rather than to zero — a missing select must not read
 * as "this company opted out".
 */
export const DEFAULT_CALLS_PER_DAY = 2;

export function callsPerDay(company) {
  const n = Number(company?.leadCallsPerDay);
  if (!Number.isFinite(n)) return DEFAULT_CALLS_PER_DAY;
  if (n < 0) return 0;
  // A ceiling, because this multiplies into real money on the text channel
  // and into real nuisance on the phone. Nobody is chasing one homeowner
  // twenty times a day.
  return Math.min(10, Math.floor(n));
}

/**
 * Local midnight in the company's own zone.
 *
 * "Two calls a day" is two calls in the contractor's day, not in UTC's. A
 * company in Gatineau starting at 8am would otherwise have its count reset
 * mid-morning, five hours into the working day.
 *
 * Falls back to the host's own midnight for a company with no zone set,
 * which is what every other date boundary in this product does.
 */
export function dayStart(now = new Date(), timeZone = null) {
  const d = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(d.getTime())) return null;
  if (!timeZone) {
    const local = new Date(d);
    local.setHours(0, 0, 0, 0);
    return local;
  }
  try {
    // The calendar date as the company sees it, turned back into an instant.
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).formatToParts(d);
    const get = (type) => Number(parts.find((p) => p.type === type)?.value);
    const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
    const offset = asUtc - d.getTime();
    return new Date(Date.UTC(get("year"), get("month") - 1, get("day")) - offset);
  } catch {
    // An invalid IANA zone throws RangeError. The company typed it; better
    // the host's midnight than no count at all.
    const local = new Date(d);
    local.setHours(0, 0, 0, 0);
    return local;
  }
}

/**
 * How a lead stands against the company's cadence today.
 *
 * @param attempts  this lead's rows, any order
 * @param company   needs leadCallsPerDay and timezone
 * @returns {{ target: number, today: number, owed: number, lastAt: Date|null,
 *             lastKind: string|null, byKind: object }}
 *
 * `owed` is what the dashboard shows. It counts CALLS and VOICEMAILS only,
 * against a target the owner described in calls — a text and an email are
 * recorded and shown, but they do not discharge a call target, because the
 * cadence he was given is "call 2 to 3x per day" and silently letting an
 * automated email tick that box would be the software marking its own
 * homework.
 */
export function attemptStanding({ attempts = [], company = null, now = new Date() } = {}) {
  const rows = (Array.isArray(attempts) ? attempts : []).filter((a) => a && cleanAttemptKind(a.kind));
  const target = callsPerDay(company);
  const from = dayStart(now, company?.timezone || null);

  const byKind = {};
  let today = 0;
  let lastAt = null;
  let lastKind = null;
  for (const a of rows) {
    const kind = cleanAttemptKind(a.kind);
    const at = a.at ? new Date(a.at) : null;
    if (!at || Number.isNaN(at.getTime())) continue;
    byKind[kind] = (byKind[kind] || 0) + 1;
    if (!lastAt || at.getTime() > lastAt.getTime()) {
      lastAt = at;
      lastKind = kind;
    }
    // Only the kinds the target is expressed in.
    if (from && at.getTime() >= from.getTime() && ATTEMPT_KINDS[kind].manualOnly) today++;
  }
  return {
    target,
    today,
    owed: target === 0 ? 0 : Math.max(0, target - today),
    lastAt,
    lastKind,
    byKind,
  };
}

/**
 * Should the dashboard flag this lead as owed another attempt?
 *
 * Deliberately NOT "has any attempt been made" — a lead nobody has touched is
 * owed its first one, which is the case the nudge exists for. `target === 0`
 * is the company switching the nudge off and answers false for every lead.
 */
export function attemptOwed({ attempts = [], company = null, now = new Date() } = {}) {
  return attemptStanding({ attempts, company, now }).owed > 0;
}
