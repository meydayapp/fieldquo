// lib/sales/calls/qaQueue.js
//
// The call-quality review queue, the one call opened from it, and the human
// pass — read and written for two doors: the platform console (superadmin,
// every rep) and an agency's portal (its own employees, nobody else).
//
// ══ One reader, scoped by a list of rep ids ═══════════════════════════════
//
// `repIds: null` is everyone and only the superadmin routes pass it. An
// array is a team, and the agency routes build it FRESH on every request
// from lib/sales/agency.js agencyTeamIds() through lib/sales/team.js —
// never from a cached list, never from a claim in the request body. A rep
// moved off the agency's line at 09:00 is off its queue at 09:01, and
// scripts/check-call-qa.mjs moves one between two calls to prove it.
//
// An out-of-scope call is a null / an empty answer, not a 403: a 403 would
// confirm to the asker that the row exists.
//
// ══ The rep never hears the recording ═════════════════════════════════════
//
// lib/sales/calls/recordingsList.js's header: the rep is told the call is
// recorded, which is the disclosure, not a listening right. So the rep's
// own reader (repCallQuality) hands back scores and the coaching sentences
// and nothing else — no transcript, no audio, and never another rep's row.
// The agency DOES hear its employees' calls: it is the employer, and the
// owner's brief puts it in his own seat for its team. The audio proxy for
// that door is app/api/sales/agency/recording/[id]/audio, and it calls
// agencyCanHear() below — a fresh read, per request.
//
// ══ The human pass overrides ══════════════════════════════════════════════
//
// reviewCallQa() writes reviewerOverall / reviewerNote and stamps who
// (reviewerKind says which table the id is from). lib/sales/callQuality.js
// effectiveOverall() is what every rollup reads, so the moment a review
// lands the performance page shows the human number. A review on a call
// that was never scored creates the row — the owner listening to an
// "unscorable" call and writing 30 is a real judgement — with the
// deterministic half computed from the transcript so the line-level flags
// still draw.
import { db } from "@/lib/db";
import { excludingTestDials, prospectDialsOnly, withoutTestDials } from "@/lib/sales/testLines";
import { effectiveOverall, isFailedScore } from "@/lib/sales/callQuality";
import { analyseTranscript, SKIP_REASONS } from "./qa";

export const QA_QUEUE_MAX = 500;
export const MAX_REVIEW_NOTE = 2000;

/** Which door the reviewer came through. Two tables, so the id alone is ambiguous. */
export const REVIEWER_KINDS = Object.freeze(["platform", "agency"]);

const ATTEMPT_SELECT = {
  id: true,
  direction: true,
  dialledAt: true,
  answeredAt: true,
  talkSeconds: true,
  disposition: true,
  recordingUrl: true,
  recordingSeconds: true,
  transcribedAt: true,
  transcriptError: true,
  playbookKey: true,
  playbookVersion: true,
  jurisdictionCode: true,
  salesRepId: true,
  salesRep: { select: { id: true, name: true, language: true } },
  prospect: { select: { id: true, businessName: true, city: true, province: true, tradeKey: true } },
};

const QA_SELECT = {
  id: true,
  scoredAt: true,
  model: true,
  costMicros: true,
  playbookKey: true,
  playbookVersion: true,
  playbookMatched: true,
  language: true,
  deterministic: true,
  scores: true,
  coaching: true,
  overall: true,
  skippedReason: true,
  reviewerId: true,
  reviewerKind: true,
  reviewerName: true,
  reviewedAt: true,
  reviewerOverall: true,
  reviewerNote: true,
};

function iso(d) {
  return d?.toISOString?.() || null;
}

function scopeWhere(repIds) {
  if (repIds === null || repIds === undefined) return {};
  return { salesRepId: { in: Array.isArray(repIds) ? repIds : [] } };
}

