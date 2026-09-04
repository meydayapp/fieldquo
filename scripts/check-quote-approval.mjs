// scripts/check-quote-approval.mjs
//
//   npm run check:quote-approval
//
// /q/[token] — the page a homeowner opens from an email and approves a price on.
//
// ══ What this guards, and why each one is here ═════════════════════════════
//
// 1. COLOUR IS MEASURED. This page painted every heading, the rule across the
//    top, the add-on checkbox and the TOTALS BAND with `company.brandColor`
//    straight out of the database. Three real tenants break that. #ffffff (a
//    live company, three quotes, one still `sent`) rendered the masthead word,
//    the brand rule and the whole totals band invisible — white on white, on
//    the single most-looked-at line of the document. #c0c0c0 put the masthead
//    at 1.82:1. lib/documents/theme.js exists for exactly this and the
//    self-quote form next door has always used it.
//
//    Asserted by RUNNING the palette against the brands in the production
//    database plus the classic hostile set, not by reading the JSX. The
//    numbers below are what a homeowner's screen actually resolves to.
//
// 2. THE TAX LINE AND THE SENTENCE UNDER IT AGREE. `assumed` and `unresolved`
//    are independent: a rate can be assumed from the company's own province
//    AND still have produced no charge. Q-2026-0001 shipped both, so the page
//    read "Tax — To be confirmed" with "Tax is shown at the Ontario rate"
//    printed directly beneath it. The sentence described a number that was not
//    there. Both branches are executed here against taxStatement's real output.
//
// 3. THE BROWSER STILL SENDS NO MONEY. Non-negotiable 5. Nothing in this pass
//    went near it and that is precisely when it breaks.
//
// 4. A DROPPED REQUEST IS NOT AN ERROR MESSAGE. The load effect ended in
//    `setLoadError(err.message)`, so a lost connection — the likeliest failure
//    on a page whose audience is standing in a driveway — printed the browser's
//    own words, "Failed to fetch", in bold, with no way back.
//
// ══ Why the JSX assertions are textual, and how they avoid the usual lie ═══
//
// What is being asserted about QuoteApproval.js is WHICH MODULE it composes
// its colours from, and that is a property of the source rather than of any
// one render — the same argument check-brand-scope.mjs and check-self-quote.mjs
// make about their own React files. Comments are stripped first: this file's
// subject spends four paragraphs describing the very patterns it must not
// contain, and a scanner that reads prose as code flags the explanation.

import fs from "node:fs";
import {
  documentTheme,
  fillPair,
  ruleColor,
  washPair,
} from "@/lib/documents/theme";
import { contrastRatio } from "@/lib/brand/colour";
import { taxStatement } from "@/lib/tax/documentTax";
import { clientDocCopy, CLIENT_DOC_COPY } from "@/lib/i18n/clientDocCopy";

let pass = 0,
  fail = 0;
const ok = (n, c, got) => {
  if (c) {
    pass++;
    console.log(`  ✓ ${n}`);
  } else {
    fail++;
    console.log(`  ✗ ${n}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`);
  }
};

const read = (p) => fs.readFileSync(p, "utf8");
const strip = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const PAGE = "app/q/[token]/QuoteApproval.js";
const ROUTE = "app/api/public/quotes/[token]/route.js";
const PANEL = "app/q/[token]/ContractorImportPanel.js";
const CTX_ROUTE = "app/api/quotes/received/[token]/route.js";

const pageSrc = strip(read(PAGE));
const routeSrc = strip(read(ROUTE));
const panelSrc = strip(read(PANEL));
const ctxSrc = strip(read(CTX_ROUTE));

const AA = 4.5;

// The brand colours REAL companies in this database have chosen, plus the four
// AGENTS.md names as the ones contractors pick. Hardcoding "navy" and calling
// it hostile is how the original bug survived: #06356b passes every rule here.
const BRANDS = {
  "white (a live tenant)": "#ffffff",
  "silver (a live tenant)": "#c0c0c0",
  "near-black (a live tenant)": "#212121",
  "pale yellow (a live tenant)": "#fefcdd",
  "gold (a live tenant)": "#B8860B",
  "slate (a live tenant)": "#4A5568",
  "mid grey": "#808080",
  "bright yellow": "#ffff00",
  "black": "#000000",
  "FieldQuo navy (the easy case)": "#06356b",
  // Not a colour. A company row with a null or junk brandColor must still
  // produce a document rather than NaN-coloured CSS.
  "unset": null,
  "junk": "not-a-hex",
};

