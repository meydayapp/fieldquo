// lib/sales/outreach/introEmail.js
//
// The "we tried calling you" email — the one a rep sends the moment a call
// rings out or goes to voicemail. Fixed wording in English, French and
// Spanish; no model writes a word of it.
//
// ══ Why fixed wording and not the composer's templates ════════════════════
//
// The composer's templates (lib/sales/emailTemplates.js) are a starting
// point the rep edits. This one is sent from a pop-up with two buttons,
// forty times a day, by a rep who has just heard a voicemail greeting — the
// owner approved one design and the point of the pop-up is that nobody
// retypes it. So the text lives here, per language, and the only moving
// parts are merge fields: the business, the contact's first name, the rep,
// the trade, and four links. The three languages are SCRIPT_LANGUAGES
// (lib/sales/intel/callScript.js) — the ones a rep can sell in — and not
// the nine the portal's chrome is drawn in: the portal is read by the rep,
// this is read by the prospect, and a Ukrainian rep's Ontario prospect is
// an English email.
//
// ══ Pure ═════════════════════════════════════════════════════════════════
//
// No database, no next/server. buildIntroEmail() takes strings and returns
// { subject, html, text }, so scripts/check-sales-intro-email.mjs renders
// all three languages with every merge field filled and asserts: no field
// left as "{x}", no English word in the French or Spanish body, every link
// present in both parts, and every text/background pair at 4.5:1 — measured
// through lib/documents/theme.js, the same pairs a quote is drawn with,
// rather than assumed.
//
// ══ Tables, not divs ═════════════════════════════════════════════════════
//
// Every other outbound email from the rep is a person's paragraphs
// (lib/sales/outreach.js buildOutboundEmail). This one carries two buttons
// and a screenshot, and it has to survive Outlook's Word renderer, which
// ignores max-width on a div and flexbox entirely. So: one 600px table,
// nested tables for the buttons, inline styles on every cell, a bulletproof
// button (a link inside a padded, coloured cell rather than a styled <a>),
// and an image with explicit width. The plain-text part carries the same
// eight points and the same four links, so a reader on text-only mail gets
// the whole message.
//
// ══ Not white-label ══════════════════════════════════════════════════════
//
// FieldQuo emailing a prospect on FieldQuo's own behalf is the one place
// FieldQuo's own name and colour are the correct ones — AGENTS.md's rule is
// about the documents a CONTRACTOR's client sees.

import { escapeAttr, escapeHtml } from "@/lib/email/emailTheme";
import { documentTheme, fillPair, neutralPair } from "@/lib/documents/theme";
import { contrastRatio } from "@/lib/brand/colour";
import { sanitiseHeaderText } from "@/lib/sales/outreach";
import { TRADE_PITCH_TOP, tradeSellingPoints } from "@/lib/sales/tradeSellingPoints";

// The languages, from a file with no imports (the pop-up reads them too).
import { INTRO_EMAIL_DEFAULT_LANGUAGE, INTRO_EMAIL_LANGUAGES, isIntroEmailLanguage } from "./introLanguages";
export { INTRO_EMAIL_DEFAULT_LANGUAGE, INTRO_EMAIL_LANGUAGES, isIntroEmailLanguage };

/**
 * The trade, as a phrase that completes "…the back office for {trade}
 * businesses" in each language. Keyed by Prospect.tradeKey
 * (lib/sales/discovery/trades.js). The English column is the discovery
 * label lower-cased where that reads as an adjective; French and Spanish
 * take the "de …" complement so the sentence around them stays fixed.
 * `unknown` is what a lead with no trade gets — the product's own phrase for
 * its market, never a guess at the trade.
 */
export const INTRO_TRADE_PHRASES = Object.freeze({
  painting: { en: "painting", fr: "de peinture", es: "de pintura" },
  cabinets: { en: "cabinet", fr: "d'armoires", es: "de gabinetes" },
  flooring: { en: "flooring", fr: "de planchers", es: "de pisos" },
  countertops: { en: "countertop", fr: "de comptoirs", es: "de encimeras" },
  roofing: { en: "roofing", fr: "de toiture", es: "de techos" },
  plumbing: { en: "plumbing", fr: "de plomberie", es: "de plomería" },
  electrical: { en: "electrical", fr: "d'électricité", es: "de electricidad" },
  hvac: { en: "HVAC", fr: "de CVC", es: "de climatización" },
  landscaping: { en: "landscaping", fr: "d'aménagement paysager", es: "de jardinería" },
  carpentry: { en: "carpentry", fr: "de menuiserie", es: "de carpintería" },
  drywall: { en: "drywall", fr: "de gypse", es: "de paneles de yeso" },
  tiling: { en: "tiling", fr: "de céramique", es: "de azulejos" },
  siding: { en: "siding", fr: "de revêtement extérieur", es: "de revestimiento exterior" },
  gutters: { en: "gutter", fr: "de gouttières", es: "de canaletas" },
  fencing: { en: "fencing", fr: "de clôtures", es: "de cercas" },
  masonry_concrete: { en: "masonry and concrete", fr: "de maçonnerie et de béton", es: "de albañilería y concreto" },
  paving: { en: "paving", fr: "de pavage", es: "de pavimentación" },
  insulation: { en: "insulation", fr: "d'isolation", es: "de aislamiento" },
  restoration: { en: "restoration", fr: "de restauration après sinistre", es: "de restauración" },
  chimney: { en: "chimney", fr: "de cheminées", es: "de chimeneas" },
  pressure_washing: { en: "pressure-washing", fr: "de lavage à pression", es: "de lavado a presión" },
  junk_removal: { en: "junk-removal", fr: "de ramassage de débris", es: "de retiro de escombros" },
  house_cleaning: { en: "house-cleaning", fr: "d'entretien ménager", es: "de limpieza de casas" },
  carpet_cleaning: { en: "carpet-cleaning", fr: "de nettoyage de tapis", es: "de limpieza de alfombras" },
  window_cleaning: { en: "window-cleaning", fr: "de lavage de vitres", es: "de limpieza de ventanas" },
  handyman: { en: "handyman", fr: "d'homme à tout faire", es: "de servicios de mantenimiento" },
  excavation: { en: "excavation", fr: "d'excavation", es: "de excavación" },
  demolition: { en: "demolition", fr: "de démolition", es: "de demolición" },
  garage_door: { en: "garage-door", fr: "de portes de garage", es: "de puertas de garaje" },
  locksmith: { en: "locksmith", fr: "de serrurerie", es: "de cerrajería" },
  appliance_repair: { en: "appliance-repair", fr: "de réparation d'électroménagers", es: "de reparación de electrodomésticos" },
  pest_control: { en: "pest-control", fr: "d'extermination", es: "de control de plagas" },
  tree_care: { en: "tree-care", fr: "d'arboriculture", es: "de cuidado de árboles" },
  pool_spa: { en: "pool and spa", fr: "de piscines et spas", es: "de piscinas y spas" },
  irrigation: { en: "irrigation", fr: "d'irrigation", es: "de riego" },
  snow_removal: { en: "snow-removal", fr: "de déneigement", es: "de remoción de nieve" },
  home_inspection: { en: "home-inspection", fr: "d'inspection résidentielle", es: "de inspección de viviendas" },
  remodeling: { en: "remodeling", fr: "de rénovation", es: "de remodelación" },
  general_contracting: { en: "general-contracting", fr: "d'entrepreneur général", es: "de contratista general" },
  unknown: { en: "home-service", fr: "de services à domicile", es: "de servicios para el hogar" },
});

