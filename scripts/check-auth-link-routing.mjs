// scripts/check-auth-link-routing.mjs
//
//   npm run check:auth-link-routing
//
// The four faults the owner hit testing his own signup on 2026-09-25, each
// executed against the scenario that produced it. Every section below FAILS
// on the code as it stood that morning and passes now.
//
//   1. The English confirmation email opened a SPANISH page (and a second
//      click opened an English one): the page guessed from the browser.
//   2. The confirmation link, opened while signed in as ANOTHER account,
//      could not say whose address it confirmed and waved them on into the
//      other account's company.
//   3. The "free month is waiting" resume link opened the ACCOUNT step for an
//      address that had had a login for twelve days — found out only by
//      typing a password.
//   4. That letter was sent at all: to an address whose login had a paying
//      company, and to an address half-typed on the way to one that finished.
//
// Pure functions are executed; the wiring (which page calls which function,
// in which order) is asserted on comment-stripped source.
//
// Run: node --import ./scripts/alias-loader.mjs --import ./scripts/db-stub-loader.mjs scripts/check-auth-link-routing.mjs

import { readFileSync } from "node:fs";
import { SignJWT } from "jose";

import {
  RESET_PAGE,
  VERIFY_PAGE,
  linkLanguage,
  readVerifyToken,
  sessionRelation,
  verifyOutcome,
  verifyPageLink,
  withLandingPage,
} from "@/lib/authLinks";
import { resolveShellLanguage } from "@/lib/i18n/statedLanguage";
import { RESUME_ACTIONS, decideResumeRoute, loginFromUser, safeResumeTarget } from "@/lib/signup/resumeRoute";
import { earlyNudgePersonFromCompany, earlyNudgePersonFromLead, planEarlyNudges, visitorCompanyKey } from "@/lib/signup/earlyNudge";
import { FINISHED_SAME_VISITOR, decideSignupLeadPromotion, signupLeadFinished } from "@/lib/signup/leads";
import { recordSignupCompletion } from "@/lib/signup/salesFloor";
import { APP_MESSAGES } from "@/app/i18n/appMessages";
import { LANGUAGE_CODES } from "@/app/i18n/languages";

