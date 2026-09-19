// lib/platform/costs/summary.js
//
// Everything /platform/costs prints, assembled from the ledgers that exist.
//
// ══ Four providers, four sources, and no fifth that is a guess ═══════════
//
//   Twilio    PlatformCostDaily, pulled from Usage Records by
//             lib/platform/costs/twilioUsage.js. The account's own bill.
//   OpenAI    PlatformAiUsage (FieldQuo's own spend — prospecting, transcripts,
//             scorecards) and AiUsage (the model spend FieldQuo pays for on
//             tenants' behalf — the copilot, digests, translations). Both are
//             the vendor's token counts priced by lib/ai/usage.js's table;
//             a model that table does not know is an UNPRICED row and is
//             counted as one, never summed as zero.
//   Retell    PlatformVoiceCall and VoiceCall providerCostCents — Retell's own
//             figure per call, null when it never arrived. Retell's number
//             rent is COMPUTED, not read: Retell publishes no usage or
//             billing endpoint (docs.retellai.com, list-phone-numbers carries
//             no price field; checked 2026-09-18), so the rent is the count
//             of numbers held × the list price on retellai.com/pricing —
//             US$2.00 a month per Retell number, nothing for a number
//             brought from elsewhere — prorated to the period, and printed
//             with that source.
//   Sales calls
//             lib/sales/calls/costs.js — per-call composition from the store,
//             which is what cost per conversation and cost per signup divide.
//   Google Places
//             PlatformCostDaily rows lib/sales/intel/places.js writes as each
//             Text Search request is made — list price (US$35 / 1,000, the
//             Enterprise SKU) at the moment of the call, not Google's
//             invoice. Printed as such: the first 1,000 a month are free on
//             Google's side and this ledger does not subtract them.
//
//   OpenAI, billed
//             PlatformCostDaily provider "openai" — the organisation Costs
//             endpoint's dollars per day per project and line item, pulled
//             daily by lib/platform/costs/openaiCosts.js when
//             OPENAI_ADMIN_API_KEY is set. Printed BESIDE the computed
//             figure with a reconciliation line, never in place of it.
//   Neon      PlatformCostDaily provider "neon" — consumption units per day,
//             priced at the plan's published list rate where there is one,
//             else units with no dollar (lib/platform/costs/neonConsumption.js).
//   Stripe    PlatformCostDaily provider "stripe" — what Stripe kept on
//             FieldQuo's own balance transactions, per day and reporting
//             category (lib/platform/costs/stripeFees.js).
//   Apify     PlatformCostDaily provider "apify" — each scraper run's cost as
//             Apify reported it, written by lib/sales/intel/apify.js.
//   Hand-entered
//             PlatformFixedBill — Vercel, Namecheap, Resend, Google Maps,
//             Retell's invoice, typed in by a superadmin and printed with
//             their name and the date (lib/platform/costs/fixedBills.js).
//   Charged   VoiceCreditEntry debits by kind — what the COMPANIES paid for
//             the voice minutes, rent, crew lines, texts and images, so the
//             Companies section shows margin per line.
//
// Every block carries `source` and `asOf`. The page prints both. The three
// sections the page is built from — sales floor, companies, platform — are
// assembled by lib/platform/costs/sections.js from these blocks, as a pure
// function, and their totals sum to the page total.
//
// ══ Buckets are computed in the database ═════════════════════════════════
//
// A month of PlatformAiUsage is tens of thousands of rows (the prospecting
// pipeline meters every brief). They are summed by day and area in SQL and
// re-bucketed here by week or month; nothing pages the rows into Node.

import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { agencyOf } from "@/lib/sales/agencyLabel";
import { TEST_DIAL_SQL_EXCLUSION } from "@/lib/sales/testLines";
import { CONVERSATION_MIN_CONTRACTOR_WORDS, connectFigures } from "@/lib/sales/calls/conversation";
import { COST_SOURCES, aiCostsFor, callCost, costPerConversation, periodCallCosts } from "@/lib/sales/calls/costs";
import { bucketKey, dayKey, splitTwilioSides, summariseTwilio, TWILIO_SOURCE } from "./dailyLedger";
import { lastPullsByProvider } from "./ledgerWrite";
import { OPENAI_TOTAL_CATEGORY, reconcileOpenai } from "./openaiCosts";
import { providerConfiguration } from "./providerPulls";
import { FIXED_BILL_PROVIDERS, fixedBillsForPeriod, listFixedBills } from "./fixedBills";
import { buildSections, groupOpenaiBilled } from "./sections";

