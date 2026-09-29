// scripts/check-marketing-cta.mjs
//
//   npm run check:marketing-cta
//
// The homepage has to ASK, and it has to ask for something true.
//
// ══ What was wrong ═══════════════════════════════════════════════════════
//
// Until 2026-09-03 app/(marketing)/page.js — Hero, AIExplainer,
// FeaturesIndustries, FAQ, ResourcesTeaser — contained no link to /signup at
// all. Not a weak one: none. Every other marketing page has one; the homepage
// had zero, so the only route to signup was the nav bar, which on a phone is
// behind a hamburger. Meanwhile `hero.cta` ("Start free trial") and
// `hero.noCard` sat in the catalogue in every language, rendered by nothing.
// Somebody wrote the trial pitch and never wired the button.
//
// That is the dead-control rule from AGENTS.md in its mirror image. A button
// that does nothing is dishonest; a conversion page that never asks is inert.
// Both ship because nothing measured them.
//
// ══ And the second half, which is the one that matters more ══════════════
//
// `hero.noCard` SAID "No credit card required", in every language, and it was
// FALSE. /api/companies commits the Company and then opens Stripe Checkout,
// and app/app/layout.js sends an owner whose company has no subscription back
// to pay before it will show them a dashboard. The offer that IS true is the
// free first month (TRIAL_PRICE = 0 in lib/pricing.js). Wiring up the button
// without reading the string it came with would have shipped a lie onto the
// one surface a stranger judges the product by — worse than the dead button,
// because a dead button disappoints and a false claim is a false claim.
//
// So this file bans that ONE key from the marketing tree, and bans it
// CONDITIONALLY: it reads the English value out of the catalogue and only
// objects while that value is still a no-card claim. Rewrite `hero.noCard` to
// the sentence app/i18n/industries/en.js already uses for the same promise —
// "Your first month is free — your card isn't charged until it ends." — and
// this rule retires itself and says so. A permanent ban on a key would be a
// rule that outlives its reason, which is how a check turns into folklore.
//
// That is what happened: the key was corrected, the ban lifted itself, and the
// run now prints the retirement line instead of the ban. Both halves of the
// mechanism have therefore been exercised in production, which is worth more
// than the rule was. Note the consequence nobody has acted on — hero.noCard is
// now an honest sentence in every language and is still rendered by nothing.
// Whether it goes back under the hero button is a copy decision, not a
// correctness one, so this file does not force it either way.
//
// ══ What this proves, and what it cannot ═════════════════════════════════
//
// It proves the homepage renders a link to /signup, that the link's label
// comes from the catalogue rather than a hardcoded English string, that every
// literal t() key the homepage's own components render actually exists in
// English, and that no marketing file renders a claim the billing flow does
// not keep.
//
// That last clause was FALSE until 2026-09-03 and is worth naming, because the
// header asserting it is how it went unnoticed: the no-card ban was scoped to
// one catalogue key across the files the HOMEPAGE imports, so
// app/(marketing)/compare/compareCopy.js could carry "No card to start" as an
// inline English literal — on /compare and on every /compare/[slug] page — and
// run green. Section 3b is the rule that makes the sentence true: the claim is
// hunted by its words across the whole marketing tree, and the key ban is
// generalised to every key in the catalogue rather than the one where the bug
// was first found.
//
// It cannot prove the CTA is visible, above the fold, contrasted, or
// persuasive. A key assembled at run time — t(`hero.tabs.${key}.label`) — is
// unreadable here; those are COUNTED and reported, never silently passed.
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";
import { MESSAGES } from "../app/i18n/messages.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

let pass = 0;
let dynamicKeys = 0;
const failures = [];

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

const read = (rel) => readFileSync(join(ROOT, rel), "utf8");

/** Comments stripped: a /signup named in a comment is not a link. */
const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

// ═══════════════════════════════════════════════════════════════════════════
// Which files the homepage is actually made of
// ═══════════════════════════════════════════════════════════════════════════
//
// Resolved from the imports rather than listed here. A hardcoded list is a
// list that goes stale the first time somebody renames a section, and it would
// then prove things about a file the homepage no longer renders.

const HOME = "app/(marketing)/page.js";
const MARKETING_DIR = "app/components/marketing";

