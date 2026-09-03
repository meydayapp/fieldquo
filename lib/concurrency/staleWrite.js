// lib/concurrency/staleWrite.js
//
// Optimistic concurrency for the records that are worth money.
//
// ══ The bug this closes ════════════════════════════════════════════════════
//
// Two people open the same quote. The estimator saves at 14:02. The owner —
// who loaded the page at 13:58 — saves at 14:03. The owner's PATCH carries the
// whole form, so every field the estimator changed is overwritten with the
// values the owner's browser loaded five minutes earlier. Nothing errors. No
// status is wrong. There is no record anywhere that it happened. The estimator
// finds out when a client questions a price.
//
// docs/construction/AUDIT-realtime-hosting.md found this across all 99
// PATCH/PUT routes and named it correctly: the owner's request for "a banner
// notifying when a document has been updated by someone else in the team" IS
// optimistic concurrency. This file is that banner's server half.
//
// ══ The mechanism, and why this one ════════════════════════════════════════
//
// The client sends back the `updatedAt` it loaded. The write is conditional on
// that value still being the stored one — the guard goes in the WHERE clause,
// not in an `if` above the write, so there is no window between checking and
// writing. That is the same compare-and-set grain the codebase already uses
// for claims (app/api/cron/review-requests: `updateMany({ where: { id,
// reviewRequestedAt: null } })`, lib/migrations/payment.js: `updateMany({
// where: { id, status: "accepted" } })`) — a guard expressed as part of the
// write, where a count of 0 (or here a P2025) IS the refusal.
//
// Why `updatedAt` and not a `version Int`: 64 of the 167 models already carry
// `@updatedAt`, so the guarded routes need no schema change and no backfill. A
// version column would be tidier and is not worth a migration on every table.
// The brief for this work said "every model already has updatedAt" — that is
// not true (103 do not, including Client and Product), which is why the
// guarded set is the one it is. See docs/construction/AUDIT-realtime-hosting.md.
//
// Why a body field and not `If-Unmodified-Since`: that header is defined with
// one-SECOND resolution. Two saves inside the same second — routine when a
// page saves on blur — would compare equal and the guard would wave the second
// one through. The stored value is millisecond-precision; the wire format has
// to be too.
//
// ══ MISSING MEANS UNGUARDED, ON PURPOSE ════════════════════════════════════
//
// A request that sends no `expectedUpdatedAt` behaves exactly as it did before
// this file existed. That is what makes the migration gradual: 96 screens this
// change has not touched keep working, and a screen opts in by sending the
// field. scripts/check-stale-write.mjs asserts the unguarded path still
// succeeds, because a guard that quietly breaks every untouched caller is a
// worse outcome than the data loss it prevents.
//
// A MALFORMED value is different and is refused with a 400. Reading "2026-13-45"
// as "no guard" would silently downgrade protection on the strength of a typo,
// which is the same class of mistake as padding absent data with a default.
//
// ══ No imports, on purpose ═════════════════════════════════════════════════
//
// Not even lib/db. Every function here either is pure or takes its Prisma
// client as an argument, so scripts/check-stale-write.mjs EXECUTES this exact
// file — no stub loader, no copy, no "the check tested something shaped like
// the shipped code". It also means the two constants the browser needs
// (STALE_WRITE_CODE, VERSION_FIELD) can be imported from a client component
// without dragging a database pool into the bundle.

/** The body field a client sends. One name, so no route invents a second. */
export const VERSION_FIELD = "expectedUpdatedAt";

/**
 * The refusal's machine-readable code.
 *
 * A bare 409 is not enough: this API already answers 409 for "that quote has
 * an invoice", "the migration was cancelled", "this number is still in use".
 * A client cannot tell those apart from a stale write, and a stale write is
 * the only 409 it can offer to RETRY. Hence `code`, which this codebase
 * already uses for exactly this purpose (`seat_limit`, `email_sections_empty`).
 */
