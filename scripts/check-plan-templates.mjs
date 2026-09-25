// scripts/check-plan-templates.mjs
//
// Maintenance-plan templates, the plan offered on a quote, and the ServicePlan
// an approval creates — executed, not read.
//
//   npm run check:plan-templates
//
// What is asserted, in order of how much money getting it wrong would move:
//
//   1. The browser never prices a plan. The approval takes ids, intersected
//      with the quote's own offers; a tampered amount has nowhere to land, and
//      the public route never reads one.
//   2. Approval → plan creation happens ONCE per offer, under concurrency and
//      on retry, and never for an offer the client didn't take, another
//      company's offer, or terms the hand-made plan form would refuse.
//   3. The arithmetic: per visit, discount rounding, what a month and a year
//      "work out to", when a year is NOT stated, tax — all from the same
//      occurrenceAmounts the invoices bill with.
//   4. Hostile template input is refused with a sentence, not stored.
//   5. The starter seeds: eight languages each, valid terms, HCP's figures
//      reproduced within a few percent, and no price in a currency the one
//      exchange rate does not cover.
//   6. The client-facing copy exists in all eight document languages and
//      renders no "undefined"; the invoice note is in the plan's language and
//      currency.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  VISITS_PER_YEAR,
  PLAN_TEMPLATE_LANGUAGES,
  cleanLanguageMap,
  textIn,
  validateTemplateInput,
  offerPricing,
  offerFromTemplate,
  offersTaken,
  planStartDate,
  planInputFromOffer,
  quoteTaxRatePct,
} from "@/lib/servicePlans/templates";
import { occurrenceAmounts } from "@/lib/servicePlans/pricing";
import { ensureServicePlansForQuote } from "@/lib/servicePlans/fromQuote";
import { PLAN_OFFER_COPY, planOfferCopy } from "@/lib/servicePlans/offerCopy";
import { planDiscountNote } from "@/lib/servicePlans/run";
import { PLAN_TEMPLATE_SEEDS, planTemplateSeedsForTrade } from "@/app/data/planTemplateSeeds";
import { templateDataForPlanSeed } from "@/lib/servicePlans/seedTemplates";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

let failures = 0;
let checks = 0;
function ok(name, pass, detail = "") {
  checks++;
  if (!pass) failures++;
  console.log(`  ${pass ? "ok  " : "FAIL"} ${name}${detail ? `  ${detail}` : ""}`);
}
const UTC = (s) => new Date(`${s}T00:00:00.000Z`);
const iso = (d) => (d ? new Date(d).toISOString().slice(0, 10) : String(d));

// ─────────────────────────────────────────────────────────────────────────
console.log("\n1. Pricing — per visit, month, year, term");

