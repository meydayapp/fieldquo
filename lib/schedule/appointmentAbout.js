// lib/schedule/appointmentAbout.js
//
// What a hand-booked appointment is ABOUT — a quote, a job or an invoice —
// and the two judgements the calendar's "New appointment" dialog makes about
// it: which record to suggest first, and whether the record's client is the
// person being booked.
//
// ── Why a link at all ──────────────────────────────────────────────────────
//
// The owner's words: "A manually created appointment should be able to be
// linked to any existing jobs. Because maybe the husband called and not the
// wife (client)?" A call about the Smith kitchen used to be a name and a
// time on the calendar and nothing else; whoever drove out had to guess
// which of the Smiths' three documents it concerned. `Appointment.quoteId`
// was only ever written by the quote page's own site-visit flow.
//
// ── Why the STAGE picks the suggestion ─────────────────────────────────────
//
// "it could be a job or quote if the client matches, or an invoice if it
// matches … could depend at the stage they are at." A client is at one point
// in the pipeline at a time: a quote they have not accepted is what the
// visit is about; once accepted it is the job; once the job is done and the
// bill is open it is the invoice. So the record furthest along the pipeline
// is offered first, and the rest are grouped under it — never hidden,
// because the office may know better.
//
// ── Why a mismatch is a warning, not a refusal ─────────────────────────────
//
// The husband rang, the job is in the wife's name. Refusing the link would
// send the office back to the duplicate-client factory this feature exists
// to close. So the verdict names both people and asks "keep both?", and the
// appointment keeps the caller while the record keeps its client. Nothing
// here rewrites either.
//
// ── No database ────────────────────────────────────────────────────────────
//
// Pure functions over rows already loaded, so scripts/check-appointment-about.mjs
// can run them against hostile input. The route that loads the rows is
// app/api/appointments/about/route.js.

/** The three kinds a link can be, in pipeline order. */
export const ABOUT_KINDS = Object.freeze(["quote", "job", "invoice"]);

/** Quote statuses that mean "not yet accepted" — a visit is still about the quote. */
export const OPEN_QUOTE_STATUSES = Object.freeze(["draft", "sent"]);
/** Job statuses that mean "the work is still on" — the appointment is about the job. */
export const OPEN_JOB_STATUSES = Object.freeze(["unscheduled", "scheduled", "in_progress"]);
/** Invoice statuses that mean "money is owed" — a done job's open bill. */
export const UNPAID_INVOICE_STATUSES = Object.freeze(["sent", "overdue"]);

const KIND_SET = new Set(ABOUT_KINDS);

