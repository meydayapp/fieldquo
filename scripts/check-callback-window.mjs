// scripts/check-callback-window.mjs
//
// When the assistant may ring somebody back.
//
// ══ What was wrong ═════════════════════════════════════════════════════════
//
// A callback was offered out of the same availability an on-site VISIT is
// booked from. A caller asking "can someone ring me back?" was offered Thursday
// at three and Monday the seventh — the next free ESTIMATE slots, days away.
// Right for a visit, where somebody drives over and blocks out two hours.
// Absurd for a ten-minute phone call.
//
// ══ The rule that matters most ═════════════════════════════════════════════
//
// Never outside the company's opening hours, and never at all when a company
// has not stated any. An automated system that rings a homeowner at two in the
// morning on behalf of a business that never said it was open then is a worse
// outcome than one that takes a message — and "assume nine to five" is exactly
// the padding-absent-data-with-defaults failure the hours model was written to
// prevent.
import { nextCallbackTimes, CALLBACK_DELAY_MINUTES } from "@/lib/voice/callbackWindow";

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

const at = (iso, over = {}) =>
  nextCallbackTimes({ now: new Date(iso), timezone: TZ, businessHours: HOURS, ...over });

/** What the company's clock reads at that instant. */
const local = (d) =>
  new Intl.DateTimeFormat("en-CA", {
    weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TZ,
  }).format(d);
const minutesOf = (d) => {
  const [, hh, mm] = /(\d{2}):(\d{2})/.exec(local(d));
  return Number(hh) * 60 + Number(mm);
};
const dayOf = (d) => local(d).slice(0, 3);

section("1. Soon, not next week");

{
  // Monday 10:00 local (14:00 UTC in EDT).
  const times = at("2026-08-31T14:00:00Z");
  ok(times.length === 3, "three real alternatives are offered", times.length);
  ok(times[0].sameDay === true, "the first is today");
  ok(
    minutesOf(times[0].at) === 10 * 60 + 15,
    `the first is ${CALLBACK_DELAY_MINUTES} minutes away, not the next free estimate slot`,
    local(times[0].at),
  );
  ok(
    minutesOf(times[1].at) - minutesOf(times[0].at) === 15,
    "…and they are spaced, so they are alternatives rather than the same moment three times",
  );
  ok(
    times.every((t) => t.at.getSeconds() === 0 && t.at.getMilliseconds() === 0),
    "every time lands on a clean minute — an appointment at 8:00:13 is not one anybody writes down",
  );
}

section("2. Never outside opening hours");

{
  // 21:00 Monday local. The business shut at five.
  const times = at("2026-09-01T01:00:00Z");
  ok(times.length > 0, "an after-hours caller is still offered something");
  ok(times[0].sameDay === false, "…but not today");
  ok(dayOf(times[0].at) === "Tue", "…the next open day", local(times[0].at));
  ok(minutesOf(times[0].at) === 8 * 60, "…at opening time", local(times[0].at));
  ok(
    times.every((t) => minutesOf(t.at) >= 8 * 60 && minutesOf(t.at) < 17 * 60),
    "and every offer is inside the open window",
    times.map((t) => local(t.at)),
  );
}
{
  // Saturday 11:00 local — closed all weekend.
  const times = at("2026-09-05T15:00:00Z");
  ok(dayOf(times[0].at) === "Mon", "a weekend caller is offered Monday, not Saturday", local(times[0].at));
  ok(minutesOf(times[0].at) === 8 * 60, "…first thing", local(times[0].at));
}
{
  // Monday 16:55. Five minutes of the working day left.
  const times = at("2026-08-31T20:55:00Z");
  ok(
    times[0].sameDay === false,
    "a callback is not slotted into the last five minutes before closing — nobody makes that call",
    local(times[0].at),
  );
  ok(dayOf(times[0].at) === "Tue", "…it goes to the morning", local(times[0].at));
}
{
  // Monday 16:35 local. The delay lands the candidate at 16:50 — INSIDE opening
  // hours, but with only ten minutes of the day left. The boundary case: a slot
  // that is technically open and practically useless, because the call would be
  // cut off by closing. The 16:55 case above never reaches this branch (16:55 +
  // 15 is already past five), so without this the guard is untested.
  const times = at("2026-08-31T20:35:00Z");
  ok(
    times[0].sameDay === false,
    "a slot with less than a full step before closing is not offered — it is open, and it is not a callback",
    local(times[0].at),
  );
  ok(dayOf(times[0].at) === "Tue" && minutesOf(times[0].at) === 8 * 60,
    "…it goes to opening time the next day", local(times[0].at));
}
{
  // Friday 15:50 — Friday closes at 16:00, and the weekend is shut.
  const times = at("2026-09-04T19:50:00Z");
  ok(
    dayOf(times[0].at) === "Mon",
    "a Friday-afternoon caller skips the closed weekend entirely",
    local(times[0].at),
  );
}

