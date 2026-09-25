// lib/ai/copilotTools.js
// Read-only, company-scoped functions Copilot can call. IMPORTANT: companyId is bound
// as a closure argument by copilotClient.js, never taken from the model — the model can
// never ask about a different company's data no matter what it's prompted to do.
//
// ── The other half of that sentence, which was missing ─────────────────────
//
// companyId answered "whose data?" and nothing answered "which of THIS
// company's people may see it?". Every tool below ran with the full rights of
// the company, whoever asked. So a Worker with showPricing:false and
// jobCosting:false — refused by /api/products, /api/jobs/[id]/costing and
// every /api/analytics/* route — could ask FieldQuo AI "what was our cash flow
// last month" or "what's the total on INV-2026-0002" and be told. Asking the
// assistant walked around every boundary the rest of the app enforces, which
// makes the grid decorative for anyone who thinks to type the question.
//
// The fix is copilotToolsFor(member): the member's grid decides which tools
// EXIST for this conversation, and the model is handed only those.
//
// Why filter the tool list rather than redact the results. A tool the model
// was never given cannot be called, cannot be reasoned about, and cannot leak
// through a paraphrase. Redacting the RESULT leaves the model able to say "I
// found the invoice but I'm not allowed to show you the total" — which
// confirms the figure exists, names the record, and invites the person to go
// looking for another way to ask. Removing the capability is the honest
// boundary; a hidden one is an invitation.
//
// Two tools carry a restricted BLOCK inside an otherwise-permitted payload
// (getUpcomingWork's money, findJob's labour cost). Removing those outright
// would deny a worker the schedule they're entitled to — the same reason
// enforce.js redacts the clients list instead of 403-ing it. Those two drop
// the block AND the sentence of their description that promises it, together,
// so the same rule still holds: the model is never told about a capability it
// doesn't have.

import { db } from "@/lib/db";
import { safeNumber, round2 } from "@/lib/safeNumber";
import {
  hasLevel,
  hasToggle,
  redactClient,
  assignedJobWhere,
} from "@/lib/permissions/enforce";

/**
 * The client's name, through the read restriction.
 *
 * Every tool here selects `client: { select: { name: true } }` and nothing
 * else, and a name is the one thing every clientsProperties level permits — so
 * today this changes no output. It is still the place the rule belongs:
 * redactClient is a denylist over the row it's handed, so the day one of those
 * selects grows an email or a phone (they gain columns often), the
 * restriction applies here instead of having to be remembered at four call
 * sites.
 */
function clientName(member, client) {
  return redactClient(member, client)?.name || null;
}

export async function getConversionRate({ companyId, months = 3 }) {
  const since = new Date();
  since.setMonth(since.getMonth() - months);

  const [sent, accepted] = await Promise.all([
    db.quote.count({
      where: {
        companyId,
        status: { in: ["sent", "accepted", "declined"] },
        createdAt: { gte: since },
      },
    }),
    db.quote.count({
      where: { companyId, status: "accepted", createdAt: { gte: since } },
    }),
  ]);

  return {
    quotesSent: sent,
    quotesAccepted: accepted,
    conversionRate: sent > 0 ? round2((accepted / sent) * 100) : null,
    periodMonths: months,
  };
}

export async function getTopClients({ companyId, member, limit = 5 }) {
  const invoices = await db.invoice.findMany({
    where: { companyId, status: "paid" },
    select: { clientId: true, total: true, client: { select: { name: true } } },
  });

  const byClient = {};
  for (const inv of invoices) {
    if (!byClient[inv.clientId])
      byClient[inv.clientId] = {
        name: clientName(member, inv.client),
        total: 0,
        jobCount: 0,
      };
    byClient[inv.clientId].total += safeNumber(inv.total);
    byClient[inv.clientId].jobCount += 1;
  }

  return Object.values(byClient)
    .sort((a, b) => b.total - a.total)
    .slice(0, limit)
    .map((c) => ({ ...c, total: round2(c.total) }));
}


export async function getCashFlow({ companyId, months = 3 }) {
  const since = new Date();
  since.setMonth(since.getMonth() - months);

  const [paidInvoices, expenses] = await Promise.all([
    db.invoice.aggregate({
      where: { companyId, status: "paid", updatedAt: { gte: since } },
      _sum: { total: true },
    }),
    db.expense.aggregate({
      where: { companyId, date: { gte: since } },
      _sum: { amount: true },
    }),
  ]);

  const revenue = safeNumber(paidInvoices._sum.total);
  const expensesTotal = safeNumber(expenses._sum.amount);

  return {
    revenue: round2(revenue),
    expenses: round2(expensesTotal),
    net: round2(revenue - expensesTotal),
    periodMonths: months,
  };
}

export async function getProfitByCategory({ companyId, months = 3 }) {
  const since = new Date();
  since.setMonth(since.getMonth() - months);

  const groups = await db.quoteScopeGroup.findMany({
    where: {
      quote: { companyId, status: "accepted", createdAt: { gte: since } },
    },
    include: { category: true },
  });

  const byCategory = {};
  for (const g of groups) {
    const key = g.category.label;
    byCategory[key] = (byCategory[key] || 0) + safeNumber(g.subtotal);
  }

  return Object.entries(byCategory)
    .map(([label, total]) => ({ label, total: round2(total) }))
    .sort((a, b) => b.total - a.total);
}

export async function getRepeatCustomerRate({ companyId }) {
  const clients = await db.client.findMany({
    where: { companyId },
    include: { invoices: { where: { status: "paid" }, select: { id: true } } },
  });

  const withInvoices = clients.filter((c) => c.invoices.length > 0);
  const repeat = withInvoices.filter((c) => c.invoices.length > 1);

  return {
    totalPayingClients: withInvoices.length,
    repeatClients: repeat.length,
    repeatRate:
      withInvoices.length > 0
        ? round2((repeat.length / withInvoices.length) * 100)
        : null,
  };
}

// ── Lookup tools ────────────────────────────────────────────────────────────
//
// The analytics tools above answer "how am I doing?". These answer "what's on
// THIS job / quote / invoice?" — they read INSIDE a record (its notes, line
// items, prices, whether the client attached photos) so Copilot can handle
// "are there any notes on next week's project?" instead of only aggregates.
// Still strictly company-scoped: companyId is injected by askCopilot, never the
// model's to choose.

