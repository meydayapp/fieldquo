// lib/sales/outreach/introLinkCopy.js
//
// The words on the public page behind the intro email's links — in the
// language the EMAIL was sent in (SalesIntroEmail.language), never the
// browser's: the person opened a French email and lands on a French page.
//
// Pure, no imports. Three languages, the same keys each, and
// scripts/check-sales-intro-email.mjs asserts the key sets are identical
// and no French or Spanish value is an English sentence.

export const INTRO_LINK_COPY = Object.freeze({
  en: Object.freeze({
    title: { callback: "Call me back", demo: "Book a 15-minute demo", unsubscribe: "Unsubscribe" },
    ask: {
      callback: "Ask {rep} to call {business} back?",
      demo: "Ask {rep} for a 15-minute demo for {business}?",
      unsubscribe: "Stop receiving emails from {rep} at FieldQuo?",
    },
    button: { callback: "Yes, call me back", demo: "Yes, book a demo", unsubscribe: "Unsubscribe" },
    done: {
      callback: "{rep} will call you back — reply to the email if a different time suits.",
      demo: "{rep} will call to fix a time for your demo — reply to the email if a different time suits.",
      unsubscribe: "Done. You won't receive further emails from us at this address.",
    },
    already: {
      callback: "You've already asked — {rep} will call you back. Reply to the email if a different time suits.",
      demo: "You've already asked — {rep} will call to fix a time. Reply to the email if a different time suits.",
      unsubscribe: "This address is already unsubscribed.",
    },
    repPhone: "Or ring {rep} directly: {phone}",
    invalid: "This link isn't valid.",
    expired: "This link has expired. Reply to the email instead and we'll pick it up.",
    failed: "That didn't go through. Please try again, or reply to the email.",
    working: "One moment…",
  }),
  fr: Object.freeze({
    title: { callback: "Rappelez-moi", demo: "Réserver une démo de 15 minutes", unsubscribe: "Se désabonner" },
    ask: {
      callback: "Demander à {rep} de rappeler {business} ?",
      demo: "Demander à {rep} une démo de 15 minutes pour {business} ?",
      unsubscribe: "Ne plus recevoir de courriels de {rep} chez FieldQuo ?",
    },
    button: { callback: "Oui, rappelez-moi", demo: "Oui, réserver une démo", unsubscribe: "Se désabonner" },
    done: {
      callback: "{rep} vous rappellera — répondez au courriel si un autre moment vous convient mieux.",
      demo: "{rep} vous appellera pour fixer l'heure de votre démo — répondez au courriel si un autre moment vous convient mieux.",
      unsubscribe: "C'est fait. Vous ne recevrez plus de courriels de notre part à cette adresse.",
    },
    already: {
      callback: "Vous l'avez déjà demandé — {rep} vous rappellera. Répondez au courriel si un autre moment vous convient mieux.",
      demo: "Vous l'avez déjà demandé — {rep} vous appellera pour fixer l'heure. Répondez au courriel si un autre moment vous convient mieux.",
      unsubscribe: "Cette adresse est déjà désabonnée.",
    },
    repPhone: "Ou appelez {rep} directement : {phone}",
    invalid: "Ce lien n'est pas valide.",
    expired: "Ce lien a expiré. Répondez plutôt au courriel et nous prendrons le relais.",
    failed: "Ça n'a pas fonctionné. Réessayez, ou répondez au courriel.",
    working: "Un instant…",
  }),
  es: Object.freeze({
    title: { callback: "Llámenme", demo: "Reservar una demo de 15 minutos", unsubscribe: "Cancelar suscripción" },
    ask: {
      callback: "¿Pedir que {rep} llame a {business}?",
      demo: "¿Pedir a {rep} una demo de 15 minutos para {business}?",
      unsubscribe: "¿Dejar de recibir correos de {rep} en FieldQuo?",
    },
    button: { callback: "Sí, llámenme", demo: "Sí, reservar una demo", unsubscribe: "Cancelar suscripción" },
    done: {
      callback: "{rep} le devolverá la llamada — responda al correo si le conviene otra hora.",
      demo: "{rep} le llamará para fijar la hora de su demo — responda al correo si le conviene otra hora.",
      unsubscribe: "Listo. No recibirá más correos nuestros en esta dirección.",
    },
    already: {
      callback: "Ya lo pidió — {rep} le devolverá la llamada. Responda al correo si le conviene otra hora.",
      demo: "Ya lo pidió — {rep} le llamará para fijar la hora. Responda al correo si le conviene otra hora.",
      unsubscribe: "Esta dirección ya está dada de baja.",
    },
    repPhone: "O llame a {rep} directamente: {phone}",
    invalid: "Este enlace no es válido.",
    expired: "Este enlace ha caducado. Responda al correo y lo retomamos desde ahí.",
    failed: "No se pudo completar. Inténtelo de nuevo o responda al correo.",
    working: "Un momento…",
  }),
});

/** The copy for a language; English for anything the table lacks. */
export function introLinkCopy(language) {
  return INTRO_LINK_COPY[language] || INTRO_LINK_COPY.en;
}

/** `{rep}`, `{business}`, `{phone}` filled. */
export function fillIntroCopy(template, values = {}) {
  let out = String(template ?? "");
  for (const [k, v] of Object.entries(values)) out = out.split(`{${k}}`).join(String(v ?? ""));
  return out;
}
