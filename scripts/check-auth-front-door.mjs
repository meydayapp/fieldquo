// scripts/check-auth-front-door.mjs
//
//   npm run check:auth-front-door
//
// The six pages a person meets before they have an account: /login, /signup,
// /forgot-password, /reset-password, /verify-email and /accept-invitation/[id].
// scripts/check-auth-pages.mjs already owns the first two as a redesign gate
// and check-auth-recovery.mjs owns the middle three as a "the reset flow is
// wired at all" gate. This one owns the three things NEITHER of them looks at:
//
//   1. a failed sign-in produces a SENTENCE, chosen by shape, never the
//      vendor's own English `error.message`;
//   2. /accept-invitation can tell "there is no such invitation" from "we
//      could not ask" — the bug that made it a permanent spinner;
//   3. the accept SCREEN and the accept ROUTE admit the same statuses.
//
// ══ Executed where it can be, and honest where it can't ═══════════════════
//
// The two decisions above are pure functions on purpose (lib/authErrors.js,
// lib/invitations/arrival.js) so this file runs the whole matrix rather than
// agreeing with the source about what it probably does. The remaining source
// assertions are read COMMENT-STRIPPED, because every failure named here is
// also discussed at length in those files' headers and a raw read would find
// the documentation and call it the defect.
//
// Run: node --import ./scripts/alias-loader.mjs scripts/check-auth-front-door.mjs

import { readFileSync } from "node:fs";
import {
  signInErrorKey,
  signInErrorText,
  SIGN_IN_ERROR_KEYS,
  SIGN_IN_ERROR_EN,
} from "@/lib/authErrors";
import {
  inviteArrival,
  inviteUsability,
  ACCEPTABLE_INVITATION_STATUSES,
} from "@/lib/invitations/arrival";

let pass = 0;
const fails = [];
// Label FIRST. The reversed form — ok(condition, label) — makes a non-empty
// string the condition and can never fail; that false-pass has burned agents
// in this repo, so the argument order is stated here where it is read.
const ok = (label, cond, detail) => {
  if (cond) {
    pass++;
    console.log(`  ok   ${label}`);
  } else {
    fails.push(label);
    console.log(`  FAIL ${label}${detail !== undefined ? `  — ${detail}` : ""}`);
  }
};

const read = (p) => readFileSync(p, "utf8");
// Block comments and line comments blanked. These files EXPLAIN the bugs they
// fixed by quoting the broken code, so `.then((r) => r.json())` appears in
// prose in more than one header.
const code = (p) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const LOGIN = code("app/login/page.js");
const ACCEPT = code("app/accept-invitation/[id]/page.js");
const ACCEPT_ROUTE = code("app/api/invitations/[id]/accept/route.js");
const INVITE_ROUTE = code("app/api/invitations/[id]/route.js");
const FORGOT = code("app/forgot-password/page.js");
const RESET = code("app/reset-password/page.js");
const VERIFY = code("app/verify-email/page.js");
const SIGNUP = code("app/signup/page.js");

// ══════════════════════════════════════════════════════════════════════════
console.log("\nA failed sign-in reads as what it is, not as Better Auth's English");

// The exact shapes Better Auth's react client hands back. Rate limiting is not
// hypothetical: its own default rule for /sign-in/email is 3 requests per 10
// seconds, so a contractor trying a password they half-remember reaches it on
// the third go — and being told the password is wrong at that moment is
// actively false, because the next attempt would have worked.
const MATRIX = [
  [{ code: "INVALID_EMAIL_OR_PASSWORD", status: 401 }, "credentials"],
  [{ status: 401 }, "credentials"],
  [{ status: 403 }, "credentials"],
  [{ code: "USER_NOT_FOUND", status: 404 }, "credentials"],
  [{ status: 429 }, "throttled"],
  [{ code: "TOO_MANY_REQUESTS" }, "throttled"],
  [{ status: 500 }, "unreachable"],
  [{ status: 502 }, "unreachable"],
  // A fetch that never landed: better-auth resolves with an error carrying no
  // status at all. Number(undefined) is NaN, but Number(null) is 0 and 0 is
  // finite — the trap that has produced four live bugs in this repo — so both
  // are in the matrix.
  [{ message: "Failed to fetch" }, "unreachable"],
  [{ status: null }, "unreachable"],
  [{ status: undefined }, "unreachable"],
  [{}, "unreachable"],
];
for (const [err, want] of MATRIX) {
  const got = signInErrorKey(err);
  ok(
    `${JSON.stringify(err)} → ${want}`,
    got === SIGN_IN_ERROR_KEYS[want],
    got,
  );
}
// The one input that must NOT produce an error box. A page that renders a red
// banner on success is worse than one that renders none on failure.
ok("no error → no key", signInErrorKey(null) === null && signInErrorKey(undefined) === null);
ok("...and no sentence", signInErrorText((k) => k, null) === "");

