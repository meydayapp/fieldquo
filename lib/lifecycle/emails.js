// lib/lifecycle/emails.js
//
// The trial sequence's letters (lib/lifecycle/plan.js decides which, when).
// Pure builders: plain values in, { subject, html, text, headers } out, every
// sentence from lib/i18n/lifecycleEmailCopy.js in the reader's language, every
// envelope from lib/email/platformLayout.js.
//
//   buildFeatureNudge      one open feature, a real product screenshot as the
//                          hero where one exists in the reader's language
//                          (public/email/hero-*.{en,fr,es}.jpg — a German
//                          reader is not shown an English screen), one button
//   buildMilestoneEmail    "you did it, here's what's next"
//   buildPersonalEmail     plain text only, no images, from a named person
//   buildHelpEmail         2–3 real help articles, and the platform's customer
//                          stories when there are any (none → no block)
//   buildTrialEndedEmail   transactional: read-only until the lock date,
//                          nothing deleted, choose a plan
//
// Every "tips" letter REQUIRES the footer inputs — mailing address,
// unsubscribe and preferences URLs, the one-click URL — and the layout throws
// without the first two, so a letter cannot reach somebody with no way out.

import { escapeHtml, escapeAttr } from "@/lib/email/emailTheme";
import { emailAssetUrl, listUnsubscribeHeaders, platformTextFooter, renderPlatformEmail } from "@/lib/email/platformLayout";
import { labelled, lifecycleLanguage, lifecycleT } from "@/lib/i18n/lifecycleEmailCopy";
import { formatCalendarDay } from "@/lib/format/localeDate";
import { localParts } from "@/lib/lifecycle/plan";

const INK = "#111827";
const MUTED = "#4b5563";
const RULE = "#e5e7eb";

/** Where each feature's button lands, inside the app. */
export const FEATURE_PATHS = Object.freeze({
  payments: "/app/settings/payments",
  booking: "/app/settings/availability#bookable",
  quote: "/app/quotes/new",
  import: "/app/clients/import",
});

/** Product screenshots converted for email (public/email/), by feature, in the languages they were captured in. */
export const HERO_IMAGES = Object.freeze({
  payments: { languages: ["en", "fr", "es"], width: 1200, height: 937 },
  booking: { languages: ["en", "fr", "es"], width: 1200, height: 937 },
  quote: { languages: ["en", "fr", "es"], width: 1200, height: 937 },
});

export function heroFor(feature, language, t) {
  const lang = lifecycleLanguage(language);
  const h = HERO_IMAGES[feature];
  if (!h || !h.languages.includes(lang)) return null;
  return { src: emailAssetUrl(`/email/hero-${feature}.${lang}.jpg`), alt: t(`nudge.${feature}.heroAlt`), width: h.width, height: h.height };
}

const p = (html, extra = "") => `<p style="font-size:15px;line-height:1.7;margin:0 0 14px 0;color:${INK};${extra}">${html}</p>`;
const abs = (origin, path) => `${String(origin || "").replace(/\/+$/, "")}${path}`;

function tipsFooter(footer = {}) {
  return {
    mailingAddress: footer.mailingAddress,
    unsubscribeUrl: footer.unsubscribeUrl,
    preferencesUrl: footer.preferencesUrl,
    oneClickUrl: footer.oneClickUrl,
  };
}

function textFooter(language, kind, footer) {
  return platformTextFooter({
    language,
    kind,
    mailingAddress: footer?.mailingAddress,
    unsubscribeUrl: kind === "transactional" ? null : footer?.unsubscribeUrl,
    preferencesUrl: kind === "transactional" ? null : footer?.preferencesUrl,
  });
}

// ═══════════════════════════════════════════════════════════════════════════

