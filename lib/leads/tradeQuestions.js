// lib/leads/tradeQuestions.js
//
// "When do you need this done?" and the one or two questions a trade needs
// answered before anyone drives out — asked on BOTH public flows (the instant
// estimate and the booking page) from this one table, in the eight product
// languages (the instant estimate can be read in all eight; the booking
// page's pills offer English, French and Spanish — lib/i18n/bookingLanguages.js).
//
// ── Two timeline vocabularies, one lead column ─────────────────────────────
//
// A homeowner with no hot water books an electrician or a plumber TODAY; the
// same "as soon as possible / this season / next year" ladder a roofer uses
// would be a form asking someone in a flooded basement about next year. So
// the options depend on the trade — `urgent` for the trades people call when
// something has broken, `project` for the work people plan — and each option
// carries the LeadRequest.timeline key it scores as, so the lead board's
// urgency sort keeps working on the four keys it has always had
// (lib/leads/qualifiers.js). The option actually tapped is stored beside it
// as `whenNeeded`, so the card can show "Within a month" rather than the
// scorer's "Within 2 weeks".
//
// ── Pure on purpose ────────────────────────────────────────────────────────
//
// No db, no Next, no i18n context: the browser renders labels from it, the
// public routes validate against it, and the check script executes it. The
// trade catalogue (lib/trades/catalog.js) is not imported either — keys are
// listed here as strings so a booking page (category keys) and the instant
// estimate (estimator keys) resolve through the same aliases.

/** The two ladders, in the order they are shown. `lead` is the scorer's key. */
export const TIMELINE_SETS = {
  urgent: [
    { key: "today", lead: "asap" },
    { key: "this_week", lead: "2_weeks" },
    { key: "few_weeks", lead: "1_3_months" },
    { key: "planning", lead: "exploring" },
  ],
  project: [
    { key: "asap", lead: "asap" },
    { key: "within_month", lead: "2_weeks" },
    { key: "this_season", lead: "1_3_months" },
    { key: "next_year", lead: "exploring" },
  ],
};

// The trades where urgency is why they book. Category keys from
// lib/trades/catalog.js. Anything not listed — every instant-estimate trade
// included — is planned work and gets the `project` ladder.
const URGENT_TRADES = new Set([
  "plumbing",
  "electrical",
  "hvac_install",
  "hvac_repair",
  "appliance_repair",
  "locksmith",
  "garage_door",
  "restoration",
  "pest_control",
  "well_water",
  "elevator_services",
  "mechanical_contracting",
  "snow_removal",
]);

/** Which ladder a trade key (category OR instant-estimator key) uses. */
export function timelineSetFor(tradeKey) {
  return URGENT_TRADES.has(String(tradeKey || "")) ? "urgent" : "project";
}

/** The options a trade's "when" question offers, with their lead keys. */
export function timelineOptionsFor(tradeKey) {
  return TIMELINE_SETS[timelineSetFor(tradeKey)];
}

// ── The per-trade questions ────────────────────────────────────────────────
//
// Keyed by TOPIC; the alias map below folds the estimator's keys and the
// catalogue's keys onto one topic, so "roofing" (instant) and
// "roofing_service" (booking) ask the same thing.
//
// Deliberately short. Each is a question whose answer changes what the
// company brings or how fast they come, never a question the estimate
// already prices (the instant painting form prices interior/exterior
// itself; the flow drops a question whose key it already asks).
const TOPIC_ALIASES = {
  roofing: "roofing",
  roofing_service: "roofing",
  gutters: "gutters",
  gutter_services: "gutters",
  painting: "painting",
  interior_painting: "painting",
  exterior_painting: "painting",
  plumbing: "plumbing",
  electrical: "electrical",
  hvac_repair: "hvac_repair",
  appliance_repair: "appliance_repair",
};

const YES_NO = ["yes", "no"];

export const TRADE_QUESTIONS = {
  roofing: [{ key: "activeLeak", options: YES_NO }],
  gutters: [{ key: "gutterGuards", options: YES_NO }],
  painting: [{ key: "scope", options: ["interior", "exterior", "both"] }],
  plumbing: [{ key: "waterShutOff", options: YES_NO }],
  electrical: [{ key: "powerOut", options: YES_NO }],
  hvac_repair: [{ key: "systemDown", options: YES_NO }],
  appliance_repair: [
    { key: "appliance", options: ["refrigerator", "washer", "dryer", "dishwasher", "stove", "other"] },
  ],
};

