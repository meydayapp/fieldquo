// lib/agency/metrics.js
//
// The agency's dashboard numbers, computed ONCE — the API
// (/api/v1/marketing/metrics and /funnel) and FieldQuo's own Marketing
// results page both call buildMarketingMetrics, so the owner can check what
// the agency reports against the same arithmetic, not a second copy of it.
// Pure: lib/agency/metricsData.js reads, this counts, and
// scripts/check-marketing-metrics.mjs runs it against a fixture month.
//
// ══ A cohort, not a calendar of events ════════════════════════════════════
//
// The period selects LEADS — the ones that first arrived in it — and every
// later stage counts what became of THOSE leads, whenever it happened. That
// is what makes the funnel reconcile: a stage can never exceed the one before
// it, and an appointment is counted once, for the lead it belongs to. It is
// the same reading lib/analytics/campaignRollupData.js makes ("the lead is in
// the period, the invoice may be later"). Ad spend is the spend dated in the
// period: what was paid to bring that cohort in.
//
// ══ Null, never 0, never Infinity ═════════════════════════════════════════
//
// A rate whose denominator is zero is null. Spend that is not connected is
// null, and so is every cost and ROAS computed from it — with the reason
// "spend_not_connected" — never a $0 that would make every lead look free
// (AGENTS.md failure class 5). Money a company chose not to share with its
// agency is null with "money_not_shared".
//
// ══ The definitions travel with the numbers ═══════════════════════════════
//
// DEFINITIONS is the one place each figure is defined. The API returns the
// sentence beside the value; the page shows it in the figure's info tooltip
// (translated through the same key). A figure without a definition fails
// scripts/check-marketing-metrics.mjs.

import { compare } from "@/lib/analytics/trend";
import { stagesOf, appointmentOutcome, QUALIFIED_TEMPERATURES } from "@/lib/agency/leadRow";
import { CHANNELS, META_CHANNELS, GOOGLE_CHANNELS, campaignKeyOf } from "@/lib/agency/channels";

const DAY = 24 * 60 * 60 * 1000;
const round2 = (n) => Math.round(n * 100) / 100;
const round4 = (n) => Math.round(n * 10000) / 10000;
const ratio = (a, b, r = round2) => (a === null || a === undefined || !(b > 0) ? null : r(a / b));

