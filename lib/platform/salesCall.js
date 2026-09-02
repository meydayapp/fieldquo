// lib/platform/salesCall.js
//
// Where a call to FieldQuo's OWN number lands.
//
// ══ The hole this closes ═══════════════════════════════════════════════════
//
// app/api/voice/webhook/route.js resolves the tenant from the number that was
// dialled, and refuses anything it cannot place:
//
//     const number = await db.voicePhoneNumber.findUnique({ where: { e164 } });
//     if (!number) { recordError("Call to an unknown number"); /* dropped */ }
//
// FieldQuo's own sales line is not a tenant's VoicePhoneNumber, so every call to
// it would be logged as a mistake and thrown away — no record, no transcript,
// no summary, no recording, nowhere to look. That is exactly the state the
// tenant side was in until the signature bug was found, and it would have been
// invisible in the same way: a phone that answers beautifully and leaves no
// trace, with a plausible-looking error line explaining it away.
//
// ══ Why the number comes from the environment ══════════════════════════════
//
// Because there is no row it could come from. VoicePhoneNumber is scoped to a
// company by its schema, and giving FieldQuo a Company row to hold one number
// would make FieldQuo a tenant in every count in the console. So the sales line
// is configuration, like RETELL_TEST_NUMBER next to it, and this module is the
// one place that parses it.
//
// ══ It must not be a tenant's number, and must not be the test number ══════
//
// Both would be silent disasters in opposite directions: a tenant's number
// listed here would divert a contractor's callers to FieldQuo's own agent, and
// the shared test number is the owner's line for trying a TENANT receptionist —
// claiming it takes that away and gets claimed back the next time somebody
// tests one. Neither can be prevented from here, so both are DETECTED here and
// reported by the readiness check. The tenant lookup runs first in the webhook,
// which means a collision costs FieldQuo the call rather than costing a
// contractor theirs — the right way round for a mistake nobody has made yet.
import { db } from "@/lib/db";
import { toE164, isSharedTestNumber } from "@/lib/voice/numbers";
import { transcriptFrom } from "@/lib/voice/transcript";
import { durationSecondsOf } from "@/lib/voice/callDuration";

/** The variable. Named once so the readiness copy and the docs cannot drift. */
export const SALES_NUMBER_ENV = "FIELDQUO_SALES_NUMBER";

/**
 * FieldQuo's own numbers, normalised. Comma-separated, usually one.
 *
 * Plural because a second line for a campaign is the obvious next thing and a
 * scalar would be rewritten the day it happens — the same shape
 * RETELL_TEST_NUMBER already uses.
 */
export function salesNumbers() {
  // Read literally rather than through SALES_NUMBER_ENV: scripts/check-env-docs
  // scans for `process.env.NAME`, and a computed lookup is invisible to it — so
  // a dynamic read would drop this variable out of the deployment checklist the
  // owner works from, which is precisely the document that must not go stale.
  return String(process.env.FIELDQUO_SALES_NUMBER || "")
    .split(",")
    .map((s) => toE164(s.trim()))
    .filter(Boolean);
}

/** Is this one of FieldQuo's own? */
export function isSalesNumber(e164) {
  const want = toE164(e164);
  return Boolean(want) && salesNumbers().includes(want);
}

/**
 * Whether — and which — FieldQuo number a demo's receptionist screen may
 * invite a prospect to ring instead. Pure, so scripts/check-demo-number-pool
 * .mjs can execute it against every combination without a database or a
 * live deployment.
 *
 * Two gates, both required, mirroring the not_configured/unavailable
 * distinction app/api/settings/voice/voices/route.js draws: an unset
 * FIELDQUO_SALES_NUMBER and a set one nobody is answering on are different
 * states, and neither should read as a working number a prospect can dial.
 *
 * `isDemo` is the THIRD gate and the one that matters most: this must return
 * null for every company that isn't a demo, full stop — a real contractor's
 * receptionist screen must never show FieldQuo's own phone number. See the
 * white-label rule (AGENTS.md non-negotiable #1) and the comment on the one
 * caller, app/api/settings/voice/route.js, for why this specific exception is
 * deliberate rather than a leak.
 */
