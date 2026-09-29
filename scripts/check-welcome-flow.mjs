// scripts/check-welcome-flow.mjs
//
//   npm run check:welcome-flow
//
// The one-screen signup and its welcome questions (2026-09-29), executed.
//
//   1. The company "Start my free trial" creates carries explicit nulls —
//      no "CA", no "CAD", no America/Toronto, no placeholder name — and the
//      TRIAL_DAYS trial, and nothing is seeded before the country is known.
//   2. Every welcome answer is read through one pure reader against hostile
//      input; the focus options DEPEND on the priority; nothing is defaulted.
//   3. Resume: the next screen is computed from the stored answers, a screen
//      cannot be skipped by URL, and after a login the OWNER (only) is sent to
//      it — never an invited member, never a support session, never a company
//      from before this flow. Recovery links point there too.
//   4. The readiness gate refuses client-facing work without a business name
//      and country, and links to the screen that fixes it.
//   5. The setup screen shows only stages the server runs, each ticked only
//      by the server, with chips of the services actually created.
//   6. The "Did you know…" facts: one list, each with a source; the
//      arithmetic one computed from its inputs.
//
// node --import ./scripts/alias-loader.mjs scripts/check-welcome-flow.mjs

import { readFileSync, existsSync } from "node:fs";

import {
  WELCOME_STEPS,
  WELCOME_TEAM_KEYS,
  WELCOME_REVENUE_BANDS,
  WELCOME_PRIORITIES,
  WELCOME_SOURCES,
  WELCOME_FOCUS,
  SOLO_TEAM_KEY,
  focusOptionsFor,
  readWelcomeAnswer,
  resumeWelcomeStep,
  allowedWelcomeStep,
  welcomeStepAnswered,
  nextWelcomeStep,
  previousWelcomeStep,
  welcomePath,
  revenueBandLabel,
  industryGroups,
  readIndustryChoice,
  industryChoiceValue,
} from "@/lib/signup/welcome";
import { welcomeGateDecision } from "@/lib/signup/welcomeGate";
import {
  clientFacingGaps,
  clientFacingRefusal,
  FINISH_SETUP_PATH,
  PROFILE_INCOMPLETE_CODE,
} from "@/lib/company/profileReadiness";
import { DID_YOU_KNOW, factValues, factForStep, yearlyAdminValue, ADMIN_HOURS_SAVED_PER_WEEK, ADMIN_HOURLY_VALUE, WORKING_WEEKS_PER_YEAR } from "@/lib/signup/didYouKnow";
import { setupStagesAllowed, planSetupStages, SETUP_WINDOW_MS } from "@/lib/signup/setupStages";
import { applyStageEvent, initialStages } from "@/lib/signup/creatingProgress";
import { loginFromUser, appPathFor, decideResumeRoute, RESUME_ACTIONS } from "@/lib/signup/resumeRoute";
import { buildOnboardingNextStepsEmail } from "@/lib/email/onboardingNextStepsEmail";
import { TRIAL_DAYS, TRIAL_CARD_REQUIRED } from "@/lib/pricing";
import { TRADE_CATALOG } from "@/lib/trades/catalog";
import { APP_MESSAGES } from "@/app/i18n/appMessages";

