// scripts/check-trade-suggestions.mjs
//
// The Review folder's By-suggestion mode, executed: the name suggester on the
// owner's six examples and on hostile names, the domain pass and its guards,
// the stored form, the batch's cursor and idempotence against a fake client,
// the bulk writer's per-row trade sources, the AI parser refusing what the
// schema would never have let through, the cost arithmetic — and, by grep,
// that nothing in the suggestion modules writes a trade.
//
//   npm run check:trade-suggestions
//
// ── What was measured before the table grew (2026-09-13) ──────────────────
//
// Random 2,000 of the 210,969 trade-less folder rows, suggester as it stood:
// 456 suggested (22.8%), 3 shop words, 1,541 nothing, 64 with two trades.
// Forty names per top trade hand-checked. Wrong, and why:
//   masonry_concrete  "Nettoyage Brick-O inc." (a cleaner named Brick-O);
//                     "RAUL'S CONCRETE PUMPING", "CITY CONCRETE CUTTING"
//                     (adjacent, not wrong enough to change the rule)
//   landscaping       "OLIVE TREE CONSTRUCTION INC" (a name, after "tree "
//                     was added) — kept, one in twenty-six, a prompt
//   cabinets          "OMR COMMERCIAL SEATING & HOSPITALITY" via C-6 (the
//                     licence class names two trades; both offered, by rule)
//   retail            "PDX RENTAL PROPERTY MAINTENANCE" ("rental") — kept,
//                     the word list is advisory and the row says why
// After the additions: 491 suggested (24.6%), 6 shop words, 1,503 nothing.
// The residue is person names, numbered companies and bare "construction",
// which is Phase 2's population by design (tradeSuggest.js's header lists
// the words deliberately NOT added).
//
// ── Mutation-tested ────────────────────────────────────────────────────────
//   - "store" back to a prefix → "COMMERCIAL STOREFRONTS" is a shop again
//   - "tree " removed from landscaping → Fasso is tree_care, the owner's
//     verdict fixture fails
//   - DOMAIN_LIARS without "harbor" → harborconstruction.com suggests tree care
//   - parseAiSuggestions not checking the enum → "welding" is kept
//   - writeSuggestionPage naming "tradeKey" → the grep fails

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  CONFIDENCE_BY_BASIS,
  NAME_KEYWORDS,
  RETAIL_WORDS,
  SUGGEST_VERSION,
  domainLabel,
  domainTrades,
  keywordTradeKeys,
  nameTrades,
  retailWordIn,
  suggestTrades,
  suggestionColumns,
} from "../lib/sales/discovery/tradeSuggest.js";
import { SUPPLIER_NAME_PATTERNS } from "../lib/sales/discovery/classify.js";
import { isDiscoveryTradeKey, DISCOVERY_TRADES } from "../lib/sales/discovery/trades.js";
import {
  SUGGEST_CRON_SLICE,
  SUGGEST_MODES,
  SUGGEST_PAGE,
  planSuggestion,
  suggestSelectionSql,
  suggestTradesBatch,
  writeSuggestionPage,
} from "../lib/sales/discovery/suggestTradesBatch.js";
import {
  AI_BATCH,
  AI_CONFIRM_PHRASE,
  AI_VERDICTS,
  PROMPT_OVERHEAD_TOKENS,
  TRADE_SUGGESTION_AI_AREA,
  TRADE_SUGGESTION_SYSTEM,
  costFromCounts,
  parseAiSuggestions,
  tradeListForPrompt,
  tradeSuggestionPrompt,
  tradeSuggestionSchema,
  suggestTradesAi,
} from "../lib/sales/discovery/suggestTradesAi.js";
import { SUGGESTED_GROUPS, suggestedGroupAccepts, suggestedGroupReject } from "../lib/sales/discovery/suggestedGroups.js";
import {
  CLEAR_REASONS,
  JOB_SCOPE,
  TRADE_SUGGEST_AI_CAP_MICROS,
  TRADE_SUGGEST_AI_JOB,
  approveTradeSuggestAi,
  clearTradeSuggestAiApproval,
  loadTradeSuggestAiApproval,
  runTradeSuggestAiSlice,
} from "../lib/sales/discovery/suggestTradesAiApproval.js";
import { parseReviewFilter, reviewWhereSql, reviewOrderSql, suggestedGroupSql, REVIEW_PAGE_SIZE } from "../lib/sales/discovery/reviewFolder.js";
import { TRADE_SOURCES, bulkReview, tradeKeyFor } from "../lib/sales/discovery/reviewBulk.js";
import { assertStrictSchema, validateAgainstSchema } from "../lib/ai/jsonSchema.js";
import { hasKnownPricing } from "../lib/ai/usage.js";
import { AUDIT_ACTIONS } from "../lib/platform/auditActions.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

let failures = 0;
let checks = 0;
function ok(name, pass, detail = "") {
  checks++;
  if (!pass) failures++;
  console.log(`  ${pass ? "ok  " : "FAIL"} ${name}${detail ? `  ${typeof detail === "string" ? detail : JSON.stringify(detail)}` : ""}`);
}
const section = (t) => console.log(`\n${t}\n`);
const keys = (r) => r.suggestions.map((s) => s.tradeKey);
const NOW = new Date("2026-09-13T18:00:00Z");

/* ═══════════════════════════════════════════════════════════════════════════
   1. The owner's examples, and hostile names
   ═══════════════════════════════════════════════════════════════════════════ */

section("1. The owner's six examples");
{
  const cases = [
    ["B & R Plumbing Heating & Air Conditioning → plumbing, then hvac", "B & R Plumbing Heating & Air Conditioning", ["plumbing", "hvac"], null],
    ["Designer Pools → pools and spas (the trade we have)", "Designer Pools", ["pool_spa"], null],
    ["Gernatt Asphalt Products → a products company; paving kept beside it", "Gernatt Asphalt Products", [], "products"],
    ["Advanced Concrete Floor Finishes → concrete first, flooring second", "Advanced Concrete Floor Finishes", ["masonry_concrete", "flooring"], null],
    ["Blasz Tree Farm → not a contractor", "Blasz Tree Farm", [], "farm"],
    ["Fasso Tree Service → landscaping (owner's verdict), tree care second", "Fasso Tree Service", ["landscaping", "tree_care"], null],
  ];
  for (const [name, business, expected, retail] of cases) {
    const r = suggestTrades({ businessName: business });
    ok(name, JSON.stringify(keys(r)) === JSON.stringify(expected) && r.retailWord === retail, { got: keys(r), retailWord: r.retailWord });
  }
  const gernatt = suggestTrades({ businessName: "Gernatt Asphalt Products" });
  ok("…and Gernatt's alsoNames carries paving for the mixed card", gernatt.alsoNames.map((s) => s.tradeKey).join() === "paving");
  const blasz = suggestionColumns({ businessName: "Blasz Tree Farm" });
  ok("Blasz stored: not a contractor, primary null, tree words kept as alsoNames", blasz.suggestedNotContractor && blasz.suggestedTradeKey === null && blasz.suggestedTradeKeys.includes("landscaping"));
}