/** The queue row shape. Pure; exported for the check. */
export function queueRow(attempt) {
  const qa = attempt.qa || null;
  const effective = effectiveOverall(qa);
  return {
    id: attempt.id,
    dialledAt: iso(attempt.dialledAt),
    answeredAt: iso(attempt.answeredAt),
    talkSeconds: Number.isFinite(attempt.talkSeconds) ? attempt.talkSeconds : null,
    recordingSeconds: Number.isFinite(attempt.recordingSeconds) ? attempt.recordingSeconds : null,
    disposition: attempt.disposition || null,
    rep: attempt.salesRep ? { id: attempt.salesRep.id, name: attempt.salesRep.name } : null,
    business: attempt.prospect
      ? { id: attempt.prospect.id, name: attempt.prospect.businessName, city: attempt.prospect.city, province: attempt.prospect.province }
      : null,
    playbookKey: attempt.playbookKey || null,
    transcribed: Boolean(attempt.transcribedAt),
    transcriptError: attempt.transcriptError || null,
    state: !attempt.transcribedAt
      ? attempt.transcriptError
        ? "transcript_failed"
        : "awaiting_transcript"
      : !qa
        ? "awaiting_score"
        : effective === null
          ? isFailedScore(qa)
            ? "score_failed"
            : "unscorable"
          : "scored",
    overall: Number.isFinite(qa?.overall) ? qa.overall : null,
    reviewerOverall: Number.isFinite(qa?.reviewerOverall) ? qa.reviewerOverall : null,
    effectiveOverall: effective,
    reviewedAt: iso(qa?.reviewedAt),
    reviewerName: qa?.reviewerName || null,
    reviewerKind: qa?.reviewerKind || null,
    skippedReason: qa?.skippedReason || null,
    disclosureSaid: qa?.deterministic?.disclosure?.said ?? null,
    bannedMoves: (qa?.deterministic?.bannedMoves?.length || 0) + (qa?.scores?.bannedMoves?.length || 0),
    talkRatio: typeof qa?.deterministic?.talk?.ratio === "number" ? qa.deterministic.talk.ratio : null,
  };
}

/**
 * The order a reviewer works in: unreviewed before reviewed, then the
 * lowest score first, then the calls with no score yet (awaiting, failed,
 * unscorable) — newest first inside each. Pure; exported for the check.
 */
export function orderForReview(rows) {
  const rank = (r) => {
    if (r.reviewedAt) return 3;
    if (r.effectiveOverall !== null) return 0;
    if (r.state === "awaiting_score" || r.state === "awaiting_transcript") return 1;
    return 2;
  };
  return [...rows].sort(
    (x, y) =>
      rank(x) - rank(y) ||
      (x.effectiveOverall ?? Infinity) - (y.effectiveOverall ?? Infinity) ||
      String(y.dialledAt).localeCompare(String(x.dialledAt)),
  );
}

/**
 * The queue: recorded calls, scoped, lowest-scored and unreviewed first.
 *
 * @param {{ repIds?: string[]|null, from?: Date|null, to?: Date|null,
 *           repId?: string|null, state?: string|null, limit?: number, client? }} args
 */
