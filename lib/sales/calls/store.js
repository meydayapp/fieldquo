// lib/sales/calls/store.js
//
// The database half of call handling, and the honest answer while its tables
// do not exist yet.
//
// ══ THE TABLES LANDED ON 2026-09-03 ══════════════════════════════════════
//
// `SalesCallAttempt` and `SalesRepActivity` are now in prisma/schema.prisma
// and pushed. lib/sales/calls/schema.pending.prisma is kept as the annotated
// rationale for every column — it is no longer pending, and its header says so.
//
// **Nothing in this file changed when they landed, and that was the point.**
// This module answers `callStoreState()` from the GENERATED PRISMA CLIENT
// rather than from a constant — the same move lib/sales/playbook/store.js
// makes, for the reason its header gives: a hard-coded "not ready yet" goes
// stale the day the models land and leaves a check asserting the wrong thing.
// The probe is kept rather than ripped out now that it returns true, because
// it is what makes a deployment whose client is a generation behind say so
// instead of throwing `undefined is not a function` at a rep mid-dial.
//
// What the probe still governs:
//
//   - `attemptsLast24h` returns null when the delegate is absent, so
//     `salesCallReadiness` puts the Oklahoma/Florida cap into `unenforced` and
//     the screen says so in the rep's own words rather than showing a cleared
//     cap it never counted.
//   - Every write refuses, loudly, naming the models. No control renders. A
//     `Coming soon` panel is honest; a disposition picker that throws is not.
//
// ══ null is not zero, here more than anywhere ══════════════════════════════
//
// `attemptsLast24h` returning 0 means "we counted and nobody has rung them".
// Returning null means "nothing counts". salesCallReadiness treats those
// completely differently — one enforces a cap with a private right of action
// behind it, the other reports that it cannot — so this module never converts
// one into the other, and never catches a query error into a zero.

import { db } from "@/lib/db";
import { normalisePhone } from "../suppressionRules";
import { suppressWithin } from "../suppression";
import {
  CLAIM_HOLD,
  CLAIM_RELEASE,
  CLAIM_WORKED,
  attemptsWithin24h,
  planDisposition,
} from "./dispositions";
import {
  STATE_OFFLINE,
  canTransition,
  isRepState,
  livePresence,
} from "./agentState";

/**
 * The delegates this module needs, keyed by the name that can actually be
 * probed on the client. A model absent from the schema has no delegate, which
 * is more truthful than reading the schema file at runtime.
 */
export const REQUIRED_MODELS = Object.freeze({
  salesCallAttempt: "SalesCallAttempt",
  salesRepActivity: "SalesRepActivity",
});

export const PENDING_SCHEMA_FILE = "lib/sales/calls/schema.pending.prisma";

/** Thrown by every write path while the tables are absent. Never swallowed. */
export class CallStoreUnavailable extends Error {
  constructor(missing) {
    super(
      `Call handling is not in the database yet. Missing: ${missing.join(", ")}. ` +
        `The definitions are ready in ${PENDING_SCHEMA_FILE}; add them to prisma/schema.prisma ` +
        "and run `npx prisma db push`.",
    );
    this.name = "CallStoreUnavailable";
    this.missing = missing;
  }
}

/**
 * Computed every time, never cached. A build regenerates the client, and a
 * cached "not ready" would outlive the thing it describes.
 */
export function callStoreState(client = db) {
  const missing = Object.entries(REQUIRED_MODELS)
    .filter(([delegate]) => !client?.[delegate])
    .map(([, model]) => model);
  return { ready: missing.length === 0, missing, pendingSchemaFile: PENDING_SCHEMA_FILE };
}

function requireStore(client = db) {
  const state = callStoreState(client);
  if (!state.ready) throw new CallStoreUnavailable(state.missing);
  return client;
}

// ═══════════════════════════════════════════════════════════════════════════
// Attempts
// ═══════════════════════════════════════════════════════════════════════════