{
  // HCP cleaning: "$50/month or $599/year, 4 visits, 10%" → $165 a visit.
  const q = offerPricing({ pricePerVisit: 165, discountPct: 10, taxRatePct: null, frequency: "quarterly", visitCount: 4 });
  ok("quarterly $165 less 10% bills $148.50 a visit", q.perVisit.subtotal === 148.5, String(q.perVisit.subtotal));
  ok("  ^ works out to $594 a year", q.yearly === 594, String(q.yearly));
  ok("  ^ and $49.50 a month", q.monthly === 49.5, String(q.monthly));
  ok("  ^ term = 4 visits summed from the invoices, $594", q.term?.subtotal === 594 && q.term.occurrences === 4);

  const m = offerPricing({ pricePerVisit: 145, discountPct: 15, taxRatePct: null, frequency: "monthly", visitCount: 12 });
  ok("monthly $145 less 15% bills $123.25 a visit", m.perVisit.subtotal === 123.25);
  ok("  ^ $1,479 a year, $123.25 a month", m.yearly === 1479 && m.monthly === 123.25, `${m.yearly} ${m.monthly}`);

  // Half-cent: 15% of $99.99 is $14.9985 → the invoice discounts $15.00.
  const h = offerPricing({ pricePerVisit: 99.99, discountPct: 15, taxRatePct: null, frequency: "quarterly", visitCount: null });
  const inv = occurrenceAmounts({ amountPerOccurrence: 99.99, discountPct: 15, taxRatePct: null });
  ok("half-cent discount rounds exactly as the invoice does", h.perVisit.subtotal === inv.subtotal && inv.subtotal === 84.99, String(h.perVisit.subtotal));
  ok("  ^ the year is 4 × the rounded visit, never a re-discounted gross", h.yearly === 339.96, String(h.yearly));
  ok("  ^ the month is the year / 12 rounded to the cent", h.monthly === 28.33, String(h.monthly));

  const w = offerPricing({ pricePerVisit: 55, discountPct: 10, taxRatePct: null, frequency: "weekly", visitCount: 26 });
  ok("26 weekly visits do NOT claim a yearly or monthly figure", w.yearly === null && w.monthly === null);
  ok("  ^ they state the term instead: 26 × $49.50 = $1,287", w.term?.subtotal === 1287, String(w.term?.subtotal));

  const two = offerPricing({ pricePerVisit: 100, discountPct: 0, taxRatePct: null, frequency: "monthly", visitCount: 2 });
  ok("2 monthly visits state no year", two.yearly === null && two.term.subtotal === 200);

  const open = offerPricing({ pricePerVisit: 95, discountPct: 10, taxRatePct: null, frequency: "weekly", visitCount: null });
  ok("an open-ended plan has a year and a month but no term", open.yearly === 4446 && open.term === null, `${open.yearly}`);

  const taxed = offerPricing({ pricePerVisit: 165, discountPct: 10, taxRatePct: 13, frequency: "quarterly", visitCount: 4 });
  ok("tax applies after the discount, per visit ($148.50 → $19.31)", taxed.perVisit.tax === 19.31 && taxed.perVisit.total === 167.81, `${taxed.perVisit.tax}`);
  ok("  ^ the month/year figures stay pre-tax (the page adds \"plus 13% tax\")", taxed.yearly === 594);

  const annual = offerPricing({ pricePerVisit: 110, discountPct: 10, taxRatePct: null, frequency: "annual", visitCount: 1 });
  ok("one annual visit: $99 a year, $8.25 a month", annual.yearly === 99 && annual.monthly === 8.25);

  // Hostile terms reaching the arithmetic directly: never negative, never NaN.
  for (const bad of [
    { pricePerVisit: "abc", discountPct: 10 },
    { pricePerVisit: -50, discountPct: 10 },
    { pricePerVisit: 100, discountPct: 150 },
    { pricePerVisit: 100, discountPct: -20 },
    { pricePerVisit: NaN, discountPct: NaN },
    { pricePerVisit: Infinity, discountPct: 0 },
  ]) {
    const p = offerPricing({ ...bad, taxRatePct: null, frequency: "monthly", visitCount: 12 });
    const nums = [p.perVisit.subtotal, p.perVisit.total, p.monthly ?? 0, p.yearly ?? 0];
    ok(`hostile terms ${JSON.stringify(bad)} price to a finite, non-negative figure`, nums.every((n) => Number.isFinite(n) && n >= 0), nums.join(","));
  }
  const over = offerPricing({ pricePerVisit: 100, discountPct: 150, taxRatePct: null, frequency: "monthly", visitCount: null });
  ok("a discount over 100% bills nothing rather than a credit", over.perVisit.subtotal === 0 && over.yearly === null);
  ok("an unknown cadence states no year", offerPricing({ pricePerVisit: 100, discountPct: 0, frequency: "fortnightly", visitCount: null }).yearly === null);

  ok("quoteTaxRatePct recovers 13% from the quote's own figures", quoteTaxRatePct({ taxEnabled: true, subtotal: 1000, discount: 0, tax: 130 }) === 13);
  ok("  ^ tax switched off → null (no tax on the plan), not 0", quoteTaxRatePct({ taxEnabled: false, subtotal: 1000, tax: 130 }) === null);
  ok("  ^ a $0 quote → null rather than a divide-by-zero", quoteTaxRatePct({ taxEnabled: true, subtotal: 0, tax: 0 }) === null);
}

// ─────────────────────────────────────────────────────────────────────────
console.log("\n2. Template input — hostile values refused, not stored");

