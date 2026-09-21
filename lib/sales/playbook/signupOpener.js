// lib/sales/playbook/signupOpener.js
//
// The opener for a lead the SIGNUP FORM produced — said before any playbook
// stage, because the four default playbooks (defaults.js) open on "you've
// never heard of me", and this person typed their own number into FieldQuo
// this morning.
//
// ══ Three openers, one per kind ═══════════════════════════════════════════
//
//   abandoned  they started setting up FieldQuo and stopped. The call is
//              "can I get you the rest of the way?" — the owner's sentence.
//              Selling is over; the ask is fifteen minutes to finish.
//   new        they finished. The call is onboarding, not selling — "I'm
//              here to get your first quote out today" — and the ask is the
//              fifteen-minute setup call, which is the demo-booking link the
//              intro email carries for this kind.
//   stalled    they finished and then stopped: no card after the grace, or
//              no quote in a week. The opener names the thing that stalled,
//              in the rep's mouth, and offers to clear it on the call.
//
// ══ Same shape as turnaround.js, for the same reasons ═════════════════════
//
// EN / FR / ES, rendered as-is, English as the fallback that says so. The
// component (app/components/sales/SignupOpener.js) draws these in the script's
// language and the headings in the rep's own (nine keys). Nothing here goes
// through a model: it is the same sentence on every such call, and it has to
// be there whether or not an AI script was written for the row.
//
// {first} is the contact's first name when the form gave one; the sentence
// without it is written out rather than left with a hole, so a nameless row
// reads as a sentence and not as a template.
//
// Pure. Executed by scripts/check-signup-leads.mjs.

export const SIGNUP_OPENERS = Object.freeze({
  en: Object.freeze({
    abandoned: Object.freeze({
      named: "Hi {first} — {rep} here, from FieldQuo. You started setting up FieldQuo for {business} {when} and got as far as {step} — can I get you the rest of the way? It's about five minutes, and you'd have your first quote out today.",
      plain: "Hi — {rep} here, from FieldQuo. Somebody at {business} started setting up FieldQuo {when} and got as far as {step} — can I get you the rest of the way? It's about five minutes, and you'd have your first quote out today.",
      ask: "Have you got five minutes now, or is there a better time today?",
    }),
    new: Object.freeze({
      named: "Hi {first} — {rep} here, from FieldQuo. Saw you just set up FieldQuo for {business} — I'm here to get your first quote out today; got fifteen minutes?",
      plain: "Hi — {rep} here, from FieldQuo. Saw {business} just set up FieldQuo — I'm here to get your first quote out today; got fifteen minutes?",
      ask: "We can do it right now on the phone, or I can send you a link to book fifteen minutes.",
    }),
    stalled: Object.freeze({
      named: "Hi {first} — {rep} here, from FieldQuo. You set up FieldQuo for {business} {when}, and I noticed {stalled}. That's usually a two-minute thing — can I sort it out with you now?",
      plain: "Hi — {rep} here, from FieldQuo. {business} set up FieldQuo {when}, and I noticed {stalled}. That's usually a two-minute thing — can I sort it out with you now?",
      ask: "If now's bad, when's a good fifteen minutes today?",
      noCard: "the account never got a card on it, so it'll stop working",
      noQuote: "no quote has gone out yet",
    }),
  }),
  fr: Object.freeze({
    abandoned: Object.freeze({
      named: "Bonjour {first} — {rep}, de FieldQuo. Vous avez commencé à configurer FieldQuo pour {business} {when} et vous êtes rendu à l'étape {step} — je peux vous aider à finir ? Ça prend environ cinq minutes, et votre première soumission pourrait partir aujourd'hui.",
      plain: "Bonjour — {rep}, de FieldQuo. Quelqu'un chez {business} a commencé à configurer FieldQuo {when} et s'est rendu à l'étape {step} — je peux vous aider à finir ? Ça prend environ cinq minutes, et votre première soumission pourrait partir aujourd'hui.",
      ask: "Vous avez cinq minutes maintenant, ou il y a un meilleur moment aujourd'hui ?",
    }),
    new: Object.freeze({
      named: "Bonjour {first} — {rep}, de FieldQuo. J'ai vu que vous venez de configurer FieldQuo pour {business} — je suis là pour faire sortir votre première soumission aujourd'hui ; vous avez quinze minutes ?",
      plain: "Bonjour — {rep}, de FieldQuo. J'ai vu que {business} vient de configurer FieldQuo — je suis là pour faire sortir votre première soumission aujourd'hui ; vous avez quinze minutes ?",
      ask: "On peut le faire tout de suite au téléphone, ou je vous envoie un lien pour réserver quinze minutes.",
    }),
    stalled: Object.freeze({
      named: "Bonjour {first} — {rep}, de FieldQuo. Vous avez configuré FieldQuo pour {business} {when}, et j'ai remarqué que {stalled}. D'habitude c'est l'affaire de deux minutes — je peux régler ça avec vous maintenant ?",
      plain: "Bonjour — {rep}, de FieldQuo. {business} a configuré FieldQuo {when}, et j'ai remarqué que {stalled}. D'habitude c'est l'affaire de deux minutes — je peux régler ça avec vous maintenant ?",
      ask: "Si ce n'est pas le bon moment, quand est-ce que vous auriez quinze minutes aujourd'hui ?",
      noCard: "le compte n'a jamais eu de carte, alors il va arrêter de fonctionner",
      noQuote: "aucune soumission n'est encore partie",
    }),
  }),
  es: Object.freeze({
    abandoned: Object.freeze({
      named: "Hola {first} — le habla {rep}, de FieldQuo. Empezó a configurar FieldQuo para {business} {when} y llegó hasta el paso {step} — ¿le ayudo a terminar? Son unos cinco minutos, y hoy mismo podría salir su primera cotización.",
      plain: "Hola — le habla {rep}, de FieldQuo. Alguien de {business} empezó a configurar FieldQuo {when} y llegó hasta el paso {step} — ¿le ayudo a terminar? Son unos cinco minutos, y hoy mismo podría salir su primera cotización.",
      ask: "¿Tiene cinco minutos ahora, o hay un mejor momento hoy?",
    }),
    new: Object.freeze({
      named: "Hola {first} — le habla {rep}, de FieldQuo. Vi que acaba de configurar FieldQuo para {business} — estoy aquí para que su primera cotización salga hoy; ¿tiene quince minutos?",
      plain: "Hola — le habla {rep}, de FieldQuo. Vi que {business} acaba de configurar FieldQuo — estoy aquí para que su primera cotización salga hoy; ¿tiene quince minutos?",
      ask: "Lo podemos hacer ahora mismo por teléfono, o le mando un enlace para reservar quince minutos.",
    }),
    stalled: Object.freeze({
      named: "Hola {first} — le habla {rep}, de FieldQuo. Configuró FieldQuo para {business} {when}, y noté que {stalled}. Normalmente es cosa de dos minutos — ¿lo resolvemos ahora?",
      plain: "Hola — le habla {rep}, de FieldQuo. {business} configuró FieldQuo {when}, y noté que {stalled}. Normalmente es cosa de dos minutos — ¿lo resolvemos ahora?",
      ask: "Si ahora no es buen momento, ¿cuándo tendría quince minutos hoy?",
      noCard: "la cuenta nunca recibió una tarjeta, así que va a dejar de funcionar",
      noQuote: "todavía no ha salido ninguna cotización",
    }),
  }),
});

