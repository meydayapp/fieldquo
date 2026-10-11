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
import { billingEmailCopy } from "@/lib/i18n/billingEmailCopy";
import { pluralCategory } from "@/lib/i18n/plurals";
import { numberLocaleFor } from "@/app/i18n/numberLocale";
import { formatDateOnly } from "@/lib/format/companyDate";

const INK = "#111827";
const MUTED = "#4b5563";
// Measured, not chosen by eye. #9ca3af is 2.54:1 on the white card and 2.33:1
// on the page, against a 4.5:1 requirement — so the small print, which is
// where "what to do if this wasn't you" lives, was the least legible type in
// a billing email. #595f6b is 6.41:1 and 5.88:1 and still reads as quiet.
const FAINT = "#595f6b";

function shell({ heading, sub, body, cta, footer = billingEmailCopy("en").footer }) {
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
        ${escapeHtml(footer)}
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
 * @param atPeriodEnd "cancelled" only — the plan is booked to end on
 *                 `periodEnd` and works until then (a paid plan cancelled
 *                 from the product). False: it has ended. See
 *                 lib/billing/notify.js's notifyCancellation for why the two
 *                 are separate sentences.
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
 * @param language the READER's language — the owner's interface language,
 *                 else the company's, else English (lib/billing/
 *                 billingLanguage.js). Every sentence, button and the footer
 *                 come from lib/i18n/billingEmailCopy.js in it; dates and
 *                 amounts arrive pre-formatted (formatBillingDate). "en" is
 *                 the letter as it always was, byte for byte.
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
  atPeriodEnd = false,
  language = "en",
}) {
  const c = billingEmailCopy(language);
  // Subjects and headings are text: filled with the raw values (the shell
  // escapes the heading; a subject is a header, never HTML).
  const text = (key, values = {}) => fillCopy(c[key], values, (v) => String(v));
  // Paragraphs are HTML: every value is escaped and bolded, the way the
  // English letters always bolded the plan, the company, the date and the
  // amount.
  const html = (key, values = {}) => fillCopy(c[key], values, (v) => `<strong>${escapeHtml(v)}</strong>`);
  const footer = c.footer;

  const table = facts.length
    ? `<table role="presentation" width="100%" style="border-collapse:collapse;margin:0 0 8px 0;border-top:1px solid #e5e7eb;">
         ${facts.map(([l, v]) => factRow(l, v)).join("")}
       </table>`
    : "";

  if (kind === "started") {
    return {
      subject: text("started.subject", { plan: planName }),
      html: shell({
        heading: c["started.heading"],
        sub: companyName,
        body:
          p(html("started.body", { company: companyName, plan: planName })) +
          table +
          small(c["started.small"]),
        cta: billingUrl ? { url: billingUrl, label: c["cta.viewPlan"] } : null,
        footer,
      }),
    };
  }

  if (kind === "changed") {
    return {
      subject: text("changed.subject", { plan: planName }),
      html: shell({
        heading: c["changed.heading"],
        sub: companyName,
        body:
          p(
            previousPlanName
              ? html("changed.moved", { previous: previousPlanName, plan: planName })
              : html("changed.now", { plan: planName }),
          ) +
          table +
          small(c["changed.small"]),
        cta: billingUrl ? { url: billingUrl, label: c["cta.viewPlan"] } : null,
        footer,
      }),
    };
  }

  if (kind === "renewal") {
    return {
      subject: text("renewal.subject", { date: periodEnd }),
      html: shell({
        heading: c["renewal.heading"],
        sub: companyName,
        body:
          // The four things the task (and the card-network rules behind it)
          // require in one sentence: amount, date, and — when Stripe has
          // one — the card. The clause is OMITTED rather than left blank
          // when last4 is null, per AGENTS.md's "absence of a statement is
          // not a statement" — "the card on file" with nothing after it
          // would read as a typo, not as "we don't know".
          p(
            `${html("renewal.renews", { plan: planName, date: periodEnd })} ` +
              (last4
                ? html("renewal.cardLast4", { last4, amount: renewalAmount })
                : html("renewal.card", { amount: renewalAmount })),
          ) +
          table +
          small(c["renewal.small"]),
        cta: billingUrl ? { url: billingUrl, label: c["cta.manageBilling"] } : null,
        footer,
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
    // they usually are. Every language in lib/i18n/billingEmailCopy.js keeps
    // that register.
    //
    // The SECOND notice (reminder) is allowed to be firmer about the DATE
    // without changing that register — "your account locks on the 14th" is
    // a fact, not a threat, which is why it states `lockDate` plainly rather
    // than reaching for "last chance" or similar.
    const days = Math.max(0, Math.round(Number(daysLeft) || 0));
    // The count's word by the language's own plural rule (lib/i18n/plurals.js:
    // Ukrainian has three forms, French counts zero as singular), falling
    // back to the language's "other".
    const dayForm = c[`grace.days.${pluralCategory(numberLocaleFor(language), days)}`] ?? c["grace.days.other"];
    const dayWord = fillCopy(dayForm, { n: days }, (v) => String(v));
    return {
      subject: reminder ? text("grace.subjectRemind", { date: lockDate }) : c["grace.subjectStart"],
      html: shell({
        heading: reminder ? text("grace.headingRemind", { date: lockDate }) : c["grace.headingStart"],
        sub: companyName,
        body:
          // What happened.
          p(html("grace.what", { company: companyName })) +
          // What it means right now — read-only, and explicitly not deleted.
          // AGENTS.md and lib/billing/access.js are both emphatic about this:
          // the first fear when an account goes read-only is that the data
          // is gone, and it isn't — the single most reassuring true fact
          // available here, so it gets its own sentence.
          p(html("grace.readonly", { readOnly: c["grace.readOnlyWord"], nothingDeleted: c["grace.nothingDeletedWord"] })) +
          // Exactly how many days remain — a firm date on the reminder, a
          // day count on the first notice, never a threat either way.
          p(
            reminder
              ? html("grace.remind", { date: lockDate, days: dayWord })
              : html("grace.start", { days: dayWord }),
          ) +
          small(c["grace.small"]),
        // The one link that fixes it.
        cta: billingUrl ? { url: billingUrl, label: c["cta.updateCard"] } : null,
        footer,
      }),
    };
  }

  // cancelled
  const ending = Boolean(atPeriodEnd && periodEnd);
  return {
    subject: ending ? text("cancelled.subjectEnding", { date: periodEnd }) : c["cancelled.subjectEnded"],
    html: shell({
      heading: ending ? c["cancelled.headingEnding"] : c["cancelled.headingEnded"],
      sub: companyName,
      body:
        p(
          ending
            ? html("cancelled.ending", { plan: planName || "FieldQuo", date: periodEnd })
            : html("cancelled.ended", { plan: planName || "FieldQuo" }),
        ) +
        // Said plainly, because "what happens to my data" is the first question
        // and an unanswered one is why people phone.
        //
        // Deliberately does NOT say the public website goes offline. Website
        // hosting is currently ungated (ROADMAP §3) so that would be a false
        // statement in writing — and the moment entitlement IS enforced this
        // sentence needs to change with it, not before.
        small(c["cancelled.nothingDeleted"]) +
        small(ending ? c["cancelled.changedMind"] : c["cancelled.mistake"]),
      cta: billingUrl ? { url: billingUrl, label: ending ? c["cta.resumeMyPlan"] : c["cta.resume"] } : null,
      footer,
    }),
  };
}

/**
 * Fill a catalogue sentence's {placeholders}. `wrap` decides what a value
 * becomes — raw text for a subject, escaped-and-bold for a paragraph. A
 * placeholder with no value is left as written (never "undefined"), which
 * the check reads as a missing argument.
 */
function fillCopy(template, values, wrap) {
  return String(template ?? "").replace(/\{(\w+)\}/g, (m, k) =>
    Object.prototype.hasOwnProperty.call(values, k) ? wrap(values[k] ?? "") : m,
  );
}

/**
 * The words of these letters in `language` — for the callers that build the
 * facts table (lib/billing/notify.js) and the fallback company name, so the
 * labels beside the figures are in the same language as the sentences.
 */
export function billingLetterWords(language = "en") {
  return billingEmailCopy(language);
}

/**
 * A date in a billing letter, in the reader's language.
 *
 * English is formatDateOnly exactly as before ("Sep 6, 2026" — the English
 * payload is pinned byte-for-byte). Every other language gets its own month
 * name from Intl, in UTC like formatDateOnly, so a French letter does not say
 * "le Sep 6, 2026". A bad value prints formatDateOnly's own fallback.
 */
export function formatBillingDate(value, language = "en") {
  const code = String(language || "en").toLowerCase();
  if (code === "en") return formatDateOnly(value);
  const d = value instanceof Date ? value : value ? new Date(value) : null;
  if (!d || Number.isNaN(d.getTime())) return formatDateOnly(value);
  try {
    return new Intl.DateTimeFormat(numberLocaleFor(code), { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(d);
  } catch {
    return formatDateOnly(value);
  }
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
 * @param language    the footer's language (lib/i18n/billingEmailCopy.js).
 *                    Optional and English by default, so every caller that
 *                    predates it sends exactly what it sent; a caller whose
 *                    sentences are already in the reader's language passes
 *                    it, so the footer under them is too.
 */
export function buildPlatformNotice({ subject, heading, sub, paragraphs = [], facts = [], cta, language = "en" }) {
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
      footer: billingEmailCopy(language).footer,
    }),
  };
}
