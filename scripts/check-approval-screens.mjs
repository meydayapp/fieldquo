// scripts/check-approval-screens.mjs
//
// The two back-office screens where somebody signs off a price.
//
//   npm run check:approval-screens
//
// ══ What went wrong ════════════════════════════════════════════════════════
//
// 1. A ROUNDED PRICE, WRITTEN SILENTLY. app/app/estimate-reviews held the
//    figure as `useState(Math.round(Number(q.total) || 0))` and posted it back
//    on every approval. A reviewer who opened the queue and pressed Approve
//    without touching the field approved a $6,750.40 estimate at $6,750.
//    Nothing on screen said so, and the page's own header comment calls this
//    "the figure that will stick." POST .../approve-estimate accepts decimals
//    perfectly well; the rounding was the screen's invention.
//
// 2. THE WRONG CURRENCY, TWICE, PAST A CURRENCY SWEEP. quote-approval used
//    `toLocaleString("en-CA", { style: "currency", currency: "CAD" })` while
//    GET /api/quotes/[id] deliberately selects `company.currency` for it — the
//    comment on that select says so in as many words. estimate-reviews used
//    `"$" + Math.round(...)`. Neither shape is a template literal with a
//    dollar sign in it, so check:app-currency passed on both while a GBP
//    contractor read CA$8,400.00 on his own quote. This check adds the two
//    escaped shapes.
//
// 3. A RAW ENUM, DISAGREEING WITH THE LIST. quote-approval rendered
//    `{quote.status}` — the lowercase column, in English, mid-French-screen.
//    lib/quotes/statusLabels.js exists for this and deliberately maps
//    `accepted` to "Approved", so the two screens also disagreed about the
//    same quote. estimate-reviews had the same shape one field over:
//    `SOURCE_LABEL[q.estimateSource] || q.estimateSource` printed
//    `google_solar` in a chip.
//
// 4. "THIS QUOTE DOESN'T EXIST" AS EVERY FAILURE'S ANSWER. Both fetches on
//    quote-approval were `r.ok ? r.json() : null`, and a null quote renders
//    notFound. A 403, a 500 and a Neon cold start all told a contractor their
//    quote was gone. Worse, a failed GET .../share left `share` null, and null
//    draws "Create client link" — offering to mint a SECOND token for a quote
//    that may already have a live link out with a client.
//
// ══ Why the label maps are executed and the rest is read ═══════════════════
//
// Whether a status renders through the shared map is a question about the
// source. Whether the map answers correctly for every enum member is a
// question about behaviour, and the enum is read out of prisma/schema.prisma
// rather than from the four values someone copied off another page — that is
// AGENTS.md's instruction, and a hand-written list is how a fifth member ends
// up in a grey chip with no colour.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  approvedEstimateMoney,
  appliedTaxRate,
  documentLinesTotal,
  priceAdjustmentLabel,
  PRICE_ADJUSTMENT_LABEL,
} from "@/lib/estimate/approveEstimate";
import { leadSourceLabel, leadSourceLabelKey, LEAD_SOURCE_LABEL_KEY, UNKNOWN_LEAD_SOURCE_KEY } from "@/lib/leads/sourceLabel";
import { APP_MESSAGES } from "@/app/i18n/appMessages";
// Executed under scripts/route-stub-loader.mjs: `@/lib/db` is the shared
// scripted db (scripts/fixtures/dbStub.mjs) and `@/lib/apiMember` signs in
// whoever `session.member` names.
import { POST as approvePOST } from "@/app/api/quotes/[id]/approve-estimate/route";
import { rows, writes, resetDbStub } from "@/lib/db";
import { session } from "@/lib/apiMember";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const code = (p) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*\/\/.*$/gm, " ");

let fail = 0;
let pass = 0;
const failures = [];
function ok(label, condition, detail) {
  if (condition) {
    pass++;
    console.log(`  ok   ${label}`);
  } else {
    fail++;
    failures.push(label);
    console.log(`  FAIL ${label}${detail === undefined ? "" : `  — ${detail}`}`);
  }
}
const section = (t) => console.log(`\n${t}\n`);

