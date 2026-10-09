// scripts/check-trial-length.mjs
//
//   npm run check:trial-length
//
// The 14-day trial (owner decision 2026-09-29). New signups get TRIAL_DAYS
// free, no card; everyone already on a trial keeps the trialEndsAt they were
// given; the referral month no longer touches the trial (it defers the first
// charge at plan selection, since 2026-10-03); the reminders
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

// ── 3. The referral month lands at PLAN SELECTION, not on the trial ───────
// Pin moved 2026-10-03 (the owner: referrals "only work when they have
// selected a plan"). Until then applySignupReferral composed base trialEndsAt
// + REFEREE_BONUS_MONTHS at signup, and this section pinned that composition.
// Now signup leaves the trial at TRIAL_DAYS, and the month defers the first
// charge when a plan is chosen (lib/referrals grantRefereeBonus →
// extendAccessByMonths). The full fixtures are in check-referral-reward.mjs;
// this is the trial-length half: the trial itself never grows.
{
  const src = read("lib/referrals/index.js");
  ok(/export const REFEREE_BONUS_MONTHS = 1;/.test(src), "REFEREE_BONUS_MONTHS is still 1");
  const signupFn = src.slice(src.indexOf("export async function applySignupReferral"), src.indexOf("export async function grantRefereeBonus"));
  ok(signupFn.length > 0 && !/trialEndsAt/.test(signupFn.replace(/\/\/.*$/gm, "")),
     "applySignupReferral no longer writes trialEndsAt — the trial is the ordinary TRIAL_DAYS one");
  ok(!/const trialEndsAt = addMonths\(base, REFEREE_BONUS_MONTHS\);/.test(src), "…and the signup-time composition is gone");
  // Worked example. Before: Oct 1 + 14d = Oct 15, + 1 month at signup = Nov 15
  // of TRIAL. Now: the trial ends Oct 15; a plan chosen Oct 10 opens Stripe
  // with the 5 days left, and the referral month moves the first charge from
  // Oct 15 to Nov 15. Same date for the company, but only for one that chose
  // a plan — and the reminders count down to Oct 15, the trial they have.
  const OCT10 = new Date("2026-10-10T15:00:00Z");
  ok(trialDaysAllowed({ trialEndsAt: signupEnd }, { now: OCT10 }) === 5, "a plan chosen Oct 10 carries the 5 trial days left into Stripe");
  const firstCharge = addMonths(signupEnd, 1);
  ok(firstCharge.toISOString().slice(0, 10) === "2026-11-15", "…and the referral month moves the first charge Oct 15 → Nov 15", firstCharge.toISOString());
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
  // "not charged for a month", in the languages the sales texts are written in
  /(charged|charge|cobra|factur\S*|abgebucht|addebitat\S*)[^.:]{0,25}\b(for a month|in a month|un mes|un mois|einen Monat|un mese)\b/i,
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
  "invit", "запрошення", "ਸੱਦ", "imbitasyon", "Recomienda", "refir", "Refier", "commission", "recommand",
  // the rep's own link grants nothing — said so in the SOP
  "nothing extra", "your link does not",
  // the annual plan's months, and the platform's promotion tools
  "two months free", "deux mois", "dos meses", "dalawang buwan", "Months free", "free months",
  // a company's first month of existence, not an offer
  "questions qui reviennent", "preguntas que surgen", "dans son premier mois", "en su primer mes",
  // the legacy trial, named as such
  "earlier 30-day", "ancien essai de 30", "prueba anterior de 30",
  // a quote's tax going unnoticed, not an offer
  "sales-tax",
  // date formats ("month first")
  "Спершу місяць", "спершу місяць",
  // the hours a crew can BILL in a month (Settings → Overhead, a9fd9d90b,
  // 2026-10-05) — an infinitive "to bill", which the "not charged for a
  // month" pattern above caught; a trial line is never phrased that way
  "factur(?:er|ar)(?: de verdad)? en un (?:mois|mes)",
].join("|"), "i");
// Files that are about the referral or a promotion end to end.
const ALLOW_FILES = /app\/refer\/|app\/platform\/promo-codes\/|app\/platform\/billing\/promotions\/|lib\/pricing\/planOffer\.js/;
const roots = ["app", "lib", "content/help/en", "content/help/fr", "content/help/es"];
// What a sales rep reads, prints or is handed — the same promises, said on the
// phone. The research and modelling notes beside them in docs/sales are
// history and are not scanned.
const SALES_DOCS = [
  "docs/sales/PLAYBOOK.md",
  "docs/sales/SOP.md",
  "docs/sales/FEATURES.md",
  "docs/sales/manual/content.en.js",
  "docs/sales/manual/content.fr.js",
  "docs/sales/manual/content.es.js",
  "docs/sales/guide/content.en.js",
  "docs/sales/guide/content.fr.js",
  "docs/sales/guide/content.es.js",
];
{
  const hits = [];
  for (const r of [...roots, ...SALES_DOCS]) scanCopy(new URL(`../${r}`, import.meta.url).pathname, { banned: BANNED, allow: ALLOW, allowFiles: ALLOW_FILES, hits });
  ok(hits.length === 0, "no user-facing trial copy still says a month (en/fr/es/uk/pa/tl/de/zh/it; referral/promo/annual/rental wording allowlisted)", hits.join("\n      "));
}

