// lib/aiEmployee/evidence.js
//
// What the customer has ACTUALLY sent — as a fact in the prompt, and as a
// refusal after the fact.
//
// ══ The job this file lost ═════════════════════════════════════════════════
//
// Cathy Monaghan Jardine, Manotick, in area, motivated, had wanted her kitchen
// cabinets painted "for some time now". An AI agent wrote "I've received your
// photo, thank you." She asked "What photo have you received?" It doubled
// down and described the contents — "the photo of your white kitchen cabinets
// that you just shared! It shows the area around your sink and stove very
// clearly." She wrote "I never shared any photos", and then "I'll have to put
// this project on hold."
//
// That was Meta's agent, not ours. Ours can do exactly the same thing and ours
// is the one we control.
//
// ══ Why an instruction alone is not the fix ════════════════════════════════
//
// roles.js already tells the model never to invent a price, and that rule
// works because there is also a tool: the number comes from the server or it
// does not exist. An attachment has no equivalent tool — the model is simply
// writing about the conversation it was handed, and a conversation rendered as
// text carries no statement about what is NOT in it. Absence of a photo looks
// exactly like a photo nobody mentioned.
//
// So this file does the two things an instruction cannot:
//
//   1. It states the count. `attachmentFact` puts "This conversation contains
//      0 attachments" into the prompt, read off the Message.attachments rows.
//      A model told the number has to contradict a fact it was given rather
//      than fill a silence, which is a much harder mistake to make.
//   2. It reads the draft back. `mediaClaimRefusal` refuses a reply that
//      claims to have received or seen media when the thread has none. Belt to
//      the prompt's braces — and the half that is testable, which is why the
//      refusal is a named reason on AiEmployeeReply rather than a log line.
//
// ══ What the matcher can and cannot do ═════════════════════════════════════
//
// The claim patterns below are English, French and Spanish. FieldQuo ships
// nine languages, so this is deliberately NOT a complete guard and must not be
// described as one: in the other six it catches nothing and the prompt's own
// rule is the whole defence. It is written this way rather than not written
// because the three covered languages are where the corpus and the customers
// are, and a partial check that names its own limit beats no check.
//
// It errs toward refusing. A false refusal costs one automated reply and
// fetches a person; a false pass costs the job, which is the trade Cathy
// already paid for.

import { normaliseAttachments } from "@/lib/messaging/attachments";

/** The named reason written to AiEmployeeReply.suppressedReason. */
export const MEDIA_CLAIM_REASON = "claimed_media_not_received";

/**
 * Attachment types that are a FILE the customer sent — something a reply could
 * claim to have looked at.
 *
 * `location` and `contact` are excluded on purpose. WhatsApp delivers both as
 * attachments and neither is a photograph; counting a dropped pin as "1
 * attachment" would let the prompt tell the model a picture exists.
 */
const MEDIA_TYPES = Object.freeze(["image", "video", "audio", "document", "sticker", "other"]);

/** Types a reply may reasonably call a photo. Reported separately so the fact
 *  can say "2 photos" rather than the vaguer "2 attachments". */
const PICTURE_TYPES = Object.freeze(["image", "sticker"]);

/**
 * Count what the CUSTOMER sent on this thread.
 *
 * @param messages [{ direction, attachments }] — raw Message rows.
 *
 * Inbound only. An attachment the contractor sent outbound is not something
 * the customer shared, and a reply thanking somebody for a photo the business
 * itself sent is the same error wearing a different hat.
 *
 * Every state counts, including `pending` and `failed`. A photo whose bytes
 * have not been fetched yet HAS been sent — refusing a reply that mentions it
 * would be this guard inventing an absence, which is the mirror of the bug.
 */
export function attachmentTally(messages = []) {
  const tally = { total: 0, pictures: 0, other: 0, unfetched: 0 };
  if (!Array.isArray(messages)) return tally;

  for (const row of messages) {
    if (!row || row.direction !== "in") continue;
    for (const a of normaliseAttachments(row.attachments)) {
      if (!MEDIA_TYPES.includes(a.type)) continue;
      tally.total += 1;
      if (PICTURE_TYPES.includes(a.type)) tally.pictures += 1;
      else tally.other += 1;
      if (a.state !== "ready") tally.unfetched += 1;
    }
  }
  return tally;
}

/**
 * The sentence the prompt carries. Always present, including — especially —
 * when the count is zero.
 *
 * Written as a flat statement rather than an instruction because it is one:
 * the rule that forbids inventing lives in roles.js's NEVER block, and this is
 * the fact that rule is applied to.
 */
export function attachmentFact(tally = {}) {
  const total = Number(tally.total) || 0;
  const pictures = Number(tally.pictures) || 0;

  if (total === 0) {
    return (
      "WHAT THE CUSTOMER HAS SENT\n" +
      "This conversation contains 0 attachments. No photo, video, document or " +
      "file has been received from this person. You have not seen anything. " +
      "Do not thank them for a photo, do not describe one, and do not say you " +
      "have received one — if you need to see the work, ask them to send a " +
      "picture."
    );
  }

  const parts = [];
  if (pictures) parts.push(`${pictures} ${pictures === 1 ? "photo" : "photos"}`);
  const other = total - pictures;
  if (other) parts.push(`${other} other ${other === 1 ? "file" : "files"}`);

  // The count is a fact; the CONTENTS are not. A model that knows two photos
  // exist and cannot see them will describe them if nothing says otherwise —
  // which is precisely how "it shows the area around your sink and stove"
  // happened.
  return (
    "WHAT THE CUSTOMER HAS SENT\n" +
    `This conversation contains ${total} ${total === 1 ? "attachment" : "attachments"} ` +
    `from the customer (${parts.join(", ")}). You may acknowledge that they sent ` +
    "them. You CANNOT see them — never describe what is in one, never say what " +
    "condition or colour anything is, and never draw a measurement or a count " +
    "from one. A person will look at them."
  );
}

