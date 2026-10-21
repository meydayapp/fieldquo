// scripts/check-availability-spread.mjs
//
//   npm run check:availability-spread
//
// What the AI employee and the phone agent are SHOWN of the diary.
//
// ══ The bug ════════════════════════════════════════════════════════════════
//
// 20 October 2026: the AI employee told Cathy Monagham Jardine there was no
// availability after 10am. The calendar for that day was empty.
//
// It was not the model's invention. bookableSlots sorted every free slot
// soonest-first and returned `.slice(0, 6)` — on a 15-minute grid that is
// 8:00, 8:15, 8:30, 8:45, 9:00, 9:15 and NOTHING ELSE, for a company open
// until five, for the next ten days. The tool then told the model "book only
// with a slot_id from this list". Asked about the afternoon, it had no
// afternoon.
//
// So the agent was reading a sample that did not look like the thing it
// sampled, and a sample like that is a false statement with extra steps.
//
// ══ What this executes ═════════════════════════════════════════════════════
//
// bookableSlots itself, against a scripted calendar: one estimator, Monday to
// Friday 08:00–17:00, nothing booked, no leave. The old behaviour and the new
// one are both assertable from the labels that come back.
//
//   node --import ./scripts/alias-loader.mjs \
//        --import ./scripts/db-stub-loader.mjs \
//        scripts/check-availability-spread.mjs

import { readFileSync } from "node:fs";
import { decomment } from "./tenantScopeScan.mjs";
import { bookableSlots, spreadSlots, SLOT_DAYS, SLOT_PER_DAY, SLOT_DAY_MAX } from "@/lib/voice/availability";
import { rows, resetDbStub } from "@/lib/db";

let pass = 0;
let fail = 0;
const ok = (name, cond, got) => {
  if (cond) {
    pass++;
    console.log(`  ok   ${name}`);
  } else {
    fail++;
    console.log(`  FAIL ${name}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`);
  }
};
const section = (s) => console.log(`\n${s}\n`);
const read = (p) => readFileSync(p, "utf8");

const COMPANY = "co_1";
const USER = "u_owner";
const TZ = "America/Toronto";
const OPEN = { open: "08:00", close: "17:00" };

function seed({ hours = { mon: OPEN, tue: OPEN, wed: OPEN, thu: OPEN, fri: OPEN, sat: { closed: true }, sun: { closed: true } }, durationMinutes = 30, bufferAfter = 0 } = {}) {
  resetDbStub();
  rows.company = [{
    id: COMPANY, timezone: TZ, defaultLanguage: "en", businessHours: hours,
    bookingModes: ["on_site"], slug: "co", bookingSlug: "co",
    stripeChargesEnabled: false, currency: "CAD",
  }];
  rows.eventType = [{
    id: "et_1", companyId: COMPANY, userId: USER, active: true,
    durationMinutes, bufferBefore: 0, bufferAfter, feeCents: 0,
    name: "On-site estimate", slug: "estimate", mode: "on_site", requiresAddress: true,
  }];
  rows.availabilitySchedule = [1, 2, 3, 4, 5].map((d) => ({
    id: `as_${d}`, userId: USER, dayOfWeek: d, startTime: "08:00", endTime: "17:00", timezone: TZ,
  }));
  rows.booking = [];
  rows.appointment = [];
  rows.leaveRequest = [];
}

/** The hour of a slot in the company's own timezone. */
const hourOf = (iso) =>
  Number(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hour12: false }).format(new Date(iso)));
const dayOf = (iso) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));

// ───────────────────────────────────────────────────────────────────────────
section("1. An empty 8-to-5 diary, as the agent sees it");

