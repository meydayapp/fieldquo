// scripts/check-plan-read-live-fixes.mjs
//
//   npm run check:plan-read-live-fixes
//
// The owner's live test of "Start from drawings" (St Paul's church set,
// production, demo company, 2026-10-05) found seven faults. Each is executed
// here against the real modules — a scripted model, an in-memory ledger, the
// real paint engine — never read off the source alone:
//
//   1. The read page crashed ("i is not a function") on every change and on
//      leaving it: an effect returned scrollIntoView()'s Promise as its
//      cleanup. The lint rule that now forbids that is run here on the bad
//      line and on the page.
//   2. The chat could not open a sheet whose title block gave no usable
//      number: "A-3 p5", "pages 5, 6 and 7", "west elevation" now resolve,
//      a number shared by every sheet resolves to none, and the model is
//      told the names.
//   3. Coats move paint and not hours — the builder's own rule, measured
//      here on the engine — and slow or high work is the line's own prep
//      hours, which reach the takeoff the builder opens with.
//   4. The chat can enter extra prep hours on a surface, and an equipment
//      price ONLY at a figure the estimator typed or accepted, flagged as the
//      AI's; never for a member who can't see prices; never a company rate.
//   5. A typed 0 is a price (owned equipment), everywhere "unpriced" and the
//      equipment cost are worked out.
//   6. "Charged so far" includes the chat, from the ledger.
//   7. The equipment subtotal follows a saved price (it did on the server;
//      the screen crashed before showing it — fix 1).
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { ESLint } from "eslint";

import { ukChurchSet } from "./fixtures/planPdf.mjs";
import { pdfSheets } from "@/lib/planRead/ingest";
import { sheetDirectory, sheetDirectoryText, sheetDisplayName, findSheet, findSheets } from "@/lib/planRead/sheetNames";
import { chatTurn, chatContext } from "@/lib/planRead/chat";
import { applyOps, sanitiseSynthesis, computeProject, CHAT_OPS, MAX_PREP_HOURS } from "@/lib/planRead/projectModel";
import { priceProject } from "@/lib/planRead/pricing";
import { readPricing } from "@/lib/planRead/readPricing";
import { planReadView } from "@/lib/planRead/view";
import { chatSpendCents, chatChargeRef, pricingChargeRef } from "@/lib/planRead/billing";
import { CHAT_SCHEMA, CHAT_SYSTEM } from "@/lib/planRead/prompts";
import { planSubstrateKeys } from "@/lib/planRead/catalogue";
import { assertStrictSchema } from "@/lib/ai/jsonSchema";
import { getPriceBook } from "@/app/data/tradePriceBooks";
import { paintTakeoff } from "@/lib/pricing/paintTakeoff";

