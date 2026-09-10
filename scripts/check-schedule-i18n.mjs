// scripts/check-schedule-i18n.mjs
//
// The scheduling, time-off and payroll screens, in the reader's language.
//
//   npm run check:schedule-i18n
//
// A Spanish account read English day names on /app/scheduler, /app/schedule
// and /app/settings/availability, an English leave-policy paragraph beside
// Spanish headings on /app/time-off, and — worst of the set — a single
// sentence on /app/payroll that began in English, turned Spanish in the middle
// and finished in English. This check exists so none of those three shapes can
// come back:
//
//   1. Day and date names must come from Intl, keyed on the user's language.
//      NOT from a catalogue: CLDR already ships that table for every language,
//      including the ones this product has not translated. The check EXECUTES
//      lib/format/localeDate.js against a known Sunday in several languages
//      rather than reading it — a hardcoded English array passes any amount of
//      reading and fails the first assertion here.
//   2. No bare English sentence may sit in the JSX of these screens.
//   3. Every key these screens ask for must exist in ALL nine catalogues, and
//      the ones that carry a sentence must carry the WHOLE sentence — a key
//      holding half a sentence is what produced the half-and-half payroll
//      intro, and it will produce it again.
//
// ── Comments are stripped before any source assertion ─────────────────────
//
// Several checks in this repo have been fooled by matching their own header
// comment, and this one names English sentences on purpose (the ones above).
// maskComments() below walks the characters tracking string state, so a "//"
// inside a URL or a string does not eat real code — deleting real code is the
// direction that produces a FALSE PASS, which is the only failure mode that
// matters in a check like this.

import { readFile } from "node:fs/promises";

import {
  formatCalendarDay,
  formatDayMonth,
  formatTimeOfDay,
  orderedWeekdayNames,
  weekdayName,
  weekdayNames,
} from "@/lib/format/localeDate";
import { orderedWeekdays } from "@/lib/format/companyDate";
import { APP_MESSAGES } from "@/app/i18n/appMessages.js";

const LANGS = ["en", "fr", "es", "uk", "pa", "tl", "de", "zh", "it"];

// The screens this check governs. PayCycleCard is here because it renders
// inside /app/settings/payroll and is the only place its strings appear.
const SCREENS = [
  "app/app/scheduler/page.js",
  "app/app/schedule/page.js",
  "app/app/time-off/page.js",
  "app/app/payroll/page.js",
  "app/app/payroll/[id]/page.js",
  "app/app/settings/availability/page.js",
  "app/app/settings/payroll/page.js",
  "app/components/settings/PayCycleCard.js",
];

const problems = [];
const fail = (m) => problems.push(m);
let assertions = 0;
function assert(condition, message) {
  assertions += 1;
  if (!condition) fail(message);
}

// ── 1. The date helper, executed ───────────────────────────────────────────

// 2024-01-07 really was a Sunday. Everything below is keyed off that, so an
// off-by-one in the helper shows up as the wrong word rather than passing.
const SUNDAY = new Date(Date.UTC(2024, 0, 7));
const ENGLISH_DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

// English is the control: if these drift, orderedWeekdays()'s promise that it
// still renders exactly what the array it replaced rendered is broken, and
// /app/settings/company's opening-hours editor changes without anyone asking.
assert(
  JSON.stringify(weekdayNames("en")) === JSON.stringify(ENGLISH_DAYS),
  `English weekday names changed: got ${JSON.stringify(weekdayNames("en"))}`,
);
assert(
  JSON.stringify(orderedWeekdays(0, "en").map((d) => d.label)) ===
    JSON.stringify(ENGLISH_DAYS),
  "orderedWeekdays(0, 'en') no longer matches the English array it replaced",
);

// The actual report: a Sunday must not read "Sunday" for a Spanish, French or
// German user. Every non-English catalogue language is checked, because the
// point of using Intl was that languages nobody has translated still work.
for (const lang of LANGS.filter((l) => l !== "en")) {
  const sunday = weekdayNames(lang)[0];
  assert(
    sunday !== "Sunday",
    `weekdayNames("${lang}")[0] is the English word "Sunday" — day names are not localised`,
  );
  assert(
    typeof sunday === "string" && sunday.length > 0,
    `weekdayNames("${lang}") produced an empty Sunday`,
  );
  assert(
    !ENGLISH_DAYS.includes(weekdayName(3, lang)),
    `weekdayName(3, "${lang}") returned an English weekday`,
  );
  assert(
    formatDayMonth(SUNDAY, lang) !== formatDayMonth(SUNDAY, "en") ||
      lang === "tl",
    `formatDayMonth is identical to English for "${lang}" — the language is not reaching Intl`,
  );
}