/**
 * How many calls have been placed to this number in the last 24 hours — by
 * ANY rep.
 *
 * The cap is per called party. lib/sales/callingRules.js already prints that
 * in its refusal ("the cap is per called party, not per rep") and this is the
 * query that has to agree with it, so there is deliberately no salesRepId
 * parameter to pass by mistake.
 *
 * Returns null — never 0 — when the tables are absent or the number is
 * unusable. A zero here would tell salesCallReadiness that the cap has been
 * counted and cleared.
 *
 * ── Outbound only, and that is not a detail ─────────────────────────────
 *
 * Oklahoma and Florida cap the calls a SELLER PLACES. A contractor ringing
 * FieldQuo back three times has placed three calls of their own and consumed
 * none of that allowance, so counting inbound rows here would refuse a rep the
 * right to return a call the prospect asked for. The filter was harmless the
 * day it was written — every row was outbound — and became load-bearing the
 * moment app/api/rep-dial/inbound started writing rows into the same table.
 */
export async function attemptsLast24h(toE164, { now = new Date(), client = db } = {}) {
  if (!callStoreState(client).ready) return null;
  const phone = normalisePhone(toE164);
  if (!phone) return null;

  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const rows = await client.salesCallAttempt.findMany({
    where: { toE164: phone, direction: "out", dialledAt: { gt: since, lte: now } },
    select: { dialledAt: true },
  });
  // Counted through the pure function rather than with `count`, so the
  // boundary arithmetic the check script executes is the arithmetic that runs.
  return attemptsWithin24h(rows, now);
}

/**
 * Record that a rep pressed the call button.
 *
 * ── Written BEFORE the call, and that is the whole point ────────────────
 *
 * See dispositions.js: the cap counts calls, not conversations. The row exists
 * with a null disposition from the moment the rep asks to dial.
 *
 * ── The gate's answer is frozen into the row ────────────────────────────
 *
 * `readiness` is the object salesCallReadiness returned for this dial. Only
 * `allowed` produces a row — the caller has already refused otherwise, and
 * this refuses again rather than trusting it, because a second check costing
 * one comparison is cheaper than one unlawful call.
 */
export async function recordDial({
  salesRepId,
  prospectId = null,
  leadId = null,
  toE164,
  fromE164 = null,
  dialChannel = "handset",
  readiness = null,
  playbook = null,
  now = new Date(),
  client = db,
} = {}) {
  requireStore(client);

  const phone = normalisePhone(toE164);
  if (!phone) {
    return { ok: false, error: "That is not a number this build can dial.", attempt: null };
  }
  if (!salesRepId) {
    return { ok: false, error: "A call attempt has to belong to a rep.", attempt: null };
  }
  if (!readiness || readiness.decision !== "allowed") {
    return {
      ok: false,
      error:
        "The calling gate has not cleared this number, so no attempt was recorded and none should be made.",
      attempt: null,
    };
  }

  const attempt = await client.salesCallAttempt.create({
    data: {
      salesRepId,
      prospectId: prospectId || null,
      leadId: leadId || null,
      toE164: phone,
      fromE164: normalisePhone(fromE164) || null,
      direction: "out",
      // Never inferred from whether fromE164 happens to be set. A caller that
      // could not say which door the call went through gets the one whose
      // provider columns are expected to stay null forever, so an unmeasured
      // call can never be counted among the measured ones.
      dialChannel: dialChannel === "browser" ? "browser" : "handset",
      dialledAt: now,
      jurisdictionCode: readiness.jurisdiction?.code || null,
      decisionAtDial: readiness.decision,
      windowText: readiness.windowText || null,
      prospectTimeZone: Array.isArray(readiness.zones) ? readiness.zones[0] || null : null,
      timeZoneSource: readiness.zoneSource || null,
      playbookKey: playbook?.playbookKey || null,
      playbookVersion: playbook?.playbookVersion || null,
      experimentKey: playbook?.experimentKey || null,
      variantKey: playbook?.variantKey || null,
    },
  });

  return { ok: true, error: null, attempt };
}