// ── The post-check ─────────────────────────────────────────────────────────
//
// Built as noun + verb rather than as whole phrases, so a paraphrase the model
// invents next week is still caught. The nouns are the things a homeowner
// sends; the verbs are RECEIPT, in the past or the present perfect. A request
// ("could you send a photo?") contains the noun and no receipt verb, which is
// exactly the line this has to draw.

const MEDIA_NOUNS =
  "photos?|pictures?|pics?|images?|snapshots?|videos?|attachments?|files?|documents?|" +
  // French. "pièce jointe" with and without the accent, because a model
  // writing quickly drops it.
  "photos?|images?|vid[ée]os?|pi[èe]ces? jointes?|fichiers?|documents?|" +
  // Spanish
  "fotos?|im[áa]genes?|im[áa]gen|v[íi]deos?|videos?|archivos?|adjuntos?";

const RECEIVED_VERBS =
  "received|receive|got|have got|reviewed|viewed|opened|seen|see|looked at|looking at|" +
  "checked|went through|" +
  "re[çc]u|re[çc]ues?|bien re[çc]u|regard[ée]|consult[ée]|vu|vue|vues|examin[ée]|" +
  "recib(?:í|i|ido|idas?|imos)|visto|vistas?|revisad[oa]s?";

const THANKS =
  "thanks|thank you|thankyou|merci|gracias|appreciate";

const SHOWS =
  "shows?|showing|shows me|indicates?|" +
  "montrent?|montre|indiquent?|" +
  "muestran?|muestra|indican?";

/**
 * Patterns that assert receipt. Each one has to bind a receipt idea to a media
 * noun inside one clause — `[^.!?\\n]{0,40}` rather than `.*` — so a sentence
 * asking FOR a photo cannot satisfy a verb belonging to a different sentence.
 */
const CLAIM_PATTERNS = Object.freeze([
  // "I've received your photo" / "we got the pictures" / "j'ai bien reçu vos photos"
  new RegExp(
    `\\b(?:i|we|j['’]|nous|yo|hemos|he)\\b[^.!?\\n]{0,20}\\b(?:${RECEIVED_VERBS})\\b[^.!?\\n]{0,40}\\b(?:${MEDIA_NOUNS})\\b`,
    "i",
  ),
  // "thanks for the photos" / "merci pour les photos"
  new RegExp(
    `\\b(?:${THANKS})\\b[^.!?\\n]{0,30}\\b(?:${MEDIA_NOUNS})\\b`,
    "i",
  ),
  // "the photo you sent" / "the pictures you shared" / "les photos que vous avez envoyées"
  new RegExp(
    `\\b(?:${MEDIA_NOUNS})\\b[^.!?\\n]{0,30}\\b(?:you\\s+(?:sent|shared|attached|uploaded|posted|provided)|vous\\s+(?:avez|m['’]avez)\\s+(?:envoy|partag|transmis)|que\\s+(?:enviaste|env[íi]o|compartiste))`,
    "i",
  ),
  // "the photo shows" / "from the images" / "based on the pictures"
  new RegExp(
    `\\b(?:${MEDIA_NOUNS})\\b[^.!?\\n]{0,20}\\b(?:${SHOWS})\\b`,
    "i",
  ),
  new RegExp(
    `\\b(?:based on|from|judging by|d['’]apr[èe]s|selon|seg[úu]n)\\b[^.!?\\n]{0,20}\\b(?:the|your|these|those|les|vos|ces|las?|sus?)\\b\\s*(?:${MEDIA_NOUNS})\\b`,
    "i",
  ),
  // The subjectless forms — "Looking at the images…", "in the photo…". Kept
  // separate from the first pattern rather than making its pronoun optional,
  // because dropping the subject there would let any sentence containing a
  // media noun and the word "see" match.
  new RegExp(
    `\\b(?:looking at|looked at|going through|went through|having (?:seen|reviewed)|after (?:seeing|reviewing)|in the|in your|en regardant|mirando)\\b[^.!?\\n]{0,20}\\b(?:${MEDIA_NOUNS})\\b`,
    "i",
  ),
]);

/**
 * Does this draft claim to have received or seen media?
 *
 * Pure and exported so the check script can execute it against both halves —
 * the sentence that lost Cathy the job, and the sentence that asks for a photo
 * and must NOT be refused.
 */
export function claimsMedia(text) {
  const body = String(text || "");
  if (!body.trim()) return false;
  return CLAIM_PATTERNS.some((re) => re.test(body));
}

/**
 * The verdict. A named reason when the draft must not go out, otherwise null.
 *
 * Only ever refuses on the ZERO case. A thread that has one photo and a reply
 * that talks about two is a mistake this cannot see, and pretending otherwise
 * by counting nouns would be a control that appears to work.
 */
export function mediaClaimRefusal({ text, tally } = {}) {
  if ((Number(tally?.total) || 0) > 0) return null;
  return claimsMedia(text) ? MEDIA_CLAIM_REASON : null;
}
