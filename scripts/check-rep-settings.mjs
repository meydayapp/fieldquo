// scripts/check-rep-settings.mjs
//
//   npm run check:rep-settings
//
// A sales rep now has two things to say about themselves — what language the
// portal talks to them in, and where their commission goes — and this proves
// the parts of that which can be got quietly wrong.
//
// ══ What it proves, and why each earns a check ════════════════════════════
//
//   1. `language` is validated against app/i18n/languages.js and nothing else,
//      by EXECUTING the shipped functions against hostile input: an
//      unsupported code, a region tag, a number, an object, whitespace, and a
//      body with the key missing entirely.
//
//   2. A null language never claims `fromAccount`. That flag tells
//      LanguageProvider "this is a stated decision, skip the localStorage and
//      navigator fallbacks", and app/sales/layout.js used to pass it beside a
//      hardcoded "en" — asserting a choice on behalf of somebody who had never
//      been offered one, and taking the browser fallback away from a
//      francophone rep. This is the single most important assertion in the
//      file: it is checked as a PROPERTY over every hostile input, not as one
//      happy-path example.
//
//   3. A language DROPPED from the supported set after a rep chose it reads as
//      "no stated preference". Simulated for real, with a loader hook that
//      hands a fresh copy of lib/sales/repLanguage.js a shrunken language
//      list — not approximated by passing a code that was never in it.
//
//   4. The first-run screen is SKIPPABLE. Nothing redirects into it but the
//      invitation being accepted, nothing redirects out of it, and the block
//      that carries the way out contains no conditional at all.
//
//   5. The payout form is not written twice. /sales/welcome and /sales/pay
//      render the same component, which posts to the same route, which writes
//      through savePayoutDestination().
//
// ══ Mutation-tested, and judged by EXIT CODE ══════════════════════════════
//
// Every source assertion below runs against DECOMMENTED source. This file's
// own prose names most of the strings it looks for, and three checks in this
// repo have already been fooled by matching their own header comments.
//
// The runner exits 1 on any failure AND on an uncaught throw, because a
// mutation that crashes a check prints no failures at all and reads exactly
// like a pass.
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { register } from "node:module";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

/**
 * Comments stripped before any source assertion.
 *
 * Copied from scripts/check-inbound-answer.mjs, and for the same reason: the
 * prose in these files explains the very strings they search for, so a
 * whole-file match passes over a deleted guard. This file's header names
 * `fromAccount`, `/sales/welcome` and `savePayoutDestination` — every one of
 * which is asserted below.
 */
const decomment = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");

let pass = 0;
const failures = [];
function ok(name, condition, got) {
  if (condition) {
    pass += 1;
    console.log(`  ok   ${name}`);
  } else {
    failures.push(name);
    console.log(
      `  FAIL ${name}${got !== undefined ? `  — got: ${JSON.stringify(got)}` : ""}`,
    );
  }
}
const section = (t) => console.log(`\n${t}\n`);

