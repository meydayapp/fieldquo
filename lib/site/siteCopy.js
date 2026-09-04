// lib/site/siteCopy.js
//
// The tenant website's own words — buttons, eyebrows, labels — in every language
// FieldQuo supports.
//
// ── Chrome vs content ──────────────────────────────────────────────────────
//
// Two different problems, deliberately solved differently.
//
// CHROME is the site's furniture: "Get a free quote", "What we do", "Drag the
// handle to compare", "Open · closes 5 PM". A fixed, countable set that never
// varies by company, so it lives here as a table. Translating it once is exact
// and free forever.
//
// CONTENT is the headline, the about copy, the service blurbs, the FAQ. That is
// written per company, so it cannot live in a table — it is GENERATED per
// language and stored (see CompanySite.translations). Machine-translating it at
// request time was the obvious alternative and is worse: it would translate a
// signed quote's wording differently on every render, and the same money-shaped
// text would read differently to two visitors.
//
// ── What was here before ───────────────────────────────────────────────────
//
// Every string below was hardcoded English in the renderer, so a Gatineau
// contractor whose company language is French got a French headline inside an
// English frame: "Get a free quote" under "Toiture et revêtement". Half-translated
// is arguably worse than not translated at all — it reads as a page nobody
// finished.
//
// ── Honesty about the translations ─────────────────────────────────────────
//
// en / fr are the ones I'd stake the product on: Canada's official languages and
// the ones the owner and the existing document/email catalogues already cover.
// es / uk / pa / tl match the existing lib/i18n catalogues.
//
// pa and tl were the last two to arrive here, and the reason is worth keeping.
// They were declared in app/i18n/languages.js while this file had no block for
// either, so a Punjabi contractor's site rendered generated Punjabi CONTENT
// inside English CHROME — the exact half-translated page the header above says
// this table exists to prevent. `isFullyTranslated()` reported that honestly and
// the picker declined to offer them, which was the right refusal but not a fix.
// The blocks below are the fix; the vocabulary in each is taken from that
// language's client-facing document copy rather than invented (see the notes on
// the blocks themselves).
//
// de / it are here AHEAD of the picker on purpose. app/i18n/languages.js is also
// the DOCUMENT language list, so a language must be complete in all four tables
// — here, documentLabels.js, clientDocCopy.js, emailCopy.js — before it can be
// offered at all, or a German contractor gets a German interface issuing an
// invoice whose "Zwischensumme" is still English. They are complete now.
// scripts/check-language-completeness.mjs holds the whole nine-step sequence.

import { DEFAULT_LANGUAGE, LANGUAGE_CODES, isSupported } from "@/app/i18n/languages";

