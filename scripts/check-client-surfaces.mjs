// scripts/check-client-surfaces.mjs
//
//   npm run check:client-surfaces
//
// Three assertions about the pages a HOMEOWNER sees — the public quote, the
// booking page and the contractor's own website. All three exist because a
// live QA pass found the defect on a real tenant's page, not because the code
// looked wrong.
//
// ── 1. The eyebrow label on a company website is TEXT ──────────────────────
//
// app/site/[subdomain]/SiteBlocks.js says in its own header that `accent2`
// (brandColors.secondary) is "never for text that must hit 4.5:1". It was: the
// Eyebrow component painted the raw hex onto the label as well as onto the rule
// beside it. Teacup Poodle's secondary is #ebebeb, so WHAT WE DO / OUR WORK /
// GET IN TOUCH and the 01-02-03 markers rendered at 1.19:1 on their published
// page — in the DOM, invisible on the screen.
//
// A secondary brand colour is the one input in that file nobody measured, which
// is precisely what documentTheme exists for. So this checks the mechanism
// (ensureContrast against the darker of the two backgrounds an eyebrow ever
// sits on) AND that the component still routes through it, because the
// mechanism being correct is worth nothing if a future edit paints the raw hex
// again.
//
// ── 2. Approve is the button this whole product is for ─────────────────────
//
// #16a34a under white 14px semibold measures 3.30:1. Not brand-derived, not
// theme-derived, just a literal nobody put a number on.
//
// ── 3. A company's name must not be glued to the next word ─────────────────
//
// `{company.name} hasn't set up online booking yet.` looks like it has a space
// and does not: the space belongs to a JSX text run that continues onto the
// next line, and the compiler trims it. Every visitor to a company with no
// event types read "Cedar & Co. Flooringhasn't set up online booking yet."
// Checked as a PATTERN over the client-facing routes rather than as one string,
// because the next person to write it will write it the same way.

import fs from "node:fs";
import path from "node:path";

import { documentTheme } from "@/lib/documents/theme";
import { ensureContrast, contrastRatio } from "@/lib/brand/colour";

let fail = 0;
let checks = 0;
const bad = (msg) => {
  console.log(`  ✗ ${msg}`);
  fail++;
};
const ok = (msg) => {
  console.log(`  ✓ ${msg}`);
};
const read = (p) => fs.readFileSync(path.join(process.cwd(), p), "utf8");

const SITE_BLOCKS = "app/site/[subdomain]/SiteBlocks.js";
const QUOTE_APPROVAL = "app/q/[token]/QuoteApproval.js";
const BOOKING_FLOW = "app/book/[companySlug]/BookingFlow.js";

/* ─────────── 1a. The eyebrow ink mechanism, measured ─────────── */
//
// Primary/secondary pairs a contractor actually saved. The first four are the
// live tenants; the rest are the colours the rest of this repo's contrast
// checks use, because "it works for the four rows in the database today" is
// not the claim being made.
const PAIRS = [
  ["Teacup Poodle", "#fefcdd", "#ebebeb"],
  ["Black Roofs", "#263e0f", "#fff994"],
  ["Sunset Inc", "#ffffff", "#cf222e"],
  ["Big painter Inc", "#c0c0c0", "#000000"],
  ["white on white", "#ffffff", "#ffffff"],
  ["paper on paper", "#fafafa", "#fdfdfd"],
  ["lime", "#0b2e59", "#b4ff00"],
  ["safety orange", "#212121", "#ff6b00"],
  ["pale beige", "#6b4423", "#ede8dd"],
  ["mid grey", "#008080", "#808080"],
  ["hot pink", "#000000", "#ff1493"],
  ["sky", "#8b0000", "#87ceeb"],
];

console.log("\nSite eyebrow label — 4.5:1 on paper AND on the accent wash\n");
for (const [name, brand, secondary] of PAIRS) {
  const theme = documentTheme({ brandColor: brand });
  // The same expression eyebrowInk() uses in SiteBlocks.js. Measured against
  // accentWash, the darker of the two backgrounds an eyebrow ever sits on.
  const ink = ensureContrast(secondary, theme.accentWash, 4.5);
  const onWash = contrastRatio(ink, theme.accentWash);
  const onPaper = contrastRatio(ink, theme.paper);
  checks += 2;
  const raw = contrastRatio(secondary, theme.paper);
  if (!(onWash >= 4.5) || !(onPaper >= 4.5)) {
    bad(
      `${name.padEnd(16)} secondary ${secondary} → ${ink}  wash ${onWash.toFixed(2)}  paper ${onPaper.toFixed(2)}`,
    );
  } else {
    ok(
      `${name.padEnd(16)} secondary ${secondary} → ${ink}  wash ${onWash.toFixed(2)}  paper ${onPaper.toFixed(2)}  (raw was ${raw.toFixed(2)})`,
    );
  }
}

