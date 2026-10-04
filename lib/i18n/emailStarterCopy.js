// lib/i18n/emailStarterCopy.js
//
// The words of FieldQuo's starter email templates, in every document language.
//
// ══ Why a catalogue, and not the model ═════════════════════════════════════
//
// A starter template is FieldQuo's text, handed to a company to edit — the
// same kind of string as every other catalogue in lib/i18n. Until 2026-10-03
// it was English for every company (app/data/emailTemplateBlocks.js held the
// sentences inline), so a francophone contractor in Gatineau opened "Your
// quote is ready" and had to translate FieldQuo's own starter by hand before
// it could go anywhere. These are hand-written, reviewed like the rest of the
// catalogues, and cost nothing at runtime. The model only ever translates a
// company's OWN wording (lib/email/templateTranslation.js) — never this file.
//
// ══ Which language a starter is created in ═════════════════════════════════
//
// The COMPANY's (Company.defaultLanguage), when the company creates a template
// from a starter or seeds the defaults. A template is authored in the
// company's language; the version a client in another language receives is a
// reviewed translation of THAT (lib/email/templateTranslation.js), and the
// template row records which language it was written in
// (DocumentTemplate.language).
//
// ══ Merge tokens are not words ═════════════════════════════════════════════
//
// Every {{token}} in an English string appears, unchanged and the same number
// of times, in every translation. scripts/check-email-template-translation.mjs
// holds that with the same verifier the AI translations are held to — a
// starter that dropped {{clientName}} in Punjabi would greet nobody.
//
// The progress block's stage names are NOT here: they are stored in English
// (LIFECYCLE_STAGES) and translated at RENDER time into the reader's language
// by lib/email/renderTemplateSections.js's stageLabel, which is better than a
// stored translation — a French company's quote email to an English client
// says "Quote", not "Devis".

