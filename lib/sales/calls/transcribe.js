// lib/sales/calls/transcribe.js
//
// A recorded sales call becomes a transcript that knows who said what.
//
// ══ The shape of the job ══════════════════════════════════════════════════
//
//   1. Fetch the recording from Twilio as WAV, with credentials — never a
//      public link (lib/sales/calls/recording.js says why).
//   2. Split it into one file per track (lib/sales/calls/wavChannels.js).
//      Outbound: track 1 is the rep, track 2 the contractor. Inbound: the
//      reverse. A conference is one mixed track and stays "unknown".
//   3. Transcribe each track through lib/ai/provider.js — the only file that
//      speaks to the vendor — with a language hint from the lead's province.
//      A silent track is skipped rather than sent: it would cost a minute
//      and come back with an invented sentence.
//   4. Merge the segments by start time, label each with its speaker, and
//      write `transcript` (JSON) and `transcriptText` (flat lines) onto the
//      attempt. The money is metered against FieldQuo's own platform budget
//      (lib/sales/playbook/platformAi.js), because no tenant paid for this.
//
// ══ Idempotent, and honest about failure ══════════════════════════════════
//
// A row that already has a transcript is left alone — the webhook that
// triggers this can be retried by the carrier, and the platform page's
// "transcribe the ones that are missing" action must be safe to press twice.
// A failure is written to `transcriptError` in words, so the page can say
// "failed: …" rather than showing a recording with nothing under it and
// letting somebody assume it is still coming.
import { db } from "@/lib/db";
import { transcribeAudio, AI_TRANSCRIBE_MODEL } from "@/lib/ai/provider";
import { checkPlatformAiBudget, recordPlatformAiUsage } from "@/lib/sales/playbook/platformAi";
import { recordError } from "@/lib/platform/errorLog";
import { requiredLanguageFor } from "@/lib/sales/leadLanguage";
import { splitWavChannels, isSilentWav } from "./wavChannels";
import { channelSpeakers, transcriptToText, twilioMediaAuth } from "./recording";

/** Whisper's list price, US dollars per audio minute, in micros. */
export const TRANSCRIBE_USD_MICROS_PER_MINUTE = 6000;

export const TRANSCRIBE_AREA = "sales_call_transcript";

/**
 * Pure: the merge. Exported for the check.
 *
 * @param {{ speaker: string, segments: {start:number,end:number,text:string}[] }[]} tracks
 */
export function mergeTracks(tracks = []) {
  const out = [];
  for (const track of Array.isArray(tracks) ? tracks : []) {
    const speaker = track?.speaker || "unknown";
    for (const s of Array.isArray(track?.segments) ? track.segments : []) {
      if (!s || typeof s.text !== "string" || !s.text.trim()) continue;
      out.push({
        speaker,
        start: Math.max(0, Number(s.start) || 0),
        end: Math.max(0, Number(s.end) || 0),
        text: s.text.trim(),
      });
    }
  }
  // Stable on ties so two speakers starting in the same second keep track
  // order, which puts the parent leg first — the rep on an outbound call.
  return out
    .map((s, i) => ({ s, i }))
    .sort((a, b) => a.s.start - b.s.start || a.i - b.i)
    .map(({ s }) => s);
}

/** The cost of a transcription in micros, from the seconds actually sent. */
export function transcriptionCostMicros(seconds) {
  const s = Number(seconds);
  if (!Number.isFinite(s) || s <= 0) return 0;
  return Math.round((s / 60) * TRANSCRIBE_USD_MICROS_PER_MINUTE);
}

/**
 * Transcribe one attempt's recording. Returns what happened, in words, and
 * never throws — the caller is a webhook or a button, and both want a
 * sentence rather than a stack.
 *
 * @param {string} attemptId
 * @param {{ force?: boolean, fetchImpl?: typeof fetch, client?: typeof db }} opts
 */
