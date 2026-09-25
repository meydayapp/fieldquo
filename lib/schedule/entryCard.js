// lib/schedule/entryCard.js
//
// One calendar entry as a CARD: the compact rendering on the calendar's Cards
// view (app/app/appointments/page.js, ?view=cards) and the facts its side
// panel (app/components/schedule/EntryPanel.js) acts on — the owner's ask of
// 2026-09-24, "calendar entries as cards like the leads board".
//
// ── Shaping only; the feed already decided WHICH entries ────────────────────
//
// GET /api/appointments → lib/schedule/feed.js is where "crew see only their
// own work" is enforced (ownScheduleFilter + assignedJobWhere), and it has
// already narrowed each client to what the member's clientsProperties level
// allows. This file never widens either: it reads the entry the feed handed
// over and decides only how it is drawn and which links it OFFERS.
//
// ── Links are offered on the category that guards the page they open ──────
//
// An "Open quote" link for a member on quotes:none is the dead control
// AGENTS.md opens with — the page it lands on refuses them. So each quick
// link is withheld unless the caller says that category is readable
// (`access`, resolved by the page from the same hasLevel/navRowAllowed the
// server and the sidebar ask). The server still refuses regardless; this is
// only about not drawing a door that will not open.
//
// ── No money on a card ─────────────────────────────────────────────────────
//
// The feed carries no amounts and this file adds none, so the showPricing
// toggle has nothing to hide here: a card is who, what, when and where. The
// money lives on the quote and invoice pages the links open, which redact it
// themselves (lib/permissions/enforce.js redactQuoteMoney/redactInvoiceMoney).

import { aboutLabel } from "@/lib/schedule/appointmentAbout";
import { mayMoveVisit } from "@/lib/jobs/visitStatus";
import { hasLevel } from "@/lib/permissions/enforce";

const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : null);

/**
 * The short form of an address for a card: the street line, and the town
 * when the street alone would be ambiguous ("Unit 4").
 *
 * "12 Oak St, Ottawa, ON K1A 0B1" → "12 Oak St"
 * "Unit 4, 12 Oak St, Ottawa"     → "Unit 4, 12 Oak St"
 *
 * Never invents: an empty, whitespace or comma-only string is null, not "".
 * Bounded so a pasted paragraph can't blow the card open.
 */
