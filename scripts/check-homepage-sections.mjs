// scripts/check-homepage-sections.mjs
//
//   npm run check:homepage-sections
//
// The homepage, section by section — rewritten 2026-09-29 with the page.
//
// ══ What changed, and what was kept ══════════════════════════════════════
//
// The first version of this file pinned the OLD design: four named sections
// (FeaturesIndustries, FAQ, ResourcesTeaser, ClosingCTA), the feature band's
// `product.<key>.label`/`.description` pair, and the trades strip's
// useIndustryLabels() call. The homepage was rebuilt to the owner-approved
// structure from a UX review (hero, demo, results, how it works, your trade,
// outcomes, AI, one system, customer story, pricing, FAQ, final ask), so
// those design pins were retired with the components they pinned.
//
// The RULES that were about honesty rather than layout were kept and carried
// onto the new sections:
//
//   · every internal link resolves to a real route — and a slug under a
//     dynamic route (/features/[slug], /product/[slug], /industries/[slug])
//     resolves to a page that route will actually render;
//   · the page asks for the signup again below the hero.
//
// And the new page's own promises are pinned, because each is the kind of
// thing that quietly rots:
//
//   · the sections render, in the approved order;
//   · the industry research is the report's figures, attributed, with its
//     source line — never FieldQuo's results, never a magnitude;
//   · no customer story renders without an owner sign-off on record;
//   · the trade selector and every other section fetch nothing (a public page
//     that pulled a company's rates would be non-negotiable #4 broken);
//   · no price, sale figure or trial length is typed — they come from the
//     resolver /pricing uses and from lib/pricing.js;
//   · the sale pill's selector (lib/marketing/homeSale.js) is EXECUTED against
//     a sale that applies everywhere, one that does not, one the standing
//     offer outranks, a fixed-amount one, and no plans at all.
//
// check:marketing-cta still owns "the page asks, and asks for something
// true"; nothing here duplicates it.
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { MESSAGES } from "../app/i18n/messages.js";
import { INDUSTRIES } from "../app/data/industries.js";
import { INDUSTRY_CONTENT } from "../app/data/industryContent.js";
import { PRODUCT_FEATURES } from "../app/data/productFeatures.js";
import { FEATURE_PAGES } from "../app/data/featurePages.js";
import { TRIAL_DAYS } from "../lib/pricing.js";
import { planOffer } from "../lib/pricing/planOffer.js";
import { homeSalePill, saleName } from "../lib/marketing/homeSale.js";
import { RESEARCH_SOURCE, RESEARCH_STATS } from "../app/components/marketing/home/research.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

let pass = 0;
const failures = [];

/** label first, condition second — see the note in check-marketing-cta. */
function ok(name, condition, detail = "") {
  if (condition) {
    pass++;
    console.log(`  ✓ ${name}`);
    return true;
  }
  failures.push(`${name}${detail ? `  ${detail}` : ""}`);
  console.log(`  ✗ ${name}${detail ? `\n      ${detail}` : ""}`);
  return false;
}
const section = (t) => console.log(`\n${t}`);
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");

/**
 * Comments stripped before anything is matched: a key or an href named in a
 * comment is not rendered, and every file here explains itself at length.
 */
const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const EN = MESSAGES.en || {};
const HOME = "app/(marketing)/page.js";
const DIR = "app/components/marketing/home";

// The approved order (owner, 2026-09-29). A section moved, dropped or renamed
// is a failure to explain, not something to re-sort silently.
const ORDER = [
  "HomeHero",
  "ProductDemo",
  "ResultsResearch",
  "HowItWorks",
  "TradeSelector",
  "OutcomeGroups",
  "AskAI",
  "OneSystem",
  "CustomerStory",
  "HomePricing",
  "HomeFAQ",
  "FinalCTA",
];
const fileOf = (name) => `${DIR}/${name}.js`;

console.log("\nHomepage — the approved sections, wired and honest\n");

// ═══════════════════════════════════════════════════════════════════════════
section("1. The page renders the approved sections, in order");
// ═══════════════════════════════════════════════════════════════════════════

