// lib/lifecycle/productNewsletter.js
//
// The monthly "What's new in FieldQuo" letter, summarising
// lib/data/productUpdates.js — the changelog /app/settings/product-updates
// already prints.
//
// ══ Content and selection only — nothing sends this yet ═════════════════════
//
// A newsletter is marketing mail: it must carry List-Unsubscribe and a
// "Manage preferences" link and honour the company's email preferences, and
// that system is being built separately (2026-10-11). Until it lands there is
// no cron, no route and no control for this — docs/ROADMAP.md lists it as
// waiting on the preferences system, with the stamp it will need. What is
// here is pure and executed by scripts/check-lifecycle-emails.mjs.
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
