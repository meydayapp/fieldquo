// lib/booking/bookingModes.js
//
// The one place that knows what a booking MODE is — "visit", "call", "video"
// — how long each takes, what each one requires of the client, and how to say
// it in the client's language.
//
// ══ Why one file ═══════════════════════════════════════════════════════════
//
// The owner booked a demo consultation on 2026-09-20 and read "Phone or
// on-site visit" — the free-text label the auto-created event type carried —
// with no way to say which. The company's default modes are ["visit"], so
// the picker never rendered, the address stayed optional, one duration
// applied to every mode, and the confirmation named neither. Every surface
// that printed the mode had typed its own words: lib/booking/manageVisit.js
// had English for the letters, lib/i18n/clientDocCopy.js had eight languages
// for the manage page, lib/voice/visitPath.js had the receptionist's, and the
// booking page had a fourth set. Four copies is how the client is told
// "On-site visit" about the phone call they booked.
//
// So: the label, the "where" line, the per-mode duration, the per-mode
// required field and its refusal all come from here, and every surface reads
// them. Pure — no database, no fetch — so scripts/check-booking-modes.mjs can
// run the same functions the routes run.
//
// ══ Languages ══════════════════════════════════════════════════════════════
//
// The eight document languages (lib/i18n/documentLabels.js), the same set the
// letters and the texts are written in, plus zh for the app shell's ninth so
// a Chinese-reading office sees its own words on the calendar card. English
// is the fallback for anything else, per key, the same rule emailCopy uses —
// a language missing one key must never print "undefined" to a homeowner.

/** The three ways a company can meet a client. Same set the settings API stores. */
export const BOOKING_MODES = Object.freeze(["visit", "call", "video"]);

/**
 * The lengths a mode falls to when the company never said.
 *
 * A visit has no default here on purpose: it takes the event type's own
 * durationMinutes, which is seeded from Company.defaultVisitMinutes and is
 * the number the company has been editing all along. Twenty for a call and
 * thirty for a video call are the shape of a quote conversation rather than
 * a measure — short enough not to empty a Monday, long enough to be real.
 */
export const DEFAULT_CALL_MINUTES = 20;
export const DEFAULT_VIDEO_MINUTES = 30;

/** The bounds the settings route clamps every per-mode length to. */
export const MIN_MODE_MINUTES = 5;
export const MAX_MODE_MINUTES = 480;

/**
 * Which modes this company offers. Empty or absent is the schema default
 * ["visit"] — "nothing chosen yet", never "nothing offered". Same reading as
 * lib/voice/visitPath.js offeredModes() and lib/booking/canBookVisit.js.
 */
export function offeredModes(company) {
  const raw = Array.isArray(company?.bookingModes) ? company.bookingModes : [];
  const clean = raw.filter((m) => BOOKING_MODES.includes(m));
  return clean.length ? clean : ["visit"];
}

/**
 * The mode a booking is in, given what the browser (or the phone agent) asked
 * for and what the company offers. Anything not offered falls to the first
 * mode the company DOES offer — a booking in a mode the company does not do
 * is a person waiting for a knock that was never coming.
 */
export function resolveMode(company, requested) {
  const offered = offeredModes(company);
  return offered.includes(requested) ? requested : offered[0];
}

/**
 * How long a booking in this mode takes, in minutes.
 *
 *   visit  → the event type's own durationMinutes (the company's per-event
 *            override, seeded from defaultVisitMinutes), else
 *            defaultVisitMinutes, else 60.
 *   call   → Company.callMinutes, else 20.
 *   video  → Company.videoMinutes, else 30.
 *
 * A call never inherits the visit length. That was the bug: one number for
 * every mode meant a twenty-minute phone call blocked the hour a kitchen
 * measure needs, and the calendar showed the estimator "out" for a call taken
 * from the van. Clamped to sane bounds whatever the row says, because a zero
 * makes the slot loop emit infinitely and a ten-hour one emits nothing.
 */
export function bookingDurationMinutes({ company, eventType, mode }) {
  const clamp = (n, fallback) => {
    const v = Number(n);
    if (!Number.isFinite(v) || v <= 0) return fallback;
    return Math.min(MAX_MODE_MINUTES, Math.max(MIN_MODE_MINUTES, Math.round(v)));
  };
  if (mode === "call") return clamp(company?.callMinutes, DEFAULT_CALL_MINUTES);
  if (mode === "video") return clamp(company?.videoMinutes, DEFAULT_VIDEO_MINUTES);
  return clamp(eventType?.durationMinutes, clamp(company?.defaultVisitMinutes, 60));
}

