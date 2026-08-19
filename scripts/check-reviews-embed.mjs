// scripts/check-reviews-embed.mjs
//
// The reviews embed (/embed/<slug>/reviews) is served inside a stranger's
// website, where nobody at FieldQuo will ever look at it. Two things about it
// can break silently:
//
//   1. The merge. It reads two sources of reviews — the approval-gated
//      Testimonial table and the site's block JSON — and both arrive as
//      whatever the database happens to hold. A `pages` that is a string, a
//      block whose content is null, the same review recorded in both places.
//      Every one of those is a shape failure, and every one is a millisecond
//      to provoke here and impossible to notice on a customer's homepage.
//
//   2. The colour. Every pair the embed paints derives from one brand hex, and
//      contractors pick yellow, white, black and mid-grey. This measures the
//      quote, the byline and the card edge across all of them rather than
//      trusting that washPair() still returns what it returned last month.
//
//   node --import ./scripts/alias-loader.mjs scripts/check-reviews-embed.mjs
import { mergeReviews } from "@/lib/reviews/mergeReviews";
import { documentTheme, washPair, accentIsWashedOut } from "@/lib/documents/theme";
import { contrastRatio } from "@/lib/brand/colour";

let bad = 0;
const ok = (label, cond, extra = "") => {
  console.log(`${cond ? "  ok  " : "  FAIL"} ${label} ${extra}`);
  if (!cond) bad++;
};

console.log("\nmergeReviews — hostile input\n");

ok("no args", JSON.stringify(mergeReviews()) === "[]");
ok("null site", JSON.stringify(mergeReviews({ rows: [], site: null })) === "[]");
ok(
  "blocks is a string",
  JSON.stringify(mergeReviews({ site: { blocks: "nope", pages: "nope" } })) === "[]",
);
ok(
  "block with null content",
  JSON.stringify(mergeReviews({ site: { blocks: [{ type: "testimonials" }] } })) === "[]",
);
ok(
  "items is an object",
  JSON.stringify(
    mergeReviews({ site: { blocks: [{ type: "testimonials", content: { items: {} } }] } }),
  ) === "[]",
);
ok(
  "non-string quote dropped",
  JSON.stringify(
    mergeReviews({
      site: { blocks: [{ type: "testimonials", content: { items: [{ quote: 42 }, { quote: "  " }, null] } }] },
    }),
  ) === "[]",
);

const rows = [
  { quote: "Great work.", authorName: "Ann", authorTitle: "Homeowner", companyLabel: null },
  { quote: "Great work.", authorName: "Someone else" }, // exact duplicate
  { quote: null, authorName: "No quote" },
];
const site = {
  blocks: [
    { type: "testimonials", content: { items: [{ quote: "  great WORK. ", author: "Bob" }] } },
    { type: "testimonials", visible: false, content: { items: [{ quote: "Hidden one", author: "X" }] } },
    { type: "hero", content: { items: [{ quote: "Not a review", author: "Y" }] } },
  ],
  pages: [
    { blocks: [{ type: "testimonials", content: { items: [{ quote: "Great work.", author: "Bob" }, { quote: "Second one", author: "Cid" }] } }] },
    null,
    { blocks: "nope" },
  ],
};
const merged = mergeReviews({ rows, site });
console.log("  merged:", JSON.stringify(merged));
ok("table row wins and dedupes across sources", merged.length === 2);
ok("byline joined from name + title", merged[0]?.author === "Ann, Homeowner");
ok("hidden block excluded", !merged.some((r) => r.quote === "Hidden one"));
ok("non-testimonial block excluded", !merged.some((r) => r.quote === "Not a review"));
ok("page-only review kept", merged[1]?.quote === "Second one");

const many = Array.from({ length: 40 }, (_, i) => ({ quote: `q${i}`, authorName: "A" }));
ok("limit enforced", mergeReviews({ rows: many }).length === 6);
ok("explicit limit enforced", mergeReviews({ rows: many, limit: 3 }).length === 3);

console.log("\nContrast — every pair the embed paints\n");

// The colours contractors actually pick, plus the mid-tones the naive rule fails on.
const BRANDS = [
  "#ffffff", "#fefefe", "#ffff00", "#000000", "#808080", "#bd9d60",
  "#06356b", "#7cb342", "#c0c0c0", "#ff6f00", "#2e2e2e", "#e5e7eb",
];

for (const brandColor of BRANDS) {
  const theme = documentTheme({ brandColor });
  const s = washPair(theme);
  const quote = contrastRatio(s.ink, s.bg);
  const author = contrastRatio(s.muted, s.bg);
  // The card edge only has to be visible, not readable. The host page is
  // usually white, so that is the pairing that decides whether a card reads as
  // a card at all.
  const edgeColor = accentIsWashedOut(theme) ? theme.border : theme.accentRule;
  const edge = contrastRatio(edgeColor, "#ffffff");
  ok(
    `${brandColor} bg ${s.bg}`,
    quote >= 4.5 && author >= 4.5 && edge >= 1.25,
    `quote ${quote.toFixed(2)}:1  author ${author.toFixed(2)}:1  edge-on-white ${edge.toFixed(2)}:1`,
  );
}

console.log(bad === 0 ? "\nAll good.\n" : `\n${bad} FAILURES\n`);
process.exit(bad === 0 ? 0 : 1);
