// scripts/check-site-relayout-carry.mjs
//
//   node --import ./scripts/alias-loader.mjs scripts/check-site-relayout-carry.mjs
//
// ── A destructive operation labelled as cosmetic ──────────────────────────
//
// The Layout and Style chips in the website builder said, in the code:
//
//   "It carries the company's photos AND their wording across (see carryCopy
//    in generateSite), which is why it needs no 'this will overwrite your
//    edits' warning: nothing of theirs is lost, only rearranged."
//
// and told the user afterwards:
//
//   "Applied {label}. Your photos and wording carried over — edit anything,
//    then Save."
//
// carryCopy does carry, and CARRY_TEXT covers faq.items, process.steps and
// credentials.items explicitly. The loss was in the ARGUMENT. The route read
//
//   select: { blocks: true, handEditedAt: true, languages: true }
//
// and `blocks` is the HOME page only — the schema note on CompanySite says so.
// Every site the current builder produces is multi-page, and buildPages puts
// the FAQ, the process steps and the credentials on their own pages. So those
// block types had nothing to carry FROM, and build() produces them empty on
// purpose (`faq: () => ({ items: [] })`). buildPages then dropped the FAQ page
// out of the menu entirely, because it had no items left.
//
// No AI call happens on the chip path — it is deliberately quota-free — so
// nothing regenerated them. One click, no warning, and a success message
// stating the opposite of what had happened.
//
// ── What this file asserts, and why in that order ─────────────────────────
//
// The load-bearing assertion is #1: it RUNS buildPages and requires that the
// types at risk really are off Home. If a future change moved the FAQ back
// onto Home, the bug would stop existing and this file should be re-read
// rather than left asserting a route detail for a reason that had lapsed.
//
// #2 is the fix itself, and #3 is the half that would silently undo it: the
// carry is order-sensitive (first-wins by type), so Home has to stay first.

import { readFileSync } from "node:fs";
import { buildPages } from "@/lib/site/buildPages";

let pass = 0;
const failures = [];
// Label FIRST. Reversed, a non-empty string becomes the condition and nothing
// here could ever fail.
const ok = (label, cond) => (cond ? (pass++, undefined) : failures.push(label));

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
// Anchored to the start of a line: an unanchored block-comment regex treats
// `accept="image/*"` as an opener and eats the file, which fakes a pass on
// every negative assertion. See check-settings-empty-vs-error.mjs.
const stripComments = (src) =>
  src
    .replace(/^[ \t]*\{\s*\/\*[\s\S]*?\*\/\s*\}/gm, "")
    .replace(/^[ \t]*\/\*[\s\S]*?\*\//gm, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");

const route = stripComments(read("app/api/settings/website/route.js"));
const builder = stripComments(read("app/app/settings/website/Builder.js"));
const generate = stripComments(read("lib/site/generateSite.js"));

ok("the website route survived comment-stripping", route.length > 2000);
ok("Builder.js survived comment-stripping", builder.length > 2000);

// ── 1. The types at risk really are off Home — run the real function ──────
{
  const TYPES = [
    "hero", "services", "faq", "process", "credentials",
    "testimonials", "cta", "contact", "about", "areas", "hours",
  ];
  const blocks = TYPES.map((type, i) => ({ id: `b${i}`, type, content: {} }));
  const pages = buildPages(blocks, {
    faqItems: 3, processSteps: 3, credentials: 2, gallery: 0, testimonials: 2,
  });

  ok("buildPages produces a multi-page site", Array.isArray(pages) && pages.length > 1);

  const home = new Set((pages[0]?.blocks || []).map((b) => b.type));
  const elsewhere = new Set(
    pages.slice(1).flatMap((p) => (p.blocks || []).map((b) => b.type)),
  );

  // Whichever of these the layout places off Home is a type that a Home-only
  // carry loses. At least one must be, or the bug is gone and so is the reason
  // for this file.
  const atRisk = ["faq", "process", "credentials", "about", "areas"].filter(
    (t) => !home.has(t) && elsewhere.has(t),
  );
  ok(
    "at least one carryable block type lives off the Home page",
    atRisk.length > 0,
  );
  ok(
    "...and Home genuinely does not hold it",
    atRisk.every((t) => !home.has(t)),
  );
}

// ── 2. The route carries from every page, not just Home ───────────────────
ok(
  "the route reads `pages` as well as `blocks` off the saved site",
  /select: \{[^}]*\bpages: true\b[^}]*\}/.test(route),
);
ok(
  "...and flattens every page's blocks for the carry",
  /existingAllBlocks/.test(route) &&
    /pages\.flatMap\(\(pg\) => \(Array\.isArray\(pg\?\.blocks\) \? pg\.blocks : \[\]\)\)/.test(
      route,
    ),
);
ok(
  "...and hands THAT to generateSite, not the Home-only list",
  /existingBlocks: existingAllBlocks/.test(route) &&
    !/existingBlocks: Array\.isArray\(existing\?\.blocks\)/.test(route),
);

// ── 3. Home stays first, because the carry is first-wins by type ──────────
//
// carryCopy and carryImages both build `new Map()` keyed by block type and
// skip a type they already hold. Put the other pages first and a duplicated
// type — `hero` appears on every page — would carry the wrong page's copy onto
// Home. The ordering is the contract, so it is asserted rather than assumed.
ok(
  "carryCopy is first-wins by block type",
  /for \(const b of existing\) if \(b\?\.type && !prev\.has\(b\.type\)\) prev\.set\(b\.type, b\)/.test(
    generate,
  ),
);
ok(
  "carryImages is too",
  /if \(block\?\.type && !previous\.has\(block\.type\)\) previous\.set\(block\.type, block\)/.test(
    generate,
  ),
);
ok(
  "the flattened list puts the Home blocks first",
  /\[\s*\.\.\.\(Array\.isArray\(existing\?\.blocks\) \? existing\.blocks : \[\]\),\s*\.\.\.\(Array\.isArray\(existing\?\.pages\)/.test(
    route,
  ),
);

// ── 4. The fields the claim depends on are actually in CARRY_TEXT ─────────
//
// The message promises the company's wording survives. If a type is dropped
// from CARRY_TEXT, passing it in changes nothing and the promise quietly stops
// being true again — from the other end.
for (const [type, field] of [
  ["faq", "items"],
  ["process", "steps"],
  ["credentials", "items"],
]) {
  ok(
    `CARRY_TEXT still carries ${type}.${field}`,
    new RegExp(`${type}:\\s*\\[[^\\]]*"${field}"`).test(generate),
  );
}

// ── 5. The claim on screen, still made — and now true ─────────────────────
//
// Asserted so that if someone weakens the carry they have to face the sentence
// as well. Removing the promise is a legitimate fix; leaving it while removing
// the behaviour is not.
ok(
  "the builder still tells the user their wording carried over",
  /app\.siteBuilder\.appliedTemplate/.test(builder),
);

// ── Report ─────────────────────────────────────────────────────────────────
console.log(
  `\ncheck-site-relayout-carry: ${pass} passed, ${failures.length} failed`,
);
for (const f of failures) console.log(`  ✗ ${f}`);
if (failures.length) process.exitCode = 1;
