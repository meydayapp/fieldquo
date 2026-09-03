// scripts/check-feature-labels.mjs
//
//   npm run check:feature-labels
//
// The Ukrainian /pricing page, as the owner found it: four group headings in
// Ukrainian — "Виконати роботу", "Отримати оплату", "Керувати бізнесом" — and
// every feature under them in English. "Scheduling and dispatch". "Job
// costing". "Get paid by card".
//
// Half translated is worse than English throughout, and not by a small margin.
// A page that is entirely in English reads as software that has not been
// translated. A page where the headings speak Ukrainian and the list under them
// does not reads as software that is BROKEN, on the one page whose whole job is
// to be trusted with a card number.
//
// ══ Why it happened, and why the fix is a layer ════════════════════════════
//
// Headings come from app/i18n/messages.js through t(). Names came from
// lib/marketing/featureMatrix.js, an English data module — deliberately English,
// because that file's job is to say what EXISTS, carrying the file paths that
// prove each sentence, and check:translations has no business gating proof.
//
// lib/marketing/featureLabels.js is the seam: it turns a feature key into a
// name and summary in the reader's language, and falls back to the matrix's own
// English when a language has no entry. The matrix still says what is true; the
// catalogue says it in six languages; nothing was moved and nothing was
// translated in place.
//
// ══ What this file asserts, hardest first ══════════════════════════════════
//
//  1. THE RENDER. /pricing is executed through react-dom/server in every
//     language, and no English feature name may survive in the output. That is
//     the actual bug, and it is the only assertion that can see it. An agent
//     this session had seventy-five source assertions pass while the page
//     ignored the function they tested; a regex over source is not evidence.
//  2. Coverage: all 76 keys, both fields, all six languages.
//  3. The English block is character-identical to the matrix, so the duplicate
//     that check:translations forces cannot rot into a second wording.
//  4. Nothing is left as its English original by accident. Two entries legitimately
//     ARE the English word — see KEPT_AS_ENGLISH, which carries the reason and
//     fails if the exemption goes stale.
//  5. The fallback works, and a catalogue key with no matrix entry fails, so the
//     two lists cannot drift apart in either direction.
//
// Run: npm run check:feature-labels

import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { db } from "@/lib/db";
import { LANGUAGES, DEFAULT_LANGUAGE } from "@/app/i18n/languages";
import { MESSAGES } from "@/app/i18n/messages";
import { FEATURE_MATRIX, MATRIX_KEYS, matrixEntry } from "@/lib/marketing/featureMatrix";
import {
  FEATURE_GROUP_KEYS,
  FEATURE_LABEL_KEYS,
  FEATURE_LIMIT_KEYS,
  GROUP_LABEL_FIELDS,
  LABEL_FIELDS,
  LIMIT_KEYS,
  featureEntry,
  featureGroup,
  featureGroupKey,
  featureLabel,
  featureLabelKey,
} from "@/lib/marketing/featureLabels";
import { MATRIX_GROUPS } from "@/lib/marketing/featureMatrix";
import { SEAT_LADDER, SUPPORTED_CURRENCIES } from "@/lib/pricing/ladder";
import { LanguageProvider } from "@/app/providers/LanguageProvider";
import PricingPage from "@/app/(marketing)/pricing/page";

let pass = 0;
const fails = [];
const ok = (label, cond, detail) =>
  cond
    ? (pass++, console.log(`  ✓ ${label}`))
    : fails.push(`${label}${detail !== undefined ? ` — got ${detail}` : ""}`);

const OTHER = LANGUAGES.map((l) => l.code).filter((c) => c !== DEFAULT_LANGUAGE);

// A missing string is assertion 1's finding, and only assertion 1's. Reading it
// as "" everywhere else means a deleted key is REPORTED by name rather than
// crashing the run on .trim() of undefined — a check that dies is a check whose
// output nobody can act on.
const said_ = (language, key, field) =>
  String(MESSAGES[language]?.[featureLabelKey(key, field)] ?? "");

