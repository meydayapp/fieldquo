// scripts/check-legal-pages.mjs
//
//   node scripts/check-legal-pages.mjs
//
// FieldQuo's Privacy Policy, Terms of Service and Security page make factual
// claims about the product. This is the check that keeps those claims honest
// as the product changes, rather than trusting whoever last read the code.
// Four things, each because a real drafting mistake looks like this:
//
//   1. No certification claim. "We're SOC 2 compliant" on a page nobody
//      audited is the single worst sentence a startup's legal pages can
//      contain — it's not aspirational copy, it's a claim a customer's own
//      security review will rely on. The security page DOES need to say the
//      words "SOC 2" and "ISO 27001" once each, to deny holding them — so
//      this can't be "the words never appear." It has to be "every time they
//      appear, they're inside a negation," checked with a window around each
//      occurrence rather than trusted from memory.
//
//   2. Effective dates are real constants. `new Date().toLocaleDateString()`
//      rendered "updated today" on every page load, forever — the exact bug
//      that got these pages commissioned in the first place. Checked two
//      ways: the constants in lib/legal/effectiveDates.js are literal
//      YYYY-MM-DD strings, not function calls; and none of the three page
//      sources contain `new Date(` at all.
//
//   3. Every processor named in the Privacy Policy is one the product
//      actually calls. lib/legal/processors.js pairs each named vendor with
//      a `verify` pattern; this script re-derives that proof independently
//      by grepping the real integration files, so a processor can't stay in
//      the policy after the code that justified it is deleted — or appear in
//      the policy without ever having been wired in.
//
//   4. The Quebec privacy-officer placeholder can't ship invisibly unfilled.
//      See lib/legal/privacyOfficer.js's header for the exact rule: while
//      PENDING is true the three fields must still read as the bracketed
//      placeholder (so a half-filled, unconfirmed placeholder can't pass as
//      done); once PENDING is false, none of them may still contain
//      placeholder markup (so flipping the flag alone can't fake it either).
//
// Wired into `npm run check:all` as `check:legal-pages`.

import { readFileSync } from "node:fs";
import { readdirSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { PROCESSORS } from "../lib/legal/processors.js";
import { PRIVACY_OFFICER, PRIVACY_OFFICER_PENDING } from "../lib/legal/privacyOfficer.js";
import {
  PRIVACY_POLICY_EFFECTIVE_DATE,
  TERMS_OF_SERVICE_EFFECTIVE_DATE,
  SECURITY_PAGE_UPDATED_DATE,
} from "../lib/legal/effectiveDates.js";

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), "..");

const PAGES = {
  privacy: "app/(marketing)/privacy/page.js",
  terms: "app/(marketing)/terms/page.js",
  security: "app/(marketing)/security/page.js",
};

function read(relPath) {
  return readFileSync(join(ROOT, relPath), "utf8");
}

const sources = Object.fromEntries(
  Object.entries(PAGES).map(([key, p]) => [key, read(p)]),
);

// Strips `//` line comments and `/* */` block comments — crude (no string-
// literal awareness), but good enough for these three files, none of which
// contain a `//` or `/*` inside an actual string. Used for the "new Date("
// check below, so the file header explaining the bug this page fixes (which
// necessarily quotes `new Date()`) doesn't trip its own check.
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}
const codeOnly = Object.fromEntries(
  Object.entries(sources).map(([key, src]) => [key, stripComments(src)]),
);

let failures = 0;
function fail(message) {
  failures++;
  console.error(`✗ ${message}`);
}
function ok(message) {
  console.log(`✓ ${message}`);
}

// ══ 1. No certification claim ═══════════════════════════════════════════
//
// Every mention of a certification term, on any of the three pages, must sit
// inside a negation. A window rather than "does the sentence start with
// not" — the honest denial on the security page reads "...does not
// currently hold SOC 2, ISO 27001, or any other third-party security
// certification..." and the negation precedes ALL THREE terms at once, so a
// window is the only shape that catches every one of them correctly.
//
// The window is scoped to one JSX block (split on <p>/<li>/<h2>/<h3>/<td>/
// <th> boundaries) BEFORE it's applied — a raw character window over the
// whole file would let a genuine negation in one paragraph cover a bare
// claim sitting in the next one, which a real mutation test caught: "We are
// SOC 2 certified." sitting right after the honest disclaimer paragraph
// passed, because "not" from the PRECEDING paragraph fell inside the raw
// 90-character window. Splitting first closes that.
const CERT_TERMS = [/SOC\s*2/gi, /ISO\s*27001/gi, /\bcertified\b/gi, /\bcertification\b/gi];
const NEGATION_WINDOW = 90; // characters either side of the match, WITHIN one block
const NEGATION = /\b(not|no|never|doesn't|does not|don't|do not|isn't|aren't|without)\b/i;
const BLOCK_BOUNDARY = /<\/?(?:p|li|h2|h3|td|th)\b[^>]*>/gi;