/** The phrase for a trade key in a language; `unknown` for anything the table lacks. */
export function introTradePhrase(tradeKey, language) {
  const lang = isIntroEmailLanguage(language) ? language : INTRO_EMAIL_DEFAULT_LANGUAGE;
  const row = typeof tradeKey === "string" && Object.hasOwn(INTRO_TRADE_PHRASES, tradeKey) ? INTRO_TRADE_PHRASES[tradeKey] : INTRO_TRADE_PHRASES.unknown;
  return row[lang];
}

/**
 * The words, per language. `{business}`, `{first}`, `{rep}`, `{trade}` are
 * the merge fields; fill() below replaces them and the check asserts none
 * survive. Eight points exactly — the owner's list, one clause each — and
 * the check counts them.
 *
 * French is Quebec French with "vous", "soumission" for a quote and
 * "cellulaire" for the phone, the register lib/sales/intel/callScript.js
 * writes the scripts in; Spanish is neutral Latin-American with "usted".
 */
/**
 * Who we say we are, by the LEAD's country. FieldQuo is one company on both
 * sides of the border; the sentence names the side the reader is on. The
 * owner, 2026-09-19: "say American company for leads in the USA and Canadian
 * company for Canadian companies — Canadians hate America right now because
 * of the political situation, and maybe the same for Americans." A lead
 * whose country we do not know gets the neutral phrase, never a guess.
 */
export const ORIGIN_PHRASE = Object.freeze({
  en: Object.freeze({ US: "an American company", CA: "a Canadian company", other: "a North American company" }),
  fr: Object.freeze({ US: "une entreprise américaine", CA: "une entreprise canadienne", other: "une entreprise nord-américaine" }),
  es: Object.freeze({ US: "una empresa estadounidense", CA: "una empresa canadiense", other: "una empresa norteamericana" }),
});

/** The one line between the French and the English halves of a Quebec email. */
export const BILINGUAL = Object.freeze({
  disclosure: "La version anglaise suit. / The English version follows.",
  subjectSuffix: "English below",
});

export function originPhrase(country, language = "en") {
  const table = ORIGIN_PHRASE[language] || ORIGIN_PHRASE.en;
  const c = String(country || "").trim().toUpperCase();
  return table[c] || table.other;
}

