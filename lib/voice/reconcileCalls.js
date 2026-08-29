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
//
// ══ It recovers the CALL, not just the charge ══════════════════════════════
//
// The outage that prompted this file cost more than money. Retell's signature
// check rejected every delivery, so the calls themselves left no row: no
// transcript, no summary, no recording, and — because `save_caller` posts to
// the tools endpoint, which had the identical broken check — no LeadRequest
// either. The owner made a real four-minute call, gave his name, his number,
// his email, his address and the job, and every word of it was thrown away at
// our door while Retell kept all of it.
//
// So this sweep is also the backfill. There is deliberately no second lister: a
// separate "recover" job asking the provider the same question could disagree
// with this one about what happened, and two answers about billing is worse
// than a slow one. What it keeps is:
//
//   the row      transcript, summary, recording URL, duration, disposition —
//                gap-filled, never stomping a better value the webhook wrote.
//   the mark     `recoveredAt`, set on CREATE only. A contractor opening
//                /app/receptionist and finding a two-day-old call is owed the
//                reason, and "we lost it and got it back" is the honest one.
//   the lead     only when a person asked for it, and only from the caller's
//                own words. See lib/ai/callLeadRecovery.js and the note on
//                `recoverLead` below.
//
// What it never does is invent. A call with no transcript is recorded with no
// transcript; a duration Retell does not give stays unknown; a lead the
// transcript does not support is not created.
import { db } from "@/lib/db";
import { toE164 } from "./numbers";
import { listCalls, getCall, voiceConfigured, RetellError } from "./retell";
import { providerCostPatch } from "./providerCost";
import { transcriptFrom } from "./transcript";
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
  // Injectable for the same reason `list` is: check-voice-metering.mjs executes
  // this whole function, and a reconciler that reaches the network from a check
  // script is one nobody runs.
  const fetchDetail = opts.getCall || getCall;
  const charge = opts.chargeCall || chargeCall;
  const balance = opts.balanceFor || balanceFor;
  const sync = opts.syncNumberAttachment || syncNumberAttachment;
  const ceiling = opts.pushCallCeiling || pushCallCeiling;
  const log = opts.recordError || recordError;
  const configured = opts.configured ?? voiceConfigured();

  // ── Scope, and the two things it changes ────────────────────────────────
  //
  // Set by the per-company "recover missed calls" action; absent for the cron,
  // which sweeps every tenant. It filters the calls this run acts on and
  // nothing else — the numbers map stays complete so attribution is still
  // right, and the unattributed-calls alarm still means what it says.
  const onlyCompanyId = opts.onlyCompanyId || null;

  // ── Reconstructing the LEAD, and why the cron does not ──────────────────
  //
  // `save_caller` posts to the tools endpoint, which had the same broken
  // signature check as the webhook — so every recovered call has a transcript
  // full of contact details and no LeadRequest. Reading them back costs a model
  // call against the contractor's own AI allowance, per call, and an hourly
  // cron that did it unasked would spend somebody's quota on a schedule they
  // never saw. So the sweep recovers the CALL always and the LEAD only when a
  // person asked for it. See lib/ai/callLeadRecovery.js.
  const recoverLead = opts.recoverLead || null;
  const maxLeads = Number.isFinite(opts.maxLeads) ? opts.maxLeads : 25;

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
    // Calls on OTHER tenants' numbers, skipped by a scoped run. Counted rather
    // than ignored so a company that recovers nothing can be told whether the
    // window was empty or simply wasn't theirs.
    otherCompany: 0,
    resynced: 0,
    overdrawn: 0,
    errors: 0,
    // Leads reconstructed from a transcript, and calls where reading it
    // produced nothing to act on. The second number is not a failure — most
    // calls are wrong numbers — but a run that recovered six calls and no leads
    // has to say so rather than look like it did nothing.
    leadsRecovered: 0,
    leadsEmpty: 0,
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

  // One timestamp for the whole sweep, from `now`, so a run is one event in the
  // record rather than a spray of times a second apart — and so a check can
  // assert on it without racing the clock.
  const recoveredAt = new Date(now);

  let attempted = 0;

  /**
   * Give a recovered call back the lead it earned, if it earned one.
   *
   * Three gates, and each one is a way this could go wrong:
   *
   *   no recoverLead   the caller didn't ask for it (the hourly cron).
   *   not recovered    the row came from the webhook, so save_caller had its
   *                    chance. A live call that produced no lead produced no
   *                    lead; re-reading it behind the contractor's back is a
   *                    second opinion nobody asked for.
   *   already a lead   idempotence. The whole point of a backfill is that
   *                    running it twice changes nothing.
   *
   * Failures are swallowed into the tally. A model that is down, over quota or
   * talking nonsense must not cost the CHARGE — the minutes were served either
   * way, and the ledger is the part that has to be right.
   */
  async function maybeRecoverLead(row, number) {
    if (!recoverLead || !row) return;
    if (!row.recoveredAt || row.leadId) return;
    // Nothing said, nothing to read. Not counted as an empty recovery: a call
    // with no transcript was never a candidate.
    if (!row.transcript) return;
    // Bounded on ATTEMPTS, not successes. Counting successes would let a window
    // full of wrong numbers make an unbounded number of model calls to find
    // nothing — which is exactly the shape of a first run over a long outage.
    if (attempted >= maxLeads) return;
    attempted++;

    try {
      const result = await recoverLead({
        companyId: number.companyId,
        voiceCallId: row.id,
        prisma,
      });
      if (result?.ok) tally.leadsRecovered++;
      else tally.leadsEmpty++;
    } catch (err) {
      tally.errors++;
      console.error("[voice/meter] lead recovery failed:", row.id, err?.message);
    }
  }

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

    // ── One tenant's sweep ──────────────────────────────────────────────────
    //
    // The "recover my missed calls" button runs this whole function scoped to
    // the company that pressed it. Filtered HERE rather than by narrowing the
    // numbers map above, because a call on another tenant's number is not an
    // unattributed one — collapsing the two would report a leak that doesn't
    // exist and log it as money nobody is being charged for.
    if (onlyCompanyId && number.companyId !== onlyCompanyId) {
      tally.otherCompany++;
      continue;
    }

    const seconds = durationSecondsOf(call);

    if (seconds === null) {
      // Rule 2. Unbilled, flagged, and the row's durationSec is left alone —
      // writing 0 would turn "we don't know" into "it was empty" for ever.
      tally.unknownDuration++;
      flagged.push({ providerCallId, companyId: number.companyId, status: call?.call_status });
      const row = await upsertCallRow(prisma, {
        call, number, providerCallId, seconds: null, fetchDetail, recoveredAt,
      });
      // A duration we can't price is no reason to lose the caller. The lead and
      // the charge are independent — somebody still rang, still gave a name and
      // an address, and still wants ringing back.
      await maybeRecoverLead(row, number);
      continue;
    }

    const row = await upsertCallRow(prisma, {
      call, number, providerCallId, seconds, fetchDetail, recoveredAt,
    });
    await maybeRecoverLead(row, number);

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
 *
 * ── The transcript is NOT on the list response ─────────────────────────────
 *
 * `/v3/list-calls` items carry `call_analysis.call_summary`, `recording_url`
 * and `call_cost` — but NOT `transcript` or `transcript_object`. Those exist
 * only on the single-call read:
 *
 *   https://docs.retellai.com/api-references/list-calls   (no transcript)
 *   https://docs.retellai.com/api-references/get-call     (transcript,
 *                                                          transcript_object)
 *
 * This was written against the get-call shape and pointed at the list, so
 * every rescued call recorded `transcript: null` — and because `update` only
 * fills gaps, it would have stayed null for ever. A contractor whose webhook
 * was down would have got the call back with no record of what was SAID,
 * which is the half of a call worth having.
 *
 * So we fetch the detail, and only when it would actually add something: a row
 * that does not exist yet, or one still missing its transcript. That makes the
 * extra request proportional to the FAILURE (calls the webhook missed) rather
 * than to traffic — a healthy account does zero of them. A detail read that
 * fails costs the transcript and nothing else; the charge does not depend on
 * it, and inventing a transcript is not on the table.
 */
