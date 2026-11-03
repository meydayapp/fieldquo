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
// ══ The document texts joined the catalogue on 2026-11-02 ═════════════════
//
// quoteReadyText sat below the catalogue for months, English-only, with
// nothing calling it. The owner asked for the quote link to go by text as
// well as email, "in the languages from the client like the emails" — so the
// wording moved up here, into all eight, and the English-only stub is gone.
// The link in them is the covering email's own url, not a second one.
//
// ══ And the two follow-up texts, the same day ═════════════════════════════
//
// The follow-up cron gained a CHANNEL (FollowUpRule.channel), so the chase
// that had only ever gone by email can now go by text. Two wordings, in all
// eight: leadFollowUpText for an enquiry nobody answered, quoteFollowUpText
// for a quote nobody answered. Neither invites a reply — see the note on
// leadFollowUpText for why that matters here more than anywhere else.
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
//
// noDot: a locale that abbreviates the meridiem ("2:00 p.m.") ends the time
// with a full stop, and the sentence's own full stop then doubles it. Used
// by the moved / cancelled texts, which end their time with one; the older
// three are left exactly as they were. Not in Punjabi: its sentence ends in
// "।", so the abbreviation's own dot ("ਬਾ.ਦੁ.") is not doubled and stays.
const noDot = (s) => String(s ?? "").replace(/\.\s*$/, "");
const COPY = {
  en: {
    onMyWay: ({ company, worker, eta, phone }) =>
      `${company}: ${worker} is on the way${eta ? `, ETA ${eta}` : ""}.${phone ? ` To reschedule, call ${phone}.` : ""}`,
    reminder: ({ company, when, location }) =>
      `${company}: Reminder — your appointment is ${when}${location ? ` at ${location}` : ""}. Reply STOP to opt out.`,
    booking: ({ company, where, when, fee }) =>
      `${company}: You're booked. ${where}, ${when}.${fee ? ` ${fee}.` : ""} Reply STOP to opt out.`,
    moved: ({ company, where, when, link, phone }) =>
      `${company}: Your appointment has moved. ${where ? `${where}, ` : ""}${noDot(when)}.${link ? ` Change or cancel: ${link}` : phone ? ` Questions? Call ${phone}.` : ""} Reply STOP to opt out.`,
    cancelled: ({ company, where, when, phone }) =>
      `${company}: Your appointment is cancelled. ${where ? `${where}, ` : ""}${noDot(when)}.${phone ? ` To rebook, call ${phone}.` : ""} Reply STOP to opt out.`,
    quote: ({ company, name, link }) =>
      `${company}:${name ? ` Hi ${name}.` : ""} Your quote is ready. View & approve it online: ${link} Reply STOP to opt out.`,
    invoice: ({ company, name, link }) =>
      `${company}:${name ? ` Hi ${name}.` : ""} Your invoice is ready. View it and pay online: ${link} Reply STOP to opt out.`,
    leadFollowUp: ({ company, name, service, video, phone }) =>
      `${company}:${name ? ` Hi ${name}.` : ""} We haven't been able to reach you about your enquiry${service ? ` (${service})` : ""}.${phone ? ` Call ${phone} to book your estimate.` : ""}${video ? ` What to expect: ${video}` : ""} Reply STOP to opt out.`,
    quoteFollowUp: ({ company, name, number, link }) =>
      `${company}:${name ? ` Hi ${name}.` : ""} Your quote${number ? ` ${number}` : ""} is still open. View & approve it online: ${link} Reply STOP to opt out.`,
  },
  fr: {
    onMyWay: ({ company, worker, eta, phone }) =>
      `${company} : ${worker} est en route${eta ? `, arrivée dans ${eta}` : ""}.${phone ? ` Pour reporter, appelez le ${phone}.` : ""}`,
    reminder: ({ company, when, location }) =>
      `${company} : Rappel — votre rendez-vous est ${when}${location ? ` au ${location}` : ""}. Répondez STOP pour ne plus recevoir.`,
    booking: ({ company, where, when, fee }) =>
      `${company} : Rendez-vous confirmé. ${where}, ${when}.${fee ? ` ${fee}.` : ""} Répondez STOP pour ne plus recevoir.`,
    moved: ({ company, where, when, link, phone }) =>
      `${company} : Votre rendez-vous a été déplacé. ${where ? `${where}, ` : ""}${noDot(when)}.${link ? ` Modifier ou annuler : ${link}` : phone ? ` Des questions ? Appelez le ${phone}.` : ""} Répondez STOP pour ne plus recevoir.`,
    cancelled: ({ company, where, when, phone }) =>
      `${company} : Votre rendez-vous est annulé. ${where ? `${where}, ` : ""}${noDot(when)}.${phone ? ` Pour reprendre rendez-vous, appelez le ${phone}.` : ""} Répondez STOP pour ne plus recevoir.`,
    quote: ({ company, name, link }) =>
      `${company} :${name ? ` Bonjour ${name}.` : ""} Votre soumission est prête. Consultez-la et approuvez-la en ligne : ${link} Répondez STOP pour ne plus recevoir.`,
    invoice: ({ company, name, link }) =>
      `${company} :${name ? ` Bonjour ${name}.` : ""} Votre facture est prête. Consultez-la et payez en ligne : ${link} Répondez STOP pour ne plus recevoir.`,
    leadFollowUp: ({ company, name, service, video, phone }) =>
      `${company} :${name ? ` Bonjour ${name}.` : ""} Nous n'avons pas réussi à vous joindre au sujet de votre demande${service ? ` (${service})` : ""}.${phone ? ` Appelez le ${phone} pour fixer votre estimation.` : ""}${video ? ` À quoi s'attendre : ${video}` : ""} Répondez STOP pour ne plus recevoir.`,
    quoteFollowUp: ({ company, name, number, link }) =>
      `${company} :${name ? ` Bonjour ${name}.` : ""} Votre soumission${number ? ` ${number}` : ""} est toujours valide. Consultez-la et approuvez-la en ligne : ${link} Répondez STOP pour ne plus recevoir.`,
  },
  es: {
    onMyWay: ({ company, worker, eta, phone }) =>
      `${company}: ${worker} va en camino${eta ? `, llega en ${eta}` : ""}.${phone ? ` Para cambiar la hora, llame al ${phone}.` : ""}`,
    reminder: ({ company, when, location }) =>
      `${company}: Recordatorio — su cita es ${when}${location ? ` en ${location}` : ""}. Responda STOP para no recibir más.`,
    booking: ({ company, where, when, fee }) =>
      `${company}: Cita confirmada. ${where}, ${when}.${fee ? ` ${fee}.` : ""} Responda STOP para no recibir más.`,
    moved: ({ company, where, when, link, phone }) =>
      `${company}: Su cita ha cambiado. ${where ? `${where}, ` : ""}${noDot(when)}.${link ? ` Cambiar o cancelar: ${link}` : phone ? ` ¿Preguntas? Llame al ${phone}.` : ""} Responda STOP para no recibir más.`,
    cancelled: ({ company, where, when, phone }) =>
      `${company}: Su cita ha sido cancelada. ${where ? `${where}, ` : ""}${noDot(when)}.${phone ? ` Para reservar de nuevo, llame al ${phone}.` : ""} Responda STOP para no recibir más.`,
    quote: ({ company, name, link }) =>
      `${company}:${name ? ` Hola ${name}.` : ""} Su presupuesto está listo. Véalo y apruébelo en línea: ${link} Responda STOP para no recibir más.`,
    invoice: ({ company, name, link }) =>
      `${company}:${name ? ` Hola ${name}.` : ""} Su factura está lista. Véala y pague en línea: ${link} Responda STOP para no recibir más.`,
    leadFollowUp: ({ company, name, service, video, phone }) =>
      `${company}:${name ? ` Hola ${name}.` : ""} No hemos logrado comunicarnos con usted sobre su solicitud${service ? ` (${service})` : ""}.${phone ? ` Llame al ${phone} para agendar su presupuesto.` : ""}${video ? ` Qué esperar: ${video}` : ""} Responda STOP para no recibir más.`,
    quoteFollowUp: ({ company, name, number, link }) =>
      `${company}:${name ? ` Hola ${name}.` : ""} Su presupuesto${number ? ` ${number}` : ""} sigue abierto. Véalo y apruébelo en línea: ${link} Responda STOP para no recibir más.`,
  },
  uk: {
    onMyWay: ({ company, worker, eta, phone }) =>
      `${company}: ${worker} вже в дорозі${eta ? `, прибуття через ${eta}` : ""}.${phone ? ` Щоб перенести, телефонуйте ${phone}.` : ""}`,
    reminder: ({ company, when, location }) =>
      `${company}: Нагадування — ваш візит ${when}${location ? `, ${location}` : ""}. Відповідь STOP — щоб відписатися.`,
    booking: ({ company, where, when, fee }) =>
      `${company}: Запис підтверджено. ${where}, ${when}.${fee ? ` ${fee}.` : ""} Відповідь STOP — щоб відписатися.`,
    moved: ({ company, where, when, link, phone }) =>
      `${company}: Ваш запис перенесено. ${where ? `${where}, ` : ""}${noDot(when)}.${link ? ` Змінити або скасувати: ${link}` : phone ? ` Питання? Телефонуйте ${phone}.` : ""} Відповідь STOP — щоб відписатися.`,
    cancelled: ({ company, where, when, phone }) =>
      `${company}: Ваш запис скасовано. ${where ? `${where}, ` : ""}${noDot(when)}.${phone ? ` Щоб записатися знову, телефонуйте ${phone}.` : ""} Відповідь STOP — щоб відписатися.`,
    quote: ({ company, name, link }) =>
      `${company}:${name ? ` Вітаємо, ${name}.` : ""} Ваш кошторис готовий. Переглянути та підтвердити онлайн: ${link} Відповідь STOP — щоб відписатися.`,
    invoice: ({ company, name, link }) =>
      `${company}:${name ? ` Вітаємо, ${name}.` : ""} Ваш рахунок готовий. Переглянути та сплатити онлайн: ${link} Відповідь STOP — щоб відписатися.`,
    leadFollowUp: ({ company, name, service, video, phone }) =>
      `${company}:${name ? ` Вітаємо, ${name}.` : ""} Нам не вдалося зв'язатися з вами щодо вашого запиту${service ? ` (${service})` : ""}.${phone ? ` Телефонуйте ${phone}, щоб записатися на оцінку.` : ""}${video ? ` Чого очікувати: ${video}` : ""} Відповідь STOP — щоб відписатися.`,
    quoteFollowUp: ({ company, name, number, link }) =>
      `${company}:${name ? ` Вітаємо, ${name}.` : ""} Ваш кошторис${number ? ` ${number}` : ""} ще чинний. Переглянути та підтвердити онлайн: ${link} Відповідь STOP — щоб відписатися.`,
  },
  pa: {
    onMyWay: ({ company, worker, eta, phone }) =>
      `${company}: ${worker} ਰਾਹ ਵਿੱਚ ਹੈ${eta ? `, ${eta} ਵਿੱਚ ਪਹੁੰਚੇਗਾ` : ""}।${phone ? ` ਸਮਾਂ ਬਦਲਣ ਲਈ ${phone} 'ਤੇ ਕਾਲ ਕਰੋ।` : ""}`,
    reminder: ({ company, when, location }) =>
      `${company}: ਯਾਦ-ਦਹਾਨੀ — ਤੁਹਾਡੀ ਮੁਲਾਕਾਤ ${when}${location ? `, ${location}` : ""}। ਬੰਦ ਕਰਨ ਲਈ STOP ਲਿਖੋ।`,
    booking: ({ company, where, when, fee }) =>
      `${company}: ਬੁਕਿੰਗ ਪੱਕੀ। ${where}, ${when}।${fee ? ` ${fee}।` : ""} ਬੰਦ ਕਰਨ ਲਈ STOP ਲਿਖੋ।`,
    moved: ({ company, where, when, link, phone }) =>
      `${company}: ਤੁਹਾਡੀ ਮੁਲਾਕਾਤ ਦਾ ਸਮਾਂ ਬਦਲ ਗਿਆ ਹੈ। ${where ? `${where}, ` : ""}${when}।${link ? ` ਬਦਲਣ ਜਾਂ ਰੱਦ ਕਰਨ ਲਈ: ${link}` : phone ? ` ਸਵਾਲ ਹੈ? ${phone} 'ਤੇ ਕਾਲ ਕਰੋ।` : ""} ਬੰਦ ਕਰਨ ਲਈ STOP ਲਿਖੋ।`,
    cancelled: ({ company, where, when, phone }) =>
      `${company}: ਤੁਹਾਡੀ ਮੁਲਾਕਾਤ ਰੱਦ ਹੋ ਗਈ ਹੈ। ${where ? `${where}, ` : ""}${when}।${phone ? ` ਦੁਬਾਰਾ ਬੁੱਕ ਕਰਨ ਲਈ ${phone} 'ਤੇ ਕਾਲ ਕਰੋ।` : ""} ਬੰਦ ਕਰਨ ਲਈ STOP ਲਿਖੋ।`,
    quote: ({ company, name, link }) =>
      `${company}:${name ? ` ਸਤ ਸ੍ਰੀ ਅਕਾਲ ${name}।` : ""} ਤੁਹਾਡਾ ਹਵਾਲਾ ਤਿਆਰ ਹੈ। ਇਸਨੂੰ ਆਨਲਾਈਨ ਵੇਖੋ ਅਤੇ ਮਨਜ਼ੂਰ ਕਰੋ: ${link} ਬੰਦ ਕਰਨ ਲਈ STOP ਲਿਖੋ।`,
    invoice: ({ company, name, link }) =>
      `${company}:${name ? ` ਸਤ ਸ੍ਰੀ ਅਕਾਲ ${name}।` : ""} ਤੁਹਾਡਾ ਬਿੱਲ ਤਿਆਰ ਹੈ। ਇਸਨੂੰ ਵੇਖੋ ਅਤੇ ਆਨਲਾਈਨ ਭੁਗਤਾਨ ਕਰੋ: ${link} ਬੰਦ ਕਰਨ ਲਈ STOP ਲਿਖੋ।`,
    leadFollowUp: ({ company, name, service, video, phone }) =>
      `${company}:${name ? ` ਸਤ ਸ੍ਰੀ ਅਕਾਲ ${name}।` : ""} ਤੁਹਾਡੀ ਪੁੱਛਗਿੱਛ${service ? ` (${service})` : ""} ਬਾਰੇ ਸਾਡਾ ਤੁਹਾਡੇ ਨਾਲ ਸੰਪਰਕ ਨਹੀਂ ਹੋ ਸਕਿਆ।${phone ? ` ਅਨੁਮਾਨ ਦਾ ਸਮਾਂ ਲੈਣ ਲਈ ${phone} 'ਤੇ ਕਾਲ ਕਰੋ।` : ""}${video ? ` ਕੀ ਉਮੀਦ ਕਰਨੀ ਹੈ: ${video}` : ""} ਬੰਦ ਕਰਨ ਲਈ STOP ਲਿਖੋ।`,
    quoteFollowUp: ({ company, name, number, link }) =>
      `${company}:${name ? ` ਸਤ ਸ੍ਰੀ ਅਕਾਲ ${name}।` : ""} ਤੁਹਾਡਾ ਹਵਾਲਾ${number ? ` ${number}` : ""} ਹਾਲੇ ਵੀ ਖੁੱਲ੍ਹਾ ਹੈ। ਇਸਨੂੰ ਆਨਲਾਈਨ ਵੇਖੋ ਅਤੇ ਮਨਜ਼ੂਰ ਕਰੋ: ${link} ਬੰਦ ਕਰਨ ਲਈ STOP ਲਿਖੋ।`,
  },
  tl: {
    onMyWay: ({ company, worker, eta, phone }) =>
      `${company}: Papunta na si ${worker}${eta ? `, darating sa loob ng ${eta}` : ""}.${phone ? ` Para ilipat ang oras, tumawag sa ${phone}.` : ""}`,
    reminder: ({ company, when, location }) =>
      `${company}: Paalala — ang appointment mo ay ${when}${location ? ` sa ${location}` : ""}. Mag-reply ng STOP para huminto.`,
    booking: ({ company, where, when, fee }) =>
      `${company}: Naka-book ka. ${where}, ${when}.${fee ? ` ${fee}.` : ""} Mag-reply ng STOP para huminto.`,
    moved: ({ company, where, when, link, phone }) =>
      `${company}: Nailipat ang appointment mo. ${where ? `${where}, ` : ""}${noDot(when)}.${link ? ` Baguhin o kanselahin: ${link}` : phone ? ` May tanong? Tumawag sa ${phone}.` : ""} Mag-reply ng STOP para huminto.`,
    cancelled: ({ company, where, when, phone }) =>
      `${company}: Kinansela ang appointment mo. ${where ? `${where}, ` : ""}${noDot(when)}.${phone ? ` Para mag-book ulit, tumawag sa ${phone}.` : ""} Mag-reply ng STOP para huminto.`,
    quote: ({ company, name, link }) =>
      `${company}:${name ? ` Kumusta ${name}.` : ""} Ready na ang quote mo. Tingnan at aprubahan online: ${link} Mag-reply ng STOP para huminto.`,
    invoice: ({ company, name, link }) =>
      `${company}:${name ? ` Kumusta ${name}.` : ""} Ready na ang invoice mo. Tingnan at magbayad online: ${link} Mag-reply ng STOP para huminto.`,
    leadFollowUp: ({ company, name, service, video, phone }) =>
      `${company}:${name ? ` Kumusta ${name}.` : ""} Hindi namin kayo maabot tungkol sa inyong tanong${service ? ` (${service})` : ""}.${phone ? ` Tumawag sa ${phone} para maka-book ng estimate.` : ""}${video ? ` Ano ang aasahan: ${video}` : ""} Mag-reply ng STOP para huminto.`,
    quoteFollowUp: ({ company, name, number, link }) =>
      `${company}:${name ? ` Kumusta ${name}.` : ""} Bukas pa ang quote mo${number ? ` (${number})` : ""}. Tingnan at aprubahan online: ${link} Mag-reply ng STOP para huminto.`,
  },
  de: {
    onMyWay: ({ company, worker, eta, phone }) =>
      `${company}: ${worker} ist unterwegs${eta ? `, Ankunft in ${eta}` : ""}.${phone ? ` Zum Umbuchen rufen Sie ${phone} an.` : ""}`,
    reminder: ({ company, when, location }) =>
      `${company}: Erinnerung — Ihr Termin ist ${when}${location ? ` in ${location}` : ""}. Antworten Sie STOP zum Abmelden.`,
    booking: ({ company, where, when, fee }) =>
      `${company}: Termin bestätigt. ${where}, ${when}.${fee ? ` ${fee}.` : ""} Antworten Sie STOP zum Abmelden.`,
    moved: ({ company, where, when, link, phone }) =>
      `${company}: Ihr Termin wurde verschoben. ${where ? `${where}, ` : ""}${noDot(when)}.${link ? ` Ändern oder absagen: ${link}` : phone ? ` Fragen? Rufen Sie ${phone} an.` : ""} Antworten Sie STOP zum Abmelden.`,
    cancelled: ({ company, where, when, phone }) =>
      `${company}: Ihr Termin wurde abgesagt. ${where ? `${where}, ` : ""}${noDot(when)}.${phone ? ` Für einen neuen Termin rufen Sie ${phone} an.` : ""} Antworten Sie STOP zum Abmelden.`,
    quote: ({ company, name, link }) =>
      `${company}:${name ? ` Hallo ${name}.` : ""} Ihr Angebot ist fertig. Online ansehen und annehmen: ${link} Antworten Sie STOP zum Abmelden.`,
    invoice: ({ company, name, link }) =>
      `${company}:${name ? ` Hallo ${name}.` : ""} Ihre Rechnung ist fertig. Online ansehen und bezahlen: ${link} Antworten Sie STOP zum Abmelden.`,
    leadFollowUp: ({ company, name, service, video, phone }) =>
      `${company}:${name ? ` Hallo ${name}.` : ""} Wir haben Sie zu Ihrer Anfrage${service ? ` (${service})` : ""} nicht erreichen können.${phone ? ` Rufen Sie ${phone} an, um einen Termin zu vereinbaren.` : ""}${video ? ` Was Sie erwartet: ${video}` : ""} Antworten Sie STOP zum Abmelden.`,
    quoteFollowUp: ({ company, name, number, link }) =>
      `${company}:${name ? ` Hallo ${name}.` : ""} Ihr Angebot${number ? ` ${number}` : ""} ist noch offen. Online ansehen und annehmen: ${link} Antworten Sie STOP zum Abmelden.`,
  },
  it: {
    onMyWay: ({ company, worker, eta, phone }) =>
      `${company}: ${worker} sta arrivando${eta ? `, tra ${eta}` : ""}.${phone ? ` Per spostare l'appuntamento, chiami il ${phone}.` : ""}`,
    reminder: ({ company, when, location }) =>
      `${company}: Promemoria — il suo appuntamento è ${when}${location ? ` in ${location}` : ""}. Risponda STOP per non ricevere più.`,
    booking: ({ company, where, when, fee }) =>
      `${company}: Appuntamento confermato. ${where}, ${when}.${fee ? ` ${fee}.` : ""} Risponda STOP per non ricevere più.`,
    moved: ({ company, where, when, link, phone }) =>
      `${company}: Il suo appuntamento è stato spostato. ${where ? `${where}, ` : ""}${noDot(when)}.${link ? ` Per modificarlo o annullarlo: ${link}` : phone ? ` Domande? Chiami il ${phone}.` : ""} Risponda STOP per non ricevere più.`,
    cancelled: ({ company, where, when, phone }) =>
      `${company}: Il suo appuntamento è stato annullato. ${where ? `${where}, ` : ""}${noDot(when)}.${phone ? ` Per fissarne un altro, chiami il ${phone}.` : ""} Risponda STOP per non ricevere più.`,
    quote: ({ company, name, link }) =>
      `${company}:${name ? ` Salve ${name}.` : ""} Il suo preventivo è pronto. Lo visualizzi e lo approvi online: ${link} Risponda STOP per non ricevere più.`,
    invoice: ({ company, name, link }) =>
      `${company}:${name ? ` Salve ${name}.` : ""} La sua fattura è pronta. La visualizzi e la paghi online: ${link} Risponda STOP per non ricevere più.`,
    leadFollowUp: ({ company, name, service, video, phone }) =>
      `${company}:${name ? ` Salve ${name}.` : ""} Non siamo riusciti a contattarla per la sua richiesta${service ? ` (${service})` : ""}.${phone ? ` Chiami il ${phone} per fissare il preventivo.` : ""}${video ? ` Cosa aspettarsi: ${video}` : ""} Risponda STOP per non ricevere più.`,
    quoteFollowUp: ({ company, name, number, link }) =>
      `${company}:${name ? ` Salve ${name}.` : ""} Il suo preventivo${number ? ` ${number}` : ""} è ancora valido. Lo visualizzi e lo approvi online: ${link} Risponda STOP per non ricevere più.`,
  },
};