function lineItemsSummary(json) {
  const items = Array.isArray(json) ? json : [];
  return items.slice(0, 30).map((it) => ({
    description: it?.description ?? it?.label ?? "",
    quantity: it?.quantity ?? 1,
    amount: safeNumber(it?.amount ?? it?.rate ?? 0),
  }));
}

// What's scheduled in the next N days, each visit carrying its job, client, the
// linked quote (with its NOTES and line-item count) and any invoices — the
// single tool that answers "what's coming up and does it have notes?".
export async function getUpcomingWork({ companyId, member, days = 14 }) {
  // The schedule is the one thing a Worker is unambiguously entitled to, so
  // this tool survives showPricing:false — the totals hanging off it don't.
  // The description swapped in by TOOL_ACCESS drops its mention of them at the
  // same time, so the model never knows there was a number here to withhold.
  const showMoney = hasToggle(member, "showPricing");
  const now = new Date();
  const until = new Date(now.getTime() + Math.max(1, Math.min(120, days)) * 86400000);
  // ── …and only the jobs this member is on ────────────────────────────────
  //
  // This used to be `job: { companyId }` with no assignee condition, which is
  // why the tool was withheld from Crew rather than fixed. The same fragment
  // the /api/jobs routes use answers it: a member who sees the whole board
  // gets `{}` and the query is unchanged; a crew member gets their own jobs.
  //
  // Deliberately the JOB's scope, not `assignedToId: member.userId` on the
  // visit. Once a crew member is on a job, the answer to "what's coming up"
  // includes the colleague arriving the day after them — that is the site they
  // are working, and any other rule would make the assistant disagree with the
  // job page they can already open.
  const visits = await db.jobVisit.findMany({
    where: {
      job: { companyId, ...assignedJobWhere(member) },
      scheduledAt: { gte: now, lte: until },
    },
    orderBy: { scheduledAt: "asc" },
    take: 60,
    select: {
      scheduledAt: true,
      status: true,
      notes: true,
      job: {
        select: {
          title: true,
          status: true,
          client: { select: { name: true } },
          quote: {
            select: {
              quoteNumber: true, status: true, total: true, notes: true,
              lineItems: true, clientPhotos: true,
              invoices: { select: { invoiceNumber: true, status: true, total: true } },
            },
          },
        },
      },
    },
  });

  return {
    from: now.toISOString(),
    to: until.toISOString(),
    count: visits.length,
    work: visits.map((v) => ({
      date: v.scheduledAt.toISOString(),
      visitStatus: v.status,
      visitNotes: v.notes || null,
      job: v.job?.title || null,
      jobStatus: v.job?.status || null,
      client: clientName(member, v.job?.client),
      quote: v.job?.quote
        ? {
            number: v.job.quote.quoteNumber,
            status: v.job.quote.status,
            ...(showMoney ? { total: safeNumber(v.job.quote.total) } : {}),
            notes: v.job.quote.notes || null,
            lineItemCount: Array.isArray(v.job.quote.lineItems) ? v.job.quote.lineItems.length : 0,
            hasClientPhotos: Array.isArray(v.job.quote.clientPhotos) && v.job.quote.clientPhotos.length > 0,
          }
        : null,
      // Omitted entirely rather than sent with the totals stripped: an invoice
      // reduced to a number and a status is billing information dressed as
      // scheduling, and nothing upcoming depends on it.
      ...(showMoney
        ? {
            invoices: (v.job?.quote?.invoices || []).map((i) => ({
              number: i.invoiceNumber,
              status: i.status,
              total: safeNumber(i.total),
            })),
          }
        : {}),
    })),
  };
}

// Find quotes by number or client name and read inside them.
export async function findQuote({ companyId, member, query = "" }) {
  const q = String(query || "").trim();
  const quotes = await db.quote.findMany({
    where: {
      companyId,
      ...(q && {
        OR: [
          { quoteNumber: { contains: q, mode: "insensitive" } },
          { client: { name: { contains: q, mode: "insensitive" } } },
        ],
      }),
    },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      quoteNumber: true, status: true, total: true, subtotal: true, notes: true,
      lineItems: true, clientPhotos: true, createdAt: true,
      client: { select: { name: true } },
      scopeGroups: { select: { label: true } },
    },
  });
  return {
    matches: quotes.map((qu) => ({
      number: qu.quoteNumber,
      client: clientName(member, qu.client),
      status: qu.status,
      total: safeNumber(qu.total),
      notes: qu.notes || null,
      scope: (qu.scopeGroups || []).map((g) => g.label).filter(Boolean),
      lineItems: lineItemsSummary(qu.lineItems),
      hasClientPhotos: Array.isArray(qu.clientPhotos) && qu.clientPhotos.length > 0,
    })),
  };
}

// Find invoices by number or client name and read status, total, line items.
export async function findInvoice({ companyId, member, query = "" }) {
  const q = String(query || "").trim();
  const invoices = await db.invoice.findMany({
    where: {
      companyId,
      ...(q && {
        OR: [
          { invoiceNumber: { contains: q, mode: "insensitive" } },
          { client: { name: { contains: q, mode: "insensitive" } } },
        ],
      }),
    },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      invoiceNumber: true, status: true, total: true, subtotal: true, lineItems: true,
      dueDate: true, client: { select: { name: true } },
    },
  });
  return {
    matches: invoices.map((inv) => ({
      number: inv.invoiceNumber,
      client: clientName(member, inv.client),
      status: inv.status,
      total: safeNumber(inv.total),
      dueDate: inv.dueDate ? inv.dueDate.toISOString() : null,
      lineItems: lineItemsSummary(inv.lineItems),
    })),
  };
}

