// scripts/check-quote-duplicate.mjs
//
//   node --import ./scripts/alias-loader.mjs scripts/check-quote-duplicate.mjs
//
// ── What this is guarding ───────────────────────────────────────────────────
//
// app.kitchen.lockedNote told users for months to "duplicate the quote to
// change it", and nothing in the product duplicated a quote. POST
// /api/quotes/[id]/duplicate now does, through lib/quotes/duplicateQuote.js —
// a pure function, so this file can feed it a hostile, fully-populated
// source row and assert field by field that a copy carries the WORK and none
// of the HISTORY. Every assertion is a real call to the unmodified function.
//
// The second half reads source: the route stamps createdVia and companyId
// itself, the two screens that offer Duplicate call the route, and the kitchen
// page's locked note now sits beside the button it describes.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { duplicateQuoteData } from "@/lib/quotes/duplicateQuote";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

let failures = 0;
let checks = 0;
function ok(name, pass, detail = "") {
  checks++;
  if (!pass) failures++;
  console.log(`  ${pass ? "ok  " : "FAIL"} ${name}${detail ? `  — ${detail}` : ""}`);
}
function section(title) {
  console.log(`\n${title}\n`);
}

// A sent, signed, accepted, reviewed, client-edited kitchen quote with every
// history column filled — the worst case for a copy to leak from.
const source = {
  id: "q_src",
  companyId: "co_other",
  quoteNumber: "Q-2026-0042",
  status: "accepted",
  language: "fr",
  clientId: "cl_1",
  createdById: "u_old",
  assignedToId: "u_old",
  lineItems: [{ description: "Armoires", amount: 100 }],
  clientPhotos: [{ url: "https://res.cloudinary.com/x/a.jpg", kind: "image" }],
  subtotal: "1000.00",
  discount: "50.00",
  tax: "142.50",
  total: "1092.50",
  taxEnabled: true,
  notes: "Merci",
  reviewNotes: "caller unsure about handles",
  processNotes: "Two weeks",
  validUntil: new Date("2026-01-01"),
  pdfUrl: "https://res.cloudinary.com/x/q.pdf",
  quoteType: "kitchen",
  scopeDetails: { serviceType: "kitchen", elements: [{ kind: "base", w: 600 }] },
  shareToken: "tok_public",
  clientDesignSaved: true,
  clientDesignAt: new Date("2026-02-01"),
  clientKitchenConfig: { elements: [] },
  sentAt: new Date("2026-01-15"),
  sentToEmail: "a@b.c",
  followUpSentAt: new Date("2026-01-20"),
  followUpCount: 2,
  calledAt: new Date("2026-01-16"),
  tierGroupId: "tier_1",
  tierLabel: "better",
  acceptedTotal: "1092.50",
  acceptedSubtotal: "950.00",
  acceptedTax: "142.50",
  emailIncludeReferences: true,
  emailIncludeBeforeAfter: false,
  emailReferences: [{ name: "Ref" }],
  emailBeforeAfter: null,
  aiReview: { readiness: 90 },
  aiReviewedAt: new Date("2026-01-14"),
  aiVisionPasses: [{ at: "2026-01-14" }],
  autoEstimated: true,
  needsReview: true,
  signature: { name: "Client", signedAt: "2026-02-02" },
  estimateSource: "google_solar",
  composeSeconds: 900,
  acceptedAt: new Date("2026-02-02"),
  declinedAt: null,
  declineReason: null,
  estimateData: { squares: 30 },
  reviewedById: "u_rev",
  reviewedAt: new Date("2026-01-15"),
  historicalImportedAt: null,
  createdVia: "instant_quote",
  sourceCallId: "call_1",
  sourceThreadId: "thread_1",
  scopeGroups: [
    { id: "g2", categoryId: "cat_b", label: "Bath", lineItems: [{ a: 1 }], takeoff: { x: 1 }, intakeValues: { y: 2 }, subtotal: "300.00", sortOrder: 5 },
    { id: "g1", categoryId: "cat_k", label: "Kitchen — designed", lineItems: [{ b: 2 }], takeoff: null, intakeValues: null, subtotal: "700.00", sortOrder: 9 },
  ],
  addOns: [
    { id: "a1", description: "Handles", detail: "Brushed", amount: "80.00", taxable: true, sortOrder: 0, source: "manual", selected: true, selectedAt: new Date("2026-02-02") },
    { id: "a2", description: "Soft close", detail: null, amount: "40.00", taxable: false, sortOrder: 1, source: "takeoff", selected: false, selectedAt: null },
  ],
  costing: {
    id: "c1", quoteId: "q_src", crew: [{ name: "Al", rate: 40 }], addedLabourHours: "2.00", addedMaterialCost: "50.00",
    labourRate: "40.00", overheadPct: "10.000", note: "n", labourHours: "12.00", labourCost: "480.00", materialTotal: "200.00",
    unpricedMaterials: 1, overhead: "100.00", overheadBasis: "per_job", totalCost: "780.00", price: "950.00", profit: "170.00",
    marginPct: "17.895", marginTargetPct: "30.000", signal: "amber", costIncomplete: false, blendedRate: "40.00", groups: [{ g: 1 }],
  },
};

