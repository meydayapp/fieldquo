// scripts/check-kitchen-access.mjs
//
//   node --import ./scripts/alias-loader.mjs scripts/check-kitchen-access.mjs
//
// ── What this is guarding ───────────────────────────────────────────────────
//
// The owner's report, 2026-08-30: "the kitchen design seems to be a permanent
// button instead of a service that can be offered and seems to be default
// along with countertop, stairs and even when explicitly did not select
// them. New kitchen installs can be done by few types of contractors not
// just kitchen refinishers, and not all kitchen cabinet refinishers do
// them."
//
// The Kitchen Designer button (app/app/quotes/[id]/page.js), its save
// endpoint (app/api/quotes/[id]/kitchen/route.js), the internal designer page
// itself (app/app/quotes/[id]/kitchen/page.js) and the public "design your
// kitchen" page + lead endpoint (app/quote/[companySlug]/kitchen/page.js,
// app/api/self-quote/kitchen/route.js) used to each carry their own copy of
// `/cabinet|kitchen|countertop|remodel/.test(category.key)` — testing what a
// QUOTE happened to have on it, never what the COMPANY had turned on. A
// company selling only countertops matched "countertop" and got the Kitchen
// Designer on every countertop quote it never asked for; a general
// contractor who genuinely builds new kitchens had no key in the regex that
// would ever fire for them, so there was no way to turn it ON either.
//
// lib/kitchen/access.js replaced all of that with one pure gate
// (canUseKitchenDesignerPure) plus one DB-backed wrapper for the four route
// call sites. This file executes the pure gate against hostile input and
// against the owner's own reported scenario, and checks the catalogue and
// the route source for the specific regressions this bug already was.
import fs from "node:fs";
import path from "node:path";
import { rows, resetDbStub } from "./fixtures/dbStub.mjs";
import {
  KITCHEN_DESIGN_KEY,
  KITCHEN_GROUP_LABEL,
  KITCHEN_GRANTING_TRADE_KEYS,
  hasKitchenData,
  canUseKitchenDesignerPure,
  canUseKitchenDesigner,
  companyOffersKitchenDesign,
  kitchenDesignerOnPure,
  kitchenGrantingKeys,
  kitchenCategoryRow,
} from "@/lib/kitchen/access";
import { TRADE_CATALOG, tradeKeys } from "@/lib/trades/catalog";

let failures = 0;
function ok(label, cond, detail) {
  if (cond) {
    console.log(`  ✓ ${label}`);
  } else {
    failures++;
    console.log(`  ✗ ${label}${detail !== undefined ? `\n      ${JSON.stringify(detail)}` : ""}`);
  }
}
function section(title) {
  console.log(`\n${title}`);
}

/* ══ 1. kitchen_design is a real, independent catalogue trade ══════════════ */

section("kitchen_design is its own trade, not a copy of another one");

ok("the catalogue carries the key", Boolean(TRADE_CATALOG[KITCHEN_DESIGN_KEY]));
ok("it has a non-empty label distinct from refinishing/refacing",
  TRADE_CATALOG[KITCHEN_DESIGN_KEY]?.label &&
    !/refinish|reface/i.test(TRADE_CATALOG[KITCHEN_DESIGN_KEY].label));
ok("it carries no instantTrade — it's the interactive designer, not a $/sqft estimate",
  TRADE_CATALOG[KITCHEN_DESIGN_KEY]?.instantTrade === undefined);
ok("its sortOrder doesn't collide with any other trade",
  tradeKeys().filter((k) => TRADE_CATALOG[k].sortOrder === TRADE_CATALOG[KITCHEN_DESIGN_KEY].sortOrder).length === 1);