// ───────────────────────────────────────────────────────────────────────────
console.log("\n1. Every pairing this page paints clears 4.5:1, on every brand");

for (const [name, hex] of Object.entries(BRANDS)) {
  const theme = documentTheme({ brandColor: hex });
  const fill = fillPair(theme);
  const rule = ruleColor(theme);
  const wash = washPair(theme);

  // The masthead word, and the three section headings. Text on paper.
  const heading = contrastRatio(theme.accentText, theme.paper);
  ok(`${name}: masthead + headings on paper`, heading >= AA, heading.toFixed(2));

  // The TOTAL. A filled band with the figure on it — both halves have to work,
  // and "the text is legible" is only half of it: an invisible band around a
  // legible number is what the white tenant actually shipped.
  const band = contrastRatio(fill.fg, fill.bg);
  ok(`${name}: TOTAL — figure on its band`, band >= AA, band.toFixed(2));
  const bandEdge = contrastRatio(fill.bg, theme.paper);
  ok(
    `${name}: TOTAL — the band is visible against the card`,
    bandEdge >= 1.6,
    bandEdge.toFixed(2),
  );

  // The rule across the top of the document, and the left border of a scope
  // card that declares no colour of its own.
  const ruleEdge = contrastRatio(rule, theme.paper);
  ok(`${name}: brand rule is visible on paper`, ruleEdge >= 1.6, ruleEdge.toFixed(2));

  // The financing panel and the payment-schedule chips: a surface, plus text
  // measured against THAT surface rather than against paper.
  const panelEdge = contrastRatio(wash.bg, theme.paper);
  ok(`${name}: wash panel is visible against the card`, panelEdge >= 1.03, panelEdge.toFixed(3));
  const panelInk = contrastRatio(wash.ink, wash.bg);
  ok(`${name}: body text on the wash panel`, panelInk >= AA, panelInk.toFixed(2));
  const panelMuted = contrastRatio(wash.muted, wash.bg);
  ok(`${name}: muted text on the wash panel`, panelMuted >= AA, panelMuted.toFixed(2));
  const panelAccent = contrastRatio(wash.accent, wash.bg);
  ok(`${name}: the % figure / panel heading on the wash`, panelAccent >= AA, panelAccent.toFixed(2));
}

// ───────────────────────────────────────────────────────────────────────────
console.log("\n2. …and the naive version this replaced genuinely failed");
//
// A check that passes for the same reason on the old code and the new one is
// not testing anything. These reproduce what the page used to paint and assert
// that it was broken, so the section above cannot go green by accident.

const white = documentTheme({ brandColor: "#ffffff" });
ok(
  "raw hex as the masthead: the white tenant was invisible on paper",
  contrastRatio("#ffffff", white.paper) < 1.6,
  contrastRatio("#ffffff", white.paper).toFixed(2),
);
ok(
  "raw hex as the totals band: the white tenant had no band at all",
  contrastRatio("#ffffff", "#ffffff") < 1.6,
);
const silver = documentTheme({ brandColor: "#c0c0c0" });
ok(
  "raw hex as the masthead: the silver tenant was 1.8:1",
  contrastRatio("#c0c0c0", silver.paper) < AA,
  contrastRatio("#c0c0c0", silver.paper).toFixed(2),
);
ok(
  "…and accentText fixes exactly that pairing",
  contrastRatio(silver.accentText, silver.paper) >= AA,
  contrastRatio(silver.accentText, silver.paper).toFixed(2),
);

// ───────────────────────────────────────────────────────────────────────────
console.log("\n3. The page composes from the theme, not from the raw hex");

