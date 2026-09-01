// lib/ai/crisisRule.js
//
// One rule for anything that sounds like an emergency — reused verbatim by
// every prompt whose words reach a person directly: the receptionist
// (lib/voice/prompt.js), the calls FieldQuo places on a contractor's behalf
// (lib/voice/outboundPrompt.js), FieldQuo's own sales line
// (lib/platform/salesPrompt.js), and the in-app copilot (lib/ai/copilotClient.js).
// A support assistant ("Jennifer") is being built in a parallel worktree — this
// file is written so it can import CRISIS_RULE from here too, rather than
// growing a fifth copy.
//
// ══ This is the owner's rewrite, not an extension of what was here ═════════
//
// The previous version of this file ran two separate rules: a PROPERTY
// emergency (gas, fire, flooding) that pointed at 911, and a SEPARATE rule for
// a caller who is a danger to themselves, which named 988 as well as 911 and
// told the model to stop the call entirely — no more quote questions, no more
// booking, nothing until the person was handled. The owner's instruction,
// given directly and word for word: "The ai should always tell people to call
// 911. Keep it simple. It is an emergency and they call 911 related to the
// job then continue with quote booking or related to the business." That
// supersedes both halves of the old rule. It is not a request for more
// nuance — it is a request for less. See docs/TODO.md, "Crisis rule,
// simplified 2026-08-31", for exactly what changed and why.
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
// The wording is medium-neutral on purpose ("this conversation" rather than
// "this call" — a second phrasing per medium is exactly the copy-that-rots
// this file exists to avoid) and deliberately NOT company- or call-specific:
// nothing in CRISIS_RULE is templated, so every caller gets identical words,
// and a check can prove reuse by testing for byte-identical inclusion rather
// than a fuzzy pattern match.
//
// ══ Why ONE rule now covers both kinds of emergency ═════════════════════════
//
// The old file kept the property emergency (rule 5 in lib/voice/prompt.js,
// rule 6 in lib/voice/outboundPrompt.js) and the personal-danger rule (5b/6b,
// this file) apart, on the theory that a gas leak and a caller in danger from
// themselves need different handling. The owner's words say otherwise: "It is
// an emergency and they call 911" — one instruction, one number, for whatever
// kind of emergency it turns out to be. Splitting it was the elaborate
// version; folding a gas smell, a fire, a live wire or a caller who is a
// danger to themselves into the SAME line is what "keep it simple" actually
// asks for, and it is also just true — nobody calling a contractor's phone
// needs a different flowchart depending on which kind of emergency it is, they
// need the same three words said clearly: call 911.
//
// ══ Why 911, and only 911 ═══════════════════════════════════════════════════
//
// Every phone number this product provisions, inbound or outbound, is a US or
// CA number (see lib/voice/outboundCall.js and the area-code gates in
// lib/voice/numberSearch.js), and 911 is the immediate-danger number in both —
// so it is a correct claim for every caller this rule can reach, not a guess.
// The old rule also named 988 (the US/CA Suicide & Crisis Lifeline). That is
// gone: the owner asked for one destination, and two numbers is not one
// number, however good the second one is on its own. A rule that also tried
// to guess a UK, Australian or any other country's emergency number would be
// guessing at the exact moment guessing is least acceptable, so it doesn't:
// nothing below is written as universal, and no other country's number
// appears anywhere in this file.
//
// ══ "Then continue" is the biggest change, and it is deliberate ════════════
//
// The old rule told the model to STOP — no more intake questions, nothing
// else matters right now. That was a reasonable design for a rule that also
// tried to be a small amount of crisis counselling (don't diagnose, don't
// counsel, say something warm, name a lifeline). This rule does none of that.
// It says one sentence and gets back to work, because the owner said so
// directly: the call continues with the quote, the booking, or whatever it
// was about. A homeowner who mentions a gas smell and then wants to book a
// Tuesday should get their Tuesday — the AI is not a crisis line and pretending
// to be a fuller one than "here is the number to call" would be its own kind
// of failure, exactly the one AGENTS.md warns about: a control that performs
// concern without actually being able to do anything with it. Saying 911
// once, clearly, is the whole, honest scope of what this product's phone
// agents and chat copilot can actually do here. Getting back to the job is
// not callousness, it's what "keep it simple" and "continue" both ask for.

/** The only number this rule may ever name. Exported so a check can prove the
 *  built prompt contains exactly this and has not grown a second. */