// Garbage in must not produce a NaN colour — the eyebrow would then inherit
// whatever is underneath, which is the invisible case again by another route.
for (const junk of [null, undefined, "", "not a colour", "#12", "#GGGGGG", 42, {}]) {
  const theme = documentTheme({ brandColor: junk });
  const ink = ensureContrast(theme.accentText, theme.accentWash, 4.5);
  checks++;
  if (!Number.isFinite(contrastRatio(ink, theme.accentWash))) {
    bad(`junk brand ${JSON.stringify(junk)} → non-finite eyebrow contrast`);
  }
}

/* ─────────── 1b. …and the component still routes through it ─────────── */

console.log("\nSiteBlocks.js still sends the eyebrow label through eyebrowInk()\n");
{
  const src = read(SITE_BLOCKS);
  // Its body as well as its name: "goes through a function called eyebrowInk"
  // is not the claim — "is measured to 4.5:1 against the darker of the two
  // backgrounds it can sit on" is, and a target of 3 would still be a call.
  checks++;
  const body = src.match(/function eyebrowInk\([^)]*\)\s*\{([\s\S]*?)\n\}/);
  if (!body) {
    bad(`${SITE_BLOCKS} no longer defines eyebrowInk()`);
  } else if (!/ensureContrast\(\s*accent2\s*,\s*theme\.accentWash\s*,\s*4\.5\s*\)/.test(body[1])) {
    bad(`eyebrowInk() no longer measures accent2 to 4.5:1 against accentWash: ${body[1].trim()}`);
  } else {
    ok("eyebrowInk() measures accent2 to 4.5:1 against the accent wash");
  }

  // Every <Eyebrow> gets a measured `tone`, except the overlay hero, which
  // hands it a literal #ffffff for a scrimmed photograph and wants that for
  // both the label and the rule.
  const calls = [...src.matchAll(/<Eyebrow\b[^>]*>/g)].map((m) => m[0]);
  checks++;
  if (calls.length === 0) {
    bad("no <Eyebrow> call sites found — has the component been renamed?");
  }
  for (const call of calls) {
    checks++;
    const literal = /accent2="#[0-9a-fA-F]{3,8}"/.test(call);
    if (literal) {
      ok(`literal-colour eyebrow left alone: ${call.slice(0, 60)}`);
      continue;
    }
    if (!/tone=\{eyebrowInk\(/.test(call)) {
      bad(`<Eyebrow> without a measured tone: ${call.slice(0, 90)}`);
    } else {
      ok(`measured tone: ${call.slice(0, 60)}…`);
    }
  }

  // The 01/02/03 markers in the alternating service layouts are eyebrows too,
  // written inline rather than through the component.
  const markerColours = [...src.matchAll(/S\?\.eyebrow \|\|[\s\S]{0,200}?color:\s*([A-Za-z0-9_.()\s,]+?)\s*\}\}/g)];
  checks++;
  if (markerColours.length < 2) {
    bad(`expected the inline 01/02/03 eyebrows in ${SITE_BLOCKS}, found ${markerColours.length}`);
  }
  for (const m of markerColours) {
    checks++;
    if (!/eyebrowInk\(/.test(m[1])) {
      bad(`inline eyebrow marker painted with an unmeasured colour: ${m[1].trim()}`);
    } else {
      ok(`inline eyebrow marker measured: ${m[1].trim()}`);
    }
  }
}

/* ─────────── 2. The approve button ─────────── */

console.log("\nPublic quote — Approve reads against its own fill\n");
{
  const src = read(QUOTE_APPROVAL);
  const m = src.match(/const APPROVE_GREEN = "(#[0-9a-fA-F]{6})"/);
  checks++;
  if (!m) {
    bad(`${QUOTE_APPROVAL} does not define APPROVE_GREEN`);
  } else {
    const ratio = contrastRatio(m[1], "#ffffff");
    checks++;
    if (ratio < 4.5) {
      bad(`APPROVE_GREEN ${m[1]} vs white label = ${ratio.toFixed(2)}:1`);
    } else {
      ok(`APPROVE_GREEN ${m[1]} vs white label = ${ratio.toFixed(2)}:1`);
    }
  }

  // The old fill must not come back. Comments are stripped first — the note
  // above APPROVE_GREEN names the colour it replaced, and a check that cannot
  // tell an explanation from a paint call would forbid explaining anything.
  checks++;
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  if (/#16a34a/i.test(code)) {
    bad(`#16a34a is back in ${QUOTE_APPROVAL} — it measures 3.30:1 under a white label`);
  } else {
    ok("#16a34a is not painted anywhere on the public quote");
  }
  checks++;
  const declineFill = src.match(/confirming === "accepted" \? APPROVE_GREEN : "(#[0-9a-fA-F]{6})"/);
  if (!declineFill) {
    bad("the confirm button's decline fill is no longer where this check expects it");
  } else {
    const ratio = contrastRatio(declineFill[1], "#ffffff");
    checks++;
    if (ratio < 4.5) bad(`decline fill ${declineFill[1]} vs white = ${ratio.toFixed(2)}:1`);
    else ok(`decline fill ${declineFill[1]} vs white = ${ratio.toFixed(2)}:1`);
  }
}

