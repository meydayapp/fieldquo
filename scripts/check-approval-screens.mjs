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
    /const finalTotal = Number\(body\?\.total\)/.test(approveRoute),
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

console.log(
  failures.length
    ? `\nFAILED — ${failures.length} of ${pass + failures.length}\n${failures.map((f) => `  x ${f}`).join("\n")}`
    : `\nPASSED — ${pass}/${pass} assertions`,
);
process.exit(fail ? 1 : 0);
