// lib/lifecycle/marketing.js
//
// The two MARKETING lifecycle letters, for ONE company, end to end:
//
//   win-back         14 days after a cancellation took effect, while the
//                    account is still read-only (lib/lifecycle/winBack.js) —
//                    preference category "offers";
//   product updates  last month's changelog, during the first 7 local days of
//                    this month, only when last month HAS entries
//                    (lib/lifecycle/productNewsletter.js) — category "updates".
//
// Run by app/api/cron/lifecycle-emails (hourly at :40) after the trial
// sequence, with the same deps. It is lib/lifecycle/run.js's shape on purpose
// — read, decide, claim, re-read, gate, person, build, send, stamp — and it
// shares that file's two invariants rather than restating them:
//
//   ONE EMAIL A LOCAL DAY, 09:00–18:00 LOCAL: lib/lifecycle/plan.js
//   sendDayGate, the trial sequence's own gate. Every LifecycleEmail row of
//   the company counts (these kinds included), as do the next-steps letter
//   and the 7/3/1 trial reminders, so neither this file nor the trial
//   sequence can be the second email of a day.
//
//   ONCE: a LifecycleEmail row, unique on (companyId, kind), with the period
//   IN the kind — "win_back:<ended Stripe subscription id>" (one per
//   cancellation; a second cancellation is a new Stripe id),
//   "newsletter:<YYYY-MM>" (one per issue). No new column: the unique the
//   trial sequence already relies on is the lock, and the row is the record
//   the console reads.
//
// Every refusal is the honest one: a do-not-contact read that fails releases
// the claim (fails CLOSED — no letter, retried after FAILED_BACKOFF_MS); an
// owner whose preference is off is recorded `opted_out`; FieldQuo's mailing
// address unset refuses to build (the layout throws, CASL), releasing the
// claim so the letter goes once it is set, inside its window.

import { sendDayGate, safeTimeZone, localParts } from "./plan";
import { LIFECYCLE_COMPANY_SELECT, lifecycleRecipient } from "./facts";
import { claimLifecycleKind, nextStepsPendingUntil } from "./run";
import { winBackDecision, winBackContent, buildWinBackEmail } from "./winBack";
import { newsletterDecision, newsletterContent, buildNewsletterEmail, newsletterWindowOpen } from "./productNewsletter";
import { ensurePreferenceRow, userAllowsCategory } from "@/lib/email/preferencesStore";
import { preferencesUrls } from "@/lib/email/preferences";
import { LIFECYCLE_LANGUAGES } from "@/lib/i18n/lifecycleEmailCopy";
import { letterLanguage } from "@/lib/i18n/letterLanguage";
import { isReservedTestAddress } from "@/lib/signup/abandoned";

export const WIN_BACK_PREFIX = "win_back:";
export const NEWSLETTER_PREFIX = "newsletter:";
export const winBackKind = (stripeSubscriptionId) => `${WIN_BACK_PREFIX}${stripeSubscriptionId}`;
export const newsletterKind = (issueKey) => `${NEWSLETTER_PREFIX}${issueKey}`;

/** Which preference category each marketing kind is (lib/email/preferences.js). */
export function marketingCategory(kind) {
  if (String(kind).startsWith(WIN_BACK_PREFIX)) return "offers";
  if (String(kind).startsWith(NEWSLETTER_PREFIX)) return "updates";
  return null;
}

/** The Company columns this file reads: the trial sequence's, plus the subscription's own. */
export const MARKETING_COMPANY_SELECT = Object.freeze({
  ...LIFECYCLE_COMPANY_SELECT,
  subscription: {
    select: {
      id: true,
      status: true,
      canceledAt: true,
      stripeSubscriptionId: true,
      accessLockedAt: true,
      pastDueSince: true,
      cancelAtPeriodEnd: true,
      cancelAt: true,
      currentPeriodEnd: true,
    },
  },
});

const settled = (row) => Boolean(row && (row.sentAt || row.skipped));
const languageOf = (user, company) => letterLanguage(user, company, (c) => LIFECYCLE_LANGUAGES.includes(c));

