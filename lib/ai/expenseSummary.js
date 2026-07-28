// lib/ai/expenseSummary.js
//
// Sibling to lib/ai/monthlyDigest.js, same provider, but
// scoped to expenses specifically and triggered on-demand from the Expense
// Tracking page (not scheduled, and it doesn't email anyone or write to
// db.aiDigest — that model is the monthly-digest system's own record, and
// mixing this into it would make periodStart/periodEnd ambiguous between
// the two features). If you'd rather this get archived somewhere, an
// AiDigest row with a marker in highlightsJson would work, but that's a
// product call more than a technical one.
import { complete } from "./provider";
import { recordAiUsage } from "./usage";
import { getExpenseSummaryData } from "@/lib/analytics/expenseSummaryData";

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

  // Every figure is computed above and passed in. The model writes prose
  // around numbers it was handed — it never calculates, so it can't be wrong
  // about the arithmetic, only about the wording.
  const summaryText = await complete({
    onUsage: (u) =>
      recordAiUsage({ companyId, feature: "expense_summary", ...u }),
    system:
      "You write short business updates for contractors. Use only the numbers you are given — never invent, estimate or extrapolate. Plain language, no jargon, no preamble.",
    prompt: `Write a 3-4 sentence expense summary for a home services contractor's owner. Numbers: ${JSON.stringify(metricsForPrompt)}. Notable flags: ${flags.length ? flags.join(" ") : "none"}. Focus on where the money is actually going and whether the burn rate looks healthy. Write it like a knowledgeable colleague giving a quick update, not a formal report.`,
    maxTokens: 400,
  });

  return { summaryText, flags, data };
}
