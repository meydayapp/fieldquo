// lib/quotes/shareWithStaff.js
//
// What "Share with staff" (the quote's Send menu → team chat) posts, and to
// whom it is allowed to post it. Pure, so scripts/check-share-staff.mjs can
// execute every case; app/components/quotes/ShareWithStaffModal.js only
// supplies the translated words.
//
// ── What was wrong (the owner, 2026-10-03) ───────────────────────────────────
//
// "What about the option to share a quote with the team? I think the crew can
// see the very basic things, or is that meant for someone else?"
//
// It posted ONE line — "Quote Q-0042: https://…/app/quotes/<id>" — into the
// room or DM picked, #general by default. #general is everybody, and job
// rooms are the crew booked on the job. The Crew preset holds quotes at
// `none`, so GET /api/quotes/[id] refuses them before the row is read (no
// price ever left the server) — and the page then said "Quote not found."
// A link that opens for nobody it was sent to, and a page that lies about
// why: a dead control with extra steps.
//
// ── What it does now ─────────────────────────────────────────────────────────
//
// The quote link is for the office: people whose grid reads quotes. Crew get
// the WORK ORDER (lib/workOrder) — the same job, no prices, the crew note per
// area — which is exactly the "very basic things" the owner describes, and it
// exists once the quote has become a job (lib/workOrder/locate.js). So:
//
//   • With a job, into a ROOM: both links, each labelled for whom it opens,
//     the crew's line FIRST — the room is mostly crew, and the line they can
//     open should not sit under one they cannot. The work order still opens
//     only for crew on that job (assignedJobWhere: a visit or a published
//     shift) — the label says so.
//   • With a job, straight to ONE person who cannot open quotes: the work
//     order only. The live test (2026-10-04) DM'd a crew member both links,
//     and the first one they saw was "needs quote access" — a link aimed at
//     them that refuses them, which is the dead control again.
//   • Without a job: the quote link, and one line saying it opens for people
//     with access to quotes. Shared straight to ONE person who cannot open
//     quotes, it is refused before posting — sending a single person a link
//     that cannot open for them is the dead control again, aimed.
//
// Prices never travel in either link: the quote page is gated server-side,
// and the work order model carries no money key (check:work-order).
import { hasLevel } from "@/lib/permissions/enforce";

/**
 * Can this person open the quote page? The same dial and rung GET
 * /api/quotes/[id] refuses below (levelOrRefusal "quotes", "view_only").
 * `person` is { role, permissions } — a directory row carries both.
 */
export function canOpenQuote(person) {
  if (!person || typeof person.role !== "string") return false;
  return hasLevel({ role: person.role, permissions: person.permissions ?? null }, "quotes", "view_only");
}

/**
 * May the share go ahead, given who it is for?
 *
 * @param {object} p
 * @param {"room"|"person"} p.kind
 * @param {boolean|null} p.personCanOpenQuote  for a person target; null when unknown
 * @param {boolean} p.hasWorkOrder
 * @returns {{ ok: true } | { ok: false, reason: "no_access_no_work_order" }}
 */
export function shareVerdict({ kind, personCanOpenQuote = null, hasWorkOrder = false } = {}) {
  if (kind === "person" && personCanOpenQuote === false && !hasWorkOrder) {
    return { ok: false, reason: "no_access_no_work_order" };
  }
  return { ok: true };
}

/**
 * The message body, line by line. Every word arrives translated; this only
 * decides which lines exist.
 *
 * @param {object} p
 * @param {string} p.message          the sender's optional line
 * @param {string} p.quoteLine        "Quote Q-0042 (office — quote access): <link>"
 * @param {string|null} p.workOrderLine "Work order, no prices (crew on this job): <link>", or null
 * @param {string} p.accessNote       "Opens for people with access to quotes." — used when there is no work order
 */
export function shareMessageBody({
  message = "",
  quoteLine,
  workOrderLine = null,
  accessNote = "",
  kind = "room",
  personCanOpenQuote = null,
} = {}) {
  const lines = [String(message || "").trim(), ...shareLinkLines({ kind, personCanOpenQuote, quoteLine, workOrderLine, accessNote })];
  return lines.filter(Boolean).join("\n");
}

/**
 * Which link lines a share carries, in order.
 *
 *   one person who cannot open quotes, a work order exists → the work order only
 *   a work order exists, anyone else (a room, an office person, unknown)
 *                                                          → work order, then quote
 *   no work order                                          → quote, then the access note
 *
 * "Unknown" (a directory row from before canOpenQuote existed) keeps both
 * links: dropping the office's link on a guess would be the opposite failure.
 */
export function shareLinkLines({ kind = "room", personCanOpenQuote = null, quoteLine, workOrderLine = null, accessNote = "" } = {}) {
  if (workOrderLine) {
    if (kind === "person" && personCanOpenQuote === false) return [workOrderLine];
    return [workOrderLine, quoteLine].filter(Boolean);
  }
  return [quoteLine, accessNote].filter(Boolean);
}
