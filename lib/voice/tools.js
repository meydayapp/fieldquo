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

/**
 * The tool definitions handed to Retell.
 *
 * Descriptions are written for the MODEL, not for a developer. "Call this when
 * you have their name and a phone number" produces far better behaviour than
 * "creates a LeadRequest", because the model is deciding *when*, not *what*.
 */
export function toolDefinitions(origin, { canBook = false, transferTo = null } = {}) {
  const url = (path) => `${origin}/api/voice/tools/${path}`;

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
              "Their phone number, digits only. If they didn't give one, use the " +
              "number they're calling from.",
          },
          email: { type: "string", description: "Their email, if they gave one." },
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
        description:
          "Find out when someone could actually come out. Call this BEFORE " +
          "offering any day or time. Never suggest a time you haven't got from here.",
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
        name: "book_visit",
        description:
          "Book one of the slots check_availability returned. Only use a slot " +
          "that came back from that tool, exactly as it was given.",
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
            address: { type: "string", description: "Where the visit is." },
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
 * Digits from whatever the model produced.
 *
 * A model transcribing a spoken phone number produces "five one four, five five
 * five..." as often as it produces digits, and "(514) 555-1234 ext 2". This
 * keeps digits and a leading +, which is all toE164 needs, and returns null
 * rather than a fragment — a lead with a mangled number is worse than one with
 * none, because nobody checks the ones that look filled in.
 */
export function cleanPhone(input) {
  const raw = String(input || "");
  const digits = raw.replace(/[^\d+]/g, "");
  const bare = digits.replace(/\D/g, "");
  if (bare.length < 7) return null;
  return digits;
}

/** Trim and cap a free-text field from the model. */
export function cleanText(input, max = 500) {
  const s = String(input ?? "").trim();
  return s ? s.slice(0, max) : null;
}
