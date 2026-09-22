// lib/payments/offlineDiscount.js
//
// "Pay by e-transfer or cheque — 3% off": whether a company offers it, what
// it comes to, and the one sentence every surface prints for it.
//
// ── A discount, never a surcharge ───────────────────────────────────────────
//
// The money is the same either way — a 3% card fee not charged, or 3% off
// for not using a card — but the two framings are not equally legal. Quebec's
// Consumer Protection Act (s. 224(c) and the rules under it) bars a merchant
// from charging a consumer a higher price than the one advertised, which is
// exactly what "card payments carry a 3% + $0.30 fee" does at the till; a
// discount for another method is allowed everywhere. So this product offers
// the discount and never prints a card fee to a homeowner — the card fee is
// the contractor's, as an application fee on the Stripe charge
// (lib/stripe/processingFee.js), and stays off every client-facing document.
//
// ── Canada only ─────────────────────────────────────────────────────────────
//
// The wording names Interac and cheques. A US company has neither (Zelle and
// checks are the equivalents, and US card-surcharge law is state by state),
// so the offer is inert whatever Company.offlinePaymentDiscount says when
// the payment country is not CA: the settings switch does not render, the
// route writes false, and `offlineDiscountOffered` answers false. A US
// client therefore never sees the line — asserted by
// scripts/check-quote-text-blocks.mjs.
//
// ── Where the number is fixed ───────────────────────────────────────────────
//
// 3%, here, once. It mirrors the 3% card rate the contractor pays, which is
// the argument for it: the company gives away what the card would have cost
// them, no more. The rate is frozen onto each quote as Quote.offlineDiscountPct
// at draft time, so a change here re-prices no sent quote.
//
// Pure: no database, no React. The routes, the renderers and the check all
// read this file.

import { paymentCountry, enabledMethods } from "@/lib/payments/offlineMethods";

export const OFFLINE_PAYMENT_DISCOUNT_PCT = 3;

/** The methods the wording promises; one must be switched on for the offer to stand. */
const OFFER_METHODS = Object.freeze(["e_transfer", "cheque"]);

const round2 = (n) => Math.round(n * 100) / 100;

/** True when the switch may be SHOWN to this company at all. */
export function offlineDiscountAvailable(company) {
  return paymentCountry(company) === "CA";
}

/**
 * True when a quote written today would carry the offer: a Canadian
 * company, the switch on, and e-transfer or cheque actually accepted.
 */
export function offlineDiscountOffered(company) {
  if (!offlineDiscountAvailable(company)) return false;
  if (company?.offlinePaymentDiscount !== true) return false;
  const on = enabledMethods(company);
  return OFFER_METHODS.some((m) => on.includes(m));
}

/** The percentage to freeze onto a new draft, or null for "not offered". */
export function offlineDiscountPctFor(company) {
  return offlineDiscountOffered(company) ? OFFLINE_PAYMENT_DISCOUNT_PCT : null;
}

/**
 * What the discount comes to on a taxable base — the subtotal AFTER any
 * flat discount, since the client saves 3% of what they would otherwise
 * pay. Taken BEFORE tax: the mockup's Quebec example (1,167.31 − 35.02,
 * GST/QST on 1,132.29) is the arithmetic, and tax on money the client never
 * paid is the bug lib/quotes/totals.js exists to prevent.
 */
export function offlineDiscountAmount(base, pct) {
  const p = Number(pct);
  const b = Number(base);
  if (!Number.isFinite(p) || p <= 0 || !Number.isFinite(b) || b <= 0) return 0;
  return round2((b * p) / 100);
}

/** Format "3" or "2.5" without a trailing ".0". */
function pctText(pct) {
  const p = Number(pct);
  return Number.isInteger(p) ? String(p) : String(round2(p));
}

