// scripts/check-task-suggestions.mjs
//
//   npm run check:task-suggestions
//
// The anti-hallucination guard in lib/tasks/suggestFromJob.js, executed
// against the cases that matter.
//
// A model asked not to invent things will still invent things. The only thing
// standing between "the notes said call ahead, the gate is locked" and a
// confidently fabricated "arrange a building permit" is quoteIsGrounded() —
// so it gets tested like a security boundary, not like a formatter.
import { quoteIsGrounded } from "../lib/tasks/suggestFromJob.js";

let pass = 0;
const failures = [];
const check = (label, actual, expected) => {
  if (actual === expected) { pass += 1; console.log(`  ok   ${label}`); }
  else { failures.push(label); console.log(`  FAIL ${label}\n       expected ${expected}, got ${actual}`); }
};

const NOTES = [
  "Back gate is locked — call Mrs. Alvarez the day before to get the code.",
  "Client works nights, do not ring the bell before 11am.",
  "There is a dog in the yard, friendly but keep the side gate shut.",
  "Driveway is shared with number 14, don't block it.",
].join("\n");

console.log("\nGrounded quotes (must pass)\n");
check("verbatim quote", quoteIsGrounded("Back gate is locked", NOTES), true);
check("quote from the middle", quoteIsGrounded("call Mrs. Alvarez the day before", NOTES), true);
check("different case", quoteIsGrounded("CLIENT WORKS NIGHTS", NOTES), true);
check("punctuation reflowed by the model", quoteIsGrounded("Back gate is locked, call Mrs Alvarez", NOTES), true);
check("curly apostrophe normalised", quoteIsGrounded("don’t block it", NOTES), true);
check("one filler word dropped", quoteIsGrounded("there is dog in the yard friendly", NOTES), true);

console.log("\nUngrounded quotes (must be rejected)\n");
check("clean fabrication", quoteIsGrounded("arrange a building permit with the city", NOTES), false);
check("plausible trade knowledge not in the notes", quoteIsGrounded("order materials before the pour", NOTES), false);
check("paraphrase, not a quote", quoteIsGrounded("access is restricted at the property", NOTES), false);
check("empty quote", quoteIsGrounded("", NOTES), false);
check("whitespace-only quote", quoteIsGrounded("   ", NOTES), false);
check("null quote", quoteIsGrounded(null, NOTES), false);
check("undefined quote", quoteIsGrounded(undefined, NOTES), false);
check("no notes to quote from", quoteIsGrounded("Back gate is locked", ""), false);
check("null haystack", quoteIsGrounded("Back gate is locked", null), false);

console.log("\nThe cheap ways past a naive check\n");
// A two-word quote made of common words would match almost any note by
// coincidence. The word-count floor is what stops it.
check("two common words can't pass on coincidence", quoteIsGrounded("the a", NOTES), false);
check("single common word can't pass", quoteIsGrounded("the", NOTES), false);
check("very short string can't pass", quoteIsGrounded("dog", NOTES), false);
// Scattered words that never appear together are a fabrication assembled from
// the vocabulary of the notes — the most likely hallucination shape.
check("words lifted from separate lines and recombined",
  quoteIsGrounded("permit inspection scaffolding required", NOTES), false);
// A model that pads a real quote with invented specifics must not pass.
check("real quote padded with invented detail",
  quoteIsGrounded("Back gate is locked and the permit number is 4471 issued Tuesday", NOTES), false);
// Non-string input must not throw.
let threw = false;
try { quoteIsGrounded({ a: 1 }, NOTES); quoteIsGrounded(NOTES, { b: 2 }); } catch { threw = true; }
check("object input doesn't throw", threw, false);
check("numeric input doesn't throw", quoteIsGrounded(12345, NOTES), false);

console.log(`\n${pass + failures.length} checks, ${failures.length} failure(s).\n`);
if (failures.length) process.exitCode = 1;
