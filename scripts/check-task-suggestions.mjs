// scripts/check-task-suggestions.mjs
//
//   npm run check:task-suggestions
//
// The anti-hallucination guard in lib/tasks/suggestFromJob.js, executed
// against the cases that matter — plus, since the photo/comment-required
// task feature landed, the pure completion gate in lib/tasks/completion.js
// that decides whether a to-do is actually allowed to become "done". Two
// different Task modules, one file, because both are "a to-do about a job"
// and both are exactly the kind of pure, security-relevant logic AGENTS.md
// asks to be executed against hostile input rather than only read.
//
// A model asked not to invent things will still invent things. The only thing
// standing between "the notes said call ahead, the gate is locked" and a
// confidently fabricated "arrange a building permit" is quoteIsGrounded() —
// so it gets tested like a security boundary, not like a formatter.
import { quoteIsGrounded } from "../lib/tasks/suggestFromJob.js";
import {
  completionGate,
  normaliseRequiredPhotoCount,
  canEditTask,
} from "../lib/tasks/completion.js";

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

// ═════════════════════════════════════════════════════════════════════════
// completionGate() — "a task requiring 2 photos with 1 attached, with 0,
// with 3" is the exact scenario the coordinator asked to see executed.
// ═════════════════════════════════════════════════════════════════════════

const missingCodes = (result) => result.missing.map((m) => m.code).sort().join(",");

console.log("\nA to-do requiring 2 photos, live-checked against how many are actually filed\n");
check("0 of 2 attached — refused", completionGate(
  { requiredPhotoCount: 2, requiresComment: false },
  { photoCount: 0, completionComment: null },
).ok, false);
check("1 of 2 attached — refused", completionGate(
  { requiredPhotoCount: 2, requiresComment: false },
  { photoCount: 1, completionComment: null },
).ok, false);
check("2 of 2 attached — allowed", completionGate(
  { requiredPhotoCount: 2, requiresComment: false },
  { photoCount: 2, completionComment: null },
).ok, true);
check("3 of 2 attached (requirement lowered after two were filed) — allowed",
  completionGate(
    { requiredPhotoCount: 2, requiresComment: false },
    { photoCount: 3, completionComment: null },
  ).ok, true);
check("the refusal names the SHORTFALL, not the requirement",
  completionGate(
    { requiredPhotoCount: 3, requiresComment: false },
    { photoCount: 1, completionComment: null },
  ).missing[0].message.includes("2 more"), true);

console.log("\nComment requirement, independent of the photo one\n");
check("no requirement at all — allowed with nothing attached", completionGate(
  { requiredPhotoCount: null, requiresComment: false },
  { photoCount: 0, completionComment: null },
).ok, true);
check("photos satisfied, comment required and empty — refused", completionGate(
  { requiredPhotoCount: 1, requiresComment: true },
  { photoCount: 1, completionComment: "" },
).ok, false);
check("whitespace-only comment does not count as a comment", completionGate(
  { requiredPhotoCount: null, requiresComment: true },
  { photoCount: 0, completionComment: "   \n  " },
).ok, false);
check("both requirements missing — BOTH codes reported, not just the first",
  missingCodes(completionGate(
    { requiredPhotoCount: 2, requiresComment: true },
    { photoCount: 0, completionComment: null },
  )), "comment,photos");
check("both satisfied — allowed", completionGate(
  { requiredPhotoCount: 2, requiresComment: true },
  { photoCount: 2, completionComment: "Painted the cabinets, swapped the handles." },
).ok, true);

console.log("\nHostile input to completionGate — a live photoCount can't misbehave, but this proves it\n");
check("a negative photoCount is clamped to 0, not treated as satisfying MORE than the requirement",
  completionGate(
    { requiredPhotoCount: 2, requiresComment: false },
    { photoCount: -5, completionComment: null },
  ).missing[0].message, "Needs 2 photos before it can be marked done.");
check("requiredPhotoCount as a numeric string still gates", completionGate(
  { requiredPhotoCount: "2", requiresComment: false },
  { photoCount: 1, completionComment: null },
).ok, false);
check("a non-string completionComment doesn't crash the .trim() call", (() => {
  try {
    return completionGate(
      { requiredPhotoCount: null, requiresComment: true },
      { photoCount: 0, completionComment: 4471 },
    ).ok;
  } catch { return "threw"; }
})(), true);

console.log("\nnormaliseRequiredPhotoCount — what a request body is allowed to mean by \"no requirement\"\n");
check("omitted (null)", normaliseRequiredPhotoCount(null).value, null);
check("omitted (undefined)", normaliseRequiredPhotoCount(undefined).value, null);
check("blank string", normaliseRequiredPhotoCount("").value, null);
check("explicit 0", normaliseRequiredPhotoCount(0).value, null);
check("explicit '0' (string)", normaliseRequiredPhotoCount("0").value, null);
check("3 (number)", normaliseRequiredPhotoCount(3).value, 3);
check("'3' (string)", normaliseRequiredPhotoCount("3").value, 3);
check("20 — at the cap", normaliseRequiredPhotoCount(20).ok, true);
check("21 — one over the cap, refused", normaliseRequiredPhotoCount(21).ok, false);
check("3.5 — not a whole number, refused", normaliseRequiredPhotoCount(3.5).ok, false);
check("-1 — refused", normaliseRequiredPhotoCount(-1).ok, false);
check("'abc' — refused", normaliseRequiredPhotoCount("abc").ok, false);
check("NaN — refused", normaliseRequiredPhotoCount(NaN).ok, false);
check("Infinity — refused", normaliseRequiredPhotoCount(Infinity).ok, false);
// The cheap ways past a naive Number(raw) cast — the same "cheap ways past a
// naive check" spirit as the quoteIsGrounded section above, aimed at a
// different function: JS unwraps a single-element array through Number() and
// coerces booleans, so a body sending the wrong TYPE must be refused on type,
// not accidentally coerced into a plausible-looking count.
check("[3] (array) does not silently coerce to 3", normaliseRequiredPhotoCount([3]).ok, false);
check("true (boolean) does not silently coerce to 1", normaliseRequiredPhotoCount(true).ok, false);
check("{} (object) — refused, not NaN-passes-nothing", normaliseRequiredPhotoCount({}).ok, false);

console.log("\ncanEditTask — mine, or unassigned-and-claimable, never someone else's\n");
check("assignee may act on their own to-do", canEditTask(
  { userId: "u1" }, { assignedToId: "u1", createdById: "u2" },
), true);
check("creator may act on a to-do they made for someone else... no: creator counts as \"mine\" too",
  canEditTask({ userId: "u1" }, { assignedToId: "u2", createdById: "u1" }), true);
check("an unassigned to-do is claimable by anyone with a session", canEditTask(
  { userId: "u1" }, { assignedToId: null, createdById: "u2" },
), true);
check("assigned to someone else, created by someone else — refused", canEditTask(
  { userId: "u1" }, { assignedToId: "u2", createdById: "u3" },
), false);
check("a member with no userId can't claim it either", canEditTask(
  { userId: null }, { assignedToId: "u2", createdById: "u3" },
), false);

console.log(`\n${pass + failures.length} checks, ${failures.length} failure(s).\n`);
if (failures.length) process.exitCode = 1;
