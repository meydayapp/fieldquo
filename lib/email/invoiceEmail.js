// lib/email/invoiceEmail.js
//
// The email a client receives when an invoice is sent.
//
// Sibling of quoteEmail.js and deliberately similar, because a client who gets
// a quote and then an invoice from the same company should recognise the
// second as coming from the first. Same brand-derived palette, same shape,
// different job: a quote asks for a decision, an invoice asks for money.
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
import { documentFormatters } from "@/lib/i18n/documentLabels";

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

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
 * @param kind      "invoice" | "reminder". Same document, different framing:
 *                  a chaser that opens like a fresh invoice reads as a company
 *                  that has lost track of what it billed.
 * @param note      optional line the company typed for this specific chase.
 *                  Escaped here, not by the caller.
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
}) {
  const t = documentTheme(company);
  const fill = fillPair(t);
  const c = emailCopy(language);
  const { money, date } = documentFormatters(language);

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

  const due = invoice.dueDate ? date(invoice.dueDate) : null;
  const overdue = invoice.dueDate && new Date(invoice.dueDate) < new Date();

  const isReminder = kind === "reminder";

  const subject = isReminder
    ? c.reminderSubject(money(balance), invoice.invoiceNumber)
    : c.invoiceSubject(company.name, invoice.invoiceNumber, money(balance));

  const intro = isReminder
    ? c.reminderIntro(invoice.invoiceNumber, money(balance))
    : paid > 0
      ? c.invoiceIntroPartial(invoice.invoiceNumber, money(paid))
      : c.invoiceIntro(invoice.invoiceNumber);
  const cta = canTakeCard ? c.payCta : c.viewInvoiceCta;
  const methods = methodsSentence(company, c);

  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:${t.page};">
  <div style="max-width:560px;margin:0 auto;padding:28px 20px;font-family:Helvetica,Arial,sans-serif;color:${t.ink};">
    <div style="background:#ffffff;border:1px solid #e4e2dd;border-radius:12px;overflow:hidden;">
      <div style="height:5px;background:${fill.bg};"></div>

      <div style="padding:24px;">
        ${
          company.logoUrl
            ? `<img src="${company.logoUrl}" alt="${escapeHtml(company.name)}" style="max-height:38px;display:block;margin-bottom:16px;" />`
            : `<div style="font-size:17px;font-weight:700;color:${t.accentText};margin-bottom:16px;">${escapeHtml(company.name)}</div>`
        }

        <p style="font-size:15px;line-height:1.6;margin:0 0 14px;">${escapeHtml(c.greeting(clientName))}</p>
        <p style="font-size:15px;line-height:1.6;margin:0 0 20px;color:${t.inkMuted};">
          ${escapeHtml(intro)}
        </p>
        ${
          note
            ? `<p style="font-size:15px;line-height:1.6;margin:0 0 20px;color:${t.ink};">${escapeHtml(note)}</p>`
            : ""
        }

        <div style="background:${t.accentWash};border-radius:8px;padding:14px 16px;margin-bottom:20px;">
          <div style="font-size:11px;font-weight:700;letter-spacing:1px;color:${t.inkFaint};">
            ${escapeHtml((paid > 0 ? c.balanceDue : c.amountDue).toUpperCase())}
          </div>
          <div style="font-size:26px;font-weight:800;color:${t.accentText};margin-top:2px;">
            ${money(balance)}
          </div>
          ${
            due
              ? `<div style="font-size:12px;color:${overdue ? t.negative : t.inkMuted};margin-top:4px;">
                   ${escapeHtml(overdue ? c.wasDue(due) : c.due(due))}
                 </div>`
              : ""
          }
        </div>

        <a href="${url}"
           style="display:block;text-align:center;background:${fill.bg};color:${fill.fg};
                  text-decoration:none;font-size:15px;font-weight:700;
                  padding:14px 20px;border-radius:999px;">
          ${cta}
        </a>

        ${
          !canTakeCard
            ? `<p style="font-size:13px;color:${t.inkMuted};margin:14px 0 0;text-align:center;">${escapeHtml(c.arrangePayment)}</p>`
            : ""
        }
        ${
          methods
            ? `<p style="font-size:12px;color:${t.inkMuted};margin:14px 0 0;text-align:center;">${escapeHtml(methods)}</p>`
            : ""
        }

        <p style="font-size:12px;line-height:1.6;color:${t.inkFaint};margin:12px 0 0;text-align:center;">
          ${escapeHtml(c.orPaste)}<br />
          <span style="word-break:break-all;">${escapeHtml(url)}</span>
        </p>
      </div>

      <div style="padding:16px 24px;background:#faf8f4;border-top:1px solid #efedE8;font-size:12px;color:${t.inkMuted};">
        ${escapeHtml(c.questions(company.phone))}
        <br /><strong style="color:${t.ink};">${escapeHtml(company.name)}</strong>
      </div>
    </div>
  </div>
</body></html>`;

  const text = [
    c.greeting(clientName),
    "",
    intro,
    note || "",
    "",
    `${paid > 0 ? c.balanceDue : c.amountDue}: ${money(balance)}`,
    due ? (overdue ? c.wasDue(due) : c.due(due)) : "",
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
