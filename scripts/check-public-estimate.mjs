// scripts/check-public-estimate.mjs
//
//   npm run check:public-estimate
//
// The client-facing pages a stranger reaches with no account: the instant
// estimate, the ad funnel, the two opt-outs, the payment authorisation, the
// visit link, the referral landing page.
//
// Everything here failed in production shape at least once, and each assertion
// is written against the SHAPE that broke rather than against words in a
// comment. Three of the four false-pass traps this repo has hit apply directly:
//
//   • Every source read is comment-stripped first. This file's own subjects
//     carry long comments quoting the bug they fixed — `"$" + Math.round(...)`
//     appears verbatim in lib/estimate/estimateMoney.js's header — so a raw
//     read would find the banned pattern in the file that banned it.
//   • ok() is label-first, matching every other check in this repo. Reversed,
//     a non-empty label becomes the condition and nothing can ever fail.
//   • The pure functions are EXECUTED, not pattern-matched. estimateMoney and
//     documentTheme run against the actual brand hexes in the database.
//
// ── The brands ──────────────────────────────────────────────────────────────
//
// Not invented. These are the brandColor values live tenants have set, plus
// the seeded default. Four of the six break the naive "use white on it" rule,
// which is why they are the ones worth measuring against.

import fs from "node:fs";
import { estimateMoney, estimateRange } from "@/lib/estimate/estimateMoney";
import { documentTheme, fillPair } from "@/lib/documents/theme";
import { contrastRatio, readableForeground } from "@/lib/brand/colour";

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

const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const read = (p) => fs.readFileSync(p, "utf8");
const code = (p) => stripComments(read(p));

// Real tenant brands. #ffffff and #c0c0c0 are named in AGENTS.md's brief as the
// two that have already produced invisible client-facing surfaces.
const BRANDS = {
  "white (Sunset Inc)": "#ffffff",
  "silver (Big painter Inc)": "#c0c0c0",
  "pale yellow (Teacup Poodle)": "#fefcdd",
  "seeded gold": "#bd9d60",
  "near-black (Big Puddle Fix)": "#1a1a1a",
  navy: "#06356b",
};

const IQ = "app/instant-quote/[companySlug]/InstantQuoteFlow.js";
const FUNNEL = "app/f/[companySlug]/[funnelSlug]/FunnelRunner.js";
const IQ_ROUTE = "app/api/instant-quote/[companySlug]/route.js";

// ═══ 1. Money ═══════════════════════════════════════════════════════════════
//
// The instant-quote page formatted its range with `"$" + Math.round(Number(n)
// || 0).toLocaleString()`. Two bugs in one line: a company billing in EUR
// published a dollar figure under its own name, and a bound that failed to
// arrive became a confident zero.

console.log("\nMoney on a public estimate\n");

ok(
  "estimateMoney renders the COMPANY's currency, not a dollar sign",
  estimateMoney(1250, "EUR", "en-CA").includes("€") &&
    estimateMoney(1250, "GBP", "en-CA").includes("£"),
  `EUR → ${estimateMoney(1250, "EUR", "en-CA")}, GBP → ${estimateMoney(1250, "GBP", "en-CA")}`,
);

ok(
  "...and does not print cents on an estimate",
  !/[.,]\d\d$/.test(estimateMoney(1250, "CAD", "en-CA")),
  estimateMoney(1250, "CAD", "en-CA"),
);

// "We don't know" and "it is zero" are different screens.
for (const junk of [null, undefined, "", NaN, Infinity, -Infinity, "abc", {}, []]) {
  ok(
    `a missing bound (${JSON.stringify(junk) ?? String(junk)}) returns null, never a figure`,
    estimateMoney(junk, "CAD") === null,
    `got ${JSON.stringify(estimateMoney(junk, "CAD"))}`,
  );
}

ok(
  "a real zero still formats — 0 is an answer, absence is not",
  typeof estimateMoney(0, "CAD", "en-CA") === "string",
);

ok(
  "estimateRange refuses the whole range when either end is missing",
  estimateRange(null, 4000, "CAD") === null &&
    estimateRange(1000, undefined, "CAD") === null &&
    typeof estimateRange(1000, 4000, "CAD") === "string",
  `low-missing → ${JSON.stringify(estimateRange(null, 4000, "CAD"))}`,
);

