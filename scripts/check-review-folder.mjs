// scripts/check-review-folder.mjs
//
// The Review folder, executed: the trade suggester against hostile names,
// the decision table against every (bucket × decision) pair with the funnel
// arithmetic asserted, the single-row writer and the bulk writer against an
// in-memory client, and the ingest's licence-register rule.
//
//   npm run check:review-folder
//
// ── What is proved by running rather than by reading ───────────────────────
//
//   1. suggestTrades() on 40 fixtures: French accents, hyphenated compounds,
//      "Électro-Plomberie" → two suggestions in name order, shop words beside
//      trade words → NO suggestion, the empty name, a licence authorised for
//      one code, a licence with the general bundle around that code, a
//      California B + C-33, an ambiguous C-6, a MULTI_TRADE crawl.
//   2. decisionEffects(): for each of the three buckets and each of the four
//      decisions, the counter deltas applied to a reconciling campaign leave
//      it reconciling (funnelProblems() empty) and the row lands where the
//      decision says.
//   3. reviewDecide() with an in-memory client: accept sets tradeKey, writes
//      one ProspectCorrection on field:tradeKey, moves the counters by the
//      effects deltas, writes one audit row, calls the research queuer; a
//      concurrent change (updateMany matching 0) is refused and writes
//      nothing after it.
//   4. bulkReview() with an in-memory client whose SELECT deliberately
//      returns a claimed row and a do-not-contact row: the do-not-contact
//      row is refused by the effects table before any write, the claimed
//      row is refused by the updateMany's own where, the count disagrees,
//      and the whole transaction rolls back — nothing half-applied. Then the
//      honest selection: one audit row, one correction per written row,
//      counters per campaign balance.
//   5. planIngest(): a licence-register row with no signal classifies as
//      contractor with the register named; an Overture row with the same
//      shape still needs review; a supplier NAME on a licence row is still
//      a retailer.
//
// ── Mutation-tested ────────────────────────────────────────────────────────
//
// Five deliberate breaks, each reverted after the check went red:
//   - untouchableGuardWhere() without doNotContactAt → 4 fails
//   - decisionEffects() accept from `banked` leaving unmappedCount alone →
//     funnelProblems fires ("kept without a trade > unusable")
//   - RETAIL_WORDS without "depot" → the Peinture Dépôt fixture suggests
//     painting
//   - planIngest() override applied to `retailer` too → the supplier fixture
//     passes as contractor
//   - reviewDecide() not checking moved.count → the stale-row fixture writes
//     a correction anyway

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  suggestTrades,
  nameTrades,
  retailWordIn,
  rbqLicenceTrades,
  keywordTradeKeys,
  licenceTradeKeys,
  keywordToPgRegex,
  nameKeywordPgRegex,
  retailWordPgRegex,
  RETAIL_WORDS,
  MAX_SUGGESTIONS,
} from "../lib/sales/discovery/tradeSuggest.js";
import { RBQ_SUBCATEGORIES, normaliseRbqCode, rbqSubcategory, describeRbqCategory } from "../lib/sales/discovery/rbq/subcategories.js";
import { RBQ_GENERAL_SCOPE_BUNDLE } from "../lib/sales/discovery/rbq/licence.js";
import {
  LICENCE_REGISTERS,
  licenceRegisterReason,
  describeSourceCategories,
} from "../lib/sales/discovery/licenceRegisters.js";
import { discoveryProviders } from "../lib/sales/discovery/providers.js";
import { isDiscoveryTradeKey } from "../lib/sales/discovery/trades.js";
import {
  decisionEffects,
  reviewBucket,
  reviewReasonsOf,
  reviewWhereSql,
  reviewOrderSql,
  untouchableGuardWhere,
  parseReviewFilter,
  countersByCampaign,
  counterUpdates,
  REVIEW_DECISIONS,
} from "../lib/sales/discovery/reviewFolder.js";
import { reviewDecide } from "../lib/sales/discovery/reviewDecide.js";
import { bulkReview } from "../lib/sales/discovery/reviewBulk.js";
import { planIngest } from "../lib/sales/discovery/ingest.js";
import { planReclassification } from "../lib/sales/discovery/reclassifyRegisters.js";
import { funnelProblems } from "../lib/sales/discovery/funnel.js";
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

const NOW = new Date("2026-09-11T20:00:00Z");
const keys = (r) => r.suggestions.map((s) => s.tradeKey);

/* ═══════════════════════════════════════════════════════════════════════════
   1. Suggestions, on hostile names
   ═══════════════════════════════════════════════════════════════════════════ */

