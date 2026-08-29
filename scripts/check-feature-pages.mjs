// scripts/check-feature-pages.mjs
//
//   npm run check:feature-pages
//
// Two dozen public pages, each one naming features, each name a promise
// somebody buys on.
//
// ══ Why this exists beside check:feature-matrix ════════════════════════════
//
// lib/marketing/featureMatrix.js is the list of claims and
// scripts/check-feature-matrix.mjs proves each one against the file that
// implements it. That check knows nothing about /features/*. A page could
// therefore be perfectly matrix-backed in its bullet list and still say, in the
// paragraph above it, that we have a phone application — and the matrix check
// would pass, because the sentence is not in the matrix.
//
// So this file polices the PAGES: what they render, not what they intend. Every
// assertion below is made against markup produced by the real components.
//
// ══ Rendered, not regexed ══════════════════════════════════════════════════
//
// The pages are bundled with esbuild and executed through react-dom/server, the
// way scripts/check-pricing-page.mjs executes the pricing grid. That is not
// ceremony. An agent working in this repo this session had seventy-five source
// assertions pass green against a page that had stopped calling the function
// they all tested; the same failure is recorded in the header of
// check-pricing-page.mjs, where an earlier draft called oneRowPerTier itself
// and never noticed the page had stopped calling it. A regex sees characters. A
// render sees the page.
//
// The one thing read as SOURCE is lib/stripe.js, and only to compare two
// numbers the financing page prints against the two constants that produce
// them. Reading them is the point of that assertion.
//
// Run (esbuild first — the pages are JSX, which plain node cannot parse):
//   npx esbuild scripts/check-feature-pages.mjs --bundle --platform=node \
//     --format=cjs --jsx=automatic --loader:.js=jsx --alias:@=. \
//     --alias:next/navigation=./scripts/stub-next-navigation.js \
//     --outfile=.feature-pages.cjs && node .feature-pages.cjs

import { existsSync, readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  FEATURE_MATRIX,
  MATRIX_KEYS,
  MATRIX_GROUPS,
  matrixEntry,
  partialFeatures,
} from "@/lib/marketing/featureMatrix";
import {
  FEATURE_PAGES,
  FEATURE_PAGE_SLUGS,
  PAGE_EXCLUSIONS,
  PRICING_FEATURES,
  canonicalPageFor,
  coverage,
  featurePage,
  featuresOnPage,
  moreInThisArea,
} from "@/app/data/featurePages";
import { LANGUAGES, DEFAULT_LANGUAGE } from "@/app/i18n/languages";
import { MESSAGES } from "@/app/i18n/messages";
import { LanguageProvider } from "@/app/providers/LanguageProvider";
import {
  FEATURE_PAGE_TEXT_KEYS,
  featurePageCopy,
  featurePageKey,
  featurePageLabel,
  featurePageStrings,
} from "@/app/data/featurePages";
import {
  FEATURE_GROUP_KEYS,
  FEATURE_LIMIT_KEYS,
  LIMIT_KEYS,
  featureEntry,
  featureGroup,
  featureGroupKey,
  featureLabelKey,
} from "@/lib/marketing/featureLabels";
import { scoreLead, TEMPERATURES } from "@/lib/leads/score";
import { BUDGET_BANDS, TIMELINES } from "@/lib/leads/qualifiers";
import { FUNNEL_STEP_KINDS } from "@/app/data/funnelBlocks";
import FeaturePage, {
  generateStaticParams,
  generateMetadata,
} from "@/app/(marketing)/features/[slug]/page";
import FeaturesIndexPage from "@/app/(marketing)/features/page";

let pass = 0;
const fails = [];
const ok = (label, cond, detail) => {
  if (cond) {
    pass++;
    console.log(`  ✓ ${label}`);
  } else {
    fails.push(`${label}${detail !== undefined ? ` — ${detail}` : ""}`);
    console.log(`  ✗ ${label}${detail !== undefined ? ` — ${detail}` : ""}`);
  }
  return !!cond;
};

/**
 * Markup → the words a visitor reads.
 *
 * Entities have to be decoded or half the assertions below are meaningless:
 * React writes an apostrophe as `&#x27;`, and the matrix summaries this file
 * looks for are full of them ("the client's language", "tomorrow's
 * appointments"). Comparing raw markup against raw data would quietly never
 * match, and a check that never matches passes for the wrong reason.
 */