/** The body of a named function or arrow, brace-matched. */
function functionBody(src, name) {
  const at = src.search(new RegExp(`(?:function\\s+${name}\\s*\\(|(?:const|let)\\s+${name}\\s*=)`));
  if (at < 0) return null;
  const open = src.indexOf("{", at);
  if (open < 0) return null;
  let depth = 0;
  for (let i = open; i < src.length; i += 1) {
    if (src[i] === "{") depth += 1;
    else if (src[i] === "}") {
      depth -= 1;
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  return null;
}

const { LANGUAGE_CODES, LANGUAGES } = await import("@/app/i18n/languages");
const { REP_LANGUAGE_OPTIONS, repLanguageOrNull, shellLanguage, parseLanguageChoice } =
  await import("@/lib/sales/repLanguage");
const { PREFERENCE_WRITES_ON_SALES_REP } = await import("@/lib/sales/preferenceWrite");

// ═══════════════════════════════════════════════════════════════════════════
section("1. The supported set is ONE list, and the picker offers exactly it");
// ═══════════════════════════════════════════════════════════════════════════

ok(
  "the options come from app/i18n/languages.js, in its order",
  REP_LANGUAGE_OPTIONS.map((o) => o.code).join(",") === LANGUAGE_CODES.join(","),
  REP_LANGUAGE_OPTIONS.map((o) => o.code),
);
ok(
  "…and every option carries the name in its OWN language, for a rep scanning for it",
  REP_LANGUAGE_OPTIONS.every(
    (o, i) => typeof o.nativeName === "string" && o.nativeName === LANGUAGES[i].nativeName,
  ),
);
ok("…and the list is frozen, so a caller cannot widen it in place", Object.isFrozen(REP_LANGUAGE_OPTIONS));
ok("…as is every option", REP_LANGUAGE_OPTIONS.every((o) => Object.isFrozen(o)));

// ═══════════════════════════════════════════════════════════════════════════
section("2. Hostile input never becomes a stated language");
// ═══════════════════════════════════════════════════════════════════════════

// Executed, not read. A regex over the validator proves a check is written
// down, not that it refuses — and passes happily against one disabled with
// `false &&`.
const HOSTILE = [
  [undefined, "undefined"],
  [null, "null"],
  ["", "an empty string"],
  ["   ", "whitespace"],
  ["zz", "a code in no list anywhere"],
  ["ja", "a real language FieldQuo is not translated into"],
  ["fr-CA", "a region tag — refused rather than silently narrowed"],
  ["en-US", "the region tag a browser actually sends"],
  ["e", "one letter"],
  ["english", "the language's English name"],
  ["Français", "the language's own name"],
  [42, "a number"],
  [{}, "an object"],
  [[], "an array"],
  [["fr"], "an array containing a valid code"],
  [true, "a boolean"],
  [{ toString: () => "fr" }, "an object that stringifies to a valid code"],
  ["<script>", "markup"],
  ["en; DROP TABLE", "a code with a payload stapled to it"],
  ["én", "a combining accent"],
];

for (const [value, label] of HOSTILE) {
  ok(`${label} is not a stated language`, repLanguageOrNull(value) === null, repLanguageOrNull(value));
}

for (const code of LANGUAGE_CODES) {
  ok(`"${code}" is accepted as itself`, repLanguageOrNull(code) === code);
}
ok('an uppercase code is folded, not refused ("EN")', repLanguageOrNull("EN") === "en");
ok("…and surrounding whitespace is trimmed", repLanguageOrNull("  fr  ") === "fr");
ok("…and a mixed-case padded code still lands", repLanguageOrNull(" Es\t") === "es");

// The one thing that must NEVER happen: a value the reader does not recognise
// coming back as English. app/i18n/languages.js's normalizeLanguage() does
// exactly that — correctly, for its own job — so this is the boundary between
// the two.
ok(
  "nothing unrecognised is ever repaired into English",
  HOSTILE.every(([v]) => repLanguageOrNull(v) !== "en"),
);

// ═══════════════════════════════════════════════════════════════════════════
section("3. `fromAccount` is only ever claimed for a real, stated choice");
// ═══════════════════════════════════════════════════════════════════════════

{
  const never = shellLanguage(null);
  ok(
    "nobody signed in: no language, and no claim of one",
    never.language === null && never.fromAccount === false,
    never,
  );

  const empty = shellLanguage({});
  ok(
    "a rep row with no language column read: same",
    empty.language === null && empty.fromAccount === false,
    empty,
  );

  const unset = shellLanguage({ language: null });
  ok(
    "a rep who has never chosen: null, and fromAccount FALSE so the provider falls back",
    unset.language === null && unset.fromAccount === false,
    unset,
  );

  const chosen = shellLanguage({ language: "fr" });
  ok(
    "a rep who chose French: fr, and fromAccount TRUE so localStorage cannot overrule it",
    chosen.language === "fr" && chosen.fromAccount === true,
    chosen,
  );

  const shouted = shellLanguage({ language: "  FR " });
  ok("…however they typed it", shouted.language === "fr" && shouted.fromAccount === true, shouted);

  // The property, over everything above and everything hostile. One happy-path
  // example is what let a hardcoded "en fromAccount" live in the layout for
  // months.
  const everyInput = [
    null,
    undefined,
    {},
    { language: null },
    ...HOSTILE.map(([v]) => ({ language: v })),
    ...LANGUAGE_CODES.map((c) => ({ language: c })),
  ];
  const liars = everyInput
    .map((rep) => ({ rep, out: shellLanguage(rep) }))
    .filter(({ out }) => out.fromAccount && !repLanguageOrNull(out.language));
  ok(
    "PROPERTY: fromAccount is never true without a supported language behind it",
    liars.length === 0,
    liars,
  );

  const mutes = everyInput
    .map((rep) => shellLanguage(rep))
    .filter((out) => out.language !== null && !out.fromAccount);
  ok(
    "PROPERTY: and a language is never handed over while denying it is a decision",
    mutes.length === 0,
    mutes,
  );

  ok(
    "PROPERTY: the fallback branch passes null, never an invented 'en'",
    everyInput.every((rep) => {
      const out = shellLanguage(rep);
      return out.fromAccount || out.language === null;
    }),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. What the picker posts is judged by the same set");
// ═══════════════════════════════════════════════════════════════════════════

{
  const missing = parseLanguageChoice({});
  ok("a body with no `language` key is refused, not read as a clear", missing.ok === false, missing);
  ok("…and says something a rep can act on", (missing.error || "").length > 20);

  ok("a null body is refused", parseLanguageChoice(null).ok === false);
  ok("a string body is refused", parseLanguageChoice("fr").ok === false);
  ok("an array body is refused", parseLanguageChoice(["fr"]).ok === false);
  ok(
    "an explicit undefined is refused — a forgotten field must not wipe a choice",
    parseLanguageChoice({ language: undefined }).ok === false,
  );

  const cleared = parseLanguageChoice({ language: null });
  ok(
    "an explicit null IS accepted — it is the 'follow my browser' option",
    cleared.ok === true && cleared.language === null,
    cleared,
  );

  const good = parseLanguageChoice({ language: "uk" });
  ok("a supported code is accepted", good.ok === true && good.language === "uk", good);

  for (const [value, label] of HOSTILE) {
    if (value === null || value === undefined) continue;
    ok(`${label} is refused by the route's validator`, parseLanguageChoice({ language: value }).ok === false);
  }
  ok(
    "every refusal carries a reason and no language",
    HOSTILE.filter(([v]) => v !== null && v !== undefined)
      .map(([v]) => parseLanguageChoice({ language: v }))
      .every((r) => r.ok === false && !("language" in r) && typeof r.error === "string"),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. A language dropped from the set after a rep chose it");
// ═══════════════════════════════════════════════════════════════════════════

// Simulated for real rather than approximated. A loader hook registered HERE —
// after every import above, so the real module keeps the real list — hands a
// FRESH copy of lib/sales/repLanguage.js a shrunken language list. The copy is
// loaded under a cache-busting query, because node keys modules by URL and the
// real one is already resolved.
//
// Why bother, when passing "ja" exercises the same branch: because "the same
// branch" is the assumption under test. A future edit could special-case a
// stored value on the grounds that it must once have been valid, and passing
// an unknown code would not notice.
{
  const DROPPED = "de";
  const KEPT = "fr";
  const SHRUNK = `
export const LANGUAGES = [
  { code: "en", label: "EN", name: "English", nativeName: "English", dir: "ltr" },
  { code: "fr", label: "FR", name: "French", nativeName: "Fran\\u00e7ais", dir: "ltr" },
];
export const LANGUAGE_CODES = LANGUAGES.map((l) => l.code);
export const DEFAULT_LANGUAGE = "en";
export function isSupported(code) {
  return LANGUAGE_CODES.includes(String(code || "").toLowerCase());
}
export function languageMeta(code) {
  return LANGUAGES.find((l) => l.code === String(code || "").toLowerCase()) || LANGUAGES[0];
}
export function normalizeLanguage(value) {
  const base = String(value || "").toLowerCase().split(/[-_]/)[0];
  return isSupported(base) ? base : DEFAULT_LANGUAGE;
}
`;
  const HOOKS = `
export async function resolve(specifier, context, nextResolve) {
  if (specifier === "@/app/i18n/languages")
    return { url: "fq-stub:shrunk-languages", shortCircuit: true };
  return nextResolve(specifier, context);
}
export async function load(url, context, nextLoad) {
  if (url === "fq-stub:shrunk-languages")
    return { format: "module", shortCircuit: true, source: ${JSON.stringify(SHRUNK)} };
  return nextLoad(url, context);
}
`;
  register(`data:text/javascript,${encodeURIComponent(HOOKS)}`);

  const fresh = await import(
    `${pathToFileURL(join(ROOT, "lib/sales/repLanguage.js")).href}?dropped-language=1`
  );

  ok(
    "the shrunken set really took — the fresh copy offers two languages, not eight",
    fresh.REP_LANGUAGE_OPTIONS.length === 2,
    fresh.REP_LANGUAGE_OPTIONS.map((o) => o.code),
  );
  ok(
    "…and the REAL module is untouched by it",
    REP_LANGUAGE_OPTIONS.length === LANGUAGE_CODES.length && repLanguageOrNull(DROPPED) === DROPPED,
    REP_LANGUAGE_OPTIONS.length,
  );
  ok(
    `a rep whose stored "${DROPPED}" was dropped reads as no stated preference`,
    fresh.repLanguageOrNull(DROPPED) === null,
    fresh.repLanguageOrNull(DROPPED),
  );
  const stale = fresh.shellLanguage({ language: DROPPED });
  ok(
    "…so the shell falls back to the browser instead of rendering a language that is gone",
    stale.language === null && stale.fromAccount === false,
    stale,
  );
  ok(
    "…and a rep whose language survived is unaffected",
    fresh.shellLanguage({ language: KEPT }).fromAccount === true,
  );
  ok(
    "…and the route would refuse to re-save the dropped code",
    fresh.parseLanguageChoice({ language: DROPPED }).ok === false,
  );
}

// ═══════════════════════════════════════════════════════════════════════════
section("6. The shell asks, rather than asserting");
// ═══════════════════════════════════════════════════════════════════════════

{
  const layout = decomment(read("app/sales/layout.js"));

  ok("the layout resolves the language through shellLanguage()", /shellLanguage\(/.test(layout));

  // Scoped to the OPENING TAG, not the file. `fromAccount` also appears in the
  // destructuring above it, so a whole-file match would pass over a tag that
  // had been changed back to a bare `fromAccount` — which is the mutation this
  // assertion exists to catch.
  const providerTag = layout.match(/<LanguageProvider[\s\S]*?>/)?.[0] || "";
  ok("the provider's opening tag was located", providerTag.length > 0);
  ok(
    "…and it hands the provider BOTH halves of that one answer",
    /initialLanguage=\{language\}/.test(providerTag) && /fromAccount=\{fromAccount\}/.test(providerTag),
    providerTag,
  );
  // The bug this whole file exists for. `fromAccount` with no value is JSX for
  // `true`; a literal beside it is the assertion nobody made.
  ok(
    "…and never claims fromAccount unconditionally",
    !/fromAccount/.test(providerTag.replace(/fromAccount=\{fromAccount\}/g, "")),
    providerTag,
  );
  ok(
    "…and hardcodes no language literal",
    !/initialLanguage="/.test(providerTag),
    providerTag,
  );
  // /sales/login and /sales/invite render under this layout with no session at
  // all. A throw here takes down the only doors into the portal.
  ok("the lookup never throws", /catch\s*\(/.test(layout) && /console\.error/.test(layout));
  ok(
    "…and costs no query when there is no valid cookie",
    /if\s*\(!claims\)\s*return null/.test(layout),
  );
  ok(
    "…and selects the language column only",
    /select:\s*\{\s*language:\s*true\s*\}/.test(layout),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
section("7. The route validates before it writes, and writes through the fence");
// ═══════════════════════════════════════════════════════════════════════════

{
  const routePath = "app/api/sales/language/route.js";
  ok("the route exists", existsSync(join(ROOT, routePath)));
  const route = decomment(read(routePath));

  ok("both verbs are behind the gate", (route.match(/requireOutreachRep\(request\)/g) || []).length === 2);
  ok("…and each returns the refusal verbatim", (route.match(/if\s*\(refusal\)\s*return/g) || []).length === 2);

  const put = functionBody(route, "PUT");
  ok("the PUT was located", Boolean(put));
  ok("…and validates through the shared pure function", /parseLanguageChoice\(/.test(put || ""));
  ok("…and refuses before writing", (put || "").indexOf("parseLanguageChoice") < (put || "").indexOf("saveRepLanguage"));
  ok("…and takes the rep id from the gate, never the body", /salesRepId:\s*rep\.id/.test(put || ""));
  ok("…and never reads a rep id out of the request", !/body\.(salesRepId|repId|id)/.test(put || ""));

  // The route must not reach Prisma for the write. scripts/check-sales-auth.mjs
  // scans the modules a rep-facing route imports, one hop, and a direct write
  // here would sidestep the declared fence entirely.
  ok(
    "the route makes no Prisma write of its own",
    !/\bdb\.\w+\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\b/.test(route),
    route.match(/db\.\w+\.\w+/g),
  );
  ok(
    "…and the one read it does make is the rep's own language",
    /db\.salesRep\.findUnique/.test(route),
  );

  ok("the fenced writer names exactly one column", PREFERENCE_WRITES_ON_SALES_REP.length === 1);
  ok("…and it is `language`", PREFERENCE_WRITES_ON_SALES_REP[0] === "language");
  ok(
    "…and check-sales-auth declares that file as a sanctioned rep-row write",
    read("scripts/check-sales-auth.mjs").includes("lib/sales/preferenceWrite.js"),
  );

  // A code dropped from the set must not come back out of the route as
  // selected, for the same reason it must not come back out of the layout.
  const view = functionBody(route, "view");
  ok("the answer runs the stored code back through the validator", /repLanguageOrNull\(/.test(view || ""));
  ok("…and ships the vocabulary with it, so the picker cannot drift", /REP_LANGUAGE_OPTIONS/.test(view || ""));
}

// ═══════════════════════════════════════════════════════════════════════════
section("8. One place a rep changes their own settings — and one payout form");
// ═══════════════════════════════════════════════════════════════════════════

{
  const pay = decomment(read("app/sales/pay/page.js"));
  ok("/sales/pay renders the language picker", /<RepLanguageChoice/.test(pay));
  ok("…and the payout form", /<PayoutDestinationForm/.test(pay));
  // The screen is reachable: SalesShell's tab list is what makes it so, and
  // scripts/check-sales-home.mjs holds that generally. Named here because THIS
  // change is what made it the settings screen rather than the payout screen.
  ok(
    "…and the shell still has a tab that opens it",
    decomment(read("app/sales/SalesShell.js")).includes('"/sales/pay"'),
  );

  const form = "app/components/sales/PayoutDestinationForm.js";
  ok("the payout form lives in one component", existsSync(join(ROOT, form)));
  const formSrc = decomment(read(form));
  ok("…which posts to the existing route", /"\/api\/sales\/payout"/.test(formSrc));
  ok("…with PUT", /method:\s*"PUT"/.test(formSrc));
  ok("…and reports every failure rather than swallowing it", /setError\(/.test(formSrc) && !/if\s*\(res\.ok\)/.test(formSrc));

  // The duplication this change existed to avoid. Neither screen may build its
  // own payout request.
  const welcome = decomment(read("app/sales/welcome/page.js"));
  for (const [label, src] of [
    ["/sales/pay", pay],
    ["/sales/welcome", welcome],
  ]) {
    ok(
      `${label} does not build its own payout request`,
      !/\/api\/sales\/payout/.test(src),
      src.match(/\/api\/sales\/[\w-]+/g),
    );
    ok(`${label} does not build its own language request`, !/\/api\/sales\/language/.test(src));
  }

  // …and the writes still land in the two fenced writers, not somewhere new.
  ok(
    "the payout route still writes through savePayoutDestination()",
    /savePayoutDestination\(/.test(decomment(read("app/api/sales/payout/route.js"))),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
section("9. The first-run pass asks both, and is never a wall");
// ═══════════════════════════════════════════════════════════════════════════

{
  const welcomePath = "app/sales/welcome/page.js";
  ok("the first-run screen exists", existsSync(join(ROOT, welcomePath)));
  const welcome = decomment(read(welcomePath));

  ok("it asks for the payout destination", /<PayoutDestinationForm/.test(welcome));
  ok("…and for the language", /<RepLanguageChoice/.test(welcome));

  // ── Skippable, proved three ways ───────────────────────────────────────
  //
  // (a) the exit exists, (b) nothing on the screen can be disabled, and
  // (c) the block carrying the exit contains no conditional at all. (c) is the
  // one that survives a future edit: a guard like `payoutDone && (...)` would
  // put an `&&` inside that region.
  ok("there is a way out to the portal", /href="\/sales"/.test(welcome));
  ok(
    "…and nothing on this screen is ever disabled",
    !/\bdisabled\b/.test(welcome),
    welcome.match(/.{0,40}disabled.{0,40}/),
  );

  const raw = read(welcomePath);
  const anchor = raw.indexOf("THE WAY OUT");
  // Bounded at the end of the page component's returned JSX, not at the end of
  // the file: the StepMark helper below it carries a ternary of its own, and an
  // unbounded slice would fail on a tick mark while missing a guard on the
  // actual link.
  const anchorEnd = raw.indexOf("\n  );", anchor);
  ok("the exit block is marked so it can be scoped", anchor > 0 && anchorEnd > anchor, {
    anchor,
    anchorEnd,
  });
  const exitBlock = decomment(raw.slice(anchor, anchorEnd));
  ok(
    "…and it contains the link to the portal",
    /href="\/sales"/.test(exitBlock),
    exitBlock.slice(0, 120),
  );
  ok(
    "…with no `&&` guard anywhere in it",
    !exitBlock.includes("&&"),
    exitBlock.match(/.{0,60}&&.{0,60}/),
  );
  ok(
    "…and no ternary either",
    !/\?[^?]*:/.test(exitBlock.replace(/https?:\/\//g, "")),
    exitBlock.match(/.{0,60}\?.{0,60}/),
  );

  // Nothing forces a rep INTO it. A server redirect would turn "skippable" back
  // into a wall the moment somebody navigated away, and the whole app/ tree is
  // scanned rather than the two files I happen to remember.
  const offenders = [];
  const walk = (abs) => {
    for (const entry of readdirSync(abs)) {
      const full = join(abs, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (entry.endsWith(".js")) {
        const src = decomment(readFileSync(full, "utf8"));
        if (/(redirect|rewrite)\s*\(\s*[^)]*\/sales\/welcome/.test(src)) {
          offenders.push(relative(ROOT, full));
        }
      }
    }
  };
  walk(join(ROOT, "app"));
  if (existsSync(join(ROOT, "middleware.js"))) {
    const mw = decomment(read("middleware.js"));
    if (/\/sales\/welcome/.test(mw)) offenders.push("middleware.js");
  }
  ok("nothing redirects a rep into the first-run screen", offenders.length === 0, offenders);

  // The one thing that DOES send them there: accepting the invitation.
  const invite = decomment(read("app/sales/invite/[token]/page.js"));
  ok(
    "accepting an invitation lands on it",
    /window\.location\.href\s*=\s*"\/sales\/welcome"/.test(invite),
    invite.match(/window\.location\.href[^\n]*/g),
  );
  ok(
    "…and that is still the only navigation the accept form makes",
    (invite.match(/window\.location\.href\s*=/g) || []).length === 1,
  );

  // No column on SalesRep tracking whether they have seen it — that would be
  // written by one screen and read by nothing, and would tempt the next change
  // into re-showing the wall until it was ticked.
  //
  // Scoped to the SalesRep model AND to its DECLARATIONS, not to the schema
  // file. Prisma's `///` prose is thorough here, and another model's comment
  // already discusses "the SalesRep.onboardedAt that app/sales/welcome
  // rejected" — a whole-file match failed on somebody agreeing with this rule
  // in writing, which is the false failure that gets a check deleted.
  const schemaSrc = read("prisma/schema.prisma");
  const repAt = schemaSrc.indexOf("model SalesRep {");
  const repModel = schemaSrc
    .slice(repAt, schemaSrc.indexOf("\n}", repAt))
    .split("\n")
    .filter((l) => !l.trim().startsWith("//"))
    .join("\n");
  ok(
    "no `onboardedAt`-style column was invented on SalesRep for it",
    repAt > 0 && !/\b(onboardedAt|welcomeSeen|firstRunAt)\b/.test(repModel),
    repModel.match(/.*(onboardedAt|welcomeSeen|firstRunAt).*/),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
section("10. The column itself");
// ═══════════════════════════════════════════════════════════════════════════

{
  const schema = read("prisma/schema.prisma");
  const at = schema.indexOf("model SalesRep {");
  ok("the SalesRep model was located", at > 0);
  const model = schema.slice(at, schema.indexOf("\n}", at));
  const line = model.split("\n").find((l) => /^\s*language\s+String/.test(l));
  ok("SalesRep carries a `language` column", Boolean(line), line);
  ok("…and it is nullable", /String\?/.test(line || ""), line);
  // A default is the exact thing this change exists to remove: "en" on a row
  // nobody asked is a decision nobody made.
  ok("…with NO default pretending to be a choice", !/@default/.test(line || ""), line);
  ok(
    "…and the schema says null is not English",
    /null is NOT/i.test(model) || /Null until they say/i.test(model),
  );
}

// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// Engagement is FieldQuo's decision, made on /platform/sales/reps — never a
// sentence the rep is told to fix, and never guessed.
// ═══════════════════════════════════════════════════════════════════════════
{
  const { readFileSync } = await import("node:fs");
  const src = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  const payout = src("app/api/sales/payout/route.js");
  ok("the rep's payout payload filters no_engagement out of `problems`",
    /problems: readiness\.problems\.filter\(\(p\) => p\.code !== "no_engagement"\)/.test(payout));
  ok("…and names it separately as adminProblems rather than dropping the verdict",
    /adminProblems: readiness\.problems\.filter\(\(p\) => p\.code === "no_engagement"\)/.test(payout));
  ok("…while `ready` still carries the full verdict the payout run reads", /ready: readiness\.ready,/.test(payout));
  const form = src("app/components/sales/PayoutDestinationForm.js");
  ok("the rep form shows the engagement panel only once one is set", /showEngagement && engagement \?/.test(form));
  const admin = src("app/api/platform/sales/reps/[id]/route.js");
  ok("the platform rep PATCH accepts `engagement`", /const touchesEngagement = "engagement" in body;/.test(admin));
  ok("…validates it against ENGAGEMENTS", /isEngagement\(engagement\)/.test(admin) && /import \{ ENGAGEMENTS, isEngagement \} from "@\/lib\/sales\/payoutDetails"/.test(admin));
  ok("…and clears accruesPaidLeave when the rep is not an employee", /engagement !== "employee" \? \{ accruesPaidLeave: false \}/.test(admin));
  const create = src("app/api/platform/sales/reps/route.js");
  ok("the platform rep POST accepts `engagement` at set-up and refuses a bad value", /isEngagement\(engagement\)/.test(create) && /engagement,/.test(create));
  // The select read it and the response map dropped it: the owner set
  // Daniel to freelancer, pressed Save, and the card reloaded to "Not
  // decided yet" while the row said freelancer.
  ok("…and the list RESPONSE carries engagement, not just the select", /engagement: r\.engagement \|\| null,/.test(create) && /accruesPaidLeave: Boolean\(r\.accruesPaidLeave\),/.test(create));
  const page = src("app/platform/sales/reps/page.js");
  ok("the reps screen offers the choice at invite", /id="rep-engagement"/.test(page));
  ok("…and per rep, with a Set/Change control", /Engagement for \$\{rep\.name\}/.test(page) && /rep\.engagement \? "Change" : "Set"/.test(page));
  ok("…and says out loud when nobody has decided", /Nobody has said whether this rep is a freelancer or an/.test(page));
}

console.log(`\n${pass} passed, ${failures.length} failed`);
for (const f of failures) console.log(`  · ${f}`);
process.exit(failures.length === 0 ? 0 : 1);
