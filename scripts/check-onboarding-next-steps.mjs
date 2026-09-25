// scripts/check-onboarding-next-steps.mjs
//
// The "finish setting up" letter (still "next steps" in the identifiers) —
// FieldQuo → a new company whose onboarding checklist is still open, about
// two hours after signup: on its card-free trial (every signup since
// 2026-09-24) or card-backed through the older checkout path.
//
// ══ What is executed ═══════════════════════════════════════════════════════
//
//   lib/signup/nextSteps.js         the timing rule, the settings
//                                   normalisation, the step → link mapping
//                                   and the social-proof gate, against a
//                                   company that finished in ninety minutes,
//                                   a row a week old, a delay of "abc", a
//                                   step key with a slash in it, and a
//                                   nine-company sample; and, since the
//                                   card-free trial: a trial company due, one
//                                   already sent, one that then subscribed
//                                   (no second letter), a demo, a suppressed
//                                   address, and `subscription` undefined
//                                   (must throw).
//   lib/email/onboardingNextStepsEmail.js
//                                   rendered in all eight languages, with
//                                   the trial line and the additional set-up
//                                   steps, with no trade,
//                                   with a hostile company name, with every
//                                   step done (must throw), with a language
//                                   the letter lacks (English, flagged),
//                                   with a real proof and with none.
//
// The claims — "only the open steps, in the checklist's order", "the Stripe
// row says it opens Stripe and keeps the payments page", "no unsubscribe, no
// mailing address, because it is transactional", "nothing printed under ten
// real companies" — are properties of the strings the builder returns, and a
// regex over the source would pass on a version that gets them wrong.
//
// ══ What is only read ══════════════════════════════════════════════════════
//
// That the cron is scheduled, claims before it sends and reverts on failure;
// that the schema carries the two columns; that the dashboard reads ?step=
// and the checklist card opens it; that the platform page prints the sent
// date; that the catalogue has every key in all eight languages. Structural,
// and said so.
//
// Run: node --import ./scripts/alias-loader.mjs scripts/check-onboarding-next-steps.mjs

import { readFileSync } from "node:fs";
import {
  DEFAULT_NEXT_STEPS_SETTINGS,
  NEXT_STEPS_DELAY_HOURS_MAX,
  NEXT_STEPS_MAX,
  NEXT_STEPS_PROOF_MIN_COMPANIES,
  NEXT_STEPS_WINDOW_HOURS,
  decideNextStepsEmail,
  firstQuoteProof,
  industrySlugsForTrade,
  NEXT_STEPS_MORE_MAX,
  nextStepHref,
  nextStepsDueRange,
  nextStepsTrialEndsAt,
  setupStepHref,
  nextStepsLanguage,
  nextStepsTradeKey,
  normaliseNextStepsSettings,
  validateNextStepsSettings,
} from "@/lib/signup/nextSteps";
import { ONBOARDING_NEXT_STEPS_PAIRS, buildOnboardingNextStepsEmail } from "@/lib/email/onboardingNextStepsEmail";
import { APP_MESSAGES } from "@/app/i18n/appMessages";
import { contrastRatio } from "@/lib/brand/colour";
import { POINTS, tradeSellingPoints } from "@/lib/sales/tradeSellingPoints";
import { LANGUAGE_CODES } from "@/app/i18n/languages";
import { remainingSteps, stepsFor } from "@/lib/setupSteps";

let pass = 0;
const fails = [];
const ok = (label, cond) => (cond ? (pass++, console.log(`  ok   ${label}`)) : fails.push(label));
const section = (title) => console.log(`\n${title}\n`);
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const stripComments = (src) => src.split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n");

const HOUR = 60 * 60 * 1000;
const now = new Date("2026-09-21T18:00:00Z");
const at = (hoursAgo) => new Date(now.getTime() - hoursAgo * HOUR);

const STEPS = [
  { key: "logo", labelKey: "app.onboarding.step.logo", label: "Add your logo and brand color", done: true, href: "/app/settings/branding" },
  { key: "business_info", labelKey: "app.onboarding.step.business_info", label: "Complete your business address and phone", done: false, href: "/app/settings" },
  { key: "services", labelKey: "app.onboarding.step.services", label: "Choose the services you offer", done: true, href: "/app/settings/services" },
  { key: "pricing", labelKey: "app.onboarding.step.pricing", label: "Set your pricing for at least one service", done: false, href: "/app/settings/services" },
  { key: "payments", labelKey: "app.onboarding.step.payments", label: "Connect Stripe to accept client payments", done: false, href: "/app/settings/payments" },
  { key: "tax_registration", labelKey: "app.onboarding.step.tax_registration", label: "Add your tax registration number", done: false, href: "/app/settings/company", nameKey: "app.taxReg.name.ca", whyKey: "app.taxReg.why.ca" },
];
const allDone = STEPS.map((s) => ({ ...s, done: true }));
const allOpen = STEPS.map((s) => ({ ...s, done: false }));

// ═══════════════════════════════════════════════════════════════════════════
section("1. Settings: junk falls to the default for that field, never to nothing");