export const INTRO_COPY = Object.freeze({
  en: Object.freeze({
    subject: "Tried to reach you at {business} — one free month, no card needed",
    greetingNamed: "Hi {first},",
    greeting: "Hello,",
    intro:
      "I called {business} today and didn't reach you, so here's the short version in writing. " +
      "I'm {rep}, from FieldQuo — {origin} that builds the back office for {trade} businesses.",
    gap:
      "The gap we close is the one between a homeowner asking for a quote and having it in their hands. " +
      "Every day it stays open, somebody else's quote can land first.",
    // The trade's own three, before the eight — lib/sales/tradeSellingPoints.js.
    tradePointsIntro: "For a {trade} business, the three that matter most:",
    pointsIntro: "What's in it:",
    points: Object.freeze([
      Object.freeze({ title: "Instant quotes", clause: "built in the driveway, in under two minutes, from your own price list, and approved from their phone." }),
      Object.freeze({ title: "Smart leads", clause: "every enquiry in one list, scored hot to cold, one tap to turn it into a quote." }),
      Object.freeze({ title: "Quote → job → invoice", clause: "the approved quote becomes the job, the job becomes the invoice, nothing retyped." }),
      Object.freeze({ title: "Online booking", clause: "clients pick a slot from your real availability, with travel time built in." }),
      Object.freeze({ title: "Payments", clause: "a pay-now button on the invoice, a deposit to hold the slot, the card money in your account." }),
      Object.freeze({ title: "Jobs & dispatching", clause: "visits on the calendar, the person going assigned, the whole crew's week in one view." }),
      Object.freeze({ title: "Payroll", clause: "approved hours become a pay run with payslips, ready for your accountant." }),
      Object.freeze({ title: "Your name on everything", clause: "your logo and your colour on every quote, invoice, page and email a homeowner sees. Ours is nowhere." }),
    ]),
    ai: "There's AI under it too — it reviews each quote before it goes out and suggests the add-ons homeowners actually take, reads what your clients write back so nothing slips, and points you at the quotes worth chasing. More of them close.",
    screenshotCaption: "A quote as your customer sees it, on their phone.",
    screenshotCaptionTakeoff: "A {trade} quote being built in FieldQuo — measured and priced from your own price book.",
    screenshotAlt: "A FieldQuo quote on a phone, in the contractor's own name and colour",
    cta: "Try FieldQuo free for a month",
    ctaNote: "No card, no commitment. It's my link, so I'll see you signed up and can help you set it up.",
    callback: "Ask {rep} to call me back",
    demo: "Book a 15-minute demo",
    signoff: "Talk soon,",
    phoneLabel: "Cell",
    footerWhy: "You're receiving this because we called your business today.",
    unsubscribe: "Unsubscribe",
    unsubscribeOr: "or reply with the word “unsubscribe”.",
    reference: "Ref",
  }),
  fr: Object.freeze({
    subject: "J'ai essayé de vous joindre chez {business} — un mois gratuit, sans carte",
    greetingNamed: "Bonjour {first},",
    greeting: "Bonjour,",
    intro:
      "J'ai appelé {business} aujourd'hui sans réussir à vous joindre, alors voici la version courte par écrit. " +
      "Je suis {rep}, de FieldQuo — {origin} qui bâtit le bureau administratif des entreprises {trade}.",
    gap:
      "L'écart qu'on ferme, c'est celui entre le moment où un client demande une soumission et le moment où il l'a entre les mains. " +
      "Chaque jour où il reste ouvert, la soumission de quelqu'un d'autre peut arriver avant la vôtre.",
    tradePointsIntro: "Pour une entreprise {trade}, les trois qui comptent le plus :",
    pointsIntro: "Ce que ça comprend :",
    points: Object.freeze([
      Object.freeze({ title: "Soumissions instantanées", clause: "montées dans l'entrée de cour, en moins de deux minutes, à partir de votre propre liste de prix, et approuvées depuis leur cellulaire." }),
      Object.freeze({ title: "Demandes intelligentes", clause: "chaque demande dans une seule liste, classée de chaude à froide, une touche pour en faire une soumission." }),
      Object.freeze({ title: "Soumission → chantier → facture", clause: "la soumission approuvée devient le chantier, le chantier devient la facture, rien à retaper." }),
      Object.freeze({ title: "Réservation en ligne", clause: "le client choisit une plage dans vos vraies disponibilités, temps de déplacement compris." }),
      Object.freeze({ title: "Paiements", clause: "un bouton Payer sur la facture, un dépôt pour réserver la plage, l'argent de la carte dans votre compte." }),
      Object.freeze({ title: "Chantiers et répartition", clause: "les visites au calendrier, la personne qui y va assignée, la semaine de toute l'équipe d'un coup d'œil." }),
      Object.freeze({ title: "Paie", clause: "les heures approuvées deviennent une paie avec talons, prête pour votre comptable." }),
      Object.freeze({ title: "Votre nom partout", clause: "votre logo et votre couleur sur chaque soumission, facture, page et courriel que le client voit. Le nôtre n'apparaît nulle part." }),
    ]),
    ai: "Il y a de l'IA là-dessous aussi — elle relit chaque soumission avant l'envoi et propose les extras que les clients prennent vraiment, elle lit ce que vos clients répondent pour que rien ne passe entre les mailles, et elle vous pointe les soumissions qui valent une relance. Il s'en conclut davantage.",
    screenshotCaption: "Une soumission telle que votre client la voit, sur son cellulaire.",
    screenshotCaptionTakeoff: "Une soumission {trade} en train de se monter dans FieldQuo — mesurée et tarifée à partir de votre propre liste de prix.",
    screenshotAlt: "Une soumission FieldQuo sur un cellulaire, au nom et à la couleur de l'entrepreneur",
    cta: "Essayer FieldQuo gratuitement pendant un mois",
    ctaNote: "Aucune carte, aucun engagement. C'est mon lien : je verrai votre inscription et je pourrai vous aider à tout configurer.",
    callback: "Demander à {rep} de me rappeler",
    demo: "Réserver une démo de 15 minutes",
    signoff: "À bientôt,",
    phoneLabel: "Cellulaire",
    footerWhy: "Vous recevez ce courriel parce que nous avons appelé votre entreprise aujourd'hui.",
    unsubscribe: "Se désabonner",
    unsubscribeOr: "ou répondez avec le mot « unsubscribe ».",
    reference: "Réf",
  }),
  es: Object.freeze({
    subject: "Intenté comunicarme con {business} — un mes gratis, sin tarjeta",
    greetingNamed: "Hola {first}:",
    greeting: "Hola:",
    intro:
      "Hoy llamé a {business} y no logré comunicarme, así que aquí va la versión corta por escrito. " +
      "Soy {rep}, de FieldQuo — {origin} que construye la oficina administrativa para empresas {trade}.",
    gap:
      "La brecha que cerramos es la que hay entre que un cliente pide una cotización y la tiene en la mano. " +
      "Cada día que sigue abierta, la cotización de otro puede llegar primero.",
    tradePointsIntro: "Para una empresa {trade}, los tres que más importan:",
    pointsIntro: "Qué incluye:",
    points: Object.freeze([
      Object.freeze({ title: "Cotizaciones al instante", clause: "armadas en la entrada de la casa, en menos de dos minutos, desde su propia lista de precios, y aprobadas desde el celular del cliente." }),
      Object.freeze({ title: "Clientes potenciales inteligentes", clause: "cada consulta en una sola lista, clasificada de caliente a fría, un toque para convertirla en cotización." }),
      Object.freeze({ title: "Cotización → trabajo → factura", clause: "la cotización aprobada se vuelve el trabajo, el trabajo se vuelve la factura, nada se vuelve a escribir." }),
      Object.freeze({ title: "Reservas en línea", clause: "el cliente elige un horario según su disponibilidad real, con el tiempo de traslado incluido." }),
      Object.freeze({ title: "Pagos", clause: "un botón de pagar en la factura, un depósito para apartar el horario, el dinero de la tarjeta en su cuenta." }),
      Object.freeze({ title: "Trabajos y despacho", clause: "las visitas en el calendario, la persona que va asignada, la semana de todo el equipo de un vistazo." }),
      Object.freeze({ title: "Nómina", clause: "las horas aprobadas se vuelven una nómina con recibos de pago, lista para su contador." }),
      Object.freeze({ title: "Su nombre en todo", clause: "su logo y su color en cada cotización, factura, página y correo que ve el cliente. El nuestro no aparece en ninguna parte." }),
    ]),
    ai: "También hay IA por debajo — revisa cada cotización antes de enviarla y sugiere los extras que los clientes de verdad toman, lee lo que sus clientes responden para que nada se pase, y le señala las cotizaciones que vale la pena perseguir. Se cierran más.",
    screenshotCaption: "Una cotización tal como la ve su cliente, en su celular.",
    screenshotCaptionTakeoff: "Una cotización {trade} armándose en FieldQuo — medida y valorada desde su propia lista de precios.",
    screenshotAlt: "Una cotización de FieldQuo en un celular, con el nombre y el color del contratista",
    cta: "Probar FieldQuo gratis por un mes",
    ctaNote: "Sin tarjeta, sin compromiso. Es mi enlace: veré su registro y podré ayudarle a configurarlo todo.",
    callback: "Pedir que {rep} me llame",
    demo: "Reservar una demo de 15 minutos",
    signoff: "Hasta pronto,",
    phoneLabel: "Celular",
    footerWhy: "Recibe este correo porque hoy llamamos a su negocio.",
    unsubscribe: "Cancelar suscripción",
    unsubscribeOr: "o responda con la palabra «unsubscribe».",
    reference: "Ref",
  }),
});