// Three DISTINCT sentences, or the mapping above is decoration.
{
  const seen = new Set(Object.values(SIGN_IN_ERROR_KEYS).map((k) => SIGN_IN_ERROR_EN[k]));
  ok("the three outcomes are three different sentences", seen.size === 3, `${seen.size}`);
  for (const [name, key] of Object.entries(SIGN_IN_ERROR_KEYS)) {
    const en = SIGN_IN_ERROR_EN[key];
    ok(`${name} has an English fallback`, typeof en === "string" && en.length > 20, en);
    // t() falls back to the KEY when nothing else resolves. A fallback that IS
    // the key would render "app.auth.login.errorThrottled" in a red box.
    ok(`...that is not the key itself`, en !== key);
  }
  // The gated namespace. "auth.login.*" belonged to no catalogue at all — not
  // the marketing one in messages.js, not the app one gated by
  // check-translations.mjs — so it rendered its English fallback in every
  // language and no coverage report could see it.
  for (const key of Object.values(SIGN_IN_ERROR_KEYS)) {
    ok(`${key} is in the gated app.* namespace`, key.startsWith("app."));
  }
}

// signInErrorText must go THROUGH t, so the sentence is translatable rather
// than a constant with a translation-shaped wrapper around it. Proved by
// handing it a translator that marks what it was asked for.
{
  const marked = signInErrorText((key, fallback) => `T:${key}:${fallback}`, {
    status: 429,
  });
  ok("the sentence is resolved through t()", marked.startsWith(`T:${SIGN_IN_ERROR_KEYS.throttled}:`), marked);
}

