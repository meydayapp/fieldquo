// docs/screens/platform-mobile/harness/fixtures/costs.snapshot.gen.mjs
//
// Writes costs.snapshot.json — what GET /api/platform/costs answers for
// "This month" and "Last month" — by running the SHIPPED platformCostSummary
// (lib/platform/costs/summary.js) over a scripted fake client, in Node.
//
//   node --import ./scripts/alias-loader.mjs docs/screens/platform-mobile/harness/fixtures/costs.snapshot.gen.mjs
//
// Why a snapshot and not a live call from the fixture: the summary's module
// reaches the OpenAI and Stripe clients (through lib/ai/provider.js and
// providerPulls.js), which the browser bundle cannot hold. Why not a
// hand-typed payload: it is some forty nested fields deep, and the page
// reads most of them — a hand-typed copy is the one that drifts. Re-run this
// when the summary's shape changes; the page then renders what the route
// would send from these rows.
//
// No database is touched: every model the summary reads is answered below
// (an unscripted $queryRaw throws, so a new read fails here by name). The
// clock is pinned to 2026-09-25 15:00 UTC.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { platformCostSummary, periodBounds, RANGES } from "@/lib/platform/costs/summary";

const now = new Date("2026-09-25T15:00:00.000Z");
const DAY = 86400000;
const HOUR = 3600000;