export function demoInviteNumber({ isDemo, numbers, agentEnabled }) {
  if (!isDemo) return null;
  if (!Array.isArray(numbers) || !numbers.length) return null;
  if (!agentEnabled) return null;
  return numbers[0];
}

/**
 * Configuration mistakes we can see from here.
 *
 * Returned rather than thrown: a bad value must not take down the webhook that
 * records calls, and the honest place for it is the readiness screen.
 */
export async function salesNumberProblems() {
  const numbers = salesNumbers();
  const problems = [];

  for (const e164 of numbers) {
    if (isSharedTestNumber(e164)) {
      problems.push({
        e164,
        code: "is_test_number",
        detail:
          "This is the shared receptionist test number. Claiming it for the " +
          "sales line takes away the only way to try a tenant receptionist, " +
          "and the next test takes it back.",
      });
    }
  }

  // A tenant holding the same number is the expensive collision, and it is
  // cheap to ask.
  if (numbers.length) {
    const clashes = await db.voicePhoneNumber
      .findMany({ where: { e164: { in: numbers } }, select: { e164: true, companyId: true } })
      .catch(() => []);
    for (const c of clashes) {
      problems.push({
        e164: c.e164,
        code: "belongs_to_tenant",
        detail:
          `A company already holds ${c.e164}. Their callers would be answered ` +
          "by FieldQuo's sales agent. Remove it from " +
          `${SALES_NUMBER_ENV} before anything else.`,
      });
    }
  }

  return problems;
}

/**
 * One provider call object → the columns PlatformVoiceCall keeps.
 *
 * ── Why this is a function and not two copies ──────────────────────────────
 *
 * There are two readers of the same payload: the webhook (recordSalesCall) and
 * the reconciler (reconcileSalesCall), and they disagree only about how
 * assertively to WRITE, never about what a field means. Written twice, they
 * drifted immediately — the reconciler did not exist yet, and the webhook copy
 * read `transcript_object`, which is the field that DROPS every tool call.
 * lib/voice/transcript.js explains at length why `transcript_with_tool_calls`
 * is the one to store: without it, "book_visit failed" and "book_visit was
 * never called" are indistinguishable in our copy of a call. The tenant path
 * has gone through transcriptFrom since that was found; FieldQuo's own sales
 * calls, the ones the owner actually reads, were still losing them.
 *
 * `durationSec` is null rather than 0 when the provider gave us nothing to go
 * on. Nothing bills a sales call, so this is not a charge — but writing 0 for
 * "we don't know" is what let a `call_analyzed` with no duration blank the real
 * length `call_ended` had already recorded.
 */
export function salesCallFields(call = {}) {
  return {
    providerAgentId: call.agent_id || null,
    direction: call.direction === "outbound" ? "outbound" : "inbound",
    fromE164: toE164(call.from_number),
    toE164: toE164(call.to_number),
    startedAt: call.start_timestamp ? new Date(call.start_timestamp) : null,
    endedAt: call.end_timestamp ? new Date(call.end_timestamp) : null,
    durationSec: durationSecondsOf(call),
    disposition: call.disconnection_reason || null,
    // The tool calls included. See the header above.
    transcript: transcriptFrom(call),
    summary: call.call_analysis?.call_summary || null,
    recordingUrl: call.recording_url || null,
  };
}

/**
 * Record what the provider just told us about a call to FieldQuo's own line.
 *
 * Deliberately narrower than the tenant path next to it: no billing, no credit
 * check, no attachment sync. FieldQuo's own minutes are FieldQuo's own cost and
 * already show up in the shared-pool spend on /platform/voice-health, so
 * charging them to somebody would need a somebody.
 *
 * Upserts on the provider's call id, because Retell sends three events for one
 * call and retries any of them. `create` and `update` are deliberately
 * different: a retried call_started must not blank a row that call_analyzed has
 * already filled in, which is why the update half sets `undefined` rather than
 * `null` for anything the event did not carry.
 *
 * @param type  the Retell event name
 * @param call  the `call` object from the payload
 * @param prisma  injectable for the same reason reconcileVoiceCalls' deps are
 * @returns { recorded: true } or { recorded: false, ignored }
 */
