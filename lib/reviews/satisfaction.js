// lib/reviews/satisfaction.js
//
// The one-question satisfaction survey: "how did we do, 1 to 5" plus an
// optional comment. Pure — no `@/lib/db`, no `next/server`, no Node built-ins
// — for the same reason lib/reviews/request.js and lib/reviews/testimonials.js
// are pure: the interesting failures here are shape failures (a score of 0, a
// score of "3", a comment somebody pasted a novel into) and every one of them
// can be provoked in a throwaway script without a database or a running app.
//
// This file is ALSO imported by app/survey/[token]/SurveyForm.js, a "use
// client" component — which is the other reason it stays free of Node
// built-ins (`crypto`, `next/headers`), not just testability. Those live in
// lib/reviews/satisfactionTokens.js instead, a server-only sibling.
//
// ── Why a score, not a thumbs-up/down or an NPS 0–10 ────────────────────────
//
// AGENTS.md's ask was explicit: "a homeowner will answer one question, not
// ten." A 1–5 scale is the shortest scale that still distinguishes "fine" from
// "great" — a binary loses the customer who is satisfied but not delighted,
// and a 0–10 NPS scale asks someone standing in their kitchen to make an
// eleven-way distinction they don't actually hold in their head. Five taps,
// one glance, done.
//
// ── Why the comment is separate from the score, and optional ───────────────
//
// The score alone is what makes the KPI computable at all — see
// lib/analytics/kpis.js's buildCsat(). The comment is never required and never
// blocks the score from being recorded: a client who taps "2" and closes the
// tab has still told the contractor something real, and demanding a paragraph
// first is exactly the "ten questions" failure this file exists to avoid.

export const MIN_SCORE = 1;
export const MAX_SCORE = 5;

// Long enough for a real sentence or two, short enough that a client pasting
// in a wall of text gets it trimmed rather than the row silently storing an
// unbounded blob. Matches the order of magnitude lib/reviews/testimonials.js
// uses for a pasted review (MAX_QUOTE = 4096) — this is shorter because it is
// typed on a phone in reply to one question, not copied from somewhere else.
export const MAX_COMMENT = 2000;

/**
 * Turn whatever arrived — a querystring value, a JSON body field, anything —
 * into a valid score or null. Deliberately strict: a whole number 1–5, and
 * nothing else. `Number("3.5")` is finite and would sail past a looser check;
 * `Number.isInteger` is what actually rejects it.
 *
 * A string has to look like a plain decimal integer BEFORE it's handed to
 * `Number()` — that constructor happily parses `"0x3"` as 3 (JS's hex-literal
 * rule) and `"1e1"` as 10, and either would let a URL like
 * `?score=0x3` slip through a Number.isInteger() check that only runs
 * afterward. Found by throwing "0x3" at this function directly, not by
 * reading the code — see the header note on hostile-input execution.
 *
 * Returns null for: 0, 6, -1, null, undefined, "", "abc", "3.5", "0x3",
 * "1e1", NaN, Infinity, an object, an array. There is no "clamp to range"
 * here — a score of 0 or 6 is not a rounding error to be forgiven, it's a
 * client the API lied to about the scale, or a bot, and either way the
 * honest answer is "reject", not "guess what they meant."
 */
export function parseScore(raw) {
  if (raw === null || raw === undefined || raw === "") return null;

  let n;
  if (typeof raw === "number") {
    n = raw;
  } else {
    const trimmed = String(raw).trim();
    if (!/^[+-]?\d+$/.test(trimmed)) return null;
    n = Number(trimmed);
  }

  if (!Number.isFinite(n) || !Number.isInteger(n)) return null;
  if (n < MIN_SCORE || n > MAX_SCORE) return null;
  return n;
}

/**
 * Trim and cap a comment. Collapsing internal whitespace the way
 * lib/reviews/testimonials.js's tidyText does would flatten a client's own
 * paragraph breaks in what is meant to be read back by a human, not hashed
 * for dedupe — so this only trims the ends and caps the length, and leaves
 * line breaks alone.
 *
 * Returns null for blank input, never an empty string — the DB column should
 * say "nothing was said" the same way, not sometimes "" and sometimes null.
 */
export function cleanComment(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > MAX_COMMENT ? trimmed.slice(0, MAX_COMMENT).trim() : trimmed;
}

/**
 * Client-facing copy for the survey page and the rating row embedded in the
 * review-request email, in every language the client-facing catalogue covers
 * (matches lib/i18n/documentLabels.js and lib/i18n/emailCopy.js — en, fr, es,
 * uk, pa, tl). Careful, plain translations of short transactional copy, same
 * honesty limit documentLabels.js states for itself: not the work of a
 * native-speaker copywriter, and not reviewed by one.
 */
