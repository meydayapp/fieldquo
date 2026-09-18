// lib/i18n/instantQuoteCopy.js
//
// Every visible string on the public instant-estimate page
// (app/instant-quote/[companySlug]/InstantQuoteFlow.js) and the server
// sentences it echoes, in English, French and Spanish — the three languages
// the product owner sells in.
//
// ── Why one table and not the ternaries it replaces ────────────────────────
//
// The page used to carry its copy as `fr ? "…" : "…"` scattered through
// 1,400 lines of JSX. Two things followed from that: Spanish did not exist
// (a Spanish company's homeowners got English), and every string the
// ternary forgot stayed English inside a French page — the section titles,
// the field labels, the "still needed" list, the whole junk-removal picker.
// A stranger in a driveway reading "Tell us about the property" under a
// French headline concludes the contractor is not really French-speaking,
// which is the white-label promise broken on the surface that wins the job.
//
// The visitor picks the language on the page (three pills), and non-
// negotiable #6 makes that choice the DOCUMENT's language: the draft, the
// lead and the confirmation email are created in it and never re-translated.
//
// Same arrangement as lawnEstimateCopy / gutterEstimateCopy: a closed set of
// hand-written transactional strings, functions where a value is
// interpolated, and no imports — the browser, the routes and the check
// script all read it. Labels for the lawn cards and the "doesn't look right"
// control stay in lawnEstimateCopy, which this table does not duplicate.

/** The languages the selector offers, in the order the pills are drawn. */
export const INSTANT_QUOTE_LANGUAGES = ["en", "fr", "es"];

/** A posted / queried language, or null when it is not one of the three. */
export function instantQuoteLanguage(value) {
  const code = String(value || "").toLowerCase().slice(0, 2);
  return INSTANT_QUOTE_LANGUAGES.includes(code) ? code : null;
}

// ── The trades ─────────────────────────────────────────────────────────────
//
// `label` is the chip; `noun` is the word that drops into the headline
// ("your free {noun} estimate" / "votre estimation {noun} gratuite" /
// "su estimación gratuita de {noun}"), in the grammatical form each language
// needs there. A trade with no noun in a language gets the generic headline,
// never the English noun inside a French sentence — headline() enforces it.
const TRADES = {
  roofing: {
    en: { label: "Roofing", noun: "roofing" },
    fr: { label: "Toiture", noun: "de toiture" },
    es: { label: "Techado", noun: "techado" },
  },
  gutters: {
    en: { label: "Gutters & Eavestroughs", noun: "gutter" },
    fr: { label: "Gouttières", noun: "de gouttières" },
    es: { label: "Canalones", noun: "canalones" },
  },
  lawn_care: {
    en: { label: "Lawn Care Programs", noun: "lawn care" },
    fr: { label: "Programmes d'entretien de pelouse", noun: "d'entretien de pelouse" },
    es: { label: "Programas de cuidado del césped", noun: "cuidado del césped" },
  },
  lawn_mowing: {
    en: { label: "Lawn Mowing", noun: "lawn mowing" },
    fr: { label: "Tonte de pelouse", noun: "de tonte de pelouse" },
    es: { label: "Corte de césped", noun: "corte de césped" },
  },
  paving: {
    en: { label: "Paving", noun: "paving" },
    fr: { label: "Pavage", noun: "de pavage" },
    es: { label: "Pavimentación", noun: "pavimentación" },
  },
  landscaping: {
    en: { label: "Landscaping", noun: "landscaping" },
    fr: { label: "Aménagement paysager", noun: "d'aménagement paysager" },
    es: { label: "Paisajismo", noun: "paisajismo" },
  },
  painting: {
    en: { label: "Painting", noun: "painting" },
    fr: { label: "Peinture", noun: "de peinture" },
    es: { label: "Pintura", noun: "pintura" },
  },
  cleaning: {
    en: { label: "Cleaning", noun: "cleaning" },
    fr: { label: "Nettoyage", noun: "de nettoyage" },
    es: { label: "Limpieza", noun: "limpieza" },
  },
  junk_removal: {
    en: { label: "Junk Removal", noun: "junk removal" },
    fr: { label: "Enlèvement de débris", noun: "d'enlèvement de débris" },
    es: { label: "Retiro de desechos", noun: "retiro de desechos" },
  },
  parging: {
    en: { label: "Parging", noun: "parging" },
    fr: { label: "Crépi", noun: "de crépi" },
    es: { label: "Revoque", noun: "revoque" },
  },
  epoxy: {
    en: { label: "Epoxy & Concrete Coatings", noun: "epoxy floor" },
    fr: { label: "Époxy et revêtements de béton", noun: "de plancher époxy" },
    es: { label: "Epoxi y recubrimientos de concreto", noun: "piso epóxico" },
  },
  cabinet_refinishing: {
    en: { label: "Cabinet Refinishing", noun: "cabinet refinishing" },
    fr: { label: "Refinition d'armoires", noun: "de refinition d'armoires" },
    es: { label: "Renovación de gabinetes", noun: "renovación de gabinetes" },
  },
  cabinet_refacing: {
    en: { label: "Cabinet Refacing", noun: "cabinet refacing" },
    fr: { label: "Resurfaçage d'armoires", noun: "de resurfaçage d'armoires" },
    es: { label: "Recubrimiento de gabinetes", noun: "recubrimiento de gabinetes" },
  },
  countertop: {
    en: { label: "Countertops", noun: "countertop" },
    fr: { label: "Comptoirs", noun: "de comptoir" },
    es: { label: "Encimeras", noun: "encimeras" },
  },
  flooring: {
    en: { label: "Flooring", noun: "flooring" },
    fr: { label: "Planchers", noun: "de plancher" },
    es: { label: "Pisos", noun: "pisos" },
  },
  stair: {
    en: { label: "Stairs & Railings", noun: "stair and railing" },
    fr: { label: "Escaliers et rampes", noun: "d'escalier et de rampe" },
    es: { label: "Escaleras y barandas", noun: "escaleras y barandas" },
  },
};

