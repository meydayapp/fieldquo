// lib/email/signupEarlyNudgeEmail.js
//
// FieldQuo → somebody who started signing up and went quiet five minutes ago.
//
// "Your 14 free days are waiting" — one line, the button back to where they
// stopped, then the three things FieldQuo does for THEIR trade, drawn from
// the same list the sales reps' intro email prints
// (lib/sales/tradeSellingPoints.js — never a second copy of a headline), or
// the neutral three when they stopped before naming a trade. Who gets it and
// when is lib/signup/earlyNudge.js.
//
// The trial's length is TRIAL_DAYS, filled into the catalogue's {days} rather
// than written into nine languages' sentences: the trial went from a month to
// 14 days on 2026-09-29, and every letter that had the number typed into it was
// one more place to find and change.
//
// ══ Commercial, so it carries the CASL footer ═════════════════════════════
//
// The same classification as lib/email/signupRecoveryEmail.js and for the
// same reason (NUDGE_IS_COMMERCIAL): identification, FieldQuo's mailing
// address, and an unsubscribe that lands on the do-not-contact list. A throw
// rather than a degraded email when any of those is missing — an email with
// a hole in its footer has reached a stranger by the time anybody notices.
//
// ══ The language is theirs ════════════════════════════════════════════════
//
// SignupLead.language / Company.defaultLanguage is the one statement they
// made about what they read. The trade points exist in en / fr / es
// (TRADE_PITCH_LANGUAGES); the letter's own sentences are catalogue keys
// (app.signupNudge.*) in the same three, falling back per key to English
// the way textFor() in the recovery email does.
//
// ══ Colours are borrowed, not chosen ══════════════════════════════════════
//
// The four pairs the recovery email measured (SIGNUP_RECOVERY_PAIRS) are
// reused unchanged; the check recomputes them from this file's own export.

import { escapeHtml } from "@/lib/email/emailTheme";
import { layoutFooterInputs, renderPlatformEmail } from "@/lib/email/platformLayout";
import { TRIAL_DAYS } from "@/lib/pricing";
import { APP_MESSAGES } from "@/app/i18n/appMessages";
import {
  TRADE_PITCH_TOP,
  neutralSellingPoints,
  normalizeTradePitchLanguage,
  tradePitchLabel,
  tradeSellingPoints,
} from "@/lib/sales/tradeSellingPoints";
// The trade as a phrase in the reader's language ("de peinture"), from the
// reps' intro email — the one table, so "house cleaning" is never printed in
// the middle of a French sentence.
import { introTradePhrase } from "@/lib/sales/outreach/introEmail";

const INK = "#111827";
const MUTED = "#4b5563";
const FAINT = "#595f6b";
const CARD = "#ffffff";
const PAGE = "#f5f5f5";

function textFor(language) {
  const dict = APP_MESSAGES[String(language || "en").toLowerCase()] || {};
  return (key) => dict[key] ?? APP_MESSAGES.en[key];
}

function fill(template, values) {
  return String(template ?? "").replace(/\{(\w+)\}/g, (m, k) => (values[k] !== undefined && values[k] !== null ? String(values[k]) : m));
}

/**
 * @param firstName      what they typed, or null
 * @param companyName    what they typed, or null
 * @param language       their language; en / fr / es render natively,
 *                       anything else falls back per key to English
 * @param tradeKey       a DISCOVERY_TRADES key, or null when unknown
 * @param resumeUrl      absolute URL back to where they stopped
 * @param optOutUrl      absolute URL to the do-not-contact confirmation page
 * @param mailingAddress FieldQuo's postal address (SALES_MAILING_ADDRESS)
 * @returns { subject, html, text, headers, language, points: [{ key, headline, oneLiner }], tradeLabel }
 */
