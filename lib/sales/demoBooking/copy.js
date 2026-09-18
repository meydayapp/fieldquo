// lib/sales/demoBooking/copy.js
//
// The words on a rep's public demo page (app/demo/[repCode]) and in the
// confirmation the prospect receives — in the language the INTRO EMAIL was
// sent in when they arrived from one (SalesIntroEmail.language), otherwise
// the page's own `?lang=`, otherwise English. The browser's language is
// never consulted: the person opened a French email and lands on a French
// page, the same rule lib/sales/outreach/introLinkCopy.js applies.
//
// Pure, no imports. Three languages, identical key sets —
// scripts/check-rep-demo-page.mjs holds them to it.

export const REP_DEMO_COPY = Object.freeze({
  en: Object.freeze({
    title: "Book a 15-minute demo with {rep}",
    intro: "Pick a time that suits you. {rep} will call and show you how FieldQuo works for a business like yours.",
    noSlots: "{rep} has no open times in the next two weeks. Reply to the email and they'll find one.",
    zoneNote: "Times are shown in your time zone ({zone}).",
    pickDay: "Day",
    pickTime: "Time",
    yourDetails: "Your details",
    name: "Your name",
    email: "Email",
    phone: "Phone",
    business: "Business",
    confirm: "Confirm {when}",
    working: "Booking…",
    done: "Booked. {rep} will call you on {when}. A calendar invite is on its way to {email}.",
    alreadyBooked: "You've already booked a demo with {rep} for {when}. Reply to the email if you need to move it.",
    taken: "That time was just taken — pick another.",
    past: "That time has passed — pick another.",
    invalid: "This link isn't valid.",
    expired: "This link has expired. Reply to the email instead and we'll pick it up.",
    unknownRep: "There's nobody by that name here.",
    failed: "That didn't go through. Please try again, or reply to the email.",
    needName: "Enter your name.",
    needEmail: "Enter a valid email address.",
    needSlot: "Pick a time first.",
    email_subject: "Your FieldQuo demo — {when}",
    email_greeting: "Hi {name},",
    email_body: "Your 15-minute FieldQuo demo with {rep} is booked for {when}. {rep} will call {phone}. The calendar invite is attached so it lands in your diary.",
    email_body_nophone: "Your 15-minute FieldQuo demo with {rep} is booked for {when}. The calendar invite is attached so it lands in your diary.",
    email_change: "If the time stops suiting you, reply to this email and we'll move it.",
    ics_summary: "FieldQuo demo — {business}",
    ics_description: "15-minute FieldQuo demo with {rep}.",
  }),
  fr: Object.freeze({
    title: "Réserver une démo de 15 minutes avec {rep}",
    intro: "Choisissez un moment qui vous convient. {rep} vous appellera pour vous montrer comment FieldQuo fonctionne pour une entreprise comme la vôtre.",
    noSlots: "{rep} n'a aucune disponibilité dans les deux prochaines semaines. Répondez au courriel et un moment sera trouvé.",
    zoneNote: "Les heures sont affichées dans votre fuseau horaire ({zone}).",
    pickDay: "Jour",
    pickTime: "Heure",
    yourDetails: "Vos coordonnées",
    name: "Votre nom",
    email: "Courriel",
    phone: "Téléphone",
    business: "Entreprise",
    confirm: "Confirmer {when}",
    working: "Réservation…",
    done: "Réservé. {rep} vous appellera le {when}. Une invitation au calendrier est en route vers {email}.",
    alreadyBooked: "Vous avez déjà réservé une démo avec {rep} pour le {when}. Répondez au courriel s'il faut la déplacer.",
    taken: "Ce moment vient d'être pris — choisissez-en un autre.",
    past: "Ce moment est passé — choisissez-en un autre.",
    invalid: "Ce lien n'est pas valide.",
    expired: "Ce lien a expiré. Répondez plutôt au courriel et nous prendrons le relais.",
    unknownRep: "Personne de ce nom ici.",
    failed: "Ça n'a pas fonctionné. Réessayez, ou répondez au courriel.",
    needName: "Entrez votre nom.",
    needEmail: "Entrez une adresse courriel valide.",
    needSlot: "Choisissez d'abord un moment.",
    email_subject: "Votre démo FieldQuo — {when}",
    email_greeting: "Bonjour {name},",
    email_body: "Votre démo FieldQuo de 15 minutes avec {rep} est réservée pour le {when}. {rep} appellera au {phone}. L'invitation au calendrier est jointe pour qu'elle s'inscrive dans votre agenda.",
    email_body_nophone: "Votre démo FieldQuo de 15 minutes avec {rep} est réservée pour le {when}. L'invitation au calendrier est jointe pour qu'elle s'inscrive dans votre agenda.",
    email_change: "Si l'heure ne vous convient plus, répondez à ce courriel et nous la déplacerons.",
    ics_summary: "Démo FieldQuo — {business}",
    ics_description: "Démo FieldQuo de 15 minutes avec {rep}.",
  }),
  es: Object.freeze({
    title: "Reservar una demo de 15 minutos con {rep}",
    intro: "Elija una hora que le convenga. {rep} le llamará para mostrarle cómo funciona FieldQuo para un negocio como el suyo.",
    noSlots: "{rep} no tiene horas libres en las próximas dos semanas. Responda al correo y buscará una.",
    zoneNote: "Las horas se muestran en su zona horaria ({zone}).",
    pickDay: "Día",
    pickTime: "Hora",
    yourDetails: "Sus datos",
    name: "Su nombre",
    email: "Correo",
    phone: "Teléfono",
    business: "Negocio",
    confirm: "Confirmar {when}",
    working: "Reservando…",
    done: "Reservado. {rep} le llamará el {when}. La invitación al calendario va en camino a {email}.",
    alreadyBooked: "Ya reservó una demo con {rep} para el {when}. Responda al correo si necesita moverla.",
    taken: "Esa hora acaba de ocuparse; elija otra.",
    past: "Esa hora ya pasó; elija otra.",
    invalid: "Este enlace no es válido.",
    expired: "Este enlace ha caducado. Responda al correo y lo retomamos desde ahí.",
    unknownRep: "No hay nadie con ese nombre aquí.",
    failed: "No se pudo completar. Inténtelo de nuevo o responda al correo.",
    needName: "Escriba su nombre.",
    needEmail: "Escriba un correo válido.",
    needSlot: "Elija primero una hora.",
    email_subject: "Su demo de FieldQuo — {when}",
    email_greeting: "Hola {name},",
    email_body: "Su demo de FieldQuo de 15 minutos con {rep} queda reservada para el {when}. {rep} llamará al {phone}. Va adjunta la invitación al calendario para que quede en su agenda.",
    email_body_nophone: "Su demo de FieldQuo de 15 minutos con {rep} queda reservada para el {when}. Va adjunta la invitación al calendario para que quede en su agenda.",
    email_change: "Si la hora deja de convenirle, responda a este correo y la movemos.",
    ics_summary: "Demo de FieldQuo — {business}",
    ics_description: "Demo de FieldQuo de 15 minutos con {rep}.",
  }),
});

