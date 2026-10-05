// lib/aiEmployee/troubleshooting.js
//
// The owner's troubleshooting flow (plan Part D §D3), the parts that are
// RULES rather than prompt text:
//
//   1. A minor fix ends with the same promise every time: "If the problem
//      persists, send us another message and we'll book a call with one of
//      our techs." Appended by the RESPONDER, in the client's language, when
//      the turn logged a routine troubleshooting attempt — not left to the
//      model, for the reason roles.js gives about the disclosure line: a rule
//      the model applies is a rule it applies most of the time.
//
//   2. What was tried is RECORDED (log_troubleshooting), on the reply row's
//      toolsUsed, so the next turn knows it without depending on the
//      12-message history window.
//
//   3. When the customer comes back after an attempt, that one message is
//      answered even if the thread has hit its reply cap — once — and that
//      reply may only book a time with a tech, book the callback or fetch a
//      person (decide.js, respond.js). "Send us another message" must not be
//      answered by silence.
//
//   4. "Book a call with a tech" means a REAL time (owner, 2026-10-04): the
//      follow-up calls check_availability and offers the company's actual
//      free slots (the same computeAvailableSlots the public booking page
//      reads, so the company's booking settings and availability decide),
//      books one with book_appointment, and falls back to book_callback only
//      when nothing is free. The company can switch real times off
//      (AiEmployeeCompanySettings.bookTechSlots) and get the callback-only
//      flow — and the closing line changes with it, so it never promises a
//      time-picking that will not happen.
//
// Pure: no database. respond.js reads the rows and hands them over.

import { screenStep } from "./knowledge/firstSteps";

export const LOG_TOOL = "log_troubleshooting";

/** The tools a follow-up past the cap may use when real times are OFF. */
export const FOLLOW_UP_TOOLS = Object.freeze(["book_callback", "hand_off_to_human"]);

/** …and when they are on: the calendar first, the callback as the fallback. */
export const FOLLOW_UP_SLOT_TOOLS = Object.freeze(["check_availability", "book_appointment", "book_callback", "hand_off_to_human"]);

/** The follow-up's tools for this company. */
export function followUpTools({ slots = true } = {}) {
  return slots ? [...FOLLOW_UP_SLOT_TOOLS] : [...FOLLOW_UP_TOOLS];
}

/** How many recent reply rows are searched for a pending attempt. */
export const ATTEMPT_LOOKBACK = 20;

const CLOSE_THE_LOOP = Object.freeze({
  en: "If the problem persists, send us another message and we'll book a call with one of our techs.",
  fr: "Si le problème persiste, écrivez-nous de nouveau et nous planifierons un appel avec l'un de nos techniciens.",
  es: "Si el problema continúa, escríbanos de nuevo y programaremos una llamada con uno de nuestros técnicos.",
  uk: "Якщо проблема не зникне, напишіть нам ще раз — і ми призначимо дзвінок з одним із наших техніків.",
  pa: "ਜੇ ਸਮੱਸਿਆ ਬਣੀ ਰਹੇ, ਤਾਂ ਸਾਨੂੰ ਦੁਬਾਰਾ ਸੁਨੇਹਾ ਭੇਜੋ ਅਤੇ ਅਸੀਂ ਸਾਡੇ ਕਿਸੇ ਟੈਕਨੀਸ਼ੀਅਨ ਨਾਲ ਕਾਲ ਤੈਅ ਕਰ ਦੇਵਾਂਗੇ।",
  tl: "Kung magpatuloy ang problema, magpadala ulit sa amin ng mensahe at mag-iiskedyul kami ng tawag sa isa sa aming mga technician.",
  de: "Wenn das Problem weiterhin besteht, schreiben Sie uns einfach noch einmal, und wir vereinbaren einen Anruf mit einem unserer Techniker.",
  zh: "如果问题仍然存在，请再给我们发一条消息，我们会安排一位技术人员给您打电话。",
  it: "Se il problema persiste, scriveteci di nuovo e fisseremo una chiamata con uno dei nostri tecnici.",
});
export const CLOSE_THE_LOOP_LANGUAGES = Object.freeze(Object.keys(CLOSE_THE_LOOP));

