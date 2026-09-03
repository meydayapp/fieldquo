// lib/sales/repAdmin.js
//
// The decisions the "add a sales rep" screen makes, none of which belong in a
// component.
//
// ══ Why the code is generated rather than typed ═══════════════════════════
//
// The owner's question was "asks me for a name email and code? what is the code
// for?" — and the honest answer is that a human should never have been asked.
// SalesRep.code is the slug in /signup?sales=<code>; it is the whole mechanism
// by which a signup is credited to a rep (lib/sales/repStats.js's signupLinkFor
// builds the link from it and nothing else). A value with that job has no
// reason to be invented by hand: a hand-typed code can collide with a live
// one — and a collision is not cosmetic, it is one rep's link crediting
// another rep — and it can be ugly in a way somebody reads off a card wrong.
//
// So: derived from the name, shown before the invite goes out, overridable by
// an admin who has a reason. The screen prefills what the server would have
// chosen, which is the property that makes "generated" honest rather than
// "generated and then silently different".
//
// ══ ONE candidate sequence, shared ════════════════════════════════════════
//
// codeCandidates() is used by BOTH the screen (to prefill) and the route (to
// retry past a unique-constraint collision). Two implementations of "what is
// the next free code" is exactly AGENTS.md failure class 4: the copy is the one
// that rots, and here the rot would show up as the screen promising `dana-2`
// and the database handing back `dana-3` with no explanation.
//
// ══ The work mailbox is optional HERE and required to SEND ════════════════
//
// A mailbox is bought. The owner adds a rep on Monday and the inbox exists on
// Thursday, so refusing to create a rep without one would make the console
// refuse the actual sequence of events. What it must NOT do is pretend the gap
// is harmless: lib/sales/outreachSender.js's outreachStatus() blocks every send
// while it is absent, and the screen says so in those words rather than leaving
// a rep to discover it in front of a prospect.
// From ./repCode and NOT from ./invite, even though invite.js re-exports both:
// this module is imported by a client component, and invite.js pulls in
// `node:crypto` to hash an invite token. See repCode.js's header.
import { codeFromName, isValidCode } from "./repCode";

/** Same shape the routes use. Deliberately loose — an address is validated by delivery. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * How many suffixed codes to consider before giving up.
 *
 * Five is not arbitrary: it is what the create route can attempt inside one
 * request before the retry loop stops being a retry and starts being a hang.
 * Past it the honest answer is "type one yourself", not a sixth guess.
 */
export const MAX_CODE_CANDIDATES = 5;

/**
 * The codes to try, in order, for a rep called `name`.
 *
 * `base`, then `base-2`, `base-3`… The suffix starts at 2 because `base-1`
 * reads as the first of a series that has no second member — the person
 * holding `base` has no `-1` on their card.
 */
export function codeCandidates(name, max = MAX_CODE_CANDIDATES) {
  const base = codeFromName(name);
  const out = [base];
  for (let n = 2; n <= max; n++) out.push(`${base}-${n}`);
  return out;
}

/**
 * The code this rep should get, given the codes already in use.
 *
 * @param name   the rep's name, as typed.
 * @param taken  an iterable of codes already used. A Set, an array, anything.
 * @returns the first free candidate, or null when every candidate is taken —
 *          null rather than a sixth guess, because the screen's correct
 *          response is to ask the admin for one rather than to invent a
 *          seventh. A caller that renders null as an empty field is telling
 *          the truth; one that renders it as `rep` is not.
 */
export function suggestCode(name, taken = []) {
  const used = new Set(
    [...taken].map((c) => String(c || "").toLowerCase()).filter(Boolean),
  );
  for (const candidate of codeCandidates(name)) {
    if (!used.has(candidate)) return candidate;
  }
  return null;
}

/**
 * What is wrong with an admin-supplied code, in a sentence, or null.
 *
 * Separate from isValidCode() rather than wrapping it in the route, because the
 * SCREEN has to say the same sentence the server would — a field that goes red
 * for one reason and is refused for another is two rules pretending to be one.
 */
export function codeProblem(code) {
  const value = String(code || "").trim();
  if (!value) return null; // absent means "generate one", which is not a problem
  if (value !== value.toLowerCase()) {
    return "A code is lowercase — it ends up in a link somebody reads off a card.";
  }
  if (!isValidCode(value)) {
    return (
      "A code is lowercase letters, numbers and hyphens, 2–31 characters, " +
      "starting with a letter or a number."
    );
  }
  return null;
}

/** Lowercased and trimmed, or null. Never "" — an empty string in a @unique column collides. */
export function normaliseWorkEmail(value) {
  const clean = String(value || "").trim().toLowerCase();
  return clean || null;
}