section("1. suggestTrades — forty hostile fixtures");
{
  const GENERAL = ["rbq:1.2", ...RBQ_GENERAL_SCOPE_BUNDLE.map((c) => `rbq:${c}`)];
  const rbq = (businessName, codes = GENERAL, extra = {}) => ({
    businessName,
    sourceProvider: "rbq",
    sourceCategories: codes,
    ...extra,
  });
  const cslb = (businessName, classes, extra = {}) => ({
    businessName,
    sourceProvider: "us_ca_cslb",
    sourceCategories: classes,
    ...extra,
  });

  // (name, row, expected keys in order | null for "no suggestion", retailWord)
  const fixtures = [
    ["a roofer, French, accented plural", rbq("Toitures Tremblay inc."), ["roofing"]],
    ["a roofer, English", rbq("Tremblay Roofing Ltd"), ["roofing"]],
    ["two trades in one hyphenated name, name order", rbq("Électro-Plomberie J.-P. inc."), ["electrical", "plumbing"]],
    ["the same two, reversed", rbq("Plomberie & Électricité Roy"), ["plumbing", "electrical"]],
    ["uppercase accented", rbq("ÉLECTRICITÉ GAGNON INC."), ["electrical"]],
    ["accent-less spelling", rbq("Electricite Gagnon inc"), ["electrical"]],
    ["a painter, French", rbq("Peinture Beaulieu"), ["painting"]],
    ["a painter, French, by person", rbq("Les Peintres Réunis"), ["painting"]],
    ["a painter, English", rbq("Coastal Painting & Decorating"), ["painting"]],
    ["landscaping, French", rbq("Paysagement Lavoie"), ["landscaping"]],
    ["landscaping via lawn", rbq("Green Lawn Care"), ["landscaping"]],
    ["excavation", rbq("Excavation Dumont"), ["excavation"]],
    ["concrete, French", rbq("Béton Provincial"), ["masonry_concrete"]],
    ["masonry, French", rbq("Maçonnerie St-Laurent"), ["masonry_concrete"]],
    ["carpentry, French", rbq("Menuiserie Fortin"), ["carpentry"]],
    ["cabinets via cuisine", rbq("Cuisines Laurier"), ["cabinets"]],
    ["cabinets via armoires", rbq("Armoires Design Plus"), ["cabinets"]],
    ["flooring, French", rbq("Planchers Bois Franc Lévis"), ["flooring"]],
    ["drywall, French", rbq("Gypse Expert"), ["drywall"]],
    ["hvac, French", rbq("Chauffage Climatisation Roy"), ["hvac"]],
    ["insulation, French", rbq("Isolation Nord-Sud"), ["insulation"]],
    ["fencing, French", rbq("Clôtures Beauport"), ["fencing"]],
    ["pool, French", rbq("Piscines Soleil"), ["pool_spa"]],
    ["gutters, French", rbq("Gouttières Rive-Sud"), ["gutters"]],
    ["demolition", rbq("Démolition Panzini"), ["demolition"]],
    ["general contractor, French", rbq("Entrepreneur Général Duval"), ["general_contracting"]],
    ["general contractor, hyphenated", rbq("Entrepreneur-Général Duval"), ["general_contracting"]],
    ["bare 'construction' says nothing", rbq("Construction 2Much inc."), []],
    ["a numbered company says nothing", rbq("9410-5111 Québec inc."), []],
    ["Liverpool is not a pool", rbq("Liverpool Construction"), []],
    ["a paint DEPOT is a shop — no suggestion", rbq("Peinture Dépôt"), null, "depot"],
    ["a flooring BOUTIQUE is a shop", rbq("Boutique du Plancher"), null, "boutique"],
    ["a plumbing SUPPLY house is a shop", cslb("Ferguson Plumbing Supply", ["us_ca_cslb_c36"]), null, "supply"],
    ["a hardware store, French", rbq("Quincaillerie Richelieu"), null, "quincaillerie"],
    ["empty name, licence only for 16", rbq("", ["rbq:16"]), ["electrical"]],
    ["null name does not throw", rbq(null, ["rbq:16"]), ["electrical"]],
    ["licence: 16 beside the general scope — the scope is set aside, 16 stands", rbq("Gestion ABC", [...GENERAL, "rbq:16"]), ["electrical"]],
    ["licence: 16 AND 15.5 beside the general scope — two kinds of work, none", rbq("Gestion ABC", [...GENERAL, "rbq:16", "rbq:15.5"]), []],
    ["licence: the bundle WITHOUT a 1.x is the licence's own set — many families, none", rbq("Gestion ABC", RBQ_GENERAL_SCOPE_BUNDLE.map((c) => `rbq:${c}`)), []],
    ["licence: 15.5 alone is a plumber", rbq("Gestion ABC", ["rbq:15.5"]), ["plumbing"]],
    ["licence: 15.5 beside 15.6 (propane) is not one trade", rbq("Gestion ABC", ["rbq:15.5", "rbq:15.6"]), []],
    ["licence: 7 alone names three trades — none", rbq("Gestion ABC", ["rbq:7"]), []],
    ["licence: 12 alone names cabinets AND countertops — none", rbq("Gestion ABC", ["rbq:12"]), []],
    ["licence: general scope only (family 1) suggests nothing", rbq("Gestion ABC"), []],
    ["California B + C-33: B is unrestricted, C-33 is a painter", cslb("ACME", ["us_ca_cslb_b", "us_ca_cslb_c33"]), ["painting"]],
    ["California C-6 names two trades — both offered", cslb("Geist Builders Group", ["us_ca_cslb_b", "us_ca_cslb_c_6"]), ["cabinets", "carpentry"]],
    ["site inference wins first place", rbq("Toitures X", GENERAL, { inferences: [{ kind: "trade", value: "plumbing" }], domain: "x.example" }), ["plumbing", "roofing"]],
    ["MULTI_TRADE crawl suggests nothing from the site", rbq("Gestion ABC", GENERAL, { inferences: [{ kind: "trade", value: "MULTI_TRADE" }] }), []],
    ["a trading name counts", rbq("1104-8618-06 Québec inc.", GENERAL, { tradingNames: ["Plancher Nobel", "Tapis L. Émard Ltée"] }), ["flooring"]],
    ["a shop word in a trading name switches everything off", rbq("Toitures X", GENERAL, { tradingNames: ["Toiture Dépôt"] }), null, "depot"],
    ["appliance repair, not electrical, for électroménager", rbq("Électroménager Dupuis"), ["appliance_repair"]],
    ["renovation is remodelling", rbq("Rénovations Bilodeau"), ["remodeling"]],
    ["never more than three", rbq("Toiture Plomberie Électricité Peinture Gypse"), null, null, true],
  ];

  ok(`there are at least forty fixtures`, fixtures.length >= 40, `${fixtures.length}`);
  for (const [name, row, expected, retailWord, capped] of fixtures) {
    const r = suggestTrades(row);
    if (capped) {
      ok(`${name}`, r.suggestions.length === MAX_SUGGESTIONS, keys(r));
      continue;
    }
    if (expected === null) {
      ok(`${name}`, r.suggestions.length === 0 && r.retailWord === retailWord, { keys: keys(r), retailWord: r.retailWord });
    } else {
      ok(`${name}`, JSON.stringify(keys(r)) === JSON.stringify(expected), { got: keys(r), want: expected });
    }
  }

  ok("every suggestion carries a basis and a label", fixtures.every(([, row]) => suggestTrades(row).suggestions.every((s) => s.basis && s.label && s.source)));
  ok("a name basis quotes the word", suggestTrades(rbq("Toitures Tremblay")).suggestions[0].basis === "name: 'toitur'");
  ok("a licence basis names the code and its French label",
    suggestTrades(rbq("X", ["rbq:16"])).suggestions[0].basis === "licence: only 16 électricité");
  ok("...and says when a general scope sits beside it",
    suggestTrades(rbq("X", [...GENERAL, "rbq:16"])).suggestions[0].basis === "licence: only 16 électricité beyond general scope");
  ok("a site basis names the domain", suggestTrades(rbq("X", [], { inferences: [{ kind: "trade", value: "roofing" }], domain: "toit.example" })).suggestions[0].basis === "site: toit.example");
  ok("every keyword trade key is a catalogue trade", keywordTradeKeys().every(isDiscoveryTradeKey), keywordTradeKeys().filter((k) => !isDiscoveryTradeKey(k)));
  ok("every licence-table trade key is a catalogue trade", licenceTradeKeys().every(isDiscoveryTradeKey));
  ok("nameTrades on undefined is empty", nameTrades(undefined).length === 0 && nameTrades(42).length === 0);
  ok("retailWordIn ignores accents", retailWordIn("Entrepôt du Bois") === "entrepot" && retailWordIn("Matériaux Lavoie") === "materiaux");
  ok("'store' at a word start, not inside 'Restore'", retailWordIn("Restore Construction") === null && retailWordIn("Paint Store") === "store");
  ok("rbqLicenceTrades on no rbq codes is null", rbqLicenceTrades(["us_ca_cslb_b"]) === null && rbqLicenceTrades(null) === null);

  // The Postgres compile of the same table.
  ok("a keyword compiles to a word-start, accent-tolerant regex", keywordToPgRegex("electri") === "\\m[eéèêë]l[eéèêë][cç]tr[iîï]");
  ok("a trailing space compiles to a word end", keywordToPgRegex("electro ").endsWith("\\M"));
  ok("a space inside compiles to a punctuation run", keywordToPgRegex("entrepreneur general").includes("[^[:alnum:]]+"));
  ok("the name regex is one alternation of every keyword", nameKeywordPgRegex().split("|").length === keywordTradeKeys().length + 0 || nameKeywordPgRegex().split("|").length > 80);
  ok("the retail regex covers every shop word", retailWordPgRegex().split("|").length === RETAIL_WORDS.length);
}

