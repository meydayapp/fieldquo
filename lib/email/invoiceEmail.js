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

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const money = (n) =>
  Number(n ?? 0).toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
  });

function methodsSentence(company) {
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
  return `Accepted: ${pretty}.`;
}

export function buildInvoiceEmail({
  invoice,
  client,
  company,
  url,
  canTakeCard,
}) {
  const t = documentTheme(company);
  const fill = fillPair(t);

  const clientName = String(client?.name || "").split(" ")[0] || "there";

  const total = Number(invoice.total ?? 0);
  const paid = Number(invoice.amountPaid ?? 0);
  // amountDue is maintained by the payments route, but fall back to the
  // arithmetic rather than trusting a column that may lag behind a payment
  // recorded seconds ago.
  const balance = Number(invoice.amountDue ?? Math.max(0, total - paid));

  const due = invoice.dueDate
    ? new Date(invoice.dueDate).toLocaleDateString("en-CA", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  const overdue = invoice.dueDate && new Date(invoice.dueDate) < new Date();

  const subject = `Invoice ${invoice.invoiceNumber} from ${company.name} — ${money(balance)} due`;
  const cta = canTakeCard ? "Pay online" : "View your invoice";
  const methods = methodsSentence(company);

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

        <p style="font-size:15px;line-height:1.6;margin:0 0 14px;">Hi ${escapeHtml(clientName)},</p>
        <p style="font-size:15px;line-height:1.6;margin:0 0 20px;color:${t.inkMuted};">
          ${
            paid > 0
              ? `Here's the balance on invoice ${escapeHtml(invoice.invoiceNumber)}, after the ${money(paid)} already received. Thank you for that.`
              : `Here's invoice ${escapeHtml(invoice.invoiceNumber)} for the work completed.`
          }
        </p>

        <div style="background:${t.accentWash};border-radius:8px;padding:14px 16px;margin-bottom:20px;">
          <div style="font-size:11px;font-weight:700;letter-spacing:1px;color:${t.inkFaint};">
            ${paid > 0 ? "BALANCE DUE" : "AMOUNT DUE"}
          </div>
          <div style="font-size:26px;font-weight:800;color:${t.accentText};margin-top:2px;">
            ${money(balance)}
          </div>
          ${
            due
              ? `<div style="font-size:12px;color:${overdue ? t.negative : t.inkMuted};margin-top:4px;">
                   ${overdue ? "Was due" : "Due"} ${due}
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
          methods
            ? `<p style="font-size:12px;color:${t.inkMuted};margin:14px 0 0;text-align:center;">${escapeHtml(methods)}</p>`
            : ""
        }

        <p style="font-size:12px;line-height:1.6;color:${t.inkFaint};margin:12px 0 0;text-align:center;">
          Or paste this into your browser:<br />
          <span style="word-break:break-all;">${escapeHtml(url)}</span>
        </p>
      </div>

      <div style="padding:16px 24px;background:#faf8f4;border-top:1px solid #efedE8;font-size:12px;color:${t.inkMuted};">
        Questions about this invoice? Reply to this email${company.phone ? ` or call ${escapeHtml(company.phone)}` : ""}.
        <br /><strong style="color:${t.ink};">${escapeHtml(company.name)}</strong>
      </div>
    </div>
  </div>
</body></html>`;

  const text = [
    `Hi ${clientName},`,
    "",
    paid > 0
      ? `Here's the balance on invoice ${invoice.invoiceNumber}, after the ${money(paid)} already received.`
      : `Here's invoice ${invoice.invoiceNumber} for the work completed.`,
    "",
    `${paid > 0 ? "Balance due" : "Amount due"}: ${money(balance)}`,
    due ? `${overdue ? "Was due" : "Due"} ${due}` : "",
    "",
    `${cta}: ${url}`,
    methods,
    "",
    `Questions? Reply to this email${company.phone ? ` or call ${company.phone}` : ""}.`,
    company.name,
  ]
    .filter((l) => l !== "")
    .join("\n");

  return { subject, html, text };
}
