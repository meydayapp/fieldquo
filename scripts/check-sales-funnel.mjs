// scripts/check-sales-funnel.mjs
//
//   npm run check:sales-funnel
//
// Executes lib/sales/funnelStages.js — the per-rep funnel, its bands, the
// ramp, and the benchmark rule — against fixture dispositions, texts,
// attributions and subscriptions. The two things that would be lies if they
// slipped are asserted by name: a benchmark figure is NEVER returned under
// the "FieldQuo's own" kind (and vice versa), and a rep's route answers about
// the session's rep only. The route is read as source for the second one,
// because it is a scoping rule and scoping rules are the kind this repo has
// had break silently.
//
// Runs under scripts/alias-loader.mjs because the module derives its reached
// codes from lib/sales/calls/dispositions.js rather than copying them.

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  STAGES, STAGE_KEYS, BANDS, RAMP_FACTORS, BENCHMARKS, BENCHMARK_LABEL, BENCHMARK_MIN_DIALS,
  REACHED_CODES, OWNER_REACHED_CODES, CONVERSATION_CODES, AGREED_CODE,
  rampFactor, bandsFor, conversionFor, stageCounts, fieldquoReferences, buildRepFunnel, funnelCsv,
  monthKeyOf, isMonthKey, monthBounds, shiftMonth, monthsBetween,
} from "../lib/sales/funnelStages.js";
import { DISPOSITIONS, DISPOSITION_ORDER, planDisposition } from "../lib/sales/calls/dispositions.js";
import { RETRY_RULES } from "../lib/sales/retryRules.js";
import { APP_MESSAGES } from "../app/i18n/appMessages.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
let passed = 0;
let failed = 0;
function ok(name, cond, extra) {
  if (cond) passed += 1;
  else {
    failed += 1;
    console.error(`  ✗ ${name}`, extra === undefined ? "" : JSON.stringify(extra));
  }
}
const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

// ── 1. The vocabulary carries the new outcome, everywhere it must ──────────
ok("agreed_link_sent is a disposition, reached, worked, no note, no callback",
  DISPOSITIONS.agreed_link_sent && DISPOSITIONS.agreed_link_sent.reached === true && DISPOSITIONS.agreed_link_sent.claim === "worked" && !DISPOSITIONS.agreed_link_sent.requiresNote && !DISPOSITIONS.agreed_link_sent.requiresCallback);
ok("…and is in the picker order, after interested", DISPOSITION_ORDER.indexOf("agreed_link_sent") === DISPOSITION_ORDER.indexOf("reached_interested") + 1);
ok("…and has a final retry rule", RETRY_RULES.agreed_link_sent?.kind === "final");
ok("…and planDisposition plans it as a permanent claim", (() => { const p = planDisposition({ code: "agreed_link_sent" }); return p.ok && p.prospect.claimExpiresAt === null && p.prospect.assignedRepId === "keep" && p.lead?.status === "contacted"; })());
for (const lang of Object.keys(APP_MESSAGES)) {
  ok(`${lang}: the picker's label and hint for agreed_link_sent are translated`,
    typeof APP_MESSAGES[lang]["app.salesCall.disposition.agreed_link_sent.label"] === "string" && typeof APP_MESSAGES[lang]["app.salesCall.disposition.agreed_link_sent.hint"] === "string");
  for (const s of STAGES) ok(`${lang}: stage ${s.key} has a label`, typeof APP_MESSAGES[lang][s.labelKey] === "string" && APP_MESSAGES[lang][s.labelKey].length > 0);
  ok(`${lang}: the benchmark sentence says it is not FieldQuo's own`, /FieldQuo/.test(APP_MESSAGES[lang]["app.salesFunnel.reference.benchmark"] || ""));
}