function blocks(src) {
  return src.split(BLOCK_BOUNDARY).filter((b) => b.trim().length > 0);
}

for (const [page, src] of Object.entries(sources)) {
  for (const block of blocks(src)) {
    for (const re of CERT_TERMS) {
      for (const m of block.matchAll(re)) {
        const start = Math.max(0, m.index - NEGATION_WINDOW);
        const end = Math.min(block.length, m.index + m[0].length + NEGATION_WINDOW);
        const window = block.slice(start, end);
        if (!NEGATION.test(window)) {
          fail(
            `${page}: "${m[0]}" appears with no negation within ${NEGATION_WINDOW} chars, ` +
            `in the same block — reads like a certification claim. Context: …${window.replace(/\s+/g, " ")}…`,
          );
        }
      }
    }
  }
}
if (!failures) ok("no page claims a certification FieldQuo doesn't hold");

// Sanity check the other direction too: the disclaimer this whole check
// exists to protect must still actually be there, not just absent-of-harm.
if (!/what we don't claim/i.test(sources.security)) {
  fail('security page: the "What we don\'t claim" section is missing entirely');
}

// ══ 2. Effective dates are real constants, not `new Date()` ════════════════
const failuresBeforeDates = failures;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
for (const [name, value] of [
  ["PRIVACY_POLICY_EFFECTIVE_DATE", PRIVACY_POLICY_EFFECTIVE_DATE],
  ["TERMS_OF_SERVICE_EFFECTIVE_DATE", TERMS_OF_SERVICE_EFFECTIVE_DATE],
  ["SECURITY_PAGE_UPDATED_DATE", SECURITY_PAGE_UPDATED_DATE],
]) {
  if (!DATE_RE.test(value)) {
    fail(`lib/legal/effectiveDates.js: ${name} is "${value}", not a literal YYYY-MM-DD date`);
  }
}

