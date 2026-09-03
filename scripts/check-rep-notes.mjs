// scripts/check-rep-notes.mjs
//
//   npm run check:rep-notes
//
// The regression guard for sales rep notes — lib/sales/notes/, the four routes
// under /api/sales/notes and /api/platform/sales/notes, and the three screens.
//
// ══ What this proves, and how ══════════════════════════════════════════════
//
// TWO HALVES, and the repo's own history says both are needed. Every check
// that only reads proves code is correct and never proves it is reached;
// every check that only executes proves a mechanism works and never proves a
// route wires it up.
//
// HALF ONE — EXECUTED. Every module under lib/sales/notes/ except platformGate
// has no runtime imports outside the same folder (write.js pulls in
// lib/concurrency/staleWrite.js, which itself imports nothing), so this file
// imports the SHIPPED modules and runs them. No stub loader, no copy. Around
// saveNote() sits an in-memory Prisma double implementing exactly the two
// rules Postgres and Prisma give the real one — an `update` whose `where` does
// not match raises P2025, and every successful update moves `updatedAt`. That
// is enough to drive the brief's cases for real:
//
//   1. a rep reading another rep's note            → refused
//   2. a superadmin reading any rep's note         → allowed
//   3. a platform admin / support reading one      → refused (and it is a
//                                                     403, not an empty list)
//   4. two concurrent edits                        → exactly one wins, the
//                                                     loser gets a 409 with
//                                                     code "stale_write"
//   5. a note with no parent                       → legal, and describes
//                                                     itself as a scratchpad
//   6. a note whose parent was deleted             → survives, and SAYS the
//                                                     parent is gone
//   7. a rep PATCHing a colleague's note           → 404, not 409, and never
//                                                     a write
//
// HALF TWO — READ. The routes and screens are parsed, and every string rule is
// scoped to ONE brace-matched handler body via handlerBodies() — a
// noteReaderWhere sitting in GET does not prove anything about PATCH, and one
// in a comment proves nothing at all (sources are decommented first).
//
// ══ What this does NOT prove ═══════════════════════════════════════════════
//
//   * That SalesRepNote exists. It does not — see lib/sales/notes/model.js.
//     The schema section below asserts the model's shape IF schema.prisma
//     declares it, and asserts the screens say so if it does not. Both
//     directions are checked so the day it lands, this file catches a
//     mismatch instead of a runtime error.
//   * That Postgres and Prisma behave the way the double does. Two documented
//     behaviours are modelled here, not observed — the same limitation
//     scripts/check-stale-write.mjs states about itself.
//   * Anything about how the screens LOOK. There is no browser. Whether the
//     visibility notice is legible at 375px needs eyes; that it is rendered,
//     on both compose screens, and sourced from one constant, is what is
//     checked.
//   * That a superadmin cannot read a note through some OTHER route. This
//     covers the four it owns.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { ROOT, decomment, handlerBodies, balanced } from "./tenantScopeScan.mjs";

import {
  canReadNote,
  canWriteNote,
  noteReaderWhere,
  VIEWER_REP,
  VIEWER_PLATFORM,
  NOTE_READING_PLATFORM_ROLES,
  HAS_REPORTING_LINE,
  VISIBILITY_NOTICE,
  PLATFORM_NOTICE,
} from "../lib/sales/notes/visibility.js";
import {
  normaliseParent,
  describeParent,
  parentKindOf,
  ParentError,
  PARENT_KINDS,
  PARENT_FIELD,
} from "../lib/sales/notes/parents.js";
import {
  sanitiseBody,
  sanitiseTitle,
  displayTitle,
  isRenderableFormat,
  BODY_FORMAT_TEXT,
  EDITOR,
  LIMITS,
} from "../lib/sales/notes/body.js";
import {
  REP_NOTE_MODEL,
  REP_NOTE_FIELDS,
  RETENTION,
  notesAvailable,
  NOTES_UNAVAILABLE,
} from "../lib/sales/notes/model.js";
import { saveNote, noteConflictBody } from "../lib/sales/notes/write.js";
import { STALE_WRITE_CODE, VERSION_FIELD } from "../lib/concurrency/staleWrite.js";
import { NOTE_LIST_SELECT, PLATFORM_NOTE_SELECT, previewRow, LIST_BODY_PREVIEW } from "../lib/sales/notes/select.js";

let pass = 0;
let fail = 0;
const ok = (name, cond, got) => {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
    return true;
  }
  fail++;
  console.log(`  ✗ ${name}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`);
  return false;
};
const section = (t) => console.log(`\n${t}`);

const read = (f) => readFileSync(join(ROOT, f), "utf8");
const src = (f) => decomment(read(f));

const REP_LIST_ROUTE = "app/api/sales/notes/route.js";
const REP_ONE_ROUTE = "app/api/sales/notes/[id]/route.js";
const PLAT_LIST_ROUTE = "app/api/platform/sales/notes/route.js";
const PLAT_ONE_ROUTE = "app/api/platform/sales/notes/[id]/route.js";
const REP_INDEX_PAGE = "app/sales/notes/page.js";
const REP_EDIT_PAGE = "app/sales/notes/[id]/page.js";
const PLAT_PAGE = "app/platform/sales/notes/page.js";
const NOTICE_COMPONENT = "app/components/sales/RepNoteVisibilityNotice.js";
const EDITOR_COMPONENT = "app/components/sales/RepNoteEditor.js";
const CONFLICT_COMPONENT = "app/components/sales/RepNoteConflict.js";
const UNAVAILABLE_COMPONENT = "app/components/sales/RepNoteUnavailable.js";

/** Every screen and component this work owns, held to the strict mobile rules. */
const MOBILE_SOURCES = [
  REP_INDEX_PAGE,
  REP_EDIT_PAGE,
  PLAT_PAGE,
  EDITOR_COMPONENT,
  CONFLICT_COMPONENT,
  NOTICE_COMPONENT,
  UNAVAILABLE_COMPONENT,
];

