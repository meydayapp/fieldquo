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
import { hasLevel, hasToggle, redactClient } from "@/lib/permissions/enforce";

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

  // What's on the calendar. Gated on seeing jobs at all, NOT on pricing — a
  // Worker's own week is the least restricted thing in the product. The
  // totals inside it are dropped by the implementation and by this
  // description together.
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