/* ══ 2. The owner's exact scenario ═══════════════════════════════════════ */
//
// A cabinet-refinishing and painting company: countertop is enabled,
// cabinet_refinishing is enabled, kitchen_design was never touched. Before
// this fix, EVERY quote with a countertop scope group got a "Kitchen
// Designer" button and a working route underneath it. After it, neither
// countertop nor cabinet_refinishing being enabled is sufficient — only
// kitchen_design, or a quote that already has a design, opens it.

section("The owner's account: countertop and refinishing on, kitchen_design never touched");

const hisEnabledKeys = ["countertop", "cabinet_refinishing", "exterior_painting"];

const countertopQuote = {
  quoteType: null,
  scopeDetails: null,
  clientKitchenConfig: null,
  scopeGroups: [{ label: "Countertop", category: { key: "countertop" } }],
};
ok("a countertop-only quote does NOT get the Kitchen Designer",
  canUseKitchenDesignerPure(countertopQuote, hisEnabledKeys) === false);

const refinishingQuote = {
  quoteType: null,
  scopeDetails: null,
  clientKitchenConfig: null,
  scopeGroups: [{ label: "Cabinet Refinishing", category: { key: "cabinet_refinishing" } }],
};
ok("a plain refinishing quote does NOT get the Kitchen Designer either — not every refinisher installs kitchens",
  canUseKitchenDesignerPure(refinishingQuote, hisEnabledKeys) === false);

const remodelQuote = {
  scopeGroups: [{ label: "Remodel", category: { key: "remodeling" } }],
};
ok("a remodeling quote does NOT get it — the old regex matched \"remodel\", this gate doesn't care",
  canUseKitchenDesignerPure(remodelQuote, hisEnabledKeys) === false);

/* ══ 3. The other direction: it opens for who it should ════════════════════ */

section("Turning kitchen_design on opens it for ANY quote, cabinetry or not");

const enabledWithKitchen = [...hisEnabledKeys, KITCHEN_DESIGN_KEY];
ok("a fresh, empty quote opens it once the company has opted in",
  canUseKitchenDesignerPure({ scopeGroups: [] }, enabledWithKitchen) === true);

// The general contractor the owner named: no cabinet/refinishing/countertop
// category enabled at all, kitchen_design is the ONLY thing on.
ok("a general contractor with ONLY kitchen_design enabled gets it — the whole point",
  canUseKitchenDesignerPure({ scopeGroups: [] }, [KITCHEN_DESIGN_KEY]) === true);

/* ══ 4. Existing work is never taken away ═══════════════════════════════════ */
//
// "A company that already has kitchen/countertop/stair data must not lose
// access to it." — the task's own words. A company that turns kitchen_design
// back OFF (or never had it on, because the design predates this key) keeps
// every design it already drew.

section("A company that already has a design keeps it, service on or off");

const savedByQuoteType = { quoteType: "kitchen", scopeGroups: [] };
const savedByScopeDetails = { scopeDetails: { serviceType: "kitchen" }, scopeGroups: [] };
const savedByClientEdit = { clientKitchenConfig: { room: {} }, scopeGroups: [] };
const savedByGroupLabel = { scopeGroups: [{ label: KITCHEN_GROUP_LABEL, category: { key: "cabinet_refinishing" } }] };

for (const [label, quote] of [
  ["quote.quoteType === 'kitchen'", savedByQuoteType],
  ["quote.scopeDetails.serviceType === 'kitchen'", savedByScopeDetails],
  ["quote.clientKitchenConfig present (client's own edit)", savedByClientEdit],
  [`a scope group labelled "${KITCHEN_GROUP_LABEL}"`, savedByGroupLabel],
]) {
  ok(`${label}: hasKitchenData is true`, hasKitchenData(quote) === true);
  ok(`${label}: opens the designer even with NO services enabled at all`,
    canUseKitchenDesignerPure(quote, []) === true);
}

ok("an ordinary quote with none of the four signals has no data to protect",
  hasKitchenData({ scopeGroups: [{ label: "Flooring", category: { key: "flooring" } }] }) === false);

