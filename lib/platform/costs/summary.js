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
//             rent is NOT read from Retell (no usage API is wired) and is
//             printed as unknown with the count of numbers held.
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
// Every block carries `source` and `asOf`. The page prints both.
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
import { bucketKey, dayKey, summariseTwilio, TWILIO_SOURCE } from "./dailyLedger";
import { lastTwilioPullAt } from "./twilioUsage";

const OPENAI_SOURCE = "PlatformAiUsage + AiUsage — vendor token counts × lib/ai/usage.js price table; unpriced models counted, not summed";
const RETELL_SOURCE = "PlatformVoiceCall.providerCostCents + VoiceCall.providerCostCents — Retell's per-call figure; null when it never arrived";
const SALES_SOURCE = "SalesCallAttempt (test lines excluded) composed by lib/sales/calls/costs.js";
const PLACES_SOURCE = "PlatformCostDaily google_places — each Text Search request metered at list price (US$35/1,000, Enterprise SKU) by lib/sales/intel/places.js; Google's first 1,000 a month are free and not subtracted here";
const SIGNUP_SOURCE = "SalesAttribution.capturedAt — one row per company a rep is credited with";

/** The three granularities the page offers, and the default range each implies. */
export const GRANULARITIES = Object.freeze(["day", "week", "month"]);

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
  const [twilioRows, twilioPullAt] = await Promise.all([
    client.platformCostDaily.findMany({
      where: { provider: "twilio", day: { gte: from, lte: to } },
      orderBy: { day: "asc" },
    }),
    lastTwilioPullAt({ client }),
  ]);
  const twilioLedger = twilioRows.map((r) => ({
    ...r,
    day: dayKey(r.day),
    cents: num(r.cents),
    units: num(r.units),
  }));
  const twilio = {
    ...summariseTwilio(twilioLedger),
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

  // ── OpenAI ──────────────────────────────────────────────────────────────
  const platformAi = await client.$queryRaw`
    SELECT date_trunc('day', "createdAt") AS day, "area",
           COALESCE(SUM("costMicros"), 0)::bigint AS micros,
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
    const cur = byArea.get(row.area) || { area: row.area, micros: 0, calls: 0, unpriced: 0 };
    cur.micros += micros;
    cur.calls += Number(row.calls) || 0;
    cur.unpriced += Number(row.unpriced) || 0;
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
    client.voicePhoneNumber.count({ where: { status: "active" } }).catch(() => null),
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
    rent: { cents: null, statement: "Not read from Retell — no usage API is wired. The count of numbers held is real; what they cost is not known here." },
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
  const allInCents = r4(
    (twilio.totalCents ?? twilio.linesCents ?? 0) + (platformMicros + tenantMicros) / 10000 + (retell.cents || 0) + places.cents,
  );
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
      definition: "Twilio account total + OpenAI (platform and tenants) + Retell calls + Google Places at list price — everything FieldQuo paid these providers, whoever it was for",
      isFloor: twilio.totalCents === null || retell.platform.unknownCalls + retell.tenants.unknownCalls > 0 || platformUnpriced > 0,
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
    { key: "retell_rent", label: "Retell — number rent", cents: null, source: RETELL_SOURCE, asOf: now, note: `unknown · ${retellNumbers ?? "?"} numbers held` },
    { key: "google_places", label: "Google Places — prospect checks", cents: places.cents, source: PLACES_SOURCE, asOf: now, note: `${places.requests} requests at list price · first 1,000 a month free at Google` },
  ];
  const knownTotalCents = r4(totals.reduce((s, t) => s + (t.cents || 0), 0));

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
    openai,
    retell,
    places,
    salesCalls,
    signups: signupsBlock,
    totals: { lines: totals, knownCents: knownTotalCents, complete: totals.every((t) => t.cents !== null) },
    buckets: bucketRows,
  };
}
