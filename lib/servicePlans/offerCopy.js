// lib/servicePlans/offerCopy.js
//
// What a CLIENT reads about a maintenance plan: on the quote page (/q/[token])
// beside the extras, and on each visit's invoice. Eight languages — the
// document set (Quote.language) — and the words follow the document, never the
// reader's browser: a French quote offers its plan in French (non-negotiable #6).
//
// Hand-written, like lib/i18n/clientDocCopy.js, and kept in its own table for
// the same reason gutterEstimateCopy.js is: one feature's short set of
// sentences, added whole. Functions wherever a figure or a date is placed in a
// sentence — word order around a value does not survive concatenation.
//
// Every figure passed in is ALREADY formatted (money, percent, date) by the
// document's own formatters, so a French page says "15 %" and "148,50 $".
//
// The sentences are careful about one thing above all: the plan is billed PER
// VISIT, separately from the quote's one-time total. A client who thought
// ticking a $1,499/year plan added $1,499 to today's total — or who thought the
// quote total already covered a year of visits — was told something untrue.

const COPY = {
  en: {
    heading: "Maintenance plan",
    headingMany: "Maintenance plans",
    includedBadge: "Included",
    optionalBadge: "Optional",
    includedHint: "Approving this quote also starts this plan. Each visit is billed on its own, separately from the quote total.",
    optionalHint: "Tick to add a plan. Each visit is billed on its own, separately from the quote total.",
    chosenHint: "Part of what you approved. Each visit is billed on its own.",
    perVisit: (price) => `${price} per visit`,
    discountEvery: (pct) => `${pct} off every visit`,
    youSave: (amount) => `You save ${amount} on every visit`,
    plusTax: (pct) => `plus ${pct} tax`,
    freq: {
      weekly: "Every week",
      monthly: "Every month",
      quarterly: "Every 3 months",
      semiannual: "Twice a year",
      annual: "Once a year",
    },
    visits: (n) => (n === 1 ? "1 visit" : `${n} visits`),
    untilCancelled: "Until you cancel",
    worksOut: (monthly, yearly) => `Works out to ${monthly} a month · ${yearly} a year`,
    termTotal: (n, total) => `${n === 1 ? "1 visit" : `${n} visits`}, ${total} in total`,
    firstVisitOn: (date) => `First visit: ${date}`,
    firstVisitAfter: {
      weekly: "First visit one week after you approve",
      monthly: "First visit one month after you approve",
      quarterly: "First visit three months after you approve",
      semiannual: "First visit six months after you approve",
      annual: "First visit one year after you approve",
    },
    whatsIncluded: "What's included",
    notInTotal: "Not part of the quote total — billed per visit.",
    invoiceNote: (pct, saved) => `Maintenance plan: ${pct} off every visit — ${saved} saved on this visit.`,
  },
  fr: {
    heading: "Forfait d'entretien",
    headingMany: "Forfaits d'entretien",
    includedBadge: "Inclus",
    optionalBadge: "Facultatif",
    includedHint: "Approuver cette soumission démarre aussi ce forfait. Chaque visite est facturée à part, en dehors du total de la soumission.",
    optionalHint: "Cochez pour ajouter un forfait. Chaque visite est facturée à part, en dehors du total de la soumission.",
    chosenHint: "Fait partie de ce que vous avez approuvé. Chaque visite est facturée à part.",
    perVisit: (price) => `${price} par visite`,
    discountEvery: (pct) => `${pct} de rabais sur chaque visite`,
    youSave: (amount) => `Vous économisez ${amount} à chaque visite`,
    plusTax: (pct) => `plus ${pct} de taxes`,
    freq: {
      weekly: "Chaque semaine",
      monthly: "Chaque mois",
      quarterly: "Tous les 3 mois",
      semiannual: "Deux fois par année",
      annual: "Une fois par année",
    },
    visits: (n) => (n === 1 ? "1 visite" : `${n} visites`),
    untilCancelled: "Jusqu'à ce que vous l'annuliez",
    worksOut: (monthly, yearly) => `Revient à ${monthly} par mois · ${yearly} par année`,
    termTotal: (n, total) => `${n === 1 ? "1 visite" : `${n} visites`}, ${total} au total`,
    firstVisitOn: (date) => `Première visite : ${date}`,
    firstVisitAfter: {
      weekly: "Première visite une semaine après votre approbation",
      monthly: "Première visite un mois après votre approbation",
      quarterly: "Première visite trois mois après votre approbation",
      semiannual: "Première visite six mois après votre approbation",
      annual: "Première visite un an après votre approbation",
    },
    whatsIncluded: "Ce qui est inclus",
    notInTotal: "Ne fait pas partie du total de la soumission — facturé à chaque visite.",
    invoiceNote: (pct, saved) => `Forfait d'entretien : ${pct} de rabais sur chaque visite — ${saved} économisés sur cette visite.`,
  },
  es: {
    heading: "Plan de mantenimiento",
    headingMany: "Planes de mantenimiento",
    includedBadge: "Incluido",
    optionalBadge: "Opcional",
    includedHint: "Al aprobar esta cotización también comienza este plan. Cada visita se factura por separado, aparte del total de la cotización.",
    optionalHint: "Marque para añadir un plan. Cada visita se factura por separado, aparte del total de la cotización.",
    chosenHint: "Forma parte de lo que aprobó. Cada visita se factura por separado.",
    perVisit: (price) => `${price} por visita`,
    discountEvery: (pct) => `${pct} de descuento en cada visita`,
    youSave: (amount) => `Ahorra ${amount} en cada visita`,
    plusTax: (pct) => `más ${pct} de impuestos`,
    freq: {
      weekly: "Cada semana",
      monthly: "Cada mes",
      quarterly: "Cada 3 meses",
      semiannual: "Dos veces al año",
      annual: "Una vez al año",
    },
    visits: (n) => (n === 1 ? "1 visita" : `${n} visitas`),
    untilCancelled: "Hasta que lo cancele",
    worksOut: (monthly, yearly) => `Equivale a ${monthly} al mes · ${yearly} al año`,
    termTotal: (n, total) => `${n === 1 ? "1 visita" : `${n} visitas`}, ${total} en total`,
    firstVisitOn: (date) => `Primera visita: ${date}`,
    firstVisitAfter: {
      weekly: "Primera visita una semana después de su aprobación",
      monthly: "Primera visita un mes después de su aprobación",
      quarterly: "Primera visita tres meses después de su aprobación",
      semiannual: "Primera visita seis meses después de su aprobación",
      annual: "Primera visita un año después de su aprobación",
    },
    whatsIncluded: "Qué incluye",
    notInTotal: "No forma parte del total de la cotización — se factura por visita.",
    invoiceNote: (pct, saved) => `Plan de mantenimiento: ${pct} de descuento en cada visita — ${saved} ahorrados en esta visita.`,
  },
  it: {
    heading: "Piano di manutenzione",
    headingMany: "Piani di manutenzione",
    includedBadge: "Incluso",
    optionalBadge: "Facoltativo",
    includedHint: "Approvando questo preventivo si avvia anche questo piano. Ogni visita viene fatturata a parte, fuori dal totale del preventivo.",
    optionalHint: "Spunti per aggiungere un piano. Ogni visita viene fatturata a parte, fuori dal totale del preventivo.",
    chosenHint: "Fa parte di ciò che ha approvato. Ogni visita viene fatturata a parte.",
    perVisit: (price) => `${price} a visita`,
    discountEvery: (pct) => `${pct} di sconto su ogni visita`,
    youSave: (amount) => `Risparmia ${amount} su ogni visita`,
    plusTax: (pct) => `più ${pct} di imposte`,
    freq: {
      weekly: "Ogni settimana",
      monthly: "Ogni mese",
      quarterly: "Ogni 3 mesi",
      semiannual: "Due volte l'anno",
      annual: "Una volta l'anno",
    },
    visits: (n) => (n === 1 ? "1 visita" : `${n} visite`),
    untilCancelled: "Finché non lo disdice",
    worksOut: (monthly, yearly) => `Equivale a ${monthly} al mese · ${yearly} all'anno`,
    termTotal: (n, total) => `${n === 1 ? "1 visita" : `${n} visite`}, ${total} in totale`,
    firstVisitOn: (date) => `Prima visita: ${date}`,
    firstVisitAfter: {
      weekly: "Prima visita una settimana dopo la sua approvazione",
      monthly: "Prima visita un mese dopo la sua approvazione",
      quarterly: "Prima visita tre mesi dopo la sua approvazione",
      semiannual: "Prima visita sei mesi dopo la sua approvazione",
      annual: "Prima visita un anno dopo la sua approvazione",
    },
    whatsIncluded: "Cosa comprende",
    notInTotal: "Non fa parte del totale del preventivo — fatturato a ogni visita.",
    invoiceNote: (pct, saved) => `Piano di manutenzione: ${pct} di sconto su ogni visita — ${saved} risparmiati su questa visita.`,
  },
  de: {
    heading: "Wartungsplan",
    headingMany: "Wartungspläne",
    includedBadge: "Inklusive",
    optionalBadge: "Optional",
    includedHint: "Mit der Freigabe dieses Angebots beginnt auch dieser Plan. Jeder Termin wird einzeln abgerechnet, getrennt von der Angebotssumme.",
    optionalHint: "Zum Hinzufügen eines Plans ankreuzen. Jeder Termin wird einzeln abgerechnet, getrennt von der Angebotssumme.",
    chosenHint: "Teil dessen, was Sie freigegeben haben. Jeder Termin wird einzeln abgerechnet.",
    perVisit: (price) => `${price} pro Termin`,
    discountEvery: (pct) => `${pct} Rabatt auf jeden Termin`,
    youSave: (amount) => `Sie sparen ${amount} bei jedem Termin`,
    plusTax: (pct) => `zzgl. ${pct} Steuer`,
    freq: {
      weekly: "Jede Woche",
      monthly: "Jeden Monat",
      quarterly: "Alle 3 Monate",
      semiannual: "Zweimal im Jahr",
      annual: "Einmal im Jahr",
    },
    visits: (n) => (n === 1 ? "1 Termin" : `${n} Termine`),
    untilCancelled: "Bis Sie kündigen",
    worksOut: (monthly, yearly) => `Entspricht ${monthly} pro Monat · ${yearly} pro Jahr`,
    termTotal: (n, total) => `${n === 1 ? "1 Termin" : `${n} Termine`}, insgesamt ${total}`,
    firstVisitOn: (date) => `Erster Termin: ${date}`,
    firstVisitAfter: {
      weekly: "Erster Termin eine Woche nach Ihrer Freigabe",
      monthly: "Erster Termin einen Monat nach Ihrer Freigabe",
      quarterly: "Erster Termin drei Monate nach Ihrer Freigabe",
      semiannual: "Erster Termin sechs Monate nach Ihrer Freigabe",
      annual: "Erster Termin ein Jahr nach Ihrer Freigabe",
    },
    whatsIncluded: "Was enthalten ist",
    notInTotal: "Nicht Teil der Angebotssumme — wird pro Termin abgerechnet.",
    invoiceNote: (pct, saved) => `Wartungsplan: ${pct} Rabatt auf jeden Termin — ${saved} bei diesem Termin gespart.`,
  },
  uk: {
    heading: "План обслуговування",
    headingMany: "Плани обслуговування",
    includedBadge: "Включено",
    optionalBadge: "За бажанням",
    includedHint: "Схвалюючи цей кошторис, ви також запускаєте цей план. Кожен візит оплачується окремо, поза загальною сумою кошторису.",
    optionalHint: "Позначте, щоб додати план. Кожен візит оплачується окремо, поза загальною сумою кошторису.",
    chosenHint: "Входить до того, що ви схвалили. Кожен візит оплачується окремо.",
    perVisit: (price) => `${price} за візит`,
    discountEvery: (pct) => `Знижка ${pct} на кожен візит`,
    youSave: (amount) => `Ви заощаджуєте ${amount} на кожному візиті`,
    plusTax: (pct) => `плюс податок ${pct}`,
    freq: {
      weekly: "Щотижня",
      monthly: "Щомісяця",
      quarterly: "Кожні 3 місяці",
      semiannual: "Двічі на рік",
      annual: "Раз на рік",
    },
    visits: (n) => {
      const m10 = n % 10;
      const m100 = n % 100;
      if (m10 === 1 && m100 !== 11) return `${n} візит`;
      if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return `${n} візити`;
      return `${n} візитів`;
    },
    untilCancelled: "Доки ви не скасуєте",
    worksOut: (monthly, yearly) => `Це ${monthly} на місяць · ${yearly} на рік`,
    termTotal: (n, total) => `${COPY.uk.visits(n)}, разом ${total}`,
    firstVisitOn: (date) => `Перший візит: ${date}`,
    firstVisitAfter: {
      weekly: "Перший візит через тиждень після вашого схвалення",
      monthly: "Перший візит через місяць після вашого схвалення",
      quarterly: "Перший візит через три місяці після вашого схвалення",
      semiannual: "Перший візит через шість місяців після вашого схвалення",
      annual: "Перший візит через рік після вашого схвалення",
    },
    whatsIncluded: "Що входить",
    notInTotal: "Не входить до суми кошторису — оплачується за кожен візит.",
    invoiceNote: (pct, saved) => `План обслуговування: знижка ${pct} на кожен візит — на цьому візиті заощаджено ${saved}.`,
  },
  pa: {
    heading: "ਰੱਖ-ਰਖਾਅ ਯੋਜਨਾ",
    headingMany: "ਰੱਖ-ਰਖਾਅ ਯੋਜਨਾਵਾਂ",
    includedBadge: "ਸ਼ਾਮਲ",
    optionalBadge: "ਵਿਕਲਪਿਕ",
    includedHint: "ਇਸ ਕੋਟੇਸ਼ਨ ਨੂੰ ਮਨਜ਼ੂਰ ਕਰਨ ਨਾਲ ਇਹ ਯੋਜਨਾ ਵੀ ਸ਼ੁਰੂ ਹੋ ਜਾਂਦੀ ਹੈ। ਹਰ ਫੇਰੀ ਦਾ ਬਿੱਲ ਵੱਖਰਾ ਬਣਦਾ ਹੈ, ਕੋਟੇਸ਼ਨ ਦੇ ਕੁੱਲ ਤੋਂ ਅਲੱਗ।",
    optionalHint: "ਯੋਜਨਾ ਜੋੜਨ ਲਈ ਨਿਸ਼ਾਨ ਲਗਾਓ। ਹਰ ਫੇਰੀ ਦਾ ਬਿੱਲ ਵੱਖਰਾ ਬਣਦਾ ਹੈ, ਕੋਟੇਸ਼ਨ ਦੇ ਕੁੱਲ ਤੋਂ ਅਲੱਗ।",
    chosenHint: "ਤੁਹਾਡੀ ਮਨਜ਼ੂਰੀ ਦਾ ਹਿੱਸਾ। ਹਰ ਫੇਰੀ ਦਾ ਬਿੱਲ ਵੱਖਰਾ ਬਣਦਾ ਹੈ।",
    perVisit: (price) => `${price} ਪ੍ਰਤੀ ਫੇਰੀ`,
    discountEvery: (pct) => `ਹਰ ਫੇਰੀ 'ਤੇ ${pct} ਛੋਟ`,
    youSave: (amount) => `ਤੁਸੀਂ ਹਰ ਫੇਰੀ 'ਤੇ ${amount} ਬਚਾਉਂਦੇ ਹੋ`,
    plusTax: (pct) => `ਨਾਲ ${pct} ਟੈਕਸ`,
    freq: {
      weekly: "ਹਰ ਹਫ਼ਤੇ",
      monthly: "ਹਰ ਮਹੀਨੇ",
      quarterly: "ਹਰ 3 ਮਹੀਨੇ",
      semiannual: "ਸਾਲ ਵਿੱਚ ਦੋ ਵਾਰ",
      annual: "ਸਾਲ ਵਿੱਚ ਇੱਕ ਵਾਰ",
    },
    visits: (n) => (n === 1 ? "1 ਫੇਰੀ" : `${n} ਫੇਰੀਆਂ`),
    untilCancelled: "ਜਦੋਂ ਤੱਕ ਤੁਸੀਂ ਰੱਦ ਨਾ ਕਰੋ",
    worksOut: (monthly, yearly) => `ਇਹ ${monthly} ਪ੍ਰਤੀ ਮਹੀਨਾ · ${yearly} ਪ੍ਰਤੀ ਸਾਲ ਬਣਦਾ ਹੈ`,
    termTotal: (n, total) => `${n === 1 ? "1 ਫੇਰੀ" : `${n} ਫੇਰੀਆਂ`}, ਕੁੱਲ ${total}`,
    firstVisitOn: (date) => `ਪਹਿਲੀ ਫੇਰੀ: ${date}`,
    firstVisitAfter: {
      weekly: "ਤੁਹਾਡੀ ਮਨਜ਼ੂਰੀ ਤੋਂ ਇੱਕ ਹਫ਼ਤੇ ਬਾਅਦ ਪਹਿਲੀ ਫੇਰੀ",
      monthly: "ਤੁਹਾਡੀ ਮਨਜ਼ੂਰੀ ਤੋਂ ਇੱਕ ਮਹੀਨੇ ਬਾਅਦ ਪਹਿਲੀ ਫੇਰੀ",
      quarterly: "ਤੁਹਾਡੀ ਮਨਜ਼ੂਰੀ ਤੋਂ ਤਿੰਨ ਮਹੀਨੇ ਬਾਅਦ ਪਹਿਲੀ ਫੇਰੀ",
      semiannual: "ਤੁਹਾਡੀ ਮਨਜ਼ੂਰੀ ਤੋਂ ਛੇ ਮਹੀਨੇ ਬਾਅਦ ਪਹਿਲੀ ਫੇਰੀ",
      annual: "ਤੁਹਾਡੀ ਮਨਜ਼ੂਰੀ ਤੋਂ ਇੱਕ ਸਾਲ ਬਾਅਦ ਪਹਿਲੀ ਫੇਰੀ",
    },
    whatsIncluded: "ਕੀ ਸ਼ਾਮਲ ਹੈ",
    notInTotal: "ਕੋਟੇਸ਼ਨ ਦੇ ਕੁੱਲ ਦਾ ਹਿੱਸਾ ਨਹੀਂ — ਹਰ ਫੇਰੀ ਦਾ ਬਿੱਲ ਵੱਖਰਾ।",
    invoiceNote: (pct, saved) => `ਰੱਖ-ਰਖਾਅ ਯੋਜਨਾ: ਹਰ ਫੇਰੀ 'ਤੇ ${pct} ਛੋਟ — ਇਸ ਫੇਰੀ 'ਤੇ ${saved} ਦੀ ਬਚਤ।`,
  },
  tl: {
    heading: "Plano sa pagmementena",
    headingMany: "Mga plano sa pagmementena",
    includedBadge: "Kasama",
    optionalBadge: "Opsyonal",
    includedHint: "Kapag inaprubahan ninyo ang quote na ito, magsisimula rin ang planong ito. Hiwalay na sinisingil ang bawat bisita, labas sa kabuuan ng quote.",
    optionalHint: "Lagyan ng tsek para idagdag ang plano. Hiwalay na sinisingil ang bawat bisita, labas sa kabuuan ng quote.",
    chosenHint: "Bahagi ng inaprubahan ninyo. Hiwalay na sinisingil ang bawat bisita.",
    perVisit: (price) => `${price} bawat bisita`,
    discountEvery: (pct) => `${pct} bawas sa bawat bisita`,
    youSave: (amount) => `Makakatipid kayo ng ${amount} sa bawat bisita`,
    plusTax: (pct) => `dagdag na ${pct} buwis`,
    freq: {
      weekly: "Linggo-linggo",
      monthly: "Buwan-buwan",
      quarterly: "Kada 3 buwan",
      semiannual: "Dalawang beses sa isang taon",
      annual: "Isang beses sa isang taon",
    },
    visits: (n) => `${n} bisita`,
    untilCancelled: "Hanggang kanselahin ninyo",
    worksOut: (monthly, yearly) => `Katumbas ng ${monthly} kada buwan · ${yearly} kada taon`,
    termTotal: (n, total) => `${n} bisita, ${total} lahat-lahat`,
    firstVisitOn: (date) => `Unang bisita: ${date}`,
    firstVisitAfter: {
      weekly: "Unang bisita isang linggo matapos ninyong aprubahan",
      monthly: "Unang bisita isang buwan matapos ninyong aprubahan",
      quarterly: "Unang bisita tatlong buwan matapos ninyong aprubahan",
      semiannual: "Unang bisita anim na buwan matapos ninyong aprubahan",
      annual: "Unang bisita isang taon matapos ninyong aprubahan",
    },
    whatsIncluded: "Ano ang kasama",
    notInTotal: "Hindi bahagi ng kabuuan ng quote — sinisingil kada bisita.",
    invoiceNote: (pct, saved) => `Plano sa pagmementena: ${pct} bawas sa bawat bisita — ${saved} ang natipid sa bisitang ito.`,
  },
};

/** The copy for one document language, falling back whole to English. */
export function planOfferCopy(language = "en") {
  return COPY[language] || COPY.en;
}

/** The raw table, for the completeness check. */
export const PLAN_OFFER_COPY = COPY;

/**
 * Format a percentage the way the document's locale writes it — "15 %" in
 * French, "15%" in English. Falls back to the bare number and a sign.
 */
export function formatPlanPercent(pct, locale) {
  const n = Number(pct);
  if (!Number.isFinite(n)) return "";
  try {
    return new Intl.NumberFormat(locale || "en-CA", { style: "percent", maximumFractionDigits: 2 }).format(n / 100);
  } catch {
    return `${n}%`;
  }
}