ok("it imports documentTheme, fillPair, ruleColor and washPair", /documentTheme/.test(pageSrc) && /fillPair/.test(pageSrc) && /ruleColor/.test(pageSrc) && /washPair/.test(pageSrc));
// The rendered value, not an attribute name — `key={row.raw}` matching `raw`
// is the false pass this repo has already been bitten by.
ok("no `color: accent` anywhere", !/color:\s*accent\b/.test(pageSrc));
ok("no `backgroundColor: accent`", !/backgroundColor:\s*accent\b/.test(pageSrc));
ok("no alpha-suffixed brand hex (`${accent}33`)", !/\$\{accent\}[0-9a-f]{2}/i.test(pageSrc));
ok("it never reads company.brandColor directly", !/brandColor/.test(pageSrc));
ok("no hand-rolled navy fallback — the theme owns FALLBACK_BRAND", !/#06356b/.test(pageSrc));
ok("readableForeground is not called here (fillPair measures BOTH halves)", !/readableForeground/.test(pageSrc));
ok("the checkbox tick is a measured fill", /accentColor:\s*fill\.bg/.test(pageSrc));
ok("the totals band uses fillPair", /backgroundColor:\s*fill\.bg,\s*color:\s*fill\.fg/.test(pageSrc));

// ───────────────────────────────────────────────────────────────────────────
console.log("\n4. The tax line and the sentence under it cannot contradict");

// Executed against the real module. The exact production shape: tax is ON, the
// stored amount is 0, the client has no country, the company is in Ontario —
// so a rate IS assumed and NOTHING is charged, both at once.
const ontario = {
  province: "ON",
  country: "CA",
  taxRate: 0,
  autoApplyLocalTax: true,
  vatRegistered: null,
};
const unresolvedAssumed = taxStatement({
  taxEnabled: true,
  tax: 0,
  company: ontario,
  client: { name: "Emilio", province: null, country: null },
});
ok("the production shape is still kind=unresolved AND assumed", unresolvedAssumed.kind === "unresolved" && unresolvedAssumed.assumed === true, {
  kind: unresolvedAssumed.kind,
  assumed: unresolvedAssumed.assumed,
  region: unresolvedAssumed.assumedRegion,
});

const charged = taxStatement({
  taxEnabled: true,
  tax: 682.5,
  company: ontario,
  client: { name: "Emilio", province: null, country: null },
});
ok("a charged quote from the same company is kind=charged AND assumed", charged.kind === "charged" && charged.assumed === true);

// The page's own predicate, lifted verbatim. If the JSX changes shape this
// stops matching and the check fails rather than silently testing a copy.
const predicate = /const taxIsAFigure =\s*pricing\.tax !== 0 \|\| quote\.taxKind === "charged";/;
ok("the page derives `taxIsAFigure` once, from taxKind", predicate.test(pageSrc));
ok("…the tax ROW is gated on it", /\{taxIsAFigure \? \(/.test(pageSrc));
ok("…and so is the assumed-region sentence", /\{quote\.taxAssumedRegion && taxIsAFigure && \(/.test(pageSrc));

// Simulate both branches the way the page does.
const wouldShowNote = (kind, taxAmount) =>
  Boolean(taxAmount !== 0 || kind === "charged");
ok(
  "unresolved + assumed → the row says 'to be confirmed' and NO region sentence",
  wouldShowNote(unresolvedAssumed.kind, 0) === false,
);
ok(
  "charged + assumed → a figure AND the region sentence",
  wouldShowNote(charged.kind, 682.5) === true,
);
// The sentence itself claims a rate is on display. That claim is why it may
// only appear beside one.
ok(
  "the sentence really does claim a rate is shown (so gating it was required)",
  /shown at the \{region\} rate/.test(
    read("lib/i18n/documentLabels.js"),
  ),
);

// ───────────────────────────────────────────────────────────────────────────
console.log("\n5. The browser sends ids; the server prices");

ok("the page posts addOnIds and no amount", /addOnIds:\s*decision === "accepted" \? picked : \[\]/.test(pageSrc));
ok("…and posts no total, subtotal or amount field", !/\b(total|subtotal|amount):/.test(pageSrc.split("async function submit")[1]?.split("const pricing")[0] || ""));
ok("the route intersects the ids with the quote's own rows", /requestedIds\.filter\(\(id\) => validIds\.includes\(id\)\)/.test(routeSrc));
ok("…and reprices from stored amounts", /function priceWithAddOns/.test(routeSrc) && /quote\.addOns\.filter/.test(routeSrc));
ok("the settled figure shown after approval is the SERVER's", /setSettledTotal\(data\.total \?\? null\)/.test(pageSrc));

// ───────────────────────────────────────────────────────────────────────────
console.log("\n6. A lost connection has its own screen, and a way back");

ok("a thrown fetch is caught separately from a refused response", /catch \{\s*if \(!cancelled\) \{\s*setOffline\(true\)/.test(pageSrc));
ok("…and never renders err.message as the headline", !/setLoadError\(err\.message\)/.test(pageSrc.split("async function submit")[0]));
ok("the offline screen offers a retry", /setAttempt\(\(n\) => n \+ 1\)/.test(pageSrc));
ok("…and the retry actually re-runs the load", /\}, \[token, attempt\]\);/.test(pageSrc));
for (const code of Object.keys(CLIENT_DOC_COPY)) {
  const c = clientDocCopy(code);
  ok(`${code}: connectionLost / hint / tryAgain / linkInvalidHint are present`, Boolean(c.connectionLost && c.connectionLostHint && c.tryAgain && c.linkInvalidHint));
}
ok("no hardcoded English sentence left on the load-error screens", !/Get in touch with the company that sent it/.test(pageSrc));

// A 410 between load and click must reach the client's OWN words for expired,
// not the route's English wire sentence. Non-negotiable 6.
ok("a 410 is turned into the page's translated 'expired' state", /res\.status === 410/.test(pageSrc) && /setExpiredOnSubmit\(true\)/.test(pageSrc));
ok("…and `expired` reads that state", /expiredOnSubmit \|\|/.test(pageSrc));
ok("the route's 410 sentence is still English on the wire (for non-UI callers)", /This quote has expired/.test(routeSrc));

// ───────────────────────────────────────────────────────────────────────────
console.log("\n7. Nothing on this page is written and read by nobody");

ok("the contractor panel has ONE canImport guard, not two", (panelSrc.match(/if \(!ctx\.canImport\)/g) || []).length === 1);
ok("…so the unreachable signup pitch is gone", !/Are you the contractor on this job\?/.test(panelSrc));
ok("…and with it the only FieldQuo wordmark that a homeowner could reach", !/Start free/.test(panelSrc));
for (const dead of ["recipientKnown", "clientIsCompany", "viewerCompanyName"]) {
  ok(`the context route no longer returns ${dead} (nothing read it)`, !new RegExp(`${dead}`).test(ctxSrc));
}
ok("…and no longer queries the user table on every homeowner page view", !/db\.user\.findFirst/.test(ctxSrc));
ok("what the panel DOES read is still sent", /sourceCompanyName/.test(ctxSrc) && /openQuotes/.test(ctxSrc) && /canImport/.test(ctxSrc));

// ───────────────────────────────────────────────────────────────────────────
console.log("\n8. The shared uploader speaks the CLIENT's language on the form");
//
// label/hint/documentLabel were already injected because the public self-quote
// form runs in the homeowner's language, not the company's. Four more strings
// were left hardcoded English inside the shared component, including the one a
// bad connection produces — on the surface where a bad connection is likeliest.
// The English defaults are kept so every /app caller is unchanged.

const UPLOADER = "app/components/MediaUploader.js";
const FLOW = "app/quote/[companySlug]/SelfQuoteFlow.js";
const upSrc = strip(read(UPLOADER));
const flowSrc = strip(read(FLOW));

// The English text must still be IN the file — it is the default, and every
// /app caller relies on it. What must be gone is the text at the USE site,
// which is the thing a prop can never override. Asserting the string's absence
// from the file would fail on the default and teach the next person to delete
// the default, which is the opposite of the fix.
for (const [prop, useSite] of [
  ["busyLabel", "{busy ? busyLabel : label}"],
  ["failedLabel", "setError(failedLabel)"],
  ["rejectedLabel", "setError(data?.error || rejectedLabel)"],
  ["removeLabel", "aria-label={removeLabel}"],
  ["limitLabel", "setError(limitLabel(max))"],
]) {
  ok(`MediaUploader takes ${prop}, with an English default`, new RegExp(`\\b${prop}\\s*=`).test(upSrc));
  ok(`…and renders the PROP, not a literal`, upSrc.includes(useSite));
  ok(`…and the self-quote form passes the client's language`, new RegExp(`${prop}=\\{copy\\.`).test(flowSrc));
}
for (const code of Object.keys(CLIENT_DOC_COPY)) {
  const sq = clientDocCopy(code).selfQuote;
  ok(`${code}: the uploader's five strings exist`, Boolean(sq.uploadBusy && sq.uploadLimit && sq.uploadFailed && sq.uploadRejected && sq.uploadRemove));
  ok(`${code}: uploadLimit interpolates the count`, String(sq.uploadLimit(7)).includes("7"));
}

// ───────────────────────────────────────────────────────────────────────────
console.log("\n9. Nothing on the white-label document names FieldQuo");

// The document itself. The import panel is the deliberate exception and is a
// separate card, shown only to a signed-in contractor of another company.
const docOnly = pageSrc;
ok("the approval document contains no FieldQuo wordmark", !/FieldQuo/i.test(docOnly));
ok("the public payload sends no FieldQuo-owned field", !/FIELDQUO/.test(routeSrc));

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
