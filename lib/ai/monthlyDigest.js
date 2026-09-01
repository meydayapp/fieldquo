// lib/ai/monthlyDigest.js
import { complete } from "./provider";
import { checkAiQuota, recordAiUsage } from "./usage";
import { db } from "@/lib/db";
import { getAnalyticsOverview } from "@/lib/analytics/overview";
import { getMarketingRollup } from "@/lib/analytics/marketingRollup";
import { Resend } from "resend";
import { lazyClient } from "@/lib/lazyClient";
import { describeRateTrend } from "@/lib/analytics/trend";
import { buildCallInsights } from "./callTranscriptDigest";
import { recordError } from "@/lib/platform/errorLog";

// Lazy — see lib/lazyClient.js. Resend throws on a missing key, and at
// module scope that breaks `next build` rather than failing at runtime.
const resend = lazyClient(() => new Resend(process.env.RESEND_API_KEY));

/**
 * The digest's own model call, quota-gated — split out from
 * generateMonthlyDigest so scripts/check-ai-credit.mjs can execute this
 * exact decision (checkAiQuota BEFORE complete(), and what happens on
 * refusal) against fakes, the same injection seam
 * lib/ai/callTranscriptDigest.js's buildCallInsights already uses for its
 * own model call.
 *
 * Checked before spending, same as every other AI feature (AGENTS.md:
 * "checkAiQuota BEFORE, recordAiUsage AFTER... on every path") — a cron
 * looping every company is not an exception to that rule; if anything it's
 * the path most worth gating, since it runs unattended once a month for
 * every tenant whether or not they're watching.
 *
 * Over the monthly AI allowance: a digest that just silently stops arriving
 * is the exact "feature that stops working with no explanation" failure
 * class this whole codebase is swept for — the owner is expecting a monthly
 * email and has no way to know it was skipped. So the digest still SENDS:
 * the real numbers the caller already computed (revenue, conversion,
 * marketing spend) cost nothing and are always trustworthy regardless of AI
 * quota. The one thing genuinely missing — the model's paragraph of prose
 * around them — is replaced with the SAME sentence an on-demand feature
 * already shows a user who hits the cap (quota.reason), not silence. And
 * it's logged where a human actually looks: /platform/errors, so a company
 * that's chronically over cap every month is visible to support, not just
 * invisible to its own owner.
 *
 * @returns {{ summaryText: string, aiSkipped: boolean }}
 */
export async function buildDigestSummaryText({
  companyId,
  companyName,
  metricsForPrompt,
  flags,
  periodStart,
  periodEnd,
  checkAiQuota: checkQuotaFn = checkAiQuota,
  complete: completeFn = complete,
  recordAiUsage: recordUsageFn = recordAiUsage,
  recordError: recordErrorFn = recordError,
}) {
  const quota = await checkQuotaFn(companyId);

  if (!quota.allowed) {
    await recordErrorFn({
      area: "ai",
      code: "monthly_digest_quota_exceeded",
      message: `Monthly digest for ${companyName || companyId} sent without its AI summary — company is over its monthly AI allowance.`,
      companyId,
      detail: { periodStart, periodEnd, cap: quota.cap, usageTokens: quota.usage?.tokens },
    });
    return { summaryText: quota.reason, aiSkipped: true };
  }

  const summaryText = await completeFn({
    onUsage: (u) =>
      recordUsageFn({ companyId, feature: "monthly_digest", ...u }),
    system:
      "You write short business updates for contractors. Use only the numbers you are given — never invent, estimate or extrapolate. Plain language, no jargon, no preamble.",
    prompt: `Write a 3-4 sentence monthly business summary for ${companyName}, a home services contractor. Numbers: ${JSON.stringify(metricsForPrompt)}. Notable flags this month: ${flags.length ? flags.join(" ") : "none"}. Write it like a knowledgeable colleague giving a quick update, not a formal report.`,
    maxTokens: 500,
  });

  return { summaryText, aiSkipped: false };
}

