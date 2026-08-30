// scripts/check-callback-window.mjs
//
// Never ring somebody on a company's behalf while that company is shut.
//
// ══ The mistake this file records ══════════════════════════════════════════
//
// This used to test a generator that produced callback times from opening
// hours — fifteen minutes out, next open day after closing. It was built
// because a caller asking to be rung back was being offered the next free
// ESTIMATE slot days away, which felt absurd.
//
// It WAS absurd, and the generator was still wrong. A real booking landed a
// caller at 8:30 on a Monday with the estimator whose Monday starts at three.
// Opening hours know whether the business is open; they know nothing about
// whose calendar the booking lands on, who is on leave, or what is already
// taken. computeAvailableSlots knows all three, and the "absurd" original
// answer — Thursday at three — was that person's real availability.
//
// So availability decides when, and this guards the one thing availability
// cannot answer: personal hours can disagree with the company's, and somebody
// available at seven should not have a customer rung before the doors open.
import { withinBusinessHours, CALLBACK_DELAY_MINUTES } from "@/lib/voice/callbackWindow";

let fail = 0;
const ok = (c, m, d) => {
  console.log((c ? "  ok   " : "  FAIL ") + m + (c || d === undefined ? "" : `  — got ${JSON.stringify(d)}`));
  if (!c) fail++;
};
const section = (t) => console.log(`\n${t}\n`);

const TZ = "America/Toronto";
// Closed Sunday and Saturday; Mon–Thu 08:00–17:00; Friday closes at 16:00.
const HOURS = [
  { day: 0, closed: true, open: "09:00", close: "17:00" },
  { day: 1, closed: false, open: "08:00", close: "17:00" },
  { day: 2, closed: false, open: "08:00", close: "17:00" },
  { day: 3, closed: false, open: "08:00", close: "17:00" },
  { day: 4, closed: false, open: "08:00", close: "17:00" },
  { day: 5, closed: false, open: "08:00", close: "16:00" },
  { day: 6, closed: true, open: "09:00", close: "13:00" },
];
const at = (iso) => withinBusinessHours(new Date(iso), TZ, HOURS);

section("1. Inside the open window, and only inside it");

ok(at("2026-08-31T14:00:00Z"), "Monday 10:00 local is open");
ok(at("2026-08-31T12:00:00Z"), "…and 08:00, the minute it opens");
ok(!at("2026-08-31T11:59:00Z"), "…but not 07:59, a minute before");
ok(!at("2026-08-31T21:00:00Z"), "…nor 17:00, the minute it closes");
ok(!at("2026-09-01T01:00:00Z"), "nine at night is shut");
ok(!at("2026-09-05T15:00:00Z"), "Saturday is shut all day");
ok(at("2026-09-04T19:00:00Z"), "Friday 15:00 is open");
ok(!at("2026-09-04T20:00:00Z"), "…and Friday 16:00 is not, because Friday closes early");

section("2. Silence is not a closure");

ok(
  withinBusinessHours(new Date(), TZ, null) === true,
  "a company that has stated NO hours has not stated a closure — refusing every slot would take its calendar away",
);
ok(withinBusinessHours(new Date(), TZ, []) === true, "…and neither has one with an empty list");
ok(
  withinBusinessHours(new Date(), null, HOURS) === true,
  "no timezone cannot decide either way, so it does not veto real availability",
);
ok(
  withinBusinessHours(new Date(), "Not/AZone", HOURS) === true,
  "…and neither can an unusable one",
);
ok(
  withinBusinessHours("not a date", TZ, HOURS) === true ||
    withinBusinessHours("not a date", TZ, HOURS) === false,
  "junk input returns a boolean rather than throwing",
);

section("3. A day that closes before it opens vetoes nothing");

ok(
  withinBusinessHours(
    new Date("2026-08-31T14:00:00Z"),
    TZ,
    [{ day: 1, closed: false, open: "17:00", close: "08:00" }],
  ) === true,
  "an impossible day is not read as 'shut all day' — availability decides, and a broken row must not silence it",
);

section("4. The lead time is still the agent's own number");

ok(
  Number.isInteger(CALLBACK_DELAY_MINUTES) && CALLBACK_DELAY_MINUTES > 0,
  "a callback is offered some minutes out, not immediately",
  CALLBACK_DELAY_MINUTES,
);

console.log(`\n${fail === 0 ? "ALL PASS" : fail + " FAILED"}`);
process.exit(fail ? 1 : 0);
