// scripts/check-booking-questions.mjs
//
//   node --import ./scripts/alias-loader.mjs scripts/check-booking-questions.mjs
//
// ── What this is guarding ───────────────────────────────────────────────────
//
// The booking page asks "when do you need this done?" (required) and the
// trade's own question(s) (optional), and the confirm route writes the answers
// as lines into BOTH Booking.notes and Appointment.notes — Booking has no
// intake column, so those lines are the record. Three things can rot
// independently and each would be invisible in the browser:
//
//   1. The page stops posting `whenNeeded` / `answers` (a refactor of the
//      submit body) — the chips still render, the server stores nothing.
//   2. The route stops validating through cleanTradeAnswers, or writes the
//      lines to one notes site and not the other — the crew's calendar goes
//      blank while the Booking row looks fine.
//   3. The copy table gains a key in English only, or a French "translation"
//      that is the English sentence — a homeowner reading in French gets an
//      English chip.
//
// The static checks read the two source files as text. The executed checks
// run the real validator against a wrong-ladder answer (the one bug a
// hand-crafted POST would most plausibly carry) and the copy table against
// itself.

import fs from "node:fs";
import path from "node:path";
import {
  cleanTradeAnswers,
  TRADE_QUESTION_COPY,
} from "../lib/leads/tradeQuestions.js";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

let failures = 0;
function check(ok, what) {
  if (ok) {
    console.log(`  ok   ${what}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${what}`);
  }
}