export function shortAddress(address, max = 40) {
  const s = str(address);
  if (!s) return null;
  const parts = s.split(",").map((p) => p.trim()).filter(Boolean);
  if (!parts.length) return null;
  let out = parts[0];
  // A first segment with no digit-and-word street shape ("Unit 4", "Apt 2B",
  // "Suite 300") says where in a building, not which building.
  if (parts.length > 1 && (out.length < 8 || /^(unit|apt|suite|ste|#)\b/i.test(out))) {
    out = `${out}, ${parts[1]}`;
  }
  return out.length > max ? `${out.slice(0, max - 1).trimEnd()}…` : out;
}

/**
 * Where the van goes, or null. Only an in-person entry has one: a phone or
 * video booking falls through to the client's billing address otherwise,
 * which is a street on a row nobody is driving to — the same rule the list
 * rows apply (rowAddress in app/app/appointments/page.js).
 */
export function entryAddress(entry) {
  const mode = entry?.booking?.mode || null;
  if (mode && mode !== "visit") return null;
  return str(entry?.location) || str(entry?.client?.address) || null;
}

/**
 * The quick links an entry can offer, before permissions.
 *
 * An appointment carries its quote/job/invoice (the "about" the office linked
 * it to). A visit carries its job, and its job's quote (VISIT_INCLUDE selects
 * job.quoteId). A booking the client made is linked to nothing yet.
 */
function rawLinks(entry) {
  const links = { quote: null, job: null, invoice: null, client: null };
  if (!entry || typeof entry !== "object") return links;

  const quoteId = str(entry.quote?.id) || str(entry.quoteId);
  if (quoteId) links.quote = { id: quoteId, ref: str(entry.quote?.quoteNumber) };

  const jobId = str(entry.job?.id) || str(entry.jobId);
  if (jobId) links.job = { id: jobId, title: str(entry.job?.title) || (entry.kind === "visit" ? str(entry.title) : null) };

  const invoiceId = str(entry.invoice?.id);
  if (invoiceId) links.invoice = { id: invoiceId, ref: str(entry.invoice?.invoiceNumber) };

  // A booking's client is synthesised from what the stranger typed
  // (bookingToCalendarEntry marks it `synthetic`, id null) — there is no
  // client record to open.
  const clientId = str(entry.client?.id);
  if (clientId && !entry.client?.synthetic) links.client = { id: clientId };

  return links;
}

/**
 * The card's facts.
 *
 * @param entry   one row of GET /api/appointments
 * @param access  { quotes, jobs, invoices, clients } booleans — which pages
 *                this viewer may open. Missing keys are treated as NO: a
 *                caller that forgot to ask gets fewer links, never more.
 */
export function entryCard(entry, access = {}) {
  if (!entry || typeof entry !== "object" || !entry.id) return null;
  const kind = entry.kind === "visit" || entry.kind === "booking" ? entry.kind : "appointment";

  const start = entry.scheduledAt ? new Date(entry.scheduledAt) : null;
  const end = entry.booking?.endTime ? new Date(entry.booking.endTime) : null;
  const validStart = start && !Number.isNaN(start.getTime()) ? start : null;
  const validEnd = end && !Number.isNaN(end.getTime()) && validStart && end > validStart ? end : null;

  // What it is FOR. A visit's job title, a booking's event type, or — for a
  // hand-booked appointment — what the office linked it to (rendered through
  // the page's own aboutText so the words match the list and the letters).
  const service = kind === "appointment" ? null : str(entry.title);
  const about = kind === "appointment" ? aboutLabel(entry) : null;

  const raw = rawLinks(entry);
  const links = {
    quote: access.quotes ? raw.quote : null,
    job: access.jobs ? raw.job : null,
    invoice: access.invoices ? raw.invoice : null,
    client: access.clients ? raw.client : null,
  };

  const address = entryAddress(entry);

  return {
    key: `${kind}-${entry.id}`,
    kind,
    id: entry.id,
    jobId: str(entry.jobId) || str(entry.job?.id),
    clientName: str(entry.client?.name),
    clientRestricted: Boolean(entry.client?.restricted),
    service,
    about,
    start: validStart,
    end: validEnd,
    status: str(entry.status) || "scheduled",
    address,
    addressShort: shortAddress(address),
    // `restricted` clients had the phone removed by the feed; nothing to dial.
    phone: str(entry.client?.phone),
    mode: entry.booking?.mode || null,
    assignedName: str(entry.assignedTo?.name),
    assignedToId: entry.assignedToId ?? entry.assignedTo?.id ?? null,
    requiresSupervisor: Boolean(entry.requiresSupervisor),
    notes: kind === "booking" ? null : str(entry.notes),
    cancelReason: str(entry.cancelReason),
    links,
  };
}

/**
 * May this viewer move / cancel / complete this entry? The ONE answer the
 * list rows and the side panel both draw EntryActions from — extracted from
 * the list's inline test, clause for clause, so the two surfaces cannot
 * disagree about the same row.
 *
 *   visit        mayMoveVisit — its own route's rule
 *   booking      never: the client reschedules through their manage link
 *   appointment  unresolved provider (falls open, the server refuses), the
 *                assignee, or schedule:edit_all
 */
export function mayActOnEntry(entry, { caller, myUserId } = {}) {
  if (!entry) return false;
  if (entry.kind === "visit") {
    return mayMoveVisit({
      assignedToId: entry.assignedToId ?? null,
      userId: myUserId,
      hasEditAll: hasLevel(caller, "schedule", "edit_all"),
    });
  }
  if (entry.kind === "booking") return false;
  return Boolean(
    !caller?.role ||
      (myUserId && entry.assignedToId === myUserId) ||
      hasLevel(caller, "schedule", "edit_all"),
  );
}

/**
 * The seven days of the week containing `anchor`, starting on the company's
 * `weekStartsOn` (0 = Sunday). Local-time dates, the same construction
 * monthGrid uses, so a DST change never skips or repeats a day.
 */
export function weekDays(anchor, weekStartsOn = 0) {
  const a = anchor instanceof Date && !Number.isNaN(anchor.getTime()) ? anchor : new Date();
  const start = Number.isInteger(weekStartsOn) && weekStartsOn >= 0 && weekStartsOn <= 6 ? weekStartsOn : 0;
  const lead = (a.getDay() - start + 7) % 7;
  return Array.from({ length: 7 }, (_, i) => new Date(a.getFullYear(), a.getMonth(), a.getDate() - lead + i));
}
