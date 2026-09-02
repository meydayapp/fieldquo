// scripts/check-auth-pages.mjs
//
//   npm run check:auth-pages
//
// The two pages a prospect meets first and a customer meets every morning.
//
// ══ Why a redesign needs a check at all ════════════════════════════════════
//
// /login is 130 lines and nothing much can go wrong in it. /signup is 1,800,
// and behind them sit a multi-step funnel with a saved draft, a plan step
// deliberately placed LAST so the business address decides the currency,
// ?tier= / ?plan= resolution across two currencies, a seat cap, a country the
// ladder may not price, and a Stripe checkout. All of that is invisible from
// the outside — which is exactly why a purely visual change is the dangerous
// kind. Move eleven inputs into a new component and bind one of them to the
// wrong key and the form still looks finished, still submits, and quietly
// posts an empty company name.
//
// So this file pins what a redesign silently breaks, and nothing else. It does
// not have opinions about spacing.
//
// ══ Executed, not regexed ══════════════════════════════════════════════════
//
// An agent working in this repo this session had seventy-five source
// assertions pass green against a page that had stopped calling the function
// they all tested; the same failure is recorded in the header of
// check-pricing-page.mjs. So the field table below is built by WALKING the
// element tree the shipped AccountFields returns and FIRING every onChange it
// carries, and the two pages are put through react-dom/server. A regex sees
// characters; a render sees the page.
//
// Two things are deliberately read as source rather than executed, and it is
// worth saying which and why:
//
//   · the /api/companies request body. Executing handleFinish means a network
//     call and a Stripe redirect. The body is a literal in one place, its key
//     set is the contract, and reading it is the honest way to pin a payload
//     this check must not send.
//   · app/globals.css, for the two theme blocks. It is a stylesheet; there is
//     nothing to execute.
//
// ══ Dark mode on these routes ══════════════════════════════════════════════
//
// ThemeProvider's isThemeablePath allow-list covers /app and /platform only, so
// /login and /signup render light whatever the visitor's OS says. That is
// deliberate — a stranger comparing three contractors must not be handed a dark
// page — and it is also why "this colour has no dark value" and "this route
// never goes dark" look identical from a screenshot. The colour section below
// proves which one this is: every token these pages paint with is defined under
// BOTH :root and .dark, and no element carries a `dark:` colour without a base
// one under it.
//
// Run (esbuild first — these are JSX client components, which plain node
// cannot parse, and useRouter throws outside a Next request):
//   npx esbuild scripts/check-auth-pages.mjs --bundle --platform=node \
//     --format=cjs --jsx=automatic --loader:.js=jsx --alias:@=. \
//     --alias:next/navigation=./scripts/stub-next-navigation.js \
//     --outfile=.auth-pages.cjs && node .auth-pages.cjs

import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { LanguageProvider } from "@/app/providers/LanguageProvider";
import {
  STEPS,
  firstStep,
  nextStep,
  previousStep,
  furthestStep,
} from "@/lib/signup/funnel";
import LoginPage from "@/app/login/page";
import SignupPage, { AccountFields } from "@/app/signup/page";
import AuthShell from "@/app/components/auth/AuthShell";
import AuthAside from "@/app/components/auth/AuthAside";
import SignupSteps, { rungsFor } from "@/app/components/auth/SignupSteps";
import { INDUSTRIES } from "@/app/data/industries";

let pass = 0;
const fails = [];
const ok = (label, cond, detail) => {
  if (cond) {
    pass++;
    console.log(`  ✓ ${label}`);
  } else {
    fails.push(`${label}${detail !== undefined ? ` — ${detail}` : ""}`);
    console.log(`  ✗ ${label}${detail !== undefined ? ` — ${detail}` : ""}`);
  }
  return !!cond;
};

const read = (p) => readFileSync(p, "utf8");
// Comments are where this repo explains itself, and they name every phrase the
// claims section looks for — "no credit card", "QuickBooks" and the rest are
// all discussed in the components' own headers. Stripping them is the
// difference between "the panel claims a mobile app" and "the panel explains
// why it must not".
const code = (p) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const inEnglish = (node) =>
  renderToStaticMarkup(
    createElement(LanguageProvider, { initialLanguage: "en" }, node),
  );

