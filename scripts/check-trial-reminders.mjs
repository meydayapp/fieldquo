// scripts/check-trial-reminders.mjs
//
//   npm run check:trial-reminders
//
// The card-free trial (2026-09-24): lib/billing/access.js trialAccessFor,
// lib/billing/trialReminder.js, lib/email/trialReminderEmail.js, the
// recommended rung, and the nudge that must NOT fire on it. Executed, not
// grepped: every boundary of the three windows and of the read-only week.
//
// Run: node --import ./scripts/alias-loader.mjs scripts/check-trial-reminders.mjs
import { readFileSync } from "node:fs";
import { trialReminderDecision, TRIAL_REMINDER_DAYS, trialReminderField } from "@/lib/billing/trialReminder";
import { trialAccessFor, accessFor, denyReason, GRACE_DAYS } from "@/lib/billing/access";
import { buildTrialReminderEmail } from "@/lib/email/trialReminderEmail";
import { recommendedTierFor } from "@/lib/billing/recommendedTier";
import { decideSignupNudge } from "@/lib/signup/abandoned";
import { APP_MESSAGES } from "@/app/i18n/appMessages";

let pass = 0;
const fails = [];
const ok = (cond, label) => { if (cond) pass++; else fails.push(label); };
const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-09-24T09:00:00Z");
const endIn = (days) => new Date(NOW.getTime() + days * DAY);

// ── trialAccessFor: the read-only week and the lock ────────────────────────
ok(trialAccessFor({ trialEndsAt: null }, NOW) === null, "no trialEndsAt → null (a demo or hand-made company is not on a trial)");
ok(trialAccessFor({}, NOW) === null, "no company fields → null");
{
  const a = trialAccessFor({ trialEndsAt: endIn(20) }, NOW);
  ok(a.level === "full" && a.reason === "trial_no_plan" && a.daysLeft === 20, "20 days out → full, trial_no_plan, 20 days");
}
ok(trialAccessFor({ trialEndsAt: new Date(NOW.getTime() + 1000) }, NOW).level === "full", "one second left is still the trial");
{
  const a = trialAccessFor({ trialEndsAt: new Date(NOW.getTime() - 1000) }, NOW);
  ok(a.level === "readonly" && a.reason === "trial_expired" && a.daysLeft === GRACE_DAYS, "one second past → read-only with the whole week");
}
{
  const a = trialAccessFor({ trialEndsAt: endIn(-(GRACE_DAYS - 1) - 0.5) }, NOW);
  ok(a.level === "readonly" && a.daysLeft === 1, "day 6.5 past → read-only, 1 day left");
}
{
  const a = trialAccessFor({ trialEndsAt: endIn(-GRACE_DAYS) }, NOW);
  ok(a.level === "locked" && a.reason === "trial_expired_locked" && a.daysLeft === 0, "exactly GRACE_DAYS past → locked");
}
ok(accessFor(null, NOW).reason === "no_subscription", "accessFor(null) is untouched — the no-row rule still says full");
{
  const d = denyReason(trialAccessFor({ trialEndsAt: endIn(-1) }, NOW), { method: "POST", pathname: "/api/quotes" });
  ok(d?.status === 402 && /free trial has ended/.test(d.error) && /Choose a plan/.test(d.error), "a write on an expired trial is a 402 that names the trial and says choose a plan");
  ok(denyReason(trialAccessFor({ trialEndsAt: endIn(-1) }, NOW), { method: "GET", pathname: "/api/quotes" }) === null, "…and a read is allowed");
  ok(denyReason(trialAccessFor({ trialEndsAt: endIn(-1) }, NOW), { method: "POST", pathname: "/api/platform/billing/checkout" }) === null, "…and paying is allowed");
  const l = denyReason(trialAccessFor({ trialEndsAt: endIn(-9) }, NOW), { method: "GET", pathname: "/api/quotes" });
  ok(l?.status === 402 && /read-only week is over/.test(l.error) && /nothing has been deleted/.test(l.error), "locked: the sentence says the data is safe");
}

