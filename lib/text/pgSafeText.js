// lib/text/pgSafeText.js
//
// Text a browser, a crawler or a model produced, made storable.
//
// ══ The failure this exists for ═══════════════════════════════════════════
//
// `pipeline_task_error: invalid byte sequence for encoding "UTF8": 0x00`, on
// GENERATE_CALL_SCRIPT, on 2026-09-14, -09-15, -09-18 and -09-21. Postgres
// cannot store U+0000 in a text or jsonb value AT ALL — not escaped, not in a
// parameter, not through `chr(0)` in a query — so a single stray NUL anywhere
// in a scraped page, a model's reply or a quoted error message kills the
// whole write, and with it the task. Five call-script tasks died this way.
//
// The other C0 controls are not fatal to Postgres but are fatal to a reader:
// a form feed or a vertical tab inside a rep's call script renders as
// nothing, or as a box, on the one screen somebody reads mid-call.
//
// ══ What is kept, and why ═════════════════════════════════════════════════
//
// \n \r \t survive. They are the only C0 characters that mean something in
// prose, and a scope paragraph that loses its line breaks is a different
// paragraph. Everything else in U+0000–U+001F, plus U+007F (DEL), is dropped
// rather than replaced with a space: these are not word separators, and
// turning one into a space in the middle of a word would invent a word break
// that the source did not have.
//
// Lone surrogates go too. A half of a surrogate pair is not a character; it
// survives JSON.stringify as \uD800 and then fails the same way a NUL does
// on the way into a jsonb column.
//
// ══ At the write, once ════════════════════════════════════════════════════
//
// Called where untrusted text is PERSISTED, never on the way out. A sanitiser
// on every read is a sanitiser somebody forgets on the one read that mattered,
// and it would also mean the stored row and the rendered row disagree about
// what the source said. The callers today:
//
//   lib/sales/crawl/crawlSite.js             every ProspectEvidence row a crawl writes
//   lib/sales/pipeline/handlers/generateCallScript.js   the model's script, before the upsert
//   lib/sales/pipeline/runner.js             the task's own note and lastError
//
// There were already five hand-rolled versions of this regex in lib/sales
// (outreach.js, discovery/normalise.js, intel/people.js and two more). They
// are left alone: each collapses controls to a SPACE on purpose, for a single
// field it is normalising, which is a different job from making an arbitrary
// payload storable. This is the one to reach for at a write.

/** U+0000–U+001F except \t \n \r, plus U+007F. */
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;
/** A high or low surrogate with no partner — not a character, and not storable. */
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

/**
 * One string, made storable. Non-strings come back untouched so a caller can
 * hand this a field of unknown type without a guard of its own.
 */
export function pgSafeString(value) {
  if (typeof value !== "string") return value;
  if (!CONTROL.test(value) && !LONE_SURROGATE.test(value)) {
    // The regexes are global; `test` moves lastIndex. Reset before returning
    // early, or the next call on a different string starts mid-way through it.
    CONTROL.lastIndex = 0;
    LONE_SURROGATE.lastIndex = 0;
    return value;
  }
  CONTROL.lastIndex = 0;
  LONE_SURROGATE.lastIndex = 0;
  return value.replace(CONTROL, "").replace(LONE_SURROGATE, "");
}

/**
 * The same, through a whole payload — an object bound for a jsonb column, an
 * array of rows bound for createMany. Dates, numbers, booleans, null and
 * Buffers pass through as themselves; only strings are touched, and the shape
 * is preserved exactly so a diff of the payload before and after shows the
 * characters removed and nothing else.
 *
 * Cycles are not handled: nothing written to Postgres has one, and a guard
 * here would be a silent truncation on the day something did.
 */
export function pgSafe(value) {
  if (typeof value === "string") return pgSafeString(value);
  if (Array.isArray(value)) return value.map(pgSafe);
  if (value && typeof value === "object") {
    // Anything with its own serialisation — Date, Decimal, Buffer — is left
    // whole. Walking a Date's properties would return a plain object and the
    // column would take a string where it expected a timestamp.
    if (value instanceof Date || ArrayBuffer.isView(value) || typeof value.toJSON === "function") return value;
    const out = {};
    for (const [k, v] of Object.entries(value)) out[pgSafeString(k)] = pgSafe(v);
    return out;
  }
  return value;
}

/** Does this value carry anything Postgres would refuse? For checks and logs. */
export function hasUnstorableText(value) {
  return JSON.stringify(pgSafe(value)) !== JSON.stringify(value);
}