/** One handler's brace-matched body, decommented. Undefined if absent. */
function handler(file, name) {
  return handlerBodies(src(file)).find((h) => h.name === name)?.text;
}

// ═══════════════════════════════════════════════════════════════════════════
section("1. Who may read a note — EXECUTED against the shipped function");
// ═══════════════════════════════════════════════════════════════════════════

const REP_A = "rep_aaaaaaaaaaaaaaaaaaaaaaa";
const REP_B = "rep_bbbbbbbbbbbbbbbbbbbbbbb";
const noteOfA = { id: "note_1", salesRepId: REP_A };

const repA = { kind: VIEWER_REP, salesRepId: REP_A };
const repB = { kind: VIEWER_REP, salesRepId: REP_B };
const superadmin = { kind: VIEWER_PLATFORM, role: "superadmin" };
const platAdmin = { kind: VIEWER_PLATFORM, role: "admin" };
const platSupport = { kind: VIEWER_PLATFORM, role: "support" };

ok("a rep reads their OWN note", canReadNote(repA, noteOfA) === true);
ok("a rep may NOT read another rep's note", canReadNote(repB, noteOfA) === false);
ok("a superadmin reads any rep's note", canReadNote(superadmin, noteOfA) === true);
ok("a platform ADMIN may not", canReadNote(platAdmin, noteOfA) === false);
ok("platform SUPPORT may not", canReadNote(platSupport, noteOfA) === false);

// Fail-closed cases. Every one of these is a caller that could not work out
// who is asking, and every one of them must mean no.
ok("null viewer is refused", canReadNote(null, noteOfA) === false);
ok("null note is refused", canReadNote(repA, null) === false);
ok("a viewer with no kind is refused", canReadNote({ salesRepId: REP_A }, noteOfA) === false);
ok("an unknown viewer kind is refused", canReadNote({ kind: "manager", salesRepId: REP_A }, noteOfA) === false);
ok("a rep viewer with no id is refused", canReadNote({ kind: VIEWER_REP }, noteOfA) === false);
ok(
  "a note with no author is refused — two undefineds must not compare equal",
  canReadNote({ kind: VIEWER_REP }, { id: "x" }) === false,
);
ok(
  "an empty-string rep id matches nothing",
  canReadNote({ kind: VIEWER_REP, salesRepId: "" }, { salesRepId: "" }) === false,
);
ok("a platform viewer with no role is refused", canReadNote({ kind: VIEWER_PLATFORM }, noteOfA) === false);
ok(
  "a platform viewer whose role is a non-string is refused",
  canReadNote({ kind: VIEWER_PLATFORM, role: 1 }, noteOfA) === false,
);
ok(
  "only ONE platform role reads notes, and it is superadmin",
  NOTE_READING_PLATFORM_ROLES.size === 1 && NOTE_READING_PLATFORM_ROLES.has("superadmin"),
  [...NOTE_READING_PLATFORM_ROLES],
);

section("   …and the where fragment agrees with the predicate");
ok("a superadmin's fragment is {} — every rep", Object.keys(noteReaderWhere(superadmin)).length === 0);
ok("a rep's fragment names their own id", noteReaderWhere(repA).salesRepId === REP_A);
ok("a platform admin's fragment REFUSES, it does not widen", noteReaderWhere(platAdmin).salesRepId === "__none__");
ok("support's fragment refuses", noteReaderWhere(platSupport).salesRepId === "__none__");
ok("an unknown viewer's fragment refuses", noteReaderWhere({ kind: "nope" }).salesRepId === "__none__");
ok("a null viewer's fragment refuses", noteReaderWhere(null).salesRepId === "__none__");
ok(
  "a rep viewer with an empty id refuses rather than returning {}",
  noteReaderWhere({ kind: VIEWER_REP, salesRepId: "" }).salesRepId === "__none__",
);

section("   …and writing is narrower than reading");
ok("a rep may write their own note", canWriteNote(repA, noteOfA) === true);
ok("a rep may not write another rep's", canWriteNote(repB, noteOfA) === false);
ok(
  "a SUPERADMIN may READ every note and WRITE none — the console views and does not edit",
  canReadNote(superadmin, noteOfA) === true && canWriteNote(superadmin, noteOfA) === false,
);

// ═══════════════════════════════════════════════════════════════════════════
section("2. The manager question — answered as a fact, not assumed");
// ═══════════════════════════════════════════════════════════════════════════

const schema = existsSync(join(ROOT, "prisma/schema.prisma"))
  ? read("prisma/schema.prisma")
  : "";
const salesRepBlock = schema.match(/model SalesRep \{[\s\S]*?\n\}/)?.[0] || "";

ok("SalesRep is in the schema at all", salesRepBlock.length > 0);
const hasManagerColumn = /\bmanagerId\b|\breportsToId\b|\bteamId\b|\bmanager\s+SalesRep\b/.test(
  salesRepBlock,
);
ok(
  "SalesRep carries NO reporting line — so 'my reps' is not a query anyone can write",
  hasManagerColumn === false,
);
ok(
  "HAS_REPORTING_LINE reports that same fact, so the screen and the schema cannot disagree",
  HAS_REPORTING_LINE === hasManagerColumn,
  { HAS_REPORTING_LINE, hasManagerColumn },
);
ok(
  "the platform notice states there is no manager tier rather than leaving it to be discovered",
  /no manager tier/i.test(PLATFORM_NOTICE.detail) && /reporting line/i.test(PLATFORM_NOTICE.detail),
);
ok(
  "the platform SCREEN renders that sentence",
  src(PLAT_PAGE).includes("PLATFORM_NOTICE.detail") && src(PLAT_PAGE).includes("HAS_REPORTING_LINE"),
);