ok("defaults are on at two hours", DEFAULT_NEXT_STEPS_SETTINGS.enabled === true && DEFAULT_NEXT_STEPS_SETTINGS.delayHours === 2);
ok("undefined → defaults", JSON.stringify(normaliseNextStepsSettings(undefined)) === JSON.stringify(DEFAULT_NEXT_STEPS_SETTINGS));
ok("an array → defaults", JSON.stringify(normaliseNextStepsSettings([1, 2])) === JSON.stringify(DEFAULT_NEXT_STEPS_SETTINGS));
ok('delayHours "abc" → 2, not 0 or NaN', normaliseNextStepsSettings({ delayHours: "abc" }).delayHours === 2);
ok("delayHours 0 → 2 (under the minimum is not a valid delay)", normaliseNextStepsSettings({ delayHours: 0 }).delayHours === 2);
ok("delayHours 500 → 2 (over the maximum)", normaliseNextStepsSettings({ delayHours: 500 }).delayHours === 2);
ok("delayHours 4 → 4", normaliseNextStepsSettings({ delayHours: 4 }).delayHours === 4);
ok("delayHours 2.3 → 2.25 (quarter hours)", normaliseNextStepsSettings({ delayHours: 2.3 }).delayHours === 2.25);
ok('enabled "false" (a string) → stays ON: only a stored false is off', normaliseNextStepsSettings({ enabled: "false" }).enabled === true);
ok("enabled false → off", normaliseNextStepsSettings({ enabled: false }).enabled === false);
ok("validate refuses a non-object", validateNextStepsSettings(null).ok === false && validateNextStepsSettings("x").ok === false);
ok("validate refuses an empty body", validateNextStepsSettings({}).ok === false);
ok('validate refuses enabled: "yes"', validateNextStepsSettings({ enabled: "yes" }).ok === false);
ok("validate refuses delayHours 500 and says the bounds", /72/.test(validateNextStepsSettings({ delayHours: 500 }).error || ""));
ok("validate accepts { enabled: false }", JSON.stringify(validateNextStepsSettings({ enabled: false }).value) === '{"enabled":false}');
ok("validate accepts delayHours 3 and leaves enabled alone", JSON.stringify(validateNextStepsSettings({ delayHours: 3 }).value) === '{"delayHours":3}');
ok("the maximum delay is three days", NEXT_STEPS_DELAY_HOURS_MAX === 72);

// ═══════════════════════════════════════════════════════════════════════════
section("2. The due range");

