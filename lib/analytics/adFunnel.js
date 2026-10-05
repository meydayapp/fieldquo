// lib/analytics/adFunnel.js
//
// What the ad money bought, counted honestly: Meta's conversations → real
// conversations → leads → quotes → won jobs → invoiced, per source, with
// FieldQuo's cost per REAL conversation and per lead beside Meta's own cost
// per conversation and per lead. Pure: the loader (adFunnelData.js) reads, this
// counts, scripts/check-lead-qualification.mjs runs it against fixtures.
//
// ══ Why (owner, 2026-10-05) ════════════════════════════════════════════════
//
// "FB counts any click as a conversation even if accidental, but we should
// really understand how much is spent per actual conversation or lead. Actual
// conversations are more valuable." TrueFinish's ads opened 445 Messenger
// threads; 141 of them never typed a word of their own. Meta's "cost per
// messaging conversation" divides the spend by all 445.
//
// ══ The rows ═══════════════════════════════════════════════════════════════
//
//   facebook_ads   Messenger threads that began on an ad (adReferral, or
//                  Meta's "X replied to an ad." line in a history thread)
//   instagram_ads  the same on Instagram
//   whatsapp_ads   click-to-WhatsApp, only when there is any
//   organic        every thread that did not start on an ad
//   all_ads        the ad rows together — the ONLY row with money, because
//                  Meta reports spend and its own counts per campaign, not
//                  per app. A per-app cost would be a split nobody measured.
//
// ══ The two sets of numbers, never mixed ═══════════════════════════════════
//
//   Meta's       `metaConversations` (messaging_conversation_started_7d) and
//                `metaLeads` (Meta's lead-shaped actions), and Meta's cost per
//                each — spend ÷ Meta's own count. Shown as Meta's, labelled.
//   FieldQuo's   threads received, real conversations (tier conversation or
//                lead — lib/leads/qualification.js), leads (tier lead, or a
//                conversation whose lead became a quote: a quote is proof),
//                quotes, won jobs, invoiced. Cost per real conversation and
//                per lead = the same spend ÷ FieldQuo's counts.
//
// Spend not connected → every cost is null and `spendMissing` is true; the
// screen says so and still shows the counts. A rate whose denominator is zero
// is null, never 0 and never Infinity (failure class #5).

import { outcomesForLeads } from "@/lib/analytics/campaignRollup";

export const FUNNEL_SOURCES = Object.freeze(["facebook_ads", "instagram_ads", "whatsapp_ads", "organic"]);

const round2 = (n) => Math.round(n * 100) / 100;
const ratio = (a, b) => (a === null || a === undefined || !(b > 0) ? null : round2(a / b));

/** Which row a thread belongs to. Pure. */
export function funnelSource(thread) {
  const origin = thread?.origin === "ad" ? "ad" : "organic";
  if (origin === "organic") return "organic";
  if (thread.platform === "instagram") return "instagram_ads";
  if (thread.platform === "whatsapp") return "whatsapp_ads";
  return "facebook_ads";
}

const empty = (source) => ({
  source,
  threads: 0,
  tapOnly: 0,
  notRelevant: 0,
  realConversations: 0,
  leads: 0,
  unclassified: 0,
  quotes: 0,
  inferredQuotes: 0,
  won: 0,
  invoiced: null,
  _leadRows: [],
});

/**
 * @param threads  [{ id, platform, origin, tier, leadId }] — tier from the
 *                 stored or freshly computed qualification (null = not yet)
 * @param leads    LeadRequest rows those threads point at: { id, quoteId,
 *                 inferredQuoteId? } — the money chain follows these
 * @param outcomeIndex  buildOutcomeIndex({ jobs, invoices })
 * @param spend    { amount: number|null, metaConversations: number|null,
 *                   metaLeads: number|null, currency } — Meta's, for the range
 */
export function buildAdFunnel({ threads = [], leads = [], outcomeIndex, spend = null }) {
  const rows = new Map(FUNNEL_SOURCES.map((s) => [s, empty(s)]));
  const leadById = new Map((Array.isArray(leads) ? leads : []).filter((l) => l && l.id).map((l) => [l.id, l]));

  for (const t of Array.isArray(threads) ? threads : []) {
    if (!t) continue;
    const row = rows.get(funnelSource(t));
    row.threads++;
    const lead = t.leadId ? leadById.get(t.leadId) || null : null;
    const quoted = Boolean(lead && (lead.quoteId || lead.inferredQuoteId));
    if (t.tier === "tap_only") row.tapOnly++;
    else if (t.tier === "not_relevant") row.notRelevant++;
    else if (!t.tier) row.unclassified++;
    if (t.tier === "conversation" || t.tier === "lead" || quoted) row.realConversations++;
    if (t.tier === "lead" || quoted) {
      row.leads++;
      if (lead) row._leadRows.push(lead);
    }
  }

  const index = outcomeIndex || { jobsByQuote: new Map(), revenueByJob: new Map(), paidByJob: new Map() };
  const all = empty("all_ads");
  for (const row of rows.values()) {
    const o = outcomesForLeads(row._leadRows, index);
    row.quotes = o.quoteIds.length;
    row.inferredQuotes = o.inferredQuotes;
    row.won = o.jobIds.length;
    row.invoiced = o.revenue === null ? null : round2(o.revenue);
    if (row.source !== "organic") {
      for (const k of ["threads", "tapOnly", "notRelevant", "realConversations", "leads", "unclassified"]) all[k] += row[k];
      all._leadRows.push(...row._leadRows);
    }
  }
  const allOutcome = outcomesForLeads(all._leadRows, index);
  all.quotes = allOutcome.quoteIds.length;
  all.inferredQuotes = allOutcome.inferredQuotes;
  all.won = allOutcome.jobIds.length;
  all.invoiced = allOutcome.revenue === null ? null : round2(allOutcome.revenue);

  const amount = spend && Number.isFinite(Number(spend.amount)) && spend.amount !== null ? Number(spend.amount) : null;
  const spendMissing = amount === null;
  const metaConversations = spend?.metaConversations ?? null;
  const metaLeads = spend?.metaLeads ?? null;
  Object.assign(all, {
    spend: spendMissing ? null : round2(amount),
    metaConversations,
    metaLeads,
    // Meta's own rates — its counts, its definition.
    metaCostPerConversation: spendMissing ? null : ratio(amount, metaConversations),
    metaCostPerLead: spendMissing ? null : ratio(amount, metaLeads),
    // FieldQuo's — the same money over what actually happened.
    costPerRealConversation: spendMissing ? null : ratio(amount, all.realConversations),
    costPerLead: spendMissing ? null : ratio(amount, all.leads),
  });

  const strip = ({ _leadRows, ...r }) => r;
  const sources = [...rows.values()]
    // WhatsApp ads only when there were any — an empty row for a channel a
    // company never ran is noise.
    .filter((r) => r.source !== "whatsapp_ads" || r.threads > 0)
    .map(strip);
  return { sources, allAds: strip(all), spendMissing, currency: spend?.currency || null };
}
