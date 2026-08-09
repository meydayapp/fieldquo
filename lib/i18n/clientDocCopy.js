// lib/i18n/clientDocCopy.js
//
// The page-specific sentences on the two interactive client surfaces — the
// public quote-approval page (/q/[token]) and the client portal (/portal) —
// in the six languages FieldQuo sends in.
//
// ── Why this is separate from everything else ───────────────────────────────
//
// documentLabels.js already covers the fixed furniture a quote and an invoice
// share (Subtotal, Tax, Total, Prepared for…), and those get reused here. What
// documentLabels does NOT cover is the interactive chrome that only exists on
// these two React pages: "Approve this quote", the signature consent line, the
// portal's "Balance owing". Those aren't part of a printed document, so they
// don't belong in documentLabels; but they're read by a homeowner, not staff,
// so they don't belong in app/i18n/appMessages.js either. This is their home.
//
// ── Hand-written, like documentLabels ───────────────────────────────────────
//
// A closed set of short transactional strings, translated by hand rather than
// drafted by a model. The signature-consent line is legally operative — it is
// the sentence a client ticks to turn a drawn mark into a binding approval —
// so it is translated faithfully and kept plain, never abbreviated.
//
// Functions where a name, amount or date is interpolated: word order around a
// value differs by language, and "Approve this quote for $X?" cannot be built
// by concatenation that survives translation.