/**
 * What goes in `toE164` when the caller withheld their number.
 *
 * Not a phone number and not shaped like one, on purpose — see recordInbound.
 * Exported so a screen printing the column can recognise it rather than
 * rendering the raw word beside real numbers as though it were one.
 */
export const WITHHELD_NUMBER = "withheld";

/**
 * The last time a rep rang THIS number FROM THIS number of ours.
 *
 * ══ Why the pair, and not just the caller ═════════════════════════════════
 *
 * FieldQuo holds a POOL of sales_voice numbers, local to the areas reps are
 * working, precisely so a contractor in Tulsa sees a 918 number. A contractor
 * ringing back is ringing back the ONE of those numbers that appeared on their
 * handset, and the rep who put it there is the rep who used that number to
 * call them. Matching on the caller alone would answer "who last rang this
 * business", which is a different and occasionally wrong question — two reps
 * working the same list from two different numbers would hand the callback to
 * whichever dialled most recently rather than to the one whose number is on
 * the screen the contractor is looking at.
 *
 * Outbound rows only, for the obvious reason: a previous inbound leg is the
 * contractor ringing us, and reading a rep off it would be circular.
 *
 * Returns null when nothing matches. Null is the honest answer for a stranger.
 */
export async function lastOutboundBetween({
  contactE164,
  ourE164,
  client = db,
} = {}) {
  if (!callStoreState(client).ready) return null;
  const to = normalisePhone(contactE164);
  const from = normalisePhone(ourE164);
  if (!to || !from) return null;

  return client.salesCallAttempt.findFirst({
    where: { toE164: to, fromE164: from, direction: "out" },
    orderBy: { dialledAt: "desc" },
    select: { id: true, salesRepId: true, prospectId: true, leadId: true, dialledAt: true },
  });
}

/**
 * One of FieldQuo's sales_voice numbers, by the number that was dialled.
 *
 * Scoped to `purpose: "sales_voice"` and `active: true` in the WHERE rather
 * than read and checked afterwards, so a number that has been handed back, or
 * one whose purpose is `system` (which sends on behalf of TENANTS — see the
 * model's own note on why a STOP arriving at each means different things),
 * resolves to nothing at all instead of to a row a branch might still use.
 */
export async function salesVoiceNumber(e164, { client = db } = {}) {
  const phone = normalisePhone(e164);
  if (!phone) return null;
  return client.platformSmsNumber.findFirst({
    where: { e164: phone, purpose: SALES_VOICE_PURPOSE, active: true },
    select: { id: true, e164: true, purpose: true, active: true, voiceUrl: true },
  });
}

/**
 * File the fact that a contractor rang one of our numbers back.
 *
 * ══ Written BEFORE anything is answered ═══════════════════════════════════
 *
 * The same discipline recordDial() states for the outbound leg, for the same
 * reason turned around: a row written only when a transfer connects would miss
 * every call nobody picked up, and those are the calls that matter most. The
 * most qualified inbound call this business receives is a missed one.
 *
 * ══ NO calling-window check, deliberately ═════════════════════════════════
 *
 * recordDial() refuses without an `allowed` readiness because it records a
 * call FieldQuo is about to place. This records a call somebody placed to us.
 * Requiring readiness here would refuse to write down a prospect ringing at
 * 21:00 — which would not stop the call, only stop the record of it. See
 * lib/sales/calls/inboundRouting.js's header.
 *
 * ══ Idempotent on Twilio's CallSid ════════════════════════════════════════
 *
 * Twilio retries a webhook it did not get a clean answer to, and every retry
 * carries the same CallSid. `providerCallSid` is @unique, so an upsert keyed
 * on it turns a redelivery into a no-op instead of a second call in the log
 * and on the floor board. With no CallSid — which should not happen, and is
 * not a reason to lose the row — it falls back to a plain create.
 *
 * @param salesRepId  the rep to attribute this to, or null when nobody
 *                    matched. Null is permitted HERE and nowhere else; see the
 *                    schema note on the column.
 */
