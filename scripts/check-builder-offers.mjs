// scripts/check-builder-offers.mjs
//
// "Often added with this" — the add-ons the quote builder offers while the
// quote is being written (lib/quotes/builderOffers.js, lib/quotes/
// suggestedAddOns.js), executed rather than read.
//
//   1. A click is a REFERENCE: hostile request bodies are cleaned to kind +
//      ids, and an amount smuggled in never reaches the row.
//   2. What is offered under which service, on a create and on an edit — and
//      nothing already on the quote.
//   3. The save route prices from its own rows: catalogue × this quote's
//      counts, history at the accepted median, no price → no row; another
//      tenant's category is never offered; the cap holds; duplicates skip.
//   4. A request that clicked nothing is byte-identical to origin/main.
//   5. The wiring: the builder mounts the row, the routes call the writer
//      after the seed and not on a decided quote, the suggestions route is
//      gated, the review and the builder share one median.
//   6. The words exist in all nine app languages.
//
// Run: npm run check:builder-offers

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  OFFER_CAP,
  builderOfferRows,
  catalogueOfferFor,
  normaliseOfferRefs,
  offerKey,
} from "@/lib/quotes/builderOffers";
import { createOfferedAddOns } from "@/lib/quotes/suggestedAddOns";
import { categoryLabelIn } from "@/lib/ai/quoteSuggestions";
import { quoteRequestBody } from "@/lib/quotes/builderRequest";
import { scopeGroupPayload } from "@/lib/quotes/builderPayload";
import { APP_MESSAGES } from "@/app/i18n/appMessages.js";
import { fixtureGroups, fixtureRequests } from "./fixtures/builderPayloadFixtures.mjs";

let fail = 0;
let pass = 0;
const ok = (name, cond, detail = "") => {
  if (cond) pass += 1;
  else fail += 1;
  console.log(`${cond ? "  ok  " : "  FAIL"} ${name}${cond ? "" : `  ${detail}`}`);
};
const eq = (name, got, want) =>
  ok(name, JSON.stringify(got) === JSON.stringify(want), `got=${JSON.stringify(got)} want=${JSON.stringify(want)}`);
const section = (s) => console.log(`\n${s}\n`);
const md5 = (o) => createHash("md5").update(JSON.stringify(o)).digest("hex");
const read = (p) => readFileSync(p, "utf8");

// ── Fixtures ────────────────────────────────────────────────────────────────

const CAB = "cat_cab";
const PAINT = "cat_int";
const GUTTER = "cat_gutter";
const WASH = "cat_wash";

const PRODUCTS = [
  { id: "p_hinge", name: "Soft-Close Hinges", unit: "door", unitPrice: "35.00", active: true, categories: [{ id: CAB }] },
  { id: "p_two", name: "Two-tone finish", unit: "flat", unitPrice: 600, active: true, categories: [{ id: CAB }] },
  { id: "p_handle", name: "Handle holes", unit: "hole", unitPrice: 12, active: true, categories: [{ id: CAB }] }, // uncountable unit
  { id: "p_off", name: "Retired extra", unit: "flat", unitPrice: 99, active: false, categories: [{ id: CAB }] },
  { id: "p_free", name: "Free touch-up", unit: "flat", unitPrice: 0, active: true, categories: [{ id: CAB }] },
  { id: "p_ceiling", name: "Ceiling refresh", unit: "flat", unitPrice: 450, active: true, categories: [{ id: PAINT }] },
];

const GROUPS = [
  { tempId: "t1", categoryId: CAB, intakeValues: { doorCount: 22, drawerCount: 8 }, lineItems: [{ description: "Kitchen cabinets", amount: 4500 }] },
  { tempId: "t2", categoryId: PAINT, intakeValues: {}, lineItems: [{ description: "Walls — 2 coats", amount: 1840 }] },
];

const HISTORY = {
  [CAB]: [
    { categoryId: GUTTER, label: "Gutter cleaning", share: 40, amount: 340 },
    { categoryId: WASH, label: "Pressure washing", share: 25, amount: null }, // never accepted → no price
    { categoryId: PAINT, label: "Interior Painting", share: 60, amount: 2100 }, // already on the quote
  ],
  [PAINT]: [{ categoryId: GUTTER, label: "Gutter cleaning", share: 30, amount: 340 }], // same as under cabinets
};