export const STALE_WRITE_CODE = "stale_write";

/** Refusal code for a version string the server cannot read. Never a 409. */
export const BAD_VERSION_CODE = "bad_version";

/**
 * How far ahead of the server's clock a version may be before it is treated as
 * malformed rather than merely stale.
 *
 * A legitimate `expectedUpdatedAt` is a value THIS product generated, so it is
 * always in the past. But Vercel runs many instances, and a row written 3ms
 * ago by an instance whose clock is a few tens of milliseconds ahead is a
 * genuine, honest, future-dated version. A minute is far outside real NTP
 * skew and far inside "somebody sent us a timestamp from 2027".
 */
export const FUTURE_SKEW_MS = 60_000;

function badRequest(message) {
  const err = new Error(message);
  err.status = 400;
  err.code = BAD_VERSION_CODE;
  return err;
}

/**
 * Read the client's claimed version out of a request body.
 *
 * @returns {Date|null} null when the request is UNGUARDED (see the header).
 * @throws  a 400-carrying Error when the value is present but unusable.
 */
export function parseExpectedVersion(raw, { now = Date.now() } = {}) {
  // Absent, explicitly null, or empty string — all "this caller doesn't
  // participate". Empty string is included because a client building the body
  // from `quote.updatedAt ?? ""` has said nothing, not something.
  if (raw === undefined || raw === null || raw === "") return null;

  if (raw instanceof Date) {
    if (Number.isNaN(raw.getTime())) throw badRequest(UNREADABLE);
    return checkFuture(raw, now);
  }

  // Deliberately NOT accepting a number. Epoch seconds and epoch milliseconds
  // are both plausible readings of `1789200000`, they differ by a factor of
  // 1000, and guessing wrong turns a guard into either a permanent 409 or a
  // permanent pass. An ISO string has no such ambiguity.
  if (typeof raw !== "string") throw badRequest(UNREADABLE);

  // Full ISO-8601 date-time only, with a zone. `new Date()` alone is far too
  // forgiving: it reads "0000" as the year 0 and "2026" as midnight on New
  // Year, both of which are VALID dates and would therefore sail past a plain
  // NaN check — and then be refused as a 409 saying a colleague edited the
  // record, which is a lie about a request that was simply malformed.
  // scripts/check-stale-write.mjs found exactly that with "0000".
  //
  // The only value a client should ever send here is what
  // Date.prototype.toISOString() produced on the way out, so this is the
  // format, not a subset of one.
  if (!ISO_INSTANT.test(raw)) throw badRequest(UNREADABLE);

  const parsed = new Date(raw);
  // The regex accepts the SHAPE; this rejects the impossible dates that fit it
  // ("2026-13-45T00:00:00.000Z").
  if (Number.isNaN(parsed.getTime())) throw badRequest(UNREADABLE);

  return checkFuture(parsed, now);
}

const ISO_INSTANT =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/;

const UNREADABLE =
  "That save carried a version this server can't read. Reload the page and try again.";

function checkFuture(date, now) {
  if (date.getTime() - now > FUTURE_SKEW_MS) {
    // Refused as malformed (400), NOT as a conflict (409). A future timestamp
    // is not evidence that a colleague edited anything, and answering "Sarah
    // changed this" to a client that sent nonsense would be a lie told
    // confidently. It is also the shape a bypass attempt would take.
    throw badRequest(
      "That save carried a version dated in the future. Reload the page and try again.",
    );
  }
  return date;
}

/**
 * The guard, as a fragment to spread into a Prisma `where`.
 *
 *     await db.quote.update({
 *       where: { id, ...versionWhere(expected) },
 *       data,
 *     })
 *
 * Empty when unguarded, which is what makes the opt-in gradual. Prisma's
 * extended `where` on `update` accepts non-unique filters alongside the unique
 * one and raises P2025 when nothing matches — see isVersionMiss below.
 */