/* ─────────── 3. JSX that glues a value to the next word ─────────── */
//
// The exact trigger, established by reading the compiled bundles rather than
// by reasoning about JSX whitespace rules: a text run that
//
//   • starts with a space immediately after a `{…}` expression,
//   • continues onto at least one more source line, AND
//   • contains an HTML entity (&apos;, &rsaquo;, &#8212;)
//
// loses that leading space. Any one of the three alone is harmless — a
// single-line run keeps its space, and so does a multi-line run with no
// entity, which is why `{showSheet ? "Hide" : "See"} the finished drawing`
// renders correctly two files away from one that doesn't. All three together
// produced twelve broken sentences in this repo, including
// "Cedar & Co. Flooringhasn't set up online booking yet." on the booking page,
// "someone@example.comwill stop receiving marketing email" on the unsubscribe
// confirmation, and "That leaves 1day to approve everyone's hours" in payroll.
//
// Repo-wide, not just the client routes: the glued word is a company name, a
// person's name or an email address wherever it happens, and the reader cannot
// tell it is a rendering bug rather than bad data.

const SCAN_ROOTS = ["app", "lib", "components"];

export function gluedJsxText(lines) {
  const hits = [];
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (/^\s*(\/\/|\*|\/\*)/.test(raw)) continue;
    // Prose starting right after an expression close and running to the end of
    // the line — no tag or brace after it, so the run is still open.
    const m = raw.match(/\}(\s[A-Za-z&][^<>{}]*)$/);
    if (!m) continue;

    // The rest of the run, up to whatever closes it. Matching to end-of-line
    // above already means the run contains a newline; these lines are gathered
    // only so an entity further down still counts, which the compiled output
    // for EmailCampaignDetail proves it does.
    let run = m[1];
    for (let j = i + 1; j < lines.length; j++) {
      const next = lines[j].trim();
      if (next === "" || /^[<{]/.test(next)) break;
      if (/[<{]/.test(next)) {
        run += ` ${next.split(/[<{]/)[0]}`;
        break;
      }
      run += ` ${next}`;
    }
    if (!/&(#\d+|[a-zA-Z]+);/.test(run)) continue;
    hits.push({ line: i + 1, text: raw.trim().slice(0, 90) });
  }
  return hits;
}

console.log("\nJSX — no value glued to the word after it\n");
{
  const files = [];
  const walk = (d) => {
    if (!fs.existsSync(d)) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if ([".next", "node_modules", ".git"].includes(e.name)) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      // The message catalogues are data, not markup — "{count} things" there is
      // a placeholder for an interpolator, not two JSX children.
      else if (/\.jsx?$/.test(e.name) && !p.includes(`${path.sep}i18n${path.sep}`)) files.push(p);
    }
  };
  for (const r of SCAN_ROOTS) walk(path.join(process.cwd(), r));

  checks++;
  if (files.length < 500) bad(`only ${files.length} files scanned — did the tree move?`);

  let hits = 0;
  for (const f of files) {
    const rel = path.relative(process.cwd(), f);
    for (const h of gluedJsxText(fs.readFileSync(f, "utf8").split("\n"))) {
      hits++;
      bad(`${rel}:${h.line} — the leading space is trimmed at compile time; end the expression with {" "}\n      ${h.text}`);
    }
    checks++;
  }
  if (hits === 0) ok(`${files.length} files, no glued text`);

  // The detector itself, against the exact shape that shipped, against the
  // fix, and against the two shapes that are FINE — a check that only ever
  // says yes is not a check, and one that says no to working code is worse.
  checks += 4;
  const broken = ['{company.name} hasn&apos;t set up online booking yet.', '{company.phone && ` call `}'];
  if (gluedJsxText(broken).length !== 1) bad("detector no longer catches the shape it was written for");
  else ok("catches the original defect");

  const fixed = ['{company.name}{" "}', "hasn&apos;t set up online booking yet.", '{company.phone && ` call `}'];
  if (gluedJsxText(fixed).length !== 0) bad("detector flags the corrected form");
  else ok("passes the corrected form");

  const noEntity = ['{showSheet ? "Hide" : "See"} the finished drawing', '<span className="x">'];
  if (gluedJsxText(noEntity).length !== 0) bad("detector flags a run with no entity, which compiles correctly");
  else ok("passes a multi-line run with no entity");

  // A run that CLOSES on its own line keeps both its spaces, entity or not —
  // verified against the compiled bundle for UnsubscribeForm's other sentence.
  const singleLine = ['{email} won&apos;t receive marketing email from {company}{" "}', "</p>"];
  if (gluedJsxText(singleLine).length !== 0) bad("detector flags a single-line run, which compiles correctly");
  else ok("passes a run that closes on its own line");
}

console.log(
  `\n${fail === 0 ? `ALL PASS — ${checks} assertions` : `${fail} FAILED of ${checks} assertions`}`,
);
process.exit(fail ? 1 : 0);
