// lib/voice/tools.js
//
// What the receptionist is allowed to DO, as opposed to say.
//
// ── The split that matters ─────────────────────────────────────────────────
//
// FREELY: capture a caller. Creating a LeadRequest is the whole job, it's
// reversible, and the worst case is a duplicate row somebody deletes.
//
// AGAINST REAL DATA: offer times. It may only offer slots this endpoint gave
// it, and booking goes through the same availability check a human booking
// would — "we can be there Tuesday" to a fully-booked Tuesday is worse than
// taking a message.
//
// NEVER: quote, price, discount, agree scope, cancel anything, or touch an
// existing quote or invoice. There is no tool for any of it, which is a
// stronger guarantee than telling the model not to — a tool that doesn't exist
// can't be called by a caller who talks it into wanting to.
//
// ── Why the call id is the credential ──────────────────────────────────────
//
// Every tool call carries the provider's call_id. We look that up to find the
// number, and the number tells us the company. Nothing in the payload is
// trusted to say which tenant it belongs to — the agent is talking to a
// stranger, and a stranger who works out how these tools are shaped must not be
// able to write into somebody else's account.

// One table of words for the three surfaces that describe an appointment: this
// file, the prompt, and the sentence read out after booking. See MODE_WORDS.
import { modePhrase } from "./visitPath";

/**
 * The tool definitions handed to Retell.
 *
 * Descriptions are written for the MODEL, not for a developer. "Call this when
 * you have their name and a phone number" produces far better behaviour than
 * "creates a LeadRequest", because the model is deciding *when*, not *what*.
 */
