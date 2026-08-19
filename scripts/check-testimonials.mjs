// scripts/check-testimonials.mjs
//
//   npm run check:testimonials
//
// The paste box, executed against the things people actually paste.
//
// Every assertion here is a shape a contractor can produce in ten seconds with
// a mouse: a review copied with its surrounding quote marks, a spreadsheet
// whose header says "Reviewer", the same list pasted twice because two were
// missing the first time. None of them are hypothetical, and none of them are
// visible by reading lib/reviews/testimonials.js — they are only visible by
// running it, which is why this file exists rather than a paragraph of prose.

import {
  cleanAuthor,
  cleanQuote,
  contentKey,
  looksTabular,
  parseBlocks,
  parseTabularRows,
  tidyText,
  totalSkipped,
  MAX_QUOTE,
  MAX_NAME,
  MAX_ROWS,
} from "@/lib/reviews/testimonials";

let failures = 0;
let checks = 0;
function ok(name, pass, detail = "") {
  checks++;
  if (!pass) failures++;
  console.log(`  ${pass ? "ok  " : "FAIL"} ${name}${detail ? `  — ${detail}` : ""}`);
}

// ── Blocks: the format the UI documents ────────────────────────────────────

console.log("\nBlocks — name on the first line, words underneath\n");

{
  const text = `Jane Doe
They repainted the whole ground floor in two days and left it spotless.

Marco P.
Fair price, showed up when they said they would.`;
  const { rows, skipped } = parseBlocks(text);
  ok("two blocks become two rows", rows.length === 2, `got ${rows.length}`);
  ok("author is the first line", rows[0].authorName === "Jane Doe", rows[0]?.authorName);
  ok("quote is the rest", rows[1].quote.startsWith("Fair price"), rows[1]?.quote);
  ok("nothing skipped", totalSkipped(skipped) === 0, JSON.stringify(skipped));
}

{
  // The multi-paragraph review: extra blank lines inside one person's words
  // split it, and the trailing halves have no author line. They must be
  // reported, not silently attributed to their own first sentence.
  const { rows, skipped } = parseBlocks(`Jane Doe
Great work.

Absolutely great work.`);
  ok("orphan block is not self-attributed",
    rows.length === 1 && rows[0].authorName === "Jane Doe",
    JSON.stringify(rows.map((r) => r.authorName)));
  ok("orphan block is counted as missing an author", skipped.noAuthor === 1, JSON.stringify(skipped));
}

{
  const { rows } = parseBlocks(`Jane Doe
  Lots    of     ragged
  whitespace   from the browser  `);
  ok("whitespace collapses to one line",
    rows[0].quote === "Lots of ragged whitespace from the browser", JSON.stringify(rows[0]?.quote));
}

{
  const { rows, skipped } = parseBlocks("\n\n   \n\n");
  ok("all-blank paste yields nothing and does not throw", rows.length === 0);
  ok("all-blank paste reports no phantom skips", totalSkipped(skipped) === 0, JSON.stringify(skipped));
}

{
  const { rows, skipped } = parseBlocks(`Jane Doe
ok`);
  ok("a two-character quote is refused, not published", rows.length === 0 && skipped.tooShort === 1,
    JSON.stringify(skipped));
}

{
  const many = Array.from({ length: MAX_ROWS + 5 }, (_, i) => `Person ${i}\nThey did a really good job on the house.`).join("\n\n");
  const { rows, skipped } = parseBlocks(many);
  ok(`caps at ${MAX_ROWS} rows`, rows.length === MAX_ROWS, `got ${rows.length}`);
  ok("the overflow is reported rather than dropped in silence", skipped.overLimit === 5, JSON.stringify(skipped));
}

// ── Decoration people paste along with the words ───────────────────────────

console.log("\nDecoration\n");

ok("leading em-dash is stripped from a name", cleanAuthor("— Jane Doe") === "Jane Doe", cleanAuthor("— Jane Doe"));
ok("smart quotes around a name are stripped", cleanAuthor("“Jane Doe”") === "Jane Doe", cleanAuthor("“Jane Doe”"));
ok("a bullet is stripped", cleanAuthor("• Jane Doe") === "Jane Doe", cleanAuthor("• Jane Doe"));
ok("matched quotes around a review are stripped",
  cleanQuote("“They were tidy and fast.”") === "They were tidy and fast.",
  cleanQuote("“They were tidy and fast.”"));
ok("an UNMATCHED opening quote is kept — it is part of what they wrote",
  cleanQuote("“Best in town, no question") === "“Best in town, no question",
  cleanQuote("“Best in town, no question"));
ok("an interior apostrophe survives",
  cleanQuote("They didn't leave a mark on the floor.") === "They didn't leave a mark on the floor.");
ok("a name is capped", cleanAuthor("z".repeat(500)).length === MAX_NAME, String(cleanAuthor("z".repeat(500)).length));
ok("a quote is capped", tidyText("z".repeat(9999), MAX_QUOTE).length === MAX_QUOTE);
ok("a non-string does not throw", tidyText(null, 10) === "" && cleanAuthor(undefined) === "" && cleanQuote(42) === "");

// ── Re-importing must not duplicate ────────────────────────────────────────

console.log("\nRe-import\n");

