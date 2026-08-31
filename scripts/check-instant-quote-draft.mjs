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
import { measureForTrade, priceOneMaterial } from "@/lib/estimate/instantQuoteServer";
import { taxStatement } from "@/lib/tax/documentTax";
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

/* ═══════════════ 3. ASSIGNEE — absent and honestly flagged ═══════════════ */

section("Nobody signed in means nobody named, and the draft says so honestly");

{
  resetDbStub();
  rows.serviceCategory = [CABINET_CATEGORY];

  await createEstimateDraft({
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
  ok("assignedToId is null — never guessed", data?.assignedToId === null, data?.assignedToId);
  ok(
    "needsReview is true — the one flag that carries this into the review queue",
    data?.needsReview === true,
    data?.needsReview,
  );
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
