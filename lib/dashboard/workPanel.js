// lib/dashboard/workPanel.js
//
// The home screen's work panel — Requests · Quotes · Jobs · Invoices — as
// pure rules. The owner approved the design on 2026-09-29: each tab carries a
// badge that counts ONLY what is waiting on a person, hidden at zero, and each
// item carries ONE action. Every rule that decides "is this waiting on
// someone?" lives here and nowhere else, so scripts/check-dashboard-home.mjs
// executes it against hostile rows (nulls, junk dates, another tenant's rows,
// prototype keys) instead of reading it.
//
// The loader (lib/dashboard/homeData.js) does the I/O, tenant-scoped and
// permission-gated; this file never sees the database and never decides who
// may look. What it is handed is already the member's own view — but it
// still drops a row that names a different company, because a filter that
// trusts its input is the one that leaks when the loader changes.
//
// ── What "needs action" means, tab by tab ─────────────────────────────────
//
// Requests
//   lead        LeadRequest.status "new" and no quote made from it. The same
//               two columns the follow-up cron's lead_no_response finder reads
//               (app/api/cron/follow-ups/route.js): "new" is flipped the moment
//               anybody does anything with the lead, and a lead with a quote is
//               answered by that quote. There is no "opened" column on a lead,
//               so "not yet opened or replied to" is exactly this and no more.
//   estimate    An instant estimate a homeowner was shown that nobody has
//               signed off: Quote.autoEstimated && needsReview — the review
//               queue's own where (app/api/quotes/estimate-reviews/route.js).
//   booking     A visit booked into the diary that needs a supervisor and has
//               nobody assigned (Appointment.status "needs_supervisor"), still
//               ahead. Bookings the public link confirms on its own are not
//               waiting on anyone and are not counted.
//
// Quotes
//   follow_up   Sent, not answered, not expired, not superseded by a newer
//               quote to the same client (lib/followUps/stopConditions.js — the
//               cron's own stop rules), and nothing has gone to the client —
//               not the send, not a manual follow-up, not an automated one —
//               for FOLLOW_UP_QUIET_DAYS. The "client replied" stop needs a
//               message-thread read per quote and is not gathered here; the
//               quote page's Follow up button still applies it.
//   expiring    Sent, unanswered, and validUntil falls within the next
//               EXPIRING_WITHIN_DAYS days (not already past — an expired quote
//               is not "expiring", and chasing it is the cron's "expired" stop).
//   viewed      NOT COUNTED. FieldQuo does not record when a client opens a
//               quote (there is no viewedAt on Quote), and a badge built on a
//               guess at "viewed, no answer" would be the invented data this
//               codebase is swept for. VIEWED_TRACKED says so in code.
//
// Jobs
//   unscheduled Job.status "unscheduled", not archived, not a historical import.
//   today /     A visit (JobVisit) on a live job whose scheduledAt falls on
//   tomorrow    today's or tomorrow's calendar day IN THE COMPANY'S TIMEZONE,
//               and is not cancelled or completed.
//
// Invoices
//   overdue     Owed (buildReceivables — latest version, less payments) and
//               past its due date.
//   undated     Owed, no due date, and issued more than UNDATED_AFTER_DAYS
//               ago. An undated invoice is never "overdue" (the aging ladder's
//               rule); fourteen quiet days is the owner's line for "chase it".
//   draft       The latest version of the family is still a draft.

import { quoteChaseBlocker } from "@/lib/followUps/stopConditions";
import { dayWindow, localDate } from "@/lib/receipts/time";

export const WORK_TABS = Object.freeze(["requests", "quotes", "jobs", "invoices"]);

export const FOLLOW_UP_QUIET_DAYS = 3;
export const EXPIRING_WITHIN_DAYS = 7;
export const UNDATED_AFTER_DAYS = 14;
/** How many rows a tab lists before "See all". The badge still counts every one. */
export const TAB_ITEM_LIMIT = 8;
/** See the header: FieldQuo does not track a client opening a quote. */
export const VIEWED_TRACKED = false;

const DAY = 86_400_000;

