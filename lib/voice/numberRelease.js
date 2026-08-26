// lib/voice/numberRelease.js
//
// Giving a number back — and PROVING it went back.
//
// ══ What "release" actually is at Retell ═══════════════════════════════════
//
// `releaseNumber()` is `DELETE /delete-phone-number/<e164>`. It is not a park,
// not a suspend, not a "cancel the subscription and keep the address". The
// number is deleted from FieldQuo's Retell account and returns to the carrier's
// pool, where anybody may buy it. FieldQuo stops paying for it; nobody can get
// it back. That answers the question this module was written for — we do not
// "own" a bought number in any sense that survives releasing it, and we do keep
// paying every month until we release it.
//
// Which makes the two failure directions asymmetric, and worth naming:
//
//   row says released, provider still has it  → FieldQuo pays for ever for a
//       number no tenant can see. Invisible, and the invisibility is the cost:
//       nothing in the app looks at a released row again.
//   row says active, provider does not have it → the contractor's line is dead
//       and the company is charged rent for it. Loud, and lib/voice/diagnose.js
//       already calls it `ghost`.
//
// So the rule here is one-directional: the DATABASE only ever moves to
// `released` after the PROVIDER has confirmed the number is gone. A 200 on the
// DELETE is not that confirmation — it is one HTTP status from somebody else's
// service — which is the same discipline syncNumberAttachment applies to a
// detach, and for the same reason. Read it back.
//
// ══ Why this is one module and not three call sites ════════════════════════
//
// Three things release numbers now: the rent cron past its grace period
// (lib/voice/spendGate.js), the contractor giving one up
// (app/api/settings/voice/number/release/route.js), and whatever comes next.
// The cron's version used to be the only one, and it trusted the 200. A second
// copy would have been the one that rots — AGENTS.md, recurring failure #4.
//
// ══ What is deliberately NOT decided here ══════════════════════════════════
//
// The unused part of the month already paid is not refunded, and this module
// does not invent a policy for it. Rent is taken 30 days in advance
// (RENT_PERIOD_DAYS); a company releasing on day 3 has 27 days of a $4 or $9
// rental left on the row. Handing it back, pro-rating it, or keeping it is a
// product decision, and the contractor-facing confirmation says plainly that
// nothing is refunded rather than staying quiet about it.
import { db } from "@/lib/db";
import { releaseNumber, getNumber, RetellError } from "./retell";

/**
 * The statuses that mean a company still HOLDS this row.
 *
 * Same three as heldNumber() in lib/voice/numbers.js, and deliberately the same
 * three: a row the duplicate guard counts is a row the company can give back.
 */
export const HELD_STATUSES = ["provisioning", "active", "porting"];

/**
 * May this number be released, and has the person said so clearly enough?
 *
 * Pure — a row, its siblings, and what the request claimed — so every refusal
 * is reachable from a check script without a database or a provider. The
 * dangerous branch here is the one nobody exercises by hand: an owner with one
 * working line, one click away from losing the number on their van.
 *
 * @param target   the VoicePhoneNumber row being given up
 * @param siblings every other VoicePhoneNumber row for the same company
 * @param confirm  the E.164 the caller typed/echoed back. Must match exactly.
 * @param acknowledgeSoleNumber  the SECOND confirmation, required only when
 *        this is the company's last working line.
 */
export function planRelease({
  target,
  siblings = [],
  confirm,
  acknowledgeSoleNumber = false,
} = {}) {
  if (!target?.e164) return { allowed: false, reason: "no_number" };

  // A row already `released` or `failed` is not theirs to give up, and running
  // the provider dance on it would DELETE a number some other company may since
  // have been sold out of the same pool.
  if (!HELD_STATUSES.includes(target.status)) {
    return { allowed: false, reason: "not_held", status: target.status };
  }

  // ── The number is named, by them, not by us ─────────────────────────────
  //
  // Not a checkbox. The one irreversible action in this product should require
  // the caller to say WHICH number, so a stray request built against the wrong
  // company — or a UI that lost track of which row it was showing — refuses
  // instead of destroying something. Compared against the E.164 rather than any
  // display form: `phone_number_pretty` is not an identifier.
  if (String(confirm || "").trim() !== target.e164) {
    return { allowed: false, reason: "confirm_mismatch" };
  }

  // "Working" means answering-capable, which is `active` and nothing else. A
  // row stuck on `provisioning` is exactly what the contractor is here to get
  // rid of, and making them clear a second gate for it would be theatre.
  const working = target.status === "active";
  const otherWorking = siblings.filter(
    (s) => s && s.id !== target.id && s.status === "active",
  ).length;
  const sole = working && otherWorking === 0;

  if (sole && !acknowledgeSoleNumber) {
    return { allowed: false, reason: "sole_number", soleNumber: true };
  }

  return { allowed: true, reason: "ok", soleNumber: sole };
}

