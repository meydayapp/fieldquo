// scripts/check-homepage-sections.mjs
//
//   npm run check:homepage-sections
//
// The homepage BELOW the hero. check:marketing-cta already proves the page
// asks for the signup and that every key it renders exists; this proves the
// two things that check cannot see, both of which the sections below the hero
// got wrong before this ran.
//
// ══ 1. Both halves of a catalogue entry, or neither ══════════════════════
//
// The feature band listed four products and rendered `product.<key>.label`
// only. `product.<key>.description` — a sentence per feature, written and
// translated into every language in the catalogue — had no call site
// anywhere in app/. Four bordered boxes with two words in each is not a
// feature band, and the copy that would have made it one was already paid
// for. That is the schema-field-written-and-never-read failure from
// AGENTS.md with the catalogue standing in for the schema, and the reason it
// survived is that nothing broke: t() returns something for the half that IS
// rendered, so the page looks finished.
//
// So: for every feature the band lists, BOTH halves must exist in English and
// BOTH must be rendered.
//
// ══ 2. Every link it draws has somewhere to land ═════════════════════════
//
// ResourcesTeaser's FAQ card pointed at /resources/faq, a route that never
// existed, and the footer had already dropped its copy of the same link for
// that reason — so the homepage kept the 404 the footer had fixed. A dead
// link is the dead-control rule wearing an <a>: it looks like it works right
// up until somebody clicks it.
//
// Every internal href in the below-hero sections is resolved against the
// real app/ route tree, route groups and dynamic segments included.
//
// ══ What this proves, and what it cannot ═════════════════════════════════
//
// It reads source, so it proves that a t() call of the right SHAPE is present
// and that an href of the right shape resolves. It cannot prove the
// description is rendered for the SAME feature whose label is (the key is
// built at run time from a loop variable this script does not evaluate), that
// the text is visible rather than clipped, or that a page at the end of a
// resolved route says anything useful. Those need a browser. The shape check
// is still worth having: it is what turns "somebody deleted the description
// line" from a silent regression into a red build.
//
// Nothing here duplicates check:marketing-cta. That one asks whether the page
// ASKS; this one asks whether the sections it asks in are WIRED.
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { MESSAGES } from "../app/i18n/messages.js";
import { INDUSTRIES } from "../app/data/industries.js";
import { INDUSTRY_CONTENT } from "../app/data/industryContent.js";
import { PRODUCT_FEATURES } from "../app/data/productFeatures.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

let pass = 0;
const failures = [];

/**
 * label first, condition second. Every check in this repo is written this way
 * and the one that was not produced a run of green failures — `ok(cond, label)`
 * passes on any non-empty string, so every assertion in the file "passed".
 */
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
 * Comments stripped before anything is matched. A key named in a comment is
 * not a rendered key and an href named in a comment is not a link — reading
 * the raw file is how a check passes on its own documentation. This file's own
 * header names `product.<key>.description` half a dozen times, which is
 * exactly the string rule 1 looks for.
 */
const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const EN = MESSAGES.en || {};

// The sections after the hero. Hero.js is deliberately absent: it is finished,
// it is covered by check:marketing-cta, and a rule that also polices it would
// fail the next person who touches it for reasons that belong to another file.
const SECTIONS = [
  "app/components/marketing/FeaturesIndustries.js",
  "app/components/marketing/FAQ.js",
  "app/components/marketing/ResourcesTeaser.js",
  "app/components/marketing/ClosingCTA.js",
];

console.log("\nHomepage sections below the hero — both halves, and no dead links\n");

// ═══════════════════════════════════════════════════════════════════════════
// The files exist and the page still renders them
// ═══════════════════════════════════════════════════════════════════════════
//
// Asserted rather than assumed: a renamed section would otherwise drop out of
// every rule below and the run would stay green over a page it is no longer
// reading — the same trap check:marketing-cta avoids by resolving imports.

section("The page renders the sections this file checks");

const HOME = "app/(marketing)/page.js";
const homeSrc = stripComments(read(HOME));

