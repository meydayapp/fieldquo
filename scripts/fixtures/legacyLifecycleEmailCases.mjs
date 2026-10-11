// scripts/fixtures/legacyLifecycleEmailCases.mjs
//
// The inputs the four letters that existed before the shared layout
// (lib/email/platformLayout.js, 2026-10-11) were built from, for
// scripts/check-platform-email-layout.mjs's before/after proof: the next-steps
// letter, the 7/3/1 trial reminder, the five-minute signup nudge and the
// signup-recovery note. Each case is a plain object of builder arguments; the
// check builds every case with today's code and compares the md5 of its text
// part with the md5 recorded from the code as it stood at 3c5cab740, before
// any of the four moved onto the layout.
//
// Hostile values on purpose — a "<script>" company name, an "&" in a name, a
// language the letters do not carry — because a layout move that changed
// escaping or a fallback would show up there first.

const origin = "https://www.fieldquo.com";
const STEPS = [
  { key: "logo", labelKey: "app.onboarding.step.logo", label: "Add your logo and brand color", done: true, href: "/app/settings/branding" },
  { key: "business_info", labelKey: "app.onboarding.step.business_info", label: "Complete your business address and phone", done: false, href: "/app/settings" },
  { key: "services", labelKey: "app.onboarding.step.services", label: "Choose the services you offer", done: true, href: "/app/settings/services" },
  { key: "pricing", labelKey: "app.onboarding.step.pricing", label: "Set your pricing for at least one service", done: false, href: "/app/settings/services" },
  { key: "payments", labelKey: "app.onboarding.step.payments", label: "Connect Stripe to accept client payments", done: false, href: "/app/settings/payments" },
  { key: "tax_registration", labelKey: "app.onboarding.step.tax_registration", label: "Add your tax registration number", done: false, href: "/app/settings/company", nameKey: "app.taxReg.name.ca", whyKey: "app.taxReg.why.ca" },
];
const SETUP = [
  { key: "team", titleKey: "app.setup.step.team", title: "Invite your team", href: "/app/settings/team?from=setup" },
  { key: "availability", titleKey: "app.setup.step.availability", title: "Check your availability for bookings", href: "/app/settings/availability?from=setup#bookable" },
  { key: "google_reviews", titleKey: "app.setup.step.google_reviews", title: "Connect Google reviews", href: "/app/settings/reviews?from=setup" },
];
const LANGS = ["en", "fr", "es", "it", "de", "uk", "pa", "tl", "zh", "xx"];

export const NEXT_STEPS_CASES = [];
for (const language of LANGS) {
  NEXT_STEPS_CASES.push({
    name: `next-steps/${language}/painter`,
    args: {
      companyName: "Northline Painting & Sons",
      firstName: "Maya",
      language,
      tradeKey: "painting",
      steps: STEPS,
      setupSteps: SETUP,
      trialEndsAt: new Date("2026-10-21T15:00:00Z"),
      origin,
      proof: { companies: 12, medianMinutes: 95 },
    },
  });
}
NEXT_STEPS_CASES.push({
  name: "next-steps/en/hostile-no-trade-welcome",
  args: {
    companyName: "",
    language: "en",
    tradeKey: null,
    steps: STEPS.map((s) => ({ ...s, done: false })),
    setupSteps: [],
    origin,
    welcomeStep: "business",
  },
});
NEXT_STEPS_CASES.push({
  name: "next-steps/fr/script-name",
  args: { companyName: "<script>alert(1)</script> & Fils", language: "fr", tradeKey: "roofing", steps: STEPS, setupSteps: SETUP, origin },
});

export const TRIAL_REMINDER_CASES = [];
for (const language of LANGS) {
  for (const daysLeft of [7, 3, 1]) {
    TRIAL_REMINDER_CASES.push({
      name: `trial-reminder/${language}/${daysLeft}`,
      args: {
        companyName: "Northline <Painting> & Sons",
        language,
        daysLeft,
        trialEndsOn: "Oct 21, 2026",
        graceDays: 7,
        recommended: daysLeft === 3 ? { label: "Crew", seats: 3, crewSeats: 5 } : null,
        billingUrl: `${origin}/app/settings/account-billing?tier=crew&x=<y>`,
      },
    });
  }
}

const ADDRESS = "FieldQuo, 123 Example St, Toronto ON M5V 1A1, Canada";
export const EARLY_NUDGE_CASES = [];
for (const language of LANGS) {
  for (const tradeKey of ["painting", null]) {
    EARLY_NUDGE_CASES.push({
      name: `early-nudge/${language}/${tradeKey || "none"}`,
      args: {
        firstName: language === "en" ? "Maya" : null,
        companyName: tradeKey ? "Northline & Sons" : null,
        language,
        tradeKey,
        resumeUrl: `${origin}/signup?resume=abc`,
        optOutUrl: `${origin}/no-contact/tok123`,
        mailingAddress: ADDRESS,
      },
    });
  }
}

export const RECOVERY_CASES = [];
for (const language of LANGS) {
  RECOVERY_CASES.push({
    name: `recovery/${language}`,
    args: {
      companyName: language === "fr" ? "" : "Northline <b>&</b> Sons",
      language,
      finishUrl: `${origin}/app/settings/account-billing`,
      helpUrl: `${origin}/contact`,
      optOutUrl: `${origin}/no-contact/tok456`,
      mailingAddress: ADDRESS,
    },
  });
}