export const SIGNUP_OPENER_LANGUAGES = Object.freeze(Object.keys(SIGNUP_OPENERS));
export const SIGNUP_OPENER_KINDS = Object.freeze(["abandoned", "new", "stalled"]);

/** "this morning" / "yesterday" / "3 days ago" — the {when} the openers say, per language. */
const WHEN = Object.freeze({
  en: { today: "this morning", yesterday: "yesterday", days: (n) => `${n} days ago` },
  fr: { today: "ce matin", yesterday: "hier", days: (n) => `il y a ${n} jours` },
  es: { today: "esta mañana", yesterday: "ayer", days: (n) => `hace ${n} días` },
});

export function whenPhrase(at, language = "en", now = new Date()) {
  const table = WHEN[language] || WHEN.en;
  const d = at ? new Date(at) : null;
  if (!d || Number.isNaN(d.getTime())) return table.today;
  const days = Math.floor((now.getTime() - d.getTime()) / (24 * 60 * 60 * 1000));
  if (days <= 0) return table.today;
  if (days === 1) return table.yesterday;
  return table.days(days);
}

function fill(template, values) {
  let out = String(template ?? "");
  for (const [k, v] of Object.entries(values)) out = out.split(`{${k}}`).join(String(v ?? ""));
  return out;
}

/**
 * The opener and the ask for one signup lead, in one language — English
 * with `fallback: true` when the table has no such language.
 *
 * @param kind      "abandoned" | "new" | "stalled"
 * @param language  "en" | "fr" | "es"
 * @param first     the contact's first name, or null
 * @param business  the business name (the row's, never invented)
 * @param rep       the rep's name
 * @param step      the step reached, already in words (STEP_LABELS)
 * @param at        when they started / signed up
 * @param stalledReason "no_card" | "no_quote" | null
 */
export function signupOpenerFor({ kind, language = "en", first = null, business = "", rep = "", step = "", at = null, stalledReason = null, now = new Date() } = {}) {
  if (!SIGNUP_OPENER_KINDS.includes(kind)) return null;
  const code = typeof language === "string" ? language.trim().toLowerCase().slice(0, 2) : "";
  const lang = Object.hasOwn(SIGNUP_OPENERS, code) ? code : "en";
  const copy = SIGNUP_OPENERS[lang][kind];
  const stalled = kind === "stalled" ? (stalledReason === "no_quote" ? copy.noQuote : copy.noCard) : "";
  const values = { first: first || "", business: business || "", rep: rep || "", step: step || "", when: whenPhrase(at, lang, now), stalled };
  return {
    language: lang,
    fallback: lang !== code,
    kind,
    say: fill(first ? copy.named : copy.plain, values),
    ask: copy.ask,
  };
}
