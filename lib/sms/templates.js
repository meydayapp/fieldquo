// lib/sms/templates.js
//
// The built-in wording of every text a CLIENT receives, in the client's
// language.
//
// ══ Why these are catalogued and not just written ═════════════════════════
//
// Every one of these used to be one English sentence with a
// `toLocaleString("en-US")` date in it, sent to every client whatever language
// their record said. The quote PDF, the covering email and the portal all
// follow Client.language (lib/i18n/clientLanguage.js) — so a Spanish-speaking
// homeowner got a Spanish quote and then "Reminder — your appointment is Tue,
// Sep 15" the day before the visit. The text is the last thing they read
// before the crew arrives; it is not the place to switch languages.
//
// The catalogue covers the same eight languages as documentLabels.js, hand-
// written in the same register, and English is the fallback for a code it
// does not know — the SAME rule the documents use, not a new one.
//
// ══ The date was wrong as well as English ═════════════════════════════════
//
// `toLocaleString` with no `timeZone` formats in the process's zone, and on
// Vercel that is UTC. A 2 PM visit in Toronto was texted as "6:00 PM". So the
// time is now formatted in the COMPANY's zone (Company.timezone) — the
// appointment is where the company is — and in the reader's locale, taken
// from documentFormatters so the map of language → locale lives in one place.
//
// Mirrors app/admin/lib/email/templates.js — one function per message type,
// plain text, kept short: past 160 characters an SMS splits into segments and
// the cost multiplies. The translations are checked against that ceiling in
// scripts/check-sms-template.mjs.
import { documentFormatters } from "@/lib/i18n/documentLabels";

/** The languages with hand-written wording. Anything else reads English. */
export const SMS_LANGUAGES = Object.freeze(["en", "fr", "es", "uk", "pa", "tl", "de", "it"]);

const pick = (language) => (SMS_LANGUAGES.includes(language) ? language : "en");

/**
 * The appointment time as the reader would write it, in the company's zone.
 *
 * Exported so the two callers that already pre-format a time (the settings
 * preview, the reminder cron) use the same shape as the built-in fallback.
 */
export function formatWhen(scheduledAt, { language = "en", timezone } = {}) {
  const d = scheduledAt instanceof Date ? scheduledAt : new Date(scheduledAt);
  if (Number.isNaN(d.getTime())) return "";
  const { locale } = documentFormatters(pick(language));
  try {
    return d.toLocaleString(locale, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      ...(timezone ? { timeZone: timezone } : {}),
    });
  } catch {
    // An invalid IANA zone throws RangeError. The company typed it; better a
    // UTC time than no reminder, and the check script keeps the map honest.
    return d.toLocaleString(locale, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }
}

