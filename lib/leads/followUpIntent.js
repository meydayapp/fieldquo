// lib/leads/followUpIntent.js
//
// "I'll be out next week… I'll get in touch when I'm back" → a date to follow
// up on. Pure, free, no model.
//
// ══ Why (owner, 2026-10-05) ════════════════════════════════════════════════
//
// Tony Tohme typed his counts, his address and his phone, then on July 19:
// "I'll be out next week… I'll get in touch when I'm back". Nobody followed up
// until October 5. He did not say no; he said later, and later was nobody's
// job. A homeowner who says they are away is telling the contractor WHEN to
// call — this turns that into a dated task with a notification on the day.
//
// ══ What counts, and the date it means ═════════════════════════════════════
//
// A message from the PERSON (inbound) that says they are away or will come
// back to it: "out of town", "on vacation", "I'll get in touch", "I'll reach
// out", "when I'm back", "get back to you", "in 3 weeks", "after the 17th of
// October", "until Monday" — in English, French and Spanish. The date is read
// from the same message, relative to when it was SENT (not to now — a history
// message from July means late July):
//
//   "in 3 weeks" / "in 10 days" / "in a couple of weeks"   sent + that
//   "after the 17th of October" / "after October 17"       that date
//   "until Monday" / "back on Monday"                      that weekday
//   "tomorrow"                                             sent + 1 day
//   "next week"                                            sent + 7 days
//   "next month"                                           sent + 1 month
//   anything vague ("when I'm back")                       sent + DEFAULT_DAYS
//
// A date in the past is still returned — the caller decides: a follow-up
// nobody did is overdue, not void (Tony's was due July 26).

import { flatten } from "@/lib/messaging/conversationSignals";

/** "When I'm back", with no date: a week, the owner's default. */
export const DEFAULT_DAYS = 7;

const DAY = 24 * 60 * 60 * 1000;

const AWAY_PHRASES = [
  "out of town", "out of the country", "im away", "i am away", "ill be away", "i will be away", "be out next week",
  "ill be out", "i will be out", "on vacation", "on holiday", "on holidays", "travelling", "traveling", "away until",
  "back next week", "when im back", "when i am back", "when i get back", "when i come back", "once im back",
  "once i am back", "once i get back", "ill get in touch", "i will get in touch", "ill be in touch",
  "i will be in touch", "ill reach out", "i will reach out", "ill contact you", "i will contact you",
  "ill get back to you", "i will get back to you", "ill let you know when", "ill message you", "ill text you",
  "ill call you", "talk later", "later this month", "not right now but", "not ready yet", "maybe later",
  "in a few weeks", "in a couple of weeks", "in a couple weeks", "in a few days", "after the holidays",
  "je suis absent", "je suis absente", "en vacances", "a mon retour", "quand je reviens", "je vous recontacte",
  "je vous reviens", "je vous contacte", "dans quelques semaines", "estoy fuera", "de vacaciones",
  "cuando regrese", "cuando vuelva", "le escribo", "me comunico", "le aviso", "en unas semanas",
];

const MONTHS = Object.freeze({
  january: 0, jan: 0, janvier: 0, enero: 0,
  february: 1, feb: 1, fevrier: 1, febrero: 1,
  march: 2, mar: 2, mars: 2, marzo: 2,
  april: 3, apr: 3, avril: 3, abril: 3,
  may: 4, mai: 4, mayo: 4,
  june: 5, jun: 5, juin: 5, junio: 5,
  july: 6, jul: 6, juillet: 6, julio: 6,
  august: 7, aug: 7, aout: 7, agosto: 7,
  september: 8, sep: 8, sept: 8, septembre: 8, septiembre: 8,
  october: 9, oct: 9, octobre: 9, octubre: 9,
  november: 10, nov: 10, novembre: 10, noviembre: 10,
  december: 11, dec: 11, decembre: 11, diciembre: 11,
});
const WEEKDAYS = Object.freeze({
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
  dimanche: 0, lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5, samedi: 6,
  domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6,
});
const SMALL = Object.freeze({ a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, couple: 2, few: 3, une: 1, un: 1, deux: 2, trois: 3, quatre: 4, una: 1, dos: 2, tres: 3, cuatro: 4 });
const UNIT_DAYS = Object.freeze({ day: 1, days: 1, jour: 1, jours: 1, dia: 1, dias: 1, week: 7, weeks: 7, semaine: 7, semaines: 7, semana: 7, semanas: 7, month: 30, months: 30, mois: 30, mes: 30, meses: 30 });

const startOfDay = (d) => {
  const x = new Date(d);
  x.setUTCHours(13, 0, 0, 0); // 9 a.m. Eastern — a due date is a day, not a moment
  return x;
};
const addDays = (d, n) => new Date(new Date(d).getTime() + n * DAY);

function amount(word) {
  if (/^\d+$/.test(word)) return Number(word);
  return SMALL[word] ?? null;
}

/**
 * The date a message names, relative to `sentAt`. Pure.
 * @returns {{ date: Date, vague: boolean, how: string } | null} — null when
 *   the message names no date at all.
 */