export async function transcribeAttempt(attemptId, { force = false, fetchImpl = fetch, client = db } = {}) {
  const attempt = await client.salesCallAttempt.findUnique({
    where: { id: String(attemptId || "") },
    select: {
      id: true,
      direction: true,
      recordingUrl: true,
      recordingSid: true,
      recordingSeconds: true,
      recordingChannels: true,
      transcribedAt: true,
      salesRepId: true,
      prospectId: true,
      prospect: { select: { province: true } },
    },
  });
  if (!attempt) return { ok: false, reason: "no_attempt", message: "No such call." };
  if (!attempt.recordingUrl) return { ok: false, reason: "no_recording", message: "This call has no recording." };
  if (attempt.transcribedAt && !force) return { ok: true, reason: "already", message: "Already transcribed." };

  const fail = async (reason, message) => {
    await client.salesCallAttempt
      .update({ where: { id: attempt.id }, data: { transcriptError: `${reason}: ${message}`.slice(0, 500) } })
      .catch(() => {});
    await recordError({
      area: "sales_transcript",
      code: reason,
      message: `Transcription of attempt ${attempt.id} failed: ${message}`,
    }).catch(() => {});
    return { ok: false, reason, message };
  };

  // ── Money first ─────────────────────────────────────────────────────────
  const budget = await checkPlatformAiBudget();
  if (!budget.ok) return fail("over_budget", budget.message || "The platform AI budget is spent.");

  // ── Fetch ───────────────────────────────────────────────────────────────
  const auth = twilioMediaAuth();
  if (!auth) return fail("no_credentials", "FieldQuo's recording credentials are not set.");
  let wav;
  try {
    const res = await fetchImpl(`${attempt.recordingUrl}.wav`, { headers: { Authorization: auth } });
    if (!res.ok) return fail("fetch_failed", `The provider answered ${res.status} for the recording.`);
    wav = Buffer.from(await res.arrayBuffer());
  } catch (err) {
    return fail("fetch_failed", err?.message || "The recording could not be fetched.");
  }

  // ── Split ───────────────────────────────────────────────────────────────
  const split = splitWavChannels(wav);
  if (!split.ok) return fail("bad_audio", split.reason);
  const speakers = channelSpeakers({ direction: attempt.direction, channels: split.channels.length });

  // ── Transcribe each track ───────────────────────────────────────────────
  const language = requiredLanguageFor(attempt.prospect) || null;
  const tracks = [];
  let secondsSent = 0;
  for (let i = 0; i < split.channels.length; i += 1) {
    const buf = split.channels[i];
    const speaker = speakers[i] || "unknown";
    if (isSilentWav(buf)) {
      tracks.push({ speaker, segments: [], skipped: "silent" });
      continue;
    }
    const r = await transcribeAudio({ audio: buf, filename: `${attempt.id}-${speaker}.wav`, language });
    if (!r.ok) return fail(r.reason || "vendor_error", r.message || "transcription failed");
    secondsSent += Number.isFinite(r.seconds) ? r.seconds : split.seconds;
    tracks.push({ speaker, segments: r.segments });
  }

  // ── Meter ───────────────────────────────────────────────────────────────
  await recordPlatformAiUsage({
    area: TRANSCRIBE_AREA,
    model: AI_TRANSCRIBE_MODEL,
    usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    costMicros: transcriptionCostMicros(secondsSent),
    salesRepId: attempt.salesRepId,
    prospectId: attempt.prospectId,
    // One row per recording however many times this runs.
    ref: `transcript:${attempt.recordingSid || attempt.id}`,
  });

  // ── Write ───────────────────────────────────────────────────────────────
  const segments = mergeTracks(tracks);
  await client.salesCallAttempt.update({
    where: { id: attempt.id },
    data: {
      transcript: segments,
      transcriptText: transcriptToText(segments),
      transcribedAt: new Date(),
      transcriptError: null,
    },
  });
  return { ok: true, reason: "done", segments: segments.length, secondsSent, tracks: tracks.length };
}

/**
 * The reconcile: every recorded call with no transcript and no recorded
 * failure (or, with `retryFailed`, those too), oldest first, up to a cap so
 * a button press cannot run for an hour.
 */
export async function transcribeMissing({ limit = 20, retryFailed = false, client = db } = {}) {
  const rows = await client.salesCallAttempt.findMany({
    where: {
      recordingUrl: { not: null },
      transcribedAt: null,
      ...(retryFailed ? {} : { transcriptError: null }),
    },
    orderBy: { dialledAt: "asc" },
    take: Math.max(1, Math.min(100, Number(limit) || 20)),
    select: { id: true },
  });
  const results = [];
  for (const row of rows) {
    // eslint-disable-next-line no-await-in-loop
    results.push({ id: row.id, ...(await transcribeAttempt(row.id, { client })) });
  }
  return { attempted: rows.length, done: results.filter((r) => r.ok).length, results };
}