/** The chip label for a trade in a language; the English label, then the key, when none. */
export function instantTradeLabel(trade, language = "en", fallback = null) {
  const row = TRADES[trade];
  const code = instantQuoteLanguage(language) || "en";
  return row?.[code]?.label || row?.en?.label || fallback || trade;
}

/**
 * "Complete the form below for your free roofing estimate in 60 seconds."
 *
 * The owner's opening line. With no trade picked yet — or a trade this table
 * has no noun for in that language — the generic wording is used; an
 * English noun is never dropped into a French or Spanish sentence.
 */
export function instantQuoteHeadline(trade, language = "en") {
  const code = instantQuoteLanguage(language) || "en";
  const noun = TRADES[trade]?.[code]?.noun || null;
  if (code === "fr") {
    return noun
      ? `Remplissez le formulaire ci-dessous pour votre estimation ${noun} gratuite en 60 secondes`
      : "Remplissez le formulaire ci-dessous pour votre estimation gratuite en 60 secondes";
  }
  if (code === "es") {
    return noun
      ? `Complete el formulario a continuación para su estimación gratuita de ${noun} en 60 segundos`
      : "Complete el formulario a continuación para su estimación gratuita en 60 segundos";
  }
  return noun
    ? `Complete the form below for your free ${noun} estimate in 60 seconds`
    : "Complete the form below for your free estimate in 60 seconds";
}

// ── Junk removal: the item and job-type names ──────────────────────────────
//
// The keys are lib/junk/pricing.js's; the English column is the label that
// file carries, so a new item there without a row here shows English in
// French — which is what scripts/check-instant-quote-copy.mjs fails on.
const JUNK_ITEMS = {
  couch: { fr: "Sofa / canapé", es: "Sofá" },
  recliner: { fr: "Fauteuil / inclinable", es: "Sillón / reclinable" },
  bed_frame: { fr: "Cadre / base de lit", es: "Estructura / base de cama" },
  table: { fr: "Table", es: "Mesa" },
  desk: { fr: "Bureau", es: "Escritorio" },
  dresser: { fr: "Commode / garde-robe", es: "Cómoda / armario" },
  chair: { fr: "Chaise", es: "Silla" },
  furniture: { fr: "Autre meuble", es: "Otro mueble" },
  mattress: { fr: "Matelas / sommier", es: "Colchón / somier" },
  carpet: { fr: "Tapis (roulé et attaché)", es: "Alfombra (enrollada y atada)" },
  exercise_equipment: { fr: "Équipement d'exercice", es: "Equipo de ejercicio" },
  bbq: { fr: "BBQ (bonbonne de propane retirée)", es: "Parrilla (sin tanque de propano)" },
  appliance: { fr: "Laveuse / sécheuse / lave-vaisselle / cuisinière", es: "Lavadora / secadora / lavavajillas / estufa" },
  microwave: { fr: "Micro-ondes", es: "Microondas" },
  refrigerator: { fr: "Réfrigérateur / congélateur", es: "Refrigerador / congelador" },
  air_conditioner: { fr: "Climatiseur / déshumidificateur", es: "Aire acondicionado / deshumidificador" },
  water_cooler: { fr: "Distributeur d'eau", es: "Dispensador de agua" },
  tv: { fr: "Téléviseur / moniteur", es: "Televisor / monitor" },
  computer: { fr: "Ordinateur / électronique", es: "Computadora / electrónica" },
  tire: { fr: "Pneu (avec ou sans jante)", es: "Neumático (con o sin rin)" },
  metal: { fr: "Objet en métal (évier, chauffe-eau, clôture)", es: "Objeto de metal (fregadero, calentador, reja)" },
  concrete: { fr: "Béton / brique / maçonnerie", es: "Concreto / ladrillo / mampostería" },
  dirt: { fr: "Terre / sol / gazon en plaques", es: "Tierra / suelo / césped en rollo" },
  wood_debris: { fr: "Bois de construction / de rénovation", es: "Madera de obra / de renovación" },
  construction_debris: { fr: "Débris de construction (mixtes)", es: "Escombros de construcción (mixtos)" },
  shed: { fr: "Cabanon / gazebo démonté", es: "Cobertizo / gazebo desmontado" },
  hot_tub: { fr: "Spa / piscine hors terre", es: "Jacuzzi / piscina desmontable" },
  large_plastic: { fr: "Gros plastique (meubles, jouets, poussette)", es: "Plástico grande (muebles, juguetes, cochecito)" },
  swing_set: { fr: "Balançoire / module de jeu", es: "Columpio / estructura de juegos" },
  yard_waste: { fr: "Branches / résidus de jardin (en paquets)", es: "Ramas / residuos de jardín (atados)" },
  propane: { fr: "Bonbonne de propane", es: "Tanque de propano" },
  gas_appliance: { fr: "Appareil à essence (tondeuse, souffleuse)", es: "Aparato de gasolina (cortacésped, sopladora)" },
  paint_chemicals: { fr: "Peinture / solvants / produits chimiques", es: "Pintura / solventes / químicos" },
};