// ── 2. The stage sets are derived, not typed ───────────────────────────────
ok("nine stages in the owner's order", STAGE_KEYS.join() === "dials,answered,ownerReached,conversation,agreed,signupCompleted,activated,firstPayment,retained");
ok("REACHED_CODES is exactly the reached dispositions", REACHED_CODES.slice().sort().join() === Object.values(DISPOSITIONS).filter((d) => d.reached).map((d) => d.code).sort().join());
ok("owner reached is reached minus gatekeeper only", OWNER_REACHED_CODES.length === REACHED_CODES.length - 1 && !OWNER_REACHED_CODES.includes("gatekeeper"));
ok("a conversation is callback / interested / agreed / not interested — not do_not_call, not not_a_fit",
  CONVERSATION_CODES.includes("agreed_link_sent") && CONVERSATION_CODES.includes("reached_not_interested") && !CONVERSATION_CODES.includes("do_not_call") && !CONVERSATION_CODES.includes("not_a_fit") && !CONVERSATION_CODES.includes("gatekeeper"));
ok("the agreed code is the new disposition", AGREED_CODE === "agreed_link_sent");

// ── 3. Months ──────────────────────────────────────────────────────────────
ok("monthKeyOf is UTC", monthKeyOf(new Date("2026-09-30T23:59:59Z")) === "2026-09" && monthKeyOf(new Date("2026-10-01T00:00:00Z")) === "2026-10");
ok("isMonthKey is total", isMonthKey("2026-09") && !isMonthKey("2026-13") && !isMonthKey("2026-9") && !isMonthKey(null) && !isMonthKey(202609));
ok("monthBounds is [start, end)", (() => { const b = monthBounds("2026-12"); return b.start.toISOString() === "2026-12-01T00:00:00.000Z" && b.end.toISOString() === "2027-01-01T00:00:00.000Z"; })());
ok("shiftMonth rolls the year", shiftMonth("2026-01", -1) === "2025-12" && shiftMonth("2026-12", 1) === "2027-01");
ok("monthsBetween", monthsBetween("2026-07", "2026-09") === 2 && monthsBetween("2026-09", "2026-07") === -2 && monthsBetween("bad", "2026-07") === null);

// ── 4. Ramp: ×0.5, ×0.75, ×1 by month since start ──────────────────────────
const rep = { id: "r1", name: "Daniel", code: "dan", startedAt: "2026-08-10T00:00:00Z" };
ok("start month ×0.5", rampFactor(rep, "2026-08").factor === 0.5 && rampFactor(rep, "2026-08").tenureMonth === 1);
ok("second month ×0.75", rampFactor(rep, "2026-09").factor === 0.75 && !rampFactor(rep, "2026-09").ramped);
ok("third month ×1, ramped", rampFactor(rep, "2026-10").factor === 1 && rampFactor(rep, "2026-10").ramped && rampFactor(rep, "2026-10").tenureMonth === 3);
ok("a year later still ×1", rampFactor(rep, "2027-08").factor === 1);
ok("a month before the start is ramped, not ×0", rampFactor(rep, "2026-07").factor === 1);
ok("no dates at all is ramped (absence is not a statement)", rampFactor({}, "2026-09").factor === 1 && rampFactor({}, "2026-09").tenureMonth === null);
ok("acceptedAt stands in for a missing startedAt, invitedAt for a missing acceptedAt",
  rampFactor({ acceptedAt: "2026-09-01T00:00:00Z" }, "2026-09").factor === 0.5 && rampFactor({ invitedAt: "2026-08-01T00:00:00Z" }, "2026-09").factor === 0.75);
ok("RAMP_FACTORS are the owner's", RAMP_FACTORS.join() === "0.5,0.75,1");

