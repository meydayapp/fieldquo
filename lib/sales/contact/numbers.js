// lib/sales/contact/numbers.js
//
// Which number to ring, and which number to text — they are not the same one.
//
// ══ Why this exists ═══════════════════════════════════════════════════════
//
// A SalesLead has one `phone` and a Prospect has one `phoneE164`, and both are
// whatever a directory printed. The owner named the case that breaks it:
//
//   "The text should also allow for texting other numbers just in case we hit
//    a landline and the owner says to text them at a different number or call
//    them at a different number."
//
// That is the ordinary shape of a real conversation with a contractor — the
// number on the listing is the shop, the number that answers is a cell — and
// there was nowhere to put the second one. The rep either lost it or wrote it
// in a note nothing could dial.
//
// ══ The failure this prevents, which is worse than the missing field ══════
//
// TEXTING A LANDLINE IS A SILENT SUCCESS. The carrier accepts the message, the
// provider reports it sent, the screen shows a green tick, and nothing ever
// arrives — there is no bounce to notice and no error to log. A rep waits two
// days for a reply to a message that was never delivered to anybody.
//
// So a number carries what it can be REACHED BY, not just what it is, and the
// text channel refuses a line marked landline instead of pretending. When the
// kind is unknown it is offered with the doubt stated, because refusing every
// unverified number would leave a rep unable to text anybody at all — and an
// unverified number that works is the common case.
//
// ══ Why a list rather than a "preferred number" column ════════════════════
//
// A contractor says "call the shop, text my cell". One column cannot hold that
// and a second column ("altPhone") cannot hold the third number a big outfit
// gives you. Reach is per number and per channel, so it is stored that way.
//
// Pure over rows the caller has already read.
import { normalisePhone } from "../suppressionRules";

export const KIND_MOBILE = "mobile";
export const KIND_LANDLINE = "landline";
export const KIND_UNKNOWN = "unknown";
export const KINDS = Object.freeze([KIND_MOBILE, KIND_LANDLINE, KIND_UNKNOWN]);

export const CHANNEL_VOICE = "voice";
export const CHANNEL_TEXT = "text";
export const CHANNELS = Object.freeze([CHANNEL_VOICE, CHANNEL_TEXT]);

/** What each kind can carry, before anything a human said about it. */
const REACHABLE_BY = Object.freeze({
  [KIND_MOBILE]: Object.freeze({ voice: true, text: true }),
  // The whole reason this module exists. Callable, never textable.
  [KIND_LANDLINE]: Object.freeze({ voice: true, text: false }),
  // Offered on both, with the doubt carried to the screen. Refusing every
  // unverified number would leave a rep unable to text anybody, and most
  // unverified numbers are fine.
  [KIND_UNKNOWN]: Object.freeze({ voice: true, text: true }),
});

export function isKind(v) {
  return KINDS.includes(String(v ?? ""));
}

/** The kind, defaulted to unknown rather than guessed from the digits. */
export function kindOf(row = {}) {
  return isKind(row.kind) ? row.kind : KIND_UNKNOWN;
}

/**
 * Can this number carry this channel?
 *
 * An explicit `canText === false` recorded by a rep who was TOLD not to text
 * beats the kind, in both directions: a contractor who says "that's a landline
 * but it forwards to my phone, text it" is describing something no lookup
 * knows. A human who spoke to them outranks an inference.
 */
export function reaches(row = {}, channel) {
  if (!CHANNELS.includes(channel)) return false;
  const explicit = channel === CHANNEL_TEXT ? row.canText : row.canCall;
  if (explicit === true || explicit === false) return explicit;
  return Boolean(REACHABLE_BY[kindOf(row)]?.[channel === CHANNEL_TEXT ? "text" : "voice"]);
}

/**
 * Every number that could carry this channel, best first.
 *
 * @param primary     the number already on the record — a lead's `phone` or a
 *                    prospect's `phoneE164`. Kind is genuinely unknown for it:
 *                    a directory does not say.
 * @param alternates  numbers a rep recorded, newest last. Shaped
 *                    { e164, kind, label, canCall, canText, preferred, addedAt }.
 * @param ourNumbers  FieldQuo's own numbers. Ringing one bridges a loop and
 *                    bills both legs; texting one talks to ourselves.
 * @param blocked     true when the whole business is do-not-contact or opted
 *                    out. Every number is refused, not just the primary — the
 *                    flag is on the BUSINESS, and offering their cell because
 *                    it arrived later would be the same call they refused.
 *
 * @returns {{ choices: Array, refused: Array, reason: string|null }}
 *          `refused` carries what was dropped AND why, because a rep who was
 *          given a number and cannot see it in the list will type it into the
 *          notes and phone it from their own handset.
 */