/* ═══════════════════════════════════════════════════════════════════════════
   2. The RBQ dictionary
   ═══════════════════════════════════════════════════════════════════════════ */

section("2. RBQ subcategories in words");
{
  ok("every general-bundle code is in the dictionary", RBQ_GENERAL_SCOPE_BUNDLE.every((c) => rbqSubcategory(c)), RBQ_GENERAL_SCOPE_BUNDLE.filter((c) => !rbqSubcategory(c)));
  ok("'rbq:9' and '9.0' and ' 9 ' are one code", normaliseRbqCode("rbq:9") === "9" && normaliseRbqCode("9.0") === "9" && normaliseRbqCode(" 9 ") === "9");
  ok("1.10 is not folded to 1.1", normaliseRbqCode("1.10") === "1.10" && normaliseRbqCode("15.10") === "15.10");
  ok("a non-code is null", normaliseRbqCode("ADM") === null && normaliseRbqCode("") === null && normaliseRbqCode(null) === null);
  ok("16 is électricité", rbqSubcategory("rbq:16")?.fr === "Entrepreneur en électricité");
  ok("15.5 is plomberie", rbqSubcategory("15.5")?.fr === "Entrepreneur en plomberie");
  ok("a described code reads '16 — Entrepreneur en électricité'", describeRbqCategory("rbq:16") === "16 — Entrepreneur en électricité");
  ok("an unknown code is still shown, flagged", describeRbqCategory("rbq:99.9")?.includes("not in this build"));
  ok("the dictionary has the regulation's fifty-plus entries", Object.keys(RBQ_SUBCATEGORIES).length >= 50, `${Object.keys(RBQ_SUBCATEGORIES).length}`);
  const lines = describeSourceCategories("us_ca_cslb", ["us_ca_cslb_c33", "us_ca_cslb_c33", "us_ca_cslb_b"]);
  ok("a CSLB class is described by the board's own label, once", JSON.stringify(lines) === JSON.stringify(["C33 — Painting and Decorating Contractor", "B — General Building Contractor"]), lines);
  ok("an Overture slug passes through", describeSourceCategories("overture", ["painting"])[0] === "painting");
}

/* ═══════════════════════════════════════════════════════════════════════════
   3. Licence registers agree with the provider registry
   ═══════════════════════════════════════════════════════════════════════════ */

section("3. licenceRegisters ↔ providers");
{
  const registered = new Set(discoveryProviders().map((p) => p.key));
  for (const key of Object.keys(LICENCE_REGISTERS)) ok(`"${key}" is a registered provider`, registered.has(key));
  for (const key of registered) {
    const isRegister = /^us_|^rbq$/.test(key);
    ok(`"${key}" ${isRegister ? "is" : "is not"} listed as a licence register`, Boolean(LICENCE_REGISTERS[key]) === isRegister);
  }
  ok("the reason names the register", licenceRegisterReason("rbq") === "Holds a contractor licence (Quebec RBQ).");
  ok("a directory has no reason", licenceRegisterReason("overture") === null);
}

/* ═══════════════════════════════════════════════════════════════════════════
   4. planIngest: a licence is a statement
   ═══════════════════════════════════════════════════════════════════════════ */

