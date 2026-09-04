// scripts/check-app-catalogue-coverage.mjs
//
//   npm run check:app-catalogue
//
// The /app interface catalogue, held to a floor that only moves upward.
//
// ══ Why this exists, when check:translations already prints coverage ═══════
//
// It printed it and did nothing about it. check-translations.mjs gates `app.*`
// on English and French and *reports* the rest, which was an honest policy
// when the app catalogue was English-and-French by design. It stopped being
// honest the day Spanish, Ukrainian, Punjabi and Tagalog were filled in to
// roughly two thirds each: a Spanish-speaking contractor saw a third of the
// back office in English, no check went red, and nothing recorded that the
// figure was supposed to climb. A number nobody can regress is not a gate.
//
// This file is the gate. It does one thing check:translations cannot: it
// remembers where each language WAS, and fails if it slips.
//
// ══ Rule 1: the language list comes from the catalogue ═════════════════════
//
// Never a literal list of codes, never a count. Seven separate checks in this
// repo had to be fixed after they were written against "six languages" and
// quietly stopped covering the seventh, eighth and ninth. Everything below
// iterates Object.keys(APP_MESSAGES) and derives the source-of-truth key set
// from the English block itself.
//
// FLOORS is the one place a code is written down, and it has to be — a
// recorded minimum is a fact about a specific language on a specific day, not
// something derivable. So the floor TABLE is checked against the catalogue in
// both directions: a language with no floor fails, and a floor for a language
// that no longer exists fails. Adding a language therefore forces a decision
// here rather than silently landing outside the gate, which is the exact shape
// of the bug this paragraph exists to prevent.
//
// ══ Rule 2: an English echo is not a translation ═══════════════════════════
//
// `k in dict` counts a key as covered even when its value is the English
// string copied across. Some of those are correct — "Subtotal", "DNS",
// "Marketing" and "Interior" are spelled that way in Spanish too, and a
// catalogue that forbade them would push translators into inventing worse
// words. Wholesale copying is not correct, and the two look identical to a
// membership test.
//
// The rule that separates them, applied to every value byte-identical to
// English:
//
//   Strip the parts no language owns — {placeholders}, any token containing a
//   digit ("$1k–$5k", "100%"), and anything shaped like an email address, URL
//   or bare domain. Split what remains on the punctuation that separates
//   labels from each other: / , ( ) · — & : | and the like.
//
//   The entry is ACQUITTED if every remaining segment is at most ONE word.
//   It is an ECHO if any segment holds two or more words.
//
// The reasoning: a single word identical to English is a LABEL, and labels
// coincide across languages constantly — that is what borrowing, Latin roots
// and brand nouns do. Two English words in a row that survived translation are
// a PHRASE, and phrases do not coincide by accident; word order is the first
// thing that changes. The rule is therefore blind to vocabulary (no per
// language word list to maintain, nothing to argue about) and catches the
// failure that actually happened: "Phone credit", "AI image credit", "Download
// all formats" and "Not tracked" sat identical in all four unfinished
// languages, because they were the newest keys and were copied rather than
// translated.
//
// SHARED_LITERALS is the escape hatch, and is deliberately tiny: multi-word
// PROPER NOUNS that every language does print in English. It is reviewed by
// eye, not grown by convenience — anything added to it must be a name.
//
// An echo does NOT count toward coverage. That is the whole assertion: a
// language that copied English wholesale would score near zero here rather
// than 100%, and a floor set from these adjusted numbers cannot be met by
// pasting the English block.
//
// ══ Rule 3: two kinds of floor ═════════════════════════════════════════════
//
// `keys` — the minimum number of translated (present, non-echo) keys. This is
// the ratchet for a language still being filled in. A COUNT rather than a
// percentage on purpose: an agent adding fifty new English strings should not
// turn every unfinished language red for a gap they did not open. Deleting a
// translation, emptying one, or replacing one with English still fails, which
// is the regression a ratchet is for.
//
// `complete` — the language is finished, and every English key must have a
// translation. Here a new untranslated English string SHOULD fail: that is
// already how check:translations treats French, and a language advertised as
// complete that quietly rots back to 90% is the original bug wearing a
// different hat.
//
// Raise a floor when you raise a language. Never lower one.
//
// One clamp on `keys`: it is compared against min(floor, English key count), so
// DELETING an English string — a legitimate thing to do when a screen goes away
// — doesn't fail every language for losing a translation of something that no
// longer exists. Losing a translation while English stands still is what the
// floor is for, and that still fails.

