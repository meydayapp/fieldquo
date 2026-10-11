// scripts/check-job-selections.mjs
//
//   npm run check:job-selections
//
// Colours & materials on the job (JobSelection) and several colour rows per
// quote service (QuoteScopeGroup.selections) — owner, 2026-10-10: "for
// painting jobs shouldn't the job have the color needed? … If they use
// multiple colors it should allow for that. I'm looking at Q-2026-0022 and I
// don't see where I could put that."
//
// EXECUTES, never reads: the rules (lib/jobs/selections.js), the quote → job
// copy and job creation from an accepted quote (lib/jobs/createJobFromQuote.js
// itself), the three route handlers under app/api/jobs/[id]/selections as an
// office manager, a crew member, an estimator and another company, the quote
// builder's payload (md5 against origin/main db116dcc5, before rows existed),
// and the work order model and print sheet (same). The database is
// scripts/fixtures/selectionsDb.mjs, which evaluates the nested WHERE the
// routes send — see its header for why not the shared stub.
//
// Mutation-tested when written; see the list at the bottom of this file.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

process.env.CLOUDINARY_CLOUD_NAME = "fqcloud";

const { state, resetDb } = await import("./fixtures/selectionsDb.mjs");
const { session } = await import("./fixtures/apiMemberStub.mjs");
const S = await import("@/lib/jobs/selections");
const { pullSelectionsFromQuote } = await import("@/lib/jobs/selectionsServer");
const { ensureJobForAcceptedQuote } = await import("@/lib/jobs/createJobFromQuote");
const { scopeGroupPayload, newScopeGroup } = await import("@/lib/quotes/builderPayload");
const { quoteRequestBody } = await import("@/lib/quotes/builderRequest");
const { fixtureGroups, fixtureRequests, CATEGORIES } = await import("./fixtures/builderPayloadFixtures.mjs");
const { buildWorkOrderModel, findWorkOrderMoneyKey } = await import("@/lib/workOrder/build");
const { workOrderPrintHtml } = await import("@/lib/workOrder/printSheet");
const { workOrderCopy, areaFactLines } = await import("@/lib/workOrder/copy");
const { cabinetWorkOrderArgs } = await import("./fixtures/selectionsWorkOrderFixture.mjs");
const { PERMISSION_PRESETS, PRESET_TO_ROLE } = await import("@/lib/permissions");
const { APP_MESSAGES } = await import("@/app/i18n/appMessages.js");
const listRoute = await import("@/app/api/jobs/[id]/selections/route.js");
const rowRoute = await import("@/app/api/jobs/[id]/selections/[selectionId]/route.js");
const pullRoute = await import("@/app/api/jobs/[id]/selections/pull/route.js");
const { db } = await import("@/lib/db");

let pass = 0;
let fail = 0;
const ok = (name, cond, detail = "") => {
  if (cond) pass += 1;
  else fail += 1;
  console.log(`${cond ? "  ok  " : "  FAIL"} ${name}${cond ? "" : `  ${detail}`}`);
};
const eq = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), `got=${JSON.stringify(got)} want=${JSON.stringify(want)}`);
const section = (s) => console.log(`\n${s}\n`);
const md5 = (o) => createHash("md5").update(typeof o === "string" ? o : JSON.stringify(o)).digest("hex");
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const CLOUD = "https://res.cloudinary.com/fqcloud/image/upload/v1/fieldquo/c1/jobs/swatch.jpg";

// ═══════════════════════════════════════════════════════════════════════════
section("1. One row: cleaned, refused when it says nothing, coats never invented");
// ═══════════════════════════════════════════════════════════════════════════
{
  const r = S.normaliseSelectionInput({ area: "  Uppers ", product: "BM", colourName: "Chantilly   Lace", colourCode: "OC-65", finish: "satin", coats: "2", templateKey: "cabinets" });
  ok("a full row is accepted", r.ok, JSON.stringify(r));
  eq("…whitespace collapsed, coats a number, template kept", [r.data.area, r.data.colourName, r.data.coats, r.data.templateKey], ["Uppers", "Chantilly Lace", 2, "cabinets"]);
  eq("…absent fields are null, never ''", [r.data.notes, r.data.swatchUrl], [null, null]);
  const line = S.formatSelectionLine(r.data).line;
  eq("the crew's line: 'Uppers: BM Chantilly Lace OC-65, satin, 2 coats'", line, "Uppers: BM Chantilly Lace OC-65, satin, 2 coats");
  eq("one coat is singular", S.formatSelectionLine({ area: "Ceilings", colourName: "White", coats: 1 }).line, "Ceilings: White, 1 coat");
  eq("no area → just the spec", S.formatSelectionLine({ product: "GAF Timberline HDZ", colourName: "Charcoal" }).line, "GAF Timberline HDZ Charcoal");
  eq("no coats stated → no coats printed", S.formatSelectionLine({ area: "Trim", finish: "semi-gloss" }).line, "Trim: semi-gloss");

  for (const bad of ["0", 0, "-1", "2.5", 21, "two", "1e1x", {}]) {
    const x = S.normaliseSelectionInput({ area: "Walls", coats: bad });
    ok(`coats ${JSON.stringify(bad)} refused, not rounded or clamped`, !x.ok && x.code === "coats", JSON.stringify(x));
  }
  ok("coats '' is 'not stated' (null), accepted", S.normaliseSelectionInput({ area: "Walls", coats: "" }).data?.coats === null);

  for (const blank of [{}, { area: "   " }, { notes: "\n\n" }, { coats: "" }, { area: null, product: undefined }, null, "x", { area: { toString: () => "x" } }]) {
    const x = S.normaliseSelectionInput(blank);
    ok(`a row that says nothing is refused: ${JSON.stringify(blank)}`, !x.ok && x.code === "empty", JSON.stringify(x));
  }

  const long = S.normaliseSelectionInput({ area: "a".repeat(500), notes: "n".repeat(5000), colourCode: "c".repeat(400) });
  ok("long input is capped to the column limits", long.ok && long.data.area.length === 80 && long.data.notes.length === 500 && long.data.colourCode.length === 40);

  for (const url of [
    "https://res.cloudinary.com/othercloud/image/upload/v1/x.jpg",
    "http://res.cloudinary.com/fqcloud/image/upload/x.jpg",
    "javascript:alert(1)",
    "https://evil.example/res.cloudinary.com/fqcloud/x.jpg",
    "https://res.cloudinary.com.evil.example/fqcloud/x.jpg",
    42,
  ]) {
    const x = S.normaliseSelectionInput({ area: "Walls", swatchUrl: url }, { cloudName: "fqcloud" });
    ok(`swatch ${String(url).slice(0, 48)} refused (not dropped)`, !x.ok && x.code === "swatch", JSON.stringify(x));
  }
  ok("our own Cloudinary swatch is accepted", S.normaliseSelectionInput({ area: "Walls", swatchUrl: CLOUD }, { cloudName: "fqcloud" }).data?.swatchUrl === CLOUD);

  const partial = S.normaliseSelectionInput({ notes: "two coats on the island" }, { partial: true });
  eq("a PATCH carries ONLY the keys sent — editing the notes cannot blank the colour", Object.keys(partial.data), ["notes"]);
  ok("an unknown template key falls back to generic", S.normaliseSelectionInput({ area: "x", templateKey: "<script>" }).data.templateKey === "generic");
}