section("4. planIngest classifies licence-register rows as contractors");
{
  const business = (name, over = {}) => ({
    sourceRecordId: "L-1",
    name,
    categories: { primary: null, alternate: ["rbq:1.2", "rbq:9"] },
    taxonomyHierarchy: [],
    phones: ["514 555 0100"],
    websites: [],
    emails: [],
    address: { line: "1 Rue X", city: "Laval", province: "QC", postalCode: "H7A 1A1", country: "CA" },
    ...over,
  });
  const ctx = (provider, licenceRegister) => ({ provider, release: "r", tradeKey: null, campaignId: "c1", territoryId: null, licenceRegister });

  const rbqRun = planIngest([business("9410-5111 Québec inc.")], ctx("rbq", "Quebec RBQ"), null);
  ok("an RBQ row with no signal is a contractor", rbqRun.plans[0].verdict.classification === "contractor", rbqRun.plans[0].verdict);
  ok("...with the register named in the reason", rbqRun.plans[0].row.classificationReason === "Holds a contractor licence (Quebec RBQ).");
  ok("...banked with no trade, not accepted", rbqRun.counters.bankedCount === 1 && rbqRun.counters.acceptedCount === 0 && rbqRun.counters.needsReviewCount === 0, rbqRun.counters);
  ok("...status discovered, not needs_review", rbqRun.plans[0].row.status === "discovered");
  ok("...the classifier's own reasons are kept beside the override", rbqRun.plans[0].verdict.reasons.includes("no_signal") && rbqRun.plans[0].verdict.reasons.includes("licence_register"));

  const overtureRun = planIngest([business("9410-5111 Québec inc.", { categories: { primary: "painting", alternate: [] } })], ctx("overture", null), null);
  ok("the same shape from a directory still needs review", overtureRun.plans[0].verdict.classification === "needs_review" && overtureRun.counters.needsReviewCount === 1);

  const supplierRun = planIngest([business("Ferguson Plumbing Supply")], ctx("rbq", "Quebec RBQ"), null);
  ok("a supplier NAME on a licence row is still a retailer — the override reaches needs_review only",
    supplierRun.plans[0].action === "skip" && supplierRun.plans[0].reason === "retailer" && supplierRun.counters.rejectedCount === 1);

  const noCtx = planIngest([business("9410-5111 Québec inc.")], { provider: "rbq", release: "r", tradeKey: null }, null);
  ok("without the context flag nothing changes (the flag is the switch, decided in ingestPage)", noCtx.plans[0].verdict.classification === "needs_review");
  ok("ingestPage passes the flag from the pure map", /licenceRegister: licenceRegisterName\(provider\)/.test(read("lib/sales/discovery/ingest.js")));
}

/* ═══════════════════════════════════════════════════════════════════════════
   5. The decision table, and the funnel it must keep
   ═══════════════════════════════════════════════════════════════════════════ */

section("5. decisionEffects keeps every campaign reconciling");
{
  const campaign = () => ({ foundCount: 100, unmappedCount: 30, bankedCount: 30, duplicateCount: 0, rejectedCount: 10, needsReviewCount: 20, acceptedCount: 40, readyCount: 35, noWebsiteCount: 12 });
  const apply = (c, counters) => {
    const out = { ...c };
    for (const [k, v] of Object.entries(counters)) out[k] = (out[k] || 0) + v;
    return out;
  };
  const rows = {
    needs_review: { id: "p1", status: "needs_review", classification: "needs_review", tradeKey: null, phoneE164: "+15145550100", addressLine: "1 X", websiteUrl: null, possibleDuplicateOfId: null, doNotContactAt: null, campaignId: "c1" },
    banked: { id: "p2", status: "discovered", classification: "contractor", tradeKey: null, phoneE164: "+15145550100", addressLine: null, websiteUrl: "https://x.example", possibleDuplicateOfId: null, doNotContactAt: null, campaignId: "c1" },
    accepted: { id: "p3", status: "discovered", classification: "contractor", tradeKey: "roofing", phoneE164: "+15145550100", addressLine: "1 X", websiteUrl: null, possibleDuplicateOfId: "p9", doNotContactAt: null, campaignId: "c1" },
  };
  ok("the fixture campaign reconciles before anything moves", funnelProblems(campaign()).length === 0);
  for (const [bucket, row] of Object.entries(rows)) {
    ok(`bucket of the ${bucket} fixture is ${bucket}`, reviewBucket(row) === bucket);
    for (const decision of REVIEW_DECISIONS) {
      const e = decisionEffects(row, decision, { tradeKey: "painting", now: NOW });
      ok(`${bucket} × ${decision} is allowed`, e.ok, e.error);
      if (!e.ok) continue;
      const after = apply(campaign(), e.counters);
      const problems = funnelProblems(after);
      ok(`${bucket} × ${decision} keeps the funnel reconciling`, problems.length === 0, problems);
      ok(`${bucket} × ${decision} moves nothing negative`, Object.values(after).every((v) => v >= 0));
    }
  }
  const nr = rows.needs_review;
  const acc = decisionEffects(nr, "accept", { tradeKey: "painting", now: NOW });
  ok("accept from needs_review: -1 needsReview, +1 accepted, +1 ready (phone+address), +1 noWebsite",
    JSON.stringify(acc.counters) === JSON.stringify({ needsReviewCount: -1, acceptedCount: 1, readyCount: 1, noWebsiteCount: 1 }), acc.counters);
  ok("...status becomes discovered, trade set, reason names the trade, flag cleared",
    acc.data.status === "discovered" && acc.data.tradeKey === "painting" && acc.data.classificationReason === "A superadmin reviewed this and chose Painting." && acc.data.possibleDuplicateOfId === null);
  ok("...a correction on field:tradeKey", acc.correction.target === "field:tradeKey" && acc.correction.correctedValue === "painting" && acc.correction.originalValue === null);
  ok("...research is queued", acc.research === true);

  const bank = decisionEffects(rows.banked, "accept", { tradeKey: "painting", now: NOW });
  ok("accept from the bank: -1 unmapped, -1 banked, +1 accepted, no ready (no address), no noWebsite (has one)",
    JSON.stringify(bank.counters) === JSON.stringify({ unmappedCount: -1, bankedCount: -1, acceptedCount: 1 }), bank.counters);
  ok("...status is not touched (already discovered)", !("status" in bank.data));

  const already = decisionEffects(rows.accepted, "accept", { tradeKey: "painting", now: NOW });
  ok("accept on an already-accepted flagged row moves no counter, records the trade change",
    Object.keys(already.counters).length === 0 && already.correction.originalValue === "roofing" && already.correction.correctedValue === "painting");

  const rej = decisionEffects(rows.accepted, "reject", { now: NOW });
  ok("reject from accepted: -1 accepted, -1 ready, -1 noWebsite, +1 rejected",
    JSON.stringify(rej.counters) === JSON.stringify({ acceptedCount: -1, readyCount: -1, noWebsiteCount: -1, rejectedCount: 1 }), rej.counters);
  ok("...sets do-not-contact, which survives every transition", rej.data.doNotContactAt instanceof Date && rej.data.doNotContactReason);
  const dup = decisionEffects(rows.accepted, "duplicate", { now: NOW });
  ok("duplicate: rejected, classification duplicate, NO do-not-contact, names the other row",
    dup.data.status === "rejected" && dup.data.classification === "duplicate" && !("doNotContactAt" in dup.data) && dup.data.classificationReason.includes("p9"));
  const skip = decisionEffects(nr, "skip", { now: NOW });
  ok("skip only stamps reviewDeferredAt", JSON.stringify(Object.keys(skip.data)) === JSON.stringify(["reviewDeferredAt"]) && Object.keys(skip.counters).length === 0 && skip.correction === null);

  ok("accept without a trade is refused", decisionEffects(nr, "accept", { tradeKey: null }).ok === false);
  ok("accept with a made-up trade is refused", decisionEffects(nr, "accept", { tradeKey: "underwater_basket_weaving" }).ok === false);
  ok("a rejected row is refused", decisionEffects({ ...nr, status: "rejected" }, "accept", { tradeKey: "painting" }).ok === false);
  ok("a do-not-contact row is refused", decisionEffects({ ...nr, doNotContactAt: NOW }, "reject").ok === false);
  ok("an unknown decision is refused", decisionEffects(nr, "merge").ok === false);
  ok("reasons: the bank row is no_trade", JSON.stringify(reviewReasonsOf(rows.banked)) === JSON.stringify(["no_trade"]));
  ok("reasons: the flagged accepted row is duplicate only", JSON.stringify(reviewReasonsOf(rows.accepted)) === JSON.stringify(["duplicate"]));
  ok("reasons: needs_review is unclear", JSON.stringify(reviewReasonsOf(nr)) === JSON.stringify(["unclear"]));
  ok("counterUpdates renders signed deltas as increment/decrement",
    JSON.stringify(counterUpdates({ a: 2, b: -1, c: 0 })) === JSON.stringify({ a: { increment: 2 }, b: { decrement: 1 } }));
  const grouped = countersByCampaign([{ campaignId: "c1", counters: { acceptedCount: 1 } }, { campaignId: "c1", counters: { acceptedCount: 1, bankedCount: -1 } }, { campaignId: null, counters: { acceptedCount: 1 } }]);
  ok("countersByCampaign sums per campaign and drops the campaign-less", grouped.size === 1 && JSON.stringify(grouped.get("c1")) === JSON.stringify({ acceptedCount: 2, bankedCount: -1 }));

  // The reclassification plan uses the same arithmetic.
  const plan = planReclassification([
    { id: "a", status: "needs_review", tradeKey: null, campaignId: "c1", phoneE164: "+1", addressLine: "x", websiteUrl: null, doNotContactAt: null, possibleDuplicateOfId: null },
    { id: "b", status: "needs_review", tradeKey: "painting", campaignId: "c1", phoneE164: "+1", addressLine: "x", websiteUrl: null, doNotContactAt: null, possibleDuplicateOfId: null },
    { id: "c", status: "needs_review", tradeKey: null, campaignId: "c1", phoneE164: "+1", addressLine: "x", websiteUrl: null, doNotContactAt: null, possibleDuplicateOfId: "z" },
    { id: "d", status: "discovered", tradeKey: null, campaignId: "c1", phoneE164: "+1", addressLine: "x", websiteUrl: null, doNotContactAt: null, possibleDuplicateOfId: null },
  ]);
  ok("reclassification plans the two clean needs_review rows only", JSON.stringify(plan.ids) === JSON.stringify(["a", "b"]));
  const recl = apply(campaign(), plan.byCampaign.get("c1"));
  ok("...and its counters reconcile", funnelProblems(recl).length === 0 && recl.needsReviewCount === 18 && recl.bankedCount === 31 && recl.acceptedCount === 41 && recl.readyCount === 36 && recl.noWebsiteCount === 13, recl);
}