/**
 * Is this number gone from the provider?
 *
 *   "gone"     the provider answered 404. Evidence of absence.
 *   "present"  the provider still returns it. Evidence it is still billing us.
 *   "unknown"  we could not ask. NOT evidence of anything — same three-state
 *              rule diagnose.js applies to `existsAtProvider`, for the same
 *              reason: absence of a reply is not a reply.
 */
export async function confirmGone(e164, { read = getNumber } = {}) {
  try {
    const live = await read(e164);
    // A 200 with no body is not a number. Treated as unknown rather than gone —
    // "the provider said nothing" must never be read as "the provider said no".
    return live ? "present" : "unknown";
  } catch (err) {
    if (err instanceof RetellError && err.status === 404) return "gone";
    return "unknown";
  }
}

/**
 * Delete the number at the provider and prove it is gone. Writes NOTHING.
 *
 * Split from the database write on purpose: every caller has to be unable to
 * mark a row released without having got `ok: true` out of here first.
 *
 * @returns { ok, confirmed, reason?, message?, alreadyGone? }
 *   ok:false / provider_refused  the DELETE itself failed. Nothing changed at
 *                                Retell, so nothing may change here.
 *   ok:false / still_present     the DELETE returned success and the number is
 *                                STILL there. The worst case, and the whole
 *                                reason for the read-back.
 *   ok:false / unconfirmed       the DELETE succeeded and the read-back could
 *                                not be made. Deliberately not treated as
 *                                success: the row stays held, so rent keeps
 *                                being charged and the reconciliation page
 *                                (/platform/voice-numbers) shows the mismatch,
 *                                rather than a released row quietly billing
 *                                FieldQuo for ever.
 */
export async function releaseAtProvider(
  e164,
  { release = releaseNumber, read = getNumber } = {},
) {
  try {
    await release(e164);
  } catch (err) {
    // A 404 on the DELETE is the provider telling us there is nothing to
    // delete, which is the state we were trying to reach. Confirmed by the
    // provider's own answer, so it counts — this is the `ghost` row that has
    // been costing nobody anything, and refusing to tidy it would strand the
    // company behind the duplicate guard for ever.
    if (err instanceof RetellError && err.status === 404) {
      return { ok: true, confirmed: true, alreadyGone: true };
    }
    return { ok: false, confirmed: false, reason: "provider_refused", message: err?.message || null };
  }

  const seen = await confirmGone(e164, { read });
  if (seen === "gone") return { ok: true, confirmed: true, alreadyGone: false };
  if (seen === "present") return { ok: false, confirmed: false, reason: "still_present" };
  return { ok: false, confirmed: false, reason: "unconfirmed" };
}

/** The one write. Kept separate so it can be swapped for a recorder in a check. */
async function writeReleased(id, data) {
  return db.voicePhoneNumber.update({ where: { id }, data });
}

/**
 * Release one held number: provider first, database only on proof.
 *
 * The single entry point. The rent cron and the contractor's own button both
 * come through here, so neither can acquire the ability to mark a row released
 * without the provider having agreed.
 *
 * `deps` exists for scripts/check-voice-number-release.mjs, which executes the
 * refusal paths against fakes and asserts the row was never touched. A release
 * that reports failure and writes anyway is precisely the bug this guards.
 */
export async function releaseHeldNumber(number, { now = new Date(), deps = {} } = {}) {
  const { release, read, write = writeReleased } = deps;
  if (!number?.id || !number?.e164) {
    return { ok: false, released: false, reason: "no_number" };
  }

  const at = await releaseAtProvider(number.e164, { release, read });
  if (!at.ok) return { ...at, released: false };

  await write(number.id, {
    status: "released",
    releasedAt: now,
    // Detached locally as well: the column is a foreign key to VoiceAgent and a
    // released number answers for nobody.
    agentId: null,
    // The past-due machinery is over. Left set, a stale grace date would make a
    // re-read of this row look like a number about to be taken away.
    rentGraceUntilAt: null,
    rentWarnedAt: null,
  });

  // `rentPaidThroughAt` is deliberately left where it is: it is the record of
  // what was actually paid for, and rentDecision skips any row whose status is
  // not `active`, so nothing reads it again. Nulling it would erase the one
  // fact anyone answering "was this month charged?" needs.
  return { ok: true, released: true, confirmed: true, alreadyGone: Boolean(at.alreadyGone) };
}
