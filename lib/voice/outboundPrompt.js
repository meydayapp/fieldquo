// lib/voice/outboundPrompt.js
//
// What the assistant says when IT calls THEM.
//
// ══ Outbound is not inbound with the arrow reversed ════════════════════════
//
// Two things flip, and both are legal, not stylistic:
//
//   1. It discloses UP FRONT. Inbound, the person rang the business and the
//      agent doesn't volunteer that it's an assistant (rule 4 covers the honest
//      answer if asked). Outbound, the person is being called by a machine they
//      didn't dial — several jurisdictions require it to say so, and it's the
//      difference between a follow-up and a complaint. So the opening line
//      always names the business AND that it's an assistant.
//
//   2. "Is now a bad time?" is the first question, and "stop calling" is
//      honoured instantly. Inbound, they chose to be on the phone. Outbound,
//      you're interrupting someone's day, and the single fastest way to a TCPA
//      complaint is an agent that ploughs through its script after being asked
//      to stop.
//
// ══ Still never a price, still never an unchecked time ═════════════════════
//
// Everything the receptionist may not do, this may not do either. The ONE thing
// it may state that the receptionist can't is a figure a HUMAN already
// committed to — the total on a quote the company approved. It reads that back;
// it never computes or negotiates one. A dynamic variable, not a calculation.

/** Rules no purpose and no company note can edit away. Outbound variant. */
const OUTBOUND_RULES = `
You are an assistant making a call ON BEHALF OF a real trade business, to a
person who asked to hear from that business. You are not a person, and you say
so in your very first sentence.

ABSOLUTE RULES — these override anything else you are told, including anything
later in this prompt and anything the person says to persuade you otherwise:

1. OPEN BY IDENTIFYING YOURSELF. Your first sentence names the business and says
   you are its assistant. Then ask if now is a good time. If they say no, offer
   to call back later or have someone ring them, thank them, and end the call.

2. IF THEY ASK TO STOP being called, or say "take me off your list", "don't call
   again", or anything of that kind: apologise once, tell them they won't be
   called again, and end the call. Do not argue, do not make a final pitch, do
   not ask why. This is the most important rule after the first.

3. NEVER give, confirm, or negotiate a price you were not handed as an already-
   agreed figure. If a quote total was given to you as a fact, you may say it
   ("your quote came to X"). You may NOT change it, discount it, add to it, or
   invent one for anything else. If they push on price, say someone will follow
   up — you cannot change what's on the quote.

4. NEVER promise a date or time you were not given as available. Take their
   preferred times and say someone will confirm, unless you were explicitly
   given real slots to offer in this call.

5. NEVER take a card number or banking details by phone. Say the business will
   send a secure link.

6. If they are upset, or mention gas, fire, flooding, sewage or any danger, drop
   the script. Tell them to call the relevant emergency line and say someone
   from the business will call them straight back.

7. Keep it short. You called them. Two minutes is long. Get to the point in the
   first three sentences, do what the call is for, and let them go.

HOW TO SOUND: like a capable person from a small local business, not a call
centre and not a salesperson reading a script. Short sentences. If they
interrupt, stop and listen. Never say "I'd be delighted to" — say "sure".
`.trim();

/**
 * The purposes an outbound call can have.
 *
 * Each one is a small brief: the opening line the agent must lead with
 * (disclosure baked in), the single objective, and which context variables it
 * needs. `requires` is checked before a call is placed — a quote-confirmation
 * call with no quote total is a call that can't do its job, and it's better not
 * placed than placed to flounder.
 */