/**
 * The event type as the slot engine should see it for THIS mode: the same
 * row with durationMinutes replaced by the mode's length. computeAvailableSlots
 * reads eventType.durationMinutes and nothing else about length, so handing
 * it a copy is the one change that reaches every caller — the booking page,
 * the reschedule route and the phone agent — without three edits to the loop.
 */
export function eventTypeForMode({ company, eventType, mode }) {
  if (!eventType) return eventType;
  return { ...eventType, durationMinutes: bookingDurationMinutes({ company, eventType, mode }) };
}

/**
 * What the client must give for this mode, and whether they did.
 *
 *   visit → an address (picked or typed — the service-area check is separate
 *           and never a gate)
 *   call  → a phone number the crew can ring, in a shape Twilio can dial
 *   video → an email, because that is where the link goes
 *
 * Returns null when satisfied, else the key of the missing field. The E.164
 * test is deliberately the same naive North-American one lib/sms/twilioClient
 * uses — the number this checks is the one the crew will ring and the SMS
 * confirmation will text, and a number that layer cannot dial is not a phone
 * number for our purposes, however it was typed.
 */
export function missingForMode(mode, { address, phone, email } = {}) {
  const has = (v) => typeof v === "string" && v.trim().length > 0;
  if (mode === "visit") return has(address) ? null : "address";
  if (mode === "call") return has(phone) && e164(phone) ? null : "phone";
  if (mode === "video") return has(email) ? null : "email";
  return null;
}

/**
 * E.164 for a North American number, or null. Duplicated from
 * lib/sms/twilioClient.js's toE164 rather than imported, because that file
 * instantiates the Twilio REST client at module load and this one has to run
 * in the browser (the booking page disables Book on the same test the server
 * refuses on).
 */
