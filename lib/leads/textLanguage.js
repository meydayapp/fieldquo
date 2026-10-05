// lib/leads/textLanguage.js
//
// Which language somebody WROTE in — so a lead made from a conversation
// carries it into the quote the way a form lead carries the language its
// form was filled in (LeadRequest.language → Quote.language, fixed at
// creation: non-negotiable #6).
//
// Deliberately timid. A quote that keeps its language for life must not be
// born in the wrong one because somebody typed "merci" once, so this answers
// only when the person's own words are clearly one language — at least
// MIN_HITS distinct common words of it and at most a third as many of any
// other — and otherwise says null (the company's default stands, exactly as
// before). English, French and Spanish only: the three the help centre is
// written in and the three a short message can be told apart in by its
// commonest words; anything else is null.

import { flatten } from "@/lib/messaging/conversationSignals";

export const MIN_HITS = 3;

const WORDS = Object.freeze({
  en: ["the", "and", "you", "my", "is", "for", "with", "have", "can", "would", "like", "need", "how", "what", "please", "thanks", "want", "doors", "drawers", "kitchen"],
  fr: ["je", "vous", "les", "des", "est", "pour", "avec", "une", "mon", "ma", "mes", "bonjour", "merci", "cuisine", "portes", "tiroirs", "jai", "voudrais", "combien", "armoires"],
  es: ["yo", "usted", "los", "las", "para", "con", "una", "mi", "mis", "hola", "gracias", "cocina", "puertas", "cajones", "quiero", "cuanto", "necesito", "gabinetes", "por", "favor"],
});

/**
 * @param texts  the person's own messages (strings)
 * @returns {"en"|"fr"|"es"|null}
 */
export function languageOfText(texts = []) {
  const flat = flatten((Array.isArray(texts) ? texts : [texts]).join(" "));
  const hits = {};
  for (const [code, words] of Object.entries(WORDS)) {
    hits[code] = words.filter((w) => flat.includes(` ${w} `)).length;
  }
  const ranked = Object.entries(hits).sort((a, b) => b[1] - a[1]);
  const [best, n] = ranked[0];
  const runnerUp = ranked[1][1];
  if (n < MIN_HITS) return null;
  if (runnerUp * 3 > n) return null;
  return best;
}
