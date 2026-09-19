// scripts/check-instant-quote-draft.mjs
//
//   npm run check:instant-quote-draft
//
// The three defects reported from a real run of the public instant-quote
// flow (app/instant-quote/[companySlug]/InstantQuoteFlow.js and its API
// routes), EXECUTED against a scripted db rather than read:
//
//   1. TAX      createEstimateDraft used to write NEITHER `tax` NOR
//               `taxEnabled` — not "resolved to $0", genuinely never
//               attempted. Every auto-estimated draft entered review already
//               wrong. Asserted here: a client whose jurisdiction the company
//               can price gets a real tax figure; a client it can't gets an
//               HONEST `unresolved` state (lib/tax/documentTax.js), never a
//               silent, settled-looking $0.00.
//
//   2. COSTING  the instant path created a Quote with no QuoteCosting row at
//               all, so a contractor typed the cost panel by hand on every
//               single one. Asserted here: the SAME server module the normal
//               builder saves through (buildQuoteCostingRow) is called, and a
//               row is PERSISTED only when it has a real basis — a trade
//               whose measurement translates to genuine labour hours and
//               materials gets a real row; a trade with no honest
//               translation gets none, rather than a misleading
//               overhead-only "costed" row that would bypass costBasisMissing
//               (see the comment on deriveQuoteCosting).
//
//   3. ASSIGNEE createEstimateDraft never set Quote.assignedToId at all — the
//               column didn't exist. Asserted here: an instant-quote draft
//               (nobody signed in) lands with assignedToId null AND
//               needsReview true — the honest "leave it for review" state,
//               not an invented default.
//
// Plus the two non-negotiables every change here has to keep true:
//
//   #4  the public routes never destructure a money field off the request
//       (static, scoped to the exact two route files this task touched —
//       check:public-payload already sweeps every public route generically;
//       this is the narrow, request-specific confirmation).
//   #5  the pricing functions ignore money-shaped keys smuggled into their
//       input and always reprice from the company's own saved config —
//       proved by actually running them against a hostile payload, not by
//       reading the signature.
//
// ── Why createEstimateDraft rather than the route handlers themselves ──────
//
// app/api/instant-quote/[companySlug]/request/route.js also sends email,
// records a lead, and records consent — side effects this repo's other
// checks (check-call-refinishing.mjs) already established aren't worth
// re-plumbing through a fake NextRequest for. createEstimateDraft is the
// exact function both that route AND the phone-estimator path
// (lib/estimate/callEstimate.js) call to do the writing this defect is
// about, so executing it here tests the real shared code, not a copy of it.
//
//   node --import ./scripts/alias-loader.mjs \
//        --import ./scripts/db-stub-loader.mjs \
//        scripts/check-instant-quote-draft.mjs

import fs from "node:fs";
import { createEstimateDraft } from "@/lib/estimate/createEstimateQuote";
import { soloEstimatorFrom } from "@/lib/estimate/soloEstimator";
import { lineItemsFromBreakdown, breakdownForRecord } from "@/lib/estimate/estimateLines";
import { estimateCabinetRefinishing } from "@/lib/estimate/instantEstimate";
import { billedUnitsOf } from "@/lib/quotes/builderPayload";
import { measureForTrade, priceOneMaterial } from "@/lib/estimate/instantQuoteServer";
import { taxStatement } from "@/lib/tax/documentTax";
import { FALLBACK_LABOUR_RATE, FALLBACK_OVERHEAD_PCT } from "@/lib/costing/quoteCosting";
import { rows, writes, resetDbStub } from "@/lib/db";

let pass = 0;
let fail = 0;
const ok = (name, cond, got) => {
  if (cond) {
    pass++;
    console.log(`  ok   ${name}`);
  } else {
    fail++;
    console.log(`  FAIL ${name}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`);
  }
};
const section = (s) => console.log(`\n${s}\n`);

// The single write this whole file cares about — the Quote row
// createEstimateDraft actually asked Prisma to create. Read straight off
// `writes` rather than off `rows.quote` afterwards: the stub's generic
// `create` stores whatever `data` object was passed, nested relations (the
// `costing: { create: {...} }` block) included, which is exactly what needs
// inspecting and is NOT reconstructable from the flattened row.
function lastQuoteWrite() {
  for (let i = writes.length - 1; i >= 0; i -= 1) {
    if (writes[i].model === "quote" && writes[i].action === "create") return writes[i].data;
  }
  return null;
}