{
  const { earliest, latest } = nextStepsDueRange({ now, delayHours: 2 });
  ok("latest is now − 2 h", latest.getTime() === at(2).getTime());
  ok(`earliest is latest − ${NEXT_STEPS_WINDOW_HOURS} h`, earliest.getTime() === at(2 + NEXT_STEPS_WINDOW_HOURS).getTime());
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. The decision, on plain values");

// A card-backed company (the older checkout path) and a card-free trial
// company (every signup since 2026-09-24). Both are due from Company.createdAt.
const company = (hoursAgo = 2.5, extra = {}) => ({
  isDemo: false,
  email: "owner@example.com",
  createdAt: at(hoursAgo),
  trialEndsAt: new Date(at(hoursAgo).getTime() + 30 * 24 * HOUR),
  nextStepsEmailSentAt: null,
  nextStepsEmailSkipped: null,
  ...extra,
});
const incomplete = { complete: false, steps: STEPS };
const complete = { complete: true, steps: allDone };
const sub = (extra = {}) => ({ status: "trialing", nextStepsEmailSentAt: null, nextStepsEmailSkipped: null, ...extra });
const decide = (args) => decideNextStepsEmail({ subscription: sub(), company: company(), onboarding: incomplete, settings: {}, now, ...args });
const decideTrial = (args) => decide({ subscription: null, ...args });

ok("due: card-backed, signed up 2.5 h ago, checklist open, not a demo → send", decide({}).send === true && decide({}).reason === "due");
ok("not yet: signed up 90 min ago → wait, nothing recorded", (() => { const v = decide({ company: company(1.5) }); return v.send === false && v.reason === "not_yet_due" && !v.skip; })());
ok("too late: signed up a week ago → refused, nothing recorded", (() => { const v = decide({ company: company(7 * 24) }); return v.send === false && v.reason === "too_late" && !v.skip; })());
ok("a longer delay moves the due time: 4 h delay, signed up 3 h ago → not yet", decide({ settings: { delayHours: 4 }, company: company(3) }).reason === "not_yet_due");
ok("disabled → nothing, and no row is decided", (() => { const v = decide({ settings: { enabled: false } }); return v.send === false && v.reason === "disabled" && !v.skip; })());
ok("a demo company never gets it", decide({ company: company(2.5, { isDemo: true }) }).reason === "demo");
ok("already sent (on the company) → never again", decide({ company: company(2.5, { nextStepsEmailSentAt: at(0.1) }) }).reason === "already_sent");
ok("already decided against (on the company) → never revisited", decide({ company: company(2.5, { nextStepsEmailSkipped: "onboarding_complete" }) }).reason === "already_decided");
ok("sent under the OLD per-Subscription record → never again", decide({ subscription: sub({ nextStepsEmailSentAt: at(0.1) }) }).reason === "already_sent");
ok("…and decided against under it → never revisited", decide({ subscription: sub({ nextStepsEmailSkipped: "no_recipient" }) }).reason === "already_decided");
ok("a cancelled subscription → refused", decide({ subscription: sub({ status: "canceled" }) }).reason === "status_canceled");
ok("active (paid) is as good as trialing", decide({ subscription: sub({ status: "active" }) }).send === true);
ok("everything done at the due time → skip, RECORDED as onboarding_complete", (() => { const v = decide({ onboarding: complete }); return v.send === false && v.skip === "onboarding_complete"; })());
ok("complete:false but every step done (defensive) → the same skip", decide({ onboarding: { complete: false, steps: allDone } }).skip === "onboarding_complete");
ok("no address → skip, RECORDED as no_recipient", decide({ company: company(2.5, { email: "  " }) }).skip === "no_recipient");
ok("no onboarding status (read failed) → wait, nothing recorded", (() => { const v = decide({ onboarding: null }); return v.send === false && !v.skip; })());
ok("createdAt junk → refused, nothing recorded", (() => { const v = decide({ company: company(2.5, { createdAt: "yesterday" }) }); return v.send === false && v.reason === "no_created_at" && !v.skip; })());
ok("the checklist read fresh is what decides: same row, open then complete", decide({}).send === true && decide({ onboarding: complete }).send === false);

section("3b. The card-free trial — no Subscription row");

ok("TRIAL DUE: no Subscription, trial date, signed up 2.5 h ago, checklist open → send", (() => { const v = decideTrial({}); return v.send === true && v.reason === "due"; })());
ok("trial, 90 min in → not yet", decideTrial({ company: company(1.5) }).reason === "not_yet_due");
ok("trial ALREADY SENT (company stamped) → never again", decideTrial({ company: company(2.5, { nextStepsEmailSentAt: at(0.5) }) }).reason === "already_sent");
ok("trial that THEN SUBSCRIBED: the company stamp refuses the new Subscription path — no second letter", (() => {
  const v = decide({ company: company(2.5, { nextStepsEmailSentAt: at(1) }), subscription: sub({ status: "active" }) });
  return v.send === false && v.reason === "already_sent";
})());
ok("…and a trial company that subscribes on day twenty is outside the window whatever its new Subscription says", decide({ company: company(20 * 24), subscription: sub({ status: "active" }) }).reason === "too_late");
ok("trial DEMO → never", decideTrial({ company: company(2.5, { isDemo: true }) }).reason === "demo");
ok("trial, SUPPRESSED address → skip, RECORDED as suppressed", (() => { const v = decideTrial({ suppressed: true }); return v.send === false && v.skip === "suppressed"; })());
ok("card-backed, suppressed → the same refusal", decide({ suppressed: true }).skip === "suppressed");
ok("a suppressed address with the checklist already complete stays onboarding_complete (the truer reason)", decideTrial({ suppressed: true, onboarding: complete }).skip === "onboarding_complete");
ok("no Subscription and NO trial date (a console-made company) → outside, nothing recorded", (() => { const v = decideTrial({ company: company(2.5, { trialEndsAt: null }) }); return v.send === false && v.reason === "no_trial" && !v.skip; })());
ok("a trial the console ended early → not written to, nothing recorded", (() => { const v = decideTrial({ company: company(2.5, { trialEndsAt: at(1) }) }); return v.send === false && v.reason === "trial_ended" && !v.skip; })());
ok("SUBSCRIPTION UNDEFINED (not read) → throws, never read as 'no plan'", (() => {
  try { decideNextStepsEmail({ company: company(), onboarding: incomplete, settings: {}, now }); return false; } catch (e) { return /not read/.test(e.message); }
})());
ok("…and it throws even with the letter disabled — a caller bug is not a setting", (() => {
  try { decideNextStepsEmail({ company: company(), onboarding: incomplete, settings: { enabled: false }, now }); return false; } catch { return true; }
})());
ok("the trial date printed: only with no Subscription and a trial still running", (() => {
  const c = company();
  return nextStepsTrialEndsAt({ company: c, subscription: null, now })?.getTime() === c.trialEndsAt.getTime()
    && nextStepsTrialEndsAt({ company: c, subscription: sub(), now }) === null
    && nextStepsTrialEndsAt({ company: company(2.5, { trialEndsAt: at(1) }), subscription: null, now }) === null
    && nextStepsTrialEndsAt({ company: company(2.5, { trialEndsAt: "junk" }), subscription: null, now }) === null
    && nextStepsTrialEndsAt({ company: c, subscription: undefined, now }) === null;
})());

// ═══════════════════════════════════════════════════════════════════════════
section("4. Where each row's button lands");

ok("logo → /app?step=logo (the window on the home page)", nextStepHref({ key: "logo", href: "/app/settings/branding" }, "https://www.fieldquo.com") === "https://www.fieldquo.com/app?step=logo");
ok("pricing → /app?step=pricing", nextStepHref({ key: "pricing", href: "/app/settings/services" }, "https://www.fieldquo.com/") === "https://www.fieldquo.com/app?step=pricing");
ok("payments keeps the payments page — its window is one button that hands off to Stripe", nextStepHref({ key: "payments", href: "/app/settings/payments" }, "https://www.fieldquo.com") === "https://www.fieldquo.com/app/settings/payments");
ok("a hostile key (slash, angle bracket) → the home page, never interpolated", nextStepHref({ key: "../x<y" }, "https://www.fieldquo.com") === "https://www.fieldquo.com/app");
ok("no step at all → the home page", nextStepHref(null, "https://www.fieldquo.com") === "https://www.fieldquo.com/app");
ok("an additional step keeps its own page, ?from=setup before the #anchor", setupStepHref({ href: "/app/settings/overhead?from=setup#fixed-costs" }, "https://www.fieldquo.com/") === "https://www.fieldquo.com/app/settings/overhead?from=setup#fixed-costs");
ok("…a hostile href (another host, a script, angle brackets) → the home page", ["//evil.com/app", "javascript:alert(1)", "/app/x<y", "/appevil", "https://evil.com/app", 42, null].every((href) => setupStepHref({ href }, "https://www.fieldquo.com") === "https://www.fieldquo.com/app"));
ok("…every real set-up step's href survives it (none silently collapses to the home page)", stepsFor({}).every((st) => setupStepHref(st, "https://x.test") === `https://x.test${st.href}`));

// ═══════════════════════════════════════════════════════════════════════════
section("5. The trade behind a company");

ok("painting slug → painting", nextStepsTradeKey(["painting"]) === "painting");
ok("an unknown slug then a known one → the known one", nextStepsTradeKey(["nonsense", "roofing"]) === "roofing");
ok("no industries → null, never a guess", nextStepsTradeKey([]) === null && nextStepsTradeKey(undefined) === null && nextStepsTradeKey("painting") === null);
ok("the social-proof query's slugs for painting include painting", industrySlugsForTrade("painting").includes("painting"));
ok("…and an unknown trade has none", industrySlugsForTrade("nonsense").length === 0);
ok("language: fr-CA → fr; xx → en; undefined → en", nextStepsLanguage("fr-CA") === "fr" && nextStepsLanguage("xx") === "en" && nextStepsLanguage() === "en");
ok("language: every one of the eight document languages is its own; zh (not a document language) → en", LANGUAGE_CODES.every((l) => nextStepsLanguage(l) === l) && LANGUAGE_CODES.length === 8 && nextStepsLanguage("zh") === "en" && nextStepsLanguage("pa_IN") === "pa");

// ═══════════════════════════════════════════════════════════════════════════
section("6. Social proof is computed from real rows or not at all");

ok(`the minimum sample is ${NEXT_STEPS_PROOF_MIN_COMPANIES} companies`, NEXT_STEPS_PROOF_MIN_COMPANIES === 10);
ok("nine companies → null", firstQuoteProof(Array.from({ length: 9 }, (_, i) => 30 + i)) === null);
ok("junk is not a company: nine numbers and three strings → null", firstQuoteProof([...Array.from({ length: 9 }, (_, i) => 30 + i), "x", null, NaN]) === null);
ok("negative minutes (a quote before the company) are dropped", firstQuoteProof([...Array.from({ length: 9 }, (_, i) => 30 + i), -5]) === null);
{
  const p = firstQuoteProof([282, 1582, 10, 40, 60, 90, 120, 200, 300, 400]);
  ok("ten companies → the median (not the mean, which one outlier drags)", p && p.companies === 10 && p.medianMinutes === 160);
}
ok("an empty list → null", firstQuoteProof([]) === null && firstQuoteProof(undefined) === null);

// ═══════════════════════════════════════════════════════════════════════════
section("7. The letter, rendered");

const origin = "https://www.fieldquo.com";
const base = { companyName: "TrueFinish Cabinets", firstName: "Emilio", tradeKey: "painting", steps: STEPS, origin };
const en = buildOnboardingNextStepsEmail({ ...base, language: "en" });
const fr = buildOnboardingNextStepsEmail({ ...base, language: "fr" });
const es = buildOnboardingNextStepsEmail({ ...base, language: "es" });

ok("EN subject carries the company and the trade, and says finish setting up", en.subject === "TrueFinish Cabinets: finish setting up FieldQuo for your painting business");
ok("FR subject is French, Quebec colon spacing, trade phrase from the intro email's table", fr.subject === "TrueFinish Cabinets : terminez la configuration de FieldQuo pour votre entreprise de peinture");
ok("ES subject is Spanish", es.subject === "TrueFinish Cabinets: termine de configurar FieldQuo para su empresa de pintura");
ok("NOWHERE, in any language, 'you didn't finish signing up' — they did", LANGUAGE_CODES.every((l) => {
  const e = buildOnboardingNextStepsEmail({ ...base, language: l });
  return !/finish signing up|didn't finish|did not finish|terminé votre inscription|terminó su registro|sign(ed)? ?up (is|was) (not )?(finished|complete)/i.test(e.subject + e.text + e.html);
}));
ok("only the open steps are listed, in the checklist's order", JSON.stringify(en.open) === '["business_info","pricing","payments","tax_registration"]');
ok("the done ones are ticked", JSON.stringify(en.done) === '["logo","services"]');
ok("the numbered rows are numbered 1..4 in the text", /1\. Complete your business address/.test(en.text) && /4\. Add your GST\/HST number/.test(en.text));
ok("a done step is NOT in the numbered block", !/\d\. Add your logo/.test(en.text) && /✓ Add your logo and brand color/.test(en.text));
ok("each open step links into its window", en.links[0] === `${origin}/app?step=business_info` && en.links[1] === `${origin}/app?step=pricing` && en.links[3] === `${origin}/app?step=tax_registration`);
ok("the Stripe row keeps the payments page and says it opens Stripe", en.links[2] === `${origin}/app/settings/payments` && /opens Stripe/.test(en.text) && /opens Stripe/.test(en.html));
ok("the painter's pricing line is the painter's own quote sentence from the one table", en.tradeSpecific.includes("pricing") && en.text.includes(tradeSellingPoints("painting", "en").points.find((p) => p.key === "quotes").proof));
ok("…and in French it is the French one", fr.text.includes(tradeSellingPoints("painting", "fr").points.find((p) => p.key === "quotes").proof));
ok("the tax line is the country's own why-sentence", en.text.includes(APP_MESSAGES.en["app.taxReg.why.ca"]) && fr.text.includes(APP_MESSAGES.fr["app.taxReg.why.ca"]));
ok("the tax row names the registration the way the country does", /Add your GST\/HST number/.test(en.text) && /TPS\/TVH/.test(fr.text));
ok("FR greets by name", /^Bonjour Emilio,/m.test(fr.text) && /Hola, Emilio:/.test(es.text));
ok("the HTML is a document with the language on it", /<html lang="fr">/.test(fr.html) && /<html lang="es">/.test(es.html));
ok("no English leaks into the FR letter's own sentences", !/Still to do|Already done|Do this now|Open my home page/.test(fr.text) && !/Still to do|Already done|Do this now|Open my home page/.test(fr.html));
ok("no English leaks into the ES letter's own sentences", !/Still to do|Already done|Do this now|Open my home page/.test(es.text));

section("7b. Transactional: no unsubscribe, no mailing address, no weekly-digest promise");

const ONCE = { en: /once/, fr: /une seule fois/, es: /una sola vez/, de: /einmalig/, it: /una sola volta/, uk: /один раз/, pa: /ਇੱਕ ਵਾਰ/, tl: /isang beses/ };
for (const name of LANGUAGE_CODES) {
  const e = buildOnboardingNextStepsEmail({ ...base, language: name, setupSteps: remainingSteps(stepsFor({})), trialEndsAt: new Date("2026-10-21T18:00:00Z") });
  ok(`${name}: no unsubscribe / opt-out link`, !/unsubscribe|no-contact|Stop hearing|Ne plus recevoir|Dejar de recibir|désabonn|cancelar la suscripci|abmelden|disiscriv|відписат/i.test(e.html) && !/no-contact/.test(e.text));
  ok(`${name}: no "one email a week" control — no weekly digest exists`, !/digest|a week\b|per week|weekly|par semaine|hebdo|por semana|semanal|pro Woche|wöchentlich|a settimana|settimanal|на тиждень|щотижн|kada linggo|lingguhan/i.test(e.html));
  ok(`${name}: says it arrives once`, ONCE[name].test(e.text));
  ok(`${name}: never names the reference site`, !/homestars/i.test(e.html + e.text + e.subject));
}

section("7c. Hostile input");

ok("every step done → throws (the cron decides that before building)", (() => { try { buildOnboardingNextStepsEmail({ ...base, steps: allDone }); return false; } catch (e) { return /every step is done/.test(e.message); } })());
ok("no steps at all → throws", (() => { try { buildOnboardingNextStepsEmail({ ...base, steps: [] }); return false; } catch { return true; } })());
ok("steps not an array → throws rather than an empty letter", (() => { try { buildOnboardingNextStepsEmail({ ...base, steps: "logo" }); return false; } catch { return true; } })());
ok("an empty company name → throws (it is in the subject)", (() => { try { buildOnboardingNextStepsEmail({ ...base, companyName: "  " }); return false; } catch { return true; } })());
ok("a relative origin → throws", (() => { try { buildOnboardingNextStepsEmail({ ...base, origin: "/app" }); return false; } catch { return true; } })());
{
  const e = buildOnboardingNextStepsEmail({ ...base, language: undefined });
  ok("no language → English, and not flagged as a fallback", e.language === "en" && e.fallback === false);
}
{
  const e = buildOnboardingNextStepsEmail({ ...base, language: "zh" });
  ok("Chinese (not one of the eight document languages) → English, FLAGGED", e.language === "en" && e.fallback === true && /Still to do/.test(e.text));
}
{
  const e = buildOnboardingNextStepsEmail({ ...base, tradeKey: null });
  ok("no trade → the subject without a trade, never a guessed one", e.subject === "TrueFinish Cabinets: finish setting up FieldQuo" && !/home-service/.test(e.subject));
  ok("no trade → the pricing line is the generic quotes sentence, not trade-specific", e.tradeSpecific.length === 0 && /Build the quote from your own rates/.test(e.text));
}
{
  const e = buildOnboardingNextStepsEmail({ ...base, tradeKey: "not_a_trade" });
  ok("an unknown trade key behaves as no trade", e.subject === "TrueFinish Cabinets: finish setting up FieldQuo");
}
{
  const e = buildOnboardingNextStepsEmail({ ...base, firstName: null });
  ok("no first name → the unnamed greeting", /^Hi there,/m.test(e.text));
}
{
  const e = buildOnboardingNextStepsEmail({ ...base, companyName: `<script>alert(1)</script> & Sons` });
  ok("a hostile company name is escaped in the HTML", !/<script>/.test(e.html) && /&lt;script&gt;/.test(e.html) && /&amp; Sons/.test(e.html));
}
{
  const e = buildOnboardingNextStepsEmail({ ...base, steps: allOpen });
  ok(`six open steps → at most ${NEXT_STEPS_MAX} listed`, e.open.length === NEXT_STEPS_MAX && !e.open.includes("tax_registration"));
  ok("…and the intro counts what is listed", new RegExp(`with ${NEXT_STEPS_MAX} steps`).test(e.text));
}
{
  const one = STEPS.map((s) => ({ ...s, done: s.key !== "payments" }));
  const e = buildOnboardingNextStepsEmail({ ...base, steps: one });
  ok("one open step → the singular intro", /with one step of the setup still open/.test(e.text) && e.open.length === 1);
}
{
  const e = buildOnboardingNextStepsEmail({ ...base, steps: [{ key: "logo", done: false }, { key: 42, done: false }, null, { done: false }] });
  ok("rows without a string key are dropped; a row without a labelKey prints its catalogue label", e.open.length === 1 && /Add your logo and brand color/.test(e.text));
}

section("7d. Social proof prints only when given");

ok("no proof → no proof sentence", !/median|médiane|mediana/.test(en.text) && !/median/.test(en.html));
{
  const e = buildOnboardingNextStepsEmail({ ...base, proof: { companies: 12, medianMinutes: 282 } });
  ok("a real proof → the sentence, with the count and the median in hours and minutes", /The 12 painting businesses on FieldQuo sent their first quote a median of 4 h 42 min after signing up\./.test(e.text));
  const f = buildOnboardingNextStepsEmail({ ...base, language: "fr", proof: { companies: 12, medianMinutes: 45 } });
  ok("…in French too", /Les 12 entreprises de peinture sur FieldQuo ont envoyé leur première soumission 45 min \(médiane\)/.test(f.text));
  const noTrade = buildOnboardingNextStepsEmail({ ...base, tradeKey: null, proof: { companies: 12, medianMinutes: 45 } });
  ok("a proof with no trade to attribute it to prints nothing", !/median/.test(noTrade.text));
  const junk = buildOnboardingNextStepsEmail({ ...base, proof: { companies: "many", medianMinutes: null } });
  ok("junk proof prints nothing", !/median/.test(junk.text));
}

section("7f. The trial line and the additional set-up steps");

{
  const trialEnd = new Date("2026-10-21T18:00:00Z");
  // The card as a brand-new company sees it: nothing done, nothing hidden.
  const fresh = remainingSteps(stepsFor({}));
  const e = buildOnboardingNextStepsEmail({ ...base, setupSteps: fresh, trialEndsAt: trialEnd });
  ok("the trial line: one honest sentence with the date", e.trialLine === "Your free month runs until Oct 21, 2026." && e.text.includes(e.trialLine) && e.html.includes(e.trialLine));
  ok("no trial date → no trial line, never a guessed one", en.trialLine === null && !/free month/.test(en.text));
  ok(`the additional steps: at most ${NEXT_STEPS_MORE_MAX} named, in the card's order`, JSON.stringify(e.more) === JSON.stringify(fresh.slice(0, NEXT_STEPS_MORE_MAX).map((st) => st.key)));
  ok("…the rest counted, pointing at the home page", e.moreHidden === fresh.length - NEXT_STEPS_MORE_MAX && new RegExp(`and ${fresh.length - NEXT_STEPS_MORE_MAX} more on your home page`).test(e.text));
  ok("…under the card's own title", /Additional set-up steps/.test(e.text) && /Additional set-up steps/.test(e.html));
  ok("…each a link to its own page, ?from=setup kept", e.moreLinks.every((href, i) => href === `${origin}${fresh[i].href}`) && e.moreLinks.every((h) => /from=setup/.test(h)));
  ok("…each link is in the HTML", e.moreLinks.every((h) => e.html.includes(`href="${h.replace(/&/g, "&amp;")}"`)));
  // "overhead" is second on the card and has a selling point (job costing);
  // with the painter's list lacking it, the generic sentence is printed.
  const SETUP_POINT = { team: "scheduling", overhead: "job_costing", google_reviews: "review_requests", instant_quotes: "instant_quotes", availability: "booking_page", materials: "material_costs", add_ons: "add_on_upsell" };
  const withPoint = e.more.find((k) => SETUP_POINT[k]);
  ok(`…a listed step with a selling point carries it (${withPoint})`, Boolean(withPoint) && (
    e.tradeSpecific.includes(`setup:${withPoint}`)
      ? e.text.includes(tradeSellingPoints("painting", "en").points.find((p) => p.key === SETUP_POINT[withPoint]).proof)
      : e.text.includes(POINTS[SETUP_POINT[withPoint]].oneLiner.en)
  ));
  const story = e.more.find((k) => !SETUP_POINT[k]);
  ok(`…and one without a point (${story}) prints its title and link alone, no invented sentence`, Boolean(story) && (() => {
    const lines = e.text.split("\n");
    const at = lines.findIndex((l) => l.startsWith("- ") && l.includes("from=setup") && l.includes(APP_MESSAGES.en[`app.setup.step.${story}`]));
    // An unlock line is indented two spaces under its row; none may follow.
    return at >= 0 && !(lines[at + 1] || "").startsWith("  ");
  })());
  const dismissed = buildOnboardingNextStepsEmail({ ...base, setupSteps: fresh.map((st, i) => (i === 0 ? { ...st, dismissed: true } : st)) });
  ok("a row the company hid is not listed (the card has taken it away)", !dismissed.more.includes(fresh[0].key));
  const doneRow = buildOnboardingNextStepsEmail({ ...base, setupSteps: fresh.map((st, i) => (i === 0 ? { ...st, done: true } : st)) });
  ok("…nor a row that is done", !doneRow.more.includes(fresh[0].key));
  const none = buildOnboardingNextStepsEmail({ ...base, setupSteps: [] });
  ok("no additional steps left → no section at all", none.more.length === 0 && !/Additional set-up steps/.test(none.text));
  const junk = buildOnboardingNextStepsEmail({ ...base, setupSteps: "team" });
  ok("setupSteps junk → no section, not a crash", junk.more.length === 0);
  const hostile = buildOnboardingNextStepsEmail({ ...base, setupSteps: [{ key: "team", title: "<b>x</b>", titleKey: "nope.missing", href: "javascript:alert(1)" }] });
  ok("a hostile title is escaped and a hostile href becomes the home page", !/<b>x<\/b>/.test(hostile.html) && hostile.moreLinks[0] === `${origin}/app`);
}

section("7g. Eight languages, and no English trade sentence in the other five");

{
  const trialEnd = new Date("2026-10-21T18:00:00Z");
  const fresh = remainingSteps(stepsFor({}));
  const EN_OWN = ["Still to do", "Already done", "Do this now", "Open my home page", "Your free month", "Additional set-up steps", "more on your home page"];
  for (const l of LANGUAGE_CODES) {
    // 4817, not 12: the proof's company count must be a number nothing else
    // in the letter can print. It was 12 until "Confirm what you quote" made
    // seventeen set-up steps — five shown and "12 more" — and the absence
    // check below then matched the step count, not a proof sentence.
    const e = buildOnboardingNextStepsEmail({ ...base, language: l, setupSteps: fresh, trialEndsAt: trialEnd, proof: { companies: 4817, medianMinutes: 45 } });
    ok(`${l}: rendered in ${l}, not flagged`, e.language === l && e.fallback === false && new RegExp(`<html lang="${l}">`).test(e.html));
    ok(`${l}: the trial line is there, with a date in ${l}`, typeof e.trialLine === "string" && e.trialLine.length > 0 && !/\{date\}/.test(e.trialLine));
    ok(`${l}: no unfilled {placeholder}`, !/\{(company|trade|count|name|when|date)\}/.test(e.subject + e.text + e.html));
    if (l !== "en") ok(`${l}: none of the letter's own English sentences leak`, EN_OWN.every((x) => !e.text.includes(x)));
    if (!["en", "fr", "es"].includes(l)) {
      const enPoints = Object.values(POINTS).flatMap((p) => [p.oneLiner.en, p.proof.en]);
      const tradeEn = tradeSellingPoints("painting", "en").points.map((p) => p.proof);
      ok(`${l}: no English trade sentence (the table is en/fr/es only)`, [...enPoints, ...tradeEn].every((x) => !e.text.includes(x)));
      ok(`${l}: the subject is the one without a trade, and no social-proof sentence`, !/painting/.test(e.subject) && !/\b4817\b/.test(e.text));
      ok(`${l}: the pricing and Stripe rows carry the catalogue's ${l} sentence`, e.text.includes(APP_MESSAGES[l]["app.nextSteps.unlock.pricing"]) && e.text.includes(APP_MESSAGES[l]["app.nextSteps.unlock.payments"]));
    }
  }
}

section("7e. Contrast, measured");

for (const pair of ONBOARDING_NEXT_STEPS_PAIRS) {
  const ratio = contrastRatio(pair.fg, pair.bg);
  ok(`${pair.name}: ${pair.fg} on ${pair.bg} is ${ratio.toFixed(2)}:1 (≥ 4.5)`, ratio >= 4.5);
}

// ═══════════════════════════════════════════════════════════════════════════
section("8. The catalogue has every key in the letter's eight languages");

const KEYS = ["subject", "subjectNoTrade", "heading", "greeting", "greetingNamed", "introOne", "introMany", "stepsIntro", "doneIntro", "openStep", "opensStripe", "unlock.logo", "unlock.business_info", "unlock.services", "unlock.pricing", "unlock.payments", "proof", "homeCta", "footer", "trialLine", "moreRemaining"];
for (const lang of LANGUAGE_CODES) {
  const missing = KEYS.filter((k) => typeof APP_MESSAGES[lang][`app.nextSteps.${k}`] !== "string");
  ok(`${lang}: all ${KEYS.length} app.nextSteps.* keys present`, missing.length === 0);
}
ok("no language's sentences are the English ones", LANGUAGE_CODES.filter((l) => l !== "en").every((l) => KEYS.every((k) => APP_MESSAGES[l][`app.nextSteps.${k}`] !== APP_MESSAGES.en[`app.nextSteps.${k}`])));
ok("every language keeps every placeholder its English carries", LANGUAGE_CODES.every((l) => KEYS.every((k) => {
  const want = (APP_MESSAGES.en[`app.nextSteps.${k}`].match(/\{\w+\}/g) || []).sort().join();
  const got = (APP_MESSAGES[l][`app.nextSteps.${k}`].match(/\{\w+\}/g) || []).sort().join();
  return want === got;
})));

// ═══════════════════════════════════════════════════════════════════════════
section("9. Structural — the wiring (read, not executed)");

const schema = read("prisma/schema.prisma");
const block = (model) => { const b = schema.slice(schema.indexOf(`model ${model} {`)); return b.slice(0, b.indexOf("\n}")); };
ok("Company carries nextStepsEmailSentAt (the lock for every company)", /nextStepsEmailSentAt\s+DateTime\?/.test(block("Company")));
ok("…and nextStepsEmailSkipped", /nextStepsEmailSkipped\s+String\?/.test(block("Company")));
ok("Subscription keeps its two columns — the record of letters sent before the move", /nextStepsEmailSentAt\s+DateTime\?/.test(block("Subscription")) && /nextStepsEmailSkipped\s+String\?/.test(block("Subscription")));

const cron = stripComments(read("app/api/cron/onboarding-next-steps/route.js"));
ok("the cron is behind the cron secret", /requireCronSecret\(request\)/.test(cron));
ok("the cron reads the platform setting on every run", /loadNextStepsSettings\(\)/.test(cron));
ok("the cron lists COMPANIES, demos excluded in the query", /db\.company\.findMany\(\{\s*where:\s*\{\s*isDemo:\s*false,/.test(cron));
ok("…due from Company.createdAt", /createdAt:\s*\{\s*gte:\s*earliest,\s*lte:\s*latest\s*\}/.test(cron));
ok("…both paths: the card-free trial (no Subscription, a trial date) and a live, unstamped Subscription", /\{ subscription: \{ is: null \}, trialEndsAt: \{ not: null \} \}/.test(cron) && /status: \{ in: \["active", "trialing"\] \},\s*nextStepsEmailSentAt: null,\s*nextStepsEmailSkipped: null/.test(cron));
const claimAt = cron.indexOf("db.company.updateMany({\n      where: { id: companyId, nextStepsEmailSentAt: null, nextStepsEmailSkipped: null },\n      data: { nextStepsEmailSentAt: now }");
ok("the cron claims the COMPANY with both columns null BEFORE any fresh read", claimAt > 0 && claimAt < cron.indexOf("getOnboardingStatus(companyId)") && claimAt < cron.indexOf("checkSuppression("));
ok("no write to Subscription's old columns anywhere in the cron", !/subscription\.update/.test(cron));
ok("the checklist, the set-up steps and the company are read fresh after the claim", /await getOnboardingStatus\(companyId\)/.test(cron) && /remainingSteps\(stepsFor\(await loadSetupSnapshot\(companyId\)\)\)/.test(cron) && /db\.company\.findUnique\(\{ where: \{ id: companyId \}, select: COMPANY_SELECT \}\)/.test(cron));
ok("the Subscription is always selected, so the decision never sees undefined", /subscription: \{ select: \{ id: true, status: true, nextStepsEmailSentAt: true, nextStepsEmailSkipped: true \} \}/.test(cron) && /subscription: company\.subscription \?\? null/.test(cron));
ok("the do-not-contact list is read in the request that sends, and a failed read reverts (fails closed)", /checkSuppression\(db, \{ channel: "email", email: to \}\)/.test(cron) && /await revert\(\);\s*\n\s*note\("suppression_read_failed"\)/.test(cron));
ok("a reserved test address is refused at the point of sending", /isReservedTestAddress\(to\)/.test(cron));
ok("a decision against is recorded on the company", /nextStepsEmailSkipped: skip/.test(cron));
ok("the letter gets the set-up steps and the trial date", /setupSteps,\n/.test(cron) && /trialEndsAt: nextStepsTrialEndsAt\(/.test(cron));
ok("a failed send reverts the claim", /result\?\.skipped \|\| result\?\.error/.test(cron) && /await revert\(\);\s*\n\s*note\(result\.error/.test(cron));
ok("a failed build reverts the claim", /catch \(err\) \{\s*\n\s*await revert\(\);\s*\n\s*note\("build_failed"\)/.test(cron));
ok("the send goes through the one Resend seam with the tenant on it", /sendEmail\(\{ companyId, from, to/.test(cron));
ok("the sender is the discovered platform sender, never a hardcoded From", /getPlatformFrom\(\)/.test(cron) && !/resend\.dev/.test(cron));
ok("the social proof is the real-rows helper, gated by the pure minimum", /firstQuoteProof\(await firstQuoteMinutesForTrade/.test(cron));

const vercel = JSON.parse(read("vercel.json"));
const entry = vercel.crons.find((c) => c.path === "/api/cron/onboarding-next-steps");
ok("the cron is scheduled in vercel.json — a route with no entry never runs", Boolean(entry));
ok("…every fifteen minutes, so 'about two hours' is two-to-two-and-a-quarter", /^\d+,\d+,\d+,\d+ \* \* \* \*$/.test(entry?.schedule || "") || entry?.schedule === "*/15 * * * *");

const page = stripComments(read("app/app/page.js"));
ok("the dashboard reads ?step= on mount", /params\?\.get\("step"\)/.test(page));
ok("…strips it from the URL so a refresh does not reopen it", /if \(backFromStripe \|\| step(?: \|\| wantsTour)?\) \{\s*\n\s*window\.history\.replaceState/.test(page));
ok("…and hands it to the checklist card", /openStepKey=\{openStepKey\}/.test(page));
const card = stripComments(read("app/components/dashboard/OnboardingProgress.js"));
ok("the checklist card opens that step's dialog once the list has loaded", /if \(step && !step\.done && canOpenInPlace && hasStepPanel\(step\.key\)\) open\(step\);/.test(card));
ok("…and only for a member who may save inside it", /canOpenInPlace && hasStepPanel/.test(card));

const detail = stripComments(read("app/platform/companies/[id]/CompanyDetail.js"));
ok("the platform company page prints when the letter went out — company record first, the old Subscription one after", /company\.nextStepsEmailSentAt \|\| sub\?\.nextStepsEmailSentAt/.test(detail) && /Next-steps email/.test(detail));
ok("…and why it did not", /onboarding_complete/.test(detail) && /no_recipient/.test(detail) && /"suppressed"/.test(detail));
ok("…for a card-free trial company too (no Subscription row)", /\(sub \|\| company\.trialEndsAt\) &&/.test(detail));

const settingsRoute = stripComments(read("app/api/platform/onboarding-email/route.js"));
ok("the settings route writes only for a superadmin, validated, audit-logged", /superadminOrRefusal\(request\)/.test(settingsRoute) && /validateNextStepsSettings\(body\)/.test(settingsRoute) && /onboarding_next_steps_email_updated/.test(settingsRoute));
ok("the audit catalogue knows the action", /onboarding_next_steps_email_updated:/.test(read("lib/platform/auditActions.js")));
// The sample: the real path, to the superadmin's own row's address only.
ok("the sample POST is superadmin-only", /export async function POST/.test(settingsRoute) && settingsRoute.indexOf("superadminOrRefusal(request)", settingsRoute.indexOf("export async function POST")) > 0);
ok("…sent to the address on the admin's own row, read fresh, never one from the body", /platformAdmin\.findUnique\(\{ where: \{ id: admin\.id \}/.test(settingsRoute) && /sendEmail\(\{ from, to,/.test(settingsRoute) && !/to: body/.test(settingsRoute));
ok("…marks nothing on the company (no company or subscription write in the sample path)", !/(subscription|company)\.update/.test(settingsRoute.slice(settingsRoute.indexOf("export async function POST"))));
ok("…and is the real letter: set-up steps and trial date read the way the cron reads them", /remainingSteps\(stepsFor\(await loadSetupSnapshot\(company\.id\)\)\)/.test(settingsRoute) && /nextStepsTrialEndsAt\(/.test(settingsRoute));
ok("the sent count adds the company record and the old Subscription record", /db\.company\.count\(\{ where: \{ nextStepsEmailSentAt: \{ not: null \} \} \}\)/.test(settingsRoute) && /db\.subscription\.count/.test(settingsRoute));
ok("…prefixes the subject so it cannot pass for the real letter", /\[sample\] \$\{email\.subject\}/.test(settingsRoute));
ok("…is audit-logged under a catalogued action", /onboarding_next_steps_email_sampled/.test(settingsRoute) && /onboarding_next_steps_email_sampled:/.test(read("lib/platform/auditActions.js")));
const settingsCard = stripComments(read("app/platform/companies/NextStepsEmailCard.js"));
ok("the console card draws the editor from the shared gate's isSuperadmin", /usePlatformAdmin/.test(settingsCard) && /isSuperadmin \?/.test(settingsCard));
ok("…and is mounted on /platform/companies", /<NextStepsEmailCard \/>/.test(read("app/platform/companies/page.js")));
ok("…and no longer says the letter waits for a card", !/card goes in|subscription starts|after checkout/i.test(settingsCard));
ok("…and offers the sample in all eight languages", /LANGUAGES\.map/.test(settingsCard));

const pkg = JSON.parse(read("package.json"));
ok("this check is wired into check:all", /check:onboarding-next-steps/.test(pkg.scripts["check:all"]) && Boolean(pkg.scripts["check:onboarding-next-steps"]));

const doc = read("docs/ONBOARDING-EMAILS.md");
ok("docs/ONBOARDING-EMAILS.md lists this letter with its time", /next-steps|Next steps/i.test(doc) && /2 h/.test(doc));

console.log(
  fails.length
    ? `\nFAILED — ${fails.length} of ${pass + fails.length}\n${fails.map((f) => `  ✗ ${f}`).join("\n")}`
    : `\nPASSED — ${pass}/${pass} assertions`,
);
process.exit(fails.length ? 1 : 0);
