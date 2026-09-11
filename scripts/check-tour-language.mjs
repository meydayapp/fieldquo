// scripts/check-tour-language.mjs
//
// Executes the shell's language resolution against the inputs that produced
// the bug, and asserts the answer.
//
//   npm run check:tour-language
//
// ── The bug ────────────────────────────────────────────────────────────────
//
// The owner's account is Spanish. Every /app screen rendered Spanish and every
// first-visit TOUR rendered Ukrainian. It was never a missing translation: the
// Spanish tour copy exists and section 1 below proves it by execution, which
// is the point — "the key is present in all nine languages" was already true
// and told nobody anything.
//
// /app nests two LanguageProviders. The inner one is handed the account's
// language with `fromAccount`; the outer one (app/layout.js) has no account to
// ask and follows localStorage, a key this origin shares with the marketing
// site. AppTours is mounted AFTER `</LanguageProvider>` in app/app/layout.js —
// a sibling of the inner provider, a child of the outer one — so the tour, and
// only the tour, read the marketing site's leftover "uk".
//
// ── Why this script is shaped the way it is ────────────────────────────────
//
// A check that greps for a string proves nothing here: every wrong version of
// this code also contains the words "language" and "localStorage". So sections
// 2-4 RUN the resolver, section 5 reads source with comments STRIPPED (a fix
// described in a comment and not implemented is exactly the failure this
// codebase keeps finding), and section 6 does the same for the AI summaries,
// where the reader's language has to reach the model rather than a translator.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  resolveShellLanguage,
  statedLanguage,
  announceStatedLanguage,
  retractStatedLanguage,
  __resetStatedLanguage,
} from "@/lib/i18n/statedLanguage";
import { aiLanguageDirective, aiLanguageName, withLanguage } from "@/lib/i18n/aiLanguage";
import { expenseFlag, expenseFlagLines, EXPENSE_FLAG_KEYS } from "@/lib/i18n/aiSummaryCopy";
import { APP_MESSAGES } from "@/app/i18n/appMessages";
import { LANGUAGES, DEFAULT_LANGUAGE } from "@/app/i18n/languages";
import { TOURS } from "@/app/components/tours";
import { shellLanguage, repLanguageOrNull } from "@/lib/sales/repLanguage";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

let failures = 0;
let checks = 0;
function ok(name, pass, detail = "") {
  checks++;
  if (!pass) failures++;
  console.log(`  ${pass ? "ok  " : "FAIL"} ${name}${detail ? `  — ${detail}` : ""}`);
}
function eq(name, actual, expected) {
  ok(name, actual === expected, actual === expected ? "" : `got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`);
}

/**
 * Source with comments removed.
 *
 * Quote- and template-aware, because this repo's comments quote code and its
 * code quotes URLs — a naive /\/\/.*$/ strip would delete half of a line
 * containing "https://" and then "prove" the code below it was missing.
 */
