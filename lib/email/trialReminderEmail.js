// lib/email/trialReminderEmail.js
//
// "Your free trial ends in N days — choose a plan."
//
// FieldQuo → the company, about their own trial, so it is NOT white-labelled:
// FieldQuo is the vendor here, and the contractor's own logo on a letter about
// paying FieldQuo would read as them having billed themselves.
//
// In the company's language. Company.defaultLanguage is the one statement
// the owner made about what they read (chosen on the signup form), and the
// sentences live in app/i18n/appMessages.js under app.trialReminder.* in
// every language the catalogue carries — the same textFor() pattern as
// lib/email/signupRecoveryEmail.js, so a language the catalogue lacks falls
// back per key to English rather than to a blank.
//
// ══ The envelope moved; the words did not (2026-10-11) ═════════════════════
//
// It was buildPlatformNotice's shell from lib/email/billingEmail.js. It is the
// shared FieldQuo→contractor layout now (lib/email/platformLayout.js), as a
// "transactional" letter: the read-only week is account mail nobody can opt
// out of, so it carries no unsubscribe and no preferences link. The subject,
// heading, company line, paragraphs and button are exactly what they were —
// `parts` returns them so scripts/check-platform-email-layout.mjs can compare
// them with the record taken before the move — and the letter gains the
// plain-text part it never had.
import { escapeHtml } from "@/lib/email/emailTheme";
import { EMAIL_ASSET_ORIGIN, renderPlatformEmail, platformTextFooter } from "@/lib/email/platformLayout";
import { labelled } from "@/lib/i18n/lifecycleEmailCopy";
import { APP_MESSAGES } from "@/app/i18n/appMessages";

function textFor(language) {
  const dict = APP_MESSAGES[String(language || "en").toLowerCase()] || {};
  return (key, values = {}) =>
    String(dict[key] ?? APP_MESSAGES.en[key] ?? key).replace(/\{(\w+)\}/g, (m, k) =>
      values[k] === undefined ? m : String(values[k]),
    );
}

const INK = "#111827";

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
 * @param origin        the app origin for the layout's Help / Your account
 *                      links; taken from billingUrl when omitted
 * @param mailingAddress FieldQuo's postal address for the footer, or ""
 * @returns { subject, html, text, parts }
 */
export function buildTrialReminderEmail({
  companyName,
  language = "en",
  daysLeft,
  trialEndsOn,
  graceDays,
  recommended = null,
  billingUrl,
  origin = null,
  mailingAddress = "",
}) {
  const t = textFor(language);
  const days = Math.max(1, Math.round(Number(daysLeft) || 0));
  const one = days === 1;
  const name = String(companyName || "").trim() || t("app.trialReminder.yourCompany");
  const intro = t("app.trialReminder.intro", { company: name, date: trialEndsOn });
  const after = t("app.trialReminder.after", { grace: graceDays });
  const nothingDeleted = t("app.trialReminder.nothingDeleted");
  const recommendedLine = recommended
    ? t("app.trialReminder.recommended", { plan: recommended.label, seats: recommended.seats, crew: recommended.crewSeats })
    : null;
  const plain = [intro, after, nothingDeleted, ...(recommendedLine ? [recommendedLine] : [])];
  // Pre-escaped HTML, exactly the strings buildPlatformNotice was handed.
  const paragraphs = [
    escapeHtml(intro),
    escapeHtml(after),
    `<strong>${escapeHtml(nothingDeleted)}</strong>`,
    ...(recommendedLine ? [escapeHtml(recommendedLine)] : []),
  ];
  const subject = one ? t("app.trialReminder.subjectOneDay") : t("app.trialReminder.subject", { days });
  const heading = one ? t("app.trialReminder.headingOneDay") : t("app.trialReminder.heading", { days });
  const cta = billingUrl ? { url: billingUrl, label: t("app.trialReminder.cta") } : null;
  // The header's Help / Your account links: the caller's origin, else the
  // billing link's, else the public site — never a relative link in an inbox.
  let base = origin;
  if (!base && billingUrl) {
    try {
      base = new URL(billingUrl).origin;
    } catch {
      base = null;
    }
  }
  if (!base) base = EMAIL_ASSET_ORIGIN;

  const { html } = renderPlatformEmail({
    language,
    kind: "transactional",
    // The letter's own first sentence, as the inbox preview — no new words.
    preheader: intro,
    heading,
    sub: name,
    bodyHtml: paragraphs.map((p) => `<p style="font-size:15px;line-height:1.7;margin:0 0 16px 0;color:${INK};">${p}</p>`).join(""),
    cta,
    origin: base,
    mailingAddress,
  });
  const text = [
    heading,
    name,
    "",
    ...plain.flatMap((line) => [line, ""]),
    ...(cta ? [labelled(language, cta.label, cta.url), ""] : []),
    ...platformTextFooter({ language, kind: "transactional", mailingAddress }),
  ].join("\n");

  return { subject, html, text, parts: { heading, sub: name, paragraphs, cta } };
}
