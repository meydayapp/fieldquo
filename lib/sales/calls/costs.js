// lib/sales/calls/costs.js
//
// What one sales call cost FieldQuo, and what a period of them cost — read
// from the provider and the ledger, never estimated.
//
// ══ Four parts, each with its own source ═════════════════════════════════
//
//   carrier        SalesCallAttempt.providerCostCents — Twilio's own price
//                  for the call. The status callback usually arrives before
//                  Twilio has priced the call, so most rows are null at first
//                  and reconcileCarrierPrices() asks the Calls resource later
//                  (every leg: the rep's browser leg AND the PSTN leg, since
//                  both are billed). Null stays null and prints as unknown.
//   recording      recordingSeconds × RECORDING_CENTS_PER_MINUTE. The one
//                  figure here that is a list price times a measurement
//                  rather than an invoice line, and it says so: Twilio bills
//                  recordings at $0.0025 a minute and the seconds are the
//                  carrier's. The cached Usage Records on /platform/costs are
//                  the invoice-side check on it.
//   transcription  PlatformAiUsage, ref `transcript:<recordingSid>` —
//                  lib/sales/calls/transcribe.js meters Whisper by the audio
//                  minute and writes exactly one row per recording.
//   qa             PlatformAiUsage, ref `qa:<attemptId>…`, read by PREFIX so
//                  the scorecard's metering (lib/sales/calls/qa.js, landing
//                  beside this) is found whatever suffix it chooses; and,
//                  failing that, SalesCallQa.costMicros on the scorecard row.
//
// ══ Unknown is printed as unknown ════════════════════════════════════════
//
// A call whose carrier price has not landed is not a free call. `knownCents`
// is the sum of the parts that exist and `unknown` names the parts that do
// not, per call and per period, so a screen prints "$4.12 + 3 calls not yet
// priced" rather than "$4.12". The page that divides by conversations says
// the same thing beside the quotient.
//
// ══ The pure half and the async half ═════════════════════════════════════
//
// Everything above the first `import { db }` line takes rows as arguments,
// for the reason reporting.js gives; scripts/check-sales-costs.mjs executes
// it on synthetic rows. The async functions below it are the reads.

import { db } from "@/lib/db";
import { twilioRest, twilioConfigured } from "@/lib/sms/twilioClient";
import { recordError } from "@/lib/platform/errorLog";
import { callCostCents } from "./browserDial";
import { TRANSCRIBE_AREA } from "./transcribe";

/** Twilio's list price for call recording, US dollars per recorded minute. */
export const RECORDING_USD_PER_MINUTE = 0.0025;
/** The same, in the cents every other figure here is in. */
export const RECORDING_CENTS_PER_MINUTE = RECORDING_USD_PER_MINUTE * 100;

export const TRANSCRIPT_REF_PREFIX = "transcript:";
export const QA_REF_PREFIX = "qa:";

/** The four parts, in the order a screen prints them. */
export const COST_PARTS = Object.freeze(["carrier", "recording", "transcription", "qa"]);

export const COST_SOURCES = Object.freeze({
  carrier: "Twilio Calls resource price, per leg (SalesCallAttempt.providerCostCents)",
  recording: `Twilio list price $${RECORDING_USD_PER_MINUTE}/min × recorded seconds (SalesCallAttempt.recordingSeconds)`,
  transcription: "PlatformAiUsage ref transcript:<recordingSid> (Whisper, metered by audio minute)",
  qa: "PlatformAiUsage ref qa:<attemptId> or SalesCallQa.costMicros",
});

