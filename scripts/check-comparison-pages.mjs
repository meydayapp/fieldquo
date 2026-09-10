// scripts/check-comparison-pages.mjs
//
//   npm run check:comparison-pages
//
// A comparison page has one job, and these pages were doing the opposite of it.
//
// ══ What was wrong ════════════════════════════════════════════════════════
//
// /compare/fieldquo-vs-quoteiq printed all ten of QuoteIQ's price points as a
// neutral catalogue, cheapest first, and then declined to compare them:
// "this page makes no matched claim in either direction — read their list,
// read ours, and decide." A reader's eye lands on $29.99 beside our $99 and
// the page is lost before a word of it is read.
//
// Every lede then opened by making the competitor's case — "Start with what we
// do not have", and on QuoteIQ, "you should buy it rather than us."
//
// ══ What this check protects ══════════════════════════════════════════════
//
// Two things, and they pull against each other, which is why both are here:
//
//   THE ARGUMENT. The page must anchor on capability, lead with FieldQuo, and
//   render the whole product — not a price list, not a highlight reel.
//
//   THE TRUTH. Every claim must survive a prospect opening the competitor's
//   pricing page in the next tab. Four false claims were caught by hand while
//   this was built; each has an assertion below so the next one is caught here
//   instead of by a customer.
//
// ══ Executed ══════════════════════════════════════════════════════════════
//
// Every assertion runs the shipped functions over the real competitor data.
//
// ══ Mutation-tested ═══════════════════════════════════════════════════════
//
// The add-on filter, the annual-only branch and the capability anchor were
// each broken on disk, confirmed to fail here, and restored from a `cp`
// backup — never `git checkout`.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { FEATURE_MATRIX } from "@/lib/marketing/featureMatrix";
import { COMPETITORS } from "@/lib/marketing/competitors";
import {
  tierLadder,
  parityFor,
  neverListed,
  addOnsFor,
  mappingFor,
  firstTierWith,
} from "@/lib/marketing/parity";
import { caseRows } from "@/app/(marketing)/compare/caseRows";
import { COMPARE_PAGES } from "@/app/(marketing)/compare/compareCopy";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

let pass = 0;
const failures = [];
function ok(name, cond, got) {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { failures.push(name); console.log(`  FAIL ${name}${got !== undefined ? `  — got: ${JSON.stringify(got)}` : ""}`); }
}
const section = (t) => console.log(`\n${t}\n`);

const MATRIX_KEYS = new Set(FEATURE_MATRIX.map((e) => e.key));
const MAPPED = ["quoteiq", "jobber", "housecall_pro", "projul", "servicetitan"];

// ═══════════════════════════════════════════════════════════════════════════
section("1. Every competitor produces a real ladder");
// ═══════════════════════════════════════════════════════════════════════════

{
  for (const id of MAPPED) {
    const ladder = tierLadder(id);
    // The bug this catches: Jobber's and Housecall Pro's stored figures were
    // read for PRICES only and carry no feature phrase at all, so the engine
    // reported that Jobber's $499 Plus carried no capability whatsoever.
    ok(`${id} has tiers`, ladder.length > 0, ladder.length);
    ok(`${id}'s top tier carries capabilities`, (ladder.at(-1)?.covers?.size || 0) > 0,
      ladder.at(-1)?.covers?.size);
    // Projul sells a flat ANNUAL fee; a ladder reading only `monthly` skipped
    // every tier and reported they sell nothing.
    ok(`${id} prices every tier it lists`,
      ladder.every((t) => typeof t.price === "number" || t.reported),
      ladder.filter((t) => typeof t.price !== "number" && !t.reported).map((t) => t.label));
  }
}

// ═══════════════════════════════════════════════════════════════════════════
section("2. The mappings are real keys, and their phrases are their words");
// ═══════════════════════════════════════════════════════════════════════════

