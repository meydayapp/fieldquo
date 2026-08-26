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
  return String(process.env[SALES_NUMBER_ENV] || "")
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
 * @returns { recorded: true } or { recorded: false, ignored }
 */
export async function recordSalesCall({ type, call = {} } = {}) {
  const providerCallId = call.call_id;
  if (!providerCallId) return { recorded: false, ignored: "no_call_id" };

  const common = {
    providerAgentId: call.agent_id || undefined,
    direction: call.direction === "outbound" ? "outbound" : "inbound",
    fromE164: toE164(call.from_number),
    toE164: toE164(call.to_number),
  };

  if (type === "call_started") {
    await db.platformVoiceCall.upsert({
      where: { providerCallId },
      create: {
        providerCallId,
        ...common,
        startedAt: call.start_timestamp ? new Date(call.start_timestamp) : new Date(),
      },
      // A second call_started is a retry. It must not reset a row that already
      // holds a transcript.
      update: {},
    });
    return { recorded: true };
  }

  if (type === "call_ended" || type === "call_analyzed") {
    const seconds = Math.max(
      0,
      Math.round(
        Number(call.duration_ms ? call.duration_ms / 1000 : call.duration_seconds) || 0,
      ),
    );

    await db.platformVoiceCall.upsert({
      where: { providerCallId },
      create: {
        providerCallId,
        ...common,
        startedAt: call.start_timestamp ? new Date(call.start_timestamp) : null,
        endedAt: new Date(),
        durationSec: seconds,
        disposition: call.disconnection_reason || null,
        transcript: call.transcript_object || call.transcript || null,
        summary: call.call_analysis?.call_summary || null,
        recordingUrl: call.recording_url || null,
      },
      update: {
        endedAt: new Date(),
        durationSec: seconds,
        // undefined, not null: call_ended arrives before call_analyzed and
        // carries no summary, and writing null here would erase the summary a
        // later retry of call_ended is arriving after.
        disposition: call.disconnection_reason || undefined,
        transcript: call.transcript_object || call.transcript || undefined,
        summary: call.call_analysis?.call_summary || undefined,
        recordingUrl: call.recording_url || undefined,
        providerAgentId: call.agent_id || undefined,
      },
    });
    return { recorded: true, seconds };
  }

  // An event we do not handle. Not an error — see the tenant webhook's note on
  // returning 200 for unknown types rather than making the provider retry.
  return { recorded: false, ignored: type };
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