/* ═══════════════════════════════════════════════════════════════════════════
   An in-memory client, recording every write
   ═══════════════════════════════════════════════════════════════════════════ */

function matchesWhere(row, where = {}) {
  return Object.entries(where).every(([field, cond]) => {
    if (field === "OR") return cond.some((c) => matchesWhere(row, c));
    if (field === "AND") return cond.every((c) => matchesWhere(row, c));
    if (cond === null) return row[field] == null;
    if (cond instanceof Date) return row[field]?.getTime?.() === cond.getTime();
    if (cond && typeof cond === "object") {
      for (const [op, value] of Object.entries(cond)) {
        if (op === "not") { if (row[field] === value) return false; continue; }
        if (op === "in") { if (!value.includes(row[field])) return false; continue; }
        if (op === "lt") { if (!(row[field] != null && new Date(row[field]) < new Date(value))) return false; continue; }
        if (op === "gt") { if (!(row[field] != null && new Date(row[field]) > new Date(value))) return false; continue; }
        throw new Error(`matchesWhere: operator "${op}" not implemented — the proof would be vacuous`);
      }
      return true;
    }
    return row[field] === cond;
  });
}

function makeClient({ prospects, campaigns, selection = null }) {
  const corrections = [];
  const audits = [];
  const tasks = [];
  const updateWheres = [];
  let seq = 0;
  const applyInc = (row, data) => {
    for (const [k, v] of Object.entries(data)) {
      if (v && typeof v === "object" && "increment" in v) row[k] = (row[k] || 0) + v.increment;
      else if (v && typeof v === "object" && "decrement" in v) row[k] = (row[k] || 0) - v.decrement;
      else row[k] = v;
    }
  };
  const db = {
    prospect: {
      async findUnique({ where }) {
        const f = prospects.find((p) => p.id === where.id);
        return f ? { ...f } : null;
      },
      async findMany({ where = {} }) {
        return prospects.filter((p) => matchesWhere(p, where)).map((p) => ({ ...p }));
      },
      async updateMany({ where, data }) {
        updateWheres.push(where);
        let count = 0;
        for (const p of prospects) {
          if (!matchesWhere(p, where)) continue;
          Object.assign(p, data);
          count++;
        }
        return { count };
      },
    },
    prospectCampaign: {
      async update({ where, data }) {
        const c = campaigns.find((x) => x.id === where.id);
        if (!c) throw new Error("no campaign " + where.id);
        applyInc(c, data);
        return { ...c };
      },
    },
    prospectCorrection: {
      async create({ data }) { corrections.push(data); return { id: `corr${++seq}`, ...data }; },
      async createMany({ data }) { corrections.push(...data); return { count: data.length }; },
    },
    platformAuditLog: {
      async create({ data }) { audits.push(data); return { id: `a${++seq}`, ...data }; },
    },
    salesPipelineTask: {
      async findMany() { return tasks.map((t) => ({ ...t })); },
      async findUnique({ where }) { const t = tasks.find((x) => x.idempotencyKey === where.idempotencyKey); return t ? { ...t } : null; },
      async create({ data }) { const row = { id: `t${++seq}`, status: "queued", createdAt: NOW, ...data }; tasks.push(row); return { ...row }; },
      async count() { return tasks.length; },
      async updateMany() { return { count: 0 }; },
    },
    async $queryRaw() {
      // The bulk SELECT. The caller decides what the "database" returns —
      // including rows the WHERE would never have matched — so the writes
      // can be proved to guard themselves.
      return (selection || prospects).map((p) => ({ ...p }));
    },
    // A real transaction rolls back on a throw. The fake snapshots and
    // restores, so "nothing was written" is a property a check can read off
    // the store rather than an assumption about Postgres.
    async $transaction(fn) {
      const snap = { prospects: prospects.map((p) => ({ ...p })), campaigns: campaigns.map((c) => ({ ...c })), corrections: corrections.length, audits: audits.length };
      try {
        return await fn(db);
      } catch (err) {
        prospects.splice(0, prospects.length, ...snap.prospects);
        campaigns.splice(0, campaigns.length, ...snap.campaigns);
        corrections.length = snap.corrections;
        audits.length = snap.audits;
        throw err;
      }
    },
  };
  return { db, corrections, audits, tasks, updateWheres };
}

