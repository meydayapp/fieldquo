// lib/i18n/lawnEstimateCopy.js
//
// The homeowner-facing sentences on a lawn-care instant estimate, and the
// "this doesn't look right" control every measurement-based instant estimate
// carries — in English, French and Spanish.
//
// Same arrangement as lib/i18n/gutterEstimateCopy.js: a closed set of short
// transactional strings, hand-written, never drafted by a model, with
// functions where a figure is interpolated because word order around a
// number does not survive concatenation across languages. Server-side and
// client-side both read it (it imports nothing), so the public form, the
// /measure response, the confirmation email and the stored draft carry the
// same words.

const COPY = {
  en: {
    // ── Lawn size ────────────────────────────────────────────────────────
    lawnSizeLabel: "Estimated lawn size",
    lawnSize: (sqft) => `${Number(sqft).toLocaleString("en-CA")} sq ft`,
    sourceParcel:
      "Estimated from the lot boundary and the roof footprint, less a driveway allowance — not a measurement. Trace your lawn to correct it.",
    sourceMinimum:
      "Estimated — we have no lot data for this address, so this is our smallest pricing band. Trace your lawn to correct it.",
    sourceTraced: "Measured from the area you traced on the map.",
    belowMinimum: "Lawns under this size are priced at the minimum band.",
    traceCta: "Trace your lawn to correct it",
    traceHint: "Click around the grass on the map. The price updates from what you trace.",
    // ── Programs ────────────────────────────────────────────────────────
    programsHeading: "Choose a program",
    addOnsHeading: "Add-ons",
    addOnProgramsHeading: "Add-on programs",
    bestValue: "Best value",
    included: "Included",
    perService: (n) => `${n} services`,
    window: "When",
    total: "Your total",
    selectProgram: "Pick a program to see your total.",
    notAContract: "Prices are per season for the estimated lawn size, not a contract — final price confirmed on site.",
    needsSiteVisit:
      "We couldn't size this property reliably from the air, so there's no instant figure — request a call back and we'll measure it on site.",
    // ── This doesn't look right ─────────────────────────────────────────
    doubtTitle: "This doesn't look right?",
    doubtBody: "Aerial measurements can miss a shed, a pool or a neighbour's fence. We'll check it by hand.",
    callUs: "Call us",
    requestCallback: "Request a call back",
    cbName: "Your name",
    cbPhone: "Phone number",
    cbTime: "Best time to call",
    cbTimeOptions: [
      ["morning", "Morning"],
      ["afternoon", "Afternoon"],
      ["evening", "Evening"],
      ["anytime", "Any time"],
    ],
    cbNote: "What looks wrong? (optional)",
    cbSend: "Request the call",
    cbSending: "Sending…",
    cbDone: "Thanks — we'll call you back to check the measurement.",
    cbPhoneRequired: "We need a phone number to call you back.",
    cbFailed: "That didn't go through. Please call us instead.",
  },
  fr: {
    lawnSizeLabel: "Superficie de pelouse estimée",
    lawnSize: (sqft) => `${Number(sqft).toLocaleString("fr-CA")} pi²`,
    sourceParcel:
      "Estimée à partir des limites du lot et de l'empreinte du toit, moins une allocation pour l'entrée — ce n'est pas une mesure. Tracez votre pelouse pour la corriger.",
    sourceMinimum:
      "Estimée — nous n'avons pas de données de lot pour cette adresse, alors il s'agit de notre plus petite tranche de prix. Tracez votre pelouse pour la corriger.",
    sourceTraced: "Mesurée à partir de la zone que vous avez tracée sur la carte.",
    belowMinimum: "Les pelouses plus petites sont facturées à la tranche minimale.",
    traceCta: "Tracer votre pelouse pour corriger",
    traceHint: "Cliquez autour du gazon sur la carte. Le prix se met à jour selon votre tracé.",
    programsHeading: "Choisissez un programme",
    addOnsHeading: "Options",
    addOnProgramsHeading: "Programmes complémentaires",
    bestValue: "Meilleure valeur",
    included: "Inclus",
    perService: (n) => `${n} services`,
    window: "Quand",
    total: "Votre total",
    selectProgram: "Choisissez un programme pour voir votre total.",
    notAContract: "Prix par saison pour la superficie estimée, pas un contrat — le prix final est confirmé sur place.",
    needsSiteVisit:
      "Nous n'avons pas pu mesurer cette propriété de façon fiable depuis les airs, alors il n'y a pas de montant instantané — demandez un rappel et nous mesurerons sur place.",
    doubtTitle: "Ça ne semble pas juste ?",
    doubtBody: "Les mesures aériennes peuvent manquer un cabanon, une piscine ou la clôture du voisin. Nous vérifierons à la main.",
    callUs: "Appelez-nous",
    requestCallback: "Demander un rappel",
    cbName: "Votre nom",
    cbPhone: "Numéro de téléphone",
    cbTime: "Meilleur moment pour appeler",
    cbTimeOptions: [
      ["morning", "Matin"],
      ["afternoon", "Après-midi"],
      ["evening", "Soir"],
      ["anytime", "N'importe quand"],
    ],
    cbNote: "Qu'est-ce qui semble incorrect ? (facultatif)",
    cbSend: "Demander l'appel",
    cbSending: "Envoi…",
    cbDone: "Merci — nous vous rappellerons pour vérifier la mesure.",
    cbPhoneRequired: "Il nous faut un numéro de téléphone pour vous rappeler.",
    cbFailed: "Ça n'a pas fonctionné. Appelez-nous plutôt.",
  },
  es: {
    lawnSizeLabel: "Tamaño estimado del césped",
    lawnSize: (sqft) => `${Number(sqft).toLocaleString("es")} pies²`,
    sourceParcel:
      "Estimado a partir del límite del lote y la huella del tejado, menos un margen para la entrada — no es una medición. Trace su césped para corregirlo.",
    sourceMinimum:
      "Estimado — no tenemos datos del lote para esta dirección, así que es nuestro tramo de precio más pequeño. Trace su césped para corregirlo.",
    sourceTraced: "Medido a partir del área que trazó en el mapa.",
    belowMinimum: "Los céspedes más pequeños se cobran al tramo mínimo.",
    traceCta: "Trace su césped para corregirlo",
    traceHint: "Haga clic alrededor de la hierba en el mapa. El precio se actualiza con su trazado.",
    programsHeading: "Elija un programa",
    addOnsHeading: "Extras",
    addOnProgramsHeading: "Programas adicionales",
    bestValue: "Mejor valor",
    included: "Incluido",
    perService: (n) => `${n} servicios`,
    window: "Cuándo",
    total: "Su total",
    selectProgram: "Elija un programa para ver su total.",
    notAContract: "Precios por temporada para el tamaño estimado, no un contrato — el precio final se confirma en el sitio.",
    needsSiteVisit:
      "No pudimos medir esta propiedad de forma fiable desde el aire, así que no hay una cifra instantánea — pida que le llamemos y lo mediremos en el sitio.",
    doubtTitle: "¿Esto no parece correcto?",
    doubtBody: "Las mediciones aéreas pueden omitir un cobertizo, una piscina o la cerca del vecino. Lo comprobaremos a mano.",
    callUs: "Llámenos",
    requestCallback: "Pedir que le llamemos",
    cbName: "Su nombre",
    cbPhone: "Número de teléfono",
    cbTime: "Mejor hora para llamar",
    cbTimeOptions: [
      ["morning", "Mañana"],
      ["afternoon", "Tarde"],
      ["evening", "Noche"],
      ["anytime", "Cualquier hora"],
    ],
    cbNote: "¿Qué parece incorrecto? (opcional)",
    cbSend: "Solicitar la llamada",
    cbSending: "Enviando…",
    cbDone: "Gracias — le llamaremos para comprobar la medición.",
    cbPhoneRequired: "Necesitamos un número de teléfono para llamarle.",
    cbFailed: "No se pudo enviar. Llámenos en su lugar.",
  },
};

/** The copy table for a language, falling back to English. */
export function lawnEstimateCopy(language = "en") {
  const code = String(language || "en").toLowerCase().slice(0, 2);
  return Object.prototype.hasOwnProperty.call(COPY, code) ? COPY[code] : COPY.en;
}

/** The sentence under the lawn size, by where the figure came from. */
export function lawnSourceSentence(source, language = "en") {
  const t = lawnEstimateCopy(language);
  if (source === "traced") return t.sourceTraced;
  if (typeof source === "string" && source.startsWith("parcel")) return t.sourceParcel;
  return t.sourceMinimum;
}

/** The preferred-time keys the call-back form may post. */
export const CALLBACK_TIMES = COPY.en.cbTimeOptions.map(([k]) => k);

/** Exported for the language-completeness style checks. */
export const LAWN_ESTIMATE_COPY = COPY;