let pass = 0;
const fails = [];
const ok = (label, cond, detail) => {
  if (cond) {
    pass++;
    console.log(`  ok   ${label}`);
  } else {
    fails.push(`${label}${detail !== undefined ? ` — ${detail}` : ""}`);
    console.log(`  FAIL ${label}${detail !== undefined ? ` — ${detail}` : ""}`);
  }
};
const read = (p) => readFileSync(p, "utf8");
const code = (p) => read(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/* ── 1. The company the first press creates ─────────────────────────────── */
console.log("\n1. The company Start my free trial creates");
{
  const route = code("app/api/companies/route.js");
  const create = route.slice(route.indexOf("tx.company.create({"), route.indexOf("await tx.member.create("));
  ok("a body with no name and no plan is the one-screen press", /const welcomeFlow = !name && !planId;/.test(route));
  ok("...refused a name only when it is not that press", /if \(!name && !welcomeFlow\)/.test(route));
  ok("...and a country likewise", /if \(!homeCountry && !welcomeFlow\)/.test(route));
  ok("country is written explicitly — the answer or null, never the schema's CA", /country: homeCountry \|\| null,/.test(create));
  ok("currency likewise — never the schema's CAD", /currency: currency \|\| null,/.test(create) && /const currency = homeCountry \? currencyForCountry\(homeCountry\) : null;/.test(route));
  ok("timezone likewise — never the schema's America/Toronto", /timezone: null,/.test(create));
  ok("the name is the empty string the schema requires, never a placeholder", /name: name \|\| "",/.test(create) && !/name: name \|\| "(My|Your|New)/.test(create));
  ok("the slug is provisional until the business screen", /`\$\{PROVISIONAL_SLUG_PREFIX\}\$\{Math\.random\(\)/.test(route) && /const PROVISIONAL_SLUG_PREFIX = "fq-";/.test(route));
  ok(`the trial is TRIAL_DAYS (${TRIAL_DAYS}) from now`, /trialEndsAt: new Date\(Date\.now\(\) \+ TRIAL_DAYS \* 24 \* 60 \* 60 \* 1000\),/.test(create));
  ok("the owner starts on the first welcome question", /onboardingStep: welcomeFlow \? "profile" : null,/.test(create));
  ok("nothing is seeded before the country is known (the press is staged)", /const staged = \(stagedSetup === true && !plan\) \|\| welcomeFlow;/.test(route));
  ok("the answer names the first welcome question", /welcomeUrl: welcomePath\("profile"\),/.test(route));
  ok("consent is written only when ticked, with the sentence shown", /if \(marketingConsent === true\) \{[\s\S]*?marketingConsentAt: new Date\(\), marketingConsentText: consentSentence\(defaultLanguage\)/.test(route));
  ok("the consent sentence exists in the catalogue it is read from", typeof APP_MESSAGES.en["app.signup.consent"] === "string" && APP_MESSAGES.en["app.signup.consent"] === "Send me product news and offers");
  ok("no card at signup, and the constant says so", TRIAL_CARD_REQUIRED === false && !/createTrialCheckoutSession\(/.test(route.slice(route.indexOf("if (welcomeFlow) {"), route.indexOf("if (!plan) {"))));
  const schema = read("prisma/schema.prisma");
  for (const col of ["onboardingStep", "personalizedAt", "revenueBand", "signupPriority", "signupFocus"]) {
    ok(`Company.${col} is in the schema`, new RegExp(`\\n  ${col}\\s+(String|DateTime)`).test(schema));
  }
  for (const col of ["phone", "marketingConsentAt", "marketingConsentText"]) {
    ok(`User.${col} is in the schema`, new RegExp(`model User \\{[\\s\\S]*?\\n  ${col}\\s+(String|DateTime)\\?`).test(schema));
  }
}

/* ── 2. The answers ─────────────────────────────────────────────────────── */
console.log("\n2. Every answer through one reader, hostile input included");
ok("the steps, in the owner's order", WELCOME_STEPS.join(",") === "profile,business,size,revenue,priority,focus,source,setup");
ok("next/previous walk them", WELCOME_STEPS.every((s, i) => nextWelcomeStep(s) === (WELCOME_STEPS[i + 1] || null) && previousWelcomeStep(s) === (WELCOME_STEPS[i - 1] || null)));
ok("an unknown step's URL is the first question", welcomePath("bogus") === "/welcome/profile" && welcomePath("revenue") === "/welcome/revenue");
{
  const good = readWelcomeAnswer("profile", { firstName: " Ana ", lastName: "Silva", phone: "5551234567" });
  ok("profile: names trimmed, phone formatted", good.ok && good.user.name === "Ana Silva" && good.user.phone === "555-123-4567", JSON.stringify(good));
  for (const [body, field] of [
    [{ lastName: "S", phone: "5551234567" }, "firstName"],
    [{ firstName: "A", phone: "5551234567" }, "lastName"],
    [{ firstName: "A", lastName: "S", phone: "12" }, "phone"],
    [{ firstName: "<b>", lastName: "S", phone: "5551234567" }, "firstName"],
    [{ firstName: "\u0000\u0000", lastName: "S", phone: "5551234567" }, "firstName"],
  ]) ok(`profile refuses ${JSON.stringify(body)} on ${field}`, readWelcomeAnswer("profile", body).field === field);
}
{
  const ctx = { country: "CA", currency: "CAD", timezone: "America/Vancouver", website: { website: null, hasWebsite: null } };
  const body = { companyName: "Silva Painting", address: "1 Main St, Vancouver, BC", city: "Vancouver", province: "BC", industry: "painting:interior_painting" };
  const r = readWelcomeAnswer("business", body, ctx);
  ok("business: name, address, the place's country and currency, the device's zone", r.ok && r.company.name === "Silva Painting" && r.company.country === "CA" && r.company.currency === "CAD" && r.company.timezone === "America/Vancouver", JSON.stringify(r));
  ok("...the trade picked and its industry", r.tradeKey === "interior_painting" && JSON.stringify(r.company.industries) === '["painting"]');
  ok("...a blank website stays unanswered (null), never a No", r.company.website === null && r.company.hasWebsite === null);
  ok("no place selected → no country → refused on the address, never guessed", readWelcomeAnswer("business", body, { ...ctx, country: null }).field === "address");
  ok("no zone stated → no zone written (the column is left, not defaulted)", !("timezone" in readWelcomeAnswer("business", body, { ...ctx, timezone: null }).company));
  ok("a bad website → refused on the website", readWelcomeAnswer("business", body, { ...ctx, website: { error: "bad" } }).field === "website");
  for (const v of ["", "painting", "painting:", ":interior_painting", "roofing:interior_painting", "painting:__proto__", "other:interior_painting", "x:y", 7, null]) {
    ok(`business refuses industry ${JSON.stringify(v)}`, readWelcomeAnswer("business", { ...body, industry: v }, ctx).field === "industry");
  }
  ok("a company name with markup is refused", readWelcomeAnswer("business", { ...body, companyName: "<script>" }, ctx).field === "companyName");
}
{
  const groups = industryGroups();
  const values = groups.flatMap((g) => g.options.map((o) => o.value));
  ok("every select option reads back as itself", values.every((v) => readIndustryChoice(v) && industryChoiceValue({ industries: readIndustryChoice(v).industry ? [readIndustryChoice(v).industry] : [], tradeKey: readIndustryChoice(v).tradeKey }) === v));
  ok("every catalogue trade is offered somewhere", Object.keys(TRADE_CATALOG).every((k) => values.some((v) => v.endsWith(`:${k}`))));
  ok("trades no industry lists sit under Other trades", groups.some((g) => g.slug === "other" && g.options.length > 0));
  ok("a trade sold by two industries appears under both", values.filter((v) => v.endsWith(":gutter_services")).length === TRADE_CATALOG.gutter_services.industries.length);
}
{
  ok("size: the six chips the owner listed", WELCOME_TEAM_KEYS.join(",") === "1,2-5,6-10,11-15,16-20,21+");
  const solo = readWelcomeAnswer("size", { teamSizeBand: SOLO_TEAM_KEY, yearsInBusinessBand: "<1" }, { now: new Date("2026-09-29T12:00:00Z") });
  ok("Just me stamps worksAloneAt", solo.ok && solo.company.worksAloneAt instanceof Date);
  const crew = readWelcomeAnswer("size", { teamSizeBand: "6-10", yearsInBusinessBand: "10+" });
  ok("any other band clears it", crew.ok && crew.company.worksAloneAt === null);
  ok("the retired 16+ chip is not an answer here", readWelcomeAnswer("size", { teamSizeBand: "16+", yearsInBusinessBand: "1-2" }).field === "teamSizeBand");
  ok("a missing years answer is refused, not defaulted", readWelcomeAnswer("size", { teamSizeBand: "2-5" }).field === "yearsInBusinessBand");
}
{
  ok("revenue: the owner's seven chips", WELCOME_REVENUE_BANDS.map((b) => b.key).join(",") === "0-50k,50-150k,150-500k,500k-1m,1-2m,2m+,prefer_not");
  ok("“I'd prefer not to say” is an answer", readWelcomeAnswer("revenue", { revenueBand: "prefer_not" }).ok);
  ok("nothing picked is refused", readWelcomeAnswer("revenue", {}).field === "revenueBand");
  ok("labels in the company's symbol", revenueBandLabel("0-50k", "$") === "$0–$50K" && revenueBandLabel("500k-1m", "€") === "€500K–€1M" && revenueBandLabel("2m+", "£") === "£2M+");
  ok("no symbol → bare figures, never a guessed one", revenueBandLabel("1-2m", null) === "1M–2M");
}
{
  ok("four priorities", WELCOME_PRIORITIES.map((p) => p.key).join(",") === "professional,control,win_more,exploring");
  const expect = {
    professional: "sending_quotes,approvals_deposits,invoicing_payments,attracting_clients,client_organization",
    control: "client_organization,scheduling,onsite_info,team_management,route_planning,automating_admin,invoices_paid_faster,jobs_on_the_go",
    win_more: "leads_followups,attracting_clients,repeat_business,more_requests,winning_quotes,never_miss_leads",
    exploring: "sending_quotes,scheduling,manage_clients,more_requests,invoicing_payments,something_else",
  };
  for (const [p, list] of Object.entries(expect)) ok(`${p}: its own focus options, in the owner's order`, focusOptionsFor(p).join(",") === list);
  ok("every focus option has words", Object.values(expect).join(",").split(",").every((k) => typeof WELCOME_FOCUS[k] === "string"));
  ok("an unknown priority offers nothing", focusOptionsFor("__proto__").length === 0);
  const f = readWelcomeAnswer("focus", { signupFocus: ["route_planning", "winning_quotes", "scheduling", "scheduling"] }, { priority: "control" });
  ok("focus keeps only what THIS priority offers, de-duplicated, in the list's order", f.ok && f.company.signupFocus.join(",") === "scheduling,route_planning", JSON.stringify(f));
  ok("a focus from another priority alone is refused", readWelcomeAnswer("focus", { signupFocus: ["winning_quotes"] }, { priority: "control" }).field === "signupFocus");
  ok("focus with no priority stored is refused", readWelcomeAnswer("focus", { signupFocus: ["scheduling"] }, {}).field === "signupPriority");
  const changed = readWelcomeAnswer("priority", { signupPriority: "win_more" }, { currentFocus: ["scheduling", "attracting_clients"] });
  ok("changing the priority drops focus answers it does not offer", changed.ok && changed.company.signupFocus.join(",") === "attracting_clients");
}
{
  ok("source: a closed list", WELCOME_SOURCES.includes("friend") && readWelcomeAnswer("source", { signupSource: "friend" }).ok);
  ok("free text is not a source", readWelcomeAnswer("source", { signupSource: "my cousin Joe" }).field === "signupSource");
  ok("an unknown step is refused", readWelcomeAnswer("setup", {}).ok === false && readWelcomeAnswer("__proto__", {}).ok === false);
}

/* ── 3. Resume ──────────────────────────────────────────────────────────── */
console.log("\n3. Where a returning owner lands");
const FULL = {
  user: { name: "Ana Silva", phone: "555-123-4567" },
  company: {
    name: "Silva Painting", country: "CA", address: "1 Main St",
    teamSizeBand: "2-5", yearsInBusinessBand: "3-5", revenueBand: "prefer_not",
    signupPriority: "control", signupFocus: ["scheduling"], signupSource: "friend", personalizedAt: null,
  },
  tradeKeys: ["interior_painting"],
};
const without = (patch) => ({ ...FULL, ...patch, company: { ...FULL.company, ...(patch.company || {}) }, user: { ...FULL.user, ...(patch.user || {}) } });
ok("nothing answered → profile", resumeWelcomeStep({ user: {}, company: {}, tradeKeys: [] }) === "profile");
ok("a name with no phone → still profile", resumeWelcomeStep(without({ user: { phone: "" } })) === "profile");
ok("a company with no trade → business", resumeWelcomeStep(without({ tradeKeys: [] })) === "business");
ok("no country → business (the address was never picked)", resumeWelcomeStep(without({ company: { country: null } })) === "business");
ok("the retired 16+ band is not an answer here → size", resumeWelcomeStep(without({ company: { teamSizeBand: "16+" } })) === "size");
ok("no revenue → revenue", resumeWelcomeStep(without({ company: { revenueBand: null } })) === "revenue");
ok("a focus that does not belong to the priority → focus", resumeWelcomeStep(without({ company: { signupFocus: ["winning_quotes"] } })) === "focus");
ok("free-text source from the old signup → source", resumeWelcomeStep(without({ company: { signupSource: "a flyer" } })) === "source");
ok("everything answered → setup", resumeWelcomeStep(FULL) === "setup");
ok("personalized → nowhere", resumeWelcomeStep(without({ company: { personalizedAt: new Date() } })) === null);
ok("a later screen by URL → the resume step", allowedWelcomeStep("source", without({ company: { revenueBand: null } })) === "revenue");
ok("an earlier screen by URL is allowed (Back)", allowedWelcomeStep("profile", without({ company: { revenueBand: null } })) === "profile");
ok("junk in the URL → the resume step", allowedWelcomeStep("<script>", FULL) === "setup");
ok("every step is judged by its own answer", WELCOME_STEPS.filter((s) => s !== "setup").every((s) => welcomeStepAnswered(s, FULL)));

console.log("\n   …and the gate after a login");
const matrix = [
  [{ role: "owner", onboardingStep: "revenue" }, "redirect", "/welcome/revenue", "an owner who stopped on revenue"],
  [{ role: "owner", onboardingStep: "setup" }, "redirect", "/welcome/setup", "an owner whose setup never finished"],
  [{ role: "owner", onboardingStep: "junk" }, "redirect", "/welcome/profile", "an owner with an unreadable step — the first question, whose page moves them on"],
  [{ role: "owner", onboardingStep: "revenue", personalizedAt: new Date() }, "allow", null, "a finished owner"],
  [{ role: "owner", onboardingStep: null }, "allow", null, "every company from before this flow"],
  [{ role: "admin", onboardingStep: "revenue" }, "allow", null, "an invited admin"],
  [{ role: "estimator", onboardingStep: "business" }, "allow", null, "an invited estimator"],
  [{ role: null, onboardingStep: "business" }, "allow", null, "a role that failed to resolve"],
  [{ role: "owner", onboardingStep: "business", impersonating: true }, "allow", null, "a superadmin's read-only support session"],
];
for (const [input, action, path, who] of matrix) {
  const d = welcomeGateDecision(input);
  ok(`${who} → ${action}${path ? ` ${path}` : ""}`, d.action === action && (path ? d.path === path : !d.path), JSON.stringify(d));
}
ok("the gate only ever sends to /welcome — never /app, never /signup (no loop through the /app shell)", matrix.every(([input]) => { const d = welcomeGateDecision(input); return !d.path || d.path.startsWith("/welcome/"); }));
{
  const page = code("app/welcome/[step]/page.js");
  ok("/welcome only renders for the owner of an unfinished flow — the same condition the gate redirects on", /if \(member\.impersonation \|\| member\.role !== "owner"\) redirect\("\/app"\);/.test(page) && /if \(!state \|\| !state\.company\.onboardingStep \|\| !state\.resume\) redirect\("\/app"\);/.test(page));
  ok("...and redirects a skipped-ahead URL to the allowed step", /const allowed = allowedWelcomeStep\(step, state\);\s*if \(allowed !== step\) redirect\(welcomePath\(allowed\)\);/.test(page));
  ok("the params are awaited (Next 16)", /const \{ step \} = await params;/.test(page));
  const api = code("app/api/signup/personalize/route.js");
  ok("the PATCH refuses a support session and a non-owner", /if \(member\.impersonation\)/.test(api) && /if \(member\.role !== "owner"\)/.test(api));
  ok("...a company from before the flow and a finished one", /code: "not_on_flow"/.test(api) && /code: "already_personalized"/.test(api));
  ok("...a question after the one they are on", /code: "out_of_order"/.test(api));
  ok("...and recomputes where they are from the answers after every write", /const resume = fresh\?\.resume \|\| resumeWelcomeStep\(fresh \|\| \{\}\);/.test(api) && /data: \{ onboardingStep: resume \}/.test(api));
  ok("a changed trade switches the old one OFF, never deletes it", /updateMany\(\{\s*where: \{ companyId: member\.companyId, categoryId: \{ not: category\.id \}, enabled: true \},\s*data: \{ enabled: false \},/.test(api) && !/companyServiceCategory\.delete/.test(api));
  ok("the provisional slug is re-derived once, from the name", /PROVISIONAL_SLUG\.test\(state\.company\.slug \|\| ""\)/.test(api));
}
{
  const login = loginFromUser({ id: "u", emailVerified: true, memberships: [{ company: { isDemo: false, trialEndsAt: new Date(Date.now() + 86400000), subscription: null, onboardingStep: "focus", personalizedAt: null } }] });
  ok("a resume link's 'the app' is the next welcome question", appPathFor(login) === "/welcome/focus");
  const route = decideResumeRoute({ prefill: { email: "a@b.co" }, login, session: { userId: "u" }, token: "t" });
  ok("...signed in as the owner → straight there", route.action === RESUME_ACTIONS.APP && route.to === "/welcome/focus");
  const signedOut = decideResumeRoute({ prefill: { email: "a@b.co" }, login, session: null, token: "t" });
  ok("...signed out → sign in, then there", signedOut.action === RESUME_ACTIONS.SIGN_IN && signedOut.next === "/welcome/focus");
  const done = loginFromUser({ id: "u", memberships: [{ company: { isDemo: false, trialEndsAt: new Date(Date.now() + 86400000), subscription: null, onboardingStep: "setup", personalizedAt: new Date() } }] });
  ok("...a finished one → /app", appPathFor(done) === "/app");
  const letter = buildOnboardingNextStepsEmail({
    companyName: "",
    welcomeStep: "revenue",
    steps: [{ key: "logo", done: false }],
    origin: "https://fieldquo.com",
  });
  ok("the finish-setting-up letter leads with the next welcome question", letter.links[0] === "https://fieldquo.com/welcome/revenue" && letter.open[0] === "welcome");
  ok("...and says 'your business' for a company with no name yet, instead of refusing to be written", /your business/.test(letter.subject));
  let threw = false;
  try {
    buildOnboardingNextStepsEmail({ companyName: "", steps: [{ key: "logo", done: false }], origin: "https://fieldquo.com" });
  } catch {
    threw = true;
  }
  ok("...while a nameless company NOT on the flow is still refused (the old rule)", threw);
  const cron = code("app/api/cron/onboarding-next-steps/route.js");
  ok("the cron passes the welcome step only while unfinished", /welcomeStep: company\.onboardingStep && !company\.personalizedAt \? company\.onboardingStep : null,/.test(cron));
}

/* ── 4. The readiness gate ──────────────────────────────────────────────── */
console.log("\n4. No client-facing work without a business name and country");
ok("a company from the first press has both gaps", JSON.stringify(clientFacingGaps({ name: "", country: null })) === '["name","country"]');
ok("whitespace is not a name", clientFacingGaps({ name: "   ", country: "CA" }).join() === "name");
ok("a named company with a country may send", clientFacingGaps({ name: "Silva Painting", country: "US" }).length === 0 && clientFacingRefusal({ name: "S", country: "US" }) === null);
{
  const r = clientFacingRefusal({ name: "", country: null });
  ok("the refusal links to the screen that asks", r.code === PROFILE_INCOMPLETE_CODE && r.fixUrl === "/welcome/business" && /Finish setting up your business/.test(r.fixLabel));
  ok("that link IS the welcome business screen", FINISH_SETUP_PATH === welcomePath("business"));
}
ok("hostile input never throws", [null, undefined, 7, "x", [], { name: {}, country: [] }].every((c) => Array.isArray(clientFacingGaps(c))));
{
  const gate = code("lib/signup/planGate.js");
  ok("every planOrRefusal route gets it (send, share, call, invoice, publish, campaign…)", /clientFacingRefusal\(company\)/.test(gate) && /reason: refusal\.code/.test(gate));
  ok("...never for a support session", /if \(!member\?\.impersonation && member\?\.companyId\)/.test(gate));
  ok("automated follow-ups ask it too", /clientFacingGaps\(company\)\.length === 0/.test(code("lib/followUps/readiness.js")));
  ok("the phone receptionist is not provisioned without it", /return \{ ok: false, reason: "business_profile_incomplete" \}/.test(code("lib/voice/provision.js")));
  ok("the public booking / self-quote pages have no company without it", /ready\(byBookingSlug\)/.test(code("lib/booking/findBookingCompany.js")));
  ok("the prompt the browser opens names it and links to it", /prompt\.reason === PROFILE_INCOMPLETE_CODE/.test(code("app/components/PlanRequiredPrompt.js")));
}

/* ── 5. The setup screen ────────────────────────────────────────────────── */
console.log("\n5. The setup screen shows only what runs, ticked by the server");
{
  const now = new Date("2026-10-06T00:00:00Z");
  const old = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
  const member = (company) => ({ role: "owner", company: { createdAt: old, ...company } });
  ok("a welcome company days old may run once every question is answered", setupStagesAllowed({ member: member({ onboardingStep: "setup" }), now, welcomeResume: "setup" }).ok);
  ok("...never before (services are priced in the currency the business screen sets)", setupStagesAllowed({ member: member({ onboardingStep: "business" }), now, welcomeResume: "business" }).code === "unanswered");
  ok("...never after personalizedAt (Settings re-seeds deliberately)", setupStagesAllowed({ member: member({ onboardingStep: "setup", personalizedAt: now }), now, welcomeResume: null }).code === "setup_window_closed");
  ok("a company from before the flow keeps the two-hour window", setupStagesAllowed({ member: member({}), now }).code === "setup_window_closed" && SETUP_WINDOW_MS === 2 * 60 * 60 * 1000);
  ok("a non-owner never runs it", setupStagesAllowed({ member: { role: "admin", company: { onboardingStep: "setup" } }, now, welcomeResume: "setup" }).status === 403);
  const plan = planSetupStages([{ id: "c1", key: "interior_painting", label: "Interior Painting" }]);
  ok("the server's plan: the trade's services, checklists and plans, templates — no stage that does not run", plan.map((s) => s.kind).join(",") === "services,checklists,templates");
  const start = initialStages([{ id: "c1", label: "Interior Painting" }]);
  ok("the screen's list is that plan between the answers confirmed and the dashboard", start.map((s) => s.key).join(",") === "company,services:c1,checklists,templates,dashboard");
  const active = applyStageEvent(start, "services:c1", "active", { names: ["Walls"], total: 9 });
  ok("names never arrive before the stage is done", !active.find((s) => s.key === "services:c1").names);
  const done = applyStageEvent(start, "services:c1", "done", { names: ["Walls", "Ceilings", 7, "", "<b>x</b>"], total: 12 });
  const s = done.find((x) => x.key === "services:c1");
  ok("on done: the names the server read back (strings only) and the real total", JSON.stringify(s.names) === '["Walls","Ceilings","<b>x</b>"]' && s.total === 12, JSON.stringify(s));
  const setup = code("app/api/signup/setup/route.js");
  ok("the names come from the Product rows the stage created, not the seed file", /seededServiceNames\(db, \{ companyId, categoryId: stage\.categoryId \}\)/.test(setup) && /seedKey: \{ not: null \}, categories: \{ some: \{ id: categoryId \} \}/.test(code("lib/signup/setupStages.js")));
  ok("personalizedAt is stamped when the run completes, before 'complete' is sent", setup.indexOf("personalizedAt: new Date()") < setup.indexOf('send({ type: "complete", failed });') && setup.indexOf("personalizedAt: new Date()") > 0);
  const comp = code("app/components/auth/SignupCreating.js");
  ok("the chips are drawn only for a finished services stage, with '+N others'", /welcome && s\.kind === "services" && s\.status === "done"/.test(comp) && /app\.welcome\.setup\.others/.test(comp));
  ok("no timer anywhere on the screen moves a stage", !/setInterval\(/.test(comp) && !/setInterval\(/.test(code("app/welcome/WelcomeFlow.js")));
}

/* ── 6. Did you know… ───────────────────────────────────────────────────── */
console.log("\n6. The facts beside the forms");
ok("exactly the three the owner approved", DID_YOU_KNOW.map((f) => f.key).join(",") === "every_feature,admin_hours,pay_by_card");
for (const f of DID_YOU_KNOW) {
  ok(`${f.key}: its source is product or arithmetic`, f.source === "product" || f.source === "arithmetic");
  if (f.source === "product") ok(`${f.key}: the file that makes it true exists (${f.ref})`, typeof f.ref === "string" && existsSync(f.ref));
  if (f.source === "arithmetic") {
    ok(`${f.key}: its figure is computed from named inputs`, typeof f.compute === "function" && f.inputs && Object.keys(f.inputs).length >= 3);
    ok(`${f.key}: the sentence types no result`, !/\d{1,3},\d{3}/.test(f.text) && /\{total\}/.test(f.text));
    ok(`${f.key}: 5 h × $25 × 52 weeks = $6,500`, yearlyAdminValue() === ADMIN_HOURS_SAVED_PER_WEEK * ADMIN_HOURLY_VALUE * WORKING_WEEKS_PER_YEAR && factValues(f).total === "$6,500" && factValues(f).rate === "$25");
    ok(`${f.key}: change an input and the sentence changes`, yearlyAdminValue({ hours: 4 }) === 4 * 25 * 52);
  }
  ok(`${f.key}: in the catalogue, with the same placeholders`, APP_MESSAGES.en[f.textKey] === f.text);
  for (const lang of Object.keys(APP_MESSAGES)) {
    const tr = APP_MESSAGES[lang][f.textKey];
    const holes = (s) => (String(s).match(/\{\w+\}/g) || []).sort().join(",");
    ok(`${f.key} (${lang}): translated, same placeholders`, typeof tr === "string" && holes(tr) === holes(f.text));
  }
}
ok("no performance statistic borrowed from anywhere", DID_YOU_KNOW.every((f) => !/%|\bmore jobs\b|\bwin rate\b|\baverage\b/i.test(f.text)));
ok("each screen shows one, in turn", factForStep("account", ["account", "profile"]).key === "every_feature" && factForStep("profile", ["account", "profile"]).key === "admin_hours");
{
  const aside = code("app/components/auth/WelcomeAside.js");
  ok("the aside's pictures are FieldQuo's own screenshots, files that exist", (aside.match(/"\/marketing\/[\w-]+\.webp"/g) || []).every((p) => existsSync(`public${p.slice(1, -1)}`)) && /hero-quotes/.test(aside));
}

/* ── 7. The strings ─────────────────────────────────────────────────────── */
console.log("\n7. Every new string in every app language");
{
  const en = APP_MESSAGES.en;
  const keys = Object.keys(en).filter((k) => k.startsWith("app.welcome.") || ["app.signup.consent", "app.signup.field.workEmail", "app.signup.trialDaysNoCard", "app.signup.startTrial", "app.signup.terms", "app.nextSteps.welcome.label", "app.nextSteps.yourBusiness"].includes(k));
  ok("the welcome namespace is in the catalogue", keys.length > 100, keys.length);
  const holes = (s) => (String(s).match(/\{\w+\}/g) || []).sort().join(",");
  for (const lang of Object.keys(APP_MESSAGES)) {
    const missing = keys.filter((k) => typeof APP_MESSAGES[lang][k] !== "string" || !APP_MESSAGES[lang][k].trim());
    const drifted = keys.filter((k) => typeof APP_MESSAGES[lang][k] === "string" && holes(APP_MESSAGES[lang][k]) !== holes(en[k]));
    ok(`${lang}: every key present`, missing.length === 0, missing.slice(0, 5).join(", "));
    ok(`${lang}: the same {placeholders} as English`, drifted.length === 0, drifted.slice(0, 5).join(", "));
  }
  ok("the trial sentence reads the constant, not a typed number", /TRIAL_DAYS/.test(code("app/signup/page.js")) && !/Free for 14 days/.test(code("app/signup/page.js")));
}

console.log(fails.length ? `\nFAILED — ${fails.length} of ${pass + fails.length}\n${fails.map((f) => `  ✗ ${f}`).join("\n")}` : `\nPASSED — ${pass}/${pass} assertions`);
process.exit(fails.length ? 1 : 0);