// ── 6. No copy still says a card is taken at signup, in any language ──────
// TRIAL_CARD_REQUIRED = false (owner decisions 2026-09-24, re-confirmed
// 2026-09-29): signup creates the company on its trial with no card, and a
// card is entered only when a plan is chosen from inside the app. Every
// sentence below is one that WAS shipped when a card was taken at checkout —
// the help article, the industry pages, the compare row, the referral page,
// the rep's talking point, the call script, the AI sales agent's rule, the
// PaintScout battlecard — each in the words it actually used, per language.
// "Card on file" alone is NOT banned: it is the right words for a plan that
// has been chosen (renewals, phone credit), which is where it appears.
const CARD_AT_SIGNUP = [
  /card\s+(isn't|is\s+not|won't\s+be)\s+charged\s+until|card\s+is\s+what\s+starts|no\s+card\s+charged\s+(until|during)|through\s+the\s+card\s+step|pick\s+the\s+plan,\s+card|month\s+is\s+free\s+with\s+a\s+card|takes\s+a\s+card\s+and\s+does\s+not\s+charge|the\s+card\s+you\s+gave\s+at\s+signup|a\s+card\s+is\s+taken\s+at\s+checkout|a\s+card\s+at\s+checkout|with\s+the\s+card\s+entered\s+there/i,
  /carte\s+n'est\s+débitée\s+qu'à\s+la\s+fin|une\s+carte\s+au\s+paiement|jusqu'à\s+l'étape\s+de\s+la\s+carte|la\s+carte\s+donnée\s+à\s+l'inscription|carte\s+est\s+prise\s+au\s+paiement/i,
  /no\s+se\s+cobra\s+tu\s+tarjeta\s+hasta|hasta\s+el\s+paso\s+de\s+la\s+tarjeta|una\s+tarjeta\s+al\s+pagar|tarjeta\s+que\s+dio\s+al\s+registrarse|se\s+toma\s+una\s+tarjeta\s+al\s+pagar/i,
  /Karte\s+wird\s+erst\s+danach\s+belastet|Die\s+Karte\s+startet\s+sie/,
  /carta\s+non\s+viene\s+addebitata\s+finché/i,
  /картку\s+списують\s+лише\s+після|Картка\s+лише\s+запускає/,
  /ਇਨ੍ਹਾਂ ਦੇ ਖ਼ਤਮ ਹੋਣ ਤੱਕ ਕਾਰਡ|ਕਾਰਡ ਨਾਲ ਇਹ ਸ਼ੁਰੂ ਹੁੰਦੇ/,
  /hindi\s+sisingilin\s+ang\s+card\s+mo\s+hangga't|Ang\s+card\s+ang\s+nagsisimula/i,
  /试用结束前不会扣你的卡|银行卡是用来开通的/,
];
// The one population a card sentence is still true for: a company created
// BEFORE 2026-09-24 that abandoned Stripe Checkout (no trial date, no
// Subscription row) still finishes through checkout — the "One step left"
// resume screen and the 24-hour recovery letter (lib/signup/abandoned.js
// isIncompleteSignup). Their catalogue keys are allowlisted by name, and the
// letter's multi-line English/Italian values by their text.
const CARD_ALLOW = /app\.signupRecovery\.|The card is what starts them, not what gets charged|La carta è ciò che li avvia/;
{
  const hits = [];
  for (const r of [...roots, ...SALES_DOCS]) scanCopy(new URL(`../${r}`, import.meta.url).pathname, { banned: CARD_AT_SIGNUP, allow: CARD_ALLOW, allowFiles: /$^/, hits });
  ok(hits.length === 0, "no copy in any language still says a card is taken at signup (the legacy checkout-recovery letter allowlisted by key)", hits.join("\n      "));

  // The two strings that must read from the constant rather than carry it:
  // the industry pages' no-card line and the early-nudge letter.
  const ind = read("app/i18n/industries/en.js");
  const page = read("app/(marketing)/industries/[slug]/IndustryPageContent.js");
  ok(/noCard: "No card needed — your first \{days\} days are free\."/.test(ind) && /replace\("\{days\}", String\(TRIAL_DAYS\)\)/.test(page), "the industry pages say no card, with the days from TRIAL_DAYS");
  const { buildSignupEarlyNudgeEmail } = await import("@/lib/email/signupEarlyNudgeEmail");
  for (const language of ["en", "fr", "es", "de", "zh"]) {
    const mail = buildSignupEarlyNudgeEmail({ language, resumeUrl: "https://fieldquo.com/signup", optOutUrl: "https://fieldquo.com/stop", mailingAddress: "1 Test St" });
    ok(mail.subject.includes(String(TRIAL_DAYS)) && !/\{days\}/.test(mail.subject + mail.html + mail.text) && mail.text.includes(String(TRIAL_DAYS)),
      `${language}: the early nudge fills {days} from TRIAL_DAYS in its subject and body`, mail.subject);
  }
  // hero.noCard sat in nine catalogues rendered by nothing, saying whichever
  // card claim was current. Deleted 2026-09-29; it stays deleted.
  const messages = read("app/i18n/messages.js");
  ok(!/"hero\.noCard"/.test(messages), "hero.noCard is gone from the catalogue");
}