// ═══════════════════════════════════════════════════════════════════════════
section("3. hasLevel is not in the authorisation path — it fails open");
// ═══════════════════════════════════════════════════════════════════════════
//
// lib/permissions/enforce.js's hasLevel() returns TRUE for an unknown
// category, for a member with no permissions object, for a category absent
// from that object, and for a level that is not in the category's list. Each
// is right for a tenant member whose grid predates the grid, and each is
// catastrophic for a rule whose whole job is to say no.

const NOTE_SOURCES = [
  "lib/sales/notes/model.js",
  "lib/sales/notes/visibility.js",
  "lib/sales/notes/parents.js",
  "lib/sales/notes/body.js",
  "lib/sales/notes/select.js",
  "lib/sales/notes/write.js",
  "lib/sales/notes/platformGate.js",
  REP_LIST_ROUTE,
  REP_ONE_ROUTE,
  PLAT_LIST_ROUTE,
  PLAT_ONE_ROUTE,
];
const usesHasLevel = NOTE_SOURCES.filter((f) => /\bhasLevel\b|\bhasToggle\b|\bscopeFilter\b/.test(src(f)));
ok("no note module routes a decision through hasLevel/hasToggle/scopeFilter", usesHasLevel.length === 0, usesHasLevel);

// The four fall-open cases, executed against the REAL function, so this file
// carries the evidence for the claim above rather than restating it.
const { hasLevel } = await import("../lib/permissions/enforce.js");
const gridded = { role: "employee", permissions: { quotes: "view_only" } };
ok("hasLevel falls open on an unknown category", hasLevel(gridded, "notARealCategory", "x") === true);
ok("hasLevel falls open with no permissions object", hasLevel({ role: "employee" }, "quotes", "view_only") === true);
ok(
  "hasLevel falls open on a category absent from the grid",
  hasLevel({ role: "employee", permissions: {} }, "quotes", "view_only") === true,
);
ok("hasLevel falls open on a level that is not real", hasLevel(gridded, "quotes", "not_a_level") === true);

// ═══════════════════════════════════════════════════════════════════════════
section("4. Parents — none, one, and one that was deleted");
// ═══════════════════════════════════════════════════════════════════════════

const noParent = normaliseParent({});
ok(
  "a note with NO parent is legal and clears all three columns",
  noParent.leadId === null && noParent.threadId === null && noParent.prospectId === null,
  noParent,
);
ok("…and carries no label", noParent.parentLabel === null);
ok("parentKindOf a scratchpad is null", parentKindOf({ leadId: null, threadId: null, prospectId: null }) === null);
ok(
  "describeParent calls it 'not attached', not an empty string",
  describeParent({}).state === "none" && describeParent({}).text.length > 0,
  describeParent({}),
);

for (const kind of PARENT_KINDS) {
  const p = normaliseParent({ parentKind: kind, parentId: "id_1", parentLabel: "Acme Painting" });
  ok(`a ${kind} parent writes ${PARENT_FIELD[kind]} and only that`, p[PARENT_FIELD[kind]] === "id_1");
  const others = PARENT_KINDS.filter((k) => k !== kind).map((k) => p[PARENT_FIELD[k]]);
  ok(`…and nulls the other two, so a note can never have two parents`, others.every((v) => v === null), others);
}

ok(
  "half a parent is a 400, not a silent scratchpad",
  (() => {
    try {
      normaliseParent({ parentKind: "lead" });
      return false;
    } catch (e) {
      return e instanceof ParentError && e.status === 400;
    }
  })(),
);
ok(
  "an id with no kind is a 400 too",
  (() => {
    try {
      normaliseParent({ parentId: "id_1" });
      return false;
    } catch (e) {
      return e instanceof ParentError;
    }
  })(),
);
ok(
  "an invented parent kind is refused",
  (() => {
    try {
      normaliseParent({ parentKind: "invoice", parentId: "id_1" });
      return false;
    } catch (e) {
      return e instanceof ParentError;
    }
  })(),
);

// ── The deleted parent. onDelete: SetNull nulls the FK; parentLabel survives.
const orphan = { leadId: null, threadId: null, prospectId: null, parentLabel: "Acme Painting" };
const described = describeParent(orphan);
ok("a note whose parent was deleted still EXISTS as a note", described.state === "orphaned", described);
ok("…and still names who it was about", described.label === "Acme Painting");
ok(
  "…and SAYS the parent is gone rather than silently becoming a scratchpad",
  /no longer/i.test(described.text) && described.text.includes("Acme Painting"),
  described.text,
);
ok(
  "a scratchpad and an orphan are distinguishable — they are different states",
  describeParent({}).state !== described.state,
);
ok(
  "the model declares SetNull, so a deleted lead cannot take the note with it",
  /onDelete: SetNull/.test(read("lib/sales/notes/model.js")) &&
    !/lead\s+SalesLead\?[^\n]*onDelete: Cascade/.test(read("lib/sales/notes/model.js")),
);

// ═══════════════════════════════════════════════════════════════════════════
section("5. Body handling");
// ═══════════════════════════════════════════════════════════════════════════

ok("a NUL byte is stripped — Postgres text rejects it outright", sanitiseBody("a b") === "ab");
ok("a non-string body becomes an empty string, never 'undefined'", sanitiseBody(undefined) === "");
ok("HTML is stored verbatim, not escaped on the way IN", sanitiseBody("<b>&amp;</b>") === "<b>&amp;</b>");
ok("newlines survive in a body", sanitiseBody("a\nb") === "a\nb");
ok("a body is capped", sanitiseBody("x".repeat(LIMITS.body + 500)).length === LIMITS.body);
ok("a title collapses newlines — a title is one line", sanitiseTitle("a\nb") === "a b");
ok("a title is trimmed", sanitiseTitle("  hi  ") === "hi");
ok("a title is capped", sanitiseTitle("x".repeat(LIMITS.title + 50)).length === LIMITS.title);
ok("displayTitle prefers the real title", displayTitle({ title: "Call notes", body: "x" }) === "Call notes");
ok("displayTitle falls back to the first non-empty line", displayTitle({ title: "", body: "\n\nAcme call\nmore" }) === "Acme call");
ok("displayTitle says 'Untitled note' for an empty one", displayTitle({ title: "", body: "" }) === "Untitled note");
ok("the shipped body format is renderable", isRenderableFormat(BODY_FORMAT_TEXT));
ok("an unknown format is NOT rendered as text", isRenderableFormat("blocknote") === false);
ok(
  "the editor names itself, and says why, so nobody ships a toolbar that does nothing",
  EDITOR.kind === "textarea" && EDITOR.why.length > 40,
);

