// scripts/check-language-precedence.mjs
//
//   npm run check:language-precedence
//
// Which language FieldQuo's own shell speaks, executed against every
// combination that has bitten — and the wiring that keeps pages from writing
// FieldQuo's preference on their own. Judged by exit code.
//
// ── The bug (2026-09-25) ───────────────────────────────────────────────────
//
// The owner: "Why when I click on the links of FieldQuo it'll send me in a
// different language?" The shell followed localStorage["fieldquo-language"] —
// permanent, shared by the whole origin — and that key was written by a
// contractor's client BOOKING page, by the signup/login prefill and by the
// email-link landings, none of which is a person choosing a language for
// FieldQuo. He tested a Spanish booking page; fieldquo.com was Spanish on every
// link he clicked after that.
//
// ── The rule it now follows ────────────────────────────────────────────────
//
//   account (fromAccount / stated) > this tab's switch (sessionStorage) >
//   the account learned on a public page > a page-only override > the device
//   (first supported of navigator.languages) > English — and a page that
//   speaks for a contractor skips the viewer's switch and account entirely.
//
// Sections 1–3 RUN the resolver and the storage layer (a fake window). Section
// 4 reads source with comments stripped: a fix described in a comment and not
// implemented is exactly the failure this codebase keeps finding. Every import
// is a namespace import so that, run against the code this replaced, the
// script reports FAILs instead of crashing on a missing export.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as S from "@/lib/i18n/statedLanguage";
import { LANGUAGE_CODES } from "@/app/i18n/languages";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const exists = (p) => fs.existsSync(path.join(ROOT, p));

let failures = 0;
let checks = 0;
function ok(name, pass, detail = "") {
  checks++;
  if (!pass) failures++;
  console.log(`  ${pass ? "ok  " : "FAIL"} ${name}${!pass && detail ? `  — ${detail}` : ""}`);
}
function eq(name, actual, expected) {
  ok(name, actual === expected, `got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`);
}
const fn = (name) => (typeof S[name] === "function" ? S[name] : null);
const resolve = (args) => {
  try {
    return S.resolveShellLanguage(args);
  } catch (err) {
    return `threw: ${err?.message}`;
  }
};