/** Markup → the words a visitor reads. React writes an apostrophe as `&#x27;`
 *  and an em dash as `—`; comparing raw markup against typed sentences would
 *  quietly never match, and a check that never matches passes for the wrong
 *  reason. */
const textOf = (html) =>
  html
    .replace(/<[^>]*>/g, " ")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// ══════════════════════════════════════════════════════════════════════════
console.log("\nThe pages render at all");
// The cheapest assertion here and the one that catches the most: a client
// component that throws in react-dom/server throws in the browser too.
let loginHtml = "";
let signupHtml = "";
try {
  loginHtml = inEnglish(createElement(LoginPage));
} catch (err) {
  loginHtml = "";
  fails.push(`/login threw while rendering — ${err.message}`);
}
try {
  signupHtml = inEnglish(createElement(SignupPage));
} catch (err) {
  signupHtml = "";
  fails.push(`/signup threw while rendering — ${err.message}`);
}
ok("/login produces markup", loginHtml.length > 500, `${loginHtml.length} chars`);
ok("/signup produces markup", signupHtml.length > 500, `${signupHtml.length} chars`);
// Signup's FIRST render is the entry-check placeholder — nothing may render
// until we know whether this visitor already has a login, or a create-a-password
// form flashes at somebody who is already signed in. That is by design, and it
// is why the field table below is built from AccountFields rather than from
// this markup.
ok(
  "...opening on the entry-check placeholder, not on a form",
  textOf(signupHtml).includes("Getting things ready"),
);

