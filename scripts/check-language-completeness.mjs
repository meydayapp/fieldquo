// scripts/check-language-completeness.mjs
//
//   npm run check:language-completeness
//
// Adding a language is nine edits, not one. This is the list.
//
// ══ Why this exists ════════════════════════════════════════════════════════
//
// German, Italian and Mandarin were added to the four message catalogues and
// nothing else. The build stayed green, `check:translations` stayed green, and
// the language picker still showed six languages — because the picker reads
// `LANGUAGES` in app/i18n/languages.js, which nobody had touched. Four of the
// nine steps were done and the five that a customer would actually notice were
// not.
//
// docs/INTERCONNECTIONS.md could not have caught it. That map is GENERATED from
// prisma/schema.prisma, so it maps database relations — and a language is not a
// table. There is no `Language` model, so the map contains no language node at
// all, and the chain from "a catalogue gained a key" to "a picker offers it" is
// invisible to it. A generated entity map answers "what tables relate"; it does
// not answer "what must change together". This check answers the second
// question for the one chain that has already been got wrong.
//
// ══ The two tiers, and why a language may legitimately be in only one ══════
//
// A language can be CATALOGUE-ONLY on purpose. `LANGUAGES` is not just the
// picker — it is also the DOCUMENT language list, and putting a code there lets
// a contractor send a quote PDF in it. Mandarin cannot go there yet: the PDF
// fonts registered in lib/documents/pdfFont.js cover Latin, Cyrillic and
// Gurmukhi, and no CJK face is bundled, so a Chinese quote would render as
// mojibake on a homeowner's copy. That is a real reason, and it is recorded
// below rather than left as an omission that looks identical to a mistake.

import { readFileSync, existsSync } from "node:fs";
import { LANGUAGES } from "@/app/i18n/languages";
import { APP_MESSAGES } from "@/app/i18n/appMessages";
import { DOCUMENT_LABELS } from "@/lib/i18n/documentLabels";
import { CLIENT_DOC_COPY } from "@/lib/i18n/clientDocCopy";
import { EMAIL_COPY } from "@/lib/i18n/emailCopy";
import { SITE_COPY } from "@/lib/site/siteCopy";

let pass = 0;
const failures = [];
const ok = (label, cond, detail) =>
  cond
    ? (pass++, undefined)
    : failures.push(`${label}${detail !== undefined ? ` — ${detail}` : ""}`);

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

// Source read for a REGEX assertion has to lose its comments first. Every file
// this checks explains, in prose, the thing it must not do — pdfFont.js spends
// a paragraph on why no CJK face is registered — and a raw read cannot tell the
// explanation from the deed. Crude but sufficient here: these are .js files with
// no regex literals or template strings containing `//` on the lines that matter.
const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

// Codes whose catalogue exists but which are deliberately NOT offered as a
// document language, each with the reason a human can check.
//
// `tablesComplete` is the difference between the two kinds of held-back, and it
// is a flag rather than prose because prose cannot be checked. A language that
// claims its document tables are done gets held to that claim below — all four
// tables, key-for-key with English — so deleting a German block can never leave
// a comment here quietly asserting it is still there.
const CATALOGUE_ONLY = {
  zh: {
    tablesComplete: false,
    why: "no CJK font is registered in lib/documents/pdfFont.js, so a Chinese quote PDF would render as mojibake",
  },
  // de and it are held back for a DIFFERENT reason from zh, and the difference
  // matters: their script renders fine — Noto Sans covers German umlauts and
  // Italian accents, and check:pdf-fonts now draws all 46 labels of both and
  // reads them back off the page.
  //
  // The document furniture that was missing is no longer missing. All four
  // tables below carry complete German and Italian blocks, key-for-key with
  // English, and the parity assertions further down prove it on every run
  // rather than on somebody's say-so. What remains is one line each in
  // app/i18n/languages.js — the deliberate last step, and the product owner's
  // to take, because `LANGUAGES` is what puts a language in front of a
  // customer. Delete these two entries in the same commit that adds them.
  de: {
    tablesComplete: true,
    why: "the four document tables are complete and verified; adding \"de\" to LANGUAGES is the last step and is the owner's call, not a gap",
  },
  it: {
    tablesComplete: true,
    why: "the four document tables are complete and verified; adding \"it\" to LANGUAGES is the last step and is the owner's call, not a gap",
  },
};

// Offered, plus anything held back that claims its tables are done.
const mustHaveTables = [
  ...LANGUAGES.map((l) => l.code),
  ...Object.entries(CATALOGUE_ONLY)
    .filter(([, v]) => v.tablesComplete)
    .map(([code]) => code),
];

const catalogueCodes = Object.keys(APP_MESSAGES);
const pickerCodes = LANGUAGES.map((l) => l.code);

// ── 1. Every catalogue language is either offered or explicitly held back ──
for (const code of catalogueCodes) {
  const offered = pickerCodes.includes(code);
  const held = Object.prototype.hasOwnProperty.call(CATALOGUE_ONLY, code);
  ok(
    `"${code}" is either in LANGUAGES or recorded as catalogue-only`,
    offered !== held,
    offered && held
      ? `it is in LANGUAGES AND listed as held back ("${CATALOGUE_ONLY[code].why}") — one of the two is wrong, and if it is now genuinely offered the CATALOGUE_ONLY entry is what to delete`
      : "it has a catalogue but is neither offered nor recorded as held back, which is indistinguishable from a forgotten step",
  );
}

