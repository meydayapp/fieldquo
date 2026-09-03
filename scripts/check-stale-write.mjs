// scripts/check-stale-write.mjs
//
//   npm run check:stale-write
//
// The regression guard for optimistic concurrency — lib/concurrency/staleWrite.js
// and the three routes that use it.
//
// ══ What this proves ═══════════════════════════════════════════════════════
//
// Two halves, and both are load-bearing.
//
// HALF ONE — EXECUTED. lib/concurrency/staleWrite.js has no imports at all
// (see its header), so this file imports the SHIPPED module and runs it: no
// stub loader, no copy, no "something shaped like the real thing". Around it
// sits an in-memory Prisma double whose `update` implements exactly the two
// rules Postgres and Prisma give the real one — a `where` that doesn't match
// raises P2025, and every successful update moves `updatedAt` — which is
// enough to drive every case in the brief for real, including the concurrent
// one:
//
//   1. a write with a MATCHING timestamp                → succeeds
//   2. a STALE one                                       → 409 + code
//                                                          "stale_write", and
//                                                          it names who and when
//   3. NO timestamp at all                               → succeeds, unguarded
//   4. a MALFORMED timestamp                             → 400, never 409, and
//                                                          never "unguarded"
//   5. TWO CONCURRENT writes                             → exactly one wins
//   6. a write to a row that was DELETED                 → 404, not 409
//   7. a timestamp from the FUTURE                       → 400, not 409
//
// HALF TWO — READ. Executing a mechanism proves nothing about whether the
// routes wire it up, and this repo's own history is mostly bugs of that shape
// (see MEMORY: "every check proved code correct; none proved it reachable").
// So the three guarded route files are parsed and each assertion is scoped to
// the PATCH handler's own brace-matched body — a `versionWhere` sitting in GET
// would not do, and neither would one in a comment.
//
// ══ Why "no timestamp succeeds" is an assertion and not an oversight ═══════
//
// 96 of the 99 PATCH/PUT routes are untouched, and the screens that call the
// three guarded ones from elsewhere (the quote detail page's status buttons,
// the schedule board) send no version. If a guarded route started refusing
// those, this change would break more than it fixed on the day it shipped.
// Missing means unguarded, deliberately, and case 3 is what keeps it true.
//
// ══ What this does NOT prove ═══════════════════════════════════════════════
//
//   * That Postgres and Prisma behave the way the double does. The two rules
//     it models are documented Prisma behaviour (extended `where` on `update`
//     raising P2025; `@updatedAt` moving on every update) but they are modelled
//     here, not observed. A live-database exercise of the same seven cases is
//     the thing that would close this, and it does not exist.
//   * Anything about the BANNER. app/components/StaleWriteBanner.js renders
//     conflict data; whether it is legible, reachable or correctly placed needs
//     a browser. Only the shape of the data it is handed is checked here.
//   * That the other 96 routes are safe. They are not. They are unguarded, and
//     that is the state this change deliberately left them in.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, decomment, balanced, handlerBodies } from "./tenantScopeScan.mjs";
import {
  STALE_WRITE_CODE,
  BAD_VERSION_CODE,
  VERSION_FIELD,
  FUTURE_SKEW_MS,
  parseExpectedVersion,
  versionWhere,
  isVersionMiss,
  runGuardedWrite,
  resolveEditor,
  recordEdit,
  settleGuardedWrite,
} from "../lib/concurrency/staleWrite.js";

let pass = 0;
let fail = 0;
const ok = (name, cond, got) => {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(
      `  ✗ ${name}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`,
    );
  }
};
const section = (t) => console.log(`\n${t}`);

// ═══════════════════════════════════════════════════════════════════════════
// The double
// ═══════════════════════════════════════════════════════════════════════════

/**
 * A clock that never repeats.
 *
 * Load-bearing: the whole guard is a timestamp EQUALITY test, so a double
 * whose two writes could land on the same millisecond would make case 5 pass
 * for the wrong reason. Postgres timestamps are microsecond-resolution and
 * Prisma truncates to milliseconds, so real collisions inside one millisecond
 * are possible — which is an argument for a version counter someday, and is
 * NOT what is being tested here.
 */
function makeClock(startMs = Date.parse("2026-09-02T10:00:00.000Z")) {
  let n = startMs;
  return () => new Date((n += 1000));
}

function p2025() {
  // Prisma's shape, matched exactly: isVersionMiss keys off `code`.
  const err = new Error(
    "An operation failed because it depends on one or more records that were required but not found.",
  );
  err.code = "P2025";
  return err;
}