ok(
  "an unknown currency code falls back rather than throwing",
  typeof estimateMoney(100, "ZZZ") === "string" &&
    typeof estimateMoney(100, null) === "string",
);

ok(
  "the range does not break across lines between the two figures",
  estimateRange(1000, 4000, "CAD", "en-CA").includes(" "),
  estimateRange(1000, 4000, "CAD", "en-CA"),
);

// ═══ 2. Neither public page may grow its own money formatter ════════════════
//
// Matched on the SHAPE of a hardcoded symbol concatenation, not on the word
// "money": a local helper named anything at all is the thing that rots.

console.log("\nNo second money formatter on the public estimate pages\n");

for (const [label, file] of [["instant quote", IQ], ["funnel", FUNNEL]]) {
  const src = code(file);
  ok(
    `${label}: no hardcoded currency symbol concatenated onto a figure`,
    !/["'][$£€]["']\s*\+/.test(src),
    file,
  );
  ok(
    `${label}: formats through lib/estimate/estimateMoney.js`,
    /from\s+["']@\/lib\/estimate\/estimateMoney["']/.test(src),
    file,
  );
  ok(
    `${label}: does not define a local money() any more`,
    !/function\s+money\s*\(/.test(src),
    file,
  );
}

ok(
  "the instant-quote API sends the company's currency to the browser",
  /currency:\s*company\.currency/.test(code(IQ_ROUTE)),
  IQ_ROUTE,
);

ok(
  "...and the page reads it rather than assuming one",
  /data\?\.currency/.test(code(IQ)),
  IQ,
);

// ═══ 3. Contrast, against the brands that actually exist ════════════════════
//
// The estimate figure is the biggest number on the page and was drawn in the
// raw brand hex on a white card. The submit button and the selected trade chip
// were white text on the raw brand. On the tenant whose brand is #ffffff all
// three measured 1.00:1.
//
// Executed, not read: documentTheme and fillPair run for each brand.

console.log("\nContrast on the public estimate, per real tenant brand\n");

const CARD = "#ffffff"; // --card in app/globals.css; these routes are never dark

for (const [name, hex] of Object.entries(BRANDS)) {
  const theme = documentTheme({ brandColor: hex });
  const solid = fillPair(theme);

  const figure = contrastRatio(theme.accentText, CARD);
  const label = contrastRatio(solid.fg, solid.bg);
  const shape = contrastRatio(solid.bg, CARD);
  const ring = contrastRatio(theme.accentText, CARD);

  ok(
    `${name}: the estimate figure clears 4.5:1 on the card`,
    figure >= 4.5,
    `${figure.toFixed(2)}:1 (${theme.accentText} on ${CARD})`,
  );
  ok(
    `${name}: the submit button's label clears 4.5:1 on its own fill`,
    label >= 4.5,
    `${label.toFixed(2)}:1 (${solid.fg} on ${solid.bg})`,
  );
  // The button's SHAPE, which fillPair does not promise. fillPair moves the
  // fill only when the LABEL needs it, so a mid-tone brand keeps its own
  // colour and a silver button on a white page measures 1.82:1 — perfectly
  // legible text with no visible edge around it. Either the fill or the
  // measured border has to carry the 3:1; both call sites set the border.
  const edge = Math.max(shape, contrastRatio(theme.accentText, CARD));
  ok(
    `${name}: the button has an edge or a fill readable against the card (3:1)`,
    edge >= 3,
    `fill ${shape.toFixed(2)}:1, border ${contrastRatio(theme.accentText, CARD).toFixed(2)}:1`,
  );
  ok(
    `${name}: the selection ring is visible (3:1)`,
    ring >= 3,
    `${ring.toFixed(2)}:1`,
  );
  ok(
    `${name}: the referral monogram's initial is legible on the brand`,
    contrastRatio(readableForeground(hex), hex) >= 4.5,
    `${contrastRatio(readableForeground(hex), hex).toFixed(2)}:1`,
  );
}

// The raw hex must not reach a text or fill style on these pages. Matched on
// the style shapes that carry text, so a selection wash or a ring colour is not
// caught by accident.
console.log("\nThe raw brand hex stays out of text and fills\n");

for (const [label, file, hexVar] of [
  ["instant quote", IQ, "brand"],
  ["funnel", FUNNEL, "accent"],
]) {
  // The funnel's Shell is the one legitimate raw-accent background in either
  // file: the page GROUND is the brand colour, deliberately, and a ground has
  // nothing behind it to be measured against. Everything else renders on the
  // white card, so the check runs on the file with Shell cut off — assert on
  // the whole file and this legitimate use fails the ban.
  const src = code(file).split(/\nfunction Shell\(/)[0];
  ok(
    `${label}: no \`color: ${hexVar}\` — text is measured`,
    !new RegExp(`color:\\s*${hexVar}\\s*[,}]`).test(src),
    file,
  );
  ok(
    `${label}: no fill built from the raw hex on the card`,
    !new RegExp(`background(?:Color)?:\\s*${hexVar}\\s*[,}]`).test(src),
    file,
  );
  // A measured fill with a hand-written foreground is the same bug wearing a
  // different spelling: fillPair's whole job is to supply the pair.
  ok(
    `${label}: no hand-written white or black text colour`,
    !/color:\s*["'](?:#fff(?:fff)?|#000(?:000)?|white|black)["']/i.test(src),
    file,
  );
  ok(
    `${label}: no \`text-white\` on a brand-driven fill`,
    !/text-white[\s\S]{0,200}?background(?:Color)?:\s*(?:solid\.bg|cardFill\.bg|brand|accent)/.test(src),
    file,
  );
}

// Every measured FILL must also carry a measured EDGE, checked per occurrence
// rather than "the word border appears somewhere in the file" — the file is
// full of borders, and a check that only asks whether one exists passes with
// the button's own edge deleted.
for (const [label, file] of [["instant quote", IQ], ["funnel", FUNNEL]]) {
  const src = code(file);
  const fills = [...src.matchAll(/background(?:Color)?:\s*(?:solid|cardFill)\.bg/g)];
  const naked = fills.filter(
    (m) => !/border(?:Color)?:/.test(src.slice(m.index, m.index + 160)),
  );
  ok(
    `${label}: every brand fill on the card carries a measured border (${fills.length} found)`,
    fills.length > 0 && naked.length === 0,
    naked.length
      ? `${naked.length} fill(s) with no border: ${naked
          .map((m) => src.slice(m.index, m.index + 60).replace(/\s+/g, " "))
          .join(" | ")}`
      : "no brand fills found at all",
  );
}

ok(
  "the referral landing page measures the monogram instead of hardcoding ink",
  /readableForeground\(/.test(code("app/refer/[code]/page.js")) &&
    !/rounded-xl[^>]*text-\[#2d2520\]/.test(code("app/refer/[code]/page.js")),
  "app/refer/[code]/page.js",
);

// ═══ 4. The opt-outs, on the path that fails ════════════════════════════════
//
// lib/sales/suppression.js has no delete and a three-year retention clock,
// because the evidence that somebody asked is the point. The request that never
// reached the server is the one that cannot be evidenced — so the screen has to
// survive a failed POST with its button intact.
//
// The old shape: one `state.error`, set by both the load and the submit, and a
// render that unmounted the whole form the moment it was non-empty.

console.log("\nThe opt-out pages survive a failed submit\n");

for (const [label, file] of [
  ["unsubscribe", "app/unsubscribe/[token]/UnsubscribeForm.js"],
  ["no-contact", "app/no-contact/[token]/NoContactForm.js"],
]) {
  const src = code(file);

  ok(
    `${label}: the submit error is state of its own, not the load error`,
    /useState\(""\)/.test(src) && /submitError/.test(src),
    file,
  );
  ok(
    `${label}: a failed submit does not write to the load error`,
    !/catch\s*\(\s*err\s*\)\s*\{\s*setState\(\(s\)\s*=>\s*\(\{\s*\.\.\.s,\s*error/.test(src),
    file,
  );
  ok(
    `${label}: the submit error is rendered`,
    /\{submitError\s*&&/.test(src),
    file,
  );
  ok(
    `${label}: ...and the button is still on the page when it is`,
    // The error block and the button live in the same branch, so no ordering
    // of state can leave the reader with a message and nothing to press.
    src.indexOf("{submitError &&") < src.indexOf("onClick={") &&
      src.indexOf("{submitError &&") > -1,
    file,
  );
  ok(
    `${label}: the button meets the 44px thumb target`,
    /min-h-11/.test(src),
    file,
  );
  ok(
    `${label}: the GET is not what mutates`,
    /method:\s*"POST"/.test(src),
    file,
  );
}

// ═══ 5. Token pages stay out of search indexes ═════════════════════════════
//
// A token in a search index is the token handed to whoever reads the index.
// /plan/[token] — the page that authorises a standing arrangement to charge
// somebody — was the only one without a block, because it was a "use client"
// file and those cannot export metadata.

console.log("\nEvery token-gated client-facing page blocks crawlers\n");

const TOKEN_PAGES = [
  "app/q/[token]/page.js",
  "app/portal/[token]/page.js",
  "app/portal/[token]/invoices/[id]/page.js",
  "app/visit/[token]/page.js",
  "app/survey/[token]/page.js",
  "app/design/[token]/page.js",
  "app/plan/[token]/page.js",
  "app/unsubscribe/[token]/page.js",
  "app/no-contact/[token]/page.js",
];

for (const file of TOKEN_PAGES) {
  const src = code(file);
  ok(
    `${file} sets robots index:false`,
    /robots:\s*\{[^}]*index:\s*false/.test(src),
    file,
  );
  ok(
    `${file} is a server file, so the block can exist at all`,
    !/^\s*["']use client["']/m.test(src),
    file,
  );
}

// ── The tab is a white-label surface ───────────────────────────────────────
//
// A static `metadata` export inherits every field it does not set from the root
// layout, where `title` is "FieldQuo". app/f/[companySlug]/[funnelSlug] set
// only `robots`, so a homeowner tapping a contractor's Instagram ad got a
// full-screen page in the contractor's colours with our name in the tab. Its
// own embed sibling had already fixed exactly this.
//
// Asserted for every client-facing page a stranger reaches, not just that one:
// the failure is an OMISSION, so a check that only looked at the page it was
// written for would pass forever on the next page that forgets.
console.log("\nNo client-facing tab inherits the root FieldQuo title\n");

const BRANDED_TABS = [
  ...TOKEN_PAGES,
  "app/f/[companySlug]/[funnelSlug]/page.js",
  "app/embed/[companySlug]/[widget]/page.js",
  "app/embed/[companySlug]/funnel/[funnelSlug]/page.js",
  "app/instant-quote/[companySlug]/page.js",
  "app/l/[slug]/page.js",
  "app/quote/[companySlug]/page.js",
  "app/quote/[companySlug]/kitchen/page.js",
];

for (const file of BRANDED_TABS) {
  const src = code(file);
  ok(
    `${file} sets a title of its own`,
    /title:/.test(src),
    "no title: the root layout's \"FieldQuo\" reaches the browser tab",
  );
  // /no-contact is the one sanctioned exception: FieldQuo IS the sender there
  // — the recipient is someone who started a signup with us — and hiding our
  // name would make the sentence on the page untrue.
  if (!file.includes("no-contact")) {
    ok(
      `${file} does not put FieldQuo in the tab`,
      !/title:\s*["'][^"']*FieldQuo/.test(src),
      file,
    );
  }
}

ok(
  "the payment-authorisation tab does not say FieldQuo",
  !/title:\s*["'][^"']*FieldQuo/.test(code("app/plan/[token]/page.js")),
  "app/plan/[token]/page.js",
);

// ═══ 6. A bad token is a 404, not a 200 with a friendly message ════════════

console.log("\nAn unknown token gets a real 404\n");

for (const [label, file] of [
  ["quote", "app/q/[token]/page.js"],
  ["survey", "app/survey/[token]/page.js"],
  ["visit", "app/visit/[token]/page.js"],
]) {
  const src = code(file);
  ok(
    `${label}: the page checks the token exists before rendering`,
    /notFound\(\)/.test(src) && /await db\./.test(src),
    file,
  );
  ok(
    `${label}: ...and has somewhere good to land`,
    fs.existsSync(file.replace(/page\.js$/, "not-found.js")),
    file.replace(/page\.js$/, "not-found.js"),
  );
}

console.log(
  `\n${fail === 0 ? `ALL PASS — ${pass} checks` : `${fail} FAILED (${pass} passed)`}\n`,
);
process.exit(fail ? 1 : 0);