// ── 5. Bands: 10/15/20 and 12/18/24, scaled by the ramp, rounded UP ────────
ok("card trials 10/15/20; agreed 12/18/24", BANDS.signupCompleted.minimum === 10 && BANDS.signupCompleted.target === 15 && BANDS.signupCompleted.strong === 20 && BANDS.agreed.minimum === 12 && BANDS.agreed.target === 18 && BANDS.agreed.strong === 24);
ok("ramped bands are the base", (() => { const b = bandsFor("signupCompleted", 1, 0); return b.bands.minimum === 10 && b.bands.target === 15 && b.bands.strong === 20; })());
ok("half-ramp: 5/8/10 — 7.5 rounds UP to 8", (() => { const b = bandsFor("signupCompleted", 0.5, 7); return b.bands.minimum === 5 && b.bands.target === 8 && b.bands.strong === 10 && b.reached === "minimum" && b.remainingToTarget === 1; })());
ok("×0.75 agreed: 9/14/18 (13.5 → 14)", (() => { const b = bandsFor("agreed", 0.75, 14); return b.bands.minimum === 9 && b.bands.target === 14 && b.bands.strong === 18 && b.reached === "target"; })());
ok("a count at the strong band reaches strong", bandsFor("agreed", 1, 24).reached === "strong" && bandsFor("agreed", 1, 30).reached === "strong");
ok("a count under minimum reaches nothing", bandsFor("agreed", 1, 11).reached === null && bandsFor("agreed", 1, 11).remainingToTarget === 7);
ok("a stage with no band gets null", bandsFor("dials", 1, 100) === null);
ok("a bad factor or count is treated as 1 / 0, not NaN", bandsFor("agreed", NaN, "x").bands.target === 18 && bandsFor("agreed", NaN, "x").count === 0);

