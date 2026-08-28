// scripts/check-glossary.mjs
//
//   npm run check:glossary
//
// A hundred pages of prose about other people's money, on a public site, in
// our name. This file is what stops that being a liability.
//
// Bundled with esbuild before it runs — see the package.json entry — for the
// same reason scripts/check-pricing-page.mjs is: the pages are JSX that plain
// node cannot parse, and the whole point is to RENDER them rather than to read
// their source and hope. A guard in this repo once passed a source assertion
// happily while disabled with `false &&`; grepping for a string proves the
// string is present, not that a visitor ever sees it.
//
// ══ What is actually at risk here, in order ════════════════════════════════
//
// 1. THE LAW. A wrong definition of a lien deadline, a deposit cap or a
//    holdback percentage is not a typo — a contractor who reads it and acts on
//    it loses a remedy or breaks a consumer-protection rule. The defence is
//    structural rather than editorial: any entry whose answer is set by
//    statute carries `varies: true`, and the check below refuses an entry that
//    is flagged and silent, AND an entry that hedges in its prose without the
//    flag. The flag drives a warning panel on the page, so the two cannot
//    drift apart without this going red.
//
// 2. A CLAIM WE CANNOT KEEP. Every FieldQuo sentence hangs off a key in
//    lib/marketing/featureMatrix.js, which is the one file allowed to say what
//    this product does and which carries the proof paths to back it. A
//    glossary that restated features in its own words would be a second,
//    unchecked list of promises — the exact "control that appears to work"
//    failure AGENTS.md opens with, wearing a marketing hat. Four things we do
//    NOT have are banned outright by name, because they are the four a writer
//    reaches for on autopilot.
//
// 3. A DEAD LINK. Related terms are hand-picked slugs. A renamed slug turns
//    every reference to it into a 404 that nobody clicks in testing because
//    nobody tests the fourteenth term in the third section.
//
// 4. A THIN PAGE. Per-term pages are defensible only while they are not stubs.
//    The floor on definition length is what makes the argument in the header
//    of app/(marketing)/glossary/[slug]/page.js true rather than aspirational.
//
// ══ What it renders ════════════════════════════════════════════════════════
//
// The real index page, and the real term page for EVERY slug — not a sample.
// A hundred renders is a second of wall clock and it is the only way "every
// slug renders" is a fact. next/navigation is aliased to the inert stub so
// notFound() does not throw outside a Next request; the unknown-slug case is
// asserted against that stub's behaviour (an empty render) plus the source
// call, which is the honest limit of what can be checked out of process.

import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  GLOSSARY_CATEGORIES,
  GLOSSARY_CATEGORY_KEYS,
  GLOSSARY_GAPS,
  GLOSSARY_SLUGS,
  TRADE_GLOSSARY,
  alphabetical,
  entriesInCategory,
  glossaryEntry,
  openingSentence,
  tradeLabels,
} from "@/app/data/tradeGlossary";
import { INDUSTRIES } from "@/app/data/industries";
import { FEATURE_MATRIX, MATRIX_KEYS, matrixEntry } from "@/lib/marketing/featureMatrix";
import GlossaryIndexPage from "@/app/(marketing)/glossary/page";
import GlossaryTermPage from "@/app/(marketing)/glossary/[slug]/page";

let pass = 0;
const fails = [];
const ok = (label, cond, detail) =>
  cond
    ? (pass++, console.log(`  ✓ ${label}`))
    : fails.push(`${label}${detail !== undefined ? ` — got ${detail}` : ""}`);