function num(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

const round4 = (n) => Math.round(n * 10000) / 10000;

/** Cents for a recording of `seconds`. Null when nothing was recorded. */
export function recordingCostCents(recordingSeconds) {
  const s = num(recordingSeconds);
  if (s === null || s < 0) return null;
  return round4((s / 60) * RECORDING_CENTS_PER_MINUTE);
}

/** The refs transcribe.js could have written for this row. */
export function transcriptRefsFor(row) {
  const refs = [];
  if (row?.recordingSid) refs.push(`${TRANSCRIPT_REF_PREFIX}${row.recordingSid}`);
  if (row?.id) refs.push(`${TRANSCRIPT_REF_PREFIX}${row.id}`);
  return refs;
}

/**
 * Match PlatformAiUsage rows to attempts by ref.
 *
 * @param aiRows    [{ ref, costMicros, area }]
 * @param attempts  [{ id, recordingSid }]
 * @returns Map<attemptId, { transcriptionMicros, transcriptionRows, qaMicros, qaRows, qaUnpriced }>
 */
export function aiCostsByAttempt(aiRows, attempts) {
  const byRef = new Map();
  const byId = new Map();
  const out = new Map();
  for (const a of Array.isArray(attempts) ? attempts : []) {
    if (!a?.id) continue;
    const entry = { transcriptionMicros: null, transcriptionRows: 0, qaMicros: null, qaRows: 0, qaUnpriced: 0 };
    out.set(a.id, entry);
    byId.set(a.id, entry);
    for (const ref of transcriptRefsFor(a)) byRef.set(ref, entry);
  }
  // QA refs are `qa:<attemptId>` with an optional suffix. Longest ids first
  // so `qa:abc` cannot claim a row written for `qa:abcd`.
  const ids = [...byId.keys()].sort((x, y) => y.length - x.length);
  for (const r of Array.isArray(aiRows) ? aiRows : []) {
    const ref = typeof r?.ref === "string" ? r.ref : "";
    if (!ref) continue;
    const micros = num(r.costMicros);
    if (ref.startsWith(TRANSCRIPT_REF_PREFIX)) {
      const entry = byRef.get(ref);
      if (!entry) continue;
      entry.transcriptionRows += 1;
      if (micros !== null) entry.transcriptionMicros = (entry.transcriptionMicros || 0) + micros;
      continue;
    }
    if (ref.startsWith(QA_REF_PREFIX)) {
      const rest = ref.slice(QA_REF_PREFIX.length);
      const id = ids.find((candidate) => rest === candidate || rest.startsWith(`${candidate}:`));
      if (!id) continue;
      const entry = byId.get(id);
      entry.qaRows += 1;
      if (micros !== null) entry.qaMicros = (entry.qaMicros || 0) + micros;
      else entry.qaUnpriced += 1;
    }
  }
  return out;
}

/** A bridged call whose carrier price is expected: it went through Twilio and has ended. */
function carrierExpected(row) {
  if (!row || row.dialChannel === "handset") return false;
  if (!row.providerCallSid) return false;
  return Boolean(row.endedAt || row.providerStatus);
}

/**
 * One call's cost, composed.
 *
 * @param row  SalesCallAttempt
 * @param ai   the aiCostsByAttempt() entry for it, or nothing
 * @param qa   the SalesCallQa row for it ({ costMicros }), or nothing
 */
export function callCost(row, ai = null, qa = null) {
  const carrier = num(row?.providerCostCents);
  const recording = row?.recordingSid || num(row?.recordingSeconds) !== null ? recordingCostCents(row?.recordingSeconds) : null;
  const transcriptionMicros = ai?.transcriptionMicros ?? null;
  const transcription = transcriptionMicros === null ? null : round4(transcriptionMicros / 10000);
  let qaMicros = ai?.qaMicros ?? null;
  if (qaMicros === null && qa && num(qa.costMicros) !== null) qaMicros = num(qa.costMicros);
  const qaCents = qaMicros === null ? null : round4(qaMicros / 10000);

  const unknown = [];
  if (carrier === null && carrierExpected(row)) unknown.push("carrier");
  if (recording === null && row?.recordingSid) unknown.push("recording");
  if (transcription === null && row?.transcribedAt) unknown.push("transcription");
  if (qaCents === null && (ai?.qaUnpriced > 0 || (qa && !qa.skippedReason))) unknown.push("qa");

  const known = [carrier, recording, transcription, qaCents].filter((v) => v !== null);
  return {
    carrierCents: carrier,
    recordingCents: recording,
    transcriptionCents: transcription,
    qaCents,
    knownCents: round4(known.reduce((s, v) => s + v, 0)),
    unknown,
    complete: unknown.length === 0,
  };
}

/**
 * A period's calls, summed, with what could not be summed counted.
 *
 * @param attempts  rows, already without test dials
 * @param aiMap     aiCostsByAttempt() over the same rows
 * @param qaMap     Map<attemptId, SalesCallQa> or nothing
 */
export function periodCallCosts(attempts, aiMap = new Map(), qaMap = new Map()) {
  const rows = Array.isArray(attempts) ? attempts : [];
  const sum = { carrier: 0, recording: 0, transcription: 0, qa: 0 };
  const of = { carrier: 0, recording: 0, transcription: 0, qa: 0 };
  const unknown = { carrier: 0, recording: 0, transcription: 0, qa: 0 };
  let browser = 0;
  let complete = 0;
  for (const row of rows) {
    if (row?.dialChannel === "browser") browser += 1;
    const c = callCost(row, aiMap.get?.(row?.id) || null, qaMap.get?.(row?.id) || null);
    if (c.carrierCents !== null) { sum.carrier += c.carrierCents; of.carrier += 1; }
    if (c.recordingCents !== null) { sum.recording += c.recordingCents; of.recording += 1; }
    if (c.transcriptionCents !== null) { sum.transcription += c.transcriptionCents; of.transcription += 1; }
    if (c.qaCents !== null) { sum.qa += c.qaCents; of.qa += 1; }
    for (const part of c.unknown) unknown[part] += 1;
    if (c.complete) complete += 1;
  }
  const parts = COST_PARTS.map((key) => ({
    key,
    cents: of[key] > 0 ? round4(sum[key]) : null,
    of: of[key],
    unknown: unknown[key],
    source: COST_SOURCES[key],
  }));
  const knownCents = round4(COST_PARTS.reduce((s, k) => s + sum[k], 0));
  const unknownCalls = rows.length - complete;
  return {
    calls: rows.length,
    browserCalls: browser,
    parts,
    knownCents,
    /** Calls with at least one part not yet known. */
    unknownCalls,
    complete: unknownCalls === 0,
  };
}

/**
 * The quotient, labelled. Null when there is nothing to divide by; a floor
 * — said as one — when some cost is still unknown.
 */
export function costPerConversation({ knownCents, conversations, unknownCalls = 0, unknownConversations = 0 } = {}) {
  const cents = num(knownCents);
  const n = num(conversations) || 0;
  if (cents === null || n <= 0) {
    return {
      cents: null,
      conversations: n,
      isFloor: false,
      statement:
        n <= 0
          ? "No conversations yet in this period, so there is nothing to divide by."
          : "No cost is known for this period yet.",
    };
  }
  const per = round4(cents / n);
  const floor = unknownCalls > 0;
  const pending = unknownConversations > 0 ? ` ${unknownConversations} connected ${unknownConversations === 1 ? "call is" : "calls are"} not yet transcribed and not in the count.` : "";
  return {
    cents: per,
    conversations: n,
    isFloor: floor,
    statement: floor
      ? `A floor: ${unknownCalls} ${unknownCalls === 1 ? "call has" : "calls have"} a cost part not yet known.${pending}`
      : `Every part of every call in the period is known.${pending}`,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// The reads
// ═══════════════════════════════════════════════════════════════════════════

/** Twilio prices a call minutes after it ends; ask no sooner than this. */
export const PRICE_SETTLE_MS = 3 * 60 * 1000;
/** Ask again for a still-unpriced call no more often than this. */
export const PRICE_RETRY_MS = 60 * 60 * 1000;
/** Stop asking about a call older than this: a price that has not landed in a fortnight is not coming. */
export const PRICE_LOOKBACK_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Every leg's price for one attempt, or null while any leg is unpriced.
 *
 * The rep's browser leg is the PARENT of an outbound bridge (the browser
 * dials Twilio, the <Dial> makes the PSTN child); an inbound call's parent is
 * the contractor's leg and the rep's browser is a child. Either way: fetch
 * the parent, list its children, and sum only when every leg has a price —
 * Twilio prices them together, and a half-priced call written as a whole one
 * would be the estimate this file refuses.
 *
 * @returns {{ cents: number, legs: number } | { cents: null, legs: number, reason: string }}
 */
export async function fetchLegPrices({ parentSid, twilio = twilioRest } = {}) {
  if (!parentSid) return { cents: null, legs: 0, reason: "no_sid" };
  const parent = await twilio.calls(parentSid).fetch();
  const children = await twilio.calls.list({ parentCallSid: parentSid, limit: 20 });
  const legs = [parent, ...(Array.isArray(children) ? children : [])];
  let cents = 0;
  for (const leg of legs) {
    const c = callCostCents(leg?.price);
    if (c === null) return { cents: null, legs: legs.length, reason: "unpriced_leg" };
    cents += c;
  }
  return { cents: round4(cents), legs: legs.length };
}

/**
 * Which CallSid is the parent for pricing purposes. See fetchLegPrices.
 */
export function parentSidFor(row) {
  if (!row) return null;
  if (row.direction !== "in" && row.repCallSid) return row.repCallSid;
  return row.providerCallSid || null;
}

/**
 * The sweep: bridged calls that ended, have no carrier price, and have not
 * been asked about in the last hour. Small batches — it runs from the
 * every-minute sales-pipeline cron beside the missed-call sweep.
 */
export async function reconcileCarrierPrices({ client = db, twilio = twilioRest, now = new Date(), limit = 10, log = () => {} } = {}) {
  if (!twilioConfigured()) return { considered: 0, priced: 0, unpriced: 0, failed: 0, skipped: "twilio_not_configured" };
  const rows = await client.salesCallAttempt.findMany({
    where: {
      dialChannel: { in: ["browser", "inbound"] },
      providerCallSid: { not: null },
      providerCostCents: null,
      dialledAt: { gte: new Date(now.getTime() - PRICE_LOOKBACK_MS), lte: new Date(now.getTime() - PRICE_SETTLE_MS) },
      OR: [{ providerPriceCheckedAt: null }, { providerPriceCheckedAt: { lt: new Date(now.getTime() - PRICE_RETRY_MS) } }],
    },
    orderBy: { dialledAt: "desc" },
    take: Math.max(1, Math.min(50, Number(limit) || 10)),
    select: { id: true, direction: true, providerCallSid: true, repCallSid: true, providerStatus: true, endedAt: true },
  });
  let priced = 0;
  let unpriced = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const r = await fetchLegPrices({ parentSid: parentSidFor(row), twilio });
      if (r.cents === null) {
        unpriced += 1;
        // eslint-disable-next-line no-await-in-loop
        await client.salesCallAttempt.updateMany({ where: { id: row.id, providerCostCents: null }, data: { providerPriceCheckedAt: now } });
        continue;
      }
      // eslint-disable-next-line no-await-in-loop
      await client.salesCallAttempt.updateMany({
        where: { id: row.id, providerCostCents: null },
        data: { providerCostCents: r.cents, providerPriceCheckedAt: null },
      });
      priced += 1;
      log(`carrier price: attempt ${row.id} ${r.cents}¢ over ${r.legs} legs`);
    } catch (err) {
      failed += 1;
      // A 404 is a call Twilio no longer has (or a test-line row with a made
      // up sid): stamp it so it is not asked about every hour for a fortnight.
      const gone = err?.status === 404 || err?.code === 20404;
      // eslint-disable-next-line no-await-in-loop
      await client.salesCallAttempt.updateMany({ where: { id: row.id }, data: { providerPriceCheckedAt: gone ? new Date(now.getTime() + PRICE_LOOKBACK_MS) : now } }).catch(() => {});
      // eslint-disable-next-line no-await-in-loop
      await recordError({
        area: "sales_costs",
        code: gone ? "call_not_found" : "price_fetch_failed",
        message: `Could not read Twilio's price for attempt ${row.id}: ${err?.message || err}`,
      }).catch(() => {});
    }
  }
  return { considered: rows.length, priced, unpriced, failed };
}