// ── 6. The benchmark rule ──────────────────────────────────────────────────
ok("Belkins 9.9% / 58% / 4.6%; First Page Sage 48.8%", near(BENCHMARKS.answered.value, 0.099) && near(BENCHMARKS.conversation.value, 0.58) && near(BENCHMARKS.agreed.value, 0.046) && near(BENCHMARKS.firstPayment.value, 0.488));
ok("stages with no published figure carry null, not a guess", BENCHMARKS.ownerReached === null && BENCHMARKS.signupCompleted === null && BENCHMARKS.activated === null && BENCHMARKS.retained === null);
ok("the benchmark label says it is not FieldQuo's own", /not FieldQuo's own/.test(BENCHMARK_LABEL));
ok("200 dials is the line", BENCHMARK_MIN_DIALS === 200);
{
  const own = { value: 0.2, sampleDials: 1500 };
  const under = conversionFor("answered", 10, 100, { fieldquo: own, dials: 199 });
  const over = conversionFor("answered", 40, 200, { fieldquo: own, dials: 200 });
  ok("under 200 dials: the reference is the benchmark, labelled as such", under.reference.kind === "benchmark" && near(under.reference.value, 0.099) && under.reference.label === BENCHMARK_LABEL && under.benchmarkUntilDials === 200);
  ok("at 200 dials: FieldQuo's own figure with the sample", over.reference.kind === "fieldquo" && near(over.reference.value, 0.2) && /1500 dials/.test(over.reference.label) && over.reference.sampleDials === 1500);
  ok("a benchmark value is never returned under the fieldquo kind", !(under.reference.kind === "fieldquo") && !(over.reference.kind === "benchmark" && near(over.reference.value, 0.2)));
  ok("at 200 dials with NO FieldQuo figure, the benchmark stands (still labelled)", conversionFor("answered", 1, 200, { fieldquo: null, dials: 200 }).reference.kind === "benchmark");
  ok("a stage with no published figure and no own figure has no reference", conversionFor("ownerReached", 1, 2, { dials: 10 }).reference === null);
  ok("0 of 0 has no rate, not 0%", conversionFor("answered", 0, 0, {}).value === null);
  ok("the ratio is hit ÷ of", near(conversionFor("answered", 3, 12, {}).value, 0.25));
}

// ── 7. stageCounts against fixture rows ────────────────────────────────────
const M = "2026-09";
const at = (d, h = 12) => `2026-09-${String(d).padStart(2, "0")}T${String(h).padStart(2, "0")}:00:00Z`;
const attempts = [
  // 12 dials on the month, one of them inbound (excluded), one in October (excluded)
  { direction: "out", dialledAt: at(1), disposition: "no_answer", prospectId: "p1", toE164: "+1" },
  { direction: "out", dialledAt: at(1, 13), disposition: "busy", prospectId: "p1", toE164: "+1" },
  { direction: "out", dialledAt: at(2), disposition: "voicemail", prospectId: "p2", toE164: "+2" },
  { direction: "out", dialledAt: at(2, 14), disposition: "gatekeeper", prospectId: "p3", toE164: "+3" },
  { direction: "out", dialledAt: at(3), disposition: "callback", leadId: "l4", prospectId: "p4", toE164: "+4" },
  { direction: "out", dialledAt: at(4), disposition: "reached_interested", leadId: "l5", toE164: "+5" },
  { direction: "out", dialledAt: at(5), disposition: "agreed_link_sent", leadId: "l6", toE164: "+6" },
  { direction: "out", dialledAt: at(5, 15), disposition: "agreed_link_sent", leadId: "l6", toE164: "+6" }, // same business twice
  { direction: "out", dialledAt: at(6), disposition: "reached_not_interested", prospectId: "p7", toE164: "+7" },
  { direction: "out", dialledAt: at(7), disposition: "do_not_call", prospectId: "p8", toE164: "+8" },
  { direction: "out", dialledAt: at(8), disposition: "not_a_fit", prospectId: "p9", toE164: "+9" },
  { direction: "out", dialledAt: at(9), disposition: null, prospectId: "p10", toE164: "+10" }, // open
  { direction: "in", dialledAt: at(9), disposition: "reached_interested", prospectId: "p11", toE164: "+11" }, // inbound: not a dial
  { direction: "out", dialledAt: "2026-10-01T00:00:00Z", disposition: "agreed_link_sent", leadId: "l12", toE164: "+12" }, // next month
  { direction: "out", dialledAt: "not a date", disposition: "agreed_link_sent", leadId: "l13", toE164: "+13" }, // broken row
];
const linkSends = [
  { leadId: "l6", sentAt: at(5, 16) }, // same business as the agreed disposition — not double counted
  { leadId: "l5", sentAt: at(4, 13) }, // interested on the call, link texted after — agreed
  { leadId: "l14", sentAt: at(10) },   // link texted with no call at all — agreed
  { leadId: "l15", sentAt: "2026-08-31T23:59:59Z" }, // last month
  { leadId: null, sentAt: at(11) },    // no lead: nothing to key on
];
const attributions = [
  { companyId: "c1", capturedAt: at(12) }, // completed, activated, paid, retained
  { companyId: "c2", capturedAt: at(13) }, // completed, activated, paid, not retained
  { companyId: "c3", capturedAt: at(14) }, // completed, not activated
  { companyId: "c4", capturedAt: at(15) }, // abandoned — no subscription
  { companyId: "c4", capturedAt: at(15) }, // duplicate row: one company
  { companyId: "c5", capturedAt: at(16) }, // demo: excluded
  { companyId: "c6", capturedAt: "2026-08-20T00:00:00Z" }, // last month
  { companyId: "c7", capturedAt: at(17) }, // completed, activated, NOT paid (still trialing) — but somehow retained id passed: must not count
];
const companies = [
  { id: "c1", stripeChargesEnabled: true }, { id: "c2", stripeChargesEnabled: true }, { id: "c3", stripeChargesEnabled: false },
  { id: "c4", stripeChargesEnabled: true }, { id: "c5", stripeChargesEnabled: true, isDemo: true }, { id: "c6", stripeChargesEnabled: true },
  { id: "c7", stripeChargesEnabled: true },
];
const subscriptions = [
  { companyId: "c1", billingStartedAt: at(20) }, { companyId: "c2", billingStartedAt: at(21) }, { companyId: "c3", billingStartedAt: null },
  { companyId: "c5", billingStartedAt: at(20) }, { companyId: "c6", billingStartedAt: at(20) }, { companyId: "c7", billingStartedAt: null },
];
const counts = stageCounts({ attempts, linkSends, attributions, companies, subscriptions, retainedCompanyIds: ["c1", "c7", "c6"], monthKey: M });
ok("dials: 12 outbound in the month (inbound, next month and a broken date excluded)", counts.counts.dials === 12, counts.counts);
ok("answered: 8 (gatekeeper, callback, interested, agreed ×2, not interested, dnc, not a fit)", counts.counts.answered === 8, counts.counts);
ok("owner reached: 7 (answered minus gatekeeper)", counts.counts.ownerReached === 7, counts.counts);
ok("conversation: 5 (callback, interested, agreed ×2, not interested)", counts.counts.conversation === 5, counts.counts);
ok("agreed: 3 distinct businesses (l6 once despite two dispositions and a text, l5 by text, l14 by text)", counts.counts.agreed === 3, counts.counts);
ok("signup completed with card: 4 (c1 c2 c3 c7; c4 abandoned, c5 demo, c6 last month, duplicate c4 once)", counts.counts.signupCompleted === 4, counts.counts);
ok("abandoned signups named beside the stage: 1", counts.abandonedSignups === 1);
ok("activated: 3 (c3 has no charges)", counts.counts.activated === 3, counts.counts);
ok("first payment: 2 (c7 still trialing)", counts.counts.firstPayment === 2, counts.counts);
ok("retained: 1 — c7 cannot be retained without a first payment, c6 is last month", counts.counts.retained === 1, counts.counts);
ok("the stages never increase down the funnel", (() => { const c = counts.counts; for (let i = 1; i < STAGE_KEYS.length; i += 1) if (c[STAGE_KEYS[i]] > c[STAGE_KEYS[i - 1]] && STAGES[i].unit === STAGES[i - 1].unit) return false; return true; })());
ok("dispositioned counts the rows with an outcome: 11", counts.dispositioned === 11);
ok("a bad month key throws rather than counting everything", (() => { try { stageCounts({ monthKey: "2026-9" }); return false; } catch (e) { return /YYYY-MM/.test(e.message); } })());
ok("no rows at all is all zeros, not a crash", (() => { const c = stageCounts({ monthKey: M }); return Object.values(c.counts).every((v) => v === 0) && c.abandonedSignups === 0; })());

// ── 8. FieldQuo's own references over every rep ────────────────────────────
const other = stageCounts({
  attempts: Array.from({ length: 300 }, (_, i) => ({ direction: "out", dialledAt: at(1 + (i % 28)), disposition: i % 10 === 0 ? "reached_interested" : "no_answer", prospectId: `q${i}`, toE164: `+q${i}` })),
  monthKey: M,
});
const refs = fieldquoReferences([counts, other]);
ok("answered reference is (8 + 30) ÷ (12 + 300) over 312 dials", near(refs.answered.value, 38 / 312) && refs.answered.sampleDials === 312, refs.answered);
ok("a step with a zero denominator across the floor is null", fieldquoReferences([stageCounts({ monthKey: M })]).answered === null);

// ── 9. buildRepFunnel: the rep under 200 dials sees benchmarks, the rep over sees FieldQuo's ──
const f1 = buildRepFunnel({ rep: { ...rep, active: true }, counts, monthKey: M, references: refs });
ok("nine stages with counts", f1.stages.length === 9 && f1.stages[0].count === 12 && f1.stages[4].count === 3);
ok("dials has no conversion; every later stage does", f1.stages[0].conversion === null && f1.stages.slice(1).every((s) => s.conversion));
ok("this rep (12 dials) is shown the BENCHMARK for answered, with the label", f1.stages[1].conversion.reference.kind === "benchmark" && f1.stages[1].conversion.reference.label === BENCHMARK_LABEL && !f1.benchmark.usingOwn);
ok("…and no FieldQuo figure leaks in under 200 dials", f1.stages.every((s) => !s.conversion || !s.conversion.reference || s.conversion.reference.kind !== "fieldquo"));
ok("the ramp for 2026-09 is ×0.75 and the bands follow", f1.ramp.factor === 0.75 && f1.quotas.signupCompleted.bands.target === 12 && f1.quotas.agreed.bands.target === 14);
ok("the quota counts are the stage counts", f1.quotas.signupCompleted.count === 4 && f1.quotas.agreed.count === 3);
const f2 = buildRepFunnel({ rep: { id: "r2", name: "Rachel" }, counts: other, monthKey: M, references: refs });
ok("the rep with 300 dials is shown FieldQuo's own figure, labelled with the sample", f2.stages[1].conversion.reference.kind === "fieldquo" && /312 dials/.test(f2.stages[1].conversion.reference.label) && f2.benchmark.usingOwn);
ok("…and never the benchmark label on a FieldQuo number", f2.stages.every((s) => !s.conversion?.reference || s.conversion.reference.kind !== "fieldquo" || s.conversion.reference.label !== BENCHMARK_LABEL));
{
  // References measured from a floor with dials but no signups: the signup
  // steps have no FieldQuo figure. Over 200 dials, a step with a published
  // benchmark falls back to it (labelled), and one without has no reference.
  const f3 = buildRepFunnel({ rep: { id: "r3", name: "Solo" }, counts: other, monthKey: M, references: fieldquoReferences([other]) });
  ok("ownerReached at 300 dials has FieldQuo's own figure", f3.stages.find((s) => s.key === "ownerReached").conversion.reference?.kind === "fieldquo");
  ok("signupCompleted with no own figure and no published one prints nothing", f3.stages.find((s) => s.key === "signupCompleted").conversion.reference === null);
  ok("firstPayment with no own figure falls back to the labelled benchmark even past 200 dials", f3.stages.find((s) => s.key === "firstPayment").conversion.reference?.kind === "benchmark");
}

// ── 10. CSV ────────────────────────────────────────────────────────────────
const csv = funnelCsv([f1, f2]);
const rows = csv.trim().split("\r\n");
ok("a header and 9 rows per rep", rows.length === 1 + 18 && rows[0].startsWith("month,rep,rep_code,stage,unit,count"));
ok("the reference KIND is a column, so a spreadsheet cannot mistake a benchmark for a measurement", rows[2].includes(",benchmark,") && rows[11].includes(",fieldquo,"));
ok("quotes are RFC 4180", funnelCsv([{ ...f1, rep: { ...f1.rep, name: 'Da "Man", Jr' } }]).includes('"Da ""Man"", Jr"'));
ok("the benchmark label never appears on a fieldquo row", rows.every((r) => !(r.includes(",fieldquo,") && r.includes(BENCHMARK_LABEL))));

// ── 11. A rep sees their own card only ─────────────────────────────────────
{
  const route = read("app/api/sales/funnel/route.js");
  ok("the rep route scopes on the session's rep id", /repIds:\s*\[rep\.id\]/.test(route) && /requireSalesRep/.test(route));
  ok("…and never reads a rep id from the query", !/searchParams\.get\("rep"\)/.test(route));
  ok("…and returns the one funnel that is theirs", /funnels\.find\(\(f\) => f\.rep\?\.id === rep\.id\)/.test(route));
  const platform = read("app/api/platform/sales/funnel/route.js");
  ok("the platform route admits superadmin and admin only", /new Set\(\["superadmin", "admin"\]\)/.test(platform) && !/support/.test(platform.split("const READERS")[1].split("\n")[0]));
  const loader = read("lib/sales/funnelData.js");
  ok("the loader decides retention with the sweep's own predicate", /qualifiesForRetention\(/.test(loader) && /subscriptionStartedAt: s\.createdAt/.test(loader));
  const sms = read("app/api/sales/sms/route.js");
  ok("the signup-link send writes the agreed outcome", /markAgreedOnCall\(/.test(sms));
  const view = read("app/components/sales/FunnelView.js");
  ok("the shared view prints the module's reference label and composes none of its own", /ref\.label/.test(view) && !/not FieldQuo/.test(view));
}

console.log(`\ncheck-sales-funnel: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