{
  const text = `Jane Doe
They repainted the whole ground floor in two days.

Marco P.
Fair price, showed up when they said they would.`;
  const first = parseBlocks(text);
  const second = parseBlocks(text);
  ok("the same paste yields the same identities",
    first.rows.map((r) => r.externalId).join() === second.rows.map((r) => r.externalId).join());
  ok("two different reviews get different identities",
    first.rows[0].externalId !== first.rows[1].externalId);
}

ok("spacing and case do not change identity",
  contentKey({ authorName: "  Jane   DOE ", quote: "Great  Work here." }) ===
  contentKey({ authorName: "jane doe", quote: "great work here." }));

ok("the same words from a different person are a different row",
  contentKey({ authorName: "Jane Doe", quote: "Great work here." }) !==
  contentKey({ authorName: "John Doe", quote: "Great work here." }));

ok("a different review from the same person is a different row",
  contentKey({ authorName: "Jane Doe", quote: "Great work here." }) !==
  contentKey({ authorName: "Jane Doe", quote: "Great work again." }));

{
  // Two identical reviews inside ONE paste. If this does not collapse, the
  // "re-import updates" promise is already broken on the first import, and
  // the unique index would reject the whole batch.
  const { rows, skipped } = parseBlocks(`Jane Doe
They were tidy and fast.

Jane Doe
They were tidy and fast.`);
  ok("a duplicate within one paste collapses", rows.length === 1, `got ${rows.length}`);
  ok("and is reported", skipped.duplicate === 1, JSON.stringify(skipped));
}

ok("identities are a bounded length whatever the quote",
  contentKey({ authorName: "Jane", quote: "z".repeat(50000) }).length === 32);

// ── CSV detection and parsing ──────────────────────────────────────────────

console.log("\nCSV\n");

ok("a header naming author and quote is tabular",
  looksTabular("name,quote\nJane,Great work"));
ok("Google-ish header spellings are recognised",
  looksTabular("Reviewer\tReview Text\nJane\tGreat work"));
ok("a review full of commas is NOT mistaken for a CSV",
  !looksTabular("Fast, tidy, fair, and on time — could not fault them."));
ok("a header with no quote column is not tabular",
  !looksTabular("name,email\nJane,j@x.com"));
ok("a bare name block is not tabular", !looksTabular("Jane Doe\nGreat work here."));
ok("non-strings do not throw", !looksTabular(null) && !looksTabular(undefined) && !looksTabular(12));

{
  const { rows, skipped } = parseTabularRows([
    { Reviewer: "Jane Doe", "Review Text": "They repainted the hallway beautifully.", Role: "Homeowner" },
    { Reviewer: "Marco P.", "Review Text": "Fair price and tidy.", Company: "Marco Ltd" },
    { Reviewer: "", "Review Text": "Anonymous praise nobody can attribute." },
  ]);
  ok("varied headers map to the right fields",
    rows.length === 2 && rows[0].authorTitle === "Homeowner" && rows[1].companyLabel === "Marco Ltd",
    JSON.stringify(rows));
  ok("a row with no author is skipped, not published as blank", skipped.noAuthor === 1, JSON.stringify(skipped));
}

{
  // Papa Parse hands back a trailing all-empty row for a file ending in a
  // newline. It must count as blank, not as a missing author, or the screen
  // tells the contractor something went wrong when nothing did.
  const { rows, skipped } = parseTabularRows([
    { name: "Jane Doe", quote: "They repainted the hallway beautifully." },
    { name: "", quote: "" },
  ]);
  ok("a trailing empty CSV row is counted as blank", rows.length === 1 && skipped.blank === 1,
    JSON.stringify(skipped));
}

ok("a non-array does not throw", parseTabularRows(null).rows.length === 0);
ok("a row of junk does not throw", parseTabularRows([null, 4, "x", {}]).rows.length === 0);

{
  // Column priority: a sheet carrying both must not depend on key order.
  const { rows } = parseTabularRows([
    { customer: "Wrong", name: "Right", comment: "Second choice", quote: "First choice for the words." },
  ]);
  ok("the preferred column wins over the fallback",
    rows[0].authorName === "Right" && rows[0].quote === "First choice for the words.",
    JSON.stringify(rows[0]));
}

// ── Injection-ish input ────────────────────────────────────────────────────
//
// These are published to a public website. React escapes them at render, so
// this is not the defence — it is a check that the parser does not mangle or
// choke on them, which is how a "harmless" sanitiser becomes a broken one.

console.log("\nHostile text\n");

{
  const { rows } = parseBlocks(`Jane <script>alert(1)</script>
They did <b>great</b> work & left it clean.`);
  ok("markup passes through as literal text, unaltered",
    rows[0].quote === "They did <b>great</b> work & left it clean.", JSON.stringify(rows[0]?.quote));
  ok("markup in a name survives cleaning without throwing", rows[0].authorName.includes("script"));
}

{
  const { rows } = parseBlocks(`Jane Doe
=1+1 and a null   byte and an emoji 🎨 all survive parsing.`);
  ok("formula-ish and control characters do not throw", rows.length === 1);
}

console.log(`\n${checks - failures}/${checks} checks passed\n`);
process.exitCode = failures ? 1 : 0;