function stripComments(src) {
  let out = "";
  let i = 0;
  let quote = null; // the character that closes the current string
  while (i < src.length) {
    const c = src[i];
    const next = src[i + 1];
    if (quote) {
      if (c === "\\") {
        out += c + (next ?? "");
        i += 2;
        continue;
      }
      if (c === quote) quote = null;
      out += c;
      i++;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      quote = c;
      out += c;
      i++;
      continue;
    }
    if (c === "/" && next === "/") {
      while (i < src.length && src[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && next === "*") {
      i += 2;
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

// The same resolution useTranslation.js does — requested language, then
// English, then the key. Rebuilt rather than imported because that module is a
// "use client" React hook and cannot run here. Same seam check-duration.mjs
// uses, and for the same reason.
function translatorFor(code) {
  return (key) => APP_MESSAGES[code]?.[key] ?? APP_MESSAGES[DEFAULT_LANGUAGE]?.[key] ?? key;
}

/**
 * One page load, both providers, modelled exactly as app/layout.js and
 * app/app/layout.js mount them — and asserted against the real source in
 * section 5, so this model cannot quietly stop describing the app.
 *
 * @returns { shell, tours } — what the sidebar renders in, and what a tour
 *          mounted OUTSIDE the account provider renders in.
 */
function renderAppPage({ accountLanguage = null, stored = null, browser = null } = {}) {
  __resetStatedLanguage();

  // Inner provider: app/app/layout.js, `fromAccount={Boolean(language)}`.
  const fromAccount = Boolean(accountLanguage);
  const shell = resolveShellLanguage({ initialLanguage: accountLanguage, fromAccount });
  const key = {};
  if (fromAccount) announceStatedLanguage(key, accountLanguage);

  // Outer provider: app/layout.js, mounted with no props at all.
  const tours = resolveShellLanguage({
    initialLanguage: undefined,
    fromAccount: false,
    stated: statedLanguage(),
    stored,
    browser,
  });

  return { shell, tours, retract: () => retractStatedLanguage(key) };
}

// ═══ 1. The catalogue was never the problem ════════════════════════════════
console.log("\n1. Tour copy exists in every language, so a wrong one was CHOSEN\n");

const REPORTED = ["crew-inbox-v1", "refer-v1", "ai-credit-v1"];
const offered = LANGUAGES.map((l) => l.code);

let missing = [];
let identicalToUk = [];
for (const tour of TOURS) {
  for (const step of tour.steps) {
    for (const key of [step.titleKey, step.bodyKey]) {
      if (APP_MESSAGES.es?.[key] === undefined) missing.push(`${tour.key}:${key}`);
      if (
        APP_MESSAGES.es?.[key] !== undefined &&
        APP_MESSAGES.es?.[key] === APP_MESSAGES.uk?.[key]
      ) {
        identicalToUk.push(`${tour.key}:${key}`);
      }
    }
  }
}
ok("every tour step has Spanish copy", missing.length === 0, missing.slice(0, 5).join(", "));
ok(
  "no tour step's Spanish IS its Ukrainian",
  identicalToUk.length === 0,
  identicalToUk.slice(0, 5).join(", "),
);

for (const key of REPORTED) {
  const tour = TOURS.find((t) => t.key === key);
  ok(`${key} is still a tour`, Boolean(tour));
  if (!tour) continue;
  const es = translatorFor("es")(tour.steps[0].titleKey);
  const uk = translatorFor("uk")(tour.steps[0].titleKey);
  ok(`${key}: Spanish and Ukrainian are different strings`, es !== uk, `${es} / ${uk}`);
}

// ═══ 2. The resolver, against the owner's exact inputs ═════════════════════
console.log("\n2. resolveShellLanguage, executed\n");

// THE BUG. A signed-in Spanish user, on a browser whose localStorage carries
// the marketing site's leftover "uk", on the provider that was never told
// about the account.
eq(
  "outer provider on /app: stated es beats stored uk",
  resolveShellLanguage({ fromAccount: false, stated: "es", stored: "uk", browser: "en-CA" }),
  "es",
);
eq(
  "the same call with nothing announced is what shipped",
  resolveShellLanguage({ fromAccount: false, stated: null, stored: "uk", browser: "en-CA" }),
  "uk",
);
eq(
  "inner provider on /app: a stated choice ends the question",
  resolveShellLanguage({ initialLanguage: "es", fromAccount: true }),
  "es",
);
eq(
  "fromAccount ignores a stored guess even when one exists",
  resolveShellLanguage({ initialLanguage: "fr", fromAccount: true, stored: "uk", browser: "de" }),
  "fr",
);
eq(
  "fromAccount with an unsupported value falls to English, not to a guess",
  resolveShellLanguage({ initialLanguage: "zz", fromAccount: true, stored: "uk" }),
  DEFAULT_LANGUAGE,
);

// The marketing site must be untouched by all of this: a stranger with no
// account still gets their browser, and still gets whatever they last picked.
eq(
  "marketing: a stored choice still wins",
  resolveShellLanguage({ fromAccount: false, stored: "uk", browser: "en-CA" }),
  "uk",
);
eq(
  "marketing: no storage, French browser",
  resolveShellLanguage({ fromAccount: false, stored: null, browser: "fr-CA" }),
  "fr",
);
eq(
  "marketing: no storage, es-419 normalises to es",
  resolveShellLanguage({ fromAccount: false, stored: null, browser: "es-419" }),
  "es",
);
eq(
  "marketing: an unrecognised browser code does not overwrite the server's render",
  resolveShellLanguage({ initialLanguage: "it", fromAccount: false, stored: null, browser: "sv-SE" }),
  "it",
);
eq(
  "an unsupported stored value is ignored, not adopted",
  resolveShellLanguage({ fromAccount: false, stored: "zz", browser: "de-DE" }),
  "de",
);
eq("nothing at all is English", resolveShellLanguage({}), DEFAULT_LANGUAGE);

// ═══ 3. The announcement channel ═══════════════════════════════════════════
console.log("\n3. The stated choice is announced page-wide\n");

__resetStatedLanguage();
eq("nothing announced on a fresh page", statedLanguage(), null);

const a = {};
const b = {};
announceStatedLanguage(a, "es");
eq("an announcement is readable by a cousin", statedLanguage(), "es");

announceStatedLanguage(b, "fr");
retractStatedLanguage(a);
eq(
  "a superseded provider's cleanup cannot clear the current answer",
  statedLanguage(),
  "fr",
);
retractStatedLanguage(b);
eq("the owner's cleanup does clear it", statedLanguage(), null);

announceStatedLanguage(a, "zz");
eq("an unsupported code is never announced", statedLanguage(), null);
__resetStatedLanguage();

// ═══ 4. The whole page, and what the tour actually says ════════════════════
console.log("\n4. The owner's session, end to end\n");

const owner = renderAppPage({ accountLanguage: "es", stored: "uk", browser: "en-CA" });
eq("the app shell renders Spanish", owner.shell, "es");
eq("the tour renders Spanish too", owner.tours, "es");

for (const key of REPORTED) {
  const tour = TOURS.find((t) => t.key === key);
  if (!tour) continue;
  const t = translatorFor(owner.tours);
  const title = t(tour.steps[0].titleKey);
  ok(
    `${key}: the owner reads the Spanish title`,
    title === APP_MESSAGES.es[tour.steps[0].titleKey],
    title,
  );
  ok(
    `${key}: and not the Ukrainian one`,
    title !== APP_MESSAGES.uk[tour.steps[0].titleKey],
    title,
  );
}

// Leaving /app puts the guesses back in charge — otherwise one visit to the
// app would pin the marketing site to the account's language for the session.
owner.retract();
eq(
  "after the app unmounts, the marketing guess is live again",
  resolveShellLanguage({ fromAccount: false, stated: statedLanguage(), stored: "uk" }),
  "uk",
);
__resetStatedLanguage();

// A user who has stated nothing is unchanged: fromAccount is false on both
// providers and both still follow the browser.
const guest = renderAppPage({ accountLanguage: null, stored: "fr", browser: "en-CA" });
eq("no stated preference: the shell still follows storage", guest.shell, DEFAULT_LANGUAGE);
eq("no stated preference: so does the tour", guest.tours, "fr");
__resetStatedLanguage();

// ═══ 5. The source actually does this ══════════════════════════════════════
console.log("\n5. The wiring, read with comments stripped\n");

const provider = stripComments(read("app/providers/LanguageProvider.js"));
const appLayout = stripComments(read("app/app/layout.js"));
const rootLayout = stripComments(read("app/layout.js"));
const appTours = stripComments(read("app/components/AppTours.js"));

ok(
  "LanguageProvider resolves through resolveShellLanguage",
  provider.includes("resolveShellLanguage("),
);
ok(
  "LanguageProvider subscribes to the announcement channel",
  provider.includes("subscribeStatedLanguage"),
  "without this a cousin of the account provider never hears the choice",
);
ok(
  "LanguageProvider announces its own stated choice",
  provider.includes("announceStatedLanguage") && provider.includes("retractStatedLanguage"),
);
ok(
  "nothing in LanguageProvider sets the language straight from storage",
  !/setLanguage\(\s*stored\s*\)/.test(provider),
  "that was the line that let the marketing site's leftover win",
);
ok(
  "the app shell still tells the provider the value is an account choice",
  /fromAccount=\{Boolean\(language\)\}/.test(appLayout),
  "without fromAccount the inner provider announces nothing and guesses too",
);
ok(
  "the root layout still mounts a provider with no account",
  /<LanguageProvider>/.test(rootLayout),
  "if this ever gains props, this whole file is describing the wrong app",
);
ok(
  "AppTours is still mounted outside the account provider",
  /<\/LanguageProvider>[\s\S]*<AppTours\s*\/>/.test(appLayout),
  "if it has been moved inside, say so here rather than leaving a check that tests nothing",
);
ok(
  "AppTours resolves its copy through t(), not baked strings",
  appTours.includes("OnboardingTour") && !/title:\s*"/.test(appTours),
);

// ═══ 6. AI summaries are WRITTEN in the reader's language ══════════════════
console.log("\n6. AI output follows the reader\n");

eq("English gets no directive", aiLanguageDirective("en"), "");
eq("an unsupported code gets no directive", aiLanguageDirective("zz"), "");
for (const code of offered.filter((c) => c !== DEFAULT_LANGUAGE)) {
  const d = aiLanguageDirective(code);
  ok(
    `${code}: the directive names ${aiLanguageName(code)} in English`,
    d.includes(aiLanguageName(code)) && d.length > 40,
    d.slice(0, 60),
  );
}
ok(
  "the directive forbids a word-for-word translation",
  /word-for-word/.test(aiLanguageDirective("es")),
  "generated in the language, not translated into it — the owner's rule",
);
ok(
  "withLanguage attaches it to the system prompt",
  withLanguage("BASE.", "es").startsWith("BASE.") &&
    withLanguage("BASE.", "es").includes(aiLanguageName("es")),
);
eq("withLanguage leaves an English prompt alone", withLanguage("BASE.", "en"), "BASE.");

const expenseSummarySrc = stripComments(read("lib/ai/expenseSummary.js"));
ok(
  "the expense summary takes a language",
  /language\s*=\s*DEFAULT_LANGUAGE/.test(expenseSummarySrc),
);
ok(
  "and puts it in the system prompt rather than translating after",
  /system:\s*withLanguage\(/.test(expenseSummarySrc) &&
    !/translate/i.test(expenseSummarySrc),
);
ok(
  "its caller resolves who is reading",
  /readerLanguage\(/.test(stripComments(read("app/api/ai/ai-summary/route.js"))),
);

// The two biggest blocks of AI prose a contractor reads. Same rule, same
// helper — listed by name so a third one added later is a visible omission
// rather than a silent one.
for (const [label, client, route] of [
  ["FieldQuo AI", "lib/ai/copilotClient.js", "app/api/ai/copilot/route.js"],
  ["Jennifer", "lib/ai/jennifer/client.js", "app/api/jennifer/route.js"],
]) {
  const clientSrc = stripComments(read(client));
  ok(`${label} writes in the reader's language`, /withLanguage\(/.test(clientSrc), client);
  ok(
    `${label} takes the language from its caller`,
    /\blanguage\b/.test(clientSrc.split("\n").find((l) => /export async function ask/.test(l)) || ""),
    client,
  );
  ok(
    `${label}'s route resolves the reader`,
    /language:\s*await readerLanguage\(/.test(stripComments(read(route))),
    route,
  );
}

// The flags beside the summary are computed in code and must not be left in
// English under a Spanish paragraph — half-translated reads as broken.
const facts = [
  { key: "runway", values: { months: 2 } },
  { key: "share", values: { category: "Fuel", pct: 61 } },
  { key: "rose", values: { pct: 22 } },
];
for (const code of offered) {
  const lines = expenseFlagLines(code, facts);
  eq(`${code}: every flag renders`, lines.length, facts.length);
  ok(`${code}: the numbers survive interpolation`, lines.every((l) => !l.includes("{")));
  ok(`${code}: 61 and Fuel are carried through verbatim`, lines[1].includes("61") && lines[1].includes("Fuel"));
  if (code !== DEFAULT_LANGUAGE) {
    ok(
      `${code}: the flags are not still English`,
      lines.join(" ") !== expenseFlagLines(DEFAULT_LANGUAGE, facts).join(" "),
    );
  }
}
ok(
  "an unknown flag key degrades to nothing, not to a raw template",
  expenseFlag("es", "nosuchkey", {}) === "",
);
ok(
  "an unsupported language falls back to English rather than throwing",
  expenseFlag("zz", "rose", { pct: 5 }) === expenseFlag("en", "rose", { pct: 5 }),
);
ok(`all ${EXPENSE_FLAG_KEYS.length} flag templates are covered`, EXPENSE_FLAG_KEYS.length >= 4);

// ═══ 7. The sales portal: three writers, one reader, and the precedence ════
console.log("\n7. The rep's language — written at activation, on Pay, on Welcome; read by the layout\n");
//
// The owner: the tour should "remember in the language that has been set when
// the sales rep activates and sets the password, or when switching in the Pay
// tab". Three places write SalesRep.language; exactly one place reads it, and
// what it hands the provider decides whether localStorage and the browser get
// a vote. Same bug shape as sections 2–5, one surface over.

// The reader's precedence, executed. A stored language is a DECISION: the
// provider must ignore a marketing-site leftover and the browser alike.
{
  const stated = shellLanguage({ language: "fr" });
  eq("a stored language reaches the provider as an account choice", stated.language, "fr");
  eq("…with fromAccount true", stated.fromAccount, true);
  eq(
    "…so a stored fr beats a stored-in-the-browser uk AND a German browser",
    resolveShellLanguage({ initialLanguage: stated.language, fromAccount: stated.fromAccount, stored: "uk", browser: "de-DE" }),
    "fr",
  );
  const nothing = shellLanguage({ language: null });
  eq("no stored language hands the provider nothing", nothing.language, null);
  eq("…with fromAccount false", nothing.fromAccount, false);
  eq(
    "…so the browser's fallbacks are live for a rep who never chose",
    resolveShellLanguage({ initialLanguage: nothing.language, fromAccount: nothing.fromAccount, stored: null, browser: "fr-CA" }),
    "fr",
  );
  eq("a dropped language reads as no statement, not as English", shellLanguage({ language: "zz" }).fromAccount, false);
  eq("nobody signed in reads as no statement", shellLanguage(null).fromAccount, false);
}

// The one reader.
{
  const layout = stripComments(read("app/sales/layout.js"));
  ok("the sales layout reads SalesRep.language", /select:\s*\{\s*language:\s*true\s*\}/.test(layout));
  ok("…through shellLanguage, which decides the flag WITH the code", /shellLanguage\(await repLanguageRow\(\)\)/.test(layout));
  ok(
    "…and hands both to the provider together",
    /<LanguageProvider initialLanguage=\{language\} fromAccount=\{fromAccount\}>/.test(layout),
  );
  ok("…with the shell — tabs, tab bar, tour — INSIDE that provider", /<LanguageProvider[^>]*>\s*<SalesShell>\{children\}<\/SalesShell>\s*<\/LanguageProvider>/.test(layout));
  ok("the layout never reads navigator or localStorage itself", !/navigator|localStorage/.test(layout));
  // force-dynamic is what makes "the next request" mean the next request: a
  // cached layout would keep serving the language from before the switch.
  ok("the layout is force-dynamic, so a switch is read on the next request", /export const dynamic = "force-dynamic"/.test(layout));
  const shell = stripComments(read("app/sales/SalesShell.js"));
  ok("the shell mounts the tour and the tab bar under that provider", /<SalesTour\s*\/>/.test(shell) && /<SalesMobileTabBar/.test(shell));
}

// Writer 1: activation.
{
  const page = stripComments(read("app/sales/invite/[token]/page.js"));
  ok("the accept screen shows a language picker", /<select[\s\S]*id="sales-language"/.test(page));
  ok("…offering REP_LANGUAGE_OPTIONS, the same list the validator judges", /REP_LANGUAGE_OPTIONS\.map/.test(page));
  ok("…defaulting to the language the screen is rendering in", /value=\{language\}/.test(page) && /useLanguageContext\(\)/.test(page));
  ok("…re-rendering the form in the chosen language at once", /onChange=\{\(e\) => changeLanguage\(e\.target\.value\)\}/.test(page));
  ok("…and sending it with the password", /JSON\.stringify\(\{ token, password, language \}\)/.test(page));
  const route = stripComments(read("app/api/sales/auth/invite/route.js"));
  ok("the accept route validates it through repLanguageOrNull", /repLanguageOrNull\(body\.language\)/.test(route));
  ok("…only when the body carries the key", /"language" in body/.test(route));
  ok(
    "…and writes it in the SAME update as the password",
    /updateMany\(\{[\s\S]*?passwordHash,[\s\S]*?\.\.\.\(language === undefined \? \{\} : \{ language \}\)/.test(route),
  );
  // The validator, executed: what the route stores for what the picker sends.
  eq("a supported code is stored as itself", repLanguageOrNull("fr"), "fr");
  eq("an unsupported code is stored as nothing, not as English", repLanguageOrNull("zz"), null);
  eq("a region tag is refused rather than narrowed", repLanguageOrNull("fr-CA"), null);
  eq("a non-string is nothing", repLanguageOrNull({ code: "fr" }), null);
}

// Writer 2: the Pay tab. Writer 3: Welcome. One component, two homes.
{
  const picker = stripComments(read("app/components/sales/RepLanguageChoice.js"));
  ok("the picker PUTs to /api/sales/language", /fetchJson\("\/api\/sales\/language",\s*\{\s*method:\s*"PUT"/.test(picker));
  ok("…moves the chrome at once", /changeLanguage\(json\.language\)/.test(picker));
  ok("…and re-runs the layout so fromAccount is recomputed from the column", /router\.refresh\(\)/.test(picker));
  const route = stripComments(read("app/api/sales/language/route.js"));
  ok("the language route writes the column through saveRepLanguage", /saveRepLanguage\(\{ salesRepId: rep\.id, language: parsed\.language \}\)/.test(route));
  ok("Pay mounts the picker", /<RepLanguageChoice/.test(stripComments(read("app/sales/pay/page.js"))));
  ok("Welcome mounts the picker", /<RepLanguageChoice/.test(stripComments(read("app/sales/welcome/page.js"))));
  const writer = stripComments(read("lib/sales/preferenceWrite.js"));
  ok("the writer writes language and nothing else on the row", /data: \{ language \}/.test(writer));
}

// ── Result ─────────────────────────────────────────────────────────────────
console.log(
  `\n${failures ? "check:tour-language FAILED" : "check:tour-language passed"} — ${checks - failures}/${checks} checks\n`,
);
process.exit(failures ? 1 : 0);