const COPY = {
  en: {
    prompt: "How did we do?",
    scale: "1 = not happy, 5 = excellent",
    commentLabel: "Anything you'd like to add? (optional)",
    commentPlaceholder: "Optional — a sentence is plenty.",
    send: "Send",
    changeAnswer: "Change your answer",
    thanks: "Thanks — that's been sent.",
    alreadyAnswered: "You've already answered this one. Thanks again for taking the time.",
    invalidLink: "This link isn't valid",
    invalidLinkBody:
      "It may have already been used, or the job it was about is no longer on file. Get in touch with the company directly if you'd still like to share feedback.",
  },
  fr: {
    prompt: "Comment avons-nous fait?",
    scale: "1 = pas satisfait, 5 = excellent",
    commentLabel: "Souhaitez-vous ajouter quelque chose? (facultatif)",
    commentPlaceholder: "Facultatif — une phrase suffit.",
    send: "Envoyer",
    changeAnswer: "Modifier votre réponse",
    thanks: "Merci — c'est envoyé.",
    alreadyAnswered: "Vous avez déjà répondu. Merci encore d'avoir pris le temps.",
    invalidLink: "Ce lien n'est pas valide",
    invalidLinkBody:
      "Il a peut-être déjà été utilisé, ou le chantier concerné n'est plus au dossier. Contactez l'entreprise directement si vous souhaitez tout de même partager vos commentaires.",
  },
  es: {
    prompt: "¿Cómo lo hicimos?",
    scale: "1 = insatisfecho, 5 = excelente",
    commentLabel: "¿Quiere añadir algo? (opcional)",
    commentPlaceholder: "Opcional — con una frase basta.",
    send: "Enviar",
    changeAnswer: "Cambiar su respuesta",
    thanks: "Gracias — ya se envió.",
    alreadyAnswered: "Ya respondió a esto. Gracias de nuevo por su tiempo.",
    invalidLink: "Este enlace no es válido",
    invalidLinkBody:
      "Puede que ya se haya usado, o que el trabajo al que se refería ya no esté registrado. Póngase en contacto con la empresa directamente si aún desea compartir sus comentarios.",
  },
  uk: {
    prompt: "Як ми впорались?",
    scale: "1 = незадоволені, 5 = відмінно",
    commentLabel: "Хочете щось додати? (необов’язково)",
    commentPlaceholder: "Необов’язково — досить одного речення.",
    send: "Надіслати",
    changeAnswer: "Змінити відповідь",
    thanks: "Дякуємо — надіслано.",
    alreadyAnswered: "Ви вже відповіли на це. Ще раз дякуємо за ваш час.",
    invalidLink: "Це посилання недійсне",
    invalidLinkBody:
      "Можливо, воно вже було використане, або роботи, про які йдеться, більше немає в записах. Зв’яжіться з компанією напряму, якщо все ще хочете поділитися відгуком.",
  },
  pa: {
    prompt: "ਅਸੀਂ ਕਿਵੇਂ ਕੀਤਾ?",
    scale: "1 = ਖੁਸ਼ ਨਹੀਂ, 5 = ਸ਼ਾਨਦਾਰ",
    commentLabel: "ਕੁਝ ਹੋਰ ਜੋੜਨਾ ਚਾਹੁੰਦੇ ਹੋ? (ਵਿਕਲਪਿਕ)",
    commentPlaceholder: "ਵਿਕਲਪਿਕ — ਇੱਕ ਵਾਕ ਕਾਫ਼ੀ ਹੈ।",
    send: "ਭੇਜੋ",
    changeAnswer: "ਆਪਣਾ ਜਵਾਬ ਬਦਲੋ",
    thanks: "ਧੰਨਵਾਦ — ਭੇਜ ਦਿੱਤਾ ਗਿਆ।",
    alreadyAnswered: "ਤੁਸੀਂ ਪਹਿਲਾਂ ਹੀ ਇਸਦਾ ਜਵਾਬ ਦੇ ਚੁੱਕੇ ਹੋ। ਸਮਾਂ ਦੇਣ ਲਈ ਦੁਬਾਰਾ ਧੰਨਵਾਦ।",
    invalidLink: "ਇਹ ਲਿੰਕ ਵੈਧ ਨਹੀਂ ਹੈ",
    invalidLinkBody:
      "ਇਹ ਪਹਿਲਾਂ ਹੀ ਵਰਤਿਆ ਜਾ ਚੁੱਕਾ ਹੋ ਸਕਦਾ ਹੈ, ਜਾਂ ਸਬੰਧਤ ਕੰਮ ਹੁਣ ਰਿਕਾਰਡ ਵਿੱਚ ਨਹੀਂ ਹੈ। ਜੇ ਤੁਸੀਂ ਫਿਰ ਵੀ ਆਪਣੀ ਰਾਏ ਦੇਣੀ ਚਾਹੁੰਦੇ ਹੋ ਤਾਂ ਕੰਪਨੀ ਨਾਲ ਸਿੱਧਾ ਸੰਪਰਕ ਕਰੋ।",
  },
  tl: {
    prompt: "Kumusta ang aming trabaho?",
    scale: "1 = hindi nasiyahan, 5 = napakahusay",
    commentLabel: "May gusto ka bang idagdag? (opsyonal)",
    commentPlaceholder: "Opsyonal — sapat na ang isang pangungusap.",
    send: "Ipadala",
    changeAnswer: "Baguhin ang iyong sagot",
    thanks: "Salamat — naipadala na.",
    alreadyAnswered: "Nasagot mo na ito. Salamat ulit sa oras mo.",
    invalidLink: "Hindi wasto ang link na ito",
    invalidLinkBody:
      "Maaaring nagamit na ito, o wala nang record ang trabahong tinutukoy nito. Makipag-ugnayan nang direkta sa kompanya kung gusto mo pa ring magbahagi ng feedback.",
  },
};

export function surveyCopy(language) {
  return COPY[language] || COPY.en;
}

export const SUPPORTED_SURVEY_LANGUAGES = Object.keys(COPY);