export function versionWhere(expected) {
  return expected ? { updatedAt: expected } : {};
}

/** Prisma's "the record I was told to write wasn't there" error. */
export function isVersionMiss(err) {
  return err?.code === "P2025";
}

function sameInstant(a, b) {
  return Boolean(a) && Boolean(b) && a.getTime() === b.getTime();
}

/**
 * Run a write whose `where` carries versionWhere(expected), and turn a version
 * miss into a described outcome instead of a 500.
 *
 * @param {object}   o
 * @param {Date|null} o.expected     from parseExpectedVersion
 * @param {Function} o.write         performs the write; must include the guard
 * @param {Function} o.readVersion   re-reads `{ updatedAt }`, or null if gone
 *
 * @returns {{ok:true,result:*}}
 *        | {{ok:false,reason:"stale",currentUpdatedAt:Date}}
 *        | {{ok:false,reason:"gone"}}
 *
 * Anything that is not provably a version miss is RE-THROWN. That matters:
 * P2025 is also what Prisma raises when a nested `connect` points at a row
 * that isn't there, and reporting an unrelated bug as "a colleague edited
 * this" would send someone hunting for a colleague who doesn't exist. The
 * re-read below is what separates the two — if the stored version is still
 * exactly the one the caller expected, the write failed for some other reason
 * and the error belongs in the log, not in a banner.
 */
export async function runGuardedWrite({ expected, write, readVersion }) {
  try {
    return { ok: true, result: await write() };
  } catch (err) {
    if (!isVersionMiss(err)) throw err;

    const current = await readVersion();

    // The row is gone. True for a guarded and an unguarded write alike, and a
    // different thing from "somebody edited it" — there is nothing to reload
    // and nothing to re-apply onto.
    if (!current) return { ok: false, reason: "gone" };

    // No guard was asked for, so no guard can have failed.
    if (!expected) throw err;

    // The version the caller expected is still the stored one, so the write
    // did not lose a race. Not ours.
    if (sameInstant(current.updatedAt, expected)) throw err;

    return { ok: false, reason: "stale", currentUpdatedAt: current.updatedAt };
  }
}

/**
 * Who produced the version currently stored — or an honest "we don't know".
 *
 * Pure, and the only place the naming rule lives. A RecordEdit row is trusted
 * ONLY when its `versionAt` is still the record's `updatedAt`. Any other
 * writer — a lifecycle hook, the public quote-acceptance route, a cron sweep —
 * moves `updatedAt` without leaving a RecordEdit row, and the equality check is
 * what stops the banner naming the last person who happened to use a guarded
 * screen. See the RecordEdit model comment in schema.prisma.
 */
export function resolveEditor({ edit, currentUpdatedAt, viewerUserId }) {
  if (!edit || !currentUpdatedAt) return UNKNOWN_EDITOR;
  if (!sameInstant(edit.versionAt, currentUpdatedAt)) return UNKNOWN_EDITOR;
  return {
    known: true,
    name: edit.editorName || null,
    // The same person, from another tab, phone or laptop. A real and common
    // case, and it deserves a calmer sentence than "a colleague overwrote you"
    // — which is why the client gets this flag rather than just a name.
    byYou: Boolean(viewerUserId && edit.editorUserId === viewerUserId),
  };
}

const UNKNOWN_EDITOR = { known: false, name: null, byYou: false };

/**
 * The 409 body.
 *
 * `error` is English, like every other refusal string this API returns — the
 * SENTENCE the user reads is composed client-side from `conflict` through
 * t(), so it lands in their own language (app.staleWrite.* in
 * app/i18n/appMessages.js). This field is the fallback for anything that only
 * knows how to read `error`, and for the server log.
 */