function resolveSpecifier(spec, fromRel) {
  let rel;
  if (spec.startsWith("@/")) rel = spec.slice(2);
  else if (spec.startsWith(".")) rel = join(dirname(fromRel), spec);
  else return null; // a package
  for (const candidate of [rel, `${rel}.js`, `${rel}/index.js`]) {
    if (existsSync(join(ROOT, candidate))) return candidate;
  }
  return rel; // unresolved — reported by the caller
}

/**
 * Every marketing component the homepage renders, transitively.
 *
 * Follows imports only INTO app/components/marketing: DemoBooking carries the
 * hero's second call to action and has to be in scope, while next/image and
 * lucide-react obviously do not. Bounded by `seen`, so a cycle terminates.
 */
function homepageFiles() {
  const out = [];
  const seen = new Set();
  const queue = [HOME];
  while (queue.length) {
    const file = queue.shift();
    if (seen.has(file)) continue;
    seen.add(file);
    out.push(file);
    const src = stripComments(read(file));
    for (const m of src.matchAll(/^\s*import\s+[^;]*?from\s+["']([^"']+)["']/gm)) {
      const resolved = resolveSpecifier(m[1], file);
      if (!resolved) continue;
      if (!resolved.startsWith(MARKETING_DIR)) continue;
      queue.push(resolved);
    }
  }
  return out;
}

console.log("\nMarketing CTA — the homepage asks, and asks for something true\n");

const FILES = homepageFiles();

console.log(`The homepage is ${FILES.length} files\n`);