/* ═══════════════════════ fixtures ═══════════════════════════════════════ */

const CABINET_CATEGORY = { id: "cat_cabinet_refinishing", key: "cabinet_refinishing" };
const EPOXY_CATEGORY = { id: "cat_epoxy", key: "epoxy" };

// A cabinet-refinishing estimate shaped the way priceOneMaterial actually
// returns one — breakdown, point/low/high — so the draft's line items and
// subtotal are the real thing, not a stand-in.
function cabinetEstimate(point) {
  return {
    low: Math.round(point * 0.85),
    point,
    high: Math.round(point * 1.15),
    unit: null,
    breakdown: [
      { label: "32 doors, 3 drawer fronts", amount: point },
    ],
    assumptions: [],
  };
}

const BASE_CONTACT = { name: "Jordan Lee", email: null, phone: "6135550100" };

/* ═══════════════════ 1. TAX — known vs unknown jurisdiction ══════════════ */

section("Tax is resolved server-side, never left unattempted");

// Known: the company has switched on "match the client's province" and typed
// a real rate for Ontario — exactly Settings → Tax, the same rate
// resolveDocumentTax reads for every other document.
{
  resetDbStub();
  rows.serviceCategory = [CABINET_CATEGORY];
  const company = {
    id: "co_known",
    taxRate: 0,
    autoApplyLocalTax: true,
    taxRates: [{ name: "HST Ontario", rate: 13 }],
    country: "CA",
    province: "ON",
    defaultLanguage: "en",
  };

  const draft = await createEstimateDraft({
    // Required and deliberately not defaulted — see the parameter's own
    // comment. This file exercises the public instant estimator.
    createdVia: "instant_quote",
    company,
    trade: "cabinet_refinishing",
    categoryId: CABINET_CATEGORY.id,
    contact: { ...BASE_CONTACT, email: "known@test.example" },
    measurement: { doorCount: 32, drawerCount: 3, complexityLevel: "standard" },
    materialKey: null,
    estimate: cabinetEstimate(5250),
    source: "manual",
    city: "Ottawa",
    province: "ON",
    country: "CA",
    language: "en",
  });
  ok("a draft is created", Boolean(draft?.id));

  const data = lastQuoteWrite();
  ok("tax is a real, non-zero figure", Number(data?.tax) > 0, data?.tax);
  ok("…specifically 13% of the subtotal", Number(data?.tax) === 682.5, data?.tax);
  ok("taxEnabled is on — nobody switched it off", data?.taxEnabled === true);
  ok(
    "total is subtotal + tax, not the bare subtotal",
    Number(data?.total) === Number(data?.subtotal) + Number(data?.tax),
    { total: data?.total, subtotal: data?.subtotal, tax: data?.tax },
  );

  const statement = taxStatement({
    taxEnabled: data.taxEnabled,
    tax: data.tax,
    company,
    taxRates: company.taxRates,
    client: { province: "ON", country: "CA" },
  });
  ok("…and the document's own tax line reads it as CHARGED, not unresolved", statement.kind === "charged", statement.kind);
}

// Unknown: nobody typed an address the autocomplete could structure, and the
// company has never set a default rate either — the exact production state
// the header comment on lib/tax/documentTax.js describes (29 companies with
// taxRate sitting at its untouched default of 0).
{
  resetDbStub();
  rows.serviceCategory = [CABINET_CATEGORY];
  const company = {
    id: "co_unknown",
    taxRate: 0,
    autoApplyLocalTax: true,
    taxRates: [],
    country: null,
    province: null,
    defaultLanguage: "en",
  };

  const draft = await createEstimateDraft({
    // Required and deliberately not defaulted — see the parameter's own
    // comment. This file exercises the public instant estimator.
    createdVia: "instant_quote",
    company,
    trade: "cabinet_refinishing",
    categoryId: CABINET_CATEGORY.id,
    contact: { ...BASE_CONTACT, email: "unknown@test.example" },
    measurement: { doorCount: 32, drawerCount: 3, complexityLevel: "standard" },
    materialKey: null,
    estimate: cabinetEstimate(5250),
    source: "manual",
    // No city/province/country — the homeowner typed the address by hand.
    language: "en",
  });
  ok("a draft is still created — an unresolved rate is not a refusal", Boolean(draft?.id));

  const data = lastQuoteWrite();
  ok("tax charges nothing it cannot stand behind", Number(data?.tax) === 0, data?.tax);
  ok("taxEnabled stays on — this is not the sender declining tax", data?.taxEnabled === true);

  const statement = taxStatement({
    taxEnabled: data.taxEnabled,
    tax: data.tax,
    company,
    taxRates: company.taxRates,
    client: { province: null, country: null },
  });
  ok(
    "…and the document's own tax line says UNRESOLVED — never a settled-looking $0.00",
    statement.kind === "unresolved",
    statement.kind,
  );
}

