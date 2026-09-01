// lib/invoices/lifecycle.js
//
// Which banners an invoice earns, and why.
//
// ── Why this is a pure function in lib/ and not JSX on the page ─────────────
//
// A banner is a claim the software makes in the contractor's voice: "overdue by
// 12 days", "paid in full", "nobody is assigned". Get one wrong and you have
// either an invoice chasing a client who already paid, or a red badge people
// learn to ignore. Both are worse than no banner.
//
// Written inline, that logic would be a chain of `&&` inside a render tree that
// nothing can execute. Here it takes plain values and returns plain objects, so
// scripts/check-invoice-banners.mjs can drive it through the cases that matter —
// a paid invoice must never claim to be overdue, a draft has never been billed
// and therefore cannot be late, a superseded version must not offer a Send
// button for a document that has been replaced.
//
// ── No words in this file ──────────────────────────────────────────────────
//
// Each banner is an id, a tone, an optional action id, and the DATA the sentence
// needs. The page turns that into a translated string. Putting English here
// would put English into a French office, and putting t() here would make the
// function untestable outside React — the two reasons this split is worth the
// indirection.
//
// ── Every condition below reads a real column ──────────────────────────────
//
//   status, sentAt, sentToEmail, dueDate, total, amountPaid, amountDue,
//   paidDate, parentInvoiceId, version  → Invoice
//   status, startDate, visits[].scheduledAt, visits[].assignedToId → Job / JobVisit
//   status, dueDate → Task, keyed invoice_sent:<id> (lib/tasks/autoCreate.js)
//
// Nothing here is decorative and nothing is derived from a default.

