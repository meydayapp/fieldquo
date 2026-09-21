// lib/sales/calls/sampling.js
//
// Which recorded calls get transcribed and scored when the platform lowers
// the share below 100 %.
//
// ══ The model, from OMniLeads ═════════════════════════════════════════════
//
// Queue.transcription_percentage and summarize_percentage
// (ominicontacto_app/models.py ~1801–1808): 0–100 per campaign, the share
// of recordings the model reads. That is the setting; how a call is chosen
// is not stated there and is decided here.
//
// ══ Deterministic, per call ═══════════════════════════════════════════════
//
// A random draw would pick a different set every time the reconcile ran —
// a call skipped today transcribed tomorrow, a cost that drifts up towards
// 100 % with every retry. So the choice is a HASH of the call's own id
// (Twilio's CallSid, else the attempt id) mod 100, compared to the share:
// the same call is in or out on every run, and lowering the share from 60
// to 40 keeps every call that was in at 40 and drops the rest. FNV-1a over
// the string — no crypto, no dependency, executable in the check script.
//
// A call a superadmin opens or audits is transcribed regardless: the
// callers pass `sample: false` (lib/sales/calls/transcribe.js and qa.js),
// and this file never sees them.

/** FNV-1a 32-bit over a string. */
export function fnv1a(str) {
  let h = 0x811c9dc5;
  const s = String(str || "");
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** 0–99, stable for the id. */
export function sampleBucket(id) {
  return fnv1a(id) % 100;
}

/**
 * Is this call in the sample at `percent`? 100 is everything (today's
 * behaviour), 0 is nothing. A percent outside 0–100 or not a number reads
 * as 100 — a broken setting must not silently stop transcription.
 */
export function inSample(id, percent) {
  const p = Number(percent);
  if (!Number.isFinite(p) || p < 0 || p > 100) return true;
  if (p >= 100) return true;
  if (p <= 0) return false;
  return sampleBucket(id) < p;
}

/** The id the sample is keyed on: the carrier's call sid when there is one, else ours. */
export function sampleKeyOf(attempt) {
  return attempt?.providerCallSid || attempt?.recordingSid || attempt?.id || "";
}

/** The marker written into transcriptError / skippedReason for a call left out. */
export const SAMPLED_OUT = "sampled_out";
export function sampledOutReason(percent, bucket) {
  return `${SAMPLED_OUT}: ${percent}% sample, this call is bucket ${bucket}`;
}
export function isSampledOut(reason) {
  return typeof reason === "string" && reason.startsWith(SAMPLED_OUT);
}