/** The eight, as the owner listed them. The check holds every language to this count. */
export const INTRO_POINT_COUNT = 8;

/**
 * ══ The signup variants ═══════════════════════════════════════════════════
 *
 * The same email, with the sentences that are false for a signup lead
 * replaced. "I called {business} today and didn't reach you … {origin}
 * that builds the back office" opens on a stranger; a signup lead is not
 * one (lib/signup/leads.js). Three variants, keyed by Prospect.signupKind:
 *
 *   signup_abandoned  they started and stopped. The primary button goes
 *                     back to /signup with THEIR details filled in — the
 *                     rep's link plus `&resume=<token>` (introSend.js) — so
 *                     the rest of the way is one click.
 *   signup_new        they finished. The primary button is the fifteen-
 *                     minute SETUP call — the rep's demo-booking page — not
 *                     a signup link they have already used.
 *   signup_stalled    they finished and stopped: no card, or no quote. Same
 *                     button as new; the sentence names what stalled.
 *
 * Everything not listed here (the eight points, the AI paragraph, the
 * screenshot, the footer's mechanics) is the base copy's, so a variant
 * cannot drift into a second email that rots.
 */
export const INTRO_VARIANTS = Object.freeze(["signup_abandoned", "signup_new", "signup_stalled"]);

export function isIntroVariant(value) {
  return INTRO_VARIANTS.includes(value);
}