// ───────────────────────────────────────────────────────────────────────────
section("1. A click is a reference — nothing about money survives the clean");
// ───────────────────────────────────────────────────────────────────────────

{
  const dirty = [
    { kind: "catalog", productId: "p_hinge", categoryId: CAB, amount: 1, description: "Free!" },
    { kind: "catalog", productId: "p_hinge", categoryId: CAB }, // duplicate
    { kind: "history", categoryId: GUTTER, amount: 0.01 },
    { kind: "history", categoryId: "" },
    { kind: "catalog", categoryId: CAB }, // no product
    { kind: "manual", description: "Anything", amount: 5000 },
    { kind: "history", categoryId: { $ne: null } },
    null,
    "history",
    42,
  ];
  eq("cleaned to kind + ids, deduplicated", normaliseOfferRefs(dirty), [
    { kind: "catalog", productId: "p_hinge", categoryId: CAB },
    { kind: "history", categoryId: GUTTER },
  ]);
  eq("junk body", normaliseOfferRefs({ offerAddOns: "x" }), []);
  const many = Array.from({ length: 20 }, (_, i) => ({ kind: "history", categoryId: `c${i}` }));
  eq(`never more than ${OFFER_CAP}`, normaliseOfferRefs(many).length, OFFER_CAP);
  eq("offer keys", [offerKey({ kind: "catalog", productId: "p", categoryId: "c" }), offerKey({ kind: "history", categoryId: "c" }), offerKey(null)], ["catalog:p:c", "history:c", ""]);
}

// ───────────────────────────────────────────────────────────────────────────
section("2. What each service offers — create, edit, and nothing already on the quote");
// ───────────────────────────────────────────────────────────────────────────

{
  const create = builderOfferRows({ groups: GROUPS, products: PRODUCTS, history: HISTORY, isEdit: false });
  const cab = create.byGroup.t1;
  eq(
    "create: the catalogue extras show as offered automatically (the seed writes them), priced at this quote's door count",
    cab.auto.map((a) => [a.description, a.amount]),
    [["Soft-Close Hinges (22 × door)", 770], ["Two-tone finish", 600]],
  );
  ok("create: …and are not buttons (un-clicked would do the same as clicked)", !cab.offers.some((o) => o.ref.kind === "catalog"));
  ok("create: an uncountable unit, an inactive product and a $0 product are not offered", !JSON.stringify(cab).match(/Handle holes|Retired extra|Free touch-up/));
  eq("create: the history suggestion with a price is a button", cab.offers.map((o) => [o.description, o.amount, o.share, o.ref.kind]), [["Gutter cleaning", 340, 40, "history"]]);
  ok("create: history with no accepted price is not offered", !JSON.stringify(cab).includes("Pressure washing"));
  ok("create: a service already on the quote is not suggested", !JSON.stringify(cab).includes("Interior Painting"));
  eq("create: the same suggestion under two services is offered once, under the first", create.byGroup.t2.offers.map((o) => o.description), []);
  eq("create: the painting service's catalogue extra shows automatically under it", create.byGroup.t2.auto.map((a) => a.description), ["Ceiling refresh"]);
  eq("create: room counts the seeded rows", create.room, OFFER_CAP - 3);
}

{
  const existing = [
    { description: "Two-tone finish", amount: 600, source: "catalog" },
    { description: "Living room — Ceiling", amount: 227.43, source: "takeoff" },
  ];
  const edit = builderOfferRows({ groups: GROUPS, products: PRODUCTS, history: HISTORY, existing, isEdit: true });
  const cab = edit.byGroup.t1;
  eq("edit: no automatic seed on an edit", cab.auto, []);
  eq(
    "edit: catalogue extras not already offered are buttons, priced at this quote's count",
    cab.offers.filter((o) => o.ref.kind === "catalog").map((o) => [o.description, o.amount, o.ref]),
    [["Soft-Close Hinges (22 × door)", 770, { kind: "catalog", productId: "p_hinge", categoryId: CAB }]],
  );
  ok("edit: an extra already offered is not offered again", !cab.offers.some((o) => o.description === "Two-tone finish"));
  eq("edit: takeoff rows do not count against the cap", edit.room, OFFER_CAP - 1);

  const billed = builderOfferRows({
    groups: [{ ...GROUPS[0], lineItems: [...GROUPS[0].lineItems, { description: "Soft-Close Hinges", amount: 770 }] }],
    products: PRODUCTS,
    history: {},
    isEdit: true,
  });
  ok("edit: an extra already billed as a LINE is not offered as an option too", !billed.byGroup.t1.offers.some((o) => /Soft-Close/.test(o.description)));

  const pending = [{ kind: "history", categoryId: GUTTER }];
  const withPending = builderOfferRows({ groups: GROUPS, products: PRODUCTS, history: HISTORY, existing, pending, isEdit: true });
  ok("a clicked offer shows as pending (so it can be taken back)", withPending.byGroup.t1.offers.find((o) => o.ref.kind === "history").pending === true);
  eq("…and uses a slot", withPending.room, OFFER_CAP - 2);

  const full = builderOfferRows({
    groups: GROUPS,
    products: PRODUCTS,
    history: HISTORY,
    existing: Array.from({ length: OFFER_CAP }, (_, i) => ({ description: `Row ${i}`, amount: 10, source: "manual" })),
    isEdit: true,
  });
  eq("a quote at the cap has no room", full.room, 0);

  const junk = builderOfferRows({ groups: "nope", products: null, history: 7, existing: "x", pending: {}, isEdit: true });
  eq("junk in, nothing out", junk, { byGroup: {}, used: 0, room: OFFER_CAP });
}