export async function recordInbound({
  salesRepId = null,
  prospectId = null,
  leadId = null,
  contactE164,
  ourE164,
  providerCallSid = null,
  matchedBy = null,
  now = new Date(),
  client = db,
} = {}) {
  requireStore(client);

  const to = normalisePhone(contactE164);
  const from = normalisePhone(ourE164);
  if (!from) {
    return { ok: false, error: "An inbound row has to name the number that was rung.", attempt: null };
  }

  const data = {
    salesRepId: salesRepId || null,
    prospectId: prospectId || null,
    leadId: leadId || null,
    // A withheld caller ID is not a number, and the column is required. A
    // plausible-looking placeholder — "+10000000000" — would be a phone number
    // as far as every reader and every query is concerned, which is AGENTS.md
    // failure class 5 written into the one column the calling cap keys on. So
    // the sentinel is deliberately NOT E.164-shaped: normalisePhone() rejects
    // it, so no lookup can ever match it, and a human reading the row sees the
    // word rather than a number nobody has.
    toE164: to || WITHHELD_NUMBER,
    fromE164: from,
    direction: "in",
    dialChannel: "inbound",
    dialledAt: now,
    matchedBy: matchedBy || null,
    // The gate columns stay null. They record the answer salesCallReadiness
    // gave for a call FieldQuo placed, and it was never asked one here.
    // `decisionAtDial` has a database default of "allowed" and is written
    // explicitly to "inbound" so no inbound row can ever be read as a calling
    // decision that was taken and cleared.
    decisionAtDial: "inbound",
    providerCallSid: providerCallSid || null,
  };

  if (!providerCallSid) {
    const attempt = await client.salesCallAttempt.create({ data });
    return { ok: true, error: null, attempt, deduped: false };
  }

  const attempt = await client.salesCallAttempt.upsert({
    where: { providerCallSid },
    create: data,
    // Empty on purpose. A retry is the same call, and rewriting the row would
    // move `dialledAt` to whenever Twilio happened to try again.
    update: {},
  });
  const existing =
    attempt?.dialledAt instanceof Date && attempt.dialledAt.getTime() !== now.getTime();
  return { ok: true, error: null, attempt, deduped: existing };
}

/**
 * Today's inbound calls, for the superadmin floor board.
 *
 * Queried by DIRECTION rather than by rep, which is the whole reason it is a
 * separate function: an inbound call that matched nobody has a null
 * salesRepId, so the board's `salesRepId: { in: repIds }` query cannot see it,
 * and a call from a stranger who rang the sales line is exactly the row a
 * superadmin wants to notice.
 */
export async function inboundCalls({ from, to = new Date(), client = db } = {}) {
  if (!callStoreState(client).ready) return null;
  return client.salesCallAttempt.findMany({
    where: { direction: "in", dialledAt: { gte: from, lte: to } },
    orderBy: { dialledAt: "desc" },
    take: 100,
    select: {
      id: true,
      toE164: true,
      fromE164: true,
      dialledAt: true,
      matchedBy: true,
      salesRepId: true,
      prospectId: true,
      disposition: true,
      talkSeconds: true,
      providerStatus: true,
      salesRep: { select: { name: true } },
      prospect: { select: { businessName: true } },
    },
  });
}

/**
 * Write what the carrier reported onto the attempt it belongs to.
 *
 * ── Matched on the attempt id we put in the bridge, not on the number ────
 *
 * The status callback carries our own `attemptId` because the bridge request
 * put it there. Matching on `To` instead would attach a call to whichever
 * attempt to that number happened to be newest, and two reps ringing the same
 * business a minute apart is exactly the case that has to be right.
 *
 * ── Idempotent, because Twilio retries ──────────────────────────────────
 *
 * The same status can arrive twice. `providerCallSid` is @unique and this
 * upserts fields rather than accumulating them, so a redelivery overwrites
 * with identical values instead of doubling a duration.
 *
 * Never touches the disposition. What the network says and what the rep says
 * are two statements about one call, and the case where they disagree is the
 * interesting one.
 */