let passed = 0;
let failed = 0;
const ok = (label, cond, detail) => {
  if (cond) passed++;
  else failed++;
  console.log(`  ${cond ? "ok  " : "FAIL"} ${label}${cond || detail === undefined ? "" : `  — ${JSON.stringify(detail)}`}`);
};
const section = (t) => console.log(`\n${t}\n`);
const code = (p) =>
  readFileSync(new URL(`../${p}`, import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
const md5 = (v) => createHash("md5").update(JSON.stringify(v)).digest("hex");
const near = (a, b, tol = 0.01) => Math.abs(a - b) <= tol;

const books = {
  interior_painting: getPriceBook("interior_painting", null).takeoff,
  exterior_painting: getPriceBook("exterior_painting", null).takeoff,
};
const itemKeys = new Set(planSubstrateKeys(books.interior_painting));
const productKeys = new Set(Object.keys(books.interior_painting.products));
const opsCtx = { dimIds: new Set(), itemKeys, productKeys, photoIds: new Set(), excel: null };

// A church read as it is stored: the nave's walls estimated, a ceiling, two
// equipment lines — the shape the owner's read had.
const model = sanitiseSynthesis(
  {
    summary: "Church interior",
    buildingType: "church",
    commercial: false,
    areas: [
      { id: "a1", name: "Nave", level: null, side: "interior", include: true },
      { id: "a2", name: "North transept", level: null, side: "interior", include: true },
    ],
    surfaces: [
      { id: "s1", areaId: "a1", label: "Nave walls", itemKey: "walls", coats: 1, productKey: null, lengthRefs: [], widthRefs: [], multiplier: 1, count: null, excelSheet: null, excelRow: null, excelCol: null, photoSurfaceId: null, estimate: 4850, estimateBasis: "scaled from p11/p9", sheet: "p11", note: null },
      { id: "s2", areaId: "a2", label: "Transept walls", itemKey: "walls", coats: 1, productKey: null, lengthRefs: [], widthRefs: [], multiplier: 1, count: null, excelSheet: null, excelRow: null, excelCol: null, photoSurfaceId: null, estimate: 1600, estimateBasis: "scaled", sheet: "p11", note: null },
    ],
    access: [
      { areaId: "a1", equipment: "scaffold", workingHeightFt: 40, heightRef: null, reason: "nave walls" },
      { areaId: "a2", equipment: "step_ladder", workingHeightFt: 12, heightRef: null, reason: "transept" },
    ],
    complexity: { level: "high", factors: [] },
    assumptions: [],
    exclusions: [],
    questions: [],
  },
  opsCtx,
);
const compute = (m) => computeProject(m, { dims: new Map(), book: books.interior_painting });
const ctxPricing = {
  currency: "USD",
  labour: { rate: 35, source: "fallback", workers: 0 },
  target: { pct: 32, isDefault: false },
  overhead: { rates: null, fallbackPct: 10, minimumPrice: null, hourlyFloor: null, minimumPerHour: null, needsCapacity: false },
  books: {},
  services: [],
  enabledKeys: ["interior_painting"],
};
const pricingOf = (m) => {
  const computed = compute(m);
  const pricedPaint = priceProject(computed, books);
  return { computed, pricedPaint, pricing: readPricing({ computed: { ...computed, trades: [] }, pricedPaint, model: m, ctx: ctxPricing }) };
};

// ═══════════════════════════════════════════════════════════════════════════
section("1. The read page's crash: an effect that returns a Promise");
// ═══════════════════════════════════════════════════════════════════════════

const eslint = new ESLint({ overrideConfigFile: "scripts/check-hooks.config.mjs" });
const lintText = async (src) => (await eslint.lintText(src, { filePath: "app/components/planRead/_probe.js" }))[0].messages.map((m) => m.ruleId);
const crashLine = 'import { useEffect, useRef } from "react";\nexport function C({ n }) {\n  const end = useRef(null);\n  useEffect(() => end.current?.scrollIntoView?.({ block: "nearest" }), [n]);\n  return null;\n}\n';
ok("the shipped line — useEffect(() => end.current?.scrollIntoView?.(…)) — is refused", (await lintText(crashLine)).includes("fieldquo/effect-returns-cleanup"));
ok("…and so is an async effect, and `return el.focus()` in a block", (await lintText('import { useEffect } from "react";\nexport function C({ el }) {\n  useEffect(async () => {}, []);\n  useEffect(() => { return el.focus(); }, [el]);\n  return null;\n}\n')).filter((r) => r === "fieldquo/effect-returns-cleanup").length === 2);
ok("a cleanup function, a helper that returns one, a setter, a block body: all fine", (await lintText('import { useEffect } from "react";\nexport function C({ load, set, sub, el }) {\n  useEffect(() => () => sub(), []);\n  useEffect(() => load(), [load]);\n  useEffect(() => set(0), [set]);\n  useEffect(() => { el?.scrollIntoView(); }, [el]);\n  return null;\n}\n')).length === 0);
const pageLint = await eslint.lintFiles(["app/components/planRead/PlanReadWorkspace.js"]);
ok("PlanReadWorkspace.js passes it", pageLint[0].messages.length === 0, pageLint[0].messages.map((m) => `${m.line}: ${m.message}`));
ok("the rule is in check:hooks, which check:all runs", /check:hooks/.test(JSON.parse(readFileSync("package.json", "utf8")).scripts["check:all"]) && /"fieldquo\/effect-returns-cleanup": "error"/.test(readFileSync("scripts/check-hooks.config.mjs", "utf8")));

// ═══════════════════════════════════════════════════════════════════════════
section("2. Opening a sheet by any name the estimator or the model uses");
// ═══════════════════════════════════════════════════════════════════════════

// As the church read was STORED: parsed before f5e19e42, every sheet's
// number the paper size "A-3", no titles.
const stale = Array.from({ length: 13 }, (_, i) => ({ key: `p${i + 1}`, page: i + 1, docId: i < 7 ? "d1" : "d2", docPage: i < 7 ? i + 1 : i - 6, sheetNumber: "A-3", title: null, titles: [], vector: true, dims: [], scanDims: [] }));
const staleDir = sheetDirectory(stale);
const keyOf = (hit) => hit?.key || null;
ok("a number every sheet shares names none of them (\"A-3\" opened p1, the floor plan)", keyOf(findSheet(staleDir, "A-3")) === null && staleDir.every((d) => d.number === null));
ok("\"A-3 p5\" → p5", keyOf(findSheet(staleDir, "A-3 p5")) === "p5");
ok("\"p5\", \"5\", \"page 5\", \"Page 5\", \"pg. 5\" → p5", ["p5", "5", "page 5", "Page 5", "pg. 5"].every((n) => keyOf(findSheet(staleDir, n)) === "p5"), ["p5", "5", "page 5", "Page 5", "pg. 5"].map((n) => keyOf(findSheet(staleDir, n))));
ok("\"sheet 6\" → p6; \"page 14\" → none", keyOf(findSheet(staleDir, "sheet 6")) === "p6" && findSheet(staleDir, "page 14") === null);
ok("\"pages 5, 6 and 7\" → p5 and p6 (two a message)", findSheets(staleDir, ["pages 5, 6 and 7"]).map(keyOf).join() === "p5,p6", findSheets(staleDir, ["pages 5, 6 and 7"]).map(keyOf));
ok("…and all three when three are allowed", findSheets(staleDir, ["pages 5, 6 and 7"], 3).map(keyOf).join() === "p5,p6,p7");
ok("junk names nothing", [null, "", "   ", "A-3", "elevation", "zzz", 42].every((n) => findSheet(staleDir, n) === null || n === 42) && keyOf(findSheet(staleDir, 42)) === null);
ok("the screen calls them Page 5, not A-3", sheetDisplayName(staleDir[4]) === "Page 5");

const uk = await pdfSheets(ukChurchSet(), { firstIndex: 1 });
const ukDir = sheetDirectory(uk.sheets);
ok("a set the parser reads names its sheets by their own numbers: P43, P-52, e01", keyOf(findSheet(ukDir, "P43")) === "p1" && keyOf(findSheet(ukDir, "P-52")) === "p2" && keyOf(findSheet(ukDir, "e01")) === "p3", ukDir.map((d) => [d.key, d.number]));
ok("…by its title's words: \"location plan\" → P-52; \"extension floor plan\" → P-43", keyOf(findSheet(ukDir, "location plan")) === "p2" && keyOf(findSheet(ukDir, "extension floor plan")) === "p1", ukDir.map((d) => d.titles));
ok("…and a word every sheet's title holds names none (\"plan\")", findSheet(ukDir, "plan") === null);
ok("the directory the chat is given lists key, page, number and titles", /^p1 — page 1 — P-43 — Scheme C4 - Extension Floor Plan/m.test(sheetDirectoryText(ukDir)) && !/A-3/.test(sheetDirectoryText(staleDir)) && /^p5 — page 5$/m.test(sheetDirectoryText(staleDir)), sheetDirectoryText(staleDir).split("\n").slice(0, 2));

const pages = (doc, n) => Array.from({ length: n }, (_, i) => ({ page: i + 1, url: `https://res.cloudinary.com/x/image/upload/v1/fieldquo/companies/co1/plans/${doc}-p${i + 1}.jpg`, width: 3200, height: 2133 }));
const readRow = {
  id: "pr-church",
  title: "St Paul's",
  trade: "painting",
  clientRequest: "Repaint the interior walls",
  status: "ready",
  model,
  sheets: stale.map((s) => ({ ...s, read: { relevant: true, summary: "", areas: [], heights: [], finishes: [], access: [] } })),
  excelRows: null,
  photoRead: null,
  documents: [
    { id: "d1", kind: "plan", mimeType: "application/pdf", url: "https://res.cloudinary.com/x/raw/upload/fieldquo/companies/co1/plans/a.pdf", supersedesId: null, pages: pages("d1", 7) },
    { id: "d2", kind: "plan", mimeType: "application/pdf", url: "https://res.cloudinary.com/x/raw/upload/fieldquo/companies/co1/plans/b.pdf", supersedesId: null, pages: pages("d2", 6) },
  ],
  progress: {},
};
const ctxText = chatContext(readRow, books.interior_painting);
ok("the chat's fixed context names the sheets it may open", ctxText.includes("=== SHEETS YOU CAN OPEN") && /\np5 — page 5\n/.test(ctxText));
ok("…and stays byte-identical across turns (the cached prefix)", ctxText === chatContext(JSON.parse(JSON.stringify(readRow)), books.interior_painting));
ok("the system prompt tells the model to use those names", /SHEETS\s+YOU CAN OPEN/.test(CHAT_SYSTEM) && /"p5"/.test(CHAT_SYSTEM));

const calls = [];
const scripted = (replies) => async (args) => {
  calls.push(args);
  await args.onUsage?.({ model: "gpt-5.5", promptTokens: 9000, completionTokens: 300, cachedTokens: 0, imageCount: (args.images || []).length });
  return replies.shift();
};
const meterFor = async () => ({ check: async () => ({ allowed: true }), record: async () => ({ chargedCents: 3 }) });
const blankOp = { surfaceId: null, areaId: null, accessId: null, questionId: null, itemKey: null, coats: null, productKey: null, include: null, lengthRefs: [], widthRefs: [], multiplier: null, count: null, estimate: null, estimateBasis: null, label: null, side: null, equipment: null, workingHeightFt: null, text: null, hours: null, price: null };
const turn = async (message, replies, { history = [], canSeeMoney = true } = {}) => {
  calls.length = 0;
  return chatTurn({ read: readRow, companyId: "co1", userId: "u1", message, history, canSeeMoney }, { complete: scripted(replies), meterFor, books, turnId: "t" });
};
const opened = await turn("Open the elevations on pages 5 and 6", [
  { ok: true, data: { reply: "", openSheets: ["A-3 p5", "page 6"], ops: [] } },
  { ok: true, data: { reply: "The west face is 14 m long.", openSheets: [], ops: [] } },
]);
ok("the model's \"A-3 p5\" and \"page 6\" open p5 and p6 — ONE more call, with their images", opened.ok && calls.length === 2 && calls[1].images.length === 10 && calls[1].images.every((u) => /d1-p[56]\.jpg$/.test(u)) && calls[1].images.some((u) => /d1-p5\.jpg$/.test(u)), calls.map((c) => (c.images || []).length));
ok("…named back to it as the directory names them", /You asked to see p5, p6/.test(calls[1]?.prompt || "") && opened.opened.join() === "p5,p6", opened.opened);
const opened2 = await turn("look at the second set's page 1", [
  { ok: true, data: { reply: "", openSheets: ["p8"], ops: [] } },
  { ok: true, data: { reply: "ok", openSheets: [], ops: [] } },
]);
ok("a sheet of the second file opens its own page image (p8 → b.pdf page 1)", opened2.ok && calls[1]?.images.every((u) => /d2-p1\.jpg$/.test(u)), calls[1]?.images);

// The view names sheets the same way.
const viewStub = { companyServiceCategory: { findMany: async () => [] } };
const staleView = await planReadView(readRow, { companyId: "co1", canSeeMoney: true, prisma: viewStub });
ok("the screen's sheet names: Page 5, not A-3 on all thirteen", staleView.sheets[4].name === "Page 5" && !staleView.sheets.some((s) => s.name === "A-3"), staleView.sheets.map((s) => s.name).slice(0, 3));

// ═══════════════════════════════════════════════════════════════════════════
section("3. Coats move paint, not hours — the builder's rule — and prep hours");
// ═══════════════════════════════════════════════════════════════════════════

const wallTakeoff = (coats, prepHours = 0) => ({ model: "area_substrate", estimateType: "interior", notes: "", areas: [{ label: "Nave", measurement: "surface", substrates: [{ key: "walls", quantity: 4850, coats, ...(prepHours ? { prepHours } : {}) }] }] });
const eng = [1, 2, 3].map((c) => paintTakeoff(wallTakeoff(c), books.interior_painting));
ok("the BUILDER's engine: 1, 2 or 3 coats of 4,850 sq ft of wall — the same hours", eng[0].hours === eng[1].hours && eng[1].hours === eng[2].hours, eng.map((e) => e.hours));
ok("…and the paint scales with the coats", eng[1].material > eng[0].material * 1.7 && eng[2].material > eng[1].material * 1.3, eng.map((e) => e.material));
const before = pricingOf(model);
const twoCoats = applyOps(model, [{ op: "set_surface", surfaceId: "s1", coats: 2 }, { op: "set_surface", surfaceId: "s2", coats: 2 }], opsCtx, { actor: "model" }).model;
const after = pricingOf(twoCoats);
ok("the read does what the builder does: 2 coats doubles the paint and leaves the hours (45.1 h stayed 45.1 h)", near(after.pricing.painting.hours, before.pricing.painting.hours, 0.001) && after.pricing.painting.materialCost > before.pricing.painting.materialCost * 1.7, [before.pricing.painting, after.pricing.painting]);
ok("…its hours ARE the engine's hours for the takeoff the builder opens", near(after.pricedPaint.groups.reduce((n, g) => n + paintTakeoff(g.takeoff, books.interior_painting).hours, 0), after.pricing.painting.hours, 0.01));
ok("each draft line carries its coats, so the screen shows them beside the hours", after.pricedPaint.lines.every((l) => l.coats === 2), after.pricedPaint.lines.map((l) => l.coats));
const withPrep = applyOps(twoCoats, [{ op: "set_prep_hours", surfaceId: "s1", hours: 24, text: "nave walls 30–45 ft up, scaffold moves" }], opsCtx, { actor: "person" });
const prepped = pricingOf(withPrep.model);
const nave = (p) => p.pricedPaint.lines.find((l) => l.surfaceId === "s1");
const rate = paintTakeoff(wallTakeoff(2), books.interior_painting).areas[0].lines[0].hourlySellRate;
ok("24 extra prep hours on the nave walls: the line gains 24 h and 24 h × its own hourly rate", near(nave(prepped).hours - nave(after).hours, 24) && near(nave(prepped).labour - nave(after).labour, 24 * rate), [nave(after), nave(prepped), rate]);
ok("…exactly what the builder's own \"Prep hours\" on that line gives", near(paintTakeoff(wallTakeoff(2, 24), books.interior_painting).total - paintTakeoff(wallTakeoff(2), books.interior_painting).total, 24 * rate));
ok("…the takeoff the quote opens with carries them (row.prepHours)", prepped.pricedPaint.groups.some((g) => g.takeoff.areas.some((a) => a.substrates.some((s) => s.key === "walls" && s.prepHours === 24))));
ok("…and the recommendation's crew-hours count them", near(prepped.pricing.recommendation.hours - after.pricing.recommendation.hours, 24, 0.01), [after.pricing.recommendation.hours, prepped.pricing.recommendation.hours]);
ok("…with the reason on the crew note, never the client's", prepped.pricedPaint.groups[0].takeoff.areas.some((a) => /\+24 h prep \(nave walls/.test(a.crewNote || "") && !a.clientNote));
const off = applyOps(withPrep.model, [{ op: "set_prep_hours", surfaceId: "s1", hours: 0 }], opsCtx, { actor: "person" });
ok("0 takes them off again", !off.model.surfaces[0].prepHours && near(pricingOf(off.model).pricing.painting.hours, after.pricing.painting.hours));
ok("the screen says the rule beside the coats", /app\.planRead\.draft\.coatsNote/.test(code("app/components/planRead/PlanReadWorkspace.js")) && /Coats change the paint, not the hours/.test(CHAT_SYSTEM));

// ═══════════════════════════════════════════════════════════════════════════
section("4. What an owner naturally asks the chat");
// ═══════════════════════════════════════════════════════════════════════════

ok("CHAT_OPS has set_prep_hours and set_access_price", CHAT_OPS.includes("set_prep_hours") && CHAT_OPS.includes("set_access_price"));
const strict = assertStrictSchema(CHAT_SCHEMA);
ok("CHAT_SCHEMA carries hours and price and stays in the vendor's strict subset", strict.ok && CHAT_SCHEMA.properties.ops.items.required.includes("hours") && CHAT_SCHEMA.properties.ops.items.required.includes("price"), strict.errors);

const booksBefore = md5(books);
const prepTurn = await turn("26.5 hours is far too low for walls 30-45 ft up from scaffolding — adjust the hours", [
  { ok: true, data: { reply: "Added 24 h of prep for the high nave walls.", openSheets: [], ops: [{ ...blankOp, op: "set_prep_hours", surfaceId: "s1", hours: 24, text: "high walls from scaffold, setup and moves" }] } },
]);
ok("\"adjust the hours\" → extra prep hours on the surface, flagged as the AI's", prepTurn.ok && prepTurn.model.surfaces[0].prepHours === 24 && prepTurn.model.surfaces[0].prepSource === "ai" && /Extra prep hours on Nave walls: 24 h — high walls.*FieldQuo AI — verify/.test(prepTurn.changes[0]), prepTurn.changes);
const noWhy = await turn("more hours", [{ ok: true, data: { reply: "", openSheets: [], ops: [{ ...blankOp, op: "set_prep_hours", surfaceId: "s1", hours: 10, text: null }, { ...blankOp, op: "set_prep_hours", surfaceId: "s1", hours: MAX_PREP_HOURS + 1, text: "x" }, { ...blankOp, op: "set_prep_hours", surfaceId: "nope", hours: 5, text: "x" }] } }]);
ok("…never without a reason, never past the cap, never on a surface that isn't there", noWhy.ok && !noWhy.model.surfaces[0].prepHours && noWhy.dropped.length === 3, noWhy.dropped);

const typed = await turn("Put $3,500 on the nave scaffold — erect, move and dismantle.", [
  { ok: true, data: { reply: "Priced the scaffold at 3,500.", openSheets: [], ops: [{ ...blankOp, op: "set_access_price", accessId: "x1", price: 3500 }] } },
]);
ok("a price the estimator TYPED goes on the line, marked as entered by the AI", typed.ok && typed.model.access[0].price === 3500 && typed.model.access[0].priceSource === "ai" && /entered by FieldQuo AI/.test(typed.changes[0]), [typed.model.access[0], typed.changes]);
const accepted = await turn("Yes, use that for the lift.", [{ ok: true, data: { reply: "Done.", openSheets: [], ops: [{ ...blankOp, op: "set_access_price", accessId: "x1", price: 1200 }] } }], {
  history: [
    { role: "user", text: "What should I allow for a 45 ft boom lift?" },
    { role: "assistant", text: "A 45 ft boom lift usually rents for about 1,200 a week; I'd allow one week." },
  ],
});
ok("a figure the AI proposed in its last reply and the estimator ACCEPTED goes on too", accepted.ok && accepted.model.access[0].price === 1200 && accepted.model.access[0].priceSource === "ai", accepted.dropped);
const invented = await turn("Price the scaffold for me.", [{ ok: true, data: { reply: "Set it to 2,750.", openSheets: [], ops: [{ ...blankOp, op: "set_access_price", accessId: "x1", price: 2750 }] } }]);
ok("a figure nobody said is refused — the line stays unpriced", invented.ok && invented.model.access[0].price === null && /isn't a figure you gave or accepted/.test(invented.dropped[0]), invented.dropped);
const hiddenTurn = await turn("Put $3,500 on the scaffold.", [{ ok: true, data: { reply: "", openSheets: [], ops: [{ ...blankOp, op: "set_access_price", accessId: "x1", price: 3500 }] } }], { canSeeMoney: false });
ok("a member whose access hides prices can't price equipment through the chat either", hiddenTurn.ok && hiddenTurn.model.access[0].price === null && /hidden by your access level/.test(hiddenTurn.dropped[0]), hiddenTurn.dropped);
const rateTry = await turn("Change my wall rate to $5 a foot", [{ ok: true, data: { reply: "", openSheets: [], ops: [{ ...blankOp, op: "set_surface", surfaceId: "s1", rate: 5, productionRate: 999, hourlySellRate: 1 }, { ...blankOp, op: "set_rate", rate: 5 }] } }]);
ok("no op can carry a company rate: the extra fields land nowhere, an invented op is refused", rateTry.ok && !("rate" in rateTry.model.surfaces[0]) && !("productionRate" in rateTry.model.surfaces[0]) && rateTry.dropped.some((d) => /Unknown change "set_rate"/.test(d)), rateTry.dropped);
ok("the company's books are byte-identical after every turn", md5(books) === booksBefore);
ok("the messages route says who may price: showPricing", /canSeeMoney: hasToggle\(full, "showPricing"\)/.test(code("app/api/plan-reads/[id]/messages/route.js")));

// ═══════════════════════════════════════════════════════════════════════════
section("5. A typed 0 is a price: owned equipment");
// ═══════════════════════════════════════════════════════════════════════════

const zero = applyOps(model, [{ op: "set_access_price", accessId: "x2", price: 0 }], opsCtx, { actor: "person" });
ok("typing 0 for the owned ladders saves 0 (it was saved as \"no price\")", zero.model.access[1].price === 0 && zero.model.access[1].priceSource === "person", zero.model.access[1]);
ok("clearing the box is still \"no price\"; a negative or a word is refused, the price kept", applyOps(zero.model, [{ op: "set_access_price", accessId: "x2", price: null }], opsCtx, { actor: "person" }).model.access[1].price === null && applyOps(zero.model, [{ op: "set_access_price", accessId: "x2", price: -5 }, { op: "set_access_price", accessId: "x2", price: "abc" }], opsCtx, { actor: "person" }).model.access[1].price === 0);
const zp = pricingOf(applyOps(zero.model, [{ op: "set_access_price", accessId: "x1", price: 3500 }], opsCtx, { actor: "person" }).model);
ok("…priced: nothing left unpriced, the equipment cost is 3,500 + 0", zp.pricedPaint.unpricedAccess === 0 && zp.pricedPaint.accessTotal === 3500 && zp.pricing.recommendation.equipment.unpriced === 0 && zp.pricing.recommendation.equipment.cost === 3500, [zp.pricedPaint.unpricedAccess, zp.pricedPaint.accessTotal, zp.pricing.recommendation.equipment]);
ok("…and the \"equipment without a price\" flag is gone", !zp.pricing.recommendation.flags.includes("equipment_unpriced") && pricingOf(model).pricing.recommendation.flags.includes("equipment_unpriced"), zp.pricing.recommendation.flags);
const draftSrc = code("app/api/plan-reads/[id]/draft-quote/route.js");
ok("the quote gets no $0 line for it (\"free work\"); the review notes name it as your own", /\.filter\(\(a\) => a\.price !== null && a\.price > 0\)/.test(draftSrc) && /a\.price === 0\)\.map\(\(a\) => `• \$\{where\(a\)\}: your own — no charge, no line`\)/.test(draftSrc));
ok("an AI-entered price goes on the quote flagged in its office meta and its review notes", /aiPriced: true/.test(draftSrc) && /price entered by FieldQuo AI from the conversation — verify it/.test(draftSrc));

// ═══════════════════════════════════════════════════════════════════════════
section("6. \"Charged so far\" includes the chat");
// ═══════════════════════════════════════════════════════════════════════════

// The church read's real ledger rows, 2026-10-05, up to the owner's look at
// the banner: the read held 145 and refunded 107 (38 charged), four chat
// turns charged 81 — the balance fell 119 while the banner said 38.
const R = "cmuun5kc00000vst66kp7qc81";
const ledger = [
  { companyId: "co1", cents: -145, ref: `plan_read:${R}:e47e` },
  { companyId: "co1", cents: 107, ref: `refund:plan_read:${R}:e47e` },
  { companyId: "co1", cents: -13, ref: chatChargeRef(R, "7202", 0) },
  { companyId: "co1", cents: -3, ref: chatChargeRef(R, "2ab6", 0) },
  { companyId: "co1", cents: -27, ref: chatChargeRef(R, "2ab6", 1) },
  { companyId: "co1", cents: -3, ref: chatChargeRef(R, "9cd3", 0) },
  { companyId: "co1", cents: -35, ref: chatChargeRef(R, "9cd3", 1) },
  { companyId: "co1", cents: -6, ref: pricingChargeRef(R, "aa01") },
  { companyId: "co1", cents: -50, ref: chatChargeRef(`${R}x`, "zz", 0) },
  { companyId: "co2", cents: -70, ref: chatChargeRef(R, "other-company", 0) },
];
const ledgerDb = {
  voiceCreditEntry: {
    aggregate: async ({ where }) => {
      const hit = ledger.filter((e) => e.companyId === where.companyId && where.OR.some((o) => e.ref.startsWith(o.ref.startsWith)));
      return { _sum: { cents: hit.length ? hit.reduce((n, e) => n + e.cents, 0) : null } };
    },
  },
};
const chatCents = await chatSpendCents({ prisma: ledgerDb, companyId: "co1", planReadId: R });
ok("the chat's spend comes from the ledger: its turns and its pricing button, this read and company only", chatCents === 81 + 6, chatCents);
ok("the refs it sums are the ones the chat and the pricing button are debited under", chatChargeRef("pr1", "t1", 0) === "plan_read_chat:pr1:t1:0" && pricingChargeRef("prx", "t1") === "plan_read_pricing:prx:t1" && /chatChargeRef\(read\.id/.test(code("lib/planRead/chat.js")) && /pricingChargeRef\(read\.id/.test(code("lib/planRead/pricingChat.js")));
const viewMoney = await planReadView({ ...readRow, chargedCents: 38 }, { companyId: "co1", canSeeMoney: true, prisma: viewStub, chatChargedCents: 81 });
ok("the banner's figure is the read AND the chat: 38 + 81 = 119", viewMoney.credits.chargedCents === 119 && viewMoney.credits.readChargedCents === 38 && viewMoney.credits.chatChargedCents === 81, viewMoney.credits);
const viewNoLedger = await planReadView({ ...readRow, chargedCents: 38 }, { companyId: "co1", canSeeMoney: true, prisma: viewStub, chatChargedCents: null });
ok("…and when the ledger can't be asked, the read's alone, said as that", viewNoLedger.credits.chargedCents === 38 && viewNoLedger.credits.chatChargedCents === null);
const pageSrc = code("app/components/planRead/PlanReadWorkspace.js");
ok("the GET route asks the ledger; the screen no longer claims \"chat included in the messages below\"", /chatSpendCents\(\{ prisma: db, companyId: member\.companyId, planReadId: read\.id \}\)/.test(code("app/api/plan-reads/[id]/route.js")) && !/chat included in the messages below/.test(pageSrc) && /app\.planRead\.readDoneSplit/.test(pageSrc));
const msgs = (await import("@/app/i18n/appMessages")).APP_MESSAGES;
const NEW_KEYS = ["app.planRead.readDoneSplit", "app.planRead.readDoneReadOnly", "app.planRead.draft.prep", "app.planRead.draft.aiEntered", "app.planRead.draft.removePrep", "app.planRead.draft.coatsNote"];
const missing = Object.entries(msgs).flatMap(([lang, m]) => NEW_KEYS.filter((k) => !m[k]).map((k) => `${lang}:${k}`));
ok("every new sentence exists in all nine app languages, placeholders intact", missing.length === 0 && Object.values(msgs).every((m) => /\{chat\}/.test(m["app.planRead.readDoneSplit"]) && /\{h\}/.test(m["app.planRead.draft.prep"])), missing);

// ═══════════════════════════════════════════════════════════════════════════
section("7. The equipment subtotal follows a saved price");
// ═══════════════════════════════════════════════════════════════════════════

const base = priceProject(compute(model), books);
const saved = priceProject(compute(applyOps(model, [{ op: "set_access_price", accessId: "x1", price: 1500 }], opsCtx, { actor: "person" }).model), books);
ok("the server's draft subtotal moves by the price saved", near(saved.subtotal - base.subtotal, 1500, 0.001), [base.subtotal, saved.subtotal]);
ok("the screen reloads the read after every save (it then crashed rendering it — section 1)", /await fetchJson\(`\/api\/plan-reads\/\$\{id\}`, \{ method: "PATCH"[\s\S]{0,160}\}\);\s*await load\(\);/.test(pageSrc));

console.log(`\ncheck-plan-read-live-fixes: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