/* ═══════════════ 2. COSTING — real basis vs no honest basis ══════════════ */

section("A costing row is attached from the SAME module the builder saves through");

const NO_TAX_CO = {
  id: "co_costing",
  taxRate: 0,
  autoApplyLocalTax: false,
  taxRates: [],
  country: null,
  province: null,
  defaultLanguage: "en",
};

// A trade this file's own adapter (lib/estimate/instantQuoteCosting.js) can
// honestly translate — doorCount/drawerCount are exactly what
// cabinetRunLabour and estimateCabinetUnit already read by another name.
{
  resetDbStub();
  rows.serviceCategory = [CABINET_CATEGORY];

  await createEstimateDraft({
    // Required and deliberately not defaulted — see the parameter's own
    // comment. This file exercises the public instant estimator.
    createdVia: "instant_quote",
    company: NO_TAX_CO,
    trade: "cabinet_refinishing",
    categoryId: CABINET_CATEGORY.id,
    contact: { ...BASE_CONTACT, email: "costed@test.example" },
    measurement: { doorCount: 32, drawerCount: 3, complexityLevel: "standard" },
    materialKey: null,
    estimate: cabinetEstimate(5250),
    source: "manual",
    language: "en",
  });

  const data = lastQuoteWrite();
  const row = data?.costing?.create;
  ok("a QuoteCosting row is actually attached", Boolean(row));
  ok("…with real labour hours, not zero", Number(row?.labourHours) > 0, row?.labourHours);
  ok("…and a real material total, not zero", Number(row?.materialTotal) > 0, row?.materialTotal);
  ok(
    "…priced against this draft's own subtotal, frozen",
    Number(row?.price) === 5250,
    row?.price,
  );

  // ── The hours are COSTED, on the builder's own assumptions ──────────────
  //
  // Owner, on the demo accounts: "the estimate reviews doesn't seem to have
  // the same costing and labour being applied". They didn't. This call passed
  // `costing: {}`, normaliseQuoteCosting reads an absent rate as 0, and the
  // row persisted 71.76 real hours at $0.00 — labour cost nothing, overhead
  // 0%, a margin fattened by the whole wage bill, and "0" in the rate box
  // when the editor opened it. A hand-built quote opens at
  // FALLBACK_LABOUR_RATE / FALLBACK_OVERHEAD_PCT (QuoteBuilder.js) and the
  // derive-on-read path recomputes on the same two, so the instant path must
  // land on them as well. Executed, not read: the rate has to reach the row.
  ok(
    "…the labour rate is the builder's fallback, not 0",
    Number(row?.labourRate) === FALLBACK_LABOUR_RATE,
    row?.labourRate,
  );
  ok(
    "…so the labour COST is hours × that rate, not $0",
    Math.abs(Number(row?.labourCost) - Number(row?.labourHours) * FALLBACK_LABOUR_RATE) < 0.011,
    `${row?.labourCost} vs ${row?.labourHours} × ${FALLBACK_LABOUR_RATE}`,
  );
  ok(
    "…and overhead is the builder's fallback percentage, not 0",
    Number(row?.overheadPct) === FALLBACK_OVERHEAD_PCT,
    row?.overheadPct,
  );
  ok(
    "…no crew is invented for a job nobody has been assigned to",
    Array.isArray(row?.crew) && row.crew.length === 0,
    row?.crew,
  );
}