const COPY = {
  en: {
    // Header / nav
    // "Home" is the menu item every other one is measured against, and it was
    // the one page slug with no entry here — so a fully translated site still
    // showed one English word in its own nav. See NAV_KEY_BY_SLUG in
    // app/api/settings/website/languages/route.js.
    navHome: "Home",
    navServices: "Services",
    navWork: "Our Work",
    navAbout: "About",
    navQuote: "Get a Quote",
    navBook: "Book",
    navFaq: "FAQ",
    navContact: "Contact",
    ctaQuoteShort: "Quote",
    ctaQuote: "Get a quote",
    ctaFreeQuote: "Get a free quote",
    ctaBook: "Book a visit",
    call: "Call",
    openNow: "Open now",
    closedNow: "Closed now",
    openUntil: "Open · closes",
    closedOpens: "Closed · opens",
    closed: "Closed",
    localTrusted: "Local & trusted",
    // Section eyebrows
    eyebrowServices: "What we do",
    eyebrowWork: "Our work",
    eyebrowBeforeAfter: "Before & after",
    eyebrowAbout: "About us",
    eyebrowProcess: "How it works",
    eyebrowTestimonials: "Homeowners",
    fiveStars: "5 out of 5 stars",
    eyebrowCredentials: "Credentials",
    eyebrowNumbers: "By the numbers",
    eyebrowAreas: "Where we work",
    eyebrowQuote: "Free estimate",
    eyebrowBook: "Book a visit",
    eyebrowFaq: "Good to know",
    eyebrowContact: "Get in touch",
    // Section defaults
    headingServices: "What we do",
    headingWork: "Our work",
    headingBeforeAfter: "Before & after",
    headingAbout: "About us",
    headingProcess: "How it works",
    headingTestimonials: "What clients say",
    headingCredentials: "Why us",
    headingAreas: "Areas we serve",
    headingQuote: "Tell us about your project",
    headingBook: "Book a visit",
    headingFaq: "Frequently asked questions",
    headingContact: "Get in touch",
    // Bits and pieces
    dragToCompare: "Drag the handle to compare.",
    before: "Before",
    after: "After",
    openQuoteForm: "Open the quote form",
    openBookingCalendar: "Open the booking calendar",
    siteBy: "Site by",
    // Derived intros
    introQuote: "It takes about a minute, and there's no obligation.",
    introBook: "Pick a time that suits you and we'll confirm by email.",
    introContact: "Get in touch and we'll come and take a look.",
    ctaSub: "Tell us about the job and we'll come and take a look.",
    servingArea: "Serving {place} and the surrounding area.",
    basedIn: "Based in {place}. Get in touch and we'll come and take a look.",
    workingIn: "Working in {place}?",
    readyToStart: "Ready to get started?",
    // The language picker itself
    chooseLanguage: "Language",

    // The mobile navigation button's accessible name. `t.menu` was read here
    // before this key existed, so siteCopy's Proxy returned "" and the `|| "Menu"`
    // fallback in SiteBlocks.js announced the button in English on every page,
    // in every language.
    menu: "Menu",
  },

  fr: {
    navHome: "Accueil",
    navServices: "Services",
    navWork: "Réalisations",
    navAbout: "À propos",
    navQuote: "Devis",
    navBook: "Rendez-vous",
    navFaq: "FAQ",
    navContact: "Contact",
    ctaQuoteShort: "Devis",
    ctaQuote: "Obtenir un devis",
    ctaFreeQuote: "Devis gratuit",
    ctaBook: "Prendre rendez-vous",
    call: "Appeler",
    openNow: "Ouvert",
    closedNow: "Fermé",
    openUntil: "Ouvert · ferme à",
    closedOpens: "Fermé · ouvre",
    closed: "Fermé",
    localTrusted: "De confiance, près de chez vous",
    eyebrowServices: "Nos services",
    eyebrowWork: "Nos réalisations",
    eyebrowBeforeAfter: "Avant et après",
    eyebrowAbout: "À propos",
    eyebrowProcess: "Comment ça marche",
    eyebrowTestimonials: "Nos clients",
    fiveStars: "5 étoiles sur 5",
    eyebrowCredentials: "Accréditations",
    eyebrowNumbers: "En chiffres",
    eyebrowAreas: "Zones desservies",
    eyebrowQuote: "Estimation gratuite",
    eyebrowBook: "Prendre rendez-vous",
    eyebrowFaq: "Bon à savoir",
    eyebrowContact: "Nous joindre",
    headingServices: "Nos services",
    headingWork: "Nos réalisations",
    headingBeforeAfter: "Avant et après",
    headingAbout: "À propos de nous",
    headingProcess: "Comment ça marche",
    headingTestimonials: "Ce que disent nos clients",
    headingCredentials: "Pourquoi nous choisir",
    headingAreas: "Zones desservies",
    headingQuote: "Parlez-nous de votre projet",
    headingBook: "Prendre rendez-vous",
    headingFaq: "Questions fréquentes",
    headingContact: "Nous joindre",
    dragToCompare: "Faites glisser pour comparer.",
    before: "Avant",
    after: "Après",
    openQuoteForm: "Ouvrir le formulaire de devis",
    openBookingCalendar: "Ouvrir le calendrier",
    siteBy: "Site par",
    introQuote: "Cela prend environ une minute, sans engagement.",
    introBook: "Choisissez un moment qui vous convient et nous confirmerons par courriel.",
    introContact: "Écrivez-nous et nous passerons jeter un coup d'œil.",
    ctaSub: "Parlez-nous du projet et nous passerons jeter un coup d'œil.",
    servingArea: "Nous desservons {place} et les environs.",
    basedIn: "Situés à {place}. Écrivez-nous et nous passerons jeter un coup d'œil.",
    workingIn: "Un projet à {place}?",
    readyToStart: "Prêt à commencer?",
    chooseLanguage: "Langue",
    menu: "Menu",
  },

  es: {
    navHome: "Inicio",
    navServices: "Servicios",
    navWork: "Trabajos",
    navAbout: "Nosotros",
    navQuote: "Presupuesto",
    navBook: "Reservar",
    navFaq: "Preguntas",
    navContact: "Contacto",
    ctaQuoteShort: "Presupuesto",
    ctaQuote: "Pedir presupuesto",
    ctaFreeQuote: "Presupuesto gratis",
    ctaBook: "Reservar una visita",
    call: "Llamar",
    openNow: "Abierto",
    closedNow: "Cerrado",
    openUntil: "Abierto · cierra a las",
    closedOpens: "Cerrado · abre",
    closed: "Cerrado",
    localTrusted: "Locales y de confianza",
    eyebrowServices: "Qué hacemos",
    eyebrowWork: "Nuestro trabajo",
    eyebrowBeforeAfter: "Antes y después",
    eyebrowAbout: "Sobre nosotros",
    eyebrowProcess: "Cómo funciona",
    eyebrowTestimonials: "Clientes",
    fiveStars: "5 estrellas de 5",
    eyebrowCredentials: "Certificaciones",
    eyebrowNumbers: "En números",
    eyebrowAreas: "Dónde trabajamos",
    eyebrowQuote: "Presupuesto gratuito",
    eyebrowBook: "Reservar una visita",
    eyebrowFaq: "Bueno saberlo",
    eyebrowContact: "Contáctenos",
    headingServices: "Qué hacemos",
    headingWork: "Nuestro trabajo",
    headingBeforeAfter: "Antes y después",
    headingAbout: "Sobre nosotros",
    headingProcess: "Cómo funciona",
    headingTestimonials: "Lo que dicen nuestros clientes",
    headingCredentials: "Por qué elegirnos",
    headingAreas: "Zonas que cubrimos",
    headingQuote: "Cuéntenos sobre su proyecto",
    headingBook: "Reservar una visita",
    headingFaq: "Preguntas frecuentes",
    headingContact: "Contáctenos",
    dragToCompare: "Arrastre para comparar.",
    before: "Antes",
    after: "Después",
    openQuoteForm: "Abrir el formulario",
    openBookingCalendar: "Abrir el calendario",
    siteBy: "Sitio por",
    introQuote: "Toma alrededor de un minuto y no hay compromiso.",
    introBook: "Elija la hora que le convenga y lo confirmaremos por correo.",
    introContact: "Escríbanos y pasaremos a echar un vistazo.",
    ctaSub: "Cuéntenos del trabajo y pasaremos a echar un vistazo.",
    servingArea: "Damos servicio en {place} y alrededores.",
    basedIn: "Ubicados en {place}. Escríbanos y pasaremos a echar un vistazo.",
    workingIn: "¿Un proyecto en {place}?",
    readyToStart: "¿Listo para empezar?",
    chooseLanguage: "Idioma",
    menu: "Menú",
  },

  uk: {
    navHome: "Головна",
    navServices: "Послуги",
    navWork: "Наші роботи",
    navAbout: "Про нас",
    navQuote: "Кошторис",
    navBook: "Записатися",
    navFaq: "Питання",
    navContact: "Контакти",
    ctaQuoteShort: "Кошторис",
    ctaQuote: "Отримати кошторис",
    ctaFreeQuote: "Безкоштовний кошторис",
    ctaBook: "Записатися на візит",
    call: "Подзвонити",
    openNow: "Відчинено",
    closedNow: "Зачинено",
    openUntil: "Відчинено · зачиняється у",
    closedOpens: "Зачинено · відчиняється",
    closed: "Зачинено",
    localTrusted: "Місцеві та надійні",
    eyebrowServices: "Що ми робимо",
    eyebrowWork: "Наші роботи",
    eyebrowBeforeAfter: "До і після",
    eyebrowAbout: "Про нас",
    eyebrowProcess: "Як це працює",
    eyebrowTestimonials: "Клієнти",
    fiveStars: "5 зірок із 5",
    eyebrowCredentials: "Сертифікати",
    eyebrowNumbers: "У цифрах",
    eyebrowAreas: "Де ми працюємо",
    eyebrowQuote: "Безкоштовна оцінка",
    eyebrowBook: "Записатися на візит",
    eyebrowFaq: "Варто знати",
    eyebrowContact: "Звʼязатися",
    headingServices: "Що ми робимо",
    headingWork: "Наші роботи",
    headingBeforeAfter: "До і після",
    headingAbout: "Про нас",
    headingProcess: "Як це працює",
    headingTestimonials: "Відгуки клієнтів",
    headingCredentials: "Чому ми",
    headingAreas: "Райони обслуговування",
    headingQuote: "Розкажіть про ваш проєкт",
    headingBook: "Записатися на візит",
    headingFaq: "Часті питання",
    headingContact: "Звʼязатися з нами",
    dragToCompare: "Потягніть, щоб порівняти.",
    before: "До",
    after: "Після",
    openQuoteForm: "Відкрити форму",
    openBookingCalendar: "Відкрити календар",
    siteBy: "Сайт від",
    introQuote: "Це займає близько хвилини, без жодних зобовʼязань.",
    introBook: "Виберіть зручний час, і ми підтвердимо електронною поштою.",
    introContact: "Напишіть нам, і ми приїдемо подивитися.",
    ctaSub: "Розкажіть про роботу, і ми приїдемо подивитися.",
    servingArea: "Обслуговуємо {place} та околиці.",
    basedIn: "Ми в {place}. Напишіть нам, і ми приїдемо подивитися.",
    workingIn: "Проєкт у {place}?",
    readyToStart: "Готові почати?",
    chooseLanguage: "Мова",
    menu: "Меню",
  },

  // ── Punjabi ──────────────────────────────────────────────────────────────
  //
  // The vocabulary is taken from the CLIENT-facing tables — documentLabels.js,
  // clientDocCopy.js, emailCopy.js — and not from app/i18n/appMessages.js, and
  // the difference is deliberate. The app catalogue writes a quote as
  // "ਕੋਟੇਸ਼ਨ" and an invoice as "ਇਨਵੌਇਸ", the borrowed words a contractor uses
  // at a desk. Every document a homeowner receives says "ਹਵਾਲਾ" and "ਬਿੱਲ".
  // This page is the homeowner's, and it links straight to that quote form, so
  // it takes the homeowner's word — "ਹਵਾਲਾ ਮੰਗੋ" here is the same string as
  // clientDocCopy's selfQuote.eyebrow, and "ਵਿਜ਼ਿਟ ਬੁੱਕ ਕਰੋ" the same as its
  // bookVisitCta. One concept, one word, along the whole client path.
  pa: {
    navHome: "ਮੁੱਖ ਪੰਨਾ",
    navServices: "ਸੇਵਾਵਾਂ",
    navWork: "ਸਾਡੇ ਕੰਮ",
    navAbout: "ਸਾਡੇ ਬਾਰੇ",
    navQuote: "ਹਵਾਲਾ",
    navBook: "ਬੁਕਿੰਗ",
    navFaq: "ਸਵਾਲ-ਜਵਾਬ",
    navContact: "ਸੰਪਰਕ",
    ctaQuoteShort: "ਹਵਾਲਾ",
    ctaQuote: "ਹਵਾਲਾ ਮੰਗੋ",
    ctaFreeQuote: "ਮੁਫ਼ਤ ਹਵਾਲਾ ਲਓ",
    ctaBook: "ਵਿਜ਼ਿਟ ਬੁੱਕ ਕਰੋ",
    call: "ਫ਼ੋਨ ਕਰੋ",
    openNow: "ਖੁੱਲ੍ਹਾ ਹੈ",
    closedNow: "ਬੰਦ ਹੈ",
    // A time follows each of these, and Punjabi puts it before the verb — so
    // "ਬੰਦ ਹੋਵੇਗਾ" would read as "closes 5 PM" with the words the wrong way
    // round. Naming the time instead ("closing time 5 PM") is grammatical in
    // the order the renderer fixes; see SiteBlocks.js, which concatenates.
    openUntil: "ਖੁੱਲ੍ਹਾ · ਬੰਦ ਹੋਣ ਦਾ ਸਮਾਂ",
    closedOpens: "ਬੰਦ · ਖੁੱਲ੍ਹਣ ਦਾ ਸਮਾਂ",
    closed: "ਬੰਦ",
    localTrusted: "ਸਥਾਨਕ ਅਤੇ ਭਰੋਸੇਯੋਗ",
    eyebrowServices: "ਅਸੀਂ ਕੀ ਕਰਦੇ ਹਾਂ",
    eyebrowWork: "ਸਾਡੇ ਕੰਮ",
    eyebrowBeforeAfter: "ਪਹਿਲਾਂ ਅਤੇ ਬਾਅਦ",
    eyebrowAbout: "ਸਾਡੇ ਬਾਰੇ",
    eyebrowProcess: "ਇਹ ਕਿਵੇਂ ਚੱਲਦਾ ਹੈ",
    eyebrowTestimonials: "ਘਰ-ਮਾਲਕ",
    fiveStars: "5 ਵਿੱਚੋਂ 5 ਤਾਰੇ",
    eyebrowCredentials: "ਯੋਗਤਾਵਾਂ",
    eyebrowNumbers: "ਅੰਕੜਿਆਂ ਵਿੱਚ",
    eyebrowAreas: "ਅਸੀਂ ਕਿੱਥੇ ਕੰਮ ਕਰਦੇ ਹਾਂ",
    eyebrowQuote: "ਮੁਫ਼ਤ ਅੰਦਾਜ਼ਾ",
    eyebrowBook: "ਵਿਜ਼ਿਟ ਬੁੱਕ ਕਰੋ",
    eyebrowFaq: "ਜਾਣਨਯੋਗ ਗੱਲਾਂ",
    eyebrowContact: "ਸੰਪਰਕ ਕਰੋ",
    headingServices: "ਅਸੀਂ ਕੀ ਕਰਦੇ ਹਾਂ",
    headingWork: "ਸਾਡੇ ਕੰਮ",
    headingBeforeAfter: "ਪਹਿਲਾਂ ਅਤੇ ਬਾਅਦ",
    headingAbout: "ਸਾਡੇ ਬਾਰੇ",
    headingProcess: "ਇਹ ਕਿਵੇਂ ਚੱਲਦਾ ਹੈ",
    headingTestimonials: "ਗਾਹਕ ਕੀ ਕਹਿੰਦੇ ਹਨ",
    headingCredentials: "ਸਾਨੂੰ ਕਿਉਂ ਚੁਣੋ",
    headingAreas: "ਅਸੀਂ ਜਿਨ੍ਹਾਂ ਇਲਾਕਿਆਂ ਵਿੱਚ ਕੰਮ ਕਰਦੇ ਹਾਂ",
    headingQuote: "ਸਾਨੂੰ ਆਪਣੇ ਪ੍ਰੋਜੈਕਟ ਬਾਰੇ ਦੱਸੋ",
    headingBook: "ਵਿਜ਼ਿਟ ਬੁੱਕ ਕਰੋ",
    headingFaq: "ਆਮ ਸਵਾਲ",
    headingContact: "ਸੰਪਰਕ ਕਰੋ",
    dragToCompare: "ਤੁਲਨਾ ਕਰਨ ਲਈ ਹੈਂਡਲ ਖਿੱਚੋ।",
    before: "ਪਹਿਲਾਂ",
    after: "ਬਾਅਦ",
    openQuoteForm: "ਹਵਾਲਾ ਫਾਰਮ ਖੋਲ੍ਹੋ",
    openBookingCalendar: "ਬੁਕਿੰਗ ਕੈਲੰਡਰ ਖੋਲ੍ਹੋ",
    // "Site by" is rendered as this string followed by the name, and Punjabi
    // needs the name first ("FieldQuo ਵੱਲੋਂ ਸਾਈਟ"). A label plus a colon is
    // the honest way to keep it grammatical without touching the renderer.
    siteBy: "ਸਾਈਟ ਬਣਾਉਣ ਵਾਲੇ:",
    introQuote: "ਇਸ ਵਿੱਚ ਲਗਭਗ ਇੱਕ ਮਿੰਟ ਲੱਗਦਾ ਹੈ, ਅਤੇ ਕੋਈ ਪਾਬੰਦੀ ਨਹੀਂ।",
    introBook: "ਆਪਣੇ ਮੁਤਾਬਕ ਸਮਾਂ ਚੁਣੋ, ਅਸੀਂ ਈਮੇਲ ਰਾਹੀਂ ਪੁਸ਼ਟੀ ਕਰਾਂਗੇ।",
    introContact: "ਸਾਡੇ ਨਾਲ ਸੰਪਰਕ ਕਰੋ, ਅਸੀਂ ਆ ਕੇ ਦੇਖ ਲਵਾਂਗੇ।",
    ctaSub: "ਸਾਨੂੰ ਕੰਮ ਬਾਰੇ ਦੱਸੋ, ਅਸੀਂ ਆ ਕੇ ਦੇਖ ਲਵਾਂਗੇ।",
    servingArea: "ਅਸੀਂ {place} ਅਤੇ ਆਲੇ-ਦੁਆਲੇ ਦੇ ਇਲਾਕੇ ਵਿੱਚ ਸੇਵਾ ਦਿੰਦੇ ਹਾਂ।",
    basedIn: "ਅਸੀਂ {place} ਵਿੱਚ ਹਾਂ। ਸਾਡੇ ਨਾਲ ਸੰਪਰਕ ਕਰੋ, ਅਸੀਂ ਆ ਕੇ ਦੇਖ ਲਵਾਂਗੇ।",
    workingIn: "{place} ਵਿੱਚ ਕੋਈ ਪ੍ਰੋਜੈਕਟ?",
    readyToStart: "ਸ਼ੁਰੂ ਕਰਨ ਲਈ ਤਿਆਰ ਹੋ?",
    chooseLanguage: "ਭਾਸ਼ਾ",
    menu: "ਮੀਨੂ",
  },

  // ── Tagalog ──────────────────────────────────────────────────────────────
  //
  // Polite register — `ninyo`, `po` where it falls naturally — matching
  // clientDocCopy.js and emailCopy.js rather than appMessages.js. The app
  // catalogue is deliberately informal (`mo`, `ka`): it talks to the
  // contractor, who is a colleague. This page talks to a stranger standing in
  // their own driveway, and the same product addressing them as `ka` after
  // their quote email said `kayo` reads as two different companies.
  tl: {
    navHome: "Home",
    navServices: "Mga Serbisyo",
    navWork: "Mga Trabaho",
    navAbout: "Tungkol sa Amin",
    navQuote: "Quote",
    navBook: "Mag-book",
    navFaq: "FAQ",
    navContact: "Kontak",
    ctaQuoteShort: "Quote",
    ctaQuote: "Humiling ng quote",
    ctaFreeQuote: "Kumuha ng libreng quote",
    ctaBook: "Mag-book ng pagbisita",
    call: "Tumawag",
    openNow: "Bukas ngayon",
    closedNow: "Sarado ngayon",
    openUntil: "Bukas · magsasara nang",
    closedOpens: "Sarado · magbubukas nang",
    closed: "Sarado",
    localTrusted: "Lokal at mapagkakatiwalaan",
    eyebrowServices: "Ano ang ginagawa namin",
    eyebrowWork: "Ang aming trabaho",
    eyebrowBeforeAfter: "Bago at pagkatapos",
    eyebrowAbout: "Tungkol sa amin",
    eyebrowProcess: "Paano ito gumagana",
    eyebrowTestimonials: "Mga may-ari ng bahay",
    fiveStars: "5 sa 5 na bituin",
    eyebrowCredentials: "Mga kredensyal",
    eyebrowNumbers: "Sa mga numero",
    eyebrowAreas: "Saan kami nagtatrabaho",
    eyebrowQuote: "Libreng tantiya",
    eyebrowBook: "Mag-book ng pagbisita",
    eyebrowFaq: "Mabuting malaman",
    eyebrowContact: "Makipag-ugnayan",
    headingServices: "Ano ang ginagawa namin",
    headingWork: "Ang aming trabaho",
    headingBeforeAfter: "Bago at pagkatapos",
    headingAbout: "Tungkol sa amin",
    headingProcess: "Paano ito gumagana",
    headingTestimonials: "Ang sinasabi ng mga kliyente",
    headingCredentials: "Bakit kami",
    headingAreas: "Mga lugar na sineserbisyuhan namin",
    headingQuote: "Ikuwento ninyo ang inyong proyekto",
    headingBook: "Mag-book ng pagbisita",
    headingFaq: "Mga madalas itanong",
    headingContact: "Makipag-ugnayan",
    dragToCompare: "I-drag ang handle para ihambing.",
    before: "Bago",
    after: "Pagkatapos",
    openQuoteForm: "Buksan ang quote form",
    openBookingCalendar: "Buksan ang booking calendar",
    siteBy: "Site ng",
    introQuote: "Mga isang minuto lang po ito, at walang obligasyon.",
    introBook:
      "Pumili po ng oras na bagay sa inyo at kukumpirmahin namin sa email.",
    introContact: "Makipag-ugnayan po kayo at pupuntahan namin ito.",
    ctaSub: "Ikuwento ninyo ang trabaho at pupuntahan namin ito.",
    servingArea: "Sineserbisyuhan namin ang {place} at ang mga karatig nito.",
    basedIn:
      "Nakabase sa {place}. Makipag-ugnayan po kayo at pupuntahan namin ito.",
    workingIn: "May proyekto sa {place}?",
    readyToStart: "Handa na po kayong magsimula?",
    chooseLanguage: "Wika",
    menu: "Menu",
  },

  // ── German, formal ───────────────────────────────────────────────────────
  //
  // `Sie`, and "Angebot" for a quote and "Termin" for a booking, both taken
  // from the German app catalogue and from the document tables so the website,
  // the quote and the covering email agree.
  de: {
    navHome: "Startseite",
    navServices: "Leistungen",
    navWork: "Referenzen",
    navAbout: "Über uns",
    navQuote: "Angebot",
    navBook: "Termin",
    navFaq: "FAQ",
    navContact: "Kontakt",
    ctaQuoteShort: "Angebot",
    ctaQuote: "Angebot anfordern",
    ctaFreeQuote: "Kostenloses Angebot",
    ctaBook: "Termin vereinbaren",
    call: "Anrufen",
    openNow: "Geöffnet",
    closedNow: "Geschlossen",
    openUntil: "Geöffnet · schließt um",
    closedOpens: "Geschlossen · öffnet",
    closed: "Geschlossen",
    localTrusted: "Aus der Region, zuverlässig",
    eyebrowServices: "Was wir machen",
    eyebrowWork: "Unsere Arbeiten",
    eyebrowBeforeAfter: "Vorher und nachher",
    eyebrowAbout: "Über uns",
    eyebrowProcess: "So läuft es ab",
    eyebrowTestimonials: "Hausbesitzer",
    fiveStars: "5 von 5 Sternen",
    eyebrowCredentials: "Qualifikationen",
    eyebrowNumbers: "In Zahlen",
    eyebrowAreas: "Wo wir arbeiten",
    eyebrowQuote: "Kostenlose Einschätzung",
    eyebrowBook: "Termin vereinbaren",
    eyebrowFaq: "Gut zu wissen",
    eyebrowContact: "Kontakt aufnehmen",
    headingServices: "Was wir machen",
    headingWork: "Unsere Arbeiten",
    headingBeforeAfter: "Vorher und nachher",
    headingAbout: "Über uns",
    headingProcess: "So läuft es ab",
    headingTestimonials: "Was unsere Kunden sagen",
    headingCredentials: "Warum wir",
    headingAreas: "Unser Einsatzgebiet",
    headingQuote: "Erzählen Sie uns von Ihrem Projekt",
    headingBook: "Termin vereinbaren",
    headingFaq: "Häufige Fragen",
    headingContact: "Kontakt aufnehmen",
    dragToCompare: "Zum Vergleichen den Regler ziehen.",
    before: "Vorher",
    after: "Nachher",
    openQuoteForm: "Angebotsformular öffnen",
    openBookingCalendar: "Terminkalender öffnen",
    siteBy: "Website von",
    introQuote: "Das dauert etwa eine Minute und ist unverbindlich.",
    introBook:
      "Wählen Sie einen Zeitpunkt, der Ihnen passt — wir bestätigen per E-Mail.",
    introContact: "Melden Sie sich, und wir schauen es uns an.",
    ctaSub: "Erzählen Sie uns von der Arbeit, und wir schauen es uns an.",
    servingArea: "Wir sind in {place} und Umgebung tätig.",
    basedIn: "Ansässig in {place}. Melden Sie sich, und wir schauen es uns an.",
    workingIn: "Ein Projekt in {place}?",
    readyToStart: "Bereit loszulegen?",
    chooseLanguage: "Sprache",
    menu: "Menü",
  },

  // ── Italian, formal ──────────────────────────────────────────────────────
  //
  // `Lei` in the sentences; the buttons stay infinitives, the same choice
  // clientDocCopy.js and emailCopy.js make and for the same reason — a "Chiama
  // ora" to a stranger on their own driveway is over-familiar.
  it: {
    navHome: "Home",
    navServices: "Servizi",
    navWork: "Lavori",
    navAbout: "Chi siamo",
    navQuote: "Preventivo",
    navBook: "Appuntamento",
    navFaq: "FAQ",
    navContact: "Contatti",
    ctaQuoteShort: "Preventivo",
    ctaQuote: "Richiedere un preventivo",
    ctaFreeQuote: "Preventivo gratuito",
    ctaBook: "Prenotare un appuntamento",
    call: "Chiamare",
    openNow: "Aperto",
    closedNow: "Chiuso",
    openUntil: "Aperto · chiude alle",
    closedOpens: "Chiuso · apre",
    closed: "Chiuso",
    localTrusted: "Del posto e affidabili",
    eyebrowServices: "Che cosa facciamo",
    eyebrowWork: "I nostri lavori",
    eyebrowBeforeAfter: "Prima e dopo",
    eyebrowAbout: "Chi siamo",
    eyebrowProcess: "Come funziona",
    eyebrowTestimonials: "I clienti",
    fiveStars: "5 stelle su 5",
    eyebrowCredentials: "Qualifiche",
    eyebrowNumbers: "In cifre",
    eyebrowAreas: "Dove lavoriamo",
    eyebrowQuote: "Stima gratuita",
    eyebrowBook: "Prenotare un appuntamento",
    eyebrowFaq: "Buono a sapersi",
    eyebrowContact: "Mettersi in contatto",
    headingServices: "Che cosa facciamo",
    headingWork: "I nostri lavori",
    headingBeforeAfter: "Prima e dopo",
    headingAbout: "Chi siamo",
    headingProcess: "Come funziona",
    headingTestimonials: "Che cosa dicono i clienti",
    headingCredentials: "Perché sceglierci",
    headingAreas: "Zone servite",
    headingQuote: "Ci racconti il suo progetto",
    headingBook: "Prenotare un appuntamento",
    headingFaq: "Domande frequenti",
    headingContact: "Mettersi in contatto",
    dragToCompare: "Trascini il cursore per confrontare.",
    before: "Prima",
    after: "Dopo",
    openQuoteForm: "Aprire il modulo di preventivo",
    openBookingCalendar: "Aprire il calendario",
    siteBy: "Sito di",
    introQuote: "Ci vuole circa un minuto e non impegna a nulla.",
    introBook: "Scelga l'orario che preferisce e le confermiamo via email.",
    introContact: "Ci scriva e passiamo a dare un'occhiata.",
    ctaSub: "Ci racconti il lavoro e passiamo a dare un'occhiata.",
    servingArea: "Serviamo {place} e dintorni.",
    basedIn: "Abbiamo sede a {place}. Ci scriva e passiamo a dare un'occhiata.",
    workingIn: "Un progetto a {place}?",
    readyToStart: "Pronto a iniziare?",
    chooseLanguage: "Lingua",
    menu: "Menu",
  },
};