/** A Date from anything, or null. Never an Invalid Date. */
export function when(value) {
  if (value == null || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isFinite(d.getTime()) ? d : null;
}

const str = (v) => (typeof v === "string" ? v : "");
const rows = (v) => (Array.isArray(v) ? v.filter((r) => r && typeof r === "object") : []);

/** Drop a row that names another company. Rows without the column pass. */
function ownRows(list, companyId) {
  return rows(list).filter((r) => !companyId || r.companyId == null || r.companyId === companyId);
}

/** A plain id (the only thing an href is built from). */
function safeId(value) {
  const s = str(value);
  return /^[A-Za-z0-9_-]{1,64}$/.test(s) ? s : null;
}

// ── Requests ───────────────────────────────────────────────────────────────

export function isUnansweredLead(lead) {
  return Boolean(lead) && lead.status === "new" && !lead.quoteId;
}

export function isPendingEstimate(quote) {
  return (
    Boolean(quote) &&
    quote.autoEstimated === true &&
    quote.needsReview === true &&
    !quote.archivedAt &&
    (quote.status == null || quote.status === "draft")
  );
}

export function isUnassignedBooking(appointment, now = new Date()) {
  const at = when(appointment?.scheduledAt);
  return (
    Boolean(appointment) &&
    appointment.status === "needs_supervisor" &&
    !appointment.assignedToId &&
    Boolean(at) &&
    at.getTime() >= now.getTime()
  );
}

// ── Quotes ─────────────────────────────────────────────────────────────────

/** The last time anything went to the client about this quote. */
export function lastQuoteContact(quote) {
  const times = [quote?.sentAt, quote?.followUpSentAt, quote?.lastAutoFollowUpAt]
    .map(when)
    .filter(Boolean)
    .map((d) => d.getTime());
  return times.length ? new Date(Math.max(...times)) : null;
}

/** A live, sent, unanswered quote — the only kind either quote rule looks at. */
function openSentQuote(quote) {
  return (
    Boolean(quote) &&
    quote.status === "sent" &&
    Boolean(when(quote.sentAt)) &&
    !quote.archivedAt &&
    !quote.historicalImportedAt
  );
}

export function isFollowUpDue(quote, { now = new Date(), laterQuoteExists = false } = {}) {
  if (!openSentQuote(quote)) return false;
  // The cron's own stop rules: answered, expired, superseded. No rule is
  // passed, so "before_rule" (a FieldQuo default switched on after the send)
  // cannot fire — a PERSON following up is not the default's catch-up flood.
  if (quoteChaseBlocker({ quote, rule: null, facts: { laterQuoteExists }, now })) return false;
  const last = lastQuoteContact(quote);
  return Boolean(last) && now.getTime() - last.getTime() >= FOLLOW_UP_QUIET_DAYS * DAY;
}

export function isExpiringSoon(quote, now = new Date()) {
  if (!openSentQuote(quote)) return false;
  const until = when(quote.validUntil);
  if (!until) return false;
  const left = until.getTime() - now.getTime();
  return left >= 0 && left <= EXPIRING_WITHIN_DAYS * DAY;
}

/** Days until validUntil, rounded up — "expires in 2 days". */
export function daysLeft(quote, now = new Date()) {
  const until = when(quote?.validUntil);
  if (!until) return null;
  return Math.max(0, Math.ceil((until.getTime() - now.getTime()) / DAY));
}

// ── Jobs ───────────────────────────────────────────────────────────────────

export function jobNeedsScheduling(job) {
  return Boolean(job) && job.status === "unscheduled" && !job.archivedAt && !job.historicalImportedAt;
}

// lib/jobs/visitStatus.js spells cancelled both ways; both are closed.
const CLOSED_VISIT = new Set(["cancelled", "canceled", "completed"]);

/** The company's today and tomorrow, as UTC windows. */
export function companyDays(now = new Date(), timeZone) {
  const today = localDate(now, timeZone);
  const todayWin = dayWindow(today, timeZone);
  const tomorrow = todayWin ? localDate(new Date(todayWin.end.getTime() + 60_000), timeZone) : null;
  const tomorrowWin = tomorrow ? dayWindow(tomorrow, timeZone) : null;
  return { today, todayWin, tomorrow, tomorrowWin };
}

/** "today", "tomorrow" or null — by the company's calendar, not the server's. */
export function visitStartsSoon(visit, now = new Date(), timeZone) {
  if (!visit || CLOSED_VISIT.has(visit.status)) return null;
  if (visit.jobArchivedAt || CLOSED_VISIT.has(visit.jobStatus)) return null;
  const at = when(visit.scheduledAt);
  if (!at) return null;
  const { todayWin, tomorrowWin } = companyDays(now, timeZone);
  const t = at.getTime();
  if (todayWin && t >= todayWin.start.getTime() && t < todayWin.end.getTime()) return "today";
  if (tomorrowWin && t >= tomorrowWin.start.getTime() && t < tomorrowWin.end.getTime()) return "tomorrow";
  return null;
}

// ── Invoices ───────────────────────────────────────────────────────────────

/**
 * Why an OWED row (a buildReceivables card) is waiting, or null. `issuedOn`
 * is the card's "YYYY-MM-DD" issue day.
 */
export function owedInvoiceReason(card, now = new Date()) {
  if (!card || !(Number(card.owed) > 0)) return null;
  if (card.dueState === "overdue") return "overdue";
  if (card.dueState === "undated") {
    const issued = when(card.issuedOn);
    if (issued && now.getTime() - issued.getTime() > UNDATED_AFTER_DAYS * DAY) return "undated";
  }
  return null;
}

export function isUnsentDraft(invoice) {
  return Boolean(invoice) && invoice.status === "draft" && !invoice.historicalImportedAt;
}

// ── The panel ──────────────────────────────────────────────────────────────

function money(show, amount) {
  if (!show) return undefined;
  const n = Number(amount);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Build the four tabs. `allowed` is the member's permission per tab; a tab
 * not allowed is returned `{ allowed: false }` with no items and no count —
 * never a zero, which would claim there is nothing when the truth is "not
 * yours to see".
 *
 * `showMoney` decides whether amounts ride on the items at all (showPricing);
 * `canRemind` whether an invoice row's action is the inline chase.
 */
export function buildWorkPanel(input = {}) {
  const now = when(input.now) || new Date();
  const tz = input.timeZone;
  const allowed = input.allowed || {};
  const cid = str(input.companyId);
  const showMoney = input.showMoney === true;

  const tabs = {};

  // Requests
  if (allowed.requests) {
    const items = [];
    for (const l of ownRows(input.leads, cid)) {
      const id = safeId(l.id);
      if (!id || !isUnansweredLead(l)) continue;
      items.push({
        kind: "lead",
        id,
        name: str(l.name),
        reason: when(l.callbackRequestedAt) ? "callback" : "new_lead",
        at: when(l.createdAt),
        action: { type: "reply", href: `/app/leads?lead=${id}` },
      });
    }
    for (const q of ownRows(input.estimates, cid)) {
      const id = safeId(q.id);
      if (!id || !isPendingEstimate(q)) continue;
      items.push({
        kind: "estimate",
        id,
        name: str(q.clientName),
        number: str(q.quoteNumber),
        reason: "instant_estimate",
        at: when(q.createdAt),
        amount: money(showMoney, q.total),
        action: { type: "review", href: "/app/estimate-reviews" },
      });
    }
    for (const a of ownRows(input.bookings, cid)) {
      const id = safeId(a.id);
      if (!id || !isUnassignedBooking(a, now)) continue;
      items.push({
        kind: "booking",
        id,
        name: str(a.clientName),
        reason: "booking_unassigned",
        at: when(a.scheduledAt),
        action: { type: "review", href: "/app/appointments" },
      });
    }
    // Newest request first: the one that arrived while you were on a roof.
    // A booking sorts by its visit time, which is what makes it urgent.
    items.sort((a, b) => (b.at?.getTime() || 0) - (a.at?.getTime() || 0));
    tabs.requests = items;
  }

  // Quotes
  if (allowed.quotes) {
    const quotes = ownRows(input.quotes, cid);
    // "Superseded" from the list itself: a newer non-historical quote to the
    // same client. The list is the company's live quotes, so this is the same
    // fact gatherQuoteChaseFacts reads with a query per quote.
    const newestByClient = new Map();
    for (const q of quotes) {
      const c = when(q.createdAt);
      if (!q.clientId || !c || q.historicalImportedAt) continue;
      const prior = newestByClient.get(q.clientId);
      if (!prior || c > prior) newestByClient.set(q.clientId, c);
    }
    const items = [];
    for (const q of quotes) {
      const id = safeId(q.id);
      if (!id) continue;
      const created = when(q.createdAt);
      const newest = q.clientId ? newestByClient.get(q.clientId) : null;
      const laterQuoteExists = Boolean(created && newest && newest > created);
      const expiring = isExpiringSoon(q, now);
      const followUp = isFollowUpDue(q, { now, laterQuoteExists });
      // A quote about to lapse on a client who has since been re-quoted is
      // not waiting on anyone — the newer quote is the live conversation.
      if (!(followUp || (expiring && !laterQuoteExists))) continue;
      items.push({
        kind: "quote",
        id,
        name: str(q.clientName),
        number: str(q.quoteNumber),
        // Expiring is the harder deadline, so it names the row when both apply.
        reason: expiring && !laterQuoteExists ? "expiring" : "follow_up",
        daysLeft: expiring ? daysLeft(q, now) : undefined,
        at: lastQuoteContact(q),
        amount: money(showMoney, q.total),
        action: { type: "follow_up", href: `/app/quotes/${id}` },
      });
    }
    items.sort((a, b) => {
      if (a.reason !== b.reason) return a.reason === "expiring" ? -1 : 1;
      return (a.at?.getTime() || 0) - (b.at?.getTime() || 0); // longest silence first
    });
    tabs.quotes = items;
  }

  // Jobs
  if (allowed.jobs) {
    const items = [];
    const seenJobs = new Set();
    for (const v of ownRows(input.visits, cid)) {
      const id = safeId(v.id);
      const jobId = safeId(v.jobId);
      if (!id || !jobId) continue;
      const soon = visitStartsSoon(v, now, tz);
      if (!soon) continue;
      seenJobs.add(jobId);
      items.push({
        kind: "visit",
        id,
        jobId,
        name: str(v.clientName) || str(v.jobTitle),
        title: str(v.jobTitle),
        reason: soon === "today" ? "starts_today" : "starts_tomorrow",
        at: when(v.scheduledAt),
        action: { type: "open", href: `/app/jobs/${jobId}` },
      });
    }
    items.sort((a, b) => (a.at?.getTime() || 0) - (b.at?.getTime() || 0));
    const unscheduled = [];
    for (const j of ownRows(input.jobs, cid)) {
      const id = safeId(j.id);
      if (!id || seenJobs.has(id) || !jobNeedsScheduling(j)) continue;
      seenJobs.add(id);
      unscheduled.push({
        kind: "job",
        id,
        name: str(j.clientName) || str(j.title),
        title: str(j.title),
        reason: "not_scheduled",
        at: when(j.createdAt),
        action: { type: "schedule", href: `/app/jobs/${id}/visits/new` },
      });
    }
    unscheduled.sort((a, b) => (a.at?.getTime() || 0) - (b.at?.getTime() || 0));
    tabs.jobs = [...items, ...unscheduled];
  }

  // Invoices
  if (allowed.invoices) {
    const items = [];
    const canRemind = input.canRemind === true;
    for (const card of rows(input.owed)) {
      const id = safeId(card.id);
      const reason = id ? owedInvoiceReason(card, now) : null;
      if (!reason) continue;
      items.push({
        kind: "invoice",
        id,
        name: str(card.client?.name),
        number: str(card.invoiceNumber),
        reason,
        daysPastDue: reason === "overdue" ? Number(card.daysPastDue) || null : undefined,
        at: when(card.dueDate) || when(card.issuedOn),
        amount: money(showMoney, card.owed),
        // The chase is a POST the page makes inline; without the level to
        // make it, the row opens the invoice instead.
        action: canRemind
          ? { type: "chase", href: `/app/invoices/${id}`, post: `/api/invoices/${id}/request-payment` }
          : { type: "open", href: `/app/invoices/${id}` },
      });
    }
    for (const inv of ownRows(input.drafts, cid)) {
      const id = safeId(inv.id);
      if (!id || !isUnsentDraft(inv)) continue;
      items.push({
        kind: "draft",
        id,
        name: str(inv.clientName),
        number: str(inv.invoiceNumber),
        reason: "draft",
        at: when(inv.createdAt),
        amount: money(showMoney, inv.total),
        action: { type: "send", href: `/app/invoices/${id}` },
      });
    }
    const rank = { overdue: 0, undated: 1, draft: 2 };
    items.sort((a, b) => rank[a.reason] - rank[b.reason] || (a.at?.getTime() || 0) - (b.at?.getTime() || 0));
    tabs.invoices = items;
  }

  // An absent fact is an absent key — never `amount: undefined`, which a
  // careless reader (or a spread into JSON with a default) turns into a zero.
  const clean = (item) => Object.fromEntries(Object.entries(item).filter(([, v]) => v !== undefined));
  const out = WORK_TABS.map((key) => {
    if (!Array.isArray(tabs[key])) return { key, allowed: false };
    return { key, allowed: true, count: tabs[key].length, items: tabs[key].slice(0, TAB_ITEM_LIMIT).map(clean) };
  });
  return {
    tabs: out,
    total: out.reduce((s, t) => s + (t.allowed ? t.count : 0), 0),
  };
}

/** The tab to open first: the first allowed one with work, else the first allowed. */
export function firstTabWithWork(tabs) {
  const list = rows(tabs).filter((t) => t.allowed);
  return (list.find((t) => t.count > 0) || list[0] || null)?.key || null;
}