// Relative and with the extension: this runs under plain node, which has
// neither the bundler's "@/" alias map nor its extension guessing. Same
// reasoning as the import at the top of check-translations.mjs.
import { APP_MESSAGES } from "../app/i18n/appMessages.js";

// ── The floors ─────────────────────────────────────────────────────────────
//
// Measured 2026-09-03, after Spanish was completed. English is the source and
// has no floor of its own.
const FLOORS = {
  fr: { keys: 4965, complete: true },
  es: { keys: 4965, complete: true },
  uk: { keys: 3416, complete: false },
  pa: { keys: 3413, complete: false },
  tl: { keys: 3363, complete: false },
  de: { keys: 4965, complete: true },
  zh: { keys: 4965, complete: true },
  it: { keys: 4965, complete: true },
};

// Multi-word strings that are the same in every language because they are
// names. Keep this list short enough to read in one glance; if it needs a
// category heading it has stopped being a list of proper nouns.
const SHARED_LITERALS = new Set([
  "FieldQuo AI", // the product's own assistant, unbranded nowhere
  "Meta Ads", // Meta's product name; localised nowhere in their own console
]);

// ── The echo test ──────────────────────────────────────────────────────────

// Tokens no language owns: placeholders, anything numeric, and addresses.
// Removed before the word count, so "{count} sections", "$1k–$5k" and
// "you@email.com" are judged on what is left rather than on their punctuation.
const PLACEHOLDER = /\{[^}]*\}/g;
const ADDRESSY = /\S+@\S+|\bhttps?:\/\/\S+|\b[\w-]+\.(?:com|ca|org|net|io)\b/gi;
const HAS_DIGIT = /\d/;

// The punctuation that separates one label from another. A value is a LIST of
// labels when it uses these — "Interior / exterior", "Sans (Arial)",
// "Before & after" — and each side is judged on its own.
const SEGMENT_SPLIT = /[/,()·•|:;—–\-]|\s&\s/g;

/**
 * Is `value`, known to be identical to English, nonetheless acceptable?
 *
 * Returns true for a label (or a list of labels), false for a phrase.
 */
export function isLanguageNeutral(value) {
  if (typeof value !== "string") return false;
  if (SHARED_LITERALS.has(value.trim())) return true;

  const stripped = value.replace(PLACEHOLDER, " ").replace(ADDRESSY, " ");

  for (const segment of stripped.split(SEGMENT_SPLIT)) {
    if (segment === undefined) continue;
    const words = segment
      .split(/\s+/)
      .filter((w) => w && !HAS_DIGIT.test(w))
      // A token with no letter at all is punctuation or a symbol ("±", "→",
      // "$"), not a word anybody translates.
      .filter((w) => /\p{L}/u.test(w));
    if (words.length > 1) return false;
  }
  return true;
}

// ── Counted nouns ──────────────────────────────────────────────────────────
//
// A `countedNoun` entry is a FUNCTION, so `===` can say nothing about it. Two
// things still have to hold, and only one of them is a gate.
//
// GATE — shape. Where English is a counted noun, the translation must be one
// too. A translation that answers a count with a fixed string is the exact
// defect that put a bare Latin "s" on a Chinese screen and "1 дзвінків" —
// genitive plural, for one — on a Ukrainian one: the English plural rule
// wearing a placeholder. This is language-independent, so it fails the build.
//
// GATE — echo. Every form the translation can render is judged by the same
// label-versus-phrase rule as a plain string, against the English forms for the
// same key. A translator who left `{ one: "thing worth fixing" }` in place is
// copying, and it does not count as coverage.
//
// NOT a gate — declension. "The Spanish `one` and `other` must differ" is
// tempting and wrong as an assertion. French `rendez-vous` and Italian `foto`
// are invariable and correctly identical; Mandarin has ONE plural category, so
// identical is the only possible answer; and Tagalog's two CLDR categories are
// a phonological rule about the linker rather than a count at all — the header
// of lib/i18n/plurals.js spells that out. A check that failed those would be
// demanding worse translations. It is reported instead, per language, so a
// human can tell an invariable noun from a lazy one.
const PLURAL_PROBE = [0, 1, 2, 3, 5, 11, 21, 100, 1000, 10000, 1000000];

