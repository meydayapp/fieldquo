// scripts/check-doc-builder.mjs
//
// The document-shaped quote builder (mockup b7) changes what the estimator
// SEES and nothing about what the server RECEIVES. This is where that is
// proved rather than asserted.
//
//   npm run check:doc-builder
//
// ── 1. Payload identity ─────────────────────────────────────────────────────
//
// The body QuoteBuilder posts left the component for lib/quotes/
// builderRequest.js so both layouts save through one function. Section 1
// runs a fixture quote through that function and through a TRANSCRIPT of
// the inline literal it replaced — commit f74a2d13, runSave, verbatim key
// order — and requires the two md5s to match, for a PATCH and for a POST.
// The hashes are printed so the report can carry them.
//
// ── 2. Section reuse ────────────────────────────────────────────────────────
//
// The editor's read view and the quote page draw the document from ONE set
// of sections (app/components/document/QuoteDocument.js). Section 2 reads
// the source: the builder imports the sections and holds no masthead or
// totals markup of its own; the quote page imports the same sections and
// its inline mirror is gone; the document layout never fetches /api/quotes
// (only runSave does).
//
// ── 3. Both layouts render ──────────────────────────────────────────────────
//
// Section 3 renders QuoteBuilderForm with `layout: "document"` and with
// `layout: "classic"` over the same fixtures check-takeoff-render uses — a
// blank create, a stored draft, a decided quote, junk in every Json column,
// a painting takeoff with rooms — and asserts each produces a document, no
// NaN, the cost drawer for a member who may cost and none for one who may
// not, and the same total in both layouts.
//
// Bundled through esbuild like check-takeoff-render (the components are
// JSX), so this file may use JSX too.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { quoteRequestBody } from "../lib/quotes/builderRequest.js";
import { QUOTE_BUILDER_LAYOUTS, resolveBuilderLayout } from "../lib/quotes/builderLayout.js";
import { QuoteBuilderForm, initialStateFromQuote } from "../app/components/quotes/builder/QuoteBuilder.js";
import { LanguageProvider } from "../app/providers/LanguageProvider.js";
import { PermissionProvider } from "../app/providers/PermissionProvider.js";
import { createTradeConfig } from "../lib/pricing/tradeScope.js";
import { APP_MESSAGES } from "../app/i18n/appMessages.js";

let pass = 0;
const fails = [];
const ok = (label, cond, detail) => {
  if (cond) pass += 1;
  else fails.push(`${label}${detail !== undefined ? ` — ${detail}` : ""}`);
};
const eq = (label, got, want) => ok(label, JSON.stringify(got) === JSON.stringify(want), `got ${JSON.stringify(got)}`);
const md5 = (o) => createHash("md5").update(JSON.stringify(o)).digest("hex");
// Bundled to a .cjs at the repo root, so paths resolve from cwd, not from
// import.meta (which esbuild leaves empty in a CommonJS bundle).
const src = (p) => readFileSync(join(process.cwd(), p), "utf8");

// ───────────────────────────────────────────────────────────────────────────
console.log("1. payload identity — builderRequest vs the inline literal it replaced (f74a2d13)");
// ───────────────────────────────────────────────────────────────────────────

/** runSave's PATCH literal at f74a2d13, transcribed. Do not "improve" it. */
function legacyPatch({ shared, canEditScope, groupsPayload, assignedToTouched, assignedToId, againstVersion, version }) {
  return {
    ...shared,
    ...(canEditScope ? { scopeGroups: groupsPayload } : {}),
    ...(assignedToTouched && { assignedToId: assignedToId || null }),
    ...((againstVersion ?? version) ? { expectedUpdatedAt: againstVersion ?? version } : {}),
  };
}
/** runSave's POST literal at f74a2d13, transcribed. */
function legacyPost({ shared, clientId, composeSeconds, groupsPayload, language, assignedToId }) {
  return {
    ...shared,
    clientId,
    composeSeconds,
    scopeGroups: groupsPayload,
    status: "draft",
    language,
    ...(assignedToId && { assignedToId }),
  };
}
/** The `shared` block at f74a2d13. */
function legacyShared(s) {
  return {
    subtotal: s.subtotal,
    discount: s.appliedDiscount,
    tax: s.tax,
    taxEnabled: s.taxEnabled,
    total: s.total,
    notes: s.notes,
    reviewNotes: s.reviewNotes,
    processNotes: s.processNotes,
    validUntil: s.validUntil || null,
    clientPhotos: s.clientPhotos,
    siteAddress: s.siteAddress.trim() || null,
    ...(s.costing !== undefined ? { costing: s.costing } : {}),
  };
}

