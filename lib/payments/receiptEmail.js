// lib/payments/receiptEmail.js
//
// The receipt a client gets for ONE payment — the email itself, and the
// figures it states. Pure: no database, no sender. lib/payments/sendReceipt.js
// loads the rows, decides whether to send, and records what went.
//
// ── Why one email per payment ───────────────────────────────────────────────
//
// The owner, 2026-10-12, about INV-2026-0022: two e-transfers, $2,500 and
// $3,000, and "each separate payment made … should have their own email". A
// receipt is evidence of one handover of money. Two payments folded into one
// letter cannot be filed against two bank transactions, and a receipt for the
// second payment that also restates the first reads like being charged twice.
//
// ── The figures are AS OF this payment ──────────────────────────────────────
//
// "Total paid so far" and "Balance remaining" are the ledger at the moment
// this payment entered it — every payment recorded before it plus itself, run
// through lib/invoices/computeInvoiceState.js, the one function the invoice
// page, the portal and the payment routes compute a balance with. So the
// receipt for Maureen's first $2,500 says paid $2,500 / balance $6,427 even
// when it is sent after her second payment has landed; the second says
// $5,500 / $3,427. Sending "today's" figures on a resend of an old receipt
// would make two different receipts state the same totals, and the earlier
// one would then be wrong about its own moment.
//
// Ordered by createdAt — when the money entered the ledger — not by the
// `date` typed on a payment: a payment back-dated to last week but recorded
// after today's is still the later receipt, and its "paid so far" must include
// what had already been recorded. A refund, or a Stripe refund / lost dispute
// on an earlier payment, counts only if it had happened by then.
//
// The invoice TOTAL is the family's current document's (lib/invoices/
// family.js): that is what the client owes, and what every balance in the
// product is measured against.
//
// ── White-label ─────────────────────────────────────────────────────────────
//
// documentEmailHtml (lib/email/documentEmailLayout.js) is the shell the quote
// and invoice emails use: the company's logo or name in its brand band, its
// contact line in the footer, no FieldQuo anywhere. Every colour comes from
// documentTheme() (lib/documents/theme.js), which measures rather than
// assumes: ink and inkMuted on the white card, the band text via fillPair, the
// figure via amountBlock. The one colour chosen here — the "paid in full" green
// — is passed through ensureContrast against the paper it sits on.

import { documentTheme, fillPair } from "@/lib/documents/theme";
import { ensureContrast } from "@/lib/brand/colour";
import { emailCopy } from "@/lib/i18n/emailCopy";
import { receiptCopy } from "@/lib/i18n/receiptEmailCopy";
import { documentFormatters } from "@/lib/i18n/documentLabels";
import { computeInvoiceState } from "@/lib/invoices/computeInvoiceState";
import { OFFLINE_METHOD_KEYS, offlineMethodLabel } from "@/lib/payments/offlineMethods";
import {
  documentEmailHtml,
  amountBlock,
  emailButton,
  escapeHtml,
  EMAIL_FONT,
} from "@/lib/email/documentEmailLayout";

/** A refund row, or anything that did not bring money in. Never receipted. */
export function isRefundRow(payment) {
  return payment?.kind === "refund" || Boolean(payment?.refundOfPaymentId) || !(Number(payment?.amount) > 0);
}

const at = (v) => (v ? new Date(v).getTime() : NaN);

/**
 * The ledger as of `payment`: total, paid so far, balance, paid in full.
 *
 * @param payment   the Payment being receipted
 * @param payments  every Payment row in the invoice's family (familyPayments)
 * @param total     the family's current invoice total
 */
export function receiptFigures({ payment, payments = [], total }) {
  const cut = at(payment.createdAt);
  const before = (row) => {
    if (row.id === payment.id) return true;
    const t = at(row.createdAt);
    if (!Number.isFinite(t) || !Number.isFinite(cut)) return false;
    return t < cut || (t === cut && String(row.id) < String(payment.id));
  };
  const happenedBy = (when) => Number.isFinite(at(when)) && at(when) <= cut;

  const rows = payments
    .filter(before)
    .map((row) =>
      row.kind === "refund"
        ? row
        : {
            ...row,
            // Money Stripe took back later is not part of this moment.
            refundedAmount: happenedBy(row.refundedAt) ? row.refundedAmount : 0,
            disputeStatus: row.disputeStatus === "lost" && !happenedBy(row.disputedAt) ? null : row.disputeStatus,
          },
    );
  // The payment itself is always in, even if the caller's list was read a
  // moment before it was written.
  if (!rows.some((r) => r.id === payment.id)) rows.push({ ...payment, refundedAmount: 0, disputeStatus: null });

  const state = computeInvoiceState({ total, payments: rows, priorStatus: "sent" });
  return {
    amount: Number(payment.amount) || 0,
    total: Number(total) || 0,
    paidSoFar: state.amountPaid,
    balance: state.amountDue,
    paidInFull: state.isPaid,
  };
}

// Stripe's payment-method key (Payment.feeRateLabel) → this table's name.
const STRIPE_METHOD = {
  card: "card",
  acss_debit: "bankDebit",
  us_bank_account: "bankDebit",
  affirm: "affirm",
  klarna: "klarna",
  afterpay_clearpay: "afterpay",
};

