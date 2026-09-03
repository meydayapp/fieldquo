// lib/email/signupRecoveryEmail.js
//
// FieldQuo → somebody who started signing up and never finished.
//
// "Hey, noticed that you didn't complete the sign up? How can we help?" — the
// owner's own words. See lib/signup/abandoned.js for who gets this, when, and
// why exactly once.
//
// ══ Why this is not another `kind` on buildBillingEmail ════════════════════
//
// It shares that file's shell almost exactly and the temptation to add
// `kind: "signup_recovery"` was real. It is refused for one reason:
// lib/marketing/unsubscribe.js classifies every billing notice as
// TRANSACTIONAL and says plainly that a stray unsubscribe on a message like
// that "is its own defect: it invites someone to switch off mail they need".
// This message is the opposite classification (see NUDGE_IS_COMMERCIAL in
// lib/signup/abandoned.js) and MUST carry an unsubscribe. One builder emitting
// both kinds is one refactor away from a subscription-cancelled notice
// carrying an opt-out link, or this letter losing one.
//
// ══ Not white-label ═══════════════════════════════════════════════════════
//
// AGENTS.md's white-label rule is about documents a CONTRACTOR's client sees.
// Here FieldQuo is the sender and the contractor is the prospect, so FieldQuo's
// own name is the correct one — the same carve-out billingEmail.js and
// lib/sales/outreach.js already take.
//
// ══ Colours are borrowed, not chosen ══════════════════════════════════════
//
// #111827 / #4b5563 / #595f6b on white are the three lib/email/billingEmail.js
// already measured, and its comment records why the obvious #9ca3af was
// replaced: at 2.54:1 the small print — which is where the legally required
// lines live — was the least legible type in the message. Reusing measured
// values beats picking new ones; scripts/check-abandoned-signup.mjs recomputes
// all three anyway rather than trusting this paragraph.

import { escapeHtml, escapeAttr } from "@/lib/email/emailTheme";
import { APP_MESSAGES } from "@/app/i18n/appMessages";

const INK = "#111827";
const MUTED = "#4b5563";
const FAINT = "#595f6b";
const CARD = "#ffffff";
const PAGE = "#f5f5f5";

/**
 * The catalogue in one language, falling back per KEY to English.
 *
 * Per-key, not per-language, which is what t() does everywhere else and what
 * app/api/settings/voice/knowledge/route.js already does server-side: the four
 * review-pending catalogues are incomplete by design (see appMessages.js), and
 * an all-or-nothing fallback would drop a French sentence that exists because
 * some other key in the same file does not.
 */
function textFor(language) {
  const dict = APP_MESSAGES[String(language || "en").toLowerCase()] || {};
  return (key) => dict[key] ?? APP_MESSAGES.en[key];
}

/**
 * @param companyName   what they typed into the signup form
 * @param language      Company.defaultLanguage — the language they chose while
 *                      signing up, which is the only statement they made about
 *                      what they read. English + French are the app catalogue's
 *                      two complete languages; anything else falls back per key.
 * @param finishUrl     absolute URL to Account & Billing, where "Choose plan"
 *                      restarts checkout (see the cancelUrl comment in
 *                      app/api/companies/route.js — /signup is the one page
 *                      that CANNOT help a signed-in owner).
 * @param helpUrl       absolute URL to /contact — the marketing site's own
 *                      form, which reaches a person and needs no login. The
 *                      alternative, "reply to this email", would be a promise
 *                      about a mailbox: these go out from the platform sender,
 *                      which unlike a sales rep's own address is not read by
 *                      anybody. A control that appears to work and doesn't.
 * @param optOutUrl     absolute URL to the do-not-contact confirmation page.
 * @param mailingAddress FieldQuo's postal address (SALES_MAILING_ADDRESS).
 *
 * @returns { subject, html, text }
 * @throws  when a legally required part is missing. A throw rather than a
 *          degraded email, for the reason buildOutboundEmail gives: an email
 *          with a hole in its CASL footer has already reached a stranger by the
 *          time anybody notices.
 */
