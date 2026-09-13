// lib/shifts/jobTone.js
//
// The colour of a shift block on the week grid: per JOB, stable for the
// job's id, so the same site is the same colour on every row and every
// week. Eight bg/text pairs that clear 4.5:1 in both themes rather than a
// hue computed from a hash — a computed hue lands on yellow-on-white
// eventually, and contractors' brand colours already prove that. Pure, so
// scripts/check-employee-home.mjs executes it.
const TONES = [
  "bg-blue-100 text-blue-950 dark:bg-blue-900/60 dark:text-blue-100",
  "bg-emerald-100 text-emerald-950 dark:bg-emerald-900/60 dark:text-emerald-100",
  "bg-amber-100 text-amber-950 dark:bg-amber-900/60 dark:text-amber-100",
  "bg-purple-100 text-purple-950 dark:bg-purple-900/60 dark:text-purple-100",
  "bg-rose-100 text-rose-950 dark:bg-rose-900/60 dark:text-rose-100",
  "bg-cyan-100 text-cyan-950 dark:bg-cyan-900/60 dark:text-cyan-100",
  "bg-lime-100 text-lime-950 dark:bg-lime-900/60 dark:text-lime-100",
  "bg-orange-100 text-orange-950 dark:bg-orange-900/60 dark:text-orange-100",
];
export const NO_JOB_TONE = "bg-muted text-foreground";

/** Stable tone for a job id; a shift with no job is the neutral pair. */
export function jobTone(jobId) {
  if (!jobId) return NO_JOB_TONE;
  let h = 0;
  for (const ch of String(jobId)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TONES[h % TONES.length];
}
