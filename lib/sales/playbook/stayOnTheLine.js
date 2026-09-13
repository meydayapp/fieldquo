// lib/sales/playbook/stayOnTheLine.js
//
// The step after a yes: text the link and STAY ON THE LINE.
//
// ══ The owner's process, 2026-09-13 ═══════════════════════════════════════
//
// The rep does not take a card. The contractor signs up on the self-serve
// page through the rep's texted link — company details, plan, card — and
// the card step is where a signup dies when nobody is on the phone. So the
// step is: say you are texting the link now, ask them to open it while
// you are on, and stay on the line through the card step. The rep's panel
// draws where they are (lib/sales/signupProgress.js), and the card
// objection has its answer ready ("not charged for a month; cancel from
// Settings in one click").
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
    then: "Stay on the line through the card step. If the card gives them pause: they're not charged for a month, and they can cancel from Settings in one click.",
    watch: "Your screen shows where they are — link opened, company details, plan, card — so you never have to ask.",
  }),
  fr: Object.freeze({
    say: "Je vous envoie le lien par texto tout de suite — ouvrez-le pendant qu'on est en ligne, ça prend deux minutes.",
    then: "Restez en ligne jusqu'à l'étape de la carte. Si la carte les fait hésiter : rien n'est facturé pendant un mois, et ils peuvent annuler depuis les Réglages en un clic.",
    watch: "Votre écran montre où ils en sont — lien ouvert, infos de l'entreprise, forfait, carte — vous n'avez jamais à demander.",
  }),
  es: Object.freeze({
    say: "Le mando el enlace por mensaje ahora mismo — ábralo mientras seguimos en la línea, son dos minutos.",
    then: "Quédese en la línea hasta el paso de la tarjeta. Si la tarjeta los hace dudar: no se les cobra nada durante un mes y pueden cancelar desde Configuración con un clic.",
    watch: "Su pantalla muestra en qué paso van — enlace abierto, datos de la empresa, plan, tarjeta — así nunca tiene que preguntar.",
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