const groupsPayload = [
  {
    id: "grp_1",
    categoryId: "cat_1",
    label: "Kitchen cabinets",
    intakeValues: { doorCount: 22, drawerCount: 8 },
    lineItems: [
      { description: "Kitchen cabinets", quantity: 30, unit: "unit", rate: 150, amount: 4500 },
      { description: "Disposal fee", quantity: 1, unit: "flat", rate: 120, amount: 120 },
    ],
    subtotal: 4620,
  },
];
const state = {
  subtotal: 4620,
  appliedDiscount: 120,
  tax: 585,
  taxEnabled: true,
  total: 5085,
  notes: "Side door only.",
  reviewNotes: "",
  processNotes: "50% on approval.",
  validUntil: "2026-10-21",
  clientPhotos: ["https://res.cloudinary.com/demo/a.jpg"],
  siteAddress: "  214 rue Principale, Laval QC  ",
  costing: { crew: [], addedLabourHours: 0, addedMaterialCost: 0, labourRate: 35, overheadPct: 12 },
};

const cases = [
  ["PATCH, open quote, assignee touched, guarded", { isEdit: true, canEditScope: true, assignedToTouched: true, assignedToId: "u_2", version: "2026-09-21T10:00:00.000Z", againstVersion: undefined }],
  ["PATCH, decided quote (no scopeGroups), unguarded", { isEdit: true, canEditScope: false, assignedToTouched: false, assignedToId: "", version: null, againstVersion: undefined }],
  ["PATCH, stale-write retry against the named version", { isEdit: true, canEditScope: true, assignedToTouched: false, assignedToId: "", version: "2026-09-21T10:00:00.000Z", againstVersion: "2026-09-21T10:05:00.000Z" }],
  ["PATCH, costing never loaded (block omitted)", { isEdit: true, canEditScope: true, assignedToTouched: false, assignedToId: "", version: null, againstVersion: undefined, costing: undefined }],
  ["POST, assignee picked", { isEdit: false, clientId: "c_1", composeSeconds: 412, language: "fr", assignedToId: "u_2" }],
  ["POST, unassigned, no expiry", { isEdit: false, clientId: "c_1", composeSeconds: null, language: "en", assignedToId: "", validUntil: "" }],
];
for (const [label, over] of cases) {
  const s = { ...state, ...over };
  const shared = legacyShared(s);
  const legacy = s.isEdit
    ? legacyPatch({ shared, canEditScope: s.canEditScope, groupsPayload, assignedToTouched: s.assignedToTouched, assignedToId: s.assignedToId, againstVersion: s.againstVersion, version: s.version })
    : legacyPost({ shared, clientId: s.clientId, composeSeconds: s.composeSeconds, groupsPayload, language: s.language, assignedToId: s.assignedToId });
  const now = quoteRequestBody({ ...s, groupsPayload, canEditScope: s.canEditScope });
  const a = md5(legacy);
  const b = md5(now);
  ok(`${label}: md5 identical`, a === b, `legacy ${a} now ${b}`);
  console.log(`  md5  ${label}: ${b}`);
}
// The keys, in order — the hash is only meaningful if the shape is the one
// the routes read (app/api/quotes/route.js, app/api/quotes/[id]/route.js).
eq(
  "PATCH key order",
  Object.keys(quoteRequestBody({ ...state, isEdit: true, groupsPayload, canEditScope: true, assignedToTouched: true, assignedToId: "u", version: "v" })),
  ["subtotal", "discount", "tax", "taxEnabled", "total", "notes", "reviewNotes", "processNotes", "validUntil", "clientPhotos", "siteAddress", "costing", "scopeGroups", "assignedToId", "expectedUpdatedAt"],
);
eq(
  "POST key order",
  Object.keys(quoteRequestBody({ ...state, isEdit: false, groupsPayload, clientId: "c", composeSeconds: 1, language: "en", assignedToId: "u" })),
  ["subtotal", "discount", "tax", "taxEnabled", "total", "notes", "reviewNotes", "processNotes", "validUntil", "clientPhotos", "siteAddress", "costing", "clientId", "composeSeconds", "scopeGroups", "status", "language", "assignedToId"],
);
// Non-negotiable #5, restated on the wire: the body carries the SCREEN's
// totals (which the server recomputes) and never a rate the server does not
// already hold — the cost block is inputs only.
const body = quoteRequestBody({ ...state, isEdit: true, groupsPayload, canEditScope: true, assignedToTouched: false, assignedToId: "", version: null });
eq("costing block is inputs only", Object.keys(body.costing), ["crew", "addedLabourHours", "addedMaterialCost", "labourRate", "overheadPct"]);
eq("siteAddress is trimmed, empty becomes null", quoteRequestBody({ ...state, isEdit: true, groupsPayload, canEditScope: true, siteAddress: "   " }).siteAddress, null);

