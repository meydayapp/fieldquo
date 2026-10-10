// scripts/check-company-name-stop.mjs
//
//   npm run check:company-name-stop
//
// TrueFinish's pay-over-time guide printed "If you have a question, contact
// TrueFinish Cabinets Inc. ." (2026-10-10): the stored name carries a
// trailing space and ends in "Inc.", and the sentence added its own full
// stop. lib/i18n/companyName.js fixes it at display; this proves it:
//
//   1. The helper: trims, adds a stop only when the name has none, never
//      prints a lone ".".
//   2. The guide's sentence, exactly, in all eight languages, for "Inc. "
//      and for a name without a stop.
//   3. A sweep: every sentence function in every client copy table that
//      carries a company name (clientDocCopy, the guide, the client emails,
//      the review email, the prep guide, how-to-pay), in every language, is
//      called with "TrueFinish Cabinets Inc. " — none may print "Inc. ." or
//      "Inc..". Then with "Acme Painting": every sentence that ended on the
//      name still ends with "Acme Painting." (the stop wasn't lost).
//   4. No `${company}.` is left in those tables' source.
//   5. The stored name is never rewritten: the helper is display-only.
//
// Bundled through esbuild because the copy modules use the @/ alias.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { companyDisplayName, nameThenStop } from "../lib/i18n/companyName.js";
import { CLIENT_DOC_COPY } from "../lib/i18n/clientDocCopy.js";
import { PAY_OVER_TIME_GUIDE_COPY, payOverTimeGuideCopy } from "../lib/i18n/payOverTimeGuideCopy.js";
import { EMAIL_COPY } from "../lib/i18n/emailCopy.js";
import { REVIEW_EMAIL_LANGUAGES, reviewCopy } from "../lib/reviews/reviewEmail.js";
import { PREP_GUIDE_COPY } from "../lib/prepGuide/copy.js";
import { OFFLINE_METHOD_COPY, buildHowToPay } from "../lib/payments/offlineMethods.js";

const ROOT = process.cwd();
const read = (p) => readFileSync(join(ROOT, p), "utf8");

