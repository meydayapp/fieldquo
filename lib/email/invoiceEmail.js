// lib/email/invoiceEmail.js
//
// The email a client receives when an invoice is sent.
//
// Sibling of quoteEmail.js and deliberately similar, because a client who gets
// a quote and then an invoice from the same company should recognise the
// second as coming from the first. That similarity used to be maintained by
// copying; both now render through the same shell in documentEmailLayout.js,
// so they can't drift apart. Same brand-derived palette, same shape, different
// job: a quote asks for a decision, an invoice asks for money.
//
// ── What differs from the quote email ───────────────────────────────────────
//
//   * Leads with the BALANCE, not the total. On an invoice with a deposit
//     already paid, the total is a number the client has partly settled and
//     showing it as the headline reads like being billed twice.
//   * States the due date, because that's the entire point of the document.
//   * The button only says "Pay" when the company can actually take a card.
//     Otherwise it says "View invoice" and the payment methods are spelled
//     out in text — a Pay button that leads to a dead end is worse than no
//     button.

import { documentTheme, fillPair } from "@/lib/documents/theme";
import { emailCopy } from "@/lib/i18n/emailCopy";
import { documentFormatters, documentLabels } from "@/lib/i18n/documentLabels";
import {
  documentEmailHtml,
  amountBlock,
  emailButton,
  escapeHtml,
  EMAIL_FONT,
} from "@/lib/email/documentEmailLayout";

function methodsSentence(company, c) {
  const methods = Array.isArray(company.paymentMethods)
    ? company.paymentMethods
    : [];
  if (!methods.length) return "";
  const pretty = methods
    .map((m) =>
      String(m)
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase()),
    )
    .join(", ");
  return c.accepted(pretty);
}

/**
 * @param language  the CLIENT's language — see buildQuoteEmail. A client who
 *                  received a French quote must not then receive an English
 *                  invoice for the same job.
 * @param kind      "invoice" | "reminder" | "paid". Same document, different
 *                  framing: a chaser that opens like a fresh invoice reads as a
 *                  company that has lost track of what it billed, and a receipt
 *                  for money already taken under a standing authorisation must
 *                  not open by asking for it. "paid" is what a service plan's
 *                  automatic charge sends — see lib/servicePlans/run.js — so the
 *                  client still gets a document from the CONTRACTOR rather than
 *                  only a Stripe receipt from a company they have never heard of.
 * @param note      optional line the company typed for this specific chase.
 *                  Escaped here, not by the caller.
 * @param requestAmount  when set, the figure this email HEADLINES and asks
 *                  for — a payment-schedule stage's own share, from
 *                  lib/paymentSchedule/run.js — instead of the invoice's
 *                  full remaining balance. The `url` the caller passes must
 *                  already be a checkout link capped to this same figure
 *                  (createInvoiceCheckoutSession's amountCents) — this
 *                  parameter only changes what the email SAYS; it charges
 *                  nothing itself. Omitted (the default) keeps every
 *                  existing caller's behaviour: the full balance, unchanged.
 */