export async function staleWriteBody(
  client,
  { companyId, entityType, entityId, label, expected, currentUpdatedAt, viewerUserId },
) {
  const editor = resolveEditor({
    edit: await loadEdit(client, { companyId, entityType, entityId }),
    currentUpdatedAt,
    viewerUserId,
  });

  const who = editor.byYou
    ? "You"
    : editor.name
      ? editor.name
      : "Someone on your team";

  return {
    error:
      `${who} saved changes to this ${label} after you opened it, ` +
      `so saving now would overwrite them.`,
    code: STALE_WRITE_CODE,
    conflict: {
      entity: entityType,
      id: entityId,
      // Both sides, so the client can show "you loaded X, it now says Y" and
      // can re-submit deliberately against the version it was just told about.
      expectedUpdatedAt: expected ? expected.toISOString() : null,
      currentUpdatedAt: currentUpdatedAt.toISOString(),
      byName: editor.name,
      byYou: editor.byYou,
      // Distinguished from `byName: null` on purpose: "we know it was nobody
      // nameable" and "we don't know" are different statements, and the client
      // says different things for them.
      knownEditor: editor.known,
    },
  };
}

async function loadEdit(client, { companyId, entityType, entityId }) {
  try {
    return await client.recordEdit.findUnique({
      where: {
        companyId_entityType_entityId: { companyId, entityType, entityId },
      },
    });
  } catch (err) {
    // Best-effort, exactly like lib/activity/log.js: not knowing who edited a
    // quote must never turn a refusal that protects data into a 500 that
    // doesn't. The banner degrades to "someone on your team".
    console.error("[staleWrite] editor lookup failed:", err?.message);
    return null;
  }
}

/**
 * Record who produced the version that is now stored.
 *
 * Called AFTER the write commits, with the row's fresh `updatedAt`. Never
 * throws — same contract lib/activity/log.js states and for the same reason: a
 * failure to record who saved must not fail, or roll back, the save itself.
 * The cost of a miss is one banner that says "someone on your team".
 */
export async function recordEdit(
  client,
  { companyId, entityType, entityId, editorUserId, editorName, versionAt },
) {
  try {
    if (!companyId || !entityType || !entityId || !versionAt) return;

    let name = editorName || null;
    if (!name && editorUserId) {
      const user = await client.user.findUnique({
        where: { id: editorUserId },
        select: { name: true, email: true },
      });
      // Frozen at write time. A rename or a departed employee must not erase
      // who held this version — same reasoning as ActivityLog.actorName.
      name = user?.name || user?.email || null;
    }

    const row = {
      editorUserId: editorUserId || null,
      editorName: name,
      versionAt,
    };

    await client.recordEdit.upsert({
      where: {
        companyId_entityType_entityId: { companyId, entityType, entityId },
      },
      create: { companyId, entityType, entityId, ...row },
      update: row,
    });
  } catch (err) {
    console.error("[staleWrite] recordEdit failed:", err?.message);
  }
}

/**
 * Everything a guarded route does after its write, in one call.
 *
 * Success: records the editor and hands back the result.
 * Stale:   builds the 409 body.
 * Gone:    builds the 404 body.
 *
 * Kept together so a route cannot record the editor and forget the refusal, or
 * the other way round — the two are one decision, and splitting them across
 * three routes is how the copies would drift (AGENTS.md failure class #4).
 */
export async function settleGuardedWrite(
  outcome,
  { client, companyId, entityType, entityId, label, expected, member, versionAt },
) {
  if (outcome.ok) {
    await recordEdit(client, {
      companyId,
      entityType,
      entityId,
      editorUserId: member?.userId || null,
      versionAt,
    });
    return null;
  }

  if (outcome.reason === "gone") {
    return {
      status: 404,
      body: { error: `That ${label} no longer exists — someone deleted it.` },
    };
  }

  return {
    status: 409,
    body: await staleWriteBody(client, {
      companyId,
      entityType,
      entityId,
      label,
      expected,
      currentUpdatedAt: outcome.currentUpdatedAt,
      viewerUserId: member?.userId || null,
    }),
  };
}
