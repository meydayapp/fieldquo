// lib/email/billingEmail.js
//
// FieldQuo → the company, about their own FieldQuo subscription.
//
// ── This is the one email family that is NOT white-labelled ────────────────
//
// Everything else FieldQuo sends carries the contractor's logo and their name in
// the From line, because a homeowner should not be able to tell what software
// they use. This is the opposite case: FieldQuo is the vendor and the company is
// the customer. A billing confirmation with the CONTRACTOR's branding on it
// would read as them having charged themselves, so these go out from FieldQuo's
// own platform sender (lib/email/platformSender.js) and look like FieldQuo.
//
// ── Not a tax receipt ──────────────────────────────────────────────────────
//
// Stripe issues the receipt and the invoice PDF, and it is the authority on what
// was charged. These say what CHANGED — you're subscribed, your plan moved, your
// plan is ending — and point at Stripe for the money. Producing our own document
// with an amount on it would create a second version of the truth that can
// disagree with Stripe's after a proration.

import { escapeHtml } from "@/lib/email/emailTheme";

const INK = "#111827";
const MUTED = "#4b5563";
// Measured, not chosen by eye. #9ca3af is 2.54:1 on the white card and 2.33:1
// on the page, against a 4.5:1 requirement — so the small print, which is
// where "what to do if this wasn't you" lives, was the least legible type in
// a billing email. #595f6b is 6.41:1 and 5.88:1 and still reads as quiet.
const FAINT = "#595f6b";

function shell({ heading, sub, body, cta }) {
  return `<!DOCTYPE html>
<html>
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
  <body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;color:${INK};">
    <div style="max-width:560px;margin:0 auto;">
      <div style="background:${INK};color:#ffffff;padding:32px 30px;text-align:center;">
        <h1 style="margin:0;font-size:22px;font-weight:700;">${escapeHtml(heading)}</h1>
        ${sub ? `<p style="margin:8px 0 0 0;opacity:0.85;font-size:14px;">${escapeHtml(sub)}</p>` : ""}
      </div>
      <div style="background:#ffffff;padding:32px 30px;">
        ${body}
        ${
          cta
            ? `<div style="text-align:center;margin:28px 0 0 0;">
                 <a href="${cta.url}" style="display:inline-block;padding:14px 32px;background:${INK};color:#ffffff !important;text-decoration:none;border-radius:8px;font-weight:700;font-size:15px;">${escapeHtml(cta.label)}</a>
               </div>`
            : ""
        }
      </div>
      <div style="text-align:center;padding:20px;color:${FAINT};font-size:12px;">
        FieldQuo · you're receiving this because you manage this company's billing.
      </div>
    </div>
  </body>
</html>`;
}

const p = (text) =>
  `<p style="font-size:15px;line-height:1.7;margin:0 0 16px 0;">${text}</p>`;
const small = (text) =>
  `<p style="font-size:14px;line-height:1.7;color:${MUTED};margin:0 0 16px 0;">${text}</p>`;

function factRow(label, value) {
  return `<tr>
    <td style="padding:8px 0;font-size:14px;color:${MUTED};">${escapeHtml(label)}</td>
    <td style="padding:8px 0;font-size:14px;font-weight:700;text-align:right;">${escapeHtml(value)}</td>
  </tr>`;
}

/**
 * @param kind     "started" | "changed" | "cancelled" | "renewal" | "grace"
 * @param facts    [[label, value]] — plan name, seats, next billing date
 * @param billingUrl  deep link to Account & Billing
 * @param renewalAmount  "renewal" only — pre-formatted in the company's own
 *                       currency (lib/currency.js's formatMoney), because this
 *                       module knows nothing about currencies and shouldn't
 *                       have to — every other amount in this file is equally
 *                       pre-formatted, via `facts`.
 * @param last4    "renewal" only — the card's last four digits, or null when
 *                 Stripe couldn't say. The card networks' own advance-notice
 *                 rules this email exists to satisfy ask for the amount and a
 *                 way to cancel; they don't require the card number, so a null
 *                 here changes a sentence, not whether the email is honest.
 * @param daysLeft "grace" only — from lib/billing/graceWarning.js /
 *                 lib/billing/access.js's accessFor(), never invented here.
 * @param lockDate "grace" only — the account's lock date, pre-formatted
 *                 (formatDateOnly), from graceWarningDecision's `lockAt`.
 *                 Only the reminder's copy uses it, to state a firm date
 *                 ("locks on Sep 6, 2026") rather than only a day count —
 *                 the owner's example of firmness that reads as a fact, not
 *                 a threat.
 * @param reminder "grace" only — true for the one reminder near the end of
 *                 the window (lib/billing/graceWarning.js's grace_remind),
 *                 false for the notice sent when grace opens (grace_start).
 *                 Changes the subject/heading and whether a firm date is
 *                 stated, never the register — both are equally calm, and
 *                 both always say the same three things: what happened,
 *                 what it means right now, and how many days are left.
 */
