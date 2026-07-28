// lib/ai/monthlyDigest.js
import { complete } from "./provider";
import { db } from "@/lib/db";
import { getAnalyticsOverview } from "@/lib/analytics/overview";
import { getMarketingRollup } from "@/lib/analytics/marketingRollup";
import { getMaterialTrends } from "@/lib/ai/copilotTools";
import { Resend } from "resend";
import { lazyClient } from "@/lib/lazyClient";

// Lazy — see lib/lazyClient.js. Resend throws on a missing key, and at
// module scope that breaks `next build` rather than failing at runtime.
const resend = lazyClient(() => new Resend(process.env.RESEND_API_KEY));

export async function generateMonthlyDigest({
  companyId,
  periodStart,
  periodEnd,
}) {
  const company = await db.company.findUnique({ where: { id: companyId } });

  const [overview, marketing, materialTrends] = await Promise.all([
    getAnalyticsOverview({ companyId }),
    getMarketingRollup({ companyId, from: periodStart, to: periodEnd }),
    getMaterialTrends({ companyId, months: 1 }),
  ]);

  // Rule-based flags — computed in code, not by the model, so they're reliable
  // regardless of what the LLM decides to mention.
  const flags = [];

  materialTrends.forEach((m) => {
    if (m.pctChange !== null && m.pctChange <= -8) {
      flags.push(
        `${m.name} dropped ${Math.abs(m.pctChange)}% this month — good time to stock up.`,
      );
    }
    if (m.pctChange !== null && m.pctChange >= 10) {
      flags.push(
        `${m.name} rose ${m.pctChange}% this month — consider adjusting quotes that use it.`,
      );
    }
    if (m.belowReorderThreshold) {
      flags.push(`${m.name} price is below your reorder threshold.`);
    }
  });

  if (overview.conversionRate !== null && overview.conversionRate < 0.3) {
    flags.push(
      `Quote acceptance rate was ${Math.round(overview.conversionRate * 100)}% this month, below a healthy 30%+ range.`,
    );
  }

  const metricsForPrompt = {
    revenue: overview.revenue,
    expenses: overview.expenses,
    margin: overview.margin,
    quotesCreated: overview.quotesCreated,
    quotesAccepted: overview.quotesAccepted,
    conversionRate: overview.conversionRate,
    marketingSpend: marketing.totals.spend,
    marketingLeads: marketing.totals.leads,
    blendedCostPerLead: marketing.totals.blendedCostPerLead,
  };

  const summaryText = await complete({
    system:
      "You write short business updates for contractors. Use only the numbers you are given — never invent, estimate or extrapolate. Plain language, no jargon, no preamble.",
    prompt: `Write a 3-4 sentence monthly business summary for ${company.name}, a home services contractor. Numbers: ${JSON.stringify(metricsForPrompt)}. Notable flags this month: ${flags.length ? flags.join(" ") : "none"}. Write it like a knowledgeable colleague giving a quick update, not a formal report.`,
    maxTokens: 500,
  });

  const digest = await db.aiDigest.create({
    data: {
      companyId,
      periodStart,
      periodEnd,
      summaryText,
      highlightsJson: { metrics: metricsForPrompt, flags },
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
