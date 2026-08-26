// lib/voice/reconcileCalls.js
//
// Ask Retell what calls it actually handled, and make our ledger agree.
//
// ══ Why this exists ════════════════════════════════════════════════════════
//
// Every minute this product bills was billed from one line in one file: the
// `call_ended` branch of app/api/voice/webhook/route.js. That is the whole
// meter. If the delivery stops, nothing anywhere notices, because a webhook
// that never arrives is byte-for-byte identical to a phone nobody rang — no
// VoiceCall row, no charge, no error. A live tenant took a real call and had
// zero of all three.
//
// The consequences compound in the wrong direction. Calls are never billed, so
// balances never fall, so canTakeCall keeps saying yes, so syncNumberAttachment
// never detaches — and a company at zero credit talks for free on FieldQuo's
// pooled Retell account indefinitely. The pay-per-use product has no meter at
// all, and the failure is completely silent.
//
// This is the same conclusion lib/booking/reconcileBookingFee.js reached about
// Stripe, and the same one the service-plan handler reached before it: a
// webhook is a FAST PATH, never the only path. Whether an endpoint receives an
// event is a dashboard setting and a signature implementation, neither of which
// code can verify. So we ask.
//
// ══ The three rules, in priority order ═════════════════════════════════════
//
// 1. NEVER BILL TWICE. The webhook and this reconciler both charge through
//    chargeCall, which keys on `call:<providerCallId>` against a UNIQUE index
//    on (companyId, ref). The database refuses the second write; neither path
//    needs to know the other ran. Nothing here shortcuts that.
//
// 2. NEVER INVENT A CHARGE. A call whose duration we cannot establish is left
//    UNBILLED and flagged for a human. Absence of a duration is not zero and is
//    not an average — see durationSecondsOf below, which returns null rather
//    than guessing, and costForSeconds, which refuses non-finite input.
//
// 3. AN UNREACHABLE PROVIDER IS NOT EVIDENCE OF USAGE. If the list call fails
//    we charge nobody, detach nobody, and say `provider_unreachable`. Same
//    discipline as lib/voice/diagnose.js and as reconcileBookingFee's refusal
//    to cancel bookings during a Stripe outage: a company must never be cut off
//    by OUR failure.
import { db } from "@/lib/db";
import { toE164 } from "./numbers";
import { listCalls, voiceConfigured, RetellError } from "./retell";
import { chargeCall, balanceFor, costForSeconds, isOverdrawn } from "./credits";
import { syncNumberAttachment } from "./provision";
import { pushCallCeiling } from "./callCeiling";
import { recordError } from "@/lib/platform/errorLog";

/** area on PlatformErrorLog, so the read matches the write. */
export const RECONCILE_AREA = "voice_meter";

/**
 * How far back a normal run looks.
 *
 * Three days rather than one: a webhook outage that starts on a Friday evening
 * must still be caught by a run on Monday morning, and the marginal cost of a
 * wider window is a database lookup per already-billed call, not a charge. The
 * cron accepts an override so a longer catch-up can be run by hand after an
 * outage without editing code.
 */
export const DEFAULT_LOOKBACK_MS = 3 * 24 * 60 * 60 * 1000;

/** Pages of 200. Bounded so one bad window cannot run a cron until it times out. */
const PAGE_SIZE = 200;
const MAX_PAGES = 25;

/**
 * A call's length in seconds, or NULL when we genuinely do not know.
 *
 * Null is the whole point of this function. Every tempting fallback here is a
 * fabricated charge on somebody's prepaid balance:
 *
 *   `|| 0`        bills nothing for a call that may have run twenty minutes,
 *                 and closes the case so nobody ever looks at it again.
 *   an average    invents a number and puts it on a statement that says
 *                 "where did my credit go".
 *   `Number(x)`   carries Infinity straight through — a JSON body containing
 *                 1e400 parses to exactly that, and Math.ceil(Infinity/60)
 *                 times the rate is an unbounded debit.
 *
 * `duration_ms` is preferred because it is what Retell bills on. The timestamp
 * derivation is a fallback for rows where the field is absent, and it is only
 * trusted when BOTH endpoints are finite and the end is not before the start —
 * a clock that went backwards is not a negative call.
 */