section("1b. Hostile names");
{
  const cases = [
    ["empty", "", [], null],
    ["null", null, [], null],
    ["emoji only", "🚀🔥", [], null],
    ["a bare Inc.", "Inc.", [], null],
    ["a plumbing SUPPLY is a shop", "Plumbing Supply", [], "supply"],
    ["a painting DEPOT is a shop", "Painting Depot", [], "depot"],
    ["French roofer, accented", "Toitures Tremblay inc.", ["roofing"], null],
    ["French, two trades in name order", "Électro-Plomberie J.-P. inc.", ["electrical", "plumbing"], null],
    ["French tinsmith is a roofer (ferblanterie)", "Ferblanterie Lévesque", ["roofing"], null],
    ["a plasterer is drywall", "BAY PLASTERING", ["drywall"], null],
    ["a storefront is not a store", "COMMERCIAL STOREFRONTS", [], null],
    ["a carpet STORE is a shop", "DISCOUNT CARPET STORE", [], "store"],
    ["Liverpool is not a pool", "Liverpool Construction", [], null],
    ["a christmas tree farm is not a contractor", "Holly Hill Christmas Tree Farm", [], "farm"],
    ["a nursery and landscape is a shop word beside a trade word", "Seasonal Nursery and Landscaping", [], "nursery"],
    ["a farm that excavates is a shop word beside a trade word", "Huber Farms & Excavating", [], "farms"],
    ["Farmington is not a farm", "Farmington Roofing", ["roofing"], null],
    ["a materials yard (classify.js's word) is a shop", "Coastal Building Materials", [], "building material"],
    ["a millwork shop (classify.js's word, not in RETAIL_WORDS) is a shop", "Pacific Millwork", [], "millwork"],
    ["a greenhouse CONTRACTOR is a shop word beside nothing — a prompt withheld", "GREENHOUSE CONTRACTORS", [], "greenhouse"],
    ["mold remediation is restoration; mouldings are not", "Mold Busters", ["restoration"], null],
    ["mouldings are not mold", "Masters of Moulding", [], null],
    ["a lock & key is a locksmith", "Gallery Lock & Key", ["locksmith"], null],
    ["never more than three", "Toiture Plomberie Électricité Peinture Gypse", null, null],
  ];
  for (const [name, business, expected, retail] of cases) {
    const r = suggestTrades({ businessName: business });
    if (expected === null) ok(name, r.suggestions.length === 3, keys(r));
    else ok(name, JSON.stringify(keys(r)) === JSON.stringify(expected) && r.retailWord === retail, { got: keys(r), retailWord: r.retailWord });
  }
  ok("every keyword trade key is a catalogue trade", keywordTradeKeys().every(isDiscoveryTradeKey), keywordTradeKeys().filter((k) => !isDiscoveryTradeKey(k)));
  ok("the table names tree_care AND landscaping for 'tree '", NAME_KEYWORDS.find((e) => e.tradeKey === "landscaping").words.includes("tree ") && NAME_KEYWORDS.find((e) => e.tradeKey === "tree_care").words.includes("tree "));
  ok("landscaping precedes tree_care in the table (the tie-break)", NAME_KEYWORDS.findIndex((e) => e.tradeKey === "landscaping") < NAME_KEYWORDS.findIndex((e) => e.tradeKey === "tree_care"));
  ok("nameTrades takes the earliest word of an entry: 'Apex Tree And Landscape' is landscaping via tree", nameTrades("Apex Tree And Landscape")[0].word === "tree");
  ok("retailWordIn reuses classify.js's supplier patterns rather than copying them", read("lib/sales/discovery/tradeSuggest.js").includes("SUPPLIER_NAME_PATTERNS") && SUPPLIER_NAME_PATTERNS.some((p) => p.test("pacific millwork")));
  ok("'store' is a whole word in RETAIL_WORDS", RETAIL_WORDS.includes("store ") && !RETAIL_WORDS.includes("store"));
  ok("'farm', 'nursery', 'greenhouse', 'products' are shop words", ["farm ", "nursery", "greenhouse", "products "].every((w) => RETAIL_WORDS.includes(w)));
}

/* ═══════════════════════════════════════════════════════════════════════════
   2. The domain pass
   ═══════════════════════════════════════════════════════════════════════════ */

section("2. The website's own name");
{
  ok("label: strips scheme, www and TLD", domainLabel("https://www.plomberie-roy.ca/x") === "plomberie-roy" && domainLabel("treeservicesangola.com") === "treeservicesangola");
  ok("label: nothing from nothing", domainLabel("") === "" && domainLabel(null) === "" && domainLabel("localhost") === "");
  const d = (x) => domainTrades(x).map((t) => t.tradeKey);
  ok("treeservicesangola.com → landscaping, tree care", JSON.stringify(d("treeservicesangola.com")) === JSON.stringify(["landscaping", "tree_care"]));
  ok("plomberie-roy.ca → plumbing", JSON.stringify(d("plomberie-roy.ca")) === JSON.stringify(["plumbing"]));
  ok("askaroofer.com → roofing (short word, formed)", JSON.stringify(d("askaroofer.com")) === JSON.stringify(["roofing"]));
  ok("streetpaving.com → paving only, not tree", JSON.stringify(d("streetpaving.com")) === JSON.stringify(["paving"]));
  ok("waterproofingpros.com → nothing (proof)", d("waterproofingpros.com").length === 0);
  ok("harborconstruction.com → nothing (harbor)", d("harborconstruction.com").length === 0);
  ok("fresnoweddingcenter.com → nothing (fresno)", d("fresnoweddingcenter.com").length === 0);
  ok("versatileconstruction.com → nothing (versatile)", d("versatileconstruction.com").length === 0);
  ok("liverpoolconstruction.co.uk → nothing", d("liverpoolconstruction.co.uk").length === 0);
  ok("laundertreecoinlaundry.com → nothing", d("laundertreecoinlaundry.com").length === 0);
  ok("bluefrogroofing.com → roofing", JSON.stringify(d("bluefrogroofing.com")) === JSON.stringify(["roofing"]));
  const numbered = suggestTrades({ businessName: "9410-5111 Québec inc.", domain: "plomberie-roy.ca" });
  ok("a numbered company with a domain gets a site-name suggestion", numbered.suggestions[0]?.source === "site_name" && numbered.suggestions[0]?.basis === "site name: 'plomb'");
  const both = suggestTrades({ businessName: "Fasso Tree Service", domain: "treeservicesangola.com" });
  ok("the domain agreeing with the name adds nothing twice", keys(both).length === 2 && both.suggestions.every((s) => s.source === "name"));
  const order = suggestTrades({ businessName: "Toitures X", domain: "plomberie-x.ca", sourceProvider: "rbq", sourceCategories: ["rbq:16"] });
  ok("site name is offered last: name, licence, then site name", order.suggestions.map((s) => s.source).join() === "name,licence,site_name");
  const allTrades = suggestTrades({ businessName: "Fasso Tree Service", sourceProvider: "us_ca_cslb", sourceCategories: ["us_ca_cslb_b"] });
  ok("an all-trades licence (CSLB B alone) is never a basis", allTrades.suggestions.every((s) => s.source !== "licence"));
}

/* ═══════════════════════════════════════════════════════════════════════════
   3. The stored form
   ═══════════════════════════════════════════════════════════════════════════ */

section("3. suggestionColumns");
{
  const c = suggestionColumns({ businessName: "B & R Plumbing Heating & Air Conditioning" });
  ok("primary, list, basis, confidence, note, version", c.suggestedTradeKey === "plumbing" && c.suggestedTradeKeys.join() === "plumbing,hvac" && c.suggestedTradeBasis === "name" && c.suggestedTradeConfidence === CONFIDENCE_BY_BASIS.name && c.suggestedTradeNote === "name: 'plumb' · name: 'heating'" && c.suggestedVersion === SUGGEST_VERSION && c.suggestedNotContractor === false, c);
  const e = suggestionColumns({ businessName: "" });
  ok("nothing: every column null or empty, notContractor false", e.suggestedTradeKey === null && e.suggestedTradeKeys.length === 0 && e.suggestedTradeBasis === null && e.suggestedTradeConfidence === null && e.suggestedTradeNote === null && e.suggestedNotContractor === false);
  const shop = suggestionColumns({ businessName: "Peinture Dépôt" });
  ok("a shop word: primary null (never bulk-acceptable), keys kept, note names the word", shop.suggestedTradeKey === null && shop.suggestedTradeKeys.join() === "painting" && shop.suggestedNotContractor && shop.suggestedTradeNote.startsWith("shop word: 'depot'"));
  ok("confidence is a measured number per basis, all in (0,1]", Object.values(CONFIDENCE_BY_BASIS).every((v) => v > 0 && v <= 1) && ["site", "name", "licence", "site_name"].every((b) => b in CONFIDENCE_BY_BASIS));
  ok("the version is a date-stamped string", /^\d{4}-\d{2}-\d{2}\.\d+$/.test(SUGGEST_VERSION));
  const schema = read("prisma/schema.prisma");
  for (const col of ["suggestedTradeKey", "suggestedTradeKeys", "suggestedTradeBasis", "suggestedTradeConfidence", "suggestedNotContractor", "suggestedTradeNote", "suggestedAt", "suggestedVersion"]) {
    ok(`Prospect.${col} exists in the schema`, new RegExp(`^\\s+${col}\\s`, "m").test(schema));
  }
  ok("the schema indexes suggestedTradeKey and suggestedAt", schema.includes("@@index([suggestedTradeKey])") && schema.includes("@@index([suggestedAt])"));
}