// ══════════════════════════════════════════════════════════════════════════
console.log("\nThe desktop layout the owner asked for is actually there");
// "A little plain, specially on the web" was the complaint, and the fix was a
// second column. A future tidy-up that drops it would leave the mobile view
// perfect and put the desktop page back where it started.
for (const [page, html] of [
  ["/login", loginHtml],
  ["/signup", signupHtml],
]) {
  ok(`${page} is two columns above lg`, /lg:grid-cols-\[/.test(html));
  ok(
    `${page} keeps the form FIRST in the DOM`,
    html.indexOf("hero-quotes") === -1 ||
      html.indexOf("lg:sticky") > html.indexOf("lg:grid-cols-["),
  );
}
// The proof panel carries a real screenshot of a real screen, the same one the
// homepage hero opens on. A panel of adjectives would have been easier.
ok("/login shows the product, not a gradient", loginHtml.includes("hero-quotes"));
ok("/signup shows it too", signupHtml.includes("hero-quotes"));

// ══════════════════════════════════════════════════════════════════════════
console.log("\nEvery field the account step collects, still bound to its key");
//
// The table below is the contract: eleven controls, in this order, each reading
// AND writing one named key of `form`. It is built by walking the element tree
// the shipped component returns and firing each onChange with a sentinel, so it
// describes the component rather than a memory of it.
//
// Both halves matter. Reading proves the field SHOWS what state holds; writing
// proves a keystroke lands in the same place. AGENTS.md's first recurring
// failure class is a field written and never read, or read and never written —
// and a redesign that moves eleven inputs into a new file is exactly how one
// arrives.
const BASE_FORM = {
  firstName: "F-first",
  lastName: "F-last",
  email: "F-email",
  password: "F-password",
  companyName: "F-company",
  phone: "F-phone",
  address: "F-address",
  city: "F-city",
  province: "F-province",
  language: "F-language",
  country: "F-country",
};

// Components declared in app/signup/page.js are expanded; anything else is a
// leaf whose props are still inspectable. AddressAutocomplete in particular
// must NOT be expanded — it calls useLoadScript, and hooks outside React throw.
const OURS = new Set(["AccountFields", "CompanyFields"]);

function walk(node, out) {
  if (node == null || typeof node === "boolean" || typeof node === "number")
    return;
  if (Array.isArray(node)) {
    for (const child of node) walk(child, out);
    return;
  }
  if (typeof node === "string") return;
  const { type, props = {} } = node;
  if (typeof type === "function") {
    if (OURS.has(type.name)) {
      walk(type(props), out);
      return;
    }
    out.push({ tag: type.name || "Component", host: false, props });
    return;
  }
  if (typeof type === "string") out.push({ tag: type, host: true, props });
  walk(props.children, out);
}

const flat = [];
let writtenKeys = null;
const spyForm = (arg) => {
  const next = typeof arg === "function" ? arg(BASE_FORM) : arg;
  writtenKeys = Object.keys(next).filter((k) => next[k] !== BASE_FORM[k]);
};
walk(
  createElement(AccountFields, {
    form: BASE_FORM,
    setForm: spyForm,
    fieldErrors: {},
  }),
  flat,
);

// A control is whatever the label above it labels: a host input/select, or the
// Places component that renders one of its own.
const isControl = (n) =>
  (n.host && (n.tag === "input" || n.tag === "select")) ||
  n.tag === "AddressAutocomplete";

const fields = [];
let pendingLabel = null;
for (const node of flat) {
  if (node.host && node.tag === "label") {
    const kids = node.props.children;
    pendingLabel = typeof kids === "string" ? kids.trim() : String(kids).trim();
    continue;
  }
  if (!isControl(node)) continue;
  fields.push({ label: pendingLabel, node });
  pendingLabel = null;
}

/** Fire this control's onChange and report which key of `form` moved. */
function keyWrittenBy(node) {
  const handler = node.props.onChange;
  if (typeof handler !== "function") return null;
  writtenKeys = null;
  // AddressAutocomplete's onChange takes the address string; a host input's
  // takes an event. Handing the wrong shape to either would throw, which is
  // itself a useful thing for this to notice.
  handler(node.host ? { target: { value: "5551234567" } } : "5551234567");
  return writtenKeys && writtenKeys.length === 1 ? writtenKeys[0] : writtenKeys;
}

// label, the key it is bound to, and whether it is typed in or filled from the
// address. City and Province are read-only on purpose: they come from the
// Google place, and a contractor who could type them by hand could disagree
// with the address that decides his billing currency.
const EXPECTED = [
  ["First name", "firstName", "typed"],
  ["Last name", "lastName", "typed"],
  ["Email", "email", "typed"],
  ["Company name", "companyName", "typed"],
  ["Phone", "phone", "typed"],
  ["Address", "address", "typed"],
  ["City", "city", "readonly"],
  ["Province", "province", "readonly"],
  ["Country", "country", "typed"],
  ["Language", "language", "typed"],
  ["Password", "password", "typed"],
];

ok(
  `the account step still renders exactly ${EXPECTED.length} controls`,
  fields.length === EXPECTED.length,
  `${fields.length}`,
);
ok(
  "...in the same order, under the same labels",
  fields.map((f) => f.label).join(" | ") ===
    EXPECTED.map(([label]) => label).join(" | "),
  fields.map((f) => f.label).join(" | "),
);

for (const [label, key, kind] of EXPECTED) {
  const found = fields.find((f) => f.label === label);
  if (!found) {
    ok(`"${label}" is still on the form`, false);
    continue;
  }
  ok(`"${label}" READS form.${key}`, found.node.props.value === BASE_FORM[key], String(found.node.props.value));
  if (kind === "readonly") {
    ok(`"${label}" stays filled from the address, not typed`, found.node.props.readOnly === true);
    ok(`...so it writes nothing`, typeof found.node.props.onChange !== "function");
  } else {
    ok(`"${label}" WRITES form.${key}`, keyWrittenBy(found.node) === key, JSON.stringify(keyWrittenBy(found.node)));
  }
}

// The password is the one field the draft must never carry — sessionStorage
// lives on a van's shared laptop. Asserted here because the field moved files.
ok(
  "the password is still stripped out of the saved draft",
  /const \{ password, \.\.\.safeForm \} = form;/.test(code("app/signup/page.js")),
);

console.log("\n  …and on /login");
const loginText = textOf(loginHtml);
ok("an email field, typed as one", /type="email"/.test(loginHtml));
ok("...required", /type="email"[^>]*required|required[^>]*type="email"/.test(loginHtml));
ok("a password field", /type="password"/.test(loginHtml));
// Autocomplete tokens are what stop a contractor typing their address every
// morning. current-password on login, new-password on signup — the wrong one
// makes a password manager fill instead of generate.
ok('...with autocomplete="current-password"', /autocomplete="current-password"/i.test(loginHtml));
ok("the reset flow is still reachable", loginHtml.includes('href="/forgot-password"'));
ok("...and so is signup", loginHtml.includes('href="/signup"'));
ok("labels are associated with their inputs", /for="login-email"/.test(loginHtml) && /id="login-email"/.test(loginHtml));

// ══════════════════════════════════════════════════════════════════════════
console.log("\nThe payload /api/companies receives is unchanged");
//
// Source, not a render — see the header. The key SET is the contract: the API
// 400s without a name, seeds Company.country from this body (which decides the
// billing currency and the fallback tax jurisdiction), and reprices the plan
// from its own row. An extra key here is a new promise; a missing one is a
// silent regression four steps after the field that filled it.
const signupSrc = code("app/signup/page.js");
const bodyMatch = signupSrc.match(
  /fetch\("\/api\/companies",[\s\S]*?body: JSON\.stringify\(\{([\s\S]*?)\n {8}\}\),/,
);
ok("the POST body is still one literal in one place", Boolean(bodyMatch));
// `key:` and bare `key,` both count. No key is passed shorthand today, but the
// regex keeps accepting both: it was written after a colon-only version
// quietly declared the payload one key smaller than it was, and narrowing it
// again the moment the shorthand key went away would re-open that hole for
// whoever adds the next one.
const bodyKeys = bodyMatch
  ? [...bodyMatch[1].matchAll(/^\s{10}([A-Za-z][A-Za-z0-9]*)\s*[:,]/gm)].map((m) => m[1])
  : [];
const EXPECTED_BODY = [
  "name",
  "phone",
  "address",
  "city",
  "province",
  "country",
  "language",
  "industries",
  "planId",
  // employeeCount was here until 2026-08-31. Signup used to post a raw
  // headcount, and /api/companies minted a "Custom (N employees)" Plan from it
  // at the retired $45/licence rate — so a prospect who clicked the Solo card
  // could be charged a different number than the card showed. The ladder has
  // no honest headcount-to-tier mapping, so the parameter was removed rather
  // than guessed at. See docs/PRICING-CLEANUP.md.
  "serviceCategoryIds",
  "billingInterval",
  "referralCode",
  // Added 2026-09-01 with sales attribution. Its OWN key, deliberately not
  // folded into referralCode: that field is already a two-way waterfall (a
  // platform promo code, then a contractor referral code) resolved by trying
  // one and falling through to the other, and a FieldQuo rep's code joining
  // that queue would mean a mistyped promo code silently attributing a
  // commission. See lib/sales/attribution.js and
  // scripts/check-sales-attribution.mjs, which asserts the two namespaces stay
  // separate at this boundary.
  "salesCode",
  "next",
];
ok(
  "...carrying exactly the same keys",
  bodyKeys.join(",") === EXPECTED_BODY.join(","),
  bodyKeys.join(","),
);
// Non-negotiable #5: the browser never sends money. The cadence is a word, and
// the server reprices from its own Plan row.
ok(
  "...the cadence, never an amount",
  /billingInterval: effectiveInterval,/.test(signupSrc) &&
    !/(price|amount|total|monthly)\s*:/i.test(bodyMatch ? bodyMatch[1] : "x:"),
);
// effectiveInterval, not billingInterval straight from state: a plan with no
// annual price must not be bought on a cadence it does not have.
ok(
  "...and effectiveInterval is still what guards an annual-less plan",
  /const effectiveInterval = annualAvailable \? billingInterval : "month";/.test(
    signupSrc,
  ),
);
// The account step's own submit still creates the login before anything else.
ok("signUp.email is still what the account step calls", /await signUp\.email\(\{/.test(signupSrc));
ok("...and the company is still what checkout follows", /window\.location\.href = data\.checkoutUrl;/.test(signupSrc));

// ══════════════════════════════════════════════════════════════════════════
console.log("\nThe step order, and the plan step still last");
//
// Executed against lib/signup/funnel.js, which is where the order lives. The
// plan step used to be FIRST, priced off a hardcoded "CA", so a contractor in
// Texas was shown Canadian money before anybody asked where he was. Nothing
// about a layout change may put it back.
ok("STEPS is the five names it has always been", STEPS.join(",") === "account,business,industry,services,plan", STEPS.join(","));
ok("...and plan is last", STEPS[STEPS.length - 1] === "plan");
for (const accountExists of [false, true]) {
  const who = accountExists ? "with a login" : "a stranger";
  const walked = [firstStep({ accountExists })];
  let guard = 0;
  while (guard++ < 10) {
    const next = nextStep(walked[walked.length - 1], { accountExists });
    if (!next) break;
    walked.push(next);
  }
  ok(`${who} walks ${walked.join(" → ")}`, walked[walked.length - 1] === "plan" && walked.length === 4, walked.join(" → "));
  ok(`...and Back retraces it exactly`, walked.slice(1).every((step, i) => previousStep(step, { accountExists }) === walked[i]));
  ok(`...with nothing behind the first step`, previousStep(walked[0], { accountExists }) === null);
  // The rail is DERIVED from the funnel rather than restating it. A rail with
  // its own list of four names is the copy that rots — this one would still be
  // showing the plan step first.
  ok(`...and the progress rail names the same four`, rungsFor({ accountExists }).join(",") === walked.join(","), rungsFor({ accountExists }).join(","));
}
// Nothing past the account step is reachable without a login: an unauthenticated
// visitor restored straight into "services" once reached checkout and got a bare
// 401 with nothing on screen saying which of two missing things was missing.
ok(
  "an account is still the gate on everything after it",
  furthestStep({ accountExists: false, companyReady: true, hasIndustries: true, hasServices: true }) === "account",
);

console.log("\n  …and the rail says so on screen");
for (const [step, expected] of [
  ["account", "Step 1 of 4"],
  ["industry", "Step 2 of 4"],
  ["services", "Step 3 of 4"],
  ["plan", "Step 4 of 4"],
]) {
  const html = inEnglish(createElement(SignupSteps, { current: step, accountExists: false }));
  ok(`on "${step}" it reads ${expected}`, textOf(html).includes(expected), textOf(html));
}
// A step name the rail does not know would draw four empty bars — "you have
// done nothing" said to somebody four screens in. It renders nothing instead.
ok(
  "an unknown step renders no rail rather than an empty one",
  inEnglish(createElement(SignupSteps, { current: "checkout", accountExists: false })) === "",
);

console.log("\n  …and the page actually mounts it");
//
// ══ The assertion this file was missing ════════════════════════════════════
//
// Mutation-testing this check found the exact failure its own header warns
// about: deleting <SignupSteps /> from app/signup/page.js left every assertion
// above green, because they all render the component directly. The rail cannot
// be reached through the page's markup — signup's first render is the
// entry-check placeholder and the rail is deliberately null until we know who
// this visitor is — so the wiring is pinned in the two places it can be:
// the page must hand it the LIVE step, and the shell must render what it is
// handed.
ok(
  "the rail is wired to the live step, not to a constant",
  /<SignupSteps\s+current=\{step\}\s+accountExists=\{accountExists\}\s*\/>/.test(signupSrc),
);
ok(
  "...and AuthShell renders whatever rail it is given",
  inEnglish(
    createElement(AuthShell, {
      title: "t",
      rail: createElement("b", null, "RAIL-SENTINEL"),
      children: "form",
    }),
  ).includes("RAIL-SENTINEL"),
);
ok(
  "...and whatever aside it is given",
  inEnglish(
    createElement(AuthShell, {
      title: "t",
      aside: createElement("b", null, "ASIDE-SENTINEL"),
      children: "form",
    }),
  ).includes("ASIDE-SENTINEL"),
);
// The plan step is the one that goes full width. If that condition inverted,
// four plan cards would be crushed into a 26rem column.
ok(
  "the plan step is the one step with no aside beside it",
  /aside=\{step === "plan" \? null : <AuthAside variant="signup" \/>\}/.test(signupSrc),
);

// ══════════════════════════════════════════════════════════════════════════
console.log("\nNothing new is claimed that we do not ship");
//
// This is a marketing panel on a page somebody enters a password or a card on,
// which makes it the worst place in the product to overstate. The first three
// do not exist at all. The fourth was corrected across twelve pages earlier
// today: signup opens a Stripe subscription with a trial and no
// `payment_method_collection: "if_required"`, so a card IS taken.
const FORBIDDEN = [
  [/mobile app|iphone app|android app|app store|google play/i, "a mobile app"],
  [/quickbooks/i, "QuickBooks"],
  [/zapier/i, "Zapier"],
  [/no (credit )?card( details)? (required|needed)|without a credit card|card-free/i, "no credit card required"],
];
const SURFACES = [
  ["/login", loginText],
  ["/signup", textOf(signupHtml)],
  ["the login panel", textOf(inEnglish(createElement(AuthAside, { variant: "login" })))],
  ["the signup panel", textOf(inEnglish(createElement(AuthAside, { variant: "signup" })))],
];
for (const [where, text] of SURFACES) {
  for (const [pattern, what] of FORBIDDEN) {
    ok(`${where} does not claim ${what}`, !pattern.test(text));
  }
}
// Said, not merely not-denied. Somebody about to hand over eleven fields
// deserves to know a card is coming before Stripe tells them.
const signupPanel = textOf(inEnglish(createElement(AuthAside, { variant: "signup" })));
ok("the signup panel states the card up front", /card at checkout/i.test(signupPanel), signupPanel);
ok("...and the offer comes from trialLabel(), not a typed number", /Free first month/.test(signupPanel));
ok(
  "...off the helper rather than restated",
  /trialLabel\(\)/.test(code("app/components/auth/AuthAside.js")),
);
// The trades count is the one number on the panel that cannot be written by
// hand — it is the length of app/data/industries.js.
ok(
  `the panel counts ${INDUSTRIES.length} trades rather than naming a number`,
  signupPanel.includes(`${INDUSTRIES.length} trades`) &&
    /INDUSTRIES\.length/.test(code("app/components/auth/AuthAside.js")),
);

// ══════════════════════════════════════════════════════════════════════════
console.log("\nBoth themes define every colour these pages use");
//
// Not because /login goes dark today — it does not; ThemeProvider's allow-list
// is /app and /platform. Because "light by policy" and "the dark value was
// never written" look identical from outside, and the allow-list is one line.
const css = read("app/globals.css");
// The `:root` block, not the `@theme` block above it — the latter only aliases
// `--color-card: var(--card)` and declaring parity there would prove nothing.
// Anchored on a newline so `.dark` and `:root` cannot match each other.
const varsIn = (pattern) => {
  const block = css.match(pattern);
  const found = new Map();
  if (block) {
    for (const m of block[1].matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{3,8}|[^;]+);/g))
      found.set(m[1], m[2].trim());
  }
  return found;
};
const light = varsIn(/\n:root \{([\s\S]*?)\n\}/);
const dark = varsIn(/\n\.dark \{([\s\S]*?)\n\}/);
ok("app/globals.css declares a :root palette", light.size > 20, `${light.size}`);
ok("...and a .dark one", dark.size > 20, `${dark.size}`);
const darkOnly = [...dark.keys()].filter((name) => !light.has(name));
ok("no colour exists only inside the dark block", darkOnly.length === 0, darkOnly.join(", "));

// Every token class these two pages paint with, mapped back to the variable
// behind it. A `bg-whatever` naming a variable only one theme declares is the
// failure this section is named after.
const TOKEN_PREFIX = /^(bg|text|border|from|to|via|ring|fill|stroke|divide|decoration)-(.+)$/;
const classesIn = (html) => {
  const out = new Set();
  for (const m of html.matchAll(/class="([^"]*)"/g))
    for (const cls of m[1].split(/\s+/)) if (cls) out.add(cls);
  return out;
};
const surfaces = new Set([
  ...classesIn(loginHtml),
  ...classesIn(signupHtml),
  ...classesIn(inEnglish(createElement(AuthAside, { variant: "signup" }))),
  ...classesIn(inEnglish(createElement(SignupSteps, { current: "industry", accountExists: false }))),
]);
const tokenClasses = [];
for (const cls of surfaces) {
  // Strip variants (sm:, lg:, hover:, focus:, dark:) and any /opacity suffix.
  const bare = cls.split(":").pop().split("/")[0];
  const m = bare.match(TOKEN_PREFIX);
  if (m && (light.has(m[2]) || dark.has(m[2]))) tokenClasses.push([cls, m[2]]);
}
ok(`${tokenClasses.length} token colours are in play on these pages`, tokenClasses.length >= 6, `${tokenClasses.length}`);
for (const [cls, name] of [...new Set(tokenClasses.map((t) => t.join("|")))].map((s) => s.split("|"))) {
  ok(`${cls} resolves in both themes`, light.has(name) && dark.has(name));
}

// The other half of the rule, for the fixed palette colours a token cannot
// express (the red error banners). A `dark:bg-…` with no base `bg-…` beside it
// is a colour that exists only after dark mode arrives.
const PROP = /^(bg|text|border)-/;
let unpaired = [];
for (const [, attr] of [
  ...loginHtml.matchAll(/class="([^"]*)"/g),
  ...signupHtml.matchAll(/class="([^"]*)"/g),
]) {
  const list = attr.split(/\s+/).filter(Boolean);
  for (const cls of list) {
    if (!cls.startsWith("dark:")) continue;
    const bare = cls.slice(5);
    const prop = bare.match(PROP)?.[1];
    if (!prop) continue;
    const hasBase = list.some(
      (other) => !other.includes("dark:") && other.split(":").pop().startsWith(`${prop}-`),
    );
    if (!hasBase) unpaired.push(cls);
  }
}
ok("every dark: colour has a base colour under it", unpaired.length === 0, unpaired.join(", "));