/**
 * The AI ledger rows and QA rows for a set of attempts, matched.
 *
 * @returns {{ aiMap: Map, qaMap: Map }}
 */
export async function aiCostsFor(attempts, { client = db } = {}) {
  const rows = (Array.isArray(attempts) ? attempts : []).filter((a) => a?.id);
  if (!rows.length) return { aiMap: new Map(), qaMap: new Map() };
  const refs = rows.flatMap(transcriptRefsFor);
  const ids = rows.map((r) => r.id);
  const earliest = rows.reduce((min, r) => {
    const t = r.dialledAt ? new Date(r.dialledAt).getTime() : NaN;
    return Number.isFinite(t) && t < min ? t : min;
  }, Infinity);
  const since = Number.isFinite(earliest) ? new Date(earliest - 60 * 60 * 1000) : null;

  const aiRows = await client.platformAiUsage.findMany({
    where: {
      OR: [
        { ref: { in: refs } },
        // QA rows for a call are written after the call, sometimes much later;
        // bounded by the earliest dial in the set rather than the period so a
        // scorecard run overnight still lands on yesterday's call.
        { ref: { startsWith: QA_REF_PREFIX }, ...(since ? { createdAt: { gte: since } } : {}) },
        { area: TRANSCRIBE_AREA, ref: { in: refs } },
      ],
    },
    select: { ref: true, costMicros: true, area: true },
  });
  const aiMap = aiCostsByAttempt(aiRows, rows);

  // The scorecard row's own figure, when the table exists in this build's
  // client. Guarded: this lands beside lib/sales/calls/qa.js and must work
  // whether or not that has.
  const qaMap = new Map();
  if (client.salesCallQa?.findMany) {
    try {
      const qaRows = await client.salesCallQa.findMany({
        where: { attemptId: { in: ids } },
        select: { attemptId: true, costMicros: true, skippedReason: true },
      });
      for (const q of qaRows) qaMap.set(q.attemptId, q);
    } catch {
      /* the table is not there yet — QA cost reads as not applicable */
    }
  }
  return { aiMap, qaMap };
}

/**
 * A period's call costs from the store: the attempts handed in, their AI
 * rows fetched, composed. Test dials are the caller's to exclude (the board
 * already has).
 */
export async function attemptCosts(attempts, { client = db } = {}) {
  const { aiMap, qaMap } = await aiCostsFor(attempts, { client });
  return {
    period: periodCallCosts(attempts, aiMap, qaMap),
    byAttempt: new Map((Array.isArray(attempts) ? attempts : []).map((a) => [a.id, callCost(a, aiMap.get(a.id), qaMap.get(a.id))])),
  };
}