// ── The wording ─────────────────────────────────────────────────────────────
//
// Each entry is a function of the values so a language can put the company
// name, the time and the place where its grammar wants them, rather than
// filling English word order with translated words.
//
// "Reply STOP to opt out" stays on the reminder in every language, because
// the inbound handler (app/api/sms/inbound/route.js) listens for the English
// keyword — carriers and Twilio treat STOP as universal, and a localised
// keyword would be one the handler does not hear.
const COPY = {
  en: {
    onMyWay: ({ company, worker, eta }) =>
      `${company}: ${worker} is on the way${eta ? `, ETA ${eta}` : ""}. Reply if you need to reschedule.`,
    reminder: ({ company, when, location }) =>
      `${company}: Reminder — your appointment is ${when}${location ? ` at ${location}` : ""}. Reply STOP to opt out.`,
    booking: ({ company, service, when }) =>
      `${company}: You're booked for ${service} on ${when}. See you then!`,
  },
  fr: {
    onMyWay: ({ company, worker, eta }) =>
      `${company} : ${worker} est en route${eta ? `, arrivée dans ${eta}` : ""}. Répondez si vous devez reporter.`,
    reminder: ({ company, when, location }) =>
      `${company} : Rappel — votre rendez-vous est ${when}${location ? ` au ${location}` : ""}. Répondez STOP pour ne plus recevoir.`,
    booking: ({ company, service, when }) =>
      `${company} : Votre rendez-vous pour ${service} est confirmé le ${when}. À bientôt!`,
  },
  es: {
    onMyWay: ({ company, worker, eta }) =>
      `${company}: ${worker} va en camino${eta ? `, llega en ${eta}` : ""}. Responda si necesita cambiar la hora.`,
    reminder: ({ company, when, location }) =>
      `${company}: Recordatorio — su cita es ${when}${location ? ` en ${location}` : ""}. Responda STOP para no recibir más.`,
    booking: ({ company, service, when }) =>
      `${company}: Su cita para ${service} quedó confirmada el ${when}. ¡Nos vemos!`,
  },
  uk: {
    onMyWay: ({ company, worker, eta }) =>
      `${company}: ${worker} вже в дорозі${eta ? `, прибуття через ${eta}` : ""}. Напишіть, якщо треба перенести.`,
    reminder: ({ company, when, location }) =>
      `${company}: Нагадування — ваш візит ${when}${location ? `, ${location}` : ""}. Відповідь STOP — щоб відписатися.`,
    booking: ({ company, service, when }) =>
      `${company}: Ваш запис на ${service} підтверджено: ${when}. До зустрічі!`,
  },
  pa: {
    onMyWay: ({ company, worker, eta }) =>
      `${company}: ${worker} ਰਾਹ ਵਿੱਚ ਹੈ${eta ? `, ${eta} ਵਿੱਚ ਪਹੁੰਚੇਗਾ` : ""}। ਸਮਾਂ ਬਦਲਣਾ ਹੋਵੇ ਤਾਂ ਜਵਾਬ ਦਿਓ।`,
    reminder: ({ company, when, location }) =>
      `${company}: ਯਾਦ-ਦਹਾਨੀ — ਤੁਹਾਡੀ ਮੁਲਾਕਾਤ ${when}${location ? `, ${location}` : ""}। ਬੰਦ ਕਰਨ ਲਈ STOP ਲਿਖੋ।`,
    booking: ({ company, service, when }) =>
      `${company}: ${service} ਲਈ ਤੁਹਾਡੀ ਬੁਕਿੰਗ ਪੱਕੀ ਹੈ: ${when}। ਮਿਲਦੇ ਹਾਂ!`,
  },
  tl: {
    onMyWay: ({ company, worker, eta }) =>
      `${company}: Papunta na si ${worker}${eta ? `, darating sa loob ng ${eta}` : ""}. Mag-reply kung kailangang ilipat ang oras.`,
    reminder: ({ company, when, location }) =>
      `${company}: Paalala — ang appointment mo ay ${when}${location ? ` sa ${location}` : ""}. Mag-reply ng STOP para huminto.`,
    booking: ({ company, service, when }) =>
      `${company}: Naka-book ka para sa ${service} sa ${when}. Kita-kits!`,
  },
  de: {
    onMyWay: ({ company, worker, eta }) =>
      `${company}: ${worker} ist unterwegs${eta ? `, Ankunft in ${eta}` : ""}. Antworten Sie, falls Sie umbuchen müssen.`,
    reminder: ({ company, when, location }) =>
      `${company}: Erinnerung — Ihr Termin ist ${when}${location ? ` in ${location}` : ""}. Antworten Sie STOP zum Abmelden.`,
    booking: ({ company, service, when }) =>
      `${company}: Ihr Termin für ${service} ist bestätigt: ${when}. Bis dann!`,
  },
  it: {
    onMyWay: ({ company, worker, eta }) =>
      `${company}: ${worker} sta arrivando${eta ? `, tra ${eta}` : ""}. Risponda se deve spostare l'appuntamento.`,
    reminder: ({ company, when, location }) =>
      `${company}: Promemoria — il suo appuntamento è ${when}${location ? ` in ${location}` : ""}. Risponda STOP per non ricevere più.`,
    booking: ({ company, service, when }) =>
      `${company}: Appuntamento per ${service} confermato: ${when}. A presto!`,
  },
};

/** The catalogue, read-only, for the check script to walk every language. */
export const SMS_COPY = Object.freeze(COPY);

export function onMyWayText({ companyName, workerName, eta, language = "en" }) {
  return COPY[pick(language)].onMyWay({ company: companyName, worker: workerName, eta });
}

/**
 * @param when         the time already formatted (the settings preview passes a
 *                     sample); otherwise it is built from scheduledAt.
 */
export function appointmentReminderText({
  companyName,
  scheduledAt,
  when,
  location,
  language = "en",
  timezone,
}) {
  const at = when || formatWhen(scheduledAt, { language, timezone });
  return COPY[pick(language)].reminder({ company: companyName, when: at, location });
}

export function bookingConfirmationText({
  companyName,
  eventTypeName,
  startTime,
  when,
  language = "en",
  timezone,
}) {
  const at = when || formatWhen(startTime, { language, timezone });
  return COPY[pick(language)].booking({ company: companyName, service: eventTypeName, when: at });
}

// ── Not wired to send ───────────────────────────────────────────────────────
//
// Nothing calls these three. They are kept in English and out of the
// catalogue on purpose: translating a message nobody sends is work that rots,
// and adding them to the catalogue would make the check script assert
// wording for a path that does not exist. When a send path is built, move
// them up.
export function quoteReadyText({ companyName, quoteUrl }) {
  return `${companyName}: Your quote is ready to view — ${quoteUrl}`;
}

export function invoiceOverdueText({ companyName, invoiceNumber, amount, payUrl }) {
  return `${companyName}: Invoice ${invoiceNumber} ($${amount}) is overdue. Pay online: ${payUrl}`;
}

export function jobCompleteText({ companyName, invoiceUrl }) {
  return `${companyName}: Your job is complete! Your invoice is ready — ${invoiceUrl}`;
}
