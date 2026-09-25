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
import { paintingCategoryFor, paintingCategoriesOf } from "../app/components/quotes/builder/EstimateTypeFirst.js";
import { createFabHiddenOn } from "../app/components/layout/CreateMenu.js";
import { completenessChecks, effectiveProcessNotes } from "../lib/quotes/completeness.js";
import { newScopeGroup, scopeGroupPayload, groupSubtotal } from "../lib/quotes/builderPayload.js";

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
  ['className="flex h-[5px]" aria-hidden="true"', "the brand rule"],
  ["rounded-md bg-inverted text-inverted-foreground px-2.5 py-2 mt-1 font-bold", "the total band"],
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
// Only the keys this change ADDED (app.docBuilder.*, app.paint.otherTrades):
// uk, pa and tl already lag on older builder keys, which is
// check-language-completeness's business, not this file's.
const keys = [...new Set([...(builder + src("app/components/quotes/builder/EstimateTypeFirst.js")).matchAll(/t\(\s*"(app\.(?:docBuilder\.[a-zA-Z0-9.]+|paint\.otherTrades(?:Hint)?|paint\.newPaintingQuote))"/g)].map((m) => m[1]))];
ok("the document layout has strings of its own to check", keys.length > 30, String(keys.length));
for (const lang of Object.keys(APP_MESSAGES)) {
  const missing = keys.filter((k) => !(k in APP_MESSAGES[lang]));
  ok(`every new key exists in ${lang}`, missing.length === 0, missing.join(", "));
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
  // React's static markup separates adjacent text with <!-- -->; the
  // assertions read the text a person sees.
  const text = doc.replace(/<!-- -->/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  ok("painting: room dimensions on the card", text.includes("15 × 16 × 8"));
  ok("painting: the room's lines carry their measurement, never a rate", /Walls — \d+ sqft, 2 coats/.test(text), text.slice(text.indexOf("Living room"), text.indexOf("Living room") + 160));
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
  ok(`${lang}: the tabs follow the reader's language`, doc.includes(`>${APP_MESSAGES[lang]["app.docBuilder.tab.workorder"]}<`), doc.match(/data-doc-tab="workorder"[^>]*>([^<]*)</)?.[1]);
  void tab;
}

// ── The painting company's first screen (mockup b1) ────────────────────────
//
// New quote, painting enabled, nothing added: the estimate-type cards are
// the first thing in the body, before the client box, and the service
// tiles are withheld — in BOTH layouts. A mixed-trade company gets "Other
// trades"; a painting-only company does not. Picking a type adds the
// painting service with the type on its takeoff (executed through the
// same helpers the screen calls).
{
  const blank = initialStateFromQuote(null);
  for (const layout of QUOTE_BUILDER_LAYOUTS) {
    const html = render(layout, "create", null, blank);
    const cards = html.indexOf("data-estimate-type-first");
    ok(`${layout}: the estimate-type cards are on a painting company's new quote`, cards >= 0);
    ok(`${layout}: the cards come BEFORE the client box`, cards >= 0 && cards < html.indexOf('data-tour="client-picker"'), `${cards} vs ${html.indexOf('data-tour="client-picker"')}`);
    const esc = (v) => String(v).replace(/&/g, "&amp;");
    ok(`${layout}: all five types are offered`, ["interior", "exterior", "cabinets", "staining", "commercial"].every((k) => html.includes(esc(APP_MESSAGES.en[`app.paint.type.${k}`]))));
    ok(`${layout}: no service tile step for painting`, !/data-service-tiles|Interior painting<\/(?:span|div)>/.test(html.split("data-estimate-type-first")[1]?.split("data-tour=\"client-picker\"")[0] || ""));
    ok(`${layout}: a mixed-trade company sees Other trades`, html.includes("data-other-trades"));
    const paintOnly = renderToStaticMarkup(
      <LanguageProvider initialLanguage="en">
        <PermissionProvider role="owner" permissions={{}}>
          <QuoteBuilderForm mode="create" quoteId={null} bootstrap={{ ...BOOTSTRAP, layout, categories: BOOTSTRAP.categories.filter((c) => c.key === "interior_painting") }} initial={blank} />
        </PermissionProvider>
      </LanguageProvider>,
    );
    ok(`${layout}: a painting-only company has no Other trades link`, !paintOnly.includes("data-other-trades") && paintOnly.includes("data-estimate-type-first"));
    const nonPainter = renderToStaticMarkup(
      <LanguageProvider initialLanguage="en">
        <PermissionProvider role="owner" permissions={{}}>
          <QuoteBuilderForm mode="create" quoteId={null} bootstrap={{ ...BOOTSTRAP, layout, categories: BOOTSTRAP.categories.filter((c) => c.key !== "interior_painting") }} initial={blank} />
        </PermissionProvider>
      </LanguageProvider>,
    );
    ok(`${layout}: a company with no painting never sees the cards`, !nonPainter.includes("data-estimate-type-first"));
  }
  eq("exterior → exterior_painting when the company has it", paintingCategoryFor("exterior", [{ key: "interior_painting" }, { key: "exterior_painting" }])?.key, "exterior_painting");
  eq("staining → interior_painting (its substrates live in the interior book)", paintingCategoryFor("staining", [{ key: "interior_painting" }, { key: "exterior_painting" }])?.key, "interior_painting");
  eq("exterior falls back to the one painting service the company has", paintingCategoryFor("exterior", [{ key: "interior_painting" }])?.key, "interior_painting");
  eq("no painting service → null, never a guess", paintingCategoryFor("interior", [{ key: "stairs" }]), null);
  eq("paintingCategoriesOf ignores junk", paintingCategoriesOf([null, {}, { key: "exterior_painting" }]).length, 1);
}

// ── Many services on one quote, the same one twice ─────────────────────────
//
// The owner, on the document layout: "if I'm a general contractor and need to
// do floor, kitchen, countertop I don't need to send 20 individual quotes",
// and "the same service can appear twice — a painter quoting interior AND
// exterior. It's the same job, just a different scoped item."
//
// The regression was not in the state — addScopeGroup has never deduped —
// it was that the document's service picker was a disclosure that started
// CLOSED, so on any quote already carrying one service the other trades were
// behind a click. The tiles are a visible row after the last group now, in
// both shapes of the picker, and this is where that stays true.
{
  // Two groups of the SAME category, priced differently, neither imported.
  const twoOfOne = {
    ...STORED_QUOTE,
    id: "q2",
    addOns: [],
    importedGroupIds: [],
    scopeGroups: [
      {
        id: "s1", categoryId: "cat2", category: { key: "cabinet_refinishing", label: "Cabinets" },
        label: "Cabinets", lineItems: [{ description: "Kitchen doors", quantity: 22, rate: 150, amount: 3300 }], subtotal: 3300,
      },
      {
        id: "s2", categoryId: "cat2", category: { key: "cabinet_refinishing", label: "Cabinets" },
        label: "Cabinets", lineItems: [{ description: "Bathroom vanity", quantity: 4, rate: 150, amount: 600 }], subtotal: 600,
      },
    ],
  };
  const initial = { ...initialStateFromQuote(twoOfOne), quote: twoOfOne };
  const doc = render("document", "edit", "q2", initial);
  const classic = render("classic", "edit", "q2", initial);

  ok("two groups of the same service both reach the document", (doc.match(/data-doc-group="true"/g) || []).length === 2, String((doc.match(/data-doc-group="true"/g) || []).length));
  // Priced independently: each card carries its OWN subtotal, not a shared
  // one and not one doubled.
  ok("each group prints its own subtotal", doc.includes("$3,300.00") && doc.includes("$600.00"), "3300 / 600 not both present");
  // …and both roll into ONE total. 3300 + 600 = 3900, less the stored 500
  // discount, plus 13% on 3400 = 442 → 3842.
  ok("the two groups roll into one total", totalOf(doc) === "$3,842.00", String(totalOf(doc)));
  ok("the classic layout agrees on that total", totalOf(classic) === totalOf(doc), `${totalOf(classic)} vs ${totalOf(doc)}`);
  // Nothing dedupes by category: two identical headings, told apart by the
  // 01 / 02 badge the classic card has always drawn.
  ok("neither layout dedupes the repeated service", (classic.match(/Cabinets/g) || []).length >= 2 && (doc.match(/Cabinets/g) || []).length >= 2);
  ok("the document numbers the repeated groups 01 / 02", /data-doc-group-index[^>]*>01</.test(doc) && /data-doc-group-index[^>]*>02</.test(doc));
  // One scope is not numbered "01" — in either layout.
  const oneGroup = { ...twoOfOne, scopeGroups: [twoOfOne.scopeGroups[0]] };
  ok(
    "a single scope carries no number",
    !render("document", "edit", "q2", { ...initialStateFromQuote(oneGroup), quote: oneGroup }).includes("data-doc-group-index"),
  );

  // The picker itself: every enabled service is offered after the last
  // group, with no click first. This is the regression, stated.
  // Since 2026-09-25 the foot is SERVICES only, as cards (owner): the pill
  // row's heading promised "a service, area or line item" and could add
  // only services. A line item is added inside its service.
  ok("the document offers the service cards with a quote already in progress", doc.includes('data-service-tiles-variant="card"'));
  ok("…and no longer promises an area or a line item down there", !doc.includes("Add a service, area or line item"));
  for (const cat of BOOTSTRAP.categories) {
    ok(`the cards offer ${cat.key}`, doc.includes(`data-service-tile="${cat.key}"`));
  }
  ok("the cards include the service already on the quote (adding it twice is the point)", doc.includes('data-service-tile="cabinet_refinishing"'));
  ok("every service on the quote has its own Add line item", (doc.match(/data-doc-add-line/g) || []).length === twoOfOne.scopeGroups.length);
  ok("a card carries the service's one-line description", /data-service-card-description/.test(doc));
  ok("…and a price where the company has one", /data-service-card-price/.test(doc));
  // A company service with an estimate template, linked to Stairs: its card
  // gets "Add with its template lines (2)" and its price hint reads the
  // company's own figure. Unlinked products (the Rush fee) put nothing on a
  // card — a product for every quote type is not any one service's price.
  const templated = {
    id: "p2", name: "Stair refinish", description: "Sand and stain.", unitPrice: 95, unit: "tread", type: "service", active: true,
    templateEnabled: true, estimateTypes: [], categories: [{ id: "cat1", label: "Stairs" }],
    templateLines: [
      { kind: "labour", name: "Treads", qty: 1, unit: "each", unitPrice: 95, measurementKey: "treads" },
      { kind: "other", name: "Dust containment", qty: 1, unit: "flat", unitPrice: 120 },
    ],
  };
  const cardsDoc = renderToStaticMarkup(
    <LanguageProvider initialLanguage="en">
      <PermissionProvider role="owner" permissions={{}}>
        <QuoteBuilderForm
          mode="create"
          quoteId={null}
          bootstrap={{ ...BOOTSTRAP, layout: "document", products: [...BOOTSTRAP.products, templated], categories: BOOTSTRAP.categories.filter((c) => c.key !== "interior_painting") }}
          initial={initialStateFromQuote(null)}
        />
      </PermissionProvider>
    </LanguageProvider>,
  );
  const stairsCard = cardsDoc.split('data-service-card="stairs"')[1]?.split("data-service-card=")[0] || "";
  // Two template lines; the tread line prices what the stair takeoff already
  // prices, so the card offers ONE and says why (keysPricedByGroup).
  ok("a templated service's card offers it with its template lines", /data-service-card-template="p2"/.test(stairsCard) && /Add with its template lines \(1\)/.test(stairsCard), stairsCard.slice(0, 400));
  ok("…holding back the tread line the stair takeoff already bills, and saying so", /data-service-card-template-skipped[^>]*>Treads — already priced by the stair takeoff, so not added again\./.test(stairsCard), stairsCard.slice(0, 600));
  ok("…priced from the company's own service", /from \$95\.00 \/ tread/.test(stairsCard), stairsCard.slice(0, 400));
  const cabCard = cardsDoc.split('data-service-card="cabinet_refinishing"')[1]?.split("data-service-card=")[0] || "";
  ok("a service with no template offers no template action", !/data-service-card-template/.test(cabCard));
  // An empty quote still gets the full card, which is the first thing to do
  // on a blank page.
  // …on a company with no painting, where the tiles are the first step (a
  // painting company answers EstimateTypeFirst instead — covered below).
  const blankDoc = renderToStaticMarkup(
    <LanguageProvider initialLanguage="en">
      <PermissionProvider role="owner" permissions={{}}>
        <QuoteBuilderForm
          mode="create"
          quoteId={null}
          bootstrap={{ ...BOOTSTRAP, layout: "document", categories: BOOTSTRAP.categories.filter((c) => c.key !== "interior_painting") }}
          initial={initialStateFromQuote(null)}
        />
      </PermissionProvider>
    </LanguageProvider>,
  );
  ok("an empty quote gets the full picker card", blankDoc.includes('data-service-tiles-variant="card"'));
  ok("one component draws both shapes", !src("app/components/quotes/builder/ServiceTiles.js").includes("ServiceTilesRow"));

  // ── On the wire ──────────────────────────────────────────────────────────
  //
  // The screen is half the claim; the other half is that two groups of one
  // service survive the save as two rows priced apart. Executed through the
  // functions the builder calls — newScopeGroup, scopeGroupPayload,
  // groupSubtotal — and then through quoteRequestBody, which is the only
  // body either layout posts.
  const cabinets = { id: "cat2", key: "cabinet_refinishing", label: "Cabinets" };
  const kitchen = newScopeGroup(cabinets, "Kitchen", null, { tempId: "t1" });
  const vanity = newScopeGroup(cabinets, "Bathroom vanity", null, { tempId: "t2" });
  kitchen.lineItems = [{ description: "Kitchen doors", quantity: 22, unit: "unit", rate: 150, amount: 3300 }];
  vanity.lineItems = [{ description: "Vanity doors", quantity: 4, unit: "unit", rate: 150, amount: 600 }];
  const payloads = [kitchen, vanity].map((g) => scopeGroupPayload(g, null, "en"));
  ok("two groups of one category are two payload rows", payloads.length === 2 && payloads[0].categoryId === payloads[1].categoryId, payloads.map((p) => p.categoryId));
  ok("each keeps its own label", payloads[0].label === "Kitchen" && payloads[1].label === "Bathroom vanity");
  // A unit-priced trade's payload opens with its derived unit line (0 units
  // here, so $0) before the typed ones — what matters is that each group
  // carries ITS line and not the other's.
  const descs = payloads.map((p) => p.lineItems.map((l) => l.description));
  ok("each keeps its own lines and none of the other's", descs[0].includes("Kitchen doors") && !descs[0].includes("Vanity doors") && descs[1].includes("Vanity doors") && !descs[1].includes("Kitchen doors"), JSON.stringify(descs));
  ok("each is priced on its own lines, never on the other's", groupSubtotal(kitchen) === 3300 && groupSubtotal(vanity) === 600, [groupSubtotal(kitchen), groupSubtotal(vanity)]);
  const posted = quoteRequestBody({ ...state, isEdit: false, groupsPayload: payloads, clientId: "c", composeSeconds: 1, language: "en", assignedToId: "", subtotal: 3900 });
  ok("both rows reach the POST body", posted.scopeGroups.length === 2, posted.scopeGroups.length);
  ok("the body carries one subtotal for the pair", posted.subtotal === 3900, posted.subtotal);
}

// ── The photo uploader and "what happens next", in BOTH layouts ────────────
//
// Both existed in the classic builder and both were reachable in the document
// only from the Presentation tab, which an estimator writing an estimate never
// opens — so the review's two most common findings ("No photos", "Nothing
// about what happens next") had nowhere obvious to be answered. Each is ONE
// closure rendered by both layouts, never a second copy.
{
  const initial = { ...initialStateFromQuote(STORED_QUOTE), quote: STORED_QUOTE };
  const doc = render("document", "edit", "q1", initial);
  const classic = render("classic", "edit", "q1", initial);

  ok("the photo uploader is on the document layout's estimate screen", doc.includes("data-photos-box"));
  ok("the photo uploader is on the classic layout", classic.includes("data-photos-box"));
  ok("it is drawn once per layout, not twice", (doc.match(/data-photos-box/g) || []).length === 1 && (classic.match(/data-photos-box/g) || []).length === 1);
  ok("both layouts mount the SAME uploader closure", builder.includes("b.renderPhotosBox()") && quoteBuilder.includes("{renderPhotosBox()}"));
  ok("the uploader posts to /api/upload in one place", (quoteBuilder.match(/uploadUrl="\/api\/upload"/g) || []).length === 1 && !/<MediaUploader/.test(builder));

  ok("what happens next is editable inside the document", doc.includes("data-doc-process"));
  ok("what happens next is on the classic layout", classic.includes("data-process-notes-box"));
  ok("both layouts mount the SAME process-notes closure", builder.includes("b.renderProcessNotes()") && quoteBuilder.includes("{renderProcessNotes()}"));
  ok("the document draws it between the totals and the notes, as the client reads it", doc.indexOf("data-doc-totals") < doc.indexOf("data-doc-process") && doc.indexOf("data-doc-process") < doc.indexOf("data-doc-notes"));
  ok("the stored process notes print in the document", /data-doc-process[\s\S]{0,1500}50% on approval\./.test(doc));

  // The two findings the review raises are the two fields these write, and
  // the browser already knows both — completenessChecks runs on the same
  // draft object the builder holds, so they clear before any save.
  const withNeither = completenessChecks({ ...STORED_QUOTE, processNotes: "", clientPhotos: [] }, []).map((c) => c.id);
  const withBoth = completenessChecks({ ...STORED_QUOTE, processNotes: "We start in two weeks.", clientPhotos: [{ url: "https://res.cloudinary.com/demo/a.jpg", kind: "image" }] }, []).map((c) => c.id);
  ok("the review raises both findings when the fields are empty", withNeither.includes("no_process") && withNeither.includes("no_photos"), withNeither.join(","));
  ok("filling them clears both findings", !withBoth.includes("no_process") && !withBoth.includes("no_photos"), withBoth.join(","));

  // ── The company's default counts, because the document prints it ───────
  //
  // app/api/quotes/[id]/document prints `quote.processNotes ||
  // company.defaultProcessNotes`, so a company that wrote its wording once in
  // Settings has the section on every quote. The finding used to read the
  // quote's column alone and told those companies, on every quote, that they
  // had said nothing about what happens next. The four-line example in the
  // textarea is a PLACEHOLDER (app.quoteEdit.processNotesPlaceholder) and
  // prints nowhere — which is exactly why the effective text, not the box,
  // decides.
  const DEFAULT_WORDING = "We'll confirm a start date within 2 business days of approval.";
  const withCompanyDefault = completenessChecks({ ...STORED_QUOTE, processNotes: "", defaultProcessNotes: DEFAULT_WORDING }, []).map((c) => c.id);
  ok("a company default and an empty box → no finding, because that text is what prints", !withCompanyDefault.includes("no_process"), withCompanyDefault.join(","));
  const viaRelation = completenessChecks({ ...STORED_QUOTE, processNotes: "", company: { defaultProcessNotes: DEFAULT_WORDING } }, []).map((c) => c.id);
  ok("…read off the company relation too, which is the shape the server has", !viaRelation.includes("no_process"));
  const blankDefault = completenessChecks({ ...STORED_QUOTE, processNotes: "", defaultProcessNotes: "   " }, []).map((c) => c.id);
  ok("a company with NO default is still told — that is the case the advice was written for", blankDefault.includes("no_process") && completenessChecks({ ...STORED_QUOTE, processNotes: "", defaultProcessNotes: null }, []).map((c) => c.id).includes("no_process"));
  ok("the quote's own words win over the default", effectiveProcessNotes({ processNotes: "Ours.", defaultProcessNotes: DEFAULT_WORDING }) === "Ours." && effectiveProcessNotes({ processNotes: "  ", defaultProcessNotes: DEFAULT_WORDING }) === DEFAULT_WORDING);

  const docRoute = src("app/api/quotes/[id]/document/route.js");
  // `companyText` is the company row localised to the quote's language
  // (lib/i18n/companyText.js, 2026-09-24) — the same default, in the
  // language the document is written in; the rule "the quote's words, else
  // the company default" is unchanged.
  ok("…and that IS what the document route prints", /quote\.processNotes \|\| (quote\.company|companyText)\?\.defaultProcessNotes/.test(docRoute));
  const email = src("lib/email/quoteEmail.js");
  ok("the covering email resolves it the same way, and the send route loads the column", /effectiveProcessNotes\(\{ \.\.\.quote, company \}\)/.test(email) && /defaultProcessNotes: true/.test(src("app/api/quotes/[id]/send/route.js")));
  ok("…and a select that forgets it is refused rather than silently dropping the section", /"defaultProcessNotes" in company/.test(src("lib/quotes/emailSections.js")));
  const bootstrap = src("app/components/quotes/builder/QuoteBuilder.js");
  ok("the builder hands the readiness panel the same default", /defaultProcessNotes: boot\.defaultProcessNotes \|\| ""/.test(bootstrap));
}

// ── The toolbar row ────────────────────────────────────────────────────────
//
// The tabs and the action cluster share one wrapping row. The tabs were the
// flexible child, so they were squeezed into their own overflow scroller at
// any width — a scrollbar thumb under four tabs on a 1440px screen. Both
// children hold their natural width now and the cluster wraps instead; the
// strip keeps its scroller below lg, where four tabs genuinely do not fit
// 375px.
{
  const doc = render("document", "edit", "q1", { ...initialStateFromQuote(STORED_QUOTE), quote: STORED_QUOTE });
  const strip = doc.match(/<div role="tablist" class="([^"]*)"/)?.[1] || "";
  ok("the tab strip does not shrink", strip.includes("shrink-0"), strip);
  ok("the tab strip stops scrolling from lg up", strip.includes("lg:overflow-x-visible"), strip);
  ok("the tab strip may still scroll on a phone", strip.includes("overflow-x-auto"), strip);
  ok("the toolbar row wraps", /data-doc-toolbar/.test(doc) && /class="[^"]*flex-wrap[^"]*"[^>]*data-doc-toolbar/.test(doc));
}

// ── The floating + (CreateMenu.js) stays off the builder ──────────────────
//
// "Why is the create button visible when creating a new quote?" — hidden on
// every /new, /edit and /import route and the kitchen designer, executed
// against the rule the component uses. And it no longer sits on Jennifer:
// its bottom offset is the slot above her launcher (5.5rem = 1.25rem +
// 3.5rem + a 0.75rem gap), read from both files rather than assumed.
{
  for (const path of ["/app/quotes/new", "/app/quotes/q_1/edit", "/app/invoices/new", "/app/jobs/new", "/app/clients/new", "/app/clients/c_1/edit", "/app/jobs/import", "/app/quotes/q_1/kitchen"]) {
    ok(`the + is hidden on ${path}`, createFabHiddenOn(path));
  }
  for (const path of ["/app", "/app/quotes", "/app/quotes/q_1", "/app/jobs/j_1", "/app/settings/company", "/app/newsletter"]) {
    ok(`the + shows on ${path}`, !createFabHiddenOn(path));
  }
  const fab = src("app/components/layout/CreateMenu.js");
  const jen = src("app/components/jennifer/JenniferPanel.js");
  ok("the + sits above Jennifer's launcher, not on it", fab.includes("var(--fq-dock-height) + 5.5rem)") && jen.includes("var(--fq-dock-height)+1.25rem)") && jen.includes("h-14 w-14"));
  ok("the + returns null on a hidden route before rendering", /createFabHiddenOn\(pathname\)\) return null/.test(fab));
}

// ───────────────────────────────────────────────────────────────────────────
if (fails.length) {
  console.error(`\n✗ doc builder: ${fails.length} failed, ${pass} passed`);
  for (const f of fails) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`\n✓ doc builder: ${pass} checks`);