export async function recordSalesCall({ type, call = {}, prisma = db, now = new Date() } = {}) {
  const providerCallId = call.call_id;
  if (!providerCallId) return { recorded: false, ignored: "no_call_id" };

  const f = salesCallFields(call);
  const common = {
    providerAgentId: f.providerAgentId || undefined,
    direction: f.direction,
    fromE164: f.fromE164,
    toE164: f.toE164,
  };

  if (type === "call_started") {
    await prisma.platformVoiceCall.upsert({
      where: { providerCallId },
      create: {
        providerCallId,
        ...common,
        startedAt: f.startedAt || now,
      },
      // A second call_started is a retry. It must not reset a row that already
      // holds a transcript.
      update: {},
    });
    return { recorded: true };
  }

  if (type === "call_ended" || type === "call_analyzed") {
    const seconds = f.durationSec;

    await prisma.platformVoiceCall.upsert({
      where: { providerCallId },
      create: {
        providerCallId,
        ...common,
        startedAt: f.startedAt,
        endedAt: f.endedAt || now,
        // Omitted when unknown, so the column's own default stands rather than
        // this path asserting a zero-length call it has no evidence for.
        ...(seconds === null ? {} : { durationSec: seconds }),
        disposition: f.disposition,
        transcript: f.transcript,
        summary: f.summary,
        recordingUrl: f.recordingUrl,
      },
      update: {
        endedAt: f.endedAt || now,
        // undefined, not null: call_ended arrives before call_analyzed and
        // carries no summary, and writing null here would erase the summary a
        // later retry of call_ended is arriving after. The same reasoning now
        // covers the duration, which used to be written as a hard 0.
        ...(seconds === null ? {} : { durationSec: seconds }),
        disposition: f.disposition || undefined,
        transcript: f.transcript || undefined,
        summary: f.summary || undefined,
        recordingUrl: f.recordingUrl || undefined,
        providerAgentId: f.providerAgentId || undefined,
      },
    });
    return { recorded: true, seconds };
  }

  // An event we do not handle. Not an error — see the tenant webhook's note on
  // returning 200 for unknown types rather than making the provider retry.
  return { recorded: false, ignored: type };
}

/**
 * The same call, arriving from the RECONCILER instead of the webhook.
 *
 * ══ The gap this closes ════════════════════════════════════════════════════
 *
 * lib/voice/reconcileCalls.js exists because a webhook is a fast path and never
 * the only path — a dropped delivery is byte-for-byte identical to a phone
 * nobody rang. But it maps every call it sees through `voicePhoneNumber`, and
 * FieldQuo's own sales line has no row in that table by construction (see this
 * file's header). So a sales call whose webhook was dropped had no second path
 * at all: no retry, no sweep, no recovery, and the record simply stayed wrong
 * for ever — on the one line the owner reads every word of.
 *
 * This is a SECOND recognition alongside the tenant one, not a reroute — the
 * same shape lib/billing/subscriptionChargeEvent.js used for refunds that land
 * on a FieldQuo subscription rather than a Connect payment. The tenant lookup
 * still runs first and unchanged; this only ever sees calls it already declined.
 *
 * ══ Gap-fill, never stomp ══════════════════════════════════════════════════
 *
 * Mirrors upsertCallRow in reconcileCalls.js rather than sharing it: that one
 * writes VoiceCall, with a company, a number, a charge and a `recoveredAt`
 * badge a contractor reads. This one writes a different table with none of
 * those. What IS shared is the field mapping above, which is where the two
 * could actually have disagreed.
 *
 * The transcript is not on a list item — v3 list-calls omits it deliberately —
 * so the detail is fetched, and only when it would add something: a row that
 * does not exist, or one still missing its words.
 *
 * @param call        the list item from the provider
 * @param fetchDetail single-call read, injected
 * @returns { recorded, created } or { recorded: false, ignored }
 */