/* ══ 5. Hostile input ════════════════════════════════════════════════════ */

section("Hostile input");

ok("no quote at all -> false, not a throw", hasKitchenData(null) === false && hasKitchenData(undefined) === false);
ok("a quote that isn't an object -> false", hasKitchenData("kitchen") === false && hasKitchenData(42) === false);
ok("scopeGroups isn't an array -> false, not a throw",
  hasKitchenData({ scopeGroups: "not an array" }) === false);
ok("a null entry inside scopeGroups doesn't throw",
  hasKitchenData({ scopeGroups: [null, undefined, { label: KITCHEN_GROUP_LABEL }] }) === true);
ok("enabledCategoryKeys isn't an array -> treated as empty, not a throw",
  canUseKitchenDesignerPure({ scopeGroups: [] }, "kitchen_design") === false);
ok("enabledCategoryKeys is null -> treated as empty",
  canUseKitchenDesignerPure({ scopeGroups: [] }, null) === false);
ok("a company with every NON-granting trade enabled still gets nothing on a bare quote",
  canUseKitchenDesignerPure({ scopeGroups: [] }, tradeKeys().filter((k) => !KITCHEN_GRANTING_TRADE_KEYS.includes(k))) === false);

/* ══ 6. The regex is actually gone, not just unused ═════════════════════════ */
//
// Executed rather than read: strip comments, then grep the four files that
// used to carry the broken pattern for the exact broken pattern. A helper
// existing in lib/kitchen/access.js proves nothing if one of the old call
// sites still has its own copy sitting beside it, unused by luck rather than
// by removal.

section("The broken regex isn't hiding in the files it used to break");