// ── trialReminderDecision: three windows, one letter each ──────────────────
ok(TRIAL_REMINDER_DAYS.join(",") === "15,7,3", "the windows are 15, 7 and 3 days");
ok(trialReminderField(15) === "trialReminder15At" && trialReminderField(3) === "trialReminder3At", "the stamps are Company.trialReminder{N}At");
ok(trialReminderDecision({ trialEndsAt: endIn(10), isDemo: true, now: NOW }).reason === "demo", "a demo is never written to");
ok(trialReminderDecision({ trialEndsAt: endIn(10), hasSubscription: true, now: NOW }).reason === "plan_chosen", "a company with a Subscription row has chosen — renewalReminder's job");
ok(trialReminderDecision({ trialEndsAt: null, now: NOW }).reason === "no_trial_end", "no date → nothing claimed");
ok(trialReminderDecision({ trialEndsAt: endIn(-1), now: NOW }).reason === "trial_over", "past the end → nothing (the banner says it now)");
ok(trialReminderDecision({ trialEndsAt: endIn(16), now: NOW }).reason === "not_yet_in_window", "16 days out → not yet");
{
  const d = trialReminderDecision({ trialEndsAt: endIn(15), now: NOW });
  ok(d.send && d.days === 15 && d.field === "trialReminder15At" && d.daysLeft === 15, "15 days out → the 15-day letter, saying 15");
}
{
  const d = trialReminderDecision({ trialEndsAt: endIn(12), now: NOW });
  ok(d.send && d.days === 15 && d.daysLeft === 12, "12 days out with nothing sent → the 15-day letter, saying TWELVE (the real count)");
}
ok(trialReminderDecision({ trialEndsAt: endIn(12), stamps: { trialReminder15At: NOW }, now: NOW }).reason === "already_sent", "…and not twice");
{
  const d = trialReminderDecision({ trialEndsAt: endIn(7), stamps: { trialReminder15At: NOW }, now: NOW });
  ok(d.send && d.days === 7 && d.field === "trialReminder7At", "7 days out → the 7-day letter");
  ok(trialReminderDecision({ trialEndsAt: endIn(8), stamps: { trialReminder15At: NOW }, now: NOW }).reason === "already_sent", "8 days out is still the 15-day window, already sent");
}
{
  const d = trialReminderDecision({ trialEndsAt: endIn(3), stamps: { trialReminder15At: NOW, trialReminder7At: NOW }, now: NOW });
  ok(d.send && d.days === 3 && d.field === "trialReminder3At", "3 days out → the 3-day letter");
  const one = trialReminderDecision({ trialEndsAt: endIn(0.5), now: NOW });
  ok(one.send && one.days === 3 && one.daysLeft === 1, "half a day out with nothing ever sent → ONE letter (the 3-day one), never three stale ones");
}
ok(trialReminderDecision({ trialEndsAt: endIn(2), stamps: { trialReminder3At: NOW }, now: NOW }).reason === "already_sent", "the 3-day stamp holds the whole last window");

// ── The letter, in the company's language ──────────────────────────────────
{
  const rec = { label: "Crew", seats: 3, crewSeats: 8 };
  const en = buildTrialReminderEmail({ companyName: "Luma <Painting>", language: "en", daysLeft: 12, trialEndsOn: "Oct 24, 2026", graceDays: GRACE_DAYS, recommended: rec, billingUrl: "https://app.fieldquo.com/app/settings/account-billing?tier=crew" });
  ok(/ends in 12 days/.test(en.subject), "subject says the real count");
  ok(/Luma &lt;Painting&gt;/.test(en.html) && !/<Painting>/.test(en.html), "the company name is escaped");
  ok(/Oct 24, 2026/.test(en.html), "the end date is printed");
  ok(new RegExp(`read-only for ${GRACE_DAYS} days`).test(en.html), "the read-only week is stated from GRACE_DAYS");
  ok(/Nothing is ever deleted/.test(en.html), "nothing deleted, said out loud");
  ok(/Crew · 3 seats \+ 8 crew/.test(en.html), "the recommended rung is printed");
  ok(/account-billing\?tier=crew/.test(en.html) && /Choose a plan/.test(en.html), "one button, to the card the link named");
  ok(!/\$|CA\$|US\$/.test(en.html), "no price in the letter — the billing page prices, the browser never carries money");
  const none = buildTrialReminderEmail({ companyName: "X", language: "en", daysLeft: 3, trialEndsOn: "d", graceDays: GRACE_DAYS, recommended: null, billingUrl: "u" });
  ok(!/Recommended/.test(none.html), "no recommendation → the sentence is omitted, not invented");
  const one = buildTrialReminderEmail({ companyName: "X", language: "en", daysLeft: 1, trialEndsOn: "d", graceDays: GRACE_DAYS, billingUrl: "u" });
  ok(/ends tomorrow/.test(one.subject) && !/1 days/.test(one.html), "one day left reads as tomorrow, never '1 days'");
  const fr = buildTrialReminderEmail({ companyName: "X", language: "fr", daysLeft: 5, trialEndsOn: "d", graceDays: GRACE_DAYS, recommended: rec, billingUrl: "u" });
  ok(/Choisir un forfait/.test(fr.html) && /5 jours/.test(fr.subject), "French company, French letter");
  ok(!/\{\w+\}/.test(fr.html) && !/\{\w+\}/.test(en.html), "no placeholder left unfilled");
  for (const lang of Object.keys(APP_MESSAGES)) {
    const keys = ["app.trialReminder.subject", "app.trialReminder.intro", "app.trialReminder.after", "app.trialReminder.cta", "app.billingBanner.trialDays", "app.billingBanner.trialEndedDays", "app.billingBanner.choosePlan", "app.billingBanner.recommended", "app.signup.finishTrial"];
    ok(keys.every((k) => typeof APP_MESSAGES[lang][k] === "string" && APP_MESSAGES[lang][k].length > 0), `${lang} carries the trial strings`);
    ok(/\{grace\}/.test(APP_MESSAGES[lang]["app.trialReminder.after"]) && /\{days\}/.test(APP_MESSAGES[lang]["app.billingBanner.trialDays"]), `${lang} keeps the placeholders`);
  }
}