{
  const base = { name: { en: "Quarterly" }, frequency: "quarterly", visitCount: 4, pricePerVisit: 165, discountPct: 10 };
  ok("a sound template validates", validateTemplateInput(base).ok);
  for (const [label, patch] of [
    ["no name", { name: {} }],
    ["name in a non-document language only", { name: { zh: "季度" } }],
    ["name as a string, not a map", { name: "Quarterly" }],
    ["cadence 'fortnightly'", { frequency: "fortnightly" }],
    ["visitCount 0", { visitCount: 0 }],
    ["visitCount 1.5", { visitCount: 1.5 }],
    ["visitCount 521", { visitCount: 521 }],
    ["price 0", { pricePerVisit: 0 }],
    ["price -10", { pricePerVisit: -10 }],
    ["price 'abc'", { pricePerVisit: "abc" }],
    ["price 2,000,000", { pricePerVisit: 2_000_000 }],
    ["discount 100", { discountPct: 100 }],
    ["discount -1", { discountPct: -1 }],
    ["discount 'lots'", { discountPct: "lots" }],
  ]) {
    const r = validateTemplateInput({ ...base, ...patch });
    ok(`refused: ${label}`, !r.ok && typeof r.error === "string" && r.error.length > 10, r.ok ? "accepted!" : "");
  }
  const blank = validateTemplateInput({ ...base, pricePerVisit: "", visitCount: "" });
  ok("blank price → null (unpriced), blank visits → null (until cancelled)", blank.ok && blank.template.pricePerVisit === null && blank.template.visitCount === null);
  const cents = validateTemplateInput({ ...base, pricePerVisit: "99.999" });
  ok("price stored to the cent", cents.ok && cents.template.pricePerVisit === 100, String(cents.template?.pricePerVisit));

  const polluted = cleanLanguageMap(JSON.parse('{"en":"A","__proto__":{"x":1},"fr":42,"xx":"no","es":"  B  "}'));
  ok("language map keeps only document languages with real text", JSON.stringify(polluted) === '{"en":"A","es":"B"}', JSON.stringify(polluted));
  ok("  ^ and does not pollute Object.prototype", ({}).x === undefined);

  const prods = validateTemplateInput({ ...base, includedProductIds: ["mine", "theirs", 7, { id: "mine" }, "mine"] }, { productIds: new Set(["mine"]) });
  ok("included services: only this company's ids survive, once", JSON.stringify(prods.template.includedProductIds) === '["mine"]');
  const noSet = validateTemplateInput({ ...base, includedProductIds: ["mine"] });
  ok("  ^ with no verified set, nothing survives", noSet.template.includedProductIds.length === 0);

  ok("textIn: the quote's language first", textIn({ en: "A", fr: "B" }, "fr", "en") === "B");
  ok("  ^ then the company's own words — never a translation", textIn({ en: "A", fr: "B" }, "tl", "fr") === "B");
  ok("  ^ then any language there is", textIn({ de: "C" }, "tl", "en") === "C");
  ok("  ^ and '' for nothing", textIn(null, "en") === "");
}

// ─────────────────────────────────────────────────────────────────────────
console.log("\n3. Freezing a template onto a quote");

const TEMPLATE = {
  id: "tpl_1",
  active: true,
  name: { en: "Quarterly Deep Clean", fr: "Grand ménage trimestriel" },
  description: { en: "4 deep cleans\nPriority" },
  categoryId: "cat_clean",
  includedProductIds: ["p1", "p2", "p_other_company"],
  frequency: "quarterly",
  visitCount: 4,
  pricePerVisit: 165,
  discountPct: 10,
};
const PRODUCTS = [
  { id: "p1", name: "Routine clean", translations: { fr: { name: "Ménage régulier" } } },
  { id: "p2", name: "Inside fridge", translations: null },
];
const NOW = UTC("2026-09-24");

