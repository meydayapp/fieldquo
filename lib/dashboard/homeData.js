// lib/dashboard/homeData.js
//
// The reads behind the home screen's work panel and "Your focus" section —
// one pass, one endpoint (app/api/dashboard/home/route.js). The rules that
// turn these rows into badges and cards are pure and live beside this file
// (workPanel.js, focus.js); this file only fetches, and it decides only two
// things itself: WHOSE rows (every query names the member's company, and the
// job reads are narrowed by assignedJobWhere exactly as GET /api/jobs is) and
// WHICH reads the member is allowed (the same hasLevel / can calls the list
// routes make, so the panel never counts what the list behind it would 403).
//
// A read the member may not make is not made, and its fact is null — never 0.
// "No invoices overdue" and "not yours to see" are different sentences.
//
// `db` is passed in rather than imported so scripts/check-dashboard-home.mjs
// can run this against a recording stub and prove every query is scoped to
// the caller's company.

import { can } from "@/lib/permissions";
import { assignedJobWhere, canSeeMoney, hasLevel, redactLead, scopeFilter } from "@/lib/permissions/enforce";
import { buildReceivables } from "@/lib/analytics/receivables";
import { invoiceFamilies } from "@/lib/export/accountingExport";
import { buildWorkPanel, companyDays } from "@/lib/dashboard/workPanel";
import { cleanFocusChoice } from "@/lib/dashboard/focus";
import { dayWindow, localDate } from "@/lib/receipts/time";

/** Rows a tab reads at most. The badge prints "99+" long before this. */
export const READ_CAP = 500;

const CLOSED_VISIT = ["cancelled", "canceled", "completed"];

/** What this member may see and do, from the grid — the list routes' own gates. */
export function homePermissions(full, member = {}) {
  const role = full?.role || member.role;
  const manage = can(role, "user:manage");
  return {
    requests: hasLevel(full, "requests", "view_only"),
    quotes: hasLevel(full, "quotes", "view_only"),
    jobs: hasLevel(full, "jobs", "view_only"),
    invoices: hasLevel(full, "invoices", "view_only"),
    assignBookings: can(role, "appointment:assign"),
    money: canSeeMoney(full),
    canRemind: hasLevel(full, "invoices", "view_create_edit") && !member.impersonation,
    canManage: manage,
    canCreateQuote: hasLevel(full, "quotes", "view_create_edit"),
    canCreateInvoice: hasLevel(full, "invoices", "view_create_edit"),
    canCreateClient: hasLevel(full, "clientsProperties", "full_edit"),
    seeTeam: can(role, "user:view"),
    approveTime: hasLevel(full, "timeTracking", "view_record_edit_all"),
    // The company's focus is the company's: owner or admin, and never a
    // support session (non-negotiable #2 — middleware refuses the PATCH first).
    editFocus: (role === "owner" || role === "admin") && !member.impersonation,
  };
}

/** The first instant of this calendar month in the company's zone. */
function monthStart(now, timeZone) {
  const today = localDate(now, timeZone);
  return today ? dayWindow(`${today.slice(0, 8)}01`, timeZone)?.start || null : null;
}

const count = async (fn) => {
  const n = await fn();
  return typeof n === "number" ? n : 0;
};

/**
 * Everything the home screen needs above the money panels.
 *
 * @param db       a Prisma client (or the check's stub)
 * @param member   getCurrentMember's shape: { companyId, userId, role, impersonation }
 * @param full     loadEnforceableMember's row
 * @param setup    optional () => Promise<{ [stepKey]: { done, applies } }> —
 *                 only called for someone who manages set-up
 */