// Find jobs by title or client name and read INSIDE them: the visits with their
// dates/notes/photos, hours logged against the job, and the linked quote and
// invoices — the "how is this project actually going" view the schedule alone
// can't give.
export async function findJob({ companyId, member, query = "" }) {
  // `cost` is the job-costing panel in prose: labour spend against the quote,
  // built from colleagues' pay rates. /api/jobs/[id]/costing refuses it without
  // the jobCosting toggle, and the quote's own Cost & margin block honours the
  // same one, so the copilot has to as well or the gate is decorative.
  //
  // The rest of findJob — visits, notes, photos, hours, the quote — is not job
  // costing, and the toggle is off in every preset except Manager. Dropping the
  // whole tool would take "how is the Smith job going" away from a Dispatcher
  // over a block they were never being shown. So the block goes, and so does
  // the half of the tool description that advertises it.
  const showCost = hasToggle(member, "jobCosting");
  const q = String(query || "").trim();
  const jobs = await db.job.findMany({
    where: {
      companyId,
      // Same scope as GET /api/jobs. showPricing keeps Crew out of this tool
      // entirely, but a member who is scoped to their own jobs AND allowed
      // prices is a configuration the editor offers, and a search that answers
      // for the whole company is how "which jobs?" gets answered twice.
      ...assignedJobWhere(member),
      ...(q && {
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { client: { name: { contains: q, mode: "insensitive" } } },
        ],
      }),
    },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      title: true, status: true, recurring: true, completedAt: true,
      client: { select: { name: true } },
      visits: {
        orderBy: { scheduledAt: "asc" },
        take: 20,
        select: { scheduledAt: true, status: true, notes: true, photos: true },
      },
      timeEntries: {
        select: {
          hours: true,
          ...(showCost ? { worker: { select: { hourlyRate: true } } } : {}),
        },
      },
      quote: {
        select: {
          quoteNumber: true, status: true, total: true, notes: true, lineItems: true,
          clientPhotos: true,
          invoices: { select: { invoiceNumber: true, status: true, total: true, amountPaid: true } },
        },
      },
    },
  });

  return {
    matches: jobs.map((j) => {
      const loggedHours = (j.timeEntries || []).reduce((s, e) => s + safeNumber(e.hours), 0);
      // Labour cost from ACTUAL clocked time × each worker's pay rate. Entries
      // with no rate on the worker are counted in hours but not in cost, so the
      // figure is honest rather than padded with a guessed rate.
      //
      // Not computed at all without the toggle — a pay rate shouldn't be read
      // out of the database, let alone multiplied out, for someone who may not
      // see it.
      const laborCost = showCost
        ? (j.timeEntries || []).reduce(
            (s, e) => s + safeNumber(e.hours) * safeNumber(e.worker?.hourlyRate),
            0,
          )
        : 0;
      const quotedTotal = safeNumber(j.quote?.total);
      return {
        job: j.title,
        status: j.status,
        recurring: j.recurring,
        client: clientName(member, j.client),
        completedAt: j.completedAt ? j.completedAt.toISOString() : null,
        loggedHours: Math.round(loggedHours * 10) / 10,
        // Labour only — materials/expenses aren't linked to a job in the data, so
        // this is deliberately NOT called margin. The model is told to present it
        // as labour vs. the quote, not as full profit.
        ...(showCost
          ? {
              cost: {
                quotedTotal,
                laborCost: Math.round(laborCost * 100) / 100,
                laborVsQuote:
                  quotedTotal > 0 ? Math.round((laborCost / quotedTotal) * 1000) / 10 : null,
                basis:
                  "labour from logged time × worker pay rate; materials/expenses not job-linked",
              },
            }
          : {}),
        visits: (j.visits || []).map((v) => ({
          date: v.scheduledAt.toISOString(),
          status: v.status,
          notes: v.notes || null,
          photoCount: Array.isArray(v.photos) ? v.photos.length : 0,
        })),
        quote: j.quote
          ? {
              number: j.quote.quoteNumber,
              status: j.quote.status,
              total: safeNumber(j.quote.total),
              notes: j.quote.notes || null,
              lineItems: lineItemsSummary(j.quote.lineItems),
              hasClientPhotos: Array.isArray(j.quote.clientPhotos) && j.quote.clientPhotos.length > 0,
            }
          : null,
        invoices: (j.quote?.invoices || []).map((i) => ({
          number: i.invoiceNumber,
          status: i.status,
          total: safeNumber(i.total),
          paid: safeNumber(i.amountPaid),
        })),
      };
    }),
  };
}

// ── The pipeline in numbers ─────────────────────────────────────────────────
//
// The owner asked the support chat "how many quotes are pending" and "how much
// money is owed" and was told to open the Quotes list. The copilot's own
// suggestion chip asked "which clients haven't been invoiced yet?" and the
// model — handed findQuote and findInvoice, which open ONE document — had to
// answer that it had no tool that lists them. Every question below is one a
// page already answers with a filter and a sum; these compute the same
// figure once, server-side, so the assistant reads it out instead of
// describing where to click.
//
// Same rules as everything above: companyId is bound by the caller, `member`
// by copilotToolsFor, client names go through clientName(), and money appears
// only where TOOL_ACCESS says so (the description swaps with it, so the model
// is never promised a number it won't get).

const DAY_MS = 86400000;

/** Whole days from `date` to `now`, never negative; null for no date. */
function daysSince(date, now) {
  if (!date) return null;
  return Math.max(0, Math.floor((now.getTime() - new Date(date).getTime()) / DAY_MS));
}

function money(showMoney, value) {
  return showMoney ? { total: round2(safeNumber(value)) } : {};
}

// "How many quotes are pending?" — pending in the owner's words is SENT and
// unanswered; the tool also returns the drafts (the office's own backlog) and
// the accepted/declined tallies so "how is the pipeline" is one call.
export async function countQuotesByStatus({ companyId, member }) {
  const showMoney = hasToggle(member, "showPricing");
  const now = new Date();
  // Archived quotes are off the board — the list hides them behind a filter,
  // and a question about what is pending is a question about the live board.
  const live = { companyId, archivedAt: null };

  const [groups, oldestWaiting, pastValidUntil] = await Promise.all([
    db.quote.groupBy({
      by: ["status"],
      where: live,
      _count: { _all: true },
      _sum: { total: true },
    }),
    db.quote.findFirst({
      where: { ...live, status: "sent" },
      orderBy: [{ sentAt: "asc" }, { createdAt: "asc" }],
      select: {
        quoteNumber: true, sentAt: true, createdAt: true, total: true,
        client: { select: { name: true } },
      },
    }),
    db.quote.count({ where: { ...live, status: "sent", validUntil: { lt: now } } }),
  ]);

  const bucket = (status) => {
    const g = groups.find((x) => x.status === status);
    return { count: g?._count?._all || 0, ...money(showMoney, g?._sum?.total) };
  };

  return {
    asOf: now.toISOString(),
    // A count, named so: `total` beside four money buckets reads as money.
    totalQuotes: groups.reduce((s, g) => s + (g._count?._all || 0), 0),
    waitingOnClient: {
      ...bucket("sent"),
      pastValidUntil,
      oldest: oldestWaiting
        ? {
            number: oldestWaiting.quoteNumber,
            client: clientName(member, oldestWaiting.client),
            daysWaiting: daysSince(oldestWaiting.sentAt || oldestWaiting.createdAt, now),
            ...money(showMoney, oldestWaiting.total),
          }
        : null,
    },
    draft: bucket("draft"),
    accepted: bucket("accepted"),
    declined: bucket("declined"),
  };
}