/* ═══════════════════════════════════════════════════════════════════════════
   The two entries that ARE the English word, and how they were told apart
   from an untranslated line.

   The discriminator is the WHOLE STRING, not the words in it. A loanword is a
   token inside a sentence that is otherwise this language — Tagalog "Inbox ng
   crew" keeps two English nouns and is unmistakably Tagalog; Punjabi writes its
   loanwords in Gurmukhi ("ਜੌਬ ਕੌਸਟਿੰਗ"), so they cannot be confused with an
   English line at all. An untranslated line is one where the entire string is
   still byte-for-byte the English original, which is what a forgotten key looks
   like and what a copied one looks like.

   That leaves the honest edge: a one-word name whose Tagalog IS the English
   word. "Dashboard" and "Payroll" are what a Filipino contractor says out loud;
   the shipped catalogue already writes "job costing" and "payroll" in Tagalog
   sentences. Inventing "Dashboard ng negosyo" to clear an assertion would be
   writing worse Tagalog to satisfy a test. So they are exempted here, by name,
   with the reason — and the exemption is itself asserted to still be identical,
   so it cannot quietly outlive the string it was written for.
   ═══════════════════════════════════════════════════════════════════════════ */
const KEPT_AS_ENGLISH = [
  {
    language: "de",
    key: "dashboard",
    field: "name",
    reason:
      "The German app already ships app.dash.title = 'Dashboard'. German " +
      "business software uses the loanword, and translating it here would make " +
      "the marketing page name a screen the product does not call that. Its " +
      "summary beside it is German throughout, so this is not a forgotten key.",
  },
  {
    language: "it",
    key: "dashboard",
    field: "name",
    reason:
      "Italian has a real alternative — 'cruscotto' — which is why this one is " +
      "argued rather than assumed. The Italian app ships app.dash.title = " +
      "'Dashboard', so translating only the marketing label would leave the " +
      "page pointing at a screen by a name the screen does not use. Consistency " +
      "with the shipped product wins; revisit both together if the app moves.",
  },
  {
    language: "tl",
    key: "dashboard",
    field: "name",
    reason:
      "Filipino tradespeople say 'dashboard'. The shipped catalogue already " +
      "uses it ('Pumunta sa dashboard'), and the summary beside it is fully " +
      "Tagalog, so the line cannot be a forgotten key.",
  },
  {
    language: "tl",
    key: "payroll",
    field: "name",
    reason:
      "Same argument: 'payroll' is the word, and app/i18n/messages.js already " +
      "ships 'Team at Payroll' in Tagalog. Its summary is Tagalog throughout.",
  },
];
const exempt = (language, key, field) =>
  KEPT_AS_ENGLISH.some((x) => x.language === language && x.key === key && x.field === field);

console.log("\n1. Every key, both fields, every language");
ok(`the matrix has entries to translate (${MATRIX_KEYS.length})`, MATRIX_KEYS.length > 0);
ok(
  `the layer names two keys per feature (${FEATURE_LABEL_KEYS.length})`,
  FEATURE_LABEL_KEYS.length === MATRIX_KEYS.length * LABEL_FIELDS.length,
  FEATURE_LABEL_KEYS.length,
);
for (const language of LANGUAGES.map((l) => l.code)) {
  const dict = MESSAGES[language] || {};
  const missing = FEATURE_LABEL_KEYS.filter((k) => typeof dict[k] !== "string" || !dict[k].trim());
  ok(
    `${language}: all ${FEATURE_LABEL_KEYS.length} strings present`,
    missing.length === 0,
    missing.slice(0, 6).join(" "),
  );
}

console.log("\n2. English is the matrix, not a second opinion of it");
// The English block exists only because check:translations compares every
// language against the KEYS OF ENGLISH — a key in Ukrainian and not in English
// is reported as "not in English" and fails the run. A duplicate that is
// allowed to drift is worse than no duplicate: /pricing would say one thing and
// /features/<slug> another, and neither would be the proved sentence.
{
  const drifted = [];
  for (const entry of FEATURE_MATRIX) {
    for (const field of LABEL_FIELDS) {
      if (MESSAGES.en[featureLabelKey(entry.key, field)] !== entry[field]) {
        drifted.push(`${entry.key}.${field}`);
      }
    }
  }
  ok("every English string is character-identical to the matrix", drifted.length === 0,
    drifted.slice(0, 6).join(" "));
}

