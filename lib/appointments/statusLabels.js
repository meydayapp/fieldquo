// lib/appointments/statusLabels.js
//
// What a row on /app/appointments is CALLED, and how its badge is coloured.
//
// ── Why this file exists ───────────────────────────────────────────────────
//
// The calendar printed `String(status).replace("_", " ")`, so a supervisor-gated
// visit rendered as the word `needs supervisor` — lowercase, underscore-stripped,
// and English in a French office. That is the same failure the invoices list
// shipped when a chargeback printed `partially_refunded` at a contractor
// (lib/invoices/statusPresentation.js), and the same one the jobs list shipped
// when its detail badge said `unscheduled` while its list said "Needs a date"
// (lib/jobs/statusLabels.js). Third occurrence, same shape: one screen gets the
// considered word and the other gets whatever the database happens to hold.
//
// ── Why the map is bigger than AppointmentStatus ───────────────────────────
//
// This is the trap the invoices copy fell into. `enum AppointmentStatus` has
// four values, and a four-key map looks exhaustive — but the calendar merges
// THREE sources, each with its own vocabulary (see lib/schedule/jobVisits.js,
// which deliberately passes each through rather than flattening them onto
// AppointmentStatus, because a `pending_payment` hold is not a booked visit):
//
//   Appointment   scheduled · needs_supervisor · completed · cancelled
//   Booking       pending_payment · confirmed · cancelled · completed
//   JobVisit      scheduled · on_the_way · in_progress · completed ·
//                 cancelled / canceled   (a plain String column — see
//                 lib/jobs/visitStatus.js for why both spellings are real)
//
// So the previous four-key STATUS_STYLES was already falling through to the
// grey default for every unconverted booking on the page, and printing
// "pending payment" beside it. Exhaustive over the union, and
// check:appointment-status drives this map against all three enums in
// prisma/schema.prisma so a value added to any of them fails the build here
// rather than reaching a screen as raw column text.
//
// ── No words in this file, with one named exception ────────────────────────
//
// Same rule as statusPresentation.js: this returns a label KEY, never a label,
// because English in lib/ is English in every office. Keys are written out in
// full rather than built as `app.status.${status}` — a runtime-built key is
// invisible to check:translations, which is how a missing translation reaches
// a customer.
//
// The exception is `on_the_way`. There is NO catalogue key for it anywhere in
// the product — lib/jobs/visitStatus.js hardcodes the English "On the way" too
// — so it carries `labelKey: null` and an English fallback, which is honest
// about a gap rather than borrowing a key that means something else
// ("In progress" is not "On the way", and a crew member reading a badge is
// entitled to the difference). The key this wants is `app.status.onTheWay`;
// check:appointment-status asserts that this remains the ONLY hole, so a
// second one cannot be added quietly.

/**
 * Every status any of the three calendar sources can put on a row.
 *
 * `tone` names what the badge MEANS, never a colour: the amber pairing is
 * shared by "a supervisor still has to be found" and "the client hasn't paid
 * the hold yet", which are the same fact to the person reading the calendar —
 * this is booked but not settled.
 */
export const APPOINTMENT_STATUS_PRESENTATION = {
  // ── Appointment ──────────────────────────────────────────────────────────
  scheduled: { tone: "booked", labelKey: "app.status.scheduled", en: "Scheduled" },
  needs_supervisor: {
    tone: "unsettled",
    // The row already renders this wording beside a ShieldAlert for
    // `requiresSupervisor`; the badge saying something different about the
    // same fact is exactly the drift lib/jobs/statusLabels.js was written for.
    labelKey: "app.appts.supervisorRequired",
    en: "Supervisor required",
  },
  completed: { tone: "done", labelKey: "app.status.completed", en: "Completed" },
  cancelled: { tone: "off", labelKey: "app.status.cancelled", en: "Cancelled" },

  // ── Booking ──────────────────────────────────────────────────────────────
  // A confirmed booking is on the calendar and paid for; it is "booked" in the
  // same sense a scheduled appointment is, and gets the same colour so the two
  // don't read as different kinds of certainty.
  confirmed: { tone: "booked", labelKey: "app.quoteImports.confirmed", en: "Confirmed" },
  // The booking screen's own wording for this state, not a new one.
  pending_payment: {
    tone: "unsettled",
    labelKey: "app.booking.awaitingPaymentTitle",
    en: "Awaiting payment",
  },

  // ── JobVisit ─────────────────────────────────────────────────────────────
  on_the_way: { tone: "booked", labelKey: null, en: "On the way" },
  in_progress: { tone: "booked", labelKey: "app.status.inProgress", en: "In progress" },
  // Both spellings are in the table — lib/schedule/jobVisits.js filters on
  // both because it could not be sure which. Resolving only one here would put
  // the raw word on screen for whichever rows hold the other.
  canceled: { tone: "off", labelKey: "app.status.cancelled", en: "Cancelled" },
};

/**
 * The badge classes per tone. Every pairing carries its `dark:` half — a
 * `bg-*-50` with no dark counterpart is a bright slab in a dark-mode van, and
 * this page had one of those in its error banner for the same reason.
 */
export const APPOINTMENT_TONE_CLASSES = {
  booked: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300",
  unsettled: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300",
  done: "bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300",
  off: "bg-muted text-muted-foreground",
};

// A status this file has never heard of still has to render as something a
// human can read, and must never render as the literal word "undefined" in a
// class list. Belt to check:appointment-status's braces.
const UNKNOWN = { tone: "off", labelKey: null, en: null };

export function appointmentStatusPresentation(status) {
  return APPOINTMENT_STATUS_PRESENTATION[status] || UNKNOWN;
}

/** The chip classes. Never undefined, never a half-built string. */
export function appointmentStatusClasses(status) {
  const { tone } = appointmentStatusPresentation(status);
  return APPOINTMENT_TONE_CLASSES[tone] || APPOINTMENT_TONE_CLASSES.off;
}

/**
 * The human label, given the caller's `t`.
 *
 * An unrecognised status falls back to the tidied raw value rather than an
 * empty string, for the reason jobStatusLabel gives: a badge reading
 * "on_hold" is ugly and a blank badge is a bug report. Neither should happen;
 * one of them is recoverable.
 */
export function appointmentStatusLabel(status, t) {
  const { labelKey, en } = appointmentStatusPresentation(status);
  const raw = String(status || "").replace(/_/g, " ");
  if (labelKey) return t ? t(labelKey, en) : en;
  return en || raw;
}

/**
 * The filter row above the calendar, in the order a visit moves through it.
 *
 * "all" is not a status and is kept out of the presentation map on purpose —
 * giving it a tone would let it be rendered as a badge on a row, which is the
 * shape of bug this file exists to stop.
 *
 * Deliberately NOT the union above. The chips filter Appointments, which is
 * the only one of the three sources whose status a person on this page can
 * change; offering "Awaiting payment" as a filter would advertise a state
 * this list cannot act on.
 */
export const APPOINTMENT_FILTERS = [
  "all",
  "scheduled",
  "needs_supervisor",
  "completed",
  "cancelled",
];

/**
 * The label for one filter chip.
 *
 * "All" borrows the jobs list's key rather than adding an `app.appts.filterAll`
 * that would be a second copy of the same word in nine languages — and the
 * copy is the one that rots.
 */
export function appointmentFilterLabel(value, t) {
  if (value === "all") return t ? t("app.jobs.filterAll", "All") : "All";
  return appointmentStatusLabel(value, t);
}