// The check above only proves the IMPORTED VALUE happens to look like a
// date — `new Date().toISOString().slice(0,10)` also matches
// /^\d{4}-\d{2}-\d{2}$/, on the day it's run, which is exactly the "looks
// right today, silently wrong tomorrow" shape this whole page exists to
// rule out. So it isn't enough to check the imported value; the SOURCE of
// effectiveDates.js itself must contain no `new Date(` or `Date.now(`
// anywhere — a mutation test caught this gap directly (see git history of
// this file) and it is why both checks exist rather than either alone.
const effectiveDatesSrc = stripComments(read("lib/legal/effectiveDates.js"));
if (/new Date\(|Date\.now\(/.test(effectiveDatesSrc)) {
  fail("lib/legal/effectiveDates.js: computes a date at runtime (new Date( / Date.now() found) instead of using a literal constant");
}

for (const [page, src] of Object.entries(codeOnly)) {
  if (/new Date\(/.test(src)) {
    fail(`${page}: contains "new Date(" outside a comment — the exact bug this page was commissioned to fix`);
  }
}

const DATE_IMPORT_BY_PAGE = {
  privacy: "PRIVACY_POLICY_EFFECTIVE_DATE",
  terms: "TERMS_OF_SERVICE_EFFECTIVE_DATE",
  security: "SECURITY_PAGE_UPDATED_DATE",
};
for (const [page, constName] of Object.entries(DATE_IMPORT_BY_PAGE)) {
  if (!sources[page].includes(constName)) {
    fail(`${page}: does not reference ${constName} — "Last updated" may not be pinned to anything`);
  }
}
if (failures === failuresBeforeDates) ok("effective dates are pinned constants, not new Date()");

// ══ 3. Every processor named in the policy is one the code actually calls ══
function walk(target, out = []) {
  const full = join(ROOT, target);
  let st;
  try {
    st = statSync(full);
  } catch {
    return out;
  }
  if (st.isFile()) {
    out.push(full);
    return out;
  }
  for (const name of readdirSync(full)) {
    if (name === "node_modules" || name === ".next" || name.startsWith(".")) continue;
    const childRel = join(target, name);
    const childFull = join(ROOT, childRel);
    if (statSync(childFull).isDirectory()) walk(childRel, out);
    else if (/\.(js|jsx|mjs|prisma|md)$/.test(name)) out.push(childFull);
  }
  return out;
}

const failuresBeforeProcessors = failures;
for (const proc of PROCESSORS) {
  const { pattern, files, roots } = proc.verify;
  const targets = files || roots;
  const candidateFiles = targets.flatMap((t) => walk(t));
  const found = candidateFiles.some((f) => pattern.test(readFileSync(f, "utf8")));
  if (!found) {
    fail(
      `processor "${proc.name}": verify pattern ${pattern} not found in ${targets.join(", ")} — ` +
      `${proc.verify.description}. Either the integration was removed (drop it from the policy) ` +
      `or the check needs updating (the integration moved).`,
    );
  }
}
if (!sources.privacy.includes("PROCESSORS")) {
  fail("privacy page: does not import/render PROCESSORS — the table could have been hand-typed and drifted");
} else if (!sources.privacy.includes("PROCESSORS.map")) {
  fail("privacy page: imports PROCESSORS but doesn't map over it — every entry must actually render, not just import cleanly");
}
if (failures === failuresBeforeProcessors) {
  ok(`all ${PROCESSORS.length} named processors verified against real integration code`);
}

// ══ 4. The privacy-officer placeholder is detectable, not silently unfilled ═
const PLACEHOLDER_MARK = "[[PLACEHOLDER";
const officerFields = {
  name: PRIVACY_OFFICER.name,
  title: PRIVACY_OFFICER.title,
  contact: PRIVACY_OFFICER.contact,
};

const failuresBeforeOfficer = failures;
if (PRIVACY_OFFICER_PENDING) {
  for (const [field, value] of Object.entries(officerFields)) {
    if (!value.includes(PLACEHOLDER_MARK)) {
      fail(
        `lib/legal/privacyOfficer.js: PRIVACY_OFFICER.${field} looks filled in ("${value}") ` +
        `but PRIVACY_OFFICER_PENDING is still true — either it's real (flip PENDING to false) ` +
        `or it isn't (restore the placeholder).`,
      );
    }
  }
} else {
  for (const [field, value] of Object.entries(officerFields)) {
    if (value.includes(PLACEHOLDER_MARK)) {
      fail(
        `lib/legal/privacyOfficer.js: PRIVACY_OFFICER_PENDING is false but ` +
        `PRIVACY_OFFICER.${field} still contains placeholder markup — it was never actually filled in.`,
      );
    }
  }
}
// Checking for the bare identifier "PRIVACY_OFFICER" isn't enough — a
// mutation test proved it: deleting the whole Quebec section but leaving the
// top-of-file `import { PRIVACY_OFFICER } from ...` behind (an unused
// import, which nothing here lints for) still contains the string
// "PRIVACY_OFFICER" and passed. Require the three FIELDS to actually be
// read off it and rendered, the same fix already applied to PROCESSORS.map
// above.
for (const field of ["name", "title", "contact"]) {
  if (!sources.privacy.includes(`PRIVACY_OFFICER.${field}`)) {
    fail(`privacy page: does not render PRIVACY_OFFICER.${field} — the Quebec Law 25 section may have been deleted while the import stayed behind`);
  }
}
if (failures === failuresBeforeOfficer) {
  ok(
    PRIVACY_OFFICER_PENDING
      ? "privacy-officer placeholder is present and honestly marked unfilled"
      : "privacy-officer fields are filled in and the pending flag agrees",
  );
}

// Generic well-formedness: every "[[PLACEHOLDER" marker across all three
// pages (and the officer file) must close with "]]" — catches a placeholder
// mangled by a careless edit into something that no longer reads as one.
const PLACEHOLDER_OPEN = /\[\[PLACEHOLDER/g;
const PLACEHOLDER_CLOSED = /\[\[PLACEHOLDER:[^\]]*\]\]/g;
for (const [page, src] of Object.entries(sources)) {
  const opens = (src.match(PLACEHOLDER_OPEN) || []).length;
  const closed = (src.match(PLACEHOLDER_CLOSED) || []).length;
  if (opens !== closed) {
    fail(`${page}: ${opens} placeholder marker(s) opened but only ${closed} well-formed — a placeholder may have been mangled`);
  }
}

console.log("");
if (failures) {
  console.error(`${failures} problem(s) found in the legal pages.`);
  process.exit(1);
}
console.log("✓ legal pages: all checks passed");