{
  const fr = offerFromTemplate(TEMPLATE, { language: "fr", companyLanguage: "en", products: PRODUCTS, mode: "optional", taxRatePct: 14.975, now: NOW });
  ok("offer frozen in the quote's language", fr.ok && fr.offer.name === "Grand ménage trimestriel");
  ok("  ^ description falls back to the company's own words (no French written)", fr.offer.description === "4 deep cleans\nPriority");
  ok("  ^ included services by name, translated where the company holds one", fr.offer.serviceName === "Ménage régulier, Inside fridge", fr.offer.serviceName);
  ok("  ^ a product id the company does not own contributes nothing", !fr.offer.serviceName.includes("other"));
  ok("  ^ price and discount copied from the TEMPLATE row", fr.offer.pricePerVisit === 165 && fr.offer.discountPct === 10);
  ok("  ^ tax kept to 3 places", fr.offer.taxRatePct === 14.975);

  const bare = offerFromTemplate({ ...TEMPLATE, includedProductIds: [] }, { language: "en", now: NOW });
  ok("no services named → the plan's name is what is sold", bare.offer.serviceName === "Quarterly Deep Clean");

  for (const [label, t, opts] of [
    ["a retired template", { ...TEMPLATE, active: false }, {}],
    ["an unpriced template", { ...TEMPLATE, pricePerVisit: null }, {}],
    ["a template priced 0", { ...TEMPLATE, pricePerVisit: 0 }, {}],
    ["a corrupt cadence", { ...TEMPLATE, frequency: "sometimes" }, {}],
    ["mode 'free'", TEMPLATE, { mode: "free" }],
    ["a first visit in the past", TEMPLATE, { startDate: "2026-09-01" }],
    ["a first visit that isn't a date", TEMPLATE, { startDate: "tomorrow" }],
    ["tax 101%", TEMPLATE, { taxRatePct: 101 }],
    ["tax 'x'", TEMPLATE, { taxRatePct: "x" }],
    ["no template", null, {}],
  ]) {
    const r = offerFromTemplate(t, { language: "en", mode: "included", now: NOW, ...opts });
    ok(`refused: ${label}`, !r.ok && typeof r.error === "string", r.ok ? "accepted!" : "");
  }
  const today = offerFromTemplate(TEMPLATE, { language: "en", mode: "included", startDate: "2026-09-24", now: NOW });
  ok("a first visit today is allowed", today.ok && iso(today.offer.startDate) === "2026-09-24");
}

// ─────────────────────────────────────────────────────────────────────────
console.log("\n4. The approval takes ids only");

{
  const offers = [
    { id: "inc", mode: "included" },
    { id: "opt_a", mode: "optional" },
    { id: "opt_b", mode: "optional" },
  ];
  const ids = (list) => list.map((o) => o.id).sort().join(",");
  ok("nothing ticked → only the included plan", ids(offersTaken(offers, [])) === "inc");
  ok("ticked optional ids are taken", ids(offersTaken(offers, ["opt_b"])) === "inc,opt_b");
  ok("an id from another quote takes nothing", ids(offersTaken(offers, ["someone_elses"])) === "inc");
  ok("objects carrying a price are ignored, not read",
    ids(offersTaken(offers, [{ id: "opt_a", pricePerVisit: 0.01 }, { amount: 1 }])) === "inc");
  ok("a non-array body takes only the included plan", ids(offersTaken(offers, "opt_a,opt_b")) === "inc");
  ok("duplicates don't double a plan", offersTaken(offers, ["opt_a", "opt_a"]).length === 2);
  ok("an included plan's id need not be posted", ids(offersTaken(offers, undefined)) === "inc");

  // The route itself: it reads ids, prices nothing from the body, and keeps
  // plans out of the one-time total.
  const route = read("app/api/public/quotes/[token]/route.js");
  const post = route.slice(route.indexOf("export async function POST"));
  ok("the approval route reads body.planOfferIds", /offersTaken\(quote\.planOffers, body\?\.planOfferIds\)/.test(post));
  ok("  ^ and no plan figure from the body", !/body\?*\.(pricePerVisit|discountPct|taxRatePct|monthly|yearly|perVisit)/.test(post));
  ok("  ^ plans are not passed to priceWithAddOns (not in the one-time total)", !/priceWithAddOns\([^)]*plan/i.test(post));
  ok("  ^ the signature hash covers the plans taken", /planOffers: plansTaken\.map/.test(post));
  ok("  ^ only optional offers of THIS quote are marked selected", /where: \{ id: \{ in: optionalTaken \}, quoteId: quote\.id \}/.test(post));
  ok("  ^ and before onQuoteAccepted runs", post.indexOf("optionalTaken.length") < post.indexOf("onQuoteAccepted(updated.id"));
  const presentBlock = route.slice(route.indexOf("function publicPlanOffer"), route.indexOf("function present("));
  ok("the public projection sends no template, company or plan id", !/templateId|companyId|servicePlanId/.test(presentBlock.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\*.*$/gm, "")));
  const page = read("app/q/[token]/QuoteApproval.js");
  ok("the client page posts planOfferIds and no plan figure", /planOfferIds: decision === "accepted" \? pickedPlans : \[\]/.test(page) && !/perVisit:|pricePerVisit:/.test(page.slice(page.indexOf("jsonBody({"), page.indexOf('}, "approval")'))));
}