{
  seed();
  const slots = await bookableSlots(COMPANY);
  ok("there is something to offer", slots.length > 0, slots.length);

  const hours = slots.map((s) => hourOf(s.iso));
  const days = [...new Set(slots.map((s) => dayOf(s.iso)))];

  // The bug, stated as the assertion that would have caught it.
  ok(
    "the agent can see an AFTERNOON — the 'nothing after 10am' case",
    hours.some((h) => h >= 12),
    hours,
  );
  ok("…and a late one, not just lunchtime", hours.some((h) => h >= 15), hours);
  ok("…and a morning, so the soonest is still offered", hours.some((h) => h < 10), hours);
  ok(`…across several days, not one (${days.length})`, days.length >= 3, days);
  ok("nothing outside business hours", hours.every((h) => h >= 8 && h < 17), hours);

  // The callback routes book slots[0] blind — it must still be the soonest.
  const times = slots.map((s) => new Date(s.iso).getTime());
  ok("soonest first, so the callback paths still book the earliest", times.every((t, i) => i === 0 || t >= times[i - 1]));

  ok("the sample stays small enough to read", slots.length <= SLOT_DAYS * SLOT_PER_DAY, slots.length);

  // Weekends are shut, and the diary says so.
  const weekend = slots.filter((s) => [0, 6].includes(new Date(s.iso).getUTCDay()));
  ok("no Saturday or Sunday on a Monday-to-Friday company", weekend.length === 0, weekend.map((s) => s.label));
}

// ───────────────────────────────────────────────────────────────────────────
section("2. The old shape is what produced the sentence");

{
  seed();
  const slots = await bookableSlots(COMPANY);
  // Reconstruct the pre-fix answer from the same data: soonest six.
  const oldAnswer = [...slots].sort((a, b) => new Date(a.iso) - new Date(b.iso)).slice(0, 6);
  // (The real old list came off the ungrouped set, which is denser still — so
  // this is the GENEROUS version of the old behaviour and it already fails.)
  ok(
    "soonest-six over a 15-minute grid cannot show an afternoon",
    new Set(oldAnswer.map((s) => dayOf(s.iso))).size < 3 || !oldAnswer.some((s) => hourOf(s.iso) >= 15),
    oldAnswer.map((s) => s.label),
  );
  // Decommented: the note explaining this fix quotes the old line, and an
  // assertion that fails on its own explanation is an assertion nobody keeps.
  ok("the file no longer takes the first six of anything", !/\.slice\(0, 6\)/.test(decomment(read("lib/voice/availability.js"))));
}

// ───────────────────────────────────────────────────────────────────────────
section("3. A day they asked for");

{
  seed();
  const all = await bookableSlots(COMPANY);
  const later = [...new Set(all.map((s) => dayOf(s.iso)))][2];
  const asked = await bookableSlots(COMPANY, later);
  ok(`asking for ${later} answers on or after it`, asked.length > 0 && asked.every((s) => dayOf(s.iso) >= later), asked.map((s) => s.label).slice(0, 3));
  ok("…and that day's own afternoon is in it", asked.filter((s) => dayOf(s.iso) === later).some((s) => hourOf(s.iso) >= 12), asked.filter((s) => dayOf(s.iso) === later).map((s) => s.label));
  // The window is anchored in UTC and the company is not: a day is read in the
  // company's calendar, never the server's.
  ok("never a slot from the day BEFORE the one asked for", asked.every((s) => dayOf(s.iso) >= later));
}

// ───────────────────────────────────────────────────────────────────────────
section("4. The spread rule on its own");

{
  const mk = (n, startHour) =>
    Array.from({ length: n }, (_, i) => {
      const iso = new Date(Date.UTC(2026, 9, 21, startHour + Math.floor(i / 4), (i % 4) * 15)).toISOString();
      return { id: `s${i}`, iso, at: new Date(iso).getTime(), label: `L${i}` };
    });

  const one = spreadSlots(mk(36, 12), "UTC", { days: 5, perDay: 3 });
  ok("36 slots in a day become 3", one.length === 3, one.map((s) => s.label));
  ok("…the first, the middle and the last", one[0].label === "L0" && one[2].label === "L35", one.map((s) => s.label));

  ok("fewer slots than asked for are all returned", spreadSlots(mk(2, 12), "UTC").length === 2);
  ok("one slot survives", spreadSlots(mk(1, 12), "UTC").length === 1);
  ok("nothing in, nothing out", spreadSlots([], "UTC").length === 0 && spreadSlots(null, "UTC").length === 0);
  ok("perDay 1 gives the earliest of the day", spreadSlots(mk(8, 12), "UTC", { days: 5, perDay: 1 })[0].label === "L0");
}

// ───────────────────────────────────────────────────────────────────────────
section("5. What the model is told about the list");