export async function loadHomeData(db, { member, full, now = new Date(), setup = null } = {}) {
  const companyId = member.companyId;
  const perms = homePermissions(full, member);

  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { timezone: true, currency: true, signupPriority: true, signupFocus: true, stripeChargesEnabled: true },
  });
  const timeZone = company?.timezone || null;
  const { today, todayWin, tomorrowWin } = companyDays(now, timeZone);
  const since = monthStart(now, timeZone);
  const jobScope = assignedJobWhere(full);

  // ── The work panel's rows ────────────────────────────────────────────────
  const [leads, estimates, bookings, sentQuotes, jobs, visits] = await Promise.all([
    perms.requests
      ? db.leadRequest.findMany({
          where: { companyId, status: "new", quoteId: null },
          orderBy: { createdAt: "desc" },
          take: READ_CAP,
          select: { id: true, companyId: true, name: true, status: true, quoteId: true, createdAt: true, callbackRequestedAt: true },
        })
      : [],
    perms.requests && perms.quotes
      ? db.quote.findMany({
          where: { companyId, autoEstimated: true, needsReview: true, archivedAt: null },
          orderBy: { createdAt: "desc" },
          take: READ_CAP,
          select: { id: true, companyId: true, quoteNumber: true, status: true, autoEstimated: true, needsReview: true, archivedAt: true, createdAt: true, total: true, client: { select: { name: true } } },
        })
      : [],
    perms.requests && perms.assignBookings
      ? db.appointment.findMany({
          where: { companyId, status: "needs_supervisor", assignedToId: null, scheduledAt: { gte: now } },
          orderBy: { scheduledAt: "asc" },
          take: READ_CAP,
          select: { id: true, companyId: true, status: true, assignedToId: true, scheduledAt: true, client: { select: { name: true } } },
        })
      : [],
    perms.quotes
      ? db.quote.findMany({
          where: { companyId, status: "sent", archivedAt: null, historicalImportedAt: null, sentAt: { not: null } },
          orderBy: { sentAt: "asc" },
          take: READ_CAP,
          select: {
            id: true, companyId: true, clientId: true, quoteNumber: true, status: true, sentAt: true, followUpSentAt: true,
            validUntil: true, createdAt: true, archivedAt: true, historicalImportedAt: true, total: true,
            client: { select: { name: true } },
          },
        })
      : [],
    perms.jobs
      ? db.job.findMany({
          where: { companyId, status: "unscheduled", archivedAt: null, historicalImportedAt: null, ...jobScope },
          orderBy: { createdAt: "asc" },
          take: READ_CAP,
          select: { id: true, companyId: true, title: true, status: true, archivedAt: true, historicalImportedAt: true, createdAt: true, client: { select: { name: true } } },
        })
      : [],
    perms.jobs && todayWin && tomorrowWin
      ? db.jobVisit.findMany({
          where: {
            scheduledAt: { gte: todayWin.start, lt: tomorrowWin.end },
            status: { notIn: CLOSED_VISIT },
            job: { companyId, archivedAt: null, ...jobScope },
          },
          orderBy: { scheduledAt: "asc" },
          take: READ_CAP,
          select: {
            id: true, jobId: true, scheduledAt: true, status: true, photos: true, checklistItems: true,
            job: { select: { companyId: true, title: true, status: true, archivedAt: true, client: { select: { name: true } } } },
          },
        })
      : [],
  ]);

  // Newer quotes to the same clients (the "superseded" stop) and the automated
  // follow-ups already sent (the "last contact" clock) — the two facts the
  // quote rules need beyond the quote row itself.
  const clientIds = [...new Set(sentQuotes.map((q) => q.clientId).filter(Boolean))];
  const sentIds = sentQuotes.map((q) => q.id);
  const [laterQuotes, autoLogs] = await Promise.all([
    clientIds.length
      ? db.quote.findMany({
          where: { companyId, clientId: { in: clientIds }, historicalImportedAt: null },
          select: { id: true, companyId: true, clientId: true, createdAt: true },
        })
      : [],
    sentIds.length
      ? db.followUpLog.findMany({
          where: { entityType: "quote", entityId: { in: sentIds }, rule: { companyId } },
          select: { entityId: true, sentAt: true },
        })
      : [],
  ]);
  const lastAuto = new Map();
  for (const l of autoLogs) {
    const t = new Date(l.sentAt);
    if (!Number.isFinite(t.getTime())) continue;
    const prior = lastAuto.get(l.entityId);
    if (!prior || t > prior) lastAuto.set(l.entityId, t);
  }
  const sentIdSet = new Set(sentIds);
  const quoteRows = [
    ...sentQuotes.map((q) => ({ ...q, clientName: q.client?.name || "", lastAutoFollowUpAt: lastAuto.get(q.id) || null })),
    // The other quotes to those clients ride along only so "a newer quote
    // exists" can be seen; they are not "sent" and no rule counts them.
    ...laterQuotes.filter((q) => !sentIdSet.has(q.id)).map((q) => ({ ...q, status: "other" })),
  ];

  // ── Invoices: the receivables ledger, the same one the money panel uses ──
  let owed = [];
  let drafts = [];
  let receivables = null;
  if (perms.invoices) {
    const [invoices, payments] = await Promise.all([
      db.invoice.findMany({
        where: { companyId },
        select: {
          id: true, companyId: true, parentInvoiceId: true, version: true, invoiceNumber: true, status: true, total: true,
          dueDate: true, sentAt: true, createdAt: true, historicalImportedAt: true, endDate: true, paidDate: true,
          clientId: true, jobId: true, lastChasedAt: true, chaseCount: true,
          client: { select: { id: true, name: true } },
        },
      }),
      db.payment.findMany({
        where: { invoice: { companyId } },
        select: { invoiceId: true, amount: true, date: true },
      }),
    ]);
    receivables = buildReceivables({ invoices, payments, asOf: now });
    owed = receivables.invoices;
    drafts = invoiceFamilies(invoices)
      .map((f) => f.latest)
      .filter((inv) => inv?.status === "draft")
      .map((inv) => ({ ...inv, clientName: inv.client?.name || "" }));
  }

  const work = buildWorkPanel({
    now,
    timeZone,
    companyId,
    allowed: { requests: perms.requests, quotes: perms.quotes, jobs: perms.jobs, invoices: perms.invoices },
    showMoney: perms.money,
    canRemind: perms.canRemind,
    // A lead's name is contact detail on some grids; redactLead decides.
    leads: leads.map((l) => ({ ...redactLead(full, l), companyId: l.companyId, status: l.status, quoteId: l.quoteId })),
    estimates: estimates.map((q) => ({ ...q, clientName: q.client?.name || "" })),
    bookings: bookings.map((a) => ({ ...a, clientName: a.client?.name || "" })),
    quotes: quoteRows,
    jobs: jobs.map((j) => ({ ...j, clientName: j.client?.name || "" })),
    visits: visits.map((v) => ({
      id: v.id,
      jobId: v.jobId,
      scheduledAt: v.scheduledAt,
      status: v.status,
      companyId: v.job?.companyId,
      jobTitle: v.job?.title || "",
      jobStatus: v.job?.status,
      jobArchivedAt: v.job?.archivedAt,
      clientName: v.job?.client?.name || "",
    })),
    owed,
    drafts,
  });

  // ── "Your focus" facts ───────────────────────────────────────────────────
  const facts = { currency: company?.currency ?? null, todayDay: today };
  const monthly = since ? { gte: since } : undefined;
  const reads = [];
  if (perms.quotes && monthly) {
    reads.push(
      count(() => db.quote.count({ where: { companyId, historicalImportedAt: null, sentAt: monthly } })).then((v) => (facts.quotesSentThisMonth = v)),
      count(() => db.quote.count({ where: { companyId, historicalImportedAt: null } })).then((v) => (facts.quotesEver = v)),
      count(() => db.quote.count({ where: { companyId, status: "sent", archivedAt: null, historicalImportedAt: null } })).then((v) => (facts.quotesAwaiting = v)),
      count(() => db.quote.count({ where: { companyId, status: "accepted", acceptedAt: monthly } })).then((v) => (facts.quotesAcceptedThisMonth = v)),
    );
  }
  if (perms.requests && monthly) {
    reads.push(
      count(() => db.leadRequest.count({ where: { companyId, createdAt: monthly } })).then((v) => (facts.leadsThisMonth = v)),
      count(() => db.leadRequest.count({ where: { companyId, status: "new", quoteId: null } })).then((v) => (facts.leadsUnanswered = v)),
    );
  }
  // GET /api/clients serves every member (redacted), so the count is theirs too.
  reads.push(count(() => db.client.count({ where: { companyId } })).then((v) => (facts.clients = v)));
  if (perms.jobs && todayWin) {
    reads.push(
      count(() => db.job.count({ where: { companyId, status: "unscheduled", archivedAt: null, historicalImportedAt: null, ...jobScope } })).then(
        (v) => (facts.jobsUnscheduled = v),
      ),
      count(() =>
        db.appointment.count({
          where: {
            companyId,
            status: { not: "cancelled" },
            scheduledAt: { gte: todayWin.start, lt: todayWin.end },
            ...scopeFilter(full, "schedule", "assignedToId", member.userId),
          },
        }),
      ).then((v) => (facts.appointmentsToday = v)),
    );
  }
  if (perms.canManage) {
    reads.push(
      count(() => db.jobChecklistTemplate.count({ where: { companyId } })).then((v) => (facts.checklistTemplates = v)),
      count(() => db.followUpRule.count({ where: { companyId, triggerEvent: "quote_no_response", active: true, deletedAt: null } })).then(
        (v) => (facts.quoteFollowUpRules = v),
      ),
      db.followUpRule
        .findFirst({ where: { companyId, triggerEvent: "invoice_overdue", active: true, deletedAt: null, templateId: { not: null } }, select: { id: true } })
        .then((r) => (facts.invoiceReminderRule = Boolean(r))),
    );
    facts.cardPayments = company?.stripeChargesEnabled === true;
  }
  if (perms.seeTeam) {
    reads.push(count(() => db.member.count({ where: { companyId, active: true } })).then((v) => (facts.teamActive = v)));
  }
  if (perms.approveTime) {
    reads.push(count(() => db.timeEntry.count({ where: { status: "pending", worker: { companyId } } })).then((v) => (facts.timesheetsPending = v)));
  }
  if (perms.canManage && typeof setup === "function") {
    reads.push(
      Promise.resolve()
        .then(setup)
        .then((s) => (facts.setup = s && typeof s === "object" ? s : null))
        .catch(() => (facts.setup = null)),
    );
  }
  await Promise.all(reads);

  // Today's visits, from the rows already read for the Jobs tab.
  if (perms.jobs && todayWin) {
    const todays = visits.filter((v) => {
      const t = new Date(v.scheduledAt).getTime();
      return t >= todayWin.start.getTime() && t < todayWin.end.getTime() && !v.job?.archivedAt;
    });
    let checklistDone = 0;
    let checklistTotal = 0;
    for (const v of todays) {
      const items = Array.isArray(v.checklistItems) ? v.checklistItems : [];
      checklistTotal += items.length;
      checklistDone += items.filter((i) => i && i.done === true).length;
    }
    facts.visitsToday = todays.length;
    facts.stopsToday = todays.length + (facts.appointmentsToday ?? 0);
    facts.onsiteToday = {
      visits: todays.length,
      withPhotos: todays.filter((v) => Array.isArray(v.photos) && v.photos.length > 0).length,
      checklistDone,
      checklistTotal,
      firstJobId: todays[0]?.jobId || null,
    };
  }
  if (perms.invoices && perms.money && receivables) {
    facts.owed = {
      total: receivables.total,
      count: receivables.count,
      overdueCount: receivables.overdueCount,
      overdueTotal: receivables.overdueTotal,
      noInvoices: receivables.noInvoices === true,
    };
  }
  delete facts.appointmentsToday;

  const focus = cleanFocusChoice({ priority: company?.signupPriority, focus: company?.signupFocus });

  return {
    readOnly: Boolean(member.impersonation),
    currency: company?.currency ?? null,
    work,
    focus: { ...focus, answered: Boolean(focus.priority) },
    facts,
    perms: {
      canManage: perms.canManage,
      canCreateQuote: perms.canCreateQuote,
      canCreateInvoice: perms.canCreateInvoice,
      canCreateClient: perms.canCreateClient,
      canRemind: perms.canRemind,
      editFocus: perms.editFocus,
      money: perms.money,
    },
  };
}
