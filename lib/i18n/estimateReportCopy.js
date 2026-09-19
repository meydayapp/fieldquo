// lib/i18n/estimateReportCopy.js
//
// Every visible string on the instant-estimate REPORT — the branded page at
// /estimate-report/<token>, its PDF and the covering email — in English,
// French and Spanish.
//
// ── Whose language ─────────────────────────────────────────────────────────
//
// The HOMEOWNER's, fixed on the draft Quote at creation (`Quote.language`,
// non-negotiable #6). The report is a document the homeowner keeps; it is
// never re-rendered in the company's language because the company opened
// it, and a French homeowner who picked French on the form gets a French
// PDF whatever the company's default is.
//
// Same arrangement as gutterEstimateCopy / instantQuoteCopy: a closed set of
// hand-written transactional strings, functions where a value is
// interpolated because word order around a value does not survive
// concatenation across languages, and no imports — the page, the PDF
// sections, the email and scripts/check-estimate-report.mjs all read it. The
// trade noun that drops into the title comes from instantQuoteCopy's TRADES
// table so the report and the form cannot disagree about what a trade is
// called.
//
// The raw table is exported so the check can prove every fr/es string is not
// the English one.

const COPY = {
  en: {
    // Header tiles
    call: "Call",
    email: "Email",
    website: "Website",
    // Title block
    title: (noun) => (noun ? `Your free ${noun} estimate` : "Your free estimate"),
    preparedFor: "Prepared for",
    preparedBy: (company) => `Prepared by ${company}`,
    // Options
    optionsTitle: "Your options",
    optionsIntro:
      "Two ways to do this job, priced for your property. Every figure is a starting point we confirm on site.",
    optionsIntroOne: "Priced for your property. The figure is a starting point we confirm on site.",
    startingAt: "Starting at",
    goodValue: "Best value",
    premium: "Premium",
    yourPick: "Your pick",
    perUnit: (unit) => `per ${unit}`,
    // Questions
    questionsTitle: "Questions about your estimate?",
    questionsBody: "Pick whichever suits you — we'll take it from there.",
    bookVisit: "Book an in-person visit",
    requestCallback: "Request a call back",
    backToWebsite: "Back to the website",
    // Callback form
    cbName: "Your name",
    cbPhone: "Phone number",
    cbTime: "Best time to call",
    cbTimeOptions: [
      ["morning", "Morning"],
      ["afternoon", "Afternoon"],
      ["evening", "Evening"],
      ["anytime", "Any time"],
    ],
    cbNote: "Anything we should know? (optional)",
    cbSend: "Request the call",
    cbSending: "Sending…",
    cbDone: "Thanks — we'll call you back.",
    cbPhoneRequired: "We need a phone number to call you back.",
    cbFailed: "That didn't go through. Please call us instead.",
    cbCancel: "Cancel",
    // Measurement summary
    measurementTitle: "Measurement summary",
    measuredArea: "Measured area",
    squares: "Roofing squares",
    pitch: "Predominant pitch",
    gutterRun: "Eavestrough run",
    downspouts: "Downspouts",
    lawnArea: "Lawn area",
    pavingArea: "Paving area",
    doors: "Doors",
    drawers: "Drawers",
    treads: "Treads",
    stairShape: "Shape",
    stairShapes: { straight: "Straight", L: "L-shape", U: "U-shape" },
    risers: "Risers",
    balusters: "Balusters",
    posts: "Newel posts",
    handrail: "Handrail",
    assumedFromSteps: (n, shape) => `assumed from ${n} steps, ${shape}`,
    items: "Items",
    imageryDate: "Imagery date",
    source: "Source",
    sourceKinds: {
      satellite: "Satellite measurement",
      traced: "Traced on the map",
      figures: "Your figures",
    },
    verifyNote: "Measurements should be verified before final scope.",
    sqft: (n) => `${n} sq ft`,
    ft: (n) => `${n} ft`,
    // Property
    propertyTitle: "Your property",
    address: "Address",
    name: "Name",
    phone: "Phone",
    emailLabel: "Email",
    propertyType: "Property type",
    propertyTypes: { residential: "Residential", commercial: "Commercial" },
    mapTitle: "Property map",
    mapCaption: "The outline shows the area this estimate was measured from.",
    mapCaptionNoOutline: "The property this estimate was measured for.",
    mapUnavailable: "No satellite still for this estimate.",
    // Notes
    notesTitle: "Report notes",
    emailedCopy: "A copy of this report has been emailed to you.",
    emailedCopyNone: "Keep the link below to open this report again.",
    nextTitle: "What happens next",
    theTeam: "Our team",
    nextSteps: (company) => [
      `${company} reviews your measurement and confirms the figure — usually within one business day.`,
      "We agree a time to visit, walk the property with you and settle the final scope and price before any work is booked.",
    ],
    disclaimerPrice:
      "* Starting-at prices are estimates from the measurement above, not a guarantee. Your final price is confirmed on site.",
    disclaimerMeasure:
      "** Measurements from aerial imagery or your own figures may vary from the property. Nothing is binding until confirmed in person.",
    reportId: "Report ID",
    viewOnline: "View online",
    date: "Date",
    // Email
    emailSubject: (company, noun) =>
      noun ? `Your ${noun} estimate report from ${company}` : `Your estimate report from ${company}`,
    emailGreeting: (n) => (n ? `Hi ${n},` : "Hi,"),
    emailBody: (company) =>
      `This report from ${company} is also attached as a PDF, and the online copy stays at the link above.`,
    emailFooter: "Questions? Reply to this email or call us.",
    pdfFilename: (ref) => `Estimate-report-${ref}.pdf`,
  },
  fr: {
    call: "Appeler",
    email: "Courriel",
    website: "Site web",
    title: (noun) => (noun ? `Votre estimation ${noun} gratuite` : "Votre estimation gratuite"),
    preparedFor: "Préparée pour",
    preparedBy: (company) => `Préparée par ${company}`,
    optionsTitle: "Vos options",
    optionsIntro:
      "Deux façons de réaliser ce projet, chiffrées pour votre propriété. Chaque montant est un point de départ que nous confirmons sur place.",
    optionsIntroOne:
      "Chiffrée pour votre propriété. Le montant est un point de départ que nous confirmons sur place.",
    startingAt: "À partir de",
    goodValue: "Meilleur rapport",
    premium: "Haut de gamme",
    yourPick: "Votre choix",
    perUnit: (unit) => `par ${unit}`,
    questionsTitle: "Des questions sur votre estimation ?",
    questionsBody: "Choisissez ce qui vous convient — nous nous occupons du reste.",
    bookVisit: "Réserver une visite sur place",
    requestCallback: "Demander un rappel",
    backToWebsite: "Retour au site web",
    cbName: "Votre nom",
    cbPhone: "Numéro de téléphone",
    cbTime: "Meilleur moment pour appeler",
    cbTimeOptions: [
      ["morning", "Matin"],
      ["afternoon", "Après-midi"],
      ["evening", "Soir"],
      ["anytime", "N'importe quand"],
    ],
    cbNote: "Quelque chose à nous signaler ? (facultatif)",
    cbSend: "Demander l'appel",
    cbSending: "Envoi…",
    cbDone: "Merci — nous vous rappellerons.",
    cbPhoneRequired: "Il nous faut un numéro de téléphone pour vous rappeler.",
    cbFailed: "Ça n'a pas fonctionné. Appelez-nous plutôt.",
    cbCancel: "Annuler",
    measurementTitle: "Résumé de la mesure",
    measuredArea: "Surface mesurée",
    squares: "Carrés de toiture",
    pitch: "Pente dominante",
    gutterRun: "Longueur de gouttières",
    downspouts: "Descentes pluviales",
    lawnArea: "Surface de pelouse",
    pavingArea: "Surface à paver",
    doors: "Portes",
    drawers: "Tiroirs",
    treads: "Marches",
    stairShape: "Forme",
    stairShapes: { straight: "Droit", L: "En L", U: "En U" },
    risers: "Contremarches",
    balusters: "Barreaux",
    posts: "Poteaux",
    handrail: "Main courante",
    assumedFromSteps: (n, shape) => `estimé d’après ${n} marches, ${shape}`,
    items: "Objets",
    imageryDate: "Date des images",
    source: "Provenance",
    sourceKinds: {
      satellite: "Mesure satellite",
      traced: "Tracé sur la carte",
      figures: "Vos chiffres",
    },
    verifyNote: "Les mesures doivent être vérifiées avant l'étendue finale des travaux.",
    sqft: (n) => `${n} pi²`,
    ft: (n) => `${n} pi`,
    propertyTitle: "Votre propriété",
    address: "Adresse",
    name: "Nom",
    phone: "Téléphone",
    emailLabel: "Courriel",
    propertyType: "Type de propriété",
    propertyTypes: { residential: "Résidentiel", commercial: "Commercial" },
    mapTitle: "Carte de la propriété",
    mapCaption: "Le contour indique la zone à partir de laquelle cette estimation a été mesurée.",
    mapCaptionNoOutline: "La propriété pour laquelle cette estimation a été mesurée.",
    mapUnavailable: "Aucune image satellite pour cette estimation.",
    notesTitle: "Notes du rapport",
    emailedCopy: "Une copie de ce rapport vous a été envoyée par courriel.",
    emailedCopyNone: "Conservez le lien ci-dessous pour rouvrir ce rapport.",
    nextTitle: "Prochaines étapes",
    theTeam: "Notre équipe",
    nextSteps: (company) => [
      `${company} révise votre mesure et confirme le montant — habituellement en un jour ouvrable.`,
      "Nous convenons d'une visite, parcourons la propriété avec vous et fixons l'étendue et le prix définitifs avant de planifier les travaux.",
    ],
    disclaimerPrice:
      "* Les prix « à partir de » sont des estimations issues de la mesure ci-dessus, pas une garantie. Votre prix définitif est confirmé sur place.",
    disclaimerMeasure:
      "** Les mesures issues d'images aériennes ou de vos propres chiffres peuvent différer de la propriété. Rien n'est contraignant avant confirmation en personne.",
    reportId: "N° du rapport",
    viewOnline: "Voir en ligne",
    date: "Date",
    emailSubject: (company, noun) =>
      noun ? `Votre rapport d'estimation ${noun} de ${company}` : `Votre rapport d'estimation de ${company}`,
    emailGreeting: (n) => (n ? `Bonjour ${n},` : "Bonjour,"),
    emailBody: (company) =>
      `Ce rapport de ${company} est aussi joint en PDF, et la version en ligne reste accessible au lien ci-dessus.`,
    emailFooter: "Des questions ? Répondez à ce courriel ou appelez-nous.",
    pdfFilename: (ref) => `Rapport-estimation-${ref}.pdf`,
  },
  es: {
    call: "Llamar",
    email: "Correo",
    website: "Sitio web",
    title: (noun) => (noun ? `Su estimación gratuita de ${noun}` : "Su estimación gratuita"),
    preparedFor: "Preparada para",
    preparedBy: (company) => `Preparada por ${company}`,
    optionsTitle: "Sus opciones",
    optionsIntro:
      "Dos formas de hacer este trabajo, con precio para su propiedad. Cada cifra es un punto de partida que confirmamos en el sitio.",
    optionsIntroOne:
      "Con precio para su propiedad. La cifra es un punto de partida que confirmamos en el sitio.",
    startingAt: "Desde",
    goodValue: "Mejor valor",
    premium: "Prémium",
    yourPick: "Su elección",
    perUnit: (unit) => `por ${unit}`,
    questionsTitle: "¿Preguntas sobre su estimación?",
    questionsBody: "Elija lo que más le convenga — nosotros nos encargamos del resto.",
    bookVisit: "Reservar una visita en persona",
    requestCallback: "Solicitar una llamada",
    backToWebsite: "Volver al sitio web",
    cbName: "Su nombre",
    cbPhone: "Número de teléfono",
    cbTime: "Mejor hora para llamar",
    cbTimeOptions: [
      ["morning", "Mañana"],
      ["afternoon", "Tarde"],
      ["evening", "Noche"],
      ["anytime", "Cualquier hora"],
    ],
    cbNote: "¿Algo que debamos saber? (opcional)",
    cbSend: "Solicitar la llamada",
    cbSending: "Enviando…",
    cbDone: "Gracias — le llamaremos.",
    cbPhoneRequired: "Necesitamos un número de teléfono para llamarle.",
    cbFailed: "No se pudo enviar. Llámenos en su lugar.",
    cbCancel: "Cancelar",
    measurementTitle: "Resumen de la medición",
    measuredArea: "Área medida",
    squares: "Cuadros de techo",
    pitch: "Pendiente predominante",
    gutterRun: "Longitud de canalones",
    downspouts: "Bajantes",
    lawnArea: "Área de césped",
    pavingArea: "Área de pavimento",
    doors: "Puertas",
    drawers: "Cajones",
    treads: "Peldaños",
    stairShape: "Forma",
    stairShapes: { straight: "Recta", L: "En L", U: "En U" },
    risers: "Contrahuellas",
    balusters: "Balaustres",
    posts: "Postes",
    handrail: "Pasamanos",
    assumedFromSteps: (n, shape) => `estimado a partir de ${n} escalones, ${shape}`,
    items: "Artículos",
    imageryDate: "Fecha de las imágenes",
    source: "Fuente",
    sourceKinds: {
      satellite: "Medición satelital",
      traced: "Trazado en el mapa",
      figures: "Sus cifras",
    },
    verifyNote: "Las medidas deben verificarse antes del alcance final.",
    sqft: (n) => `${n} pies²`,
    ft: (n) => `${n} pies`,
    propertyTitle: "Su propiedad",
    address: "Dirección",
    name: "Nombre",
    phone: "Teléfono",
    emailLabel: "Correo electrónico",
    propertyType: "Tipo de propiedad",
    propertyTypes: { residential: "Residencial", commercial: "Comercial" },
    mapTitle: "Mapa de la propiedad",
    mapCaption: "El contorno muestra el área desde la que se midió esta estimación.",
    mapCaptionNoOutline: "La propiedad para la que se midió esta estimación.",
    mapUnavailable: "No hay imagen satelital para esta estimación.",
    notesTitle: "Notas del informe",
    emailedCopy: "Se le ha enviado una copia de este informe por correo electrónico.",
    emailedCopyNone: "Guarde el enlace de abajo para volver a abrir este informe.",
    nextTitle: "Qué sigue",
    theTeam: "Nuestro equipo",
    nextSteps: (company) => [
      `${company} revisa su medición y confirma la cifra — normalmente en un día hábil.`,
      "Acordamos una visita, recorremos la propiedad con usted y fijamos el alcance y el precio definitivos antes de programar cualquier trabajo.",
    ],
    disclaimerPrice:
      "* Los precios «desde» son estimaciones a partir de la medición anterior, no una garantía. Su precio final se confirma en el sitio.",
    disclaimerMeasure:
      "** Las medidas a partir de imágenes aéreas o de sus propias cifras pueden diferir de la propiedad. Nada es vinculante hasta confirmarse en persona.",
    reportId: "N.º de informe",
    viewOnline: "Ver en línea",
    date: "Fecha",
    emailSubject: (company, noun) =>
      noun ? `Su informe de estimación de ${noun} de ${company}` : `Su informe de estimación de ${company}`,
    emailGreeting: (n) => (n ? `Hola ${n},` : "Hola,"),
    emailBody: (company) =>
      `Este informe de ${company} también va adjunto en PDF, y la versión en línea sigue disponible en el enlace de arriba.`,
    emailFooter: "¿Preguntas? Responda a este correo o llámenos.",
    pdfFilename: (ref) => `Informe-estimacion-${ref}.pdf`,
  },
};

/** The three languages the report is written in. */
export const ESTIMATE_REPORT_LANGUAGES = Object.keys(COPY);

/** The copy table for a language, falling back to English. */
export function estimateReportCopy(language = "en") {
  const code = String(language || "en").toLowerCase().slice(0, 2);
  return Object.prototype.hasOwnProperty.call(COPY, code) ? COPY[code] : COPY.en;
}

/** Exported for scripts/check-estimate-report.mjs. */
export const ESTIMATE_REPORT_COPY = COPY;