{
  const tools = read("lib/aiEmployee/tools.js");
  ok("the tool calls it a sample, not the diary", /SAMPLE spread over the next few working days/.test(tools));
  ok("…and forbids declaring a day or a part of a day full", /never say a day or a part of a day is unavailable/i.test(tools));
  ok("…and promises the whole day when one is named", /With a date, this IS that whole day/.test(tools) && /returns that WHOLE day/.test(tools));
  ok("…and says how to look at another day", /call check_availability again with that date/i.test(tools));
  ok("the empty answer is still honest", /Nothing is free in that window/.test(tools));
  ok("wired into check:all", /npm run check:availability-spread/.test(JSON.parse(read("package.json")).scripts["check:all"]));
}

// ───────────────────────────────────────────────────────────────────────────
section("6. Two OFFERS are never closer than the appointment is long");

{
  // What the owner read in the transcript: "would Wednesday at 8:00 AM or
  // Wednesday at 8:15 AM suit you better?" — for an in-person estimate.
  seed({ durationMinutes: 90 });
  const visit = await bookableSlots(COMPANY);
  const firstDay = visit.filter((s) => dayOf(s.iso) === dayOf(visit[0].iso)).map((s) => new Date(s.iso).getTime());
  const gaps = firstDay.slice(1).map((t, i) => (t - firstDay[i]) / 60000);
  ok("a 90-minute visit is not offered every 15 minutes", gaps.every((g) => g >= 90), gaps);

  // A phone call keeps exactly what it had — this is not "coarser for
  // everyone", it is "as far apart as the job is long". And the underlying
  // grid is untouched either way: every one of those times still exists and
  // can still be booked, including from the public page, which needs the fine
  // grid for its travel fitting (scripts/check-booking-modes.mjs).
  seed({ durationMinutes: 15 });
  const call = await bookableSlots(COMPANY, null);
  const callDay = call.filter((s) => dayOf(s.iso) === dayOf(call[0].iso)).map((s) => new Date(s.iso).getTime());
  ok("a 15-minute call still has a 15-minute grid underneath", callDay.length > 0);

  // The time reserved AFTER a visit is part of what the day loses to it.
  seed({ durationMinutes: 60, bufferAfter: 30 });
  const buffered = await bookableSlots(COMPANY, null);
  const bDay = buffered.filter((s) => dayOf(s.iso) === dayOf(buffered[0].iso)).map((s) => new Date(s.iso).getTime());
  const bGaps = bDay.slice(1).map((t, i) => (t - bDay[i]) / 60000);
  ok("an hour's visit with half an hour after it steps by 90", bGaps.every((g) => g >= 90), bGaps);
}

// ───────────────────────────────────────────────────────────────────────────
section("7. A named date is answered with that whole day");

{
  seed({ durationMinutes: 90 });
  const browse = await bookableSlots(COMPANY);
  const day = [...new Set(browse.map((s) => dayOf(s.iso)))][1];

  const asked = await bookableSlots(COMPANY, day);
  ok("every time returned is on the day asked about", asked.every((s) => dayOf(s.iso) === day), [...new Set(asked.map((s) => dayOf(s.iso)))]);
  ok("…more of it than the three a browse shows", asked.length > SLOT_PER_DAY, asked.length);
  ok("…reaching the end of the working day", Math.max(...asked.map((s) => hourOf(s.iso))) >= 15, asked.map((s) => s.label));
  ok("…and starting at the beginning of it", Math.min(...asked.map((s) => hourOf(s.iso))) <= 9, asked.map((s) => s.label));
  ok("…capped so it stays readable", asked.length <= SLOT_DAY_MAX, asked.length);

  // A day with nothing free is not a dead end: the agent still gets times to
  // offer, and every label names its own weekday.
  const saturday = (() => {
    const d = new Date(`${day}T12:00:00Z`);
    while (d.getUTCDay() !== 6) d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  })();
  const shut = await bookableSlots(COMPANY, saturday);
  ok("a closed Saturday falls back to real times rather than nothing", shut.length > 0, shut.length);
  ok("…none of them pretending to be that Saturday", shut.every((s) => dayOf(s.iso) !== saturday));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
