// scripts/check-brand-scope.mjs
//
// Guards one product decision: a company's brand colour themes what a CLIENT
// sees — the quote, the invoice, the emails, the PDF, the booking page, the
// portal, the public site — and never the back office.
//
// ── Why a check and not a comment ───────────────────────────────────────────
//
// The colour used to be applied by wrapping the whole /app shell in
// data-brand + <BrandTheme>. That is a one-line change to re-add, it looks
// tidy, and it silently repaints every screen a contractor's staff work in all
// day. The reverse mistake is quieter still: 77 files under app/app/ paint
// primary buttons with bg-inverted, so the difference between "themed" and
// "not themed" is invisible in a diff and only shows up in a browser with a
// lime-green company loaded.
//
// ── The orphan problem ──────────────────────────────────────────────────────
//
// data-brand and <BrandTheme> only work as a pair: the attribute is the
// selector's hook, the component is the <style> block that targets it. Either
// one alone is a dead control of exactly the kind AGENTS.md forbids — an
// attribute with no style block is a region that silently doesn't theme, and a
// style block with no attribute is CSS nothing matches. So the pairing is
// asserted in both directions.
//
// Deliberately textual rather than a render test: what's being guarded is
// where the wrapper is MOUNTED, and mounting is a property of the source, not
// of any one render.

import fs from "node:fs";
import path from "node:path";

const SKIP = new Set(["node_modules", ".next", ".git", ".vercel"]);
const ROOTS = ["app", "lib"];

// The component that DEFINES the theme. It names data-brand in CSS selector
// strings and cannot render itself, so the pairing rule can't apply to it.
const THEME_COMPONENT = "app/components/BrandTheme.js";

// The shell. Never themed — this is the whole point of the decision.
const APP_SHELL = "app/app/layout.js";

// The /app regions that MIRROR a client-facing document, listed by path so
// that deleting a wrapper fails here instead of shipping a preview in the
// wrong colours. A quote is checked against what the client will read; check
// it in FieldQuo navy and the check is weaker than it looks.
//
// Only surfaces that theme through the SEMANTIC TOKENS belong here. The
// branding page's own preview, the email-template editor, the funnel step
// preview, the kitchen designer and the website builder all compute literal
// hex (or iframe the real public route) and need no wrapper — adding one would
// be a second mechanism to keep in step.
const DOCUMENT_PREVIEWS = ["app/app/quotes/[id]/page.js"];

// Public, client-facing routes. These render for a stranger who may have no
// JS, and the PDF renderer has no cascade at all, so they compute literal hex
// from Company.brandColor. A data-brand appearing here means someone has
// started a second, divergent mechanism.
const CLIENT_FACING = [
  "app/q",
  "app/quote",
  "app/book",
  "app/portal",
  "app/site",
  "app/embed",
  "app/f",
  "app/instant-quote",
  "lib/documentSections",
  "lib/documents",
  "lib/email",
];

// Stale claims from when the shell was themed. Present tense only: the header
// is allowed — encouraged — to describe what it USED to do, which is why this
// matches the old assertions rather than the words "whole app".
const STALE_CLAIMS = [
  /applies a company's brand colour to the whole app chrome/i,
  /themes? the whole app\b/i,
  /the sidebar, buttons, active states and accents all become theirs/i,
];