export function buildInvoiceEmail({
  invoice,
  client,
  company,
  url,
  canTakeCard,
  language = "en",
  kind = "invoice",
  note = "",
  requestAmount = null,
}) {
  const t = documentTheme(company);
  const fill = fillPair(t);
  const c = emailCopy(language);
  // The document word for the brand band, from the catalogue the PDF uses.
  const labels = documentLabels(language);
  // The company's billing currency, not a CAD default — see quoteEmail.js.
  const { money, date } = documentFormatters(language, company?.currency);

  const clientName = String(client?.name || "").split(" ")[0] || "";

  const total = Number(invoice.total ?? 0);
  const paid = Number(invoice.amountPaid ?? 0);
  // The balance is ALWAYS total − paid, computed here. Do NOT read amountDue:
  // a freshly created/converted invoice has amountDue = 0 by column default
  // (it's only populated once a payment is recorded), so `?? ` never fired and
  // every unpaid invoice email showed "0.00 due". amountPaid is the one
  // authoritative figure, so this is correct in every state (unpaid, partial,
  // paid) and can't lag a column.
  const balance = Math.max(0, total - paid);
  // A stage's own share, when one was passed — capped at the real balance
  // for the same reason lib/stripe.js's checkout session is: recomputing
  // against a stale figure must never ask for more than is actually owed.
  const requested =
    requestAmount != null ? Math.max(0, Math.min(Number(requestAmount) || 0, balance)) : balance;

  const due = invoice.dueDate ? date(invoice.dueDate) : null;
  const overdue = invoice.dueDate && new Date(invoice.dueDate) < new Date();

  const isReminder = kind === "reminder";
  // A receipt, not a request. Guarded on the balance as well as the caller's
  // intent: if something went wrong and money is still owed, this must fall back
  // to asking for it rather than telling the client they are square.
  const isPaid = kind === "paid" && balance <= 0.005;

  const subject = isPaid
    ? c.paidSubject(company.name, invoice.invoiceNumber, money(paid))
    : isReminder
      ? c.reminderSubject(money(requested), invoice.invoiceNumber)
      : c.invoiceSubject(company.name, invoice.invoiceNumber, money(requested));

  const intro = isPaid
    ? c.paidIntro(invoice.invoiceNumber, money(paid))
    : isReminder
      ? c.reminderIntro(invoice.invoiceNumber, money(requested))
      : paid > 0
        ? c.invoiceIntroPartial(invoice.invoiceNumber, money(paid))
        : c.invoiceIntro(invoice.invoiceNumber);
  // Nothing to pay — so the button views the document rather than offering a
  // Pay link that would mint a checkout session for a zero balance and error.
  const cta = isPaid ? c.viewReceiptCta : canTakeCard ? c.payCta : c.viewInvoiceCta;
  // "Accepted: card, e-transfer" belongs on a bill, not on a receipt for money
  // that has already been taken by a method the client chose.
  const methods = kind === "paid" ? "" : methodsSentence(company, c);

  // See the same const in quoteEmail.js: inkFaint targets 3:1 and measures
  // 3.27:1 on white, which is under the bar for the 12px line carrying the URL
  // that has to work when the button didn't.
  const fallbackInk = t.inkMuted;

  const body = `
        <p style="font-family:${EMAIL_FONT};font-size:15px;line-height:1.6;margin:0 0 14px;color:${t.ink};">${escapeHtml(c.greeting(clientName))}</p>
        <p style="font-family:${EMAIL_FONT};font-size:15px;line-height:1.6;margin:0 0 20px;color:${t.inkMuted};">
          ${escapeHtml(intro)}
        </p>
        ${
          note
            ? `<p style="font-family:${EMAIL_FONT};font-size:15px;line-height:1.6;margin:0 0 20px;color:${t.ink};">${escapeHtml(note)}</p>`
            : ""
        }
${amountBlock({
  theme: t,
  label: escapeHtml(
    (isPaid ? c.amountPaid : paid > 0 ? c.balanceDue : c.amountDue).toUpperCase(),
  ),
  amount: money(isPaid ? paid : requested),
  // "Was due 3 July" under a receipt reads as a late payment being pointed out.
  sub: isPaid ? "" : due ? escapeHtml(overdue ? c.wasDue(due) : c.due(due)) : "",
  // Overdue is the one line here allowed to shout. Passed as a request rather
  // than a final colour: amountBlock measures it against the wash, which is
  // where it actually lands.
  subColor: !isPaid && overdue ? t.negative : "",
})}
${emailButton({ url, label: cta, fill })}
        ${
          !canTakeCard && !isPaid
            ? `<p style="font-family:${EMAIL_FONT};font-size:13px;line-height:1.6;color:${t.inkMuted};margin:14px 0 0;text-align:center;">${escapeHtml(c.arrangePayment)}</p>`
            : ""
        }
        ${
          methods
            ? `<p style="font-family:${EMAIL_FONT};font-size:12px;line-height:1.6;color:${t.inkMuted};margin:14px 0 0;text-align:center;">${escapeHtml(methods)}</p>`
            : ""
        }

        <p style="font-family:${EMAIL_FONT};font-size:12px;line-height:1.6;color:${fallbackInk};margin:12px 0 0;text-align:center;">
          ${escapeHtml(c.orPaste)}<br />
          <span style="word-break:break-all;">${escapeHtml(url)}</span>
        </p>`;

  const html = documentEmailHtml({
    company,
    theme: t,
    fill,
    label: labels.invoice,
    reference: invoice.invoiceNumber,
    body,
    footerNote: escapeHtml(c.questions(company.phone)),
  });

  const text = [
    c.greeting(clientName),
    "",
    intro,
    note || "",
    "",
    isPaid
      ? `${c.amountPaid}: ${money(paid)}`
      : `${paid > 0 ? c.balanceDue : c.amountDue}: ${money(balance)}`,
    isPaid ? "" : due ? (overdue ? c.wasDue(due) : c.due(due)) : "",
    "",
    `${cta}: ${url}`,
    methods,
    "",
    c.questions(company.phone),
    company.name,
  ]
    .filter((l) => l !== "")
    .join("\n");

  return { subject, html, text };
}
