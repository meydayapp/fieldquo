// scripts/check-timesheet-tz.mjs
//
// The manual timesheet form used to inflate every entry by the UTC offset:
// 09:00–17:00 stored as 12 hours, which went into a pay run at 50% over.
// clockIn was sent bare (resolved as UTC on the server) while clockOut went
// through the browser's `.toISOString()`. Two ends, two zones.
//
// These assert the wall-clock primitive, not the route — hours are money, and
// this is the arithmetic that decides how much.
//
// Run: node --import ./scripts/alias-loader.mjs scripts/check-timesheet-tz.mjs

import { resolveWallClock, isNaiveWallClock } from "@/lib/time/wallClock";

const TZ = "America/Toronto"; // the schema default, and the QA company's zone
const hrs = (a, b) => Math.round(((b - a) / 3600000) * 100) / 100;
let fail = 0;
const t = (name, got, want) => {
  const ok = String(got) === String(want);
  if (!ok) fail++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}  got=${got} want=${want}`);
};

// The two entries QA actually created.
t("EDT 09:00→17:00 = 8h",
  hrs(resolveWallClock("2026-08-20T09:00", TZ), resolveWallClock("2026-08-20T17:00", TZ)), 8);
t("EDT 09:00→11:30 = 2.5h",
  hrs(resolveWallClock("2026-08-21T09:00", TZ), resolveWallClock("2026-08-21T11:30", TZ)), 2.5);

// The stored instant, not just the delta — the delta would pass even if both
// ends were shifted together, which is the bug the delta test can't see.
t("09:00 EDT is 13:00Z", resolveWallClock("2026-08-20T09:00", TZ).toISOString(), "2026-08-20T13:00:00.000Z");
t("17:00 EDT is 21:00Z", resolveWallClock("2026-08-20T17:00", TZ).toISOString(), "2026-08-20T21:00:00.000Z");

// Winter: EST is -5, so the same digits are a different instant.
t("09:00 EST is 14:00Z", resolveWallClock("2026-01-20T09:00", TZ).toISOString(), "2026-01-20T14:00:00.000Z");

// ── DST ────────────────────────────────────────────────────────────────────
// Toronto switches at 02:00, so a 9-to-5 shift on a transition day is still 8
// hours — that is NOT the interesting case. What matters is that identical
// wall-clock digits resolve to DIFFERENT instants either side of the switch,
// which is exactly what a fixed-offset fix gets wrong.
// 2026: forward Mar 8, back Nov 1.
t("day before spring-forward, 09:00 = 14:00Z (EST)",
  resolveWallClock("2026-03-07T09:00", TZ).toISOString(), "2026-03-07T14:00:00.000Z");
t("day after spring-forward, 09:00 = 13:00Z (EDT)",
  resolveWallClock("2026-03-09T09:00", TZ).toISOString(), "2026-03-09T13:00:00.000Z");
t("day before fall-back, 09:00 = 13:00Z (EDT)",
  resolveWallClock("2026-10-31T09:00", TZ).toISOString(), "2026-10-31T13:00:00.000Z");
t("day after fall-back, 09:00 = 14:00Z (EST)",
  resolveWallClock("2026-11-02T09:00", TZ).toISOString(), "2026-11-02T14:00:00.000Z");
// A shift that genuinely straddles the fall-back hour is 9 real hours for 8
// wall-clock hours. This is the case that pays someone correctly.
t("00:30→08:30 across fall-back = 9h",
  hrs(resolveWallClock("2026-11-01T00:30", TZ), resolveWallClock("2026-11-01T08:30", TZ)), 9);
// ...and across spring-forward, 7.
t("00:30→08:30 across spring-forward = 7h",
  hrs(resolveWallClock("2026-03-08T00:30", TZ), resolveWallClock("2026-03-08T08:30", TZ)), 7);
// Transition days are still 8h for a normal shift — the regression guard for
// the two assertions this replaced, which asserted a fantasy.
t("fall-back day 09:00→17:00 = 8h",
  hrs(resolveWallClock("2026-11-01T09:00", TZ), resolveWallClock("2026-11-01T17:00", TZ)), 8);
t("spring-forward day 09:00→17:00 = 8h",
  hrs(resolveWallClock("2026-03-08T09:00", TZ), resolveWallClock("2026-03-08T17:00", TZ)), 8);

// A non-Toronto company must not get Toronto's offset.
t("Vancouver 09:00 is 16:00Z",
  resolveWallClock("2026-08-20T09:00", "America/Vancouver").toISOString(), "2026-08-20T16:00:00.000Z");

// Already-unambiguous values pass through — this is the clock-in path, which
// was CORRECT and must not be touched.
t("Z instant untouched", resolveWallClock("2026-08-20T13:00:00.000Z", TZ).toISOString(), "2026-08-20T13:00:00.000Z");
t("offset instant untouched", resolveWallClock("2026-08-20T09:00:00-04:00", TZ).toISOString(), "2026-08-20T13:00:00.000Z");
t("Date passes through", resolveWallClock(new Date("2026-08-20T13:00:00Z"), TZ).toISOString(), "2026-08-20T13:00:00.000Z");

// Hostile input must be null, never Invalid Date.
for (const bad of [null, undefined, "", "not a date", {}, [], NaN, "2026-13-45T99:99"])
  t(`junk ${JSON.stringify(bad)} → null`, resolveWallClock(bad, TZ), null);

// Null timezone falls back rather than producing Invalid Date.
t("null tz falls back to Toronto", resolveWallClock("2026-08-20T09:00", null).toISOString(), "2026-08-20T13:00:00.000Z");

// Seconds preserved.
t("seconds kept", resolveWallClock("2026-08-20T09:00:30", TZ).toISOString(), "2026-08-20T13:00:30.000Z");

// The detector must not claim a zoned string is naive.
t("Z is not naive", isNaiveWallClock("2026-08-20T13:00:00.000Z"), false);
t("bare is naive", isNaiveWallClock("2026-08-20T09:00"), true);

console.log(fail ? `\n${fail} FAILED` : "\nall passed");
process.exit(fail ? 1 : 0);