console.log("\n3. Nothing was left in English by accident");
{
  const untranslated = [];
  for (const language of OTHER) {
    for (const entry of FEATURE_MATRIX) {
      for (const field of LABEL_FIELDS) {
        const said = said_(language, entry.key, field);
        if (said.trim() === entry[field].trim() && !exempt(language, entry.key, field)) {
          untranslated.push(`${language}/${entry.key}.${field}`);
        }
      }
    }
  }
  ok("no line is still its English original", untranslated.length === 0,
    untranslated.slice(0, 8).join(" "));
}
// A stale exemption is a hole with a comment on it. If somebody translates
// "Payroll" into Tagalog properly, this fails until the entry above is deleted.
for (const x of KEPT_AS_ENGLISH) {
  const said = said_(x.language, x.key, x.field);
  ok(`the ${x.language}/${x.key} exemption is still the case`,
    said.trim() === matrixEntry(x.key)[x.field].trim(), said);
  ok(`...and says why in more than a word`, x.reason.trim().length >= 40);
}
ok("the exemption list is short enough to read", KEPT_AS_ENGLISH.length <= 6,
  KEPT_AS_ENGLISH.length);
// The exempted lines are single names. A whole SUMMARY left in English would be
// an untranslated paragraph wearing the loanword argument, so no exemption may
// cover one.
ok("no exemption covers a summary", KEPT_AS_ENGLISH.every((x) => x.field === "name"));

