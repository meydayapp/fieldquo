// lib/leads/qualification.js
//
// Is this conversation a lead? Four answers, each with the reason in the
// person's own terms. Pure, free and explainable first; the model only when
// the rules cannot tell.
//
// ══ Why (owner, 2026-10-05, TrueFinish Cabinets' own data) ═════════════════
//
// 599 conversations, 80 leads, 69 of them from Messenger, made by the history
// backfill. Facebook and Instagram offer tap-to-send "ice-breaker" questions,
// so a third of the threads open with the SAME first message, word for word:
// "I would like to get a Free Quote" (89 threads, 30 never said another
// thing), "What is the average cost of a kitchen cabinet refinishing?" (79,
// 43 silent). Moss Mbaya tapped "What services do you offer?" three times in
// a minute and became a warm lead. The owner: "Yes it should stop — that's
// why we allow the AI to read, so it can determine whether it is a lead or
// not", and "FB counts any click as a conversation even if accidental, but
// we should really understand how much is spent per actual conversation or
// lead. Actual conversations are more valuable."
//
// ══ The four tiers ═════════════════════════════════════════════════════════
//
//   tap_only      only platform quick-reply text, emoji, reactions, stickers,
//                 likes, a greeting with nothing after it
//   conversation  they typed their own words about something the company
//                 offers — but no detail a quote could start from yet
//   lead          a conversation with a buying signal AND at least one real
//                 detail: counts (doors, drawers, boxes, rooms, sq ft), photos,
//                 an address, a phone or email, a booking request, or a
//                 specific question about THEIR job
//   not_relevant  off-topic, a service the company does not list (the
//                 basement video a kitchen shop answered "we focus on
//                 kitchens"), spam, or "I pressed the button by mistake"
//
// Only `lead` makes a lead (lib/leads/conversationLead.js). A person's tier
// (`override`) wins over everything here and sticks; a person's "not a lead"
// mark and a deleted lead's tombstone win over even that, and are checked by
// the caller before this runs.
//
// ══ Deterministic first ════════════════════════════════════════════════════
//
//   (a) Templates. A message identical (case, spacing and punctuation
//       ignored) to the FIRST message of three or more OTHER threads of the
//       same company is a quick-reply, whatever its words — that is how a
//       company's own custom ice-breakers ("What kind of material do you
//       refinish?") are recognised without anybody listing them. Meta's
//       standard ice-breakers in English, French and Spanish are built in,
//       for the company's first few threads. The same short message sent
//       twice within REPEAT_TAP_MS is a tap too (Moss's triple tap).
//   (b) Emoji-, reaction-, sticker- and like-only messages.
//   (c) The ad marker. Meta's Conversations API writes "Louise Coburn replied
//       to an ad." into a history thread that began on an ad — on TrueFinish's
//       data it arrives as an OUTBOUND line, so every message is searched; a
//       live thread carries `adReferral`. Either one makes the origin "ad".
//       That line and Meta's other system lines ("You can call X within the
//       next 7 days.", "Facebook created this chat because…") are never read
//       as the person's typing.
//
// Then relevance: the typed words are matched against the company's OWN
// enabled services (their labels, plus a small synonym table per trade), and
// a trade noun the company does not offer ("basement", "roof") with nothing
// it does offer is not_relevant. When the rules cannot decide — somebody
// typed real words that name no service, ask no price and give no detail —
// `needsAi` is set, and the caller may run the existing conversation reader
// (lib/ai/conversationLeadExtract.js, metered) to settle it. Without the model
// such a thread is a `conversation`, marked unsure, and never a lead.

import { flatten } from "@/lib/messaging/conversationSignals";
import { freshPatterns } from "@/lib/attribution/contactPatterns";
import { normaliseAttachments } from "@/lib/messaging/attachments";
import { extractScope, hasCounts } from "@/lib/leads/scopeExtract";

export const TIERS = Object.freeze(["tap_only", "conversation", "lead", "not_relevant"]);
export const ORIGINS = Object.freeze(["ad", "organic"]);

/** A first message shared with this many OTHER threads is a quick-reply. */
export const TEMPLATE_MIN_OTHER_THREADS = 3;

/** The same short message twice inside this window is a button, not typing. */
export const REPEAT_TAP_MS = 90 * 1000;

/** The rules version — stored, so a stored verdict can be told apart from a
 *  newer rule set when the review action re-runs. */
export const RULES_VERSION = 1;

/** Text, as compared: flatten()'s shape, without the padding. NFKC first, so
 *  the "𝖨𝗆𝗉𝗈𝗋𝗍𝖺𝗇𝗍 𝖭𝗈𝗍𝗂𝖼𝖾" letters scammers use to dodge filters read as the
 *  plain letters they imitate. */
export function textKey(body) {
  return flatten(String(body ?? "").normalize("NFKC")).trim();
}

