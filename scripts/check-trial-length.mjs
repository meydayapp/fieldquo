// scripts/check-trial-length.mjs
//
//   npm run check:trial-length
//
// The 14-day trial (owner decision 2026-09-29). New signups get TRIAL_DAYS
// free, no card; everyone already on a trial keeps the trialEndsAt they were
// given; the referral month composes on top exactly as before; the reminders
// are 7/3/1; and no screen, email, help article or catalogue in any language
// still says "first month free" about the trial.
//
// Executed where the rule is a function (trialDaysAllowed, the reminder
// windows, the referral arithmetic), read where it is wiring (the one line in
// /api/companies that stamps the date), and grepped where it is copy — with an
// allowlist for the wording that is NOT about the trial: the referral month,
// the annual "months free", a sale's "for the first month", a phone number's
// first month of rental.
//
// Run: node --import ./scripts/alias-loader.mjs scripts/check-trial-length.mjs
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { TRIAL_DAYS, TRIAL_CARD_REQUIRED, TRIAL_PRICE, trialLabel } from "@/lib/pricing";
import { trialDaysAllowed } from "@/lib/billing/trialOnce";
import { TRIAL_REMINDER_DAYS, trialReminderDecision } from "@/lib/billing/trialReminder";
import { trialAccessFor, GRACE_DAYS } from "@/lib/billing/access";
import { addMonths } from "@/lib/referrals/extendAccess";

let pass = 0;
const fails = [];
const ok = (cond, label, detail) => {
  if (cond) pass++;
  else fails.push(detail === undefined ? label : `${label}\n      ${typeof detail === "string" ? detail : JSON.stringify(detail)}`);
};
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const DAY = 24 * 60 * 60 * 1000;

// ── 1. The constants ───────────────────────────────────────────────────────
ok(TRIAL_DAYS === 14, "TRIAL_DAYS is 14");
ok(TRIAL_CARD_REQUIRED === false, "TRIAL_CARD_REQUIRED is false");
ok(TRIAL_PRICE === 0 && trialLabel() === "14 days free", "trialLabel() says 14 days free", trialLabel());
ok(trialLabel(1) === "$1 for your first 14 days", "…and a paid trial would say the amount and the days", trialLabel(1));

// ── 2. A new signup: trialEndsAt = now + TRIAL_DAYS ────────────────────────
// Oct 1 → Oct 15: full access until then.
const OCT1 = new Date("2026-10-01T15:00:00Z");
const signupEnd = new Date(OCT1.getTime() + TRIAL_DAYS * DAY);
ok(signupEnd.toISOString() === "2026-10-15T15:00:00.000Z", "signed up Oct 1 → trial ends Oct 15", signupEnd.toISOString());
ok(trialDaysAllowed({ trialUsedAt: null, trialEndsAt: signupEnd }, { now: OCT1 }) === 14, "Stripe would be asked for 14 trial days on a plan chosen at signup");
ok(trialAccessFor({ trialEndsAt: signupEnd }, new Date("2026-10-14T15:00:00Z")).level === "full", "day 13: full access");
{
  const after = trialAccessFor({ trialEndsAt: signupEnd }, new Date("2026-10-16T15:00:00Z"));
  ok(after.level === "readonly" && after.reason === "trial_expired", "Oct 16, no plan: read-only (the existing card-free lock)", after);
  const locked = trialAccessFor({ trialEndsAt: signupEnd }, new Date(signupEnd.getTime() + (GRACE_DAYS + 1) * DAY));
  ok(locked.level === "locked", `after the ${GRACE_DAYS} read-only days: locked`, locked);
}

// The stamp is TRIAL_DAYS, in the one place a company row is created.
{
  const route = read("app/api/companies/route.js");
  ok(/trialEndsAt: new Date\(Date\.now\(\) \+ TRIAL_DAYS \* 24 \* 60 \* 60 \* 1000\)/.test(route), "/api/companies stamps trialEndsAt from TRIAL_DAYS");
  ok(!/30 \* 24 \* 60 \* 60 \* 1000/.test(route), "…and no 30-day literal is left in it");
  const create = route.slice(route.indexOf("tx.company.create("), route.indexOf("tx.member.create("));
  ok(/TRIAL_DAYS/.test(create), "…inside tx.company.create — a new row, never an update");
}