function stripComments(src) {
  // Block comments, then line comments — good enough for this codebase's own
  // style (AGENTS.md: "strip comments before any regex over source").
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

const OLD_PATTERN = /cabinet\|kitchen\|countertop\|remodel/;

// The button's page had NO legitimate reason to keep the regex at all — it
// only ever decided whether to show a link, and that's now the server's
// answer (quote.canOpenKitchenDesigner), not a client-side re-derivation.
const buttonPageSrc = stripComments(
  fs.readFileSync(new URL("../app/app/quotes/[id]/page.js", import.meta.url), "utf8"),
);
ok("app/app/quotes/[id]/page.js: no longer tests a quote's own categories against the old broad regex",
  !OLD_PATTERN.test(buttonPageSrc));

// The two routes used to each carry a copy of the "cabinet-ish" regex as a
// FILING fallback (which category an allowed design lands under). Since
// 2026-09-25 that lives once, in kitchenCategoryRow (lib/kitchen/access.js),
// so the routes carry no regex at all — and the real assertion stays
// ordering: the access check runs and can refuse BEFORE filing is reached.
const LIVE_REGEX = OLD_PATTERN.source.replace(/\\\|/g, "|");
const kitchenRouteSrc = stripComments(
  fs.readFileSync(new URL("../app/api/quotes/[id]/kitchen/route.js", import.meta.url), "utf8"),
);
ok("the save route checks canUseKitchenDesigner before doing anything else",
  /canUseKitchenDesigner\(/.test(kitchenRouteSrc));
ok("…files through the shared kitchenCategoryRow, with no regex copy of its own",
  kitchenRouteSrc.includes("kitchenCategoryRow(") && !kitchenRouteSrc.includes(LIVE_REGEX));
ok("…and the access check runs BEFORE filing",
  kitchenRouteSrc.indexOf("canUseKitchenDesigner(") < kitchenRouteSrc.indexOf("kitchenCategoryRow("));

const selfQuoteKitchenSrc = stripComments(
  fs.readFileSync(new URL("../app/api/self-quote/kitchen/route.js", import.meta.url), "utf8"),
);
ok("the public lead endpoint refuses through the gate before it files the lead",
  selfQuoteKitchenSrc.includes("companyOffersKitchenDesign(") &&
    selfQuoteKitchenSrc.indexOf("companyOffersKitchenDesign(") < selfQuoteKitchenSrc.indexOf("kitchenCategoryRow("));
ok("…with no regex copy of its own", !selfQuoteKitchenSrc.includes(LIVE_REGEX));
ok("the internal designer PAGE also checks it server-side, not just the button that links to it",
  stripComments(
    fs.readFileSync(new URL("../app/app/quotes/[id]/kitchen/page.js", import.meta.url), "utf8"),
  ).includes("canUseKitchenDesigner("));
ok("the public design-your-kitchen page checks companyOffersKitchenDesign before rendering",
  stripComments(
    fs.readFileSync(new URL("../app/quote/[companySlug]/kitchen/page.js", import.meta.url), "utf8"),
  ).includes("companyOffersKitchenDesign("));
ok("the public lead endpoint checks it too — a browser can POST here without ever loading the page above",
  /companyOffersKitchenDesign\(company\.id\)/.test(selfQuoteKitchenSrc));

/* ══ 7. The owner's 2026-09-25 decision: which trades grant it ═════════════ */
//
// "Those that have enabled kitchen remodel or construction should have access
// to the kitchen designer — construction trades, remodeling, renovation —
// maybe handyman if they enable that — and kitchen refacing could also do
// it." There is no separate kitchen-remodel key: kitchen remodelling is a
// service inside remodeling and general contracting.

section("2026-09-25: every kitchen-building trade grants it on its own");

const EXPECTED_GRANTING = [
  "kitchen_design", "remodeling", "general_contracting_reno",
  "general_contracting", "construction", "cabinet_refacing",
];
ok("the granting list is exactly the owner's list, nothing slipped in or out",
  JSON.stringify([...KITCHEN_GRANTING_TRADE_KEYS].sort()) === JSON.stringify([...EXPECTED_GRANTING].sort()),
  KITCHEN_GRANTING_TRADE_KEYS);
ok("the list is frozen — no caller can push a trade into it at runtime",
  Object.isFrozen(KITCHEN_GRANTING_TRADE_KEYS));
for (const key of KITCHEN_GRANTING_TRADE_KEYS) {
  ok(`${key} is a real catalogue trade (a typo here would grant nothing, silently)`, Boolean(TRADE_CATALOG[key]));
  ok(`${key} alone → on, on a bare quote`, canUseKitchenDesignerPure({ scopeGroups: [] }, [key]) === true);
  ok(`${key} alone, override null → on`, kitchenDesignerOnPure([key], null) === true);
}

section("…and the 08-30 trades still do NOT");

for (const key of ["cabinet_refinishing", "countertop", "stairs", "interior_painting", "exterior_painting"]) {
  ok(`${key} is a real catalogue trade`, Boolean(TRADE_CATALOG[key]));
  ok(`${key} alone → off`, kitchenDesignerOnPure([key], null) === false);
}
ok("refinishing + countertop + stairs + both paintings together → still off",
  kitchenDesignerOnPure(["cabinet_refinishing", "countertop", "stairs", "interior_painting", "exterior_painting"], null) === false);
ok("the owner's 08-30 account (countertop, refinishing, exterior painting) → still off",
  kitchenDesignerOnPure(hisEnabledKeys, null) === false &&
    canUseKitchenDesignerPure(countertopQuote, hisEnabledKeys, null) === false);
ok("…and the same account the day it adds cabinet_refacing → on",
  kitchenDesignerOnPure([...hisEnabledKeys, "cabinet_refacing"], null) === true);

section("Handyman: not automatic, but reachable");

ok("handyman is a real catalogue trade", Boolean(TRADE_CATALOG.handyman));
ok("handyman alone → off", kitchenDesignerOnPure(["handyman"], null) === false);
ok("handyman + its preset neighbours (appliance repair, installation, property maintenance) → off",
  kitchenDesignerOnPure(["handyman", "appliance_repair", "installation_services", "property_maintenance"], null) === false);
ok("handyman + kitchen_design ticked → on", kitchenDesignerOnPure(["handyman", KITCHEN_DESIGN_KEY], null) === true);
ok("handyman + override on → on", kitchenDesignerOnPure(["handyman"], true) === true);
// The toggle a handyman needs must not be auto-enabled by its industry
// preset — that would make it automatic by the back door. It stays out of
// every preset and Settings › Services' Kitchen Designer card reveals it.
ok("kitchen_design belongs to no industry preset (so no signup auto-ticks it for a handyman)",
  Array.isArray(TRADE_CATALOG[KITCHEN_DESIGN_KEY].industries) && TRADE_CATALOG[KITCHEN_DESIGN_KEY].industries.length === 0);
const editorSrc = fs.readFileSync(new URL("../app/app/settings/services/ServicesEditor.js", import.meta.url), "utf8");
const cardSrc = fs.readFileSync(new URL("../app/app/settings/services/KitchenDesignerCard.js", import.meta.url), "utf8");
ok("Settings › Services renders the Kitchen Designer card", /<KitchenDesignerCard[\s\S]*?\/>/.test(editorSrc));
ok("…whose find button shows other trades and scrolls to the kitchen_design row",
  /setShowAllTrades\(true\)/.test(editorSrc) && /service-\$\{KITCHEN_DESIGN_KEY\}/.test(editorSrc) && /id=\{`service-\$\{c\.key\}`\}/.test(editorSrc));
ok("…and the card offers it whenever kitchen_design isn't ticked, with the handyman line",
  /!kitchenDesignTicked && \(/.test(cardSrc) && /k\("handyman"\)/.test(cardSrc) && /onClick=\{onFindKitchenDesign\}/.test(cardSrc));

/* ══ 8. The company override ══════════════════════════════════════════════ */

section("Override: false beats a granting trade, true works for any trade");

for (const key of KITCHEN_GRANTING_TRADE_KEYS) {
  ok(`${key} + override false → off`, kitchenDesignerOnPure([key], false) === false);
}
ok("every granting trade at once + override false → off",
  kitchenDesignerOnPure([...KITCHEN_GRANTING_TRADE_KEYS], false) === false);
ok("override true on EVERY catalogue trade alone → on",
  tradeKeys().every((key) => kitchenDesignerOnPure([key], true) === true),
  tradeKeys().filter((key) => kitchenDesignerOnPure([key], true) !== true));
ok("override true with no trades at all → on", kitchenDesignerOnPure([], true) === true);
ok("override null follows the trades both ways",
  kitchenDesignerOnPure(["remodeling"], null) === true && kitchenDesignerOnPure(["painting"], null) === false);
ok("override undefined follows the trades (a row read before the column existed)",
  kitchenDesignerOnPure(["remodeling"], undefined) === true && kitchenDesignerOnPure([], undefined) === false);
// Only a real boolean is the company speaking.
for (const junk of ["false", "true", 0, 1, "", "off", {}, []]) {
  ok(`override ${JSON.stringify(junk)} is not a boolean → follows the trades`,
    kitchenDesignerOnPure(["remodeling"], junk) === true && kitchenDesignerOnPure(["countertop"], junk) === false);
}
ok("override false does NOT lock a quote that already has a design — existing work is never taken away",
  canUseKitchenDesignerPure(savedByQuoteType, [...KITCHEN_GRANTING_TRADE_KEYS], false) === true &&
    canUseKitchenDesignerPure(savedByClientEdit, [], false) === true);
ok("override false DOES refuse a fresh quote on a remodeler",
  canUseKitchenDesignerPure({ scopeGroups: [] }, ["remodeling"], false) === false);

section("kitchenGrantingKeys and hostile input to the new rule");

ok("kitchenGrantingKeys returns grant order, not the company's order",
  JSON.stringify(kitchenGrantingKeys(["cabinet_refacing", "handyman", "remodeling", KITCHEN_DESIGN_KEY])) ===
    JSON.stringify([KITCHEN_DESIGN_KEY, "remodeling", "cabinet_refacing"]));
ok("kitchenGrantingKeys(null / a string / an object) → []",
  kitchenGrantingKeys(null).length === 0 && kitchenGrantingKeys("remodeling").length === 0 && kitchenGrantingKeys({ remodeling: true }).length === 0);
ok("kitchenDesignerOnPure('remodeling' as a string, null) → off, not a substring match",
  kitchenDesignerOnPure("remodeling", null) === false);
ok("a near-miss key does not grant (remodeling_x, general_contracting_other, Remodeling)",
  kitchenDesignerOnPure(["remodeling_x", "general_contracting_other", "Remodeling", " construction"], null) === false);

/* ══ 9. Filing: which category an allowed design lands under ═══════════════ */

section("kitchenCategoryRow — the one filing helper both routes use");

const row = (key, id = `id_${key}`) => ({ category: { id, key } });
ok("kitchen_design wins over every other enabled trade",
  kitchenCategoryRow([row("cabinet_refacing"), row("remodeling"), row(KITCHEN_DESIGN_KEY)])?.category.key === KITCHEN_DESIGN_KEY);
ok("without it, the first granting trade in grant order (remodeling before refacing)",
  kitchenCategoryRow([row("cabinet_refacing"), row("remodeling")])?.category.key === "remodeling");
ok("with no granting trade, the cabinetry-ish fallback (a quote that already carries a design)",
  kitchenCategoryRow([row("flooring"), row("cabinet_refinishing")])?.category.key === "cabinet_refinishing");
ok("nothing kitchen-ish at all → null (the lead lands uncategorised, never under unrelated work)",
  kitchenCategoryRow([row("handyman"), row("plumbing")]) === null);
ok("hostile rows: null list, null entries, missing category → no throw",
  kitchenCategoryRow(null) === null &&
    kitchenCategoryRow([null, {}, { category: null }, row("remodeling")])?.category.key === "remodeling");

/* ══ 10. The DB wrapper reads the override — executed against a stub ══════ */

section("companyOffersKitchenDesign reads the trades AND the override");

const CO = "co_kitchen";
function company({ keys = [], override = null } = {}) {
  resetDbStub();
  rows.company = [{ id: CO, kitchenDesignerOverride: override }];
  rows.companyServiceCategory = keys.map((key) => ({ companyId: CO, enabled: true, rates: null, category: { key } }));
}
company({ keys: ["remodeling"] });
ok("remodeler, never touched the setting → on", (await companyOffersKitchenDesign(CO)) === true);
company({ keys: ["remodeling"], override: false });
ok("remodeler who switched it off → off", (await companyOffersKitchenDesign(CO)) === false);
ok("…a fresh quote is refused", (await canUseKitchenDesigner({ scopeGroups: [] }, CO)) === false);
ok("…a quote that already carries a design still opens", (await canUseKitchenDesigner(savedByScopeDetails, CO)) === true);
company({ keys: ["handyman"] });
ok("handyman, never touched it → off", (await companyOffersKitchenDesign(CO)) === false);
company({ keys: ["handyman"], override: true });
ok("handyman who switched it on → on", (await companyOffersKitchenDesign(CO)) === true);
company({ keys: ["handyman", KITCHEN_DESIGN_KEY] });
ok("handyman who ticked Kitchen Design & New Installs → on", (await companyOffersKitchenDesign(CO)) === true);
company({ keys: hisEnabledKeys });
ok("the owner's 08-30 account through the DB wrapper → still off", (await companyOffersKitchenDesign(CO)) === false);
resetDbStub();
rows.company = [];
rows.companyServiceCategory = [{ companyId: CO, enabled: true, rates: null, category: { key: "remodeling" } }];
ok("a company row that can't be read → follows the trades, doesn't throw", (await companyOffersKitchenDesign(CO)) === true);
ok("no companyId → off, no query", (await companyOffersKitchenDesign(null)) === false);

/* ══ 11. Nothing else decides it ══════════════════════════════════════════ */
//
// "Every call site goes through the gate." Swept, not listed: every file
// under app/ and lib/ that names the service key or the override column is
// found here, and each must be on this list with its reason. A new file
// that starts deciding kitchen visibility on its own fails this until
// someone either routes it through the gate or writes down why not.

section("No second answer: every reader of the key or the override is accounted for");

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "node_modules" || ent.name.startsWith(".")) continue;
      walk(p, out);
    } else if (/\.(m?js|jsx)$/.test(ent.name)) out.push(p);
  }
  return out;
}
const ROOT = new URL("..", import.meta.url).pathname;
const files = [...walk(path.join(ROOT, "app")), ...walk(path.join(ROOT, "lib"))];
const rel = (p) => path.relative(ROOT, p);