/**
 * Line scan of user-facing copy: .js/.mjs (comments skipped) and .md. A line
 * matching a banned pattern is a hit unless the allowlist or file allowlist
 * excuses it.
 */
function scanCopy(path, { banned, allow, allowFiles, hits }) {
  const st = statSync(path);
  if (st.isDirectory()) {
    for (const name of readdirSync(path)) {
      if (name === "node_modules" || name.startsWith(".") || name === "build") continue;
      const p = join(path, name);
      if (statSync(p).isDirectory() && /app\/data$/.test(p)) continue;
      scanCopy(p, { banned, allow, allowFiles, hits });
    }
    return;
  }
  const isMd = /\.md$/.test(path);
  if (!/\.(m?js)$/.test(path) && !isMd) return;
  let inBlock = false;
  let prev = "";
  readFileSync(path, "utf8").split("\n").forEach((line, i) => {
    const t = line.trim();
    if (!isMd) {
      if (inBlock) { if (t.includes("*/")) inBlock = false; return; }
      if (t.startsWith("/*") || t.startsWith("{/*")) { if (!t.includes("*/")) inBlock = true; return; }
      if (t.startsWith("//") || t.startsWith("*")) return;
    }
    const code = isMd ? line : line.replace(/\s\/\/ .*$/, "");
    // A catalogue value the formatter wrapped onto its own line
    //   "home.sale.offPromoFirstMonth":
    //     "{percent} % de rabais sur votre premier mois",
    // is judged with its key, so a key the allowlist names (Promo, refer…)
    // excuses it exactly as it would on one line. Only the key line is
    // borrowed — a bare `"key":` — never an unrelated line above.
    const keyAbove = !isMd && /^"[^"]+":$/.test(prev) ? `${prev} ` : "";
    prev = t;
    if (!banned.some((re) => re.test(code))) return;
    if (allow.test(keyAbove + code) || allowFiles.test(path)) return;
    hits.push(`${path.replace(/^.*?\/(app|lib|content|docs)\//, "$1/")}:${i + 1}: ${t.slice(0, 140)}`);
  });
}

console.log(`\n${pass} passed, ${fails.length} failed`);
for (const f of fails) console.log(`  FAIL ${f}`);
process.exit(fails.length ? 1 : 0);
