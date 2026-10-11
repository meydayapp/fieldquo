// lib/billing/billingLanguage.js
//
// Which language a FieldQuo → company letter is written in: the subscription
// letters (lib/billing/notify.js, the grace-warning and renewal-reminder
// crons), the referral reward and the AI-credit notice.
//
// ══ The precedence ══════════════════════════════════════════════════════════
//
//   the owner's own interface language (User.language)
//   → the company's language (Company.defaultLanguage)
//   → English
//
// The same order User.language documents for the interface, and the order
// lib/ai/monthlyDigest.js already writes the summary in. The trial reminder
// (lib/email/trialReminderEmail.js) reads Company.defaultLanguage alone; an
// owner who never opened the language setting has User.language null, so for
// them both rules give the same answer — they differ only for an owner who
// chose a language of their own, and then the letter follows the choice.
//
// "The owner" is the EARLIEST owner membership — the person
// lib/email/companySender.js's ownerEmailFor already addresses when the
// company has no contact email, so the address and the language are one
// person's.
//
// A language is accepted when the letter's own catalogue has it (`has`), not
// only when the interface picker offers it: zh is in the app catalogue and in
// every one of these letters, and an owner who set it reads Chinese.
//
// Never throws. A letter in English is a papercut; a billing letter that
// never went because a language lookup failed is a missed payment.

import { db } from "@/lib/db";

/**
 * Pure: the language from the two rows.
 *
 * @param user     { language } | null — the owner's User row
 * @param company  { defaultLanguage } | null
 * @param has      (code) => boolean — does the letter exist in this language
 */
export function letterLanguage(user, company, has) {
  const ok = (code) => typeof code === "string" && code.trim() !== "" && has(code.trim().toLowerCase());
  if (ok(user?.language)) return user.language.trim().toLowerCase();
  if (ok(company?.defaultLanguage)) return company.defaultLanguage.trim().toLowerCase();
  return "en";
}

/**
 * The reader's language for a company's FieldQuo letters.
 *
 * @param companyId
 * @param has     the letter catalogue's membership test
 * @param client  injectable for the checks
 */
export async function ownerLetterLanguage(companyId, has, client = db) {
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
    console.error("[billing] couldn't resolve the letter's language:", err?.message);
    return "en";
  }
}