const KEY_USERS = {
  "lib/kitchen/key.js": "defines it",
  "lib/kitchen/access.js": "re-exports it",
  "app/app/settings/services/ServicesEditor.js": "scroll target for the card's find button — not access",
  "app/app/settings/services/KitchenDesignerCard.js": "whether to show the handyman hint — not access",
};
const keyUsers = files.filter((f) => /\bKITCHEN_DESIGN_KEY\b/.test(stripComments(fs.readFileSync(f, "utf8")))).map(rel).sort();
ok("KITCHEN_DESIGN_KEY is used only where the list says",
  JSON.stringify(keyUsers) === JSON.stringify(Object.keys(KEY_USERS).sort()), keyUsers);

const OVERRIDE_READERS = {
  "lib/kitchen/access.js": "the gate",
  "lib/links/load.js": "bio-link row, via kitchenDesignerOnPure",
  "app/api/self-quote/[companySlug]/route.js": "public form's link, via kitchenDesignerOnPure",
  "lib/settings/tradeGate.js": "Cabinet Rates, via kitchenDesignerOnPure",
  "app/api/settings/kitchen-designer/route.js": "the one writer",
};
const overrideUsers = files.filter((f) => /kitchenDesignerOverride/.test(stripComments(fs.readFileSync(f, "utf8")))).map(rel).sort();
ok("kitchenDesignerOverride is touched only where the list says",
  JSON.stringify(overrideUsers) === JSON.stringify(Object.keys(OVERRIDE_READERS).sort()), overrideUsers);
for (const f of ["lib/links/load.js", "app/api/self-quote/[companySlug]/route.js", "lib/settings/tradeGate.js"]) {
  ok(`${f} answers with the one rule (kitchenDesignerOnPure), not its own`,
    /kitchenDesignerOnPure\(/.test(stripComments(fs.readFileSync(path.join(ROOT, f), "utf8"))));
}
ok("the override has exactly one writer, and it refuses anyone below owner/admin",
  /\["owner", "admin"\]\.includes\(member\.role\)/.test(fs.readFileSync(path.join(ROOT, "app/api/settings/kitchen-designer/route.js"), "utf8")) &&
    files.filter((f) => /kitchenDesignerOverride:\s*body\./.test(fs.readFileSync(f, "utf8"))).map(rel).join() ===
      "app/api/settings/kitchen-designer/route.js");
ok("…and it accepts exactly true, false or null",
  /!\[true, false, null\]\.includes\(body\.override\)/.test(fs.readFileSync(path.join(ROOT, "app/api/settings/kitchen-designer/route.js"), "utf8")));

console.log(
  failures === 0
    ? "\nKitchen Designer access matches what the company actually turned on.\n"
    : `\n${failures} check(s) failed.\n`,
);
process.exit(failures === 0 ? 0 : 1);