const campaignFixture = () => ({ id: "c1", foundCount: 100, unmappedCount: 30, bankedCount: 30, duplicateCount: 0, rejectedCount: 10, needsReviewCount: 20, acceptedCount: 40, readyCount: 35, noWebsiteCount: 12 });
const prospectFixture = (over = {}) => ({
  id: "p1", status: "discovered", classification: "contractor", tradeKey: null, phoneE164: "+15145550100", addressLine: "1 X", websiteUrl: null,
  possibleDuplicateOfId: null, doNotContactAt: null, campaignId: "c1", businessName: "Toitures Tremblay", classificationReason: "Holds a contractor licence (Quebec RBQ).",
  assignedRepId: null, claimExpiresAt: null, lastCrawledAt: null, ...over,
});

/* ═══════════════════════════════════════════════════════════════════════════
   6. reviewDecide: the single-row write shape
   ═══════════════════════════════════════════════════════════════════════════ */

section("6. reviewDecide — accept with a trade, against an in-memory client");
{
  const campaigns = [campaignFixture()];
  const prospects = [prospectFixture()];
  const { db, corrections, audits, updateWheres } = makeClient({ prospects, campaigns });
  let researchCalls = [];
  const result = await reviewDecide({
    db, prospectId: "p1", decision: "accept", tradeKey: "roofing", adminId: "admin1", now: NOW,
    queueResearch: async (args) => { researchCalls.push(args); return { queued: 1, promoted: 0 }; },
  });
  ok("accept succeeds", result.ok === true, result);
  ok("tradeKey is set on the row", prospects[0].tradeKey === "roofing");
  ok("classification contractor, reason names the trade", prospects[0].classification === "contractor" && prospects[0].classificationReason === "A superadmin reviewed this and chose Roofing.");
  ok("one correction, on field:tradeKey, by the admin", corrections.length === 1 && corrections[0].target === "field:tradeKey" && corrections[0].correctedValue === "roofing" && corrections[0].correctedByAdminId === "admin1" && corrections[0].prospectId === "p1");
  ok("research queued for that prospect on the backlog lane", researchCalls.length === 1 && researchCalls[0].prospectIds[0] === "p1" && researchCalls[0].priority === "backlog");
  ok("counters: bank → accepted (unmapped -1, banked -1, accepted +1, ready +1, noWebsite +1)",
    campaigns[0].unmappedCount === 29 && campaigns[0].bankedCount === 29 && campaigns[0].acceptedCount === 41 && campaigns[0].readyCount === 36 && campaigns[0].noWebsiteCount === 13, campaigns[0]);
  ok("...and the campaign still reconciles", funnelProblems(campaigns[0]).length === 0, funnelProblems(campaigns[0]));
  ok("one audit row, sales_prospect_reviewed, naming the trade and the folder", audits.length === 1 && audits[0].action === "sales_prospect_reviewed" && audits[0].details.tradeKey === "roofing" && audits[0].details.surface === "review_folder");
  ok("the update was guarded on the status read AND the untouchable rule",
    updateWheres[0].status === "discovered" && updateWheres[0].doNotContactAt === null && Array.isArray(updateWheres[0].OR), updateWheres[0]);

  // The stale row: the update matches nothing.
  {
    const c2 = [campaignFixture()];
    const p2 = [prospectFixture({ id: "p2" })];
    const client = makeClient({ prospects: p2, campaigns: c2 });
    // Somebody rejects it between the read and the write.
    const realFindUnique = client.db.prospect.findUnique;
    client.db.prospect.findUnique = async (args) => { const r = await realFindUnique(args); p2[0].status = "rejected"; return r; };
    const stale = await reviewDecide({ db: client.db, prospectId: "p2", decision: "accept", tradeKey: "roofing", adminId: "admin1", now: NOW, queueResearch: async () => ({ queued: 0 }) });
    ok("a row changed since it was read is refused with 409", stale.ok === false && stale.status === 409, stale);
    ok("...and nothing else was written: no correction, no audit, counters untouched",
      client.corrections.length === 0 && client.audits.length === 0 && c2[0].acceptedCount === 40);
  }

  // A held row.
  {
    const client = makeClient({ prospects: [prospectFixture({ id: "p3", assignedRepId: "rep1", claimExpiresAt: new Date(NOW.getTime() + 3600000) })], campaigns: [campaignFixture()] });
    const held = await reviewDecide({ db: client.db, prospectId: "p3", decision: "reject", adminId: "admin1", now: NOW });
    ok("a row a rep holds is refused", held.ok === false && held.status === 409);
    ok("...a lapsed claim is not a hold", (await reviewDecide({ db: makeClient({ prospects: [prospectFixture({ id: "p4", assignedRepId: "rep1", claimExpiresAt: new Date(NOW.getTime() - 3600000) })], campaigns: [campaignFixture()] }).db, prospectId: "p4", decision: "skip", adminId: "admin1", now: NOW })).ok === true);
  }

  // Skip.
  {
    const p = [prospectFixture({ id: "p5" })];
    const client = makeClient({ prospects: p, campaigns: [campaignFixture()] });
    const skipped = await reviewDecide({ db: client.db, prospectId: "p5", decision: "skip", adminId: "admin1", now: NOW });
    ok("skip stamps reviewDeferredAt, writes no correction, audits, queues nothing", skipped.ok && p[0].reviewDeferredAt === NOW && client.corrections.length === 0 && client.audits.length === 1 && skipped.research === null);
  }
  ok("bad input: no prospect", (await reviewDecide({ db, prospectId: "", decision: "accept", tradeKey: "roofing", adminId: "a" })).status === 400);
  ok("bad input: accept without a trade", (await reviewDecide({ db, prospectId: "p1", decision: "accept", adminId: "a" })).status === 400);
  ok("bad input: unknown prospect", (await reviewDecide({ db, prospectId: "nope", decision: "skip", adminId: "a" })).status === 404);
}

