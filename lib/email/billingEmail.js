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
const FAINT = "#9ca3af";

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
 * @param kind     "started" | "changed" | "cancelled"
 * @param facts    [[label, value]] — plan name, seats, next billing date
 * @param billingUrl  deep link to Account & Billing
 */
export function buildBillingEmail({
  kind,
  companyName,
  planName,
  previousPlanName,
  facts = [],
  billingUrl,
  periodEnd,
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
