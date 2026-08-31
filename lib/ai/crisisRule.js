// lib/ai/crisisRule.js
//
// One rule for a caller who is a danger to THEMSELVES — reused verbatim by
// every prompt whose words reach a person directly: the receptionist
// (lib/voice/prompt.js), the calls FieldQuo places on a contractor's behalf
// (lib/voice/outboundPrompt.js), FieldQuo's own sales line
// (lib/platform/salesPrompt.js), and the in-app copilot (lib/ai/copilotClient.js).
// A support assistant ("Jennifer") is being built in a parallel worktree — this
// file is written so it can import CRISIS_RULE from here too, rather than
// growing a fifth copy.
//
// ══ Why this did not already exist ═════════════════════════════════════════
//
// lib/voice/prompt.js rule 5 already covers a PROPERTY emergency — gas, fire,
// flooding, a caller who is distressed about the house — and tells the agent
// to point at the local emergency number and get someone from the business to
// ring back. Nothing anywhere covered a caller who is a danger to themselves.
// A grep for self-harm, suicide, crisis or 988 across lib/ai, lib/voice and
// lib/platform returned nothing, on a product whose flagship surface answers
// real phone calls from strangers — alone, on a bad night, with nobody else on
// the line.
//
// ══ Why it is ONE file and not four paragraphs ═════════════════════════════
//
// Every prompt file here already follows the pattern SYSTEM_RULES sets: a
// fixed block of rules no company or owner note can edit away, described in
// each file's own header. A crisis rule is exactly that kind of rule, and it
// is the one kind this codebase can least afford to have drift between four
// near-identical copies of — the copy nobody is looking at is the copy that
// stops matching the day someone improves the other three, and the day it
// stops matching is the day it fails somebody who needed it. So it lives once,
// here, and every prompt that can reach a person imports CRISIS_RULE and drops
// it in as its own block — the same shape lib/voice/agentLanguage.js uses to
// give four call sites one function instead of four ternaries.
//
// The wording below is deliberately medium-neutral where it can be ("do not
// hang up on them" still reads correctly to a model running a text chat — it
// means "do not withdraw because of what they told you", and a second phrasing
// per medium is exactly the copy-that-rots this file exists to avoid) and
// deliberately NOT company- or call-specific: nothing in CRISIS_RULE is
// templated, so every caller gets identical words, and a check can prove reuse
// by testing for byte-identical inclusion rather than a fuzzy pattern match.
//
// ══ Why 988 and 911, and nothing else ═══════════════════════════════════════
//
// 988 is the Suicide & Crisis Lifeline in both the US and Canada — one number,
// live in both since July 2022. 911 is the immediate-danger number in both as
// well. Every phone number this product provisions, inbound or outbound, is a
// US or CA number (see lib/voice/outboundCall.js and the area-code gates in
// lib/voice/numberSearch.js) — so every caller this rule can reach is someone
// for whom 988 is actually correct, not a guess. A rule that also tried to
// guess a UK, Australian or any other country's crisis line would be guessing
// at the exact moment guessing is least acceptable, so it doesn't: the claim
// is written as "in the US and Canada", never as universal, and no other
// country's number appears anywhere below.
//
// ══ Why it does not try to counsel, and what "done well" means here ════════
//
// The honest shape of this is narrow. A receptionist answering a business's
// phone, an assistant placing a follow-up call, or a copilot drafting a
// message is not a crisis line, and letting it perform being one — asking
// follow-up questions about how someone is feeling, offering to "check in
// later", promising to pass a message about it — would be worse than the
// plain, bounded thing it can actually do. It can notice without being asked
// to diagnose, say something brief and human, name the two numbers that are
// actually real, and not abandon the person mid-sentence. That is the entire
// scope of what is built here, on purpose, and it is written down because
// AGENTS.md is right that a control which looks like it helps and doesn't is
// worse than no control at all — a script that performs concern while quietly
// making no difference to what actually happens next would be exactly that.

/** The only two numbers this rule may ever name. Exported so a check can prove
 *  the built prompt contains exactly these and has not grown a third. */
export const CRISIS_LIFELINE = "988";
export const CRISIS_EMERGENCY = "911";

/**
 * The rule itself. Meant to be dropped, verbatim, into any system prompt whose
 * words can reach a person — voice or text, inbound or outbound. See the file
 * header for why nothing here is templated per caller.
 */