/**
 * A Prisma double for one tenant model plus RecordEdit and User.
 *
 * `update` models the two behaviours the guard depends on:
 *   - a `where` that matches nothing raises P2025 (Prisma's extended
 *     `where` on `update`), and
 *   - a successful update moves `updatedAt` (Prisma's `@updatedAt`).
 */
function makeDb({ rows = [], users = [], clock = makeClock() } = {}) {
  const store = new Map(rows.map((r) => [r.id, { ...r }]));
  const edits = new Map();
  const userRows = new Map(users.map((u) => [u.id, { ...u }]));
  const key = (companyId, entityType, entityId) =>
    `${companyId}::${entityType}::${entityId}`;

  const matches = (row, where) => {
    if (!row) return false;
    if (where.companyId !== undefined && row.companyId !== where.companyId)
      return false;
    if (where.updatedAt !== undefined) {
      if (!(where.updatedAt instanceof Date)) return false;
      if (row.updatedAt.getTime() !== where.updatedAt.getTime()) return false;
    }
    return true;
  };

  const model = {
    async update({ where, data }) {
      const row = store.get(where.id);
      if (!matches(row, where)) throw p2025();
      Object.assign(row, data);
      row.updatedAt = clock();
      return { ...row };
    },
    async findFirst({ where }) {
      const row = store.get(where.id);
      return matches(row, where) ? { ...row } : null;
    },
  };

  return {
    _store: store,
    _edits: edits,
    quote: model,
    recordEdit: {
      async findUnique({ where }) {
        const k = where.companyId_entityType_entityId;
        const hit = edits.get(key(k.companyId, k.entityType, k.entityId));
        return hit ? { ...hit } : null;
      },
      async upsert({ where, create, update }) {
        const k = where.companyId_entityType_entityId;
        const id = key(k.companyId, k.entityType, k.entityId);
        const existing = edits.get(id);
        const next = existing ? { ...existing, ...update } : { ...create };
        edits.set(id, next);
        return { ...next };
      },
    },
    user: {
      async findUnique({ where }) {
        const u = userRows.get(where.id);
        return u ? { ...u } : null;
      },
    },
  };
}

/**
 * The guarded PATCH, reduced to the shape all three routes share.
 *
 * This mirrors app/api/quotes/[id]/route.js deliberately and is NOT proof that
 * the route looks like this — that is what the source assertions further down
 * are for. What it IS is a way to execute the shipped helpers end to end,
 * including the failure paths a live route only reaches under a real race.
 */
async function guardedPatch(db, { id, companyId, member, body }) {
  // Every one of the three real routes loads the row company-scoped and
  // answers 404 before it looks at the body. Mirrored here because the guard's
  // answers are only correct on top of it: without this step a cross-tenant
  // write would reach the version comparison at all, and the concurrency
  // channel would become a way to learn that another company's record exists.
  const existing = await db.quote.findFirst({ where: { id, companyId } });
  if (!existing) return { status: 404, body: { error: "Not found" } };

  let expected;
  try {
    expected = parseExpectedVersion(body?.[VERSION_FIELD]);
  } catch (err) {
    return { status: err.status, body: { error: err.message, code: err.code } };
  }

  const outcome = await runGuardedWrite({
    expected,
    readVersion: () =>
      db.quote.findFirst({
        where: { id, companyId },
        select: { updatedAt: true },
      }),
    write: () =>
      db.quote.update({
        where: { id, ...versionWhere(expected) },
        data: body?.data || {},
      }),
  });

  const refusal = await settleGuardedWrite(outcome, {
    client: db,
    companyId,
    entityType: "quote",
    entityId: id,
    label: "quote",
    expected,
    member,
    versionAt: outcome.result?.updatedAt,
  });
  if (refusal) return { status: refusal.status, body: refusal.body };
  return { status: 200, body: outcome.result };
}

const CO = "co_1";
const SARAH = { id: "m_sarah", userId: "u_sarah" };
const DAVE = { id: "m_dave", userId: "u_dave" };
const USERS = [
  { id: "u_sarah", name: "Sarah Chen", email: "sarah@example.com" },
  { id: "u_dave", name: null, email: "dave@example.com" },
];