export function buildBillingEmail({
  kind,
  companyName,
  planName,
  previousPlanName,
  facts = [],
  billingUrl,
  periodEnd,
  renewalAmount,
  last4,
  daysLeft,
  lockDate,
  reminder,
}) {
  const table = facts.length
    ? `<table role="presentation" width="100%" style="border-collapse:collapse;margin:0 0 8px 0;border-top:1px solid #e5e7eb;">
         ${facts.map(([l, v]) => factRow(l, v)).join("")}
       </table>`
    : "";

  if (kind === "started") {
    return {
      subject: `You're subscribed to FieldQuo — ${planName}`,
      html: shell({
        heading: "You're all set",
        sub: companyName,
        body:
          p(`Thanks for subscribing. <strong>${escapeHtml(companyName)}</strong> is now on the <strong>${escapeHtml(planName)}</strong> plan.`) +
          table +
          small(
            "Your receipt and invoices come from Stripe — they're the record for your accountant. You can change or cancel your plan at any time from Account &amp; Billing.",
          ),
        cta: billingUrl ? { url: billingUrl, label: "View your plan" } : null,
      }),
    };
  }

  if (kind === "changed") {
    return {
      subject: `Your FieldQuo plan changed to ${planName}`,
      html: shell({
        heading: "Your plan changed",
        sub: companyName,
        body:
          p(
            previousPlanName
              ? `You've moved from <strong>${escapeHtml(previousPlanName)}</strong> to <strong>${escapeHtml(planName)}</strong>.`
              : `You're now on the <strong>${escapeHtml(planName)}</strong> plan.`,
          ) +
          table +
          small(
            "Stripe works out any difference for the rest of your current period and will show it on your next invoice.",
          ),
        cta: billingUrl ? { url: billingUrl, label: "View your plan" } : null,
      }),
    };
  }

  if (kind === "renewal") {
    return {
      subject: `Your FieldQuo subscription renews on ${periodEnd}`,
      html: shell({
        heading: "Your subscription renews soon",
        sub: companyName,
        body:
          // The four things the task (and the card-network rules behind it)
          // require in one sentence: amount, date, and — when Stripe has
          // one — the card. The clause is OMITTED rather than left blank
          // when last4 is null, per AGENTS.md's "absence of a statement is
          // not a statement" — "the card on file" with nothing after it
          // would read as a typo, not as "we don't know".
          p(
            `Your <strong>${escapeHtml(planName)}</strong> plan renews on <strong>${escapeHtml(periodEnd)}</strong>. ` +
              (last4
                ? `The card on file ending in <strong>${escapeHtml(last4)}</strong> will be charged <strong>${escapeHtml(renewalAmount)}</strong>.`
                : `Your card on file will be charged <strong>${escapeHtml(renewalAmount)}</strong>.`),
          ) +
          table +
          small(
            "You can change plans or cancel any time before then from Account &amp; Billing — nothing is charged until the renewal date above.",
          ),
        cta: billingUrl ? { url: billingUrl, label: "Manage billing" } : null,
      }),
    };
  }

  if (kind === "grace") {
    // ── Register, set deliberately ────────────────────────────────────────
    //
    // This lands on somebody's worst admin day. The owner was explicit:
    // empathetic, no urgency language, no capitals, nothing that reads as a
    // collections notice. A failed card is almost always a bank's fraud hold
    // or an expired expiry date, not a decision anyone made — so the copy
    // says that, out loud, in the first sentence, rather than leaving the
    // reader to assume the worse explanation. Write it as though the reader
    // is a competent person about to fix this in ninety seconds, because
    // they usually are.
    //
    // The SECOND notice (reminder) is allowed to be firmer about the DATE
    // without changing that register — "your account locks on the 14th" is
    // a fact, not a threat, which is why it states `lockDate` plainly rather
    // than reaching for "last chance" or similar.
    const days = Math.max(0, Math.round(Number(daysLeft) || 0));
    const dayWord = days === 1 ? "1 day" : `${days} days`;
    return {
      subject: reminder
        ? `Your FieldQuo account locks on ${lockDate}`
        : "We couldn't charge the card for your FieldQuo account",
      html: shell({
        heading: reminder ? `Your account locks on ${lockDate}` : "We couldn't charge your card",
        sub: companyName,
        body:
          // What happened.
          p(
            `We weren't able to charge the card on file for <strong>${escapeHtml(companyName)}</strong>. This is almost always a bank's fraud hold or a card that's expired — not something anyone did wrong.`,
          ) +
          // What it means right now — read-only, and explicitly not deleted.
          // AGENTS.md and lib/billing/access.js are both emphatic about this:
          // the first fear when an account goes read-only is that the data
          // is gone, and it isn't — the single most reassuring true fact
          // available here, so it gets its own sentence.
          p(
            `Right now the account is <strong>read-only</strong>: everyone can still see every quote, invoice, client and photo exactly as it is. Nobody can create or send anything new until it's fixed, and <strong>nothing has been deleted</strong>.`,
          ) +
          // Exactly how many days remain — a firm date on the reminder, a
          // day count on the first notice, never a threat either way.
          p(
            reminder
              ? `The account locks on <strong>${escapeHtml(lockDate)}</strong> — that's <strong>${dayWord}</strong> from now. Update the card before then and everything keeps working exactly as it does today.`
              : `You have <strong>${dayWord}</strong> to update the card before the account locks.`,
          ) +
          small("Updating the card takes about a minute, and everything comes back the moment it's done."),
        // The one link that fixes it.
        cta: billingUrl ? { url: billingUrl, label: "Update your card" } : null,
      }),
    };
  }

  // cancelled
  return {
    subject: "Your FieldQuo plan has been cancelled",
    html: shell({
      heading: "Your plan is ending",
      sub: companyName,
      body:
        p(
          periodEnd
            ? `Your <strong>${escapeHtml(planName || "FieldQuo")}</strong> plan is cancelled and you'll keep access until <strong>${escapeHtml(periodEnd)}</strong>.`
            : `Your <strong>${escapeHtml(planName || "FieldQuo")}</strong> plan has been cancelled.`,
        ) +
        // Said plainly, because "what happens to my data" is the first question
        // and an unanswered one is why people phone.
        //
        // Deliberately does NOT say the public website goes offline. Website
        // hosting is currently ungated (ROADMAP §3) so that would be a false
        // statement in writing — and the moment entitlement IS enforced this
        // sentence needs to change with it, not before.
        small(
          "Nothing is deleted. Your quotes, clients, invoices and website content stay exactly as they are, and picking a plan again turns everything back on.",
        ) +
        small("If you cancelled by mistake, you can resubscribe straight away."),
      cta: billingUrl ? { url: billingUrl, label: "Choose a plan" } : null,
    }),
  };
}

