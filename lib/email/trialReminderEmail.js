// lib/email/trialReminderEmail.js
//
// "Your free trial ends in N days — choose a plan."
//
// FieldQuo → the company, about their own trial, so it is NOT white-labelled:
// the same platform envelope lib/email/billingEmail.js uses for the
// subscription letters, and for the same reason its header gives — FieldQuo
// is the vendor here, and the contractor's own logo on a letter about paying
// FieldQuo would read as them having billed themselves.
//
// In the company's language. Company.defaultLanguage is the one statement
// the owner made about what they read (chosen on the signup form), and the
// sentences live in app/i18n/appMessages.js under app.trialReminder.* in
// every language the catalogue carries — the same textFor() pattern as
// lib/email/signupRecoveryEmail.js, so a language the catalogue lacks falls
// back per key to English rather than to a blank.
import { buildPlatformNotice } from "@/lib/email/billingEmail";
import { escapeHtml } from "@/lib/email/emailTheme";
import { APP_MESSAGES } from "@/app/i18n/appMessages";

function textFor(language) {
  const dict = APP_MESSAGES[String(language || "en").toLowerCase()] || {};
  return (key, values = {}) =>
    String(dict[key] ?? APP_MESSAGES.en[key] ?? key).replace(/\{(\w+)\}/g, (m, k) =>
      values[k] === undefined ? m : String(values[k]),
    );
}

/**
 * @param companyName   Company.name
 * @param language      Company.defaultLanguage
 * @param daysLeft      whole days until trialEndsAt — the REAL count, printed
 *                      as is; never the window's name (a 15-day letter sent on
 *                      day 12 says twelve)
 * @param trialEndsOn   pre-formatted date (formatDateOnly), like "renewal"
 * @param graceDays     lib/billing/access.js GRACE_DAYS — the read-only week
 * @param recommended   lib/billing/recommendedTier.js's answer, or null; the
 *                      sentence is OMITTED when null rather than guessed at
 * @param billingUrl    absolute URL of Account & Billing (with ?tier= when the
 *                      signup link named one)
 * @returns { subject, html }
 */
export function buildTrialReminderEmail({
  companyName,
  language = "en",
  daysLeft,
  trialEndsOn,
  graceDays,
  recommended = null,
  billingUrl,
}) {
  const t = textFor(language);
  const days = Math.max(1, Math.round(Number(daysLeft) || 0));
  const one = days === 1;
  const name = String(companyName || "").trim() || t("app.trialReminder.yourCompany");
  const paragraphs = [
    escapeHtml(t("app.trialReminder.intro", { company: name, date: trialEndsOn })),
    escapeHtml(t("app.trialReminder.after", { grace: graceDays })),
    `<strong>${escapeHtml(t("app.trialReminder.nothingDeleted"))}</strong>`,
  ];
  if (recommended) {
    paragraphs.push(
      escapeHtml(
        t("app.trialReminder.recommended", {
          plan: recommended.label,
          seats: recommended.seats,
          crew: recommended.crewSeats,
        }),
      ),
    );
  }
  return buildPlatformNotice({
    subject: one ? t("app.trialReminder.subjectOneDay") : t("app.trialReminder.subject", { days }),
    heading: one ? t("app.trialReminder.headingOneDay") : t("app.trialReminder.heading", { days }),
    sub: name,
    paragraphs,
    cta: billingUrl ? { url: billingUrl, label: t("app.trialReminder.cta") } : null,
  });
}