// "How much money is owed?" — what can still be collected. Sent or overdue,
// minus what has been paid. A draft isn't owed (the client hasn't seen it);
// paid, refunded and disputed aren't owed either — a disputed invoice is money
// the bank is deciding on, and counting it here would send the owner to chase
// a client who already paid.
export async function getReceivables({ companyId, member, limit = 5 }) {
  const now = new Date();
  const invoices = await db.invoice.findMany({
    where: { companyId, status: { in: ["sent", "overdue"] } },
    select: {
      invoiceNumber: true, status: true, total: true, amountPaid: true,
      dueDate: true, sentAt: true, client: { select: { name: true } },
    },
  });

  const rows = invoices
    .map((i) => ({
      number: i.invoiceNumber,
      client: clientName(member, i.client),
      status: i.status,
      balance: round2(safeNumber(i.total) - safeNumber(i.amountPaid)),
      dueDate: i.dueDate ? i.dueDate.toISOString() : null,
      daysOverdue: i.dueDate && i.dueDate < now ? daysSince(i.dueDate, now) : 0,
      daysSinceSent: daysSince(i.sentAt, now),
    }))
    .filter((r) => r.balance > 0)
    .sort((a, b) => b.balance - a.balance);
  const overdue = rows.filter((r) => r.daysOverdue > 0 || r.status === "overdue");
  const sum = (list) => round2(list.reduce((s, r) => s + r.balance, 0));

  return {
    asOf: now.toISOString(),
    outstanding: { count: rows.length, total: sum(rows) },
    overdue: { count: overdue.length, total: sum(overdue) },
    // Still owed, but "overdue" can't be computed for it — said rather than
    // silently counted as on time.
    withoutDueDate: rows.filter((r) => !r.dueDate).length,
    top: rows.slice(0, Math.max(1, Math.min(20, safeNumber(limit, 5)))),
  };
}

// "Which clients haven't been invoiced yet?" — accepted quotes with nothing
// billed against the quote OR against any job made from it, plus jobs
// finished without a quote behind them and never invoiced.
export async function getUnbilledWork({ companyId, member }) {
  const showMoney = hasToggle(member, "showPricing");
  const now = new Date();

  const [quotes, jobs] = await Promise.all([
    db.quote.findMany({
      where: {
        companyId,
        status: "accepted",
        archivedAt: null,
        invoices: { none: {} },
        jobs: { none: { invoices: { some: {} } } },
      },
      orderBy: { acceptedAt: "asc" },
      take: 25,
      select: {
        quoteNumber: true, total: true, acceptedAt: true, createdAt: true,
        client: { select: { name: true } },
        jobs: { take: 3, select: { title: true, status: true, completedAt: true } },
      },
    }),
    db.job.findMany({
      where: {
        companyId,
        status: "completed",
        quoteId: null,
        invoices: { none: {} },
        ...assignedJobWhere(member),
      },
      orderBy: { completedAt: "asc" },
      take: 25,
      select: { title: true, completedAt: true, client: { select: { name: true } } },
    }),
  ]);

  const items = [
    ...quotes.map((q) => {
      const job = q.jobs?.[0] || null;
      return {
        kind: "accepted_quote",
        client: clientName(member, q.client),
        quote: q.quoteNumber,
        acceptedAt: (q.acceptedAt || q.createdAt).toISOString(),
        daysSinceAccepted: daysSince(q.acceptedAt || q.createdAt, now),
        ...(showMoney ? { amount: round2(safeNumber(q.total)) } : {}),
        jobStatus: job?.status || null,
        jobCompletedAt: job?.completedAt ? job.completedAt.toISOString() : null,
      };
    }),
    ...jobs.map((j) => ({
      kind: "completed_job",
      client: clientName(member, j.client),
      job: j.title,
      completedAt: j.completedAt ? j.completedAt.toISOString() : null,
      daysSinceCompleted: daysSince(j.completedAt, now),
    })),
  ];

  return {
    asOf: now.toISOString(),
    count: items.length,
    ...(showMoney
      ? { total: round2(items.reduce((s, i) => s + safeNumber(i.amount), 0)) }
      : {}),
    clients: [...new Set(items.map((i) => i.client).filter(Boolean))],
    items,
  };
}

// "What's on this week?" / "Which jobs am I on?" — Monday to Sunday of the
// current week (UTC), which is the week the schedule page draws. Each visit
// carries its full date so the model can name the day. `onlyMine` narrows to
// the visits assigned to the person asking; a member scoped to their own jobs
// is narrowed by assignedJobWhere regardless.
export async function getJobsThisWeek({ companyId, member, onlyMine = false }) {
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  // getUTCDay(): Sunday is 0, so Monday's offset is 6.
  from.setUTCDate(from.getUTCDate() - ((from.getUTCDay() + 6) % 7));
  const to = new Date(from.getTime() + 7 * DAY_MS);

  const [visits, unscheduledJobs] = await Promise.all([
    db.jobVisit.findMany({
      where: {
        job: { companyId, ...assignedJobWhere(member) },
        scheduledAt: { gte: from, lt: to },
        ...(onlyMine ? { assignedToId: member?.userId || "__none__" } : {}),
      },
      orderBy: { scheduledAt: "asc" },
      take: 80,
      select: {
        scheduledAt: true, status: true, notes: true,
        assignedTo: { select: { name: true } },
        job: {
          select: {
            title: true, status: true, siteAddress: true,
            client: { select: { name: true } },
          },
        },
      },
    }),
    // Work that exists but has no date yet — the answer to "what's this week"
    // is incomplete without "and nine jobs still need a date". Zero for a
    // member scoped to their own jobs: an unscheduled job is assigned to
    // nobody (see assignedJobWhere).
    db.job.count({ where: { companyId, status: "unscheduled", ...assignedJobWhere(member) } }),
  ]);

  return {
    from: from.toISOString(),
    to: to.toISOString(),
    onlyMine: Boolean(onlyMine),
    count: visits.length,
    unscheduledJobs,
    visits: visits.map((v) => ({
      date: v.scheduledAt.toISOString(),
      status: v.status,
      job: v.job?.title || null,
      jobStatus: v.job?.status || null,
      client: clientName(member, v.job?.client),
      address: v.job?.siteAddress || null,
      assignedTo: v.assignedTo?.name || null,
      notes: v.notes || null,
    })),
  };
}

