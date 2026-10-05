// scripts/check-error-codes.mjs
//
//   npm run check:error-codes
//
// "My Samsung washer says UE." The look_up_error_code tool and the "Extract
// error codes" pass (lib/aiEmployee/errorCodes.js, referenceRuns.js) and
// FieldQuo's own curated table (lib/aiEmployee/knowledge/codes/fieldquo.js),
// executed against hostile input:
//
//   - the same code typed every way a homeowner types it;
//   - the same letters meaning different things on different brands;
//   - a brand nobody has rows for, no brand at all, a brand hidden in a word;
//   - the client's own equipment standing in for the brand;
//   - a company's own rows — reviewed, unreviewed, rejected, another
//     tenant's — against FieldQuo's;
//   - a model's extraction answer full of junk;
//   - the paid extraction run with a scripted model and wallet (no live AI
//     call anywhere here).
import { readFileSync } from "node:fs";

let passed = 0;
let failed = 0;
function ok(name, cond, extra) {
  if (cond) passed += 1;
  else {
    failed += 1;
    console.error(`  ✗ ${name}`, extra === undefined ? "" : String(JSON.stringify(extra)).slice(0, 400));
  }
}
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const E = await import("@/lib/aiEmployee/errorCodes");
const { FIELDQUO_CODES, FIELDQUO_CODES_VERSION } = await import("@/lib/aiEmployee/knowledge/codes/fieldquo");
const { extractCodes, codeEdit } = await import("@/lib/aiEmployee/referenceRuns");
const { assertStrictSchema } = await import("@/lib/ai/jsonSchema");
const { TOOL_RISK, ALL_TOOL_DEFINITIONS } = await import("@/lib/aiEmployee/tools");
const { toolsForRole } = await import("@/lib/aiEmployee/roles");