/** Comments out, strings kept — this repo's comments quote code. */
function stripComments(src) {
  let out = "";
  let i = 0;
  let quote = null;
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

// ═══ 1. The owner's four scenarios, one call each ═════════════════════════
console.log("\n1. The scenarios the owner reported, resolved\n");

// (a) The owner's browser: a stale permanent "es" from a test booking page,
// an English device, not signed in on this page. `stored` is what the old
// resolver was handed; passing it proves it is now ignored.
eq("(a) stale localStorage es + device en-US → English",
  resolve({ stored: "es", browser: ["en-US"] }), "en");
eq("(a) …and a stale uk with a device that says nothing we speak → English, not uk",
  resolve({ stored: "uk", browser: ["ja-JP"] }), "en");
// (b) A francophone phone, first visit.
eq("(b) device fr-CA → French marketing", resolve({ browser: ["fr-CA", "en-CA"] }), "fr");
// (c) The header's switcher: this tab only.
eq("(c) switched to de in this tab → German", resolve({ session: "de", browser: ["en-US"] }), "de");
eq("(c) a new tab has no switch → the device again", resolve({ session: null, stored: "de", browser: ["en-US"] }), "en");
// (d) A contractor's Spanish booking page, then back to fieldquo.com. The page
// override is keyed to the booking path, so the next page is handed none.
eq("(d) on /book the page's es holds", resolve({ page: "es", browser: ["en-US"], companyVoice: true }), "es");
eq("(d) after it, fieldquo.com is the device again", resolve({ page: null, stored: "es", browser: ["en-US"] }), "en");

// ═══ 2. The full matrix ═════════════════════════════════════════════════════
console.log("\n2. signed in/out × stale key × tab switch × device × page override × page voice\n");

const DEVICES = [
  [["en-US"], "en"],
  [["fr-CA"], "fr"],
  [["es-419"], "es"],
  [["pa-IN"], "pa"],
  [["zh-Hant"], null],
  [["ja"], null],
  [["ja", "fr-CA"], "fr"], // the SECOND preference, when the first is unsupported
  [["fil-PH"], "tl"], // how phones report Tagalog
  ["de-AT", "de"], // a single navigator.language string
  [null, null],
];
// Who is looking. `stated` is the root provider on an /app page (the shell
// announced the account); `account` is a public page that learned it.
const VIEWERS = [
  { name: "anonymous", stated: null, account: null },
  { name: "signed in, public page", stated: null, account: "es" },
  { name: "signed in, beside /app", stated: "uk", account: "uk" },
];

// The spec, written out independently of the implementation.
function expected({ stated, account, session, page, device, companyVoice }) {
  if (stated) return stated;
  if (!companyVoice && session) return session;
  if (!companyVoice && account) return account;
  if (page) return page;
  if (device) return device;
  return "en";
}

let matrix = 0;
let matrixFails = [];
for (const viewer of VIEWERS) {
  for (const stored of [null, "es", "uk"]) {
    for (const session of [null, "de"]) {
      for (const [browser, device] of DEVICES) {
        for (const page of [null, "it"]) {
          for (const companyVoice of [false, true]) {
            matrix++;
            const args = { stated: viewer.stated, account: viewer.account, stored, session, browser, page, companyVoice };
            const want = expected({ ...args, device });
            const got = resolve(args);
            if (got !== want) matrixFails.push(`${viewer.name} stored=${stored} session=${session} device=${JSON.stringify(browser)} page=${page} voice=${companyVoice}: got ${got}, want ${want}`);
          }
        }
      }
    }
  }
}
ok(`all ${matrix} combinations follow the precedence`, matrixFails.length === 0, `${matrixFails.length} wrong, e.g. ${matrixFails.slice(0, 3).join(" | ")}`);
ok("…and the stale permanent key never decides one", matrixFails.every((f) => !/stored=(es|uk)/.test(f)) && matrixFails.length === 0);

// The account's own provider (fromAccount) listens to nothing else at all.
eq("fromAccount fr ignores a switch, a page, a stale key and the device",
  resolve({ initialLanguage: "fr", fromAccount: true, session: "de", page: "it", stored: "uk", browser: ["es-419"], account: "pa" }), "fr");
eq("fromAccount with an unsupported code is English, not a guess",
  resolve({ initialLanguage: "zz", fromAccount: true, session: "de", browser: ["es-419"] }), "en");
// A stated account beats a tab switch: the Ukrainian-tours bug, one rung up.
eq("the /app announcement beats a switch made on the marketing site", resolve({ stated: "es", session: "uk" }), "es");
// A signed-in person pressing the switcher on a public page gets it.
eq("a signed-in person's switch on a public page is honoured", resolve({ account: "es", session: "de" }), "de");
eq("…and never reaches a contractor's page", resolve({ account: "es", session: "de", companyVoice: true, browser: ["en-US"] }), "en");
eq("the account outranks a prefill's language on /login", resolve({ account: "fr", page: "es" }), "fr");
eq("anonymous: a prefill's language outranks the device", resolve({ page: "es", browser: ["en-US"] }), "es");
eq("nothing at all is English", resolve({}), "en");
eq("an unrecognised device keeps the server's render", resolve({ initialLanguage: "it", browser: ["sv-SE"] }), "it");

// deviceLanguage, alone.
const deviceLanguage = fn("deviceLanguage");
ok("deviceLanguage is exported", Boolean(deviceLanguage));
if (deviceLanguage) {
  for (const [input, want] of [
    [["fr-CA"], "fr"], [["es-419"], "es"], [["pa-IN"], "pa"], [["zh-Hant"], null], [["ja"], null],
    [["zh-Hant", "ja", "uk-UA"], "uk"], ["EN-gb", "en"], [[" it-IT "], "it"], [[42, null, "de"], "de"],
    ["", null], [undefined, null], [["x-klingon"], null], [["fil"], "tl"], [["tl-PH"], "tl"],
  ]) {
    eq(`deviceLanguage(${JSON.stringify(input)})`, deviceLanguage(input), want);
  }
  ok("every language FieldQuo speaks is reachable from a device", LANGUAGE_CODES.every((c) => deviceLanguage([`${c}-XX`]) === c));
}

// speaksForCompany: the owner's list, and not a character more.
const speaks = fn("speaksForCompany");
ok("speaksForCompany is exported", Boolean(speaks));
if (speaks) {
  for (const p of ["/book", "/quote", "/q", "/portal", "/site", "/embed", "/f", "/instant-quote"]) {
    ok(`${p}/x speaks for a company`, speaks(`${p}/x`) === true);
  }
  for (const p of ["/", "/pricing", "/login", "/signup", "/app", "/app/quotes", "/help/en", "/verify-email", "/reset-password", "/sales/invite/t", "/platform", "/quotes", "/booking", "/sites", "/fr", "/accept-invitation/x"]) {
    ok(`${p} is FieldQuo speaking`, speaks(p) === false);
  }
  ok("junk paths are not a company's", [null, undefined, "", "book", 42, {}].every((p) => speaks(p) === false));
}

// ═══ 3. The stores and the storage, in a fake browser ══════════════════════
console.log("\n3. What reaches storage, and what is asked of the server\n");

function fakeStorage(initial = {}) {
  const m = new Map(Object.entries(initial));
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    dump: () => Object.fromEntries(m),
  };
}
const local = fakeStorage({ "fieldquo-language": "es", "fieldquo-theme": "dark" });
const session = fakeStorage();
const requests = [];
let nextAnswer = { signedIn: true, language: "fr" };
globalThis.window = { localStorage: local, sessionStorage: session };
globalThis.fetch = async (url) => {
  requests.push(String(url));
  return { ok: true, json: async () => nextAnswer };
};