/**
 * The same FieldQuo-branded shell, for a platform charge that isn't the
 * subscription.
 *
 * Added for the phone number's monthly rental (lib/voice/spendGate.js), which is
 * FieldQuo billing the company for something FieldQuo is itself being charged
 * for — the same relationship the emails above describe, so the same envelope.
 * Building a second shell in the voice module would have produced a second
 * header, a second footer and a second set of colours to keep in step, and the
 * copy that drifts is always the one nobody looks at.
 *
 * `paragraphs` carries pre-escaped HTML on purpose: the rental notices bold a
 * date and a "your number still works", and forcing them through escapeHtml
 * would print the tags. Callers are server-side and pass their own literals —
 * nothing here interpolates anything a contractor typed.
 *
 * @param paragraphs  string[] of HTML
 * @param facts       [[label, value]] — escaped for you
 */
export function buildPlatformNotice({ subject, heading, sub, paragraphs = [], facts = [], cta }) {
  const table = facts.length
    ? `<table role="presentation" width="100%" style="border-collapse:collapse;margin:0 0 8px 0;border-top:1px solid #e5e7eb;">
         ${facts.map(([l, v]) => factRow(l, v)).join("")}
       </table>`
    : "";

  return {
    subject: subject || heading,
    html: shell({
      heading,
      sub,
      body: paragraphs.map((text) => p(text)).join("") + table,
      cta: cta || null,
    }),
  };
}
