import { clampWindow, windowFor, describeWindow, MAX_WINDOW_MINUTES } from "@/lib/booking/arrivalWindow";

let pass = 0, fail = 0;
const ok = (n, c, got) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`); } };

// 2:00 PM Eastern on a Tuesday.
const TWO_PM = new Date("2026-08-11T18:00:00Z");
const TZ = "America/Toronto";

console.log("\nClamping");
ok("0 stays off", clampWindow(0) === 0);
ok("null is off — never widen a promise by default", clampWindow(null) === 0);
ok("undefined is off", clampWindow(undefined) === 0);
ok("'' is off", clampWindow("") === 0);
ok("garbage is off, not a default window", clampWindow("abc") === 0);
ok("negative is off", clampWindow(-30) === 0);
ok("15 stays 15", clampWindow(15) === 15);
ok("9999 caps", clampWindow(9999) === MAX_WINDOW_MINUTES, clampWindow(9999));

console.log("\nThe window itself");
ok("off -> null, so the caller uses its exact time", windowFor(TWO_PM, 0) === null);
const w = windowFor(TWO_PM, 15);
ok("15 min -> 1:45", w.start.toISOString() === "2026-08-11T17:45:00.000Z", w.start.toISOString());
ok("15 min -> 2:15", w.end.toISOString() === "2026-08-11T18:15:00.000Z", w.end.toISOString());
ok("symmetric around the time", (w.end - TWO_PM) === (TWO_PM - w.start));
ok("invalid date -> null, not a crash", windowFor("not a date", 15) === null);
// new Date(null) is the epoch, not an invalid date — without an explicit
// guard this rendered a window in January 1970.
ok("null date -> null", windowFor(null, 15) === null);
ok("empty-string date -> null", windowFor("", 15) === null);
ok("undefined date -> null", windowFor(undefined, 15) === null);

console.log("\nWording");
const s = describeWindow(TWO_PM, 15, { timezone: TZ });
console.log(`  (renders: "${s}")`);
ok("names the day", /Tuesday/.test(s));
ok("says between", /between/.test(s));
ok("shows both ends", /1:45/.test(s) && /2:15/.test(s), s);
ok("off -> null so exact formatting wins", describeWindow(TWO_PM, 0, { timezone: TZ }) === null);
const fr = describeWindow(TWO_PM, 15, { timezone: TZ, language: "fr" });
console.log(`  (fr: "${fr}")`);
ok("french says entre", /entre/.test(fr));
ok("french is not english", fr !== s);
ok("bad timezone -> null, never costs the email", describeWindow(TWO_PM, 15, { timezone: "Mars/Olympus" }) === null);
ok("no timezone still renders", typeof describeWindow(TWO_PM, 15) === "string");

console.log("\nA 2-hour window is still one day");
const wide = describeWindow(TWO_PM, 120, { timezone: TZ });
console.log(`  (renders: "${wide}")`);
ok("noon to 4pm, one weekday named once", (wide.match(/Tuesday/g) || []).length === 1, wide);

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