section("   …and no source file carries a raw NUL byte");
// Found by trying to MUTATE the NUL strip and discovering the pattern was not
// where the source said it was: the file held a literal U+0000 rather than the
// escape. Harmless at runtime, and a real hazard — several editors and diff
// tools truncate a file at the first NUL, so the code after it silently stops
// being reviewable.
for (const file of NOTE_SOURCES.concat(MOBILE_SOURCES)) {
  ok(`${file} contains no literal NUL byte`, !read(file).includes("\u0000"));
}

// ═══════════════════════════════════════════════════════════════════════════
section("6. Concurrent edits — EXECUTED against saveNote and a Prisma double");
// ═══════════════════════════════════════════════════════════════════════════

/**
 * A clock that never repeats. Load-bearing: the guard is a timestamp EQUALITY
 * test, so a double whose two writes could land on the same millisecond would
 * pass the concurrency case for the wrong reason.
 */
function makeClock(startMs = Date.parse("2026-09-02T10:00:00.000Z")) {
  let n = startMs;
  return () => new Date((n += 1000));
}

function p2025() {
  const e = new Error("An operation failed because it depends on one or more records that were required but not found.");
  e.code = "P2025";
  return e;
}

/** Does a row satisfy a flat `where`? Supports `{ not: null }` and null. */
function matches(row, where) {
  for (const [k, v] of Object.entries(where)) {
    if (v instanceof Date) {
      if (!(row[k] instanceof Date) || row[k].getTime() !== v.getTime()) return false;
    } else if (v && typeof v === "object" && "not" in v) {
      if (v.not === null ? row[k] === null : row[k] === v.not) return false;
    } else if (row[k] !== v) {
      return false;
    }
  }
  return true;
}

function makeDb(rows) {
  const now = makeClock();
  const store = rows.map((r) => ({ archivedAt: null, ...r }));
  return {
    [REP_NOTE_MODEL]: {
      findMany: async ({ where = {} } = {}) => store.filter((r) => matches(r, where)),
      findFirst: async ({ where = {} } = {}) => store.find((r) => matches(r, where)) || null,
      count: async ({ where = {} } = {}) => store.filter((r) => matches(r, where)).length,
      update: async ({ where = {}, data = {} }) => {
        const row = store.find((r) => matches(r, where));
        // Prisma raises P2025 when the extended `where` matches nothing. That
        // is the refusal — there is no separate check to lose a race with.
        if (!row) throw p2025();
        Object.assign(row, data);
        row.updatedAt = now();
        return { ...row };
      },
      create: async ({ data }) => {
        const row = { id: `note_${store.length + 1}`, archivedAt: null, ...data, updatedAt: now() };
        store.push(row);
        return { ...row };
      },
    },
    __store: store,
  };
}

const V1 = new Date("2026-09-02T09:00:00.000Z");

section("   the happy path");
{
  const db = makeDb([{ id: "n1", salesRepId: REP_A, title: "t", body: "one", updatedAt: V1 }]);
  const out = await saveNote(db, { noteId: "n1", salesRepId: REP_A, expected: V1, data: { body: "two" } });
  ok("a save carrying the CURRENT version succeeds", out.ok === true);
  ok("…and the row actually changed", db.__store[0].body === "two");
  ok("…and updatedAt moved", db.__store[0].updatedAt.getTime() !== V1.getTime());
}

section("   the concurrent one — the case autosave makes routine");
{
  const db = makeDb([{ id: "n1", salesRepId: REP_A, title: "t", body: "one", updatedAt: V1 }]);
  // Both writers loaded the note at V1. This is the laptop and the phone.
  const first = await saveNote(db, { noteId: "n1", salesRepId: REP_A, expected: V1, data: { body: "laptop" } });
  const second = await saveNote(db, { noteId: "n1", salesRepId: REP_A, expected: V1, data: { body: "phone" } });

  ok("the first save wins", first.ok === true);
  ok("the second is REFUSED — not silently applied", second.ok === false);
  ok("…with 409, the only status a client can offer to retry", second.status === 409);
  ok("…carrying the machine-readable code", second.body.code === STALE_WRITE_CODE);
  ok("…naming the version the caller must re-guard against", typeof second.body.conflict.currentUpdatedAt === "string");
  ok(
    "…and the FIRST writer's text is still there — the whole point",
    db.__store[0].body === "laptop",
    db.__store[0].body,
  );
  ok(
    "the refusal says it was YOU, because only the author can write a note",
    second.body.conflict.byYou === true && second.body.conflict.byName === null,
  );
  ok(
    "…and readStaleConflict's contract is met: code at the top level, conflict beside it",
    second.body.code === STALE_WRITE_CODE && typeof second.body.conflict === "object",
  );
}

section("   a colleague's note");
{
  const db = makeDb([{ id: "n1", salesRepId: REP_A, title: "t", body: "one", updatedAt: V1 }]);
  const out = await saveNote(db, { noteId: "n1", salesRepId: REP_B, expected: V1, data: { body: "stolen" } });
  ok("rep B cannot PATCH rep A's note", out.ok === false);
  ok("…and gets a 404, which does not confirm the note exists", out.status === 404);
  ok("…and nothing was written", db.__store[0].body === "one");
  ok(
    "…and it is NOT reported as a stale write, which would be a lie about a colleague",
    out.body.code !== STALE_WRITE_CODE,
  );
}

