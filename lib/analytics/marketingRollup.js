// lib/analytics/marketingRollup.js
import { db } from "@/lib/db";

// Per-channel spend/leads/CPL aggregation — feeds the marketing settings page and the
// forecast curve's leadsPer1000/leadToSale inputs.
export async function getMarketingRollup({ companyId, from, to }) {
  const spends = await db.marketingSpend.findMany({
    where: {
      companyId,
      ...(from && to && { date: { gte: from, lte: to } }),
    },
  });

  const byChannel = {};

  for (const entry of spends) {
    const key = entry.platform;
    if (!byChannel[key]) {
      byChannel[key] = {
        platform: key,
        spend: 0,
        leads: 0,
        conversions: 0,
        clicks: 0,
        impressions: 0,
      };
    }
    byChannel[key].spend += Number(entry.amount);
    byChannel[key].leads += entry.leads || 0;
    byChannel[key].conversions += entry.conversions || 0;
    byChannel[key].clicks += entry.clicks || 0;
    byChannel[key].impressions += entry.impressions || 0;
  }

  const channels = Object.values(byChannel).map((c) => ({
    ...c,
    spend: round2(c.spend),
    costPerLead: c.leads > 0 ? round2(c.spend / c.leads) : null,
    costPerConversion:
      c.conversions > 0 ? round2(c.spend / c.conversions) : null,
    clickThroughRate:
      c.impressions > 0 ? round4(c.clicks / c.impressions) : null,
    leadConversionRate: c.leads > 0 ? round4(c.conversions / c.leads) : null,
  }));

  const totalSpend = channels.reduce((s, c) => s + c.spend, 0);
  const totalLeads = channels.reduce((s, c) => s + c.leads, 0);

  return {
    channels: channels.sort((a, b) => b.spend - a.spend),
    totals: {
      spend: round2(totalSpend),
      leads: totalLeads,
      blendedCostPerLead:
        totalLeads > 0 ? round2(totalSpend / totalLeads) : null,
    },
  };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
function round4(n) {
  return Math.round(n * 10000) / 10000;
}