// ── (a) Meta's standard ice-breakers ─────────────────────────────────────
//
// The suggestions Facebook and Instagram offer a Page out of the box, and the
// ones its "Frequently asked questions" setup proposes, in the three
// languages the help centre is written in. A company's OWN custom questions
// are not listed here — the template rule finds them in its own threads.
export const BUILTIN_ICE_BREAKERS = Object.freeze([
  "Can I get more info?",
  "Can I get more information?",
  "Hello! Can I get more info on this?",
  "Hi! Can I get more info on this?",
  "Is anyone available to chat?",
  "Is this still available?",
  "I have a question",
  "I'm interested",
  "I am interested",
  "I'm interested in your services",
  "What services do you offer?",
  "What are your hours?",
  "Where are you located?",
  "I would like to get a free quote",
  "I'd like to get a free quote",
  "Can I get a quote?",
  "Can I get a free quote?",
  "Can I book an appointment?",
  "Can I make an appointment?",
  "How much does it cost?",
  "Tell me more",
  "Can you tell me more?",
  "Do you offer free quotes?",
  "Do you offer free estimates?",
  // French
  "Puis-je obtenir plus d'informations ?",
  "Bonjour ! Puis-je obtenir plus d'informations à ce sujet ?",
  "Quelqu'un est-il disponible pour discuter ?",
  "Est-ce toujours disponible ?",
  "J'ai une question",
  "Je suis intéressé",
  "Je suis intéressée",
  "Quels services offrez-vous ?",
  "Quels sont vos services ?",
  "J'aimerais obtenir un devis gratuit",
  "Je voudrais obtenir un devis gratuit",
  "Puis-je obtenir un devis ?",
  "Puis-je prendre rendez-vous ?",
  "Combien ça coûte ?",
  // Spanish
  "¿Puedo obtener más información?",
  "¡Hola! ¿Puedo obtener más información sobre esto?",
  "¿Hay alguien disponible para chatear?",
  "¿Sigue disponible?",
  "Tengo una pregunta",
  "Estoy interesado",
  "Estoy interesada",
  "¿Qué servicios ofrecen?",
  "Me gustaría obtener una cotización gratis",
  "Me gustaría recibir un presupuesto gratuito",
  "¿Puedo obtener una cotización?",
  "¿Puedo hacer una cita?",
  "¿Cuánto cuesta?",
]);
const ICE_BREAKER_KEYS = new Set(BUILTIN_ICE_BREAKERS.map(textKey));

/** Greetings and "are you there" — words, but nothing said. */
const GREETING_KEYS = new Set(
  [
    "hi", "hello", "hey", "hiya", "yo", "hi there", "hello there", "hey there", "good morning", "good afternoon",
    "good evening", "morning", "hi hi", "hello hello", "are you there", "anyone there", "hello are you there",
    "hi are you there", "ok", "okay", "k", "thanks", "thank you", "thx", "ty", "bonjour", "salut", "allo",
    "bonsoir", "merci", "hola", "buenas", "buenos dias", "buenas tardes", "gracias", "yes", "no", "oui", "non", "si",
  ].map(textKey),
);

/** The ad marker Meta's history API writes, in the three help languages. */
const AD_MARKER_RE = [
  /^(.{1,80}?) replied to (?:an|your) ad\.?$/i,
  /^(.{1,80}?) a répondu à (?:une|votre) publicité\.?$/i,
  /^(.{1,80}?) respondió a (?:un|tu|su) anuncio\.?$/i,
];

/**
 * Lines Meta (or Business Suite) writes INTO a thread that nobody typed:
 * calls, "Facebook created this chat because…", story mentions. Seen in
 * TrueFinish's history arriving as inbound messages.
 */
const SYSTEM_LINE_RE = [
  /^you missed a call from\b/i,
  /\bcalled you\.?$/i,
  /^missed (?:voice |video )?call\b/i,
  /^facebook created this chat because\b/i,
  /^(?:.{1,80} )?(?:replied to|mentioned you in) (?:your|their) story\.?$/i,
  /^(?:.{1,80} )?started a (?:voice |video )?call\.?$/i,
  /^the (?:voice |video )?call ended\.?$/i,
  // Meta's call-permission line: the person allowed the Page to call them.
  /^you can call .{1,80} within the next \d+ days\.?$/i,
  /^vous pouvez appeler .{1,80} durant les \d+ prochains jours\.?$/i,
  /^puedes llamar a .{1,80} (?:durante|en) los próximos \d+ días\.?$/i,
];

/** A line no person typed (an ad marker included). Pure. */
export function isSystemLine(body) {
  const text = String(body ?? "").replace(/\s+/g, " ").trim();
  if (!text || text.length > 1000) return false;
  return Boolean(adMarker(text)) || SYSTEM_LINE_RE.some((re) => re.test(text));
}

/** "Louise Coburn replied to an ad." → { name } or null. Pure. */
export function adMarker(body) {
  const text = String(body ?? "").replace(/\s+/g, " ").trim();
  if (!text || text.length > 140) return null;
  for (const re of AD_MARKER_RE) {
    const m = re.exec(text);
    if (m) return { name: m[1].trim() };
  }
  return null;
}

/** Meta's reaction / like lines as they come through the history API. */
const REACTION_RE = /^(?:reacted|a réagi|reaccionó)\b.{0,40}(?:to your message|à votre message|a tu mensaje)\.?$|^(?:liked a message|a aimé un message|le gustó un mensaje)\.?$/i;