export async function attachProviderCall({
  attemptId,
  providerCallSid = null,
  providerStatus = null,
  ringingAt = null,
  answeredAt = null,
  endedAt = null,
  talkSeconds = null,
  providerCostCents = null,
  client = db,
} = {}) {
  if (!callStoreState(client).ready || !attemptId) return { ok: false, updated: 0 };

  const data = {};
  if (providerCallSid) data.providerCallSid = providerCallSid;
  if (providerStatus) data.providerStatus = providerStatus;
  if (ringingAt) data.ringingAt = ringingAt;
  if (answeredAt) data.answeredAt = answeredAt;
  if (endedAt) data.endedAt = endedAt;
  // Zero is a real answer here — a call that connected and lasted no seconds —
  // so the guard is on finiteness, not on truthiness.
  if (Number.isFinite(talkSeconds)) data.talkSeconds = talkSeconds;
  if (Number.isFinite(providerCostCents)) data.providerCostCents = providerCostCents;
  if (Object.keys(data).length === 0) return { ok: true, updated: 0 };

  const res = await client.salesCallAttempt.updateMany({ where: { id: attemptId }, data });
  return { ok: true, updated: res.count };
}

/**
 * Apply an outcome to an attempt, and everything that follows from it.
 *
 * ── One transaction, or none of it ───────────────────────────────────────
 *
 * A "do not call" that writes the attempt and then fails to write the
 * suppression is the worst possible half-success: we can prove we were asked
 * and prove we did not act. lib/sales/outreachInbound.js makes the same
 * argument for filing a reply and its opt-out together, and suppressWithin()
 * exists precisely so this can join an open transaction rather than opening a
 * nested one.
 *
 * ── The plan is computed outside the transaction ─────────────────────────
 *
 * planDisposition() is pure and has already refused anything malformed. What
 * happens in here is writes only, so a refusal costs no connection time and
 * every branch of the decision is executed by the check script without a
 * database.
 */
export async function saveDisposition({
  salesRepId,
  attemptId,
  code,
  note = "",
  callbackAt = null,
  now = new Date(),
  client = db,
} = {}) {
  requireStore(client);

  const plan = planDisposition({ code, note, callbackAt, now });
  if (!plan.ok) return { ok: false, error: plan.reason, attempt: null };

  // Scoped in the WHERE rather than checked after a read — the shape every
  // other sales route uses, and the reason none of them has a scoping bug.
  const existing = await client.salesCallAttempt.findFirst({
    where: { id: attemptId, salesRepId },
    select: { id: true, prospectId: true, leadId: true, toE164: true, disposition: true },
  });
  if (!existing) {
    return { ok: false, error: "That call is not yours to log.", attempt: null };
  }
  if (existing.disposition) {
    // Not overwritten. An outcome is a rep's account of a conversation that
    // happened; a second submission is a duplicate press or a change of mind,
    // and both are better handled by a new attempt row than by rewriting the
    // first one out of existence.
    return {
      ok: false,
      error: "That call already has an outcome. Log a new call rather than rewriting this one.",
      attempt: null,
    };
  }

  const saved = await client.$transaction(async (tx) => {
    const attempt = await tx.salesCallAttempt.update({
      where: { id: existing.id },
      data: plan.attempt,
    });

    if (existing.prospectId) {
      const data = {};
      if (plan.prospect.assignedRepId === null) {
        data.assignedRepId = null;
        data.assignedAt = null;
      }
      data.claimExpiresAt = plan.prospect.claimExpiresAt;
      if (plan.prospect.status) data.status = plan.prospect.status;
      if (plan.prospect.doNotContactAt) {
        // Never overwritten once set — the same rule the queue route's
        // do_not_contact action states: a second request must not move the
        // date and lose when the business actually asked.
        const row = await tx.prospect.findUnique({
          where: { id: existing.prospectId },
          select: { doNotContactAt: true },
        });
        if (!row?.doNotContactAt) {
          data.doNotContactAt = plan.prospect.doNotContactAt;
          data.doNotContactReason = plan.prospect.doNotContactReason;
        }
      }
      // Still scoped to this rep's own claim: a disposition may not reach into
      // a prospect somebody else holds.
      await tx.prospect.updateMany({
        where: { id: existing.prospectId, assignedRepId: salesRepId },
        data,
      });
    }

    if (existing.leadId && plan.lead) {
      await tx.salesLead.updateMany({
        where: { id: existing.leadId, salesRepId },
        data: plan.lead,
      });
    }

    if (plan.suppression) {
      const result = await suppressWithin(tx, {
        kind: "phone",
        value: existing.toE164,
        channels: plan.suppression.channels,
        source: plan.suppression.source,
        reason: plan.suppression.reason,
        prospectId: existing.prospectId || null,
        salesLeadId: existing.leadId || null,
        requestedAt: plan.suppression.requestedAt,
        salesRepId,
      });
      // Thrown rather than returned: this is inside the transaction, and a
      // failed suppression must take the attempt's outcome down with it rather
      // than leave a row saying the rep was asked to stop.
      if (!result.ok) {
        throw new Error(`The do-not-call list refused this entry: ${result.error}`);
      }
    }

    return attempt;
  });

  return { ok: true, error: null, attempt: saved, plan };
}

