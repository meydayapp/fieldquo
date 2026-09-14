// lib/sales/playbook/turnaround.js
//
// The turnaround question — how long a homeowner waits for a quote — and the
// one product claim the owner wants said against the answer.
//
// ══ The owner's question, 2026-09-14 ══════════════════════════════════════
//
// "Does the sales pitch ask a probing question about the amount of time it
// takes them to provide a quote to someone, from the point the client reaches
// out to when the client gets the quote?" It did not. The four scripts asked
// WHO writes the quote and WHEN (current process) and how many go out late
// (pain), and the opening question asks whether it is priced on site or back
// at the house — but nothing asked for the elapsed time, and the elapsed time
// is the number FieldQuo's quoting is built to collapse. So the question is
// now in every default playbook, and it lives here rather than in
// defaults.js because it is ONE sentence in three languages, not four.
//
// ══ Three beats, and the rule each keeps ══════════════════════════════════
//
//   discovery  The question. A leading question with the options in it
//              (Saylor's ladder — a correction is the cheapest reply), and
//              it asks for information only: no service, no cost.
//   pain       The implication, as a question whose number is THEIRS. We do
//              not bring a figure; the prospect states how often somebody
//              else's quote got there first (Futrell: attach the bottom line,
//              and get the prospect to say it).
//   fit        The contrast, and this is the one sentence that names us and
//              a figure. The figure is OURS — a product claim the owner
//              stated and answers for, not a number put in the prospect's
//              mouth — and "two" is spelled because a digit anywhere in a
//              rep's line is what every sweep in scripts/ reads as an invented
//              fact. It repeats the prospect's own options back ("an hour, a
//              couple of days, weeks") so the claim is tied to the need they
//              named, which is Rackham's strongest result via Saylor: a
//              benefit tied to a stated need meets fewer objections.
//
// ══ Why a table in three languages, like stayOnTheLine.js ════════════════
//
// The rules playbook is English and rendered verbatim; the AI script is
// written per prospect in the lead's language and its questions are about
// what the crawler could not see. The turnaround question is neither: it is
// the same question on every call and it has to be on the screen in the
// language the rep is reading the call in, whether or not an AI script was
// ever written for the row. So EN / FR / ES, rendered as-is, English as the
// fallback that says so — the same shape and the same argument as
// STAY_ON_THE_LINE. The English entry is imported by defaults.js so the four
// playbooks carry the one string rather than four copies (AGENTS.md failure
// class 4), and by scripts/check-playbook-copy.mjs so the assertion is on
// the string that is actually said.
//
// Pure. Executed by scripts/check-playbook-copy.mjs.

/** The three beats, keyed by script language. */
export const TURNAROUND = Object.freeze({
  en: Object.freeze({
    discovery:
      "When someone reaches out today, how long is it usually before they've actually got a " +
      "quote in their hands — same day, a couple of days, a week?",
    pain: "And in that time, how often do you reckon they've already had one from somebody else?",
    fit:
      "Whatever that number is for you today — an hour, a couple of days, weeks — with FieldQuo " +
      "the quote is built while you're still standing in the driveway, under two minutes from " +
      "your own price list, and they approve it from their phone.",
  }),
  fr: Object.freeze({
    discovery:
      "Aujourd'hui, quand quelqu'un vous contacte, ça prend combien de temps d'habitude avant " +
      "qu'il ait vraiment sa soumission entre les mains — la journée même, deux ou trois jours, " +
      "une semaine ?",
    pain: "Et pendant ce temps-là, d'après vous, combien de fois il en a déjà reçu une de quelqu'un d'autre ?",
    fit:
      "Peu importe ce chiffre chez vous aujourd'hui — une heure, deux ou trois jours, des " +
      "semaines — avec FieldQuo la soumission se monte pendant que vous êtes encore dans " +
      "l'entrée de cour, en moins de deux minutes à partir de votre propre liste de prix, et " +
      "le client l'approuve depuis son cellulaire.",
  }),
  es: Object.freeze({
    discovery:
      "Hoy en día, cuando alguien lo contacta, ¿cuánto tarda normalmente en tener de verdad la " +
      "cotización en la mano — el mismo día, un par de días, una semana?",
    pain: "Y en ese tiempo, ¿cuántas veces calcula que ya recibieron una de otra persona?",
    fit:
      "Sea cual sea ese número hoy para usted — una hora, un par de días, semanas — con FieldQuo " +
      "la cotización se arma mientras usted sigue parado en la entrada de la casa, en menos de " +
      "dos minutos a partir de su propia lista de precios, y el cliente la aprueba desde su celular.",
  }),
});

export const TURNAROUND_LANGUAGES = Object.freeze(Object.keys(TURNAROUND));

/** The English beats, for the four seed playbooks. One string, four uses. */
export const TURNAROUND_DISCOVERY = TURNAROUND.en.discovery;
export const TURNAROUND_PAIN = TURNAROUND.en.pain;
export const TURNAROUND_FIT = TURNAROUND.en.fit;

/**
 * The three beats in one language, or English with `fallback: true` when the
 * table has no such language — never a translated sentence nobody wrote.
 *
 * @returns {{ language, discovery, pain, fit, fallback }}
 */
export function turnaroundFor(language) {
  const code = typeof language === "string" ? language.trim().toLowerCase().slice(0, 2) : "";
  const hit = Object.hasOwn(TURNAROUND, code) ? code : "en";
  return { language: hit, ...TURNAROUND[hit], fallback: hit !== code };
}