// ───────────────────────────────────────────────────────────────────────────
section("3. The save route prices from its own rows");
// ───────────────────────────────────────────────────────────────────────────

/** Just enough of Prisma for createOfferedAddOns, honouring the WHEREs it sends. */
function fakePrisma({ addOns = [], products = [], categories = [] } = {}) {
  const writes = [];
  return {
    writes,
    quoteAddOn: {
      findMany: async ({ where }) => addOns.filter((a) => a.quoteId === where.quoteId),
      createMany: async ({ data }) => {
        writes.push(...data);
        return { count: data.length };
      },
    },
    product: {
      findMany: async ({ where }) =>
        products.filter((p) => p.companyId === where.companyId && p.active === where.active && where.id.in.includes(p.id)),
    },
    serviceCategory: {
      findMany: async ({ where }) =>
        categories.filter(
          (c) => where.id.in.includes(c.id) && where.OR.some((o) => o.companyId === c.companyId),
        ),
    },
  };
}

const DB_PRODUCTS = PRODUCTS.map((p) => ({ ...p, companyId: "co_1", description: `${p.name} description` }));
const DB_CATEGORIES = [
  { id: GUTTER, companyId: null, label: "Gutter cleaning", labelTranslations: { fr: "Nettoyage de gouttières" } },
  { id: WASH, companyId: null, label: "Pressure washing", labelTranslations: null },
  { id: "cat_theirs", companyId: "co_other", label: "Another tenant's secret service", labelTranslations: null },
];
const medians = async (companyId, ids) => {
  if (companyId !== "co_1") throw new Error("median read for the wrong company");
  return Object.fromEntries(ids.filter((id) => id === GUTTER).map((id) => [id, { amount: 340, sampleSize: 9 }]));
};
const SAVED_GROUPS = [
  { categoryId: CAB, intakeValues: { doorCount: 22, drawerCount: 8 }, lineItems: [{ description: "Kitchen cabinets", amount: 4500 }] },
];

{
  const prisma = fakePrisma({ products: DB_PRODUCTS, categories: DB_CATEGORIES });
  const result = await createOfferedAddOns(prisma, {
    companyId: "co_1",
    quoteId: "q_1",
    refs: [
      { kind: "catalog", productId: "p_hinge", categoryId: CAB, amount: 1 },
      { kind: "history", categoryId: GUTTER, amount: 0.01 },
      { kind: "history", categoryId: WASH },
      { kind: "history", categoryId: "cat_theirs" },
      { kind: "catalog", productId: "p_handle", categoryId: CAB },
      { kind: "catalog", productId: "p_ceiling", categoryId: CAB }, // not linked to this service
    ],
    scopeGroups: SAVED_GROUPS,
    language: "fr",
    priceHistory: medians,
  });
  eq(
    "catalogue at the company's price × this quote's doors; history at the accepted median; smuggled amounts ignored",
    prisma.writes.map((w) => [w.description, w.amount, w.source]),
    [["Soft-Close Hinges (22 × door)", 770, "catalog"], ["Nettoyage de gouttières", 340, "history"]],
  );
  ok("the history row's trade name is in the QUOTE's language (a lookup, not a translation)", prisma.writes[1].description === "Nettoyage de gouttières");
  eq(
    "skipped, with reasons: no price, another tenant's service, an uncountable unit, an unlinked product",
    result.skipped.map((s) => `${s.ref.kind}:${s.ref.productId || s.ref.categoryId}:${s.reason}`),
    ["history:cat_wash:unpriced", "history:cat_theirs:unknown", "catalog:p_handle:unpriced", "catalog:p_ceiling:unknown"],
  );
  eq("rows sort after the seed's and the editor's", prisma.writes.map((w) => w.sortOrder), [150, 151]);
  ok("every row is taxable and on this quote", prisma.writes.every((w) => w.taxable === true && w.quoteId === "q_1"));
}