/** The claim vocabulary, re-exported so a route does not import two modules. */
export { CLAIM_HOLD, CLAIM_RELEASE, CLAIM_WORKED };

// ═══════════════════════════════════════════════════════════════════════════
// The numbers a rep calls FROM
// ═══════════════════════════════════════════════════════════════════════════

/** The `PlatformSmsNumber.purpose` value a sales voice number carries. */
export const SALES_VOICE_PURPOSE = "sales_voice";

/**
 * Every number FieldQuo owns and may present on a sales call.
 *
 * ── Why PlatformSmsNumber and not VoicePhoneNumber ──────────────────────
 *
 * The telephony audit is explicit: `VoicePhoneNumber.companyId` is a required
 * FK and `heldNumber()` enforces one per company, so a POOL is structurally
 * the thing that code treats as a bug. Putting sales numbers there would make
 * the rent cron bill a non-company and report a false billing leak per number.
 * PlatformSmsNumber is the only tenant-free number model there is — see
 * lib/sales/calls/schema.pending.prisma for the note about its name having
 * outgrown it.
 *
 * Returns `[]` when none are held, and `[]` is honest: it means FieldQuo has
 * bought no numbers, which browserDialReadiness refuses on by name.
 */
export async function salesCallerNumbers({ client = db } = {}) {
  const rows = await client.platformSmsNumber.findMany({
    where: { purpose: SALES_VOICE_PURPOSE, active: true },
    select: { e164: true },
    orderBy: { e164: "asc" },
  });
  return rows.map((r) => r.e164).filter(Boolean);
}

/**
 * Every number FieldQuo or one of its tenants answers on.
 *
 * Used to refuse a dial that would ring our own infrastructure — a loop that
 * bills both legs, and on a tenant's number puts a contractor's receptionist
 * on the line with a rep who was trying to sell to somebody else.
 *
 * Deliberately a superset: tenant numbers are included even though a sales rep
 * has no business calling one, because the failure this prevents is a typo in
 * a discovered phone number, not a malicious rep.
 */
export async function ownNumbers({ client = db } = {}) {
  const [platform, tenantVoice, tenantCrew] = await Promise.all([
    client.platformSmsNumber.findMany({ where: { active: true }, select: { e164: true } }),
    client.voicePhoneNumber.findMany({ select: { e164: true } }).catch(() => []),
    client.crewInboxNumber.findMany({ select: { e164: true } }).catch(() => []),
  ]);
  return [
    ...platform.map((r) => r.e164),
    ...tenantVoice.map((r) => r.e164),
    ...tenantCrew.map((r) => r.e164),
  ].filter(Boolean);
}