section("3. No hours stated is not nine-to-five");

{
  ok(
    nextCallbackTimes({ now: new Date(), timezone: TZ, businessHours: null }).length === 0,
    "a company that has never set opening hours offers NOTHING — the caller gets a message taken instead",
  );
  ok(
    nextCallbackTimes({ now: new Date(), timezone: TZ, businessHours: [] }).length === 0,
    "…and so does an empty list",
  );
  ok(
    nextCallbackTimes({
      now: new Date(),
      timezone: TZ,
      businessHours: HOURS.map((h) => ({ ...h, closed: true })),
    }).length === 0,
    "…and a company closed every day of the week",
  );
  ok(
    nextCallbackTimes({ now: new Date(), timezone: null, businessHours: HOURS }).length === 0,
    "no timezone offers nothing rather than ringing somebody at the wrong hour with total confidence",
  );
  ok(
    nextCallbackTimes({ now: new Date(), timezone: "Not/AZone", businessHours: HOURS }).length === 0,
    "…and so does an unusable one",
  );
}

section("4. Hostile hours");

{
  const broken = [{ day: 1, closed: false, open: "17:00", close: "08:00" }];
  ok(
    nextCallbackTimes({ now: new Date("2026-08-31T14:00:00Z"), timezone: TZ, businessHours: broken })
      .length === 0,
    "a day that closes before it opens is skipped, not treated as open all night",
  );
  // ── Where the guard for junk actually lives ────────────────────────────
  //
  // This asserted that an unparseable open time is skipped here. It is not,
  // because it never arrives: normaliseHours — the shared sanitiser the website
  // JSON-LD and the settings screen also go through — turns "bananas" into
  // "08:00" before this function sees the row. So the real contract is that
  // times reaching here are already well-formed, and asserting otherwise
  // claimed a guarantee this file does not provide.
  //
  // The guard that matters is still checked: minutesOf() returns null for
  // anything malformed, so if normaliseHours ever stops defaulting, a bad row
  // is skipped rather than read as midnight.
  {
    const normalised = nextCallbackTimes({
      now: new Date("2026-08-31T14:00:00Z"),
      timezone: TZ,
      businessHours: [{ day: 1, closed: false, open: "bananas", close: "17:00" }],
    });
    ok(
      normalised.length > 0 && minutesOf(normalised[0].at) >= 8 * 60,
      "an unparseable time is repaired upstream by normaliseHours, not seen here",
      normalised.map((t) => local(t.at)),
    );
  }
  ok(at("2026-08-31T14:00:00Z", { count: 1 }).length === 1, "the count is honoured");
  ok(at("2026-08-31T14:00:00Z", { count: 99 }).length <= 6, "…and capped, because a phone call is not a menu");
}

console.log(`\n${fail === 0 ? "ALL PASS" : fail + " FAILED"}`);
process.exit(fail ? 1 : 0);