function str(v) {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Exactly one of jobId / invoiceId / quoteId from a request body, or null.
 *
 * Refuses (returns `{ error }`) when more than one is given: an appointment
 * "about a quote and about an invoice" is two appointments, and silently
 * keeping the first would drop a fact the caller stated. Non-string ids are
 * refused rather than coerced — `{ quoteId: { in: [...] } }` is what a
 * Prisma-shaped body looks like, and it must never reach a `where`.
 */
export function pickAbout(body) {
  const given = [];
  for (const kind of ABOUT_KINDS) {
    const key = `${kind}Id`;
    // Own keys only: `in` would find `quoteId` on a prototype somebody set,
    // and a body is whatever the browser sent.
    if (!body || !Object.prototype.hasOwnProperty.call(body, key)) continue;
    const v = body[key];
    if (v === null || v === undefined || v === "") continue;
    if (typeof v !== "string") return { error: `${key} must be a ${kind}'s id.` };
    given.push({ kind, id: v });
  }
  if (given.length > 1) {
    return { error: "An appointment is about one thing: give a quoteId, a jobId or an invoiceId, not several." };
  }
  return { about: given[0] || null };
}

/**
 * Which record to suggest FIRST for a client, from their open records.
 *
 * Furthest along the pipeline wins: an unpaid invoice over an open job over
 * an unaccepted quote — the stage the client is actually at. Within a kind,
 * the most recently updated. Returns null when nothing is open, which the
 * dialog renders as "link optional", not as an empty required field.
 *
 * @param {{ quotes?: object[], jobs?: object[], invoices?: object[] }} open
 * @returns {{ kind: string, id: string } | null}
 */
export function suggestAbout(open = {}) {
  const invoices = openOnly(open?.invoices, "invoice");
  if (invoices.length) return { kind: "invoice", id: invoices[0].id };
  const jobs = openOnly(open?.jobs, "job");
  if (jobs.length) return { kind: "job", id: jobs[0].id };
  const quotes = openOnly(open?.quotes, "quote");
  if (quotes.length) return { kind: "quote", id: quotes[0].id };
  return null;
}

/**
 * The rows of one kind that are genuinely open, newest first. Defensive
 * against whatever shape a caller hands over: not an array → nothing; a row
 * without a string id → dropped; a closed status → dropped, so a caller that
 * forgot to filter cannot make the dialog suggest a paid invoice.
 */
export function openOnly(rows, kind) {
  if (!Array.isArray(rows)) return [];
  const allowed =
    kind === "quote"
      ? OPEN_QUOTE_STATUSES
      : kind === "job"
        ? OPEN_JOB_STATUSES
        : kind === "invoice"
          ? UNPAID_INVOICE_STATUSES
          : null;
  if (!allowed) return [];
  return rows
    .filter((r) => r && typeof r === "object" && str(r.id) && allowed.includes(r.status))
    .sort((a, b) => time(b.updatedAt) - time(a.updatedAt));
}

function time(v) {
  const t = new Date(v || 0).getTime();
  return Number.isFinite(t) ? t : 0;
}

/**
 * Does the record belong to the person being booked?
 *
 * `{ mismatch: false }` when the ids agree, when there is no record, or when
 * either side has no client id to compare (an unknown is not a
 * disagreement). Otherwise `{ mismatch: true, recordClientName,
 * appointmentClientName }` — the two names the sentence is built from.
 * Never throws and never blocks: the caller decides to ask, and the answer
 * is the office's.
 */
export function clientMismatch({ record, appointmentClient } = {}) {
  const recordClientId = str(record?.clientId ?? record?.client?.id);
  const bookedId = str(appointmentClient?.id);
  if (!recordClientId || !bookedId || recordClientId === bookedId) {
    return { mismatch: false };
  }
  return {
    mismatch: true,
    recordClientName: str(record?.client?.name) || null,
    appointmentClientName: str(appointmentClient?.name) || null,
  };
}

/**
 * The words the calendar card, the record pages and the client's letters
 * use for a linked record. One function so all three agree.
 *
 * Returns `{ kind, ref, title }`: `ref` is the document number (a quote's or
 * invoice's), `title` a job's title. A job has no number, a quote has no
 * title — the label is whichever the record has, and the caller prefixes
 * the kind in the reader's language ("Quote Q-2026-0007", "Job: Kitchen
 * repaint", "Invoice INV-0088"). Null when nothing is linked.
 */
export function aboutLabel(appointment) {
  if (!appointment || typeof appointment !== "object") return null;
  if (appointment.invoice && str(appointment.invoice.id)) {
    return { kind: "invoice", id: appointment.invoice.id, ref: str(appointment.invoice.invoiceNumber) || null, title: null };
  }
  if (appointment.job && str(appointment.job.id)) {
    return { kind: "job", id: appointment.job.id, ref: null, title: str(appointment.job.title) || null };
  }
  if (appointment.quote && str(appointment.quote.id)) {
    return { kind: "quote", id: appointment.quote.id, ref: str(appointment.quote.quoteNumber) || null, title: null };
  }
  return null;
}

/** `/app/quotes/…`, `/app/jobs/…`, `/app/invoices/…` for a label, or null. */
export function aboutHref(label) {
  if (!label || !KIND_SET.has(label.kind) || !str(label.id)) return null;
  return `/app/${label.kind}s/${encodeURIComponent(label.id)}`;
}

/**
 * Where the appointment happens when the office typed nothing: the linked
 * record's own address first (a job's site, an invoice's job's site), then
 * the client's. A quote has no address of its own; its client's is the one.
 * Returns null rather than "" so the column stays null, the way the
 * calendar's own fallback expects.
 */
export function prefillLocation({ typed, record, client } = {}) {
  const t = str(typed);
  if (t) return t;
  const site = str(record?.siteAddress) || str(record?.job?.siteAddress);
  if (site) return site;
  const home = str(client?.address) || str(record?.client?.address);
  return home || null;
}