// ─────────────────────────────────────────────────────────────────────────
console.log("\n5. First visit and the ServicePlan an offer becomes");

{
  const accepted = UTC("2026-09-24");
  ok("no stated date → one cadence step after approval (quarterly → Dec 24)", iso(planStartDate({ frequency: "quarterly" }, accepted)) === "2026-12-24");
  ok("a stated future date is kept", iso(planStartDate({ frequency: "quarterly", startDate: UTC("2026-10-15") }, accepted)) === "2026-10-15");
  ok("a stated date that passed while the quote waited → the default, not a back-bill", iso(planStartDate({ frequency: "monthly", startDate: UTC("2026-09-01") }, accepted)) === "2026-10-24");
  ok("a stated date ON the approval day → the default (no same-night invoice)", iso(planStartDate({ frequency: "monthly", startDate: accepted }, accepted)) === "2026-10-24");
  ok("Jan 31 monthly → Feb 28, clamped by the schedule module", iso(planStartDate({ frequency: "monthly" }, UTC("2027-01-31"))) === "2027-02-28");
  ok("an approval late in the UTC day still counts the calendar day", iso(planStartDate({ frequency: "weekly" }, new Date("2026-09-24T23:59:00Z"))) === "2026-10-01");
  ok("an unknown cadence has no start (so no plan)", planStartDate({ frequency: "sometimes" }, accepted) === null);

  const offer = { name: "Quarterly Deep Clean", serviceName: "Routine clean", categoryId: null, frequency: "quarterly", visitCount: 4, startDate: null, pricePerVisit: "165.00", discountPct: "10.000", taxRatePct: null, language: "fr" };
  const input = planInputFromOffer(offer, { clientId: "client_1", acceptedAt: accepted });
  ok("an offer becomes a plan the hand-made form would accept", input.ok, input.error || "");
  ok("  ^ invoice per visit — no automatic charge is invented", input.plan.collectionMode === "invoice");
  ok("  ^ 4 visits → endMode count, occurrenceCount 4", input.plan.endMode === "count" && input.plan.occurrenceCount === 4);
  ok("  ^ price, discount and tax from the frozen offer", input.plan.amountPerOccurrence === 165 && input.plan.discountPct === 10 && input.plan.taxRatePct === null);
  ok("  ^ the plan keeps the quote's language", input.plan.language === "fr");
  ok("  ^ first visit Dec 24", iso(input.plan.startDate) === "2026-12-24");
  const openPlan = planInputFromOffer({ ...offer, visitCount: null }, { clientId: "c", acceptedAt: accepted });
  ok("until cancelled → endMode open", openPlan.ok && openPlan.plan.endMode === "open" && openPlan.plan.occurrenceCount === null);
  for (const [label, patch] of [
    ["price -5", { pricePerVisit: "-5" }],
    ["discount 100", { discountPct: 100 }],
    ["no name", { name: "" }],
    ["cadence 'daily'", { frequency: "daily" }],
    ["tax 500", { taxRatePct: 500 }],
  ]) {
    const r = planInputFromOffer({ ...offer, ...patch }, { clientId: "c", acceptedAt: accepted });
    ok(`a corrupted offer (${label}) creates no plan`, !r.ok);
  }
}

