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

export async function getMaterialTrends({ companyId, months = 3 }) {
  const since = new Date();
  since.setMonth(since.getMonth() - months);

  const materials = await db.material.findMany({
    where: { companyId },
    include: {
      priceEntries: {
        where: { date: { gte: since } },
        orderBy: { date: "asc" },
      },
    },
  });

  return materials
    .filter((m) => m.priceEntries.length >= 2)
    .map((m) => {
      const first = safeNumber(m.priceEntries[0].price);
      const last = safeNumber(m.priceEntries[m.priceEntries.length - 1].price);
      const pctChange =
        first > 0 ? round2(((last - first) / first) * 100) : null;
      return {
        name: m.name,
        unit: m.unit,
        firstPrice: first,
        latestPrice: last,
        pctChange,
        belowReorderThreshold:
          m.reorderThreshold != null
            ? last < safeNumber(m.reorderThreshold)
            : null,
      };
    });
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

// Tool schema in Anthropic's tool-use format. Descriptions matter — this is what the
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
    name: "getMaterialTrends",
    description:
      "Get price trends for tracked materials over a recent period, including reorder flags",
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
];

export const COPILOT_TOOL_IMPLEMENTATIONS = {
  getConversionRate,
  getTopClients,
  getMaterialTrends,
  getCashFlow,
  getProfitByCategory,
  getRepeatCustomerRate,
};