// The shape hasToggle() reads: `permissions` on the enforceable member, with
// an owner/admin role unrestricted and an unmentioned toggle defaulting on.
const withCosting = { id: "m", role: "employee", permissions: { jobCosting: true, showPricing: true } };
const noCosting = { id: "m", role: "employee", permissions: { jobCosting: false, showPricing: true } };

const data = duplicateQuoteData(source, { quoteNumber: "Q-2026-0043", userId: "u_new", member: withCosting });

section("The WORK comes across");
ok("the fresh number is the caller's, never the source's", data.quoteNumber === "Q-2026-0043");
ok("same client", data.clientId === "cl_1");
ok("the language is copied verbatim (non-negotiable 6), not re-resolved", data.language === "fr");
ok("quoteType survives", data.quoteType === "kitchen");
ok("money columns arrive as numbers, not Decimal instances or strings", data.subtotal === 1000 && data.discount === 50 && data.tax === 142.5 && data.total === 1092.5);
ok("taxEnabled survives", data.taxEnabled === true);
ok("notes and process notes survive", data.notes === "Merci" && data.processNotes === "Two weeks");
ok("the kitchen design (scopeDetails) is copied whole", data.scopeDetails?.serviceType === "kitchen" && data.scopeDetails.elements.length === 1);
ok("…and is a copy, not the same object", data.scopeDetails !== source.scopeDetails);
ok("line items and client photos survive", Array.isArray(data.lineItems) && data.lineItems.length === 1 && data.clientPhotos.length === 1);
ok("email-section choices survive, including a decided-false and an inherit-null", data.emailIncludeReferences === true && data.emailIncludeBeforeAfter === false && data.emailReferences.length === 1 && data.emailBeforeAfter === null);
ok("the duplicator owns the draft: createdById and assignedToId are theirs", data.createdById === "u_new" && data.assignedToId === "u_new");
ok("status is draft", data.status === "draft");

section("Scope groups");
const groups = data.scopeGroups?.create || [];
ok("both groups copied", groups.length === 2);
ok("in the order they arrived, renumbered from 0", groups[0].label === "Bath" && groups[0].sortOrder === 0 && groups[1].sortOrder === 1);
ok("categoryId, lineItems, takeoff and intakeValues carried", groups[0].categoryId === "cat_b" && groups[0].lineItems[0].a === 1 && groups[0].takeoff.x === 1 && groups[0].intakeValues.y === 2);
ok("group subtotal is a number", groups[1].subtotal === 700);
ok("no source row id leaks into a nested create", groups.every((g) => !("id" in g) && !("quoteId" in g)));

section("Add-ons: the offer, not the answer");
const addOns = data.addOns?.create || [];
ok("both offers copied", addOns.length === 2);
ok("description, detail, amount, taxable and source carried", addOns[0].description === "Handles" && addOns[0].detail === "Brushed" && addOns[0].amount === 80 && addOns[1].taxable === false && addOns[1].source === "takeoff");
ok("a client's tick does NOT come across — nobody has seen the copy", addOns.every((a) => a.selected === false && a.selectedAt === null));
ok("no source row id leaks", addOns.every((a) => !("id" in a) && !("quoteId" in a)));

section("Costing follows the jobCosting toggle");
ok("with the toggle, the costing row is copied", Boolean(data.costing?.create) && data.costing.create.labourHours === 12 && data.costing.create.crew[0].name === "Al");
ok("…as numbers, with the signal and target intact", data.costing.create.marginTargetPct === 30 && data.costing.create.signal === "amber" && data.costing.create.marginPct === 17.895);
const noCost = duplicateQuoteData(source, { quoteNumber: "Q-2026-0043", userId: "u_new", member: noCosting });
ok("without the toggle, no costing row — the same rule POST /api/quotes applies", !("costing" in noCost));
ok("a null member (unresolved) gets no costing row either", !("costing" in duplicateQuoteData(source, { quoteNumber: "Q-1", userId: "u", member: null })));