// ── 2. Nothing is offered that has no catalogue ────────────────────────────
for (const code of pickerCodes) {
  ok(
    `"${code}" is offered and has a message catalogue`,
    catalogueCodes.includes(code),
    "the picker offers a language with no catalogue behind it",
  );
}

// ── 3. Every per-language FILE exists for every catalogue language ─────────
//
// These are directories of one module per language. A missing file is a hard
// import error at build time for featurePages/industries, which is why they
// were the steps that did get done — the ones below fail silently instead.
for (const dir of ["app/i18n/featurePages", "app/i18n/industries"]) {
  for (const code of catalogueCodes) {
    ok(
      `${dir}/${code}.js exists`,
      existsSync(new URL(`../${dir}/${code}.js`, import.meta.url)),
    );
  }
}

// ── 4. Every per-language TABLE, complete, for every language that claims it ─
//
// The silent half. These are objects keyed by language code inside one file,
// so a missing key is not an import error — it is a fallback to English on a
// client-facing surface, discovered by a homeowner rather than by a build.
//
// Held to `mustHaveTables`, not to the catalogue set: a language nobody can
// select and which makes no claim to be ready does not need document furniture
// yet, and demanding it would block adding a catalogue at all.
//
// ── Why these are the real objects and not a regex over the source ────────
//
// This used to grep each file for `^\s*(de|"de"):`, which is one stray line
// away from a false pass and the false pass was already latent: adding German
// meant adding `de: "de-DE"` to the LOCALE map in documentLabels.js, a line
// that satisfies the regex from inside a completely different object. The
// check would have gone green on a language whose labels were still English —
// the precise failure it was written to prevent, in the file it watches most
// closely. Importing the table asks the question directly.
const TABLES = [
  ["lib/i18n/documentLabels.js", "quote and invoice furniture — subtotal, total, balance due", DOCUMENT_LABELS],
  ["lib/i18n/clientDocCopy.js", "the sentences on a client's copy of a document", CLIENT_DOC_COPY],
  ["lib/i18n/emailCopy.js", "the covering email that carries the document", EMAIL_COPY],
  ["lib/site/siteCopy.js", "the chrome around a contractor's public website", SITE_COPY],
];

// Dot-joined key paths, one entry per leaf. clientDocCopy nests `selfQuote` and
// `visit` two levels deep, and a flat Object.keys would call a language complete
// while every sentence on the visit page was missing.
const shape = (o, prefix = "") =>
  Object.entries(o).flatMap(([k, v]) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? shape(v, `${prefix}${k}.`)
      : [`${prefix}${k}`],
  );

for (const [file, what, table] of TABLES) {
  for (const code of mustHaveTables) {
    ok(
      `${file} has a "${code}" entry (${what})`,
      Object.prototype.hasOwnProperty.call(table, code),
      pickerCodes.includes(code)
        ? "an offered language falls back to English on a client-facing surface"
        : "a language recorded as tablesComplete has no block in this table — one of the two is wrong",
    );
  }

  // ── Key-for-key with English, for every block present ───────────────────
  //
  // Held to what is IN the table rather than to what is offered, deliberately:
  // a language waiting on the picker (de, it) is exactly the one nobody is
  // looking at, and "the block exists" is a much weaker claim than "the block
  // is complete". clientDocCopy falls back per LANGUAGE, not per key, so one
  // missing key there renders as nothing at all on a homeowner's screen.
  const base = shape(table.en);
  for (const code of Object.keys(table)) {
    const here = shape(table[code]);
    const missing = base.filter((k) => !here.includes(k));
    const extra = here.filter((k) => !base.includes(k));
    ok(
      `${file} "${code}" is key-for-key with English (${base.length} keys)`,
      missing.length === 0 && extra.length === 0,
      [...missing.map((k) => `missing ${k}`), ...extra.map((k) => `extra ${k}`)]
        .slice(0, 6)
        .join(", "),
    );
  }
}

// ── 5. The document languages the PDF fonts can actually draw ──────────────
//
// The constraint behind CATALOGUE_ONLY, asserted rather than trusted: if a CJK
// face is ever registered, this fails and sends someone back to reconsider
// whether Mandarin should now be offered.
const fontSrc = stripComments(read("lib/documents/pdfFont.js"));
ok(
  "no CJK face is registered, so holding Mandarin back is still correct",
  !/CJK|NotoSansSC|NotoSansTC|SourceHanSans/i.test(fontSrc),
  "a CJK font appears to be registered — revisit CATALOGUE_ONLY.zh above",
);

if (failures.length) {
  console.error(
    `check:language-completeness FAILED — ${failures.length} problem(s).\n` +
      "Adding a language means every step below, not just the catalogues:\n",
  );
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(
  `check:language-completeness passed — ${catalogueCodes.length} catalogues, ` +
    `${pickerCodes.length} offered, ${pass} assertions.`,
);