/** The distinct words a counted-noun entry can print, keyed by CLDR category. */
function renderedForms(fn, locale) {
  const rules = new Intl.PluralRules(locale);
  const byCategory = new Map();
  for (const value of PLURAL_PROBE) {
    const category = rules.select(value);
    if (byCategory.has(category)) continue;
    let printed;
    try {
      printed = String(fn({ value }));
    } catch {
      printed = "";
    }
    // countedNoun prints "<n> <word>"; the number is not the translation.
    byCategory.set(category, printed.replace(/^\S+\s*/, ""));
  }
  return byCategory;
}

/**
 * Coverage of one language against English.
 *
 * `translated` is what the floors are measured in: present, and not an echo.
 */
export function measure(code) {
  const en = APP_MESSAGES.en;
  const keys = Object.keys(en);
  const dict = APP_MESSAGES[code] || {};
  // Tagalog's ICU locale is "fil"; "tl" is the catalogue's own code and resolves
  // to English rules, which would report the wrong categories for it.
  const locale = code === "tl" ? "fil" : code;
  const { pluralCategories } = new Intl.PluralRules(locale).resolvedOptions();

  const missing = [];
  const echoed = [];
  const wrongType = [];
  const flatCounts = [];

  for (const key of keys) {
    if (!(key in dict)) {
      missing.push(key);
      continue;
    }
    const value = dict[key];
    const kind = typeof value;
    if (kind !== "string" && kind !== "function") {
      wrongType.push(`${key} is ${kind}`);
      continue;
    }
    if (typeof en[key] === "function") {
      if (kind !== "function") {
        wrongType.push(
          `${key} answers a count with a fixed ${kind} — English declines it, ` +
            `so this must be a countedNoun("${locale}", …) too`,
        );
        continue;
      }
      const words = [...renderedForms(value, locale).values()];
      const theirs = new Set(renderedForms(en[key], "en").values());
      // Same label-versus-phrase test as a plain string, applied to every form
      // the entry can print. "Reproducing English's singular/plural pair is
      // proof of copying" was tried here and is false: French `minute` /
      // `minutes` and `photo` / `photos` are correct French and identical to
      // English down to the -s. A one-word counted noun that matches English is
      // therefore NOT catchable without a per-language word list, which Rule 2
      // deliberately refuses to keep. A multi-word one is — `{ one: "photo
      // read", other: "photos read" }` left in a Spanish block fails here.
      if (words.every((w) => theirs.has(w) && !isLanguageNeutral(w))) {
        echoed.push(key);
        continue;
      }
      // Only worth saying in a language that HAS more than one plural
      // category. Mandarin has exactly one, so "the same word for every count"
      // is the only thing it can possibly do, and listing sixteen of them
      // would bury the two lines that matter.
      if (pluralCategories.length > 1 && new Set(words).size === 1 && theirs.size > 1) {
        flatCounts.push(`${key} prints "${words[0]}" for every count`);
      }
      continue;
    }
    if (typeof en[key] === "string" && value === en[key] && !isLanguageNeutral(value)) {
      echoed.push(key);
    }
  }

  const translated = keys.length - missing.length - echoed.length - wrongType.length;
  return { keys, missing, echoed, wrongType, flatCounts, translated };
}

/** Missing keys bucketed by their `app.<area>` prefix, largest area first. */
function byArea(keys) {
  const groups = new Map();
  for (const key of keys) {
    const area = key.split(".").slice(0, 2).join(".");
    if (!groups.has(area)) groups.set(area, []);
    groups.get(area).push(key);
  }
  return [...groups.entries()].sort(
    (a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]),
  );
}

// ── Run ────────────────────────────────────────────────────────────────────

const failures = [];
const catalogueCodes = Object.keys(APP_MESSAGES);
const translatedCodes = catalogueCodes.filter((c) => c !== "en");
const enKeys = Object.keys(APP_MESSAGES.en);

// The floor table and the catalogue must describe the same set of languages.
for (const code of translatedCodes) {
  if (!FLOORS[code]) {
    failures.push(
      `${code} is in APP_MESSAGES with no floor recorded — add one to FLOORS ` +
        `in this file (see "Rule 3" in the header) rather than leaving a ` +
        `language outside the gate.`,
    );
  }
}
for (const code of Object.keys(FLOORS)) {
  if (!catalogueCodes.includes(code)) {
    failures.push(`FLOORS records ${code}, which is no longer in APP_MESSAGES`);
  }
}