export async function reconcileSalesCall({
  call = {},
  prisma = db,
  fetchDetail = null,
  now = new Date(),
} = {}) {
  const providerCallId = call.call_id;
  if (!providerCallId) return { recorded: false, ignored: "no_call_id" };

  let existing = null;
  try {
    existing = await prisma.platformVoiceCall.findUnique({
      where: { providerCallId },
      select: { transcript: true, summary: true, recordingUrl: true, durationSec: true },
    });
  } catch {
    // Unreadable is treated as absent, same as the tenant path: the upsert is
    // still correct and the worst case is a detail read we didn't need.
  }

  let detail = null;
  if (fetchDetail && (!existing || existing.transcript === null)) {
    try {
      detail = await fetchDetail(providerCallId);
    } catch (err) {
      console.error("[sales-call] no transcript for", providerCallId, err?.message);
    }
  }

  // Detail first where both have a field — it is the richer read — falling back
  // to the list item. Merged rather than chosen wholesale so a failed detail
  // read costs the transcript and nothing else.
  const listed = salesCallFields(call);
  const full = detail ? salesCallFields(detail) : {};
  const f = {
    ...listed,
    ...Object.fromEntries(Object.entries(full).filter(([, v]) => v !== null && v !== undefined)),
  };

  try {
    await prisma.platformVoiceCall.upsert({
      where: { providerCallId },
      create: {
        providerCallId,
        providerAgentId: f.providerAgentId,
        direction: f.direction,
        fromE164: f.fromE164,
        toE164: f.toE164,
        startedAt: f.startedAt,
        endedAt: f.endedAt,
        ...(f.durationSec === null ? {} : { durationSec: f.durationSec }),
        disposition: f.disposition,
        transcript: f.transcript,
        summary: f.summary,
        recordingUrl: f.recordingUrl,
      },
      update: {
        // Gap-fill only. A row the webhook wrote keeps everything it has; a row
        // that never got a webhook gets what the provider still holds. Writing
        // over a delivered value would make this sweep the thing that loses a
        // transcript rather than the thing that recovers one.
        ...(f.endedAt ? { endedAt: f.endedAt } : {}),
        ...(f.durationSec !== null && !existing?.durationSec
          ? { durationSec: f.durationSec }
          : {}),
        ...(f.transcript && existing?.transcript === null ? { transcript: f.transcript } : {}),
        ...(f.summary && existing?.summary === null ? { summary: f.summary } : {}),
        ...(f.recordingUrl && existing?.recordingUrl === null
          ? { recordingUrl: f.recordingUrl }
          : {}),
        ...(f.disposition ? { disposition: f.disposition } : {}),
        ...(f.providerAgentId ? { providerAgentId: f.providerAgentId } : {}),
      },
    });
  } catch (err) {
    console.error("[sales-call] couldn't reconcile", providerCallId, err?.message);
    return { recorded: false, ignored: "write_failed" };
  }

  return { recorded: true, created: !existing, at: now };
}

/**
 * The calls, newest first, for /platform/sales-agent.
 *
 * The transcript is included: it is the entire reason the screen exists, and
 * fetching it per row on expand would be three round trips for a list that is
 * short by construction — FieldQuo has one sales line.
 */
export async function recentSalesCalls(limit = 50) {
  return db.platformVoiceCall.findMany({
    orderBy: [{ startedAt: "desc" }, { createdAt: "desc" }],
    take: Math.min(200, Math.max(1, limit)),
  });
}

/** Has anything ever landed? The one honest proof the webhook works. */
export async function salesCallDeliveryEvidence() {
  const [count, last] = await Promise.all([
    db.platformVoiceCall.count().catch(() => 0),
    db.platformVoiceCall
      .findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true } })
      .catch(() => null),
  ]);
  return { count, lastAt: last?.createdAt || null };
}