/** Only emoji, symbols and spacing — "👍", "❤️❤️", "😂😂😂", ":)". Pure. */
export function isEmojiOnly(body) {
  const text = String(body ?? "").trim();
  if (!text) return false;
  if (REACTION_RE.test(text)) return true;
  // Letters or digits in any script mean somebody typed something.
  if (/[\p{L}\p{N}]/u.test(text)) return false;
  return true;
}

const STICKER_TYPES = new Set(["sticker"]);
const PHOTO_TYPES = new Set(["image", "video"]);

function inboundOf(messages) {
  return (Array.isArray(messages) ? messages : []).filter((m) => m && m.direction === "in" && !m.private);
}

/** The key of the first thing the PERSON sent (the ad marker skipped). */
export function firstInboundKey(messages) {
  for (const m of inboundOf(messages)) {
    if (isSystemLine(m.body)) continue;
    const k = textKey(m.body);
    if (k) return k;
  }
  return null;
}

/**
 * thread id → first key, across a company's threads → key → how many
 * threads start with it. Pure. Greetings and empty keys are not counted:
 * "hi" opens a hundred threads and is still not a button.
 */
export function countFirstKeys(firstKeys) {
  const counts = new Map();
  for (const k of firstKeys instanceof Map ? firstKeys.values() : Array.isArray(firstKeys) ? firstKeys : []) {
    if (!k || GREETING_KEYS.has(k)) continue;
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  return counts;
}

// ── Relevance: the company's own services ───────────────────────────────

// Words that sit in service labels and say nothing about the trade.
const LABEL_STOPWORDS = new Set([
  "service", "services", "and", "the", "for", "with", "installation", "install", "repair", "repairs", "supply",
  "new", "custom", "general", "residential", "commercial", "home", "work", "works", "other", "misc", "miscellaneous",
  "maintenance", "small", "large", "full", "basic", "premium", "standard", "only",
]);

// One group per trade: if ANY word of a group is in the company's services,
// the whole group is its vocabulary. Stems match a word's start (5+ letters).
export const TRADE_WORDS = Object.freeze({
  cabinets: [
    "cabinet", "cupboard", "kitchen", "vanit", "refinish", "reface", "refacing", "door", "drawer", "island", "armoire",
    "cuisine", "gabinete", "cocina", "alacena", "melamine", "thermofoil", "oak", "maple", "mdf", "handle", "knob",
    "hinge", "closet",
  ],
  painting: ["paint", "painter", "wall", "ceiling", "trim", "primer", "peinture", "pintura", "pintar"],
  staining: ["stain", "varnish", "lacquer"],
  flooring: ["floor", "hardwood", "laminate", "vinyl", "carpet", "plancher", "piso"],
  tile: ["tile", "backsplash", "grout", "ceramic", "carrelage"],
  stairs: ["stair", "staircase", "railing", "banister", "spindle", "baluster", "escalier", "escalera"],
  roofing: ["roof", "shingle", "flashing", "toiture", "techo"],
  basement: ["basement", "drywall", "framing", "sous-sol", "sotano"],
  bathroom: ["bathroom", "shower", "bathtub", "salle de bain"],
  plumbing: ["plumb", "faucet", "drain", "toilet", "pipe", "water heater", "plomberie", "plomeria"],
  electrical: ["electric", "wiring", "outlet", "breaker", "panel", "light fixture", "electricien"],
  deck: ["deck", "patio", "pergola", "terrasse"],
  fence: ["fence", "gate", "cloture", "cerca"],
  lawn: ["lawn", "grass", "mowing", "sod", "landscap", "garden", "pelouse", "jardin"],
  snow: ["snow", "plow", "plough", "deneigement", "nieve"],
  gutters: ["gutter", "eavestrough", "downspout", "goutti"],
  siding: ["siding", "cladding", "revetement"],
  windows: ["window", "fenetre", "ventana"],
  hvac: ["furnace", "hvac", "heat pump", "air condition", "ductwork", "thermopompe"],
  countertop: ["countertop", "counter", "quartz", "granite", "comptoir", "encimera"],
  cleaning: ["cleaning", "clean", "maid", "janitor", "menage", "limpieza"],
  concrete: ["concrete", "driveway", "paving", "asphalt", "interlock", "paver", "beton"],
  trees: ["tree", "stump", "prune", "pruning", "arbre", "arbol"],
  garage: ["garage door"],
  carpentry: ["carpentry", "trim work", "baseboard", "moulding", "molding", "menuiserie"],
});

function stemHit(flat, stem) {
  const s = textKey(stem);
  if (!s) return false;
  if (s.includes(" ")) return flat.includes(` ${s} `) || flat.includes(` ${s}`);
  // Whole word, or a word that STARTS with the stem when the stem is long
  // enough to mean one thing ("refinish" → "refinishing", "cabinet" →
  // "cabinets"; "door" only as itself or "doors").
  if (s.length >= 5) return new RegExp(`\\s${s}[a-z]*\\s`).test(flat);
  return new RegExp(`\\s${s}s?\\s`).test(flat);
}

/**
 * The words that mean "something this company sells". Pure.
 * @param services [{ label, key? }] — the company's ENABLED services
 * @returns {{ words: string[], groups: string[] }}
 */
export function serviceVocabulary(services = []) {
  const words = new Set();
  const groups = new Set();
  for (const s of Array.isArray(services) ? services : []) {
    if (!s) continue;
    const text = `${s.label || ""} ${String(s.key || "").replace(/_/g, " ")}`;
    const flat = ` ${textKey(text)} `;
    for (const w of flat.trim().split(" ")) {
      if (w.length >= 4 && !LABEL_STOPWORDS.has(w)) words.add(w.replace(/(ing|s)$/, ""));
    }
    for (const [group, list] of Object.entries(TRADE_WORDS)) {
      if (list.some((stem) => stemHit(flat, stem))) groups.add(group);
    }
  }
  for (const g of groups) for (const w of TRADE_WORDS[g]) words.add(w);
  return { words: [...words].filter((w) => w.length >= 3), groups: [...groups] };
}

/** The first vocabulary word the text mentions, or null. Pure. */
function mentions(flat, words) {
  for (const w of words) if (stemHit(flat, w)) return w;
  return null;
}

/** A trade noun the company does NOT offer, when nothing it does is named. */
function offServiceWord(flat, vocab) {
  for (const [group, list] of Object.entries(TRADE_WORDS)) {
    if (vocab.groups.includes(group)) continue;
    for (const w of list) {
      // Ambiguous across trades — "door" is a cabinet door or a front door,
      // "wall" is paint or drywall — so never decisive on its own.
      if (["door", "drawer", "wall", "counter", "clean", "light fixture", "panel", "gate", "garden"].includes(w)) continue;
      if (vocab.words.some((v) => stemHit(` ${textKey(w)} `, v))) continue;
      if (stemHit(flat, w)) return w;
    }
  }
  return null;
}

// ── Signals in the person's words ─────────────────────────────────────────

// The lists below were tuned on TrueFinish's 599 real threads (read-only,
// 2026-10-05): every phrase in MIS_TAP, NOT_NOW, SPAM and GENERAL_QUESTION is
// one somebody actually typed there.
const BUYING = [
  "quote", "quotes", "estimate", "estimates", "price", "prices", "pricing", "cost", "costs", "how much", "rate", "rates",
  "interested", "looking to", "looking for", "want to", "i want", "we want", "would like", "id like", "i need",
  "we need", "need to",
  "can you", "could you", "do you", "are you able", "available", "availability", "book", "booking", "appointment",
  "schedule", "come by", "come over", "come see", "come take a look", "visit", "consultation", "hire", "asap",
  "as soon as possible", "devis", "prix", "combien", "soumission", "estimation", "rendez vous", "jaimerais",
  "je voudrais", "cotizacion", "presupuesto", "precio", "cuanto", "cita", "me gustaria", "necesito",
];
// A booking request is a DETAIL only beside a word for the company's own work
// (see below): "contact us in two weeks to book an app" with nothing about a
// kitchen is somebody talking, not a job a quote can start from.
const BOOKING = [
  "come by", "come over", "come see", "come take a look", "come out", "book", "booking", "appointment", "visit",
  "site visit", "schedule", "consultation", "when can you", "are you available", "rendez vous", "cita", "visita",
];
const MIS_TAP = [
  "by mistake", "by accident", "accidentally", "accidental", "was an accident", "accidents", "pressed the button",
  "hit the button", "wrong button", "wrong icon", "wrong item", "pressed wrong", "hit wrong", "clicked wrong",
  "sent in error", "message in error", "sent by error", "wrong person", "wrong page", "wrong chat", "didnt mean to",
  "did not mean to", "i did not message you", "i didnt message you", "didnt even know i sent", "please ignore",
  "ignore this", "ignore my message", "a mistake", "was an error", "an error", "finger error", "never sent you",
  "never messaged you", "par erreur", "par accident", "mauvaise personne", "por error", "por accidente",
  "persona equivocada",
];
/** Whole messages that are a mis-tap on their own ("Mistake", "Oops"). */
const MIS_TAP_EXACT = new Set(["mistake", "error", "oops", "sorry mistake", "my mistake", "wrong", "erreur", "error mio"]);
// They typed their own words to say "not now" — a real person, a real
// conversation about the work, and not a lead.
const NOT_NOW = [
  "not now", "not at this time", "not at the moment", "not right now", "not ready", "no thank you", "no thanks",
  "no thx", "not interested", "no sorry", "im ok now", "i dont need anything", "budget is not enough",
  "budget its not enough", "maybe next year", "not quite ready", "not yet", "when im ready", "when i am ready",
  "nothing at the moment", "no thankyou", "busy right now", "pas maintenant", "pas interesse", "non merci", "no gracias",
  "no me interesa", "ahora no",
];
// Questions about the BUSINESS rather than a job — where, when, which areas.
const GENERAL_QUESTION = [
  "where are you located", "where you located", "where are you", "your location", "what are your hours",
  "do you service", "do you serve", "do you come to", "do you work in", "do you cover", "service area",
  "how long does it take", "how long does it last", "whats the difference", "what is the difference",
  "can i see examples", "examples of your work", "where is your business", "are you in", "only do jobs in",
  "do you travel", "guarantee", "warranty", "vous deplacez", "ou etes vous", "donde estan",
];
// The CONTRACTOR saying the work is not theirs. Not "we specialize in…" —
// that opens half of TrueFinish's own replies as an introduction, Moss
// Mbaya's included; a decline has a contrast in it ("we DO focus on
// kitchens", "we ONLY do", "we don't").
const DECLINE = [
  "we do focus on", "we only focus on", "we only do", "we dont do", "we do not do", "we dont offer",
  "we do not offer", "not something we do", "not a service we", "outside our", "we dont provide", "we do not provide",
  "unfortunately we only", "we dont work on", "we do not work on", "we no longer", "we only work on",
  "nous faisons seulement", "nous ne faisons pas", "on ne fait pas", "solo hacemos", "no hacemos", "no ofrecemos",
];
const SPAM = [
  "your page", "page will be", "account will be", "verify your", "verification badge", "copyright infringement",
  "community standards", "click the link", "click this link", "crypto", "bitcoin", "investment opportunity",
  "seo services", "grow your page", "more followers", "web design services", "loan offer", "meta policy",
  "policy support", "important notice", "page has been", "will be disabled", "will be restricted",
  "dear store", "my recent order",
];
// Somebody selling TO the company, or asking for a job with it.
const VENDOR = [
  "marketing and advertising", "advertising opportunity", "advertise with", "partnership opportunity",
  "are you hiring", "looking for work", "looking for a job", "job opportunity", "my resume", "my cv",
  "im an expert in", "i am an expert in", "we are a supplier", "wholesale price", "leads for your business",
];
// When they want it — part of describing THEIR job.
const WHEN = [
  "this summer", "this spring", "this fall", "this autumn", "this winter", "this week", "next week", "this month",
  "next month", "asap", "as soon as possible", "before christmas", "before the holidays", "in the spring",
  "cet ete", "le mois prochain", "este verano", "el proximo mes",
];
const POSSESSIVE = ["my", "our", "mine", "mon", "ma", "mes", "notre", "nos", "mi", "mis", "nuestra", "nuestro"];
const JOB_DESCRIPTORS = [
  "oak", "maple", "pine", "mdf", "wood", "melamine", "thermofoil", "laminate", "white", "black", "grey", "gray",
  "green", "blue", "peeling", "chipped", "damage", "damaged", "old", "dated", "yellow", "stained", "size", "sized",
  "feet", "foot", "inch", "inches", "years old", "built in", "condo", "house", "townhouse",
];

function phrase(flat, list) {
  for (const p of list) {
    const k = textKey(p);
    if (k && flat.includes(` ${k} `)) return p;
  }
  return null;
}

function clip(body, max = 140) {
  const t = String(body ?? "").replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

/**
 * Classify one message the person sent. Pure.
 * @returns {"marker"|"tap"|"emoji"|"greeting"|"empty"|"typed"}
 */
function messageKind(m, { templateCounts, ownFirstKey }) {
  const body = String(m.body ?? "");
  if (isSystemLine(body)) return "marker";
  const atts = normaliseAttachments(m.attachments);
  const key = textKey(body);
  if (!key) {
    if (atts.some((a) => STICKER_TYPES.has(a.type))) return "emoji";
    if (!body.trim() && !atts.length) return "empty";
    if (isEmojiOnly(body)) return "emoji";
    return "empty"; // media only — counted as photos by the caller
  }
  if (isEmojiOnly(body)) return "emoji";
  if (GREETING_KEYS.has(key)) return "greeting";
  if (ICE_BREAKER_KEYS.has(key)) return "tap";
  const n = templateCounts instanceof Map ? templateCounts.get(key) || 0 : 0;
  const others = n - (ownFirstKey === key ? 1 : 0);
  if (others >= TEMPLATE_MIN_OTHER_THREADS) return "tap";
  return "typed";
}

/**
 * The verdict. Pure — every input is handed in.
 *
 * @param p.messages        the thread, oldest first: { id, direction, private,
 *                          body, attachments, sentAt }
 * @param p.adReferral      MessageThread.adReferral (or null)
 * @param p.templateCounts  countFirstKeys() over the company's threads
 * @param p.services        the company's enabled services [{ id, label, key }]
 * @param p.override        a person's tier (qualification.override) — wins
 * @returns {{ tier, needsAi, unsure, origin, method, reasonKey, params, details,
 *             reason, firstKey, scope, counts }}
 */
export function classifyConversation({ messages = [], adReferral = null, templateCounts = null, services = [], override = null } = {}) {
  const all = Array.isArray(messages) ? messages.filter(Boolean) : [];
  const inbound = inboundOf(all);
  const outbound = all.filter((m) => m.direction === "out" && !m.private);
  const ownFirstKey = firstInboundKey(all);

  const markers = all.filter((m) => !m.private && adMarker(m.body));
  const origin = adReferral && (adReferral.adId || adReferral.source) ? "ad" : markers.length ? "ad" : "organic";

  // ── Each message the person sent, sorted into what it is ───────────────
  const kinds = inbound.map((m) => ({ m, kind: messageKind(m, { templateCounts, ownFirstKey }), key: textKey(m.body) }));
  // The same short message twice inside REPEAT_TAP_MS is a button — unless it
  // carries a detail, because a real "22 doors 15 drawers" sent twice by a
  // shaky thumb is still 22 doors.
  for (let i = 1; i < kinds.length; i++) {
    const a = kinds[i - 1];
    const b = kinds[i];
    if (!a.key || a.key !== b.key || b.kind !== "typed") continue;
    const dt = Math.abs(new Date(b.m.sentAt || 0).getTime() - new Date(a.m.sentAt || 0).getTime());
    if (!(dt <= REPEAT_TAP_MS)) continue;
    if (/\d/.test(b.key) || b.key.length > 80) continue;
    a.kind = a.kind === "typed" ? "tap" : a.kind;
    b.kind = "tap";
    b.repeated = true;
  }
  const typed = kinds.filter((k) => k.kind === "typed");
  const taps = kinds.filter((k) => k.kind === "tap");
  const skip = new Set(kinds.filter((k) => k.kind !== "typed").map((k) => k.m.id));

  // Photos and videos the PERSON sent (stickers are not photos).
  let photos = 0;
  for (const m of inbound) {
    for (const a of normaliseAttachments(m.attachments)) if (PHOTO_TYPES.has(a.type)) photos++;
  }

  const scope = extractScope(all, { skip });
  const flatTyped = ` ${typed.map((k) => k.key).join(" ")} `;
  const vocab = serviceVocabulary(services);
  const firstTyped = typed[0]?.m || null;

  const base = {
    origin,
    firstKey: ownFirstKey,
    rulesVersion: RULES_VERSION,
    scope,
    counts: { typed: typed.length, taps: taps.length, photos, inbound: inbound.length },
  };
  const verdict = (tier, reasonKey, params = {}, extra = {}) => ({
    tier,
    needsAi: false,
    unsure: false,
    method: "rules",
    reasonKey,
    params,
    details: [],
    ...base,
    ...extra,
  });

  // ── A person said what this is ─────────────────────────────────────────
  if (override && TIERS.includes(override.tier)) {
    return verdict(override.tier, "app.leads.tier.reason.person", { name: override.byName || "" }, { method: "person" });
  }

  // The CONTRACTOR already said this is not their work ("we do focus on
  // kitchens" to John Brown's basement video). Their reply is the most
  // reliable relevance signal there is — unless the person ALSO gave counts
  // for something the company does (checked below, once counts are known).
  const declinedBy = outbound.find((m) => phrase(` ${textKey(m.body)} `, DECLINE));

  // ── Nothing typed ──────────────────────────────────────────────────────
  if (!typed.length) {
    if (photos > 0 && declinedBy) {
      return verdict("not_relevant", "app.leads.tier.reason.declined", { quote: clip(declinedBy.body) });
    }
    if (photos > 0) {
      // Pictures and no words. Could be the kitchen, could be a thumbs-up
      // Messenger sends as an image. Not a lead on its own; a person decides.
      return verdict("conversation", "app.leads.tier.reason.mediaOnly", { count: photos }, { unsure: true });
    }
    const tap = taps[0];
    if (tap) {
      const times = taps.filter((t) => t.key === tap.key).length;
      return times > 1
        ? verdict("tap_only", "app.leads.tier.reason.tapRepeated", { quote: clip(tap.m.body), count: times })
        : verdict("tap_only", "app.leads.tier.reason.tapOnly", { quote: clip(tap.m.body) });
    }
    const greet = kinds.find((k) => k.kind === "greeting");
    if (greet) return verdict("tap_only", "app.leads.tier.reason.greetingOnly", { quote: clip(greet.m.body) });
    if (kinds.some((k) => k.kind === "emoji")) return verdict("tap_only", "app.leads.tier.reason.emojiOnly");
    return verdict("tap_only", markers.length ? "app.leads.tier.reason.adClickOnly" : "app.leads.tier.reason.nothingSaid");
  }

  // ── Typed words: what do they say? ─────────────────────────────────────
  const misTap = phrase(flatTyped, MIS_TAP) || typed.find((k) => MIS_TAP_EXACT.has(k.key));
  if (misTap) {
    const m = typed.find((k) => MIS_TAP_EXACT.has(k.key) || phrase(` ${k.key} `, MIS_TAP))?.m || firstTyped;
    return verdict("not_relevant", "app.leads.tier.reason.misTap", { quote: clip(m.body) });
  }
  const spam = phrase(flatTyped, SPAM);
  if (spam) {
    const m = typed.find((k) => phrase(` ${k.key} `, SPAM))?.m || firstTyped;
    return verdict("not_relevant", "app.leads.tier.reason.spam", { quote: clip(m.body) });
  }

  const vendor = typed.find((k) => phrase(` ${k.key} `, VENDOR));
  if (vendor) return verdict("not_relevant", "app.leads.tier.reason.vendor", { quote: clip(vendor.m.body) });

  const relevantWord = mentions(flatTyped, vocab.words);
  const buying = phrase(flatTyped, BUYING);

  if (declinedBy && !(hasCounts(scope) && relevantWord)) {
    return verdict("not_relevant", "app.leads.tier.reason.declined", { quote: clip(declinedBy.body) });
  }

  const off = vocab.words.length ? offServiceWord(flatTyped, vocab) : null;
  if (off && !relevantWord) {
    return verdict("not_relevant", "app.leads.tier.reason.offService", { word: off });
  }

  // "Not at this time, thanks" — a person, talking about the work, saying no
  // for now. A conversation; never a lead; nothing for a model to settle.
  if (!hasCounts(scope)) {
    const no = typed.find((k) => phrase(` ${k.key} `, NOT_NOW));
    if (no) return verdict("conversation", "app.leads.tier.reason.notNow", { quote: clip(no.m.body) });
  }

  // ── Details a quote can start from ─────────────────────────────────────
  const details = [];
  if (hasCounts(scope)) details.push({ key: "counts", params: { ...scope.counts } });
  if (photos > 0) details.push({ key: "photos", params: { count: photos } });
  // The patterns are global regexes (lastIndex moves on every .test), so a
  // fresh set per message — the same reason deterministicContacts does it.
  const typedBodies = typed.map((k) => String(k.m.body || ""));
  const anyBody = (pick) => typedBodies.some((b) => pick(freshPatterns()).test(b));
  if (anyBody((r) => r.address) || anyBody((r) => r.postcode)) details.push({ key: "address" });
  if (anyBody((r) => r.phone)) details.push({ key: "phone" });
  if (anyBody((r) => r.email)) details.push({ key: "email" });
  // A company that lists no services cannot be checked for relevance; its
  // threads are not held to it (an empty list is no statement — failure
  // class #5).
  const aboutTheWork = Boolean(relevantWord) || !vocab.words.length;
  if (aboutTheWork && phrase(flatTyped, BOOKING)) details.push({ key: "booking" });
  // "Can you stain MY deck THIS SUMMER?" — their own job, described: a
  // possessive, a word for the work (the company's own, or any trade's when
  // it lists none), and something about it — a material, a colour, a state,
  // a size, or when.
  const workWords = vocab.words.length ? vocab.words : Object.values(TRADE_WORDS).flat();
  const jobQuestion =
    aboutTheWork &&
    typed.some((k) => {
      const f = ` ${k.key} `;
      return (
        POSSESSIVE.some((w) => f.includes(` ${w} `)) &&
        mentions(f, workWords) &&
        (JOB_DESCRIPTORS.some((w) => f.includes(` ${textKey(w)} `)) || WHEN.some((w) => f.includes(` ${textKey(w)} `)))
      );
    });
  if (jobQuestion) details.push({ key: "jobQuestion" });

  // The sentence the reason quotes: the one with the counts, else the first
  // that names the company's work, else the first thing they typed.
  const countsQuote = hasCounts(scope) ? Object.values(scope.sources)[0]?.quote : null;
  const relevantMsg = relevantWord ? typed.find((k) => mentions(` ${k.key} `, vocab.words))?.m : null;
  const quote = clip(countsQuote || relevantMsg?.body || firstTyped.body);
  if ((relevantWord || buying) && details.length) {
    return { ...verdict("lead", "app.leads.tier.reason.lead", { quote }), details };
  }
  if (relevantWord || buying || phrase(flatTyped, GENERAL_QUESTION)) {
    return verdict("conversation", "app.leads.tier.reason.conversation", { quote });
  }
  // Their own words, about nothing the rules can place. The model decides
  // when it may run; until then this is a conversation, flagged unsure.
  return { ...verdict("conversation", "app.leads.tier.reason.unsure", { quote }, { unsure: true, needsAi: true }), details };
}

/**
 * The model's reading folded into a rules verdict that asked for it. Pure.
 *
 * @param rules  classifyConversation()
 * @param ai     lib/ai/conversationLeadExtract.js result ({ ok, kind, reason,
 *               fields: { service } })
 */
export function applyAiVerdict(rules, ai) {
  if (!rules || !ai?.ok || !rules.needsAi) return rules;
  const said = ai.reason ? String(ai.reason).slice(0, 200) : "";
  const done = (tier, extra = {}) => ({
    ...rules,
    tier,
    needsAi: false,
    unsure: false,
    method: "ai",
    reasonKey: "app.leads.tier.reason.ai",
    params: { reason: said },
    ...extra,
  });
  if (ai.kind === "spam" || ai.kind === "not_work") return done("not_relevant");
  if (ai.kind === "existing_customer_issue") return done("conversation");
  if (ai.kind === "work_request") {
    // Work the company does not list is not relevant — the model picks the
    // service from the company's own list or says none.
    if (!ai.fields?.service) return done("not_relevant");
    return rules.details?.length ? done("lead") : done("conversation");
  }
  return rules; // undetermined: stays unsure
}

/** The tier that counts: a person's, else the verdict's. Pure. */
export function effectiveTier(q) {
  if (!q || typeof q !== "object") return null;
  if (q.override && TIERS.includes(q.override.tier)) return q.override.tier;
  return TIERS.includes(q.tier) ? q.tier : null;
}

/**
 * What is stored on MessageThread.leadCapture.qualification. Pure. The
 * person's override is carried, never dropped, by every re-classification.
 */
export function storableQualification(verdict, { previous = null, at = new Date() } = {}) {
  if (!verdict) return previous || null;
  const prev = previous && typeof previous === "object" ? previous : {};
  const scope = verdict.scope || null;
  return {
    tier: verdict.method === "person" ? prev.tier || verdict.tier : verdict.tier,
    method: verdict.method === "person" ? prev.method || "rules" : verdict.method,
    unsure: Boolean(verdict.unsure),
    needsAi: Boolean(verdict.needsAi),
    origin: verdict.origin,
    reasonKey: verdict.method === "person" ? prev.reasonKey || verdict.reasonKey : verdict.reasonKey,
    params: verdict.method === "person" ? prev.params || {} : verdict.params || {},
    details: verdict.method === "person" ? prev.details || [] : verdict.details || [],
    firstKey: verdict.firstKey || null,
    counts: verdict.counts || null,
    scopeCounts: scope?.counts && Object.keys(scope.counts).length ? scope.counts : null,
    rulesVersion: RULES_VERSION,
    at: new Date(at).toISOString(),
    ...(prev.override ? { override: prev.override } : {}),
  };
}

/** A person's one-tap tier, merged in. Pure. Null tier clears it. */
export function withOverride(qualification, { tier, at = new Date(), byUserId = null, byName = null }) {
  const q = qualification && typeof qualification === "object" ? { ...qualification } : {};
  if (tier === null) {
    delete q.override;
    return q;
  }
  if (!TIERS.includes(tier)) throw new Error(`unknown tier ${tier}`);
  q.override = { tier, at: new Date(at).toISOString(), byUserId, byName };
  return q;
}

/** What a screen may see. Pure. Null when nothing has been classified. */
export function publicQualification(q) {
  if (!q || typeof q !== "object" || !effectiveTier(q)) return null;
  return {
    tier: effectiveTier(q),
    ruleTier: TIERS.includes(q.tier) ? q.tier : null,
    method: q.override ? "person" : q.method || "rules",
    unsure: q.override ? false : Boolean(q.unsure),
    origin: ORIGINS.includes(q.origin) ? q.origin : "organic",
    reasonKey: typeof q.reasonKey === "string" ? q.reasonKey : null,
    params: q.params && typeof q.params === "object" ? q.params : {},
    details: Array.isArray(q.details) ? q.details : [],
    override: q.override ? { tier: q.override.tier, at: q.override.at, byName: q.override.byName || null } : null,
    at: q.at || null,
  };
}

/** The English sentence for a verdict — logs, the activity trail, checks. */
export function reasonInEnglish(v) {
  const p = v?.params || {};
  switch (v?.reasonKey) {
    case "app.leads.tier.reason.tapOnly": return `Only tapped “${p.quote}” — never typed anything of their own.`;
    case "app.leads.tier.reason.tapRepeated": return `Tapped “${p.quote}” ${p.count} times — never typed anything of their own.`;
    case "app.leads.tier.reason.greetingOnly": return `Only said “${p.quote}” — nothing about the work.`;
    case "app.leads.tier.reason.emojiOnly": return "Only sent an emoji, a sticker or a like.";
    case "app.leads.tier.reason.adClickOnly": return "Opened the chat from your ad and sent nothing.";
    case "app.leads.tier.reason.nothingSaid": return "Sent nothing anyone could read.";
    case "app.leads.tier.reason.mediaOnly": return `Sent ${p.count} photo(s) or video(s) and no words.`;
    case "app.leads.tier.reason.misTap": return `Said it was a mistake: “${p.quote}”.`;
    case "app.leads.tier.reason.spam": return `Looks like spam: “${p.quote}”.`;
    case "app.leads.tier.reason.declined": return `You told them it isn't your work: “${p.quote}”.`;
    case "app.leads.tier.reason.offService": return `Asked about “${p.word}”, which isn't one of your services.`;
    case "app.leads.tier.reason.vendor": return `Selling to you or asking for work, not buying: “${p.quote}”.`;
    case "app.leads.tier.reason.notNow": return `Said not for now: “${p.quote}”.`;
    case "app.leads.tier.reason.lead": return `Typed their own words with details you can quote from: “${p.quote}”.`;
    case "app.leads.tier.reason.conversation": return `Typed their own words about your work, no details yet: “${p.quote}”.`;
    case "app.leads.tier.reason.unsure": return `Typed their own words; the rules can't tell if it's about your services: “${p.quote}”.`;
    case "app.leads.tier.reason.ai": return `AI read: ${p.reason}`;
    case "app.leads.tier.reason.person": return `Set by ${p.name || "a person"}.`;
    default: return "";
  }
}