const OPENAI_SOURCE = "PlatformAiUsage + AiUsage — vendor token counts × lib/ai/usage.js price table; unpriced models counted, not summed";
const RETELL_SOURCE = "PlatformVoiceCall.providerCostCents + VoiceCall.providerCostCents — Retell's per-call figure; null when it never arrived";
const SALES_SOURCE = "SalesCallAttempt (test lines excluded) composed by lib/sales/calls/costs.js";
/** Retell's published rent for a Retell-provided number — retellai.com/pricing, read 2026-09-18. */
export const RETELL_NUMBER_RENT_CENTS_PER_MONTH = 200;
const RETELL_RENT_SOURCE = "VoicePhoneNumber (active, provider retell) × US$2.00/month list price from retellai.com/pricing (read 2026-09-18), prorated to the period — Retell publishes no usage or billing endpoint, so this is the list price, not Retell's invoice";

/**
 * The number rent for a period, at list price. PURE.
 *
 * Prorated by the period's days over an average month (365.25 / 12), so a
 * week prints a week's share and a month prints a month's. Null when the
 * count is not known — never a rent for an unknown number of numbers.
 */
export function retellRent(numbersHeld, from, to) {
  const n = num(numbersHeld);
  if (n === null) return { cents: null, monthlyCents: null, statement: "The count of Retell numbers could not be read, so no rent is computed." };
  const days = Math.max(0, (to.getTime() - from.getTime()) / 86400000);
  const monthlyCents = n * RETELL_NUMBER_RENT_CENTS_PER_MONTH;
  const cents = Math.round((monthlyCents * days) / (365.25 / 12) * 10000) / 10000;
  return {
    cents,
    monthlyCents,
    days: Math.round(days * 100) / 100,
    statement: `${n} Retell number${n === 1 ? "" : "s"} held today × US$${(RETELL_NUMBER_RENT_CENTS_PER_MONTH / 100).toFixed(2)} a month (retellai.com/pricing list price; a number brought from elsewhere is free and is not counted) = US$${(monthlyCents / 100).toFixed(2)} a month, ${Math.round(days * 100) / 100} days of it in this period. Retell publishes no usage or billing endpoint, so this is the list price today, not Retell's invoice for the period.`,
  };
}
const LOCAL_SCRAPE_SOURCE = "PlatformCostDaily local_scrape — places read by scripts/scrape/maps.mjs from the owner's Mac, counted by lib/sales/intel/listings.js meterLocalScrape at $0; volume only, so the paid sources have something to be compared against";
const PLACES_SOURCE = "PlatformCostDaily google_places — each Text Search request metered at list price (US$35/1,000, Enterprise SKU) by lib/sales/intel/places.js; Google's first 1,000 a month are free and not subtracted here";
const SIGNUP_SOURCE = "SalesAttribution.capturedAt — one row per company a rep is credited with";

/** The three granularities the page offers, and the default range each implies. */
export const GRANULARITIES = Object.freeze(["day", "week", "month"]);
export const RANGES = Object.freeze(["day", "week", "month", "prevmonth", "30d", "90d", "year"]);