// ═══════════════════════════════════════════════════════════════════════════
// Presence
// ═══════════════════════════════════════════════════════════════════════════

/** The open activity row for a rep, or null. Never invented. */
export async function currentActivity(salesRepId, { client = db } = {}) {
  if (!callStoreState(client).ready || !salesRepId) return null;
  return client.salesRepActivity.findFirst({
    where: { salesRepId, endedAt: null },
    orderBy: { startedAt: "desc" },
  });
}

/**
 * Move a rep to a new state, closing the period they were in.
 *
 * ── Why the close and the open are one transaction ──────────────────────
 *
 * Two open rows for one rep is a rep who is both on a call and on lunch, and
 * every duration computed from that point is wrong in both directions. The
 * close-then-open pair is therefore atomic, and `updateMany` over every open
 * row rather than the one we read closes any that a previous crash left
 * behind — self-healing, rather than a state that needs a cleanup job.
 */
export async function setRepState({
  salesRepId,
  to,
  pauseReason = null,
  callAttemptId = null,
  now = new Date(),
  client = db,
} = {}) {
  requireStore(client);
  if (!salesRepId) return { ok: false, error: "Which rep?", activity: null };

  const open = await currentActivity(salesRepId, { client });
  const from = isRepState(open?.state) ? open.state : STATE_OFFLINE;

  const allowed = canTransition({ from, to, pauseReason });
  if (!allowed.ok) return { ok: false, error: allowed.reason, activity: null };

  const activity = await client.$transaction(async (tx) => {
    await tx.salesRepActivity.updateMany({
      where: { salesRepId, endedAt: null },
      data: { endedAt: now },
    });
    return tx.salesRepActivity.create({
      data: {
        salesRepId,
        state: to,
        pauseReason: allowed.pauseReason,
        callAttemptId: callAttemptId || null,
        startedAt: now,
        heartbeatAt: now,
      },
    });
  });

  return { ok: true, error: null, activity, from };
}

/**
 * "Still here."
 *
 * Deliberately cannot change a state, only age one. A heartbeat that could
 * open a row would let a background tab put a rep back on the board after they
 * signed out.
 */
export async function heartbeat(salesRepId, { now = new Date(), client = db } = {}) {
  if (!callStoreState(client).ready || !salesRepId) return { ok: false, updated: 0 };
  const res = await client.salesRepActivity.updateMany({
    where: { salesRepId, endedAt: null },
    data: { heartbeatAt: now },
  });
  return { ok: true, updated: res.count };
}

/**
 * The live board for a set of reps.
 *
 * Takes the ids the CALLER has already decided this viewer may see — see
 * lib/sales/team.js's visibleRepIds(). This module does not know who is asking
 * and must not: a scoping rule that lives in two places is a scoping rule that
 * will disagree with itself, and lib/sales/scope.js's header explains what
 * that costs when there is no outer tenant filter to catch it.
 *
 * An empty id list returns an empty board, never every rep.
 */
export async function presenceFor(repIds, { now = new Date(), client = db } = {}) {
  if (!callStoreState(client).ready) return null;
  const ids = Array.isArray(repIds) ? repIds.filter((id) => typeof id === "string" && id) : [];
  if (ids.length === 0) return [];

  const rows = await client.salesRepActivity.findMany({
    where: { salesRepId: { in: ids }, endedAt: null },
    orderBy: { startedAt: "desc" },
  });
  const newest = new Map();
  for (const row of rows) {
    if (!newest.has(row.salesRepId)) newest.set(row.salesRepId, row);
  }
  return ids.map((salesRepId) => ({
    salesRepId,
    presence: livePresence(newest.get(salesRepId) || null, now),
  }));
}