console.log("\n4. The scripts that cannot be faked");
// Ukrainian and Punjabi do not share an alphabet with English, so "is this line
// translated" is answerable without judgement: the string must carry its own
// script. This is the cheap, total version of assertion 3 for two of the five
// languages — an English line copied into the Ukrainian block fails here even
// if somebody edited one word so it no longer matches the original exactly.
const SCRIPTS = {
  uk: { name: "Cyrillic", re: /[Ѐ-ӿ]/ },
  pa: { name: "Gurmukhi", re: /[਀-੿]/ },
};
for (const [language, script] of Object.entries(SCRIPTS)) {
  const wrong = [];
  for (const entry of FEATURE_MATRIX) {
    for (const field of LABEL_FIELDS) {
      if (!script.re.test(said_(language, entry.key, field))) {
        wrong.push(`${entry.key}.${field}`);
      }
    }
  }
  ok(`${language}: every string is written in ${script.name}`, wrong.length === 0,
    wrong.slice(0, 6).join(" "));
}
// The Latin that IS allowed in those two blocks: product and brand names, and
// the file format. Anything else is an English fragment that survived.
// "Meta" and "Ads" together are the product's own proper name (Meta Ads),
// same treatment as "Instagram" — kept in Latin script rather than invented
// as a transliteration nobody searches for.
{
  const ALLOWED = ["FieldQuo", "AI", "PDF", "Instagram", "Meta", "Ads"];
  const strays = [];
  for (const language of Object.keys(SCRIPTS)) {
    for (const key of FEATURE_LABEL_KEYS) {
      for (const run of String(MESSAGES[language][key] ?? "").match(/[A-Za-z][A-Za-z'-]*/g) || []) {
        if (!ALLOWED.includes(run)) strays.push(`${language}/${key}: ${run}`);
      }
    }
  }
  ok("...and the only Latin left in them is a brand name", strays.length === 0,
    strays.slice(0, 8).join(" "));
}

console.log("\n5. The layer resolves, falls back, and refuses");
{
  // The fallback, exercised rather than described: a t() that resolves nothing
  // — which is what the real one does for a language with no entry — must hand
  // back the matrix's proved English, never the raw key.
  const nothingResolves = (key, fallback) => fallback;
  const e = featureEntry("job_costing", nothingResolves);
  ok("a language with no entry gets the matrix's English",
    e.name === matrixEntry("job_costing").name &&
      e.summary === matrixEntry("job_costing").summary, e.name);
  ok("...never the catalogue key itself", !/^feature\./.test(e.name));

  // And with a t() that DOES resolve, the catalogue wins.
  const uk = (key) => MESSAGES.uk[key];
  ok("a language with an entry gets the entry",
    featureEntry("job_costing", uk).name === MESSAGES.uk["feature.job_costing.name"]);

  // No t at all — the server pages. Same strings as before the layer existed.
  ok("no translator at all is the matrix, unchanged",
    featureEntry("job_costing").name === matrixEntry("job_costing").name);

  // The rest of the entry survives the merge. /pricing and /compare read
  // readiness and limits off the same object; losing them would turn a partial
  // feature into a bare tick, which is the dead control AGENTS.md forbids.
  const partial = featureEntry("door_hanger_routes", uk);
  ok("the merged entry keeps readiness and limits",
    partial.readiness === "partial" && typeof partial.limits === "string" && partial.proof.length > 0);

  ok("an unknown key is refused, not improvised", featureEntry("no_such_feature", uk) === undefined);
  ok("...and featureLabel refuses it too", featureLabel("no_such_feature") === undefined);
  ok("featureLabel is the same resolution, not a second one",
    featureLabel("job_costing", uk).name === featureEntry("job_costing", uk).name);
}

console.log("\n6. The catalogue and the matrix cannot drift apart");
// Both directions. A matrix key with no catalogue entry is assertion 1. This is
// the other one: a `feature.*` key in the catalogue that names nothing the
// product ships is a sentence on a public page with no proof behind it, which
// is the whole reason featureMatrix.js exists.
{
  const orphans = [];
  for (const language of LANGUAGES.map((l) => l.code)) {
    for (const key of Object.keys(MESSAGES[language])) {
      const m = /^feature\.([a-z0-9_]+)\.(name|summary|limits)$/.exec(key);
      if (!m) continue;
      if (!MATRIX_KEYS.includes(m[1])) orphans.push(`${language}/${key}`);
      // A `limits` key for a feature that stops nowhere is a caveat with no
      // claim behind it — an invented hedge, which is the mirror of an
      // invented feature and just as wrong on a page selling honesty.
      if (m[2] === "limits" && !LIMIT_KEYS.includes(m[1])) orphans.push(`${language}/${key}`);
    }
  }
  ok("no catalogue key names a feature the matrix does not carry", orphans.length === 0,
    orphans.slice(0, 6).join(" "));
  // The shape of the key is decided in one place. A call site that typed
  // `feature.leads.name` by hand would work today and rot silently.
  ok("the key shape comes from featureLabelKey()",
    featureLabelKey("leads", "name") === "feature.leads.name");
  ok("...and the renderers import the layer rather than reaching past it",
    ["app/(marketing)/pricing/PricingPlans.js",
     "app/(marketing)/compare/[slug]/ComparisonPage.js",
     "app/(marketing)/compare/AddOnStack.js"].every((p) =>
      /from "@\/lib\/marketing\/featureLabels"/.test(readFileSync(p, "utf8"))));
}

/* ═══════════════════════════════════════════════════════════════════════════
   7. THE RENDER — the assertion the bug report is about.

   Everything above is about strings in a file. None of it can see the failure
   the owner actually saw, which was on a page: the catalogue could be perfect
   and /pricing could still print English, because the renderer decides which
   of the two sources it reads. So the real page is executed, in every language,
   and the output is searched for English that should not be there.

   The page is a server component that reads db.plan; the fixture is built from
   SEAT_LADDER the same way scripts/check-pricing-page.mjs builds it, so a
   repriced rung does not need remembering here. Importing lib/db builds a pg
   Pool that never connects — no query leaves this process.
   ═══════════════════════════════════════════════════════════════════════════ */
console.log("\n7. The page itself, rendered in all six languages");

let planRows = SUPPORTED_CURRENCIES.flatMap((currency) =>
  SEAT_LADDER.map((tier) => ({
    id: `${tier.tierKey}-${currency.toLowerCase()}`,
    name: tier.label,
    priceMonthly: tier.price,
    currency,
    tierKey: tier.tierKey,
    seats: tier.seats,
    crewSeats: tier.crewSeats,
    maxUsers: tier.seats + tier.crewSeats,
    sortOrder: tier.sortOrder,
    maxQuotesPerMonth: null,
    aiCopilotEnabled: true,
    isPublic: true,
    features: null,
  })),
);
db.plan = { findMany: async () => planRows };

const renderIn = async (language) =>
  renderToStaticMarkup(
    createElement(LanguageProvider, { initialLanguage: language }, await PricingPage()),
  );

const textOf = (html) =>
  html
    .replace(/<[^>]*>/g, " ")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#x2F;/g, "/")
    .replace(/\s+/g, " ");

const rendered = new Map();
for (const { code } of LANGUAGES) rendered.set(code, textOf(await renderIn(code)));

// Which features the page actually prints, taken from the page rather than
// listed here — the grid's key list is edited often and a hand-copy of it would
// be checking a page that no longer exists.
const plansSrc = readFileSync("app/(marketing)/pricing/PricingPlans.js", "utf8");
const printedKeys = [...new Set([...plansSrc.matchAll(/^\s{6}"([a-z_]+)",$/gm)].map((m) => m[1]))]
  .filter((k) => MATRIX_KEYS.includes(k));
// Plus the counterpart features in the add-on block, which are chosen by data
// and rendered through the same layer.
const counterpartKeys = [
  ...new Set(
    [...(await renderIn("en")).matchAll(/data-addon-counterpart="([^"]+)"/g)].map((m) => m[1]),
  ),
].filter((k) => MATRIX_KEYS.includes(k));

ok(`the page prints features at all (${printedKeys.length} in the grid)`, printedKeys.length >= 24,
  printedKeys.length);
ok(`...and counterparts in the add-on block (${counterpartKeys.length})`, counterpartKeys.length > 0);

const onPage = [...new Set([...printedKeys, ...counterpartKeys])];

// English first, as the control: the page must still say exactly what the
// matrix proved. If this fails, the layer has invented copy rather than
// translated it, and every other assertion here is measuring the wrong thing.
{
  const missing = onPage.filter((k) => !rendered.get("en").includes(matrixEntry(k).name));
  ok("English still prints the matrix's own names", missing.length === 0, missing.join(" "));
}

for (const language of OTHER) {
  const text = rendered.get(language);

  // (a) The translation is on the page. Not "the catalogue has one" — this is
  //     the half the source assertions cannot reach.
  {
    const absent = onPage.filter(
      (k) => !text.includes(said_(language, k, "name")),
    );
    ok(`${language}: every feature on the page is named in ${language}`, absent.length === 0,
      absent.join(" "));
  }

  // (b) And the English is gone. This is the reported bug, stated as an
  //     assertion. Exemptions are the loanword names from KEPT_AS_ENGLISH, and
  //     nothing else — a name that is exempted still has to be the entry the
  //     catalogue holds, which (a) already proved.
  {
    const survived = onPage.filter((k) => {
      if (exempt(language, k, "name")) return false;
      return text.includes(matrixEntry(k).name);
    });
    ok(`${language}: NO English feature name survives on the page`, survived.length === 0,
      survived.join(" "));
  }

  // (c) The summaries too, in the add-on block, where they are printed in full.
  {
    const survived = counterpartKeys.filter((k) => text.includes(matrixEntry(k).summary));
    ok(`${language}: no English feature sentence survives either`, survived.length === 0,
      survived.join(" "));
  }

  // (d) The bug was a MIXTURE, so the headings are checked beside the bullets.
  //     A page that translated the features and dropped the headings would be
  //     the same defect facing the other way.
  ok(`${language}: the group headings speak ${language} too`,
    ["pricing.group.winning", "pricing.group.doing", "pricing.group.paid", "pricing.group.running"]
      .every((k) => text.includes(MESSAGES[language][k])));
}


/* ═══════════════════════════════════════════════════════════════════════════
   8. THE CAVEATS, AND THE HEADINGS OVER THEM

   The gap this file's own header used to name and leave open:

     "`limits` is NOT translated here. That is a real gap and it is named
      rather than hidden: eight entries carry one, and one of them
      (door_hanger_routes) renders on /pricing, so a Ukrainian visitor sees one
      English caveat under an otherwise Ukrainian block."

   Eight sentences, and they are the eight on this site where a loose paraphrase
   does the most damage — every one of them is the reason a page is not a lie.
   "FieldQuo does not lend and does not approve anyone" is what keeps the
   financing page legal to publish. So they are held to a HARDER bar than the
   names above, not an equal one: present, in script, pinned to the matrix in
   English, never the English original, and — the part that matters — actually
   printed on /pricing in place of the English.
   ═══════════════════════════════════════════════════════════════════════════ */
console.log("\n8. Where a partly-built thing stops, said in six languages");

ok(`the matrix carries caveats to translate (${LIMIT_KEYS.length})`, LIMIT_KEYS.length >= 8,
  LIMIT_KEYS.length);
ok("...and only for features that are partly built",
  LIMIT_KEYS.every((k) => matrixEntry(k).readiness === "partial"),
  LIMIT_KEYS.filter((k) => matrixEntry(k).readiness !== "partial").join(" "));
ok("...one key each, no more",
  FEATURE_LIMIT_KEYS.length === LIMIT_KEYS.length &&
    new Set(FEATURE_LIMIT_KEYS).size === FEATURE_LIMIT_KEYS.length);
// The list is derived, not typed. A ninth entry gaining a limit must fail the
// coverage below until somebody writes the six sentences — the alternative is a
// caveat shipping in English while nothing notices.
ok("...and every partial with a limit is on it",
  MATRIX_KEYS.filter((k) => matrixEntry(k).limits?.trim()).every((k) => LIMIT_KEYS.includes(k)));

for (const language of LANGUAGES.map((l) => l.code)) {
  const dict = MESSAGES[language] || {};
  const missing = FEATURE_LIMIT_KEYS.filter(
    (k) => typeof dict[k] !== "string" || !dict[k].trim(),
  );
  ok(`${language}: all ${FEATURE_LIMIT_KEYS.length} caveats present`, missing.length === 0,
    missing.join(" "));
}
{
  const drifted = LIMIT_KEYS.filter(
    (k) => MESSAGES.en[featureLabelKey(k, "limits")] !== matrixEntry(k).limits,
  );
  ok("every English caveat is character-identical to the matrix", drifted.length === 0,
    drifted.join(" "));
}
{
  const untranslated = [];
  for (const language of OTHER) {
    for (const key of LIMIT_KEYS) {
      if (said_(language, key, "limits").trim() === matrixEntry(key).limits.trim()) {
        untranslated.push(`${language}/${key}`);
      }
    }
  }
  // No exemption list here on purpose. A caveat is a paragraph, never a
  // one-word loanword, so the KEPT_AS_ENGLISH argument cannot reach it.
  ok("no caveat is still its English original", untranslated.length === 0,
    untranslated.join(" "));
}
for (const [language, script] of Object.entries(SCRIPTS)) {
  const wrong = LIMIT_KEYS.filter((k) => !script.re.test(said_(language, k, "limits")));
  ok(`${language}: every caveat is written in ${script.name}`, wrong.length === 0,
    wrong.join(" "));
}
// A caveat is a NARROWING. One that has come back much shorter than the English
// has almost certainly dropped a clause, and a dropped clause in a hedge is a
// promise we did not make. Not a translation check — a length sanity check, and
// deliberately loose, because Ukrainian and Punjabi are compact and a real
// translation can legitimately be two-thirds the length.
{
  const short = [];
  for (const language of OTHER) {
    for (const key of LIMIT_KEYS) {
      const en = matrixEntry(key).limits.trim();
      const said = said_(language, key, "limits").trim();
      if (said.length < en.length * 0.45) short.push(`${language}/${key}`);
    }
  }
  ok("no caveat came back short enough to have lost a clause", short.length === 0,
    short.join(" "));
}
// Sentence count is the structural half of the same argument: "FieldQuo does
// not lend and does not approve anyone" is one of three sentences in the
// financing caveat, and a translation that returned two has dropped one.
{
  const sentences = (x) => x.split(/[.。।!?]\s+|[.。।!?]$/).filter((y) => y.trim()).length;
  const lost = [];
  for (const language of OTHER) {
    for (const key of LIMIT_KEYS) {
      const want = sentences(matrixEntry(key).limits);
      const got = sentences(said_(language, key, "limits"));
      if (got < want) lost.push(`${language}/${key} (${got} of ${want})`);
    }
  }
  ok("no caveat lost a sentence in translation", lost.length === 0, lost.slice(0, 8).join(" "));
}
{
  const uk = (key, fallback) => MESSAGES.uk[key] ?? fallback;
  const e = featureEntry("financing", uk);
  ok("featureEntry resolves the caveat", e.limits === MESSAGES.uk["feature.financing.limits"]);
  ok("...and it is not the English one", e.limits !== matrixEntry("financing").limits);
  // 68 of the 76 have no limit. Resolving one anyway would print
  // "Where this stops: feature.quotes.limits" under a feature that stops
  // nowhere — a key rendered to a customer, which is the failure t()'s fallback
  // chain exists to prevent.
  // Exercised with a t() that behaves the way the real one does on a miss —
  // fallback, then the key — because a double that returns the fallback would
  // pass with the guard removed. 68 of the 76 entries carry `limits: null`, and
  // resolving one anyway prints "Where it stops: feature.quotes.limits".
  const keyish = (key, fallback) => MESSAGES.uk[key] ?? fallback ?? key;
  ok("a feature with no caveat gains no empty one",
    featureEntry("quotes", keyish).limits === matrixEntry("quotes").limits &&
      !featureEntry("quotes", keyish).limits,
    String(featureEntry("quotes", keyish).limits));
  ok("...and with no translator the caveat is the matrix's own",
    featureEntry("financing").limits === matrixEntry("financing").limits);
  const nothingResolves = (key, fallback) => fallback;
  ok("...and a language with no entry gets the matrix's English caveat",
    featureEntry("financing", nothingResolves).limits === matrixEntry("financing").limits);
}

console.log("\n9. The four group headings the site is organised by");

ok(`the layer names two keys per group (${FEATURE_GROUP_KEYS.length})`,
  FEATURE_GROUP_KEYS.length === MATRIX_GROUPS.length * GROUP_LABEL_FIELDS.length);
for (const language of LANGUAGES.map((l) => l.code)) {
  const dict = MESSAGES[language] || {};
  const missing = FEATURE_GROUP_KEYS.filter(
    (k) => typeof dict[k] !== "string" || !dict[k].trim(),
  );
  ok(`${language}: all ${FEATURE_GROUP_KEYS.length} group strings present`, missing.length === 0,
    missing.join(" "));
}
{
  const drifted = [];
  for (const g of MATRIX_GROUPS) {
    for (const field of GROUP_LABEL_FIELDS) {
      if (MESSAGES.en[featureGroupKey(g.key, field)] !== g[field]) drifted.push(`${g.key}.${field}`);
    }
  }
  ok("every English group string is character-identical to the matrix", drifted.length === 0,
    drifted.join(" "));
}
{
  const untranslated = [];
  for (const language of OTHER) {
    for (const g of MATRIX_GROUPS) {
      for (const field of GROUP_LABEL_FIELDS) {
        if (String(MESSAGES[language]?.[featureGroupKey(g.key, field)] ?? "").trim() ===
            g[field].trim()) {
          untranslated.push(`${language}/${g.key}.${field}`);
        }
      }
    }
  }
  ok("no group string is still its English original", untranslated.length === 0,
    untranslated.join(" "));
}
{
  const orphans = [];
  for (const language of LANGUAGES.map((l) => l.code)) {
    for (const key of Object.keys(MESSAGES[language])) {
      const m = /^featureGroup\.([a-z0-9_]+)\.(label|blurb)$/.exec(key);
      if (m && !MATRIX_GROUPS.some((g) => g.key === m[1])) orphans.push(`${language}/${key}`);
    }
  }
  ok("no catalogue key names a group the matrix does not carry", orphans.length === 0,
    orphans.join(" "));
}
{
  const uk = (key, fallback) => MESSAGES.uk[key] ?? fallback;
  ok("featureGroup resolves through the catalogue",
    featureGroup("winning_work", uk).label === MESSAGES.uk["featureGroup.winning_work.label"]);
  ok("...no translator is the matrix's own", featureGroup("winning_work").label === MATRIX_GROUPS[0].label);
  const nothingResolves = (key, fallback) => fallback;
  ok("...a language with no entry gets the matrix's English",
    featureGroup("getting_paid", nothingResolves).blurb ===
      MATRIX_GROUPS.find((g) => g.key === "getting_paid").blurb);
  ok("an unknown group is refused, not improvised", featureGroup("no_such_group", uk) === undefined);
  ok("the key shape comes from featureGroupKey()",
    featureGroupKey("winning_work", "label") === "featureGroup.winning_work.label");
}

/* ═══════════════════════════════════════════════════════════════════════════
   10. THE CAVEAT ON THE PAGE — /pricing, rendered, in five languages

   Section 8 proves the catalogue holds six phrasings. This proves the page
   prints them, which is the only thing the Ukrainian visitor in the header
   actually experiences. The add-on block on /pricing is where a limit surfaces
   there, and it marks each one with data-addon-limits so the rendered set is
   read off the page rather than guessed at here.
   ═══════════════════════════════════════════════════════════════════════════ */
console.log("\n10. The caveats as /pricing actually prints them");

// Same whitespace normalisation as scripts/check-feature-pages.mjs, and for the
// same reason: textOf() collapses whitespace in the markup, and French
// legitimately writes U+00A0 before a colon.
const flat_ = (x) => String(x).replace(/\s+/g, " ").trim();

const limitKeysOnPage = [
  ...new Set([...(await renderIn("en")).matchAll(/data-addon-limits="([^"]+)"/g)].map((m) => m[1])),
].filter((k) => LIMIT_KEYS.includes(k));

ok(`/pricing prints a caveat at all (${limitKeysOnPage.length})`, limitKeysOnPage.length > 0);
{
  const missing = limitKeysOnPage.filter((k) => !rendered.get("en").includes(flat_(matrixEntry(k).limits)));
  ok("English still prints the matrix's own caveat", missing.length === 0, missing.join(" "));
}
for (const language of OTHER) {
  const text = rendered.get(language);
  const absent = limitKeysOnPage.filter((k) => !text.includes(flat_(said_(language, k, "limits"))));
  ok(`${language}: the caveat on /pricing is written in ${language}`, absent.length === 0,
    absent.join(" "));
  const survived = limitKeysOnPage.filter((k) => text.includes(flat_(matrixEntry(k).limits)));
  ok(`${language}: NO English caveat survives on /pricing`, survived.length === 0,
    survived.join(" "));
}

console.log(
  fails.length
    ? `\nFAILED — ${fails.length} of ${pass + fails.length}\n${fails.map((f) => `  ✗ ${f}`).join("\n")}`
    : `\nPASSED — ${pass}/${pass} assertions across ${MATRIX_KEYS.length} features ` +
      `× ${LANGUAGES.length} languages (${FEATURE_LABEL_KEYS.length * LANGUAGES.length} strings)`,
);
process.exit(fails.length ? 1 : 0);
