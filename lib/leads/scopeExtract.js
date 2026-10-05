// lib/leads/scopeExtract.js
//
// "22 doors + 15 drawers" out of what a homeowner typed — the scope of the
// job, each number pinned to the sentence it came from. Pure, free, no model.
//
// ══ Why (owner, 2026-10-05) ════════════════════════════════════════════════
//
// "If we have enough information, like leads from instant estimates or the
// client giving actual numbers of drawers, doors and boxes, it should create a
// quick estimate of the potential revenue from that lead." Tony, Louise and
// Gladys each typed their counts into Messenger (22 doors + 15 drawers; 23 +
// 7; 24 + 4) and the board priced all three at the company's AVERAGE won
// quote, the same figure it gave a man who tapped "What services do you
// offer?" three times. The counts were in the thread; nothing read them.
//
// ══ What is read, and what is deliberately not ═════════════════════════════
//
// Inbound, non-private messages only — an outbound "a typical kitchen is 20
// doors" is the CONTRACTOR's number, not the job's (the same rule
// deterministicContacts keeps for phone numbers). A count needs a number
// ADJACENT to its unit ("22 doors", "doors: 22", "twenty two doors"); a bare
// number is never guessed into a unit. Within ONE message the same unit is
// summed ("12 upper doors and 10 lower doors" is 22); across messages the
// LATEST mention wins, because people correct themselves ("sorry, 24 doors")
// far more often than they add a second kitchen.
//
// Colour, hardware and damage are NOTES, not numbers: the sentence that said
// it is kept so the estimator reads it in the homeowner's words. They never
// move a price (lib/leads/scopeEstimate.js reads counts only).
//
// A count above MAX_COUNT is dropped: "1000 doors" is a typo or a joke, and a
// $150,000 "potential" on the board would be worse than none.

import { flatten } from "@/lib/messaging/conversationSignals";

/** The units a scope can be counted in. Order is the display order. */
export const SCOPE_UNITS = Object.freeze(["doors", "drawers", "boxes", "pieces", "rooms", "sqft"]);

/** Beyond this a count is a typo, not a kitchen (sq ft has its own ceiling). */
export const MAX_COUNT = 400;
export const MAX_SQFT = 20000;

const NUMBER_WORDS = Object.freeze({
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50,
  // French and Spanish, the two other languages the help centre is written in.
  un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, sept: 7, huit: 8, neuf: 9, dix: 10,
  douze: 12, quinze: 15, vingt: 20, trente: 30,
  uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
  doce: 12, quince: 15, veinte: 20, treinta: 30,
});

// Unit spellings, flattened (lower-case, accents and punctuation removed —
// see conversationSignals.flatten). Each alternative is a whole word.
const UNIT_WORDS = Object.freeze({
  // "closets" and "cupboards" are doors: Tony Tohme, asked "how many doors and
  // drawers", answered "22 closets and 15 drawers" (TrueFinish, 2026-07-16).
  doors: ["doors", "door", "cabinets", "closets", "closet", "cupboards", "cupboard", "portes", "porte", "puertas", "puerta"],
  drawers: ["drawers", "drawer", "tiroirs", "tiroir", "cajones", "cajon"],
  boxes: ["boxes", "box", "cabinet boxes", "caissons", "caisson"],
  pieces: ["pieces", "piece", "pcs", "pc"],
  rooms: ["rooms", "room", "bedrooms", "bedroom"],
  sqft: ["sq ft", "sqft", "sq feet", "square feet", "square foot", "sf", "ft2", "pieds carres", "pi2", "pies cuadrados"],
});

// Words that may sit between the number and the unit without breaking the
// count: "22 kitchen cabinet doors", "15 drawer fronts", "4 upper doors".
const FILLER = "(?:(?:kitchen|cabinet|cabinets|upper|uppers|lower|lowers|base|wall|small|large|big|tall|pantry|vanity|bathroom|island|shaker|flat|slab|panel|of|the|de|des|la|las|los|du|and)\\s+){0,3}";

const NUM = "(\\d{1,5}(?:[.,]\\d+)?|[a-z]+(?:\\s[a-z]+)?)";

