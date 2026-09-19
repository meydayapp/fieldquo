// lib/prepGuide/copy.js
//
// The FRAME of the preparation guide — title, headings, the sentences that
// carry a name or a date — and the covering email, in every language the
// documents are offered in.
//
// The guide BODY (the checklists) is in content.*.js and exists in en/fr/es.
// The frame is here in all eight because it is thirty short strings, the
// same rule documentLabels.js follows, and a Ukrainian client whose
// checklist is in English should at least read "Client preparation guide"
// and "We are scheduled to arrive on 12 October" in Ukrainian. Held key-for-
// key by scripts/check-language-completeness.mjs.
//
// Functions, not strings, where a value is interpolated: word order for a
// name and a date differs by language (see emailCopy.js).

const COPY = {
  en: {
    title: "Client Preparation Guide",
    subtitle: "What to expect, and how to get ready",
    thankYou: (name, company) => `Thank you, ${name}, for choosing ${company}.`,
    scheduled: (date) => `We are scheduled to arrive on ${date}.`,
    intro:
      "This guide explains how to prepare your home before we arrive and what will happen while we are there. Everything below is for the work on your quote; anything else is a separate line.",
    checklistHeading: "Your home preparation checklist",
    checklistLead: (date) => `Please complete these steps before our arrival on ${date}:`,
    importantLabel: "Important:",
    dayOfHeading: "On the day",
    processHeading: "How the work runs",
    notesHeading: (company) => `A note from ${company}`,
    afterHeading: "After the work",
    documentsHeading: "Technical documents",
    documentsLead: "The specification sheets for what we use on your job. They are attached to this email where they fit, and always available at the links below.",
    closing: "Questions before we arrive? Reply to this email or call us — we would rather answer now than on the morning.",
    // Email
    subject: (company, job, date) => `${company}: how to prepare for ${job} on ${date}`,
    emailIntro: (job, date) =>
      `We are scheduled to start ${job} on ${date}. Here is what to do before we arrive and what to expect while we are there — the full guide is attached as a PDF.`,
    emailChecklistLead: "Before we arrive:",
    emailMoreItems: (n) => `…and ${n} more in the attached guide.`,
    emailDocs: "Technical documents:",
    attachmentName: "Preparation-guide",
    documentLabel: "Preparation guide",
  },
  fr: {
    title: "Guide de préparation du client",
    subtitle: "À quoi s'attendre, et comment vous préparer",
    thankYou: (name, company) => `Merci, ${name}, d'avoir choisi ${company}.`,
    scheduled: (date) => `Nous sommes prévus d'arriver le ${date}.`,
    intro:
      "Ce guide explique comment préparer votre maison avant notre arrivée et comment se déroulera notre présence. Tout ce qui suit concerne les travaux de votre soumission ; le reste est une ligne distincte.",
    checklistHeading: "Liste de préparation de votre maison",
    checklistLead: (date) => `Veuillez compléter ces étapes avant notre arrivée le ${date} :`,
    importantLabel: "Important :",
    dayOfHeading: "Le jour même",
    processHeading: "Déroulement des travaux",
    notesHeading: (company) => `Un mot de ${company}`,
    afterHeading: "Après les travaux",
    documentsHeading: "Documents techniques",
    documentsLead: "Les fiches techniques des produits utilisés sur votre chantier. Elles sont jointes à ce courriel lorsque leur taille le permet, et toujours disponibles aux liens ci-dessous.",
    closing: "Des questions avant notre arrivée ? Répondez à ce courriel ou appelez-nous — mieux vaut y répondre maintenant que le matin même.",
    subject: (company, job, date) => `${company} : comment vous préparer pour ${job} le ${date}`,
    emailIntro: (job, date) =>
      `Nous sommes prévus de commencer ${job} le ${date}. Voici quoi faire avant notre arrivée et à quoi vous attendre pendant notre présence — le guide complet est joint en PDF.`,
    emailChecklistLead: "Avant notre arrivée :",
    emailMoreItems: (n) => `… et ${n} de plus dans le guide joint.`,
    emailDocs: "Documents techniques :",
    attachmentName: "Guide-de-preparation",
    documentLabel: "Guide de préparation",
  },
  es: {
    title: "Guía de preparación para el cliente",
    subtitle: "Qué esperar y cómo prepararse",
    thankYou: (name, company) => `Gracias, ${name}, por elegir a ${company}.`,
    scheduled: (date) => `Tenemos programado llegar el ${date}.`,
    intro:
      "Esta guía explica cómo preparar su casa antes de que lleguemos y qué pasará mientras estemos ahí. Todo lo que sigue es para el trabajo de su cotización; cualquier otra cosa es una línea aparte.",
    checklistHeading: "Lista de preparación de su casa",
    checklistLead: (date) => `Por favor complete estos pasos antes de nuestra llegada el ${date}:`,
    importantLabel: "Importante:",
    dayOfHeading: "El día del trabajo",
    processHeading: "Cómo se desarrolla el trabajo",
    notesHeading: (company) => `Una nota de ${company}`,
    afterHeading: "Después del trabajo",
    documentsHeading: "Documentos técnicos",
    documentsLead: "Las fichas técnicas de los productos que usamos en su trabajo. Van adjuntas a este correo cuando su tamaño lo permite, y siempre están disponibles en los enlaces de abajo.",
    closing: "¿Preguntas antes de que lleguemos? Responda a este correo o llámenos — preferimos contestar ahora que esa mañana.",
    subject: (company, job, date) => `${company}: cómo prepararse para ${job} el ${date}`,
    emailIntro: (job, date) =>
      `Tenemos programado empezar ${job} el ${date}. Esto es lo que hay que hacer antes de que lleguemos y qué esperar mientras estemos ahí — la guía completa va adjunta en PDF.`,
    emailChecklistLead: "Antes de que lleguemos:",
    emailMoreItems: (n) => `… y ${n} más en la guía adjunta.`,
    emailDocs: "Documentos técnicos:",
    attachmentName: "Guia-de-preparacion",
    documentLabel: "Guía de preparación",
  },
  uk: {
    title: "Посібник з підготовки для клієнта",
    subtitle: "Чого очікувати і як підготуватися",
    thankYou: (name, company) => `Дякуємо, ${name}, що обрали ${company}.`,
    scheduled: (date) => `Ми плануємо прибути ${date}.`,
    intro:
      "Цей посібник пояснює, як підготувати ваш дім до нашого приїзду і що відбуватиметься під час робіт. Усе нижче стосується робіт із вашого кошторису; решта — окремий рядок.",
    checklistHeading: "Перелік підготовки вашого дому",
    checklistLead: (date) => `Будь ласка, виконайте ці кроки до нашого приїзду ${date}:`,
    importantLabel: "Важливо:",
    dayOfHeading: "У день робіт",
    processHeading: "Як проходять роботи",
    notesHeading: (company) => `Примітка від ${company}`,
    afterHeading: "Після робіт",
    documentsHeading: "Технічні документи",
    documentsLead: "Технічні характеристики продуктів, які ми використовуємо на вашому об'єкті. Вони додані до цього листа, якщо дозволяє розмір, і завжди доступні за посиланнями нижче.",
    closing: "Є запитання до нашого приїзду? Дайте відповідь на цей лист або зателефонуйте — краще відповісти зараз, ніж того ранку.",
    subject: (company, job, date) => `${company}: як підготуватися до ${job} ${date}`,
    emailIntro: (job, date) =>
      `Ми плануємо розпочати ${job} ${date}. Ось що зробити до нашого приїзду і чого очікувати під час робіт — повний посібник додано у PDF.`,
    emailChecklistLead: "До нашого приїзду:",
    emailMoreItems: (n) => `… і ще ${n} у доданому посібнику.`,
    emailDocs: "Технічні документи:",
    attachmentName: "Posibnyk-z-pidhotovky",
    documentLabel: "Посібник з підготовки",
  },
  pa: {
    title: "ਗਾਹਕ ਤਿਆਰੀ ਗਾਈਡ",
    subtitle: "ਕੀ ਉਮੀਦ ਕਰਨੀ ਹੈ, ਅਤੇ ਤਿਆਰੀ ਕਿਵੇਂ ਕਰਨੀ ਹੈ",
    thankYou: (name, company) => `${name}, ${company} ਨੂੰ ਚੁਣਨ ਲਈ ਧੰਨਵਾਦ।`,
    scheduled: (date) => `ਅਸੀਂ ${date} ਨੂੰ ਪਹੁੰਚਣ ਦੀ ਯੋਜਨਾ ਬਣਾਈ ਹੈ।`,
    intro:
      "ਇਹ ਗਾਈਡ ਦੱਸਦੀ ਹੈ ਕਿ ਸਾਡੇ ਆਉਣ ਤੋਂ ਪਹਿਲਾਂ ਆਪਣੇ ਘਰ ਨੂੰ ਕਿਵੇਂ ਤਿਆਰ ਕਰਨਾ ਹੈ ਅਤੇ ਸਾਡੇ ਉੱਥੇ ਹੁੰਦਿਆਂ ਕੀ ਹੋਵੇਗਾ। ਹੇਠਾਂ ਸਭ ਕੁਝ ਤੁਹਾਡੇ ਕੋਟ ਦੇ ਕੰਮ ਲਈ ਹੈ; ਬਾਕੀ ਕੁਝ ਵੀ ਵੱਖਰੀ ਲਾਈਨ ਹੈ।",
    checklistHeading: "ਤੁਹਾਡੇ ਘਰ ਦੀ ਤਿਆਰੀ ਸੂਚੀ",
    checklistLead: (date) => `ਕਿਰਪਾ ਕਰਕੇ ${date} ਨੂੰ ਸਾਡੇ ਪਹੁੰਚਣ ਤੋਂ ਪਹਿਲਾਂ ਇਹ ਕਦਮ ਪੂਰੇ ਕਰੋ:`,
    importantLabel: "ਜ਼ਰੂਰੀ:",
    dayOfHeading: "ਕੰਮ ਵਾਲੇ ਦਿਨ",
    processHeading: "ਕੰਮ ਕਿਵੇਂ ਚੱਲਦਾ ਹੈ",
    notesHeading: (company) => `${company} ਵੱਲੋਂ ਇੱਕ ਨੋਟ`,
    afterHeading: "ਕੰਮ ਤੋਂ ਬਾਅਦ",
    documentsHeading: "ਤਕਨੀਕੀ ਦਸਤਾਵੇਜ਼",
    documentsLead: "ਤੁਹਾਡੇ ਕੰਮ ਵਿੱਚ ਵਰਤੇ ਜਾਣ ਵਾਲੇ ਉਤਪਾਦਾਂ ਦੀਆਂ ਸਪੈਸੀਫਿਕੇਸ਼ਨ ਸ਼ੀਟਾਂ। ਜਿੱਥੇ ਆਕਾਰ ਇਜਾਜ਼ਤ ਦਿੰਦਾ ਹੈ ਉਹ ਇਸ ਈਮੇਲ ਨਾਲ ਨੱਥੀ ਹਨ, ਅਤੇ ਹੇਠਾਂ ਦਿੱਤੇ ਲਿੰਕਾਂ 'ਤੇ ਹਮੇਸ਼ਾ ਉਪਲਬਧ ਹਨ।",
    closing: "ਸਾਡੇ ਆਉਣ ਤੋਂ ਪਹਿਲਾਂ ਕੋਈ ਸਵਾਲ? ਇਸ ਈਮੇਲ ਦਾ ਜਵਾਬ ਦਿਓ ਜਾਂ ਸਾਨੂੰ ਕਾਲ ਕਰੋ — ਅਸੀਂ ਉਸ ਸਵੇਰ ਦੀ ਬਜਾਏ ਹੁਣੇ ਜਵਾਬ ਦੇਣਾ ਪਸੰਦ ਕਰਾਂਗੇ।",
    subject: (company, job, date) => `${company}: ${date} ਨੂੰ ${job} ਲਈ ਤਿਆਰੀ ਕਿਵੇਂ ਕਰਨੀ ਹੈ`,
    emailIntro: (job, date) =>
      `ਅਸੀਂ ${date} ਨੂੰ ${job} ਸ਼ੁਰੂ ਕਰਨ ਦੀ ਯੋਜਨਾ ਬਣਾਈ ਹੈ। ਸਾਡੇ ਆਉਣ ਤੋਂ ਪਹਿਲਾਂ ਕੀ ਕਰਨਾ ਹੈ ਅਤੇ ਸਾਡੇ ਉੱਥੇ ਹੁੰਦਿਆਂ ਕੀ ਉਮੀਦ ਕਰਨੀ ਹੈ — ਪੂਰੀ ਗਾਈਡ PDF ਵਜੋਂ ਨੱਥੀ ਹੈ।`,
    emailChecklistLead: "ਸਾਡੇ ਆਉਣ ਤੋਂ ਪਹਿਲਾਂ:",
    emailMoreItems: (n) => `… ਅਤੇ ਨੱਥੀ ਗਾਈਡ ਵਿੱਚ ${n} ਹੋਰ।`,
    emailDocs: "ਤਕਨੀਕੀ ਦਸਤਾਵੇਜ਼:",
    attachmentName: "Tiyari-guide",
    documentLabel: "ਤਿਆਰੀ ਗਾਈਡ",
  },
  tl: {
    title: "Gabay sa Paghahanda para sa Kliyente",
    subtitle: "Ano ang aasahan, at paano maghanda",
    thankYou: (name, company) => `Salamat, ${name}, sa pagpili sa ${company}.`,
    scheduled: (date) => `Nakatakda kaming dumating sa ${date}.`,
    intro:
      "Ipinapaliwanag ng gabay na ito kung paano ihanda ang inyong tahanan bago kami dumating at kung ano ang mangyayari habang nandoon kami. Lahat ng nasa ibaba ay para sa trabahong nasa inyong quote; ang iba pa ay hiwalay na linya.",
    checklistHeading: "Checklist ng paghahanda ng inyong tahanan",
    checklistLead: (date) => `Pakikumpleto ang mga hakbang na ito bago ang pagdating namin sa ${date}:`,
    importantLabel: "Mahalaga:",
    dayOfHeading: "Sa araw ng trabaho",
    processHeading: "Paano tumatakbo ang trabaho",
    notesHeading: (company) => `Paalala mula sa ${company}`,
    afterHeading: "Pagkatapos ng trabaho",
    documentsHeading: "Mga teknikal na dokumento",
    documentsLead: "Ang mga specification sheet ng mga produktong ginagamit namin sa inyong trabaho. Nakalakip ang mga ito sa email na ito kung kasya, at laging makukuha sa mga link sa ibaba.",
    closing: "May tanong bago kami dumating? Sumagot sa email na ito o tawagan kami — mas gusto naming sumagot ngayon kaysa sa umagang iyon.",
    subject: (company, job, date) => `${company}: paano maghanda para sa ${job} sa ${date}`,
    emailIntro: (job, date) =>
      `Nakatakda kaming simulan ang ${job} sa ${date}. Narito ang dapat gawin bago kami dumating at ang aasahan habang nandoon kami — nakalakip ang buong gabay bilang PDF.`,
    emailChecklistLead: "Bago kami dumating:",
    emailMoreItems: (n) => `… at ${n} pa sa nakalakip na gabay.`,
    emailDocs: "Mga teknikal na dokumento:",
    attachmentName: "Gabay-sa-paghahanda",
    documentLabel: "Gabay sa paghahanda",
  },
  de: {
    title: "Vorbereitungsleitfaden für Kunden",
    subtitle: "Was Sie erwartet und wie Sie sich vorbereiten",
    thankYou: (name, company) => `Vielen Dank, ${name}, dass Sie sich für ${company} entschieden haben.`,
    scheduled: (date) => `Wir kommen voraussichtlich am ${date}.`,
    intro:
      "Dieser Leitfaden erklärt, wie Sie Ihr Zuhause vor unserer Ankunft vorbereiten und was während unserer Arbeit geschieht. Alles Folgende gilt für die Arbeiten in Ihrem Angebot; alles andere ist eine eigene Position.",
    checklistHeading: "Ihre Vorbereitungs-Checkliste",
    checklistLead: (date) => `Bitte erledigen Sie diese Schritte vor unserer Ankunft am ${date}:`,
    importantLabel: "Wichtig:",
    dayOfHeading: "Am Arbeitstag",
    processHeading: "So läuft die Arbeit ab",
    notesHeading: (company) => `Ein Hinweis von ${company}`,
    afterHeading: "Nach der Arbeit",
    documentsHeading: "Technische Unterlagen",
    documentsLead: "Die Datenblätter der Produkte, die wir bei Ihnen verwenden. Sie sind dieser E-Mail beigefügt, soweit die Größe es zulässt, und stets über die Links unten abrufbar.",
    closing: "Fragen vor unserer Ankunft? Antworten Sie auf diese E-Mail oder rufen Sie uns an — lieber jetzt als am Morgen selbst.",
    subject: (company, job, date) => `${company}: So bereiten Sie sich auf ${job} am ${date} vor`,
    emailIntro: (job, date) =>
      `Wir beginnen voraussichtlich am ${date} mit ${job}. Hier steht, was vor unserer Ankunft zu tun ist und was Sie während der Arbeit erwartet — der vollständige Leitfaden ist als PDF beigefügt.`,
    emailChecklistLead: "Vor unserer Ankunft:",
    emailMoreItems: (n) => `… und ${n} weitere im beigefügten Leitfaden.`,
    emailDocs: "Technische Unterlagen:",
    attachmentName: "Vorbereitungsleitfaden",
    documentLabel: "Vorbereitungsleitfaden",
  },
  it: {
    title: "Guida alla preparazione per il cliente",
    subtitle: "Cosa aspettarsi e come prepararsi",
    thankYou: (name, company) => `Grazie, ${name}, per aver scelto ${company}.`,
    scheduled: (date) => `Il nostro arrivo è previsto per il ${date}.`,
    intro:
      "Questa guida spiega come preparare la casa prima del nostro arrivo e cosa succederà mentre siamo da voi. Tutto ciò che segue riguarda i lavori del vostro preventivo; il resto è una voce separata.",
    checklistHeading: "La lista di preparazione della vostra casa",
    checklistLead: (date) => `Vi chiediamo di completare questi passaggi prima del nostro arrivo il ${date}:`,
    importantLabel: "Importante:",
    dayOfHeading: "Il giorno dei lavori",
    processHeading: "Come si svolgono i lavori",
    notesHeading: (company) => `Una nota da ${company}`,
    afterHeading: "Dopo i lavori",
    documentsHeading: "Documenti tecnici",
    documentsLead: "Le schede tecniche dei prodotti che usiamo per il vostro lavoro. Sono allegate a questa email quando le dimensioni lo consentono, e sempre disponibili ai link qui sotto.",
    closing: "Domande prima del nostro arrivo? Rispondete a questa email o chiamateci — meglio rispondere ora che quella mattina.",
    subject: (company, job, date) => `${company}: come prepararsi per ${job} il ${date}`,
    emailIntro: (job, date) =>
      `Il nostro inizio di ${job} è previsto per il ${date}. Ecco cosa fare prima del nostro arrivo e cosa aspettarsi mentre siamo da voi — la guida completa è allegata in PDF.`,
    emailChecklistLead: "Prima del nostro arrivo:",
    emailMoreItems: (n) => `… e altri ${n} nella guida allegata.`,
    emailDocs: "Documenti tecnici:",
    attachmentName: "Guida-alla-preparazione",
    documentLabel: "Guida alla preparazione",
  },
};

export const PREP_GUIDE_COPY = COPY;
export const PREP_GUIDE_COPY_LANGUAGES = Object.keys(COPY);

/** The frame for one language, falling back to English per LANGUAGE. */
export function prepGuideCopy(language) {
  const base = String(language || "")
    .trim()
    .toLowerCase()
    .split(/[-_]/)[0];
  return COPY[base] || COPY.en;
}