// The same promise when the company offers REAL times (bookTechSlots, the
// default): "we'll find you a time" is what the follow-up then does.
const CLOSE_THE_LOOP_SLOTS = Object.freeze({
  en: "If the problem persists, send us another message and we'll find you a time with one of our techs.",
  fr: "Si le problème persiste, écrivez-nous de nouveau et nous vous trouverons un moment avec l'un de nos techniciens.",
  es: "Si el problema continúa, escríbanos de nuevo y le buscaremos un horario con uno de nuestros técnicos.",
  uk: "Якщо проблема не зникне, напишіть нам ще раз — і ми підберемо вам час з одним із наших техніків.",
  pa: "ਜੇ ਸਮੱਸਿਆ ਬਣੀ ਰਹੇ, ਤਾਂ ਸਾਨੂੰ ਦੁਬਾਰਾ ਸੁਨੇਹਾ ਭੇਜੋ ਅਤੇ ਅਸੀਂ ਸਾਡੇ ਕਿਸੇ ਟੈਕਨੀਸ਼ੀਅਨ ਨਾਲ ਤੁਹਾਡੇ ਲਈ ਸਮਾਂ ਲੱਭ ਦੇਵਾਂਗੇ।",
  tl: "Kung magpatuloy ang problema, magpadala ulit sa amin ng mensahe at hahanapan namin kayo ng oras kasama ang isa sa aming mga technician.",
  de: "Wenn das Problem weiterhin besteht, schreiben Sie uns einfach noch einmal, und wir finden einen Termin mit einem unserer Techniker für Sie.",
  zh: "如果问题仍然存在，请再给我们发一条消息，我们会为您安排与一位技术人员的时间。",
  it: "Se il problema persiste, scriveteci di nuovo e vi troveremo un orario con uno dei nostri tecnici.",
});

/** The line, in the client's language (English when we have no copy). */
export function closeTheLoopLine(language = "en", { slots = false } = {}) {
  const set = slots ? CLOSE_THE_LOOP_SLOTS : CLOSE_THE_LOOP;
  return set[language] || set.en;
}

const clean = (v, n) => (typeof v === "string" && v.trim() ? v.replace(/\s+/g, " ").trim().slice(0, n) : null);

/**
 * What the model logged, cleaned. equipment_id is kept only when it is one
 * of THIS client's pieces (the ids the card showed) — a model cannot attach
 * an attempt to equipment it was never shown.
 */
export function cleanTroubleshootingLog(args = {}, { equipmentIds = [] } = {}) {
  const symptom = clean(args.symptom, 300);
  if (!symptom) return null;
  // A step that needs a panel opened, a gas valve, a ladder or live
  // wiring is not recorded as given (knowledge/firstSteps.js) — it is
  // reported back so the tool can tell the model to take it out.
  const all = (Array.isArray(args.steps_given) ? args.steps_given : []).map((s) => clean(s, 200)).filter(Boolean);
  const refused = all.filter((s) => !screenStep(s).ok);
  const steps = all.filter((s) => screenStep(s).ok).slice(0, 5);
  const allowed = new Set((equipmentIds || []).map(String));
  const equipmentId = typeof args.equipment_id === "string" && allowed.has(args.equipment_id) ? args.equipment_id : null;
  return {
    symptom,
    code: clean(args.code, 40),
    brand: clean(args.brand, 60),
    model: clean(args.model, 60),
    equipmentId,
    stepsGiven: steps,
    urgency: args.urgency === "urgent" ? "urgent" : "routine",
    ...(refused.length ? { refusedSteps: refused.slice(0, 5) } : {}),
  };
}

/**
 * The attempt still waiting on the customer, from recent reply rows (newest
 * first): the latest log_troubleshooting that no later reply followed with a
 * callback or a hand-off. Null when there is none.
 */
