// lib/i18n/letterLanguage.js
//
// Which language a FieldQuo → contractor letter is written in. ONE rule, for
// every such letter:
//
//   the reader's own interface language (User.language)
//   → the company's language (Company.defaultLanguage)
//   → English
//
// Used by the subscription letters (lib/billing/notify.js, the grace-warning
// and renewal-reminder crons), the referral-month and AI-credit letters, the
// 7/3/1 trial reminders (app/api/cron/trial-reminders), and the trial sequence,
// win-back and product-updates letters (lib/lifecycle/run.js,
// lib/lifecycle/marketing.js). Until 2026-10-11 the trial reminders read the
// company's language alone and the trial sequence wrote
// `user.language || company.defaultLanguage` — which sent an owner whose
// User.language held a code no catalogue has to ENGLISH rather than to the
// company's language. One function now answers for all of them.
//
// "The reader" is the person the letter goes to. Where that is the company's
// contact address rather than a person (the billing letters, the trial
// reminders), it is the EARLIEST owner membership — the person
// lib/email/companySender.js's ownerEmailFor addresses when the company has no
// contact email, so the address and the language are one person's.
//
// A language is accepted when the letter's catalogue has it (`has`) — by
// default the app catalogue's nine (APP_MESSAGES: en fr es uk pa tl de zh it),
// not only the eight the interface picker offers: zh is in every one of these
// letters, and an owner who set it reads Chinese.
//
// Never throws. A letter in English is a papercut; a billing letter that never
// went because a language lookup failed is a missed payment.

import { db } from "@/lib/db";
import { APP_MESSAGES } from "@/app/i18n/appMessages";

/** The app catalogue's languages — the default `has`. */
export function appCatalogueHas(code) {
  return Object.prototype.hasOwnProperty.call(APP_MESSAGES, String(code || "").toLowerCase());
}

/**
 * Pure: the language from the two rows.
 *
 * @param user     { language } | null — the reader's User row
 * @param company  { defaultLanguage } | null
 * @param has      (code) => boolean — does the letter exist in this language
 */
export function letterLanguage(user, company, has = appCatalogueHas) {
  // "fr-CA" → "fr": a region is not a different letter (the trial sequence's
  // lifecycleLanguage did the same before it called this).
  const base = (code) => (typeof code === "string" ? code.trim().toLowerCase().split(/[-_]/)[0] : "");
  const ok = (code) => base(code) !== "" && has(base(code));
  if (ok(user?.language)) return base(user.language);
  if (ok(company?.defaultLanguage)) return base(company.defaultLanguage);
  return "en";
}

/**
 * The language of a letter addressed to the company (its contact address, or
 * the owner's when it has none): the earliest owner's, else the company's.
 *
 * @param companyId
 * @param has     the letter catalogue's membership test
 * @param client  injectable for the checks
 */
export async function ownerLetterLanguage(companyId, has = appCatalogueHas, client = db) {
  if (!companyId) return "en";
  try {
    const [owner, company] = await Promise.all([
      client.member.findFirst({
        where: { companyId, role: "owner" },
        orderBy: { createdAt: "asc" },
        select: { user: { select: { language: true } } },
      }),
      client.company.findUnique({ where: { id: companyId }, select: { defaultLanguage: true } }),
    ]);
    return letterLanguage(owner?.user, company, has);
  } catch (err) {
    console.error("[letterLanguage] couldn't resolve the letter's language:", err?.message);
    return "en";
  }
}