// ─────────────────────────────────────────────────────────────────────────
console.log("\n6. Approval → plan: once, whatever calls it");

function fakeDb(quote) {
  const state = { plans: [], offers: quote.planOffers.map((o) => ({ ...o })) };
  let seq = 0;
  const db = {
    state,
    quote: {
      findUnique: async () => ({ ...quote, planOffers: state.offers.map((o) => ({ ...o })) }),
    },
    // A transaction whose creates only land if the callback returns — the
    // rollback that makes a lost claim harmless.
    $transaction: async (fn) => {
      const pending = [];
      const tx = {
        servicePlan: {
          create: async ({ data }) => {
            const row = { id: `sp_${++seq}`, ...data };
            pending.push(row);
            return { id: row.id };
          },
        },
        quotePlanOffer: {
          updateMany: async ({ where, data }) => {
            await new Promise((r) => setTimeout(r, 0)); // let a rival interleave
            const o = state.offers.find((x) => x.id === where.id && x.servicePlanId === where.servicePlanId);
            if (!o) return { count: 0 };
            o.servicePlanId = data.servicePlanId;
            return { count: 1 };
          },
        },
      };
      const result = await fn(tx);
      state.plans.push(...pending);
      return result;
    },
  };
  return db;
}

const OFFER = (id, patch = {}) => ({
  id, companyId: "co_1", mode: "included", selected: false, servicePlanId: null,
  name: "Plan " + id, serviceName: "Service", categoryId: null, frequency: "quarterly",
  visitCount: 4, startDate: null, pricePerVisit: 165, discountPct: 10, taxRatePct: 13, language: "en", sortOrder: 0,
  ...patch,
});

{
  const quote = {
    id: "q1", companyId: "co_1", clientId: "cl_1", status: "accepted", acceptedAt: UTC("2026-09-24"),
    planOffers: [
      OFFER("inc"),
      OFFER("opt_yes", { mode: "optional", selected: true }),
      OFFER("opt_no", { mode: "optional", selected: false }),
      OFFER("foreign", { companyId: "co_2" }),
      OFFER("corrupt", { pricePerVisit: -1 }),
    ],
  };
  const db = fakeDb(quote);
  const first = await ensureServicePlansForQuote("q1", { db });
  ok("included + ticked optional → two plans", db.state.plans.length === 2 && first.created.length === 2, JSON.stringify(first.created));
  ok("  ^ the unticked optional plan created nothing", first.skipped.some((s) => s.offerId === "opt_no" && s.reason === "not_chosen"));
  ok("  ^ another company's offer created nothing", first.skipped.some((s) => s.offerId === "foreign" && s.reason === "wrong_company"));
  ok("  ^ a corrupted offer created nothing", first.skipped.some((s) => s.offerId === "corrupt" && s.reason === "invalid"));
  ok("  ^ every plan is under the quote's company and client", db.state.plans.every((p) => p.companyId === "co_1" && p.clientId === "cl_1"));
  ok("  ^ billed per visit at the frozen figures", db.state.plans.every((p) => p.collectionMode === "invoice" && p.amountPerOccurrence === 165 && p.discountPct === 10 && p.taxRatePct === 13));
  ok("  ^ first visit from the APPROVAL date, not the run date", db.state.plans.every((p) => iso(p.startDate) === "2026-12-24"));

  const again = await ensureServicePlansForQuote("q1", { db, now: UTC("2027-03-01") });
  ok("a retry creates nothing more", db.state.plans.length === 2 && again.created.length === 0);

  const db2 = fakeDb({ ...quote, planOffers: [OFFER("race")] });
  const [a, b] = await Promise.all([
    ensureServicePlansForQuote("q1", { db: db2 }),
    ensureServicePlansForQuote("q1", { db: db2 }),
  ]);
  ok("two concurrent approvals make ONE plan", db2.state.plans.length === 1, String(db2.state.plans.length));
  ok("  ^ the loser says so", [...a.skipped, ...b.skipped].some((s) => s.reason === "claimed_elsewhere"));

  const db3 = fakeDb({ ...quote, status: "sent" });
  await ensureServicePlansForQuote("q1", { db: db3 });
  ok("a quote that is not accepted creates nothing", db3.state.plans.length === 0);
  const db4 = fakeDb({ ...quote, status: "declined" });
  await ensureServicePlansForQuote("q1", { db: db4 });
  ok("a declined quote creates nothing", db4.state.plans.length === 0);

  const broken = { quote: { findUnique: async () => { throw new Error("P1001"); } } };
  const r = await ensureServicePlansForQuote("q1", { db: broken });
  ok("a database error never throws into the approval", r.created.length === 0);

  const lifecycle = read("lib/quotes/quoteLifecycle.js");
  ok("onQuoteAccepted — the door BOTH approvals take — creates the plans", /await ensureServicePlansForQuote\(quoteId, \{ createdById \}\)/.test(lifecycle));
}

