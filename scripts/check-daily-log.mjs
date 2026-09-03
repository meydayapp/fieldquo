// scripts/check-daily-log.mjs
//
//   npm run check:daily-log
//
// The regression guard for daily logs (lib/jobs/dailyLog.js, JobDailyLog) and
// the job document store (lib/jobs/documents.js, JobDocument).
//
// ══ Three halves, and all three are load-bearing ═══════════════════════════
//
// EXECUTED. Both libraries have no imports at all — same discipline
// lib/concurrency/staleWrite.js states — so this file imports the SHIPPED
// modules and runs them. No stub loader, no copy, no "something shaped like
// the real code".
//
// EXECUTED AGAINST A DOUBLE. The two cases the brief cares most about —
// "two logs for one day is refused" and "a concurrent edit is refused, not
// silently overwritten" — are properties of a UNIQUE INDEX and of a WHERE
// clause, not of a pure function. So there is an in-memory Prisma double below
// implementing exactly three real behaviours: a unique index raises P2002, a
// `where` that matches nothing on update raises P2025, and every successful
// update moves `updatedAt`. The shipped staleWrite helpers are then driven
// through it for real.
//
// READ. Executing a mechanism proves nothing about whether the routes and the
// screens wire it up. This repo's own history is mostly bugs of that shape
// (MEMORY: "every check proved code correct; none proved it reachable"), so
// the route and component sources are parsed and every assertion is scoped to
// ONE brace-matched function body — a `versionWhere` sitting in a GET, or in a
// comment, would not do.
//
// ══ What this does NOT prove ═══════════════════════════════════════════════
//
//   * That Postgres behaves like the double. P2002 on @@unique([jobId,
//     logDate]) and P2025 on an extended `where` are documented Prisma
//     behaviour, but they are MODELLED here, not observed. A live-database
//     exercise does not exist.
//   * Anything visual. `npm run check:mobile` walks /platform, /sales and
//     /app/clock only — NOT the job page — so the mobile rules these two
//     panels follow are followed, not enforced. Widening that check is item 5
//     in docs/construction/STATUS.md.
//   * That Cloudinary stores what the browser said it stored. sizeBytes is the
//     browser's File.size; see normaliseSizeBytes' own comment.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, decomment, handlerBodies } from "./tenantScopeScan.mjs";
import {
  parseLogDate,
  dayKey,
  localDayKey,
  shiftDayKey,
  textToBody,
  bodyToText,
  normaliseCrewCount,
  normaliseHours,
  normaliseNote,
  readLogFields,
  shapeLog,
  seedBody,
  taskLine,
  LOG_SELECT,
  DAILY_LOG_ENTITY,
} from "../lib/jobs/dailyLog.js";
import {
  DOCUMENT_KINDS,
  MONEY_KINDS,
  normaliseKind,
  normaliseName,
  normaliseSizeBytes,
  isUploadedUrl,
  canSeeKind,
  visibleDocuments,
  revisionChains,
  revisionCount,
  formatBytes,
} from "../lib/jobs/documents.js";
import {
  parseExpectedVersion,
  versionWhere,
  runGuardedWrite,
  settleGuardedWrite,
  STALE_WRITE_CODE,
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

const threw = (fn) => {
  try {
    fn();
    return null;
  } catch (err) {
    return err;
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// 1. THE DAY IS A DAY — and 6am yesterday is yesterday
// ═══════════════════════════════════════════════════════════════════════════

section("1. logDate is the day REPORTED ON, at UTC midnight");

{
  const at = parseLogDate("2026-09-01");
  ok(
    "a day parses to UTC midnight",
    at.toISOString() === "2026-09-01T00:00:00.000Z",
    at.toISOString(),
  );
  ok("and round-trips back to the same key", dayKey(at) === "2026-09-01");

  // ── THE 6AM CASE ────────────────────────────────────────────────────────
  //
  // A crew member opens the app at 06:14 on Wednesday to fill in TUESDAY. The
  // browser computes the local calendar day it means and sends that; the
  // server lands on Tuesday at UTC midnight. It must not land on Wednesday.
  //
  // Every Date below is built from LOCAL components (new Date(y, m, d, h)) and
  // never from a string, so the assertions mean the same thing on a laptop in
  // Toronto and on a CI box in UTC. The first draft of this check used
  // new Date("2026-09-02T06:14:00") and a mutant that read getUTCDate() passed
  // it — 06:14 in Toronto is still the 2nd in UTC, so the test proved nothing.
  const localToday = localDayKey(new Date(2026, 8, 2, 6, 14));
  const yesterday = shiftDayKey(localToday, -1);
  ok(
    "6am on Wednesday, filing yesterday, resolves to Tuesday",
    yesterday === "2026-09-01",
    yesterday,
  );
  ok(
    "and that day stores as Tuesday UTC midnight, not Wednesday",
    parseLogDate(yesterday).toISOString() === "2026-09-01T00:00:00.000Z",
    parseLogDate(yesterday).toISOString(),
  );

  // The two edges where "the local day" and "the UTC day" disagree. West of
  // UTC it is late evening; east of UTC it is early morning. Asserting both
  // means a getUTC*() reading of the local clock fails this check in EVERY
  // timezone except UTC itself — where the two are genuinely the same function
  // and there is nothing to get wrong.
  ok(
    "9:30pm local is still today, not tomorrow (the crew finishing a late shift)",
    localDayKey(new Date(2026, 8, 1, 21, 30)) === "2026-09-01",
    localDayKey(new Date(2026, 8, 1, 21, 30)),
  );
  ok(
    "0:30am local is already today, not yesterday",
    localDayKey(new Date(2026, 8, 1, 0, 30)) === "2026-09-01",
    localDayKey(new Date(2026, 8, 1, 0, 30)),
  );

  // Two people in wildly different timezones naming the SAME Tuesday must land
  // on the same instant, because the unique index compares instants. This is
  // the whole reason an ISO instant is refused on the wire.
  ok(
    "an ISO instant is refused, never guessed at",
    threw(() => parseLogDate("2026-09-02T03:00:00.000Z"))?.status === 400,
  );
  ok("so is a blank", threw(() => parseLogDate(""))?.status === 400);
  ok("so is a Date object", threw(() => parseLogDate(new Date()))?.status === 400);
  ok(
    "and a day that does not exist is refused, not rolled forward",
    threw(() => parseLogDate("2026-02-30"))?.status === 400,
  );
  ok(
    "month 13 is refused",
    threw(() => parseLogDate("2026-13-01"))?.status === 400,
  );
  ok("month/day boundaries roll correctly", shiftDayKey("2026-03-01", -1) === "2026-02-28");
  ok("a leap day is a real day", dayKey(parseLogDate("2024-02-29")) === "2024-02-29");
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. NULL IS NOT ZERO
// ═══════════════════════════════════════════════════════════════════════════

section("2. an unanswered crew count is null, and never renders as 0");

{
  ok("blank string → null", normaliseCrewCount("") === null);
  ok("undefined → null", normaliseCrewCount(undefined) === null);
  ok("null → null", normaliseCrewCount(null) === null);
  // The other direction of the same mistake: a typed 0 is an ANSWER.
  ok("a typed 0 stays 0", normaliseCrewCount(0) === 0);
  ok('the string "0" stays 0', normaliseCrewCount("0") === 0);
  ok("3 stays 3", normaliseCrewCount("3") === 3);
  ok("negative is refused", threw(() => normaliseCrewCount(-1))?.status === 400);
  ok("a fraction is refused", threw(() => normaliseCrewCount("2.5"))?.status === 400);
  ok("nonsense is refused", threw(() => normaliseCrewCount("four"))?.status === 400);

  ok("hours: blank → null", normaliseHours("") === null);
  ok("hours: a typed 0 stays 0", normaliseHours("0") === 0);
  ok("hours: 7.25 rounds to two places", normaliseHours(7.25) === 7.25);
  ok("hours: 25 in one day is refused", threw(() => normaliseHours(25))?.status === 400);

  ok("a blank note is null, not an empty string", normaliseNote("   ") === null);
  ok("a note is trimmed", normaliseNote("  rain  ") === "rain");

  // shapeLog is what the browser is handed. Number(null) is 0, and that one
  // coercion is how a null becomes a fabricated zero on its way out.
  const shaped = shapeLog({
    id: "l1",
    logDate: new Date("2026-09-01T00:00:00.000Z"),
    crewCount: null,
    hoursOnSite: null,
  });
  ok("shapeLog keeps a null crewCount null", shaped.crewCount === null, shaped.crewCount);
  ok("shapeLog keeps a null hoursOnSite null", shaped.hoursOnSite === null, shaped.hoursOnSite);
  ok(
    "shapeLog turns a Decimal-ish hoursOnSite into a number",
    shapeLog({ logDate: new Date(), hoursOnSite: "7.50" }).hoursOnSite === 7.5,
  );

  // And the renderer. The panel must have no `?? 0`, no `|| 0` and no
  // `Number(...)` on either optional column — those are the three ways a null
  // becomes a zero on screen, and each has shipped in this codebase before.
  const panel = decomment(
    readFileSync(join(ROOT, "app/components/jobs/DailyLog.js"), "utf8"),
  );
  ok(
    "DailyLog.js never defaults crewCount to 0",
    !/crewCount\s*(\?\?|\|\|)\s*0/.test(panel),
  );
  ok(
    "DailyLog.js never defaults hoursOnSite to 0",
    !/hoursOnSite\s*(\?\?|\|\|)\s*0/.test(panel),
  );
  ok(
    "DailyLog.js renders an optional number through a null-aware component",
    /function Optional\(/.test(panel) &&
      /value === null \|\| value === undefined/.test(panel),
  );
  const editor = decomment(
    readFileSync(join(ROOT, "app/components/jobs/DailyLogEditor.js"), "utf8"),
  );
  ok(
    "DailyLogEditor.js binds crewCount with ?? and not || (|| erases a typed 0)",
    /value=\{value\.crewCount \?\? ""\}/.test(editor) &&
      !/value\.crewCount \|\|/.test(editor),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. BODY / BODYTEXT
// ═══════════════════════════════════════════════════════════════════════════

section("3. bodyText is DERIVED from body, never authored");

{
  const body = textToBody("Poured the slab\n\nRain from 2pm");
  ok("text becomes BlockNote paragraphs", Array.isArray(body) && body.length === 3);
  ok("each block is a real BlockNote paragraph", body[0].type === "paragraph");
  ok(
    "a blank line survives as an empty paragraph",
    Array.isArray(body[1].content) && body[1].content.length === 0,
  );
  ok(
    "and it round-trips",
    bodyToText(body) === "Poured the slab\n\nRain from 2pm",
    bodyToText(body),
  );

  // Nested content — a bulleted list's items are children, and a link's words
  // live inside the link node. A walker that only read top-level `content`
  // would index the first line and silently drop the rest.
  const nested = [
    {
      type: "bulletListItem",
      content: [{ type: "text", text: "Framing" }],
      children: [
        { type: "bulletListItem", content: [{ type: "text", text: "north wall" }] },
      ],
    },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "see " },
        { type: "link", content: [{ type: "text", text: "the plan" }] },
      ],
    },
  ];
  ok(
    "nested children and inline links are all indexed",
    bodyToText(nested) === "Framing\nnorth wall\nsee the plan",
    bodyToText(nested),
  );

  // Hostile input: `body` is a Json column holding whatever the editor of the
  // day serialised, including from a future BlockNote. It must degrade, never
  // throw — a save that 500s because of an unknown node type is worse than an
  // unindexed line.
  ok("null body → null text", bodyToText(null) === null);
  ok("a string body → null text", bodyToText("nope") === null);
  ok("garbage nodes are skipped, not thrown on", bodyToText([1, null, {}, []]) === null);
  ok(
    "a deeply self-nesting body terminates",
    (() => {
      let node = { type: "paragraph", content: [{ type: "text", text: "x" }] };
      for (let i = 0; i < 500; i++) node = { type: "x", children: [node] };
      return bodyToText([node]) !== undefined;
    })(),
  );
  ok("an empty body is null, not an empty string", bodyToText([]) === null);

  // readLogFields is the write boundary. bodyText must NEVER come off the wire.
  const fields = readLogFields({
    text: "Poured the slab",
    bodyText: "SOMETHING ELSE ENTIRELY",
  });
  ok(
    "a client-supplied bodyText is ignored and recomputed",
    fields.bodyText === "Poured the slab",
    fields.bodyText,
  );
  ok(
    "an absent field is absent from the patch, not blanked",
    !("weather" in readLogFields({ text: "x" })),
  );
  ok(
    "a present-but-empty field clears to null",
    readLogFields({ weather: "" }).weather === null,
  );
  ok(
    "BlockNote JSON is accepted directly, for the day the editor changes",
    readLogFields({ body: textToBody("hi") }).bodyText === "hi",
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. THE SEED — a blank box at the end of a shift gets skipped
// ═══════════════════════════════════════════════════════════════════════════

section("4. a new day opens populated, and an empty day opens empty");

{
  const labels = { photos: "{count} photos filed today.", tasks: "Finished today:" };
  const seeded = seedBody(
    { photoCount: 4, taskLines: ["Sand the deck", "Prime the trim — two coats"] },
    labels,
  );
  const text = bodyToText(seeded);
  ok("the photo count is in the draft", text.includes("4 photos filed today."));
  ok("so are the finished to-dos", text.includes("- Sand the deck"));
  ok("with their completion comments", text.includes("two coats"));

  // A day nobody worked must open GENUINELY empty. A seeded heading over an
  // empty day is a record of nothing, pre-typed.
  ok("nothing to say → no seed at all", seedBody({ photoCount: 0, taskLines: [] }, labels) === null);
  ok("no arguments at all → no seed", seedBody() === null);

  // The line builder. `${title}: ${comment}` is the naive version, and it
  // prints "Sand the deck — null" into somebody's daily record.
  ok(
    "a to-do with no comment still gets a clean line",
    taskLine({ title: "Sand the deck", completionComment: null }) === "Sand the deck",
    taskLine({ title: "Sand the deck", completionComment: null }),
  );
  ok(
    "a blank comment does not leave a dangling dash",
    taskLine({ title: "Sand the deck", completionComment: "   " }) === "Sand the deck",
  );
  ok("a titleless to-do is dropped", taskLine({ title: "  " }) === null);
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. THE DOUBLE — two logs for one day, and a concurrent edit
// ═══════════════════════════════════════════════════════════════════════════

section("5. one log per job per day, and a concurrent edit refuses");

/** A clock that never repeats — the guard is a timestamp EQUALITY test. */
function makeClock(startMs = Date.parse("2026-09-02T10:00:00.000Z")) {
  let n = startMs;
  return () => new Date((n += 1000));
}

function prismaError(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

/**
 * The three behaviours the feature actually depends on:
 *   - @@unique([jobId, logDate]) raises P2002 on a second create,
 *   - an extended `where` on update that matches nothing raises P2025,
 *   - @updatedAt moves on every successful update.
 */
function makeDb({ clock = makeClock() } = {}) {
  const rows = new Map();
  const edits = new Map();
  let seq = 0;

  const dayOf = (d) => (d instanceof Date ? d.getTime() : d);
  const matches = (row, where) => {
    if (!row) return false;
    if (where.companyId !== undefined && row.companyId !== where.companyId) return false;
    if (where.updatedAt !== undefined) {
      if (!(where.updatedAt instanceof Date)) return false;
      if (row.updatedAt.getTime() !== where.updatedAt.getTime()) return false;
    }
    return true;
  };

  return {
    _rows: rows,
    jobDailyLog: {
      async create({ data }) {
        for (const row of rows.values()) {
          if (row.jobId === data.jobId && dayOf(row.logDate) === dayOf(data.logDate)) {
            throw prismaError(
              "P2002",
              "Unique constraint failed on the fields: (`jobId`,`logDate`)",
            );
          }
        }
        const now = clock();
        const row = { id: `log_${++seq}`, ...data, createdAt: now, updatedAt: now };
        rows.set(row.id, row);
        return { ...row };
      },
      async update({ where, data }) {
        const row = rows.get(where.id);
        if (!matches(row, where)) throw prismaError("P2025", "Record to update not found.");
        Object.assign(row, data);
        row.updatedAt = clock();
        return { ...row };
      },
      async findFirst({ where }) {
        for (const row of rows.values()) {
          if (where.id && row.id !== where.id) continue;
          if (where.jobId && row.jobId !== where.jobId) continue;
          if (where.logDate !== undefined && dayOf(row.logDate) !== dayOf(where.logDate))
            continue;
          if (where.companyId && row.companyId !== where.companyId) continue;
          return { ...row };
        }
        return null;
      },
    },
    recordEdit: {
      async findUnique({ where }) {
        const k = where.companyId_entityType_entityId;
        return edits.get(`${k.companyId}:${k.entityType}:${k.entityId}`) || null;
      },
      async upsert({ where, create, update }) {
        const k = where.companyId_entityType_entityId;
        const id = `${k.companyId}:${k.entityType}:${k.entityId}`;
        const existing = edits.get(id);
        const next = existing ? { ...existing, ...update } : { ...create };
        edits.set(id, next);
        return next;
      },
    },
    user: {
      async findUnique() {
        return { id: "u_sarah", name: "Sarah Chen", email: "sarah@example.com" };
      },
    },
  };
}

const CO = "co_1";
const JOB = "job_1";
const TUESDAY = parseLogDate("2026-09-01");

/** POST, reduced to the shape the real route has. */
async function createLog(db, { day, fields, member }) {
  const at = parseLogDate(day);
  try {
    const created = await db.jobDailyLog.create({
      data: { companyId: CO, jobId: JOB, logDate: at, ...fields, authorUserId: member },
    });
    return { status: 201, body: { log: shapeLog(created) } };
  } catch (err) {
    if (err?.code !== "P2002") throw err;
    const existing = await db.jobDailyLog.findFirst({
      where: { jobId: JOB, companyId: CO, logDate: at },
    });
    return {
      status: 409,
      body: { code: STALE_WRITE_CODE, conflict: { id: existing.id } },
    };
  }
}

/** PATCH, reduced to the shape the real route has. */
async function patchLog(db, { logId, fields, expectedRaw, member }) {
  let expected;
  try {
    expected = parseExpectedVersion(expectedRaw);
  } catch (err) {
    return { status: err.status, body: { error: err.message, code: err.code } };
  }

  const outcome = await runGuardedWrite({
    expected,
    readVersion: () =>
      db.jobDailyLog.findFirst({ where: { id: logId, companyId: CO } }),
    write: () =>
      db.jobDailyLog.update({
        where: { id: logId, ...versionWhere(expected) },
        data: fields,
      }),
  });

  const refusal = await settleGuardedWrite(outcome, {
    client: db,
    companyId: CO,
    entityType: DAILY_LOG_ENTITY,
    entityId: logId,
    label: "daily log",
    expected,
    member,
    versionAt: outcome.result?.updatedAt,
  });
  if (refusal) return refusal;
  return { status: 200, body: { log: shapeLog(outcome.result) } };
}

{
  const db = makeDb();
  const sarah = { id: "m_sarah", userId: "u_sarah" };
  const dave = { id: "m_dave", userId: "u_dave" };

  const first = await createLog(db, {
    day: "2026-09-01",
    fields: readLogFields({ text: "Poured the slab", crewCount: "3" }),
    member: sarah.userId,
  });
  ok("the first log for Tuesday is created", first.status === 201, first.status);

  // ── TWO LOGS FOR ONE DAY ────────────────────────────────────────────────
  const second = await createLog(db, {
    day: "2026-09-01",
    fields: readLogFields({ text: "Also poured the slab" }),
    member: dave.userId,
  });
  ok("a SECOND log for the same Tuesday is refused", second.status === 409, second.status);
  ok(
    "and the refusal is machine-readable as a stale write, not a bare 409",
    second.body.code === STALE_WRITE_CODE,
    second.body.code,
  );
  ok("exactly one row exists for that day", db._rows.size === 1, db._rows.size);
  ok(
    "and the refusal points at the row that already exists, so the browser can reload it",
    second.body.conflict.id === first.body.log.id,
  );

  // The 6am case, end to end: filing YESTERDAY when today's log exists must
  // create a second ROW (a different day), not collide.
  const wednesday = await createLog(db, {
    day: "2026-09-02",
    fields: readLogFields({ text: "Stripped the forms" }),
    member: sarah.userId,
  });
  ok("a different day is a different row", wednesday.status === 201);
  ok("two days, two rows", db._rows.size === 2, db._rows.size);
  ok(
    "and each is filed against its own day",
    wednesday.body.log.day === "2026-09-02" && first.body.log.day === "2026-09-01",
  );

  // ── A CONCURRENT EDIT ───────────────────────────────────────────────────
  //
  // Sarah and Dave both have Tuesday open. Both loaded the same version.
  // Sarah's autosave lands. Dave's autosave must be REFUSED — not merged, not
  // silently applied over hers.
  const logId = first.body.log.id;
  const loaded = first.body.log.updatedAt.toISOString();

  const sarahSave = await patchLog(db, {
    logId,
    fields: readLogFields({ text: "Poured the slab. Finished 4pm." }),
    expectedRaw: loaded,
    member: sarah,
  });
  ok("Sarah's save lands", sarahSave.status === 200, sarahSave.status);

  const daveSave = await patchLog(db, {
    logId,
    fields: readLogFields({ text: "Slab. Rained." }),
    expectedRaw: loaded, // the version Dave loaded, now stale
    member: dave,
  });
  ok("Dave's autosave is REFUSED, not applied", daveSave.status === 409, daveSave.status);
  ok(
    "with the stale-write code, so the browser can offer a retry",
    daveSave.body.code === STALE_WRITE_CODE,
    daveSave.body.code,
  );
  ok(
    "and it names who saved over him",
    daveSave.body.conflict.byName === "Sarah Chen",
    daveSave.body.conflict.byName,
  );
  ok(
    "SARAH'S WORDS SURVIVE — this is the whole point",
    db._rows.get(logId).bodyText === "Poured the slab. Finished 4pm.",
    db._rows.get(logId).bodyText,
  );

  // A deliberate re-save against the version the server just named succeeds,
  // and is still guarded.
  const overwrite = await patchLog(db, {
    logId,
    fields: readLogFields({ text: "Slab. Rained." }),
    expectedRaw: daveSave.body.conflict.currentUpdatedAt,
    member: dave,
  });
  ok('"save mine anyway" then lands', overwrite.status === 200, overwrite.status);

  // A malformed version is a 400, never a 409 — answering "a colleague edited
  // this" to a request that was simply broken is a lie told confidently.
  const malformed = await patchLog(db, {
    logId,
    fields: {},
    expectedRaw: "0000",
    member: dave,
  });
  ok("a malformed version is a 400, not a 409", malformed.status === 400, malformed.status);

  // ── THE CONTROL ─────────────────────────────────────────────────────────
  //
  // The three assertions above prove the guarded path refuses. They do NOT on
  // their own prove the guard is what made the difference — a refusal could
  // come from anywhere. So the identical race is replayed with no version
  // sent, and the loss is asserted: Sarah's words go, silently, with a 200.
  //
  // That is the behaviour every unguarded PATCH in this API still has (96 of
  // 99 — see lib/concurrency/staleWrite.js), and it is what an autosaving
  // daily log would have shipped with. It is asserted rather than merely
  // described so that "missing means unguarded" stays a stated property
  // instead of quietly becoming "the guard doesn't work".
  {
    const control = makeDb();
    const seeded = await createLog(control, {
      day: "2026-09-01",
      fields: readLogFields({ text: "Poured the slab" }),
      member: sarah.userId,
    });
    const seededId = seeded.body.log.id;

    await patchLog(control, {
      logId: seededId,
      fields: readLogFields({ text: "Poured the slab. Finished 4pm." }),
      expectedRaw: undefined, // unguarded, like the other 96 routes
      member: sarah,
    });
    const blind = await patchLog(control, {
      logId: seededId,
      fields: readLogFields({ text: "Slab. Rained." }),
      expectedRaw: undefined,
      member: dave,
    });
    ok("UNGUARDED: the second write is accepted with a 200", blind.status === 200, blind.status);
    ok(
      "UNGUARDED: and Sarah's sentence is gone, with nothing anywhere saying so — this is the bug the guard closes",
      control._rows.get(seededId).bodyText === "Slab. Rained.",
      control._rows.get(seededId).bodyText,
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. DOCUMENTS — superseding, sizes, and who sees what
// ═══════════════════════════════════════════════════════════════════════════

section("6. a revision supersedes; both rows survive and the chain walks");

{
  // Rev A → Rev B → Rev C, plus an unrelated permit.
  const docs = [
    { id: "c", name: "Plan rev C", kind: "plan", supersedesId: "b", sizeBytes: 2_400_000 },
    { id: "b", name: "Plan rev B", kind: "plan", supersedesId: "a", sizeBytes: null },
    { id: "a", name: "Plan rev A", kind: "plan", supersedesId: null, sizeBytes: 900 },
    { id: "p", name: "Permit", kind: "permit", supersedesId: null, sizeBytes: 51_000 },
  ];

  const chains = revisionChains(docs);
  ok("three revisions collapse to one current document", chains.length === 2, chains.length);

  const plan = chains.find((c) => c.id === "c");
  ok("the head is the newest revision", plan.current.name === "Plan rev C");
  ok("BOTH older rows survive in the history", plan.history.length === 2, plan.history.length);
  ok(
    "and the chain walks newest → oldest",
    plan.history.map((d) => d.id).join(",") === "b,a",
    plan.history.map((d) => d.id).join(","),
  );
  ok("which is Rev 3", revisionCount(plan) === 3, revisionCount(plan));
  ok("an un-revised document is Rev 1", revisionCount(chains.find((c) => c.id === "p")) === 1);
  ok(
    "no row is destroyed — every id is still reachable",
    new Set([
      ...chains.map((c) => c.current.id),
      ...chains.flatMap((c) => c.history.map((d) => d.id)),
    ]).size === 4,
  );

  // A chain whose predecessor is invisible (a superseded CONTRACT, hidden from
  // a crew member) must keep its HEAD. Losing the current revision because its
  // history is out of reach would be absurd.
  const partial = revisionChains([{ id: "z", kind: "plan", supersedesId: "gone" }]);
  ok("a broken link keeps the head and truncates the history", partial.length === 1);
  ok("with an empty history rather than a crash", partial[0].history.length === 0);

  // A cycle survives the unique constraint (A→B→A) and must not hang a render.
  const cyclic = revisionChains([
    { id: "x", kind: "plan", supersedesId: "y" },
    { id: "y", kind: "plan", supersedesId: "x" },
  ]);
  ok("a cycle terminates rather than looping forever", Array.isArray(cyclic));

  ok("garbage in → empty out", revisionChains(null).length === 0);
}

section("7. null sizeBytes is not zero bytes");

{
  ok("null → nothing to print", formatBytes(null) === null);
  ok("undefined → nothing to print", formatBytes(undefined) === null);
  ok("negative → nothing to print", formatBytes(-1) === null);
  ok("NaN → nothing to print", formatBytes("banana") === null);
  ok("900 bytes prints in bytes", formatBytes(900) === "900 B", formatBytes(900));
  ok("2.4 MB prints one decimal", formatBytes(2_400_000) === "2.3 MB", formatBytes(2_400_000));
  ok("23 MB prints none", formatBytes(23_000_000) === "22 MB", formatBytes(23_000_000));

  // The write side: an unusable size stores as null, never as 0.
  ok("a missing size stores as null", normaliseSizeBytes(undefined) === null);
  ok("a zero size stores as NULL, not 0", normaliseSizeBytes(0) === null, normaliseSizeBytes(0));
  ok("a real size stores", normaliseSizeBytes(51_000) === 51_000);
  ok("an absurd size stores as null rather than a clamp", normaliseSizeBytes(9e12) === null);

  // And the renderer never prints a size it was not given.
  const panel = decomment(
    readFileSync(join(ROOT, "app/components/jobs/JobDocuments.js"), "utf8"),
  );
  ok(
    "JobDocuments.js prints a size only when formatBytes returned one",
    /size \? ` · \$\{size\}` : ""/.test(panel),
  );
  ok(
    "and never falls back to 0",
    !/sizeBytes\s*(\?\?|\|\|)\s*0/.test(panel),
  );
}

section("8. a crew member gets the plan and not the contract");

{
  const rows = [
    { id: "1", kind: "plan", supersedesId: null },
    { id: "2", kind: "permit", supersedesId: null },
    { id: "3", kind: "warranty", supersedesId: null },
    { id: "4", kind: "contract", supersedesId: null },
    { id: "5", kind: "invoice", supersedesId: null },
  ];

  const crew = visibleDocuments(rows, { canSeeMoney: false });
  ok("a crew member sees the plan", crew.documents.some((d) => d.kind === "plan"));
  ok("and the permit", crew.documents.some((d) => d.kind === "permit"));
  ok("and the warranty", crew.documents.some((d) => d.kind === "warranty"));
  ok("but NOT the contract", !crew.documents.some((d) => d.kind === "contract"));
  ok("and NOT the invoice", !crew.documents.some((d) => d.kind === "invoice"));
  ok(
    "and is told two exist rather than being shown an empty category",
    crew.hiddenCount === 2,
    crew.hiddenCount,
  );

  const office = visibleDocuments(rows, { canSeeMoney: true });
  ok("someone with pricing sees all five", office.documents.length === 5);
  ok("and nothing is reported hidden", office.hiddenCount === 0);

  ok("MONEY_KINDS is exactly contract + invoice", [...MONEY_KINDS].sort().join(",") === "contract,invoice");
  ok(
    "every money kind is a real kind",
    [...MONEY_KINDS].every((k) => DOCUMENT_KINDS.includes(k)),
  );
  ok("canSeeKind agrees with the set", canSeeKind("contract", { canSeeMoney: false }) === false);
  ok("and lets a plan through", canSeeKind("plan", { canSeeMoney: false }) === true);
}

section("9. the store only ever holds files that went through /api/upload");

{
  ok(
    "a Cloudinary URL on this cloud is accepted",
    isUploadedUrl("https://res.cloudinary.com/dq3x9k2mv/raw/upload/v1/x.pdf", {
      cloudName: "dq3x9k2mv",
    }),
  );
  ok(
    "another tenant's cloud is refused",
    !isUploadedUrl("https://res.cloudinary.com/someoneelse/raw/upload/v1/x.pdf", {
      cloudName: "dq3x9k2mv",
    }),
  );
  ok(
    "an arbitrary host is refused — a contract link to attacker.com is phishing filed in the back office",
    !isUploadedUrl("https://attacker.example/contract.pdf", { cloudName: "dq3x9k2mv" }),
  );
  ok("http is refused", !isUploadedUrl("http://res.cloudinary.com/c/x.pdf", { cloudName: "c" }));
  ok("javascript: is refused", !isUploadedUrl("javascript:alert(1)", { cloudName: "c" }));
  ok("a hostname that merely ENDS in the real one is refused", !isUploadedUrl("https://res.cloudinary.com.evil.test/x", { cloudName: "c" }));
  ok("garbage is refused", !isUploadedUrl("not a url", {}));
  ok(
    "an unset cloud name narrows to the host, never to everything",
    isUploadedUrl("https://res.cloudinary.com/anything/x.pdf", {}) &&
      !isUploadedUrl("https://elsewhere.test/x.pdf", {}),
  );

  ok("a known kind passes through", normaliseKind("permit") === "permit");
  ok("an absent kind takes the column default", normaliseKind(undefined) === "other");
  ok(
    "an UNKNOWN kind is refused rather than silently filed as 'other'",
    threw(() => normaliseKind("blueprint"))?.status === 400,
  );
  ok("a blank name gets a fallback, never an empty link", normaliseName("  ") === "Untitled");
  ok("a long name is clamped", normaliseName("x".repeat(500)).length === 200);
}

// ═══════════════════════════════════════════════════════════════════════════
// 10. READ — do the routes and the screens actually wire this up?
// ═══════════════════════════════════════════════════════════════════════════
//
// Every assertion below is scoped to ONE brace-matched handler body. A guard
// in a GET does not protect a PATCH, and a guard in a comment protects
// nothing — decomment() blanks the prose first.

section("10. the routes wire it up (source, scoped per handler)");

const src = (file) => decomment(readFileSync(join(ROOT, file), "utf8"));
const handler = (file, name) => {
  const found = handlerBodies(src(file)).find((h) => h.name === name);
  return found ? found.text : "";
};

{
  const LOGS = "app/api/jobs/[id]/daily-logs/route.js";
  const LOG = "app/api/jobs/[id]/daily-logs/[logId]/route.js";
  const DOCS = "app/api/jobs/[id]/documents/route.js";

  // ── The stale-write guard is INSIDE the where, not in an `if` above it ──
  const patch = handler(LOG, "PATCH");
  ok("PATCH parses the version off the body", /parseExpectedVersion\(/.test(patch));
  ok(
    "PATCH puts versionWhere INSIDE the update's where",
    /where:\s*\{\s*id:\s*logId,\s*\.\.\.versionWhere\(expected\)\s*\}/.test(patch),
  );
  ok("PATCH settles the outcome rather than 500ing", /settleGuardedWrite\(/.test(patch));
  ok(
    "PATCH refuses to move logDate — a re-dated log is not an edit",
    !/logDate/.test(patch.replace(/logDate is deliberately[\s\S]*?\n\n/, "")) ||
      !/data:\s*\{[^}]*logDate/.test(patch),
  );

  // ── The unique index is HANDLED, not swallowed ─────────────────────────
  const post = handler(LOGS, "POST");
  ok("POST catches P2002 specifically", /err\?\.code !== "P2002"/.test(post));
  ok("POST rethrows anything that is not P2002", /throw err/.test(post));
  ok("POST answers a duplicate day as a stale write", /staleWriteBody\(/.test(post));
  ok(
    "POST never upserts — an upsert would make the duplicate invisible",
    !/\.upsert\(/.test(post),
  );

  // ── Tenant + job scoping on every handler ──────────────────────────────
  for (const [file, name] of [
    [LOGS, "GET"],
    [LOGS, "POST"],
    [LOG, "PATCH"],
    [DOCS, "GET"],
    [DOCS, "POST"],
  ]) {
    const body = handler(file, name);
    ok(
      `${file.split("/").slice(-2).join("/")} ${name} scopes by the caller's company`,
      /companyId/.test(body),
    );
    ok(
      `${file.split("/").slice(-2).join("/")} ${name} narrows to the member's own jobs`,
      /assignedJobWhere\(/.test(body) || /ownJob\(/.test(body),
    );
    ok(
      `${file.split("/").slice(-2).join("/")} ${name} is gated on the jobs level`,
      /levelOrRefusal\(/.test(body),
    );
  }

  // ── The daily log is CREW work; documents are office work ──────────────
  ok(
    "the daily log POST is reachable at jobs:view_only (a crew member writes it)",
    /"view_only"/.test(handler(LOGS, "POST")),
  );
  ok(
    "and so is the PATCH",
    /"view_only"/.test(handler(LOG, "PATCH")),
  );
  ok(
    "filing a document requires jobs:view_create_edit",
    /"view_create_edit"/.test(handler(DOCS, "POST")),
  );

  // ── Money kinds are filtered on the SERVER, both directions ────────────
  ok(
    "the documents GET filters by kind before answering",
    /visibleDocuments\(/.test(handler(DOCS, "GET")),
  );
  ok(
    "and the POST refuses to FILE a kind the member cannot see",
    /canSeeKind\(/.test(handler(DOCS, "POST")),
  );
  ok(
    "the uploader's own URL is verified",
    /isUploadedUrl\(/.test(handler(DOCS, "POST")),
  );
  ok(
    "and an already-replaced document cannot be superseded twice",
    /already_superseded/.test(handler(DOCS, "POST")),
  );
  ok(
    "nothing in the document store deletes or overwrites a url",
    !/export async function DELETE/.test(src(DOCS)) &&
      !/jobDocument\.update\(/.test(src(DOCS)),
  );
  ok(
    "and nothing in the daily log store deletes",
    !/export async function DELETE/.test(src(LOG)),
  );

  // A route file that exports anything Next does not recognise fails the
  // build. LOG_SELECT and friends live in the lib for exactly that reason.
  for (const file of [LOGS, LOG, DOCS]) {
    const exported = [...src(file).matchAll(/^export\s+(?:async\s+function|const|function)\s+([A-Za-z0-9_]+)/gm)].map(
      (m) => m[1],
    );
    const allowed = new Set(["GET", "POST", "PATCH", "PUT", "DELETE", "runtime", "dynamic"]);
    ok(
      `${file.split("/").slice(-2).join("/")} exports only what Next allows`,
      exported.every((n) => allowed.has(n)),
      exported,
    );
  }

  ok(
    "LOG_SELECT is shared rather than copied into each route",
    Object.keys(LOG_SELECT).includes("bodyText") &&
      /LOG_SELECT/.test(src(LOGS)) &&
      /LOG_SELECT/.test(src(LOG)),
  );
}

section("11. the screens exist, are mounted, and send what the routes need");

{
  const detail = src("app/app/jobs/[id]/JobDetail.js");
  ok("DailyLog is mounted on the job page", /<DailyLog\s+jobId=/.test(detail));
  ok("JobDocuments is mounted on the job page", /<JobDocuments\s+jobId=/.test(detail));

  const panel = src("app/components/jobs/DailyLog.js");
  ok(
    "the panel sends the version it loaded on every save",
    /expectedUpdatedAt: expected/.test(panel),
  );
  ok(
    "the panel sends the DAY the browser computed, not an instant",
    /localDayKey\(/.test(panel) && /day\b/.test(panel),
  );
  ok(
    "the panel STOPS autosaving while a conflict is on screen",
    /if \(!dirty \|\| conflict \|\| saving\) return undefined/.test(panel),
  );
  ok(
    "and detects the conflict before the toast swallows it",
    /readStaleConflict\(res\)/.test(panel),
  );
  ok("and renders the banner the product already has", /StaleWriteBanner/.test(panel));
  ok(
    "and never leaves a failed fetch looking like an empty panel",
    /reportResponseError\(/.test(panel),
  );

  const docs = src("app/components/jobs/JobDocuments.js");
  ok(
    "the document panel uploads through the EXISTING /api/upload",
    /fetch\("\/api\/upload"/.test(docs),
  );
  ok(
    "and adds no second upload path",
    (src("app/api/jobs/[id]/documents/route.js").match(/formData\(/g) || []).length === 0,
  );
  ok(
    "the Add button is drawn only when the server said the POST would work",
    /data\.canUpload && !open/.test(docs),
  );
  ok(
    "the kind picker never offers a type whose POST would 403",
    /data\.canSeeMoney[\s\S]{0,120}MONEY_KINDS\.has/.test(docs),
  );
  ok(
    "there is no delete control anywhere in the document panel",
    !/method: "DELETE"/.test(docs),
  );
  ok(
    "a hidden-document count is shown rather than an empty list",
    /hiddenCount > 0/.test(docs),
  );
}

section("12. every string a crew member reads is in the catalogue, en + fr");

{
  const catalogue = readFileSync(join(ROOT, "app/i18n/appMessages.js"), "utf8");
  const files = [
    "app/components/jobs/DailyLog.js",
    "app/components/jobs/DailyLogEditor.js",
    "app/components/jobs/JobDocuments.js",
  ];
  const keys = new Set();
  for (const file of files) {
    for (const m of src(file).matchAll(/t\(\s*"(app\.[A-Za-z0-9_.]+)"/g)) keys.add(m[1]);
  }
  ok("the panels ask for at least 40 catalogue keys", keys.size >= 40, keys.size);

  // The French block starts at `const fr = {`; a key present before it and
  // absent after it is an English word on an otherwise French screen.
  const frStart = catalogue.indexOf("\nconst fr = {");
  ok("the French catalogue is where it was", frStart > 0);
  const en = catalogue.slice(0, frStart);
  const fr = catalogue.slice(frStart);
  for (const key of [...keys].sort()) {
    ok(`${key} — en`, en.includes(`"${key}"`));
    ok(`${key} — fr`, fr.includes(`"${key}"`));
  }

  // The kind labels are built by interpolation (`app.jobDocuments.kind.${k}`),
  // so the loop above cannot see them. Asserted by name instead.
  for (const kind of DOCUMENT_KINDS) {
    const key = `app.jobDocuments.kind.${kind}`;
    ok(`${key} — en`, en.includes(`"${key}"`));
    ok(`${key} — fr`, fr.includes(`"${key}"`));
  }
}

section("13. nothing here sends or spends");

{
  // Demo companies must not send or spend, and the seams are
  // lib/demo/simulatedSpend.js, lib/email/demoMail.js and lib/sms/demoSms.js.
  // Neither feature touches any of the three, because neither emails, texts,
  // nor buys anything — a daily log is a row, and a document goes through the
  // uploader every other panel on this page already uses. Asserted so a future
  // "email the day's log to the client" lands here first.
  for (const file of [
    "app/api/jobs/[id]/daily-logs/route.js",
    "app/api/jobs/[id]/daily-logs/[logId]/route.js",
    "app/api/jobs/[id]/documents/route.js",
  ]) {
    const body = src(file);
    ok(
      `${file.split("/").slice(-2).join("/")} sends no email`,
      !/sendEmail|resend|platformSender/i.test(body),
    );
    ok(
      `${file.split("/").slice(-2).join("/")} sends no SMS`,
      !/twilio|sendSms/i.test(body),
    );
    ok(
      `${file.split("/").slice(-2).join("/")} spends nothing`,
      !/stripe|checkout\.sessions|simulatedSpend/i.test(body),
    );
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