export function durationSecondsOf(call) {
  const ms = Number(call?.duration_ms);
  if (Number.isFinite(ms) && ms >= 0) return Math.round(ms / 1000);

  const start = Number(call?.start_timestamp);
  const end = Number(call?.end_timestamp);
  if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
    return Math.round((end - start) / 1000);
  }

  return null;
}

/** Which of the two numbers on a call is OURS. Direction decides. */
export function ourNumberOn(call) {
  const outbound = call?.direction === "outbound";
  return toE164(outbound ? call?.from_number : call?.to_number);
}

/**
 * Reconcile the provider's call list against our ledger.
 *
 * Every collaborator is injectable for the same reason reconcileBookingFee's
 * are: this decides whether money moves, and that is worth EXECUTING in
 * scripts/check-voice-metering.mjs rather than reading. Production callers pass
 * none of them.
 *
 * @returns {Promise<{ok: boolean, reason?: string, ...tally}>}
 */
export async function reconcileVoiceCalls(opts = {}) {
  const prisma = opts.db || db;
  const list = opts.listCalls || listCalls;
  const charge = opts.chargeCall || chargeCall;
  const balance = opts.balanceFor || balanceFor;
  const sync = opts.syncNumberAttachment || syncNumberAttachment;
  const ceiling = opts.pushCallCeiling || pushCallCeiling;
  const log = opts.recordError || recordError;
  const configured = opts.configured ?? voiceConfigured();

  const now = opts.now ?? Date.now();
  const untilMs = Number.isFinite(opts.untilMs) ? opts.untilMs : now;
  const sinceMs = Number.isFinite(opts.sinceMs)
    ? opts.sinceMs
    : untilMs - (Number.isFinite(opts.lookbackMs) ? opts.lookbackMs : DEFAULT_LOOKBACK_MS);

  const tally = {
    seen: 0,
    alreadyBilled: 0,
    rescued: 0,
    rescuedCents: 0,
    zeroLength: 0,
    unknownDuration: 0,
    unknownNumber: 0,
    resynced: 0,
    overdrawn: 0,
    errors: 0,
  };

  // No key, no evidence. Emphatically not an empty result: reporting "0 calls
  // to reconcile" when we never asked is the same lie the broken webhook told.
  if (!configured) return { ok: false, reason: "not_configured", ...tally };

  // Every number we have ever held, not just the live ones. A number released
  // last week still took calls FieldQuo was billed for, and those minutes are
  // owed by the company that made them.
  const numbers = await prisma.voicePhoneNumber.findMany({
    select: { id: true, e164: true, companyId: true, agentId: true, numberType: true },
  });
  const byE164 = new Map(numbers.map((n) => [n.e164, n]));

  // ── The provider read, and the one failure that must change nothing ──────
  //
  // Wrapped as a whole. A window that pages successfully three times and then
  // fails is a PARTIAL answer, and a partial answer is fine for billing (the
  // calls we did see are real) but must not reach the detach step: "I saw
  // fewer calls than exist" is not a reason to conclude anything about a
  // balance. So a mid-page failure keeps whatever it billed — every charge is
  // idempotent and will simply not repeat — and reports `partial`, which the
  // cron surfaces rather than swallowing.
  const items = [];
  let paginationKey = null;
  let partial = false;
  for (let page = 0; page < MAX_PAGES; page++) {
    let res;
    try {
      res = await list({ sinceMs, untilMs, limit: PAGE_SIZE, paginationKey });
    } catch (err) {
      if (page === 0) {
        // Nothing was read at all. Charge nobody, detach nobody, say so.
        return {
          ok: false,
          reason: "provider_unreachable",
          detail: err?.message || String(err),
          status: err instanceof RetellError ? err.status : undefined,
          ...tally,
        };
      }
      partial = true;
      break;
    }
    const batch = Array.isArray(res?.items) ? res.items : [];
    items.push(...batch);
    paginationKey = res?.pagination_key || null;
    if (!res?.has_more || !paginationKey || batch.length === 0) break;
  }

  const touched = new Set();
  const flagged = [];

  for (const call of items) {
    const providerCallId = call?.call_id;
    if (!providerCallId) continue;
    tally.seen++;

    const e164 = ourNumberOn(call);
    const number = e164 ? byE164.get(e164) : null;
    if (!number) {
      // A number live at the provider that we have no row for. Real money is
      // being spent on FieldQuo's account with no tenant to attribute it to,
      // which is a leak rather than a curiosity — but it is a leak per NUMBER,
      // so it is logged once below rather than once per call.
      tally.unknownNumber++;
      continue;
    }

    const seconds = durationSecondsOf(call);

    if (seconds === null) {
      // Rule 2. Unbilled, flagged, and the row's durationSec is left alone —
      // writing 0 would turn "we don't know" into "it was empty" for ever.
      tally.unknownDuration++;
      flagged.push({ providerCallId, companyId: number.companyId, status: call?.call_status });
      await upsertCallRow(prisma, { call, number, providerCallId, seconds: null });
      continue;
    }

    await upsertCallRow(prisma, { call, number, providerCallId, seconds });

    const costCents = costForSeconds(seconds, number.numberType);
    if (costCents <= 0) {
      // A genuine zero-length call. Free, correctly, and NOT the same case as
      // the one above — we know it was nothing, rather than not knowing.
      tally.zeroLength++;
      continue;
    }

    // Was it already billed? Asked BEFORE charging, purely so we can tell a
    // rescue from a no-op. chargeCall is idempotent either way; without this
    // read a broken webhook would be repaired invisibly and stay broken.
    let existing = null;
    try {
      existing = await prisma.voiceCreditEntry.findFirst({
        where: { companyId: number.companyId, ref: `call:${providerCallId}` },
        select: { id: true },
      });
    } catch (err) {
      tally.errors++;
      console.error("[voice/meter] couldn't check the ledger:", providerCallId, err?.message);
      continue;
    }

    if (existing) {
      tally.alreadyBilled++;
      continue;
    }

    let entry;
    try {
      entry = await charge({
        companyId: number.companyId,
        callId: providerCallId,
        seconds,
        numberType: number.numberType,
        prisma,
      });
    } catch (err) {
      tally.errors++;
      console.error("[voice/meter] charge failed:", providerCallId, err?.message);
      continue;
    }

    // chargeCall returns the row that WON, which on a race is the one the
    // webhook wrote a millisecond earlier. Counted as a rescue only when this
    // run is the reason a charge exists.
    if (!entry) continue;
    tally.rescued++;
    tally.rescuedCents += costCents;
    touched.add(number.companyId);

    // Loud, per call. A meter repaired in silence is a meter that stays broken
    // — the exact lesson of the booking fee, which was rescued five times
    // before anyone knew the webhook was misrouted.
    await log({
      area: RECONCILE_AREA,
      code: "webhook_missed",
      companyId: number.companyId,
      message:
        `Call ${providerCallId} (${seconds}s, ${costCents}¢) was never billed by the ` +
        `webhook — charged by the reconciler. Check that Retell's call events are ` +
        `reaching /api/voice/webhook.`,
      detail: { providerCallId, seconds, cents: costCents, e164, direction: call?.direction || null },
    }).catch(() => {});
  }

  if (tally.unknownNumber) {
    await log({
      area: RECONCILE_AREA,
      code: "unattributed_calls",
      message:
        `${tally.unknownNumber} call(s) at the provider were placed on numbers FieldQuo ` +
        `has no row for. Those minutes are billed to FieldQuo and charged to nobody.`,
      detail: { sinceMs, untilMs },
    }).catch(() => {});
  }

  if (flagged.length) {
    await log({
      area: RECONCILE_AREA,
      code: "unknown_duration",
      message:
        `${flagged.length} call(s) have no usable duration and were deliberately left ` +
        `unbilled. A duration we cannot establish is never estimated — these need a ` +
        `human to price them or write them off.`,
      detail: { calls: flagged.slice(0, 25) },
    }).catch(() => {});
  }

  // ── Enforcement, and only on evidence we actually gathered ───────────────
  //
  // Skipped entirely on a partial read. Detaching is the cut-off, and a
  // truncated view of the provider's calls is not grounds to act on a balance.
  if (!partial) {
    for (const companyId of touched) {
      try {
        // Attachment first: it is the switch that stops the next call. The
        // ceiling only shortens one that has already been allowed to start.
        await sync(companyId);
        await ceiling(companyId);
        tally.resynced++;

        // A balance below zero means minutes were served that nobody paid for
        // — concurrent calls against a thin balance, or the stretch of outage
        // this run just closed. Named rather than absorbed: see the shortfall
        // note in lib/voice/callCeiling.js.
        const balanceCents = await balance(companyId, prisma);
        if (isOverdrawn(balanceCents)) {
          tally.overdrawn++;
          await log({
            area: RECONCILE_AREA,
            code: "overdrawn",
            companyId,
            message:
              `Voice balance is ${balanceCents}¢ — minutes were served beyond what was paid for. ` +
              `The agent is now detached; this is FieldQuo's cost until they top up.`,
            detail: { balanceCents },
          }).catch(() => {});
        }
      } catch (err) {
        tally.errors++;
        console.error("[voice/meter] resync failed:", companyId, err?.message);
      }
    }
  }

  return { ok: true, partial, sinceMs, untilMs, ...tally };
}

