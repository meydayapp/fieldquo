// scripts/check-auth-recovery.mjs
//
// Until this landed there was NO password reset. No hook, no page, no route,
// no link on sign-in — and because auth is self-hosted there is no vendor to
// call either. A contractor who forgot their password was locked out of their
// own business permanently, and the only way back in was someone editing the
// database by hand.
//
// Better Auth had shipped all of it for years. Nothing was missing; nothing
// was ever turned on.
//
// Run: node --import ./scripts/alias-loader.mjs scripts/check-auth-recovery.mjs

import { resetPasswordEmail, verifyEmail, AUTH_EMAIL_LANGUAGES } from "@/lib/email/authEmails";
import { readFileSync } from "node:fs";

let fail = 0;
const t = (name, got, want = true) => {
  const ok = String(got) === String(want);
  if (!ok) fail++;
  console.log(`${ok ? "  ok  " : "  FAIL"} ${name}${ok ? "" : `  got=${got} want=${want}`}`);
};
const read = (r) => readFileSync(new URL(r, import.meta.url), "utf8");
// Comments in these files DISCUSS the failure modes by name, so a naive scan
// reports the documentation as the defect. Only executing lines are searched.
const code = (r) =>
  read(r)
    .split("\n")
    .filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*"))
    .join("\n");

const AUTH = read("../lib/auth.js");
const CLIENT = read("../lib/auth-client.js");
const FORGOT = code("../app/forgot-password/page.js");
const RESET = code("../app/reset-password/page.js");
const VERIFY = code("../app/verify-email/page.js");
const LOGIN = read("../app/login/page.js");

console.log("\nThe three capabilities are actually configured");
t("password reset has a send hook", /sendResetPassword/.test(AUTH));
t("email verification has one too", /sendVerificationEmail/.test(AUTH));
t("the two-factor plugin is mounted", /twoFactor\(/.test(AUTH));
// A reset is what you do when you think the account is no longer yours.
// Leaving old sessions alive leaves the intruder signed in.
t("resetting revokes existing sessions", /revokeSessionsOnPasswordReset:\s*true/.test(AUTH));

console.log("\nThe email says the same expiry the token actually has");
// Two constants would drift, and the email would be the one that's wrong.
t("expiry is passed to the email, not hardcoded twice", /expiresMinutes/.test(AUTH));
t("the token TTL and the sentence share a source",
  /RESET_LINK_MINUTES|VERIFY_LINK_MINUTES/.test(AUTH));

console.log("\nEnumeration safety — the whole point of this page");
// The moment the hit and miss cases render differently, the form stops being a
// password reset and becomes a tool for asking whether a given contractor uses
// FieldQuo.
for (const [label, src] of [["forgot-password", FORGOT], ["verify-email", VERIFY]]) {
  t(`${label} has no "no account" branch`,
    !/no account (found|exists)|not registered|isn't registered|doesn't exist|unknown email/i.test(src));
}
const MSGS = read("../app/i18n/appMessages.js");
t("the confirmation is conditional by construction",
  /If that address has an account/.test(MSGS));
t("...and the resend copy matches it", /If that address still needs confirming/.test(MSGS));

console.log("\nThe feature is reachable");
// A reset flow with no link on the sign-in page is the dead control this repo
// keeps being swept for — and the one user who needs it cannot navigate to it.
t("sign-in links to it", /forgot-password/.test(LOGIN));

console.log("\nThe client exports the names the pages call");
// authClient is a PROXY: any name type-checks, autocompletes, and returns a
// callable that 404s at runtime. Destructuring is what turns a typo into an
// import error instead of a failure in front of a locked-out contractor.
for (const name of ["requestPasswordReset", "resetPassword", "sendVerificationEmail", "verifyEmail"]) {
  t(`${name} is destructured`, new RegExp(`\\b${name}\\b`).test(CLIENT));
}
// The 1.6 rename. There is no /forget-password route any more.
t("the old forgetPassword name is aliased, not left to 404", /forgetPassword\s*=/.test(CLIENT));

console.log("\nUnhappy arrivals are handled, not blank");
t("reset handles a missing token", /token/.test(RESET));
t("reset handles an error in the query", /error/.test(RESET));
t("reset cannot be double-submitted", /disabled=\{submitting\}|submitting/.test(RESET));
t("verify handles an expired token", /TOKEN_EXPIRED/.test(VERIFY));
t("verify handles an already-confirmed address", /ALREADY_VERIFIED/.test(VERIFY));

console.log("\nThe emails themselves");
t("six languages", AUTH_EMAIL_LANGUAGES.length, 6);
for (const lang of AUTH_EMAIL_LANGUAGES) {
  const r = resetPasswordEmail({ url: "https://x/y?token=T", userName: "E", language: lang, company: { name: "C" }, expiresMinutes: 60 });
  const v = verifyEmail({ url: "https://x/y?token=T", userName: "E", language: lang, company: { name: "C" }, expiresMinutes: 1440 });
  t(`${lang}: both render with a subject and a body`,
    Boolean(r.subject && r.html && r.text && v.subject && v.html && v.text));
}
const en = resetPasswordEmail({ url: "https://x/y?token=SEKRIT", userName: "E", language: "en", company: { name: "C" }, expiresMinutes: 60 });
t("the token never reaches the subject line", !en.subject.includes("SEKRIT"));
t("it says what to do if you didn't ask for it",
  /wasn't you|did not request|didn't request/i.test(en.text));
// A dead button in a reset email is a lockout with extra steps, and the
// realistic cause is a misconfigured BETTER_AUTH_URL — which should be loud.
for (const bad of ["", "javascript:alert(1)", "data:text/html,x"]) {
  let threw = false;
  try { resetPasswordEmail({ url: bad, userName: "E", language: "en", company: {} }); } catch { threw = true; }
  t(`an unusable url (${JSON.stringify(bad).slice(0, 20)}) throws rather than sending`, threw);
}

console.log("\nRate limiting — reset is a weapon pointed at a third party");
// The default 3/minute is 180 messages an hour at someone who never signed up,
// on FieldQuo's sending reputation.
t("both endpoints are rate limited beyond the default", /customRules/.test(AUTH));

console.log(fail ? `\n${fail} FAILED\n` : "\nALL PASS — a locked-out contractor can get back in\n");
process.exit(fail ? 1 : 0);