// "How many leads came in?" — counts only. No name, email, phone or message
// ever leaves this function: a lead is a client one step earlier in the
// pipeline, and the pipeline board's redaction rule (redactLead) exists for
// exactly that. Counting them needs none of it.
export async function countLeads({ companyId, days = 30 }) {
  const span = Math.max(1, Math.min(365, Math.round(safeNumber(days, 30))));
  const now = new Date();
  const since = new Date(now.getTime() - span * DAY_MS);
  const since7 = new Date(now.getTime() - 7 * DAY_MS);
  const inPeriod = { companyId, createdAt: { gte: since } };

  const [byStatus, bySource, last7Days, awaitingFirstContact] = await Promise.all([
    db.leadRequest.groupBy({ by: ["status"], where: inPeriod, _count: { _all: true } }),
    db.leadRequest.groupBy({ by: ["source"], where: inPeriod, _count: { _all: true } }),
    db.leadRequest.count({ where: { companyId, createdAt: { gte: since7 } } }),
    // Any age: a lead nobody has called yet is a to-do whether it arrived
    // yesterday or last quarter.
    db.leadRequest.count({ where: { companyId, status: "new" } }),
  ]);

  const count = (status) => byStatus.find((g) => g.status === status)?._count?._all || 0;
  return {
    periodDays: span,
    since: since.toISOString(),
    total: byStatus.reduce((s, g) => s + (g._count?._all || 0), 0),
    byStatus: {
      new: count("new"),
      contacted: count("contacted"),
      converted: count("converted"),
      lost: count("lost"),
    },
    bySource: bySource
      .map((g) => ({ source: g.source || "unknown", count: g._count?._all || 0 }))
      .sort((a, b) => b.count - a.count),
    last7Days,
    awaitingFirstContact,
  };
}

/** Calendar bounds for getAverageQuoteValue's `period`. UTC month edges. */
function periodBounds(period, now) {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  switch (period) {
    case "last_month":
      return { label: "last_month", from: new Date(Date.UTC(y, m - 1, 1)), to: new Date(Date.UTC(y, m, 1)) };
    case "last_3_months":
      return { label: "last_3_months", from: new Date(Date.UTC(y, m - 2, 1)), to: new Date(Date.UTC(y, m + 1, 1)) };
    case "this_year":
      return { label: "this_year", from: new Date(Date.UTC(y, 0, 1)), to: new Date(Date.UTC(y + 1, 0, 1)) };
    default:
      return { label: "this_month", from: new Date(Date.UTC(y, m, 1)), to: new Date(Date.UTC(y, m + 1, 1)) };
  }
}

// "What's my average quote value this month?" — issued quotes only. A draft
// has no agreed value yet, and counting it would let a half-written estimate
// move the average.
export async function getAverageQuoteValue({ companyId, period = "this_month" }) {
  const now = new Date();
  const { label, from, to } = periodBounds(period, now);
  const inPeriod = { companyId, archivedAt: null, createdAt: { gte: from, lt: to } };

  const [issued, accepted] = await Promise.all([
    db.quote.aggregate({
      where: { ...inPeriod, status: { in: ["sent", "accepted", "declined"] } },
      _count: { _all: true },
      _avg: { total: true },
      _min: { total: true },
      _max: { total: true },
      _sum: { total: true },
    }),
    db.quote.aggregate({
      where: { ...inPeriod, status: "accepted" },
      _count: { _all: true },
      _avg: { total: true },
    }),
  ]);

  const quoteCount = issued._count?._all || 0;
  return {
    period: label,
    from: from.toISOString(),
    to: to.toISOString(),
    quoteCount,
    averageValue: quoteCount ? round2(safeNumber(issued._avg?.total)) : null,
    lowest: quoteCount ? round2(safeNumber(issued._min?.total)) : null,
    highest: quoteCount ? round2(safeNumber(issued._max?.total)) : null,
    totalQuoted: round2(safeNumber(issued._sum?.total)),
    acceptedCount: accepted._count?._all || 0,
    acceptedAverage: accepted._count?._all ? round2(safeNumber(accepted._avg?.total)) : null,
    basis: "sent, accepted and declined quotes created in the period; drafts excluded",
  };
}

// "Which material costs went up the most?" — each material's latest recorded
// price against the last price known before the window opened (or the first
// price inside it). Only materials bought inside the window count: a price
// that hasn't been recorded in ninety days is not a change, it is silence.
export async function getMaterialCostChanges({ companyId, days = 90, limit = 10 }) {
  const span = Math.max(7, Math.min(365, Math.round(safeNumber(days, 90))));
  const cap = Math.max(1, Math.min(25, Math.round(safeNumber(limit, 10))));
  const now = new Date();
  const since = new Date(now.getTime() - span * DAY_MS);

  const materials = await db.material.findMany({
    where: { companyId, priceEntries: { some: {} } },
    take: 300,
    select: {
      name: true, unit: true, category: true,
      priceEntries: { orderBy: { date: "asc" }, select: { price: true, date: true, supplier: true } },
    },
  });

  const changes = [];
  for (const m of materials) {
    const entries = (m.priceEntries || []).map((e) => ({
      price: safeNumber(e.price),
      date: new Date(e.date),
      supplier: e.supplier || null,
    }));
    if (entries.length < 2) continue;
    const latest = entries[entries.length - 1];
    if (latest.date < since) continue;
    const before = entries.filter((e) => e.date < since);
    const baseline = before.length ? before[before.length - 1] : entries[0];
    if (baseline === latest || baseline.price <= 0) continue;
    const change = round2(latest.price - baseline.price);
    if (change === 0) continue;
    changes.push({
      material: m.name,
      unit: m.unit || null,
      category: m.category || null,
      from: round2(baseline.price),
      fromDate: baseline.date.toISOString(),
      to: round2(latest.price),
      toDate: latest.date.toISOString(),
      supplier: latest.supplier,
      change,
      changePct: round2((change / baseline.price) * 100),
    });
  }

  return {
    periodDays: span,
    since: since.toISOString(),
    materialsTracked: materials.length,
    materialsWithChange: changes.length,
    increases: changes.filter((c) => c.change > 0).sort((a, b) => b.changePct - a.changePct).slice(0, cap),
    decreases: changes.filter((c) => c.change < 0).sort((a, b) => a.changePct - b.changePct).slice(0, cap),
  };
}