/** The questions for a trade key, or an empty list. */
export function questionsFor(tradeKey) {
  const topic = TOPIC_ALIASES[String(tradeKey || "")];
  return topic ? TRADE_QUESTIONS[topic] || [] : [];
}

// ── The words ──────────────────────────────────────────────────────────────

const COPY = {
  en: {
    whenTitle: "When do you need this done?",
    notesTitle: "Anything else we should know?",
    notesPlaceholder: "Access, timing, what you've noticed — anything that helps us come prepared.",
    timeline: {
      today: "Today",
      this_week: "This week",
      few_weeks: "In the next few weeks",
      planning: "Just planning",
      asap: "As soon as possible",
      within_month: "Within a month",
      this_season: "This season",
      next_year: "Next year, just planning",
    },
    questions: {
      activeLeak: "Is there an active leak?",
      gutterGuards: "Do you also want gutter guards?",
      scope: "Interior, exterior or both?",
      waterShutOff: "Is the water currently shut off?",
      powerOut: "Is the power out?",
      systemDown: "Is the system not working at all right now?",
      appliance: "Which appliance?",
    },
    options: {
      yes: "Yes",
      no: "No",
      interior: "Interior",
      exterior: "Exterior",
      both: "Both",
      refrigerator: "Refrigerator / freezer",
      washer: "Washer",
      dryer: "Dryer",
      dishwasher: "Dishwasher",
      stove: "Stove / oven",
      other: "Something else",
    },
    // Staff-facing summary lines (lead card, scope notes, booking notes).
    whenLabel: "When needed",
    notesLabel: "Notes",
  },
  fr: {
    whenTitle: "Quand en avez-vous besoin ?",
    notesTitle: "Autre chose à nous dire ?",
    notesPlaceholder: "Accès, horaires, ce que vous avez remarqué — tout ce qui nous aide à arriver préparés.",
    timeline: {
      today: "Aujourd'hui",
      this_week: "Cette semaine",
      few_weeks: "Dans les prochaines semaines",
      planning: "Je planifie seulement",
      asap: "Dès que possible",
      within_month: "D'ici un mois",
      this_season: "Cette saison",
      next_year: "L'an prochain, je planifie seulement",
    },
    questions: {
      activeLeak: "Y a-t-il une fuite active ?",
      gutterGuards: "Voulez-vous aussi des pare-feuilles ?",
      scope: "Intérieur, extérieur ou les deux ?",
      waterShutOff: "L'eau est-elle coupée en ce moment ?",
      powerOut: "Y a-t-il une panne de courant ?",
      systemDown: "Le système ne fonctionne-t-il plus du tout ?",
      appliance: "Quel appareil ?",
    },
    options: {
      yes: "Oui",
      no: "Non",
      interior: "Intérieur",
      exterior: "Extérieur",
      both: "Les deux",
      refrigerator: "Réfrigérateur / congélateur",
      washer: "Laveuse",
      dryer: "Sécheuse",
      dishwasher: "Lave-vaisselle",
      stove: "Cuisinière / four",
      other: "Autre chose",
    },
    whenLabel: "Délai souhaité",
    notesLabel: "Notes",
  },
  es: {
    whenTitle: "¿Cuándo necesita hacer esto?",
    notesTitle: "¿Algo más que debamos saber?",
    notesPlaceholder: "Acceso, horarios, lo que ha notado — cualquier cosa que nos ayude a llegar preparados.",
    timeline: {
      today: "Hoy",
      this_week: "Esta semana",
      few_weeks: "En las próximas semanas",
      planning: "Solo estoy planeando",
      asap: "Lo antes posible",
      within_month: "Dentro de un mes",
      this_season: "Esta temporada",
      next_year: "El año que viene, solo estoy planeando",
    },
    questions: {
      activeLeak: "¿Hay una fuga activa?",
      gutterGuards: "¿Quiere también protectores de canalón?",
      scope: "¿Interior, exterior o ambos?",
      waterShutOff: "¿El agua está cortada en este momento?",
      powerOut: "¿No hay electricidad?",
      systemDown: "¿El sistema no funciona en absoluto ahora mismo?",
      appliance: "¿Qué electrodoméstico?",
    },
    options: {
      yes: "Sí",
      no: "No",
      interior: "Interior",
      exterior: "Exterior",
      both: "Ambos",
      refrigerator: "Refrigerador / congelador",
      washer: "Lavadora",
      dryer: "Secadora",
      dishwasher: "Lavavajillas",
      stove: "Estufa / horno",
      other: "Otra cosa",
    },
    whenLabel: "Plazo deseado",
    notesLabel: "Notas",
  },
  uk: {
    whenTitle: "Коли це потрібно зробити?",
    notesTitle: "Що ще нам варто знати?",
    notesPlaceholder: "Доступ, зручний час, що ви помітили — усе, що допоможе нам приїхати підготовленими.",
    timeline: {
      today: "Сьогодні",
      this_week: "Цього тижня",
      few_weeks: "Протягом кількох тижнів",
      planning: "Поки лише планую",
      asap: "Якнайшвидше",
      within_month: "Протягом місяця",
      this_season: "Цього сезону",
      next_year: "Наступного року, поки лише планую",
    },
    questions: {
      activeLeak: "Зараз щось протікає?",
      gutterGuards: "Чи потрібні вам також захисні сітки для ринв?",
      scope: "Всередині, зовні чи і там, і там?",
      waterShutOff: "Воду зараз перекрито?",
      powerOut: "Зараз немає електрики?",
      systemDown: "Система зараз зовсім не працює?",
      appliance: "Яка саме техніка?",
    },
    options: {
      yes: "Так",
      no: "Ні",
      interior: "Всередині",
      exterior: "Зовні",
      both: "І там, і там",
      refrigerator: "Холодильник / морозильна камера",
      washer: "Пральна машина",
      dryer: "Сушильна машина",
      dishwasher: "Посудомийна машина",
      stove: "Плита / духовка",
      other: "Щось інше",
    },
    whenLabel: "Коли потрібно",
    notesLabel: "Примітки",
  },
  pa: {
    whenTitle: "ਤੁਹਾਨੂੰ ਇਹ ਕੰਮ ਕਦੋਂ ਚਾਹੀਦਾ ਹੈ?",
    notesTitle: "ਕੁਝ ਹੋਰ ਜੋ ਸਾਨੂੰ ਪਤਾ ਹੋਣਾ ਚਾਹੀਦਾ ਹੈ?",
    notesPlaceholder: "ਪਹੁੰਚ, ਸਮਾਂ, ਜੋ ਤੁਸੀਂ ਵੇਖਿਆ ਹੈ — ਕੁਝ ਵੀ ਜੋ ਸਾਨੂੰ ਤਿਆਰੀ ਨਾਲ ਆਉਣ ਵਿੱਚ ਮਦਦ ਕਰੇ।",
    timeline: {
      today: "ਅੱਜ",
      this_week: "ਇਸ ਹਫ਼ਤੇ",
      few_weeks: "ਅਗਲੇ ਕੁਝ ਹਫ਼ਤਿਆਂ ਵਿੱਚ",
      planning: "ਸਿਰਫ਼ ਯੋਜਨਾ ਬਣਾ ਰਹੇ ਹਾਂ",
      asap: "ਜਿੰਨੀ ਜਲਦੀ ਹੋ ਸਕੇ",
      within_month: "ਇੱਕ ਮਹੀਨੇ ਦੇ ਅੰਦਰ",
      this_season: "ਇਸ ਸੀਜ਼ਨ ਵਿੱਚ",
      next_year: "ਅਗਲੇ ਸਾਲ, ਸਿਰਫ਼ ਯੋਜਨਾ ਬਣਾ ਰਹੇ ਹਾਂ",
    },
    questions: {
      activeLeak: "ਕੀ ਇਸ ਵੇਲੇ ਕਿਤੇ ਪਾਣੀ ਚੋ ਰਿਹਾ ਹੈ?",
      gutterGuards: "ਕੀ ਤੁਸੀਂ ਗਟਰ ਗਾਰਡ ਵੀ ਲਗਵਾਉਣਾ ਚਾਹੁੰਦੇ ਹੋ?",
      scope: "ਅੰਦਰ, ਬਾਹਰ ਜਾਂ ਦੋਵੇਂ?",
      waterShutOff: "ਕੀ ਇਸ ਵੇਲੇ ਪਾਣੀ ਬੰਦ ਕੀਤਾ ਹੋਇਆ ਹੈ?",
      powerOut: "ਕੀ ਬਿਜਲੀ ਗਈ ਹੋਈ ਹੈ?",
      systemDown: "ਕੀ ਸਿਸਟਮ ਇਸ ਵੇਲੇ ਬਿਲਕੁਲ ਕੰਮ ਨਹੀਂ ਕਰ ਰਿਹਾ?",
      appliance: "ਕਿਹੜਾ ਉਪਕਰਨ?",
    },
    options: {
      yes: "ਹਾਂ",
      no: "ਨਹੀਂ",
      interior: "ਅੰਦਰ",
      exterior: "ਬਾਹਰ",
      both: "ਦੋਵੇਂ",
      refrigerator: "ਫ਼ਰਿੱਜ / ਫ਼ਰੀਜ਼ਰ",
      washer: "ਵਾਸ਼ਿੰਗ ਮਸ਼ੀਨ",
      dryer: "ਡਰਾਇਰ",
      dishwasher: "ਡਿਸ਼ਵਾਸ਼ਰ",
      stove: "ਚੁੱਲ੍ਹਾ / ਓਵਨ",
      other: "ਕੁਝ ਹੋਰ",
    },
    whenLabel: "ਕਦੋਂ ਚਾਹੀਦਾ ਹੈ",
    notesLabel: "ਨੋਟ",
  },
  tl: {
    whenTitle: "Kailan po ninyo ito kailangan?",
    notesTitle: "May iba pa po ba kaming dapat malaman?",
    notesPlaceholder: "Daanan, oras, mga napansin ninyo — anumang makakatulong para handa kaming dumating.",
    timeline: {
      today: "Ngayong araw",
      this_week: "Ngayong linggo",
      few_weeks: "Sa susunod na ilang linggo",
      planning: "Nagpaplano pa lang",
      asap: "Sa lalong madaling panahon",
      within_month: "Sa loob ng isang buwan",
      this_season: "Ngayong season",
      next_year: "Sa susunod na taon, nagpaplano pa lang",
    },
    questions: {
      activeLeak: "May tumutulo po ba ngayon?",
      gutterGuards: "Gusto rin po ba ninyo ng takip na pananggalang sa alulod?",
      scope: "Loob, labas, o pareho?",
      waterShutOff: "Nakasara po ba ang tubig ngayon?",
      powerOut: "Wala po bang kuryente?",
      systemDown: "Hindi po ba talaga gumagana ang sistema ngayon?",
      appliance: "Aling kasangkapan?",
    },
    options: {
      yes: "Oo",
      no: "Hindi",
      interior: "Loob",
      exterior: "Labas",
      both: "Pareho",
      refrigerator: "Ref o freezer",
      washer: "Washing machine",
      dryer: "Patuyuan ng damit",
      dishwasher: "Panghugas ng pinggan",
      stove: "Kalan / oven",
      other: "Iba pa",
    },
    whenLabel: "Kailan kailangan",
    notesLabel: "Mga tala",
  },
  de: {
    whenTitle: "Wann soll das erledigt werden?",
    notesTitle: "Gibt es noch etwas, das wir wissen sollten?",
    notesPlaceholder: "Zugang, Zeiten, was Ihnen aufgefallen ist – alles, was uns hilft, gut vorbereitet zu kommen.",
    timeline: {
      today: "Heute",
      this_week: "Diese Woche",
      few_weeks: "In den nächsten Wochen",
      planning: "Ich plane erst",
      asap: "So bald wie möglich",
      within_month: "Innerhalb eines Monats",
      this_season: "In dieser Saison",
      next_year: "Nächstes Jahr, ich plane erst",
    },
    questions: {
      activeLeak: "Gibt es gerade eine undichte Stelle?",
      gutterGuards: "Möchten Sie auch einen Laubschutz für die Dachrinne?",
      scope: "Innen, außen oder beides?",
      waterShutOff: "Ist das Wasser gerade abgestellt?",
      powerOut: "Ist der Strom ausgefallen?",
      systemDown: "Funktioniert die Anlage gerade gar nicht?",
      appliance: "Welches Gerät?",
    },
    options: {
      yes: "Ja",
      no: "Nein",
      interior: "Innen",
      exterior: "Außen",
      both: "Beides",
      refrigerator: "Kühlschrank / Gefriergerät",
      washer: "Waschmaschine",
      dryer: "Wäschetrockner",
      dishwasher: "Geschirrspüler",
      stove: "Herd / Backofen",
      other: "Etwas anderes",
    },
    whenLabel: "Gewünschter Zeitraum",
    notesLabel: "Notizen",
  },
  it: {
    whenTitle: "Quando le serve?",
    notesTitle: "C'è altro che dovremmo sapere?",
    notesPlaceholder: "Accesso, orari, cosa ha notato: tutto ciò che ci aiuta ad arrivare preparati.",
    timeline: {
      today: "Oggi",
      this_week: "Questa settimana",
      few_weeks: "Nelle prossime settimane",
      planning: "Sto solo pianificando",
      asap: "Il prima possibile",
      within_month: "Entro un mese",
      this_season: "In questa stagione",
      next_year: "L'anno prossimo, sto solo pianificando",
    },
    questions: {
      activeLeak: "C'è un'infiltrazione in corso?",
      gutterGuards: "Desidera anche le protezioni parafoglie per le grondaie?",
      scope: "Interno, esterno o entrambi?",
      waterShutOff: "L'acqua è chiusa in questo momento?",
      powerOut: "Manca la corrente?",
      systemDown: "L'impianto in questo momento non funziona affatto?",
      appliance: "Quale elettrodomestico?",
    },
    options: {
      yes: "Sì",
      no: "No",
      interior: "Interno",
      exterior: "Esterno",
      both: "Entrambi",
      refrigerator: "Frigorifero / congelatore",
      washer: "Lavatrice",
      dryer: "Asciugatrice",
      dishwasher: "Lavastoviglie",
      stove: "Cucina / forno",
      other: "Altro",
    },
    whenLabel: "Quando serve",
    notesLabel: "Note",
  },
};