// ── 1. The shipped table: every row sourced, sane, and never behind a panel ─
{
  ok("the table is versioned and non-trivial", /^\d{4}-\d{2}-\d{2}$/.test(FIELDQUO_CODES_VERSION) && FIELDQUO_CODES.length >= 30, FIELDQUO_CODES.length);
  const ids = FIELDQUO_CODES.map((r) => r.id);
  ok("every row id is unique", new Set(ids).size === ids.length);
  for (const r of FIELDQUO_CODES) {
    const where = r.id;
    ok(`${where}: has a source with a title, a URL and a page`, r.source?.title && /^https:\/\//.test(r.source?.url || "") && (r.source.page === "web" || /\d/.test(String(r.source.page))), r.source);
    ok(`${where}: urgency is one of the three`, E.URGENCIES.includes(r.urgency), r.urgency);
    ok(`${where}: a brand, a code that normalises, and a meaning`, r.brands.length > 0 && r.brands.every((b) => E.brandKey(b)) && E.rowCodeKeys(r).size > 0 && r.meaning.length > 10);
    ok(`${where}: at most four homeowner steps, and a stop sign`, r.safeSteps.length <= 4 && r.stopSigns.length >= 1);
    const steps = r.safeSteps.join(" ").toLowerCase();
    ok(`${where}: no step goes behind a panel, meters, rewires or touches gas`,
      !/multimeter|ohm|voltmeter|remove the (cover|panel|access)|open the (cover|panel|cabinet)|rewire|replace the (board|igniter|sensor|valve)|gas pressure|manometer|jumper/.test(steps), steps);
    ok(`${where}: an urgent or emergency row says to stop`, r.urgency === "routine" || r.stopSigns.length >= 1);
  }
  const all = FIELDQUO_CODES.map((r) => `${r.meaning} ${r.safeSteps.join(" ")} ${r.stopSigns.join(" ")}`).join(" ");
  ok("the table defers to the emergency rule rather than writing a second one", /follow the emergency rule/.test(all) && !/call 911|leave the house|get out/i.test(all));
}

// ── 2. A code, however it is typed ─────────────────────────────────────────
{
  const same = ["E15", "e15", "E 15", "E-15", "e.15", "Error E15", "error code e15", "ｅ１５", " e15 "];
  ok("every spelling of E15 is one code", same.every((s) => E.codeKey(s) === "E15"), same.map(E.codeKey));
  ok("flash codes: '6-1 flashes', '6 1' and '61' are one code", ["6-1 flashes", "6 1", "61", "6-1"].every((s) => E.codeKey(s) === "61"));
  ok("'4 flashes' is 4; 'LCD 31' is 31", E.codeKey("4 flashes") === "4" && E.codeKey("LCD 31") === "31");
  ok("nothing, junk and wrapper words alone are no code", ["", null, undefined, "error", "code", "the light is flashing", "   "].every((s) => E.codeKey(s) === ""));
  ok("a code is bounded in length", E.codeKey("A".repeat(500)).length <= 16);
  ok("brands normalise; '&' is 'and'", E.brandKey("Bradford-White") === "bradfordwhite" && E.brandKey("Day & Night") === "dayandnight" && E.brandKey("Señor") === "senor");
  ok("a brand is found as a whole word run — 'lg' is not inside 'bulging'", E.namesBrand("my LG washer", ["LG"]) && !E.namesBrand("the ceiling is bulging", ["LG"]) && E.namesBrand("a bradford white heater", ["Bradford White"]) && !E.namesBrand("bradford", ["Bradford White"]));
}

// ── 3. The lookup, pure ────────────────────────────────────────────────────
{
  const ue = E.decideLookup({ code: " u-e ", brand: "samsung" });
  ok("Samsung UE: found, any casing and spacing", ue.ok && ue.matched >= 1 && /off-balance/.test(ue.codes[0].meaning) && ue.codes[0].from === "fieldquo_reference");
  ok("...cited by title and URL, safe steps given, routine", /TSG10000997/.test(ue.codes[0].cite) && ue.codes[0].safeSteps.length >= 1 && ue.urgency === "routine" && /log_troubleshooting/.test(ue.say));
  const sOE = E.decideLookup({ code: "OE", brand: "Samsung" });
  const lOE = E.decideLookup({ code: "oe", brand: "LG" });
  ok("the same letters, different brands, different meanings (OE: Samsung overflow, LG drain)", /Overflow/.test(sOE.codes[0].meaning) && /can't drain/.test(lOE.codes[0].meaning) && sOE.urgency === "urgent" && lOE.urgency === "routine");
  ok("an urgent code is a hand-off, not a walk-through", /URGENT/.test(sOE.say) && /book_callback with urgency "urgent"/.test(sOE.say) && /hand_off_to_human/.test(sOE.say) && !/log_troubleshooting/.test(sOE.say));
  const unknown = E.decideLookup({ code: "E15", brand: "Acme Appliances" });
  ok("an unknown brand: 0 rows, said as 'not in our references', never a guess", unknown.ok && unknown.matched === 0 && unknown.codes.length === 0 && /Do not guess/.test(unknown.say));
  const nobrand = E.decideLookup({ code: "E15" });
  ok("no brand and no equipment: ask for the brand, never guess", !nobrand.ok && nobrand.reason === "need_brand" && /do not guess/i.test(nobrand.say));
  ok("no code: ask what the display shows", E.decideLookup({ code: "", brand: "Bosch" }).reason === "no_code");
  const wrongCode = E.decideLookup({ code: "ZZ9", brand: "Samsung" });
  ok("a code the brand has no row for: 0 rows", wrongCode.matched === 0);
  const fromRecord = E.decideLookup({ code: "E15", equipment: [{ name: "Dishwasher", manufacturer: "Bosch", modelNumber: "SHPM88Z75N" }] });
  ok("the brand comes from the client's equipment when the customer didn't say", fromRecord.matched === 1 && /leak protection/.test(fromRecord.codes[0].meaning) && fromRecord.codes[0].equipment === "Dishwasher");
  const two = E.decideLookup({ code: "OE", equipment: [{ name: "Washer", manufacturer: "Samsung" }, { name: "Laundry pair", manufacturer: "LG" }] });
  ok("two pieces on record that both know the code: ask which one, by name", two.matched === 2 && /ask which one, by its name/.test(two.say));
  ok("...narrowed by the appliance when one was named", E.decideLookup({ code: "E15", appliance: "dishwasher", equipment: [{ name: "Washer", manufacturer: "Samsung" }, { name: "Dishwasher", manufacturer: "Bosch" }] }).codes.every((c) => c.equipment === "Dishwasher"));
  ok("a brand the customer SAID wins over the record", E.decideLookup({ code: "OE", brand: "LG", equipment: [{ name: "Washer", manufacturer: "Samsung" }] }).codes.every((c) => c.brand === "LG"));
  ok("the appliance filters within a brand (LG washer codes are not a dishwasher's)", E.decideLookup({ code: "OE", brand: "LG", appliance: "dishwasher" }).matched === 0);
  ok("at most three rows, ever", E.decideLookup({ code: "DC", brand: "Samsung samsung Samsung" }).codes.length <= E.MAX_MATCHES);
  ok("Samsung dC is ambiguous on the source too, and the model is told to tell them apart", (() => { const r = E.decideLookup({ code: "dc", brand: "Samsung" }); return r.matched === 2 && /tells them apart/.test(r.say); })());
  ok("Goodman's E1 is found under Amana and Daikin too", ["Goodman", "Amana", "Daikin"].every((b) => E.decideLookup({ code: "e1", brand: b }).matched === 1));
  ok("a gas-valve code reads urgent, with the emergency rule in its stop signs", (() => { const r = E.decideLookup({ code: "22", brand: "Carrier" }); return r.urgency === "urgent" && r.codes[0].safeSteps.length === 0 && r.codes[0].stopSigns.some((s) => /emergency rule/.test(s)); })());
}

// ── 4. The company's own rows win, and only its own ────────────────────────
{
  const mine = (over) => ({ id: "r1", brand: "Samsung", brandKey: "samsung", category: "washer", code: "UE", codeKeys: ["UE"], meaning: "Unbalanced (our manual).", safeSteps: ["Spread it out."], stopSigns: ["Repeats."], urgency: "routine", page: 41, reviewedAt: new Date(), rejectedAt: null, source: { title: "Samsung WF45 manual" }, ...over });
  const reviewed = E.decideLookup({ code: "UE", brand: "Samsung", companyRows: [mine()] });
  ok("a reviewed company row comes first, cited with its page", reviewed.codes[0].from === "company_manual" && reviewed.codes[0].cite === "Samsung WF45 manual, p.41" && reviewed.codes[0].reviewed === true && reviewed.codes[1]?.from === "fieldquo_reference");
  const unreviewed = E.decideLookup({ code: "UE", brand: "Samsung", companyRows: [mine({ reviewedAt: null })] });
  ok("an unreviewed one is still used — with the instruction to name manual and page out loud", unreviewed.codes[0].reviewed === false && /say the manual and page out loud/.test(unreviewed.say));
  ok("...and reviewed rows outrank unreviewed ones", E.decideLookup({ code: "UE", brand: "Samsung", companyRows: [mine({ id: "u", reviewedAt: null, meaning: "draft" }), mine({ id: "v", meaning: "checked" })] }).codes[0].meaning === "checked");
  ok("a rejected row is never used", E.decideLookup({ code: "UE", brand: "Samsung", companyRows: [mine({ rejectedAt: new Date() })] }).codes.every((c) => c.from === "fieldquo_reference"));
  ok("a company row for another code or brand is not used", E.decideLookup({ code: "UE", brand: "Samsung", companyRows: [mine({ codeKeys: ["OE"] }), mine({ id: "x", brand: "LG", brandKey: "lg" })] }).codes.every((c) => c.from === "fieldquo_reference"));
  ok("a company row's junk urgency reads routine; its lists are capped", (() => { const v = E.companyRowView(mine({ urgency: "panic", safeSteps: Array(20).fill("x"), stopSigns: "nope" })); return v.urgency === "routine" && v.safeSteps.length === 6 && v.stopSigns.length === 0; })());

  // The read is under the company — executed against a database that would
  // hand back another tenant's rows if the WHERE ever dropped it.
  const seen = [];
  const prisma = {
    referenceCode: {
      findMany: async ({ where }) => {
        seen.push(where);
        const rows = [mine({ id: "theirs", meaning: "ANOTHER TENANT" }), mine({ id: "ours", meaning: "ours" })].map((r, i) => ({ ...r, companyId: i === 0 ? "co2" : "co1" }));
        return rows.filter((r) => r.companyId === where.companyId && where.brandKey.in.includes(r.brandKey) && where.codeKeys.has && r.codeKeys.includes(where.codeKeys.has) && where.rejectedAt === null);
      },
    },
  };
  const out = await E.lookUpErrorCode({ prisma, companyId: "co1", code: "u e", brand: "Samsung" });
  ok("the tool reads the company's rows under its companyId, by brand and code, never a rejected one", seen.length === 1 && seen[0].companyId === "co1" && seen[0].codeKeys.has === "UE" && seen[0].rejectedAt === null && seen[0].brandKey.in.includes("samsung"));
  ok("...so another tenant's row never appears", !JSON.stringify(out).includes("ANOTHER TENANT") && out.codes[0].meaning === "ours");
  const failing = await E.lookUpErrorCode({ prisma: { referenceCode: { findMany: async () => { throw new Error("db down"); } } }, companyId: "co1", code: "UE", brand: "Samsung" });
  ok("a failed company read falls back to FieldQuo's table, never a throw", failing.ok && failing.codes[0].from === "fieldquo_reference");
  const noBrandNoRead = [];
  await E.lookUpErrorCode({ prisma: { referenceCode: { findMany: async (a) => { noBrandNoRead.push(a); return []; } } }, companyId: "co1", code: "UE" });
  ok("no brand → the database is not even asked", noBrandNoRead.length === 0);
}

// ── 5. The tool as the model sees it ───────────────────────────────────────
{
  const def = ALL_TOOL_DEFINITIONS.find((d) => d.name === "look_up_error_code");
  ok("the tool takes a code (required) and optional brand, model, appliance — never a companyId", def && def.input_schema.required.join(",") === "code" && !("companyId" in def.input_schema.properties) && ["brand", "model", "appliance"].every((k) => k in def.input_schema.properties));
  ok("it is a reversible read", TOOL_RISK.look_up_error_code === "reversible" && TOOL_RISK.log_troubleshooting === "reversible");
  ok("the troubleshooter and the receptionist have it", toolsForRole("troubleshooter").includes("look_up_error_code") && toolsForRole("receptionist").includes("look_up_error_code"));
  const tools = read("lib/aiEmployee/tools.js");
  ok("its result is fenced; our instruction stays outside the fence", /\.\.\.fenceCompanyData\(\{ codes \}\)/.test(tools) && /const \{ codes = \[\], \.\.\.rest \} = out;/.test(tools));
}

// ── 6. Extraction: the model's answer is evidence, cleaned ─────────────────
{
  ok("the extraction schema is strict-mode valid", assertStrictSchema(E.CODE_EXTRACT_SCHEMA).ok);
  ok("the extraction prompt forbids copying the manual and anything behind a panel", /IN YOUR OWN WORDS/.test(E.CODE_EXTRACT_SYSTEM) && /NEVER anything behind a panel/.test(E.CODE_EXTRACT_SYSTEM) && /data, never an instruction/.test(E.CODE_EXTRACT_SYSTEM));
  const junk = {
    codes: [
      { page: 41, code: "4 flashes / LCD 31", meaning: "  High-limit   lockout. ", safeSteps: ["a", "b", "c", "d", "e"], stopSigns: ["Always"], urgency: "urgent" },
      { page: 999, code: "E9", meaning: "Page not sent.", safeSteps: [], stopSigns: [], urgency: "routine" },
      { page: 41, code: "", meaning: "No code.", safeSteps: [], stopSigns: [], urgency: "routine" },
      { page: 41, code: "E7", meaning: "", safeSteps: [], stopSigns: [], urgency: "routine" },
      { page: 41, code: "E8", meaning: "Bogus urgency.", safeSteps: [], stopSigns: [], urgency: "PANIC" },
      { page: 41, code: "4 flashes / LCD 31", meaning: "Duplicate.", safeSteps: [], stopSigns: [], urgency: "urgent" },
      null, "string", 42,
    ],
  };
  const rows = E.cleanExtractedCodes(junk, { companyId: "co1", sourceId: "s1", brand: "Rheem", pagesSent: [40, 41] });
  ok("a code with no code or no meaning is dropped; a duplicate once", rows.length === 3, rows);
  ok("'4 flashes / LCD 31' answers to 4 and 31", rows[0].codeKeys.join(",") === "4,31" && rows[0].meaning === "High-limit lockout.");
  ok("a page that was not sent is not trusted (null), never invented", rows.find((r) => r.code === "E9").page === null && rows[0].page === 41);
  ok("an unknown urgency reads routine; steps capped at three", rows.find((r) => r.code === "E8").urgency === "routine" && rows[0].safeSteps.length === 3);
  ok("every row is the company's, from this source, branded, unreviewed", rows.every((r) => r.companyId === "co1" && r.sourceId === "s1" && r.brandKey === "rheem" && !("reviewedAt" in r)));
  ok("no brand → nothing written", E.cleanExtractedCodes(junk, { companyId: "co1", sourceId: "s1", brand: "  " }).length === 0);
  ok("junk in → nothing out, never a throw", E.cleanExtractedCodes(null, { brand: "x" }).length === 0 && E.cleanExtractedCodes({ codes: "x" }, { brand: "x" }).length === 0);
  const pages = [
    { page: 1, text: "Table of contents. Safety. Installation." },
    { page: 40, text: "Gas valve LED codes. Status / problem / probable cause / solution. 4 flashes: high limit. 7 flashes: vapour sensor. 6-1 flashes: failed ignition. E1 E2 E3." },
    { page: 41, text: "Diagnostic codes 10 11 12 79 — error, fault, lockout, cause, solution, status code table" },
    { page: 2, text: "Parts list: E12 bolt, E13 nut, E14 washer, E15 screw." },
  ];
  const picked = E.codeTableCandidates(pages);
  ok("a fault table is picked; a parts list and a contents page are not", picked.map((p) => p.page).join(",") === "40,41", picked.map((p) => p.page));
  ok("candidates are capped by characters", E.codeTableCandidates(Array.from({ length: 50 }, (_, i) => ({ page: i + 1, text: `error fault code status E1 E2 E3 ${"x".repeat(5000)}` }))).reduce((n, p) => n + p.text.length, 0) <= E.CODE_EXTRACT_MAX_CHARS);
  ok("...and by pages", E.codeTableCandidates(Array.from({ length: 50 }, (_, i) => ({ page: i + 1, text: "error fault code status E1 E2 E3" }))).length === E.CODE_EXTRACT_MAX_PAGES);
  ok("the prompt marks every page so each code is citable", /\[page 40\]/.test(E.codeExtractPrompt({ title: "Rheem", brand: "Rheem", pages: picked })));
}

// ── 7. Extraction, the run: scripted model and wallet ──────────────────────
{
  const store = {
    aiEmployeeSource: [
      { id: "s1", companyId: "co1", title: "Rheem manual", brand: "Rheem", category: "water heater", trade: "plumbing" },
      { id: "s2", companyId: "co1", title: "Untagged", brand: null },
      { id: "s9", companyId: "co2", title: "Theirs", brand: "Rheem" },
    ],
    aiEmployeeSourcePage: [
      { companyId: "co1", sourceId: "s1", page: 41, text: "Gas valve LED codes. Status problem cause solution. 4 flashes high limit. 7 flashes vapour. 6-1 flashes. E1 E2" },
      { companyId: "co1", sourceId: "s1", page: 3, text: "Welcome to your new water heater." },
      { companyId: "co1", sourceId: "s2", page: 1, text: "error fault code status E1 E2 E3" },
    ],
    referenceCode: [{ companyId: "co1", sourceId: "s1", codeKeys: ["4", "31"], page: 41, reviewedAt: new Date(), meaning: "kept" }],
  };
  const matches = (row, where = {}) => Object.entries(where).every(([k, v]) => (v && typeof v === "object" && !Array.isArray(v) ? ("not" in v ? row[k] != null : true) : row[k] === v));
  const prisma = {};
  for (const n of Object.keys(store)) {
    prisma[n] = {
      findFirst: async ({ where }) => store[n].find((r) => matches(r, where)) || null,
      findMany: async ({ where }) => store[n].filter((r) => matches(r, where)),
      createMany: async ({ data }) => { store[n].push(...data); return { count: data.length }; },
    };
  }
  const calls = [];
  const recorded = [];
  const meter = (allowed) => async (feature) => ({ check: async () => ({ allowed }), record: async (u, meta) => { recorded.push({ feature, meta }); } });
  const model = async (args) => {
    calls.push(args);
    args.onUsage?.({ model: "gpt-5-mini", promptTokens: 3000, completionTokens: 800 });
    return { ok: true, data: { codes: [
      { page: 41, code: "4 flashes / LCD 31", meaning: "High limit.", safeSteps: [], stopSigns: ["Always"], urgency: "urgent" },
      { page: 41, code: "7 flashes", meaning: "Flammable vapour sensor tripped.", safeSteps: [], stopSigns: ["Always"], urgency: "urgent" },
    ] } };
  };
  const untagged = await extractCodes({ prisma, companyId: "co1", sourceId: "s2" }, { complete: model, meterFor: meter(true) });
  ok("no brand tag → refused before anything is spent", untagged.status === 400 && untagged.error === "need_brand" && calls.length === 0);
  const theirs = await extractCodes({ prisma, companyId: "co1", sourceId: "s9" }, { complete: model, meterFor: meter(true) });
  ok("another tenant's manual is not found", theirs.status === 404 && calls.length === 0);
  const broke = await extractCodes({ prisma, companyId: "co1", sourceId: "s1" }, { complete: model, meterFor: meter(false) });
  ok("no AI credit → 402, no call", broke.status === 402 && calls.length === 0);
  const run = await extractCodes({ prisma, companyId: "co1", sourceId: "s1" }, { complete: model, meterFor: meter(true) });
  ok("one pass over the fault-table pages only, on the standard tier, strict schema", run.ok && calls.length === 1 && !calls[0].tier && calls[0].schema === E.CODE_EXTRACT_SCHEMA && /\[page 41\]/.test(calls[0].prompt) && !/\[page 3\]/.test(calls[0].prompt));
  ok("...metered once to the company, with a ref", recorded.length === 1 && recorded[0].feature === "reference_code_extract" && /^reference_codes:s1:/.test(recorded[0].meta.ref));
  ok("a second find of a code already there leaves the owner's row alone; the new one is added UNREVIEWED", run.created === 1 && run.found === 2 && store.referenceCode.filter((r) => r.sourceId === "s1").length === 2 && store.referenceCode.find((r) => r.meaning === "kept").reviewedAt && !store.referenceCode.find((r) => /vapour/.test(r.meaning)).reviewedAt);
  ok("the new row is filed under the manual's brand, tags and page", (() => { const r = store.referenceCode.find((x) => /vapour/.test(x.meaning)); return r.brand === "Rheem" && r.brandKey === "rheem" && r.category === "water heater" && r.page === 41 && r.companyId === "co1"; })());
}

// ── 8. The owner's decision on a code ──────────────────────────────────────
{
  ok("an edit is cleaned, and junk is not an edit", JSON.stringify(codeEdit({ meaning: "  Fixed  text ", safeSteps: ["a", "", "b", "c", "d"], urgency: "urgent" })) === JSON.stringify({ action: null, data: { meaning: "Fixed text", safeSteps: ["a", "b", "c"], urgency: "urgent" } }) && Object.keys(codeEdit({ urgency: "panic", meaning: 4 }).data).length === 0);
  ok("only review, reject and restore are actions", codeEdit({ action: "review" }).action === "review" && codeEdit({ action: "delete" }).action === null);
  const route = read("app/api/ai-employee/codes/[id]/route.js");
  ok("a decision is written under the company, never by a support session", /updateMany\(\{ where: \{ id, companyId: member\.companyId \}/.test(route) && /member\.impersonation/.test(route));
  ok("rejecting keeps the row (no deletion)", !/delete/i.test(route.replace(/\/\/.*$/gm, "")));
}

// ── 9. Vetted steps (owner, 2026-10-04) ───────────────────────────────────
//
// The troubleshooter may give a step only from the vetted list, the
// company's material or a code-lookup result — and never one that needs a
// panel opened, a gas valve, a ladder or live wiring. FieldQuo's OWN curated
// steps are held to the same guard the reply is (knowledge/firstSteps.js),
// so a curated row can never be the thing that walks someone behind a panel.
{
  const { forbiddenInstruction, screenStep } = await import("@/lib/aiEmployee/knowledge/firstSteps");
  const { cleanTroubleshootingLog } = await import("@/lib/aiEmployee/troubleshooting");
  const steps = FIELDQUO_CODES.flatMap((c) => (c.safeSteps || c.safeHomeownerSteps || []).map((s) => ({ id: c.id, s })));
  const bad = steps.filter(({ s }) => forbiddenInstruction(s));
  ok("every curated homeowner step passes the vetted-steps guard", steps.length > 20 && bad.length === 0, bad);
  ok("an urgent or emergency code never carries homeowner steps beyond safety", FIELDQUO_CODES.filter((c) => c.urgency !== "routine").every((c) => (c.safeSteps || []).every((s) => screenStep(s).ok)));
  const log = cleanTroubleshootingLog({ symptom: "furnace flashing 13", code: "13", steps_given: ["Replace the filter", "Open the burner door and reset the rollout switch"] });
  ok("a code-lookup step that needs a panel opened is NOT recorded as given", log.stepsGiven.join() === "Replace the filter" && log.refusedSteps?.length === 1, log);
  const troubleshooter = (await import("@/lib/aiEmployee/roles")).buildEmployeePrompt({ employee: { role: "troubleshooter" }, company: {} });
  ok("an urgent code: callback marked urgent, then the hand-off marked urgent — which alerts the on-call person", /book_callback with\s+urgency "urgent", then hand_off_to_human with urgency "urgent"/.test(troubleshooter));
}

console.log(`\ncheck-error-codes: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