// ── Descriptions that come in two versions ──────────────────────────────────
//
// The pair a tool's payload can vary by (see getUpcomingWork and findJob).
// Written out in full rather than assembled from fragments: this is the text
// the model reads to decide what it can do, and a description stitched
// together at runtime is one nobody can read in review.
const UPCOMING_WORK_DESCRIPTION =
  "List the jobs scheduled in the next N days. Each item includes the scheduled date, the job title and status, the client, any note on the visit, and the linked quote — including the quote's NOTES, total, line-item count and whether the client attached photos — plus any invoices. Use this for questions about upcoming work and whether there are notes on it (e.g. 'any notes on next week's project?').";

const UPCOMING_WORK_DESCRIPTION_NO_PRICING =
  "List the jobs scheduled in the next N days. Each item includes the scheduled date, the job title and status, the client, any note on the visit, and the linked quote — its NOTES, line-item count and whether the client attached photos. Use this for questions about upcoming work and whether there are notes on it (e.g. 'any notes on next week's project?'). It returns no amounts.";

const FIND_JOB_DESCRIPTION =
  "Find jobs by job title or client name and read INSIDE the project: every visit with its date, status and NOTES and how many photos were taken, the hours logged against the job, the linked quote (total, notes, line items) and invoices (billed and paid), and a `cost` block with the quoted total and the LABOUR cost so far (logged hours × worker pay rate). Use for 'how is the X job going', 'what did the crew note', or 'are we over the hours we quoted'. IMPORTANT: `cost.laborCost` is LABOUR ONLY — materials/expenses are not job-linked in the data — so present it as labour vs. the quote, never as full profit or margin.";

const FIND_JOB_DESCRIPTION_NO_COSTING =
  "Find jobs by job title or client name and read INSIDE the project: every visit with its date, status and NOTES and how many photos were taken, the hours logged against the job, the linked quote (total, notes, line items) and invoices (billed and paid). Use for 'how is the X job going', 'what did the crew note', or 'are we over the hours we quoted'. It returns hours, not labour cost.";

const COUNT_QUOTES_DESCRIPTION =
  "Count this company's quotes by status, with the money on each bucket: waitingOnClient (SENT and not yet answered — what people mean by 'pending', 'open' or 'waiting on a response', including how many are past their valid-until date and the OLDEST one with its number, client, total and days waiting), draft (written but not sent), accepted and declined. Use this for 'how many quotes are pending / outstanding / waiting', 'how much is out on quotes', or 'how is the pipeline'.";

const COUNT_QUOTES_DESCRIPTION_NO_PRICING =
  "Count this company's quotes by status: waitingOnClient (SENT and not yet answered — what people mean by 'pending', 'open' or 'waiting on a response', including how many are past their valid-until date and the OLDEST one with its number, client and days waiting), draft (written but not sent), accepted and declined. Use this for 'how many quotes are pending / outstanding / waiting' or 'how is the pipeline'. It returns counts, not amounts.";

const UNBILLED_WORK_DESCRIPTION =
  "List the work that has been won or done but NOT invoiced: accepted quotes with no invoice on the quote or on its job (with the client, quote number, amount, days since acceptance and the job's status), and completed jobs with no quote behind them and no invoice. `clients` is the de-duplicated list of client names. Use for 'which clients haven't been invoiced yet', 'what's finished but not billed', 'what can I invoice today'.";

const UNBILLED_WORK_DESCRIPTION_NO_PRICING =
  "List the work that has been won or done but NOT invoiced: accepted quotes with no invoice on the quote or on its job (with the client, quote number, days since acceptance and the job's status), and completed jobs with no quote behind them and no invoice. `clients` is the de-duplicated list of client names. Use for 'which clients haven't been invoiced yet' or 'what's finished but not billed'. It returns no amounts.";

