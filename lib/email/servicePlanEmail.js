// lib/email/servicePlanEmail.js
//
// The one email a service plan sends that isn't an invoice: the request for a
// client to authorise automatic payments.
//
// Renders through the same shell as the quote and invoice emails
// (documentEmailLayout.js), so a homeowner who has already had a quote from
// this contractor recognises this as coming from the same company — same brand
// band, same measured palette, same footer. Nothing here says "FieldQuo".
//
// ── The terms are IN the email, not only behind the link ────────────────────
//
// A message that says "click here to set up automatic payments" and nothing
// else is asking somebody to agree to an unstated commitment. Every bullet from
// lib/servicePlans/consent.js is printed here as well as on the page, so the
// amount, the cadence, the length and the cancellation policy are all visible
// before the client clicks anything.
//
// English and French only, and that is enforced upstream rather than defended
// here: the plan cannot be sold on the automatic tier in another language (see
// AUTHORISATION_LANGUAGES). This module would otherwise be the place a
// machine-drafted payment authorisation crept in.

import { documentTheme, fillPair } from "@/lib/documents/theme";
import {
  documentEmailHtml,
  emailButton,
  escapeHtml,
  EMAIL_FONT,
} from "@/lib/email/documentEmailLayout";

const COPY = {
  en: {
    label: "PAYMENT SETUP",
    subject: (company, plan) => `${company}: set up payments for ${plan}`,
    greeting: (name) => (name ? `Hi ${name},` : "Hello,"),
    cta: "Review and authorise",
    orPaste: "Or paste this into your browser:",
    reassure:
      "Nothing is charged when you open this link. You'll see the amount and the schedule again, and you can close the page without agreeing.",
    questions: (phone) =>
      phone ? `Questions? Reply to this email or call ${phone}.` : "Questions? Reply to this email.",
  },
  fr: {
    label: "MISE EN PLACE DU PAIEMENT",
    subject: (company, plan) => `${company} : configurer les paiements pour ${plan}`,
    greeting: (name) => (name ? `Bonjour ${name},` : "Bonjour,"),
    cta: "Consulter et autoriser",
    orPaste: "Ou copiez ce lien dans votre navigateur :",
    reassure:
      "Aucun montant n’est prélevé lorsque vous ouvrez ce lien. Le montant et le calendrier vous seront présentés de nouveau, et vous pouvez fermer la page sans rien accepter.",
    questions: (phone) =>
      phone
        ? `Des questions ? Répondez à ce courriel ou appelez le ${phone}.`
        : "Des questions ? Répondez à ce courriel.",
  },
};

/**
 * @param terms  the object from buildAuthorisationTerms — the SAME wording the
 *               client will tick, so the email cannot describe a different deal
 *               from the page.
 */
export function buildAuthorisationRequestEmail({ plan, client, company, terms, url }) {
  const c = COPY[terms.language] || COPY.en;
  const t = documentTheme(company);
  const fill = fillPair(t);
  const firstName = String(client?.name || "").split(" ")[0] || "";

  const bullets = terms.bullets
    .map(
      (line) =>
        `<li style="font-family:${EMAIL_FONT};font-size:14px;line-height:1.6;color:${t.ink};margin:0 0 8px;">${escapeHtml(line)}</li>`,
    )
    .join("");

  const body = `
        <p style="font-family:${EMAIL_FONT};font-size:15px;line-height:1.6;margin:0 0 14px;color:${t.ink};">${escapeHtml(c.greeting(firstName))}</p>
        <p style="font-family:${EMAIL_FONT};font-size:15px;line-height:1.6;margin:0 0 18px;color:${t.inkMuted};">${escapeHtml(terms.intro)}</p>
        <ul style="margin:0 0 18px;padding-left:20px;">${bullets}</ul>
        ${
          terms.cancelNote
            ? `<p style="font-family:${EMAIL_FONT};font-size:14px;line-height:1.6;margin:0 0 18px;color:${t.ink};font-weight:700;">${escapeHtml(terms.cancelNote)}</p>`
            : ""
        }
${emailButton({ url, label: escapeHtml(c.cta), fill })}
        <p style="font-family:${EMAIL_FONT};font-size:13px;line-height:1.6;color:${t.inkMuted};margin:14px 0 0;text-align:center;">${escapeHtml(c.reassure)}</p>
        <p style="font-family:${EMAIL_FONT};font-size:12px;line-height:1.6;color:${t.inkMuted};margin:12px 0 0;text-align:center;">
          ${escapeHtml(c.orPaste)}<br />
          <span style="word-break:break-all;">${escapeHtml(url)}</span>
        </p>`;

  return {
    subject: c.subject(company.name, plan.name),
    html: documentEmailHtml({
      company,
      theme: t,
      fill,
      label: c.label,
      reference: plan.name,
      body,
      footerNote: escapeHtml(c.questions(company.phone)),
    }),
    text: [
      c.greeting(firstName),
      "",
      terms.intro,
      "",
      ...terms.bullets.map((b) => `- ${b}`),
      terms.cancelNote,
      "",
      `${c.cta}: ${url}`,
      c.reassure,
      "",
      c.questions(company.phone),
      company.name,
    ]
      .filter((l) => l !== "")
      .join("\n"),
  };
}