{
  // The seed already wrote the hinges on this create: the click is a duplicate.
  const prisma = fakePrisma({
    products: DB_PRODUCTS,
    categories: DB_CATEGORIES,
    addOns: [{ quoteId: "q_2", description: "Soft-Close Hinges (22 × door)", source: "catalog" }],
  });
  const r = await createOfferedAddOns(prisma, {
    companyId: "co_1",
    quoteId: "q_2",
    refs: [{ kind: "catalog", productId: "p_hinge", categoryId: CAB }],
    scopeGroups: SAVED_GROUPS,
    priceHistory: medians,
  });
  eq("a seeded extra is never written twice", [prisma.writes.length, r.skipped[0]?.reason], [0, "duplicate"]);
}

{
  // Seven offered already, three clicked: one fits.
  const prisma = fakePrisma({
    products: DB_PRODUCTS,
    categories: DB_CATEGORIES,
    addOns: [
      ...Array.from({ length: 7 }, (_, i) => ({ quoteId: "q_3", description: `Row ${i}`, source: "manual" })),
      { quoteId: "q_3", description: "Living room — Ceiling", source: "takeoff" },
    ],
  });
  const r = await createOfferedAddOns(prisma, {
    companyId: "co_1",
    quoteId: "q_3",
    refs: [
      { kind: "catalog", productId: "p_hinge", categoryId: CAB },
      { kind: "catalog", productId: "p_two", categoryId: CAB },
      { kind: "history", categoryId: GUTTER },
    ],
    scopeGroups: SAVED_GROUPS,
    priceHistory: medians,
  });
  eq("the cap of eight holds (takeoff rows excluded, as the PUT route counts them)", [prisma.writes.length, r.skipped.map((s) => s.reason)], [1, ["full", "full"]]);
}

{
  const prisma = fakePrisma();
  const r = await createOfferedAddOns(prisma, { companyId: "co_1", quoteId: "q_4", refs: "junk", scopeGroups: null });
  eq("junk refs write nothing and read nothing", [prisma.writes.length, r.created], [0, 0]);
  eq("categoryLabelIn falls back to the label", [categoryLabelIn({ label: "Gutters", labelTranslations: { fr: "Gouttières" } }, "es"), categoryLabelIn({ label: "Gutters", labelTranslations: { fr: "Gouttières" } }, "fr-CA"), categoryLabelIn(null, "fr")], ["Gutters", "Gouttières", ""]);
  eq("catalogueOfferFor junk", catalogueOfferFor({ product: null, group: null }), null);
}

// ───────────────────────────────────────────────────────────────────────────
section("4. A request that clicked nothing is the request it always was");
// ───────────────────────────────────────────────────────────────────────────

{
  // Recorded on origin/main 853639c9, before offerAddOns existed — the same
  // fixtures and values scripts/check-custom-factors.mjs holds.
  const BASE = {
    create: "9f94d62e8ed3bd6e63ca50ddea494ef8",
    edit: "c0d0d529d17ca87588fe86bd12829b09",
    decided: "5a03bda4995ae15e5726ec9652d312be",
  };
  const payloads = Object.values(fixtureGroups()).map((g) => scopeGroupPayload(g, null, "en"));
  const states = fixtureRequests(payloads);
  for (const [k, s] of Object.entries(states)) {
    eq(`${k}: no offers argument → baseline md5`, md5(quoteRequestBody(s)), BASE[k]);
    eq(`${k}: offerAddOns: [] → baseline md5`, md5(quoteRequestBody({ ...s, offerAddOns: [] })), BASE[k]);
  }
  const refs = [{ kind: "history", categoryId: GUTTER }];
  const created = quoteRequestBody({ ...states.create, offerAddOns: refs });
  eq("create with an offer: the references ride LAST", Object.keys(created).at(-1), "offerAddOns");
  eq(
    "…and nothing else moved",
    md5(Object.fromEntries(Object.entries(created).filter(([k]) => k !== "offerAddOns"))),
    BASE.create,
  );
  ok("edit with an offer carries it", quoteRequestBody({ ...states.edit, offerAddOns: refs }).offerAddOns?.length === 1);
  ok("a decided quote never carries one", !("offerAddOns" in quoteRequestBody({ ...states.decided, offerAddOns: refs })));
  ok("no amount in the request's references", !JSON.stringify(created.offerAddOns).includes("amount"));
}