/** The middle value, or null for an empty list. Pure. */
export function median(values) {
  const v = (Array.isArray(values) ? values : []).filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

const t = (d) => (d ? new Date(d).getTime() : NaN);
const daysBetween = (a, b) => {
  const x = t(a);
  const y = t(b);
  return Number.isFinite(x) && Number.isFinite(y) && y >= x ? (y - x) / DAY : null;
};

/** Every metric, in display order, with its English definition and i18n key. */
export const DEFINITIONS = Object.freeze({
  adSpend: { kind: "money", key: "app.agencyMetrics.def.adSpend", en: "What the company's Meta and Google ad accounts spent in the period, in the company's currency. \"Not connected\" when neither account is connected and nothing was entered." },
  leads: { kind: "count", key: "app.agencyMetrics.def.leads", en: "Leads that first arrived in the period, from every channel — cold ones included." },
  costPerLead: { kind: "money", key: "app.agencyMetrics.def.costPerLead", en: "Ad spend ÷ leads." },
  qualifiedLeads: { kind: "count", key: "app.agencyMetrics.def.qualifiedLeads", en: "Leads scored warm or hot — or that went on to book a visit, get a quote or close, which proves it." },
  appointments: { kind: "count", key: "app.agencyMetrics.def.appointments", en: "Leads that booked an in-person appointment (counted once per lead, cancelled ones included)." },
  appointmentSetRate: { kind: "rate", key: "app.agencyMetrics.def.appointmentSetRate", en: "Appointments ÷ leads." },
  costPerAppointment: { kind: "money", key: "app.agencyMetrics.def.costPerAppointment", en: "Ad spend ÷ appointments." },
  quotesSent: { kind: "count", key: "app.agencyMetrics.def.quotesSent", en: "Leads that were sent a quote." },
  closes: { kind: "count", key: "app.agencyMetrics.def.closes", en: "Leads whose quote was accepted — they became clients. Includes closes without an in-person visit, which are also shown on their own." },
  closesWithoutVisit: { kind: "count", key: "app.agencyMetrics.def.closesWithoutVisit", en: "Closes with no in-person appointment before them." },
  closeRate: { kind: "rate", key: "app.agencyMetrics.def.closeRate", en: "Closes that had an in-person appointment ÷ appointments." },
  costPerClose: { kind: "money", key: "app.agencyMetrics.def.costPerClose", en: "Ad spend ÷ closes." },
  revenue: { kind: "money", key: "app.agencyMetrics.def.revenue", en: "The accepted value of every close (the won quote's total)." },
  collected: { kind: "money", key: "app.agencyMetrics.def.collected", en: "What has actually been paid on those closes' invoices so far." },
  roas: { kind: "multiple", key: "app.agencyMetrics.def.roas", en: "Revenue ÷ ad spend — return on ad spend." },
  averageJobSize: { kind: "money", key: "app.agencyMetrics.def.averageJobSize", en: "Revenue ÷ closes." },
  upcomingAppointments: { kind: "count", key: "app.agencyMetrics.def.upcomingAppointments", en: "Appointments booked whose date has not come yet." },
  adjustedCloseRate: { kind: "rate", key: "app.agencyMetrics.def.adjustedCloseRate", en: "Closes that had an in-person appointment ÷ appointments that have happened (upcoming and cancelled ones left out)." },
  messagesFromAds: { kind: "count", key: "app.agencyMetrics.def.messagesFromAds", en: "Facebook, Instagram and WhatsApp conversations that began on an ad in the period — every one, taps included." },
  realConversations: { kind: "count", key: "app.agencyMetrics.def.realConversations", en: "Of those, the ones where the person typed their own words about the work." },
  adLeads: { kind: "count", key: "app.agencyMetrics.def.adLeads", en: "Leads that came from a Meta or Google ad." },
  adQualifiedLeads: { kind: "count", key: "app.agencyMetrics.def.adQualifiedLeads", en: "Of those, the qualified ones (warm or hot)." },
  messageToLeadRate: { kind: "rate", key: "app.agencyMetrics.def.messageToLeadRate", en: "Leads from Meta ads ÷ conversations that began on a Meta ad." },
  leadToQualifiedRate: { kind: "rate", key: "app.agencyMetrics.def.leadToQualifiedRate", en: "Qualified leads ÷ leads." },
  speedToLeadMinutes: { kind: "minutes", key: "app.agencyMetrics.def.speedToLeadMinutes", en: "Median minutes from the lead's first message to the company's first reply, for leads that came in as a conversation." },
  medianDaysLeadToAppointment: { kind: "days", key: "app.agencyMetrics.def.medianDaysLeadToAppointment", en: "Median days from the lead arriving to the appointment date." },
  medianDaysAppointmentToQuote: { kind: "days", key: "app.agencyMetrics.def.medianDaysAppointmentToQuote", en: "Median days from the appointment to the quote being sent (quotes sent after the visit)." },
  medianDaysQuoteToClose: { kind: "days", key: "app.agencyMetrics.def.medianDaysQuoteToClose", en: "Median days from the quote being sent to it being accepted." },
  medianDaysLeadToClose: { kind: "days", key: "app.agencyMetrics.def.medianDaysLeadToClose", en: "Median days from the lead arriving to the quote being accepted." },
});

export const METRIC_KEYS = Object.freeze(Object.keys(DEFINITIONS));
const MONEY_METRICS = new Set(["revenue", "collected", "roas", "averageJobSize"]);

/**
 * @param {object} p
 * @param {object[]} p.facts   the cohort — leads created in the period,
 *                             already filtered by source/campaign
 * @param {object}   p.spend   { amount: number|null, connected: boolean,
 *                               approximate?: boolean }
 * @param {object|null} p.adMessages  { threads, realConversations } for Meta
 *                             conversations in the period, or null when not
 *                             countable for this filter
 * @param {boolean}  p.includeMoney  false when the company does not share
 *                             job values with its agency
 * @param {Date}     p.now
 * @returns {{ values: {key: number|null}, reasons: {key: string} , counts }}
 */
export function computeMetrics({ facts = [], spend = null, adMessages = null, includeMoney = true, now = new Date() } = {}) {
  const list = Array.isArray(facts) ? facts.filter(Boolean) : [];
  const reasons = {};
  const spendAmount = spend && spend.amount !== null && spend.amount !== undefined && Number.isFinite(Number(spend.amount)) ? Number(spend.amount) : null;

  let qualified = 0;
  let appointments = 0;
  let upcoming = 0;
  let occurred = 0;
  let cancelled = 0;
  let quotesSent = 0;
  let closes = 0;
  let closesWithVisit = 0;
  let closesWithoutVisit = 0;
  let revenue = null;
  let collected = null;
  let adLeads = 0;
  let adQualified = 0;
  let metaLeads = 0;
  const speeds = [];
  const leadToAppt = [];
  const apptToQuote = [];
  const quoteToClose = [];
  const leadToClose = [];

  for (const f of list) {
    const s = stagesOf(f);
    const paid = META_CHANNELS.includes(f.channel) || GOOGLE_CHANNELS.includes(f.channel);
    if (paid) {
      adLeads++;
      if (s.qualified) adQualified++;
    }
    if (META_CHANNELS.includes(f.channel)) metaLeads++;
    if (s.qualified) qualified++;
    if (s.appointment) {
      appointments++;
      const outcome = appointmentOutcome(f.appointment, now);
      if (outcome === "upcoming") upcoming++;
      else if (outcome === "cancelled") cancelled++;
      else occurred++;
      if (outcome !== "cancelled") {
        const d = daysBetween(f.createdAt, f.appointment.scheduledAt);
        if (d !== null) leadToAppt.push(d);
      }
    }
    if (s.quoteSent) quotesSent++;
    const sentAt = f.quote?.sentAt || null;
    if (s.appointment && sentAt && appointmentOutcome(f.appointment, now) !== "cancelled") {
      const d = daysBetween(f.appointment.scheduledAt, sentAt);
      if (d !== null) apptToQuote.push(d);
    }
    if (s.won) {
      closes++;
      if (s.appointment) closesWithVisit++;
      else closesWithoutVisit++;
      if (Number.isFinite(Number(f.wonAmount)) && f.wonAmount !== null) revenue = (revenue || 0) + Number(f.wonAmount);
      if (Number.isFinite(Number(f.collectedAmount)) && f.collectedAmount !== null) collected = (collected || 0) + Number(f.collectedAmount);
      const q = daysBetween(sentAt, f.wonAt);
      if (q !== null) quoteToClose.push(q);
      const l = daysBetween(f.createdAt, f.wonAt);
      if (l !== null) leadToClose.push(l);
    }
    if (f.firstResponseAt && f.firstContactAt) {
      const m = (t(f.firstResponseAt) - t(f.firstContactAt)) / 60000;
      if (Number.isFinite(m) && m >= 0) speeds.push(m);
    }
  }
  // Closes counted as revenue only once a close has a value; no closes at all
  // is a real zero of revenue.
  if (closes === 0) {
    revenue = 0;
    collected = 0;
  }

  const leads = list.length;
  const spendKnown = spendAmount !== null;
  const values = {
    adSpend: spendKnown ? round2(spendAmount) : null,
    leads,
    costPerLead: spendKnown ? ratio(spendAmount, leads) : null,
    qualifiedLeads: qualified,
    appointments,
    appointmentSetRate: ratio(appointments, leads, round4),
    costPerAppointment: spendKnown ? ratio(spendAmount, appointments) : null,
    quotesSent,
    closes,
    closesWithoutVisit,
    closeRate: ratio(closesWithVisit, appointments, round4),
    costPerClose: spendKnown ? ratio(spendAmount, closes) : null,
    revenue: revenue === null ? null : round2(revenue),
    collected: collected === null ? null : round2(collected),
    roas: spendKnown && revenue !== null ? ratio(revenue, spendAmount) : null,
    averageJobSize: revenue !== null ? ratio(revenue, closes) : null,
    upcomingAppointments: upcoming,
    adjustedCloseRate: ratio(closesWithVisit, occurred, round4),
    messagesFromAds: adMessages ? adMessages.threads ?? null : null,
    realConversations: adMessages ? adMessages.realConversations ?? null : null,
    adLeads,
    adQualifiedLeads: adQualified,
    messageToLeadRate: adMessages ? ratio(metaLeads, adMessages.threads, round4) : null,
    leadToQualifiedRate: ratio(qualified, leads, round4),
    speedToLeadMinutes: speeds.length ? Math.round(median(speeds)) : null,
    medianDaysLeadToAppointment: leadToAppt.length ? round2(median(leadToAppt)) : null,
    medianDaysAppointmentToQuote: apptToQuote.length ? round2(median(apptToQuote)) : null,
    medianDaysQuoteToClose: quoteToClose.length ? round2(median(quoteToClose)) : null,
    medianDaysLeadToClose: leadToClose.length ? round2(median(leadToClose)) : null,
  };

  // Why each null is null — a code the page translates and the API returns.
  for (const k of METRIC_KEYS) {
    if (values[k] !== null) continue;
    if (!spendKnown && ["adSpend", "costPerLead", "costPerAppointment", "costPerClose", "roas"].includes(k)) reasons[k] = "spend_not_connected";
    else if (["messagesFromAds", "realConversations", "messageToLeadRate"].includes(k) && !adMessages) reasons[k] = "not_counted_for_this_filter";
    else reasons[k] = "nothing_to_divide";
  }
  if (!includeMoney) {
    for (const k of MONEY_METRICS) {
      values[k] = null;
      reasons[k] = "money_not_shared";
    }
  }

  return {
    values,
    reasons,
    counts: { closesWithVisit, occurredAppointments: occurred, cancelledAppointments: cancelled, speedSample: speeds.length },
    spendApproximate: Boolean(spend?.approximate),
    spendConnected: Boolean(spend?.connected),
  };
}

/**
 * The current period beside the previous one, figure by figure:
 * { value, previous, change, reason, definition, definitionKey, kind }.
 * `change` is lib/analytics/trend.js compare() — null when either side is
 * null, so "up from nothing we measured" is never printed.
 */
export function compareMetrics(current, previous) {
  const out = {};
  for (const k of METRIC_KEYS) {
    const value = current.values[k];
    const prev = previous ? previous.values[k] : null;
    out[k] = {
      value,
      previous: prev,
      change: value === null || prev === null ? null : compare(value, prev),
      reason: current.reasons[k] || null,
      kind: DEFINITIONS[k].kind,
      definition: DEFINITIONS[k].en,
      definitionKey: DEFINITIONS[k].key,
    };
  }
  return out;
}

/**
 * The funnel: messages from ads → leads → qualified → appointments → quotes
 * sent → closes, each stage with its count and its rate from the stage
 * before.
 *
 * Monotonic by construction: after "appointments", the stages follow the
 * leads that HAD the visit — a quote sent after a visit, a close after a
 * visit — so no stage can exceed the one above it. A lead quoted or won with
 * no in-person visit took a different path; it is reported beside the funnel
 * (quotesSentWithoutVisit, closesWithoutVisit), and funnel closes + closes
 * without a visit = the metrics' closes.
 */
export function buildFunnel({ facts = [], adMessages = null } = {}) {
  const list = Array.isArray(facts) ? facts.filter(Boolean) : [];
  const n = { leads: list.length, qualified: 0, appointments: 0, quotesSent: 0, closes: 0, quotesSentWithoutVisit: 0, closesWithoutVisit: 0 };
  for (const f of list) {
    const s = stagesOf(f);
    if (s.qualified) n.qualified++;
    if (s.appointment) {
      n.appointments++;
      if (s.quoteSent) n.quotesSent++;
      if (s.won) n.closes++;
    } else {
      if (s.quoteSent) n.quotesSentWithoutVisit++;
      if (s.won) n.closesWithoutVisit++;
    }
  }
  const stages = [];
  if (adMessages) {
    stages.push({ key: "messagesFromAds", count: adMessages.threads ?? null, rateFromPrevious: null });
    stages.push({ key: "realConversations", count: adMessages.realConversations ?? null, rateFromPrevious: ratio(adMessages.realConversations, adMessages.threads, round4) });
  }
  stages.push({ key: "leads", count: n.leads, rateFromPrevious: null });
  stages.push({ key: "qualifiedLeads", count: n.qualified, rateFromPrevious: ratio(n.qualified, n.leads, round4) });
  stages.push({ key: "appointments", count: n.appointments, rateFromPrevious: ratio(n.appointments, n.qualified, round4) });
  stages.push({ key: "quotesSent", count: n.quotesSent, rateFromPrevious: ratio(n.quotesSent, n.appointments, round4) });
  stages.push({ key: "closes", count: n.closes, rateFromPrevious: ratio(n.closes, n.quotesSent, round4) });
  return { stages, quotesSentWithoutVisit: n.quotesSentWithoutVisit, closesWithoutVisit: n.closesWithoutVisit };
}

/** Facts → per-channel counts (all channels, zeros included, so a missing row is never a missing channel). */
export function splitByChannel(facts = []) {
  const rows = new Map(CHANNELS.map((c) => [c, { channel: c, leads: 0, qualifiedLeads: 0, appointments: 0, quotesSent: 0, closes: 0, revenue: 0 }]));
  for (const f of facts) {
    const r = rows.get(f.channel) || rows.get("organic");
    const s = stagesOf(f);
    r.leads++;
    if (s.qualified) r.qualifiedLeads++;
    if (s.appointment) r.appointments++;
    if (s.quoteSent) r.quotesSent++;
    if (s.won) {
      r.closes++;
      if (Number.isFinite(Number(f.wonAmount)) && f.wonAmount !== null) r.revenue = round2(r.revenue + Number(f.wonAmount));
    }
  }
  return [...rows.values()];
}

/**
 * Facts and spend by campaign → one row per campaign that had either.
 * @param spendByCampaign  Map(campaignKey → { name, platform, amount })
 */
export function splitByCampaign(facts = [], spendByCampaign = new Map(), { includeMoney = true } = {}) {
  const rows = new Map();
  const row = (key, seed) => {
    if (!rows.has(key)) rows.set(key, { campaignKey: key, campaignId: null, campaignName: null, platform: null, spend: null, leads: 0, qualifiedLeads: 0, appointments: 0, closes: 0, revenue: 0, ...seed });
    return rows.get(key);
  };
  for (const [key, s] of spendByCampaign) {
    const r = row(key, { campaignId: s.campaignId || null, campaignName: s.name || null, platform: s.platform || null });
    r.spend = round2((r.spend || 0) + (Number(s.amount) || 0));
  }
  for (const f of facts) {
    const key = campaignKeyOf(f.attribution);
    if (!key) continue;
    const r = row(key, { campaignId: f.attribution.campaignId || null, campaignName: f.attribution.campaignName || f.attribution.utmCampaign || null, platform: META_CHANNELS.includes(f.channel) ? "meta" : GOOGLE_CHANNELS.includes(f.channel) ? "google" : null });
    if (!r.campaignName) r.campaignName = f.attribution.campaignName || f.attribution.utmCampaign || null;
    const s = stagesOf(f);
    r.leads++;
    if (s.qualified) r.qualifiedLeads++;
    if (s.appointment) r.appointments++;
    if (s.won) {
      r.closes++;
      if (Number.isFinite(Number(f.wonAmount)) && f.wonAmount !== null) r.revenue = round2(r.revenue + Number(f.wonAmount));
    }
  }
  return [...rows.values()]
    .map((r) => ({
      ...r,
      revenue: includeMoney ? r.revenue : null,
      costPerLead: r.spend === null ? null : ratio(r.spend, r.leads),
      costPerClose: r.spend === null ? null : ratio(r.spend, r.closes),
      roas: !includeMoney || r.spend === null ? null : ratio(r.revenue, r.spend),
    }))
    .sort((a, b) => (b.spend || 0) - (a.spend || 0) || b.leads - a.leads);
}

/** Is this temperature "qualified"? Re-exported for the event sweep. */
export const isQualifiedTemperature = (temp) => QUALIFIED_TEMPERATURES.includes(temp);