export function buildFeatureNudge({ feature, language = "en", origin, bookingUrl = null, footer } = {}) {
  if (!FEATURE_PATHS[feature]) throw new Error(`buildFeatureNudge: unknown feature "${feature}"`);
  const t = lifecycleT(language);
  const k = `nudge.${feature}`;
  const subject = t(`${k}.subject`);
  const heading = t(`${k}.heading`);
  const lines = [t(`${k}.body1`)];
  if (feature !== "booking") lines.push(t(`${k}.body2`));
  // The booking page's address only when there IS one to print.
  else if (bookingUrl) lines.push(t(`${k}.body2`, { url: bookingUrl }));
  const cta = { url: abs(origin, FEATURE_PATHS[feature]), label: t(`${k}.cta`) };
  const { html, headers } = renderPlatformEmail({
    language,
    kind: "tips",
    preheader: t(`${k}.preheader`),
    heading,
    hero: heroFor(feature, language, t),
    bodyHtml: lines.map((l) => p(escapeHtml(l))).join(""),
    cta,
    origin,
    ...tipsFooter(footer),
  });
  const text = [heading, "", ...lines.flatMap((l) => [l, ""]), labelled(language, cta.label, cta.url), "", ...textFooter(language, "tips", footer)].join("\n");
  return { subject, html, text, headers };
}

// ═══════════════════════════════════════════════════════════════════════════

export function buildMilestoneEmail({ milestone, language = "en", origin, bookingUrl = null, guideUrl = null, footer } = {}) {
  const t = lifecycleT(language);
  const k = `ms.${milestone}`;
  let bodyHtml = "";
  let textLines = [];
  let cta;
  if (milestone === "booking") {
    // The link is the point of the letter: without one there is nothing to share.
    if (!bookingUrl) throw new Error("buildMilestoneEmail: the booking letter needs the company's booking link.");
    const where = ["ms.booking.website", "ms.booking.google", "ms.booking.social", "ms.booking.signature"].map((key) => t(key));
    bodyHtml =
      p(escapeHtml(t("ms.booking.intro"))) +
      `<p style="font-size:13px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:${MUTED};margin:18px 0 6px 0;">${escapeHtml(t("ms.booking.linkLabel"))}</p>` +
      `<p style="margin:0 0 18px 0;padding:12px 14px;border:1px solid ${RULE};border-radius:8px;font-size:15px;word-break:break-all;"><a href="${escapeAttr(bookingUrl)}" style="color:${INK};font-weight:700;">${escapeHtml(bookingUrl)}</a></p>` +
      `<p style="font-size:13px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:${MUTED};margin:0 0 6px 0;">${escapeHtml(t("ms.booking.where"))}</p>` +
      `<ul style="margin:0;padding-left:20px;font-size:15px;line-height:1.7;color:${INK};">${where.map((w) => `<li style="margin:0 0 6px 0;">${escapeHtml(w)}</li>`).join("")}</ul>`;
    textLines = [t("ms.booking.intro"), "", labelled(language, t("ms.booking.linkLabel"), bookingUrl), "", labelled(language, t("ms.booking.where"), "").trimEnd(), ...where.map((w) => `- ${w}`)];
    cta = { url: abs(origin, "/app/settings/booking-page"), label: t("ms.booking.cta") };
  } else if (milestone === "payments") {
    bodyHtml =
      p(escapeHtml(t("ms.payments.intro"))) +
      p(escapeHtml(t("ms.payments.next"))) +
      (guideUrl ? `<p style="font-size:14px;line-height:1.6;margin:0;"><a href="${escapeAttr(guideUrl)}" style="color:${INK};">${escapeHtml(t("ms.payments.guide"))}</a></p>` : "");
    textLines = [t("ms.payments.intro"), "", t("ms.payments.next"), ...(guideUrl ? ["", labelled(language, t("ms.payments.guide"), guideUrl)] : [])];
    cta = { url: abs(origin, "/app/settings/payments"), label: t("ms.payments.cta") };
  } else if (milestone === "quote") {
    const items = [t("ms.quote.followUps"), t("ms.quote.portal")];
    bodyHtml =
      p(escapeHtml(t("ms.quote.intro"))) +
      `<ul style="margin:0;padding-left:20px;font-size:15px;line-height:1.7;color:${INK};">${items.map((w) => `<li style="margin:0 0 8px 0;">${escapeHtml(w)}</li>`).join("")}</ul>`;
    textLines = [t("ms.quote.intro"), ...items.map((w) => `- ${w}`)];
    cta = { url: abs(origin, "/app/settings/follow-ups"), label: t("ms.quote.cta") };
  } else {
    throw new Error(`buildMilestoneEmail: unknown milestone "${milestone}"`);
  }
  const subject = t(`${k}.subject`);
  const heading = t(`${k}.heading`);
  const { html, headers } = renderPlatformEmail({
    language,
    kind: "tips",
    preheader: t(`${k}.preheader`),
    heading,
    bodyHtml,
    cta,
    origin,
    ...tipsFooter(footer),
  });
  const text = [heading, "", ...textLines, "", labelled(language, cta.label, cta.url), "", ...textFooter(language, "tips", footer)].join("\n");
  return { subject, html, text, headers };
}

