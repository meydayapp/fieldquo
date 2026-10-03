// scripts/check-monthly-summary.mjs
//
//   npm run check:monthly-summary
//
// The monthly summary email (lib/email/monthlySummaryEmail.js), its numbers
// (lib/analytics/monthlySummary.js) and its AI fence (lib/ai/monthlyDigest.js),
// executed against scripts/fixtures/monthlySummaryFixture.mjs.
//
// What the owner's September copy got wrong, each turned into an assertion:
//
//   1. money printed with no currency ("blended cost per lead of 40.29")
//   2. exchange-rate internals ("converted from USD 261.11 at 1.3888, rate 34
//      days old")
//   3. absence printed as zero ("Revenue and expenses were both 0")
//   4. a model owning the page — so: a failed, refused, over-quota or
//      off-fence AI answer must still produce a complete email
//   5. contrast never measured — every pair, light and dark
//
// plus the bug underneath it all: the numbers were the wrong month.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  septemberSummary,
  emptySummary,
  COMPANY,
  ORIGIN,
  AS_OF,
  PERIOD,
  PRIOR,
  spendRows,
  invoices,
  payments,
  overview,
  leads,
} from "./fixtures/monthlySummaryFixture.mjs";
import { buildMonthlySummary, metric } from "@/lib/analytics/monthlySummary";
import { rollupSpendRows } from "@/lib/analytics/marketingRollup";
import {
  buildMonthlySummaryEmail,
  summaryFormatter,
  MONTHLY_SUMMARY_PAIRS,
  fallbackInsights,
} from "@/lib/email/monthlySummaryEmail";
import { buildDigestInsights, fenceInsights, digestSchema, digestPrompt, DIGEST_SYSTEM, digestMetrics } from "@/lib/ai/monthlyDigest";
import { assertStrictSchema } from "@/lib/ai/jsonSchema";
import { APP_MESSAGES } from "@/app/i18n/appMessages";
import { formatAppMoney } from "@/lib/format/money";
import { RATES } from "@/lib/marketing/fx";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(path.join(ROOT, p), "utf8");
const code = (p) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*"))
    .join("\n");