// Tool schema. Kept in Anthropic's `input_schema` naming and translated to
// OpenAI's shape in provider.js, so these definitions stay vendor-neutral —
// the JSON Schema inside is identical either way. Descriptions matter: this is what the
// model reads to decide which tool answers a given question.
export const COPILOT_TOOL_DEFINITIONS = [
  {
    name: "getConversionRate",
    description: "Get quote-to-acceptance conversion rate over a recent period",
    input_schema: {
      type: "object",
      properties: {
        months: {
          type: "number",
          description: "Lookback period in months, default 3",
        },
      },
    },
  },
  {
    name: "getTopClients",
    description: "Get the highest-paying clients by total paid invoice amount",
    input_schema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "How many clients to return, default 5",
        },
      },
    },
  },
  {
    name: "getCashFlow",
    description:
      "Get revenue, expenses, and net cash flow over a recent period",
    input_schema: {
      type: "object",
      properties: {
        months: {
          type: "number",
          description: "Lookback period in months, default 3",
        },
      },
    },
  },
  {
    name: "getProfitByCategory",
    description: "Get accepted-quote revenue broken down by service category",
    input_schema: {
      type: "object",
      properties: {
        months: {
          type: "number",
          description: "Lookback period in months, default 3",
        },
      },
    },
  },
  {
    name: "getRepeatCustomerRate",
    description:
      "Get the percentage of paying clients who have paid more than one invoice",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "getUpcomingWork",
    description: UPCOMING_WORK_DESCRIPTION,
    input_schema: {
      type: "object",
      properties: {
        days: { type: "number", description: "How many days ahead to look, default 14" },
      },
    },
  },
  {
    name: "findQuote",
    description:
      "Find quotes by quote number (e.g. Q-2026-0007) or client name, and read INSIDE them: status, total, the NOTES written on the quote, the scope of work, the line items (description + amount), and whether the client attached photos. Use for any question about a specific quote's contents, pricing or notes.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "A quote number or a client name" },
      },
      required: ["query"],
    },
  },
  {
    name: "findInvoice",
    description:
      "Find invoices by invoice number or client name and read their status, total, due date and line items.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "An invoice number or a client name" },
      },
      required: ["query"],
    },
  },
  {
    name: "findJob",
    description: FIND_JOB_DESCRIPTION,
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "A job title or a client name" },
      },
      required: ["query"],
    },
  },
  {
    name: "countQuotesByStatus",
    description: COUNT_QUOTES_DESCRIPTION,
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "getReceivables",
    description:
      "How much money is owed to this company right now: every sent or overdue invoice's unpaid balance, summed (`outstanding`), the overdue part of it (`overdue`, with count and total), how many have no due date, and the top invoices by balance with the client name, days overdue and days since it was sent. Use for 'how much money is owed / outstanding / unpaid', 'who owes us', 'what's overdue', 'accounts receivable'.",
    input_schema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "How many of the largest balances to list, default 5" },
      },
    },
  },
  {
    name: "getUnbilledWork",
    description: UNBILLED_WORK_DESCRIPTION,
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "getJobsThisWeek",
    description:
      "The visits scheduled Monday to Sunday of THIS week — each with its date, the job and its status, the client, the site address, who it's assigned to and any note — plus how many jobs still have no date at all (`unscheduledJobs`). Pass onlyMine:true for 'which jobs am I on / assigned to'. Use for 'what's on this week', 'what am I doing this week', 'what still needs scheduling'. For further ahead, use getUpcomingWork.",
    input_schema: {
      type: "object",
      properties: {
        onlyMine: {
          type: "boolean",
          description: "Only the visits assigned to the person asking, default false",
        },
      },
    },
  },
  {
    name: "countLeads",
    description:
      "How many leads (requests, enquiries, instant quotes, bookings) came in over the last N days, by status (new / contacted / converted / lost) and by source, plus the last-7-day count and how many are still awaiting a first contact at any age. Counts only — no names or contact details. Use for 'how many leads', 'where are leads coming from', 'how many haven't been called back'.",
    input_schema: {
      type: "object",
      properties: {
        days: { type: "number", description: "Lookback window in days, default 30" },
      },
    },
  },
  {
    name: "getAverageQuoteValue",
    description:
      "The average value of the quotes ISSUED (sent, accepted or declined — drafts excluded) in a period, with the count, lowest, highest, total quoted, and the accepted subset's count and average. Use for 'average quote value', 'typical job size', 'how much did we quote this month'.",
    input_schema: {
      type: "object",
      properties: {
        period: {
          type: "string",
          enum: ["this_month", "last_month", "last_3_months", "this_year"],
          description: "Calendar period, default this_month",
        },
      },
    },
  },
  {
    name: "getMaterialCostChanges",
    description:
      "Which material prices moved the most over the last N days, from the company's own recorded purchase prices: for each material the earlier price, the latest price, the supplier, and the change in currency and percent — `increases` largest first, `decreases` separately. `materialsTracked` says how many materials have any price history at all; if it is 0, the company hasn't recorded material prices yet. Use for 'which material costs went up', 'what got more expensive', 'material price changes'.",
    input_schema: {
      type: "object",
      properties: {
        days: { type: "number", description: "Lookback window in days, default 90" },
        limit: { type: "number", description: "How many materials to list per direction, default 10" },
      },
    },
  },
];

export const COPILOT_TOOL_IMPLEMENTATIONS = {
  getConversionRate,
  getTopClients,
  getCashFlow,
  getProfitByCategory,
  getRepeatCustomerRate,
  getUpcomingWork,
  findQuote,
  findInvoice,
  findJob,
  countQuotesByStatus,
  getReceivables,
  getUnbilledWork,
  getJobsThisWeek,
  countLeads,
  getAverageQuoteValue,
  getMaterialCostChanges,
};

