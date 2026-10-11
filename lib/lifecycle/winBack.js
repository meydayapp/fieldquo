// lib/lifecycle/winBack.js
//
// The win-back letter: fourteen days after a cancellation TOOK EFFECT, once.
//
// ══ Sent by the hourly lifecycle cron, as an "offers" letter ════════════════
//
// A win-back letter is marketing, not a receipt. It goes out through
// lib/lifecycle/marketing.js from app/api/cron/lifecycle-emails, in the shared
// layout (lib/email/platformLayout.js) as kind "offers": FieldQuo's mailing
// address, an Unsubscribe link and "Manage email preferences" in the footer,
// the RFC 8058 List-Unsubscribe headers, and only to an owner whose "offers"
// preference is on (lib/email/preferences.js — off unless they ticked "Send
// me product news and offers" at signup, or switched it on). Recorded once
// per cancellation as a LifecycleEmail row of kind "win_back:<Stripe sub id>".
// The selection and the words below are pure and executed by
// scripts/check-billing-lifecycle-emails.mjs.
//
// ══ The rule ════════════════════════════════════════════════════════════════
//
//   due     the Subscription is `canceled` and its canceledAt (Stripe's own
//           time the plan stopped — for a plan booked to end, the end date,
//           not the day the button was pressed) is 14 or more days ago;
//   until   the account locks — canceledAt + CANCELLED_DAYS (30). The letter
//           says "you can still look at everything until {date}", which is
//           false after that; a missed run therefore sends late or not at
//           all, never a stale sentence;
//   once    per cancellation — keyed on the ended Stripe subscription id (the
//           same key the cancellation letter uses: an ended subscription
//           never comes back, so a second cancellation is a new id);
//   never   a demo, anything FieldQuo ended or locked, an address on the
//           do-not-contact list, a company that unsubscribed from marketing
//           mail, a reserved test address, a company that came back (the row
//           is no longer `canceled`).
//
// A free trial that ran out without a plan is NOT a cancellation: nothing was
// cancelled, and that company is the trial-ended letter's (another agent's).

import { CANCELLED_DAYS } from "@/lib/billing/access";
import { accountNoticeCopy, fillNotice } from "@/lib/i18n/accountNoticeCopy";
import { formatBillingDate } from "@/lib/email/billingEmail";
import { PRODUCT_UPDATES, localizedUpdate, hasPost } from "@/lib/data/productUpdates";
import { isReservedTestAddress } from "@/lib/signup/abandoned";
import { escapeHtml, escapeAttr } from "@/lib/email/emailTheme";
import { renderPlatformEmail, platformTextFooter } from "@/lib/email/platformLayout";
import { labelled } from "@/lib/i18n/lifecycleEmailCopy";

const DAY = 24 * 60 * 60 * 1000;

/** Days after the cancellation took effect. */
export const WIN_BACK_AFTER_DAYS = 14;

const dateOf = (v) => {
  const d = v instanceof Date ? v : v ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
};

/**
 * Is the win-back letter due for this company right now? Pure.
 *
 * @param company       { isDemo, platformEndsAt, email }
 * @param subscription  { status, canceledAt, stripeSubscriptionId, accessLockedAt }
 * @param lastSentFor   the Stripe subscription id the letter was last sent
 *                      for (the stamp the wiring will add), or null
 * @param to            the address it would go to
 * @param suppressed    the do-not-contact list closes email for `to`
 * @param unsubscribed  the company opted out of marketing email (preferences)
 * @returns {{ send: true, canceledAt, readOnlyUntil, key } | { send: false, reason }}
 */
export function winBackDecision({ company, subscription, lastSentFor = null, to = null, suppressed = false, unsubscribed = false, now = new Date() } = {}) {
  if (!company) return { send: false, reason: "no_company" };
  if (company.isDemo) return { send: false, reason: "demo" };
  if (company.platformEndsAt || subscription?.accessLockedAt) return { send: false, reason: "ended_by_fieldquo" };
  if (!subscription || subscription.status !== "canceled") return { send: false, reason: "not_cancelled" };
  const canceledAt = dateOf(subscription.canceledAt);
  if (!canceledAt) return { send: false, reason: "no_cancel_date" };
  const key = subscription.stripeSubscriptionId || null;
  if (!key) return { send: false, reason: "no_subscription_key" };
  if (lastSentFor && lastSentFor === key) return { send: false, reason: "already_sent" };

  const elapsed = now.getTime() - canceledAt.getTime();
  if (elapsed < WIN_BACK_AFTER_DAYS * DAY) return { send: false, reason: "not_yet" };
  const readOnlyUntil = new Date(canceledAt.getTime() + CANCELLED_DAYS * DAY);
  if (now.getTime() >= readOnlyUntil.getTime()) return { send: false, reason: "window_passed" };

  if (!to || !String(to).includes("@")) return { send: false, reason: "no_recipient" };
  if (isReservedTestAddress(to)) return { send: false, reason: "test_address" };
  if (suppressed) return { send: false, reason: "do_not_contact" };
  if (unsubscribed) return { send: false, reason: "unsubscribed" };
  return { send: true, canceledAt, readOnlyUntil, key };
}