function num(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
const r4 = (n) => Math.round(n * 10000) / 10000;

/** UTC bounds for a named range. */
export function periodBounds({ range = "month", now = new Date() } = {}) {
  const end = now;
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const d = now.getUTCDate();
  if (range === "day") return { from: new Date(Date.UTC(y, m, d)), to: end, range, granularity: "day" };
  if (range === "week") {
    const dow = (now.getUTCDay() + 6) % 7;
    return { from: new Date(Date.UTC(y, m, d - dow)), to: end, range, granularity: "day" };
  }
  if (range === "30d") return { from: new Date(Date.UTC(y, m, d - 29)), to: end, range, granularity: "day" };
  if (range === "90d") return { from: new Date(Date.UTC(y, m, d - 89)), to: end, range, granularity: "week" };
  if (range === "year") return { from: new Date(Date.UTC(y, 0, 1)), to: end, range, granularity: "month" };
  // Last calendar month, whole — what the section headings print beside
  // this month's figure.
  if (range === "prevmonth") return { from: new Date(Date.UTC(y, m - 1, 1)), to: new Date(Date.UTC(y, m, 1) - 1), range, granularity: "day" };
  return { from: new Date(Date.UTC(y, m, 1)), to: end, range: "month", granularity: "day" };
}

function addTo(map, key, field, value) {
  if (!map.has(key)) map.set(key, {});
  const cur = map.get(key);
  cur[field] = (cur[field] || 0) + value;
}

/**
 * @param from,to     the period
 * @param granularity "day" | "week" | "month" for the buckets
 * @param client      Prisma client; the raw queries need a real one
 */
export async function platformCostSummary({ from, to, granularity = "day", client = db, now = new Date() } = {}) {
  const gran = GRANULARITIES.includes(granularity) ? granularity : "day";
  const fromKey = dayKey(from);
  const toKey = dayKey(to);
  const buckets = new Map();

  // ── Twilio ──────────────────────────────────────────────────────────────
  const [twilioRows, lastPulls] = await Promise.all([
    client.platformCostDaily.findMany({
      where: { provider: "twilio", day: { gte: from, lte: to } },
      orderBy: { day: "asc" },
    }),
    lastPullsByProvider({ client }),
  ]);
  const twilioPullAt = lastPulls.twilio || null;
  const twilioLedger = twilioRows.map((r) => ({
    ...r,
    day: dayKey(r.day),
    cents: num(r.cents),
    units: num(r.units),
  }));
  // The sales floor's own texts and numbers, for the sales/tenant split —
  // counts only, from the store; the ledger's Twilio counts are the other
  // half (lib/platform/costs/dailyLedger.js splitTwilioSides).
  const [salesSmsOut, salesSmsIn, salesNumbers, tenantNumbers] = await Promise.all([
    client.salesSmsMessage.count({ where: { direction: "out", sentAt: { gte: from, lte: to } } }).catch(() => null),
    client.salesSmsMessage.count({ where: { direction: "in", sentAt: { gte: from, lte: to } } }).catch(() => null),
    client.platformSmsNumber.count({ where: { active: true } }).catch(() => null),
    client.crewInboxNumber.count({ where: { provider: "twilio", source: { not: "shared_test" } } }).catch(() => null),
  ]);
  const twilioSummary = summariseTwilio(twilioLedger);
  const twilio = {
    ...twilioSummary,
    sides: {
      ...splitTwilioSides(twilioSummary, { salesSmsOut, salesSmsIn, salesNumbers, tenantNumbers }),
      counts: { salesSmsOut, salesSmsIn, salesNumbers, tenantNumbers },
    },
    lastPullAt: twilioPullAt,
    /** Days in the period the ledger has no row for at all — never pulled, or Twilio had nothing. */
    daysCovered: new Set(twilioLedger.map((r) => r.day)).size,
    source: TWILIO_SOURCE,
    asOf: twilioPullAt,
  };
  for (const r of twilioLedger) {
    const key = bucketKey(r.day, gran);
    if (r.category === "totalprice") addTo(buckets, key, "twilioTotalCents", r.cents);
    else addTo(buckets, key, "twilioLinesCents", r.cents);
  }

  // ── Google Places ───────────────────────────────────────────────────────
  const placesRows = await client.platformCostDaily.findMany({
    where: { provider: "google_places", day: { gte: from, lte: to } },
    orderBy: { day: "asc" },
  });
  const places = { requests: 0, cents: 0, source: PLACES_SOURCE, asOf: now };
  for (const r of placesRows) {
    places.requests += Number(r.count || 0);
    places.cents += num(r.cents) || 0;
    addTo(buckets, bucketKey(dayKey(r.day), gran), "placesCents", num(r.cents) || 0);
  }
  places.cents = r4(places.cents);

  // ── Local scrape (Google Maps from the Mac) — volume at $0 ─────────────
  const scrapeRows = await client.platformCostDaily.findMany({
    where: { provider: "local_scrape", day: { gte: from, lte: to } },
    orderBy: { day: "asc" },
  });
  const localScrape = { places: 0, cents: 0, source: LOCAL_SCRAPE_SOURCE, asOf: now };
  for (const r of scrapeRows) localScrape.places += Number(r.count || 0);

  // ── OpenAI ──────────────────────────────────────────────────────────────
  const platformAi = await client.$queryRaw`
    SELECT date_trunc('day', "createdAt") AS day, "area",
           COALESCE(SUM("costMicros"), 0)::bigint AS micros,
           COALESCE(SUM("totalTokens"), 0)::bigint AS tokens,
           COUNT(*)::int AS calls,
           COUNT(*) FILTER (WHERE "costMicros" IS NULL)::int AS unpriced
    FROM "PlatformAiUsage"
    WHERE "createdAt" >= ${from} AND "createdAt" <= ${to}
    GROUP BY 1, 2`;
  const tenantAi = await client.$queryRaw`
    SELECT date_trunc('day', "createdAt") AS day, "feature",
           COALESCE(SUM("costMicros"), 0)::bigint AS micros,
           COUNT(*)::int AS calls,
           COUNT(DISTINCT "companyId")::int AS companies
    FROM "AiUsage"
    WHERE "createdAt" >= ${from} AND "createdAt" <= ${to}
    GROUP BY 1, 2`;
  const byArea = new Map();
  let platformMicros = 0;
  let platformUnpriced = 0;
  for (const row of platformAi) {
    const micros = Number(row.micros) || 0;
    const cur = byArea.get(row.area) || { area: row.area, micros: 0, calls: 0, unpriced: 0, tokens: 0 };
    cur.micros += micros;
    cur.calls += Number(row.calls) || 0;
    cur.unpriced += Number(row.unpriced) || 0;
    cur.tokens += Number(row.tokens) || 0;
    byArea.set(row.area, cur);
    platformMicros += micros;
    platformUnpriced += Number(row.unpriced) || 0;
    addTo(buckets, bucketKey(row.day, gran), "openaiPlatformMicros", micros);
  }
  const byFeature = new Map();
  let tenantMicros = 0;
  for (const row of tenantAi) {
    const micros = Number(row.micros) || 0;
    const cur = byFeature.get(row.feature) || { feature: row.feature, micros: 0, calls: 0 };
    cur.micros += micros;
    cur.calls += Number(row.calls) || 0;
    byFeature.set(row.feature, cur);
    tenantMicros += micros;
    addTo(buckets, bucketKey(row.day, gran), "openaiTenantMicros", micros);
  }
  const tenantCompanyCount = await client
    .$queryRaw`SELECT COUNT(DISTINCT "companyId")::int AS n FROM "AiUsage" WHERE "createdAt" >= ${from} AND "createdAt" <= ${to}`
    .then((rows) => (Array.isArray(rows) && rows[0] ? Number(rows[0].n) : null))
    .catch(() => null);
  const openai = {
    platform: {
      byArea: [...byArea.values()].sort((a, b) => b.micros - a.micros),
      micros: platformMicros,
      unpricedCalls: platformUnpriced,
    },
    tenants: {
      byFeature: [...byFeature.values()].sort((a, b) => b.micros - a.micros),
      micros: tenantMicros,
      companies: tenantCompanyCount,
    },
    micros: platformMicros + tenantMicros,
    source: OPENAI_SOURCE,
    asOf: now,
  };

  // ── OpenAI, billed — the organisation Costs endpoint, beside the computed ──
  //
  // Compared over the days OpenAI has billed only, so a period whose last
  // day is not pulled yet does not read as the price table being wrong.
  const providerConfig = providerConfiguration();
  const dailyRows = await client.platformCostDaily.findMany({
    where: { provider: { in: ["openai", "neon", "stripe", "apify"] }, day: { gte: from, lte: to } },
    orderBy: { day: "asc" },
  });
  const byProvider = { openai: [], neon: [], stripe: [], apify: [] };
  for (const r of dailyRows) byProvider[r.provider]?.push({ ...r, day: dayKey(r.day), cents: num(r.cents), units: num(r.units) });
  const sumByCategory = (rows) => {
    const m = new Map();
    for (const r of rows) {
      const cur = m.get(r.category) || { category: r.category, cents: null, units: null, unit: r.unit || null, count: null, currency: r.currency || "USD", days: 0 };
      if (r.cents !== null) cur.cents = r4((cur.cents || 0) + r.cents);
      if (r.units !== null) cur.units = r4((cur.units || 0) + r.units);
      if (num(r.count) !== null) cur.count = (cur.count || 0) + num(r.count);
      cur.days += 1;
      m.set(r.category, cur);
    }
    return [...m.values()];
  };
  const openaiTotalRows = byProvider.openai.filter((r) => r.category === OPENAI_TOTAL_CATEGORY);
  const billedDays = new Set(openaiTotalRows.map((r) => r.day));
  const billedCents = openaiTotalRows.length ? r4(openaiTotalRows.reduce((s, r) => s + (r.cents || 0), 0)) : null;
  let computedOnBilledDays = null;
  if (billedDays.size) {
    computedOnBilledDays = 0;
    for (const row of platformAi) if (billedDays.has(dayKey(row.day))) computedOnBilledDays += Number(row.micros) || 0;
    for (const row of tenantAi) if (billedDays.has(dayKey(row.day))) computedOnBilledDays += Number(row.micros) || 0;
    computedOnBilledDays = r4(computedOnBilledDays / 10000);
  }
  const daysInPeriod = Math.floor((to.getTime() - from.getTime()) / 86_400_000) + 1;
  const openaiBilled = {
    configured: providerConfig.openai.configured,
    envVar: providerConfig.openai.envVar,
    lastPullAt: lastPulls.openai || null,
    asOf: lastPulls.openai || null,
    totalCents: billedCents,
    daysBilled: billedDays.size,
    daysInPeriod,
    lines: sumByCategory(byProvider.openai.filter((r) => r.category !== OPENAI_TOTAL_CATEGORY)),
    byProject: groupOpenaiBilled(sumByCategory(byProvider.openai.filter((r) => r.category !== OPENAI_TOTAL_CATEGORY))),
    reconciliation: reconcileOpenai({ computedCents: computedOnBilledDays, billedCents, daysBilled: billedDays.size, daysInPeriod }),
    source: "OpenAI organisation Costs endpoint → PlatformCostDaily provider openai (pulled daily)",
    computedCents: r4((platformMicros + tenantMicros) / 10000),
  };
  for (const r of openaiTotalRows) addTo(buckets, bucketKey(r.day, gran), "openaiBilledCents", r.cents || 0);

  // ── Neon ────────────────────────────────────────────────────────────────
  const neonLines = sumByCategory(byProvider.neon);
  const neon = {
    configured: providerConfig.neon.configured,
    envVar: providerConfig.neon.envVar,
    lastPullAt: lastPulls.neon || null,
    asOf: lastPulls.neon || null,
    lines: neonLines,
    pricedCents: neonLines.some((l) => l.cents !== null) ? r4(neonLines.reduce((s, l) => s + (l.cents || 0), 0)) : null,
    unpricedCount: neonLines.filter((l) => l.cents === null).length,
    daysCovered: new Set(byProvider.neon.map((r) => r.day)).size,
    plans: [...new Set(byProvider.neon.map((r) => (r.unit || "").split(" · ")[1]).filter(Boolean))],
    source: "Neon consumption API → PlatformCostDaily provider neon (pulled daily); dollars only at the plan's published list rate",
  };
  for (const r of byProvider.neon) if (r.cents !== null) addTo(buckets, bucketKey(r.day, gran), "neonCents", r.cents);

  // ── Stripe ──────────────────────────────────────────────────────────────
  const stripeLines = sumByCategory(byProvider.stripe);
  const stripe = {
    configured: providerConfig.stripe.configured,
    envVar: providerConfig.stripe.envVar,
    lastPullAt: lastPulls.stripe || null,
    asOf: lastPulls.stripe || null,
    lines: stripeLines,
    keptCents: stripeLines.length ? r4(stripeLines.reduce((s, l) => s + (l.cents || 0), 0)) : null,
    grossChargeCents: stripeLines.some((l) => l.category.startsWith("charge/")) ? r4(stripeLines.filter((l) => l.category.startsWith("charge/")).reduce((s, l) => s + (l.units || 0), 0)) : null,
    daysCovered: new Set(byProvider.stripe.map((r) => r.day)).size,
    source: "Stripe balance transactions on FieldQuo's own account → PlatformCostDaily provider stripe (pulled daily)",
  };
  for (const r of byProvider.stripe) if (r.cents !== null) addTo(buckets, bucketKey(r.day, gran), "stripeCents", r.cents);

  // ── Apify ───────────────────────────────────────────────────────────────
  const apify = { cents: 0, count: 0, lines: sumByCategory(byProvider.apify), source: "PlatformCostDaily apify — each run's cost as Apify reported it, written by lib/sales/intel/apify.js", asOf: now };
  for (const r of byProvider.apify) {
    apify.cents = r4(apify.cents + (r.cents || 0));
    apify.count += num(r.count) || 0;
    addTo(buckets, bucketKey(r.day, gran), "apifyCents", r.cents || 0);
  }

  // ── What the companies were charged, by kind ────────────────────────────
  const chargedRows = await client.voiceCreditEntry
    .groupBy({ by: ["kind"], where: { createdAt: { gte: from, lte: to }, cents: { lt: 0 } }, _sum: { cents: true }, _count: true })
    .catch(() => []);
  const charged = { byKind: {}, countByKind: {}, source: "VoiceCreditEntry debits (cents < 0) in the period, by kind", asOf: now };
  for (const g of chargedRows) {
    charged.byKind[g.kind] = -Number(g._sum?.cents || 0);
    charged.countByKind[g.kind] = Number(g._count || 0);
  }

  // ── Hand-entered bills ──────────────────────────────────────────────────
  const fixedBills = await listFixedBills({ from, to, client }).catch(() => []);
  const fixed = fixedBillsForPeriod(fixedBills, from, to);

  // ── Retell ──────────────────────────────────────────────────────────────
  const [platformCalls, tenantCalls, retellNumbers] = await Promise.all([
    client.platformVoiceCall.findMany({
      where: { createdAt: { gte: from, lte: to } },
      select: { createdAt: true, providerCostCents: true, durationSec: true },
    }),
    client.voiceCall.findMany({
      where: { createdAt: { gte: from, lte: to } },
      select: { createdAt: true, providerCostCents: true, durationSec: true },
    }),
    client.voicePhoneNumber.count({ where: { status: "active", provider: "retell" } }).catch(() => null),
  ]);
  const sumRetell = (rows, field) => {
    let cents = 0;
    let known = 0;
    let seconds = 0;
    for (const c of rows) {
      const v = num(c.providerCostCents);
      seconds += Number(c.durationSec) || 0;
      if (v === null) continue;
      cents += v;
      known += 1;
      addTo(buckets, bucketKey(c.createdAt, gran), field, v);
    }
    return { calls: rows.length, cents: known ? r4(cents) : null, knownOf: known, unknownCalls: rows.length - known, seconds };
  };
  const retell = {
    platform: sumRetell(platformCalls, "retellCents"),
    tenants: sumRetell(tenantCalls, "retellCents"),
    numbersHeld: retellNumbers,
    rent: retellRent(retellNumbers, from, to),
    source: RETELL_SOURCE,
    asOf: now,
  };
  retell.cents = retell.platform.cents === null && retell.tenants.cents === null ? null : r4((retell.platform.cents || 0) + (retell.tenants.cents || 0));

  // ── Sales calls, from the store ─────────────────────────────────────────
  //
  // Contractor words are counted in SQL so the transcripts stay in the
  // database; conversation.js reads the count off the row.
  const attempts = await client.$queryRaw(Prisma.sql`
    SELECT a."id", a."salesRepId", a."direction", a."dialChannel", a."dialSource", a."dialledAt", a."endedAt",
           a."answeredAt", a."talkSeconds", a."providerStatus", a."endReason", a."hungUpBy",
           a."providerCallSid", a."repCallSid", a."providerCostCents", a."recordingSid", a."recordingSeconds",
           a."transcribedAt", a."transcriptError",
           CASE WHEN a."transcript" IS NULL THEN NULL ELSE (
             SELECT COALESCE(SUM(array_length(regexp_split_to_array(trim(seg->>'text'), '\s+'), 1)), 0)::int
             FROM jsonb_array_elements(CASE WHEN jsonb_typeof(a."transcript") = 'array' THEN a."transcript" ELSE '[]'::jsonb END) seg
             WHERE seg->>'speaker' = 'contractor' AND trim(seg->>'text') <> ''
           ) END AS "contractorWords"
    FROM "SalesCallAttempt" a
    WHERE a."dialledAt" >= ${from} AND a."dialledAt" <= ${to}
      AND ${Prisma.raw(TEST_DIAL_SQL_EXCLUSION.replace(/"jurisdictionCode"/, 'a."jurisdictionCode"'))}
    ORDER BY a."dialledAt" DESC`);
  const { aiMap, qaMap } = await aiCostsFor(attempts, { client });
  const calls = periodCallCosts(attempts, aiMap, qaMap);
  const connect = connectFigures(attempts);
  const perConversation = costPerConversation({
    knownCents: calls.knownCents,
    conversations: connect.conversations,
    unknownCalls: calls.unknownCalls,
    unknownConversations: connect.unknown,
  });
  for (const a of attempts) {
    const c = callCost(a, aiMap.get(a.id), qaMap.get(a.id));
    const key = bucketKey(a.dialledAt, gran);
    addTo(buckets, key, "salesCallCents", c.knownCents);
    addTo(buckets, key, "salesCalls", 1);
    if (!c.complete) addTo(buckets, key, "salesCallsUnknown", 1);
  }
  for (const a of attempts) {
    // A second pass so the bucket's conversation count uses the same verdict
    // as the period's.
    const key = bucketKey(a.dialledAt, gran);
    const f = connectFigures([a]);
    if (f.conversations) addTo(buckets, key, "conversations", 1);
  }
  const salesCalls = {
    ...calls,
    connect: {
      measured: connect.measured,
      connected: connect.connected,
      conversations: connect.conversations,
      notConversations: connect.notConversations,
      unknown: connect.unknown,
      awaitingTranscript: connect.awaitingTranscript,
      unrecorded: connect.unrecorded,
      minContractorWords: CONVERSATION_MIN_CONTRACTOR_WORDS,
    },
    perConversation,
    partSources: COST_SOURCES,
    source: SALES_SOURCE,
    asOf: now,
  };

  // ── Signups, per rep and per agency ─────────────────────────────────────
  const [signups, reps, repAi] = await Promise.all([
    client.salesAttribution.findMany({
      where: { capturedAt: { gte: from, lte: to } },
      select: { salesRepId: true, capturedAt: true },
    }),
    client.salesRep.findMany({
      select: { id: true, name: true, engagement: true, manager: { select: { id: true, kind: true, name: true } } },
    }),
    client.platformAiUsage.groupBy({
      by: ["salesRepId"],
      where: { createdAt: { gte: from, lte: to }, salesRepId: { not: null } },
      _sum: { costMicros: true },
    }),
  ]);
  const repById = new Map(reps.map((r) => [r.id, r]));
  const perRep = new Map();
  const repRow = (id) => {
    if (!perRep.has(id)) {
      const rep = repById.get(id);
      perRep.set(id, {
        repId: id,
        name: rep?.name || "(unknown rep)",
        agency: rep ? agencyOf(rep) : null,
        signups: 0,
        calls: 0,
        callCents: 0,
        unknownCalls: 0,
        aiMicros: 0,
      });
    }
    return perRep.get(id);
  };
  for (const s of signups) {
    repRow(s.salesRepId).signups += 1;
    addTo(buckets, bucketKey(s.capturedAt, gran), "signups", 1);
  }
  for (const a of attempts) {
    if (!a.salesRepId) continue;
    const row = repRow(a.salesRepId);
    const c = callCost(a, aiMap.get(a.id), qaMap.get(a.id));
    row.calls += 1;
    row.callCents += c.knownCents;
    if (!c.complete) row.unknownCalls += 1;
  }
  for (const g of repAi) {
    if (!g.salesRepId) continue;
    repRow(g.salesRepId).aiMicros += Number(g._sum?.costMicros) || 0;
  }
  const finishRow = (row) => {
    const cents = r4(row.callCents + row.aiMicros / 10000);
    return {
      ...row,
      callCents: r4(row.callCents),
      costCents: cents,
      perSignupCents: row.signups > 0 ? r4(cents / row.signups) : null,
      isFloor: row.unknownCalls > 0,
    };
  };
  const perRepRows = [...perRep.values()].map(finishRow).sort((a, b) => b.signups - a.signups || b.costCents - a.costCents);
  const perAgency = new Map();
  for (const row of perRepRows) {
    const key = row.agency?.id || "__direct__";
    if (!perAgency.has(key)) perAgency.set(key, { agencyId: row.agency?.id || null, name: row.agency?.name || "FieldQuo's own reps and freelancers", reps: 0, signups: 0, callCents: 0, unknownCalls: 0, aiMicros: 0, calls: 0 });
    const a = perAgency.get(key);
    a.reps += 1;
    a.signups += row.signups;
    a.calls += row.calls;
    a.callCents += row.callCents;
    a.unknownCalls += row.unknownCalls;
    a.aiMicros += row.aiMicros;
  }
  const perAgencyRows = [...perAgency.values()].map(finishRow).sort((a, b) => b.signups - a.signups);

  // Overall: the sales side (calls + every platform AI row, attributed or
  // not — the prospecting pipeline exists to feed these reps) and the all-in
  // (every provider's known figure in the period).
  const salesSideCents = r4(calls.knownCents + platformMicros / 10000);
  // ── The three sections — sales floor, companies, platform ───────────────
  const split = buildSections({ twilio, openai, openaiBilled, retell, places, localScrape, apify, neon, stripe, charged, fixed, now });
  const allInCents = split.totalCents;
  const signupCount = signups.length;
  const signupsBlock = {
    count: signupCount,
    perRep: perRepRows,
    perAgency: perAgencyRows,
    salesSide: {
      cents: salesSideCents,
      perSignupCents: signupCount > 0 ? r4(salesSideCents / signupCount) : null,
      definition: "Sales calls (carrier + recording + transcription + QA) + every PlatformAiUsage row in the period",
      isFloor: calls.unknownCalls > 0 || platformUnpriced > 0,
    },
    allIn: {
      cents: allInCents,
      perSignupCents: signupCount > 0 ? r4(allInCents / signupCount) : null,
      definition: "The three sections summed — sales floor, companies, platform — everything FieldQuo paid or entered, whoever it was for",
      isFloor: !split.complete || retell.platform.unknownCalls + retell.tenants.unknownCalls > 0 || platformUnpriced > 0,
    },
    source: SIGNUP_SOURCE,
    asOf: now,
  };

  // ── Totals, as a list a page prints with sources ────────────────────────
  const totals = [
    { key: "twilio", label: "Twilio (account total)", cents: twilio.totalCents, source: twilio.source, asOf: twilio.asOf, note: twilio.totalCents === null ? "not pulled yet" : null },
    { key: "openai_platform", label: "OpenAI — FieldQuo's own", cents: r4(platformMicros / 10000), source: OPENAI_SOURCE, asOf: now, note: platformUnpriced ? `${platformUnpriced} unpriced calls not summed` : null },
    { key: "openai_tenants", label: "OpenAI — on tenants' behalf", cents: r4(tenantMicros / 10000), source: OPENAI_SOURCE, asOf: now, note: null },
    { key: "retell", label: "Retell — calls", cents: retell.cents, source: RETELL_SOURCE, asOf: now, note: retell.platform.unknownCalls + retell.tenants.unknownCalls ? `${retell.platform.unknownCalls + retell.tenants.unknownCalls} calls with no provider figure` : null },
    { key: "retell_rent", label: "Retell — number rent", cents: retell.rent.cents, source: RETELL_RENT_SOURCE, asOf: now, note: retell.rent.cents === null ? `unknown · ${retellNumbers ?? "?"} numbers held` : `${retellNumbers} numbers × US$${(RETELL_NUMBER_RENT_CENTS_PER_MONTH / 100).toFixed(2)}/month, list price, prorated` },
    { key: "google_places", label: "Google Places — prospect checks", cents: places.cents, source: PLACES_SOURCE, asOf: now, note: `${places.requests} requests at list price · first 1,000 a month free at Google` },
    { key: "local_scrape", label: "Google Maps — read from the Mac", cents: 0, source: LOCAL_SCRAPE_SOURCE, asOf: now, note: `${localScrape.places} places at $0 · the same fields Places charges $35/1,000 for` },
    { key: "apify", label: "Apify — scraper runs", cents: apify.cents, source: apify.source, asOf: now, note: `${apify.count} runs` },
    { key: "neon", label: "Neon — database", cents: neon.pricedCents, source: neon.source, asOf: neon.asOf, note: !neon.configured ? `waiting for ${neon.envVar}` : neon.unpricedCount ? `${neon.unpricedCount} metrics carry units only` : null },
    { key: "stripe", label: "Stripe — fees on FieldQuo's own revenue", cents: stripe.keptCents, source: stripe.source, asOf: stripe.asOf, note: !stripe.configured ? `waiting for ${stripe.envVar}` : stripe.grossChargeCents !== null ? `on $${(stripe.grossChargeCents / 100).toFixed(2)} gross charges` : null },
    { key: "fixed", label: "Hand-entered bills (where no API line exists)", cents: fixed.totalCents, source: "PlatformFixedBill", asOf: now, note: `${fixed.count} bills this period` },
  ];
  // The page total is the three sections' sum — a hand-entered bill that
  // reconciles an API line is not counted twice there — so the list above
  // is the per-provider view and `knownCents` is the sections' figure.
  const knownTotalCents = split.totalCents;

  // Buckets → rows, ascending.
  const bucketRows = [...buckets.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([key, v]) => ({
      key,
      twilioTotalCents: v.twilioTotalCents ?? null,
      twilioLinesCents: v.twilioLinesCents ?? null,
      openaiPlatformCents: v.openaiPlatformMicros === undefined ? null : r4(v.openaiPlatformMicros / 10000),
      openaiTenantCents: v.openaiTenantMicros === undefined ? null : r4(v.openaiTenantMicros / 10000),
      retellCents: v.retellCents === undefined ? null : r4(v.retellCents),
      placesCents: v.placesCents === undefined ? null : r4(v.placesCents),
      openaiBilledCents: v.openaiBilledCents === undefined ? null : r4(v.openaiBilledCents),
      neonCents: v.neonCents === undefined ? null : r4(v.neonCents),
      stripeCents: v.stripeCents === undefined ? null : r4(v.stripeCents),
      apifyCents: v.apifyCents === undefined ? null : r4(v.apifyCents),
      salesCalls: v.salesCalls || 0,
      salesCallCents: v.salesCallCents === undefined ? null : r4(v.salesCallCents),
      salesCallsUnknown: v.salesCallsUnknown || 0,
      conversations: v.conversations || 0,
      signups: v.signups || 0,
    }));

  return {
    period: { from, to, fromKey, toKey, granularity: gran },
    asOf: now,
    twilio,
    openai: { ...openai, billed: openaiBilled },
    retell,
    places,
    localScrape,
    apify,
    neon,
    stripe,
    charged,
    fixedBills: { rows: fixedBills, period: fixed, providers: FIXED_BILL_PROVIDERS, source: "PlatformFixedBill — hand-entered, attributed", asOf: now },
    sections: split.sections,
    reconciliations: split.reconciliations,
    providers: {
      twilio: { label: "Twilio", configured: true, lastPullAt: twilioPullAt, cadence: "hourly, three days back", kind: "api" },
      openai: { label: "OpenAI (billed)", configured: providerConfig.openai.configured, envVar: providerConfig.openai.envVar, lastPullAt: lastPulls.openai || null, cadence: "daily, three days back", kind: "api" },
      neon: { label: "Neon", configured: providerConfig.neon.configured, envVar: providerConfig.neon.envVar, lastPullAt: lastPulls.neon || null, cadence: "daily, three days back", kind: "api" },
      stripe: { label: "Stripe", configured: providerConfig.stripe.configured, envVar: providerConfig.stripe.envVar, lastPullAt: lastPulls.stripe || null, cadence: "daily, three days back", kind: "api" },
      retell: { label: "Retell", configured: true, lastPullAt: null, cadence: "per call, from Retell's webhook; rent at list price", kind: "computed" },
      apify: { label: "Apify", configured: true, lastPullAt: lastPulls.apify || null, cadence: "per run, as each finishes", kind: "api" },
    },
    salesCalls,
    signups: signupsBlock,
    totals: { lines: totals, knownCents: knownTotalCents, complete: split.complete, includesHandEntered: split.includesHandEntered },
    buckets: bucketRows,
  };
}
