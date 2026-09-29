// lib/sales/playbook/stayOnTheLine.js
//
// The step after a yes: text the link and STAY ON THE LINE.
//
// ══ The owner's process, 2026-09-13 ═══════════════════════════════════════
//
// The rep does not take a card, and since 2026-09-24 neither does signup
// (TRIAL_CARD_REQUIRED = false): the contractor signs up on the self-serve
// page through the rep's texted link — company details, trades, services —
// and lands in FieldQuo on its free days, choosing a plan later from inside
// the app. A signup still dies halfway when nobody is on the phone. So the
// step is: say you are texting the link now, ask them to open it while you
// are on, and stay on the line until they are in. The rep's panel draws
// where they are (lib/sales/signupProgress.js), and "do I need a card?" has
// its answer ready: no.
//
// ══ Why a fixed table and not a generated line ════════════════════════════
//
// Everything else a rep reads on the call is either the English tier
// playbook (lib/sales/playbook/defaults.js) or the AI script, which is
// written per prospect in the lead's language (lib/sales/intel/callScript.js).
// This step is neither: it is the same three sentences on every call, and
// it must exist in the lead's language even when no AI script has been
// generated for the row — a rep who just got a yes cannot wait for one.
// So it is a table, one entry per script language (EN / FR / ES — the
// three lib/sales/intel/callScript.js SCRIPT_LANGUAGES), rendered as-is.
// English is the fallback for a language the table does not have, and the
// return says so (`fallback: true`) rather than passing English off as
// French.
//
// Pure. Executed by scripts/check-sales-call-playbook.mjs.

/** The lines, keyed by script language. `say` is what the rep says; `then` what they do. */
export const STAY_ON_THE_LINE = Object.freeze({
  en: Object.freeze({
    say: "I'm texting you the link now — open it while we're on, it's two minutes.",
    then: "Stay on the line until they are in. If they ask about a card: there isn't one — signup takes no card, the first fourteen days are free, and they choose a plan from inside the app only if they keep going.",
    watch: "Your screen shows where they are — link opened, company details — so you never have to ask.",
  }),
  fr: Object.freeze({
    say: "Je vous envoie le lien par texto tout de suite — ouvrez-le pendant qu'on est en ligne, ça prend deux minutes.",
    then: "Restez en ligne jusqu'à ce qu'ils soient entrés. S'ils posent la question de la carte : il n'y en a pas — l'inscription ne demande aucune carte, les quatorze premiers jours sont gratuits, et ils choisissent un forfait depuis l'application seulement s'ils continuent.",
    watch: "Votre écran montre où ils en sont — lien ouvert, infos de l'entreprise — vous n'avez jamais à demander.",
  }),
  es: Object.freeze({
    say: "Le mando el enlace por mensaje ahora mismo — ábralo mientras seguimos en la línea, son dos minutos.",
    then: "Quédese en la línea hasta que estén dentro. Si preguntan por la tarjeta: no hace falta — el registro no pide tarjeta, los primeros catorce días son gratis, y eligen un plan desde la aplicación solo si siguen adelante.",
    watch: "Su pantalla muestra en qué paso van — enlace abierto, datos de la empresa — así nunca tiene que preguntar.",
  }),
});

export const STAY_ON_THE_LINE_LANGUAGES = Object.freeze(Object.keys(STAY_ON_THE_LINE));

/**
 * The step in one language, or English with `fallback: true` when the
 * table has no such language.
 *
 * @returns {{ language, say, then, watch, fallback }}
 */
export function stayOnTheLineFor(language) {
  const code = typeof language === "string" ? language.trim().toLowerCase().slice(0, 2) : "";
  const hit = Object.hasOwn(STAY_ON_THE_LINE, code) ? code : "en";
  return { language: hit, ...STAY_ON_THE_LINE[hit], fallback: hit !== code };
}
