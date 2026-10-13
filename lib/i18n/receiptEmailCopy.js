// lib/i18n/receiptEmailCopy.js
//
// Every sentence of the receipt a client gets for ONE payment
// (lib/payments/receiptEmail.js), in every language a client can be written
// to in: app/i18n/languages.js LANGUAGES, the same eight codes
// lib/i18n/emailCopy.js covers. Mandarin is a catalogue-only language with no
// client documents (scripts/check-language-completeness.mjs, CATALOGUE_ONLY),
// so a client cannot be set to it and there is no `zh` block here.
//
// ── Why its own table and not more keys in emailCopy.js ─────────────────────
//
// emailCopy's `paidSubject` / `paidIntro` already say "receipt", and they were
// written for a different event: a service plan's automatic charge, "collected
// … using the payment method you authorised. Nothing further is needed." An
// e-transfer the client sent themselves, a cheque handed over in a driveway, a
// deposit that leaves most of the invoice still owing — none of those is that
// sentence. A receipt for a payment says what arrived, how, when, what has been
// paid so far and what is left, and that is a different letter.
//
// The greeting, the "or paste this link" line and the "Questions? Reply…"
// footer are the ones every other client email uses (emailCopy.js), read from
// there rather than repeated, so a client hears one voice.
//
// ── Hand-written, closed, never drafted at send time ───────────────────────
//
// AGENTS.md non-negotiable 6: nothing is machine-translated at send time. These
// are short transactional sentences, written once per language and checked
// key-for-key against English by scripts/check-language-completeness.mjs (the
// TABLES list) and scripts/check-payment-receipts.mjs.
//
// Payment-method NAMES for the offline methods (Interac e-Transfer, cheque,
// Zelle…) are not here: lib/payments/offlineMethods.js already names them in
// these eight languages for the "How to pay" block, and a receipt calling the
// method something different from the invoice that asked for it would be two
// vocabularies for one thing. This table names only what that one does not:
// the ways Stripe takes money, and a visit fee credited onto the invoice.