/**
 * Product updates published after `since` and up to `now`, newest first, in
 * `language` (whole-entry translation or English — localizedUpdate's rule).
 * Real entries from lib/data/productUpdates.js only; none → [] and the
 * letter has no "new since you left" section at all.
 */
export function updatesSince(since, { now = new Date(), language = "en", updates = PRODUCT_UPDATES } = {}) {
  const from = dateOf(since);
  if (!from) return [];
  const fromKey = from.toISOString().slice(0, 10);
  const toKey = now.toISOString().slice(0, 10);
  return (updates || [])
    .filter((u) => typeof u?.date === "string" && u.date > fromKey && u.date <= toKey)
    .map((u) => localizedUpdate(u, language));
}

/**
 * The letter's content, structured — text, never HTML — for the shared
 * layout to render once the preferences system exists. Pure.
 *
 * @returns {{ subject, preheader, heading, paragraphs: string[], updatesTitle,
 *             updates: Array<{ title, url|null }>, cta: { url, label } }}
 */
export function winBackContent({ companyName, readOnlyUntil, canceledAt, language = "en", origin, now = new Date(), updates = PRODUCT_UPDATES }) {
  const c = accountNoticeCopy(language);
  const base = String(origin || "https://www.fieldquo.com").replace(/\/+$/, "");
  const company = String(companyName || "").trim();
  const since = updatesSince(canceledAt, { now, language, updates });
  return {
    subject: c["winBack.subject"],
    preheader: c["winBack.preheader"],
    heading: c["winBack.heading"],
    paragraphs: [
      fillNotice(c["winBack.intro"], { company }),
      fillNotice(c["winBack.readonly"], { date: formatBillingDate(readOnlyUntil, language) }),
    ],
    updatesTitle: since.length ? c["winBack.updates"] : null,
    updates: since.map((u) => ({
      title: u.title,
      url: hasPost(u) ? `${base}/app/settings/product-updates/${u.slug}` : null,
    })),
    cta: { url: `${base}/app/settings/account-billing`, label: c["winBack.cta"] },
  };
}

const INK = "#111827";
const MUTED = "#4b5563";
const para = (html) => `<p style="font-size:15px;line-height:1.7;margin:0 0 14px 0;color:${INK};">${html}</p>`;

/**
 * The letter, in the shared layout as an "offers" letter. Pure.
 *
 * @param content  winBackContent()'s answer
 * @param footer   { mailingAddress, unsubscribeUrl, preferencesUrl, oneClickUrl }
 *                 — the layout refuses to build without the first two
 * @returns {{ subject, html, text, headers }}
 */
export function buildWinBackEmail({ content, language = "en", origin, footer = {} } = {}) {
  const c = content;
  const list = c.updates?.length
    ? `<p style="font-size:13px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:${MUTED};margin:18px 0 6px 0;">${escapeHtml(c.updatesTitle)}</p>` +
      `<ul style="margin:0 0 6px 0;padding-left:20px;font-size:15px;line-height:1.7;color:${INK};">${c.updates
        .map((u) => `<li style="margin:0 0 6px 0;">${u.url ? `<a href="${escapeAttr(u.url)}" style="color:${INK};">${escapeHtml(u.title)}</a>` : escapeHtml(u.title)}</li>`)
        .join("")}</ul>`
    : "";
  const { html, headers } = renderPlatformEmail({
    language,
    kind: "offers",
    preheader: c.preheader,
    heading: c.heading,
    bodyHtml: c.paragraphs.map((t) => para(escapeHtml(t))).join("") + list,
    cta: c.cta,
    origin,
    mailingAddress: footer.mailingAddress,
    unsubscribeUrl: footer.unsubscribeUrl,
    preferencesUrl: footer.preferencesUrl,
    oneClickUrl: footer.oneClickUrl,
  });
  const text = [
    c.heading,
    "",
    ...c.paragraphs.flatMap((t) => [t, ""]),
    ...(c.updates?.length ? [c.updatesTitle, ...c.updates.map((u) => (u.url ? `- ${u.title}: ${u.url}` : `- ${u.title}`)), ""] : []),
    labelled(language, c.cta.label, c.cta.url),
    "",
    ...platformTextFooter({ language, kind: "offers", mailingAddress: footer.mailingAddress, unsubscribeUrl: footer.unsubscribeUrl, preferencesUrl: footer.preferencesUrl }),
  ].join("\n");
  return { subject: c.subject, html, text, headers };
}