// ══════════════════════════════════════════════════════════════════════════
console.log("\nThe new pairings, measured");
//
// AGENTS.md: contrast is computed, not guessed. The tick icons and the progress
// bar are --primary on --card, which is the pairing this change introduced —
// and the reason they are not the green tick the pricing cards use. That green
// is one value chosen against a white card; --primary is declared for both.
const rgb = (hex) => {
  const h = hex.replace("#", "").trim();
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
};
const luminance = (hex) => {
  const [r, g, b] = rgb(hex).map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

// [foreground token, background token, floor, what it is]
const PAIRS = [
  ["primary", "card", 4.5, "tick icons and progress bar on the panel"],
  ["foreground", "card", 4.5, "body text on a card"],
  ["foreground", "muted", 4.5, "the h1 on the page wash"],
  ["muted-foreground", "muted", 4.5, "the subtitle on the page wash"],
  ["muted-foreground", "card", 4.5, "the card sentence under the panel"],
  ["brand-accent-text", "muted", 4.5, "the eyebrow above the h1"],
  ["inverted-foreground", "inverted", 4.5, "the primary button"],
  // The focus ring, which is what this change added and what WCAG 1.4.11
  // actually asks of a field boundary — see the note under this loop.
  ["ring", "card", 3, "the focus ring on an input"],
  ["ring", "background", 3, "the focus ring against the field fill"],
];
for (const [fg, bg, floor, what] of PAIRS) {
  for (const [theme, palette] of [["light", light], ["dark", dark]]) {
    // .dark redeclares only what it changes, so an absent name means "same as
    // light" — falling back is the rule, not a patch over a missing value.
    const fgHex = palette.get(fg) || light.get(fg);
    const bgHex = palette.get(bg) || light.get(bg);
    if (!fgHex || !bgHex) {
      ok(`${theme}: --${fg} on --${bg} is declared`, false, `${fg}=${fgHex} ${bg}=${bgHex}`);
      continue;
    }
    const value = ratio(fgHex, bgHex);
    ok(
      `${theme}: --${fg} on --${bg} is ${value.toFixed(2)}:1 (${what})`,
      value >= floor,
      `${value.toFixed(2)}:1, floor ${floor}`,
    );
  }
}

// ── One number recorded rather than asserted ───────────────────────────────
//
// --border on --card measures about 1.3:1 in light and 1.4:1 in dark. That is
// under the 3:1 WCAG asks of a control boundary, and it is stated here rather
// than quietly left out — but it is NOT this change's to fix. --border is the
// app-wide hairline on several hundred surfaces; forking it for two pages would
// be inventing a second design language, which is the one thing this redesign
// was told not to do. What this change DID add is the focus ring above, which
// is what identifies the field at the moment identifying it matters.
for (const [theme, palette] of [["light", light], ["dark", dark]]) {
  const value = ratio(palette.get("border") || light.get("border"), palette.get("card") || light.get("card"));
  console.log(`  · ${theme}: --border on --card is ${value.toFixed(2)}:1 — recorded, app-wide, not introduced here`);
}

// ══════════════════════════════════════════════════════════════════════════
console.log("\nOne field style, not four copies of one");
// Three copies had already drifted: only some turned red on an error, none said
// anything on focus. The copy is the one that rots, because it is the one
// nobody looks at.
const styles = code("app/components/auth/fieldStyles.js");
ok("the shared style has a focus state", /focus:ring-2/.test(styles));
ok("...and uses --destructive, which both themes declare, for an error", /border-destructive/.test(styles));
for (const file of ["app/login/page.js", "app/signup/page.js"]) {
  const src = code(file);
  ok(`${file} uses it`, /from "@\/app\/components\/auth\/fieldStyles"/.test(src));
  ok(`...and hand-rolls no input border of its own`, !/border rounded-lg px-4 py-2\.5 text-sm/.test(src));
}

// ── Signed in with a business means no signup form ────────────────────────
//
// /signup used to detect an existing membership and carry on, with a banner
// saying that continuing would set up an ADDITIONAL business. The owner ruled
// against it twice — "i cannot sign up if i'm already logged in" — so the form
// is not offered and POST /api/companies refuses.
//
// Asserted at BOTH ends deliberately. A screen that hides a form while the
// route still accepts the post is the hidden-path failure this codebase is
// swept for; a route that refuses while the screen still offers the form is
// the dead-control failure. Either alone is worse than neither.
console.log("\n── One business to a login ─────────────────────────────────────\n");

const companiesSrc = code("app/api/companies/route.js");

// Every step, not just the first: a resumed draft would otherwise render the
// business step underneath the refusal panel.
const guarded = (signupSrc.match(/entryChecked && !alreadyOnFieldquo && step ===/g) || []).length;
ok("no signup step renders for a member", guarded >= 5, guarded);
ok("...nor the loading state that precedes them",
  /\{!entryChecked && !alreadyOnFieldquo && \(/.test(signupSrc));
ok("...and the panel that replaces it names their business",
  /auth\.signup\.alreadyIn/.test(signupSrc) && /alreadyOnFieldquo\.name/.test(signupSrc));
// Not a redirect: somebody who typed the URL gets a sentence, and the two
// things they probably meant are one click away.
ok("...offering the dashboard and the team page rather than bouncing",
  /href="\/app"/.test(signupSrc) && /href="\/app\/settings\/team"/.test(signupSrc));

ok("the route refuses a second company", /code: "already_has_company"/.test(companiesSrc));
ok("...with a 409, not a 403 — it is a conflict, not a permission",
  /already_has_company[\s\S]{0,120}status: 409/.test(companiesSrc));
// The distinction the whole gate turns on. A session with NO membership is the
// abandoned signup, and refusing that strands somebody permanently.
// Anchored to the ASSIGNMENT, not to the call appearing somewhere in the
// expression. The first version matched a ternary that short-circuited on the
// session and only reached findFirst on the other branch — the query was still
// in the source, so the regex was satisfied while the behaviour was inverted.
ok("...on MEMBERSHIP, never on the session alone",
  /const existingMembership = await db\.member\.findFirst\(\{/.test(companiesSrc));
ok("...with nothing standing between the assignment and the query",
  !/const existingMembership = [^a]*session/.test(companiesSrc));
ok("...so an account with no company can still finish signing up",
  companiesSrc.indexOf("existingMembership") > companiesSrc.indexOf('status: 401'));

console.log(
  fails.length
    ? `\nFAILED — ${fails.length} of ${pass + fails.length}\n${fails
        .map((f) => `  ✗ ${f}`)
        .join("\n")}`
    : `\nPASSED — ${pass}/${pass} assertions`,
);
process.exit(fails.length ? 1 : 0);