async function upsertCallRow(
  prisma,
  { call, number, providerCallId, seconds, fetchDetail, recoveredAt },
) {
  const direction = call?.direction === "outbound" ? "outbound" : "inbound";
  const started = Number(call?.start_timestamp);
  const ended = Number(call?.end_timestamp);

  let existing = null;
  try {
    existing = await prisma.voiceCall.findUnique({
      where: { providerCallId },
      // Summary and recording alongside the transcript: all three are gap-
      // filled on update, and a null check needs the column it is checking.
      select: { transcript: true, summary: true, recordingUrl: true },
    });
  } catch {
    // Unreadable is treated as absent: the upsert below is still correct, we
    // just may fetch a detail we didn't need. Cheap, and the wrong way round
    // to fail — skipping the fetch would lose the transcript silently.
  }

  let detail = null;
  if (!existing || existing.transcript === null) {
    const get = fetchDetail || getCall;
    try {
      detail = await get(providerCallId);
    } catch (err) {
      console.error("[voice/meter] no transcript for", providerCallId, err?.message);
    }
  }

  const transcript = transcriptFrom(detail);
  // Same source, same rule. The detail read exists because the list rows are
  // thin; the summary and the recording are thin in exactly the same way, and
  // taking those two from the list while taking the transcript from the detail
  // would recover a call's words and lose the audio a contractor wants to play.
  const summary = detail?.call_analysis?.call_summary || call?.call_analysis?.call_summary || null;
  const recordingUrl = detail?.recording_url || call?.recording_url || null;

  const common = {
    numberId: number.id,
    agentId: number.agentId,
    direction,
    fromE164: toE164(call?.from_number),
    toE164: toE164(call?.to_number),
    // `undefined`, not `null`, when neither source has one. This is spread into
    // the UPDATE branch too, and a literal null there would erase a
    // disconnection reason the webhook had already written — turning "they hung
    // up" into "we don't know" every time the sweep passed over the row.
    disposition: call?.disconnection_reason || detail?.disconnection_reason || undefined,
    // Only ever a real number. Null seconds leaves the column untouched — see
    // the note on durationSecondsOf.
    ...(seconds === null ? {} : { durationSec: seconds }),
    // What Retell charged US, when Retell said. Spreads to nothing otherwise,
    // so an unpriced call stays unknown rather than becoming a guess.
    ...providerCostPatch(call),
  };

  try {
    return await prisma.voiceCall.upsert({
      where: { providerCallId },
      create: {
        providerCallId,
        companyId: number.companyId,
        startedAt: Number.isFinite(started) ? new Date(started) : null,
        endedAt: Number.isFinite(ended) ? new Date(ended) : null,
        transcript,
        summary,
        recordingUrl,
        // A call the webhook never delivered has had no human eye on it and no
        // tool run against it. Flagged so it surfaces in the call list rather
        // than appearing days late and already read.
        needsReview: true,
        // ── The row exists because we went looking, and it says so ─────────
        //
        // Stamped on CREATE only. A row the webhook wrote and this sweep merely
        // topped up was never lost, and marking it recovered would make the
        // badge on /app/receptionist meaningless on the calls that really were.
        // The contractor's question when a two-day-old call appears is "why is
        // this only showing up now"; this column is the answer.
        recoveredAt,
        ...common,
      },
      update: {
        ...common,
        ...(Number.isFinite(ended) ? { endedAt: new Date(ended) } : {}),
        // Gap-fill only, same rule as the summary above: a row that already
        // has a transcript keeps it, and one that never got a webhook gets the
        // one we just fetched.
        ...(transcript && existing?.transcript === null ? { transcript } : {}),
        ...(summary && existing?.summary === null ? { summary } : {}),
        ...(recordingUrl && existing?.recordingUrl === null ? { recordingUrl } : {}),
        // Deliberately NOT `recoveredAt` — see the create branch.
      },
      // Returned so the caller can decide whether this call still owes a lead.
      // Cheap: three scalars on a row we were writing anyway.
      select: { id: true, leadId: true, recoveredAt: true, transcript: true },
    });
  } catch (err) {
    // A row we could not write is not a reason to skip the charge. The minutes
    // were served either way, and the ledger is the part that has to be right.
    console.error("[voice/meter] couldn't record the call:", providerCallId, err?.message);
    return null;
  }
}