/** The catalogue, read-only, for the check script to walk every language. */
export const SMS_COPY = Object.freeze(COPY);

/**
 * ── Why the tail names a phone number and not "reply" ────────────────────
 *
 * This ended "Reply if you need to reschedule" in every language, and no
 * reply is ever read: app/api/sms/inbound listens for STOP/START keywords and
 * acknowledges everything else with an empty 200. A homeowner who replied
 * "can we do 3 instead?" was talking to nobody. The sentence now points at
 * the company's phone — a person who will answer — and is dropped entirely
 * when the company has none on file, rather than inventing a channel.
 * (A job visit has no self-serve link to point at: manage tokens belong to
 * bookings made through the booking page, not to crew visits on a job.)
 */
export function onMyWayText({ companyName, workerName, eta, phone, language = "en" }) {
  return COPY[pick(language)].onMyWay({ company: companyName, worker: workerName, eta, phone });
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

/**
 * The text a client gets the moment they book, when the company has switched
 * it on (Company.bookingSmsConfirmation) and they gave a phone.
 *
 * @param where  what was booked and where, in the reader's language — the
 *               same line the letter carries, from lib/booking/bookingModes.js
 *               bookingModeLine(): "On-site visit at 12 Elm St", "Phone call —
 *               we'll ring 819-238-7263". The service name deliberately isn't
 *               in the built-in wording: "Consultation with Daniel" told the
 *               owner nothing about which kind, and the segment budget is
 *               better spent on the line that does. It stays available as a
 *               token for a company that wants it.
 */
export function bookingConfirmationText({
  companyName,
  where,
  startTime,
  when,
  // "$49 paid" / "No charge" (lib/booking/bookingModes.js bookingFeeLine);
  // omitted, the sentence is dropped rather than left as a hole.
  fee = null,
  language = "en",
  timezone,
}) {
  const at = when || formatWhen(startTime, { language, timezone });
  return COPY[pick(language)].booking({ company: companyName, where, when: at, fee: fee || null });
}

/**
 * The text a client gets when their appointment or visit is MOVED — by the
 * office (EntryActions → the appointment or job-visit PATCH) or by the
 * client through their own manage link. Sent through lib/schedule/
 * changeText.js behind the same switch, phone and opt-out gates as the
 * confirmation.
 *
 * @param where  the same mode line the confirmation carries, or null for a
 *               row with no booking and no address — the clause is dropped
 *               rather than padded with an invented "address to be
 *               confirmed" (a hand-booked appointment with no location said
 *               nothing about one).
 * @param link   the client's manage link, only when the row has one (a
 *               booking made on the booking page). Without it the tail
 *               points at the company's phone, and without that it is
 *               dropped: replies to these texts are never read (see
 *               onMyWayText), so "reply to change" would be a dead channel.
 */
export function bookingMovedText({ companyName, where = null, startTime, when, link = null, phone = null, language = "en", timezone }) {
  const at = when || formatWhen(startTime, { language, timezone });
  return COPY[pick(language)].moved({ company: companyName, where: where || null, when: at, link: link || null, phone: phone || null });
}

/**
 * The text a client gets when their appointment or visit is CANCELLED. `when`
 * is the time that was called off, so the client can tell which one. No
 * refund sentence: whether a fee comes back is decided on the payment and
 * said in the letter, where there is room to say it honestly.
 */
export function bookingCancelledText({ companyName, where = null, startTime, when, phone = null, language = "en", timezone }) {
  const at = when || formatWhen(startTime, { language, timezone });
  return COPY[pick(language)].cancelled({ company: companyName, where: where || null, when: at, phone: phone || null });
}

/**
 * The text that carries the QUOTE's own link — sent beside the covering
 * email by app/api/quotes/[id]/send (through lib/sms/documentText.js) when
 * the client gave a phone.
 *
 * The owner, 2026-11-02: "send right now it sends only an email but it should
 * also send the quote link via text... something short, like Hi __, here is
 * your free quote from ... you can open it via the link... review and approve
 * online... in the languages from the client like the emails."
 *
 * "Free" is deliberately NOT in the built-in wording: whether an estimate is
 * free is the company's claim to make, not FieldQuo's to assert on their
 * behalf, and a flooring installer who charges for measuring would be made to
 * promise otherwise. It is one edit away on Settings › Messages, where the
 * {name}, {number} and {link} tokens are offered.
 *
 * `link` is the SAME url the covering email's button carries — /q/<token>,
 * the page that takes the approval. A second link to the same document is a
 * second thing to keep working.
 *
 * @param name  the client's first name, or null — the greeting is dropped
 *              rather than left as "Hi ." for a client filed under a company
 *              name with no person on it.
 */
export function quoteLinkText({ companyName, name = null, quoteUrl, language = "en" }) {
  return COPY[pick(language)].quote({ company: companyName, name: name || null, link: quoteUrl });
}

/**
 * The same for an INVOICE — "the invoice should be the same" (owner, same
 * message). `invoiceUrl` is the email's own deep link, stage query and all,
 * so the Pay button asks for the figure the email asked for.
 *
 * No amount in the built-in wording. A text goes to a phone that may be
 * read by somebody else, or kept after the number changes hands, and the
 * figure is one tap away behind the link; {amount} is available as a token
 * for a company that decides otherwise.
 */
export function invoiceLinkText({ companyName, name = null, invoiceUrl, language = "en" }) {
  return COPY[pick(language)].invoice({ company: companyName, name: name || null, link: invoiceUrl });
}

/**
 * The text that chases an ENQUIRY nobody has answered — the lead_no_response
 * trigger, sent by app/api/cron/follow-ups through lib/sms/followUpText.js
 * when the rule's channel is "sms" and the company switched follow-up texts on.
 *
 * ── What it does NOT say ─────────────────────────────────────────────────
 *
 * It does not invite a reply. app/api/sms/inbound is not a client inbox —
 * it reads STOP and START and acknowledges everything else with an empty 200
 * — so "reply and we'll book you in" would be a homeowner talking to nobody,
 * the exact defect onMyWayText's own comment records. The tail points at the
 * company's phone, and is dropped when the company has none on file rather
 * than inventing a channel.
 *
 * It does not promise a price, a date or a free estimate. Whether measuring
 * is free is the company's claim to make — the same reasoning quoteLinkText
 * gives for leaving "free" out — and all four are one edit away on
 * Settings › Messages.
 *
 * @param service  what the homeowner asked about (the lead's category label),
 *                 or null. Parenthetical so the sentence reads in both
 *                 shapes: a lead that came in through a form with no service
 *                 picked has nothing to name, and padding it with an invented
 *                 "your project" would be this file deciding what they want.
 * @param video    the company's pre-quote video (Company.preQuoteVideoUrl),
 *                 or null — the sentence is absent when there is no video,
 *                 never a "video coming soon".
 */
export function leadFollowUpText({ companyName, name = null, service = null, video = null, phone = null, language = "en" }) {
  return COPY[pick(language)].leadFollowUp({
    company: companyName,
    name: name || null,
    service: service || null,
    video: video || null,
    phone: phone || null,
  });
}

/**
 * The same for a QUOTE nobody has answered — the quote_no_response trigger.
 *
 * `link` is the quote's own /q/<token> page, the one the covering email's
 * button carries and the one that takes the approval. Not a second link: one
 * per document, or there are two things to keep working.
 *
 * No amount, for the reason invoiceLinkText gives — a phone is read by
 * whoever holds it — and no "last chance" or expiry claim: the quote's
 * validUntil is on the quote, and a text asserting a deadline the document
 * does not carry is a text the company would have to honour.
 */
export function quoteFollowUpText({ companyName, name = null, number = null, quoteUrl, language = "en" }) {
  return COPY[pick(language)].quoteFollowUp({
    company: companyName,
    name: name || null,
    number: number || null,
    link: quoteUrl,
  });
}

// ── Not wired to send ───────────────────────────────────────────────────────
//
// Nothing calls these two. They are kept in English and out of the
// catalogue on purpose: translating a message nobody sends is work that rots,
// and adding them to the catalogue would make the check script assert
// wording for a path that does not exist. When a send path is built, move
// them up — as quoteReadyText was on 2026-11-02, becoming quoteLinkText
// above when the quote send grew a text.
export function invoiceOverdueText({ companyName, invoiceNumber, amount, payUrl }) {
  return `${companyName}: Invoice ${invoiceNumber} ($${amount}) is overdue. Pay online: ${payUrl}`;
}

export function jobCompleteText({ companyName, invoiceUrl }) {
  return `${companyName}: Your job is complete! Your invoice is ready — ${invoiceUrl}`;
}
