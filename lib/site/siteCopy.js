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
// es / uk match the existing lib/i18n catalogues.
//
// pa (Punjabi) and tl (Tagalog) are declared in app/i18n/languages.js but have NO
// entries in lib/i18n/emailCopy.js or documentLabels.js — they were added to the
// language list without translations behind them. Rather than machine-translate
// blind and ship it as though it were checked, they fall back to English here and
// `isFullyTranslated()` says so, so the language picker can decline to offer a
// language it can't actually deliver. Filling them in is a job for someone who
// speaks them.

import { DEFAULT_LANGUAGE, isSupported } from "@/app/i18n/languages";

const COPY = {
  en: {
    // Header / nav
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
  },

  fr: {
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
  },

  es: {
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
  },

  uk: {
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
  },
};

/**
 * Languages this file can actually deliver a whole site in.
 *
 * pa and tl are absent on purpose — see the header. A language picker that offers
 * Punjabi and then serves an English page is the kind of control this codebase
 * keeps being swept for.
 */
export const SITE_LANGUAGES = Object.keys(COPY);

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