export const SIGNUP_INTRO_COPY = Object.freeze({
  en: Object.freeze({
    signup_abandoned: Object.freeze({
      subject: "You started setting up FieldQuo for {business} — pick up where you left off",
      intro:
        "I'm {rep}, from FieldQuo — {origin} that builds the back office for {trade} businesses. " +
        "You started setting up FieldQuo for {business} and got as far as {step}. I tried to call in case something got in the way; here's the short version in writing.",
      gap: "Everything you already typed is saved. The link below opens your signup with it filled in — about five minutes to the end, and your first quote can go out today.",
      cta: "Finish setting up FieldQuo",
      ctaNote: "Your details are already filled in. No card needed for the first month; cancel is one click in Settings.",
      footerWhy: "You're receiving this because you started a FieldQuo signup and gave us a phone number.",
    }),
    signup_new: Object.freeze({
      subject: "Welcome to FieldQuo, {business} — let's get your first quote out today",
      intro:
        "I'm {rep}, from FieldQuo — {origin} that builds the back office for {trade} businesses. " +
        "You just set up FieldQuo for {business}; I tried to call to help you get going, and this is the short version in writing.",
      gap: "The fastest way through the first week is fifteen minutes on the phone with me: your price list in, your logo on the quote, and the first one sent while we're talking.",
      cta: "Book a 15-minute setup call",
      ctaNote: "Pick a slot on my calendar. Or reply to this email and I'll ring you.",
      footerWhy: "You're receiving this because you set up a FieldQuo account for your business.",
    }),
    signup_stalled: Object.freeze({
      subject: "{business} on FieldQuo — one thing to sort out",
      intro:
        "I'm {rep}, from FieldQuo — {origin} that builds the back office for {trade} businesses. " +
        "You set up FieldQuo for {business} a little while ago, and it looks like it stopped short: {stalled}. I tried to call; here's the short version in writing.",
      gap: "That's usually a two-minute thing. Fifteen minutes with me and it's sorted, with your first quote out the door while we're on.",
      cta: "Book a 15-minute setup call",
      ctaNote: "Pick a slot on my calendar. Or reply to this email and I'll ring you.",
      footerWhy: "You're receiving this because you set up a FieldQuo account for your business.",
      noCard: "the account never got a card on it",
      noQuote: "no quote has gone out yet",
    }),
  }),
  fr: Object.freeze({
    signup_abandoned: Object.freeze({
      subject: "Vous avez commencé à configurer FieldQuo pour {business} — reprenez où vous étiez",
      intro:
        "Je suis {rep}, de FieldQuo — {origin} qui bâtit le bureau administratif des entreprises {trade}. " +
        "Vous avez commencé à configurer FieldQuo pour {business} et vous êtes rendu à l'étape {step}. J'ai essayé de vous appeler au cas où quelque chose vous aurait arrêté ; voici la version courte par écrit.",
      gap: "Tout ce que vous avez déjà tapé est sauvegardé. Le lien ci-dessous ouvre votre inscription déjà remplie — environ cinq minutes jusqu'à la fin, et votre première soumission peut partir aujourd'hui.",
      cta: "Terminer la configuration de FieldQuo",
      ctaNote: "Vos informations sont déjà remplies. Aucune carte pour le premier mois ; annuler se fait en un clic dans les Paramètres.",
      footerWhy: "Vous recevez ce courriel parce que vous avez commencé une inscription à FieldQuo et nous avez laissé un numéro de téléphone.",
    }),
    signup_new: Object.freeze({
      subject: "Bienvenue chez FieldQuo, {business} — faisons partir votre première soumission aujourd'hui",
      intro:
        "Je suis {rep}, de FieldQuo — {origin} qui bâtit le bureau administratif des entreprises {trade}. " +
        "Vous venez de configurer FieldQuo pour {business} ; j'ai essayé de vous appeler pour vous aider à démarrer, et voici la version courte par écrit.",
      gap: "Le chemin le plus rapide pour la première semaine, c'est quinze minutes au téléphone avec moi : votre liste de prix entrée, votre logo sur la soumission, et la première envoyée pendant qu'on se parle.",
      cta: "Réserver un appel de configuration de 15 minutes",
      ctaNote: "Choisissez une plage dans mon calendrier. Ou répondez à ce courriel et je vous appelle.",
      footerWhy: "Vous recevez ce courriel parce que vous avez créé un compte FieldQuo pour votre entreprise.",
    }),
    signup_stalled: Object.freeze({
      subject: "{business} sur FieldQuo — une chose à régler",
      intro:
        "Je suis {rep}, de FieldQuo — {origin} qui bâtit le bureau administratif des entreprises {trade}. " +
        "Vous avez configuré FieldQuo pour {business} il y a peu, et on dirait que ça s'est arrêté en chemin : {stalled}. J'ai essayé de vous appeler ; voici la version courte par écrit.",
      gap: "D'habitude, c'est l'affaire de deux minutes. Quinze minutes avec moi et c'est réglé, avec votre première soumission qui part pendant qu'on se parle.",
      cta: "Réserver un appel de configuration de 15 minutes",
      ctaNote: "Choisissez une plage dans mon calendrier. Ou répondez à ce courriel et je vous appelle.",
      footerWhy: "Vous recevez ce courriel parce que vous avez créé un compte FieldQuo pour votre entreprise.",
      noCard: "le compte n'a jamais eu de carte",
      noQuote: "aucune soumission n'est encore partie",
    }),
  }),
  es: Object.freeze({
    signup_abandoned: Object.freeze({
      subject: "Empezó a configurar FieldQuo para {business} — retome donde lo dejó",
      intro:
        "Soy {rep}, de FieldQuo — {origin} que construye la oficina administrativa para empresas {trade}. " +
        "Empezó a configurar FieldQuo para {business} y llegó hasta el paso {step}. Intenté llamarle por si algo se atravesó; aquí va la versión corta por escrito.",
      gap: "Todo lo que ya escribió está guardado. El enlace de abajo abre su registro ya completado — unos cinco minutos hasta el final, y su primera cotización puede salir hoy.",
      cta: "Terminar de configurar FieldQuo",
      ctaNote: "Sus datos ya están completados. Sin tarjeta el primer mes; cancelar es un clic en Configuración.",
      footerWhy: "Recibe este correo porque empezó un registro en FieldQuo y nos dejó un número de teléfono.",
    }),
    signup_new: Object.freeze({
      subject: "Bienvenido a FieldQuo, {business} — hagamos que su primera cotización salga hoy",
      intro:
        "Soy {rep}, de FieldQuo — {origin} que construye la oficina administrativa para empresas {trade}. " +
        "Acaba de configurar FieldQuo para {business}; intenté llamarle para ayudarle a arrancar, y esta es la versión corta por escrito.",
      gap: "El camino más rápido en la primera semana son quince minutos por teléfono conmigo: su lista de precios cargada, su logo en la cotización, y la primera enviada mientras hablamos.",
      cta: "Reservar una llamada de configuración de 15 minutos",
      ctaNote: "Elija un horario en mi calendario. O responda a este correo y le llamo.",
      footerWhy: "Recibe este correo porque creó una cuenta de FieldQuo para su negocio.",
    }),
    signup_stalled: Object.freeze({
      subject: "{business} en FieldQuo — una cosa por resolver",
      intro:
        "Soy {rep}, de FieldQuo — {origin} que construye la oficina administrativa para empresas {trade}. " +
        "Configuró FieldQuo para {business} hace poco, y parece que se quedó a medias: {stalled}. Intenté llamarle; aquí va la versión corta por escrito.",
      gap: "Normalmente es cosa de dos minutos. Quince minutos conmigo y queda resuelto, con su primera cotización saliendo mientras hablamos.",
      cta: "Reservar una llamada de configuración de 15 minutos",
      ctaNote: "Elija un horario en mi calendario. O responda a este correo y le llamo.",
      footerWhy: "Recibe este correo porque creó una cuenta de FieldQuo para su negocio.",
      noCard: "la cuenta nunca recibió una tarjeta",
      noQuote: "todavía no ha salido ninguna cotización",
    }),
  }),
});

/** The first name out of "Dave Martin" / "Martin, Dave" / "dave" — or "". */
export function firstNameOf(contactName) {
  const raw = sanitiseHeaderText(contactName, 120);
  if (!raw) return "";
  const beforeComma = raw.includes(",") ? raw.split(",")[1] || "" : raw;
  const first = beforeComma.trim().split(/\s+/)[0] || "";
  // "Mr." / "M." / "Sr." are not names.
  if (/^(mr|mrs|ms|dr|m|mme|sr|sra)\.?$/i.test(first)) {
    const rest = beforeComma.trim().split(/\s+/)[1] || "";
    return rest;
  }
  return first;
}