export function pendingAttempt(replies = []) {
  for (const r of Array.isArray(replies) ? replies : []) {
    const tools = Array.isArray(r?.toolsUsed) ? r.toolsUsed : [];
    // Newest row first; within a row, the order the tools ran.
    let closed = false;
    for (let i = tools.length - 1; i >= 0; i--) {
      const t = tools[i];
      if (!t || t.ok === false) continue;
      if (t.name === "book_callback" || t.name === "hand_off_to_human" || t.name === "book_appointment") closed = true;
      if (t.name === LOG_TOOL && t.detail && !closed) return { ...t.detail, replyId: r.id || null, at: r.createdAt || null };
      if (t.name === LOG_TOOL) return null;
    }
    if (closed) return null;
  }
  return null;
}

/**
 * Should the responder append the close-the-loop line to this reply? Only
 * when this turn logged a ROUTINE attempt and did not already book a
 * callback, fetch a person or pass the thread on — then the promise is the
 * honest next step. Never twice.
 */
export function shouldCloseLoop({ tools = [], text = "", language = "en", slots = false } = {}) {
  if (!String(text || "").trim()) return false;
  const ran = (name) => tools.some((t) => t?.name === name && t?.ok !== false);
  const logged = tools.find((t) => t?.name === LOG_TOOL && t?.ok !== false && t?.detail);
  if (!logged || logged.detail.urgency !== "routine") return false;
  // Already booking, offering times, or passing it on: the promise would be
  // a step behind what just happened.
  if (["book_callback", "hand_off_to_human", "hand_off_to_employee", "book_appointment", "check_availability"].some(ran)) return false;
  return !String(text).includes(closeTheLoopLine(language, { slots }));
}

/** The text with the line on the end. */
export function withCloseTheLoop(text, language = "en", { slots = false } = {}) {
  return `${String(text || "").trim()}\n\n${closeTheLoopLine(language, { slots })}`;
}

/** One sentence for a callback note: what was tried, from the log. */
export function attemptSummary(attempt, { equipment = [] } = {}) {
  if (!attempt) return null;
  const item = attempt.equipmentId ? (equipment || []).find((e) => e.id === attempt.equipmentId) : null;
  const what = item
    ? [item.manufacturer, item.name, item.modelNumber ? `(${item.modelNumber}${item.installedOn ? `, installed ${item.installedOn}` : ""})` : null].filter(Boolean).join(" ")
    : [attempt.brand, attempt.model].filter(Boolean).join(" ");
  const code = attempt.code ? `${attempt.code} ` : "";
  const tried = attempt.stepsGiven?.length ? ` after: ${attempt.stepsGiven.join("; ")}` : "";
  return `${what ? `${what}: ` : ""}${code}${attempt.symptom} — still happening${tried}.`.slice(0, 600);
}

/** The prompt block a follow-up turn reads: what was already tried. */
export function attemptBlock(attempt, { followUpOnly = false, slots = false } = {}) {
  if (!attempt) return null;
  return [
    "WHAT WAS ALREADY TRIED ON THIS CONVERSATION",
    `Symptom: ${attempt.symptom}${attempt.code ? ` (code ${attempt.code})` : ""}${attempt.brand ? `, ${attempt.brand}` : ""}${attempt.model ? ` ${attempt.model}` : ""}.`,
    attempt.stepsGiven?.length ? `Steps given: ${attempt.stepsGiven.join("; ")}.` : "No steps were given.",
    slots
      ? "If their new message says it is still happening — in any words — book them a time with a tech NOW, without asking anything this conversation already answered: call check_availability, offer up to three of the times it returns by their labels, and when they pick one call book_appointment (mode \"call\" unless they want someone to come out). Only if it returns no times, call book_callback instead; its note is filled in from this record. If it now sounds urgent or like an emergency, that comes first."
      : "If their new message says it is still happening — in any words — call book_callback NOW, without asking anything this conversation already answered; the note is filled in from this record. If it now sounds urgent or like an emergency, that comes first.",
    followUpOnly
      ? slots
        ? "This conversation has used up its replies. This one reply may only book a time with a tech, book the callback, or hand off to a person — nothing else."
        : "This conversation has used up its replies. This one reply may only book the callback or hand off to a person — nothing else."
      : null,
  ]
    .filter(Boolean)
    .join("\n");
}