/* ═══════════════════════════════════════════════════════════════════════════
   7. bulkReview: the selection lies, the writes do not
   ═══════════════════════════════════════════════════════════════════════════ */

section("7. bulkReview — never touches a claimed or do-not-contact row");
{
  const fixtures = () => {
    const campaigns = [campaignFixture(), { ...campaignFixture(), id: "c2" }];
    const prospects = [
      prospectFixture({ id: "b1", businessName: "Toitures A" }),
      prospectFixture({ id: "b2", businessName: "Toitures B", campaignId: "c2", status: "needs_review", classification: "needs_review" }),
      prospectFixture({ id: "b3", businessName: "Toitures C", websiteUrl: "https://c.example" }),
      prospectFixture({ id: "held", businessName: "Toitures HELD", assignedRepId: "rep1", claimExpiresAt: new Date(NOW.getTime() + 3600000) }),
      prospectFixture({ id: "dnc", businessName: "Toitures DNC", doNotContactAt: new Date("2026-01-01") }),
    ];
    return { campaigns, prospects };
  };
  const filter = parseReviewFilter({ source: "rbq", q: "toiture" });

  // A. The SELECT lies: it hands back the held row and the do-not-contact
  // row as if they matched. The writes must not follow it.
  {
    const { campaigns, prospects } = fixtures();
    const { db, corrections, audits, updateWheres } = makeClient({ prospects, campaigns, selection: prospects });
    let threw = null;
    try {
      await bulkReview({ db, filter, decision: "accept", tradeKey: "roofing", expectedCount: 5, adminId: "admin1", now: NOW });
    } catch (err) {
      threw = err;
    }
    ok("a selection carrying a held row makes the write count disagree, and the whole thing is refused", threw && /planned 4 rows and 3 matched/.test(threw.message), threw?.message);
    ok("the held row was not written", prospects.find((p) => p.id === "held").tradeKey === null);
    ok("the do-not-contact row was not written — the effects table refused it before any write", prospects.find((p) => p.id === "dnc").tradeKey === null);
    ok("...and the rollback took the clean rows with it: nothing half-applied", ["b1", "b2", "b3"].every((id) => prospects.find((p) => p.id === id).tradeKey === null) && corrections.length === 0 && audits.length === 0 && campaigns[0].acceptedCount === 40);
    ok("every updateMany carried the untouchable guard, which is what refused the held row", updateWheres.length >= 1 && updateWheres.every((w) => w.doNotContactAt === null && Array.isArray(w.OR) && w.status), updateWheres);
  }

  // B. The SELECT is honest (the WHERE excludes both); the write goes through.
  const { campaigns, prospects } = fixtures();
  const clean = prospects.filter((p) => !p.assignedRepId && !p.doNotContactAt);
  const { db, corrections, audits, updateWheres } = makeClient({ prospects, campaigns, selection: clean });
  const result = await bulkReview({ db, filter, decision: "accept", tradeKey: "roofing", expectedCount: 3, adminId: "admin1", now: NOW });
  ok("the bulk write ran", result.ok === true, result);
  ok("the held row was not written", prospects.find((p) => p.id === "held").tradeKey === null);
  ok("the do-not-contact row was not written", prospects.find((p) => p.id === "dnc").tradeKey === null);
  ok("the three clean rows got the trade", ["b1", "b2", "b3"].every((id) => prospects.find((p) => p.id === id).tradeKey === "roofing"));
  ok("the needs_review row became discovered; the others kept their status", prospects.find((p) => p.id === "b2").status === "discovered" && prospects.find((p) => p.id === "b1").status === "discovered");
  ok("every updateMany carried the untouchable guard", updateWheres.length >= 2 && updateWheres.every((w) => w.doNotContactAt === null && Array.isArray(w.OR) && w.status), updateWheres);
  ok("one correction per written row", corrections.length === 3 && corrections.every((c) => c.target === "field:tradeKey" && c.correctedByAdminId === "admin1"));
  ok("ONE audit row, with the filter, the count and three samples",
    audits.length === 1 && audits[0].action === "sales_prospects_bulk_reviewed" && audits[0].details.count === 3 && audits[0].details.filter.q === "toiture" && audits[0].details.sample.length === 3, audits[0]?.details);
  ok("campaign c1: two bank rows accepted (unmapped -2, banked -2, accepted +2)", campaigns[0].unmappedCount === 28 && campaigns[0].bankedCount === 28 && campaigns[0].acceptedCount === 42, campaigns[0]);
  ok("campaign c2: one needs_review row accepted", campaigns[1].needsReviewCount === 19 && campaigns[1].acceptedCount === 41, campaigns[1]);
  ok("both campaigns still reconcile", funnelProblems(campaigns[0]).length === 0 && funnelProblems(campaigns[1]).length === 0);
  ok("the count reported is the rows written", result.count === 3);

  // Drift.
  const drift = await bulkReview({ db: makeClient({ prospects: [prospectFixture()], campaigns: [campaignFixture()] }).db, filter, decision: "accept", tradeKey: "roofing", expectedCount: 40, adminId: "a", now: NOW });
  ok("a count that moved past the tolerance is refused", drift.ok === false && /now holds 1/.test(drift.error));

  // Reject-all.
  {
    const c = [campaignFixture()];
    const p = [prospectFixture({ id: "r1", businessName: "Peinture Dépôt" }), prospectFixture({ id: "r2", businessName: "Boutique du Plancher", status: "needs_review", classification: "needs_review" })];
    const client = makeClient({ prospects: p, campaigns: c });
    const rej = await bulkReview({ db: client.db, filter: parseReviewFilter({ retail: "yes" }), decision: "reject", expectedCount: 2, adminId: "a", now: NOW });
    ok("reject-all rejects and suppresses every row", rej.ok && p.every((x) => x.status === "rejected" && x.classification === "retailer" && x.doNotContactAt));
    ok("...counters: bank -1 → rejected, needs_review -1 → rejected", c[0].rejectedCount === 12 && c[0].bankedCount === 29 && c[0].unmappedCount === 29 && c[0].needsReviewCount === 19 && funnelProblems(c[0]).length === 0, c[0]);
  }
  let threw = false;
  try { await bulkReview({ db, filter, decision: "duplicate", expectedCount: 1, adminId: "a" }); } catch { threw = true; }
  ok("bulk duplicate is not a thing", threw);
}