/// Half a cent, the same threshold every balance recompute in this codebase
/// uses (payments POST, the Stripe webhook, credit-visit-fee). Summing Decimals
/// through Number leaves float residue, and a page whose "paid" rule disagreed
/// with the API's would show a settled invoice as still owing.
export const PAID_EPSILON = 0.005;

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const asDate = (v) => {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

/**
 * Whole days between two dates, counted as CALENDAR days in local time.
 *
 * A due date is a day, not a moment — the same reasoning `daysFromNow` in
 * lib/tasks/autoCreate.js gives for flattening a task's due time to 09:00. An
 * invoice due today is not overdue at 4pm, and a millisecond subtraction would
 * either say "overdue by 0 days" (nonsense on screen) or flip it to overdue
 * mid-afternoon on the day it was due.
 */
export function calendarDaysBetween(from, to) {
  const a = asDate(from);
  const b = asDate(to);
  if (!a || !b) return null;
  const dayA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const dayB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((dayB - dayA) / 86_400_000);
}

/**
 * What is financially true about this invoice, before any banner is chosen.
 *
 * Exported because the page shows the same three numbers in the totals block
 * and the panels, and re-deriving "is it paid" in each of them is how one of
 * them ends up disagreeing.
 *
 * `amountDue` is preferred over total − paid because it is the column the API
 * writes and every other surface reads; the subtraction is the fallback for
 * rows written before it was seeded.
 */
export function invoiceMoney(invoice) {
  const total = num(invoice?.total);
  const paid = num(invoice?.amountPaid);
  const due =
    invoice?.amountDue === null || invoice?.amountDue === undefined
      ? total - paid
      : num(invoice.amountDue);
  return {
    total,
    paid,
    due,
    // "Nothing is owed" — deliberately not "somebody paid". A $0 invoice owes
    // nothing and has never been paid, and the banners below need to tell those
    // apart.
    settled: due <= PAID_EPSILON,
    partiallyPaid: paid > PAID_EPSILON && due > PAID_EPSILON,
  };
}

/**
 * The banners, in the order they should be read.
 *
 * @param {object}   p
 * @param {object}   p.invoice   the Invoice row (+ client, + versions)
 * @param {object?}  p.job       the linked Job with its visits, or null
 * @param {object?}  p.chaseTask the invoice_sent:<id> Task, or null
 * @param {Date}     p.now       injected so the check script can pin it
 * @returns {{id: string, tone: string, action: string|null, data: object}[]}
 */
export function selectInvoiceBanners({
  invoice,
  job = null,
  chaseTask = null,
  now = new Date(),
} = {}) {
  if (!invoice) return [];

  const banners = [];
  const money = invoiceMoney(invoice);
  const isDraft = invoice.status === "draft";
  const sentAt = asDate(invoice.sentAt);
  const dueDate = asDate(invoice.dueDate);

  // ── Superseded ────────────────────────────────────────────────────────────
  //
  // Editing a sent invoice writes a NEW row and leaves this one as history.
  // Everything below would otherwise offer to send, chase and take payment on a
  // document that has been replaced — the most expensive wrong button on the
  // page. So it returns early: on a superseded version there is exactly one
  // useful action, which is to go and look at the one that replaced it.
  const newer = (Array.isArray(invoice.versions) ? invoice.versions : [])
    .filter((v) => num(v.version) > num(invoice.version))
    .sort((a, b) => num(b.version) - num(a.version))[0];
  if (newer) {
    return [
      {
        id: "superseded",
        tone: "warning",
        action: "openLatest",
        data: {
          version: num(invoice.version) || 1,
          latestVersion: num(newer.version),
          latestId: newer.id,
        },
      },
    ];
  }

  // ── Refunded / disputed ────────────────────────────────────────────────
  //
  // Read off invoice.status, not off the balance: a refund or a dispute is
  // an EVENT that happened to this invoice, and the balance banners below
  // (computed from the now-net amountPaid/amountDue — see
  // lib/invoices/computeInvoiceState.js) already say what's currently owed
  // without knowing WHY. Both can be true on screen at once — "disputed" AND
  // "overdue" is a real, useful pairing, not a contradiction — so this does
  // not return early the way "superseded" does above.
  if (invoice.status === "disputed") {
    banners.push({
      id: "disputed",
      tone: "critical",
      action: null,
      data: {},
    });
  } else if (invoice.status === "refunded" || invoice.status === "partially_refunded") {
    banners.push({
      id: invoice.status === "refunded" ? "refunded" : "partiallyRefunded",
      tone: "warning",
      action: null,
      data: { refunded: num(invoice.amountRefunded) },
    });
  }

  // ── Money ────────────────────────────────────────────────────────────────

  // Paid wins over everything else that could be said about the balance, and it
  // is checked FIRST so no later rule can call a settled invoice late. `paid`
  // requires money to have actually arrived: a $0 invoice owes nothing and was
  // never paid, and saying "paid in full" over it would be inventing a payment.
  //
  // Excludes an open dispute specifically: a dispute doesn't touch
  // amountPaid/amountDue (computeInvoiceState leaves them alone while the
  // bank hasn't ruled — see its own header), so money.settled/money.paid
  // would otherwise both read exactly as they did before the dispute opened.
  // "Paid in full" right next to "a client's bank has disputed a payment on
  // this invoice" is the contradiction AGENTS.md calls a control that lies —
  // refunded/partially_refunded need no such exclusion, because THOSE do
  // reduce amountPaid, so the ordinary condition below already excludes them.
  if (invoice.status !== "disputed" && money.settled && money.paid > PAID_EPSILON) {
    banners.push({
      id: "paid",
      tone: "success",
      action: null,
      data: {
        paid: money.paid,
        paidDate: invoice.paidDate || null,
        via: invoice.paidVia || null,
      },
    });
  } else {
    // Overdue is only meaningful once the invoice has actually been billed. A
    // draft with a due date in the past was never sent to anybody, so nobody is
    // late — that is the office's own backlog, and the unsent banner below says
    // so honestly instead.
    const daysLate =
      !isDraft && dueDate ? calendarDaysBetween(dueDate, now) : null;
    if (daysLate !== null && daysLate > 0) {
      banners.push({
        id: "overdue",
        tone: "critical",
        action: "chase",
        data: { days: daysLate, due: money.due, dueDate: invoice.dueDate },
      });
    }

    if (money.partiallyPaid) {
      banners.push({
        id: "partiallyPaid",
        tone: "info",
        // Chasing the remainder is the action; it is the same reminder email,
        // and buildInvoiceEmail already states the outstanding balance.
        action: isDraft ? null : "chase",
        data: { paid: money.paid, due: money.due, total: money.total },
      });
    }
  }

  // ── Has it left the office ───────────────────────────────────────────────

  if (isDraft && !sentAt) {
    banners.push({
      id: "unsent",
      tone: "warning",
      action: "send",
      data: { total: money.total },
    });
  }

  // Blocks both Send and Chase — both routes 400 without it, and finding that
  // out by pressing the button is worse than being told. Only raised while
  // something is still owed: an address is not missing from a settled invoice
  // in any sense worth a banner.
  if (!money.settled && !String(invoice.client?.email || "").trim()) {
    banners.push({
      id: "noClientEmail",
      tone: "warning",
      action: "addClientEmail",
      data: { clientId: invoice.clientId || null, clientName: invoice.client?.name || null },
    });
  }

  // The chase task raised by the send route came due and the money still hasn't
  // arrived. Shown ONLY in that state: an open task that isn't due yet is not
  // something to act on today, and a banner that appears the moment an invoice
  // is sent would fire on every invoice in the company.
  if (
    !money.settled &&
    sentAt &&
    chaseTask?.status === "open" &&
    asDate(chaseTask.dueDate) &&
    calendarDaysBetween(chaseTask.dueDate, now) >= 0
  ) {
    banners.push({
      id: "chaseDue",
      tone: "warning",
      action: "chase",
      data: {
        taskId: chaseTask.id,
        dueDate: chaseTask.dueDate,
        sentAt: invoice.sentAt,
        sentToEmail: invoice.sentToEmail || null,
        due: money.due,
      },
    });
  }

  // ── The work ─────────────────────────────────────────────────────────────
  //
  // These are the links the invoice needs to reach the rest of the project:
  // without a job there are no timesheets, no visits and no real cost, so the
  // margin panel below can only ever show what somebody typed.

  if (!job) {
    banners.push({
      id: "noJob",
      tone: "info",
      action: "createJob",
      data: { quoteId: invoice.quoteId || null },
    });
  } else {
    const visits = Array.isArray(job.visits) ? job.visits : [];
    // A visit is a TRIP to the address — a two-week repaint with a start and
    // end date of its own has nothing to book a trip for, and "has no visit
    // booked" was true and irrelevant on that job. Job.startDate is the other
    // honest way a job is scheduled (same rule the "needs a date" banner on
    // the job page itself uses), so it silences this one exactly the way a
    // real visit does — not a weaker claim, no claim at all.
    if (visits.length === 0 && !job.startDate) {
      banners.push({
        id: "jobUnscheduled",
        tone: "warning",
        action: "scheduleVisit",
        data: { jobId: job.id, jobTitle: job.title || null },
      });
    } else if (visits.length > 0) {
      // The next visit that hasn't happened yet — a past visit with nobody
      // recorded against it is history, and asking someone to staff yesterday
      // is the kind of prompt that teaches people to stop reading prompts.
      const upcoming = visits
        .filter((v) => {
          const at = asDate(v.scheduledAt);
          return at && at.getTime() >= asDate(now).getTime();
        })
        .sort(
          (a, b) => asDate(a.scheduledAt) - asDate(b.scheduledAt),
        )[0];
      if (upcoming && !upcoming.assignedToId) {
        banners.push({
          id: "visitUnassigned",
          tone: "warning",
          action: "assignVisit",
          data: {
            jobId: job.id,
            visitId: upcoming.id,
            scheduledAt: upcoming.scheduledAt,
          },
        });
      }
    }
  }

  return banners;
}

/**
 * The money keys a banner's `data` can carry.
 *
 * Declared here rather than in lib/permissions/enforce.js on purpose: that file
 * decides WHO may see money, this file is the only thing that knows which keys
 * a banner puts money in. Splitting it the other way would put a list of
 * `paid`/`due`/`total` in a permissions module that has to be edited every time
 * a banner gains a figure — and the copy that rots is always the remote one.
 */
const BANNER_MONEY_KEYS = ["paid", "due", "total", "refunded"];

/**
 * The same banners with every amount removed.
 *
 * QA read "Paid in full — $7,645.00" off this endpoint as a member with
 * showPricing:false. The invoice's own totals block was correctly redacted; the
 * banner above it was assembled by a different route and said the number out
 * loud.
 *
 * The banners themselves stay. "Overdue by 12 days", "this has not been sent",
 * "nobody is assigned to the visit" are the state of the work, and a crew
 * member on a restricted grid is exactly who acts on the last of those. What
 * goes is the figure — and it is REMOVED rather than zeroed, because
 * `money(0)` renders "$0.00" and "Paid in full — $0.00 received" is a false
 * statement rather than a withheld one. The page reads the absence and prints
 * the amount-free sentence instead (app/app/invoices/[id]/LifecycleBanners.js).
 *
 * Pure and exported so scripts/check-invoice-banners.mjs can drive it.
 */
export function stripBannerMoney(banners) {
  if (!Array.isArray(banners)) return banners;
  return banners.map((b) => {
    if (!b || typeof b !== "object" || !b.data) return b;
    const data = { ...b.data };
    let hid = false;
    for (const key of BANNER_MONEY_KEYS) {
      if (data[key] !== undefined) {
        delete data[key];
        hid = true;
      }
    }
    return hid ? { ...b, data, pricingHidden: true } : b;
  });
}