// ═══════════════════════════════════════════════════════════════════════════
section("2. Trade templates suggest; they never fill");
// ═══════════════════════════════════════════════════════════════════════════
{
  eq("trade → template",
    ["interior_painting", "exterior_painting", "cabinet_refinishing", "cabinet_refacing", "roofing_service", "epoxy", "epoxy_floor", "flooring_install", "plumbing", "", null].map(S.templateKeyForTrade),
    ["painting", "painting", "cabinets", "cabinets", "roofing", "epoxy", "epoxy", "flooring", "generic", "generic", "generic"]);
  ok("cabinets offer gel and liquid stain as finishes", S.SELECTION_TEMPLATES.cabinets.finishes.some(([k]) => k.endsWith("gelStain")) && S.SELECTION_TEMPLATES.cabinets.finishes.some(([k]) => k.endsWith("liquidStain")));
  ok("roofing suggests shingles, underlayment and drip edge", ["shingles", "underlayment", "dripEdge"].every((a) => S.SELECTION_TEMPLATES.roofing.areas.some(([k]) => k.endsWith(`.${a}`))));
  ok("epoxy suggests base coat, flake and topcoat", ["baseCoat", "flake", "topcoat"].every((a) => S.SELECTION_TEMPLATES.epoxy.areas.some(([k]) => k.endsWith(`.${a}`))));
  const fields = read("app/components/selections/SelectionFields.js");
  ok("suggestions are a <datalist> under a free-text box, never a <select> that limits", /list=\{tpl\.areas\.length/.test(fields) && /<datalist/.test(fields) && !/<select/.test(fields));
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. The quote builder: byte-identical when no rows are used (md5s from origin/main db116dcc5)");
// ═══════════════════════════════════════════════════════════════════════════
const BASELINE = {
  "group:cab:en": "196e0b2e79ff5f71bf0ee3cdf37cff93",
  "group:cab:fr": "449918758dbceda6b5a0e9a79d30c983",
  "group:stairs:en": "6e295eafccd377b64213be3dac363ac3",
  "group:stairs:fr": "3947a16dd184cd472793db1a3f64ae9e",
  "group:plumbing:en": "173492c9e10602f6e9e91ecec3bb1ce7",
  "group:plumbing:fr": "173492c9e10602f6e9e91ecec3bb1ce7",
  "group:custom:en": "b86bffb57bc45c63f65a920d49a6125c",
  "group:custom:fr": "b86bffb57bc45c63f65a920d49a6125c",
  "group:persisted:en": "59c0d5e78d3e2af17069d06258b0babc",
  "group:persisted:fr": "59c0d5e78d3e2af17069d06258b0babc",
  // A NEW cabinet group with Colour / Sheen / Door style and top coats typed.
  "group:cab2:en": "f925781eff606861f7516fa214485ffe",
  "group:cab2:fr": "f925781eff606861f7516fa214485ffe",
  // A SAVED cabinet group shaped like Q-2026-0022 (door style "slab" only).
  "group:storedCab:en": "741cd06af617e393577d566772ebc901",
  "group:storedCab:fr": "741cd06af617e393577d566772ebc901",
  "request:create": "2436f97523b1900781a90ecafc48ff76",
  "request:edit": "40372420a3562970c5b67a29be8d299c",
  "request:decided": "5a03bda4995ae15e5726ec9652d312be",
};
function builderGroups() {
  const g = fixtureGroups();
  const cab2 = newScopeGroup(CATEGORIES.cabinets, "Kitchen cabinets", null, { tempId: "t_cab2", intakeValues: { doorCount: 20, drawerCount: 6 } });
  cab2.color = "Chantilly Lace OC-65";
  cab2.sheen = "satin";
  cab2.doorStyle = "slab";
  cab2.topCoats = 2;
  const storedCab = {
    tempId: "g_cab", id: "g_cab", persisted: true, imported: false, categoryId: "cat_cab", categoryKey: "cabinet_refinishing",
    label: "Kitchen cabinets", isTiered: false, selectedTier: null, intakeValues: { doorCount: 20, drawerCount: 6, topCoats: 2 }, takeoff: null,
    lineItems: [{ description: "Kitchen cabinets", quantity: 26, unit: "unit", rate: 150, amount: 3900, meta: { baseUnitPrice: 150, complexityLevel: "standard", complexityReasons: [], color: "", sheen: "", doorStyle: "slab" } }],
  };
  return { ...g, cab2, storedCab };
}
function hashAll(groups) {
  const out = {};
  const payloads = [];
  for (const [k, grp] of Object.entries(groups)) {
    for (const lang of ["en", "fr"]) {
      const p = scopeGroupPayload(grp, null, lang);
      out[`group:${k}:${lang}`] = md5(p);
      if (lang === "en") payloads.push(p);
    }
  }
  for (const [k, s] of Object.entries(fixtureRequests(payloads))) out[`request:${k}`] = md5(quoteRequestBody(s));
  return out;
}
{
  const now = hashAll(builderGroups());
  for (const [k, v] of Object.entries(BASELINE)) eq(`${k} unchanged`, now[k], v);

  // An empty list, or only blank rows, is the same statement as none at all.
  const blanks = builderGroups();
  for (const grp of Object.values(blanks)) grp.selections = [S.newQuoteSelectionRow(), { id: "x", area: "  ", coats: "" }];
  const nowBlank = hashAll(blanks);
  for (const [k, v] of Object.entries(BASELINE)) eq(`${k} unchanged with only blank rows`, nowBlank[k], v);

  const withRows = builderGroups();
  withRows.cab2.selections = [
    { id: "r1", area: "Uppers", product: "BM", colourName: "Chantilly Lace", colourCode: "OC-65", finish: "satin", coats: "2", notes: "" },
    { id: "r2", area: "Island", product: "BM", colourName: "Hale Navy", colourCode: "HC-154", finish: "satin", coats: 2, notes: "" },
  ];
  const p = scopeGroupPayload(withRows.cab2, null, "en");
  eq("two rows travel as `selections`, cleaned (coats a number, blanks null)", p.selections, [
    { id: "r1", area: "Uppers", product: "BM", colourName: "Chantilly Lace", colourCode: "OC-65", finish: "satin", notes: null, coats: 2 },
    { id: "r2", area: "Island", product: "BM", colourName: "Hale Navy", colourCode: "HC-154", finish: "satin", notes: null, coats: 2 },
  ]);
  const base = scopeGroupPayload(builderGroups().cab2, null, "en");
  const { selections: _drop, ...rest } = p;
  eq("…and NOTHING else in the payload moved: lines, meta colour/sheen/door style, subtotal", md5(rest), md5(base));
  eq("…the cabinet fields are still in the base line's meta, exactly as before", p.lineItems[0].meta.color + "|" + p.lineItems[0].meta.sheen + "|" + p.lineItems[0].meta.doorStyle, "Chantilly Lace OC-65|satin|slab");

  const cleared = { ...builderGroups().storedCab, selectionsStored: true };
  eq("a SAVED group whose rows were all removed sends selections: [] (a clear)", scopeGroupPayload(cleared, null, "en").selections, []);
  const neverHad = builderGroups().storedCab;
  ok("…one that never had rows sends no key at all", !("selections" in scopeGroupPayload(neverHad, null, "en")));

  const dup = S.normaliseQuoteGroupSelections([{ id: "a", area: "x" }, { id: "a", area: "y" }, { id: "bad id!", area: "z" }], { makeId: (() => { let n = 0; return () => `gen${++n}`; })() });
  eq("duplicate and malformed row ids are replaced, never shared", dup.map((r) => r.id), ["a", "gen1", "gen2"]);
  ok("a group's rows are capped", S.normaliseQuoteGroupSelections(Array.from({ length: 50 }, (_, i) => ({ id: `r${i}`, area: `A${i}` }))).length === S.MAX_SELECTIONS_PER_GROUP);
  ok("no swatch rides on a quote row", !("swatchUrl" in (S.normaliseQuoteGroupSelections([{ id: "a", area: "x", swatchUrl: CLOUD }])[0])));

  // The persistence half: both write paths go through one helper with the
  // same three-way rule (absent → untouched, rows → rows, none → SQL NULL).
  const { quoteGroupSelectionsData } = await import("@/lib/quotes/groupSelectionsData");
  const { Prisma } = await import("@prisma/client");
  eq("absent → the column is not touched", quoteGroupSelectionsData({ categoryId: "c" }), {});
  ok("[] → cleared to SQL NULL (DbNull), never []", quoteGroupSelectionsData({ selections: [] }).selections === Prisma.DbNull);
  eq("rows → cleaned rows", quoteGroupSelectionsData({ selections: [{ id: "a", area: " Walls " }] }).selections.map((r) => r.area), ["Walls"]);
  ok("POST /api/quotes writes them through the helper", /\.\.\.quoteGroupSelectionsData\(g\)/.test(read("app/api/quotes/route.js")));
  ok("PATCH (reconcileScopeGroups) writes them through the helper", /\.\.\.quoteGroupSelectionsData\(g\)/.test(read("lib/quotes/importQuote.js")));
  const builder = read("app/components/quotes/builder/QuoteBuilder.js");
  ok("the builder reads them back from a saved group (groupFromStored)", /selections: g\.selections, selectionsStored: true/.test(builder));
  ok("the builder renders the rows editor for every group", /<GroupSelections\s/.test(builder) && /onChange=\{\(next\) => updateSelections\(group\.tempId, next\)\}/.test(builder));
  ok("the existing Colour / Sheen / Door style boxes are still rendered", /onPricingChange\(\{ color: e\.target\.value \}\)/.test(read("app/components/quotes/builder/UnitPricingFields.js")) && /onPricingChange\(\{ doorStyle: e\.target\.value \}\)/.test(read("app/components/quotes/builder/UnitPricingFields.js")));
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. The cabinet finish is the first row — new group, saved group (Q-2026-0022's shape)");
// ═══════════════════════════════════════════════════════════════════════════
{
  const { cab2, storedCab } = builderGroups();
  eq("new group: Colour / Sheen / Door style / top coats", S.legacyFinishOf(cab2), { colour: "Chantilly Lace OC-65", sheen: "satin", doorStyle: "slab", coats: 2 });
  eq("saved group: read from the base line's meta (door style only, as on Q-2026-0022)", S.legacyFinishOf(storedCab), { colour: null, sheen: null, doorStyle: "slab", coats: 2 });
  ok("a group with none of the three has no first row (coats alone are a pricing answer)", S.legacyFinishOf({ intakeValues: { topCoats: 2 }, lineItems: [] }) === null);
  ok("a fresh cabinet group (all three blank) has no first row", S.legacyFinishOf(newScopeGroup(CATEGORIES.cabinets, "K", null, { tempId: "t" })) === null);
  const row = S.legacyFinishRow(storedCab, { area: "Kitchen cabinets", doorStyleText: (v) => `Door style: ${v}` });
  eq("…as a row: area = the service, door style in the notes", [row.area, row.colourName, row.finish, row.coats, row.notes], ["Kitchen cabinets", null, null, 2, "Door style: slab"]);
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. Prefill when the job is created from an accepted quote (lib/jobs/createJobFromQuote.js, executed)");
// ═══════════════════════════════════════════════════════════════════════════
const CO_A = "co_a";
const CO_B = "co_b";
function quoteRow({ id = "q1", companyId = CO_A, groups }) {
  return { id, companyId, clientId: "cl1", quoteNumber: "Q-2026-0022", quoteType: null, status: "accepted", siteAddress: null, clientPoNumber: null, client: { name: "Maureen" }, scopeGroups: groups };
}
const MAUREEN_GROUP = {
  id: "g_cab", sortOrder: 0, label: "Cabinet Refinishing", category: { key: "cabinet_refinishing", label: "Cabinet Refinishing" },
  intakeValues: { doorCount: 20, drawerCount: 6 }, selections: null,
  lineItems: [{ description: "Cabinet Refinishing", quantity: 26, unit: "unit", rate: 150, amount: 3900, meta: { color: "", sheen: "", doorStyle: "slab" } }],
};
const MULTI_GROUP = {
  id: "g_kit", sortOrder: 1, label: "Kitchen", category: { key: "cabinet_refinishing", label: "Cabinet Refinishing" },
  intakeValues: { topCoats: 2 }, lineItems: [{ description: "Kitchen", quantity: 30, unit: "unit", rate: 150, amount: 4500, meta: { color: "Chantilly Lace", sheen: "satin", doorStyle: "Shaker" } }],
  selections: [
    { id: "r_up", area: "Uppers", product: "BM", colourName: "Chantilly Lace", colourCode: "OC-65", finish: "satin", coats: 2, notes: null },
    { id: "r_isl", area: "Island", product: "BM", colourName: "Hale Navy", colourCode: "HC-154", finish: "satin", coats: 2, notes: "Two-tone" },
  ],
};
const PAINT_GROUP = {
  id: "g_paint", sortOrder: 2, label: "Living room", category: { key: "interior_painting", label: "Interior Painting" },
  intakeValues: {}, lineItems: [{ description: "Walls", quantity: 1, unit: "flat", rate: 900, amount: 900 }],
  selections: [{ id: "r_w", area: "Walls", product: "BM Regal Select", colourName: "Pale Oak", colourCode: "OC-20", finish: "eggshell", coats: 2, notes: null }],
};
// createJobFromQuote's OTHER best-effort steps (imported costs, checklists,
// site visits, waivers) reach models this fixture does not script; each one
// catches and logs, exactly as in production. Collected rather than printed,
// and the only assertion about them is that the colour copy was not among
// the failures.
const logged = [];
const realError = console.error;
console.error = (...a) => logged.push(a.map(String).join(" "));
{
  resetDb({ quote: [quoteRow({ groups: [MAUREEN_GROUP, MULTI_GROUP, PAINT_GROUP] })], company: [{ id: CO_A, defaultLanguage: "en" }] });
  const job = await ensureJobForAcceptedQuote("q1", { db });
  ok("the job was created", Boolean(job?.id), JSON.stringify(job));
  const rows = state.rows.jobSelection.filter((r) => r.jobId === job.id).sort((a, b) => a.sortOrder - b.sortOrder);
  eq("every colour on the quote is on the job, in the quote's order (finish first per service)", rows.map((r) => r.sourceKey), [
    "qsg:g_cab:finish", "qsg:g_kit:finish", "qsg:g_kit:r_up", "qsg:g_kit:r_isl", "qsg:g_paint:r_w",
  ]);
  eq("Q-2026-0022's door style 'slab' became a row", [rows[0].area, rows[0].notes, rows[0].colourName], ["Cabinet Refinishing", "Door style: slab", null]);
  eq("the Kitchen group's Colour / Sheen / top coats became its first row", [rows[1].colourName, rows[1].finish, rows[1].coats, rows[1].notes], ["Chantilly Lace", "satin", 2, "Door style: Shaker"]);
  eq("multiple rows per service: Uppers and Island", rows.slice(2, 4).map((r) => S.formatSelectionLine(r).line), [
    "Uppers: BM Chantilly Lace OC-65, satin, 2 coats", "Island: BM Hale Navy HC-154, satin, 2 coats",
  ]);
  eq("templates follow the trade", rows.map((r) => r.templateKey), ["cabinets", "cabinets", "cabinets", "cabinets", "painting"]);
  ok("every row is in the job's company and links its quote group", rows.every((r) => r.companyId === CO_A && r.quoteScopeGroupId));

  // A French company's crew reads "Style de porte".
  resetDb({ quote: [quoteRow({ groups: [MAUREEN_GROUP] })], company: [{ id: CO_A, defaultLanguage: "fr" }] });
  const fj = await ensureJobForAcceptedQuote("q1", { db });
  eq("the door style is worded in the company's language", state.rows.jobSelection.find((r) => r.jobId === fj.id)?.notes, "Style de porte : slab");

  // A quote with no colours makes an empty card, not a row of nothing.
  resetDb({ quote: [quoteRow({ groups: [{ ...PAINT_GROUP, selections: null }] })], company: [{ id: CO_A, defaultLanguage: "en" }] });
  await ensureJobForAcceptedQuote("q1", { db });
  ok("no colours on the quote → no rows written", state.rows.jobSelection.length === 0);

  // The manual path (POST /api/jobs with a quoteId) makes the same copy.
  const createJobSrc = read("lib/jobs/createJob.js");
  ok("lib/jobs/createJob.js (a job made by hand from a quote) carries them too", /carrySelectionsIntoJob\(db, \{ jobId: job\.id, companyId, quoteId/.test(createJobSrc));
}
console.error = realError;
ok("the colour copy never logged a failure (the other steps' logs are theirs)", !logged.some((l) => l.includes("[selections]")), logged.filter((l) => l.includes("[selections]")).join(" | "));

// ═══════════════════════════════════════════════════════════════════════════
section("6. 'Pull from quote' is idempotent, and never overwrites an edit");
// ═══════════════════════════════════════════════════════════════════════════
{
  // Maureen's job: made before the copy existed, so it has no rows.
  resetDb({
    quote: [quoteRow({ groups: [MAUREEN_GROUP, MULTI_GROUP] })],
    company: [{ id: CO_A, defaultLanguage: "en" }],
    jobSelection: [{ id: "typed", companyId: CO_A, jobId: "j1", sourceKey: null, area: "Hardware", product: "Brushed nickel pulls", sortOrder: 1, templateKey: "generic" }],
  });
  const args = { jobId: "j1", companyId: CO_A, quoteId: "q1" };
  const first = await pullSelectionsFromQuote(db, args);
  eq("first pull adds the quote's 4 rows", [first.added, first.total], [4, 4]);
  ok("…after the row typed on the job", state.rows.jobSelection.filter((r) => r.sourceKey).every((r) => r.sortOrder > 1));
  const second = await pullSelectionsFromQuote(db, args);
  eq("second pull adds nothing", [second.added, second.skipped], [0, 4]);
  eq("…the job still has 5 rows", state.rows.jobSelection.filter((r) => r.jobId === "j1").length, 5);

  const up = state.rows.jobSelection.find((r) => r.sourceKey === "qsg:g_kit:r_up");
  up.colourName = "Simply White";
  await pullSelectionsFromQuote(db, args);
  eq("an edited pulled row is left as edited", state.rows.jobSelection.find((r) => r.sourceKey === "qsg:g_kit:r_up").colourName, "Simply White");

  state.rows.jobSelection = state.rows.jobSelection.filter((r) => r.sourceKey !== "qsg:g_kit:r_isl");
  const back = await pullSelectionsFromQuote(db, args);
  eq("a removed pulled row comes back on the next pull, and only it", [back.added, state.rows.jobSelection.filter((r) => r.sourceKey === "qsg:g_kit:r_isl").length], [1, 1]);

  // Two presses at once: both see the row missing; the unique index lets one write it.
  state.rows.jobSelection = state.rows.jobSelection.filter((r) => !r.sourceKey);
  const [a, b] = await Promise.all([pullSelectionsFromQuote(db, args), pullSelectionsFromQuote(db, args)]);
  eq("two concurrent pulls write each row once", state.rows.jobSelection.filter((r) => r.sourceKey).length, 4);
  ok("…and say so honestly (added counts sum to 4)", a.added + b.added === 4, JSON.stringify([a, b]));

  // Near the per-job cap, the room left goes to rows the job LACKS — never
  // spent re-offering rows it already has.
  const typed = Array.from({ length: S.MAX_SELECTIONS_PER_JOB - 4 }, (_, i) => ({ id: `t${i}`, companyId: CO_A, jobId: "j9", sourceKey: null, area: `Typed ${i}`, sortOrder: i + 1 }));
  resetDb({
    quote: [quoteRow({ groups: [MAUREEN_GROUP, MULTI_GROUP] })],
    company: [{ id: CO_A, defaultLanguage: "en" }],
    jobSelection: [
      ...typed,
      { id: "p1", companyId: CO_A, jobId: "j9", sourceKey: "qsg:g_cab:finish", area: "x", sortOrder: 200 },
      { id: "p2", companyId: CO_A, jobId: "j9", sourceKey: "qsg:g_kit:finish", area: "y", sortOrder: 201 },
    ],
  });
  const capped = await pullSelectionsFromQuote(db, { jobId: "j9", companyId: CO_A, quoteId: "q1" });
  eq("at the cap's edge the 2 missing rows are added (not the 2 already there)", [capped.added, state.rows.jobSelection.length], [2, S.MAX_SELECTIONS_PER_JOB]);
  const full = await pullSelectionsFromQuote(db, { jobId: "j9", companyId: CO_A, quoteId: "q1" });
  eq("…and a full job takes no more", [full.added, state.rows.jobSelection.length], [0, S.MAX_SELECTIONS_PER_JOB]);

  const foreign = await pullSelectionsFromQuote(db, { jobId: "j1", companyId: CO_B, quoteId: "q1" });
  ok("another company's quote id pulls nothing", foreign.noQuote === true && foreign.added === 0);
}

// ═══════════════════════════════════════════════════════════════════════════
section("7. The routes: who reads, who changes, and another company's job (executed)");
// ═══════════════════════════════════════════════════════════════════════════
const MANAGER = { id: "m_mgr", userId: "u_mgr", companyId: CO_A, role: PRESET_TO_ROLE.manager, permissions: PERMISSION_PRESETS.manager.values };
const CREW = { id: "m_crew", userId: "u_crew", companyId: CO_A, role: PRESET_TO_ROLE.worker, permissions: PERMISSION_PRESETS.worker.values };
const ESTIMATOR = { id: "m_est", userId: "u_est", companyId: CO_A, role: PRESET_TO_ROLE.estimator, permissions: PERMISSION_PRESETS.estimator.values };
const OTHER = { id: "m_b", userId: "u_b", companyId: CO_B, role: "owner", permissions: null };

function seedRoutes() {
  resetDb({
    member: [MANAGER, CREW, ESTIMATOR, OTHER],
    company: [{ id: CO_A, defaultLanguage: "en" }, { id: CO_B, defaultLanguage: "en" }],
    quote: [quoteRow({ groups: [MAUREEN_GROUP, MULTI_GROUP] })],
    job: [
      // The crew member is booked on j1 (a visit), not on j2.
      { id: "j1", companyId: CO_A, quoteId: "q1", visits: [{ assignedToId: "u_crew" }], shifts: [] },
      { id: "j2", companyId: CO_A, quoteId: null, visits: [], shifts: [] },
      { id: "jb", companyId: CO_B, quoteId: null, visits: [], shifts: [] },
    ],
    jobSelection: [
      { id: "s1", companyId: CO_A, jobId: "j1", sourceKey: null, area: "Walls", colourName: "Pale Oak", sortOrder: 1, templateKey: "painting" },
      { id: "s2", companyId: CO_A, jobId: "j1", sourceKey: null, area: "Trim", colourName: "Chantilly Lace", sortOrder: 2, templateKey: "painting" },
      { id: "sb", companyId: CO_B, jobId: "jb", sourceKey: null, area: "Shingles", colourName: "Charcoal", sortOrder: 1, templateKey: "roofing" },
    ],
  });
}
const req = (method, body) => new Request("http://localhost/api", { method, headers: { "Content-Type": "application/json" }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
const ctx = (id, selectionId) => ({ params: Promise.resolve(selectionId ? { id, selectionId } : { id }) });
async function call(member, fn, ...args) {
  session.member = member;
  const res = await fn(...args);
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}
const selectionWrites = () => state.writes.filter((w) => w.model === "jobSelection");
{
  seedRoutes();
  const g = await call(MANAGER, listRoute.GET, req("GET"), ctx("j1"));
  eq("manager GET: 200, both rows in order, may edit, has a quote", [g.status, g.body.selections.map((r) => r.id), g.body.canEdit, g.body.hasQuote], [200, ["s1", "s2"], true, true]);
  eq("…the job's quote suggests the cabinets template", g.body.templates, ["cabinets"]);

  const c = await call(MANAGER, listRoute.POST, req("POST", { area: "Ceilings", colourName: "Super White", finish: "flat", coats: 2, templateKey: "painting" }), ctx("j1"));
  ok("manager POST: 201 and the row is last", c.status === 201 && c.body.selections.at(-1).area === "Ceilings", JSON.stringify(c));
  const newId = c.body.selections.at(-1).id;
  ok("…written in the caller's company, on this job", state.rows.jobSelection.find((r) => r.id === newId)?.companyId === CO_A && state.rows.jobSelection.find((r) => r.id === newId)?.jobId === "j1");

  const e = await call(MANAGER, rowRoute.PATCH, req("PATCH", { colourCode: "OC-117" }), ctx("j1", newId));
  ok("manager PATCH: only the colour code changed", e.status === 200 && e.body.selections.find((r) => r.id === newId).colourCode === "OC-117" && e.body.selections.find((r) => r.id === newId).colourName === "Super White");
  const blank = await call(MANAGER, rowRoute.PATCH, req("PATCH", { area: "", colourName: "", colourCode: "", finish: "", coats: "" }), ctx("j1", newId));
  eq("a PATCH that would leave the row saying nothing is refused", [blank.status, blank.body.code], [400, "empty"]);
  const sw = await call(MANAGER, rowRoute.PATCH, req("PATCH", { swatchUrl: "https://example.com/a.jpg" }), ctx("j1", newId));
  eq("a swatch from anywhere but our Cloudinary is refused", [sw.status, sw.body.code], [400, "swatch"]);
  const sw2 = await call(MANAGER, rowRoute.PATCH, req("PATCH", { swatchUrl: CLOUD }), ctx("j1", newId));
  ok("…an uploaded one (uploadFile → our cloud) is kept", sw2.status === 200 && sw2.body.selections.find((r) => r.id === newId).swatchUrl === CLOUD);

  const o = await call(MANAGER, listRoute.PATCH, req("PATCH", { order: [newId, "s2", "s1"] }), ctx("j1"));
  eq("manager reorder: the order sticks", o.body.selections.map((r) => r.id), [newId, "s2", "s1"]);
  const stale = await call(MANAGER, listRoute.PATCH, req("PATCH", { order: ["s1", "s2"] }), ctx("j1"));
  eq("a stale order (a row missing) is refused, not half-applied", [stale.status, stale.body.code], [409, "stale_order"]);
  const sneaky = await call(MANAGER, listRoute.PATCH, req("PATCH", { order: [newId, "s2", "sb"] }), ctx("j1"));
  ok("an order naming another company's row is refused", sneaky.status === 409);
  eq("…and moved nothing", state.rows.jobSelection.find((r) => r.id === "sb").sortOrder, 1);

  const before = structuredClone(state.rows);
  const d = await call(MANAGER, rowRoute.DELETE, req("DELETE"), ctx("j1", "s2"));
  ok("manager DELETE: 200, s2 gone", d.status === 200 && !d.body.selections.some((r) => r.id === "s2"));
  ok("…remove means the row ONLY: the other rows, the job, the quote and the other company are untouched",
    state.rows.jobSelection.length === before.jobSelection.length - 1 &&
      JSON.stringify(state.rows.job) === JSON.stringify(before.job) &&
      JSON.stringify(state.rows.quote) === JSON.stringify(before.quote) &&
      state.rows.jobSelection.some((r) => r.id === "sb"));
  const dw = selectionWrites().filter((w) => w.op === "deleteMany").at(-1);
  ok("…the delete's WHERE names the row, the job AND the company", dw.where.id === "s2" && dw.where.jobId === "j1" && dw.where.companyId === CO_A, JSON.stringify(dw));

  const p1 = await call(MANAGER, pullRoute.POST, req("POST"), ctx("j1"));
  const p2 = await call(MANAGER, pullRoute.POST, req("POST"), ctx("j1"));
  eq("manager 'Pull from quote' twice through the route: 4 added, then 0", [p1.status, p1.body.pulled.added, p2.body.pulled.added], [200, 4, 0]);
  const noQuote = await call(MANAGER, pullRoute.POST, req("POST"), ctx("j2"));
  eq("a job with no quote: pull refused with a reason", [noQuote.status, noQuote.body.code], [400, "no_quote"]);
}
{
  seedRoutes();
  const g = await call(CREW, listRoute.GET, req("GET"), ctx("j1"));
  eq("CREW on their job: reads the rows, canEdit false", [g.status, g.body.selections.length, g.body.canEdit], [200, 2, false]);
  const writesBefore = selectionWrites().length;
  const attempts = [
    ["POST", await call(CREW, listRoute.POST, req("POST", { area: "Doors" }), ctx("j1"))],
    ["reorder", await call(CREW, listRoute.PATCH, req("PATCH", { order: ["s2", "s1"] }), ctx("j1"))],
    ["PATCH", await call(CREW, rowRoute.PATCH, req("PATCH", { colourName: "Black" }), ctx("j1", "s1"))],
    ["DELETE", await call(CREW, rowRoute.DELETE, req("DELETE"), ctx("j1", "s1"))],
    ["pull", await call(CREW, pullRoute.POST, req("POST"), ctx("j1"))],
  ];
  for (const [verb, r] of attempts) eq(`CREW ${verb}: 403 read_only`, [r.status, r.body.code], [403, "read_only"]);
  eq("…and not one write reached the table", selectionWrites().length, writesBefore);
  const notOn = await call(CREW, listRoute.GET, req("GET"), ctx("j2"));
  eq("CREW on a job they are not booked on: 404, as if it did not exist", notOn.status, 404);

  const est = await call(ESTIMATOR, listRoute.GET, req("GET"), ctx("j2"));
  eq("ESTIMATOR (jobs view-only, whole board): reads any job, cannot edit", [est.status, est.body.canEdit], [200, false]);
  const estW = await call(ESTIMATOR, listRoute.POST, req("POST", { area: "Doors" }), ctx("j2"));
  eq("…a write is 403", estW.status, 403);

  const signedOut = await call(null, listRoute.GET, req("GET"), ctx("j1"));
  eq("signed out: 401", signedOut.status, 401);
}
{
  seedRoutes();
  const writesBefore = selectionWrites().length;
  const tries = [
    ["GET", await call(OTHER, listRoute.GET, req("GET"), ctx("j1"))],
    ["POST", await call(OTHER, listRoute.POST, req("POST", { area: "Doors" }), ctx("j1"))],
    ["reorder", await call(OTHER, listRoute.PATCH, req("PATCH", { order: ["s1", "s2"] }), ctx("j1"))],
    ["PATCH", await call(OTHER, rowRoute.PATCH, req("PATCH", { colourName: "Black" }), ctx("j1", "s1"))],
    ["DELETE", await call(OTHER, rowRoute.DELETE, req("DELETE"), ctx("j1", "s1"))],
    ["pull", await call(OTHER, pullRoute.POST, req("POST"), ctx("j1"))],
  ];
  for (const [verb, r] of tries) eq(`ANOTHER COMPANY's owner, ${verb} on our job: 404`, r.status, 404);
  eq("…and nothing was written", selectionWrites().length, writesBefore);

  // Their own job id, with OUR row id in the URL.
  const cross = await call(OTHER, rowRoute.PATCH, req("PATCH", { colourName: "Black" }), ctx("jb", "s1"));
  const crossDel = await call(OTHER, rowRoute.DELETE, req("DELETE"), ctx("jb", "s1"));
  eq("their job + our row id: PATCH and DELETE are 404", [cross.status, crossDel.status], [404, 404]);
  ok("…our row is intact", state.rows.jobSelection.find((r) => r.id === "s1")?.colourName === "Pale Oak");
  // Our own manager, a row id from ANOTHER job of ours.
  const wrongJob = await call(MANAGER, rowRoute.DELETE, req("DELETE"), ctx("j2", "s1"));
  eq("a row id from another job is 404 on this job", wrongJob.status, 404);
}

// ═══════════════════════════════════════════════════════════════════════════
section("8. The work order prints the rows; the cabinet finish prints exactly as before");
// ═══════════════════════════════════════════════════════════════════════════
{
  const WO_BASE = { model: "eecb20f6249c3396cb8f3ee4ac578794", print: "d8cf1a50a3e943152eca12d521301d2c" };
  const company = { name: "TrueFinish", brandColor: "#1f6feb" };
  const plain = buildWorkOrderModel(cabinetWorkOrderArgs());
  eq("a job with no rows: the model carries selections: []", plain.selections, []);
  const { selections: _none, ...asBefore } = plain;
  eq("…and otherwise hashes exactly as on origin/main db116dcc5", md5(asBefore), WO_BASE.model);
  eq("…its print sheet is byte-identical to origin/main", md5(workOrderPrintHtml({ company, workOrder: plain, language: "en", printLabel: "Print" })), WO_BASE.print);
  const facts = areaFactLines(plain.areas[0], workOrderCopy("en"));
  eq("the cabinet Colour / Sheen / Door style still print on the area", facts.finish, "Colour: Hale Navy · Sheen: satin · Door style: Shaker · Primer coats: 1 · Top coats: 2");

  const withRows = buildWorkOrderModel({
    ...cabinetWorkOrderArgs(),
    selections: [
      { area: "Uppers", product: "BM", colourName: "Chantilly Lace", colourCode: "OC-65", finish: "satin", coats: 2, notes: null, swatchUrl: CLOUD },
      { area: "Island", product: "BM", colourName: "Hale Navy", colourCode: "HC-154", finish: "satin", coats: 2, notes: "Two-tone, island only" },
      { area: "", product: "", colourName: null }, // says nothing — never a blank line on paper
    ],
  });
  eq("the model carries the two rows that say something", withRows.selections.length, 2);
  ok("…and no money key anywhere in it", findWorkOrderMoneyKey(withRows) === null, String(findWorkOrderMoneyKey(withRows)));
  const html = workOrderPrintHtml({ company, workOrder: withRows, language: "en", printLabel: "Print" });
  ok("print sheet: 'Colours & materials' heading", html.includes("Colours &amp; materials"));
  ok("print sheet: 'Uppers: BM Chantilly Lace OC-65, satin, 2 coats'", html.includes("Uppers: BM Chantilly Lace OC-65, satin, 2 coats"));
  ok("print sheet: the row's notes", html.includes("Two-tone, island only"));
  const fr = workOrderPrintHtml({ company, workOrder: withRows, language: "fr", printLabel: "Imprimer" });
  ok("a French work order says '2 couches' and 'Couleurs et matériaux'", fr.includes("satin, 2 couches") && fr.includes("Couleurs et matériaux"));
  const hostile = buildWorkOrderModel({ ...cabinetWorkOrderArgs(), selections: [{ area: "<img src=x onerror=alert(1)>", colourName: "Red" }] });
  ok("a row's text is escaped on the print sheet", !workOrderPrintHtml({ company, workOrder: hostile, language: "en" }).includes("<img src=x"));

  const load = read("lib/workOrder/load.js");
  ok("the loader reads the job's rows, company-scoped, in the office's order", /selections: \{\s*where: \{ companyId: member\.companyId \}/.test(load) && /selections: job\.selections \|\| \[\]/.test(load));
  ok("the PDF section prints them (same lines as the print sheet)", /selectionLines\(wo, c\)/.test(read("lib/documentSections/WorkOrderSection.js")));
  ok("the on-screen work order (the crew's view) prints them", /<WorkOrderSelections wo=\{wo\} t=\{t\} \/>/.test(read("app/app/jobs/[id]/work-order/WorkOrderView.js")));
}

// ═══════════════════════════════════════════════════════════════════════════
section("9. Every control has a caller, and every word is in every app language");
// ═══════════════════════════════════════════════════════════════════════════
{
  const card = read("app/components/jobs/JobSelections.js");
  for (const [what, re] of [
    ["GET /selections", /fetchJson\(`\/api\/jobs\/\$\{jobId\}\/selections`\)/],
    ["POST /selections (add)", /`\/api\/jobs\/\$\{jobId\}\/selections`, \{ method: "POST"/],
    ["PATCH /selections (reorder)", /`\/api\/jobs\/\$\{jobId\}\/selections`, \{ method: "PATCH", body: \{ order \}/],
    ["PATCH /selections/[id] (edit)", /`\/api\/jobs\/\$\{jobId\}\/selections\/\$\{editing\.id\}`, \{ method: "PATCH"/],
    ["DELETE /selections/[id]", /`\/api\/jobs\/\$\{jobId\}\/selections\/\$\{id\}`, \{ method: "DELETE" \}/],
    ["POST /selections/pull", /`\/api\/jobs\/\$\{jobId\}\/selections\/pull`, \{ method: "POST" \}/],
    ["the swatch through uploadFile()", /uploadFile\(file, \{ purpose: "jobs" \}\)/],
  ]) ok(`the job card calls ${what}`, re.test(card));
  ok("controls render only when the route says canEdit", /canEdit && !editing &&/.test(card) && /const canEdit = Boolean\(data\?\.canEdit\)/.test(card));
  ok("a failed load is said, never drawn as 'none recorded'", /if \(loadError\)/.test(card));
  ok("the job page renders the card", /<JobSelections jobId=\{job\.id\} \/>/.test(read("app/app/jobs/[id]/JobDetail.js")));

  const used = new Set();
  for (const f of ["app/components/jobs/JobSelections.js", "app/components/selections/SelectionFields.js", "app/components/quotes/builder/GroupSelections.js", "app/app/jobs/[id]/work-order/WorkOrderView.js"]) {
    for (const m of read(f).matchAll(/"(app\.selections\.[A-Za-z.]+)"/g)) used.add(m[1]);
  }
  for (const k of S.selectionTemplateMessageKeys()) used.add(k);
  ok(`${used.size} keys found`, used.size > 60, String(used.size));
  const langs = Object.keys(APP_MESSAGES);
  eq("all nine app languages", langs.sort(), ["de", "en", "es", "fr", "it", "pa", "tl", "uk", "zh"]);
  const missing = [];
  const badPh = [];
  for (const k of used) {
    for (const l of langs) {
      const v = APP_MESSAGES[l][k];
      if (typeof v !== "string" || !v.trim()) missing.push(`${l}:${k}`);
      else if ((v.match(/\{[a-z]+\}/g) || []).sort().join() !== (APP_MESSAGES.en[k].match(/\{[a-z]+\}/g) || []).sort().join()) badPh.push(`${l}:${k}`);
    }
  }
  eq("every key in every language", missing, []);
  eq("placeholders match English in every language", badPh, []);

  const pkg = JSON.parse(read("package.json"));
  ok("check:job-selections is a script", /check-job-selections\.mjs/.test(pkg.scripts["check:job-selections"] || ""));
  ok("…and is in check:all", /npm run check:job-selections(?:\s|$)/.test(pkg.scripts["check:all"]));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

// ── Mutation record (2026-10-10) — each was applied, run, seen to FAIL, and
// reverted from a cp backup (never git checkout):
//   · assignedJobWhere removed from lib/jobs/selectionsAccess.js       → 1 fails
//       ("CREW on a job they are not booked on: 404")
//   · companyId removed from the job lookup in selectionsAccess        → 5 fail
//       (the "ANOTHER COMPANY's owner …: 404" assertions)
//   · the `write && !canEdit` refusal removed                          → 7 fail
//   · pull: the have-filter removed (skipDuplicates kept)              → 2 fail
//       (the per-job cap assertions — idempotence alone is also held by
//       the unique index, so the cap is what proves the filter)
//   · pull: the have-filter AND skipDuplicates removed  → the check dies on P2002
//   · groupSelectionsForPayload made to always send []                → 34 fail
//   · carrySelectionsIntoJob removed from createJobFromQuote → section 5 fails
//   · the meta read removed from legacyFinishOf → Q-2026-0022's 'slab' fails
//   · jobId dropped from the DELETE's WHERE                            → 2 fail
//   · the print sheet emitting "\n" when there are no rows             → 1 fails
//   · reorder accepting a partial order                                → 2 fail
//   · the swatch URL check removed                                     → 7 fail