// A trade with no honest translation. Writing a zero-basis row here would be
// WORSE than writing none — GET /api/quotes/[id]/costing trusts a saved row
// unconditionally (see lib/costing/quoteCostEstimate.js), so a basis-free
// "costed" row would present an overhead-only margin as settled fact. The
// recompute fallback on read already labels that state costBasisMissing;
// this asserts the create path doesn't short-circuit past it.
{
  resetDbStub();
  rows.serviceCategory = [EPOXY_CATEGORY];

  await createEstimateDraft({
    // Required and deliberately not defaulted — see the parameter's own
    // comment. This file exercises the public instant estimator.
    createdVia: "instant_quote",
    company: NO_TAX_CO,
    trade: "epoxy",
    categoryId: EPOXY_CATEGORY.id,
    contact: { ...BASE_CONTACT, email: "uncosted@test.example" },
    measurement: { squareFootage: 500, surfaceCondition: "good" },
    materialKey: null,
    estimate: cabinetEstimate(4000),
    source: "manual",
    language: "en",
  });

  const data = lastQuoteWrite();
  ok(
    "no misleading zero-basis row is written for a trade with nothing honest to translate",
    data?.costing === undefined,
    data?.costing,
  );
}

/* ═══════════════ 3. ASSIGNEE — the hand-built quote's own default ════════ */

section("The assignee defaults the way a hand-built quote's does: the one person who could have written it, or nobody");

// Several people can write quotes: nobody is guessed. The review queue's
// "assign to me" is where a human decides.
{
  resetDbStub();
  rows.serviceCategory = [CABINET_CATEGORY];
  rows.member = [
    { id: "m1", companyId: NO_TAX_CO.id, userId: "u_owner", role: "owner", active: true },
    { id: "m2", companyId: NO_TAX_CO.id, userId: "u_estimator", role: "employee", active: true },
  ];

  await createEstimateDraft({
    // Required and deliberately not defaulted — see the parameter's own
    // comment. This file exercises the public instant estimator.
    createdVia: "instant_quote",
    company: NO_TAX_CO,
    trade: "cabinet_refinishing",
    categoryId: CABINET_CATEGORY.id,
    contact: { ...BASE_CONTACT, email: "unassigned@test.example" },
    measurement: { doorCount: 32, drawerCount: 3 },
    materialKey: null,
    estimate: cabinetEstimate(5250),
    source: "manual",
    language: "en",
  });

  const data = lastQuoteWrite();
  ok("with two estimators, assignedToId is null — never a guess between them", data?.assignedToId === null, data?.assignedToId);
  ok(
    "needsReview is true — the one flag that carries this into the review queue",
    data?.needsReview === true,
    data?.needsReview,
  );
}

// A one-person shop: the only member who can write quotes IS the estimator —
// Q-2026-0003's company (one owner) opened its draft on "Unassigned" for no
// reason anyone could act on. A deactivated second member does not count;
// neither would a role without quote:create (none exists today — every role
// holds it — so the deactivated case is the one that can actually happen).
{
  resetDbStub();
  rows.serviceCategory = [CABINET_CATEGORY];
  rows.member = [
    { id: "m1", companyId: NO_TAX_CO.id, userId: "u_owner", role: "owner", active: true },
    { id: "m2", companyId: NO_TAX_CO.id, userId: "u_gone", role: "employee", active: false },
  ];

  await createEstimateDraft({
    createdVia: "instant_quote",
    company: NO_TAX_CO,
    trade: "cabinet_refinishing",
    categoryId: CABINET_CATEGORY.id,
    contact: { ...BASE_CONTACT, email: "solo@test.example" },
    measurement: { doorCount: 32, drawerCount: 3 },
    materialKey: null,
    estimate: cabinetEstimate(5250),
    source: "manual",
    language: "en",
  });

  const data = lastQuoteWrite();
  ok("a solo company's draft is assigned to its one estimator", data?.assignedToId === "u_owner", data?.assignedToId);
  ok("…and still needs review — assignment is not approval", data?.needsReview === true, data?.needsReview);
  ok("createdById stays null — a form created it, not a person", data?.createdById === undefined || data?.createdById === null, data?.createdById);
}