export function buildSignupRecoveryEmail({
  companyName,
  language = "en",
  finishUrl,
  helpUrl,
  optOutUrl,
  mailingAddress,
} = {}) {
  const address = String(mailingAddress ?? "").trim();
  if (!address) {
    throw new Error(
      "FieldQuo's mailing address isn't set, and CASL requires one in every " +
        "commercial email. Set SALES_MAILING_ADDRESS — see docs/SALES-OUTREACH.md.",
    );
  }
  if (!optOutUrl) {
    throw new Error(
      "A signup recovery email is a commercial message and cannot be built " +
        "without a working unsubscribe URL. See lib/signup/abandoned.js.",
    );
  }
  if (!finishUrl) {
    throw new Error("buildSignupRecoveryEmail needs somewhere for the button to go.");
  }
  if (!helpUrl) {
    throw new Error(
      "The letter asks \"how can we help?\" — it cannot be built without " +
        "somewhere for the answer to go.",
    );
  }

  const t = textFor(language);
  const name = String(companyName ?? "").trim();

  const subject = t("app.signupRecovery.subject");
  const heading = t("app.signupRecovery.heading");
  const paragraphs = [
    name
      ? t("app.signupRecovery.introNamed").replace("{company}", name)
      : t("app.signupRecovery.intro"),
    t("app.signupRecovery.reassure"),
    t("app.signupRecovery.offer"),
  ];

  const body = paragraphs
    .map(
      (text) =>
        `<p style="font-size:15px;line-height:1.7;margin:0 0 16px 0;color:${INK};">${escapeHtml(text)}</p>`,
    )
    .join("");

  // Two required lines, then the opt-out. Kept as separate <div>s rather than
  // one run-on paragraph so a mail client that collapses whitespace cannot
  // merge the mailing address into the sentence beside it.
  const footer =
    `<div>${escapeHtml(t("app.signupRecovery.identify"))}</div>` +
    `<div>${escapeHtml(address)}</div>` +
    `<div style="margin-top:10px;">` +
    `<a href="${escapeAttr(optOutUrl)}" style="color:${FAINT};">${escapeHtml(
      t("app.signupRecovery.optOut"),
    )}</a>` +
    `</div>`;

  const html = `<!DOCTYPE html>
<html>
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
  <body style="margin:0;padding:0;background:${PAGE};font-family:Arial,Helvetica,sans-serif;color:${INK};">
    <div style="max-width:560px;margin:0 auto;">
      <div style="background:${INK};color:#ffffff;padding:32px 30px;text-align:center;">
        <h1 style="margin:0;font-size:22px;font-weight:700;">${escapeHtml(heading)}</h1>
      </div>
      <div style="background:${CARD};padding:32px 30px;">
        ${body}
        <div style="text-align:center;margin:28px 0 0 0;">
          <a href="${escapeAttr(finishUrl)}" style="display:inline-block;padding:14px 32px;background:${INK};color:#ffffff !important;text-decoration:none;border-radius:8px;font-weight:700;font-size:15px;">${escapeHtml(
            t("app.signupRecovery.cta"),
          )}</a>
        </div>
        <p style="font-size:14px;line-height:1.7;color:${MUTED};margin:22px 0 0 0;">${escapeHtml(
          t("app.signupRecovery.noCharge"),
        )}</p>
        <p style="font-size:14px;line-height:1.7;color:${MUTED};margin:10px 0 0 0;">
          <a href="${escapeAttr(helpUrl)}" style="color:${INK};">${escapeHtml(
            t("app.signupRecovery.help"),
          )}</a>
        </p>
      </div>
      <div style="text-align:center;padding:20px;color:${FAINT};font-size:12px;line-height:1.6;">
        ${footer}
      </div>
    </div>
  </body>
</html>`;

  const text = [
    heading,
    "",
    ...paragraphs,
    "",
    `${t("app.signupRecovery.cta")}: ${finishUrl}`,
    "",
    t("app.signupRecovery.noCharge"),
    `${t("app.signupRecovery.help")}: ${helpUrl}`,
    "",
    "—",
    t("app.signupRecovery.identify"),
    address,
    `${t("app.signupRecovery.optOut")}: ${optOutUrl}`,
  ].join("\n");

  return { subject, html, text };
}

/** The colour pairs this email asserts. Exported so the check can measure them
 *  rather than take the header's word for it. */
export const SIGNUP_RECOVERY_PAIRS = [
  { name: "body ink on card", fg: INK, bg: CARD },
  { name: "muted note on card", fg: MUTED, bg: CARD },
  { name: "CASL footer on page", fg: FAINT, bg: PAGE },
  { name: "heading on header bar", fg: "#ffffff", bg: INK },
];
