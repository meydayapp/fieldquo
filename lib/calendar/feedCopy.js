// lib/calendar/feedCopy.js
//
// The handful of words the subscribe feed prints, in the nine languages the
// app speaks.
//
// ── Why not the app catalogue ──────────────────────────────────────────────
//
// app/i18n/appMessages.js is read through useTranslation with a session's
// language. The feed has no session: a phone polls a token URL, and the
// only language on hand is the COMPANY's default (Company.defaultLanguage).
// That is also the right one — a subscribed calendar is read by whoever
// holds the phone, and the company's language is the one its staff share.
// Member.invitationLanguage would be a guess about one person's phone
// settings from the language their invite email was sent in.
//
// A dozen words, in a table of their own, exported so
// scripts/check-calendar-feed.mjs can assert every language carries every
// key. Adding a key here without adding it to all nine fails that check.
//
// Not here: the mode words. "On-site visit" / "Phone call" / "Video call"
// are lib/booking/bookingModes.js's, read through bookingModeLabel so the
// phone's calendar says what the confirmation letter said. phoneCall and
// videoCall below are the LOCATION line's ("Phone call" with no number for
// a member who may not see one), which is a different sentence.

export const FEED_COPY = Object.freeze({
  en: {
    mySchedule: "my schedule",
    appointment: "Appointment",
    jobVisit: "Job visit",
    phoneCall: "Phone call",
    videoCall: "Video call",
    cancelled: "Cancelled",
    phone: "Phone",
    openInFieldQuo: "Open in FieldQuo",
    durationNotSet: "Duration not set — shown as one hour.",
  },
  fr: {
    mySchedule: "mon horaire",
    appointment: "Rendez-vous",
    jobVisit: "Visite de chantier",
    phoneCall: "Appel téléphonique",
    videoCall: "Appel vidéo",
    cancelled: "Annulé",
    phone: "Téléphone",
    openInFieldQuo: "Ouvrir dans FieldQuo",
    durationNotSet: "Durée non définie — affichée comme une heure.",
  },
  es: {
    mySchedule: "mi agenda",
    appointment: "Cita",
    jobVisit: "Visita de trabajo",
    phoneCall: "Llamada telefónica",
    videoCall: "Videollamada",
    cancelled: "Cancelada",
    phone: "Teléfono",
    openInFieldQuo: "Abrir en FieldQuo",
    durationNotSet: "Duración no definida — se muestra como una hora.",
  },
  uk: {
    mySchedule: "мій розклад",
    appointment: "Зустріч",
    jobVisit: "Робочий візит",
    phoneCall: "Телефонний дзвінок",
    videoCall: "Відеодзвінок",
    cancelled: "Скасовано",
    phone: "Телефон",
    openInFieldQuo: "Відкрити у FieldQuo",
    durationNotSet: "Тривалість не вказана — показано як одну годину.",
  },
  pa: {
    mySchedule: "ਮੇਰਾ ਸ਼ਡਿਊਲ",
    appointment: "ਮੁਲਾਕਾਤ",
    jobVisit: "ਕੰਮ ਦਾ ਦੌਰਾ",
    phoneCall: "ਫ਼ੋਨ ਕਾਲ",
    videoCall: "ਵੀਡੀਓ ਕਾਲ",
    cancelled: "ਰੱਦ",
    phone: "ਫ਼ੋਨ",
    openInFieldQuo: "FieldQuo ਵਿੱਚ ਖੋਲ੍ਹੋ",
    durationNotSet: "ਮਿਆਦ ਸੈੱਟ ਨਹੀਂ — ਇੱਕ ਘੰਟੇ ਵਜੋਂ ਦਿਖਾਈ ਗਈ।",
  },
  tl: {
    mySchedule: "ang iskedyul ko",
    appointment: "Appointment",
    jobVisit: "Pagbisita sa trabaho",
    phoneCall: "Tawag sa telepono",
    videoCall: "Video call",
    cancelled: "Kinansela",
    phone: "Telepono",
    openInFieldQuo: "Buksan sa FieldQuo",
    durationNotSet: "Walang nakatakdang tagal — ipinakita bilang isang oras.",
  },
  de: {
    mySchedule: "mein Terminplan",
    appointment: "Termin",
    jobVisit: "Auftragsbesuch",
    phoneCall: "Telefonanruf",
    videoCall: "Videoanruf",
    cancelled: "Abgesagt",
    phone: "Telefon",
    openInFieldQuo: "In FieldQuo öffnen",
    durationNotSet: "Dauer nicht festgelegt — als eine Stunde angezeigt.",
  },
  zh: {
    mySchedule: "我的日程",
    appointment: "预约",
    jobVisit: "工程到访",
    phoneCall: "电话",
    videoCall: "视频通话",
    cancelled: "已取消",
    phone: "电话",
    openInFieldQuo: "在 FieldQuo 中打开",
    durationNotSet: "未设置时长——按一小时显示。",
  },
  it: {
    mySchedule: "la mia agenda",
    appointment: "Appuntamento",
    jobVisit: "Visita di lavoro",
    phoneCall: "Telefonata",
    videoCall: "Videochiamata",
    cancelled: "Annullato",
    phone: "Telefono",
    openInFieldQuo: "Apri in FieldQuo",
    durationNotSet: "Durata non impostata — mostrata come un'ora.",
  },
});

export const FEED_COPY_LANGS = Object.freeze(Object.keys(FEED_COPY));
export const FEED_COPY_KEYS = Object.freeze(Object.keys(FEED_COPY.en));

/** The table for a language, English for one the table does not carry. */
export function feedCopy(language) {
  const code = String(language || "").toLowerCase().slice(0, 2);
  return FEED_COPY[code] || FEED_COPY.en;
}
