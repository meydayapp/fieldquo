// lib/ai/expenseSummary.js
//
// Sibling to lib/ai/monthlyDigest.js, same Anthropic client + model, but
// scoped to expenses specifically and triggered on-demand from the Expense
// Tracking page (not scheduled, and it doesn't email anyone or write to
// db.aiDigest — that model is the monthly-digest system's own record, and
// mixing this into it would make periodStart/periodEnd ambiguous between
// the two features). If you'd rather this get archived somewhere, an
// AiDigest row with a marker in highlightsJson would work, but that's a
// product call more than a technical one.
import Anthropic from "@anthropic-ai/sdk";
import { getExpenseSummaryData } from "@/lib/analytics/expenseSummaryData";
import { lazyClient } from "@/lib/lazyClient";

// Lazy — see lib/lazyClient.js. Constructing at module scope breaks the
// production build when ANTHROPIC_API_KEY isn't set at build time.
const anthropic = lazyClient(
  () => new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }),
);

export async function generateExpenseSummary({ companyId, month }) {
  const data = await getExpenseSummaryData({ companyId, month });

  const flags = [];

  if (data.burnRate.runwayMonths !== null && data.burnRate.runwayMonths < 3) {
    flags.push(
      `At the current burn rate, cash on hand covers about ${data.burnRate.runwayMonths} months.`,
    );
  }

  const topCategory = data.categoryBreakdown[0];
  if (topCategory && data.totalThisMonth > 0) {
    const pct = Math.round((topCategory.total / data.totalThisMonth) * 100);
    if (pct >= 40) {
      flags.push(
        `${topCategory.category} alone is ${pct}% of this month's tracked expenses.`,
      );
    }
  }

  if (data.trend.length >= 2) {
    const prev = data.trend[data.trend.length - 2].total;
    const curr = data.trend[data.trend.length - 1].total;
    if (prev > 0) {
      const change = Math.round(((curr - prev) / prev) * 100);
      if (Math.abs(change) >= 15) {
        flags.push(
          `Total expenses ${change > 0 ? "rose" : "fell"} ${Math.abs(change)}% vs last month.`,
        );
      }
    }
  }

  const metricsForPrompt = {
    totalThisMonth: data.totalThisMonth,
    categoryBreakdown: data.categoryBreakdown,
    associationBreakdown: data.associationBreakdown,
    monthlyBurn: data.burnRate.totalMonthlyBurn,
    burnBreakdown: data.burnRate.breakdown,
    runwayMonths: data.burnRate.runwayMonths,
    sixMonthTrend: data.trend,
  };

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 400,
    messages: [
      {
        role: "user",
        content: `Write a short (3-4 sentence), plain-language expense summary for a home services contractor's business owner. Use only these real numbers, don't invent anything: ${JSON.stringify(metricsForPrompt)}. Notable flags: ${flags.length ? flags.join(" ") : "none"}. Focus on where the money is actually going and whether the burn rate looks healthy. Write it like a knowledgeable colleague giving a quick update, not a formal report.`,
      },
    ],
  });

  const summaryText =
    response.content.find((b) => b.type === "text")?.text || "";

  return { summaryText, flags, data };
}