let passed = 0;
const fails = [];
const ok = (name, cond, detail) => {
  if (cond) passed++;
  else fails.push(`${name}${detail === undefined ? "" : ` — ${String(JSON.stringify(detail)).slice(0, 300)}`}`);
};
const section = (s) => console.log(`\n${s}`);
const LANGS = Object.keys(APP_MESSAGES);
// Intl separates groups and currency signs with U+00A0 / U+202F; both sides of
// every comparison are folded to plain spaces.
const sp = (s) => String(s).replace(/[\s  ]+/g, " ");
const text = (html) => sp(html.replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&"));

const sept = septemberSummary();
const empty = emptySummary();

// ══════════════════════════════════════════════════════════════════════════
section("The numbers are September's, by the shared definitions");
{
  const t = sept.tiles;
  ok("invoiced = September-issued families at latest version, drafts out (4200+2850+3430+1600)", t.invoiced.value === 12080, t.invoiced);
  ok("…compared with August's (1980+5100+2600)", t.invoiced.prior === 9680 && t.invoiced.change.direction === "up" && t.invoiced.change.pct === 25, t.invoiced);
  ok("collected = September payments by the date they landed (4200+500+3430)", t.collected.value === 8130, t.collected);
  ok("…August 7,700, so up 6%", t.collected.prior === 7700 && t.collected.change.pct === 6, t.collected);
  ok("leads = this month's LeadRequests (18), prior 13", t.leads.value === 18 && t.leads.prior === 13);
  ok("quotes come from the overview for the month (14 sent, 6 accepted)", t.quotesSent.value === 14 && t.quotesAccepted.value === 6);
  ok("acceptance rate compared only because BOTH months clear RATE_FLOOR (14 and 12 sent)", t.acceptance.change !== null);
  ok("jobs completed: 4, prior 3", t.jobs.value === 4 && t.jobs.prior === 3);
  const usd = spendRows(9).filter((r) => r.currency === "USD").reduce((s, r) => s + r.amount, 0);
  const rate = RATES.find((r) => r.base === "USD" && r.quote === "CAD").rate;
  ok("spend = CAD rows + USD rows at the pinned rate", Math.abs(t.spend.value - (120 + Math.round(usd * rate * 100) / 100)) < 0.011, [t.spend.value, usd, rate]);
  ok("…and is marked approximate", t.spend.approximate === true);
  ok("cost per lead = buildBlendedCostPerLead: spend over 17 real leads (manual excluded)", t.costPerLead.leadsCounted === 17 && t.costPerLead.leadsExcluded === 1 && Math.abs(t.costPerLead.value - Math.round((t.spend.value / 17) * 100) / 100) < 0.011, t.costPerLead);
  ok("funnel is leads → quotes → accepted → jobs → paid", sept.funnel.map((s) => `${s.key}:${s.count}`).join(",") === "leads:18,quotes:14,accepted:6,jobs:4,paid:2", sept.funnel);
  ok("money owed: 3 overdue invoices, 2850 + (1980−500) + 1250", sept.owed.overdueCount === 3 && sept.owed.overdueTotal === 5580, sept.owed);
  ok("…the partly-paid one counts for its remainder, the future-due one is owed but not overdue", sept.owed.total === 7180 && sept.owed.count === 4, sept.owed);
  ok("sources: one row per LeadRequest.source, quoted and won through LeadRequest.quoteId", JSON.stringify(sept.sources.leads[0]) === JSON.stringify({ source: "instant_quote", leads: 7, quoted: 5, won: 3 }), sept.sources.leads[0]);
  ok("campaigns come from buildCampaignRollup (Fall interiors: 3 leads, 2 quotes, 1 job)", sept.sources.campaigns[0]?.name === "Fall interiors" && sept.sources.campaigns[0].leads === 3 && sept.sources.campaigns[0].quotes === 2 && sept.sources.campaigns[0].jobs === 1, sept.sources.campaigns[0]);
  {
    const A = sept.sources.campaigns.find((c) => c.name === "Fall interiors");
    const B = sept.sources.campaigns.find((c) => c.name === "Deck & fence staining");
    ok("campaigns carry the social-leads rollup's Paid (money received, from amountPaid)", A?.paid === 3430, A);
    ok("…null, never 0, when nothing was invoiced", B?.paid === null, B);
    ok("…and its conversation leads (a Messenger lead from the ad)", B?.conversationLeads === 1, B);
    const e = buildMonthlySummaryEmail({ summary: sept, company: COMPANY, language: "en", origin: ORIGIN });
    const body = text(e.html);
    ok("the email prints Paid as money, and 'Not invoiced' for none", body.includes(sp(formatAppMoney(3430, "CAD", "en"))) && body.includes(APP_MESSAGES.en["app.monthlySummary.sources.notInvoiced"]));
    ok("…and says how many leads came from messages", body.includes("1 from messages") && sp(e.text).includes("1 from messages"));
  }
  ok("social conversations come from monthlyConversations' bySource", sept.sources.conversations.find((c) => c.source === "meta_messenger")?.conversations === 6);
}

section("Insights are ranked facts from the data");
{
  const keys = sept.insights.map((i) => i.key);
  ok("three insights", keys.length === 3, keys);
  ok("finished-but-not-invoiced jobs lead (a DRAFT invoice is not an invoice)", keys[0] === "uninvoicedJobs" && sept.insights[0].values.uninvoicedJobs.n === 2, sept.insights[0]);
  ok("overdue money is second", keys[1] === "overdue");
  ok("unquoted leads: 6 with no quote, 5 older than 3 days at asOf", keys[2] === "unquotedLeadsStale" && sept.insights[2].values.unquotedLeads.n === 6 && sept.insights[2].values.unquotedStale.n === 5, sept.insights[2].values);
  ok("more candidates than three are ranked for the AI to choose among", sept.candidates.length > 3);
  ok("waiting quotes counts only sent >7 days before asOf (3 of 4)", sept.candidates.find((c) => c.key === "waitingQuotes")?.values.waitingQuotes.n === 3);
}

// ══════════════════════════════════════════════════════════════════════════
section("Absent data never renders as 0");
{
  const t = empty.tiles;
  ok("no invoices ever → invoiced unavailable, not 0", !t.invoiced.available && t.invoiced.reason === "no_invoices_yet");
  ok("no payments ever → collected unavailable, not 0", !t.collected.available && t.collected.reason === "no_payments_yet");
  ok("no spend rows → spend unavailable, not $0.00", !t.spend.available && t.spend.reason === "no_spend_recorded");
  ok("…and cost per lead does not exist (it would otherwise be 0 over any leads)", !t.costPerLead.available && t.costPerLead.reason === "needs_spend");
  ok("no quotes sent → no acceptance rate", !t.acceptance.available && t.acceptance.reason === "no_quotes_sent");
  ok("first month → no comparison anywhere", Object.values(t).every((m) => m.change === null));
  // Leads but no spend: buildBlendedCostPerLead alone would say $0.00 a lead.
  const leadsNoSpend = buildMonthlySummary({ period: PERIOD, prior: PRIOR, asOf: AS_OF, leads: leads(), marketing: rollupSpendRows({ rows: [], companyCurrency: "CAD", asOf: AS_OF }), overview: overview() });
  ok("leads with no ad spend → cost per lead is NOT $0.00 a lead", !leadsNoSpend.tiles.costPerLead.available, leadsNoSpend.tiles.costPerLead);
  ok("a prior of 0 has no percentage — 'up from none'", (() => { const m = metric(5, { prior: 0 }); return m.change.pct === null && m.change.fromNone === true; })());
  ok("a missing prior is no comparison, not a comparison with 0", metric(5, { prior: null }).change === null);

  for (const lang of LANGS) {
    const e = buildMonthlySummaryEmail({ summary: empty, company: COMPANY, language: lang, origin: ORIGIN });
    const body = text(e.html);
    const zeroMoney = sp(formatAppMoney(0, COMPANY.currency, lang));
    ok(`${lang}: the empty email prints no ${zeroMoney}`, !body.includes(zeroMoney) && !sp(e.text).includes(zeroMoney), zeroMoney);
    const t2 = (k) => APP_MESSAGES[lang][`app.monthlySummary.${k}`];
    for (const reason of ["no_invoices_yet", "no_payments_yet", "no_spend_recorded"]) {
      ok(`${lang}: says "${t2(`na.${reason}`)}" instead`, body.includes(t2(`na.${reason}`)) && e.text.includes(t2(`na.${reason}`)));
    }
    ok(`${lang}: an all-zero pipeline is left out, not drawn`, !body.includes(t2("funnel.paid")));
  }
}

// ══════════════════════════════════════════════════════════════════════════
section("Money is always formatted with the company's currency");
{
  const amounts = [12080, 8130, 5580, sept.tiles.spend.value, sept.tiles.costPerLead.value];
  for (const currency of ["CAD", "USD", "EUR"]) {
    for (const lang of LANGS) {
      const company = { ...COMPANY, currency };
      const e = buildMonthlySummaryEmail({ summary: sept, company, language: lang, origin: ORIGIN });
      const body = text(e.html);
      const plain = sp(e.text);
      for (const a of amounts) {
        const f = sp(formatAppMoney(a, currency, lang));
        ok(`${currency}/${lang}: ${a} appears as ${f}`, body.includes(f) && plain.includes(f), f);
      }
      // No amount appears as a bare number: strip every formatted amount and
      // the raw digits of each must be gone.
      let stripped = `${body} ${plain}`;
      for (const a of amounts) stripped = stripped.split(sp(formatAppMoney(a, currency, lang))).join(" ");
      for (const a of amounts) {
        const raw = [String(a), a.toFixed(2), Math.round(a).toString()];
        ok(`${currency}/${lang}: no bare ${a} outside its currency format`, raw.every((r) => !new RegExp(`(^|[^\\d.,])${r.replace(".", "\\.")}([^\\d]|$)`).test(stripped)), raw.find((r) => stripped.includes(r)));
      }
    }
  }
  const src = code("lib/email/monthlySummaryEmail.js");
  ok("the email formats money only through formatAppMoney (no toFixed, no hand-built $)", !/toFixed\(/.test(src) && !/`\$\$\{/.test(src));
}

// ══════════════════════════════════════════════════════════════════════════
section("No exchange-rate internals in the output");
{
  const conversion = sept.tiles.spend;
  ok("the fixture really did convert (otherwise this section proves nothing)", conversion.approximate === true);
  const usd = spendRows(9).filter((r) => r.currency === "USD").reduce((s, r) => s + r.amount, 0);
  const rate = RATES[0];
  for (const lang of LANGS) {
    const e = buildMonthlySummaryEmail({ summary: sept, company: COMPANY, language: lang, origin: ORIGIN });
    const all = `${text(e.html)} ${sp(e.text)} ${e.subject}`;
    const banned = [
      String(rate.rate), String(rate.rate).replace(".", ","), rate.rateDate, rate.sourceName, "FXUSDCAD", "Bank of Canada",
      usd.toFixed(2), usd.toFixed(2).replace(".", ","), "USD", "US$", "days old", "converted", "exchange rate",
    ];
    const hit = banned.filter((b) => all.includes(b));
    ok(`${lang}: no rate, rate date, source, original USD amount or conversion wording`, hit.length === 0, hit);
    ok(`${lang}: a converted figure carries "≈" and nothing more`, all.includes("≈"));
  }
  for (const f of ["lib/email/monthlySummaryEmail.js", "lib/ai/monthlyDigest.js", "lib/analytics/monthlySummary.js"]) {
    const src = code(f);
    ok(`${f} never reads the conversion detail (currencyConversions / rateAgeDays / convertedFrom)`, !/currencyConversions|rateAgeDays|convertedFrom|rateSource/.test(src));
  }
  // What the model is shown, too — the old prompt is where the FX sentence came from.
  const fmt = summaryFormatter({ language: "en", currency: "CAD" });
  const prompt = digestPrompt({ companyName: COMPANY.name, facts: sept.candidates, fmt });
  ok("the AI prompt carries no rate or original currency amount", !prompt.includes(String(rate.rate)) && !prompt.includes(usd.toFixed(2)) && !/USD/.test(prompt), prompt.slice(0, 200));
}

// ══════════════════════════════════════════════════════════════════════════
section("The AI fence, and the fallback that makes it safe to be strict");
{
  const facts = sept.candidates.slice(0, 6);
  ok("the schema is strict-structured-output clean", assertStrictSchema(digestSchema(facts.map((f) => f.key))).ok, assertStrictSchema(digestSchema(facts.map((f) => f.key))).errors);
  const good = { insights: [
    { fact: "overdue", text: "{overdueAmount} is sitting unpaid across {overdueInvoices} — call the client {overdueDays} late before anyone else." },
    { fact: "uninvoicedJobs", text: "Bill the {uninvoicedJobs} you finished in {month} today." },
  ] };
  const fenced = fenceInsights(good, facts);
  ok("a clean answer passes", fenced.ok === true, fenced);
  const bad = (insights, why) => ok(`refused: ${why}`, fenceInsights({ insights }, facts).ok === false, fenceInsights({ insights }, facts));
  bad([{ fact: "overdue", text: "$5,580 is overdue — chase it today please." }], "a typed amount");
  bad([{ fact: "overdue", text: "Three invoices, oldest 64 days late, chase {overdueAmount}." }], "a typed digit");
  bad([{ fact: "overdue", text: "Chase {overdueAmount} — ੬੪ days late already." }], "digits in another script");
  bad([{ fact: "overdue", text: "Chase {overdueAmount}, that is 40% of revenue." }], "a typed percentage");
  bad([{ fact: "overdue", text: "Chase {overdueAmount} from {bestSource} today." }], "another fact's placeholder");
  bad([{ fact: "overdue", text: "Chase {revenue} today, it is overdue." }], "an invented placeholder");
  bad([{ fact: "madeUp", text: "Something entirely invented here." }], "an unknown fact");
  bad([{ fact: "overdue", text: "Chase {overdueAmount} today." }, { fact: "overdue", text: "And chase {overdueAmount} again." }], "the same fact twice");
  bad([1, 2, 3, 4].map((i) => ({ fact: facts[i % facts.length].key, text: "Too many sentences for one email here." })), "more than three");
  bad([{ fact: "overdue", text: "<b>Chase</b> {overdueAmount} today." }], "markup");
  bad([], "nothing at all");

  const fmt = summaryFormatter({ language: "en", currency: "CAD" });
  const base = { companyId: "co1", companyName: COMPANY.name, facts: sept.candidates, fmt, periodStart: PERIOD.start, periodEnd: PERIOD.end, periodKey: PERIOD.key, recordError: async () => {} };
  const openMeter = () => ({ payer: "company", ledger: "wallet", check: async () => ({ allowed: true }), record: async () => ({ chargedCents: 1 }) });

  const run = async (completeImpl, extra = {}) => buildDigestInsights({ ...base, meter: openMeter(), complete: completeImpl, ...extra });

  // A valid answer is used, filled by OUR formatter.
  const used = await run(async ({ onUsage }) => { onUsage?.({ model: "m", promptTokens: 1, completionTokens: 1 }); return { ok: true, data: good }; });
  ok("a fenced answer is used", used.sentences?.length === 2 && used.chosen.map((f) => f.key).join() === "overdue,uninvoicedJobs", used);
  ok("…its placeholders filled by the email's formatter", used.sentences[0].text.includes(formatAppMoney(5580, "CAD", "en")) && !used.sentences[0].text.includes("{"), used.sentences[0].text);

  const cases = [
    ["the provider fails (no key, outage)", async () => ({ ok: false, reason: "unconfigured" })],
    ["the provider throws nothing and returns nothing", async () => null],
    ["the answer is off-fence (typed numbers)", async () => ({ ok: true, data: { insights: [{ fact: "overdue", text: "Chase the $5,580 owed today." }] } })],
  ];
  for (const [label, impl] of cases) {
    const r = await run(impl);
    ok(`${label} → fallback requested, not an empty section`, r.sentences === null && r.aiRejected, r);
    const e = buildMonthlySummaryEmail({ summary: sept, company: COMPANY, language: "en", origin: ORIGIN, insights: r.sentences });
    const fallback = fallbackInsights(sept.insights, fmt).map((s) => s.text);
    ok(`${label} → the email carries the catalogue's three sentences`, fallback.length === 3 && fallback.every((s) => e.text.includes(s)), fallback);
    ok(`${label} → and is a whole document`, e.html.startsWith("<!DOCTYPE html>") && e.html.trim().endsWith("</html>") && (e.html.match(/<table/g) || []).length === (e.html.match(/<\/table>/g) || []).length);
  }

  let called = false;
  const none = await buildDigestInsights({ ...base, facts: [], meter: { ledger: "wallet", check: async () => { called = true; return { allowed: true }; }, record: async () => { called = true; } }, complete: async () => { called = true; return {}; } });
  ok("nothing to act on → no gate, no call, no sentences", !called && none.sentences.length === 0);

  // ── Who pays: the REAL meterFor → wallet ledger, every store faked ───────
  //
  // Owner, 2026-10-03: AI insights only for a company with FieldQuo AI
  // credit, taken from theirs; everyone else gets the standard sentences and
  // is never charged. Executed through meterFor("monthly_digest") itself, so
  // the registry entry, the wallet ledger and the AI-wallet kind are all real.
  const { meterFor, clearPayerCache, companyLedgerFor, payerFeature } = await import("@/lib/ai/featurePayer");
  const { poolForKind, POOLS } = await import("@/lib/voice/credits");
  ok("monthly_digest is registered as company-paid from the AI wallet, wired", payerFeature("monthly_digest")?.defaultPayer === "company" && companyLedgerFor("monthly_digest") === "wallet" && payerFeature("monthly_digest")?.wired === true);
  ok("…and its debit lands in the AI wallet, not the voice one", poolForKind("monthly_digest") === POOLS.AI);
  const AFTER_GRACE = new Date("2026-11-01T08:00:00Z");
  const ledgerFor = (balanceCents) => {
    const debits = [];
    const usages = [];
    let allowanceAsked = 0;
    const fakePrisma = { aiFeaturePayer: { findUnique: async () => null } };
    const deps = {
      balanceFor: async () => balanceCents,
      debitCredit: async (d) => { debits.push(d); return { cents: -d.cents }; },
      recordAiUsage: async (u) => { usages.push(u); },
      checkAiQuota: async () => { allowanceAsked++; return { allowed: true }; },
    };
    return { fakePrisma, deps, debits, usages, allowanceAsked: () => allowanceAsked };
  };
  const answer = async ({ onUsage }) => {
    onUsage?.({ model: "gpt-5.4-mini", promptTokens: 620, completionTokens: 110 });
    return { ok: true, data: good };
  };

  {
    clearPayerCache();
    const L = ledgerFor(0);
    let modelCalls = 0;
    const meter = await meterFor("monthly_digest", { companyId: "co_no_ai", prisma: L.fakePrisma, now: AFTER_GRACE, deps: L.deps });
    const r = await buildDigestInsights({ ...base, companyId: "co_no_ai", meter, complete: async (a) => { modelCalls++; return answer(a); } });
    ok("a company with NO AI credit: no model call", modelCalls === 0);
    ok("…never charged: no debit, no AiUsage row, its allowance not even consulted", L.debits.length === 0 && L.usages.length === 0 && L.allowanceAsked() === 0, { debits: L.debits, usages: L.usages });
    ok("…and gets the deterministic sentences", r.sentences === null && r.skipCode === "no_credit");
    const e = buildMonthlySummaryEmail({ summary: sept, company: COMPANY, language: "en", origin: ORIGIN, insights: r.sentences });
    ok("…in a complete email", fallbackInsights(sept.insights, fmt).every((s) => e.text.includes(s.text)));
  }
  {
    clearPayerCache();
    const L = ledgerFor(5000);
    let modelCalls = 0;
    const meter = await meterFor("monthly_digest", { companyId: "co_ai", prisma: L.fakePrisma, now: AFTER_GRACE, deps: L.deps });
    const r = await buildDigestInsights({ ...base, companyId: "co_ai", meter, complete: async (a) => { modelCalls++; return answer(a); } });
    ok("a company WITH AI credit: the model runs once", modelCalls === 1);
    ok("…its AiUsage row is its own, marked paid from the wallet (so not ALSO taken from its allowance)", L.usages.length === 1 && L.usages[0].companyId === "co_ai" && L.usages[0].feature === "monthly_digest" && L.usages[0].paidFromWallet === true, L.usages);
    ok("…the debit is the company's own AI credit, kind monthly_digest, once a month by ref", L.debits.length === 1 && L.debits[0].companyId === "co_ai" && L.debits[0].kind === "monthly_digest" && L.debits[0].ref === `monthly_digest:co_ai:${PERIOD.key}` && L.debits[0].cents >= 1, L.debits);
    ok("…and the email gets the AI's sentences", r.sentences?.length === 2 && r.chargedCents >= 1);
  }
  clearPayerCache();
  ok("the system prompt forbids typed numbers and invented facts", /never write a digit/.test(DIGEST_SYSTEM) && /do not invent/.test(DIGEST_SYSTEM));

  const metrics = digestMetrics(empty, summaryFormatter({ language: "en", currency: "CAD" }));
  ok("the in-app archive's metrics are words and formatted money — never a bare 0 for an absence", !Object.values(metrics).includes("0") || metrics[APP_MESSAGES.en["app.monthlySummary.tile.invoiced"]] === APP_MESSAGES.en["app.monthlySummary.na.no_invoices_yet"], metrics);
  ok("…and carry no raw numbers", Object.values(digestMetrics(sept, fmt)).every((v) => typeof v === "string"));
}

// ══════════════════════════════════════════════════════════════════════════
section("Contrast, measured, light and dark");
{
  const lum = (hex) => {
    const n = hex.replace("#", "");
    const v = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  };
  const ratio = (a, b) => {
    const [x, y] = [lum(a), lum(b)];
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  };
  for (const p of MONTHLY_SUMMARY_PAIRS) ok(`${p.name}: ${p.fg} on ${p.bg} is ${ratio(p.fg, p.bg).toFixed(2)}:1 ≥ 4.5`, ratio(p.fg, p.bg) >= 4.5);
  const e = buildMonthlySummaryEmail({ summary: sept, company: COMPANY, language: "en", origin: ORIGIN });
  const used = new Set((e.html.match(/#[0-9a-fA-F]{6}\b/g) || []).map((c) => c.toLowerCase()));
  const measured = new Set(MONTHLY_SUMMARY_PAIRS.flatMap((p) => [p.fg.toLowerCase(), p.bg.toLowerCase()]));
  // Fills that never carry text: bar, track and rule.
  const decorative = new Set(["#e5e7eb", "#2d3443"]);
  const unmeasured = [...used].filter((c) => !measured.has(c) && !decorative.has(c));
  ok("every colour in the rendered email is in a measured pair (or a text-free fill)", unmeasured.length === 0, unmeasured);
  ok("dark mode is declared and styled", /color-scheme" content="light dark"/.test(e.html) && /prefers-color-scheme: dark/.test(e.html));
  ok("tiles stack on a phone", /max-width: 480px/.test(e.html) && /\.fq-col \{ display: block/.test(e.html));
  ok("600px, table layout", /max-width:600px/.test(e.html) && /role="presentation"/.test(e.html));
}

// ══════════════════════════════════════════════════════════════════════════
section("Structure, links, plain text, every language");
{
  for (const lang of LANGS) {
    const e = buildMonthlySummaryEmail({ summary: sept, company: COMPANY, language: lang, origin: ORIGIN });
    const hrefs = [...e.html.matchAll(/href="([^"]*)"/g)].map((m) => m[1].replace(/&amp;/g, "&"));
    ok(`${lang}: every link is absolute on the app origin`, hrefs.length >= 3 && hrefs.every((h) => h.startsWith(`${ORIGIN}/app`)), hrefs);
    ok(`${lang}: one primary button, to the KPI report for September`, hrefs.includes(`${ORIGIN}/app/analytics/kpis?from=2026-09-01&to=2026-09-30`));
    ok(`${lang}: 1–2 contextual links`, e.links.length >= 2 && e.links.length <= 4);
    ok(`${lang}: the company's name is in the subject`, e.subject.includes(COMPANY.name));
    ok(`${lang}: the month is named in the reader's language`, e.subject.includes(new Intl.DateTimeFormat(lang === "tl" ? "fil-PH" : lang, { month: "long", timeZone: "UTC" }).format(PERIOD.start)) || lang === "pa" || lang === "zh", e.subject);
    ok(`${lang}: a plain-text part that carries the same links`, e.text.length > 400 && hrefs.every((h) => e.text.includes(h)));
    ok(`${lang}: no unfilled {placeholder} anywhere`, !/\{\w+\}/.test(text(e.html)) && !/\{\w+\}/.test(e.text), (e.text.match(/\{\w+\}/) || [])[0]);
    ok(`${lang}: three insights`, e.insights.length === 3);
    ok(`${lang}: dates in the company's format`, e.text.includes("09/01/2026 – 09/30/2026"));
    const dict = APP_MESSAGES[lang];
    const missing = Object.keys(APP_MESSAGES.en).filter((k) => k.startsWith("app.monthlySummary.") && !(k in dict));
    ok(`${lang}: every app.monthlySummary key is translated`, missing.length === 0, missing);
  }
  const usedKeys = new Set();
  for (const f of ["lib/email/monthlySummaryEmail.js", "lib/ai/monthlyDigest.js"]) {
    for (const m of read(f).matchAll(/k\("([\w.]+)"\)/g)) usedKeys.add(`app.monthlySummary.${m[1]}`);
  }
  const absent = [...usedKeys].filter((k) => !(k in APP_MESSAGES.en));
  ok("every key the email asks for exists", absent.length === 0, absent);
  for (const f of sept.candidates) ok(`insight template exists for ${f.key}`, typeof APP_MESSAGES.en[`app.monthlySummary.insight.${f.key}`] === "string");
  ok("the date-format setting is honoured (DD/MM/YYYY)", buildMonthlySummaryEmail({ summary: sept, company: { ...COMPANY, dateFormat: "DD/MM/YYYY" }, language: "en", origin: ORIGIN }).text.includes("01/09/2026 – 30/09/2026"));
}

// ══════════════════════════════════════════════════════════════════════════
section("The right month, and a loader that cannot write");
{
  const ov = code("lib/analytics/overview.js");
  ok("getAnalyticsOverview takes the month to report", /getAnalyticsOverview\(\{ companyId, now = new Date\(\) \}\)/.test(ov));
  ok("…and bounds every current-month filter above (6 of them)", (ov.match(/lt: startOfNextMonth/g) || []).length === 6, (ov.match(/lt: startOfNextMonth/g) || []).length);
  const data = code("lib/analytics/monthlySummaryData.js");
  ok("the summary asks overview about the REPORTED month", /getAnalyticsOverview\(\{ companyId, now: mid \}\)/.test(data));
  for (const f of ["lib/analytics/monthlySummaryData.js", "lib/analytics/campaignRollupData.js", "lib/analytics/monthlySummary.js"]) {
    ok(`${f} writes nothing (the preview reads production with it)`, !/\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\(|recordError|\$executeRaw/.test(code(f)));
  }
  const cron = code("app/api/cron/monthly-digest/route.js");
  ok("the cron reports LAST month on the UTC calendar", /Date\.UTC\(now\.getUTCFullYear\(\), now\.getUTCMonth\(\) - 1, 1\)/.test(cron));
  ok("the cron passes an origin for the links", /origin/.test(cron));
  const digest = code("lib/ai/monthlyDigest.js");
  ok("the digest sends html AND text", /html: email\.html/.test(digest) && /text: email\.text/.test(digest));
  ok("the digest never builds HTML of its own", !/<p>|<ul>|<li>/.test(digest));
  ok("the route and the summary share one campaign loader", /loadCampaignRollup/.test(code("app/api/marketing-spend/campaigns/route.js")) && /loadCampaignRollup/.test(data));
  const kpis = code("app/app/analytics/kpis/page.js");
  ok("the KPI page honours ?from&to, so the report button opens the right month", /params\.get\("from"\)/.test(kpis) && /setRange\(\{ from, to \}\)/.test(kpis));
}

console.log(
  fails.length
    ? `\nFAILED — ${fails.length} of ${passed + fails.length}\n${fails.map((f) => `  ✗ ${f}`).join("\n")}`
    : `\nPASSED — ${passed}/${passed} assertions (rendered as of ${AS_OF.toISOString()})`,
);
process.exit(fails.length ? 1 : 0);
