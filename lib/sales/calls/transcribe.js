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
import { splitWavChannels, isSilentWav, silenceRanges } from "./wavChannels";
import { channelSpeakers, transcriptToText, twilioMediaAuth } from "./recording";
import { scoreAttempt } from "./qa";
import { callEventsFor } from "./supervisionStore";
import { EV_HOLD, EV_UNHOLD } from "./supervision";

/**
 * The seconds of a recording during which the contractor was on hold,
 * from the HOLD/UNHOLD rows — measured from `answeredAt`, which is when a
 * participant recording starts. Pure, exported for the check. An open
 * hold (no UNHOLD) runs to the end.
 */
export function holdRangesFor({ events = [], answeredAt = null, endSeconds = Infinity } = {}) {
  const t0 = answeredAt ? new Date(answeredAt).getTime() : NaN;
  if (!Number.isFinite(t0)) return [];
  const out = [];
  let open = null;
  for (const e of Array.isArray(events) ? events : []) {
    const at = e?.at ? new Date(e.at).getTime() : NaN;
    if (!Number.isFinite(at)) continue;
    if (e.event === EV_HOLD && open === null) open = Math.max(0, (at - t0) / 1000);
    if (e.event === EV_UNHOLD && open !== null) {
      out.push({ start: open, end: Math.max(open, (at - t0) / 1000) });
      open = null;
    }
  }
  if (open !== null) out.push({ start: open, end: endSeconds });
  return out.filter((r) => r.end > r.start);
}
import { outcomeSettingValues } from "./outcomeSettingsStore";
import { SAMPLED_OUT, inSample, sampleBucket, sampleKeyOf, sampledOutReason } from "./sampling";

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
export async function transcribeAttempt(
  attemptId,
  {
    force = false,
    fetchImpl = fetch,
    client = db,
    score = scoreAttempt,
    // FALSE when a superadmin asked for THIS call (the review screen, an
    // audit): the platform's sample share is not consulted. TRUE from the
    // webhook and the reconcile, where the share applies.
    sample = true,
    settings = null,
  } = {},
) {
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
      conferenceName: true,
      answeredAt: true,
      transcriptError: true,
      providerCallSid: true,
      salesRepId: true,
      prospectId: true,
      prospect: { select: { province: true } },
    },
  });
  if (!attempt) return { ok: false, reason: "no_attempt", message: "No such call." };
  if (!attempt.recordingUrl) return { ok: false, reason: "no_recording", message: "This call has no recording." };
  if (attempt.transcribedAt && !force) return { ok: true, reason: "already", message: "Already transcribed." };

  // ── The sample ──────────────────────────────────────────────────────────
  //
  // `sales.transcription.percent` (lib/sales/calls/outcomeSettings.js;
  // default 100, which is every call). A call outside the sample is marked
  // in transcriptError with the bucket it landed in — the same call lands
  // there on every run (sampling.js) — and the reconcile leaves it alone.
  // An on-demand ask (`sample: false`) transcribes it anyway and clears
  // the marker.
  if (sample) {
    const values = settings || (await outcomeSettingValues({ client }));
    const percent = values["sales.transcription.percent"];
    const key = sampleKeyOf(attempt);
    if (!inSample(key, percent)) {
      const reason = sampledOutReason(percent, sampleBucket(key));
      if (attempt.transcriptError !== reason) {
        await client.salesCallAttempt.update({ where: { id: attempt.id }, data: { transcriptError: reason } }).catch(() => {});
      }
      return { ok: true, reason: SAMPLED_OUT, message: `Not in the ${percent}% sample. Open it on the review screen to transcribe it on demand.` };
    }
  }

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
  const speakers = channelSpeakers({ direction: attempt.direction, channels: split.channels.length, conference: Boolean(attempt.conferenceName) });

  // ── Hold music is not the rep talking ───────────────────────────────────
  //
  // Conference mode only: the "rep" track is everything the contractor
  // heard, and while they were held that was music. Those seconds are
  // zeroed before the model hears them (wavChannels.js silenceRanges).
  let holdRanges = [];
  if (attempt.conferenceName) {
    const events = await callEventsFor(attempt.id, { client });
    holdRanges = holdRangesFor({ events, answeredAt: attempt.answeredAt, endSeconds: split.seconds });
  }

  // ── Transcribe each track ───────────────────────────────────────────────
  const language = requiredLanguageFor(attempt.prospect) || null;
  const tracks = [];
  let secondsSent = 0;
  for (let i = 0; i < split.channels.length; i += 1) {
    const speaker = speakers[i] || "unknown";
    const buf = speaker === "rep" && holdRanges.length ? silenceRanges(split.channels[i], holdRanges, split.sampleRate) : split.channels[i];
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

  // ── Then the scorecard ──────────────────────────────────────────────────
  //
  // Same discipline as the webhook that called this: the transcript is
  // written and committed FIRST, then the second model call runs, and its
  // failure is a sentence on its own row (lib/sales/calls/qa.js) — never a
  // reason this function reports the transcription as failed. The webhook
  // already runs this inside after(), so the reply to the carrier has long
  // gone; the platform button runs it inline under its own maxDuration.
  // `score` is injectable so scripts/check-sales-recording.mjs can execute
  // the transcription without a scorer.
  let qa = null;
  if (typeof score === "function") {
    qa = await score(attempt.id, { client, sample }).catch((err) => ({ ok: false, reason: "threw", message: err?.message }));
  }
  return { ok: true, reason: "done", segments: segments.length, secondsSent, tracks: tracks.length, qa };
}

/**
 * The reconcile: every recorded call with no transcript and no recorded
 * failure (or, with `retryFailed`, those too), oldest first, up to a cap so
 * a button press cannot run for an hour.
 */
export async function transcribeMissing({ limit = 20, retryFailed = false, retryUnconfigured = false, client = db } = {}) {
  const rows = await client.salesCallAttempt.findMany({
    where: {
      recordingUrl: { not: null },
      transcribedAt: null,
      // `retryUnconfigured`: a row whose failure was the ENVIRONMENT — no
      // key on the deployment that tried, or a local replay — is not a
      // failure of the audio, and the cron retries it once the key is
      // there. A vendor error stays for the platform's "retry failed".
      ...(retryFailed ? {} : retryUnconfigured ? { OR: [{ transcriptError: null }, { transcriptError: { startsWith: "unconfigured" } }] } : { transcriptError: null }),
      // A call the sample left out is not a failure and is never retried
      // by "retry the failed ones" — that button would quietly transcribe
      // the whole 100 % and defeat the setting. On demand only (sampling.js).
      NOT: { transcriptError: { startsWith: SAMPLED_OUT } },
    },
    orderBy: { dialledAt: "asc" },
    take: Math.max(1, Math.min(100, Number(limit) || 20)),
    select: { id: true },
  });
  const results = [];
  const settings = await outcomeSettingValues({ client });
  for (const row of rows) {
    // eslint-disable-next-line no-await-in-loop
    results.push({ id: row.id, ...(await transcribeAttempt(row.id, { client, settings })) });
  }
  return { attempted: rows.length, done: results.filter((r) => r.ok && r.reason !== SAMPLED_OUT).length, sampledOut: results.filter((r) => r.reason === SAMPLED_OUT).length, results };
}
