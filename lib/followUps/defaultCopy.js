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

// ── And the words of the three ENQUIRY follow-ups (2026-11-02) ─────────────
//
// The owner: "send personalized Follow Ups to leads."
//
// FollowUpRule held 114 rows across 38 companies and not one of them was on
// the `lead_no_response` trigger — a trigger that had existed for weeks. So
// an enquiry that never became a quote was never chased by anything: the
// quote chase above cannot start, because there is no quote. TrueFinish
// Cabinets' own numbers are the case: fourteen leads from their agency
// between 23 October and 2 November, six estimates booked.
//
// ── Why the register is different from the quote chase ─────────────────────
//
// A quote chase writes to somebody holding a price. This writes to somebody
// who asked a question and has not been reached — they may have forgotten
// they asked. So it says what they asked about (the service, when the form
// captured one), it asks for a time rather than a decision, and it never
// mentions a price, a figure or a discount: nobody has looked at the job yet,
// and a number in this email would be a guess sent under the contractor's
// name.
//
// `body` takes the company name and the SERVICE, and every sentence that
// names the service has a shape for a lead that named none — a form with no
// category picked leaves it null, and padding it with an invented "your
// project" would be this file deciding what the homeowner wants (AGENTS.md:
// absence of a statement is not a statement).
//
// The same three languages as the quote chase, by the same rule: a client
// whose language is not one of them gets emailCopy's generic enquiry line in
// their own language (leadFollowUpIntro), never English day-specific copy.
export const LEAD_COPY = {
  en: {
    lead_new_d1: {
      subject: (company) => `About your enquiry — ${company}`,
      body: (company, service) => [
        `Thanks for getting in touch about ${service || "your project"}. We'd like to come and take a look so we can give you a proper price.`,
        `Reply to this email with a couple of times that suit you and we'll confirm one.`,
      ],
    },
    lead_new_d3: {
      subject: (company) => `Still happy to take a look — ${company}`,
      body: (company, service) => [
        `We haven't managed to pin down a time for ${service || "your project"} yet. We're still happy to come out and price it.`,
        `Mornings or afternoons — whichever is easier, reply and tell us and we'll work around you.`,
      ],
    },
    lead_new_d7: {
      subject: (company) => `Last note about your enquiry — ${company}`,
      body: (company, service) => [
        `This is the last we'll write about ${service || "your project"}. If the timing isn't right, that's absolutely fine.`,
        `If you'd still like a price, reply any time and we'll book a visit.`,
      ],
    },
  },
  fr: {
    lead_new_d1: {
      subject: (company) => `Au sujet de votre demande — ${company}`,
      body: (company, service) => [
        `Merci de nous avoir contactés au sujet de ${service || "votre projet"}. Nous aimerions passer voir les travaux afin de vous donner un prix juste.`,
        `Répondez à ce courriel avec deux ou trois moments qui vous conviennent et nous en confirmerons un.`,
      ],
    },
    lead_new_d3: {
      subject: (company) => `Toujours disponibles pour passer voir — ${company}`,
      body: (company, service) => [
        `Nous n'avons pas encore réussi à fixer un moment pour ${service || "votre projet"}. Nous sommes toujours disponibles pour venir l'évaluer.`,
        `Le matin ou l'après-midi — dites-nous simplement ce qui est le plus simple et nous nous organiserons.`,
      ],
    },
    lead_new_d7: {
      subject: (company) => `Dernier mot au sujet de votre demande — ${company}`,
      body: (company, service) => [
        `C'est le dernier courriel que nous vous écrirons au sujet de ${service || "votre projet"}. Si le moment n'est pas bien choisi, aucun souci.`,
        `Si vous souhaitez toujours un prix, répondez quand vous voulez et nous fixerons une visite.`,
      ],
    },
  },
  es: {
    lead_new_d1: {
      subject: (company) => `Sobre su solicitud — ${company}`,
      body: (company, service) => [
        `Gracias por escribirnos sobre ${service || "su proyecto"}. Nos gustaría pasar a verlo para poder darle un precio real.`,
        `Responda a este correo con dos o tres horarios que le convengan y confirmamos uno.`,
      ],
    },
    lead_new_d3: {
      subject: (company) => `Seguimos disponibles para pasar a verlo — ${company}`,
      body: (company, service) => [
        `Todavía no hemos concretado una hora para ${service || "su proyecto"}. Seguimos disponibles para ir a presupuestarlo.`,
        `Por la mañana o por la tarde — díganos qué le resulta más fácil y nos adaptamos.`,
      ],
    },
    lead_new_d7: {
      subject: (company) => `Última nota sobre su solicitud — ${company}`,
      body: (company, service) => [
        `Este es el último correo que le escribiremos sobre ${service || "su proyecto"}. Si no es buen momento, no hay ningún problema.`,
        `Si todavía quiere un precio, responda cuando quiera y agendamos una visita.`,
      ],
    },
  },
};

/** The languages the built-in wording is written in. */
export const BUILT_IN_LANGUAGES = Object.freeze(Object.keys(BUILT_IN_COPY));

/** The rule keys of the QUOTE chase, in the order they fire. */
export const BUILT_IN_KEYS = Object.freeze(["quote_sent_d1", "quote_sent_d7", "quote_sent_d14"]);

/** The rule keys of the ENQUIRY chase, in the order they fire. */
export const LEAD_KEYS = Object.freeze(["lead_new_d1", "lead_new_d3", "lead_new_d7"]);

/**
 * Which copy table a built-in key belongs to, so one lookup decides it.
 *
 * The two tables take DIFFERENT arguments — the quote chase's subject takes a
 * quote number, the enquiry chase's takes only the company — so a caller that
 * guessed would render "Q-1042" where a service name belongs. The settings
 * page's "what it says" panel reads this too, which is why it lives beside
 * the words and not in the renderer.
 */
export function builtInCopyKind(key) {
  if (BUILT_IN_KEYS.includes(key)) return "quote";
  if (LEAD_KEYS.includes(key)) return "lead";
  return null;
}

/** The copy table for a key, or null — for the page that previews them. */
export function builtInCopyTable(key) {
  const kind = builtInCopyKind(key);
  if (kind === "quote") return BUILT_IN_COPY;
  if (kind === "lead") return LEAD_COPY;
  return null;
}