const JUNK_JOB_TYPES = {
  single_items: { fr: "Quelques objets", es: "Unos cuantos artículos" },
  house_cleanout: { fr: "Maison complète / succession", es: "Casa completa / herencia" },
  rental_turnover: { fr: "Logement locatif / changement de locataire", es: "Alquiler / cambio de inquilino" },
  construction: { fr: "Construction / rénovation", es: "Construcción / renovación" },
  other: { fr: "Autre", es: "Otro" },
};

/** The homeowner-facing name of a junk item, falling back to the English label passed in. */
export function junkItemLabel(key, englishLabel, language = "en") {
  const code = instantQuoteLanguage(language) || "en";
  return (code !== "en" && JUNK_ITEMS[key]?.[code]) || englishLabel || key;
}

export function junkJobTypeLabel(key, englishLabel, language = "en") {
  const code = instantQuoteLanguage(language) || "en";
  return (code !== "en" && JUNK_JOB_TYPES[key]?.[code]) || englishLabel || key;
}

// ── The page ───────────────────────────────────────────────────────────────

const COPY = {
  en: {
    languageLabel: "Language",
    languageNames: { en: "English", fr: "Français", es: "Español" },
    instantEstimate: "Instant estimate",
    requestQuoteInstead: "Request a quote instead →",
    couldNotLoad: "Could not load",
    notAvailable: "Instant estimates aren't available here yet.",
    // The promise under the headline follows the trade's display mode.
    heroNoTrade: "Tell us about the job and add a few photos — we'll get your price to you.",
    heroGated: "Tell us about the job and add a few photos — we'll review it and come back to you with your price.",
    heroRange: "Tell us about the job and add a few photos — your estimated range appears as you go, and we'll confirm your final price.",
    heroAfterSubmit: "Tell us about the job and add a few photos — you'll see your estimated range as soon as you submit, and we'll confirm your final price.",
    ctaReveal: "Reveal my estimate",
    ctaGet: "Get my estimate",
    // Sections
    whatDoYouNeed: "What do you need?",
    aboutProperty: "Tell us about the property",
    propertyAddress: "Property address",
    addressPlaceholder: "917 Littlerock St, city, postal code",
    yourProgram: "Your program",
    whichOption: "Which option?",
    yourBudget: "Your budget",
    whereIsJob: "Where's the job?",
    jobAddressPlaceholder: "Street, city, postal code",
    yourDetails: "Your details",
    namePlaceholder: "Your name *",
    emailPlaceholder: "Email",
    phonePlaceholder: "Phone",
    photos: "Photos",
    select: "Select…",
    stillNeeded: (list) => `Still needed: ${list}`,
    missing: {
      whatYouNeed: "what you need",
      jobDetails: "the job details",
      anOption: "an option",
      aProgram: "a program",
      jobAddress: "the job address",
      yourName: "your name",
      emailOrPhone: "an email or phone",
      yourBudget: "your budget",
      onePhoto: "at least one photo",
      whenNeeded: "when you need it done",
    },
    submitFailed: "Something went wrong. Please try again.",
    poweredBy: "Powered by measurements from satellite imagery.",
    // The lawn / area map
    mapFailed: "The map couldn't load, so we can't measure your lawn here.",
    mapFailedArea: "The map couldn't load, so we can't measure the area here.",
    mapSearchPlaceholder: "Type your address, press Enter to find it, then trace your lawn",
    mapSearchPlaceholderArea: "Type your address, press Enter to find it, then trace the area",
    loadingMap: "Loading map…",
    tracedArea: (sqft) => `Traced area: ${Number(sqft).toLocaleString("en-CA")} sq ft`,
    // Intake inputs, by the estimator's field keys
    inputs: {
      tearOffLayers: "Existing roof layers to remove",
      squareFootageFloor: "Floor area (sq ft)",
      squareFootageWall: "Wall area (sq ft)",
      squareFootageCounter: "Countertop area (sq ft)",
      squareFootageSurface: "Surface area (sq ft)",
      surfaceCondition: "Floor condition",
      surfaceConditionPaint: "Surface condition",
      subfloor: "Subfloor / old floor",
      access: "Height / access",
      condition: "Wall condition",
      doorCount: "Cabinet doors",
      drawerCount: "Drawer fronts",
      complexityLevel: "Condition of the cabinets",
      boxLinearFt: "Exposed box sides (linear ft)",
      cutouts: "Sink / cooktop cutouts",
      edgeFt: "Upgraded edge (linear ft)",
      backsplashSqft: "Backsplash (sq ft)",
      scope: "Interior or exterior",
      treads: "Number of steps",
      railingFt: "Railing (linear ft)",
      egPrefix: "e.g. ",
    },
    options: {
      good: "Good",
      fair: "Fair",
      poor: "Poor / needs repair",
      poorPrep: "Poor / needs prep",
      ground: "Ground level",
      second_storey: "Second storey",
      scaffold: "Needs scaffold",
      new_or_sound: "New / sound masonry",
      minor_repair: "Minor repair",
      major_repair: "Major repair",
      standard: "Sound — normal wear",
      moderate: "Some extra prep needed",
      high: "Heavy grease, damage or peeling",
      bareLevel: "Bare & level",
      somePrep: "Some prep",
      tearOut: "Tear-out + levelling",
      interior: "Interior",
      exterior: "Exterior",
    },
    // Junk removal picker
    whatKindOfJob: "What kind of job?",
    whatNeedsToGo: "What needs to go?",
    cantTake: (list) => `We can’t take: ${list}.`,
    harder: "Anything that makes it harder? (optional)",
    flightsOfStairs: "Flights of stairs",
    disassembly: "Needs taking apart",
    demolition: "Small demolition",
    longCarry: "Long carry to the truck",
    noElevator: "Upstairs, no elevator",
    fewer: "Fewer",
    more: "More",
    // The panel
    yourEstimate: "Your estimate",
    estimatedRange: "Estimated range",
    minimumApplied: "This job comes in under our minimum charge, so the minimum applies.",
    fillInForm: "Fill in the form and your estimate appears here.",
    pickService: "Pick a service to get started.",
    squares: "squares",
    sqft: "sq ft",
    pitch: "pitch",
    ftOfGutter: "ft of gutter",
    downspouts: "downspouts",
    propertyAlt: "Property",
    measureSource: {
      roof_address: "from satellite measurements of your roof",
      gutter_address: "from aerial measurements of your roofline",
      lawn_polygon: "from the area you traced on the map",
      area_polygon: "from the area you traced on the map",
      lawn_address: "from your lot and roof data, or the area you traced",
      manual_area: "from the area you gave us",
      manual_units: "from the counts you gave us",
      stair_count: "from the counts you gave us",
      item_picker: "from the items you picked",
      other: "based on the details you gave us",
    },
    disclaimer: (source, company) =>
      `This is an estimate ${source}, not a final quote. ${company} will confirm it before anything is binding.`,
    seeFinancing: "See financing options",
    reference: (ref) => `Reference ${ref}`,
    // Confirmation
    allSet: "You're all set",
    hasYourDetails: (company) => `${company} has your details and will confirm your quote shortly.`,
    bookTitle: "Would you like us to come and see it?",
    bookBody: "Book an in-person visit and we'll confirm your price on site.",
    bookCta: "Book a visit",
    // Server sentences the routes send back in the form's language
    pickServiceFirst: "Pick a service first.",
    missingService: "Missing service.",
    missingContact: "Tell us your name and an email or phone so we can send your quote.",
    missingWhen: "Tell us when you need this done.",
    measureFailed: "We couldn't measure that. Please try again.",
    optionUnavailable: "That option isn't available. Pick another.",
    tradeUnavailable: (label) => `${label} isn't available for an instant estimate right now.`,
    measureErrors: {
      no_address: "Enter the property address to size the lawn.",
      no_linear_geometry: "We couldn't read the roof edges at that address automatically — request a quote and we'll measure it on site.",
      no_roof_coverage: "We couldn't measure that roof automatically — check the address, or request a quote and we'll measure it by hand.",
      geocode_failed: "We couldn't find that address. Try including the city and postal code.",
      no_polygon: "Trace the area on the map first.",
      no_area: "Enter the area to get an estimate.",
      no_units: "Enter how many doors and drawers.",
      no_key: "Automatic measurement isn't set up yet. Request a quote and we'll measure it by hand.",
      other: "We couldn't measure that. Request a quote and we'll follow up.",
    },
  },
  fr: {
    languageLabel: "Langue",
    languageNames: { en: "English", fr: "Français", es: "Español" },
    instantEstimate: "Estimation instantanée",
    requestQuoteInstead: "Demander une soumission plutôt →",
    couldNotLoad: "Chargement impossible",
    notAvailable: "Les estimations instantanées ne sont pas encore offertes ici.",
    heroNoTrade: "Décrivez le projet et ajoutez quelques photos — nous vous ferons parvenir votre prix.",
    heroGated: "Décrivez le projet et ajoutez quelques photos — nous l'examinerons et reviendrons vers vous avec votre prix.",
    heroRange: "Décrivez le projet et ajoutez quelques photos — votre fourchette estimée s'affiche au fur et à mesure, et nous confirmerons votre prix final.",
    heroAfterSubmit: "Décrivez le projet et ajoutez quelques photos — votre fourchette estimée s'affiche dès l'envoi, et nous confirmerons votre prix final.",
    ctaReveal: "Voir mon estimation",
    ctaGet: "Obtenir mon estimation",
    whatDoYouNeed: "De quoi avez-vous besoin ?",
    aboutProperty: "Parlez-nous de la propriété",
    propertyAddress: "Adresse de la propriété",
    addressPlaceholder: "917 rue Littlerock, ville, code postal",
    yourProgram: "Votre programme",
    whichOption: "Quelle option ?",
    yourBudget: "Votre budget",
    whereIsJob: "Où se trouvent les travaux ?",
    jobAddressPlaceholder: "Rue, ville, code postal",
    yourDetails: "Vos coordonnées",
    namePlaceholder: "Votre nom *",
    emailPlaceholder: "Courriel",
    phonePlaceholder: "Téléphone",
    photos: "Photos",
    select: "Choisir…",
    stillNeeded: (list) => `Il manque : ${list}`,
    missing: {
      whatYouNeed: "le service souhaité",
      jobDetails: "les détails du projet",
      anOption: "une option",
      aProgram: "un programme",
      jobAddress: "l'adresse des travaux",
      yourName: "votre nom",
      emailOrPhone: "un courriel ou un téléphone",
      yourBudget: "votre budget",
      onePhoto: "au moins une photo",
      whenNeeded: "le délai souhaité",
    },
    submitFailed: "Une erreur est survenue. Veuillez réessayer.",
    poweredBy: "Mesures issues d'images satellites.",
    mapFailed: "La carte n'a pas pu se charger, alors nous ne pouvons pas mesurer votre pelouse ici.",
    mapFailedArea: "La carte n'a pas pu se charger, alors nous ne pouvons pas mesurer la surface ici.",
    mapSearchPlaceholder: "Tapez votre adresse, appuyez sur Entrée pour la trouver, puis tracez votre pelouse",
    mapSearchPlaceholderArea: "Tapez votre adresse, appuyez sur Entrée pour la trouver, puis tracez la surface",
    loadingMap: "Chargement de la carte…",
    tracedArea: (sqft) => `Surface tracée : ${Number(sqft).toLocaleString("fr-CA")} pi²`,
    inputs: {
      tearOffLayers: "Couches de toiture existantes à enlever",
      squareFootageFloor: "Surface du plancher (pi²)",
      squareFootageWall: "Surface du mur (pi²)",
      squareFootageCounter: "Surface du comptoir (pi²)",
      squareFootageSurface: "Surface à peindre (pi²)",
      surfaceCondition: "État du plancher",
      surfaceConditionPaint: "État de la surface",
      subfloor: "Sous-plancher / ancien plancher",
      access: "Hauteur / accès",
      condition: "État du mur",
      doorCount: "Portes d'armoires",
      drawerCount: "Façades de tiroirs",
      complexityLevel: "État des armoires",
      boxLinearFt: "Côtés de caissons exposés (pi lin.)",
      cutouts: "Découpes évier / plaque de cuisson",
      edgeFt: "Bordure améliorée (pi lin.)",
      backsplashSqft: "Dosseret (pi²)",
      scope: "Intérieur ou extérieur",
      treads: "Nombre de marches",
      railingFt: "Rampe (pi lin.)",
      egPrefix: "p. ex. ",
    },
    options: {
      good: "Bon",
      fair: "Moyen",
      poor: "Mauvais / à réparer",
      poorPrep: "Mauvais / préparation requise",
      ground: "Rez-de-chaussée",
      second_storey: "Deuxième étage",
      scaffold: "Échafaudage requis",
      new_or_sound: "Maçonnerie neuve / saine",
      minor_repair: "Réparation mineure",
      major_repair: "Réparation majeure",
      standard: "Saines — usure normale",
      moderate: "Un peu de préparation supplémentaire",
      high: "Graisse tenace, dommages ou écaillage",
      bareLevel: "Nu et de niveau",
      somePrep: "Un peu de préparation",
      tearOut: "Arrachage + nivellement",
      interior: "Intérieur",
      exterior: "Extérieur",
    },
    whatKindOfJob: "Quel type de travail ?",
    whatNeedsToGo: "Que faut-il enlever ?",
    cantTake: (list) => `Nous ne prenons pas : ${list}.`,
    harder: "Quelque chose qui complique la tâche ? (facultatif)",
    flightsOfStairs: "Volées d'escalier",
    disassembly: "À démonter",
    demolition: "Petite démolition",
    longCarry: "Long transport jusqu'au camion",
    noElevator: "À l'étage, sans ascenseur",
    fewer: "Moins",
    more: "Plus",
    yourEstimate: "Votre estimation",
    estimatedRange: "Fourchette estimée",
    minimumApplied: "Ce projet est sous notre montant minimum de facturation, alors le minimum s’applique.",
    fillInForm: "Complétez le formulaire pour voir votre estimation.",
    pickService: "Choisissez un service pour commencer.",
    squares: "carrés",
    sqft: "pi²",
    pitch: "de pente",
    ftOfGutter: "pi de gouttière",
    downspouts: "descentes",
    propertyAlt: "Propriété",
    measureSource: {
      roof_address: "à partir de mesures satellites de votre toit",
      gutter_address: "à partir de mesures aériennes de votre toiture",
      lawn_polygon: "à partir de la zone que vous avez tracée sur la carte",
      area_polygon: "à partir de la zone que vous avez tracée sur la carte",
      lawn_address: "à partir des données de votre lot et de votre toit, ou de la zone tracée",
      manual_area: "à partir de la surface que vous nous avez donnée",
      manual_units: "à partir des quantités que vous nous avez données",
      stair_count: "à partir des quantités que vous nous avez données",
      item_picker: "à partir des objets que vous avez choisis",
      other: "à partir des détails que vous nous avez donnés",
    },
    disclaimer: (source, company) =>
      `Ceci est une estimation ${source}, pas une soumission finale. ${company} la confirmera avant tout engagement.`,
    seeFinancing: "Voir les options de financement",
    reference: (ref) => `Référence ${ref}`,
    allSet: "C'est tout bon",
    hasYourDetails: (company) => `${company} a vos coordonnées et confirmera votre soumission sous peu.`,
    bookTitle: "Souhaitez-vous que nous venions voir ?",
    bookBody: "Réservez une visite et nous confirmerons votre prix sur place.",
    bookCta: "Réserver une visite",
    pickServiceFirst: "Choisissez d'abord un service.",
    missingService: "Service manquant.",
    missingContact: "Indiquez votre nom et un courriel ou un téléphone pour que nous puissions vous envoyer votre soumission.",
    missingWhen: "Indiquez quand vous en avez besoin.",
    measureFailed: "Nous n'avons pas pu mesurer cela. Veuillez réessayer.",
    optionUnavailable: "Cette option n'est pas offerte. Choisissez-en une autre.",
    tradeUnavailable: (label) => `${label} n'est pas offert en estimation instantanée pour le moment.`,
    measureErrors: {
      no_address: "Entrez l'adresse de la propriété pour mesurer la pelouse.",
      no_linear_geometry: "Nous n'avons pas pu lire les bords du toit à cette adresse automatiquement — demandez une soumission et nous mesurerons sur place.",
      no_roof_coverage: "Nous n'avons pas pu mesurer ce toit automatiquement — vérifiez l'adresse, ou demandez une soumission et nous mesurerons à la main.",
      geocode_failed: "Nous n'avons pas trouvé cette adresse. Essayez d'inclure la ville et le code postal.",
      no_polygon: "Tracez d'abord la surface sur la carte.",
      no_area: "Entrez la surface pour obtenir une estimation.",
      no_units: "Indiquez le nombre de portes et de tiroirs.",
      no_key: "La mesure automatique n'est pas encore configurée. Demandez une soumission et nous mesurerons à la main.",
      other: "Nous n'avons pas pu mesurer cela. Demandez une soumission et nous ferons un suivi.",
    },
  },
  es: {
    languageLabel: "Idioma",
    languageNames: { en: "English", fr: "Français", es: "Español" },
    instantEstimate: "Estimación instantánea",
    requestQuoteInstead: "Solicitar un presupuesto en su lugar →",
    couldNotLoad: "No se pudo cargar",
    notAvailable: "Las estimaciones instantáneas aún no están disponibles aquí.",
    heroNoTrade: "Cuéntenos sobre el trabajo y añada algunas fotos — le haremos llegar su precio.",
    heroGated: "Cuéntenos sobre el trabajo y añada algunas fotos — lo revisaremos y volveremos con su precio.",
    heroRange: "Cuéntenos sobre el trabajo y añada algunas fotos — su rango estimado aparece mientras avanza, y confirmaremos su precio final.",
    heroAfterSubmit: "Cuéntenos sobre el trabajo y añada algunas fotos — verá su rango estimado en cuanto envíe, y confirmaremos su precio final.",
    ctaReveal: "Ver mi estimación",
    ctaGet: "Obtener mi estimación",
    whatDoYouNeed: "¿Qué necesita?",
    aboutProperty: "Cuéntenos sobre la propiedad",
    propertyAddress: "Dirección de la propiedad",
    addressPlaceholder: "917 Littlerock St, ciudad, código postal",
    yourProgram: "Su programa",
    whichOption: "¿Qué opción?",
    yourBudget: "Su presupuesto",
    whereIsJob: "¿Dónde es el trabajo?",
    jobAddressPlaceholder: "Calle, ciudad, código postal",
    yourDetails: "Sus datos",
    namePlaceholder: "Su nombre *",
    emailPlaceholder: "Correo electrónico",
    phonePlaceholder: "Teléfono",
    photos: "Fotos",
    select: "Seleccionar…",
    stillNeeded: (list) => `Falta: ${list}`,
    missing: {
      whatYouNeed: "el servicio que necesita",
      jobDetails: "los detalles del trabajo",
      anOption: "una opción",
      aProgram: "un programa",
      jobAddress: "la dirección del trabajo",
      yourName: "su nombre",
      emailOrPhone: "un correo o teléfono",
      yourBudget: "su presupuesto",
      onePhoto: "al menos una foto",
      whenNeeded: "cuándo lo necesita",
    },
    submitFailed: "Algo salió mal. Inténtelo de nuevo.",
    poweredBy: "Mediciones a partir de imágenes satelitales.",
    mapFailed: "El mapa no se pudo cargar, así que no podemos medir su césped aquí.",
    mapFailedArea: "El mapa no se pudo cargar, así que no podemos medir el área aquí.",
    mapSearchPlaceholder: "Escriba su dirección, pulse Intro para encontrarla y luego trace su césped",
    mapSearchPlaceholderArea: "Escriba su dirección, pulse Intro para encontrarla y luego trace el área",
    loadingMap: "Cargando el mapa…",
    tracedArea: (sqft) => `Área trazada: ${Number(sqft).toLocaleString("es")} pies²`,
    inputs: {
      tearOffLayers: "Capas de techo existentes a retirar",
      squareFootageFloor: "Área del piso (pies²)",
      squareFootageWall: "Área de la pared (pies²)",
      squareFootageCounter: "Área de la encimera (pies²)",
      squareFootageSurface: "Área de la superficie (pies²)",
      surfaceCondition: "Estado del piso",
      surfaceConditionPaint: "Estado de la superficie",
      subfloor: "Subsuelo / piso anterior",
      access: "Altura / acceso",
      condition: "Estado de la pared",
      doorCount: "Puertas de gabinete",
      drawerCount: "Frentes de cajón",
      complexityLevel: "Estado de los gabinetes",
      boxLinearFt: "Laterales de caja expuestos (pies lineales)",
      cutouts: "Cortes para fregadero / placa de cocción",
      edgeFt: "Borde mejorado (pies lineales)",
      backsplashSqft: "Salpicadero (pies²)",
      scope: "Interior o exterior",
      treads: "Número de escalones",
      railingFt: "Baranda (pies lineales)",
      egPrefix: "p. ej. ",
    },
    options: {
      good: "Bueno",
      fair: "Regular",
      poor: "Malo / necesita reparación",
      poorPrep: "Malo / necesita preparación",
      ground: "Planta baja",
      second_storey: "Segunda planta",
      scaffold: "Necesita andamio",
      new_or_sound: "Mampostería nueva / en buen estado",
      minor_repair: "Reparación menor",
      major_repair: "Reparación mayor",
      standard: "En buen estado — desgaste normal",
      moderate: "Algo de preparación adicional",
      high: "Grasa intensa, daños o descascarado",
      bareLevel: "Desnudo y nivelado",
      somePrep: "Algo de preparación",
      tearOut: "Demolición + nivelación",
      interior: "Interior",
      exterior: "Exterior",
    },
    whatKindOfJob: "¿Qué tipo de trabajo?",
    whatNeedsToGo: "¿Qué hay que retirar?",
    cantTake: (list) => `No podemos llevarnos: ${list}.`,
    harder: "¿Algo que lo complique? (opcional)",
    flightsOfStairs: "Tramos de escalera",
    disassembly: "Hay que desmontarlo",
    demolition: "Pequeña demolición",
    longCarry: "Trayecto largo hasta el camión",
    noElevator: "En planta alta, sin ascensor",
    fewer: "Menos",
    more: "Más",
    yourEstimate: "Su estimación",
    estimatedRange: "Rango estimado",
    minimumApplied: "Este trabajo queda por debajo de nuestro cargo mínimo, así que se aplica el mínimo.",
    fillInForm: "Complete el formulario y su estimación aparecerá aquí.",
    pickService: "Elija un servicio para empezar.",
    squares: "cuadros",
    sqft: "pies²",
    pitch: "de pendiente",
    ftOfGutter: "pies de canalón",
    downspouts: "bajantes",
    propertyAlt: "Propiedad",
    measureSource: {
      roof_address: "a partir de mediciones satelitales de su techo",
      gutter_address: "a partir de mediciones aéreas de su tejado",
      lawn_polygon: "a partir del área que trazó en el mapa",
      area_polygon: "a partir del área que trazó en el mapa",
      lawn_address: "a partir de los datos de su lote y su techo, o del área que trazó",
      manual_area: "a partir del área que nos indicó",
      manual_units: "a partir de las cantidades que nos indicó",
      stair_count: "a partir de las cantidades que nos indicó",
      item_picker: "a partir de los artículos que eligió",
      other: "a partir de los detalles que nos indicó",
    },
    disclaimer: (source, company) =>
      `Esta es una estimación ${source}, no un presupuesto final. ${company} la confirmará antes de que nada sea vinculante.`,
    seeFinancing: "Ver opciones de financiación",
    reference: (ref) => `Referencia ${ref}`,
    allSet: "Todo listo",
    hasYourDetails: (company) => `${company} tiene sus datos y confirmará su presupuesto en breve.`,
    bookTitle: "¿Quiere que vayamos a verlo?",
    bookBody: "Reserve una visita y confirmaremos su precio en el sitio.",
    bookCta: "Reservar una visita",
    pickServiceFirst: "Elija primero un servicio.",
    missingService: "Falta el servicio.",
    missingContact: "Indíquenos su nombre y un correo o teléfono para poder enviarle su presupuesto.",
    missingWhen: "Indíquenos cuándo necesita hacer esto.",
    measureFailed: "No pudimos medir eso. Inténtelo de nuevo.",
    optionUnavailable: "Esa opción no está disponible. Elija otra.",
    tradeUnavailable: (label) => `${label} no está disponible para una estimación instantánea en este momento.`,
    measureErrors: {
      no_address: "Introduzca la dirección de la propiedad para medir el césped.",
      no_linear_geometry: "No pudimos leer los bordes del techo en esa dirección automáticamente — solicite un presupuesto y lo mediremos en el sitio.",
      no_roof_coverage: "No pudimos medir ese techo automáticamente — revise la dirección, o solicite un presupuesto y lo mediremos a mano.",
      geocode_failed: "No encontramos esa dirección. Pruebe a incluir la ciudad y el código postal.",
      no_polygon: "Primero trace el área en el mapa.",
      no_area: "Introduzca el área para obtener una estimación.",
      no_units: "Indique cuántas puertas y cajones.",
      no_key: "La medición automática aún no está configurada. Solicite un presupuesto y lo mediremos a mano.",
      other: "No pudimos medir eso. Solicite un presupuesto y haremos seguimiento.",
    },
  },
};

/** The copy table for a language, falling back to English. */
export function instantQuoteCopy(language = "en") {
  return COPY[instantQuoteLanguage(language) || "en"];
}

/** The number locale the panel formats money and areas in. */
export function instantQuoteLocale(language = "en") {
  const code = instantQuoteLanguage(language) || "en";
  return code === "fr" ? "fr-CA" : code === "es" ? "es" : "en-CA";
}

/** Exported for scripts/check-instant-quote-copy.mjs. */
export const INSTANT_QUOTE_COPY = COPY;
export const INSTANT_TRADE_WORDS = TRADES;
export const JUNK_ITEM_WORDS = JUNK_ITEMS;
export const JUNK_JOB_TYPE_WORDS = JUNK_JOB_TYPES;