// ═══════════════════════════════════════════════════════════════════════════

/**
 * Plain text, on purpose: no HTML part, no images, no button — a note from a
 * person reads like one. The footer still carries the address, the
 * unsubscribe and the preferences link (it is a "tips" letter), and the
 * caller sends the List-Unsubscribe headers returned here.
 *
 * @param sender  normalisePersonalSender()'s value; name and replyTo REQUIRED
 */
export function buildPersonalEmail({ language = "en", firstName = null, companyName = null, sender, footer } = {}) {
  if (!sender?.name || !sender?.replyTo) throw new Error("buildPersonalEmail: no named sender — the note is never sent from a made-up person.");
  const t = lifecycleT(language);
  const company = String(companyName || "").trim();
  const first = String(firstName || "").trim();
  const subject = company ? t("personal.subject", { company }) : t("personal.subjectNoCompany");
  const lines = [
    first ? t("personal.greetingNamed", { name: first }) : t("personal.greeting"),
    "",
    sender.title ? t("personal.introTitled", { sender: sender.name, title: sender.title }) : t("personal.intro", { sender: sender.name }),
    "",
    t("personal.ask"),
    ...(sender.phone ? ["", t("personal.phone", { phone: sender.phone })] : []),
    ...(sender.bookingUrl ? [t("personal.booking", { url: sender.bookingUrl })] : []),
    "",
    t("personal.signoff"),
    sender.name,
    ...(sender.title ? [`${sender.title}, FieldQuo`] : ["FieldQuo"]),
    "",
    "",
    ...textFooter(language, "tips", footer),
  ];
  // No HTML part, so no renderPlatformEmail — the footer above was validated
  // by platformTextFooter (address and unsubscribe REQUIRED), and the RFC 8058
  // headers are the same helper the layout uses.
  const headers = footer?.oneClickUrl ? listUnsubscribeHeaders(footer.oneClickUrl) : {};
  return { subject, html: null, text: lines.join("\n"), headers, replyTo: sender.replyTo, fromName: sender.name };
}

// ═══════════════════════════════════════════════════════════════════════════

/**
 * @param articles  [{ title, summary, url, english }] — resolved by the cron
 *                  from content/help; `english` marks an English body served
 *                  to a reader of another language
 * @param stories   storiesFor()'s list — may be empty, and then no block
 */