{
  for (const id of MAPPED) {
    const map = mappingFor(id);
    const bad = [];
    for (const [phrase, keys] of Object.entries(map)) {
      for (const k of keys) if (!MATRIX_KEYS.has(k)) bad.push(`${phrase} -> ${k}`);
    }
    ok(`${id} maps only to capabilities that exist`, bad.length === 0, bad.slice(0, 5));
    ok(`${id} has something mapped`, Object.keys(map).length > 0);

    // An unmapped phrase means they reworded a tier. The comparison silently
    // weakens rather than breaking, so it has to be caught here.
    const unmapped = tierLadder(id).flatMap((t) => t.unmapped || []);
    ok(`${id} has no unmapped tier phrases`, unmapped.length === 0, unmapped.slice(0, 5));
  }
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. The claims survive the competitor's own pricing page");
// ═══════════════════════════════════════════════════════════════════════════

{
  for (const id of MAPPED) {
    // ── The add-on trap ───────────────────────────────────────────────────
    //
    // Projul's support package is $4,500 a YEAR and their page marks it "FREE
    // with annual plan" — and every Projul plan is annual, so it is free.
    // Summing add-ons blindly printed "+$4,500/mo" beside their name: a false
    // claim on their own published terms, disproved in one click, discrediting
    // every true row above it.
    const counted = addOnsFor(id).filter((a) => !a.includedFree && a.per === "month");
    const { rows } = caseRows(id, id);
    const addRow = rows.find((r) => r.label === "Sold as paid add-ons");
    ok(`${id}: an add-on row appears only when something is actually charged monthly`,
      Boolean(addRow) === counted.length > 0, { row: Boolean(addRow), counted: counted.length });
    if (addRow) {
      const total = counted.reduce((n, a) => n + a.price, 0);
      ok(`${id}: the add-on total is what they charge`, addRow.theirs.text.includes(String(total)),
        addRow.theirs.text);
    }

    // A parity tier below their cheapest tier would be arithmetic nonsense.
    const ladder = tierLadder(id).filter((t) => typeof t.price === "number");
    const parity = parityFor(id);
    if (ladder.length && typeof parity.tier?.price === "number") {
      ok(`${id}: the capability-matched tier is not below their cheapest`,
        parity.tier.price >= ladder[0].price, { parity: parity.tier.price, cheapest: ladder[0].price });
    }

    // Never claim a capability is absent when a tier of theirs lists it.
    const wrong = neverListed(id).filter((e) => firstTierWith(id, e.key));
    ok(`${id}: nothing is called missing that they actually list`, wrong.length === 0,
      wrong.map((e) => e.key));
  }
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. The page argues for FieldQuo, in the first screen");
// ═══════════════════════════════════════════════════════════════════════════

{
  // The sentences that were there, verbatim. Each one told a buyer to leave.
  const DEFEATIST = [
    "you should buy it rather than us",
    "Start with what we do not have",
    "the most to concede",
    "makes no matched claim in either direction",
    "read their list, read ours, and decide",
  ];
  for (const page of COMPARE_PAGES) {
    const opening = `${page.title} ${page.description} ${page.lede}`;
    const found = DEFEATIST.filter((d) => opening.includes(d));
    ok(`${page.slug}: the opening does not argue for the competitor`, found.length === 0, found);
    ok(`${page.slug}: it names FieldQuo first`,
      page.title.trim().startsWith("FieldQuo"), page.title);
    // The concession is kept — a page that hides its weakest point is the page
    // a prospect catches. It simply may not be the opening line.
    ok(`${page.slug}: the concession is still carried`,
      typeof page.concessionLede === "string" && page.concessionLede.length > 40);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. The argument is mounted above the catalogue");
// ═══════════════════════════════════════════════════════════════════════════

{
  const page = read("app/(marketing)/compare/[slug]/ComparisonPage.js");
  ok("the case section is rendered", /<TheCase competitor=\{competitor\}/.test(page));
  // Order is the whole point: a reader who leaves after one screen must have
  // read the argument, not the competitor's price list.
  ok("…above the price tables", page.indexOf("<TheCase") < page.indexOf("── Price ──"),
    { case: page.indexOf("<TheCase"), price: page.indexOf("── Price ──") });

  const theCase = read("app/(marketing)/compare/TheCase.js");
  ok("every feature group is rendered, not a highlight reel", /MATRIX_GROUPS\.map/.test(theCase));
  ok("…and the count of what they lack is stated", /missingCount/.test(theCase));
  ok("the calculator the owner already built is linked", /href="\/cost"/.test(theCase));
  // Where we lose, said plainly, rather than quietly dropped from the table.
  ok("a row we lose still renders", /Cheaper there at one person/.test(theCase));
}

// ═══════════════════════════════════════════════════════════════════════════
section("6. The check is wired in");
// ═══════════════════════════════════════════════════════════════════════════

{
  const pkg = JSON.parse(read("package.json"));
  ok("check:comparison-pages is a script", typeof pkg.scripts?.["check:comparison-pages"] === "string");
  ok("…and check:all runs it", (pkg.scripts?.["check:all"] || "").includes("check:comparison-pages"));
  ok("every competitor has a page", COMPARE_PAGES.length === COMPETITORS.length,
    { pages: COMPARE_PAGES.length, competitors: COMPETITORS.length });
}

console.log(`\n${pass} checks, ${failures.length} failure(s).`);
if (failures.length) { for (const f of failures) console.log(`  · ${f}`); process.exit(1); }