let L = null;
try {
  L = await import("@/lib/i18n/languageStorage");
} catch (err) {
  ok("lib/i18n/languageStorage.js loads", false, err?.message);
}
const settle = () => new Promise((r) => setTimeout(r, 0));

if (L) {
  S.__resetStatedLanguage();
  L.forgetLegacyLanguage();
  eq("the stale permanent key is removed on load", local.getItem("fieldquo-language"), null);
  eq("…and nothing else in localStorage is touched", local.getItem("fieldquo-theme"), "dark");

  L.saveSessionLanguage("de");
  eq("a switch goes to sessionStorage", session.getItem(L.SESSION_LANGUAGE_KEY), "de");
  eq("…is live in the page-wide store", S.sessionLanguage(), "de");
  ok("…and never to localStorage", !Object.values(local.dump()).includes("de"));
  L.saveSessionLanguage("zz");
  eq("an unsupported switch clears rather than stores junk", session.getItem(L.SESSION_LANGUAGE_KEY), null);

  // Anonymous: no flag, no request.
  L.learnAccountLanguage();
  await settle();
  eq("an anonymous browser makes no request", requests.length, 0);

  // Signed in (the /app shell set the flag).
  L.rememberSignedIn();
  L.learnAccountLanguage();
  L.learnAccountLanguage();
  await settle();
  await settle();
  eq("a signed-in browser asks once per page, however many providers ask", requests.length, 1);
  eq("…at /api/me/language", requests[0], "/api/me/language");
  eq("…and the account's language is learned", S.accountLanguage(), "fr");

  // Signed out on the server since: the flag is dropped, once.
  L.forgetSignedIn();
  eq("signing out forgets the account's language at once", S.accountLanguage(), null);
  eq("…and the flag", local.getItem(L.SIGNED_IN_KEY), null);
  L.rememberSignedIn();
  nextAnswer = { signedIn: false, language: null };
  L.learnAccountLanguage();
  await settle();
  await settle();
  eq("a stale flag costs one request", requests.length, 2);
  eq("…which removes it", local.getItem(L.SIGNED_IN_KEY), null);
  L.learnAccountLanguage();
  await settle();
  eq("…so the next page asks nothing", requests.length, 2);

  // The marketing header's own session answer (it already asks, for everyone).
  if (typeof L.noteSessionPresence === "function") {
    L.rememberSignedIn();
    L.noteSessionPresence(false);
    await settle();
    eq("the header seeing nobody signed in drops a stale flag", local.getItem(L.SIGNED_IN_KEY), null);
    eq("…without a request of its own", requests.length, 2);
    nextAnswer = { signedIn: true, language: "pa" };
    L.noteSessionPresence(true);
    await settle();
    await settle();
    eq("the header seeing a session sets the flag", local.getItem(L.SIGNED_IN_KEY), "1");
    eq("…and learns the account's language with one request", S.accountLanguage(), "pa");
    eq("…exactly one", requests.length, 3);
    L.forgetSignedIn();
  } else {
    ok("noteSessionPresence is exported", false);
  }

  // No localStorage write carries a language, anywhere in this run.
  ok("localStorage never holds a language after all of that",
    !Object.entries(local.dump()).some(([k, v]) => k !== "fieldquo-theme" && LANGUAGE_CODES.includes(v)),
    JSON.stringify(local.dump()));

  // Blocked storage throws on the accessor itself.
  globalThis.window = {
    get localStorage() { throw new Error("blocked"); },
    get sessionStorage() { throw new Error("blocked"); },
  };
  let threw = false;
  try {
    L.saveSessionLanguage("fr");
    L.rememberSignedIn();
    L.forgetSignedIn();
  } catch {
    threw = true;
  }
  ok("blocked storage never throws out of the language layer", !threw);
  eq("…and the switch still holds for the page", S.sessionLanguage(), "fr");
  globalThis.window = undefined;
  S.__resetStatedLanguage();
}