section("   a deleted note, and an unguarded save");
{
  const db = makeDb([]);
  const out = await saveNote(db, { noteId: "gone", salesRepId: REP_A, expected: V1, data: { body: "x" } });
  ok("saving a note that no longer exists is a 404, not a 409", out.status === 404);
}
{
  const db = makeDb([{ id: "n1", salesRepId: REP_A, title: "t", body: "one", updatedAt: V1 }]);
  const out = await saveNote(db, { noteId: "n1", salesRepId: REP_A, expected: null, data: { archivedAt: new Date() } });
  ok("an UNGUARDED save (archive) still works — missing means unguarded", out.ok === true);
  ok("…and archiving is soft: the row is still there", db.__store.length === 1);
}

section("   the 409 body itself");
{
  const body = noteConflictBody(V1, new Date("2026-09-02T09:05:00.000Z"));
  ok("it carries both versions so a client can re-submit deliberately", Boolean(body.conflict.expectedUpdatedAt) && Boolean(body.conflict.currentUpdatedAt));
  ok("it says nothing typed is lost", /nothing you typed is lost/i.test(body.error));
  ok("it never blames a colleague", !/team|colleague|someone else/i.test(body.error));
}

// ═══════════════════════════════════════════════════════════════════════════
section("7. The routes wire it up — read, one brace-matched handler at a time");
// ═══════════════════════════════════════════════════════════════════════════

for (const [file, methods] of [
  [REP_LIST_ROUTE, ["GET", "POST"]],
  [REP_ONE_ROUTE, ["GET", "PATCH"]],
  [PLAT_LIST_ROUTE, ["GET"]],
  [PLAT_ONE_ROUTE, ["GET"]],
]) {
  for (const m of methods) {
    ok(`${file} exports ${m}`, Boolean(handler(file, m)));
  }
}