// A few known-correct words, so "not English" cannot be satisfied by garbage.
//
// The pair also pins the raw/title split: weekdayNames() gives CLDR's form for
// a word inside a sentence, weekdayName() capitalises it for a row label.
// Collapsing the two would print "El periodo cierra el Domingo" in one place
// or a lowercase "domingo" checkbox row in another.
for (const [lang, raw, title] of [
  ["es", "domingo", "Domingo"],
  ["fr", "dimanche", "Dimanche"],
  ["de", "Sonntag", "Sonntag"],
  ["it", "domenica", "Domenica"],
]) {
  assert(
    weekdayNames(lang)[0] === raw,
    `weekdayNames("${lang}")[0] should be "${raw}", got "${weekdayNames(lang)[0]}"`,
  );
  assert(
    weekdayName(0, lang) === title,
    `weekdayName(0, "${lang}") should be "${title}", got "${weekdayName(0, lang)}"`,
  );
}

// Week start rotates the DISPLAY only; each entry keeps its real getDay().
const mondayFirst = orderedWeekdayNames(1, "fr");
assert(
  mondayFirst[0].index === 1 && mondayFirst[6].index === 0,
  "orderedWeekdayNames(1) does not start on Monday and end on Sunday",
);
assert(
  mondayFirst[0].label === "Lundi",
  `Monday-first French should start "Lundi", got "${mondayFirst[0].label}"`,
);

// A calendar day is pinned to UTC. Without the pin, a browser west of
// Greenwich renders midnight UTC as the day before — a pay period that closed
// on the 6th printed as the 5th.
assert(
  formatCalendarDay("2026-09-06", "en") === "Sep 6, 2026",
  `formatCalendarDay lost the UTC pin: got "${formatCalendarDay("2026-09-06", "en")}"`,
);
const western = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "America/Vancouver",
}).format(new Date("2026-09-06T00:00:00Z"));
assert(
  western === "Sep 5, 2026",
  `the UTC-pin test is no longer meaningful — an unpinned western formatter gave "${western}"`,
);

// Bad input is a dash or an empty string on screen, never "Invalid Date".
for (const bad of [null, undefined, "", "not a date"]) {
  assert(
    formatCalendarDay(bad, "es") === "" && formatDayMonth(bad, "es") === "",
    `formatters should return "" for ${JSON.stringify(bad)}`,
  );
}
// An unknown language tag falls back rather than throwing: Intl raises
// RangeError on a bad tag, and a blank screen where a date should be is worse
// than an English one.
assert(
  weekdayNames("zz-!!")[0] === "Sunday",
  "an unparseable language tag should fall back to English, not throw",
);
assert(
  typeof formatTimeOfDay(new Date("2026-09-06T14:30:00Z"), "de") === "string" &&
    formatTimeOfDay(new Date("2026-09-06T14:30:00Z"), "de").length > 0,
  "formatTimeOfDay produced nothing",
);

// ── 2. Plural-aware sentences go through CLDR, not through "n === 1" ───────

// Ukrainian has three forms. A two-form catalogue cannot express it, and an
// English `n === 1 ? "" : "s"` in JSX certainly cannot.
{
  const uk = APP_MESSAGES.uk["app.payroll.cycle.reviewDays"];
  assert(typeof uk === "function", "app.payroll.cycle.reviewDays (uk) is not a function");
  // The DIGITS are stripped before comparing. Without that, `${n} днів` for
  // every n produces three different strings — the count differs — and the
  // check passes while the noun is wrong for two of the three. That was this
  // assertion's own first mutation test.
  const noDigits = (s) => s.replace(/\d+/g, "");
  const forms = new Set(
    [1, 3, 5].map((days) => noDigits(uk({ days }))),
  );
  assert(
    forms.size === 3,
    `Ukrainian day counts collapsed to ${forms.size} noun form(s): ${[...forms].join(" | ")}`,
  );
  const en = APP_MESSAGES.en["app.payroll.cycle.reviewDays"];
  assert(
    en({ days: 1 }).includes("1 day ") &&
      en({ days: 2 }).includes("2 days ") &&
      noDigits(en({ days: 1 })) !== noDigits(en({ days: 2 })),
    "English day counts are not singular/plural",
  );
}