export function toolDefinitions(
  origin,
  { canBook = false, transferTo = null, bookableModes = [] } = {},
) {
  const url = (path) => `${origin}/api/voice/tools/${path}`;
  // What this company is actually willing to arrange, in words. Empty means the
  // caller passed nothing, which for a booking-capable company can only mean a
  // visit — the schema default — so the phrasing helper falls back to that.
  const modes = Array.isArray(bookableModes) && bookableModes.length ? bookableModes : ["visit"];

  const tools = [
    {
      type: "custom",
      name: "save_caller",
      // Deliberately says "as soon as", not "at the end". An agent that waits
      // for a tidy ending loses the caller who hangs up halfway, and half a
      // lead with a phone number beats a complete one that was never saved.
      description:
        "Save the caller's details so someone can ring them back. Call this as " +
        "soon as you have a name and a phone number — do not wait until the end " +
        "of the call. You can call it again later with more detail.",
      url: url("save-caller"),
      speak_during_execution: false,
      speak_after_execution: false,
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "The caller's name." },
          phone: {
            type: "string",
            description:
              "Their phone number, exactly as they gave it — digits or spoken " +
              "words are both fine. If they didn't give one, use the number " +
              "they're calling from.",
          },
          // ── Theirs, not ours ────────────────────────────────────────────
          //
          // On a real call the agent read the company's own inbound photo
          // address out loud, and it came back here as the caller's email. The
          // lead, and then the client record, were keyed to the contractor's
          // own inbox — which matches every other caller who was read the same
          // address, so one client record swallows all of them.
          //
          // Said here AND refused server-side (app/api/voice/tools/[tool]),
          // because a description is guidance and the route is the rule.
          email: {
            type: "string",
            description:
              "Their OWN email, and only if they spelled it out to you. If you " +
              "read an address out to them — for photos, for anything — that " +
              "address belongs to the business, not to them. Leave this out.",
          },
          address: {
            type: "string",
            description: "Where the work is. The address of the job, not their billing address.",
          },
          summary: {
            type: "string",
            description:
              "What they want, in one or two plain sentences. Write what they " +
              "actually said, not a tidied-up version.",
          },
          urgency: {
            type: "string",
            enum: ["emergency", "soon", "planning"],
            description:
              "emergency = something is broken or dangerous right now. " +
              "soon = within a couple of weeks. planning = no rush.",
          },
          // Reported, never assumed. Whoever picks this lead up has to be able
          // to tell a quote that is deliberately photo-less from one where
          // nobody thought to ask — so the agent says whether it asked, and the
          // route stamps when. Whether the photos actually turned up is a
          // separate question answered by the attachments, not by this.
          photos_requested: {
            type: "boolean",
            description:
              "True only if you actually asked them to email photos in on this " +
              "call. Leave it out if you didn't ask.",
          },
          // ── The honest fallback, made real ──────────────────────────────
          //
          // "Someone will ring you back" is the sentence the agent reaches for
          // whenever it cannot book, cannot quote and cannot transfer — which
          // is most of the calls it is allowed to have. Said on its own it is a
          // promise made by nobody: the lead exists, but nothing on it says a
          // person is expected to pick up the phone, and nothing carries the
          // one fact that makes the callback land — when they can take it.
          //
          // Two fields rather than a flag, because "call them back" and "call
          // them back after six" are different jobs, and the second is the one
          // that connects.
          callback_requested: {
            type: "boolean",
            description:
              "True if you told them someone would ring them back, or they " +
              "asked for a call back. Set this any time the call ends without " +
              "an appointment booked.",
          },
          preferred_times: {
            type: "string",
            description:
              "When they can take a call or a visit, in their own words — " +
              "\"after six\", \"weekends only\", \"any weekday morning\". Leave " +
              "it out rather than guessing.",
          },
        },
        required: ["name", "phone"],
      },
    },
  ];

  if (canBook) {
    tools.push(
      {
        type: "custom",
        name: "check_availability",
        // ── The description carries the MODE ────────────────────────────
        //
        // It said "come out" unconditionally, which was true while only
        // visit-offering companies got these tools at all. A company that does
        // phone consultations can book on the call now, and an agent working
        // from "find out when someone could come out" will tell that caller
        // somebody is driving over. The words are built from what the company
        // actually offers rather than from a guess about field trades.
        description:
          `Find out when someone could actually ${modePhrase(modes, "offer")}. ` +
          "Call this BEFORE offering any day or time. Never suggest a time you " +
          "haven't got from here.",
        url: url("availability"),
        speak_during_execution: true,
        parameters: {
          type: "object",
          properties: {
            preferred_date: {
              type: "string",
              description: "The day they'd like, as YYYY-MM-DD. Leave out for the next available.",
            },
          },
        },
      },
      {
        type: "custom",
        // The tool NAME is unchanged on purpose. It is what the provider has
        // on file and what every existing agent calls; renaming it to suit a
        // second mode would break every agent already provisioned, for a string
        // only the model reads. The description is what actually steers it.
        name: "book_visit",
        description:
          `Book ${modePhrase(modes)} in one of the slots check_availability ` +
          "returned. Only use a slot that came back from that tool, exactly as " +
          "it was given." +
          (modes.length > 1
            ? " Say which kind you are booking in `mode`: someone who wants a " +
              "quote or a question answered wants a phone call; someone who " +
              "wants the job looked at wants a visit."
            : ""),
        url: url("book"),
        speak_during_execution: true,
        parameters: {
          type: "object",
          properties: {
            slot: {
              type: "string",
              description: "The slot id from check_availability, copied exactly.",
            },
            name: { type: "string" },
            phone: { type: "string" },
            // Offered only when somebody could actually turn up. Asking a
            // caller to spell their street out to arrange a phone call is the
            // sort of thing that makes an assistant feel broken, and an address
            // taken for a call is one the server discards anyway.
            ...(modes.includes("visit")
              ? {
                  address: {
                    type: "string",
                    description:
                      "Where the visit is. Only for a visit — leave it out for a " +
                      "phone or video call.",
                  },
                }
              : {}),
            ...(modes.length > 1
              ? {
                  mode: {
                    type: "string",
                    enum: modes,
                    description:
                      "How you are meeting them: call = you ring them back, " +
                      "visit = somebody comes to the property, video = a video call.",
                  },
                }
              : {}),
          },
          required: ["slot", "name", "phone"],
        },
      },
    );
  }

  // ── Putting a caller through to a person ─────────────────────────────────
  //
  // VoiceAgent.transferTo has been editable in Settings > Voice, validated by
  // the API and returned by its GET since the feature shipped, and it reached
  // the provider NOWHERE. A contractor who typed their mobile in got an agent
  // that could not transfer and no indication of it — the dead control AGENTS.md
  // exists to stop. This is the missing half.
  //
  // `transfer_call` is a Retell built-in rather than one of our endpoints: the
  // provider bridges the legs itself, so there is nothing for us to serve and
  // no entry in TOOL_NAMES. A COLD transfer, deliberately — a warm one puts the
  // contractor on hold listening to a summary while the customer waits on the
  // other leg, and a one-van business is usually driving.
  if (transferTo) {
    tools.push({
      type: "transfer_call",
      name: "transfer_to_human",
      description:
        "Put the caller through to a real person. Use this when they ask to " +
        "speak to someone, when they are upset, when they say it is urgent, or " +
        "when they need something you are not allowed to answer — a price, a " +
        "date you cannot check, or whether something is covered. Tell them you " +
        "are putting them through before you call this.",
      transfer_destination: { type: "predefined", number: transferTo },
      transfer_option: { type: "cold_transfer" },
    });
  }

  return tools;
}

/**
 * Tool names we will actually serve over HTTP. Anything else is refused.
 *
 * `transfer_to_human` is absent on purpose — Retell bridges that call itself and
 * never posts to us, so serving a route for it would be an endpoint nothing
 * calls.
 */