// Comments are where this repo explains itself, and every string an assertion
// looks for is discussed in one. Stripping them is the difference between "the
// page renders the warning" and "the page has a comment about the warning".
const code = (p) =>
  readFileSync(p, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

// React escapes five characters in a text child, and this glossary is full of
// them — "Workers' compensation", "Mechanic's lien", "Good, better, best". An
// assertion that looks for the raw string finds nothing and reports a missing
// term that is right there on the page, which is a check that cries wolf.
const esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
const rx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const DATA = "app/data/tradeGlossary.js";
const INDEX_PAGE = "app/(marketing)/glossary/page.js";
const TERM_PAGE = "app/(marketing)/glossary/[slug]/page.js";
const BITS = "app/(marketing)/glossary/GlossaryBits.js";

// Rendered once, reused by every section below. Term pages are async server
// components, so the element has to be awaited before react-dom sees it —
// the same shape check-pricing-page.mjs uses for the pricing page.
const renderTerm = async (slug) =>
  renderToStaticMarkup(await GlossaryTermPage({ params: Promise.resolve({ slug }) }));
const indexHtml = renderToStaticMarkup(createElement(GlossaryIndexPage));
const termHtml = new Map();
for (const slug of GLOSSARY_SLUGS) termHtml.set(slug, await renderTerm(slug));

/* ═══════════════════════════════════════════════════════════════════════════
   1. One term, one slug, one page

   A duplicate term is two answers to the same question, and whichever one the
   reader finds is luck. A duplicate slug is worse: Next would build one page
   and silently drop the other, so the entry exists in the data, appears in the
   index, and links to somebody else's definition.
   ═══════════════════════════════════════════════════════════════════════════ */

console.log("\n── One term, one slug ──────────────────────────────────────────\n");

const slugs = TRADE_GLOSSARY.map((e) => e.slug);
const terms = TRADE_GLOSSARY.map((e) => e.term.toLowerCase());
const dupes = (list) => [...new Set(list.filter((v, i) => list.indexOf(v) !== i))];

ok("there is a glossary at all", TRADE_GLOSSARY.length >= 40, TRADE_GLOSSARY.length);
ok("no two entries share a slug", dupes(slugs).length === 0, dupes(slugs).join(" "));
ok("no two entries share a term", dupes(terms).length === 0, dupes(terms).join(" "));
ok(
  "every slug is url-safe and lower case",
  slugs.every((s) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s)),
  slugs.filter((s) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s)).join(" "),
);
// A synonym that is also somebody else's headword sends a reader to the wrong
// page — "Refinishing" listed under both Refacing and a Refinishing entry
// would be two definitions of one word.
{
  const headwords = new Set(terms);
  const clashes = TRADE_GLOSSARY.flatMap((e) =>
    e.synonyms
      .filter((s) => headwords.has(s.toLowerCase()) && s.toLowerCase() !== e.term.toLowerCase())
      .map((s) => `${e.slug}:${s}`),
  );
  ok("no synonym is another entry's headword", clashes.length === 0, clashes.join(" "));
}
ok(
  "every entry sits in a real section",
  TRADE_GLOSSARY.every((e) => GLOSSARY_CATEGORY_KEYS.includes(e.category)),
  TRADE_GLOSSARY.filter((e) => !GLOSSARY_CATEGORY_KEYS.includes(e.category)).map((e) => e.slug).join(" "),
);
// An empty section renders a heading over nothing — the defect that made the
// FAQ block on /resources ship blank.
ok(
  "no section is empty",
  GLOSSARY_CATEGORY_KEYS.every((k) => entriesInCategory(k).length > 0),
  GLOSSARY_CATEGORY_KEYS.filter((k) => entriesInCategory(k).length === 0).join(" "),
);

/* ═══════════════════════════════════════════════════════════════════════════
   2. Every definition is a definition

   The floor is what makes per-term pages defensible instead of thin. The
   ceiling is editorial: past roughly a screen it stops being a glossary entry
   and starts being an article nobody finishes.

   The opening sentence has its own floor because the INDEX shows only that,
   derived rather than authored. A definition that opens with "It depends."
   would render an index line that says nothing.
   ═══════════════════════════════════════════════════════════════════════════ */

console.log("\n── Every definition is a definition ────────────────────────────\n");

