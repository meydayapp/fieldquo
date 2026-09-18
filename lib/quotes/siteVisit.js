// lib/quotes/siteVisit.js
//
// An on-site measure scheduled FROM A QUOTE, and how it is written into the
// history of the job that quote becomes.
//
// ── Why this is an Appointment and not a new table ─────────────────────────
//
// The estimator's trip to measure up before a price is final is the same row
// the booking page has always written when a homeowner books an estimate:
// an Appointment with a client, a time, an assignee and a nullable `quoteId`
// — a column that existed on the model and that nothing wrote (grepped
// before this file: the booking flow puts the quote on Booking, not on
// Appointment, and no other creator set it). This file is the first writer.
// One row per real thing: it is on the team calendar because every
// Appointment is, it can be moved, completed and cancelled with the office
// actions every Appointment has, and the moved / cancelled letters already
// follow the quote's language through `existing.quote` in
// app/api/appointments/[id]. A second "site visit" model would have needed
// all of that copied.
//
// ── Why the job's history is the activity trail ────────────────────────────
//
// A job has no timeline table of its own (grepped: JobEvent, JobTimeline,
// JobHistory do not exist). What a job HAS is ActivityLog rows with
// entityType "job" — archive, delete, costing review, subcontractor changes
// all land there, and /app/activity is where a company reads them. So the
// measure lands there too, and lands TWICE when both exist: once against the
// quote (where it was scheduled) and once against the job (where the crew
// reads it). The two writes never disagree because they are built by the one
// function below from the one Appointment row.
//
// ── No database in this file ───────────────────────────────────────────────
//
// Everything here is a pure function over rows already loaded, so
// scripts/check-site-visit.mjs can execute it. The recorders that actually
// write live in lib/quotes/siteVisitActivity.js.

/** The action names written to ActivityLog.action, one per verb, per entity. */
export const SITE_VISIT_VERBS = ["scheduled", "completed", "cancelled"];

// Two keys per verb, not one with an optional "{who}": t() substitutes an
// empty parameter with nothing, so a single template would render "for
// Tuesday with  (Q-2026-0007)" for an unassigned visit. The catalogue key
// is chosen here, once, from the row.
const SUMMARY_KEYS = {
  scheduled: {
    named: "app.activity.event.siteVisitScheduled",
    unassigned: "app.activity.event.siteVisitScheduledUnassigned",
  },
  completed: {
    named: "app.activity.event.siteVisitCompleted",
    unassigned: "app.activity.event.siteVisitCompletedUnassigned",
  },
  cancelled: {
    named: "app.activity.event.siteVisitCancelled",
    unassigned: "app.activity.event.siteVisitCancelledUnassigned",
  },
};

/**
 * Which verb a status change on a quote-linked appointment amounts to, or
 * null when the change is not one the job's history should mention.
 *
 * `scheduled` is deliberately NOT returned for a status change: a row
 * re-opened after a cancellation is "back on", and writing "scheduled" a
 * second time would read as a second visit. Creation is the one moment that
 * verb is true, and the create route calls the recorder with it directly.
 */
export function siteVisitVerbForStatus(previousStatus, nextStatus) {
  if (!nextStatus || nextStatus === previousStatus) return null;
  if (nextStatus === "completed") return "completed";
  if (nextStatus === "cancelled") return "cancelled";
  return null;
}

/**
 * "Tue, Sep 22, 2026, 10:00 EDT" — English, in the company's zone.
 *
 * English on purpose: ActivityLog.summary is the stored English sentence (see
 * lib/activity/log.js on why rows carry a sentence AND a key), and the same
 * string rides in summaryParams for the translated key. The precedent is
 * lib/shifts/shiftNotify.js, which formats `when` once at write time; this
 * one uses the company's zone rather than UTC because a measure at "10:00"
 * is 10:00 in the driveway, and a French office reading "14:00 UTC" for a
 * morning visit would be reading a wrong time in the right language.
 */