// Existing rows are never rewritten. TRIAL_DAYS is read by the code that
// CREATES a trial and by copy; nothing that imports it writes trialEndsAt on
// an update. (Walked, not listed, so a new importer is checked too.)
{
  const importers = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (name === "node_modules" || name.startsWith(".")) continue;
      const st = statSync(p);
      if (st.isDirectory()) walk(p);
      else if (/\.(m?js)$/.test(name) && /\bTRIAL_DAYS\b/.test(readFileSync(p, "utf8"))) importers.push(p);
    }
  };
  walk(new URL("../app", import.meta.url).pathname);
  walk(new URL("../lib", import.meta.url).pathname);
  const writers = importers.filter((p) => {
    const src = readFileSync(p, "utf8");
    return /\.(update|updateMany|upsert)\(\{[\s\S]{0,400}trialEndsAt:/.test(src);
  });
  ok(importers.length > 0, "TRIAL_DAYS has readers", importers);
  ok(writers.length === 0, "no file that reads TRIAL_DAYS updates an existing trialEndsAt", writers);
}

// Stripe: the trial checkout's default is the constant, and every real
// caller derives the days from trialEndsAt (so a 30-day legacy company
// choosing a plan still gets ITS remaining days, and a new one gets 14).
{
  const stripe = read("lib/platform/stripeBilling.js");
  ok(/trialDays = TRIAL_DAYS,/.test(stripe) && !/trialDays = 30/.test(stripe), "createTrialCheckoutSession defaults to TRIAL_DAYS, not 30");
  const legacyEnd = new Date(OCT1.getTime() + 20 * DAY); // a 30-day trial with 20 days left
  ok(trialDaysAllowed({ trialUsedAt: null, trialEndsAt: legacyEnd }, { now: OCT1 }) === 20, "a legacy 30-day trial choosing a plan keeps its own 20 days — nothing is cut to 14");
}

// ── 3. The referral month composes on top, unchanged ──────────────────────
// lib/referrals/index.js applySignupReferral: base = the company's trialEndsAt
// (if still ahead) else now; new end = base + REFEREE_BONUS_MONTHS calendar
// months. Only the base moved.
{
  const src = read("lib/referrals/index.js");
  ok(/export const REFEREE_BONUS_MONTHS = 1;/.test(src), "REFEREE_BONUS_MONTHS is still 1");
  ok(/company\.trialEndsAt && company\.trialEndsAt > new Date\(\)\s*\?\s*company\.trialEndsAt\s*:\s*new Date\(\)/.test(src) &&
     /const trialEndsAt = addMonths\(base, REFEREE_BONUS_MONTHS\);/.test(src),
     "the composition is still base trialEndsAt + one calendar month");
  // Worked example. Before: Oct 1 + 30d = Oct 31, + 1 month = Nov 30 (60 days).
  // Now:               Oct 1 + 14d = Oct 15, + 1 month = Nov 15 (45 days).
  const before = addMonths(new Date(OCT1.getTime() + 30 * DAY), 1);
  const now = addMonths(signupEnd, 1);
  ok(before.toISOString().slice(0, 10) === "2026-11-30", "before: Oct 1 referral signup ran to Nov 30", before.toISOString());
  ok(now.toISOString().slice(0, 10) === "2026-11-15", "now: Oct 1 referral signup runs to Nov 15", now.toISOString());
  ok(trialDaysAllowed({ trialEndsAt: now }, { now: OCT1 }) === 45, "…45 free days, all of which reach Stripe");
}

// ── 4. Reminders: 7 / 3 / 1, all inside a 14-day trial ────────────────────
ok(TRIAL_REMINDER_DAYS.join(",") === "7,3,1", "the reminder windows are 7, 3 and 1 days");
ok(Math.max(...TRIAL_REMINDER_DAYS) < TRIAL_DAYS, "the first letter lands inside the trial (a 15-day letter never could)");
{
  const sent = [];
  const stamps = {};
  for (let d = 0; d <= TRIAL_DAYS; d++) {
    const now = new Date(OCT1.getTime() + d * DAY);
    const r = trialReminderDecision({ trialEndsAt: signupEnd, stamps, now });
    if (r.send) { stamps[r.field] = now; sent.push(r.daysLeft); }
  }
  ok(sent.join(",") === "7,3,1", "a daily run over a new 14-day trial mails exactly three letters, at 7, 3 and 1 days left", sent);
}

// ── 5. No trial copy still says a month, in any language ───────────────────
// Every phrasing the old offer took, per language. A line matching one is a
// failure unless it is one of the things below that genuinely IS a month.
const BANNED = [
  /free first month|first month (is )?free|free month|months? free|30[- ]day (free )?trial|30 days free|no charge for 30 days|trial of 30 days/i,
  /\bmois gratuit|\bpremier mois/i,
  /\bmes gratis|\bprimer mes\b|\bmes gratuito/i,
  /Gratismonat|\berste[rn]? Monat|kostenlosen Monat/i,
  /\bmese gratuit|\bmese gratis|\bprimo mese/i,
  /безкоштовн\S* місяц|перш\S* місяц/i,
  /ਮੁਫ਼ਤ ਮਹੀਨ|ਪਹਿਲਾ ਮਹੀਨਾ|ਪਹਿਲੇ ਮਹੀਨੇ/,
  /libreng buwan|unang buwan|buwang libre/i,
  /免费月|首月|第一个月|免费一个月|一个月免费|头一个月/,
];
// What is allowed to say a month: the referral month (both sides), promo
// codes and influencers, the annual plan's months free, a sale's first-month
// price, restarting a cancelled trial (charged), the AI-credit and phone-line
// first month, and the first full month of reports.
const ALLOW = new RegExp([
  "refer", "parrain", "recomend", "referid", "Empfehl", "empfohl", "segnal", "реком", "ਰੈਫ", "ਸਿਫ਼ਾਰ", "i-refer", "推荐", "推薦",
  "REFEREE_BONUS", "REFERRER_BONUS", "monthsFree", "monthEarned", "monthsEarned", "promo", "Promo", "influenc", "Influenc", "rewardMonths",
  "saveOneMonth", "saveMonths", "annualDeal", "one month free\\.", "un mois gratuit\\.", "un mes gratis\\.", "isang buwang libre\\.", "yearly", "annual",
  "firstMonthThen", "firstMonthsThen", "perMonthForOne", "promoMonths",
  "restartCharged", "Restart", "Redémarrer", "Reiniciar", "first month is charged", "premier mois est facturé", "primer mes se cobra",
  "rental", "location", "alquiler", "Miete", "noleggio", "firstMonthNow", "firstMonthUpFront", "cantAfford", "buysNow", "shortfall", "confirmDetail",
  "bundleStarted", "credit", "crédit", "crédito",
  "first full month", "first monthly", "premier mois complet", "primer mes completo", "digest",
  // invitations and referral pages that say "invite" rather than "refer"
  "first real payment", "premier vrai paiement", "primer pago real", "fonctionnent les mois gratuits",
  "invit", "запрошення", "ਸੱਦ", "imbitasyon", "Recomienda", "refir", "Refier", "commission",
  // the annual plan's months, and the platform's promotion tools
  "two months free", "deux mois", "dos meses", "dalawang buwan", "Months free", "free months",
  // a company's first month of existence, not an offer
  "questions qui reviennent", "preguntas que surgen", "dans son premier mois", "en su primer mes",
  // the legacy trial, named as such
  "earlier 30-day", "ancien essai de 30", "prueba anterior de 30",
  // date formats ("month first")
  "Спершу місяць", "спершу місяць",
].join("|"), "i");
// Files that are about the referral or a promotion end to end.
const ALLOW_FILES = /app\/refer\/|app\/platform\/promo-codes\/|app\/platform\/billing\/promotions\/|lib\/pricing\/planOffer\.js/;
{
  const roots = ["app", "lib", "content/help/en", "content/help/fr", "content/help/es"];
  const hits = [];
  const scan = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (name === "node_modules" || name.startsWith(".")) continue;
      const st = statSync(p);
      if (st.isDirectory()) { if (!/app\/data$/.test(p)) scan(p); continue; }
      if (!/\.(m?js)$/.test(name)) continue;
      let inBlock = false;
      readFileSync(p, "utf8").split("\n").forEach((line, i) => {
        const t = line.trim();
        if (inBlock) { if (t.includes("*/")) inBlock = false; return; }
        if (t.startsWith("/*") || t.startsWith("{/*")) { if (!t.includes("*/")) inBlock = true; return; }
        if (t.startsWith("//") || t.startsWith("*")) return;
        const code = line.replace(/\s\/\/ .*$/, "");
        if (!BANNED.some((re) => re.test(code))) return;
        if (ALLOW.test(code) || ALLOW_FILES.test(p)) return;
        hits.push(`${p.replace(/^.*?\/(app|lib|content)\//, "$1/")}:${i + 1}: ${t.slice(0, 140)}`);
      });
    }
  };
  for (const r of roots) scan(new URL(`../${r}`, import.meta.url).pathname);
  ok(hits.length === 0, "no user-facing trial copy still says a month (en/fr/es/uk/pa/tl/de/zh/it; referral/promo/annual/rental wording allowlisted)", hits.join("\n      "));
}

console.log(`\n${pass} passed, ${fails.length} failed`);
for (const f of fails) console.log(`  FAIL ${f}`);
process.exit(fails.length ? 1 : 0);