const short = TRADE_GLOSSARY.filter((e) => e.definition.length < 240);
const long = TRADE_GLOSSARY.filter((e) => e.definition.length > 900);
ok("no stub definitions", short.length === 0, short.map((e) => `${e.slug}:${e.definition.length}`).join(" "));
ok("no essays either", long.length === 0, long.map((e) => `${e.slug}:${e.definition.length}`).join(" "));
{
  const bad = TRADE_GLOSSARY.filter((e) => {
    const o = openingSentence(e.definition);
    return o.length < 40 || o.length > 240;
  });
  ok("every opening sentence stands alone", bad.length === 0, bad.map((e) => e.slug).join(" "));
}
// The derivation, not the data: an opening sentence that swallowed the whole
// definition means the split silently failed, and the index becomes the wall
// of duplicated text the split exists to prevent.
{
  const swallowed = TRADE_GLOSSARY.filter(
    (e) => openingSentence(e.definition).length === e.definition.length,
  );
  ok("openingSentence really splits", swallowed.length === 0, swallowed.map((e) => e.slug).join(" "));
}
// "vs." is the abbreviation that breaks a naive sentence splitter, and there
// is a headword containing one, so the behaviour is pinned rather than hoped
// for.
ok(
  "an abbreviation mid-sentence does not end it",
  openingSentence("A vs. B is one idea. Then a second.") === "A vs. B is one idea.",
  openingSentence("A vs. B is one idea. Then a second."),
);
ok(
  "a definition with no full stop survives whole",
  openingSentence("no terminator here") === "no terminator here",
);
ok(
  "every term is short enough to be a headline",
  TRADE_GLOSSARY.every((e) => e.term.length <= 40),
  TRADE_GLOSSARY.filter((e) => e.term.length > 40).map((e) => e.slug).join(" "),
);

/* ═══════════════════════════════════════════════════════════════════════════
   3. Nothing points at nothing

   Related terms are hand-picked, which is what makes them worth having and
   also what makes them rot. Same for trade slugs: tradeLabels() drops an
   unknown one rather than prettifying it — the right runtime behaviour, and
   exactly why it needs a check, because a typo would be invisible on the page.
   ═══════════════════════════════════════════════════════════════════════════ */

console.log("\n── Nothing points at nothing ───────────────────────────────────\n");