let failures = 0;
let passes = 0;
function ok(label, cond, detail = "") {
  if (cond) {
    passes++;
    console.log(`  ✓ ${label}`);
  } else {
    failures++;
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

const root = new URL("../", import.meta.url);
const read = (p) => readFileSync(new URL(p, root), "utf8");
// Executing lines only: a comment that names a function is not a call to it.
const code = (p) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

// ══════════════════════════════════════════════════════════════════════════
console.log("\n1. The page a link opens speaks the email's language, from the first render");

const BA_VERIFY = "https://www.fieldquo.com/api/auth/verify-email?token=TOK.EN.X&callbackURL=%2F";
{
  const link = new URL(verifyPageLink(BA_VERIFY, "en"));
  ok("the confirmation link lands on /verify-email, not the auth API", link.pathname === VERIFY_PAGE, link.href);
  ok("…same origin Better Auth built its link on", link.origin === "https://www.fieldquo.com");
  ok("…carrying the token", link.searchParams.get("token") === "TOK.EN.X");
  ok("…and the recipient's language", link.searchParams.get("lang") === "en");
  ok("an upper-case code is normalised", new URL(verifyPageLink(BA_VERIFY, "FR")).searchParams.get("lang") === "fr");
  ok("an unsupported language is left off, never guessed", !new URL(verifyPageLink(BA_VERIFY, "zz")).searchParams.has("lang"));
  ok("no language → no lang param (the page then reads the account)", !new URL(verifyPageLink(BA_VERIFY, null)).searchParams.has("lang"));
  ok("a link with no token falls back to Better Auth's, landing page forced",
    new URL(verifyPageLink("https://x.test/api/auth/verify-email?callbackURL=", "de")).searchParams.get("callbackURL") === "/verify-email?lang=de");
  ok("javascript: is passed through untouched (authEmails refuses it)", verifyPageLink("javascript:alert(1)", "en") === "javascript:alert(1)");
}
{
  const reset = new URL(withLandingPage("https://www.fieldquo.com/api/auth/reset-password/RT?callbackURL=", RESET_PAGE, "pa"));
  ok("the reset link still goes through the auth API (token checked before typing)", reset.pathname.startsWith("/api/auth/reset-password/"));
  ok("…with the language on its landing page", reset.searchParams.get("callbackURL") === "/reset-password?lang=pa", reset.searchParams.get("callbackURL"));
  // Better Auth's redirectCallback (api/routes/password.mjs): new URL(callbackURL, baseURL) + its own token.
  const landed = new URL(reset.searchParams.get("callbackURL"), "https://www.fieldquo.com/api/auth");
  landed.searchParams.set("token", "RT");
  ok("…which survives Better Auth's redirect beside the token", landed.pathname === "/reset-password" && landed.searchParams.get("lang") === "pa" && landed.searchParams.get("token") === "RT", landed.href);
  const chosen = new URL(withLandingPage("https://x.test/api/auth/reset-password/RT?callbackURL=%2Fsomewhere", RESET_PAGE, "fr"));
  ok("a callback a caller CHOSE is left alone", chosen.searchParams.get("callbackURL") === "/somewhere");
}
ok("linkLanguage refuses junk", linkLanguage("xx") === null && linkLanguage(undefined) === null && linkLanguage(" IT ") === "it");

// The mechanism of the Spanish page: the root provider, told nothing, follows
// the browser. The wrapper hands the account's language in with `fromAccount`,
// which outranks every browser signal.
ok("the old arrival: no account language → the browser's stored 'es' wins",
  resolveShellLanguage({ initialLanguage: undefined, fromAccount: false, stored: "es", browser: "es-CA" }) === "es");
ok("the new arrival: account 'en' handed in → English whatever the browser says",
  resolveShellLanguage({ initialLanguage: "en", fromAccount: true, stored: "es", browser: "es-CA" }) === "en");
ok("…on a fresh device too (nothing stored, Spanish navigator)",
  resolveShellLanguage({ initialLanguage: "en", fromAccount: true, stored: null, browser: "es-ES" }) === "en");

{
  const AUTH = code("lib/auth.js");
  ok("lib/auth.js builds the confirmation link with verifyPageLink(url, language)", /link:\s*\(language\)\s*=>\s*verifyPageLink\(url,\s*language\)/.test(AUTH));
  ok("…and the reset link with the language", /link:\s*\(language\)\s*=>\s*withLandingPage\(url,\s*RESET_PAGE,\s*language\)/.test(AUTH));
  ok("…from the same lookup the pages render from", /accountLanguageContext\(/.test(AUTH));
  ok("autoSignInAfterVerification is still off", !/autoSignInAfterVerification:\s*true/.test(AUTH));

  for (const [page, fn] of [["app/verify-email/page.js", "verifyArrivalLanguage"], ["app/reset-password/page.js", "resetArrivalLanguage"]]) {
    const src = code(page);
    ok(`${page} is a server wrapper (no "use client")`, !/"use client"/.test(src));
    ok(`…awaits searchParams (a Promise in Next 16)`, /await searchParams/.test(src));
    ok(`…decides the language with ${fn}`, new RegExp(`${fn}\\(`).test(src));
    ok(`…and renders inside LinkLanguage`, /<LinkLanguage language=\{language\}>/.test(src));
  }
  const INVITE = code("app/accept-invitation/[id]/layout.js");
  ok("the invitation page gets the invitation email's language (layout, awaited params)",
    /await params/.test(INVITE) && /invitationArrivalLanguage\(id\)/.test(INVITE) && /<LinkLanguage/.test(INVITE));
  const LINKLANG = code("app/components/auth/LinkLanguage.js");
  ok("LinkLanguage mounts a nested provider with fromAccount", /<LanguageProvider initialLanguage=\{supported\} fromAccount>/.test(LINKLANG));
  const ALL = code("lib/authLinkLanguage.js");
  ok("the account comes before ?lang= and the session", /read\.email[\s\S]*accountLanguageContext[\s\S]*linkLanguage\(lang\)\s*\|\|\s*\(await sessionLanguage/.test(ALL));
  ok("no magic-link plugin exists to carry the same fault", !/magicLink\(/.test(AUTH));
}

// ══════════════════════════════════════════════════════════════════════════
console.log("\n2. The confirmation says whose address it was, and never crosses accounts");

const SECRET = "check-secret-please-ignore-0123456789";
const sign = (payload, { secret = SECRET, exp = "1h" } = {}) =>
  new SignJWT(payload).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(exp).sign(new TextEncoder().encode(secret));
{
  const good = await readVerifyToken(await sign({ email: "owner.first@gmail.com" }), SECRET);
  ok("a token we signed reads as valid, with its address", good.state === "valid" && good.email === "owner.first@gmail.com", JSON.stringify(good));
  const past = Math.floor(Date.now() / 1000) - 60;
  const expired = await readVerifyToken(await sign({ email: "a@b.co" }, { exp: past }), SECRET);
  ok("an expired token we signed is 'expired' and keeps its address (for the resend box)", expired.state === "expired" && expired.email === "a@b.co", JSON.stringify(expired));
  const forged = await readVerifyToken(await sign({ email: "victim@b.co" }, { secret: "not-ours" }), SECRET);
  ok("a forged token is invalid and names nobody", forged.state === "invalid" && forged.email === null);
  const forgedExpired = await readVerifyToken(await sign({ email: "victim@b.co" }, { secret: "not-ours", exp: past }), SECRET);
  ok("…even when it is also expired (signature is checked first)", forgedExpired.state === "invalid" && forgedExpired.email === null);
  const change = await readVerifyToken(await sign({ email: "a@b.co", updateTo: "c@d.co" }), SECRET);
  ok("a change-of-address token is refused (Better Auth would CREATE a session for it)", change.state === "change_email" && change.email === null);
  for (const junk of ["", "abc", null, 42, "x".repeat(5000)]) {
    ok(`junk token ${JSON.stringify(junk).slice(0, 12)} → invalid`, (await readVerifyToken(junk, SECRET)).state === "invalid");
  }
  ok("no address in the payload → invalid", (await readVerifyToken(await sign({ sub: "x" }), SECRET)).state === "invalid");
}
{
  const FIRST = { id: "igLp", email: "owner.first@gmail.com" };
  const SECOND = { userId: "iKg9", email: "owner.second@gmail.com" };
  // The owner's own click: link for emilio, browser signed in as daniel.
  const his = verifyOutcome({ tokenState: "valid", user: FIRST, wasVerified: false, session: SECOND });
  ok("signed in as another account: confirmed, naming the confirmed address", his.state === "done" && his.email === FIRST.email);
  ok("…and says a DIFFERENT account is signed in, naming it", his.account.relation === "other" && his.account.email === SECOND.email);
  const fresh = verifyOutcome({ tokenState: "valid", user: FIRST, wasVerified: false, session: null });
  ok("fresh device, first click: done, nobody signed in", fresh.state === "done" && fresh.account.relation === "none" && fresh.account.email === null);
  const same = verifyOutcome({ tokenState: "valid", user: FIRST, session: { userId: "igLp", email: FIRST.email } });
  ok("signed in as the owner of the address: 'same'", same.account.relation === "same");
  const second = verifyOutcome({ tokenState: "valid", user: FIRST, wasVerified: true, session: null });
  ok("second click: 'already', still naming the address", second.state === "already" && second.email === FIRST.email);
  ok("already confirmed beats an expired link", verifyOutcome({ tokenState: "expired", user: FIRST, wasVerified: true }).state === "already");
  ok("expired and unconfirmed: 'expired' with the address", verifyOutcome({ tokenState: "expired", user: FIRST }).state === "expired");
  ok("Better Auth refusing a good token is 'invalid', never 'done'", verifyOutcome({ tokenState: "valid", user: FIRST, verifyFailed: true }).state === "invalid");
  ok("a forged token names no address", verifyOutcome({ tokenState: "invalid", user: FIRST }).email === null);
  ok("a token for a deleted user is invalid", verifyOutcome({ tokenState: "valid", user: null }).state === "invalid");
  ok("sessionRelation: no session / same / other", sessionRelation(FIRST, null) === "none" && sessionRelation(FIRST, { userId: "igLp" }) === "same" && sessionRelation(FIRST, SECOND) === "other");

  const ROUTE = code("app/api/verify-email/route.js");
  ok("the route confirms through Better Auth itself", /auth\.api\.verifyEmail\(\{\s*query:\s*\{\s*token\s*\}\s*\}\)/.test(ROUTE));
  ok("…with NO headers, so it cannot touch the browser's session", !/verifyEmail\(\{[^)]*headers/.test(ROUTE));
  ok("…and only for a valid, unconfirmed token", /read\.state === "valid" && !wasVerified/.test(ROUTE));
  ok("it never creates or sets a session", !/createSession|setSessionCookie|signIn/.test(ROUTE));
  ok("it is a POST (a mail scanner's GET confirms nothing)", /export async function POST/.test(ROUTE) && !/export async function GET/.test(ROUTE));

  const PAGE = code("app/verify-email/VerifyEmail.js");
  ok("the page posts the token to the route", /fetch\("\/api\/verify-email"/.test(PAGE));
  ok("…names the confirmed address", /app\.auth\.verify\.confirmedAddress/.test(PAGE));
  ok("…shows the other-account choice", /otherAccount \?/.test(PAGE) && /app\.auth\.verify\.otherSession/.test(PAGE));
  ok("…'Continue as' signs the other account out, then sign-in with the address filled",
    /await signOut\(\)/.test(PAGE) && /\/login\?email=\$\{encodeURIComponent\(confirmedEmail\)\}/.test(PAGE));
  ok("…'Stay signed in as' is the other button", /app\.auth\.switch\.stayAs/.test(PAGE));
  ok("…and a failed exchange is never read as done", /if \(!outcome\?\.state\) \{\s*setState\("invalid"\)/.test(PAGE));
}

// ══════════════════════════════════════════════════════════════════════════
console.log("\n3. A resume link goes to the right door before any step renders");

const TOKEN = "resume-token-0123456789abcdefghijklmnopqrstuv";
const PREFILL = { email: "owner.first@gmail.com", companyName: "Owner The Painter", stepReached: "account", accountExists: false, completed: false };
const FINISHED_LOGIN = { userId: "igLp", emailVerified: true, hasCompany: true, finished: true };
const UNFINISHED_LOGIN = { userId: "igLp", emailVerified: true, hasCompany: false, finished: false };
const UNVERIFIED_LOGIN = { userId: "igLp", emailVerified: false, hasCompany: false, finished: false };
const AS_HIM = { userId: "igLp", email: PREFILL.email };
const AS_OTHER = { userId: "iKg9", email: "owner.second@gmail.com" };
{
  // The row the owner's link carried: stuck on "account" BECAUSE the login exists.
  ok("the old guess (stepReached) says no login for his row — the bug", PREFILL.stepReached === "account" && PREFILL.accountExists === false);

  let r = decideResumeRoute({ prefill: PREFILL, login: FINISHED_LOGIN, session: null, token: TOKEN });
  ok("his case, signed out: sign-in, not the account step", r.action === RESUME_ACTIONS.SIGN_IN && r.to === `/login?resume=${encodeURIComponent(TOKEN)}`, JSON.stringify(r));
  ok("…returning to the app afterwards (his company finished)", r.next === "/app" && r.finished === true);
  r = decideResumeRoute({ prefill: PREFILL, login: FINISHED_LOGIN, session: AS_OTHER, token: TOKEN });
  ok("his case as he actually was — signed in as another account: asked, both named", r.action === RESUME_ACTIONS.SWITCH && r.sessionEmail === AS_OTHER.email && r.to.startsWith("/login?resume="));
  r = decideResumeRoute({ prefill: PREFILL, login: FINISHED_LOGIN, session: AS_HIM, token: TOKEN });
  ok("signed in as him, signup finished: the app", r.action === RESUME_ACTIONS.APP && r.to === "/app");
  r = decideResumeRoute({ prefill: PREFILL, login: UNFINISHED_LOGIN, session: AS_HIM, token: TOKEN });
  ok("signed in as him, signup unfinished: carry on (entry check lands the first unfinished step)", r.action === RESUME_ACTIONS.CONTINUE);
  r = decideResumeRoute({ prefill: PREFILL, login: UNFINISHED_LOGIN, session: null, token: TOKEN });
  ok("signed out, unfinished: sign-in, then back through this link", r.action === RESUME_ACTIONS.SIGN_IN && r.next === `/signup?resume=${encodeURIComponent(TOKEN)}`);
  r = decideResumeRoute({ prefill: PREFILL, login: UNVERIFIED_LOGIN, session: null, token: TOKEN });
  ok("an unconfirmed login is flagged, so sign-in offers the confirmation again", r.action === RESUME_ACTIONS.SIGN_IN && r.verified === false);
  r = decideResumeRoute({ prefill: PREFILL, login: null, session: null, token: TOKEN });
  ok("no login on the address: the account step, as before", r.action === RESUME_ACTIONS.SIGNUP);
  r = decideResumeRoute({ prefill: PREFILL, login: null, session: AS_OTHER, token: TOKEN });
  ok("no login, but someone else signed in: asked first, never signed up on top of them", r.action === RESUME_ACTIONS.SWITCH && r.hasLogin === false && r.to.startsWith("/signup?resume="));
  ok("no prefill (unknown token): nothing to route", decideResumeRoute({ prefill: null, login: FINISHED_LOGIN, session: AS_HIM, token: TOKEN }).action === RESUME_ACTIONS.SIGNUP);

  // The property: the token alone never opens an account. Every combination
  // where the browser is not ALREADY signed in as the address's owner ends at
  // sign-in or a choice — never the app, never "continue".
  let crossed = 0;
  for (const login of [FINISHED_LOGIN, UNFINISHED_LOGIN, UNVERIFIED_LOGIN]) {
    for (const session of [null, AS_OTHER, { userId: "zzz", email: "x@y.z" }]) {
      const out = decideResumeRoute({ prefill: PREFILL, login, session, token: TOKEN });
      if (out.action === RESUME_ACTIONS.APP || out.action === RESUME_ACTIONS.CONTINUE || out.to === "/app") crossed++;
    }
  }
  ok("no signed-out or other-account combination reaches the app on the token alone", crossed === 0, `${crossed} did`);
  ok("safeResumeTarget refuses off-site targets", safeResumeTarget("//evil.com") === null && safeResumeTarget("https://evil.com") === null && safeResumeTarget("/login?resume=x") === "/login?resume=x");

  // loginFromUser: "finished" is hasFinishedSignup's, and it refuses to guess.
  const u = (companies, verified = true) => ({ id: "u", emailVerified: verified, memberships: companies.map((company) => ({ company })) });
  ok("a paying company is finished", loginFromUser(u([{ isDemo: false, trialEndsAt: null, subscription: { id: "s" } }])).finished === true);
  ok("a card-free trial is finished", loginFromUser(u([{ isDemo: false, trialEndsAt: new Date(), subscription: null }])).finished === true);
  ok("a company with neither is not", loginFromUser(u([{ isDemo: false, trialEndsAt: null, subscription: null }])).finished === false);
  ok("a demo company counts for nothing", loginFromUser(u([{ isDemo: true, trialEndsAt: new Date(), subscription: { id: "s" } }])).hasCompany === false);
  let threw = false;
  try { loginFromUser(u([{ isDemo: false, subscription: null }])); } catch { threw = true; }
  ok("an unselected trialEndsAt throws rather than reading a customer as unfinished", threw);
  ok("no user → no login", loginFromUser(null) === null);

  const LEAD_ROUTE = code("app/api/signup/lead/route.js");
  ok("the resume GET reads the User table for the row's address", /db\.user\s*\.findFirst\(\{\s*where:\s*\{\s*email:\s*\{\s*equals:\s*prefill\.email/.test(LEAD_ROUTE));
  ok("…and answers with the route", /decideResumeRoute\(/.test(LEAD_ROUTE) && /route \}/.test(LEAD_ROUTE));
  ok("…corrects accountExists from the fact", /accountExists: true/.test(LEAD_ROUTE));
  ok("…a failed read is NOT 'no login'", /userRow === undefined/.test(LEAD_ROUTE));
  ok("…and never signs anybody in", !/createSession|setSessionCookie|signIn/.test(LEAD_ROUTE));

  const SIGNUP = code("app/signup/page.js");
  const entry = SIGNUP.slice(SIGNUP.indexOf("const [resumeElsewhere"), SIGNUP.indexOf('fetch("/api/signup/resume")'));
  ok("/signup routes a resume link BEFORE its other entry checks", /get\("resume"\)/.test(entry) && /window\.location\.replace\(to\)/.test(entry));
  ok("…holding the steps back while it leaves or asks", /held = true/.test(entry) && /if \(!cancelled && !held\) setEntryChecked\(true\)/.test(SIGNUP));
  ok("…with the two-account choice rendered in place of the form", /resumeElsewhere && \(/.test(SIGNUP) && /handleSignOut\(resumeElsewhere\.to\)/.test(SIGNUP));
  ok("…and only internal targets followed", /safeResumeTarget\(route\?\.to\)/.test(entry));

  const LOGIN = code("app/login/page.js");
  ok("/login reads ?resume= and fills the address", /get\("resume"\)/.test(LOGIN) && /email: d\.prefill\.email/.test(LOGIN));
  ok("…says why (finished vs unfinished, naming the business)", /app\.auth\.login\.resumeFinished/.test(LOGIN) && /app\.auth\.login\.resumeUnfinished/.test(LOGIN));
  ok("…returns to the right place after sign-in", /setNext\(after\)/.test(LOGIN));
  ok("…offers the confirmation again for an unconfirmed login", /sendVerificationEmail\(\{ email: resumeNote\.email \}\)/.test(LOGIN));
  ok("…and the password is still the only key", /signIn\.email\(\{\s*email: form\.email,\s*password: form\.password/.test(LOGIN));
}

// ══════════════════════════════════════════════════════════════════════════
console.log("\n4. The letter goes to nobody who finished — however they finished");

// Production, 2026-09-25 (read-only SELECTs; see the ROADMAP entry).
const T = (iso) => new Date(iso);
const NOW = T("2026-09-25T19:55:44.125Z");
const emilioLead = {
  id: "cmuh4tjll", email: "owner.first@gmail.com", companyName: "Owner The Painter", language: "en",
  stepReached: "account", lastSeenAt: T("2026-09-25T19:46:50Z"), completedCompanyId: null, resumeToken: "r1",
  visitorId: "visitor-A", skipReason: null, trades: [],
};
const halfTyped = {
  id: "cmuh4yb3j", email: "owner.sec@gmail.com", companyName: "Owner The Painter", language: "en",
  stepReached: "account", lastSeenAt: T("2026-09-25T19:48:44Z"), completedCompanyId: null, resumeToken: "r2",
  visitorId: "visitor-B", skipReason: null, trades: [],
};
const painter = {
  id: "cmuh54pjr", name: "Owner The Painter", email: "owner.second@gmail.com", isDemo: false,
  createdAt: T("2026-09-25T19:53:42Z"), trialEndsAt: T("2026-10-25T19:53:42Z"), subscription: null,
  defaultLanguage: "en", industries: ["handyman"], signupLead: { id: "cmuh4yfy8", lastSeenAt: T("2026-09-25T19:53:43Z"), stepReached: "checkout" },
};
const people = [earlyNudgePersonFromLead(emilioLead), earlyNudgePersonFromLead(halfTyped), earlyNudgePersonFromCompany(painter)];
{
  const before = planEarlyNudges({ people, now: NOW });
  ok("the old inputs reproduce the incident: both addresses mailed", before.sends.length === 2 && before.sends.map((s) => s.to).sort().join() === "owner.first@gmail.com,owner.sec@gmail.com", before.sends.map((s) => s.to).join());

  const finishedAddressKeys = new Set(["owner.first@gmail.com"]); // his login's paying "Test Inc."
  const finishedVisitorKeys = new Set([visitorCompanyKey("visitor-B", "Owner The Painter")]);
  const after = planEarlyNudges({ people, finishedAddressKeys, finishedVisitorKeys, now: NOW });
  ok("with the finishes the cron now reads: nobody is mailed", after.sends.length === 0, after.sends.map((s) => s.to).join());
  const why = Object.fromEntries(after.skipped.map((s) => [s.person.email, s.reason]));
  ok("…the first address: the address owns a finished signup", why["owner.first@gmail.com"] === "address_finished", why["owner.first@gmail.com"]);
  ok("…the half-typed address: the same browser finished the same business", why["owner.sec@gmail.com"] === FINISHED_SAME_VISITOR, why["owner.sec@gmail.com"]);

  // Narrowness: a rep's laptop signing up a DIFFERENT business is still followed up.
  const otherBiz = earlyNudgePersonFromLead({ ...halfTyped, id: "x", email: "someone.else@example.org", companyName: "Another Painter Ltd" });
  const rep = planEarlyNudges({ people: [otherBiz], finishedVisitorKeys, now: NOW });
  ok("same browser, different business: still mailed", rep.sends.length === 1);
  ok("visitorCompanyKey folds case and spaces, and needs both halves",
    visitorCompanyKey("v", "  Owner  the PAINTER ") === "v|owner the painter" && visitorCompanyKey("", "x") === null && visitorCompanyKey("v", "") === null);

  // The stamp is read back by both consumers.
  ok("a stamped row reads as completed for the letter", earlyNudgePersonFromLead({ ...halfTyped, skipReason: FINISHED_SAME_VISITOR }).completed === true);
  ok("…and is skipped by the promotion floor", decideSignupLeadPromotion({ lead: { ...halfTyped, skipReason: FINISHED_SAME_VISITOR, phoneE164: "+15555550142" }, now: NOW }).action === "skip");
  ok("…but is NOT 'finished' for the resume read (it created nothing)", signupLeadFinished({ ...halfTyped, skipReason: FINISHED_SAME_VISITOR }) === false);
}
{
  // recordSignupCompletion stamps the siblings — narrowly.
  const writes = [];
  const client = {
    signupLead: {
      findFirst: async () => ({ id: "cmuh4yfy8", prospectId: null, promotedLeadId: null, visitorId: "visitor-B", companyName: "Owner The Painter" }),
      updateMany: async (args) => { writes.push(args); return { count: 1 }; },
    },
    prospect: { upsert: async () => ({ id: "p1" }) },
  };
  await recordSignupCompletion({ client, company: painter, ownerEmail: "owner.second@gmail.com", referred: true, now: NOW });
  const stamp = writes.find((w) => w.data?.skipReason === FINISHED_SAME_VISITOR);
  ok("completing a signup stamps the same browser's other rows for the same business", Boolean(stamp));
  ok("…never the completed row itself", stamp?.where?.id?.not === "cmuh4yfy8");
  ok("…only the same visitor AND the same business name", stamp?.where?.visitorId === "visitor-B" && stamp?.where?.companyName?.equals === "Owner The Painter" && stamp.where.companyName.mode === "insensitive");
  ok("…only rows nobody finished, skipped or promoted", stamp?.where?.completedCompanyId === null && stamp.where.skipReason === null && stamp.where.promotedAt === null);
}
{
  const CRON = code("app/api/cron/signup-recovery/route.js");
  ok("the cron asks which addresses already own a finished signup (paying companies included)",
    /completedSignupWhere\(\)/.test(CRON) && /finishedAddressKeys\(people\.map/.test(CRON));
  ok("…matching the company's address OR a member's login", /members:\s*\{\s*some:\s*\{\s*active: true,\s*user:\s*\{\s*email:/.test(CRON));
  ok("…and which browsers finished the same business", /visitorId: \{ in: visitorIds \}/.test(CRON) && /filter\(signupLeadFinished\)/.test(CRON));
  ok("…passes both to the planner", /finishedAddressKeys: finishedKeys, finishedVisitorKeys/.test(CRON));
  ok("…and re-checks the address against a fresh read right before sending", /await finishedAddressKeys\(\[person\.email\]\)/.test(CRON));
  ok("…selecting the columns the lead shaper now reads", /visitorId: true, skipReason: true/.test(CRON));
}

// ══════════════════════════════════════════════════════════════════════════
console.log("\nEvery new sentence exists in every app language");
const NEW_KEYS = [
  "app.auth.verify.confirmedAddress", "app.auth.verify.alreadyAddress", "app.auth.verify.signedInAs",
  "app.auth.verify.otherSession", "app.auth.verify.otherSessionResend", "app.auth.switch.continueAs",
  "app.auth.switch.stayAs", "app.signup.resumeSwitch.title", "app.signup.resumeSwitch.body",
  "app.auth.login.resumeUnfinished", "app.auth.login.resumeUnfinishedNoName", "app.auth.login.resumeFinished",
  "app.auth.login.unverified", "app.auth.login.resendVerify", "app.auth.login.resentVerify",
];
for (const lang of LANGUAGE_CODES) {
  const dict = APP_MESSAGES[lang] || {};
  const missing = NEW_KEYS.filter((k) => typeof dict[k] !== "string" || !dict[k].trim());
  ok(`${lang}: all ${NEW_KEYS.length} present`, missing.length === 0, missing.join(", "));
  const en = APP_MESSAGES.en;
  const badSlots = NEW_KEYS.filter((k) => {
    const want = (en[k].match(/\{\w+\}/g) || []).sort().join();
    const got = (String(dict[k] || "").match(/\{\w+\}/g) || []).sort().join();
    return want !== got;
  });
  ok(`${lang}: same {placeholders} as English`, badSlots.length === 0, badSlots.join(", "));
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
