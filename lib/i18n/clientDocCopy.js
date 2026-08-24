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
    whatCouldChange: "What could change this price",
    termsExplained: "The terms on this quote, explained",
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
    // Shown INSTEAD of the Pay button when the company hasn't finished
    // connecting Stripe. Same two sentences the invoice email already sends in
    // that case (emailCopy.arrangePayment / accepted), so a client who reads the
    // email and then opens the portal is told the same thing twice, not two
    // different things.
    arrangePayment: "Please get in touch to arrange payment.",
    acceptedMethods: (methods) => `Accepted: ${methods}.`,

    // /quote/[companySlug] — the public self-quote form and its confirmation.
    //
    // The form used to hold these inline in English, which is why a homeowner
    // offered a language choice would have switched the confirmation and left
    // the three steps before it untranslated. A document is written in ONE
    // language (AGENTS.md non-negotiable 6), and the form that creates it is
    // part of that document's making.
    //
    // "Request", not "Quote", on the masthead: nobody has priced anything yet,
    // and a confirmation headed QUOTE implies a figure exists.
    selfQuote: {
      documentWord: "Request",
      eyebrow: "Request a quote",
      languageLabel: "Language",

      step1Title: "What can we help with?",
      step1Hint: "Pick the closest match — we'll sort out the detail.",
      noServices: (phone) =>
        `This company hasn't set up their services yet. Get in touch with them directly${phone ? ` on ${phone}` : ""}.`,

      step2Hint: "Rough numbers are fine — nothing here is binding.",
      timelineLabel: "When are you hoping to start?",
      timelineAsap: "As soon as possible",
      timeline2Weeks: "Within 2 weeks",
      timeline1To3Months: "In the next 1–3 months",
      timelineExploring: "Just exploring for now",
      budgetLabel: "Rough budget?",
      optional: "(optional)",
      budgetUnder: (s) => `Under ${s}1,000`,
      budgetLow: (s) => `${s}1,000 – ${s}5,000`,
      budgetMid: (s) => `${s}5,000 – ${s}15,000`,
      budgetHigh: (s) => `${s}15,000+`,
      budgetUnsure: "Not sure yet",
      notesLabel: "Anything else we should know?",
      notesPlaceholder: "Photos, timing, access, anything unusual…",
      continueCta: "Continue",

      step3Title: "Where should we send it?",
      step3Hint: "One of email or phone is enough.",
      namePlaceholder: "Your name",
      emailPlaceholder: "Email",
      phonePlaceholder: "Phone",
      addressPlaceholder: "Where's the job? (optional)",

      // The upload control on step 3. Named PDF-first for the trade that asked
      // for it: a cabinet client almost always has an IKEA planner PDF and,
      // until the form said so, no idea they could send it.
      uploadLabel: "Add photos, a video or a PDF plan",
      uploadHint:
        "A picture, short clip or your PDF plan helps us quote accurately.",
      uploadDocumentFallback: "PDF plan",
      back: "Back",
      sendCta: "Send my request",
      noObligation: (company) =>
        `No obligation. ${company} will get back to you with a price.`,

      errName: "Please tell us your name.",
      errContact: "Add an email or a phone number so we can reply.",
      errSend: "Couldn't send your request.",
      linkInvalid: "This link isn't valid.",
      linkInvalidHint:
        "Check the link, or get in touch with the company directly.",

      confirmTitle: "Request received",
      confirmIntro: (company) =>
        `${company} has everything below and will be in touch with a price.`,
      requestedHeading: "What you asked for",
      nextHeading: "What happens next",
      next1Title: "They read it",
      next1Body:
        "Your answers land with the company straight away, along with anything you attached.",
      next2Title: "They price it",
      next2Body:
        "A person works out the real cost for your job — nothing here was priced automatically.",
      next3Title: "You get a quote",
      next3Body:
        "It arrives as a document you can read, question and approve. Nothing is agreed until you do.",
      estimateLabel: "Estimated range",
      beforeTax: "before tax",
      gatedNote:
        "No price is shown yet — this request hasn't been priced. That's deliberate: the figure you get will be one a person stands behind.",
      submittedLabel: "Submitted",
      copySentTo: (email) => `A copy is on its way to ${email}.`,
      callInstead: "Need it sooner?",
      // The in-person visit offered under the confirmation. Only rendered when
      // the company can actually take a booking — see lib/booking/canBookVisit.js.
      bookVisitTitle: "Would you like us to come and see it?",
      bookVisitBody:
        "Book an in-person visit and we'll confirm your price on site.",
      bookVisitCta: "Book a visit",

      emailSubject: (company) => `Your request to ${company}`,
      emailIntro: (company) =>
        `Thanks — ${company} has your request. Here's what you sent, for your records.`,
    },

    // /visit/[token] — the visit a homeowner already has booked.
    //
    // Two sentences on this screen do real work and the rest is furniture:
    //
    //   cannotTooLate  — a refusal that states the notice the company asked
    //                    for. "You can't change this" with no number reads as
    //                    a broken button; "they need 24 hours' notice" reads
    //                    as a policy, and tells them what to do instead.
    //   refundYes/No   — what happens to money already taken. These are worded
    //                    apart on purpose and neither is a default: refundNo
    //                    never says "non-refundable" (the contractor may well
    //                    refund it by hand) and refundYes is only ever shown
    //                    when the policy will actually make the refund.
    //
    // noticeHours is its own function because the plural rule is per-language
    // and Ukrainian has three forms — a template with "hours" baked in cannot
    // be translated correctly, only translated badly.
    visit: {
      eyebrow: "Your visit",
      loadFailed: "We couldn't load your visit.",
      loadFailedHint:
        "Check the link in your email, or get in touch with the company directly.",

      aboutEstimate: (number) => `About your estimate ${number}`,

      whenLabel: "When",
      whereLabel: "Where",
      modeVisit: "We're coming to you",
      modeCall: "Phone call — we'll ring you",
      modeVideo: "Video call — we'll email a link",
      addressUnknown: "Address to be confirmed",
      depositPaid: (amount) => `${amount} deposit paid`,

      changeHeading: "Need to change something?",
      rescheduleCta: "Change the time",
      cancelCta: "Cancel this visit",

      cannotCancelled: "This visit has already been cancelled.",
      cannotHappened: "This visit has already taken place.",
      cannotAwaitingPayment:
        "This visit isn't confirmed yet — the payment hasn't come through.",
      cannotNotFound: "This link doesn't match a visit.",
      cannotTooLate: (notice, company) =>
        `${company} asks for at least ${notice} notice, so this visit can't be changed here any more.`,
      cannotTooLateNoNotice: (company) =>
        `It's now too close to your appointment for ${company} to take a change here.`,
      noticeHours: (n) => (n === 1 ? "1 hour's" : `${n} hours'`),
      callInstead: (company, phone) =>
        phone
          ? `Call ${company} on ${phone} — they can still move it for you.`
          : `Get in touch with ${company} — they can still move it for you.`,

      refundYes: (amount) =>
        `Your ${amount} deposit will be returned to the card you paid with.`,
      refundNo: (amount) =>
        `Your ${amount} deposit is not automatically returned — get in touch with them about it.`,
      refundAlready: (amount) =>
        `Your ${amount} deposit has already been returned.`,

      cancelConfirmTitle: "Cancel this visit?",
      cancelConfirmBody: (company) =>
        `${company} will be told straight away, and your time goes back on their calendar.`,
      yesCancel: "Yes, cancel it",
      keepIt: "Keep my visit",
      cancelledTitle: "Visit cancelled",
      cancelledBody: (company) =>
        `${company} has been told. If this was a mistake, get in touch and they'll find you another time.`,
      cancelledRefunded: (amount) =>
        `Your ${amount} deposit is on its way back. It can take a few days to show on your statement.`,

      rescheduleTitle: "Pick a new time",
      rescheduleKeep: "Keep my current time",
      findingTimes: "Finding times…",
      // Shown instead of the raw HTTP failure. "Request failed (405)" is true and
      // useless to a homeowner; the real error goes to the console, and the line
      // under the calendar already tells them to ring.
      timesFailed: "We couldn't load the available times just now.",
      pickADay: "Pick a day to see the times.",
      morning: "Morning",
      afternoon: "Afternoon",
      evening: "Evening",
      nothingThisMonth: "Nothing free this month.",
      tryNextMonth: "Try next month",
      prevMonth: "Previous month",
      nextMonth: "Next month",
      confirmNewTime: "Move my visit here",
      movedTitle: "Your visit has been moved",
      movedBody: (company) =>
        `${company} has been told, and a new confirmation is on its way to you.`,

      questions: (company, phone) =>
        phone
          ? `Questions? Call ${company} on ${phone}.`
          : `Questions? Get in touch with ${company}.`,

      // Failures the server can hand back mid-action. Rendered from its stable
      // `reason` key rather than from its `error` string, which is English —
      // an English sentence in the middle of a Ukrainian page is the failure
      // this whole catalogue exists to prevent. Anything unrecognised falls
      // back to the server's own wording, which is at least accurate.
      slotTaken: "That time has just been taken. Pick another one.",
      tooSoon: "That time doesn't give them enough notice. Pick a later one.",
      refundFailed:
        "We couldn't return your deposit just now, so nothing has been cancelled. Try again in a moment, or get in touch.",
    },
  },

  fr: {
    approveThisQuote: "Approuver cette soumission",
    decline: "Refuser",
    whatsIncluded: "Ce qui est inclus",
    whatCouldChange: "Ce qui pourrait modifier ce prix",
    termsExplained: "Les termes de cette soumission, expliqués",
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
    arrangePayment: "Veuillez nous contacter pour organiser le paiement.",
    acceptedMethods: (methods) => `Modes de paiement acceptés : ${methods}.`,

    selfQuote: {
      documentWord: "Demande",
      eyebrow: "Demander une soumission",
      languageLabel: "Langue",

      step1Title: "Comment pouvons-nous vous aider ?",
      step1Hint:
        "Choisissez ce qui s'en rapproche le plus — nous préciserons les détails.",
      noServices: (phone) =>
        `Cette entreprise n'a pas encore configuré ses services. Communiquez directement avec elle${phone ? ` au ${phone}` : ""}.`,

      step2Hint:
        "Des chiffres approximatifs suffisent — rien ici n'est engageant.",
      timelineLabel: "Quand souhaitez-vous commencer ?",
      timelineAsap: "Dès que possible",
      timeline2Weeks: "D'ici 2 semaines",
      timeline1To3Months: "Dans 1 à 3 mois",
      timelineExploring: "Je me renseigne seulement",
      budgetLabel: "Budget approximatif ?",
      optional: "(facultatif)",
      budgetUnder: (s) => `Moins de ${s}1 000`,
      budgetLow: (s) => `${s}1 000 – ${s}5 000`,
      budgetMid: (s) => `${s}5 000 – ${s}15 000`,
      budgetHigh: (s) => `${s}15 000 et plus`,
      budgetUnsure: "Je ne sais pas encore",
      notesLabel: "Autre chose à nous signaler ?",
      notesPlaceholder:
        "Photos, échéancier, accès, tout ce qui sort de l'ordinaire…",
      continueCta: "Continuer",

      step3Title: "Où devons-nous vous répondre ?",
      step3Hint: "Un courriel ou un téléphone suffit.",
      namePlaceholder: "Votre nom",
      emailPlaceholder: "Courriel",
      phonePlaceholder: "Téléphone",
      addressPlaceholder: "Où sont les travaux ? (facultatif)",

      uploadLabel: "Ajouter des photos, une vidéo ou un plan PDF",
      uploadHint:
        "Une photo, un court clip ou votre plan PDF nous aide à chiffrer avec précision.",
      uploadDocumentFallback: "Plan PDF",
      back: "Retour",
      sendCta: "Envoyer ma demande",
      noObligation: (company) =>
        `Sans obligation. ${company} vous reviendra avec un prix.`,

      errName: "Veuillez nous indiquer votre nom.",
      errContact:
        "Ajoutez un courriel ou un numéro de téléphone pour que nous puissions répondre.",
      errSend: "Impossible d'envoyer votre demande.",
      linkInvalid: "Ce lien n'est pas valide.",
      linkInvalidHint:
        "Vérifiez le lien ou communiquez directement avec l'entreprise.",

      confirmTitle: "Demande reçue",
      confirmIntro: (company) =>
        `${company} a tout ce qui suit et vous reviendra avec un prix.`,
      requestedHeading: "Ce que vous avez demandé",
      nextHeading: "Les prochaines étapes",
      next1Title: "Ils la lisent",
      next1Body:
        "Vos réponses parviennent immédiatement à l'entreprise, avec tout ce que vous avez joint.",
      next2Title: "Ils établissent le prix",
      next2Body:
        "Une personne calcule le coût réel de vos travaux — rien ici n'a été chiffré automatiquement.",
      next3Title: "Vous recevez une soumission",
      next3Body:
        "Elle arrive sous forme de document que vous pouvez lire, questionner et approuver. Rien n'est conclu avant cela.",
      estimateLabel: "Fourchette estimée",
      beforeTax: "avant taxes",
      gatedNote:
        "Aucun prix n'est affiché pour l'instant — cette demande n'a pas été chiffrée. C'est voulu : le montant que vous recevrez sera assumé par une personne.",
      submittedLabel: "Envoyée le",
      copySentTo: (email) => `Une copie est en route vers ${email}.`,
      callInstead: "Besoin plus rapidement ?",
      // The in-person visit offered under the confirmation. Only rendered when
      // the company can actually take a booking — see lib/booking/canBookVisit.js.
      bookVisitTitle: "Souhaitez-vous que nous venions voir ?",
      bookVisitBody:
        "Réservez une visite sur place et nous confirmerons votre prix chez vous.",
      bookVisitCta: "Réserver une visite",

      emailSubject: (company) => `Votre demande à ${company}`,
      emailIntro: (company) =>
        `Merci — ${company} a bien reçu votre demande. Voici ce que vous avez envoyé, pour vos dossiers.`,
    },

    visit: {
      eyebrow: "Votre rendez-vous",
      loadFailed: "Nous n'avons pas pu charger votre rendez-vous.",
      loadFailedHint:
        "Vérifiez le lien reçu par courriel, ou communiquez directement avec l'entreprise.",

      aboutEstimate: (number) => `Au sujet de votre soumission ${number}`,

      whenLabel: "Quand",
      whereLabel: "Où",
      modeVisit: "Nous nous déplaçons chez vous",
      modeCall: "Appel téléphonique — nous vous appellerons",
      modeVideo: "Appel vidéo — nous vous enverrons un lien par courriel",
      addressUnknown: "Adresse à confirmer",
      depositPaid: (amount) => `Dépôt de ${amount} payé`,

      changeHeading: "Besoin de changer quelque chose ?",
      rescheduleCta: "Changer l'heure",
      cancelCta: "Annuler ce rendez-vous",

      cannotCancelled: "Ce rendez-vous a déjà été annulé.",
      cannotHappened: "Ce rendez-vous a déjà eu lieu.",
      cannotAwaitingPayment:
        "Ce rendez-vous n'est pas encore confirmé — le paiement n'est pas passé.",
      cannotNotFound: "Ce lien ne correspond à aucun rendez-vous.",
      cannotTooLate: (notice, company) =>
        `${company} demande un préavis d'au moins ${notice}; ce rendez-vous ne peut donc plus être modifié ici.`,
      cannotTooLateNoNotice: (company) =>
        `Il est maintenant trop tard pour que ${company} accepte un changement ici.`,
      noticeHours: (n) => (n === 1 ? "1 heure" : `${n} heures`),
      callInstead: (company, phone) =>
        phone
          ? `Appelez ${company} au ${phone} — ils peuvent encore le déplacer pour vous.`
          : `Communiquez avec ${company} — ils peuvent encore le déplacer pour vous.`,

      refundYes: (amount) =>
        `Votre dépôt de ${amount} sera remboursé sur la carte utilisée.`,
      refundNo: (amount) =>
        `Votre dépôt de ${amount} n'est pas remboursé automatiquement — communiquez avec eux à ce sujet.`,
      refundAlready: (amount) =>
        `Votre dépôt de ${amount} a déjà été remboursé.`,

      cancelConfirmTitle: "Annuler ce rendez-vous ?",
      cancelConfirmBody: (company) =>
        `${company} en sera avisé immédiatement, et votre plage horaire sera libérée.`,
      yesCancel: "Oui, annuler",
      keepIt: "Garder mon rendez-vous",
      cancelledTitle: "Rendez-vous annulé",
      cancelledBody: (company) =>
        `${company} a été avisé. S'il s'agit d'une erreur, communiquez avec eux et ils vous trouveront un autre moment.`,
      cancelledRefunded: (amount) =>
        `Votre dépôt de ${amount} est en route. Quelques jours peuvent s'écouler avant qu'il paraisse sur votre relevé.`,

      rescheduleTitle: "Choisissez une nouvelle heure",
      rescheduleKeep: "Garder mon heure actuelle",
      findingTimes: "Recherche des disponibilités…",
      timesFailed:
        "Nous n'avons pas pu charger les disponibilités pour l'instant.",
      pickADay: "Choisissez une journée pour voir les heures.",
      morning: "Matin",
      afternoon: "Après-midi",
      evening: "Soir",
      nothingThisMonth: "Rien de libre ce mois-ci.",
      tryNextMonth: "Essayer le mois prochain",
      prevMonth: "Mois précédent",
      nextMonth: "Mois suivant",
      confirmNewTime: "Déplacer mon rendez-vous ici",
      movedTitle: "Votre rendez-vous a été déplacé",
      movedBody: (company) =>
        `${company} a été avisé, et une nouvelle confirmation vous sera envoyée.`,

      questions: (company, phone) =>
        phone
          ? `Des questions ? Appelez ${company} au ${phone}.`
          : `Des questions ? Communiquez avec ${company}.`,

      slotTaken: "Cette heure vient d'être prise. Choisissez-en une autre.",
      tooSoon:
        "Cette heure ne leur laisse pas assez de préavis. Choisissez-en une plus tardive.",
      refundFailed:
        "Nous n'avons pas pu rembourser votre dépôt pour l'instant, donc rien n'a été annulé. Réessayez dans un moment, ou communiquez avec eux.",
    },
  },

  es: {
    approveThisQuote: "Aprobar este presupuesto",
    decline: "Rechazar",
    whatsIncluded: "Qué incluye",
    whatCouldChange: "Qué podría cambiar este precio",
    termsExplained: "Los términos de este presupuesto, explicados",
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
    arrangePayment:
      "Por favor comuníquese con nosotros para coordinar el pago.",
    acceptedMethods: (methods) => `Formas de pago aceptadas: ${methods}.`,

    selfQuote: {
      documentWord: "Solicitud",
      eyebrow: "Solicitar un presupuesto",
      languageLabel: "Idioma",

      step1Title: "¿En qué podemos ayudarle?",
      step1Hint:
        "Elija lo más parecido — los detalles los concretamos nosotros.",
      noServices: (phone) =>
        `Esta empresa aún no ha configurado sus servicios. Comuníquese directamente con ella${phone ? ` al ${phone}` : ""}.`,

      step2Hint: "Cifras aproximadas bastan — nada de esto es vinculante.",
      timelineLabel: "¿Cuándo espera empezar?",
      timelineAsap: "Lo antes posible",
      timeline2Weeks: "En 2 semanas",
      timeline1To3Months: "En los próximos 1 a 3 meses",
      timelineExploring: "Solo estoy consultando",
      budgetLabel: "¿Presupuesto aproximado?",
      optional: "(opcional)",
      budgetUnder: (s) => `Menos de ${s}1.000`,
      budgetLow: (s) => `${s}1.000 – ${s}5.000`,
      budgetMid: (s) => `${s}5.000 – ${s}15.000`,
      budgetHigh: (s) => `${s}15.000 o más`,
      budgetUnsure: "Todavía no lo sé",
      notesLabel: "¿Algo más que debamos saber?",
      notesPlaceholder:
        "Fotos, fechas, acceso, cualquier cosa fuera de lo común…",
      continueCta: "Continuar",

      step3Title: "¿Adónde se lo enviamos?",
      step3Hint: "Con un correo o un teléfono es suficiente.",
      namePlaceholder: "Su nombre",
      emailPlaceholder: "Correo electrónico",
      phonePlaceholder: "Teléfono",
      addressPlaceholder: "¿Dónde es el trabajo? (opcional)",

      uploadLabel: "Añadir fotos, un video o un plano PDF",
      uploadHint:
        "Una foto, un clip corto o su plano PDF nos ayuda a cotizar con precisión.",
      uploadDocumentFallback: "Plano PDF",
      back: "Atrás",
      sendCta: "Enviar mi solicitud",
      noObligation: (company) =>
        `Sin compromiso. ${company} le responderá con un precio.`,

      errName: "Díganos su nombre, por favor.",
      errContact:
        "Añada un correo electrónico o un teléfono para que podamos responderle.",
      errSend: "No se pudo enviar su solicitud.",
      linkInvalid: "Este enlace no es válido.",
      linkInvalidHint:
        "Revise el enlace o comuníquese directamente con la empresa.",

      confirmTitle: "Solicitud recibida",
      confirmIntro: (company) =>
        `${company} tiene todo lo siguiente y le responderá con un precio.`,
      requestedHeading: "Lo que solicitó",
      nextHeading: "Qué pasa ahora",
      next1Title: "La leen",
      next1Body:
        "Sus respuestas llegan a la empresa de inmediato, junto con lo que haya adjuntado.",
      next2Title: "Calculan el precio",
      next2Body:
        "Una persona calcula el costo real de su trabajo — aquí nada se ha presupuestado automáticamente.",
      next3Title: "Recibe un presupuesto",
      next3Body:
        "Llega como un documento que puede leer, cuestionar y aprobar. Nada se acuerda hasta entonces.",
      estimateLabel: "Rango estimado",
      beforeTax: "antes de impuestos",
      gatedNote:
        "Todavía no se muestra ningún precio — esta solicitud no se ha presupuestado. Es a propósito: la cifra que reciba será una que una persona respalda.",
      submittedLabel: "Enviada el",
      copySentTo: (email) => `Una copia va en camino a ${email}.`,
      callInstead: "¿Lo necesita antes?",
      // The in-person visit offered under the confirmation. Only rendered when
      // the company can actually take a booking — see lib/booking/canBookVisit.js.
      bookVisitTitle: "¿Quiere que vayamos a verlo?",
      bookVisitBody: "Reserve una visita y confirmamos su precio en el lugar.",
      bookVisitCta: "Reservar una visita",

      emailSubject: (company) => `Su solicitud a ${company}`,
      emailIntro: (company) =>
        `Gracias — ${company} ha recibido su solicitud. Esto es lo que envió, para sus registros.`,
    },

    visit: {
      eyebrow: "Su visita",
      loadFailed: "No pudimos cargar su visita.",
      loadFailedHint:
        "Revise el enlace de su correo, o póngase en contacto directamente con la empresa.",

      aboutEstimate: (number) => `Sobre su presupuesto ${number}`,

      whenLabel: "Cuándo",
      whereLabel: "Dónde",
      modeVisit: "Vamos a su domicilio",
      modeCall: "Llamada telefónica — le llamaremos",
      modeVideo: "Videollamada — le enviaremos un enlace por correo",
      addressUnknown: "Dirección por confirmar",
      depositPaid: (amount) => `Depósito de ${amount} pagado`,

      changeHeading: "¿Necesita cambiar algo?",
      rescheduleCta: "Cambiar la hora",
      cancelCta: "Cancelar esta visita",

      cannotCancelled: "Esta visita ya fue cancelada.",
      cannotHappened: "Esta visita ya tuvo lugar.",
      cannotAwaitingPayment:
        "Esta visita aún no está confirmada — el pago no se ha completado.",
      cannotNotFound: "Este enlace no corresponde a ninguna visita.",
      cannotTooLate: (notice, company) =>
        `${company} pide un aviso de al menos ${notice}, así que esta visita ya no se puede cambiar aquí.`,
      cannotTooLateNoNotice: (company) =>
        `Ya falta muy poco para su cita como para que ${company} acepte un cambio aquí.`,
      noticeHours: (n) => (n === 1 ? "1 hora" : `${n} horas`),
      callInstead: (company, phone) =>
        phone
          ? `Llame a ${company} al ${phone} — todavía pueden moverla por usted.`
          : `Póngase en contacto con ${company} — todavía pueden moverla por usted.`,

      refundYes: (amount) =>
        `Su depósito de ${amount} se devolverá a la tarjeta con la que pagó.`,
      refundNo: (amount) =>
        `Su depósito de ${amount} no se devuelve automáticamente — póngase en contacto con ellos al respecto.`,
      refundAlready: (amount) => `Su depósito de ${amount} ya fue devuelto.`,

      cancelConfirmTitle: "¿Cancelar esta visita?",
      cancelConfirmBody: (company) =>
        `Se avisará a ${company} de inmediato y su hora volverá a quedar libre.`,
      yesCancel: "Sí, cancelar",
      keepIt: "Mantener mi visita",
      cancelledTitle: "Visita cancelada",
      cancelledBody: (company) =>
        `Se ha avisado a ${company}. Si fue un error, póngase en contacto y le buscarán otra hora.`,
      cancelledRefunded: (amount) =>
        `Su depósito de ${amount} está en camino de vuelta. Puede tardar unos días en aparecer en su extracto.`,

      rescheduleTitle: "Elija una nueva hora",
      rescheduleKeep: "Mantener mi hora actual",
      findingTimes: "Buscando horas…",
      timesFailed: "No pudimos cargar las horas disponibles en este momento.",
      pickADay: "Elija un día para ver las horas.",
      morning: "Mañana",
      afternoon: "Tarde",
      evening: "Noche",
      nothingThisMonth: "No hay nada libre este mes.",
      tryNextMonth: "Probar el mes que viene",
      prevMonth: "Mes anterior",
      nextMonth: "Mes siguiente",
      confirmNewTime: "Mover mi visita aquí",
      movedTitle: "Su visita se ha movido",
      movedBody: (company) =>
        `Se ha avisado a ${company}, y le llegará una nueva confirmación.`,

      questions: (company, phone) =>
        phone
          ? `¿Preguntas? Llame a ${company} al ${phone}.`
          : `¿Preguntas? Póngase en contacto con ${company}.`,

      slotTaken: "Esa hora acaba de ocuparse. Elija otra.",
      tooSoon: "Esa hora no les da aviso suficiente. Elija una más tarde.",
      refundFailed:
        "No pudimos devolver su depósito en este momento, así que no se ha cancelado nada. Inténtelo de nuevo en un momento, o póngase en contacto con ellos.",
    },
  },

  uk: {
    approveThisQuote: "Підтвердити цей кошторис",
    decline: "Відхилити",
    whatsIncluded: "Що входить",
    whatCouldChange: "Що може змінити цю ціну",
    termsExplained: "Терміни в цій пропозиції, пояснені",
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
    arrangePayment: "Будь ласка, зв’яжіться з нами, щоб домовитися про оплату.",
    acceptedMethods: (methods) => `Приймаємо: ${methods}.`,

    selfQuote: {
      documentWord: "Запит",
      eyebrow: "Запросити кошторис",
      languageLabel: "Мова",

      step1Title: "Чим ми можемо допомогти?",
      step1Hint: "Оберіть найближче — деталі ми уточнимо.",
      noServices: (phone) =>
        `Ця компанія ще не налаштувала свої послуги. Зверніться до неї безпосередньо${phone ? ` за номером ${phone}` : ""}.`,

      step2Hint: "Приблизних цифр достатньо — ніщо тут не є зобов'язанням.",
      timelineLabel: "Коли плануєте почати?",
      timelineAsap: "Якнайшвидше",
      timeline2Weeks: "Протягом 2 тижнів",
      timeline1To3Months: "Через 1–3 місяці",
      timelineExploring: "Поки що просто дізнаюся",
      budgetLabel: "Орієнтовний бюджет?",
      optional: "(необов'язково)",
      budgetUnder: (s) => `Менше ${s}1 000`,
      budgetLow: (s) => `${s}1 000 – ${s}5 000`,
      budgetMid: (s) => `${s}5 000 – ${s}15 000`,
      budgetHigh: (s) => `${s}15 000 і більше`,
      budgetUnsure: "Ще не знаю",
      notesLabel: "Що ще нам варто знати?",
      notesPlaceholder: "Фото, терміни, доступ, будь-що незвичне…",
      continueCta: "Далі",

      step3Title: "Куди надіслати відповідь?",
      step3Hint: "Достатньо електронної пошти або телефону.",
      namePlaceholder: "Ваше ім'я",
      emailPlaceholder: "Електронна пошта",
      phonePlaceholder: "Телефон",
      addressPlaceholder: "Де виконувати роботу? (необов'язково)",

      uploadLabel: "Додати фото, відео або PDF-план",
      uploadHint:
        "Фото, короткий ролик або ваш PDF-план допоможе нам оцінити точніше.",
      uploadDocumentFallback: "PDF-план",
      back: "Назад",
      sendCta: "Надіслати запит",
      noObligation: (company) =>
        `Без зобов'язань. ${company} повернеться до вас із ціною.`,

      errName: "Будь ласка, вкажіть своє ім'я.",
      errContact:
        "Додайте електронну пошту або номер телефону, щоб ми могли відповісти.",
      errSend: "Не вдалося надіслати ваш запит.",
      linkInvalid: "Це посилання недійсне.",
      linkInvalidHint:
        "Перевірте посилання або зверніться до компанії безпосередньо.",

      confirmTitle: "Запит отримано",
      confirmIntro: (company) =>
        `${company} має все наведене нижче і зв'яжеться з вами щодо ціни.`,
      requestedHeading: "Що ви запитали",
      nextHeading: "Що буде далі",
      next1Title: "Вони це прочитають",
      next1Body:
        "Ваші відповіді одразу надходять до компанії разом із усім, що ви долучили.",
      next2Title: "Вони визначать ціну",
      next2Body:
        "Людина розрахує реальну вартість вашої роботи — тут ніщо не оцінювалося автоматично.",
      next3Title: "Ви отримаєте кошторис",
      next3Body:
        "Він надійде як документ, який можна прочитати, обговорити та затвердити. До того нічого не узгоджено.",
      estimateLabel: "Орієнтовний діапазон",
      beforeTax: "без податків",
      gatedNote:
        "Ціна поки не показана — цей запит ще не оцінено. Це навмисно: сума, яку ви отримаєте, буде тією, за яку відповідає людина.",
      submittedLabel: "Надіслано",
      copySentTo: (email) => `Копія вже прямує на ${email}.`,
      callInstead: "Потрібно швидше?",
      // The in-person visit offered under the confirmation. Only rendered when
      // the company can actually take a booking — see lib/booking/canBookVisit.js.
      bookVisitTitle: "Хочете, щоб ми приїхали подивитися?",
      bookVisitBody: "Забронюйте візит, і ми підтвердимо вашу ціну на місці.",
      bookVisitCta: "Забронювати візит",

      emailSubject: (company) => `Ваш запит до ${company}`,
      emailIntro: (company) =>
        `Дякуємо — ${company} отримала ваш запит. Ось що ви надіслали, для ваших записів.`,
    },

    visit: {
      eyebrow: "Ваш візит",
      loadFailed: "Не вдалося завантажити ваш візит.",
      loadFailedHint:
        "Перевірте посилання з листа або зв'яжіться з компанією напряму.",

      aboutEstimate: (number) => `Щодо вашого кошторису ${number}`,

      whenLabel: "Коли",
      whereLabel: "Де",
      modeVisit: "Ми приїдемо до вас",
      modeCall: "Телефонний дзвінок — ми вам зателефонуємо",
      modeVideo: "Відеодзвінок — ми надішлемо посилання електронною поштою",
      addressUnknown: "Адресу буде підтверджено",
      depositPaid: (amount) => `Завдаток ${amount} сплачено`,

      changeHeading: "Потрібно щось змінити?",
      rescheduleCta: "Змінити час",
      cancelCta: "Скасувати цей візит",

      cannotCancelled: "Цей візит уже скасовано.",
      cannotHappened: "Цей візит уже відбувся.",
      cannotAwaitingPayment:
        "Цей візит ще не підтверджено — оплата не пройшла.",
      cannotNotFound: "Це посилання не відповідає жодному візиту.",
      cannotTooLate: (notice, company) =>
        `${company} просить попередити щонайменше за ${notice}, тому цей візит уже не можна змінити тут.`,
      cannotTooLateNoNotice: (company) =>
        `До вашого візиту залишилося замало часу, щоб ${company} прийняла зміну тут.`,
      // Three plural forms, which is the whole reason this is a function and
      // not "${n} годин" in a template. Accusative after «за».
      noticeHours: (n) => {
        const ten = n % 10;
        const hundred = n % 100;
        if (ten === 1 && hundred !== 11) return `${n} годину`;
        if (ten >= 2 && ten <= 4 && (hundred < 12 || hundred > 14))
          return `${n} години`;
        return `${n} годин`;
      },
      callInstead: (company, phone) =>
        phone
          ? `Зателефонуйте ${company} за номером ${phone} — вони ще можуть перенести візит.`
          : `Зв'яжіться з ${company} — вони ще можуть перенести візит.`,

      refundYes: (amount) =>
        `Ваш завдаток ${amount} буде повернено на картку, якою ви платили.`,
      refundNo: (amount) =>
        `Ваш завдаток ${amount} не повертається автоматично — зв'яжіться з ними щодо цього.`,
      refundAlready: (amount) => `Ваш завдаток ${amount} уже повернено.`,

      cancelConfirmTitle: "Скасувати цей візит?",
      cancelConfirmBody: (company) =>
        `${company} буде сповіщено одразу, а ваш час звільниться.`,
      yesCancel: "Так, скасувати",
      keepIt: "Залишити мій візит",
      cancelledTitle: "Візит скасовано",
      cancelledBody: (company) =>
        `${company} сповіщено. Якщо це помилка, зв'яжіться з ними — вони підберуть інший час.`,
      cancelledRefunded: (amount) =>
        `Ваш завдаток ${amount} уже в дорозі назад. Кошти можуть з'явитися у виписці за кілька днів.`,

      rescheduleTitle: "Оберіть новий час",
      rescheduleKeep: "Залишити поточний час",
      findingTimes: "Шукаємо вільний час…",
      timesFailed: "Наразі не вдалося завантажити вільний час.",
      pickADay: "Оберіть день, щоб побачити години.",
      morning: "Ранок",
      afternoon: "День",
      evening: "Вечір",
      nothingThisMonth: "Цього місяця вільного часу немає.",
      tryNextMonth: "Спробувати наступний місяць",
      prevMonth: "Попередній місяць",
      nextMonth: "Наступний місяць",
      confirmNewTime: "Перенести мій візит сюди",
      movedTitle: "Ваш візит перенесено",
      movedBody: (company) =>
        `${company} сповіщено, і нове підтвердження вже прямує до вас.`,

      questions: (company, phone) =>
        phone
          ? `Питання? Зателефонуйте ${company} за номером ${phone}.`
          : `Питання? Зв'яжіться з ${company}.`,

      slotTaken: "Цей час щойно зайняли. Оберіть інший.",
      tooSoon: "Цей час не дає їм достатньо попередження. Оберіть пізніший.",
      refundFailed:
        "Наразі не вдалося повернути ваш завдаток, тому нічого не скасовано. Спробуйте ще раз за хвилину або зв'яжіться з ними.",
    },
  },

  pa: {
    approveThisQuote: "ਇਹ ਹਵਾਲਾ ਮਨਜ਼ੂਰ ਕਰੋ",
    decline: "ਇਨਕਾਰ ਕਰੋ",
    whatsIncluded: "ਕੀ ਸ਼ਾਮਲ ਹੈ",
    whatCouldChange: "ਇਸ ਕੀਮਤ ਨੂੰ ਕੀ ਬਦਲ ਸਕਦਾ ਹੈ",
    termsExplained: "ਇਸ ਹਵਾਲੇ ਦੀਆਂ ਸ਼ਰਤਾਂ, ਸਮਝਾਈਆਂ ਗਈਆਂ",
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
    expiredBody: (company) => `ਅੱਪਡੇਟ ਕੀਤੀ ਕੀਮਤ ਲਈ ${company} ਨਾਲ ਸੰਪਰਕ ਕਰੋ।`,
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
    arrangePayment: "ਭੁਗਤਾਨ ਦਾ ਪ੍ਰਬੰਧ ਕਰਨ ਲਈ ਕਿਰਪਾ ਕਰਕੇ ਸਾਡੇ ਨਾਲ ਸੰਪਰਕ ਕਰੋ।",
    acceptedMethods: (methods) => `ਸਵੀਕਾਰ: ${methods}।`,

    selfQuote: {
      documentWord: "ਬੇਨਤੀ",
      eyebrow: "ਹਵਾਲਾ ਮੰਗੋ",
      languageLabel: "ਭਾਸ਼ਾ",

      step1Title: "ਅਸੀਂ ਕਿਸ ਵਿੱਚ ਮਦਦ ਕਰ ਸਕਦੇ ਹਾਂ?",
      step1Hint: "ਸਭ ਤੋਂ ਨੇੜੇ ਦਾ ਚੁਣੋ — ਵੇਰਵੇ ਅਸੀਂ ਸੰਭਾਲ ਲਵਾਂਗੇ।",
      noServices: (phone) =>
        `ਇਸ ਕੰਪਨੀ ਨੇ ਹਾਲੇ ਆਪਣੀਆਂ ਸੇਵਾਵਾਂ ਸੈੱਟ ਨਹੀਂ ਕੀਤੀਆਂ। ਸਿੱਧਾ ਉਨ੍ਹਾਂ ਨਾਲ ਸੰਪਰਕ ਕਰੋ${phone ? ` ${phone} ਉੱਤੇ` : ""}।`,

      step2Hint: "ਲਗਭਗ ਅੰਕੜੇ ਵੀ ਠੀਕ ਹਨ — ਇੱਥੇ ਕੁਝ ਵੀ ਪੱਕਾ ਨਹੀਂ ਹੈ।",
      timelineLabel: "ਤੁਸੀਂ ਕਦੋਂ ਸ਼ੁਰੂ ਕਰਨਾ ਚਾਹੁੰਦੇ ਹੋ?",
      timelineAsap: "ਜਿੰਨੀ ਛੇਤੀ ਹੋ ਸਕੇ",
      timeline2Weeks: "2 ਹਫ਼ਤਿਆਂ ਦੇ ਅੰਦਰ",
      timeline1To3Months: "ਅਗਲੇ 1–3 ਮਹੀਨਿਆਂ ਵਿੱਚ",
      timelineExploring: "ਹਾਲੇ ਸਿਰਫ਼ ਪਤਾ ਕਰ ਰਿਹਾ/ਰਹੀ ਹਾਂ",
      budgetLabel: "ਲਗਭਗ ਬਜਟ?",
      optional: "(ਚੋਣਵਾਂ)",
      budgetUnder: (s) => `${s}1,000 ਤੋਂ ਘੱਟ`,
      budgetLow: (s) => `${s}1,000 – ${s}5,000`,
      budgetMid: (s) => `${s}5,000 – ${s}15,000`,
      budgetHigh: (s) => `${s}15,000 ਤੋਂ ਵੱਧ`,
      budgetUnsure: "ਹਾਲੇ ਪੱਕਾ ਨਹੀਂ",
      notesLabel: "ਹੋਰ ਕੁਝ ਜੋ ਸਾਨੂੰ ਪਤਾ ਹੋਣਾ ਚਾਹੀਦਾ ਹੈ?",
      notesPlaceholder: "ਫ਼ੋਟੋਆਂ, ਸਮਾਂ, ਪਹੁੰਚ, ਕੋਈ ਵੀ ਖ਼ਾਸ ਗੱਲ…",
      continueCta: "ਅੱਗੇ",

      step3Title: "ਅਸੀਂ ਇਹ ਕਿੱਥੇ ਭੇਜੀਏ?",
      step3Hint: "ਈਮੇਲ ਜਾਂ ਫ਼ੋਨ ਵਿੱਚੋਂ ਇੱਕ ਹੀ ਕਾਫ਼ੀ ਹੈ।",
      namePlaceholder: "ਤੁਹਾਡਾ ਨਾਮ",
      emailPlaceholder: "ਈਮੇਲ",
      phonePlaceholder: "ਫ਼ੋਨ",
      addressPlaceholder: "ਕੰਮ ਕਿੱਥੇ ਹੈ? (ਚੋਣਵਾਂ)",

      uploadLabel: "ਫ਼ੋਟੋਆਂ, ਵੀਡੀਓ ਜਾਂ PDF ਪਲਾਨ ਜੋੜੋ",
      uploadHint:
        "ਇੱਕ ਫ਼ੋਟੋ, ਛੋਟਾ ਕਲਿੱਪ ਜਾਂ ਤੁਹਾਡਾ PDF ਪਲਾਨ ਸਾਨੂੰ ਸਹੀ ਕੀਮਤ ਦੱਸਣ ਵਿੱਚ ਮਦਦ ਕਰਦਾ ਹੈ।",
      uploadDocumentFallback: "PDF ਪਲਾਨ",
      back: "ਪਿੱਛੇ",
      sendCta: "ਮੇਰੀ ਬੇਨਤੀ ਭੇਜੋ",
      noObligation: (company) =>
        `ਕੋਈ ਪਾਬੰਦੀ ਨਹੀਂ। ${company} ਕੀਮਤ ਨਾਲ ਤੁਹਾਡੇ ਕੋਲ ਵਾਪਸ ਆਵੇਗੀ।`,

      errName: "ਕਿਰਪਾ ਕਰਕੇ ਸਾਨੂੰ ਆਪਣਾ ਨਾਮ ਦੱਸੋ।",
      errContact: "ਜਵਾਬ ਦੇਣ ਲਈ ਇੱਕ ਈਮੇਲ ਜਾਂ ਫ਼ੋਨ ਨੰਬਰ ਸ਼ਾਮਲ ਕਰੋ।",
      errSend: "ਤੁਹਾਡੀ ਬੇਨਤੀ ਭੇਜੀ ਨਹੀਂ ਜਾ ਸਕੀ।",
      linkInvalid: "ਇਹ ਲਿੰਕ ਵੈਧ ਨਹੀਂ ਹੈ।",
      linkInvalidHint: "ਲਿੰਕ ਦੀ ਜਾਂਚ ਕਰੋ, ਜਾਂ ਸਿੱਧਾ ਕੰਪਨੀ ਨਾਲ ਸੰਪਰਕ ਕਰੋ।",

      confirmTitle: "ਬੇਨਤੀ ਮਿਲ ਗਈ",
      confirmIntro: (company) =>
        `${company} ਕੋਲ ਹੇਠਾਂ ਦਿੱਤਾ ਸਭ ਕੁਝ ਹੈ ਅਤੇ ਉਹ ਕੀਮਤ ਨਾਲ ਸੰਪਰਕ ਕਰਨਗੇ।`,
      requestedHeading: "ਤੁਸੀਂ ਕੀ ਮੰਗਿਆ",
      nextHeading: "ਅੱਗੇ ਕੀ ਹੋਵੇਗਾ",
      next1Title: "ਉਹ ਇਸਨੂੰ ਪੜ੍ਹਨਗੇ",
      next1Body:
        "ਤੁਹਾਡੇ ਜਵਾਬ ਤੁਰੰਤ ਕੰਪਨੀ ਕੋਲ ਪਹੁੰਚ ਜਾਂਦੇ ਹਨ, ਨਾਲ ਹੀ ਜੋ ਕੁਝ ਤੁਸੀਂ ਨੱਥੀ ਕੀਤਾ।",
      next2Title: "ਉਹ ਕੀਮਤ ਲਾਉਣਗੇ",
      next2Body:
        "ਇੱਕ ਵਿਅਕਤੀ ਤੁਹਾਡੇ ਕੰਮ ਦੀ ਅਸਲ ਲਾਗਤ ਕੱਢਦਾ ਹੈ — ਇੱਥੇ ਕੁਝ ਵੀ ਆਪਣੇ ਆਪ ਕੀਮਤ ਨਹੀਂ ਲਾਈ ਗਈ।",
      next3Title: "ਤੁਹਾਨੂੰ ਹਵਾਲਾ ਮਿਲੇਗਾ",
      next3Body:
        "ਇਹ ਇੱਕ ਦਸਤਾਵੇਜ਼ ਵਜੋਂ ਆਉਂਦਾ ਹੈ ਜਿਸਨੂੰ ਤੁਸੀਂ ਪੜ੍ਹ, ਪੁੱਛ ਅਤੇ ਮਨਜ਼ੂਰ ਕਰ ਸਕਦੇ ਹੋ। ਉਸ ਤੋਂ ਪਹਿਲਾਂ ਕੁਝ ਤੈਅ ਨਹੀਂ ਹੁੰਦਾ।",
      estimateLabel: "ਅਨੁਮਾਨਿਤ ਦਾਇਰਾ",
      beforeTax: "ਟੈਕਸ ਤੋਂ ਪਹਿਲਾਂ",
      gatedNote:
        "ਹਾਲੇ ਕੋਈ ਕੀਮਤ ਨਹੀਂ ਦਿਖਾਈ ਗਈ — ਇਸ ਬੇਨਤੀ ਦੀ ਕੀਮਤ ਨਹੀਂ ਲਾਈ ਗਈ। ਇਹ ਜਾਣ-ਬੁੱਝ ਕੇ ਹੈ: ਜੋ ਅੰਕੜਾ ਤੁਹਾਨੂੰ ਮਿਲੇਗਾ, ਉਸ ਪਿੱਛੇ ਇੱਕ ਵਿਅਕਤੀ ਖੜ੍ਹਾ ਹੋਵੇਗਾ।",
      submittedLabel: "ਭੇਜੀ ਗਈ",
      copySentTo: (email) => `ਇੱਕ ਕਾਪੀ ${email} ਉੱਤੇ ਭੇਜੀ ਜਾ ਰਹੀ ਹੈ।`,
      callInstead: "ਹੋਰ ਛੇਤੀ ਚਾਹੀਦਾ ਹੈ?",
      // The in-person visit offered under the confirmation. Only rendered when
      // the company can actually take a booking — see lib/booking/canBookVisit.js.
      bookVisitTitle: "ਕੀ ਤੁਸੀਂ ਚਾਹੁੰਦੇ ਹੋ ਕਿ ਅਸੀਂ ਆ ਕੇ ਦੇਖੀਏ?",
      bookVisitBody:
        "ਘਰ ਆ ਕੇ ਦੇਖਣ ਦਾ ਸਮਾਂ ਬੁੱਕ ਕਰੋ — ਅਸੀਂ ਮੌਕੇ 'ਤੇ ਕੀਮਤ ਪੱਕੀ ਕਰਾਂਗੇ।",
      bookVisitCta: "ਵਿਜ਼ਿਟ ਬੁੱਕ ਕਰੋ",

      emailSubject: (company) => `${company} ਨੂੰ ਤੁਹਾਡੀ ਬੇਨਤੀ`,
      emailIntro: (company) =>
        `ਧੰਨਵਾਦ — ${company} ਕੋਲ ਤੁਹਾਡੀ ਬੇਨਤੀ ਪਹੁੰਚ ਗਈ ਹੈ। ਤੁਹਾਡੇ ਰਿਕਾਰਡ ਲਈ, ਤੁਸੀਂ ਜੋ ਭੇਜਿਆ ਉਹ ਇਹ ਹੈ।`,
    },

    visit: {
      eyebrow: "ਤੁਹਾਡੀ ਮੁਲਾਕਾਤ",
      loadFailed: "ਅਸੀਂ ਤੁਹਾਡੀ ਮੁਲਾਕਾਤ ਲੋਡ ਨਹੀਂ ਕਰ ਸਕੇ।",
      loadFailedHint:
        "ਆਪਣੀ ਈਮੇਲ ਵਿੱਚ ਦਿੱਤਾ ਲਿੰਕ ਦੁਬਾਰਾ ਵੇਖੋ, ਜਾਂ ਕੰਪਨੀ ਨਾਲ ਸਿੱਧਾ ਸੰਪਰਕ ਕਰੋ।",

      aboutEstimate: (number) => `ਤੁਹਾਡੇ ਹਵਾਲੇ ${number} ਬਾਰੇ`,

      whenLabel: "ਕਦੋਂ",
      whereLabel: "ਕਿੱਥੇ",
      modeVisit: "ਅਸੀਂ ਤੁਹਾਡੇ ਕੋਲ ਆ ਰਹੇ ਹਾਂ",
      modeCall: "ਫ਼ੋਨ ਕਾਲ — ਅਸੀਂ ਤੁਹਾਨੂੰ ਫ਼ੋਨ ਕਰਾਂਗੇ",
      modeVideo: "ਵੀਡੀਓ ਕਾਲ — ਅਸੀਂ ਈਮੇਲ ਰਾਹੀਂ ਲਿੰਕ ਭੇਜਾਂਗੇ",
      addressUnknown: "ਪਤਾ ਬਾਅਦ ਵਿੱਚ ਪੱਕਾ ਕੀਤਾ ਜਾਵੇਗਾ",
      depositPaid: (amount) => `${amount} ਪੇਸ਼ਗੀ ਅਦਾ ਕੀਤੀ ਗਈ`,

      changeHeading: "ਕੁਝ ਬਦਲਣਾ ਹੈ?",
      rescheduleCta: "ਸਮਾਂ ਬਦਲੋ",
      cancelCta: "ਇਹ ਮੁਲਾਕਾਤ ਰੱਦ ਕਰੋ",

      cannotCancelled: "ਇਹ ਮੁਲਾਕਾਤ ਪਹਿਲਾਂ ਹੀ ਰੱਦ ਹੋ ਚੁੱਕੀ ਹੈ।",
      cannotHappened: "ਇਹ ਮੁਲਾਕਾਤ ਪਹਿਲਾਂ ਹੀ ਹੋ ਚੁੱਕੀ ਹੈ।",
      cannotAwaitingPayment:
        "ਇਹ ਮੁਲਾਕਾਤ ਹਾਲੇ ਪੱਕੀ ਨਹੀਂ ਹੋਈ — ਭੁਗਤਾਨ ਪੂਰਾ ਨਹੀਂ ਹੋਇਆ।",
      cannotNotFound: "ਇਹ ਲਿੰਕ ਕਿਸੇ ਮੁਲਾਕਾਤ ਨਾਲ ਮੇਲ ਨਹੀਂ ਖਾਂਦਾ।",
      cannotTooLate: (notice, company) =>
        `${company} ਘੱਟੋ-ਘੱਟ ${notice} ਪਹਿਲਾਂ ਦੱਸਣ ਲਈ ਕਹਿੰਦੇ ਹਨ, ਇਸ ਲਈ ਇਹ ਮੁਲਾਕਾਤ ਹੁਣ ਇੱਥੋਂ ਨਹੀਂ ਬਦਲੀ ਜਾ ਸਕਦੀ।`,
      cannotTooLateNoNotice: (company) =>
        `ਹੁਣ ਤੁਹਾਡੀ ਮੁਲਾਕਾਤ ਇੰਨੀ ਨੇੜੇ ਹੈ ਕਿ ${company} ਇੱਥੋਂ ਤਬਦੀਲੀ ਨਹੀਂ ਲੈ ਸਕਦੇ।`,
      noticeHours: (n) => (n === 1 ? "1 ਘੰਟਾ" : `${n} ਘੰਟੇ`),
      callInstead: (company, phone) =>
        phone
          ? `${company} ਨੂੰ ${phone} 'ਤੇ ਫ਼ੋਨ ਕਰੋ — ਉਹ ਹਾਲੇ ਵੀ ਤੁਹਾਡੇ ਲਈ ਸਮਾਂ ਬਦਲ ਸਕਦੇ ਹਨ।`
          : `${company} ਨਾਲ ਸੰਪਰਕ ਕਰੋ — ਉਹ ਹਾਲੇ ਵੀ ਤੁਹਾਡੇ ਲਈ ਸਮਾਂ ਬਦਲ ਸਕਦੇ ਹਨ।`,

      refundYes: (amount) =>
        `ਤੁਹਾਡੀ ${amount} ਪੇਸ਼ਗੀ ਉਸੇ ਕਾਰਡ 'ਤੇ ਵਾਪਸ ਕੀਤੀ ਜਾਵੇਗੀ ਜਿਸ ਨਾਲ ਤੁਸੀਂ ਭੁਗਤਾਨ ਕੀਤਾ ਸੀ।`,
      refundNo: (amount) =>
        `ਤੁਹਾਡੀ ${amount} ਪੇਸ਼ਗੀ ਆਪਣੇ ਆਪ ਵਾਪਸ ਨਹੀਂ ਹੁੰਦੀ — ਇਸ ਬਾਰੇ ਉਨ੍ਹਾਂ ਨਾਲ ਸੰਪਰਕ ਕਰੋ।`,
      refundAlready: (amount) =>
        `ਤੁਹਾਡੀ ${amount} ਪੇਸ਼ਗੀ ਪਹਿਲਾਂ ਹੀ ਵਾਪਸ ਕਰ ਦਿੱਤੀ ਗਈ ਹੈ।`,

      cancelConfirmTitle: "ਇਹ ਮੁਲਾਕਾਤ ਰੱਦ ਕਰਨੀ ਹੈ?",
      cancelConfirmBody: (company) =>
        `${company} ਨੂੰ ਤੁਰੰਤ ਦੱਸ ਦਿੱਤਾ ਜਾਵੇਗਾ ਅਤੇ ਤੁਹਾਡਾ ਸਮਾਂ ਖਾਲੀ ਹੋ ਜਾਵੇਗਾ।`,
      yesCancel: "ਹਾਂ, ਰੱਦ ਕਰੋ",
      keepIt: "ਮੇਰੀ ਮੁਲਾਕਾਤ ਰਹਿਣ ਦਿਓ",
      cancelledTitle: "ਮੁਲਾਕਾਤ ਰੱਦ ਕੀਤੀ ਗਈ",
      cancelledBody: (company) =>
        `${company} ਨੂੰ ਦੱਸ ਦਿੱਤਾ ਗਿਆ ਹੈ। ਜੇ ਇਹ ਗਲਤੀ ਸੀ, ਤਾਂ ਉਨ੍ਹਾਂ ਨਾਲ ਸੰਪਰਕ ਕਰੋ ਅਤੇ ਉਹ ਤੁਹਾਨੂੰ ਹੋਰ ਸਮਾਂ ਦੇ ਦੇਣਗੇ।`,
      cancelledRefunded: (amount) =>
        `ਤੁਹਾਡੀ ${amount} ਪੇਸ਼ਗੀ ਵਾਪਸ ਆ ਰਹੀ ਹੈ। ਸਟੇਟਮੈਂਟ 'ਤੇ ਦਿਸਣ ਵਿੱਚ ਕੁਝ ਦਿਨ ਲੱਗ ਸਕਦੇ ਹਨ।`,

      rescheduleTitle: "ਨਵਾਂ ਸਮਾਂ ਚੁਣੋ",
      rescheduleKeep: "ਮੌਜੂਦਾ ਸਮਾਂ ਹੀ ਰੱਖੋ",
      findingTimes: "ਸਮਾਂ ਲੱਭ ਰਹੇ ਹਾਂ…",
      timesFailed: "ਅਸੀਂ ਇਸ ਵੇਲੇ ਉਪਲਬਧ ਸਮੇਂ ਲੋਡ ਨਹੀਂ ਕਰ ਸਕੇ।",
      pickADay: "ਸਮੇਂ ਵੇਖਣ ਲਈ ਇੱਕ ਦਿਨ ਚੁਣੋ।",
      morning: "ਸਵੇਰ",
      afternoon: "ਦੁਪਹਿਰ",
      evening: "ਸ਼ਾਮ",
      nothingThisMonth: "ਇਸ ਮਹੀਨੇ ਕੁਝ ਵੀ ਖਾਲੀ ਨਹੀਂ।",
      tryNextMonth: "ਅਗਲਾ ਮਹੀਨਾ ਵੇਖੋ",
      prevMonth: "ਪਿਛਲਾ ਮਹੀਨਾ",
      nextMonth: "ਅਗਲਾ ਮਹੀਨਾ",
      confirmNewTime: "ਮੇਰੀ ਮੁਲਾਕਾਤ ਇੱਥੇ ਕਰੋ",
      movedTitle: "ਤੁਹਾਡੀ ਮੁਲਾਕਾਤ ਬਦਲ ਦਿੱਤੀ ਗਈ",
      movedBody: (company) =>
        `${company} ਨੂੰ ਦੱਸ ਦਿੱਤਾ ਗਿਆ ਹੈ, ਅਤੇ ਨਵੀਂ ਪੁਸ਼ਟੀ ਤੁਹਾਨੂੰ ਭੇਜੀ ਜਾ ਰਹੀ ਹੈ।`,

      questions: (company, phone) =>
        phone
          ? `ਸਵਾਲ? ${company} ਨੂੰ ${phone} 'ਤੇ ਫ਼ੋਨ ਕਰੋ।`
          : `ਸਵਾਲ? ${company} ਨਾਲ ਸੰਪਰਕ ਕਰੋ।`,

      slotTaken: "ਇਹ ਸਮਾਂ ਹੁਣੇ ਕਿਸੇ ਹੋਰ ਨੇ ਲੈ ਲਿਆ ਹੈ। ਕੋਈ ਹੋਰ ਚੁਣੋ।",
      tooSoon:
        "ਇਹ ਸਮਾਂ ਉਨ੍ਹਾਂ ਨੂੰ ਕਾਫ਼ੀ ਪਹਿਲਾਂ ਨਹੀਂ ਦੱਸਦਾ। ਕੋਈ ਬਾਅਦ ਵਾਲਾ ਸਮਾਂ ਚੁਣੋ।",
      refundFailed:
        "ਅਸੀਂ ਇਸ ਵੇਲੇ ਤੁਹਾਡੀ ਪੇਸ਼ਗੀ ਵਾਪਸ ਨਹੀਂ ਕਰ ਸਕੇ, ਇਸ ਲਈ ਕੁਝ ਵੀ ਰੱਦ ਨਹੀਂ ਕੀਤਾ ਗਿਆ। ਥੋੜ੍ਹੀ ਦੇਰ ਬਾਅਦ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ, ਜਾਂ ਉਨ੍ਹਾਂ ਨਾਲ ਸੰਪਰਕ ਕਰੋ।",
    },
  },

  tl: {
    approveThisQuote: "Aprubahan ang quote na ito",
    decline: "Tanggihan",
    whatsIncluded: "Ano ang kasama",
    whatCouldChange: "Ano ang maaaring magbago sa presyong ito",
    termsExplained: "Ang mga termino sa quote na ito, ipinaliwanag",
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
    arrangePayment: "Makipag-ugnayan po sa amin para maayos ang bayad.",
    acceptedMethods: (methods) => `Tinatanggap: ${methods}.`,

    selfQuote: {
      documentWord: "Kahilingan",
      eyebrow: "Humiling ng quote",
      languageLabel: "Wika",

      step1Title: "Ano ang maitutulong namin?",
      step1Hint: "Piliin ang pinakamalapit — kami na ang bahala sa detalye.",
      noServices: (phone) =>
        `Hindi pa naisaayos ng kumpanyang ito ang kanilang mga serbisyo. Makipag-ugnayan nang diretso sa kanila${phone ? ` sa ${phone}` : ""}.`,

      step2Hint: "Tantiya lang ay sapat na — walang binding dito.",
      timelineLabel: "Kailan ninyo balak magsimula?",
      timelineAsap: "Sa lalong madaling panahon",
      timeline2Weeks: "Sa loob ng 2 linggo",
      timeline1To3Months: "Sa susunod na 1–3 buwan",
      timelineExploring: "Nagtatanong pa lang sa ngayon",
      budgetLabel: "Tantiyang budget?",
      optional: "(opsyonal)",
      budgetUnder: (s) => `Mababa sa ${s}1,000`,
      budgetLow: (s) => `${s}1,000 – ${s}5,000`,
      budgetMid: (s) => `${s}5,000 – ${s}15,000`,
      budgetHigh: (s) => `${s}15,000 pataas`,
      budgetUnsure: "Hindi pa sigurado",
      notesLabel: "May iba pa bang dapat naming malaman?",
      notesPlaceholder: "Mga larawan, oras, daanan, anumang hindi karaniwan…",
      continueCta: "Magpatuloy",

      step3Title: "Saan namin ipapadala?",
      step3Hint: "Sapat na ang email o telepono.",
      namePlaceholder: "Pangalan ninyo",
      emailPlaceholder: "Email",
      phonePlaceholder: "Telepono",
      addressPlaceholder: "Saan ang trabaho? (opsyonal)",

      uploadLabel: "Magdagdag ng mga larawan, video o PDF na plano",
      uploadHint:
        "Nakakatulong ang larawan, maikling clip o ang PDF mong plano para tumpak ang aming presyo.",
      uploadDocumentFallback: "PDF na plano",
      back: "Bumalik",
      sendCta: "Ipadala ang kahilingan ko",
      noObligation: (company) =>
        `Walang obligasyon. Babalikan kayo ng ${company} na may presyo.`,

      errName: "Pakisabi po ang pangalan ninyo.",
      errContact:
        "Magdagdag ng email o numero ng telepono para makasagot kami.",
      errSend: "Hindi naipadala ang kahilingan ninyo.",
      linkInvalid: "Hindi wasto ang link na ito.",
      linkInvalidHint:
        "Suriin ang link, o makipag-ugnayan nang diretso sa kumpanya.",

      confirmTitle: "Natanggap ang kahilingan",
      confirmIntro: (company) =>
        `Nasa ${company} na ang lahat ng nasa ibaba at babalikan kayo nila na may presyo.`,
      requestedHeading: "Ang hiniling ninyo",
      nextHeading: "Ano ang susunod",
      next1Title: "Babasahin nila ito",
      next1Body:
        "Diretsong dumarating sa kumpanya ang mga sagot ninyo, kasama ang anumang inilakip ninyo.",
      next2Title: "Pipresyuhan nila ito",
      next2Body:
        "May taong kumakalkula ng tunay na halaga ng trabaho ninyo — walang awtomatikong pagpepresyo dito.",
      next3Title: "Makakatanggap kayo ng quote",
      next3Body:
        "Darating ito bilang dokumento na mababasa, matatanong at maaaprubahan ninyo. Walang napagkakasunduan hangga't hindi ninyo ginagawa iyon.",
      estimateLabel: "Tantiyang saklaw",
      beforeTax: "bago ang buwis",
      gatedNote:
        "Wala pang presyong ipinapakita — hindi pa napepresyuhan ang kahilingang ito. Sinadya iyon: ang halagang matatanggap ninyo ay isang panindigan ng tao.",
      submittedLabel: "Ipinadala noong",
      copySentTo: (email) => `Papadala na ang kopya sa ${email}.`,
      callInstead: "Kailangan ninyo agad?",
      // The in-person visit offered under the confirmation. Only rendered when
      // the company can actually take a booking — see lib/booking/canBookVisit.js.
      bookVisitTitle: "Gusto ninyo bang puntahan namin?",
      bookVisitBody:
        "Mag-book ng personal na pagbisita at kumpirmahin namin ang presyo ninyo doon mismo.",
      bookVisitCta: "Mag-book ng pagbisita",

      emailSubject: (company) => `Ang kahilingan ninyo sa ${company}`,
      emailIntro: (company) =>
        `Salamat — natanggap na ng ${company} ang kahilingan ninyo. Narito ang ipinadala ninyo, para sa talaan ninyo.`,
    },

    visit: {
      eyebrow: "Ang inyong pagbisita",
      loadFailed: "Hindi namin ma-load ang inyong pagbisita.",
      loadFailedHint:
        "Tingnan ulit ang link sa email ninyo, o direktang makipag-ugnayan sa kumpanya.",

      aboutEstimate: (number) => `Tungkol sa inyong quote ${number}`,

      whenLabel: "Kailan",
      whereLabel: "Saan",
      modeVisit: "Pupunta kami sa inyo",
      modeCall: "Tawag sa telepono — tatawagan namin kayo",
      modeVideo: "Video call — magpapadala kami ng link sa email",
      addressUnknown: "Kukumpirmahin pa ang address",
      depositPaid: (amount) => `Bayad na ang ${amount} na deposito`,

      changeHeading: "May gusto kayong baguhin?",
      rescheduleCta: "Palitan ang oras",
      cancelCta: "Kanselahin ang pagbisitang ito",

      cannotCancelled: "Nakansela na ang pagbisitang ito.",
      cannotHappened: "Naganap na ang pagbisitang ito.",
      cannotAwaitingPayment:
        "Hindi pa kumpirmado ang pagbisitang ito — hindi pa natatapos ang bayad.",
      cannotNotFound: "Walang pagbisitang tumutugma sa link na ito.",
      cannotTooLate: (notice, company) =>
        `Humihingi ang ${company} ng abiso nang hindi bababa sa ${notice}, kaya hindi na ito mababago rito.`,
      cannotTooLateNoNotice: (company) =>
        `Masyado nang malapit ang inyong appointment para tanggapin dito ng ${company} ang pagbabago.`,
      noticeHours: (n) => (n === 1 ? "1 oras" : `${n} oras`),
      callInstead: (company, phone) =>
        phone
          ? `Tawagan ang ${company} sa ${phone} — maaari pa rin nilang ilipat ito para sa inyo.`
          : `Makipag-ugnayan sa ${company} — maaari pa rin nilang ilipat ito para sa inyo.`,

      refundYes: (amount) =>
        `Ibabalik ang inyong ${amount} na deposito sa card na ginamit ninyong pambayad.`,
      refundNo: (amount) =>
        `Hindi awtomatikong naibabalik ang inyong ${amount} na deposito — makipag-ugnayan sa kanila tungkol dito.`,
      refundAlready: (amount) =>
        `Naibalik na ang inyong ${amount} na deposito.`,

      cancelConfirmTitle: "Kanselahin ang pagbisitang ito?",
      cancelConfirmBody: (company) =>
        `Agad na maaabisuhan ang ${company}, at mababakante ang oras ninyo.`,
      yesCancel: "Oo, kanselahin",
      keepIt: "Panatilihin ang pagbisita ko",
      cancelledTitle: "Nakansela ang pagbisita",
      cancelledBody: (company) =>
        `Naabisuhan na ang ${company}. Kung nagkamali kayo, makipag-ugnayan sa kanila at ihahanap nila kayo ng ibang oras.`,
      cancelledRefunded: (amount) =>
        `Pabalik na ang inyong ${amount} na deposito. Maaaring tumagal ng ilang araw bago ito lumabas sa statement ninyo.`,

      rescheduleTitle: "Pumili ng bagong oras",
      rescheduleKeep: "Panatilihin ang kasalukuyang oras",
      findingTimes: "Naghahanap ng oras…",
      timesFailed: "Hindi namin ma-load ang mga available na oras ngayon.",
      pickADay: "Pumili ng araw para makita ang mga oras.",
      morning: "Umaga",
      afternoon: "Hapon",
      evening: "Gabi",
      nothingThisMonth: "Walang bakante ngayong buwan.",
      tryNextMonth: "Subukan ang susunod na buwan",
      prevMonth: "Nakaraang buwan",
      nextMonth: "Susunod na buwan",
      confirmNewTime: "Ilipat dito ang pagbisita ko",
      movedTitle: "Nailipat na ang inyong pagbisita",
      movedBody: (company) =>
        `Naabisuhan na ang ${company}, at padating na ang bagong kumpirmasyon ninyo.`,

      questions: (company, phone) =>
        phone
          ? `May tanong? Tawagan ang ${company} sa ${phone}.`
          : `May tanong? Makipag-ugnayan sa ${company}.`,

      slotTaken: "Kakakuha lang sa oras na iyon. Pumili ng iba.",
      tooSoon:
        "Masyadong maikli ang abiso sa oras na iyon. Pumili ng mas huli.",
      refundFailed:
        "Hindi namin naibalik ang deposito ninyo ngayon, kaya walang nakanselang anuman. Subukan ulit maya-maya, o makipag-ugnayan sa kanila.",
    },
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