// ───────────────────────────────────────────────────────────────────────────
console.log("2. section reuse — one document, two screens");
// ───────────────────────────────────────────────────────────────────────────
const builder = src("app/components/quotes/builder/DocumentBuilder.js");
const page = src("app/app/quotes/[id]/page.js");
const sections = src("app/components/document/QuoteDocument.js");
const quoteBuilder = src("app/components/quotes/builder/QuoteBuilder.js");

for (const name of ["DocumentFrame", "DocumentMasthead", "DocumentParties", "DocumentScopeGroup", "DocumentTotals"]) {
  ok(`QuoteDocument exports ${name}`, sections.includes(`export function ${name}(`));
  ok(`DocumentBuilder uses ${name}`, builder.includes(`<${name}`));
  ok(`the quote page uses ${name}`, page.includes(`<${name}`));
}
ok("the builder imports the sections from app/components/document", /from "@\/app\/components\/document\/QuoteDocument"/.test(builder));
ok("the quote page imports the sections from app/components/document", /from "@\/app\/components\/document\/QuoteDocument"/.test(page));
// The tells of a second copy: the brand rule, the total band, the masthead
// word. Each lives in QuoteDocument.js and nowhere else.
for (const [tell, why] of [
  ['className="flex h-1.5" aria-hidden="true"', "the brand rule"],
  ["rounded-xl bg-inverted text-inverted-foreground px-4 py-3 mt-2", "the total band"],
  ['className="px-5 sm:px-7 pt-5 pb-4 border-b border-border"', "the masthead"],
]) {
  ok(`${why} is drawn once, in QuoteDocument.js`, sections.includes(tell) && !builder.includes(tell) && !page.includes(tell));
}
ok("DocumentBuilder never fetches /api/quotes itself — only runSave does", !/fetch\(\s*[`"']\/api\/quotes/.test(builder));
ok("DocumentBuilder never builds a request body — it calls b.handleSave", !builder.includes("quoteRequestBody(") && builder.includes("b.handleSave("));
ok("QuoteBuilder saves through quoteRequestBody in both layouts", (quoteBuilder.match(/quoteRequestBody\(/g) || []).length === 1);
ok("QuoteBuilder hands the document layout the SAME group editor closure", builder.includes("b.renderGroupEditor(group)") && quoteBuilder.includes("{renderGroupEditor(group)}"));
ok("the cost panel is one closure in both layouts", builder.includes("b.renderCostMarginPanel()") && quoteBuilder.includes("{renderCostMarginPanel()}"));
ok("the layout is resolved by lib/quotes/builderLayout", quoteBuilder.includes("resolveBuilderLayout(boot.layout)"));
eq("the two layouts, by name", [...QUOTE_BUILDER_LAYOUTS], ["document", "classic"]);
eq("absent → classic (an older server, an older fixture)", resolveBuilderLayout(undefined), "classic");
eq("junk → classic", resolveBuilderLayout("modern"), "classic");
eq("document stays document", resolveBuilderLayout("document"), "document");
// The flag reaches the screen through business-info, and only the platform
// writes it.
ok("business-info GET selects quoteBuilderLayout", src("app/api/settings/business-info/route.js").includes("quoteBuilderLayout: true"));
ok("business-info PATCH never writes quoteBuilderLayout", !/quoteBuilderLayout\s*[,}]/.test(src("app/api/settings/business-info/route.js").split("export async function PATCH")[1] || ""));
ok("the platform PATCH validates against the closed list", src("app/api/platform/companies/[id]/route.js").includes("QUOTE_BUILDER_LAYOUTS.includes(quoteBuilderLayout)"));
ok("the platform company page offers the switch", src("app/platform/companies/[id]/CompanyDetail.js").includes("<CompanyBuilderLayout"));
ok("the schema defaults a NEW company to document", /quoteBuilderLayout\s+String\s+@default\("document"\)/.test(src("prisma/schema.prisma")));

// Every string the document layout shows is in the catalogue, in the nine
// languages — a key with a fallback in the code is still a key the FR and
// ES screens would print in English.
const keys = [...new Set([...builder.matchAll(/t\(\s*"(app\.[a-zA-Z0-9.]+)"/g)].map((m) => m[1]))];
for (const lang of Object.keys(APP_MESSAGES)) {
  const missing = keys.filter((k) => !(k in APP_MESSAGES[lang]));
  ok(`every DocumentBuilder key exists in ${lang}`, missing.length === 0, missing.join(", "));
}

// ───────────────────────────────────────────────────────────────────────────
console.log("3. both layouts render the fixture quotes");
// ───────────────────────────────────────────────────────────────────────────
const BOOTSTRAP = {
  clients: [{ id: "c1", name: "Alice", email: "a@example.com", address: "1 Main St" }],
  categories: [
    { id: "cat1", key: "stairs", label: "Stairs", enabled: true, unit: "flat", defaultRate: 0 },
    { id: "cat2", key: "cabinet_refinishing", label: "Cabinets", enabled: true },
    { id: "cat3", key: "interior_painting", label: "Interior painting", enabled: true },
  ],
  products: [{ id: "p1", name: "Rush fee", unitPrice: 200, unit: "flat", categories: [] }],
  workers: [{ id: "w1", name: "Sam", hourlyRate: 32 }],
  members: [{ userId: "u1", active: true, user: { id: "u1", name: "Sam" } }],
  recipeOverrides: {},
  companyLanguage: "en",
  companyCurrency: "CAD",
  defaultProcessNotes: "We start within two weeks.",
  taxConfig: { taxRate: 13, autoApplyLocalTax: false, taxRates: [], country: "CA", province: "ON" },
  overheadPerJob: 240,
  overheadSource: { monthlyFixedCosts: 4800, jobsPerMonth: 20 },
  company: {
    name: "Boréal Peinture", address: "1420 boul. Curé-Labelle, Laval QC", phone: "+1 450 555 0180",
    email: "info@example.com", brandColor: "#1d4ed8", country: "CA", paymentMethods: ["e_transfer"], offlinePaymentDiscount: true,
  },
};

const STORED_QUOTE = {
  id: "q1",
  quoteNumber: "Q-2026-0007",
  status: "draft",
  client: { id: "c1", name: "Alice", email: "a@example.com", address: "1 Main St" },
  language: "fr",
  subtotal: 4970,
  discount: 500,
  tax: 581.1,
  total: 5051.1,
  taxEnabled: true,
  validUntil: "2026-09-30T00:00:00.000Z",
  createdAt: "2026-09-01T00:00:00.000Z",
  notes: "Side door only.",
  processNotes: "50% on approval.",
  clientPhotos: [],
  company: { currency: "CAD" },
  importedGroupIds: ["g2"],
  siteAddress: "9 Site Rd",
  offlineDiscountPct: 3,
  addOns: [
    { id: "a1", description: "Living room — Ceiling", amount: 227.43, source: "takeoff", areaLabel: "Living room" },
    { id: "a2", description: "Two-tone finish", amount: 600, source: "catalog", areaLabel: null },
  ],
  jobs: [],
  scopeGroups: [
    {
      id: "g1",
      categoryId: "cat1",
      category: { key: "stairs", label: "Stairs" },
      label: "Main staircase",
      takeoff: createTradeConfig("stairs"),
      lineItems: [
        { description: "Treads", quantity: 13, rate: 260, amount: 3380 },
        { description: "Labour", quantity: 1, amount: 1470 },
        { description: "Exclusions", detail: "No **drywall** repair.", quantity: 1, rate: 0, amount: 0, kind: "text", priceMode: "none", hiddenOnWorkOrder: true },
      ],
      subtotal: 4850,
    },
    {
      id: "g2",
      categoryId: "cat1",
      category: { key: "stairs", label: "Stairs" },
      label: "Subcontracted railing",
      lineItems: [{ description: "Railing", quantity: 1, amount: 120 }],
      subtotal: 120,
    },
  ],
};

// A painting takeoff with two rooms and an option, added THIS session (so
// the document draws rooms rather than stored lines).
const PAINT_GROUP = {
  tempId: "paint-1",
  id: null,
  persisted: false,
  imported: false,
  categoryId: "cat3",
  categoryKey: "interior_painting",
  label: "Interior painting",
  isTiered: false,
  selectedTier: null,
  intakeValues: {},
  lineItems: [],
  takeoff: {
    model: "area_substrate",
    estimateType: "interior",
    areas: [
      {
        areaType: "living", label: "Living room", surface: "interior", measurement: "area",
        lengthFt: 15, widthFt: 16, heightFt: 8, prepHours: 0, optional: false,
        substrates: [
          { key: "walls", label: "Walls", coats: 2, quantity: null, driver: "wallSqft", productKey: "wall_interior" },
          { key: "baseboard", label: "Baseboard", coats: 2, quantity: null, driver: "linearFt", productKey: "trim_enamel" },
          { key: "ceiling", label: "Ceiling", coats: 2, quantity: null, driver: "ceilingSqft", productKey: "ceiling_flat", optional: true },
        ],
      },
      {
        areaType: "hallway", label: "Hallway", surface: "interior", measurement: "area",
        lengthFt: 4, widthFt: 12, heightFt: 8, prepHours: 0, optional: false,
        substrates: [{ key: "walls", label: "Walls", coats: 2, quantity: null, driver: "wallSqft", productKey: "wall_interior" }],
      },
    ],
  },
};

const CASES = [
  ["create, nothing entered", "create", null, initialStateFromQuote(null)],
  ["create, a painting takeoff with rooms", "create", null, { ...initialStateFromQuote(null), client: BOOTSTRAP.clients[0], groups: [PAINT_GROUP] }],
  ["edit, a stored draft with a text block and stored offers", "edit", "q1", { ...initialStateFromQuote(STORED_QUOTE), quote: STORED_QUOTE, costingLoaded: true }],
  ["edit, an accepted quote (lines locked)", "edit", "q1", { ...initialStateFromQuote({ ...STORED_QUOTE, status: "accepted" }), quote: { ...STORED_QUOTE, status: "accepted", jobs: [{ id: "j1" }] } }],
  ["edit, no client on the row", "edit", "q1", initialStateFromQuote({ ...STORED_QUOTE, client: null })],
  ["edit, junk in every Json column", "edit", "q1", initialStateFromQuote({ ...STORED_QUOTE, clientPhotos: "nope", addOns: "nope", scopeGroups: [{ id: "g9", categoryId: null, category: null, lineItems: "nope", takeoff: 42 }, { id: "g8", categoryId: "cat1", category: { key: "unicorn" }, lineItems: [null, {}] }] })],
  ["edit, absent everything", "edit", "q1", initialStateFromQuote({ id: "q1", scopeGroups: null })],
];

function render(layout, mode, id, initial, { role = "owner", permissions = {}, lang = "en" } = {}) {
  return renderToStaticMarkup(
    <LanguageProvider initialLanguage={lang}>
      <PermissionProvider role={role} permissions={permissions}>
        <QuoteBuilderForm mode={mode} quoteId={id} bootstrap={{ ...BOOTSTRAP, layout }} initial={initial} />
      </PermissionProvider>
    </LanguageProvider>,
  );
}
const totalOf = (html) => {
  // The dock prints the total once per layout in the same markup.
  const m = html.match(/data-totals-figure[\s\S]*?tabular-nums leading-tight">([^<]+)</);
  return m ? m[1] : null;
};

for (const [label, mode, id, initial] of CASES) {
  let doc = "";
  let classic = "";
  try {
    doc = render("document", mode, id, initial);
    classic = render("classic", mode, id, initial);
  } catch (err) {
    fails.push(`render (${label}): ${err.message}`);
    continue;
  }
  ok(`document layout renders (${label})`, doc.includes('data-builder-layout="document"') && doc.includes("data-doc-editor"), `${doc.length} chars`);
  ok(`classic layout renders (${label})`, !classic.includes('data-builder-layout="document"') && classic.length > 200);
  ok(`no NaN in either (${label})`, !/NaN|undefined<\/span>/.test(doc) && !/NaN|undefined<\/span>/.test(classic));
  ok(`both layouts show the same total (${label})`, totalOf(doc) !== null && totalOf(doc) === totalOf(classic), `${totalOf(doc)} vs ${totalOf(classic)}`);
  ok(`the document has the four tabs (${label})`, ["estimate", "presentation", "workorder", "notes"].every((k) => doc.includes(`data-doc-tab="${k}"`)));
  ok(`the document draws the masthead, parties and totals (${label})`, doc.includes("data-doc-masthead") && doc.includes("data-doc-parties") && doc.includes("data-doc-totals"));
  ok(`nothing client-facing says FieldQuo (${label})`, !/FieldQuo/.test(doc.split("data-doc-editor")[1]?.split("</article>")[0] || ""));
}

// The painting fixture draws rooms with their prices and the option under
// the room it belongs to — the mockup's cards.
{
  const doc = render("document", "create", null, CASES[1][3]);
  ok("painting: rooms drawn as cards", (doc.match(/data-doc-room=/g) || []).length === 2);
  ok("painting: the ceiling option sits under its room", /data-doc-room="0"[\s\S]*?data-doc-option[\s\S]*?Ceiling/.test(doc));
  ok("painting: room dimensions on the card", doc.includes("15 × 16 × 8"));
  ok("painting: the room's lines carry their measurement, never a rate", /Walls<!-- --> — <!-- -->\d+ sqft/.test(doc) || /Walls — \d+ sqft/.test(doc.replace(/<!-- -->/g, "")));
  ok("painting: no hourly rate reaches the document", !/\/h\b|\/hr\b/.test(doc.split("data-doc-editor")[1].split("</article>")[0]));
}

// A stored draft: the text block prints its rich body, the stored offer
// with an areaLabel sits under the line it names, the offer with none at
// the foot, the e-transfer line is drawn from the frozen pct.
{
  const doc = render("document", "edit", "q1", CASES[2][3]);
  ok("stored: rich text block body is drawn", doc.includes("<strong>drywall</strong>"));
  ok("stored: the catalogue offer is at the foot", /data-doc-foot-options[\s\S]*Two-tone finish/.test(doc));
  ok("stored: the e-transfer / cheque line prints in the quote's language (fr)", /Payez par virement Interac/.test(doc));
  ok("stored: the job address prints", doc.includes("9 Site Rd"));
  ok("stored: the imported group cannot be edited", /Subcontracted railing[\s\S]*?importedLocked|Subcontracted railing/.test(doc) && !/Subcontracted railing[\s\S]{0,400}data-doc-group-toggle/.test(doc));
}

// The cost gate, both directions, in the document layout: the drawer's
// toggle is offered to a member who may cost and withheld from one who may
// not — and the panel itself is never inside the document.
{
  const may = render("document", "edit", "q1", CASES[2][3]);
  const mayNot = render("document", "edit", "q1", CASES[2][3], { role: "employee", permissions: { jobCosting: false } });
  ok("cost drawer toggle offered to someone who may cost", may.includes("data-cost-drawer-toggle"));
  ok("cost drawer toggle withheld from someone who may not", !mayNot.includes("data-cost-drawer-toggle"));
  ok("the cost panel is not inside the document article", !/data-doc-editor[\s\S]*?Overhead[\s\S]*?<\/article>/.test(may));
}

// The three languages the harness photographs: the tabs and the document
// words follow the reader's language / the document's language respectively.
for (const [lang, tab, prepared] of [["fr", "Devis", "Préparé pour"], ["es", "Presupuesto", "Preparado para"]]) {
  const doc = render("document", "edit", "q1", { ...CASES[2][3], language: lang }, { lang });
  ok(`${lang}: the document word follows the document's language`, doc.includes(prepared), `${prepared} not found`);
  ok(`${lang}: the tabs follow the reader's language`, doc.includes(APP_MESSAGES[lang]["app.docBuilder.tab.estimate"]));
  void tab;
}

// ───────────────────────────────────────────────────────────────────────────
if (fails.length) {
  console.error(`\n✗ doc builder: ${fails.length} failed, ${pass} passed`);
  for (const f of fails) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`\n✓ doc builder: ${pass} checks`);