section("The HISTORY stays behind");
const mustBeNull = [
  "sentAt", "sentToEmail", "followUpSentAt", "shareToken", "signature", "acceptedTotal", "acceptedSubtotal", "acceptedTax",
  "acceptedAt", "declinedAt", "declineReason", "clientDesignAt", "clientKitchenConfig", "aiReview", "aiReviewedAt",
  "aiVisionPasses", "estimateSource", "estimateData", "reviewedById", "reviewedAt", "pdfUrl", "calledAt", "tierGroupId",
  "tierLabel", "sourceCallId", "sourceThreadId", "historicalImportedAt", "composeSeconds", "validUntil", "reviewNotes",
];
for (const key of mustBeNull) ok(`${key} is reset to null`, key in data && data[key] === null, `got ${JSON.stringify(data[key])}`);
ok("followUpCount is 0", data.followUpCount === 0);
ok("clientDesignSaved, autoEstimated and needsReview are false", data.clientDesignSaved === false && data.autoEstimated === false && data.needsReview === false);
ok("the source's companyId is NOT in the data — the route stamps the caller's", !("companyId" in data));
ok("the source's createdVia is NOT in the data — the route stamps 'staff'", !("createdVia" in data));
ok("the source's id is not in the data", !("id" in data));

section("Hostile input");
let threw = false;
try { duplicateQuoteData(null, { quoteNumber: "Q-1", userId: "u", member: null }); } catch { threw = true; }
ok("a missing source throws rather than minting an empty quote", threw);
threw = false;
try { duplicateQuoteData(source, { quoteNumber: "", userId: "u", member: null }); } catch { threw = true; }
ok("a missing quote number throws — the route must allocate one first", threw);
const bare = duplicateQuoteData({ clientId: "c", language: null, scopeGroups: null, addOns: undefined, costing: null, subtotal: "abc" }, { quoteNumber: "Q-1", userId: "u", member: withCosting });
ok("a bare source gets an English draft, 0 money, no nested creates", bare.language === "en" && bare.subtotal === 0 && !("scopeGroups" in bare) && !("addOns" in bare) && !("costing" in bare));

section("The route and the screens");
const route = read("app/api/quotes/[id]/duplicate/route.js");
ok("the route requires quotes:view_create_edit — the rung POST /api/quotes asks for", /levelOrRefusal\(\s*member,\s*"quotes",\s*"view_create_edit"/.test(route));
ok("the route counts the copy against the plan's quote limit", /requireWithinLimit\(member\.companyId, "quotes"\)/.test(route));
ok("the route allocates the number from the live series", /nextQuoteNumberForCompany\(db, member\.companyId\)/.test(route));
ok("the route stamps createdVia 'staff' and the caller's companyId", /createdVia: requireCreatedVia\("staff"\)/.test(route) && /companyId: member\.companyId/.test(route));
ok("the route scopes the source to the caller's company", /where: \{ id, companyId: member\.companyId \}/.test(route));
const detail = read("app/app/quotes/[id]/page.js");
ok("the quote detail offers Duplicate to members who may create quotes, and calls the route", /canDuplicateQuote && \(/.test(detail) && /\/api\/quotes\/\$\{id\}\/duplicate/.test(detail));
ok("the quote detail offers Download PDF only with showPricing — the toggle the PDF route refuses without", /hasToggle\(caller, "showPricing"\)/.test(detail) && /\/api\/quotes\/\$\{id\}\/pdf/.test(detail) && /canDownloadPdf && \(/.test(detail));
const kitchen = read("app/app/quotes/[id]/kitchen/KitchenPage.js");
ok("the kitchen page's locked note now has the Duplicate button beside it, opening the COPY's designer", /app\.kitchen\.lockedNote[\s\S]{0,900}?onClick=\{duplicateQuote\}/.test(kitchen) && /\/app\/quotes\/\$\{copy\.id\}\/kitchen/.test(kitchen));

console.log(`\n${checks} checks, ${failures} failure(s).${failures ? "" : " A duplicate is the work without the history."}\n`);
if (failures) process.exitCode = 1;