export const TOOL_NAMES = ["save-caller", "availability", "book"];

/**
 * Spoken digits, in the four languages the receptionist answers in.
 *
 * "oh" and "o" are here because a person reading a number aloud says "five oh
 * four" far more often than "five zero four", and Retell transcribes it that
 * way. Nothing above nine is listed on purpose: "seventy" is ambiguous between
 * 70 and 7-0 and a phone number assembled from a guess rings a stranger.
 */
const SPOKEN_DIGITS = {
  zero: "0", oh: "0", o: "0", nought: "0", naught: "0",
  one: "1", two: "2", three: "3", four: "4", five: "5",
  six: "6", seven: "7", eight: "8", nine: "9",
  // French
  zéro: "0", un: "1", une: "1", deux: "2", trois: "3",
  quatre: "4", cinq: "5", sept: "7", huit: "8", neuf: "9",
  // Spanish
  cero: "0", uno: "1", dos: "2", tres: "3", cuatro: "4", cinco: "5",
  seis: "6", siete: "7", ocho: "8", nueve: "9",
};

// Words a person says around a number that carry no digits. Kept separate from
// the table above so an unknown word still disqualifies the whole string.
const PHONE_FILLER = new Set([
  "ext", "extension", "x", "poste", "and", "et", "y", "my", "number", "is",
  "it", "s", "plus", "area", "code",
]);

/**
 * Digits from whatever the model produced.
 *
 * A model transcribing a spoken phone number produces "five one four, five five
 * five..." as often as it produces digits, and "(514) 555-1234 ext 2". This
 * keeps digits and a leading +, which is all toE164 needs, and returns null
 * rather than a fragment — a lead with a mangled number is worse than one with
 * none, because nobody checks the ones that look filled in.
 *
 * ── Words, because that is what a real call produced ───────────────────────
 *
 * This used to strip everything that was not a digit, which turns
 *
 *     "eight one nine two three eight seven two six three"
 *
 * — a real caller giving a real mobile — into the empty string. `saveCaller`
 * then fell back to caller ID, so the number the caller ASKED to be rung on was
 * discarded in favour of the handset he happened to be holding. On the next
 * call from a different phone he is a brand new lead, and on the call after
 * that a brand new client.
 *
 * So spoken digits are read. Conservatively: the whole string has to be made of
 * numbers, spoken digits and a short list of filler. One unrecognised word and
 * the words are ignored entirely and only the literal digits are kept, because
 * "call me on my cell, three two one" is not a phone number and half of one is
 * worse than none.
 */
export function cleanPhone(input) {
  const raw = String(input || "");
  const literal = raw.replace(/[^\d+]/g, "");

  if (/[a-zà-ÿ]/i.test(raw)) {
    const tokens = raw
      .toLowerCase()
      .split(/[^0-9a-zà-ÿ]+/)
      .filter(Boolean);
    let spoken = "";
    let understood = tokens.length > 0;
    for (const token of tokens) {
      if (/^\d+$/.test(token)) {
        spoken += token;
        continue;
      }
      if (PHONE_FILLER.has(token)) continue;
      const digit = SPOKEN_DIGITS[token];
      if (digit === undefined) {
        understood = false;
        break;
      }
      spoken += digit;
    }
    // Only when the words alone carry MORE than the digits already did. A
    // string like "514-555-1234 ext 2" is understood by both readings and the
    // literal one is the one that has the extension in the right place.
    if (understood && spoken.length > literal.replace(/\D/g, "").length) {
      const prefixed = raw.trim().startsWith("+") ? `+${spoken}` : spoken;
      return spoken.length >= 7 ? prefixed : null;
    }
  }

  const bare = literal.replace(/\D/g, "");
  if (bare.length < 7) return null;
  return literal;
}

/** Trim and cap a free-text field from the model. */
export function cleanText(input, max = 500) {
  const s = String(input ?? "").trim();
  return s ? s.slice(0, max) : null;
}

/**
 * An email address, lowercased and trimmed — or null.
 *
 * One normaliser, because this string is a MATCHING KEY. The lead is written
 * here and the client is looked up in lib/ai/callQuoteDraft.js, and two
 * slightly different readings of "  Bob@Example.COM " are two clients.
 *
 * Deliberately not RFC 5322. The job is to refuse a string that cannot be a
 * key at all: one @, something either side, a dot in the domain, no spaces. A
 * model asked for an email off a phone call returns "he didn't give one" and
 * "algebra curio at icloud dot com" often enough that letting either through
 * would put a permanent non-address on a customer record.
 */
export function normaliseEmail(input) {
  const s = String(input ?? "").trim().toLowerCase();
  if (!s || s.length > 200 || /\s/.test(s)) return null;
  return /^[^@]+@[^@.]+(\.[^@.]+)+$/.test(s) ? s : null;
}
