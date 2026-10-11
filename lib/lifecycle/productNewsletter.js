// lib/lifecycle/productNewsletter.js
//
// The monthly "What's new in FieldQuo" letter, summarising
// lib/data/productUpdates.js — the changelog /app/settings/product-updates
// already prints.
//
// ══ Sent by the hourly lifecycle cron, as an "updates" letter ═══════════════
//
// lib/lifecycle/marketing.js sends it from app/api/cron/lifecycle-emails in
// the shared layout as kind "updates" — mailing address, Unsubscribe, "Manage
// email preferences", List-Unsubscribe headers — only to an owner whose
// "updates" preference is on, during the first NEWSLETTER_SEND_DAYS local days
// of the month after the issue's month. Recorded once per company per issue
// as a LifecycleEmail row of kind "newsletter:<YYYY-MM>". What is here is pure
// and executed by scripts/check-billing-lifecycle-emails.mjs.
//
// ══ The rule ════════════════════════════════════════════════════════════════
//
//   issue    the changelog entries dated inside ONE calendar month (UTC, by
//            the entry's ISO day), newest first. A month with no entry has
//            NO issue — never a letter that says "nothing new", and never
//            invented filler: the entries are what FieldQuo actually shipped
//            and wrote up.
//   who      a company that is a customer now: a live plan (active,
//            trialing, or past_due in its grace week) or a card-free trial
//            still running — lib/billing/access.js's own words for it. Never
//            a demo, anything FieldQuo ended or locked, a cancelled or
//            expired company (that is the win-back letter's audience, once),
//            an address on the do-not-contact list, a company that
//            unsubscribed, a reserved test address.
//   once     per issue — keyed on the month ("2026-09"), so a re-run sends
//            nothing and next month's issue is a new key.
//   language each entry in the reader's language when its translation is
//            complete, English otherwise (localizedUpdate — whole entry or
//            none, never a French title over English paragraphs).

import { PRODUCT_UPDATES, localizedUpdate, hasPost } from "@/lib/data/productUpdates";
import { accountNoticeCopy, fillNotice } from "@/lib/i18n/accountNoticeCopy";
import { numberLocaleFor } from "@/app/i18n/numberLocale";
import { accessFor, trialAccessFor, fieldquoEndAccessFor } from "@/lib/billing/access";
import { isReservedTestAddress } from "@/lib/signup/abandoned";
import { escapeHtml, escapeAttr } from "@/lib/email/emailTheme";
import { renderPlatformEmail, platformTextFooter } from "@/lib/email/platformLayout";
import { labelled } from "@/lib/i18n/lifecycleEmailCopy";

/** "2026-09" for any instant in September 2026 (UTC). */
export function issueKeyFor(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 7);
}

/**
 * The issue for one month, or null when nothing shipped in it. Pure.
 *
 * @param month  any instant inside the month to cover (the cron will pass
 *               the 1st of the previous month, as monthly-digest does)
 * @returns {{ key, monthStart: Date, entries: object[] } | null}
 */
export function newsletterIssue(month, { updates = PRODUCT_UPDATES } = {}) {
  const key = issueKeyFor(month);
  if (!key) return null;
  const entries = (updates || [])
    .filter((u) => typeof u?.date === "string" && u.date.slice(0, 7) === key)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  if (!entries.length) return null;
  const [y, m] = key.split("-").map(Number);
  return { key, monthStart: new Date(Date.UTC(y, m - 1, 1)), entries };
}

/**
 * Should this company receive this issue? Pure.
 *
 * @param company        { isDemo, platformEndsAt, platformEndMode, trialEndsAt, subscription }
 * @param issueKey       newsletterIssue().key
 * @param lastIssueKey   the issue last sent to this company (the stamp the
 *                       wiring will add), or null
 * @param to             the address
 * @param suppressed     do-not-contact closes email for `to`
 * @param unsubscribed   opted out of product/marketing email (preferences)
 */
export function newsletterDecision({ company, issueKey, lastIssueKey = null, to = null, suppressed = false, unsubscribed = false, now = new Date() } = {}) {
  if (!company) return { send: false, reason: "no_company" };
  if (!issueKey) return { send: false, reason: "no_issue" };
  if (company.isDemo) return { send: false, reason: "demo" };
  if (fieldquoEndAccessFor(company, now)) return { send: false, reason: "ended_by_fieldquo" };
  if (lastIssueKey === issueKey) return { send: false, reason: "already_sent" };

  const sub = company.subscription || null;
  let customer = false;
  if (sub) {
    const a = accessFor(sub, now);
    if (a.reason === "terms") return { send: false, reason: "ended_by_fieldquo" };
    customer = sub.status === "active" || sub.status === "trialing" || (a.reason === "past_due" && a.level === "readonly");
  } else {
    const trial = trialAccessFor(company, now);
    customer = Boolean(trial && trial.reason === "trial_no_plan" && trial.level === "full");
  }
  if (!customer) return { send: false, reason: "not_a_customer" };

  if (!to || !String(to).includes("@")) return { send: false, reason: "no_recipient" };
  if (isReservedTestAddress(to)) return { send: false, reason: "test_address" };
  if (suppressed) return { send: false, reason: "do_not_contact" };
  if (unsubscribed) return { send: false, reason: "unsubscribed" };
  return { send: true, key: issueKey };
}