// One sentence per document language — the eight OFFLINE_METHOD_LANGUAGES.
// `offer` is the option line a client picks; `applied` is the discount row
// once they have; `invoiceNote` sits in "How to pay" on an invoice priced
// with it, in place of the card link.
const COPY = {
  en: {
    offer: (p) => `Pay by e-transfer or cheque — ${p}% off`,
    applied: (p) => `E-transfer / cheque discount (${p}%)`,
    invoiceNote: () => "This invoice includes the discount for paying by e-transfer or cheque. Please pay by one of the methods below.",
  },
  fr: {
    offer: (p) => `Payez par virement Interac ou par chèque — ${p} % de rabais`,
    applied: (p) => `Rabais virement / chèque (${p} %)`,
    invoiceNote: () => "Cette facture inclut le rabais pour paiement par virement Interac ou par chèque. Veuillez payer par l'un des modes ci-dessous.",
  },
  es: {
    offer: (p) => `Pague por transferencia electrónica o cheque — ${p}% de descuento`,
    applied: (p) => `Descuento por transferencia / cheque (${p}%)`,
    invoiceNote: () => "Esta factura incluye el descuento por pagar con transferencia electrónica o cheque. Pague con uno de los métodos indicados abajo.",
  },
  uk: {
    offer: (p) => `Оплата e-Transfer або чеком — знижка ${p}%`,
    applied: (p) => `Знижка за e-Transfer / чек (${p}%)`,
    invoiceNote: () => "Цей рахунок уже містить знижку за оплату e-Transfer або чеком. Будь ласка, оплатіть одним із наведених нижче способів.",
  },
  pa: {
    offer: (p) => `ਈ-ਟ੍ਰਾਂਸਫਰ ਜਾਂ ਚੈੱਕ ਨਾਲ ਭੁਗਤਾਨ ਕਰੋ — ${p}% ਛੋਟ`,
    applied: (p) => `ਈ-ਟ੍ਰਾਂਸਫਰ / ਚੈੱਕ ਛੋਟ (${p}%)`,
    invoiceNote: () => "ਇਸ ਇਨਵੌਇਸ ਵਿੱਚ ਈ-ਟ੍ਰਾਂਸਫਰ ਜਾਂ ਚੈੱਕ ਨਾਲ ਭੁਗਤਾਨ ਲਈ ਛੋਟ ਸ਼ਾਮਲ ਹੈ। ਕਿਰਪਾ ਕਰਕੇ ਹੇਠਾਂ ਦਿੱਤੇ ਤਰੀਕਿਆਂ ਵਿੱਚੋਂ ਇੱਕ ਨਾਲ ਭੁਗਤਾਨ ਕਰੋ।",
  },
  tl: {
    offer: (p) => `Magbayad sa e-transfer o tseke — ${p}% diskwento`,
    applied: (p) => `Diskwento sa e-transfer / tseke (${p}%)`,
    invoiceNote: () => "Kasama na sa invoice na ito ang diskwento para sa pagbabayad sa e-transfer o tseke. Magbayad sa isa sa mga paraan sa ibaba.",
  },
  de: {
    offer: (p) => `Zahlung per E-Transfer oder Scheck — ${p} % Rabatt`,
    applied: (p) => `Rabatt E-Transfer / Scheck (${p} %)`,
    invoiceNote: () => "Diese Rechnung enthält den Rabatt für die Zahlung per E-Transfer oder Scheck. Bitte zahlen Sie mit einer der unten genannten Methoden.",
  },
  it: {
    offer: (p) => `Paga con e-transfer o assegno — ${p}% di sconto`,
    applied: (p) => `Sconto e-transfer / assegno (${p}%)`,
    invoiceNote: () => "Questa fattura include lo sconto per il pagamento con e-transfer o assegno. Si prega di pagare con uno dei metodi indicati sotto.",
  },
};

export const OFFLINE_DISCOUNT_LANGUAGES = Object.freeze(Object.keys(COPY));

function copyFor(language) {
  return COPY[language] || COPY.en;
}

/** The option line the client picks. */
export function offlineDiscountOfferLabel(pct, language = "en") {
  return copyFor(language).offer(pctText(pct));
}

/** The discount row once chosen. */
export function offlineDiscountAppliedLabel(pct, language = "en") {
  return copyFor(language).applied(pctText(pct));
}

/**
 * The "How to pay" sentence on an invoice priced with the discount. No
 * percentage in it on purpose: the invoice stores the AMOUNT it folded into
 * its discount (Invoice.offlineDiscountAmount), and a sentence quoting a
 * rate would have to be right about a rate the invoice does not carry.
 */
export function offlineDiscountInvoiceNote(language = "en") {
  return copyFor(language).invoiceNote();
}

/**
 * What the document says about the offer, for a quote row: null when the
 * quote carries no offer, else { pct, amount, label, chosen }.
 *
 * `base` is subtotal − discount — the figure the discount applies to. On an
 * approved quote the amount comes from what was recorded, not recomputed;
 * before that it is the illustration the client is deciding on.
 */
export function offlineDiscountLine(quote, { language = "en", base = null } = {}) {
  const pct = Number(quote?.offlineDiscountPct);
  if (!Number.isFinite(pct) || pct <= 0) return null;
  const chosen = quote?.offlineDiscountChosen === true;
  const b = base ?? Math.max(0, Number(quote?.subtotal || 0) - Number(quote?.discount || 0));
  return {
    pct,
    amount: offlineDiscountAmount(b, pct),
    chosen,
    label: chosen ? offlineDiscountAppliedLabel(pct, language) : offlineDiscountOfferLabel(pct, language),
  };
}