async function snapshot(range) {
  const bounds = periodBounds({ range, now });

  const days = [];
  for (let t = bounds.from.getTime(); t <= Math.min(bounds.to.getTime(), now.getTime()); t += DAY) days.push(new Date(t));

  const fetchedAt = new Date(now.getTime() - 2 * HOUR);
  const ledger = [];
  days.forEach((d, i) => {
    const w = 1 + (i % 7 < 5 ? 1 : 0.3);
    const row = (provider, category, cents, extra = {}) => ledger.push({ provider, category, day: d, cents, units: null, count: null, unit: null, currency: "USD", fetchedAt, ...extra });
    row("twilio", "calls-outbound", 412 * w, { units: 31 * w, unit: "minutes", count: 58 * w });
    row("twilio", "calls-inbound", 38 * w, { units: 4 * w, unit: "minutes", count: 6 * w });
    row("twilio", "calls-client", 91 * w, { units: 29 * w, unit: "minutes", count: 51 * w });
    row("twilio", "recordings", 77 * w, { units: 30 * w, unit: "minutes" });
    row("twilio", "phonenumbers", 38.7, { count: 14 });
    row("twilio", "sms-outbound", 158 * w, { count: 190 * w });
    row("twilio", "sms-inbound", 21 * w, { count: 26 * w });
    row("twilio", "totalprice", (412 + 38 + 91 + 77 + 158 + 21) * w + 38.7 + 12);
    row("openai", "total", 1840 * w);
    row("openai", "project/proj_app · gpt-5-mini", 1210 * w);
    row("openai", "project/proj_sales · gpt-5-mini", 480 * w);
    row("openai", "project/proj_sales · whisper-1", 150 * w);
    row("neon", "compute_time", 96, { units: 14.2, unit: "CU-hours · launch" });
    row("neon", "data_storage", null, { units: 3.1, unit: "GB-month · launch" });
    row("stripe", "fee/stripe_fee", -(310 * w), { units: 10_300 * w });
    row("stripe", "charge/charge", 0, { units: 10_300 * w });
    if (i % 3 === 0) row("apify", "google-maps-scraper", 240, { count: 1 });
    if (i % 2 === 0) ledger.push({ provider: "local_scrape", category: "places", day: d, cents: 0, count: 420, fetchedAt });
  });

  const rep = (id, name, engagement = "employee", manager = null) => ({ id, name, engagement, manager });
  const REPS = [
    rep("rep_dan", "Daniel Ortega"),
    rep("rep_ann", "Ann Tremblay", "agency", { id: "ag_1", kind: "agency", name: "Northline Contact" }),
    rep("rep_raj", "Raj Patel", "freelancer"),
    rep("ag_1", "Northline Contact", null),
  ];

  const attempts = [];
  days.forEach((d, i) => {
    for (let k = 0; k < (i % 7 < 5 ? 9 : 2); k++) {
      const r = REPS[k % 3];
      const at = new Date(d.getTime() + (14 + k * 0.4) * HOUR);
      const answered = k % 3 !== 0;
      attempts.push({
        id: `att_${i}_${k}`,
        salesRepId: r.id,
        direction: "out",
        dialChannel: k % 4 === 0 ? "handset" : "browser",
        dialSource: "queue",
        dialledAt: at,
        endedAt: new Date(at.getTime() + (answered ? 140 : 25) * 1000),
        answeredAt: answered ? new Date(at.getTime() + 12000) : null,
        talkSeconds: answered ? 20 + ((k * 53) % 300) : 0,
        providerStatus: answered ? "completed" : "no-answer",
        endReason: null,
        hungUpBy: null,
        providerCallSid: `CA${i}${k}`,
        repCallSid: k % 4 === 0 ? null : `CArep${i}${k}`,
        providerCostCents: k % 5 === 0 ? null : answered ? 3.4 : 0.7,
        recordingSid: answered ? `RE${i}${k}` : null,
        recordingSeconds: answered ? 20 + ((k * 53) % 300) : null,
        transcribedAt: answered && k % 2 === 0 ? at : null,
        transcriptError: null,
        contractorWords: answered ? (k * 17) % 90 : null,
      });
    }
  });

  const sqlText = (q) => (Array.isArray(q) ? q.join("?") : q?.strings ? q.strings.join("?") : q?.sql || String(q));
  const client = {
    platformCostDaily: {
      findMany: async ({ where }) => {
        const p = where.provider;
        const ok = (row) => (typeof p === "string" ? row.provider === p : p?.in ? p.in.includes(row.provider) : true);
        return ledger.filter((r) => ok(r) && r.day >= where.day.gte && r.day <= where.day.lte);
      },
      groupBy: async () => ["twilio", "openai", "neon", "stripe", "apify"].map((provider) => ({ provider, _max: { fetchedAt } })),
    },
    salesSmsMessage: { count: async ({ where }) => (where.direction === "out" ? 412 : 57) },
    platformSmsNumber: { count: async () => 4 },
    crewInboxNumber: { count: async () => 9 },
    voicePhoneNumber: { count: async () => 6 },
    voiceCreditEntry: {
      groupBy: async () => [
        { kind: "voice_call", _sum: { cents: -18_450 }, _count: 311 },
        { kind: "sms", _sum: { cents: -2_210 }, _count: 1_105 },
        { kind: "ai_employee_reply", _sum: { cents: -386 }, _count: 624 },
      ],
    },
    platformFixedBill: {
      findMany: async () => [
        { id: "fb_1", provider: "vercel", periodMonth: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)), amountCents: 2000, currency: "USD", invoiceRef: "INV-VC-0925", note: "Pro plan", enteredById: "adm1", enteredBy: { id: "adm1", email: "emilio@fieldquo.com" }, enteredAt: new Date(now.getTime() - 3 * DAY), updatedAt: new Date(now.getTime() - 3 * DAY), voidedAt: null },
        { id: "fb_2", provider: "resend", periodMonth: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)), amountCents: 2000, currency: "USD", invoiceRef: null, note: null, enteredById: "adm1", enteredBy: { id: "adm1", email: "emilio@fieldquo.com" }, enteredAt: new Date(now.getTime() - 2 * DAY), updatedAt: new Date(now.getTime() - 2 * DAY), voidedAt: null },
      ],
    },
    platformVoiceCall: { findMany: async () => days.slice(0, 6).map((d, i) => ({ createdAt: d, providerCostCents: i === 3 ? null : 41 + i, durationSec: 190 + i * 11 })) },
    voiceCall: { findMany: async () => days.map((d, i) => ({ createdAt: d, providerCostCents: 55 + (i % 5) * 9, durationSec: 240 + i * 7 })) },
    salesAttribution: { findMany: async () => days.filter((_, i) => i % 4 === 1).map((d, i) => ({ salesRepId: REPS[i % 3].id, capturedAt: d })) },
    salesRep: { findMany: async () => REPS },
    platformAiUsage: {
      groupBy: async () => [{ salesRepId: "rep_dan", _sum: { costMicros: 412_000 } }, { salesRepId: "rep_ann", _sum: { costMicros: 208_000 } }],
      findMany: async () => [],
    },
    salesCallQa: { findMany: async () => [] },
    $queryRaw: async (q) => {
      const s = sqlText(q);
      if (/FROM "SalesCallAttempt"/.test(s)) return attempts;
      if (/COUNT\(DISTINCT "companyId"\)::int AS n/.test(s)) return [{ n: 7 }];
      if (/FROM "PlatformAiUsage"/.test(s)) {
        return days.flatMap((d) => [
          { day: d, area: "sales_call_transcript", micros: 180_000n, tokens: 0n, calls: 6, unpriced: 0 },
          { day: d, area: "sales_call_qa", micros: 95_000n, tokens: 41_000n, calls: 5, unpriced: 0 },
          { day: d, area: "prospect_research", micros: 260_000n, tokens: 120_000n, calls: 30, unpriced: 1 },
        ]);
      }
      if (/FROM "AiUsage"/.test(s)) {
        return days.flatMap((d) => [
          { day: d, feature: "copilot", model: "gpt-5-mini", micros: 610_000n, calls: 44, companies: 5 },
          { day: d, feature: "quote_review", model: "gpt-5-mini", micros: 330_000n, calls: 21, companies: 4 },
          { day: d, feature: "ai_employee_reply", model: "gpt-5", micros: 420_000n, calls: 18, companies: 2 },
        ]);
      }
      throw new Error("unscripted $queryRaw: " + s.slice(0, 120));
    },
  };

  const summary = await platformCostSummary({ from: bounds.from, to: bounds.to, granularity: bounds.granularity, client, now });
  // The route's `sampling` line (outcome settings at their defaults, AMD off).
  const sampling = { transcriptionPercent: 100, aiReviewPercent: 100, amdEnabled: false, amdUsdPerCall: 0.0075 };
  return { ...summary, sampling, range, ranges: RANGES };
}

const out = { generatedAt: now.toISOString(), month: await snapshot("month"), prevmonth: await snapshot("prevmonth") };
const file = path.join(path.dirname(fileURLToPath(import.meta.url)), "costs.snapshot.json");
fs.writeFileSync(file, JSON.stringify(out, (k, v) => (typeof v === "bigint" ? Number(v) : v)));
console.log(`wrote ${file}`);