function textOf(html) {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/** Comments stripped, so a word discussed in a header is not read as a claim. */
const decomment = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

// ── Render everything once, up front ───────────────────────────────────────
//
// Every assertion below reads from this map rather than re-rendering, so a
// page that throws fails loudly here instead of failing twenty times quietly.
//
// Wrapped in main() because the pages are async server components and esbuild's
// cjs output has no top-level await. Called at the bottom.
async function main() {
// ── Rendered IN A LANGUAGE ────────────────────────────────────────────────
//
// These pages used to be server components with no translation context, so a
// render took no language and there was nothing to pass. They are split now —
// page.js keeps routing and metadata, FeaturePageContent renders — because the
// owner opened /features/quotes and /features/quote-from-the-call and found
// them untranslated. So every render here goes through LanguageProvider, and
// the English renders below are the DEFAULT language rather than the only one:
// every assertion in this file that was written against English prose still
// reads `rendered`, and section 12 renders the same pages five more times and
// looks for that English surviving where it should not.
const renderPage = async (slug, language) => {
  const element = await FeaturePage({ params: Promise.resolve({ slug }) });
  if (element === undefined) return undefined;
  return renderToStaticMarkup(
    createElement(LanguageProvider, { initialLanguage: language }, element),
  );
};

const rendered = new Map();
for (const slug of FEATURE_PAGE_SLUGS) {
  const html = await renderPage(slug, DEFAULT_LANGUAGE);
  rendered.set(slug, { html, text: textOf(html) });
}
const indexHtml = renderToStaticMarkup(
  createElement(
    LanguageProvider,
    { initialLanguage: DEFAULT_LANGUAGE },
    createElement(FeaturesIndexPage),
  ),
);
const indexText = textOf(indexHtml);

/* ═══════════════════════════════════════════════════════════════════════════
   1. Every slug renders, and renders something
   ═══════════════════════════════════════════════════════════════════════════

   The cheapest thing that can go wrong with a data-driven page set is that one
   entry has a shape the renderer does not expect and comes out empty — a live
   URL, a 200, and a blank page nobody notices because nobody links to it yet.
   Length is a crude test and it is the right one: an empty page is the failure
   mode, not a subtly short one. */

console.log("\n── Every page renders ──────────────────────────────────────────\n");

ok(`there are pages at all (${FEATURE_PAGES.length})`, FEATURE_PAGES.length > 0);
ok(
  "generateStaticParams offers exactly the slugs that exist",
  JSON.stringify(generateStaticParams().map((p) => p.slug)) ===
    JSON.stringify([...FEATURE_PAGE_SLUGS]),
);
ok(
  "no two pages share a slug",
  new Set(FEATURE_PAGE_SLUGS).size === FEATURE_PAGE_SLUGS.length,
);

for (const slug of FEATURE_PAGE_SLUGS) {
  const { text } = rendered.get(slug);
  const page = featurePage(slug);
  ok(`/features/${slug} renders real content`, text.length > 800, `${text.length} chars`);
  ok(`/features/${slug} shows its own headline`, text.includes(page.headline));
}

// A slug that does not exist must 404 rather than render a shell. notFound() is
// stubbed inert for this bundle (see scripts/stub-next-navigation.js), so the
// component returns its result — undefined — and that is the observable proof
// that the guard ran.
{
  const missing = await FeaturePage({ params: Promise.resolve({ slug: "not-a-feature" }) });
  ok("an unknown slug takes the notFound path", missing === undefined, String(missing));
  const meta = await generateMetadata({ params: Promise.resolve({ slug: "not-a-feature" }) });
  ok("...and claims no metadata", Object.keys(meta).length === 0);
}

// params is a Promise in Next 16. /product/[slug] shipped with this read
// synchronously and 404'd every page it existed to serve. Proving the await is
// real: a component that destructured it synchronously would see undefined and
// take the notFound path above for a slug that does exist.
for (const slug of [FEATURE_PAGE_SLUGS[0], FEATURE_PAGE_SLUGS.at(-1)]) {
  const meta = await generateMetadata({ params: Promise.resolve({ slug }) });
  ok(`/features/${slug} awaits params for its metadata`, meta.alternates?.canonical === `/features/${slug}`, meta.alternates?.canonical);
  ok(`...and titles itself distinctly`, typeof meta.title === "string" && meta.title.includes(featurePage(slug).headline));
}

/* ═══════════════════════════════════════════════════════════════════════════
   2. Every claim on a page resolves to a matrix entry
   ═══════════════════════════════════════════════════════════════════════════

   This is the assertion the whole file exists for, and it runs in both
   directions:

     forwards  — every feature a page names is a matrix key, and the matrix's
                 own proved sentence is what the page prints.
     backwards — a matrix summary belonging to a feature the page does NOT
                 claim must not appear on it. Without this half, a page could
                 print any claim it liked as long as it also printed its own.

   The summaries are distinctive full sentences, which is what makes the reverse
   direction safe to assert textually. */

console.log("\n── Claims resolve to the matrix, in both directions ────────────\n");

for (const slug of FEATURE_PAGE_SLUGS) {
  const page = featurePage(slug);
  const claimed = featuresOnPage(slug);

  ok(
    `/features/${slug} names only real features`,
    claimed.length === page.features.length,
    `${claimed.length} of ${page.features.length} resolved`,
  );

  const { text } = rendered.get(slug);
  const missingName = claimed.filter((f) => !text.includes(f.name));
  ok(
    `/features/${slug} prints each feature's matrix name`,
    missingName.length === 0,
    missingName.map((f) => f.key).join(" "),
  );
  const missingSummary = claimed.filter((f) => !text.includes(f.summary));
  ok(
    `/features/${slug} prints each feature's proved sentence`,
    missingSummary.length === 0,
    missingSummary.map((f) => f.key).join(" "),
  );

  const claimedKeys = new Set(page.features);
  const smuggled = FEATURE_MATRIX.filter(
    (e) => !claimedKeys.has(e.key) && text.includes(e.summary),
  );
  ok(
    `/features/${slug} makes no claim it did not list`,
    smuggled.length === 0,
    smuggled.map((e) => e.key).join(" "),
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   3. Every partial feature states its limit ON the page
   ═══════════════════════════════════════════════════════════════════════════

   Eight of the matrix's entries are `partial`: subcontractor bids, payroll,
   contractor payouts, financing, appointment reminders, checklists, door-hanger
   routes and the language set. Each carries `limits` saying where it stops.

   A tick beside "Payroll" with the limit left in a data file is the dead
   control AGENTS.md forbids, moved onto a page where it costs a refund rather
   than a click. The limit has to be in the markup, in full, on every page that
   names the feature. */

console.log("\n── Nothing partly built is sold as finished ────────────────────\n");

const partials = partialFeatures();
ok(`the matrix has partial entries to police (${partials.length})`, partials.length > 0);

for (const entry of partials) {
  const pagesNaming = FEATURE_PAGES.filter((p) => p.features.includes(entry.key));
  ok(`"${entry.name}" is on at least one page`, pagesNaming.length > 0);
  for (const page of pagesNaming) {
    const { text } = rendered.get(page.slug);
    ok(
      `/features/${page.slug} states the limit on "${entry.name}"`,
      text.includes(entry.limits),
    );
  }
}

// And the converse: a page with no partial features must not be printing the
// "where this stops" furniture, which would read as a hedge attached to
// nothing.
for (const slug of FEATURE_PAGE_SLUGS) {
  const hasPartial = featuresOnPage(slug).some((f) => f.readiness === "partial");
  const saysStops = rendered.get(slug).text.includes("Where this stops");
  ok(
    `/features/${slug} shows the limit block only when there is a limit`,
    hasPartial === saysStops,
    `partial=${hasPartial} block=${saysStops}`,
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   4. The four things that do not exist
   ═══════════════════════════════════════════════════════════════════════════

   A phone application, an accounting or automation integration, and change
   orders. All three are things a feature page invents by itself: every
   competitor's site has them, and the shape of the page asks for them.

   The mobile-app ban is inherited from check-feature-matrix.mjs, whose header
   explains why the patterns live in the CHECKER and not in the data — a ban
   that ships inside the file it polices gets edited away in the same commit
   that breaks it. The demo ban comes with it: there is a demo booker, it is
   mounted on the homepage only, and a feature page must not imply a contractor
   gets one.

   Scanned against RENDERED TEXT, so prose is covered and not just the bullet
   list, plus the decommented source of the three files this page set owns —
   because a string can be assembled somewhere the render did not reach. */

console.log("\n── The claims that may never appear ────────────────────────────\n");

const FORBIDDEN = [
  [/mobile app/i, "a mobile app"],
  [/native app/i, "a native app"],
  [/\bapp store\b/i, "an app store"],
  [/google play/i, "Google Play"],
  [/\b(ios|android)\b/i, "iOS or Android"],
  [/download (the|our) app/i, "an app to download"],
  [/quickbooks/i, "QuickBooks"],
  [/\bxero\b/i, "Xero"],
  [/zapier/i, "Zapier"],
  [/change orders?\b/i, "change orders"],
  [/\bdemos?\b/i, "a demo"],
  [/see it in action/i, "a demo, by another name"],
  [/\bsandbox\b/i, "a sandbox"],
];

const surfaces = [
  ...FEATURE_PAGE_SLUGS.map((s) => [`/features/${s}`, rendered.get(s).text]),
  ["/features", indexText],
  ["app/data/featurePages.js", decomment(readFileSync("app/data/featurePages.js", "utf8"))],
  [
    "app/(marketing)/features/[slug]/page.js",
    decomment(readFileSync("app/(marketing)/features/[slug]/page.js", "utf8")),
  ],
  [
    "app/(marketing)/features/page.js",
    decomment(readFileSync("app/(marketing)/features/page.js", "utf8")),
  ],
];

for (const [pattern, what] of FORBIDDEN) {
  const hits = surfaces.filter(([, body]) => pattern.test(body)).map(([where]) => where);
  ok(`nothing claims ${what}`, hits.length === 0, hits.join(" "));
}

/* Four sentences from app/data/productFeatures.js, which drives the older
   /product/[slug] pages and was found to overstate in exactly these places.
   Named here so the copy cannot be lifted across: "every version tracked" (only
   invoices keep their earlier version), "reminders by email and text" (text
   only), and "pay contractors directly through the app" (roster people, hourly,
   one currency). The fourth — its roles list — is covered by the jargon and
   claim assertions rather than by a phrase. */
const OVERSTATED = [
  [/every version tracked/i, '"every version tracked"'],
  [/reminders by email and text/i, '"reminders by email and text"'],
  [/pay contractors directly/i, '"pay contractors directly"'],
];
for (const [pattern, what] of OVERSTATED) {
  const hits = surfaces.filter(([, body]) => pattern.test(body)).map(([where]) => where);
  ok(`no page repeats ${what}`, hits.length === 0, hits.join(" "));
}

/* And the register. Same list check-feature-matrix.mjs uses on the matrix's own
   names: a page written in our vocabulary has failed at the only job it has. */
const JARGON = [
  "webhook", "endpoint", "schema", "prisma", "cron", "middleware", "boolean",
  "json", "api route", "tenant", "multi-tenant", "crud",
];
{
  const hits = [];
  for (const [where, body] of surfaces.slice(0, FEATURE_PAGE_SLUGS.length + 1)) {
    for (const word of JARGON) {
      if (new RegExp(`\\b${word}\\b`, "i").test(body)) hits.push(`${where}: ${word}`);
    }
  }
  ok("no internal vocabulary reaches a visitor", hits.length === 0, hits.join(" | "));
}

/* ═══════════════════════════════════════════════════════════════════════════
   5. Every matrix entry is on a page, or excluded with a reason
   ═══════════════════════════════════════════════════════════════════════════

   The failure this prevents is silent: a claim gets added to the matrix, proved
   by check:feature-matrix, and never appears anywhere a customer can read it.
   The matrix grows and the site does not, and nobody finds out because nothing
   is broken.

   `coverage()` is computed from the pages rather than maintained beside them,
   so adding a matrix entry moves this number without anybody remembering to. */

console.log("\n── Every proved claim is somewhere a visitor can read it ───────\n");

{
  const { covered, excluded, missing } = coverage();
  ok(
    `every matrix entry is on a page (${covered.size}/${MATRIX_KEYS.length})`,
    missing.length === 0,
    missing.join(" "),
  );
  ok(
    "coverage and exclusions together account for the whole matrix",
    covered.size + excluded.size >= MATRIX_KEYS.length &&
      MATRIX_KEYS.every((k) => covered.has(k) || excluded.has(k)),
  );
  ok(
    "nothing is claimed that the matrix does not carry",
    [...covered].every((k) => matrixEntry(k) !== undefined),
    [...covered].filter((k) => !matrixEntry(k)).join(" "),
  );
  for (const x of PAGE_EXCLUSIONS) {
    ok(`excluded "${x.key}" is a real matrix key`, matrixEntry(x.key) !== undefined);
    ok(`...and says why (${x.reason.slice(0, 40)}…)`, x.reason.trim().length > 20);
    ok(`...and is genuinely absent from every page`, !covered.has(x.key));
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   6. The index lists them, by the matrix's own grouping
   ═══════════════════════════════════════════════════════════════════════════

   Four groups, taken from MATRIX_GROUPS rather than restated — the header of
   featureMatrix.js argues at length that "Quotes / Scheduling / Team /
   Analytics" is a list of our screens and not of a contractor's problems, and
   an index that quietly regrouped would undo that argument where it is most
   visible. */

console.log("\n── The index is complete and grouped the agreed way ────────────\n");

ok("the index renders", indexText.length > 400, `${indexText.length} chars`);
for (const g of MATRIX_GROUPS) {
  const used = FEATURE_PAGES.some((p) => p.group === g.key);
  ok(`the index shows the "${g.label}" group`, indexText.includes(g.label));
  ok(`...and it has pages in it`, used);
  ok(`...with the matrix's own blurb`, indexText.includes(g.blurb));
}
for (const page of FEATURE_PAGES) {
  ok(`the index links /features/${page.slug}`, indexHtml.includes(`href="/features/${page.slug}"`));
  ok(`...under its own name`, indexText.includes(page.label));
}
ok(
  "every page belongs to a real group",
  FEATURE_PAGES.every((p) => MATRIX_GROUPS.some((g) => g.key === p.group)),
);

/* Each page has to end somewhere a visitor can act. A feature page that
   describes the product beautifully and offers no way in is the marketing
   equivalent of a dead button. */
for (const slug of FEATURE_PAGE_SLUGS) {
  ok(`/features/${slug} routes to the trial`, rendered.get(slug).html.includes('href="/signup"'));
}
ok("the index routes to the trial too", indexHtml.includes('href="/signup"'));

/* Cross-links have to land on pages that exist. A 404 from a "you might also
   read" chip is the same dead control, one hop away. */
{
  const broken = [];
  for (const page of FEATURE_PAGES) {
    for (const slug of page.related || []) {
      if (!featurePage(slug)) broken.push(`${page.slug}→${slug}`);
      if (!rendered.get(page.slug).html.includes(`href="/features/${slug}"`)) {
        broken.push(`${page.slug} does not render →${slug}`);
      }
    }
  }
  ok("every cross-link points at a page that exists and is rendered", broken.length === 0, broken.join(" "));
}

/* ═══════════════════════════════════════════════════════════════════════════
   7. The two the owner asked to be surfaced
   ═══════════════════════════════════════════════════════════════════════════

   Financing and the language set are both real and both easy to overstate, so
   they get their own assertions rather than being covered only by the generic
   ones above.

   Financing: Affirm, offered at Stripe Checkout on top of card, only when the
   company opted in and only for a bounded amount in USD or CAD — and the
   bounds printed on the page are compared against the constants in
   lib/stripe.js that decide them, because a marketing page quoting a range the
   code does not honour is a support ticket with a number on it. FieldQuo does
   not lend, and the page has to say who does. */

console.log("\n── Financing says who lends, and where it stops ────────────────\n");

{
  const { text } = rendered.get("financing");
  ok("the financing page names Affirm", text.includes("Affirm"));
  ok("...and names Stripe as the account it rides on", /Stripe/.test(text));
  ok("...and says FieldQuo does not lend", /FieldQuo does not lend/i.test(text));
  ok(
    "...and says the lender decides",
    /lender decides|makes its own decision/i.test(text),
  );
  ok(
    "...and refuses to invent a monthly figure",
    /never invents a monthly figure/i.test(text),
  );

  // The bounds, against the constants that enforce them. $50 and $30,000 are
  // AFFIRM_MIN and AFFIRM_MAX in cents.
  const stripeSrc = readFileSync("lib/stripe.js", "utf8");
  const min = Number((stripeSrc.match(/AFFIRM_MIN\s*=\s*([\d_]+)/) || [])[1]?.replace(/_/g, ""));
  const max = Number((stripeSrc.match(/AFFIRM_MAX\s*=\s*([\d_]+)/) || [])[1]?.replace(/_/g, ""));
  ok("lib/stripe.js still bounds the Affirm offer", Number.isFinite(min) && Number.isFinite(max), `${min}..${max}`);
  ok(
    `...and the page prints those bounds ($${min / 100}–$${(max / 100).toLocaleString("en-US")})`,
    text.includes(`$${min / 100}`) && text.includes(`$${(max / 100).toLocaleString("en-US")}`),
  );
  ok(
    "...and names the currencies Affirm settles in",
    /Canadian or US dollars/i.test(text),
  );
  ok(
    "lib/stripe.js still gates Affirm on the company opting in",
    /company\.offerFinancing/.test(stripeSrc),
  );
}

/* Languages: six, not one. The names are rendered FROM app/i18n/languages.js,
   so a page cannot advertise a language the product does not carry — and the
   entry is `partial`, so which of the six are finished has to be on the page
   too, which section 3 already required. */

console.log("\n── Six languages, named from the source of truth ───────────────\n");

{
  const { text } = rendered.get("languages");
  ok(`the product carries six languages (${LANGUAGES.length})`, LANGUAGES.length === 6);
  for (const l of LANGUAGES) {
    ok(`the languages page names ${l.name}`, text.includes(l.name));
    ok(`...in its own script (${l.nativeName})`, text.includes(l.nativeName));
  }
  ok(
    "...and says a document keeps the language it was created in",
    /keeps the language it was created in/i.test(text),
  );
  // The claim the owner is tired of: Spanish and nothing else.
  ok(
    "...and does not present Spanish as the only second language",
    !/only.{0,20}Spanish/i.test(text),
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   8. The page set is worth reading
   ═══════════════════════════════════════════════════════════════════════════

   Editorial, and asserted because the failure is real: 76 thin pages that each
   restate one bullet would rank for nothing and answer nobody. Every page owes
   a visitor a problem it removes, a paragraph on how it works HERE, and a
   description a search engine can print. */

console.log("\n── Each page is a page, not a bullet ───────────────────────────\n");

for (const page of FEATURE_PAGES) {
  ok(`/features/${page.slug} says what it is in one line`, page.oneLine.length >= 40 && page.oneLine.length <= 220, `${page.oneLine.length}`);
  ok(`...names at least two concrete problems`, page.pains.length >= 2);
  ok(`...explains how it works here`, page.how.length >= 3);
  ok(`...has a description worth indexing`, page.description.length >= 60 && page.description.length <= 240, `${page.description.length}`);
}

// "Streamline your workflow" and its relatives. The brief for these pages was
// concrete pain — a painter's evening, a cabinet maker's spreadsheet — and this
// is the one phrase family that signals it was not written.
const FILLER = [/streamline your workflow/i, /take your business to the next level/i, /all-in-one solution/i, /best-in-class/i];
{
  const hits = [];
  for (const [where, body] of surfaces.slice(0, FEATURE_PAGE_SLUGS.length + 1)) {
    for (const pattern of FILLER) if (pattern.test(body)) hits.push(`${where}: ${pattern}`);
  }
  ok("no page falls back on filler", hits.length === 0, hits.join(" | "));
}

/* ═══════════════════════════════════════════════════════════════════════════
   9. Lead triage is described as what it is
   ═══════════════════════════════════════════════════════════════════════════

   The owner asked for a page that explains "using AI to assess the Hot, cold,
   warm". It is not AI. lib/leads/score.js is a hand-tuned weighted sum whose
   own header says why it is deliberately NOT a model: "a black-box number
   nobody trusts gets ignored, and an ignored score is a dead control".

   Calling it AI on a public page would be the cheapest false claim on the site
   and the easiest one to catch, so half of this section is a ban. The other
   half is more interesting: the page states what the scorer weighs and IN WHAT
   ORDER, and every one of those sentences is checked by RUNNING the real
   scorer. Re-tune a weight so timing stops beating budget and this goes red —
   which is the only thing that keeps an explanation honest as the code moves.

   Nothing here asserts a specific number, and neither does the page: a point
   value printed in marketing copy is a figure nobody will re-check when the
   weight moves. The ORDER is the claim, and the order is executable. */

console.log("\n── Lead triage: an explanation the code still agrees with ──────\n");

{
  const { text } = rendered.get("leads");

  // ── What the scorer actually does, established by running it ─────────────
  const only = (lead) => scoreLead(lead).score;
  const soonest = TIMELINES[0].key;                       // "asap"
  const biggestBudget = BUDGET_BANDS[BUDGET_BANDS.length - 1].key; // "15k_plus"

  ok("the soonest timeline is the first one declared", soonest === "asap", soonest);
  ok("the biggest budget band is the last one declared", biggestBudget === "15k_plus", biggestBudget);

  const timing = only({ timeline: soonest });
  const budget = only({ budgetBand: biggestBudget });
  const emergency = only({ intake: { isEmergency: true } });
  const phone = only({ phone: "+15550000000" });
  const email = only({ email: "someone@example.com" });

  ok("timing outweighs the biggest stated budget", timing > budget, `${timing} vs ${budget}`);
  ok("...the budget outweighs the emergency flag", budget > emergency, `${budget} vs ${emergency}`);
  ok("...the emergency flag outweighs a phone number", emergency > phone, `${emergency} vs ${phone}`);
  ok("...and a phone number outweighs an email address", phone > email, `${phone} vs ${email}`);

  // And the page says the same four things, in the same order. Position, not
  // just presence: a list that named the right five signals in the wrong order
  // would be a different and wrong explanation.
  const at = (needle) => text.indexOf(needle);
  const sequence = [
    "How soon they want to start counts for more than anything else",
    "Then the budget they gave",
    "then whether the job is an emergency",
    "a phone number is worth more to a trade than an email address",
    "Last comes effort",
  ];
  for (const phrase of sequence) ok(`the page says "${phrase.slice(0, 40)}…"`, at(phrase) >= 0);
  ok(
    "...and in the order the scorer actually weighs them",
    sequence.every((p, i) => i === 0 || (at(p) > at(sequence[i - 1]) && at(p) > 0)),
    sequence.map(at).join(","),
  );

  // "None of those can make a lead hot on its own" — the one quantitative
  // claim on the page, and it is stated without a number precisely so it does
  // not rot. Executed against every effort signal the scorer reads.
  {
    const effort = [
      { clientPhotos: [{ url: "a.jpg" }, { url: "b.jpg" }, { url: "c.jpg" }, { url: "d.jpg" }] },
      { clientPhotos: [{ url: "plan.pdf" }] },
      { kitchenDesign: { walls: [] } },
      { message: "x".repeat(400) },
    ];
    const hottest = effort.map((l) => scoreLead(l));
    ok(
      "no single effort signal reaches hot on its own",
      hottest.every((r) => r.temperature !== "hot"),
      hottest.map((r) => `${r.temperature}:${r.score}`).join(","),
    );
    // ...and each of them is genuinely counted, or the sentence above would be
    // true for the boring reason.
    ok("...while each of them still counts for something",
      hottest.every((r) => r.score > 0), hottest.map((r) => r.score).join(","));
  }

  // ── The reasons are readable, which is the whole argument ────────────────
  {
    const rich = scoreLead({
      timeline: soonest,
      budgetBand: biggestBudget,
      phone: "+15550000000",
      email: "someone@example.com",
      message: "x".repeat(200),
    });
    ok("a scored lead comes back with its reasons", rich.reasons.length >= 4, rich.reasons.length);
    ok(
      "...every one a sentence a person can read, not a key",
      rich.reasons.every(
        (r) => typeof r.label === "string" && /\s/.test(r.label) && !/_/.test(r.label),
      ),
      rich.reasons.map((r) => r.label).join(" | "),
    );
    ok("...each carrying the points it added", rich.reasons.every((r) => typeof r.weight === "number"));
    ok("...heaviest first, so the top line is the reason that decided it",
      rich.reasons.every((r, i) => i === 0 || r.weight <= rich.reasons[i - 1].weight));
    // Pure, and pure is what lets the same lead be re-scored later with the
    // same answer — which is what "change the answer and the temperature
    // follows" depends on.
    ok("scoring the same lead twice gives the same answer",
      JSON.stringify(scoreLead({ timeline: soonest, phone: "1" })) ===
        JSON.stringify(scoreLead({ timeline: soonest, phone: "1" })));
    ok("the page says the reasons are shown with their points",
      /the points it added/i.test(text));
    ok("...and that changing the answer moves the temperature",
      /change the answer on the lead and the temperature follows/i.test(text));
  }

  ok(`there are three bands and the page names all of them (${TEMPERATURES.join("/")})`,
    TEMPERATURES.length === 3 && TEMPERATURES.every((t) => new RegExp(`\\b${t}\\b`, "i").test(text)));

  // ── The ban ──────────────────────────────────────────────────────────────
  //
  // These forbid ASSERTIONS, not the words. The page is allowed — required,
  // in fact — to say "there is no model here", and a checker that banned the
  // noun outright would force the honest sentence out of the copy.
  const NOT_A_MODEL = [
    [/machine learning/i, "machine learning"],
    [/\bneural\b/i, "a neural anything"],
    [/trained on/i, "training"],
    [/training data/i, "training data"],
    [/predictive model/i, "a predictive model"],
    [/our model\b/i, "a model of ours"],
    [/the model (scores|decides|predicts|learns)/i, "a model doing the deciding"],
    [/\bAI[- ]?(scored?|scoring|score)\b/i, "an AI score"],
    [/scored by (the |our )?AI/i, "scoring by AI"],
    [/AI (decides|works out|assesses|ranks)/i, "AI making the call"],
    [/learns (from|about) (your|you)/i, "something that learns"],
    [/gets smarter/i, "something that gets smarter"],
  ];
  for (const [pattern, what] of NOT_A_MODEL) {
    const hits = surfaces.filter(([, body]) => pattern.test(body)).map(([where]) => where);
    ok(`nothing describes the triage as ${what}`, hits.length === 0, hits.join(" "));
  }
  ok("...and the leads page says outright that there is no model",
    /no model|not a model/i.test(text));
  // No point value in the copy. A weight printed on a marketing page is a
  // number nobody re-checks when the weight moves.
  ok("no point value is printed on the page", !/\b\d+\s*points?\b/i.test(text), text.match(/\b\d+\s*points?\b/i)?.[0]);

  // ── "Everything is triaged the same way" ─────────────────────────────────
  //
  // The claim is that one function triages every inbound path, so "hot" means
  // the same thing whatever door the enquiry came through. lib/leads/createLead
  // exists for exactly that reason; this asserts every door named on the page
  // actually goes through it.
  const DOORS = [
    ["the form on your site", "app/api/leads/public/route.js"],
    ["an instant estimate", "app/api/instant-quote/[companySlug]/request/route.js"],
    ["a kitchen somebody drew", "app/api/self-quote/kitchen/route.js"],
    ["a multi-step funnel", "app/api/funnels/public/[companySlug]/[funnelSlug]/submit/route.js"],
    ["a call the receptionist took", "app/api/voice/tools/[tool]/route.js"],
    ["the list you import", "app/api/leads/import/route.js"],
  ];
  for (const [what, path] of DOORS) {
    ok(`"${what}" really goes through the one triage`,
      /\bcreateScoredLead\b/.test(readFileSync(path, "utf8")), path);
  }
  // Case-insensitive: one of them opens the sentence and is capitalised.
  const lower = text.toLowerCase();
  ok("...and the page claims exactly those doors",
    DOORS.every(([what]) => lower.includes(what.toLowerCase())),
    DOORS.filter(([what]) => !lower.includes(what.toLowerCase())).map(([w]) => w).join(" | "));
  ok("createLead is what does the scoring, not each door for itself",
    /\bscoreLead\b/.test(readFileSync("lib/leads/createLead.js", "utf8")));
}

/* ═══════════════════════════════════════════════════════════════════════════
   10. The funnels page, against the funnel
   ═══════════════════════════════════════════════════════════════════════════

   Two claims on that page are worth more than the rest of it and both are
   checkable: that a funnel is built from a CLOSED set of screen kinds, and
   that the numbers are per step rather than one conversion rate. The third is
   a rule rather than a feature — non-negotiable #5, the browser never sends a
   measurement or a price — and the estimate endpoint's body reads are what
   make it true. */

console.log("\n── Funnels: a closed set of screens, and per-step numbers ──────\n");

{
  const { text } = rendered.get("lead-funnels");
  const analytics = readFileSync("app/api/funnels/[id]/analytics/route.js", "utf8");
  const screen = readFileSync("app/app/funnels/[id]/page.js", "utf8");
  const blocks = readFileSync("app/data/funnelBlocks.js", "utf8");
  const estimate = readFileSync(
    "app/api/funnels/public/[companySlug]/[funnelSlug]/estimate/route.js",
    "utf8",
  );

  // The sentence "there is nothing else to put on one" is only true while the
  // list is closed and is the length the copy enumerates. Add a kind and this
  // fails, which is the prompt to update the sentence.
  ok(`a funnel is built from a closed set of screens (${FUNNEL_STEP_KINDS.length})`,
    FUNNEL_STEP_KINDS.length === 7, FUNNEL_STEP_KINDS.join(","));
  ok("...and the page says the list is closed", /nothing else to put on one/i.test(text));

  // Branching, which the page promises.
  ok("an answer can name the screen that comes next", /next:/.test(blocks));
  ok("...and the funnel actually follows it", /goNext\(answer\?\.next\)/.test(
    readFileSync("app/f/[companySlug]/[funnelSlug]/FunnelRunner.js", "utf8")));
  ok("...as the page says", /send somebody straight to a different screen/i.test(text));

  // The numbers. Four of them, and the per-step one is the point.
  for (const key of ["starts", "completions", "conversionRate", "retention"]) {
    ok(`the funnel report carries ${key}`, new RegExp(`${key}:`).test(analytics));
  }
  ok("retention is measured against the PREVIOUS step, not the first",
    /views \/ prev/.test(analytics));
  ok("...and the screen the contractor opens draws it per step",
    /analytics\.steps\.map/.test(screen) && /s\.retention/.test(screen));
  ok("the page promises per-screen numbers rather than one rate",
    /A per-screen number tells you which screen/i.test(text));

  // Non-negotiable #5, on the one public endpoint that prices anything here.
  // The body is allowed to carry two ids and nothing else — no measurement, no
  // money — and the measurement behind a band is read from the stored funnel.
  {
    const reads = [...new Set([...estimate.matchAll(/\bbody\.([A-Za-z0-9_]+)/g)].map((m) => m[1]))].sort();
    ok("the estimate endpoint reads only a step id and a band id from the visitor",
      JSON.stringify(reads) === JSON.stringify(["bandId", "stepId"]), reads.join(","));
    ok("...and looks the size up in the company's own stored funnel",
      /resolveEstimateBand\(step, body\.bandId\)/.test(estimate));
    ok("...which is what the page tells the reader",
      /nothing typed into the page decides it/i.test(text));
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   11. The 29 the pricing page names, and the page behind each one
   ═══════════════════════════════════════════════════════════════════════════

   The failure this section exists to stop is the most expensive one on the
   site and the least visible: /pricing lists a feature by name, somebody reads
   the name, hands over a card, and there is nothing on the site that says what
   that name actually gets them — or worse, the page saying it is not the page
   the link goes to. A pricing row is what somebody buys on.

   ══ Why a source read is allowed here ═════════════════════════════════════

   PRICING_FEATURES in app/data/featurePages.js is a SECOND COPY of
   HEADLINE_FEATURES in app/(marketing)/pricing/PricingPlans.js. Duplication is
   the recurring failure class this repo keeps finding, and the copy is always
   the one that rots — so the copy is only allowed to exist because the line
   below reads the pricing page and fails when the two disagree, in order as
   well as in content. The pricing surface belongs to another file; asserting
   against it beats guessing at it.

   Everything else in this section is asserted against RENDERED markup, the way
   the rest of the file is: it is not enough for the data to say a page is the
   page for a feature, the page has to actually say so where a visitor reads. */

console.log("\n── The pricing page's 29, each with a page ─────────────────────\n");

{
  const pricingSrc = decomment(
    readFileSync("app/(marketing)/pricing/PricingPlans.js", "utf8"),
  );
  const start = pricingSrc.indexOf("const HEADLINE_FEATURES");
  const block = start < 0 ? "" : pricingSrc.slice(start, pricingSrc.indexOf("\n];", start));
  const namedOnPricing = [...block.matchAll(/keys:\s*\[([^\]]*)\]/g)].flatMap((m) =>
    [...m[1].matchAll(/"([a-z_]+)"/g)].map((x) => x[1]),
  );

  ok("the pricing page's own feature list can still be read", namedOnPricing.length > 0);
  ok(
    `/features carries the same list, in the same order (${namedOnPricing.length})`,
    JSON.stringify(namedOnPricing) === JSON.stringify([...PRICING_FEATURES]),
    `pricing=${namedOnPricing.join(",")} pages=${PRICING_FEATURES.join(",")}`,
  );
  ok(
    "every name on the pricing page is a proved matrix claim",
    namedOnPricing.every((k) => matrixEntry(k) !== undefined),
    namedOnPricing.filter((k) => !matrixEntry(k)).join(" "),
  );
}

// One page each, and the page says which one it is.
for (const key of PRICING_FEATURES) {
  const entry = matrixEntry(key);
  const page = canonicalPageFor(key);
  if (!ok(`"${entry?.name || key}" has a page`, !!page)) continue;

  const { html, text } = rendered.get(page.slug) || {};
  ok(`...at /features/${page.slug}, and it renders`, (text?.length || 0) > 800, `${text?.length}`);
  // Quoted back in the matrix's own words, which is the string a translation
  // layer will replace — not a hand-typed copy of it sitting in the page data.
  ok(`...naming it as "${entry.name}"`, text.includes(entry.name));
  // And naming it ABOVE THE HEADLINE, not somewhere down the page. The first
  // draft of this assertion only asked whether the name appeared anywhere, and
  // passed happily with the hero label deleted — the name was still in the
  // "What you get" list further down. A visitor who arrived from a pricing row
  // has to see the words they clicked before they see anything else.
  ok(
    `...in the line above the headline`,
    textOf(html.slice(0, html.indexOf("<h1"))).includes(entry.name),
    textOf(html.slice(0, html.indexOf("<h1"))).slice(-60),
  );
  ok(`...and claiming it`, page.features.includes(key));
  ok(`...with its own summary on the page`, text.includes(entry.summary));
}

{
  const canonical = FEATURE_PAGES.filter((p) => p.feature);
  ok(
    `exactly ${PRICING_FEATURES.length} pages are the page for something`,
    canonical.length === PRICING_FEATURES.length,
    `${canonical.length}`,
  );
  const doubles = canonical
    .map((p) => p.feature)
    .filter((k, i, a) => a.indexOf(k) !== i);
  ok("no feature has two pages claiming to be its page", doubles.length === 0, doubles.join(" "));
  ok(
    "nothing is canonical for a feature the pricing page does not name",
    canonical.every((p) => PRICING_FEATURES.includes(p.feature)),
    canonical.filter((p) => !PRICING_FEATURES.includes(p.feature)).map((p) => p.slug).join(" "),
  );
  // The index is the second way in, and it has to reach all of them — from the
  // DIRECTORY at the top, not merely from somewhere on the page. Deleting the
  // directory left eighteen of these green, because eighteen of the twenty-nine
  // names also read as an area card's label further down; the region is
  // therefore narrowed to everything above the second heading.
  const directory = indexHtml.slice(0, indexHtml.indexOf("Or by the part of the job"));
  const directoryText = textOf(directory);
  ok("the index opens with the directory of what /pricing names", directory.length > 500, `${directory.length}`);
  for (const key of PRICING_FEATURES) {
    const page = canonicalPageFor(key);
    ok(
      `the index lists "${matrixEntry(key).name}" and links its page`,
      directoryText.includes(matrixEntry(key).name) &&
        directory.includes(`href="/features/${page.slug}"`),
    );
  }
}

/* The specifics. A page that is THE page for a feature and says only what the
   pricing row already said is a bullet with a URL — it is also the page that
   has no picture, so this list is what carries it. Every line was read out of
   the files that entry names in `proof`, and the point of asserting the RENDER
   is that a details block nobody prints is worth nothing. */

console.log("\n── Each of the 29 says more than its own pricing row ───────────\n");

for (const key of PRICING_FEATURES) {
  const page = canonicalPageFor(key);
  if (!page) continue;
  const { text } = rendered.get(page.slug);

  ok(`/features/${page.slug} carries at least three specifics`, (page.details?.length || 0) >= 3, `${page.details?.length}`);
  const labels = (page.details || []).map((d) => d.label);
  ok(`...with no two the same`, new Set(labels).size === labels.length);
  const unrendered = (page.details || []).filter(
    (d) => !text.includes(d.label) || !text.includes(d.body),
  );
  ok(`...and every one of them printed`, unrendered.length === 0, unrendered.map((d) => d.label).join(" | "));
  // Worth reading, not padding: a specific is a sentence, not a restatement of
  // the label. 60 is the shortest real one on the page set today.
  const thin = (page.details || []).filter((d) => d.body.trim().length < 60);
  ok(`...each one an actual sentence`, thin.length === 0, thin.map((d) => d.label).join(" | "));
}

/* A partial feature's own page has to state where it stops — the generic
   assertion in section 3 covers "somewhere on some page", and that is not the
   same promise. The page a pricing row sends you to is the one that has to say
   it, in the matrix's exact words, because the words are what a translation
   layer replaces and a paraphrase would drift from them. */
for (const entry of partialFeatures()) {
  const page = canonicalPageFor(entry.key);
  if (!page) continue; // not one of the 29; section 3 already covers it.
  const { text } = rendered.get(page.slug);
  ok(`/features/${page.slug} states where "${entry.name}" stops`, text.includes(entry.limits));
  ok(`...and labels it as a limit rather than a feature`, /Where this stops/.test(text));
}

/* The hub half. A page that lists a feature and does not link the page about it
   is a dead end for the visitor who wanted exactly that thing — and the strip
   is derived, so this asserts the derivation actually reaches the markup. */

console.log("\n── Group pages hand off to the pages under them ────────────────\n");

{
  const missed = [];
  let linked = 0;
  for (const page of FEATURE_PAGES) {
    for (const sibling of moreInThisArea(page.slug)) {
      linked++;
      const { html, text } = rendered.get(page.slug);
      if (!html.includes(`href="/features/${sibling.slug}"`)) {
        missed.push(`${page.slug} → ${sibling.slug}`);
      } else if (!text.includes(sibling.entry.name)) {
        missed.push(`${page.slug} → ${sibling.slug} (unnamed)`);
      }
    }
  }
  ok(`every bundled feature links its own page (${linked} links)`, missed.length === 0, missed.join(" "));
  ok("...and there are real hubs doing it", linked >= 10, `${linked}`);
  // The pure hubs: pages that sell an area and are nobody's canonical page.
  const hubs = FEATURE_PAGES.filter((p) => !p.feature);
  ok("the older area pages are still here, not orphaned", hubs.length > 0, `${hubs.length}`);
  for (const hub of hubs) {
    ok(
      `/features/${hub.slug} still renders and still links onward`,
      rendered.get(hub.slug).text.length > 800 &&
        rendered.get(hub.slug).html.includes('href="/features/'),
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   12. Pictures of things that exist
   ═══════════════════════════════════════════════════════════════════════════

   public/marketing holds four product screenshots and no more can be made —
   the back office is behind a login. So the risks here are not "is it pretty":
   a src pointing at a file that is not there renders a broken frame on a page
   selling reliability, and an image on the wrong page is a claim, because a
   reader takes a screenshot as evidence of the thing described beside it.

   Two of the four are misnamed and their own alt text in the catalogue says so,
   which is why the alt is checked against a REAL catalogue key rather than
   being written fresh here — the four alts are already translated into all six
   languages, so an image is the one part of these pages that is not
   English-only. */

console.log("\n── Every picture is a file, and every alt a real key ───────────\n");

{
  const used = [];
  for (const page of FEATURE_PAGES) {
    for (const [where, img] of [["hero", page.image], ["inline", page.inlineImage]]) {
      if (!img) continue;
      used.push(`${page.slug}:${where}`);
      const path = `public${img.src}`;
      ok(`/features/${page.slug} ${where} image is a file that exists`, existsSync(path), path);
      ok(`...with a caption`, !!img.caption?.trim());
      ok(`...and alt text`, !!img.alt?.trim());
      // next/image rewrites the src into its own URL, so look for either form.
      const { html, text } = rendered.get(page.slug);
      ok(
        `...actually rendered on the page`,
        html.includes(img.src) || html.includes(encodeURIComponent(img.src)),
      );
      ok(`...with the alt in the markup`, html.includes(img.alt.slice(0, 40)));
      ok(`...and the caption where a reader can see it`, text.includes(img.caption));
    }
  }
  ok("some page does carry a real screenshot", used.length >= 3, used.join(" "));

  // Every alt hangs off a key that already exists in the English catalogue, so
  // the day these pages get a translation context there is nothing to write.
  const catalogue = readFileSync("app/i18n/messages.js", "utf8");
  for (const page of FEATURE_PAGES) {
    for (const img of [page.image, page.inlineImage]) {
      if (!img) continue;
      ok(
        `${page.slug} alt hangs off the existing key ${img.altKey}`,
        catalogue.includes(`"${img.altKey}":`),
      );
    }
  }

  // Nothing anywhere in the page set points at an image that is not on disk.
  const srcs = [
    ...new Set(
      FEATURE_PAGE_SLUGS.flatMap((s) => [
        ...rendered.get(s).html.matchAll(/url=([^&"]+)/g),
      ].map((m) => decodeURIComponent(m[1]))),
    ),
  ].filter((s) => s.startsWith("/"));
  const broken = srcs.filter((s) => !existsSync(`public${s}`));
  ok("no rendered picture points at a missing file", broken.length === 0, broken.join(" "));
}

/* One colour rule, stated as an assertion rather than as an intention.

   lib/documents/theme.js exists because contrast has to be measured, and it
   measures a CONTRACTOR's brand colour. These pages are not branded by anybody
   — they are FieldQuo's own marketing, painted from the design tokens, which
   are already light-and-dark aware and already measured where they are
   defined. The way these pages stay correct in both themes is therefore by
   introducing no colour of their own, and that is the thing worth asserting:
   a raw hex or an arbitrary colour value on one of these three files is a pair
   nobody measured, in one theme only. */
{
  const owned = [
    ["app/(marketing)/features/[slug]/page.js"],
    ["app/(marketing)/features/[slug]/FeaturePageContent.js"],
    ["app/(marketing)/features/page.js"],
    ["app/(marketing)/features/FeaturesIndexContent.js"],
    ["app/data/featurePages.js"],
  ].map(([p]) => [p, decomment(readFileSync(p, "utf8"))]);

  for (const [where, body] of owned) {
    const hexes = [...body.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => m[0]);
    ok(`${where} introduces no colour of its own`, hexes.length === 0, hexes.join(" "));
    const arbitrary = [...body.matchAll(/\b(?:text|bg|border)-\[[^\]]+\]/g)].map((m) => m[0]);
    ok(`...and no hand-picked colour value`, arbitrary.length === 0, arbitrary.join(" "));
  }
}


/* ═══════════════════════════════════════════════════════════════════════════
   12. THE SIX LANGUAGES
   ═══════════════════════════════════════════════════════════════════════════

   The owner opened https://www.fieldquo.com/features/quotes and
   /features/quote-from-the-call and said they have no translations. He was
   right. A previous pass translated feature NAMES and SUMMARIES through
   lib/marketing/featureLabels.js and fixed /pricing; app/data/featurePages.js —
   the headline, the one-liner, the pains, the how, and 164 details across 37
   pages — stayed English, so a French visitor got a translated page title over
   entirely English prose. That is the SAME bug the label layer was written to
   fix, one route over, and half-translated reads as broken software rather than
   as untranslated software.

   Everything above this line is about English. Everything below is about the
   other five, and the load-bearing part is section 12d: the real pages are
   rendered in each language and searched for English that should not have
   survived. A regex over source cannot see that failure — an agent in this
   repo had seventy-five source assertions pass green while the page ignored the
   function they all tested. So the pages are executed.
   ═══════════════════════════════════════════════════════════════════════════ */

const OTHER = LANGUAGES.map((l) => l.code).filter((c) => c !== DEFAULT_LANGUAGE);
const said_ = (language, key) => String(MESSAGES[language]?.[key] ?? "");

/* ── The prose that is legitimately still English ──────────────────────────

   Deliberately bounded, and bounded the way featureLabels.js already bounds
   its own: by NAME, with the reason, and with an assertion that the exemption
   is still describing the string it was written for. A one-word label whose
   Tagalog IS the English word is honest — Filipino tradespeople say "dashboard"
   and "payroll", and the shipped catalogue already writes them that way. A
   whole SENTENCE left in English is a forgotten key wearing the loanword
   argument, so no exemption may cover anything longer than a short label.

   Three, all Tagalog, all page LABELS of one or two words, all named by the
   translator rather than found by this check afterwards. Each is asserted below
   to still be identical to the English it was written for, so it cannot quietly
   outlive the string it excuses, and no exemption may cover anything longer
   than thirty characters — a paragraph left in English is a forgotten key
   wearing the loanword argument. */
const KEPT_AS_ENGLISH = [
  {
    language: "tl",
    key: "featurePage.fieldquo-ai.label",
    reason:
      "The value is 'FieldQuo AI' — a brand name and an acronym, both on the " +
      "do-not-translate list. There is no Tagalog to write here that would not " +
      "be renaming the product. The page's other 88 strings are Tagalog.",
  },
  {
    language: "tl",
    key: "featurePage.invoicing.label",
    reason:
      "'Invoicing' is what a Filipino tradesperson says, and the shipped " +
      "catalogue already ships it untranslated (app/i18n/messages.js renders " +
      "'Invoicing' in the Tagalog product menu). Translating it here would make " +
      "this page disagree with the navigation above it.",
  },
  {
    language: "tl",
    key: "featurePage.marketing.label",
    reason:
      "Same argument. 'Marketing' is the word; the alternative is a coinage " +
      "('pagmemerkado') that no contractor uses, which would be writing worse " +
      "Tagalog to satisfy an assertion.",
  },
];
const exemptProse = (language, key) =>
  KEPT_AS_ENGLISH.some((x) => x.language === language && x.key === key);

console.log("\n── 12a. Every string, every page, every language ───────────────\n");

// The three lists of keys this file reasons about, each derived from the data
// rather than typed here, so adding a page or a detail grows all three at once.
const PROSE_KEYS = [...FEATURE_PAGE_TEXT_KEYS];
const CHROME_KEYS = Object.keys(MESSAGES.en).filter(
  (k) => k.startsWith("featurePage.chrome.") || k.startsWith("featuresIndex."),
);
const ALL_PAGE_KEYS = [
  ...PROSE_KEYS,
  ...CHROME_KEYS,
  ...FEATURE_GROUP_KEYS,
  ...FEATURE_LIMIT_KEYS,
];

ok(
  `the pages carry prose to translate (${PROSE_KEYS.length} strings)`,
  PROSE_KEYS.length > 900,
  PROSE_KEYS.length,
);
ok(
  "...and the key list is exactly what the pages hold",
  PROSE_KEYS.length ===
    FEATURE_PAGES.reduce((n, p) => n + featurePageStrings(p).length, 0),
);
ok(`...plus the page furniture (${CHROME_KEYS.length})`, CHROME_KEYS.length >= 25, CHROME_KEYS.length);
ok(`...the four group headings (${FEATURE_GROUP_KEYS.length})`, FEATURE_GROUP_KEYS.length === 8);
ok(
  `...and the ${FEATURE_LIMIT_KEYS.length} caveats that used to be English under a translated name`,
  FEATURE_LIMIT_KEYS.length === LIMIT_KEYS.length && FEATURE_LIMIT_KEYS.length >= 8,
  FEATURE_LIMIT_KEYS.length,
);
ok("no key is claimed twice", new Set(ALL_PAGE_KEYS).size === ALL_PAGE_KEYS.length);

for (const language of LANGUAGES.map((l) => l.code)) {
  const dict = MESSAGES[language] || {};
  const missing = ALL_PAGE_KEYS.filter(
    (k) => typeof dict[k] !== "string" || !dict[k].trim(),
  );
  ok(
    `${language}: all ${ALL_PAGE_KEYS.length} strings present`,
    missing.length === 0,
    `${missing.length} missing, e.g. ${missing.slice(0, 5).join(" ")}`,
  );
}

console.log("\n── 12b. English is the data module, not a second opinion ───────\n");

/* The English block in the catalogue exists only because
   scripts/check-translations.mjs compares every language against the KEYS OF
   ENGLISH — a key in Ukrainian and absent from English is reported as "not in
   English" and fails the run. So it is a duplicate, and an unpinned duplicate is
   worse than no duplicate: /features/quotes would say one thing and the 1043
   assertions above would be proving another. Pinned character by character. */
{
  const drifted = [];
  for (const page of FEATURE_PAGES) {
    for (const { field, english } of featurePageStrings(page)) {
      const key = featurePageKey(page.slug, field);
      if (MESSAGES.en[key] !== english) drifted.push(key);
    }
  }
  ok(
    "every English page string is character-identical to app/data/featurePages.js",
    drifted.length === 0,
    `${drifted.length}: ${drifted.slice(0, 5).join(" ")}`,
  );
}
{
  const drifted = [];
  for (const g of MATRIX_GROUPS) {
    if (MESSAGES.en[featureGroupKey(g.key, "label")] !== g.label) drifted.push(`${g.key}.label`);
    if (MESSAGES.en[featureGroupKey(g.key, "blurb")] !== g.blurb) drifted.push(`${g.key}.blurb`);
  }
  for (const key of LIMIT_KEYS) {
    if (MESSAGES.en[featureLabelKey(key, "limits")] !== matrixEntry(key).limits) {
      drifted.push(`${key}.limits`);
    }
  }
  ok(
    "every English heading and caveat is character-identical to the matrix",
    drifted.length === 0,
    drifted.slice(0, 5).join(" "),
  );
}

/* Both directions. A page string with no catalogue key is 12a. This is the
   other one: a `featurePage.*` key naming a page or a field that does not
   exist. Left unchecked, deleting a detail from a page would strand six
   translations of it, and renaming a slug would strand ninety — silently, in
   five languages nobody in-house reads. */
{
  const legitimate = new Set(PROSE_KEYS);
  const orphans = [];
  for (const language of LANGUAGES.map((l) => l.code)) {
    for (const key of Object.keys(MESSAGES[language])) {
      if (!key.startsWith("featurePage.")) continue;
      if (key.startsWith("featurePage.chrome.")) continue;
      if (!legitimate.has(key)) orphans.push(`${language}/${key}`);
    }
  }
  ok(
    "no catalogue key names a page or a field that does not exist",
    orphans.length === 0,
    `${orphans.length}: ${orphans.slice(0, 5).join(" ")}`,
  );
  // And the shape of the key is decided in one place, so a call site that typed
  // it by hand would work today and rot the first time the prefix moved.
  ok(
    "the key shape comes from featurePageKey()",
    featurePageKey("quotes", "headline") === "featurePage.quotes.headline" &&
      featurePageKey("ai-quote-review", "pain.2.fix") ===
        "featurePage.ai-quote-review.pain.2.fix",
  );
}

console.log("\n── 12c. Nothing was left in English, and the two alphabets ─────\n");

{
  const untranslated = [];
  for (const language of OTHER) {
    for (const key of ALL_PAGE_KEYS) {
      const said = said_(language, key).trim();
      if (said && said === String(MESSAGES.en[key]).trim() && !exemptProse(language, key)) {
        untranslated.push(`${language}/${key}`);
      }
    }
  }
  ok(
    "no string is still its English original",
    untranslated.length === 0,
    `${untranslated.length}: ${untranslated.slice(0, 8).join(" ")}`,
  );
}
// A stale exemption is a hole with a comment on it.
for (const x of KEPT_AS_ENGLISH) {
  ok(
    `the ${x.language}/${x.key} exemption is still the case`,
    said_(x.language, x.key).trim() === String(MESSAGES.en[x.key]).trim(),
    said_(x.language, x.key),
  );
  ok("...and says why in more than a word", x.reason.trim().length >= 40);
  // Length is the discriminator. A loanword is a NAME; a paragraph left in
  // English is a forgotten key, whatever reason is attached to it.
  ok(
    "...and covers a label, not a paragraph",
    String(MESSAGES.en[x.key]).trim().length <= 30,
    String(MESSAGES.en[x.key]).length,
  );
}
ok("the exemption list is short enough to read", KEPT_AS_ENGLISH.length <= 8, KEPT_AS_ENGLISH.length);

/* Ukrainian and Punjabi do not share an alphabet with English, so "is this
   translated" is answerable without judgement: the string must carry its own
   script. That is the cheap, total version of the assertion above for two of
   the five — an English line copied into the Ukrainian block fails here even if
   somebody changed one word so it no longer matches the original exactly. */
const SCRIPTS = {
  uk: { name: "Cyrillic", re: /[Ѐ-ӿ]/ },
  pa: { name: "Gurmukhi", re: /[਀-੿]/ },
};
for (const [language, script] of Object.entries(SCRIPTS)) {
  const wrong = ALL_PAGE_KEYS.filter((k) => !script.re.test(said_(language, k)));
  ok(
    `${language}: every string is written in ${script.name}`,
    wrong.length === 0,
    `${wrong.length}: ${wrong.slice(0, 5).join(" ")}`,
  );
}
/* The Latin that IS allowed in those two blocks: product names, brands, file
   formats and the tax acronyms this market actually uses. Anything else is an
   English fragment that survived a paragraph. Bounded the same way
   featureLabels.js bounds its own list — a fixed allowlist, asserted, so it
   cannot grow into "any English word is fine". */
{
  const ALLOWED = new Set([
    // Companies and products, ours and other people's.
    "FieldQuo", "Stripe", "Affirm", "Instagram",
    // File formats.
    "PDF", "AI",
    // Statutory programmes, which are proper names in every language. Nobody
    // files their "ПФК" return; the form says CPP.
    "CPP", "EI", "Social", "Security", "Medicare",
    // The document-number prefixes the product itself prints. Translating the
    // example would show a Ukrainian reader a number the software will never
    // produce, which is worse than leaving it in Latin.
    "Q", "INV",
  ]);
  const strays = [];
  for (const language of Object.keys(SCRIPTS)) {
    for (const key of ALL_PAGE_KEYS) {
      // {count} is markup, not prose — scanning it would report the word
      // "count" as surviving English in every language that has a plural.
      const said = said_(language, key).replace(/\{\w+\}/g, " ");
      for (const run of said.match(/[A-Za-z][A-Za-z']*/g) || []) {
        if (!ALLOWED.has(run)) strays.push(`${language}/${key}: ${run}`);
      }
    }
  }
  ok(
    "...and the only Latin left in them is a brand, a format or a statutory name",
    strays.length === 0,
    `${strays.length}: ${strays.slice(0, 8).join(" ")}`,
  );
  ok("the allowlist is short enough to read", ALLOWED.size <= 40, ALLOWED.size);
  // And it cannot grow into fiction: every token on it has to be a word the
  // ENGLISH pages actually contain. An allowlist that can be extended with
  // anything is not a bound, it is a comment.
  {
    const words = new Set(
      ALL_PAGE_KEYS.map((k) => String(MESSAGES.en[k] ?? "")).join(" ").match(/[A-Za-z][A-Za-z']*/g) || [],
    );
    const unused = [...ALLOWED].filter((w) => !words.has(w));
    ok("every allowlisted word is one the English pages really use", unused.length === 0,
      unused.join(" "));
  }
}

console.log("\n── 12d. The resolution: catalogue, then English, never a key ───\n");

{
  // No translator at all — the path generateMetadata takes, because metadata is
  // what a crawler indexes and a French <title> served because the last visitor
  // switched languages is worse than an English one. Same strings as before any
  // of this existed.
  const bare = featurePageCopy("quotes");
  const raw = featurePage("quotes");
  ok("no translator at all is the English data module, unchanged",
    bare.headline === raw.headline && bare.pains[0].pain === raw.pains[0].pain);

  // The fallback, exercised rather than described. A t() that resolves nothing
  // is exactly what a language with a hole in it does, and it must hand back
  // the English sentence the 1043 assertions above proved — never the key.
  const nothingResolves = (key, fallback) => fallback;
  const holed = featurePageCopy("quotes", nothingResolves);
  ok("a language with no entry gets the English prose",
    holed.headline === raw.headline && holed.details[0].body === raw.details[0].body);
  ok("...never the catalogue key itself",
    !/^featurePage\./.test(holed.headline) && !/^featurePage\./.test(holed.oneLine));
  ok("...for every field on every page",
    FEATURE_PAGES.every((p) => {
      const c = featurePageCopy(p.slug, nothingResolves);
      return (
        c.label === p.label &&
        c.headline === p.headline &&
        c.oneLine === p.oneLine &&
        c.description === p.description &&
        c.pains.every((x, i) => x.pain === p.pains[i].pain && x.fix === p.pains[i].fix) &&
        c.how.every((x, i) => x.step === p.how[i].step && x.body === p.how[i].body) &&
        (c.details || []).every(
          (x, i) => x.label === p.details[i].label && x.body === p.details[i].body,
        )
      );
    }));

  // And with a t() that DOES resolve, the catalogue wins.
  const uk = (key, fallback) => MESSAGES.uk[key] ?? fallback;
  const said = featurePageCopy("quotes", uk);
  ok("a language with an entry gets the entry",
    said.headline === MESSAGES.uk["featurePage.quotes.headline"] &&
      said.pains[1].fix === MESSAGES.uk["featurePage.quotes.pain.2.fix"]);
  ok("featurePageLabel is the same resolution, not a second one",
    featurePageLabel("quotes", uk) === said.label);

  // The image alt was a field written and read by nothing: every image carries
  // `altKey`, an existing catalogue key translated into all six, and the
  // renderer printed the English `alt` beside it.
  ok("an image alt resolves through its altKey",
    said.image.alt === MESSAGES.uk[raw.image.altKey] && said.image.alt !== raw.image.alt);

  ok("an unknown slug is refused, not improvised", featurePageCopy("not-a-feature", uk) === undefined);
  ok("...and featurePageLabel refuses it too", featurePageLabel("not-a-feature", uk) === undefined);

  // The limits gap featureLabels.js named and left open.
  const financing = featureEntry("financing", uk);
  ok("a partial feature's caveat is translated too",
    financing.limits === MESSAGES.uk["feature.financing.limits"] &&
      financing.limits !== matrixEntry("financing").limits);
  // 68 of the 76 matrix entries carry `limits: null`. Resolved anyway, t()
  // would hand back the KEY for a language that has no such entry — a page
  // printing "Where this stops: feature.quotes.limits" under a feature that
  // stops nowhere. Exercised with a t() that behaves the way the real one does
  // on a miss (fallback, then the key), because a test double that returns the
  // fallback would pass with the guard removed.
  const keyish = (key, fallback) => MESSAGES.uk[key] ?? fallback ?? key;
  ok("...and a feature with no caveat gains no empty one",
    featureEntry("quotes", keyish).limits === matrixEntry("quotes").limits &&
      !featureEntry("quotes", keyish).limits,
    String(featureEntry("quotes", keyish).limits));
  ok("a group heading resolves through the layer",
    featureGroup("winning_work", uk).label === MESSAGES.uk["featureGroup.winning_work.label"]);
  ok("...and with no translator is the matrix's own",
    featureGroup("winning_work").label === MATRIX_GROUPS[0].label);
}

console.log("\n── 12e. THE RENDER — five languages, no English left standing ──\n");

/* The assertion the bug report is about, and the only one that can see it.
   Everything above is about strings in a file; the failure the owner saw was on
   a page, because the RENDERER decides which of two sources it reads. So the
   real pages are executed in each language and the output is searched for the
   English that should not have survived. */

// Rendered once per language, up front, so a page that throws in Punjabi fails
// loudly here rather than thirty-seven times quietly.
const byLanguage = new Map();
for (const language of OTHER) {
  const pages = new Map();
  for (const slug of FEATURE_PAGE_SLUGS) {
    pages.set(slug, textOf(await renderPage(slug, language)));
  }
  const index = textOf(
    renderToStaticMarkup(
      createElement(
        LanguageProvider,
        { initialLanguage: language },
        createElement(FeaturesIndexPage),
      ),
    ),
  );
  byLanguage.set(language, { pages, index });
}

/* What counts as "English prose that survived".

   Short strings are useless as evidence — "Quotes" appears inside a French
   sentence about a "soumission" for reasons that have nothing to do with a
   missing translation, and a two-word detail label can legitimately coincide.
   So the search is over the SUBSTANTIAL English on each page: every string of
   40 characters or more. Those are the sentences, and a sentence appearing
   verbatim in a French render is not a coincidence — it is the bug. */
/* Whitespace, normalised on BOTH sides before comparing.

   textOf() collapses runs of whitespace in the rendered markup, and a French
   translation legitimately contains U+00A0 before a colon or inside guillemets
   — which \s matches, so the render says " :" where the catalogue says
   "\u00A0:". Comparing raw would fail on correct French and, worse, would never
   match at all — and a check that never matches passes for the wrong reason the
   moment somebody inverts it. */
const flat = (x) => String(x).replace(/\s+/g, " ").trim();

const substantial = (page) =>
  featurePageStrings(page)
    .map(({ field, english }) => ({ field, english }))
    // `description` is the only prose field this page does NOT render: it feeds
    // generateMetadata, which stays English on purpose — it is what a crawler
    // indexes, and serving a French <title> because the last visitor switched
    // languages is worse than an English one. Same decision as
    // /industries/[slug]. It is translated in the catalogue anyway so that the
    // day locale-prefixed routes land (docs/ROADMAP.md) nothing is outstanding,
    // and 12a holds it to the same coverage bar as everything else. Asserting
    // it appears in the markup would assert a thing that must not be true.
    .filter((x) => x.field !== "description" && x.english.length >= 40);

for (const language of OTHER) {
  const { pages, index } = byLanguage.get(language);

  // (a) Every page renders at all, and renders something.
  {
    const empty = FEATURE_PAGE_SLUGS.filter((s) => pages.get(s).length < 800);
    ok(`${language}: all ${FEATURE_PAGE_SLUGS.length} pages render real content`,
      empty.length === 0, empty.join(" "));
  }

  // (b) The translation is ON THE PAGE. Not "the catalogue has one" — this is
  //     the half no source assertion can reach, and the half that caught a page
  //     still importing the English module directly.
  {
    const absent = [];
    for (const page of FEATURE_PAGES) {
      const text = pages.get(page.slug);
      for (const { field } of substantial(page)) {
        const want = said_(language, featurePageKey(page.slug, field));
        if (want && !text.includes(flat(want))) absent.push(`${page.slug}.${field}`);
      }
    }
    ok(`${language}: every sentence on every page is printed in ${language}`,
      absent.length === 0, `${absent.length}: ${absent.slice(0, 6).join(" ")}`);
  }

  // (c) And the English is gone. This is the reported bug, stated as an
  //     assertion: a page whose title translated and whose body did not.
  {
    const survived = [];
    for (const page of FEATURE_PAGES) {
      const text = pages.get(page.slug);
      for (const { field, english } of substantial(page)) {
        if (exemptProse(language, featurePageKey(page.slug, field))) continue;
        if (text.includes(flat(english))) survived.push(`${page.slug}.${field}`);
      }
    }
    ok(`${language}: NO English page prose survives`,
      survived.length === 0, `${survived.length}: ${survived.slice(0, 6).join(" ")}`);
  }

  // (d) The bug was a MIXTURE, so the furniture is checked beside the prose. A
  //     page that translated its paragraphs and kept "What you get" in English
  //     is the same defect facing the other way.
  {
    const survived = CHROME_KEYS.filter((k) => {
      const en = String(MESSAGES.en[k]);
      if (en.length < 12 || /\{\w+\}/.test(en)) return false;
      return FEATURE_PAGE_SLUGS.some((s) => pages.get(s).includes(flat(en))) || index.includes(flat(en));
    });
    ok(`${language}: no English heading or button survives either`,
      survived.length === 0, survived.slice(0, 6).join(" "));
    const shown = ["painsTitle", "howTitle", "getTitle", "ctaTitle", "startTrial"].map(
      (n) => `featurePage.chrome.${n}`,
    );
    ok(`${language}: ...and the ${language} ones are actually printed`,
      shown.every((k) => FEATURE_PAGE_SLUGS.some((s) => pages.get(s).includes(flat(said_(language, k))))),
      shown.filter((k) => !FEATURE_PAGE_SLUGS.some((s) => pages.get(s).includes(flat(said_(language, k))))).join(" "));
  }

  // (e) The group heading over the hero, and the matrix names and summaries
  //     under "What you get" — the layer /pricing already proved, re-proved
  //     here because these pages call it at three different call sites.
  {
    const survivedGroups = MATRIX_GROUPS.filter((g) =>
      FEATURE_PAGE_SLUGS.some((s) => pages.get(s).includes(flat(g.blurb))) || index.includes(flat(g.blurb)),
    );
    ok(`${language}: no English group blurb survives`, survivedGroups.length === 0,
      survivedGroups.map((g) => g.key).join(" "));
    const survivedNames = [];
    for (const page of FEATURE_PAGES) {
      const text = pages.get(page.slug);
      for (const key of page.features) {
        if (text.includes(flat(matrixEntry(key).summary))) survivedNames.push(`${page.slug}/${key}`);
      }
    }
    ok(`${language}: no English feature sentence survives`, survivedNames.length === 0,
      survivedNames.slice(0, 6).join(" "));
  }

  // (f) The caveats. featureLabels.js named this gap in its own header —
  //     "a Ukrainian visitor sees one English caveat under an otherwise
  //     Ukrainian block" — and /features/financing is the page where it bites
  //     hardest, because the sentence is "FieldQuo does not lend and does not
  //     approve anyone". Asserted on the pages that actually carry a partial.
  {
    const withLimits = FEATURE_PAGES.filter((p) =>
      p.features.some((k) => LIMIT_KEYS.includes(k)),
    );
    ok(`${language}: there are pages carrying a caveat (${withLimits.length})`,
      withLimits.length >= 5, withLimits.length);
    const survived = [];
    const absent = [];
    for (const page of withLimits) {
      const text = pages.get(page.slug);
      for (const key of page.features.filter((k) => LIMIT_KEYS.includes(k))) {
        if (text.includes(flat(matrixEntry(key).limits))) survived.push(`${page.slug}/${key}`);
        if (!text.includes(flat(said_(language, featureLabelKey(key, "limits"))))) {
          absent.push(`${page.slug}/${key}`);
        }
      }
    }
    ok(`${language}: every caveat is printed in ${language}`, absent.length === 0,
      absent.slice(0, 6).join(" "));
    ok(`${language}: NO English caveat survives`, survived.length === 0,
      survived.slice(0, 6).join(" "));
  }

  // (g) /features/financing by name, because it is the page the argument is
  //     about and a list-driven assertion can pass while the one page that
  //     matters is missing from the list.
  {
    const text = pages.get("financing");
    const english = matrixEntry("financing").limits;
    ok(`${language}: /features/financing does not say "${english.slice(0, 34)}…"`,
      !text.includes(flat(english)));
    ok(`${language}: ...and does carry the ${language} caveat`,
      text.includes(flat(said_(language, "feature.financing.limits"))));
    ok(`${language}: ...and its headline is not the English one`,
      !text.includes(flat(featurePage("financing").headline)));
  }

  // (h) The index, which lists all 37 and every one of the 29 names. Left
  //     English it would be the same half-and-half failure one level up.
  {
    const survived = FEATURE_PAGES.filter(
      (p) => p.oneLine.length >= 40 && index.includes(flat(p.oneLine)),
    );
    ok(`${language}: /features lists nothing in English`, survived.length === 0,
      survived.map((p) => p.slug).slice(0, 6).join(" "));
    ok(`${language}: ...and lists the pages in ${language}`,
      FEATURE_PAGES.every((p) => index.includes(flat(said_(language, featurePageKey(p.slug, "label"))))),
      FEATURE_PAGES.filter((p) => !index.includes(flat(said_(language, featurePageKey(p.slug, "label")))))
        .map((p) => p.slug).slice(0, 6).join(" "));
  }
}

// The metadata half of the same decision, asserted rather than described: the
// <title> and description a crawler sees are the English ones, and they are the
// English ones no matter what language the page body is rendered in — because
// generateMetadata has no React context and must not gain one.
{
  const meta = await generateMetadata({ params: Promise.resolve({ slug: "quotes" }) });
  const page = featurePage("quotes");
  ok("generateMetadata is still English", meta.title === `${page.headline} | FieldQuo`);
  ok("...and its description is the data module's own", meta.description === page.description);
  ok("...which is NOT what the pages render",
    MESSAGES.fr["featurePage.quotes.description"] !== page.description);
}

// English is the control. If the pages stopped printing the proved English when
// nobody asked for another language, every assertion above is measuring the
// wrong thing — and the 1043 assertions before it would already have failed,
// which is the point of leaving them reading `rendered`.
{
  const missing = FEATURE_PAGES.filter((p) => !rendered.get(p.slug).text.includes(flat(p.headline)));
  ok("English still prints the data module's own headlines", missing.length === 0,
    missing.map((p) => p.slug).join(" "));
}

console.log(
  fails.length
    ? `\nFAILED — ${fails.length} of ${pass + fails.length}\n${fails.map((f) => `  ✗ ${f}`).join("\n")}`
    : `\nPASSED — ${pass}/${pass} assertions`,
);
process.exit(fails.length ? 1 : 0);
}

// A throw inside main() is a failure of the thing being checked — a page that
// cannot render at all — so it exits non-zero rather than becoming an
// unhandled rejection that some node versions report and still exit 0 on.
main().catch((err) => {
  console.error(`\nFAILED — the page set threw before it could be checked\n${err?.stack || err}`);
  process.exit(1);
});