console.log(
  `\nApp interface catalogue — ${enKeys.length} English keys, ` +
    `${translatedCodes.length} translated catalogues\n`,
);

const reports = [];

for (const code of translatedCodes) {
  const { missing, echoed, wrongType, flatCounts, translated } = measure(code);
  const floor = FLOORS[code];
  const pct = ((translated / enKeys.length) * 100).toFixed(1);
  const flags = [];
  if (echoed.length) flags.push(`${echoed.length} English echo(es)`);
  if (missing.length) flags.push(`${missing.length} missing`);
  if (wrongType.length) flags.push(`${wrongType.length} of the wrong shape`);
  if (flatCounts.length)
    flags.push(`${flatCounts.length} counted noun(s) that never change`);

  console.log(
    `  ${code.padEnd(4)} ${String(pct).padStart(5)}%  ` +
      `${String(translated).padStart(4)}/${enKeys.length}  ` +
      `floor ${String(floor ? floor.keys : "—").padStart(4)}` +
      `${floor?.complete ? " (complete)" : ""}` +
      `${flags.length ? `  — ${flags.join(", ")}` : ""}`,
  );

  if (!floor) continue;

  // Clamped to the English count — see the note under "Rule 3".
  const effectiveFloor = Math.min(floor.keys, enKeys.length);
  if (translated < effectiveFloor) {
    failures.push(
      `${code} fell below its floor: ${translated} translated, floor is ` +
        `${effectiveFloor}. Coverage does not go backwards — restore the ` +
        `${effectiveFloor - translated} lost key(s), or explain in a commit ` +
        `why the floor itself should move down.`,
    );
  }
  if (floor.complete && translated !== enKeys.length) {
    failures.push(
      `${code} is recorded as complete but has ${enKeys.length - translated} ` +
        `key(s) untranslated (${missing.length} absent, ${echoed.length} ` +
        `copied from English). Either translate them or drop \`complete\` ` +
        `for ${code}.`,
    );
  }
  for (const problem of wrongType) {
    failures.push(`${code}: ${problem}`);
  }

  if (missing.length || echoed.length || flatCounts.length) {
    reports.push({ code, missing, echoed, flatCounts });
  }
}

// ── What the next agent works from ─────────────────────────────────────────
//
// Grouped by `app.<area>` and largest area first, because a language gets
// finished a SCREEN at a time — doing "app.plans" in one sitting keeps the
// vocabulary of one feature consistent, which translating alphabetically does
// not. Printed always, gate or no gate: this is the worklist.
for (const { code, missing, echoed, flatCounts } of reports) {
  console.log(`\n  ── ${code}: ${missing.length} absent, ${echoed.length} English ──`);
  for (const [area, keys] of byArea(missing)) {
    console.log(`     ${String(keys.length).padStart(4)}  ${area}`);
    if (process.env.VERBOSE) for (const k of keys) console.log(`           ${k}`);
  }
  if (echoed.length) {
    console.log(`     English text still sitting in the ${code} block:`);
    for (const key of echoed) {
      const value = APP_MESSAGES[code][key];
      console.log(
        `           ${key} = ${
          typeof value === "function"
            ? "countedNoun, every form English"
            : JSON.stringify(value)
        }`,
      );
    }
  }
  if (flatCounts.length) {
    // Advisory, not a failure — an invariable noun looks exactly like this and
    // is correct. See the "NOT a gate — declension" note above.
    console.log(
      `     Counted nouns that print the same word for every count — correct ` +
        `for an invariable noun, worth a human's eye otherwise:`,
    );
    for (const note of flatCounts) console.log(`           ${note}`);
  }
}

console.log(
  "\n  (VERBOSE=1 lists every absent key, not just the per-area counts.)\n",
);

if (failures.length) {
  console.error(`check:app-catalogue FAILED — ${failures.length} problem(s).\n`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}

console.log(
  `check:app-catalogue passed — ${translatedCodes.length} catalogues, ` +
    `${translatedCodes.filter((c) => FLOORS[c]?.complete).length} complete, ` +
    `all at or above their floor.`,
);
