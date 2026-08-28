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

import { readFileSync } from "node:fs";
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
  coverage,
  featurePage,
  featuresOnPage,
} from "@/app/data/featurePages";
import { LANGUAGES } from "@/app/i18n/languages";
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
const rendered = new Map();
for (const slug of FEATURE_PAGE_SLUGS) {
  const element = await FeaturePage({ params: Promise.resolve({ slug }) });
  const html = renderToStaticMarkup(element);
  rendered.set(slug, { html, text: textOf(html) });
}
const indexHtml = renderToStaticMarkup(createElement(FeaturesIndexPage));
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