console.log("\n...and neither page renders the vendor string");
// `.message` reaching setError is the whole defect. /accept-invitation is
// allowed ONE use of it — the "already exists" sniff, which reads the message
// to decide which FORM to show and never displays it — so this is anchored to
// the render, not to the word.
for (const [name, src] of [["/login", LOGIN], ["/accept-invitation", ACCEPT]]) {
  ok(`${name} never sets an error from error.message`,
    !/setError\([^)]*\.message/.test(src));
}
ok("/login asks lib/authErrors for the sentence", /signInErrorText\(t,/.test(LOGIN));
ok("/accept-invitation asks the same helper", /signInErrorText\(t,/.test(ACCEPT));
// The enumeration guarantee /forgot-password's header is built around, applied
// to the sign-in form: one sentence for "no such account" and "wrong password".
ok("the credentials sentence names neither half",
  !/email (is|was) not|no account|not registered/i.test(SIGN_IN_ERROR_EN[SIGN_IN_ERROR_KEYS.credentials]));

// ══════════════════════════════════════════════════════════════════════════
console.log("\n/accept-invitation can tell 'no such invitation' from 'we couldn't ask'");

const ARRIVALS = [
  // The fetch itself never resolved — offline, DNS, a hung Neon cold start.
  [null, "unavailable"],
  [undefined, "unavailable"],
  // A real 404 from the route: the ONE case that is about the link.
  [{ ok: false, status: 404, body: { error: "Invitation not found" } }, "notFound"],
  // A 500. In Next this is an HTML page, so body is null after the json catch —
  // which is exactly the shape that used to throw out of the effect and leave
  // the page on "Loading…" forever.
  [{ ok: false, status: 500, body: null }, "unavailable"],
  [{ ok: false, status: 502, body: null }, "unavailable"],
  // A 200 that is somehow not an invitation.
  [{ ok: true, status: 200, body: null }, "unavailable"],
  [{ ok: true, status: 200, body: { error: "nope" } }, "unavailable"],
  // The good one.
  [{ ok: true, status: 200, body: { email: "a@b.c", orgName: "Acme", status: "pending" } }, "ready"],
];
for (const [res, want] of ARRIVALS) {
  const got = inviteArrival(res);
  ok(`${JSON.stringify(res)} → ${want}`, got === want, got);
}
// The distinction is the point: if these two ever collapse into one screen the
// page is back to telling somebody with a good link that it doesn't exist.
ok("a 404 and a 500 are not the same screen",
  inviteArrival({ ok: false, status: 404, body: {} }) !==
    inviteArrival({ ok: false, status: 500, body: null }));

console.log("\n...and the load cannot throw its way back into a permanent spinner");
// Both catches. The fetch's, and the json parse's — an HTML 500 body rejects
// r.json(), and that rejection is what escaped the effect before.
//
// Sliced, not regexed, and the mutation test is why. The first version used
// `[\s\S]{0,400}?\.catch\(`: delete the invitation fetch's catch and the lazy
// run walked on to the SESSION probe's catch a few lines below, so the check
// passed against the exact bug it exists to catch. Tempering the run against
// `fetch(` fixed that and exposed a second hole — the invitation fetch's own
// `.then` contains `await r.json().catch(() => null)` INSIDE it, which the run
// reached instead. So: take the text from this call up to the NEXT fetch, drop
// the inner json guard (asserted separately, just below), and look there.
//
// A third hole, found the same way: the session probe is the LAST fetch in the
// function, so "up to the next fetch(" ran on into handleSubmit and found the
// signUp call's catch. A hard window as well as the fetch boundary — a promise
// chain's own .catch is within a couple of lines of the call it guards, and
// anything further away is guarding something else.
function catchesOwnFailure(src, startMarker, window = 260) {
  const i = src.indexOf(startMarker);
  if (i < 0) return false;
  const rest = src.slice(i + startMarker.length, i + startMarker.length + window);
  const next = rest.indexOf("fetch(");
  const region = (next >= 0 ? rest.slice(0, next) : rest).replace(
    /\.json\(\)\.catch\([^)]*\)/g,
    "",
  );
  return /\.catch\(/.test(region);
}
ok("the invitation fetch has a .catch",
  catchesOwnFailure(ACCEPT, "fetch(`/api/invitations/${id}`)"));
ok("...and r.json() has its own", /r\.json\(\)\.catch\(/.test(ACCEPT));
ok("the session probe has one too",
  catchesOwnFailure(ACCEPT, 'fetch("/api/auth/get-session")'));
ok("the accept POST has one",
  catchesOwnFailure(ACCEPT, "fetch(`/api/invitations/${id}/accept`"));
ok("the unavailable screen offers a retry", /app\.invite\.retry/.test(ACCEPT));
ok("...wired to the loader, not to a state reset", /onClick=\{loadInvite\}/.test(ACCEPT));
// Every dead end carries the way out — the rule reset-password's DeadEnd
// states. The old page's two cards had no link on them at all.
ok("every dead end links back to sign-in", /app\.auth\.backToSignIn/.test(ACCEPT));

console.log("\nThe screen and the gate admit the same statuses");
ok("the shared list is pending + accepted",
  ACCEPTABLE_INVITATION_STATUSES.join(",") === "pending,accepted",
  ACCEPTABLE_INVITATION_STATUSES.join(","));
ok("the accept ROUTE gates on it", /ACCEPTABLE_INVITATION_STATUSES/.test(ACCEPT_ROUTE));
ok("the accept PAGE decides from the same module", /inviteUsability\(/.test(ACCEPT));
ok("...and no longer hardcodes 'canceled' on its own", !/=== "canceled"/.test(ACCEPT));
for (const [invite, want] of [
  [{ status: "pending" }, "usable"],
  [{ status: "accepted" }, "usable"],
  [{ status: "PENDING" }, "usable"],
  [{ status: "canceled" }, "cancelled"],
  [{ status: "rejected" }, "cancelled"],
  // Better Auth could grow a fifth status tomorrow. Unknown must land on the
  // refusal, not on a form the route will turn down.
  [{ status: "something-new" }, "cancelled"],
  [{ status: "" }, "cancelled"],
  [null, "cancelled"],
  // Expiry beats status: an expired invitation is still "pending", and
  // "this expired" is the sentence that tells them a new link will work.
  [{ status: "pending", expired: true }, "expired"],
  // A MISSING `expired` must not read as expired. Absence of a statement is
  // not a statement — the padding-defaults failure, applied to a boolean.
  [{ status: "pending" }, "usable"],
  [{ status: "pending", expired: false }, "usable"],
]) {
  const got = inviteUsability(invite);
  ok(`${JSON.stringify(invite)} → ${want}`, got === want, got);
}

// ══════════════════════════════════════════════════════════════════════════
console.log("\nThe role on screen is the role the route writes");
// invitation.role only ever holds Better Auth's admin/member — the invite
// routes map admin/supervisor/employee down to that pair and stash the real
// one on PendingTeamProfile, which the accept route reads back. The page used
// to print invitation.role, so somebody about to be made a Manager read "as
// member".
ok("the GET route resolves the pending profile's role", /pendingTeamProfile\.findUnique/.test(INVITE_ROUTE));
ok("...the same way the accept route does", /pendingTeamProfile\.findUnique/.test(ACCEPT_ROUTE));
ok("...and labels it rather than shipping the enum", /ROLE_LABELS\[/.test(INVITE_ROUTE));
ok("the page renders the label, never the raw role", /invite\.roleLabel/.test(ACCEPT) && !/\{invite\.role\}/.test(ACCEPT));

// ══════════════════════════════════════════════════════════════════════════
console.log("\nOne field style across all six pages");
// fieldStyles.js's own header says the copy is the one that rots, and it was
// right: three of these pages carried their own `inputClass` with no focus
// state, no --destructive and no dark values, while /login and /signup used
// the shared one.
const PAGES = [
  ["app/login/page.js", LOGIN],
  ["app/signup/page.js", SIGNUP],
  ["app/forgot-password/page.js", FORGOT],
  ["app/reset-password/page.js", RESET],
  ["app/verify-email/page.js", VERIFY],
  ["app/accept-invitation/[id]/page.js", ACCEPT],
];
for (const [name, src] of PAGES) {
  ok(`${name} imports the shared styles`,
    /from "@\/app\/components\/auth\/fieldStyles"/.test(src));
  ok(`...and declares no inputClass of its own`, !/\bconst inputClass\s*=/.test(src));
}

console.log("\nEvery field a thumb hits is labelled and 44px");
// htmlFor/id: tapping the word "Email" on a phone did nothing on four of these
// six pages, and a screen reader read the boxes as unlabelled.
//
// Asserted from the INPUT end rather than the label end, because a <label> that
// WRAPS its control needs no htmlFor and is not a defect — /signup's two
// billing-interval radios are exactly that, and flagging them would be the
// check being wrong about correct markup. Radios and checkboxes are therefore
// excluded here and covered by the label rule below.
for (const [name, src] of PAGES) {
  const inputs = (src.match(/<input\b[^>]*>/g) || []).filter(
    (tag) => !/type="(radio|checkbox)"/.test(tag),
  );
  const anonymous = inputs.filter((tag) => !/\bid=/.test(tag));
  ok(`${name}: every text field carries an id (${inputs.length} fields)`,
    anonymous.length === 0,
    `${anonymous.length} without one`);
}
// ...and the label end, for the styled labels that sit ABOVE a field rather
// than wrapping one. Exactly one is allowed to have no htmlFor, and it is
// named: /signup's Address label sits over AddressAutocomplete, which renders
// Google's own input and takes no `id` — a label pointing at an id nothing
// carries is a control that looks wired and is not, so the fix belongs in that
// component. Allowing "one somewhere" would let a new bare label take its
// place, so the allowance is pinned to the file AND to the word above it.
for (const [name, src] of PAGES) {
  const bare = (src.match(/<label className=\{FIELD_LABEL\}>[\s\S]{0,40}?</g) || []);
  if (name === "app/signup/page.js") {
    ok(`${name}: the only unpointed label is Address`,
      bare.length === 1 && /Address/.test(bare[0]),
      bare.join(" | "));
  } else {
    ok(`${name}: no label sits over a field it doesn't point at`,
      bare.length === 0,
      bare.join(" | "));
  }
}
// py-2.5 with text-sm is a 40px target. PRIMARY_BUTTON is py-3, which is 44.
// Anchored to the class string rather than to the button, because the failure
// is the class.
for (const [name, src] of PAGES) {
  ok(`${name}: no 40px primary action left`, !/py-2\.5 rounded-lg text-sm font-semibold/.test(src));
}

// ══════════════════════════════════════════════════════════════════════════
console.log("\nNo user-visible string is left outside a gated namespace");
// The specific rot this pass found: t("auth.login.title", "Welcome back")
// resolved against no catalogue at all, so the English fallback shipped in all
// eight languages and check-translations.mjs — which scans for "app.*" — could
// not see any of them. Anchored to the OLD prefixes so a revert fails here.
for (const [name, src] of [["/login", LOGIN], ["/signup", SIGNUP]]) {
  ok(`${name} has no ungated "auth." key left`, !/["']auth\.(login|signup)\./.test(src));
}
// The counterpart: the keys are actually asked for. A page that stopped calling
// t() entirely would satisfy the negative above.
ok("/login asks for app.auth.login.* keys", /["']app\.auth\.login\./.test(LOGIN));
ok("/signup asks for app.signup.* keys", /["']app\.signup\./.test(SIGNUP));
ok("/accept-invitation asks for app.invite.* keys", /["']app\.invite\./.test(ACCEPT));
// The invitation page was English top to bottom — twenty-odd hardcoded
// sentences on the screen every employee after the first one meets.
{
  const calls = (ACCEPT.match(/\bt\(\s*["']app\./g) || []).length;
  ok("...and enough of them to have covered the page", calls >= 20, `${calls}`);
}

// ══════════════════════════════════════════════════════════════════════════
if (fails.length) {
  console.log(`\n${fails.length} FAILED of ${pass + fails.length}\n`);
  for (const f of fails) console.log(`  · ${f}`);
  console.log("");
  process.exit(1);
}
console.log(`\nALL PASS (${pass}) — the front door says what happened and offers a way through\n`);