/**
 * Languages this file can actually deliver a whole site in.
 *
 * BOTH conditions, intersected, and the intersection is the point:
 *
 *   - a block exists in COPY above — otherwise the picker offers Punjabi and
 *     serves an English frame, which is the control this file exists to stop;
 *   - the code is in app/i18n/languages.js — otherwise a language that is
 *     merely READY shows up in the website language picker as if it were
 *     available, and turning a language on is one decision made in one place.
 *
 * That second half is why this is not just `Object.keys(COPY)`. de and it are
 * complete in COPY, ahead of the picker on purpose (see the header), and this
 * list is served straight to the settings UI as `availableLanguages` — so
 * without the intersection, filling the table would have switched them on as a
 * side effect. They appear here the moment LANGUAGES gains them, and not
 * before.
 */
export const SITE_LANGUAGES = Object.keys(COPY).filter((c) =>
  LANGUAGE_CODES.includes(c),
);

/** The raw table, for scripts/check-language-completeness.mjs. */
export const SITE_COPY = COPY;

export function isFullyTranslated(code) {
  return SITE_LANGUAGES.includes(String(code || "").toLowerCase());
}

/**
 * The copy table for a language, falling back key-by-key to English.
 *
 * Key-by-key rather than whole-object, so adding a string to `en` doesn't render
 * as `undefined` in every other language until someone translates it — it renders
 * in English, which is wrong but readable, and readable-but-wrong beats blank.
 */
export function siteCopy(language) {
  const code = isSupported(language) ? String(language).toLowerCase() : DEFAULT_LANGUAGE;
  const table = COPY[code] || COPY[DEFAULT_LANGUAGE];
  return new Proxy(table, {
    get(target, key) {
      const v = target[key];
      if (v !== undefined) return v;
      const fallback = COPY[DEFAULT_LANGUAGE][key];
      if (fallback === undefined && typeof key === "string" && key !== "then") {
        // Loud in development, silent in production. A missing key is a bug in
        // this file, not something a visitor should ever be shown.
        if (process.env.NODE_ENV !== "production") {
          console.warn(`[siteCopy] no such key: ${String(key)}`);
        }
        return "";
      }
      return fallback;
    },
  });
}

/** Interpolate {place}-style holes. */
export function fill(template, values = {}) {
  return String(template || "").replace(/\{(\w+)\}/g, (_, k) =>
    values[k] === undefined || values[k] === null ? "" : String(values[k]),
  );
}