export const CRISIS_RULE = `
IF SOMEONE IS A DANGER TO THEMSELVES — this is not the property-emergency rule
above, it is a person. If they say something like they cannot go on, there is
no point any more, they want to hurt themselves, or anything else that plainly
means they may hurt themselves, stop what you were doing. Do not keep asking
for an address, a name, a quote, a booking, or anything about why they got in
touch — none of it matters right now, and finishing your usual questions is not
the job any more.

Do not diagnose them and do not counsel them. Do not keep asking questions
about how they are feeling or what is wrong — you are not a therapist, and
interrogating someone in this state is its own kind of harm. Say something
brief, warm and plainly human, in your own words, not a script that sounds read
out. Something close to: "I'm really sorry you're going through that. In the US
and Canada, 988 will connect you with the Suicide & Crisis Lifeline, any time,
for free. If you are in danger right now, please call 911." Do not invent a
number for anywhere else — 988 and 911 are the only two you actually know are
real, and a wrong number here is worse than none at all.

Never promise to pass a message about this on to anyone — you cannot make that
happen, and a promise you cannot keep is worse than saying nothing. Do not hang
up on them and do not rush them off, but do not try to become their counsellor
either: you are the phone for a small business, not a crisis line, and
pretending otherwise would be its own kind of harm. Stay kind, stay brief, and
let them lead — including back to whatever they got in touch about, if and when
they want to.
`.trim();

/* ─────────────────────── the downstream backstop ──────────────────────────
 *
 * The paragraph above is written for a model holding a live conversation, who
 * can read tone and judge in the moment — that is the real safety mechanism,
 * and nothing downstream can substitute for it. But two files read a FINISHED
 * transcript afterwards to build something else from it — lib/ai/callQuoteDraft.js
 * drafts quote scope, lib/ai/callLeadRecovery.js recovers a lead — and neither
 * of those is a conversation. Both are told to point at, or price, whatever the
 * caller said, and a caller's worst moment is not raw material for either.
 *
 * mentionsCrisis() is a plain pattern match over the CALLER's own words, the
 * same shape and the same posture as looksLikeInstruction() in
 * lib/voice/transcript.js: a blunt instrument, not a diagnosis, and biased
 * toward firing rather than missing. A false positive here costs one call that
 * doesn't get an automatic quote draft or an automatically-recovered lead —
 * genuinely nothing, since a human can still open the call and draft or
 * recover it by hand once they've listened. A false negative costs nothing
 * additional either, because the live prompt rule above is what actually
 * protects the caller; this only decides what happens to the RECORD
 * afterwards. So it is deliberately conservative in the safe direction, the
 * same trade lib/voice/transcript.js already made and documented.
 *
 * Deterministic on purpose, not a second model call: these two files already
 * spend a model call reading the transcript, and asking that same call to also
 * be the safety gate means a subverted or simply wrong model response is the
 * thing deciding whether a crisis call becomes a sales lead. A plain pattern
 * match runs before the model is ever asked anything, costs nothing, and needs
 * no API key — which matters here specifically, since OPENAI_API_KEY is
 * Sensitive in Vercel and this file's own check script cannot call the model
 * to prove any of this.
 */

// Matched against text already run through lib/voice/transcript.js's
// normaliseForMatch — lowercase, punctuation collapsed to single spaces. An
// apostrophe becomes its own token ("can't" -> "can t"), so contractions are
// listed both ways, the same accommodation replyVerdict() makes in that file
// for exactly the same reason.
const CRISIS_PHRASES = [
  "kill myself",
  "killing myself",
  "suicide",
  "suicidal",
  "end my life",
  "end my own life",
  "ending my life",
  "end it all",
  "ending it all",
  "want to die",
  "wish i was dead",
  "wish i were dead",
  "no reason to live",
  "no reason to go on",
  "no point going on",
  "no point in going on",
  "no point living",
  "no point in living",
  "cant go on",
  "can t go on",
  "cannot go on",
  "dont want to be here",
  "don t want to be here",
  "dont want to live",
  "don t want to live",
  "hurt myself",
  "hurting myself",
  "harm myself",
  "harming myself",
  "not worth living",
  "better off dead",
  "take my own life",
  "take my life",
  "self harm",
];

/**
 * Does this text — the CALLER's own words, never the agent's — read like
 * someone describing danger to themselves?
 *
 * @param normalisedOrRaw either already run through normaliseForMatch, or raw
 *   text. Raw is normalised here so a caller of this function never has to
 *   remember to do it first, and normalising twice is a no-op.
 */
export function mentionsCrisis(text) {
  const s = String(text ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  if (!s) return false;
  return CRISIS_PHRASES.some((p) => s.includes(p));
}