export const CRISIS_EMERGENCY = "911";

/**
 * The rule itself. Meant to be dropped, verbatim, into any system prompt whose
 * words can reach a person — voice or text, inbound or outbound. See the file
 * header for why nothing here is templated per caller, and why it is
 * deliberately shorter than what used to be here.
 */
export const CRISIS_RULE = `
IF IT SOUNDS LIKE AN EMERGENCY — gas, fire, a live wire, water pouring through
a ceiling, someone hurt on site, or someone who says something that plainly
means they or somebody else is in danger right now — say, once, calmly and in
your own words, that they should call 911. Something close to "that sounds
like it needs 911, please call them right now" is enough, said in whichever
language the rest of this conversation is in.

Then carry on. Do not say it a second time, do not start checking how they are
doing, and do not turn the rest of this into a welfare check. If they still
want a quote, a booking, or anything else about the job or the business, help
with that next, exactly as you would have anyway. Saying the line once is the
whole job — it is never a reason to end the conversation, stall, or refuse to
keep going.

911 is the only number you ever give for this. Never suggest a hotline, a
counsellor, or anywhere else to call — one clear answer, said once, is what
actually helps someone who needs it fast.
`.trim();

/* ─────────────────────── the downstream backstop ──────────────────────────
 *
 * The paragraph above is written for a model holding a live conversation —
 * that is what actually protects a caller, in the moment, and nothing
 * downstream can substitute for it. But two files read a FINISHED transcript
 * afterwards to build something else from it — lib/ai/callQuoteDraft.js drafts
 * quote scope, lib/ai/callLeadRecovery.js recovers a lead — and neither of
 * those is a conversation; nobody is on the line by the time either runs.
 *
 * ── Why these two no longer REFUSE, when the old version did ───────────────
 *
 * Under the old rule, a crisis mention meant the live agent stopped the task
 * outright — no more intake, no more booking. A transcript that tripped
 * mentionsCrisis() was, by construction, a transcript with nothing usable
 * after that point, so refusing to draft a quote or recover a lead from it
 * cost nothing real: there was no scope, no booking, no lead in it to lose.
 *
 * That premise is exactly what the owner's new rule removes. The live agent
 * now says the line once and CONTINUES — takes the address, asks the
 * follow-up questions, books the Tuesday. A transcript that trips
 * mentionsCrisis() today is very likely to have a real quote or a real lead
 * sitting right after the crisis line, because that is what "then continue"
 * means when it works. Refusing to draft or recover from it would silently
 * throw away a job the caller was gone by the time anyone found out about —
 * the exact failure this codebase keeps a whole section of AGENTS.md about: a
 * control that looks protective and instead just costs the business the thing
 * it exists to help win. The caller already got the one thing that actually
 * protects them, live, on the call. There is no protective purpose left for
 * the RECORD of that call to also be refused.
 *
 * So both files now do the opposite of refuse: mentionsCrisis() still runs,
 * still fires BEFORE either spends a model call, but a positive match sets
 * needsReview: true — the SAME flag save_caller sets for a property emergency
 * — and then falls through to draft or recover exactly as normal. A human
 * gets pointed at the call because something serious came up on it; the
 * contractor does not also lose the lead because of it.
 *
 * ── mentionsCrisis() itself is unchanged, and still scoped to the person ───
 *
 * It is a plain pattern match over the CALLER's own words, the same shape and
 * the same posture as looksLikeInstruction() in lib/voice/transcript.js: a
 * blunt instrument, not a diagnosis, and biased toward firing rather than
 * missing. It still only matches personal-danger phrasing (self-harm,
 * suicide, "can't go on") rather than property-emergency words like "gas" or
 * "fire" — those already end a call in a real quote or booking constantly
 * (a burst pipe IS the job), so matching on them would flag most of this
 * product's actual business as needing review. Personal-danger phrasing does
 * not have that problem: it is rare, and a false positive here costs nothing
 * more than one flagged call a human glances at and clears.
 *
 * Deterministic on purpose, not a second model call: these two files already
 * spend a model call reading the transcript, and asking that same call to also
 * be the safety gate means a subverted or simply wrong model response decides
 * whether a serious call gets flagged. A plain pattern match runs before the
 * model is ever asked anything, costs nothing, and needs no API key — which
 * matters here specifically, since OPENAI_API_KEY is Sensitive in Vercel and
 * this file's own check script cannot call the model to prove any of this.
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