export async function generateMonthlyDigest({
  companyId,
  periodStart,
  periodEnd,
}) {
  const company = await db.company.findUnique({ where: { id: companyId } });

  const [overview, marketing] = await Promise.all([
    getAnalyticsOverview({ companyId }),
    getMarketingRollup({ companyId, from: periodStart, to: periodEnd }),
  ]);

  // Rule-based flags — computed in code, not by the model, so they're reliable
  // regardless of what the LLM decides to mention.
  const flags = [];


  if (overview.conversionRate !== null && overview.conversionRate < 0.3) {
    // The month-over-month clause is added ONLY when last month is real data —
    // describeRateTrend returns null otherwise and the sentence simply omits it,
    // rather than claiming a trend off a baseline that doesn't exist.
    const trend = describeRateTrend(overview.conversionRate, overview.priorConversionRate);
    flags.push(
      `Quote acceptance rate was ${Math.round(overview.conversionRate * 100)}% this month` +
        `${trend ? ` (${trend})` : ""}, below a healthy 30%+ range.`,
    );
  }

  const metricsForPrompt = {
    revenue: overview.revenue,
    expenses: overview.expenses,
    margin: overview.margin,
    quotesCreated: overview.quotesCreated,
    quotesAccepted: overview.quotesAccepted,
    conversionRate: overview.conversionRate,
    // Only when last month is real — an absent key is "no prior period", which
    // the model (told to use only given numbers) can't turn into a false claim.
    ...(overview.priorConversionRate != null
      ? { conversionRateLastMonth: overview.priorConversionRate }
      : {}),
    marketingSpend: marketing.totals.spend,
    marketingLeads: marketing.totals.leads,
    blendedCostPerLead: marketing.totals.blendedCostPerLead,
  };

  const { summaryText, aiSkipped } = await buildDigestSummaryText({
    companyId,
    companyName: company?.name,
    metricsForPrompt,
    flags,
    periodStart,
    periodEnd,
  });

  // The conversations behind the quotes above, not the numbers again. See
  // lib/ai/callTranscriptDigest.js's header for why this is the one place an
  // AI-authored addition was welcomed onto this report while
  // lib/analytics/winLoss.js and lib/analytics/estimateAccuracy.js both
  // stayed model-free on purpose: what a caller said out loud is evidence
  // that exists only as prose, and prose is the one thing the six-integers
  // arithmetic above cannot read. Metered under its own feature name
  // (FEATURE in that file) so its cost is separable from this summary's own
  // call in the platform AI-usage view.
  const callInsights = await buildCallInsights({
    companyId,
    from: periodStart,
    to: periodEnd,
  });

  const digest = await db.aiDigest.create({
    data: {
      companyId,
      periodStart,
      periodEnd,
      summaryText,
      // aiSkipped: written and read (app/app/settings/ai-usage would be the
      // natural place to surface it) so "this month's digest has no AI
      // paragraph" is a fact a UI can find, not just a difference between
      // summaryText's usual shape and quota.reason's.
      highlightsJson: { metrics: metricsForPrompt, flags, callInsights, aiSkipped },
    },
  });

  const owners = await db.member.findMany({
    where: { companyId, role: { in: ["owner", "admin"] }, active: true },
    include: { user: true },
  });

  for (const owner of owners) {
    if (!owner.user.email) continue;
    await resend.emails.send({
      from: `FieldQuo <digest@fieldquo.com>`,
      to: owner.user.email,
      subject: `Your ${periodStart.toLocaleString("en-US", { month: "long" })} summary`,
      html: `<p>${summaryText}</p>${flags.length ? `<ul>${flags.map((f) => `<li>${f}</li>`).join("")}</ul>` : ""}`,
    });
  }

  await db.aiDigest.update({
    where: { id: digest.id },
    data: { sentAt: new Date() },
  });

  return digest;
}