export const REP_DEMO_LANGUAGES = Object.freeze(Object.keys(REP_DEMO_COPY));

/** The copy for a language; English for anything the table lacks. */
export function repDemoCopy(language) {
  return REP_DEMO_COPY[language] || REP_DEMO_COPY.en;
}

/** A language the page speaks, or null. */
export function repDemoLanguage(value) {
  const v = String(value || "").trim().toLowerCase().slice(0, 2);
  return REP_DEMO_LANGUAGES.includes(v) ? v : null;
}

/** `{rep}`, `{when}`, … filled. */
export function fillDemoCopy(template, values = {}) {
  let out = String(template ?? "");
  for (const [k, v] of Object.entries(values)) out = out.split(`{${k}}`).join(String(v ?? ""));
  return out;
}

const LOCALE = { en: "en-CA", fr: "fr-CA", es: "es" };

/** "Tuesday, 22 September at 10:15 a.m. EDT", in the language, in a zone. */
export function whenLabel(startAt, { language = "en", timeZone } = {}) {
  const at = startAt instanceof Date ? startAt : new Date(startAt);
  try {
    return new Intl.DateTimeFormat(LOCALE[language] || LOCALE.en, {
      timeZone: timeZone || undefined,
      weekday: "long",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(at);
  } catch {
    return at.toUTCString();
  }
}