/**
 * Make sure a VoiceCall row exists for a call the provider knows about.
 *
 * This is the second half of the rescue: a missed webhook costs a charge AND
 * the record of the call, and a contractor whose receptionist answered six
 * calls should not see an empty list because our endpoint was 401ing.
 *
 * `update` deliberately fills gaps rather than overwriting judgement. The
 * transcript and summary are only set when we have them and the row does not —
 * this runs after `call_analyzed` may have already written a better one, and a
 * reconciler that stomps a summary is worse than one that skips it.
 */
async function upsertCallRow(prisma, { call, number, providerCallId, seconds }) {
  const direction = call?.direction === "outbound" ? "outbound" : "inbound";
  const started = Number(call?.start_timestamp);
  const ended = Number(call?.end_timestamp);

  const common = {
    numberId: number.id,
    agentId: number.agentId,
    direction,
    fromE164: toE164(call?.from_number),
    toE164: toE164(call?.to_number),
    disposition: call?.disconnection_reason || null,
    // Only ever a real number. Null seconds leaves the column untouched — see
    // the note on durationSecondsOf.
    ...(seconds === null ? {} : { durationSec: seconds }),
  };

  try {
    await prisma.voiceCall.upsert({
      where: { providerCallId },
      create: {
        providerCallId,
        companyId: number.companyId,
        startedAt: Number.isFinite(started) ? new Date(started) : null,
        endedAt: Number.isFinite(ended) ? new Date(ended) : null,
        transcript: call?.transcript_object || call?.transcript || null,
        summary: call?.call_analysis?.call_summary || null,
        recordingUrl: call?.recording_url || null,
        // A call the webhook never delivered has had no human eye on it and no
        // tool run against it. Flagged so it surfaces in the call list rather
        // than appearing days late and already read.
        needsReview: true,
        ...common,
      },
      update: {
        ...common,
        ...(Number.isFinite(ended) ? { endedAt: new Date(ended) } : {}),
      },
    });
  } catch (err) {
    // A row we could not write is not a reason to skip the charge. The minutes
    // were served either way, and the ledger is the part that has to be right.
    console.error("[voice/meter] couldn't record the call:", providerCallId, err?.message);
  }
}