// The pure rule, executed on its own edges.
ok("soloEstimatorFrom: one active owner → that owner", soloEstimatorFrom([{ userId: "a", role: "owner", active: true }]) === "a");
ok("soloEstimatorFrom: two who can write quotes → null", soloEstimatorFrom([{ userId: "a", role: "owner" }, { userId: "b", role: "supervisor" }]) === null);
ok("soloEstimatorFrom: nobody → null, never invented", soloEstimatorFrom([]) === null);
ok("soloEstimatorFrom: an inactive second member does not split the decision", soloEstimatorFrom([{ userId: "a", role: "admin", active: true }, { userId: "b", role: "employee", active: false }]) === "a");

/* ═══════ 6. LOOK AND FEEL — the draft's lines are the builder's lines ═══ */
//
// Q-2026-0003 opened with "25 doors refinished ×1 @ $4,750" and "10 drawer
// fronts ×1 @ $1,900": flat one-liners a hand-built quote of the same kitchen
// never shows — that one reads "Cabinet Refinishing — doors × 25 @ $190" with
// the complexity meta the quote page explains a price with. Executed: the
// estimator's own output, through the mapping the draft stores, into the
// helper the editor counts billed faces with.

section("An instant cabinet draft stores the same line shape a hand-built one does");

{
  const config = { perDoor: 190, perDrawer: 190, complexityUpchargePerUnit: { standard: 0, moderate: 20, high: 40 }, minCharge: 0, rangeBandPct: 0.15 };
  const est = estimateCabinetRefinishing({ doorCount: 25, drawerCount: 10, complexityLevel: "standard" }, config);
  ok("the estimator still prices the kitchen", est.ok && est.point === 6650, est.point);
  const lines = lineItemsFromBreakdown(est.breakdown, { label: "Cabinet Refinishing" });
  const doors = lines[0];
  const drawers = lines[1];
  ok("the doors line is the builder's: '<service> — doors'", doors?.description === "Cabinet Refinishing — doors", doors?.description);
  ok("…counted, not a one-liner: 25 doors at the per-door rate", doors?.quantity === 25 && doors?.unit === "door" && doors?.rate === 190 && doors?.amount === 4750, doors);
  ok("…the drawer fronts likewise", drawers?.quantity === 10 && drawers?.unit === "drawer" && drawers?.rate === 190 && drawers?.amount === 1900, drawers);
  ok("…each carrying the reasons meta the quote page and the review read", doors?.meta?.complexityLevel === "standard" && doors?.meta?.baseUnitPrice === 190 && Array.isArray(doors?.meta?.complexityReasons), doors?.meta);
  ok("the editor's billed-faces reminder counts both lines", billedUnitsOf({ lineItems: lines }) === 35, billedUnitsOf({ lineItems: lines }));
  const record = breakdownForRecord(est.breakdown);
  ok("what the homeowner saw stays label + amount, with no builder line on it", record.every((b) => !("line" in b) && b.label && Number.isFinite(b.amount)), record);
  ok("…and the label is still the sentence the public page printed", record[0]?.label === "25 doors refinished", record[0]?.label);

  // A moderate kitchen: the uplift rides on the rate and is named in the meta.
  const mod = estimateCabinetRefinishing({ doorCount: 10, drawerCount: 0, complexityLevel: "moderate" }, config);
  const modLine = lineItemsFromBreakdown(mod.breakdown, { label: "Cabinet Refinishing" })[0];
  ok("a moderate kitchen's rate is base + uplift, and the meta says which", modLine?.rate === 210 && modLine?.meta?.baseUnitPrice === 190 && modLine?.meta?.complexityUpcharge === 20 && modLine?.meta?.complexityLevel === "moderate", modLine);

  // An entry with no `line` (every non-cabinet trade today) is the flat line
  // it always was — the change is additive.
  const flat = lineItemsFromBreakdown([{ label: "24 squares of asphalt shingle", amount: 9600 }]);
  ok("a breakdown entry without a line stays the flat line it was", flat[0]?.description === "24 squares of asphalt shingle" && flat[0]?.quantity === 1 && flat[0]?.rate === 9600 && flat[0]?.amount === 9600, flat[0]);
}

