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
import LoginPage from "@/app/login/page";
import SignupPage, { AccountFields, validateAccountFields } from "@/app/signup/page";
import AuthShell from "@/app/components/auth/AuthShell";
import AuthAside from "@/app/components/auth/AuthAside";
import WelcomeAside from "@/app/components/auth/WelcomeAside";
import WelcomeFlow from "@/app/welcome/WelcomeFlow";
import {
  WELCOME_STEPS,
  nextWelcomeStep,
  previousWelcomeStep,
  allowedWelcomeStep,
} from "@/lib/signup/welcome";
import { DID_YOU_KNOW, factValues } from "@/lib/signup/didYouKnow";
import { TRIAL_DAYS, TRIAL_CARD_REQUIRED } from "@/lib/pricing";

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
// Since 2026-09-29 the signup panel is the welcome aside: a screenshot of a
// real FieldQuo screen and one "Did you know…" line from the one sourced list
// (lib/signup/didYouKnow.js) — no invented statistic, no competitor imagery.
ok("/signup shows it too — a real screen and a sourced fact", signupHtml.includes("data-welcome-aside") && /marketing(%2F|\/)hero-/.test(signupHtml) && /data-fact-source="(product|arithmetic)"/.test(signupHtml));

// ══════════════════════════════════════════════════════════════════════════
console.log("\nEvery field the account screen collects, still bound to its key");
//
// Since 2026-09-29 /signup is one screen: work email, password, and the
// unticked "Send me product news and offers". Everything about the business
// is asked afterwards on the welcome screens (rendered below). The table is
// built by walking the element tree AccountFields returns and FIRING each
// onChange, so it describes the shipped component rather than a memory of it
// — a field that is shown and never written, or written and never shown, is
// AGENTS.md's first recurring failure class.
const BASE_FORM = { email: "F-email", password: "F-password", consent: false };

