// lib/i18n/documentLabels.js
//
// The fixed furniture of a quote or invoice — "Subtotal", "Balance Due",
// "Prepared for" — in every language FieldQuo sends in.
//
// Separate from app/i18n/messages.js on purpose. That catalogue is the app's
// own UI, read by staff, and it can change freely. These strings appear on a
// document a client signs, so they're small, closed, and hand-written rather
// than model-drafted. There are twenty of them; getting "Balance Due" wrong in
// Punjabi on an invoice is not the place to save effort.
//
// The other half of a translated document is the company's own service names,
// which live on Product.translations and go through the review screen at
// Settings → Translations. These labels never need reviewing because nobody
// edits them.

const LABELS = {
  en: {
    quote: "Quote",
    invoice: "Invoice",
    preparedFor: "Prepared for",
    date: "Date",
    validUntil: "Valid until",
    dueDate: "Due date",
    description: "Description",
    qty: "Qty",
    amount: "Amount",
    subtotal: "Subtotal",
    discount: "Discount",
    tax: "Tax",
    total: "Total",
    amountPaid: "Amount paid",
    balanceDue: "Balance due",
    paymentHistory: "Payment history",
    paymentSummary: "Payment summary",
    notes: "Notes",
    kitchenPlan: "Kitchen plan",
    clientInfo: "Client",
    method: "Method",
    thankYou: "Thank you for your business",
  },
  fr: {
    quote: "Devis",
    invoice: "Facture",
    preparedFor: "Préparé pour",
    date: "Date",
    validUntil: "Valide jusqu'au",
    dueDate: "Date d'échéance",
    description: "Description",
    qty: "Qté",
    amount: "Montant",
    subtotal: "Sous-total",
    discount: "Rabais",
    tax: "Taxes",
    total: "Total",
    amountPaid: "Montant payé",
    balanceDue: "Solde dû",
    paymentHistory: "Historique des paiements",
    paymentSummary: "Résumé des paiements",
    notes: "Notes",
    kitchenPlan: "Plan de cuisine",
    clientInfo: "Client",
    method: "Mode de paiement",
    thankYou: "Merci de votre confiance",
  },
  es: {
    quote: "Presupuesto",
    invoice: "Factura",
    preparedFor: "Preparado para",
    date: "Fecha",
    validUntil: "Válido hasta",
    dueDate: "Fecha de vencimiento",
    description: "Descripción",
    qty: "Cant.",
    amount: "Importe",
    subtotal: "Subtotal",
    discount: "Descuento",
    tax: "Impuestos",
    total: "Total",
    amountPaid: "Importe pagado",
    balanceDue: "Saldo pendiente",
    paymentHistory: "Historial de pagos",
    paymentSummary: "Resumen de pagos",
    notes: "Notas",
    kitchenPlan: "Plano de cocina",
    clientInfo: "Cliente",
    method: "Método de pago",
    thankYou: "Gracias por su confianza",
  },
  uk: {
    quote: "Кошторис",
    invoice: "Рахунок",
    preparedFor: "Підготовлено для",
    date: "Дата",
    validUntil: "Дійсний до",
    dueDate: "Термін оплати",
    description: "Опис",
    qty: "К-сть",
    amount: "Сума",
    subtotal: "Проміжний підсумок",
    discount: "Знижка",
    tax: "Податок",
    total: "Разом",
    amountPaid: "Сплачено",
    balanceDue: "До сплати",
    paymentHistory: "Історія платежів",
    paymentSummary: "Підсумок платежів",
    notes: "Примітки",
    kitchenPlan: "План кухні",
    clientInfo: "Клієнт",
    method: "Спосіб оплати",
    thankYou: "Дякуємо за співпрацю",
  },
  pa: {
    quote: "ਹਵਾਲਾ",
    invoice: "ਬਿੱਲ",
    preparedFor: "ਲਈ ਤਿਆਰ ਕੀਤਾ",
    date: "ਮਿਤੀ",
    validUntil: "ਤੱਕ ਵੈਧ",
    dueDate: "ਭੁਗਤਾਨ ਦੀ ਮਿਤੀ",
    description: "ਵੇਰਵਾ",
    qty: "ਗਿਣਤੀ",
    amount: "ਰਕਮ",
    subtotal: "ਉਪ-ਜੋੜ",
    discount: "ਛੂਟ",
    tax: "ਟੈਕਸ",
    total: "ਕੁੱਲ",
    amountPaid: "ਅਦਾ ਕੀਤੀ ਰਕਮ",
    balanceDue: "ਬਕਾਇਆ ਰਕਮ",
    paymentHistory: "ਭੁਗਤਾਨ ਦਾ ਇਤਿਹਾਸ",
    paymentSummary: "ਭੁਗਤਾਨ ਸਾਰ",
    notes: "ਨੋਟਸ",
    kitchenPlan: "ਰਸੋਈ ਦੀ ਯੋਜਨਾ",
    clientInfo: "ਗਾਹਕ",
    method: "ਭੁਗਤਾਨ ਦਾ ਤਰੀਕਾ",
    thankYou: "ਤੁਹਾਡੇ ਕਾਰੋਬਾਰ ਲਈ ਧੰਨਵਾਦ",
  },
  tl: {
    quote: "Quote",
    invoice: "Invoice",
    preparedFor: "Inihanda para kay",
    date: "Petsa",
    validUntil: "Balido hanggang",
    dueDate: "Takdang petsa ng bayad",
    description: "Deskripsyon",
    qty: "Dami",
    amount: "Halaga",
    subtotal: "Subtotal",
    discount: "Diskwento",
    tax: "Buwis",
    total: "Kabuuan",
    amountPaid: "Nabayarang halaga",
    balanceDue: "Natitirang balanse",
    paymentHistory: "Kasaysayan ng bayad",
    paymentSummary: "Buod ng bayad",
    notes: "Mga tala",
    kitchenPlan: "Plano ng kusina",
    clientInfo: "Kliyente",
    method: "Paraan ng bayad",
    thankYou: "Salamat sa iyong tiwala",
  },
};

/**
 * Label lookup for one language.
 *
 * Falls back per-key to English rather than per-language, so adding a new
 * label doesn't blank it out in five languages until someone translates it.
 */
export function documentLabels(language = "en") {
  const chosen = LABELS[language] || {};
  return new Proxy(
    {},
    {
      get(_t, key) {
        return chosen[key] ?? LABELS.en[key] ?? String(key);
      },
    },
  );
}

/**
 * Currency and date formatted for the reader's locale.
 *
 * A Ukrainian-speaking homeowner in Toronto is still being billed in Canadian
 * dollars — so the currency stays CAD and only the formatting shifts.
 */
export function documentFormatters(language = "en", currency = "CAD") {
  const locale =
    { en: "en-CA", fr: "fr-CA", es: "es-419", uk: "uk-UA", pa: "pa-IN", tl: "fil-PH" }[
      language
    ] || "en-CA";

  return {
    money(n) {
      try {
        return Number(n ?? 0).toLocaleString(locale, {
          style: "currency",
          currency,
        });
      } catch {
        return `$${Number(n ?? 0).toFixed(2)}`;
      }
    },
    date(d) {
      if (!d) return "";
      try {
        return new Date(d).toLocaleDateString(locale, {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
      } catch {
        return new Date(d).toISOString().slice(0, 10);
      }
    },
  };
}

export const DOCUMENT_LABELS = LABELS;