// ── The recommended rung ───────────────────────────────────────────────────
{
  const owner = { role: "owner", active: true };
  const crew = (n) => Array.from({ length: n }, () => ({ role: "employee", active: true, permissions: null }));
  ok(recommendedTierFor([owner]).tierKey === "solo", "an owner alone → Solo");
  const r = recommendedTierFor([owner, { role: "admin", active: true }, { role: "supervisor", active: true }, ...crew(8)]);
  ok(r.tierKey === "crew" && r.counts.seats === 3 && r.counts.crew === 8, "3 seats + 8 crew → Crew");
  ok(recommendedTierFor([owner, ...crew(20)]).tierKey === "scale", "one seat and twenty crew → Scale (crew may sit in spare seats)");
  ok(recommendedTierFor([owner, ...crew(120)]) === null, "past a hundred people → null, printed as nothing");
  ok(recommendedTierFor([owner, { role: "employee", active: false }]).counts.crew === 0, "an inactive member is not counted");
}

// ── The abandoned-signup nudge must not fire on a trial ────────────────────
{
  const base = { isDemo: false, subscription: null, memberCount: 1, email: "o@x.com", createdAt: new Date(NOW.getTime() - 3 * DAY) };
  ok(decideSignupNudge({ company: { ...base, trialEndsAt: endIn(27) }, now: NOW }).reason === "trial_no_plan", "a company on its trial is not 'you didn't finish signing up'");
  ok(decideSignupNudge({ company: { ...base, trialEndsAt: endIn(-3) }, now: NOW }).reason === "trial_no_plan", "…nor after it ends (the trial letters and the banner own that)");
  ok(decideSignupNudge({ company: base, now: NOW }).send === true, "a company with no trial date at all is still the old abandoned case");
}

// ── Wiring: the cron exists, is scheduled, and the columns are read ────────
{
  const vercel = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
  ok(vercel.crons.some((c) => c.path === "/api/cron/trial-reminders" && /^0 9 \* \* \*$/.test(c.schedule)), "vercel.json runs /api/cron/trial-reminders daily");
  const route = readFileSync(new URL("../app/api/cron/trial-reminders/route.js", import.meta.url), "utf8");
  ok(/subscription: \{ is: null \}/.test(route) && /isDemo: false/.test(route), "the cron reads only real companies with no Subscription row");
  ok(/\[field\]: null/.test(route) && /revert/.test(route), "the stamp is claimed on null and reverted on a failed send");
  const schema = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
  ok(/trialReminder15At\s+DateTime\?/.test(schema) && /trialReminder7At\s+DateTime\?/.test(schema) && /trialReminder3At\s+DateTime\?/.test(schema) && /signupTierKey\s+String\?/.test(schema), "the four Company columns exist");
  const companies = readFileSync(new URL("../app/api/companies/route.js", import.meta.url), "utf8");
  ok(/signupTierKey: plan \? null : chosenTier/.test(companies), "signup writes signupTierKey");
  const access = readFileSync(new URL("../app/api/settings/subscription/access/route.js", import.meta.url), "utf8");
  ok(/signupTierKey: true/.test(access), "…and the banner's route reads it");
  const banner = readFileSync(new URL("../app/components/layout/BillingBanner.js", import.meta.url), "utf8");
  ok(/trial_no_plan/.test(banner) && /trial_expired/.test(banner) && /signupTierKey/.test(banner), "the banner renders both trial states and carries the tier");
}

console.log(`\n${pass} passed, ${fails.length} failed`);
for (const f of fails) console.log(`  FAIL ${f}`);
process.exit(fails.length ? 1 : 0);
