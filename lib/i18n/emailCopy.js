// lib/i18n/emailCopy.js
//
// Every sentence a client reads in an email, in the six languages FieldQuo
// supports.
//
// ── Why this had to exist ───────────────────────────────────────────────────
//
// The documents were already translated — documentLabels.js covers en, fr, es,
// uk, pa, tl, and Quote.language is fixed at creation so a signed PDF keeps
// saying what it said. But the EMAIL carrying that document was hardcoded
// English. A francophone homeowner got a French quote attached to an English
// covering note, which is worse than either being consistently one language:
// it reads as a translation bolted onto a company that doesn't actually speak
// French.
//
// ── The client's language, not the company's ────────────────────────────────
//
// Client.language is the source of truth. A bilingual contractor in Gatineau
// works in English and writes to half their clients in French; the company
// default is only the fallback for a client who never said.
//
// ── Functions, not strings ──────────────────────────────────────────────────
//
// Several of these interpolate a name, a number or a date, and word order for
// those differs by language — you cannot build "Your quote from X" by
// concatenating in a way that survives translation. So each entry is a
// function and the whole sentence lives inside it.
//
// ── Honest limits ───────────────────────────────────────────────────────────
//
// These are careful translations of short transactional copy, not the work of
// a native-speaker copywriter. They're correct and plain; they aren't idiomatic
// marketing prose, and they shouldn't be extended into any. Anything longer or
// more persuasive belongs in a template the company writes themselves.