function fill(template, values) {
  let out = String(template ?? "");
  for (const [k, v] of Object.entries(values)) out = out.split(`{${k}}`).join(String(v ?? ""));
  return out;
}

/** The subject alone, for the pop-up's preview. */
export function introEmailSubject(language, business) {
  const lang = isIntroEmailLanguage(language) ? language : INTRO_EMAIL_DEFAULT_LANGUAGE;
  return sanitiseHeaderText(fill(INTRO_COPY[lang].subject, { business: sanitiseHeaderText(business, 120) }), 200);
}

/**
 * The colours, measured. FieldQuo's own navy through the same theme every
 * quote is drawn with; the primary button is fillPair (the fill moved until
 * the text on it clears 4.5:1), the two secondary buttons are the neutral
 * chip, the footer is inkMuted on paper. Exported so the check can measure
 * the same pairs the HTML uses rather than pairs it guessed at.
 */
export function introEmailPalette() {
  const theme = documentTheme({});
  const primary = fillPair(theme);
  const secondary = neutralPair(theme);
  return {
    paper: theme.paper,
    page: theme.page,
    ink: theme.ink,
    inkMuted: theme.inkMuted,
    accentText: theme.accentText,
    border: theme.border,
    primary,
    secondary,
    // Every foreground/background pair the email puts text on, so the check
    // is a loop over this list and not a reading of the markup.
    pairs: [
      { name: "body on paper", fg: theme.ink, bg: theme.paper },
      { name: "footer on paper", fg: theme.inkMuted, bg: theme.paper },
      { name: "links on paper", fg: theme.accentText, bg: theme.paper },
      { name: "primary button", fg: primary.fg, bg: primary.bg },
      { name: "secondary buttons", fg: secondary.fg, bg: secondary.bg },
      // Nothing is set on `page` — every line of text sits on the paper card.
      // inkMuted on page measures 4.40:1, which is exactly why.
    ].map((p) => ({ ...p, ratio: contrastRatio(p.fg, p.bg) })),
  };
}

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

/**
 * A button that renders in Outlook: a coloured cell with a link inside,
 * never a styled <a> alone. `inline` draws it as an inline-block so two of
 * them sit side by side where there is room and wrap on a phone — Outlook
 * ignores display and keeps them in flow, which at 600px is side by side.
 */
function button({ href, label, bg, fg, border = null, bold = true, inline = false }) {
  const edge = border ? `border:1px solid ${border};` : "";
  const flow = inline ? "display:inline-block;margin:4px 5px;" : "";
  return (
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;${flow}">` +
    `<tr><td align="center" bgcolor="${bg}" style="background:${bg};${edge}border-radius:8px;">` +
    `<a href="${escapeAttr(href)}" style="display:inline-block;padding:13px 22px;font-family:${FONT};font-size:15px;` +
    `font-weight:${bold ? 600 : 500};line-height:1.2;color:${fg};text-decoration:none;border-radius:8px;">${escapeHtml(label)}</a>` +
    `</td></tr></table>`
  );
}

/**
 * @param language       "en" | "fr" | "es" — anything else renders English
 *                       and reports `language: "en"`, never a half-translated
 *                       body.
 * @param rep            { name, email, phone } — the sender. `phone` is what
 *                       the sign-off prints; absent, the line is omitted
 *                       rather than invented.
 * @param business       the lead's business name.
 * @param contactName    the lead's contact, for the greeting.
 * @param tradeKey       Prospect.tradeKey or null.
 * @param signupLink     the rep's `/signup?sales=…&link=…`.
 * @param callbackUrl    the "call me back" link (lib/sales/outreach/introLink.js).
 * @param demoUrl        the "book a demo" link.
 * @param unsubscribeUrl the one-click unsubscribe.
 * @param screenshotUrl  the hosted picture for the trade, absolute
 *                       (lib/sales/outreach/introScreenshots.js).
 * @param screenshotAlt  its alt text, naming the trade in the language;
 *                       absent, the generic quote's.
 * @param mailingAddress FieldQuo's postal address. Required — CASL.
 * @param replyToken     the thread token, printed as "Ref:" so a reply files.
 * @param variant        null for the cold intro, or one of INTRO_VARIANTS for a
 *                       signup lead: the sentences change, the primary button
 *                       becomes `resumeUrl` (abandoned) or `demoUrl` (new,
 *                       stalled). Anything else is refused, not silently
 *                       rendered as the cold email to a customer.
 * @param resumeUrl      signup_abandoned only: /signup?…&resume=<token>.
 * @param stepLabel      signup_abandoned only: the step reached, in words.
 * @param stalledReason  signup_stalled only: "no_card" | "no_quote".
 * @returns { subject, html, text, language }
 * @throws when a required field is missing. A throw rather than a degraded
 *         email, for the reason buildOutboundEmail gives: reaching here
 *         without a mailing address means a readiness check was bypassed.
 */
