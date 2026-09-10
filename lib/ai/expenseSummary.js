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
//
// ── The panel that was headed "Resumen de IA" in English ──────────────────
//
// Reported by the owner: the heading went through t() and the sentence under
// it did not, because nothing here had ever been told who was reading. The
// summary is now GENERATED in the reader's language rather than translated
// afterwards — see lib/i18n/aiLanguage.js for why that distinction is the
// whole point — and the rule-based flags beneath it come from a template
// table rather than the model, so the arithmetic stays in code where it was.
import { complete } from "./provider";
import { recordAiUsage } from "./usage";
import { getExpenseSummaryData } from "@/lib/analytics/expenseSummaryData";
import { withLanguage } from "@/lib/i18n/aiLanguage";
import { expenseFlagLines } from "@/lib/i18n/aiSummaryCopy";
import { DEFAULT_LANGUAGE } from "@/app/i18n/languages";

export async function generateExpenseSummary({ companyId, month, language = DEFAULT_LANGUAGE }) {
  const data = await getExpenseSummaryData({ companyId, month });

  // Facts, not sentences. Rendered twice below — once in English for the
  // prompt, once in the reader's language for the screen — so the two can
  // never drift into describing different months.
  const flagFacts = [];

  if (data.burnRate.runwayMonths !== null && data.burnRate.runwayMonths < 3) {
    flagFacts.push({ key: "runway", values: { months: data.burnRate.runwayMonths } });
  }

  const topCategory = data.categoryBreakdown[0];
  if (topCategory && data.totalThisMonth > 0) {
    const pct = Math.round((topCategory.total / data.totalThisMonth) * 100);
    if (pct >= 40) {
      flagFacts.push({ key: "share", values: { category: topCategory.category, pct } });
    }
  }

  if (data.trend.length >= 2) {
    const prev = data.trend[data.trend.length - 2].total;
    const curr = data.trend[data.trend.length - 1].total;
    if (prev > 0) {
      const change = Math.round(((curr - prev) / prev) * 100);
      if (Math.abs(change) >= 15) {
        flagFacts.push({
          key: change > 0 ? "rose" : "fell",
          values: { pct: Math.abs(change) },
        });
      }
    }
  }

  // English for the model regardless of the reader: the prompt is instructions,
  // not output, and every model in play reads English instructions best. What
  // the reader sees is the list below it.
  const promptFlags = expenseFlagLines(DEFAULT_LANGUAGE, flagFacts);
  const flags = expenseFlagLines(language, flagFacts);

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
    system: withLanguage(
      "You write short business updates for contractors. Use only the numbers you are given — never invent, estimate or extrapolate. Plain language, no jargon, no preamble.",
      language,
    ),
    prompt: `Write a 3-4 sentence expense summary for a home services contractor's owner. Numbers: ${JSON.stringify(metricsForPrompt)}. Notable flags: ${promptFlags.length ? promptFlags.join(" ") : "none"}. Focus on where the money is actually going and whether the burn rate looks healthy. Write it like a knowledgeable colleague giving a quick update, not a formal report.`,
    maxTokens: 400,
  });

  return { summaryText, flags, data };
}
