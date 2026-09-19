// scripts/check-photo-notes.mjs
//
// The free review never looks at a photograph. Only the paid deep read does.
//
// ══ What this file used to assert, and why it flipped ═════════════════════
//
// Until 2026-09-15 this check guarded the OPPOSITE: that the free review's
// `photoNotes` (up to four photos at detail "low" on every review) reached
// the panel instead of being generated and dropped. That was the right fix
// for the bug it fixed. Then the owner set the rule: "the free AI should not
// review the photo, only the other components of the quote… only the AI Deep
// Read should read the image, because that is what they pay for." A free
// pass that already describes the pictures undercuts the thing being sold
// and adds image cost to every review.
//
// So the assertions are now the absence: no images leave writingPass, the
// schema and the prompt never mention photoNotes, the panel points a quote
// that HAS photos at the deep read rather than reading them, and the deep
// read's findings can be put into the internal notes for review with one
// press — never into anything the client reads.
//
// Reviews stored before the change still carry photoNotes/photosRead; the
// panel keeps rendering those. It just never gets new ones.
import { readFileSync } from "node:fs";
import { APP_MESSAGES } from "@/app/i18n/appMessages";

let fail = 0;
const ok = (c, m, d) => {
  console.log((c ? "  ok   " : "  FAIL ") + m + (c || d === undefined ? "" : `  — got ${JSON.stringify(d)}`));
  if (!c) fail++;
};
const section = (t) => console.log(`\n${t}\n`);
const decomment = (src) =>
  src
    .split("\n")
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .join("\n");

const lib = decomment(readFileSync("lib/ai/quoteReview.js", "utf8"));
const vision = readFileSync("lib/ai/visionPass.js", "utf8");
const ui = decomment(readFileSync("app/components/quotes/SuggestAddOns.js", "utf8"));
const builder = decomment(readFileSync("app/components/quotes/builder/QuoteBuilder.js", "utf8"));
const provider = readFileSync("lib/ai/provider.js", "utf8");

section("1. The free review is text-only");

ok(!/images:\s*photos/.test(lib), "writingPass sends no images to complete()");
ok(!/photoNotes/.test(lib), "…and neither the schema nor the prompt mentions photoNotes");
ok(!/required: \[[^\]]*"photoNotes"/.test(lib), "…so the vendor is never asked for them");
ok(/You are given TEXT ONLY/.test(readFileSync("lib/ai/quoteReview.js", "utf8")), "…and the prompt says so, so the model cannot invent a note about a picture it never saw");
ok(/photosAttached: photosFromQuote\(quote\)\.length/.test(lib), "the review still COUNTS the quote's photos (a fact about the quote, not a read of it)");
ok(!/photosRead: /.test(lib), "…and never reports a photosRead of its own");

section("2. The paid deep read is the one thing that reads a picture");

ok(/imageDetail: "high"/.test(vision) || /detail: "high"/.test(vision), "visionPass reads at high detail");
ok(/photosFromQuote\(/.test(vision), "…over the same photo set the review counted");
ok(/VISION_PASS_CENTS/.test(readFileSync("app/api/quotes/[id]/vision/route.js", "utf8")), "…and its route charges VISION_PASS_CENTS — the review charges nothing for images because it sends none");
ok(/imageDetail = "low"/.test(provider), "complete()'s image default is still low, for any future caller that does send images");

section("3. The panel points at the deep read instead of reading for free");

ok(/review\.photosAttached > 0/.test(ui), "a quote with photos is told they were not read");
ok(/app\.quoteReview\.photosNotReadHint/.test(ui), "…with the price of the pass that does read them");
ok(/!\(review\.photosRead > 0\) && review\.photosAttached > 0/.test(ui), "…but a review stored before the change (photosRead > 0) still shows its own notes instead");
ok(/review\.photosRead > 0 &&/.test(ui), "…and that legacy block is still rendered");

section("4. Deep-read findings go to the notes for review, never to the client");

ok(/onReviewNotes/.test(ui) && /data-deep-read-to-notes/.test(ui), "each deep-read pass has an Add-to-notes button");
ok(/onReviewNotes && !readOnly/.test(ui), "…only when the caller wired it and the quote is still editable");
ok(/app\.deepRead\.notesHeading/.test(ui) && /p\.notes\.map\(\(n\) => `— \$\{n\}`\)/.test(ui), "…and it writes a dated heading plus one dash per finding");
// Since 2026-09-19 the append is SAVED through /api/quotes/[id]/review-notes
// (scripts/check-review-notes.mjs executes the route); the builder adopts the
// merged note the server returns into reviewNotes — still the INTERNAL box.
ok(/onReviewNotes=\{async \(text\) =>/.test(builder) && /review-notes`/.test(builder) && /setReviewNotes\(typeof saved\?\.reviewNotes === "string"/.test(builder), "the builder appends it to reviewNotes — the INTERNAL box — through the append route");
ok(!/onReviewNotes=\{setProcessNotes\}|onReviewNotes=\{setNotes\}/.test(builder), "…never to processNotes or the client-facing notes");
ok(/onProcessNotes=\{setProcessNotes\}/.test(builder), "the what-happens-next Use-this still goes where it went");

section("5. Nine languages");

for (const lang of Object.keys(APP_MESSAGES)) {
  const m = APP_MESSAGES[lang];
  ok(
    ["app.deepRead.addToNotes", "app.deepRead.notesHeading", "app.quoteReview.photosNotReadOne", "app.quoteReview.photosNotReadMany", "app.quoteReview.photosNotReadHint"].every((k) => typeof m[k] === "string" && m[k]) &&
      /\{price\}/.test(m["app.quoteReview.photosNotReadHint"]) &&
      /\{count\}/.test(m["app.quoteReview.photosNotReadMany"]) &&
      !/quick check|vérification rapide|comprobación rápida|schnellen Prüfung|controllo rapido|快速检查/.test(m["app.deepRead.description"]),
    `${lang}: the deep read no longer describes itself against a "quick check" the review does not do, and the new sentences exist`,
  );
}

console.log(`\n${fail === 0 ? "ALL PASS" : fail + " FAILED"}`);
process.exit(fail ? 1 : 0);
