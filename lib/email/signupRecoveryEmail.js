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
import { layoutFooterInputs, renderPlatformEmail } from "@/lib/email/platformLayout";
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
 * @returns { subject, html, text, headers }
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
  // The RFC 8058 one-click endpoint (POST /api/no-contact/<token>) — the
  // List-Unsubscribe header's target; null sends no header.
  oneClickUrl = null,
} = {}) {
  // The mailing address and the opt-out URL are refused by the layout
  // (lib/email/platformLayout.js layoutFooterInputs) — the ONE gate every
  // commercial FieldQuo letter passes, checked before anything is built, so
  // a missing piece still throws rather than shipping a hole in the footer.
  const address = String(mailingAddress ?? "").trim();
  layoutFooterInputs({ kind: "commercial", mailingAddress: address, unsubscribeUrl: optOutUrl });
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

  // The envelope is the shared layout since 2026-10-11 (lib/email/
  // platformLayout.js), as a "commercial" letter — it refuses to build
  // without the address or the opt-out, the same refusals made above. The
  // letter's identify line leads the footer, the address follows on its own
  // line (never merged into the sentence beside it), and the opt-out keeps
  // its words and its /no-contact page.
  const bodyHtml = paragraphs
    .map((text) => `<p style="font-size:15px;line-height:1.7;margin:0 0 16px 0;color:${INK};">${escapeHtml(text)}</p>`)
    .join("");
  const afterCtaHtml = `
        <p style="font-size:14px;line-height:1.7;color:${MUTED};margin:22px 0 0 0;">${escapeHtml(t("app.signupRecovery.noCharge"))}</p>
        <p style="font-size:14px;line-height:1.7;color:${MUTED};margin:10px 0 0 0;">
          <a href="${escapeAttr(helpUrl)}" style="color:${INK};">${escapeHtml(t("app.signupRecovery.help"))}</a>
        </p>`;
  const { html, headers } = renderPlatformEmail({
    language,
    kind: "commercial",
    preheader: paragraphs[0],
    heading,
    bodyHtml,
    cta: { url: finishUrl, label: t("app.signupRecovery.cta") },
    afterCtaHtml,
    origin: new URL(finishUrl).origin,
    // The recipient is a company with a login (the account was created
    // before checkout), so "Your account" is a real door.
    accountLink: true,
    mailingAddress: address,
    unsubscribeUrl: optOutUrl,
    unsubscribeLabel: t("app.signupRecovery.optOut"),
    oneClickUrl,
    footerIntroHtml: escapeHtml(t("app.signupRecovery.identify")),
  });

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

  return { subject, html, text, headers };
}

/** The colour pairs this email asserts. Exported so the check can measure them
 *  rather than take the header's word for it. */
export const SIGNUP_RECOVERY_PAIRS = [
  { name: "body ink on card", fg: INK, bg: CARD },
  { name: "muted note on card", fg: MUTED, bg: CARD },
  { name: "CASL footer on page", fg: FAINT, bg: PAGE },
  { name: "heading on header bar", fg: "#ffffff", bg: INK },
];