export function buildSignupEarlyNudgeEmail({
  firstName = null,
  companyName = null,
  language = "en",
  tradeKey = null,
  resumeUrl,
  optOutUrl,
  mailingAddress,
  // The RFC 8058 one-click endpoint (POST /api/no-contact/<token>) — the
  // List-Unsubscribe header's target; null sends no header.
  oneClickUrl = null,
  // A company row has a login; a lead does not, so its header shows Help only.
  accountLink = false,
} = {}) {
  // The mailing address and the opt-out URL are refused by the layout's one
  // gate (lib/email/platformLayout.js layoutFooterInputs), asked first.
  const address = String(mailingAddress ?? "").trim();
  layoutFooterInputs({ kind: "commercial", mailingAddress: address, unsubscribeUrl: optOutUrl });
  if (!resumeUrl) {
    throw new Error("buildSignupEarlyNudgeEmail needs somewhere for the button to go.");
  }

  const lang = normalizeTradePitchLanguage(language) || "en";
  const t = textFor(lang);
  const first = String(firstName ?? "").trim();
  const company = String(companyName ?? "").trim();

  const trade = tradeSellingPoints(tradeKey, lang, { limit: TRADE_PITCH_TOP });
  const known = trade.points.length > 0;
  const points = known ? trade.points : neutralSellingPoints(lang, { limit: TRADE_PITCH_TOP }).points;
  const tradeLabel = known ? tradePitchLabel(tradeKey) : null;

  const days = TRIAL_DAYS;
  const subject = fill(t("app.signupNudge.subject"), { days });
  const heading = fill(t("app.signupNudge.heading"), { days });
  const greeting = first ? fill(t("app.signupNudge.greetingNamed"), { name: first }) : t("app.signupNudge.greeting");
  const intro = company ? fill(t("app.signupNudge.introNamed"), { company, days }) : fill(t("app.signupNudge.intro"), { days });
  const noCharge = fill(t("app.signupNudge.noCharge"), { days });
  const pointsIntro = known
    ? fill(t("app.signupNudge.pointsIntroTrade"), { trade: introTradePhrase(tradeKey, lang) })
    : t("app.signupNudge.pointsIntro");

  const list = points
    .map(
      (p) =>
        `<li style="margin:0 0 10px 0;"><strong style="color:${INK};">${escapeHtml(p.headline)}</strong>` +
        `<br /><span style="color:${MUTED};">${escapeHtml(p.oneLiner)}</span></li>`,
    )
    .join("");

  // The envelope is the shared layout since 2026-10-11 (lib/email/
  // platformLayout.js), as a "commercial" letter: it refuses to build without
  // the mailing address and the opt-out URL, the same two refusals made
  // above. The letter's own identify line leads the footer; the opt-out keeps
  // its own words and its /no-contact page. No "Manage email preferences" —
  // somebody who has not finished signing up has no account for a
  // preferences page to belong to.
  const bodyHtml = `
        <p style="font-size:15px;line-height:1.7;margin:0 0 16px 0;color:${INK};">${escapeHtml(greeting)}</p>
        <p style="font-size:15px;line-height:1.7;margin:0 0 16px 0;color:${INK};">${escapeHtml(intro)}</p>`;
  const afterCtaHtml = `
        <p style="font-size:15px;line-height:1.7;margin:28px 0 12px 0;color:${INK};">${escapeHtml(pointsIntro)}</p>
        <ol style="font-size:14px;line-height:1.6;margin:0 0 20px 0;padding-left:22px;">${list}</ol>
        <p style="font-size:14px;line-height:1.7;color:${MUTED};margin:0;">${escapeHtml(noCharge)}</p>`;
  const { html, headers } = renderPlatformEmail({
    language: lang,
    kind: "commercial",
    preheader: intro,
    heading,
    bodyHtml,
    cta: { url: resumeUrl, label: t("app.signupNudge.cta") },
    afterCtaHtml,
    origin: new URL(resumeUrl).origin,
    accountLink,
    mailingAddress: address,
    unsubscribeUrl: optOutUrl,
    unsubscribeLabel: t("app.signupNudge.optOut"),
    oneClickUrl,
    footerIntroHtml: escapeHtml(t("app.signupNudge.identify")),
  });

  const text = [
    heading,
    "",
    greeting,
    intro,
    "",
    `${t("app.signupNudge.cta")}: ${resumeUrl}`,
    "",
    pointsIntro,
    ...points.map((p, i) => `${i + 1}. ${p.headline} — ${p.oneLiner}`),
    "",
    noCharge,
    "",
    "—",
    t("app.signupNudge.identify"),
    address,
    `${t("app.signupNudge.optOut")}: ${optOutUrl}`,
  ].join("\n");

  return { subject, html, text, headers, language: lang, points: points.map((p) => ({ key: p.key, headline: p.headline, oneLiner: p.oneLiner })), tradeLabel };
}

/** The colour pairs this email asserts — the recovery email's, reused. */
export const SIGNUP_EARLY_NUDGE_PAIRS = [
  { name: "body ink on card", fg: INK, bg: CARD },
  { name: "muted note on card", fg: MUTED, bg: CARD },
  { name: "CASL footer on page", fg: FAINT, bg: PAGE },
  { name: "heading on header bar", fg: "#ffffff", bg: INK },
];