for (const rel of SECTIONS) {
  const name = rel.split("/").pop().replace(/\.js$/, "");
  ok(`${name}.js exists`, existsSync(join(ROOT, rel)));
  ok(
    `${HOME} imports and renders <${name} />`,
    new RegExp(`import\\s+${name}\\s+from`).test(homeSrc) &&
      new RegExp(`<${name}\\s*/>`).test(homeSrc),
    "the section is on disk but the homepage no longer shows it",
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. Both halves of every feature the band lists
// ═══════════════════════════════════════════════════════════════════════════

section("The feature band renders a label AND a description for every feature");

const bandSrc = stripComments(read(SECTIONS[0]));

/**
 * The FEATURES array, read out of the component rather than restated here.
 * A list copied into a check is a list that goes stale, and it would then
 * prove things about features the band does not render.
 */
const bandKeys = [...bandSrc.matchAll(/\bkey:\s*"([^"]+)"/g)].map((m) => m[1]);

ok(
  "the band's FEATURES array is readable and non-empty",
  bandKeys.length > 0,
  "no `key: \"…\"` entries found — if the array moved, this rule is now blind and must be rewritten, not deleted",
);

for (const key of bandKeys) {
  for (const half of ["label", "description"]) {
    ok(
      `product.${key}.${half} exists in English`,
      `product.${key}.${half}` in EN,
      "the band names a feature the catalogue has only half of",
    );
  }
}

// Both SHAPES have to appear in the source. `t(`product.${f.key}.label`)` is a
// run-time key, so the exact string is unreadable here — but the shape is not,
// and the regression this guards against is a whole line being deleted, which
// takes the shape with it.
for (const half of ["label", "description"]) {
  ok(
    `the band renders t(\`product.\${…}.${half}\`)`,
    new RegExp(
      "t\\(\\s*`product\\.\\$\\{[^`]*\\}\\." + half + "`",
    ).test(bandSrc),
    `nothing in the band reads the ${half} half — the catalogue would carry copy nothing shows, which is how it got here`,
  );
}

// The trade strip is the only place on the page a roofer meets the word
// roofing. It renders from the translated hook, not from the English data
// module, and reverting that puts a strip of English back into the middle of
// eight translated pages.
ok(
  "the trades strip still renders the TRANSLATED labels",
  /useIndustryLabels\s*\(\s*\)/.test(bandSrc),
  "app/data/industries.js labels are English-only routing keys, not display copy",
);

// ═══════════════════════════════════════════════════════════════════════════
// 2. Every link these sections draw resolves to a real route
// ═══════════════════════════════════════════════════════════════════════════

section("No section below the hero draws a link with nowhere to land");

/**
 * Every route the app actually serves, as a list of segment arrays.
 *
 * Route groups — `(marketing)` — contribute no segment, which is the whole
 * point of them and the reason a naive path-to-URL map gets /contact wrong.
 * A `[slug]` segment matches anything, so it is kept as a wildcard rather
 * than as a literal.
 */
function routeIndex() {
  const routes = [];
  const walk = (relDir) => {
    const abs = join(ROOT, relDir);
    let entries;
    try {
      entries = readdirSync(abs);
    } catch {
      return;
    }
    if (entries.includes("page.js") || entries.includes("page.jsx")) {
      const segs = relDir
        .split("/")
        .slice(1) // drop "app"
        .filter((s) => s && !(s.startsWith("(") && s.endsWith(")")));
      routes.push(segs);
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

ok(
  "the route index found the marketing pages",
  ROUTES.length > 20,
  `only ${ROUTES.length} routes found — the walk is broken, and every link below would pass by accident`,
);

/** Does `segs` match a real route? `[dyn]` in either side is a wildcard. */
function routeExists(segs) {
  return ROUTES.some((route) => {
    if (route.length !== segs.length) return false;
    return route.every((r, i) => {
      const s = segs[i];
      const rDyn = r.startsWith("[");
      const sDyn = s === "[dyn]";
      if (rDyn || sDyn) return rDyn; // a dynamic href needs a dynamic route
      return r === s;
    });
  });
}

/**
 * Internal hrefs, in all three forms these files use.
 *
 * `href="/x"` and `` href={`/x/${slug}`} `` are the obvious two. The third —
 * `href: "/x"` inside a config array at the top of the file — is the one that
 * matters, and the first version of this rule missed it: BOTH the feature
 * band's four product links and all three resource links live in such an
 * array and are spread onto the element as `href={f.href}`. That rule found
 * two links on a page that draws nine and reported ALL PASS. The dead
 * /resources/faq link this check exists to catch was in exactly that array,
 * so the first version could not have caught the bug it was written for.
 *
 * The templated form collapses every `${…}` to `[dyn]` so it can be matched
 * against a dynamic route. External links (http, mailto, tel) and bare hash
 * anchors are not routes and are skipped.
 */
function hrefsIn(src) {
  const found = [];
  for (const m of src.matchAll(
    /href\s*[=:]\s*(?:"([^"]*)"|\{`([^`]*)`\}|`([^`]*)`)/g,
  )) {
    const raw = m[1] ?? m[2] ?? m[3] ?? "";
    if (!raw.startsWith("/")) continue; // http/mailto/tel/#anchor
    found.push(raw);
  }
  return found;
}

let linksChecked = 0;
for (const rel of SECTIONS) {
  const src = stripComments(read(rel));
  const name = rel.split("/").pop();
  const dead = [];
  for (const href of hrefsIn(src)) {
    // The path only. A hash is an in-page anchor and a query is not routing.
    const path = href.split("#")[0].split("?")[0];
    if (path === "/" || path === "") continue; // the homepage itself
    const segs = path
      .replace(/\$\{[^}]*\}/g, "[dyn]")
      .split("/")
      .filter(Boolean);
    linksChecked++;
    if (!routeExists(segs)) dead.push(href);
  }
  ok(
    `${name} — every internal link resolves to a page`,
    dead.length === 0,
    dead.join(", ") + " — no page.js serves this",
  );
}

// /product/[slug] is a dynamic route, so the rule above accepts ANY slug in
// that position — /product/quoting and /product/qouting resolve identically to
// it, and the page calls notFound() on the second. The four the band draws are
// literals in its own source, so they can be checked against the data module
// the route reads.
{
  const slugs = [...bandSrc.matchAll(/href:\s*"\/product\/([^"]+)"/g)].map(
    (m) => m[1],
  );
  ok(
    "the feature band still links to /product/<slug>",
    slugs.length > 0,
    "no product links found — if the band stopped linking, this rule is blind and must be rewritten, not deleted",
  );
  const missing = slugs.filter((s) => !(s in PRODUCT_FEATURES));
  ok(
    `every feature card points at a product page that exists (${slugs.length})`,
    missing.length === 0,
    missing.join(", ") + " — /product/<slug> calls notFound() on these",
  );
}

// A dynamic href passes the rule above as long as SOME dynamic route sits in
// that slot, which says nothing about the slugs actually rendered. The trades
// strip builds twelve of them from INDUSTRIES, so those twelve are checked
// against the route by hand — /industries/[slug] calls notFound() on a slug it
// has no content for, and a strip of twelve links to a 404 is what this whole
// section exists to prevent.
{
  // Imported, not grepped. The first version of this rule searched
  // industryContent.js for `"cleaning"` and failed eight of the twelve trades
  // that are there — the object keys are bare identifiers wherever the slug is
  // a valid one (`cleaning:`) and quoted only where it is not
  // (`"lawn-care":`). Matching the source text of a data module instead of its
  // value is the same mistake as matching an attribute instead of what renders.
  const slugs = INDUSTRIES.map((ind) => ind.slug);
  ok(
    "app/data/industries.js still lists slugs",
    slugs.length > 0,
    "the trades strip renders from this array — if it is empty, the rule below proves nothing",
  );
  const missing = slugs.filter((s) => !(s in INDUSTRY_CONTENT));
  ok(
    `every trade in the strip (${slugs.length}) has industry content behind it`,
    missing.length === 0,
    missing.join(", ") + " — /industries/<slug> calls notFound() on these",
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. The page asks again at the bottom
// ═══════════════════════════════════════════════════════════════════════════
//
// check:marketing-cta proves the homepage links to /signup SOMEWHERE, and
// before this section landed the only one was in the hero — above the fold,
// before the visitor knows what the product is, and gone by the time the FAQ
// has answered the last objection. A reader who is convinced at the bottom of
// the page had nothing to click but the footer.

section("The page asks a second time, after the reasons to say yes");

{
  const askers = SECTIONS.filter((rel) =>
    /href="\/signup/.test(stripComments(read(rel))),
  );
  ok(
    "a section BELOW the hero links to /signup",
    askers.length > 0,
    "the hero is the only ask on the page again — a visitor convinced by the FAQ has to scroll back up, or find the nav, which on a phone is behind a hamburger",
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
