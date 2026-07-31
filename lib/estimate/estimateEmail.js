// lib/estimate/estimateEmail.js
//
// The estimate confirmation a homeowner receives after the instant-quote form.
//
// ══ It must look like it came from the contractor ══════════════════════════
//
// White-label is the product: this email carries the company's logo, colour and
// name, and says nothing about FieldQuo. A homeowner comparing three
// contractors must not be able to tell two of them run on the same software. So
// the brand comes from the same documentTheme every quote and invoice uses, and
// the button colour is the same MEASURED pair (fillPair) — a yellow-brand
// company gets a readable button, not white-on-yellow.
//
// ══ It obeys the same two rules the on-screen result did ═══════════════════
//
//   visibility  a gated trade shows NO figure here either — not in an email a
//               homeowner keeps. Only when the owner chose "range" does the
//               number appear, and always labelled an estimate, never a quote.
//   financing   the company's own words or a provider link. No monthly figure —
//               FieldQuo doesn't provide financing and won't imply a term.
//
// Pure. No database, no network — hand it the facts, it returns { subject, html }.
import { documentTheme, fillPair } from "@/lib/documents/theme";
import { escapeHtml, safeUrl } from "@/lib/email/emailTheme";
import { publicEstimate } from "./visibility";
import { financingOffer, financingCtaLabel } from "./financing";

const COPY = {
  en: {
    subject: (c) => `Your estimate from ${c}`,
    greeting: (n) => (n ? `Hi ${n},` : "Hi,"),
    thanksRange: (c) => `Thanks for the details. Here's your estimated range from ${c}:`,
    thanksGated: (c) => `Thanks for the details — ${c} is putting your quote together.`,
    rangeLabel: "Estimated range",
    beforeTax: "before tax",
    disclaimer: (c) =>
      `This is an estimate based on what you told us. ${c} will review it and confirm the exact price before anything is binding — no obligation.`,
    reference: "Your reference",
    next: "We'll be in touch shortly.",
  },
  fr: {
    subject: (c) => `Votre estimation de ${c}`,
    greeting: (n) => (n ? `Bonjour ${n},` : "Bonjour,"),
    thanksRange: (c) => `Merci pour les détails. Voici votre fourchette estimée de ${c} :`,
    thanksGated: (c) => `Merci pour les détails — ${c} prépare votre soumission.`,
    rangeLabel: "Fourchette estimée",
    beforeTax: "avant taxes",
    disclaimer: (c) =>
      `Ceci est une estimation basée sur vos réponses. ${c} la révisera et confirmera le prix exact avant tout engagement — sans obligation.`,
    reference: "Votre référence",
    next: "Nous vous contacterons sous peu.",
  },
};

function copyFor(language) {
  return COPY[language] || COPY.en;
}

const money = (n) => `$${Math.round(Number(n) || 0).toLocaleString("en-CA")}`;

/**
 * Build the homeowner's estimate email.
 *
 * @param company      { name, logoUrl, brandColor, email, phone, ... }
 * @param contact      { name }
 * @param estimate     { low, high } computed server-side (or null)
 * @param visibility   "gated" | "range"
 * @param reference    the quote number to quote back
 * @param language     "en" | "fr"
 * @returns { subject, html }
 */
export function buildEstimateEmail({
  company = {},
  contact = {},
  estimate = null,
  visibility = "gated",
  reference = null,
  language = "en",
}) {
  const t = copyFor(language);
  const theme = documentTheme(company);
  const companyName = company.name || "us";

  // The button/accent pair, measured for contrast — same as every FieldQuo doc.
  const { bg: accent, fg: accentInk } = fillPair(theme);
  const logo = company.logoUrl ? safeUrl(company.logoUrl) : null;

  // The gate: a real figure only when the owner chose "range" AND it's valid.
  const pub = publicEstimate(estimate, visibility);
  const financing = financingOffer(company.financing, { language });

  const rangeBlock = pub.show
    ? `
    <div style="background:${accent}14;border:1px solid ${accent};border-radius:10px;padding:20px;text-align:center;margin:22px 0;">
      <div style="font-size:12px;letter-spacing:.05em;text-transform:uppercase;color:#6b7280;">${escapeHtml(t.rangeLabel)}</div>
      <div style="font-size:30px;font-weight:800;color:${accent};margin-top:4px;">${money(pub.low)} – ${money(pub.high)}</div>
      <div style="font-size:12px;color:#6b7280;margin-top:4px;">CAD · ${escapeHtml(t.beforeTax)}</div>
    </div>`
    : "";

  const financingBlock = financing
    ? `
    <div style="background:#f6f7f9;border-radius:10px;padding:16px 18px;margin:18px 0;font-size:14px;color:#374151;line-height:1.6;">
      ${escapeHtml(financing.note)}
      ${
        financing.url
          ? `<div style="margin-top:12px;"><a href="${safeUrl(financing.url)}" style="display:inline-block;background:${accent};color:${accentInk};text-decoration:none;font-weight:700;padding:11px 20px;border-radius:8px;font-size:14px;">${escapeHtml(financingCtaLabel(language))}</a></div>`
          : ""
      }
    </div>`
    : "";

  const referenceBlock = reference
    ? `<p style="font-size:13px;color:#6b7280;margin:18px 0 0;">${escapeHtml(t.reference)}: <strong style="color:#111827;">${escapeHtml(reference)}</strong></p>`
    : "";

  const contactLine = [company.phone, company.email]
    .filter(Boolean)
    .map((x) => escapeHtml(x))
    .join("  ·  ");

  const html = `
<div style="margin:0;padding:24px 12px;background:#f6f7f9;font-family:${theme.font || "system-ui,-apple-system,Segoe UI,sans-serif"};">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #eceff3;">
    <div style="background:${accent};padding:22px 28px;">
      ${
        logo
          ? `<img src="${logo}" alt="${escapeHtml(companyName)}" style="max-height:40px;max-width:180px;display:block;">`
          : `<div style="color:${accentInk};font-size:18px;font-weight:800;">${escapeHtml(companyName)}</div>`
      }
    </div>
    <div style="padding:28px;">
      <p style="margin:0 0 12px;font-size:15px;color:#111827;">${escapeHtml(t.greeting(firstName(contact.name)))}</p>
      <p style="margin:0 0 6px;font-size:15px;line-height:1.6;color:#374151;">${escapeHtml(pub.show ? t.thanksRange(companyName) : t.thanksGated(companyName))}</p>

      ${rangeBlock}

      <p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:#6b7280;">${escapeHtml(t.disclaimer(companyName))}</p>

      ${financingBlock}
      ${referenceBlock}

      <p style="margin:22px 0 0;font-size:14px;color:#111827;">${escapeHtml(t.next)}</p>
      ${contactLine ? `<p style="margin:16px 0 0;padding-top:16px;border-top:1px solid #eceff3;font-size:13px;color:#6b7280;">${contactLine}</p>` : ""}
    </div>
  </div>
</div>`.trim();

  return { subject: t.subject(companyName), html };
}

/** "Sam Rivera" → "Sam". Empty stays empty. */
function firstName(name) {
  const n = String(name || "").trim();
  return n ? n.split(/\s+/)[0] : "";
}