function freshDb() {
  const clock = makeClock();
  return makeDb({
    rows: [
      {
        id: "q1",
        companyId: CO,
        total: "1000.00",
        updatedAt: new Date(Date.parse("2026-09-02T09:00:00.000Z")),
      },
    ],
    users: USERS,
    clock,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. A matching timestamp succeeds
// ═══════════════════════════════════════════════════════════════════════════
section("1. A write whose version still matches");
{
  const db = freshDb();
  const before = db._store.get("q1").updatedAt;

  const res = await guardedPatch(db, {
    id: "q1",
    companyId: CO,
    member: SARAH,
    body: { [VERSION_FIELD]: before.toISOString(), data: { total: "1200.00" } },
  });

  ok("succeeds with 200", res.status === 200, res.status);
  ok("the value is written", db._store.get("q1").total === "1200.00");
  ok(
    "updatedAt moved",
    db._store.get("q1").updatedAt.getTime() !== before.getTime(),
  );

  const edit = await db.recordEdit.findUnique({
    where: {
      companyId_entityType_entityId: {
        companyId: CO,
        entityType: "quote",
        entityId: "q1",
      },
    },
  });
  ok("the editor is recorded", Boolean(edit));
  ok("...by name, resolved at write time", edit?.editorName === "Sarah Chen", edit?.editorName);
  ok(
    "...bound to the version it produced",
    edit?.versionAt.getTime() === db._store.get("q1").updatedAt.getTime(),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. A stale timestamp is refused, WITH the specific reason
// ═══════════════════════════════════════════════════════════════════════════
section("2. A write whose version has moved on");
{
  const db = freshDb();
  const loadedByDave = db._store.get("q1").updatedAt;

  // Sarah saves first.
  await guardedPatch(db, {
    id: "q1",
    companyId: CO,
    member: SARAH,
    body: {
      [VERSION_FIELD]: loadedByDave.toISOString(),
      data: { total: "1200.00" },
    },
  });

  // Dave saves against the version he loaded, which is now stale.
  const res = await guardedPatch(db, {
    id: "q1",
    companyId: CO,
    member: DAVE,
    body: {
      [VERSION_FIELD]: loadedByDave.toISOString(),
      data: { total: "999.00" },
    },
  });

  ok("refused with 409", res.status === 409, res.status);
  ok(
    `carries code "${STALE_WRITE_CODE}"`,
    res.body?.code === STALE_WRITE_CODE,
    res.body?.code,
  );
  ok("Dave's value was NOT written", db._store.get("q1").total === "1200.00");
  ok("says WHO", res.body?.conflict?.byName === "Sarah Chen", res.body?.conflict?.byName);
  ok(
    "says WHEN",
    res.body?.conflict?.currentUpdatedAt ===
      db._store.get("q1").updatedAt.toISOString(),
  );
  ok(
    "echoes the version the caller held",
    res.body?.conflict?.expectedUpdatedAt === loadedByDave.toISOString(),
  );
  ok("knows it is not Dave's own edit", res.body?.conflict?.byYou === false);
  ok("marks the editor as known", res.body?.conflict?.knownEditor === true);

  // ── The deliberate re-apply ──────────────────────────────────────────────
  // Dave chooses to overwrite. Still guarded — against the version he was just
  // told about — so this is a decision, not a force flag.
  const retry = await guardedPatch(db, {
    id: "q1",
    companyId: CO,
    member: DAVE,
    body: {
      [VERSION_FIELD]: res.body.conflict.currentUpdatedAt,
      data: { total: "999.00" },
    },
  });
  ok("a deliberate re-apply succeeds", retry.status === 200, retry.status);
  ok("...and writes Dave's value", db._store.get("q1").total === "999.00");

  // And Sarah, whose screen still holds the pre-Dave version, is now the one
  // refused — the guard has no favourites and no session state.
  const sarahAgain = await guardedPatch(db, {
    id: "q1",
    companyId: CO,
    member: SARAH,
    body: { [VERSION_FIELD]: loadedByDave.toISOString(), data: { total: "1.00" } },
  });
  ok("the guard is symmetric", sarahAgain.status === 409, sarahAgain.status);
}

// ── The same conflict, when the writer was YOU on another device ───────────
section("2b. The other version turns out to be your own");
{
  const db = freshDb();
  const v0 = db._store.get("q1").updatedAt;
  await guardedPatch(db, {
    id: "q1",
    companyId: CO,
    member: SARAH,
    body: { [VERSION_FIELD]: v0.toISOString(), data: { total: "1200.00" } },
  });
  const res = await guardedPatch(db, {
    id: "q1",
    companyId: CO,
    member: SARAH,
    body: { [VERSION_FIELD]: v0.toISOString(), data: { total: "1300.00" } },
  });
  ok("still refused", res.status === 409, res.status);
  ok("but flagged as your own edit", res.body?.conflict?.byYou === true);
}

// ── And when nothing can prove who wrote last ─────────────────────────────
section("2c. An unattributed write is never attributed to a guess");
{
  const db = freshDb();
  const v0 = db._store.get("q1").updatedAt;

  // Something outside the guarded routes moves the row — a lifecycle hook, the
  // public quote-acceptance route, a cron sweep. No RecordEdit row is written.
  await db.quote.update({ where: { id: "q1" }, data: { total: "50.00" } });

  const res = await guardedPatch(db, {
    id: "q1",
    companyId: CO,
    member: DAVE,
    body: { [VERSION_FIELD]: v0.toISOString(), data: { total: "999.00" } },
  });
  ok("refused", res.status === 409, res.status);
  ok("no name is invented", res.body?.conflict?.byName === null, res.body?.conflict?.byName);
  ok("and it says so", res.body?.conflict?.knownEditor === false);
  ok(
    "the English fallback stays honest",
    /Someone on your team/.test(res.body?.error || ""),
    res.body?.error,
  );
}

// ── A STALE RecordEdit row must not be trusted either ─────────────────────
section("2d. A RecordEdit row that no longer matches the stored version");
{
  const db = freshDb();
  const v0 = db._store.get("q1").updatedAt;

  // Sarah writes through the guard, so a RecordEdit row exists and matches.
  await guardedPatch(db, {
    id: "q1",
    companyId: CO,
    member: SARAH,
    body: { [VERSION_FIELD]: v0.toISOString(), data: { total: "1200.00" } },
  });
  // Then something unguarded moves the row again. Sarah's RecordEdit row is
  // still there, and now describes a version that is no longer stored.
  await db.quote.update({ where: { id: "q1" }, data: { total: "77.00" } });

  const res = await guardedPatch(db, {
    id: "q1",
    companyId: CO,
    member: DAVE,
    body: { [VERSION_FIELD]: v0.toISOString(), data: { total: "999.00" } },
  });
  ok("refused", res.status === 409, res.status);
  ok(
    "Sarah is NOT blamed for a write that wasn't hers",
    res.body?.conflict?.byName === null,
    res.body?.conflict?.byName,
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. No timestamp at all — the migration path
// ═══════════════════════════════════════════════════════════════════════════
section("3. A caller that sends no version (unguarded, and must stay working)");
{
  for (const [label, body] of [
    ["field absent", { data: { total: "1200.00" } }],
    ["explicit null", { [VERSION_FIELD]: null, data: { total: "1200.00" } }],
    ["empty string", { [VERSION_FIELD]: "", data: { total: "1200.00" } }],
  ]) {
    const db = freshDb();
    const res = await guardedPatch(db, {
      id: "q1",
      companyId: CO,
      member: SARAH,
      body,
    });
    ok(`${label}: succeeds`, res.status === 200, res.status);
    ok(`${label}: writes`, db._store.get("q1").total === "1200.00");
  }

  // The one that matters most: an unguarded caller still wins over a row that
  // somebody else has already moved. This is the pre-existing behaviour, and
  // breaking it would break 96 untouched screens.
  const db = freshDb();
  const v0 = db._store.get("q1").updatedAt;
  await guardedPatch(db, {
    id: "q1",
    companyId: CO,
    member: SARAH,
    body: { [VERSION_FIELD]: v0.toISOString(), data: { total: "1200.00" } },
  });
  const res = await guardedPatch(db, {
    id: "q1",
    companyId: CO,
    member: DAVE,
    body: { data: { total: "999.00" } },
  });
  ok(
    "an unguarded call is accepted even on a moved row",
    res.status === 200,
    res.status,
  );

  // And it still records who holds the current version, so the NEXT guarded
  // caller gets a name rather than "someone on your team". An unwired screen
  // must not blind the wired ones.
  const edit = await db.recordEdit.findUnique({
    where: {
      companyId_entityType_entityId: {
        companyId: CO,
        entityType: "quote",
        entityId: "q1",
      },
    },
  });
  ok(
    "an unguarded write still records its editor",
    edit?.editorName === "dave@example.com",
    edit?.editorName,
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. A malformed timestamp
// ═══════════════════════════════════════════════════════════════════════════
section("4. A version the server cannot read");
{
  const MALFORMED = [
    "not a date",
    "2026-13-45T99:99:99Z",
    "yesterday",
    "0000", // Date() alone reads this as the year 0 — a valid date, and nonsense
    "2026",
    "2026-09-02 10:00:00", // space instead of T: not what toISOString emits
    1789200000, // epoch seconds or milliseconds? refused rather than guessed
    1789200000000,
    true,
    {},
    [],
    "  ",
  ];
  for (const raw of MALFORMED) {
    const db = freshDb();
    const res = await guardedPatch(db, {
      id: "q1",
      companyId: CO,
      member: SARAH,
      body: { [VERSION_FIELD]: raw, data: { total: "999.00" } },
    });
    ok(
      `${JSON.stringify(raw)} → 400`,
      res.status === 400,
      { status: res.status, code: res.body?.code },
    );
    ok(
      `${JSON.stringify(raw)} → not a stale-write 409`,
      res.body?.code === BAD_VERSION_CODE,
      res.body?.code,
    );
    ok(
      `${JSON.stringify(raw)} → nothing was written`,
      db._store.get("q1").total === "1000.00",
    );
  }

  // The trap this closes: a malformed value read as "no version" would make a
  // typo silently switch the guard off for that request.
  let threw = false;
  try {
    parseExpectedVersion("not a date");
  } catch {
    threw = true;
  }
  ok("a malformed value is never read as unguarded", threw);
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. Two concurrent writes — exactly one wins
// ═══════════════════════════════════════════════════════════════════════════
section("5. Two writers, same version, at the same time");
{
  const db = freshDb();
  const shared = db._store.get("q1").updatedAt.toISOString();

  const [a, b] = await Promise.all([
    guardedPatch(db, {
      id: "q1",
      companyId: CO,
      member: SARAH,
      body: { [VERSION_FIELD]: shared, data: { total: "1200.00" } },
    }),
    guardedPatch(db, {
      id: "q1",
      companyId: CO,
      member: DAVE,
      body: { [VERSION_FIELD]: shared, data: { total: "999.00" } },
    }),
  ]);

  const winners = [a, b].filter((r) => r.status === 200);
  const losers = [a, b].filter((r) => r.status === 409);
  ok("exactly one succeeds", winners.length === 1, [a.status, b.status]);
  ok("exactly one is refused", losers.length === 1, [a.status, b.status]);
  ok(
    "the refusal is a stale write, not a 500",
    losers[0]?.body?.code === STALE_WRITE_CODE,
    losers[0]?.body,
  );
  ok(
    "the stored value is the winner's, not a blend",
    ["1200.00", "999.00"].includes(db._store.get("q1").total),
    db._store.get("q1").total,
  );

  // Ten at once, to be sure one-of-two wasn't luck.
  const db2 = freshDb();
  const v = db2._store.get("q1").updatedAt.toISOString();
  const many = await Promise.all(
    Array.from({ length: 10 }, (_, i) =>
      guardedPatch(db2, {
        id: "q1",
        companyId: CO,
        member: SARAH,
        body: { [VERSION_FIELD]: v, data: { total: `${i}.00` } },
      }),
    ),
  );
  ok(
    "ten simultaneous writers: exactly one wins",
    many.filter((r) => r.status === 200).length === 1,
    many.map((r) => r.status),
  );
  ok(
    "...and the other nine are told why",
    many.filter((r) => r.body?.code === STALE_WRITE_CODE).length === 9,
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. A write to a row that was deleted
// ═══════════════════════════════════════════════════════════════════════════
section("6. The record was deleted while the screen was open");
{
  for (const [label, extra] of [
    ["guarded", null],
    ["unguarded", "skip"],
  ]) {
    const db = freshDb();
    const v0 = db._store.get("q1").updatedAt.toISOString();
    db._store.delete("q1");

    const res = await guardedPatch(db, {
      id: "q1",
      companyId: CO,
      member: SARAH,
      body: {
        ...(extra ? {} : { [VERSION_FIELD]: v0 }),
        data: { total: "999.00" },
      },
    });
    ok(`${label}: 404, not 409`, res.status === 404, res.status);
    ok(
      `${label}: no stale-write code — there is nobody to blame and nothing to re-apply onto`,
      res.body?.code !== STALE_WRITE_CODE,
      res.body?.code,
    );
  }

  // ── The branch the mirror above can never reach ────────────────────────
  //
  // Every guarded route loads the row company-scoped and 404s before it
  // writes, so in the mirror a deleted row is caught by that pre-check and
  // runGuardedWrite's own "gone" branch is never exercised. In PRODUCTION it
  // very much is: the row can be deleted in the window between that pre-check
  // and the write, which is the same race the whole feature is about. Driven
  // directly, because a test that only ever reaches a branch through the happy
  // path is not testing that branch.
  {
    const outcome = await runGuardedWrite({
      expected: new Date("2026-09-02T09:00:00.000Z"),
      write: async () => {
        throw p2025();
      },
      readVersion: async () => null, // deleted between the pre-check and the write
    });
    ok("deleted mid-request: reason is gone", outcome.reason === "gone", outcome);

    const refusal = await settleGuardedWrite(outcome, {
      client: freshDb(),
      companyId: CO,
      entityType: "quote",
      entityId: "q1",
      label: "quote",
      expected: new Date("2026-09-02T09:00:00.000Z"),
      member: SARAH,
    });
    ok("deleted mid-request: 404", refusal?.status === 404, refusal?.status);
    ok(
      "deleted mid-request: no stale-write code",
      refusal?.body?.code !== STALE_WRITE_CODE,
      refusal?.body,
    );
  }

  // The same for an UNGUARDED write that hits a P2025 on a row that still
  // exists — a nested connect pointing at something missing, say. That is a
  // real bug and must escape as one; reporting it as "a colleague edited this"
  // would send someone hunting for a colleague who does not exist. Also
  // unreachable through the mirror, for the same reason.
  {
    let escaped = false;
    try {
      await runGuardedWrite({
        expected: null,
        write: async () => {
          throw p2025();
        },
        readVersion: async () => ({ updatedAt: new Date() }),
      });
    } catch (err) {
      escaped = isVersionMiss(err);
    }
    ok("an unguarded write is never refused as stale", escaped);
  }

  // A row belonging to ANOTHER company reads as gone, not as a conflict — the
  // tenant boundary must not be leaked through the concurrency channel.
  const db = freshDb();
  const v0 = db._store.get("q1").updatedAt.toISOString();
  const res = await guardedPatch(db, {
    id: "q1",
    companyId: "co_other",
    member: SARAH,
    body: { [VERSION_FIELD]: v0, data: { total: "999.00" } },
  });
  ok("another tenant's row reads as gone", res.status === 404, res.status);
  ok(
    "...and leaks no timestamp",
    !JSON.stringify(res.body).includes(v0),
    res.body,
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 7. A timestamp from the future
// ═══════════════════════════════════════════════════════════════════════════
section("7. A version dated in the future");
{
  const db = freshDb();
  const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString();
  const res = await guardedPatch(db, {
    id: "q1",
    companyId: CO,
    member: SARAH,
    body: { [VERSION_FIELD]: future, data: { total: "999.00" } },
  });
  ok("refused with 400", res.status === 400, res.status);
  ok(
    "as malformed, not as a conflict — nobody edited anything",
    res.body?.code === BAD_VERSION_CODE,
    res.body?.code,
  );
  ok("nothing was written", db._store.get("q1").total === "1000.00");

  // The skew window is real and has to keep working: a row written moments ago
  // by an instance whose clock runs slightly fast is a LEGITIMATE version.
  const now = Date.now();
  ok(
    "a few hundred ms of clock skew is accepted",
    parseExpectedVersion(new Date(now + 500).toISOString(), { now }) instanceof Date,
  );
  let far = false;
  try {
    parseExpectedVersion(new Date(now + FUTURE_SKEW_MS + 5000).toISOString(), { now });
  } catch {
    far = true;
  }
  ok(`beyond ${FUTURE_SKEW_MS}ms is refused`, far);
}

// ═══════════════════════════════════════════════════════════════════════════
// 8. The pure helpers, on their own
// ═══════════════════════════════════════════════════════════════════════════
section("8. The pure pieces");
{
  ok("versionWhere(null) is empty", Object.keys(versionWhere(null)).length === 0);
  const d = new Date("2026-09-02T10:00:00.000Z");
  ok("versionWhere(date) guards updatedAt", versionWhere(d).updatedAt === d);

  ok("isVersionMiss recognises P2025", isVersionMiss({ code: "P2025" }));
  ok("...and nothing else", !isVersionMiss({ code: "P2002" }) && !isVersionMiss(null));

  // resolveEditor is the whole naming rule, and the equality test IS the rule.
  const at = new Date("2026-09-02T10:00:00.000Z");
  const other = new Date("2026-09-02T10:00:01.000Z");
  const edit = { versionAt: at, editorName: "Sarah Chen", editorUserId: "u_sarah" };
  ok(
    "names the editor when the version matches",
    resolveEditor({ edit, currentUpdatedAt: at, viewerUserId: "u_dave" }).name ===
      "Sarah Chen",
  );
  ok(
    "refuses to name one when it doesn't",
    resolveEditor({ edit, currentUpdatedAt: other, viewerUserId: "u_dave" }).name ===
      null,
  );
  ok(
    "no row at all means unknown",
    resolveEditor({ edit: null, currentUpdatedAt: at }).known === false,
  );
  ok(
    "byYou when the ids line up",
    resolveEditor({ edit, currentUpdatedAt: at, viewerUserId: "u_sarah" }).byYou === true,
  );

  // recordEdit must never throw — it is audit-adjacent, and a failure to
  // record who saved must not fail the save. Same contract lib/activity/log.js
  // states.
  const exploding = {
    recordEdit: {
      upsert: async () => {
        throw new Error("relation \"RecordEdit\" does not exist");
      },
    },
    user: { findUnique: async () => ({ name: "Sarah Chen" }) },
  };
  let recordThrew = false;
  try {
    await recordEdit(exploding, {
      companyId: CO,
      entityType: "quote",
      entityId: "q1",
      editorUserId: "u_sarah",
      versionAt: new Date(),
    });
  } catch {
    recordThrew = true;
  }
  ok("recordEdit swallows its own failure", !recordThrew);

  // ...and so does the lookup on the refusal path. A missing table must
  // degrade the banner to "someone on your team", never turn a 409 that
  // protects data into a 500 that doesn't.
  const explodingRead = {
    recordEdit: {
      findUnique: async () => {
        throw new Error("relation \"RecordEdit\" does not exist");
      },
    },
  };
  const refusal = await settleGuardedWrite(
    { ok: false, reason: "stale", currentUpdatedAt: at },
    {
      client: explodingRead,
      companyId: CO,
      entityType: "quote",
      entityId: "q1",
      label: "quote",
      expected: other,
      member: SARAH,
    },
  );
  ok("a broken editor lookup still yields a 409", refusal?.status === 409, refusal?.status);
  ok("...with the code intact", refusal?.body?.code === STALE_WRITE_CODE);

  // An error that is NOT a version miss must escape, or a real bug gets
  // reported to the user as "a colleague edited this".
  let escaped = false;
  try {
    await runGuardedWrite({
      expected: new Date(),
      write: async () => {
        throw new Error("connection terminated unexpectedly");
      },
      readVersion: async () => ({ updatedAt: new Date() }),
    });
  } catch (err) {
    escaped = /connection terminated/.test(err.message);
  }
  ok("an unrelated failure is re-thrown, not laundered into a conflict", escaped);

  // And a P2025 raised for some OTHER reason, on a row whose version is
  // exactly what the caller expected, must also escape.
  const same = new Date("2026-09-02T10:00:00.000Z");
  let escaped2 = false;
  try {
    await runGuardedWrite({
      expected: same,
      write: async () => {
        throw p2025();
      },
      readVersion: async () => ({ updatedAt: same }),
    });
  } catch (err) {
    escaped2 = isVersionMiss(err);
  }
  ok(
    "a P2025 on an unmoved row is re-thrown, not blamed on a colleague",
    escaped2,
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 9. The routes actually wire it up
// ═══════════════════════════════════════════════════════════════════════════
//
// Every assertion below is scoped to the PATCH handler's own brace-matched
// body. A helper imported at module scope proves nothing; neither does a
// `versionWhere` in GET, and comments are stripped first so a paragraph
// EXPLAINING the guard cannot stand in for one.
section("9. The guarded routes");

const GUARDED = [
  { file: "app/api/quotes/[id]/route.js", entity: "quote" },
  { file: "app/api/invoices/[id]/route.js", entity: "invoice" },
  { file: "app/api/jobs/[id]/route.js", entity: "job" },
];

for (const { file, entity } of GUARDED) {
  const raw = readFileSync(join(ROOT, file), "utf8");
  const src = decomment(raw);
  const patch = handlerBodies(src).find((b) => b.name === "PATCH");

  if (!patch) {
    ok(`${file}: has a PATCH handler`, false);
    continue;
  }
  const body = patch.text;

  // Presence, each as its OWN assertion. Checking an ORDER between two tokens
  // would pass vacuously the moment one of them disappeared — indexOf returns
  // -1 and -1 < anything.
  const parses = body.includes("parseExpectedVersion(");
  const guards = body.includes("versionWhere(expected)");
  const runs = body.includes("runGuardedWrite(");
  const settles = body.includes("settleGuardedWrite(");
  ok(`${file}: PATCH parses the client's version`, parses);
  ok(`${file}: PATCH spreads versionWhere into a where`, guards);
  ok(`${file}: PATCH runs the write through runGuardedWrite`, runs);
  ok(`${file}: PATCH settles the outcome`, settles);

  // The guard must be IN the write, not in an `if` above it — an `if` leaves a
  // window between reading the version and overwriting it, which is the exact
  // race this feature exists to close.
  if (runs && guards) {
    const at = body.indexOf("runGuardedWrite(");
    const block = balanced(body, body.indexOf("(", at));
    ok(
      `${file}: the guard sits inside the runGuardedWrite call`,
      block.includes("versionWhere(expected)"),
    );
    ok(
      `${file}: ...and inside the write, not the re-read`,
      /write:[\s\S]*versionWhere\(expected\)/.test(block),
    );
  }

  // The refusal must actually be returned. A settleGuardedWrite whose result
  // is computed and dropped is the "control that appears to work" case.
  ok(
    `${file}: the refusal is returned`,
    /if\s*\(\s*refusal\s*\)[\s\S]{0,120}return\s+NextResponse\.json\(\s*refusal\.body/.test(
      body,
    ),
  );

  // The entity string has to be the one the RecordEdit rows are keyed by — a
  // typo here silently makes every banner say "someone on your team" forever,
  // and nothing else would ever notice.
  //
  // Scoped to the settleGuardedWrite CALL, not to the handler. Every one of
  // these files also passes `entityType: "quote"` (or "job") to recordActivity
  // a few lines further down, so a file-wide match passed with the guard's own
  // value corrupted — found by mutation test, fixed by brace-matching.
  if (settles) {
    const at = body.indexOf("settleGuardedWrite(");
    const call = balanced(body, body.indexOf("(", at));
    ok(
      `${file}: records under entityType "${entity}"`,
      new RegExp(`entityType:\\s*"${entity}"`).test(call),
      call.match(/entityType:\s*"[^"]*"/)?.[0],
    );
  }

  // A malformed version must be refused, not swallowed. The route wraps the
  // parse in a try/catch that answers 400; without it a throw becomes a 500.
  ok(
    `${file}: a malformed version answers 400, not 500`,
    /parseExpectedVersion\([\s\S]{0,200}catch[\s\S]{0,300}status:\s*err\.status\s*\|\|\s*400/.test(
      body,
    ),
  );
}

// The client half has to read the CODE, not the status — this API already
// answers 409 for several unrelated things.
{
  const src = decomment(
    readFileSync(join(ROOT, "lib/concurrency/staleWriteClient.js"), "utf8"),
  );
  ok(
    "the client detects by code, not by status",
    src.includes("STALE_WRITE_CODE") && !/res\.status\s*===\s*409/.test(src),
  );
  ok("...and clones before reading the body", src.includes("res.clone()"));
}

// The shipped module must stay import-free, or this check quietly stops
// executing the real thing and starts needing a stub loader.
{
  const src = decomment(
    readFileSync(join(ROOT, "lib/concurrency/staleWrite.js"), "utf8"),
  );
  ok(
    "lib/concurrency/staleWrite.js imports nothing",
    !/^\s*import\s/m.test(src),
  );
}

// The banner must not offer a control it cannot honour.
{
  const src = readFileSync(
    join(ROOT, "app/components/StaleWriteBanner.js"),
    "utf8",
  );
  // Anchored to the ELEMENT, not merely to the token. A first version of this
  // asserted `/onOverwrite\s*\?/` anywhere in the file and passed happily with
  // the button's own condition replaced by `true`, because the hint paragraph
  // below it still carried the token — a mutation test caught it. The button
  // has to be the thing that is conditional.
  ok(
    "the banner draws its overwrite button only when it was given a handler",
    /onOverwrite\s*\?\s*\(\s*<button/.test(src),
  );
  ok(
    "...and its review link only when it was given a destination",
    /href\s*\?\s*\(\s*<a/.test(src),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