const OURS = new Set(["AccountFields"]);
function walk(node, out) {
  if (node == null || typeof node === "boolean" || typeof node === "number") return;
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

let writtenKeys = null;
const spyForm = (arg) => {
  const next = typeof arg === "function" ? arg(BASE_FORM) : arg;
  writtenKeys = Object.keys(next).filter((k) => next[k] !== BASE_FORM[k]);
};
const flat = [];
walk(createElement(AccountFields, { form: BASE_FORM, setForm: spyForm, fieldErrors: {} }), flat);
const inputs = flat.filter((n) => n.host && (n.tag === "input" || n.tag === "select"));
ok("the account screen renders exactly three controls", inputs.length === 3, `${inputs.length}`);
ok(
  "...email, password, consent — in that order",
  inputs.map((n) => n.props.id).join(",") === "signup-email,signup-password,signup-consent",
  inputs.map((n) => n.props.id).join(","),
);
const byId = (id) => inputs.find((n) => n.props.id === id);
for (const [id, key, value] of [
  ["signup-email", "email", "x@y.co"],
  ["signup-password", "password", "hunter22hunter"],
]) {
  const n = byId(id);
  ok(`#${id} READS form.${key}`, n?.props.value === BASE_FORM[key], String(n?.props.value));
  writtenKeys = null;
  n?.props.onChange({ target: { value } });
  ok(`#${id} WRITES form.${key}`, JSON.stringify(writtenKeys) === JSON.stringify([key]), JSON.stringify(writtenKeys));
  ok(`#${id} has a label pointing at it`, flat.some((l) => l.host && l.tag === "label" && l.props.htmlFor === id));
}
{
  const n = byId("signup-consent");
  ok("the consent box is a checkbox", n?.props.type === "checkbox");
  ok("...UNTICKED unless the person ticks it", n?.props.checked === false);
  writtenKeys = null;
  n?.props.onChange({ target: { checked: true } });
  ok("...and ticking it WRITES form.consent", JSON.stringify(writtenKeys) === '["consent"]', JSON.stringify(writtenKeys));
}
ok('the email is typed as one, with autocomplete="email"', byId("signup-email")?.props.type === "email" && byId("signup-email")?.props.autoComplete === "email");
ok('the password CREATES one: autocomplete="new-password"', byId("signup-password")?.props.autoComplete === "new-password");
ok("an address that already has a login is told to sign in, not refused",
  (() => {
    const out = [];
    walk(createElement(AccountFields, { form: { ...BASE_FORM, email: "a@b.co" }, setForm: () => {}, fieldErrors: {}, existingLogin: "a@b.co" }), out);
    return out.some((n) => n.host && n.props["data-signup-login-exists"] !== undefined);
  })());
// A contractor who began on a sub's quote (/q/<token>/add) and already has a
// login: Sign in carries the way back, and only ever an internal path.
{
  // next/link is a forwardRef OBJECT, which walk() above neither records nor
  // enters — so this search looks at every element's props, whatever its type.
  const find = (node) => {
    if (node == null || typeof node !== "object") return null;
    if (Array.isArray(node)) {
      for (const c of node) {
        const hit = find(c);
        if (hit) return hit;
      }
      return null;
    }
    const props = node.props || {};
    if (props["data-signup-login-instead"] !== undefined) return props;
    if (typeof node.type === "function" && OURS.has(node.type.name)) return find(node.type(props));
    return find(props.children);
  };
  const signInHref = (loginNext) =>
    find(createElement(AccountFields, { form: { ...BASE_FORM, email: "a@b.co" }, setForm: () => {}, fieldErrors: {}, existingLogin: "a@b.co", loginNext }))?.href || "";
  const back = `/q/${"A".repeat(43)}/add`;
  ok("an existing login's Sign in link carries ?next back to the sub's quote", signInHref(back) === `/login?email=a%40b.co&next=${encodeURIComponent(back)}`, signInHref(back));
  ok("...never an external one", !signInHref("//evil.example").includes("next=") && !signInHref("https://evil.example").includes("next="));
  ok("...and with no next it is the plain sign-in link", signInHref("") === "/login?email=a%40b.co");
}
for (const [form, field, why] of [
  [{ email: "nope", password: "longenough" }, "email", "an address that is not one"],
  [{ email: "a@b.co", password: "short" }, "password", "a password under 8"],
  [{ email: "a@b.co", password: "x".repeat(129) }, "password", "a password over 128"],
]) {
  ok(`the page's own validator refuses ${why}`, Boolean(validateAccountFields(form)[field]));
}
ok("...and passes a good pair", Object.keys(validateAccountFields({ email: "a@b.co", password: "longenough" })).length === 0);

// The PASSWORD is the one thing the tab's draft must never carry —
// sessionStorage lives on a van's shared laptop.
{
  const src = code("app/signup/page.js");
  const draftWrite = src.match(/sessionStorage\.setItem\(\s*DRAFT_KEY,[\s\S]*?\);/)?.[0] || "";
  ok("the saved draft is written in one place", Boolean(draftWrite));
  ok("...and never carries the password", draftWrite && !/password/.test(draftWrite), draftWrite);
}

console.log("\nThe welcome screens render, each with its own fields");
//
// Rendered through react-dom/server with a stored prefill, the way
// app/welcome/[step]/page.js hands them over — a screen that throws here
// throws in the browser.
const PREFILL = {
  user: { email: "o@x.co", firstName: "Ana", lastName: "Silva", phone: "555-123-4567" },
  company: {
    name: "Silva Painting",
    address: "1 Main St, Toronto, ON",
    city: "Toronto",
    province: "ON",
    postalCode: "",
    country: "CA",
    currency: "CAD",
    currencySymbol: "$",
    website: "",
    industry: "painting:interior_painting",
    teamSizeBand: "2-5",
    yearsInBusinessBand: "3-5",
    revenueBand: "150-500k",
    signupPriority: "control",
    signupFocus: ["scheduling"],
    signupSource: "friend",
    trialEndsAt: "2026-10-13T00:00:00.000Z",
  },
  trade: { key: "interior_painting", id: "cat1", label: "Interior Painting" },
};
const GROUPS = [
  { slug: "painting", label: "Painting", options: [{ value: "painting:interior_painting", industry: "painting", tradeKey: "interior_painting", label: "Interior Painting" }] },
];
const welcomeHtml = {};
for (const step of WELCOME_STEPS.filter((s) => s !== "setup")) {
  try {
    welcomeHtml[step] = inEnglish(createElement(WelcomeFlow, { step, prefill: PREFILL, groups: step === "business" ? GROUPS : null }));
  } catch (err) {
    welcomeHtml[step] = "";
    fails.push(`/welcome/${step} threw while rendering — ${err.message}`);
  }
  ok(`/welcome/${step} renders`, welcomeHtml[step].length > 300, `${welcomeHtml[step].length} chars`);
}
const welcomeHtmlAll = Object.values(welcomeHtml).join("");
const W = (step) => textOf(welcomeHtml[step] || "");
ok("profile: “Your free trial is now active”, the owner's sentence, and the three fields prefilled",
  W("profile").includes("Your free trial is now active") &&
    W("profile").includes("We'll use your name and number to set up your account and make sure you get support when you need it.") &&
    /id="welcome-firstName"[^>]*value="Ana"|value="Ana"[^>]*id="welcome-firstName"/.test(welcomeHtml.profile) &&
    /id="welcome-phone"/.test(welcomeHtml.profile));
ok("business: company name, ONE address field, the industry select, an optional website",
  /id="welcome-companyName"/.test(welcomeHtml.business) &&
    W("business").includes("Company address") &&
    /role="combobox"/.test(welcomeHtml.business) &&
    /id="welcome-website"/.test(welcomeHtml.business) &&
    W("business").includes("(optional)") &&
    !/id="signup-city"|id="signup-province"|id="signup-country"/.test(welcomeHtml.business));
ok("...the website typed as text with the URL keyboard, so a bare www. address is never refused by the browser",
  /id="welcome-website"[^>]*type="text"|type="text"[^>]*id="welcome-website"/.test(welcomeHtml.business) && /inputMode="url"|inputmode="url"/.test(welcomeHtml.business));
ok("size: “Your Interior Painting business at a glance”, six team chips and five year chips",
  W("size").includes("Your Interior Painting business at a glance") &&
    ["Just me", "2–5", "6–10", "11–15", "16–20", "21+"].every((c) => W("size").includes(c)) &&
    ["Less than 1", "1–2", "3–5", "6–10", "10+"].every((c) => W("size").includes(c)));
ok("revenue: the bands in the company's own currency symbol, and “I'd prefer not to say”",
  ["$0–$50K", "$50K–$150K", "$150K–$500K", "$500K–$1M", "$1M–$2M", "$2M+", "I'd prefer not to say"].every((c) => W("revenue").includes(c)),
  W("revenue"));
ok("priority: “Ana, let's get FieldQuo working for you” and the four cards",
  W("priority").includes("Ana, let's get FieldQuo working for you") &&
    W("priority").includes("I want my business to look as professional as my work") &&
    W("priority").includes("I'm not sure yet, just exploring"));
ok("focus: the options depend on the priority (control → scheduling, routes, team…)",
  W("focus").includes("Scheduling jobs efficiently") && W("focus").includes("Planning smarter routes") && !W("focus").includes("Quotes that win work"));
ok("source: a select and “Get started”", /id="welcome-source"/.test(welcomeHtml.source) && W("source").includes("Get started"));
ok("every screen after the first has a Back button", WELCOME_STEPS.filter((s) => s !== "setup" && s !== "profile").every((s) => W(s).includes("Back")));
ok("...and the first has none", !W("profile").includes("← Back"));

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
console.log("\nThe payload /api/companies receives");
//
// Source, not a render — the key SET is the contract. Since 2026-09-29 the
// press posts NO business facts at all (no name, no address, no country: the
// welcome questions ask for those, and the route creates the company with
// explicit nulls — scripts/check-welcome-flow.mjs). What it still carries are
// the link's own facts, the page language, the consent, and what the pricing
// link named — never money.
const signupSrc = code("app/signup/page.js");
const bodyMatch = signupSrc.match(
  /fetch\("\/api\/companies",[\s\S]*?body: JSON\.stringify\(\{([\s\S]*?)\n {6}\}\),/,
);
ok("the POST body is still one literal in one place", Boolean(bodyMatch));
// `key:` and bare `key,` both count — a colon-only version once declared the
// payload one key smaller than it was.
const bodyKeys = bodyMatch
  ? [...bodyMatch[1].matchAll(/^\s{8}([A-Za-z][A-Za-z0-9]*)\s*[:,]/gm)].map((m) => m[1])
  : [];
const EXPECTED_BODY = [
  // The page's language — the company's default until Settings says otherwise.
  "language",
  // "Send me product news and offers": only `true` counts server-side.
  "marketingConsent",
  // A promo or referral code (the two-way waterfall in the route).
  "referralCode",
  // A FieldQuo rep's code — its OWN key, never folded into referralCode, so a
  // mistyped promo can never attribute a commission (check:sales-attribution).
  "salesCode",
  // The advert the link carried, for SignupOrigin.
  "utm",
  // The token on a link a rep TEXTED, for the rep's panel.
  "signupLinkToken",
  "next",
  // What the /pricing link named (?tier= / ?plan=) — a card, never a price.
  "wantedTier",
  "wantedPlanId",
];
ok("...carrying exactly these keys", bodyKeys.join(",") === EXPECTED_BODY.join(","), bodyKeys.join(","));
ok(
  "...no business fact rides on it — no name, no address, no country",
  !/\b(name|address|country|province|city|phone)\s*:/.test(bodyMatch ? bodyMatch[1] : "name:"),
);
ok("...and no money", !/(price|amount|total|monthly)\s*:/i.test(bodyMatch ? bodyMatch[1] : "x:"));
{
  const src = readFileSync("app/signup/page.js", "utf8");
  ok("validateAccountFields defaults `t` to englishOnly", /function validateAccountFields\(form, t = englishOnly\)/.test(src));
  ok("monthsFree / dayCount / trialText are never called without t", !/\b(monthsFree|dayCount|trialText)\(\s*[^t\s]/.test(src));
}
// The one plan step /signup keeps: a company created before 2026-09-24 that
// never finished Stripe checkout. It posts the plan and the CADENCE, and the
// checkout route reprices from its own row (non-negotiable #5).
ok(
  "the resumed payment posts the cadence, never an amount",
  /body: JSON\.stringify\(\{ planId: selectedPlanId, interval: effectiveInterval \}\)/.test(signupSrc),
);
ok(
  "...and effectiveInterval is still what guards an annual-less plan",
  /const effectiveInterval = \(hasSelection \? annualAvailable : anyYearOffer\) \? billingInterval : "month";/.test(signupSrc),
);
ok("signUp.email is still what the account screen calls", /await signUp\.email\(\{/.test(signupSrc));
ok("...then the company, then the first welcome question", /await createCompany\(\)/.test(signupSrc) && /window\.location\.href = data\.welcomeUrl;/.test(signupSrc));
ok("...and the resumed payment still follows its checkout", /window\.location\.href = data\.checkoutUrl;/.test(signupSrc));

// ══════════════════════════════════════════════════════════════════════════
console.log("\nThe welcome questions' order, and the rail that counts them");
//
// Executed against lib/signup/welcome.js, where the order lives — the screens
// ask it for Back, and the server for Next (PATCH /api/signup/personalize).
ok(
  "WELCOME_STEPS is the owner's order, setup last",
  WELCOME_STEPS.join(",") === "profile,business,size,revenue,priority,focus,source,setup",
  WELCOME_STEPS.join(","),
);
{
  const walked = [WELCOME_STEPS[0]];
  let guard = 0;
  while (guard++ < 20) {
    const next = nextWelcomeStep(walked[walked.length - 1]);
    if (!next) break;
    walked.push(next);
  }
  ok(`Next walks ${walked.join(" → ")}`, walked.join(",") === WELCOME_STEPS.join(","));
  ok("...and Back retraces it exactly", walked.slice(1).every((s, i) => previousWelcomeStep(s) === walked[i]));
  ok("...with nothing behind the first question", previousWelcomeStep(walked[0]) === null);
}
ok("a screen past the first unanswered one is never shown", allowedWelcomeStep("revenue", { user: {}, company: {}, tradeKeys: [] }) === "profile");
for (const [step, expected] of [
  ["profile", "Question 1 of 7"],
  ["business", "Question 2 of 7"],
  ["size", "Question 3 of 7"],
  ["source", "Question 7 of 7"],
]) {
  ok(`on /welcome/${step} the rail reads ${expected}`, textOf(welcomeHtml[step] || "").includes(expected), textOf(welcomeHtml[step] || "").slice(0, 120));
}
{
  const flowSrc = code("app/welcome/WelcomeFlow.js");
  ok("the rail is wired to the live step, not to a constant", /<QuestionRail step=\{step\} steps=\{steps\} \/>/.test(flowSrc));
  ok("...and the aside likewise", /aside=\{<WelcomeAside step=\{step\} \/>\}/.test(flowSrc));
}
ok(
  "AuthShell renders whatever rail it is given",
  inEnglish(createElement(AuthShell, { title: "t", rail: createElement("b", null, "RAIL-SENTINEL"), children: "form" })).includes("RAIL-SENTINEL"),
);
ok(
  "...and whatever aside it is given",
  inEnglish(createElement(AuthShell, { title: "t", aside: createElement("b", null, "ASIDE-SENTINEL"), children: "form" })).includes("ASIDE-SENTINEL"),
);
ok(
  "the resumed plan step is the one /signup screen with no aside — its cards need the width",
  /aside=\{finishCheckout \? null : <WelcomeAside step="account" \/>\}/.test(signupSrc),
);

// ══════════════════════════════════════════════════════════════════════════
console.log("\nNothing new is claimed that we do not ship");
//
// This is a marketing panel on a page somebody enters a password on, which
// makes it the worst place in the product to overstate. The first three do
// not exist at all. The fourth turned round on 2026-09-24: signup no longer
// opens a Stripe session at all (the owner: "move the credit card and plan
// selection out of the sign up"), so "we take your card at checkout" — the
// sentence this list used to REQUIRE — is now the false claim, and the
// card-free sentence is the true one.
const FORBIDDEN = [
  [/mobile app|iphone app|android app|app store|google play/i, "a mobile app"],
  [/quickbooks/i, "QuickBooks"],
  [/zapier/i, "Zapier"],
  [/card at checkout|take your card|pick a plan at the end|choose the plan on the last step/i, "a card or plan step signup no longer has"],
];
const SURFACES = [
  ["/login", loginText],
  ["/signup", textOf(signupHtml)],
  ["the login panel", textOf(inEnglish(createElement(AuthAside, { variant: "login" })))],
  ["the welcome panel", textOf(inEnglish(createElement(WelcomeAside, { step: "account" })))],
  ...Object.entries(welcomeHtml).map(([step, html]) => [`/welcome/${step}`, textOf(html)]),
];
for (const [where, text] of SURFACES) {
  for (const [pattern, what] of FORBIDDEN) {
    ok(`${where} does not claim ${what}`, !pattern.test(text));
  }
}
// Said, not merely not-denied: how long the trial is and whether it takes a
// card — both from lib/pricing.js, never typed on the page.
{
  const signupText = textOf(signupHtml);
  ok(`/signup says the trial is ${TRIAL_DAYS} days`, signupText.includes(`Free for ${TRIAL_DAYS} days`), signupText.slice(0, 200));
  ok(
    `...and ${TRIAL_CARD_REQUIRED ? "does not promise" : "says"} “no card needed”, as TRIAL_CARD_REQUIRED says`,
    TRIAL_CARD_REQUIRED ? !/no card needed/i.test(signupText) : /no card needed/i.test(signupText),
  );
  ok("...off the constants rather than a typed number", /TRIAL_DAYS/.test(signupSrc) && /TRIAL_CARD_REQUIRED/.test(signupSrc) && !/Free for 14 days/.test(signupSrc));
}
// The "Did you know…" line: one list, each fact with a source, the arithmetic
// one computed. scripts/check-welcome-flow.mjs holds the list itself; here the
// panel is held to showing only what the list says.
{
  const panel = textOf(inEnglish(createElement(WelcomeAside, { step: "account" })));
  const shown = DID_YOU_KNOW.filter((f) => {
    let s = f.text;
    for (const [k, v] of Object.entries(factValues(f))) s = s.replace(`{${k}}`, String(v));
    return panel.includes(s);
  });
  ok("the welcome panel shows exactly one fact from the sourced list", shown.length === 1, panel);
}

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
  ...classesIn(inEnglish(createElement(WelcomeAside, { step: "account" }))),
  ...classesIn(welcomeHtmlAll),
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

// Both forms — the signed-out account screen and the signed-in "Start my free
// trial" — are guarded on the membership answer.
ok(
  "no signup form renders for a member",
  /entryChecked && !accountReady && !alreadyOnFieldquo && !finishCheckout/.test(signupSrc) &&
    /entryChecked && accountReady && !alreadyOnFieldquo && !finishCheckout/.test(signupSrc),
);
ok("...nor the loading state that precedes them",
  // (A resume link held for the two-account choice hides it too.)
  /\{!entryChecked && !alreadyOnFieldquo && (!resumeElsewhere && )?\(/.test(signupSrc));
// app.signup.*, not auth.signup.*. The old prefix belonged to no catalogue at
// all: check-translations.mjs gates "app.*" and messages.js gates the marketing
// keys, and "auth.signup.alreadyIn" was neither — so every one of these t()
// calls silently rendered its English fallback in all eight languages and no
// coverage report could see it. Anchored to the new prefix so this check fails
// if anybody moves them back out of a gated namespace.
ok("...and the panel that replaces it names their business",
  /app\.signup\.alreadyIn/.test(signupSrc) && /alreadyOnFieldquo\.name/.test(signupSrc));
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