/* ═══════════════════════════════════════════════════════════════════════════
   4. The batch, against a fake client: cursor, pages, idempotence, columns
   ═══════════════════════════════════════════════════════════════════════════ */

section("4. suggestTradesBatch");
{
  const V = SUGGEST_VERSION;
  const rows = [];
  for (let i = 0; i < 4500; i++) {
    const names = ["Toitures Tremblay", "Acme Supply Co", "9410-5111 Québec inc.", "Huber Farms & Excavating", "KRISHNA PATEL"];
    rows.push({ id: `p${String(i).padStart(5, "0")}`, businessName: names[i % names.length], tradingNames: [], sourceProvider: "rbq", sourceCategories: [], domain: i % 5 === 2 && i % 7 === 0 ? "plomberie-roy.ca" : null, status: "discovered", classification: "contractor", tradeKey: null, possibleDuplicateOfId: null, suggestedAt: null, suggestedVersion: null, suggestedTradeBasis: null, suggestedTradeKey: null, suggestedTradeKeys: [], suggestedNotContractor: null, suggestedTradeNote: null, suggestedTradeConfidence: null, inferences: [] });
  }
  // One row the AI already answered, that the table cannot read.
  rows[4499].suggestedTradeBasis = "ai";
  rows[4499].suggestedTradeKey = "general_contracting";
  rows[4499].suggestedTradeKeys = ["general_contracting"];
  rows[4499].suggestedTradeNote = "ai: General contracting — name says construction";
  rows[4499].suggestedTradeConfidence = 0.6;
  rows[4499].suggestedAt = new Date("2026-09-12T00:00:00Z");
  rows[4499].suggestedVersion = "2026-09-01.1";

  const statements = [];
  const selects = [];
  function sqlText(q) {
    // Prisma.sql → its text with values; enough to see which selection and cursor ran.
    return q?.strings ? q.strings.join("?") : String(q);
  }
  const db = {
    async $queryRaw(strings, ...values) {
      const text = strings.join("?");
      selects.push({ text, values });
      const sel = values.find((v) => v?.strings);
      const mode = sqlText(sel).includes('"suggestedAt" IS NULL') ? "missing" : "stale";
      const ver = (sel?.values || []).find((v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}\./.test(v)) || V;
      const cursor = values.find((v) => typeof v === "string" && /^p\d{5}$/.test(v)) || null;
      const limit = values.find((v) => typeof v === "number") ?? Infinity;
      const matching = rows.filter((r) => (mode === "missing" ? r.suggestedAt === null : r.suggestedVersion !== ver) && (!cursor || r.id > cursor)).sort((a, b) => (a.id < b.id ? -1 : 1));
      if (text.startsWith("SELECT COUNT(*)")) return [{ n: matching.length }];
      return matching.slice(0, limit).map((r) => ({ id: r.id }));
    },
    prospect: {
      async findMany({ where }) {
        return rows.filter((r) => where.id.in.includes(r.id)).map((r) => ({ ...r }));
      },
    },
    async $executeRaw(strings, ...values) {
      const text = strings.join("?");
      statements.push({ text, values });
      // The SET clause's scalars come first in the template, then the arrays.
      const [now, version, ids, keys2, lists, bases, confs, notc, notes] = values;
      let n = 0;
      ids.forEach((id, i) => {
        const r = rows.find((x) => x.id === id);
        if (!r) return;
        r.suggestedTradeKey = keys2[i] || null;
        r.suggestedTradeKeys = lists[i] ? lists[i].split(",") : [];
        r.suggestedTradeBasis = bases[i] || null;
        r.suggestedTradeConfidence = confs[i] === null ? null : Number(confs[i]);
        r.suggestedNotContractor = notc[i];
        r.suggestedTradeNote = notes[i] || null;
        r.suggestedAt = now;
        r.suggestedVersion = version;
        n++;
      });
      return n;
    },
  };

  const first = await suggestTradesBatch({ db, mode: "stale", now: NOW });
  ok("first pass considers every row", first.considered === 4500, first.considered);
  ok("…writes every row", first.written === 4500);
  ok("…in pages of SUGGEST_PAGE: three statements", statements.length === 3 && statements[0].values[2].length === SUGGEST_PAGE, statements.map((s) => s.values[2].length));
  ok("…and reports nothing remaining", first.remaining === 0);
  ok("the distribution counts what was planned: 900 roofers, 900 supply houses, 900 farms-that-excavate, the rest none or site-name", first.byTrade.roofing === 900 && first.notContractor === 900 && first.mixed === 900 && first.none > 0 && first.byTrade.plumbing > 0, first);
  ok("the numbered company with a domain got plumbing by site name", rows.find((r) => r.businessName.startsWith("9410") && r.domain)?.suggestedTradeBasis === "site_name");
  ok("the AI-answered row kept its paid answer through the recompute", rows[4499].suggestedTradeBasis === "ai" && rows[4499].suggestedTradeKey === "general_contracting" && rows[4499].suggestedVersion === V);
  const second = await suggestTradesBatch({ db, mode: "stale", now: NOW });
  ok("second pass of the same version considers nothing and writes nothing", second.considered === 0 && second.written === 0 && statements.length === 3);
  const missing = await suggestTradesBatch({ db, mode: "missing", now: NOW });
  ok("missing mode after a full pass finds nothing", missing.considered === 0);
  rows.push({ ...rows[0], id: "p99999", suggestedAt: null, suggestedVersion: null, suggestedTradeBasis: null });
  const topUp = await suggestTradesBatch({ db, mode: "missing", limit: SUGGEST_CRON_SLICE, now: NOW });
  ok("a new row is picked up by the missing slice", topUp.considered === 1 && topUp.written === 1);
  const limited = await suggestTradesBatch({ db, mode: "stale", limit: 5, version: "2099-01-01.1", now: NOW });
  ok("limit caps a pass and remaining says what is left (a new version re-selects everything)", limited.considered === 5 && limited.remaining === 4496, limited);
  ok("a bad mode throws", await suggestTradesBatch({ db, mode: "everything" }).then(() => false, (e) => /mode/.test(e.message)));
  ok("SUGGEST_MODES is the two", SUGGEST_MODES.join() === "missing,stale");

  // The statement names only the suggested columns.
  const text = statements[0].text;
  const setClause = text.slice(text.indexOf("SET"), text.indexOf("FROM unnest"));
  const columnsSet = [...setClause.matchAll(/"(\w+)"\s*=/g)].map((m) => m[1]);
  ok("the UPDATE sets only suggested* columns", columnsSet.length === 8 && columnsSet.every((c) => c.startsWith("suggested")), columnsSet);
  ok("a page of nothing writes nothing", (await writeSuggestionPage(db, [], { now: NOW })) === 0);
  const plan = planSuggestion({ id: "x", businessName: "Toitures X", tradingNames: [], inferences: [] });
  ok("planSuggestion carries the id and the columns", plan.id === "x" && plan.suggestedTradeKey === "roofing");
  ok("the selection SQL for missing names suggestedAt IS NULL", sqlText(suggestSelectionSql("missing")).includes('"suggestedAt" IS NULL'));
  ok("the selection SQL for stale names the version", sqlText(suggestSelectionSql("stale")).includes('"suggestedVersion"'));
}

/* ═══════════════════════════════════════════════════════════════════════════
   5. Nothing in the suggestion modules writes a trade
   ═══════════════════════════════════════════════════════════════════════════ */