section("   the rep routes are gated and scoped, per handler");
for (const [file, method] of [
  [REP_LIST_ROUTE, "GET"],
  [REP_LIST_ROUTE, "POST"],
  [REP_ONE_ROUTE, "GET"],
  [REP_ONE_ROUTE, "PATCH"],
]) {
  const body = handler(file, method) || "";
  ok(`${file} ${method} runs the gate first`, /requireOutreachRep\(request\)/.test(body));
  ok(`${file} ${method} returns the refusal verbatim`, /if \(refusal\) return NextResponse\.json\(refusal\.body/.test(body));
  ok(`${file} ${method} refuses honestly when the table is missing`, /notesAvailable\(db\)/.test(body));
  ok(
    `${file} ${method} takes the rep id from the SESSION, never the body`,
    !/salesRepId:\s*body\./.test(body) && !/salesRepId:\s*searchParams/.test(body),
  );
}

{
  const g = handler(REP_LIST_ROUTE, "GET");
  // Scoped to the findMany's OWN argument object. The handler also runs a
  // count that carries the fragment, so a file-wide match would have passed a
  // findMany with no scope at all sitting three lines above it — which is
  // exactly the bug this assertion is for, and exactly what mutation-testing
  // caught it doing.
  const listCall = balanced(g, g.indexOf("(", g.indexOf("salesRepNote.findMany")));
  ok("the LISTING query itself carries the scope fragment", /noteReaderWhere\(\{\s*kind: VIEWER_REP/.test(listCall), listCall.slice(0, 200));
  ok("…and no query in this handler is unscoped", (g.match(/salesRepNote\.(findMany|count)/g) || []).length === (g.match(/noteReaderWhere\(/g) || []).length);
  ok("…and truncates the body on the way out", /previewRow/.test(g));
}
{
  const p = handler(REP_LIST_ROUTE, "POST");
  ok("create stamps salesRepId from rep.id", /salesRepId:\s*rep\.id/.test(p));
  ok("create sanitises title and body", /sanitiseTitle\(/.test(p) && /sanitiseBody\(/.test(p));
  ok("create pins the body format rather than trusting the client", /bodyFormat:\s*BODY_FORMAT_TEXT/.test(p));
  ok("create never reads a bodyFormat from the request", !/body\.bodyFormat/.test(p));
}
{
  const g = handler(REP_ONE_ROUTE, "GET");
  ok("reading one note scopes by rep in the WHERE", /where:\s*\{\s*id,\s*\.\.\.noteReaderWhere\(/.test(g));
  ok("…and a miss is a 404, not a 403 that confirms it exists", /status:\s*404/.test(g) && !/status:\s*403/.test(g));
}
{
  const p = handler(REP_ONE_ROUTE, "PATCH");
  ok("PATCH parses the client's version", new RegExp(`parseExpectedVersion\\(body\\[${VERSION_FIELD ? "VERSION_FIELD" : ""}\\]\\)`).test(p));
  ok("PATCH turns an unreadable version into a 400, never a 409", /status:\s*400/.test(p) && !/409/.test(p));
  ok("PATCH delegates the write to saveNote — the guard lives in one place", /saveNote\(db,/.test(p));
  ok("PATCH passes rep.id as the ownership guard", /salesRepId:\s*rep\.id/.test(p));
  ok(
    "PATCH does not call db.salesRepNote.update itself — that would be a second, unguarded path",
    !/db\.salesRepNote\.update/.test(p),
  );
  ok("PATCH has no delete path at all", !/delete/i.test(p));
  ok("archiving is soft — a timestamp, not a removal", /archivedAt\s*=\s*new Date\(\)/.test(p));
}

section("   the platform routes read and never write");
for (const file of [PLAT_LIST_ROUTE, PLAT_ONE_ROUTE]) {
  const s = src(file);
  ok(`${file} exports no write handler`, !/export async function (POST|PATCH|PUT|DELETE)\b/.test(s));
  ok(
    `${file} performs no write at all`,
    !/\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\(/.test(s),
  );
  ok(`${file} gates through requireNoteReader`, /requireNoteReader\(request\)/.test(s));
  ok(`${file} scopes through noteReaderWhere`, /noteReaderWhere\(viewer\)/.test(s));
  ok(`${file} refuses honestly when the table is missing`, /notesAvailable\(db\)/.test(s));
}
{
  const g = handler(PLAT_LIST_ROUTE, "GET");
  // The one screen that pulls EVERY rep's notes has the strongest reason to
  // truncate: the full body of every note is a lot of somebody else's personal
  // information travelling for a list of titles.
  ok("the platform listing truncates each body on the way out", /notes: notes\.map\(previewRow\)/.test(g));
  ok("…and the single-note route is the only way to read one whole", /PLATFORM_NOTE_SELECT/.test(src(PLAT_ONE_ROUTE)) && !/previewRow/.test(src(PLAT_ONE_ROUTE)));
}
{
  const s = src(PLAT_ONE_ROUTE);
  ok(
    "the single-note platform route checks the ROW as well as the query — two routes to the same rule",
    /canReadNote\(viewer, note\)/.test(s),
  );
}
{
  const gate = src("lib/sales/notes/platformGate.js");
  ok("the platform gate asks noteReaderWhere rather than comparing a role string", /noteReaderWhere\(viewer\)/.test(gate));
  ok("…and refuses with 403, not an empty list", /status:\s*403/.test(gate));
  ok("…and 401 when there is no admin at all", /status:\s*401/.test(gate));
  ok("…and never imports canPlatform, which has no sales permission to grant", !/canPlatform/.test(gate));
}

section("   nothing under /api/sales/notes writes a forbidden table");
{
  const { REP_FORBIDDEN_WRITES } = await import("../lib/sales/gate.js");
  const { REP_OUTREACH_WRITES } = await import("../lib/sales/outreachGate.js");
  const WRITE_RE = /\bdb\.(\w+)\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\b/g;
  const stray = [];
  const written = new Set();
  for (const file of [REP_LIST_ROUTE, REP_ONE_ROUTE]) {
    for (const m of src(file).matchAll(WRITE_RE)) {
      written.add(m[1]);
      if (REP_FORBIDDEN_WRITES.includes(m[1])) stray.push(`${file}: ${m[1]}.${m[2]}`);
    }
  }
  ok("the note routes write nothing on REP_FORBIDDEN_WRITES", stray.length === 0, stray);
  ok("…and write ONLY the note model", [...written].every((m) => m === REP_NOTE_MODEL), [...written]);
  ok(
    "…and that model is declared on the writable list, so the rule is not enforced in one place and documented in none",
    REP_OUTREACH_WRITES.includes(REP_NOTE_MODEL),
    REP_OUTREACH_WRITES,
  );
  ok("no delete of a note exists anywhere", !/salesRepNote\.delete/.test(src(REP_ONE_ROUTE) + src(REP_LIST_ROUTE)));
}

// ═══════════════════════════════════════════════════════════════════════════
section("8. The compose screen STATES who can read it");
// ═══════════════════════════════════════════════════════════════════════════

ok(
  "the notice names superadmins in the headline — the thing a rep must not miss",
  /superadmin/i.test(VISIBILITY_NOTICE.headline),
  VISIBILITY_NOTICE.headline,
);
ok(
  "…and says other reps cannot, which is the half that makes the box usable",
  /other sales reps cannot/i.test(VISIBILITY_NOTICE.detail),
);
ok(
  "…and refuses to promise a private mode",
  /no private mode/i.test(VISIBILITY_NOTICE.detail),
);
ok(
  "nothing anywhere offers a 'private' note flag — a label with nothing behind it",
  !NOTE_SOURCES.some((f) => /\bisPrivate\b|\bprivate:\s*true\b|\bvisibility:\s*"private"/.test(src(f))),
);

{
  const notice = src(NOTICE_COMPONENT);
  ok(
    "the notice component imports the sentence from lib, so it cannot go missing on a bad connection",
    /import \{ VISIBILITY_NOTICE \} from "@\/lib\/sales\/notes\/visibility"/.test(notice),
  );
  ok("…and actually renders both halves", /VISIBILITY_NOTICE\.headline/.test(notice) && /VISIBILITY_NOTICE\.detail/.test(notice));
  ok("…and states retention while it is unbuilt", /RETENTION\.statement/.test(notice));
}

for (const page of [REP_INDEX_PAGE, REP_EDIT_PAGE]) {
  const s = src(page);
  ok(`${page} renders the visibility notice`, /<RepNoteVisibilityNotice/.test(s));
  ok(`${page} imports it from the one component`, /RepNoteVisibilityNotice from "@\/app\/components\/sales\/RepNoteVisibilityNotice"/.test(s));
  ok(
    `${page} does NOT fetch the sentence from the API — it must render even when the fetch fails`,
    !/visibility:/.test(s) && !/data\.visibility/.test(s),
  );
}
ok(
  "the EDITOR screen also says what the editor is, since somebody is staring at a textarea",
  /showEditorNote/.test(src(REP_EDIT_PAGE)),
);
ok(
  "the list route no longer ships the sentence, so there is exactly one source",
  !/VISIBILITY_NOTICE/.test(src(REP_LIST_ROUTE)),
);

// ═══════════════════════════════════════════════════════════════════════════
section("9. The editor is honest about saving");
// ═══════════════════════════════════════════════════════════════════════════

{
  const ed = src(EDITOR_COMPONENT);
  ok("every save carries the version — autosave without a guard is a faster overwrite", new RegExp(`\\[VERSION_FIELD\\]: version\\.current`).test(ed));
  ok("a 409 is detected through readStaleConflict, not by status alone", /readStaleConflict\(res\)/.test(ed));
  // Scoped to save()'s own brace-matched body. loadSaved() has its own
  // offline and error branches, so a file-wide match would report the autosave
  // path as honest while it silently swallowed every failure — which is what
  // mutation-testing found this assertion doing.
  const saveBody = balanced(ed, ed.indexOf("(", ed.indexOf("const save = useCallback(")));
  ok("save() was found to scope these to", saveBody.length > 0);
  ok("a network failure in AUTOSAVE has its own branch and its own sentence", /setState\("offline"\)/.test(saveBody) && /kept on this device/.test(saveBody));
  ok("a non-ok autosave response has an else — AGENTS.md failure class #2", /if \(!res\.ok\)/.test(saveBody) && /setState\("error"\)/.test(saveBody));
  ok("…and no failure branch reports success", !/catch[\s\S]{0,120}setState\("saved"\)/.test(saveBody));
  // Scoped to change()'s own brace-matched body. A writeDraft anywhere else in
  // the file would not prove the ordering the basement case depends on, and
  // comparing raw file offsets would compare change() against save(), which
  // are declared in the other order.
  {
    const at = ed.indexOf("const change = useCallback(");
    const changeBody = at >= 0 ? balanced(ed, ed.indexOf("(", at)) : "";
    ok("change() exists and was found", changeBody.length > 0);
    ok(
      "a draft is written to localStorage BEFORE the save is even scheduled",
      changeBody.indexOf("writeDraft(") >= 0 &&
        changeBody.indexOf("writeDraft(") < changeBody.indexOf("setTimeout("),
    );
    ok(
      "…and change() never calls fetch itself — every save goes through the guarded save()",
      !/fetch\(/.test(changeBody),
    );
  }
  ok("…and cleared only on a successful save", /clearDraft\(note\.id\);\s*\n\s*setState\("saved"\)/.test(ed));
  ok("localStorage access is wrapped — private browsing must not take the editor down", /catch \{/.test(ed) && /localStorage/.test(ed));
  ok(
    "the debounce is flushed on blur, on the tab hiding, and on the page going away",
    /onBlur=\{flush\}/.test(ed) &&
      // The ADD, specifically. Matching the bare word would pass a file that
      // only removes the listener it never registered — which is what
      // mutation-testing caught this assertion doing.
      /window\.addEventListener\("pagehide", flush\)/.test(ed) &&
      /document\.addEventListener\("visibilitychange"/.test(ed),
  );
  ok(
    "…and every listener it adds is removed again",
    (ed.match(/addEventListener\(/g) || []).length === (ed.match(/removeEventListener\(/g) || []).length,
  );
  ok("only one save is in flight at a time", /inFlight\.current/.test(ed));
  ok("'keep mine' re-guards on the version the server named, rather than forcing", /version\.current = conflict\.currentUpdatedAt/.test(ed));
  ok("there is no unguarded overwrite path", !/force:\s*true[\s\S]{0,200}VERSION_FIELD\]:\s*null/.test(ed));
  ok("no formatting toolbar is rendered — no control that does nothing", !/onClick=\{\(\) => (bold|italic|heading)/i.test(ed));
  ok("the conflict banner is its own component and is rendered", /<RepNoteConflict/.test(ed));
}
{
  const cf = src(CONFLICT_COMPONENT);
  ok("the conflict banner offers exactly two ways out", /onKeepMine/.test(cf) && /onLoadSaved/.test(cf));
  ok("…and says the destructive one is destructive", /replaces what is on screen/i.test(cf));
  ok("…and never invents a colleague", !/someone on your team/i.test(cf));
}

// ═══════════════════════════════════════════════════════════════════════════
section("10. The missing table is stated, not papered over");
// ═══════════════════════════════════════════════════════════════════════════

const schemaHasModel = /\bmodel SalesRepNote\s*\{/.test(schema);
ok(`notesAvailable() is a probe, not a constant`, notesAvailable({ [REP_NOTE_MODEL]: { findMany() {} } }) === true);
ok("…and false for a client without the delegate", notesAvailable({}) === false);
ok("…and false for a null client", notesAvailable(null) === false);
ok("…and false for a delegate that is not a delegate", notesAvailable({ [REP_NOTE_MODEL]: {} }) === false);
ok("the refusal is a 503 with a code a screen can branch on", NOTES_UNAVAILABLE.status === 503 && NOTES_UNAVAILABLE.body.code === "notes_model_missing");
ok("…and says nothing was saved", /nothing you typed was saved/i.test(NOTES_UNAVAILABLE.body.error));

if (schemaHasModel) {
  const block = schema.match(/model SalesRepNote \{[\s\S]*?\n\}/)?.[0] || "";
  for (const field of REP_NOTE_FIELDS) {
    ok(`schema.prisma's SalesRepNote declares ${field}`, new RegExp(`\\n\\s*${field}\\s`).test(block));
  }
  ok("the model scopes by salesRepId and NOT by companyId — a rep is in no tenant", /salesRepId/.test(block) && !/companyId/.test(block));
  ok("the parent relations are SetNull, so deleting a lead cannot delete a note", (block.match(/onDelete: SetNull/g) || []).length >= 3);
} else {
  ok(
    "the model is absent, and lib/sales/notes/model.js says so rather than pretending",
    /not in `?prisma\/schema.prisma`?|does not exist yet/i.test(read("lib/sales/notes/model.js")),
  );
  ok("…and carries the exact block to add", /model SalesRepNote \{/.test(read("lib/sales/notes/model.js")));
  for (const page of [REP_INDEX_PAGE, REP_EDIT_PAGE, PLAT_PAGE]) {
    ok(`${page} renders the unavailable panel rather than a broken editor`, /<RepNoteUnavailable/.test(src(page)));
    ok(`${page} branches on the 503 code specifically`, /notes_model_missing/.test(src(page)));
  }
  ok(
    "the unavailable panel offers NO controls — a dead button is worse than a message",
    !/<button/.test(src(UNAVAILABLE_COMPONENT)) && !/<textarea/.test(src(UNAVAILABLE_COMPONENT)),
  );
  ok(
    "the rep index hides 'New note' when there is nowhere to save",
    /\{!unavailable && \(/.test(src(REP_INDEX_PAGE)),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
section("11. Retention is decided out loud, either way");
// ═══════════════════════════════════════════════════════════════════════════

ok("RETENTION states whether it is applied", typeof RETENTION.applied === "boolean");
ok("…and the statement matches the flag", RETENTION.applied ? /retainUntil|deleted after/i.test(RETENTION.statement) : /no automatic deletion|by hand/i.test(RETENTION.statement));
ok(
  "an unapplied retention rule writes NO retainUntil column — a field nothing reads is failure class #1",
  RETENTION.applied || !/retainUntil/.test(read("lib/sales/notes/model.js").split("model SalesRepNote")[1] || ""),
);
ok("the screens show the statement while it is unapplied", RETENTION.applied || /RETENTION\.statement/.test(src(NOTICE_COMPONENT)));

// ═══════════════════════════════════════════════════════════════════════════
section("12. Selects are allow-lists, and listings do not ship whole notes");
// ═══════════════════════════════════════════════════════════════════════════

ok("the rep list select does not leak salesRepId", !("salesRepId" in NOTE_LIST_SELECT));
ok("the platform select carries the author, because that is the question", Boolean(PLATFORM_NOTE_SELECT.salesRep));
ok(
  "…and does NOT re-expose the rep's work mailbox, which has its own screen",
  !("workEmail" in (PLATFORM_NOTE_SELECT.salesRep.select || {})),
);
ok(
  "every select is an allow-list — no omit anywhere",
  !/\bomit\s*:/.test(src("lib/sales/notes/select.js")),
);
{
  const long = { body: "x".repeat(LIST_BODY_PREVIEW + 100) };
  const cut = previewRow(long);
  ok("a long body is truncated for a listing", cut.body.length === LIST_BODY_PREVIEW);
  ok("…and says it was truncated, so nobody reads 200 characters as the note", cut.bodyTruncated === true);
  ok("a short body is untouched and carries no flag", previewRow({ body: "hi" }).bodyTruncated === undefined);
  ok("previewRow tolerates a row with no body", previewRow({}) !== undefined && previewRow(null) === null);
}

// ═══════════════════════════════════════════════════════════════════════════
section("13. Mobile — the standing rule's own properties, on my own files");
// ═══════════════════════════════════════════════════════════════════════════
//
// scripts/check-mobile-surfaces.mjs holds app/sales and app/platform at
// BASELINE and names strict files in a list this work does not own. These are
// the strict rules, applied here so the new screens are held to them from the
// day they ship rather than from the day somebody remembers to add them.

/**
 * The opening tag starting at `i`, ended at the `>` that closes the TAG.
 *
 * A regex cannot do this. `<button ... onClick={() => x}>` contains a `>`
 * inside an arrow function, so `[\s\S]*?>` stops at the arrow and reports a
 * button with no className — a false failure, which is exactly the thing that
 * gets a rule deleted. So: walk forward, and ignore anything inside a JSX
 * expression container. Same problem check-mobile-surfaces.mjs solves with its
 * own openingTag().
 */
function openingTag(s, i) {
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    const c = s[j];
    if (c === "{") depth++;
    else if (c === "}") depth--;
    else if (c === ">" && depth === 0) return s.slice(i, j + 1);
  }
  return null;
}

for (const file of MOBILE_SOURCES) {
  const s = src(file);
  const buttons = [...s.matchAll(/<button\b/g)]
    .map((m) => openingTag(s, m.index))
    .filter(Boolean);
  const short = buttons.filter((b) => !/min-h-\[(4[4-9]|[5-9]\d|\d{3,})px\]/.test(b) && !/py-[2-9]/.test(b));
  ok(`${file}: every <button> clears 44px`, short.length === 0, short.map((b) => b.slice(0, 80)));

  const wide = [...s.matchAll(/\b(?:w|min-w)-\[(\d+)px\]/g)].filter((m) => Number(m[1]) > 360);
  ok(`${file}: nothing is wider than a phone`, wide.length === 0, wide.map((m) => m[0]));

  const tallBoxes = [...s.matchAll(/(?<![\w-])h-\[(\d+)px\]/g)].filter((m) => Number(m[1]) >= 300);
  ok(`${file}: no box trapped at a fixed tall height`, tallBoxes.length === 0, tallBoxes.map((m) => m[0]));

  const nowrap = [...s.matchAll(/whitespace-nowrap/g)];
  ok(`${file}: no whitespace-nowrap without something to scroll`, nowrap.length === 0);

  const shrunkInputs = [...s.matchAll(/<(?:input|textarea|select)\b/g)]
    .map((m) => openingTag(s, m.index) || "")
    .filter((tag) => /(!text-(?:xs|sm)|text-(?:xs|sm)!|text-\[\d+px\]!)/.test(tag));
  ok(`${file}: nothing defeats the iOS 16px input rule`, shrunkInputs.length === 0);
}

// ═══════════════════════════════════════════════════════════════════════════
section("14. Reachable — a screen nobody can open is the same bug with the button missing");
// ═══════════════════════════════════════════════════════════════════════════

ok("the rep portal's nav links /sales/notes", read("app/sales/SalesShell.js").includes('"/sales/notes"'));
ok("the platform sidebar links /platform/sales/notes", read("app/components/platform/PlatformSidebar.js").includes('"/platform/sales/notes"'));
ok("the rep index links each note", src(REP_INDEX_PAGE).includes("/sales/notes/${note.id}"));
ok("the rep API is called from the rep screens", src(REP_INDEX_PAGE).includes("/api/sales/notes") && src(REP_EDIT_PAGE).includes("/api/sales/notes/"));
ok("the platform API is called from the platform screen", src(PLAT_PAGE).includes("/api/platform/sales/notes"));
ok("the single-note platform route has a caller", src(PLAT_PAGE).includes("/api/platform/sales/notes/${id}"));

// ═══════════════════════════════════════════════════════════════════════════
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