export function e164(phone) {
  const text = String(phone || "").trim();
  if (!text) return null;
  const digits = text.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (text.startsWith("+") && digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  return null;
}

// ── The words ───────────────────────────────────────────────────────────────
//
// `label` is the capitalised form for a heading, a chip or a subject line;
// `noun` is the form that sits inside a sentence ("Your on-site visit with
// Northline is confirmed"), which in most of these languages is lowercase
// and in German is not — so they are two entries, not one entry lowercased.
//
// Functions where a value is interpolated, so a language puts the address or
// the number where its grammar wants it. `stated` is the sentence the booking
// page shows when the company offers ONE mode and there is nothing to choose
// — the page states it rather than saying nothing, which is how the owner
// came to book a "Phone or on-site visit" without knowing which.
const COPY = {
  en: {
    label: { visit: "On-site visit", call: "Phone call", video: "Video call" },
    noun: { visit: "on-site visit", call: "phone call", video: "video call" },
    addToCalendar: "Add to calendar",
    phoneWord: "Phone",
    feeLabel: "Fee",
    freeNote: "No charge to book.",
    feeNote: (amount) => `${amount} paid to hold your spot — credited back if you go ahead with the work.`,
    noCharge: "No charge",
    feePaid: (amount) => `${amount} paid`,
    at: (address) => `On-site visit at ${address}`,
    visitNoAddress: "On-site visit — address to be confirmed",
    ring: (phone) => `Phone call — we'll ring ${phone}`,
    ringNoPhone: "Phone call — we'll ring you",
    videoLink: (email) => `Video call — we'll email a link to ${email}`,
    videoNoEmail: "Video call — we'll email a link",
    stated: {
      visit: "This is an on-site visit — we come to you.",
      call: "This is a phone call — we'll ring you at the time you pick.",
      video: "This is a video call — we'll email you a link.",
    },
    required: {
      address: "Please enter the address we're coming to — it's needed for an on-site visit.",
      phone: "Please enter the phone number we should call — it's needed for a phone call.",
      email: "Please enter your email — that's where the video call link goes.",
    },
    reschedule: "Your booking keeps the same type of appointment.",
  },
  fr: {
    label: { visit: "Visite sur place", call: "Appel téléphonique", video: "Appel vidéo" },
    noun: { visit: "visite sur place", call: "appel téléphonique", video: "appel vidéo" },
    addToCalendar: "Ajouter au calendrier",
    phoneWord: "Téléphone",
    feeLabel: "Frais",
    freeNote: "Aucuns frais pour réserver.",
    feeNote: (amount) => `${amount} payés pour réserver votre place — crédités si vous confiez les travaux.`,
    noCharge: "Sans frais",
    feePaid: (amount) => `${amount} payés`,
    at: (address) => `Visite sur place au ${address}`,
    visitNoAddress: "Visite sur place — adresse à confirmer",
    ring: (phone) => `Appel téléphonique — nous vous appellerons au ${phone}`,
    ringNoPhone: "Appel téléphonique — nous vous appellerons",
    videoLink: (email) => `Appel vidéo — nous enverrons un lien à ${email}`,
    videoNoEmail: "Appel vidéo — nous vous enverrons un lien par courriel",
    stated: {
      visit: "Il s'agit d'une visite sur place — nous nous déplaçons chez vous.",
      call: "Il s'agit d'un appel téléphonique — nous vous appellerons à l'heure choisie.",
      video: "Il s'agit d'un appel vidéo — nous vous enverrons un lien par courriel.",
    },
    required: {
      address: "Veuillez entrer l'adresse où nous devons nous rendre — elle est requise pour une visite sur place.",
      phone: "Veuillez entrer le numéro de téléphone à appeler — il est requis pour un appel téléphonique.",
      email: "Veuillez entrer votre courriel — c'est là que le lien de l'appel vidéo sera envoyé.",
    },
    reschedule: "Votre réservation garde le même type de rendez-vous.",
  },
  es: {
    label: { visit: "Visita en sitio", call: "Llamada telefónica", video: "Videollamada" },
    noun: { visit: "visita en sitio", call: "llamada telefónica", video: "videollamada" },
    addToCalendar: "Agregar al calendario",
    phoneWord: "Teléfono",
    feeLabel: "Cargo",
    freeNote: "Reservar no tiene costo.",
    feeNote: (amount) => `${amount} pagados para reservar su lugar — se acreditan si sigue adelante con el trabajo.`,
    noCharge: "Sin cargo",
    feePaid: (amount) => `${amount} pagados`,
    at: (address) => `Visita en sitio en ${address}`,
    visitNoAddress: "Visita en sitio — dirección por confirmar",
    ring: (phone) => `Llamada telefónica — le llamaremos al ${phone}`,
    ringNoPhone: "Llamada telefónica — le llamaremos",
    videoLink: (email) => `Videollamada — enviaremos un enlace a ${email}`,
    videoNoEmail: "Videollamada — le enviaremos un enlace por correo",
    stated: {
      visit: "Es una visita en sitio — vamos a su domicilio.",
      call: "Es una llamada telefónica — le llamaremos a la hora que elija.",
      video: "Es una videollamada — le enviaremos un enlace por correo.",
    },
    required: {
      address: "Indique la dirección a la que debemos ir — es necesaria para una visita en sitio.",
      phone: "Indique el número de teléfono al que debemos llamar — es necesario para una llamada telefónica.",
      email: "Indique su correo electrónico — ahí enviaremos el enlace de la videollamada.",
    },
    reschedule: "Su reserva mantiene el mismo tipo de cita.",
  },
  uk: {
    label: { visit: "Виїзд на місце", call: "Телефонний дзвінок", video: "Відеодзвінок" },
    noun: { visit: "виїзд на місце", call: "телефонний дзвінок", video: "відеодзвінок" },
    addToCalendar: "Додати до календаря",
    phoneWord: "Телефон",
    feeLabel: "Оплата",
    freeNote: "Бронювання безкоштовне.",
    feeNote: (amount) => `${amount} сплачено за бронювання — зараховується, якщо ви замовите роботи.`,
    noCharge: "Без оплати",
    feePaid: (amount) => `Сплачено ${amount}`,
    at: (address) => `Виїзд на місце: ${address}`,
    visitNoAddress: "Виїзд на місце — адресу буде уточнено",
    ring: (phone) => `Телефонний дзвінок — ми зателефонуємо на ${phone}`,
    ringNoPhone: "Телефонний дзвінок — ми вам зателефонуємо",
    videoLink: (email) => `Відеодзвінок — ми надішлемо посилання на ${email}`,
    videoNoEmail: "Відеодзвінок — ми надішлемо посилання електронною поштою",
    stated: {
      visit: "Це виїзд на місце — ми приїдемо до вас.",
      call: "Це телефонний дзвінок — ми зателефонуємо вам у вибраний час.",
      video: "Це відеодзвінок — ми надішлемо вам посилання електронною поштою.",
    },
    required: {
      address: "Вкажіть адресу, куди нам приїхати — вона потрібна для виїзду на місце.",
      phone: "Вкажіть номер телефону, на який зателефонувати — він потрібен для телефонного дзвінка.",
      email: "Вкажіть електронну пошту — туди ми надішлемо посилання на відеодзвінок.",
    },
    reschedule: "Тип зустрічі у вашому бронюванні не змінюється.",
  },
  pa: {
    label: { visit: "ਸਾਈਟ 'ਤੇ ਮੁਲਾਕਾਤ", call: "ਫ਼ੋਨ ਕਾਲ", video: "ਵੀਡੀਓ ਕਾਲ" },
    noun: { visit: "ਸਾਈਟ 'ਤੇ ਮੁਲਾਕਾਤ", call: "ਫ਼ੋਨ ਕਾਲ", video: "ਵੀਡੀਓ ਕਾਲ" },
    addToCalendar: "ਕੈਲੰਡਰ ਵਿੱਚ ਸ਼ਾਮਲ ਕਰੋ",
    phoneWord: "ਫ਼ੋਨ",
    feeLabel: "ਫ਼ੀਸ",
    freeNote: "ਬੁੱਕ ਕਰਨ ਲਈ ਕੋਈ ਖਰਚਾ ਨਹੀਂ।",
    feeNote: (amount) => `ਥਾਂ ਰੱਖਣ ਲਈ ${amount} ਅਦਾ — ਜੇ ਤੁਸੀਂ ਕੰਮ ਕਰਵਾਉਂਦੇ ਹੋ ਤਾਂ ਵਾਪਸ ਕ੍ਰੈਡਿਟ ਹੁੰਦਾ ਹੈ।`,
    noCharge: "ਕੋਈ ਖਰਚਾ ਨਹੀਂ",
    feePaid: (amount) => `${amount} ਅਦਾ ਕੀਤਾ`,
    at: (address) => `ਸਾਈਟ 'ਤੇ ਮੁਲਾਕਾਤ: ${address}`,
    visitNoAddress: "ਸਾਈਟ 'ਤੇ ਮੁਲਾਕਾਤ — ਪਤਾ ਪੁਸ਼ਟੀ ਹੋਣਾ ਬਾਕੀ",
    ring: (phone) => `ਫ਼ੋਨ ਕਾਲ — ਅਸੀਂ ${phone} 'ਤੇ ਕਾਲ ਕਰਾਂਗੇ`,
    ringNoPhone: "ਫ਼ੋਨ ਕਾਲ — ਅਸੀਂ ਤੁਹਾਨੂੰ ਕਾਲ ਕਰਾਂਗੇ",
    videoLink: (email) => `ਵੀਡੀਓ ਕਾਲ — ਅਸੀਂ ${email} 'ਤੇ ਲਿੰਕ ਭੇਜਾਂਗੇ`,
    videoNoEmail: "ਵੀਡੀਓ ਕਾਲ — ਅਸੀਂ ਈਮੇਲ ਰਾਹੀਂ ਲਿੰਕ ਭੇਜਾਂਗੇ",
    stated: {
      visit: "ਇਹ ਸਾਈਟ 'ਤੇ ਮੁਲਾਕਾਤ ਹੈ — ਅਸੀਂ ਤੁਹਾਡੇ ਕੋਲ ਆਵਾਂਗੇ।",
      call: "ਇਹ ਫ਼ੋਨ ਕਾਲ ਹੈ — ਅਸੀਂ ਤੁਹਾਡੇ ਚੁਣੇ ਸਮੇਂ 'ਤੇ ਕਾਲ ਕਰਾਂਗੇ।",
      video: "ਇਹ ਵੀਡੀਓ ਕਾਲ ਹੈ — ਅਸੀਂ ਤੁਹਾਨੂੰ ਈਮੇਲ ਰਾਹੀਂ ਲਿੰਕ ਭੇਜਾਂਗੇ।",
    },
    required: {
      address: "ਕਿਰਪਾ ਕਰਕੇ ਉਹ ਪਤਾ ਦਿਓ ਜਿੱਥੇ ਅਸੀਂ ਆਉਣਾ ਹੈ — ਸਾਈਟ 'ਤੇ ਮੁਲਾਕਾਤ ਲਈ ਇਹ ਲਾਜ਼ਮੀ ਹੈ।",
      phone: "ਕਿਰਪਾ ਕਰਕੇ ਉਹ ਫ਼ੋਨ ਨੰਬਰ ਦਿਓ ਜਿਸ 'ਤੇ ਅਸੀਂ ਕਾਲ ਕਰੀਏ — ਫ਼ੋਨ ਕਾਲ ਲਈ ਇਹ ਲਾਜ਼ਮੀ ਹੈ।",
      email: "ਕਿਰਪਾ ਕਰਕੇ ਆਪਣੀ ਈਮੇਲ ਦਿਓ — ਵੀਡੀਓ ਕਾਲ ਦਾ ਲਿੰਕ ਉੱਥੇ ਭੇਜਿਆ ਜਾਵੇਗਾ।",
    },
    reschedule: "ਤੁਹਾਡੀ ਬੁਕਿੰਗ ਦੀ ਮੁਲਾਕਾਤ ਦੀ ਕਿਸਮ ਉਹੀ ਰਹਿੰਦੀ ਹੈ।",
  },
  tl: {
    label: { visit: "On-site na pagbisita", call: "Tawag sa telepono", video: "Video call" },
    noun: { visit: "on-site na pagbisita", call: "tawag sa telepono", video: "video call" },
    addToCalendar: "Idagdag sa kalendaryo",
    phoneWord: "Telepono",
    feeLabel: "Bayad",
    freeNote: "Walang bayad sa pag-book.",
    feeNote: (amount) => `${amount} ang binayaran para i-hold ang iyong slot — ibabalik bilang credit kung itutuloy mo ang trabaho.`,
    noCharge: "Walang bayad",
    feePaid: (amount) => `${amount} binayaran`,
    at: (address) => `On-site na pagbisita sa ${address}`,
    visitNoAddress: "On-site na pagbisita — kukumpirmahin pa ang address",
    ring: (phone) => `Tawag sa telepono — tatawagan namin ang ${phone}`,
    ringNoPhone: "Tawag sa telepono — tatawagan ka namin",
    videoLink: (email) => `Video call — magpapadala kami ng link sa ${email}`,
    videoNoEmail: "Video call — magpapadala kami ng link sa email",
    stated: {
      visit: "Ito ay on-site na pagbisita — pupunta kami sa inyo.",
      call: "Ito ay tawag sa telepono — tatawagan ka namin sa oras na pipiliin mo.",
      video: "Ito ay video call — magpapadala kami ng link sa iyong email.",
    },
    required: {
      address: "Pakilagay ang address na pupuntahan namin — kailangan ito para sa on-site na pagbisita.",
      phone: "Pakilagay ang numero ng teleponong tatawagan namin — kailangan ito para sa tawag sa telepono.",
      email: "Pakilagay ang iyong email — doon ipapadala ang link ng video call.",
    },
    reschedule: "Pareho pa rin ang uri ng appointment ng iyong booking.",
  },
  de: {
    label: { visit: "Vor-Ort-Termin", call: "Telefonat", video: "Videoanruf" },
    noun: { visit: "Vor-Ort-Termin", call: "Telefonat", video: "Videoanruf" },
    addToCalendar: "Zum Kalender hinzufügen",
    phoneWord: "Telefon",
    feeLabel: "Gebühr",
    freeNote: "Die Buchung ist kostenlos.",
    feeNote: (amount) => `${amount} werden jetzt zur Reservierung gezahlt — und gutgeschrieben, wenn Sie den Auftrag erteilen.`,
    noCharge: "Kostenlos",
    feePaid: (amount) => `${amount} bezahlt`,
    at: (address) => `Vor-Ort-Termin bei ${address}`,
    visitNoAddress: "Vor-Ort-Termin — Adresse wird noch bestätigt",
    ring: (phone) => `Telefonat — wir rufen Sie unter ${phone} an`,
    ringNoPhone: "Telefonat — wir rufen Sie an",
    videoLink: (email) => `Videoanruf — wir senden einen Link an ${email}`,
    videoNoEmail: "Videoanruf — wir senden Ihnen einen Link per E-Mail",
    stated: {
      visit: "Dies ist ein Vor-Ort-Termin — wir kommen zu Ihnen.",
      call: "Dies ist ein Telefonat — wir rufen Sie zur gewählten Zeit an.",
      video: "Dies ist ein Videoanruf — wir senden Ihnen einen Link per E-Mail.",
    },
    required: {
      address: "Bitte geben Sie die Adresse an, zu der wir kommen sollen — sie ist für einen Vor-Ort-Termin erforderlich.",
      phone: "Bitte geben Sie die Telefonnummer an, die wir anrufen sollen — sie ist für ein Telefonat erforderlich.",
      email: "Bitte geben Sie Ihre E-Mail-Adresse an — dorthin senden wir den Link zum Videoanruf.",
    },
    reschedule: "Ihre Buchung behält dieselbe Terminart.",
  },
  it: {
    label: { visit: "Sopralluogo", call: "Telefonata", video: "Videochiamata" },
    noun: { visit: "sopralluogo", call: "telefonata", video: "videochiamata" },
    addToCalendar: "Aggiungi al calendario",
    phoneWord: "Telefono",
    feeLabel: "Costo",
    freeNote: "Prenotare non costa nulla.",
    feeNote: (amount) => `${amount} pagati per riservare il posto — accreditati se conferma i lavori.`,
    noCharge: "Nessun addebito",
    feePaid: (amount) => `${amount} pagati`,
    at: (address) => `Sopralluogo presso ${address}`,
    visitNoAddress: "Sopralluogo — indirizzo da confermare",
    ring: (phone) => `Telefonata — la chiameremo al ${phone}`,
    ringNoPhone: "Telefonata — la chiameremo",
    videoLink: (email) => `Videochiamata — invieremo un link a ${email}`,
    videoNoEmail: "Videochiamata — le invieremo un link via email",
    stated: {
      visit: "È un sopralluogo — veniamo noi da lei.",
      call: "È una telefonata — la chiameremo all'orario scelto.",
      video: "È una videochiamata — le invieremo un link via email.",
    },
    required: {
      address: "Inserisca l'indirizzo dove dobbiamo venire — è necessario per un sopralluogo.",
      phone: "Inserisca il numero di telefono da chiamare — è necessario per una telefonata.",
      email: "Inserisca la sua email — è lì che invieremo il link della videochiamata.",
    },
    reschedule: "La prenotazione mantiene lo stesso tipo di appuntamento.",
  },
  zh: {
    label: { visit: "上门服务", call: "电话沟通", video: "视频通话" },
    noun: { visit: "上门服务", call: "电话沟通", video: "视频通话" },
    addToCalendar: "添加到日历",
    phoneWord: "电话",
    feeLabel: "费用",
    freeNote: "预约免费。",
    feeNote: (amount) => `支付 ${amount} 以保留您的时段 — 若您确认施工将予以抵扣。`,
    noCharge: "免费",
    feePaid: (amount) => `已支付 ${amount}`,
    at: (address) => `上门服务：${address}`,
    visitNoAddress: "上门服务 — 地址待确认",
    ring: (phone) => `电话沟通 — 我们将致电 ${phone}`,
    ringNoPhone: "电话沟通 — 我们将致电您",
    videoLink: (email) => `视频通话 — 我们将把链接发送至 ${email}`,
    videoNoEmail: "视频通话 — 我们将通过电子邮件发送链接",
    stated: {
      visit: "这是上门服务 — 我们会到您那里。",
      call: "这是电话沟通 — 我们会在您选择的时间致电您。",
      video: "这是视频通话 — 我们会通过电子邮件向您发送链接。",
    },
    required: {
      address: "请输入我们前往的地址 — 上门服务需要地址。",
      phone: "请输入我们应拨打的电话号码 — 电话沟通需要电话号码。",
      email: "请输入您的电子邮件 — 视频通话链接将发送到那里。",
    },
    reschedule: "您的预约保持同一类型。",
  },
};

/** The languages with hand-written wording. The check script walks these. */
export const BOOKING_MODE_LANGUAGES = Object.freeze(Object.keys(COPY));

/** Raw table, for scripts/check-booking-modes.mjs. */
export const BOOKING_MODE_COPY = COPY;

/** The pack for one language, merged over English per key. */
export function bookingModeCopy(language = "en") {
  const dict = COPY[language];
  if (!dict) return COPY.en;
  return {
    ...COPY.en,
    ...dict,
    label: { ...COPY.en.label, ...(dict.label || {}) },
    noun: { ...COPY.en.noun, ...(dict.noun || {}) },
    stated: { ...COPY.en.stated, ...(dict.stated || {}) },
    required: { ...COPY.en.required, ...(dict.required || {}) },
  };
}

/**
 * "On-site visit" / "Phone call" / "Video call", in the reader's language.
 * An unknown mode reads as a visit — the field-trade default — rather than
 * as a blank, because a blank on a calendar card looks like a bug and a
 * wrong-but-plausible word at least gets rung about.
 */
export function bookingModeLabel(mode, language = "en") {
  const copy = bookingModeCopy(language);
  return copy.label[BOOKING_MODES.includes(mode) ? mode : "visit"];
}

/** The same, as a noun inside a sentence: "on-site visit", "phone call", "video call". */
export function bookingModeNoun(mode, language = "en") {
  const copy = bookingModeCopy(language);
  return copy.noun[BOOKING_MODES.includes(mode) ? mode : "visit"];
}

/**
 * The one line every surface prints for WHAT was booked and WHERE:
 *
 *   visit → "On-site visit at 12 Elm St"        (no address: "address to be confirmed")
 *   call  → "Phone call — we'll ring 819-238-7263"
 *   video → "Video call — we'll email a link to a@b.c"
 *
 * Replaces the English-only visitWhere() in lib/booking/manageVisit.js, and
 * the three per-language sentences the manage page carried, so the letter,
 * the text, the manage page and the calendar card cannot disagree about which
 * kind of appointment this is. Never falls back to EventType.location: that
 * column was the free-text "Phone or on-site visit" label this file exists to
 * retire, and printing it would put that sentence back on the page.
 */
export function bookingModeLine({ mode, address, phone, email, language = "en" }) {
  const copy = bookingModeCopy(language);
  const clean = (v) => (typeof v === "string" ? v.trim() : "");
  const m = BOOKING_MODES.includes(mode) ? mode : "visit";
  if (m === "call") return clean(phone) ? copy.ring(clean(phone)) : copy.ringNoPhone;
  if (m === "video") return clean(email) ? copy.videoLink(clean(email)) : copy.videoNoEmail;
  return clean(address) ? copy.at(clean(address)) : copy.visitNoAddress;
}

/**
 * What the booking cost, for the letter and the text: "$49 paid" or "No
 * charge". `amountText` is already formatted in the company's currency by
 * the caller (lib/currency formatMoney), because this module is pure and
 * runs in the browser too; null or empty means nothing was taken.
 */
export function bookingFeeLine({ amountText, language = "en" }) {
  const copy = bookingModeCopy(language);
  const text = typeof amountText === "string" ? amountText.trim() : "";
  return text ? copy.feePaid(text) : copy.noCharge;
}

/**
 * The sentence under a single stated mode about money: "No charge to book."
 * or "$49 paid to hold your spot — credited back if you go ahead."
 */
export function bookingFeeNote({ amountText, language = "en" }) {
  const copy = bookingModeCopy(language);
  const text = typeof amountText === "string" ? amountText.trim() : "";
  return text ? copy.feeNote(text) : copy.freeNote;
}

/** "This is an on-site visit — we come to you." — for a page with nothing to choose. */
export function bookingModeStatement(mode, language = "en") {
  const copy = bookingModeCopy(language);
  return copy.stated[BOOKING_MODES.includes(mode) ? mode : "visit"];
}

/**
 * The refusal for a missing field, in words: what to enter and why. Same
 * sentence under the disabled Book button and in the 400 the confirm route
 * returns, so a hand-crafted POST and a real tap are told the same thing.
 */
export function requiredFieldRefusal(field, language = "en") {
  const copy = bookingModeCopy(language);
  return copy.required[field] || copy.required.address;
}