{
  const known = new Set(slugs);
  const dangling = TRADE_GLOSSARY.flatMap((e) =>
    e.related.filter((r) => !known.has(r)).map((r) => `${e.slug}→${r}`),
  );
  ok("every related term exists", dangling.length === 0, dangling.join(" "));
}
ok(
  "nothing is related to itself",
  TRADE_GLOSSARY.every((e) => !e.related.includes(e.slug)),
  TRADE_GLOSSARY.filter((e) => e.related.includes(e.slug)).map((e) => e.slug).join(" "),
);
{
  const industrySlugs = new Set(INDUSTRIES.map((i) => i.slug));
  const unknown = TRADE_GLOSSARY.flatMap((e) =>
    e.trades.filter((tr) => !industrySlugs.has(tr)).map((tr) => `${e.slug}→${tr}`),
  );
  ok("every trade slug is one we serve", unknown.length === 0, unknown.join(" "));
  // The consequence, executed: an unknown slug must vanish rather than appear
  // as a plausible label. Padding absent data with a default is failure class
  // 5 in AGENTS.md, and a fabricated trade name on a public page is that.
  ok(
    "an unknown trade slug renders nothing at all",
    tradeLabels({ trades: ["chimney-sweeping"] }).length === 0,
  );
  ok(
    "...while a real one renders its label from the industries list",
    tradeLabels({ trades: ["roofing"] })[0] === INDUSTRIES.find((i) => i.slug === "roofing").label,
  );
}
// A rejected term and a defined term are contradictory statements about the
// same word. GLOSSARY_GAPS is read here and nowhere else on purpose — a list
// nothing reads is failure class 1, and this is what reads it.
{
  const headwords = new Set(terms);
  const both = GLOSSARY_GAPS.filter((g) =>
    g.term.split("/").some((part) => headwords.has(part.trim().toLowerCase())),
  );
  ok("nothing is both defined and rejected", both.length === 0, both.map((g) => g.term).join(" | "));
  ok(
    "every rejection carries its reason",
    GLOSSARY_GAPS.every((g) => g.term && g.reason && g.reason.length > 60),
    GLOSSARY_GAPS.filter((g) => !g.reason || g.reason.length <= 60).map((g) => g.term).join(" "),
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   4. Every FieldQuo sentence is one featureMatrix already stands behind

   featureMatrix.js is the only file allowed to originate a claim about this
   product, and check:feature-matrix proves each of its claims against the code
   that implements it. Hanging every glossary sentence off a key there means a
   feature that gets pulled takes its glossary sentence down with it, instead
   of leaving a promise on a page nobody re-reads.
   ═══════════════════════════════════════════════════════════════════════════ */

console.log("\n── Every product claim resolves ────────────────────────────────\n");

const withProduct = TRADE_GLOSSARY.filter((e) => e.product);
{
  const unresolved = withProduct.filter((e) => !matrixEntry(e.product.key));
  ok(
    "every product key is a real feature",
    unresolved.length === 0,
    unresolved.map((e) => `${e.slug}→${e.product.key}`).join(" "),
  );
}
ok("the matrix is what was consulted, not a copy", MATRIX_KEYS.length === FEATURE_MATRIX.length);
ok(
  "every product note names FieldQuo",
  withProduct.every((e) => /\bFieldQuo\b/.test(e.product.note)),
  withProduct.filter((e) => !/\bFieldQuo\b/.test(e.product.note)).map((e) => e.slug).join(" "),
);
// The whole point of "optional per entry, never forced": if every entry had
// one, the glossary would be an advertisement wearing a reference book's
// clothes, and a reader would stop trusting the definitions too.
ok(
  "plenty of entries have no product sentence at all",
  TRADE_GLOSSARY.length - withProduct.length >= TRADE_GLOSSARY.length * 0.3,
  `${TRADE_GLOSSARY.length - withProduct.length} of ${TRADE_GLOSSARY.length}`,
);
// The renderer resolves the key rather than trusting it. Asserted through the
// real component: an entry pointing at a deleted feature must render nothing,
// not a dangling name.
{
  const { ProductNote } = await import("@/app/(marketing)/glossary/GlossaryBits");
  const real = renderToStaticMarkup(
    createElement(ProductNote, { entry: { product: { key: "quotes", note: "FieldQuo does it." } } }),
  );
  const ghost = renderToStaticMarkup(
    createElement(ProductNote, { entry: { product: { key: "not_a_feature", note: "FieldQuo does it." } } }),
  );
  ok("a real key renders the note", real.includes("FieldQuo does it."));
  ok("...and an unknown key renders nothing", ghost === "", ghost.slice(0, 60));
}

/* ═══════════════════════════════════════════════════════════════════════════
   5. Four things we do not have

   MATRIX_EXCLUSIONS in featureMatrix.js names them and says why. They are
   banned here by name because they are what a writer reaches for on autopilot:
   every competitor's glossary mentions an app and an accounting integration,
   and "change order" is a real trade term that this product does not implement
   — so the WORD is allowed (a contractor meets it whatever we ship) and the
   CLAIM is not.
   ═══════════════════════════════════════════════════════════════════════════ */

console.log("\n── Four things we do not have ──────────────────────────────────\n");

const FORBIDDEN = [
  [/\bmobile app\b/i, "a mobile app"],
  [/\bphone app\b/i, "a phone app"],
  [/\bour app\b/i, "an app of ours"],
  [/\bapp store\b/i, "an app store listing"],
  [/\bgoogle play\b/i, "a Play Store listing"],
  [/\bdownload the app\b/i, "an app download"],
  [/\bquickbooks\b/i, "QuickBooks"],
  [/\bzapier\b/i, "Zapier"],
  [/\bchange order/i, "change orders"],
];

// A sentence naming FieldQuo is a sentence making a claim. Everything else is
// describing the trade, which is what a glossary is for.
const claimSentences = TRADE_GLOSSARY.flatMap((e) => {
  const prose = [e.definition, e.product ? e.product.note : ""].join(" ");
  return prose
    .split(/(?<=[.!?])\s+/)
    .filter((s) => /\bFieldQuo\b/.test(s))
    .map((s) => [e.slug, s]);
});
ok("there are claims to check", claimSentences.length >= 40, claimSentences.length);
for (const [pattern, label] of FORBIDDEN) {
  const hits = claimSentences.filter(([, s]) => pattern.test(s));
  ok(`nothing claims ${label}`, hits.length === 0, hits.map(([slug]) => slug).join(" "));
}
// Product notes are claims whether or not the sentence spells the name out, so
// they are swept whole as well.
for (const [pattern, label] of FORBIDDEN) {
  const hits = withProduct.filter((e) => pattern.test(e.product.note));
  ok(`no product note mentions ${label}`, hits.length === 0, hits.map((e) => e.slug).join(" "));
}
// And the rendered pages, because a banned phrase could arrive from the page
// chrome rather than from the data.
for (const [pattern, label] of FORBIDDEN.filter(([, l]) => l !== "change orders")) {
  const pages = [["index", indexHtml], ...termHtml].filter(([, html]) => pattern.test(html));
  ok(`no rendered page shows ${label}`, pages.length === 0, pages.map(([k]) => k).join(" "));
}
// The counterpart, so the rule above cannot be satisfied by deleting the term:
// "change order" is a word our audience meets, and refusing to define it would
// be hiding a gap rather than being honest about one.
{
  const co = glossaryEntry("change-order");
  ok("change order is still DEFINED as a trade term", co !== null);
  ok("...with no product sentence attached to it", co !== null && co.product === null);
  ok(
    "...and its page renders",
    (termHtml.get("change-order") || "").includes(">Change order<"),
  );
}
// Internal vocabulary, the same list check-feature-matrix.mjs bans. A glossary
// written in our words instead of the trade's has failed at the only job it
// has.
{
  const JARGON = ["webhook", "endpoint", "prisma", "cron", "middleware", "boolean", "tenant", "multi-tenant", "crud"];
  const hits = TRADE_GLOSSARY.flatMap((e) =>
    JARGON.filter((w) => new RegExp(`\\b${w}\\b`, "i").test(e.definition)).map((w) => `${e.slug}:${w}`),
  );
  ok("no internal vocabulary leaks into a definition", hits.length === 0, hits.join(" "));
}

/* ═══════════════════════════════════════════════════════════════════════════
   6. Where the law varies, the page says so

   The rule this whole file exists for. `varies` is asserted in BOTH
   directions, and the second direction is the one that catches drift: an
   editor who adds "this differs by state" to a definition without setting the
   flag gets prose that hedges and a page with no warning panel — which reads
   as more settled than the sentence it sits under, not less.
   ═══════════════════════════════════════════════════════════════════════════ */

console.log("\n── Where the law varies, the page says so ──────────────────────\n");

// A place word, plus a word that asserts the answer changes between places.
// Either alone is not enough: "the condition of the substrate" contains a
// place word by accident, and "prices vary" asserts variance about something
// that is not jurisdiction.
const PLACE = /\b(provinces?|provincial(?:ly)?|states?|jurisdictions?|countr(?:y|ies)|municipality)\b/i;
const VARIANCE = /\b(var(?:y|ies|ying)|differ(?:s|ent|ently)?|not the same|set by|restricted in some|depends? on where)\b/i;
const saysItVaries = (text) => PLACE.test(text) && VARIANCE.test(text);

{
  const silent = TRADE_GLOSSARY.filter((e) => e.varies && !saysItVaries(e.definition));
  ok("every flagged term SAYS the answer is local", silent.length === 0, silent.map((e) => e.slug).join(" "));
  const unflagged = TRADE_GLOSSARY.filter((e) => !e.varies && saysItVaries(e.definition));
  ok("...and nothing hedges without the flag", unflagged.length === 0, unflagged.map((e) => e.slug).join(" "));
}
// The legal and financial subjects that must never be stated flatly. Named as
// slugs rather than inferred, because "we forgot to flag the lien entry" is
// precisely the failure a general rule would not catch.
{
  const MUST_VARY = [
    "lien", "lien-waiver", "retainage", "deposit", "substantial-completion",
    "workers-compensation", "surety-bond", "trade-licence", "sales-tax",
    "employee-vs-subcontractor", "cooling-off-period", "warranty", "permit",
    "building-code", "labour-burden", "contract",
  ];
  const missing = MUST_VARY.filter((s) => !glossaryEntry(s) || !glossaryEntry(s).varies);
  ok(
    "liens, holdbacks, bonding, insurance, tax and licensing all vary",
    missing.length === 0,
    missing.join(" "),
  );
}
// No number that a statute owns. A percentage or a day count in one of these
// entries is the specific harm this whole section is built against.
{
  const NUMBER = /\b\d+(?:\.\d+)?\s*(?:per cent|percent|%|days?|months?|years?|business days?)\b/i;
  const hits = TRADE_GLOSSARY.filter((e) => e.varies && NUMBER.test(e.definition));
  ok("no flagged entry names a statutory number", hits.length === 0, hits.map((e) => e.slug).join(" "));
}
// The flag has to reach the reader, not just the data file. Rendered, per page.
{
  const missing = TRADE_GLOSSARY.filter(
    (e) => e.varies && !(termHtml.get(e.slug) || "").includes("This one depends on where you work"),
  );
  ok("every flagged page renders the warning", missing.length === 0, missing.map((e) => e.slug).join(" "));
  const spurious = TRADE_GLOSSARY.filter(
    (e) => !e.varies && (termHtml.get(e.slug) || "").includes("This one depends on where you work"),
  );
  ok("...and no unflagged page invents one", spurious.length === 0, spurious.map((e) => e.slug).join(" "));
}
// The index warns too. A reader who scans the list and never opens the page
// still has to see which answers are local before they act on one.
{
  const missing = TRADE_GLOSSARY.filter((e) => e.varies).filter(
    (e) => !new RegExp(`${rx(esc(e.term))}[\\s\\S]{0,400}?Varies by province`).test(indexHtml),
  );
  ok("the index flags them too", missing.length === 0, missing.map((e) => e.slug).join(" "));
}

/* ═══════════════════════════════════════════════════════════════════════════
   7. Every slug renders

   Not a sample. The whole point of a hundred pages is that the hundredth one
   works, and the hundredth one is the one nobody opens.
   ═══════════════════════════════════════════════════════════════════════════ */

console.log("\n── Every slug renders ──────────────────────────────────────────\n");

ok("the index renders", indexHtml.length > 2000, indexHtml.length);
ok(
  "...and lists every term",
  TRADE_GLOSSARY.every((e) => indexHtml.includes(`>${esc(e.term)}<`)),
  TRADE_GLOSSARY.filter((e) => !indexHtml.includes(`>${e.term}<`)).map((e) => e.slug).join(" "),
);
ok(
  "...linking to every term page",
  TRADE_GLOSSARY.every((e) => indexHtml.includes(`/glossary/${e.slug}"`)),
  TRADE_GLOSSARY.filter((e) => !indexHtml.includes(`/glossary/${e.slug}"`)).map((e) => e.slug).join(" "),
);
ok(
  "...showing the opening sentence and not the whole definition",
  TRADE_GLOSSARY.every(
    (e) =>
      indexHtml.includes(esc(openingSentence(e.definition))) &&
      !indexHtml.includes(esc(e.definition)),
  ),
  TRADE_GLOSSARY.filter((e) => indexHtml.includes(esc(e.definition))).map((e) => e.slug).join(" "),
);
ok(
  "every section heading is on it",
  GLOSSARY_CATEGORIES.every((c) => indexHtml.includes(esc(c.label))),
);

{
  const empty = GLOSSARY_SLUGS.filter((s) => (termHtml.get(s) || "").length < 1500);
  ok(`all ${GLOSSARY_SLUGS.length} term pages render`, empty.length === 0, empty.join(" "));
  const missingBody = TRADE_GLOSSARY.filter((e) => !(termHtml.get(e.slug) || "").includes(esc(e.definition)));
  ok("...each carrying its own full definition", missingBody.length === 0, missingBody.map((e) => e.slug).join(" "));
  const missingHead = TRADE_GLOSSARY.filter((e) => !(termHtml.get(e.slug) || "").includes(`>${esc(e.term)}<`));
  ok("...under its own headword", missingHead.length === 0, missingHead.map((e) => e.slug).join(" "));
  // Cross-links are only worth having if they resolve. Every related slug must
  // be a page that rendered, and must be linked from the page that names it.
  const brokenLinks = TRADE_GLOSSARY.flatMap((e) =>
    e.related
      .filter((r) => !(termHtml.get(e.slug) || "").includes(`/glossary/${r}"`))
      .map((r) => `${e.slug}→${r}`),
  );
  ok("...and every related link is actually rendered", brokenLinks.length === 0, brokenLinks.join(" "));
  // Synonyms are the search terms. A page that drops them loses the query.
  const missingSyn = TRADE_GLOSSARY.filter(
    (e) => e.synonyms.length > 0 && !(termHtml.get(e.slug) || "").includes(esc(e.synonyms[0])),
  );
  ok("...with its synonyms on the page", missingSyn.length === 0, missingSyn.map((e) => e.slug).join(" "));
}

// An unknown slug must not render a page. next/navigation is the inert stub
// here, so notFound() cannot be observed to throw — what CAN be observed is
// that the component returns nothing, and that the real call is in the source
// rather than described in a comment.
{
  const html = await renderTerm("not-a-real-term");
  ok("an unknown slug renders no page", html === "", html.slice(0, 80));
  const src = code(TERM_PAGE);
  ok("...because the page calls notFound()", /if \(!entry\) return notFound\(\);/.test(src));
  ok("...having awaited params, as Next 16 requires", /const \{ slug \} = await params;/.test(src));
  ok("...and generateStaticParams covers every slug", /GLOSSARY_SLUGS\.map/.test(src));
}

// Metadata is what a search engine indexes, which is the entire reason these
// pages exist. Executed rather than read.
{
  const meta = await (await import("@/app/(marketing)/glossary/[slug]/page")).generateMetadata({
    params: Promise.resolve({ slug: "retainage" }),
  });
  ok("a term page has its own title", /retainage/i.test(meta.title || ""), meta.title);
  ok("...its own description", (meta.description || "").length > 40, meta.description);
  ok("...and its own canonical", meta.alternates?.canonical === "/glossary/retainage", meta.alternates?.canonical);
  const none = await (await import("@/app/(marketing)/glossary/[slug]/page")).generateMetadata({
    params: Promise.resolve({ slug: "nope" }),
  });
  ok("...and an unknown slug claims no canonical", !none.alternates, JSON.stringify(none));
}

/* ═══════════════════════════════════════════════════════════════════════════
   8. The shape the rest of the site expects

   Cheap structural assertions that would each have shipped a broken page.
   ═══════════════════════════════════════════════════════════════════════════ */

console.log("\n── The shape the rest of the site expects ──────────────────────\n");

ok(
  "the copy lives in a data module, not the message catalogue",
  /export const TRADE_GLOSSARY/.test(code(DATA)) &&
    !/useTranslation/.test(code(INDEX_PAGE)) &&
    !/useTranslation/.test(code(TERM_PAGE)),
);
// The English-only decision is deliberate and documented. If somebody wires
// t() in later they will have to face check:translations, which is the point.
ok(
  "neither page is a client component",
  !/^"use client"/m.test(code(INDEX_PAGE)) && !/^"use client"/m.test(code(TERM_PAGE)),
);
ok(
  "both pages use the shared marketing metadata helper",
  /marketingMetadata\(/.test(code(INDEX_PAGE)) && /marketingMetadata\(/.test(code(TERM_PAGE)),
);
// The fragments are shared rather than written twice — failure class 4, and
// the jurisdiction warning is the one that must not diverge.
ok(
  "the shared fragments are imported, not duplicated",
  /from "\.\/GlossaryBits"/.test(code(INDEX_PAGE)) &&
    /from "\.\.\/GlossaryBits"/.test(code(TERM_PAGE)) &&
    /export function JurisdictionNote/.test(code(BITS)),
);
ok(
  "alphabetical() sorts what it is given",
  alphabetical()[0].term.localeCompare(alphabetical()[TRADE_GLOSSARY.length - 1].term, "en", {
    sensitivity: "base",
  }) < 0,
);
ok("...over every entry", alphabetical().length === TRADE_GLOSSARY.length);

console.log(
  fails.length
    ? `\nFAILED — ${fails.length} of ${pass + fails.length}\n${fails.map((f) => `  ✗ ${f}`).join("\n")}`
    : `\nPASSED — ${pass}/${pass} assertions across ${TRADE_GLOSSARY.length} terms, ${GLOSSARY_CATEGORIES.length} sections and ${GLOSSARY_SLUGS.length + 1} rendered pages`,
);
process.exit(fails.length ? 1 : 0);