/**
 * What is wrong with a work mailbox, or null. Absence is not a problem here —
 * see the header on why a rep legitimately exists before their inbox does.
 *
 * @param loginEmail  the rep's sign-in address. A work mailbox equal to it is
 *   refused, and that refusal is the whole point of the column: SalesRep's own
 *   schema comment says a login address "may be personal or pre-existing", and
 *   pointing outreach at it puts a stranger's reply somewhere the rep may not
 *   want it and the portal cannot see. Two columns holding one value is also a
 *   @unique collision waiting for the second rep who does it.
 */
export function workEmailProblem(value, loginEmail = null) {
  const clean = normaliseWorkEmail(value);
  if (!clean) return null;
  if (clean.length > 254) return "That address is too long to be real.";
  if (!EMAIL_RE.test(clean)) return "That doesn't look like an email address.";
  const login = normaliseWorkEmail(loginEmail);
  if (login && clean === login) {
    return (
      "The work mailbox has to be different from the sign-in address. The " +
      "sign-in address is often personal; outreach replies must land somewhere " +
      "the rep is happy for a stranger to write to."
    );
  }
  return null;
}

// ══ Numbers: what can honestly be assigned, and what cannot ════════════════
//
// The owner asked "where can i assign them a number for callbacks etc?" and the
// answer is two different answers, so this states both rather than rendering
// one picker over them.
//
// TEXTING is real, and it is SHARED. lib/sales/salesSms.js's salesSmsNumber()
// is `findFirst({ purpose: "sales", active: true })` — one first-party number
// for the whole sales operation, not a per-rep pool. Every rep texts their
// signup link from that one number, and that is a deliberate compliance
// posture: a STOP arriving there means "stop selling me software" and is
// honoured across every rep at once. Assigning reps their own texting numbers
// would fragment that opt-out.
//
// VOICE CALLBACKS are not real, and no amount of UI makes them so.
// FIELDQUO_SALES_NUMBER is a single environment variable naming FieldQuo's own
// line, read by lib/platform/salesCall.js; it is the number the AI receptionist
// answers on, not a pool anything can allocate from. There is no per-rep
// caller-ID model: docs/sales-intel/AUDIT-telephony.md establishes that sales
// numbers must NOT live in VoicePhoneNumber (its companyId is a required FK and
// heldNumber() enforces one-per-company), and PlatformSmsNumber has no rep
// relation at all. Building the picker would need a column this session does
// not own. So the screen says what is missing and offers no control.

/** The two claims the reps screen makes about numbers, as data rather than prose in JSX. */
export const NUMBER_CAPABILITIES = [
  {
    key: "sms",
    label: "Texting the signup link",
    available: true,
    detail:
      "Shared, not per rep. FieldQuo holds one sales-purpose number and every " +
      "rep texts from it, so a STOP stops every rep at once. Buy or release it " +
      "under Crew lines.",
    where: "/platform/crew-lines",
  },
  {
    key: "voice",
    label: "A callback number per rep",
    available: false,
    detail:
      "Not built. FIELDQUO_SALES_NUMBER is one environment variable naming " +
      "FieldQuo's own line — the one the AI receptionist answers — not a pool " +
      "anything can allocate from, and no model links a phone number to a rep. " +
      "Assigning one would need a schema change, so there is no control here " +
      "rather than one that would appear to work.",
    where: null,
  },
];

/**
 * The sales texting number's state, as a sentence the screen prints verbatim.
 *
 * Three states, and the third is why this is a function rather than a ternary:
 * "we hold one", "we hold none", and "we could not look". A null `e164` from a
 * failed query and a null from an empty table are the same value and different
 * facts (AGENTS.md failure class 5), so the caller passes which one it has.
 */
export function salesNumberState({ e164 = null, lookupFailed = false } = {}) {
  if (lookupFailed) {
    return {
      state: "unknown",
      e164: null,
      detail:
        "Couldn't read FieldQuo's number list just now, so this can't say " +
        "whether a sales number is held. Nothing has changed either way.",
    };
  }
  if (e164) {
    return {
      state: "held",
      e164,
      detail: `Reps text their signup link from ${e164}. Replies and STOPs to it are FieldQuo's, not a contractor's.`,
    };
  }
  return {
    state: "none",
    e164: null,
    detail:
      "FieldQuo holds no sales-purpose number, so no rep can text their signup " +
      "link. Buy one under Crew lines with the purpose set to Sales — it must " +
      "not be the system number, which sends on behalf of contractors.",
  };
}