/** The copy table for a language, falling back to English. */
export function tradeQuestionCopy(language = "en") {
  const code = String(language || "en").toLowerCase().slice(0, 2);
  return Object.prototype.hasOwnProperty.call(COPY, code) ? COPY[code] : COPY.en;
}

/** "Within a month" — the label of a `whenNeeded` option, in `language`. */
export function whenNeededLabel(optionKey, language = "en") {
  return tradeQuestionCopy(language).timeline[optionKey] || null;
}

// ── Validation: what a public POST may store ──────────────────────────────

/**
 * Validate what the browser posted for a trade. Unknown keys and values are
 * dropped rather than stored — a hand-crafted POST must not be able to write
 * a string nothing can score or a key the lead card will print at staff.
 *
 * @returns {{ whenNeeded: string|null, timeline: string|null, answers: object, notes: string|null }}
 */
export function cleanTradeAnswers(tradeKey, posted = {}) {
  const src = posted && typeof posted === "object" ? posted : {};
  const options = timelineOptionsFor(tradeKey);
  const when = options.find((o) => o.key === src.whenNeeded) || null;

  const answers = {};
  const rawAnswers = src.answers && typeof src.answers === "object" ? src.answers : {};
  for (const q of questionsFor(tradeKey)) {
    const v = rawAnswers[q.key];
    if (typeof v === "string" && q.options.includes(v)) answers[q.key] = v;
  }

  const notes =
    typeof src.notes === "string" && src.notes.trim() ? src.notes.trim().slice(0, 2000) : null;

  return {
    whenNeeded: when ? when.key : null,
    timeline: when ? when.lead : null,
    answers,
    notes,
  };
}

/**
 * The homeowner's answers as staff-readable lines — "When needed: This week",
 * "Active leak: Yes" — in `language`. Feeds the quote's scope notes, the
 * booking's notes and the lead card. Empty answers produce no line: an
 * absent statement is not a statement.
 */
export function tradeAnswerLines(tradeKey, { whenNeeded, answers, notes } = {}, language = "en") {
  const t = tradeQuestionCopy(language);
  const lines = [];
  const when = whenNeededLabel(whenNeeded, language);
  if (when) lines.push(`${t.whenLabel}: ${when}`);
  for (const q of questionsFor(tradeKey)) {
    const v = answers?.[q.key];
    if (!v || !q.options.includes(v)) continue;
    // The question with its trailing "?" (and French's no-break space before
    // it) removed reads as a label: "Active leak: Yes".
    const label = (t.questions[q.key] || q.key).replace(/\s* ?[?¿]+\s*$/u, "").replace(/^¿/, "");
    lines.push(`${label}: ${t.options[v] || v}`);
  }
  if (typeof notes === "string" && notes.trim()) lines.push(`${t.notesLabel}: ${notes.trim()}`);
  return lines;
}

/** Exported for the language-completeness check. */
export const TRADE_QUESTION_COPY = COPY;
