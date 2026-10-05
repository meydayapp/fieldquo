// scripts/check-marketing-metrics.mjs
//
//   npm run check:marketing-metrics
//
// The agency dashboard's arithmetic (lib/agency/metrics.js), executed against
// a fixture month and the month before it — CPL, cost per appointment, close
// rate, the ADJUSTED close rate with upcoming visits left out, ROAS, average
// job size, the conversion-timing medians — and then the same numbers through
// the real loader (lib/agency/metricsData.js + leadFacts.js) over an
// in-memory store, so the joins that decide "which appointment is this
// lead's" are executed, not assumed:
//
//   * an appointment is counted ONCE per lead, however many the client has;
//   * a visit booked before the lead, a video call, and the job's own visit
//     after the win are not the sales appointment;
//   * a won quote with no visit is a close, reported apart;
//   * every funnel stage is <= the one before it (monotonic per lead).
//
// Periods: lib/agency/periods.js, today through custom, and the previous
// EQUAL period. Ends with a mutation pass (cp backups only).

import { readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MUTANT = process.env.FQ_MUTANT === "1";

const { computeMetrics, compareMetrics, buildFunnel, median, DEFINITIONS, METRIC_KEYS, splitByChannel } = await import("@/lib/agency/metrics");
const { resolvePeriod, previousPeriod, PERIOD_KEYS } = await import("@/lib/agency/periods");
const { loadMarketingResults, parseFilters } = await import("@/lib/agency/metricsData");
const { fakeDb } = await import("./fixtures/memoryPrisma.mjs");

let pass = 0;
const fails = [];
const ok = (name, cond, got) => {
  if (cond) {
    pass++;
    if (!MUTANT) console.log(`  ✓ ${name}`);
  } else {
    fails.push(`${name}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`);
    if (!MUTANT) console.log(`  ✗ ${name}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`);
  }
};
const near = (a, b, eps = 0.005) => a !== null && b !== null && Math.abs(a - b) < eps;
const d = (s) => new Date(s);
const NOW = d("2026-10-05T15:00:00Z");

// ── 1. Periods ──────────────────────────────────────────────────────────────
if (!MUTANT) console.log("\nPeriods and the previous equal period");
{
  const r = (period, extra = {}) => resolvePeriod({ period, now: NOW, ...extra });
  ok("today is one day", r("today").days === 1 && r("today").fromDay === "2026-10-05");
  ok("yesterday is 4 October", r("yesterday").fromDay === "2026-10-04" && r("yesterday").toDay === "2026-10-04");
  ok("this week starts Monday 5 October", r("thisWeek").fromDay === "2026-10-05");
  ok("last week is 28 Sep – 4 Oct", r("lastWeek").fromDay === "2026-09-28" && r("lastWeek").toDay === "2026-10-04", r("lastWeek"));
  ok("this month runs to today, not month end", r("thisMonth").toDay === "2026-10-05" && r("thisMonth").days === 5);
  ok("last month is all of September", r("lastMonth").fromDay === "2026-09-01" && r("lastMonth").toDay === "2026-09-30");
  ok("last quarter is Q3", r("lastQuarter").fromDay === "2026-07-01" && r("lastQuarter").toDay === "2026-09-30");
  ok("this year from 1 Jan", r("thisYear").fromDay === "2026-01-01");
  ok("last year is 2025", r("lastYear").fromDay === "2025-01-01" && r("lastYear").toDay === "2025-12-31");
  const prev = previousPeriod(r("thisMonth"));
  ok("this month (5 days) is compared with the 5 days before", prev.fromDay === "2026-09-26" && prev.toDay === "2026-09-30", prev);
  const prevSep = previousPeriod(r("lastMonth"));
  ok("September (30 days) is compared with the 30 days before", prevSep.fromDay === "2026-08-02" && prevSep.toDay === "2026-08-31", prevSep);
  ok("custom needs both ends", !r("custom", { from: "2026-09-01" }).ok);
  ok("custom refuses a backwards range", !r("custom", { from: "2026-09-30", to: "2026-09-01" }).ok);
  ok("custom refuses a non-date", !r("custom", { from: "2026-02-30", to: "2026-03-01" }).ok);
  ok("an unknown period is refused, not defaulted", !r("fortnight").ok);
  ok("every key resolves", PERIOD_KEYS.filter((k) => k !== "custom").every((k) => r(k).ok));
}

// ── 2. The arithmetic, on a fixture month ──────────────────────────────────
if (!MUTANT) console.log("\nA fixture September against the August before it");
function fact(i, over = {}) {
  return {
    id: `l${i}`,
    ref: `lr_${String(i).padStart(16, "0")}`,
    createdAt: d("2026-09-02T10:00:00Z"),
    status: "new",
    channel: "facebook_ad",
    temperature: "cold",
    attribution: {},
    appointment: null,
    quote: null,
    won: false,
    ...over,
  };
}
const appt = (id, scheduledAt, status = "scheduled") => ({ id, bookedAt: d("2026-09-03T10:00:00Z"), scheduledAt: d(scheduledAt), status, type: "estimate" });
const sept = [
  // 1–2: held visits that closed, with sent quotes
  fact(1, { temperature: "hot", appointment: appt("a1", "2026-09-06T10:00:00Z", "completed"), quote: { id: "q1", sentAt: d("2026-09-08T10:00:00Z"), status: "accepted", amount: 5000 }, won: true, wonAt: d("2026-09-12T10:00:00Z"), wonAmount: 5000, collectedAmount: 2500, firstContactAt: d("2026-09-02T10:00:00Z"), firstResponseAt: d("2026-09-02T10:04:00Z") }),
  fact(2, { temperature: "warm", channel: "google_ads", appointment: appt("a2", "2026-09-10T10:00:00Z", "completed"), quote: { id: "q2", sentAt: d("2026-09-11T10:00:00Z"), status: "accepted", amount: 3000 }, won: true, wonAt: d("2026-09-15T10:00:00Z"), wonAmount: 3000, collectedAmount: 3500, firstContactAt: d("2026-09-02T10:00:00Z"), firstResponseAt: d("2026-09-02T10:20:00Z") }),
  // 3: closed with NO visit
  fact(3, { temperature: "warm", channel: "website", quote: { id: "q3", sentAt: d("2026-09-04T10:00:00Z"), status: "accepted", amount: 2000 }, won: true, wonAt: d("2026-09-06T10:00:00Z"), wonAmount: 2000, collectedAmount: 0 }),
  // 4: cancelled visit
  fact(4, { temperature: "warm", appointment: appt("a4", "2026-09-20T10:00:00Z", "cancelled") }),
  // 5: upcoming visit (after NOW)
  fact(5, { temperature: "cold", appointment: appt("a5", "2026-10-10T10:00:00Z") }),
  // 6: visit date passed, nobody marked it — occurred, unmarked
  fact(6, { temperature: "hot", appointment: appt("a6", "2026-09-25T10:00:00Z"), quote: { id: "q6", sentAt: d("2026-09-26T10:00:00Z"), status: "sent", amount: 7000 } }),
  // 7–10: leads that went nowhere (one warm)
  fact(7, { temperature: "warm", firstContactAt: d("2026-09-02T10:00:00Z"), firstResponseAt: d("2026-09-02T11:00:00Z") }),
  fact(8, { channel: "google_ads" }),
  fact(9, { channel: "website" }),
  fact(10, { channel: "organic" }),
];
const aug = [
  fact(101, { createdAt: d("2026-08-10T10:00:00Z"), temperature: "hot", appointment: appt("a101", "2026-08-12T10:00:00Z", "completed"), quote: { id: "q101", sentAt: d("2026-08-13T10:00:00Z"), status: "accepted", amount: 4000 }, won: true, wonAt: d("2026-08-20T10:00:00Z"), wonAmount: 4000, collectedAmount: 4000 }),
  fact(102, { createdAt: d("2026-08-11T10:00:00Z") }),
  fact(103, { createdAt: d("2026-08-12T10:00:00Z") }),
  fact(104, { createdAt: d("2026-08-13T10:00:00Z") }),
  fact(105, { createdAt: d("2026-08-14T10:00:00Z"), temperature: "warm" }),
];
const cur = computeMetrics({ facts: sept, spend: { amount: 1000, connected: true }, adMessages: { threads: 40, realConversations: 25 }, now: NOW });
const prv = computeMetrics({ facts: aug, spend: { amount: 500, connected: true }, adMessages: { threads: 20, realConversations: 10 }, now: NOW });
const v = cur.values;
ok("ad spend", v.adSpend === 1000);
ok("leads = 10, cold ones included", v.leads === 10);
ok("cost per lead = 1000 / 10", v.costPerLead === 100, v.costPerLead);
ok("qualified = warm/hot plus the cold lead that booked (monotonic)", v.qualifiedLeads === 7, v.qualifiedLeads);
ok("appointments = 5 (cancelled one booked too)", v.appointments === 5, v.appointments);
ok("appointment set rate = 5 / 10", v.appointmentSetRate === 0.5, v.appointmentSetRate);
ok("cost per appointment = 1000 / 5", v.costPerAppointment === 200, v.costPerAppointment);
ok("quotes sent = 4", v.quotesSent === 4, v.quotesSent);
ok("closes = 3, the visit-less one included", v.closes === 3, v.closes);
ok("closes without a visit = 1, reported apart", v.closesWithoutVisit === 1);
ok("close rate = closes after a visit (2) / appointments (5)", v.closeRate === 0.4, v.closeRate);
ok("cost per close = 1000 / 3", v.costPerClose === 333.33, v.costPerClose);
ok("revenue = 5000 + 3000 + 2000", v.revenue === 10000, v.revenue);
ok("collected shown apart = 6000", v.collected === 6000, v.collected);
ok("ROAS = 10000 / 1000", v.roas === 10, v.roas);
ok("average job size = 10000 / 3", v.averageJobSize === 3333.33, v.averageJobSize);
ok("upcoming appointments = 1", v.upcomingAppointments === 1);
ok("adjusted close rate = 2 / (5 − 1 upcoming − 1 cancelled) = 2/3", near(v.adjustedCloseRate, 0.6667), v.adjustedCloseRate);
ok("messages from ads come from the Meta funnel", v.messagesFromAds === 40 && v.realConversations === 25);
ok("ad leads = Meta + Google leads (5 + 2)", v.adLeads === 7, v.adLeads);
ok("message → lead rate = Meta leads (5) / ad conversations (40)", v.messageToLeadRate === 0.125, v.messageToLeadRate);
ok("speed to lead = median of 4, 20, 60 minutes", v.speedToLeadMinutes === 20, v.speedToLeadMinutes);
// lead→appointment for the non-cancelled visits: 4, 8, 38(upcoming, 10 Oct), 23 days
ok("median days lead → appointment", v.medianDaysLeadToAppointment === median([4, 8, 38, 23]), v.medianDaysLeadToAppointment);
// appointment → quote (non-cancelled, quote sent): 2, 1, 1
ok("median days appointment → quote", v.medianDaysAppointmentToQuote === 1, v.medianDaysAppointmentToQuote);
// quote → close: 4, 4, 2
ok("median days quote → close", v.medianDaysQuoteToClose === 4, v.medianDaysQuoteToClose);
// lead → close: 10, 13, 4
ok("median days lead → close", v.medianDaysLeadToClose === 10, v.medianDaysLeadToClose);

const cmp = compareMetrics(cur, prv);
ok("previous CPL = 500 / 5", cmp.costPerLead.previous === 100);
ok("CPL flat against August", cmp.costPerLead.change?.direction === "flat");
ok("leads up 100% on the previous period", cmp.leads.change?.direction === "up" && near(cmp.leads.change.deltaPct, 1));
ok("ROAS 10 against 8", cmp.roas.previous === 8 && cmp.roas.change.direction === "up");
ok("every figure has a definition", METRIC_KEYS.every((k) => cmp[k].definition && cmp[k].definitionKey && DEFINITIONS[k].en));
ok("every definition key is translatable (app.agencyMetrics.def.*)", METRIC_KEYS.every((k) => DEFINITIONS[k].key === `app.agencyMetrics.def.${k}`));

// Nulls, never 0 and never Infinity.
const noSpend = computeMetrics({ facts: sept, spend: { amount: null, connected: false }, now: NOW });
ok("spend not connected → spend null, said so", noSpend.values.adSpend === null && noSpend.reasons.adSpend === "spend_not_connected");
ok("… and every cost and ROAS null", ["costPerLead", "costPerAppointment", "costPerClose", "roas"].every((k) => noSpend.values[k] === null));
ok("… while the counts stand", noSpend.values.leads === 10 && noSpend.values.closes === 3);
const empty = computeMetrics({ facts: [], spend: { amount: 300, connected: true }, now: NOW });
ok("no leads → CPL null, not Infinity", empty.values.costPerLead === null);
ok("no leads → close rate null", empty.values.closeRate === null && empty.values.adjustedCloseRate === null);
ok("no closes → revenue a real 0", empty.values.revenue === 0);
const hidden = computeMetrics({ facts: sept, spend: { amount: 1000, connected: true }, includeMoney: false, now: NOW });
ok("job values not shared → revenue, ROAS, average job null with the reason", ["revenue", "collected", "roas", "averageJobSize"].every((k) => hidden.values[k] === null && hidden.reasons[k] === "money_not_shared"));
ok("… but cost per lead (spend) still shown", hidden.values.costPerLead === 100);

// ── 3. The funnel is monotonic ─────────────────────────────────────────────
if (!MUTANT) console.log("\nThe funnel");
const funnel = buildFunnel({ facts: sept, adMessages: { threads: 40, realConversations: 25 } });
const counts = funnel.stages.map((s) => s.count);
ok("stages: messages → real conversations → leads → qualified → appointments → quotes → closes", funnel.stages.map((s) => s.key).join(",") === "messagesFromAds,realConversations,leads,qualifiedLeads,appointments,quotesSent,closes");
ok("every stage from leads down is ≤ the one above", counts.slice(2).every((c, i, a) => i === 0 || c <= a[i - 1]), counts);
ok("closes without a visit beside the funnel", funnel.closesWithoutVisit === 1);
ok("funnel closes + closes without a visit = the metrics' closes", counts[6] + funnel.closesWithoutVisit === v.closes, [counts[6], funnel.closesWithoutVisit, v.closes]);
ok("quotes sent without a visit beside it too", funnel.quotesSentWithoutVisit === 1);
ok("by channel covers every channel, zeros included", splitByChannel(sept).length === 8 && splitByChannel(sept).find((r) => r.channel === "agency_funnel").leads === 0);

// ── 4. The same, through the real loader ───────────────────────────────────
if (!MUTANT) console.log("\nThe loader: which appointment is the lead's");
const db = fakeDb();
const CO = "co_A";
await db.company.create({ data: { id: CO, name: "Acme Painting", currency: "CAD", country: "CA", agencyShareContacts: false, agencyShareMoney: true } });
await db.company.create({ data: { id: "co_B", name: "Other Co", currency: "CAD", country: "CA" } });
const client = await db.client.create({ data: { companyId: CO, name: "Ana Lopez", email: "ana@example.com", phone: "+16135550142", postalCode: "K1A 0B1", createdAt: d("2026-08-01T00:00:00Z") } });
const lead = await db.leadRequest.create({ data: { companyId: CO, name: "Ana Lopez", email: "ana@example.com", phone: "613-555-0142", source: "meta_lead_form", metaLeadId: "ml1", temperature: "cold", createdAt: d("2026-09-02T10:00:00Z"), updatedAt: d("2026-09-02T10:00:00Z") } });
// A visit booked BEFORE the lead (an older relationship): not this lead's.
await db.appointment.create({ data: { companyId: CO, clientId: client.id, scheduledAt: d("2026-08-05T10:00:00Z"), status: "completed", createdAt: d("2026-08-01T10:00:00Z") } });
// A video call after the lead: not in person.
const video = await db.appointment.create({ data: { companyId: CO, clientId: client.id, scheduledAt: d("2026-09-03T10:00:00Z"), status: "scheduled", createdAt: d("2026-09-02T12:00:00Z") } });
await db.booking.create({ data: { appointmentId: video.id, mode: "video", clientName: "Ana", clientEmail: "ana@example.com" } });
// The real sales visit, and a second visit for the same client: counted once.
await db.appointment.create({ data: { companyId: CO, clientId: client.id, scheduledAt: d("2026-09-06T10:00:00Z"), status: "completed", createdAt: d("2026-09-03T10:00:00Z") } });
await db.appointment.create({ data: { companyId: CO, clientId: client.id, scheduledAt: d("2026-09-07T10:00:00Z"), status: "scheduled", createdAt: d("2026-09-04T10:00:00Z") } });
const q = await db.quote.create({ data: { companyId: CO, clientId: client.id, quoteNumber: "Q-1", status: "accepted", total: 4200, acceptedTotal: 4000, sentAt: d("2026-09-08T10:00:00Z"), acceptedAt: d("2026-09-10T10:00:00Z"), createdAt: d("2026-09-07T10:00:00Z") } });
await db.leadRequest.update({ where: { id: lead.id }, data: { quoteId: q.id, status: "converted" } });
// The job's own visit, after the win: the work, not the sales appointment.
await db.appointment.create({ data: { companyId: CO, clientId: client.id, scheduledAt: d("2026-09-20T10:00:00Z"), status: "scheduled", createdAt: d("2026-09-11T10:00:00Z") } });
// A second lead, won with no visit at all.
const c2 = await db.client.create({ data: { companyId: CO, name: "Bo Chen", email: "bo@example.com", createdAt: d("2026-09-01T00:00:00Z") } });
const q2 = await db.quote.create({ data: { companyId: CO, clientId: c2.id, quoteNumber: "Q-2", status: "accepted", total: 1500, sentAt: d("2026-09-05T10:00:00Z"), acceptedAt: d("2026-09-06T10:00:00Z"), createdAt: d("2026-09-05T09:00:00Z") } });
await db.leadRequest.create({ data: { companyId: CO, name: "Bo Chen", email: "bo@example.com", source: "self_quote", temperature: "warm", quoteId: q2.id, status: "converted", createdAt: d("2026-09-04T10:00:00Z"), updatedAt: d("2026-09-04T10:00:00Z") } });
// Another company's lead and spend: never counted here.
await db.leadRequest.create({ data: { companyId: "co_B", name: "Zed", email: "zed@example.com", source: "meta_lead_form", temperature: "hot", createdAt: d("2026-09-05T10:00:00Z") } });
await db.marketingSpend.create({ data: { companyId: CO, platform: "facebook", amount: 600, date: d("2026-09-10T00:00:00Z"), source: "meta_api", campaignId: "120200000000000001", campaignName: "Fall kitchens" } });
await db.marketingSpend.create({ data: { companyId: "co_B", platform: "facebook", amount: 9999, date: d("2026-09-10T00:00:00Z"), source: "meta_api" } });

const range = resolvePeriod({ period: "custom", from: "2026-09-01", to: "2026-09-30", now: NOW });
const deps = { rates: [], loadAdFunnel: async () => ({ sources: [{ source: "facebook_ads", threads: 9, realConversations: 6 }], allAds: { threads: 9, realConversations: 6 } }) };
const res = await loadMarketingResults({ db, companyId: CO, range, filters: parseFilters({}), now: NOW, deps });
const m = res.metrics;
ok("two leads in September, the other company's excluded", m.leads.value === 2, m.leads.value);
ok("spend is this company's 600 only", m.adSpend.value === 600, m.adSpend.value);
ok("one appointment — counted once, before-the-lead, video and post-win visits excluded", m.appointments.value === 1, m.appointments.value);
ok("two closes, one without a visit", m.closes.value === 2 && m.closesWithoutVisit.value === 1, [m.closes.value, m.closesWithoutVisit.value]);
ok("close rate = 1 / 1", m.closeRate.value === 1);
ok("revenue is the accepted value (4000), not the quote total (4200), plus 1500", m.revenue.value === 5500, m.revenue.value);
ok("the cold lead that booked counts as qualified", m.qualifiedLeads.value === 2);
const st = res.funnel.stages.filter((s) => s.count !== null).map((s) => s.count);
ok("loader funnel is monotonic from leads down", st.slice(2).every((c, i, a) => i === 0 || c <= a[i - 1]), st);
ok("previous period carried (no leads → 0)", m.leads.previous === 0);
ok("by campaign: the spend's campaign appears with its spend", res.byCampaign.some((c) => c.campaignId === "120200000000000001" && c.spend === 600));
const metaOnly = await loadMarketingResults({ db, companyId: CO, range, filters: parseFilters({ source: "meta" }), now: NOW, deps });
ok("source=meta: only the Meta lead", metaOnly.metrics.leads.value === 1);
const organic = await loadMarketingResults({ db, companyId: CO, range, filters: parseFilters({ source: "website" }), now: NOW, deps });
ok("source=website: no paid channel, so no spend to divide", organic.metrics.adSpend.value === null && organic.metrics.costPerLead.value === null);
ok("an unknown source is refused", !parseFilters({ source: "tv" }).ok);

// ── 5. Mutations (cp backups only — never git checkout) ────────────────────
// A mutation pass over a check that already fails proves nothing — every
// mutant would "fail" for the baseline's reason.
if (!MUTANT && fails.length) console.log("\nMutation pass skipped: the baseline fails.");
if (!MUTANT && !fails.length) {
  console.log("\nMutation pass — each change to lib/agency/metrics.js must fail this check");
  const LIB = join(ROOT, "lib/agency/metrics.js");
  const backupDir = join(ROOT, ".mutation-backup-marketing-metrics");
  mkdirSync(backupDir, { recursive: true });
  copyFileSync(LIB, join(backupDir, "metrics.js"));
  const ORIGINAL = readFileSync(LIB, "utf8");
  const MUTATIONS = [
    ["close rate over all closes", "closeRate: ratio(closesWithVisit, appointments, round4)", "closeRate: ratio(closes, appointments, round4)"],
    ["adjusted close rate keeps upcoming", "adjustedCloseRate: ratio(closesWithVisit, occurred, round4)", "adjustedCloseRate: ratio(closesWithVisit, appointments, round4)"],
    ["cancelled counted as occurred", 'else if (outcome === "cancelled") cancelled++;', ""],
    ["ROAS inverted", "roas: spendKnown && revenue !== null ? ratio(revenue, spendAmount) : null", "roas: spendKnown && revenue !== null ? ratio(spendAmount, revenue) : null"],
    ["spend missing becomes 0", "const spendKnown = spendAmount !== null;", "const spendKnown = true;"],
    ["average job over leads", "averageJobSize: revenue !== null ? ratio(revenue, closes) : null", "averageJobSize: revenue !== null ? ratio(revenue, leads) : null"],
    ["money switch ignored", "  if (!includeMoney) {", "  if (false) {"],
  ];
  const escaped = [];
  let caught = 0;
  try {
    for (const [label, from, to] of MUTATIONS) {
      if (!ORIGINAL.includes(from)) {
        escaped.push(`${label} — mutation target not found`);
        continue;
      }
      writeFileSync(LIB, ORIGINAL.replace(from, to));
      let survived = false;
      try {
        execFileSync(process.execPath, ["--import", "./scripts/alias-loader.mjs", "--import", "./scripts/db-stub-loader.mjs", "scripts/check-marketing-metrics.mjs"], { cwd: ROOT, env: { ...process.env, FQ_MUTANT: "1" }, stdio: "pipe" });
        survived = true;
      } catch {
        survived = false;
      }
      writeFileSync(LIB, ORIGINAL);
      if (survived) escaped.push(`${label} — NOT caught`);
      else {
        caught++;
        console.log(`  ✓ caught: ${label}`);
      }
    }
  } finally {
    writeFileSync(LIB, ORIGINAL);
    rmSync(backupDir, { recursive: true, force: true });
  }
  ok(`all ${MUTATIONS.length} mutants caught`, escaped.length === 0, escaped.join(" | "));
}

if (!MUTANT) {
  console.log(
    fails.length
      ? `\nFAILED — ${fails.length} of ${pass + fails.length}\n${fails.map((f) => `  ✗ ${f}`).join("\n")}`
      : `\nPASSED — ${pass}/${pass} assertions`,
  );
}
process.exit(fails.length ? 1 : 0);