/**
 * Which marketing letter, if any, this company is due — PURE.
 *
 * Win-back first: it has a hard end (the account locks on day 30) and is
 * sent once in the company's life per cancellation; the newsletter recurs.
 * The recipient's preferences and the do-not-contact list are NOT asked
 * here — they are read after the claim, in the request that sends. `to` is
 * the recipient's address: none, or a reserved test domain, means no letter
 * (the decisions say which).
 *
 * @param company  a MARKETING_COMPANY_SELECT row
 * @param rows     the company's LifecycleEmail rows (every kind)
 * @param issue    currentNewsletterIssue(now), or null when last month has none
 * @param to       the recipient's address, or ""
 * @returns {{ send: { kind, category, issue? , winBack? } | null, reason }}
 */
export function planMarketing({ now = new Date(), company, rows = [], issue = null, to = "", nextStepsPendingUntil: pending = null } = {}) {
  if (!company) return { send: null, reason: "no_company" };
  const byKind = new Map((rows || []).filter((r) => r?.kind).map((r) => [r.kind, r]));
  const sub = company.subscription || null;
  const candidates = [];
  const reasons = [];

  // ── Win-back ──────────────────────────────────────────────────────────────
  if (sub?.status === "canceled" && sub.stripeSubscriptionId) {
    const kind = winBackKind(sub.stripeSubscriptionId);
    const verdict = winBackDecision({ company, subscription: sub, lastSentFor: settled(byKind.get(kind)) ? sub.stripeSubscriptionId : null, to, now });
    if (verdict.send) candidates.push({ kind, category: "offers", winBack: verdict });
    else reasons.push(verdict.reason);
  }

  // ── Product updates ───────────────────────────────────────────────────────
  if (issue) {
    const kind = newsletterKind(issue.key);
    const today = localParts(now, safeTimeZone(company.timezone)).date;
    if (newsletterWindowOpen(issue.key, today)) {
      const verdict = newsletterDecision({
        company,
        issueKey: issue.key,
        lastIssueKey: settled(byKind.get(kind)) ? issue.key : null,
        to,
        now,
      });
      if (verdict.send) candidates.push({ kind, category: "updates", issue });
      else reasons.push(verdict.reason);
    } else reasons.push("outside_newsletter_window");
  }

  if (!candidates.length) return { send: null, reason: reasons[0] || "nothing_due" };
  const gate = sendDayGate({ now, company: { ...company, hasSubscription: Boolean(sub) }, rows: [...byKind.values()], nextStepsPendingUntil: pending });
  if (gate) return { send: null, reason: gate };
  return { send: candidates[0], reason: "due" };
}

/**
 * @param deps  the lifecycle cron's deps: { client, sendEmail, checkSuppression,
 *              mailingAddress, platformFrom, origin, now, nextStepsSettings }
 *              plus { issue } — currentNewsletterIssue(now)
 * @returns { outcome, kind?, reason? }
 */