/**
 * The issue for month M goes out during the first NEWSLETTER_SEND_DAYS local
 * days of month M+1 — the month's news while it is still news, inside the
 * same 09:00–18:00 local, one-email-a-day gate as every lifecycle letter
 * (lib/lifecycle/plan.js sendDayGate). A company the gate blocks all week
 * simply does not get that issue: a September newsletter in late October is
 * not news, and next month's issue is a new key.
 */
export const NEWSLETTER_SEND_DAYS = 7;

/** "2026-10" for the issue "2026-09". */
export function monthAfter(issueKey) {
  const [y, m] = String(issueKey || "").split("-").map(Number);
  if (!y || !m) return null;
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

/** Is `localDate` ("YYYY-MM-DD", the company's own calendar) inside this issue's send window? */
export function newsletterWindowOpen(issueKey, localDate) {
  const date = String(localDate || "");
  return monthAfter(issueKey) === date.slice(0, 7) && Number(date.slice(8, 10)) >= 1 && Number(date.slice(8, 10)) <= NEWSLETTER_SEND_DAYS;
}

/** The issue the cron offers at `now`: last month's (UTC), when it has entries. */
export function currentNewsletterIssue(now = new Date(), { updates = PRODUCT_UPDATES } = {}) {
  const lastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 15));
  return newsletterIssue(lastMonth, { updates });
}

/** "September 2026" in the reader's language. */
export function issueMonthLabel(monthStart, language = "en") {
  try {
    return new Intl.DateTimeFormat(numberLocaleFor(language), { month: "long", year: "numeric", timeZone: "UTC" }).format(monthStart);
  } catch {
    return new Intl.DateTimeFormat("en-CA", { month: "long", year: "numeric", timeZone: "UTC" }).format(monthStart);
  }
}

/**
 * The letter's content, structured — text, never HTML — for the shared
 * layout to render. Pure.
 *
 * @returns {{ subject, preheader, heading, intro, items: Array<{ title, body, url|null, linkLabel|null }>, cta }}
 */
export function newsletterContent({ issue, language = "en", origin }) {
  if (!issue?.entries?.length) return null;
  const c = accountNoticeCopy(language);
  const base = String(origin || "https://www.fieldquo.com").replace(/\/+$/, "");
  const month = issueMonthLabel(issue.monthStart, language);
  const items = issue.entries.map((raw) => {
    const u = localizedUpdate(raw, language);
    const url = hasPost(u) ? `${base}/app/settings/product-updates/${u.slug}` : null;
    return { title: u.title, body: u.body, url, linkLabel: url ? c["updates.readMore"] : null };
  });
  return {
    subject: fillNotice(c["updates.subject"], { month }),
    // The first entry's title: the line an inbox shows beside the subject.
    preheader: items[0].title,
    heading: c["updates.heading"],
    intro: fillNotice(c["updates.intro"], { month }),
    items,
    cta: { url: `${base}/app/settings/product-updates`, label: c["updates.cta"] },
  };
}

const INK = "#111827";
const MUTED = "#4b5563";
const RULE = "#e5e7eb";

/**
 * The letter, in the shared layout as an "updates" letter. Pure.
 *
 * @param content  newsletterContent()'s answer
 * @param footer   { mailingAddress, unsubscribeUrl, preferencesUrl, oneClickUrl }
 * @returns {{ subject, html, text, headers }}
 */
export function buildNewsletterEmail({ content, language = "en", origin, footer = {} } = {}) {
  const c = content;
  if (!c?.items?.length) throw new Error("buildNewsletterEmail: an issue with no entries is not sent.");
  const items = c.items
    .map(
      (i, n) =>
        `<div style="${n ? `border-top:1px solid ${RULE};padding-top:16px;` : ""}margin:0 0 16px 0;">` +
        `<p style="font-size:16px;line-height:1.5;font-weight:700;margin:0 0 6px 0;color:${INK};">${escapeHtml(i.title)}</p>` +
        `<p style="font-size:15px;line-height:1.7;margin:0 0 6px 0;color:${INK};">${escapeHtml(i.body)}</p>` +
        (i.url ? `<p style="font-size:14px;line-height:1.6;margin:0;"><a href="${escapeAttr(i.url)}" style="color:${INK};">${escapeHtml(i.linkLabel)} &rsaquo;</a></p>` : "") +
        `</div>`,
    )
    .join("");
  const { html, headers } = renderPlatformEmail({
    language,
    kind: "updates",
    preheader: c.preheader,
    heading: c.heading,
    bodyHtml: `<p style="font-size:15px;line-height:1.7;margin:0 0 18px 0;color:${MUTED};">${escapeHtml(c.intro)}</p>` + items,
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
    c.intro,
    "",
    ...c.items.flatMap((i) => [i.title, i.body, ...(i.url ? [labelled(language, i.linkLabel, i.url)] : []), ""]),
    labelled(language, c.cta.label, c.cta.url),
    "",
    ...platformTextFooter({ language, kind: "updates", mailingAddress: footer.mailingAddress, unsubscribeUrl: footer.unsubscribeUrl, preferencesUrl: footer.preferencesUrl }),
  ].join("\n");
  return { subject: c.subject, html, text, headers };
}