section("5. Nothing here writes tradeKey");
{
  const DECISION_COLUMN = /"(tradeKey|status|classification|classificationReason|doNotContactAt|possibleDuplicateOfId)"\s*=(?!=)/;
  const strip = (src) => src.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  for (const file of ["lib/sales/discovery/suggestTradesBatch.js", "lib/sales/discovery/suggestTradesAi.js", "lib/sales/discovery/tradeSuggest.js"]) {
    const src = strip(read(file));
    const setClauses = [...src.matchAll(/SET([\s\S]*?)FROM unnest/g)].map((m) => m[1]);
    const setColumns = setClauses.flatMap((c) => [...c.matchAll(/"(\w+)"\s*=/g)].map((m) => m[1]));
    ok(`${file}: every column any UPDATE sets is a suggested* column`, setColumns.every((c) => c.startsWith("suggested")) && setClauses.every((c) => !DECISION_COLUMN.test(c)), setColumns);
    ok(`${file}: no Prisma write on Prospect at all`, !/prospect\.(update|updateMany|create|createMany|upsert|delete|deleteMany)\(/.test(src));
    ok(`${file}: no data object carries a decision column`, !/data:\s*\{[^}]*\b(tradeKey|status|classification)\b/.test(src));
    ok(`${file}: no ProspectCorrection, no campaign counter, no research queued`, !/prospectCorrection|prospectCampaign|ensureResearchQueued/.test(src));
  }
  const route = strip(read("app/api/platform/sales/review/suggested/route.js"));
  ok("the suggested route writes only through the batch and the audit log", !/prospect\.(update|updateMany|create)|"tradeKey"\s*=(?!=)/.test(route) && route.includes("platformAuditLog.create"));
  ok("the AI route requires the typed phrase before anything runs", read("app/api/platform/sales/review/suggested/ai/route.js").includes("body?.confirm !== AI_CONFIRM_PHRASE"));
  ok("the accept route is still the one writer: reviewFolder's effects table sets tradeKey and nothing in the suggestion modules imports it", read("lib/sales/discovery/reviewFolder.js").includes("tradeKey,\n      classification: \"contractor\"") && !/decisionEffects/.test(read("lib/sales/discovery/suggestTradesBatch.js") + read("lib/sales/discovery/suggestTradesAi.js")));
}

/* ═══════════════════════════════════════════════════════════════════════════
   6. The bulk writer's per-row trade sources
   ═══════════════════════════════════════════════════════════════════════════ */

section("6. bulkReview with tradeSource");
{
  ok("the three sources", TRADE_SOURCES.join() === "given,current,suggested");
  ok("tradeKeyFor: given", tradeKeyFor({ tradeKey: "x", suggestedTradeKeys: ["y"] }, "given", "hvac") === "hvac");
  ok("tradeKeyFor: current", tradeKeyFor({ tradeKey: "landscaping", suggestedTradeKeys: ["tree_care"] }, "current", "hvac") === "landscaping");
  ok("tradeKeyFor: suggested is the FIRST stored key", tradeKeyFor({ tradeKey: null, suggestedTradeKeys: ["excavation", "paving"] }, "suggested", "hvac") === "excavation");
  ok("tradeKeyFor: suggested with nothing stored is null (skipped, not defaulted)", tradeKeyFor({ tradeKey: null, suggestedTradeKeys: [] }, "suggested", "hvac") === null);

  function makeClient(prospects) {
    const audits = [];
    const corrections = [];
    const updates = [];
    const campaigns = [{ id: "c1", needsReviewCount: 10, acceptedCount: 0, unmappedCount: 5, bankedCount: 5, readyCount: 0, noWebsiteCount: 0, rejectedCount: 0 }];
    const db = {
      async $queryRaw() {
        return prospects.map((p) => ({ ...p }));
      },
      async $transaction(fn) {
        return fn(db);
      },
      prospect: {
        async updateMany({ where, data }) {
          updates.push({ where, data });
          let count = 0;
          for (const p of prospects) {
            if (!where.id.in.includes(p.id) || p.status !== where.status || p.doNotContactAt) continue;
            Object.assign(p, data);
            count++;
          }
          return { count };
        },
      },
      prospectCorrection: { async createMany({ data }) { corrections.push(...data); return { count: data.length }; } },
      prospectCampaign: {
        async update({ where, data }) {
          const c = campaigns.find((x) => x.id === where.id);
          for (const [k, v] of Object.entries(data)) c[k] = (c[k] || 0) + (v.increment || 0) - (v.decrement || 0);
        },
      },
      platformAuditLog: { async create({ data }) { audits.push(data); } },
    };
    return { db, audits, corrections, updates, campaigns };
  }
  const base = (id, over) => ({ id, status: "needs_review", classification: "needs_review", tradeKey: null, phoneE164: "+15145550100", addressLine: "1 rue", websiteUrl: null, possibleDuplicateOfId: null, doNotContactAt: null, campaignId: "c1", businessName: id, classificationReason: "", suggestedTradeKeys: [], ...over });

  // agree: each row keeps ITS OWN trade.
  {
    const rows = [base("fasso", { tradeKey: "landscaping", suggestedTradeKeys: ["landscaping", "tree_care"] }), base("chase", { tradeKey: "tree_care", suggestedTradeKeys: ["landscaping", "tree_care"] })];
    const { db, updates, corrections, audits, campaigns } = makeClient(rows);
    const r = await bulkReview({ db, filter: { suggested: "agree" }, decision: "accept", tradeSource: "current", expectedCount: 2, adminId: "a1", now: NOW });
    ok("agree: both written", r.ok && r.count === 2, r);
    ok("agree: two groups, one per trade, each writing that row's own key", updates.length === 2 && updates.every((u) => u.data.tradeKey === rows.find((x) => x.id === u.where.id.in[0]).tradeKey));
    ok("agree: Fasso stays landscaping, Chase stays tree care", rows[0].tradeKey === "landscaping" && rows[1].tradeKey === "tree_care" && rows.every((x) => x.status === "discovered"));
    ok("agree: a correction per row on field:tradeKey", corrections.length === 2 && corrections.every((c) => c.target === "field:tradeKey"));
    ok("agree: the audit row names the source, not a single key", audits[0].details.tradeSource === "current" && audits[0].details.tradeKey === null);
    ok("agree: the campaign's needs_review moved to accepted", campaigns[0].needsReviewCount === 8 && campaigns[0].acceptedCount === 2);
  }
  // mixed: the first suggested key.
  {
    const rows = [base("huber", { status: "discovered", classification: "contractor", suggestedTradeKeys: ["excavation"] }), base("nursery", { status: "discovered", classification: "contractor", suggestedTradeKeys: ["landscaping", "tree_care"] })];
    const { db } = makeClient(rows);
    const r = await bulkReview({ db, filter: { suggested: "mixed" }, decision: "accept", tradeSource: "suggested", expectedCount: 2, adminId: "a1", now: NOW });
    ok("mixed: both written as their first suggested trade", r.ok && rows[0].tradeKey === "excavation" && rows[1].tradeKey === "landscaping");
  }
  // suggested with nothing stored: refused by the effects table, count mismatch, nothing written.
  {
    const rows = [base("blank", { status: "discovered", classification: "contractor", suggestedTradeKeys: [] })];
    const { db, updates } = makeClient(rows);
    const r = await bulkReview({ db, filter: { suggested: "mixed" }, decision: "accept", tradeSource: "suggested", expectedCount: 1, adminId: "a1", now: NOW });
    ok("suggested with no stored key: skipped, nothing written, ok with count 0", r.ok && r.count === 0 && updates.length === 0 && rows[0].tradeKey === null);
  }
  // given still works exactly as before.
  {
    const rows = [base("r1", { status: "discovered", classification: "contractor" })];
    const { db } = makeClient(rows);
    const r = await bulkReview({ db, filter: { suggested: "roofing" }, decision: "accept", tradeKey: "roofing", expectedCount: 1, adminId: "a1", now: NOW });
    ok("given: writes the one key", r.ok && rows[0].tradeKey === "roofing");
  }
  ok("an unknown source throws", await bulkReview({ db: { $queryRaw: async () => [] }, filter: {}, decision: "accept", tradeSource: "random", expectedCount: 0, adminId: "a" }).then(() => false, (e) => /tradeSource/.test(e.message)));

  // The filter and the cards.
  const f = parseReviewFilter({ suggested: "hvac", ids: ["a", "a", " b ", 42, "", "x".repeat(41)] });
  ok("parseReviewFilter: a trade card and de-duplicated, trimmed, bounded ids", f.suggested === "hvac" && JSON.stringify(f.ids) === JSON.stringify(["a", "b"]));
  ok("parseReviewFilter: ids are capped at a page", parseReviewFilter({ ids: Array.from({ length: 200 }, (_, i) => `id${i}`) }).ids.length === REVIEW_PAGE_SIZE);
  ok("parseReviewFilter: an unknown card is no filter", parseReviewFilter({ suggested: "welding" }).suggested === null && parseReviewFilter(new URLSearchParams("suggested=agree")).suggested === "agree");
  ok("parseReviewFilter: ids from a URL are never read", parseReviewFilter(new URLSearchParams("ids=a")).ids === null);
  const whereText = (q) => q.strings.join("?") + JSON.stringify(q.values.map((v) => (v?.strings ? v.strings.join("?") : v)));
  ok("reviewWhereSql with a card includes the card's clause and the id list", /suggestedTradeKey/.test(whereText(reviewWhereSql({ suggested: "hvac", ids: ["a"] }, { now: NOW }))) && /"id" IN/.test(whereText(reviewWhereSql({ suggested: "hvac", ids: ["a"] }, { now: NOW }))));
  ok("reviewOrderSql without a card keeps the keyword sort; with a card it is name order", /~\*/.test(whereText(reviewOrderSql({}))) && !/~\*/.test(whereText(reviewOrderSql({ suggested: "hvac" }))) && /"businessName" ASC/.test(whereText(reviewOrderSql({ suggested: "hvac" }))));
  for (const key of [...Object.keys(SUGGESTED_GROUPS), "hvac"]) {
    const t = whereText(suggestedGroupSql(key));
    ok(`card ${key}: excludes flagged duplicates`, t.includes('"possibleDuplicateOfId" IS NULL'));
  }
  ok("a trade card requires tradeKey IS NULL and no shop word", whereText(suggestedGroupSql("hvac")).includes('"tradeKey" IS NULL') && whereText(suggestedGroupSql("hvac")).includes('IS NOT TRUE'));
  ok("agree requires the current trade to be among the suggested keys", whereText(suggestedGroupSql("agree")).includes('"tradeKey" = ANY("suggestedTradeKeys")'));
  ok("conflict requires a suggestion the current trade is NOT among", whereText(suggestedGroupSql("conflict")).includes('NOT ("tradeKey" = ANY("suggestedTradeKeys"))'));
  ok("mixed is a shop word WITH keys; not_contractor a shop word WITHOUT", whereText(suggestedGroupSql("mixed")).includes("cardinality") && whereText(suggestedGroupSql("not_contractor")).includes("= 0"));
  ok("an unknown card throws rather than matching everything", (() => { try { suggestedGroupSql("welding"); return false; } catch { return true; } })());
  ok("every card's accept sources are real sources", Object.values(SUGGESTED_GROUPS).every((g) => g.accept.every((a) => TRADE_SOURCES.includes(a))));
  ok("not_contractor and none are never bulk-accepted; conflict offers both sides; a trade card offers given", suggestedGroupAccepts("not_contractor", { isTradeKey: isDiscoveryTradeKey }).length === 0 && suggestedGroupAccepts("none", { isTradeKey: isDiscoveryTradeKey }).length === 0 && suggestedGroupAccepts("conflict", { isTradeKey: isDiscoveryTradeKey }).join() === "current,suggested" && suggestedGroupAccepts("hvac", { isTradeKey: isDiscoveryTradeKey }).join() === "given");
  ok("reject: trade cards, mixed and not_contractor; never agree, conflict or none", suggestedGroupReject("hvac", { isTradeKey: isDiscoveryTradeKey }) && suggestedGroupReject("mixed", { isTradeKey: isDiscoveryTradeKey }) && suggestedGroupReject("not_contractor", { isTradeKey: isDiscoveryTradeKey }) && !suggestedGroupReject("agree", { isTradeKey: isDiscoveryTradeKey }) && !suggestedGroupReject("none", { isTradeKey: isDiscoveryTradeKey }));
  ok("conflict is unticked by default; the rest of the actionable cards are ticked", SUGGESTED_GROUPS.conflict.checkedByDefault === false && SUGGESTED_GROUPS.agree.checkedByDefault && SUGGESTED_GROUPS.mixed.checkedByDefault);
  const bulkRoute = read("app/api/platform/sales/review/bulk/route.js");
  ok("the bulk route reads tradeSource, checks it against the card, and refuses a per-row source without a card", bulkRoute.includes("tradeSource") && bulkRoute.includes("suggestedGroupAccepts") && bulkRoute.includes("A per-row trade source needs a By-suggestion card"));
  ok("the bulk route counts a card or ids as narrowing", /filter\.suggested \|\| filter\.ids/.test(bulkRoute));
}

/* ═══════════════════════════════════════════════════════════════════════════
   7. Phase 2 — the parser, the schema, the arithmetic
   ═══════════════════════════════════════════════════════════════════════════ */

section("7. suggestTradesAi");
{
  const schema = tradeSuggestionSchema();
  ok("the schema passes the vendor's strict lint", assertStrictSchema(schema).ok, assertStrictSchema(schema).errors);
  ok("the schema's enum is exactly the catalogue plus the two verdicts", JSON.stringify(schema.properties.results.items.properties.tradeKey.enum) === JSON.stringify([...Object.keys(DISCOVERY_TRADES), ...AI_VERDICTS]));
  const good = { results: [{ i: 0, tradeKey: "plumbing", confidence: 0.8, why: "name says plumbing" }] };
  ok("a good reply validates against the schema", validateAgainstSchema(good, schema).ok);
  const hostile = {
    results: [
      { i: 0, tradeKey: "plumbing", confidence: 0.8, why: "name says plumbing" },
      { i: 1, tradeKey: "welding", confidence: 0.9, why: "not a trade we sell" },
      { i: 2, tradeKey: "not_contractor", confidence: 0.7, why: "supply" },
      { i: 3, tradeKey: "unknown", confidence: 0.2, why: "a person's name" },
      { i: 4, tradeKey: "roofing", confidence: 1.4, why: "over one" },
      { i: 99, tradeKey: "roofing", confidence: 0.5, why: "outside the batch" },
      { i: 0, tradeKey: "hvac", confidence: 0.5, why: "answered twice" },
      { i: "5", tradeKey: "roofing", confidence: 0.5, why: "string index" },
      { i: 5, tradeKey: "roofing", confidence: 0.5, why: "one two three four five six seven eight nine ten" },
      { i: 6, tradeKey: "Plumbing", confidence: 0.5, why: "wrong case is not a key" },
    ],
  };
  const parsed = parseAiSuggestions(hostile, 10);
  ok("kept: plumbing, not_contractor, unknown, and the eight-word why", parsed.kept.length === 4 && parsed.kept.map((k) => k.i).join() === "0,2,3,5", parsed.kept.map((k) => `${k.i}:${k.tradeKey || k.verdict}`));
  ok("dropped: welding, confidence 1.4, index 99, the second answer for 0, a string index, wrong case", parsed.dropped.length === 6, parsed.dropped);
  ok("a why is cut at eight words", parsed.kept.find((k) => k.i === 5).why.split(" ").length === 8);
  ok("a verdict row has tradeKey null and the verdict; a trade row the reverse", parsed.kept[1].tradeKey === null && parsed.kept[1].verdict === "not_contractor" && parsed.kept[0].tradeKey === "plumbing" && parsed.kept[0].verdict === null);
  ok("garbage in, nothing kept, nothing thrown", parseAiSuggestions(null, 5).kept.length === 0 && parseAiSuggestions({ results: "x" }, 5).kept.length === 0 && parseAiSuggestions({ results: [null, 1, "a"] }, 5).kept.length === 0);

  const rows = Array.from({ length: AI_BATCH }, (_, i) => ({ id: `p${i}`, businessName: `Business ${i} Construction LLC`, city: "Gowanda", province: "NY" }));
  const prompt = tradeSuggestionPrompt(rows);
  ok("the prompt numbers rows from zero and never carries an id", prompt.includes("\n0\tBusiness 0") && !prompt.includes("p0\t") && !/\bp\d+\b/.test(prompt));
  ok("the prompt carries every catalogue key with its label", Object.entries(DISCOVERY_TRADES).every(([k, t]) => prompt.includes(`${k} = ${t.label}`)));
  const overheadChars = TRADE_SUGGESTION_SYSTEM.length + tradeListForPrompt().length + 120;
  ok("PROMPT_OVERHEAD_TOKENS is within 25% of the prompt's measured overhead (chars/4)", Math.abs(overheadChars / 4 - PROMPT_OVERHEAD_TOKENS) / PROMPT_OVERHEAD_TOKENS < 0.25, { measured: Math.round(overheadChars / 4), declared: PROMPT_OVERHEAD_TOKENS });
  const est = costFromCounts({ rows: 163311, avgChars: 31.2, model: "gpt-5-mini" });
  ok("the estimate is priced from lib/ai/usage.js's table, not a typed number", est.priced === hasKnownPricing("gpt-5-mini") && est.costMicros > 0 && est.batches === 1634, est);
  const unpriced = costFromCounts({ rows: 100, avgChars: 30, model: "some-model-nobody-priced" });
  ok("an unpriced model reports null rather than the fallback price", unpriced.priced === false && unpriced.costMicros === null);
  ok("zero rows is zero everything", costFromCounts({ rows: 0, avgChars: 0 }).batches === 0 && costFromCounts({ rows: 0, avgChars: 0 }).promptTokens === 0);
  const noComments = (src) => src.replace(/\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
  ok("the UI never carries a price: no dollar figure in the page's or the route's code", !/\$\d/.test(noComments(read("app/platform/sales/review/page.js"))) && !/\$\d/.test(noComments(read("app/api/platform/sales/review/suggested/ai/route.js"))));
  ok("the confirm phrase is words", AI_CONFIRM_PHRASE === "COMPUTE AI SUGGESTIONS");
  ok("the area is a platform area string", TRADE_SUGGESTION_AI_AREA === "trade_suggestion");

  // The loop against a fake model: budget checked before, usage recorded after, a refusal stops it.
  {
    const store = [{ id: "q1", businessName: "Mosspro LLC", city: "X", province: "OR" }, { id: "q2", businessName: "Krishna Patel", city: "Y", province: "CA" }];
    const calls = [];
    const usages = [];
    const writes = [];
    const db = {
      async $queryRaw(strings, ...values) {
        const text = strings.join("?");
        if (text.startsWith("SELECT COUNT(*)")) return [{ n: store.length }];
        const cursor = values.find((v) => typeof v === "string" && /^q\d$/.test(v)) || null;
        return store.filter((r) => !cursor || r.id > cursor).map((r) => ({ ...r }));
      },
      async $executeRaw(strings, ...values) {
        writes.push(values);
        return values[2].length;
      },
    };
    const askModel = async (args) => {
      calls.push(args);
      await args.onUsage({ model: "gpt-5-mini", promptTokens: 500, completionTokens: 120 });
      return { ok: true, data: { results: [{ i: 0, tradeKey: "unknown", confidence: 0.3, why: "a name" }, { i: 1, tradeKey: "unknown", confidence: 0.2, why: "a person" }] } };
    };
    const checkBudget = async () => ({ allowed: true, reason: null });
    const recordUsage = async (d, u) => usages.push(u);
    const r = await suggestTradesAi({ db, askModel, checkBudget, recordUsage, now: NOW });
    ok("one call for two rows, both unknown, both written", r.batches === 1 && r.unknown === 2 && r.written === 2 && r.considered === 2, r);
    ok("the call went through complete() with the strict schema and the system prompt", calls[0].schema && calls[0].system === TRADE_SUGGESTION_SYSTEM && calls[0].schemaName === TRADE_SUGGESTION_AI_AREA);
    ok("usage recorded under the platform area from the vendor's counts", usages.length === 1 && usages[0].area === TRADE_SUGGESTION_AI_AREA && usages[0].promptTokens === 500 && usages[0].model === "gpt-5-mini");
    ok("cost reported from the vendor's counts through the price table", r.costMicros > 0 && r.model === "gpt-5-mini");
    ok("an unknown answer is written with basis ai so the row is not asked twice", writes[0][3].join() === "," && /'ai'/.test(read("lib/sales/discovery/suggestTradesAi.js")));
    const refused = await suggestTradesAi({ db, askModel, checkBudget: async () => ({ allowed: false, reason: "daily_budget" }), recordUsage, now: NOW });
    ok("a spent budget stops before any call", refused.batches === 0 && refused.stopped === "daily_budget" && refused.considered === 0);
    const vendorDown = await suggestTradesAi({ db, askModel: async () => ({ ok: false, reason: "vendor_error", message: "429" }), checkBudget, recordUsage, now: NOW });
    ok("a vendor failure stops after the one call, writes nothing", vendorDown.batches === 1 && vendorDown.written === 0 && /vendor_error/.test(vendorDown.stopped));
  }
  // The money ceiling inside the loop.
  {
    const store = Array.from({ length: 5 * AI_BATCH }, (_, i) => ({ id: `q${String(i).padStart(3, "0")}`, businessName: `Name ${i}`, city: "X", province: "OR" }));
    let calls = 0;
    const db = {
      async $queryRaw(strings, ...values) {
        const text = strings.join("?");
        if (text.startsWith("SELECT COUNT(*)")) return [{ n: store.length }];
        const cursor = values.find((v) => typeof v === "string" && /^q\d{3}$/.test(v)) || null;
        const take = values.find((v) => typeof v === "number") ?? AI_BATCH;
        return store.filter((r) => !cursor || r.id > cursor).slice(0, take).map((r) => ({ ...r }));
      },
      async $executeRaw(strings, ...values) { return values[2].length; },
    };
    const askModel = async (args) => {
      calls += 1;
      await args.onUsage({ model: "gpt-5-mini", promptTokens: 1_000_000, completionTokens: 1_000_000 }); // $1.13 a call at the table's price
      return { ok: true, data: { results: [{ i: 0, tradeKey: "unknown", confidence: 0.1, why: "x" }] } };
    };
    const r = await suggestTradesAi({ db, askModel, checkBudget: async () => ({ allowed: true }), recordUsage: async () => {}, budgetMicros: 2_000_000, now: NOW });
    ok("budgetMicros stops the loop before the batch that would pass it (two calls at $1.13 reach $2)", calls === 2 && r.stopped === "job_budget" && r.costMicros > 2_000_000 && r.considered === 2 * AI_BATCH, r);
  }

  const cron = read("app/api/cron/sales-pipeline/route.js");
  ok("the cron runs the FREE slice in missing mode", cron.includes('mode: "missing"') && cron.includes("SUGGEST_CRON_SLICE"));
  ok("the cron runs the PAID pass only through the approval slice, with the time left, never suggestTradesAi directly", cron.includes("runTradeSuggestAiSlice") && !cron.includes("suggestTradesAi(") && cron.includes("maxDuration * 1000 - elapsed"));
  ok("nothing but the approval slice and the --apply script calls suggestTradesAi", (() => {
    const direct = ["lib/sales/discovery/suggestTradesAiApproval.js", "scripts/suggest-trades.mjs"];
    return read(direct[0]).includes("run = suggestTradesAi") && read(direct[1]).includes("suggestTradesAi(") && !read("app/api/platform/sales/review/suggested/ai/route.js").includes("suggestTradesAi(") && !read("app/api/platform/sales/review/suggested/route.js").includes("suggestTradesAi");
  })());
  ok("the script runs the AI pass here only behind --apply, and --approve sends nothing to a vendor", read("scripts/suggest-trades.mjs").includes("if (!apply)") && read("scripts/suggest-trades.mjs").includes("--approve"));
}

/* ═══════════════════════════════════════════════════════════════════════════
   7b. The approval: the cron slice refuses without it, stops at the cap, clears when done
   ═══════════════════════════════════════════════════════════════════════════ */

section("7b. The stored approval and the unattended slice");
{
  function makeDb({ rows = 3 } = {}) {
    let budget = null;
    const audits = [];
    const usage = [];
    // `rows` BATCHES of AI_BATCH names, so one model call is one "row" of the fixture.
    const store = Array.from({ length: rows * AI_BATCH }, (_, i) => ({ id: `q${String(i).padStart(5, "0")}`, businessName: `Name ${i}`, city: "X", province: "OR" }));
    const asked = new Set();
    const db = {
      platformAiBudget: {
        async findUnique() { return budget ? { ...budget } : null; },
        async upsert({ create, update }) { budget = budget ? { ...budget, ...update } : { ...create }; return { ...budget }; },
        async update({ data }) { budget = { ...budget, ...data }; return { ...budget }; },
        async updateMany({ where, data }) {
          if (!budget || (where.active !== undefined && budget.active !== where.active)) return { count: 0 };
          if (where.OR) {
            const free = budget.sliceLeaseUntil == null || (where.OR[1]?.sliceLeaseUntil?.lt && budget.sliceLeaseUntil < where.OR[1].sliceLeaseUntil.lt);
            if (!free) return { count: 0 };
          }
          budget = { ...budget, ...data };
          return { count: 1 };
        },
      },
      platformAiUsage: {
        async aggregate({ where }) {
          const since = where.createdAt.gte;
          return { _sum: { costMicros: usage.filter((u) => u.area === where.area && u.createdAt >= since).reduce((a, u) => a + u.costMicros, 0) } };
        },
        async create({ data }) { usage.push({ ...data, createdAt: data.createdAt || new Date() }); return data; },
      },
      platformAuditLog: { async create({ data }) { audits.push(data); return data; } },
      async $queryRaw(strings, ...values) {
        const text = strings.join("?");
        const left = store.filter((r) => !asked.has(r.id));
        if (text.startsWith("SELECT COUNT(*)") && text.includes("AVG")) return [{ n: left.length / AI_BATCH, chars: 12 }];
        if (text.startsWith("SELECT COUNT(*)")) return [{ n: left.length / AI_BATCH }];
        const cursor = values.find((v) => typeof v === "string" && /^q\d{5}$/.test(v)) || null;
        const take = values.find((v) => typeof v === "number") ?? AI_BATCH;
        return left.filter((r) => !cursor || r.id > cursor).slice(0, take).map((r) => ({ ...r }));
      },
      async $executeRaw(strings, ...values) { for (const id of values[2]) asked.add(id); return values[2].length; },
    };
    return { db, audits, usage, get budget() { return budget; } };
  }
  // A run that costs `micros` per row and records it in the ledger, like the real one.
  const runner = (micros) => async ({ db, deadlineMs, budgetMicros, now, recordUsage }) =>
    suggestTradesAi({
      db, deadlineMs, budgetMicros, now, recordUsage,
      checkBudget: async () => ({ allowed: true }),
      askModel: async (args) => {
        await args.onUsage({ model: "gpt-5-mini", promptTokens: 0, completionTokens: Math.round(micros / 1.0) }); // $1/M output → micros
        return { ok: true, data: { results: Array.from({ length: AI_BATCH }, (_, i) => ({ i, tradeKey: "plumbing", confidence: 0.7, why: "plumb" })) } };
      },
    });
  // Early in the day, because the fake ledger stamps rows with the real clock
  // and the approval sums from approvedAt.
  const T0 = new Date("2026-09-13T00:00:00Z");

  // 1. No approval: nothing runs.
  {
    const f = makeDb();
    const r = await runTradeSuggestAiSlice({ db: f.db, deadlineMs: 60_000, now: T0, run: runner(10) });
    ok("no approval row → the slice refuses and sends nothing", r.ran === false && r.skipped === "no approval" && f.usage.length === 0 && f.audits.length === 0, r);
  }
  // 2. Approve, run to the end: clears with "done".
  {
    const f = makeDb({ rows: 3 });
    const { row } = await approveTradeSuggestAi(f.db, { approvedBy: "owner via chat 2026-09-13", budgetMicros: 10_000_000, adminId: "a1", now: T0 });
    ok("approval row: scope job, the key, the cap, active, who, when, the note carries what was known", row.scope === JOB_SCOPE && row.scopeId === TRADE_SUGGEST_AI_JOB && row.limitMicros === 10_000_000 && row.active && row.approvedBy === "owner via chat 2026-09-13" && row.approvedAt === T0 && /3 rows remained/.test(row.note), row);
    ok("approval audited with kind approved and the remaining count", f.audits[0].action === "sales_trade_suggestions_ai_approval" && f.audits[0].details.kind === "approved" && f.audits[0].details.remainingAtApproval === 3);
    const a = await loadTradeSuggestAiApproval(f.db);
    ok("loaded: approved, nothing spent yet, the whole cap remains", a.approved && a.spentMicros === 0 && a.remainingMicros === 10_000_000);
    const r = await runTradeSuggestAiSlice({ db: f.db, deadlineMs: 60_000, now: new Date(T0.getTime() + 1000), run: runner(1000), adminId: "a1", trigger: "cron" });
    ok("the slice ran every row and cleared itself: done", r.ran && r.cleared === "done" && r.result.remaining === 0 && f.budget.active === false && /cleared .*every row has been asked/.test(f.budget.note), { cleared: r.cleared, note: f.budget.note });
    ok("spend under the approval is summed from the ledger and cached on the row", r.spentMicros === 3000 && f.budget.cachedSpentMicros === 3000);
    ok("one audit row for the slice (trigger cron, cleared done) and one for the clearing", f.audits.some((x) => x.action === "sales_trade_suggestions_ai" && x.details.trigger === "cron" && x.details.cleared === "done") && f.audits.some((x) => x.details.kind === "cleared" && x.details.reason === "done"));
    ok("every audit row names the admin (the column is NOT NULL)", f.audits.every((x) => x.platformAdminId === "a1"));
    const again = await runTradeSuggestAiSlice({ db: f.db, deadlineMs: 60_000, now: T0, run: runner(1000) });
    ok("the next tick finds no approval and does nothing", again.ran === false && again.skipped === "no approval");
  }
  // 3. Approve with a small cap: stops at the budget, clears with "budget", one batch overshoot at most.
  {
    const f = makeDb({ rows: 50 });
    await approveTradeSuggestAi(f.db, { approvedBy: "test", budgetMicros: 2_500_000, now: T0 });
    const r = await runTradeSuggestAiSlice({ db: f.db, deadlineMs: 60_000, now: new Date(T0.getTime() + 1000), run: runner(1_000_000) });
    ok("an unattended slice (no admin) writes NO audit row — the ledger and the budget row are its record", f.audits.length === 0 && f.usage.length === 3 && f.budget.cachedSpentMicros === 3_000_000);
    ok("a $2.50 cap with $1 batches: three batches, stopped at job_budget, cleared budget, 47 rows left untouched", r.ran && r.result.batches === 3 && r.result.stopped === "job_budget" && r.cleared === "budget" && r.result.remaining === 47 && f.budget.active === false && /budget cap was reached/.test(f.budget.note), { batches: r.result.batches, stopped: r.result.stopped, cleared: r.cleared, remaining: r.result.remaining });
    const after = await loadTradeSuggestAiApproval(f.db);
    ok("after clearing, the loaded approval is not approved and reports the cached spend", after.approved === false && after.spentMicros === 3_000_000);
  }
  // 4. Already over the cap when the tick arrives (spend landed between ticks): cleared before any call.
  {
    const f = makeDb({ rows: 5 });
    await approveTradeSuggestAi(f.db, { approvedBy: "test", budgetMicros: 1_000, now: T0 });
    await f.db.platformAiUsage.create({ data: { area: "trade_suggestion", model: "gpt-5-mini", costMicros: 5_000, createdAt: new Date(T0.getTime() + 500) } });
    const r = await runTradeSuggestAiSlice({ db: f.db, deadlineMs: 60_000, now: new Date(T0.getTime() + 1000), run: async () => { throw new Error("must not run"); } });
    ok("cap already spent → cleared as budget without a model call", r.ran === false && r.cleared === "budget" && f.budget.active === false);
    ok("spend from BEFORE the approval does not count (a fresh approval sums from its own approvedAt)", (await approveTradeSuggestAi(f.db, { approvedBy: "test", budgetMicros: 1_000, now: new Date(T0.getTime() + 2000) })) && (await loadTradeSuggestAiApproval(f.db)).spentMicros === 0);
  }
  // 5. No time left in the invocation: nothing sent, approval kept.
  {
    const f = makeDb({ rows: 2 });
    await approveTradeSuggestAi(f.db, { approvedBy: "test", now: T0 });
    const r = await runTradeSuggestAiSlice({ db: f.db, deadlineMs: 0, now: T0, run: async () => { throw new Error("must not run"); } });
    ok("no time left → skipped, approval still active", r.ran === false && /no time/.test(r.skipped) && f.budget.active === true);
    const stopped = await clearTradeSuggestAiApproval(f.db, { reason: "stopped", now: T0 });
    ok("a superadmin's stop clears with its own reason", stopped.active === false && /stopped by a superadmin/.test(stopped.note) && CLEAR_REASONS.stopped);
  }
  // 6. Two ticks at once: the second finds the lease held and does nothing; a stale lease is reclaimed; a throw releases it.
  {
    const f = makeDb({ rows: 4 });
    await approveTradeSuggestAi(f.db, { approvedBy: "test", now: T0 });
    let release;
    const slow = () => new Promise((resolve) => { release = resolve; });
    const first = runTradeSuggestAiSlice({ db: f.db, deadlineMs: 60_000, now: new Date(T0.getTime() + 1000), run: async () => { await slow(); return { remaining: 3, stopped: null, batches: 1, considered: 100, written: 100, unknown: 0, notContractor: 0, byTrade: {}, costMicros: 0, model: "m", seconds: 1 }; } });
    await new Promise((r) => setTimeout(r, 10));
    const second = await runTradeSuggestAiSlice({ db: f.db, deadlineMs: 60_000, now: new Date(T0.getTime() + 2000), run: async () => { throw new Error("must not run while the lease is held"); } });
    ok("a second tick while the first runs: skipped, another slice holds the job", second.ran === false && /holds the job/.test(second.skipped) && f.budget.sliceLeaseUntil > new Date(T0.getTime() + 60_000));
    release();
    const r1 = await first;
    ok("the first slice ran and released the lease", r1.ran && f.budget.sliceLeaseUntil === null);
    f.budget.sliceLeaseUntil = new Date(T0.getTime() - 1); // a dead slice's lease, already past
    const third = await runTradeSuggestAiSlice({ db: f.db, deadlineMs: 60_000, now: T0, run: async () => ({ remaining: 3, stopped: null, batches: 0, considered: 0, written: 0, unknown: 0, notContractor: 0, byTrade: {}, costMicros: 0, model: null, seconds: 0 }) });
    ok("a stale lease is reclaimed", third.ran === true);
    await runTradeSuggestAiSlice({ db: f.db, deadlineMs: 60_000, now: T0, run: async () => { throw new Error("vendor exploded"); } }).catch(() => {});
    ok("a slice that throws still releases the lease", f.budget.sliceLeaseUntil === null && f.budget.active === true);
  }
  ok("the cap constant is $10", TRADE_SUGGEST_AI_CAP_MICROS === 10_000_000);
  ok("approving needs a name and a non-zero budget", await approveTradeSuggestAi(makeDb().db, { approvedBy: "", now: T0 }).then(() => false, (e) => /approvedBy/.test(e.message)) && await approveTradeSuggestAi(makeDb().db, { approvedBy: "x", budgetMicros: 0, now: T0 }).then(() => false, (e) => /zero budget/.test(e.message)));
  ok("clearing with a made-up reason throws", await clearTradeSuggestAiApproval(makeDb().db, { reason: "bored" }).then(() => false, (e) => /reason/.test(e.message)));
  const schema = read("prisma/schema.prisma");
  ok("PlatformAiBudget carries approvedAt / approvedBy / note / sliceLeaseUntil", /approvedAt DateTime\?/.test(schema) && /approvedBy String\?/.test(schema) && /sliceLeaseUntil DateTime\?/.test(schema) && schema.includes("A \"job\" budget"));
  ok("the claim is a guarded updateMany on the lease, never a read-then-write", /updateMany\(\{\s*where: \{ scope: JOB_SCOPE, scopeId: TRADE_SUGGEST_AI_JOB, active: true, OR: \[\{ sliceLeaseUntil: null \}, \{ sliceLeaseUntil: \{ lt: now \} \}\] \}/.test(read("lib/sales/discovery/suggestTradesAiApproval.js")));
  ok("the approval audit action is registered", Boolean(AUDIT_ACTIONS.sales_trade_suggestions_ai_approval));
  const aiRoute = read("app/api/platform/sales/review/suggested/ai/route.js");
  ok("the button approves then runs the first slice; { clear } withdraws", aiRoute.includes("approveTradeSuggestAi(") && aiRoute.includes("runTradeSuggestAiSlice(") && aiRoute.includes("body?.clear === true"));
  ok("the page shows the approval and offers Stop while it runs", read("app/platform/sales/review/page.js").includes("data-suggest-ai-stop") && read("app/platform/sales/review/page.js").includes("ai.approval.spent"));
}

/* ═══════════════════════════════════════════════════════════════════════════
   8. Wiring
   ═══════════════════════════════════════════════════════════════════════════ */

section("8. Wiring");
{
  const page = read("app/platform/sales/review/page.js");
  ok("the page has the mode switch and both modes", page.includes('data-review-mode') && page.includes("function SuggestedMode") && page.includes("function RowsMode"));
  ok("the page calls the cards route, the compute route, the AI estimate and the bulk route", page.includes('"/api/platform/sales/review/suggested"') && page.includes('"/api/platform/sales/review/suggested/ai"') && page.includes('"/api/platform/sales/review/bulk"'));
  ok("the page sends the card and the ticked ids, and a trade source", page.includes("filter: { suggested: card.key, ids: confirm.ids }") && page.includes("tradeSource: confirm.tradeSource"));
  ok("the page highlights the note's words on the raw name", page.includes("function Highlighted") && page.includes("noteWords(stored.note)"));
  ok("space ticks, Enter accepts, j/k move", page.includes('e.key === " "') && page.includes('e.key === "Enter" && card.accepts.length === 1'));
  ok("the AI button is behind a typed phrase", page.includes("aiConfirm.typed !== ai.confirmPhrase"));
  ok("the AI cost on the screen comes from the route, never typed", page.includes("ai.cost") && !/\$\d/.test(page));
  ok("the row-by-row mode is untouched: its keyboard, its bulk panel, its maintenance panel", page.includes("data-bulk-open") && page.includes("data-reclassify-dry") && page.includes('e.key === "x" && current'));
  const pkg = JSON.parse(read("package.json"));
  ok("package.json has check:trade-suggestions", typeof pkg.scripts["check:trade-suggestions"] === "string" && pkg.scripts["check:trade-suggestions"].includes("check-trade-suggestions.mjs"));
  ok("check:all runs it", pkg.scripts["check:all"].includes("check:trade-suggestions"));
  ok("package.json has suggest:trades", typeof pkg.scripts["suggest:trades"] === "string");
  ok("both audit actions are registered", AUDIT_ACTIONS.sales_trade_suggestions_computed && AUDIT_ACTIONS.sales_trade_suggestions_ai);
  const harness = read("docs/screens/platform-mobile/harness/fixtures/salesDiscovery.js");
  ok("the platform-mobile harness answers the new routes", harness.includes('"/api/platform/sales/review/suggested"') && harness.includes('"/api/platform/sales/review/suggested/ai"'));
  const roadmap = read("docs/ROADMAP.md");
  ok("ROADMAP mentions the By-suggestion mode", /By.suggestion/i.test(roadmap));
}

console.log(`\n${checks} checks, ${failures} failed`);
process.exit(failures ? 1 : 0);