let pass = 0;
let fail = 0;
const ok = (name, cond, got) => {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name}${got === undefined ? "" : `  — got ${JSON.stringify(got)}`}`);
  }
};
const section = (t) => console.log(`\n${t}`);

const INC = "TrueFinish Cabinets Inc. ";
const PLAIN = "Acme Painting";
const LANGS = ["en", "fr", "es", "uk", "pa", "tl", "de", "it"];

// ═══════════════════════════════════════════════════════════════════════════
section("1. The helper");
ok('"TrueFinish Cabinets Inc. " → "TrueFinish Cabinets Inc." (trimmed, no second stop)', nameThenStop(INC) === "TrueFinish Cabinets Inc.", nameThenStop(INC));
ok('"Acme Painting" → "Acme Painting." (the stop is added)', nameThenStop(PLAIN) === "Acme Painting.", nameThenStop(PLAIN));
ok('"  Acme   Painting  " → "Acme Painting."', nameThenStop("  Acme   Painting  ") === "Acme Painting.");
ok('"Yes Paint!" and "Paint Co…" keep their own stop', nameThenStop("Yes Paint!") === "Yes Paint!" && nameThenStop("Paint Co…") === "Paint Co…");
ok("an empty or missing name prints nothing, never a lone '.'", nameThenStop("") === "" && nameThenStop("   ") === "" && nameThenStop(null) === "" && nameThenStop(undefined) === "");
ok('with a tail: "Inc. " + " at 555-0100" → "TrueFinish Cabinets Inc. at 555-0100."', nameThenStop(INC, " at 555-0100", "") === "TrueFinish Cabinets Inc. at 555-0100.", nameThenStop(INC, " at 555-0100", ""));
ok('with an empty tail: "Inc. " + "" + "" → "TrueFinish Cabinets Inc."', nameThenStop(INC, "", "") === "TrueFinish Cabinets Inc.");
ok("companyDisplayName trims and folds whitespace", companyDisplayName(INC) === "TrueFinish Cabinets Inc." && companyDisplayName(" A \n B ") === "A B" && companyDisplayName(null) === "");

// ═══════════════════════════════════════════════════════════════════════════
section("2. The pay-over-time guide's sentence, as TrueFinish saw it");
{
  const en = payOverTimeGuideCopy("en", { names: ["Klarna"], company: INC });
  ok("en: exactly “…contact TrueFinish Cabinets Inc.”", en.unavailable === "Paying over time isn't offered on this account right now. If you have a question, contact TrueFinish Cabinets Inc.", en.unavailable);
  ok("en: the intro opens on the trimmed name", en.intro.startsWith("TrueFinish Cabinets Inc. offers"), en.intro);
  const enPlain = payOverTimeGuideCopy("en", { names: ["Klarna"], company: PLAIN });
  ok("en, a name without a stop: “…contact Acme Painting.”", enPlain.unavailable.endsWith("contact Acme Painting."), enPlain.unavailable);
  for (const lang of LANGS) {
    const c = payOverTimeGuideCopy(lang, { names: ["Klarna", "Affirm"], company: INC });
    const all = JSON.stringify(c);
    ok(`${lang}: no "Inc. ." / "Inc.." anywhere in the guide`, !/Inc\.\s+\.|Inc\.\./.test(all), all.match(/.{30}Inc\.\s*\..{0,5}/)?.[0]);
    ok(`${lang}: no double space from the stored trailing space`, !/Inc\. {2}/.test(all));
    const p = payOverTimeGuideCopy(lang, { names: ["Klarna"], company: PLAIN });
    ok(`${lang}: a plain name never ends the sentence without a stop`, !/Acme Painting\s*$/.test(p.unavailable), p.unavailable);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. Every client sentence that carries the company name");
// The company name goes ONLY into the parameters that carry it — read from
// each function's own parameter list — and a neutral lowercase "q7" into every other
// (a date, a phone, an amount). Filling every argument with the name would
// flag "arrive on <date>." as a double stop, which it isn't.
const NAME_PARAM = /^(company|companyName|payee)$/;
// how-to-pay's cheque/check sentence names its payee `p`.
const NAME_PARAM_BY_KEY = { cheque: /^p$/, check: /^p$/ };
function params(fn) {
  const src = fn.toString();
  const m = src.match(/^\s*(?:async\s*)?(?:function[^(]*)?\(([^)]*)\)/) || src.match(/^\s*(?:async\s*)?([A-Za-z_$][\w$]*)\s*=>/);
  if (!m) return null;
  return m[1].split(",").map((p) => p.trim().replace(/\s*=.*$/, "")).filter(Boolean);
}
const tables = [
  ["clientDocCopy", CLIENT_DOC_COPY],
  ["payOverTimeGuide", PAY_OVER_TIME_GUIDE_COPY],
  ["emailCopy", EMAIL_COPY],
  ["reviewEmail", Object.fromEntries(REVIEW_EMAIL_LANGUAGES.map((l) => [l, reviewCopy(l)]))],
  ["prepGuide", PREP_GUIDE_COPY],
  ["howToPay", OFFLINE_METHOD_COPY],
];
function* functions(node, path = []) {
  if (typeof node === "function") yield [path.join("."), node];
  else if (node && typeof node === "object") for (const [k, v] of Object.entries(node)) yield* functions(v, [...path, k]);
}
// The other arguments are tried three ways — a value, empty, and a function
// (a link builder like marketingFooter's `a`) — because a sentence often
// ends on the name only in one branch ("call Acme." vs "call Acme at 555.").
const OTHERS = ["q7", "", (x) => String(x)];
const call = (fn, names, name, other) => {
  try {
    const out = fn(...names.map((p) => (p === null ? other : name)));
    return typeof out === "string" ? out : JSON.stringify(out ?? "");
  } catch {
    return "";
  }
};
const calls = (fn, names, name) => OTHERS.map((o) => call(fn, names, name, o)).join("\n");
let swept = 0;
let ending = 0;
for (const [label, table] of tables) {
  const doubles = [];
  const lost = [];
  let printed = 0;
  for (const lang of Object.keys(table)) {
    for (const [path, fn] of functions(table[lang])) {
      const ps = params(fn);
      if (!ps || !ps.length) continue;
      const key = path.split(".").pop();
      const isName = NAME_PARAM_BY_KEY[key] || NAME_PARAM;
      const slots = ps.map((p) => (isName.test(p) ? p : null));
      if (!slots.some(Boolean)) continue;
      swept++;
      const withInc = calls(fn, slots, INC);
      if (withInc.includes("TrueFinish Cabinets Inc.")) printed++;
      if (/Inc\.\s+\.|Inc\.\.(?!\.)/.test(withInc)) doubles.push(`${lang}.${path}: …${withInc.match(/.{0,40}Inc\.\s*\./)[0]}`);
      // The other direction: a sentence that ENDS on the name (it goes through
      // nameThenStop) must still end with a stop for a name that has none.
      const withPlain = calls(fn, slots, PLAIN);
      if (/nameThenStop\w*\(/.test(fn.toString())) {
        ending++;
        if (!withPlain.includes("Acme Painting.")) lost.push(`${lang}.${path}: ${withPlain.slice(-60)}`);
      }
      // The naive "fix" — dropping the template's "." — leaves a sentence that
      // just stops on the name. Caught here whether or not the function uses
      // the helper: "Acme Painting" at the end of the text or before a new
      // sentence, unless it is a title-like tail ("How did we do? — Acme") or a
      // subject, heading, title or label, which end on the name by design.
      if (!/subject|heading|title|label|eyebrow|alt$/i.test(key)) for (const line of withPlain.split("\n")) {
        if (/(?<![—·:|]\s)Acme Painting(?=\s*$|\s+[A-ZÀ-ÝА-ЯЄІЇҐ¿¡])/.test(line)) lost.push(`${lang}.${path}: …${line.slice(-60)}`);
      }
    }
  }
  ok(`${label}: no "Inc. ." or "Inc.." in any language (${printed} sentences print the name)`, doubles.length === 0 && printed > 0, doubles.slice(0, 5));
  ok(`${label}: a name without a stop still gets one where the sentence ends on it`, lost.length === 0, lost.slice(0, 5));
}
ok(`the sweep reached the sentences that matter (${swept} with a company parameter, ${ending} ending on the name)`, swept > 150 && ending >= 70, { swept, ending });

// How to pay, end to end: the cheque payee is the company when none is typed.
{
  const company = { name: INC, country: "CA", paymentMethods: ["cheque"], paymentMethodDetails: { cheque: { mailingAddress: "1 Main St" } } };
  const htp = JSON.stringify(buildHowToPay({ company, language: "en" }));
  ok("how to pay: “Make cheques payable to TrueFinish Cabinets Inc.” — one stop", htp.includes("Make cheques payable to TrueFinish Cabinets Inc.") && !/Inc\.\s*\./.test(htp), htp.slice(0, 300));
  const typed = JSON.stringify(buildHowToPay({ company: { ...company, name: "X", paymentMethodDetails: { cheque: { payee: "  Acme Painting  ", mailingAddress: "1 Main St" } } }, language: "fr" }));
  const blank = JSON.stringify(buildHowToPay({ company: { ...company, paymentMethodDetails: { cheque: { payee: "   ", mailingAddress: "1 Main St" } } }, language: "en" }));
  ok("how to pay: a blank typed payee falls back to the company, not to “payable to .”", blank.includes("Make cheques payable to TrueFinish Cabinets Inc.") && !/payable to\s*\.?"/.test(blank), blank.slice(0, 300));
  ok("how to pay: a typed payee is trimmed and gets its stop (fr)", typed.includes("à l'ordre de Acme Painting.") , typed.slice(0, 300));
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. No `${company}.` left in the client copy");
for (const f of [
  "lib/i18n/clientDocCopy.js",
  "lib/i18n/payOverTimeGuideCopy.js",
  "lib/i18n/emailCopy.js",
  "lib/reviews/reviewEmail.js",
  "lib/prepGuide/copy.js",
  "lib/payments/offlineMethods.js",
  "app/quote/[companySlug]/kitchen/page.js",
]) {
  const code = read(f).replace(/^\s*\/\/.*$/gm, "");
  const left = code.match(/\$\{(company|company\.name|companyName|p)\}[.।](?=[`\s"'<)])/g) || [];
  ok(`${f}: every sentence-final name goes through nameThenStop`, left.length === 0, left);
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. Display only — the stored name is never rewritten");
{
  const src = read("lib/i18n/companyName.js").replace(/^\s*\/\/.*$/gm, "");
  ok("companyName.js imports no database and writes nothing", !/import|db\.|update\(|prisma/i.test(src));
  ok("the guide page trims for display", /companyDisplayName\(company\.name\)/.test(read("app/portal/[token]/pay-over-time/page.js")));
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