let pass = 0;
let fail = 0;
const ok = (name, cond, detail) => {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name}${detail ? `\n      ${detail}` : ""}`);
  }
};

/**
 * Comments are stripped before scanning, for the reason check-imports.mjs
 * gives: a scanner that reads prose as code eventually flags the paragraph
 * explaining why the code is right. Both files here now carry comments that
 * say the words "data-brand" and "BrandTheme" in the course of explaining
 * where they must NOT appear.
 */
const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/**
 * A data-brand JSX ATTRIBUTE, not the CSS selector `[data-brand]`.
 *
 * The distinction is load-bearing: BrandTheme.js legitimately contains the
 * selector twice, and matching that would make the definition file look like a
 * themed surface.
 */
const hasBrandAttr = (src) => /(?:^|[\s<])data-brand(?=[\s>=/])/.test(stripComments(src));

const rendersTheme = (src) => /<BrandTheme[\s/>]/.test(stripComments(src));

const importsTheme = (src) =>
  /from\s+["']@\/app\/components\/BrandTheme["']/.test(stripComments(src));

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(js|jsx|mjs)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const read = (p) => (fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null);
const files = ROOTS.flatMap((r) => walk(r));
const norm = (p) => p.split(path.sep).join("/");

// ── The shell is not themed ─────────────────────────────────────────────────

console.log("\nThe /app shell carries FieldQuo's palette, not the company's");
{
  const src = read(APP_SHELL);
  ok(`${APP_SHELL} exists`, src !== null);
  if (src !== null) {
    ok("...renders no <BrandTheme>", !rendersTheme(src));
    ok("...carries no data-brand attribute", !hasBrandAttr(src));
    ok("...doesn't even import BrandTheme", !importsTheme(src));
  }
}

// ── No shell file anywhere reintroduces it ──────────────────────────────────
//
// The regression this catches is someone solving "my brand colour disappeared"
// by putting the wrapper back one level down — on a settings layout, say,
// which themes a whole section of the back office just as wrongly.

console.log("\nNo layout/template file themes a section of the back office");
{
  const shells = files.filter((f) => /(^|\/)(layout|template)\.(js|jsx)$/.test(norm(f)));
  ok(`found layout/template files to check`, shells.length > 0, `found ${shells.length}`);
  const themed = shells.filter((f) => {
    const src = read(f);
    return hasBrandAttr(src) || rendersTheme(src);
  });
  ok(
    "no shell file mounts the brand theme",
    themed.length === 0,
    themed.map(norm).join(", "),
  );
}

// ── The pair is never split ─────────────────────────────────────────────────

console.log("\ndata-brand and <BrandTheme> travel together");
{
  const attrOnly = [];
  const themeOnly = [];
  for (const f of files) {
    if (norm(f) === THEME_COMPONENT) continue;
    const src = read(f);
    const a = hasBrandAttr(src);
    const b = rendersTheme(src);
    if (a && !b) attrOnly.push(norm(f));
    if (b && !a) themeOnly.push(norm(f));
  }
  ok(
    "no data-brand without a <BrandTheme> to fill it",
    attrOnly.length === 0,
    attrOnly.join(", "),
  );
  ok(
    "no <BrandTheme> without a data-brand to scope it",
    themeOnly.length === 0,
    themeOnly.join(", "),
  );
}

// ── The document previews still have their wrapper ──────────────────────────

console.log("\nIn-app previews of a client document are still themed");
for (const rel of DOCUMENT_PREVIEWS) {
  const src = read(rel);
  ok(`${rel} exists`, src !== null);
  if (src === null) continue;
  ok(`  ...renders <BrandTheme>`, rendersTheme(src));
  ok(`  ...scopes it with data-brand`, hasBrandAttr(src));
  // Without this the wrapper could be present and fed nothing, which renders
  // FieldQuo navy while looking entirely correct in the diff.
  ok(
    `  ...feeds it a brandColor`,
    /<BrandTheme[\s\S]{0,200}?brandColor=/.test(stripComments(src)),
  );
}

// ── Client-facing routes keep computing their own hex ───────────────────────

console.log("\nClient-facing surfaces don't depend on the CSS-variable path");
{
  const leaked = files
    .filter((f) => CLIENT_FACING.some((d) => norm(f).startsWith(`${d}/`)))
    .filter((f) => hasBrandAttr(read(f)) || rendersTheme(read(f)))
    .map(norm);
  ok(
    "no public route or renderer uses data-brand/<BrandTheme>",
    leaked.length === 0,
    leaked.join(", "),
  );
}

// ── The documentation matches the code ──────────────────────────────────────

console.log("\nBrandTheme's header describes what it actually does");
{
  const src = read(THEME_COMPONENT);
  ok(`${THEME_COMPONENT} exists`, src !== null);
  if (src !== null) {
    const header = src.slice(0, src.indexOf("import"));
    const stale = STALE_CLAIMS.filter((re) => re.test(header)).map(String);
    ok("no leftover claim that it themes the whole app", stale.length === 0, stale.join(", "));
    // A comment that merely stops making the wrong claim is not the same as
    // one that makes the right one. The boundary has to be named, or the next
    // reader has no way to know the omission was deliberate.
    ok(
      "...and it names the boundary it now respects",
      /\/app\b/.test(header) && /back office|staff/i.test(header),
    );
  }
}

console.log(
  `\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed\n`,
);
process.exit(fail ? 1 : 0);