// ─────────────────────────────────────────────────────────────────────────
console.log("\n7. Starter plans");

{
  const keys = new Set();
  for (const s of PLAN_TEMPLATE_SEEDS) {
    const langsName = PLAN_TEMPLATE_LANGUAGES.filter((l) => typeof s.name[l] === "string" && s.name[l].trim());
    const langsDesc = PLAN_TEMPLATE_LANGUAGES.filter((l) => typeof s.description?.[l] === "string" && s.description[l].trim());
    const lines = PLAN_TEMPLATE_LANGUAGES.map((l) => (s.description?.[l] || "").split("\n").length);
    const v = validateTemplateInput({ name: s.name, description: s.description, frequency: s.frequency, visitCount: s.visitCount, pricePerVisit: s.usd, discountPct: s.discountPct });
    const good = langsName.length === 8 && langsDesc.length === 8 && new Set(lines).size === 1 && v.ok && !keys.has(s.seedKey) && s.trades.length > 0;
    keys.add(s.seedKey);
    ok(`${s.seedKey}: 8 languages, same benefit count in each, valid terms`, good, good ? "" : `${langsName.length}/${langsDesc.length} ${lines.join("")} ${v.error || ""}`);
  }

  // HCP's figures, re-expressed per visit: within 3% of the yearly price.
  const hcp = {
    "fq.plan.cleaning.quarterly_deep": 599,
    "fq.plan.cleaning.monthly_maintenance": 1499,
    "fq.plan.carpet.seasonal": 199,
    "fq.plan.carpet.quarterly_refresh": 349,
    "fq.plan.window.seasonal": 199,
    "fq.plan.window.quarterly_exterior": 349,
    "fq.plan.plumbing.maintenance": 99,
    "fq.plan.plumbing.care": 199,
    "fq.plan.plumbing.total_care": 299,
  };
  for (const [key, yearly] of Object.entries(hcp)) {
    const s = PLAN_TEMPLATE_SEEDS.find((x) => x.seedKey === key);
    const p = offerPricing({ pricePerVisit: s.usd, discountPct: s.discountPct, frequency: s.frequency, visitCount: s.visitCount });
    const drift = Math.abs(p.yearly - yearly) / yearly;
    ok(`${key} works out to ${p.yearly}/yr against HCP's ${yearly}`, drift <= 0.03, `${(drift * 100).toFixed(1)}%`);
  }

  for (const trade of ["residential_cleaning", "carpet_cleaning", "window_cleaning", "hvac_repair", "hvac_install", "plumbing", "lawn_care", "pest_control", "pool_spa", "gutter_services", "chimney_sweep"]) {
    ok(`${trade} has starter plans`, planTemplateSeedsForTrade(trade).length > 0);
  }
  ok("a painting company gets none", planTemplateSeedsForTrade("interior_painting").length === 0);
  ok("an unknown trade gets none", planTemplateSeedsForTrade("__proto__").length === 0 && planTemplateSeedsForTrade(undefined).length === 0);

  const seed = PLAN_TEMPLATE_SEEDS.find((x) => x.seedKey === "fq.plan.hvac.comfort_club");
  const usd = templateDataForPlanSeed(seed, { companyId: "c", currency: "USD", productIdsBySeedKey: { "fq.hvac_repair.maintenance.ac_tune_up": "prod_ac" } });
  ok("USD: the seed's figure as written", usd.pricePerVisit === 129);
  ok("  ^ included service linked only where the company holds it", JSON.stringify(usd.includedProductIds) === '["prod_ac"]');
  const cad = templateDataForPlanSeed(seed, { companyId: "c", currency: "CAD" });
  ok("CAD: converted and rounded to $5 (129 × 1.37 → 175)", cad.pricePerVisit === 175, String(cad.pricePerVisit));
  const eur = templateDataForPlanSeed(seed, { companyId: "c", currency: "EUR" });
  ok("EUR: no price at all — never a dollar figure in euros", eur.pricePerVisit === null);
  ok("  ^ and such a template cannot be put on a quote", !offerFromTemplate({ ...eur, id: "x", active: true }, { now: NOW }).ok);
}