const COPY = {
  en: {
    label: "Receipt",
    subject: (company, amount, number) => `Receipt from ${company}: ${amount} received for invoice ${number}`,
    greetingNoName: "Hello,",
    intro: (amount, number) =>
      `Thank you. We received your payment of ${amount} for invoice ${number}. This email is your receipt.`,
    figureLabel: "Payment received",
    method: "Payment method",
    date: "Date received",
    invoice: "Invoice",
    invoiceTotal: "Invoice total",
    paidSoFar: "Total paid so far",
    balance: "Balance remaining",
    paidInFull: "Paid in full. Thank you!",
    cta: "View your invoice and payments",
    methods: {
      card: "Card",
      bankDebit: "Bank debit",
      affirm: "Affirm",
      klarna: "Klarna",
      afterpay: "Afterpay",
      online: "Online payment",
      visitCredit: "Visit fee credit",
      shop: "Shop Pay",
      other: "Payment",
    },
  },
  fr: {
    label: "Reçu",
    subject: (company, amount, number) => `Reçu de ${company} : ${amount} reçu pour la facture ${number}`,
    greetingNoName: "Bonjour,",
    intro: (amount, number) =>
      `Merci. Nous avons bien reçu votre paiement de ${amount} pour la facture ${number}. Ce courriel vous tient lieu de reçu.`,
    figureLabel: "Paiement reçu",
    method: "Mode de paiement",
    date: "Date de réception",
    invoice: "Facture",
    invoiceTotal: "Total de la facture",
    paidSoFar: "Total payé à ce jour",
    balance: "Solde restant",
    paidInFull: "Facture payée en totalité. Merci !",
    cta: "Voir votre facture et vos paiements",
    methods: {
      card: "Carte",
      bankDebit: "Débit bancaire",
      affirm: "Affirm",
      klarna: "Klarna",
      afterpay: "Afterpay",
      online: "Paiement en ligne",
      visitCredit: "Crédit des frais de visite",
      shop: "Shop Pay",
      other: "Paiement",
    },
  },
  es: {
    label: "Recibo",
    subject: (company, amount, number) => `Recibo de ${company}: ${amount} recibido para la factura ${number}`,
    greetingNoName: "Hola:",
    intro: (amount, number) =>
      `Gracias. Recibimos su pago de ${amount} para la factura ${number}. Este correo es su recibo.`,
    figureLabel: "Pago recibido",
    method: "Método de pago",
    date: "Fecha de recepción",
    invoice: "Factura",
    invoiceTotal: "Total de la factura",
    paidSoFar: "Total pagado hasta la fecha",
    balance: "Saldo pendiente",
    paidInFull: "Factura pagada en su totalidad. ¡Gracias!",
    cta: "Ver su factura y sus pagos",
    methods: {
      card: "Tarjeta",
      bankDebit: "Débito bancario",
      affirm: "Affirm",
      klarna: "Klarna",
      afterpay: "Afterpay",
      online: "Pago en línea",
      visitCredit: "Crédito del cargo por visita",
      shop: "Shop Pay",
      other: "Pago",
    },
  },
  uk: {
    label: "Квитанція",
    subject: (company, amount, number) => `Квитанція від ${company}: отримано ${amount} за рахунком ${number}`,
    greetingNoName: "Вітаємо!",
    intro: (amount, number) =>
      `Дякуємо! Ми отримали ваш платіж ${amount} за рахунком ${number}. Цей лист є вашою квитанцією.`,
    figureLabel: "Отримано платіж",
    method: "Спосіб оплати",
    date: "Дата отримання",
    invoice: "Рахунок",
    invoiceTotal: "Сума рахунку",
    paidSoFar: "Сплачено на сьогодні",
    balance: "Залишок до сплати",
    paidInFull: "Рахунок сплачено повністю. Дякуємо!",
    cta: "Переглянути рахунок і платежі",
    methods: {
      card: "Картка",
      bankDebit: "Банківське списання",
      affirm: "Affirm",
      klarna: "Klarna",
      afterpay: "Afterpay",
      online: "Онлайн-платіж",
      visitCredit: "Зарахування плати за візит",
      shop: "Shop Pay",
      other: "Платіж",
    },
  },
  pa: {
    label: "ਰਸੀਦ",
    subject: (company, amount, number) => `${company} ਵੱਲੋਂ ਰਸੀਦ: ਬਿੱਲ ${number} ਲਈ ${amount} ਪ੍ਰਾਪਤ ਹੋਏ`,
    greetingNoName: "ਸਤ ਸ੍ਰੀ ਅਕਾਲ,",
    intro: (amount, number) =>
      `ਧੰਨਵਾਦ। ਸਾਨੂੰ ਬਿੱਲ ${number} ਲਈ ਤੁਹਾਡਾ ${amount} ਦਾ ਭੁਗਤਾਨ ਮਿਲ ਗਿਆ ਹੈ। ਇਹ ਈਮੇਲ ਤੁਹਾਡੀ ਰਸੀਦ ਹੈ।`,
    figureLabel: "ਭੁਗਤਾਨ ਪ੍ਰਾਪਤ ਹੋਇਆ",
    method: "ਭੁਗਤਾਨ ਦਾ ਤਰੀਕਾ",
    date: "ਪ੍ਰਾਪਤੀ ਦੀ ਮਿਤੀ",
    invoice: "ਬਿੱਲ",
    invoiceTotal: "ਬਿੱਲ ਦੀ ਕੁੱਲ ਰਕਮ",
    paidSoFar: "ਹੁਣ ਤੱਕ ਅਦਾ ਕੀਤੀ ਕੁੱਲ ਰਕਮ",
    balance: "ਬਾਕੀ ਰਕਮ",
    paidInFull: "ਪੂਰਾ ਭੁਗਤਾਨ ਹੋ ਗਿਆ। ਧੰਨਵਾਦ!",
    cta: "ਆਪਣਾ ਬਿੱਲ ਅਤੇ ਭੁਗਤਾਨ ਵੇਖੋ",
    methods: {
      card: "ਕਾਰਡ",
      bankDebit: "ਬੈਂਕ ਡੈਬਿਟ",
      affirm: "Affirm",
      klarna: "Klarna",
      afterpay: "Afterpay",
      online: "ਆਨਲਾਈਨ ਭੁਗਤਾਨ",
      visitCredit: "ਵਿਜ਼ਿਟ ਫ਼ੀਸ ਦਾ ਕ੍ਰੈਡਿਟ",
      shop: "Shop Pay",
      other: "ਭੁਗਤਾਨ",
    },
  },
  tl: {
    label: "Resibo",
    subject: (company, amount, number) => `Resibo mula sa ${company}: natanggap ang ${amount} para sa invoice ${number}`,
    greetingNoName: "Kumusta po,",
    intro: (amount, number) =>
      `Salamat po. Natanggap namin ang inyong bayad na ${amount} para sa invoice ${number}. Ang email na ito ang inyong resibo.`,
    figureLabel: "Natanggap na bayad",
    method: "Paraan ng bayad",
    date: "Petsa ng pagtanggap",
    invoice: "Invoice",
    invoiceTotal: "Kabuuan ng invoice",
    paidSoFar: "Kabuuang nabayaran na",
    balance: "Natitirang balanse",
    paidInFull: "Bayad na nang buo. Maraming salamat po!",
    cta: "Tingnan ang invoice at mga bayad",
    methods: {
      card: "Card",
      bankDebit: "Bank debit",
      affirm: "Affirm",
      klarna: "Klarna",
      afterpay: "Afterpay",
      online: "Online na bayad",
      visitCredit: "Credit ng bayad sa pagbisita",
      shop: "Shop Pay",
      other: "Bayad",
    },
  },
  de: {
    label: "Beleg",
    subject: (company, amount, number) => `Beleg von ${company}: ${amount} erhalten für Rechnung ${number}`,
    greetingNoName: "Guten Tag,",
    intro: (amount, number) =>
      `Vielen Dank. Wir haben Ihre Zahlung von ${amount} für die Rechnung ${number} erhalten. Diese E-Mail ist Ihr Beleg.`,
    figureLabel: "Zahlung erhalten",
    method: "Zahlungsmethode",
    date: "Eingangsdatum",
    invoice: "Rechnung",
    invoiceTotal: "Rechnungsbetrag",
    paidSoFar: "Bisher bezahlt",
    balance: "Offener Betrag",
    paidInFull: "Vollständig bezahlt. Vielen Dank!",
    cta: "Rechnung und Zahlungen ansehen",
    methods: {
      card: "Karte",
      bankDebit: "Lastschrift",
      affirm: "Affirm",
      klarna: "Klarna",
      afterpay: "Afterpay",
      online: "Online-Zahlung",
      visitCredit: "Gutschrift der Besuchsgebühr",
      shop: "Shop Pay",
      other: "Zahlung",
    },
  },
  it: {
    label: "Ricevuta",
    subject: (company, amount, number) => `Ricevuta di ${company}: ricevuti ${amount} per la fattura ${number}`,
    greetingNoName: "Buongiorno,",
    intro: (amount, number) =>
      `Grazie. Abbiamo ricevuto il suo pagamento di ${amount} per la fattura ${number}. Questa email è la sua ricevuta.`,
    figureLabel: "Pagamento ricevuto",
    method: "Metodo di pagamento",
    date: "Data di ricezione",
    invoice: "Fattura",
    invoiceTotal: "Totale fattura",
    paidSoFar: "Totale pagato finora",
    balance: "Saldo residuo",
    paidInFull: "Fattura pagata per intero. Grazie!",
    cta: "Visualizzare la fattura e i pagamenti",
    methods: {
      card: "Carta",
      bankDebit: "Addebito bancario",
      affirm: "Affirm",
      klarna: "Klarna",
      afterpay: "Afterpay",
      online: "Pagamento online",
      visitCredit: "Credito del costo della visita",
      shop: "Shop Pay",
      other: "Pagamento",
    },
  },
};

/** The raw table, for scripts/check-language-completeness.mjs. */
export const RECEIPT_EMAIL_COPY = COPY;

/**
 * One language's receipt copy. A code with no block gets English rather than
 * a failed send — the same rule emailCopy() follows — and the completeness
 * check is what keeps every client language from ever needing that fallback.
 */
export function receiptCopy(language = "en") {
  const dict = COPY[language];
  return dict ? { ...COPY.en, ...dict, methods: { ...COPY.en.methods, ...dict.methods } } : COPY.en;
}
