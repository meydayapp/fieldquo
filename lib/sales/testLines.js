// lib/sales/testLines.js
//
// FieldQuo's own phones, on a list, so the owner can ring one at midnight.
//
// ══ What this is, and what it deliberately is not ═════════════════════════
//
// The owner, 2026-09-17: "I need a way to test this outside normal calling
// hours with my own phone number." The obvious build — a flag on his rep
// account that switches the calling-window gate off — was rejected, because
// the gate exists to protect the STRANGER whose phone rings, and a rep who
// may ring anybody at 23:00 is a rep who may ring a contractor at 23:00. The
// law does not care whose account pressed the button.
//
// So the exemption is on the NUMBER, not on the person. A test line is a
// phone FieldQuo itself owns — the owner's mobile, a desk phone in the office
// — and a dial to it is exempt from the calling window, the 24-hour cap and
// the retry pool's hold FOR EVERY REP, because nobody's evening is being
// interrupted but our own. It is never exempt from do-not-contact or the
// suppression list: those are checked before the number is judged, in
// app/api/sales/calls/route.js, and this module is not consulted there.
//
// ══ Where the list lives ══════════════════════════════════════════════════
//
// One PlatformSetting row, key TEST_LINES_SETTING_KEY, holding a JSON array
// of E.164 strings. Edited on /platform/sales/windows — the screen that
// already decides how hard the calling window is applied — by a superadmin
// only, and audit-logged. lib/sales/testLinesStore.js is the database half;
// this file is pure so the calling rules, the queue's window grouping and
// the check script can run it under bare node.
//
// ══ A test dial is marked, and every count ignores the mark ═══════════════
//
// A dial to a test line is recorded with `jurisdictionCode = "test"` — the
// column that otherwise freezes which jurisdiction's law was applied, which
// for our own phone is "none". Floor stats, the funnel, the agency view,
// the growth model and the badge count all exclude it through
// `excludingTestDials()` / `withoutTestDials()` below, so a night of testing
// cannot show up as a rep's best hour. scripts/check-sales-test-line.mjs
// asserts every one of those counts carries the exclusion.
//
// No column was added for this. SalesCallAttempt is under a pending change
// elsewhere and the existing column says the fact exactly: a dial nobody's
// law was applied to.
import { TEST_LINE_JURISDICTION_CODE } from "./callingRules";
import { normalisePhone } from "./suppressionRules";

/** The PlatformSetting key. */
export const TEST_LINES_SETTING_KEY = "sales.testLines";

/**
 * What a test dial's `jurisdictionCode` reads. Declared in callingRules.js,
 * where the answer that carries it is built, and re-exported here so the
 * counts and the rules cannot drift onto two spellings of one word. Not a
 * CALLING_JURISDICTIONS key on purpose.
 */
export const TEST_JURISDICTION_CODE = TEST_LINE_JURISDICTION_CODE;

/** More than this is not a test list; it is a way round the window. */
export const MAX_TEST_LINES = 10;

/**
 * The list as stored, read defensively.
 *
 * Accepts the array itself or `{ numbers: [...] }`; anything else is an empty
 * list. Every entry goes through normalisePhone (so "+1 (416) 555-0100" and
 * "+14165550100" are one number), invalid entries are dropped rather than
 * kept as strings nothing can match, duplicates collapse, and the list is
 * cut at MAX_TEST_LINES. A setting that cannot be read yields NO exemption —
 * the failure direction is a refused test call, never an allowed stranger.
 */
export function normaliseTestLines(value) {
  const raw = Array.isArray(value) ? value : Array.isArray(value?.numbers) ? value.numbers : [];
  const out = [];
  for (const entry of raw) {
    if (typeof entry !== "string") continue;
    const e164 = normalisePhone(entry);
    if (!e164 || out.includes(e164)) continue;
    out.push(e164);
    if (out.length >= MAX_TEST_LINES) break;
  }
  return out;
}

/** Is this number one of ours to test on? Total: any unreadable input is "no". */
export function isTestLine(e164, testLines) {
  const phone = normalisePhone(e164);
  if (!phone || !Array.isArray(testLines)) return false;
  return testLines.some((n) => typeof n === "string" && normalisePhone(n) === phone);
}

/** Was this attempt row a dial to a test line? */
export function isTestDial(row) {
  return row?.jurisdictionCode === TEST_JURISDICTION_CODE;
}

/** The rows that count as work: every row that is not a test dial. */
export function withoutTestDials(rows) {
  if (!Array.isArray(rows)) return rows;
  return rows.filter((row) => !isTestDial(row));
}

/**
 * The Prisma fragment that excludes test dials from a SalesCallAttempt
 * where clause.
 *
 * Spelled as `null OR not "test"` rather than `{ not: "test" }` alone:
 * measured against production on 2026-09-17, Prisma's `not` on a nullable
 * column drops the NULL rows too (113 rows, 5 null, `not: "test"` returned
 * 108), and the rows with no jurisdiction code are the oldest real dials.
 */
export const TEST_DIAL_EXCLUSION = Object.freeze({
  OR: Object.freeze([
    Object.freeze({ jurisdictionCode: null }),
    Object.freeze({ jurisdictionCode: Object.freeze({ not: TEST_JURISDICTION_CODE }) }),
  ]),
});

/**
 * `where`, with test dials excluded, whatever `where` already carries.
 *
 * Merged under AND so a caller's own OR (unloggedWhere has one) is not
 * clobbered and a caller's own AND is kept beside this one.
 */
export function excludingTestDials(where = {}) {
  const base = where && typeof where === "object" ? where : {};
  const existing = Array.isArray(base.AND) ? base.AND : base.AND ? [base.AND] : [];
  return { ...base, AND: [...existing, TEST_DIAL_EXCLUSION] };
}

/**
 * The same exclusion for raw SQL, as a clause to AND into a WHERE. IS
 * DISTINCT FROM keeps the NULL rows, for the reason TEST_DIAL_EXCLUSION gives.
 */
export const TEST_DIAL_SQL_EXCLUSION = `"jurisdictionCode" IS DISTINCT FROM '${TEST_JURISDICTION_CODE}'`;