const homeSrc = stripComments(read(HOME));
{
  const positions = [];
  for (const name of ORDER) {
    ok(`${name}.js exists`, existsSync(join(ROOT, fileOf(name))));
    const imported = new RegExp(`import\\s+${name}\\s+from\\s+["']@/${fileOf(name).replace(/\.js$/, "")}["']`).test(homeSrc);
    const at = homeSrc.search(new RegExp(`<${name}[\\s/>]`));
    ok(`${HOME} imports and renders <${name} />`, imported && at !== -1, "the section is on disk but the homepage no longer shows it");
    positions.push(at);
  }
  ok(
    "the sections render in the approved order",
    positions.every((p, i) => i === 0 || p > positions[i - 1]),
    ORDER.join(" → "),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
section("2. Prices, the sale and the trial are read, never typed");
// ═══════════════════════════════════════════════════════════════════════════

{
  const m = homeSrc.match(/export const revalidate\s*=\s*(\d+)/);
  ok(
    "the page revalidates at most every 60 seconds (a sale switched off must leave the pill within a minute)",
    m && Number(m[1]) > 0 && Number(m[1]) <= 60 && !/force-static/.test(homeSrc),
    m ? `revalidate is ${m[1]}` : "no `export const revalidate` — a static homepage would freeze the pill and the prices at build time",
  );
  for (const call of ["db.plan.findMany(", "partitionPlans(", "oneRowPerTier(", "livePromotions(", "universalPromotions(", "withOffers(", "homeSalePill("]) {
    ok(`the page resolves prices through ${call.replace("(", "()")} — the same chain /pricing uses`, homeSrc.includes(call));
  }
  ok("the page's plan read is not narrowed by a select", !/findMany\(\{[^}]*select:/.test(homeSrc));

  const pricing = stripComments(read(fileOf("HomePricing")));
  ok("HomePricing prints offers through PlanOfferPrice, the component /pricing uses", /<PlanOfferPrice\b/.test(pricing));
  ok(
    "HomePricing types no ladder price (99 / 169 / 269 / 369 / 990)",
    !/\b(99|169|269|369|990)\b/.test(pricing),
  );
  // Class lists are styling (a mask gradient's "30%"), not copy; dropped first.
  const hero = stripComments(read(fileOf("HomeHero"))).replace(/className="[^"]*"/g, "");
  ok("the sale pill types no percentage or date", !/\d+\s*%|\b(Oct|Nov|Dec|Jan)\b/.test(hero));

  // The trial length lives in lib/pricing.js. A home.* sentence carrying it
  // as a literal is the next "14" that is wrong the day the owner changes it.
  const typed = Object.entries(EN).filter(
    ([k, v]) => k.startsWith("home.") && new RegExp(`(^|[^\\d,.])${TRIAL_DAYS}([^\\d,.]|$)`).test(String(v)),
  );
  ok(
    `no home.* sentence types the trial length (${TRIAL_DAYS}) — it arrives as {days}`,
    typed.length === 0,
    typed.map(([k]) => k).join(", "),
  );
  ok("the trial line reads TRIAL_DAYS and TRIAL_CARD_REQUIRED", /TRIAL_DAYS/.test(read(fileOf("TrialLine"))) && /TRIAL_CARD_REQUIRED/.test(read(fileOf("TrialLine"))));
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. The sale pill announces only a sale every visitor is charged");
// ═══════════════════════════════════════════════════════════════════════════

{
  const now = new Date("2026-10-10T12:00:00Z");
  const ladder = [
    { id: "solo", tierKey: "solo", currency: "USD", priceMonthly: 99, priceAnnual: 990 },
    { id: "crew", tierKey: "crew", currency: "USD", priceMonthly: 169, priceAnnual: 1690 },
    { id: "shop", tierKey: "shop", currency: "USD", priceMonthly: 269, priceAnnual: 2690 },
    { id: "scale", tierKey: "scale", currency: "USD", priceMonthly: 369, priceAnnual: 3690 },
  ];
  const promo = (over) => ({
    id: "fall",
    label: "Fall Sale 40%",
    active: true,
    startsAt: "2026-09-01T00:00:00Z",
    endsAt: "2026-11-01T00:00:00Z",
    discountKind: "percent",
    discountValue: 40,
    durationMonths: 12,
    tierKeys: null,
    currencies: null,
    appliesTo: "year",
    ...over,
  });
  const cards = (promotions) =>
    ladder.map((plan) => ({
      ...plan,
      offers: {
        month: planOffer({ plan, interval: "month", promotions, now }),
        year: planOffer({ plan, interval: "year", promotions, now }),
      },
    }));
  const run = (promotions, plans = cards(promotions)) => homeSalePill({ promotions, plans });

  const fall = run([promo()]);
  ok("a 40% 1-year sale on every plan shows", fall && fall.percent === 40 && fall.intervals.join() === "year", JSON.stringify(fall));
  ok('its name drops the "40%" the pill already says', fall?.name === "Fall Sale", fall?.name);
  ok("its end date is the row's", fall?.endsAt === "2026-11-01T00:00:00.000Z", fall?.endsAt);

  ok("a sale scoped to one plan does not show", run([promo({ tierKeys: ["solo"] })]) === null);
  ok(
    "a 10% year sale that the standing 1-year offer beats does not show (nobody would be charged it)",
    run([promo({ discountValue: 10, label: "Tiny sale" })]) === null,
  );
  ok("a sale that has ended does not show", run([promo({ endsAt: "2026-10-01T00:00:00Z" })]) === null);
  ok("no plans read (database down) means no pill", run([promo()], []) === null);
  const amount = run([promo({ discountKind: "amount", discountValue: 20, appliesTo: "month", durationMonths: 3, label: "Spring" })]);
  ok("a fixed-amount sale shows its name with no invented percentage", amount && amount.percent === null && amount.name === "Spring", JSON.stringify(amount));
  ok('a label whose number is not the discount is kept whole', saleName("Top 10 sale", 40) === "Top 10 sale");
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. The research is the report's, attributed, and worded as shares");
// ═══════════════════════════════════════════════════════════════════════════

{
  // Pinned to the owner's brief (BuildOps 2026 Customer Benchmark, April 2026,
  // 54 commercial contractors). Changing a figure means changing it here too,
  // on purpose, against the report.
  const EXPECTED = {
    volume: 0.8,
    revenuePerTech: 0.76,
    margins: 0.76,
    growth: 0.72,
    invoicing: 0.75,
    quoteTurnaround: 0.76,
    winRate: 0.64,
  };
  for (const [key, share] of Object.entries(EXPECTED)) {
    const stat = RESEARCH_STATS.find((s) => s.key === key);
    ok(`${key}: ${Math.round(share * 100)}% of respondents`, stat?.share === share, JSON.stringify(stat));
  }
  ok("tools replaced: 2.6 on average", RESEARCH_STATS.find((s) => s.key === "tools")?.average === 2.6);
  ok("no figure beyond the report's eight", RESEARCH_STATS.length === 8);
  ok(
    "the source is named with its sample and date",
    RESEARCH_SOURCE.report === "2026 Customer Benchmark Report" && !/fieldquo/i.test(RESEARCH_SOURCE.report) &&
      RESEARCH_SOURCE.contractors === 54 &&
      RESEARCH_SOURCE.published.year === 2026 &&
      RESEARCH_SOURCE.published.month === 4,
  );

  // Worded as people REPORTING, never as a magnitude: "76% more revenue" is a
  // claim the report does not make. Every share label must start with the
  // respondents' verb, in English.
  for (const stat of RESEARCH_STATS.filter((s) => s.share != null)) {
    const text = String(EN[`home.results.stat.${stat.key}`] || "");
    ok(`home.results.stat.${stat.key} is worded as respondents reporting`, /^(say|report)\b/.test(text), text);
  }
  const results = stripComments(read(fileOf("ResultsResearch")));
  ok("the results section prints the source line", /t\(\s*"home\.results\.source"/.test(results) && /RESEARCH_SOURCE\.report/.test(results));
  ok("the results section says these are not FieldQuo customer results", /not FieldQuo customer results/.test(String(EN["home.results.intro"])));
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. Nothing invented: no unapproved story, no fetched rates");
// ═══════════════════════════════════════════════════════════════════════════

{
  const src = stripComments(read(fileOf("CustomerStory")));
  const m = src.match(/export const CUSTOMER_STORIES\s*=\s*\[([\s\S]*?)\];/);
  ok("CUSTOMER_STORIES is readable", Boolean(m), "if the constant moved, this rule is blind and must be rewritten, not deleted");
  const body = (m?.[1] || "").trim();
  if (!body) {
    ok("no customer story is on the page (none has been approved yet)", true);
  } else {
    const entries = (body.match(/\bid\s*:/g) || []).length;
    for (const field of ["approvedBy", "approvedOn", "originalLanguage"]) {
      ok(
        `every customer story carries ${field}`,
        (body.match(new RegExp(`\\b${field}\\s*:`, "g")) || []).length >= entries,
        "a story without an owner sign-off on record must not render",
      );
    }
  }
  ok("the section renders nothing while the list is empty", /if\s*\(\s*!story\s*\)\s*return null/.test(src));

  const files = readdirSync(join(ROOT, DIR)).filter((f) => f.endsWith(".js"));
  const fetching = files.filter((f) => /\bfetch\s*\(|["'`]\/api\//.test(stripComments(read(`${DIR}/${f}`))));
  ok(
    `no homepage section fetches anything (${files.length} files)`,
    fetching.length === 0,
    fetching.join(", ") + " — the trade examples are illustrative and client-side; a real rate card must never reach a public page",
  );
}

// ═══════════════════════════════════════════════════════════════════════════
section("6. Every link these sections draw has somewhere to land");
// ═══════════════════════════════════════════════════════════════════════════

/** Every route the app serves, as segment arrays; (groups) dropped, [dyn] kept. */
function routeIndex() {
  const routes = [];
  const walk = (relDir) => {
    let entries;
    try {
      entries = readdirSync(join(ROOT, relDir));
    } catch {
      return;
    }
    if (entries.includes("page.js") || entries.includes("page.jsx")) {
      routes.push(relDir.split("/").slice(1).filter((s) => s && !(s.startsWith("(") && s.endsWith(")"))));
    }
    for (const e of entries) {
      if (e.startsWith(".") || e === "node_modules") continue;
      const child = join(relDir, e);
      if (statSync(join(ROOT, child)).isDirectory()) walk(child);
    }
  };
  walk("app");
  return routes;
}
const ROUTES = routeIndex();
ok("the route index found the marketing pages", ROUTES.length > 20, `only ${ROUTES.length} routes`);

function routeExists(segs) {
  return ROUTES.some(
    (route) =>
      route.length === segs.length &&
      route.every((r, i) => (r.startsWith("[") || segs[i] === "[dyn]" ? r.startsWith("[") : r === segs[i])),
  );
}

/** href="/x", href={`/x/${y}`} and config-array `href: "/x"` — all three. */
function hrefsIn(src) {
  const found = [];
  for (const m of src.matchAll(/href\s*[=:]\s*(?:"([^"]*)"|\{`([^`]*)`\}|`([^`]*)`)/g)) {
    const raw = m[1] ?? m[2] ?? m[3] ?? "";
    if (raw.startsWith("/")) found.push(raw);
  }
  return found;
}

let linksChecked = 0;
const literalSlugs = { features: new Set(), product: new Set() };
for (const name of ORDER) {
  const src = stripComments(read(fileOf(name)));
  const dead = [];
  for (const href of hrefsIn(src)) {
    const path = href.split("#")[0].split("?")[0];
    if (!path || path === "/") continue;
    const segs = path.replace(/\$\{[^}]*\}/g, "[dyn]").split("/").filter(Boolean);
    linksChecked++;
    if (!routeExists(segs)) dead.push(href);
    if (segs.length === 2 && segs[1] !== "[dyn]" && literalSlugs[segs[0]]) literalSlugs[segs[0]].add(segs[1]);
  }
  ok(`${name}.js — every internal link resolves to a page`, dead.length === 0, dead.join(", ") + " — no page.js serves this");
}

{
  // A dynamic route accepts any slug and calls notFound() on a wrong one, so
  // the literal slugs are checked against the data those routes render from.
  const featureSlugs = new Set(FEATURE_PAGES.map((p) => p.slug));
  const badFeatures = [...literalSlugs.features].filter((s) => !featureSlugs.has(s));
  ok(
    `every /features/<slug> link is a real feature page (${literalSlugs.features.size})`,
    literalSlugs.features.size > 0 && badFeatures.length === 0,
    badFeatures.join(", ") || "no /features links found — the outcome groups stopped linking, and this rule is blind",
  );
  const badProducts = [...literalSlugs.product].filter((s) => !(s in PRODUCT_FEATURES));
  ok(`every /product/<slug> link is a real product page (${literalSlugs.product.size})`, badProducts.length === 0, badProducts.join(", "));

  // The trade selector builds /industries/${slug} from TRADE_EXAMPLES; read
  // the slugs out of its source rather than restating them here.
  const trades = [...stripComments(read(fileOf("TradeSelector"))).matchAll(/\{\s*slug:\s*"([^"]+)"/g)].map((m) => m[1]);
  ok("the trade selector lists eight trades", trades.length === 8, trades.join(", "));
  const known = new Set(INDUSTRIES.map((i) => i.slug));
  const badTrades = trades.filter((s) => !known.has(s) || !(s in INDUSTRY_CONTENT));
  ok("every trade is a real FieldQuo industry with a page behind it", badTrades.length === 0, badTrades.join(", "));
  const missingCopy = trades.filter((s) => !(`home.trades.${s}.job` in EN) || !(`home.trades.${s}.scope` in EN));
  ok("every trade has its example job and scope in the catalogue", missingCopy.length === 0, missingCopy.join(", "));
}

// ═══════════════════════════════════════════════════════════════════════════
section("7. The page asks a second time, after the reasons to say yes");
// ═══════════════════════════════════════════════════════════════════════════

{
  const askers = ORDER.slice(1).filter((name) => /href="\/signup/.test(stripComments(read(fileOf(name)))));
  ok(
    "a section BELOW the hero links to /signup",
    askers.length > 0,
    "the hero is the only ask on the page again — a visitor convinced by the FAQ has to scroll back up",
  );
}

// ═══════════════════════════════════════════════════════════════════════════

console.log(`\n${linksChecked} internal links resolved against the real route tree\n`);

if (failures.length) {
  console.log(`FAILED — ${failures.length} problem(s), ${pass} passed\n`);
  for (const f of failures) console.log(`  · ${f}`);
  process.exit(1);
}
console.log(`ALL PASS — ${pass} checks\n`);