function wordNumber(raw) {
  const s = String(raw || "").trim();
  if (/^\d/.test(s)) {
    const n = Number(s.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  // "twenty two" / "twenty-two" (flattened to a space) / "vingt deux". In
  // "and fifteen drawers" the pattern hands over "and fifteen"; the last word
  // alone is then tried, so a count is not lost to the word before it.
  const parts = s.split(" ");
  if (parts.length === 2 && NUMBER_WORDS[parts[0]] === undefined) return wordNumber(parts[1]);
  let total = 0;
  for (const p of parts) {
    const v = NUMBER_WORDS[p];
    if (v === undefined) return null;
    total += v;
  }
  return total || null;
}

function unitPatterns(unit) {
  const words = UNIT_WORDS[unit].map((w) => w.replace(/ /g, "\\s"));
  const alt = `(?:${words.join("|")})`;
  return {
    // "22 doors", "22 kitchen cabinet doors", "twenty two doors" — on the
    // flattened text.
    before: new RegExp(`(?:^|(?<![:=])\\s)${NUM}\\s(?:x\\s)?${FILLER}${alt}(?=\\s|$)`, "g"),
    // "doors: 22", "doors = 22" — on text that still has its colons. A bare
    // "doors 22" is NOT read: in "22 doors 15 drawers" the 15 belongs to the
    // drawers, and in "7 drawers 123 Main St" the 123 is a house number.
    after: new RegExp(`(?:^|[^a-z])${alt}\\s*[:=]\\s*(\\d{1,5})(?!\\d)`, "g"),
  };
}

const PATTERNS = Object.freeze(Object.fromEntries(SCOPE_UNITS.map((u) => [u, unitPatterns(u)])));

/** The sentence `needle` sits in, from the ORIGINAL text, capped. */
function sentenceAround(body, needleWords) {
  const text = String(body ?? "").replace(/\s+/g, " ").trim();
  if (!text) return null;
  const sentences = text.split(/(?<=[.!?\n])\s+/);
  const lower = (s) => flatten(s);
  for (const s of sentences) {
    const f = lower(s);
    if (needleWords.some((w) => f.includes(` ${w} `))) return s.slice(0, 200);
  }
  return text.slice(0, 200);
}

/**
 * Counts in ONE message's text. Pure.
 * @returns {Record<string, number>} unit -> count (summed within the message)
 */
export function countsInText(text) {
  // "1,200 sq ft" must not flatten to "1 200"; "22doors" must read as "22 doors".
  const pre = String(text ?? "")
    .replace(/(\d)[,\u00a0](\d{3})(?!\d)/g, "$1$2")
    .replace(/(\d)([A-Za-z])/g, "$1 $2");
  // Lower-cased, unaccented, every character but letters, digits, ":" and
  // "=" turned into a space — flatten()'s shape with the colons kept, so
  // "doors: 24, drawers: 4" is not also read as "24 drawers".
  const flat = ` ${pre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’‘`]/g, "")
    .replace(/[^a-z0-9:=]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()} `;
  const out = {};
  for (const unit of SCOPE_UNITS) {
    const seen = new Set();
    let sum = 0;
    for (const [which, re] of Object.entries(PATTERNS[unit])) {
      const hay = flat;
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(hay)) !== null) {
        // Re-anchor after the match's leading space so adjacent counts
        // ("22 doors 15 drawers") are both found.
        re.lastIndex = m.index + Math.max(1, m[0].length - 1);
        const at = `${which}:${m.index}`;
        if (seen.has(at)) continue;
        const n = wordNumber(m[1]);
        if (n === null || n <= 0) continue;
        seen.add(at);
        sum += n;
      }
    }
    const ceiling = unit === "sqft" ? MAX_SQFT : MAX_COUNT;
    if (sum > 0 && sum <= ceiling) out[unit] = Math.round(sum);
  }
  // "boxes" also matches "cabinet boxes" inside a door count's filler — the
  // filler never contains "box", so the two cannot double-count.
  return out;
}

// ── Notes: colour, hardware, damage ─────────────────────────────────────────

const COLOUR_WORDS = [
  "white", "black", "grey", "gray", "navy", "blue", "green", "sage", "cream", "beige", "off white", "taupe",
  "espresso", "two tone", "two toned", "greige", "charcoal", "brown", "natural", "stain", "stained",
  "blanc", "noir", "gris", "bleu", "vert", "blanco", "negro", "azul", "verde",
  "benjamin moore", "sherwin", "colour", "color", "couleur",
];
const HARDWARE_WORDS = [
  "handles", "handle", "knobs", "knob", "pulls", "pull", "hinges", "hinge", "soft close", "hardware",
  "poignees", "poignee", "charnieres", "manijas", "jaladeras", "bisagras",
];
const DAMAGE_WORDS = [
  "peeling", "peel", "chipped", "chipping", "chips", "damage", "damaged", "water damage", "swollen", "scratched",
  "scratches", "worn", "cracked", "cracks", "grease", "greasy", "sticky", "stains", "faded", "yellowed",
  "ecaille", "abime", "dommage", "danado", "rayado",
];

function firstNote(body, words) {
  const flat = flatten(body);
  const hit = words.filter((w) => flat.includes(` ${w} `));
  if (!hit.length) return null;
  return { words: hit.slice(0, 4), quote: sentenceAround(body, hit) };
}

/**
 * The scope of the job, from the conversation. Pure.
 *
 * @param messages  [{ id, direction, private, body, sentAt }], oldest first
 * @param skip      Set of message ids that are not the person's own words
 *                  (quick-reply taps, the ad marker) — never read for scope
 * @returns {{ counts: Record<string, number>, sources: Record<string, {messageId, sentAt, quote}>,
 *             colour, hardware, damage }} — `counts` empty when nothing was said
 */
export function extractScope(messages = [], { skip = null } = {}) {
  const counts = {};
  const sources = {};
  let colour = null;
  let hardware = null;
  let damage = null;
  for (const m of Array.isArray(messages) ? messages : []) {
    if (!m || m.direction !== "in" || m.private) continue;
    if (skip && skip.has(m.id)) continue;
    const body = String(m.body ?? "");
    if (!body.trim()) continue;
    const found = countsInText(body);
    for (const [unit, n] of Object.entries(found)) {
      counts[unit] = n; // latest mention wins — see the header
      sources[unit] = {
        messageId: m.id ?? null,
        sentAt: m.sentAt ? new Date(m.sentAt).toISOString() : null,
        quote: sentenceAround(body, UNIT_WORDS[unit]),
      };
    }
    const c = firstNote(body, COLOUR_WORDS);
    if (c) colour = { ...c, messageId: m.id ?? null };
    const h = firstNote(body, HARDWARE_WORDS);
    if (h) hardware = { ...h, messageId: m.id ?? null };
    const d = firstNote(body, DAMAGE_WORDS);
    if (d) damage = { ...d, messageId: m.id ?? null };
  }
  return { counts, sources, colour, hardware, damage };
}

/** Did the conversation say any count at all? */
export function hasCounts(scope) {
  return Boolean(scope && scope.counts && Object.keys(scope.counts).length);
}

/**
 * The shape stored on LeadRequest.intake.scope. Pure. Only what was said;
 * null when nothing was.
 */
export function storableScope(scope) {
  if (!scope) return null;
  const has = hasCounts(scope) || scope.colour || scope.hardware || scope.damage;
  if (!has) return null;
  const note = (n) => (n ? { quote: n.quote || null, messageId: n.messageId || null } : null);
  return {
    counts: { ...(scope.counts || {}) },
    sources: { ...(scope.sources || {}) },
    colour: note(scope.colour),
    hardware: note(scope.hardware),
    damage: note(scope.damage),
    from: "conversation",
  };
}

/** "22 doors + 15 drawers" — English, for logs and the estimator's notes. */
export function scopeCountsLabel(counts = {}) {
  const names = { doors: "doors", drawers: "drawers", boxes: "boxes", pieces: "pieces", rooms: "rooms", sqft: "sq ft" };
  return SCOPE_UNITS.filter((u) => Number(counts[u]) > 0)
    .map((u) => `${counts[u]} ${names[u]}`)
    .join(" + ");
}
