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
    scopeOfWork: "Scope of work",
    whatsIncluded: "What's included",
    whatCouldChange: "What could change this price",
    howTheWorkRuns: "How the work runs",
    references: "Speak to past clients",
    beforeAfter: "Before & after",
    before: "Before",
    after: "After",
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
    scopeOfWork: "Étendue des travaux",
    whatsIncluded: "Ce qui est compris",
    whatCouldChange: "Ce qui pourrait modifier ce prix",
    howTheWorkRuns: "Comment se déroulent les travaux",
    references: "Parlez à d'anciens clients",
    beforeAfter: "Avant et après",
    before: "Avant",
    after: "Après",
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
    scopeOfWork: "Alcance del trabajo",
    whatsIncluded: "Qué incluye",
    whatCouldChange: "Qué podría cambiar este precio",
    howTheWorkRuns: "Cómo se realiza el trabajo",
    references: "Hable con clientes anteriores",
    beforeAfter: "Antes y después",
    before: "Antes",
    after: "Después",
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
    scopeOfWork: "Обсяг робіт",
    whatsIncluded: "Що входить",
    whatCouldChange: "Що може змінити цю ціну",
    howTheWorkRuns: "Як проходить робота",
    references: "Поговоріть із попередніми клієнтами",
    beforeAfter: "До і після",
    before: "До",
    after: "Після",
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
    scopeOfWork: "ਕੰਮ ਦਾ ਘੇਰਾ",
    whatsIncluded: "ਕੀ ਸ਼ਾਮਲ ਹੈ",
    whatCouldChange: "ਇਹ ਕੀਮਤ ਕੀ ਬਦਲ ਸਕਦਾ ਹੈ",
    howTheWorkRuns: "ਕੰਮ ਕਿਵੇਂ ਚੱਲਦਾ ਹੈ",
    references: "ਪਿਛਲੇ ਗਾਹਕਾਂ ਨਾਲ ਗੱਲ ਕਰੋ",
    beforeAfter: "ਪਹਿਲਾਂ ਅਤੇ ਬਾਅਦ",
    before: "ਪਹਿਲਾਂ",
    after: "ਬਾਅਦ",
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
    scopeOfWork: "Saklaw ng trabaho",
    whatsIncluded: "Ano ang kasama",
    whatCouldChange: "Ano ang maaaring magbago sa presyong ito",
    howTheWorkRuns: "Paano isinasagawa ang trabaho",
    references: "Kausapin ang mga dating kliyente",
    beforeAfter: "Bago at pagkatapos",
    before: "Bago",
    after: "Pagkatapos",
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
  // ── Why this coalesce is not redundant with the default parameter ────────
  //
  // A default parameter only fires for `undefined`. Company.currency is
  // `String?`, so a company that has never touched the setting stores NULL —
  // and `documentFormatters(lang, null)` kept the null, which made
  // toLocaleString throw RangeError, which fell into the catch below, which
  // returned "$2100.00".
  //
  // That is exactly what a homeowner saw on the quote and the invoice: no
  // thousands separator on the line items, the subtotal and the total, while
  // every internal screen showed "$2,100.00". Two formats for the same number,
  // one of them on the document the client keeps.
  //
  // Empty string is caught for the same reason — it is equally invalid to Intl
  // and equally likely to arrive from a form.
  const code = currency || "CAD";

  const locale =
    {
      en: "en-CA",
      fr: "fr-CA",
      es: "es-419",
      uk: "uk-UA",
      pa: "pa-IN",
      tl: "fil-PH",
    }[language] || "en-CA";

  return {
    // Exposed so a caller that needs an Intl format this file doesn't provide
    // — a month header, a time of day in the company's timezone — builds it
    // against the SAME locale rather than copying the map above. The copy is
    // the one that rots when a seventh language is added.
    locale,
    money(n) {
      // `Number(n ?? 0)` only catches null and undefined. A non-numeric string
      // is neither, so "abc" — or a Decimal that arrived unserialised — became
      // NaN and rendered "$NaN" on a quote a homeowner is being asked to sign.
      // Zero is the honest fallback: it is visibly wrong to whoever sends the
      // document, where NaN just looks broken to whoever receives it.
      const amount = Number(n);
      const value = Number.isFinite(amount) ? amount : 0;
      try {
        return value.toLocaleString(locale, {
          style: "currency",
          currency: code,
        });
      } catch {
        // Last resort, for an exotic runtime with no Intl currency data. It
        // still GROUPS — the old fallback dropped the separators, so the
        // degraded path was visually distinct from the good one on the same
        // page. A fallback should look like the thing it replaces.
        try {
          return `$${value.toLocaleString(locale, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`;
        } catch {
          return `$${value.toFixed(2)}`;
        }
      }
    },
    /**
     * A date on a client-facing document.
     *
     * ── Read as UTC, always, and that is a fix not a detail ─────────────────
     *
     * `validUntil` and `dueDate` are CALENDAR DATES. They are stored as UTC
     * midnight — the 30th of September is `2026-09-30T00:00:00Z`, an instant
     * only because the column is a DateTime. Formatted in any timezone west of
     * UTC that instant is still the 29th, so a quote valid until the 30th told
     * the client it expired on the 29th. A day off, on the one line of a quote
     * whose whole job is to state a deadline.
     *
     * This used to pass no timeZone at all, which means it rendered in
     * whatever timezone the process happened to be in — UTC on Vercel, the
     * developer's own zone locally, and a different answer if the platform ever
     * changed. A client-facing date that depends on where the server is running
     * is not a formatting choice, it is a bug waiting for a deployment.
     *
     * Instants (`createdAt`, a payment date) render in UTC too. That is what
     * they already did in production, so nothing moves; it is simply explicit
     * now. Showing those in the COMPANY's timezone would be better still and is
     * a larger change — lib/format/companyDate.js is where that belongs, and it
     * already does it for the staff-facing side.
     */
    date(d) {
      if (!d) return "";
      try {
        return new Date(d).toLocaleDateString(locale, {
          year: "numeric",
          month: "long",
          day: "numeric",
          timeZone: "UTC",
        });
      } catch {
        return new Date(d).toISOString().slice(0, 10);
      }
    },
  };
}

export const DOCUMENT_LABELS = LABELS;