export const STARTER_COPY = {
  en: {
    subjects: {
      quote_email: "Your quote from {{companyName}} is ready",
      instructions_email: "You're booked in — what to expect on {{projectStartDate}}",
      receipt_email: "Payment received — thank you, {{clientName}}",
      follow_up_email: "Still thinking it over, {{clientName}}?",
      marketing_email: "A note from {{companyName}}",
      custom_email: "A message from {{companyName}}",
    },
    quote: {
      heading: "Your quote is ready",
      intro:
        "Hi {{clientName}},\n\nThank you for the opportunity to earn your business. We've put together a detailed quote for {{jobTitle}} — everything is broken out below so you can see exactly what's included.\n\nJob address: {{clientAddress}}",
      lineItemsTitle: "Your quote",
      button: "View & approve your quote",
      includes:
        "Every job includes:\n• Full preparation and protection of the surrounding area\n• Premium materials and professional application\n• Complete cleanup and a final walkthrough with you\n• Our workmanship guarantee",
      closing:
        "Questions, or want to adjust anything? Just reply to this email or give us a call — we're happy to talk it through.",
    },
    instructions: {
      heading: "You're all set",
      intro:
        "Hi {{clientName}},\n\nGreat news — {{jobTitle}} is confirmed and on the schedule. Here's everything you need to know before we arrive.",
      booking:
        "Your booking:\n• Address — {{clientAddress}}\n• Start date — {{projectStartDate}}\n• Estimated completion — {{projectEndDate}}",
      prepare:
        "How to prepare:\n• Clear the work area of personal items and furniture where possible\n• Make sure we have clear access to the job site on the start date\n• Keep pets in a separate area during work hours\n• We'll walk you through the finished work before we call the job complete",
      closing: "Something come up? Let us know as early as you can and we'll find another slot.",
    },
    receipt: {
      heading: "Payment received — thank you",
      intro:
        "Hi {{clientName}},\n\nThis confirms we've received your payment of {{amountPaid}}. Here's your receipt.",
      lineItemsTitle: "Receipt",
      balance: "Balance remaining: {{balanceDue}}",
      button: "View your invoice",
      closing: "Thank you for your business — we genuinely appreciate it.",
    },
    followUp: {
      heading: "Still thinking it over?",
      intro:
        "Hi {{clientName}},\n\nWe wanted to check in on quote #{{quoteNumber}} for {{jobTitle}}. It's still available at {{quoteTotal}}, and we'd love to get you on the schedule.\n\nIf anything's holding you up — timing, budget, scope — just reply and tell us. We can usually work something out.",
      button: "View your quote",
      closing: "No longer need it? Reply and let us know, and we'll stop following up.",
    },
    marketing: {
      heading: "A quick note from {{companyName}}",
      intro:
        "Hi {{clientName}},\n\nWrite your message here — an offer, a seasonal reminder, or an update about your business.",
      imageAlt: "Add a photo of your work",
      button: "Get a free quote",
      footer: "You're receiving this because you're a customer of {{companyName}}.",
    },
    custom: {
      heading: "Hello {{clientName}}",
    },
    // What a block says the moment it is added in the editor.
    blockDefaults: {
      heading: "Heading text",
      text: "Write a paragraph here…",
      button: "Click here",
    },
  },

  fr: {
    subjects: {
      quote_email: "Votre soumission de {{companyName}} est prête",
      instructions_email: "Votre réservation est confirmée — à quoi vous attendre le {{projectStartDate}}",
      receipt_email: "Paiement reçu — merci, {{clientName}}",
      follow_up_email: "Vous y pensez encore, {{clientName}} ?",
      marketing_email: "Un mot de {{companyName}}",
      custom_email: "Un message de {{companyName}}",
    },
    quote: {
      heading: "Votre soumission est prête",
      intro:
        "Bonjour {{clientName}},\n\nMerci de nous donner l'occasion de travailler pour vous. Nous avons préparé une soumission détaillée pour {{jobTitle}} — tout est ventilé ci-dessous pour que vous voyiez exactement ce qui est inclus.\n\nAdresse des travaux : {{clientAddress}}",
      lineItemsTitle: "Votre soumission",
      button: "Consulter et approuver votre soumission",
      includes:
        "Chaque projet comprend :\n• La préparation complète et la protection des surfaces environnantes\n• Des matériaux haut de gamme et une application professionnelle\n• Un nettoyage complet et une visite finale avec vous\n• Notre garantie sur la main-d'œuvre",
      closing:
        "Des questions, ou envie de modifier quelque chose ? Répondez simplement à ce courriel ou appelez-nous — nous en discuterons volontiers.",
    },
    instructions: {
      heading: "Tout est prêt",
      intro:
        "Bonjour {{clientName}},\n\nBonne nouvelle — {{jobTitle}} est confirmé et inscrit à notre calendrier. Voici tout ce que vous devez savoir avant notre arrivée.",
      booking:
        "Votre réservation :\n• Adresse — {{clientAddress}}\n• Date de début — {{projectStartDate}}\n• Fin prévue — {{projectEndDate}}",
      prepare:
        "Comment vous préparer :\n• Dans la mesure du possible, dégagez la zone de travail des objets personnels et des meubles\n• Assurez-nous un accès libre au chantier à la date de début\n• Gardez vos animaux dans une autre pièce pendant les heures de travail\n• Nous ferons le tour des travaux terminés avec vous avant de considérer le projet comme achevé",
      closing: "Un imprévu ? Prévenez-nous le plus tôt possible et nous trouverons une autre plage horaire.",
    },
    receipt: {
      heading: "Paiement reçu — merci",
      intro:
        "Bonjour {{clientName}},\n\nNous confirmons la réception de votre paiement de {{amountPaid}}. Voici votre reçu.",
      lineItemsTitle: "Reçu",
      balance: "Solde restant : {{balanceDue}}",
      button: "Voir votre facture",
      closing: "Merci de votre confiance — nous l'apprécions sincèrement.",
    },
    followUp: {
      heading: "Vous y pensez encore ?",
      intro:
        "Bonjour {{clientName}},\n\nNous voulions faire le point sur la soumission n° {{quoteNumber}} pour {{jobTitle}}. Elle est toujours offerte au prix de {{quoteTotal}}, et nous serions ravis de vous inscrire à notre calendrier.\n\nSi quelque chose vous retient — le moment, le budget, l'étendue des travaux — répondez-nous simplement. Nous trouvons généralement une solution.",
      button: "Voir votre soumission",
      closing: "Vous n'en avez plus besoin ? Répondez-nous pour nous le dire et nous cesserons nos relances.",
    },
    marketing: {
      heading: "Un petit mot de {{companyName}}",
      intro:
        "Bonjour {{clientName}},\n\nÉcrivez votre message ici — une offre, un rappel saisonnier ou des nouvelles de votre entreprise.",
      imageAlt: "Ajoutez une photo de vos réalisations",
      button: "Obtenir une soumission gratuite",
      footer: "Vous recevez ce courriel parce que vous êtes client de {{companyName}}.",
    },
    custom: {
      heading: "Bonjour {{clientName}}",
    },
    blockDefaults: {
      heading: "Texte du titre",
      text: "Écrivez un paragraphe ici…",
      button: "Cliquez ici",
    },
  },

  es: {
    subjects: {
      quote_email: "Su presupuesto de {{companyName}} está listo",
      instructions_email: "Su reserva está confirmada — qué esperar el {{projectStartDate}}",
      receipt_email: "Pago recibido — gracias, {{clientName}}",
      follow_up_email: "¿Todavía lo está pensando, {{clientName}}?",
      marketing_email: "Una nota de {{companyName}}",
      custom_email: "Un mensaje de {{companyName}}",
    },
    quote: {
      heading: "Su presupuesto está listo",
      intro:
        "Hola {{clientName}}:\n\nGracias por la oportunidad de trabajar con usted. Hemos preparado un presupuesto detallado para {{jobTitle}}; todo está desglosado a continuación para que vea exactamente qué incluye.\n\nDirección del trabajo: {{clientAddress}}",
      lineItemsTitle: "Su presupuesto",
      button: "Ver y aprobar su presupuesto",
      includes:
        "Todos nuestros trabajos incluyen:\n• Preparación completa y protección del área circundante\n• Materiales de primera calidad y aplicación profesional\n• Limpieza completa y una revisión final con usted\n• Nuestra garantía de mano de obra",
      closing:
        "¿Tiene preguntas o quiere ajustar algo? Simplemente responda a este correo o llámenos; con gusto lo conversamos.",
    },
    instructions: {
      heading: "Todo está listo",
      intro:
        "Hola {{clientName}}:\n\nBuenas noticias: {{jobTitle}} está confirmado y en nuestro calendario. Esto es todo lo que necesita saber antes de que lleguemos.",
      booking:
        "Su reserva:\n• Dirección — {{clientAddress}}\n• Fecha de inicio — {{projectStartDate}}\n• Finalización estimada — {{projectEndDate}}",
      prepare:
        "Cómo prepararse:\n• En la medida de lo posible, despeje el área de trabajo de objetos personales y muebles\n• Asegúrese de que tengamos acceso libre al lugar de trabajo en la fecha de inicio\n• Mantenga a sus mascotas en un área separada durante el horario de trabajo\n• Revisaremos con usted el trabajo terminado antes de darlo por concluido",
      closing: "¿Surgió algún imprevisto? Avísenos lo antes posible y buscaremos otra fecha.",
    },
    receipt: {
      heading: "Pago recibido — gracias",
      intro:
        "Hola {{clientName}}:\n\nLe confirmamos que hemos recibido su pago de {{amountPaid}}. Aquí tiene su recibo.",
      lineItemsTitle: "Recibo",
      balance: "Saldo pendiente: {{balanceDue}}",
      button: "Ver su factura",
      closing: "Gracias por su confianza; de verdad lo apreciamos.",
    },
    followUp: {
      heading: "¿Todavía lo está pensando?",
      intro:
        "Hola {{clientName}}:\n\nQueríamos darle seguimiento al presupuesto n.º {{quoteNumber}} para {{jobTitle}}. Sigue disponible por {{quoteTotal}} y nos encantaría incluirlo en nuestro calendario.\n\nSi algo lo detiene —los tiempos, el presupuesto, el alcance—, simplemente responda y cuéntenos. Por lo general encontramos una solución.",
      button: "Ver su presupuesto",
      closing: "¿Ya no lo necesita? Responda y avísenos, y dejaremos de darle seguimiento.",
    },
    marketing: {
      heading: "Una breve nota de {{companyName}}",
      intro:
        "Hola {{clientName}}:\n\nEscriba aquí su mensaje: una oferta, un recordatorio de temporada o una novedad sobre su empresa.",
      imageAlt: "Agregue una foto de su trabajo",
      button: "Pida un presupuesto gratis",
      footer: "Recibe este correo porque es cliente de {{companyName}}.",
    },
    custom: {
      heading: "Hola {{clientName}}",
    },
    blockDefaults: {
      heading: "Texto del título",
      text: "Escriba un párrafo aquí…",
      button: "Haga clic aquí",
    },
  },

  uk: {
    subjects: {
      quote_email: "Ваш кошторис від {{companyName}} готовий",
      instructions_email: "Ваш запис підтверджено — чого очікувати {{projectStartDate}}",
      receipt_email: "Оплату отримано — дякуємо, {{clientName}}",
      follow_up_email: "Ще обмірковуєте, {{clientName}}?",
      marketing_email: "Повідомлення від {{companyName}}",
      custom_email: "Лист від {{companyName}}",
    },
    quote: {
      heading: "Ваш кошторис готовий",
      intro:
        "Вітаємо, {{clientName}}!\n\nДякуємо за можливість попрацювати для вас. Ми підготували детальний кошторис для {{jobTitle}} — нижче все розписано, щоб ви точно бачили, що входить у вартість.\n\nАдреса робіт: {{clientAddress}}",
      lineItemsTitle: "Ваш кошторис",
      button: "Переглянути й затвердити кошторис",
      includes:
        "Кожна робота включає:\n• Повну підготовку та захист прилеглої площі\n• Матеріали преміум-класу та професійне виконання\n• Повне прибирання та фінальний огляд разом із вами\n• Нашу гарантію на роботу",
      closing:
        "Є запитання або хочете щось змінити? Просто дайте відповідь на цей лист або зателефонуйте нам — ми охоче все обговоримо.",
    },
    instructions: {
      heading: "Усе готово",
      intro:
        "Вітаємо, {{clientName}}!\n\nЧудова новина — {{jobTitle}} підтверджено й внесено до графіка. Ось усе, що потрібно знати до нашого приїзду.",
      booking:
        "Ваш запис:\n• Адреса — {{clientAddress}}\n• Дата початку — {{projectStartDate}}\n• Орієнтовне завершення — {{projectEndDate}}",
      prepare:
        "Як підготуватися:\n• За можливості звільніть робочу зону від особистих речей і меблів\n• Забезпечте нам вільний доступ до об'єкта в день початку робіт\n• Тримайте домашніх тварин в окремому приміщенні в робочі години\n• Перед завершенням робіт ми разом із вами оглянемо результат",
      closing: "Щось змінилося? Повідомте нас якомога раніше, і ми знайдемо інший час.",
    },
    receipt: {
      heading: "Оплату отримано — дякуємо",
      intro:
        "Вітаємо, {{clientName}}!\n\nПідтверджуємо, що ми отримали ваш платіж на суму {{amountPaid}}. Ось ваша квитанція.",
      lineItemsTitle: "Квитанція",
      balance: "Залишок до сплати: {{balanceDue}}",
      button: "Переглянути рахунок",
      closing: "Дякуємо, що обрали нас, — ми щиро це цінуємо.",
    },
    followUp: {
      heading: "Ще обмірковуєте?",
      intro:
        "Вітаємо, {{clientName}}!\n\nХотіли нагадати про кошторис № {{quoteNumber}} для {{jobTitle}}. Він досі дійсний за ціною {{quoteTotal}}, і ми будемо раді внести вас до графіка.\n\nЯкщо вас щось стримує — терміни, бюджет, обсяг робіт — просто напишіть нам у відповідь. Зазвичай ми знаходимо рішення.",
      button: "Переглянути кошторис",
      closing: "Більше не актуально? Напишіть нам у відповідь, і ми перестанемо нагадувати.",
    },
    marketing: {
      heading: "Коротке повідомлення від {{companyName}}",
      intro:
        "Вітаємо, {{clientName}}!\n\nНапишіть тут своє повідомлення — пропозицію, сезонне нагадування чи новину про вашу компанію.",
      imageAlt: "Додайте фото вашої роботи",
      button: "Отримати безкоштовний кошторис",
      footer: "Ви отримали цей лист, тому що є клієнтом {{companyName}}.",
    },
    custom: {
      heading: "Вітаємо, {{clientName}}",
    },
    blockDefaults: {
      heading: "Текст заголовка",
      text: "Напишіть тут абзац…",
      button: "Натисніть тут",
    },
  },

  pa: {
    subjects: {
      quote_email: "{{companyName}} ਵੱਲੋਂ ਤੁਹਾਡਾ ਹਵਾਲਾ ਤਿਆਰ ਹੈ",
      instructions_email: "ਤੁਹਾਡੀ ਬੁਕਿੰਗ ਪੱਕੀ ਹੈ — {{projectStartDate}} ਨੂੰ ਕੀ ਉਮੀਦ ਰੱਖਣੀ ਹੈ",
      receipt_email: "ਭੁਗਤਾਨ ਮਿਲ ਗਿਆ — ਧੰਨਵਾਦ, {{clientName}}",
      follow_up_email: "ਕੀ ਤੁਸੀਂ ਅਜੇ ਵੀ ਸੋਚ ਰਹੇ ਹੋ, {{clientName}}?",
      marketing_email: "{{companyName}} ਵੱਲੋਂ ਇੱਕ ਸੁਨੇਹਾ",
      custom_email: "{{companyName}} ਵੱਲੋਂ ਸੁਨੇਹਾ",
    },
    quote: {
      heading: "ਤੁਹਾਡਾ ਹਵਾਲਾ ਤਿਆਰ ਹੈ",
      intro:
        "ਸਤ ਸ੍ਰੀ ਅਕਾਲ {{clientName}},\n\nਸਾਨੂੰ ਤੁਹਾਡਾ ਕੰਮ ਕਰਨ ਦਾ ਮੌਕਾ ਦੇਣ ਲਈ ਧੰਨਵਾਦ। ਅਸੀਂ {{jobTitle}} ਲਈ ਇੱਕ ਵਿਸਥਾਰਪੂਰਵਕ ਹਵਾਲਾ ਤਿਆਰ ਕੀਤਾ ਹੈ — ਹੇਠਾਂ ਸਭ ਕੁਝ ਵੱਖ-ਵੱਖ ਦੱਸਿਆ ਗਿਆ ਹੈ ਤਾਂ ਜੋ ਤੁਸੀਂ ਵੇਖ ਸਕੋ ਕਿ ਇਸ ਵਿੱਚ ਕੀ-ਕੀ ਸ਼ਾਮਲ ਹੈ।\n\nਕੰਮ ਦਾ ਪਤਾ: {{clientAddress}}",
      lineItemsTitle: "ਤੁਹਾਡਾ ਹਵਾਲਾ",
      button: "ਆਪਣਾ ਹਵਾਲਾ ਵੇਖੋ ਅਤੇ ਮਨਜ਼ੂਰ ਕਰੋ",
      includes:
        "ਹਰ ਕੰਮ ਵਿੱਚ ਸ਼ਾਮਲ ਹੈ:\n• ਆਲੇ-ਦੁਆਲੇ ਦੀ ਥਾਂ ਦੀ ਪੂਰੀ ਤਿਆਰੀ ਅਤੇ ਸੁਰੱਖਿਆ\n• ਵਧੀਆ ਸਮਾਨ ਅਤੇ ਪੇਸ਼ੇਵਰ ਕਾਰੀਗਰੀ\n• ਪੂਰੀ ਸਫ਼ਾਈ ਅਤੇ ਤੁਹਾਡੇ ਨਾਲ ਆਖਰੀ ਜਾਂਚ\n• ਸਾਡੇ ਕੰਮ ਦੀ ਗਰੰਟੀ",
      closing:
        "ਕੋਈ ਸਵਾਲ ਹੈ, ਜਾਂ ਕੁਝ ਬਦਲਣਾ ਚਾਹੁੰਦੇ ਹੋ? ਬੱਸ ਇਸ ਈਮੇਲ ਦਾ ਜਵਾਬ ਦਿਓ ਜਾਂ ਸਾਨੂੰ ਫ਼ੋਨ ਕਰੋ — ਅਸੀਂ ਖੁਸ਼ੀ ਨਾਲ ਗੱਲ ਕਰਾਂਗੇ।",
    },
    instructions: {
      heading: "ਸਭ ਕੁਝ ਤਿਆਰ ਹੈ",
      intro:
        "ਸਤ ਸ੍ਰੀ ਅਕਾਲ {{clientName}},\n\nਖੁਸ਼ਖਬਰੀ — {{jobTitle}} ਪੱਕਾ ਹੋ ਗਿਆ ਹੈ ਅਤੇ ਸਮਾਂ-ਸਾਰਣੀ ਵਿੱਚ ਹੈ। ਸਾਡੇ ਆਉਣ ਤੋਂ ਪਹਿਲਾਂ ਤੁਹਾਨੂੰ ਜੋ ਕੁਝ ਜਾਣਨ ਦੀ ਲੋੜ ਹੈ, ਉਹ ਇੱਥੇ ਹੈ।",
      booking:
        "ਤੁਹਾਡੀ ਬੁਕਿੰਗ:\n• ਪਤਾ — {{clientAddress}}\n• ਸ਼ੁਰੂ ਹੋਣ ਦੀ ਮਿਤੀ — {{projectStartDate}}\n• ਅੰਦਾਜ਼ਨ ਪੂਰਾ ਹੋਣਾ — {{projectEndDate}}",
      prepare:
        "ਤਿਆਰੀ ਕਿਵੇਂ ਕਰੀਏ:\n• ਜਿੱਥੋਂ ਤੱਕ ਹੋ ਸਕੇ ਕੰਮ ਵਾਲੀ ਥਾਂ ਤੋਂ ਨਿੱਜੀ ਸਮਾਨ ਅਤੇ ਫ਼ਰਨੀਚਰ ਹਟਾ ਦਿਓ\n• ਯਕੀਨੀ ਬਣਾਓ ਕਿ ਸ਼ੁਰੂ ਵਾਲੇ ਦਿਨ ਸਾਨੂੰ ਕੰਮ ਵਾਲੀ ਥਾਂ ਤੱਕ ਖੁੱਲ੍ਹੀ ਪਹੁੰਚ ਮਿਲੇ\n• ਕੰਮ ਦੇ ਸਮੇਂ ਦੌਰਾਨ ਪਾਲਤੂ ਜਾਨਵਰਾਂ ਨੂੰ ਵੱਖਰੀ ਥਾਂ ਰੱਖੋ\n• ਕੰਮ ਪੂਰਾ ਮੰਨਣ ਤੋਂ ਪਹਿਲਾਂ ਅਸੀਂ ਤੁਹਾਡੇ ਨਾਲ ਮੁਕੰਮਲ ਕੰਮ ਵੇਖਾਂਗੇ",
      closing: "ਕੁਝ ਬਦਲ ਗਿਆ? ਜਿੰਨੀ ਜਲਦੀ ਹੋ ਸਕੇ ਸਾਨੂੰ ਦੱਸੋ, ਅਸੀਂ ਹੋਰ ਸਮਾਂ ਲੱਭ ਲਵਾਂਗੇ।",
    },
    receipt: {
      heading: "ਭੁਗਤਾਨ ਮਿਲ ਗਿਆ — ਧੰਨਵਾਦ",
      intro:
        "ਸਤ ਸ੍ਰੀ ਅਕਾਲ {{clientName}},\n\nਅਸੀਂ ਪੁਸ਼ਟੀ ਕਰਦੇ ਹਾਂ ਕਿ ਸਾਨੂੰ ਤੁਹਾਡਾ {{amountPaid}} ਦਾ ਭੁਗਤਾਨ ਮਿਲ ਗਿਆ ਹੈ। ਇਹ ਤੁਹਾਡੀ ਰਸੀਦ ਹੈ।",
      lineItemsTitle: "ਰਸੀਦ",
      balance: "ਬਾਕੀ ਰਕਮ: {{balanceDue}}",
      button: "ਆਪਣਾ ਬਿੱਲ ਵੇਖੋ",
      closing: "ਸਾਡੇ 'ਤੇ ਭਰੋਸਾ ਕਰਨ ਲਈ ਧੰਨਵਾਦ — ਅਸੀਂ ਸੱਚਮੁੱਚ ਇਸ ਦੀ ਕਦਰ ਕਰਦੇ ਹਾਂ।",
    },
    followUp: {
      heading: "ਕੀ ਤੁਸੀਂ ਅਜੇ ਵੀ ਸੋਚ ਰਹੇ ਹੋ?",
      intro:
        "ਸਤ ਸ੍ਰੀ ਅਕਾਲ {{clientName}},\n\nਅਸੀਂ {{jobTitle}} ਲਈ ਹਵਾਲਾ ਨੰ. {{quoteNumber}} ਬਾਰੇ ਪੁੱਛਣਾ ਚਾਹੁੰਦੇ ਸੀ। ਇਹ ਅਜੇ ਵੀ {{quoteTotal}} ਵਿੱਚ ਉਪਲਬਧ ਹੈ, ਅਤੇ ਅਸੀਂ ਤੁਹਾਨੂੰ ਸਮਾਂ-ਸਾਰਣੀ ਵਿੱਚ ਸ਼ਾਮਲ ਕਰਕੇ ਖੁਸ਼ ਹੋਵਾਂਗੇ।\n\nਜੇ ਕੋਈ ਗੱਲ ਤੁਹਾਨੂੰ ਰੋਕ ਰਹੀ ਹੈ — ਸਮਾਂ, ਬਜਟ, ਕੰਮ ਦਾ ਦਾਇਰਾ — ਤਾਂ ਬੱਸ ਜਵਾਬ ਦੇ ਕੇ ਦੱਸੋ। ਅਸੀਂ ਅਕਸਰ ਕੋਈ ਹੱਲ ਲੱਭ ਲੈਂਦੇ ਹਾਂ।",
      button: "ਆਪਣਾ ਹਵਾਲਾ ਵੇਖੋ",
      closing: "ਹੁਣ ਲੋੜ ਨਹੀਂ? ਜਵਾਬ ਦੇ ਕੇ ਦੱਸੋ, ਅਸੀਂ ਯਾਦ ਕਰਵਾਉਣਾ ਬੰਦ ਕਰ ਦੇਵਾਂਗੇ।",
    },
    marketing: {
      heading: "{{companyName}} ਵੱਲੋਂ ਇੱਕ ਛੋਟਾ ਜਿਹਾ ਸੁਨੇਹਾ",
      intro:
        "ਸਤ ਸ੍ਰੀ ਅਕਾਲ {{clientName}},\n\nਆਪਣਾ ਸੁਨੇਹਾ ਇੱਥੇ ਲਿਖੋ — ਕੋਈ ਪੇਸ਼ਕਸ਼, ਮੌਸਮੀ ਯਾਦ-ਦਹਾਨੀ, ਜਾਂ ਤੁਹਾਡੇ ਕਾਰੋਬਾਰ ਬਾਰੇ ਕੋਈ ਨਵੀਂ ਖ਼ਬਰ।",
      imageAlt: "ਆਪਣੇ ਕੰਮ ਦੀ ਫ਼ੋਟੋ ਜੋੜੋ",
      button: "ਮੁਫ਼ਤ ਹਵਾਲਾ ਲਓ",
      footer: "ਤੁਹਾਨੂੰ ਇਹ ਈਮੇਲ ਇਸ ਲਈ ਮਿਲੀ ਹੈ ਕਿਉਂਕਿ ਤੁਸੀਂ {{companyName}} ਦੇ ਗਾਹਕ ਹੋ।",
    },
    custom: {
      heading: "ਸਤ ਸ੍ਰੀ ਅਕਾਲ {{clientName}}",
    },
    blockDefaults: {
      heading: "ਸਿਰਲੇਖ",
      text: "ਇੱਥੇ ਪੈਰਾ ਲਿਖੋ…",
      button: "ਇੱਥੇ ਕਲਿੱਕ ਕਰੋ",
    },
  },

  tl: {
    subjects: {
      quote_email: "Handa na ang inyong quote mula sa {{companyName}}",
      instructions_email: "Kumpirmado na ang inyong booking — ano ang aasahan sa {{projectStartDate}}",
      receipt_email: "Natanggap na ang bayad — salamat po, {{clientName}}",
      follow_up_email: "Pinag-iisipan pa po ba, {{clientName}}?",
      marketing_email: "Isang mensahe mula sa {{companyName}}",
      custom_email: "Mensahe mula sa {{companyName}}",
    },
    quote: {
      heading: "Handa na ang inyong quote",
      intro:
        "Kumusta {{clientName}},\n\nSalamat po sa pagkakataong makapagtrabaho para sa inyo. Naghanda kami ng detalyadong quote para sa {{jobTitle}} — nakahiwalay ang lahat sa ibaba para makita ninyo kung ano mismo ang kasama.\n\nAddress ng trabaho: {{clientAddress}}",
      lineItemsTitle: "Ang inyong quote",
      button: "Tingnan at aprubahan ang inyong quote",
      includes:
        "Kasama sa bawat trabaho:\n• Kumpletong paghahanda at proteksyon ng paligid\n• De-kalidad na materyales at propesyonal na pagkakagawa\n• Kumpletong paglilinis at huling pagsusuri kasama kayo\n• Ang aming garantiya sa pagkakagawa",
      closing:
        "May tanong po ba, o may gusto kayong baguhin? Sumagot lang sa email na ito o tawagan kami — ikalulugod naming pag-usapan ito.",
    },
    instructions: {
      heading: "Handa na ang lahat",
      intro:
        "Kumusta {{clientName}},\n\nMagandang balita — kumpirmado na at naka-iskedyul ang {{jobTitle}}. Narito ang lahat ng kailangan ninyong malaman bago kami dumating.",
      booking:
        "Ang inyong booking:\n• Address — {{clientAddress}}\n• Petsa ng simula — {{projectStartDate}}\n• Tinatayang pagtatapos — {{projectEndDate}}",
      prepare:
        "Paano maghanda:\n• Hangga't maaari, alisin ang mga personal na gamit at muwebles sa lugar ng trabaho\n• Siguraduhing may maluwag kaming daan papunta sa lugar ng trabaho sa araw ng simula\n• Ilagay ang mga alagang hayop sa hiwalay na lugar habang may trabaho\n• Sabay nating titingnan ang natapos na trabaho bago namin ito ituring na tapos",
      closing: "May nagbago po ba? Ipaalam agad sa amin at hahanap kami ng ibang petsa.",
    },
    receipt: {
      heading: "Natanggap na ang bayad — salamat po",
      intro:
        "Kumusta {{clientName}},\n\nKinukumpirma namin na natanggap na namin ang inyong bayad na {{amountPaid}}. Narito ang inyong resibo.",
      lineItemsTitle: "Resibo",
      balance: "Natitirang balanse: {{balanceDue}}",
      button: "Tingnan ang inyong invoice",
      closing: "Salamat po sa pagtitiwala — tunay namin itong pinahahalagahan.",
    },
    followUp: {
      heading: "Pinag-iisipan pa po ba?",
      intro:
        "Kumusta {{clientName}},\n\nNais lang po naming kumustahin ang quote #{{quoteNumber}} para sa {{jobTitle}}. Available pa rin ito sa halagang {{quoteTotal}}, at gusto naming maisama kayo sa iskedyul.\n\nKung may pumipigil sa inyo — oras, budget, saklaw ng trabaho — sumagot lang po at sabihin sa amin. Kadalasan ay may paraan kaming maihahanap.",
      button: "Tingnan ang inyong quote",
      closing: "Hindi na po ba kailangan? Sumagot lang at ipaalam sa amin, at titigil na kami sa pag-follow up.",
    },
    marketing: {
      heading: "Maikling mensahe mula sa {{companyName}}",
      intro:
        "Kumusta {{clientName}},\n\nIsulat dito ang inyong mensahe — isang alok, paalala para sa season, o balita tungkol sa inyong negosyo.",
      imageAlt: "Magdagdag ng larawan ng inyong trabaho",
      button: "Kumuha ng libreng quote",
      footer: "Natatanggap ninyo ito dahil customer kayo ng {{companyName}}.",
    },
    custom: {
      heading: "Kumusta {{clientName}}",
    },
    blockDefaults: {
      heading: "Teksto ng heading",
      text: "Sumulat ng talata dito…",
      button: "I-click dito",
    },
  },

  de: {
    subjects: {
      quote_email: "Ihr Angebot von {{companyName}} ist fertig",
      instructions_email: "Ihr Termin steht — was Sie am {{projectStartDate}} erwartet",
      receipt_email: "Zahlung erhalten — vielen Dank, {{clientName}}",
      follow_up_email: "Noch am Überlegen, {{clientName}}?",
      marketing_email: "Eine Nachricht von {{companyName}}",
      custom_email: "Eine Nachricht von {{companyName}}",
    },
    quote: {
      heading: "Ihr Angebot ist fertig",
      intro:
        "Guten Tag {{clientName}},\n\nvielen Dank, dass Sie uns die Gelegenheit geben, für Sie zu arbeiten. Wir haben ein ausführliches Angebot für {{jobTitle}} erstellt — unten ist alles einzeln aufgeführt, damit Sie genau sehen, was enthalten ist.\n\nAdresse der Baustelle: {{clientAddress}}",
      lineItemsTitle: "Ihr Angebot",
      button: "Angebot ansehen und annehmen",
      includes:
        "Jeder Auftrag umfasst:\n• Gründliche Vorbereitung und Schutz der umliegenden Bereiche\n• Hochwertige Materialien und fachgerechte Ausführung\n• Komplette Reinigung und eine gemeinsame Abnahme mit Ihnen\n• Unsere Garantie auf die Ausführung",
      closing:
        "Fragen, oder möchten Sie etwas ändern? Antworten Sie einfach auf diese E-Mail oder rufen Sie uns an — wir besprechen das gern mit Ihnen.",
    },
    instructions: {
      heading: "Alles ist vorbereitet",
      intro:
        "Guten Tag {{clientName}},\n\ngute Nachrichten — {{jobTitle}} ist bestätigt und eingeplant. Hier finden Sie alles, was Sie vor unserer Ankunft wissen sollten.",
      booking:
        "Ihr Termin:\n• Adresse — {{clientAddress}}\n• Beginn — {{projectStartDate}}\n• Voraussichtliche Fertigstellung — {{projectEndDate}}",
      prepare:
        "So bereiten Sie sich vor:\n• Räumen Sie persönliche Gegenstände und Möbel aus dem Arbeitsbereich, soweit möglich\n• Sorgen Sie dafür, dass wir am Starttag freien Zugang zur Baustelle haben\n• Halten Sie Haustiere während der Arbeitszeiten in einem anderen Bereich\n• Bevor wir den Auftrag abschließen, gehen wir die fertige Arbeit gemeinsam mit Ihnen durch",
      closing: "Ist etwas dazwischengekommen? Sagen Sie uns so früh wie möglich Bescheid, dann finden wir einen anderen Termin.",
    },
    receipt: {
      heading: "Zahlung erhalten — vielen Dank",
      intro:
        "Guten Tag {{clientName}},\n\nhiermit bestätigen wir den Eingang Ihrer Zahlung über {{amountPaid}}. Hier ist Ihre Quittung.",
      lineItemsTitle: "Quittung",
      balance: "Offener Betrag: {{balanceDue}}",
      button: "Rechnung ansehen",
      closing: "Vielen Dank für Ihren Auftrag — wir wissen das sehr zu schätzen.",
    },
    followUp: {
      heading: "Noch am Überlegen?",
      intro:
        "Guten Tag {{clientName}},\n\nwir wollten kurz wegen Angebot Nr. {{quoteNumber}} für {{jobTitle}} nachfragen. Es gilt weiterhin zum Preis von {{quoteTotal}}, und wir würden Sie gern einplanen.\n\nFalls Sie etwas zögern lässt — Zeitpunkt, Budget, Umfang — antworten Sie einfach und sagen Sie es uns. Meist finden wir eine Lösung.",
      button: "Angebot ansehen",
      closing: "Kein Bedarf mehr? Antworten Sie kurz, dann melden wir uns nicht mehr.",
    },
    marketing: {
      heading: "Eine kurze Nachricht von {{companyName}}",
      intro:
        "Guten Tag {{clientName}},\n\nschreiben Sie hier Ihre Nachricht — ein Angebot, eine saisonale Erinnerung oder Neuigkeiten aus Ihrem Betrieb.",
      imageAlt: "Fügen Sie ein Foto Ihrer Arbeit hinzu",
      button: "Kostenloses Angebot anfordern",
      footer: "Sie erhalten diese E-Mail, weil Sie Kunde von {{companyName}} sind.",
    },
    custom: {
      heading: "Guten Tag {{clientName}}",
    },
    blockDefaults: {
      heading: "Überschrift",
      text: "Schreiben Sie hier einen Absatz…",
      button: "Hier klicken",
    },
  },

  it: {
    subjects: {
      quote_email: "Il Suo preventivo di {{companyName}} è pronto",
      instructions_email: "La Sua prenotazione è confermata — cosa aspettarsi il {{projectStartDate}}",
      receipt_email: "Pagamento ricevuto — grazie, {{clientName}}",
      follow_up_email: "Ci sta ancora pensando, {{clientName}}?",
      marketing_email: "Un messaggio da {{companyName}}",
      custom_email: "Un messaggio da {{companyName}}",
    },
    quote: {
      heading: "Il Suo preventivo è pronto",
      intro:
        "Buongiorno {{clientName}},\n\nla ringraziamo per l'opportunità di lavorare per Lei. Abbiamo preparato un preventivo dettagliato per {{jobTitle}}: qui sotto trova ogni voce, così può vedere esattamente cosa è incluso.\n\nIndirizzo dei lavori: {{clientAddress}}",
      lineItemsTitle: "Il Suo preventivo",
      button: "Visualizzi e approvi il preventivo",
      includes:
        "Ogni lavoro comprende:\n• Preparazione completa e protezione delle aree circostanti\n• Materiali di prima qualità e posa professionale\n• Pulizia completa e un sopralluogo finale insieme a Lei\n• La nostra garanzia sulla lavorazione",
      closing:
        "Domande, o vuole modificare qualcosa? Risponda semplicemente a questa email o ci chiami: saremo lieti di parlarne.",
    },
    instructions: {
      heading: "È tutto pronto",
      intro:
        "Buongiorno {{clientName}},\n\nottime notizie: {{jobTitle}} è confermato e in calendario. Ecco tutto ciò che deve sapere prima del nostro arrivo.",
      booking:
        "La Sua prenotazione:\n• Indirizzo — {{clientAddress}}\n• Data di inizio — {{projectStartDate}}\n• Fine prevista — {{projectEndDate}}",
      prepare:
        "Come prepararsi:\n• Per quanto possibile, liberi l'area di lavoro da oggetti personali e mobili\n• Si assicuri che il giorno di inizio potremo accedere liberamente al cantiere\n• Tenga gli animali domestici in un'altra zona durante l'orario di lavoro\n• Prima di considerare concluso il lavoro, lo esamineremo insieme a Lei",
      closing: "È sorto un imprevisto? Ce lo faccia sapere il prima possibile e troveremo un'altra data.",
    },
    receipt: {
      heading: "Pagamento ricevuto — grazie",
      intro:
        "Buongiorno {{clientName}},\n\nle confermiamo di aver ricevuto il Suo pagamento di {{amountPaid}}. Ecco la Sua ricevuta.",
      lineItemsTitle: "Ricevuta",
      balance: "Saldo residuo: {{balanceDue}}",
      button: "Visualizzi la Sua fattura",
      closing: "Grazie per averci scelto: lo apprezziamo davvero.",
    },
    followUp: {
      heading: "Ci sta ancora pensando?",
      intro:
        "Buongiorno {{clientName}},\n\nvolevamo aggiornarci sul preventivo n. {{quoteNumber}} per {{jobTitle}}. È ancora valido a {{quoteTotal}} e saremmo lieti di inserirLa in calendario.\n\nSe qualcosa La frena — i tempi, il budget, la portata dei lavori — ci risponda e ce lo dica. Di solito troviamo una soluzione.",
      button: "Visualizzi il preventivo",
      closing: "Non Le serve più? Ci risponda per farcelo sapere e smetteremo di ricontattarLa.",
    },
    marketing: {
      heading: "Un breve messaggio da {{companyName}}",
      intro:
        "Buongiorno {{clientName}},\n\nscriva qui il Suo messaggio: un'offerta, un promemoria stagionale o una novità sulla Sua attività.",
      imageAlt: "Aggiunga una foto del Suo lavoro",
      button: "Richieda un preventivo gratuito",
      footer: "Riceve questa email perché è cliente di {{companyName}}.",
    },
    custom: {
      heading: "Buongiorno {{clientName}}",
    },
    blockDefaults: {
      heading: "Testo del titolo",
      text: "Scriva qui un paragrafo…",
      button: "Clicchi qui",
    },
  },
};

/** The catalogue's languages — the eight document languages. */
export const STARTER_LANGUAGES = Object.freeze(Object.keys(STARTER_COPY));

/**
 * The starter words for one language. A language the catalogue does not
 * carry gets English — never a mix: the whole block comes from one language,
 * so a starter cannot open in French and close in English.
 */
export function starterCopy(language) {
  const code = String(language || "").toLowerCase();
  return Object.prototype.hasOwnProperty.call(STARTER_COPY, code) ? STARTER_COPY[code] : STARTER_COPY.en;
}

/** The language starterCopy() actually answered in. */
export function starterLanguage(language) {
  const code = String(language || "").toLowerCase();
  return Object.prototype.hasOwnProperty.call(STARTER_COPY, code) ? code : "en";
}
