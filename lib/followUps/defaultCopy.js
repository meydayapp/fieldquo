// lib/followUps/defaultCopy.js
//
// The words of FieldQuo's three default follow-ups, and nothing else — no
// theme, no email shell, no db — so the settings page can import them to
// SHOW a company what each default says without pulling the whole email
// stack into the browser. lib/followUps/defaults.js is the renderer and the
// seeder and re-exports these.
//
// ── The words ───────────────────────────────────────────────────────────────
//
// Functions, not strings, for the reason lib/i18n/emailCopy.js gives: word
// order around a company name or a quote number differs by language, and the
// whole sentence has to live inside the function.
//
// `body` is an array of paragraphs. Nothing here mentions a price: the amount
// is on the quote, one click away, and a chase that re-states a figure reads
// as a bill.
export const BUILT_IN_COPY = {
  en: {
    quote_sent_d1: {
      subject: (company, number) => `Did quote ${number} from ${company} reach you?`,
      body: () => [
        `Just checking you got the quote we sent yesterday. It's at the link below, with everything we discussed.`,
        `If anything in it isn't clear, reply to this email and we'll sort it out.`,
      ],
    },
    quote_sent_d7: {
      subject: (company, number) => `Any questions on quote ${number}?`,
      body: () => [
        `A week on from sending your quote — any questions on it? Timing, scope, the price: whatever it is, reply and we'll talk it through.`,
        `The quote is still open at the link below.`,
      ],
    },
    quote_sent_d14: {
      subject: (company, number) => `Still here if you want to go ahead — quote ${number}`,
      body: () => [
        `Two weeks on, we're still here if you'd like to go ahead. Approve the quote at the link below and we'll get you on the schedule.`,
        `If you've gone another way, no hard feelings — a quick reply saying so and we'll stop writing.`,
      ],
    },
  },
  fr: {
    quote_sent_d1: {
      subject: (company, number) => `Avez-vous bien reçu la soumission ${number} de ${company}?`,
      body: () => [
        `Un petit mot pour vérifier que vous avez bien reçu la soumission envoyée hier. Elle se trouve au lien ci-dessous, avec tout ce dont nous avons discuté.`,
        `Si quelque chose n'est pas clair, répondez à ce courriel et nous le réglerons.`,
      ],
    },
    quote_sent_d7: {
      subject: (company, number) => `Des questions sur la soumission ${number}?`,
      body: () => [
        `Une semaine après l'envoi de votre soumission : avez-vous des questions? Délais, étendue des travaux, prix — peu importe, répondez et nous en discuterons.`,
        `La soumission est toujours ouverte au lien ci-dessous.`,
      ],
    },
    quote_sent_d14: {
      subject: (company, number) => `Toujours disponibles si vous souhaitez aller de l'avant — soumission ${number}`,
      body: () => [
        `Deux semaines plus tard, nous sommes toujours là si vous souhaitez aller de l'avant. Approuvez la soumission au lien ci-dessous et nous vous inscrirons à l'horaire.`,
        `Si vous avez choisi une autre option, aucun souci — une courte réponse pour nous le dire et nous cesserons d'écrire.`,
      ],
    },
  },
  es: {
    quote_sent_d1: {
      subject: (company, number) => `¿Le llegó el presupuesto ${number} de ${company}?`,
      body: () => [
        `Solo para confirmar que recibió el presupuesto que enviamos ayer. Está en el enlace de abajo, con todo lo que hablamos.`,
        `Si algo no queda claro, responda a este correo y lo resolvemos.`,
      ],
    },
    quote_sent_d7: {
      subject: (company, number) => `¿Alguna pregunta sobre el presupuesto ${number}?`,
      body: () => [
        `Ha pasado una semana desde que enviamos su presupuesto: ¿tiene alguna pregunta? Plazos, alcance, precio — lo que sea, responda y lo conversamos.`,
        `El presupuesto sigue abierto en el enlace de abajo.`,
      ],
    },
    quote_sent_d14: {
      subject: (company, number) => `Seguimos aquí si quiere seguir adelante — presupuesto ${number}`,
      body: () => [
        `Dos semanas después, seguimos aquí si quiere seguir adelante. Apruebe el presupuesto en el enlace de abajo y lo agendamos.`,
        `Si eligió otra opción, sin problema — una respuesta breve diciéndolo y dejamos de escribir.`,
      ],
    },
  },
};

/** The languages the built-in wording is written in. */
export const BUILT_IN_LANGUAGES = Object.freeze(Object.keys(BUILT_IN_COPY));

/** The rule keys, in the order they fire. */
export const BUILT_IN_KEYS = Object.freeze(["quote_sent_d1", "quote_sent_d7", "quote_sent_d14"]);