// ── Who gets which tool ─────────────────────────────────────────────────────
//
// `allow` is read against the SAME helpers every route uses, so a tool and the
// endpoint that serves the same data can't drift apart. `describe` is optional
// and only exists for the two tools whose payload varies (above).
//
// The reasoning is per tool, because "it returns money" isn't true of all of
// them in the same way:
const TOOL_ACCESS = {
  // Currency in, currency out. /api/analytics/overview refuses the same
  // figures on the same toggle; arriving at them through a sentence rather
  // than a chart doesn't change what they are.
  //
  // showPricing ALONE was not what the REST layer asks, and QA proved the gap
  // by asking. getCashFlow aggregates `expense.amount` across the whole
  // company — which is exactly what GET /api/expenses/summary refuses on
  // `hasLevel(full, "expenses", "view_record_edit_all")`, with the sentence
  // "You don't have access to company-wide expenses." A Dispatcher whose own
  // expenses totalled $125.50 got 403 from the endpoint and "Total expenses
  // (3mo) $9,120.50 / Net cash flow $624.50" from the assistant.
  //
  // Both halves are required because the payload has both: revenue is
  // showPricing, the expense total is the expenses ladder, and `net` is
  // neither on its own. There is no version of a cash-flow answer with the
  // expenses removed — that is a revenue figure with a misleading label — so
  // the tool goes away entirely rather than coming back hollowed out, the same
  // decision findQuote and findInvoice already carry.
  getCashFlow: {
    allow: (m) =>
      hasToggle(m, "showPricing") &&
      hasLevel(m, "expenses", "view_record_edit_all"),
  },
  getProfitByCategory: { allow: (m) => hasToggle(m, "showPricing") },

  // Money per client, which is also the shape of a customer list worth
  // taking to a competitor. showPricing for the totals; the names go through
  // redactClient in the implementation.
  getTopClients: { allow: (m) => hasToggle(m, "showPricing") },

  // No currency symbol in either payload — and both are still gated on
  // showPricing, because /api/analytics/overview already serves conversion
  // alongside revenue under exactly that toggle. A rate computed from money
  // is a statement about the money. Splitting the two would mean the
  // dashboard refuses a number the assistant recites.
  getConversionRate: { allow: (m) => hasToggle(m, "showPricing") },
  getRepeatCustomerRate: { allow: (m) => hasToggle(m, "showPricing") },

  // What's on the calendar. Gated on seeing jobs at all, NOT on pricing: the
  // totals inside it are dropped by the implementation and by this description
  // together, and the schedule itself is not money.
  //
  // ── It is now the caller's calendar, not the company's ──────────────────
  //
  // The history is worth keeping, because the level here looks too low
  // otherwise. This tool ran `job: { companyId }` with no assignee condition,
  // so at view_only it returned every visit in the company — and when Crew
  // dropped to jobs:none the tool was taken away from them rather than fixed,
  // because handing back "your week" would have handed back everyone's.
  //
  // The filter that was missing now exists in one place (assignedJobWhere),
  // the implementation spreads it, and Crew are back at jobs:view_only — so
  // this rule grants them exactly the schedule for the jobs they are on. The
  // level is unchanged and the tool is theirs again as a consequence of the
  // preset, which is the whole point of gating on the grid rather than on a
  // preset name.
  getUpcomingWork: {
    allow: (m) => hasLevel(m, "jobs", "view_only"),
    describe: (m) =>
      hasToggle(m, "showPricing")
        ? UPCOMING_WORK_DESCRIPTION
        : UPCOMING_WORK_DESCRIPTION_NO_PRICING,
  },

  // Opening a specific document. Both halves are required: the category level
  // says they may look at quotes/invoices at all, showPricing says they may
  // see what's on them. A quote read aloud minus its line-item amounts is not
  // a quote, and an invoice is a total with a date on it — for these two
  // there is no useful version without the money, which is why they go away
  // entirely rather than come back hollowed out.
  findQuote: {
    allow: (m) => hasLevel(m, "quotes", "view_only") && hasToggle(m, "showPricing"),
  },
  findInvoice: {
    allow: (m) => hasLevel(m, "invoices", "view_only") && hasToggle(m, "showPricing"),
  },

  // findJob carries a quote total and invoice totals (showPricing) on top of
  // visits, notes and hours (jobs). Its labour-cost block is job costing and
  // is gated separately, inside the implementation, on jobCosting — see the
  // comment there for why that block moves rather than the whole tool.
  findJob: {
    allow: (m) => hasLevel(m, "jobs", "view_only") && hasToggle(m, "showPricing"),
    describe: (m) =>
      hasToggle(m, "jobCosting") ? FIND_JOB_DESCRIPTION : FIND_JOB_DESCRIPTION_NO_COSTING,
  },

  // ── The pipeline in numbers ─────────────────────────────────────────────
  //
  // The owner's rule for these (2026-09-24): owner and admin see all of it;
  // someone who quotes sees quotes, leads and jobs but not what is owed;
  // crew see their schedule and nothing with a currency sign. Expressed
  // against the grid rather than the preset name, like everything above, so
  // an owner who hands an estimator the payments switch has handed them the
  // receivables question too — one decision, made in one place.

  // Counting quotes is the Quotes list with its status filter. The counts
  // need only the category; the money on each bucket needs showPricing and
  // drops out (with its sentence) without it.
  countQuotesByStatus: {
    allow: (m) => hasLevel(m, "quotes", "view_only"),
    describe: (m) =>
      hasToggle(m, "showPricing") ? COUNT_QUOTES_DESCRIPTION : COUNT_QUOTES_DESCRIPTION_NO_PRICING,
  },

  // Money owed is collection, and `payments` is the switch that says who
  // collects — "Allow payment collection on quotes and invoices" in
  // PERMISSION_TOGGLES. The Estimator and Dispatcher presets hold showPricing
  // and invoices:view_only, so gating on those alone would read the
  // receivables ledger to the person who writes the quotes; the payments
  // switch is off for both and on for Manager, which is the split the owner
  // described. There is no version of "who owes us" without the amounts, so
  // the tool goes away entirely rather than hollowed out.
  getReceivables: {
    allow: (m) =>
      hasLevel(m, "invoices", "view_only") &&
      hasToggle(m, "showPricing") &&
      hasToggle(m, "payments"),
  },

  // Won-but-not-billed is a quotes question and an invoices question at once
  // — the answer lists quotes the reader could open and says no invoice
  // exists for them, so both categories are required. Amounts are the
  // quote totals, which showPricing already governs.
  getUnbilledWork: {
    allow: (m) => hasLevel(m, "quotes", "view_only") && hasLevel(m, "invoices", "view_only"),
    describe: (m) =>
      hasToggle(m, "showPricing") ? UNBILLED_WORK_DESCRIPTION : UNBILLED_WORK_DESCRIPTION_NO_PRICING,
  },

  // The week is the schedule, and the schedule is what a crew member is
  // unambiguously entitled to — the same rule as getUpcomingWork, with the
  // same assignedJobWhere narrowing inside. No money in the payload.
  getJobsThisWeek: { allow: (m) => hasLevel(m, "jobs", "view_only") },

  // Leads are the Requests category. Counts carry no contact detail, so the
  // lowest rung is enough; Crew sit at requests:none and get nothing, which
  // matches the board they can't open.
  countLeads: { allow: (m) => hasLevel(m, "requests", "view_only") },

  // An average of quote totals is a statement about the money, gated the
  // way getConversionRate is and for the same reason.
  getAverageQuoteValue: {
    allow: (m) => hasLevel(m, "quotes", "view_only") && hasToggle(m, "showPricing"),
  },

  // Recorded purchase prices are company-wide expense data — the same ladder
  // rung getCashFlow needs for the expense total, and the same reason:
  // GET /api/expenses/summary refuses company-wide figures below it.
  getMaterialCostChanges: {
    allow: (m) =>
      hasToggle(m, "showPricing") && hasLevel(m, "expenses", "view_record_edit_all"),
  },
};

/**
 * The tools this member may use, and implementations with their member bound.
 *
 * @param member  the row from loadEnforceableMember — { role, permissions }.
 *                A member with no grid (everyone who predates it) passes every
 *                check, exactly as hasLevel/hasToggle do elsewhere; owners and
 *                admins bypass the grid entirely, so their tool list is the
 *                full list, unchanged.
 * @returns {{ definitions, implementations }} — pass straight to runToolLoop.
 */
export function copilotToolsFor(member) {
  const definitions = [];
  const implementations = {};

  for (const def of COPILOT_TOOL_DEFINITIONS) {
    const access = TOOL_ACCESS[def.name];

    // A tool added without an access rule is denied, not waved through. The
    // opposite default would make the next tool ship open by omission — the
    // failure that put this file in a security fix in the first place — and
    // the missing rule is loud in the log rather than invisible in a payload.
    if (!access) {
      console.error(`[copilotTools] no access rule for "${def.name}" — withheld`);
      continue;
    }
    if (!access.allow(member)) continue;

    definitions.push(
      access.describe ? { ...def, description: access.describe(member) } : def,
    );

    const impl = COPILOT_TOOL_IMPLEMENTATIONS[def.name];
    // `member` last, for the same reason copilotClient.js puts `companyId`
    // last: a model that invents a `member` argument has it overwritten rather
    // than honoured.
    implementations[def.name] = (args) => impl({ ...args, member });
  }

  return { definitions, implementations };
}