export async function callQaQueue({ repIds = null, from = null, to = null, repId = null, state = null, limit = 200, client = db } = {}) {
  const where = prospectDialsOnly({
    recordingUrl: { not: null },
    ...scopeWhere(repIds),
    ...(repId ? { salesRepId: repId } : {}),
    ...(from || to ? { dialledAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
  });
  // A rep asked for by id must ALSO be in scope — the AND keeps both.
  if (repId && Array.isArray(repIds) && !repIds.includes(repId)) return [];

  const rows = await client.salesCallAttempt.findMany({
    where,
    orderBy: { dialledAt: "desc" },
    take: QA_QUEUE_MAX,
    select: { ...ATTEMPT_SELECT, qa: { select: QA_SELECT } },
  });
  const shaped = orderForReview(withoutTestDials(rows).map(queueRow));
  const filtered = state ? shaped.filter((r) => r.state === state) : shaped;
  return filtered.slice(0, Math.max(1, Math.min(QA_QUEUE_MAX, Number(limit) || 200)));
}

/**
 * The transcript with the flagged lines marked: which segment carried the
 * disclosure, which made a banned move (by index, from the deterministic
 * half), and — from the model's quotes — which lines it cited as evidence.
 * Pure; exported for the check.
 */
export function flagTranscript(transcript, qa) {
  const segments = Array.isArray(transcript) ? transcript : [];
  const banned = new Map();
  for (const b of qa?.deterministic?.bannedMoves || []) {
    if (!banned.has(b.index)) banned.set(b.index, []);
    banned.get(b.index).push(b.move);
  }
  const disclosureIndex = qa?.deterministic?.disclosure?.index ?? null;
  const quotes = [];
  const s = qa?.scores || {};
  for (const key of ["identityCheck", "permissionAsk", "candour", "pivot", "discovery", "nextStep", "closeAsk"]) {
    const ev = s[key]?.evidence;
    if (typeof ev === "string" && ev.trim().length >= 12) quotes.push({ key, text: ev.trim().toLowerCase() });
  }
  for (const b of s.bannedMoves || []) {
    if (typeof b?.line === "string" && b.line.trim().length >= 8) quotes.push({ key: `banned:${b.move}`, text: b.line.trim().toLowerCase() });
  }
  return segments.map((seg, index) => {
    const text = typeof seg?.text === "string" ? seg.text : "";
    const lower = text.toLowerCase();
    const cited = quotes.filter((q) => lower.includes(q.text.slice(0, 40)) || q.text.includes(lower.slice(0, 40))).map((q) => q.key);
    return {
      index,
      speaker: seg?.speaker || "unknown",
      start: Number(seg?.start) || 0,
      end: Number(seg?.end) || 0,
      text,
      disclosure: index === disclosureIndex,
      bannedMoves: banned.get(index) || [],
      cited: [...new Set(cited)],
    };
  });
}

/**
 * One call, in full, or null when it is not in scope or does not exist.
 * `withTranscript: false` is the rep's own door.
 */
export async function callQaDetail({ attemptId, repIds = null, client = db } = {}) {
  const attempt = await client.salesCallAttempt.findFirst({
    where: excludingTestDials({ id: String(attemptId || ""), ...scopeWhere(repIds) }),
    select: { ...ATTEMPT_SELECT, transcript: true, transcriptText: true, qa: { select: QA_SELECT } },
  });
  if (!attempt) return null;
  const qa = attempt.qa || null;
  return {
    ...queueRow(attempt),
    playbookVersion: attempt.playbookVersion || null,
    repLanguage: attempt.salesRep?.language || null,
    transcript: flagTranscript(attempt.transcript, qa),
    qa: qa
      ? {
          ...qa,
          scoredAt: iso(qa.scoredAt),
          reviewedAt: iso(qa.reviewedAt),
          skippedReasonText: qa.skippedReason
            ? SKIP_REASONS[qa.skippedReason] || (isFailedScore(qa) ? `The model call failed: ${qa.skippedReason.slice("ai_failed:".length)}` : qa.skippedReason)
            : null,
        }
      : null,
  };
}

/**
 * A rep's own scorecards: their calls, the scores and the coaching, and
 * nothing that is somebody else's. No transcript, no audio.
 */
export async function repCallQuality({ repId, from = null, to = null, limit = 50, client = db } = {}) {
  if (!repId) return [];
  const rows = await callQaQueue({ repIds: [repId], from, to, limit, client });
  const ids = rows.map((r) => r.id);
  if (!ids.length) return [];
  const qas = await client.salesCallQa.findMany({
    where: { attemptId: { in: ids } },
    select: { attemptId: true, coaching: true, scores: true, deterministic: true, language: true, reviewerNote: true },
  });
  const byId = new Map(qas.map((q) => [q.attemptId, q]));
  return rows
    .filter((r) => r.effectiveOverall !== null || r.state === "unscorable")
    .map((r) => {
      const q = byId.get(r.id);
      return {
        id: r.id,
        dialledAt: r.dialledAt,
        business: r.business ? { name: r.business.name, city: r.business.city } : null,
        talkSeconds: r.talkSeconds,
        overall: r.effectiveOverall,
        reviewed: Boolean(r.reviewedAt),
        reviewerNote: q?.reviewerNote || null,
        coaching: Array.isArray(q?.coaching) ? q.coaching : [],
        language: q?.language || null,
        rubric: Array.isArray(q?.scores?.rubric) ? q.scores.rubric : [],
        disclosureSaid: r.disclosureSaid,
        bannedMoves: r.bannedMoves,
        talkRatio: r.talkRatio,
        skippedReason: r.skippedReason,
      };
    });
}

/** Validate the human pass. Pure; exported for the check. */
export function parseReview(body) {
  const overall = Number(body?.overall);
  if (!Number.isInteger(overall) || overall < 0 || overall > 100) {
    return { ok: false, error: "The score is a whole number from 0 to 100." };
  }
  const note = typeof body?.note === "string" ? body.note.trim().slice(0, MAX_REVIEW_NOTE) : "";
  return { ok: true, overall, note };
}

/**
 * The human pass. The reviewer is `{ id, kind, name }`; scope is checked
 * fresh against the attempt's rep, and an out-of-scope call is "not found".
 *
 * @returns {{ ok: true, qa } | { ok: false, status, error }}
 */
export async function reviewCallQa({ attemptId, reviewer, body, repIds = null, now = new Date(), client = db } = {}) {
  if (!reviewer?.id || !REVIEWER_KINDS.includes(reviewer.kind)) return { ok: false, status: 400, error: "No reviewer." };
  const parsed = parseReview(body);
  if (!parsed.ok) return { ok: false, status: 400, error: parsed.error };

  const attempt = await client.salesCallAttempt.findFirst({
    where: excludingTestDials({ id: String(attemptId || ""), recordingUrl: { not: null }, ...scopeWhere(repIds) }),
    select: { id: true, transcript: true, salesRep: { select: { name: true } }, prospect: { select: { businessName: true } }, qa: { select: { id: true } } },
  });
  if (!attempt) return { ok: false, status: 404, error: "No such recorded call." };

  const review = {
    reviewerId: reviewer.id,
    reviewerKind: reviewer.kind,
    reviewerName: reviewer.name || null,
    reviewedAt: now,
    reviewerOverall: parsed.overall,
    reviewerNote: parsed.note || null,
  };
  const qa = attempt.qa
    ? await client.salesCallQa.update({ where: { attemptId: attempt.id }, data: review, select: QA_SELECT })
    : await client.salesCallQa.create({
        data: {
          attemptId: attempt.id,
          scoredAt: now,
          model: null,
          deterministic: analyseTranscript(attempt.transcript, { repName: attempt.salesRep?.name, businessName: attempt.prospect?.businessName }),
          overall: null,
          skippedReason: "not_scored",
          ...review,
        },
        select: QA_SELECT,
      });
  return { ok: true, qa: { ...qa, scoredAt: iso(qa.scoredAt), reviewedAt: iso(qa.reviewedAt) } };
}

/**
 * May this agency play this recording? A fresh read of the attempt's rep
 * against the team ids the route just read. Null recording is "no".
 */
export async function agencyCanHear({ attemptId, teamRepIds, client = db } = {}) {
  if (!attemptId || !Array.isArray(teamRepIds) || !teamRepIds.length) return { ok: false, recordingUrl: null };
  const attempt = await client.salesCallAttempt.findFirst({
    where: excludingTestDials({ id: String(attemptId), salesRepId: { in: teamRepIds }, recordingUrl: { not: null } }),
    select: { id: true, recordingUrl: true },
  });
  return attempt?.recordingUrl ? { ok: true, recordingUrl: attempt.recordingUrl } : { ok: false, recordingUrl: null };
}