/** What the client is told the payment was made with, in their language. */
export function receiptMethodLabel(payment, language = "en") {
  const r = receiptCopy(language);
  const method = payment?.method;
  if (method && OFFLINE_METHOD_KEYS.includes(method)) return offlineMethodLabel(method, language);
  if (method === "stripe") return r.methods[STRIPE_METHOD[payment?.feeRateLabel] || "online"];
  // A card on somebody else's terminal is, to the client, a card.
  if (method === "card_elsewhere") return r.methods.card;
  if (method === "visit_credit") return r.methods.visitCredit;
  if (method === "shop") return r.methods.shop;
  return r.methods.other;
}

/**
 * Build the receipt.
 *
 * @param payment   the Payment row
 * @param figures   receiptFigures() for it
 * @param invoice   the family's current invoice ({ invoiceNumber })
 * @param client    { name }
 * @param company   theme, contact and currency fields (see sendReceipt.js)
 * @param url       the client's portal page for this invoice
 * @param language  resolveReceiptLanguage()
 * @returns {{ subject, html, text }}
 */
export function buildReceiptEmail({ payment, figures, invoice, client, company = {}, url, language = "en" }) {
  const t = documentTheme(company);
  const fill = fillPair(t);
  const c = emailCopy(language);
  const r = receiptCopy(language);
  const { money, date } = documentFormatters(language, company?.currency);

  const firstName = String(client?.name || "").trim().split(/\s+/)[0] || "";
  const number = invoice?.invoiceNumber || "";
  const amount = money(figures.amount);
  const method = receiptMethodLabel(payment, language);
  const received = date(payment.date || payment.createdAt);

  const subject = r.subject(company.name || "", amount, number);
  const greeting = firstName ? c.greeting(firstName) : r.greetingNoName;
  const intro = r.intro(amount, number);
  const closing = c.questions(company.phone);

  const rows = [
    [r.method, method],
    [r.date, received],
    [r.invoice, number],
    [r.invoiceTotal, money(figures.total)],
    [r.paidSoFar, money(figures.paidSoFar)],
    ...(figures.paidInFull ? [] : [[r.balance, money(figures.balance)]]),
  ];
  // Measured, not assumed: the green is the theme's own `positive`, held to
  // 4.5:1 against the white card it is printed on.
  const positive = ensureContrast(t.positive, "#ffffff", 4.5);

  const detailHtml = `
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;margin:0 0 22px;">
${rows
  .map(
    ([label, value], i) => `          <tr>
            <td style="font-family:${EMAIL_FONT};font-size:14px;line-height:1.5;color:${t.inkMuted};padding:7px 0;${i ? `border-top:1px solid ${t.borderSoft};` : ""}">${escapeHtml(label)}</td>
            <td align="right" style="font-family:${EMAIL_FONT};font-size:14px;line-height:1.5;color:${t.ink};font-weight:600;padding:7px 0;text-align:right;${i ? `border-top:1px solid ${t.borderSoft};` : ""}">${escapeHtml(value)}</td>
          </tr>`,
  )
  .join("\n")}
        </table>
        ${
          figures.paidInFull
            ? `<p data-paid-in-full style="font-family:${EMAIL_FONT};font-size:15px;font-weight:700;line-height:1.5;color:${positive};margin:0 0 22px;">${escapeHtml(r.paidInFull)}</p>`
            : ""
        }`;

  const body = `
        <p style="font-family:${EMAIL_FONT};font-size:15px;line-height:1.6;margin:0 0 14px;color:${t.ink};">${escapeHtml(greeting)}</p>
        <p style="font-family:${EMAIL_FONT};font-size:15px;line-height:1.6;margin:0 0 20px;color:${t.inkMuted};">${escapeHtml(intro)}</p>
${amountBlock({ theme: t, label: escapeHtml(r.figureLabel.toUpperCase()), amount, sub: escapeHtml(`${method} · ${received}`) })}
${detailHtml}
${emailButton({ url, label: escapeHtml(r.cta), fill })}
        <p style="font-family:${EMAIL_FONT};font-size:12px;line-height:1.6;color:${t.inkMuted};margin:12px 0 0;text-align:center;">
          ${escapeHtml(c.orPaste)}<br />
          <span style="word-break:break-all;">${escapeHtml(url)}</span>
        </p>`;

  const html = documentEmailHtml({
    company,
    theme: t,
    fill,
    label: r.label,
    reference: number,
    body,
    footerNote: escapeHtml(closing),
  });

  const text = [
    greeting,
    "",
    intro,
    "",
    `${r.figureLabel}: ${amount}`,
    ...rows.map(([label, value]) => `${label}: ${value}`),
    figures.paidInFull ? r.paidInFull : "",
    "",
    `${r.cta}: ${url}`,
    "",
    closing,
    company.name || "",
  ]
    .filter((line, i, all) => line !== "" || (all[i - 1] !== "" && i > 0))
    .join("\n")
    .trim();

  return { subject, html, text };
}