// Every import the walk resolved has to be a real file. A renamed section
// otherwise drops silently out of everything below, and the run stays green
// over a page it is no longer reading.
{
  const missing = FILES.filter((f) => !existsSync(join(ROOT, f)));
  ok(
    "every component the homepage imports is a real file",
    missing.length === 0,
    missing.join(", "),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. The ask
// ═══════════════════════════════════════════════════════════════════════════

section("The homepage asks for the signup");

const signupFiles = FILES.filter((f) => /href=["']\/signup/.test(stripComments(read(f))));

ok(
  "at least one homepage component links to /signup",
  signupFiles.length > 0,
  "no href=\"/signup\" anywhere in " +
    FILES.join(", ") +
    " — the only route to signup would be the nav bar, which on a phone is behind the hamburger",
);

// The label has to come out of the catalogue. A /signup link whose text is a
// hardcoded English string is the marketing site's commonest translation leak:
// it renders correctly for the author and in English for everybody else, and
// check:translations cannot see it because there is no key to be missing.
for (const file of signupFiles) {
  const src = stripComments(read(file));
  const idx = src.indexOf('href="/signup');
  // The element the href sits on, from its `<` to the tag that closes it.
  const open = src.lastIndexOf("<", idx);
  const close = src.indexOf("</", idx);
  const element = src.slice(open, close === -1 ? src.length : close);
  ok(
    `${file} — the /signup label comes from t(), not a hardcoded string`,
    /\{\s*t\(/.test(element),
    "the link's text is written inline, so every non-English visitor reads English",
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. Nothing the homepage renders is a key that does not exist
// ═══════════════════════════════════════════════════════════════════════════
//
// t() falls back to English and then to the key itself, so a typo does not
// throw — it prints "pricing.firstMonth" to a customer. check:translations
// compares catalogues against each other and never looks at what a component
// asks for, so nothing checked this before.

section("Every key the homepage renders exists");

const EN = MESSAGES.en || {};

for (const file of FILES) {
  const src = stripComments(read(file));
  const bad = [];
  const unmatchedShapes = [];
  let shapesInFile = 0;

  for (const m of src.matchAll(/\bt\(\s*(["'`])((?:(?!\1).)*)\1/g)) {
    const key = m[2];

    // A literal key: it either exists or it does not.
    if (!key.includes("${")) {
      if (!(key in EN)) bad.push(key);
      continue;
    }

    // t(`hero.tabs.${active.key}.label`) — the exact key depends on state this
    // script cannot evaluate, but its SHAPE does not. Every interpolation
    // becomes one dot-free segment and the pattern is asked whether ANY English
    // key matches it. That is weaker than checking the key — it cannot tell
    // that `analytics` was dropped from the tab list — but it is far from
    // nothing: it catches the whole namespace being renamed or removed, which
    // is what actually happens when a catalogue is reorganised, and it turns a
    // silent skip into an assertion.
    dynamicKeys++;
    shapesInFile++;
    const shape = new RegExp(
      "^" +
        key
          .split(/\$\{[^}]*\}/)
          .map((lit) => lit.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
          .join("[^.]+") +
        "$",
    );
    if (!Object.keys(EN).some((k) => shape.test(k))) unmatchedShapes.push(key);
  }

  ok(`${file} — no t() key missing from English`, bad.length === 0, bad.join(", "));
  if (shapesInFile > 0) {
    ok(
      `${file} — every interpolated key shape still matches something in English`,
      unmatchedShapes.length === 0,
      unmatchedShapes.join(", ") + " — no English key has this shape any more",
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. The claim the billing flow keeps — about the card
// ═══════════════════════════════════════════════════════════════════════════
//
// This rule has flipped once and says why. Until 2026-09-24 a card WAS taken
// at signup (/api/companies opened Stripe Checkout), so the false sentence was
// "no credit card required" and this section banned it. The owner then moved
// the card and the plan out of signup (TRIAL_CARD_REQUIRED = false in
// lib/pricing.js; re-confirmed 2026-09-29): the company is created on its free
// trial with no card, and a card is entered only when a plan is chosen from
// inside the app. The false sentence is now the OPPOSITE one — "your card
// isn't charged until it ends", "a card on file", "the card is what starts
// them" — and that is what is hunted below.
//
// Read from the constant, not assumed: if TRIAL_CARD_REQUIRED ever goes back to
// true, this section says so and stops passing until the copy is revisited,
// rather than silently policing the wrong direction.
section("No marketing surface claims a card is taken at signup");

const pricingSrc = read("lib/pricing.js");
const cardRequired = /export const TRIAL_CARD_REQUIRED = true;/.test(pricingSrc);
ok(
  "lib/pricing.js still says signup takes no card (TRIAL_CARD_REQUIRED = false)",
  /export const TRIAL_CARD_REQUIRED = false;/.test(pricingSrc) && !cardRequired,
  "the card rule below assumes a card-free signup — revisit every 'no card' sentence before flipping it",
);

// The shapes an English "a card is taken" promise takes. Deliberately narrow:
// it must match the sentence that is false now, and must NOT match the true
// one ("No card needed — your first 14 days are free").
const CLAIMS_CARD_TAKEN =
  /card\s+(isn't|is\s+not|won't\s+be)\s+charged\s+until|card\s+on\s+file|card\s+is\s+what\s+starts|no\s+card\s+charged\s+(until|during)|takes\s+a\s+card|a\s+card\s+is\s+taken|card\s+at\s+checkout/i;

// hero.noCard sat in the catalogue for a month rendered by nothing, saying
// whichever of the two claims was current — a dead key is where a false claim
// waits. It was deleted on 2026-09-29 and stays deleted.
{
  const still = Object.entries(MESSAGES).filter(([, m]) => m && "hero.noCard" in m).map(([l]) => l);
  ok("hero.noCard is gone from every catalogue", still.length === 0, still.join(", "));
}

// ═══════════════════════════════════════════════════════════════════════════
// 3b. The same claim, anywhere in the marketing tree
// ═══════════════════════════════════════════════════════════════════════════
//
// Hunted by its WORDS across every marketing file, and through every catalogue
// key a marketing file renders — the lesson of 2026-09-03, when the claim sat
// as an inline English literal in compareCopy.js and a key-scoped rule could
// not see it. The two separate English catalogues the marketing pages read
// (app/i18n/industries/en.js, app/i18n/comparePages/en.js) are read too.
section("The claim itself, anywhere in the marketing tree");

/**
 * Every .js under the marketing surfaces, so a new page is covered on the day
 * it lands rather than on the day somebody remembers to list it.
 */
function treeFiles(dir) {
  const out = [];
  const walk = (abs) => {
    for (const entry of readdirSync(abs)) {
      const full = join(abs, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (entry.endsWith(".js")) out.push(relative(ROOT, full));
    }
  };
  const start = join(ROOT, dir);
  if (existsSync(start)) walk(start);
  return out;
}

const MARKETING_TREE = [
  ...treeFiles("app/(marketing)"),
  ...treeFiles("app/components/marketing"),
];

ok(
  "the marketing tree was found and is not empty",
  MARKETING_TREE.length > 10,
  `only ${MARKETING_TREE.length} files — the walk is reading the wrong directory, and an ` +
    "empty walk passes every rule below without reading anything",
);

/**
 * Comments removed, INCLUDING trailing ones.
 *
 * Load-bearing: the rule is explained in prose in the marketing files' own
 * comments, which quote the false sentence as the thing being refused. A scan
 * over raw source reports the explanation as the offence. `[^:]//` so a URL
 * inside a string is not mistaken for the start of a comment.
 */
const codeOnly = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

{
  const offenders = [];
  for (const file of [...MARKETING_TREE, "app/i18n/industries/en.js", "app/i18n/comparePages/en.js"]) {
    const src = codeOnly(read(file));
    const hit = src.match(CLAIMS_CARD_TAKEN);
    if (hit) offenders.push(`${file} — "${hit[0]}"`);
  }
  ok(
    "no marketing file or marketing catalogue says a card is taken at signup",
    offenders.length === 0,
    offenders.join("; ") +
      " — signup takes no card (TRIAL_CARD_REQUIRED = false). The true wording is " +
      "\"No card needed — your first 14 days are free.\"",
  );
}

{
  // Any key whose English value makes the claim, referenced by any file in
  // the tree.
  const guiltyKeys = Object.keys(EN).filter((k) => CLAIMS_CARD_TAKEN.test(String(EN[k] ?? "")));
  const offenders = [];
  for (const file of MARKETING_TREE) {
    const src = codeOnly(read(file));
    for (const key of guiltyKeys) {
      if (new RegExp(`["'\`]${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'\`]`).test(src)) {
        offenders.push(`${file} renders ${key}`);
      }
    }
  }
  ok(
    `no marketing file renders a catalogue key that makes the claim (${guiltyKeys.length} such key(s) in English)`,
    offenders.length === 0,
    offenders.join("; "),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 2b. The same rule, across the whole tree, in two tiers
// ═══════════════════════════════════════════════════════════════════════════
//
// Section 2 above polices the files the HOMEPAGE imports. Section 3b already
// learned that lesson once for the no-card claim; this is the same
// generalisation applied to the key rule, and it turns up a real thing.
//
// t() takes an optional English fallback, and the two shapes fail completely
// differently:
//
//   t("cost.perYear")            key missing -> the customer reads
//                                "cost.perYear". A bug on the page.
//   t("cost.perYear", "a year")  key missing -> the customer reads "a year",
//                                in every language. Not a bug on the page —
//                                and not translated either.
//
// The second is the one that hides. /cost makes 52 t() calls and, at the time
// this rule was written, not one of those keys existed in the catalogue; the
// same was true of every string in compare/AddOnStack.js. Both files LOOK
// translated — they are full of t() — and both render English to a German
// visitor. check:translations cannot see it, because it compares catalogues
// against each other and a key that exists in none of them is missing from
// none of them.
//
// So: a missing key with no fallback FAILS, because it puts a dotted
// identifier in front of a stranger. A missing key with a fallback is COUNTED
// and named, per file, every run. Failing those would mean deleting 63 correct
// call sites or blocking the build on a translation job that belongs to
// somebody else; printing them means the debt has a number on it instead of
// being invisible, which is the difference between this and the header that
// said "/compare is English-only" for three months.
section("Every key rendered anywhere in the marketing tree");

{
  // MARKETING_TREE and codeOnly are both defined above, in 3b. This section
  // therefore sits AFTER them rather than beside section 2 where it belongs by
  // subject: codeOnly is a const arrow function, so reading it earlier is a
  // temporal-dead-zone throw rather than a hoist.
  const files = MARKETING_TREE;
  const raw = [];
  const fallbackOnly = new Map();

  for (const file of files) {
    const src = codeOnly(read(file));
    // The capture on the comma is what separates the two tiers. A key built
    // from a template literal is section 2's business and is skipped here.
    for (const m of src.matchAll(/\bt\(\s*"([^"$]+)"\s*(,)?/g)) {
      const key = m[1];
      if (key in EN) continue;
      if (m[2]) fallbackOnly.set(file, (fallbackOnly.get(file) || 0) + 1);
      else raw.push(`${file} — t("${key}") with no fallback`);
    }
  }

  ok(
    "no marketing file renders a key that exists nowhere and has no fallback",
    raw.length === 0,
    raw.join("; ") + " — the visitor reads the key itself",
  );

  const total = [...fallbackOnly.values()].reduce((n, c) => n + c, 0);
  console.log(
    `\n  ${total} t() call(s) across ${fallbackOnly.size} file(s) resolve to their English\n` +
      "  fallback in every language, because the key is not in the catalogue. These render\n" +
      "  correctly and are NOT failures — they are the translation debt, counted:",
  );
  for (const [file, count] of [...fallbackOnly.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${file}: ${count}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 3c. No marketing page is a copy of another marketing page
// ═══════════════════════════════════════════════════════════════════════════
//
// app/(marketing)/careers/page.js was app/(marketing)/about/page.js: the file
// was copied, the component renamed, and the BODY never rewritten — so
// /careers rendered "About FieldQuo" and the About paragraph, byte for byte,
// under a <title> promising careers. A previous pass spotted it, wrote the
// finding into the file's header, and shipped the duplicate anyway.
//
// This is the ninth recurring failure class in AGENTS.md — copy-paste instead
// of a shared helper, where "the copy is the one that rots, because it's the
// one nobody looks at" — in the form where the copy is a whole PAGE. Nothing
// in the repo could see it: every check here reads one page at a time, and a
// duplicate is only visible by comparing two.
//
// Compared on the rendered body, not on the file: metadata, imports and the
// component's own name are all expected to differ between two pages that are
// otherwise the same document, and comparing whole files would have called
// these two distinct.
section("No marketing page renders another page's body");

{
  const PAGES = MARKETING_TREE.filter((f) => f.endsWith("page.js"));
  const bodies = new Map();
  const dupes = [];
  let compared = 0;

  for (const file of PAGES) {
    const src = codeOnly(read(file));
    const at = src.indexOf("export default function");
    if (at === -1) continue; // not a component page; nothing to compare
    const body = src
      .slice(at)
      // The component's NAME is the one difference a rename is allowed to
      // make. Normalised away, or the rename alone would clear this rule
      // while leaving the identical page behind — which is exactly what
      // happened to /careers.
      .replace(/export default function\s+\w+/, "export default function")
      .replace(/\s+/g, " ")
      .trim();
    if (!body) continue;
    compared++;
    if (bodies.has(body)) dupes.push(`${file} is identical to ${bodies.get(body)}`);
    else bodies.set(body, file);
  }

  ok(
    "enough marketing pages were read to compare",
    compared > 5,
    `only ${compared} page bodies parsed — nothing is being compared`,
  );
  ok(
    `no two of the ${compared} marketing page bodies are identical`,
    dupes.length === 0,
    dupes.join("; ") +
      " — one of them is a copy that was never rewritten, and it is serving the " +
      "wrong page to whoever followed the link",
  );
}

// The free first month is the part that IS true, and it is only true while
// lib/pricing.js says so. If somebody starts charging for month one, the
// homepage's "First month · Free" becomes the next false claim on this page.
section("The free-first-month claim is still true");
{
  const pricing = read("lib/pricing.js");
  const m = pricing.match(/export const TRIAL_PRICE\s*=\s*([\d.]+)/);
  ok(
    "lib/pricing.js still prices the first month at zero",
    m && Number(m[1]) === 0,
    m
      ? `TRIAL_PRICE is ${m[1]} — the homepage renders pricing.free under its CTA and would now be lying`
      : "TRIAL_PRICE not found in lib/pricing.js",
  );
}

function section(title) {
  console.log(`\n${title}`);
}

console.log(
  `\n${dynamicKeys} t() call${dynamicKeys === 1 ? "" : "s"} built from a template literal ` +
    "were checked by SHAPE, not by key — see the note above the rule for what that\n" +
    "does and does not prove",
);

if (failures.length) {
  console.log(`\n${failures.length} FAILED of ${pass + failures.length}`);
  for (const f of failures) console.log(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`\nALL PASS — ${pass} checks`);