export function dateFromText(text, sentAt) {
  const base = new Date(sentAt || Date.now());
  if (Number.isNaN(base.getTime())) return null;
  const flat = flatten(text);

  // "in 3 weeks", "in a couple of weeks", "dans 3 semaines", "en 2 semanas"
  let m = /\s(?:in|for|dans|en|pendant|por|durante)\s(?:about\s|around\s|environ\s)?(\d{1,2}|a|an|one|two|three|four|five|six|couple|few|une|un|deux|trois|quatre|una|dos|tres|cuatro)\s(?:of\s|de\s)?(days?|weeks?|months?|jours?|semaines?|mois|dias?|semanas?|mes(?:es)?)\s/.exec(flat);
  if (m) {
    const n = amount(m[1]);
    const unit = UNIT_DAYS[m[2]];
    if (n && unit && n * unit <= 366) return { date: startOfDay(addDays(base, n * unit)), vague: false, how: "in" };
  }

  // "after the 17th of October", "after October 17", "le 17 octobre",
  // "until the 17th", "back on the 3rd", "after the 17th"
  const monthNames = Object.keys(MONTHS).join("|");
  m = new RegExp(`\\s(\\d{1,2})(?:st|nd|rd|th|er)?\\s(?:of\\s|de\\s)?(${monthNames})\\s`).exec(flat) ||
    null;
  let day = null;
  let month = null;
  if (m) {
    day = Number(m[1]);
    month = MONTHS[m[2]];
  } else {
    const r = new RegExp(`\\s(${monthNames})\\s(\\d{1,2})(?:st|nd|rd|th)?\\s`).exec(flat);
    if (r) {
      month = MONTHS[r[1]];
      day = Number(r[2]);
    } else {
      const d = /\s(?:after|until|till|til|back on|back the|on|apres le|jusquau|despues del|hasta el)\s(?:the\s)?(\d{1,2})(?:st|nd|rd|th|er)?\s/.exec(flat);
      if (d) day = Number(d[1]);
    }
  }
  if (day && day >= 1 && day <= 31) {
    const y = base.getUTCFullYear();
    let mo = month ?? base.getUTCMonth();
    let candidate = new Date(Date.UTC(y, mo, day, 13));
    // A day this month that has already passed means next month; a month
    // earlier in the year than the message means next year.
    if (candidate.getTime() < base.getTime() - DAY) {
      if (month === null) {
        mo += 1;
        candidate = new Date(Date.UTC(y, mo, day, 13));
      } else candidate = new Date(Date.UTC(y + 1, mo, day, 13));
    }
    if (candidate.getUTCDate() === day) return { date: candidate, vague: false, how: "date" };
  }

  // "until Monday", "back Monday", "on Friday", "lundi"
  const wd = new RegExp(`\\s(?:until|till|back|on|after|jusqua|apres|hasta|el|le)?\\s?(${Object.keys(WEEKDAYS).join("|")})\\s`).exec(flat);
  if (wd) {
    const target = WEEKDAYS[wd[1]];
    const now = base.getUTCDay();
    let diff = (target - now + 7) % 7;
    if (diff === 0) diff = 7;
    return { date: startOfDay(addDays(base, diff)), vague: false, how: "weekday" };
  }

  if (/\s(?:tomorrow|demain|manana)\s/.test(flat)) return { date: startOfDay(addDays(base, 1)), vague: false, how: "tomorrow" };
  if (/\s(?:next week|la semaine prochaine|la proxima semana|la semana que viene)\s/.test(flat)) {
    return { date: startOfDay(addDays(base, 7)), vague: false, how: "next_week" };
  }
  if (/\s(?:next month|le mois prochain|el proximo mes|el mes que viene)\s/.test(flat)) {
    const d = new Date(base);
    d.setUTCMonth(d.getUTCMonth() + 1);
    return { date: startOfDay(d), vague: false, how: "next_month" };
  }
  return null;
}

/**
 * Does this message say "later"? Pure.
 * @returns {{ due: Date, vague: boolean, how: string, quote: string } | null}
 */
export function followUpFromMessage(message) {
  if (!message || message.direction !== "in" || message.private) return null;
  const body = String(message.body ?? "").trim();
  if (!body) return null;
  const flat = flatten(body);
  const said = AWAY_PHRASES.find((p) => flat.includes(` ${p} `));
  const dated = dateFromText(body, message.sentAt);
  // A date alone ("on Monday") is not "later" — "can you come on Monday?" is
  // a booking. It counts only beside an away phrase, or as "in 3 weeks".
  if (!said && !(dated && dated.how === "in")) return null;
  const due = dated ? dated.date : startOfDay(addDays(message.sentAt || Date.now(), DEFAULT_DAYS));
  return {
    due,
    vague: !dated,
    how: dated ? dated.how : "default",
    quote: body.replace(/\s+/g, " ").slice(0, 200),
    messageId: message.id ?? null,
    sentAt: message.sentAt ? new Date(message.sentAt).toISOString() : null,
  };
}

/**
 * The follow-up a conversation is owed, or null. Pure.
 *
 * The NEWEST inbound message that says "later" — unless the person has
 * written again since (they came back on their own; the promise is spent).
 * An outbound reply after it does not cancel it: "ok, talk soon" is not a
 * follow-up.
 */
export function pendingFollowUp(messages = []) {
  const list = (Array.isArray(messages) ? messages : []).filter((m) => m && !m.private && m.direction === "in");
  for (let i = list.length - 1; i >= 0; i--) {
    const hit = followUpFromMessage(list[i]);
    if (hit) return i === list.length - 1 ? hit : null;
  }
  return null;
}