// ─────────────────────────────────────────────────────────────────────────
console.log("\n8. Client-facing words in eight languages");

{
  const shape = (o, prefix = "") =>
    Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? shape(v, `${prefix}${k}.`) : [`${prefix}${k}:${typeof v}`])).sort();
  const en = shape(PLAN_OFFER_COPY.en);
  for (const lang of PLAN_TEMPLATE_LANGUAGES) {
    const c = PLAN_OFFER_COPY[lang];
    ok(`${lang}: every sentence the page and the invoice use`, c && JSON.stringify(shape(c)) === JSON.stringify(en));
    const rendered = [
      c.perVisit("$1"), c.discountEvery("15%"), c.youSave("$2"), c.plusTax("13%"), c.visits(1), c.visits(2), c.visits(5), c.visits(11), c.visits(22),
      c.worksOut("$3", "$4"), c.termTotal(3, "$5"), c.firstVisitOn("1 Oct"), c.invoiceNote("15%", "$6"),
      ...Object.values(c.freq), ...Object.values(c.firstVisitAfter),
    ].join(" ");
    ok(`  ^ ${lang} renders no undefined`, !/undefined|NaN|\[object/.test(rendered));
    ok(`  ^ ${lang} has a first-visit sentence for every cadence`, Object.keys(VISITS_PER_YEAR).every((f) => typeof c.firstVisitAfter[f] === "string" && typeof c.freq[f] === "string"));
  }
  ok("Ukrainian counts visits with the right plural", PLAN_OFFER_COPY.uk.visits(1) === "1 візит" && PLAN_OFFER_COPY.uk.visits(3) === "3 візити" && PLAN_OFFER_COPY.uk.visits(12) === "12 візитів" && PLAN_OFFER_COPY.uk.visits(22) === "22 візити");
  ok("an unknown language falls back to English", planOfferCopy("zz") === PLAN_OFFER_COPY.en);

  const amounts = occurrenceAmounts({ amountPerOccurrence: 165, discountPct: 10, taxRatePct: null });
  const noteFr = planDiscountNote({ language: "fr", discountPct: "10.000" }, { currency: "CAD" }, amounts);
  ok("the invoice note is in the plan's language and currency (fr, CAD)", /10\s?%/.test(noteFr) && /16,50\s?\$/.test(noteFr) && noteFr.startsWith("Forfait d'entretien"), noteFr);
  const noteDe = planDiscountNote({ language: "de", discountPct: 10 }, { currency: "EUR" }, amounts);
  ok("  ^ (de, EUR)", /16,50\s?€/.test(noteDe) && noteDe.startsWith("Wartungsplan"), noteDe);
  const noteEn = planDiscountNote({ language: "en", discountPct: 15 }, { currency: null }, occurrenceAmounts({ amountPerOccurrence: 145, discountPct: 15 }));
  ok("  ^ a company with no currency set still formats", /\$21\.75/.test(noteEn), noteEn);
  const run = read("lib/servicePlans/run.js");
  ok("the note is written only when the visit carries a discount", /amounts\.discountCents > 0 \? \{ notes: planDiscountNote/.test(run));
}

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures) {
  console.error(`${failures} FAILED`);
  process.exit(1);
}