// ═══ 4. The wiring, read with comments stripped ═════════════════════════════
console.log("\n4. Who may call the persisting setter, and who may not\n");

function walk(dir, out = []) {
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name.startsWith(".")) continue;
      walk(rel, out);
    } else if (/\.(m?js|jsx)$/.test(e.name)) out.push(rel);
  }
  return out;
}
const SOURCES = [...walk("app"), ...walk("lib"), ...(exists("components") ? walk("components") : [])];

// The ONLY places a person makes an explicit choice for FieldQuo's shell.
// Adding a file here is a product decision: it means "this control is a
// person choosing FieldQuo's language for the rest of this tab".
const EXPLICIT = new Set([
  "app/components/marketing/LanguageSwitcher.js",
  "app/sales/invite/[token]/page.js",
  "app/components/sales/RepLanguageChoice.js",
]);
const callers = SOURCES.filter((f) => /\bchangeLanguage\(/.test(stripComments(read(f))))
  .filter((f) => f !== "app/providers/LanguageProvider.js");
const stray = callers.filter((f) => !EXPLICIT.has(f));
ok("only the three explicit pickers call changeLanguage", stray.length === 0, stray.join(", "));
ok("…and each of them still does (a picker that stopped would be a dead control)",
  [...EXPLICIT].every((f) => callers.includes(f)), [...EXPLICIT].filter((f) => !callers.includes(f)).join(", "));

// Client-facing trees and the prefill / link-landing paths, named so a miss
// reads as what it is.
const COMPANY_TREES = (S.COMPANY_VOICE_PREFIXES || ["/book", "/quote", "/q", "/portal", "/site", "/embed", "/f", "/instant-quote"])
  .map((p) => `app${p}/`);
const clientCallers = SOURCES.filter((f) => COMPANY_TREES.some((t) => f.startsWith(t)))
  .filter((f) => /\bchangeLanguage\(/.test(stripComments(read(f))));
ok("no client-facing page calls the persisting setter", clientCallers.length === 0, clientCallers.join(", "));
for (const f of ["app/book/[companySlug]/BookingFlow.js", "app/signup/page.js", "app/login/page.js", "app/components/auth/LinkLanguage.js"]) {
  ok(`${f} does not call changeLanguage`, !/\bchangeLanguage\b/.test(stripComments(read(f))));
}
ok("the booking page sets its language for the page only",
  (stripComments(read("app/book/[companySlug]/BookingFlow.js")).match(/setPageLanguage\(/g) || []).length === 3);
ok("the signup and login prefills do too",
  /setPageLanguage\(found\.prefill\.language\)/.test(stripComments(read("app/signup/page.js"))) &&
  /setPageLanguage\(d\.prefill\.language\)/.test(stripComments(read("app/login/page.js"))));
ok("Settings applies the ACCOUNT's language, not a tab switch",
  /applyAccountLanguage\(/.test(stripComments(read("app/app/settings/language/page.js"))) &&
  /router\.refresh\(\)/.test(stripComments(read("app/app/settings/language/page.js"))));

// Nothing writes the old key, and nothing reads it but the one removal.
const legacyUsers = SOURCES.filter((f) => /["'`]fieldquo-language["'`]/.test(stripComments(read(f))));
ok("the old key appears in exactly one file", legacyUsers.length === 1 && legacyUsers[0] === "lib/i18n/languageStorage.js", legacyUsers.join(", "));
const storageSrc = exists("lib/i18n/languageStorage.js") ? stripComments(read("lib/i18n/languageStorage.js")) : "";
ok("…and that file only ever removes it",
  /localStorage\.removeItem\(LEGACY_LANGUAGE_KEY\)/.test(storageSrc) && !/(getItem|setItem)\(LEGACY_LANGUAGE_KEY/.test(storageSrc));
ok("the switch is written to sessionStorage, never localStorage",
  /sessionStorage\.setItem\(SESSION_LANGUAGE_KEY/.test(storageSrc) && !/localStorage\.setItem\(SESSION_LANGUAGE_KEY/.test(storageSrc));
ok("the one localStorage write is the signed-in flag, and it carries no language",
  (storageSrc.match(/localStorage\.setItem\(/g) || []).length === 1 && /localStorage\.setItem\(SIGNED_IN_KEY, "1"\)/.test(storageSrc));
ok("the account request only happens behind the flag",
  /if \(!hasSignedInFlag\(\)\) return;[\s\S]*fetch\("\/api\/me\/language"/.test(storageSrc));

const provider = stripComments(read("app/providers/LanguageProvider.js"));
ok("LanguageProvider touches no storage itself", !/localStorage|sessionStorage/.test(provider));
ok("LanguageProvider removes the old key on load", /forgetLegacyLanguage\(\)/.test(provider));
ok("LanguageProvider never asks on a contractor's page", /if \(!companyVoice\) learnAccountLanguage\(\)/.test(provider));
ok("the page override is keyed to its path", /page\.path === pathname/.test(provider));

// Static marketing stays static: nothing in the root layout reads the request.
const rootLayout = stripComments(read("app/layout.js"));
ok("the root layout reads no headers or cookies (marketing pages stay static)",
  !/next\/headers/.test(rootLayout) && !/\b(headers|cookies)\(\)/.test(rootLayout));

// The flag's writer and its two erasers.
ok("the /app shell is the flag's writer, and not for a support session",
  /accountSession=\{accountSession\}/.test(stripComments(read("app/app/layout.js"))) &&
  /const accountSession = Boolean\(settingsShell\.access && !settingsShell\.access\.impersonation\)/.test(stripComments(read("app/app/layout.js"))));
ok("LinkLanguage and the sales portal are NOT (fromAccount without a session)",
  !/accountSession/.test(stripComments(read("app/components/auth/LinkLanguage.js"))) &&
  !/accountSession/.test(stripComments(read("app/sales/layout.js"))));
ok("the marketing header reports the session it already asked for",
  /noteSessionPresence\(isLoggedIn\)/.test(stripComments(read("app/components/marketing/MarketingHeader.js"))));
ok("signOut() forgets the flag before signing out",
  /export function signOut\([\s\S]*?forgetSignedIn\(\);[\s\S]*?authClient\.signOut\(/.test(stripComments(read("lib/auth-client.js"))));

const route = exists("app/api/me/language/route.js") ? stripComments(read("app/api/me/language/route.js")) : "";
ok("GET /api/me/language exists", Boolean(route) && /export async function GET/.test(route));
ok("…reads the Better Auth session alone (no activity write, no impersonated company)",
  /auth\.api\.getSession\(/.test(route) && !/getCurrentMember/.test(route));
ok("…through the lookup the account emails use", /accountLanguageContext\(\{ id: userId \}\)/.test(route));
ok("…and is never cached", /private, no-store/.test(route) && /force-dynamic/.test(route));

console.log(`\n${failures ? "check:language-precedence FAILED" : "check:language-precedence passed"} — ${checks - failures}/${checks} checks\n`);
process.exit(failures ? 1 : 0);