// ── 3. Sentences are WHOLE ─────────────────────────────────────────────────

// The keys below each hold a complete sentence. If one of them ever stops
// ending in sentence punctuation it has been split into a fragment again, and
// a fragment is what gets translated on its own and rendered inside an
// untranslated sentence.
const WHOLE_SENTENCE_KEYS = [
  "app.payroll.intro",
  "app.payroll.introPayYourself",
  "app.payroll.noRateOnRecord",
  "app.payroll.grossNote",
  "app.payroll.onlyApprovedIncluded",
  "app.payroll.noDeductionsSetUp",
  "app.scheduler.missingHours",
  "app.scheduler.checkFirst",
  "app.scheduler.overrideMarked",
  "app.scheduler.changeDateInstead",
  "app.schedule.introCanManage",
  "app.schedule.introViewOnly",
  "app.timeOff.noPolicies",
  "app.timeOff.otherCompanyRecord",
  "app.timeOff.autoApproved",
  "app.payroll.cycle.setByOwner",
  "app.payroll.cycle.calendarOvertime",
  "app.payroll.cycle.describeCalendar",
];
// Punjabi ends a sentence with the danda "।", Chinese with "。". A check that
// only knows the Latin full stop reports every Punjabi string as a fragment,
// which is how a check gets switched off.
const SENTENCE_END = /[.!?。।॥]["'»]?$/;
for (const key of WHOLE_SENTENCE_KEYS) {
  for (const lang of LANGS) {
    const value = APP_MESSAGES[lang]?.[key];
    assert(
      typeof value === "string",
      `${key} is missing from the ${lang} catalogue`,
    );
    if (typeof value !== "string") continue;
    assert(
      SENTENCE_END.test(value.trim()),
      `${key} (${lang}) does not end a sentence — it looks like a fragment: "${value}"`,
    );
  }
}

// ── 4. Source: no bare English, no private date formatting ────────────────

/**
 * Comment bodies blanked, every other character kept in place.
 *
 * Same approach and the same reason as scripts/check-translations.mjs: a regex
 * that strips to end-of-line truncates any line containing "https://" and
 * silently removes the code after it, which is the direction that makes a
 * broken screen pass.
 */
function maskComments(src) {
  const out = src.split("");
  let i = 0;
  let quote = null;
  while (i < src.length) {
    const c = src[i];
    const next = src[i + 1];
    if (quote) {
      if (c === "\\") { i += 2; continue; }
      if (c === quote) quote = null;
      i += 1;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { quote = c; i += 1; continue; }
    if (c === "/" && next === "/") {
      while (i < src.length && src[i] !== "\n") { out[i] = " "; i += 1; }
      continue;
    }
    if (c === "/" && next === "*") {
      out[i] = " "; out[i + 1] = " "; i += 2;
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) {
        if (src[i] !== "\n") out[i] = " ";
        i += 1;
      }
      if (i < src.length) { out[i] = " "; out[i + 1] = " "; i += 2; }
      continue;
    }
    i += 1;
  }
  return out.join("");
}

// JSX entities are decoded first: "Who&apos;s off next" is an English sentence
// whether or not the apostrophe is escaped, and leaving them encoded is how a
// scan misses exactly the lines somebody bothered to escape.
function decodeEntities(src) {
  return src
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ");
}

// ── What counts as prose ───────────────────────────────────────────────────
//
// Two rules, because the two positions carry different amounts of context.
//
// PROSE_MULTI needs real whitespace between words. Without that, `r.endTime`
// in `(r) => r.endTime <= r.startTime` reads as the two-word phrase "r
// endTime" sitting between a ">" and a "<" — which it is, textually, and it
// was the first false positive this check produced.
//
// PROSE_ANY also accepts one capitalised word, and is only used where the
// surrounding lines have already established that we are inside an element's
// children. "Calculate" alone on a line after ")}" is a button label; the same
// word inside an expression is not.
const WORD = "[A-Za-z][A-Za-z'’]*";
const PROSE_MULTI = new RegExp(`^${WORD}(?:[ ,.'’—–-]*[ ][ ,.'’—–-]*${WORD})+[.!?,]?$`);
// The single-word branch requires a CAPITAL. Written with a `*` instead of a
// `+` on the multi-word branch, this matched any lone identifier — the JSX
// boolean prop `showWho` on its own line was reported as English prose.
const PROSE_ANY = new RegExp(`^(?:${WORD}(?:[ ,.'’—–-]*[ ][ ,.'’—–-]*${WORD})+|[A-Z][a-z]{3,})[.!?,]?$`);

// Attributes a human reads.
const HUMAN_ATTRS = /\b(?:placeholder|aria-label|title|alt)=["']([^"']{4,})["']/g;

for (const file of SCREENS) {
  let raw;
  try {
    raw = await readFile(file, "utf8");
  } catch {
    fail(`${file}: cannot be read — did the screen move?`);
    continue;
  }
  const src = decodeEntities(maskComments(raw));
  const lines = src.split("\n");

  // Formatting a date privately is how three screens ended up disagreeing.
  // Everything goes through lib/format/localeDate.js, which takes the language.
  for (const [i, line] of lines.entries()) {
    const m = /\.toLocale(?:Date|Time)?String\s*\(/.exec(line);
    if (m) {
      fail(
        `${file}:${i + 1}: formats a date itself (${m[0].trim()}) — use lib/format/localeDate.js, which takes the reader's language`,
      );
    }
  }

  // The array that started all of this.
  if (/["']Sunday["']\s*,\s*\n?\s*["']Monday["']/.test(src.replace(/\s+/g, " "))) {
    fail(`${file}: hardcodes English weekday names — use lib/format/localeDate.js`);
  }

  let prevFlagged = false;
  let prevTrimmed = "";
  for (const [i, line] of lines.entries()) {
    const trimmed = line.trim();
    if (!trimmed) { prevFlagged = false; prevTrimmed = ""; continue; }

    let flagged = false;

    // (a) JSX text on one line: >Some words<. The lookbehind keeps "=>" and
    //     "<=" out of it — an arrow function followed by a comparison looks
    //     exactly like a text node to a regex.
    for (const m of line.matchAll(/(?<![=!<>-])>([^<>{}]*[A-Za-z]{2,}[^<>{}]*)</g)) {
      const text = m[1].trim();
      if (PROSE_MULTI.test(text)) {
        fail(`${file}:${i + 1}: bare English in JSX — "${text}"`);
        flagged = true;
      }
    }

    // (b) JSX text on its own line. Only inside an element: the previous
    //     significant line has to have opened one (ends ">"), closed an
    //     expression ("}"), or itself been flagged text we are continuing.
    //     Without that context, `required` on its own line reads as prose.
    const opensText = /[>}]$/.test(prevTrimmed) || prevFlagged;
    if (opensText && !/[<>={}();:"'`/\\[\]]/.test(trimmed) && PROSE_ANY.test(trimmed)) {
      fail(`${file}:${i + 1}: bare English in JSX — "${trimmed}"`);
      flagged = true;
    }

    // (c) An attribute a human reads, holding a literal.
    for (const m of line.matchAll(HUMAN_ATTRS)) {
      if (PROSE_ANY.test(m[1].trim())) {
        fail(`${file}:${i + 1}: untranslated ${m[0].split("=")[0]} — "${m[1]}"`);
        flagged = true;
      }
    }

    prevFlagged = flagged;
    prevTrimmed = trimmed;
  }

  // (d) Every app.* key the screen asks for must exist in all nine catalogues.
  //     A key defined only in English renders English inside a Spanish screen,
  //     which is the failure this whole file is about.
  for (const m of src.matchAll(/["'](app\.[A-Za-z0-9_.]+)["']/g)) {
    const key = m[1];
    if (key.endsWith(".")) continue; // a dynamic-key prefix, not a key
    for (const lang of LANGS) {
      assert(
        APP_MESSAGES[lang]?.[key] !== undefined,
        `${file} uses ${key}, which is missing from the ${lang} catalogue`,
      );
    }
  }
}

if (problems.length === 0) {
  console.log(
    `check:schedule-i18n passed — ${assertions} assertions, ${SCREENS.length} screens, ${LANGS.length} languages.`,
  );
} else {
  console.log(`check:schedule-i18n FAILED — ${problems.length} problem(s).\n`);
  for (const p of problems) console.log(`  ✗ ${p}`);
  process.exitCode = 1;
}