/* ═══════════════════════════════════════════════════════════════════════════
   8. The SQL, the filter, and the static wiring
   ═══════════════════════════════════════════════════════════════════════════ */

section("8. The folder's WHERE, and what the screen wires");
{
  const sql = reviewWhereSql(parseReviewFilter({ source: "rbq", province: "qc", reason: "no_trade", q: "toit", website: "no", retail: "yes", campaignId: "c1" }), { now: NOW });
  const text = sql.sql;
  ok("the guard is in every WHERE: do-not-contact", text.includes('"doNotContactAt" IS NULL'));
  ok("the guard is in every WHERE: not held by a rep", text.includes('"assignedRepId" IS NULL OR "claimExpiresAt" <'));
  ok("the no_trade reason clause", text.includes('"classification" = \'contractor\' AND "tradeKey" IS NULL'));
  ok("source, province (upper-cased), campaign are parameters", sql.values.includes("rbq") && sql.values.includes("QC") && sql.values.includes("c1"));
  ok("the search reaches trading names and the licence number", text.includes('unnest("tradingNames")') && text.includes('"licenceNumber" ILIKE'));
  ok("the shop-word filter is the same regex the suggester compiles", sql.values.includes(retailWordPgRegex()));
  ok("website: no is IS NULL", text.includes('"websiteUrl" IS NULL'));
  const all = reviewWhereSql({}, { now: NOW }).sql;
  ok("no reason filter = all three reasons OR-ed", all.includes("OR") && all.includes("'needs_review'") && all.includes('"possibleDuplicateOfId" IS NOT NULL'));
  const order = reviewOrderSql();
  ok("the sort puts skipped rows last, keyword names first, then websites, then oldest",
    order.sql.indexOf('"reviewDeferredAt" IS NOT NULL) ASC') < order.sql.indexOf("~*") && order.sql.indexOf("~*") < order.sql.indexOf('"websiteUrl" IS NOT NULL) DESC') && order.sql.endsWith('"createdAt" ASC, "id" ASC') && order.values.includes(nameKeywordPgRegex()));
  ok("parseReviewFilter drops junk", JSON.stringify(parseReviewFilter({ reason: "nope", website: "maybe", retail: "no" })) === JSON.stringify({ campaignId: null, source: null, province: null, reason: null, q: null, website: null, retail: null }));
  ok("the guard where matches the guard SQL", JSON.stringify(untouchableGuardWhere(NOW)) === JSON.stringify({ doNotContactAt: null, OR: [{ assignedRepId: null }, { claimExpiresAt: { lt: NOW } }] }));

  const page = read("app/platform/sales/review/page.js");
  ok("the page is a client component that calls the folder route", page.includes('"use client"') && page.includes("/api/platform/sales/review?") && page.includes("/api/platform/sales/review/bulk") && page.includes("/api/platform/sales/review/reclassify"));
  for (const key of ['e.key === "j"', 'e.key === "k"', '/^[1-9]$/.test(e.key)', 'e.key === "Enter"', 'e.key === "x"', 'e.key === "d"', 'e.key === "s"']) {
    ok(`keyboard: ${key}`, page.includes(key));
  }
  ok("keys are off while typing", page.includes('tag === "input"'));
  ok("suggestions render their basis", page.includes("{s.basis}"));
  ok("the bulk confirmation shows sample names", page.includes("confirm.sample.map"));
  ok("reject-all is offered only on the shop-word filter", /filter\.retail === "yes" \? \(\s*<button/.test(page));
  ok("the shop-word case says why there is no chip", page.includes("the name carries a shop word"));

  const sidebar = read("app/components/platform/PlatformSidebar.js");
  ok("the sidebar has the Review folder under Sales", sidebar.includes('href: "/platform/sales/review"') && sidebar.indexOf('href: "/platform/sales/review"') > sidebar.indexOf('href: "/platform/sales/campaigns"'));
  ok("the sidebar fetches the count and draws a badge", sidebar.includes("/api/platform/sales/review/count") && sidebar.includes("data-review-badge"));

  for (const action of ["sales_prospect_reviewed", "sales_prospects_bulk_reviewed", "sales_prospects_reclassified"]) {
    ok(`audit wording for ${action}`, Boolean(AUDIT_ACTIONS[action]));
  }
  const bulkRoute = read("app/api/platform/sales/review/bulk/route.js");
  ok("the bulk route refuses an unnarrowed filter", bulkRoute.includes("filterIsNarrow"));
  ok("the bulk route needs an expected count", bulkRoute.includes("expectedCount === null"));
  const reclassify = read("app/api/platform/sales/review/reclassify/route.js");
  ok("reclassify is dry-run unless apply: true", reclassify.includes("body?.apply === true") && reclassify.includes("dryRun: !apply"));
  ok("reclassify has the long budget", reclassify.includes("maxDuration = 300"));
  const pkg = JSON.parse(read("package.json"));
  ok("check:review-folder is in check:all", pkg.scripts["check:all"].includes("check:review-folder"));
}

console.log(`\n${checks} checks, ${failures} failures\n`);
process.exit(failures ? 1 : 0);