const COPY = {
  en: {
    greeting: (name) => `Hi ${name},`,
    quoteIntro: () =>
      "Thanks for the opportunity to quote on your project. Everything we discussed is set out at the link below.",
    followUpIntro: () =>
      "Just following up on the quote we sent — it's still available to look over whenever suits you.",
    quoteSubject: (company, number) => `Your quote from ${company} — ${number}`,
    followUpSubject: (company, number) =>
      `Following up: quote ${number} from ${company}`,
    quoteCta: "View & approve your quote",
    validUntil: (date) => `Valid until ${date}`,

    invoiceSubject: (company, number, amount) =>
      `Invoice ${number} from ${company} — ${amount} due`,
    invoiceIntro: (number) =>
      `Here's invoice ${number} for the work completed.`,
    invoiceIntroPartial: (number, paid) =>
      `Here's the balance on invoice ${number}, after the ${paid} already received. Thank you for that.`,
    amountDue: "Amount due",
    balanceDue: "Balance due",
    due: (date) => `Due ${date}`,
    wasDue: (date) => `Was due ${date}`,
    payCta: "Pay online",
    viewInvoiceCta: "View your invoice",
    accepted: (methods) => `Accepted: ${methods}.`,

    reminderIntro: (number, amount) =>
      `A reminder that invoice ${number} has a balance of ${amount}.`,
    reminderSubject: (amount, number) => `${amount} due — invoice ${number}`,
    arrangePayment: "Please get in touch to arrange payment.",

    referencesIntro: () =>
      "These are past clients of ours who agreed to take a call. Ring any of them and ask what we were like to have in the house.",
    beforeAfterIntro: () => "A few of the jobs we've finished recently.",

    orPaste: "Or paste this into your browser:",
    questions: (phone) =>
      phone
        ? `Questions? Reply to this email or call ${phone}.`
        : "Questions? Reply to this email.",
  },

  fr: {
    greeting: (name) => `Bonjour ${name},`,
    quoteIntro: () =>
      "Merci de nous avoir permis de soumissionner pour votre projet. Tout ce dont nous avons discuté se trouve au lien ci-dessous.",
    followUpIntro: () =>
      "Petit suivi concernant la soumission que nous vous avons envoyée — elle reste disponible quand cela vous conviendra.",
    quoteSubject: (company, number) =>
      `Votre soumission de ${company} — ${number}`,
    followUpSubject: (company, number) =>
      `Suivi : soumission ${number} de ${company}`,
    quoteCta: "Consulter et approuver votre soumission",
    validUntil: (date) => `Valide jusqu'au ${date}`,

    invoiceSubject: (company, number, amount) =>
      `Facture ${number} de ${company} — ${amount} à payer`,
    invoiceIntro: (number) =>
      `Voici la facture ${number} pour les travaux réalisés.`,
    invoiceIntroPartial: (number, paid) =>
      `Voici le solde de la facture ${number}, après le versement de ${paid} déjà reçu. Merci beaucoup.`,
    amountDue: "Montant dû",
    balanceDue: "Solde à payer",
    due: (date) => `Échéance le ${date}`,
    wasDue: (date) => `Échue le ${date}`,
    payCta: "Payer en ligne",
    viewInvoiceCta: "Consulter votre facture",
    accepted: (methods) => `Modes de paiement acceptés : ${methods}.`,

    reminderIntro: (number, amount) =>
      `Un rappel : le solde de la facture ${number} est de ${amount}.`,
    reminderSubject: (amount, number) => `${amount} à payer — facture ${number}`,
    arrangePayment: "Veuillez nous contacter pour organiser le paiement.",

    referencesIntro: () =>
      "Voici d'anciens clients qui ont accepté de recevoir un appel. Téléphonez à l'un d'eux et demandez-lui comment cela s'est passé chez lui.",
    beforeAfterIntro: () =>
      "Quelques chantiers que nous avons terminés récemment.",

    orPaste: "Ou copiez ce lien dans votre navigateur :",
    questions: (phone) =>
      phone
        ? `Des questions ? Répondez à ce courriel ou appelez le ${phone}.`
        : "Des questions ? Répondez simplement à ce courriel.",
  },

  es: {
    greeting: (name) => `Hola ${name}:`,
    quoteIntro: () =>
      "Gracias por darnos la oportunidad de cotizar su proyecto. Todo lo que conversamos está en el enlace de abajo.",
    followUpIntro: () =>
      "Le escribimos para dar seguimiento al presupuesto que le enviamos — sigue disponible cuando usted quiera revisarlo.",
    quoteSubject: (company, number) => `Su presupuesto de ${company} — ${number}`,
    followUpSubject: (company, number) =>
      `Seguimiento: presupuesto ${number} de ${company}`,
    quoteCta: "Ver y aprobar su presupuesto",
    validUntil: (date) => `Válido hasta el ${date}`,

    invoiceSubject: (company, number, amount) =>
      `Factura ${number} de ${company} — ${amount} por pagar`,
    invoiceIntro: (number) =>
      `Aquí está la factura ${number} por el trabajo realizado.`,
    invoiceIntroPartial: (number, paid) =>
      `Aquí está el saldo de la factura ${number}, después del pago de ${paid} ya recibido. Muchas gracias.`,
    amountDue: "Monto a pagar",
    balanceDue: "Saldo pendiente",
    due: (date) => `Vence el ${date}`,
    wasDue: (date) => `Venció el ${date}`,
    payCta: "Pagar en línea",
    viewInvoiceCta: "Ver su factura",
    accepted: (methods) => `Formas de pago aceptadas: ${methods}.`,

    reminderIntro: (number, amount) =>
      `Un recordatorio: la factura ${number} tiene un saldo de ${amount}.`,
    reminderSubject: (amount, number) => `${amount} por pagar — factura ${number}`,
    arrangePayment: "Por favor comuníquese con nosotros para coordinar el pago.",

    referencesIntro: () =>
      "Estos son clientes anteriores que aceptaron recibir una llamada. Llame a cualquiera de ellos y pregunte cómo fue tenernos en casa.",
    beforeAfterIntro: () =>
      "Algunos de los trabajos que hemos terminado hace poco.",

    orPaste: "O copie este enlace en su navegador:",
    questions: (phone) =>
      phone
        ? `¿Preguntas? Responda a este correo o llame al ${phone}.`
        : "¿Preguntas? Responda a este correo.",
  },

  uk: {
    greeting: (name) => `Вітаємо, ${name}!`,
    quoteIntro: () =>
      "Дякуємо за можливість підготувати кошторис для вашого проєкту. Усе, що ми обговорювали, доступне за посиланням нижче.",
    followUpIntro: () =>
      "Нагадуємо про надісланий кошторис — він і далі доступний для перегляду в зручний для вас час.",
    quoteSubject: (company, number) => `Ваш кошторис від ${company} — ${number}`,
    followUpSubject: (company, number) =>
      `Нагадування: кошторис ${number} від ${company}`,
    quoteCta: "Переглянути та підтвердити кошторис",
    validUntil: (date) => `Дійсний до ${date}`,

    invoiceSubject: (company, number, amount) =>
      `Рахунок ${number} від ${company} — до сплати ${amount}`,
    invoiceIntro: (number) => `Надсилаємо рахунок ${number} за виконані роботи.`,
    invoiceIntroPartial: (number, paid) =>
      `Надсилаємо залишок за рахунком ${number} після вже отриманої оплати ${paid}. Дякуємо.`,
    amountDue: "До сплати",
    balanceDue: "Залишок до сплати",
    due: (date) => `Термін оплати: ${date}`,
    wasDue: (date) => `Термін оплати минув ${date}`,
    payCta: "Сплатити онлайн",
    viewInvoiceCta: "Переглянути рахунок",
    accepted: (methods) => `Приймаємо: ${methods}.`,

    reminderIntro: (number, amount) =>
      `Нагадуємо: залишок за рахунком ${number} становить ${amount}.`,
    reminderSubject: (amount, number) => `До сплати ${amount} — рахунок ${number}`,
    arrangePayment: "Будь ласка, зв\u2019яжіться з нами, щоб домовитися про оплату.",

    referencesIntro: () =>
      "Це наші попередні клієнти, які погодилися відповісти на дзвінок. Зателефонуйте будь-кому з них і запитайте, як їм працювалося з нами.",
    beforeAfterIntro: () => "Кілька робіт, які ми нещодавно завершили.",

    orPaste: "Або скопіюйте це посилання у браузер:",
    questions: (phone) =>
      phone
        ? `Питання? Відповідайте на цей лист або телефонуйте ${phone}.`
        : "Питання? Просто відповідайте на цей лист.",
  },

  pa: {
    greeting: (name) => `ਸਤ ਸ੍ਰੀ ਅਕਾਲ ${name},`,
    quoteIntro: () =>
      "ਤੁਹਾਡੇ ਪ੍ਰੋਜੈਕਟ ਲਈ ਹਵਾਲਾ ਦੇਣ ਦਾ ਮੌਕਾ ਦੇਣ ਲਈ ਧੰਨਵਾਦ। ਜੋ ਵੀ ਗੱਲ ਹੋਈ ਸੀ, ਉਹ ਹੇਠਾਂ ਦਿੱਤੇ ਲਿੰਕ 'ਤੇ ਹੈ।",
    followUpIntro: () =>
      "ਅਸੀਂ ਭੇਜੇ ਹਵਾਲੇ ਬਾਰੇ ਯਾਦ ਕਰਵਾ ਰਹੇ ਹਾਂ — ਤੁਸੀਂ ਜਦੋਂ ਚਾਹੋ ਇਸਨੂੰ ਵੇਖ ਸਕਦੇ ਹੋ।",
    quoteSubject: (company, number) => `${company} ਵੱਲੋਂ ਤੁਹਾਡਾ ਹਵਾਲਾ — ${number}`,
    followUpSubject: (company, number) =>
      `ਯਾਦ-ਦਹਾਨੀ: ${company} ਵੱਲੋਂ ਹਵਾਲਾ ${number}`,
    quoteCta: "ਹਵਾਲਾ ਵੇਖੋ ਅਤੇ ਮਨਜ਼ੂਰ ਕਰੋ",
    validUntil: (date) => `${date} ਤੱਕ ਵੈਧ`,

    invoiceSubject: (company, number, amount) =>
      `${company} ਵੱਲੋਂ ਬਿੱਲ ${number} — ${amount} ਬਾਕੀ`,
    invoiceIntro: (number) => `ਪੂਰੇ ਕੀਤੇ ਕੰਮ ਲਈ ਬਿੱਲ ${number} ਹਾਜ਼ਰ ਹੈ।`,
    invoiceIntroPartial: (number, paid) =>
      `ਪਹਿਲਾਂ ਮਿਲੇ ${paid} ਤੋਂ ਬਾਅਦ ਬਿੱਲ ${number} ਦਾ ਬਾਕੀ ਹਿੱਸਾ ਹਾਜ਼ਰ ਹੈ। ਧੰਨਵਾਦ।`,
    amountDue: "ਬਕਾਇਆ ਰਕਮ",
    balanceDue: "ਬਾਕੀ ਰਕਮ",
    due: (date) => `${date} ਤੱਕ ਭੁਗਤਾਨ`,
    wasDue: (date) => `${date} ਨੂੰ ਭੁਗਤਾਨ ਦੀ ਮਿਤੀ ਲੰਘ ਗਈ`,
    payCta: "ਆਨਲਾਈਨ ਭੁਗਤਾਨ ਕਰੋ",
    viewInvoiceCta: "ਆਪਣਾ ਬਿੱਲ ਵੇਖੋ",
    accepted: (methods) => `ਸਵੀਕਾਰ: ${methods}।`,

    reminderIntro: (number, amount) =>
      `ਯਾਦ-ਦਹਾਨੀ: ਬਿੱਲ ${number} ਦਾ ਬਾਕੀ ${amount} ਹੈ।`,
    reminderSubject: (amount, number) => `${amount} ਬਾਕੀ — ਬਿੱਲ ${number}`,
    arrangePayment: "ਭੁਗਤਾਨ ਦਾ ਪ੍ਰਬੰਧ ਕਰਨ ਲਈ ਕਿਰਪਾ ਕਰਕੇ ਸਾਡੇ ਨਾਲ ਸੰਪਰਕ ਕਰੋ।",

    referencesIntro: () =>
      "ਇਹ ਸਾਡੇ ਪਿਛਲੇ ਗਾਹਕ ਹਨ ਜਿਨ੍ਹਾਂ ਨੇ ਫ਼ੋਨ ਸੁਣਨ ਲਈ ਸਹਿਮਤੀ ਦਿੱਤੀ ਹੈ। ਇਨ੍ਹਾਂ ਵਿੱਚੋਂ ਕਿਸੇ ਨੂੰ ਵੀ ਫ਼ੋਨ ਕਰੋ ਅਤੇ ਪੁੱਛੋ ਕਿ ਸਾਡੇ ਨਾਲ ਕੰਮ ਕਰਵਾਉਣਾ ਕਿਹੋ ਜਿਹਾ ਰਿਹਾ।",
    beforeAfterIntro: () => "ਹਾਲ ਹੀ ਵਿੱਚ ਪੂਰੇ ਕੀਤੇ ਸਾਡੇ ਕੁਝ ਕੰਮ।",

    orPaste: "ਜਾਂ ਇਹ ਲਿੰਕ ਆਪਣੇ ਬ੍ਰਾਊਜ਼ਰ ਵਿੱਚ ਪਾਓ:",
    questions: (phone) =>
      phone
        ? `ਕੋਈ ਸਵਾਲ? ਇਸ ਈਮੇਲ ਦਾ ਜਵਾਬ ਦਿਓ ਜਾਂ ${phone} 'ਤੇ ਫ਼ੋਨ ਕਰੋ।`
        : "ਕੋਈ ਸਵਾਲ? ਇਸ ਈਮੇਲ ਦਾ ਜਵਾਬ ਦਿਓ।",
  },

  tl: {
    greeting: (name) => `Kumusta ${name},`,
    quoteIntro: () =>
      "Salamat sa pagkakataong makapagbigay ng quote para sa inyong proyekto. Nasa link sa ibaba ang lahat ng napag-usapan namin.",
    followUpIntro: () =>
      "Nagfo-follow up lang po kami sa quote na ipinadala namin — nandiyan pa rin ito kung kailan man ninyo gustong tingnan.",
    quoteSubject: (company, number) => `Ang inyong quote mula sa ${company} — ${number}`,
    followUpSubject: (company, number) =>
      `Follow-up: quote ${number} mula sa ${company}`,
    quoteCta: "Tingnan at aprubahan ang quote",
    validUntil: (date) => `Balido hanggang ${date}`,

    invoiceSubject: (company, number, amount) =>
      `Invoice ${number} mula sa ${company} — ${amount} ang babayaran`,
    invoiceIntro: (number) =>
      `Narito po ang invoice ${number} para sa natapos na trabaho.`,
    invoiceIntroPartial: (number, paid) =>
      `Narito po ang natitirang balanse sa invoice ${number}, matapos ang ${paid} na natanggap na namin. Maraming salamat.`,
    amountDue: "Halagang babayaran",
    balanceDue: "Natitirang balanse",
    due: (date) => `Dapat bayaran sa ${date}`,
    wasDue: (date) => `Dapat sana ay nabayaran noong ${date}`,
    payCta: "Magbayad online",
    viewInvoiceCta: "Tingnan ang invoice",
    accepted: (methods) => `Tinatanggap: ${methods}.`,

    reminderIntro: (number, amount) =>
      `Paalala po na ang invoice ${number} ay may balanseng ${amount}.`,
    reminderSubject: (amount, number) => `${amount} ang babayaran — invoice ${number}`,
    arrangePayment: "Makipag-ugnayan po sa amin para maayos ang bayad.",

    referencesIntro: () =>
      "Mga dating kliyente namin ang mga ito na pumayag na sagutin ang tawag ninyo. Tawagan ang alinman sa kanila at itanong kung kumusta kami sa loob ng bahay nila.",
    beforeAfterIntro: () =>
      "Ilan sa mga trabahong natapos namin kamakailan.",

    orPaste: "O i-paste ito sa inyong browser:",
    questions: (phone) =>
      phone
        ? `May tanong? I-reply lang po ito o tumawag sa ${phone}.`
        : "May tanong? I-reply lang po ang email na ito.",
  },
};

export const SUPPORTED_EMAIL_LANGUAGES = Object.keys(COPY);

/**
 * Copy for one language, falling back to English.
 *
 * Falls back rather than throwing: a language code we don't have yet must
 * produce a sendable English email, never a failed send. A client receiving
 * the wrong language is a papercut; a client receiving nothing is a lost job.
 */
export function emailCopy(language = "en") {
  return COPY[language] || COPY.en;
}