export function describeSiteVisitWhen(scheduledAt, timeZone) {
  const d = scheduledAt instanceof Date ? scheduledAt : new Date(scheduledAt);
  if (Number.isNaN(d.getTime())) return "";
  const opts = {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
    // 24-hour: this string is read in nine languages through the catalogue
    // key's {when}, and "2:00 p.m." is English punctuation in the middle of
    // a French sentence where "14:00" is not.
    hourCycle: "h23",
  };
  try {
    return new Intl.DateTimeFormat("en-CA", { ...opts, timeZone: timeZone || "UTC" }).format(d);
  } catch {
    // An unknown IANA name throws; a wrong zone label is worse than none.
    return new Intl.DateTimeFormat("en-CA", { ...opts, timeZone: "UTC" }).format(d);
  }
}

/**
 * The ActivityLog event for one verb on one appointment, against ONE entity.
 *
 * @param {"scheduled"|"completed"|"cancelled"} verb
 * @param {object} p
 * @param {"quote"|"job"} p.entityType
 * @param {string} p.entityId
 * @param {object} p.appointment  { id, scheduledAt, assignedTo?: { name }, cancelReason? }
 * @param {string} [p.quoteNumber]
 * @param {string} [p.timeZone]
 * @returns the object recordActivity takes, or null for an unknown verb
 */
export function siteVisitEvent(verb, { entityType, entityId, appointment, quoteNumber, timeZone }) {
  if (!SITE_VISIT_VERBS.includes(verb)) return null;
  if (!entityType || !entityId || !appointment?.id) return null;

  const when = describeSiteVisitWhen(appointment.scheduledAt, timeZone);
  const who = String(appointment.assignedTo?.name || "").trim();
  const ref = String(quoteNumber || "").trim();
  const reason = verb === "cancelled" ? String(appointment.cancelReason || "").trim() : "";

  // Sentences, not a stem plus tails. "scheduled for X with Y" and "completed
  // on X by Y" are different shapes, and a template that pastes " with {who}"
  // onto both reads wrong on the second.
  const whoPart = who ? ` with ${who}` : "";
  const refPart = ref ? ` (${ref})` : "";
  // The separator travels with the reason so the translated key can end in
  // "{reason}" and render nothing at all when there is none — a dash in the
  // template would otherwise dangle after every cancellation without one.
  const reasonPart = reason ? ` \u2014 ${reason}` : "";
  const summaries = {
    scheduled: `On-site measure scheduled for ${when}${whoPart}${refPart}`,
    completed: `On-site measure completed \u2014 ${when}${whoPart}${refPart}`,
    cancelled: `On-site measure cancelled \u2014 was ${when}${whoPart}${refPart}${reasonPart}`,
  };

  return {
    action: `${entityType}.site_visit.${verb}`,
    entityType,
    entityId,
    summary: summaries[verb],
    summaryKey: SUMMARY_KEYS[verb][who ? "named" : "unassigned"],
    summaryParams: { when, who, quote: ref, reason: reasonPart },
    metadata: {
      appointmentId: appointment.id,
      scheduledAt: new Date(appointment.scheduledAt).toISOString(),
      assignedToId: appointment.assignedToId || null,
    },
  };
}

/**
 * The events that carry a quote's measures into a job's history at the
 * moment the job is created — the quote was scheduled, measured, maybe
 * called off, all BEFORE the job existed, so none of it was written against
 * the job yet.
 *
 * One "scheduled" per appointment, plus "completed" or "cancelled" when the
 * row has reached that state, in the order the visits happened. A
 * `needs_supervisor` row is still a scheduled visit (the calendar lists it as
 * one); it is carried as scheduled.
 *
 * @param {object[]} appointments  the quote's rows, any order
 * @param {object} p { jobId, quoteNumber, timeZone }
 * @returns {object[]} recordActivity events, oldest first
 */
export function siteVisitCarryEvents(appointments, { jobId, quoteNumber, timeZone }) {
  const rows = (Array.isArray(appointments) ? appointments : [])
    .filter((a) => a?.id && a.scheduledAt)
    .slice()
    .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));

  const out = [];
  for (const appointment of rows) {
    const common = { entityType: "job", entityId: jobId, appointment, quoteNumber, timeZone };
    out.push(siteVisitEvent("scheduled", common));
    if (appointment.status === "completed") out.push(siteVisitEvent("completed", common));
    else if (appointment.status === "cancelled") out.push(siteVisitEvent("cancelled", common));
  }
  return out.filter(Boolean);
}