// ───────────────────────────────────────────────────────────────────────────
section("5. The wiring");
// ───────────────────────────────────────────────────────────────────────────

{
  const qb = read("app/components/quotes/builder/QuoteBuilder.js");
  ok("the builder mounts the row inside the shared group editor (both layouts)", /<OftenAddedRow[\s\S]*?row=\{offerRows\.byGroup\[group\.tempId\]\}/.test(qb));
  ok("…fetches the suggestions per service, no model", /fetch\("\/api\/ai\/quote-suggestions"[\s\S]*?byCategory: true/.test(qb));
  ok("…sends only references, only the ones still on screen", /offerAddOns: livePendingOffers/.test(qb));
  ok("…and none on a decided quote", /const offerRows = canEditScope\s*\?/.test(qb));

  const post = read("app/api/quotes/route.js");
  const seedAt = post.indexOf("await seedCatalogueAddOns(db");
  const offerAt = post.indexOf("await createOfferedAddOns(db");
  ok("POST writes the offers AFTER the catalogue seed", seedAt > 0 && offerAt > seedAt);
  const patch = read("app/api/quotes/[id]/route.js");
  ok("PATCH writes them, and not on a decided quote", /updated\.status !== "accepted" &&\s*updated\.status !== "declined"[\s\S]*?createOfferedAddOns\(db/.test(patch));

  const route = read("app/api/ai/quote-suggestions/route.js");
  ok("the suggestions route needs quotes:view_create_edit for prices", /byCategory === true[\s\S]*?levelOrRefusal\(member, "quotes", "view_create_edit"/.test(route));
  ok("…and showPricing", /if \(!hasToggle\(full, "showPricing"\)\)/.test(route));

  const review = read("lib/ai/quoteReview.js");
  const sugg = read("lib/ai/quoteSuggestions.js");
  ok("the review and the builder share ONE median", /import \{ getSuggestedAddOns, typicalPriceByCategory \} from "\.\/quoteSuggestions"/.test(review) && !/async function typicalPriceByCategory/.test(review) && /export async function typicalPriceByCategory/.test(sugg));
  ok("the co-occurrence makes no model call", !/provider|complete\(|runToolLoop/.test(sugg));

  const put = read("app/api/quotes/[id]/add-ons/route.js");
  ok("the offered rows' sources survive the panel's PUT", /\["manual", "history", "ai", CATALOGUE_ADD_ON_SOURCE\]/.test(put));
  ok("route-callers no longer lists the suggestions route as unreached", !read("scripts/check-route-callers.mjs").includes('"/api/ai/quote-suggestions":'));
}

// ───────────────────────────────────────────────────────────────────────────
section("6. Nine languages");
// ───────────────────────────────────────────────────────────────────────────

{
  const used = new Set();
  for (const m of read("app/components/quotes/builder/OftenAddedRow.js").matchAll(/"(app\.oftenAdded\.[A-Za-z.]+)"/g)) used.add(m[1]);
  ok(`the row uses ${used.size} keys`, used.size >= 8);
  for (const lang of ["en", "fr", "es", "uk", "pa", "tl", "de", "zh", "it"]) {
    const missing = [...used].filter((k) => typeof APP_MESSAGES[lang]?.[k] !== "string" || !APP_MESSAGES[lang][k].trim());
    eq(`${lang}: every key present`, missing, []);
    const broken = [...used].filter((k) => {
      const want = (APP_MESSAGES.en[k].match(/\{\w+\}/g) || []).sort().join();
      const got = (String(APP_MESSAGES[lang]?.[k] || "").match(/\{\w+\}/g) || []).sort().join();
      return want !== got;
    });
    eq(`${lang}: placeholders intact`, broken, []);
  }
}

console.log(`\n${fail ? "✗" : "✓"} builder offers: ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
