// lib/ai/copilotTools.js
// Read-only, company-scoped functions Copilot can call. IMPORTANT: companyId is bound
// as a closure argument by copilotClient.js, never taken from the model — the model can
// never ask about a different company's data no matter what it's prompted to do.

import { db } from "@/lib/db";
import { safeNumber, round2 } from "@/lib/safeNumber";

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

export async function getTopClients({ companyId, limit = 5 }) {
  const invoices = await db.invoice.findMany({
    where: { companyId, status: "paid" },
    select: { clientId: true, total: true, client: { select: { name: true } } },
  });

  const byClient = {};
  for (const inv of invoices) {
    if (!byClient[inv.clientId])
      byClient[inv.clientId] = { name: inv.client.name, total: 0, jobCount: 0 };
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
export async function getUpcomingWork({ companyId, days = 14 }) {
  const now = new Date();
  const until = new Date(now.getTime() + Math.max(1, Math.min(120, days)) * 86400000);
  const visits = await db.jobVisit.findMany({
    where: { job: { companyId }, scheduledAt: { gte: now, lte: until } },
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
      client: v.job?.client?.name || null,
      quote: v.job?.quote
        ? {
            number: v.job.quote.quoteNumber,
            status: v.job.quote.status,
            total: safeNumber(v.job.quote.total),
            notes: v.job.quote.notes || null,
            lineItemCount: Array.isArray(v.job.quote.lineItems) ? v.job.quote.lineItems.length : 0,
            hasClientPhotos: Array.isArray(v.job.quote.clientPhotos) && v.job.quote.clientPhotos.length > 0,
          }
        : null,
      invoices: (v.job?.quote?.invoices || []).map((i) => ({
        number: i.invoiceNumber,
        status: i.status,
        total: safeNumber(i.total),
      })),
    })),
  };
}

// Find quotes by number or client name and read inside them.
export async function findQuote({ companyId, query = "" }) {
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
      client: qu.client?.name || null,
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
export async function findInvoice({ companyId, query = "" }) {
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
      client: inv.client?.name || null,
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
export async function findJob({ companyId, query = "" }) {
  const q = String(query || "").trim();
  const jobs = await db.job.findMany({
    where: {
      companyId,
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
      timeEntries: { select: { hours: true, worker: { select: { hourlyRate: true } } } },
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
      const laborCost = (j.timeEntries || []).reduce(
        (s, e) => s + safeNumber(e.hours) * safeNumber(e.worker?.hourlyRate),
        0,
      );
      const quotedTotal = safeNumber(j.quote?.total);
      return {
        job: j.title,
        status: j.status,
        recurring: j.recurring,
        client: j.client?.name || null,
        completedAt: j.completedAt ? j.completedAt.toISOString() : null,
        loggedHours: Math.round(loggedHours * 10) / 10,
        // Labour only — materials/expenses aren't linked to a job in the data, so
        // this is deliberately NOT called margin. The model is told to present it
        // as labour vs. the quote, not as full profit.
        cost: {
          quotedTotal,
          laborCost: Math.round(laborCost * 100) / 100,
          laborVsQuote:
            quotedTotal > 0 ? Math.round((laborCost / quotedTotal) * 1000) / 10 : null,
          basis: "labour from logged time × worker pay rate; materials/expenses not job-linked",
        },
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
    description:
      "List the jobs scheduled in the next N days. Each item includes the scheduled date, the job title and status, the client, any note on the visit, and the linked quote — including the quote's NOTES, total, line-item count and whether the client attached photos — plus any invoices. Use this for questions about upcoming work and whether there are notes on it (e.g. 'any notes on next week's project?').",
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
    description:
      "Find jobs by job title or client name and read INSIDE the project: every visit with its date, status and NOTES and how many photos were taken, the hours logged against the job, the linked quote (total, notes, line items) and invoices (billed and paid), and a `cost` block with the quoted total and the LABOUR cost so far (logged hours × worker pay rate). Use for 'how is the X job going', 'what did the crew note', or 'are we over the hours we quoted'. IMPORTANT: `cost.laborCost` is LABOUR ONLY — materials/expenses are not job-linked in the data — so present it as labour vs. the quote, never as full profit or margin.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "A job title or a client name" },
      },
      required: ["query"],
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
};