export async function runMarketingForCompany(companyId, deps) {
  const { client, now, origin } = deps;
  const load = () => client.company.findUnique({ where: { id: companyId }, select: MARKETING_COMPANY_SELECT });
  const company = await load();
  if (!company) return { outcome: "gone" };
  if (company.isDemo) return { outcome: "nothing", reason: "demo" };
  const [rows, user] = await Promise.all([client.lifecycleEmail.findMany({ where: { companyId } }), lifecycleRecipient(companyId, { client })]);
  const to = String(user?.email || "").trim();
  const pending = nextStepsPendingUntil(company, deps.nextStepsSettings);
  const plan = planMarketing({ now, company, rows, issue: deps.issue || null, to, nextStepsPendingUntil: pending });
  if (!plan.send) return { outcome: "nothing", reason: plan.reason };

  const { kind, category } = plan.send;
  if (!(await claimLifecycleKind(client, companyId, kind, now))) return { outcome: "claimed_by_another_run", kind };
  const release = (error, failed = true) =>
    client.lifecycleEmail.updateMany({
      where: { companyId, kind, claimedAt: now, sentAt: null },
      data: { claimedAt: null, ...(failed ? { failedAt: now, error: String(error || "").slice(0, 500) } : {}) },
    });
  const skip = async (reason) => {
    await client.lifecycleEmail.updateMany({ where: { companyId, kind, claimedAt: now, sentAt: null }, data: { skipped: reason, claimedAt: null } });
    return { outcome: "skipped", kind, reason };
  };

  // ── Fresh reads after the claim: the decision again, on today's rows ────
  const fresh = await load();
  if (!fresh || fresh.isDemo) return skip("demo_or_gone");
  const freshRows = await client.lifecycleEmail.findMany({ where: { companyId } });
  const others = freshRows.filter((r) => r.kind !== kind);
  const again = planMarketing({ now, company: fresh, rows: others, issue: deps.issue || null, to, nextStepsPendingUntil: pending });
  if (!again.send || again.send.kind !== kind) {
    // The company came back, FieldQuo ended it, another letter went today…
    // Gate reasons are not decisions about THIS letter: release, try later.
    const gateReasons = new Set(["outside_send_hours", "claim_in_flight", "already_emailed_today", "next_steps_letter_pending", "trial_reminder_due_today"]);
    if (gateReasons.has(again.reason) || (again.send && again.send.kind !== kind)) {
      await release(null, false);
      return { outcome: "lost_race", kind, reason: again.reason };
    }
    return skip(again.reason || "no_longer_due");
  }

  // ── The person ────────────────────────────────────────────────────────────
  if (!user || !to) return skip("no_recipient");
  if (isReservedTestAddress(to)) return skip("test_address");
  let suppressed;
  try {
    suppressed = Boolean((await deps.checkSuppression(client, { channel: "email", email: to }))?.suppressed);
  } catch (err) {
    await release(`do-not-contact read failed: ${err?.message}`);
    return { outcome: "suppression_read_failed", kind };
  }
  if (suppressed) return skip("do_not_contact");
  if (!(await userAllowsCategory(user.id, category, { client }))) return skip("opted_out");

  // ── Build ─────────────────────────────────────────────────────────────────
  const language = languageOf(user, fresh);
  const pref = await ensurePreferenceRow(user.id, { client });
  const urls = preferencesUrls(origin, pref.token, category);
  const footer = { mailingAddress: deps.mailingAddress, unsubscribeUrl: urls.unsubscribe, preferencesUrl: preferencesUrls(origin, pref.token).page, oneClickUrl: urls.oneClick };
  let email;
  try {
    if (category === "offers") {
      const wb = again.send.winBack;
      const content = winBackContent({ companyName: fresh.name, readOnlyUntil: wb.readOnlyUntil, canceledAt: wb.canceledAt, language, origin, now });
      email = buildWinBackEmail({ content, language, origin, footer });
    } else {
      const content = newsletterContent({ issue: again.send.issue, language, origin });
      email = buildNewsletterEmail({ content, language, origin, footer });
    }
  } catch (err) {
    await release(`build failed: ${err?.message}`);
    return { outcome: "build_failed", kind, reason: err?.message };
  }

  // ── Send ──────────────────────────────────────────────────────────────────
  const result = await deps.sendEmail({ companyId, from: deps.platformFrom, to, subject: email.subject, html: email.html, text: email.text, headers: email.headers });
  if (result?.error || result?.skipped) {
    await release(result.error || "no_api_key");
    return { outcome: result.error ? "resend_rejected" : "no_api_key", kind };
  }
  await client.lifecycleEmail.updateMany({
    where: { companyId, kind, claimedAt: now },
    data: { sentAt: now, providerId: result?.id || null, toAddress: to, userId: user.id, language, subject: email.subject, failedAt: null, error: null },
  });
  return { outcome: "sent", kind };
}

/**
 * The cron's query for companies that could be due a marketing letter now —
 * wider than the rule (planMarketing decides per row), never narrower.
 */
export function marketingCandidatesWhere(now = new Date(), issue = null) {
  const DAY = 24 * 60 * 60 * 1000;
  const or = [
    // Win-back: cancelled between 30 and 13 days ago (a day of slack for time zones).
    { subscription: { is: { status: "canceled", accessLockedAt: null, canceledAt: { gte: new Date(now.getTime() - 30 * DAY), lte: new Date(now.getTime() - 13 * DAY) } } } },
  ];
  // Product updates: only while an issue exists and the 1st–8th (UTC) of the month
  // can hold somebody's local window.
  if (issue && now.getUTCDate() <= 8) {
    or.push({ subscription: { is: { status: { in: ["active", "trialing", "past_due"] }, accessLockedAt: null } } });
    or.push({ subscription: { is: null }, trialEndsAt: { gt: now } });
  }
  return { isDemo: false, platformEndsAt: null, OR: or };
}

