// lib/i18n/emailCopy.js
//
// Every sentence a client reads in an email, in every language FieldQuo has
// document copy for. That is a superset of what the picker offers: de and it
// are complete here and in the other three document tables, waiting on the
// single line in app/i18n/languages.js that turns them on. See
// scripts/check-language-completeness.mjs for the whole nine-step list.
//
// ── Why this had to exist ───────────────────────────────────────────────────
//
// The documents were already translated — documentLabels.js covers the same
// set, and Quote.language is fixed at creation so a signed PDF keeps
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
    paidSubject: (company, number, amount) =>
      `Receipt from ${company} — ${amount} paid, invoice ${number}`,
    paidIntro: (number, amount) =>
      `${amount} has been collected for invoice ${number}, using the payment method you authorised. Nothing further is needed.`,
    amountPaid: "Amount paid",
    viewReceiptCta: "View your invoice",
    arrangePayment: "Please get in touch to arrange payment.",

    referencesIntro: () =>
      "These are past clients of ours who agreed to take a call. Ring any of them and ask what we were like to have in the house.",
    beforeAfterIntro: () => "A few of the jobs we've finished recently.",

    orPaste: "Or paste this into your browser:",
    questions: (phone) =>
      phone
        ? `Questions? Reply to this email or call ${phone}.`
        : "Questions? Reply to this email.",

    // ── The three booking letters: confirmed, moved, cancelled ──────────────
    //
    // These lived as English literals in app/admin/lib/email/templates.js while
    // the quote and invoice letters above were translated — a francophone
    // homeowner got a French quote and an English confirmation for the visit
    // about it. Nested under `visit` so check:language-completeness holds every
    // language to the same key list; the builders merge over English per key.
    visit: {
      // What a bare appointment is called when it has no event type and no
      // job title to name it by — "Your visit with Northline is confirmed".
      serviceFallback: "visit",
      confirmedSubject: (service, company) => `Confirmed: ${service} with ${company}`,
      confirmedHeadline: "You\u2019re booked in",
      confirmedIntro: (service, company) => `Your ${service} with ${company} is confirmed.`,
      aboutQuote: (ref) => `About your estimate ${ref}.`,
      when: "When",
      where: "Where",
      wasBookedFor: "Was booked for",
      newTime: "New time",
      previously: "Previously",
      client: "Client",
      email: "Email",
      manageCta: "Change or cancel this visit",
      changeViaLink: "Need to change or cancel? Use the link above \u2014 or just reply to this email.",
      changeViaReply: "Need to change or cancel? Just reply to this email.",

      cancelledSubject: (service, company) => `Cancelled: ${service} with ${company}`,
      cancelledHeadline: "Your visit is cancelled",
      cancelledByYou: (service, company) => `Your ${service} with ${company} has been cancelled, as requested.`,
      cancelledByOffice: (service, company) => `${company} has had to cancel your ${service}. Sorry for the change of plans.`,
      cancelledFootnoteByYou: "Changed your mind? Reply to this email and we\u2019ll find you another time.",
      cancelledFootnoteByOffice: "Reply to this email and we\u2019ll find you another time.",
      feeRefunded: (amount) => `Your ${amount} visit fee has been refunded to the card you paid with. Cards usually take a few working days to show it.`,
      feeAlreadyRefunded: (amount) => `The ${amount} visit fee was already refunded.`,
      feeNotThroughSystem: (amount) => `The ${amount} visit fee wasn\u2019t taken through this system, so it isn\u2019t returned automatically \u2014 reply to this email and we\u2019ll sort it out.`,
      feeNotReturned: (amount) => `The ${amount} visit fee isn\u2019t returned automatically. Reply to this email if you\u2019d like to talk about it.`,

      movedSubject: (service, company) => `Moved: ${service} with ${company}`,
      movedHeadline: "Your visit has moved",
      movedByYou: (service, company) => `Your ${service} with ${company} is now booked for a new time.`,
      movedByOffice: (service, company) => `${company} has moved your ${service} to a new time.`,
      movedFootnote: "Nothing else has changed \u2014 any visit fee you already paid still stands against this booking.",

      // The office's own copy, only when the CLIENT made the change.
      officeCancelledSubject: (client, when) => `Cancelled: ${client} \u2014 ${when}`,
      officeCancelledHeadline: "A booking was cancelled",
      officeCancelledIntro: (client, service) => `${client} cancelled their ${service} using the link in their confirmation email.`,
      officeFeeRefunded: (amount) => `The ${amount} visit fee was refunded automatically, per your cancellation policy.`,
      officeFeeNotRefunded: (amount) => `The ${amount} visit fee was NOT refunded.`,
      officeCancelledFootnote: "The slot is free again on your calendar.",
      officeMovedSubject: (client, when) => `Moved: ${client} \u2014 now ${when}`,
      officeMovedHeadline: "A booking moved",
      officeMovedIntro: (client, service) => `${client} moved their ${service} using the link in their confirmation email.`,
      officeMovedLine: "The old slot is free again and the new one is on your calendar.",
      officeMovedFootnote: "Any visit fee already paid carries over \u2014 nothing was charged or refunded.",
    },
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
    paidSubject: (company, number, amount) =>
      `Reçu de ${company} — ${amount} payé, facture ${number}`,
    paidIntro: (number, amount) =>
      `${amount} a été prélevé pour la facture ${number}, au moyen de paiement que vous avez autorisé. Aucune autre démarche n’est nécessaire.`,
    amountPaid: "Montant payé",
    viewReceiptCta: "Consulter votre facture",
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

    visit: {
      serviceFallback: "visite",
      confirmedSubject: (service, company) => `Confirmé : ${service} avec ${company}`,
      confirmedHeadline: "Votre rendez-vous est confirmé",
      confirmedIntro: (service, company) => `Votre ${service} avec ${company} est confirmé.`,
      aboutQuote: (ref) => `Concernant votre soumission ${ref}.`,
      when: "Quand",
      where: "Où",
      wasBookedFor: "Était prévu le",
      newTime: "Nouvelle heure",
      previously: "Précédemment",
      client: "Client",
      email: "Courriel",
      manageCta: "Modifier ou annuler cette visite",
      changeViaLink: "Besoin de modifier ou d\u2019annuler? Utilisez le lien ci-dessus \u2014 ou répondez simplement à ce courriel.",
      changeViaReply: "Besoin de modifier ou d\u2019annuler? Répondez simplement à ce courriel.",

      cancelledSubject: (service, company) => `Annulé : ${service} avec ${company}`,
      cancelledHeadline: "Votre visite est annulée",
      cancelledByYou: (service, company) => `Votre ${service} avec ${company} a été annulé, comme demandé.`,
      cancelledByOffice: (service, company) => `${company} a dû annuler votre ${service}. Désolé pour ce changement de plans.`,
      cancelledFootnoteByYou: "Vous avez changé d\u2019idée? Répondez à ce courriel et nous vous trouverons un autre moment.",
      cancelledFootnoteByOffice: "Répondez à ce courriel et nous vous trouverons un autre moment.",
      feeRefunded: (amount) => `Vos frais de visite de ${amount} ont été remboursés sur la carte utilisée. Le remboursement apparaît généralement après quelques jours ouvrables.`,
      feeAlreadyRefunded: (amount) => `Les frais de visite de ${amount} ont déjà été remboursés.`,
      feeNotThroughSystem: (amount) => `Les frais de visite de ${amount} n\u2019ont pas été perçus par ce système, ils ne sont donc pas remboursés automatiquement \u2014 répondez à ce courriel et nous réglerons cela.`,
      feeNotReturned: (amount) => `Les frais de visite de ${amount} ne sont pas remboursés automatiquement. Répondez à ce courriel si vous souhaitez en discuter.`,

      movedSubject: (service, company) => `Déplacé : ${service} avec ${company}`,
      movedHeadline: "Votre visite a été déplacée",
      movedByYou: (service, company) => `Votre ${service} avec ${company} est maintenant prévu à un nouveau moment.`,
      movedByOffice: (service, company) => `${company} a déplacé votre ${service} à un nouveau moment.`,
      movedFootnote: "Rien d\u2019autre n\u2019a changé \u2014 les frais de visite déjà payés restent appliqués à cette réservation.",

      officeCancelledSubject: (client, when) => `Annulé : ${client} \u2014 ${when}`,
      officeCancelledHeadline: "Une réservation a été annulée",
      officeCancelledIntro: (client, service) => `${client} a annulé son ${service} à partir du lien de son courriel de confirmation.`,
      officeFeeRefunded: (amount) => `Les frais de visite de ${amount} ont été remboursés automatiquement, selon votre politique d\u2019annulation.`,
      officeFeeNotRefunded: (amount) => `Les frais de visite de ${amount} n\u2019ont PAS été remboursés.`,
      officeCancelledFootnote: "La plage est de nouveau libre dans votre calendrier.",
      officeMovedSubject: (client, when) => `Déplacé : ${client} \u2014 maintenant ${when}`,
      officeMovedHeadline: "Une réservation a été déplacée",
      officeMovedIntro: (client, service) => `${client} a déplacé son ${service} à partir du lien de son courriel de confirmation.`,
      officeMovedLine: "L\u2019ancienne plage est de nouveau libre et la nouvelle est dans votre calendrier.",
      officeMovedFootnote: "Les frais de visite déjà payés sont reportés \u2014 rien n\u2019a été facturé ni remboursé.",
    },
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
    paidSubject: (company, number, amount) =>
      `Recibo de ${company} — ${amount} pagado, factura ${number}`,
    paidIntro: (number, amount) =>
      `Se ha cobrado ${amount} de la factura ${number} con el método de pago que usted autorizó. No hace falta nada más.`,
    amountPaid: "Importe pagado",
    viewReceiptCta: "Ver su factura",
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

    visit: {
      serviceFallback: "visita",
      confirmedSubject: (service, company) => `Confirmado: ${service} con ${company}`,
      confirmedHeadline: "Su cita está confirmada",
      confirmedIntro: (service, company) => `Su ${service} con ${company} está confirmado.`,
      aboutQuote: (ref) => `Sobre su presupuesto ${ref}.`,
      when: "Cuándo",
      where: "Dónde",
      wasBookedFor: "Estaba programado para",
      newTime: "Nueva hora",
      previously: "Anteriormente",
      client: "Cliente",
      email: "Correo",
      manageCta: "Cambiar o cancelar esta visita",
      changeViaLink: "¿Necesita cambiar o cancelar? Use el enlace de arriba, o simplemente responda a este correo.",
      changeViaReply: "¿Necesita cambiar o cancelar? Simplemente responda a este correo.",

      cancelledSubject: (service, company) => `Cancelado: ${service} con ${company}`,
      cancelledHeadline: "Su visita fue cancelada",
      cancelledByYou: (service, company) => `Su ${service} con ${company} fue cancelado, como solicitó.`,
      cancelledByOffice: (service, company) => `${company} tuvo que cancelar su ${service}. Disculpe el cambio de planes.`,
      cancelledFootnoteByYou: "¿Cambió de opinión? Responda a este correo y le buscaremos otro horario.",
      cancelledFootnoteByOffice: "Responda a este correo y le buscaremos otro horario.",
      feeRefunded: (amount) => `Su cargo por visita de ${amount} fue reembolsado a la tarjeta con la que pagó. Suele tardar unos días hábiles en reflejarse.`,
      feeAlreadyRefunded: (amount) => `El cargo por visita de ${amount} ya había sido reembolsado.`,
      feeNotThroughSystem: (amount) => `El cargo por visita de ${amount} no se cobró por este sistema, así que no se devuelve automáticamente. Responda a este correo y lo resolvemos.`,
      feeNotReturned: (amount) => `El cargo por visita de ${amount} no se devuelve automáticamente. Responda a este correo si quiere hablar de ello.`,

      movedSubject: (service, company) => `Cambio de fecha: ${service} con ${company}`,
      movedHeadline: "Su visita cambió de fecha",
      movedByYou: (service, company) => `Su ${service} con ${company} ahora está programado para una nueva hora.`,
      movedByOffice: (service, company) => `${company} cambió su ${service} a una nueva hora.`,
      movedFootnote: "Nada más ha cambiado: cualquier cargo por visita que ya pagó sigue aplicado a esta reserva.",

      officeCancelledSubject: (client, when) => `Cancelado: ${client} \u2014 ${when}`,
      officeCancelledHeadline: "Se canceló una reserva",
      officeCancelledIntro: (client, service) => `${client} canceló su ${service} usando el enlace de su correo de confirmación.`,
      officeFeeRefunded: (amount) => `El cargo por visita de ${amount} se reembolsó automáticamente, según su política de cancelación.`,
      officeFeeNotRefunded: (amount) => `El cargo por visita de ${amount} NO fue reembolsado.`,
      officeCancelledFootnote: "El horario vuelve a estar libre en su calendario.",
      officeMovedSubject: (client, when) => `Cambio de fecha: ${client} \u2014 ahora ${when}`,
      officeMovedHeadline: "Una reserva cambió de fecha",
      officeMovedIntro: (client, service) => `${client} cambió su ${service} usando el enlace de su correo de confirmación.`,
      officeMovedLine: "El horario anterior vuelve a estar libre y el nuevo ya está en su calendario.",
      officeMovedFootnote: "Cualquier cargo por visita ya pagado se traslada: no se cobró ni se reembolsó nada.",
    },
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
    paidSubject: (company, number, amount) =>
      `Квитанція від ${company} — сплачено ${amount}, рахунок ${number}`,
    paidIntro: (number, amount) =>
      `За рахунком ${number} стягнено ${amount} за допомогою платіжного засобу, який ви дозволили. Більше нічого робити не потрібно.`,
    amountPaid: "Сплачено",
    viewReceiptCta: "Переглянути рахунок",
    arrangePayment: "Будь ласка, зв\u2019яжіться з нами, щоб домовитися про оплату.",

    referencesIntro: () =>
      "Це наші попередні клієнти, які погодилися відповісти на дзвінок. Зателефонуйте будь-кому з них і запитайте, як їм працювалося з нами.",
    beforeAfterIntro: () => "Кілька робіт, які ми нещодавно завершили.",

    orPaste: "Або скопіюйте це посилання у браузер:",
    questions: (phone) =>
      phone
        ? `Питання? Відповідайте на цей лист або телефонуйте ${phone}.`
        : "Питання? Просто відповідайте на цей лист.",

    visit: {
      serviceFallback: "візит",
      confirmedSubject: (service, company) => `Підтверджено: ${service} з ${company}`,
      confirmedHeadline: "Ваш візит заброньовано",
      confirmedIntro: (service, company) => `Ваш візит «${service}» з ${company} підтверджено.`,
      aboutQuote: (ref) => `Щодо вашого кошторису ${ref}.`,
      when: "Коли",
      where: "Де",
      wasBookedFor: "Було заплановано на",
      newTime: "Новий час",
      previously: "Раніше",
      client: "Клієнт",
      email: "Ел. пошта",
      manageCta: "Змінити або скасувати цей візит",
      changeViaLink: "Потрібно змінити або скасувати? Скористайтеся посиланням вище \u2014 або просто відповідайте на цей лист.",
      changeViaReply: "Потрібно змінити або скасувати? Просто відповідайте на цей лист.",

      cancelledSubject: (service, company) => `Скасовано: ${service} з ${company}`,
      cancelledHeadline: "Ваш візит скасовано",
      cancelledByYou: (service, company) => `Ваш візит «${service}» з ${company} скасовано на ваше прохання.`,
      cancelledByOffice: (service, company) => `${company} змушені скасувати ваш візит «${service}». Перепрошуємо за зміну планів.`,
      cancelledFootnoteByYou: "Передумали? Відповідайте на цей лист, і ми підберемо інший час.",
      cancelledFootnoteByOffice: "Відповідайте на цей лист, і ми підберемо інший час.",
      feeRefunded: (amount) => `Плату за візит ${amount} повернуто на картку, з якої ви платили. Зазвичай кошти надходять протягом кількох робочих днів.`,
      feeAlreadyRefunded: (amount) => `Плату за візит ${amount} уже було повернуто.`,
      feeNotThroughSystem: (amount) => `Плату за візит ${amount} було прийнято не через цю систему, тому вона не повертається автоматично \u2014 відповідайте на цей лист, і ми все вирішимо.`,
      feeNotReturned: (amount) => `Плата за візит ${amount} не повертається автоматично. Відповідайте на цей лист, якщо хочете це обговорити.`,

      movedSubject: (service, company) => `Перенесено: ${service} з ${company}`,
      movedHeadline: "Ваш візит перенесено",
      movedByYou: (service, company) => `Ваш візит «${service}» з ${company} тепер заплановано на новий час.`,
      movedByOffice: (service, company) => `${company} перенесли ваш візит «${service}» на новий час.`,
      movedFootnote: "Більше нічого не змінилося \u2014 уже сплачена плата за візит залишається за цим бронюванням.",

      officeCancelledSubject: (client, when) => `Скасовано: ${client} \u2014 ${when}`,
      officeCancelledHeadline: "Бронювання скасовано",
      officeCancelledIntro: (client, service) => `${client} скасував(ла) свій візит «${service}» за посиланням із листа-підтвердження.`,
      officeFeeRefunded: (amount) => `Плату за візит ${amount} повернуто автоматично згідно з вашою політикою скасування.`,
      officeFeeNotRefunded: (amount) => `Плату за візит ${amount} НЕ було повернуто.`,
      officeCancelledFootnote: "Цей час знову вільний у вашому календарі.",
      officeMovedSubject: (client, when) => `Перенесено: ${client} \u2014 тепер ${when}`,
      officeMovedHeadline: "Бронювання перенесено",
      officeMovedIntro: (client, service) => `${client} переніс(ла) свій візит «${service}» за посиланням із листа-підтвердження.`,
      officeMovedLine: "Старий час знову вільний, а новий уже у вашому календарі.",
      officeMovedFootnote: "Уже сплачена плата за візит переноситься \u2014 нічого не списано й не повернуто.",
    },
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
    paidSubject: (company, number, amount) =>
      `${company} ਵੱਲੋਂ ਰਸੀਦ — ${amount} ਅਦਾ ਹੋਇਆ, ਬਿੱਲ ${number}`,
    paidIntro: (number, amount) =>
      `ਬਿੱਲ ${number} ਲਈ ${amount} ਉਸ ਭੁਗਤਾਨ ਢੰਗ ਤੋਂ ਲਿਆ ਗਿਆ ਹੈ ਜਿਸ ਦੀ ਤੁਸੀਂ ਇਜਾਜ਼ਤ ਦਿੱਤੀ ਸੀ। ਹੋਰ ਕੁਝ ਕਰਨ ਦੀ ਲੋੜ ਨਹੀਂ।`,
    amountPaid: "ਅਦਾ ਕੀਤੀ ਰਕਮ",
    viewReceiptCta: "ਆਪਣਾ ਬਿੱਲ ਵੇਖੋ",
    arrangePayment: "ਭੁਗਤਾਨ ਦਾ ਪ੍ਰਬੰਧ ਕਰਨ ਲਈ ਕਿਰਪਾ ਕਰਕੇ ਸਾਡੇ ਨਾਲ ਸੰਪਰਕ ਕਰੋ।",

    referencesIntro: () =>
      "ਇਹ ਸਾਡੇ ਪਿਛਲੇ ਗਾਹਕ ਹਨ ਜਿਨ੍ਹਾਂ ਨੇ ਫ਼ੋਨ ਸੁਣਨ ਲਈ ਸਹਿਮਤੀ ਦਿੱਤੀ ਹੈ। ਇਨ੍ਹਾਂ ਵਿੱਚੋਂ ਕਿਸੇ ਨੂੰ ਵੀ ਫ਼ੋਨ ਕਰੋ ਅਤੇ ਪੁੱਛੋ ਕਿ ਸਾਡੇ ਨਾਲ ਕੰਮ ਕਰਵਾਉਣਾ ਕਿਹੋ ਜਿਹਾ ਰਿਹਾ।",
    beforeAfterIntro: () => "ਹਾਲ ਹੀ ਵਿੱਚ ਪੂਰੇ ਕੀਤੇ ਸਾਡੇ ਕੁਝ ਕੰਮ।",

    orPaste: "ਜਾਂ ਇਹ ਲਿੰਕ ਆਪਣੇ ਬ੍ਰਾਊਜ਼ਰ ਵਿੱਚ ਪਾਓ:",
    questions: (phone) =>
      phone
        ? `ਕੋਈ ਸਵਾਲ? ਇਸ ਈਮੇਲ ਦਾ ਜਵਾਬ ਦਿਓ ਜਾਂ ${phone} 'ਤੇ ਫ਼ੋਨ ਕਰੋ।`
        : "ਕੋਈ ਸਵਾਲ? ਇਸ ਈਮੇਲ ਦਾ ਜਵਾਬ ਦਿਓ।",

    visit: {
      serviceFallback: "ਮੁਲਾਕਾਤ",
      confirmedSubject: (service, company) => `ਪੱਕਾ ਹੋਇਆ: ${company} ਨਾਲ ${service}`,
      confirmedHeadline: "ਤੁਹਾਡੀ ਬੁਕਿੰਗ ਪੱਕੀ ਹੈ",
      confirmedIntro: (service, company) => `${company} ਨਾਲ ਤੁਹਾਡੀ ${service} ਪੱਕੀ ਹੋ ਗਈ ਹੈ।`,
      aboutQuote: (ref) => `ਤੁਹਾਡੇ ਅੰਦਾਜ਼ੇ ${ref} ਬਾਰੇ।`,
      when: "ਕਦੋਂ",
      where: "ਕਿੱਥੇ",
      wasBookedFor: "ਇਸ ਸਮੇਂ ਲਈ ਬੁੱਕ ਸੀ",
      newTime: "ਨਵਾਂ ਸਮਾਂ",
      previously: "ਪਹਿਲਾਂ",
      client: "ਗਾਹਕ",
      email: "ਈਮੇਲ",
      manageCta: "ਇਹ ਮੁਲਾਕਾਤ ਬਦਲੋ ਜਾਂ ਰੱਦ ਕਰੋ",
      changeViaLink: "ਬਦਲਣਾ ਜਾਂ ਰੱਦ ਕਰਨਾ ਹੈ? ਉੱਪਰਲਾ ਲਿੰਕ ਵਰਤੋ \u2014 ਜਾਂ ਬੱਸ ਇਸ ਈਮੇਲ ਦਾ ਜਵਾਬ ਦਿਓ।",
      changeViaReply: "ਬਦਲਣਾ ਜਾਂ ਰੱਦ ਕਰਨਾ ਹੈ? ਬੱਸ ਇਸ ਈਮੇਲ ਦਾ ਜਵਾਬ ਦਿਓ।",

      cancelledSubject: (service, company) => `ਰੱਦ: ${company} ਨਾਲ ${service}`,
      cancelledHeadline: "ਤੁਹਾਡੀ ਮੁਲਾਕਾਤ ਰੱਦ ਹੋ ਗਈ ਹੈ",
      cancelledByYou: (service, company) => `${company} ਨਾਲ ਤੁਹਾਡੀ ${service} ਤੁਹਾਡੀ ਬੇਨਤੀ 'ਤੇ ਰੱਦ ਕਰ ਦਿੱਤੀ ਗਈ ਹੈ।`,
      cancelledByOffice: (service, company) => `${company} ਨੂੰ ਤੁਹਾਡੀ ${service} ਰੱਦ ਕਰਨੀ ਪਈ ਹੈ। ਯੋਜਨਾ ਬਦਲਣ ਲਈ ਮੁਆਫ਼ੀ।`,
      cancelledFootnoteByYou: "ਮਨ ਬਦਲ ਗਿਆ? ਇਸ ਈਮੇਲ ਦਾ ਜਵਾਬ ਦਿਓ, ਅਸੀਂ ਤੁਹਾਡੇ ਲਈ ਹੋਰ ਸਮਾਂ ਲੱਭ ਲਵਾਂਗੇ।",
      cancelledFootnoteByOffice: "ਇਸ ਈਮੇਲ ਦਾ ਜਵਾਬ ਦਿਓ, ਅਸੀਂ ਤੁਹਾਡੇ ਲਈ ਹੋਰ ਸਮਾਂ ਲੱਭ ਲਵਾਂਗੇ।",
      feeRefunded: (amount) => `ਤੁਹਾਡੀ ${amount} ਦੀ ਮੁਲਾਕਾਤ ਫ਼ੀਸ ਉਸੇ ਕਾਰਡ 'ਤੇ ਵਾਪਸ ਕਰ ਦਿੱਤੀ ਗਈ ਹੈ ਜਿਸ ਨਾਲ ਤੁਸੀਂ ਭੁਗਤਾਨ ਕੀਤਾ ਸੀ। ਆਮ ਤੌਰ 'ਤੇ ਕੁਝ ਕੰਮਕਾਜੀ ਦਿਨ ਲੱਗਦੇ ਹਨ।`,
      feeAlreadyRefunded: (amount) => `${amount} ਦੀ ਮੁਲਾਕਾਤ ਫ਼ੀਸ ਪਹਿਲਾਂ ਹੀ ਵਾਪਸ ਕੀਤੀ ਜਾ ਚੁੱਕੀ ਹੈ।`,
      feeNotThroughSystem: (amount) => `${amount} ਦੀ ਮੁਲਾਕਾਤ ਫ਼ੀਸ ਇਸ ਸਿਸਟਮ ਰਾਹੀਂ ਨਹੀਂ ਲਈ ਗਈ ਸੀ, ਇਸ ਲਈ ਇਹ ਆਪਣੇ ਆਪ ਵਾਪਸ ਨਹੀਂ ਹੁੰਦੀ \u2014 ਇਸ ਈਮੇਲ ਦਾ ਜਵਾਬ ਦਿਓ, ਅਸੀਂ ਇਸ ਨੂੰ ਸੁਲਝਾ ਲਵਾਂਗੇ।`,
      feeNotReturned: (amount) => `${amount} ਦੀ ਮੁਲਾਕਾਤ ਫ਼ੀਸ ਆਪਣੇ ਆਪ ਵਾਪਸ ਨਹੀਂ ਹੁੰਦੀ। ਜੇ ਤੁਸੀਂ ਇਸ ਬਾਰੇ ਗੱਲ ਕਰਨਾ ਚਾਹੁੰਦੇ ਹੋ ਤਾਂ ਇਸ ਈਮੇਲ ਦਾ ਜਵਾਬ ਦਿਓ।`,

      movedSubject: (service, company) => `ਸਮਾਂ ਬਦਲਿਆ: ${company} ਨਾਲ ${service}`,
      movedHeadline: "ਤੁਹਾਡੀ ਮੁਲਾਕਾਤ ਦਾ ਸਮਾਂ ਬਦਲ ਗਿਆ ਹੈ",
      movedByYou: (service, company) => `${company} ਨਾਲ ਤੁਹਾਡੀ ${service} ਹੁਣ ਨਵੇਂ ਸਮੇਂ ਲਈ ਬੁੱਕ ਹੈ।`,
      movedByOffice: (service, company) => `${company} ਨੇ ਤੁਹਾਡੀ ${service} ਨੂੰ ਨਵੇਂ ਸਮੇਂ 'ਤੇ ਕਰ ਦਿੱਤਾ ਹੈ।`,
      movedFootnote: "ਹੋਰ ਕੁਝ ਨਹੀਂ ਬਦਲਿਆ \u2014 ਜੋ ਮੁਲਾਕਾਤ ਫ਼ੀਸ ਤੁਸੀਂ ਪਹਿਲਾਂ ਭਰੀ ਹੈ, ਉਹ ਇਸੇ ਬੁਕਿੰਗ 'ਤੇ ਲਾਗੂ ਰਹਿੰਦੀ ਹੈ।",

      officeCancelledSubject: (client, when) => `ਰੱਦ: ${client} \u2014 ${when}`,
      officeCancelledHeadline: "ਇੱਕ ਬੁਕਿੰਗ ਰੱਦ ਹੋਈ",
      officeCancelledIntro: (client, service) => `${client} ਨੇ ਆਪਣੀ ਪੁਸ਼ਟੀ ਈਮੇਲ ਦੇ ਲਿੰਕ ਰਾਹੀਂ ਆਪਣੀ ${service} ਰੱਦ ਕਰ ਦਿੱਤੀ।`,
      officeFeeRefunded: (amount) => `ਤੁਹਾਡੀ ਰੱਦ ਕਰਨ ਦੀ ਨੀਤੀ ਅਨੁਸਾਰ ${amount} ਦੀ ਮੁਲਾਕਾਤ ਫ਼ੀਸ ਆਪਣੇ ਆਪ ਵਾਪਸ ਕਰ ਦਿੱਤੀ ਗਈ।`,
      officeFeeNotRefunded: (amount) => `${amount} ਦੀ ਮੁਲਾਕਾਤ ਫ਼ੀਸ ਵਾਪਸ ਨਹੀਂ ਕੀਤੀ ਗਈ।`,
      officeCancelledFootnote: "ਇਹ ਸਮਾਂ ਤੁਹਾਡੇ ਕੈਲੰਡਰ ਵਿੱਚ ਫਿਰ ਖਾਲੀ ਹੈ।",
      officeMovedSubject: (client, when) => `ਸਮਾਂ ਬਦਲਿਆ: ${client} \u2014 ਹੁਣ ${when}`,
      officeMovedHeadline: "ਇੱਕ ਬੁਕਿੰਗ ਦਾ ਸਮਾਂ ਬਦਲਿਆ",
      officeMovedIntro: (client, service) => `${client} ਨੇ ਆਪਣੀ ਪੁਸ਼ਟੀ ਈਮੇਲ ਦੇ ਲਿੰਕ ਰਾਹੀਂ ਆਪਣੀ ${service} ਦਾ ਸਮਾਂ ਬਦਲ ਲਿਆ।`,
      officeMovedLine: "ਪੁਰਾਣਾ ਸਮਾਂ ਫਿਰ ਖਾਲੀ ਹੈ ਅਤੇ ਨਵਾਂ ਤੁਹਾਡੇ ਕੈਲੰਡਰ ਵਿੱਚ ਹੈ।",
      officeMovedFootnote: "ਪਹਿਲਾਂ ਭਰੀ ਮੁਲਾਕਾਤ ਫ਼ੀਸ ਅੱਗੇ ਲਾਗੂ ਰਹਿੰਦੀ ਹੈ \u2014 ਨਾ ਕੁਝ ਲਿਆ ਗਿਆ, ਨਾ ਵਾਪਸ ਕੀਤਾ ਗਿਆ।",
    },
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
    paidSubject: (company, number, amount) =>
      `Resibo mula sa ${company} — ${amount} na bayad, invoice ${number}`,
    paidIntro: (number, amount) =>
      `Nakolekta na ang ${amount} para sa invoice ${number} gamit ang paraan ng pagbabayad na inyong pinahintulutan. Wala na pong kailangang gawin.`,
    amountPaid: "Halagang binayaran",
    viewReceiptCta: "Tingnan ang invoice",
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

    visit: {
      serviceFallback: "pagbisita",
      confirmedSubject: (service, company) => `Kumpirmado: ${service} sa ${company}`,
      confirmedHeadline: "Naka-book ka na",
      confirmedIntro: (service, company) => `Kumpirmado na ang iyong ${service} sa ${company}.`,
      aboutQuote: (ref) => `Tungkol sa iyong estimate ${ref}.`,
      when: "Kailan",
      where: "Saan",
      wasBookedFor: "Naka-book dati para sa",
      newTime: "Bagong oras",
      previously: "Dati",
      client: "Kliyente",
      email: "Email",
      manageCta: "Baguhin o kanselahin ang pagbisitang ito",
      changeViaLink: "Kailangang baguhin o kanselahin? Gamitin ang link sa itaas \u2014 o mag-reply lang sa email na ito.",
      changeViaReply: "Kailangang baguhin o kanselahin? Mag-reply lang sa email na ito.",

      cancelledSubject: (service, company) => `Kanselado: ${service} sa ${company}`,
      cancelledHeadline: "Kanselado na ang iyong pagbisita",
      cancelledByYou: (service, company) => `Kanselado na ang iyong ${service} sa ${company}, ayon sa iyong kahilingan.`,
      cancelledByOffice: (service, company) => `Kinailangang kanselahin ng ${company} ang iyong ${service}. Paumanhin sa pagbabago ng plano.`,
      cancelledFootnoteByYou: "Nagbago ang isip? Mag-reply sa email na ito at hahanapan ka namin ng ibang oras.",
      cancelledFootnoteByOffice: "Mag-reply sa email na ito at hahanapan ka namin ng ibang oras.",
      feeRefunded: (amount) => `Naibalik na ang iyong ${amount} na bayad sa pagbisita sa card na ginamit mo. Karaniwang lumalabas ito pagkalipas ng ilang araw ng trabaho.`,
      feeAlreadyRefunded: (amount) => `Naibalik na dati ang ${amount} na bayad sa pagbisita.`,
      feeNotThroughSystem: (amount) => `Hindi dumaan sa sistemang ito ang ${amount} na bayad sa pagbisita, kaya hindi ito awtomatikong naibabalik \u2014 mag-reply sa email na ito at aayusin namin.`,
      feeNotReturned: (amount) => `Hindi awtomatikong naibabalik ang ${amount} na bayad sa pagbisita. Mag-reply sa email na ito kung nais mo itong pag-usapan.`,

      movedSubject: (service, company) => `Inilipat: ${service} sa ${company}`,
      movedHeadline: "Inilipat ang iyong pagbisita",
      movedByYou: (service, company) => `Naka-book na sa bagong oras ang iyong ${service} sa ${company}.`,
      movedByOffice: (service, company) => `Inilipat ng ${company} ang iyong ${service} sa bagong oras.`,
      movedFootnote: "Wala nang ibang nagbago \u2014 ang anumang bayad sa pagbisita na naibigay mo na ay nananatili sa booking na ito.",

      officeCancelledSubject: (client, when) => `Kanselado: ${client} \u2014 ${when}`,
      officeCancelledHeadline: "May kinanselang booking",
      officeCancelledIntro: (client, service) => `Kinansela ni ${client} ang kanilang ${service} gamit ang link sa kanilang confirmation email.`,
      officeFeeRefunded: (amount) => `Awtomatikong naibalik ang ${amount} na bayad sa pagbisita, ayon sa iyong patakaran sa pagkansela.`,
      officeFeeNotRefunded: (amount) => `HINDI naibalik ang ${amount} na bayad sa pagbisita.`,
      officeCancelledFootnote: "Libre na ulit ang oras na iyon sa iyong kalendaryo.",
      officeMovedSubject: (client, when) => `Inilipat: ${client} \u2014 ngayon ay ${when}`,
      officeMovedHeadline: "May inilipat na booking",
      officeMovedIntro: (client, service) => `Inilipat ni ${client} ang kanilang ${service} gamit ang link sa kanilang confirmation email.`,
      officeMovedLine: "Libre na ulit ang lumang oras at nasa kalendaryo mo na ang bago.",
      officeMovedFootnote: "Dala-dala ang anumang bayad sa pagbisita na naibigay na \u2014 walang siningil o naibalik.",
    },
  },

  // ── German, formal ──────────────────────────────────────────────────────
  //
  // `Sie` throughout. The money words are the ones documentLabels.js uses on
  // the document this email carries — "Offener Saldo", "Gezahlter Betrag" —
  // so the covering note and the attachment do not name the same figure two
  // different ways.
  //
  // Buttons are infinitives, the same shape fr and es already use here and
  // the natural one in German ("Online bezahlen", not "Bezahlen Sie online").
  de: {
    greeting: (name) => `Guten Tag ${name},`,
    quoteIntro: () =>
      "Vielen Dank, dass wir für Ihr Projekt ein Angebot abgeben durften. Alles, worüber wir gesprochen haben, finden Sie unter dem Link unten.",
    followUpIntro: () =>
      "Eine kurze Nachfrage zu dem Angebot, das wir Ihnen geschickt haben — Sie können es sich weiterhin in Ruhe ansehen, wann immer es Ihnen passt.",
    quoteSubject: (company, number) => `Ihr Angebot von ${company} — ${number}`,
    followUpSubject: (company, number) =>
      `Nachfrage: Angebot ${number} von ${company}`,
    quoteCta: "Angebot ansehen und annehmen",
    validUntil: (date) => `Gültig bis ${date}`,

    invoiceSubject: (company, number, amount) =>
      `Rechnung ${number} von ${company} — ${amount} fällig`,
    invoiceIntro: (number) =>
      `Hier ist die Rechnung ${number} für die ausgeführten Arbeiten.`,
    invoiceIntroPartial: (number, paid) =>
      `Hier ist der offene Saldo der Rechnung ${number}, nach den bereits erhaltenen ${paid}. Vielen Dank dafür.`,
    amountDue: "Fälliger Betrag",
    balanceDue: "Offener Saldo",
    due: (date) => `Fällig am ${date}`,
    wasDue: (date) => `War fällig am ${date}`,
    payCta: "Online bezahlen",
    viewInvoiceCta: "Ihre Rechnung ansehen",
    accepted: (methods) => `Akzeptierte Zahlungsmethoden: ${methods}.`,

    reminderIntro: (number, amount) =>
      `Zur Erinnerung: Auf der Rechnung ${number} steht noch ein Saldo von ${amount} offen.`,
    reminderSubject: (amount, number) => `${amount} fällig — Rechnung ${number}`,
    paidSubject: (company, number, amount) =>
      `Beleg von ${company} — ${amount} bezahlt, Rechnung ${number}`,
    paidIntro: (number, amount) =>
      `${amount} wurden für die Rechnung ${number} über die von Ihnen freigegebene Zahlungsmethode eingezogen. Weitere Schritte sind nicht nötig.`,
    amountPaid: "Gezahlter Betrag",
    viewReceiptCta: "Ihre Rechnung ansehen",
    arrangePayment:
      "Bitte melden Sie sich bei uns, um die Zahlung zu vereinbaren.",

    referencesIntro: () =>
      "Das sind frühere Kunden von uns, die einem Anruf zugestimmt haben. Rufen Sie eine oder einen davon an und fragen Sie, wie es war, uns im Haus zu haben.",
    beforeAfterIntro: () =>
      "Einige Aufträge, die wir kürzlich abgeschlossen haben.",

    orPaste: "Oder kopieren Sie diesen Link in Ihren Browser:",
    questions: (phone) =>
      phone
        ? `Fragen? Antworten Sie auf diese E-Mail oder rufen Sie ${phone} an.`
        : "Fragen? Antworten Sie einfach auf diese E-Mail.",

    visit: {
      serviceFallback: "Termin",
      confirmedSubject: (service, company) => `Bestätigt: ${service} mit ${company}`,
      confirmedHeadline: "Ihr Termin ist gebucht",
      confirmedIntro: (service, company) => `Ihr Termin „${service}“ mit ${company} ist bestätigt.`,
      aboutQuote: (ref) => `Zu Ihrem Angebot ${ref}.`,
      when: "Wann",
      where: "Wo",
      wasBookedFor: "War gebucht für",
      newTime: "Neue Zeit",
      previously: "Bisher",
      client: "Kunde",
      email: "E-Mail",
      manageCta: "Diesen Termin ändern oder absagen",
      changeViaLink: "Möchten Sie ändern oder absagen? Nutzen Sie den Link oben \u2014 oder antworten Sie einfach auf diese E-Mail.",
      changeViaReply: "Möchten Sie ändern oder absagen? Antworten Sie einfach auf diese E-Mail.",

      cancelledSubject: (service, company) => `Abgesagt: ${service} mit ${company}`,
      cancelledHeadline: "Ihr Termin ist abgesagt",
      cancelledByYou: (service, company) => `Ihr Termin „${service}“ mit ${company} wurde wie gewünscht abgesagt.`,
      cancelledByOffice: (service, company) => `${company} musste Ihren Termin „${service}“ leider absagen. Entschuldigen Sie die Planänderung.`,
      cancelledFootnoteByYou: "Anders überlegt? Antworten Sie auf diese E-Mail, und wir finden einen neuen Termin.",
      cancelledFootnoteByOffice: "Antworten Sie auf diese E-Mail, und wir finden einen neuen Termin.",
      feeRefunded: (amount) => `Ihre Anfahrtsgebühr von ${amount} wurde auf die verwendete Karte erstattet. Die Gutschrift erscheint meist nach einigen Werktagen.`,
      feeAlreadyRefunded: (amount) => `Die Anfahrtsgebühr von ${amount} wurde bereits erstattet.`,
      feeNotThroughSystem: (amount) => `Die Anfahrtsgebühr von ${amount} wurde nicht über dieses System eingezogen und wird daher nicht automatisch erstattet \u2014 antworten Sie auf diese E-Mail, und wir klären das.`,
      feeNotReturned: (amount) => `Die Anfahrtsgebühr von ${amount} wird nicht automatisch erstattet. Antworten Sie auf diese E-Mail, wenn Sie darüber sprechen möchten.`,

      movedSubject: (service, company) => `Verschoben: ${service} mit ${company}`,
      movedHeadline: "Ihr Termin wurde verschoben",
      movedByYou: (service, company) => `Ihr Termin „${service}“ mit ${company} ist jetzt für eine neue Zeit gebucht.`,
      movedByOffice: (service, company) => `${company} hat Ihren Termin „${service}“ auf eine neue Zeit verschoben.`,
      movedFootnote: "Sonst hat sich nichts geändert \u2014 eine bereits gezahlte Anfahrtsgebühr gilt weiterhin für diese Buchung.",

      officeCancelledSubject: (client, when) => `Abgesagt: ${client} \u2014 ${when}`,
      officeCancelledHeadline: "Eine Buchung wurde abgesagt",
      officeCancelledIntro: (client, service) => `${client} hat den Termin „${service}“ über den Link in der Bestätigungs-E-Mail abgesagt.`,
      officeFeeRefunded: (amount) => `Die Anfahrtsgebühr von ${amount} wurde gemäß Ihrer Stornobedingungen automatisch erstattet.`,
      officeFeeNotRefunded: (amount) => `Die Anfahrtsgebühr von ${amount} wurde NICHT erstattet.`,
      officeCancelledFootnote: "Der Termin ist in Ihrem Kalender wieder frei.",
      officeMovedSubject: (client, when) => `Verschoben: ${client} \u2014 jetzt ${when}`,
      officeMovedHeadline: "Eine Buchung wurde verschoben",
      officeMovedIntro: (client, service) => `${client} hat den Termin „${service}“ über den Link in der Bestätigungs-E-Mail verschoben.`,
      officeMovedLine: "Die alte Zeit ist wieder frei, die neue steht in Ihrem Kalender.",
      officeMovedFootnote: "Eine bereits gezahlte Anfahrtsgebühr wird übernommen \u2014 nichts wurde berechnet oder erstattet.",
    },
  },

  // ── Italian, formal ─────────────────────────────────────────────────────
  //
  // `Lei` throughout in the prose. The buttons are infinitives rather than
  // imperatives, which is what fr and es do above and which sidesteps the
  // tu/Lei choice entirely — an over-familiar "Paga online" to a stranger is
  // the one register mistake a homeowner would actually notice.
  it: {
    greeting: (name) => `Buongiorno ${name},`,
    quoteIntro: () =>
      "Grazie per averci dato la possibilità di preparare un preventivo per il suo progetto. Tutto quello di cui abbiamo parlato si trova al link qui sotto.",
    followUpIntro: () =>
      "Un breve promemoria sul preventivo che le abbiamo inviato — resta disponibile da consultare quando preferisce.",
    quoteSubject: (company, number) => `Il suo preventivo di ${company} — ${number}`,
    followUpSubject: (company, number) =>
      `Promemoria: preventivo ${number} di ${company}`,
    quoteCta: "Visualizzare e approvare il preventivo",
    validUntil: (date) => `Valido fino al ${date}`,

    invoiceSubject: (company, number, amount) =>
      `Fattura ${number} di ${company} — ${amount} da pagare`,
    invoiceIntro: (number) =>
      `Ecco la fattura ${number} per i lavori eseguiti.`,
    invoiceIntroPartial: (number, paid) =>
      `Ecco il saldo della fattura ${number}, dopo i ${paid} già ricevuti. Grazie.`,
    amountDue: "Importo da pagare",
    balanceDue: "Saldo da pagare",
    due: (date) => `Scadenza ${date}`,
    wasDue: (date) => `Scaduta il ${date}`,
    payCta: "Pagare online",
    viewInvoiceCta: "Visualizzare la fattura",
    accepted: (methods) => `Metodi di pagamento accettati: ${methods}.`,

    reminderIntro: (number, amount) =>
      `Un promemoria: la fattura ${number} ha un saldo di ${amount}.`,
    reminderSubject: (amount, number) => `${amount} da pagare — fattura ${number}`,
    paidSubject: (company, number, amount) =>
      `Ricevuta di ${company} — ${amount} pagati, fattura ${number}`,
    paidIntro: (number, amount) =>
      `Sono stati incassati ${amount} per la fattura ${number}, con il metodo di pagamento che ha autorizzato. Non serve altro.`,
    amountPaid: "Importo pagato",
    viewReceiptCta: "Visualizzare la fattura",
    arrangePayment:
      "La preghiamo di contattarci per concordare il pagamento.",

    referencesIntro: () =>
      "Questi sono nostri clienti precedenti che hanno acconsentito a ricevere una telefonata. Chiami uno qualsiasi di loro e chieda com'è stato averci in casa.",
    beforeAfterIntro: () =>
      "Alcuni dei lavori che abbiamo concluso di recente.",

    orPaste: "Oppure copi questo link nel suo browser:",
    questions: (phone) =>
      phone
        ? `Domande? Risponda a questa email o chiami il ${phone}.`
        : "Domande? Risponda semplicemente a questa email.",

    visit: {
      serviceFallback: "visita",
      confirmedSubject: (service, company) => `Confermato: ${service} con ${company}`,
      confirmedHeadline: "Il suo appuntamento è prenotato",
      confirmedIntro: (service, company) => `Il suo ${service} con ${company} è confermato.`,
      aboutQuote: (ref) => `Riguardo al suo preventivo ${ref}.`,
      when: "Quando",
      where: "Dove",
      wasBookedFor: "Era prenotato per",
      newTime: "Nuovo orario",
      previously: "In precedenza",
      client: "Cliente",
      email: "Email",
      manageCta: "Modifica o annulla questa visita",
      changeViaLink: "Deve modificare o annullare? Usi il link qui sopra \u2014 oppure risponda semplicemente a questa email.",
      changeViaReply: "Deve modificare o annullare? Risponda semplicemente a questa email.",

      cancelledSubject: (service, company) => `Annullato: ${service} con ${company}`,
      cancelledHeadline: "La sua visita è annullata",
      cancelledByYou: (service, company) => `Il suo ${service} con ${company} è stato annullato, come richiesto.`,
      cancelledByOffice: (service, company) => `${company} ha dovuto annullare il suo ${service}. Ci scusiamo per il cambio di programma.`,
      cancelledFootnoteByYou: "Ha cambiato idea? Risponda a questa email e le troveremo un altro orario.",
      cancelledFootnoteByOffice: "Risponda a questa email e le troveremo un altro orario.",
      feeRefunded: (amount) => `Il costo della visita di ${amount} è stato rimborsato sulla carta usata per il pagamento. Di solito compare dopo qualche giorno lavorativo.`,
      feeAlreadyRefunded: (amount) => `Il costo della visita di ${amount} era già stato rimborsato.`,
      feeNotThroughSystem: (amount) => `Il costo della visita di ${amount} non è stato incassato tramite questo sistema, quindi non viene restituito automaticamente \u2014 risponda a questa email e sistemeremo tutto.`,
      feeNotReturned: (amount) => `Il costo della visita di ${amount} non viene restituito automaticamente. Risponda a questa email se desidera parlarne.`,

      movedSubject: (service, company) => `Spostato: ${service} con ${company}`,
      movedHeadline: "La sua visita è stata spostata",
      movedByYou: (service, company) => `Il suo ${service} con ${company} è ora prenotato per un nuovo orario.`,
      movedByOffice: (service, company) => `${company} ha spostato il suo ${service} a un nuovo orario.`,
      movedFootnote: "Nient\u2019altro è cambiato \u2014 l\u2019eventuale costo della visita già pagato resta valido per questa prenotazione.",

      officeCancelledSubject: (client, when) => `Annullato: ${client} \u2014 ${when}`,
      officeCancelledHeadline: "Una prenotazione è stata annullata",
      officeCancelledIntro: (client, service) => `${client} ha annullato il suo ${service} tramite il link nell\u2019email di conferma.`,
      officeFeeRefunded: (amount) => `Il costo della visita di ${amount} è stato rimborsato automaticamente, secondo la sua politica di cancellazione.`,
      officeFeeNotRefunded: (amount) => `Il costo della visita di ${amount} NON è stato rimborsato.`,
      officeCancelledFootnote: "L\u2019orario è di nuovo libero nel suo calendario.",
      officeMovedSubject: (client, when) => `Spostato: ${client} \u2014 ora ${when}`,
      officeMovedHeadline: "Una prenotazione è stata spostata",
      officeMovedIntro: (client, service) => `${client} ha spostato il suo ${service} tramite il link nell\u2019email di conferma.`,
      officeMovedLine: "Il vecchio orario è di nuovo libero e quello nuovo è nel suo calendario.",
      officeMovedFootnote: "L\u2019eventuale costo della visita già pagato viene mantenuto \u2014 nulla è stato addebitato o rimborsato.",
    },
  },
};

export const SUPPORTED_EMAIL_LANGUAGES = Object.keys(COPY);

/** The raw table, for scripts/check-language-completeness.mjs. */
export const EMAIL_COPY = COPY;

/**
 * Copy for one language, falling back to English.
 *
 * Falls back rather than throwing: a language code we don't have yet must
 * produce a sendable English email, never a failed send. A client receiving
 * the wrong language is a papercut; a client receiving nothing is a lost job.
 */
export function emailCopy(language = "en") {
  // Per KEY, not per language. This used to return `COPY[language] || COPY.en`,
  // which is only a fallback for a language we have never heard of — a language
  // we DO have, missing one newly added key, returned an object where that key
  // was `undefined`, and the email rendered "undefined" at a client. Merging
  // over English means a new key works everywhere the moment it is added in one
  // place, in English, until somebody translates it.
  const dict = COPY[language];
  return dict ? { ...COPY.en, ...dict } : COPY.en;
}