export function buildIntroEmail({
  language,
  rep,
  business,
  contactName = null,
  tradeKey = null,
  country = null,
  signupLink,
  callbackUrl,
  demoUrl,
  unsubscribeUrl,
  screenshotUrl,
  screenshotAlt = null,
  mailingAddress,
  replyToken,
  englishBelow = false,
  variant = null,
  resumeUrl = null,
  stepLabel = null,
  stalledReason = null,
}) {
  const lang = isIntroEmailLanguage(language) ? language : INTRO_EMAIL_DEFAULT_LANGUAGE;
  if (variant != null && !isIntroVariant(variant)) throw new Error(`buildIntroEmail: "${variant}" is not an intro variant`);
  if (variant === "signup_abandoned" && !(typeof resumeUrl === "string" && /^https?:\/\//.test(resumeUrl))) {
    throw new Error("buildIntroEmail: the signup_abandoned variant needs an absolute resumeUrl");
  }
  // The base copy with the variant's sentences laid over it, per language.
  const copyFor = (l) => (variant ? { ...INTRO_COPY[l], ...SIGNUP_INTRO_COPY[l][variant] } : INTRO_COPY[l]);
  const copy = copyFor(lang);
  // Quebec: the French email carries the English version underneath, after a
  // one-line disclosure in both languages — the owner, 2026-09-19: "French
  // emails for the leads in Quebec, with 'English follows' … and then the
  // English version below." Only meaningful when the first language is not
  // English; the caller (introSend.js) decides from the lead's province.
  const bilingual = Boolean(englishBelow) && lang !== "en";

  const repName = sanitiseHeaderText(rep?.name, 120);
  const repEmail = sanitiseHeaderText(rep?.email, 254);
  const repPhone = sanitiseHeaderText(rep?.phone, 40);
  const businessName = sanitiseHeaderText(business, 160);
  const address = sanitiseHeaderText(mailingAddress, 300);
  const first = firstNameOf(contactName);

  if (!repName || !repEmail) throw new Error("buildIntroEmail needs the rep's name and email");
  if (!businessName) throw new Error("buildIntroEmail needs the business name");
  for (const [k, v] of Object.entries({ signupLink, callbackUrl, demoUrl, unsubscribeUrl, screenshotUrl })) {
    if (typeof v !== "string" || !/^https?:\/\//.test(v)) throw new Error(`buildIntroEmail needs an absolute ${k}`);
  }
  if (!address) {
    throw new Error(
      "FieldQuo's mailing address isn't set, and CASL requires one in every " +
        "commercial email. Set SALES_MAILING_ADDRESS — see docs/SALES-OUTREACH.md.",
    );
  }
  if (typeof replyToken !== "string" || !replyToken) throw new Error("buildIntroEmail needs the thread's reply token");

  // One language's body — greeting through the AI paragraph, the CTA rows and
  // the sign-off — as HTML rows and text lines. Called once for the email's
  // language and, for Quebec, once more for the English version underneath.
  const renderPart = (partLang, { withScreenshot = true } = {}) => {
    const partCopy = copyFor(partLang);
    const stalled = variant === "signup_stalled" ? (stalledReason === "no_quote" ? partCopy.noQuote : partCopy.noCard) : "";
    const values = { business: businessName, first, rep: repName, trade: introTradePhrase(tradeKey, partLang), origin: originPhrase(country, partLang), step: sanitiseHeaderText(stepLabel, 60) || "", stalled };
    // Where the primary button goes: back into their own signup, or onto
    // the rep's calendar. The cold email's is the rep's signup link.
    const primaryHref = variant === "signup_abandoned" ? resumeUrl : variant ? demoUrl : signupLink;
    // The trade's own three, from the one list every pitch surface reads. A
    // lead with no trade gets none — the eight below are the product's own
    // list and stand on their own; three invented "for your trade" lines
    // would be AGENTS.md failure class 5 in an inbox.
    const tradePoints = tradeSellingPoints(tradeKey, partLang, { limit: TRADE_PITCH_TOP }).points;
    const tradeIntro = tradePoints.length ? fill(partCopy.tradePointsIntro, values) : null;
    const subject = sanitiseHeaderText(fill(partCopy.subject, values), 200);
    const greeting = first ? fill(partCopy.greetingNamed, values) : partCopy.greeting;
    const intro = fill(partCopy.intro, values);
    const callbackLabel = fill(partCopy.callback, values);

    const c = introEmailPalette();
    // A phone-shaped quote is shown at phone width; a builder card (the
    // roofing still, the traced driveway) is a landscape frame and gets the
    // card's full width. The file name says which it is.
    const isPhone = /quote-phone\./.test(screenshotUrl);
    const shotWidth = isPhone ? 300 : 520;
    const altText = sanitiseHeaderText(screenshotAlt, 200) || partCopy.screenshotAlt;
    const caption = isPhone ? partCopy.screenshotCaption : fill(partCopy.screenshotCaptionTakeoff, values);

    // ── HTML ──────────────────────────────────────────────────────────────
    const p = (text, extra = "") =>
      `<p style="margin:0 0 14px 0;font-family:${FONT};font-size:15px;line-height:1.6;color:${c.ink};${extra}">${text}</p>`;

    const pointsHtml = partCopy.points
      .map(
        (pt) =>
          `<tr><td valign="top" style="padding:0 8px 8px 0;font-family:${FONT};font-size:15px;line-height:1.5;color:${c.ink};">&bull;</td>` +
          `<td valign="top" style="padding:0 0 8px 0;font-family:${FONT};font-size:15px;line-height:1.5;color:${c.ink};">` +
          `<strong>${escapeHtml(pt.title)}</strong> &mdash; ${escapeHtml(pt.clause)}</td></tr>`,
      )
      .join("");

    const tradePointsHtml = tradePoints
      .map(
        (pt, i) =>
          `<tr><td valign="top" style="padding:0 8px 8px 0;font-family:${FONT};font-size:15px;line-height:1.5;color:${c.ink};">${i + 1}.</td>` +
          `<td valign="top" style="padding:0 0 8px 0;font-family:${FONT};font-size:15px;line-height:1.5;color:${c.ink};">` +
          `<strong>${escapeHtml(pt.headline)}</strong> &mdash; ${escapeHtml(pt.oneLiner)}</td></tr>`,
      )
      .join("");

    const rows =
      `<tr><td style="padding:26px 22px 8px 22px;">` +
      p(escapeHtml(greeting)) +
      p(escapeHtml(intro)) +
      p(escapeHtml(partCopy.gap)) +
      (tradeIntro
        ? p(`<strong>${escapeHtml(tradeIntro)}</strong>`, "margin-bottom:8px;") +
          `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 10px 0;">${tradePointsHtml}</table>`
        : "") +
      p(`<strong>${escapeHtml(partCopy.pointsIntro)}</strong>`, "margin-bottom:8px;") +
      `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 10px 0;">${pointsHtml}</table>` +
      p(escapeHtml(partCopy.ai), "margin-bottom:6px;") +
      `</td></tr>` +
      (withScreenshot
        ? `<tr><td align="center" style="padding:6px 22px 6px 22px;">` +
          `<img src="${escapeAttr(screenshotUrl)}" width="${shotWidth}" alt="${escapeAttr(altText)}" ` +
          `style="display:block;width:${shotWidth}px;max-width:100%;height:auto;border:1px solid ${c.border};border-radius:10px;">` +
          `<p style="margin:8px 0 0 0;font-family:${FONT};font-size:13px;line-height:1.5;color:${c.inkMuted};">${escapeHtml(caption)}</p>` +
          `</td></tr>`
        : "") +
      `<tr><td align="center" style="padding:22px 22px 6px 22px;">` +
      button({ href: primaryHref, label: partCopy.cta, bg: c.primary.bg, fg: c.primary.fg }) +
      `<p style="margin:10px 0 0 0;font-family:${FONT};font-size:13px;line-height:1.5;color:${c.inkMuted};">${escapeHtml(partCopy.ctaNote)}</p>` +
      `</td></tr>` +
      `<tr><td align="center" style="padding:14px 20px 8px 20px;">` +
      button({ href: callbackUrl, label: callbackLabel, bg: c.secondary.bg, fg: c.secondary.fg, border: c.border, bold: false, inline: true }) +
      // The demo button is the PRIMARY on the new/stalled variants; drawn
      // twice it would be one link with two labels.
      (primaryHref === demoUrl ? "" : button({ href: demoUrl, label: partCopy.demo, bg: c.secondary.bg, fg: c.secondary.fg, border: c.border, bold: false, inline: true })) +
      `</td></tr>` +
      `<tr><td style="padding:18px 22px 24px 22px;">` +
      p(escapeHtml(partCopy.signoff), "margin-bottom:4px;") +
      p(
        `<strong>${escapeHtml(repName)}</strong><br>FieldQuo` +
          (repPhone ? `<br>${escapeHtml(partCopy.phoneLabel)}: ${escapeHtml(repPhone)}` : "") +
          `<br><a href="mailto:${escapeAttr(repEmail)}" style="color:${c.accentText};">${escapeHtml(repEmail)}</a>`,
        "margin-bottom:0;",
      ) +
      `</td></tr>`;

    const lines = [
      greeting,
      "",
      intro,
      "",
      partCopy.gap,
      "",
      ...(tradeIntro ? [tradeIntro, ...tradePoints.map((pt, i) => `${i + 1}. ${pt.headline} — ${pt.oneLiner}`), ""] : []),
      partCopy.pointsIntro,
      ...partCopy.points.map((pt) => `- ${pt.title} — ${pt.clause}`),
      "",
      partCopy.ai,
      "",
      ...(withScreenshot ? [`${caption} ${screenshotUrl}`, ""] : []),
      `${partCopy.cta}: ${primaryHref}`,
      partCopy.ctaNote,
      "",
      `${callbackLabel}: ${callbackUrl}`,
      ...(primaryHref === demoUrl ? [] : [`${partCopy.demo}: ${demoUrl}`]),
      "",
      partCopy.signoff,
      repName,
      "FieldQuo",
      ...(repPhone ? [`${partCopy.phoneLabel}: ${repPhone}`] : []),
      repEmail,
    ];
    return { subject, rows, lines, copy: partCopy };
  };

  const main = renderPart(lang);
  const english = bilingual ? renderPart("en", { withScreenshot: false }) : null;
  const subject = bilingual ? sanitiseHeaderText(`${main.subject} — ${BILINGUAL.subjectSuffix}`, 200) : main.subject;
  const c = introEmailPalette();
  const dividerRow = english
    ? `<tr><td style="padding:10px 22px 4px 22px;border-top:1px solid ${c.border};font-family:${FONT};font-size:13px;line-height:1.6;color:${c.inkMuted};">` +
      `<em>${escapeHtml(BILINGUAL.disclosure)}</em></td></tr>`
    : "";

  const html =
    `<!DOCTYPE html><html lang="${lang}"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<title>${escapeHtml(subject)}</title></head>` +
    `<body style="margin:0;padding:0;background:${c.page};">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${c.page}" style="background:${c.page};">` +
    `<tr><td align="center" style="padding:20px 12px;">` +
    // width="100%" capped by max-width, so a phone gets the phone's width;
    // Outlook ignores max-width, so the conditional wrapper pins it at 600.
    `<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:${c.paper};border:1px solid ${c.border};border-radius:12px;">` +
    main.rows +
    dividerRow +
    (english ? english.rows : "") +
    // The footer: why, where we are, how to stop — in the email's language.
    `<tr><td style="padding:14px 22px 22px 22px;border-top:1px solid ${c.border};font-family:${FONT};font-size:12px;line-height:1.6;color:${c.inkMuted};">` +
    `<div>${escapeHtml(copy.footerWhy)}</div>` +
    `<div>${escapeHtml(repName)} &middot; FieldQuo &middot; ${escapeHtml(address)}</div>` +
    `<div><a href="${escapeAttr(unsubscribeUrl)}" style="color:${c.inkMuted};text-decoration:underline;">${escapeHtml(copy.unsubscribe)}</a> ${escapeHtml(copy.unsubscribeOr)}</div>` +
    `<div>${escapeHtml(copy.reference)}: ${escapeHtml(replyToken)}</div>` +
    `</td></tr>` +
    `</table>` +
    `<!--[if mso]></td></tr></table><![endif]-->` +
    `</td></tr></table></body></html>`;

  // ── Text ──────────────────────────────────────────────────────────────
  const text = [
    ...main.lines,
    ...(english ? ["", "—", BILINGUAL.disclosure, "", ...english.lines] : []),
    "",
    "—",
    copy.footerWhy,
    `${repName} · FieldQuo · ${address}`,
    `${copy.unsubscribe}: ${unsubscribeUrl} — ${copy.unsubscribeOr}`,
    `${copy.reference}: ${replyToken}`,
    "",
  ].join("\n");

  return { subject, html, text, language: lang };
}