const COPY = {
  en: {
    // /q/[token] — quote approval
    approveThisQuote: "Approve this quote",
    decline: "Decline",
    whatsIncluded: "What's included",
    optionalExtras: "Optional extras",
    extrasTickHint:
      "Tick anything you'd like added. The total updates as you go — nothing is charged until you approve.",
    extrasChosen: "Chosen when this quote was approved.",
    includesOptionalExtras: "Includes optional extras",
    howTheWorkRuns: "How the work runs",
    paymentTerms: "Payment terms",
    yourFullName: "Your full name",
    typeYourName: "Type your name",
    signature: "Signature",
    signatureConsent: (total) =>
      `I agree that signing here is my electronic signature and approves this quote for ${total}.`,
    approveConfirm: (total) => `Approve this quote for ${total}?`,
    declineConfirm: "Decline this quote?",
    approveSubExtras: (extras) =>
      `Including ${extras} of optional extras. This tells them to go ahead.`,
    approveSubPlain: "This tells them to go ahead.",
    declineSub: "You can always ask for a revised quote.",
    yesApprove: "Yes, approve",
    yesDecline: "Yes, decline",
    goBack: "Go back",
    approvedTitle: "Approved — thank you",
    approvedBody: (company) =>
      `${company} has been notified and will be in touch about next steps.`,
    declinedTitle: "Quote declined",
    declinedBody: (company) =>
      `${company} has been notified. If this was a mistake, give them a call.`,
    expiredTitle: "This quote has expired",
    expiredBody: (company) => `Contact ${company} for an updated price.`,
    // Covering note on the signed-quote PDF emailed to the client after they
    // approve. Short: the PDF is the document, this note just says why it landed.
    approvedCopyIntro: (company) =>
      `Thank you for approving your quote with ${company}. A copy is attached for your records.`,
    genericError: "Something went wrong. Try again.",
    quoteQuestions: (company, phone) =>
      phone
        ? `Questions? Reply to the email, or call ${company} at ${phone}.`
        : `Questions? Reply to the email, or call ${company}.`,

    // /portal/[token] — account overview
    accountFor: (name) => `Account for ${name}`,
    balanceOwing: "Balance owing",
    nothingOutstanding: "Nothing outstanding. Thank you.",
    acrossInvoices: (n) => `Across ${n} invoice${n === 1 ? "" : "s"}.`,
    invoicesHeading: "Invoices",
    quotesHeading: "Quotes",
    paidNote: (amount) => `${amount} paid`,
    dueNote: (date) => `due ${date}`,
    pay: (amount) => `Pay ${amount}`,
    paid: "Paid",
    review: "Review",
    paymentReceived:
      "Payment received — thank you. It can take a minute to show below.",
    portalQuestions: (company, phone, email) =>
      `Questions about any of this? Contact ${company}${phone ? ` at ${phone}` : ""}${email ? ` · ${email}` : ""}.`,

    // /portal/[token]/invoices/[id]
    backToAccount: "Back to your account",
    due: "Due",
    wasDue: "Was due",
    noItemisedBreakdown: "No itemised breakdown on this invoice.",
    paidInFull: "Paid in full",
    paidInFullThanks: "Paid in full — thank you",
    invoiceNotFound: "That invoice isn't on your account.",
  },

  fr: {
    approveThisQuote: "Approuver cette soumission",
    decline: "Refuser",
    whatsIncluded: "Ce qui est inclus",
    optionalExtras: "Options supplémentaires",
    extrasTickHint:
      "Cochez ce que vous souhaitez ajouter. Le total se met à jour au fur et à mesure — rien n'est facturé avant votre approbation.",
    extrasChosen: "Choisi lors de l'approbation de cette soumission.",
    includesOptionalExtras: "Comprend les options supplémentaires",
    howTheWorkRuns: "Déroulement des travaux",
    paymentTerms: "Modalités de paiement",
    yourFullName: "Votre nom complet",
    typeYourName: "Saisissez votre nom",
    signature: "Signature",
    signatureConsent: (total) =>
      `J'accepte que ma signature ici constitue ma signature électronique et approuve cette soumission pour ${total}.`,
    approveConfirm: (total) => `Approuver cette soumission pour ${total} ?`,
    declineConfirm: "Refuser cette soumission ?",
    approveSubExtras: (extras) =>
      `Comprend ${extras} d'options supplémentaires. Cela leur indique d'aller de l'avant.`,
    approveSubPlain: "Cela leur indique d'aller de l'avant.",
    declineSub: "Vous pouvez toujours demander une soumission révisée.",
    yesApprove: "Oui, approuver",
    yesDecline: "Oui, refuser",
    goBack: "Retour",
    approvedTitle: "Approuvée — merci",
    approvedBody: (company) =>
      `${company} a été avisé et vous contactera au sujet des prochaines étapes.`,
    declinedTitle: "Soumission refusée",
    declinedBody: (company) =>
      `${company} a été avisé. S'il s'agit d'une erreur, appelez-les.`,
    expiredTitle: "Cette soumission est expirée",
    expiredBody: (company) =>
      `Contactez ${company} pour obtenir un prix à jour.`,
    approvedCopyIntro: (company) =>
      `Merci d'avoir approuvé votre soumission avec ${company}. Une copie est jointe pour vos dossiers.`,
    genericError: "Une erreur s'est produite. Réessayez.",
    quoteQuestions: (company, phone) =>
      phone
        ? `Des questions ? Répondez au courriel ou appelez ${company} au ${phone}.`
        : `Des questions ? Répondez au courriel ou appelez ${company}.`,

    accountFor: (name) => `Compte de ${name}`,
    balanceOwing: "Solde dû",
    nothingOutstanding: "Rien en souffrance. Merci.",
    acrossInvoices: (n) => `Réparti sur ${n} facture${n === 1 ? "" : "s"}.`,
    invoicesHeading: "Factures",
    quotesHeading: "Soumissions",
    paidNote: (amount) => `${amount} payé`,
    dueNote: (date) => `échéance ${date}`,
    pay: (amount) => `Payer ${amount}`,
    paid: "Payé",
    review: "Consulter",
    paymentReceived:
      "Paiement reçu — merci. Son affichage ci-dessous peut prendre une minute.",
    portalQuestions: (company, phone, email) =>
      `Des questions à ce sujet ? Contactez ${company}${phone ? ` au ${phone}` : ""}${email ? ` · ${email}` : ""}.`,

    backToAccount: "Retour à votre compte",
    due: "Échéance",
    wasDue: "Était dû",
    noItemisedBreakdown: "Aucun détail sur cette facture.",
    paidInFull: "Payée en totalité",
    paidInFullThanks: "Payée en totalité — merci",
    invoiceNotFound: "Cette facture n'est pas dans votre compte.",
  },

  es: {
    approveThisQuote: "Aprobar este presupuesto",
    decline: "Rechazar",
    whatsIncluded: "Qué incluye",
    optionalExtras: "Extras opcionales",
    extrasTickHint:
      "Marque lo que desee añadir. El total se actualiza sobre la marcha — no se cobra nada hasta que usted apruebe.",
    extrasChosen: "Elegido al aprobar este presupuesto.",
    includesOptionalExtras: "Incluye extras opcionales",
    howTheWorkRuns: "Cómo se realiza el trabajo",
    paymentTerms: "Condiciones de pago",
    yourFullName: "Su nombre completo",
    typeYourName: "Escriba su nombre",
    signature: "Firma",
    signatureConsent: (total) =>
      `Acepto que firmar aquí es mi firma electrónica y aprueba este presupuesto por ${total}.`,
    approveConfirm: (total) => `¿Aprobar este presupuesto por ${total}?`,
    declineConfirm: "¿Rechazar este presupuesto?",
    approveSubExtras: (extras) =>
      `Incluye ${extras} en extras opcionales. Esto les indica que sigan adelante.`,
    approveSubPlain: "Esto les indica que sigan adelante.",
    declineSub: "Siempre puede pedir un presupuesto revisado.",
    yesApprove: "Sí, aprobar",
    yesDecline: "Sí, rechazar",
    goBack: "Volver",
    approvedTitle: "Aprobado — gracias",
    approvedBody: (company) =>
      `Se ha notificado a ${company} y se pondrán en contacto sobre los próximos pasos.`,
    declinedTitle: "Presupuesto rechazado",
    declinedBody: (company) =>
      `Se ha notificado a ${company}. Si fue un error, llámelos.`,
    expiredTitle: "Este presupuesto ha vencido",
    expiredBody: (company) =>
      `Comuníquese con ${company} para un precio actualizado.`,
    approvedCopyIntro: (company) =>
      `Gracias por aprobar su presupuesto con ${company}. Se adjunta una copia para sus registros.`,
    genericError: "Algo salió mal. Inténtelo de nuevo.",
    quoteQuestions: (company, phone) =>
      phone
        ? `¿Preguntas? Responda al correo o llame a ${company} al ${phone}.`
        : `¿Preguntas? Responda al correo o llame a ${company}.`,

    accountFor: (name) => `Cuenta de ${name}`,
    balanceOwing: "Saldo pendiente",
    nothingOutstanding: "Nada pendiente. Gracias.",
    acrossInvoices: (n) => `En ${n} factura${n === 1 ? "" : "s"}.`,
    invoicesHeading: "Facturas",
    quotesHeading: "Presupuestos",
    paidNote: (amount) => `${amount} pagado`,
    dueNote: (date) => `vence ${date}`,
    pay: (amount) => `Pagar ${amount}`,
    paid: "Pagado",
    review: "Revisar",
    paymentReceived:
      "Pago recibido — gracias. Puede tardar un minuto en aparecer abajo.",
    portalQuestions: (company, phone, email) =>
      `¿Preguntas sobre esto? Comuníquese con ${company}${phone ? ` al ${phone}` : ""}${email ? ` · ${email}` : ""}.`,

    backToAccount: "Volver a su cuenta",
    due: "Vence",
    wasDue: "Venció",
    noItemisedBreakdown: "Sin desglose en esta factura.",
    paidInFull: "Pagada por completo",
    paidInFullThanks: "Pagada por completo — gracias",
    invoiceNotFound: "Esa factura no está en su cuenta.",
  },

  uk: {
    approveThisQuote: "Підтвердити цей кошторис",
    decline: "Відхилити",
    whatsIncluded: "Що входить",
    optionalExtras: "Додаткові опції",
    extrasTickHint:
      "Позначте те, що бажаєте додати. Підсумок оновлюється відразу — нічого не стягується до вашого підтвердження.",
    extrasChosen: "Обрано під час підтвердження цього кошторису.",
    includesOptionalExtras: "Містить додаткові опції",
    howTheWorkRuns: "Як виконуються роботи",
    paymentTerms: "Умови оплати",
    yourFullName: "Ваше повне ім'я",
    typeYourName: "Введіть ваше ім'я",
    signature: "Підпис",
    signatureConsent: (total) =>
      `Я погоджуюся, що підпис тут є моїм електронним підписом і підтверджує цей кошторис на суму ${total}.`,
    approveConfirm: (total) => `Підтвердити цей кошторис на ${total}?`,
    declineConfirm: "Відхилити цей кошторис?",
    approveSubExtras: (extras) =>
      `Включно з ${extras} додаткових опцій. Це дає їм сигнал розпочинати.`,
    approveSubPlain: "Це дає їм сигнал розпочинати.",
    declineSub: "Ви завжди можете попросити оновлений кошторис.",
    yesApprove: "Так, підтвердити",
    yesDecline: "Так, відхилити",
    goBack: "Назад",
    approvedTitle: "Підтверджено — дякуємо",
    approvedBody: (company) =>
      `${company} сповіщено, і з вами зв'яжуться щодо наступних кроків.`,
    declinedTitle: "Кошторис відхилено",
    declinedBody: (company) =>
      `${company} сповіщено. Якщо це помилка, зателефонуйте їм.`,
    expiredTitle: "Термін дії цього кошторису минув",
    expiredBody: (company) =>
      `Зв'яжіться з ${company}, щоб отримати оновлену ціну.`,
    approvedCopyIntro: (company) =>
      `Дякуємо за підтвердження кошторису з ${company}. Копію додано для ваших записів.`,
    genericError: "Щось пішло не так. Спробуйте ще раз.",
    quoteQuestions: (company, phone) =>
      phone
        ? `Питання? Відповідайте на лист або телефонуйте ${company}: ${phone}.`
        : `Питання? Відповідайте на лист або телефонуйте ${company}.`,

    accountFor: (name) => `Рахунок для ${name}`,
    balanceOwing: "Залишок до сплати",
    nothingOutstanding: "Немає заборгованості. Дякуємо.",
    acrossInvoices: (n) => `За ${n} рахунками.`,
    invoicesHeading: "Рахунки",
    quotesHeading: "Кошториси",
    paidNote: (amount) => `сплачено ${amount}`,
    dueNote: (date) => `термін ${date}`,
    pay: (amount) => `Сплатити ${amount}`,
    paid: "Сплачено",
    review: "Переглянути",
    paymentReceived:
      "Платіж отримано — дякуємо. Його відображення нижче може зайняти хвилину.",
    portalQuestions: (company, phone, email) =>
      `Питання щодо цього? Зв'яжіться з ${company}${phone ? `: ${phone}` : ""}${email ? ` · ${email}` : ""}.`,

    backToAccount: "Назад до вашого рахунку",
    due: "Термін оплати",
    wasDue: "Термін минув",
    noItemisedBreakdown: "У цьому рахунку немає деталізації.",
    paidInFull: "Сплачено повністю",
    paidInFullThanks: "Сплачено повністю — дякуємо",
    invoiceNotFound: "Цього рахунку немає у вашому обліковому записі.",
  },

  pa: {
    approveThisQuote: "ਇਹ ਹਵਾਲਾ ਮਨਜ਼ੂਰ ਕਰੋ",
    decline: "ਇਨਕਾਰ ਕਰੋ",
    whatsIncluded: "ਕੀ ਸ਼ਾਮਲ ਹੈ",
    optionalExtras: "ਵਿਕਲਪਿਕ ਵਾਧੂ",
    extrasTickHint:
      "ਜੋ ਵੀ ਤੁਸੀਂ ਜੋੜਨਾ ਚਾਹੁੰਦੇ ਹੋ, ਉਸ 'ਤੇ ਨਿਸ਼ਾਨ ਲਗਾਓ। ਕੁੱਲ ਨਾਲੋ-ਨਾਲ ਬਦਲਦਾ ਹੈ — ਤੁਹਾਡੀ ਮਨਜ਼ੂਰੀ ਤੋਂ ਬਿਨਾਂ ਕੁਝ ਵੀ ਨਹੀਂ ਲਿਆ ਜਾਂਦਾ।",
    extrasChosen: "ਇਸ ਹਵਾਲੇ ਦੀ ਮਨਜ਼ੂਰੀ ਵੇਲੇ ਚੁਣਿਆ ਗਿਆ।",
    includesOptionalExtras: "ਵਿਕਲਪਿਕ ਵਾਧੂ ਸ਼ਾਮਲ ਹਨ",
    howTheWorkRuns: "ਕੰਮ ਕਿਵੇਂ ਚੱਲਦਾ ਹੈ",
    paymentTerms: "ਭੁਗਤਾਨ ਦੀਆਂ ਸ਼ਰਤਾਂ",
    yourFullName: "ਤੁਹਾਡਾ ਪੂਰਾ ਨਾਮ",
    typeYourName: "ਆਪਣਾ ਨਾਮ ਲਿਖੋ",
    signature: "ਦਸਤਖ਼ਤ",
    signatureConsent: (total) =>
      `ਮੈਂ ਸਹਿਮਤ ਹਾਂ ਕਿ ਇੱਥੇ ਦਸਤਖ਼ਤ ਕਰਨਾ ਮੇਰਾ ਇਲੈਕਟ੍ਰਾਨਿਕ ਦਸਤਖ਼ਤ ਹੈ ਅਤੇ ਇਹ ਹਵਾਲਾ ${total} ਲਈ ਮਨਜ਼ੂਰ ਕਰਦਾ ਹੈ।`,
    approveConfirm: (total) => `ਇਹ ਹਵਾਲਾ ${total} ਲਈ ਮਨਜ਼ੂਰ ਕਰਨਾ ਹੈ?`,
    declineConfirm: "ਇਹ ਹਵਾਲਾ ਇਨਕਾਰ ਕਰਨਾ ਹੈ?",
    approveSubExtras: (extras) =>
      `${extras} ਦੇ ਵਿਕਲਪਿਕ ਵਾਧੂ ਸਮੇਤ। ਇਹ ਉਨ੍ਹਾਂ ਨੂੰ ਅੱਗੇ ਵਧਣ ਲਈ ਕਹਿੰਦਾ ਹੈ।`,
    approveSubPlain: "ਇਹ ਉਨ੍ਹਾਂ ਨੂੰ ਅੱਗੇ ਵਧਣ ਲਈ ਕਹਿੰਦਾ ਹੈ।",
    declineSub: "ਤੁਸੀਂ ਹਮੇਸ਼ਾ ਸੋਧਿਆ ਹਵਾਲਾ ਮੰਗ ਸਕਦੇ ਹੋ।",
    yesApprove: "ਹਾਂ, ਮਨਜ਼ੂਰ ਕਰੋ",
    yesDecline: "ਹਾਂ, ਇਨਕਾਰ ਕਰੋ",
    goBack: "ਵਾਪਸ ਜਾਓ",
    approvedTitle: "ਮਨਜ਼ੂਰ — ਧੰਨਵਾਦ",
    approvedBody: (company) =>
      `${company} ਨੂੰ ਸੂਚਿਤ ਕਰ ਦਿੱਤਾ ਗਿਆ ਹੈ ਅਤੇ ਉਹ ਅਗਲੇ ਕਦਮਾਂ ਬਾਰੇ ਸੰਪਰਕ ਕਰਨਗੇ।`,
    declinedTitle: "ਹਵਾਲਾ ਇਨਕਾਰ ਕੀਤਾ",
    declinedBody: (company) =>
      `${company} ਨੂੰ ਸੂਚਿਤ ਕਰ ਦਿੱਤਾ ਗਿਆ ਹੈ। ਜੇ ਇਹ ਗਲਤੀ ਸੀ, ਤਾਂ ਉਨ੍ਹਾਂ ਨੂੰ ਫ਼ੋਨ ਕਰੋ।`,
    expiredTitle: "ਇਸ ਹਵਾਲੇ ਦੀ ਮਿਆਦ ਲੰਘ ਗਈ ਹੈ",
    expiredBody: (company) =>
      `ਅੱਪਡੇਟ ਕੀਤੀ ਕੀਮਤ ਲਈ ${company} ਨਾਲ ਸੰਪਰਕ ਕਰੋ।`,
    approvedCopyIntro: (company) =>
      `${company} ਨਾਲ ਆਪਣਾ ਹਵਾਲਾ ਮਨਜ਼ੂਰ ਕਰਨ ਲਈ ਧੰਨਵਾਦ। ਤੁਹਾਡੇ ਰਿਕਾਰਡ ਲਈ ਇੱਕ ਕਾਪੀ ਨੱਥੀ ਹੈ।`,
    genericError: "ਕੁਝ ਗਲਤ ਹੋ ਗਿਆ। ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।",
    quoteQuestions: (company, phone) =>
      phone
        ? `ਸਵਾਲ? ਈਮੇਲ ਦਾ ਜਵਾਬ ਦਿਓ, ਜਾਂ ${company} ਨੂੰ ${phone} 'ਤੇ ਫ਼ੋਨ ਕਰੋ।`
        : `ਸਵਾਲ? ਈਮੇਲ ਦਾ ਜਵਾਬ ਦਿਓ, ਜਾਂ ${company} ਨੂੰ ਫ਼ੋਨ ਕਰੋ।`,

    accountFor: (name) => `${name} ਲਈ ਖਾਤਾ`,
    balanceOwing: "ਬਕਾਇਆ ਰਕਮ",
    nothingOutstanding: "ਕੁਝ ਵੀ ਬਕਾਇਆ ਨਹੀਂ। ਧੰਨਵਾਦ।",
    acrossInvoices: (n) => `${n} ਬਿੱਲਾਂ ਵਿੱਚ।`,
    invoicesHeading: "ਬਿੱਲ",
    quotesHeading: "ਹਵਾਲੇ",
    paidNote: (amount) => `${amount} ਅਦਾ ਕੀਤਾ`,
    dueNote: (date) => `${date} ਤੱਕ`,
    pay: (amount) => `${amount} ਭੁਗਤਾਨ ਕਰੋ`,
    paid: "ਅਦਾ ਕੀਤਾ",
    review: "ਵੇਖੋ",
    paymentReceived:
      "ਭੁਗਤਾਨ ਮਿਲ ਗਿਆ — ਧੰਨਵਾਦ। ਹੇਠਾਂ ਦਿਖਣ ਵਿੱਚ ਇੱਕ ਮਿੰਟ ਲੱਗ ਸਕਦਾ ਹੈ।",
    portalQuestions: (company, phone, email) =>
      `ਇਸ ਬਾਰੇ ਸਵਾਲ? ${company}${phone ? ` ਨੂੰ ${phone} 'ਤੇ` : ""}${email ? ` · ${email}` : ""} ਸੰਪਰਕ ਕਰੋ।`,

    backToAccount: "ਆਪਣੇ ਖਾਤੇ 'ਤੇ ਵਾਪਸ",
    due: "ਭੁਗਤਾਨ",
    wasDue: "ਭੁਗਤਾਨ ਸੀ",
    noItemisedBreakdown: "ਇਸ ਬਿੱਲ 'ਤੇ ਕੋਈ ਵੇਰਵਾ ਨਹੀਂ।",
    paidInFull: "ਪੂਰਾ ਅਦਾ ਕੀਤਾ",
    paidInFullThanks: "ਪੂਰਾ ਅਦਾ ਕੀਤਾ — ਧੰਨਵਾਦ",
    invoiceNotFound: "ਉਹ ਬਿੱਲ ਤੁਹਾਡੇ ਖਾਤੇ ਵਿੱਚ ਨਹੀਂ ਹੈ।",
  },

  tl: {
    approveThisQuote: "Aprubahan ang quote na ito",
    decline: "Tanggihan",
    whatsIncluded: "Ano ang kasama",
    optionalExtras: "Mga opsyonal na dagdag",
    extrasTickHint:
      "Lagyan ng tsek ang gusto ninyong idagdag. Nag-a-update ang kabuuan habang pinipili — walang sisingilin hangga't hindi ninyo ito inaaprubahan.",
    extrasChosen: "Napili nang aprubahan ang quote na ito.",
    includesOptionalExtras: "Kasama ang mga opsyonal na dagdag",
    howTheWorkRuns: "Paano isasagawa ang trabaho",
    paymentTerms: "Mga tuntunin ng pagbabayad",
    yourFullName: "Buong pangalan ninyo",
    typeYourName: "I-type ang pangalan ninyo",
    signature: "Lagda",
    signatureConsent: (total) =>
      `Sang-ayon ako na ang paglagda dito ay aking elektronikong lagda at nag-aapruba sa quote na ito para sa ${total}.`,
    approveConfirm: (total) => `Aprubahan ang quote na ito para sa ${total}?`,
    declineConfirm: "Tanggihan ang quote na ito?",
    approveSubExtras: (extras) =>
      `Kasama ang ${extras} na opsyonal na dagdag. Ito ang senyales para magpatuloy sila.`,
    approveSubPlain: "Ito ang senyales para magpatuloy sila.",
    declineSub: "Maaari kayong humingi ng binagong quote anumang oras.",
    yesApprove: "Oo, aprubahan",
    yesDecline: "Oo, tanggihan",
    goBack: "Bumalik",
    approvedTitle: "Naaprubahan — salamat",
    approvedBody: (company) =>
      `Naabisuhan na ang ${company} at makikipag-ugnayan sila tungkol sa mga susunod na hakbang.`,
    declinedTitle: "Tinanggihan ang quote",
    declinedBody: (company) =>
      `Naabisuhan na ang ${company}. Kung nagkamali, tawagan sila.`,
    expiredTitle: "Nag-expire na ang quote na ito",
    expiredBody: (company) =>
      `Makipag-ugnayan sa ${company} para sa napapanahong presyo.`,
    approvedCopyIntro: (company) =>
      `Salamat sa pag-apruba ng inyong quote sa ${company}. May nakalakip na kopya para sa inyong tala.`,
    genericError: "May nangyaring mali. Subukan muli.",
    quoteQuestions: (company, phone) =>
      phone
        ? `May tanong? I-reply ang email, o tawagan ang ${company} sa ${phone}.`
        : `May tanong? I-reply ang email, o tawagan ang ${company}.`,

    accountFor: (name) => `Account ni ${name}`,
    balanceOwing: "Natitirang babayaran",
    nothingOutstanding: "Walang natitira. Salamat.",
    acrossInvoices: (n) => `Sa ${n} na invoice.`,
    invoicesHeading: "Mga invoice",
    quotesHeading: "Mga quote",
    paidNote: (amount) => `${amount} bayad na`,
    dueNote: (date) => `dapat bayaran ${date}`,
    pay: (amount) => `Magbayad ng ${amount}`,
    paid: "Bayad na",
    review: "Tingnan",
    paymentReceived:
      "Natanggap ang bayad — salamat. Maaaring tumagal ng isang minuto bago lumabas sa ibaba.",
    portalQuestions: (company, phone, email) =>
      `May tanong tungkol dito? Makipag-ugnayan sa ${company}${phone ? ` sa ${phone}` : ""}${email ? ` · ${email}` : ""}.`,

    backToAccount: "Bumalik sa account ninyo",
    due: "Dapat bayaran",
    wasDue: "Dapat sana",
    noItemisedBreakdown: "Walang detalyadong breakdown sa invoice na ito.",
    paidInFull: "Bayad nang buo",
    paidInFullThanks: "Bayad nang buo — salamat",
    invoiceNotFound: "Wala ang invoice na iyon sa account ninyo.",
  },
};

/**
 * Page copy for one language, falling back per-language to English.
 *
 * Falls back whole rather than per-key: these entries are added in complete
 * language sets, not one string at a time, so a missing language means the
 * translation hasn't been done yet and English is the safe render — never a
 * page with three English lines and one blank.
 */
export function clientDocCopy(language = "en") {
  return COPY[language] || COPY.en;
}
