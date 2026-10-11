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
import { EMAIL_ASSET_ORIGIN, renderPlatformEmail, platformTextFooter } from "@/lib/email/platformLayout";
import { labelled } from "@/lib/i18n/lifecycleEmailCopy";
import { mailingAddress as fieldquoMailingAddress } from "@/lib/legal/mailingAddress";

const MUTED = "#4b5563";

/**
 * The envelope — since 2026-10-11 the shared FieldQuo→contractor layout
 * (lib/email/platformLayout.js) as a TRANSACTIONAL letter: the layout's logo
 * and Help · Your account header, its footer label ("A service email about
 * your FieldQuo account…", in the reader's language), FieldQuo's mailing
 * address when SALES_MAILING_ADDRESS is set, and never an unsubscribe or a
 * preferences link — billing mail cannot be switched off, so a switch would be
 * a control that appears to work and doesn't.
 *
 * Only the envelope changed. The subject, heading, company line, the body's
 * own HTML and the button are exactly what the letters carried before the
 * move — `parts` returns them, and scripts/check-billing-lifecycle-emails.mjs
 * compares their md5 for every kind in every language with the record taken
 * from the old shell (b7a907881). The letters gain the plain-text part they
 * never had, built from the same parts.
 *
 * @returns {{ html, text, parts: { heading, sub, body, cta } }}
 */
function shell({ heading, sub, body, cta, language = "en", mailingAddress = fieldquoMailingAddress() }) {
  const origin = originOf(cta?.url);
  const bodyText = htmlToText(body);
  const { html } = renderPlatformEmail({
    language,
    kind: "transactional",
    // The letter's own first sentence as the inbox preview — no new words.
    preheader: bodyText.split("\n").find((l) => l.trim()) || null,
    heading,
    sub,
    bodyHtml: body,
    cta: cta && cta.url && cta.label ? cta : null,
    origin,
    mailingAddress,
  });
  const text = [
    heading,
    ...(sub ? [sub] : []),
    "",
    bodyText,
    "",
    ...(cta?.url && cta?.label ? [labelled(language, cta.label, cta.url), ""] : []),
    ...platformTextFooter({ language, kind: "transactional", mailingAddress }),
  ].join("\n");
  return { html, text, parts: { heading, sub, body, cta: cta ? { url: cta.url, label: cta.label } : null } };
}

/** The layout's header links need an absolute origin: the button's, else the public site. */
function originOf(url) {
  try {
    return url ? new URL(url).origin : EMAIL_ASSET_ORIGIN;
  } catch {
    return EMAIL_ASSET_ORIGIN;
  }
}

/**
 * A letter body's HTML as plain text: paragraphs become blank-line-separated
 * lines, a fact row becomes "Label: value", every tag goes and the five
 * entities these builders write are decoded. Exported for the check.
 */
export function htmlToText(html) {
  return String(html || "")
    .replace(/<\/td>\s*<td[^>]*>/g, ": ")
    .replace(/<\/tr>/g, "\n")
    .replace(/<\/p>/g, "\n\n")
    .replace(/<br\s*\/?>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .split("\n")
    .map((l) => l.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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
 *                 else the company's, else English (lib/i18n/
 *                 letterLanguage.js). Every sentence and button comes from
 *                 lib/i18n/billingEmailCopy.js in it, the layout's chrome and
 *                 footer from lib/i18n/lifecycleEmailCopy.js; dates and
 *                 amounts arrive pre-formatted (formatBillingDate).
 * @param mailingAddress  FieldQuo's postal address for the footer — the
 *                 SALES_MAILING_ADDRESS setting unless a check passes one; ""
 *                 prints none (a transactional letter does not require it).
 * @returns { subject, html, text, parts }
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
  mailingAddress = fieldquoMailingAddress(),
}) {
  const c = billingEmailCopy(language);
  // Subjects and headings are text: filled with the raw values (the shell
  // escapes the heading; a subject is a header, never HTML).
  const text = (key, values = {}) => fillCopy(c[key], values, (v) => String(v));
  // Paragraphs are HTML: every value is escaped and bolded, the way the
  // English letters always bolded the plan, the company, the date and the
  // amount.
  const html = (key, values = {}) => fillCopy(c[key], values, (v) => `<strong>${escapeHtml(v)}</strong>`);

  const table = facts.length
    ? `<table role="presentation" width="100%" style="border-collapse:collapse;margin:0 0 8px 0;border-top:1px solid #e5e7eb;">
         ${facts.map(([l, v]) => factRow(l, v)).join("")}
       </table>`
    : "";

  if (kind === "started") {
    return {
      subject: text("started.subject", { plan: planName }),
      ...shell({
        heading: c["started.heading"],
        sub: companyName,
        body:
          p(html("started.body", { company: companyName, plan: planName })) +
          table +
          small(c["started.small"]),
        cta: billingUrl ? { url: billingUrl, label: c["cta.viewPlan"] } : null,
        language,
        mailingAddress,
      }),
    };
  }

  if (kind === "changed") {
    return {
      subject: text("changed.subject", { plan: planName }),
      ...shell({
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
        language,
        mailingAddress,
      }),
    };
  }

  if (kind === "renewal") {
    return {
      subject: text("renewal.subject", { date: periodEnd }),
      ...shell({
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
        language,
        mailingAddress,
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
      ...shell({
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
        language,
        mailingAddress,
      }),
    };
  }

  // cancelled
  const ending = Boolean(atPeriodEnd && periodEnd);
  return {
    subject: ending ? text("cancelled.subjectEnding", { date: periodEnd }) : c["cancelled.subjectEnded"],
    ...shell({
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
      language,
      mailingAddress,
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
 * @param language    the layout's chrome and footer language. English by
 *                    default (the phone-rent and ticket notices are written
 *                    in English); a caller whose sentences are in the
 *                    reader's language passes it, so the chrome matches.
 * @returns { subject, html, text, parts } — callers send `text` too.
 */
export function buildPlatformNotice({ subject, heading, sub, paragraphs = [], facts = [], cta, language = "en", mailingAddress = fieldquoMailingAddress() }) {
  const table = facts.length
    ? `<table role="presentation" width="100%" style="border-collapse:collapse;margin:0 0 8px 0;border-top:1px solid #e5e7eb;">
         ${facts.map(([l, v]) => factRow(l, v)).join("")}
       </table>`
    : "";

  return {
    subject: subject || heading,
    ...shell({
      heading,
      sub,
      body: paragraphs.map((text) => p(text)).join("") + table,
      cta: cta || null,
      language,
      mailingAddress,
    }),
  };
}