export function contactChoices(
  { primary = null, alternates = [], ourNumbers = [], blocked = false, blockedReason = null } = {},
  { channel = CHANNEL_VOICE } = {},
) {
  const choices = [];
  const refused = [];
  if (!CHANNELS.includes(channel)) {
    return { choices, refused, reason: "unknown_channel" };
  }
  if (blocked) {
    return { choices, refused, reason: blockedReason || "blocked" };
  }

  const ours = new Set((Array.isArray(ourNumbers) ? ourNumbers : []).map(normalisePhone).filter(Boolean));
  const seen = new Set();

  const consider = (row, fallbackLabel, isPrimary) => {
    const e164 = normalisePhone(row?.e164 ?? row);
    if (!e164) {
      refused.push({ e164: null, label: fallbackLabel, why: "not_a_number" });
      return;
    }
    // One number, once. The same cell recorded twice — the listing and what
    // they said on the call — must not appear as two choices.
    if (seen.has(e164)) return;
    seen.add(e164);

    if (ours.has(e164)) {
      refused.push({ e164, label: fallbackLabel, why: "one_of_ours" });
      return;
    }
    const row2 = typeof row === "object" && row ? row : {};
    if (!reaches(row2, channel)) {
      refused.push({
        e164,
        label: row2.label || fallbackLabel,
        kind: kindOf(row2),
        why: channel === CHANNEL_TEXT ? "landline_cannot_receive_text" : "not_callable",
      });
      return;
    }
    choices.push({
      // The stored row's id, or null for the number already on the record.
      // Carried because it is the ONLY thing a browser is ever allowed to name
      // when it asks for a number to be dialled — lib/sales/contact/resolve.js
      // argues why, and a choice list that could not say which id it meant
      // would force the screen to send the number itself.
      id: row2.id || null,
      e164,
      label: row2.label || fallbackLabel,
      kind: kindOf(row2),
      preferred: Boolean(row2.preferred),
      isPrimary: Boolean(isPrimary),
      addedAt: row2.addedAt || null,
      // Said on the screen beside an unverified number, so a rep can decide
      // rather than discover. Null when there is nothing to warn about.
      doubt:
        kindOf(row2) === KIND_UNKNOWN && channel === CHANNEL_TEXT && row2.canText !== true
          ? "Nobody has confirmed this one takes texts. If it is a landline the message will not arrive and nothing will say so."
          : null,
    });
  };

  // The rep-recorded numbers first: somebody spoke to this business and was
  // told which number to use. That outranks a directory listing every time.
  const alts = (Array.isArray(alternates) ? alternates : [])
    .slice()
    .sort((a, b) => {
      if (Boolean(b?.preferred) !== Boolean(a?.preferred)) return Boolean(b?.preferred) - Boolean(a?.preferred);
      return new Date(b?.addedAt || 0) - new Date(a?.addedAt || 0);
    });
  for (const alt of alts) consider(alt, "Given to us", false);

  if (primary) consider({ e164: primary }, "On their listing", true);

  return {
    choices,
    refused,
    reason: choices.length ? null : refused.length ? "all_refused" : "no_number",
  };
}

/**
 * The one to use when nobody picks — the head of the list, or null.
 *
 * Null rather than a guess: a screen with no usable number must say so, not
 * quietly dial the listing after a rep was told not to.
 */
export function defaultChoice(result) {
  return result?.choices?.[0] || null;
}

/** A sentence for the empty case, matching the reason. */
export function noNumberSay(result, channel = CHANNEL_VOICE) {
  const reason = result?.reason;
  if (!reason) return null;
  if (reason === "no_number") {
    return channel === CHANNEL_TEXT
      ? "No number on this record to text. Add the one they gave you and the message box appears."
      : "No number on this record to ring. Add the one they gave you and the call button appears.";
  }
  if (reason === "all_refused") {
    const landline = (result.refused || []).some((r) => r.why === "landline_cannot_receive_text");
    if (landline) {
      return (
        "The only number we have is a landline, and a text to a landline is accepted by the " +
        "carrier and delivered to nobody. Ring them and ask where to text."
      );
    }
    return "Every number on this record has been refused. The reasons are listed beside them.";
  }
  return null;
}
