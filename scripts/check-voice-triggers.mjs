// Executes the pure helpers in lib/voice/triggers.js — reminder timing + phrasing.
import { reminderTiming, describeAppointmentTime } from "@/lib/voice/triggers";

let pass = 0, fail = 0;
const ok = (n, c, got) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`); } };
const HOUR = 3600e3;
const now = new Date("2026-08-10T12:00:00Z");
const at = (h) => new Date(now.getTime() + h * HOUR);

console.log("\nreminderTiming");
ok("in the past -> skip", reminderTiming(at(-2), now).skip === true);
ok("right now -> skip", reminderTiming(now, now).skip === true);
ok("2h away -> skip (just booked / imminent)", reminderTiming(at(2), now).skip === true);
ok("3h exactly -> not skipped", reminderTiming(at(3), now).skip === false);

console.log("\n...the day-before target");
const twoDays = reminderTiming(at(48), now);
ok("booked 48h out -> reminds ~24h before", !twoDays.skip, twoDays);
ok("...notBefore is 24h before the visit", Math.abs(twoDays.notBefore.getTime() - at(24).getTime()) < 1000, twoDays.notBefore);
ok("...which is in the future", twoDays.notBefore > now);

const insideWindow = reminderTiming(at(20), now);
ok("booked 20h out (inside 24h) -> remind now, not in the past", !insideWindow.skip);
ok("...notBefore clamped to now", Math.abs(insideWindow.notBefore.getTime() - now.getTime()) < 1000, insideWindow.notBefore);
ok("...never before now", insideWindow.notBefore >= now);

console.log("\nHostile timing input");
ok("invalid date -> skip, no crash", reminderTiming("not a date", now).skip === true);
ok("null -> skip", reminderTiming(null, now).skip === true);
ok("skip always carries a reason", ["in the past", "too soon", "no start time"].includes(reminderTiming(at(-1), now).reason));

console.log("\ndescribeAppointmentTime");
const phrase = describeAppointmentTime(new Date("2026-08-12T18:00:00Z"), { timezone: "America/Toronto" });
console.log(`     → "${phrase}"`);
ok("names the weekday", /Wednesday/.test(phrase), phrase);
ok("names the month + day", /August 12/.test(phrase), phrase);
ok("includes a time", /\d:\d\d/.test(phrase), phrase);
ok("french differs", describeAppointmentTime(new Date("2026-08-12T18:00:00Z"), { timezone: "America/Toronto", language: "fr" }) !== phrase);
ok("no timezone still renders", typeof describeAppointmentTime(new Date("2026-08-12T18:00:00Z")) === "string");
ok("bad timezone -> null, doesn't throw", describeAppointmentTime(new Date("2026-08-12T18:00:00Z"), { timezone: "Mars/Base" }) === null);
ok("invalid date -> null", describeAppointmentTime("nope") === null);

console.log("\nThe phrase drops straight into the reminder opening");
// appointment_reminder's opening reads: "confirming your appointment {appointmentWhen}".
const opening = `confirming your appointment ${phrase}. Does that still work?`;
ok("reads naturally", /confirming your appointment Wednesday, August 12 at/.test(opening), opening);

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