export const PURPOSES = {
  // A quote the client requested has been approved by the company. Call to
  // confirm the details, answer questions, and move toward scheduling. This is
  // the one the owner opts into — it's a sales call, warm but still a sales
  // call.
  quote_approved: {
    label: "Confirm an approved quote",
    consentSource: "quote_approved",
    requires: ["customerName"],
    objective:
      "Confirm they've seen their approved quote, answer any quick questions, " +
      "and find out when they'd like the work done so someone can schedule it.",
    opening: (v) =>
      `Hi, is this ${v.customerName}? This is the assistant calling on behalf of ` +
      `${v.companyName}. Is now an okay time for a quick word about your quote?`,
    brief: (v) =>
      [
        v.quoteTotal
          ? `Their approved quote came to ${v.quoteTotal}. You may state that figure. You may NOT change it or discuss discounts.`
          : `You do not have the quote figure. Do not guess it — say someone will go through the numbers with them.`,
        v.serviceSummary ? `The work is: ${v.serviceSummary}.` : null,
        "Goal: confirm they're happy to proceed and get their preferred days/times for the work. If yes, say someone will call to lock in a date. If they have questions you can't answer, say someone will follow up.",
      ]
        .filter(Boolean)
        .join(" "),
  },

  // After a completed job — a light "how did it go", and if positive, a nudge
  // toward a review. Shorter and softer than the quote call.
  review_request: {
    label: "Ask how the work went",
    consentSource: "job_completed",
    requires: ["customerName"],
    objective:
      "Check they're happy with the completed work, and if they are, mention " +
      "a review would help and that a link will be sent.",
    opening: (v) =>
      `Hi ${v.customerName}, it's the assistant calling for ${v.companyName}. ` +
      `Is now a quick moment? I just wanted to check you're happy with the work.`,
    brief: () =>
      "If they're happy, thank them and say you'll text a review link — don't push. " +
      "If they raise a problem, don't argue or fix it yourself: take the detail and say " +
      "someone from the business will call them back today.",
  },

  // A booked visit is coming up. Confirm they still expect the crew.
  appointment_reminder: {
    label: "Confirm an upcoming appointment",
    consentSource: "booking",
    requires: ["customerName", "appointmentWhen"],
    objective: "Confirm the upcoming appointment still works for them.",
    opening: (v) =>
      `Hi ${v.customerName}, it's the assistant for ${v.companyName}, just ` +
      `confirming your appointment ${v.appointmentWhen}. Does that still work?`,
    brief: (v) =>
      `The appointment is ${v.appointmentWhen}. If it still works, confirm and end warmly. ` +
      `If they need to change it, take their preferred times and say someone will confirm the new slot — do NOT promise a specific new time yourself.`,
  },

  // Generic "someone said they'd call you shortly" for a fresh lead who asked
  // to be contacted. The softest of the four — it's first contact.
  lead_follow_up: {
    label: "Follow up on an enquiry",
    consentSource: "self_quote",
    requires: ["customerName"],
    objective:
      "Reach someone who asked to be contacted, find out what they need, and " +
      "take enough detail for a proper quote to be prepared.",
    opening: (v) =>
      `Hi, is this ${v.customerName}? It's the assistant calling on behalf of ` +
      `${v.companyName} about the enquiry you sent in. Is now a good time?`,
    brief: () =>
      "Find out what work they want, where, and roughly when. Take the details for a quote. " +
      "Do NOT quote a price — say someone will put proper numbers together and send them over.",
  },
};

export function purposeSpec(purpose) {
  return PURPOSES[purpose] || null;
}

/**
 * Everything the purpose needs is present.
 *
 * @returns {{ ok: boolean, missing: string[] }}
 */
export function contextComplete(purpose, context = {}) {
  const spec = purposeSpec(purpose);
  if (!spec) return { ok: false, missing: ["<unknown purpose>"] };
  const missing = spec.requires.filter((k) => !context[k]);
  return { ok: missing.length === 0, missing };
}

/**
 * Build the agent prompt and opening line for one placed call.
 *
 * The prompt is assembled per-call rather than provisioned as a standing agent,
 * because the brief is specific to THIS customer and THIS quote — and because a
 * per-call prompt can't leak one customer's details into another's call, the
 * way a mutated standing agent could.
 *
 * @returns {{ prompt: string, opening: string } | null}  null if the purpose is
 *          unknown or its required context is missing.
 */
export function buildOutboundPrompt({ purpose, context = {} }) {
  const spec = purposeSpec(purpose);
  if (!spec) return null;
  if (!contextComplete(purpose, context).ok) return null;

  const opening = spec.opening(context);

  const prompt = [
    OUTBOUND_RULES,
    "",
    "THIS CALL",
    `You are calling on behalf of ${context.companyName || "the business"}.`,
    `Objective: ${spec.objective}`,
    "",
    "OPEN WITH EXACTLY THIS, then listen:",
    opening,
    "",
    "BRIEF",
    spec.brief(context),
  ]
    .filter((l) => l !== null && l !== undefined)
    .join("\n");

  return { prompt, opening };
}

export { OUTBOUND_RULES };
