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
import {
  KITCHEN_DESIGN_KEY,
  KITCHEN_GROUP_LABEL,
  hasKitchenData,
  canUseKitchenDesignerPure,
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
ok("a company with every OTHER trade enabled, but not kitchen_design, still gets nothing on a bare quote",
  canUseKitchenDesignerPure({ scopeGroups: [] }, tradeKeys().filter((k) => k !== KITCHEN_DESIGN_KEY)) === false);

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

// The other two files ARE allowed to still consult "cabinet-ish" categories
// — but only as a fallback for which category to FILE an already-approved
// design under, never as the thing that decides whether the request is
// allowed at all. So the real assertion is ordering: the access check runs
// and can refuse BEFORE the regex is ever reached.
const kitchenRouteSrc = stripComments(
  fs.readFileSync(new URL("../app/api/quotes/[id]/kitchen/route.js", import.meta.url), "utf8"),
);
ok("the save route checks canUseKitchenDesigner before doing anything else",
  /canUseKitchenDesigner\(/.test(kitchenRouteSrc));
ok("…and that check runs BEFORE the file's one remaining (fallback-only) use of the old regex",
  kitchenRouteSrc.indexOf("canUseKitchenDesigner(") < kitchenRouteSrc.indexOf(OLD_PATTERN.source.replace(/\\\|/g, "|")));

const selfQuoteKitchenSrc = stripComments(
  fs.readFileSync(new URL("../app/api/self-quote/kitchen/route.js", import.meta.url), "utf8"),
);
ok("the public lead endpoint refuses (KITCHEN_DESIGN_KEY check) before its one remaining fallback use of the old regex",
  selfQuoteKitchenSrc.indexOf("KITCHEN_DESIGN_KEY") <
    selfQuoteKitchenSrc.indexOf(OLD_PATTERN.source.replace(/\\\|/g, "|")));
ok("the internal designer PAGE also checks it server-side, not just the button that links to it",
  stripComments(
    fs.readFileSync(new URL("../app/app/quotes/[id]/kitchen/page.js", import.meta.url), "utf8"),
  ).includes("canUseKitchenDesigner("));
ok("the public design-your-kitchen page checks companyOffersKitchenDesign before rendering",
  stripComments(
    fs.readFileSync(new URL("../app/quote/[companySlug]/kitchen/page.js", import.meta.url), "utf8"),
  ).includes("companyOffersKitchenDesign("));
ok("the public lead endpoint checks it too — a browser can POST here without ever loading the page above",
  /KITCHEN_DESIGN_KEY/.test(
    stripComments(fs.readFileSync(new URL("../app/api/self-quote/kitchen/route.js", import.meta.url), "utf8")),
  ));

console.log(
  failures === 0
    ? "\nKitchen Designer access matches what the company actually turned on.\n"
    : `\n${failures} check(s) failed.\n`,
);
process.exit(failures === 0 ? 0 : 1);