// ── 1. The page posts the answers and gates submit on "when" ───────────────
console.log("BookingFlow.js");
const page = read("app/book/[companySlug]/BookingFlow.js");
// The confirm POST specifically — the settle POST above it also stringifies a
// body, and it is not the one that carries the answers.
const confirmAt = page.indexOf("/confirm`");
const bodyStart = page.indexOf("body: JSON.stringify({", confirmAt);
// Ends at the response read, not at the first "})," — the spread lines
// inside the body ("... : {})," ) would cut the slice short.
const bodyEnd = page.indexOf("const data = await res.json()", bodyStart);
const submitBody = bodyStart >= 0 && bodyEnd > bodyStart ? page.slice(bodyStart, bodyEnd) : "";
check(/^\s*whenNeeded,\s*$/m.test(submitBody), "submit body posts whenNeeded");
check(/^\s*answers,\s*$/m.test(submitBody), "submit body posts answers");
check(/^\s*language,\s*$/m.test(submitBody), "submit body posts language (for the refusal sentence)");
const disabledMatch = page.match(/disabled=\{([^}]*)\}\s*\n\s*className="mt-5 w-full/);
check(Boolean(disabledMatch), "found the submit button's disabled condition");
check(
  Boolean(disabledMatch) && /!whenNeeded/.test(disabledMatch[1]),
  "submit stays disabled until whenNeeded is answered",
);
check(
  Boolean(disabledMatch) &&
    /!form\.name\.trim\(\)/.test(disabledMatch[1]) &&
    /!form\.email\.trim\(\)/.test(disabledMatch[1]),
  "name and email are still required",
);
check(/timelineOptionsFor\(tradeKey\)/.test(page), "when-options come from timelineOptionsFor for the picked service");
check(/questionsFor\(tradeKey\)/.test(page), "trade questions come from questionsFor for the picked service");
check(/tradeQuestionCopy\(language\)/.test(page), "labels come from tradeQuestionCopy in the visitor's language");
check(/\/api\/service-area\/\$\{companySlug\}\?address=/.test(page), "asks /api/service-area for the settled address");
check(/serviceAreaCopy\(language\)\.outside\(/.test(page), "renders the outside-area sentence in the visitor's language");
// No "you're covered" sentence: the page only speaks when the answer is
// "outside". Inside and unknown look identical, on purpose.
check(!/inside\s*===\s*true/.test(page), "renders nothing for inside === true");

// ── 2. The route validates and writes the lines to both notes sites ────────
console.log("confirm/route.js");
const route = read("app/api/booking/[companySlug]/confirm/route.js");
check(/cleanTradeAnswers\(cleanServiceKey \|\| "", \{ whenNeeded, answers, notes \}\)/.test(route), "validates through cleanTradeAnswers for the chosen service");
check(/if \(!cleaned\.whenNeeded\)[\s\S]{0,900}status: 400/.test(route), "refuses (400) when whenNeeded is missing");
check(/tradeAnswerLines\(/.test(route), "builds the staff lines with tradeAnswerLines");
check(/checkServiceArea\(company, \{/.test(route) && /postalCodeFromAddress\(visitAddress\)/.test(route), "checks the service area server-side from the geocoded pin and postal code");
check(/area\.inside === false\) staffLines\.push\(serviceAreaCopy\(staffLanguage\)\.outsideBadge\)/.test(route), "adds the outside-area badge as the first staff line only when inside === false");
const notesWrites = route.match(/^\s*notes: cleanNotes,\s*$/gm) || [];
check(notesWrites.length === 3, `notes: cleanNotes written at 3 sites (held booking, appointment, booking) — found ${notesWrites.length}`);
const apptCreate = route.slice(route.indexOf("db.appointment.create("), route.indexOf("db.booking.create(", route.indexOf("db.appointment.create(")));
check(/notes: cleanNotes/.test(apptCreate), "Appointment.notes carries the same block the Booking row does");
check(!/typeof notes === "string" && notes\.trim\(\) \? notes\.trim\(\)/.test(route), "the free text comes from cleaned.notes, not a second trim");

// The paid path creates the appointment on settlement; it must copy the notes.
const settle = read("lib/booking/settleBookingFee.js");
check(/notes: held\.notes/.test(settle), "settleBookingFee copies Booking.notes onto the paid-path Appointment");

// ── 3. Executed: the validator against the wrong ladder ────────────────────
console.log("cleanTradeAnswers");
const wrongLadder = cleanTradeAnswers("plumbing", { whenNeeded: "within_month" });
check(wrongLadder.whenNeeded === null && wrongLadder.timeline === null, "plumbing + 'within_month' (project ladder) → null");
const urgent = cleanTradeAnswers("plumbing", { whenNeeded: "today" });
check(urgent.whenNeeded === "today" && urgent.timeline === "asap", "plumbing + 'today' → timeline asap");
const project = cleanTradeAnswers("", { whenNeeded: "within_month" });
check(project.whenNeeded === "within_month" && project.timeline === "2_weeks", "no service + 'within_month' → timeline 2_weeks");
const junk = cleanTradeAnswers("plumbing", {
  whenNeeded: "today",
  answers: { waterShutOff: "maybe", activeLeak: "yes", __proto__: null },
  notes: " x ".repeat(2000),
});
check(Object.keys(junk.answers).length === 0, "off-table option and off-trade question are both dropped");
check(junk.notes.length === 2000, "free text capped at 2000");

// ── 4. Executed: the copy table is complete in all three languages ─────────
console.log("TRADE_QUESTION_COPY");
const SAME_OK = new Set(["Notes", "No", "Interior", "Exterior"]);
function flatten(obj, prefix = "") {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v && typeof v === "object") Object.assign(out, flatten(v, `${prefix}${k}.`));
    else out[`${prefix}${k}`] = v;
  }
  return out;
}
const en = flatten(TRADE_QUESTION_COPY.en);
const enKeys = Object.keys(en).sort().join("|");
for (const lang of ["fr", "es"]) {
  const table = flatten(TRADE_QUESTION_COPY[lang] || {});
  check(Object.keys(table).sort().join("|") === enKeys, `${lang} has exactly the en key set`);
  const untranslated = Object.entries(table)
    .filter(([k, v]) => v === en[k] && !SAME_OK.has(v))
    .map(([k]) => k);
  check(untranslated.length === 0, `${lang} has no value equal to en${untranslated.length ? ` (${untranslated.join(", ")})` : ""}`);
  const empty = Object.entries(table).filter(([, v]) => typeof v !== "string" || !v.trim()).map(([k]) => k);
  check(empty.length === 0, `${lang} has no empty value${empty.length ? ` (${empty.join(", ")})` : ""}`);
}

console.log(failures ? `\n${failures} failure(s)` : "\nall checks passed");
process.exit(failures ? 1 : 0);