export function buildHelpEmail({ language = "en", origin, articles = [], stories = [], footer } = {}) {
  const list = (Array.isArray(articles) ? articles : []).filter((a) => a && a.title && a.url);
  if (list.length < 2) throw new Error("buildHelpEmail: fewer than two real articles — the letter is not sent padded.");
  const t = lifecycleT(language);
  const lang = lifecycleLanguage(language);
  const subject = t("help.subject");
  const heading = t("help.heading");
  const label = (a) => (a.english ? `${a.title} ${t("help.inEnglish")}` : a.title);
  const articlesHtml = list
    .map(
      (a) => `<tr><td style="padding:14px 0;border-top:1px solid ${RULE};">
        <a href="${escapeAttr(a.url)}" style="font-size:16px;font-weight:700;color:${INK};text-decoration:underline;">${escapeHtml(label(a))}</a>
        ${a.summary ? `<div style="font-size:14px;line-height:1.6;color:${MUTED};margin-top:4px;">${escapeHtml(a.summary)}</div>` : ""}
      </td></tr>`,
    )
    .join("");
  const storyList = (Array.isArray(stories) ? stories : []).filter((s) => s && s.title && s.url);
  const storiesHtml = storyList.length
    ? `<p style="font-size:13px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:${MUTED};margin:26px 0 6px 0;">${escapeHtml(t("help.stories"))}</p>
       <table role="presentation" width="100%" style="border-collapse:collapse;">${storyList
         .map(
           (s) => `<tr><td style="padding:10px 0;border-top:1px solid ${RULE};">
             ${s.imageUrl ? `<img src="${escapeAttr(s.imageUrl)}" width="536" alt="" style="display:block;width:100%;max-width:536px;height:auto;border:0;border-radius:8px;margin:0 0 8px 0;" />` : ""}
             <a href="${escapeAttr(s.url)}" style="font-size:15px;font-weight:700;color:${INK};">${escapeHtml(s.title)}</a>
             <div style="font-size:14px;margin-top:2px;"><a href="${escapeAttr(s.url)}" style="color:${MUTED};">${escapeHtml(t("help.storyLink"))} ›</a></div>
           </td></tr>`,
         )
         .join("")}</table>`
    : "";
  const cta = { url: abs(origin, `/help/${lang}`), label: t("help.cta") };
  const { html, headers } = renderPlatformEmail({
    language,
    kind: "tips",
    preheader: t("help.preheader"),
    heading,
    bodyHtml: p(escapeHtml(t("help.intro"))) + `<table role="presentation" width="100%" style="border-collapse:collapse;">${articlesHtml}</table>` + storiesHtml,
    cta,
    origin,
    ...tipsFooter(footer),
  });
  const text = [
    heading,
    "",
    t("help.intro"),
    "",
    ...list.flatMap((a) => [label(a), ...(a.summary ? [a.summary] : []), labelled(language, t("help.read"), a.url), ""]),
    ...(storyList.length ? [labelled(language, t("help.stories"), "").trimEnd(), ...storyList.map((s) => `- ${labelled(language, s.title, s.url)}`), ""] : []),
    labelled(language, cta.label, cta.url),
    "",
    ...textFooter(language, "tips", footer),
  ].join("\n");
  return { subject, html, text, headers, articles: list.map((a) => a.url), stories: storyList.map((s) => s.url) };
}

// ═══════════════════════════════════════════════════════════════════════════

/** A calendar date in the company's own time zone, in the reader's language. */
export function localDay(instant, timeZone, language) {
  const parts = localParts(instant, timeZone);
  if (!parts) return "";
  // formatCalendarDay prints a UTC calendar day; hand it the LOCAL date at
  // UTC midnight so "the 21st in Vancouver" is never printed as the 22nd.
  return formatCalendarDay(new Date(`${parts.date}T00:00:00Z`), lifecycleLanguage(language));
}

/**
 * Transactional — no unsubscribe, no preferences link. The dates are the real
 * ones: trialEndsAt from the company row, lockAt from lib/billing/access.js's
 * GRACE_DAYS (lib/lifecycle/plan.js trialLockAt), both printed in the
 * company's time zone.
 */
export function buildTrialEndedEmail({ language = "en", companyName, trialEndsAt, lockAt, timeZone, origin, mailingAddress = "" } = {}) {
  if (!trialEndsAt || !lockAt) throw new Error("buildTrialEndedEmail: needs the real trial end and lock dates.");
  const t = lifecycleT(language);
  const company = String(companyName || "").trim() || "FieldQuo";
  const endDate = localDay(trialEndsAt, timeZone, language);
  const lockDate = localDay(lockAt, timeZone, language);
  const subject = t("ended.subject");
  const heading = t("ended.heading");
  const lines = [t("ended.body1", { company, endDate }), t("ended.body2", { lockDate })];
  const strong = t("ended.nothingDeleted");
  const cta = { url: abs(origin, "/app/settings/account-billing"), label: t("ended.cta") };
  const { html } = renderPlatformEmail({
    language,
    kind: "transactional",
    preheader: t("ended.preheader", { lockDate }),
    heading,
    sub: company,
    bodyHtml: lines.map((l) => p(escapeHtml(l))).join("") + p(escapeHtml(strong), "font-weight:700;"),
    cta,
    origin,
    mailingAddress,
  });
  const text = [heading, company, "", ...lines.flatMap((l) => [l, ""]), strong, "", labelled(language, cta.label, cta.url), "", ...textFooter(language, "transactional", { mailingAddress })].join("\n");
  return { subject, html, text, headers: {}, endDate, lockDate };
}
