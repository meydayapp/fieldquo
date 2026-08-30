// scripts/check-release-confirm.mjs
//
// The type-the-number box on the one irreversible control in the product.
//
// ══ It could not be satisfied ══════════════════════════════════════════════
//
// Releasing a number deletes it at the phone company and returns it to the
// pool. So it is gated behind retyping the number — the right gate, and it was
// written with the right instinct: "compared loosely (digits only) so a
// contractor who types the pretty form on a phone keyboard is not defeated by
// punctuation."
//
// It compared those digits against the E.164. digits("+13655176689") is ELEVEN
// characters; the label says `Type (365) 517-6689`, which is ten. Typing
// exactly what was asked left the red button disabled, with no message saying
// why — the looseness was real and pointed at the wrong string.
//
// The input also did not format as it was typed, which every other phone field
// in the app does, so a box that was silently failing to match looked like a
// box that was simply refusing the number.
//
// ══ Loose about the human, strict about the number ═════════════════════════
//
// The box exists to prove a person READ the number in front of them. It is not
// a proof they can reproduce E.164. So punctuation and the country code are
// forgiven and the ten digits are not — and a WRONG number must never pass,
// which is the assertion that actually protects anybody.
import { confirmsNumber, formatNanpInput, nanpDigits } from "@/lib/validation";
import { formatNumber } from "@/lib/voice/numbers";
import { readFileSync } from "node:fs";

let fail = 0;
const ok = (c, m, d) => {
  console.log((c ? "  ok   " : "  FAIL ") + m + (c || d === undefined ? "" : `  — got ${JSON.stringify(d)}`));
  if (!c) fail++;
};
const section = (t) => console.log(`\n${t}\n`);

const E164 = "+13655176689";
const DISPLAY = formatNumber(E164);

section("1. The number the label asks for is the number that matches");

ok(DISPLAY === "(365) 517-6689", "the box quotes the display form", DISPLAY);
// The exact failure: this is what a contractor typed, and it did not work.
ok(confirmsNumber("3655176689", E164), "typing the ten digits off the screen confirms");
ok(confirmsNumber(DISPLAY, E164), "…so does the pretty form, brackets and all");
ok(confirmsNumber("13655176689", E164), "…and so does including the country code");
ok(confirmsNumber("365 517 6689", E164), "…and spaces instead of punctuation");
ok(confirmsNumber(" (365) 517-6689 ", E164), "…and stray whitespace");
ok(confirmsNumber(E164, E164), "…and the E.164 itself, for anyone who pastes it");

section("2. The wrong number does not release a number");

ok(!confirmsNumber("3655176688", E164), "one digit out is REFUSED — the gate is about which number, not about typing");
ok(!confirmsNumber("5175176689", E164), "a different area code is refused");
ok(!confirmsNumber("365517668", E164), "nine digits is refused");
ok(!confirmsNumber("36551766899", E164), "eleven digits that are not 1+ten is refused");
ok(!confirmsNumber("", E164), "empty is refused — the button must not be live before anyone types");
ok(!confirmsNumber(null, E164), "null is refused");
ok(!confirmsNumber("(365) 517-6689", ""), "no target number confirms nothing rather than everything");
ok(!confirmsNumber("", ""), "…and empty against empty is not a match");
ok(!confirmsNumber("anything", null), "…nor is anything against null");

section("3. A number that is not North American is still releasable");

// Silently unreleasable is the same bug in a different shape, and it would be
// invisible until the first company with one asked to stop paying for it.
ok(confirmsNumber("+442071234567", "+442071234567"), "an international line confirms exactly");
ok(confirmsNumber("+44 20 7123 4567", "+442071234567"), "…punctuation still forgiven");
ok(!confirmsNumber("+442071234568", "+442071234567"), "…and a wrong one still refused");
ok(nanpDigits("+442071234567") === null, "it is not mistaken for a NANP number");

section("4. It formats as you type, like every other phone field");

ok(formatNanpInput("3") === "3", "the first digits are left alone", formatNanpInput("3"));
ok(formatNanpInput("3655") === "(365) 5", "brackets appear once there is an area code", formatNanpInput("3655"));
ok(formatNanpInput("3655176689") === DISPLAY, "and it lands on exactly what the label quotes", formatNanpInput("3655176689"));
ok(formatNanpInput("+13655176689") === DISPLAY, "pasting the E.164 formats too", formatNanpInput("+13655176689"));
ok(confirmsNumber(formatNanpInput("3655176689"), E164), "what the field shows is what the button accepts — the two cannot drift");
ok(formatNanpInput("+442071234567") === "+442071234567", "an international number is NOT rewritten into brackets it does not use");
ok(formatNanpInput("") === "" && formatNanpInput(null) === "", "empty stays empty rather than becoming '('");

section("5. The screen uses the shared rule, and the server still decides");

const page = readFileSync("app/app/settings/voice/page.js", "utf8");
ok(/confirmsNumber\(typed, e164\)/.test(page), "the release box asks the shared helper");
ok(
  !/const digits = \(s\) =>/.test(page),
  "…and no longer carries the local digits comparison that could not match",
);
ok(/onChange=\{\(e\) => setTyped\(formatNanpInput\(/.test(page), "…and formats the field as it is typed");
// The box is a confirmation, not the authorisation. Non-negotiable: hiding a
// button is not access control, and neither is enabling one.
ok(
  /confirm: e164/.test(page),
  "the E.164 is what gets POSTed, so the route decides which number on its own terms",
);
const route = readFileSync("app/api/settings/voice/route.js", "utf8");
ok(
  /confirm/.test(route),
  "…and the route reads it, rather than trusting that the screen checked",
);

console.log(`\n${fail === 0 ? "ALL PASS" : fail + " FAILED"}`);
process.exit(fail ? 1 : 0);