// Through the draft itself: the stored scope group carries those lines.
{
  resetDbStub();
  rows.serviceCategory = [{ ...CABINET_CATEGORY, label: "Cabinet Refinishing" }];
  const config = { perDoor: 190, perDrawer: 190, complexityUpchargePerUnit: { standard: 0 }, minCharge: 0, rangeBandPct: 0.15 };
  const est = estimateCabinetRefinishing({ doorCount: 25, drawerCount: 10 }, config);
  await createEstimateDraft({
    createdVia: "instant_quote",
    company: NO_TAX_CO,
    trade: "cabinet_refinishing",
    categoryId: CABINET_CATEGORY.id,
    contact: { ...BASE_CONTACT, email: "shape@test.example" },
    measurement: { doorCount: 25, drawerCount: 10 },
    materialKey: null,
    estimate: est,
    source: "manual",
    language: "en",
  });
  const data = lastQuoteWrite();
  const group = data?.scopeGroups?.create?.[0];
  ok("the scope group's first line is the counted doors line", group?.lineItems?.[0]?.quantity === 25 && group?.lineItems?.[0]?.unit === "door", group?.lineItems?.[0]);
  ok("…and the quote's own lineItems mirror the group's", JSON.stringify(data?.lineItems) === JSON.stringify(group?.lineItems));
  ok("estimateData.breakdown is the homeowner's record, line-free", (data?.estimateData?.breakdown || []).every((b) => !("line" in b)));
  ok("the group's intake still carries the counts the cost panel reads", group?.intakeValues?.doorCount === 25 && group?.intakeValues?.drawerCount === 10, group?.intakeValues);
}

// The one visible difference an instant draft is allowed: the banner.
{
  const builder = fs.readFileSync("app/components/quotes/builder/QuoteBuilder.js", "utf8");
  ok("the edit builder shows the auto-estimated banner on a draft, and only there", /isEdit && start\.quote\?\.autoEstimated && start\.status === "draft"/.test(builder) && /data-auto-estimated-banner/.test(builder));
  ok("…and says why the assignee is empty when it is", /!start\.assignedTo && <p>\{t\("app\.quoteEdit\.autoEstimatedUnassigned"\)\}/.test(builder));
  const { APP_MESSAGES } = await import("@/app/i18n/appMessages.js");
  for (const key of ["app.quoteEdit.autoEstimatedTitle", "app.quoteEdit.autoEstimatedBody", "app.quoteEdit.autoEstimatedUnassigned"]) {
    const missing = Object.keys(APP_MESSAGES).filter((l) => !APP_MESSAGES[l][key]);
    ok(`${key} exists in every app language`, missing.length === 0, missing);
  }
}

/* ═══════ 7. ADDRESS — the client this creates carries what a hand-added one does ═ */
//
// Q-2026-0003's client: "5th Ave, New York, NY, USA" with city, province and
// country — and no postal code, because Google's formatted line had none and
// the one it returned as a component was never stored. The funnel now posts
// the postal code and the county; the draft stores them on the client the way
// app/api/clients does for a hand-added one.

section("The instant funnel's client carries the same address components as a hand-added client");