const approval = code("app/app/quote-approval/[id]/page.js");
const reviews = code("app/app/estimate-reviews/page.js");
const quoteRoute = code("app/api/quotes/[id]/route.js");
const approveRoute = code("app/api/quotes/[id]/approve-estimate/route.js");
const schema = read("prisma/schema.prisma");

// ═══════════════════════════════════════════════════════════════════════════
section("1. The price a reviewer signs off is the price on the quote");

ok(
  "the field is not pre-rounded on the way in",
  !/useState\(Math\.round\(Number\(q\.total\)/.test(reviews),
);
ok(
  "...it starts from the quote's own total, blank only when there isn't one",
  /useState\(q\.total == null \? "" : String\(q\.total\)\)/.test(reviews),
  "a numeric state also eats the decimal point as it is typed",
);
ok(
  "the input accepts cents rather than whole units only",
  /step="0\.01"/.test(reviews),
);
// The behavioural half: an untouched field must send NOTHING, which is the
// route's own documented no-op. Round-tripping an unchanged figure is how a
// reformatted value gets written back over the original.
ok(
  "an unchanged figure is not posted back at all",
  /typed !== Number\(q\.total\) \? typed : null/.test(reviews),
);
ok(
  "...and the approve button sends that derived value, not the raw field",
  /onApprove\(q, adjusted\)/.test(reviews),
);
ok(
  "the route really treats an absent total as 'approve at the current one'",
  /adjusted != null \? \{ total: adjusted \} : \{\}/.test(reviews) &&
    /const money = approvedEstimateMoney\(quote, body\?\.total\)/.test(approveRoute) &&
    approvedEstimateMoney({ subtotal: 100, tax: 13, total: 113 }, undefined) === null &&
    approvedEstimateMoney({ subtotal: 100, tax: 13, total: 113 }, "") === null &&
    approvedEstimateMoney({ subtotal: 100, tax: 13, total: 113 }, 0) === null,
);

// ═══════════════════════════════════════════════════════════════════════════
section("2. Money is the company's, on both screens");

// The two shapes that got past check:app-currency. Neither is a template
// literal with a "$" in it, which is all that check looks for.
ok(
  "quote-approval no longer hardcodes a currency code",
  !/currency:\s*"(CAD|USD|GBP|EUR)"/.test(approval),
);
ok(
  "...nor a reader locale on a money figure",
  !/toLocaleString\("en-CA",\s*\{[\s\S]{0,80}?style:\s*"currency"/.test(approval),
);
ok(
  "...it formats through the shared helper, with the currency the route sends",
  /formatMoney\(quote\.total, quote\.company\?\.currency\)/.test(approval),
);
ok(
  "...and the route really does send that currency",
  /company: \{\s*select: \{\s*currency: true/.test(quoteRoute.replace(/\s+/g, " ").replace(/ /g, " ")) ||
    /currency: true/.test(quoteRoute),
);
ok(
  "estimate-reviews no longer concatenates a bare dollar sign",
  !/"\$" \+/.test(reviews),
);
ok(
  "...it uses the company money formatter",
  /useCompanyMoney\(\)/.test(reviews),
);
ok(
  "...and the field's own prefix is the company's currency, not a $",
  /\{currency\}/.test(reviews) && !/>\$<\/span>/.test(reviews),
);

// ═══════════════════════════════════════════════════════════════════════════
section("3. No raw enum reaches a human");

// The enum, from the schema — not from a list copied off another page.
const enumBlock = (name) => {
  const m = new RegExp(`enum ${name} \\{([^}]*)\\}`).exec(schema);
  return m
    ? m[1]
        .split("\n")
        .map((l) => l.replace(/\/\/.*$/, "").trim())
        .filter(Boolean)
    : [];
};
const quoteStatuses = enumBlock("QuoteStatus");
ok("QuoteStatus was read out of the schema", quoteStatuses.length > 0, quoteStatuses.join(","));

const { QUOTE_STATUS_LABEL_KEYS, quoteStatusLabel, quoteStatusClasses } =
  await import("../lib/quotes/statusLabels.js");
ok(
  "every QuoteStatus in the schema has a label",
  quoteStatuses.every((v) => Object.hasOwn(QUOTE_STATUS_LABEL_KEYS, v)),
  quoteStatuses.filter((v) => !Object.hasOwn(QUOTE_STATUS_LABEL_KEYS, v)).join(","),
);
ok(
  "...and a chip class that is not another status's colour",
  quoteStatuses.every((v) => quoteStatusClasses(v) === quoteStatusClasses(v)) &&
    new Set(quoteStatuses.map((v) => quoteStatusClasses(v))).size ===
      quoteStatuses.length,
);
// The label the LIST shows and the label this page shows have to be one word.
ok(
  "an approved quote is called the same thing on both screens",
  quoteStatusLabel("accepted") === "Approved",
  quoteStatusLabel("accepted"),
);
ok(
  "quote-approval renders through the shared map, not the column",
  /quoteStatusLabel\(quote\.status, t\)/.test(approval) &&
    !/>\s*\{quote\.status\}\s*</.test(approval),
);
ok(
  "...in both places it names the status",
  (approval.match(/quoteStatusLabel\(quote\.status, t\)/g) || []).length >= 2,
);
ok(
  "...and it wears the shared chip colour rather than plain grey text",
  /quoteStatusClasses\(quote\.status\)/.test(approval),
);

ok(
  "estimate-reviews no longer falls back to the raw estimateSource column",
  !/SOURCE_LABEL\[q\.estimateSource\] \|\| q\.estimateSource/.test(reviews),
);
// ── Exhaustive against the writers, not against a hand-written list ───────
//
// Quote.estimateSource has no Prisma enum to read (it is `String?`), so the
// values are derived from the two places that WRITE it:
//
//   * SOURCE_BY_MEASURE in lib/estimate/instantQuoteServer.js, which maps each
//     measurement kind to a source; and
//   * lib/estimate/callEstimate.js, which passes "phone_call" directly.
//
// The first draft of this assertion grepped instantEstimate.js for
// `estimateSource: "..."` and found NOTHING, so `missing` was empty and it
// passed while proving zero. A check whose evidence set can silently be empty
// is a green tick with nothing behind it — so the size of that set is now
// asserted before anything is compared against it.
{
  const server = code("lib/estimate/instantQuoteServer.js");
  const mapBlock = /const SOURCE_BY_MEASURE = \{([^}]*)\}/.exec(server);
  const written = new Set(
    [...(mapBlock?.[1] || "").matchAll(/:\s*"(\w+)"/g)].map((m) => m[1]),
  );
  // The `|| "manual"` default in that file, and the direct call writer.
  written.add("manual");
  if (/source: "phone_call"/.test(code("lib/estimate/callEstimate.js"))) {
    written.add("phone_call");
  }

  ok(
    "the set of sources was actually derived, not silently empty",
    written.size >= 4,
    [...written].join(","),
  );

  // `: [` rather than `: "` — SOURCE_LABEL holds a [key, English fallback]
  // pair per source now, so the words come from the catalogue instead of being
  // typed here. The question this asks is the same one: does every source the
  // pipeline can WRITE have an entry on this screen.
  const mapped = new Set(
    [...reviews.matchAll(/^\s{2}(\w+): \[/gm)].map((m) => m[1]),
  );
  const missing = [...written].filter((v) => !mapped.has(v));
  ok(
    "every source the pipeline can write has a label on this page",
    missing.length === 0,
    `missing: ${missing.join(",")} (mapped: ${[...mapped].join(",")})`,
  );
}
ok(
  "...and an unknown source says so instead of printing snake_case",
  /t\("app\.reviews\.source\.unknown", "Source not recorded"\)/.test(reviews) &&
    // The original bug, kept nailed down: the fallback was `q.estimateSource`,
    // which put `google_solar` in a chip a human reads.
    !/\|\| *(?:source|q\.estimateSource)\b/.test(reviews),
);
// ── The keys landed, so the assertion turns around ────────────────────────
//
// This used to assert that at least 15 `i18n PENDING` markers SURVIVED. That
// was right while the words were waiting on a catalogue batch: a t() call on a
// key that does not exist turns check:translations red for every other agent in
// the tree, so the call sites carried a marker and the keys were reported.
//
// The keys are in app/i18n/appMessages.js now, in all nine blocks, and the call
// sites are wired. Left as-is, the old assertion would have failed the moment
// the work it was watching for was DONE — so it is inverted rather than
// deleted: no marker may come back, and each key must exist and be called.
// Both halves matter. "No markers" alone passes on a screen where somebody
// deleted the comments and left the English.
{
  const src = read("app/app/estimate-reviews/page.js");
  ok(
    "no i18n PENDING marker is left on this screen",
    !/i18n PENDING/.test(src),
    `${(src.match(/i18n PENDING/g) || []).length} still there`,
  );
  const WIRED = [
    "app.reviews.source.satellite",
    "app.reviews.source.unknown",
    "app.reviews.loadError",
    "app.reviews.approveError",
    "app.reviews.assignError",
    "app.reviews.intro",
    "app.action.loading",
    "app.reviews.websiteEnquiry",
    "app.reviews.assignedToYou",
    "app.reviews.assignedTo",
    "app.reviews.claim",
    "app.reviews.squareCount",
    "app.reviews.areaSqft",
    "app.reviews.pitch",
    "app.reviews.tearOffCount",
    "app.reviews.homeownerSaw",
    "app.reviews.theirBudget",
    "app.reviews.overBudget",
    "app.reviews.approve",
  ];
  const notCalled = WIRED.filter((k) => !src.includes(`"${k}"`));
  ok(
    "every key this screen was waiting on is now called from it",
    notCalled.length === 0,
    `not called: ${notCalled.join(", ")}`,
  );
  const catalogue = read("app/i18n/appMessages.js");
  const notDefined = WIRED.filter((k) => !catalogue.includes(`"${k}":`));
  ok(
    "...and defined in the catalogue, so none of them renders as its own key",
    notDefined.length === 0,
    `not defined: ${notDefined.join(", ")}`,
  );
  // The two that had to be counted nouns. `{n} squares` beside a number is the
  // defect that printed a bare Latin "s" on a Mandarin screen; countedNoun
  // declines the word and prints the number itself, so nothing may sit beside
  // it. Asserted on the ENGLISH entry, which every other block's shape is
  // gated against by check:app-catalogue.
  for (const key of ["app.reviews.squareCount", "app.reviews.tearOffCount"]) {
    ok(
      `${key} is a counted noun, not a number beside a fixed plural`,
      new RegExp(`"${key}": countedNoun\\("en"`).test(catalogue),
      "see lib/i18n/plurals.js",
    );
  }
}
ok(
  "the price-book key is not shown with its underscores",
  /String\(d\.materialKey\)\.replace\(\/_\/g, " "\)/.test(reviews),
);

// ═══════════════════════════════════════════════════════════════════════════
section("4. A failed load is not a missing quote, and not a missing link");

ok(
  "both legs go through fetchList rather than a bare r.ok ternary",
  (approval.match(/fetchList\(`\/api\/quotes\/\$\{id\}/g) || []).length === 2 &&
    !/r\.ok \? r\.json\(\) : null/.test(approval),
);
ok(
  "only a real 404 is allowed to mean 'no such quote'",
  /setQuoteErrorKey\(q\.status === 404 \? "" : q\.errorKey\)/.test(approval),
);
ok(
  "...and the failure panel returns BEFORE the not-found sentence",
  approval.indexOf("if (quoteErrorKey)") > -1 &&
    approval.indexOf("if (quoteErrorKey)") < approval.indexOf("if (!quote)"),
);
// The dangerous one. "Create client link" on an unknown share state offers to
// mint a second token for a quote that may already have one in the wild.
ok(
  "a share leg that FAILED does not read as 'no link yet'",
  /setShareErrorKey\(s\.status === 404 \? "" : s\.errorKey\)/.test(approval),
);
{
  const ctaAt = approval.indexOf("app.quoteApproval.createClientLink");
  const guardAt = approval.lastIndexOf("shareErrorKey ?", ctaAt);
  ok(
    "...and the Create button sits behind that gate",
    ctaAt > -1 && guardAt > -1 && guardAt < ctaAt,
    `gate@${guardAt} cta@${ctaAt}`,
  );
}
ok(
  "both panels offer the shared retry",
  (approval.replace(/\s+/g, " ").match(/<ListState[^>]*onRetry=\{load\}/g) || [])
    .length >= 2,
);

// ═══════════════════════════════════════════════════════════════════════════
section("5. An adjusted approval is split into subtotal + tax, and the lines follow");
//
// POST .../approve-estimate wrote the typed figure into subtotal AND total and
// left the old tax: a 13% draft (16,300 + 2,119 = 18,419) approved at 19,000
// stored subtotal 19,000, tax 2,119, total 19,000. The box opens on the
// TOTAL, so the typed figure is tax-inclusive; executed below against the
// shared function the route and the screen both call.
{
  const lines = [
    { description: "24.1 squares of Architectural shingles", quantity: 1, rate: 13250, amount: 13250 },
    { description: "Tear off 1 existing layer", quantity: 1, rate: 1570, amount: 1570 },
    { description: "Steep pitch (8/12)", quantity: 1, rate: 1480, amount: 1480 },
  ];
  const draft = {
    subtotal: 16300,
    discount: 0,
    tax: 2119,
    total: 18419,
    taxEnabled: true,
    taxResolution: { v: 1, source: "jurisdiction_ca", rate: 13, region: "ON" },
    language: "fr",
    lineItems: lines,
    scopeGroups: [{ id: "g1", lineItems: lines, subtotal: 16300 }],
  };
  const m = approvedEstimateMoney(draft, 19000);
  const c = (n) => Math.round(Number(n) * 100);
  ok("19,000 splits at the document's 13%: 16,814.16 + 2,185.84", m.subtotal === 16814.16 && m.tax === 2185.84 && m.total === 19000, JSON.stringify(m && { s: m.subtotal, t: m.tax, T: m.total }));
  ok("…total = subtotal + tax (the old route stored 19,000 + 2,119 = 19,000)", c(m.subtotal) + c(m.tax) === c(m.total));
  ok("…the difference is ONE 'Price adjustment' line, in the document's language", m.adjustment === 514.16 && m.group.lineItems.at(-1).description === "Ajustement du prix" && m.group.lineItems.at(-1).amount === 514.16, JSON.stringify(m.group?.lineItems?.at(-1)));
  ok("…so the lines add up to the new subtotal, on the group and on the quote", c(m.group.subtotal) === c(m.subtotal) && m.group.lineItems.reduce((s, l) => s + c(l.amount), 0) === c(m.subtotal) && m.quoteLineItems.reduce((s, l) => s + c(l.amount), 0) === c(m.subtotal));
  ok("…the measured lines themselves are untouched", JSON.stringify(m.group.lineItems.slice(0, 3)) === JSON.stringify(lines));
  ok("…and the stored tax record still explains the tax (same rate, new base)", m.taxResolution?.source === "jurisdiction_ca" && m.taxResolution?.rate === 13);

  const down = approvedEstimateMoney(draft, 17000);
  ok("approving LOWER adds a negative adjustment and still adds up", down.adjustment < 0 && c(down.subtotal) + c(down.tax) === c(down.total) && down.total === 17000 && down.quoteLineItems.reduce((s, l) => s + c(l.amount), 0) === c(down.subtotal));
  const same = approvedEstimateMoney(draft, 18419);
  ok("approving at the drafted total adds no line", same.adjustment === 0 && same.group === null && same.quoteLineItems.length === 3);

  // The rate is the document's, never re-resolved: a record that no longer
  // explains the tax (someone typed 5% on the builder) gives way to the rate
  // the stored money implies — QuoteBuilder's own recovery.
  const retyped = approvedEstimateMoney({ ...draft, tax: 815, total: 17115 }, 21000);
  ok("a record that doesn't explain the tax on the page yields to the stored money's rate (5%)", appliedTaxRate({ ...draft, tax: 815 }) === 5 && retyped.tax === 1000 && retyped.subtotal === 20000);
  const qc = approvedEstimateMoney({ ...draft, subtotal: 1000, tax: 149.75, total: 1149.75, taxResolution: null, lineItems: [{ amount: 1000 }], scopeGroups: [] }, 1200);
  ok("Quebec's 14.975%: lands on 1,200.00 or a cent off, and always adds up", Math.abs(qc.total - 1200) <= 0.01 && c(qc.subtotal) + c(qc.tax) === c(qc.total) && qc.group === null && qc.quoteLineItems.at(-1).description === "Ajustement du prix");
  const noTax = approvedEstimateMoney({ ...draft, tax: 0, total: 16300, taxEnabled: false, taxResolution: null }, 17500);
  ok("tax switched off: the typed total is the subtotal, tax stays 0", noTax.subtotal === 17500 && noTax.tax === 0 && noTax.taxResolution === null);
  const disc = approvedEstimateMoney({ ...draft, discount: 300, tax: 2080, total: 18080 }, 19000);
  ok("a discount stays a discount: tax on subtotal − discount", c(disc.subtotal) - c(disc.discount) + c(disc.tax) === c(disc.total) && disc.discount === 300);

  // The screen previews with no lines in hand — the queue sends linesTotal —
  // and must show exactly what the route will write.
  // Shaped the way the queue sends it: no lines, no tax record — the rate
  // and the lines' total precomputed by the route's own two functions.
  const preview = approvedEstimateMoney(
    { ...draft, lineItems: undefined, scopeGroups: undefined, taxResolution: undefined, taxRate: appliedTaxRate(draft), linesTotal: documentLinesTotal(draft) },
    19000,
  );
  // And the rate is what decides it: Quebec's 14.975% on $100.01 rounds to a
  // $14.98 tax that implies 14.9785%. The record still explains it, so the
  // route splits at 14.975% — and a browser re-deriving the rate from the
  // money would preview a total a cent off the one written.
  const tiny = { ...draft, subtotal: 100.01, tax: 14.98, total: 114.99, taxResolution: { v: 1, source: "jurisdiction_ca", rate: 14.975 }, lineItems: [{ amount: 100.01 }], scopeGroups: [] };
  const tinyRoute = approvedEstimateMoney(tiny, 200);
  const tinyScreen = approvedEstimateMoney({ ...tiny, lineItems: undefined, taxResolution: undefined, taxRate: appliedTaxRate(tiny), linesTotal: documentLinesTotal(tiny) }, 200);
  const tinyNaive = approvedEstimateMoney({ ...tiny, lineItems: undefined, taxResolution: undefined, linesTotal: documentLinesTotal(tiny) }, 200);
  ok("…even where the stored money and the record disagree in the last cent (14.975% on 100.01)", tinyRoute.tax === tinyScreen.tax && tinyRoute.total === tinyScreen.total && tinyRoute.total === 200 && tinyNaive.total !== tinyRoute.total, JSON.stringify([tinyRoute.tax, tinyScreen.tax, tinyNaive.tax]));
  ok("the screen's preview (linesTotal only) is the split the route writes", preview.subtotal === m.subtotal && preview.tax === m.tax && preview.adjustment === m.adjustment);
  ok("PRICE_ADJUSTMENT_LABEL covers all nine app languages", Object.keys(APP_MESSAGES).every((l) => priceAdjustmentLabel(l) && (l === "en" || priceAdjustmentLabel(l) !== PRICE_ADJUSTMENT_LABEL.en)));

  // Wiring, read: the route writes tax and the lines in one transaction, and
  // no longer copies the typed figure into subtotal.
  ok("the route no longer writes the typed figure into subtotal", !/data\.subtotal = finalTotal/.test(approveRoute) && /data\.subtotal = money\.subtotal/.test(approveRoute) && /data\.tax = money\.tax/.test(approveRoute));
  ok("…and the adjustment line lands on the scope group in the same transaction", /db\.\$transaction\(\[/.test(approveRoute) && /quoteScopeGroup\.update/.test(approveRoute));
  ok("the screen says the box is tax-inclusive, from the same function", /approvedEstimateMoney\(q, adjusted\)/.test(reviews) && /app\.reviews\.approveAtTaxIncluded/.test(reviews) && /app\.reviews\.approveAdjustmentLine/.test(reviews));
  const reviewsRoute = code("app/api/quotes/estimate-reviews/route.js");
  ok("the queue sends the rate and the lines' total only beside visible money", /canSeeMoney\(full\) && \{\s*taxRate: appliedTaxRate/.test(reviewsRoute) && /linesTotal: documentLinesTotal/.test(reviewsRoute));
}

// ═══════════════════════════════════════════════════════════════════════════
section("5b. POST /api/quotes/[id]/approve-estimate, executed against the scripted db");
//
// The route itself, not a reading of it: the member stub signs an owner in,
// the db stub holds a 13% instant draft with one scope group, and the writes
// the handler asks Prisma for are what is asserted. On the old handler the
// quote write is { total: 19000, subtotal: 19000 } with the tax untouched.
{
  const OWNER = { id: "mem_owner", userId: "u_owner", companyId: "co_1", role: "owner", permissions: null };
  const lines = [
    { description: "24.1 squares of Architectural shingles", quantity: 1, rate: 13250, amount: 13250 },
    { description: "Tear off 1 existing layer", quantity: 1, rate: 1570, amount: 1570 },
    { description: "Steep pitch (8/12)", quantity: 1, rate: 1480, amount: 1480 },
  ];
  const seed = (extra = {}) => {
    resetDbStub();
    rows.member = [OWNER];
    rows.quote = [
      {
        id: "q_1",
        companyId: "co_1",
        autoEstimated: true,
        needsReview: true,
        subtotal: 16300,
        discount: 0,
        tax: 2119,
        total: 18419,
        taxEnabled: true,
        taxResolution: { v: 1, source: "jurisdiction_ca", rate: 13, region: "ON" },
        language: "en",
        lineItems: lines,
        scopeGroups: [{ id: "g_1", lineItems: lines, subtotal: 16300, sortOrder: 0 }],
        ...extra,
      },
    ];
    rows.quoteScopeGroup = [{ id: "g_1", quoteId: "q_1", lineItems: lines, subtotal: 16300, sortOrder: 0 }];
    session.member = OWNER;
  };
  const call = (body) =>
    approvePOST(
      new Request("https://app.fieldquo.com/api/quotes/q_1/approve-estimate", {
        method: "POST",
        body: body === undefined ? undefined : JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: "q_1" }) },
    );
  const quoteWrite = () => writes.find((w) => w.model === "quote" && w.action === "update")?.data;
  const groupWrite = () => writes.find((w) => w.model === "quoteScopeGroup" && w.action === "update");
  const c = (n) => Math.round(Number(n) * 100);

  seed();
  const res = await call({ total: 19000 });
  const q = quoteWrite();
  ok("an adjusted approval answers 200", res.status === 200, res.status);
  ok("…writes subtotal 16,814.16, tax 2,185.84, total 19,000 — tax re-charged on the new base", q?.subtotal === 16814.16 && q?.tax === 2185.84 && q?.total === 19000, JSON.stringify(q && { subtotal: q.subtotal, tax: q.tax, total: q.total }));
  ok("…so total = subtotal + tax on the stored row", q && c(q.subtotal) + c(q.tax) === c(q.total));
  const lastLine = q?.lineItems?.at(-1);
  ok("…the quote's lines gain one 'Price adjustment' of 514.16 and add up to the subtotal", lastLine?.description === "Price adjustment" && lastLine?.amount === 514.16 && (q?.lineItems || []).reduce((s, l) => s + c(l.amount), 0) === c(q?.subtotal), JSON.stringify(lastLine));
  const g = groupWrite();
  ok("…and so does the scope group, written in the same call", g?.where?.id === "g_1" && c(g?.data?.subtotal) === c(q?.subtotal) && g.data.lineItems.reduce((s, l) => s + c(l.amount), 0) === c(q?.subtotal), JSON.stringify(g?.data?.subtotal));
  ok("…and the review is cleared", q?.needsReview === false && q?.reviewedById === "u_owner");

  seed();
  await call({});
  const plain = quoteWrite();
  ok("approving without a figure touches no money at all", plain && !("total" in plain) && !("subtotal" in plain) && !("tax" in plain) && !("lineItems" in plain) && !groupWrite(), JSON.stringify(plain));

  seed({ language: "de" });
  await call({ total: 17000 });
  const lower = quoteWrite();
  ok("approving lower on a German quote: a negative 'Preisanpassung' line, and it still adds up", lower?.lineItems?.at(-1)?.description === "Preisanpassung" && lower.lineItems.at(-1).amount < 0 && c(lower.subtotal) + c(lower.tax) === c(lower.total) && lower.total === 17000);

  seed({ taxEnabled: false, tax: 0, total: 16300, taxResolution: null });
  await call({ total: 17500 });
  const untaxed = quoteWrite();
  ok("tax switched off: subtotal = total = the typed figure, tax 0", untaxed?.subtotal === 17500 && untaxed?.tax === 0 && untaxed?.total === 17500);
}

// ═══════════════════════════════════════════════════════════════════════════
section("6. Names, not keys: the lead's source and the option picked");
{
  const langs = Object.keys(APP_MESSAGES);
  const missing = [];
  for (const key of new Set([...Object.values(LEAD_SOURCE_LABEL_KEY), UNKNOWN_LEAD_SOURCE_KEY])) {
    for (const l of langs) if (!APP_MESSAGES[l]?.[key]) missing.push(`${l}:${key}`);
  }
  for (const key of ["app.reviews.approveAtTaxIncluded", "app.reviews.approveAtNoTax", "app.reviews.approveAdjustmentLine"]) {
    for (const l of langs) if (!APP_MESSAGES[l]?.[key]) missing.push(`${l}:${key}`);
  }
  ok(`every lead-source and approve-caption label exists in all ${langs.length} app languages`, missing.length === 0, missing.join(", "));
  // Every source a lead is written with today, from the creators themselves.
  const written = ["instant_quote", "self_quote", "self_quote_kitchen", "client_portal", "embed_form", "phone_agent", "phone_agent_recovered", "manual", "imported", "funnel", "funnel:facebook", "meta_lead_form", "ai_employee", "web_chat", "sms_chat", "meta_messenger", "meta_instagram", "meta_whatsapp", "email"];
  const unnamed = written.filter((s) => leadSourceLabelKey(s) === UNKNOWN_LEAD_SOURCE_KEY);
  ok("every source FieldQuo writes on a lead has a label", unnamed.length === 0, unnamed.join(", "));
  ok("instant_quote reads as the traffic report's 'Instant estimate'", leadSourceLabelKey("instant_quote") === "app.traffic.instantEstimate");
  const tt = (k) => `T(${k})`;
  ok(
    "a word the map doesn't know says so — never the raw column",
    leadSourceLabel(tt, "footer-form") === `T(${UNKNOWN_LEAD_SOURCE_KEY})` &&
      leadSourceLabel(tt, "__proto__") === `T(${UNKNOWN_LEAD_SOURCE_KEY})` &&
      leadSourceLabel(tt, "toString") === `T(${UNKNOWN_LEAD_SOURCE_KEY})`,
  );
  ok("no source at all prints nothing", leadSourceLabel(tt, null) === "" && leadSourceLabel(tt, "") === "");
  const leadsSrc = read("app/app/leads/page.js");
  ok("function LeadDrawer( and function LeadCard( are textually intact (check:leads-drag slices on them)", /function LeadDrawer\(\{ leadId, assignees, onClose, onPatched, t(?:, sample = null)? \}\)/.test(leadsSrc) && /function LeadCard\(/.test(leadsSrc));
  const leads = code("app/app/leads/page.js");
  ok("the lead drawer no longer prints the raw source", !/lead\.source && ` · \$\{lead\.source\}`/.test(leads) && /leadSourceLabel\(t, lead\.source\)/.test(leads));
  ok("…and names the option from the route's materialLabel", /row\.key === "material" && lead\?\.materialLabel/.test(leads));
  ok("the review card names the option instead of tidying its key", /q\.materialLabel\s*\?\s*q\.materialLabel\.translations\?\.\[language\] \|\| q\.materialLabel\.label/.test(reviews));
  const leadRoute = code("app/api/leads/[id]/route.js");
  ok("GET /api/leads/[id] sends materialLabel, for the instant estimate's leads only", /lead\.source === "instant_quote"/.test(leadRoute) && /materialLabel \}/.test(leadRoute));
}

console.log(
  failures.length
    ? `\nFAILED — ${failures.length} of ${pass + failures.length}\n${failures.map((f) => `  x ${f}`).join("\n")}`
    : `\nPASSED — ${pass}/${pass} assertions`,
);
process.exit(fail ? 1 : 0);