{
  resetDbStub();
  rows.serviceCategory = [CABINET_CATEGORY];
  await createEstimateDraft({
    createdVia: "instant_quote",
    company: NO_TAX_CO,
    trade: "cabinet_refinishing",
    categoryId: CABINET_CATEGORY.id,
    contact: { ...BASE_CONTACT, email: "address@test.example" },
    measurement: { doorCount: 12, drawerCount: 4 },
    materialKey: null,
    estimate: cabinetEstimate(3000),
    source: "manual",
    address: "5th Ave, New York, NY, USA",
    city: "New York",
    province: "NY",
    country: "US",
    postalCode: "10001",
    county: "New York County",
    language: "en",
  });
  const clientWrite = writes.find((w) => w.model === "client" && w.action === "create")?.data;
  ok("the client row carries the postal code Google returned", clientWrite?.postalCode === "10001", clientWrite);
  ok("…and the county (administrative_area_level_2)", clientWrite?.county === "New York County", clientWrite?.county);
  ok("…beside the city, province and country it already carried", clientWrite?.city === "New York" && clientWrite?.province === "NY" && clientWrite?.country === "US", clientWrite);

  resetDbStub();
  rows.serviceCategory = [CABINET_CATEGORY];
  await createEstimateDraft({
    createdVia: "instant_quote",
    company: NO_TAX_CO,
    trade: "cabinet_refinishing",
    categoryId: CABINET_CATEGORY.id,
    contact: { ...BASE_CONTACT, email: "typed@test.example" },
    measurement: { doorCount: 12, drawerCount: 4 },
    materialKey: null,
    estimate: cabinetEstimate(3000),
    source: "manual",
    address: "somewhere typed by hand",
    postalCode: "   ",
    county: 42,
    language: "en",
  });
  const typed = writes.find((w) => w.model === "client" && w.action === "create")?.data;
  ok("a typed address stores null, never '' and never a non-string", typed?.postalCode === null && typed?.county === null, typed);

  const flow = fs.readFileSync("app/instant-quote/[companySlug]/InstantQuoteFlow.js", "utf8");
  ok("the public form posts the postal code and county it got from the pick", /const \{ city, province, country, postalCode, county \} = siteJurisdiction;/.test(flow) && /county: place\.county \|\| ""/.test(flow));
  const route = fs.readFileSync("app/api/instant-quote/[companySlug]/request/route.js", "utf8");
  ok("…and the request route hands both to the draft", /postalCode: typeof postalCode === "string" \? postalCode : null/.test(route) && /county: typeof county === "string" \? county : null/.test(route));
  const clientsRoute = fs.readFileSync("app/api/clients/route.js", "utf8");
  ok("the hand-added client stores the same two through the same cleaner", /postalCode: cleanAddressPart\(postalCode\)/.test(clientsRoute) && /county: cleanAddressPart\(county\)/.test(clientsRoute));
  const schema = fs.readFileSync("prisma/schema.prisma", "utf8");
  const clientModel = schema.split("model Client {")[1]?.split("\n}")[0] || "";
  ok("Client has the two columns", /\n\s+postalCode\s+String\?/.test(clientModel) && /\n\s+county\s+String\?/.test(clientModel));
}

/* ═════════ #5 — pricing functions ignore money smuggled into intake ══════ */

section("The pricing functions reprice from company config, never from the browser (#5)");

{
  // A hostile intake: real fields alongside money-shaped ones a tampered or
  // merely creative client might send.
  const clean = await measureForTrade("cabinet_refinishing", {
    intake: { doorCount: 10, drawerCount: 2 },
  });
  const hostile = await measureForTrade("cabinet_refinishing", {
    intake: { doorCount: 10, drawerCount: 2, price: 999999, total: 1, rate: 50, cost: 0.01 },
  });
  ok("measureForTrade succeeds on the real fields", clean.ok && hostile.ok);
  ok(
    "…and the smuggled money keys never reach the measurement it returns",
    !("price" in hostile.measurement) &&
      !("total" in hostile.measurement) &&
      !("rate" in hostile.measurement) &&
      !("cost" in hostile.measurement),
    hostile.measurement,
  );
  ok(
    "…so the two measurements are identical regardless of what else was in the intake",
    JSON.stringify(clean.measurement) === JSON.stringify(hostile.measurement),
    { clean: clean.measurement, hostile: hostile.measurement },
  );
}

// The gate this repo already runs generically across every public route
// (check:public-payload) confirmed for the two files this task actually
// touched, by name, so a regression here fails a check whose title says what
// broke rather than one that only says "some public route, somewhere".
section("The two instant-quote routes never destructure a money field off the request (#4/#5)");

const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const MONEY_KEYS = ["price", "total", "subtotal", "tax", "rate", "cost", "amount"];

for (const file of [
  "app/api/instant-quote/[companySlug]/measure/route.js",
  "app/api/instant-quote/[companySlug]/request/route.js",
]) {
  let src;
  try {
    src = strip(fs.readFileSync(file, "utf8"));
  } catch (err) {
    ok(`${file} exists`, false, err.message);
    continue;
  }
  const bodyDestructure = src.match(/const\s*\{([^}]*)\}\s*=\s*body/);
  const namedFields = bodyDestructure ? bodyDestructure[1].split(",").map((s) => s.trim().split(":")[0].trim()) : [];
  const leaked = MONEY_KEYS.filter((k) => namedFields.includes(k));
  ok(`${file} reads no money field off the request body`, leaked.length === 0, leaked);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
